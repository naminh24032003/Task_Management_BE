import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { LoginCommand } from './login.command';
import { User } from '../../../domain/aggregates/user.aggregate';
import { IUserRepository, USER_REPOSITORY } from '../../ports/user-repository.port';
import { UserAuthenticationService, TokenPair } from '../../services/user-authentication.service';

export interface LoginResult {
  user: User;
  tokens: TokenPair;
}

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authService: UserAuthenticationService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // Find user
    const user = await this.userRepository.findByEmail(command.tenantId, command.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive()) {
      throw new ForbiddenException('Account is not active');
    }

    // Check if OAuth user trying to login with password
    if (user.isOAuthUser()) {
      throw new UnauthorizedException('Please login with your OAuth provider');
    }

    if (!user.verifyPassword(command.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Record login
    user.recordLogin();
    await this.userRepository.save(user);

    // Generate tokens using shared auth service
    const tokens = await this.authService.generateTokens(user);

    return { user, tokens };
  }
}
