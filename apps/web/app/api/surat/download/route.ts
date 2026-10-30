/**
 * Unduh berkas surat sebagai lampiran (attachment).
 *
 * Tombol unduh di halaman Daftar Surat dulu menunjuk langsung ke file_url,
 * sehingga browser membuka viewer PDF bawaan di tab baru dan alamat asli
 * penyimpanan (Supabase/R2/Drive) terlihat di address bar. Route ini mem-proxy
 * berkasnya dan memaksa Content-Disposition: attachment supaya langsung tersimpan.
 *
 * Mengikuti pola /api/ketidakhadiran/pdf-preview: pemanggil hanya mengirim ?id=
 * surat, alamat berkas diambil dari database — jangan pernah menerima URL bebas
 * dari query, karena itu menjadikan server ini proxy terbuka.
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { getApiUser } from '@/lib/api-auth';
import { fetchSafeFile } from '@/lib/proxy-guard';
import { suratFileName } from '@acca/shared/surat-document.cjs';

/** Ubah tautan tampilan Google Drive jadi tautan unduh langsung. */
function toDirectUrl(url: string): string {
    if (!url.includes('drive.google.com')) return url;
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : url;
}

export async function GET(request: NextRequest) {
    try {
        const user = await getApiUser(request);
        if (!user) {
            return new NextResponse('Tidak terautentikasi', { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return new NextResponse('Parameter id wajib diisi', { status: 400 });
        }

        const token = extractRequestToken(request);
        const { status, body } = await nestFetchAsUser(`/surat/items/${id}`, token || '');
        const data = body?.data;

        const fileUrl = data?.file_url;
        if (status !== 200 || !fileUrl) {
            return new NextResponse('Berkas surat tidak ditemukan', { status: 404 });
        }

        let upstream: Response;
        try {
            upstream = await fetchSafeFile(toDirectUrl(fileUrl));
        } catch (fetchErr: any) {
            console.error('[Download Surat] fetchSafeFile failed:', fetchErr?.message);
            return new NextResponse(fetchErr?.message || 'Gagal mengambil berkas dari penyimpanan', { status: 400 });
        }

        if (!upstream.ok) {
            return new NextResponse('Gagal mengambil berkas dari penyimpanan', { status: upstream.status });
        }

        const buffer = await upstream.arrayBuffer();
        const fileName = suratFileName(data?.nomor_surat, data?.perkara);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': upstream.headers.get('content-type') || 'application/pdf',
                // filename* (RFC 5987) supaya nomor surat dengan karakter non-ASCII tetap utuh
                'Content-Disposition':
                    `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; ` +
                    `filename*=UTF-8''${encodeURIComponent(fileName)}`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (e: any) {
        return new NextResponse(e?.message || 'Gagal mengunduh berkas', { status: 500 });
    }
}
