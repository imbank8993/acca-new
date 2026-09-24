/**
 * Penamaan berkas unduhan — pasangan sisi-turun dari mime.ts.
 *
 * Aturannya satu: apa yang diunggah harus turun kembali dengan nama dan
 * ekstensi yang sama. Dua cara gagal yang berulang di repo ini:
 *
 *   1. Ekstensi DIPATOK ("kalau gambar berarti .png"), sehingga template .webp
 *      turun bernama .png dan sebagian aplikasi menolak membukanya.
 *   2. Nama tidak disanitasi. Browser memenggal `a.download` pada `/`, jadi
 *      judul bebas seperti `047/IZIN/P/VIII/2026` tersimpan TANPA ekstensi
 *      sama sekali — gejalanya di pengguna terbaca sebagai "file rusak".
 */

import { getExtensionFromMimeType } from './mime';

/**
 * Ekstensi (berikut titiknya) dari sebuah URL berkas; '' kalau tidak ada.
 *
 * Query string dan fragment dibuang lebih dulu — URL storage lazim membawa
 * `?token=...`, dan tanpa itu ekstensinya terbaca sebagai `png?token=abc`.
 */
export function extensionFromUrl(url: string): string {
    const jalur = (url || '').split(/[?#]/)[0];
    let berkas = jalur.split('/').pop() || '';
    try { berkas = decodeURIComponent(berkas); } catch { /* URL cacat: pakai apa adanya */ }
    const cocok = /\.([A-Za-z0-9]{1,8})$/.exec(berkas);
    return cocok ? `.${cocok[1].toLowerCase()}` : '';
}

/** Cadangan saat URL-nya tidak berekstensi: turunkan dari MIME yang dikirim server. */
export function extensionFromMime(mimeType: string): string {
    const ext = getExtensionFromMimeType(mimeType);
    return ext ? `.${ext}` : '';
}

/** Karakter yang tidak sah di nama berkas Windows/POSIX. */
const KARAKTER_TERLARANG = /[\\/:*?"<>|]+/g;

/**
 * Nama akhir berkas unduhan: `dasar` disanitasi, lalu diberi `ext` bila belum
 * berakhiran itu. `dasar` yang kosong atau habis tersanitasi jatuh ke `cadangan`.
 *
 * Spasi dan tanda hubung SENGAJA dibiarkan — nama unggahan pengguna harus turun
 * apa adanya, dan keduanya sah di kedua sistem berkas.
 */
export function downloadFileName(dasar: string, ext: string, cadangan = 'file'): string {
    const bersih = (dasar || '')
        .replace(KARAKTER_TERLARANG, '-')
        .replace(/^\.+/, '')       // titik di depan bikin berkas tersembunyi di POSIX
        .replace(/^-+|-+$/g, '')   // sisa tanda hubung di tepi: nama yang seluruhnya
        .trim();                   // karakter terlarang jadi kosong → jatuh ke cadangan
    const nama = bersih || cadangan;
    if (!ext) return nama;
    return nama.toLowerCase().endsWith(ext.toLowerCase()) ? nama : `${nama}${ext}`;
}

/** Picu unduhan sebuah Blob di browser (no-op di server). */
export function downloadBlob(blob: Blob, fileName: string): void {
    if (typeof window === 'undefined') return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
