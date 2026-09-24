import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { FeatureAccessGuard } from '../auth/feature-access.guard';
import { LiburController } from './libur.controller';
import { LiburService } from './libur.service';

@Module({
  // AccessModule & FeatureAccessGuard dibutuhkan controller untuk menegakkan izin tulis
  // (lihat `assertCanWrite` di libur.controller.ts).
  imports: [AuthModule, AccessModule],
  controllers: [LiburController],
  providers: [LiburService, FeatureAccessGuard],
  exports: [LiburService],
})
export class LiburModule {}
