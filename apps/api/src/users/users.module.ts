import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { OrangtuaModule } from '../orangtua/orangtua.module';
import { RegisterController } from './register.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, AccessModule, OrangtuaModule],
  controllers: [UsersController, RegisterController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
