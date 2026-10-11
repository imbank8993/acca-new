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
            status: 'Disahkan',
        };

        if (bulan && bulan !== 'ALL') {
            const b = parseInt(bulan, 10);
            if (!isNaN(b)) where.bulan = b;
        }

        if (tahun && tahun !== 'ALL') {
            const t = parseInt(tahun, 10);
            if (!isNaN(t)) where.tahun = t;
        }

        const items = await prisma.laporan_ekskul_submissions.findMany({
            where,
            orderBy: [
                { tahun: 'desc' },
                { bulan: 'desc' },
                { submitted_at: 'desc' },
            ],
            include: {
                ekskul: {
                    select: { nama_ekskul: true },
                },
            },
        });

        // Collect pembina NIPs to fetch profile photos
        const nips = Array.from(new Set(items.map(s => s.pembina_nip).filter(Boolean))) as string[];
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

        // Calculate internal and external counts from `ekskul_pertemuan`
        const withCounts = await Promise.all(
            items.map(async (item) => {
                const pertRows = await prisma.ekskul_pertemuan.findMany({
                    where: { submission_id: item.id },
                    select: { status_pelatih: true },
                });

                let internal = 0;
                let eksternal = 0;
                pertRows.forEach((r) => {
                    if (r.status_pelatih === 'Eksternal') eksternal++;
                    else internal++;
                });

                return {
                    ...item,
                    jml_internal: internal,
                    jml_eksternal: eksternal,
                    foto_profil: (item.pembina_nip ? photoMap.get(item.pembina_nip) : null) || null,
                };
            })
        );

        let results = withCounts;
        if (q) {
            results = results.filter(s =>
                (s.pembina_nama || '').toLowerCase().includes(q) ||
                (s.pembina_nip || '').toLowerCase().includes(q) ||
                (s.ekskul?.nama_ekskul || '').toLowerCase().includes(q)
            );
        }

        return corsResponse(
            NextResponse.json({ ok: true, data: serializeBigInt(results) }),
            { publicRead: true }
        );
    } catch (error: any) {
        console.error('[monitoring/laporan/ekskul GET] error:', error);
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message || 'Gagal memuat data laporan ekstrakurikuler' }, { status: 500 }),
            { publicRead: true }
        );
    }
}

export async function OPTIONS() {
    return handleOptions();
}
