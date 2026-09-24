import { Module } from '@nestjs/common';
import { AbsensiController } from './absensi.controller';
import { AbsensiService } from './absensi.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AbsensiController],
  providers: [AbsensiService],
  exports: [AbsensiService],
})
export class AbsensiModule {}
