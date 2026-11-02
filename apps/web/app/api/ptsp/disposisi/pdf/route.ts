import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { jsPDF } from 'jspdf';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  const { status, body } = await nestFetchAsUser('/ptsp/disposisi?id=' + encodeURIComponent(id), extractRequestToken(req) || '');
  if (status !== 200 || !body?.ok) return NextResponse.json(body, { status });
  const row = body.data;
  const pdf = new jsPDF(); let y = 22;
  const line = (label: string, value: unknown) => {
    const text = pdf.splitTextToSize(`${label}: ${String(value ?? '-')}`, 170);
    for (const part of text) { if (y > 275) { pdf.addPage(); y = 22; } pdf.text(part, 20, y); y += 6; }
    y += 3;
  };
  pdf.setFontSize(18); pdf.setTextColor(20, 53, 89); pdf.text('LEMBAR DISPOSISI PTSP', 20, y); y += 12;
  pdf.setFontSize(10); pdf.setTextColor(30);
  line('Nomor', row.id); line('Tanggal', new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) + ' WITA');
  line('Dari', row.sender_name); line('Kepada', row.recipient_name); line('Instruksi', row.instructions);
  line('Status', row.status); line('Tindak lanjut', row.follow_up || '-');
  for (const [key, value] of Object.entries(row.snapshot || {})) {
    if (value == null || ['tracking_token', 'storage_type', 'is_edited', 'edit_count'].includes(key)) continue;
    line(key.replace(/_/g, ' ').toUpperCase(), value);
  }
  return new NextResponse(new Uint8Array(pdf.output('arraybuffer')), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Disposisi-PTSP-${row.id}.pdf"`, 'Cache-Control': 'private, no-store' } });
}
