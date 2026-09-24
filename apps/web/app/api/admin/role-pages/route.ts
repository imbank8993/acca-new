import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

// GET /api/admin/role-pages
export async function GET(req: NextRequest) {
  try {
    const token = extractRequestToken(req);
    const { status, body } = await nestFetchAsUser('/access/role-pages', token);
    if (status !== 200) {
      return NextResponse.json({ ok: false, error: body?.message || 'Gagal memuat role pages' }, { status });
    }

    const map = body?.pages || {};
    const flatMap = body?.flatGroups || {};

    const role = req.nextUrl.searchParams.get('role');
    if (role) {
      const R = role.toUpperCase();
      return NextResponse.json({ ok: true, role: R, pageIds: map[R] || [], flatGroups: flatMap[R] || [] });
    }
    return NextResponse.json({ ok: true, map, flatMap });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Gagal memuat role pages' }, { status: 500 });
  }
}

// POST /api/admin/role-pages
export async function POST(req: NextRequest) {
  try {
    const token = extractRequestToken(req);
    const reqBody = await req.json();
    const { status, body } = await nestFetchAsUser('/access/role-pages', token, {
      method: 'POST',
      body: JSON.stringify(reqBody),
    });
    return NextResponse.json(body, { status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Gagal menyimpan' }, { status: 500 });
  }
}

// PUT /api/admin/role-pages (For compatibility with frontend if it still calls PUT)
export async function PUT(req: NextRequest) {
  return POST(req);
}

