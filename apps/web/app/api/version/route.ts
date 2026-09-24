import { NextResponse } from 'next/server'

// Dipanggil dari components/AppUpdateChecker.tsx (no-store, lihat header
// '/api/:path*' di next.config.ts) supaya selalu mencerminkan build yang
// SEDANG live di server, dibandingkan dengan NEXT_PUBLIC_BUILD_ID yang beku
// di bundle klien.
export async function GET() {
  return NextResponse.json({ buildId: process.env.NEXT_PUBLIC_BUILD_ID || '' })
}
