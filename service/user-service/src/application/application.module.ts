import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { User } from '../infrastructure/database/typeorm/entities/user.entity';

// Repository
import { UserDomainRepository } from '../infrastructure/database/typeorm/repositories/user-domain.repository';
import { USER_REPOSITORY } from './ports/user-repository.port';

// CQRS Handlers
import { CommandHandlers } from './commands';
import { QueryHandlers } from './queries';

// Services (kept for backwards compatibility)
import { UserRegistrationService } from './services/user-registration.service';
import { UserAuthenticationService } from './services/user-authentication.service';
import { UserManagementService } from './services/user-management.service';
import { GoogleOAuthService } from './services/google-oauth.service';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([User]),
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
    // Repository binding
    {
      provide: USER_REPOSITORY,
      useClass: UserDomainRepository,
    },
    // CQRS Handlers
    ...CommandHandlers,
    ...QueryHandlers,
    // Application services (backwards compatibility)
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
    USER_REPOSITORY,
  ],
})
export class ApplicationModule {}
