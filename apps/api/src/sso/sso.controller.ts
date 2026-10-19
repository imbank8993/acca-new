import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SsoService } from './sso.service';

@ApiTags('Single Sign-On (SSO)')
@ApiBearerAuth()
@Controller('sso')
@UseGuards(JwtAuthGuard)
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('wordpress')
  @ApiOperation({
    summary: 'Dapatkan link Single Sign-On (SSO) sekali pakai ke WordPress MAN IC Gowa',
    description:
      'Mengambil data pengguna yang sedang login (email, nama, role) dan memanggil endpoint WordPress SSO generate-link untuk mendapatkan URL login otomatis ke /wp-admin/.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tautan SSO berhasil dibuat.',
    schema: {
      example: {
        success: true,
        sso_url: 'https://icgowa.sch.id/?acca_sso=abcdef123456...',
        expires_in: 60,
        wp_role: 'author',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Sesi tidak valid atau telah berakhir.' })
  @ApiResponse({ status: 403, description: 'Role pengguna tidak diizinkan mengakses WordPress.' })
  async getWordPressSso(@Req() req: any) {
    return this.ssoService.getWordPressSsoLink(req.user);
  }
}
