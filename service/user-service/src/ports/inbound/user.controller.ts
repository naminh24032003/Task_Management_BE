import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class UserController {
    @GrpcMethod('UserService', 'HelloWorld')
    helloWorld(data: { name: string }): { message: string } {
        console.log('Received Hello Request:', data);
        return { message: `Hello ${data.name}` };
    }
}
