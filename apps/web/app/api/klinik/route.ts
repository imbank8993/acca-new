import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { getApiUser } from '@/lib/api-auth';
import { nestFetchAsUser } from '@/lib/nest-api';
import { notifKlinikWa } from '@/lib/wa-klinik';

export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const url = '/klinik' + (searchParams.toString() ? '?' + searchParams.toString() : '');
    
    const options: any = { method: req.method };
    let parsedBody: any = null;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const text = await req.text();
        if (text) {
            options.body = text;
            try {
                parsedBody = JSON.parse(text);
            } catch {}
        }
    }

    const { status, body } = await nestFetchAsUser(url, token, options);

    // Kirim notifikasi WA ke approver terkait jika ada ajuan yang membutuhkan persetujuan
    if ((status === 200 || status === 201) && body?.ok && parsedBody?.action) {
        try {
            const userCaller = await getApiUser(req).catch(() => null);

            // 1. Siswa atau Guru mengajukan sesi klinik baru
            if (parsedBody.action === 'create_slot') {
                const slotData = body.data || {};
                if (slotData.initiator_type === 'SISWA' || parsedBody.guru_nip) {
                    await notifKlinikWa('siswa_ajukan_sesi', slotData.id || slotData, parsedBody, userCaller);
                } else if (slotData.status === 'pending' || slotData.initiator_type === 'GURU') {
                    await notifKlinikWa('guru_ajukan_sesi', slotData.id || slotData, parsedBody, userCaller);
                }
            }

            // 2. Guru menerima sesi klinik kelompok dari siswa (diteruskan ke Reviewer Sesi)
            else if (parsedBody.action === 'approve_guru' && parsedBody.guruAction === 'terima') {
                await notifKlinikWa('guru_terima_sesi_siswa', parsedBody.id || body.data?.id, parsedBody, userCaller);
            }

            // 3. Guru memfinalisasi laporan klinik (diajukan ke Reviewer Laporan)
            else if (parsedBody.action === 'update_report' && parsedBody.finalized) {
                await notifKlinikWa('guru_ajukan_laporan', parsedBody.slot_id, parsedBody, userCaller);
            }
        } catch (e: any) {
            console.error('[WA klinik] Gagal memicu notifikasi:', e?.message || e);
        }
    }

    return NextResponse.json(body || {}, { status });
}

export async function GET(request: NextRequest) { return proxy(request); }
export async function POST(request: NextRequest) { return proxy(request); }
export async function PATCH(request: NextRequest) { return proxy(request); }
export async function PUT(request: NextRequest) { return proxy(request); }
export async function DELETE(request: NextRequest) { return proxy(request); }
