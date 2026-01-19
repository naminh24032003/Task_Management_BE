import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// CQRS Handlers
import { CommandHandlers } from './commands';
import { QueryHandlers } from './queries';

// Services
import { UserRegistrationService } from './services/user-registration.service';
import { UserAuthenticationService } from './services/user-authentication.service';
import { UserManagementService } from './services/user-management.service';
import { GoogleOAuthService } from './services/google-oauth.service';

@Module({
  imports: [
    CqrsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRES_IN', 3600),
        },
      }),
    }),
  ],
  providers: [
    // CQRS Handlers
    ...CommandHandlers,
    ...QueryHandlers,
    // Application services
    UserRegistrationService,
    UserAuthenticationService,
    UserManagementService,
    GoogleOAuthService,
  ],
  exports: [
    CqrsModule,
    UserRegistrationService,
    UserAuthenticationService,
    UserManagementService,
    GoogleOAuthService,
  ],
})
export class ApplicationModule {}
