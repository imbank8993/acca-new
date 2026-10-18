import { Module } from '@nestjs/common';
import { PtspController } from './ptsp.controller';
import { PtspService } from './ptsp.service';

@Module({
  controllers: [PtspController],
  providers: [PtspService],
  exports: [PtspService],
})
export class PtspModule {}
