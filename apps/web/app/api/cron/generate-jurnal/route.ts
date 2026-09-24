import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Ambil pengaturan jurnal terlebih dahulu
        const settingsRes = await nestFetch('/jurnal/pengaturan', { method: 'GET' });
        const settings = settingsRes?.body?.data || settingsRes?.body;

        if (settings && settings.is_auto_generate_enabled === false) {
            return NextResponse.json({
                success: true,
                message: 'Generate otomatis dinonaktifkan di pengaturan.',
                skipped: true,
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // 2. Periksa rentang tanggal berlaku jika diatur
        if (settings?.generate_start_date && todayStr < String(settings.generate_start_date).slice(0, 10)) {
            return NextResponse.json({
                success: true,
                message: `Hari ini (${todayStr}) sebelum tanggal mulai berlaku (${settings.generate_start_date}).`,
                skipped: true,
            });
        }
        if (settings?.generate_end_date && todayStr > String(settings.generate_end_date).slice(0, 10)) {
            return NextResponse.json({
                success: true,
                message: `Hari ini (${todayStr}) setelah tanggal selesai berlaku (${settings.generate_end_date}).`,
                skipped: true,
            });
        }

        const { status, body } = await nestFetch('/jurnal/pengaturan/generate-massal', {
            method: 'POST',
            body: JSON.stringify({ startDate: todayStr, endDate: todayStr }),
        });

        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
