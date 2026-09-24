import { NextRequest, NextResponse } from 'next/server';



export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' });

  // httpOnly disamakan dengan cookie yang dipasang saat login supaya atributnya
  // konsisten; penghapusan tetap dilakukan server, jadi tidak perlu terbaca JS.
  const clearOpts = {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax' as const,
    httpOnly: true,
  };

  response.cookies.set('acca_session', '', clearOpts);
  response.cookies.set('acca_refresh_token', '', clearOpts);
  response.cookies.set('sb-access-token.0', '', clearOpts);
  response.cookies.set('sb-refresh-token.0', '', clearOpts);

  return response;
}
