import { Module } from '@nestjs/common';
import { JurnalService } from './jurnal.service';
import { JurnalController } from './jurnal.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { JadwalModule } from '../jadwal/jadwal.module';

@Module({
  imports: [PrismaModule, AccessModule, JadwalModule],
  providers: [JurnalService],
  controllers: [JurnalController]
})
export class JurnalModule {}
