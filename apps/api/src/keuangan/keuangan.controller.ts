import { Controller, Get, Post, Put, Delete, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { KeuanganService } from './keuangan.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';

@Controller('keuangan')
@UseGuards(JwtAuthGuard)
export class KeuanganController {
  constructor(private readonly keuanganService: KeuanganService) {}

  @Get('catatan-keuangan')
  @UseGuards(PageAccessGuard)
  @RequiresPage('catatan-keuangan')
  async getCatatanKeuangan(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.getCatatanKeuangan(req, res);
  }

  @Post('catatan-keuangan')
  @UseGuards(PageAccessGuard)
  @RequiresPage('catatan-keuangan')
  async postCatatanKeuangan(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.postCatatanKeuangan(req, res);
  }

  @Put('catatan-keuangan')
  @UseGuards(PageAccessGuard)
  @RequiresPage('catatan-keuangan')
  async putCatatanKeuangan(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.putCatatanKeuangan(req, res);
  }

  @Delete('catatan-keuangan')
  @UseGuards(PageAccessGuard)
  @RequiresPage('catatan-keuangan')
  async deleteCatatanKeuangan(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.deleteCatatanKeuangan(req, res);
  }

  @Get('tarif-honor')
  async getTarifHonor(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.getTarifHonor(req, res);
  }

  @Put('tarif-honor')
  async putTarifHonor(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.putTarifHonor(req, res);
  }

  @Get('utama')
  @UseGuards(PageAccessGuard)
  @RequiresPage('keuangan')
  async getKeuangan(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.getKeuangan(req, res);
  }

  @Post('utama')
  @UseGuards(PageAccessGuard)
  @RequiresPage('keuangan')
  async postKeuangan(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.postKeuangan(req, res);
  }

  @Get()
  @UseGuards(PageAccessGuard)
  @RequiresPage('keuangan')
  async getKeuanganRoot(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.getKeuangan(req, res);
  }

  @Post()
  @UseGuards(PageAccessGuard)
  @RequiresPage('keuangan')
  async postKeuanganRoot(@Req() req: Request, @Res() res: Response) {
    return this.keuanganService.postKeuangan(req, res);
  }
}
