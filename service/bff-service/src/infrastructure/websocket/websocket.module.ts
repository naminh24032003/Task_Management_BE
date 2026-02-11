import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationGateway } from './notification.gateway';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';

@Module({
  imports: [ConfigModule],
  providers: [RedisSubscriberService, NotificationGateway],
  exports: [NotificationGateway, RedisSubscriberService],
})
export class WebSocketModule {}
