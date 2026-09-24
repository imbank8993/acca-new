import { JadwalWriteService } from './jadwal-write.service';
import { Module } from '@nestjs/common';
import { JadwalController } from './jadwal.controller';
import { JadwalService } from './jadwal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [JadwalController],
  providers: [JadwalService, JadwalWriteService],
  exports: [JadwalService],
})
export class JadwalModule {}
