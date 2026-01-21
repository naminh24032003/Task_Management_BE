import { Injectable, Logger } from '@nestjs/common';
import { UserGrpcClient } from '../../infrastructure/grpc/clients/user.client';
import { RegisterInput } from '../../presentation/graphql/inputs/user.input';

@Injectable()
export class RegisterUseCase {
    private readonly logger = new Logger(RegisterUseCase.name);

    constructor(private readonly userClient: UserGrpcClient) { }

    async execute(input: RegisterInput) {
        this.logger.log(`Executing RegisterUseCase for email: ${input.email}`);
        const result = await this.userClient.register({
            tenantId: input.tenantId,
            email: input.email,
            password: input.password,
            firstName: input.firstName,
            lastName: input.lastName,
        });
        return result;
    }
}
