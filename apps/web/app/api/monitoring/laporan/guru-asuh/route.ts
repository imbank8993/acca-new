import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === 'object') {
        const res: any = {};
        for (const [k, v] of Object.entries(obj)) {
            res[k] = serializeBigInt(v);
        }
        return res;
    }
    return obj;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const bulan = searchParams.get('bulan');
        const tahun = searchParams.get('tahun');
        const q = searchParams.get('q')?.trim()?.toLowerCase();

        const where: any = {
            status: 'Approved',
        };

        if (bulan && bulan !== 'ALL') {
            const b = parseInt(bulan, 10);
            if (!isNaN(b)) where.bulan = b;
        }

        if (tahun && tahun !== 'ALL') {
            const t = parseInt(tahun, 10);
            if (!isNaN(t)) where.tahun = t;
        }

        const submissions = await prisma.laporan_guru_asuh_submissions.findMany({
            where,
            orderBy: [
                { tahun: 'desc' },
                { bulan: 'desc' },
                { submitted_at: 'desc' },
            ],
        });

        // Collect NIPs to fetch profile photos
        const nips = Array.from(new Set(submissions.map(s => s.nip).filter(Boolean))) as string[];
        const photoMap = new Map<string, string>();
        if (nips.length > 0) {
            const userProfiles = await prisma.public_users.findMany({
                where: {
                    OR: [
                        { nip: { in: nips } },
                        { username: { in: nips } },
                    ],
                    foto_profil: { not: null },
                },
                select: { nip: true, username: true, foto_profil: true },
            });
            for (const up of userProfiles) {
                if (up.foto_profil && !up.foto_profil.includes('file.icgowa.sch.id')) {
                    if (up.nip) photoMap.set(up.nip, up.foto_profil);
                    if (up.username) photoMap.set(up.username, up.foto_profil);
                }
            }
        }

        let results = submissions.map(s => ({
            ...s,
            foto_profil: photoMap.get(s.nip) || null,
        }));

        if (q) {
            results = results.filter(s => 
                (s.nama_guru_snap || '').toLowerCase().includes(q) ||
                (s.nip || '').toLowerCase().includes(q)
            );
        }

        return corsResponse(
            NextResponse.json({ ok: true, data: serializeBigInt(results) }),
            { publicRead: true }
        );
    } catch (error: any) {
        console.error('[monitoring/laporan/guru-asuh GET] error:', error);
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message || 'Gagal memuat data laporan guru asuh' }, { status: 500 }),
            { publicRead: true }
        );
    }
}

export async function OPTIONS() {
    return handleOptions();
}
