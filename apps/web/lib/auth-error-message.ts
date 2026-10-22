/** Accept both Nest's message format and the application's exception-filter error format. */
export function authErrorMessage(body: unknown, status: number, fallback: string): string {
    if (status === 401) return 'Sesi Anda sudah berakhir. Silakan login kembali.';
    if (status >= 500) return 'Layanan akun sedang tidak tersedia. Silakan coba lagi beberapa saat.';
    const error = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    for (const value of [error.error, error.message]) {
        if (typeof value === 'string' && value.trim()) return value;
        if (Array.isArray(value)) {
            const messages = value.filter((item): item is string => typeof item === 'string' && !!item.trim());
            if (messages.length) return messages.join('. ');
        }
    }
    return fallback;
}
