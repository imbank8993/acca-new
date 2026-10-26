import { NextRequest } from 'next/server';
import { proxy } from '@/lib/nest-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const response = await proxy(request, `/jurnal/kehadiran-guru${request.nextUrl.search}`);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
}
