import { Module } from '@nestjs/common';
import { TugasTambahanService } from './tugas-tambahan.service';
import { TugasTambahanController } from './tugas-tambahan.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [TugasTambahanController],
  providers: [TugasTambahanService],
})
export class TugasTambahanModule {}
