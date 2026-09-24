import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

/**
 * Daftar surat ACCA (surat keterangan ketidakhadiran).
 *
 * Sebelumnya GET memakai `nestFetch`, yang mengirim `x-internal-key` dan melewati
 * guard di backend — sehingga daftar ini terbuka TANPA LOGIN. Isinya data pribadi:
 * jenis izin, kategori, keterangan, nomor surat, dan `file_url`.
 *
 * Yang membuatnya lebih berat: responsnya juga memuat `barcode`, dan barcode itulah
 * kunci `GET /api/ketidakhadiran/pdf-preview`. Barcode-nya sendiri acak 14 karakter
 * sehingga tidak bisa ditebak — tapi bocor lewat sini, jadi seluruh berkas suratnya
 * ikut bisa diunduh tanpa akun. Menutup daftar ini memulihkan asumsi yang mendasari
 * alur verifikasi QR: barcode hanya diketahui pemegang suratnya.
 */
export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const { status, body } = await nestFetchAsUser(
            `/ketidakhadiran/acca-letter?${searchParams.toString()}`,
            token,
        );
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyData = await request.json();
        const { status, body } = await nestFetchAsUser('/ketidakhadiran/acca-letter', token, {
            method: 'POST',
            body: JSON.stringify(bodyData),
        });
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}