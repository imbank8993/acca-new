import { aksesDiizinkan, parseKonfigurasiAkses, rolesUser } from '../auth/feature-access.guard';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JadwalService } from '../jadwal/jadwal.service';
import { StorageService } from '../common/storage.service';
import {
  bakukanMentah,
  bulatkan,
  hitungHasil,
  indikatorDinilai,
  konversiNilai,
  normalisasiSkala,
  parseConfig,
} from './penilaian';

/** Kunci "Hak Akses Fitur" pengelola E-Supervisi (dokumen, indikator, penugasan). */
export const SUPERVISI_KELOLA_KEY = 'supervisi_access_config';
/** Peran yang melekat di kode sebagai pengelola. */
export const PERAN_KELOLA_SUPERVISI = ['WKM_AKADEMIK', 'WAKAMAD_KURIKULUM'];
/** Peran pimpinan yang boleh MELIHAT seluruh hasil (tanpa mengubah pengaturan). */
export const PERAN_PANTAU_SUPERVISI = ['KAMAD', 'KEPALA_MADRASAH', 'PENGAWAS_MADRASAH'];

const STATUS_PENUGASAN = ['aktif', 'terkunci'];
const MAKS_CATATAN = 2000;
const MAKS_SKOR_PER_SIMPAN = 500;

export interface AksesSupervisi {
  /** Mengelola dokumen, indikator, penugasan, dan kunci nilai. */
  kelola: boolean;
  /** Melihat seluruh penugasan & hasil (pengelola + pimpinan). */
  pantau: boolean;
  /** ADMIN / ADMINISTRATOR. */
  admin: boolean;
  nip: string;
}

const toInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const teks = (v: unknown, maks = 500): string => String(v ?? '').trim().slice(0, maks);

@Injectable()
export class ESupervisiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jadwalService: JadwalService,
    private readonly storageService: StorageService,
  ) {}

  private getTodayTz(): string {
    // Format en-CA = YYYY-MM-DD. Zona madrasah (WITA).
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  }

  // --- Hak akses -------------------------------------------------------------

  async akses(user: any): Promise<AksesSupervisi> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: SUPERVISI_KELOLA_KEY },
      select: { value: true },
    });
    const roles = rolesUser(user);
    const admin = roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
    const kelola = aksesDiizinkan(user, parseKonfigurasiAkses(row?.value ?? null), PERAN_KELOLA_SUPERVISI);
    const pantau = kelola || roles.some((r) => PERAN_PANTAU_SUPERVISI.includes(r));
    return { kelola, pantau, admin, nip: String(user?.nip || '').trim() };
  }

  /** Boleh melihat data (nilai/unggahan) milik sebuah penugasan? */
  private bolehLihatPenugasan(a: AksesSupervisi, p: { guru_nip: string; supervisor_nip: string }) {
    return a.pantau || (!!a.nip && (p.supervisor_nip === a.nip || p.guru_nip === a.nip));
  }

  /** Boleh memberi/mengubah nilai sebuah penugasan? */
  private bolehMenilai(a: AksesSupervisi, p: { guru_nip: string; supervisor_nip: string }) {
    if (a.admin) return true;
    return !!a.nip && p.supervisor_nip === a.nip && p.guru_nip !== a.nip;
  }

  private async dokumenTa(tahun_ajaran_id: number | bigint) {
    return this.prisma.sv_master_dokumen.findMany({
      where: { tahun_ajaran_id: BigInt(tahun_ajaran_id), aktif: true },
      orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
      select: {
        id: true, tahap: true, nama_dokumen: true, aktif: true, butuh_dokumen: true, urutan: true,
        sv_indikator: {
          where: { aktif: true },
          orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
          select: { id: true, nama_indikator: true, skala_config: true, aktif: true, urutan: true },
        },
      },
    });
  }

  // --- Dokumen & indikator ---------------------------------------------------

  async getDokumen(tahap?: string, tahun_ajaran_id?: number) {
    const where: any = { aktif: true };
    if (tahap) where.tahap = tahap;
    if (tahun_ajaran_id) where.tahun_ajaran_id = tahun_ajaran_id;

    const data = await this.prisma.sv_master_dokumen.findMany({
      where,
      include: {
        sv_indikator: {
          where: { aktif: true },
          orderBy: { urutan: 'asc' },
        },
      },
      orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
    });

    const transformedData = data.map((doc: any) => {
      const indikators = (doc.sv_indikator || []).map((ind: any) => ({ ...ind, skala_config: parseConfig(ind.skala_config) }));
      const byUrut = (a: any, b: any) => (a.urutan || 0) - (b.urutan || 0) || a.id - b.id;
      const parents = indikators.filter((ind: any) => !ind.skala_config?.parent_id).sort(byUrut);
      const subs = indikators.filter((ind: any) => ind.skala_config?.parent_id).sort(byUrut);
      parents.forEach((p: any) => {
        p.sub_indikators = subs.filter((s: any) => Number(s.skala_config.parent_id) === p.id);
      });
      const { sv_indikator, ...rest } = doc;
      return { ...rest, indikators: parents };
    });

    return { ok: true, data: transformedData };
  }

  async upsertDokumen(body: any) {
    const id = body?.id ? toInt(body.id) : null;
    if (body?.id && !id) throw new BadRequestException('ID dokumen tidak valid');
    const tahun_ajaran_id = toInt(body?.tahun_ajaran_id);
    if (!tahun_ajaran_id) throw new BadRequestException('Tahun ajaran wajib dipilih');
    const tahap = teks(body?.tahap, 100);
    const nama_dokumen = teks(body?.nama_dokumen, 200);
    if (!tahap) throw new BadRequestException('Tahap penilaian wajib diisi');
    if (!nama_dokumen) throw new BadRequestException('Nama dokumen wajib diisi');

    const ta = await this.prisma.master_tahun_ajaran.findUnique({ where: { id: BigInt(tahun_ajaran_id) }, select: { id: true } });
    if (!ta) throw new BadRequestException('Tahun ajaran tidak ditemukan');

    // Validasi seluruh indikator SEBELUM menulis apa pun.
    const indikators: any[] = Array.isArray(body?.indikators) ? body.indikators : [];
    const siapkan = (ind: any, label: string) => {
      const nama = teks(ind?.nama_indikator, 500);
      if (!nama) throw new BadRequestException(`${label}: nama indikator wajib diisi`);
      const skala = normalisasiSkala(ind?.skala_config);
      if (typeof skala === 'string') throw new BadRequestException(`${label} (${nama}): ${skala}`);
      const indId = ind?.id ? toInt(ind.id) : null;
      if (ind?.id && !indId) throw new BadRequestException(`${label}: ID indikator tidak valid`);
      return { id: indId, nama_indikator: nama, deskripsi: teks(ind?.deskripsi, 1000) || null, skala, urutan: Number(ind?.urutan) || 0 };
    };
    const rencana = indikators.map((ind, i) => {
      const induk = siapkan(ind, `Indikator ${i + 1}`);
      const subs = (Array.isArray(ind?.sub_indikators) ? ind.sub_indikators : []).map((s: any, j: number) => {
        const sub = siapkan(s, `Sub-indikator ${i + 1}.${j + 1}`);
        if (sub.skala.tipe === 'group') throw new BadRequestException(`Sub-indikator ${i + 1}.${j + 1}: sub-indikator harus memiliki skala penilaian`);
        return sub;
      });
      if (induk.skala.tipe === 'group' && subs.length === 0) {
        throw new BadRequestException(`Indikator ${i + 1} (${induk.nama_indikator}): tipe "Hanya Label" wajib memiliki sub-indikator`);
      }
      return { induk, subs };
    });

    const docData = {
      tahap,
      nama_dokumen,
      deskripsi: teks(body?.deskripsi, 2000) || null,
      urutan: Number(body?.urutan) || 0,
      aktif: true,
      butuh_dokumen: body?.butuh_dokumen !== undefined ? Boolean(body.butuh_dokumen) : true,
      tahun_ajaran_id: BigInt(tahun_ajaran_id),
    };

    await this.prisma.$transaction(async (tx: any) => {
      let docId = id;
      if (id) {
        const existing = await tx.sv_master_dokumen.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new NotFoundException('Dokumen tidak ditemukan');
        await tx.sv_master_dokumen.update({ where: { id }, data: docData });
      } else {
        const inserted = await tx.sv_master_dokumen.create({ data: docData });
        docId = inserted.id;
      }

      // Indikator yang sudah ada hanya boleh disunting lewat dokumennya sendiri.
      const milik = await tx.sv_indikator.findMany({ where: { dokumen_id: docId! }, select: { id: true } });
      const idMilik = new Set<number>(milik.map((m: any) => m.id));
      const dipertahankan = new Set<number>();

      const tulis = async (data: any, indId: number | null) => {
        if (indId && idMilik.has(indId)) {
          await tx.sv_indikator.update({ where: { id: indId }, data });
          dipertahankan.add(indId);
          return indId;
        }
        const created = await tx.sv_indikator.create({ data });
        dipertahankan.add(created.id);
        return created.id as number;
      };

      for (const { induk, subs } of rencana) {
        const parentId = await tulis({
          dokumen_id: docId!, nama_indikator: induk.nama_indikator, deskripsi: induk.deskripsi,
          skala_config: induk.skala, urutan: induk.urutan, aktif: true,
        }, induk.id);
        for (const sub of subs) {
          await tulis({
            dokumen_id: docId!, nama_indikator: sub.nama_indikator, deskripsi: sub.deskripsi,
            skala_config: { ...sub.skala, parent_id: parentId }, urutan: sub.urutan, aktif: true,
          }, sub.id);
        }
      }

      // Indikator yang dihapus dari formulir dinonaktifkan (bukan dihapus) agar
      // riwayat nilai lama tetap utuh, tetapi tidak lagi tampil maupun dihitung.
      const dibuang = [...idMilik].filter((x) => !dipertahankan.has(x));
      if (dibuang.length) {
        await tx.sv_indikator.updateMany({ where: { id: { in: dibuang } }, data: { aktif: false } });
      }
    });

    return { ok: true, message: 'Dokumen tersimpan' };
  }

  async deleteDokumen(rawId: unknown) {
    const id = toInt(rawId);
    if (!id) throw new BadRequestException('ID dokumen tidak valid');
    await this.prisma.sv_master_dokumen.update({ where: { id }, data: { aktif: false } });
    return { ok: true };
  }

  // --- Nilai -----------------------------------------------------------------

  async getNilai(user: any, rawPenugasanId: unknown) {
    const penugasan_id = toInt(rawPenugasanId);
    if (!penugasan_id) throw new BadRequestException('penugasan_id wajib diisi');
    const penugasan = await this.prisma.sv_penugasan.findUnique({ where: { id: penugasan_id } });
    if (!penugasan) throw new NotFoundException('Penugasan tidak ditemukan');
    const a = await this.akses(user);
    if (!this.bolehLihatPenugasan(a, penugasan)) {
      throw new ForbiddenException('Anda tidak berhak melihat nilai penugasan ini');
    }

    const data = await this.prisma.sv_rekam_nilai.findMany({
      where: { penugasan_id },
      include: { sv_indikator: { select: { nama_indikator: true } } },
    });
    // Riwayat indikator yang dinonaktifkan tetap disimpan, tetapi jangan
    // dimuat ke formulir lalu terkirim lagi saat autosave indikator aktif.
    const dokumens = await this.dokumenTa(penugasan.tahun_ajaran_id);
    const aktifIds = new Set(dokumens.flatMap((d: any) => d.sv_indikator.map((i: any) => i.id)));
    const mapped = data.filter((d: any) => aktifIds.has(d.indikator_id)).map((d: any) => {
      const { sv_indikator, ...rest } = d;
      return { ...rest, indikator: sv_indikator };
    });
    return { ok: true, data: mapped };
  }

  async upsertNilai(apiUser: any, body: any) {
    const penugasan_id = toInt(body?.penugasan_id);
    const scores = body?.scores;
    if (!penugasan_id || !Array.isArray(scores)) throw new BadRequestException('Data penilaian tidak lengkap');
    if (scores.length > MAKS_SKOR_PER_SIMPAN) throw new BadRequestException('Terlalu banyak skor dalam satu penyimpanan');

    const penugasan = await this.prisma.sv_penugasan.findUnique({ where: { id: penugasan_id } });
    if (!penugasan) throw new NotFoundException('Penugasan tidak ditemukan');

    const a = await this.akses(apiUser);
    if (!this.bolehMenilai(a, penugasan)) {
      throw new ForbiddenException('Anda tidak berhak mengubah nilai untuk penugasan ini');
    }
    if (penugasan.status === 'terkunci') {
      throw new ForbiddenException('Nilai penugasan ini sudah dikunci. Minta pengelola membuka kunci terlebih dahulu.');
    }

    // Hanya indikator aktif milik tahun ajaran penugasan ini yang boleh diisi.
    const dokumens = await this.dokumenTa(penugasan.tahun_ajaran_id);
    const dinilai = indikatorDinilai(dokumens);
    const semuaAktif = new Map<number, string>();
    dokumens.forEach((d: any) => d.sv_indikator.forEach((i: any) => semuaAktif.set(i.id, i.nama_indikator)));

    const scored_by = a.nip || String(apiUser?.id || '');
    const rows: any[] = [];
    for (const score of scores) {
      const indikator_id = toInt(score?.indikator_id);
      if (!indikator_id || !semuaAktif.has(indikator_id)) {
        throw new BadRequestException('Indikator tidak termasuk instrumen tahun ajaran ini atau sudah dihapus');
      }
      const mentahInput = String(score?.nilai_mentah ?? '').trim();
      const catatan = teks(score?.catatan, MAKS_CATATAN) || null;
      let nilai_mentah: string | null = null;
      let nilai_konversi: number | null = null;

      if (mentahInput) {
        const ind = dinilai.get(indikator_id);
        if (!ind) throw new BadRequestException(`Indikator "${semuaAktif.get(indikator_id)}" tidak diberi skor (hanya label/induk)`);
        nilai_mentah = bakukanMentah(ind.config, mentahInput);
        nilai_konversi = konversiNilai(ind.config, mentahInput);
        if (nilai_mentah === null || nilai_konversi === null) {
          throw new BadRequestException(`Skor "${mentahInput}" tidak sah untuk indikator "${ind.nama_indikator}"`);
        }
      }

      rows.push({ penugasan_id, indikator_id, nilai_mentah, nilai_konversi, catatan, scored_by, scored_at: new Date() });
    }

    if (rows.length) {
      await this.prisma.$transaction(rows.map((r) => this.prisma.sv_rekam_nilai.upsert({
        where: { penugasan_id_indikator_id: { penugasan_id: r.penugasan_id, indikator_id: r.indikator_id } },
        update: r,
        create: r,
      })));
    }

    return { ok: true, message: 'Nilai tersimpan' };
  }

  // --- Penugasan -------------------------------------------------------------

  async getPenugasan(user: any, tahun_ajaran_id?: number, supervisor_nip?: string, guru_nip?: string) {
    const a = await this.akses(user);
    const where: any = {};
    if (tahun_ajaran_id) where.tahun_ajaran_id = tahun_ajaran_id;
    if (supervisor_nip) where.supervisor_nip = supervisor_nip;
    if (guru_nip) where.guru_nip = guru_nip;
    if (!a.pantau) {
      // Guru/supervisor biasa hanya melihat penugasan yang melibatkan dirinya.
      if (!a.nip) return { ok: true, data: [] };
      where.AND = [{ OR: [{ supervisor_nip: a.nip }, { guru_nip: a.nip }] }];
    }

    const penugasan = await this.prisma.sv_penugasan.findMany({ where, orderBy: { id: 'asc' } });

    const nips = [...new Set([...penugasan.map((p: any) => p.guru_nip), ...penugasan.map((p: any) => p.supervisor_nip)])];
    const nipFilter = nips.length ? nips : [''];
    const penugasanIds = penugasan.map((p: any) => p.id);
    const taIds = [...new Set(penugasan.map((p: any) => String(p.tahun_ajaran_id)))];

    const [gurus, allScores, dinilaiPerTa] = await Promise.all([
      this.prisma.master_guru.findMany({
        where: { nip: { in: nipFilter } },
        select: { nip: true, nama_lengkap: true },
      }),
      this.prisma.sv_rekam_nilai.findMany({
        where: { penugasan_id: { in: penugasanIds.length ? penugasanIds : [-1] } },
        select: { penugasan_id: true, indikator_id: true, nilai_mentah: true },
      }),
      Promise.all(taIds.map(async (ta) => [ta, indikatorDinilai(await this.dokumenTa(BigInt(ta)))] as const)),
    ]);
    const dinilaiMap = new Map(dinilaiPerTa);

    const { data: jadwalRows } = await this.jadwalService.getJadwal({ valid_date: this.getTodayTz() });
    const guruMap: Record<string, string> = {};
    gurus.forEach((g: any) => { if (g.nip) guruMap[g.nip] = g.nama_lengkap || g.nip; });
    const jadwalMap = this.petaJadwal(jadwalRows, nipFilter);

    const enrichedData = penugasan.map((p: any) => {
      const j = jadwalMap[p.guru_nip];
      const hasil = hitungHasil(dinilaiMap.get(String(p.tahun_ajaran_id)) || new Map(), allScores.filter((s: any) => s.penugasan_id === p.id));
      return {
        ...p,
        guru_nama: guruMap[p.guru_nip] || p.guru_nip,
        supervisor_nama: guruMap[p.supervisor_nip] || p.supervisor_nip,
        guru_mapel: j && j.mapel.size > 0 ? Array.from(j.mapel).join(', ') : '-',
        guru_kelas: j && j.kelas.size > 0 ? Array.from(j.kelas).sort().join(', ') : '-',
        progres: hasil.progres,
      };
    });

    return { ok: true, data: enrichedData };
  }

  private petaJadwal(jadwalRows: any[], nipFilter: string[]) {
    const jadwalMap: Record<string, { mapel: Set<string>; kelas: Set<string> }> = {};
    (jadwalRows || []).forEach((j: any) => {
      const nip = String(j.nip || '');
      if (nipFilter.includes(nip)) {
        if (!jadwalMap[nip]) jadwalMap[nip] = { mapel: new Set(), kelas: new Set() };
        if (j.mata_pelajaran) jadwalMap[nip].mapel.add(String(j.mata_pelajaran).trim());
        if (j.kelas) jadwalMap[nip].kelas.add(String(j.kelas).trim());
      }
    });
    return jadwalMap;
  }

  async upsertPenugasan(body: any) {
    const guru_nip = teks(body?.guru_nip, 50);
    const supervisor_nip = teks(body?.supervisor_nip, 50);
    const tahun_ajaran_id = toInt(body?.tahun_ajaran_id);
    // Tanpa pemeriksaan ini, guru_nip kosong membuat `findFirst` mengabaikan
    // filternya dan mengubah supervisor penugasan acak milik guru lain.
    if (!guru_nip || !supervisor_nip || !tahun_ajaran_id) {
      throw new BadRequestException('Guru, supervisor, dan tahun ajaran wajib diisi');
    }
    if (guru_nip === supervisor_nip) throw new BadRequestException('Supervisor tidak boleh menilai dirinya sendiri');

    const [guru, supervisor] = await Promise.all([
      this.prisma.master_guru.findFirst({ where: { nip: guru_nip }, select: { nip: true } }),
      this.prisma.public_users.findFirst({ where: { nip: supervisor_nip, aktif: true }, select: { nip: true } }),
    ]);
    if (!guru) throw new BadRequestException(`Guru dengan NIP ${guru_nip} tidak ditemukan di master guru`);
    if (!supervisor) throw new BadRequestException(`Supervisor dengan NIP ${supervisor_nip} tidak ditemukan atau tidak aktif`);

    const existing = await this.prisma.sv_penugasan.findFirst({
      where: { guru_nip, tahun_ajaran_id: BigInt(tahun_ajaran_id) },
    });

    if (existing) {
      if (existing.supervisor_nip === supervisor_nip) return { ok: true, data: existing };
      if (existing.status === 'terkunci') {
        throw new BadRequestException('Penugasan guru ini sudah dikunci; buka kunci sebelum mengganti supervisor');
      }
      const data = await this.prisma.sv_penugasan.update({ where: { id: existing.id }, data: { supervisor_nip } });
      return { ok: true, data };
    }
    const data = await this.prisma.sv_penugasan.create({
      data: { guru_nip, supervisor_nip, tahun_ajaran_id: BigInt(tahun_ajaran_id), status: 'aktif' },
    });
    return { ok: true, data };
  }

  async deletePenugasan(rawId: unknown) {
    const id = toInt(rawId);
    if (!id) throw new BadRequestException('ID penugasan tidak valid');
    const existing = await this.prisma.sv_penugasan.findUnique({ where: { id } });
    if (!existing) return { ok: true };
    if (existing.status === 'terkunci') {
      throw new BadRequestException('Penugasan yang nilainya sudah dikunci tidak dapat dihapus. Buka kunci terlebih dahulu.');
    }
    await this.prisma.sv_penugasan.delete({ where: { id } });
    return { ok: true };
  }

  async updateStatusPenugasan(apiUser: any, body: any) {
    const id = toInt(body?.id);
    const status = String(body?.status || '').trim();
    if (!id || !STATUS_PENUGASAN.includes(status)) {
      throw new BadRequestException('ID dan status (aktif/terkunci) wajib diisi');
    }
    const penugasan = await this.prisma.sv_penugasan.findUnique({ where: { id } });
    if (!penugasan) throw new NotFoundException('Penugasan tidak ditemukan');

    const a = await this.akses(apiUser);
    // Supervisor boleh MENGUNCI (memfinalkan) nilainya sendiri; membuka kunci
    // hanya pengelola agar nilai final tidak diubah diam-diam.
    const bolehKunci = a.kelola || this.bolehMenilai(a, penugasan);
    if (status === 'terkunci' ? !bolehKunci : !a.kelola) {
      throw new ForbiddenException(status === 'terkunci'
        ? 'Anda tidak berhak mengunci penugasan ini'
        : 'Hanya pengelola E-Supervisi yang dapat membuka kunci nilai');
    }

    await this.prisma.sv_penugasan.update({ where: { id }, data: { status } });
    return { ok: true, message: status === 'terkunci' ? 'Nilai dikunci' : 'Kunci nilai dibuka' };
  }

  // --- Rekap & laporan -------------------------------------------------------

  async getRekap(user: any, rawTa: unknown) {
    const tahun_ajaran_id = toInt(rawTa);
    if (!tahun_ajaran_id) throw new BadRequestException('tahun_ajaran_id wajib diisi');
    const a = await this.akses(user);

    const where: any = { tahun_ajaran_id: BigInt(tahun_ajaran_id) };
    if (!a.pantau) {
      if (!a.nip) return { ok: true, data: [], stages: [], indikator_stats: [], profil_sekolah: null, tahun_ajaran: null, akses: a };
      where.OR = [{ supervisor_nip: a.nip }, { guru_nip: a.nip }];
    }
    const penugasans = await this.prisma.sv_penugasan.findMany({ where, orderBy: { id: 'asc' } });

    const penugasanIds = penugasans.map((p: any) => p.id);
    const nips = [...new Set([...penugasans.map((p: any) => p.guru_nip), ...penugasans.map((p: any) => p.supervisor_nip)])];
    const nipFilter = nips.length ? nips : [''];

    const [dokumens, nilais, profil_sekolah, gurus, tahun_ajaran] = await Promise.all([
      this.dokumenTa(tahun_ajaran_id),
      this.prisma.sv_rekam_nilai.findMany({
        where: { penugasan_id: { in: penugasanIds.length ? penugasanIds : [-1] } },
        select: { penugasan_id: true, indikator_id: true, nilai_mentah: true },
      }),
      this.prisma.profil_sekolah.findFirst(),
      this.prisma.master_guru.findMany({
        where: { nip: { in: nipFilter } },
        select: { nip: true, nama_lengkap: true },
      }),
      this.prisma.master_tahun_ajaran.findUnique({ where: { id: BigInt(tahun_ajaran_id) } }),
    ]);

    const dinilai = indikatorDinilai(dokumens);
    const stages: string[] = Array.from(new Set(dokumens.map((d: any) => String(d.tahap))));
    const { data: jadwalRows } = await this.jadwalService.getJadwal({ valid_date: this.getTodayTz() });
    const jadwalMap = this.petaJadwal(jadwalRows, nipFilter);
    const guruMap: Record<string, string> = {};
    gurus.forEach((g: any) => { if (g.nip) guruMap[g.nip] = g.nama_lengkap || g.nip; });

    const recap = penugasans.map((p: any) => {
      const hasil = hitungHasil(dinilai, nilais.filter((n: any) => n.penugasan_id === p.id), stages);
      const nilai: Record<string, string | null> = {};
      stages.forEach((t) => { nilai[t] = hasil.per_tahap[t] === null ? null : (hasil.per_tahap[t] as number).toFixed(2); });
      return {
        ...p,
        guru_nama: guruMap[p.guru_nip] || p.guru_nip,
        supervisor_nama: guruMap[p.supervisor_nip] || p.supervisor_nip,
        guru_mapel: jadwalMap[p.guru_nip]?.mapel ? Array.from(jadwalMap[p.guru_nip].mapel).join(', ') : '',
        guru_kelas: jadwalMap[p.guru_nip]?.kelas ? Array.from(jadwalMap[p.guru_nip].kelas).sort().join(', ') : '',
        progres: hasil.progres,
        jumlah_dinilai: hasil.dinilai,
        jumlah_indikator: hasil.total,
        nilai: {
          ...nilai,
          rata_rata: hasil.rata_rata === null ? null : hasil.rata_rata.toFixed(2),
          predikat: hasil.predikat,
        },
      };
    });

    // Rata-rata per indikator untuk bagian analisis & tindak lanjut laporan.
    const kumpul = new Map<number, number[]>();
    for (const n of nilais as any[]) {
      const ind = dinilai.get(n.indikator_id);
      if (!ind) continue;
      const v = konversiNilai(ind.config, n.nilai_mentah);
      if (v === null) continue;
      if (!kumpul.has(ind.id)) kumpul.set(ind.id, []);
      kumpul.get(ind.id)!.push(v);
    }
    const indikator_stats = Array.from(kumpul.entries()).map(([id, arr]) => {
      const ind = dinilai.get(id)!;
      return {
        indikator_id: id,
        nama_indikator: ind.nama_indikator,
        nama_dokumen: ind.nama_dokumen,
        tahap: ind.tahap,
        jumlah: arr.length,
        rata_rata: bulatkan(arr.reduce((x, y) => x + y, 0) / arr.length),
      };
    }).sort((x, y) => x.rata_rata - y.rata_rata);

    return { ok: true, data: recap, stages, indikator_stats, profil_sekolah, tahun_ajaran, akses: a };
  }

  async getSupervisorList() {
    const data = await this.prisma.public_users.findMany({
      where: { aktif: true },
      select: { id: true, nip: true, nama: true, nama_lengkap: true, role: true },
    });

    const supervisors = data
      .filter((u: any) => {
        if (!String(u.nip || '').trim() || u.nip === '-') return false;
        const roles = (u.role || '').toUpperCase().split(/[,|]/).map((r: string) => r.trim());
        return ['SUPERVISOR', 'PENGAWAS MADRASAH', 'PENGAWAS_MADRASAH', 'GURU', 'KAMAD', 'KEPALA_MADRASAH', ...PERAN_KELOLA_SUPERVISI]
          .some((r) => roles.includes(r));
      })
      .map((u: any) => ({
        id: Number(u.id),
        nip: String(u.nip).trim(),
        nama_lengkap: u.nama_lengkap || u.nama || 'Tanpa Nama',
      }))
      .sort((x: any, y: any) => x.nama_lengkap.localeCompare(y.nama_lengkap, 'id'));

    return { ok: true, data: supervisors };
  }

  // --- Unggahan dokumen guru -------------------------------------------------

  async getUnggahan(user: any, guru_nip: string, rawTa: unknown) {
    const tahun_ajaran_id = toInt(rawTa);
    const nip = teks(guru_nip, 50);
    if (!nip || !tahun_ajaran_id) throw new BadRequestException('guru_nip dan tahun_ajaran_id wajib diisi');
    const a = await this.akses(user);
    if (!a.pantau && a.nip !== nip) {
      const supervisi = a.nip ? await this.prisma.sv_penugasan.findFirst({
        where: { guru_nip: nip, supervisor_nip: a.nip, tahun_ajaran_id: BigInt(tahun_ajaran_id) },
        select: { id: true },
      }) : null;
      if (!supervisi) throw new ForbiddenException('Anda tidak berhak melihat dokumen guru ini');
    }
    const data = await this.prisma.sv_unggahan_guru.findMany({
      where: { guru_nip: nip, tahun_ajaran_id: BigInt(tahun_ajaran_id) },
    });
    return { ok: true, data };
  }

  /** Penugasan guru pada tahun ajaran tsb sudah dikunci? Dokumen tidak boleh lagi diubah. */
  private async terkunciUntukGuru(guru_nip: string, tahun_ajaran_id: number | bigint) {
    const p = await this.prisma.sv_penugasan.findFirst({
      where: { guru_nip, tahun_ajaran_id: BigInt(tahun_ajaran_id), status: 'terkunci' },
      select: { id: true },
    });
    return !!p;
  }

  /**
   * Pemeriksaan sebelum berkas diunggah ke penyimpanan, supaya unggahan yang
   * pasti ditolak tidak sempat meninggalkan berkas yatim.
   */
  async cekUnggahan(body: any, user: any) {
    const guru_nip = teks(body?.guru_nip, 50);
    const tahun_ajaran_id = toInt(body?.tahun_ajaran_id);
    const dokumen_id = toInt(body?.dokumen_id);
    if (!guru_nip || !tahun_ajaran_id || !dokumen_id) throw new BadRequestException('Data unggahan tidak lengkap');
    if (!user?.nip || guru_nip !== String(user.nip).trim()) throw new ForbiddenException('NIP unggahan tidak sesuai sesi');

    const dokumen = await this.prisma.sv_master_dokumen.findUnique({
      where: { id: dokumen_id },
      select: { id: true, aktif: true, butuh_dokumen: true, tahun_ajaran_id: true },
    });
    if (!dokumen || dokumen.aktif === false || String(dokumen.tahun_ajaran_id) !== String(tahun_ajaran_id)) {
      throw new BadRequestException('Dokumen tidak ditemukan pada tahun ajaran ini');
    }
    if (dokumen.butuh_dokumen === false) throw new BadRequestException('Dokumen ini tidak memerlukan unggahan berkas');
    if (await this.terkunciUntukGuru(guru_nip, tahun_ajaran_id)) {
      throw new ForbiddenException('Penilaian supervisi Anda sudah dikunci; dokumen tidak dapat diubah lagi');
    }
    return { ok: true, guru_nip, tahun_ajaran_id, dokumen_id };
  }

  async upsertUnggahanRecord(body: any, user: any) {
    const { guru_nip, tahun_ajaran_id, dokumen_id } = await this.cekUnggahan(body, user);
    const file_url = teks(body?.file_url, 2000);
    const file_name = teks(body?.file_name, 255) || 'dokumen.pdf';
    // URL berkas tampil di penampil dokumen supervisor; hanya terima URL https
    // hasil unggahan modul ini, bukan tautan sembarang (mis. javascript:).
    let urlValid = false;
    try {
      const u = new URL(file_url);
      urlValid = u.protocol === 'https:' && decodeURIComponent(u.pathname).includes(`e-supervisi/${tahun_ajaran_id}/${guru_nip}/`);
    } catch { urlValid = false; }
    if (!urlValid) throw new BadRequestException('URL berkas tidak valid');

    const kunci = { guru_nip_tahun_ajaran_id_dokumen_id: { guru_nip, tahun_ajaran_id: BigInt(tahun_ajaran_id), dokumen_id } };
    const lama = await this.prisma.sv_unggahan_guru.findUnique({ where: kunci });

    const record = await this.prisma.sv_unggahan_guru.upsert({
      where: kunci,
      create: { guru_nip, tahun_ajaran_id: BigInt(tahun_ajaran_id), dokumen_id, file_url, file_name },
      update: { file_url, file_name, uploaded_at: new Date() },
    });

    // Berkas lama yang digantikan dihapus agar tidak menumpuk sebagai berkas yatim.
    // (Pencatatan berkas baru sudah dilakukan oleh /api/upload.)
    if (lama?.file_url && lama.file_url !== file_url) await this.hapusBerkas(lama.file_url);

    return { ok: true, data: record };
  }

  private async hapusBerkas(file_url: string) {
    const { error } = await this.storageService.removeByUrl(file_url);
    if (error) console.error(`Gagal menghapus berkas e-supervisi ${file_url}:`, error.message);
    try {
      await this.prisma.file_uploads.deleteMany({ where: { file_url } });
    } catch (e) {
      console.error('Failed to unregister upload:', e);
    }
  }

  async deleteUnggahan(rawId: unknown, user: any) {
    const id = toInt(rawId);
    if (!id) throw new BadRequestException('ID unggahan tidak valid');

    const unggahan = await this.prisma.sv_unggahan_guru.findUnique({ where: { id } });
    if (!unggahan) return { ok: true };
    if (!user?.nip || unggahan.guru_nip !== String(user.nip).trim()) {
      throw new ForbiddenException('Hanya pemilik unggahan yang dapat menghapus');
    }
    if (await this.terkunciUntukGuru(unggahan.guru_nip, unggahan.tahun_ajaran_id)) {
      throw new ForbiddenException('Penilaian supervisi Anda sudah dikunci; dokumen tidak dapat dihapus');
    }

    await this.prisma.sv_unggahan_guru.delete({ where: { id } });
    if (unggahan.file_url) await this.hapusBerkas(unggahan.file_url);
    return { ok: true };
  }

  async getTahunAjaranList(user: any) {
    const a = await this.akses(user);
    const [allTa, docs, assignments, jumlahSupervisi] = await Promise.all([
      this.prisma.master_tahun_ajaran.findMany({
        where: { is_active: true },
        orderBy: { tahun_ajaran: 'desc' },
      }),
      this.prisma.sv_master_dokumen.findMany({
        where: { aktif: true },
        select: { tahun_ajaran_id: true },
        distinct: ['tahun_ajaran_id'],
      }),
      this.prisma.sv_penugasan.findMany({
        select: { tahun_ajaran_id: true },
        distinct: ['tahun_ajaran_id'],
      }),
      a.nip ? this.prisma.sv_penugasan.count({ where: { supervisor_nip: a.nip } }) : Promise.resolve(0),
    ]);
    return {
      ok: true,
      data: {
        allTa,
        docs,
        assignments,
        akses: { kelola: a.kelola, pantau: a.pantau, admin: a.admin, supervisor: jumlahSupervisi > 0 },
      },
    };
  }
}
