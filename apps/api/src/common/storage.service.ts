import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { r2PutObject, r2DeleteObject, type R2Config } from './r2.client';

export type StorageDriver = 'supabase' | 'r2';

/**
 * Penyimpanan berkas untuk modul NestJS (foto agenda, informasi, e-supervisi).
 *
 * SATU-SATUNYA tujuan penyimpanan adalah Cloudflare R2. Supabase Storage sudah
 * tidak dipakai: tidak mengunggah, dan tidak menghapus.
 *
 * Sebelumnya `STORAGE_DRIVER` bisa memilih 'supabase' atau 'r2', dan yang lebih
 * berbahaya, nilai bawaannya adalah 'supabase' — deployment yang lupa mengisi
 * env itu diam-diam menulis berkas ke Supabase. Pilihan itu dihapus seluruhnya.
 *
 * Berkas LAMA di Supabase dibiarkan pada tempatnya:
 *   - MEMBACA tidak terpengaruh. URL absolutnya tersimpan di database dan URL
 *     publik Supabase tidak butuh kode apa pun dari sisi kita.
 *   - MENGHAPUS tidak dilakukan aplikasi. `removeByUrl` mengenali URL Supabase
 *     dan melewatinya dengan peringatan di log; berkas fisiknya dibersihkan
 *     manual dari dashboard Supabase.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  /** Selalu 'r2'. Dipertahankan sebagai properti agar `activeDriver` tetap ada. */
  private readonly driver: StorageDriver = 'r2';

  private readonly r2: R2Config;
  private readonly r2PublicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.r2 = {
      accountId: (this.configService.get<string>('R2_ACCOUNT_ID') || '').trim(),
      accessKeyId: (this.configService.get<string>('R2_ACCESS_KEY_ID') || '').trim(),
      secretAccessKey: (this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '').trim(),
      bucket: (this.configService.get<string>('R2_BUCKET') || '').trim(),
    };
    this.r2PublicBaseUrl = (this.configService.get<string>('R2_PUBLIC_BASE_URL') || '')
      .trim()
      .replace(/\/$/, '');

    const kurang = Object.entries(this.r2)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (kurang.length > 0 || !this.r2PublicBaseUrl) {
      // Gagal keras di log saat boot, bukan diam-diam saat user pertama upload.
      // Tidak ada lagi jalur cadangan ke Supabase kalau env R2 belum lengkap.
      this.logger.error(
        `Env Cloudflare R2 belum lengkap: ${[...kurang, ...(this.r2PublicBaseUrl ? [] : ['R2_PUBLIC_BASE_URL'])].join(', ')}`,
      );
    } else {
      this.logger.log(`Storage driver: Cloudflare R2 (bucket ${this.r2.bucket})`);
    }
  }

  get activeDriver(): StorageDriver {
    return this.driver;
  }

  private r2Siap(): boolean {
    return Boolean(
      this.r2.accountId &&
        this.r2.accessKeyId &&
        this.r2.secretAccessKey &&
        this.r2.bucket &&
        this.r2PublicBaseUrl,
    );
  }

  /**
   * Nama `bucket` logis pemanggil (mis. 'documents', 'informasi_akademik')
   * dipertahankan sebagai prefix key di R2, yang hanya punya satu bucket fisik.
   * Dengan begitu tata letaknya tetap sama — `documents/agenda/12/foto.jpg` —
   * dan berkas antar-modul tidak bisa saling menimpa.
   */
  private r2Key(bucket: string, path: string): string {
    return `${bucket}/${path}`.replace(/\/{2,}/g, '/').replace(/^\//, '');
  }

  async upload(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
    upsert = false,
  ): Promise<{ error: any }> {
    // `upsert` dipertahankan di tanda tangan agar pemanggil tidak perlu diubah;
    // r2PutObject memang selalu menimpa key yang sama.
    void upsert;
    if (!this.r2Siap()) {
      return { error: new Error('Kredensial Cloudflare R2 belum lengkap di .env') };
    }
    return r2PutObject(this.r2, this.r2Key(bucket, path), buffer, contentType);
  }

  getPublicUrl(bucket: string, path: string): { data: { publicUrl: string } } {
    // Segmen di-encode supaya nama berkas berspasi tetap jadi URL yang sah.
    const key = this.r2Key(bucket, path)
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    return { data: { publicUrl: `${this.r2PublicBaseUrl}/${key}` } };
  }

  async remove(bucket: string, paths: string[]): Promise<{ error: any }> {
    if (!this.r2Siap()) {
      return { error: new Error('Kredensial Cloudflare R2 belum lengkap di .env') };
    }
    for (const p of paths) {
      const { error } = await r2DeleteObject(this.r2, this.r2Key(bucket, p));
      if (error) return { error };
    }
    return { error: null };
  }

  /**
   * Pecah URL publik menjadi provider + lokasinya.
   *
   * Dulu tiap pemanggil memotong URL sendiri dengan pola khas Supabase
   * (`.split('/documents/')`, regex `storage/v1/object/public/...`). Pola itu
   * tidak cocok dengan URL R2, jadi setelah driver diganti penghapusan akan
   * gagal tanpa suara dan menyisakan berkas yatim.
   */
  private resolveUrl(
    url: string,
  ): { driver: 'supabase' | 'r2' | 'google_drive' | 'hosting'; bucket: string; path: string } | null {
    if (!url) return null;

    // Supabase: <host>/storage/v1/object/public/<bucket>/<path>
    const cocokSupabase = url.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/(.+)$/);
    if (cocokSupabase) {
      return {
        driver: 'supabase',
        bucket: decodeURIComponent(cocokSupabase[1]),
        path: decodeURIComponent(cocokSupabase[2].split('?')[0]),
      };
    }

    // Google Drive: drive.google.com / docs.google.com
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      return { driver: 'google_drive', bucket: '', path: '' };
    }

    // Server hosting PHP / legacy upload path
    if (url.includes('acca_handler.php') || url.includes('/uploads/')) {
      return { driver: 'hosting', bucket: '', path: '' };
    }

    // R2: <base publik>/<key>. Basis publik bisa berganti (r2.dev → Worker →
    // domain kustom), jadi host lama tetap dikenali selain yang di .env.
    let host: string;
    let pathname: string;
    try {
      const parsed = new URL(url);
      host = parsed.host;
      pathname = parsed.pathname;
    } catch {
      return null;
    }

    const basisAktif = this.r2PublicBaseUrl ? new URL(this.r2PublicBaseUrl).host : '';
    const miripR2 =
      (basisAktif && host === basisAktif) ||
      host.endsWith('.r2.dev') ||
      host.endsWith('.r2.cloudflarestorage.com') ||
      host.endsWith('.workers.dev');

    if (!miripR2) return null;

    const key = decodeURIComponent(pathname.replace(/^\//, '').split('?')[0]);
    if (!key) return null;

    // `r2Key` menempelkan bucket logis sebagai segmen pertama; dikembalikan
    // apa adanya lewat `bucket: ''` supaya `removeByUrl` tidak menempelkannya dua kali.
    return { driver: 'r2', bucket: '', path: key };
  }

  /**
   * Hapus berkas berdasarkan URL publiknya.
   *
   * Berkas R2 dihapus sungguhan. Berkas lama di Supabase, Google Drive, dan Server Hosting dilewati:
   * aplikasi tidak lagi menyentuh penyedia-penyedia tersebut.
   * Berkas fisiknya ditinggal untuk dibersihkan manual jika diperlukan.
   * Dikembalikan TANPA error supaya pemanggil melanjutkan penghapusan barisnya tanpa kegagalan palsu.
   */
  async removeByUrl(url: string): Promise<{ error: any }> {
    if (!url) return { error: null };

    // Percobaan hapus file lokal jika tersimpan di disk server (/uploads/...)
    try {
      if (url.includes('/uploads/')) {
        const relPath = '/uploads/' + url.split('/uploads/')[1].split('?')[0];
        const candidatePaths = [
          path.join(process.cwd(), relPath),
          path.join(process.cwd(), 'public', relPath),
          path.join(process.cwd(), '..', 'web', 'public', relPath),
          path.join(process.cwd(), 'apps', 'web', 'public', relPath),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            fs.unlinkSync(p);
            this.logger.log(`Berkas lokal berhasil dihapus dari disk: ${p}`);
            break;
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Gagal menghapus berkas lokal dari disk: ${err.message}`);
    }

    const lokasi = this.resolveUrl(url);
    if (!lokasi) {
      this.logger.warn(`Bentuk URL penyimpanan bukan Cloudflare R2 (dilewati dari penghapusan fisik): ${url}`);
      return { error: null };
    }

    if (lokasi.driver === 'supabase' || lokasi.driver === 'google_drive' || lokasi.driver === 'hosting') {
      this.logger.warn(
        `Berkas ${lokasi.driver} TIDAK dihapus (dilewati, perlu dibersihkan manual jika diperlukan): ${url}`,
      );
      return { error: null };
    }

    if (!this.r2Siap()) {
      return { error: new Error('Kredensial Cloudflare R2 belum lengkap di .env') };
    }
    return r2DeleteObject(this.r2, lokasi.path);
  }

  from(bucket: string) {
    return {
      upload: (path: string, buffer: Buffer, options?: { contentType?: string; upsert?: boolean }) =>
        this.upload(bucket, path, buffer, options?.contentType || 'application/octet-stream', options?.upsert),
      getPublicUrl: (path: string) => this.getPublicUrl(bucket, path),
      remove: (paths: string[]) => this.remove(bucket, paths),
    };
  }
}
