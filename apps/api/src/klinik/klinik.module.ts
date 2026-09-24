import { Module } from '@nestjs/common';
import { KlinikController } from './klinik.controller';
import { KlinikService } from './klinik.service';

@Module({
  controllers: [KlinikController],
  providers: [KlinikService],
})
export class KlinikModule {}
