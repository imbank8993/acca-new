'use client';

/**
 * fetch ke API internal yang membawa identitas pemanggil.
 *
 * Tidak lagi menyusun header `Authorization` dari sesi Supabase: sejak sesi
 * diterbitkan NestJS, tokennya ada di cookie `acca_session` yang ikut
 * terkirim sendiri di setiap permintaan same-origin. Sisi server pun sudah
 * membaca cookie itu — `extractRequestToken()` bahkan sengaja mendahulukannya
 * di atas header.
 *
 * Menyusun header sendiri justru berbahaya: kalau pembacaan sesi di browser
 * gagal (atau melempar), header berisi token cacat MENANG atas cookie yang
 * sebenarnya sehat di `getApiUser()`, dan permintaannya balas 401 padahal
 * penggunanya login. Itu yang dulu membuat `useCapabilities()` mengira admin
 * tidak punya kapabilitas apa pun.
 */
export async function authFetch(url: string, options: RequestInit = {}) {
    return fetch(url, { ...options, credentials: 'same-origin' });
}
