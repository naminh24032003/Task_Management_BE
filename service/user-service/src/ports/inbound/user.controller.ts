import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

interface HelloRequest {
    name: string;
}

interface HelloResponse {
    message: string;
}

@Controller()
export class UserController {
    @GrpcMethod('UserService', 'HelloWorld')
    helloWorld(data: HelloRequest): HelloResponse {
        console.log('📨 Received HelloWorld request:', data);
        return {
            message: `Hello, ${data.name}! Welcome to User Service via gRPC 🎉`,
        };
    }
}
