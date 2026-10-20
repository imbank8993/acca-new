import { NextRequest } from 'next/server';
import { proxy } from '@/lib/nest-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return proxy(request, '/ketidakhadiran/siswa');
}
