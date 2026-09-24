import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ identifier: string }> }) {
    const { identifier: nisn } = await props.params;
    return proxy(request, `/siswa/${encodeURIComponent(nisn)}/kelas`);
}

