import { Module } from '@nestjs/common';
import { TugasSiswaController } from './tugas-siswa.controller';
import { TugasSiswaService } from './tugas-siswa.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [TugasSiswaController],
  providers: [TugasSiswaService],
  exports: [TugasSiswaService],
})
export class TugasSiswaModule {}
