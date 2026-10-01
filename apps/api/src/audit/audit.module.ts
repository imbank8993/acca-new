import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from '../common/audit.service';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [AccessModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
