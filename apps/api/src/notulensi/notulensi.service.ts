import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  NOTULENSI_KELOLA_KEY,
  FeatureAccessGuard,
  aksesDiizinkan,
  ROLE_ADMIN,
  KonfigurasiAkses,
  parseKonfigurasiAkses,
  rolesUser,
} from '../auth/feature-access.guard';

export interface PoinHasilRapat {
  id: string;
  teks: string;
  status: 'Belum' | 'Proses' | 'Selesai';
  pic?: string;
  tenggat?: string;
  keterangan?: string;
}

const VALID_STATUSES = ['Belum', 'Proses', 'Selesai'] as const;
type StatusTindakLanjut = (typeof VALID_STATUSES)[number];

function notulensiStatus(points: ReadonlyArray<{ status: StatusTindakLanjut }>): StatusTindakLanjut {
  if (!points.length) return 'Belum';
  if (points.every(point => point.status === 'Selesai')) return 'Selesai';
  if (points.every(point => point.status === 'Belum')) return 'Belum';
  return 'Proses';
}

function normalizeStatus(st?: string): StatusTindakLanjut {
  if (!st) return 'Belum';
  const clean = st.trim();
  const found = VALID_STATUSES.find(s => s.toLowerCase() === clean.toLowerCase());
  return found || 'Belum';
}

function parsePoinPoin(raw: any): PoinHasilRapat[] {
  if (!raw) return [];
  let arr: any[] = [];
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .filter(p => p && typeof p === 'object')
    .map((p, idx) => ({
      id: String(p.id || `p-${idx + 1}-${Date.now().toString(36)}`),
      teks: String(p.teks || p.poin || p.isi || '').trim(),
      status: normalizeStatus(p.status),
      pic: p.pic ? String(p.pic).trim() : undefined,
      tenggat: p.tenggat ? String(p.tenggat).trim() : undefined,
      keterangan: p.keterangan ? String(p.keterangan).trim() : undefined,
    }))
    .filter(p => p.teks.length > 0);
}

// Derive legacy records during reads too, so filters and statistics remain consistent.
const DERIVED_STATUS_SQL = `(SELECT CASE
  WHEN COUNT(*) = 0 THEN 'Belum'
  WHEN BOOL_AND(LOWER(BTRIM(COALESCE(point->>'status', ''))) = 'selesai') THEN 'Selesai'
  WHEN BOOL_OR(LOWER(BTRIM(COALESCE(point->>'status', ''))) IN ('proses', 'selesai')) THEN 'Proses'
  ELSE 'Belum' END
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(poin_poin) = 'array' THEN poin_poin ELSE '[]'::jsonb END) AS point
  WHERE jsonb_typeof(point) = 'object'
    AND BTRIM(COALESCE(NULLIF(point->>'teks', ''), NULLIF(point->>'poin', ''), point->>'isi', '')) <> '')`;

function formatRow(r: any) {
  let tgl = r.tanggal;
  if (tgl instanceof Date) {
    tgl = tgl.toISOString().slice(0, 10);
  } else if (typeof tgl === 'string') {
    tgl = tgl.slice(0, 10);
  }

  return {
    id: r.id ? String(r.id) : '',
    agenda: r.agenda || '',
    tanggal: tgl || '',
    waktu_mulai: r.waktu_mulai || '',
    waktu_selesai: r.waktu_selesai || '',
    lokasi: r.lokasi || '',
    pimpinan_rapat: r.pimpinan_rapat || '',
    notulis: r.notulis || '',
    peserta: r.peserta || '',
    poin_poin: parsePoinPoin(r.poin_poin),
    status: notulensiStatus(parsePoinPoin(r.poin_poin)),
    catatan: r.catatan || '',
    agenda_id: r.agenda_id ? String(r.agenda_id) : null,
    created_by: r.created_by || '',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

@Injectable()
export class NotulensiService {
  private readonly logger = new Logger(NotulensiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess: FeatureAccessGuard,
    private readonly audit?: AuditService,
  ) {}

  /**
   * Helper parsing ID numerik
   */
  private parseBigIntId(id: any, label = 'ID'): string {
    if (id === null || id === undefined || String(id).trim() === '') {
      throw new BadRequestException(`${label} wajib diisi`);
    }
    const s = String(id).trim();
    if (!/^\d+$/.test(s)) {
      throw new BadRequestException(`${label} harus berupa angka valid`);
    }
    return s;
  }

  /**
   * Validasi format tanggal YYYY-MM-DD
   */
  private parseDateOnly(d: any, label = 'Tanggal'): string {
    if (!d || typeof d !== 'string') throw new BadRequestException(`${label} wajib diisi`);
    const date = new Date(d);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Format ${label} tidak valid: ${d}`);
    }
    return d.slice(0, 10);
  }

  /**
   * Memeriksa apakah user berhak mengelola Notulensi Rapat
   */
  async bolehKelola(user: any): Promise<boolean> {
    const konfig = await this.featureAccess.bacaKonfigurasi(NOTULENSI_KELOLA_KEY);
    return aksesDiizinkan(user, konfig, []);
  }

  /**
   * Status hak akses pemanggil untuk UI
   */
  async getIzinSaya(user: any) {
    const roles = rolesUser(user);
    const isAdmin = roles.some(r => ROLE_ADMIN.includes(r));
    const bolehKelola = await this.bolehKelola(user);
    return {
      success: true,
      data: {
        bolehKelola,
        isAdmin,
      },
    };
  }

  /**
   * Mengambil daftar notulensi dengan filter
   */
  async getList(query: { search?: string; status?: string; bulan?: string; tahun?: string; tanggal?: string; limit?: string; offset?: string }) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (query.status && query.status.trim() && query.status !== 'Semua') {
      conditions.push(`${DERIVED_STATUS_SQL} = $${pIdx}`);
      params.push(normalizeStatus(query.status));
      pIdx++;
    }

    if (query.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(query.tanggal.trim())) {
      conditions.push(`TO_CHAR(tanggal, 'YYYY-MM-DD') = $${pIdx}`);
      params.push(query.tanggal.trim());
      pIdx++;
    } else if (query.bulan && /^\d{4}-\d{2}$/.test(query.bulan.trim())) {
      const ym = query.bulan.trim();
      conditions.push(`TO_CHAR(tanggal, 'YYYY-MM') = $${pIdx}`);
      params.push(ym);
      pIdx++;
    } else if (query.tahun && /^\d{4}$/.test(query.tahun.trim())) {
      conditions.push(`TO_CHAR(tanggal, 'YYYY') = $${pIdx}`);
      params.push(query.tahun.trim());
      pIdx++;
    }

    if (query.search && query.search.trim()) {
      const q = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(agenda) LIKE $${pIdx} OR 
        LOWER(COALESCE(pimpinan_rapat, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(notulis, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(lokasi, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(catatan, '')) LIKE $${pIdx} OR
        LOWER(poin_poin::text) LIKE $${pIdx}
      )`);
      params.push(q);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Hitung statistik keseluruhan (agregat)
    const statsSql = `
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE ${DERIVED_STATUS_SQL} = 'Belum')::int as belum,
        COUNT(*) FILTER (WHERE ${DERIVED_STATUS_SQL} = 'Proses')::int as proses,
        COUNT(*) FILTER (WHERE ${DERIVED_STATUS_SQL} = 'Selesai')::int as selesai
      FROM public.notulensi_rapat
    `;
    const statsRows: any[] = await this.prisma.$queryRawUnsafe(statsSql);
    const stats = statsRows[0] || { total: 0, belum: 0, proses: 0, selesai: 0 };

    // Query data dengan pagination
    const limit = Math.min(Math.max(Number.parseInt(query.limit || '100', 10), 1), 500);
    const offset = Math.max(Number.parseInt(query.offset || '0', 10), 0);

    const listSql = `
      SELECT 
        id, agenda, tanggal, waktu_mulai, waktu_selesai, lokasi, 
        pimpinan_rapat, notulis, peserta, poin_poin, status, catatan, 
        agenda_id, created_by, created_at, updated_at
      FROM public.notulensi_rapat
      WHERE ${whereClause}
      ORDER BY tanggal DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(listSql, ...params);
    const data = rows.map(formatRow);

    return {
      success: true,
      data,
      stats: {
        total: stats.total || 0,
        belum: stats.belum || 0,
        proses: stats.proses || 0,
        selesai: stats.selesai || 0,
      },
    };
  }

  /**
   * Detail satu notulensi
   */
  async getDetail(id: string) {
    const cleanId = this.parseBigIntId(id);
    const sql = `
      SELECT 
        id, agenda, tanggal, waktu_mulai, waktu_selesai, lokasi, 
        pimpinan_rapat, notulis, peserta, poin_poin, status, catatan, 
        agenda_id, created_by, created_at, updated_at
      FROM public.notulensi_rapat
      WHERE id = $1::bigint
      LIMIT 1
    `;
    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, cleanId);
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Notulensi rapat tidak ditemukan');
    }
    return {
      success: true,
      data: formatRow(rows[0]),
    };
  }

  /**
   * Tambah notulensi baru
   */
  async create(body: any, user: any, req?: any) {
    const agenda = String(body.agenda || '').trim();
    if (!agenda) throw new BadRequestException('Agenda / Judul Rapat wajib diisi');

    const tanggal = this.parseDateOnly(body.tanggal, 'Tanggal Rapat');
    const waktuMulai = body.waktu_mulai ? String(body.waktu_mulai).trim().slice(0, 20) : null;
    const waktuSelesai = body.waktu_selesai ? String(body.waktu_selesai).trim().slice(0, 20) : null;
    const lokasi = body.lokasi ? String(body.lokasi).trim().slice(0, 255) : null;
    const pimpinanRapat = body.pimpinan_rapat ? String(body.pimpinan_rapat).trim().slice(0, 255) : null;
    const notulis = body.notulis ? String(body.notulis).trim().slice(0, 255) : null;
    const peserta = body.peserta ? String(body.peserta).trim() : null;
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const agendaId = body.agenda_id ? this.parseBigIntId(body.agenda_id) : null;

    const poinPoin = parsePoinPoin(body.poin_poin);

    const status = notulensiStatus(poinPoin);

    const createdBy = user?.nama || user?.username || user?.nip || 'Admin';

    const insertSql = `
      INSERT INTO public.notulensi_rapat (
        agenda, tanggal, waktu_mulai, waktu_selesai, lokasi,
        pimpinan_rapat, notulis, peserta, poin_poin, status,
        catatan, agenda_id, created_by, created_at, updated_at
      ) VALUES (
        $1, $2::date, $3, $4, $5,
        $6, $7, $8, $9::jsonb, $10,
        $11, $12::bigint, $13, NOW(), NOW()
      )
      RETURNING *
    `;

    const inserted: any[] = await this.prisma.$queryRawUnsafe(
      insertSql,
      agenda,
      tanggal,
      waktuMulai,
      waktuSelesai,
      lokasi,
      pimpinanRapat,
      notulis,
      peserta,
      JSON.stringify(poinPoin),
      status,
      catatan,
      agendaId,
      createdBy,
    );

    const result = formatRow(inserted[0]);

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'CREATE_NOTULENSI_RAPAT',
        entity: 'notulensi_rapat',
        entityId: result.id,
        details: { agenda: result.agenda, tanggal: result.tanggal, status: result.status, jumlah_poin: poinPoin.length },
      });
    }

    return { success: true, data: result };
  }

  /**
   * Perbarui notulensi rapat
   */
  async update(id: string, body: any, user: any, req?: any) {
    const cleanId = this.parseBigIntId(id);

    const agenda = String(body.agenda || '').trim();
    if (!agenda) throw new BadRequestException('Agenda / Judul Rapat wajib diisi');

    const tanggal = this.parseDateOnly(body.tanggal, 'Tanggal Rapat');
    const waktuMulai = body.waktu_mulai ? String(body.waktu_mulai).trim().slice(0, 20) : null;
    const waktuSelesai = body.waktu_selesai ? String(body.waktu_selesai).trim().slice(0, 20) : null;
    const lokasi = body.lokasi ? String(body.lokasi).trim().slice(0, 255) : null;
    const pimpinanRapat = body.pimpinan_rapat ? String(body.pimpinan_rapat).trim().slice(0, 255) : null;
    const notulis = body.notulis ? String(body.notulis).trim().slice(0, 255) : null;
    const peserta = body.peserta ? String(body.peserta).trim() : null;
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const agendaId = body.agenda_id ? this.parseBigIntId(body.agenda_id) : null;

    const poinPoin = parsePoinPoin(body.poin_poin);
    const status = notulensiStatus(poinPoin);

    const updateSql = `
      UPDATE public.notulensi_rapat SET
        agenda = $1,
        tanggal = $2::date,
        waktu_mulai = $3,
        waktu_selesai = $4,
        lokasi = $5,
        pimpinan_rapat = $6,
        notulis = $7,
        peserta = $8,
        poin_poin = $9::jsonb,
        status = $10,
        catatan = $11,
        agenda_id = $12::bigint,
        updated_at = NOW()
      WHERE id = $13::bigint
      RETURNING *
    `;

    const updated: any[] = await this.prisma.$queryRawUnsafe(
      updateSql,
      agenda,
      tanggal,
      waktuMulai,
      waktuSelesai,
      lokasi,
      pimpinanRapat,
      notulis,
      peserta,
      JSON.stringify(poinPoin),
      status,
      catatan,
      agendaId,
      cleanId,
    );

    if (!updated || updated.length === 0) {
      throw new NotFoundException('Notulensi rapat tidak ditemukan');
    }

    const result = formatRow(updated[0]);

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPDATE_NOTULENSI_RAPAT',
        entity: 'notulensi_rapat',
        entityId: result.id,
        details: { agenda: result.agenda, tanggal: result.tanggal, status: result.status },
      });
    }

    return { success: true, data: result };
  }

  /**
   * Update point progress; overall status always follows the points.
   */
  async updateStatus(id: string, body: { status?: string; poin_id?: string; poin_status?: string; keterangan?: string }, user: any, req?: any) {
    const cleanId = this.parseBigIntId(id);

    const result = await this.prisma.$transaction(async tx => {
      const checkSql = `SELECT * FROM public.notulensi_rapat WHERE id = $1::bigint LIMIT 1 FOR UPDATE`;
      const existing: any[] = await tx.$queryRawUnsafe(checkSql, cleanId);
      if (!existing || existing.length === 0) {
        throw new NotFoundException('Notulensi rapat tidak ditemukan');
      }

      const row = existing[0];
      let poinPoin = parsePoinPoin(row.poin_poin);


      // Jika targetnya adalah update poin tertentu
      if (body.poin_id && body.poin_status) {
        const targetPoinId = String(body.poin_id).trim();
        if (!poinPoin.some(p => p.id === targetPoinId)) throw new NotFoundException('Poin rapat tidak ditemukan');
        if (!VALID_STATUSES.includes(body.poin_status as StatusTindakLanjut)) throw new BadRequestException('Status poin tidak valid');
        const nextPoinStatus = normalizeStatus(body.poin_status);

        poinPoin = poinPoin.map(p => {
          if (p.id === targetPoinId) {
            return {
              ...p,
              status: nextPoinStatus,
              keterangan: body.keterangan !== undefined ? String(body.keterangan).trim() : p.keterangan,
            };
          }
          return p;
        });

      } else {
        throw new BadRequestException('Ubah status pada poin rapat. Status keseluruhan dihitung otomatis.');
      }
      const newStatus = notulensiStatus(poinPoin);

      const updateSql = `
        UPDATE public.notulensi_rapat SET
          status = $1,
          poin_poin = $2::jsonb,
          updated_at = NOW()
        WHERE id = $3::bigint
        RETURNING *
      `;

      const updated: any[] = await tx.$queryRawUnsafe(
        updateSql,
        newStatus,
        JSON.stringify(poinPoin),
        cleanId,
      );

      return formatRow(updated[0]);

    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPDATE_STATUS_NOTULENSI',
        entity: 'notulensi_rapat',
        entityId: result.id,
        details: { status: result.status, poin_id: body.poin_id, poin_status: body.poin_status },
      });
    }

    return { success: true, data: result };
  }

  /**
   * Hapus notulensi rapat
   */
  async delete(id: string, user: any, req?: any) {
    const cleanId = this.parseBigIntId(id);

    const checkSql = `SELECT id, agenda FROM public.notulensi_rapat WHERE id = $1::bigint LIMIT 1`;
    const existing: any[] = await this.prisma.$queryRawUnsafe(checkSql, cleanId);
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Notulensi rapat tidak ditemukan');
    }

    const deleteSql = `DELETE FROM public.notulensi_rapat WHERE id = $1::bigint`;
    await this.prisma.$executeRawUnsafe(deleteSql, cleanId);

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_NOTULENSI_RAPAT',
        entity: 'notulensi_rapat',
        entityId: cleanId,
        details: { agenda: existing[0].agenda },
      });
    }

    return { success: true };
  }

  /**
   * Ambil konfigurasi hak akses dari site_settings
   */
  async getPengaturan() {
    const konfig = await this.featureAccess.bacaKonfigurasi(NOTULENSI_KELOLA_KEY);
    return {
      success: true,
      data: konfig,
    };
  }

  /**
   * Simpan konfigurasi hak akses ke site_settings (hanya ADMIN)
   */
  async updatePengaturan(body: any, user: any, req?: any) {
    const roles = rolesUser(user);
    const isAdmin = roles.some(r => ROLE_ADMIN.includes(r));
    if (!isAdmin) {
      throw new ForbiddenException('Hanya Administrator yang berwenang mengubah pengaturan hak akses modul ini.');
    }

    const current = parseKonfigurasiAkses(body);
    const defaults = [...ROLE_ADMIN];
    const mergedRoles = Array.from(new Set([...defaults, ...(current.allowedRoles || [])]));

    const payloadValue: KonfigurasiAkses = {
      allowedRoles: mergedRoles,
      allowedUsers: current.allowedUsers || [],
    };

    const valStr = JSON.stringify(payloadValue);

    await this.prisma.site_settings.upsert({
      where: { key: NOTULENSI_KELOLA_KEY },
      create: {
        key: NOTULENSI_KELOLA_KEY,
        label: 'Hak Akses Notulensi Rapat',
        description: 'Daftar role dan pengguna yang berwenang mengelola (CRUD) Notulensi Rapat',
        value: valStr,
      },
      update: {
        value: valStr,
        updated_at: new Date(),
      },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPDATE_PENGATURAN_NOTULENSI',
        entity: 'site_settings',
        entityId: NOTULENSI_KELOLA_KEY,
        details: payloadValue,
      });
    }

    return {
      success: true,
      data: payloadValue,
    };
  }

  /**
   * Mengambil daftar master guru & staf (serta siswa) untuk pilihan peserta, pimpinan, notulis, dan PIC.
   */
  async getPesertaOptions() {
    const [pegawai, siswa] = await Promise.all([
      this.prisma.master_guru.findMany({
        where: { aktif: true },
        select: {
          nip: true,
          nama_lengkap: true,
          jenis_pegawai: true,
        },
        orderBy: {
          nama_lengkap: 'asc',
        },
      }),
      this.prisma.master_siswa.findMany({
        where: { aktif: true },
        select: {
          nisn: true,
          nama_lengkap: true,
        },
        orderBy: {
          nama_lengkap: 'asc',
        },
      }),
    ]);

    const guruList = pegawai
      .filter(p => !p.jenis_pegawai || p.jenis_pegawai.toUpperCase() !== 'TENDIK')
      .map(p => ({
        nip: p.nip,
        nama: p.nama_lengkap,
        jenis: 'Guru' as const,
      }));

    const stafList = pegawai
      .filter(p => p.jenis_pegawai && p.jenis_pegawai.toUpperCase() === 'TENDIK')
      .map(p => ({
        nip: p.nip,
        nama: p.nama_lengkap,
        jenis: 'Tendik / Staf' as const,
      }));

    const siswaList = siswa.map(s => ({
      nisn: s.nisn,
      nama: s.nama_lengkap,
      jenis: 'Siswa' as const,
    }));

    return {
      success: true,
      data: {
        guru: guruList,
        staf: stafList,
        semuaPegawai: [...guruList, ...stafList],
        siswa: siswaList,
      },
    };
  }
}

