import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractRequestToken, verifyAppToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseDateString(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [d, m, y] = s.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const user = await verifyAppToken(token);
        if (!user) {
            return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const bodyData = await request.json();
        const data = Array.isArray(bodyData) ? bodyData : bodyData?.data;

        if (!Array.isArray(data) || data.length === 0) {
            return corsResponse(NextResponse.json({
                success: false,
                error: 'Data import kosong atau bukan berupa array',
                results: { total: 0, success: 0, failed: 0, skipped: 0, errors: [] }
            }, { status: 400 }));
        }

        const results = {
            total: data.length,
            success: 0,
            failed: 0,
            skipped: 0,
            errors: [] as string[]
        };

        for (let idx = 0; idx < data.length; idx++) {
            const row = data[idx];
            try {
                const dateStr = parseDateString(row.tanggal);
                const kelas = String(row.kelas || '').trim();
                const nama_guru = String(row.nama_guru || '').trim();
                const nip = String(row.nip || '').trim();
                const mata_pelajaran = String(row.mata_pelajaran || row.mapel || '').trim();

                if (!dateStr || !kelas || (!nama_guru && !nip) || !mata_pelajaran) {
                    throw new Error(`Baris ${idx + 1}: Data wajib tidak lengkap (tanggal, kelas, guru, mapel)`);
                }

                // Parse jam_ke_id and jam_ke
                const hoursToProcess: number[] = [];
                const jamIdCol = String(row.jam_ke_id || '').trim();

                if (jamIdCol) {
                    if (jamIdCol.includes('-')) {
                        const [s, e] = jamIdCol.split('-').map(n => parseInt(n.trim(), 10));
                        if (!isNaN(s) && !isNaN(e)) for (let i = s; i <= e; i++) hoursToProcess.push(i);
                    } else if (jamIdCol.includes(',')) {
                        hoursToProcess.push(...jamIdCol.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)));
                    } else {
                        const n = parseInt(jamIdCol, 10);
                        if (!isNaN(n)) hoursToProcess.push(n);
                    }
                }

                if (hoursToProcess.length === 0) {
                    const jamStr = String(row.jam_ke || '').trim();
                    const rangeMatch = jamStr.match(/\((\d+(?:-\d+)?(?:,\d+)*)\)/);
                    if (rangeMatch) {
                        const inner = rangeMatch[1];
                        if (inner.includes('-')) {
                            const [s, e] = inner.split('-').map(n => parseInt(n.trim(), 10));
                            if (!isNaN(s) && !isNaN(e)) for (let i = s; i <= e; i++) hoursToProcess.push(i);
                        } else if (inner.includes(',')) {
                            hoursToProcess.push(...inner.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)));
                        } else {
                            const n = parseInt(inner, 10);
                            if (!isNaN(n)) hoursToProcess.push(n);
                        }
                    } else if (/^\d+$/.test(jamStr)) {
                        hoursToProcess.push(parseInt(jamStr, 10));
                    } else if (jamStr.includes('-')) {
                        const [s, e] = jamStr.split('-').map(n => parseInt(n.trim(), 10));
                        if (!isNaN(s) && !isNaN(e) && s <= 20 && e <= 20) {
                            for (let i = s; i <= e; i++) hoursToProcess.push(i);
                        }
                    } else if (jamStr.includes(',')) {
                        hoursToProcess.push(...jamStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
                    }
                }

                if (hoursToProcess.length === 0) {
                    hoursToProcess.push(1);
                }

                const [y, m, d] = dateStr.split('-').map(Number);
                const dateObj = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
                const hari = row.hari || DAYS[dateObj.getUTCDay()];

                for (const jamId of hoursToProcess) {
                    const payload: any = {
                        nip: nip || '-',
                        nama_guru: nama_guru || '-',
                        hari,
                        tanggal: dateObj,
                        jam_ke: String(row.jam_ke || jamId),
                        jam_ke_id: jamId,
                        kelas,
                        mata_pelajaran,
                        kategori_kehadiran: String(row.kategori_kehadiran || 'Sesuai').trim(),
                        materi: row.materi ? String(row.materi).trim() : null,
                        refleksi: row.refleksi ? String(row.refleksi).trim() : null,
                        guru_pengganti: row.guru_pengganti ? String(row.guru_pengganti).trim() : null,
                        status_pengganti: row.status_pengganti ? String(row.status_pengganti).trim() : null,
                        guru_piket: row.guru_piket ? String(row.guru_piket).trim() : null,
                        keterangan_tambahan: row.keterangan_tambahan ? String(row.keterangan_tambahan).trim() : (row.keterangan_terlambat ? String(row.keterangan_terlambat).trim() : null),
                        filled_by: row.filled_by || 'ADMIN',
                        is_generated: false,
                        nisn: row.nisn || null,
                        durasi_terlambat: row.durasi_terlambat != null && row.durasi_terlambat !== '' ? parseInt(row.durasi_terlambat, 10) : null,
                        durasi_keluar_awal: row.durasi_keluar_awal != null && row.durasi_keluar_awal !== '' ? parseInt(row.durasi_keluar_awal, 10) : null,
                        kategori_kehadiran_tambahan: row.kategori_kehadiran_tambahan || null,
                        status_tambahan_1: row.status_tambahan_1 || null,
                        status_tambahan_2: row.status_tambahan_2 || null,
                        status_tambahan_3: row.status_tambahan_3 || null,
                        updated_at: new Date(),
                    };

                    await prisma.jurnal_guru.upsert({
                        where: {
                            kelas_tanggal_jam_ke_id: {
                                kelas,
                                tanggal: dateObj,
                                jam_ke_id: jamId,
                            }
                        },
                        update: payload,
                        create: {
                            ...payload,
                            created_at: new Date(),
                        }
                    });

                    results.success++;
                }
            } catch (err: any) {
                results.failed++;
                results.errors.push(err.message);
            }
        }

        return corsResponse(NextResponse.json({
            ok: true,
            success: true,
            results: {
                total: data.length,
                success: results.success,
                failed: results.failed,
                skipped: results.skipped,
                errors: results.errors
            }
        }));
    } catch (error: any) {
        console.error('Import jurnal error:', error);
        return corsResponse(NextResponse.json({
            ok: false,
            success: false,
            error: error.message,
            results: { total: 0, success: 0, failed: 0, skipped: 0, errors: [error.message] }
        }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
