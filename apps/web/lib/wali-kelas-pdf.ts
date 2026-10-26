import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createPdfReportHeader, type PdfReportIdentity } from './pdf-report-header';

export interface ReportSection {
    title: string;
    head: string[];
    body: (string | number)[][];
    widths: number[];
    emptyText?: string;
    groupKey?: string;
}
export interface WaliPdfReport { title: string; identity: PdfReportIdentity; sections: ReportSection[] }

export function createWaliKelasPdf(report: WaliPdfReport) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 10;
    const blue: [number, number, number] = [34, 83, 150];
    const muted: [number, number, number] = [100, 116, 139];
    doc.setProperties({ title: report.title, author: 'ACCA', subject: 'Laporan wali kelas' });
    const header = createPdfReportHeader(doc, report.title, report.identity);
    const { tableTop } = header;
    const sections: ReportSection[] = report.sections.length ? report.sections : [{ title: 'Data', head: ['Keterangan'], body: [], widths: [277] }];
    const drawnPages = new Set<number>();
    let nextTitleY = tableTop + 3;
    sections.forEach((section, index) => {
        doc.setFont('helvetica', 'bold').setFontSize(9);
        const titleLines: string[] = doc.splitTextToSize(section.title, width - margin * 2);
        const titleHeight = titleLines.length * 4;
        if (nextTitleY + titleHeight + 25 > height - 20) {
            doc.addPage('a4', 'landscape');
            nextTitleY = tableTop + 3;
        }
        const sum = section.widths.reduce((a, b) => a + b, 0);
        autoTable(doc, {
            startY: nextTitleY + titleHeight, margin: { top: tableTop + 3 + titleHeight, bottom: 20, left: margin, right: margin }, theme: 'grid',
            head: [section.head], body: section.body.length ? section.body : [[{ content: section.emptyText || 'Belum ada data pada periode dan filter ini.', colSpan: section.head.length }]],
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.2, valign: 'top', overflow: 'linebreak', lineWidth: .15, lineColor: [208, 216, 227], textColor: [25, 44, 70] },
            headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold', valign: 'middle' }, alternateRowStyles: { fillColor: [248, 250, 253] },
            columnStyles: Object.fromEntries(section.widths.map((w, i) => [i, { cellWidth: (width - margin * 2) * w / sum }])),
            rowPageBreak: 'avoid',
            willDrawPage: data => {
                const page = doc.getCurrentPageInfo().pageNumber;
                if (!drawnPages.has(page)) {
                    header.draw();
                    drawnPages.add(page);
                }
                // Each student's heading follows its own table, including continuation pages.
                const titleY = (data.cursor?.y || tableTop + 3 + titleHeight) - titleHeight;
                doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...blue).text(titleLines, margin, titleY);
            },
        });
        const endY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
        const sameStudent = section.groupKey && sections[index + 1]?.groupKey === section.groupKey;
        nextTitleY = endY + (sameStudent ? 7 : 10);
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(218, 225, 235).setLineWidth(.2).line(margin, height - 13, width - margin, height - 13);
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...muted);
        doc.text('ACCA - Laporan wali kelas', margin, height - 8);
        doc.text(`Halaman ${p} dari ${pages}`, width - margin, height - 8, { align: 'right' });
    }
    return doc;
}
