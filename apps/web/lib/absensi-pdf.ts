import { jsPDF } from 'jspdf';
import autoTable, { type CellInput, type Styles } from 'jspdf-autotable';
import { createPdfReportHeader, type PdfHeaderField } from './pdf-report-header';

interface AttendanceDetail {
    nisn: string;
    nama_snapshot: string;
    status?: string;
    catatan?: string | null;
    keterangan?: string | null;
}
interface AttendanceSession {
    sesi_id: string;
    tanggal: string;
    kelas: string;
    mapel?: string | null;
    status_sesi?: string;
    absensi_detail?: AttendanceDetail[];
}
interface Absence {
    nisn: string;
    kelas: string;
    jenis: string;
    status?: string | null;
    keterangan?: string | null;
    tgl_mulai: string;
    tgl_selesai: string;
}
interface Holiday { tanggal: string; keterangan?: string }
interface Payload { sessions: AttendanceSession[]; ketidakhadiran?: Absence[]; holidays?: Holiday[] }
interface Options {
    tahunAjaran: string;
    timezone?: string;
    today?: string;
    mode?: 'GURU' | 'ADMIN' | 'WALI';
    namaGuru?: string;
    nip?: string;
}
type Mark = 'H' | 'I' | 'S' | 'A' | 'L' | '-';
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KIND: Record<string, string> = { I: 'Izin', S: 'Sakit', A: 'Alpa' };
const BLUE: [number, number, number] = [34, 83, 150];
const MUTED: [number, number, number] = [100, 116, 139];

function mark(status?: string): Mark | '' {
    return ({ HADIR: 'H', H: 'H', IZIN: 'I', I: 'I', SAKIT: 'S', S: 'S', ALPHA: 'A', ALPA: 'A', A: 'A' } as Record<string, Mark>)[String(status || '').trim().toUpperCase()] || '';
}
function dateLabel(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function periodLabel(start: string, end: string) { return start === end ? dateLabel(start) : `${dateLabel(start)} - ${dateLabel(end)}`; }

export function buildAbsensiReportData(payload: Payload, options: Options) {
    const today = options.today || new Date().toLocaleDateString('en-CA', { timeZone: options.timezone || 'Asia/Makassar' });
    const groups = new Map<string, AttendanceSession[]>();
    for (const session of payload.sessions) {
        if (session.status_sesi !== 'FINAL' && !session.sesi_id?.startsWith('rekap-')) continue;
        const key = `${session.kelas}|${session.tanggal.slice(0, 7)}`;
        const group = groups.get(key) || [];
        group.push(session); groups.set(key, group);
    }
    const reports = [...groups.values()].map(sessions => {
        const kelas = sessions[0].kelas;
        const mapelNames = [...new Set(sessions.map(s => s.mapel?.trim()).filter((name): name is string => typeof name === 'string' && name.length > 0 && name.toUpperCase() !== 'REKAPITULASI'))]
            .sort((a, b) => a.localeCompare(b, 'id'));
        const month = sessions[0].tanggal.slice(0, 7);
        const [year, m] = month.split('-').map(Number);
        const dates = Array.from({ length: new Date(Date.UTC(year, m, 0)).getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
        const holidays = (payload.holidays || []).filter(h => h.tanggal.startsWith(month)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        const holidayDates = new Set(holidays.map(h => h.tanggal.slice(0, 10)));
        const students = new Map<string, { nisn: string; nama: string; details: Map<string, AttendanceDetail> }>();
        for (const session of sessions) for (const detail of session.absensi_detail || []) {
            if (!students.has(detail.nisn)) students.set(detail.nisn, { nisn: detail.nisn, nama: detail.nama_snapshot || detail.nisn, details: new Map() });
            students.get(detail.nisn)!.details.set(session.tanggal.slice(0, 10), detail);
        }
        const rows = [...students.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(student => {
            const counts = { H: 0, I: 0, S: 0, A: 0 };
            const cells = dates.map(date => {
                let value: Mark | '' = '';
                if (date <= today) {
                    const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
                    value = holidayDates.has(date) ? 'L' : weekend ? '-' : mark(student.details.get(date)?.status) || 'H';
                }
                if (value === 'H' || value === 'I' || value === 'S' || value === 'A') counts[value]++;
                return value;
            });
            return { ...student, cells, counts };
        });
        return { kelas, mapelNames, month, label: `${MONTHS[m - 1]} ${year}`, dates, holidays, rows };
    }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.month.localeCompare(b.month));

    // One appendix for the whole PDF; official multi-day leave appears once.
    const notes: { nisn: string; nama: string; kelas: string; jenis: string; mulai: string; selesai: string; keterangan: string }[] = [];
    const covered = new Set<string>();
    const seen = new Set<string>();
    const daily = reports.flatMap(report => report.rows.flatMap(student => report.dates.flatMap((date, i) => {
        const value = student.cells[i];
        return ['I', 'S', 'A'].includes(value) ? [{ kelas: report.kelas, student, date, value }] : [];
    })));
    for (const absence of payload.ketidakhadiran || []) {
        const value = mark(absence.jenis);
        const start = absence.tgl_mulai.slice(0, 10), end = absence.tgl_selesai.slice(0, 10);
        const matches = daily.filter(d => d.student.nisn === absence.nisn && d.kelas === absence.kelas && d.value === value && d.date >= start && d.date <= end);
        if (!matches.length) continue;
        matches.forEach(d => covered.add(`${d.kelas}|${d.student.nisn}|${d.date}|${d.value}`));
        const key = `${absence.kelas}|${absence.nisn}|${start}|${end}|${value}|${absence.keterangan || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        notes.push({ nisn: absence.nisn, nama: matches[0].student.nama, kelas: absence.kelas,
            jenis: KIND[value] + (absence.status ? ` (${absence.status})` : ''), mulai: start, selesai: end,
            keterangan: absence.keterangan?.trim() || 'Tanpa keterangan tambahan' });
    }
    for (const d of daily) {
        const key = `${d.kelas}|${d.student.nisn}|${d.date}|${d.value}`;
        if (covered.has(key)) continue;
        covered.add(key);
        const detail = d.student.details.get(d.date);
        notes.push({ nisn: d.student.nisn, nama: d.student.nama, kelas: d.kelas, jenis: KIND[d.value], mulai: d.date, selesai: d.date,
            keterangan: detail?.keterangan?.trim() || detail?.catatan?.trim() || 'Tanpa keterangan tambahan' });
    }
    notes.sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama, 'id') || a.mulai.localeCompare(b.mulai));
    return { reports, notes };
}

export function createAbsensiPdf(payload: Payload, options: Options) {
    const { reports, notes } = buildAbsensiReportData(payload, options);
    if (!reports.length) throw new Error('Tidak ada rekap absensi untuk periode yang dipilih.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    const margin = 10, usable = width - margin * 2;
    doc.setProperties({ title: `Absensi Siswa - ${options.tahunAjaran}`, author: 'ACCA', subject: 'Rekap absensi siswa' });
    const teacherField: PdfHeaderField | undefined = options.mode === 'GURU'
        ? { label: 'Guru', value: `${options.namaGuru || '-'}${options.nip ? ` | NIP ${options.nip}` : ''}` }
        : options.mode ? { label: 'Mode', value: { ADMIN: 'Admin', WALI: 'Wali Kelas' }[options.mode] } : undefined;
    function reportHeader(title: string, leftRows: PdfHeaderField[], mapelNames: string[] = []) {
        const rightRows = [teacherField, mapelNames.length || options.mode === 'GURU'
            ? { label: 'Mata pelajaran', value: mapelNames.join(', ') || '-' } : undefined];
        return createPdfReportHeader(doc, title, { left: leftRows, right: rightRows.filter((field): field is PdfHeaderField => Boolean(field)) });
    }
    const styles: Partial<Styles> = { font: 'helvetica', fontSize: 7.5, cellPadding: 2, textColor: [25, 44, 70], lineColor: [208, 216, 227], lineWidth: .15, valign: 'middle', overflow: 'linebreak' };
    const headStyles: Partial<Styles> = { fillColor: BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', lineColor: [230, 236, 245] };
    for (const [index, report] of reports.entries()) {
        if (index) doc.addPage('a4', 'landscape');
        const title = 'DAFTAR HADIR SISWA';
        const subtitle = [{ label: 'Kelas / Bulan', value: `${report.kelas} | ${report.label}` }, { label: 'Tahun ajaran', value: options.tahunAjaran }];
        const header = reportHeader(title, subtitle, report.mapelNames);
        const { tableTop } = header;
        const n = report.dates.length;
        const dayWidth = (usable - 7 - 22 - 58 - 40) / n;
        const columns: Record<number, Partial<Styles>> = { 0: { cellWidth: 7 }, 1: { cellWidth: 22, fontSize: 6.8 }, 2: { cellWidth: 58, halign: 'left', fontSize: 7.2 } };
        for (let i = 0; i < n; i++) columns[3 + i] = { cellWidth: dayWidth };
        for (let i = 0; i < 4; i++) columns[3 + n + i] = { cellWidth: 10, fontStyle: 'bold' };
        const head: CellInput[][] = [
            [{ content: 'No', rowSpan: 3 }, { content: 'NISN', rowSpan: 3 }, { content: 'Nama siswa', rowSpan: 3 }, { content: 'Tanggal', colSpan: n }, { content: 'Jumlah', colSpan: 4 }],
            [...report.dates.map(d => String(Number(d.slice(-2)))), ...['H', 'I', 'S', 'A'].map(content => ({ content, rowSpan: 2 }))],
            report.dates.map(d => ['M', 'S', 'S', 'R', 'K', 'J', 'S'][new Date(`${d}T00:00:00Z`).getUTCDay()]),
        ];
        autoTable(doc, {
            startY: tableTop, margin: { top: tableTop, bottom: 20, left: margin, right: margin }, theme: 'grid',
            head, body: report.rows.map((s, i) => [i + 1, s.nisn, s.nama, ...s.cells, s.counts.H, s.counts.I, s.counts.S, s.counts.A]),
            styles: { ...styles, fontSize: 6.4, cellPadding: { top: 1.5, bottom: 1.5, left: .4, right: .4 }, halign: 'center' },
            headStyles, columnStyles: columns, rowPageBreak: 'avoid',
            willDrawPage: () => header.draw(),
            didParseCell: ({ section, cell, column }) => {
                if (section !== 'body' || column.index < 3 || column.index >= 3 + n) return;
                const value = cell.raw;
                if (value === 'L' || value === '-' || value === '') { cell.styles.fillColor = [242, 245, 249]; cell.styles.textColor = MUTED; }
                if (value === 'I') { cell.styles.fillColor = [233, 247, 239]; cell.styles.textColor = [28, 112, 69]; }
                if (value === 'S') { cell.styles.fillColor = [255, 246, 221]; cell.styles.textColor = [141, 91, 13]; }
                if (value === 'A') { cell.styles.fillColor = [255, 234, 234]; cell.styles.textColor = [166, 38, 38]; }
            },
        });
        let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
        if (y > height - 32) { doc.addPage('a4', 'landscape'); header.draw(); y = tableTop + 2; }
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
        doc.text('H = Hadir    I = Izin    S = Sakit    A = Alpa    L = Libur    - = Akhir pekan', margin, y);
        doc.text('Hari efektif tanpa catatan ketidakhadiran dihitung Hadir. Tanggal mendatang belum dihitung.', margin, y + 4);
        if (report.holidays.length) {
            autoTable(doc, {
                startY: y + 8, margin: { top: tableTop, bottom: 20, left: margin, right: margin },
                head: [['Hari libur / kegiatan', 'Keterangan']], body: report.holidays.map(h => [dateLabel(h.tanggal), h.keterangan || 'Libur']),
                styles, headStyles: { ...headStyles, fillColor: [238, 243, 250], textColor: BLUE, halign: 'left' },
                columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: usable - 35 } },
                willDrawPage: () => header.draw(), rowPageBreak: 'avoid',
            });
        }
    }
    if (notes.length) {
        doc.addPage('a4', 'landscape');
        const subtitle = [{ label: 'Laporan', value: 'Lampiran rekap absensi' }, { label: 'Tahun ajaran', value: options.tahunAjaran }];
        const mapelNames = [...new Set(reports.flatMap(report => report.mapelNames))].sort((a, b) => a.localeCompare(b, 'id'));
        const header = reportHeader('Keterangan Ketidakhadiran', subtitle, mapelNames);
        const { tableTop } = header;
        autoTable(doc, {
            startY: tableTop, margin: { top: tableTop, bottom: 20, left: margin, right: margin },
            head: [['No', 'Nama siswa / NISN', 'Kelas', 'Jenis', 'Periode', 'Keterangan']],
            body: notes.map((n, i) => [i + 1, `${n.nama}\n${n.nisn}`, n.kelas, n.jenis, periodLabel(n.mulai, n.selesai), n.keterangan]),
            styles: { ...styles, cellPadding: 2.5 }, headStyles, rowPageBreak: 'avoid',
            columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 52 }, 2: { cellWidth: 14 }, 3: { cellWidth: 31 }, 4: { cellWidth: 45 }, 5: { cellWidth: usable - 151 } },
            willDrawPage: () => header.draw(),
        });
    }
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(218, 225, 235).setLineWidth(.2).line(margin, height - 13, width - margin, height - 13);
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
        doc.text('ACCA - Rekap kehadiran siswa', margin, height - 8);
        doc.text(`Halaman ${p} dari ${pages}`, width - margin, height - 8, { align: 'right' });
    }
    return doc;
}
