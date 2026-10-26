import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { GuruMapelEntry } from '@/app/jadwal/lib/parseJadwalExcel'

export interface JadwalPdfRow {
  nip: string; nama_guru: string; hari: string; kelas: string; jam_ke: string
  ruang?: string | null; mapel?: string; mata_pelajaran?: string
}
interface Options {
  type: 'mengajar' | 'piket'; berlaku?: string | null; waktuMap: Record<string, string>
  master: GuruMapelEntry[]; selectedKelas?: string; search?: string
  sortColumns: (columns: string[], classes: Set<string>) => string[]
}
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const blue: [number, number, number] = [27, 67, 117]
const subject = (r: JadwalPdfRow) => r.mapel || r.mata_pelajaran || ''
const column = (r: JadwalPdfRow) => r.ruang?.trim() || r.kelas || '-'
const norm = (s: string) => s.trim().toLowerCase()
const nipKey = (s: string) => s.trim().replace(/^0+/, '')

export function createJadwalPdf(input: JadwalPdfRow[], options: Options) {
  const q = norm(options.search || '')
  const rows = input.filter(r => (!options.selectedKelas || options.selectedKelas === 'semua' || r.kelas === options.selectedKelas || column(r) === options.selectedKelas)
    && (!q || [r.nama_guru, subject(r), r.kelas, r.ruang || '', r.jam_ke].some(v => norm(v).includes(q))))
  if (!rows.length) throw new Error('Tidak ada jadwal yang sesuai filter untuk diekspor.')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 12
  const title = `JADWAL ${options.type === 'piket' ? 'PIKET' : 'PEMBELAJARAN'} MADRASAH`
  doc.setProperties({ title, author: 'ACCA' })
  const teachers = [...new Set(input.map(r => r.nip || r.nama_guru))].sort()
  const subjects = [...new Set(input.map(subject).filter(Boolean))].sort()
  // Kode cadangan diberi awalan agar tidak tertukar dengan kode master.
  const codes = (r: JadwalPdfRow) => {
    const teacherMatch = options.master.find(m => r.nip ? nipKey(m.nip || '') === nipKey(r.nip) : norm(m.nama_guru) === norm(r.nama_guru))
    const match = options.master.find(m => (r.nip ? nipKey(m.nip || '') === nipKey(r.nip) : norm(m.nama_guru) === norm(r.nama_guru))
      && [m.nama_mapel, m.kode_mapel || ''].some(s => norm(s) === norm(subject(r))))
    return { guru: match?.kode_guru || teacherMatch?.kode_guru || `G-${teachers.indexOf(r.nip || r.nama_guru) + 1}`,
      mapel: match?.kode_mapel || `M-${subjects.indexOf(subject(r)) + 1}` }
  }
  const header = (day: string, part: number, count: number) => {
    doc.setTextColor(...blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(title, margin, 16)
    doc.setFontSize(11); doc.text(`${day.toUpperCase()}${count > 1 ? ` | Kelompok kolom ${part}/${count}` : ''}`, margin, 24)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90)
    doc.text(`Berlaku mulai: ${options.berlaku || '-'} | Kelas/ruang: ${options.selectedKelas && options.selectedKelas !== 'semua' ? options.selectedKelas : 'Semua'}${q ? ` | Pencarian: ${options.search}` : ''}`, margin, 30, { maxWidth: width - margin * 2 })
    doc.setDrawColor(...blue); doc.line(margin, 35, width - margin, 35)
  }
  let first = true
  for (const day of DAYS) {
    const dayRows = rows.filter(r => r.hari === day)
    if (!dayRows.length) continue
    const cols = options.sortColumns([...new Set(dayRows.map(column))], new Set(input.map(r => r.kelas)))
    const jams = [...new Set(dayRows.map(r => Number(r.jam_ke)).filter(Number.isFinite))].sort((a, b) => a - b)
    const count = Math.ceil(cols.length / 8)
    for (let offset = 0; offset < cols.length; offset += 8) {
      if (!first) doc.addPage(); first = false
      const group = cols.slice(offset, offset + 8)
      const relevant = dayRows.filter(r => group.includes(column(r)))
      const drawHeader = () => header(day, offset / 8 + 1, count)
      autoTable(doc, { startY: 40, margin: { left: margin, right: margin, top: 40, bottom: 15 },
        theme: 'grid', head: [['Jam', 'Waktu', ...group]],
        body: jams.map(jam => [String(jam), options.waktuMap[`${day}|${jam}`] || '-', ...group.map(c => {
          const entries = relevant.filter(r => Number(r.jam_ke) === jam && column(r) === c)
          return entries.map(r => { const code = codes(r); return `${code.guru} ${code.mapel}${r.kelas !== c ? `\n[${r.kelas}]` : ''}` }).join('\n') || '-'
        })]),
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, halign: 'center', valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.2, textColor: [30, 41, 59], minCellHeight: 7 },
        headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 252] }, columnStyles: { 0: { cellWidth: 12, fontStyle: 'bold' }, 1: { cellWidth: 29, fontSize: 8 } },
        rowPageBreak: 'avoid', didDrawPage: drawHeader,
      })
      const lastY = (doc as any).lastAutoTable.finalY
      const legend = new Map<string, [string, string, string]>()
      for (const r of relevant) {
        const code = codes(r)
        legend.set(`G|${code.guru}|${r.nama_guru}`, ['Guru', code.guru, r.nama_guru || '-'])
        if (subject(r)) legend.set(`M|${code.mapel}|${subject(r)}`, ['Mapel', code.mapel, subject(r)])
      }
      const entries = [...legend.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1], 'id', { numeric: true }))
      const legendRows = Math.ceil(entries.length / 3)
      const legendBody = Array.from({ length: legendRows }, (_, i) => [0, 1, 2].flatMap(group => {
        const entry = entries[group * legendRows + i]
        return entry ? [entry[1], `${entry[0]}: ${entry[2]}`] : ['', '']
      }))
      autoTable(doc, { startY: lastY + 5, margin: { left: margin, right: margin, top: 40, bottom: 15 }, theme: 'grid',
        head: [['Kode', 'Keterangan guru / mapel', 'Kode', 'Keterangan guru / mapel', 'Kode', 'Keterangan guru / mapel']],
        body: legendBody,
        styles: { fontSize: 7.3, cellPadding: 1.1, textColor: [30, 41, 59], lineColor: [218, 226, 235], lineWidth: 0.15 },
        headStyles: { fillColor: [231, 239, 249], textColor: blue, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 13, fontStyle: 'bold' }, 2: { cellWidth: 13, fontStyle: 'bold' }, 4: { cellWidth: 13, fontStyle: 'bold' } }, rowPageBreak: 'avoid', didDrawPage: drawHeader,
      })
    }
  }
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(100)
    doc.text('ACCA | Isi sel: kode guru + kode mapel | G-/M-: kode otomatis bila master belum tersedia', margin, height - 7)
    doc.text(`${p} / ${doc.getNumberOfPages()}`, width - margin, height - 7, { align: 'right' })
  }
  return doc
}
