import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { JadwalModule } from '../jadwal/jadwal.module';

@Module({
  imports: [PrismaModule, AccessModule, JadwalModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
