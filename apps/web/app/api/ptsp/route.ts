import { NextRequest, NextResponse, after } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { deleteFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const PTSP_TABLES: Record<string, string> = {
    ptsp_buku_tamu:        'Buku Tamu',
    ptsp_izin_magang:      'Izin Magang',
    ptsp_izin_siswa:       'Izin Siswa Asrama',
    ptsp_legalisir:        'Legalisir Dokumen',
    ptsp_mutasi_siswa:     'Mutasi Siswa',
    ptsp_pengganti_ijazah: 'Pengganti Ijazah',
    ptsp_sosialisasi:      'Sosialisasi',
    ptsp_master_tracking:  'Tracking',
    ptsp_peminjaman_sarana:'Peminjaman Sarana',
    ptsp_izin_penelitian:  'Izin Penelitian',
    ptsp_pengaduan:        'Pengaduan',
};

export async function GET(request: NextRequest) {
    const token = extractRequestToken(request);
    const search = request.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ptsp${search}`, token || '');
    return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
    const token = extractRequestToken(request);
    const body = await request.json();
    const { status, body: result } = await nestFetchAsUser('/ptsp', token || '', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    // Perubahan status mengantrekan notifikasi WA di API; kirim segera setelah respons
    // dikembalikan agar petugas tidak menunggu provider WhatsApp.
    if ((status === 200 || status === 201) && body && 'status' in (body.data || {})) {
        after(async () => {
            try {
                const { processPtspWaQueue } = await import('@/lib/ptsp-wa');
                await processPtspWaQueue(10);
            } catch (err) {
                console.error('[PTSP-WA] Gagal memproses antrean setelah update status:', err);
            }
        });
    }
    return NextResponse.json(result, { status });
}

export async function DELETE(request: NextRequest) {
    const token = extractRequestToken(request);
    const search = request.nextUrl.search;
    const { status, body } = await nestFetchAsUser(`/ptsp${search}`, token || '', {
        method: 'DELETE',
    });

    // Cleanup physical files from storage if row contained any
    if (status === 200 && body?.row) {
        const fileUrls = Object.entries(body.row)
            .filter(([k, v]) => /^file(_|$)/.test(k) && typeof v === 'string' && v.startsWith('http'))
            .map(([, v]) => v as string);
        for (const url of fileUrls) {
            try {
                await deleteFile(url);
            } catch (err) {
                console.error('[ptsp DELETE] Gagal hapus file storage:', url, err);
            }
        }
    }

    return NextResponse.json(body, { status });
}

