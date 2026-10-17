import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractRequestToken, verifyAppSession } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const user = await verifyAppSession(token);
        if (!user) {
            return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');
        const all = searchParams.get('all') === 'true';
        const nip = searchParams.get('nip');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const where: any = {};

        if (!all) {
            if (from && to) {
                where.tanggal = {
                    gte: new Date(from),
                    lte: new Date(to),
                };
            } else if (month && year) {
                const m = parseInt(month, 10);
                const y = parseInt(year, 10);
                if (!isNaN(m) && !isNaN(y)) {
                    const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
                    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
                    where.tanggal = {
                        gte: startDate,
                        lte: endDate,
                    };
                }
            } else if (year) {
                const y = parseInt(year, 10);
                if (!isNaN(y)) {
                    const startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
                    const endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
                    where.tanggal = {
                        gte: startDate,
                        lte: endDate,
                    };
                }
            }
        }

        if (nip) {
            where.nip = String(nip).trim();
        }

        const allData = await prisma.jurnal_guru.findMany({
            where,
            orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
        });

        // Aggregation Logic
        const teacherStats: Record<string, any> = {};
        const globalStats: Record<string, number> = {};

        allData.forEach((entry: any) => {
            const tglStr = entry.tanggal instanceof Date
                ? entry.tanggal.toISOString().split('T')[0]
                : String(entry.tanggal || '').split('T')[0];

            const updateTeacherStats = (name: string, cat: string, isSubstitute: boolean) => {
                if (!name || name === '-') return;

                if (!teacherStats[name]) {
                    teacherStats[name] = {
                        nama: name,
                        nip: isSubstitute ? '-' : entry.nip,
                        categories: {},
                        total: 0,
                        details: []
                    };
                }

                if (!teacherStats[name].categories[cat]) {
                    teacherStats[name].categories[cat] = 0;
                }
                teacherStats[name].categories[cat]++;
                teacherStats[name].total++;

                teacherStats[name].details.push({
                    id: entry.id,
                    tanggal: tglStr,
                    jam_ke: entry.jam_ke,
                    kelas: entry.kelas,
                    mata_pelajaran: entry.mata_pelajaran,
                    materi: entry.materi,
                    kategori: cat,
                    status_pengganti: entry.status_pengganti,
                    keterangan: isSubstitute
                        ? `Menggantikan ${entry.nama_guru}`
                        : (entry.keterangan_tambahan || '')
                });

                if (!globalStats[cat]) {
                    globalStats[cat] = 0;
                }
                globalStats[cat]++;
            };

            // 1. Main Teacher
            const mainTeacherName = entry.nama_guru || 'Unknown';
            const mainCategory = entry.kategori_kehadiran || 'NORMAL';
            updateTeacherStats(mainTeacherName, mainCategory, false);

            // 2. Substitute Teacher (if exists)
            if (entry.guru_pengganti && entry.guru_pengganti !== '-' && entry.guru_pengganti.trim() !== '') {
                const subName = entry.guru_pengganti.trim();
                let subCategory = entry.status_pengganti;
                if (!subCategory || subCategory === '-' || subCategory.trim() === '') {
                    subCategory = 'Diganti';
                }
                updateTeacherStats(subName, subCategory, true);
            }
        });

        return corsResponse(NextResponse.json({
            ok: true,
            success: true,
            data: {
                total: allData.length,
                details: globalStats,
                globalStats,
                teacherStats: Object.values(teacherStats).sort((a: any, b: any) => b.total - a.total),
                rawCount: allData.length
            }
        }));
    } catch (error: any) {
        console.error('Error fetching rekap jurnal:', error);
        return corsResponse(NextResponse.json(
            { ok: false, success: false, error: 'Failed to fetch rekap jurnal', details: error.message },
            { status: 500 }
        ));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
