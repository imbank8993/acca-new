/**
 * POST /api/ketidakhadiran/notify-wa
 *
 * Dua mode:
 * - { mode: 'preview' } → susun pratinjau (teks atau gambar) TANPA mengirim apa pun
 * - default             → kirim laporan ke grup WA
 *
 * Keduanya melewati jalur penyusunan yang sama (lib/whatsapp-group), jadi pratinjau
 * yang dilihat petugas benar-benar sama dengan yang diterima grup.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppGroup, previewWhatsAppGroup } from '@/lib/whatsapp-group';
import { getApiUser } from '@/lib/api-auth';

/**
 * Peran yang boleh mengirim laporan ke grup WA madrasah — sejajar dengan tombol
 * "Kirim Info" di halaman (canManageIzin/canManageSakit).
 *
 * Tanpa gerbang ini route hanya terlindungi oleh middleware yang sekadar memeriksa
 * ADANYA sesi, sehingga siapa pun yang bisa login (termasuk SISWA dan ORANG_TUA)
 * dapat menembakkan pesan sembarang ke grup atas nama petugas mana pun.
 */
const SENDER_ROLES = ['ADMIN', 'ADMINISTRATOR', 'OP_IZIN', 'OP_UKS'];

/** Batas wajar satu laporan harian; mencegah payload raksasa membanjiri grup. */
const MAX_ROWS = 500;

export async function POST(request: NextRequest) {
    try {
        const user = await getApiUser(request);
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!SENDER_ROLES.some(r => user.roles.includes(r))) {
            return NextResponse.json({
                ok: false,
                error: 'Anda tidak memiliki akses untuk mengirim laporan ketidakhadiran ke grup WhatsApp'
            }, { status: 403 });
        }

        const body = await request.json();
        const { header, rows, mode } = body;

        if (!header || !Array.isArray(rows)) {
            return NextResponse.json({ ok: false, error: 'Missing header or rows' }, { status: 400 });
        }
        if (rows.length === 0) {
            return NextResponse.json({ ok: false, error: 'Tidak ada data untuk dikirim' }, { status: 400 });
        }
        if (rows.length > MAX_ROWS) {
            return NextResponse.json({ ok: false, error: `Terlalu banyak data (maks ${MAX_ROWS} baris)` }, { status: 400 });
        }

        // Nama petugas diambil dari sesi, bukan dari body: siapa yang mengirim laporan
        // ke grup tidak boleh bisa dikarang oleh pemanggil.
        const safeHeader = {
            tanggal: String(header.tanggal || ''),
            jenis: String(header.jenis || ''),
            total: Number(header.total) || rows.length,
            petugas_nama: user.nama || user.nip || 'Petugas',
        };

        if (mode === 'preview') {
            const preview = await previewWhatsAppGroup(safeHeader, rows);
            if (!preview.ok) {
                console.error('[API Ketidakhadiran Notify] Preview failed:', preview.error);
            }
            return NextResponse.json(preview);
        }

        console.log('[API Ketidakhadiran Notify] Sending WhatsApp for:', safeHeader.tanggal);
        const result = await sendWhatsAppGroup(safeHeader, rows);

        if (!result.ok && !result.skipped) {
            console.error('[API Ketidakhadiran Notify] Send failed:', result.error);
        }

        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[API Ketidakhadiran Notify] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
