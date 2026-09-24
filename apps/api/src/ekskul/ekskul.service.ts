import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';

/** Bentuk id di seluruh tabel ekskul — uuid. String lain tidak perlu ke Prisma. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class EkskulService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Express mem-parsing query string dengan `qs`, jadi `?tahun_ajaran[not]=x`
   * tiba sebagai objek dan `?x=a&x=b` sebagai array. Keduanya diteruskan apa
   * adanya ke `where` Prisma bila tidak disaring: yang pertama menyelundupkan
   * operator, yang kedua memicu 500.
   */
  private filterSkalar(value: any): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
  }

  /** `parseInt('abc')` = NaN, dan `where: { semester: NaN }` gagal di Prisma. */
  private angkaBulat(value: any): number | null {
    const n = parseInt(String(Array.isArray(value) ? value[0] : value), 10);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * `BigInt('abc')` melempar SyntaxError dan `BigInt(1.5)` RangeError — keduanya
   * lolos sebagai 500. Dipakai untuk `siswa_id` yang datang dari query/body.
   */
  private idSiswa(value: any): bigint | null {
    const teks = String(Array.isArray(value) ? value[0] : value ?? '').trim();
    if (!/^\d+$/.test(teks)) return null;
    try {
      return BigInt(teks);
    } catch {
      return null;
    }
  }

  private assertUuid(id: any, label: string): string {
    const teks = String(id ?? '').trim();
    if (!POLA_UUID.test(teks)) {
      throw new BadRequestException(`${label} tidak valid`);
    }
    return teks;
  }

  /**
   * Pengelola modul ekskul pada halaman EKSTRAKURIKULER — bukan pada tab mana pun
   * di Master Data, Pengaturan Data, atau Pengaturan Tugas.
   *
   * Cakupannya kini tinggal tiga tempat: `canManageEkskul` (kepemilikan sesi
   * pertemuan dan absensi), pemilihan NIP di `upsertPertemuan`, dan pengesahan
   * laporan di `approveSubmission`. Ketiga tab yang dulu memakainya — Master Data:
   * Ekstrakurikuler, Pengaturan Data: Siswa Ekskul, dan Pengaturan Tugas: Pembina
   * Ekskul — sudah dipindahkan ke Hak Akses Fitur, karena di ketiga halaman itu
   * hanya ADMIN yang boleh melekat di kode.
   */
  isManager(userRoles: string[]) {
    const roles = (userRoles || []).map((r) => String(r).toUpperCase());
    return roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || roles.includes('WKM_KESISWAAN');
  }

  /**
   * `aktif: true` disyaratkan: penugasan pembina yang sudah dinonaktifkan tidak
   * lagi memberi hak baca/tulis atas ekskul itu.
   *
   * CATATAN: masih tidak dibatasi tahun ajaran/semester, jadi pembina tahun lalu
   * tetap bisa membuka data ekskulnya. Itu disengaja untuk sekarang — pembina
   * memang perlu membaca dan mencetak laporan periode sebelumnya.
   */
  async isPembinaOf(nip: string, ekskul_id: string): Promise<boolean> {
    if (!nip || !ekskul_id || !POLA_UUID.test(ekskul_id)) return false;
    const existing = await this.prisma.ekskul_pembina.findFirst({
      where: {
        ekskul_id,
        nip,
        aktif: true,
      },
      select: { id: true },
    });
    return !!existing;
  }

  async resolveOwnSiswaId(nisn: string): Promise<bigint | null> {
    if (!nisn) return null;
    const siswa = await this.prisma.master_siswa.findFirst({
      where: { nisn },
      select: { id: true },
    });
    return siswa ? siswa.id : null;
  }

  // --- Ekskul (Master) ---
  
  async getEkskulList(aktif?: string) {
    const whereClause: any = {};
    if (aktif === 'true') whereClause.aktif = true;
    else if (aktif === 'false') whereClause.aktif = false;

    const ekskulList = await this.prisma.ekskul.findMany({
      where: whereClause,
      orderBy: { nama_ekskul: 'asc' },
    });
    
    return ekskulList;
  }

  async upsertEkskul(data: { id?: string; nama_ekskul: string; aktif?: boolean }) {
    // Di-trim dan dicocokkan tanpa membedakan huruf besar/kecil: tanpa itu
    // " Futsal" dan "futsal" masuk sebagai ekskul yang berbeda, dan peserta
    // terbelah antara dua baris yang bagi pemakainya adalah satu ekskul.
    const nama = String(data.nama_ekskul ?? '').trim();
    if (!nama) {
      throw new BadRequestException('Missing required fields: nama_ekskul');
    }

    if (data.id) {
      const updated = await this.prisma.ekskul.update({
        where: { id: this.assertUuid(data.id, 'id') },
        data: {
          nama_ekskul: nama,
          aktif: data.aktif,
          updated_at: new Date(),
        },
      });
      return updated;
    }

    const existing = await this.prisma.ekskul.findFirst({
      where: { nama_ekskul: { equals: nama, mode: 'insensitive' } },
    });

    if (existing) {
      const updated = await this.prisma.ekskul.update({
        where: { id: existing.id },
        data: { aktif: data.aktif, updated_at: new Date() },
      });
      return updated;
    }

    const created = await this.prisma.ekskul.create({
      data: { nama_ekskul: nama, aktif: data.aktif },
    });
    return created;
  }

  /**
   * Menghapus satu ekskul MENGHAPUS SEMUA yang menempel padanya.
   *
   * `ekskul_siswa`, `ekskul_pembina`, `ekskul_pertemuan` dan
   * `laporan_ekskul_submissions` semuanya `onDelete: Cascade`, dan
   * `ekskul_absensi` ikut terhapus lewat `ekskul_pertemuan` — jadi satu klik bisa
   * melenyapkan ratusan baris kepesertaan beserta laporan yang sudah disahkan,
   * tanpa jejak dan tanpa jalan pulih. Karena itu jumlahnya dihitung lebih dulu
   * dan penghapusannya menuntut `confirm` yang eksplisit; pemanggil tanpa
   * `confirm` menerima daftar apa yang akan hilang, bukan penghapusan.
   */
  async deleteEkskul(id: string, confirm?: string) {
    if (!id) throw new BadRequestException('ID is required');
    const ekskulId = this.assertUuid(id, 'id');

    const ekskul = await this.prisma.ekskul.findUnique({
      where: { id: ekskulId },
      select: { nama_ekskul: true },
    });
    if (!ekskul) throw new NotFoundException('Ekskul tidak ditemukan');

    const [peserta, pembina, pertemuan, laporan] = await Promise.all([
      this.prisma.ekskul_siswa.count({ where: { ekskul_id: ekskulId } }),
      this.prisma.ekskul_pembina.count({ where: { ekskul_id: ekskulId } }),
      this.prisma.ekskul_pertemuan.count({ where: { ekskul_id: ekskulId } }),
      this.prisma.laporan_ekskul_submissions.count({ where: { ekskul_id: ekskulId } }),
    ]);
    const ikutTerhapus = peserta + pembina + pertemuan + laporan;

    if (ikutTerhapus > 0 && confirm !== 'cascade') {
      throw new BadRequestException(
        `Ekskul "${ekskul.nama_ekskul}" masih memiliki ${peserta} peserta, ${pembina} pembina, ` +
          `${pertemuan} pertemuan, dan ${laporan} laporan. Semuanya akan terhapus dan tidak bisa ` +
          `dipulihkan. Nonaktifkan ekskul ini bila hanya ingin menyembunyikannya, atau ulangi ` +
          `dengan konfirmasi bila memang ingin menghapus seluruhnya.`,
      );
    }

    await this.prisma.ekskul.delete({
      where: { id: ekskulId },
    });
    return { ok: true, terhapus: { peserta, pembina, pertemuan, laporan } };
  }

  // --- Ekskul Siswa ---

  async getEkskulSiswaList(
    nip: string,
    nisn: string,
    query: {
      ekskul_id?: string;
      siswa_id?: string;
      tahun_ajaran?: string;
      semester?: string;
      distinct?: string;
    },
    /**
     * Boleh melihat kepesertaan milik orang lain, yaitu pengelola tab "Siswa
     * Ekskul" di Pengaturan Data: role ADMIN (melekat di kode, dijamin
     * `aksesDiizinkan`) atau yang ditunjuk di Hak Akses Fitur.
     *
     * `EkskulService.isManager` TIDAK lagi ikut menentukan di sini. Dulu ia
     * meloloskan WKM_KESISWAAN secara melekat di kode; sekarang satu-satunya peran
     * yang melekat adalah ADMIN, dan sisanya — WKM Kesiswaan termasuk — ditunjuk
     * dari layar Hak Akses Fitur.
     *
     * Bawaannya `false` supaya pemanggil yang belum diperbarui gagal ke arah
     * tertutup.
     */
    bolehKelola = false,
  ) {
    const ekskulId = this.filterSkalar(query.ekskul_id);
    let siswa_id = query.siswa_id ? this.idSiswa(query.siswa_id) ?? undefined : undefined;
    const isMgr = bolehKelola;

    if (!isMgr) {
      const pembinaOfThis = ekskulId ? await this.isPembinaOf(nip, ekskulId) : false;
      if (!pembinaOfThis) {
        const ownId = await this.resolveOwnSiswaId(nisn);
        if (!ownId) {
          throw new NotFoundException('Data siswa tidak ditemukan');
        }
        siswa_id = ownId;
      }
    }

    const whereClause: any = {};
    if (ekskulId) whereClause.ekskul_id = this.assertUuid(ekskulId, 'ekskul_id');
    if (siswa_id !== undefined) whereClause.siswa_id = siswa_id;
    const ta = this.filterSkalar(query.tahun_ajaran);
    if (ta) whereClause.tahun_ajaran = ta;
    const sem = this.angkaBulat(query.semester);
    if (sem !== null) whereClause.semester = sem;

    let result = await this.prisma.ekskul_siswa.findMany({
      where: whereClause,
      // `created_at` sama untuk baris yang masuk dari satu impor; `id` jadi pemutus.
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
    });

    if (result.length > 0) {
      const studentIds = [...new Set(result.map((r) => r.siswa_id))];
      const ekskulIds = [...new Set(result.map((r) => r.ekskul_id).filter(Boolean) as string[])];

      const [siswaData, ekskulData] = await Promise.all([
        this.prisma.master_siswa.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, nama_lengkap: true },
        }),
        this.prisma.ekskul.findMany({
          where: { id: { in: ekskulIds } },
          select: { id: true, nama_ekskul: true },
        }),
      ]);

      const siswaMap: Record<string, string> = {};
      siswaData.forEach((s) => {
        siswaMap[s.id.toString()] = s.nama_lengkap || '';
      });
      const ekskulMap: Record<string, string> = {};
      ekskulData.forEach((e) => {
        ekskulMap[e.id] = e.nama_ekskul;
      });

      let enriched = result.map((r) => ({
        ...r,
        nama_siswa: siswaMap[r.siswa_id.toString()] || r.siswa_id.toString(),
        nama_ekskul: r.ekskul_id ? (ekskulMap[r.ekskul_id] || r.ekskul_id) : null,
      }));

      if (query.distinct === 'true') {
        const seen = new Set<string>();
        enriched = enriched.filter((r) => {
          const key = `${r.siswa_id}_${r.ekskul_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      
      return enriched;
    }
    return result;
  }

  async upsertEkskulSiswa(
    nip: string,
    nisn: string,
    data: {
      id?: string;
      ekskul_id: string;
      siswa_id?: string | bigint;
      tahun_ajaran: string;
      semester: number;
      aktif?: boolean;
    },
    /** Lihat `getEkskulSiswaList` — pengelola tab: ADMIN atau Hak Akses Fitur. */
    bolehKelola = false,
  ) {
    let siswa_id = data.siswa_id ? this.idSiswa(data.siswa_id) ?? undefined : undefined;
    const isMgr = bolehKelola;

    // Siapa pun yang bukan pengelola — termasuk pembina — dipaksa ke `siswa_id`
    // miliknya sendiri. Untuk seorang guru pencarian itu selalu kosong, jadi
    // pembina tidak bisa menambahkan peserta ke ekskulnya dari sini, meski
    // `deleteEkskulSiswa` mengizinkannya mengeluarkan peserta. Ketimpangan itu
    // dibiarkan: pendaftaran peserta memang lewat tab Pengaturan Data (pengelola)
    // atau oleh siswa sendiri.
    if (!isMgr) {
      const ownId = await this.resolveOwnSiswaId(nisn);
      if (!ownId) {
        throw new NotFoundException('Data siswa tidak ditemukan');
      }
      siswa_id = ownId;
    }

    const ekskulId = this.assertUuid(data.ekskul_id, 'ekskul_id');
    const tahunAjaran = this.filterSkalar(data.tahun_ajaran);
    const semester = this.angkaBulat(data.semester);
    if (!siswa_id || !tahunAjaran || semester === null) {
      throw new BadRequestException('Field wajib: ekskul_id, siswa_id, tahun_ajaran, semester');
    }

    if (data.id) {
      const idBaris = this.assertUuid(data.id, 'id');
      if (!isMgr) {
        const row = await this.prisma.ekskul_siswa.findUnique({
          where: { id: idBaris },
          select: { siswa_id: true },
        });
        if (!row || row.siswa_id !== siswa_id) {
          throw new ForbiddenException('Anda tidak memiliki akses atas baris ini.');
        }
      }
      const updated = await this.prisma.ekskul_siswa.update({
        where: { id: idBaris },
        data: { aktif: data.aktif, updated_at: new Date() },
      });
      return updated;
    }

    const existing = await this.prisma.ekskul_siswa.findFirst({
      where: {
        ekskul_id: ekskulId,
        siswa_id,
        tahun_ajaran: tahunAjaran,
        semester,
      },
    });

    if (existing) {
      const updated = await this.prisma.ekskul_siswa.update({
        where: { id: existing.id },
        data: { aktif: data.aktif, updated_at: new Date() },
      });
      return updated;
    }

    const created = await this.prisma.ekskul_siswa.create({
      data: {
        ekskul_id: ekskulId,
        siswa_id,
        tahun_ajaran: tahunAjaran,
        semester,
        aktif: data.aktif,
      },
    });
    return created;
  }

  async deleteEkskulSiswa(
    nip: string,
    nisn: string,
    id: string,
    /** Lihat `getEkskulSiswaList` — pengelola tab: ADMIN atau Hak Akses Fitur. */
    bolehKelola = false,
  ) {
    if (!id) throw new BadRequestException('ID is required');
    const idBaris = this.assertUuid(id, 'id');

    const isMgr = bolehKelola;

    if (!isMgr) {
      const row = await this.prisma.ekskul_siswa.findUnique({
        where: { id: idBaris },
        select: { siswa_id: true, ekskul_id: true },
      });

      if (!row) {
        throw new NotFoundException('Data tidak ditemukan');
      }

      const isPembina = row.ekskul_id ? await this.isPembinaOf(nip, row.ekskul_id) : false;
      const ownId = await this.resolveOwnSiswaId(nisn);

      if (!isPembina && (!ownId || row.siswa_id !== ownId)) {
        throw new ForbiddenException('Anda tidak memiliki akses untuk menghapus peserta ini.');
      }
    }

    await this.prisma.ekskul_siswa.delete({
      where: { id: idBaris },
    });
    return { ok: true };
  }

  // --- Ekskul Pembina ---

  /**
   * Daftar pembina.
   *
   * `userRoles`/`nipPemanggil` wajib: sebelumnya endpoint ini sama sekali tidak
   * memeriksa siapa yang bertanya, sehingga akun siswa mana pun bisa menarik
   * seluruh pasangan NIP + nama guru — dan NIP adalah username login pegawai.
   * Sekarang pengelola melihat semuanya, pegawai lain hanya penugasan miliknya
   * sendiri.
   */
  async getPembinaList(
    bolehKelola: boolean,
    nipPemanggil: string,
    query: { ekskul_id?: string; nip?: string; tahun_ajaran?: string; semester?: string },
  ) {
    const whereClause: any = {};
    const ekskulId = this.filterSkalar(query.ekskul_id);
    if (ekskulId) whereClause.ekskul_id = this.assertUuid(ekskulId, 'ekskul_id');

    const nipDiminta = this.filterSkalar(query.nip);
    if (bolehKelola) {
      if (nipDiminta) whereClause.nip = nipDiminta;
    } else {
      if (!nipPemanggil) {
        throw new ForbiddenException('Anda tidak berwenang melihat daftar pembina ekstrakurikuler.');
      }
      whereClause.nip = nipPemanggil;
    }

    const ta = this.filterSkalar(query.tahun_ajaran);
    if (ta) whereClause.tahun_ajaran = ta;
    const sem = this.angkaBulat(query.semester);
    if (sem !== null) whereClause.semester = sem;

    const result = await this.prisma.ekskul_pembina.findMany({
      where: whereClause,
      include: {
        ekskul: { select: { nama_ekskul: true } },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
    });

    if (result.length > 0) {
      const nips = [...new Set(result.map((r) => r.nip))];
      const guruData = await this.prisma.master_guru.findMany({
        where: { nip: { in: nips } },
        select: { nip: true, nama_lengkap: true },
      });
      const guruMap: Record<string, string> = {};
      guruData.forEach((g) => {
        guruMap[g.nip] = g.nama_lengkap || '';
      });

      return result.map((r) => ({
        ...r,
        nama_guru: guruMap[r.nip] || r.nama_guru || r.nip,
        nama_ekskul: r.ekskul ? r.ekskul.nama_ekskul : null,
      }));
    }

    return result;
  }

  async syncToTugasTambahan(ekskul_id: string, nip: string, nama_guru: string, tahun_ajaran: string, semester: number) {
    const ekskulData = await this.prisma.ekskul.findUnique({
      where: { id: ekskul_id },
      select: { nama_ekskul: true },
    });
    if (!ekskulData) return;

    const jabatan = `Pembina Ekstrakurikuler (${ekskulData.nama_ekskul})`;
    
    const existing = await this.prisma.tugas_tambahan.findFirst({
      where: {
        nip,
        jabatan,
        tahun_ajaran,
        semester,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.tugas_tambahan.update({
        where: { id: existing.id },
        data: {
          nama_guru,
          keterangan: 'Pembina Ekstrakurikuler otomatis dari modul Ekskul',
          approver_role: 'WKM_KESISWAAN',
          granted_role: 'PEMBINA_EKSKUL',
          updated_at: new Date(),
        },
      });
    } else {
      await this.prisma.tugas_tambahan.create({
        data: {
          nip,
          nama_guru,
          jabatan,
          keterangan: 'Pembina Ekstrakurikuler otomatis dari modul Ekskul',
          tahun_ajaran,
          semester,
          approver_role: 'WKM_KESISWAAN',
          granted_role: 'PEMBINA_EKSKUL',
        },
      });
    }
  }

  /**
   * Hapus baris `tugas_tambahan` yang dibuat `syncToTugasTambahan` untuk sebuah
   * penugasan pembina. Dipakai saat penugasannya dihapus ATAU dipindah, karena
   * jabatannya dibentuk dari nama ekskul + periode: memindahkan penugasan tanpa
   * ini meninggalkan pemberian role PEMBINA_EKSKUL yang tidak lagi punya dasar.
   */
  private async hapusTugasTambahanPembina(
    ekskul_id: string | null,
    nip: string,
    tahun_ajaran: string,
    semester: number,
  ) {
    if (!ekskul_id) return;
    const ekskul = await this.prisma.ekskul.findUnique({
      where: { id: ekskul_id },
      select: { nama_ekskul: true },
    });
    if (!ekskul) return;
    await this.prisma.tugas_tambahan.deleteMany({
      where: {
        nip,
        jabatan: `Pembina Ekstrakurikuler (${ekskul.nama_ekskul})`,
        tahun_ajaran,
        semester,
      },
    });
  }

  async upsertPembina(
    data: { id?: string; ekskul_id: string; nip: string; nama_guru: string; tahun_ajaran: string; semester: number; aktif?: boolean },
    /**
     * Pengelola tab "Pembina Ekskul" di Pengaturan Tugas: role ADMIN (melekat di
     * kode) atau ditunjuk di Hak Akses Fitur. WKM Kesiswaan tidak lagi melekat —
     * perlu ditunjuk seperti role lainnya. Bawaannya `false` supaya pemanggil yang
     * belum diperbarui gagal ke arah tertutup.
     */
    bolehKelola = false,
  ) {
    if (!bolehKelola) {
      throw new ForbiddenException(
        'Anda tidak berwenang mengelola pembina ekskul. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }

    const ekskulId = this.assertUuid(data.ekskul_id, 'ekskul_id');
    const nip = String(data.nip ?? '').trim();
    const tahunAjaran = this.filterSkalar(data.tahun_ajaran);
    const semester = this.angkaBulat(data.semester);
    if (!nip || !tahunAjaran || semester === null) {
      throw new BadRequestException('Field wajib: ekskul_id, nip, tahun_ajaran, semester');
    }

    // NIP diverifikasi dan namanya DIAMBIL dari master, tidak dari badan
    // permintaan. Fungsi ini menulis `tugas_tambahan` dengan
    // `granted_role: 'PEMBINA_EKSKUL'`, jadi NIP yang salah tulis bukan cuma
    // baris yatim — ia pemberian role atas identitas yang tidak ada.
    const guru = await this.prisma.master_guru.findFirst({
      where: { nip },
      select: { nip: true, nama_lengkap: true },
    });
    if (!guru) {
      throw new BadRequestException(`NIP ${nip} tidak ditemukan di Master Data Guru/Pegawai`);
    }
    const namaGuru = guru.nama_lengkap || '';

    let result;

    if (data.id) {
      const idBaris = this.assertUuid(data.id, 'id');
      const sebelum = await this.prisma.ekskul_pembina.findUnique({
        where: { id: idBaris },
        select: { ekskul_id: true, nip: true, tahun_ajaran: true, semester: true },
      });
      if (!sebelum) throw new NotFoundException('Penugasan pembina tidak ditemukan');

      result = await this.prisma.ekskul_pembina.update({
        where: { id: idBaris },
        data: {
          ekskul_id: ekskulId,
          nip,
          nama_guru: namaGuru,
          tahun_ajaran: tahunAjaran,
          semester,
          aktif: data.aktif,
          updated_at: new Date(),
        },
      });

      const berpindah =
        sebelum.ekskul_id !== ekskulId ||
        sebelum.nip !== nip ||
        sebelum.tahun_ajaran !== tahunAjaran ||
        sebelum.semester !== semester;
      if (berpindah) {
        await this.hapusTugasTambahanPembina(
          sebelum.ekskul_id,
          sebelum.nip,
          sebelum.tahun_ajaran,
          sebelum.semester,
        );
      }
    } else {
      const existing = await this.prisma.ekskul_pembina.findFirst({
        where: {
          ekskul_id: ekskulId,
          nip,
          tahun_ajaran: tahunAjaran,
          semester,
        },
      });

      if (existing) {
        result = await this.prisma.ekskul_pembina.update({
          where: { id: existing.id },
          data: {
            nama_guru: namaGuru,
            aktif: data.aktif,
            updated_at: new Date(),
          },
        });
      } else {
        result = await this.prisma.ekskul_pembina.create({
          data: {
            ekskul_id: ekskulId,
            nip,
            nama_guru: namaGuru,
            tahun_ajaran: tahunAjaran,
            semester,
            aktif: data.aktif,
          },
        });
      }
    }

    await this.syncToTugasTambahan(ekskulId, nip, namaGuru, tahunAjaran, semester);
    return result;
  }

  async deletePembina(id: string, bolehKelola = false) {
    if (!bolehKelola) {
      throw new ForbiddenException(
        'Anda tidak berwenang menghapus pembina ekskul. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }
    if (!id) throw new BadRequestException('ID is required');
    const idBaris = this.assertUuid(id, 'id');

    const pembinaData = await this.prisma.ekskul_pembina.findUnique({
      where: { id: idBaris },
      include: { ekskul: true },
    });

    if (pembinaData && pembinaData.ekskul) {
      await this.prisma.tugas_tambahan.deleteMany({
        where: {
          nip: pembinaData.nip,
          jabatan: `Pembina Ekstrakurikuler (${pembinaData.ekskul.nama_ekskul})`,
          tahun_ajaran: pembinaData.tahun_ajaran,
          semester: pembinaData.semester,
        },
      });
    }

    await this.prisma.ekskul_pembina.delete({
      where: { id: idBaris },
    });
    return { ok: true };
  }

  // --- Pertemuan & Absensi ---

  async canManageEkskul(user: any, ekskul_id: string): Promise<boolean> {
    if (this.isManager(user.roles || [])) return true;
    const nip = user.nip || '';
    return this.isPembinaOf(nip, ekskul_id);
  }

  async getPertemuanList(user: any, query: { ekskul_id?: string; submission_id?: string; tahun_ajaran?: string; semester?: string }) {
    const { ekskul_id, submission_id, tahun_ajaran, semester } = query;

    if (!ekskul_id && !submission_id) {
      throw new BadRequestException('ekskul_id atau submission_id wajib diisi');
    }

    if (submission_id) {
      const rows = await this.prisma.ekskul_pertemuan.findMany({
        where: { submission_id: this.assertUuid(submission_id, 'submission_id') },
        include: {
          ekskul_absensi: { select: { id: true, status: true } },
        },
        orderBy: { tanggal: 'desc' },
      });

      if (rows.length > 0 && !(await this.canManageEkskul(user, rows[0].ekskul_id))) {
        throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
      }

      return rows.map((r) => ({
        ...r,
        tanggal: r.tanggal ? r.tanggal.toISOString().split('T')[0] : null,
      }));
    }

    const ekskulId = this.assertUuid(ekskul_id, 'ekskul_id');
    if (!(await this.canManageEkskul(user, ekskulId))) {
      throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
    }

    const where: any = { ekskul_id: ekskulId };
    const ta = this.filterSkalar(tahun_ajaran);
    if (ta) where.tahun_ajaran = ta;
    const sem = this.angkaBulat(semester);
    if (sem !== null) where.semester = sem;

    const rows = await this.prisma.ekskul_pertemuan.findMany({
      where,
      include: {
        ekskul_absensi: { select: { id: true, status: true } },
      },
      orderBy: { tanggal: 'desc' },
    });

    return rows.map((r) => ({
      ...r,
      tanggal: r.tanggal ? r.tanggal.toISOString().split('T')[0] : null,
    }));
  }

  async upsertPertemuan(user: any, body: any) {
    const { id, ekskul_id, tanggal, pertemuan_ke, materi, catatan, dokumentasi, tahun_ajaran, semester, nama_guru, status_pelatih } = body;

    const ekskulId = this.assertUuid(ekskul_id, 'ekskul_id');
    const tahunAjaran = this.filterSkalar(tahun_ajaran);
    const sem = this.angkaBulat(semester);
    if (!tanggal || !tahunAjaran || sem === null) {
      throw new BadRequestException('Field wajib: ekskul_id, tanggal, tahun_ajaran, semester');
    }

    // `new Date('bukan tanggal')` menghasilkan Invalid Date, yang baru meledak di
    // dalam Prisma sebagai 500 — dan di sini nilainya juga dipakai sebagai kunci
    // pencarian `ekskul_id_tanggal`.
    const dateObj = new Date(tanggal);
    if (Number.isNaN(dateObj.getTime())) {
      throw new BadRequestException('Tanggal pertemuan tidak valid');
    }

    if (!(await this.canManageEkskul(user, ekskulId))) {
      throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
    }

    // Pada penyuntingan, wewenangnya diperiksa TERHADAP BARIS YANG TERSIMPAN,
    // bukan terhadap `ekskul_id` di badan permintaan. Tanpa ini, pembina ekskul A
    // cukup mengirim id pertemuan ekskul B beserta `ekskul_id` miliknya sendiri:
    // pemeriksaan di atas lolos, lalu pertemuan ekskul B ditimpa dan dipindahkan
    // ke ekskul A.
    let idBaris: string | null = null;
    if (id) {
      idBaris = this.assertUuid(id, 'id');
      const sebelum = await this.prisma.ekskul_pertemuan.findUnique({
        where: { id: idBaris },
        select: { ekskul_id: true },
      });
      if (!sebelum) throw new NotFoundException('Pertemuan tidak ditemukan');
      if (!(await this.canManageEkskul(user, sebelum.ekskul_id))) {
        throw new ForbiddenException('Anda bukan pembina ekstrakurikuler pertemuan ini.');
      }
      if (sebelum.ekskul_id !== ekskulId) {
        throw new BadRequestException('Pertemuan tidak bisa dipindahkan ke ekskul lain.');
      }
    }

    const isMgr = this.isManager(user.roles || []);
    const nip = isMgr ? (body.nip || user.nip) : user.nip;

    const payload: any = {
      ekskul_id: ekskulId,
      tanggal: dateObj,
      pertemuan_ke: this.angkaBulat(pertemuan_ke),
      materi: materi || null,
      catatan: catatan || null,
      dokumentasi: Array.isArray(dokumentasi) ? dokumentasi : [],
      nip: nip || '',
      nama_guru: nama_guru || null,
      status_pelatih: status_pelatih === 'Eksternal' ? 'Eksternal' : 'Internal',
      tahun_ajaran: tahunAjaran,
      semester: sem,
      updated_at: new Date(),
    };

    if (idBaris) {
      const updated = await this.prisma.ekskul_pertemuan.update({
        where: { id: idBaris },
        data: payload,
      });
      return {
        ...updated,
        tanggal: updated.tanggal ? updated.tanggal.toISOString().split('T')[0] : null,
      };
    }

    const existing = await this.prisma.ekskul_pertemuan.findUnique({
      where: {
        ekskul_id_tanggal: {
          ekskul_id: ekskulId,
          tanggal: dateObj,
        },
      },
    });

    if (existing) {
      const updated = await this.prisma.ekskul_pertemuan.update({
        where: { id: existing.id },
        data: payload,
      });
      return {
        ...updated,
        tanggal: updated.tanggal ? updated.tanggal.toISOString().split('T')[0] : null,
      };
    }

    const created = await this.prisma.ekskul_pertemuan.create({
      data: payload,
    });
    return {
      ...created,
      tanggal: created.tanggal ? created.tanggal.toISOString().split('T')[0] : null,
    };
  }

  async deletePertemuan(user: any, id: string) {
    if (!id) throw new BadRequestException('ID wajib diisi');
    const idBaris = this.assertUuid(id, 'id');

    const row = await this.prisma.ekskul_pertemuan.findUnique({
      where: { id: idBaris },
      select: { ekskul_id: true },
    });

    if (!row) throw new NotFoundException('Pertemuan tidak ditemukan');
    if (!(await this.canManageEkskul(user, row.ekskul_id))) {
      throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
    }

    await this.prisma.ekskul_pertemuan.delete({ where: { id: idBaris } });
    return { ok: true };
  }

  async getAbsensiPertemuan(user: any, pertemuanId: string) {
    if (!pertemuanId) throw new BadRequestException('pertemuan_id wajib diisi');
    const idPertemuan = this.assertUuid(pertemuanId, 'pertemuan_id');

    const pertemuan = await this.prisma.ekskul_pertemuan.findUnique({
      where: { id: idPertemuan },
      select: { ekskul_id: true, tanggal: true, tahun_ajaran: true, semester: true },
    });

    if (!pertemuan) throw new NotFoundException('Pertemuan tidak ditemukan');
    if (!(await this.canManageEkskul(user, pertemuan.ekskul_id))) {
      throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
    }

    const tanggalStr = pertemuan.tanggal ? pertemuan.tanggal.toISOString().split('T')[0] : '';
    const dateObj = pertemuan.tanggal;

    // 1. Peserta aktif ekskul
    const pesertaRows = await this.prisma.ekskul_siswa.findMany({
      where: {
        ekskul_id: pertemuan.ekskul_id,
        tahun_ajaran: pertemuan.tahun_ajaran,
        semester: parseInt(String(pertemuan.semester), 10),
        aktif: true,
      },
      select: { siswa_id: true },
    });

    const siswaIds = Array.from(new Set(pesertaRows.map((r) => r.siswa_id)));

    // 2. Info siswa
    const siswaInfo: Record<string, { nama: string; nisn: string }> = {};
    if (siswaIds.length > 0) {
      const ms = await this.prisma.master_siswa.findMany({
        where: { id: { in: siswaIds } },
        select: { id: true, nama_lengkap: true, nisn: true },
      });
      ms.forEach((s) => {
        siswaInfo[s.id.toString()] = { nama: s.nama_lengkap || '', nisn: s.nisn || '' };
      });
    }

    // 3. Status tersimpan
    const savedRows = await this.prisma.ekskul_absensi.findMany({
      where: { pertemuan_id: idPertemuan },
      select: { siswa_id: true, status: true, catatan: true },
    });
    const savedMap: Record<string, { status: string; catatan: string | null }> = {};
    savedRows.forEach((r) => {
      savedMap[r.siswa_id.toString()] = { status: r.status, catatan: r.catatan };
    });

    // 4. Ketidakhadiran
    const nisnList = siswaIds.map((id) => siswaInfo[id.toString()]?.nisn).filter(Boolean) as string[];
    const absenByNisn: Record<string, string> = {};
    if (nisnList.length > 0 && dateObj) {
      const khRows = await this.prisma.ketidakhadiran.findMany({
        where: {
          nisn: { in: nisnList },
          aktif: true,
          tgl_mulai: { lte: dateObj },
          tgl_selesai: { gte: dateObj },
        },
        select: { nisn: true, jenis: true },
      });

      khRows.forEach((r) => {
        if (r.nisn) {
          const existing = (absenByNisn[r.nisn] || '').toUpperCase();
          const current = (r.jenis || '').toUpperCase();
          if (!existing) {
            absenByNisn[r.nisn] = r.jenis;
          } else if (current.includes('SAKIT')) {
            absenByNisn[r.nisn] = r.jenis;
          } else if ((current.includes('ALPA') || current.includes('ALFA')) && !existing.includes('SAKIT')) {
            absenByNisn[r.nisn] = r.jenis;
          }
        }
      });
    }

    const jenisToStatus = (jenis: string): 'S' | 'I' | 'A' => {
      const j = String(jenis || '').toUpperCase();
      if (j.includes('SAKIT')) return 'S';
      if (j.includes('ALPA') || j.includes('ALFA') || j.includes('TANPA')) return 'A';
      return 'I';
    };

    // 5. Rakit hasil
    const data = siswaIds.map((id) => {
      const idStr = id.toString();
      const info = siswaInfo[idStr] || { nama: idStr, nisn: '' };
      const saved = savedMap[idStr];
      const autoJenis = info.nisn ? absenByNisn[info.nisn] : undefined;
      let status = 'H';
      let auto = false;
      let jenis: string | undefined;

      if (saved) {
        status = saved.status;
      } else if (autoJenis) {
        status = jenisToStatus(autoJenis);
        auto = true;
        jenis = autoJenis;
      }

      return {
        siswa_id: idStr,
        nama_siswa: info.nama,
        nisn: info.nisn,
        status,
        catatan: saved?.catatan ?? null,
        saved: !!saved,
        auto,
        jenis,
      };
    });

    return { ok: true, data, tanggal: tanggalStr };
  }

  async saveAbsensiPertemuan(user: any, body: any) {
    const { pertemuan_id, absensi } = body;
    if (!pertemuan_id || !Array.isArray(absensi)) {
      throw new BadRequestException('Field wajib: pertemuan_id, absensi[]');
    }
    const idPertemuan = this.assertUuid(pertemuan_id, 'pertemuan_id');

    const pertemuan = await this.prisma.ekskul_pertemuan.findUnique({
      where: { id: idPertemuan },
      select: { ekskul_id: true },
    });
    if (!pertemuan) throw new NotFoundException('Pertemuan tidak ditemukan');
    if (!(await this.canManageEkskul(user, pertemuan.ekskul_id))) {
      throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
    }

    const validStatuses = ['H', 'S', 'I', 'A'];

    // Seluruh baris divalidasi SEBELUM satu pun ditulis. Sebelumnya `BigInt()`
    // dipanggil di tengah perulangan, jadi satu `siswa_id` yang tidak berupa angka
    // melempar di tengah jalan: absensi yang sudah tersimpan tetap tersimpan,
    // sisanya tidak, dan pemanggil hanya menerima 500 tanpa tahu sampai mana.
    const baris = absensi
      .filter((a: any) => a && a.siswa_id !== undefined && a.siswa_id !== null && a.siswa_id !== '')
      .map((a: any) => {
        const siswaId = this.idSiswa(a.siswa_id);
        if (siswaId === null) {
          throw new BadRequestException(`siswa_id tidak valid: ${JSON.stringify(a.siswa_id)}`);
        }
        return {
          siswaId,
          status: validStatuses.includes(a.status) ? a.status : 'H',
          catatan: typeof a.catatan === 'string' ? a.catatan : null,
        };
      });

    // Satu transaksi: absensi satu pertemuan disimpan utuh atau tidak sama sekali.
    const saved = await this.prisma.$transaction(
      baris.map((b) =>
        this.prisma.ekskul_absensi.upsert({
          where: {
            pertemuan_id_siswa_id: {
              pertemuan_id: idPertemuan,
              siswa_id: b.siswaId,
            },
          },
          update: {
            status: b.status,
            catatan: b.catatan,
            updated_at: new Date(),
          },
          create: {
            pertemuan_id: idPertemuan,
            siswa_id: b.siswaId,
            status: b.status,
            catatan: b.catatan,
          },
        }),
      ),
    );

    return saved.map((s) => ({ ...s, siswa_id: s.siswa_id.toString() }));
  }

  // --- Submissions & Approval ---

  async approveSubmission(user: any, body: any) {
    if (!this.isManager(user.roles || [])) {
      throw new ForbiddenException('Akses ditolak. Anda bukan pengelola ekstrakurikuler (WKM Kesiswaan / Admin).');
    }

    const { action, id, catatan_reviewer } = body;
    if (!id || !action) {
      throw new BadRequestException('Parameter id dan action wajib diisi');
    }
    const idLaporan = this.assertUuid(id, 'id');

    if (action !== 'approve' && action !== 'revisi') {
      throw new BadRequestException('Aksi tidak dikenali');
    }

    const submission = await this.prisma.laporan_ekskul_submissions.findUnique({
      where: { id: idLaporan },
      select: { status: true },
    });

    if (!submission) throw new NotFoundException('Data laporan tidak ditemukan');

    // Penjaga lama, `status !== 'Menunggu' && action !== 'revisi' && action !== 'approve'`,
    // tidak pernah bisa benar: satu-satunya aksi yang diterima adalah 'approve'
    // atau 'revisi', jadi ruas kedua atau ketiga selalu salah. Akibatnya laporan
    // yang sudah "Disahkan" masih bisa disahkan ulang atau dikembalikan ke
    // "Revisi" tanpa penolakan.
    // Yang ditutup hanya pengesahan ULANG — tanggal dan nama pengesahnya akan
    // tertimpa tanpa alasan. 'revisi' tetap dibuka justru karena itulah jalan
    // mengembalikan laporan yang sudah disahkan untuk diperbaiki.
    if (submission.status === 'Disahkan' && action === 'approve') {
      throw new BadRequestException(
        'Laporan ini sudah disahkan. Kembalikan ke Revisi lebih dulu bila perlu diubah.',
      );
    }

    let newStatus = '';
    const payload: any = { updated_at: new Date() };

    if (action === 'approve') {
      newStatus = 'Disahkan';
      payload.status = newStatus;
      payload.catatan_reviewer = null;
      payload.approved_at = new Date();
      payload.approved_by_name = user.nama_lengkap || user.nama || 'Admin';
      // `approved_by` bertipe uuid dan dibaca kembali lewat `auth_id`
      // (lihat `getReportData`), jadi yang harus disimpan adalah `auth_id`.
      // Sebelumnya di sini dipakai `user.id` — bigint `public_users.id` — yang
      // tidak pernah lolos uji bentuk uuid, sehingga kolom ini selalu tetap NULL
      // dan NIP pengesah tidak pernah muncul di laporan yang dicetak.
      if (user.auth_id && POLA_UUID.test(String(user.auth_id))) {
        payload.approved_by = String(user.auth_id);
      }
    } else {
      newStatus = 'Revisi';
      payload.status = newStatus;
      payload.catatan_reviewer = catatan_reviewer || 'Silakan perbaiki laporan Anda';
    }

    await this.prisma.laporan_ekskul_submissions.update({
      where: { id: idLaporan },
      data: payload,
    });

    return { ok: true, status: newStatus };
  }

  /**
   * Data lengkap untuk laporan PDF.
   *
   * WEWENANG: sebelumnya fungsi ini menerima `user` tapi tidak pernah
   * memakainya — satu-satunya syarat adalah punya token. Akun siswa atau orang
   * tua mana pun bisa mengirim `submissionId`/`ekskul_id` apa saja dan menerima
   * seluruh isi laporan: tiap pertemuan, tiap baris absensi beserta `siswa_id`,
   * nama pembina, sampai profil sekolah. Sekarang syaratnya sama dengan
   * `getPertemuanList`, yaitu pengelola atau pembina ekskul yang bersangkutan —
   * persis seperti yang sudah dianggap benar oleh layar Ekstrakurikuler, yang
   * hanya menampilkan tombol cetak kepada kedua kelompok itu.
   */
  async getReportData(user: any, body: any) {
    const { submissionId, nip: bodyNip, ekskul_id: bodyEkskulId, bulan: bodyBulan, tahun: bodyTahun, nama_guru: bodyNamaGuru } = body;

    let submission: any;
    let entries: any[] = [];

    if (submissionId) {
      submission = await this.prisma.laporan_ekskul_submissions.findUnique({
        where: { id: this.assertUuid(submissionId, 'submissionId') },
        include: { ekskul: { select: { nama_ekskul: true } } },
      });

      if (!submission) throw new NotFoundException('Ajuan tidak ditemukan.');
      if (
        !submission.ekskul_id ||
        !(await this.canManageEkskul(user, submission.ekskul_id))
      ) {
        throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
      }

      entries = await this.prisma.ekskul_pertemuan.findMany({
        where: { submission_id: submission.id },
        orderBy: [{ tanggal: 'asc' }, { id: 'asc' }],
        include: {
          ekskul_absensi: {
            select: { siswa_id: true, status: true },
          },
        },
      });
    } else {
      const ekskulId = this.assertUuid(bodyEkskulId, 'ekskul_id');
      if (!(await this.canManageEkskul(user, ekskulId))) {
        throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
      }

      const now = new Date();
      const bulanNum = Number(bodyBulan) || now.getMonth() + 1;
      const tahunNum = Number(bodyTahun) || now.getFullYear();

      const ekskul = await this.prisma.ekskul.findUnique({
        where: { id: ekskulId },
        select: { nama_ekskul: true },
      });

      submission = {
        id: null,
        ekskul_id: ekskulId,
        pembina_nip: bodyNip,
        pembina_nama: bodyNamaGuru || '',
        bulan: bulanNum,
        tahun: tahunNum,
        status: 'Draft',
        catatan_pembina: '',
        ekskul: { nama_ekskul: ekskul?.nama_ekskul || 'Ekstrakurikuler' },
      };

      const startOfMonth = new Date(tahunNum, bulanNum - 1, 1);
      const endOfMonth = new Date(tahunNum, bulanNum, 0);

      const where: any = {
        ekskul_id: ekskulId,
        tanggal: { gte: startOfMonth, lte: endOfMonth },
      };
      const nipFilter = this.filterSkalar(bodyNip);
      if (nipFilter) where.nip = nipFilter;

      entries = await this.prisma.ekskul_pertemuan.findMany({
        where,
        orderBy: [{ tanggal: 'asc' }, { id: 'asc' }],
        include: {
          ekskul_absensi: {
            select: { siswa_id: true, status: true },
          },
        },
      });
    }

    // Ambil metadata profil sekolah untuk KOP
    const profil = await this.prisma.profil_sekolah.findFirst();

    // Serialize bigints in absensi
    const serializedEntries = entries.map((e) => ({
      ...e,
      tanggal: e.tanggal ? e.tanggal.toISOString().split('T')[0] : null,
      ekskul_absensi: (e.ekskul_absensi || []).map((a: any) => ({
        ...a,
        siswa_id: a.siswa_id.toString(),
      })),
    }));

    let guruName = submission.pembina_nama || '-';
    if (!guruName || guruName === '-') {
      const guru = await this.prisma.master_guru.findFirst({
        where: { nip: submission.pembina_nip },
        select: { nama_lengkap: true },
      });
      guruName = guru?.nama_lengkap || '-';
    }

    let approverName = submission.approved_by_name || '-';
    let approverNip = '-';
    if (submission.approved_by) {
      const approver = await this.prisma.public_users.findFirst({
        where: { auth_id: submission.approved_by },
        select: { nip: true, nama: true },
      });
      approverName = approver?.nama || approverName;
      approverNip = approver?.nip || '-';
    }


    return {
      submission,
      entries: serializedEntries,
      profil,
      guruName,
      approverName,
      approverNip,
    };
  }

  /**
   * WEWENANG: sama seperti `getReportData`, fungsi ini menerima `user` tanpa
   * memakainya. Akibatnya akun mana pun yang punya token bisa menimpa `pdf_url`
   * laporan ekskul mana pun dengan tautan apa pun — dan itu tautan yang dibuka
   * pengelola dari layar Approval, pada tabel yang sekaligus menyimpan catatan
   * pembayaran. Sekarang hanya pengelola atau pembina ekskul itu yang boleh, dan
   * URL-nya harus benar-benar sebuah URL http(s).
   */
  async updatePdfUrl(user: any, submissionId: string, pdfUrl: string) {
    if (!submissionId) throw new BadRequestException('submissionId diperlukan');
    const idLaporan = this.assertUuid(submissionId, 'submissionId');

    const submission = await this.prisma.laporan_ekskul_submissions.findUnique({
      where: { id: idLaporan },
      select: { ekskul_id: true },
    });
    if (!submission) throw new NotFoundException('Ajuan tidak ditemukan.');
    if (!submission.ekskul_id || !(await this.canManageEkskul(user, submission.ekskul_id))) {
      throw new ForbiddenException('Anda bukan pembina ekstrakurikuler ini.');
    }

    const url = String(pdfUrl ?? '').trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('pdf_url harus berupa tautan http atau https');
    }

    const updated = await this.prisma.laporan_ekskul_submissions.update({
      where: { id: idLaporan },
      data: { pdf_url: url, updated_at: new Date() },
    });
    return updated;
  }
}
