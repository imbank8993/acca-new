import { jsPDF } from 'jspdf'
import autoTable, { type CellHookData } from 'jspdf-autotable'
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
type RGB = [number, number, number]
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const blue: RGB = [27, 67, 117]
const softBlue: RGB = [231, 239, 249]
const shade: RGB = [245, 248, 252]
const subject = (r: JadwalPdfRow) => r.mapel || r.mata_pelajaran || ''
const column = (r: JadwalPdfRow) => r.ruang?.trim() || r.kelas || '-'
const norm = (s: string) => s.trim().toLowerCase()
const nipKey = (s: string) => s.trim().replace(/^0+/, '')

/** Lebar kolom tetap (mm) di kiri tabel: Hari | Jam | Waktu. */
const W_HARI = 15, W_JAM = 10, W_WAKTU = 22
/** Lebar minimum satu kolom kelas/ruang agar "kode guru + kode mapel" tetap terbaca. */
const MIN_COL = 12.5

/**
 * PDF jadwal lengkap dalam SATU tabel matriks:
 *  - kolom  = semua kelas/ruangan sekaligus,
 *  - baris  = jam pelajaran, dikelompokkan per hari (sel "Hari" di-merge),
 *  - legenda kode guru & mapel dicetak sekali saja di akhir dokumen.
 * Ukuran kertas otomatis: A4 landscape bila muat, lalu A3, lalu lebar khusus.
 */
export function createJadwalPdf(input: JadwalPdfRow[], options: Options) {
  const q = norm(options.search || '')
  const rows = input.filter(r => (!options.selectedKelas || options.selectedKelas === 'semua' || r.kelas === options.selectedKelas || column(r) === options.selectedKelas)
    && (!q || [r.nama_guru, subject(r), r.kelas, r.ruang || '', r.jam_ke].some(v => norm(v).includes(q))))
  if (!rows.length) throw new Error('Tidak ada jadwal yang sesuai filter untuk diekspor.')

  const cols = options.sortColumns([...new Set(rows.map(column))], new Set(input.map(r => r.kelas)))
  const days = DAYS.filter(d => rows.some(r => r.hari === d))

  // Pilih ukuran kertas sesuai jumlah kolom.
  const margin = 10
  const fixedW = W_HARI + W_JAM + W_WAKTU
  const needW = margin * 2 + fixedW + cols.length * MIN_COL
  const [pageW, pageH] = needW <= 297 ? [297, 210] : needW <= 420 ? [420, 297] : [Math.ceil(needW), 297]
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: pageW === 297 ? 'a4' : pageW === 420 ? 'a3' : [pageH, pageW], compress: true })
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight()
  const colW = (width - margin * 2 - fixedW) / cols.length
  const cellFont = Math.max(6, Math.min(9, colW * 0.5))

  const title = `JADWAL ${options.type === 'piket' ? 'PIKET' : 'PEMBELAJARAN'} MADRASAH`
  doc.setProperties({ title, author: 'ACCA' })

  const teachers = [...new Set(input.map(r => r.nip || r.nama_guru))].sort()
  const subjects = [...new Set(input.map(subject).filter(Boolean))].sort()
  // Kode cadangan diberi awalan agar tidak tertukar dengan kode master.
  const codeCache = new Map<string, { guru: string; mapel: string }>()
  const codes = (r: JadwalPdfRow) => {
    const key = `${r.nip}|${r.nama_guru}|${subject(r)}`
    const hit = codeCache.get(key)
    if (hit) return hit
    const sameTeacher = (m: GuruMapelEntry) => r.nip ? nipKey(m.nip || '') === nipKey(r.nip) : norm(m.nama_guru) === norm(r.nama_guru)
    const teacherMatch = options.master.find(sameTeacher)
    const match = options.master.find(m => sameTeacher(m) && [m.nama_mapel, m.kode_mapel || ''].some(s => norm(s) === norm(subject(r))))
    const result = { guru: match?.kode_guru || teacherMatch?.kode_guru || `G-${teachers.indexOf(r.nip || r.nama_guru) + 1}`,
      mapel: match?.kode_mapel || `M-${subjects.indexOf(subject(r)) + 1}` }
    codeCache.set(key, result)
    return result
  }

  const headerTop = 34
  const drawnHeaders = new Set<number>()
  const drawHeader = () => {
    const page = doc.getCurrentPageInfo().pageNumber
    if (drawnHeaders.has(page)) return
    drawnHeaders.add(page)
    doc.setTextColor(...blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(title, margin, 15)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90)
    const filter = options.selectedKelas && options.selectedKelas !== 'semua' ? options.selectedKelas : 'Semua'
    doc.text(`Berlaku mulai: ${options.berlaku || '-'}  |  Kelas/ruang: ${filter}${q ? `  |  Pencarian: ${options.search}` : ''}`, margin, 22, { maxWidth: width - margin * 2 })
    doc.text('Isi sel: kode guru + kode mapel. Keterangan kode ada di akhir dokumen.', margin, 27)
    doc.setDrawColor(...blue); doc.setLineWidth(0.4); doc.line(margin, 30, width - margin, 30)
  }

  // Susun badan tabel: satu baris per jam, sel "Hari" di-merge (rowSpan) per hari.
  const body: any[][] = []
  const dayOfRow: number[] = []
  const firstRowOfDay = new Set<number>()
  days.forEach((day, di) => {
    const dayRows = rows.filter(r => r.hari === day)
    const jams = [...new Set(dayRows.map(r => Number(r.jam_ke)).filter(Number.isFinite))].sort((a, b) => a - b)
    jams.forEach((jam, ji) => {
      const cells = cols.map(c => dayRows
        .filter(r => Number(r.jam_ke) === jam && column(r) === c)
        .map(r => { const code = codes(r); return `${code.guru} ${code.mapel}${r.kelas !== c ? `\n[${r.kelas}]` : ''}` })
        .join('\n'))
      const row: any[] = [String(jam), options.waktuMap[`${day}|${jam}`] || '-', ...cells]
      if (ji === 0) {
        row.unshift({ content: day.toUpperCase(), rowSpan: jams.length, styles: { fillColor: softBlue, textColor: blue, fontStyle: 'bold', fontSize: 8.5 } })
        firstRowOfDay.add(body.length)
      }
      dayOfRow.push(di)
      body.push(row)
    })
  })

  const tableMargin = { left: margin, right: margin, top: headerTop, bottom: 13 }
  autoTable(doc, {
    startY: headerTop, margin: tableMargin, theme: 'grid',
    head: [['Hari', 'Jam', 'Waktu', ...cols]], body,
    styles: { font: 'helvetica', fontSize: cellFont, cellPadding: 1.2, halign: 'center', valign: 'middle', overflow: 'linebreak',
      lineColor: [203, 213, 225], lineWidth: 0.2, textColor: [30, 41, 59], minCellHeight: 6.2 },
    headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold', fontSize: Math.min(cellFont + 0.5, 9) },
    columnStyles: {
      0: { cellWidth: W_HARI },
      1: { cellWidth: W_JAM, fontStyle: 'bold' },
      2: { cellWidth: W_WAKTU, fontSize: Math.min(cellFont, 7.5) },
      ...Object.fromEntries(cols.map((_, i) => [i + 3, { cellWidth: colW }])),
    },
    // Baris yang memuat sel rowSpan otomatis pindah halaman utuh bila satu hari tidak muat,
    // sehingga satu hari tidak terpotong di dua halaman (selama tingginya < 1 halaman).
    rowPageBreak: 'avoid',
    didParseCell: (d: CellHookData) => {
      if (d.section !== 'body') return
      const day = dayOfRow[d.row.index]
      if (d.column.index > 0 && day % 2 === 1) d.cell.styles.fillColor = shade
    },
    didDrawCell: (d: CellHookData) => {
      // Garis tebal pemisah antar-hari.
      if (d.section !== 'body' || !firstRowOfDay.has(d.row.index) || d.row.index === 0) return
      doc.setDrawColor(...blue); doc.setLineWidth(0.6)
      doc.line(d.cell.x, d.cell.y, d.cell.x + d.cell.width, d.cell.y)
    },
    willDrawPage: drawHeader,
  })

  // Legenda kode guru & mapel — sekali saja di akhir dokumen.
  const guruLegend = new Map<string, string>()
  const mapelLegend = new Map<string, string>()
  for (const r of rows) {
    const code = codes(r)
    if (!guruLegend.has(code.guru)) guruLegend.set(code.guru, r.nama_guru || '-')
    if (subject(r) && !mapelLegend.has(code.mapel)) mapelLegend.set(code.mapel, subject(r))
  }
  const byCode = (a: [string, string], b: [string, string]) => a[0].localeCompare(b[0], 'id', { numeric: true })
  const groups = width >= 400 ? 5 : width >= 290 ? 4 : 3
  const legendTable = (label: string, items: [string, string][], startY: number) => {
    const per = Math.ceil(items.length / groups)
    // Usahakan satu blok legenda tidak terpotong: pindah halaman bila sisa ruang kurang.
    const estH = (per + 1) * 5.3
    const bottom = height - tableMargin.bottom
    if (startY + estH > bottom && estH <= bottom - headerTop) { doc.addPage(); drawHeader(); startY = headerTop }
    const legendBody = Array.from({ length: per }, (_, i) => Array.from({ length: groups }, (_, g) => {
      const e = items[g * per + i]
      return e ? [e[0], e[1]] : ['', '']
    }).flat())
    const codeCols = Object.fromEntries(Array.from({ length: groups }, (_, g) => [g * 2, { cellWidth: 13, fontStyle: 'bold' as const, textColor: blue }]))
    autoTable(doc, {
      startY, margin: tableMargin, theme: 'grid',
      head: [[{ content: label, colSpan: groups * 2, styles: { halign: 'left' } }]],
      body: legendBody,
      styles: { fontSize: 7.3, cellPadding: 1.1, textColor: [30, 41, 59], lineColor: [218, 226, 235], lineWidth: 0.15 },
      headStyles: { fillColor: softBlue, textColor: blue, fontStyle: 'bold' },
      columnStyles: codeCols, rowPageBreak: 'avoid', willDrawPage: drawHeader,
    })
    return (doc as any).lastAutoTable.finalY as number
  }
  let y = (doc as any).lastAutoTable.finalY + 6
  y = legendTable('KETERANGAN KODE GURU', [...guruLegend.entries()].sort(byCode), y) + 4
  if (mapelLegend.size) legendTable('KETERANGAN KODE MATA PELAJARAN', [...mapelLegend.entries()].sort(byCode), y)

  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100)
    doc.text('ACCA | Isi sel: kode guru + kode mapel | G-/M-: kode otomatis bila master belum tersedia', margin, height - 6)
    doc.text(`${p} / ${doc.getNumberOfPages()}`, width - margin, height - 6, { align: 'right' })
  }
  return doc
}
