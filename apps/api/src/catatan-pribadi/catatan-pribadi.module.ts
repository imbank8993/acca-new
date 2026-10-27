import { Module } from '@nestjs/common';
import { CatatanPribadiController } from './catatan-pribadi.controller';
import { CatatanPribadiService } from './catatan-pribadi.service';

@Module({
  controllers: [CatatanPribadiController],
  providers: [CatatanPribadiService],
})
export class CatatanPribadiModule {}
