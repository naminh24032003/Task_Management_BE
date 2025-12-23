import { Module } from '@nestjs/common';
import { UserController } from './ports/inbound/user.controller';

@Module({
    imports: [],
    controllers: [UserController],
    providers: [],
})
export class AppModule { }
