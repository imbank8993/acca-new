import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatatanPribadiService } from './catatan-pribadi.service';

@ApiTags('Catatan Pribadi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catatan-pribadi')
export class CatatanPribadiController {
  constructor(private readonly service: CatatanPribadiService) {}

  private getUserId(req: any): bigint {
    if (!req.user || req.user.id === undefined || req.user.id === null) {
      throw new UnauthorizedException('Pengguna tidak terautentikasi');
    }
    return BigInt(req.user.id);
  }

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const result = await this.service.findAll(this.getUserId(req), query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('kalender')
  async getKalender(@Req() req: any, @Query('bulan') bulan: string) {
    const data = await this.service.getKalender(this.getUserId(req), bulan);
    return {
      success: true,
      data,
    };
  }

  @Get('labels')
  async getLabels(@Req() req: any) {
    const data = await this.service.getLabels(this.getUserId(req));
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const data = await this.service.findOne(this.getUserId(req), id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const data = await this.service.create(this.getUserId(req), body);
    return {
      success: true,
      data,
    };
  }

  @Post('export-data')
  async exportData(@Req() req: any, @Body() body: any) {
    const data = await this.service.exportData(this.getUserId(req), body);
    return {
      success: true,
      data,
    };
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.service.update(this.getUserId(req), id, body);
    return {
      success: true,
      data,
    };
  }

  @Put(':id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.service.updateStatus(this.getUserId(req), id, body);
    return {
      success: true,
      data,
    };
  }

  @Put(':id/restore')
  async restore(@Req() req: any, @Param('id') id: string) {
    const data = await this.service.restore(this.getUserId(req), id);
    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.remove(this.getUserId(req), id);
    return {
      success: true,
      ...result,
    };
  }
}
