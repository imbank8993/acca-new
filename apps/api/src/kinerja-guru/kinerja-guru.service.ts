import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JadwalService } from '../jadwal/jadwal.service';

interface TeacherStats {
  nip: string;
  nama: string;
  kosong: number;
  tanpa: number;
  dengan: number;
  digabung: number;
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
        terlambat: summarize(result.data.terlambat),
      },
    };
  }

  async getStats(startMonth?: string, endMonth?: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const defaultStart = `${currentYear}-01`;
    const defaultEnd = `${currentYear}-${currentMonth}`;

    const periodStart = startMonth || defaultStart;
    const periodEnd = endMonth || defaultEnd;

    const [sy, sm] = periodStart.split('-').map(Number);
    const [ey, em] = periodEnd.split('-').map(Number);

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
      select: { nama: true, program: true },
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
          select: { nama_kelas: true, jam_ke: true },
        },
      },
    });

    const jadwalPiket = await this.prisma.jadwal_piket.findMany({
      where: { aktif: true },
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

    const stats: Record<string, TeacherStats> = {};

    const ensureKey = (nama: string, nipInput?: string) => {
      const normalizedName = (nama || '').trim().toLowerCase();
      const baseName = normalizedName.split(',')[0].trim();
      const nip = nipInput || nameToNipMap[normalizedName] || nameToNipMap[baseName] || '';
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

    // Calculate Piket stats (strictly bounded within selected period)
    try {
      if (jadwalPiket.length > 0 && allLaporanPiket.length > 0) {
        const slotReportedTable = new Set<string>();
        allLaporanPiket.forEach((lp) => {
          const datePart = lp.tanggal instanceof Date ? lp.tanggal.toISOString().split('T')[0] : String(lp.tanggal || '');
          lp.laporan_piket_detail?.forEach((d: any) => {
            const slotKey = `${datePart}|${(d.nama_kelas || '').trim()}|${d.jam_ke}`;
            slotReportedTable.add(slotKey);
          });
        });

        const scheduleByDay: Record<string, any[]> = {};
        jadwalPiket.forEach((s) => {
          if (!scheduleByDay[s.hari]) scheduleByDay[s.hari] = [];
          scheduleByDay[s.hari].push(s);
        });

        const todayStr = new Date().toISOString().split('T')[0];
        const calcPiketStart = periodStartStr;
        const calcPiketEnd = periodEndStr < todayStr ? periodEndStr : todayStr;

        if (calcPiketStart <= calcPiketEnd) {
          const [csY, csM, csD] = calcPiketStart.split('-').map(Number);
          const [ceY, ceM, ceD] = calcPiketEnd.split('-').map(Number);
          const current = new Date(csY, csM - 1, csD);
          const end = new Date(ceY, ceM - 1, ceD);
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

          let securityCounter = 0;
          while (current <= end && securityCounter < 500) {
            securityCounter++;
            const cY = current.getFullYear();
            const cM = String(current.getMonth() + 1).padStart(2, '0');
            const cD = String(current.getDate()).padStart(2, '0');
            const dateStr = `${cY}-${cM}-${cD}`;
            const dayName = dayNames[current.getDay()];

            if (dayName !== 'Minggu') {
              const rawDaySchedules = scheduleByDay[dayName] || [];
              const activeSchedules = rawDaySchedules.filter((s) => {
                const bStr = s.berlaku_mulai instanceof Date ? s.berlaku_mulai.toISOString().split('T')[0] : String(s.berlaku_mulai || '');
                return bStr <= dateStr;
              });

              if (activeSchedules.length > 0) {
                const slotMap = new Map<string, any>();
                activeSchedules.forEach((s) => {
                  const slotUID = `${s.jam_ke}|${s.kelas}`;
                  const existing = slotMap.get(slotUID);
                  const bStr = s.berlaku_mulai instanceof Date ? s.berlaku_mulai.toISOString().split('T')[0] : String(s.berlaku_mulai || '');
                  const exStr = existing?.berlaku_mulai instanceof Date ? existing.berlaku_mulai.toISOString().split('T')[0] : String(existing?.berlaku_mulai || '');
                  if (!existing || bStr > exStr) {
                    slotMap.set(slotUID, s);
                  }
                });

                const teacherSlotsMap = new Map<string, any[]>();
                slotMap.forEach((s) => {
                  if (!s.nip) return;
                  if (!teacherSlotsMap.has(s.nip)) teacherSlotsMap.set(s.nip, []);
                  teacherSlotsMap.get(s.nip)!.push(s);
                });

                teacherSlotsMap.forEach((slots, nip) => {
                  const missedJams = new Set<number>();
                  const missedKelas = new Set<string>();

                  for (const s of slots) {
                    const checkKey = `${dateStr}|${(s.kelas || '').trim()}|${s.jam_ke}`;
                    if (!slotReportedTable.has(checkKey)) {
                      missedJams.add(s.jam_ke);
                      if (s.kelas) missedKelas.add(s.kelas);
                    }
                  }

                  if (missedJams.size > 0) {
                    const teacherKey = ensureKey(slots[0].nama_guru || nip, nip);
                    stats[teacherKey].piket += missedJams.size;
                    stats[teacherKey].details.push({
                      tanggal: dateStr,
                      type: 'Tidak Piket',
                      keterangan: 'Tidak Piket',
                      jam_ke: Array.from(missedJams).sort((a, b) => a - b).join(', '),
                      kelas: Array.from(missedKelas).join(', '),
                    });
                  }
                });
              }
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    } catch (piketErr) {
      console.error('Error in Piket Calculation:', piketErr);
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

      // Incident always belongs to the main scheduled teacher (j.nama_guru / j.nip)
      const targetNama = (j.nama_guru || '').trim() || (j.nip ? `Guru (${j.nip})` : '');
      const targetNip = j.nip || '';
      if (!targetNama && !targetNip) return;

      const targetKey = ensureKey(targetNama, targetNip);

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
        daring: [] as any[],
      },
    };
  }
}
