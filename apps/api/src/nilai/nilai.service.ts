import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj.toJSON === 'function') return obj.toJSON();
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj.toISOString();
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeBigInt(v);
    }
    return res;
  }
  return obj;
}

const mapSemester = (s: string | number | null | undefined): number => {
  if (s === null || s === undefined || s === '') return 1;
  if (typeof s === 'number') return s;
  const sn = String(s).toLowerCase().trim();
  if (sn === 'ganjil' || sn === '1') return 1;
  if (sn === 'genap' || sn === '2') return 2;
  const parsed = parseInt(sn, 10);
  return isNaN(parsed) ? 1 : parsed;
};

@Injectable()
export class NilaiService {
  constructor(private readonly prisma: PrismaService) {}

  private isPrivileged(user: any): boolean {
    if (!user) return false;
    const roles: string[] = user.roles || (user.role ? String(user.role).split(/[,|]/).map((r: string) => r.trim().toUpperCase()) : []);
    return roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || roles.includes('OP_JURNAL') || roles.includes('KURIKULUM');
  }

  async getNilai(apiUser: any, query: any) {
    const { kelas, mapel, semester, tahun_ajaran, adminNip } = query || {};
    let nip = query?.nip;
    const isPriv = this.isPrivileged(apiUser);
    if (!isPriv) {
      nip = apiUser.nip;
    }

    if (!nip && !isPriv) {
      throw new BadRequestException('Parameter nip wajib diisi');
    }
    if (!kelas || !mapel || !semester) {
      throw new BadRequestException('Parameter tidak lengkap (kelas, mapel, semester)');
    }

    const kelasTrimmed = String(kelas).trim();
    const mapelTrimmed = String(mapel).trim();
    const semInt = mapSemester(semester);
    const semString = semInt === 1 ? 'Ganjil' : 'Genap';
    const ta = tahun_ajaran ? String(tahun_ajaran).trim() : '2024/2025';

    if (!isPriv) {
      const isAssigned = await this.checkGuruAssignment(apiUser.nip, kelasTrimmed, mapelTrimmed, ta, semInt);
      if (!isAssigned) {
        throw new ForbiddenException(`Anda tidak memiliki wewenang mengajar di kelas ${kelasTrimmed} untuk mapel ${mapelTrimmed} pada tahun ajaran ${ta}.`);
      }
    }

    const whereBase: any = {
      kelas: kelasTrimmed,
      mapel: { equals: mapelTrimmed, mode: 'insensitive' },
      semester: semInt,
      tahun_ajaran: ta,
    };
    if (isPriv && adminNip && adminNip !== 'all') {
      whereBase.nip = String(adminNip).trim();
    }

    // 1. Fetch scores
    const nilaiData = await this.prisma.nilai_data.findMany({
      where: whereBase,
      orderBy: { created_at: 'asc' },
    });

    // 2. Fetch weight config (latest active)
    const bobotRow = await this.prisma.nilai_bobot.findFirst({
      where: whereBase,
      orderBy: { updated_at: 'desc' },
    });

    // 3. Fetch tagihan
    const tagihanData = await this.prisma.nilai_tagihan.findMany({
      where: whereBase,
      orderBy: { created_at: 'asc' },
    });

    // 4. Fetch students
    let siswaList = await this.prisma.siswa_kelas.findMany({
      where: {
        kelas: kelasTrimmed,
        aktif: true,
        tahun_ajaran: { contains: ta, mode: 'insensitive' },
        semester: semString,
      },
      select: { nisn: true, nama_siswa: true },
      orderBy: { nama_siswa: 'asc' },
    });

    if (!siswaList || siswaList.length === 0) {
      siswaList = await this.prisma.siswa_kelas.findMany({
        where: {
          kelas: kelasTrimmed,
          aktif: true,
          tahun_ajaran: { contains: ta, mode: 'insensitive' },
        },
        select: { nisn: true, nama_siswa: true },
        orderBy: { nama_siswa: 'asc' },
      });
    }

    // Deduplicate students
    const uniqueSiswaMap = new Map<string, any>();
    for (const s of siswaList) {
      if (s.nisn && !uniqueSiswaMap.has(s.nisn)) {
        uniqueSiswaMap.set(s.nisn, s);
      }
    }
    let finalSiswa = Array.from(uniqueSiswaMap.values());

    // Fetch profile photos from users table by username/nip = nisn
    if (finalSiswa.length > 0) {
      const nisnList = finalSiswa.map((s) => s.nisn).filter(Boolean) as string[];
      const usersData = await this.prisma.public_users.findMany({
        where: {
          OR: [
            { username: { in: nisnList } },
            { nip: { in: nisnList } },
          ],
        },
        select: { username: true, nip: true, foto_profil: true },
      });

      const fotoMap = new Map<string, string>();
      for (const u of usersData) {
        if (!u.foto_profil) continue;
        if (u.username && nisnList.includes(u.username)) fotoMap.set(u.username, u.foto_profil);
        if (u.nip && nisnList.includes(u.nip)) fotoMap.set(u.nip, u.foto_profil);
      }

      finalSiswa = finalSiswa.map((s) => ({
        ...s,
        foto_profil: fotoMap.get(s.nisn) || null,
      }));
    }

    return {
      ok: true,
      data: {
        siswa: serializeBigInt(finalSiswa),
        nilai: serializeBigInt(nilaiData),
        tagihan: serializeBigInt(tagihanData),
        bobot: bobotRow?.bobot_config || null,
      },
    };
  }

  async saveNilai(apiUser: any, body: any) {
    const { nip, kelas, mapel, semester, updates, tahun_ajaran } = body || {};
    if (!nip || !kelas || !mapel || !semester || !updates || !Array.isArray(updates)) {
      throw new BadRequestException('Parameter tidak lengkap atau format updates salah');
    }

    const isPriv = this.isPrivileged(apiUser);
    if (!isPriv && nip !== apiUser.nip) {
      throw new ForbiddenException('Anda hanya dapat menyimpan nilai atas nama sendiri.');
    }

    const kelasTrimmed = String(kelas).trim();
    const mapelTrimmed = String(mapel).trim();
    const semInt = mapSemester(semester);
    const ta = (tahun_ajaran || '2024/2025').trim();

    if (!isPriv) {
      const isAssigned = await this.checkGuruAssignment(apiUser.nip, kelasTrimmed, mapelTrimmed, ta, semInt);
      if (!isAssigned) {
        throw new ForbiddenException(`Anda tidak memiliki wewenang mengajar di kelas ${kelasTrimmed} untuk mapel ${mapelTrimmed} pada tahun ajaran ${ta}.`);
      }
    }

    // Query existing rows across this class & mapel
    const existingRows = await this.prisma.nilai_data.findMany({
      where: {
        kelas: kelasTrimmed,
        mapel: { equals: mapelTrimmed, mode: 'insensitive' },
        semester: semInt,
        tahun_ajaran: ta,
      },
      select: {
        id: true,
        nip: true,
        nisn: true,
        jenis: true,
        materi_tp: true,
        tagihan: true,
        nilai: true,
      },
    });

    const keyOf = (r: { nisn: string; jenis: string; materi_tp: string | null; tagihan: string | null }) =>
      `${r.nisn}||${r.jenis}||${r.materi_tp || ''}||${r.tagihan || ''}`;
    const existingMap = new Map<string, any>();
    for (const r of existingRows) {
      existingMap.set(keyOf(r), r);
    }

    let inserted = 0;
    let updated = 0;
    const errors: any[] = [];

    for (const u of updates) {
      const rec = {
        nisn: u.nisn,
        jenis: u.jenis,
        materi_tp: u.materi || null,
        tagihan: u.tagihan || '',
      };
      const nilaiVal = u.nilai === '' || u.nilai === null || u.nilai === undefined ? null : parseFloat(u.nilai);
      if (nilaiVal !== null && (isNaN(nilaiVal) || nilaiVal < 0 || nilaiVal > 100)) {
        throw new BadRequestException(`Nilai tidak valid (${u.nilai}) untuk NISN ${u.nisn}. Nilai harus berada dalam rentang 0 sampai 100.`);
      }
      const found = existingMap.get(keyOf(rec));

      try {
        if (found) {
          const oldVal = found.nilai;
          await this.prisma.nilai_data.update({
            where: { id: found.id },
            data: {
              nilai: nilaiVal,
              updated_at: new Date(),
            },
          });
          if (oldVal !== null && Number(oldVal) !== Number(nilaiVal)) {
            await this.prisma.nilai_logs.create({
              data: {
                nilai_id: found.id,
                nip_reviser: apiUser.nip || 'UNKNOWN',
                old_nilai: oldVal,
                new_nilai: nilaiVal,
                action: found.nip !== apiUser.nip ? 'UPDATE_PENGGANTI' : 'UPDATE',
              },
            }).catch(() => {});
          }
          updated++;
        } else {
          await this.prisma.nilai_data.create({
            data: {
              nip: apiUser.nip,
              kelas: kelasTrimmed,
              mapel: mapelTrimmed,
              semester: semInt,
              nisn: u.nisn,
              jenis: u.jenis,
              materi_tp: u.materi || null,
              tagihan: u.tagihan || '',
              nilai: nilaiVal,
              tahun_ajaran: ta,
            },
          });
          inserted++;
        }
      } catch (err: any) {
        errors.push({ update: u, error: err.message });
      }
    }

    return {
      ok: true,
      message: `Berhasil memproses nilai (${inserted} baru, ${updated} diperbarui)`,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async getAdminNilai(apiUser: any, query: any) {
    if (!this.isPrivileged(apiUser)) {
      throw new ForbiddenException('Hanya Admin / OP Jurnal yang dapat mengakses panel admin nilai.');
    }

    const { nip, kelas, mapel, semester, tahun_ajaran, search } = query || {};
    const where: any = {};
    if (nip) where.nip = String(nip).trim();
    if (kelas) where.kelas = String(kelas).trim();
    if (mapel) where.mapel = { contains: String(mapel).trim(), mode: 'insensitive' };
    if (semester) where.semester = mapSemester(semester);
    if (tahun_ajaran) where.tahun_ajaran = String(tahun_ajaran).trim();

    if (search) {
      const s = String(search).trim();
      where.OR = [
        { nisn: { contains: s, mode: 'insensitive' } },
        { materi_tp: { contains: s, mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.nilai_data.findMany({
      where,
      orderBy: [{ kelas: 'asc' }, { mapel: 'asc' }, { nisn: 'asc' }],
      take: 5000,
    });

    const nipSet = new Set<string>();
    const nisnSet = new Set<string>();
    for (const r of data) {
      if (r.nip) nipSet.add(r.nip);
      if (r.nisn) nisnSet.add(r.nisn);
    }

    const guruMap = new Map<string, string>();
    if (nipSet.size > 0) {
      const guruRows = await this.prisma.master_guru.findMany({
        where: { nip: { in: Array.from(nipSet) } },
        select: { nip: true, nama_lengkap: true },
      });
      for (const g of guruRows) {
        guruMap.set(g.nip, g.nama_lengkap || g.nip);
      }
    }

    const siswaMap = new Map<string, string>();
    if (nisnSet.size > 0) {
      const siswaRows = await this.prisma.master_siswa.findMany({
        where: { nisn: { in: Array.from(nisnSet) } },
        select: { nisn: true, nama_lengkap: true },
      });
      for (const s of siswaRows) {
        if (s.nisn) siswaMap.set(s.nisn, s.nama_lengkap || s.nisn);
      }
      const missingNisns = Array.from(nisnSet).filter((n) => !siswaMap.has(n));
      if (missingNisns.length > 0) {
        const skRows = await this.prisma.siswa_kelas.findMany({
          where: { nisn: { in: missingNisns } },
          select: { nisn: true, nama_siswa: true },
        });
        for (const sk of skRows) {
          if (sk.nisn && !siswaMap.has(sk.nisn)) {
            siswaMap.set(sk.nisn, sk.nama_siswa || sk.nisn);
          }
        }
      }
    }

    let enriched = data.map((r) => ({
      ...r,
      nama_guru: guruMap.get(r.nip) || r.nip,
      nama_siswa: siswaMap.get(r.nisn) || r.nisn,
    }));

    if (search) {
      const s = String(search).trim().toLowerCase();
      enriched = enriched.filter(
        (r) =>
          (r.nama_siswa && r.nama_siswa.toLowerCase().includes(s)) ||
          (r.nisn && r.nisn.toLowerCase().includes(s)) ||
          (r.nama_guru && r.nama_guru.toLowerCase().includes(s)) ||
          (r.kelas && r.kelas.toLowerCase().includes(s)) ||
          (r.materi_tp && r.materi_tp.toLowerCase().includes(s))
      );
    }

    return { ok: true, data: serializeBigInt(enriched) };
  }

  async updateAdminNilai(apiUser: any, body: any) {
    if (!this.isPrivileged(apiUser)) {
      throw new ForbiddenException('Hanya Admin / OP Jurnal yang dapat mengubah nilai admin.');
    }
    const { id, nilai, catatan } = body || {};
    if (!id) {
      throw new BadRequestException('Parameter id wajib diisi');
    }

    const existing = await this.prisma.nilai_data.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data nilai tidak ditemukan');
    }

    let parsedNilai: number | null = null;
    if (nilai !== undefined && nilai !== null && nilai !== '') {
      parsedNilai = parseFloat(nilai);
      if (isNaN(parsedNilai) || parsedNilai < 0 || parsedNilai > 100) {
        throw new BadRequestException('Nilai harus berupa angka antara 0 dan 100');
      }
    }

    const updated = await this.prisma.nilai_data.update({
      where: { id },
      data: {
        nilai: parsedNilai,
        catatan: catatan !== undefined ? (catatan || null) : existing.catatan,
        updated_at: new Date(),
      },
    });

    return { ok: true, data: serializeBigInt(updated), message: 'Nilai berhasil diperbarui' };
  }

  async deleteAdminNilai(apiUser: any, id: string) {
    if (!this.isPrivileged(apiUser)) {
      throw new ForbiddenException('Hanya Admin / OP Jurnal yang dapat menghapus nilai admin.');
    }
    if (!id) {
      throw new BadRequestException('Parameter id wajib diisi');
    }

    const existing = await this.prisma.nilai_data.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data nilai tidak ditemukan');
    }

    await this.prisma.nilai_data.delete({ where: { id } });
    return { ok: true, message: 'Nilai berhasil dihapus' };
  }

  async getGuruTeachingScopes(nip: string, tahunAjaran?: string | null, semester?: number | string | null) {
    if (!nip) {
      return { kelasList: [], mapelList: [], mapelByKelas: {} };
    }

    const cleanNip = String(nip).trim();
    const cleanTa = tahunAjaran && tahunAjaran !== 'all' ? String(tahunAjaran).trim() : null;
    const semInt = semester && semester !== 'all' ? mapSemester(semester) : null;

    const kelasSet = new Set<string>();
    const mapelSet = new Set<string>();
    const mapelByKelas: Record<string, Set<string>> = {};

    const addScope = (rawKelas?: string | null, rawMapel?: string | null) => {
      if (!rawKelas) return;
      const k = String(rawKelas).trim();
      if (!k) return;
      kelasSet.add(k);
      if (!mapelByKelas[k]) {
        mapelByKelas[k] = new Set<string>();
      }
      if (rawMapel) {
        const m = String(rawMapel).trim();
        if (m) {
          mapelSet.add(m);
          mapelByKelas[k].add(m);
        }
      }
    };

    // 1. Check if cleanTa matches active academic year(s) or if none specified
    const activeTas = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true },
    });
    const isActiveYear = !cleanTa || activeTas.some((a) => a.tahun_ajaran === cleanTa);

    if (isActiveYear) {
      const jg = await this.prisma.jadwal_guru.findMany({
        where: { nip: cleanNip, aktif: true },
        select: { kelas: true, mata_pelajaran: true },
      });
      for (const row of jg) {
        addScope(row.kelas, row.mata_pelajaran);
      }
    }

    // 2. Query absensi_sesi for this teacher and academic year
    const whereAbs: any = { nip: cleanNip };
    if (cleanTa) whereAbs.tahun_ajaran = cleanTa;
    if (semInt) whereAbs.semester = semInt;
    const abs = await this.prisma.absensi_sesi.findMany({
      where: whereAbs,
      select: { kelas: true, mapel: true },
      distinct: ['kelas', 'mapel'],
    });
    for (const row of abs) {
      addScope(row.kelas, row.mapel);
    }

    // 3. Query nilai_data for this teacher and academic year
    const whereNilai: any = { nip: cleanNip };
    if (cleanTa) whereNilai.tahun_ajaran = cleanTa;
    if (semInt) whereNilai.semester = semInt;
    const nd = await this.prisma.nilai_data.findMany({
      where: whereNilai,
      select: { kelas: true, mapel: true },
      distinct: ['kelas', 'mapel'],
    });
    for (const row of nd) {
      addScope(row.kelas, row.mapel);
    }

    // 4. Query master_mapel_kelas
    const whereMmk: any = { guru_nip: cleanNip };
    if (cleanTa) whereMmk.tahun_ajaran = cleanTa;
    const mmk = await this.prisma.master_mapel_kelas.findMany({
      where: whereMmk,
      select: { kelas_nama: true, mapel_kode: true },
    });
    for (const row of mmk) {
      addScope(row.kelas_nama, row.mapel_kode);
    }

    // 5. Query wali_kelas (homeroom teacher class)
    const whereWali: any = { nip: cleanNip, aktif: true };
    if (cleanTa) whereWali.tahun_ajaran = cleanTa;
    const wali = await this.prisma.wali_kelas.findMany({
      where: whereWali,
      select: { nama_kelas: true },
    });
    for (const row of wali) {
      addScope(row.nama_kelas, null);
    }

    const sortedKelas = Array.from(kelasSet).sort();
    const finalMapelByKelas: Record<string, string[]> = {};
    for (const k of sortedKelas) {
      const mapels = Array.from(mapelByKelas[k] || []).sort();
      finalMapelByKelas[k] = mapels.length > 0 ? mapels : Array.from(mapelSet).sort();
    }

    return {
      kelasList: sortedKelas,
      mapelList: Array.from(mapelSet).sort(),
      mapelByKelas: finalMapelByKelas,
    };
  }

  async checkGuruAssignment(nip: string, kelas: string, mapel: string, tahunAjaran?: string | null, semester?: number | string | null): Promise<boolean> {
    const scopes = await this.getGuruTeachingScopes(nip, tahunAjaran, semester);
    const kTrim = String(kelas).trim();
    if (!scopes.kelasList.includes(kTrim)) return false;
    const allowed = scopes.mapelByKelas[kTrim] || scopes.mapelList;
    if (allowed.length === 0) return true;
    const mTrim = String(mapel).trim().toLowerCase();
    return allowed.some(m => m.toLowerCase() === mTrim);
  }

  async getFilters(apiUser: any, query: any) {
    const isPriv = this.isPrivileged(apiUser);
    const { tahun_ajaran, semester, nip } = query || {};
    const targetNip = (!isPriv) ? apiUser?.nip : (nip ? String(nip).trim() : null);

    if (targetNip) {
      const scopes = await this.getGuruTeachingScopes(targetNip, tahun_ajaran, semester);
      return {
        ok: true,
        data: scopes,
      };
    }

    const where: any = {};
    if (tahun_ajaran && tahun_ajaran !== 'all') where.tahun_ajaran = String(tahun_ajaran).trim();
    if (semester && semester !== 'all') where.semester = mapSemester(semester);

    const rows = await this.prisma.nilai_data.findMany({
      where,
      select: { kelas: true, mapel: true },
      distinct: ['kelas', 'mapel'],
    });

    const kelasSet = new Set<string>();
    const mapelSet = new Set<string>();
    const mapelByKelas: Record<string, Set<string>> = {};

    for (const r of rows) {
      if (r.kelas) {
        kelasSet.add(r.kelas);
        if (!mapelByKelas[r.kelas]) mapelByKelas[r.kelas] = new Set<string>();
        if (r.mapel) {
          mapelSet.add(r.mapel);
          mapelByKelas[r.kelas].add(r.mapel);
        }
      }
    }

    const masterKelas = await this.prisma.master_kelas.findMany({
      select: { nama: true, kode: true, program: true },
    });
    for (const k of masterKelas) {
      if (!k.kode && (!k.program || k.program === 'Reguler') && k.nama) {
        kelasSet.add(k.nama);
      }
    }

    const sortedKelas = Array.from(kelasSet).sort();
    const finalMapelByKelas: Record<string, string[]> = {};
    for (const k of sortedKelas) {
      finalMapelByKelas[k] = Array.from(mapelByKelas[k] || mapelSet).sort();
    }

    return {
      ok: true,
      data: {
        kelasList: sortedKelas,
        mapelList: Array.from(mapelSet).sort(),
        mapelByKelas: finalMapelByKelas,
      },
    };
  }

  async getGuruList(apiUser: any, query: any) {
    if (!this.isPrivileged(apiUser)) {
      throw new ForbiddenException('Hanya Admin / OP Jurnal yang dapat mengakses daftar guru admin nilai.');
    }

    const { kelas, mapel, semester, tahun_ajaran } = query || {};
    const where: any = {};
    if (kelas) where.kelas = String(kelas).trim();
    if (mapel) where.mapel = { contains: String(mapel).trim(), mode: 'insensitive' };
    if (semester) where.semester = mapSemester(semester);
    if (tahun_ajaran) where.tahun_ajaran = String(tahun_ajaran).trim();

    const nilaiNips = await this.prisma.nilai_data.findMany({
      where,
      select: { nip: true },
      distinct: ['nip'],
    });

    const uniqueNips = nilaiNips.map((r) => r.nip).filter(Boolean);
    if (uniqueNips.length === 0) {
      return { ok: true, data: [] };
    }

    const guruList = await this.prisma.master_guru.findMany({
      where: { nip: { in: uniqueNips } },
      select: { nip: true, nama_lengkap: true, aktif: true },
      orderBy: { nama_lengkap: 'asc' },
    });

    return { ok: true, data: serializeBigInt(guruList) };
  }

  async saveBobot(apiUser: any, body: any) {
    const { nip, kelas, mapel, semester, config, tahun_ajaran } = body || {};
    if (!nip || !kelas || !mapel || !semester || !config) {
      throw new BadRequestException('Parameter tidak lengkap');
    }

    const isPriv = this.isPrivileged(apiUser);
    if (!isPriv && nip !== apiUser.nip) {
      throw new ForbiddenException('Anda hanya dapat mengatur bobot nilai milik sendiri.');
    }

    const semInt = mapSemester(semester);
    const ta = tahun_ajaran || '2024/2025';

    if (!isPriv) {
      const isAssigned = await this.checkGuruAssignment(apiUser.nip, String(kelas).trim(), String(mapel).trim(), ta, semInt);
      if (!isAssigned) {
        throw new ForbiddenException(`Anda tidak memiliki hak mengajar di kelas ${kelas} untuk mapel ${mapel} pada tahun ajaran ${ta}.`);
      }
    }

    const existing = await this.prisma.nilai_bobot.findFirst({
      where: {
        kelas: String(kelas).trim(),
        mapel: { equals: String(mapel).trim(), mode: 'insensitive' },
        semester: semInt,
        tahun_ajaran: ta,
      },
      orderBy: { updated_at: 'desc' },
    });

    if (existing) {
      await this.prisma.nilai_bobot.update({
        where: { id: existing.id },
        data: {
          nip: apiUser.nip,
          bobot_config: config,
          updated_at: new Date(),
        },
      });
    } else {
      await this.prisma.nilai_bobot.create({
        data: {
          nip,
          kelas,
          mapel,
          semester: semInt,
          bobot_config: config,
          tahun_ajaran: ta,
        },
      });
    }

    return { ok: true, message: 'Berhasil menyimpan konfigurasi bobot' };
  }

  async checkSiswaAccess(user: any, nisn: string): Promise<boolean> {
    if (!user?.id || !nisn) return false;
    if (this.isPrivileged(user)) return true;
    const roles = user.roles || String(user.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    if (roles.includes('SISWA')) return String(user.nip || user.username || '') === nisn;
    if (roles.some((r: string) => ['ORANG_TUA','ORANGTUA'].includes(r))) return !!await this.prisma.orangtua_siswa.findFirst({ where: { user_id: BigInt(user.id), nisn } });
    if (!user.nip) return false;
    const isGuruAsuh = await this.prisma.guru_asuh.findFirst({ where: { nip: user.nip, nisn_siswa: nisn, aktif: true } });
    if (isGuruAsuh) return true;
    const rows = await this.prisma.siswa_kelas.findMany({ where: { nisn, aktif: true }, select: { kelas: true } });
    const kelas = rows.map(r => r.kelas).filter(Boolean) as string[];
    if (!kelas.length) return false;
    return !!(await this.prisma.jadwal_guru.findFirst({ where: { nip: user.nip, kelas: { in: kelas }, aktif: true } }) || await this.prisma.wali_kelas.findFirst({ where: { nip: user.nip, nama_kelas: { in: kelas }, aktif: true } }));
  }

  async getSiswaNilai(apiUser: any, nisn: string, query: any) {
    if (!nisn) throw new BadRequestException('Parameter nisn wajib diisi');

    const cleanNisn = String(nisn).trim();
    const hasAccess = await this.checkSiswaAccess(apiUser, cleanNisn);
    if (!hasAccess) {
      throw new ForbiddenException('Akses ditolak: Anda tidak dapat melihat nilai siswa lain.');
    }

    const { semester, tahun_ajaran, guruNip, mapel, kelas } = query || {};
    const where: any = { nisn: cleanNisn };

    if (semester) where.semester = mapSemester(semester);
    if (tahun_ajaran && tahun_ajaran !== 'all') where.tahun_ajaran = String(tahun_ajaran).trim();
    if (guruNip) where.nip = String(guruNip).trim();
    if (mapel) where.mapel = { contains: String(mapel).trim(), mode: 'insensitive' };
    if (kelas) where.kelas = String(kelas).trim();

    const data = await this.prisma.nilai_data.findMany({
      where,
      orderBy: [{ mapel: 'asc' }, { jenis: 'asc' }],
    });

    const nipSet = new Set<string>();
    for (const r of data) {
      if (r.nip) nipSet.add(r.nip);
    }

    const guruMap = new Map<string, string>();
    if (nipSet.size > 0) {
      const guruRows = await this.prisma.master_guru.findMany({
        where: { nip: { in: Array.from(nipSet) } },
        select: { nip: true, nama_lengkap: true },
      });
      for (const g of guruRows) {
        guruMap.set(g.nip, g.nama_lengkap || g.nip);
      }
    }

    const tagihanList = nipSet.size > 0 ? await this.prisma.nilai_tagihan.findMany({
      where: { nip: { in: Array.from(nipSet) } },
      select: { nip: true, kelas: true, mapel: true, semester: true, tahun_ajaran: true, materi_tp: true, jenis: true, nama_tagihan: true, topik: true },
    }) : [];

    const tagihanMap = new Map<string, string>();
    for (const t of tagihanList) {
      const k1 = `${t.nip}_${t.kelas}_${t.mapel}_${t.semester}_${t.tahun_ajaran}_${t.jenis}_${t.materi_tp}_${t.nama_tagihan}`;
      const k2 = `${t.nip}_${t.kelas}_${t.mapel}_${t.semester}_${t.tahun_ajaran}_${t.jenis}_${t.materi_tp}_`;
      if (t.topik) {
        tagihanMap.set(k1, t.topik);
        if (!tagihanMap.has(k2)) tagihanMap.set(k2, t.topik);
      }
    }

    const enriched = data.map((r) => {
      const k1 = `${r.nip}_${r.kelas}_${r.mapel}_${r.semester}_${r.tahun_ajaran}_${r.jenis}_${r.materi_tp}_${r.tagihan}`;
      const k2 = `${r.nip}_${r.kelas}_${r.mapel}_${r.semester}_${r.tahun_ajaran}_${r.jenis}_${r.materi_tp}_`;
      const topik = tagihanMap.get(k1) || tagihanMap.get(k2) || null;
      return {
        ...r,
        nama_guru: guruMap.get(r.nip) || r.nip,
        topik,
      };
    });

    const grouped: Record<string, Record<string, any[]>> = {};
    for (const r of enriched) {
      const ta = r.tahun_ajaran || 'Unknown';
      const sem = String(r.semester || 'Unknown');
      if (!grouped[ta]) grouped[ta] = {};
      if (!grouped[ta][sem]) grouped[ta][sem] = [];
      grouped[ta][sem].push(r);
    }

    let siswaData: any = await this.prisma.master_siswa.findUnique({
      where: { nisn: cleanNisn },
      select: { nisn: true, nama_lengkap: true },
    });

    if (siswaData) {
      siswaData.foto_profil = null;
    } else {
      const sk = await this.prisma.siswa_kelas.findFirst({
        where: { nisn: cleanNisn },
        select: { nisn: true, nama_siswa: true },
      });
      if (sk) {
        siswaData = {
          nisn: sk.nisn,
          nama_lengkap: sk.nama_siswa,
          foto_profil: null,
        };
      }
    }

    if (siswaData && !siswaData.foto_profil) {
      const userRow = await this.prisma.public_users.findFirst({
        where: { OR: [{ nip: cleanNisn }, { username: cleanNisn }] },
        select: { foto_profil: true },
      });
      if (userRow?.foto_profil) {
        siswaData.foto_profil = userRow.foto_profil;
      }
    }

    const rawKelasData = await this.prisma.siswa_kelas.findMany({
      where: { nisn: cleanNisn, aktif: true },
      select: { kelas: true, tahun_ajaran: true, semester: true },
      orderBy: [{ tahun_ajaran: 'desc' }, { semester: 'asc' }],
    });

    const bobotList = await this.prisma.nilai_bobot.findMany({
      where: {
        ...(where.kelas ? { kelas: where.kelas } : {}),
        ...(where.semester ? { semester: where.semester } : {}),
        ...(where.tahun_ajaran ? { tahun_ajaran: where.tahun_ajaran } : {}),
      },
    });

    return {
      ok: true,
      data: {
        siswa: serializeBigInt(siswaData),
        kelas: serializeBigInt(rawKelasData || []),
        grouped: serializeBigInt(grouped),
        all: serializeBigInt(enriched),
      },
      bobot: serializeBigInt(bobotList),
    };
  }

  async getSiswaStudents(query: any, user: any) {
    const { kelas, tahun_ajaran, semester } = query || {};
    const isPriv = this.isPrivileged(user);
    const cleanTa = tahun_ajaran && tahun_ajaran !== 'all' ? String(tahun_ajaran).trim() : null;

    const where: any = { aktif: true };

    if (!isPriv) {
      if (!user?.nip) {
        return { ok: true, data: [] };
      }
      const scopes = await this.getGuruTeachingScopes(user.nip, cleanTa, semester);
      if (scopes.kelasList.length === 0) {
        return { ok: true, data: [] };
      }

      if (kelas) {
        const k = String(kelas).trim();
        if (!scopes.kelasList.includes(k)) {
          return { ok: true, data: [] };
        }
        where.kelas = k;
      } else {
        where.kelas = { in: scopes.kelasList };
      }
    } else {
      if (kelas) {
        where.kelas = String(kelas).trim();
      } else {
        const masterKelas = await this.prisma.master_kelas.findMany({
          select: { nama: true, kode: true, program: true },
        });
        const regulerKelasNames = masterKelas
          .filter((k) => !k.kode && (!k.program || k.program === 'Reguler'))
          .map((k) => k.nama);
        if (regulerKelasNames.length > 0) {
          where.kelas = { in: regulerKelasNames };
        }
      }
    }

    if (cleanTa) {
      where.tahun_ajaran = { contains: cleanTa, mode: 'insensitive' };
    }
    if (semester && semester !== 'all') {
      where.semester = mapSemester(semester) === 1 ? 'Ganjil' : 'Genap';
    }

    const students = await this.prisma.siswa_kelas.findMany({
      where,
      select: { nisn: true, nama_siswa: true, kelas: true, tahun_ajaran: true },
      orderBy: [{ tahun_ajaran: 'desc' }, { kelas: 'asc' }, { nama_siswa: 'asc' }],
    });

    const uniqueMap = new Map<string, any>();
    for (const s of students) {
      if (s.nisn && !uniqueMap.has(s.nisn)) {
        uniqueMap.set(s.nisn, {
          nisn: s.nisn,
          nama: s.nama_siswa,
          nama_siswa: s.nama_siswa,
          kelas: s.kelas,
          tahun_ajaran: s.tahun_ajaran,
        });
      }
    }

    return { ok: true, data: serializeBigInt(Array.from(uniqueMap.values())) };
  }

  async getTagihan(apiUser: any, query: any) {
    const { kelas, mapel, semester, tahun_ajaran } = query || {};
    let nip = query?.nip;
    if (!this.isPrivileged(apiUser)) {
      nip = apiUser?.nip;
    }
    const where: any = {};
    if (nip) where.nip = String(nip).trim();
    if (kelas) where.kelas = String(kelas).trim();
    if (mapel) where.mapel = { contains: String(mapel).trim(), mode: 'insensitive' };
    if (semester) where.semester = mapSemester(semester);
    if (tahun_ajaran) where.tahun_ajaran = String(tahun_ajaran).trim();

    const tagihan = await this.prisma.nilai_tagihan.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });

    return { ok: true, data: serializeBigInt(tagihan) };
  }

  async saveTagihan(apiUser: any, body: any) {
    let { id, nip, kelas, mapel, semester, materi, jenis, nama, topik, tanggal, deskripsi, tahun_ajaran, materi_tp, nama_tagihan } = body || {};
    materi = materi || materi_tp;
    nama = nama || nama_tagihan;

    if (!nip || !kelas || !mapel || !semester) {
      throw new BadRequestException('Identitas (NIP, Kelas, Mapel, Semester) wajib diisi');
    }

    const isPriv = this.isPrivileged(apiUser);
    if (!isPriv && nip !== apiUser.nip) {
      throw new ForbiddenException('Anda hanya dapat mengelola tagihan nilai milik sendiri.');
    }

    const semInt = mapSemester(semester);
    const ta = (tahun_ajaran || '2024/2025').trim();
    const parsedDate = tanggal ? new Date(tanggal) : null;

    if (!isPriv) {
      const isAssigned = await this.checkGuruAssignment(apiUser.nip, String(kelas).trim(), String(mapel).trim(), ta, semInt);
      if (!isAssigned) {
        throw new ForbiddenException(`Anda tidak memiliki hak mengajar di kelas ${kelas} untuk mapel ${mapel} pada tahun ajaran ${ta}.`);
      }
    }

    if (id) {
      const existing = await this.prisma.nilai_tagihan.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Tagihan tidak ditemukan');
      if (!isPriv && existing.nip !== apiUser.nip) {
        const canManage = await this.checkGuruAssignment(apiUser.nip, existing.kelas, existing.mapel, existing.tahun_ajaran, existing.semester);
        if (!canManage) {
          throw new ForbiddenException('Anda hanya dapat mengelola tagihan nilai milik sendiri atau kelas yang Anda ampu.');
        }
      }

      const updated = await this.prisma.nilai_tagihan.update({
        where: { id },
        data: {
          topik: topik || null,
          tanggal: parsedDate,
          deskripsi: deskripsi || null,
          updated_at: new Date(),
        },
      });
      return { ok: true, data: serializeBigInt(updated), message: 'Tagihan berhasil diperbarui' };
    } else {
      const created = await this.prisma.nilai_tagihan.create({
        data: {
          nip,
          kelas: String(kelas).trim(),
          mapel: String(mapel).trim(),
          semester: semInt,
          materi_tp: materi || '',
          jenis: jenis || 'Harian',
          nama_tagihan: nama || '',
          topik: topik || null,
          tanggal: parsedDate,
          deskripsi: deskripsi || null,
          tahun_ajaran: ta,
        },
      });
      return { ok: true, data: serializeBigInt(created), message: 'Tagihan berhasil dibuat' };
    }
  }

  async deleteTagihan(apiUser: any, id: string) {
    if (!id) throw new BadRequestException('ID tagihan wajib diisi');
    const existing = await this.prisma.nilai_tagihan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tagihan tidak ditemukan');

    if (!this.isPrivileged(apiUser) && existing.nip !== apiUser.nip) {
      const canManage = await this.checkGuruAssignment(apiUser.nip, existing.kelas, existing.mapel, existing.tahun_ajaran, existing.semester);
      if (!canManage) {
        throw new ForbiddenException('Anda hanya dapat menghapus tagihan milik sendiri atau kelas yang Anda ampu.');
      }
    }

    await this.prisma.$transaction([
      this.prisma.nilai_data.deleteMany({
        where: {
          kelas: existing.kelas,
          mapel: existing.mapel,
          semester: existing.semester,
          materi_tp: existing.materi_tp,
          tagihan: existing.nama_tagihan,
          ...(existing.tahun_ajaran ? { tahun_ajaran: existing.tahun_ajaran } : {}),
        },
      }),
      this.prisma.nilai_tagihan.delete({ where: { id } }),
    ]);
    return { ok: true, message: 'Tagihan dan nilai siswa terkait berhasil dihapus' };
  }

  async getApresiasi(apiUser: any, query: any) {
    const { kelas, mapel, semester, tahun_ajaran, adminNip } = query || {};
    let nip = query?.nip;
    const isPriv = this.isPrivileged(apiUser);
    if (!isPriv) nip = apiUser.nip;

    if (!kelas || !mapel) throw new BadRequestException('Parameter tidak lengkap (kelas, mapel)');

    const effectiveNip = (isPriv && adminNip && adminNip !== 'all') ? String(adminNip).trim() : (isPriv && adminNip === 'all' ? null : nip);

    const where: any = {
      kelas: String(kelas).trim(),
      mapel: { contains: String(mapel).trim(), mode: 'insensitive' },
      semester: mapSemester(semester),
    };
    if (effectiveNip) where.nip = effectiveNip;
    if (tahun_ajaran) where.tahun_ajaran = String(tahun_ajaran).trim();

    const sesiList = await this.prisma.nilai_apresiasi_sesi.findMany({
      where,
      include: {
        nilai_apresiasi_poin: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const sesi = sesiList.map(({ nilai_apresiasi_poin, ...s }) => s);
    const poin = sesiList.flatMap((s) => s.nilai_apresiasi_poin || []);

    return {
      ok: true,
      data: {
        sesi: serializeBigInt(sesi),
        poin: serializeBigInt(poin),
      },
    };
  }

  async saveApresiasi(apiUser: any, body: any) {
    const { nip, kelas, mapel, semester, tahun_ajaran, judul, nama_sesi, topik, tanggal, poin_per_soal, poin, items } = body || {};
    const sessionTitle = judul || nama_sesi;
    if (!nip || !kelas || !mapel || !sessionTitle) {
      throw new BadRequestException('Parameter sesi tidak lengkap (nip, kelas, mapel, judul)');
    }

    if (!this.isPrivileged(apiUser) && nip !== apiUser.nip) {
      throw new ForbiddenException('Anda hanya dapat mengelola apresiasi milik sendiri.');
    }

    const semInt = mapSemester(semester);
    const ta = tahun_ajaran ? String(tahun_ajaran).trim() : null;

    const sesi = await this.prisma.nilai_apresiasi_sesi.create({
      data: {
        nip,
        kelas: String(kelas).trim(),
        mapel: String(mapel).trim(),
        semester: semInt,
        tahun_ajaran: ta,
        judul: String(sessionTitle).trim(),
        topik: topik || null,
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        poin_per_soal: poin_per_soal !== undefined ? parseFloat(poin_per_soal) : 1,
      },
    });

    const poinList = Array.isArray(poin) ? poin : (Array.isArray(items) ? items : []);
    if (poinList.length > 0) {
      for (const it of poinList) {
        if (!it.nisn) continue;
        const jm = Number(it.jumlah_menang) || 0;
        if (jm <= 0) continue;
        await this.prisma.nilai_apresiasi_poin.create({
          data: {
            sesi_id: sesi.id,
            nisn: String(it.nisn),
            jumlah_menang: jm,
            total_poin: it.total_poin !== undefined ? parseFloat(it.total_poin) : jm * (poin_per_soal || 1),
            catatan: it.catatan || null,
          },
        });
      }
    }

    return { ok: true, data: serializeBigInt(sesi), message: 'Sesi apresiasi berhasil disimpan' };
  }

  async deleteApresiasi(apiUser: any, id: string) {
    if (!id) throw new BadRequestException('ID sesi wajib diisi');
    const existing = await this.prisma.nilai_apresiasi_sesi.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sesi apresiasi tidak ditemukan');

    if (!this.isPrivileged(apiUser) && existing.nip !== apiUser.nip) {
      throw new ForbiddenException('Anda hanya dapat menghapus sesi milik sendiri.');
    }

    await this.prisma.nilai_apresiasi_sesi.delete({ where: { id } });
    return { ok: true, message: 'Sesi apresiasi berhasil dihapus' };
  }

  async getSiswaApresiasi(apiUser: any, nisn: string, query: any) {
    if (!nisn) throw new BadRequestException('Parameter nisn wajib diisi');
    
    const hasAccess = await this.checkSiswaAccess(apiUser, nisn);
    if (!hasAccess) {
      throw new ForbiddenException('Akses ditolak: Anda tidak dapat melihat apresiasi siswa lain.');
    }

    const { semester, tahun_ajaran } = query || {};

    const where: any = { nisn: String(nisn).trim() };
    const poinRows = await this.prisma.nilai_apresiasi_poin.findMany({
      where,
      include: {
        nilai_apresiasi_sesi: true,
      },
    });

    let filtered = poinRows;
    if (semester) {
      const semInt = mapSemester(semester);
      filtered = filtered.filter((p) => p.nilai_apresiasi_sesi?.semester === semInt);
    }
    if (tahun_ajaran) {
      const ta = String(tahun_ajaran).trim();
      filtered = filtered.filter((p) => p.nilai_apresiasi_sesi?.tahun_ajaran === ta);
    }
    return { ok: true, data: serializeBigInt(filtered) };
  }

  async getSiswaPhotos() {
    const users = await this.prisma.public_users.findMany({
      where: {
        foto_profil: { not: null },
        role: { contains: 'SISWA' },
      },
      select: { username: true, nip: true, foto_profil: true },
    });
    return { ok: true, data: serializeBigInt(users) };
  }

  async transferGuruNilai(apiUser: any, body: any) {
    if (!this.isPrivileged(apiUser)) {
      throw new ForbiddenException('Hanya Admin / OP Jurnal yang dapat mengalihkan pengampu nilai.');
    }

    const { fromNip, toNip, kelas, mapel, tahun_ajaran, semester } = body || {};
    if (!fromNip || !toNip || !kelas || !mapel || !tahun_ajaran || !semester) {
      throw new BadRequestException('Parameter tidak lengkap (fromNip, toNip, kelas, mapel, tahun_ajaran, semester)');
    }

    const cleanFrom = String(fromNip).trim();
    const cleanTo = String(toNip).trim();
    if (cleanFrom === cleanTo) {
      throw new BadRequestException('Guru asal dan guru pengganti tidak boleh sama.');
    }

    const cleanKelas = String(kelas).trim();
    const cleanMapel = String(mapel).trim();
    const cleanTa = String(tahun_ajaran).trim();
    const semInt = mapSemester(semester);

    const [fromTeacher, toTeacher] = await Promise.all([
      this.prisma.master_guru.findFirst({ where: { nip: cleanFrom }, select: { nama_lengkap: true } }),
      this.prisma.master_guru.findFirst({ where: { nip: cleanTo }, select: { nama_lengkap: true } }),
    ]);

    const fromName = fromTeacher?.nama_lengkap || cleanFrom;
    const toName = toTeacher?.nama_lengkap || cleanTo;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Process nilai_data
      const fromRows = await tx.nilai_data.findMany({
        where: {
          nip: cleanFrom,
          kelas: cleanKelas,
          mapel: { equals: cleanMapel, mode: 'insensitive' },
          semester: semInt,
          tahun_ajaran: cleanTa,
        },
      });

      const toRows = await tx.nilai_data.findMany({
        where: {
          nip: cleanTo,
          kelas: cleanKelas,
          mapel: { equals: cleanMapel, mode: 'insensitive' },
          semester: semInt,
          tahun_ajaran: cleanTa,
        },
      });

      const toMap = new Map<string, any>();
      const keyOf = (r: any) => `${r.nisn}||${r.jenis}||${r.materi_tp || ''}||${r.tagihan || ''}`;
      for (const tr of toRows) {
        toMap.set(keyOf(tr), tr);
      }

      let transferredCount = 0;
      for (const fr of fromRows) {
        const key = keyOf(fr);
        const existingTo = toMap.get(key);
        if (existingTo) {
          if (existingTo.nilai === null && fr.nilai !== null) {
            await tx.nilai_data.update({
              where: { id: existingTo.id },
              data: { nilai: fr.nilai, updated_at: new Date() },
            });
          }
          await tx.nilai_data.delete({ where: { id: fr.id } });
        } else {
          await tx.nilai_data.update({
            where: { id: fr.id },
            data: { nip: cleanTo, updated_at: new Date() },
          });
          await tx.nilai_logs.create({
            data: {
              nilai_id: fr.id,
              nip_reviser: apiUser.nip || 'ADMIN',
              old_nilai: fr.nilai,
              new_nilai: fr.nilai,
              action: `TRANSFER_FROM_${cleanFrom}`,
            },
          }).catch(() => {});
        }
        transferredCount++;
      }

      // 2. Process nilai_tagihan
      await tx.nilai_tagihan.updateMany({
        where: {
          nip: cleanFrom,
          kelas: cleanKelas,
          mapel: { equals: cleanMapel, mode: 'insensitive' },
          semester: semInt,
          tahun_ajaran: cleanTa,
        },
        data: {
          nip: cleanTo,
          updated_at: new Date(),
        },
      });

      // 3. Process nilai_bobot
      const existingToBobot = await tx.nilai_bobot.findFirst({
        where: {
          nip: cleanTo,
          kelas: cleanKelas,
          mapel: { equals: cleanMapel, mode: 'insensitive' },
          semester: semInt,
          tahun_ajaran: cleanTa,
        },
      });

      if (!existingToBobot) {
        await tx.nilai_bobot.updateMany({
          where: {
            nip: cleanFrom,
            kelas: cleanKelas,
            mapel: { equals: cleanMapel, mode: 'insensitive' },
            semester: semInt,
            tahun_ajaran: cleanTa,
          },
          data: {
            nip: cleanTo,
            updated_at: new Date(),
          },
        });
      }

      // 4. Process nilai_apresiasi_sesi
      await tx.nilai_apresiasi_sesi.updateMany({
        where: {
          nip: cleanFrom,
          kelas: cleanKelas,
          mapel: { equals: cleanMapel, mode: 'insensitive' },
          semester: semInt,
          tahun_ajaran: cleanTa,
        },
        data: {
          nip: cleanTo,
          updated_at: new Date(),
        },
      });

      return {
        ok: true,
        message: `Berhasil mengalihkan ${transferredCount} data nilai dari ${fromName} ke ${toName} untuk kelas ${cleanKelas} - ${cleanMapel}.`,
        data: {
          transferredCount,
          from: { nip: cleanFrom, nama: fromName },
          to: { nip: cleanTo, nama: toName },
        },
      };
    });
  }
}
