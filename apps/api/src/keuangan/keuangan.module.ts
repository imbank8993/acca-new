import { Module } from '@nestjs/common';
import { KeuanganController } from './keuangan.controller';
import { KeuanganService } from './keuangan.service';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [AccessModule],
  controllers: [KeuanganController],
  providers: [KeuanganService]
})
export class KeuanganModule {}
