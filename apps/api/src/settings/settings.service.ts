import { Injectable, BadRequestException, ForbiddenException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async createNotification(type: string, title: string, message: string, link: string) {
    try {
      await this.prisma.notifications.create({
        data: {
          type,
          title,
          message,
          link,
        },
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }

  private formatYYYYMMDD(d: any): string | null {
    if (!d) return null;
    if (d instanceof Date) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const str = String(d).trim();
    return str.includes('T') ? str.split('T')[0] : str.slice(0, 10);
  }

  // ==========================================
  // JADWAL PIKET
  // ==========================================
  async getJadwalPiket(params: any) {
    const { kelas, hari, guru, validDate, asOf, distinctDates, q } = params;

    if (distinctDates) {
      const dates = await this.prisma.jadwal_piket.findMany({
        where: { aktif: true, berlaku_mulai: { not: null as any } },
        select: { berlaku_mulai: true },
        distinct: ['berlaku_mulai'],
        orderBy: { berlaku_mulai: 'desc' },
      });
      const dateList = [...new Set(dates.map((d) => this.formatYYYYMMDD(d.berlaku_mulai)).filter(Boolean) as string[])];
      return {
        ok: true,
        dates: dateList,
      };
    }

    let matchedNips: string[] = [];
    let matchedKodeGurus: string[] = [];
    if (guru && guru !== 'Semua') {
      // NIP dicocokkan PERSIS (termasuk bentuk ber-nol-depan), bukan `contains`:
      // dengan `contains`, guru ber-NIP "12345" ikut menarik jadwal milik
      // "912345" atau "123456" sehingga piket orang lain muncul di halaman
      // jadwal seseorang. Pencarian berdasarkan nama tetap parsial.
      const guruTrim = guru.trim();
      const matchedGurus = await this.prisma.master_kode_guru.findMany({
        where: {
          OR: [
            { nama_guru: { contains: guruTrim, mode: 'insensitive' } },
            { nip: { in: [guruTrim, guruTrim.padStart(10, '0'), guruTrim.replace(/^0+/, '')] } },
          ],
        },
        select: { nip: true, kode_guru: true },
      });
      
      if (matchedGurus.length > 0) {
        matchedNips = matchedGurus.map((g) => g.nip).filter(Boolean);
        matchedKodeGurus = matchedGurus.map((g) => g.kode_guru).filter(Boolean);
      } else {
        return { ok: true, data: [], total: 0 };
      }
    }

    const where: any = { aktif: true };

    if (kelas && kelas !== 'Semua') {
      const kelasArray = kelas.split(',').map((k: string) => k.trim()).filter(Boolean);
      if (kelasArray.length > 1) {
        where.kelas = { in: kelasArray };
      } else if (kelasArray.length === 1) {
        where.kelas = kelasArray[0];
      }
    }

    if (hari && hari !== 'Semua') {
      where.hari = hari;
    }

    if (guru && guru !== 'Semua') {
      if (matchedNips.length > 0) {
        where.OR = [
          { nip: { in: matchedNips } },
          { kode_guru: { in: matchedKodeGurus } },
        ];
      }
    }
    
    if (q) {
      const orConditions: any[] = [
        { nip: { contains: q, mode: 'insensitive' } },
        { kode_guru: { contains: q, mode: 'insensitive' } },
        { ruang: { contains: q, mode: 'insensitive' } },
        { kelas: { contains: q, mode: 'insensitive' } },
      ];
      if (where.OR) {
         where.AND = [
           { OR: where.OR },
           { OR: orConditions }
         ];
         delete where.OR;
      } else {
         where.OR = orConditions;
      }
    }

    const data = await this.prisma.jadwal_piket.findMany({
      where,
      orderBy: [
        { hari: 'asc' },
        { jam_ke: 'asc' },
      ],
    });

    if (!data || data.length === 0) {
      return { ok: true, data: [], total: 0 };
    }

    // Pemilihan versi jadwal. Dua semantik yang berbeda dan tidak boleh tertukar:
    //   valid_date → SATU versi persis (dipakai layar Generate Piket untuk
    //                membuka/menyunting versi tertentu dari daftar distinct_dates).
    //   as_of      → versi yang BERLAKU pada tanggal itu, yaitu berlaku_mulai
    //                terbesar yang masih <= tanggal tsb. Ini yang dibutuhkan
    //                halaman Jadwal & Dashboard ("piket saya hari ini").
    // Tanpa keduanya: versi terbaru yang ada.
    let filteredData = data;
    if (validDate) {
      const targetDate = this.formatYYYYMMDD(validDate);
      filteredData = data.filter((item) => this.formatYYYYMMDD(item.berlaku_mulai) === targetDate);
    } else {
      const batasAtas = asOf ? this.formatYYYYMMDD(asOf) : null;
      let maxDateStr: string | null = null;
      for (const item of data) {
        const ds = this.formatYYYYMMDD(item.berlaku_mulai);
        if (!ds) continue;
        if (batasAtas && ds > batasAtas) continue;
        if (!maxDateStr || ds > maxDateStr) maxDateStr = ds;
      }
      filteredData = maxDateStr
        ? data.filter((item) => this.formatYYYYMMDD(item.berlaku_mulai) === maxDateStr)
        : batasAtas
          ? [] // semua versi baru berlaku setelah tanggal acuan
          : data;
    }

    const kodeGurus = [...new Set(filteredData.map((d) => d.kode_guru).filter(Boolean))];
    const nipMap: Record<string, string> = {};
    const namaMap: Record<string, string> = {};
    
    if (kodeGurus.length > 0) {
      const kgData = await this.prisma.master_kode_guru.findMany({
        where: { kode_guru: { in: kodeGurus as string[] } },
        select: { kode_guru: true, nip: true, nama_guru: true },
      });
      kgData.forEach((kg) => {
        nipMap[kg.kode_guru] = kg.nip;
        namaMap[kg.kode_guru] = kg.nama_guru;
      });
    }

    const masterWaktuData = await this.prisma.master_waktu.findMany({
      where: { aktif: true },
      select: { hari: true, jam_ke: true, program: true, mulai: true, selesai: true },
    });
    
    const masterKelasData = await this.prisma.master_kelas.findMany({
      select: { nama: true, program: true },
    });

    const waktuMap: Record<string, any> = {};
    masterWaktuData.forEach((w) => {
      waktuMap[`${w.hari}|${w.jam_ke}|${w.program}`] = w;
    });

    const kelasProgramMap: Record<string, string> = {};
    masterKelasData.forEach((k) => {
      kelasProgramMap[k.nama] = k.program || 'Reguler';
    });

    const dedupSeen: Record<string, any> = {};
    const uniqueData = filteredData.filter((item) => {
      const key = `${item.hari}|${item.jam_ke}|${item.ruang || ''}|${item.kode_guru || ''}`;
      if (dedupSeen[key]) return false;
      dedupSeen[key] = true;
      return true;
    });

    const dayOrder: Record<string, number> = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
    
    const sortedData = uniqueData.sort((a, b) => {
      const d = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99);
      if (d !== 0) return d;
      return (Number(a.jam_ke) || 0) - (Number(b.jam_ke) || 0);
    });

    const fmtTime = (t: Date) => {
      if (!t) return '';
      return t.toISOString().substr(11, 5);
    };

    const finalData = sortedData.map((item) => {
      const kg = item.kode_guru;
      const nip = kg ? (nipMap[kg] || item.nip) : item.nip;
      const nama_guru = kg ? namaMap[kg] : null;

      const program = item.kelas ? (kelasProgramMap[item.kelas] || 'Reguler') : 'Reguler';
      const waktuInfo = waktuMap[`${item.hari}|${item.jam_ke}|${program}`];
      
      let waktuDisplay = '';
      if (waktuInfo) {
        const mulai = fmtTime(waktuInfo.mulai as any);
        const selesai = fmtTime(waktuInfo.selesai as any);
        waktuDisplay = mulai && selesai ? `${mulai} - ${selesai}` : mulai;
      }

      return {
        ...item,
        id: item.id.toString(),
        nip,
        nama_guru,
        waktu_display: waktuDisplay,
        berlaku_mulai: this.formatYYYYMMDD(item.berlaku_mulai),
      };
    });

    return { ok: true, data: finalData, total: finalData.length };
  }

  async createJadwalPiket(data: any) {
    if (!data.hari || !data.jam_ke || !data.ruang || !data.berlaku_mulai) {
      throw new BadRequestException('Data tidak lengkap. Pastikan Hari, Jam, Ruang, dan Tanggal Berlaku diisi.');
    }

    try {
      const result = await this.prisma.jadwal_piket.create({
        data: {
          hari: data.hari,
          jam_ke: parseInt(data.jam_ke, 10),
          waktu: data.waktu || '',
          kelas: data.kelas || null,
          ruang: data.ruang,
          kode_guru: data.kode_guru || null,
          nip: data.nip || null,
          berlaku_mulai: new Date(data.berlaku_mulai),
          aktif: true,
        },
      });

      await this.createNotification(
        'piket_baru',
        'Jadwal Piket Baru',
        `${data.ruang}${data.kelas ? ` (${data.kelas})` : ''} - ${data.hari}, Jam ${data.jam_ke}`,
        '/pengaturan-tugas?tab=jadwal-piket'
      );

      return { ok: true, data: { ...result, id: result.id.toString(), berlaku_mulai: (result.berlaku_mulai as Date).toISOString().split('T')[0] }, message: 'Jadwal piket berhasil ditambahkan.' };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateJadwalPiketDates(oldDate: string, newDate: string) {
    if (oldDate === newDate) {
      throw new BadRequestException('Tanggal baru harus berbeda dengan tanggal lama');
    }

    try {
      const result = await this.prisma.jadwal_piket.updateMany({
        where: { aktif: true, berlaku_mulai: new Date(oldDate) },
        data: { berlaku_mulai: new Date(newDate) },
      });

      await this.createNotification(
        'piket_baru',
        'Masa Berlaku Jadwal Piket Diperbarui',
        `Tanggal berlaku diubah dari ${oldDate} ke ${newDate}`,
        '/pengaturan-tugas?tab=jadwal-piket'
      );

      return { ok: true, updated: result.count, message: `Berhasil mengubah masa berlaku jadwal piket.` };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateJadwalPiket(data: any) {
    if (!data.id) throw new BadRequestException('ID wajib ada untuk edit.');
    if (!data.berlaku_mulai) throw new BadRequestException('Tanggal mulai berlaku wajib diisi.');

    try {
      const result = await this.prisma.jadwal_piket.update({
        where: { id: parseInt(data.id, 10) },
        data: {
          hari: data.hari,
          jam_ke: parseInt(data.jam_ke, 10),
          waktu: data.waktu || '',
          kelas: data.kelas || null,
          ruang: data.ruang,
          kode_guru: data.kode_guru || null,
          nip: data.nip || null,
          aktif: data.aktif,
          berlaku_mulai: new Date(data.berlaku_mulai),
        },
      });

      await this.createNotification(
        'piket_baru',
        'Jadwal Piket Diperbarui',
        `${data.ruang || data.kelas} - ${data.hari}, Jam ${data.jam_ke}`,
        '/pengaturan-tugas?tab=jadwal-piket'
      );

      return { ok: true, data: { ...result, id: result.id.toString(), berlaku_mulai: (result.berlaku_mulai as Date).toISOString().split('T')[0] }, message: 'Jadwal piket berhasil diupdate.' };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteJadwalPiket({ id, deleteAll, dates }: { id?: number; deleteAll?: boolean; dates?: string }) {
    try {
      if (deleteAll) {
        await this.prisma.jadwal_piket.updateMany({
          where: { aktif: true },
          data: { aktif: false },
        });

        await this.createNotification(
          'piket_baru',
          'Semua Jadwal Piket Dihapus',
          `Pengaturan jadwal piket telah direset`,
          '/pengaturan-tugas?tab=jadwal-piket'
        );

        return { ok: true, message: 'Semua jadwal piket berhasil dihapus.' };
      }

      if (dates) {
        const datesArr = dates.split(',').map((d) => d.trim()).filter(Boolean);
        if (datesArr.length === 0) throw new BadRequestException('Tidak ada tanggal yang dipilih');

        const result = await this.prisma.jadwal_piket.updateMany({
          where: {
            aktif: true,
            berlaku_mulai: { in: datesArr.map(d => new Date(d)) },
          },
          data: { aktif: false },
        });

        await this.createNotification(
          'piket_baru',
          'Jadwal Piket Massal Dihapus',
          `Jadwal piket pada ${datesArr.length} tanggal telah dihapus`,
          '/pengaturan-tugas?tab=jadwal-piket'
        );

        return { ok: true, deleted: result.count, message: `Jadwal piket pada ${datesArr.length} tanggal berhasil dihapus.` };
      }

      if (!id) throw new BadRequestException('ID is required');

      const deletedData = await this.prisma.jadwal_piket.findUnique({
        where: { id },
        select: { kelas: true, hari: true, jam_ke: true },
      });

      await this.prisma.jadwal_piket.update({
        where: { id },
        data: { aktif: false },
      });

      if (deletedData) {
        await this.createNotification(
          'piket_baru',
          'Jadwal Piket Dihapus',
          `${deletedData.kelas} - ${deletedData.hari}, Jam ${deletedData.jam_ke}`,
          '/pengaturan-tugas?tab=jadwal-piket'
        );
      }

      return { ok: true };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ==========================================
  // JADWAL GURU
  // ==========================================
  /**
   * Akun yang SELURUH perannya bukan pegawai. Akun pegawai yang kebetulan juga
   * orang tua (`TU,ORANG_TUA` — ada satu di basis data) karena itu tetap dianggap
   * pegawai.
   */
  private seluruhnyaBukanPegawai(user: any): boolean {
    const roles = (
      Array.isArray(user?.roles) ? user.roles : String(user?.role || '').split(/[,|]/)
    )
      .map((r: string) => String(r).trim().toUpperCase())
      .filter(Boolean);
    // Daftarnya sama dengan `ROLE_SISWA` + `BUKAN_PEGAWAI` di settings.controller.ts;
    // ditulis di sini karena keduanya konstanta modul di berkas itu.
    const bukanPegawai = ['SISWA', 'ORANG_TUA', 'ORANGTUA', 'TAMU'];
    return roles.length > 0 && roles.every((r: string) => bukanPegawai.includes(r));
  }

  /**
   * `pemanggil` OPSIONAL, hanya untuk meredaksi `nip`.
   *
   * Endpoint ini yang menyuplai "Jadwal Lengkap", dan jadwal seluruh madrasah memang
   * boleh dilihat siapa pun — tetapi NIP guru adalah username login pegawai, dan
   * modal itu tidak memakainya (interfacenya mendeklarasikan `nip` tanpa pernah
   * membacanya). Pemakai lain yang MEMBUTUHKAN `nip` adalah tab Generate PBM, yang
   * hanya bisa dibuka pengelola, jadi redaksinya tidak memutus apa pun.
   *
   * Pola yang sama dengan `JadwalService.getJadwal`: tanpa `pemanggil` tidak ada
   * redaksi, supaya pemanggilan antar-service tetap utuh.
   */
  async getJadwalGuru(params: any, pemanggil?: any) {
    const { kelas, hari, guru, validDate, distinctDates, q } = params;

    if (distinctDates) {
      const dates = await this.prisma.jadwal_guru.findMany({
        where: { aktif: true, berlaku_mulai: { not: null } },
        select: { berlaku_mulai: true },
        distinct: ['berlaku_mulai'],
        orderBy: { berlaku_mulai: 'desc' },
      });
      const dateList = [...new Set(dates.map((d) => this.formatYYYYMMDD(d.berlaku_mulai)).filter(Boolean) as string[])];
      return {
        ok: true,
        dates: dateList,
      };
    }

    const where: any = { aktif: true };

    if (kelas && kelas !== 'Semua') where.kelas = kelas;
    if (hari && hari !== 'Semua') where.hari = hari;
    if (guru) {
      where.OR = [
        { nama_guru: { contains: guru, mode: 'insensitive' } },
        { nip: guru },
      ];
    }
    if (validDate) {
      where.berlaku_mulai = new Date(validDate);
    }

    if (q) {
      where.OR = [
        { nama_guru: { contains: q, mode: 'insensitive' } },
        { kelas: { contains: q, mode: 'insensitive' } },
        { nip: { contains: q, mode: 'insensitive' } },
        { ruang: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Akun yang seluruh perannya bukan pegawai = siswa dan orang tua.
    const redaksiNip = !!pemanggil && this.seluruhnyaBukanPegawai(pemanggil);

    const allData = await this.prisma.jadwal_guru.findMany({
      where,
      orderBy: [
        { hari: 'asc' },
        { jam_ke: 'asc' },
      ],
    });

    if (allData.length === 0) return { ok: true, data: [], total: 0 };

    let filteredData = allData;
    if (validDate) {
      const targetDate = this.formatYYYYMMDD(validDate);
      filteredData = allData.filter((item) => this.formatYYYYMMDD(item.berlaku_mulai) === targetDate);
    } else {
      let maxDateStr: string | null = null;
      for (const item of allData) {
        const ds = this.formatYYYYMMDD(item.berlaku_mulai);
        if (ds && (!maxDateStr || ds > maxDateStr)) {
          maxDateStr = ds;
        }
      }
      if (maxDateStr) {
        filteredData = allData.filter((item) => this.formatYYYYMMDD(item.berlaku_mulai) === maxDateStr);
      }
    }

    const dedupSeen: Record<string, boolean> = {};
    const finalData = filteredData.filter((item) => {
      const key = `${item.hari}|${item.jam_ke}|${item.kelas}|${item.nip}`;
      if (dedupSeen[key]) return false;
      dedupSeen[key] = true;
      return true;
    }).map((item) => {
      const baris: Record<string, any> = {
        ...item,
        id: item.id.toString(),
        mapel: item.mata_pelajaran || '',
        berlaku_mulai: this.formatYYYYMMDD(item.berlaku_mulai),
        versi_id: item.versi_id?.toString() || null,
      };
      if (redaksiNip) delete baris.nip;
      return baris;
    });

    const dayOrder: Record<string, number> = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7 };
    finalData.sort((a, b) => {
      const d = (dayOrder[a.hari] || 99) - (dayOrder[b.hari] || 99);
      if (d !== 0) return d;
      if (a.nama_guru !== b.nama_guru) return (a.nama_guru || '').localeCompare(b.nama_guru || '');
      return (Number(a.jam_ke) || 0) - (Number(b.jam_ke) || 0);
    });

    return { ok: true, data: finalData, total: finalData.length };
  }

  async createJadwalGuru(data: any) {
    const mapelValue = data.mapel || data.mata_pelajaran;
    if (!data.nama_guru || !mapelValue || !data.hari || !data.kelas || !data.jam_ke || !data.berlaku_mulai || !data.nip) {
      throw new BadRequestException('Incomplete data');
    }
    
    try {
      const result = await this.prisma.jadwal_guru.create({
        data: {
          nama_guru: data.nama_guru,
          nip: data.nip,
          mata_pelajaran: mapelValue,
          hari: data.hari,
          kelas: data.kelas,
          ruang: data.ruang || null,
          jam_ke: data.jam_ke?.toString(),
          berlaku_mulai: new Date(data.berlaku_mulai),
          aktif: true,
        },
      });

      await this.createNotification('jadwal_berubah', 'Jadwal Mengajar Baru', `${data.nama_guru} - ${data.kelas}`, '/dashboard?page=JadwalGuru');

      return { ok: true, data: { ...result, id: result.id.toString(), berlaku_mulai: (result.berlaku_mulai as Date).toISOString().split('T')[0] } };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateJadwalGuru(data: any) {
    if (!data.id || !data.berlaku_mulai) throw new BadRequestException('ID and start date required');
    const mapelValue = data.mapel || data.mata_pelajaran;
    
    try {
      const result = await this.prisma.jadwal_guru.update({
        where: { id: parseInt(data.id, 10) },
        data: {
          nama_guru: data.nama_guru,
          nip: data.nip,
          mata_pelajaran: mapelValue,
          hari: data.hari,
          kelas: data.kelas,
          ruang: data.ruang || null,
          jam_ke: data.jam_ke?.toString(),
          aktif: data.aktif,
          berlaku_mulai: new Date(data.berlaku_mulai),
        },
      });

      await this.createNotification('jadwal_berubah', 'Jadwal Diperbarui', `${data.nama_guru}`, '/dashboard?page=JadwalGuru');

      return { ok: true, data: { ...result, id: result.id.toString(), berlaku_mulai: (result.berlaku_mulai as Date).toISOString().split('T')[0] } };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteJadwalGuru({ id, deleteAll }: { id?: number; deleteAll?: boolean }) {
    try {
      if (deleteAll) {
        await this.prisma.jadwal_guru.updateMany({
          where: { aktif: true },
          data: { aktif: false },
        });
        return { ok: true };
      }
      
      if (!id) throw new BadRequestException('ID required');
      
      await this.prisma.jadwal_guru.update({
        where: { id },
        data: { aktif: false },
      });
      return { ok: true };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }
  // ==========================================
  // SISWA KELAS
  // ==========================================
  /**
   * NISN yang boleh dilihat pemanggil non-pegawai.
   *
   * `public_users` tidak punya kolom `nisn`: untuk akun siswa, NISN-nya tersimpan
   * di `nip` atau `username` (pola yang sama dipakai halaman jadwal, dashboard,
   * nilai, dan ekskul). Keduanya dimasukkan, karena tidak semua akun mengisi dua
   * kolom itu dengan nilai yang sama. Orang tua tidak punya NISN sendiri —
   * relasinya ke anak tersimpan di `orangtua_siswa`.
   *
   * Larik kosong berarti tidak ada baris yang boleh dikembalikan.
   */
  async getNisnMilikSendiri(user: any): Promise<string[]> {
    const daftar = new Set<string>();

    for (const kandidat of [user?.nip, user?.username]) {
      const nilai = String(kandidat || '').trim();
      if (nilai) daftar.add(nilai);
    }

    if (user?.id !== undefined && user?.id !== null) {
      try {
        const anak = await this.prisma.orangtua_siswa.findMany({
          where: { user_id: BigInt(user.id) },
          select: { nisn: true },
        });
        anak.forEach((a) => {
          const n = String(a.nisn || '').trim();
          if (n) daftar.add(n);
        });
      } catch {
        // `user.id` bukan angka yang sah — tidak ada anak yang bisa ditautkan.
      }
    }

    return [...daftar];
  }

  /**
   * NISN tersimpan tidak konsisten: sebagian berawalan nol, sebagian tidak
   * (lihat penanganan padding di createSiswaKelas dan di pemanggil sisi klien).
   * Supaya pembatasan tidak menjadi longgar DAN tidak menjadi terlalu ketat,
   * setiap NISN dicocokkan dalam tiga bentuk yang dipakai di basis data ini.
   */
  private varianNisn(daftar: string[]): string[] {
    const out = new Set<string>();
    for (const raw of daftar) {
      const bersih = String(raw).trim();
      if (!bersih) continue;
      const tanpaNol = bersih.replace(/^0+/, '');
      out.add(bersih);
      if (tanpaNol) {
        out.add(tanpaNol);
        out.add(tanpaNol.padStart(10, '0'));
      }
    }
    return [...out];
  }

  /**
   * Tahun ajaran yang sedang ditandai aktif — SEMUANYA, bukan salah satu.
   *
   * `master_tahun_ajaran` menyimpan satu baris per (tahun ajaran, semester) dan
   * `is_active` dinyalakan per baris. Tab Tahun Ajaran memang membolehkan lebih
   * dari satu baris aktif sekaligus; satu-satunya aturannya "minimal satu aktif".
   * Keadaan itu normal di masa peralihan semester atau tahun.
   *
   * Sebelumnya kode ini memakai `findFirst({ where: { is_active: true } })` tanpa
   * `orderBy`, jadi dari beberapa baris aktif hanya SATU yang terpakai — dan yang
   * mana tidak dijamin tetap antar permintaan. Akibatnya filter "Semua Tahun
   * Ajaran" menampilkan sebagian data, dan sebagian yang berpindah-pindah.
   *
   * Bila tidak ada satu pun baris aktif (konfigurasi yang seharusnya tidak
   * terjadi), dipakai tahun ajaran terbaru yang ada. Itu lebih baik daripada
   * melepas penyaring tahun dan memulangkan seluruh riwayat sepanjang masa.
   */
  private async tahunAjaranAktif(): Promise<string[]> {
    const aktif = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true },
      orderBy: { tahun_ajaran: 'desc' },
    });

    const daftar = [...new Set(aktif.map((t) => t.tahun_ajaran).filter(Boolean))];
    if (daftar.length > 0) return daftar;

    const terbaru = await this.prisma.master_tahun_ajaran.findFirst({
      select: { tahun_ajaran: true },
      orderBy: { tahun_ajaran: 'desc' },
    });
    return terbaru?.tahun_ajaran ? [terbaru.tahun_ajaran] : [];
  }

  /**
   * Penyaring `tahun_ajaran` untuk `where` Prisma.
   *
   * Nilai kosong dan `'Semua'` sama-sama berarti "semua tahun ajaran yang diatur
   * aktif" — itulah yang dimaksud opsi "Semua Tahun Ajaran" di tab Siswa Kelas,
   * yang mengirimkan string kosong. `undefined` berarti tidak perlu disaring.
   */
  private async filterTahunAjaran(tahun_ajaran?: string): Promise<any | undefined> {
    if (tahun_ajaran && tahun_ajaran !== 'Semua') return tahun_ajaran;

    const aktif = await this.tahunAjaranAktif();
    if (aktif.length === 0) return undefined;
    return aktif.length === 1 ? aktif[0] : { in: aktif };
  }

  async getSiswaKelas(params: any) {
    const { q, tahun_ajaran, semester, kelas, related_kelas, homeroom_kelas, limit, nisnScope } = params;

    /**
     * `nisnScope` null = pegawai (atau pemanggilan antar-service): tanpa batas.
     * Larik = daftar NISN yang boleh dilihat; larik kosong = tidak ada.
     */
    const dibatasi = Array.isArray(nisnScope);
    if (dibatasi && nisnScope.length === 0) {
      return { ok: true, data: [] };
    }
    const nisnDiizinkan = dibatasi ? this.varianNisn(nisnScope) : null;

    // Cabang ini memulangkan daftar nama kelas terkait, bukan baris siswa. Tanpa
    // penyaring tahun ia menyapu seluruh riwayat, jadi ikut memakai aturan yang
    // sama: tahun yang diminta, atau semua tahun ajaran yang diatur aktif.
    const filterTahun = await this.filterTahunAjaran(tahun_ajaran);

    if (related_kelas) {
      let studentQueryWhere: any = { kelas: related_kelas, aktif: true };
      if (nisnDiizinkan) studentQueryWhere.nisn = { in: nisnDiizinkan };
      if (filterTahun !== undefined) studentQueryWhere.tahun_ajaran = filterTahun;
      if (semester) studentQueryWhere.semester = semester;

      const students = await this.prisma.siswa_kelas.findMany({
        where: studentQueryWhere,
        select: { nisn: true },
      });

      const nisnList = [...new Set(students.map((s) => s.nisn))];
      if (nisnList.length === 0) {
        return { ok: true, kelasList: [related_kelas] };
      }

      let kelasQueryWhere: any = { nisn: { in: nisnList }, aktif: true };
      if (filterTahun !== undefined) kelasQueryWhere.tahun_ajaran = filterTahun;
      if (semester) kelasQueryWhere.semester = semester;

      const kelasRows = await this.prisma.siswa_kelas.findMany({
        where: kelasQueryWhere,
        select: { kelas: true },
      });

      const kelasList = [...new Set(kelasRows.map((r) => r.kelas))];
      if (!kelasList.includes(related_kelas)) kelasList.push(related_kelas);

      return { ok: true, kelasList };
    }

    const where: any = { aktif: true };

    if (homeroom_kelas) {
      const homeroomStudents = await this.prisma.siswa_kelas.findMany({
        where: {
          kelas: homeroom_kelas,
          aktif: true,
          ...(filterTahun !== undefined ? { tahun_ajaran: filterTahun } : {}),
        },
        select: { nisn: true },
      });
      const targetNisns = [...new Set(homeroomStudents.map((s) => s.nisn))];
      if (targetNisns.length === 0) {
        return { ok: true, data: [] };
      }
      const filteredNisns = nisnDiizinkan
        ? targetNisns.filter((n) => nisnDiizinkan.includes(n))
        : targetNisns;
      where.nisn = { in: filteredNisns };
    } else if (nisnDiizinkan) {
      where.nisn = { in: nisnDiizinkan };
    }

    /**
     * "Semua Tahun Ajaran" di tab Siswa Kelas (dikirim sebagai string kosong)
     * berarti semua tahun ajaran yang diatur aktif — lihat `filterTahunAjaran`.
     *
     * Dulu di sini ada dua cabang yang keduanya salah. Nilai literal `'Semua'`
     * melepas penyaring tahun sepenuhnya sehingga seluruh riwayat sepanjang masa
     * ikut terkirim; dan nilai kosong memakai `findFirst` yang mengambil satu saja
     * dari beberapa tahun aktif, jadi filternya menampilkan sebagian data — dan
     * sebagian yang bisa berpindah antar permintaan karena tanpa `orderBy`.
     */
    if (filterTahun !== undefined) {
      where.tahun_ajaran = filterTahun;
    }
    if (semester) {
      where.semester = semester;
    }
    if (kelas && !homeroom_kelas) {
      where.kelas = kelas;
    }
    if (q) {
      where.OR = [
        { nama_siswa: { contains: q, mode: 'insensitive' } },
        { nisn: { contains: q, mode: 'insensitive' } },
        { kelas: { contains: q, mode: 'insensitive' } },
      ];
    }

    /**
     * `?limit=` dulu diterima pemanggil tetapi tidak pernah dipakai — empat
     * halaman mengirim `limit=2000..10000` dan mengira itulah batasnya, padahal
     * query-nya selalu mengambil seluruh baris yang cocok. Sekarang nilainya
     * benar-benar dipakai, dengan atap `MAX_BARIS`.
     *
     * Sengaja TIDAK ada batas bawaan: tanpa `?limit=` perilakunya tetap seperti
     * sekarang (semua baris yang cocok). Memasang batas bawaan yang rendah akan
     * memotong daftar di halaman yang memang membaca borongan — persis jenis
     * kehilangan baris tanpa tanda yang sudah pernah terjadi di tab Pegawai.
     * Saat batas benar-benar diterapkan, `meta.truncated` menyatakannya supaya
     * pemotongannya tidak pernah senyap.
     */
    const MAX_BARIS = 20000;
    const diminta = parseInt(limit, 10);
    const take = Number.isFinite(diminta) && diminta > 0 ? Math.min(MAX_BARIS, diminta) : undefined;

    const data = await this.prisma.siswa_kelas.findMany({
      where,
      orderBy: [
        { tahun_ajaran: 'desc' },
        { semester: 'asc' },
        { kelas: 'asc' },
        { nama_siswa: 'asc' },
        { id: 'asc' },
      ],
      ...(take ? { take } : {}),
    });

    if (!take) return { ok: true, data };

    const total = await this.prisma.siswa_kelas.count({ where });
    return {
      ok: true,
      data,
      meta: { total, returned: data.length, limit: take, truncated: total > data.length },
    };
  }

  async createSiswaKelas(body: any) {
    if (body.items && Array.isArray(body.items)) {
      const items = body.items;

      const uniqueNisns = [...new Set(items.map((item: any) => item.body.nisn?.trim()).filter(Boolean))] as string[];
      const uniqueKelas = [...new Set(items.map((item: any) => item.body.kelas?.trim()).filter(Boolean))] as string[];

      const masterSiswaMap = new Map<string, { nisn: string | null; nama_lengkap: string | null }>();
      if (uniqueNisns.length > 0) {
        const masterSiswaData = await this.prisma.master_siswa.findMany({
          where: { nisn: { in: uniqueNisns } },
          select: { nisn: true, nama_lengkap: true },
        });

        masterSiswaData.forEach((s) => {
          if (s.nisn) masterSiswaMap.set(s.nisn.trim(), s);
        });

        const unpaddedNisns = uniqueNisns
          .filter((n) => n.startsWith('0'))
          .map((n) => n.replace(/^0+/, ''))
          .filter(Boolean);

        if (unpaddedNisns.length > 0) {
          const unpaddedData = await this.prisma.master_siswa.findMany({
            where: { nisn: { in: unpaddedNisns } },
            select: { nisn: true, nama_lengkap: true },
          });

          unpaddedData.forEach((s) => {
            if (s.nisn) {
              masterSiswaMap.set(s.nisn.trim(), s);
              const originalPadded = uniqueNisns.find((n) => n.replace(/^0+/, '') === s.nisn?.trim());
              if (originalPadded) {
                masterSiswaMap.set(originalPadded, s);
              }
            }
          });
        }
      }

      const masterKelasMap = new Map<string, { id: number; nama: string }>();
      if (uniqueKelas.length > 0) {
        const masterKelasData = await this.prisma.master_kelas.findMany({
          where: { nama: { in: uniqueKelas } },
          select: { id: true, nama: true },
        });
        masterKelasData.forEach((k) => {
          masterKelasMap.set(k.nama.trim().toLowerCase(), k as any);
        });
      }

      const existingMap = new Map<string, any>();
      if (uniqueNisns.length > 0) {
        const existingData = await this.prisma.siswa_kelas.findMany({
          where: { nisn: { in: uniqueNisns } },
          select: { id: true, nisn: true, kelas: true, tahun_ajaran: true, semester: true, aktif: true },
        });
        existingData.forEach((r) => {
          const key = `${(r.nisn || '').trim()}|${(r.kelas || '').trim()}|${(r.tahun_ajaran || '').trim()}|${(r.semester || '').trim()}`;
          const prev = existingMap.get(key);
          if (!prev || (!prev.aktif && r.aktif)) existingMap.set(key, r);
        });
      }

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      const recordsToUpsert: any[] = [];

      for (const item of items) {
        const { body: itemBody, rowIndex } = item;
        const nisn = itemBody.nisn?.trim();
        const nama_siswa = itemBody.nama_siswa?.trim();
        const kelas = itemBody.kelas?.trim();
        const tahun_ajaran = itemBody.tahun_ajaran?.trim();
        const semester = itemBody.semester?.trim();

        if (!nisn || !nama_siswa || !kelas || !tahun_ajaran || !semester) {
          failCount++;
          errors.push(`Baris ${rowIndex}: Semua field (NISN, Nama, Kelas, Tahun Ajaran, Semester) wajib diisi.`);
          continue;
        }

        const masterSiswa = masterSiswaMap.get(nisn);
        if (!masterSiswa) {
          failCount++;
          errors.push(`Baris ${rowIndex}: NISN ${nisn} tidak ditemukan di Master Siswa.`);
          continue;
        }

        const namaLengkap = masterSiswa.nama_lengkap || '';
        const masterNisn = masterSiswa.nisn || '';

        if (namaLengkap.trim().toLowerCase() !== nama_siswa.toLowerCase()) {
          failCount++;
          errors.push(`Baris ${rowIndex}: Nama siswa tidak sesuai dengan Master Data. NISN ${nisn} terdaftar atas nama "${namaLengkap}", tetapi input Excel adalah "${nama_siswa}".`);
          continue;
        }

        const masterKelas = masterKelasMap.get(kelas.toLowerCase());
        if (!masterKelas) {
          failCount++;
          errors.push(`Baris ${rowIndex}: Kelas "${kelas}" tidak ditemukan di Master Kelas.`);
          continue;
        }

        const key = `${masterNisn.trim()}|${masterKelas.nama.trim()}|${tahun_ajaran}|${semester}`;
        const existing = existingMap.get(key);

        if (existing) {
          if (itemBody._mode === 'create_only') {
            failCount++;
            errors.push(`Baris ${rowIndex}: Siswa ini sudah punya kelas untuk Tahun Ajaran ${tahun_ajaran} Semester ${semester}.`);
            continue;
          }

          recordsToUpsert.push({
            where: { id: existing.id },
            update: {
              nisn: masterNisn,
              nama_siswa: namaLengkap,
              kelas: masterKelas.nama,
              tahun_ajaran,
              semester,
              aktif: true,
            },
            create: {
              nisn: masterNisn,
              nama_siswa: namaLengkap,
              kelas: masterKelas.nama,
              tahun_ajaran,
              semester,
              aktif: true,
            },
          });
        } else {
          recordsToUpsert.push({
            where: { id: -1 }, // Will force create in transaction
            update: {},
            create: {
              nisn: masterNisn,
              nama_siswa: namaLengkap,
              kelas: masterKelas.nama,
              tahun_ajaran,
              semester,
              aktif: true,
            },
          });
        }
      }

      if (recordsToUpsert.length > 0) {
        try {
          await this.prisma.$transaction(
            recordsToUpsert.map((req) => 
               req.where.id !== -1 
                 ? this.prisma.siswa_kelas.update({ where: { id: req.where.id }, data: req.update })
                 : this.prisma.siswa_kelas.create({ data: req.create })
            )
          );
          successCount = recordsToUpsert.length;
        } catch (err: any) {
          throw new InternalServerErrorException(`Database error: ${err.message}`);
        }
      }

      return { ok: true, successCount, failCount, errors };
    }

    // ── SINGLE IMPORT FALLBACK ──
    if (!body.nisn || !body.nama_siswa || !body.kelas || !body.tahun_ajaran || !body.semester) {
      throw new BadRequestException('Semua field (NISN, Nama, Kelas, Tahun Ajaran, Semester) wajib diisi.');
    }

    const paddedNISN = body.nisn.trim();
    let masterSiswa = await this.prisma.master_siswa.findUnique({
      where: { nisn: paddedNISN },
      select: { nisn: true, nama_lengkap: true },
    });

    if (!masterSiswa && paddedNISN.startsWith('0')) {
      const unpadded = paddedNISN.replace(/^0+/, '');
      masterSiswa = await this.prisma.master_siswa.findUnique({
        where: { nisn: unpadded },
        select: { nisn: true, nama_lengkap: true },
      });
    }

    if (!masterSiswa) {
      throw new BadRequestException(`NISN ${paddedNISN} tidak ditemukan di Master Siswa.`);
    }

    const namaLengkap = masterSiswa.nama_lengkap || '';
    const masterNisn = masterSiswa.nisn || '';

    if (namaLengkap.trim().toLowerCase() !== body.nama_siswa.trim().toLowerCase()) {
      throw new BadRequestException(`Nama siswa tidak sesuai dengan Master Data. NISN ${body.nisn} terdaftar atas nama "${namaLengkap}", tetapi input Excel adalah "${body.nama_siswa}".`);
    }

    const masterKelas = await this.prisma.master_kelas.findFirst({
      where: { nama: body.kelas },
      select: { id: true, nama: true },
    });

    if (!masterKelas) {
      throw new BadRequestException(`Kelas "${body.kelas}" tidak ditemukan di Master Kelas.`);
    }

    const existingRows = await this.prisma.siswa_kelas.findMany({
      where: {
        nisn: masterNisn,
        kelas: masterKelas.nama,
        tahun_ajaran: body.tahun_ajaran,
        semester: body.semester,
      },
      orderBy: [{ aktif: 'desc' }, { id: 'asc' }],
    });

    const existingClassRecord = existingRows[0] || null;

    if (existingClassRecord) {
      if (body._mode === 'create_only') {
        throw new BadRequestException(`Siswa ini sudah punya kelas untuk Tahun Ajaran ${body.tahun_ajaran} Semester ${body.semester}.`);
      }

      const data = await this.prisma.siswa_kelas.update({
        where: { id: existingClassRecord.id },
        data: {
          kelas: masterKelas.nama,
          nama_siswa: namaLengkap,
          aktif: true,
        },
      });

      return { ok: true, data, message: 'Data kelas diperbarui.' };
    } else {
      const data = await this.prisma.siswa_kelas.create({
        data: {
          nisn: masterNisn,
          nama_siswa: namaLengkap,
          kelas: masterKelas.nama,
          tahun_ajaran: body.tahun_ajaran,
          semester: body.semester,
          aktif: true,
        },
      });

      return { ok: true, data, message: 'Data kelas ditambahkan.' };
    }
  }

  /**
   * Ubah satu baris penempatan kelas.
   *
   * `createSiswaKelas` memvalidasi NISN dan kelas ke master lebih dulu, tetapi
   * fungsi ini dulu menulis `nisn`, `nama_siswa`, dan `kelas` langsung dari body
   * tanpa pemeriksaan apa pun. Dua akibatnya:
   *
   *   - NISN yang tidak ada di `master_siswa` bisa tersimpan, dan baris itu
   *     menjadi yatim. Inilah yang kelak menghalangi pemasangan foreign key —
   *     saat ini baru ada 1 baris yatim di seluruh basis data, dan tiap suntingan
   *     seperti ini berpotensi menambahnya.
   *   - `nama_siswa` bisa menyimpang dari `master_siswa.nama_lengkap`. Kolom itu
   *     salinan, bukan sumber; menyimpannya berbeda membuat dua jawaban untuk satu
   *     pertanyaan.
   *
   * Sekarang keduanya diturunkan dari master, sama seperti pada pembuatan. Nama
   * yang dikirim pemanggil sengaja diabaikan — bukan dibiarkan menimpa.
   */
  async updateSiswaKelas(body: any) {
    if (!body.id) throw new BadRequestException('ID is required for update');

    const id = parseInt(body.id, 10);
    if (!Number.isFinite(id)) throw new BadRequestException(`ID tidak valid: ${body.id}`);

    const updatePayload: any = {
      tahun_ajaran: body.tahun_ajaran,
      semester: body.semester,
      aktif: body.aktif,
    };
    if (body.is_pengurus !== undefined) updatePayload.is_pengurus = !!body.is_pengurus;

    if (body.nisn !== undefined) {
      const nisn = String(body.nisn).trim();
      const master = await this.prisma.master_siswa.findFirst({
        where: { nisn },
        select: { nisn: true, nama_lengkap: true },
      });
      if (!master) {
        throw new BadRequestException(`NISN ${nisn} tidak terdaftar di Master Siswa.`);
      }
      updatePayload.nisn = master.nisn;
      updatePayload.nama_siswa = master.nama_lengkap || '';
    }

    if (body.kelas !== undefined) {
      const namaKelas = String(body.kelas).trim();
      const masterKelas = await this.prisma.master_kelas.findFirst({
        where: { nama: namaKelas },
        select: { nama: true },
      });
      if (!masterKelas) {
        throw new BadRequestException(`Kelas "${namaKelas}" tidak ditemukan di Master Kelas.`);
      }
      updatePayload.kelas = masterKelas.nama;
    }

    const data = await this.prisma.siswa_kelas.update({
      where: { id },
      data: updatePayload,
    });

    if (body.is_pengurus !== undefined && body.nisn && body.kelas && body.tahun_ajaran) {
      await this.prisma.siswa_kelas.updateMany({
        where: {
          nisn: body.nisn,
          kelas: body.kelas,
          tahun_ajaran: body.tahun_ajaran,
        },
        data: { is_pengurus: !!body.is_pengurus },
      });
    }

    return { ok: true, data };
  }

  /**
   * Kolom yang boleh dipakai sebagai penyaring pada hapus `?scope=partial`.
   *
   * `field` datang mentah dari query string dan dijadikan nama kolom di `where`.
   * Tanpa daftar ini, kolom apa pun bisa dipakai — mis. `?field=aktif&years=true`
   * yang menghapus seluruh baris aktif, padahal maksud fiturnya menghapus per
   * tahun ajaran. Kolom tak dikenal juga membuat Prisma menolak query dan keluar
   * sebagai 500 yang membingungkan.
   */
  private static readonly FIELD_HAPUS_PARSIAL = ['tahun_ajaran', 'semester', 'kelas'];

  /**
   * `BigInt('abc')` melempar SyntaxError dan `BigInt(1.5)` RangeError — keduanya
   * keluar sebagai 500, padahal itu semata masukan yang salah bentuk.
   */
  private idBigint(nilai: any, label = 'ID'): bigint {
    const teks = String(nilai ?? '').trim();
    if (!/^\d+$/.test(teks)) {
      throw new BadRequestException(`${label} tidak valid`);
    }
    return BigInt(teks);
  }

  private kolomHapusParsial(field?: string): string {
    const dipakai = (field || 'tahun_ajaran').trim();
    if (!SettingsService.FIELD_HAPUS_PARSIAL.includes(dipakai)) {
      throw new BadRequestException(
        `Kolom '${dipakai}' tidak boleh dipakai sebagai penyaring hapus. ` +
          `Pilihan: ${SettingsService.FIELD_HAPUS_PARSIAL.join(', ')}.`,
      );
    }
    return dipakai;
  }

  async deleteSiswaKelas({ id, scope, years, field, confirm }: { id?: number; scope?: string; years?: string; field?: string; confirm?: string }) {
    if (scope === 'all') {
      /**
       * `deleteMany({})` mengosongkan SELURUH tabel secara permanen — dan tidak
       * setara dengan hapus satu baris di bawah, yang cuma hapus lunak
       * (`aktif = false`). Terlalu mudah terpicu dari URL salah ketik, jadi harus
       * dinyatakan terang-terangan. Pola yang sama dipakai di MasterService.remove().
       */
      if (confirm !== 'all') {
        throw new BadRequestException(
          'Mengosongkan seluruh data penempatan kelas harus disertai ?confirm=all',
        );
      }
      const { count } = await this.prisma.siswa_kelas.deleteMany({});
      return { ok: true, deleted: count };
    }

    if (scope === 'partial') {
      const targetField = this.kolomHapusParsial(field);
      if (!years) throw new BadRequestException('Parameter years required for partial reset');

      const yearsArray = years.split(',').map((y) => y.trim()).filter(Boolean);
      if (yearsArray.length === 0) throw new BadRequestException('No valid years provided');

      const { count } = await this.prisma.siswa_kelas.deleteMany({
        where: {
          [targetField]: { in: yearsArray }
        }
      });
      return { ok: true, deleted: count };
    }

    if (!id) throw new BadRequestException('ID is required');

    await this.prisma.siswa_kelas.update({
      where: { id },
      data: { aktif: false },
    });

    return { ok: true };
  }

  // ==========================================
  // GURU MAPEL
  // ==========================================
  /**
   * `parseInt('abc')` menghasilkan NaN dan lolos begitu saja sampai ke
   * `skip`/`take` Prisma, yang menolaknya sebagai 500. Nilai tak terbaca kembali
   * ke bawaannya; `max` mencegah `?limit=999999999` menarik seluruh tabel.
   */
  private angkaPositif(value: any, bawaan: number, max?: number) {
    const n = parseInt(Array.isArray(value) ? value[0] : value, 10);
    if (!Number.isFinite(n) || n < 1) return bawaan;
    return max ? Math.min(max, n) : n;
  }

  /**
   * Express mem-parsing query string dengan `qs`, jadi `?q[contains]=A` tiba
   * sebagai objek dan `?q=a&q=b` sebagai array. Keduanya diteruskan apa adanya ke
   * `where` Prisma bila tidak disaring: yang pertama menyelundupkan operator yang
   * tidak diniatkan, yang kedua memicu 500.
   */
  private filterSkalar(value: any): string | null {
    return typeof value === 'string' ? value : null;
  }

  async getGuruMapel(params: any) {
    const { q, page, limit } = params;

    const pageNum = this.angkaPositif(page, 1);
    const limitNum = this.angkaPositif(limit, 100, 1000);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { aktif: true };
    const cari = this.filterSkalar(q);
    if (cari) {
      where.OR = [
        { nama_guru: { contains: cari, mode: 'insensitive' } },
        { nama_mapel: { contains: cari, mode: 'insensitive' } },
        { nip: { contains: cari, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.guru_mapel.findMany({
        where,
        // `nama_guru` tidak unik; tanpa pemutus, baris bernama sama bisa muncul
        // dua kali di satu halaman dan hilang dari halaman lain.
        orderBy: [{ nama_guru: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limitNum,
      }),
      this.prisma.guru_mapel.count({ where }),
    ]);

    /**
     * `truncated` menyatakan bahwa atap `limit` memotong hasilnya.
     *
     * Empat pemanggil mengirim `?limit=10000` dan mengira itulah batasnya. Atap
     * 1.000 di atas melindungi dari `?limit=999999`, tetapi kalau tabel ini tumbuh
     * melewatinya, halaman akan menampilkan daftar yang tidak lengkap tanpa tanda
     * apa pun — jenis kehilangan baris yang sudah pernah terjadi di tab Pegawai.
     * Dengan penanda ini, pemanggil bisa memberi tahu penggunanya.
     */
    return { ok: true, data, total, truncated: total > data.length };
  }

  async createGuruMapel(body: any) {
    if (!body.nip || !body.nama_mapel) {
      throw new BadRequestException('NIP dan Nama Mapel wajib diisi.');
    }

    const guruData = await this.prisma.master_guru.findFirst({
      where: { nip: body.nip },
      select: { nama_lengkap: true, jenis_pegawai: true },
    });

    if (!guruData) {
      throw new BadRequestException(`Guru dengan NIP ${body.nip} tidak ditemukan di Master Guru.`);
    }

    const jp = guruData.jenis_pegawai ? guruData.jenis_pegawai.trim().toUpperCase() : '';
    if (!jp.includes('GURU')) {
      throw new BadRequestException(`${guruData.nama_lengkap} terdaftar sebagai Tendik, bukan Guru, jadi tidak bisa diberi mata pelajaran.`);
    }

    if (guruData.nama_lengkap.trim().toLowerCase() !== body.nama_guru.trim().toLowerCase()) {
      throw new BadRequestException(`Nama guru tidak sesuai Master. Input: "${body.nama_guru}", Master: "${guruData.nama_lengkap}".`);
    }

    const mapelData = await this.prisma.master_mapel.findFirst({
      where: { nama: body.nama_mapel },
      select: { id: true },
    });

    if (!mapelData) {
      throw new BadRequestException(`Mapel "${body.nama_mapel}" tidak ditemukan di Master Mapel.`);
    }

    const existing = await this.prisma.guru_mapel.findFirst({
      where: {
        nip: body.nip,
        nama_mapel: body.nama_mapel,
      },
      select: { id: true },
    });

    /**
     * Baris guru mapel selalu milik satu tahun ajaran, jadi di sini satu nilai
     * memang benar — tetapi harus nilai yang sama setiap kali. Tanpa `orderBy`,
     * `findFirst` mengambil baris aktif mana pun yang lebih dulu dikembalikan
     * database, sehingga satu proses impor bisa mencap sebagian barisnya dengan
     * tahun berbeda saat ada lebih dari satu tahun ditandai aktif.
     */
    let tahunAjaranValue = body.tahun_ajaran;
    if (!tahunAjaranValue) {
      const activeYear = await this.prisma.master_tahun_ajaran.findFirst({
        where: { is_active: true },
        orderBy: { tahun_ajaran: 'desc' },
      });
      tahunAjaranValue = activeYear ? activeYear.tahun_ajaran : null;
    }
    const semesterValue = body.semester || 'Ganjil';

    if (existing) {
      if (body._mode === 'skip') {
        return { ok: true, skipped: true, message: 'Data sudah ada (Skipped).' };
      }
      
      const data = await this.prisma.guru_mapel.update({
        where: { id: existing.id },
        data: {
          nama_guru: guruData.nama_lengkap,
          kode_guru: body.kode_guru || null,
          kode_mapel: body.kode_mapel || null,
          tahun_ajaran: tahunAjaranValue,
          semester: semesterValue,
          aktif: true,
        },
      });
      return { ok: true, data, message: 'Data diperbarui.' };
    } else {
      const data = await this.prisma.guru_mapel.create({
        data: {
          nip: body.nip,
          nama_guru: guruData.nama_lengkap,
          kode_guru: body.kode_guru || null,
          nama_mapel: body.nama_mapel,
          kode_mapel: body.kode_mapel || null,
          tahun_ajaran: tahunAjaranValue,
          semester: semesterValue,
          aktif: true,
        },
      });
      return { ok: true, data, message: 'Data ditambahkan.' };
    }
  }

  async updateGuruMapel(body: any) {
    if (!body.id) throw new BadRequestException('ID is required for update');

    const data = await this.prisma.guru_mapel.update({
      where: { id: parseInt(body.id, 10) },
      data: {
        nip: body.nip,
        nama_guru: body.nama_guru,
        kode_guru: body.kode_guru || null,
        nama_mapel: body.nama_mapel,
        kode_mapel: body.kode_mapel || null,
        tahun_ajaran: body.tahun_ajaran,
        semester: body.semester,
        aktif: body.aktif,
      },
    });

    return { ok: true, data };
  }

  async deleteGuruMapel({ id, scope, years, field, confirm }: { id?: number; scope?: string; years?: string; field?: string; confirm?: string }) {
    if (scope === 'all') {
      // Lihat catatan yang sama di deleteSiswaKelas().
      if (confirm !== 'all') {
        throw new BadRequestException(
          'Mengosongkan seluruh data guru mapel harus disertai ?confirm=all',
        );
      }
      const { count } = await this.prisma.guru_mapel.deleteMany({});
      return { ok: true, deleted: count };
    }

    if (scope === 'partial') {
      const targetField = this.kolomHapusParsial(field);
      if (!years) throw new BadRequestException('Parameter years required');
      const yearsArray = years.split(',').map((y) => y.trim()).filter(Boolean);
      if (yearsArray.length === 0) throw new BadRequestException('No valid years provided');

      const { count } = await this.prisma.guru_mapel.deleteMany({
        where: {
          [targetField]: { in: yearsArray }
        }
      });
      return { ok: true, deleted: count };
    }

    if (!id) throw new BadRequestException('ID is required');

    await this.prisma.guru_mapel.update({
      where: { id },
      data: { aktif: false },
    });

    return { ok: true };
  }

  // ==========================================
  // WALI KELAS
  // ==========================================
  async getWaliKelas(params: any) {
    const { q, nip, tahun_ajaran, semester, page, limit } = params;
    
    if (nip) {
      const where: any = { nip, aktif: true };
      if (tahun_ajaran && tahun_ajaran !== 'Semua') {
        where.tahun_ajaran = tahun_ajaran;
      }
      const data = await this.prisma.wali_kelas.findMany({
        where,
        select: { nama_kelas: true, nip: true, nama_guru: true, tahun_ajaran: true, semester: true, aktif: true },
        orderBy: [{ nama_kelas: 'asc' }, { semester: 'asc' }],
      });
      return { ok: true, data };
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { aktif: true };
    // Aturannya sama dengan daftar penempatan kelas: "Semua Tahun Ajaran" berarti
    // semua tahun yang diatur aktif. Dulu di sini `findFirst` mengambil satu saja
    // dari beberapa tahun aktif (dan tanpa `orderBy`, jadi bisa berpindah antar
    // permintaan), sedangkan nilai literal `'Semua'` melepas penyaringnya sama
    // sekali — dua perilaku berbeda untuk satu maksud yang sama.
    const filterTahun = await this.filterTahunAjaran(tahun_ajaran);
    if (filterTahun !== undefined) {
      where.tahun_ajaran = filterTahun;
    }
    if (semester) {
      where.semester = semester;
    }
    if (q) {
      where.OR = [
        { nama_kelas: { contains: q, mode: 'insensitive' } },
        { nama_guru: { contains: q, mode: 'insensitive' } },
        { nip: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.wali_kelas.findMany({
        where,
        orderBy: [{ nama_kelas: 'asc' }, { semester: 'asc' }],
        skip: offset,
        take: limitNum,
      }),
      this.prisma.wali_kelas.count({ where }),
    ]);

    return { 
      ok: true, 
      data: data.map(d => ({ ...d, id: d.id.toString() })), 
      total 
    };
  }

  private toSemesterInt(semester: string | number): number {
    if (typeof semester === 'number') return semester;
    if (semester === 'Genap') return 2;
    return 1;
  }

  private async syncToTugasTambahan(nama_kelas: string, nip: string, nama_guru: string, tahun_ajaran: string, semester: string | number, aktif: boolean) {
    const nama_tugas = `Wali Kelas ${nama_kelas}`;
    const semesterInt = this.toSemesterInt(semester);

    if (aktif) {
      const existing = await this.prisma.tugas_tambahan.findFirst({
        where: { nip, jabatan: nama_tugas, tahun_ajaran, semester: semesterInt },
      });
      if (existing) {
        await this.prisma.tugas_tambahan.update({
          where: { id: existing.id },
          data: {
            nama_guru,
            keterangan: 'Wali Kelas otomatis dari modul Pengaturan Kelas',
            approver_role: 'WKM_AKADEMIK',
            granted_role: 'WALI_KELAS',
          },
        });
      } else {
        await this.prisma.tugas_tambahan.create({
          data: {
            nip,
            nama_guru,
            jabatan: nama_tugas,
            keterangan: 'Wali Kelas otomatis dari modul Pengaturan Kelas',
            tahun_ajaran,
            semester: semesterInt,
            approver_role: 'WKM_AKADEMIK',
            granted_role: 'WALI_KELAS',
          },
        });
      }
    } else {
      await this.prisma.tugas_tambahan.deleteMany({
        where: { nip, jabatan: nama_tugas, tahun_ajaran, semester: semesterInt },
      });
    }
  }

  async createWaliKelas(body: any) {
    if (!body.nama_kelas || !body.nip || !body.tahun_ajaran) {
      throw new BadRequestException('Kelas, NIP, dan Tahun Ajaran wajib diisi.');
    }

    const masterGuru = await this.prisma.master_guru.findFirst({
      where: { nip: body.nip.trim() },
      select: { nama_lengkap: true, jenis_pegawai: true },
    });

    if (!masterGuru) {
      throw new BadRequestException(`NIP ${body.nip} tidak ditemukan di Master Guru.`);
    }

    const jp = masterGuru.jenis_pegawai ? masterGuru.jenis_pegawai.trim().toUpperCase() : '';
    if (!jp.includes('GURU')) {
      throw new BadRequestException(`${masterGuru.nama_lengkap} terdaftar sebagai Tendik, bukan Guru, jadi tidak bisa dijadikan wali kelas.`);
    }

    if (body.nama_guru && masterGuru.nama_lengkap.trim().toLowerCase() !== body.nama_guru.trim().toLowerCase()) {
      throw new BadRequestException(`Nama guru tidak sesuai Master. Input: "${body.nama_guru}", Master: "${masterGuru.nama_lengkap}".`);
    }

    const masterKelas = await this.prisma.master_kelas.findFirst({
      where: { nama: body.nama_kelas },
      select: { id: true },
    });

    if (!masterKelas) {
      throw new BadRequestException(`Kelas "${body.nama_kelas}" tidak ditemukan di Master Kelas.`);
    }

    const existing = await this.prisma.wali_kelas.findFirst({
      where: {
        nama_kelas: body.nama_kelas,
        tahun_ajaran: body.tahun_ajaran,
        semester: body.semester ?? 'Ganjil',
      },
    });

    const payload = {
      nama_kelas: body.nama_kelas,
      nip: body.nip,
      nama_guru: masterGuru.nama_lengkap,
      tahun_ajaran: body.tahun_ajaran,
      semester: body.semester ?? 'Ganjil',
      aktif: true,
    };

    if (existing) {
      const data = await this.prisma.wali_kelas.update({
        where: { id: existing.id },
        data: payload,
      });
      await this.syncToTugasTambahan(payload.nama_kelas, payload.nip, payload.nama_guru, payload.tahun_ajaran, payload.semester, payload.aktif ?? false);
      return { ok: true, data: { ...data, id: data.id.toString() }, message: 'Data Wali Kelas diperbarui.' };
    } else {
      const data = await this.prisma.wali_kelas.create({
        data: payload,
      });
      await this.syncToTugasTambahan(payload.nama_kelas, payload.nip, payload.nama_guru, payload.tahun_ajaran, payload.semester, payload.aktif ?? false);
      return { ok: true, data: { ...data, id: data.id.toString() }, message: 'Data Wali Kelas ditambahkan.' };
    }
  }

  async updateWaliKelas(body: any) {
    if (!body.id) throw new BadRequestException('ID is required for update');

    const data = await this.prisma.wali_kelas.update({
      where: { id: BigInt(body.id) },
      data: {
        nama_kelas: body.nama_kelas,
        nip: body.nip,
        nama_guru: body.nama_guru,
        tahun_ajaran: body.tahun_ajaran,
        semester: body.semester,
        aktif: body.aktif,
      },
    });

    await this.syncToTugasTambahan(data.nama_kelas, data.nip || '', data.nama_guru || '', data.tahun_ajaran || '', data.semester || '', data.aktif ?? false);

    return { ok: true, data: { ...data, id: data.id.toString() }, message: 'Status berhasil diperbarui.' };
  }

  async deleteWaliKelas({ id, scope, years, field }: { id?: string; scope?: string; years?: string; field?: string }) {
    if (scope === 'all') {
      await this.prisma.wali_kelas.deleteMany({});
      return { ok: true };
    }

    if (scope === 'partial') {
      const targetField = field || 'tahun_ajaran';
      if (!years) throw new BadRequestException('Parameter years required');
      const yearsArray = years.split(',').map(y => y.trim());
      await this.prisma.wali_kelas.deleteMany({
        where: { [targetField]: { in: yearsArray } }
      });
      return { ok: true };
    }

    if (!id) throw new BadRequestException('ID is required');

    const waliData = await this.prisma.wali_kelas.findUnique({ where: { id: BigInt(id) } });
    if (waliData) {
      await this.prisma.tugas_tambahan.deleteMany({
        where: {
          nip: waliData.nip,
          jabatan: `Wali Kelas ${waliData.nama_kelas}`,
          tahun_ajaran: waliData.tahun_ajaran || '',
          semester: this.toSemesterInt(waliData.semester || ''),
        },
      });
    }

    await this.prisma.wali_kelas.delete({
      where: { id: BigInt(id) },
    });

    return { ok: true, message: 'Data berhasil dihapus.' };
  }

  // ==========================================
  // GURU ASUH
  // ==========================================
  async getGuruAsuh(params: any) {
    const { q, nip, tahun_ajaran, page, limit } = params;
    
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '500', 10);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { aktif: true };
    if (nip) where.nip = nip;
    // Lihat catatan yang sama di getWaliKelas dan getSiswaKelas.
    const filterTahun = await this.filterTahunAjaran(tahun_ajaran);
    if (filterTahun !== undefined) {
      where.tahun_ajaran = filterTahun;
    }

    if (q) {
      where.OR = [
        { nama_guru: { contains: q, mode: 'insensitive' } },
        { nama_siswa: { contains: q, mode: 'insensitive' } },
        { nip: { contains: q, mode: 'insensitive' } },
        { nisn_siswa: { contains: q, mode: 'insensitive' } },
        { kelas: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.guru_asuh.findMany({
        where,
        orderBy: { nama_guru: 'asc' },
        skip: offset,
        take: limitNum,
      }),
      this.prisma.guru_asuh.count({ where }),
    ]);

    return { 
      ok: true, 
      data: data.map(d => ({ ...d, id: d.id.toString() })), 
      total 
    };
  }

  /**
   * `bolehKelola` datang dari controller (Hak Akses Fitur tab Guru Asuh) dan
   * menggantikan `apiUser.role === 'ADMIN' || apiUser.role === 'ADMINISTRATOR'`.
   *
   * Perbandingan lama itu memakai string role UTUH. Di basis data ini ketiga akun
   * admin berrole gabungan — `ADMIN,GURU`, `GURU,ADMIN,WKM_AKADEMIK`, dan
   * `GURU,ADMIN,WKM_AKADEMIK,WKM_KEASRAMAAN,WKM_KESISWAAN` — sehingga tidak satu
   * pun bernilai tepat `'ADMIN'`. Akibatnya setiap admin diperlakukan sebagai guru
   * biasa, dan cabang `if (!bolehKelola) throw 'Akses ditolak.'` di
   * `deleteGuruAsuh` menolak semua orang tanpa kecuali.
   */
  async createGuruAsuh(body: any, apiUser: any, bolehKelola = false) {
    if (!apiUser) throw new BadRequestException('Unauthorized');

    if (!bolehKelola && apiUser.nip !== String(body.nip).trim()) {
      throw new BadRequestException('Anda hanya bisa mengklaim siswa asuh untuk diri Anda sendiri.');
    }

    if (!body.nip || !body.nisn_siswa || !body.tahun_ajaran) {
      throw new BadRequestException('Field NIP, NISN Siswa, dan Tahun Ajaran wajib diisi.');
    }

    const aktif = body.aktif !== undefined ? body.aktif : true;

    const guru = await this.prisma.master_guru.findFirst({
      where: { nip: String(body.nip).trim() },
      select: { nip: true, nama_lengkap: true, jenis_pegawai: true },
    });

    if (!guru) throw new BadRequestException(`NIP ${body.nip} tidak ditemukan di Master Guru.`);
    const jp = guru.jenis_pegawai ? guru.jenis_pegawai.trim().toUpperCase() : '';
    if (!jp.includes('GURU')) {
      throw new BadRequestException(`${guru.nama_lengkap} terdaftar sebagai Tendik, bukan Guru, jadi tidak bisa dijadikan guru asuh.`);
    }

    const paddedNISN = String(body.nisn_siswa).trim();
    const siswaQuery: any = { nisn: paddedNISN, tahun_ajaran: body.tahun_ajaran };
    if (body.kelas) siswaQuery.kelas = body.kelas;

    const siswaKelasData = await this.prisma.siswa_kelas.findFirst({
      where: siswaQuery,
      select: { nisn: true, nama_siswa: true, kelas: true, tahun_ajaran: true },
    });

    if (!siswaKelasData) {
      throw new BadRequestException(`Siswa dengan NISN ${paddedNISN} tidak ditemukan pada Tahun ${body.tahun_ajaran}.`);
    }

    const existingClaim = await this.prisma.guru_asuh.findFirst({
      where: { nisn_siswa: paddedNISN, tahun_ajaran: body.tahun_ajaran, aktif: true },
    });

    if (existingClaim && existingClaim.nip !== body.nip) {
      throw new BadRequestException(`Siswa "${siswaKelasData.nama_siswa}" sudah diasuh oleh ${existingClaim.nama_guru}. Satu siswa hanya boleh diasuh satu guru.`);
    }

    if (!bolehKelola && (!existingClaim || existingClaim.nip !== body.nip)) {
      const currentClaimCount = await this.prisma.guru_asuh.count({
        where: { nip: guru.nip, tahun_ajaran: body.tahun_ajaran, aktif: true },
      });
      const MAX_SISWA_ASUH = 50;
      if (currentClaimCount >= MAX_SISWA_ASUH) {
        throw new BadRequestException(
          `Batas maksimal kuota siswa asuh (${MAX_SISWA_ASUH} siswa) telah tercapai. Hubungi Admin jika memerlukan penambahan kuota.`,
        );
      }
    }

    const payload = {
      nip: guru.nip,
      nama_guru: guru.nama_lengkap,
      nisn_siswa: siswaKelasData.nisn,
      nama_siswa: siswaKelasData.nama_siswa,
      kelas: body.kelas || siswaKelasData.kelas,
      tahun_ajaran: body.tahun_ajaran,
      aktif: aktif,
    };

    if (existingClaim && existingClaim.nip === body.nip) {
      const data = await this.prisma.guru_asuh.update({
        where: { id: existingClaim.id },
        data: payload,
      });
      return { ok: true, data: { ...data, id: data.id.toString() }, message: 'Data Guru Asuh diperbarui.' };
    } else {
      const data = await this.prisma.guru_asuh.create({
        data: payload,
      });
      return { ok: true, data: { ...data, id: data.id.toString() }, message: 'Siswa berhasil diklaim sebagai anak asuh.' };
    }
  }

  async updateGuruAsuh(body: any, apiUser: any, bolehKelola = false) {
    if (!apiUser) throw new BadRequestException('Unauthorized');
    if (!body.id) throw new BadRequestException('ID is required for update');
    const idBaris = this.idBigint(body.id, 'ID');

    const record = await this.prisma.guru_asuh.findUnique({ where: { id: idBaris } });
    if (!record) throw new BadRequestException('Data tidak ditemukan');

    if (!bolehKelola) {
      if (record.nip !== apiUser.nip || (body.nip && body.nip !== apiUser.nip)) {
        throw new ForbiddenException('Anda hanya bisa mengedit data siswa asuh Anda sendiri.');
      }
    }

    const newNisn = body.nisn_siswa ? String(body.nisn_siswa).trim() : record.nisn_siswa;
    const newTa = body.tahun_ajaran ? String(body.tahun_ajaran).trim() : record.tahun_ajaran;

    if (newNisn !== record.nisn_siswa || newTa !== record.tahun_ajaran) {
      const linkedReports = await this.prisma.laporan_guru_asuh.count({
        where: { guru_asuh_id: idBaris },
      });
      if (linkedReports > 0) {
        throw new BadRequestException(
          'Tidak dapat mengubah identitas siswa/tahun ajaran karena data ini sudah memiliki catatan log bimbingan.',
        );
      }

      const duplicateClaim = await this.prisma.guru_asuh.findFirst({
        where: {
          nisn_siswa: newNisn,
          tahun_ajaran: newTa,
          aktif: true,
          id: { not: idBaris },
        },
      });
      if (duplicateClaim) {
        throw new BadRequestException(
          `Siswa dengan NISN ${newNisn} sudah diasuh oleh ${duplicateClaim.nama_guru} pada TA ${newTa}.`,
        );
      }
    }

    const data = await this.prisma.guru_asuh.update({
      where: { id: idBaris },
      data: {
        nip: body.nip || record.nip,
        nama_guru: body.nama_guru || record.nama_guru,
        nisn_siswa: newNisn,
        nama_siswa: body.nama_siswa || record.nama_siswa,
        kelas: body.kelas || record.kelas,
        tahun_ajaran: newTa,
        aktif: body.aktif !== undefined ? body.aktif : record.aktif,
      },
    });

    return { ok: true, data: { ...data, id: data.id.toString() } };
  }

  async deleteGuruAsuh(
    { id, scope, years, field, confirm }: { id?: string; scope?: string; years?: string; field?: string; confirm?: string },
    apiUser: any,
    bolehKelola = false,
  ) {
    if (!apiUser) throw new BadRequestException('Unauthorized');

    if (scope === 'all') {
      if (!bolehKelola) throw new ForbiddenException('Akses ditolak.');
      // `deleteMany({})` mengosongkan seluruh tabel secara permanen. Pola yang
      // sama dipakai `deleteSiswaKelas` dan `MasterService.remove`.
      if (confirm !== 'all') {
        throw new BadRequestException(
          'Mengosongkan seluruh data guru asuh harus disertai ?confirm=all',
        );
      }
      const { count } = await this.prisma.guru_asuh.deleteMany({});
      return { ok: true, deleted: count };
    }

    if (scope === 'partial') {
      if (!bolehKelola) throw new ForbiddenException('Akses ditolak.');
      // `field` dulu dipakai apa adanya sebagai nama kolom: `?field=nip&years=<nip>`
      // menghapus seluruh siswa asuh satu guru, dan nama kolom lain memberi
      // penghapusan massal terarah yang tidak pernah diniatkan layar ini.
      const targetField = this.kolomHapusParsial(field);
      if (!years) throw new BadRequestException('Parameter years required');
      const yearsArray = years.split(',').map((y) => y.trim()).filter(Boolean);
      if (yearsArray.length === 0) {
        throw new BadRequestException('Parameter years tidak boleh kosong');
      }
      const { count } = await this.prisma.guru_asuh.deleteMany({
        where: { [targetField]: { in: yearsArray } }
      });
      return { ok: true, deleted: count };
    }

    if (!id) throw new BadRequestException('ID is required');
    const idBaris = this.idBigint(id, 'ID');

    const rec = await this.prisma.guru_asuh.findUnique({ where: { id: idBaris } });
    if (!rec) throw new BadRequestException('Data tidak ditemukan');

    if (!bolehKelola) {
      if (rec.nip !== apiUser.nip) {
        throw new ForbiddenException('Anda hanya bisa menghapus data siswa asuh Anda sendiri.');
      }
    }

    const lockedReport = await this.prisma.laporan_guru_asuh.findFirst({
      where: {
        guru_asuh_id: idBaris,
        laporan_guru_asuh_submissions: {
          status: { in: ['Submitted', 'Approved'] },
        },
      },
    });
    if (lockedReport) {
      throw new ConflictException(
        'Siswa asuh tidak dapat dihapus karena sudah tercantum dalam laporan bulanan yang telah diajukan atau disahkan.',
      );
    }

    await this.prisma.guru_asuh.update({
      where: { id: idBaris },
      data: { aktif: false },
    });

    return { ok: true };
  }

  // ==========================================
  // GURU MAPEL CHECK & IMPORTS & LOCK DEBUG
  // ==========================================
  async checkGuruMapel(nip: string, tahunAjaran: string, semesterParam: string) {
    if (!nip || !tahunAjaran || !semesterParam) {
      throw new BadRequestException('NIP, Tahun Ajaran, dan Semester wajib diisi');
    }

    const semesters = semesterParam.split(',').map((s) => s.trim());
    const data = await this.prisma.guru_mapel.findFirst({
      where: {
        nip,
        tahun_ajaran: tahunAjaran,
        semester: { in: semesters },
      },
      select: { id: true },
    });

    return { ok: true, exists: !!data };
  }

  async importJadwalGuru(body: any[]) {
    if (!Array.isArray(body) || body.length === 0) {
      throw new BadRequestException('Data import kosong atau format salah.');
    }

    const now = new Date();
    const insertPayload = body.map((item: any) => ({
      nama_guru: item.nama_guru,
      nip: item.nip,
      mata_pelajaran: item.mata_pelajaran || item.mapel,
      hari: item.hari,
      kelas: item.kelas,
      jam_ke: item.jam_ke?.toString(),
      berlaku_mulai: item.berlaku_mulai ? new Date(item.berlaku_mulai) : now,
      aktif: true,
    }));

    const invalid = insertPayload.find((x: any) => !x.nama_guru || !x.hari || !x.kelas || !x.jam_ke || !x.nip);
    if (invalid) {
      throw new BadRequestException(`Data tidak lengkap (Guru/NIP/Hari/Kelas/Jam). Cek baris: ${JSON.stringify(invalid)}`);
    }

    const created = await this.prisma.$transaction(
      insertPayload.map((data) => this.prisma.jadwal_guru.create({ data }))
    );

    await this.createNotification(
      'jadwal_import',
      'Jadwal Mengajar Baru (Import)',
      `${created.length} jadwal berhasil diimport`,
      '/dashboard?page=JadwalGuru'
    );

    return { ok: true, count: created.length, message: `Berhasil import ${created.length} jadwal.` };
  }

  async importJadwalPiket(body: any[]) {
    if (!Array.isArray(body) || body.length === 0) {
      throw new BadRequestException('Data import kosong atau format salah.');
    }

    const invalid = body.find((x: any) => !x.hari || !x.jam_ke || !x.ruang);
    if (invalid) {
      throw new BadRequestException(`Data tidak lengkap (Hari/Jam/Ruang). Cek baris: ${JSON.stringify(invalid)}`);
    }

    const defaultDate = new Date();
    const validRecords = body.map((item: any) => ({
      hari: item.hari,
      jam_ke: typeof item.jam_ke === 'string' ? parseInt(item.jam_ke, 10) : item.jam_ke,
      waktu: item.waktu || '',
      kelas: item.kelas || null,
      ruang: item.ruang,
      kode_guru: item.kode_guru || null,
      nip: item.nip || null,
      berlaku_mulai: item.berlaku_mulai ? new Date(item.berlaku_mulai) : defaultDate,
      aktif: true,
    }));

    const recordMap = new Map<string, any>();
    for (const record of validRecords) {
      const key = `${record.hari}|${record.jam_ke}|${record.ruang}|${record.berlaku_mulai.toISOString()}`;
      recordMap.set(key, record);
    }
    const uniqueRecords = Array.from(recordMap.values());
    const skipped = validRecords.length - uniqueRecords.length;

    const nipSet = new Set(uniqueRecords.map((r) => r.nip).filter(Boolean));
    if (nipSet.size > 0) {
      const validGurus = await this.prisma.master_guru.findMany({
        where: { nip: { in: Array.from(nipSet) } },
        select: { nip: true },
      });
      const validNipSet = new Set(validGurus.map((g) => g.nip));
      for (const record of uniqueRecords) {
        if (record.nip && !validNipSet.has(record.nip)) {
          record.nip = null;
        }
      }
    }

    let inserted = 0;
    let updated = 0;

    for (const record of uniqueRecords) {
      const existing = await this.prisma.jadwal_piket.findFirst({
        where: {
          kode_guru: record.kode_guru,
          hari: record.hari,
          jam_ke: record.jam_ke,
          ruang: record.ruang,
          berlaku_mulai: record.berlaku_mulai,
          aktif: true,
        },
      });

      if (existing) {
        await this.prisma.jadwal_piket.update({
          where: { id: existing.id },
          data: record,
        });
        updated++;
      } else {
        await this.prisma.jadwal_piket.create({
          data: record,
        });
        inserted++;
      }
    }

    const total = inserted + updated;
    const msg = `Total Excel: ${validRecords.length} | Berhasil: ${total} | Duplikat di-skip: ${skipped}`;

    await this.createNotification(
      'piket_input',
      'Jadwal Piket Diimport',
      msg,
      '/dashboard?page=Piket'
    );

    return {
      ok: true,
      inserted,
      updated,
      skipped,
      total: validRecords.length,
      uniqueTotal: uniqueRecords.length,
      message: msg,
    };
  }

  async getUmLockDebug(tahunAjaran: string = '2025/2026') {
    const data = await this.prisma.master_tahun_ajaran.findFirst({
      where: { tahun_ajaran: tahunAjaran },
    });

    return {
      raw: data,
      tahun_ajaran: tahunAjaran,
      has_is_locked: data ? 'is_locked' in data : false,
      is_locked_value: data?.is_locked,
      error: null as string | null,
    };
  }

  async updateUmLockDebug(tahunAjaranParam: string, locked: boolean) {
    if (!tahunAjaranParam || typeof locked !== 'boolean') {
      throw new BadRequestException('Invalid parameters');
    }

    await this.prisma.master_tahun_ajaran.updateMany({
      where: { tahun_ajaran: tahunAjaranParam },
      data: { is_locked: locked },
    });

    const verified = await this.prisma.master_tahun_ajaran.findFirst({
      where: { tahun_ajaran: tahunAjaranParam },
      select: { tahun_ajaran: true, is_locked: true },
    });

    return {
      ok: true,
      verified,
      message: `Lock ${locked ? 'diaktifkan' : 'dinonaktifkan'} untuk ${tahunAjaranParam}`,
    };
  }
}
