import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Pengiriman email keluar, lewat Resend.
 *
 * Sebelum ini tidak ada pengirim email sama sekali di kedua aplikasi —
 * `NotificationsService` hanya menulis ke tabel `notifications` (notifikasi di
 * dalam aplikasi). Karena itu pesan di `UsersService.registerParent` yang
 * menyuruh pemakai memakai "Lupa Password" menunjuk fitur yang belum ada.
 *
 * Disengaja TIDAK melempar saat konfigurasinya kosong: pengiriman email bukan
 * inti aplikasi, dan gagalnya tidak boleh menjatuhkan permintaan yang memicunya.
 * Pemanggil menerima `{ terkirim: false, alasan }` dan memutuskan sendiri.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: Resend | null = null;

  private ambilApiKey(): string {
    let apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      try {
        const fs = require('fs');
        const path = require('path');
        const envPaths = [
          path.resolve(process.cwd(), '.env'),
          path.resolve(process.cwd(), 'apps/api/.env'),
          path.resolve(__dirname, '../../../.env'),
          path.resolve(__dirname, '../../.env'),
        ];
        for (const p of envPaths) {
          if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf-8');
            const m = content.match(/^RESEND_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
            if (m && m[1]) {
              apiKey = m[1].trim();
              process.env.RESEND_API_KEY = apiKey;
              break;
            }
          }
        }
      } catch {}
    }
    return apiKey || '';
  }

  private get pengirim(): string {
    let from = process.env.RESEND_FROM;
    if (!from) {
      try {
        const fs = require('fs');
        const path = require('path');
        const envPaths = [
          path.resolve(process.cwd(), '.env'),
          path.resolve(process.cwd(), 'apps/api/.env'),
          path.resolve(__dirname, '../../../.env'),
          path.resolve(__dirname, '../../.env'),
        ];
        for (const p of envPaths) {
          if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf-8');
            const m = content.match(/^RESEND_FROM\s*=\s*["']?([^"'\r\n]+)["']?/m);
            if (m && m[1]) {
              from = m[1].trim();
              process.env.RESEND_FROM = from;
              break;
            }
          }
        }
      } catch {}
    }
    return from || 'ACCA MAN Insan Cendekia Gowa <onboarding@resend.dev>';
  }

  private ambilClient(): Resend | null {
    const apiKey = this.ambilApiKey();
    if (!apiKey) return null;
    if (!this.client) this.client = new Resend(apiKey);
    return this.client;
  }

  /** Apakah pengiriman email siap dipakai? Dipakai layar untuk menyesuaikan pesan. */
  get aktif(): boolean {
    return !!this.ambilApiKey();
  }

  async kirim(opsi: {
    ke: string;
    subjek: string;
    html: string;
    teks?: string;
  }): Promise<{ terkirim: boolean; alasan?: string }> {
    const client = this.ambilClient();
    if (!client) {
      this.logger.warn(
        `RESEND_API_KEY belum diset — email "${opsi.subjek}" tidak dikirim ke ${opsi.ke}`,
      );
      return { terkirim: false, alasan: 'Pengiriman email belum dikonfigurasi' };
    }

    try {
      const { error } = await client.emails.send({
        from: this.pengirim,
        to: opsi.ke,
        subject: opsi.subjek,
        html: opsi.html,
        ...(opsi.teks ? { text: opsi.teks } : {}),
      });

      if (error) {
        this.logger.error(`Resend menolak email ke ${opsi.ke}: ${error.message}`);
        return { terkirim: false, alasan: error.message || 'Email gagal dikirim oleh penyedia email' };
      }

      return { terkirim: true };
    } catch (e) {
      const errMsg = (e as Error).message || 'Terjadi kesalahan sistem pengiriman email';
      this.logger.error(`Gagal mengirim email ke ${opsi.ke}: ${errMsg}`);
      return { terkirim: false, alasan: errMsg };
    }
  }
}
