import { Module } from '@nestjs/common';
import { PtspController } from './ptsp.controller';
import { PtspService } from './ptsp.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PtspController],
  providers: [PtspService],
  exports: [PtspService],
})
export class PtspModule {}
