import { Module } from '@nestjs/common';
import { DokumenController } from './dokumen.controller';
import { DokumenService } from './dokumen.service';
import { FeatureAccessGuard } from '../auth/feature-access.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../common/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [DokumenController],
  providers: [DokumenService, StorageService, FeatureAccessGuard],
})
export class DokumenModule {}
