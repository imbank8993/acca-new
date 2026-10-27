import { extractRequestToken } from '@/lib/app-jwt';
import { NextRequest, NextResponse } from 'next/server';
import { processPtspWaQueue } from '@/lib/ptsp-wa';

export const dynamic = 'force-dynamic';

/**
 * Proses manual antrean WhatsApp PTSP (ptsp_wa_log) oleh pengguna yang login.
 * Sebelumnya route ini meneruskan ke NestJS `notifyWa` yang hanya menghitung antrean
 * tanpa mengirim apa pun. Pengiriman kini dilakukan di proses web ini karena sesi
 * Baileys hanya hidup di sini. Antrean juga diproses otomatis tiap 1 menit (instrumentation.ts).
 */
export async function GET(request: NextRequest) {
  if (!extractRequestToken(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  try {
    const result = await processPtspWaQueue(Number.isNaN(limit) ? 50 : limit);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[PTSP-WA] Gagal memproses antrean:', err);
    return NextResponse.json({ ok: false, error: 'Gagal memproses antrean WhatsApp PTSP' }, { status: 500 });
  }
}
