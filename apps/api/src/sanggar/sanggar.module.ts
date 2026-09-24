import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SanggarService } from './sanggar.service';
import { SanggarController } from './sanggar.controller';

@Module({
  imports: [AccessModule],
  controllers: [SanggarController],
  providers: [SanggarService],
  exports: [SanggarService],
})
export class SanggarModule {}
