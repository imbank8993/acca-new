import { NextRequest, NextResponse } from 'next/server';
import { buildRekapKlinik, BULAN } from '@/lib/klinik/rekap-report';
import { prisma } from '@/lib/prisma';
import { getPublicOrigin } from '@/lib/public-url';

/**
 * GET /api/klinik/verify/rekap
 * Endpoint publik untuk memverifikasi keabsahan dokumen Rekap Bulanan Klinik Pembelajaran
 * yang diakses melalui pemindaian QR Code pada lembar cetak dokumen.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const bulan = parseInt(searchParams.get('bulan') || '', 10);
        const tahun = parseInt(searchParams.get('tahun') || '', 10);
        const sah = searchParams.get('sah') !== '0';

        if (!bulan || isNaN(bulan) || !tahun || isNaN(tahun) || bulan < 1 || bulan > 12) {
            return NextResponse.json(
                { ok: false, error: 'Parameter bulan dan tahun tidak valid' },
                { status: 400 }
            );
        }

        const origin = request.nextUrl.origin || getPublicOrigin();
        const result = await buildRekapKlinik({
            bulan,
            tahun,
            hanyaDisetujui: sah,
            origin,
        });

        if (!result.ok) {
            return NextResponse.json(
                { ok: false, error: result.error },
                { status: result.status }
            );
        }

        const profil = await prisma.profil_sekolah.findFirst();
        const namaBulan = BULAN[bulan - 1] || String(bulan);
        const kodeVerifikasi = `KLN-REKAP-${tahun}${String(bulan).padStart(2, '0')}`;

        return NextResponse.json({
            ok: true,
            verified: true,
            data: {
                bulan,
                tahun,
                namaBulan,
                periode: `${namaBulan} ${tahun}`,
                kodeVerifikasi,
                jumlahSesi: result.jumlahSesi,
                jumlahGuru: result.jumlahGuru,
                jumlahFoto: result.jumlahFoto,
                disahkanOleh: 'WKM Bidang Akademik',
                sekolah: profil?.nama || 'Madrasah',
                logoUrl: profil?.logo_url || null,
            },
            html: result.html,
        });
    } catch (err: any) {
        console.error('[verify rekap error]:', err);
        return NextResponse.json(
            { ok: false, error: err?.message || 'Gagal memverifikasi dokumen' },
            { status: 500 }
        );
    }
}
