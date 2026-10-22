/**
 * Helper untuk memproses URL gambar agar menggunakan proxy API jika berada di localhost
 * atau jika URL mengarah ke domain hosting eksternal.
 */
export function getProxiedImageUrl(url: string | null | undefined, cacheBust = true): string {
    if (!url) return '';
    
    // Jika sudah berupa base64 atau blob, tidak perlu diproxy
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    // Gunakan proxy jika URL mengarah ke domain hosting
    if (url.includes('icgowa.sch.id')) {
        // Bersihkan spasi dan double slash yang salah (kecuali setelah protocol)
        const cleanUrl = url.trim()
            .replace(/\s/g, '')
            .replace(/([^:])\/\//g, '$1/'); 
            
        return `/api/proxy/image?url=${encodeURIComponent(cleanUrl)}${cacheBust ? `&t=${Date.now()}` : ''}`;
    }

    return url;
}
