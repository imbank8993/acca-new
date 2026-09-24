import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil notifikasi aktif sesuai role user' })
  async getNotifications(@Req() req: any) {
    const rolesStr = Array.isArray(req.user?.roles) ? req.user.roles.join(',') : String(req.user?.role || '');
    const userIdStr = String(req.user?.auth_id || req.user?.id || '');
    return this.service.getNotifications(rolesStr, userIdStr);
  }

  @Post()
  @ApiOperation({ summary: 'Buat notifikasi baru' })
  async createNotification(@Body() body: any, @Req() req: any) {
    return this.service.createNotification(body, req.user);
  }
}
