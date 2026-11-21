/**
 * Asal yang boleh memicu logout bersama otomatis lewat halaman /logout:
 * ACCA sendiri dan aplikasi pendampingnya (CBT, Tools). Dari asal lain halaman
 * meminta konfirmasi dulu, supaya situs pihak ketiga tidak bisa diam-diam
 * mengeluarkan pengguna.
 */
export function trustedLogoutOrigins(ownOrigin: string): Set<string> {
    const origins = new Set<string>([ownOrigin])
    for (const value of [
        process.env.NEXT_PUBLIC_CBT_URL || 'https://acca-cbt.icgowa.sch.id',
        process.env.NEXT_PUBLIC_TOOLS_URL || 'https://acca-tools.icgowa.sch.id',
        process.env.NEXT_PUBLIC_BASE_URL,
    ]) {
        if (!value) continue
        try { origins.add(new URL(value).origin) } catch { /* Konfigurasi tidak valid tidak dipercaya. */ }
    }
    return origins
}

/** Apakah navigasi ke /logout berasal dari aplikasi ACCA (dibaca dari referrer). */
export function cameFromAccaApplication(referrer: string, trusted: Set<string>): boolean {
    if (!referrer) return false
    try { return trusted.has(new URL(referrer).origin) } catch { return false }
}
