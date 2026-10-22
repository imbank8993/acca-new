import { proxy } from '@/lib/nest-proxy';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { const response = await proxy(request, '/audit-logs/tables'); response.headers.set('Cache-Control', 'private, no-store'); return response; }
