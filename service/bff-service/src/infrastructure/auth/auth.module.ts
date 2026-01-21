import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { KongAuthGuard } from './guards/kong-auth.guard';
import { UnifiedAuthGuard } from './guards/unified-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [ConfigModule],
  providers: [JwtAuthGuard, KongAuthGuard, UnifiedAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, KongAuthGuard, UnifiedAuthGuard, RolesGuard],
})
export class AuthModule {}
