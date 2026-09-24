import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ nisn: string }>;
}

export async function GET(request: NextRequest, props: RouteParams) {
    const { nisn } = await props.params;
    const search = request.nextUrl.search;
    return proxy(request, `/ketidakhadiran/log/siswa/${nisn}${search}`);
}
