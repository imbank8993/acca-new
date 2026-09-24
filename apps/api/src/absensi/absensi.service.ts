import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  aksesDiizinkan,
  parseKonfigurasiAkses,
  ABSENSI_ACCESS_KEY,
} from '../auth/feature-access.guard';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
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

@Injectable()
export class AbsensiService {
  private readonly logger = new Logger(AbsensiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apakah pemanggil pengelola absensi (lihat & ubah milik siapa pun)?
   *
   * Dibaca dari Hak Akses Fitur `absensi_access_config`. Kuncinya sudah lama ada
   * dan sudah tampil di layar Hak Akses Fitur sebagai "Kelola Absensi", tetapi
   * TIDAK PERNAH dipakai untuk menggerbangi apa pun — seluruh modul ini hanya
   * bersandar pada `JwtAuthGuard`. Hanya ADMIN yang melekat di kode.
   */
  private async bolehKelola(apiUser: any): Promise<boolean> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: ABSENSI_ACCESS_KEY },
      select: { value: true },
    });
    return aksesDiizinkan(apiUser, parseKonfigurasiAkses(row?.value ?? null));
  }

  /** Versi publik `bolehKelola`, dipakai controller untuk menyaring `?nip=`. */
  async bolehKelolaPublik(apiUser: any): Promise<boolean> {
    return this.bolehKelola(apiUser);
  }

  /** Kelas yang diwalikan pemanggil. Kosong kalau ia bukan wali kelas. */
  private async kelasWali(nip: string): Promise<string[]> {
    const n = String(nip ?? '').trim();
    if (!n) return [];
    const rows = await this.prisma.wali_kelas.findMany({
      where: { nip: n, aktif: true },
      select: { nama_kelas: true },
    });
    return rows.map((r) => r.nama_kelas).filter(Boolean);
  }

  /**
   * Bolehkah pemanggil menyentuh sesi ini?
   *
   * Tiga jalur: pengelola absensi, guru pengampu sesi (termasuk guru pengganti),
   * atau wali kelas dari kelas yang diabsen.
   *
   * NIP kosong tidak pernah dianggap cocok. Kalau dibandingkan apa adanya, semua
   * akun tanpa NIP jatuh ke satu keranjang identitas yang sama.
   */
  private async bolehSentuhSesi(apiUser: any, sesi: { nip?: string | null; guru_pengganti_nip?: string | null; kelas?: string | null }): Promise<boolean> {
    if (await this.bolehKelola(apiUser)) return true;
    const nip = String(apiUser?.nip ?? '').trim();
    if (!nip) return false;
    if (String(sesi.nip ?? '').trim() === nip) return true;
    if (String(sesi.guru_pengganti_nip ?? '').trim() === nip) return true;
    if (sesi.kelas) {
      const kelas = await this.kelasWali(nip);
      if (kelas.includes(sesi.kelas)) return true;
    }
    return false;
  }

  /**
   * Urai `jam_ke` sesi absensi menjadi daftar nomor jam.
   *
   * Formatnya bebas dan memang begitu di data: `"10"`, `"1-2"`, `"5-6"`, bahkan
   * `"1, 3"`. Satu sesi yang menutupi dua jam menghasilkan DUA baris jurnal —
   * itu yang terlihat di data lama (`jam_ke = "5-6"` → jurnal `jam_ke_id` 5 dan 6).
   */
  private uraiJamKe(nilai: string | null | undefined): number[] {
    const hasil = new Set<number>();
    for (const bagian of String(nilai ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const rentang = bagian.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rentang) {
        const a = parseInt(rentang[1], 10);
        const b = parseInt(rentang[2], 10);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) hasil.add(i);
        }
        continue;
      }
      const tunggal = parseInt(bagian, 10);
      if (Number.isFinite(tunggal)) hasil.add(tunggal);
    }
    return Array.from(hasil).sort((a, b) => a - b);
  }

  private static readonly NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  /**
   * Prioritas pengisi saat satu slot punya lebih dari satu baris jurnal.
   *
   * `SYSTEM` (hasil generate massal) sengaja paling bawah dan DI BAWAH `SISWA`:
   * baris generate hanya kerangka dari jadwal, belum ada isinya, jadi ia tidak
   * boleh mengalahkan baris yang sudah benar-benar diisi orang. Sebelumnya
   * `SYSTEM` tidak terdaftar sama sekali sehingga bernilai 0 dan SERI dengan
   * `SISWA` — urutan akhirnya lalu bergantung pada urutan baris dari database.
   */
  private static readonly PRIORITAS_PENGISI: Record<string, number> = {
    GURU: 3,
    ADMIN: 2,
    SISWA: 1,
    SYSTEM: 0,
  };

  /**
   * Salin isi sesi absensi ke jurnal guru.
   *
   * Perilaku ini ADA di sistem lama lalu hilang saat migrasi ke NestJS — terbukti
   * di data: 1760 dari 1818 pasangan absensi↔jurnal punya `materi` identik, dan
   * 265 baris ber-`filled_by: GURU` masih menyimpan `nisn` (jejak siswa yang
   * mengisi lebih dulu lalu ditimpa gurunya).
   *
   * Aturan yang dipulihkan apa adanya:
   *
   *  - `materi` & `refleksi` → GURU menang. Isi dari sesi menimpa yang ada; kalau
   *    sesi kosong, isi lama dipertahankan.
   *  - `kategori_kehadiran` → TIDAK disentuh saat baris sudah ada. Inilah yang
   *    membuat "Terlambat" dari siswa bertahan meski gurunya mengabsen.
   *  - Baris yang belum ada dibuat dengan `Sesuai` (atau Tukaran/Diganti bila
   *    sesi memakai guru pengganti).
   *
   * Dipanggil hanya saat sesi difinalkan.
   */
  private async sinkronKeJurnal(sesi: any): Promise<void> {
    const jamIds = this.uraiJamKe(sesi.jam_ke);
    if (!jamIds.length) return;

    const tanggal = new Date(sesi.tanggal);
    const namaHari = AbsensiService.NAMA_HARI[tanggal.getDay()];
    const adaPengganti = !!String(sesi.guru_pengganti_nip ?? '').trim();
    const materiSesi = String(sesi.materi ?? '').trim();
    const refleksiSesi = String(sesi.refleksi ?? '').trim();

    for (const jamKeId of jamIds) {
      // Label jam untuk kolom `jam_ke` jurnal, yang formatnya rentang waktu
      // ("07:20 - 08:00") — berbeda dari `jam_ke` absensi yang berisi nomor slot.
      let labelJam = `Jam Ke-${jamKeId}`;
      try {
        const waktu = await this.prisma.master_waktu.findFirst({
          where: { jam_ke: jamKeId, hari: namaHari },
          select: { mulai: true, selesai: true },
        });
        if (waktu?.mulai && waktu?.selesai) {
          const jam = (d: Date) => d.toISOString().slice(11, 16);
          labelJam = `${jam(waktu.mulai)} - ${jam(waktu.selesai)}`;
        }
      } catch {
        /* label cadangan sudah cukup */
      }

      const kandidat = await this.prisma.jurnal_guru.findMany({
        where: { tanggal, kelas: sesi.kelas, jam_ke_id: jamKeId },
      });

      const terpilih = kandidat.sort(
        (a, b) =>
          (AbsensiService.PRIORITAS_PENGISI[b.filled_by || ''] || 0) -
          (AbsensiService.PRIORITAS_PENGISI[a.filled_by || ''] || 0),
      )[0];

      if (terpilih) {
        const data: any = { filled_by: 'GURU', updated_at: new Date() };
        // Hanya menimpa bila sesi memang membawa isi; kalau tidak, yang lama tetap.
        if (materiSesi !== '') data.materi = sesi.materi;
        if (refleksiSesi !== '') data.refleksi = sesi.refleksi;
        if (adaPengganti) {
          data.guru_pengganti = sesi.guru_pengganti_nama || sesi.nama_guru;
          data.status_pengganti = 'Hadir';
          const punyaJadwal = await this.prisma.jadwal_guru.findFirst({
            where: { nip: String(sesi.guru_pengganti_nip), mata_pelajaran: sesi.mapel, aktif: true },
            select: { id: true },
          });
          data.kategori_kehadiran = punyaJadwal ? 'Tukaran' : 'Diganti';
        } else if (terpilih.guru_pengganti && !sesi.guru_pengganti_nip) {
          data.guru_pengganti = null;
          data.status_pengganti = null;
          data.kategori_kehadiran = 'Sesuai';
        }
        const draftUpdate: any = { jurnal_id: BigInt(terpilih.id) };
        if (adaPengganti) {
          draftUpdate.draft_type = data.kategori_kehadiran === 'Tukaran' ? 'TUKARAN' : 'DIGANTI';
        }
        await this.prisma.jurnal_guru.update({ where: { id: terpilih.id }, data });
        await this.prisma.absensi_sesi.update({
          where: { sesi_id: sesi.sesi_id },
          data: draftUpdate,
        });
        continue;
      }

      let kategori = 'Sesuai';
      if (adaPengganti) {
        // Guru pengganti yang memang mengampu mapel itu = Tukaran; selain itu Diganti.
        const punyaJadwal = await this.prisma.jadwal_guru.findFirst({
          where: { nip: String(sesi.guru_pengganti_nip), mata_pelajaran: sesi.mapel, aktif: true },
          select: { id: true },
        });
        kategori = punyaJadwal ? 'Tukaran' : 'Diganti';
      }

      const dibuat = await this.prisma.jurnal_guru.create({
        data: {
          nip: sesi.nip,
          nama_guru: sesi.nama_guru,
          tanggal,
          hari: namaHari,
          jam_ke: labelJam,
          jam_ke_id: jamKeId,
          kelas: sesi.kelas,
          mata_pelajaran: sesi.mapel,
          materi: sesi.materi || '',
          refleksi: sesi.refleksi || '',
          kategori_kehadiran: kategori,
          guru_pengganti: adaPengganti ? sesi.guru_pengganti_nama || sesi.nama_guru : null,
          status_pengganti: adaPengganti ? 'Hadir' : null,
          filled_by: 'GURU',
          is_generated: false,
        },
        select: { id: true },
      });
      const draftUpdate: any = { jurnal_id: BigInt(dibuat.id) };
      if (adaPengganti) {
        draftUpdate.draft_type = kategori === 'Tukaran' ? 'TUKARAN' : 'DIGANTI';
      }
      await this.prisma.absensi_sesi.update({
        where: { sesi_id: sesi.sesi_id },
        data: draftUpdate,
      });
    }
  }

  /** Ambil sesi, atau lempar 404 — dipakai sebelum setiap pemeriksaan wewenang. */
  private async sesiAtauGagal(sesi_id: string) {
    const s = String(sesi_id ?? '').trim();
    if (!s) throw new NotFoundException('Sesi absensi tidak ditemukan');
    const sesi = await this.prisma.absensi_sesi.findUnique({ where: { sesi_id: s } });
    if (!sesi) throw new NotFoundException('Sesi absensi tidak ditemukan');
    return sesi;
  }

  private async assertBolehSesi(apiUser: any, sesi: any) {
    if (!(await this.bolehSentuhSesi(apiUser, sesi))) {
      throw new ForbiddenException('Anda tidak berwenang atas sesi absensi ini');
    }
  }

  async getSesi(apiUser: any, query: any) {
    const { nip, kelas, tanggal, tahun_ajaran, semester, status_sesi, q, page, limit } = query;

    const where: any = {};

    /**
     * Batas bawaan: pemanggil hanya melihat sesi yang memang urusannya.
     *
     * Sebelumnya `apiUser` diterima parameter TAPI TIDAK PERNAH DIPAKAI — seluruh
     * penyaringan berasal dari query string. Artinya akun apa pun yang login,
     * termasuk siswa, membaca seluruh sesi absensi semua guru dan semua kelas.
     *
     * Dipasang sebagai `AND` supaya filter dari query tidak bisa melebarkannya —
     * pelajaran dari halaman Izin Guru, tempat batasan peran ditimpa oleh
     * `?jenis=` karena ditulis ke properti yang sama.
     */
    if (!(await this.bolehKelola(apiUser))) {
      const nipUser = String(apiUser?.nip ?? '').trim();
      const kelasWali = await this.kelasWali(nipUser);
      const lingkup: any[] = [];
      if (nipUser) {
        lingkup.push({ nip: nipUser }, { guru_pengganti_nip: nipUser });
      }
      if (kelasWali.length) lingkup.push({ kelas: { in: kelasWali } });
      if (!lingkup.length) {
        return { data: [], metadata: { total: 0, page: 1, limit: 0, totalPages: 0 } };
      }
      where.AND = [{ OR: lingkup }];
    }

    if (nip) where.nip = nip;
    if (kelas) where.kelas = kelas;
    if (tanggal) {
      const tglStr = String(tanggal).split('T')[0];
      where.tanggal = new Date(tglStr);
    }
    if (tahun_ajaran && tahun_ajaran !== 'ALL') where.tahun_ajaran = tahun_ajaran;
    if (semester && semester !== 'ALL') {
      const parsedSem = parseInt(semester, 10);
      if (!isNaN(parsedSem)) where.semester = parsedSem;
    }
    if (status_sesi && status_sesi !== 'semua' && status_sesi !== 'ALL') where.status_sesi = status_sesi;

    if (q && String(q).trim()) {
      const queryStr = String(q).trim();
      where.OR = [
        { nama_guru: { contains: queryStr, mode: 'insensitive' } },
        { mapel: { contains: queryStr, mode: 'insensitive' } },
        { kelas: { contains: queryStr, mode: 'insensitive' } },
        { guru_pengganti_nama: { contains: queryStr, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, items] = await Promise.all([
      this.prisma.absensi_sesi.count({ where }),
      this.prisma.absensi_sesi.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data: serializeBigInt(items),
      metadata: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }


  async getSesiById(apiUser: any, sesi_id: string) {
    const sesi = await this.sesiAtauGagal(sesi_id);
    await this.assertBolehSesi(apiUser, sesi);
    return serializeBigInt(sesi);
  }

  async createSesi(apiUser: any, data: any) {
    if (!data.tanggal || !data.kelas || !data.mapel || !data.jam_ke) {
      throw new BadRequestException('Parameter wajib sesi absensi tidak lengkap (tanggal, kelas, mapel, jam_ke)');
    }

    /**
     * Sesi selalu terikat NIP pemanggil, kecuali ia pengelola absensi.
     *
     * Sebelumnya `data.nip || apiUser.nip` membuat siapa pun bisa membuat sesi
     * ATAS NAMA guru mana pun hanya dengan mengirim `nip` di body — terbukti
     * dengan akun siswa. Pengelola tetap boleh, karena memang tugasnya
     * merapikan sesi milik guru lain.
     */
    const kelola = await this.bolehKelola(apiUser);
    const nipSendiri = String(apiUser?.nip ?? '').trim();
    const isPengganti = !!(data.guru_pengganti_nip && String(data.guru_pengganti_nip).trim() === nipSendiri);
    const targetNip = (kelola || isPengganti) ? String(data.nip ?? '').trim() || nipSendiri : nipSendiri;
    if (!targetNip) {
      throw new BadRequestException('Akun Anda belum memiliki NIP, sesi absensi tidak dapat dibuat.');
    }
    if (!kelola && !isPengganti && data.nip && String(data.nip).trim() !== nipSendiri) {
      throw new ForbiddenException('Anda tidak dapat membuat sesi absensi atas nama guru lain');
    }

    // Validasi Mode Tukaran: Guru hanya boleh bertukar pada kelas yang diampunya sesuai jadwal
    const statusKehadiran = String(data.status_kehadiran || data.kategori_kehadiran || '').trim();
    if (!kelola && isPengganti && statusKehadiran === 'Tukaran') {
      const punyaJadwalKelas = await this.prisma.jadwal_guru.findFirst({
        where: { nip: nipSendiri, kelas: data.kelas, aktif: true },
        select: { id: true },
      });
      if (!punyaJadwalKelas) {
        throw new BadRequestException('Untuk mode Tukaran, guru hanya dapat memilih kelas yang diampunya sesuai jadwal.');
      }
    }

    const tglDate = new Date(data.tanggal);
    if (Number.isNaN(tglDate.getTime())) {
      throw new BadRequestException('Tanggal tidak valid');
    }

    // Cek apakah sesi sudah pernah dibuat sebelumnya
    const existing = await this.prisma.absensi_sesi.findFirst({
      where: {
        tanggal: tglDate,
        kelas: data.kelas,
        jam_ke: String(data.jam_ke),
        nip: targetNip,
      },
    });

    if (existing) {
      // Jika sesi draf yang sudah ada belum punya guru pengganti dan sekarang dibuka oleh pengganti:
      if (isPengganti && !existing.guru_pengganti_nip) {
        const updated = await this.prisma.absensi_sesi.update({
          where: { sesi_id: existing.sesi_id },
          data: {
            guru_pengganti_nip: nipSendiri,
            guru_pengganti_nama: data.guru_pengganti_nama || apiUser.nama_lengkap || apiUser.nama || '',
          },
        });
        return serializeBigInt(updated);
      }
      return serializeBigInt(existing);
    }

    const sesi_id = data.sesi_id || randomUUID();

    const entry = await this.prisma.absensi_sesi.create({
      data: {
        sesi_id,
        jadwal_id: data.jadwal_id ? BigInt(data.jadwal_id) : null,
        tanggal: tglDate,
        kelas: data.kelas,
        mapel: data.mapel,
        jam_ke: String(data.jam_ke),
        nip: targetNip,
        nama_guru: data.nama_guru || apiUser.nama_lengkap || apiUser.nama || '',
        status_sesi: data.status_sesi || 'DRAFT',
        draft_type: data.draft_type || (statusKehadiran === 'Tukaran' ? 'TUKARAN' : (statusKehadiran === 'Diganti' ? 'DIGANTI' : 'DRAFT_DEFAULT')),
        materi: data.materi || null,
        catatan: data.catatan || null,
        tahun_ajaran: data.tahun_ajaran || '2026/2027',
        semester: data.semester ? parseInt(data.semester) : 1,
        created_by: apiUser.nama || apiUser.nip || 'System',
        hari: data.hari || null,
        refleksi: data.refleksi || null,
        guru_pengganti_nip: data.guru_pengganti_nip || null,
        guru_pengganti_nama: data.guru_pengganti_nama || null,
      },
    });

    return serializeBigInt(entry);
  }


  async updateSesi(apiUser: any, sesi_id: string, data: any) {
    // `apiUser` dulu diterima tapi tidak pernah dipakai: siapa pun yang login
    // bisa mengubah status, materi, catatan, refleksi, dan guru pengganti sesi
    // milik guru mana pun.
    const sesi = await this.sesiAtauGagal(sesi_id);
    await this.assertBolehSesi(apiUser, sesi);

    const updateData: any = {
      updated_at: new Date(),
    };
    if (data.status_sesi) updateData.status_sesi = data.status_sesi;
    if (data.materi !== undefined) updateData.materi = data.materi;
    if (data.catatan !== undefined) updateData.catatan = data.catatan;
    if (data.refleksi !== undefined) updateData.refleksi = data.refleksi;
    if (data.guru_pengganti_nip !== undefined) updateData.guru_pengganti_nip = data.guru_pengganti_nip;
    if (data.guru_pengganti_nama !== undefined) updateData.guru_pengganti_nama = data.guru_pengganti_nama;

    const statusKehadiran = String(data.status_kehadiran || data.kategori_kehadiran || '').trim();
    if (statusKehadiran === 'Tukaran') {
      updateData.draft_type = 'TUKARAN';
    } else if (statusKehadiran === 'Diganti') {
      updateData.draft_type = 'DIGANTI';
    } else if (data.guru_pengganti_nip === null) {
      updateData.draft_type = 'DRAFT_DEFAULT';
    }

    const result = await this.prisma.absensi_sesi.update({
      where: { sesi_id },
      data: updateData,
    });

    // Jika guru pengganti dilepaskan/dibatalkan (reclaim), sinkronkan juga ke jurnal guru
    if (data.guru_pengganti_nip === null && result.jurnal_id) {
      try {
        await this.prisma.jurnal_guru.update({
          where: { id: Number(result.jurnal_id) },
          data: {
            guru_pengganti: null,
            status_pengganti: null,
            kategori_kehadiran: 'Sesuai',
            updated_at: new Date(),
          },
        });
      } catch (e: any) {
        this.logger.warn(`Gagal mereset jurnal saat pembatalan pengganti: ${e?.message}`);
      }
    }

    // Jurnal ditulis saat sesi DIFINALKAN, bukan setiap kali disimpan — sesi yang
    // masih draft belum tentu selesai. Sinkronnya sengaja tidak dibungkus dalam
    // transaksi yang sama: kegagalan menulis jurnal tidak boleh membatalkan
    // penyimpanan absensi, yang merupakan data primernya.
    if (result.status_sesi === 'FINAL') {
      try {
        await this.sinkronKeJurnal(result);
      } catch (e: any) {
        this.logger.error(`Gagal menyalin sesi ${sesi_id} ke jurnal: ${e?.message}`);
      }
    }

    return serializeBigInt(result);
  }

  /**
   * Hapus sesi beserta seluruh baris kehadirannya.
   *
   * `apiUser` dulu diterima tapi tidak pernah dipakai — akun siswa pun bisa
   * menghapus sesi absensi guru mana pun, dan `deleteMany` di bawahnya ikut
   * membuang semua catatan kehadiran siswa di sesi itu.
   */
  async deleteSesi(apiUser: any, sesi_id: string) {
    const sesi = await this.sesiAtauGagal(sesi_id);
    await this.assertBolehSesi(apiUser, sesi);

    // Satu transaksi supaya sesi tidak pernah hilang sementara detailnya
    // tertinggal sebagai baris yatim. Lepaskan juga foreign key catatan_siswa.
    await this.prisma.$transaction([
      this.prisma.catatan_siswa.updateMany({
        where: { sesi_id: sesi.sesi_id },
        data: { sesi_id: null },
      }),
      this.prisma.absensi_detail.deleteMany({ where: { sesi_id: sesi.sesi_id } }),
      this.prisma.absensi_sesi.delete({ where: { sesi_id: sesi.sesi_id } }),
    ]);
    return { success: true };
  }

  async getDetail(apiUser: any, sesi_id: string) {
    const sesi = await this.sesiAtauGagal(sesi_id);
    await this.assertBolehSesi(apiUser, sesi);
    const items = await this.prisma.absensi_detail.findMany({
      where: { sesi_id: sesi.sesi_id },
      orderBy: { nama_snapshot: 'asc' },
    });
    return serializeBigInt(items);
  }

  /**
   * Simpan kehadiran satu sesi.
   *
   * Dulu fungsi ini tidak menerima identitas pemanggil sama sekali: siapa pun
   * yang login boleh menulis kehadiran siapa pun di sesi mana pun. Terbukti —
   * akun siswa berhasil mengubah status kehadiran siswa lain pada sesi milik
   * seorang guru dari HADIR menjadi ALPHA, beserta catatan bebas, dan dibalas
   * HTTP 200.
   */
  async upsertDetail(apiUser: any, sesi_id: string, items: any[]) {
    const sesi = await this.sesiAtauGagal(sesi_id);
    await this.assertBolehSesi(apiUser, sesi);

    if (!Array.isArray(items) || items.length === 0) return [];

    const STATUS_SAH = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'];
    for (const item of items) {
      if (!item?.nisn || !String(item.nisn).trim()) {
        throw new BadRequestException('NISN wajib diisi pada setiap baris kehadiran');
      }
      // Sama dengan CHECK constraint `absensi_detail_status_check`. Tanpa ini,
      // nilai di luar daftar hanya ditolak database dan muncul sebagai 500.
      if (item.status && !STATUS_SAH.includes(String(item.status))) {
        throw new BadRequestException(`Status kehadiran tidak valid: ${item.status}`);
      }
    }

    const results = [];
    for (const item of items) {
      const res = await this.prisma.absensi_detail.upsert({
        where: {
          sesi_id_nisn: {
            sesi_id,
            nisn: item.nisn,
          },
        },
        update: {
          status: item.status || 'HADIR',
          otomatis: item.otomatis ?? false,
          ref_ketidakhadiran_id: item.ref_ketidakhadiran_id || null,
          catatan: item.catatan || null,
          updated_at: new Date(),
        },
        create: {
          sesi_id,
          nisn: item.nisn,
          nama_snapshot: item.nama_snapshot || item.nama || 'Siswa',
          status: item.status || 'HADIR',
          otomatis: item.otomatis ?? false,
          ref_ketidakhadiran_id: item.ref_ketidakhadiran_id || null,
          catatan: item.catatan || null,
        },
      });
      results.push(res);
    }
    return serializeBigInt(results);
  }

  async exportAbsensi(apiUser: any, body: any) {
    const { months, year, mode, kelas, guruOption, nip } = body;
    const targetMonths = months || [new Date().getMonth() + 1];

    const getYearFromAcad = (acad: string, m: number) => {
      if (!acad || typeof acad !== 'string' || !acad.includes('/')) return parseInt(acad as any, 10);
      const parts = acad.split('/');
      return m >= 7 ? parseInt(parts[0], 10) : parseInt(parts[1], 10);
    };

    let holidays: any[] = [];
    const hData = await this.prisma.libur.findMany();
    holidays = hData.map((h) => ({
      ...h,
      id: h.id.toString(),
      tanggal: h.tanggal.toISOString().split('T')[0],
    }));

    let joinedData: any[] = [];
    let ketidakhadiran: any[] = [];
    let allSessions: any[] = [];

    if (mode === 'WALI' || (mode === 'ADMIN' && !guruOption)) {
      let targetKelas = kelas;

      if (!apiUser.isAdmin) {
        if (mode === 'ADMIN' && (!kelas || kelas === 'ALL')) {
          throw new ForbiddenException('Hanya admin yang dapat mengekspor seluruh kelas');
        }

        let wakaList = year
          ? await this.prisma.wali_kelas.findMany({ where: { nip: apiUser.nip, tahun_ajaran: year, aktif: true } })
          : [];
        if (wakaList.length === 0) {
          wakaList = await this.prisma.wali_kelas.findMany({ where: { nip: apiUser.nip, aktif: true } });
        }
        const assignedClasses = wakaList.map((w) => w.nama_kelas);
        if (assignedClasses.length === 0) {
          throw new ForbiddenException(`Anda bukan Wali Kelas aktif (NIP: ${apiUser.nip})`);
        }

        if (targetKelas && targetKelas !== 'ALL') {
          if (!assignedClasses.includes(targetKelas)) {
            throw new ForbiddenException(`Anda bukan wali kelas untuk kelas ${targetKelas}`);
          }
        } else {
          targetKelas = assignedClasses[0];
        }
      }

      const classesToFetch =
        apiUser.isAdmin && mode === 'ADMIN' && (!kelas || kelas === 'ALL')
          ? (await this.prisma.master_kelas.findMany({ select: { nama: true } })).map((k) => k.nama)
          : [targetKelas];

      const whereStudent: any = { kelas: { in: classesToFetch }, aktif: true };
      if (year) whereStudent.tahun_ajaran = year;
      const students = await this.prisma.siswa_kelas.findMany({ where: whereStudent });
      const studentNisns = students.map((s) => s.nisn);

      ketidakhadiran = await this.prisma.ketidakhadiran.findMany({
        where: {
          kelas: { in: classesToFetch },
          aktif: true,
        },
      });

      const sessionsRaw = await this.prisma.absensi_sesi.findMany({
        where: {
          status_sesi: 'FINAL',
          kelas: { in: classesToFetch },
        },
        orderBy: { tanggal: 'asc' },
      });

      const sessionIds = sessionsRaw.map((s) => s.sesi_id);
      const detailsRaw = await this.prisma.absensi_detail.findMany({
        where: {
          sesi_id: { in: sessionIds },
          nisn: { in: studentNisns },
        },
      });

      allSessions = sessionsRaw.map((s) => ({
        ...serializeBigInt(s),
        tanggal: s.tanggal.toISOString().split('T')[0],
        absensi_detail: detailsRaw.filter((d) => d.sesi_id === s.sesi_id),
      }));

      const rekapOutput = [];
      for (const kls of classesToFetch) {
        const klsStudents = students.filter((s) => s.kelas === kls);
        for (const m of targetMonths) {
          const actualYear = getYearFromAcad(year, m);
          const days = new Date(actualYear, m, 0).getDate();
          for (let d = 1; d <= days; d++) {
            const dateStr = `${actualYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOff = new Date(actualYear, m - 1, d).getDay() % 6 === 0;

            const dayDetails = klsStudents.map((st) => {
              let status = 'HADIR';
              let keterangan = '';
              const kRec = ketidakhadiran.find(
                (k) =>
                  k.nisn === st.nisn &&
                  k.tgl_mulai.toISOString().split('T')[0] <= dateStr &&
                  k.tgl_selesai.toISOString().split('T')[0] >= dateStr,
              );

              if (kRec) {
                status = (kRec.jenis || '').toUpperCase();
                keterangan = kRec.keterangan || '';
              } else {
                const sOnD = sessionsRaw.filter((s) => s.tanggal.toISOString().split('T')[0] === dateStr);
                const dOnD = detailsRaw.filter((dt) => sOnD.some((s) => s.sesi_id === dt.sesi_id) && dt.nisn === st.nisn);

                if (dOnD.length > 0) {
                  const statusCount: Record<string, number> = {};
                  dOnD.forEach((dt) => {
                    const sVal = (dt.status || 'HADIR').toUpperCase();
                    statusCount[sVal] = (statusCount[sVal] || 0) + 1;
                  });
                  const priority = ['ALPHA', 'SAKIT', 'IZIN', 'HADIR'];
                  let maxVal = -1;
                  let winner = 'HADIR';
                  for (const p of priority) {
                    if ((statusCount[p] || 0) > maxVal) {
                      maxVal = statusCount[p];
                      winner = p;
                    }
                  }
                  status = winner;
                }
              }

              if (dayOff) {
                status = '';
                keterangan = '';
              }

              return { nisn: st.nisn, nama_snapshot: st.nama_siswa, status, keterangan, ref_ketidakhadiran_id: kRec?.id };
            });

            rekapOutput.push({
              sesi_id: `rekap-${kls}-${dateStr}`,
              tanggal: dateStr,
              kelas: kls,
              mapel: 'REKAPITULASI',
              nama_guru: 'Sistem',
              absensi_detail: dayDetails,
            });
          }
        }
      }
      joinedData = rekapOutput;
    } else {
      const kelola = await this.bolehKelola(apiUser);
      const targetNip = kelola && nip ? nip : apiUser.nip;
      const whereSesi: any = { status_sesi: 'FINAL' };

      if (year) {
        whereSesi.tahun_ajaran = year;
      }

      if (mode === 'GURU') {
        // Yang terexport untuk targetNip:
        // 1. Sesi normal milik guru target (nip = targetNip), termasuk sesi yang digantikan oleh guru pengganti
        //    (sesuai aturan: "Mode pengganti tercatat sebagai absensi guru yang digantikan")
        //    Kecuali sesi yang jamnya DITUKAR kepada guru lain
        // 2. Sesi tukaran di mana guru target yang masuk mengajar dan memfinalkan
        whereSesi.OR = [
          {
            nip: targetNip,
            NOT: { draft_type: 'TUKARAN' },
          },
          {
            guru_pengganti_nip: targetNip,
            draft_type: 'TUKARAN',
          },
        ];
        if (kelas) {
          if (Array.isArray(kelas) && kelas.length > 0) {
            whereSesi.kelas = { in: kelas };
          } else if (typeof kelas === 'string' && kelas !== 'ALL') {
            whereSesi.kelas = kelas;
          }
        }
      } else if (kelas && kelas !== 'ALL') {
        if (Array.isArray(kelas)) {
          whereSesi.kelas = { in: kelas };
        } else {
          whereSesi.kelas = kelas;
        }
      }

      const sessionsRaw = await this.prisma.absensi_sesi.findMany({
        where: whereSesi,
        orderBy: { tanggal: 'asc' },
      });

      const sessionIds = sessionsRaw.map((s) => s.sesi_id);
      const detailsRaw = await this.prisma.absensi_detail.findMany({
        where: { sesi_id: { in: sessionIds } },
      });

      joinedData = sessionsRaw.map((s) => {
        const isTukaranSaya = s.guru_pengganti_nip === targetNip && s.draft_type === 'TUKARAN';
        return {
          ...serializeBigInt(s),
          nama_guru: isTukaranSaya ? (s.guru_pengganti_nama || s.nama_guru) : s.nama_guru,
          nip: isTukaranSaya ? s.guru_pengganti_nip : s.nip,
          tanggal: s.tanggal.toISOString().split('T')[0],
          absensi_detail: detailsRaw.filter((d) => d.sesi_id === s.sesi_id),
        };
      });

      if (targetMonths && Array.isArray(targetMonths) && targetMonths.length > 0) {
        const mSet = new Set(targetMonths.map(Number));
        joinedData = joinedData.filter((s) => {
          const parts = (s.tanggal || '').split('-');
          const m = parseInt(parts[1], 10);
          return mSet.has(m);
        });
      }

      const distinctClasses = Array.from(new Set(sessionsRaw.map((s) => s.kelas).filter(Boolean)));
      if (distinctClasses.length > 0) {
        ketidakhadiran = await this.prisma.ketidakhadiran.findMany({
          where: {
            kelas: { in: distinctClasses },
            aktif: true,
          },
        });
      }

      allSessions = joinedData;
    }

    const serializedKetidakhadiran = (ketidakhadiran || []).map((k) => ({
      ...serializeBigInt(k),
      tgl_mulai: k.tgl_mulai instanceof Date ? k.tgl_mulai.toISOString().split('T')[0] : String(k.tgl_mulai || '').split('T')[0],
      tgl_selesai: k.tgl_selesai instanceof Date ? k.tgl_selesai.toISOString().split('T')[0] : String(k.tgl_selesai || '').split('T')[0],
    }));

    return {
      ok: true,
      data: joinedData,
      holidays,
      ketidakhadiran: serializedKetidakhadiran,
      allSessions,
    };
  }

  async getTeacherClasses(nip: string, tahunAjaran?: string) {
    if (!nip) return [];
    const classes = new Set<string>();

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (tahunAjaran && typeof tahunAjaran === 'string') {
      const parts = tahunAjaran.split('/');
      if (parts.length === 2) {
        const y1 = parseInt(parts[0], 10);
        const y2 = parseInt(parts[1], 10);
        if (!isNaN(y1) && !isNaN(y2)) {
          startDate = new Date(`${y1}-07-01T00:00:00.000Z`);
          endDate = new Date(`${y2}-06-30T23:59:59.999Z`);
        }
      }
    }

    // 1. From jadwal_guru
    const whereJadwal: any = { nip, aktif: true };
    if (startDate && endDate) {
      whereJadwal.berlaku_mulai = {
        gte: startDate,
        lte: endDate,
      };
    }
    const jadwalRows = await this.prisma.jadwal_guru.findMany({
      where: whereJadwal,
      select: { kelas: true },
    });
    jadwalRows.forEach((j) => { if (j.kelas) classes.add(j.kelas); });

    // 2. From master_mapel_kelas
    const whereMmk: any = { guru_nip: nip };
    if (tahunAjaran) whereMmk.tahun_ajaran = tahunAjaran;
    const mmkRows = await this.prisma.master_mapel_kelas.findMany({
      where: whereMmk,
      select: { kelas_nama: true },
    });
    mmkRows.forEach((m) => { if (m.kelas_nama) classes.add(m.kelas_nama); });

    // 3. From absensi_sesi (termasuk kelas dari sesi tukaran yang pernah difinalkan guru ini)
    const whereSesi: any = {
      OR: [
        { nip },
        { guru_pengganti_nip: nip, draft_type: 'TUKARAN' },
      ],
    };
    if (tahunAjaran) whereSesi.tahun_ajaran = tahunAjaran;
    const sesiRows = await this.prisma.absensi_sesi.findMany({
      where: whereSesi,
      select: { kelas: true },
    });
    sesiRows.forEach((s) => { if (s.kelas) classes.add(s.kelas); });

    return Array.from(classes).sort();
  }
}

