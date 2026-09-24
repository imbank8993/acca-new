import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary(user: any) {
    const roleStr = (user.role || '').toLowerCase();
    const isSiswa = roleStr.includes('siswa');
    const isGuru = roleStr.includes('guru');
    
    // Get newest active year
    const activePeriods = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true, semester: true }
    });
    
    const activeYears = [...new Set(activePeriods.map(p => p.tahun_ajaran))].sort((a, b) => b.localeCompare(a));
    const activeYear = activeYears[0] || null;

    let birthday = null;
    let age = null;
    let siswaData = null;
    let guruData = null;

    // Check Birthday
    if (isSiswa && user.username) { // Assuming nisn is mapped to username for siswa
      const bData = await this.prisma.master_siswa.findUnique({
        where: { nisn: user.username },
        select: { tanggal_lahir: true }
      });
      if (bData?.tanggal_lahir) birthday = bData.tanggal_lahir;
    } else if (isGuru && user.nip) {
      const bData = await this.prisma.master_guru.findUnique({
        where: { nip: user.nip },
        select: { tanggal_lahir: true }
      });
      if (bData?.tanggal_lahir) birthday = bData.tanggal_lahir;
    }

    if (birthday) {
      const dob = new Date(birthday);
      const today = new Date();
      const dobLocal = new Date(dob.getTime() + Math.abs(dob.getTimezoneOffset() * 60000));
      if (dobLocal.getDate() === today.getDate() && dobLocal.getMonth() === today.getMonth()) {
        age = today.getFullYear() - dobLocal.getFullYear();
      }
    }

    if (isSiswa && user.username) {
      const nisn = user.username;
      
      // 1. Siswa ID
      const sMaster = await this.prisma.master_siswa.findUnique({
        where: { nisn },
        select: { id: true }
      });
      
      // 2. All Classes (history)
      const allRows = await this.prisma.siswa_kelas.findMany({
        where: { nisn, aktif: true },
        select: { kelas: true, tahun_ajaran: true }
      });

      const uniqueClasses = allRows.reduce((acc: any[], curr) => {
        const exists = acc.find(c => c.kelas === curr.kelas && c.tahun_ajaran === curr.tahun_ajaran);
        if (!exists) acc.push(curr);
        return acc;
      }, []);

      // 3. Current Class
      let currentKelas = null;
      let dataKelas = allRows;
      if (allRows.length > 0 && activeYears.length > 0) {
        const activeRows = allRows.filter(r => activeYears.includes(r.tahun_ajaran));
        if (activeRows.length > 0) dataKelas = activeRows;
      }
      
      if (dataKelas.length > 0) {
        // Need to sort by reguler vs utbk etc.
        const masterKelasData = await this.prisma.master_kelas.findMany({ select: { nama: true, program: true } });
        const regulerSet = new Set(
            masterKelasData.filter((mk: any) => !mk.program || mk.program === 'Reguler' || mk.program === 'Unggulan' || mk.program === 'IBS')
            .map((mk: any) => mk.nama.toLowerCase().trim())
        );
        const nonRegulerSet = new Set(
            masterKelasData.filter((mk: any) => mk.program && mk.program !== 'Reguler' && mk.program !== 'Unggulan' && mk.program !== 'IBS')
            .map((mk: any) => mk.nama.toLowerCase().trim())
        );
        const peminatanKeywords = ['sosiologi', 'biologi', 'bahasa', 'ekonomi', 'fisika', 'kimia', 'geografi', 'informatika', 'matematika', 'sejarah', 'peminatan', 'program', 'lintas minat', 'lanjut', 'utbk', 'snbt', 'snbp', 'tps'];

        const isRegulerClass = (kelasName: string) => {
            const lower = (kelasName || '').toLowerCase().trim();
            if (regulerSet.has(lower)) return true;
            if (nonRegulerSet.has(lower)) return false;
            return !peminatanKeywords.some(k => lower.includes(k));
        };

        const sorted = [...dataKelas].sort((a, b) => {
            if (a.tahun_ajaran !== b.tahun_ajaran) return (b.tahun_ajaran || '').localeCompare(a.tahun_ajaran || '');
            const aIsReg = isRegulerClass(a.kelas);
            const bIsReg = isRegulerClass(b.kelas);
            if (aIsReg && !bIsReg) return -1;
            if (!aIsReg && bIsReg) return 1;
            return 0;
        });
        currentKelas = sorted[0].kelas;
      }

      // 4. Wali Kelas
      let waliKelasName = null;
      if (currentKelas && activeYear) {
        const wk = await this.prisma.wali_kelas.findFirst({
          where: { nama_kelas: currentKelas, aktif: true, tahun_ajaran: activeYear },
          orderBy: { created_at: 'desc' },
          select: { nama_guru: true }
        });
        if (wk) waliKelasName = wk.nama_guru;
      }

      // 5. Guru Asuh
      let guruAsuhName = null;
      let guruAsuhNip = null;
      if (activeYear) {
        const ga = await this.prisma.guru_asuh.findFirst({
          where: { nisn_siswa: nisn, aktif: true, tahun_ajaran: activeYear },
          orderBy: { created_at: 'desc' },
          select: { nama_guru: true, nip: true }
        });
        if (ga) {
          guruAsuhName = ga.nama_guru;
          guruAsuhNip = ga.nip;
        }
      }

      siswaData = {
        id: sMaster?.id || null,
        kelasSekarang: currentKelas,
        kelasHistory: uniqueClasses,
        waliKelas: waliKelasName,
        guruAsuh: guruAsuhName ? { nama: guruAsuhName, nip: guruAsuhNip } : null
      };
    }

    if (isGuru && user.nip) {
      // 1. Anak Asuh
      let anakAsuh: any[] = [];
      if (activeYear) {
        const gaData = await this.prisma.guru_asuh.findMany({
          where: { nip: user.nip, aktif: true, tahun_ajaran: activeYear },
          select: { nama_siswa: true, kelas: true, nisn_siswa: true }
        });

        if (gaData.length > 0) {
          const nisnList = [...new Set(gaData.map(d => d.nisn_siswa).filter(Boolean))];
          const photoMap: Record<string, string | null> = {};
          
          if (nisnList.length > 0) {
            const userProfiles = await this.prisma.public_users.findMany({
              where: { username: { in: nisnList } },
              select: { username: true, foto_profil: true }
            });
            userProfiles.forEach(up => { if (up.username && up.foto_profil) photoMap[up.username] = up.foto_profil; });
          }

          const classOrder: Record<string, number> = { 'X': 1, 'XI': 2, 'XII': 3 };
          const getClassWeight = (cls: string) => {
              if (!cls) return 99;
              const roman = cls.split(' ')[0];
              return classOrder[roman] || 99;
          };

          const enriched = gaData.map(item => ({
              ...item,
              foto_profil: photoMap[item.nisn_siswa] || null
          }));

          anakAsuh = enriched.sort((a, b) => {
              const weightA = getClassWeight(a.kelas || '');
              const weightB = getClassWeight(b.kelas || '');
              if (weightA !== weightB) return weightA - weightB;
              const classA = a.kelas || '';
              const classB = b.kelas || '';
              if (classA !== classB) return classA.localeCompare(classB);
              const nameA = a.nama_siswa || '';
              const nameB = b.nama_siswa || '';
              return nameA.localeCompare(nameB);
          });
        }
      }

      // 2. Tugas Tambahan
      let tugasTambahan: any[] = [];
      if (activeYears.length > 0) {
        const queryWhere: any = { tahun_ajaran: { in: activeYears } };
        if (user.nama && user.nip) {
           queryWhere.OR = [ { nip: user.nip }, { nama_guru: { contains: user.nama, mode: 'insensitive' } } ];
        } else if (user.nip) {
           queryWhere.nip = user.nip;
        } else if (user.nama) {
           queryWhere.nama_guru = { contains: user.nama, mode: 'insensitive' };
        }
        
        const tTambahan = await this.prisma.tugas_tambahan.findMany({
          where: queryWhere,
          select: { jabatan: true, keterangan: true, nip: true, nama_guru: true }
        });
        
        const seen = new Set<string>();
        tugasTambahan = tTambahan.filter(t => {
            const key = `${(t.jabatan || '').trim().toLowerCase()}|${(t.keterangan || '').trim().toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
      }

      // 3. Tugas dibuat (Guru Tugas)
      let tugasDibuat: any[] = [];
      const tOrQuery: any[] = [];
      if (user.nip) {
          tOrQuery.push({ created_by_nip: user.nip });
          tOrQuery.push({ guru_id: user.nip });
      }
      if (user.nama) {
          tOrQuery.push({ nama_guru: { contains: user.nama, mode: 'insensitive' } });
      }

      if (tOrQuery.length > 0) {
        let tQueryWhere: any = { OR: tOrQuery };
        if (activeYear) tQueryWhere.tahun_ajaran = activeYear;

        tugasDibuat = await this.prisma.tugas_siswa.findMany({
          where: tQueryWhere,
          select: { id: true, judul_tugas: true, nama_mapel: true, kelas: true, created_at: true, created_by: true, tanggal_selesai: true, nama_pembuat: true },
          orderBy: { created_at: 'desc' },
          take: 5
        });
      }

      guruData = {
        anakAsuh,
        tugasTambahan,
        tugasDibuat
      };
    }

    return serializeBigInt({
      birthday,
      age,
      siswaData,
      guruData,
      activeYear,
      activeYears
    });
  }

  async getDashboardStats() {
    const users = await this.prisma.public_users.findMany({
      where: { aktif: true },
      select: { role: true }
    });

    let guruCount = 0, siswaCount = 0, orangTuaCount = 0, lainnyaCount = 0;
    for (const u of users) {
      const roles = String(u.role || '').split(/[,|]/).map(r => r.trim().toUpperCase()).filter(Boolean);
      const isGuru = roles.includes('GURU');
      const isSiswa = roles.includes('SISWA');
      const isOrtu = roles.includes('ORANG_TUA');
      if (isGuru) guruCount++;
      if (isSiswa) siswaCount++;
      if (isOrtu) orangTuaCount++;
      if (!isGuru && !isSiswa && !isOrtu) lainnyaCount++;
    }

    const activePeriods = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      orderBy: { tahun_ajaran: 'desc' },
      take: 1,
      select: { tahun_ajaran: true }
    });
    const newestYear = activePeriods[0]?.tahun_ajaran || null;

    let activeClasses: string[] = [];
    if (newestYear) {
      const sk = await this.prisma.siswa_kelas.findMany({
        where: { tahun_ajaran: newestYear, aktif: true },
        select: { kelas: true }
      });
      activeClasses = Array.from(new Set(sk.map(k => k.kelas))).sort();
    }

    // `tgl_mulai`/`tgl_selesai` bertipe `DateTime @db.Date`, jadi filternya HARUS
    // objek Date. Sebelumnya di sini diberikan STRING hasil
    // `toISOString().slice(0, 10)`, dan Prisma menolaknya — membuat seluruh
    // endpoint ini melempar 500 setiap kali dashboard dibuka. Bentuknya tetap
    // "tanggal hari ini menurut UTC" seperti semula, hanya tipenya yang benar.
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const kh = await this.prisma.ketidakhadiran.findMany({
      where: {
        aktif: true,
        tgl_mulai: { lte: today },
        tgl_selesai: { gte: today }
      },
      select: { jenis: true }
    });

    const sakitToday = kh.filter(k => k.jenis === 'SAKIT').length;
    const izinToday = kh.filter(k => k.jenis === 'IZIN').length;

    return {
      guruCount,
      siswaCount,
      orangTuaCount,
      lainnyaCount,
      activeClasses,
      sakitToday,
      izinToday
    };
  }

  async getDashboardCharts() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);

    const activePeriods = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      orderBy: { tahun_ajaran: 'desc' },
      select: { tahun_ajaran: true }
    });
    const activeYears = [...new Set(activePeriods.map(p => p.tahun_ajaran))];
    const tahunAjaran = activeYears[0] || null;

    let siswaAktif = 0;
    if (activeYears.length > 0) {
      const sk = await this.prisma.siswa_kelas.findMany({
        where: { tahun_ajaran: { in: activeYears }, aktif: true },
        select: { nisn: true }
      });
      siswaAktif = new Set(sk.map(r => r.nisn).filter(Boolean)).size;
    }
    if (siswaAktif === 0) {
      siswaAktif = await this.prisma.master_siswa.count();
    }

    // 1. Attendance Realtime Hari Ini
    const khToday = await this.prisma.ketidakhadiran.findMany({
      where: {
        aktif: true,
        tgl_mulai: { lte: endOfToday },
        tgl_selesai: { gte: startOfToday }
      },
      select: { nisn: true, jenis: true }
    });

    const detailToday = await this.prisma.absensi_detail.findMany({
      where: {
        created_at: { gte: startOfToday, lte: endOfToday }
      },
      select: { nisn: true, status: true }
    });

    const sakitSet = new Set<string>();
    const izinSet = new Set<string>();
    const alpaSet = new Set<string>();

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
    const weeklyTrends: { day: string; tanggal: string; hadir: number; sakitIzin: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);

      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const dateIso = `${yr}-${mo}-${dy}`;

      const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateIso}T23:59:59.999Z`);

      const khDay = await this.prisma.ketidakhadiran.findMany({
        where: {
          aktif: true,
          tgl_mulai: { lte: dayEnd },
          tgl_selesai: { gte: dayStart }
        },
        select: { nisn: true }
      });

      const detailDay = await this.prisma.absensi_detail.findMany({
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

    const jurnal = await this.prisma.jurnal_guru.findMany({
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
}
