import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';
import { UserAuthenticationService } from './user-authentication.service';
import { IOAuthConfig } from '../ports/oauth.port';

export interface GoogleUserInfo {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  googleId: string;
}

export interface GoogleLoginResult {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  isNewUser: boolean;
}

@Injectable()
export class GoogleOAuthService {
  private oauthClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authService: UserAuthenticationService,
  ) {
    const oauthConfig = this.configService.get<IOAuthConfig>('oauth');
    this.oauthClient = new OAuth2Client(oauthConfig.google.clientId);
  }

  /**
   * Verify Google ID token and extract user info
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
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
      picture: payload.picture,
      googleId: payload.sub,
    };
  }

  /**
   * Login or register user with Google OAuth
   */
  async loginWithGoogle(
    tenantId: string,
    idToken: string,
  ): Promise<GoogleLoginResult> {
    // Verify the token and get user info
    const googleUser = await this.verifyIdToken(idToken);

    // Check if user already exists
    let user = await this.userRepository.findByEmail(tenantId, googleUser.email);
    let isNewUser = false;

    if (!user) {
      // Create new user with Google info (no password required)
      user = User.createOAuthUser({
        tenantId,
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        displayName: `${googleUser.firstName} ${googleUser.lastName}`.trim(),
        provider: 'google',
        providerId: googleUser.googleId,
      });

      user = await this.userRepository.save(user);
      isNewUser = true;
    }

    // Generate tokens
    const tokens = await this.authService.generateTokens(user);

    // Update last login
    user.updateLastLogin();
    await this.userRepository.save(user);

    return {
      user,
      tokens,
      isNewUser,
    };
  }
}
