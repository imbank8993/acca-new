import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createPdfReportHeader } from './pdf-report-header';

export type JurnalPdfRow = Record<string, string | number | undefined>;
interface Options { mode: 'GURU' | 'ADMIN' | 'WALI'; tahunAjaran: string; namaGuru?: string; nip?: string }
const BLUE: [number, number, number] = [34, 83, 150];
const MUTED: [number, number, number] = [100, 116, 139];

function read(row: JurnalPdfRow, ...keys: string[]) {
    for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '-') return String(value).trim();
    }
    return '';
}
function dateKey(value: string) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value.split('/').reverse().join('-');
    return value.slice(0, 10);
}

export function createJurnalPdf(input: JurnalPdfRow[], options: Options) {
    if (!input.length) throw new Error('Tidak ada jurnal untuk diekspor.');
    const rows = [...input].sort((a, b) => dateKey(read(a, 'Tanggal', 'tanggal')).localeCompare(dateKey(read(b, 'Tanggal', 'tanggal')))
        || read(a, 'Kelas', 'kelas').localeCompare(read(b, 'Kelas', 'kelas'), 'id')
        || read(a, 'Jam Ke', 'jam_ke').localeCompare(read(b, 'Jam Ke', 'jam_ke'), 'id', { numeric: true }));
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    const margin = 10, usable = width - margin * 2;
    const mode = { GURU: 'Guru', WALI: 'Wali Kelas', ADMIN: 'Admin' }[options.mode];
    doc.setProperties({ title: `Jurnal Pembelajaran - ${options.tahunAjaran}`, author: 'ACCA', subject: 'Laporan jurnal pembelajaran' });
    const values = (...keys: string[]) => [...new Set(rows.map(row => read(row, ...keys)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    const teachers = values('Nama Guru', 'nama_guru'), subjects = values('Mata Pelajaran', 'mata_pelajaran'), classes = values('Kelas', 'kelas');
    const firstDate = read(rows[0], 'Tanggal', 'tanggal'), lastDate = read(rows[rows.length - 1], 'Tanggal', 'tanggal');
    const teacher = options.mode !== 'ADMIN' && options.namaGuru
        ? `${options.namaGuru}${options.nip ? ` | NIP ${options.nip}` : ''}`
        : teachers.length === 1 ? teachers[0] : `${teachers.length} guru (rincian pada tabel)`;
    const header = createPdfReportHeader(doc, 'Jurnal Pembelajaran', {
        left: [
            { label: 'Kelas / Periode', value: `${classes.join(', ') || '-'} | ${firstDate}${lastDate !== firstDate ? ` - ${lastDate}` : ''}` },
            { label: 'Tahun ajaran', value: `${options.tahunAjaran} | Mode ${mode} | ${rows.length} jurnal` },
        ],
        right: [
            { label: options.mode === 'WALI' ? 'Wali kelas' : 'Guru', value: teacher },
            { label: 'Mata pelajaran', value: subjects.join(', ') || '-' },
        ],
    });

    autoTable(doc, {
        startY: header.tableTop, margin: { top: header.tableTop, bottom: 20, left: margin, right: margin }, theme: 'grid',
        head: [['No', 'Hari / Tanggal', 'Kelas / Waktu', 'Guru / Mata pelajaran', 'Kehadiran', 'Materi dan Refleksi', 'Keterangan']],
        body: rows.map((row, i) => {
            const teacher = read(row, 'Nama Guru', 'nama_guru');
            const nip = read(row, 'NIP', 'nip');
            const pengganti = read(row, 'Guru Pengganti', 'guru_pengganti');
            const statusPengganti = read(row, 'Status Pengganti', 'status_pengganti');
            const piket = read(row, 'guru_piket');
            const late = read(row, 'durasi_terlambat');
            const notes = [pengganti ? `Pengganti: ${pengganti}${statusPengganti ? ` (${statusPengganti})` : ''}` : '',
                piket ? `Guru piket: ${piket}` : '', read(row, 'Keterangan', 'keterangan_tambahan')].filter(Boolean).join('\n');
            return [i + 1,
                [read(row, 'Hari', 'hari'), read(row, 'Tanggal', 'tanggal')].filter(Boolean).join('\n'),
                [read(row, 'Kelas', 'kelas'), read(row, 'Jam Ke', 'jam_ke')].filter(Boolean).join('\n'),
                [teacher, nip ? `NIP ${nip}` : '', read(row, 'Mata Pelajaran', 'mata_pelajaran')].filter(Boolean).join('\n'),
                [read(row, 'Kategori Kehadiran', 'kategori_kehadiran') || 'Sesuai', Number(late) > 0 ? `Terlambat ${late} menit` : ''].filter(Boolean).join('\n'),
                `Materi:\n${read(row, 'Materi', 'materi') || '-'}\n\nRefleksi:\n${read(row, 'Refleksi', 'refleksi') || '-'}`,
                notes || '-',
            ];
        }),
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, textColor: [25, 44, 70], lineColor: [208, 216, 227], lineWidth: .15, valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', halign: 'left', valign: 'middle' },
        alternateRowStyles: { fillColor: [248, 250, 253] },
        columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 23 }, 2: { cellWidth: 29 },
            3: { cellWidth: 49 }, 4: { cellWidth: 32 }, 5: { cellWidth: 85 }, 6: { cellWidth: usable - 226 } },
        rowPageBreak: 'avoid',
        willDrawPage: () => header.draw(),
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(218, 225, 235).setLineWidth(.2).line(margin, height - 13, width - margin, height - 13);
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
        doc.text('ACCA - Jurnal pembelajaran', margin, height - 8);
        doc.text(`Halaman ${p} dari ${pages}`, width - margin, height - 8, { align: 'right' });
    }
    return doc;
}
