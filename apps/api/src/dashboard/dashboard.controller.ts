import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Req() req: any) {
    const data = await this.dashboardService.getDashboardSummary(req.user);
    return { ok: true, data };
  }

  @Get('stats')
  async getStats() {
    const data = await this.dashboardService.getDashboardStats();
    return { ok: true, data };
  }

  @Get('charts')
  async getCharts() {
    const data = await this.dashboardService.getDashboardCharts();
    return { ok: true, data };
  }
}
