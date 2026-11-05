import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { AccessModule } from '../access/access.module';
import { PageAccessGuard } from '../auth/page-access.guard';

@Module({
  imports: [AccessModule],
  controllers: [SsoController],
  providers: [SsoService, PageAccessGuard],
  exports: [SsoService],
})
export class SsoModule {}
