import { Module } from '@nestjs/common';
import { NotulensiController } from './notulensi.controller';
import { NotulensiService } from './notulensi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { FeatureAccessGuard } from '../auth/feature-access.guard';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [NotulensiController],
  providers: [NotulensiService, FeatureAccessGuard],
  exports: [NotulensiService],
})
export class NotulensiModule {}
