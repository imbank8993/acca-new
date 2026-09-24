import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UmKelulusanService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tahun ajaran yang dipakai bila pemanggil tidak menyebutkannya.
   *
   * Berbeda dari daftar Siswa Kelas, Wali Kelas, dan Guru Asuh — yang bila tidak
   * disebutkan berarti SEMUA tahun ajaran yang diatur aktif — kelulusan selalu
   * bekerja pada satu tahun. Statusnya dikunci per tahun (`is_locked`), nilai
   * ujian madrasahnya per tahun, dan satu angkatan hanya lulus sekali. Jadi di
   * sini satu nilai memang jawaban yang benar.
   *
   * Yang salah sebelumnya bukan "satu tahun", tapi tahun yang mana: `findFirst`
   * tanpa `orderBy` mengambil baris aktif mana saja yang lebih dulu dikembalikan
   * database. Saat lebih dari satu tahun ditandai aktif (keadaan normal di masa
   * peralihan, dan tab Tahun Ajaran memang mengizinkannya), halaman kelulusan bisa
   * menampilkan angkatan yang berbeda antar pemuatan tanpa ada yang mengubah
   * apa pun. Sekarang yang dipakai adalah tahun aktif TERBARU — tetap satu, tapi
   * selalu tahun yang sama dan selalu angkatan yang sedang berjalan.
   */
  private async getTahunAjaran(ta?: string): Promise<string | null> {
    if (ta) return ta;
    const settings = await this.prisma.master_tahun_ajaran.findFirst({
      where: { is_active: true },
      orderBy: { tahun_ajaran: 'desc' },
    });
    return settings?.tahun_ajaran || null;
  }

  // --- KELULUSAN ---

  async getKelulusan(query: any) {
    const { tahun_ajaran, kelas, export: exportModeStr, template: downloadTemplateStr } = query;
    const exportMode = exportModeStr === 'true';
    const downloadTemplate = downloadTemplateStr === 'true';

    let ta = await this.getTahunAjaran(tahun_ajaran);

    if (downloadTemplate) {
      if (!kelas) throw new BadRequestException('Pilih kelas terlebih dahulu');
      
      const siswaData = await this.prisma.siswa_kelas.findMany({
        where: {
          kelas: { equals: kelas, mode: 'insensitive' },
          aktif: true,
          ...(ta && { tahun_ajaran: { contains: ta, mode: 'insensitive' } }),
        },
        select: { nisn: true, nama_siswa: true, kelas: true },
        orderBy: { nama_siswa: 'asc' },
      });

      const header = ['nisn', 'nama_lengkap', 'kelas', 'status', 'rata_um', 'rata_ijazah'];
      const uniqueMap = new Map();
      siswaData.forEach(s => {
        if (s.nisn && !uniqueMap.has(s.nisn)) uniqueMap.set(s.nisn, s);
      });
      const rows = Array.from(uniqueMap.values()).map(s => [
        s.nisn || '', s.nama_siswa || '', s.kelas || '', '', '', ''
      ]);
      return { ok: true, template: true, header, body: rows };
    }

    if (exportMode) {
      const siswaData = await this.prisma.siswa_kelas.findMany({
        where: {
          kelas: { contains: 'XII', mode: 'insensitive', ...(kelas ? { equals: kelas } : {}) },
          aktif: true,
          ...(ta && { tahun_ajaran: { contains: ta, mode: 'insensitive' } }),
        },
        select: { nisn: true, nama_siswa: true, kelas: true },
        orderBy: { nama_siswa: 'asc' },
      });

      const uniqueMap = new Map();
      siswaData.forEach(s => {
        if (s.nisn && !uniqueMap.has(s.nisn)) uniqueMap.set(s.nisn, s);
      });
      const siswaList = Array.from(uniqueMap.values());
      const nisnList = siswaList.map(s => s.nisn).filter(Boolean);

      const kelulusanData = await this.prisma.kelulusan_data.findMany({
        where: {
          ...(ta && { tahun_ajaran: ta }),
          ...(nisnList.length > 0 && { nisn: { in: nisnList } }),
        }
      });

      const kelMap = new Map(kelulusanData.map(k => [k.nisn, k]));
      const header = ['nisn', 'nama_lengkap', 'kelas', 'status', 'rata_um', 'rata_ijazah'];
      const rows = siswaList.map(s => {
        const kl = kelMap.get(s.nisn) || ({} as any);
        return [
          s.nisn || '', s.nama_siswa || '', s.kelas || '',
          kl.status || '', kl.rata_um ?? '', kl.rata_ijazah ?? ''
        ];
      });

      return { ok: true, export: true, tahun_ajaran: ta, header, rows };
    }

    // REGULAR GET
    const publishData = ta ? await this.prisma.kelulusan_publish.findUnique({
      where: { tahun_ajaran: ta }
    }) : null;

    const siswaData = await this.prisma.siswa_kelas.findMany({
      where: {
        kelas: { contains: 'XII', mode: 'insensitive', ...(kelas ? { equals: kelas } : {}) },
        aktif: true,
        ...(ta && { tahun_ajaran: { contains: ta, mode: 'insensitive' } }),
      },
      select: { nisn: true, nama_siswa: true, kelas: true },
      orderBy: { nama_siswa: 'asc' },
    });

    const uniqueMap = new Map();
    siswaData.forEach(s => {
      if (s.nisn && !uniqueMap.has(s.nisn)) uniqueMap.set(s.nisn, s);
    });
    const siswaList = Array.from(uniqueMap.values());
    const nisnList = siswaList.map(s => s.nisn).filter(Boolean);

    if (nisnList.length === 0) {
      return { ok: true, data: { siswa: [] as any[], kelulusan: [] as any[], publish: null as any } };
    }

    const kelulusanData = await this.prisma.kelulusan_data.findMany({
      where: {
        ...(ta && { tahun_ajaran: ta }),
        ...(nisnList.length > 0 && { nisn: { in: nisnList } }),
      }
    });

    return {
      ok: true,
      data: {
        siswa: siswaList,
        kelulusan: kelulusanData,
        tahun_ajaran: ta,
        publish: publishData,
      }
    };
  }

  async postKelulusan(body: any, apiUser: any) {
    if (!apiUser) throw new (require('@nestjs/common').ForbiddenException)('Konteks pelaku wajib untuk modifikasi kelulusan');
    const { updates, tahun_ajaran, publish_at } = body;
    
    if (!tahun_ajaran) throw new BadRequestException('Tahun ajaran wajib diisi');

    if (publish_at !== undefined) {
      const publishAt = publish_at === null ? null : new Date(publish_at);
      if (publishAt && !Number.isFinite(+publishAt)) throw new BadRequestException('Tanggal publish tidak valid');
      await this.prisma.kelulusan_publish.upsert({
        where: { tahun_ajaran: tahun_ajaran.trim() },
        update: { publish_at: publishAt, updated_at: new Date() },
        create: { tahun_ajaran: tahun_ajaran.trim(), publish_at: publishAt, updated_at: new Date() },
      });
      return { ok: true, message: 'Jadwal publish diperbarui', publish_at };
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('Tidak ada data');
    }

    for (const row of updates) {
      if (!row.nisn || !['LULUS','TIDAK_LULUS','MENUNGGU'].includes(row.status || 'MENUNGGU')) throw new BadRequestException('NISN/status tidak valid');
      for (const key of ['rata_um','rata_ijazah']) if (row[key] != null && row[key] !== '' && (!Number.isFinite(Number(row[key])) || Number(row[key]) < 0 || Number(row[key]) > 100)) throw new BadRequestException('Nilai harus antara 0–100');
    }
    const ta = tahun_ajaran.trim();
    for (const u of updates) {
      const nisn = String(u.nisn || '').trim();
      const status = u.status || 'MENUNGGU';
      const rata_um = u.rata_um != null && u.rata_um !== '' ? parseFloat(u.rata_um) : null;
      const rata_ijazah = u.rata_ijazah != null && u.rata_ijazah !== '' ? parseFloat(u.rata_ijazah) : null;
      
      await this.prisma.kelulusan_data.upsert({
        where: { nisn_tahun_ajaran: { nisn, tahun_ajaran: ta } },
        update: { status, rata_um, rata_ijazah, updated_at: new Date(), input_by_nip: apiUser?.nip || null },
        create: { nisn, tahun_ajaran: ta, status, rata_um, rata_ijazah, updated_at: new Date(), input_by_nip: apiUser?.nip || null },
      });
    }

    return { ok: true, count: updates.length };
  }

  async patchKelulusan(body: any) {
    const { tahun_ajaran, rows, header } = body;
    if (!tahun_ajaran) throw new BadRequestException('Tahun ajaran wajib diisi');
    if (!rows || !Array.isArray(rows) || rows.length === 0) throw new BadRequestException('Data kosong');
    if (!header || !Array.isArray(header)) throw new BadRequestException('Header kolom tidak valid');

    const ta = tahun_ajaran.trim();
    const headerLower = header.map(h => String(h || '').toLowerCase());
    const idxNisn = headerLower.indexOf('nisn');
    const idxStatus = headerLower.indexOf('status');
    const idxRataUm = headerLower.indexOf('rata_um');
    const idxRataIj = headerLower.indexOf('rata_ijazah');

    if (idxNisn < 0 || idxStatus < 0) {
      throw new BadRequestException('Kolom nisn dan status wajib ada di template');
    }

    const errors: string[] = [];
    const upsertData: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nisn = String(row[idxNisn] || '').trim();
      let statusRaw = String(row[idxStatus] || '').trim();
      
      if (!nisn) { errors.push(`Baris ${i + 2}: NISN kosong`); continue; }
      
      let status = statusRaw.toUpperCase().replace(/\s+/g, '_').replace(/TDK_?LULUS/, 'TIDAK_LULUS').replace(/TDK_LULUS/, 'TIDAK_LULUS');
      if (/^(tdk|tidak)\.?lulus$/i.test(statusRaw)) status = 'TIDAK_LULUS';
      if (/^(lulus|complete|passed)$/i.test(statusRaw)) status = 'LULUS';

      if (!['LULUS', 'TIDAK_LULUS', 'MENUNGGU'].includes(status)) {
        errors.push(`Baris ${i + 2}: Status "${statusRaw}" tidak valid (gunakan LULUS / TIDAK_LULUS / MENUNGGU)`);
        continue;
      }

      const rata_um = idxRataUm >= 0 && row[idxRataUm] != null && row[idxRataUm] !== '' ? parseFloat(row[idxRataUm]) : null;
      const rata_ijazah = idxRataIj >= 0 && row[idxRataIj] != null && row[idxRataIj] !== '' ? parseFloat(row[idxRataIj]) : null;

      upsertData.push({ nisn, status, rata_um, rata_ijazah });
    }

    for (const u of upsertData) {
      await this.prisma.kelulusan_data.upsert({
        where: { nisn_tahun_ajaran: { nisn: u.nisn, tahun_ajaran: ta } },
        update: { status: u.status, rata_um: u.rata_um, rata_ijazah: u.rata_ijazah, updated_at: new Date() },
        create: { nisn: u.nisn, tahun_ajaran: ta, status: u.status, rata_um: u.rata_um, rata_ijazah: u.rata_ijazah, updated_at: new Date() },
      });
    }

    return { ok: true, imported: upsertData.length, errors: errors.length > 0 ? errors : undefined };
  }

  // --- UJIAN MADRASAH ---

  async getUjianMadrasah(query: any) {
    const { kelas, nip: rawNip, tahun_ajaran } = query;
    let nipFilter = (rawNip && rawNip !== 'null' && rawNip !== 'undefined' && rawNip.trim() !== '') ? rawNip.trim() : null;
    let ta = await this.getTahunAjaran(tahun_ajaran);

    if (!kelas) throw new BadRequestException('Parameter kelas wajib diisi');
    
    const kelasTrimmed = kelas.trim();
    const taTrimmed = ta ? ta.trim() : null;

    let isLocked = false;
    if (kelasTrimmed && taTrimmed) {
      const kelasLock = await this.prisma.um_lock_kelas.findFirst({
        where: { kelas: kelasTrimmed, tahun_ajaran: taTrimmed }
      });
      isLocked = kelasLock?.locked === true;
    }
    if (!isLocked && taTrimmed) {
      const taData = await this.prisma.master_tahun_ajaran.findFirst({
        where: { tahun_ajaran: taTrimmed }
      });
      isLocked = taData?.is_locked === true;
    }

    const siswaData = await this.prisma.siswa_kelas.findMany({
      where: {
        kelas: kelasTrimmed,
        aktif: true,
        ...(taTrimmed && { tahun_ajaran: { contains: taTrimmed, mode: 'insensitive' } }),
      },
      select: { nisn: true, nama_siswa: true, kelas: true },
      orderBy: { nama_siswa: 'asc' }
    });

    const uniqueMap = new Map();
    siswaData.forEach(s => {
      if (s.nisn && !uniqueMap.has(s.nisn)) uniqueMap.set(s.nisn, s);
    });
    const finalSiswa = Array.from(uniqueMap.values());
    const allNisns = finalSiswa.map(s => s.nisn).filter(Boolean);

    const nilaiData = await this.prisma.ujian_madrasah.findMany({
      where: {
        kelas: kelasTrimmed,
        ...(taTrimmed && { tahun_ajaran: taTrimmed })
      }
    });

    const raportData = await this.prisma.um_rata_raport.findMany({
      where: {
        ...(taTrimmed && { tahun_ajaran: taTrimmed }),
        ...(allNisns.length > 0 && { nisn: { in: allNisns } })
      }
    });

    const configData = taTrimmed ? await this.prisma.um_konfigurasi.findFirst({
      where: { tahun_ajaran: taTrimmed }
    }) : null;

    const mappedData = await this.prisma.master_mapel_kelas.findMany({
      where: {
        kelas_nama: kelasTrimmed,
        ...(taTrimmed && { tahun_ajaran: taTrimmed }),
        ...(nipFilter && { guru_nip: nipFilter }),
      },
      include: {
        master_mapel: { select: { id: true, nama: true } },
        master_guru: { select: { nama_lengkap: true } }
      }
    });

    const assignedNips = mappedData.map(m => m.guru_nip).filter(Boolean) as string[];
    let guruCodesMap: Record<string, string> = {};
    if (assignedNips.length > 0) {
      const codesData = await this.prisma.master_kode_guru.findMany({
        where: { nip: { in: assignedNips } }
      });
      codesData.forEach(c => {
        if (c.nip) guruCodesMap[c.nip] = c.kode_guru || '';
      });
    }

    const mapelList = mappedData.map(m => ({
      id: `${m.mapel_kode}-${m.guru_nip}`,
      nama_mapel: m.master_mapel?.nama || m.mapel_kode,
      kode: m.mapel_kode,
      guru_nip: m.guru_nip,
      guru_nama: m.master_guru?.nama_lengkap || 'Admin',
      guru_kode: m.guru_nip ? (guruCodesMap[m.guru_nip] || '') : '',
      aktif: true
    }));

    return {
      ok: true,
      data: {
        siswa: finalSiswa,
        nilai: nilaiData,
        raport: raportData,
        config: configData || { tahun_ajaran: taTrimmed, bobot_raport: 0.60, bobot_ujian: 0.40 },
        mapelList,
        isLocked,
      }
    };
  }

  async postUjianMadrasah(body: any, user: any) {
    if (!user?.id) throw new ForbiddenException('Identitas diperlukan');
    const roles = user.roles || String(user.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    const manager = roles.some((r: string) => ['ADMIN','ADMINISTRATOR','KURIKULUM','WKM_AKADEMIK','WAKAMAD_KURIKULUM'].includes(r));
    const { kelas, tahun_ajaran, updates } = body;
    const nip = user.nip;
    if (!tahun_ajaran) throw new BadRequestException('Tahun ajaran wajib diisi');
    if (!manager && (!nip || !roles.includes('GURU'))) throw new ForbiddenException('Hak pengajar diperlukan');
    if (!Array.isArray(updates) || !updates.length) throw new BadRequestException('Tidak ada data');
    for (const row of updates) {
      if (!row.nisn || !row.mapel || (row.nilai != null && row.nilai !== '' && (!Number.isFinite(Number(row.nilai)) || Number(row.nilai)<0 || Number(row.nilai)>100))) throw new BadRequestException('Identitas atau nilai tidak valid');
      if (!manager) {
        if (row.guru_nip && row.guru_nip !== nip) throw new ForbiddenException('Guru tidak sesuai sesi');
        const assigned = await this.prisma.master_mapel_kelas.findFirst({ where: { guru_nip: nip, kelas_nama: kelas, tahun_ajaran, OR: [{ mapel_kode: row.mapel }, { master_mapel: { nama: row.mapel } }] } });
        if (!assigned) throw new ForbiddenException('Bukan pengajar kelas/mapel ini');
        row.guru_nip = nip;
      }
    }
    if (!kelas || typeof kelas !== 'string') throw new BadRequestException('Kelas tidak valid');
    if (!updates || !Array.isArray(updates) || updates.length === 0) throw new BadRequestException('Tidak ada data');

    const kelasToLock = kelas.trim();
    const taToCheck = tahun_ajaran ? tahun_ajaran.trim() : null;
    let isLocked = false;
    
    if (kelasToLock && taToCheck) {
      const kelasLock = await this.prisma.um_lock_kelas.findFirst({
        where: { kelas: kelasToLock, tahun_ajaran: taToCheck }
      });
      isLocked = kelasLock?.locked === true;
    }
    if (!isLocked && taToCheck) {
      const taData = await this.prisma.master_tahun_ajaran.findFirst({
        where: { tahun_ajaran: taToCheck }
      });
      isLocked = taData?.is_locked === true;
    }

    if (isLocked) {
      throw new ForbiddenException('Input nilai Ujian Madrasah sedang dikunci. Hubungi administrator untuk membuka kunci.');
    }

    const ta = (tahun_ajaran && typeof tahun_ajaran === 'string') ? tahun_ajaran.trim() : '2025/2026';
    
    await this.prisma.$transaction(async tx => {
    for (const u of updates) {
      const nisn = String(u.nisn || '').trim();
      const mapel = String(u.mapel || '').trim();
      const guru_nip = (u.guru_nip && typeof u.guru_nip === 'string') ? u.guru_nip.trim() : '';
      const nilai = u.nilai !== null && u.nilai !== '' ? parseFloat(u.nilai) : null;
      const input_by_nip = (nip && typeof nip === 'string') ? nip.trim() : null;

      await tx.ujian_madrasah.upsert({
        where: {
          kelas_nisn_mapel_tahun_ajaran_guru_nip: {
            kelas: kelasToLock, nisn, mapel, tahun_ajaran: ta, guru_nip
          }
        },
        update: { nilai, input_by_nip, updated_at: new Date() },
        create: { kelas: kelasToLock, nisn, mapel, tahun_ajaran: ta, guru_nip, nilai, input_by_nip, updated_at: new Date() },
      });
    }

    });
    return { ok: true, count: updates.length };
  }

  async getKelasXii(query: any) {
    const { nip: rawNip, tahun_ajaran } = query;
    const nip = (rawNip && rawNip !== 'null' && rawNip !== 'undefined' && rawNip.trim() !== '') ? rawNip.trim() : null;

    if (nip) {
      const data = await this.prisma.master_mapel_kelas.findMany({
        where: {
          guru_nip: nip,
          kelas_nama: { contains: 'XII', mode: 'insensitive' },
          ...(tahun_ajaran && { tahun_ajaran: tahun_ajaran.trim() })
        },
        select: { kelas_nama: true }
      });
      const unique = Array.from(new Set(data.map(r => r.kelas_nama))).sort();
      return { ok: true, data: unique };
    } else {
      const data = await this.prisma.siswa_kelas.findMany({
        where: {
          aktif: true,
          kelas: { contains: 'XII', mode: 'insensitive' }
        },
        select: { kelas: true },
        orderBy: { kelas: 'asc' }
      });
      const unique = Array.from(new Set(data.map(r => r.kelas))).sort();
      return { ok: true, data: unique };
    }
  }

  async postUmConfig(body: any) {
    const { tahun_ajaran, bobot_raport, bobot_ujian } = body;
    if (!tahun_ajaran) throw new BadRequestException('Tahun ajaran wajib diisi');

    await this.prisma.um_konfigurasi.upsert({
      where: { tahun_ajaran },
      update: { bobot_raport, bobot_ujian, updated_at: new Date() },
      create: { tahun_ajaran, bobot_raport, bobot_ujian, updated_at: new Date() }
    });

    return { ok: true };
  }

  async postUmRaport(body: any) {
    const { updates, tahun_ajaran } = body;
    if (!updates || !Array.isArray(updates) || updates.length === 0) throw new BadRequestException('Tidak ada data untuk diimport');
    if (!tahun_ajaran) throw new BadRequestException('Tahun ajaran wajib diisi');

    const ta = tahun_ajaran.trim();
    let count = 0;
    
    for (const u of updates) {
      const nisn = String(u.nisn || '').trim();
      const mapel = String(u.mapel || '').trim();
      if (!nisn || !mapel) continue;

      const nilai = u.nilai !== null && u.nilai !== '' ? parseFloat(String(u.nilai).replace(',', '.')) : null;

      await this.prisma.um_rata_raport.upsert({
        where: {
          nisn_mapel_tahun_ajaran: { nisn, mapel, tahun_ajaran: ta }
        },
        update: { nilai, updated_at: new Date() },
        create: { nisn, mapel, tahun_ajaran: ta, nilai, updated_at: new Date() }
      });
      count++;
    }
    
    return { ok: true, count };
  }

  async getUmLock(query: any) {
    const { kelas, tahun_ajaran } = query;
    if (!tahun_ajaran) throw new BadRequestException('tahun_ajaran wajib diisi');

    if (kelas) {
      const data = await this.prisma.um_lock_kelas.findUnique({
        where: { kelas_tahun_ajaran: { kelas: kelas.trim(), tahun_ajaran: tahun_ajaran.trim() } }
      });
      return {
        ok: true,
        data: {
          kelas: kelas.trim(),
          tahun_ajaran: tahun_ajaran.trim(),
          locked: data?.locked ?? false,
          locked_at: data?.locked_at ?? null,
        }
      };
    }

    const data = await this.prisma.um_lock_kelas.findMany({
      where: {
        tahun_ajaran: tahun_ajaran.trim(),
        locked: true
      },
      select: { kelas: true, tahun_ajaran: true, locked: true, locked_at: true }
    });
    const lockedKelas = data.map(d => d.kelas);
    return { ok: true, data: lockedKelas };
  }

  async postUmLock(body: any, userRoleStr: string, nip: string | null) {
    const { kelas, tahun_ajaran, locked } = body;
    
    const roleList = (userRoleStr || '').toUpperCase().split(/[,|]/).map(r => r.trim().replace(/\s+/g, '_')).filter(Boolean);
    const isAdmin = roleList.includes('ADMIN') || roleList.includes('ADMINISTRATOR');
    if (!isAdmin) throw new ForbiddenException('Forbidden — Admin only');

    if (!tahun_ajaran || typeof locked !== 'boolean') throw new BadRequestException('Invalid parameters: tahun_ajaran and locked required');
    if (!kelas || typeof kelas !== 'string' || !kelas.trim()) throw new BadRequestException('Invalid parameters: kelas required');

    const kelasTrimmed = kelas.trim();
    const taTrimmed = tahun_ajaran.trim();

    if (locked) {
      await this.prisma.um_lock_kelas.upsert({
        where: { kelas_tahun_ajaran: { kelas: kelasTrimmed, tahun_ajaran: taTrimmed } },
        update: { locked: true, locked_at: new Date(), locked_by: nip },
        create: { kelas: kelasTrimmed, tahun_ajaran: taTrimmed, locked: true, locked_at: new Date(), locked_by: nip }
      });
    } else {
      await this.prisma.um_lock_kelas.deleteMany({
        where: { kelas: kelasTrimmed, tahun_ajaran: taTrimmed }
      });
    }

    const isLockedNow = locked;
    return {
      ok: true,
      message: isLockedNow ? `Nilai kelas ${kelasTrimmed} dikunci` : `Nilai kelas ${kelasTrimmed} dibuka`,
      data: { kelas: kelasTrimmed, tahun_ajaran: taTrimmed, locked: isLockedNow }
    };
  }
}
