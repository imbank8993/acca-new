import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login pengguna (Mirip Supabase Auth)' })
  @ApiResponse({ status: 200, description: 'Login berhasil, mengembalikan JWT token' })
  @ApiResponse({ status: 401, description: 'Email/Username atau password salah' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Pembuatan akun oleh Admin — BUKAN pendaftaran mandiri.
   *
   * Sebelumnya endpoint ini tanpa guard sama sekali, dan `RegisterDto`
   * menerima `role` dari pemanggil (contoh di Swagger-nya bahkan 'admin').
   * Artinya siapa pun yang bisa menjangkau API ini — tidak lewat aplikasi web,
   * yang memang tidak pernah memanggilnya, tapi langsung ke port NestJS —
   * dapat membuat akun ADMIN untuk dirinya sendiri. Tidak ada guard autentikasi
   * global di aplikasi ini yang menahannya.
   *
   * Pendaftaran mandiri yang sah punya jalurnya sendiri: `POST /register/parent`,
   * yang tidak menerima `role` dan diverifikasi dengan NISN + tanggal lahir siswa.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buat akun pengguna baru (khusus Admin)' })
  @ApiResponse({ status: 201, description: 'Akun berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Email atau Username sudah terdaftar' })
  @ApiResponse({ status: 403, description: 'Hanya Admin yang dapat membuat akun' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mendapatkan profil pengguna yang sedang login' })
  @ApiResponse({ status: 200, description: 'Profil pengguna berhasil didapatkan' })
  @ApiResponse({ status: 401, description: 'Token tidak valid atau tidak ditemukan' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Mulai pemulihan password sendiri. TANPA guard — pemakainya justru sedang tidak
   * bisa masuk.
   *
   * Dua lapis pembatasan, dan yang penting adalah lapis kedua.
   *
   * Throttle di sini melihat IP pemanggil — tetapi seluruh permintaan datang lewat
   * server Next.js, jadi IP-nya sama untuk semua pemakai. Batasnya karena itu
   * dipasang longgar: perannya hanya menahan penyalahgunaan borongan langsung ke
   * API, bukan membatasi per orang. Kalau dipasang ketat, satu orang yang meminta
   * tautan beberapa kali akan memblokir semua orang.
   *
   * Pembatasan yang benar-benar menyasar penyalahgunaan ada di
   * `AuthService.forgotPassword`: jeda per AKUN TUJUAN, sehingga satu alamat tidak
   * bisa dikirimi tautan berulang-ulang tanpa mengganggu pemakai lain.
   *
   * Jawabannya selalu seragam supaya endpoint ini tidak bisa dipakai memeriksa
   * alamat mana yang punya akun di sini.
   */
  @Post('forgot-password')
  @Throttle({ default: { limit: 30, ttl: 900000 } })
  @ApiOperation({ summary: 'Kirim tautan atur ulang password ke email terdaftar' })
  async forgotPassword(
    @Request() req: any,
    @Body() body: { email?: string; username?: string; origin?: string },
  ) {
    const origin = this.resolveSafeOrigin(req, body?.origin);
    return this.authService.forgotPassword(body?.email || body?.username || '', origin);
  }

  /**
   * Resolusi origin aman untuk tautan email reset password.
   * Mendukung dinamis lokal (localhost:3000) dan produksi (acca.icgowa.sch.id),
   * namun tetap terlindung dari Host Header Poisoning via allowlist.
   */
  private resolveSafeOrigin(req: any, requestedOrigin?: string): string {
    const rawOrigins = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const configuredPublicUrl = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    const fallback = configuredPublicUrl || 'https://acca.icgowa.sch.id';

    const candidate = (
      requestedOrigin ||
      req.headers?.['x-client-origin'] ||
      req.headers?.['origin'] ||
      req.headers?.['referer'] ||
      ''
    )
      .trim()
      .replace(/\/$/, '');

    if (!candidate) return fallback;

    try {
      const parsed = new URL(candidate);
      const candidateOrigin = parsed.origin.toLowerCase();

      // Izinkan localhost / 127.0.0.1 saat pengujian di lokal
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        candidateOrigin.includes('localhost')
      ) {
        return parsed.origin;
      }

      // Cocokkan dengan CORS_ORIGIN atau domain resmi sekolah
      const isAllowed =
        rawOrigins.some((o) => o.replace(/\/$/, '').toLowerCase() === candidateOrigin) ||
        parsed.hostname === 'acca.icgowa.sch.id' ||
        parsed.hostname.endsWith('.icgowa.sch.id');

      if (isAllowed) {
        return parsed.origin;
      }
    } catch {
      // Format URL tidak valid
    }

    return fallback;
  }

  @Post('verify-recovery-token')
  @Throttle({ default: { limit: 30, ttl: 900000 } })
  @ApiOperation({ summary: 'Periksa keabsahan token reset password sebelum formulir diisi' })
  async verifyRecoveryToken(@Body() body: { token: string }) {
    return this.authService.verifyRecoveryToken(body?.token || '');
  }

  /**
   * Selesaikan pemulihan dengan token dari email. Juga tanpa guard, dan juga
   * dibatasi — token 64 heksadesimal tidak realistis ditebak, tapi batas ini
   * menutup percobaan borongan.
   */
  @Post('reset-password-token')
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Atur password baru memakai token dari email' })
  async resetPasswordDenganToken(@Body() body: { token: string; password: string }) {
    return this.authService.resetPasswordDenganToken(body?.token || '', body?.password || '');
  }

  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset password user oleh Admin (PostgreSQL VPS)' })
  async adminResetPassword(
    @Request() req: any,
    @Body() body: { user_id: string | number; new_password?: string },
  ) {
    return this.authService.adminResetPassword(
      req.user.id,
      body.user_id,
      body.new_password,
    );
  }
}
