import { manage } from '@/lib/e-sertifikat/http';
import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: NextRequest) => manage(request);
export const POST = (request: NextRequest) => manage(request);
