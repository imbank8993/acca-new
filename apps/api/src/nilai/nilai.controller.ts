import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NilaiService } from './nilai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PegawaiGuard } from '../auth/pegawai.guard';

@Controller('nilai')
@UseGuards(JwtAuthGuard)
export class NilaiController {
  constructor(private readonly nilaiService: NilaiService) {}

  @Get()
  @UseGuards(PegawaiGuard)
  async getNilai(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getNilai(req.user, query);
  }

  @Post()
  @UseGuards(PegawaiGuard)
  async saveNilai(@Req() req: any, @Body() body: any) {
    return this.nilaiService.saveNilai(req.user, body);
  }

  @Get('admin')
  @UseGuards(PegawaiGuard)
  async getAdminNilai(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getAdminNilai(req.user, query);
  }

  @Patch('admin')
  @UseGuards(PegawaiGuard)
  async updateAdminNilai(@Req() req: any, @Body() body: any) {
    return this.nilaiService.updateAdminNilai(req.user, body);
  }

  @Delete('admin/:id')
  @UseGuards(PegawaiGuard)
  async deleteAdminNilai(@Req() req: any, @Param('id') id: string) {
    return this.nilaiService.deleteAdminNilai(req.user, id);
  }

  @Post('admin/transfer')
  @UseGuards(PegawaiGuard)
  async transferGuruNilai(@Req() req: any, @Body() body: any) {
    return this.nilaiService.transferGuruNilai(req.user, body);
  }

  @Get('filters')
  @UseGuards(PegawaiGuard)
  async getFilters(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getFilters(req.user, query);
  }

  @Get('guru-list')
  @UseGuards(PegawaiGuard)
  async getGuruList(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getGuruList(req.user, query);
  }

  @Post('bobot')
  @UseGuards(PegawaiGuard)
  async saveBobot(@Req() req: any, @Body() body: any) {
    return this.nilaiService.saveBobot(req.user, body);
  }

  @Get('siswa/photos')
  async getSiswaPhotos() {
    return this.nilaiService.getSiswaPhotos();
  }

  @Get('siswa')
  async getSiswaNilai(@Req() req: any, @Query('nisn') nisn: string, @Query() query: any) {
    return this.nilaiService.getSiswaNilai(req.user, nisn, query);
  }

  @Get('siswa/apresiasi')
  async getSiswaApresiasi(@Req() req: any, @Query('nisn') nisn: string, @Query() query: any) {
    return this.nilaiService.getSiswaApresiasi(req.user, nisn, query);
  }

  @Get('siswa/students')
  @UseGuards(PegawaiGuard)
  async getSiswaStudents(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getSiswaStudents(query, req.user);
  }

  @Get('tagihan')
  @UseGuards(PegawaiGuard)
  async getTagihan(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getTagihan(req.user, query);
  }

  @Post('tagihan')
  @UseGuards(PegawaiGuard)
  async saveTagihan(@Req() req: any, @Body() body: any) {
    return this.nilaiService.saveTagihan(req.user, body);
  }

  @Delete('tagihan/:id')
  @UseGuards(PegawaiGuard)
  async deleteTagihan(@Req() req: any, @Param('id') id: string) {
    return this.nilaiService.deleteTagihan(req.user, id);
  }

  @Get('apresiasi')
  @UseGuards(PegawaiGuard)
  async getApresiasi(@Req() req: any, @Query() query: any) {
    return this.nilaiService.getApresiasi(req.user, query);
  }

  @Post('apresiasi')
  @UseGuards(PegawaiGuard)
  async saveApresiasi(@Req() req: any, @Body() body: any) {
    return this.nilaiService.saveApresiasi(req.user, body);
  }

  @Delete('apresiasi/:id')
  @UseGuards(PegawaiGuard)
  async deleteApresiasi(@Req() req: any, @Param('id') id: string) {
    return this.nilaiService.deleteApresiasi(req.user, id);
  }
}
