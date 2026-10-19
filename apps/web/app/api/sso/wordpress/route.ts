import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

/**
 * Endpoint SSO WordPress untuk ACCA.
 * Mendukung 2 skenario pemanggilan:
 * 1. AJAX Fetch dari tombol UI (Accept: application/json) -> Mengembalikan payload JSON { success: true, sso_url }
 * 2. Navigasi langsung via URL browser (/wordpress atau /api/sso/wordpress) -> Otomatis redirect ke URL SSO WordPress
 */
export async function GET(req: NextRequest) {
    const isJson = req.headers.get('accept')?.includes('application/json');
    const token = extractRequestToken(req);

    if (!token) {
        if (isJson) {
            return NextResponse.json({ ok: false, error: 'Unauthorized: Sesi tidak ditemukan.' }, { status: 401 });
        }
        // Jika diakses langsung via URL browser tapi belum login, arahkan ke login
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('redirect', '/wordpress');
        return NextResponse.redirect(loginUrl);
    }

    const { status, body } = await nestFetchAsUser('/sso/wordpress', token);

    if (status !== 200 && status !== 201) {
        const errorMsg = body?.message || body?.error || 'Akses SSO WordPress tidak diizinkan.';
        if (isJson) {
            return NextResponse.json({ ok: false, error: errorMsg }, { status });
        }
        // Jika navigasi langsung dan ditolak (misal siswa), arahkan ke dashboard dengan pesan error
        const dashUrl = new URL('/dashboard', req.url);
        dashUrl.searchParams.set('error', encodeURIComponent(errorMsg));
        return NextResponse.redirect(dashUrl);
    }

    if (isJson) {
        return NextResponse.json(body);
    }

    // Navigasi langsung: arahkan seketika ke URL SSO WordPress (login otomatis ke /wp-admin/)
    if (body?.sso_url) {
        return NextResponse.redirect(body.sso_url);
    }

    return NextResponse.redirect(new URL('/dashboard', req.url));
}
