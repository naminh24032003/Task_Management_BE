import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import typeormConfig from './typeorm.config';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Tenant } from './entities/tenant.entity';

@Module({
  imports: [
    ConfigModule.forFeature(typeormConfig),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('typeorm'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, Role, Permission, Tenant]),
  ],
  exports: [TypeOrmModule],
})
export class TypeOrmConfigModule {}
