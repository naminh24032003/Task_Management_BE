import { Module, Global } from '@nestjs/common';
import { AuthCacheService } from './auth-cache.service';
import { RedisModule } from '../redis/redis.module';

/**
 * Auth Cache Module
 *
 * Provides caching layer for authentication/authorization data:
 * - Access token sessions
 * - Refresh tokens
 * - User permissions
 * - User roles
 * - JWKS public keys
 *
 * This module is global and can be imported once in the root module.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [AuthCacheService],
  exports: [AuthCacheService],
})
export class AuthCacheModule {}
