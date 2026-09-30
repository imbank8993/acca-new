/**
 * Resolusi origin / domain publik resmi ACCA untuk QR Code dan URL verifikasi.
 * 
 * Mencegah QR Code mengarah ke localhost / IP internal (127.0.0.1, ::1)
 * saat diakses via reverse proxy, development port, ataupun IP VPS internal.
 */

export function getPublicOrigin(customOrigin?: string | null): string {
    // 1. Jika customOrigin diberikan dan BUKAN localhost/internal
    if (customOrigin && typeof customOrigin === 'string') {
        const trimmed = customOrigin.trim();
        if (trimmed && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1') && !trimmed.includes('0.0.0.0')) {
            return trimmed.replace(/\/+$/, '');
        }
    }

    // 2. Jika di client browser (window.location) dan BUKAN localhost
    if (typeof window !== 'undefined' && window.location?.origin) {
        const clientOrigin = window.location.origin;
        if (!clientOrigin.includes('localhost') && !clientOrigin.includes('127.0.0.1') && !clientOrigin.includes('0.0.0.0')) {
            return clientOrigin.replace(/\/+$/, '');
        }
    }

    // 3. Prioritaskan environment variables jika valid dan bukan localhost
    const envBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL;
    if (envBase && typeof envBase === 'string') {
        const trimmedEnv = envBase.trim();
        if (trimmedEnv && !trimmedEnv.includes('localhost') && !trimmedEnv.includes('127.0.0.1')) {
            return trimmedEnv.replace(/\/+$/, '');
        }
    }

    // 4. Fallback resmi domain produksi ACCA MAN Insan Cendekia Gowa
    return 'https://acca.icgowa.sch.id';
}
