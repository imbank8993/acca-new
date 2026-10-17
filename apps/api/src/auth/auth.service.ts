import { lockAccountWrites, revokeSessions, sessionVersion } from './session-security';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessService } from '../access/access.service';
import { EmailService } from '../common/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => AccessService))
    private accessService: AccessService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto) {
    const { usernameOrEmail, password } = loginDto;
    const rawIdentifier = (usernameOrEmail || '').trim();
    const cleanIdentifier = rawIdentifier.toLowerCase();

    // 1. Search user by email, username, or nip in public_users table (case-insensitive)
    let user = await this.prismaService.public_users.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { username: { equals: rawIdentifier, mode: 'insensitive' } },
          { nip: { equals: rawIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    // 2. Fallback: jika tidak ditemukan di public_users, cari di auth_users (misal user dibuat tanpa email di public_users atau email cerminan)
    if (!user) {
      const authUser = await this.prismaService.auth_users.findFirst({
        where: {
          email: { equals: cleanIdentifier, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (authUser?.id) {
        user = await this.prismaService.public_users.findFirst({
          where: { auth_id: authUser.id },
        });
      }
    }

    if (!user) {
      this.logger.warn(`Login gagal: Pengguna '${cleanIdentifier}' tidak ditemukan`);
      throw new UnauthorizedException('Email/Username atau password salah');
    }

    if (!(user.aktif === true)) {
      this.logger.warn(`Login gagal: Akun '${user.username || user.email}' status non-aktif`);
      throw new UnauthorizedException('Akun tidak aktif');
    }

    /**
     * Satu-satunya tempat kredensial: `auth_users.encrypted_password` (bcrypt).
     */
    let isValidPassword = false;
    let verifiedSessionVersion = '';

    if (user.auth_id) {
      const authUser = await this.prismaService.auth_users.findUnique({
        where: { id: user.auth_id },
        select: { encrypted_password: true, raw_app_meta_data: true },
      });

      if (authUser?.encrypted_password) {
        verifiedSessionVersion = sessionVersion(authUser.raw_app_meta_data);
        isValidPassword = await bcrypt.compare(
          password,
          authUser.encrypted_password,
        );
      }
    } else {
      throw new UnauthorizedException('Akun belum memiliki kredensial. Hubungi Admin untuk mengaktifkan akses login.');
    }

    if (!isValidPassword) {
      this.logger.warn(`Login gagal: Password salah untuk akun '${user.username || user.email}'`);
      throw new UnauthorizedException('Email/Username atau password salah');
    }

    const userIdStr = user.id.toString();

    // Resolve user access pageIds for JWT payload (Edge optimization)
    let pageIds: string[] | undefined = undefined;
    try {
      const access = await this.accessService.resolveUserAccess(user);
      pageIds = access?.pageIds;
    } catch (err) {
      this.logger.warn(`Gagal resolveUserAccess saat login: ${(err as Error).message}`);
    }

    // Generate JWT token
    const payload = {
      sub: userIdStr,
      authId: user.auth_id,
      sessionVersion: verifiedSessionVersion,
      email: user.email,
      username: user.username,
      role: user.role,
      ...(pageIds ? { pageIds } : {}),
    };

    const token = this.jwtService.sign(payload);

    // Ditandai saat admin mereset password. Klien memakainya untuk memaksa
    // penggantian sebelum akunnya dipakai, supaya password sementara benar-benar
    // sementara — tanpa ini ia bisa bertahan berbulan-bulan.
    const harusGantiPassword = await this.perluGantiPassword(user.auth_id);

    return {
      access_token: token,
      token_type: 'Bearer',
      must_change_password: harusGantiPassword,
      user: {
        id: userIdStr,
        email: user.email,
        username: user.username,
        name: user.nama_lengkap || user.nama || user.username,
        role: user.role,
        status: user.aktif ? 'aktif' : 'non-aktif',
        must_change_password: harusGantiPassword,
      },
    };
  }

  /** Apakah akun ini ditandai wajib mengganti password? */
  async perluGantiPassword(authId?: string | null): Promise<boolean> {
    if (!authId) return false;
    const row = await this.prismaService.auth_users.findUnique({
      where: { id: authId },
      select: { raw_user_meta_data: true },
    });
    const meta = row?.raw_user_meta_data;
    if (!meta || typeof meta !== 'object') return false;
    return (meta as Record<string, unknown>).must_change_password === true;
  }

  async register(registerDto: RegisterDto) {
    return this.prismaService.$transaction(async tx => {
      await lockAccountWrites(tx);

      const { email, username, name, password, role } = registerDto;

      // Check if email or username exists
      const existingUser = await tx.public_users.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() },
          ],
        },
      });

      if (existingUser) {
        throw new BadRequestException('Email atau Username sudah terdaftar');
      }

      /**
       * Kredensial ditulis ke `auth_users.encrypted_password` — tempat yang sama
       * yang diperiksa saat login. Sebelumnya disimpan di
       * `public_users.password_hash` sementara akun barunya tidak pernah diberi
       * `auth_id`; itu hanya berfungsi selama login masih punya cabang cadangan
       * ke kolom tersebut. Cabang itu sudah dicabut dan kolomnya sedang dihapus,
       * jadi tanpa perubahan ini akun hasil registrasi tidak akan bisa login.
       */
      const hashedPassword = await bcrypt.hash(password, 10);
      const authId = crypto.randomUUID();

      await tx.auth_users.create({
        data: {
          id: authId,
          email: email.toLowerCase(),
          encrypted_password: hashedPassword,
          aud: 'authenticated',
          role: 'authenticated',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create user in PostgreSQL VPS
      const newUser = await tx.public_users.create({
        data: {
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          nama: name,
          nama_lengkap: name,
          auth_id: authId,
          role: role || 'user',
          aktif: true,
        },
      });

      const newUserIdStr = newUser.id.toString();

      let pageIds: string[] | undefined = undefined;
      try {
        const access = await this.accessService.resolveUserAccess(newUser);
        pageIds = access?.pageIds;
      } catch (err) {
        this.logger.warn(`Gagal resolveUserAccess saat register: ${(err as Error).message}`);
      }

      // Generate JWT token
      const payload = {
        sub: newUserIdStr,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        ...(pageIds ? { pageIds } : {}),
      };

      const token = this.jwtService.sign(payload);

      return {
        message: 'Registrasi berhasil',
        access_token: token,
        user: {
          id: newUserIdStr,
          email: newUser.email,
          username: newUser.username,
          name: newUser.nama_lengkap || newUser.nama,
          role: newUser.role,
        },
      };

    }, { maxWait: 10000, timeout: 20000 });
  }

  async getProfile(userId: string) {
    const user = await this.prismaService.public_users.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    return {
      id: user.id.toString(),
      authId: user.auth_id,
      email: user.email,
      username: user.username,
      name: user.nama_lengkap || user.nama,
      role: user.role,
      status: user.aktif ? 'aktif' : 'non-aktif',
      createdAt: user.created_at,
    };
  }

  // ── Lupa password (mandiri, lewat email) ─────────────────────────────────

  /** Masa berlaku tautan reset. Sengaja singkat: tautannya dikirim lewat email. */
  private static readonly MENIT_BERLAKU_TOKEN = 60;

  /** Jeda minimum antar-pengiriman tautan ke SATU akun yang sama. */
  private static readonly DETIK_JEDA_KIRIM = 120;

  /**
   * Token disimpan sebagai HASH, bukan apa adanya.
   *
   * `auth_users.recovery_token` bisa terbaca siapa pun yang bisa membaca basis
   * data — cadangan, dump, atau kueri lewat celah lain. Kalau isinya token mentah,
   * satu pembacaan cukup untuk mengambil alih akun mana pun yang sedang meminta
   * reset. Yang dikirim lewat email adalah nilai mentahnya; yang tersimpan hanya
   * turunannya, jadi isi tabel tidak bisa dipakai ulang.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Mulai pemulihan password.
   *
   * SELALU mengembalikan jawaban yang sama, apa pun hasilnya. Membedakan "email
   * tidak terdaftar" dari "tautan terkirim" akan menjadikan endpoint publik ini
   * alat untuk memeriksa alamat mana yang punya akun di sini.
   */
  async forgotPassword(emailAtauUsername: string, originAplikasi: string) {
    const jawabanSeragam = {
      ok: true,
      message:
        'Kalau akun dengan data itu ada dan punya alamat email terdaftar, tautan ' +
        'untuk mengatur password baru sudah dikirim. Periksa juga folder spam.',
    };

    const masukan = String(emailAtauUsername ?? '').trim();
    if (!masukan) return jawabanSeragam;

    const user = await this.prismaService.public_users.findFirst({
      where: {
        aktif: true,
        OR: [
          { email: { equals: masukan, mode: 'insensitive' } },
          { username: { equals: masukan, mode: 'insensitive' } },
        ],
      },
      select: { id: true, auth_id: true, email: true, nama: true, nama_lengkap: true, username: true },
    });

    const email = String(user?.email ?? '').trim();
    // Alamat `@acca.local` dibuat otomatis saat akun dibuat tanpa email; itu bukan
    // kotak surat yang bisa dikirimi apa pun.
    const emailNyata = !!email && !email.toLowerCase().endsWith('@acca.local');

    if (!user || !user.auth_id || !emailNyata) {
      this.logger.warn(`forgotPassword: tidak ada tujuan yang sah untuk "${masukan}"`);
      return jawabanSeragam;
    }

    // Jeda antar-pengiriman ke SATU akun, bukan per IP.
    //
    // Throttle di controller melihat IP pemanggil, dan seluruh permintaan datang
    // lewat server Next.js — jadi IP-nya selalu sama untuk semua pemakai, dan batas
    // per-IP akan memblokir semua orang begitu satu orang memakainya. Pembatasan
    // yang benar-benar menyasar penyalahgunaan di sini adalah per akun tujuan:
    // menahan pengiriman berulang ke alamat yang sama, tanpa mengganggu orang lain.
    if (user.auth_id) {
      const sebelumnya = await this.prismaService.auth_users.findUnique({
        where: { id: user.auth_id },
        select: { recovery_sent_at: true },
      });
      const detikSejakTerakhir = sebelumnya?.recovery_sent_at
        ? (Date.now() - sebelumnya.recovery_sent_at.getTime()) / 1000
        : Infinity;
      if (detikSejakTerakhir < AuthService.DETIK_JEDA_KIRIM) {
        this.logger.warn(`forgotPassword: permintaan berulang terlalu cepat untuk "${masukan}"`);
        return jawabanSeragam;
      }
    }

    if (!this.emailService.aktif) {
      this.logger.warn('forgotPassword: RESEND_API_KEY belum diset. Layanan email tidak aktif.');
      return {
        ok: false,
        error: 'Layanan email belum dikonfigurasi di server (RESEND_API_KEY belum diatur di .env). Silakan hubungi Administrator.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.prismaService.auth_users.update({
      where: { id: user.auth_id },
      data: {
        recovery_token: this.hashToken(token),
        recovery_sent_at: new Date(),
        updated_at: new Date(),
      },
    });

    const tautan = `${originAplikasi.replace(/\/$/, '')}/reset-password?token=${token}`;
    const nama = user.nama_lengkap || user.nama || user.username || 'Pengguna';

    // Log tautan di server (sangat berguna untuk pengujian di lokal)
    this.logger.log(`[RESET PASSWORD LINK] ${user.username} (${email}) -> ${tautan}`);

    const hasilKirim = await this.emailService.kirim({
      ke: email,
      subjek: 'Atur Ulang Kata Sandi Akun ACCA Anda',
      html: this.buatTemplateEmailReset(nama, tautan),
      teks:
        `Halo ${nama},\n\n` +
        `Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda di ACCA MAN Insan Cendekia Gowa.\n` +
        `Silakan buka tautan berikut untuk membuat kata sandi baru:\n` +
        `${tautan}\n\n` +
        `Tautan ini berlaku ${AuthService.MENIT_BERLAKU_TOKEN} menit. Jika Anda tidak meminta perubahan ini, abaikan email ini.\n\n` +
        `MAN Insan Cendekia Gowa`,
    });

    if (!hasilKirim.terkirim) {
      this.logger.error(`forgotPassword: Gagal mengirim email ke ${email}: ${hasilKirim.alasan}`);
      // Batalkan penyimpanan token agar tidak mengunci cooldown pengguna tanpa hasil
      await this.prismaService.auth_users.update({
        where: { id: user.auth_id },
        data: {
          recovery_token: null,
          recovery_sent_at: null,
        },
      });
      return {
        ok: false,
        error: `Pengiriman email pemulihan gagal: ${hasilKirim.alasan || 'Layanan email menolak pengiriman'}. Silakan periksa konfigurasi atau hubungi Administrator.`,
      };
    }

    return jawabanSeragam;
  }

  /** Template HTML email pemulihan password yang bersih, minimalis, dan elegan. */
  private buatTemplateEmailReset(nama: string, tautan: string): string {
    const namaLolos = this.lolos(nama);
    const menit = AuthService.MENIT_BERLAKU_TOKEN;

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atur Ulang Kata Sandi</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Card 480px -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
          <tr>
            <td>
              <p style="font-size: 14px; line-height: 24px; color: #334155; margin: 0 0 20px 0;">
                Halo <strong>${namaLolos}</strong>, klik tombol di bawah untuk membuat kata sandi baru akun Anda:
              </p>

              <!-- Button CTA -->
              <div style="margin: 24px 0;">
                <a href="${tautan}" target="_blank" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
                  Atur Kata Sandi Baru
                </a>
              </div>

              <!-- Note -->
              <p style="font-size: 12px; line-height: 18px; color: #94a3b8; margin: 20px 0 0 0; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                Tautan ini berlaku ${menit} menit. Abaikan jika Anda tidak meminta perubahan kata sandi.
              </p>
            </td>
          </tr>
        </table>

        <!-- Small Muted Footer -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin-top: 16px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #94a3b8;">
              MAN Insan Cendekia Gowa &bull; acca.icgowa.sch.id
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /** Nama pemakai ikut masuk ke badan HTML email, jadi dilolosi lebih dulu. */
  private lolos(v: string): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Periksa keabsahan token reset sebelum pengguna mengisi formulir.
   */
  async verifyRecoveryToken(token: string) {
    const tokenBersih = String(token ?? '').trim().toLowerCase();
    if (!tokenBersih || !/^[a-f0-9]{64}$/i.test(tokenBersih)) {
      return { valid: false, message: 'Format kode tautan pemulihan tidak sah.' };
    }

    const baris = await this.prismaService.auth_users.findFirst({
      where: { recovery_token: this.hashToken(tokenBersih) },
      select: { id: true, recovery_sent_at: true },
    });

    if (!baris || !baris.recovery_sent_at) {
      return {
        valid: false,
        message:
          'Tautan pemulihan ini tidak sah atau sudah digantikan oleh permintaan yang lebih baru. Jika Anda meminta tautan beberapa kali, pastikan membuka tautan dari email yang paling baru.',
      };
    }

    const umurMenit = (Date.now() - baris.recovery_sent_at.getTime()) / 60000;
    if (umurMenit > AuthService.MENIT_BERLAKU_TOKEN) {
      return {
        valid: false,
        message: `Tautan ini sudah kedaluwarsa (berlaku ${AuthService.MENIT_BERLAKU_TOKEN} menit). Silakan minta tautan baru di halaman masuk.`,
      };
    }

    return { valid: true };
  }

  /**
   * Selesaikan pemulihan: tukar token dengan password baru.
   *
   * Tokennya SEKALI PAKAI — dikosongkan bersamaan dengan penulisan password, jadi
   * tautan yang sama tidak bisa dipakai lagi meski emailnya masih tersimpan di
   * kotak surat. Penanda `must_change_password` juga dicabut: pemiliknya baru saja
   * menentukan passwordnya sendiri.
   */
  async resetPasswordDenganToken(token: string, passwordBaru: string) {
    return this.prismaService.$transaction(async tx => {
      await lockAccountWrites(tx);

      const tokenBersih = String(token ?? '').trim().toLowerCase();
      const password = String(passwordBaru ?? '');

      if (!tokenBersih || !/^[a-f0-9]{64}$/i.test(tokenBersih)) {
        throw new BadRequestException('Tautan tidak sah atau format token salah.');
      }
      if (password.length < 6) {
        throw new BadRequestException('Password minimal 6 karakter');
      }

      const baris = await tx.auth_users.findFirst({
        where: { recovery_token: this.hashToken(tokenBersih) },
        select: { id: true, recovery_sent_at: true, raw_user_meta_data: true, raw_app_meta_data: true },
      });

      const tidakSah = () =>
        new BadRequestException(
          'Tautan pemulihan tidak sah atau sudah kedaluwarsa. Jika Anda sempat meminta tautan baru, pastikan membuka tautan dari email yang paling baru diterima.',
        );

      if (!baris || !baris.recovery_sent_at) throw tidakSah();

      const umurMenit = (Date.now() - baris.recovery_sent_at.getTime()) / 60000;
      if (umurMenit > AuthService.MENIT_BERLAKU_TOKEN) throw tidakSah();

      const meta =
        baris.raw_user_meta_data && typeof baris.raw_user_meta_data === 'object'
          ? { ...(baris.raw_user_meta_data as Record<string, any>) }
          : {};
      delete meta.must_change_password;

      const changed = await tx.auth_users.updateMany({
        where: { id: baris.id, recovery_token: this.hashToken(tokenBersih) },
        data: {
          encrypted_password: await bcrypt.hash(password, 10),
          raw_app_meta_data: revokeSessions(baris.raw_app_meta_data),
          recovery_token: null,
          recovery_sent_at: null,
          raw_user_meta_data: meta,
          updated_at: new Date(),
        },
      });

      if (changed.count !== 1) throw tidakSah();

      return { ok: true, message: 'Password berhasil diperbarui. Silakan masuk dengan password baru Anda.' };

    }, { maxWait: 10000, timeout: 20000 });
  }

  /**
   * Kata yang dipakai menyusun password sementara.
   *
   * Password ini disampaikan admin kepada pemiliknya secara lisan atau tertulis,
   * jadi bentuknya harus bisa DIBACAKAN — bukan `xK9#mZ2$`. Daftarnya juga
   * menghindari huruf/angka yang mudah tertukar saat dibacakan (0/O, 1/l/I).
   */
  private static readonly KATA_SANDI_SEMENTARA = [
    'Melati', 'Anggrek', 'Bakau', 'Cempaka', 'Delima', 'Flamboyan',
    'Kenanga', 'Mahoni', 'Pandan', 'Sakura', 'Teratai', 'Wijaya',
  ];

  /**
   * Password sementara ACAK per akun.
   *
   * Sebelumnya semua reset menghasilkan `acca123` yang sama. Satu nilai yang
   * diketahui semua orang karena itu berlaku di setiap akun yang baru direset, dan
   * bertahan sampai pemiliknya kebetulan menggantinya — untuk akun siswa, mungkin
   * tidak pernah. Penanda `must_change_password` di bawah menutup sisi kedua itu.
   */
  private buatPasswordSementara(): string {
    const kata =
      AuthService.KATA_SANDI_SEMENTARA[
        crypto.randomInt(AuthService.KATA_SANDI_SEMENTARA.length)
      ];
    // 4 digit, tanpa angka pembuka 0 supaya tidak hilang saat dicatat.
    return `${kata}-${crypto.randomInt(1000, 10000)}`;
  }

  async adminResetPassword(
    callerUserId: string,
    targetUserId: string | number,
    newPassword?: string,
  ) {
    return this.prismaService.$transaction(async tx => {
      await lockAccountWrites(tx);

      // 1. Verify caller is admin
      const caller = await tx.public_users.findUnique({
        where: { id: BigInt(callerUserId) },
        select: { role: true },
      });
      const roles = (caller?.role || '')
        .split(/[,|]/)
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean);
      if (!roles.includes('ADMIN') && !roles.includes('ADMINISTRATOR')) {
        throw new ForbiddenException('Hanya admin yang bisa mereset password');
      }

      // 2. Find target user
      const targetUser = await tx.public_users.findUnique({
        where: { id: BigInt(targetUserId) },
      });
      if (!targetUser) {
        throw new NotFoundException('User tidak ditemukan');
      }

      // Admin boleh menentukan sendiri; kalau tidak, dibuatkan yang acak per akun.
      const passwordToSet =
        newPassword && newPassword.trim() ? newPassword.trim() : this.buatPasswordSementara();
      if (passwordToSet.length < 6) throw new BadRequestException('Password minimal 6 karakter');
      const encryptedPassword = await bcrypt.hash(passwordToSet, 10);

      let authId = targetUser.auth_id;
      if (!authId) {
        authId = crypto.randomUUID();
        await tx.public_users.update({
          where: { id: targetUser.id },
          data: { auth_id: authId },
        });
      }

      // 3. Upsert to auth_users in PostgreSQL VPS
      const existingAuth = await tx.auth_users.findUnique({
        where: { id: authId },
      });

      // Penanda disimpan di `raw_user_meta_data` yang sudah bertipe Json, jadi tidak
      // perlu kolom baru — `JwtStrategy` dan `login()` membacanya untuk memaksa
      // penggantian sebelum akunnya bisa dipakai.
      const metaLama =
        existingAuth?.raw_user_meta_data && typeof existingAuth.raw_user_meta_data === 'object'
          ? (existingAuth.raw_user_meta_data as Record<string, unknown>)
          : {};
      const metaBaru = { ...metaLama, must_change_password: true };

      if (existingAuth) {
        await tx.auth_users.update({
          where: { id: authId },
          data: {
            encrypted_password: encryptedPassword,
            raw_user_meta_data: metaBaru,
            raw_app_meta_data: revokeSessions(existingAuth?.raw_app_meta_data),
            recovery_token: null, recovery_sent_at: null,
            updated_at: new Date(),
          },
        });
      } else {
        await tx.auth_users.create({
          data: {
            id: authId,
            email: targetUser.email || `${targetUser.username}@icgowa.sch.id`,
            encrypted_password: encryptedPassword,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date(),
            updated_at: new Date(),
            raw_user_meta_data: metaBaru,
          },
        });
      }

      // Tidak ada lagi salinan ke `public_users.password_hash`: kolom itu sedang
      // dihapus, dan menyalin kredensial ke dua tempat hanya memperbanyak
      // permukaan yang harus dijaga.

      const namaTarget =
        targetUser.nama_lengkap || targetUser.nama || targetUser.username;

      return {
        ok: true,
        // Nilainya dikembalikan supaya admin bisa menyampaikannya; ini satu-satunya
        // kesempatan melihatnya, karena yang tersimpan hanyalah hash-nya.
        password: passwordToSet,
        harusGanti: true,
        message:
          `Password untuk ${namaTarget} berhasil direset. ` +
          `Pemiliknya akan diminta menggantinya saat login berikutnya.`,
      };

    }, { maxWait: 10000, timeout: 20000 });
  }
}
