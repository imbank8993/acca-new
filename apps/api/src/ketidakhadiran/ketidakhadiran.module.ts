import { Module } from '@nestjs/common';
import { KetidakhadiranController } from './ketidakhadiran.controller';
import { KetidakhadiranService } from './ketidakhadiran.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [KetidakhadiranController],
  providers: [KetidakhadiranService],
  exports: [KetidakhadiranService],
})
export class KetidakhadiranModule {}
