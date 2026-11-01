import { NextRequest } from 'next/server';
import { proxy } from '@/lib/nest-proxy';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) { return proxy(req, `/jadwal/sementara${req.nextUrl.search}`); }
export async function POST(req: NextRequest) {
  return proxy(req, '/jadwal/sementara', { method: 'POST', body: JSON.stringify(await req.json()) });
}
