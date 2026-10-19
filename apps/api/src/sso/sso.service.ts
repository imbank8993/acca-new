import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WordPressSsoResponse {
  success: boolean;
  sso_url: string;
  expires_in?: number;
  wp_role?: string;
  message?: string;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  // Role yang diizinkan untuk SSO WordPress
  private readonly allowedRoles = [
    'superadmin',
    'admin',
    'humas',
    'editor',
    'guru',
    'pembina',
    'staf',
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Resolusi role ACCA pengguna ke role yang diizinkan oleh endpoint SSO WordPress.
   */
  resolveWordPressRole(user: any): string {
    const rawRoles: string[] = [
      ...(Array.isArray(user?.roles) ? user.roles : []),
      ...(typeof user?.role === 'string' ? user.role.split(/[,|]/) : []),
    ]
      .map((r) => String(r).trim().toLowerCase())
      .filter(Boolean);

    // Role siswa secara eksplisit ditolak
    if (rawRoles.includes('siswa') && !rawRoles.some((r) => this.allowedRoles.includes(r))) {
      throw new ForbiddenException('Role siswa tidak diizinkan untuk mengakses Single Sign-On WordPress.');
    }

    // Urutan prioritas role saat dikirim ke WordPress
    if (rawRoles.includes('superadmin')) return 'superadmin';
    if (rawRoles.includes('admin') || rawRoles.includes('administrator')) return 'admin';
    if (rawRoles.includes('humas')) return 'humas';
    if (rawRoles.includes('editor')) return 'editor';
    if (rawRoles.includes('pembina')) return 'pembina';
    if (rawRoles.includes('staf') || rawRoles.includes('staff')) return 'staf';
    if (rawRoles.includes('guru')) return 'guru';

    throw new ForbiddenException(
      'Role akun Anda tidak memiliki izin untuk mengakses Single Sign-On WordPress.',
    );
  }

  /**
   * Request link login SSO sekali pakai ke WordPress REST API.
   */
  async getWordPressSsoLink(user: any): Promise<WordPressSsoResponse> {
    if (!user) {
      throw new BadRequestException('Data user sesi tidak ditemukan.');
    }

    const email = (user.email || '').trim();
    if (!email) {
      throw new BadRequestException(
        'Email pengguna tidak ditemukan di ACCA. Silakan atur email di profil Anda terlebih dahulu.',
      );
    }

    const name = (
      user.nama_lengkap ||
      user.nama ||
      user.name ||
      user.username ||
      email.split('@')[0]
    ).trim();

    const role = this.resolveWordPressRole(user);

    const wpEndpoint =
      this.configService.get<string>('WP_SSO_URL') ||
      'https://icgowa.sch.id/wp-json/acca/v1/sso/generate-link';
    const wpSecret =
      this.configService.get<string>('WP_SSO_SECRET') ||
      'acca_sec_d83e20f49a15bc72901e4a68bf23dc58';
    const redirectTo =
      this.configService.get<string>('WP_SSO_REDIRECT_TO') ||
      'https://icgowa.sch.id/wp-admin/';

    const payload = {
      email,
      name,
      role,
      redirect_to: redirectTo,
    };

    this.logger.log(`Requesting WordPress SSO link for ${email} with role '${role}'`);

    try {
      const response = await fetch(wpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ACCA-Secret': wpSecret,
          'User-Agent': 'ACCA-Portal/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      const data = (await response.json().catch(() => null)) as WordPressSsoResponse | null;

      if (!response.ok || !data?.success) {
        const errorMsg =
          data?.message ||
          (response.status === 403
            ? 'Akses ditolak oleh WordPress. Role Anda tidak diizinkan.'
            : response.status === 404
            ? 'Endpoint SSO WordPress tidak ditemukan di server tujuan (404).'
            : `Gagal menghasilkan link SSO WordPress (HTTP ${response.status}).`);

        this.logger.warn(`WordPress SSO failed (${response.status}): ${JSON.stringify(data || errorMsg)}`);

        if (response.status === 403) {
          throw new ForbiddenException(errorMsg);
        }
        throw new BadRequestException(errorMsg);
      }

      this.logger.log(`WordPress SSO link generated successfully for ${email}`);
      return data;
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`WordPress SSO connection error: ${err?.message || err}`);
      throw new BadGatewayException(
        'Gagal terhubung ke endpoint WordPress MAN Insan Cendekia Gowa. Pastikan server WordPress aktif.',
      );
    }
  }
}
