import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const json = (v: any): any => JSON.parse(JSON.stringify(v, (_, x) => typeof x === 'bigint' ? String(x) : x));
/** PostgreSQL summary with the same detail/matrix contract consumed by LCKH. */
export async function buildLckhSummary(db: PrismaService, targetNip: string, startDate: string, endDate: string) {
    const start = new Date(String(startDate).slice(0, 10) + 'T00:00:00Z');
    const end = new Date(String(endDate).slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end < start || +end - +start > 366 * 86400000)
        throw new BadRequestException('Rentang tanggal wajib valid dan maksimal satu tahun');
    end.setUTCDate(end.getUTCDate() + 1);
    const tanggal = { gte: start, lt: end };
    const semInt = start.getUTCMonth() >= 6 ? 1 : 2;
    const year = start.getUTCFullYear(), taStartYear = semInt === 1 ? year : year - 1;
    const tahunAjaran = taStartYear + '/' + (taStartYear + 1);
    const semesterStart = semInt === 1 ? taStartYear + '-07-01' : (taStartYear + 1) + '-01-01';
    const semesterEnd = semInt === 1 ? taStartYear + '-12-31' : (taStartYear + 1) + '-06-30';
    const [j, s, n, t, tagihan] = await Promise.all([
        db.jurnal_guru.findMany({ where: { nip: targetNip, tanggal }, orderBy: { tanggal: 'asc' } }),
        db.absensi_sesi.findMany({ where: { nip: targetNip, tanggal }, orderBy: { tanggal: 'asc' } }),
        db.nilai_data.findMany({ where: { nip: targetNip, semester: semInt, tahun_ajaran: tahunAjaran } }),
        db.jurnal_tugas_tambahan.findMany({ where: { nip: targetNip, tanggal }, include: { tugas_tambahan: { select: { jabatan: true } } }, orderBy: { tanggal: 'asc' } }),
        db.nilai_tagihan.findMany({ where: { nip: targetNip, semester: semInt, tahun_ajaran: tahunAjaran } }),
    ]);
    const journals: any[] = json(j), sessions: any[] = json(s);
    const detailTugas: any[] = json(t.map(row => ({ ...row, tugas: row.tugas_tambahan })));
    const detailAbsensi: any[] = sessions.length ? json(await db.absensi_detail.findMany({ where: { sesi_id: { in: sessions.map(s => s.sesi_id) } } })) : [];
    let totalHoursFromJurnal = 0;
    journals.forEach(j => { const parts = String(j.jam_ke || '').split('-').map(Number); if (parts.every(Number.isFinite) && parts[0] > 0)
        totalHoursFromJurnal += parts.length === 2 ? Math.max(0, parts[1] - parts[0] + 1) : 1; });
    const unique = new Map<string, any>();
    for (const row of json(n))
        unique.set([row.kelas, row.mapel, row.jenis, row.materi_tp, row.tagihan].join('|'), { kelas: row.kelas, mapel: row.mapel, jenis: row.jenis, materi: row.materi_tp, tagihan: row.tagihan, kolom_id: row.id, last_update: row.updated_at });
    for (const row of json(tagihan)) {
        const key = [row.kelas, row.mapel, row.jenis, row.materi_tp, row.nama_tagihan].join('|');
        if (!unique.has(key))
            unique.set(key, { kelas: row.kelas, mapel: row.mapel, jenis: row.jenis, materi: row.materi_tp, tagihan: row.nama_tagihan, kolom_id: row.id, last_update: row.updated_at });
    }
    const detailNilai = Array.from(unique.values());
    let rekapAbsensi: any[] = [];
    let detailAbsensiPerClass: any[] = [];
    if (sessions.length) {
        // Grouping for Rekap (simple summary)
        const rekapMap = new Map();
        sessions?.forEach(s => {
            const key = `${s.kelas}|${s.mapel}`;
            if (!rekapMap.has(key)) {
                rekapMap.set(key, { kelas: s.kelas, mapel: s.mapel, meetings: 0, H: 0, S: 0, I: 0, A: 0 });
            }
            const r = rekapMap.get(key);
            r.meetings += 1;
            const sessionDetails = detailAbsensi.filter((d: any) => d.sesi_id === s.sesi_id);
            sessionDetails.forEach((d: any) => {
                const status = (d.status || '').toUpperCase();
                if (status.startsWith('H'))
                    r.H++;
                else if (status.startsWith('S'))
                    r.S++;
                else if (status.startsWith('I'))
                    r.I++;
                else if (status.startsWith('A'))
                    r.A++;
            });
        });
        rekapAbsensi = Array.from(rekapMap.values());
        // NEW: Build detailed per-class attendance matrix GROUPED BY MONTH
        // Group sessions by class
        const classMap = new Map();
        sessions?.forEach(s => {
            const key = s.kelas;
            if (!classMap.has(key)) {
                classMap.set(key, []);
            }
            classMap.get(key).push(s);
        });
        // Helper: get day name
        const getDayName = (dateStr: string) => {
            const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
            return days[new Date(dateStr).getDay()];
        };
        // Helper: build month group from session data
        const buildMonthGroup = (classSessions: any[], year: number, month: number) => {
            const daysInMonth = new Date(year, month, 0).getDate();
            const monthName = new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
            // Collect all unique students
            const studentMap = new Map();
            classSessions.forEach(sess => {
                const sessDate = new Date(sess.tanggal);
                if (sessDate.getFullYear() === year && sessDate.getMonth() + 1 === month) {
                    const sessDetails = detailAbsensi.filter((d: any) => d.sesi_id === sess.sesi_id);
                    sessDetails.forEach((d: any) => {
                        const sid = d.nisn || d.siswa_id;
                        if (!studentMap.has(sid)) {
                            studentMap.set(sid, {
                                nisn: d.nisn,
                                nama: d.nama_snapshot || d.nama || '-',
                                days: {},
                                totalH: 0, totalS: 0, totalI: 0, totalA: 0
                            });
                        }
                        const st = studentMap.get(sid);
                        const dayNum = sessDate.getDate();
                        // If multiple sessions per day, prefer worse status
                        const existing = st.days[dayNum];
                        const newStatus = (d.status || '').toUpperCase();
                        if (!existing) {
                            st.days[dayNum] = newStatus;
                        }
                        else {
                            if (existing !== 'HADIR' && newStatus === 'HADIR') {
                                // keep worse
                            }
                            else if (newStatus !== 'HADIR') {
                                st.days[dayNum] = newStatus;
                            }
                        }
                        // Totals
                        if (newStatus.startsWith('H'))
                            st.totalH++;
                        else if (newStatus.startsWith('S'))
                            st.totalS++;
                        else if (newStatus.startsWith('I'))
                            st.totalI++;
                        else if (newStatus.startsWith('A'))
                            st.totalA++;
                    });
                }
            });
            // Build date columns (all days in month)
            const dateCols = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month - 1, d);
                const dayOfWeek = dateObj.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dayNum = d;
                dateCols.push({
                    day: dayNum,
                    dayName: getDayName(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
                    isWeekend
                });
            }
            return {
                monthName,
                month,
                year,
                dateCols,
                students: Array.from(studentMap.values())
            };
        };
        // For each class, build monthly grouped data
        classMap.forEach((classSessions: any[], kelas: any) => {
            // Determine all months that have sessions
            const monthSet = new Map(); // key = "year-month"
            classSessions.forEach(sess => {
                const d = new Date(sess.tanggal);
                const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                monthSet.set(key, { year: d.getFullYear(), month: d.getMonth() + 1 });
            });
            const monthGroups: any[] = [];
            monthSet.forEach(({ year, month }: {
                year: number;
                month: number;
            }) => {
                monthGroups.push(buildMonthGroup(classSessions, year, month));
            });
            // Sort by year, month
            monthGroups.sort((a: any, b: any) => (a.year - b.year) || (a.month - b.month));
            detailAbsensiPerClass.push({
                kelas,
                monthGroups
            });
        });
    }
    // Merge session data into detail_jurnal if needed for matrix
    const fullDetailJurnal = journals?.map(j => {
        const matchingSession = sessions?.find(s => s.tanggal === j.tanggal && s.kelas === j.kelas && (s.mapel === j.mata_pelajaran || s.mapel === j.mapel));
        return {
            ...j,
            sesi_id: matchingSession?.sesi_id,
            student_details: matchingSession ? (detailAbsensi.filter(d => d.sesi_id === matchingSession.sesi_id).map(d => ({
                nisn: d.nisn,
                nama: d.nama_snapshot,
                status: d.status,
                catatan: d.catatan
            }))) : []
        };
    }) || [];
    return {
        total_jurnal_isi: journals?.length || 0,
        total_jam_mengajar: totalHoursFromJurnal || 0,
        total_nilai_input: detailNilai.length,
        total_tugas: detailTugas?.length || 0,
        detail_jurnal: fullDetailJurnal,
        detail_nilai: detailNilai,
        detail_tugas: detailTugas || [],
        rekap_absensi_siswa: rekapAbsensi,
        detail_absensi_per_class: detailAbsensiPerClass,
        semester_info: {
            semester_start: semesterStart,
            semester_end: semesterEnd,
            semester_label: semInt === 1 ? 'Ganjil' : 'Genap',
            tahun_ajaran: tahunAjaran
        }
    };
}
