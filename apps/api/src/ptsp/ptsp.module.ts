import { Module } from '@nestjs/common';
import { PtspController } from './ptsp.controller';
import { PtspService } from './ptsp.service';
import { PtspPrismaService } from './ptsp-prisma.service';

@Module({
  controllers: [PtspController],
  providers: [PtspPrismaService, PtspService],
  exports: [PtspService],
})
export class PtspModule {}
