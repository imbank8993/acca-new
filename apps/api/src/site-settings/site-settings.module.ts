import { Module } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';
import { SiteSettingsController } from './site-settings.controller';
import { MenuLayoutService } from './menu-layout.service';
import { PagesService } from './pages.service';
import { AccessModule } from '../access/access.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AccessModule, PrismaModule],
  providers: [SiteSettingsService, MenuLayoutService, PagesService],
  controllers: [SiteSettingsController]
})
export class SiteSettingsModule {}
