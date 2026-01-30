import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginCommand } from './google-login.command';
import { User } from '../../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserRegisteredEvent } from '../../integration-events/user-registered.event';
import { IOAuthConfig } from '../../ports/oauth.port';
import { GoogleLoginResult } from '../../types';

export { GoogleLoginResult };

@CommandHandler(GoogleLoginCommand)
export class GoogleLoginHandler implements ICommandHandler<GoogleLoginCommand> {
  private oauthClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly eventBus: EventBus,
  ) {
    const oauthConfig = this.configService.get<IOAuthConfig>('oauth');
    this.oauthClient = new OAuth2Client(oauthConfig.google.clientId);
  }

  async execute(command: GoogleLoginCommand): Promise<GoogleLoginResult> {
    // Verify Google ID token
    const googleUser = await this.verifyIdToken(command.idToken);

    // Check if user exists
    let user = await this.userRepository.findByEmail(command.tenantId, googleUser.email);
    let isNewUser = false;

    if (!user) {
      // Create new OAuth user
      user = User.createOAuthUser({
        tenantId: command.tenantId,
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        displayName: `${googleUser.firstName} ${googleUser.lastName}`.trim(),
        provider: 'google',
        providerId: googleUser.googleId,
      });

      user = await this.userRepository.save(user);
      isNewUser = true;

      // Publish integration event for new user
      this.eventBus.publish(
        new UserRegisteredEvent(
          user.id.toString(),
          user.tenantId,
          user.email.toString(),
          user.firstName,
          user.lastName,
        ),
      );
    }

    // Update last login
    user.updateLastLogin();
    await this.userRepository.save(user);
    user.clearDomainEvents();

    return { user, isNewUser };
  }

  private async verifyIdToken(idToken: string) {
    const oauthConfig = this.configService.get<IOAuthConfig>('oauth');

    const ticket = await this.oauthClient.verifyIdToken({
      idToken,
      audience: oauthConfig.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google ID token');
    }

    return {
      email: payload.email,
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      googleId: payload.sub,
    };
  }
}
