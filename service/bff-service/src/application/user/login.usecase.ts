import { Injectable, Logger } from '@nestjs/common';
import { UserGrpcClient } from '../../infrastructure/grpc/clients/user.client';
import { LoginInput } from '../../presentation/graphql/inputs/user.input';

@Injectable()
export class LoginUseCase {
    private readonly logger = new Logger(LoginUseCase.name);

    constructor(private readonly userClient: UserGrpcClient) { }

    async execute(input: LoginInput) {
        this.logger.log(`Executing LoginUseCase for email: ${input.email}`);
        const result = await this.userClient.login({
            tenantId: input.tenantId,
            email: input.email,
            password: input.password,
        });
        return result;
    }
}
