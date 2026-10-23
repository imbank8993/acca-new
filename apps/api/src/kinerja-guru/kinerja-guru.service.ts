import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JadwalService } from '../jadwal/jadwal.service';
import { calculateMissingPiket, schoolClock } from './piket-calculation';
import {
  KINERJA_GURU_CETAK_REKAP_KEY,
  aksesDiizinkan,
  parseKonfigurasiAkses,
} from '../auth/feature-access.guard';

interface TeacherStats {
  nip: string;
  nama: string;
  kosong: number;
  tanpa: number;
  dengan: number;
  digabung: number;
  daring: number;
  terlambat: number;
  total_menit: number;
  mengambilIstirahat: number;
  keluarSebelumWaktu: number;
  keluar_durasi_menit: number;
  piket: number;
  total_jp: number;
  details: any[];
}

@Injectable()
export class KinerjaGuruService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jadwalService: JadwalService,
  ) {}

  async aksesCetakRekap(user: any): Promise<boolean> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: KINERJA_GURU_CETAK_REKAP_KEY },
      select: { value: true },
    });
    return aksesDiizinkan(user, parseKonfigurasiAkses(row?.value ?? null));
  }

  async getDashboardSummary(startMonth?: string, endMonth?: string) {
    const result = await this.getStats(startMonth, endMonth);
    const summarize = (items: { nama: string }[]) =>
      items.slice(0, 3).map(({ nama }) => ({ nama }));

    return {
      success: true,
      period: result.period,
      data: {
        jamKosong: summarize(result.data.jamKosong),
        penugasanTanpa: summarize(result.data.penugasanTanpa),
        daring: summarize(result.data.daring),
        penugasanDengan: summarize(result.data.penugasanDengan),
        terlambat: summarize(result.data.terlambat),
      },
      // Versi guru piket (hitungan kejadian), berdampingan dengan versi jurnal.
      dataPiket: {
        jamKosong: summarize(result.dataPiket.jamKosong),
        penugasanTanpa: summarize(result.dataPiket.penugasanTanpa),
        daring: summarize(result.dataPiket.daring),
        penugasanDengan: summarize(result.dataPiket.penugasanDengan),
        terlambat: summarize(result.dataPiket.terlambat),
      },
    };
  }

  async getStats(startMonth?: string, endMonth?: string, apiUser?: any) {
    const now = new Date();
    const validMonth = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
    const resolvePeriod = (today: string) => {
      const periodStart = startMonth || `${today.slice(0, 4)}-01`;
      const periodEnd = endMonth || today.slice(0, 7);
      if (typeof periodStart !== 'string' || typeof periodEnd !== 'string' || !validMonth.test(periodStart) || !validMonth.test(periodEnd))
        throw new BadRequestException('Periode harus berformat YYYY-MM dengan bulan yang valid.');
      const [sy, sm] = periodStart.split('-').map(Number), [ey, em] = periodEnd.split('-').map(Number);
      const monthCount = (ey - sy) * 12 + em - sm + 1;
      if (monthCount < 1 || monthCount > 12) throw new BadRequestException('Periode harus berurutan dan maksimal 12 bulan.');
      return { periodStart, periodEnd, sy, sm, ey, em };
    };
    // Validate explicit input before touching the database.
    resolvePeriod(schoolClock(now, 'Asia/Makassar').date);
    const timezoneRow = await this.prisma.site_settings.findUnique({ where: { key: 'timezone' }, select: { value: true } });
    const configuredZone = timezoneRow?.value;
    const timezone = configuredZone && ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(configuredZone) ? configuredZone : 'Asia/Makassar';
    const clock = schoolClock(now, timezone);
    const { periodStart, periodEnd, sy, sm, ey, em } = resolvePeriod(clock.date);

    const periodStartStr = `${sy}-${String(sm).padStart(2, '0')}-01`;
    const lastDay = new Date(ey, em, 0).getDate();
    const periodEndStr = `${ey}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const periodStartDate = new Date(sy, sm - 1, 1);
    const periodEndDate = new Date(ey, em - 1, lastDay);

    const diffMs = periodEndDate.getTime() - periodStartDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const effectiveWeeks = Math.max(1, Math.round(diffDays / 7));

    // 1. Fetch effective schedule
    let allJadwal: any[] = [];
    try {
      const res = await this.jadwalService.getJadwal({ valid_date: periodEndStr });
      allJadwal = (res as any)?.data || [];
    } catch (e) {
      console.error('Error fetching jadwal in KinerjaGuruService:', e);
    }

    const teacherWeeklyJP: Record<string, number> = {};
    const weekSlotSets: Record<string, Set<string>> = {};
    allJadwal.forEach((j) => {
      if (!j.nip || !j.nama_guru) return;
      const nip = String(j.nip).trim();
      if (!weekSlotSets[nip]) weekSlotSets[nip] = new Set();
      weekSlotSets[nip].add(`${j.hari}|${j.jam_ke}`);
    });
    Object.entries(weekSlotSets).forEach(([nip, slots]) => {
      teacherWeeklyJP[nip] = slots.size;
    });

    const teacherTotalJP: Record<string, number> = {};
    Object.entries(teacherWeeklyJP).forEach(([nip, weeklyJP]) => {
      teacherTotalJP[nip] = weeklyJP * effectiveWeeks;
    });

    // 2. Classes & Waktu
    const kelasRows = await this.prisma.master_kelas.findMany({
      select: { nama: true, program: true, tingkat: true },
    });
    const kelasProgramMap: Record<string, string> = {};
    kelasRows.forEach((k) => {
      if (k.nama) kelasProgramMap[k.nama.trim()] = k.program || 'Reguler';
    });

    const allWaktu = await this.prisma.master_waktu.findMany({
      where: { aktif: true },
      select: { hari: true, jam_ke: true, mulai: true, selesai: true, program: true },
      orderBy: { jam_ke: 'asc' },
    });

    const waktuMap: Record<string, Record<string, Record<string, { mulai: string; selesai: string }>>> = {};
    allWaktu.forEach((w) => {
      const key = w.program || 'Reguler';
      if (!waktuMap[key]) waktuMap[key] = {};
      const hari = w.hari || '';
      if (!waktuMap[key][hari]) waktuMap[key][hari] = {};
      const mulaiStr = w.mulai instanceof Date ? w.mulai.toISOString().substring(11, 16) : String(w.mulai || '');
      const selesaiStr = w.selesai instanceof Date ? w.selesai.toISOString().substring(11, 16) : String(w.selesai || '');
      waktuMap[key][hari][String(w.jam_ke)] = { mulai: mulaiStr, selesai: selesaiStr };
    });

    const findWaktu = (prog: string, hari: string, jamId: string): string => {
      const targetProg = prog || 'Reguler';
      const progMap = waktuMap[targetProg];
      if (!progMap) return '';
      if (hari && progMap[hari]?.[jamId]) {
        const s = progMap[hari][jamId];
        return `${s.mulai?.slice(0, 5)} - ${s.selesai?.slice(0, 5)}`;
      }
      if (progMap['']?.[jamId]) {
        const s = progMap[''][jamId];
        return `${s.mulai?.slice(0, 5)} - ${s.selesai?.slice(0, 5)}`;
      }
      for (const h in progMap) {
        if (progMap[h][jamId]) {
          const s = progMap[h][jamId];
          return `${s.mulai?.slice(0, 5)} - ${s.selesai?.slice(0, 5)}`;
        }
      }
      return '';
    };

    // 3. Jurnal Guru (Include full end date)
    const startQueryDate = new Date(`${periodStartStr}T00:00:00.000Z`);
    const endQueryDate = new Date(`${periodEndStr}T23:59:59.999Z`);

    const allJurnals = await this.prisma.jurnal_guru.findMany({
      where: {
        tanggal: {
          gte: startQueryDate,
          lte: endQueryDate,
        },
      },
      orderBy: { tanggal: 'desc' },
    });

    // 4. Piket
    const allLaporanPiket = await this.prisma.laporan_piket.findMany({
      where: {
        tanggal: {
          gte: startQueryDate,
          lte: endQueryDate,
        },
      },
      include: {
        laporan_piket_detail: {
          select: {
            nama_kelas: true, jam_ke: true, nama_guru: true,
            status_kehadiran: true, status_tambahan_1: true, status_tambahan_2: true, status_tambahan_3: true,
          },
        },
      },
    });

    const jadwalPiket = await this.prisma.jadwal_piket.findMany({
      where: { aktif: true, berlaku_mulai: { lte: endQueryDate } },
    });
    const holidays = await this.prisma.libur.findMany({
      where: { tanggal: { gte: startQueryDate, lte: endQueryDate } },
      select: { tanggal: true, jam_ke: true, lingkup: true, target_kelas: true },
    });

    // 5. Master Guru
    const allTeachers = await this.prisma.master_guru.findMany({
      select: { nip: true, nama_lengkap: true },
    });

    const nameToNipMap: Record<string, string> = {};
    const nipToNameMap: Record<string, string> = {};
    allTeachers.forEach((t) => {
      const normalized = (t.nama_lengkap || '').trim().toLowerCase();
      nameToNipMap[normalized] = t.nip;
      nipToNameMap[t.nip] = t.nama_lengkap;
      const baseName = normalized.split(',')[0].trim();
      if (!nameToNipMap[baseName]) nameToNipMap[baseName] = t.nip;
    });

    // 6. Izin Guru
    const allIzinGuru = await this.prisma.izin_guru.findMany({
      where: {
        tanggal_mulai: { lte: endQueryDate },
        tanggal_selesai: { gte: startQueryDate },
      },
      select: {
        id: true,
        nip: true,
        nama_guru: true,
        jenis: true,
        status: true,
        tanggal_mulai: true,
        tanggal_selesai: true,
        keterangan: true,
        instansi_tujuan: true,
      },
    });

    const preparedIzinList = allIzinGuru.map((i) => {
      const mulaiStr = i.tanggal_mulai instanceof Date
        ? i.tanggal_mulai.toISOString().split('T')[0]
        : String(i.tanggal_mulai || '').split('T')[0];
      const selesaiStr = i.tanggal_selesai instanceof Date
        ? i.tanggal_selesai.toISOString().split('T')[0]
        : String(i.tanggal_selesai || '').split('T')[0];
      const normNip = (i.nip || '').trim();
      const normName = (i.nama_guru || '').trim().toLowerCase();
      const baseName = normName.split(',')[0].trim();
      return {
        id: i.id,
        nip: normNip,
        nama: normName,
        baseName,
        jenis: i.jenis,
        status: i.status,
        keterangan: i.keterangan,
        instansi_tujuan: i.instansi_tujuan,
        mulaiStr,
        selesaiStr,
      };
    });

    const findIzin = (teacherNip: string, teacherNama: string, dateStr: string) => {
      if (!dateStr) return null;
      const tNip = (teacherNip || '').trim();
      const tName = (teacherNama || '').trim().toLowerCase();
      const tBase = tName.split(',')[0].trim();

      const matches = preparedIzinList.filter((iz) => {
        if (dateStr < iz.mulaiStr || dateStr > iz.selesaiStr) return false;
        if (tNip && iz.nip) return tNip === iz.nip;
        if (tName && iz.nama && (tName === iz.nama || tBase === iz.baseName)) return true;
        return false;
      });

      if (!matches.length) return null;

      matches.sort((a, b) => {
        const score = (st: string) => (st === 'disetujui' ? 2 : st === 'pending' ? 1 : 0);
        return score(b.status) - score(a.status);
      });

      const best = matches[0];
      return {
        id: best.id,
        jenis: best.jenis,
        status: best.status,
        keterangan: best.keterangan || (best.jenis === 'dinas_luar' ? best.instansi_tujuan : null),
        instansi_tujuan: best.instansi_tujuan || null,
        tanggal_mulai: best.mulaiStr,
        tanggal_selesai: best.selesaiStr,
      };
    };

    const stats: Record<string, TeacherStats> = {};

    const ensureKey = (nama: string, nipInput?: string, resolveName = true) => {
      const normalizedName = (nama || '').trim().toLowerCase();
      const baseName = normalizedName.split(',')[0].trim();
      const nip = nipInput || (resolveName ? nameToNipMap[normalizedName] || nameToNipMap[baseName] : '') || '';
      const key = nip || normalizedName;
      const displayName = nip && nipToNameMap[nip] ? nipToNameMap[nip] : nama;

      if (!stats[key]) {
        stats[key] = {
          nip,
          nama: displayName,
          kosong: 0,
          tanpa: 0,
          dengan: 0,
          digabung: 0,
          daring: 0,
          terlambat: 0,
          total_menit: 0,
          mengambilIstirahat: 0,
          keluarSebelumWaktu: 0,
          keluar_durasi_menit: 0,
          piket: 0,
          total_jp: teacherTotalJP[nip] || 0,
          details: [],
        };
      }
      return key;
    };

    // Count one missing duty per teacher/date/JP, with one matching detail row.
    // Reports represent completed class slots, including work covered by a colleague.
    const missingPiket = calculateMissingPiket({
      schedules: jadwalPiket, reports: allLaporanPiket, holidays, classes: kelasRows,
      start: periodStartStr, end: periodEndStr, today: clock.date, currentMinutes: clock.minutes,
    });
    for (const missed of missingPiket) {
      const teacherKey = ensureKey(missed.nama, missed.nip);
      stats[teacherKey].piket += 1;
      stats[teacherKey].details.push({
        tanggal: missed.tanggal, hari: missed.hari, type: 'Tidak Piket',
        keterangan: 'Slot piket belum dilaporkan', mapel: 'Tugas Piket',
        jam_ke: String(missed.jam), kelas: missed.kelas, waktu: missed.waktu,
        izin: findIzin(missed.nip, nipToNameMap[missed.nip] || missed.nama, missed.tanggal),
      });
    }

    // Dedup and process Jurnal Guru (Priority: SISWA > GURU)
    const slotMap = new Map<string, any>();
    allJurnals.forEach((j) => {
      const date = j.tanggal ? (j.tanggal instanceof Date ? j.tanggal.toISOString().split('T')[0] : String(j.tanggal)) : '';
      const nip = j.nip || '';
      const kelas = (j.kelas || '').trim();
      const jamId = (j.jam_ke_id || j.jam_ke || '').toString();
      const filledBy = (j.filled_by || 'GURU').toUpperCase();
      const hours = jamId.split(',').map((h: string) => h.trim());
      hours.forEach((h: string) => {
        const slotKey = `${date}|${nip}|${kelas}|${h}`;
        const existing = slotMap.get(slotKey);
        if (!existing || (filledBy === 'SISWA' && existing.filled_by !== 'SISWA')) {
          slotMap.set(slotKey, j);
        }
      });
    });

    const uniqueItemsMap = new Map<any, any>();
    slotMap.forEach((val) => uniqueItemsMap.set(val.id, val));
    const finalJurnals = Array.from(uniqueItemsMap.values());

    finalJurnals.forEach((j) => {
      const guruPengganti = (j.guru_pengganti || '').trim();
      const isGuruPengganti = guruPengganti && guruPengganti !== '-' && guruPengganti !== '';
      const kategoriUtama = (j.kategori_kehadiran || '').trim().toLowerCase();

      // Attendance and duration fields describe the substitute when one is selected.
      const targetNama = isGuruPengganti ? guruPengganti : (j.nama_guru || '').trim() || (j.nip ? `Guru (${j.nip})` : '');
      const substituteNips = isGuruPengganti ? [...new Set(allTeachers
        .filter(t => (t.nama_lengkap || '').trim().toLowerCase() === guruPengganti.toLowerCase()).map(t => t.nip))] : [];
      const targetNip = isGuruPengganti ? (substituteNips.length === 1 ? substituteNips[0] : '') : j.nip || '';
      if (!targetNama && !targetNip) return;

      const targetKey = ensureKey(targetNama, targetNip, !isGuruPengganti);

      const statusUtama = kategoriUtama;
      const statusPengganti = (j.status_pengganti || '').trim().toLowerCase();
      const statusTambahan = (j.kategori_kehadiran_tambahan || '').trim().toLowerCase();
      const statusT1 = (j.status_tambahan_1 || '').trim().toLowerCase();
      const statusT2 = (j.status_tambahan_2 || '').trim().toLowerCase();
      const statusT3 = (j.status_tambahan_3 || '').trim().toLowerCase();

      const rawStatuses = [
        isGuruPengganti ? statusPengganti : statusUtama,
        statusTambahan,
        statusT1,
        statusT2,
        statusT3,
      ].filter((s) => s && s !== '-' && s !== '');

      // Deduplicate statuses for the same jurnal entry
      const uniqueStatuses = Array.from(new Set(rawStatuses));

      const kelasKey = (j.kelas || '').trim();
      const prog = kelasProgramMap[kelasKey] || 'Reguler';
      let hari = (j.hari || '').trim();
      const tglStr = j.tanggal instanceof Date ? j.tanggal.toISOString().split('T')[0] : String(j.tanggal || '');
      if (!hari && tglStr) {
        try {
          const [y, m, d] = tglStr.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          hari = dayNames[dateObj.getDay()];
        } catch (e) {}
      }
      const jamId = j.jam_ke_id != null ? String(j.jam_ke_id) : '';
      const waktu = findWaktu(prog, hari, jamId) || j.jam_ke;

      const baseEntry = () => ({
        tanggal: tglStr,
        kelas: j.kelas,
        program: prog,
        hari: hari || undefined,
        mapel: j.mata_pelajaran,
        jam_ke: j.jam_ke,
        waktu,
        durasi: undefined as number | undefined,
        keterangan: '' as string,
        izin: findIzin(targetNip, targetNama, tglStr),
      });

      const durasiTerlambat = parseInt(j.durasi_terlambat, 10) || 0;
      const durasiKeluar = parseInt(j.durasi_keluar_awal, 10) || 0;
      const ketTambahan = (j.keterangan_tambahan || '').trim();

      uniqueStatuses.forEach((status) => {
        if (status === 'terlambat') {
          stats[targetKey].terlambat++;
          stats[targetKey].total_menit += durasiTerlambat;
          const e: any = baseEntry();
          e.type = 'Terlambat';
          e.durasi = durasiTerlambat;
          e.keterangan = durasiTerlambat > 0 ? `${durasiTerlambat} Menit` : ketTambahan || 'Terlambat';
          stats[targetKey].details.push(e);
        } else if (status === 'kosong') {
          stats[targetKey].kosong++;
          const e: any = baseEntry();
          e.type = 'Jam Kosong';
          e.keterangan = ketTambahan && ketTambahan !== '-' ? ketTambahan : '-';
          stats[targetKey].details.push(e);
        } else if (status.includes('tanpa pendampingan')) {
          stats[targetKey].tanpa++;
          const e: any = baseEntry();
          e.type = 'Tanpa Pendampingan';
          e.keterangan = ketTambahan && ketTambahan !== '-' ? ketTambahan : '-';
          stats[targetKey].details.push(e);
        } else if (status.includes('dengan pendampingan')) {
          stats[targetKey].dengan++;
          const e: any = baseEntry();
          e.type = 'Dengan Pendampingan';
          e.keterangan = ketTambahan && ketTambahan !== '-' ? ketTambahan : '-';
          stats[targetKey].details.push(e);
        } else if (status === 'digabung') {
          stats[targetKey].digabung++;
          const e: any = baseEntry();
          e.type = 'Digabung';
          e.keterangan = ketTambahan && ketTambahan !== '-' ? ketTambahan : '-';
          stats[targetKey].details.push(e);
        } else if (status.includes('daring')) {
          stats[targetKey].daring++;
          const e: any = baseEntry();
          e.type = 'Daring';
          e.keterangan = ketTambahan && ketTambahan !== '-' ? ketTambahan : '-';
          stats[targetKey].details.push(e);
        }
      });

      if (j.mengambil_istirahat === true || j.mengambil_istirahat === 'true') {
        stats[targetKey].mengambilIstirahat++;
        const e: any = baseEntry();
        e.type = 'Mengambil Waktu Istirahat';
        stats[targetKey].details.push(e);
      }

      if (durasiKeluar > 0) {
        stats[targetKey].keluarSebelumWaktu++;
        stats[targetKey].keluar_durasi_menit += durasiKeluar;
        const e: any = baseEntry();
        e.type = 'Keluar Sebelum Waktunya';
        e.durasi = durasiKeluar;
        e.keterangan = `${durasiKeluar} Menit`;
        stats[targetKey].details.push(e);
      }
    });

    Object.values(stats).forEach((s) => {
      if (s.nip && teacherTotalJP[s.nip]) {
        s.total_jp = teacherTotalJP[s.nip];
      }
    });

    // -- Versi Guru Piket ---------------------------------------------------
    // Dihitung TERPISAH dari jurnal (tidak digabung): status kehadiran guru per
    // kelas/JP yang dicatat guru piket di laporan_piket_detail. Guru piket tidak
    // mencatat durasi, jadi setiap kategori - termasuk Terlambat - dihitung
    // sebagai jumlah kejadian (satu kelas x satu JP = satu kejadian).
    const jadwalSlotNip = new Map<string, { nip: string; nama: string }>();
    allJadwal.forEach((j) => {
      if (!j.nip) return;
      const key = `${String(j.hari || '').trim().toLowerCase()}|${Number(j.jam_ke) || String(j.jam_ke ?? '').trim()}|${String(j.kelas || '').trim().toLowerCase()}`;
      if (!jadwalSlotNip.has(key)) jadwalSlotNip.set(key, { nip: String(j.nip).trim(), nama: j.nama_guru || '' });
    });
    type PiketStat = { nip: string; nama: string; kosong: number; tanpa: number; dengan: number; digabung: number; daring: number; terlambat: number; total_jp: number; details: any[] };
    const statsPiket: Record<string, PiketStat> = {};
    const ensurePiketKey = (nama: string, nip: string) => {
      const key = nip || (nama || '').trim().toLowerCase();
      if (!statsPiket[key]) {
        statsPiket[key] = {
          nip, nama: nip && nipToNameMap[nip] ? nipToNameMap[nip] : nama,
          kosong: 0, tanpa: 0, dengan: 0, digabung: 0, daring: 0, terlambat: 0,
          total_jp: teacherTotalJP[nip] || 0, details: [],
        };
      }
      return key;
    };
    const dayNamesPiket = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const piketSeen = new Set<string>();
    allLaporanPiket.forEach((lap: any) => {
      const tglStr = lap.tanggal instanceof Date ? lap.tanggal.toISOString().split('T')[0] : String(lap.tanggal || '').slice(0, 10);
      if (!tglStr) return;
      const [py, pm, pd] = tglStr.split('-').map(Number);
      const hari = dayNamesPiket[new Date(py, pm - 1, pd).getDay()];
      const pelapor = String(lap.nama_guru_piket || lap.nama_guru || '').trim();
      (lap.laporan_piket_detail || []).forEach((det: any) => {
        const kelas = String(det.nama_kelas || '').trim();
        const statuses = Array.from(new Set([det.status_kehadiran, det.status_tambahan_1, det.status_tambahan_2, det.status_tambahan_3]
          .map((v) => String(v || '').trim().toLowerCase())
          .filter((v) => v && v !== '-')));
        if (!statuses.length) return;
        const jams = String(det.jam_ke ?? '').split(',').map((h) => h.trim()).filter(Boolean);
        jams.forEach((rawJam) => {
          const jam = String(Number(rawJam) || rawJam);
          // Satu slot kelas/JP hanya dihitung sekali walau laporannya terduplikasi.
          const slotKey = `${tglStr}|${kelas.toLowerCase()}|${jam}`;
          if (piketSeen.has(slotKey)) return;
          piketSeen.add(slotKey);

          // Identitas guru: nama yang ditulis guru piket, lalu jadwal kelas/JP.
          const namaTercatat = String(det.nama_guru || '').trim();
          const normNama = namaTercatat.toLowerCase();
          const jadwalHit = jadwalSlotNip.get(`${hari.toLowerCase()}|${jam}|${kelas.toLowerCase()}`);
          const nip = (normNama && (nameToNipMap[normNama] || nameToNipMap[normNama.split(',')[0].trim()])) || jadwalHit?.nip || '';
          const nama = namaTercatat || jadwalHit?.nama || '';
          if (!nip && !nama) return;
          const key = ensurePiketKey(nama, nip);
          const prog = kelasProgramMap[kelas] || 'Reguler';
          const entry = (type: string) => ({
            tanggal: tglStr, hari, kelas, program: prog, mapel: '-', jam_ke: jam,
            waktu: findWaktu(prog, hari, jam) || jam,
            type, sumber: 'Piket',
            keterangan: pelapor ? `Dicatat guru piket: ${pelapor}` : 'Dicatat guru piket',
            izin: findIzin(nip, nip ? nipToNameMap[nip] || nama : nama, tglStr),
          });
          statuses.forEach((status) => {
            const st = statsPiket[key];
            if (status === 'terlambat') { st.terlambat++; st.details.push(entry('Terlambat')); }
            else if (status === 'kosong' || status === 'kelas kosong') { st.kosong++; st.details.push(entry('Jam Kosong')); }
            else if (status.includes('tanpa pendampingan')) { st.tanpa++; st.details.push(entry('Tanpa Pendampingan')); }
            else if (status.includes('dengan pendampingan')) { st.dengan++; st.details.push(entry('Dengan Pendampingan')); }
            else if (status === 'digabung') { st.digabung++; st.details.push(entry('Digabung')); }
            else if (status.includes('daring')) { st.daring++; st.details.push(entry('Daring')); }
          });
        });
      });
    });
    const allPiketStats = Object.values(statsPiket);
    const topPiket = (field: 'kosong' | 'tanpa' | 'dengan' | 'digabung' | 'daring' | 'terlambat') =>
      allPiketStats
        .filter((item) => item[field] > 0)
        .sort((a, b) => b[field] - a[field])
        .slice(0, 10)
        .map((item) => ({ ...item, count: item[field], total_jp: item.total_jp || 0 }));

    const allStats = Object.values(stats);

    const sortBy = (arr: TeacherStats[], field: keyof TeacherStats) =>
      [...arr].sort((a, b) => {
        const aVal = field === 'total_menit' ? a.total_menit : (a as any)[field];
        const bVal = field === 'total_menit' ? b.total_menit : (b as any)[field];
        return bVal - aVal;
      });

    const wrap = (s: TeacherStats[], field: keyof TeacherStats) =>
      sortBy(s, field)
        .filter((item) => (item as any)[field] > 0)
        .map((item) => ({ ...item, count: (item as any)[field] }))
        .slice(0, 10);

    const mengambilIstirahatSorted = sortBy(allStats, 'mengambilIstirahat')
      .filter((s) => s.mengambilIstirahat > 0)
      .map((s) => ({ ...s, count: s.mengambilIstirahat }))
      .slice(0, 10);

    const keluarSebelumWaktuSorted = sortBy(allStats, 'keluar_durasi_menit')
      .filter((s) => s.keluarSebelumWaktu > 0)
      .map((s) => ({ ...s, count: s.keluar_durasi_menit }))
      .slice(0, 10);

    const addTotalJP = (arr: any[]) => arr.map((s) => ({ ...s, total_jp: s.total_jp || 0 }));

    const canCetak = apiUser ? await this.aksesCetakRekap(apiUser) : false;

    return {
      success: true,
      totalRaw: allJurnals.length,
      totalUnique: finalJurnals.length,
      totalStats: allStats.length,
      period: {
        start_month: periodStart,
        end_month: periodEnd,
        start_date: periodStartStr,
        end_date: periodEndStr,
      },
      data: {
        mengambilIstirahat: addTotalJP(mengambilIstirahatSorted),
        keluarSebelumWaktu: addTotalJP(keluarSebelumWaktuSorted),
        jamKosong: addTotalJP(wrap([...allStats], 'kosong')),
        penugasanTanpa: addTotalJP(wrap([...allStats], 'tanpa')),
        penugasanDengan: addTotalJP(wrap([...allStats], 'dengan')),
        digabung: addTotalJP(wrap([...allStats], 'digabung')),
        terlambat: addTotalJP(
          sortBy(allStats, 'total_menit')
            .filter((s) => s.terlambat > 0)
            .map((s) => ({ ...s, count: s.total_menit }))
            .slice(0, 10),
        ),
        piket: addTotalJP(wrap([...allStats], 'piket')),
        daring: addTotalJP(wrap([...allStats], 'daring')),
      },
      // Versi guru piket - berdampingan dengan `data` (versi jurnal); satuan selalu "kali".
      dataPiket: {
        jamKosong: topPiket('kosong'),
        penugasanTanpa: topPiket('tanpa'),
        penugasanDengan: topPiket('dengan'),
        digabung: topPiket('digabung'),
        terlambat: topPiket('terlambat'),
        daring: topPiket('daring'),
      },
      akses: {
        cetakRekap: canCetak,
      },
    };
  }
}
