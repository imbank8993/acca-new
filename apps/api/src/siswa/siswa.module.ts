import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SiswaController } from './siswa.controller';
import { SiswaService } from './siswa.service';

@Module({
  imports: [AccessModule],
  controllers: [SiswaController],
  providers: [SiswaService],
  exports: [SiswaService],
})
export class SiswaModule {}
