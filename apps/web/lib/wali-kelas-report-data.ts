import type { ReportSection, WaliPdfReport } from './wali-kelas-pdf';

type Row = Record<string, any>;
interface Context { kelas: string; tahun: string; query?: string; wali?: string }
const hasQuery = (s: Row, q = '') => !q.trim() || `${s.nama || s.nama_siswa || s.nama_snapshot || ''} ${s.nisn || ''}`.toLocaleLowerCase('id').includes(q.trim().toLocaleLowerCase('id'));
const semNumber = (value: unknown) => ({ ganjil: '1', genap: '2' }[String(value || '').toLowerCase() as 'ganjil' | 'genap'] || String(value ?? ''));
const semLabel = (value: string) => value === '1' ? 'Ganjil' : value === '2' ? 'Genap' : value;
const noteStatus = (value: unknown) => ({ BARU: 'Baru', DITINDAKLANJUTI: 'Ditindaklanjuti', SELESAI: 'Selesai' }[String(value) as 'BARU' | 'DITINDAKLANJUTI' | 'SELESAI'] || String(value || '').replace(/_/g, ' '));
const fmt = (value: unknown) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '-' : Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const dateLabel = (value: unknown) => value ? new Date(String(value).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const identity = (s: Row) => `${s.nama || s.nama_siswa || s.nama_snapshot || '-'}\n${s.nisn || '-'}`;
const reportIdentity = (c: Context, period: { label: string; value: string }, semester?: string) => ({
    left: [
        { label: semester ? 'Kelas / Semester' : 'Kelas', value: semester ? `${c.kelas} | ${semester}` : c.kelas },
        { label: 'Tahun ajaran', value: c.tahun },
        ...(c.query?.trim() ? [{ label: 'Pencarian', value: c.query.trim().slice(0, 100) }] : []),
    ],
    right: [{ label: 'Wali kelas', value: c.wali || '-' }, period],
});

export async function reportJson(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal, cache: 'no-store' });
    const json = await response.json().catch(() => null);
    if (!response.ok || !(json?.ok || json?.success)) throw new Error(String(json?.error || json?.message || 'Data laporan gagal dimuat. PDF belum dibuat.'));
    return json;
}

export function reportMonthRange(tahun: string, bulan: string) {
    const [first, last] = tahun.split('/').map(Number);
    if (!/^20\d{2}\/20\d{2}$/.test(tahun) || last !== first + 1 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(bulan) || bulan < `${first}-07` || bulan > `${last}-06`) throw new Error('Pilih bulan dalam tahun ajaran yang dipilih.');
    const [y, m] = bulan.split('-').map(Number);
    return { start: `${bulan}-01`, end: `${bulan}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}` };
}

async function mapStudents<T>(students: Row[], signal: AbortSignal, fn: (s: Row) => Promise<T>) {
    const results: T[] = new Array(students.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, students.length) }, async () => {
        while (next < students.length) {
            signal.throwIfAborted();
            const index = next++;
            results[index] = await fn(students[index]);
        }
    }));
    return results;
}

export function buildNilaiReport(c: Context & { semester: string; mapel?: string; sumber?: string }, students: { siswa: Row; nilai: Row; apresiasi: Row[] }[]): WaliPdfReport {
    const sections: ReportSection[] = [];
    const ordered = [...students].sort((a, b) => identity(a.siswa).localeCompare(identity(b.siswa), 'id'));
    for (const [index, { siswa, nilai, apresiasi }] of ordered.entries()) {
        const studentTitle = `${index + 1}. ${siswa.nama || siswa.nama_siswa || '-'} | NISN ${siswa.nisn || '-'}`;
        const grades: (string | number)[][] = [], points: (string | number)[][] = [];
        const items: Row[] = (nilai.all || []).filter((item: Row) => item.tahun_ajaran === c.tahun && semNumber(item.semester) === c.semester
            && (!c.mapel || (item.mapel || 'Lainnya') === c.mapel) && (!c.sumber || c.sumber === 'all' || (item.sumber || 'guru') === c.sumber)
            && !(item.jenis === 'PAS' && (item.nilai === null || item.nilai === undefined)));
        for (const item of items) {
            const status = item.grading_status && item.grading_status !== 'graded' ? `Status penilaian: ${item.grading_status}` : '';
            grades.push([grades.length + 1, item.mapel || '-', [item.jenis, item.materi_tp, item.topik, item.score_type === 'classical' ? 'Klasikal' : item.score_type].filter(Boolean).join('\n'), item.sumber === 'cbt' ? 'ACCA-CBT' : 'Guru', fmt(item.nilai), item.nama_guru || '-', [item.catatan, status].filter(Boolean).join('\n') || '-']);
        }
        if (!items.length) {
            const linkage = nilai.cbt_linkage === 'ambiguous' ? 'Identitas akun CBT belum dapat dipastikan.' : nilai.cbt_linkage === 'unlinked' ? 'Akun CBT belum terhubung.' : '';
            grades.push([1, c.mapel || '-', 'Belum ada nilai pada filter ini', '-', '-', '-', linkage || '-']);
        }
        sections.push({ title: studentTitle + ' - Nilai', groupKey: String(siswa.nisn), head: ['No', 'Mapel', 'Penilaian / Materi', 'Sumber', 'Nilai', 'Guru', 'Keterangan'], body: grades, widths: [8, 35, 75, 22, 18, 42, 77] });
        if (c.sumber !== 'cbt') for (const a of apresiasi.filter(a => (!a.tahun_ajaran || a.tahun_ajaran === c.tahun) && (a.semester === null || a.semester === undefined || semNumber(a.semester) === c.semester) && (!c.mapel || a.mapel === c.mapel))) {
            points.push([points.length + 1, a.mapel || '-', [a.judul, a.topik].filter(Boolean).join('\n'), dateLabel(a.tanggal), fmt(a.jumlah_menang), fmt(a.total_poin), a.catatan || '-']);
        }
        if (points.length) sections.push({ title: studentTitle + ' - Apresiasi pembelajaran', groupKey: String(siswa.nisn), head: ['No', 'Mapel', 'Apresiasi / Topik', 'Tanggal', 'Menang', 'Poin', 'Catatan'], body: points, widths: [8, 35, 80, 25, 17, 17, 95] });
    }
    return { title: 'Laporan Nilai Siswa', identity: reportIdentity(c,
        { label: 'Mapel / Sumber', value: `${c.mapel || 'Semua mapel'} | ${c.sumber && c.sumber !== 'all' ? c.sumber === 'cbt' ? 'ACCA-CBT' : 'Guru' : 'Semua sumber nilai'}` }, semLabel(c.semester)), sections };
}

export async function loadNilaiReport(c: Context & { semester: string; mapel?: string; sumber?: string; student?: { nisn: string; nama: string } }, signal: AbortSignal) {
    let roster: Row[];
    if (c.student) roster = [c.student];
    else {
        const params = new URLSearchParams({ kelas: c.kelas, tahun_ajaran: c.tahun });
        const json = await reportJson(`/api/settings/siswa-kelas?${params}`, signal);
        if (!Array.isArray(json.data)) throw new Error('Daftar siswa tidak lengkap.');
        roster = [...new Map<string, Row>((json.data as Row[]).filter(s => (!s.semester || semNumber(s.semester) === c.semester) && hasQuery(s, c.query)).map(s => [s.nisn, s])).values()];
    }
    roster.sort((a, b) => String(a.nama || a.nama_siswa).localeCompare(String(b.nama || b.nama_siswa), 'id'));
    const rows = await mapStudents(roster, signal, async siswa => {
        const id = encodeURIComponent(siswa.nisn);
        const [nilai, apr] = await Promise.all([reportJson(`/api/nilai/siswa?nisn=${id}`, signal), reportJson(`/api/nilai/siswa/apresiasi?nisn=${id}&tahun_ajaran=${encodeURIComponent(c.tahun)}`, signal)]);
        if (!Array.isArray(nilai.data?.all) || !Array.isArray(apr.data)) throw new Error(`Data nilai siswa ${siswa.nama || siswa.nama_siswa} tidak lengkap.`);
        return { siswa, nilai: nilai.data, apresiasi: apr.data };
    });
    return buildNilaiReport(c, rows);
}

export function buildEkskulReport(c: Context & { semester: string }, data: Row[]): WaliPdfReport {
    const rows = data.filter(s => hasQuery(s, c.query)).sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'));
    return { title: 'Laporan Ekstrakurikuler', identity: reportIdentity(c, { label: 'Semester', value: semLabel(semNumber(c.semester)) }), sections: [{ title: 'Keikutsertaan ekstrakurikuler siswa', head: ['No', 'Siswa / NISN', 'Nama ekstrakurikuler'], widths: [10, 65, 202], body: rows.map((s, i) => {
        const names = [...new Set<string>((s.ekskul || []).map((e: Row) => e.nama_ekskul).filter(Boolean))].sort();
        return [i + 1, identity(s), names.length ? names.join('\n') : '-'];
    }) }] };
}
export async function loadEkskulReport(c: Context & { semester: string }, signal: AbortSignal) {
    const json = await reportJson('/api/wali-kelas/ekskul?' + new URLSearchParams({ kelas: c.kelas, tahun_ajaran: c.tahun, semester: c.semester }), signal);
    if (!Array.isArray(json.data)) throw new Error('Data ekstrakurikuler tidak lengkap.');
    return buildEkskulReport(c, json.data);
}

export function buildKokurikulerReport(c: Context & { bulan: string }, data: Row[]): WaliPdfReport {
    const range = reportMonthRange(c.tahun, c.bulan);
    const sections: ReportSection[] = data.filter(s => hasQuery(s, c.query)).sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id')).map((s, index) => {
        const logs: Row[] = (s.kegiatan || []).filter((l: Row) => l.tanggal >= range.start && l.tanggal <= range.end)
            .sort((a: Row, b: Row) => a.tanggal.localeCompare(b.tanggal) || String(a.nama_kegiatan).localeCompare(String(b.nama_kegiatan), 'id'));
        const body: (string | number)[][] = logs.map((l, i) => [i + 1, dateLabel(l.tanggal), l.nama_kegiatan + (l.is_custom ? '\nKegiatan mandiri' : ''), l.status || 'Pending', l.catatan || '-']);
        if (!body.length) body.push([1, '-', 'Belum ada kegiatan tercatat pada bulan ini', '-', '-']);
        return { title: `${index + 1}. ${s.nama || '-'} | NISN ${s.nisn || '-'}`, groupKey: String(s.nisn), head: ['No', 'Tanggal', 'Kegiatan', 'Status', 'Catatan'], widths: [8, 28, 112, 30, 99], body };
    });
    return { title: 'Laporan Kokurikuler', identity: reportIdentity(c, { label: 'Periode', value: `${dateLabel(range.start)} - ${dateLabel(range.end)}` }), sections };

}
export async function loadKokurikulerReport(c: Context & { bulan: string }, signal: AbortSignal) {
    reportMonthRange(c.tahun, c.bulan);
    const json = await reportJson('/api/wali-kelas/kokurikuler?' + new URLSearchParams({ kelas: c.kelas, tahun_ajaran: c.tahun, bulan: c.bulan }), signal);
    if (!Array.isArray(json.data)) throw new Error('Data kokurikuler tidak lengkap.');
    return buildKokurikulerReport(c, json.data);
}

export function buildCatatanReport(c: Context & { bulan: string; jenis: string }, data: Row[]): WaliPdfReport {
    const range = reportMonthRange(c.tahun, c.bulan);
    const q = c.query?.trim().toLocaleLowerCase('id') || '';
    const items = data.filter(it => it.kelas === c.kelas && String(it.tanggal).slice(0, 10) >= range.start && String(it.tanggal).slice(0, 10) <= range.end
        && (!it.tahun_ajaran || it.tahun_ajaran === c.tahun) && (c.jenis === 'ALL' || it.jenis === c.jenis)
        && (!q || [it.nama_snapshot, it.mapel, it.nama_guru, it.catatan].filter(Boolean).join(' ').toLocaleLowerCase('id').includes(q)))
        .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.nama_snapshot).localeCompare(String(b.nama_snapshot), 'id'));
    return { title: 'Laporan Catatan Pembelajaran', identity: reportIdentity(c, {
        label: 'Bulan / Jenis', value: `${new Date(range.start + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })} | ${c.jenis === 'ALL' ? 'Semua' : c.jenis}`,
    }), sections: [{ title: 'Catatan siswa dan tindak lanjut', head: ['No', 'Tanggal', 'Siswa / NISN', 'Guru / Mapel', 'Jenis', 'Catatan', 'Status', 'Tindak lanjut'], widths: [8, 23, 42, 38, 18, 70, 25, 53], body: items.map((it, i) => [i + 1, dateLabel(it.tanggal), identity(it), [it.nama_guru, it.mapel, it.jam_ke ? `Jam ${it.jam_ke}` : ''].filter(Boolean).join('\n'), it.jenis, it.catatan || '-', noteStatus(it.status || 'BARU'), (it.catatan_siswa_tindak_lanjut || []).slice().sort((a: Row, b: Row) => String(a.created_at).localeCompare(String(b.created_at))).map((tl: Row) => [dateLabel(tl.created_at), tl.nama, noteStatus(tl.status_baru), tl.catatan].filter(Boolean).join(' - ')).join('\n\n') || 'Belum ada tindak lanjut']) }] };
}
export async function loadCatatanReport(c: Context & { bulan: string; jenis: string }, signal: AbortSignal) {
    const range = reportMonthRange(c.tahun, c.bulan);
    // Tanggal sudah membatasi tahun ajaran, sekaligus mempertahankan catatan lama tanpa tahun_ajaran.
    const params = new URLSearchParams({ kelas: c.kelas, tanggal_from: range.start, tanggal_to: range.end });
    if (c.jenis !== 'ALL') params.set('jenis', c.jenis);
    const json = await reportJson('/api/catatan-siswa?' + params, signal);
    if (!Array.isArray(json.data)) throw new Error('Data catatan pembelajaran tidak lengkap.');
    return buildCatatanReport(c, json.data);
}
