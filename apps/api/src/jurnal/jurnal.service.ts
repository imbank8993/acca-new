import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  aksesDiizinkan,
  parseKonfigurasiAkses,
  rolesUser,
  ROLE_ADMIN,
  JURNAL_ACCESS_KEY,
  JURNAL_INPUT_ACCESS_KEY,
  JURNAL_REVIEW_BANDING_ACCESS_KEY,
  JURNAL_GENERATE_ACCESS_KEY,
} from '../auth/feature-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JadwalService } from '../jadwal/jadwal.service';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeBigInt(v);
    }
    return res;
  }
  return obj;
}

const ALLOWED_KOREKSI_FIELDS = new Set([
  'kelas',
  'mata_pelajaran',
  'jam_ke',
  'materi',
  'refleksi',
  'guru_pengganti',
  'kategori_kehadiran',
  'durasi_terlambat',
  // 'keterangan_terlambat' dikeluarkan: kolom itu tidak ada di tabel
  // `jurnal_guru` (kolom keterlambatan yang nyata hanya `durasi_terlambat`,
  // bertipe Int). Bila sampai ikut ditulis, Prisma menolak seluruh transaksi
  // persetujuan sebagai field tak dikenal.
  'status_pengganti',
  'guru_piket',
  'keterangan_tambahan',
]);

/** Kolom bertipe Int di `jurnal_guru`; form banding mengirimkannya sebagai teks. */
const KOREKSI_FIELDS_INT = new Set(['durasi_terlambat']);

/**
 * Ambil nilai baru dari satu item koreksi.
 *
 * Bentuk yang benar-benar tersimpan adalah `{ field, nilai_lama, nilai_baru }` —
 * itu yang dikirim AjukanBandingModal dan disimpan apa adanya oleh createBanding.
 * Kode persetujuan dulu membaca `item.value`, kunci yang tidak pernah ada, jadi
 * syarat `item.value !== undefined` SELALU gagal: banding ditandai APPROVED,
 * guru diberi tahu disetujui, tetapi baris jurnalnya tidak pernah ikut berubah.
 * `value` tetap diterima sebagai cadangan agar data lama (bila ada) tidak tertolak.
 */
function ambilNilaiKoreksi(item: any): any {
  if (!item || typeof item !== 'object') return undefined;
  if (item.nilai_baru !== undefined) return item.nilai_baru;
  if (item.value !== undefined) return item.value;
  return undefined;
}

@Injectable()
export class JurnalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jadwalService: JadwalService,
  ) {}

  /**
   * Apakah pemanggil pengelola jurnal (lihat & ubah milik siapa pun)?
   *
   * Sumbernya Hak Akses Fitur `jurnal_access_config` — kunci yang SUDAH dipakai
   * untuk pengaturan jurnal, generate massal, dan hapus per tanggal. Sebelumnya
   * pemeriksaan di dalam service memakai daftar peran tertanam
   * `['ADMIN','ADMINISTRATOR','OP_JURNAL','KURIKULUM']`, sehingga satu modul
   * punya dua sumber wewenang yang bisa menyimpang. Salah satunya bahkan sudah
   * mati: role KURIKULUM tidak dipegang satu pun akun aktif.
   *
   * Hanya ADMIN yang melekat di kode, dijamin `aksesDiizinkan`.
   */
  /**
   * Apakah pemanggil pengelola jurnal (lihat & ubah milik siapa pun)?
   */
  async bolehKelola(user: any): Promise<boolean> {
    if (!user) return false;
    const row = await this.prisma.site_settings.findUnique({
      where: { key: JURNAL_ACCESS_KEY },
      select: { value: true },
    });
    return aksesDiizinkan(user, parseKonfigurasiAkses(row?.value ?? null));
  }

  /**
   * Apakah pemanggil berhak mengisi input jurnal?
   * Bawaan: PENGURUS_KELAS. Diatur via Hak Akses Fitur `jurnal_input_access_config`.
   */
  async bolehInputJurnal(user: any): Promise<boolean> {
    if (!user) return false;
    const roles = rolesUser(user);
    if (roles.some((r) => ROLE_ADMIN.includes(r))) return true;

    const row = await this.prisma.site_settings.findUnique({
      where: { key: JURNAL_INPUT_ACCESS_KEY },
      select: { value: true },
    });
    if (row?.value) {
      const konfig = parseKonfigurasiAkses(row.value);
      if (aksesDiizinkan(user, konfig)) return true;
    } else {
      if (roles.includes('PENGURUS_KELAS') || roles.includes('PENGURUS KELAS')) return true;
    }
    return this.bolehKelola(user);
  }

  /**
   * Apakah pemanggil berhak meninjau banding jurnal?
   * Bawaan: OP_JURNAL. Diatur via Hak Akses Fitur `jurnal_review_banding_access_config`.
   */
  async bolehReviewBanding(user: any): Promise<boolean> {
    if (!user) return false;
    const roles = rolesUser(user);
    if (roles.some((r) => ROLE_ADMIN.includes(r))) return true;

    const row = await this.prisma.site_settings.findUnique({
      where: { key: JURNAL_REVIEW_BANDING_ACCESS_KEY },
      select: { value: true },
    });
    if (row?.value) {
      const konfig = parseKonfigurasiAkses(row.value);
      if (aksesDiizinkan(user, konfig)) return true;
    } else {
      if (roles.includes('OP_JURNAL')) return true;
    }
    return this.bolehKelola(user);
  }

  /**
   * Apakah pemanggil berhak generate & kelola massal jurnal?
   * Bawaan: OP_JURNAL. Diatur via Hak Akses Fitur `jurnal_generate_access_config`.
   */
  async bolehGenerate(user: any): Promise<boolean> {
    if (!user) return false;
    const roles = rolesUser(user);
    if (roles.some((r) => ROLE_ADMIN.includes(r))) return true;

    const row = await this.prisma.site_settings.findUnique({
      where: { key: JURNAL_GENERATE_ACCESS_KEY },
      select: { value: true },
    });
    if (row?.value) {
      const konfig = parseKonfigurasiAkses(row.value);
      if (aksesDiizinkan(user, konfig)) return true;
    } else {
      if (roles.includes('OP_JURNAL')) return true;
    }
    return this.bolehKelola(user);
  }

  /**
   * Apakah baris ini milik pemanggil?
   *
   * NIP kosong TIDAK dianggap cocok — kalau dibandingkan apa adanya, semua akun
   * tanpa NIP jatuh ke satu keranjang identitas yang sama.
   */
  private miliknya(nipBaris: any, nipUser: any): boolean {
    const a = String(nipBaris ?? '').trim();
    const b = String(nipUser ?? '').trim();
    return a !== '' && b !== '' && a === b;
  }

  /** Kelas yang diwalikan pemanggil. */
  private async kelasWali(nip: string): Promise<string[]> {
    const n = String(nip ?? '').trim();
    if (!n) return [];
    const rows = await this.prisma.wali_kelas.findMany({
      where: { nip: n },
      select: { nama_kelas: true },
    });
    return rows.map((r) => r.nama_kelas).filter(Boolean) as string[];
  }

  /**
   * NIP yang boleh ditanyakan pemanggil lewat `?nip=`.
   *
   * Tanpa ini, rekap kinerja dan jurnal master milik guru mana pun terbuka bagi
   * siapa saja yang login — termasuk akun siswa — hanya dengan menebak NIP.
   */
  private async nipDiizinkan(apiUser: any, nipDiminta: any): Promise<string> {
    const sendiri = String(apiUser?.nip ?? '').trim();
    const diminta = String(nipDiminta ?? '').trim();
    if (!diminta || diminta === sendiri) return sendiri;
    if (await this.bolehKelola(apiUser)) return diminta;
    throw new ForbiddenException('Anda hanya dapat melihat data milik sendiri');
  }

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

  private static readonly NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  private kosong(v: any): boolean {
    return v === null || v === undefined || String(v).trim() === '';
  }

  /**
   * Kelas yang boleh diisi pemanggil lewat Input Jurnal.
   *
   * Pengelola & Guru: kelas mana pun ('semua').
   * Siswa/Pengurus Kelas: kelas aktif siswa yang bersangkutan (reguler & pilihan).
   */
  private async kelasInputDiizinkan(apiUser: any): Promise<string[] | 'semua'> {
    if (await this.bolehKelola(apiUser)) return 'semua';
    const roles = rolesUser(apiUser);
    if (roles.includes('GURU')) return 'semua';

    return this.kelasSiswa(apiUser);
  }

  /** Kelas aktif yang ditempati siswa (reguler dan pilihan/peminatan). */
  private async kelasSiswa(apiUser: any): Promise<string[]> {
    const nisns = [apiUser?.nip, apiUser?.username].filter(Boolean).map((s: any) => String(s).trim());
    const kelasSet = new Set<string>();
    if (apiUser?.kelas && String(apiUser.kelas).trim()) {
      kelasSet.add(String(apiUser.kelas).trim());
    }
    if (nisns.length > 0) {
      const baris = await this.prisma.siswa_kelas.findMany({
        where: { nisn: { in: nisns }, aktif: true },
        select: { kelas: true },
      });
      baris.forEach((b) => {
        if (b.kelas) kelasSet.add(b.kelas);
      });
    }
    return Array.from(kelasSet);
  }

  /**
   * Isi satu atau beberapa slot jurnal — dipakai halaman Input Jurnal & JournalModal.
   *
   * Aturan penggabungannya:
   *  - `kategori_kehadiran` → PENGISI TERAKHIR MENANG.
   *  - `materi` & `refleksi` → GURU/ADMIN MENANG. Siswa hanya boleh mengisinya bila
   *    BELUM ADA satu pun baris di slot itu yang memuatnya.
   *  - `filled_by` menandai siapa yang mengisi ISI.
   */
  async submitJurnal(apiUser: any, body: any) {
    if (!(await this.bolehInputJurnal(apiUser))) {
      throw new ForbiddenException('Anda tidak berwenang mengisi jurnal.');
    }

    const {
      tanggal, kelas, jam_ke_id, nip, nama_guru, mata_pelajaran,
      materi, refleksi, kategori_kehadiran, guru_pengganti,
      keterangan_tambahan, guru_piket, durasi_terlambat, status_pengganti,
      durasi_keluar_awal, status_tambahan_1, status_tambahan_2, status_tambahan_3,
      edit_id_map,
    } = body || {};

    let jamIds: number[] = [];
    if (Array.isArray(body?.selected_hours) && body.selected_hours.length > 0) {
      jamIds = body.selected_hours.map((n: any) => parseInt(String(n), 10)).filter(Number.isFinite);
    } else if (jam_ke_id !== undefined && jam_ke_id !== null && jam_ke_id !== '') {
      jamIds = String(jam_ke_id)
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter(Number.isFinite);
    } else if (body?.jam_ke) {
      jamIds = String(body.jam_ke)
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter(Number.isFinite);
    }

    if (!tanggal || !kelas || jamIds.length === 0) {
      throw new BadRequestException('Parameter tidak lengkap (tanggal, kelas, jam_ke_id)');
    }

    const tgl = new Date(tanggal);
    if (Number.isNaN(tgl.getTime())) throw new BadRequestException('Tanggal tidak valid');

    const izin = await this.kelasInputDiizinkan(apiUser);
    const kelola = izin === 'semua';
    if (!kelola) {
      if (!izin.length) {
        throw new ForbiddenException('Anda tidak berwenang mengisi jurnal.');
      }
      if (!izin.includes(String(kelas))) {
        throw new ForbiddenException('Anda hanya dapat mengisi jurnal untuk kelas Anda sendiri.');
      }
    }

    const roles = rolesUser(apiUser);
    const isGuruUser = roles.includes('GURU');
    const authorRole = kelola ? 'ADMIN' : (isGuruUser ? 'GURU' : 'SISWA');
    const nisnPengisi = (kelola || isGuruUser) ? null : String(apiUser?.username ?? '').trim() || null;
    let lastResult: any = null;

    for (const jamId of jamIds) {
      let targetRow: any = null;
      if (edit_id_map && edit_id_map[jamId]) {
        const rowId = parseInt(String(edit_id_map[jamId]), 10);
        if (Number.isFinite(rowId)) {
          targetRow = await this.prisma.jurnal_guru.findUnique({ where: { id: rowId } });
        }
      }

      if (targetRow) {
        // Cek konflik slot jika kelas, tanggal, atau jamId diubah oleh pengelola
        if (kelola) {
          const conflict = await this.prisma.jurnal_guru.findFirst({
            where: {
              tanggal: tgl,
              kelas: String(kelas),
              jam_ke_id: jamId,
              id: { not: targetRow.id },
            },
          });
          if (conflict) {
            throw new BadRequestException(
              `Sudah ada jurnal untuk kelas ${kelas} jam ke-${jamId} pada tanggal tersebut.`,
            );
          }
        }

        const data: any = { updated_at: new Date() };

        if (!this.kosong(kategori_kehadiran)) data.kategori_kehadiran = kategori_kehadiran;
        if (guru_pengganti !== undefined) data.guru_pengganti = guru_pengganti;
        if (keterangan_tambahan !== undefined) data.keterangan_tambahan = keterangan_tambahan;
        if (guru_piket !== undefined) data.guru_piket = guru_piket;
        if (status_pengganti !== undefined) data.status_pengganti = status_pengganti;
        if (durasi_terlambat !== undefined) {
          const n = parseInt(String(durasi_terlambat), 10);
          data.durasi_terlambat = Number.isFinite(n) ? n : null;
        }
        if (durasi_keluar_awal !== undefined) {
          const n = parseInt(String(durasi_keluar_awal), 10);
          data.durasi_keluar_awal = Number.isFinite(n) ? n : null;
        }
        if (status_tambahan_1 !== undefined) data.status_tambahan_1 = status_tambahan_1 || null;
        if (status_tambahan_2 !== undefined) data.status_tambahan_2 = status_tambahan_2 || null;
        if (status_tambahan_3 !== undefined) data.status_tambahan_3 = status_tambahan_3 || null;

        if (materi !== undefined) data.materi = materi;
        if (refleksi !== undefined) data.refleksi = refleksi;

        if (kelola) {
          if (nip) data.nip = String(nip);
          if (nama_guru) data.nama_guru = String(nama_guru);
          if (mata_pelajaran) data.mata_pelajaran = String(mata_pelajaran);
          data.tanggal = tgl;
          data.hari = JurnalService.NAMA_HARI[tgl.getDay()];
          data.kelas = String(kelas);
          data.jam_ke = `Jam Ke-${jamId}`;
          data.jam_ke_id = jamId;
          data.filled_by = 'ADMIN';
        } else if (isGuruUser) {
          data.filled_by = 'GURU';
        }

        lastResult = await this.prisma.jurnal_guru.update({ where: { id: targetRow.id }, data });
      } else {
        const kandidat = await this.prisma.jurnal_guru.findMany({
          where: { tanggal: tgl, kelas: String(kelas), jam_ke_id: jamId },
        });
        const terpilih = kandidat.sort(
          (a, b) =>
            (JurnalService.PRIORITAS_PENGISI[b.filled_by || ''] || 0) -
            (JurnalService.PRIORITAS_PENGISI[a.filled_by || ''] || 0),
        )[0];

        if (terpilih) {
          const data: any = { updated_at: new Date() };

          if (!this.kosong(kategori_kehadiran)) data.kategori_kehadiran = kategori_kehadiran;
          if (guru_pengganti !== undefined) data.guru_pengganti = guru_pengganti;
          if (keterangan_tambahan !== undefined) data.keterangan_tambahan = keterangan_tambahan;
          if (guru_piket !== undefined) data.guru_piket = guru_piket;
          if (status_pengganti !== undefined) data.status_pengganti = status_pengganti;
          if (durasi_terlambat !== undefined) {
            const n = parseInt(String(durasi_terlambat), 10);
            data.durasi_terlambat = Number.isFinite(n) ? n : null;
          }
          if (durasi_keluar_awal !== undefined) {
            const n = parseInt(String(durasi_keluar_awal), 10);
            data.durasi_keluar_awal = Number.isFinite(n) ? n : null;
          }
          if (status_tambahan_1 !== undefined) data.status_tambahan_1 = status_tambahan_1 || null;
          if (status_tambahan_2 !== undefined) data.status_tambahan_2 = status_tambahan_2 || null;
          if (status_tambahan_3 !== undefined) data.status_tambahan_3 = status_tambahan_3 || null;

          const adaMateri = kandidat.some((r) => !this.kosong(r.materi));
          const adaRefleksi = kandidat.some((r) => !this.kosong(r.refleksi));

          if (kelola) {
            if (nip) data.nip = String(nip);
            if (nama_guru) data.nama_guru = String(nama_guru);
            if (mata_pelajaran) data.mata_pelajaran = String(mata_pelajaran);
            if (materi !== undefined) data.materi = materi;
            if (refleksi !== undefined) data.refleksi = refleksi;
            data.filled_by = 'ADMIN';
          } else if (isGuruUser) {
            if (!this.kosong(materi)) data.materi = materi;
            if (!this.kosong(refleksi)) data.refleksi = refleksi;
            if (!this.kosong(materi) || !this.kosong(refleksi)) {
              data.filled_by = 'GURU';
            }
          } else {
            if (!adaMateri && !this.kosong(materi)) data.materi = materi;
            if (!adaRefleksi && !this.kosong(refleksi)) data.refleksi = refleksi;
            const sudahOtoritatif = terpilih.filled_by === 'GURU' || terpilih.filled_by === 'ADMIN';
            if (!sudahOtoritatif && (data.materi || data.refleksi)) data.filled_by = 'SISWA';
            if (nisnPengisi) data.nisn = nisnPengisi;
          }

          lastResult = await this.prisma.jurnal_guru.update({ where: { id: terpilih.id }, data });
        } else {
          let nipSlot = nip;
          let namaSlot = nama_guru;
          let mapelSlot = mata_pelajaran;

          if (!kelola && !isGuruUser) {
            const tglStr = tgl.toISOString().slice(0, 10);
            const jadwal = await this.jadwalService.resolveJadwalBerlaku(
              tglStr,
              JurnalService.NAMA_HARI[tgl.getDay()],
              undefined,
              String(kelas),
            );
            const slot = jadwal.find((j: any) => (parseInt(String(j.jam_ke), 10) || 0) === jamId);
            if (!slot) {
              throw new BadRequestException(
                `Tidak ada jadwal untuk kelas ${kelas} jam ke-${jamId} pada tanggal tersebut.`,
              );
            }
            nipSlot = slot.nip;
            namaSlot = slot.nama_guru;
            mapelSlot = slot.mata_pelajaran;
          }

          if (!nipSlot || !mapelSlot) {
            throw new BadRequestException('Slot jurnal belum ada; nip dan mata_pelajaran wajib diisi.');
          }

          lastResult = await this.prisma.jurnal_guru.create({
            data: {
              nip: String(nipSlot),
              nama_guru: namaSlot || '',
              tanggal: tgl,
              hari: JurnalService.NAMA_HARI[tgl.getDay()],
              jam_ke: `Jam Ke-${jamId}`,
              jam_ke_id: jamId,
              kelas: String(kelas),
              mata_pelajaran: String(mapelSlot),
              materi: materi || '',
              refleksi: refleksi || '',
              kategori_kehadiran: kategori_kehadiran || 'Sesuai',
              guru_pengganti: guru_pengganti || null,
              keterangan_tambahan: keterangan_tambahan || null,
              guru_piket: guru_piket || null,
              status_pengganti: status_pengganti || null,
              durasi_terlambat: this.kosong(durasi_terlambat) ? null : parseInt(String(durasi_terlambat), 10),
              durasi_keluar_awal: this.kosong(durasi_keluar_awal) ? null : parseInt(String(durasi_keluar_awal), 10),
              status_tambahan_1: status_tambahan_1 || null,
              status_tambahan_2: status_tambahan_2 || null,
              status_tambahan_3: status_tambahan_3 || null,
              nisn: nisnPengisi,
              filled_by: authorRole,
              is_generated: false,
            },
          });
        }
      }
    }

    return {
      ok: true,
      success: true,
      data: serializeBigInt(lastResult),
      message: 'Jurnal berhasil disimpan',
    };
  }


  private validRange(startDate: string, endDate: string) {
    const a = new Date(startDate), b = new Date(endDate);
    if (!Number.isFinite(+a) || !Number.isFinite(+b) || b < a || +b - +a > 366 * 86400000) throw new BadRequestException('Rentang tanggal tidak valid atau melebihi satu tahun');
  }
  // --- Settings ---
  async getSettings() {
    let settings = await this.prisma.jurnal_settings.findFirst({
      orderBy: { id: 'asc' },
    });
    if (!settings) {
      settings = await this.prisma.jurnal_settings.create({
        data: {
          is_auto_generate_enabled: true,
          skip_holidays: true,
        },
      });
    }
    return serializeBigInt(settings);
  }

  async updateSettings(body: any, apiUser?: any) {
    if (apiUser && !(await this.bolehGenerate(apiUser))) {
      throw new ForbiddenException('Izin generate & kelola massal jurnal diperlukan');
    }
    const settings = await this.getSettings();
    const updated = await this.prisma.jurnal_settings.update({
      where: { id: settings.id },
      data: {
        is_auto_generate_enabled: body.is_auto_generate_enabled ?? settings.is_auto_generate_enabled,
        generate_start_date: body.generate_start_date ? new Date(body.generate_start_date) : settings.generate_start_date,
        generate_end_date: body.generate_end_date ? new Date(body.generate_end_date) : settings.generate_end_date,
        skip_holidays: body.skip_holidays ?? settings.skip_holidays,
        updated_at: new Date(),
      },
    });
    return serializeBigInt(updated);
  }

  /**
   * Hapus jurnal dalam rentang tanggal.
   *
   * Bawaannya HANYA membuang kerangka kosong — baris tanpa materi dan tanpa
   * refleksi. Sebelumnya penyaringnya cuma tanggal, sehingga "hapus per tanggal"
   * ikut membuang pekerjaan yang sudah ditulis guru dan siswa: untuk rentang
   * Agustus 2026 saja, 785 dari 1024 baris yang terhapus sudah terisi.
   *
   * Yang membuatnya lebih berbahaya daripada kelihatannya: `jurnal_banding`
   * memakai `ON DELETE CASCADE` ke `jurnal_guru`, jadi riwayat banding ikut
   * lenyap tanpa pemberitahuan kepada pengajunya.
   *
   * Menghapus yang sudah terisi tetap mungkin, tetapi harus diminta dengan
   * sadar lewat `termasukTerisi`. Hitungannya dikembalikan supaya layar dapat
   * memperingatkan lebih dulu, bukan memberi tahu setelah data hilang.
   */
  async deleteByDate(
    startDate: string,
    endDate: string,
    apiUser?: any,
    jamKeFilter: number[] = [],
    termasukTerisi = false,
  ) {
    if (!(await this.bolehGenerate(apiUser))) {
      throw new ForbiddenException('Izin generate & kelola massal jurnal diperlukan');
    }
    this.validRange(startDate,endDate);

    const rentang: any = {
      tanggal: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (jamKeFilter && jamKeFilter.length > 0) {
      rentang.jam_ke_id = { in: jamKeFilter };
    }

    /** Baris yang belum diisi siapa pun: materi DAN refleksi sama-sama kosong. */
    const hanyaKerangka = {
      AND: [
        { OR: [{ materi: null }, { materi: '' }] },
        { OR: [{ refleksi: null }, { refleksi: '' }] },
      ],
    };

    const [total, kerangka] = await Promise.all([
      this.prisma.jurnal_guru.count({ where: rentang }),
      this.prisma.jurnal_guru.count({ where: { ...rentang, ...hanyaKerangka } }),
    ]);
    const terisi = total - kerangka;

    const where = termasukTerisi ? rentang : { ...rentang, ...hanyaKerangka };
    const result = await this.prisma.jurnal_guru.deleteMany({ where });

    console.log(
      `[AUDIT] ${apiUser?.username || apiUser?.nip || 'Unknown'} menghapus jurnal ${startDate}..${endDate} ` +
        `— terhapus ${result.count} (kerangka ${kerangka}, terisi ${termasukTerisi ? terisi : 0}), ` +
        `termasukTerisi=${termasukTerisi}`,
    );

    return {
      dihapus: result.count,
      kerangka,
      terisi,
      terisi_dilewati: termasukTerisi ? 0 : terisi,
      termasuk_terisi: termasukTerisi,
    };
  }

  async generateMassal(apiUser: any, startDate: string, endDate: string, jamKeFilter: number[] = []) {
    if (!(await this.bolehGenerate(apiUser))) {
      throw new ForbiddenException('Izin generate & kelola massal jurnal diperlukan');
    }
    this.validRange(startDate,endDate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Log audit actor for generation
    console.log(`[AUDIT] User ${apiUser?.username || apiUser?.nip || 'Unknown'} generating journals from ${startDate} to ${endDate}`);

    const results = {
      generated: 0,
      dilewati_sudah_ada: 0,
      skipped_holiday: 0,
      errors: [] as string[],
    };

    const holidays = await this.prisma.libur.findMany({
      where: {
        tanggal: { gte: start, lte: end },
      },
      select: { tanggal: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.tanggal.toISOString().slice(0, 10)));

    /**
     * Versi jadwal yang berlaku, ditentukan PER TANGGAL.
     *
     * Sebelumnya generate mengambil `jadwal_guru` dengan `aktif: true` saja —
     * tanpa memandang `berlaku_mulai` maupun `versi_id`. Akibatnya jurnal untuk
     * tanggal lampau dibuat memakai jadwal yang saat itu belum berlaku. Ada 14
     * versi di `jadwal_versi` dengan `berlaku_mulai` tersebar dari Januari sampai
     * Agustus, jadi selisihnya bukan teoretis.
     *
     * `resolveJadwalBerlaku` adalah aturan yang sama yang dipakai layar Jadwal:
     * versi `penuh` terakhir sebelum tanggal itu menjadi dasar, lalu versi
     * `parsial` sesudahnya menambal per slot. Dipakai ulang di sini supaya
     * jurnal dan jadwal tidak pernah bercerita berbeda.
     */
    const versiBerlaku = await this.prisma.jadwal_versi.findMany({
      where: { berlaku_mulai: { lte: end } },
      orderBy: { berlaku_mulai: 'asc' },
      select: { id: true, berlaku_mulai: true, jenis: true },
    });

    // Resolusi hanya berubah saat melewati batas versi, jadi hasilnya
    // di-cache per kombinasi versi — bukan per tanggal. Untuk rentang sebulan
    // ini memangkas puluhan resolusi menjadi satu atau dua.
    const cacheJadwal = new Map<string, any[]>();
    const kunciVersi = (refD: Date) => {
      const berlaku = versiBerlaku.filter((v) => v.berlaku_mulai <= refD);
      const penuhList = berlaku.filter((v) => v.jenis === 'penuh');
      const penuh = penuhList.length ? penuhList[penuhList.length - 1] : null;
      const parsial = berlaku.filter(
        (v) => v.jenis === 'parsial' && (!penuh || v.berlaku_mulai >= penuh.berlaku_mulai),
      );
      return `${penuh ? penuh.id : 'none'}:${parsial.map((v) => v.id).join(',')}`;
    };

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      if (holidaySet.has(dateStr)) {
        results.skipped_holiday++;
        continue;
      }

      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[d.getDay()];

      const kunci = kunciVersi(new Date(dateStr));
      if (!cacheJadwal.has(kunci)) {
        cacheJadwal.set(kunci, await this.jadwalService.resolveJadwalBerlaku(dateStr));
      }
      const matchSchedules = cacheJadwal.get(kunci)!.filter((j: any) => j.hari === dayName);

      for (const sch of matchSchedules) {
        const jamId = parseInt(sch.jam_ke, 10) || 0;
        if (jamKeFilter.length > 0 && !jamKeFilter.includes(jamId)) {
          continue;
        }
        try {
          // `update: {}` disengaja: slot yang sudah ada TIDAK pernah disentuh,
          // sehingga generate aman diulang dan tidak menimpa isian guru maupun
          // siswa. Kebalikan dari sinkron absensi, yang memang menimpa.
          const sebelum = await this.prisma.jurnal_guru.findUnique({
            where: {
              kelas_tanggal_jam_ke_id: {
                kelas: sch.kelas,
                tanggal: new Date(dateStr),
                jam_ke_id: jamId,
              },
            },
            select: { id: true },
          });

          if (sebelum) {
            // Dihitung terpisah. Sebelumnya setiap slot yang diproses ikut
            // menambah `generated`, sehingga menjalankan ulang rentang yang sama
            // melaporkan angka sebesar yang pertama padahal tidak membuat apa pun.
            results.dilewati_sudah_ada++;
            continue;
          }

          await this.prisma.jurnal_guru.create({
            data: {
              nip: sch.nip,
              nama_guru: sch.nama_guru,
              tanggal: new Date(dateStr),
              hari: sch.hari,
              jam_ke: sch.jam_ke,
              jam_ke_id: jamId,
              kelas: sch.kelas,
              mata_pelajaran: sch.mata_pelajaran,
              is_generated: true,
              generated_at: new Date(),
              // Kategori kehadiran hasil generate default adalah 'Sesuai'
              kategori_kehadiran: 'Sesuai',
              filled_by: 'SYSTEM',
            },
          });
          results.generated++;
        } catch (e: any) {
          results.errors.push(`${dateStr} ${sch.kelas} jam ${sch.jam_ke}: ${e.message}`);
        }
      }
    }

    return results;
  }

  // --- CRUD Jurnal Guru ---
  /**
   * Daftar jurnal.
   *
   * Dulu tidak menerima identitas pemanggil sama sekali: seluruh penyaringan
   * berasal dari query string, sehingga akun apa pun yang login — termasuk
   * siswa — membaca jurnal seluruh guru, lengkap dengan NIP dan nama. Parameter
   * `wali_nip` bahkan membuat siapa pun bisa menelusuri jurnal kelas yang
   * diwalikan guru lain.
   *
   * Lingkupnya kini ditentukan lebih dulu dan dipasang sebagai `AND`, supaya
   * filter dari query tidak bisa melebarkannya.
   */
  async findAll(apiUser: any, query: any) {
    const { nip, kelas, startDate, endDate, kategori, search, guru_nama, wali_nip } = query || {};
    const where: any = {};
    const kelola = await this.bolehKelola(apiUser);

    if (!kelola) {
      const roles = rolesUser(apiUser);
      const isSiswa = roles.includes('SISWA') || roles.includes('PENGURUS_KELAS') || roles.includes('PENGURUS KELAS');
      const isGuru = roles.includes('GURU');

      if (isSiswa) {
        const kelasSiswa = await this.kelasSiswa(apiUser);
        if (!kelasSiswa.length) return { ok: true, data: [], akses: { kelola } };
        where.kelas = { in: kelasSiswa };
      } else if (isGuru) {
        const nipUser = String(apiUser?.nip ?? '').trim();
        const namaUser = String(apiUser?.nama_lengkap ?? apiUser?.nama ?? '').trim();
        const lingkup: any[] = [];
        if (nipUser) {
          lingkup.push({ nip: nipUser });
          const padded = nipUser.padStart(10, '0');
          if (padded !== nipUser) lingkup.push({ nip: padded });
        }
        if (namaUser) {
          lingkup.push({ nama_guru: { contains: namaUser, mode: 'insensitive' } });
          lingkup.push({ guru_pengganti: { contains: namaUser, mode: 'insensitive' } });
        }
        if (!lingkup.length) return { ok: true, data: [], akses: { kelola } };
        where.AND = [{ OR: lingkup }];
      } else {
        return { ok: true, data: [], akses: { kelola: false } };
      }
    }

    if (nip && kelola) where.nip = String(nip).trim();
    if (kelas) {
      const k = String(kelas).trim();
      if (!kelola) {
        const roles = rolesUser(apiUser);
        const isSiswa = roles.includes('SISWA') || roles.includes('PENGURUS_KELAS') || roles.includes('PENGURUS KELAS');
        if (isSiswa) {
          const kelasSiswa = await this.kelasSiswa(apiUser);
          if (kelasSiswa.includes(k)) {
            where.kelas = k;
          } else {
            return { ok: true, data: [], akses: { kelola } };
          }
        } else {
          where.kelas = k;
        }
      } else {
        where.kelas = k;
      }
    }
    if (guru_nama && kelola) where.nama_guru = { contains: String(guru_nama).trim(), mode: 'insensitive' };
    if (kategori) where.kategori_kehadiran = String(kategori).trim();

    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = new Date(startDate);
      if (endDate) where.tanggal.lte = new Date(endDate);
    }

    if (search) {
      const s = String(search).trim();
      where.OR = [
        { nama_guru: { contains: s, mode: 'insensitive' } },
        { mata_pelajaran: { contains: s, mode: 'insensitive' } },
        { materi: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (wali_nip && kelola) {
      const waliRows = await this.prisma.wali_kelas.findMany({
        where: { nip: String(wali_nip).trim() },
        select: { nama_kelas: true },
      });
      const waliClasses = waliRows.map((w) => w.nama_kelas).filter(Boolean) as string[];
      if (waliClasses.length > 0) {
        where.kelas = { in: waliClasses };
      }
    }

    const data = await this.prisma.jurnal_guru.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { jam_ke_id: 'asc' }],
      take: 2000,
    });

    // `akses` ikut dikirim supaya layar Jurnal tidak lagi menyimpulkan sendiri
    // siapa pengelola dari daftar peran. Sebelumnya UI memakai
    // `isAdmin || isOPJurnal` sementara API memakai Hak Akses Fitur — pengelola
    // yang ditunjuk lewat layar itu tidak akan pernah melihat tombolnya.
    return { ok: true, data: serializeBigInt(data), akses: { kelola } };
  }

  async findById(apiUser: any, id: number) {
    const journal = await this.prisma.jurnal_guru.findUnique({
      where: { id },
      include: { jurnal_banding: true },
    });
    if (!journal) throw new NotFoundException('Jurnal tidak ditemukan');
    await this.assertBolehLihatJurnal(apiUser, journal);
    return { ok: true, data: serializeBigInt(journal) };
  }

  /** Boleh melihat satu baris jurnal: pengelola, pemiliknya, wali kelasnya, atau siswa di kelasnya. */
  private async assertBolehLihatJurnal(apiUser: any, journal: { nip?: string | null; kelas?: string | null; guru_pengganti?: string | null }) {
    if (await this.bolehKelola(apiUser)) return;
    if (this.miliknya(journal.nip, apiUser?.nip)) return;
    if (journal.guru_pengganti) {
      const namaUser = String(apiUser?.nama_lengkap ?? apiUser?.nama ?? '').trim().toLowerCase();
      if (namaUser && String(journal.guru_pengganti).toLowerCase().includes(namaUser)) return;
    }
    if (journal.kelas) {
      const kelasWali = await this.kelasWali(String(apiUser?.nip ?? ''));
      if (kelasWali.includes(journal.kelas)) return;
      const kelasSiswa = await this.kelasSiswa(apiUser);
      if (kelasSiswa.includes(journal.kelas)) return;
    }
    throw new ForbiddenException('Anda tidak berwenang melihat jurnal ini');
  }


  async create(apiUser: any, body: any) {
    const {
      nip,
      nama_guru,
      tanggal,
      hari,
      jam_ke,
      jam_ke_id,
      kelas,
      mata_pelajaran,
      materi,
      refleksi,
      kategori_kehadiran,
      guru_pengganti,
      status_pengganti,
      keterangan_tambahan,
      guru_piket,
      durasi_terlambat,
      durasi_keluar_awal,
      status_tambahan_1,
      status_tambahan_2,
      status_tambahan_3,
    } = body || {};

    // Membuat jurnal juga hanya untuk pengelola. Sebelumnya endpoint ini terbuka
    // bagi siapa pun yang login, dan `nip` diambil dari body — artinya jurnal
    // bisa dibuat ATAS NAMA guru mana pun.
    //
    // Catatan: dalam data yang ada, jalur ini tidak pernah menghasilkan satu
    // baris pun — seluruh 3526 jurnal ber-`is_generated: true`, yaitu hasil
    // generate massal. Pengisian nyatanya lewat `update`, bukan `create`.
    if (!(await this.bolehKelola(apiUser))) {
      throw new ForbiddenException('Jurnal hanya dapat dibuat oleh pengelola jurnal.');
    }

    if (!tanggal || !kelas || !jam_ke || !mata_pelajaran) {
      throw new BadRequestException('Parameter jurnal tidak lengkap (tanggal, kelas, jam_ke, mata_pelajaran)');
    }

    const tgl = new Date(tanggal);
    const authorNip = nip || apiUser?.nip;
    const authorName = nama_guru || apiUser?.nama_lengkap || apiUser?.nama || '';

    const created = await this.prisma.jurnal_guru.create({
      data: {
        nip: authorNip,
        nama_guru: authorName,
        tanggal: tgl,
        hari: hari || JurnalService.NAMA_HARI[tgl.getDay()] || 'Senin',
        jam_ke: String(jam_ke),
        jam_ke_id: jam_ke_id ? parseInt(jam_ke_id, 10) : null,
        kelas: String(kelas).trim(),
        mata_pelajaran: String(mata_pelajaran).trim(),
        materi: materi || null,
        refleksi: refleksi || null,
        kategori_kehadiran: kategori_kehadiran || 'Sesuai',
        guru_pengganti: guru_pengganti || null,
        status_pengganti: status_pengganti || null,
        keterangan_tambahan: keterangan_tambahan || null,
        guru_piket: guru_piket || null,
        durasi_terlambat: durasi_terlambat ? parseInt(String(durasi_terlambat), 10) : null,
        durasi_keluar_awal: durasi_keluar_awal ? parseInt(String(durasi_keluar_awal), 10) : null,
        status_tambahan_1: status_tambahan_1 || null,
        status_tambahan_2: status_tambahan_2 || null,
        status_tambahan_3: status_tambahan_3 || null,
        // Kedua jalur (create & update) kini hanya bisa dicapai pengelola,
        // jadi cabang 'GURU' tidak pernah terjadi lagi.
        filled_by: 'ADMIN',
        is_generated: false,
      },
    });

    return { ok: true, data: serializeBigInt(created), message: 'Jurnal berhasil disimpan' };
  }

  /**
   * Ubah satu jurnal — HANYA pengelola jurnal.
   *
   * Guru sengaja tidak lagi boleh menyunting jurnalnya sendiri. Sebelumnya
   * pemilik baris ikut diloloskan, padahal layar Jurnal sendiri sudah lama
   * menyatakan guru hanya boleh melihat (`canDo` di useJurnal.ts mengembalikan
   * false untuk GURU, SISWA, dan WALI) — jadi aturannya cuma ditegakkan di sisi
   * klien, dan siapa pun yang memanggil API langsung tetap bisa mengubah.
   *
   * Jalur koreksi bagi guru tetap ada dan tidak ditutup: ajukan banding lewat
   * `createBanding`, lalu pengelola yang menerapkannya. Justru itu alasan fitur
   * banding ada.
   */
  async update(apiUser: any, id: number, body: any) {
    const existing = await this.prisma.jurnal_guru.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Jurnal tidak ditemukan');

    if (!(await this.bolehKelola(apiUser))) {
      throw new ForbiddenException(
        'Jurnal hanya dapat diubah oleh pengelola jurnal. Ajukan banding bila ada yang perlu dikoreksi.',
      );
    }

    const {
      nip,
      nama_guru,
      tanggal,
      materi,
      refleksi,
      kategori_kehadiran,
      guru_pengganti,
      keterangan_tambahan,
      guru_piket,
      durasi_terlambat,
      durasi_keluar_awal,
      status_tambahan_1,
      status_tambahan_2,
      status_tambahan_3,
      status_pengganti,
      mata_pelajaran,
      kelas,
      hari,
      jam_ke,
    } = body || {};

    const updated = await this.prisma.jurnal_guru.update({
      where: { id },
      data: {
        ...(nip !== undefined ? { nip: String(nip).trim() } : {}),
        ...(nama_guru !== undefined ? { nama_guru: String(nama_guru).trim() } : {}),
        ...(tanggal !== undefined
          ? {
              tanggal: new Date(tanggal),
              hari: hari || JurnalService.NAMA_HARI[new Date(tanggal).getDay()] || 'Senin',
            }
          : hari !== undefined
          ? { hari }
          : {}),
        ...(materi !== undefined ? { materi } : {}),
        ...(refleksi !== undefined ? { refleksi } : {}),
        ...(kategori_kehadiran !== undefined ? { kategori_kehadiran } : {}),
        ...(guru_pengganti !== undefined ? { guru_pengganti } : {}),
        ...(keterangan_tambahan !== undefined ? { keterangan_tambahan } : {}),
        ...(guru_piket !== undefined ? { guru_piket } : {}),
        ...(durasi_terlambat !== undefined
          ? { durasi_terlambat: durasi_terlambat ? parseInt(String(durasi_terlambat), 10) : null }
          : {}),
        ...(durasi_keluar_awal !== undefined
          ? { durasi_keluar_awal: durasi_keluar_awal ? parseInt(String(durasi_keluar_awal), 10) : null }
          : {}),
        ...(status_tambahan_1 !== undefined ? { status_tambahan_1: status_tambahan_1 || null } : {}),
        ...(status_tambahan_2 !== undefined ? { status_tambahan_2: status_tambahan_2 || null } : {}),
        ...(status_tambahan_3 !== undefined ? { status_tambahan_3: status_tambahan_3 || null } : {}),
        ...(status_pengganti !== undefined ? { status_pengganti } : {}),
        ...(mata_pelajaran !== undefined ? { mata_pelajaran } : {}),
        ...(kelas !== undefined ? { kelas } : {}),
        ...(jam_ke !== undefined ? { jam_ke: String(jam_ke) } : {}),
        updated_at: new Date(),
        // Kedua jalur (create & update) kini hanya bisa dicapai pengelola,
        // jadi cabang 'GURU' tidak pernah terjadi lagi.
        filled_by: 'ADMIN',
      },
    });

    return { ok: true, data: serializeBigInt(updated), message: 'Jurnal berhasil diperbarui' };
  }

  async remove(apiUser: any, id: number) {
    const existing = await this.prisma.jurnal_guru.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Jurnal tidak ditemukan');

    // Sama dengan `update`: guru tidak lagi boleh menghapus jurnalnya sendiri.
    if (!(await this.bolehKelola(apiUser))) {
      throw new ForbiddenException('Jurnal hanya dapat dihapus oleh pengelola jurnal.');
    }

    await this.prisma.jurnal_guru.delete({ where: { id } });
    return { ok: true, message: 'Jurnal berhasil dihapus' };
  }

  /**
   * Isi satu slot jurnal — dipakai halaman Input Jurnal sebelum mengisi.
   *
   * `nip` diwajibkan, divalidasi, lalu TIDAK PERNAH masuk ke query — slotnya
   * unik berdasarkan (kelas, tanggal, jam), bukan guru. Karena itu dulu setiap
   * pengguna yang login bisa membaca satu baris jurnal utuh (materi, refleksi,
   * kategori, nama guru) untuk kelas dan jam mana pun, cukup mengarang NIP.
   *
   * Yang diperiksa sekarang adalah PEMANGGILNYA, bukan penyaringnya: pengelola,
   * guru yang bersangkutan, pengurus kelas dari kelas itu, atau wali kelasnya.
   */
  async checkSlot(apiUser: any, query: any) {
    const { tanggal, kelas, jam_ke_id, nip } = query || {};
    if (!tanggal || !kelas || !jam_ke_id || !nip) {
      throw new BadRequestException('Parameter tidak lengkap (nip, tanggal, kelas, jam_ke_id)');
    }

    if (!(await this.bolehKelola(apiUser))) {
      const nipUser = String(apiUser?.nip ?? '').trim();
      const kelasStr = String(kelas).trim();
      const bolehInput = await this.kelasInputDiizinkan(apiUser);
      const sebagaiPengurus = bolehInput !== 'semua' && bolehInput.includes(kelasStr);
      const sebagaiGuru = !!nipUser && nipUser === String(nip).trim();
      const sebagaiWali = !!nipUser && (await this.kelasWali(nipUser)).includes(kelasStr);
      if (!sebagaiPengurus && !sebagaiGuru && !sebagaiWali) {
        throw new ForbiddenException('Anda tidak berwenang melihat slot jurnal ini');
      }
    }

    const jamIds: number[] = String(jam_ke_id).includes(',')
      ? String(jam_ke_id).split(',').map((id) => parseInt(id.trim(), 10))
      : [parseInt(jam_ke_id, 10)];

    const matches = await this.prisma.jurnal_guru.findMany({
      where: {
        tanggal: new Date(tanggal),
        kelas: String(kelas).trim(),
        jam_ke_id: { in: jamIds },
      },
    });

    const isEmpty = (v: any) => v === null || v === undefined || String(v).trim() === '';
    const sorted = matches.sort((a, b) => {
      const hasA = !isEmpty(a.materi) || !isEmpty(a.refleksi);
      const hasB = !isEmpty(b.materi) || !isEmpty(b.refleksi);
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;

      // Memakai tabel yang sama dengan pemilihan baris di tempat lain.
      const priority = JurnalService.PRIORITAS_PENGISI;
      const pA = priority[a.filled_by || ''] || 0;
      const pB = priority[b.filled_by || ''] || 0;
      return pB - pA;
    });

    return { ok: true, data: serializeBigInt(sorted[0] || null) };
  }

  async getRekap(apiUser: any, query: any) {
    const { nip: nipMinta, from, to } = query || {};
    // `?nip=` bebas dulu membuka rekap kinerja guru mana pun bagi siapa saja
    // yang login — termasuk rincian Terlambat / Kosong per guru.
    const nip = await this.nipDiizinkan(apiUser, nipMinta);
    if (!nip || !from || !to) {
      throw new BadRequestException('NIP, from, and to parameters are required');
    }

    const journals = await this.prisma.jurnal_guru.findMany({
      where: {
        nip: String(nip).trim(),
        tanggal: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      select: { kategori_kehadiran: true },
    });

    const details: Record<string, number> = {};
    let total = 0;
    for (const j of journals) {
      const st = j.kategori_kehadiran || 'Sesuai';
      details[st] = (details[st] || 0) + 1;
      total++;
    }

    return {
      ok: true,
      data: {
        total,
        details,
      },
    };
  }

  // --- Banding Jurnal ---
  async getBanding(apiUser: any, query: any) {
    const { status, nip, mine, counts } = query || {};
    const where: any = {};
    if (status) where.status = String(status).trim();

    const canReview = await this.bolehReviewBanding(apiUser);

    // Tab "Banding Saya" (mine: true) atau jika bukan reviewer:
    // Selalu HANYA menampilkan banding milik guru yang bersangkutan,
    // meskipun akun tersebut memiliki role admin.
    if (!canReview || mine === 'true' || mine === true) {
      where.nip = String(apiUser?.nip ?? '').trim();
    } else if (nip) {
      where.nip = String(nip).trim();
    }

    const data = await this.prisma.jurnal_banding.findMany({
      where,
      include: {
        jurnal_guru: true,
      },
      orderBy: { created_at: 'desc' },
    });

    let statusCounts: any = undefined;
    if (counts === 'true' || counts === true) {
      const whereBase = { ...where };
      delete whereBase.status;
      const allForCounts = await this.prisma.jurnal_banding.findMany({
        where: whereBase,
        select: { status: true },
      });
      statusCounts = {
        total: allForCounts.length,
        PENDING: allForCounts.filter((b) => b.status === 'PENDING').length,
        APPROVED: allForCounts.filter((b) => b.status === 'APPROVED').length,
        REJECTED: allForCounts.filter((b) => b.status === 'REJECTED').length,
      };
    }

    return { ok: true, data: serializeBigInt(data), statusCounts };
  }

  async createBanding(apiUser: any, body: any) {
    const { alasan, koreksi } = body || {};
    const jIdRaw = body?.jurnal_id ?? body?.jurnalId;
    if (!jIdRaw || !alasan) {
      throw new BadRequestException('jurnal_id dan alasan wajib diisi');
    }

    const jId = parseInt(String(jIdRaw), 10);
    const journal = await this.prisma.jurnal_guru.findUnique({ where: { id: jId } });
    if (!journal) throw new NotFoundException('Jurnal tidak ditemukan');

    const canReview = await this.bolehReviewBanding(apiUser);
    if (!canReview && !this.miliknya(journal.nip, apiUser?.nip)) {
      throw new ForbiddenException('Anda hanya dapat mengajukan banding untuk jurnal milik sendiri.');
    }

    const created = await this.prisma.jurnal_banding.create({
      data: {
        jurnal_id: jId,
        nip: journal.nip,
        nama_guru: journal.nama_guru,
        alasan: String(alasan).trim(),
        koreksi: koreksi || [],
        status: 'PENDING',
      },
    });

    return { ok: true, success: true, data: serializeBigInt(created), message: 'Banding berhasil diajukan' };
  }

  async getBandingById(apiUser: any, id: number) {
    const banding = await this.prisma.jurnal_banding.findUnique({
      where: { id },
      include: {
        jurnal_guru: true,
        jurnal_banding_history: true,
      },
    });
    if (!banding) throw new NotFoundException('Data banding tidak ditemukan');
    // Tanpa pemeriksaan ini, siapa pun yang login bisa membaca banding guru lain
    // — termasuk alasan yang ditulis pengaju dan riwayat penanganannya.
    const canReview = await this.bolehReviewBanding(apiUser);
    if (!canReview && !this.miliknya(banding.nip, apiUser?.nip)) {
      throw new ForbiddenException('Anda tidak berwenang melihat banding ini');
    }
    return { ok: true, success: true, data: serializeBigInt(banding) };
  }

  async updateBanding(apiUser: any, id: number, body: any) {
    if (!(await this.bolehReviewBanding(apiUser))) {
      throw new ForbiddenException('Hanya Admin / Role yang berwenang meninjau banding yang dapat memproses.');
    }

    const { status } = body || {};
    const catatan_reviewer = body?.catatan_reviewer ?? body?.catatan;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Status banding harus APPROVED atau REJECTED');
    }

    const banding = await this.prisma.jurnal_banding.findUnique({
      where: { id },
      include: { jurnal_guru: true },
    });
    if (!banding) throw new NotFoundException('Data banding tidak ditemukan');

    const reviewerName = apiUser?.nama_lengkap || apiUser?.nama || 'Admin';

    const result = await this.prisma.$transaction(async (tx) => {
      // If APPROVED, apply corrections to jurnal_guru
      if (status === 'APPROVED' && Array.isArray(banding.koreksi)) {
        const updateData: any = {};
        for (const item of banding.koreksi as any[]) {
          if (!item?.field || !ALLOWED_KOREKSI_FIELDS.has(item.field)) continue;

          const nilai = ambilNilaiKoreksi(item);
          if (nilai === undefined) continue;

          if (KOREKSI_FIELDS_INT.has(item.field)) {
            // Form mengirim angka sebagai teks ("0"). Kolomnya Int, dan Prisma
            // menolak teks — yang berarti seluruh transaksi persetujuan gagal.
            if (nilai === null || nilai === '') {
              updateData[item.field] = null;
            } else {
              const angka = Number(nilai);
              if (!Number.isFinite(angka)) {
                throw new BadRequestException(
                  `Nilai koreksi '${item.field}' bukan angka: ${nilai}`,
                );
              }
              updateData[item.field] = Math.trunc(angka);
            }
            continue;
          }

          updateData[item.field] = nilai;
        }
        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date();
          await tx.jurnal_guru.update({
            where: { id: banding.jurnal_id },
            data: updateData,
          });
        }
      }

      return tx.jurnal_banding.update({
        where: { id },
        data: {
          status,
          reviewed_by: apiUser?.username || apiUser?.nip || 'admin',
          reviewed_by_name: reviewerName,
          reviewed_at: new Date(),
          catatan_reviewer: catatan_reviewer || null,
          updated_at: new Date(),
        },
      });
    });

    return { ok: true, success: true, data: serializeBigInt(result), message: `Banding berhasil ${status.toLowerCase()}` };
  }

  async deleteBanding(apiUser: any, id: number) {
    const banding = await this.prisma.jurnal_banding.findUnique({ where: { id } });
    if (!banding) throw new NotFoundException('Data banding tidak ditemukan');

    const canReview = await this.bolehReviewBanding(apiUser);
    const miliknya = this.miliknya(banding.nip, apiUser?.nip);

    if (!canReview && (!miliknya || banding.status !== 'PENDING')) {
      throw new ForbiddenException('Anda tidak berwenang menghapus pengajuan banding ini');
    }

    await this.prisma.jurnal_banding.delete({ where: { id } });
    return { ok: true, success: true, message: 'Banding berhasil dihapus' };
  }


  async getJurnalMaster(apiUser: any, query: any) {
    const validDate = query.valid_date || new Date().toISOString().split('T')[0];

    /**
     * Penyaring guru — dipaksakan lebih dulu, sebelum query manapun dirakit.
     *
     * Membatasi `?nip=` saja tidak cukup: di bawah ada cabang `else if (namaGuru)`
     * yang menyaring jadwal berdasarkan NAMA tanpa pemeriksaan apa pun. Siapa pun
     * cukup mengganti `?nip=` menjadi `?nama_guru=` dan pembatasannya lewat.
     *
     * Karena itu bagi non-pengelola kedua parameter diabaikan dan diganti NIP
     * sendiri — bukan ditolak, supaya layar tetap berfungsi tanpa perlu tahu
     * siapa dirinya.
     */
    const kelolaMaster = await this.bolehKelola(apiUser);
    const nip = kelolaMaster
      ? query.nip
      : String(apiUser?.nip ?? '').trim() || '__tanpa-nip__';
    const namaGuru = kelolaMaster ? query.nama_guru : undefined;

    const [guru, mapel, kelas, waktu, dropdown] = await Promise.all([
      this.prisma.master_guru.findMany({ where: { aktif: true }, orderBy: { nama_lengkap: 'asc' } }),
      this.prisma.master_mapel.findMany({ where: { aktif: true }, orderBy: { nama: 'asc' } }),
      this.prisma.master_kelas.findMany({ where: { aktif: true }, orderBy: { nama: 'asc' } }),
      this.prisma.master_waktu.findMany({ where: { aktif: true }, orderBy: { jam_ke: 'asc' } }),
      this.prisma.master_dropdown.findMany(),
    ]);

    const whereJadwal: any = { aktif: true };
    if (nip) {
      const paddedNip = nip.padStart(10, '0');
      whereJadwal.OR = [{ nip }, { nip: paddedNip }];
    } else if (namaGuru) {
      whereJadwal.nama_guru = { contains: namaGuru, mode: 'insensitive' };
    }

    const jadwal = await this.prisma.jadwal_guru.findMany({
      where: whereJadwal,
      orderBy: [{ hari: 'asc' }, { jam_ke: 'asc' }],
    });

    const extractOptions = (key: string) =>
      Array.from(new Set(dropdown.map((d: any) => d[key]).filter(Boolean))).map((v: any) => ({ value: v, label: v }));

    const masterData = {
      guru,
      mapel,
      kelas,
      waktu,
      jadwal: serializeBigInt(jadwal),
      dropdown: {
        // `terlambat` dihapus: kolom `keterangan_terlambat` sudah tidak ada di
        // tabel master_dropdown, jadi nilainya selalu larik kosong. Lihat catatan
        // lengkapnya di MasterService.getDropdowns().
        kategoriKehadiran: extractOptions('kategori_kehadiran'),
        statusKetidakhadiran: extractOptions('status_ketidakhadiran'),
        jenisKetidakhadiran: extractOptions('jenis_ketidakhadiran'),
      },
    };

    return { ok: true, data: masterData };
  }
}

