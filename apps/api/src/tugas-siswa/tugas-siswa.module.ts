import { Module } from '@nestjs/common';
import { TugasSiswaController } from './tugas-siswa.controller';
import { TugasSiswaService } from './tugas-siswa.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TugasSiswaController],
  providers: [TugasSiswaService],
  exports: [TugasSiswaService],
})
export class TugasSiswaModule {}
