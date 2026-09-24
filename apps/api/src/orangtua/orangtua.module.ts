import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { OrangtuaController } from './orangtua.controller';
import { OrangtuaService } from './orangtua.service';

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [OrangtuaController],
  providers: [OrangtuaService],
  exports: [OrangtuaService],
})
export class OrangtuaModule {}
