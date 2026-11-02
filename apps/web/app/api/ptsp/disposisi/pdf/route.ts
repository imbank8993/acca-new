import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { letterAttachments, letterDate, letterFields } from '@/lib/ptsp-letter';
import { jsPDF } from 'jspdf';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id') || '';
    const { status, body } = await nestFetchAsUser('/ptsp/disposisi?id=' + encodeURIComponent(id), extractRequestToken(req) || '');
    if (status !== 200 || !body?.ok) return NextResponse.json(body, { status });
    const row = body.data;
    const pdf = new jsPDF();
    let y = 22;
    const line = (label: string, value: unknown) => {
        const lines = pdf.splitTextToSize(`${label}: ${String(value ?? '-')}`, 170);
        for (const part of lines) {
            if (y > 275) { pdf.addPage(); y = 22; }
            pdf.text(part, 20, y); y += 6;
        }
        y += 3;
    };
    pdf.setFontSize(17); pdf.setTextColor(20, 53, 89);
    pdf.text('PEMBERITAHUAN SURAT MASUK', 20, y); y += 9;
    pdf.setFontSize(10); pdf.setTextColor(70);
    pdf.text('Layanan Terpadu Satu Pintu', 20, y); y += 12;
    pdf.setTextColor(30);
    line('Referensi', row.id.slice(0, 8).toUpperCase());
    line('Diterima', letterDate(row.created_at) + ' WITA');
    line('Pengirim', row.sender_name); line('Penerima', row.recipient_name);
    line('Pesan', row.instructions);
    for (const field of letterFields(row.snapshot)) line(field.label, field.value);
    const files = letterAttachments(row.snapshot);
    line('Lampiran', files.length ? `${files.length} berkas (tersedia di halaman layanan PTSP)` : 'Tidak ada lampiran');
    for (const file of files) line(file.label, file.url);
    return new NextResponse(new Uint8Array(pdf.output('arraybuffer')), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Surat-Masuk-PTSP-${row.id}.pdf"`, 'Cache-Control': 'private, no-store' },
    });
}
