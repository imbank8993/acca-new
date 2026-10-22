import type { Prisma } from '@prisma/client';
import { lockAccountWrites, revokeSessions, countUsableAdmins } from '../auth/session-security';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OrangtuaService } from '../orangtua/orangtua.service';

export interface CreateUserInput {
  username: string;
  nip: string;
  nama: string;
  nama_lengkap?: string;
  divisi?: string;
  email?: string;
  role?: string;
  password?: string;
  aktif?: boolean;
}

export interface UpdateUserInput {
  username?: string;
  nip?: string;
  nama?: string;
  nama_lengkap?: string;
  divisi?: string;
  email?: string;
  role?: string;
  password?: string;
  foto_profil?: string | null;
  aktif?: boolean;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private orangtuaService: OrangtuaService,
  ) {}

  private accountTransaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await lockAccountWrites(tx);
      return run(tx);
    }, { maxWait: 10000, timeout: 20000 });
  }

  private loginEmail(username: string, email?: string | null): string {
    return email?.trim() || `${username.trim().toLowerCase()}@acca.local`;
  }

  private serialize(user: any) {
    return { ...user, id: user.id.toString() };
  }

  /**
   * Kredensial disimpan sebagai bcrypt di `auth_users.encrypted_password` —
   * tabel yang sama yang diperiksa saat login. Kolom lama
   * `public_users.password_hash` sengaja TIDAK diisi lagi: dulu diisi password
   * PLAINTEXT, dan kini tidak dipakai selama user punya auth_id.
   */
  private async writeCredential(authId: string, password: string, tx: Prisma.TransactionClient) {
    if (typeof password !== 'string' || password.length < 6) throw new BadRequestException('Password minimal 6 karakter');
    const credential = await tx.auth_users.findUnique({ where: { id: authId }, select: { raw_app_meta_data: true } });
    await tx.auth_users.update({ where: { id: authId }, data: {
      encrypted_password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      raw_app_meta_data: revokeSessions(credential?.raw_app_meta_data),
      recovery_token: null, recovery_sent_at: null, updated_at: new Date(),
    } });
  }

  async list(filter: { aktif?: string; role?: string; search?: string }) {
    const where: Record<string, any> = {};
    if (filter.aktif !== undefined && filter.aktif !== null && filter.aktif !== '') {
      where.aktif = filter.aktif === 'true';
    }
    if (filter.role) {
      where.role = { contains: filter.role, mode: 'insensitive' };
    }
    if (filter.search) {
      where.OR = [
        { username: { contains: filter.search, mode: 'insensitive' } },
        { nama: { contains: filter.search, mode: 'insensitive' } },
        { nip: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.public_users.findMany({ where, orderBy: { nama: 'asc' } });
  }

  async findById(id: string | bigint) {
    const user = await this.prisma.public_users.findUnique({ where: { id: BigInt(id) } });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return user;
  }

  async create(input: CreateUserInput) {
    return this.accountTransaction(tx => this.createInTransaction(tx, input));
  }

  private async createInTransaction(tx: Prisma.TransactionClient, input: CreateUserInput) {
    const username = input.username?.trim();
    const nip = input.nip?.trim() || null;
    const emailInput = input.email?.trim() || null;
    if (!username || !input.nama) {
      throw new BadRequestException('Username dan Nama wajib diisi');
    }

    // NIP opsional: akun orang tua mendaftar dengan email saja.
    const orConditions: any[] = [{ username: { equals: username, mode: 'insensitive' } }];
    if (nip) orConditions.push({ nip });
    if (emailInput) orConditions.push({ email: { equals: emailInput, mode: 'insensitive' } });

    const existing = await tx.public_users.findFirst({
      where: { OR: orConditions },
      select: { id: true, username: true, nip: true, email: true },
    });
    if (existing) {
      if (existing.username?.toLowerCase() === username.toLowerCase()) {
        throw new BadRequestException('Username sudah terdaftar');
      }
      if (nip && existing.nip === nip) {
        throw new BadRequestException('NIP sudah terdaftar');
      }
      if (emailInput && existing.email?.toLowerCase() === emailInput.toLowerCase()) {
        throw new BadRequestException('Email sudah terdaftar');
      }
      throw new BadRequestException('Username, NIP, atau Email sudah terdaftar');
    }

    const role = await this.normalkanRole(input.role || 'GURU', tx);
    const normalizedEmail = emailInput ? emailInput.toLowerCase() : null;
    const email = this.loginEmail(username, normalizedEmail).toLowerCase();
    const authId = randomUUID();
    const now = new Date();

    // Pastikan akun selalu memiliki kredensial terenkripsi (jika kosong saat impor, gunakan NIP/username/acca123 sebagai sandi awal)
    const rawPassword = input.password?.trim() || nip || username || 'acca123';
    const isDefaultPassword = !input.password?.trim();
    const encryptedPassword = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

    // auth_users dibuat lebih dulu supaya public_users.auth_id selalu menunjuk
    // ke baris kredensial yang valid — login bergantung pada pasangan ini.
    await tx.auth_users.create({
      data: {
        id: authId,
        aud: 'authenticated',
        role: 'authenticated',
        email,
        encrypted_password: encryptedPassword,
        email_confirmed_at: now,
        created_at: now,
        updated_at: now,
        raw_app_meta_data: { provider: 'email', providers: ['email'] },
        raw_user_meta_data: {
          username,
          nama: input.nama,
          nama_lengkap: input.nama_lengkap || input.nama,
          role,
          roles: role.split(','),
          ...(isDefaultPassword ? { must_change_password: true } : {}),
        },
      },
    });

    try {
      const user = await tx.public_users.create({
        data: {
          username,
          nip,
          nama: input.nama,
          nama_lengkap: input.nama_lengkap || input.nama,
          divisi: input.divisi || '',
          email: normalizedEmail,
          role,
          auth_id: authId,
          aktif: input.aktif !== undefined ? Boolean(input.aktif) : true,
          created_at: now,
        },
      });

      return this.serialize(user);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const target = e?.meta?.target;
        const fieldName = Array.isArray(target) ? target.join(', ') : 'Username atau Email';
        throw new BadRequestException(`${fieldName} sudah terdaftar`);
      }
      throw e;
    }
  }

  /**
   * Normalkan dan VALIDASI daftar role terhadap tabel `roles`.
   *
   * Dipakai ketiga jalur penulisan role — `create`, `update`, dan `bulkUpsert` —
   * supaya aturannya sama di semuanya. Sebelumnya hanya impor massal yang
   * memeriksa, sehingga form tambah/edit akun masih bisa menyimpan role di luar
   * daftar: tidak muncul di dropdown mana pun, tidak cocok dengan satu baris
   * `role_pages` pun (jadi tanpa akses), dan sulit ditemukan kembali.
   *
   * Mengembalikan bentuk ternormal (`" wali kelas "` → `WALI_KELAS`) supaya nilai
   * dari layar atau berkas tidak tersimpan apa adanya lalu luput dari pencocokan
   * yang peka huruf besar-kecil.
   */
  private async normalkanRole(role: string, db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<string> {
    const diminta = String(role ?? '')
      .split(/[,|]/)
      .map((r) => r.trim().toUpperCase().replace(/\s+/g, '_'))
      .filter(Boolean);

    if (diminta.length === 0) {
      throw new BadRequestException('Role wajib diisi');
    }

    const daftar = await db.roles.findMany({ select: { name: true } });
    const sah = new Set(daftar.map((r) => r.name.trim().toUpperCase()));
    const takDikenal = [...new Set(diminta)].filter((r) => !sah.has(r));

    if (takDikenal.length > 0) {
      throw new BadRequestException(
        `Role tidak dikenal: ${takDikenal.join(', ')}. ` +
          `Daftarkan lebih dulu di Pengaturan Users -> Daftar Role.`,
      );
    }

    return [...new Set(diminta)].join(',');
  }

  /** Apakah string role ini memuat ADMIN/ADMINISTRATOR sebagai elemen utuh? */
  private punyaRoleAdmin(role?: string | null): boolean {
    return String(role || '')
      .split(/[,|]/)
      .map((r) => r.trim().toUpperCase())
      .some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
  }

  /**
   * Cegah hilangnya Admin terakhir.
   *
   * Sudah ada penjaga "jangan nonaktifkan/hapus akun sendiri", tapi tidak ada yang
   * menahan jalur yang sebenarnya mematikan: seorang Admin mencabut role ADMIN dari
   * akunnya sendiri lewat `PUT /users/:id` — yang memang menerima `role` — atau
   * menonaktifkan/menghapus Admin lain sampai tak ada yang tersisa. Begitu tidak
   * ada Admin aktif, tidak ada lagi yang bisa masuk untuk memperbaikinya: seluruh
   * pengelolaan user, role, dan Hak Akses Fitur hanya terbuka untuk Admin.
   *
   * `masihAdmin` = apakah setelah tindakan ini akun target masih Admin aktif.
   */
  private async assertAdminTidakHabis(id: bigint, masihAdmin: boolean, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const target = await db.public_users.findUnique({
      where: { id },
      select: { role: true, aktif: true, auth_id: true },
    });
    if (!target) return;

    const targetAdminSekarang = this.punyaRoleAdmin(target.role) && target.aktif === true && Boolean(target.auth_id);
    if (!targetAdminSekarang || masihAdmin) return;

    // `contains` hanya mempersempit kandidat; kecocokannya ditentukan `punyaRoleAdmin`
    // supaya role seperti `ADMINISTRASI` tidak ikut terhitung sebagai Admin.
    const jumlahAdmin = await countUsableAdmins(db as Prisma.TransactionClient);
    if (jumlahAdmin <= 1) {
      throw new BadRequestException(
        'Ini satu-satunya akun Admin yang aktif. Tunjuk Admin lain lebih dulu sebelum ' +
          'mencabut role, menonaktifkan, atau menghapus akun ini — kalau tidak, tidak ada ' +
          'lagi yang bisa masuk untuk memperbaikinya.',
      );
    }
  }

  async update(id: string | bigint, input: UpdateUserInput) {
    return this.accountTransaction(tx => this.updateInTransaction(tx, id, input));
  }

  private async updateInTransaction(tx: Prisma.TransactionClient, id: string | bigint, input: UpdateUserInput) {
    const user = await tx.public_users.findUnique({
      where: { id: BigInt(id) },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    if (input.role !== undefined || input.aktif !== undefined) {
      const roleSetelah = input.role !== undefined ? input.role : user.role;
      const aktifSetelah = input.aktif !== undefined ? input.aktif : user.aktif;
      await this.assertAdminTidakHabis(
        BigInt(id),
        this.punyaRoleAdmin(roleSetelah) && aktifSetelah === true,
        tx,
      );
    }

    // Divalidasi SEBELUM disusun ke `data`, supaya role di luar daftar tidak pernah
    // sampai ke basis data lewat jalur ini.
    const roleTernormal =
      input.role !== undefined ? await this.normalkanRole(input.role, tx) : undefined;

    // Validasi duplikasi username, NIP, atau email sebelum update
    const usernameInput = input.username?.trim();
    const nipInput = input.nip !== undefined ? (input.nip?.trim() || null) : undefined;
    const emailInput = input.email !== undefined ? (input.email?.trim() || null) : undefined;

    const orConditions: any[] = [];
    if (usernameInput && usernameInput.toLowerCase() !== user.username?.toLowerCase()) {
      orConditions.push({ username: { equals: usernameInput, mode: 'insensitive' } });
    }
    if (nipInput && nipInput !== user.nip) {
      orConditions.push({ nip: nipInput });
    }
    if (emailInput && emailInput.toLowerCase() !== user.email?.toLowerCase()) {
      orConditions.push({ email: { equals: emailInput, mode: 'insensitive' } });
    }

    if (orConditions.length > 0) {
      const existing = await tx.public_users.findFirst({
        where: {
          OR: orConditions,
          NOT: { id: BigInt(id) },
        },
        select: { id: true, username: true, nip: true, email: true },
      });

      if (existing) {
        if (usernameInput && existing.username?.toLowerCase() === usernameInput.toLowerCase()) {
          throw new BadRequestException('Username sudah digunakan oleh akun lain');
        }
        if (nipInput && existing.nip === nipInput) {
          throw new BadRequestException('NIP sudah digunakan oleh akun lain');
        }
        if (emailInput && existing.email?.toLowerCase() === emailInput.toLowerCase()) {
          throw new BadRequestException('Email sudah digunakan oleh akun lain');
        }
        throw new BadRequestException('Username, NIP, atau Email sudah digunakan');
      }
    }

    const data: Record<string, any> = {};
    for (const key of [
      'username',
      'nama',
      'nama_lengkap',
      'divisi',
      'role',
      'aktif',
      'foto_profil',
    ] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    if (usernameInput !== undefined) data.username = usernameInput;
    if (nipInput !== undefined) data.nip = nipInput;
    if (roleTernormal !== undefined) data.role = roleTernormal;
    const normalizedEmailInput = emailInput !== undefined ? (emailInput ? emailInput.toLowerCase() : null) : undefined;
    if (normalizedEmailInput !== undefined) data.email = normalizedEmailInput;

    let updated = user;
    if (Object.keys(data).length > 0) {
      try {
        updated = await tx.public_users.update({ where: { id: BigInt(id) }, data });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          const target = e?.meta?.target;
          const fieldName = Array.isArray(target) ? target.join(', ') : 'Username atau Email';
          throw new BadRequestException(`${fieldName} sudah digunakan`);
        }
        throw e;
      }
    }

    if (user.auth_id) {
      const authData: Record<string, any> = { updated_at: new Date() };

      if (normalizedEmailInput !== undefined || input.username !== undefined) {
        authData.email = this.loginEmail(
          input.username || updated.username || '',
          normalizedEmailInput !== undefined ? normalizedEmailInput : updated.email,
        ).toLowerCase();
      }

      // raw_user_meta_data dijaga tetap selaras supaya tabel cerminan ini tidak
      // menyimpan nama/role basi bila suatu saat dibaca lagi.
      if (
        input.role !== undefined ||
        input.nama !== undefined ||
        input.nama_lengkap !== undefined ||
        input.username !== undefined
      ) {
        const existingMeta =
          (
            await tx.auth_users.findUnique({
              where: { id: user.auth_id },
              select: { raw_user_meta_data: true },
            })
          )?.raw_user_meta_data ?? {};

        authData.raw_user_meta_data = {
          ...(existingMeta as object),
          username: updated.username,
          nama: updated.nama,
          nama_lengkap: updated.nama_lengkap,
          role: updated.role,
          roles: (updated.role || '').split(','),
        };
      }

      await tx.auth_users.update({
        where: { id: user.auth_id },
        data: authData,
      });

      if (input.password) {
        await this.writeCredential(user.auth_id, input.password, tx);
      }
    } else {
      // Jika user belum punya auth_id, buatkan dan tautkan
      const authId = randomUUID();
      const authEmail = this.loginEmail(updated.username || '', updated.email).toLowerCase();
      const rawPassword = input.password?.trim() || updated.nip || updated.username || 'acca123';
      await tx.auth_users.create({
        data: {
          id: authId,
          aud: 'authenticated',
          role: 'authenticated',
          email: authEmail,
          encrypted_password: await bcrypt.hash(rawPassword, BCRYPT_ROUNDS),
          email_confirmed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          raw_app_meta_data: { provider: 'email', providers: ['email'] },
          raw_user_meta_data: {
            username: updated.username,
            nama: updated.nama,
            nama_lengkap: updated.nama_lengkap,
            role: updated.role,
            roles: (updated.role || '').split(','),
          },
        },
      });
      await tx.public_users.update({
        where: { id: user.id },
        data: { auth_id: authId },
      });
      updated = { ...updated, auth_id: authId };
    }

    return this.serialize(updated);
  }

  async updateStatus(id: string | bigint, aktif: boolean, actingUser: any) {
    return this.accountTransaction(tx => this.updateStatusInTransaction(tx, id, aktif, actingUser));
  }

  private async updateStatusInTransaction(tx: Prisma.TransactionClient, id: string | bigint, aktif: boolean, actingUser: any) {
    if (actingUser && actingUser.id.toString() === id.toString() && !aktif) {
      throw new BadRequestException('Tidak bisa menonaktifkan akun sendiri');
    }
    if (!aktif) await this.assertAdminTidakHabis(BigInt(id), false, tx);

    const updated = await tx.public_users.update({
      where: { id: BigInt(id) },
      data: { aktif }
    });

    return this.serialize(updated);
  }

  /**
   * Kolom pada tabel `users` yang TIDAK boleh diganti secara massal.
   *
   * Semuanya menentukan akses atau identitas login, dan penggantian borongan atas
   * kolom-kolom ini tidak punya jalan pulih. Yang paling berbahaya `role`: satu
   * permintaan seperti `WHERE role = 'ADMIN'` akan mencabut role dari SELURUH admin
   * sekaligus, dan begitu tidak ada Admin aktif tidak ada lagi yang bisa masuk
   * untuk memperbaikinya.
   *
   * Jalur ini juga melewati `assertAdminTidakHabis` yang menjaga `update`,
   * `updateStatus`, `remove`, dan `updateUserRoles` — jadi tanpa daftar ini seluruh
   * penjaga itu bisa dilangkahi lewat satu endpoint.
   *
   * Kebutuhan yang sah sudah ada jalurnya sendiri: mengganti NAMA sebuah role
   * dilakukan lewat `AccessService.updateRole`, yang memperbarui `public_users.role`,
   * `role_pages`, dan tabel turunan lain dalam satu transaksi.
   */
  private static readonly KOLOM_USERS_TERLARANG = [
    'role',
    'aktif',
    'auth_id',
    'username',
    'email',
    'password_hash',
    'id',
  ];

  /** Batas baris yang disertakan pada pratinjau, supaya tidak mengirim satu tabel penuh. */
  private static readonly MAKS_PRATINJAU = 200;

  async bulkReplace(body: any) {
    const { table, column, oldValue, newValue, dryRun = true } = body;

    if (!table || !column || oldValue === undefined || newValue === undefined) {
      throw new BadRequestException('Missing required fields: table, column, oldValue, newValue');
    }

    const allowedTables = [
      'users',
      'master_guru',
      'master_siswa',
      'master_mapel',
      'master_kelas',
      'guru_mapel',
      'guru_asuh',
      'wali_kelas',
      'siswa_kelas',
      'jadwal_guru'
    ];

    if (!allowedTables.includes(table)) {
      throw new BadRequestException(`Table '${table}' is not allowed for bulk replace`);
    }

    if (!/^[a-zA-Z0-9_]+$/.test(column)) {
      throw new BadRequestException(`Invalid column name`);
    }

    if (table === 'users' && UsersService.KOLOM_USERS_TERLARANG.includes(column.toLowerCase())) {
      throw new BadRequestException(
        `Kolom '${column}' pada tabel users tidak boleh diganti secara massal karena ` +
          `menentukan akses atau identitas login, dan tidak ada jalan pulihnya. ` +
          `Ubah per akun di tab "Data & Status User", atau — bila yang dimaksud adalah ` +
          `mengganti nama sebuah role — lewat tab "Daftar Role".`,
      );
    }

    // Nama kolom dicocokkan ke kolom yang BENAR-BENAR ada di tabel itu. Regex di
    // atas hanya memastikan bentuknya aman untuk disisipkan ke SQL; tanpa
    // pemeriksaan ini, kolom yang salah tulis baru gagal di dalam Postgres dan
    // keluar sebagai 500, bukan sebagai masukan yang ditolak.
    const kolomAda = await this.prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       LIMIT 1`,
      table,
      column,
    );
    if (kolomAda.length === 0) {
      throw new BadRequestException(`Kolom '${column}' tidak ada di tabel '${table}'`);
    }

    // Convert arrays if needed, but the original API just passed oldValue/newValue directly.
    const matchingRecords = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${table}" WHERE "${column}" = $1`,
      oldValue
    );

    const affectedCount = matchingRecords.length;

    if (dryRun) {
      // BigInt serialization fix
      const serializedRecords = matchingRecords.map(r => {
        const obj = { ...r };
        for (const key in obj) {
          if (typeof obj[key] === 'bigint') {
            obj[key] = obj[key].toString();
          }
        }
        return obj;
      });

      return {
        dryRun: true,
        preview: {
          table,
          column,
          oldValue,
          newValue,
          affectedCount,
          // Dipotong: baris-baris ini memuat seluruh kolom, termasuk data pribadi
          // pada master_siswa/master_guru, dan filter yang longgar bisa mencocokkan
          // ribuan baris sekaligus.
          affectedRecords: serializedRecords.slice(0, UsersService.MAKS_PRATINJAU),
          previewTruncated: affectedCount > UsersService.MAKS_PRATINJAU,
        },
        message: `Found ${affectedCount} record(s) that would be updated`
      };
    }

    if (affectedCount === 0) {
      return {
        dryRun: false,
        affectedCount: 0,
        message: 'No records found to update'
      };
    }

    const updatedRecords = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2 RETURNING *`,
      newValue,
      oldValue
    );

    const serializedUpdated = updatedRecords.map(r => {
      const obj = { ...r };
      for (const key in obj) {
        if (typeof obj[key] === 'bigint') {
          obj[key] = obj[key].toString();
        }
      }
      return obj;
    });

    return {
      dryRun: false,
      affectedCount: serializedUpdated.length,
      updatedRecords: serializedUpdated,
      message: `Successfully updated ${serializedUpdated.length} record(s)`
    };
  }

  async remove(id: string | bigint, requesterAuthId: string | null) {
    return this.accountTransaction(tx => this.removeInTransaction(tx, id, requesterAuthId));
  }

  private async removeInTransaction(tx: Prisma.TransactionClient, id: string | bigint, requesterAuthId: string | null) {
    const target = await tx.public_users.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, auth_id: true, username: true, foto_profil: true },
    });
    if (!target) throw new NotFoundException('User tidak ditemukan');

    if (target.auth_id && target.auth_id === requesterAuthId) {
      throw new BadRequestException('Tidak bisa menghapus akun sendiri');
    }
    await this.assertAdminTidakHabis(BigInt(id), false, tx);

    try {
      await tx.public_users.delete({ where: { id: BigInt(id) } });
      if (target.auth_id) {
        await tx.auth_users.delete({ where: { id: target.auth_id } });
      }
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new BadRequestException(
          `Pengguna "${target.username}" tidak dapat dihapus karena memiliki riwayat data terkait (transaksi keuangan, klinik, persetujuan, atau log). Nonaktifkan status akun ini sebagai gantinya.`,
        );
      }
      throw e;
    }

    return { fotoProfil: target.foto_profil, username: target.username };
  }

  async updateOwn(user: any, profile: UpdateUserInput, password?: string, oldPassword?: string) {
    return this.accountTransaction(async tx => {
      if (password !== undefined) await this.verifyOwnPassword(tx, user, password, oldPassword);
      const result = await this.updateInTransaction(tx, user.id, profile);
      if (password !== undefined) await this.changeOwnPasswordInTransaction(tx, user, password);
      return result;
    });
  }

  async changeOwnPassword(user: any, password: string, oldPassword?: string) {
    return this.accountTransaction(async tx => {
      await this.verifyOwnPassword(tx, user, password, oldPassword);
      await this.changeOwnPasswordInTransaction(tx, user, password);
    });
  }

  private async verifyOwnPassword(tx: Prisma.TransactionClient, user: any, password: string, oldPassword?: string) {
    if (typeof password !== 'string' || password.length < 6) throw new BadRequestException('Password minimal 6 karakter');
    if (!user.auth_id) throw new BadRequestException('Akun belum memiliki kredensial');
    // Konfirmasi password lama sengaja tidak diminta lagi: pengguna yang sudah
    // login (sesi JWT valid) cukup memasukkan password baru. `oldPassword`
    // tetap diterima di signature agar pemanggil lama tidak rusak, tapi diabaikan.
    void oldPassword;
    const current = await tx.auth_users.findUnique({ where: { id: user.auth_id }, select: { encrypted_password: true } });
    if (current?.encrypted_password && await bcrypt.compare(password, current.encrypted_password)) throw new BadRequestException('Password baru harus berbeda dari password saat ini');
  }

  private async changeOwnPasswordInTransaction(tx: Prisma.TransactionClient, user: any, password: string) {
    await this.writeCredential(user.auth_id, password, tx);
    const credential = await tx.auth_users.findUnique({ where: { id: user.auth_id }, select: { raw_user_meta_data: true } });
    const metadata = credential?.raw_user_meta_data && typeof credential.raw_user_meta_data === 'object' ? { ...credential.raw_user_meta_data as Record<string, any> } : {};
    delete metadata.must_change_password;
    await tx.auth_users.update({ where: { id: user.auth_id }, data: { raw_user_meta_data: metadata } });
  }

  /**
   * Pendaftaran mandiri orang tua + klaim anak.
   *
   * Seluruh langkahnya dijalankan di VPS: verifikasi siswa, cek kuota klaim,
   * pembuatan/verifikasi akun, sampai penautan. Kalau akunnya dibuat di VPS
   * tapi baris klaimnya ditulis ke Supabase, `orangtua_siswa.user_id` akan
   * menunjuk id yang tidak ada di sana.
   */
  async registerParent(input: {
    nama: string;
    status_keluarga: string;
    email: string;
    password: string;
    nisn: string;
    tanggal_lahir_siswa: string;
  }) {
    const { nama, status_keluarga, nisn, tanggal_lahir_siswa } = input;
    if (!nama || !status_keluarga || !input.email || !input.password || !nisn || !tanggal_lahir_siswa) {
      throw new BadRequestException('Semua kolom wajib diisi');
    }
    if (input.password.length < 6) {
      throw new BadRequestException('Kata sandi minimal 6 karakter');
    }

    const email = input.email.trim().toLowerCase();

    // 1 & 2. Verifikasi siswa + aturan kuota/duplikasi klaim — logikanya milik
    // OrangtuaService supaya sama persis dengan jalur "tambah anak" dan
    // penautan oleh admin.
    await this.orangtuaService.verifySiswa(nisn, tanggal_lahir_siswa, false);
    await this.orangtuaService.assertClaimAllowed(nisn, status_keluarga);

    // 3. Pakai akun yang ada, atau buat baru
    const existingUser = await this.prisma.public_users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, auth_id: true, role: true },
    });

    let userId: bigint;

    if (existingUser) {
      if (existingUser.role !== 'ORANG_TUA') {
        throw new BadRequestException(
          'Email ini sudah digunakan oleh akun dengan role lain (bukan Orang Tua).',
        );
      }

      // Kepemilikan akun diverifikasi lewat password sebelum anak baru ditautkan.
      const credential = existingUser.auth_id
        ? await this.prisma.auth_users.findUnique({
            where: { id: existingUser.auth_id },
            select: { encrypted_password: true },
          })
        : null;

      const valid =
        !!credential?.encrypted_password &&
        (await bcrypt.compare(input.password, credential.encrypted_password));
      if (!valid) {
        throw new BadRequestException(
          'Email sudah terdaftar sebagai akun Orang Tua. Masukkan kata sandi akun tersebut untuk menambahkan anak, atau pakai "Lupa Password" di halaman masuk untuk mengatur ulang kata sandinya.',
        );
      }

      userId = existingUser.id;
    } else {
      const created = await this.create({
        username: email,
        nip: '',
        nama,
        email,
        role: 'ORANG_TUA',
        password: input.password,
      });
      userId = BigInt(created.id);
    }

    // 4. Tautkan ke anak
    await this.orangtuaService.createClaim(userId, nisn, status_keluarga);

    return { message: 'Pendaftaran dan klaim siswa berhasil.' };
  }

  /**
   * Pendaftaran mandiri siswa:
   * Memverifikasi NISN + tanggal lahir di master_siswa (aktif = true).
   * Menolak jika NISN atau email sudah terdaftar.
   * Membuat akun dengan role 'SISWA', username = nisn, nip = nisn.
   */
  async registerStudent(input: {
    nisn: string;
    tanggal_lahir: string;
    email: string;
    password: string;
  }) {
    const nisn = input.nisn?.trim();
    const tanggalLahir = input.tanggal_lahir?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!nisn || !tanggalLahir || !email || !password) {
      throw new BadRequestException('Semua kolom wajib diisi');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Format email tidak valid (contoh: siswa@domain.com)');
    }
    if (email.endsWith('@acca.local')) {
      throw new BadRequestException('Gunakan alamat email aktif Anda yang sebenarnya');
    }
    if (password.length < 6) {
      throw new BadRequestException('Kata sandi minimal 6 karakter');
    }

    // 1. Cek apakah NISN sudah memiliki akun di public_users
    const akunEksis = await this.prisma.public_users.findFirst({
      where: {
        OR: [
          { nip: nisn },
          { username: { equals: nisn, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true },
    });

    if (akunEksis) {
      throw new BadRequestException(
        `Akun dengan NISN ${nisn} sudah ada. Silakan login atau gunakan menu Lupa Password jika lupa kata sandi.`,
      );
    }

    // 2. Cek apakah email sudah terpakai akun lain
    const emailEksis = await this.prisma.public_users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (emailEksis) {
      throw new BadRequestException(`Alamat email '${email}' sudah digunakan oleh akun lain.`);
    }

    // 3. Verifikasi ke master_siswa
    const siswa = await this.prisma.master_siswa.findFirst({
      where: { nisn },
      select: { nisn: true, nama_lengkap: true, tanggal_lahir: true, aktif: true },
    });

    if (!siswa) {
      throw new BadRequestException(`NISN ${nisn} tidak ditemukan di database master siswa madrasah.`);
    }

    if (!siswa.aktif) {
      throw new BadRequestException(`Data siswa dengan NISN ${nisn} berstatus nonaktif di database sekolah.`);
    }

    if (!siswa.tanggal_lahir) {
      throw new BadRequestException(
        `Tanggal lahir untuk NISN ${nisn} belum tercatat di database madrasah. Silakan hubungi operator madrasah.`,
      );
    }

    const tglDb = siswa.tanggal_lahir.toISOString().slice(0, 10);
    if (tglDb !== tanggalLahir) {
      throw new BadRequestException('Tanggal Lahir salah atau tidak sesuai dengan database madrasah.');
    }

    // 4. Buat akun Siswa
    const namaSiswa = siswa.nama_lengkap || nisn;
    const created = await this.create({
      username: nisn,
      nip: nisn,
      nama: namaSiswa,
      nama_lengkap: namaSiswa,
      email,
      role: 'SISWA',
      password,
      aktif: true,
    });

    // 5. Kirim audit notifikasi internal
    await this.prisma.notifications.create({
      data: {
        type: 'user_baru',
        title: 'Aktivasi Akun Siswa Mandiri',
        message: `Siswa ${namaSiswa} (NISN: ${nisn}) berhasil mengaktifkan akun secara mandiri.`,
        link: '/dashboard?page=PengaturanUsers',
        is_active: true,
      },
    }).catch(() => null);

    return {
      message: 'Akun siswa berhasil diaktifkan. Silakan login menggunakan NISN atau email Anda.',
      username: nisn,
      nama: namaSiswa,
    };
  }

  /**
   * Pendaftaran mandiri pegawai (Guru & Tendik):
   * Memverifikasi NIP + tanggal lahir (atau NIP 18-digit) + 4 digit no HP di master_guru (aktif = true).
   * Menentukan role secara otomatis: jenis_pegawai === 'TENDIK' -> 'TU', lainnya -> 'GURU'.
   * Menolak jika NIP, username, atau email sudah terdaftar.
   */
  async registerStaff(input: {
    nip: string;
    tanggal_lahir: string;
    digit_hp: string;
    username: string;
    email: string;
    password: string;
  }) {
    const nip = input.nip?.trim();
    const tanggalLahir = input.tanggal_lahir?.trim();
    const digitHp = input.digit_hp?.trim();
    const username = input.username?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!nip || !tanggalLahir || !digitHp || !username || !email || !password) {
      throw new BadRequestException('Semua kolom wajib diisi');
    }
    if (/\s/.test(username)) {
      throw new BadRequestException('Username tidak boleh mengandung spasi');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Format email tidak valid (contoh: pegawai@domain.com)');
    }
    if (email.endsWith('@acca.local')) {
      throw new BadRequestException('Gunakan alamat email aktif Anda yang sebenarnya');
    }
    if (password.length < 6) {
      throw new BadRequestException('Kata sandi minimal 6 karakter');
    }

    // 1. Cek apakah NIP ini sudah punya akun di public_users
    const akunEksis = await this.prisma.public_users.findFirst({
      where: { nip },
      select: { id: true, username: true },
    });

    if (akunEksis) {
      throw new BadRequestException(
        `Akun dengan NIP ${nip} sudah ada. Silakan login atau gunakan menu Lupa Password jika Anda lupa kata sandi.`,
      );
    }

    // 2. Cek apakah username atau email sudah digunakan
    const duplikat = await this.prisma.public_users.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { email: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { username: true, email: true },
    });

    if (duplikat) {
      if (duplikat.username?.toLowerCase() === username.toLowerCase()) {
        throw new BadRequestException(`Username '${username}' sudah digunakan oleh akun lain.`);
      }
      throw new BadRequestException(`Alamat email '${email}' sudah digunakan oleh akun lain.`);
    }

    // 3. Verifikasi ke master_guru
    const pegawai = await this.prisma.master_guru.findFirst({
      where: { nip },
      select: {
        nip: true,
        nama_lengkap: true,
        tanggal_lahir: true,
        no_hp: true,
        jenis_pegawai: true,
        aktif: true,
      },
    });

    if (!pegawai) {
      throw new BadRequestException(`NIP ${nip} tidak ditemukan di database master kepegawaian.`);
    }

    if (!pegawai.aktif) {
      throw new BadRequestException(`Pegawai dengan NIP ${nip} berstatus nonaktif di database kepegawaian.`);
    }

    // Verifikasi Tanggal Lahir (Wajib terdaftar dan cocok)
    let tglDb: string | null = null;
    if (pegawai.tanggal_lahir) {
      tglDb = pegawai.tanggal_lahir.toISOString().slice(0, 10);
    } else if (/^(19|20)\d{6}/.test(pegawai.nip) && pegawai.nip.length >= 8) {
      const y = pegawai.nip.slice(0, 4);
      const m = pegawai.nip.slice(4, 6);
      const d = pegawai.nip.slice(6, 8);
      tglDb = `${y}-${m}-${d}`;
    }

    if (!tglDb) {
      throw new BadRequestException(
        `Tanggal lahir untuk NIP ${nip} belum tercatat di data kepegawaian madrasah. Silakan hubungi Tata Usaha (TU) untuk melengkapinya.`,
      );
    }

    if (tglDb !== tanggalLahir) {
      throw new BadRequestException('Tanggal Lahir salah atau tidak sesuai dengan database kepegawaian.');
    }

    // Verifikasi Nomor HP: Wajib tercatat di master_guru dan wajib cocok
    if (!pegawai.no_hp || !pegawai.no_hp.trim()) {
      throw new BadRequestException(
        `Nomor HP untuk NIP ${nip} belum tercatat di data kepegawaian madrasah. Silakan hubungi Tata Usaha (TU) untuk melengkapinya.`,
      );
    }

    const noHpClean = String(pegawai.no_hp).replace(/\D/g, '');
    const inputHpClean = digitHp.replace(/\D/g, '');
    if (!inputHpClean || noHpClean.slice(-4) !== inputHpClean.slice(-4)) {
      throw new BadRequestException('Nomor HP tidak sesuai dengan database (4 digit terakhir tidak cocok).');
    }

    // 4. PENENTUAN ROLE OTOMATIS:
    // Jika jenis_pegawai === 'TENDIK' -> Role 'TU'
    // Selain itu -> Role 'GURU'
    const jenis = (pegawai.jenis_pegawai || 'GURU').toUpperCase().trim();
    const roleAkun = jenis === 'TENDIK' ? 'TU' : 'GURU';

    // 5. Buat akun Pegawai
    const created = await this.create({
      username,
      nip,
      nama: pegawai.nama_lengkap,
      nama_lengkap: pegawai.nama_lengkap,
      email,
      role: roleAkun,
      password,
      aktif: true,
    });

    // Backfill tanggal lahir ke master_guru jika sebelumnya kosong (diekstrak dari NIP PNS 18 digit)
    if (!pegawai.tanggal_lahir && tglDb) {
      await this.prisma.master_guru.update({
        where: { nip },
        data: { tanggal_lahir: new Date(`${tglDb}T00:00:00Z`) },
      }).catch(() => null);
    }

    // 6. Kirim audit notifikasi internal
    await this.prisma.notifications.create({
      data: {
        type: 'user_baru',
        title: `Aktivasi Akun ${roleAkun === 'TU' ? 'Tendik' : 'Guru'} Mandiri`,
        message: `${pegawai.nama_lengkap} (@${username}) telah mengaktifkan akun mandiri sebagai ${roleAkun}.`,
        link: '/dashboard?page=PengaturanUsers',
        is_active: true,
      },
    }).catch(() => null);

    return {
      message: `Akun ${roleAkun === 'TU' ? 'Tendik (TU)' : 'Guru'} berhasil diaktifkan. Silakan login menggunakan username atau email Anda.`,
      username,
      nama: pegawai.nama_lengkap,
      role: roleAkun,
    };
  }

  /**
   * Upsert massal berdasarkan username (dipakai impor pengguna).
   * Baris yang sudah ada diperbarui; yang belum ada dibuat lengkap dengan
   * kredensialnya bila password disertakan.
   */
  /**
   * Impor massal pengguna, upsert berdasarkan username.
   *
   * ROLE DIVALIDASI terhadap tabel `roles`, dan baris dengan role tak dikenal
   * DITOLAK. Sebelumnya kolom `role` dari berkas dipakai apa adanya, sehingga satu
   * salah ketik — `GURUU`, `ADMINN` — menghasilkan akun yang memegang role di luar
   * daftar mana pun: tidak muncul di dropdown, tidak cocok dengan satu baris
   * `role_pages` pun, jadi tanpa akses apa pun, dan sulit ditemukan kembali karena
   * tidak ada layar yang menampilkan role di luar daftar.
   *
   * Role boleh berupa daftar (`"GURU,WALI_KELAS"`); tiap elemen diperiksa sendiri.
   * Alasan kegagalan dikembalikan per baris supaya pemanggil bisa menyebutkan
   * baris mana yang ditolak dan mengapa — bukan hanya jumlahnya.
   */
  async bulkUpsert(rows: Array<CreateUserInput & { aktif?: boolean }>) {
    const hasil = {
      dibuat: 0,
      diperbarui: 0,
      gagal: [] as Array<{ username: string; alasan: string }>,
    };

    // Sekali untuk seluruh berkas, bukan per baris.
    const daftarRole = await this.prisma.roles.findMany({ select: { name: true } });
    const roleSah = new Set(daftarRole.map((r) => r.name.trim().toUpperCase()));

    for (const row of rows) {
      const username = row.username?.trim();
      if (!username) {
        hasil.gagal.push({ username: '(tanpa username)', alasan: 'Username kosong' });
        continue;
      }

      // Aturan yang sama dengan `create`/`update`, tapi di sini kegagalannya
      // dikumpulkan per baris — satu baris yang salah tidak boleh menjatuhkan
      // seluruh berkas. Daftar `roleSah` sudah dibaca di atas supaya tidak ada
      // kueri per baris.
      const diminta = String(row.role ?? '')
        .split(/[,|]/)
        .map((r) => r.trim().toUpperCase().replace(/\s+/g, '_'))
        .filter(Boolean);

      if (diminta.length === 0) {
        hasil.gagal.push({ username, alasan: 'Role kosong' });
        continue;
      }

      const takDikenal = [...new Set(diminta)].filter((r) => !roleSah.has(r));
      if (takDikenal.length > 0) {
        hasil.gagal.push({
          username,
          alasan: `Role tidak dikenal: ${takDikenal.join(', ')}`,
        });
        continue;
      }

      const rowTernormal = { ...row, role: [...new Set(diminta)].join(',') };

      try {
        const orConditions: any[] = [{ username: { equals: username, mode: 'insensitive' } }];
        if (row.nip?.trim()) orConditions.push({ nip: row.nip.trim() });
        if (row.email?.trim()) orConditions.push({ email: { equals: row.email.trim(), mode: 'insensitive' } });

        const existing = await this.prisma.public_users.findFirst({
          where: { OR: orConditions },
          select: { id: true },
        });

        if (existing) {
          await this.update(existing.id, rowTernormal);
          hasil.diperbarui++;
        } else {
          await this.create(rowTernormal);
          hasil.dibuat++;
        }
      } catch (e) {
        const pesan = (e as Error).message;
        this.logger.error(`bulkUpsert ${username}: ${pesan}`);
        hasil.gagal.push({ username, alasan: pesan });
      }
    }
    return hasil;
  }

  /**
   * Tautkan sesi yang sedang login ke satu baris `public_users` yang belum punya
   * `auth_id`. Sisa dari era Supabase, dan sejak pindah ke JWT sendiri fungsi ini
   * RUSAK: `authUser.id` adalah `public_users.id` bertipe BigInt, sedangkan
   * `auth_id` bertipe uuid. Perbandingannya karena itu selalu tidak sama (String
   * vs BigInt), dan cabang penulisannya akan mencoba menyimpan BigInt ke kolom
   * uuid — 500, bukan penautan. Yang benar adalah `authUser.auth_id`.
   *
   * Pesan galatnya juga disatukan. Sebelumnya "User not found in DB" (404)
   * berbeda dari "already linked" (400), sehingga akun mana pun yang login bisa
   * memakai endpoint ini untuk memetakan username dan NIP yang valid — dan NIP
   * adalah username login pegawai.
   */
  async linkAuth(authUser: any, input: { username?: string; nip?: string }) {
    const own = await this.prisma.public_users.findUnique({ where: { id: BigInt(authUser.id) } });
    const username = String(input.username || '').trim();
    const nip = String(input.nip || '').trim();
    if (!own || !own.auth_id || own.auth_id !== authUser.auth_id || (!username && !nip) ||
        (username && username.toLowerCase() !== own.username?.toLowerCase()) || (nip && nip !== own.nip)) {
      throw new ForbiddenException('Penautan akun lain hanya dapat dilakukan melalui pengelolaan akun oleh Admin.');
    }
    return { message: 'Sudah tertaut', user: this.serialize(own) };
  }

  private getUserWhereClause(user: any) {
    if (!user) return null;
    const conditions: any[] = [];
    if (user.auth_id) conditions.push({ auth_id: String(user.auth_id) });
    if (user.id !== undefined && user.id !== null) {
      try { conditions.push({ id: BigInt(user.id) }); } catch {}
    }
    if (user.sub) {
      if (/^\d+$/.test(String(user.sub))) {
        try { conditions.push({ id: BigInt(user.sub) }); } catch {}
      } else {
        conditions.push({ auth_id: String(user.sub) });
      }
    }
    if (user.username) conditions.push({ username: String(user.username) });
    return conditions.length > 0 ? { OR: conditions } : null;
  }

  async heartbeat(user: any, location?: string) {
    const locName = (location || '').trim().substring(0, 255) || null;
    const where = this.getUserWhereClause(user);
    if (where) {
      await this.prisma.public_users.updateMany({
        where,
        data: {
          last_seen: new Date(),
          last_location: locName,
        },
      });
    }
    return { success: true };
  }

  async getPinnedPages(user: any) {
    const where = this.getUserWhereClause(user);
    if (!where) return { ok: true, data: [] };
    const dbUser = await this.prisma.public_users.findFirst({
      where,
      select: { pinned_pages: true },
    });
    return {
      ok: true,
      data: Array.isArray(dbUser?.pinned_pages) ? dbUser.pinned_pages : [],
    };
  }

  async updatePinnedPages(user: any, pinned: string[]) {
    const where = this.getUserWhereClause(user);
    if (!where) return { ok: false, error: 'User tidak ditemukan' };
    await this.prisma.public_users.updateMany({
      where,
      data: { pinned_pages: pinned },
    });
    return { ok: true };
  }

  /**
   * `data: null` bila akun ini tidak punya baris pegawai — BUKAN 404.
   *
   * Halaman Profil memakai ada/tidaknya baris ini untuk memutuskan apakah tab
   * "Data Diri" ditampilkan, jadi "tidak ada" adalah jawaban yang sah dan bukan
   * kegagalan. Dulu di sini dilempar 404, sehingga akun tanpa baris pegawai
   * (orang tua, tamu) menghasilkan error di log setiap kali membuka profilnya.
   */
  async getProfileGuru(nip: string) {
    const data = nip
      ? await this.prisma.master_guru.findFirst({ where: { nip } })
      : null;
    if (!data) return { ok: true, data: null, rekening: [] };

    const rekening: any[] = [];
    if (data.rekening_1_nama_bank && data.rekening_1_aktif) {
      rekening.push({
        slot: 1,
        nama_bank: data.rekening_1_nama_bank,
        nomor: data.rekening_1_nomor || '',
        atas_nama: data.rekening_1_atas_nama || '',
        aktif: true,
      });
    }
    if (data.rekening_2_nama_bank && data.rekening_2_aktif) {
      rekening.push({
        slot: 2,
        nama_bank: data.rekening_2_nama_bank,
        nomor: data.rekening_2_nomor || '',
        atas_nama: data.rekening_2_atas_nama || '',
        aktif: true,
      });
    }

    return { ok: true, data: this.serialize(data), rekening };
  }

  /** `data: null` bila akun ini bukan siswa — lihat catatan di getProfileGuru. */
  async getProfileSiswa(user: any) {
    const nisn = this.profileSiswaIdentity(user);
    const data = nisn
      ? await this.prisma.master_siswa.findFirst({ where: { nisn } })
      : null;
    if (!data) return { ok: true, data: null };
    return { ok: true, data: this.serialize(data) };
  }

  private profileSiswaIdentity(user: any): string {
    // NIP stores the student NISN and can only be changed by an administrator.
    // Username is editable by the account itself, so it cannot establish ownership.
    return typeof user?.nip === 'string' ? user.nip.trim() : '';
  }

  /**
   * ── MENYIMPAN PROFIL SENDIRI ──────────────────────────────────────────────
   *
   * Tab "Data Diri" di halaman Profil memang terhubung ke `master_guru` /
   * `master_siswa` — tapi sebelumnya HANYA untuk membaca. Tombol simpannya
   * mengarah ke `PUT /users/me`, yang menyaring body ke kolom `public_users`
   * saja; seluruh kolom master (alamat, no_hp, golongan, rekening, dst.) dibuang
   * tanpa sisa, tidak ada operasi tulis yang terjadi, dan responsnya tetap
   * `{ ok: true }` sehingga UI menampilkan "Berhasil" untuk perubahan yang tidak
   * pernah tersimpan. Dua metode di bawah ini yang sesungguhnya menulisnya.
   *
   * Barisnya SELALU ditentukan dari identitas token pemanggil, bukan dari body.
   * Karena itu tidak ada cara menyunting data orang lain lewat endpoint ini,
   * bahkan bila `nip`/`nisn` ikut dikirim.
   */

  /**
   * Kolom yang boleh diubah pegawai sendiri.
   *
   * Ditulis sebagai daftar-izin, bukan daftar-larangan: kolom baru di
   * `master_guru` tidak otomatis jadi bisa disunting sendiri. `nip` dan
   * `nama_lengkap` sengaja tidak ada — keduanya hanya boleh diubah admin.
   * `jenis_pegawai` juga tidak: mutasi GURU↔TENDIK punya jalur khususnya sendiri
   * (`POST /master/guru/pindah`, Admin saja) yang menampilkan dampak penugasan
   * lebih dulu. `aktif` pun tidak, karena itu kendali penonaktifan akun.
   */
  private static readonly PROFIL_GURU_WRITABLE = [
    'tempat_lahir', 'tanggal_lahir', 'golongan', 'pangkat', 'tmt_tugas',
    'riwayat_pendidikan', 'alamat', 'no_hp',
    'rekening_1_nama_bank', 'rekening_1_nomor', 'rekening_1_atas_nama', 'rekening_1_aktif',
    'rekening_2_nama_bank', 'rekening_2_nomor', 'rekening_2_atas_nama', 'rekening_2_aktif',
  ];

  /**
   * Kolom yang boleh diubah siswa sendiri.
   *
   * `nisn`, `nama_lengkap`, `nama_ayah`, dan `nama_ibu` sengaja tidak ada —
   * keempatnya hanya boleh diubah admin. `aktif` juga tidak.
   */
  private static readonly PROFIL_SISWA_WRITABLE = [
    'nik', 'gender', 'tempat_lahir', 'tanggal_lahir', 'nomor_hp',
    'nomor_hp_ayah', 'nomor_hp_ibu', 'alamat', 'asal_sekolah',
  ];

  /** Kolom `@db.Date` pada kedua tabel; DatePicker mengirimnya sebagai 'YYYY-MM-DD'. */
  private static readonly PROFIL_DATE_FIELDS = ['tanggal_lahir', 'tmt_tugas'];

  /**
   * Saring body ke kolom yang diizinkan, sekaligus normalkan kolom tanggal.
   *
   * Prisma menolak string `YYYY-MM-DD` untuk kolom DateTime ("Expected ISO-8601
   * DateTime"), sementara form Edit memantulkan kembali nilai hasil pembacaan
   * yang sudah berupa ISO penuh — keduanya harus diterima.
   */
  private pickProfilFields(input: any, allowed: string[]): Record<string, any> {
    const data: Record<string, any> = {};
    for (const field of allowed) {
      if (input?.[field] === undefined) continue;
      let value = input[field];

      if (UsersService.PROFIL_DATE_FIELDS.includes(field)) {
        if (value === null || value === '') {
          value = null;
        } else {
          const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
          if (!cocok) {
            throw new BadRequestException(`Format tanggal '${field}' tidak dikenal: ${value}`);
          }
          value = new Date(`${cocok[1]}-${cocok[2]}-${cocok[3]}T00:00:00.000Z`);
        }
      }

      data[field] = value;
    }
    return data;
  }

  async updateProfileGuru(user: any, input: any) {
    const nip = String(user?.nip || '').trim();
    if (!nip) throw new BadRequestException('Akun Anda belum tertaut ke NIP pegawai');

    const milik = await this.prisma.master_guru.findFirst({
      where: { nip },
      select: { id: true },
    });
    if (!milik) throw new NotFoundException('Data pegawai Anda tidak ditemukan di master');

    const data = this.pickProfilFields(input, UsersService.PROFIL_GURU_WRITABLE);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Tidak ada kolom yang dapat diperbarui');
    }

    const updated = await this.prisma.master_guru.update({
      where: { id: milik.id },
      data: { ...data, updated_at: new Date() },
    });
    return { ok: true, data: this.serialize(updated) };
  }

  async updateProfileSiswa(user: any, input: any) {
    const nisn = this.profileSiswaIdentity(user);
    if (!nisn) throw new BadRequestException('Akun Anda belum tertaut ke NISN');

    const milik = await this.prisma.master_siswa.findFirst({
      where: { nisn },
      select: { id: true },
    });
    if (!milik) throw new NotFoundException('Data siswa Anda tidak ditemukan di master');

    const data = this.pickProfilFields(input, UsersService.PROFIL_SISWA_WRITABLE);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Tidak ada kolom yang dapat diperbarui');
    }

    if (data.nomor_hp !== undefined) {
      if (data.nomor_hp === null || String(data.nomor_hp).trim() === '') {
        data.nomor_hp = null;
      } else {
        const hpStr = String(data.nomor_hp).trim();
        if (!/^[0-9+\-\s]{8,25}$/.test(hpStr)) {
          throw new BadRequestException('Format nomor HP siswa tidak valid (harus 8-25 digit/karakter angka)');
        }
        data.nomor_hp = hpStr;
      }
    }

    const updated = await this.prisma.master_siswa.update({
      where: { id: milik.id },
      data: { ...data, updated_at: new Date() },
    });
    return { ok: true, data: this.serialize(updated) };
  }
}

