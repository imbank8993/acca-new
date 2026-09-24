/**
 * lib/timezone.ts
 * Centralized timezone management for ACCA app.
 * Supports WIB (Asia/Jakarta), WITA (Asia/Makassar), WIT (Asia/Jayapura).
 *
 * Usage:
 *   import { getTimezone, formatDate, formatTime, getCurrentDate } from '@/lib/timezone'
 *
 *   const tz = getTimezone()                              // 'Asia/Makassar'
 *   const dateStr = formatDate(new Date())               // '11 Mei 2026'
 *   const timeStr = formatTime(new Date())               // '08:30'
 *   const today = getCurrentDate()                        // '2026-05-11'
 *   const dayName = formatDayName(new Date())            // 'Senin'
 */

export const DEFAULT_TIMEZONE = 'Asia/Makassar';

export const TIMEZONE_OPTIONS = [
    { value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta - UTC+7)', offset: '+07:00', description: 'Waktu Indonesia Barat (Sumatra, Jawa, Kalimantan Barat & Tengah)' },
    { value: 'Asia/Makassar', label: 'WITA (Asia/Makassar - UTC+8)', offset: '+08:00', description: 'Waktu Indonesia Tengah (Sulawesi, Bali, Nusa Tenggara, Kalimantan Selatan, Timur & Utara)' },
    { value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura - UTC+9)', offset: '+09:00', description: 'Waktu Indonesia Timur (Maluku dan Papua)' },
] as const;

let cachedTimezone: string | null = null;

export async function getTimezone(): Promise<string> {
    if (cachedTimezone) return cachedTimezone;

    try {
        const res = await fetch('/api/site-settings?key=timezone');
        const data = await res.json().catch(() => null);

        const val = data?.data?.value || data?.value;
        if (!val) {
            console.warn('[Timezone] Not configured, using default:', DEFAULT_TIMEZONE);
            return DEFAULT_TIMEZONE;
        }

        const validTimezones = TIMEZONE_OPTIONS.map(t => t.value);
        if (!validTimezones.includes(val as any)) {
            console.warn('[Timezone] Invalid timezone value:', val, '- using default');
            return DEFAULT_TIMEZONE;
        }

        cachedTimezone = val;
        return cachedTimezone || DEFAULT_TIMEZONE;
    } catch (err) {
        console.error('[Timezone] Error fetching timezone:', err);
        return DEFAULT_TIMEZONE;
    }
}

/**
 * Clear timezone cache (call this when timezone setting changes).
 */
export function clearTimezoneCache(): void {
    cachedTimezone = null;
}

/**
 * Format date string with timezone.
 * @param date Date object or ISO string
 * @param localeID locale for formatting (default: 'id-ID')
 */
export async function formatDate(date: Date | string, localeID: string = 'id-ID'): Promise<string> {
    const d = typeof date === 'string' ? new Date(date) : date;
    const tz = await getTimezone();
    return d.toLocaleDateString(localeID, {
        day: 'numeric', month: 'long', year: 'numeric',
        timeZone: tz
    });
}

/**
 * Format time string with timezone.
 * @param date Date object or ISO string
 * @param localeID locale for formatting
 */
export async function formatTime(date: Date | string, localeID: string = 'id-ID'): Promise<string> {
    const d = typeof date === 'string' ? new Date(date) : date;
    const tz = await getTimezone();
    return d.toLocaleTimeString(localeID, {
        hour: '2-digit', minute: '2-digit',
        timeZone: tz
    });
}

/**
 * Get current date string (YYYY-MM-DD) in school timezone.
 * For date-only comparison (jadwal, piket, dll).
 */
export async function getCurrentDate(): Promise<string> {
    const tz = await getTimezone();
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Get current day name in Indonesian.
 */
export async function getCurrentDayName(): Promise<string> {
    const tz = await getTimezone();
    return new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        timeZone: tz
    });
}

/**
 * Format day name for a given date.
 */
export async function formatDayName(date: Date | string): Promise<string> {
    const d = typeof date === 'string' ? new Date(date) : date;
    const tz = await getTimezone();
    return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        timeZone: tz
    });
}

/**
 * Format datetime string with timezone (for WhatsApp messages, etc).
 */
export async function formatDateTime(date: Date | string, localeID: string = 'id-ID'): Promise<string> {
    const d = typeof date === 'string' ? new Date(date) : date;
    const tz = await getTimezone();
    return d.toLocaleString(localeID, {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: tz
    });
}

/**
 * Get timezone label for display.
 */
export async function getTimezoneLabel(): Promise<string> {
    const tz = await getTimezone();
    const found = TIMEZONE_OPTIONS.find(t => t.value === tz);
    return found ? found.label : tz;
}