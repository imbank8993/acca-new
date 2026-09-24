import { prisma } from './prisma';
import { calcDailyAttendanceMinutes, dominantStatus } from './ketidakhadiran-jp';
import { JAM_SEMUA, buildLiburIndex, liburBerlakuUntukKelas, normalizeJamKe, type LiburRow } from './libur';

export function resolveTahunAjaranSemester(bulanYYYYMM: string): { tahunAjaran: string; semester: number; semesterStr: string } {
    const [y, m] = bulanYYYYMM.split('-').map(Number);
    const refDate = new Date(y, m - 1, 15);
    const refMonth = refDate.getMonth() + 1;
    const refYear = refDate.getFullYear();
    const tahunAjaran = refMonth >= 7 ? `${refYear}/${refYear + 1}` : `${refYear - 1}/${refYear}`;
    const semester = refMonth >= 7 ? 1 : 2;
    return { tahunAjaran, semester, semesterStr: semester === 1 ? 'Ganjil' : 'Genap' };
}

export interface RekapAbsensiResult {
    kelas: string;
    tahun_ajaran: string;
    semester: number;
    periode: { start: string; end: string; type: 'harian' | 'bulanan' };
    siswa: any[];
    holidays: any[];
    summary: any;
}

export async function computeRekapAbsensiKelas(params: {
    kelas: string;
    tahunAjaran: string;
    semesterStr: string;
    semester: number;
    startDate: string;
    endDate: string;
    isDaily: boolean;
}): Promise<RekapAbsensiResult> {
    const { kelas, tahunAjaran, semesterStr, semester, startDate, endDate, isDaily } = params;

    const liburRows = await prisma.libur.findMany({
        where: {
            tanggal: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        }
    });

    const kelasInfo = await prisma.master_kelas.findFirst({
        where: { nama: kelas },
        select: { tingkat: true }
    });

    const kelasCtx = { kelas, tingkat: kelasInfo?.tingkat || undefined };
    const liburIndex = buildLiburIndex(liburRows as unknown as LiburRow[]);
    const holidays = (liburRows || []).filter(
        h => normalizeJamKe(h.jam_ke) === JAM_SEMUA && liburBerlakuUntukKelas(h as unknown as LiburRow, kelasCtx)
    );

    const siswaList = await prisma.siswa_kelas.findMany({
        where: {
            kelas,
            tahun_ajaran: tahunAjaran,
            semester: semesterStr,
            aktif: true
        },
        select: { nisn: true, nama_siswa: true }
    });

    const finalSiswaList = (siswaList || []).filter((v, i, a) => a.findIndex(t => t.nisn === v.nisn) === i);

    if (finalSiswaList.length === 0) {
        return {
            kelas,
            tahun_ajaran: tahunAjaran,
            semester,
            periode: { start: startDate, end: endDate, type: isDaily ? 'harian' : 'bulanan' },
            siswa: [],
            holidays: holidays || [],
            summary: { total: 0, hadir_count: 0, izin_count: 0, sakit_count: 0, alpha_count: 0, total_hari_hadir: 0, total_hari_izin: 0, total_hari_sakit: 0, total_hari_alpha: 0 },
        };
    }

    const nisnList = finalSiswaList.map((s: any) => s.nisn);

    const ketidakhadiranList = await prisma.ketidakhadiran.findMany({
        where: {
            kelas,
            aktif: true,
            tgl_mulai: { lte: new Date(endDate) },
            tgl_selesai: { gte: new Date(startDate) }
        }
    });

    const sesiList = await prisma.absensi_sesi.findMany({
        where: {
            kelas,
            status_sesi: 'FINAL',
            tanggal: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        }
    });

    const sesiIds = (sesiList || []).map(s => s.sesi_id);
    let detailList: any[] = [];
    if (sesiIds.length > 0) {
        detailList = await prisma.absensi_detail.findMany({
            where: {
                sesi_id: { in: sesiIds },
                nisn: { in: nisnList }
            }
        });
    }

    const dateStart = new Date(startDate);
    const dateEnd = new Date(endDate);
    const daysInRange: string[] = [];
    let curr = new Date(dateStart);
    while (curr <= dateEnd) {
        daysInRange.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const studentData = finalSiswaList.map((siswa: any) => {
        const nisn = siswa.nisn;
        let countHadir = 0, countIzin = 0, countSakit = 0, countAlpha = 0;
        const dailyStatus: Record<string, string> = {};
        const ketidakhadiranDetail: Record<string, { jenis: string; keterangan: string; tgl_mulai: string; tgl_selesai: string }> = {};

        daysInRange.forEach(dateStr => {
            let status = '';

            if (dateStr > todayStr) {
                status = '';
            } else {
                const isHoliday = liburIndex.isLiburSehari(dateStr, kelasCtx);
                const isWeekend = [0, 6].includes(new Date(dateStr).getDay());

                if (isHoliday || isWeekend) {
                    status = isHoliday ? 'L' : 'W';
                } else {
                    const khHariIni = (ketidakhadiranList || []).filter(k => k.nisn === nisn && k.tgl_mulai.toISOString().split('T')[0] <= dateStr && k.tgl_selesai.toISOString().split('T')[0] >= dateStr);
                    const daySessions = (sesiList || []).filter(s => s.tanggal.toISOString().split('T')[0] === dateStr);
                    const dayDetails = detailList.filter(d => d.nisn === nisn && daySessions.some(s => s.sesi_id === d.sesi_id));
                    const absensiDetailHariIni = dayDetails.map(d => ({
                        jamKe: daySessions.find(s => s.sesi_id === d.sesi_id)?.jam_ke,
                        status: d.status || 'HADIR',
                    }));

                    const minutes = calcDailyAttendanceMinutes(khHariIni as any, absensiDetailHariIni as any, dateStr);
                    const winner = dominantStatus(minutes);
                    status = winner.charAt(0);

                    if (status === 'I' || status === 'S' || status === 'A') {
                        const kt = khHariIni[0];
                        ketidakhadiranDetail[dateStr] = kt ? {
                            jenis: kt.jenis || status,
                            keterangan: kt.keterangan || '',
                            tgl_mulai: kt.tgl_mulai.toISOString().split('T')[0],
                            tgl_selesai: kt.tgl_selesai.toISOString().split('T')[0]
                        } : {
                            jenis: status === 'I' ? 'Izin' : status === 'S' ? 'Sakit' : 'Alpha',
                            keterangan: 'Dicatat oleh guru di jurnal kelas',
                            tgl_mulai: dateStr,
                            tgl_selesai: dateStr
                        };
                    }

                    switch (status) {
                        case 'H': countHadir++; break;
                        case 'I': countIzin++; break;
                        case 'S': countSakit++; break;
                        case 'A': countAlpha++; break;
                    }
                }
            }
            dailyStatus[dateStr] = status;
        });

        return {
            nisn,
            nama: siswa.nama_siswa,
            kelas,
            hadir: countHadir,
            izin: countIzin,
            sakit: countSakit,
            alpha: countAlpha,
            total: countHadir + countIzin + countSakit + countAlpha,
            daily: dailyStatus,
            ktDetail: Object.keys(ketidakhadiranDetail).length > 0 ? ketidakhadiranDetail : null
        };
    });

    studentData.sort((a, b) => a.nama.localeCompare(b.nama));

    const summary = {
        total: studentData.length,
        hadir_count: studentData.filter(s => s.hadir > 0 && s.alpha === 0 && s.sakit === 0 && s.izin === 0).length,
        izin_count: studentData.filter(s => s.izin > 0).length,
        sakit_count: studentData.filter(s => s.sakit > 0).length,
        alpha_count: studentData.filter(s => s.alpha > 0).length,
        total_hari_hadir: studentData.reduce((sum, s) => sum + s.hadir, 0),
        total_hari_izin: studentData.reduce((sum, s) => sum + s.izin, 0),
        total_hari_sakit: studentData.reduce((sum, s) => sum + s.sakit, 0),
        total_hari_alpha: studentData.reduce((sum, s) => sum + s.alpha, 0),
    };

    return {
        kelas,
        tahun_ajaran: tahunAjaran,
        semester,
        periode: { start: startDate, end: endDate, type: isDaily ? 'harian' : 'bulanan' },
        siswa: studentData,
        holidays: holidays || [],
        summary,
    };
}
