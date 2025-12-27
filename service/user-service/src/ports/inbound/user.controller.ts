import { Controller } from '@nestjs/common';
// Import generated types - auto-synced with proto file!
import {
    HelloRequest,
    HelloResponse,
    UserServiceController,
    UserServiceControllerMethods,
} from '../../generated/user/v1/user';

@Controller()
@UserServiceControllerMethods()
export class UserController implements UserServiceController {
    helloWorld(data: HelloRequest): HelloResponse {
        console.log('📨 Received HelloWorld request:', data);
        return {
            message: `Hello, ${data.name}! Welcome to User Service via gRPC 🎉`,
        };
    }
}
