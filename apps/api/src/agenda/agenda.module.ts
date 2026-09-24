import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { StorageService } from '../common/storage.service';
import { AuditService } from '../common/audit.service';
import { FeatureAccessGuard } from '../auth/feature-access.guard';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [AgendaController],
  // FeatureAccessGuard juga dipakai service untuk menghitung `bolehKelola`.
  providers: [AgendaService, StorageService, AuditService, FeatureAccessGuard],
})
export class AgendaModule {}
