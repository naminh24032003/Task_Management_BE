import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cluster } from 'ioredis';
import { Subject } from 'rxjs';

export interface NotificationEvent {
  event_type: string;
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  source_event: string;
  source_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

const REALTIME_CHANNEL = 'notification:realtime';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private subscriber: Cluster | null = null;
  private readonly notificationSubject = new Subject<NotificationEvent>();

  public readonly notifications$ = this.notificationSubject.asObservable();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');

      // Create a dedicated Redis Cluster connection for subscribing
      this.subscriber = new Cluster([{ host, port }], {
        redisOptions: {
          password: password || undefined,
        },
        clusterRetryStrategy: (times) => {
          if (times > 5) {
            this.logger.error(
              'Redis Cluster subscriber connection failed after 5 retries',
            );
            return null;
          }
          return Math.min(times * 200, 5000);
        },
      });

      this.subscriber.on('connect', () => {
        this.logger.log('Redis Cluster subscriber connected');
      });

      this.subscriber.on('error', (error: Error) => {
        this.logger.warn(`Redis Cluster subscriber error: ${error.message}`);
      });

      // Subscribe to the notification real-time channel
      this.subscriber.on('message', (channel: string, message: string) => {
        if (channel === REALTIME_CHANNEL) {
          this.handleNotificationMessage(message);
        }
      });

      await this.subscriber.subscribe(REALTIME_CHANNEL);
      this.logger.log(
        `Subscribed to Redis Pub/Sub channel: ${REALTIME_CHANNEL}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize Redis subscriber: ${error}. Real-time notifications disabled.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(REALTIME_CHANNEL);
        await this.subscriber.quit();
        this.logger.log('Redis subscriber disconnected');
      } catch (error) {
        this.logger.warn(`Error disconnecting Redis subscriber: ${error}`);
      }
    }
    this.notificationSubject.complete();
  }

  private handleNotificationMessage(message: string) {
    try {
      const event: NotificationEvent = JSON.parse(message);
      this.logger.debug(
        `Received notification for user ${event.user_id}: ${event.type}`,
      );
      this.notificationSubject.next(event);
    } catch (error) {
      this.logger.error(`Failed to parse notification message: ${error}`);
    }
  }
}
