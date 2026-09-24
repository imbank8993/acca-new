/**
 * GET /api/jadwal/wa-preview?peristiwa=diajukan
 *
 * Menampilkan teks WhatsApp yang AKAN dikirim untuk tiap peristiwa tukar
 * jadwal, memakai data contoh. Tidak mengirim apa pun dan tidak melihat toggle
 * `notif_wa_jadwal`, jadi aman dipanggil kapan saja — termasuk sebelum fitur
 * dinyalakan.
 *
 * Tanpa parameter: kembalikan semua peristiwa sekaligus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { pratinjauTukarJadwalWa, type PeristiwaTukar } from '@/lib/wa-tukar-jadwal';

export const dynamic = 'force-dynamic';

const SEMUA: PeristiwaTukar[] = [
    'diajukan', 'diterima_guru', 'ditolak_guru', 'disetujui_wkm', 'ditolak_wkm', 'dibatalkan',
];

/** Hanya pengelola yang boleh melihat; isinya memuat nama & NIP contoh. */
const PERAN_BOLEH = ['ADMIN', 'ADMINISTRATOR', 'WKM_AKADEMIK', 'KURIKULUM'];

/** Data contoh — sengaja fiktif agar pratinjau tidak membocorkan pengajuan nyata. */
const CONTOH = {
    jenis: 'mengajar',
    requester_nip: '000000001',
    requester_nama: 'Ahmad Fauzi, S.Pd.',
    requester_slots: [{ hari: 'Senin', jam_ke: '3', kelas: 'XI IPA 1', mapel: 'Matematika' }],
    target_nip: '000000002',
    target_nama: 'Siti Aminah, M.Pd.',
    target_slots: [{ hari: 'Rabu', jam_ke: '5', kelas: 'XI IPA 1', mapel: 'Fisika' }],
    alasan: 'Ada tugas dinas luar pada Senin pagi.',
    guru_catatan: 'Silakan, saya bisa menggantikan.',
    wkm_catatan: null,
};

export async function GET(request: NextRequest) {
    const user = await getApiUser(request);
    if (!user) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!PERAN_BOLEH.some(r => user.roles.includes(r))) {
        return NextResponse.json(
            { ok: false, error: 'Hanya pengelola yang dapat melihat pratinjau notifikasi' },
            { status: 403 },
        );
    }

    const diminta = request.nextUrl.searchParams.get('peristiwa') as PeristiwaTukar | null;
    const daftar = diminta && SEMUA.includes(diminta) ? [diminta] : SEMUA;

    const hasil = [];
    for (const peristiwa of daftar) {
        const { tautanAktif, pesan } = await pratinjauTukarJadwalWa(peristiwa, CONTOH);
        hasil.push({ peristiwa, tautanAktif, pesan });
    }

    return NextResponse.json({ ok: true, data: hasil });
}
