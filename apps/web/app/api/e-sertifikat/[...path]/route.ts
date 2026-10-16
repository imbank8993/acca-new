import { manage } from '@/lib/e-sertifikat/http';
import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const handler = async (request: NextRequest, context: Context) => manage(request, (await context.params).path);
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
