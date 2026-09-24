/**
 * Server-only helpers for LCKH print routes.
 * Dipisah dari print-shared.ts karena memakai fetch/Buffer (tidak untuk client).
 */

/**
 * Unduh gambar (mis. logo_url dari Supabase Storage) dan ubah ke data URL base64
 * agar tertanam langsung di HTML cetak — menghindari gambar gagal termuat sebelum
 * window.print() berjalan. Mengembalikan URL asli bila gagal / bukan http(s).
 */
export async function imageToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (!/^https?:\/\//i.test(url)) return url;
    // Encode spasi/karakter tak-aman (mis. path "Imran, S.Si./logo/..") agar URL valid.
    const safeUrl = encodeURI(url);
    try {
        // Timeout agar URL logo yang lambat/tak responsif tak menggantung response API.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(safeUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return safeUrl;
        const contentType = response.headers.get('content-type') || (url.includes('.png') ? 'image/png' : 'image/jpeg');
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch {
        // Server tak bisa fetch (mis. DNS) → kembalikan URL ter-encode agar browser tetap bisa memuat.
        return safeUrl;
    }
}
