import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { KinerjaGuruController } from './kinerja-guru.controller';
import { KinerjaGuruService } from './kinerja-guru.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JadwalModule } from '../jadwal/jadwal.module';

@Module({
  imports: [AccessModule, PrismaModule, JadwalModule],
  controllers: [KinerjaGuruController],
  providers: [KinerjaGuruService],
  exports: [KinerjaGuruService],
})
export class KinerjaGuruModule {}
