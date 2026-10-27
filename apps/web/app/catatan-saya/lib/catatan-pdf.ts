import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { createPdfReportHeader } from '@/lib/pdf-report-header'
import type { Catatan, CatatanBlock, ExportOptions } from '../types'

// Indonesian month names
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Indonesian day names
const NAMA_HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
]

// Color palette
const COLORS = {
  headingBlue: [26, 54, 100] as [number, number, number],    // #1a3664
  accentBlue: [232, 240, 254] as [number, number, number],   // #e8f0fe
  softBlue: [37, 99, 235] as [number, number, number],       // #2563eb
  gridLines: [208, 215, 227] as [number, number, number],    // #d0d7e3
  textDark: [30, 41, 59] as [number, number, number],        // #1e293b
  textSecondary: [100, 116, 139] as [number, number, number], // #64748b
  bgLight: [248, 250, 252] as [number, number, number],      // #f8fafc
  borderCard: [226, 232, 240] as [number, number, number],   // #e2e8f0
}

/**
 * Format string YYYY-MM-DD to Indonesian date format (e.g. Senin, 27 Oktober 2026)
 */
function formatTanggalIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const clean = dateStr.slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  const dateObj = new Date(Date.UTC(y, m - 1, d))
  const dayName = NAMA_HARI[dateObj.getUTCDay()]
  const monthName = NAMA_BULAN[m - 1] || ''
  return `${dayName}, ${d} ${monthName} ${y}`
}

/**
 * Format YYYY-MM to Indonesian month format (e.g. Oktober 2026)
 */
function formatBulanIndo(monthStr: string | null | undefined): string {
  if (!monthStr) return '-'
  const parts = monthStr.split('-')
  if (parts.length < 2) return monthStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  return `${NAMA_BULAN[m - 1] || ''} ${y}`
}

/**
 * Format timestamp to printing date & time string
 */
function formatTanggalCetak(date: Date): string {
  const d = date.getDate()
  const m = NAMA_BULAN[date.getMonth()]
  const y = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${d} ${m} ${y}, ${hh}:${mm} WIB`
}

/**
 * Parse note content blocks safely
 */
function parseIsiBlocks(isi: unknown): CatatanBlock[] {
  if (!isi) return []
  if (Array.isArray(isi)) return isi
  if (typeof isi === 'string') {
    try {
      const parsed = JSON.parse(isi)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return [{ type: 'paragraph', text: isi }]
    }
  }
  return []
}

/**
 * Check if space is available on the current page, add a new page if needed
 */
function ensureVerticalSpace(doc: jsPDF, currentY: number, neededHeight: number, docTitle: string): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottomMargin = 16
  if (currentY + neededHeight > pageHeight - bottomMargin) {
    doc.addPage('a4', 'portrait')
    // Top running header on subsequent pages
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...COLORS.textSecondary)
    doc.text((docTitle || 'CATATAN SAYA').toUpperCase(), 10, 8)
    doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.2).line(10, 10, 200, 10)
    return 15 // Start content at Y = 15mm
  }
  return currentY
}

/**
 * Render a monthly calendar grid in the PDF
 */
function drawCalendarGrid(
  doc: jsPDF,
  startY: number,
  targetMonthStr: string,
  agendaMap: Map<string, Array<{ refNum: number; title: string }>>,
  docTitle: string
): number {
  let [year, month] = targetMonthStr.split('-').map(Number)
  if (!year || !month) {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  // Monday is column 0, Sunday is column 6
  const firstDow = new Date(year, month - 1, 1).getDay()
  const startCol = (firstDow + 6) % 7
  const totalRows = Math.ceil((startCol + daysInMonth) / 7)

  const margin = 10
  const usableWidth = 190
  const colWidth = usableWidth / 7 // ~27.14 mm
  const cellHeight = totalRows === 6 ? 18 : 21
  const headerHeight = 6.5
  const bannerHeight = 7.5
  const totalCalendarHeight = bannerHeight + headerHeight + (totalRows * cellHeight)

  let currentY = ensureVerticalSpace(doc, startY, totalCalendarHeight, docTitle)

  // 1. Calendar Title Banner
  const monthName = NAMA_BULAN[month - 1] || ''
  doc.setFillColor(...COLORS.headingBlue)
  doc.roundedRect(margin, currentY, usableWidth, bannerHeight, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255, 255, 255)
  doc.text(`KALENDER DRAFT AGENDA — ${monthName.toUpperCase()} ${year}`, margin + usableWidth / 2, currentY + 5.1, { align: 'center' })
  currentY += bannerHeight

  // 2. Weekday Header Row (Sen - Min)
  const weekdays = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU']
  doc.setFillColor(...COLORS.accentBlue)
  doc.rect(margin, currentY, usableWidth, headerHeight, 'F')
  doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.2)
  doc.line(margin, currentY + headerHeight, margin + usableWidth, currentY + headerHeight)

  for (let c = 0; c < 7; c++) {
    const colX = margin + c * colWidth
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...COLORS.headingBlue)
    doc.text(weekdays[c], colX + colWidth / 2, currentY + 4.3, { align: 'center' })
    if (c > 0) {
      doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.15).line(colX, currentY, colX, currentY + headerHeight)
    }
  }
  currentY += headerHeight

  // 3. Days Grid
  for (let r = 0; r < totalRows; r++) {
    const rowY = currentY + r * cellHeight
    for (let c = 0; c < 7; c++) {
      const colX = margin + c * colWidth
      const dayNum = r * 7 + c - startCol + 1
      const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
      const isWeekend = c >= 5

      // Cell background
      if (!isCurrentMonth) {
        doc.setFillColor(248, 250, 252)
        doc.rect(colX, rowY, colWidth, cellHeight, 'F')
      } else if (isWeekend) {
        doc.setFillColor(253, 254, 255)
        doc.rect(colX, rowY, colWidth, cellHeight, 'F')
      } else {
        doc.setFillColor(255, 255, 255)
        doc.rect(colX, rowY, colWidth, cellHeight, 'F')
      }

      // Cell border
      doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.15)
      doc.rect(colX, rowY, colWidth, cellHeight, 'D')

      if (isCurrentMonth) {
        // Date number in top right
        doc.setFont('helvetica', 'bold').setFontSize(7.5)
        if (c === 6) {
          doc.setTextColor(220, 38, 38) // Red for Sunday
        } else {
          doc.setTextColor(...COLORS.textDark)
        }
        doc.text(String(dayNum), colX + colWidth - 2, rowY + 3.8, { align: 'right' })

        // Render agenda badges for this date
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
        const dayAgendas = agendaMap.get(dateKey) || []

        if (dayAgendas.length > 0) {
          let itemY = rowY + 5.2
          const maxDisplay = cellHeight > 19 ? 3 : 2

          for (let i = 0; i < Math.min(dayAgendas.length, maxDisplay); i++) {
            const ag = dayAgendas[i]
            const badgeW = colWidth - 2.5
            // Subtle pill background
            doc.setFillColor(...COLORS.accentBlue)
            doc.roundedRect(colX + 1.25, itemY - 2.2, badgeW, 3.4, 0.6, 0.6, 'F')

            // Badge text
            doc.setFont('helvetica', 'bold').setFontSize(5.5).setTextColor(...COLORS.softBlue)
            const maxChars = 14
            const displayTitle = ag.title.length > maxChars ? ag.title.slice(0, maxChars - 2) + '..' : ag.title
            doc.text(`[#${ag.refNum}] ${displayTitle}`, colX + 2, itemY)
            itemY += 3.8
          }

          if (dayAgendas.length > maxDisplay) {
            doc.setFont('helvetica', 'italic').setFontSize(5).setTextColor(...COLORS.textSecondary)
            doc.text(`+${dayAgendas.length - maxDisplay} lainnya`, colX + 2, itemY)
          }
        }
      }
    }
  }

  return currentY + (totalRows * cellHeight) + 8
}

/**
 * Render content blocks (paragraph, checklist, list-item)
 */
function renderContentBlocks(
  doc: jsPDF,
  blocks: CatatanBlock[],
  currentY: number,
  startX: number,
  maxWidth: number,
  docTitle: string
): number {
  let y = currentY
  const lineHeight = 4.2

  for (const block of blocks) {
    if (!block.text && block.type === 'paragraph') continue

    if (block.type === 'checklist') {
      const isChecked = Boolean(block.checked)
      const boxSize = 2.6
      const textX = startX + boxSize + 2.2
      const textWidth = maxWidth - boxSize - 2.2

      // Check space for at least 1 line
      y = ensureVerticalSpace(doc, y, lineHeight + 1, docTitle)

      // Draw vector checkbox
      const boxY = y - 2.3
      if (isChecked) {
        doc.setFillColor(...COLORS.softBlue)
        doc.setDrawColor(...COLORS.softBlue)
        doc.roundedRect(startX, boxY, boxSize, boxSize, 0.5, 0.5, 'FD')
        // White checkmark
        doc.setDrawColor(255, 255, 255).setLineWidth(0.4)
        doc.line(startX + 0.5, boxY + 1.2, startX + 1.0, boxY + 1.9)
        doc.line(startX + 1.0, boxY + 1.9, startX + 2.0, boxY + 0.6)
      } else {
        doc.setDrawColor(...COLORS.textSecondary).setLineWidth(0.3)
        doc.roundedRect(startX, boxY, boxSize, boxSize, 0.5, 0.5, 'D')
      }

      // Checkbox text
      doc.setFont('helvetica', isChecked ? 'normal' : 'normal').setFontSize(8.5)
      doc.setTextColor(...(isChecked ? COLORS.textSecondary : COLORS.textDark))

      const lines = doc.splitTextToSize(block.text || '', textWidth)
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          y = ensureVerticalSpace(doc, y, lineHeight, docTitle)
        }
        doc.text(lines[i], textX, y)
        y += lineHeight
      }
      y += 1
    } else if (block.type === 'list-item') {
      const bulletX = startX + 1.2
      const textX = startX + 4
      const textWidth = maxWidth - 4

      y = ensureVerticalSpace(doc, y, lineHeight + 1, docTitle)

      // Bullet dot
      doc.setFillColor(...COLORS.softBlue)
      doc.circle(bulletX, y - 1.0, 0.7, 'F')

      // Text
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...COLORS.textDark)
      const lines = doc.splitTextToSize(block.text || '', textWidth)
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          y = ensureVerticalSpace(doc, y, lineHeight, docTitle)
        }
        doc.text(lines[i], textX, y)
        y += lineHeight
      }
      y += 1
    } else {
      // Paragraph
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...COLORS.textDark)
      const lines = doc.splitTextToSize(block.text || '', maxWidth)
      for (let i = 0; i < lines.length; i++) {
        y = ensureVerticalSpace(doc, y, lineHeight, docTitle)
        doc.text(lines[i], startX, y)
        y += lineHeight
      }
      y += 1.2
    }
  }

  return y
}

/**
 * Main function to generate and download Catatan PDF
 */
export function generateCatatanPdf(notes: Catatan[], options: ExportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 210 mm
  const margin = 10
  const usableWidth = pageWidth - margin * 2 // 190 mm
  const docTitle = options.judul_dokumen?.trim() || 'Catatan Pribadi'

  // Determine period label
  const periodText = options.bulan
    ? formatBulanIndo(options.bulan)
    : (options.ids && options.ids.length > 0 ? 'Catatan Terpilih' : 'Semua Catatan')

  const printDateStr = formatTanggalCetak(new Date())

  // Create report header
  const header = createPdfReportHeader(doc, docTitle, {
    left: [
      { label: 'Periode', value: periodText },
      { label: 'Kategori', value: options.sertakan_kalender ? 'Catatan & Kalender Agenda' : 'Catatan Pribadi' },
    ],
    right: [
      { label: 'Jumlah Catatan', value: `${notes.length} catatan` },
      { label: 'Tanggal Cetak', value: printDateStr },
    ],
  })

  header.draw()
  let currentY = header.tableTop + 4

  // Separate notes by jenis
  const draftAgendas = notes
    .filter(n => n.jenis === 'draft_agenda')
    .sort((a, b) => {
      const dateA = a.tanggal_agenda || '9999-99-99'
      const dateB = b.tanggal_agenda || '9999-99-99'
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      const timeA = a.waktu_agenda || '99:99'
      const timeB = b.waktu_agenda || '99:99'
      return timeA.localeCompare(timeB)
    })

  const bebasNotes = notes
    .filter(n => n.jenis !== 'draft_agenda')
    .sort((a, b) => {
      const aPinned = a.status === 'pinned' ? 1 : 0
      const bPinned = b.status === 'pinned' ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  // Map draft agendas to reference IDs (#1, #2, ...) for calendar cross-referencing
  const agendaRefMap = new Map<number, number>()
  const agendaDateMap = new Map<string, Array<{ refNum: number; title: string }>>()

  draftAgendas.forEach((agenda, idx) => {
    const refNum = idx + 1
    agendaRefMap.set(agenda.id, refNum)
    if (agenda.tanggal_agenda) {
      const dateKey = agenda.tanggal_agenda.slice(0, 10)
      const list = agendaDateMap.get(dateKey) || []
      list.push({ refNum, title: agenda.judul || '(Tanpa Judul)' })
      agendaDateMap.set(dateKey, list)
    }
  })

  // 1. CALENDAR SECTION (if enabled)
  if (options.sertakan_kalender) {
    const targetCalendarMonth = options.bulan_kalender || options.bulan || new Date().toISOString().slice(0, 7)
    currentY = drawCalendarGrid(doc, currentY, targetCalendarMonth, agendaDateMap, docTitle)
  }

  // 2. DRAFT AGENDA SECTION
  if (draftAgendas.length > 0) {
    // Section Header
    currentY = ensureVerticalSpace(doc, currentY, 18, docTitle)
    doc.setFillColor(...COLORS.headingBlue)
    doc.rect(margin, currentY, usableWidth, 7, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255, 255, 255)
    doc.text('DAFTAR DRAFT AGENDA', margin + 4, currentY + 4.9)
    currentY += 11

    // Render each Draft Agenda
    for (const agenda of draftAgendas) {
      const refNum = agendaRefMap.get(agenda.id) || 1
      const blocks = parseIsiBlocks(agenda.isi)

      // Estimate card height
      const estimatedHeight = 22 + (blocks.length * 5)
      currentY = ensureVerticalSpace(doc, currentY, Math.min(estimatedHeight, 35), docTitle)

      doc.setFont('helvetica', 'bold').setFontSize(10)
      const titleLines = doc.splitTextToSize(agenda.judul || '(Tanpa Judul)', usableWidth - 22)
      currentY = ensureVerticalSpace(doc, currentY, titleLines.length * 4.5 + 7.5, docTitle)

      // Header row: Agenda Reference Badge & Title
      doc.setFillColor(...COLORS.accentBlue)
      doc.roundedRect(margin, currentY, 16, 5.5, 1, 1, 'F')
      doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...COLORS.softBlue)
      doc.text(`[#${refNum}]`, margin + 8, currentY + 3.8, { align: 'center' })

      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...COLORS.headingBlue)
      doc.text(titleLines, margin + 20, currentY + 4.2)
      currentY += titleLines.length * 4.5 + 3

      // Agenda Metadata (Date, Time, Location)
      const dateText = formatTanggalIndo(agenda.tanggal_agenda)
      const timeText = agenda.waktu_agenda ? agenda.waktu_agenda.slice(0, 5) : null
      const locText = agenda.tempat_agenda?.trim()

      const metaParts: string[] = []
      if (agenda.tanggal_agenda) metaParts.push(`Tanggal: ${dateText}`)
      if (timeText) metaParts.push(`Waktu: ${timeText} WIB`)
      if (locText) metaParts.push(`Tempat: ${locText}`)

      if (metaParts.length > 0) {
        doc.setFillColor(...COLORS.bgLight)
        doc.setDrawColor(...COLORS.borderCard).setLineWidth(0.2)
        doc.roundedRect(margin, currentY, usableWidth, 6, 1, 1, 'FD')

        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...COLORS.textSecondary)
        doc.text(metaParts.join('   |   '), margin + 3.5, currentY + 4.2)
        currentY += 8
      }

      // Agenda Content Blocks
      if (blocks.length > 0) {
        currentY = renderContentBlocks(doc, blocks, currentY, margin + 2, usableWidth - 4, docTitle)
      }

      // Labels
      if (agenda.label && agenda.label.length > 0) {
        currentY = ensureVerticalSpace(doc, currentY, 5, docTitle)
        doc.setFont('helvetica', 'italic').setFontSize(7).setTextColor(...COLORS.textSecondary)
        doc.text(`Label: ${agenda.label.join(', ')}`, margin + 2, currentY + 3)
        currentY += 5
      }

      // Divider line
      currentY += 2
      doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.15)
      doc.line(margin, currentY, margin + usableWidth, currentY)
      currentY += 6
    }
  }

  // 3. CATATAN BEBAS SECTION
  if (bebasNotes.length > 0) {
    // Section Header
    currentY = ensureVerticalSpace(doc, currentY, 18, docTitle)
    doc.setFillColor(...COLORS.headingBlue)
    doc.rect(margin, currentY, usableWidth, 7, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255, 255, 255)
    doc.text('CATATAN', margin + 4, currentY + 4.9)
    currentY += 11

    // Render each Note
    for (const note of bebasNotes) {
      const blocks = parseIsiBlocks(note.isi)
      const estimatedHeight = 18 + (blocks.length * 5)
      currentY = ensureVerticalSpace(doc, currentY, Math.min(estimatedHeight, 30), docTitle)

      // Note Title
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...COLORS.headingBlue)
      const titleLines = doc.splitTextToSize(note.judul || '(Tanpa Judul)', usableWidth - 25)
      currentY = ensureVerticalSpace(doc, currentY, titleLines.length * 4.5 + 6.5, docTitle)
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...COLORS.headingBlue)
      doc.text(titleLines, margin + 2, currentY + 4)

      // Status Badge (Pinned / Archived)
      if (note.status === 'pinned') {
        doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...COLORS.softBlue)
        doc.text('[Disematkan]', margin + usableWidth - 2, currentY + 4, { align: 'right' })
      } else if (note.status === 'archived') {
        doc.setFont('helvetica', 'italic').setFontSize(6.5).setTextColor(...COLORS.textSecondary)
        doc.text('[Diarsipkan]', margin + usableWidth - 2, currentY + 4, { align: 'right' })
      }
      currentY += titleLines.length * 4.5 + 2

      // Note Metadata
      const updatedText = `Terakhir diubah: ${formatTanggalIndo(note.updated_at)}`
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...COLORS.textSecondary)
      doc.text(updatedText, margin + 2, currentY + 1)
      currentY += 5

      // Note Content Blocks
      if (blocks.length > 0) {
        currentY = renderContentBlocks(doc, blocks, currentY, margin + 2, usableWidth - 4, docTitle)
      }

      // Labels
      if (note.label && note.label.length > 0) {
        currentY = ensureVerticalSpace(doc, currentY, 5, docTitle)
        doc.setFont('helvetica', 'italic').setFontSize(7).setTextColor(...COLORS.textSecondary)
        doc.text(`Label: ${note.label.join(', ')}`, margin + 2, currentY + 3)
        currentY += 5
      }

      // Divider line
      currentY += 2
      doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.15)
      doc.line(margin, currentY, margin + usableWidth, currentY)
      currentY += 6
    }
  }

  // 4. RUNNING FOOTER & PAGE NUMBERING ON ALL PAGES
  const totalPages = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    // Footer divider line
    doc.setDrawColor(...COLORS.gridLines).setLineWidth(0.2)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    // Left branding
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...COLORS.textSecondary)
    doc.text('ACCA — Catatan Saya', margin, pageHeight - 7)

    // Centered page numbering
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: 'center' })

    // Right print date
    doc.text(printDateStr, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  // 5. SAVE PDF
  const cleanTitle = (options.judul_dokumen || 'catatan-saya')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'catatan'
  const periodSlug = options.bulan ? `-${options.bulan}` : ''
  const filename = `${cleanTitle}${periodSlug}.pdf`

  doc.save(filename)
}
