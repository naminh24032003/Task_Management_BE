import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// CQRS Handlers
import { CommandHandlers } from './commands';
import { QueryHandlers } from './queries';
import { EventHandlers } from './event-handlers';

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
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }

        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: configService.get<number>('JWT_ACCESS_EXPIRES_IN', 900),
          },
        };
      },
    }),
  ],
  providers: [
    // CQRS Handlers
    ...CommandHandlers,
    ...QueryHandlers,
    // Event Handlers (Kafka integration)
    ...EventHandlers,
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
export class ApplicationModule { }
