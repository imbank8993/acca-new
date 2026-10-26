import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  JADWAL_GENERATE_KEY,
  TUKAR_JADWAL_REVIEW_KEY,
  aksesDiizinkan,
  parseKonfigurasiAkses,
} from '../auth/feature-access.guard';

export interface JadwalFilterParams {
  nip?: string;
  hari?: string;
  kelas?: string;
  aktif?: string | boolean;
  valid_date?: string;
  berlaku_mulai?: string;
}

export function normNip(nip: string | null | undefined): string {
  return String(nip ?? '').trim().replace(/^0+/, '');
}

export function samaNip(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normNip(a);
  return na !== '' && na === normNip(b);
}

export function toDateOnly(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

const fmtTime = (t: any): string => {
  if (!t) return '';
  if (t instanceof Date) {
    const hh = String(t.getUTCHours()).padStart(2, '0');
    const mm = String(t.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return String(t).substring(0, 5);
};

/**
 * Pecah kunci tugas piket `"<nip>|<hari>|<jam_ke>"` dan VALIDASI isinya.
 *
 * `jadwal_piket.jam_ke` bertipe `Int`, sedangkan kuncinya datang dari badan
 * permintaan (`requester_piket_key` / `target_piket_key`). Sebelumnya bagian jamnya
 * langsung dilewatkan `parseInt(...)` ke `where` Prisma: kunci yang kurang
 * bagiannya atau jamnya bukan angka menghasilkan `NaN`, dan Prisma menolaknya
 * sebagai galat 500 — bukan sebagai masukan yang ditolak dengan alasan jelas.
 */
function pecahKunciPiket(kunci: unknown, label: string): { nip: string; hari: string; jam: number } {
  const bagian = String(kunci ?? '').split('|');
  if (bagian.length !== 3) {
    throw new BadRequestException(`${label} tidak dikenali. Pilih ulang dari daftar.`);
  }
  const [nip, hari, jamTeks] = bagian.map((b) => b.trim());
  if (!nip || !hari || !/^\d+$/.test(jamTeks)) {
    throw new BadRequestException(`${label} tidak dikenali. Pilih ulang dari daftar.`);
  }
  const jam = Number(jamTeks);
  if (!Number.isSafeInteger(jam) || jam < 1) {
    throw new BadRequestException(`${label} memuat jam ke- yang tidak sah.`);
  }
  return { nip, hari, jam };
}


/** Peran yang TIDAK boleh menyentuh fitur tukar jadwal sama sekali. */
const BUKAN_PEGAWAI = ['SISWA', 'ORANG_TUA', 'ORANGTUA'];

function rolesOf(user: any): string[] {
  if (Array.isArray(user?.roles)) {
    return user.roles.map((r: string) => String(r).trim().toUpperCase());
  }
  return String(user?.role || '')
    .split(/[,|]/)
    .map((r: string) => r.trim().toUpperCase())
    .filter(Boolean);
}


function seluruhnyaBukanPegawai(user: any): boolean {
  const roles = rolesOf(user);
  return roles.length > 0 && roles.every((r) => BUKAN_PEGAWAI.includes(r));
}

/**
 * Tukar jadwal adalah urusan antar-pegawai. Siswa & orang tua tidak punya
 * jadwal mengajar, dan endpoint-nya memaparkan jadwal + NIP seluruh guru —
 * jadi mereka ditolak di pintu masuk, bukan hanya disembunyikan di UI.
 */
/**
 * Dipakai fitur tukar jadwal DAN `getScopes`, jadi pesannya tidak boleh menyebut
 * salah satu saja — sebelumnya berbunyi "Fitur tukar jadwal ...", yang menyesatkan
 * ketika yang ditolak sebenarnya permintaan scope dari layar lain.
 */
function pastikanPegawai(user: any): void {
  if (seluruhnyaBukanPegawai(user)) {
    throw new ForbiddenException('Bagian ini hanya untuk guru & pegawai madrasah');
  }
}

@Injectable()
export class JadwalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Boleh meninjau pengajuan tukar jadwal: menyetujui, menolak sebagai peninjau,
   * membatalkan pengajuan orang lain, dan membaca detail pengajuan yang tidak
   * melibatkan dirinya.
   *
   * Sebelumnya daftar rolenya tertanam di kode
   * (`['WKM_AKADEMIK', 'ADMIN', 'ADMINISTRATOR', 'KURIKULUM']`), jadi tidak bisa
   * diubah tanpa deploy dan tidak bisa menunjuk satu orang tertentu. Sekarang
   * mengikuti aturan yang sama dengan halaman pengaturan: hanya ADMIN yang melekat
   * di kode — dijamin `aksesDiizinkan` — dan sisanya, termasuk WKM Akademik dan
   * Kurikulum, ditunjuk di Pengaturan Users -> Hak Akses Fitur.
   *
   * Baris konfigurasi yang belum pernah dibuat berarti ADMIN saja
   * (`parseKonfigurasiAkses` gagal ke arah tertutup).
   */
  async bolehMeninjauTukar(user: any): Promise<boolean> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: TUKAR_JADWAL_REVIEW_KEY },
      select: { value: true },
    });
    return aksesDiizinkan(user, parseKonfigurasiAkses(row?.value));
  }

  // =========================================================================
  // 1. JADWAL PELAJARAN
  // =========================================================================

  /**
   * Kelas yang boleh dilihat akun siswa / orang tua pada tab jadwal.
   *
   * Siswa: kelasnya sendiri. Orang tua: kelas anak-anak yang tertaut ke akunnya.
   * Daftar kosong berarti tidak ada yang boleh dibuka.
   *
   * NISN dibandingkan dengan dan tanpa nol di depan: sebagian tabel menyimpannya
   * ter-pad 10 digit dan sebagian tidak — pola yang sama sudah dipakai
   * `resolveJadwalBerlaku` dan `notifyUserByNip`.
   */
  private async kelasYangBolehDilihat(user: any): Promise<string[]> {
    const roles = rolesOf(user);
    const nisnSet = new Set<string>();

    if (roles.includes('SISWA')) {
      for (const kandidat of [user?.nisn, user?.nip, user?.username]) {
        const nisn = String(kandidat || '').trim();
        if (nisn) {
          nisnSet.add(nisn);
          nisnSet.add(nisn.padStart(10, '0'));
          nisnSet.add(nisn.replace(/^0+/, ''));
        }
      }
    }

    if (roles.some((r) => r === 'ORANG_TUA' || r === 'ORANGTUA')) {
      try {
        const relasi = await this.prisma.orangtua_siswa.findMany({
          where: { user_id: BigInt(user.id) },
          select: { nisn: true },
        });
        for (const r of relasi) {
          const n = String(r.nisn || '').trim();
          if (!n) continue;
          nisnSet.add(n);
          nisnSet.add(n.padStart(10, '0'));
          nisnSet.add(n.replace(/^0+/, ''));
        }
      } catch {
        // `user.id` bukan angka -> tidak ada anak yang bisa ditentukan.
      }
    }

    if (nisnSet.size === 0) return [];

    const rows = await this.prisma.siswa_kelas.findMany({
      where: { nisn: { in: [...nisnSet] }, aktif: true },
      select: { kelas: true },
    });
    return [...new Set(rows.map((r) => String(r.kelas || '').trim()).filter(Boolean))];
  }

  /**
   * `pemanggil` OPSIONAL dan hanya dipakai untuk meredaksi.
   *
   * Respons ini memuat `nip` setiap guru, dan NIP adalah username login pegawai —
   * daftar lengkapnya karena itu tidak perlu sampai ke akun siswa maupun orang tua,
   * yang layar jadwalnya tidak memakai kolom itu sama sekali.
   *
   * Sengaja opsional, bukan wajib: `e-supervisi` dan `kinerja-guru` memanggil
   * fungsi ini dari server untuk mencocokkan guru, dan mereka MEMBUTUHKAN `nip`.
   * Tanpa `pemanggil` tidak ada redaksi, jadi jalur internal itu tidak berubah.
   */
  async getJadwal(params: JadwalFilterParams, pemanggil?: any) {
    /**
     * Akun siswa dan orang tua dibatasi pada kelasnya sendiri / kelas anaknya.
     *
     * Parameter `kelas` dikirim dari klien, jadi tanpa pembatasan ini satu
     * perubahan di devtools cukup untuk membuka jadwal kelas mana pun. Jadwal kelas
     * lain TETAP bisa dilihat, tapi hanya lewat "Jadwal Lengkap", yang memakai
     * endpoint berbeda (`/settings/jadwal-guru` dan `/settings/jadwal-piket`) dan
     * memang dirancang menampilkan seluruh sekolah.
     *
     * `?nip=` ikut ditutup untuk mereka: tab jadwal siswa selalu bertanya dengan
     * `kelas`, jadi tidak ada pemakaian sah yang hilang.
     */
    if (pemanggil && seluruhnyaBukanPegawai(pemanggil)) {
      const bolehKelas = await this.kelasYangBolehDilihat(pemanggil);

      if (params.nip) {
        throw new ForbiddenException(
          'Jadwal per guru tidak tersedia di tampilan ini. Buka "Jadwal Lengkap" untuk melihat '
          + 'jadwal seluruh madrasah.',
        );
      }

      const diminta = String(params.kelas || '').trim();
      if (!diminta) {
        throw new BadRequestException('Kelas wajib diisi');
      }
      const dimintaList = diminta.split(',').map((k) => k.trim()).filter(Boolean);
      const tidakDiizinkan = dimintaList.filter((k) => !bolehKelas.includes(k));
      if (tidakDiizinkan.length > 0) {
        throw new ForbiddenException(
          `Anda tidak terdaftar di kelas ${tidakDiizinkan.join(', ')}. Jadwal kelas lain bisa dilihat lewat `
          + `"Jadwal Lengkap".`,
        );
      }
    }

    const { nip, hari, kelas, aktif, valid_date, berlaku_mulai } = params;

    const isAktif =
      aktif === undefined || aktif === null ? true : aktif === 'true' || aktif === true;

    const referenceDate = valid_date || toDateOnly(new Date());
    const modeVersiTertentu = !!berlaku_mulai || !isAktif;

    let rows: any[] = [];

    if (modeVersiTertentu) {
      const where: any = {
        aktif: isAktif,
      };

      if (berlaku_mulai) {
        where.berlaku_mulai = new Date(berlaku_mulai);
      } else {
        where.berlaku_mulai = { lte: new Date(referenceDate) };
      }

      if (hari) where.hari = hari;

      if (nip) {
        const paddedNip = nip.padStart(10, '0');
        where.OR = [{ nip }, { nip: paddedNip }];
      }

      if (kelas) {
        const kelasArray = kelas.split(',').map((k) => k.trim()).filter(Boolean);
        if (kelasArray.length > 1) {
          where.kelas = { in: kelasArray };
        } else if (kelasArray.length === 1) {
          where.kelas = kelasArray[0];
        }
      }

      rows = await this.prisma.jadwal_guru.findMany({
        where,
        orderBy: [{ hari: 'asc' }, { jam_ke: 'asc' }, { berlaku_mulai: 'desc' }],
      });
    } else {
      // Resolusi Jadwal Berlaku per referenceDate via jadwal_versi
      rows = await this.resolveJadwalBerlaku(referenceDate, hari, nip, kelas);
    }

    // Normalisasi dan Lookup Waktu & Kelas
    if (rows.length === 0) {
      return { ok: true, data: [] };
    }

    const [masterWaktuList, masterKelasList] = await Promise.all([
      this.prisma.master_waktu.findMany({
        where: { aktif: true },
        select: { hari: true, jam_ke: true, program: true, mulai: true, selesai: true },
      }),
      this.prisma.master_kelas.findMany({
        select: { nama: true, program: true, tingkat: true },
      }),
    ]);

    const programOf: Record<string, string> = {};
    for (const k of masterKelasList) {
      if (k.nama) programOf[k.nama] = k.program || 'Reguler';
    }

    const waktuMap: Record<string, { mulai: string; selesai: string; display: string }> = {};
    for (const w of masterWaktuList) {
      const mulai = fmtTime(w.mulai);
      const selesai = fmtTime(w.selesai);
      const display = mulai && selesai ? `${mulai} - ${selesai}` : mulai;
      const key = `${w.hari}|${w.jam_ke}|${w.program || 'Reguler'}`;
      waktuMap[key] = { mulai, selesai, display };
    }

    // Akun yang seluruh perannya bukan pegawai = siswa dan orang tua.
    const redaksiNip = !!pemanggil && seluruhnyaBukanPegawai(pemanggil);

    const normalizedData = rows.map((item) => {
      const prog = programOf[item.kelas] || 'Reguler';
      const waktuKey = `${item.hari}|${parseInt(item.jam_ke, 10) || item.jam_ke}|${prog}`;
      const waktuInfo = waktuMap[waktuKey];

      const mulaiJam = waktuInfo ? waktuInfo.mulai : '';
      const selesaiJam = waktuInfo ? waktuInfo.selesai : '';
      const waktuDisplay = waktuInfo ? waktuInfo.display : '';

      return {
        id: item.id.toString(),
        ...(redaksiNip ? {} : { nip: item.nip }),
        nama_guru: item.nama_guru,
        hari: item.hari,
        jam_ke: item.jam_ke,
        kelas: item.kelas,
        tingkat: masterKelasList.find(k => k.nama === item.kelas)?.tingkat ?? null,
        mata_pelajaran: item.mata_pelajaran,
        mapel: item.mapel || item.mata_pelajaran || '',
        ruang: item.ruang,
        aktif: item.aktif,
        waktu_display: waktuDisplay,
        mulai_jam: mulaiJam,
        selesai_jam: selesaiJam,
        berlaku_mulai: toDateOnly(item.berlaku_mulai),
      };
    });

    return { ok: true, data: normalizedData };
  }

  /**
   * Resolusi Jadwal Berlaku berdasarkan versi penuh dan parsial di jadwal_versi
   */
  public async resolveJadwalBerlaku(
    referenceDate: string,
    filterHari?: string,
    filterNip?: string,
    filterKelas?: string,
  ) {
    const refD = new Date(referenceDate);

    // Ambil daftar versi jadwal_versi <= referenceDate
    const versions = await this.prisma.jadwal_versi.findMany({
      where: { berlaku_mulai: { lte: refD } },
      orderBy: { berlaku_mulai: 'asc' },
    });

    let rows: any[] = [];

    if (versions.length > 0) {
      const penuhList = versions.filter((v) => v.jenis === 'penuh');
      const penuh = penuhList.length > 0 ? penuhList[penuhList.length - 1] : null;

      const parsialList = versions.filter(
        (v) =>
          v.jenis === 'parsial' && (!penuh || v.berlaku_mulai >= penuh.berlaku_mulai),
      );

      const dasar = penuh
        ? await this.prisma.jadwal_guru.findMany({
            where: { versi_id: penuh.id, aktif: true },
          })
        : [];

      const perSlot = new Map<string, any[]>();
      const slotKey = (r: any) =>
        `${String(r.kelas).trim()}|${String(r.hari).trim()}|${parseInt(String(r.jam_ke), 10) || 0}`;

      for (const row of dasar) {
        const k = slotKey(row);
        if (!perSlot.has(k)) perSlot.set(k, []);
        perSlot.get(k)!.push(row);
      }

      for (const p of parsialList) {
        const tambalan = await this.prisma.jadwal_guru.findMany({
          where: { versi_id: p.id, aktif: true },
        });
        const slotTersentuh = new Set(tambalan.map(slotKey));
        for (const k of slotTersentuh) perSlot.set(k, []);
        for (const row of tambalan) perSlot.get(slotKey(row))!.push(row);
      }

      rows = Array.from(perSlot.values()).flat();
    } else {
      // Fallback pra-migrasi: ambil jadwal aktif
      const where: any = {
        aktif: true,
        berlaku_mulai: { lte: refD },
      };
      const allActive = await this.prisma.jadwal_guru.findMany({
        where,
        orderBy: [{ berlaku_mulai: 'desc' }],
      });

      // Dedupe per slot (kelas, hari, jam)
      const slotMap = new Map<string, any>();
      for (const item of allActive) {
        const k = `${String(item.kelas).trim()}|${String(item.hari).trim()}|${parseInt(String(item.jam_ke), 10) || 0}`;
        if (!slotMap.has(k)) {
          slotMap.set(k, item);
        }
      }
      rows = Array.from(slotMap.values());
    }

    // Filter akhir (nip, kelas, hari)
    const normNipFilter = filterNip ? normNip(filterNip) : null;
    const paddedNip = filterNip ? filterNip.padStart(10, '0') : null;
    const kelasList = filterKelas
      ? filterKelas.split(',').map((k) => k.trim()).filter(Boolean)
      : [];

    const filtered = rows.filter((r) => {
      if (filterHari && String(r.hari).trim() !== filterHari.trim()) return false;
      if (normNipFilter) {
        const n = normNip(r.nip);
        if (n !== normNipFilter && r.nip !== filterNip && r.nip !== paddedNip) return false;
      }
      if (kelasList.length > 0) {
        const rKelas = String(r.kelas).trim();
        if (!kelasList.includes(rKelas)) return false;
      }
      return true;
    });

    filtered.sort(
      (a, b) =>
        String(a.hari).localeCompare(String(b.hari)) ||
        (parseInt(a.jam_ke, 10) || 0) - (parseInt(b.jam_ke, 10) || 0),
    );

    return filtered;
  }

  async bulkCreateJadwal(body: any[]) {
    if (!Array.isArray(body)) {
      throw new BadRequestException('Request body harus berupa array data jadwal');
    }

    const dataToInsert = body.map((item) => ({
      nip: String(item.nip || '').trim(),
      nama_guru: String(item.nama_guru || '').trim(),
      hari: String(item.hari || '').trim(),
      jam_ke: String(item.jam_ke || '').trim(),
      kelas: String(item.kelas || '').trim(),
      mata_pelajaran: String(item.mata_pelajaran || item.mapel || '').trim(),
      ruang: item.ruang ? String(item.ruang) : null,
      aktif: item.aktif !== undefined ? Boolean(item.aktif) : true,
      berlaku_mulai: item.berlaku_mulai ? new Date(item.berlaku_mulai) : new Date(),
      versi_id: item.versi_id ? BigInt(item.versi_id) : null,
    }));

    const result = await this.prisma.jadwal_guru.createMany({
      data: dataToInsert,
    });

    return {
      ok: true,
      data: {
        inserted: result.count,
      },
    };
  }

  // =========================================================================
  // 3. TUKAR JADWAL
  // =========================================================================

  /**
   * Hak pengguna atas halaman jadwal, dievaluasi di server. Frontend memakai
   * ini untuk memutuskan tab mana yang ditampilkan, alih-alih menebak sendiri
   * dari daftar role — supaya UI dan guard tidak pernah berbeda pendapat.
   */
  async getIzinJadwal(user: any) {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: JADWAL_GENERATE_KEY },
      select: { value: true },
    });
    return {
      ok: true,
      data: {
        bolehGenerate: aksesDiizinkan(user, parseKonfigurasiAkses(row?.value)),
        bolehTukar: !seluruhnyaBukanPegawai(user),
        // Hak MENINJAU tukar jadwal sengaja tidak disertakan di sini: layar
        // Tukar Jadwal sudah menerimanya sebagai `isWkm` dari `getTukarList`,
        // dan menyediakannya di dua tempat hanya menambah sumber yang bisa
        // berselisih.
      },
    };
  }

  async getTukarList(user: any, params: { requester_nip?: string; target_nip?: string; status?: string }) {
    pastikanPegawai(user);
    const { requester_nip, target_nip, status } = params;
    const isWkm = await this.bolehMeninjauTukar(user);

    // Jika filter eksplisit dipanggil. Hanya untuk peninjau: tanpa pembatasan
    // ini, guru mana pun bisa membaca seluruh pengajuan rekannya cukup dengan
    // menebak NIP lewat `?requester_nip=`.
    if (requester_nip || target_nip || status) {
      if (!isWkm) {
        throw new ForbiddenException(
          'Anda tidak berwenang menelusuri pengajuan milik orang lain. Minta Admin menunjuk '
          + 'akun/role Anda sebagai peninjau tukar jadwal di Hak Akses Fitur.',
        );
      }
      const where: any = {};
      const cocokNip = (nip: string) => [nip, nip.padStart(10, '0')];
      // Dulu `where.OR` ditimpa: memberi kedua filter membuat `requester_nip`
      // hilang diam-diam. Gabungkan lewat AND agar keduanya berlaku.
      const syarat: any[] = [];
      if (requester_nip) syarat.push({ requester_nip: { in: cocokNip(requester_nip) } });
      if (target_nip) syarat.push({ target_nip: { in: cocokNip(target_nip) } });
      if (syarat.length > 0) where.AND = syarat;
      if (status) where.status = status;

      const rows = await this.prisma.tukar_jadwal_request.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      return {
        ok: true,
        data: rows.map(this.formatTukarRequest),
      };
    }

    // Default dashboard: data terorganisir untuk user yang login
    const allRequests = await this.prisma.tukar_jadwal_request.findMany({
      orderBy: { created_at: 'desc' },
      take: 300,
    });

    const userNip = user?.nip || '';
    const formatted = allRequests.map(this.formatTukarRequest);

    const masuk = formatted.filter(
      (r) => samaNip(r.target_nip, userNip) && r.status === 'menunggu_guru',
    );
    const keluar = formatted.filter((r) => samaNip(r.requester_nip, userNip));
    const perluWkm = isWkm ? formatted.filter((r) => r.status === 'menunggu_wkm') : [];
    const riwayatWkm = isWkm
      ? formatted
          .filter((r) => ['disetujui', 'ditolak_wkm'].includes(r.status))
          .slice(0, 50)
      : [];

    // CATATAN: `list: formatted` (seluruh 300 pengajuan terakhir, lengkap dengan
    // alasan & catatan pribadi antar guru) dulu ikut dikirim ke SEMUA pemanggil
    // dan tidak dipakai UI mana pun. Dihapus — tiap pemanggil hanya menerima
    // pengajuan yang memang menjadi urusannya.
    return {
      ok: true,
      data: { masuk, keluar, perluWkm, riwayatWkm, isWkm },
    };
  }

  async getTukarDetail(idStr: string, user: any) {
    pastikanPegawai(user);
    const id = BigInt(idStr);
    const req = await this.prisma.tukar_jadwal_request.findUnique({
      where: { id },
    });
    if (!req) throw new NotFoundException('Pengajuan tukar jadwal tidak ditemukan');

    // Hanya pihak yang terlibat atau peninjau; sebelumnya id mana pun bisa
    // dibaca siapa pun yang punya sesi.
    const terlibat =
      samaNip(req.requester_nip, user?.nip) || samaNip(req.target_nip, user?.nip);
    if (!terlibat && !(await this.bolehMeninjauTukar(user))) {
      throw new ForbiddenException('Anda tidak terlibat dalam pengajuan ini');
    }

    return {
      ok: true,
      data: this.formatTukarRequest(req),
    };
  }

  async getTukarSlots(user: any, jenisParam?: string, nipParam?: string) {
    pastikanPegawai(user);
    const jenis = jenisParam === 'piket' ? 'piket' : 'mengajar';
    const nip = nipParam || user?.nip;

    if (!nip) throw new BadRequestException('NIP wajib diisi');

    const refDate = toDateOnly(new Date());

    if (jenis === 'mengajar') {
      const activeSched = await this.resolveJadwalBerlaku(refDate, undefined, nip);

      const [waktuData, kelasData] = await Promise.all([
        this.prisma.master_waktu.findMany({
          where: { aktif: true },
          select: { hari: true, jam_ke: true, program: true, mulai: true, selesai: true },
        }),
        this.prisma.master_kelas.findMany({ select: { nama: true, program: true } }),
      ]);

      const progOf: Record<string, string> = {};
      for (const k of kelasData) {
        if (k.nama) progOf[k.nama] = k.program || 'Reguler';
      }

      const waktuMap: Record<string, string> = {};
      for (const w of waktuData) {
        const m = fmtTime(w.mulai);
        const s = fmtTime(w.selesai);
        waktuMap[`${w.hari}|${w.jam_ke}|${w.program || 'Reguler'}`] = m && s ? `${m} - ${s}` : m;
      }

      const slots = activeSched.map((r) => ({
        jenis: 'mengajar' as const,
        id: r.id.toString(),
        hari: r.hari,
        jam_ke: String(r.jam_ke),
        kelas: r.kelas,
        mapel: r.mata_pelajaran || '',
        waktu: waktuMap[`${r.hari}|${parseInt(r.jam_ke, 10) || r.jam_ke}|${progOf[r.kelas] || 'Reguler'}`] || '',
      }));

      return { ok: true, data: slots };
    }

    // PIKET
    const piketRows = await this.prisma.jadwal_piket.findMany({
      where: {
        aktif: true,
        OR: [{ nip }, { nip: nip.padStart(10, '0') }],
        berlaku_mulai: { lte: new Date(refDate) },
      },
      orderBy: { berlaku_mulai: 'desc' },
    });

    if (piketRows.length === 0) return { ok: true, data: [] };

    // Grouping by nip|hari|jam_ke
    const latestBerlaku = piketRows[0].berlaku_mulai;
    const currentRows = piketRows.filter(
      (r) => toDateOnly(r.berlaku_mulai) === toDateOnly(latestBerlaku),
    );

    const kodeGuruRow = await this.prisma.master_kode_guru.findFirst({
      where: { OR: [{ nip }, { nip: nip.padStart(10, '0') }] },
    });
    const namaGuru = kodeGuruRow?.nama_guru || user?.nama || nip;

    const groupMap = new Map<string, any[]>();
    for (const r of currentRows) {
      const k = `${r.nip}|${r.hari}|${r.jam_ke}`;
      if (!groupMap.has(k)) groupMap.set(k, []);
      groupMap.get(k)!.push(r);
    }

    const data = [...groupMap.entries()].map(([key, list]) => {
      const kelasList = list.map((r) => r.kelas).filter(Boolean) as string[];
      let kelasLabel = 'Seluruh kelas';
      if (kelasList.length > 0 && kelasList.length <= 3) {
        kelasLabel = kelasList.join(', ');
      } else if (kelasList.length > 3) {
        kelasLabel = `${kelasList.slice(0, 2).join(', ')} +${kelasList.length - 2} kelas lain`;
      }

      return {
        jenis: 'piket' as const,
        key,
        nama_guru: namaGuru,
        hari: list[0].hari,
        jam_ke: String(list[0].jam_ke),
        waktu: list[0].waktu || '',
        kelas: kelasLabel,
        kelasList,
        jumlahBaris: list.length,
        mapel: 'Tugas Piket',
      };
    });

    return { ok: true, data };
  }

  async getTukarGuru(user: any, jenisParam?: string) {
    pastikanPegawai(user);
    const jenis = jenisParam === 'piket' ? 'piket' : 'mengajar';
    const userNip = user?.nip || '';
    const refDate = new Date();

    if (jenis === 'piket') {
      const piketRows = await this.prisma.jadwal_piket.findMany({
        where: { aktif: true, berlaku_mulai: { lte: refDate } },
        select: { nip: true, berlaku_mulai: true },
        distinct: ['nip'],
      });

      const nips = piketRows.map((r) => r.nip).filter((n): n is string => !!n && !samaNip(n, userNip));
      const kodeGuruList = await this.prisma.master_kode_guru.findMany({
        where: { nip: { in: nips } },
      });
      const nameMap = new Map<string, string>();
      for (const kg of kodeGuruList) nameMap.set(kg.nip, kg.nama_guru);

      const result = nips.map((n) => ({
        nip: n,
        nama_guru: nameMap.get(n) || n,
      }));
      result.sort((a, b) => (a.nama_guru || '').localeCompare(b.nama_guru || '', 'id'));

      return { ok: true, data: result };
    }

    // Mengajar
    const guruRows = await this.prisma.jadwal_guru.findMany({
      where: { aktif: true, berlaku_mulai: { lte: refDate } },
      select: { nip: true, nama_guru: true, berlaku_mulai: true },
    });

    const map = new Map<string, { nip: string; nama_guru: string; berlaku_mulai: string }>();
    for (const row of guruRows) {
      if (!row.nip || samaNip(row.nip, userNip)) continue;
      const bDate = toDateOnly(row.berlaku_mulai);
      const prev = map.get(row.nip);
      if (!prev || bDate > prev.berlaku_mulai) {
        map.set(row.nip, {
          nip: row.nip,
          nama_guru: row.nama_guru,
          berlaku_mulai: bDate,
        });
      }
    }

    const list = [...map.values()]
      .map(({ nip, nama_guru }) => ({ nip, nama_guru }))
      .sort((a, b) => a.nama_guru.localeCompare(b.nama_guru, 'id'));

    return { ok: true, data: list };
  }

  async createTukar(user: any, body: any) {
    pastikanPegawai(user);
    const jenis = body.jenis === 'piket' ? 'piket' : 'mengajar';
    const alasan = String(body.alasan || '').trim();

    if (jenis === 'piket') {
      return this.createTukarPiket(user, body, alasan);
    }

    // Mengajar
    const reqSlots = body.requester_slots || [];
    const tgtSlots = body.target_slots || [];

    if (!reqSlots.length || !tgtSlots.length) {
      throw new BadRequestException('Slot jadwal Anda dan slot guru tujuan wajib dipilih');
    }
    if (reqSlots.length > 3 || tgtSlots.length > 3) {
      throw new BadRequestException('Maksimal 3 Jam Pelajaran yang dapat ditukar');
    }
    if (reqSlots.length !== tgtSlots.length) {
      throw new BadRequestException('Jumlah Jam Pelajaran yang ditukar harus sama');
    }

    const reqIds: bigint[] = reqSlots.map((s: any) => BigInt(s.id));
    const tgtIds: bigint[] = tgtSlots.map((s: any) => BigInt(s.id));
    const allIds = [...reqIds, ...tgtIds];

    const rows = await this.prisma.jadwal_guru.findMany({
      where: { id: { in: allIds } },
    });

    if (rows.length !== allIds.length) {
      throw new NotFoundException('Beberapa slot jadwal tidak ditemukan');
    }

    const rowsA = reqIds.map((id) => rows.find((r) => r.id === id)!);
    const rowsB = tgtIds.map((id) => rows.find((r) => r.id === id)!);

    if (rowsA.some((r) => !r.aktif) || rowsB.some((r) => !r.aktif)) {
      throw new BadRequestException('Salah satu slot jadwal yang dipilih sudah tidak aktif');
    }

    if (rowsA.some((r) => !samaNip(r.nip, user.nip))) {
      throw new ForbiddenException('Anda hanya boleh mengajukan slot jadwal milik Anda sendiri');
    }

    if (rowsB.some((r) => samaNip(r.nip, user.nip))) {
      throw new BadRequestException('Slot tujuan harus milik rekan guru lain');
    }

    const targetNipB = rowsB[0].nip;
    if (rowsB.some((r) => !samaNip(r.nip, targetNipB))) {
      throw new BadRequestException('Semua slot tujuan harus milik guru yang sama');
    }

    // Cek ajuan berjalan yang melibatkan slot-slot ini
    const berjalan = await this.prisma.tukar_jadwal_request.findMany({
      where: {
        jenis: 'mengajar',
        status: { in: ['menunggu_guru', 'menunggu_wkm'] },
      },
      select: { id: true, requester_slots: true, target_slots: true },
    });

    const allIdStrs = allIds.map((id) => id.toString());
    for (const b of berjalan) {
      const bReq = (b.requester_slots as any[]) || [];
      const bTgt = (b.target_slots as any[]) || [];
      const bIds = [...bReq.map((x) => String(x.id)), ...bTgt.map((x) => String(x.id))];
      if (allIdStrs.some((idStr) => bIds.includes(idStr))) {
        throw new ConflictException(
          'Salah satu slot masih terlibat dalam pengajuan tukar yang belum selesai',
        );
      }
    }

    await this.pastikanTidakBentrok(rowsA, rowsB, allIds);

    const rSlots = rowsA.map((r) => ({
      id: r.id.toString(),
      hari: r.hari,
      jam_ke: r.jam_ke,
      kelas: r.kelas,
      mapel: r.mata_pelajaran,
    }));
    const tSlots = rowsB.map((r) => ({
      id: r.id.toString(),
      hari: r.hari,
      jam_ke: r.jam_ke,
      kelas: r.kelas,
      mapel: r.mata_pelajaran,
    }));

    const created = await this.prisma.tukar_jadwal_request.create({
      data: {
        jenis: 'mengajar',
        requester_nip: rowsA[0].nip,
        requester_nama: rowsA[0].nama_guru,
        requester_slots: rSlots,
        target_nip: rowsB[0].nip,
        target_nama: rowsB[0].nama_guru,
        target_slots: tSlots,
        alasan: alasan || null,
        status: 'menunggu_guru',
      },
    });

    // Notifikasi ke guru target
    await this.notifyUserByNip(rowsB[0].nip, {
      type: 'jadwal_berubah',
      title: 'Permintaan Tukar Jadwal',
      message: `${rowsA[0].nama_guru} ingin menukar ${reqSlots.length} JP jadwal dengan jadwal Anda.`,
      link: '/jadwal?tab=tukar',
      source_table: 'tukar_jadwal_request',
      source_id: created.id.toString(),
      created_by: user?.auth_id || user?.id?.toString() || null,
    });

    return { ok: true, data: this.formatTukarRequest(created) };
  }

  /**
   * Setelah ditukar, guru A mengambil jam milik B dan sebaliknya. Pastikan
   * tidak ada satu pun dari mereka yang jadi mengajar dua kelas pada jam yang
   * sama. `abaikanIds` adalah slot-slot yang sedang ditukar itu sendiri.
   */
  private async pastikanTidakBentrok(rowsA: any[], rowsB: any[], abaikanIds: bigint[]) {
    for (let i = 0; i < rowsA.length; i++) {
      const pasangan = [
        { guru: rowsA[i], jam: rowsB[i] },
        { guru: rowsB[i], jam: rowsA[i] },
      ];
      for (const { guru, jam } of pasangan) {
        const bentrok = await this.prisma.jadwal_guru.findFirst({
          where: {
            nip: guru.nip,
            hari: jam.hari,
            jam_ke: jam.jam_ke,
            aktif: true,
            id: { notIn: abaikanIds },
          },
        });
        if (bentrok) {
          throw new ConflictException(
            `${guru.nama_guru} sudah mengajar ${bentrok.mata_pelajaran} di ${bentrok.kelas} pada ${jam.hari} jam ke-${jam.jam_ke}`,
          );
        }
      }
    }
  }

  private async createTukarPiket(user: any, body: any, alasan: string) {
    const reqKey = String(body.requester_piket_key || '');
    const tgtKey = String(body.target_piket_key || '');

    if (!reqKey || !tgtKey) {
      throw new BadRequestException('Tugas piket Anda dan guru tujuan wajib dipilih');
    }
    if (reqKey === tgtKey) {
      throw new BadRequestException('Tidak bisa menukar tugas piket dengan dirinya sendiri');
    }

    const { nip: reqNip, hari: reqHari, jam: reqJam } = pecahKunciPiket(reqKey, 'Tugas piket Anda');
    const { nip: tgtNip, hari: tgtHari, jam: tgtJam } = pecahKunciPiket(tgtKey, 'Tugas piket guru tujuan');

    if (!samaNip(reqNip, user.nip)) {
      throw new ForbiddenException('Anda hanya boleh mengajukan tugas piket milik Anda');
    }
    if (samaNip(tgtNip, user.nip)) {
      throw new BadRequestException('Tugas piket tujuan harus milik rekan guru lain');
    }

    const [rowsA, rowsB] = await Promise.all([
      this.prisma.jadwal_piket.findMany({
        where: { nip: reqNip, hari: reqHari, jam_ke: reqJam, aktif: true },
      }),
      this.prisma.jadwal_piket.findMany({
        where: { nip: tgtNip, hari: tgtHari, jam_ke: tgtJam, aktif: true },
      }),
    ]);

    if (rowsA.length === 0 || rowsB.length === 0) {
      throw new NotFoundException('Tugas piket tidak ditemukan pada jadwal yang sedang berlaku');
    }

    // Cek ajuan piket yang sedang berjalan
    const bentrokAjuan = await this.prisma.tukar_jadwal_request.findFirst({
      where: {
        status: { in: ['menunggu_guru', 'menunggu_wkm'] },
        OR: [
          { requester_piket_key: { in: [reqKey, tgtKey] } },
          { target_piket_key: { in: [reqKey, tgtKey] } },
        ],
      },
    });
    if (bentrokAjuan) {
      throw new ConflictException('Salah satu tugas piket masih terlibat pengajuan tukar berjalan');
    }

    const [kgA, kgB] = await Promise.all([
      this.prisma.master_kode_guru.findFirst({ where: { nip: reqNip } }),
      this.prisma.master_kode_guru.findFirst({ where: { nip: tgtNip } }),
    ]);
    const namaA = kgA?.nama_guru || user?.nama || reqNip;
    const namaB = kgB?.nama_guru || tgtNip;

    const ringkas = (list: string[]) =>
      list.length <= 3 ? list.join(', ') : `${list.slice(0, 2).join(', ')} +${list.length - 2} kelas lain`;

    const kelasA = ringkas(rowsA.map((r) => r.kelas).filter(Boolean) as string[]);
    const kelasB = ringkas(rowsB.map((r) => r.kelas).filter(Boolean) as string[]);

    const created = await this.prisma.tukar_jadwal_request.create({
      data: {
        jenis: 'piket',
        requester_nip: reqNip,
        requester_nama: namaA,
        requester_piket_key: reqKey,
        requester_hari: reqHari,
        // `tukar_jadwal_request.requester_jam_ke` bertipe String, sedangkan
        // `jadwal_piket.jam_ke` bertipe Int — dua tipe untuk hal yang sama, dan
        // itulah yang dulu membuat bagian jam diperlakukan sebagai teks mentah lalu
        // di-`parseInt` tepat sebelum masuk ke `where`. Konversinya kini eksplisit
        // di satu tempat, dan nilainya ternormalisasi ("07" tersimpan sebagai "7").
        requester_jam_ke: String(reqJam),
        requester_kelas: kelasA,
        requester_berlaku_mulai: rowsA[0].berlaku_mulai,

        target_nip: tgtNip,
        target_nama: namaB,
        target_piket_key: tgtKey,
        target_hari: tgtHari,
        target_jam_ke: String(tgtJam),
        target_kelas: kelasB,
        target_berlaku_mulai: rowsB[0].berlaku_mulai,

        alasan: alasan || null,
        status: 'menunggu_guru',
      },
    });

    await this.notifyUserByNip(tgtNip, {
      type: 'jadwal_berubah',
      title: 'Permintaan Tukar Jadwal Piket',
      message: `${namaA} ingin menukar piket ${reqHari} jam ke-${reqJam} dengan piket Anda ${tgtHari} jam ke-${tgtJam}.`,
      link: '/jadwal?tab=tukar',
      source_table: 'tukar_jadwal_request',
      source_id: created.id.toString(),
      created_by: user?.auth_id || user?.id?.toString() || null,
    });

    return { ok: true, data: this.formatTukarRequest(created) };
  }

  async respondTukar(idStr: string, user: any, body: any) {
    pastikanPegawai(user);
    const id = BigInt(idStr);
    const aksi: string = body.aksi;
    const catatan: string = (body.catatan || '').trim();

    if (!['terima', 'tolak', 'batal', 'setujui', 'tolak_wkm'].includes(aksi)) {
      throw new BadRequestException('Aksi tidak dikenal');
    }

    const req = await this.prisma.tukar_jadwal_request.findUnique({
      where: { id },
    });
    if (!req) throw new NotFoundException('Pengajuan tidak ditemukan');

    const isRequester = samaNip(req.requester_nip, user.nip);
    const isTarget = samaNip(req.target_nip, user.nip);
    const isWkm = await this.bolehMeninjauTukar(user);
    const namaUser = user.nama_lengkap || user.nama || user.nip;

    // 1. GURU TARGET: TERIMA / TOLAK
    if (aksi === 'terima' || aksi === 'tolak') {
      if (!isTarget) {
        throw new ForbiddenException('Hanya rekan guru tujuan yang dapat menanggapi pengajuan ini');
      }
      if (req.status !== 'menunggu_guru') {
        throw new ConflictException(`Pengajuan sudah berstatus "${req.status}"`);
      }

      const statusBaru = aksi === 'terima' ? 'menunggu_wkm' : 'ditolak_guru';
      const updated = await this.prisma.tukar_jadwal_request.update({
        where: { id },
        data: {
          status: statusBaru,
          guru_responded_at: new Date(),
          guru_catatan: catatan || null,
        },
      });

      if (aksi === 'terima') {
        // Notifikasi WKM
        await this.prisma.notifications.create({
          data: {
            type: 'jadwal_berubah',
            title: `Persetujuan Tukar Jadwal ${req.jenis === 'piket' ? 'Piket' : 'Mengajar'}`,
            message: `${req.requester_nama} ↔ ${req.target_nama}: pertukaran jadwal disetujui guru, menunggu konfirmasi Anda.`,
            link: '/jadwal?tab=tukar',
            recipient_role: 'WKM_AKADEMIK',
            source_table: 'tukar_jadwal_request',
            source_id: req.id.toString(),
            created_by: user?.auth_id || user?.id?.toString() || null,
          },
        });
      }

      // Notifikasi Pemohon
      await this.notifyUserByNip(req.requester_nip, {
        type: 'jadwal_berubah',
        title: aksi === 'terima' ? 'Tukar Jadwal Disetujui Guru' : 'Tukar Jadwal Ditolak',
        message:
          aksi === 'terima'
            ? `${req.target_nama} menyetujui. Menunggu persetujuan WKM Akademik.`
            : `${req.target_nama} menolak pengajuan tukar jadwal Anda.${catatan ? ` Catatan: ${catatan}` : ''}`,
        link: '/jadwal?tab=tukar',
        source_table: 'tukar_jadwal_request',
        source_id: req.id.toString(),
        created_by: user?.auth_id || user?.id?.toString() || null,
      });

      return { ok: true, data: this.formatTukarRequest(updated) };
    }

    // 2. PEMOHON: BATALKAN
    if (aksi === 'batal') {
      if (!isRequester && !isWkm) {
        throw new ForbiddenException('Hanya pemohon yang dapat membatalkan pengajuan');
      }
      if (!['menunggu_guru', 'menunggu_wkm'].includes(req.status)) {
        throw new ConflictException('Pengajuan sudah selesai diproses, tidak dapat dibatalkan');
      }

      const updated = await this.prisma.tukar_jadwal_request.update({
        where: { id },
        data: { status: 'dibatalkan' },
      });

      return { ok: true, data: this.formatTukarRequest(updated) };
    }

    // 3. WKM: TOLAK
    if (aksi === 'tolak_wkm') {
      if (!isWkm) {
        throw new ForbiddenException(
          'Anda tidak berwenang meninjau pengajuan tukar jadwal. Minta Admin menunjuk '
          + 'akun/role Anda di Hak Akses Fitur.',
        );
      }
      if (req.status !== 'menunggu_wkm') {
        throw new ConflictException(`Pengajuan berstatus "${req.status}", tidak menunggu WKM`);
      }

      const updated = await this.prisma.tukar_jadwal_request.update({
        where: { id },
        data: {
          status: 'ditolak_wkm',
          wkm_nip: user.nip,
          wkm_nama: namaUser,
          wkm_responded_at: new Date(),
          wkm_catatan: catatan || null,
        },
      });

      for (const nip of [req.requester_nip, req.target_nip]) {
        await this.notifyUserByNip(nip, {
          type: 'jadwal_berubah',
          title: 'Tukar Jadwal Ditolak WKM',
          message: `Pengajuan tukar jadwal ${req.requester_nama} ↔ ${req.target_nama} ditolak WKM Akademik.${catatan ? ` Catatan: ${catatan}` : ''}`,
          link: '/jadwal?tab=tukar',
          source_table: 'tukar_jadwal_request',
          source_id: req.id.toString(),
          created_by: user?.auth_id || user?.id?.toString() || null,
        });
      }

      return { ok: true, data: this.formatTukarRequest(updated) };
    }

    // 4. WKM: SETUJUI -> TERAPKAN PERTUKARAN SECARA ATOMIK DI PRISMA TRANSACTION
    if (aksi === 'setujui') {
      if (!isWkm) {
        throw new ForbiddenException(
          'Anda tidak berwenang meninjau pengajuan tukar jadwal. Minta Admin menunjuk '
          + 'akun/role Anda di Hak Akses Fitur.',
        );
      }
      if (req.status !== 'menunggu_wkm') {
        throw new ConflictException(`Pengajuan berstatus "${req.status}", tidak menunggu WKM`);
      }

      if (req.jenis === 'mengajar') {
        const rSlots = (req.requester_slots as any[]) || [];
        const tSlots = (req.target_slots as any[]) || [];
        const reqIds: bigint[] = rSlots.map((s) => BigInt(s.id));
        const tgtIds: bigint[] = tSlots.map((s) => BigInt(s.id));
        const allIds = [...reqIds, ...tgtIds];

        const rows = await this.prisma.jadwal_guru.findMany({
          where: { id: { in: allIds } },
        });

        const rowsA = reqIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean);
        const rowsB = tgtIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean);

        if (rowsA.length !== reqIds.length || rowsB.length !== tgtIds.length) {
          throw new ConflictException('Slot jadwal tidak ditemukan lagi');
        }

        if (rowsA.some((r) => !r!.aktif) || rowsB.some((r) => !r!.aktif)) {
          throw new ConflictException('Salah satu slot jadwal sudah tidak aktif');
        }

        // Periksa ulang bentrok TEPAT SEBELUM diterapkan. Pemeriksaan saat
        // pengajuan dibuat tidak cukup: di antara pengajuan dan persetujuan WKM
        // bisa ada jadwal baru atau pertukaran lain yang membuat salah satu guru
        // jadi mengajar di dua kelas pada jam yang sama.
        await this.pastikanTidakBentrok(rowsA as any[], rowsB as any[], allIds);

        // Jalankan pertukaran di Prisma Transaction
        const updated = await this.prisma.$transaction(async (tx) => {
          const now = new Date();

          for (let i = 0; i < rowsA.length; i++) {
            const rowA = rowsA[i]!;
            const rowB = rowsB[i]!;

            const asalA = {
              nip: rowA.nip,
              nama_guru: rowA.nama_guru,
              mata_pelajaran: rowA.mata_pelajaran,
            };
            const asalB = {
              nip: rowB.nip,
              nama_guru: rowB.nama_guru,
              mata_pelajaran: rowB.mata_pelajaran,
            };

            await tx.jadwal_guru.update({
              where: { id: rowA.id },
              data: { ...asalB, updated_at: now },
            });

            await tx.jadwal_guru.update({
              where: { id: rowB.id },
              data: { ...asalA, updated_at: now },
            });
          }

          return tx.tukar_jadwal_request.update({
            where: { id },
            data: {
              status: 'disetujui',
              wkm_nip: user.nip,
              wkm_nama: namaUser,
              wkm_responded_at: now,
              wkm_catatan: catatan || null,
              applied_at: now,
            },
          });
        });

        // Notifikasi sukses
        for (const nip of [req.requester_nip, req.target_nip]) {
          await this.notifyUserByNip(nip, {
            type: 'jadwal_berubah',
            title: 'Tukar Jadwal Disetujui',
            message: `Tukar jadwal ${rSlots.length} JP antara ${req.requester_nama} dan ${req.target_nama} telah disetujui WKM Akademik.`,
            link: '/jadwal',
            source_table: 'tukar_jadwal_request',
            source_id: req.id.toString(),
            created_by: user?.auth_id || user?.id?.toString() || null,
          });
        }

        return { ok: true, data: this.formatTukarRequest(updated) };
      } else {
        // Piket
        // Kunci ini berasal dari baris yang tersimpan, tapi tetap divalidasi: baris
        // lama bisa memuat bentuk kunci yang sudah tidak dipakai lagi, dan itu tidak
        // boleh keluar sebagai 500.
        const { nip: reqNip, hari: reqHari, jam: reqJam } =
          pecahKunciPiket(req.requester_piket_key, 'Tugas piket pemohon');
        const { nip: tgtNip, hari: tgtHari, jam: tgtJam } =
          pecahKunciPiket(req.target_piket_key, 'Tugas piket guru tujuan');

        const [rowsA, rowsB] = await Promise.all([
          this.prisma.jadwal_piket.findMany({
            where: { nip: reqNip, hari: reqHari, jam_ke: reqJam, aktif: true },
          }),
          this.prisma.jadwal_piket.findMany({
            where: { nip: tgtNip, hari: tgtHari, jam_ke: tgtJam, aktif: true },
          }),
        ]);

        if (rowsA.length === 0 || rowsB.length === 0) {
          throw new ConflictException('Tugas piket tidak ditemukan lagi di jadwal aktif');
        }

        const kodeA = rowsA[0].kode_guru;
        const kodeB = rowsB[0].kode_guru;
        const idsA = rowsA.map((r) => r.id);
        const idsB = rowsB.map((r) => r.id);

        const updated = await this.prisma.$transaction(async (tx) => {
          const now = new Date();

          await tx.jadwal_piket.updateMany({
            where: { id: { in: idsA } },
            data: { nip: tgtNip, kode_guru: kodeB, updated_at: now },
          });

          await tx.jadwal_piket.updateMany({
            where: { id: { in: idsB } },
            data: { nip: reqNip, kode_guru: kodeA, updated_at: now },
          });

          return tx.tukar_jadwal_request.update({
            where: { id },
            data: {
              status: 'disetujui',
              wkm_nip: user.nip,
              wkm_nama: namaUser,
              wkm_responded_at: now,
              wkm_catatan: catatan || null,
              applied_at: now,
            },
          });
        });

        for (const nip of [req.requester_nip, req.target_nip]) {
          await this.notifyUserByNip(nip, {
            type: 'jadwal_berubah',
            title: 'Tukar Jadwal Piket Disetujui',
            message: `Tukar tugas piket antara ${req.requester_nama} dan ${req.target_nama} telah disetujui WKM Akademik.`,
            link: '/jadwal',
            source_table: 'tukar_jadwal_request',
            source_id: req.id.toString(),
            created_by: user?.auth_id || user?.id?.toString() || null,
          });
        }

        return { ok: true, data: this.formatTukarRequest(updated) };
      }
    }

    throw new BadRequestException('Aksi tidak valid');
  }

  async cancelTukar(idStr: string, user: any) {
    return this.respondTukar(idStr, user, { aksi: 'batal' });
  }

  private async notifyUserByNip(nip: string, params: {
    type: string;
    title: string;
    message: string;
    link?: string;
    source_table?: string;
    source_id?: string;
    created_by?: string | null;
  }) {
    try {
      const paddedNip = nip.padStart(10, '0');
      const u = await this.prisma.public_users.findFirst({
        where: { OR: [{ nip }, { nip: paddedNip }] },
        select: { auth_id: true },
      });

      if (u?.auth_id) {
        await this.prisma.notifications.create({
          data: {
            type: params.type,
            title: params.title,
            message: params.message,
            link: params.link,
            recipient_user_id: u.auth_id,
            source_table: params.source_table,
            source_id: params.source_id,
            created_by: params.created_by,
          },
        });
      }
    } catch (e) {
      console.warn('[JADWAL] Gagal mengirim notifikasi:', e);
    }
  }

  private formatTukarRequest(r: any) {
    return {
      id: Number(r.id),
      jenis: r.jenis,
      requester_nip: r.requester_nip,
      requester_nama: r.requester_nama,
      requester_jadwal_id: r.requester_jadwal_id ? Number(r.requester_jadwal_id) : null,
      requester_piket_key: r.requester_piket_key,
      requester_hari: r.requester_hari,
      requester_jam_ke: r.requester_jam_ke,
      requester_kelas: r.requester_kelas,
      requester_mapel: r.requester_mapel,
      requester_berlaku_mulai: toDateOnly(r.requester_berlaku_mulai),
      requester_slots: r.requester_slots,
      target_nip: r.target_nip,
      target_nama: r.target_nama,
      target_jadwal_id: r.target_jadwal_id ? Number(r.target_jadwal_id) : null,
      target_piket_key: r.target_piket_key,
      target_hari: r.target_hari,
      target_jam_ke: r.target_jam_ke,
      target_kelas: r.target_kelas,
      target_mapel: r.target_mapel,
      target_berlaku_mulai: toDateOnly(r.target_berlaku_mulai),
      target_slots: r.target_slots,
      alasan: r.alasan,
      status: r.status,
      guru_responded_at: r.guru_responded_at ? r.guru_responded_at.toISOString() : null,
      guru_catatan: r.guru_catatan,
      wkm_nip: r.wkm_nip,
      wkm_nama: r.wkm_nama,
      wkm_responded_at: r.wkm_responded_at ? r.wkm_responded_at.toISOString() : null,
      wkm_catatan: r.wkm_catatan,
      applied_at: r.applied_at ? r.applied_at.toISOString() : null,
      created_at: r.created_at ? r.created_at.toISOString() : null,
      updated_at: r.updated_at ? r.updated_at.toISOString() : null,
    };
  }

  /**
   * Scope kelas/mapel/jam seorang guru, dipakai dropdown di Absensi, Jurnal, Nilai,
   * dan UM Kelulusan — semuanya layar PEGAWAI.
   *
   * `pemanggil` diperiksa `pastikanPegawai`: `?nip=` di sini bebas (memang perlu,
   * karena layar-layar itu menanyakan scope guru tertentu), sehingga tanpa
   * pemeriksaan ini akun siswa dan orang tua bisa menyisir NIP untuk memanen daftar
   * username pegawai beserta seluruh struktur kelas dan mapelnya.
   *
   * Opsional supaya pemanggilan antar-service tidak ikut terhalang; rute Next-nya
   * yang menolak permintaan tanpa sesi.
   */
  async getScopes(nip?: string, kelasParam?: string, tanggalParam?: string, pemanggil?: any) {
    if (pemanggil) pastikanPegawai(pemanggil);
    if (!nip && !kelasParam) {
      throw new BadRequestException('nip atau kelas wajib diisi');
    }

    const today = toDateOnly(new Date());
    const effectiveDate = tanggalParam || today;

    const toPublic = (j: any) => ({
      hari: String(j.hari ?? ''),
      jam_ke: String(j.jam_ke ?? ''),
      kelas: String(j.kelas ?? ''),
      ruang: String(j.ruang ?? ''),
      mata_pelajaran: String(j.mata_pelajaran ?? ''),
      berlaku_mulai: toDateOnly(j.berlaku_mulai),
      nama_guru: String(j.nama_guru ?? ''),
      nip: String(j.nip ?? ''),
    });

    if (kelasParam) {
      const classSchedules = await this.resolveJadwalBerlaku(effectiveDate, undefined, undefined, kelasParam);
      return {
        ok: true,
        data: { allJadwal: classSchedules.map(toPublic) },
      };
    }

    const deduplicatedList = await this.resolveJadwalBerlaku(effectiveDate, undefined, nip);

    if (deduplicatedList.length === 0) {
      return {
        ok: true,
        data: {
          ok: true,
          guru: { nip: nip || '', nama: '' },
          kelasList: [] as any[],
          mapelByKelas: {},
          jamKeByKelasMapel: {},
        },
      };
    }

    const user = nip
      ? await this.prisma.public_users.findFirst({
          where: { OR: [{ nip }, { nip: nip.padStart(10, '0') }] },
          select: { nama: true },
        })
      : null;

    const namaGuru = user?.nama || deduplicatedList[0]?.nama_guru || '';

    const masterKelasData = await this.prisma.master_kelas.findMany({ select: { nama: true, program: true } });
    const kelasProgramMap: Record<string, string> = {};
    for (const k of masterKelasData) {
      if (k.nama) kelasProgramMap[k.nama] = k.program || 'Reguler';
    }

    const masterWaktuData = await this.prisma.master_waktu.findMany({
      where: { aktif: true },
      select: { hari: true, jam_ke: true, mulai: true, selesai: true, program: true },
    });

    const waktuMap: Record<string, { mulai: string; selesai: string }> = {};
    for (const w of masterWaktuData) {
      const key = `${w.program || 'Reguler'}|${w.hari}|${w.jam_ke}`;
      if (!waktuMap[key]) {
        const m = fmtTime(w.mulai);
        const s = fmtTime(w.selesai);
        waktuMap[key] = { mulai: m, selesai: s };
      }
    }

    const kelasSet = new Set<string>();
    const mapelByKelas: Record<string, Set<string>> = {};
    const jamKeByKelasMapel: Record<string, { jamKe: string; hari: string; berlaku_mulai: string }[]> = {};

    deduplicatedList.forEach((j) => {
      const kelas = (j.kelas || '').trim();
      const mapel = (j.mata_pelajaran || '').trim();
      const jamKe = String(j.jam_ke ?? '').trim();
      const hari = (j.hari || '').trim();
      const berlakuMulai = toDateOnly(j.berlaku_mulai);

      if (!kelas || !mapel || !jamKe) return;

      kelasSet.add(kelas);

      if (!mapelByKelas[kelas]) mapelByKelas[kelas] = new Set();
      mapelByKelas[kelas].add(mapel);

      const key = `${kelas}||${mapel}`;
      if (!jamKeByKelasMapel[key]) jamKeByKelasMapel[key] = [];

      const existingIdx = jamKeByKelasMapel[key].findIndex((e) => e.jamKe === jamKe && e.hari === hari);
      if (existingIdx < 0) {
        jamKeByKelasMapel[key].push({ jamKe, hari, berlaku_mulai: berlakuMulai });
      } else {
        const existDate = jamKeByKelasMapel[key][existingIdx].berlaku_mulai || '';
        if (berlakuMulai > existDate) {
          jamKeByKelasMapel[key][existingIdx].berlaku_mulai = berlakuMulai;
        }
      }
    });

    const kelasList = Array.from(kelasSet).sort();
    const mapelByKelasArray: Record<string, string[]> = {};
    Object.keys(mapelByKelas).forEach((k) => {
      mapelByKelasArray[k] = Array.from(mapelByKelas[k]).sort();
    });

    const jamKeByKelasMapelArray: Record<string, { jamKe: string; hari: string; berlaku_mulai: string }[]> = {};
    Object.keys(jamKeByKelasMapel).forEach((k) => {
      jamKeByKelasMapelArray[k] = jamKeByKelasMapel[k].sort((a, b) => (parseInt(a.jamKe, 10) || 0) - (parseInt(b.jamKe, 10) || 0));
    });

    const publicSchedule = deduplicatedList.map(toPublic);

    const response = {
      ok: true,
      guru: { nip: nip || '', nama: namaGuru },
      kelasList,
      mapelByKelas: mapelByKelasArray,
      jamKeByKelasMapel: jamKeByKelasMapelArray,
      schedule: publicSchedule,
      masterWaktu: waktuMap,
      masterKelas: kelasProgramMap,
      allJadwal: publicSchedule,
    };

    return { ok: true, data: response };
  }
}

