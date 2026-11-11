import { Module } from '@nestjs/common';
import { PengumumanController } from './pengumuman.controller';
import { PengumumanService } from './pengumuman.service';
import { FeatureAccessGuard } from '../auth/feature-access.guard';

@Module({
  controllers: [PengumumanController],
  providers: [PengumumanService, FeatureAccessGuard]
})
export class PengumumanModule {}

