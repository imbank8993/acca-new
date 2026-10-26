import type { jsPDF } from 'jspdf';
import { APP_LOGO_DATA_URI } from './branding-logo';

export interface PdfHeaderField { label: string; value: string }
export interface PdfReportIdentity { left: PdfHeaderField[]; right: PdfHeaderField[] }

export function createPdfReportHeader(doc: jsPDF, title: string, identity: PdfReportIdentity) {
    const width = doc.internal.pageSize.getWidth(), margin = 10;
    const columnWidth = (width - margin * 2 - 12) / 2;
    const logo = doc.getImageProperties(APP_LOGO_DATA_URI);
    const logoHeight = 6, logoWidth = logoHeight * logo.width / logo.height;
    doc.setFont('helvetica', 'bold').setFontSize(12);
    const titleLines: string[] = doc.splitTextToSize(title.toUpperCase(), width - margin * 2 - logoWidth - 3);
    const titleWidth = Math.max(...titleLines.map(line => doc.getTextWidth(line)));
    const titleHeight = Math.max(logoHeight, titleLines.length * 4.7);
    const headingX = (width - logoWidth - 3 - titleWidth) / 2;
    doc.setFont('helvetica', 'normal').setFontSize(8);
    function column(fields: PdfHeaderField[], right = false) {
        const labelWidth = Math.max(0, ...fields.map(field => doc.getTextWidth(field.label)));
        const colonOffset = labelWidth + 2, valueOffset = colonOffset + 3;
        const valueWidth = Math.min(columnWidth - valueOffset, Math.max(1, ...fields.map(field => doc.getTextWidth(field.value) + 2)));
        const x = right ? width - margin - valueOffset - valueWidth : margin;
        return { x, colonX: x + colonOffset, valueX: x + valueOffset, valueWidth };
    }
    const leftColumn = column(identity.left), rightColumn = column(identity.right, true);
    let y = 10 + titleHeight + 8;
    const rows = Array.from({ length: Math.max(2, identity.left.length, identity.right.length) }, (_, index) => {
        const left = identity.left[index], right = identity.right[index];
        const leftLines: string[] = left ? doc.splitTextToSize(left.value, leftColumn.valueWidth) : [];
        const rightLines: string[] = right ? doc.splitTextToSize(right.value, rightColumn.valueWidth) : [];
        const row = { left, right, leftLines, rightLines, y };
        y += Math.max(leftLines.length, rightLines.length, 1) * 3.6 + .6;
        return row;
    });
    const tableTop = Math.max(30, y + 4);
    return {
        tableTop,
        draw() {
            doc.addImage(APP_LOGO_DATA_URI, 'PNG', headingX, 10 + (titleHeight - logoHeight) / 2, logoWidth, logoHeight);
            doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(34, 83, 150);
            doc.text(titleLines, headingX + logoWidth + 3, 10 + titleHeight / 2 - (titleLines.length - 1) * 4.7 / 2 + 1.5);
            doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100, 116, 139);
            for (const row of rows) {
                if (row.left) {
                    doc.text(row.left.label, leftColumn.x, row.y);
                    doc.text(':', leftColumn.colonX, row.y);
                    doc.text(row.leftLines, leftColumn.valueX, row.y);
                }
                if (row.right) {
                    doc.text(row.right.label, rightColumn.x, row.y);
                    doc.text(':', rightColumn.colonX, row.y);
                    doc.text(row.rightLines, rightColumn.valueX, row.y);
                }
            }
            doc.setDrawColor(190, 208, 232).setLineWidth(.25).line(margin, tableTop - 5, width - margin, tableTop - 5);
        },
    };
}
