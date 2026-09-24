require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function serializeBigInt(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}

async function getDashboardChartsTest() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);

    const activePeriods = await prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      orderBy: { tahun_ajaran: 'desc' },
      select: { tahun_ajaran: true }
    });
    const activeYears = [...new Set(activePeriods.map(p => p.tahun_ajaran))];
    const tahunAjaran = activeYears[0] || null;

    let siswaAktif = 0;
    if (activeYears.length > 0) {
      const sk = await prisma.siswa_kelas.findMany({
        where: { tahun_ajaran: { in: activeYears }, aktif: true },
        select: { nisn: true }
      });
      siswaAktif = new Set(sk.map(r => r.nisn).filter(Boolean)).size;
    }
    if (siswaAktif === 0) {
      siswaAktif = await prisma.master_siswa.count();
    }

    // 1. Attendance Realtime Hari Ini
    const khToday = await prisma.ketidakhadiran.findMany({
      where: {
        aktif: true,
        tgl_mulai: { lte: endOfToday },
        tgl_selesai: { gte: startOfToday }
      },
      select: { nisn: true, jenis: true }
    });

    const detailToday = await prisma.absensi_detail.findMany({
      where: {
        created_at: { gte: startOfToday, lte: endOfToday }
      },
      select: { nisn: true, status: true }
    });

    const sakitSet = new Set();
    const izinSet = new Set();
    const alpaSet = new Set();

    for (const item of khToday) {
      if (!item.nisn) continue;
      const j = (item.jenis || '').toUpperCase();
      if (j === 'SAKIT') sakitSet.add(item.nisn);
      else if (j === 'IZIN') izinSet.add(item.nisn);
    }

    for (const d of detailToday) {
      if (!d.nisn) continue;
      const st = (d.status || '').toUpperCase();
      if (st === 'SAKIT') sakitSet.add(d.nisn);
      else if (st === 'IZIN') izinSet.add(d.nisn);
      else if (st === 'ALPA' || st === 'ALPHA' || st === 'A') alpaSet.add(d.nisn);
    }

    const sakitCount = sakitSet.size;
    const izinCount = izinSet.size;
    const alpaCount = alpaSet.size;
    const hadirCount = Math.max(0, siswaAktif - sakitCount - izinCount - alpaCount);

    const attendance = {
      hadir: hadirCount,
      sakit: sakitCount,
      izin: izinCount,
      alpa: alpaCount,
      total: siswaAktif
    };

    // 2. Tren Kehadiran Mingguan (7 Hari Terakhir)
    const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const weeklyTrends = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);

      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const dateIso = `${yr}-${mo}-${dy}`;

      const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateIso}T23:59:59.999Z`);

      const khDay = await prisma.ketidakhadiran.findMany({
        where: {
          aktif: true,
          tgl_mulai: { lte: dayEnd },
          tgl_selesai: { gte: dayStart }
        },
        select: { nisn: true }
      });

      const detailDay = await prisma.absensi_detail.findMany({
        where: {
          created_at: { gte: dayStart, lte: dayEnd },
          status: { in: ['SAKIT', 'IZIN', 'ALPA', 'ALPHA', 'A'] }
        },
        select: { nisn: true }
      });

      const absentNisns = new Set([
        ...khDay.map(k => k.nisn).filter(Boolean),
        ...detailDay.map(a => a.nisn).filter(Boolean)
      ]);

      const tidakHadir = Math.min(absentNisns.size, siswaAktif);
      const persenTidakHadir = siswaAktif > 0 ? parseFloat(((tidakHadir / siswaAktif) * 100).toFixed(2)) : 0;
      const persenHadir = Math.max(0, parseFloat((100 - persenTidakHadir).toFixed(2)));

      weeklyTrends.push({
        day: NAMA_HARI[d.getDay()],
        tanggal: dateIso,
        hadir: persenHadir,
        sakitIzin: persenTidakHadir
      });
    }

    // 3. Keterisian Jurnal KBM Bulan Ini
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

    const awalBulanStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const akhirBulanStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;

    const jurnal = await prisma.jurnal_guru.findMany({
      where: {
        tanggal: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: { kategori_kehadiran: true, materi: true }
    });

    const jurnalStats = { total: jurnal.length, sesuai: 0, terlambat: 0, kosong: 0, tanpaPendampingan: 0 };
    for (const j of jurnal) {
      const kat = String(j.kategori_kehadiran || '').trim().toLowerCase();
      if (kat === 'sesuai' || kat === 'normal' || kat === 'hadir') {
        jurnalStats.sesuai++;
      } else if (kat === 'terlambat') {
        jurnalStats.terlambat++;
      } else if (kat === 'kosong' || kat === 'tidak_hadir' || kat === 'tidak hadir') {
        jurnalStats.kosong++;
      } else if (kat.includes('tanpa pendampingan') || kat.includes('tanpa_pendampingan')) {
        jurnalStats.tanpaPendampingan++;
      } else {
        if (j.materi && j.materi.trim() !== '' && j.materi !== '-') {
          jurnalStats.sesuai++;
        } else {
          jurnalStats.kosong++;
        }
      }
    }

    return serializeBigInt({
      siswaAktif,
      tahunAjaran,
      attendance,
      weeklyTrends,
      jurnalStats,
      jurnalPeriode: { dari: awalBulanStr, sampai: akhirBulanStr }
    });
}

getDashboardChartsTest()
    .then(res => console.log('RESULT:', JSON.stringify(res, null, 2)))
    .catch(console.error)
    .finally(() => prisma.$disconnect());
