import { Module } from '@nestjs/common';
import { LaporanPiketService } from './laporan-piket.service';
import { LaporanPiketController } from './laporan-piket.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../common/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [LaporanPiketController],
  providers: [LaporanPiketService, StorageService],
})
export class LaporanPiketModule {}
