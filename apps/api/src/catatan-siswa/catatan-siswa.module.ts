import { Module } from '@nestjs/common';
import { CatatanSiswaController } from './catatan-siswa.controller';
import { CatatanSiswaService } from './catatan-siswa.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CatatanSiswaController],
  providers: [CatatanSiswaService],
})
export class CatatanSiswaModule {}
