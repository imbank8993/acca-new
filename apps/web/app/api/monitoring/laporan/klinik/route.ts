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

        const slots = await prisma.klinik_slots.findMany({
            include: {
                klinik_peserta: true,
                klinik_laporan: true,
            },
            orderBy: { tanggal: 'desc' },
        });

        // Collect teacher ids to get NIP and profile
        const guruIds = Array.from(new Set(slots.map(s => Number(s.guru_id)).filter(Boolean)));
        const guruMap = new Map<number, { nip: string; nama_lengkap: string; foto_profil?: string | null }>();
        if (guruIds.length > 0) {
            const users = await (prisma as any).public_users.findMany({
                where: { id: { in: guruIds } },
                select: { id: true, nip: true, nama: true, nama_lengkap: true, foto_profil: true },
            });
            for (const u of users) {
                const photo = u.foto_profil && !u.foto_profil.includes('file.icgowa.sch.id') ? u.foto_profil : null;
                guruMap.set(Number(u.id), {
                    nip: u.nip || '-',
                    nama_lengkap: u.nama_lengkap || u.nama || '-',
                    foto_profil: photo,
                });
            }
        }

        // Filter: only approved/paid reports
        let filtered = slots.filter(s => {
            const laporan = Array.isArray(s.klinik_laporan) ? s.klinik_laporan[0] : s.klinik_laporan;
            return s.status === 'paid' || laporan?.status === 'Approved';
        });

        // Filter month & year from `tanggal`
        if (bulan && bulan !== 'ALL') {
            const b = parseInt(bulan, 10);
            filtered = filtered.filter(s => {
                if (!s.tanggal) return false;
                const d = new Date(s.tanggal);
                return (d.getMonth() + 1) === b;
            });
        }

        if (tahun && tahun !== 'ALL') {
            const t = parseInt(tahun, 10);
            filtered = filtered.filter(s => {
                if (!s.tanggal) return false;
                const d = new Date(s.tanggal);
                return d.getFullYear() === t;
            });
        }

        let results = filtered.map(s => {
            const gInfo = s.guru_id ? guruMap.get(Number(s.guru_id)) : null;
            const laporan = Array.isArray(s.klinik_laporan) ? s.klinik_laporan[0] : s.klinik_laporan;
            return {
                id: s.id,
                guru_id: s.guru_id,
                nama_guru: gInfo?.nama_lengkap && gInfo.nama_lengkap !== '-' ? gInfo.nama_lengkap : s.nama_guru,
                nip: gInfo?.nip || '-',
                foto_profil: gInfo?.foto_profil || null,
                mapel: s.mapel,
                topik: s.topik,
                tanggal: s.tanggal,
                jam_mulai: s.jam_mulai,
                jam_selesai: s.jam_selesai,
                ruangan: s.ruangan,
                status: s.status,
                laporan_id: laporan?.id || null,
                laporan_status: laporan?.status || null,
                approved_by_name: laporan?.approved_by_name || null,
                approved_at: laporan?.approved_at || null,
                total_peserta: s.klinik_peserta?.length || 0,
            };
        });

        if (q) {
            results = results.filter(s =>
                (s.nama_guru || '').toLowerCase().includes(q) ||
                (s.nip || '').toLowerCase().includes(q) ||
                (s.mapel || '').toLowerCase().includes(q) ||
                (s.topik || '').toLowerCase().includes(q)
            );
        }

        return corsResponse(
            NextResponse.json({ ok: true, data: serializeBigInt(results) }),
            { publicRead: true }
        );
    } catch (error: any) {
        console.error('[monitoring/laporan/klinik GET] error:', error);
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message || 'Gagal memuat data laporan klinik' }, { status: 500 }),
            { publicRead: true }
        );
    }
}

export async function OPTIONS() {
    return handleOptions();
}
