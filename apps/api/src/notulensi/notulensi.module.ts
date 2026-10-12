import { Module } from '@nestjs/common';
import { NotulensiController } from './notulensi.controller';
import { NotulensiService } from './notulensi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { AuditService } from '../common/audit.service';
import { FeatureAccessGuard } from '../auth/feature-access.guard';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [NotulensiController],
  providers: [NotulensiService, AuditService, FeatureAccessGuard],
  exports: [NotulensiService],
})
export class NotulensiModule {}
