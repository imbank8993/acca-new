import { publicRead } from '@/lib/e-sertifikat/http';
import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = async (request: NextRequest, context: { params: Promise<{ path: string[] }> }) => publicRead(request, (await context.params).path);
