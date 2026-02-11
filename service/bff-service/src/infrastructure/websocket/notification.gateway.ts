import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import {
  RedisSubscriberService,
  NotificationEvent,
} from '../redis/redis-subscriber.service';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow connections without origin (e.g., mobile apps, Postman)
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  // Map of userId → Set of socket IDs (a user can have multiple connections)
  private readonly userSockets = new Map<string, Set<string>>();
  // Map of socket ID → userId
  private readonly socketUsers = new Map<string, string>();
  private subscription: Subscription;

  constructor(
    private readonly redisSubscriber: RedisSubscriberService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Notification WebSocket Gateway initialized');

    // Subscribe to Redis Pub/Sub notifications and broadcast to connected users
    this.subscription = this.redisSubscriber.notifications$.subscribe(
      (event: NotificationEvent) => {
        this.broadcastToUser(event.user_id, event);
      },
    );
  }

  async handleConnection(client: Socket) {
    try {
      const userId = this.authenticateClient(client);
      if (!userId) {
        this.logger.warn(`Unauthenticated WebSocket connection rejected: ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      // Register the user-socket mapping
      this.socketUsers.set(client.id, userId);
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user-specific room for targeted broadcasts
      client.join(`user:${userId}`);

      this.logger.log(
        `Client connected: ${client.id} (user: ${userId}), ` +
          `total connections: ${this.socketUsers.size}`,
      );

      client.emit('connected', {
        message: 'Connected to notification service',
        userId,
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.socketUsers.delete(client.id);
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    this.logger.log(
      `Client disconnected: ${client.id} (user: ${userId || 'unknown'}), ` +
        `total connections: ${this.socketUsers.size}`,
    );
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * Broadcast a notification to all connections of a specific user
   */
  private broadcastToUser(userId: string, event: NotificationEvent) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      this.logger.debug(
        `User ${userId} not connected, skipping WebSocket broadcast`,
      );
      return;
    }

    // Emit to user-specific room
    this.server.to(`user:${userId}`).emit('notification', {
      id: event.notification_id,
      type: event.type,
      title: event.title,
      body: event.body,
      priority: event.priority,
      sourceEvent: event.source_event,
      sourceId: event.source_id,
      metadata: event.metadata,
      createdAt: event.created_at,
    });

    this.logger.debug(
      `Broadcast notification ${event.notification_id} to user ${userId} (${sockets.size} connections)`,
    );
  }

  /**
   * Authenticate the WebSocket client
   * Supports:
   * - Socket.IO auth: { token: 'JWT_TOKEN' }
   * - Query param: ?token=JWT_TOKEN
   * - Kong headers: x-user-id
   */
  private authenticateClient(client: Socket): string | null {
    const authMode = this.configService.get<string>('auth.mode', 'kong');

    // 1. Check Kong headers (when behind Kong proxy)
    if (authMode === 'kong') {
      const userId =
        client.handshake.headers['x-user-id'] as string;
      if (userId) {
        return userId;
      }
    }

    // 2. Check Socket.IO auth object
    const token =
      (client.handshake.auth as any)?.token ||
      (client.handshake.query?.token as string);

    if (!token) {
      return null;
    }

    // 3. Validate JWT token
    try {
      const jwtSecret = this.configService.get<string>('auth.jwtSecret');
      if (!jwtSecret) {
        this.logger.error('JWT secret not configured');
        return null;
      }

      const decoded = jwt.verify(token, jwtSecret) as any;

      if (decoded.type && decoded.type !== 'access') {
        return null;
      }

      return decoded.sub;
    } catch (error) {
      this.logger.warn(`WebSocket JWT validation failed: ${error}`);
      return null;
    }
  }

  /**
   * Get the count of currently connected users
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get the total count of active WebSocket connections
   */
  getConnectionsCount(): number {
    return this.socketUsers.size;
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
