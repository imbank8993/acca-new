import { NextResponse } from 'next/server';

/**
 * Origin yang boleh memanggil route API ini dari browser lain.
 *
 * Sebelumnya di sini dipasang `*` untuk SEMUA route. Itu bertabrakan dengan
 * header global di next.config.ts yang memasang origin spesifik +
 * `Allow-Credentials: true`: autentikasi aplikasi ini memakai cookie
 * `acca_session`, dan spesifikasi CORS melarang wildcard dipakai bersama
 * kredensial — jadi wildcard-nya bukan cuma longgar, tapi juga membuat
 * permintaan lintas-origin yang sah ditolak browser. Nilainya dibaca dari env
 * yang sama dengan next.config.ts supaya keduanya tidak bisa berbeda.
 */
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://icgowa.sch.id';

interface CorsOptions {
    /**
     * Setel `true` HANYA untuk endpoint yang memang dirancang dibaca situs
     * lain tanpa login dan tidak memuat data pribadi (mis. agenda publik,
     * testimoni). Responsnya dikirim tanpa `Allow-Credentials`, jadi cookie
     * sesi tidak pernah ikut — wildcard di sini tidak membuka data bersesi.
     *
     * Bawaannya `false`: endpoint bersesi harus menyebut origin spesifik,
     * karena wildcard + kredensial ditolak browser.
     */
    publicRead?: boolean;
}

export function corsResponse(response: NextResponse, options: CorsOptions = {}) {
    if (options.publicRead) {
        response.headers.set('Access-Control-Allow-Origin', '*');
    } else {
        response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Respons berbeda per origin; tanpa ini proxy bisa menyajikan header
    // izin milik origin lain.
    response.headers.append('Vary', 'Origin');
    return response;
}

export function handleOptions(options: CorsOptions = {}) {
    const response = new NextResponse(null, { status: 204 });
    return corsResponse(response, options);
}
