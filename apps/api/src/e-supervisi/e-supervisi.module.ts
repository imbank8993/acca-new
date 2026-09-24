import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ESupervisiController } from './e-supervisi.controller';
import { ESupervisiService } from './e-supervisi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JadwalModule } from '../jadwal/jadwal.module';
import { StorageService } from '../common/storage.service';

@Module({
  imports: [AccessModule, PrismaModule, JadwalModule],
  controllers: [ESupervisiController],
  providers: [ESupervisiService, StorageService],
  exports: [ESupervisiService],
})
export class ESupervisiModule {}
