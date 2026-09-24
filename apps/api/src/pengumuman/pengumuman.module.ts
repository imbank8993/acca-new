import { Module } from '@nestjs/common';
import { PengumumanController } from './pengumuman.controller';
import { PengumumanService } from './pengumuman.service';
import { AuditService } from '../common/audit.service';
import { FeatureAccessGuard } from '../auth/feature-access.guard';

@Module({
  controllers: [PengumumanController],
  providers: [PengumumanService, AuditService, FeatureAccessGuard]
})
export class PengumumanModule {}

