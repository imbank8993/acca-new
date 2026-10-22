import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from '../common/audit.service';
import { AccessModule } from '../access/access.module';
import { AuditExplorerService } from './audit-explorer.service';

@Module({
  imports: [AccessModule],
  controllers: [AuditController],
  providers: [AuditService, AuditExplorerService],
  exports: [AuditService],
})
export class AuditModule {}
