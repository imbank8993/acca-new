import { prisma } from './prisma';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from './timezone';

let cachedServerTimezone: string | null = null;

export async function getServerTimezone(): Promise<string> {
    if (cachedServerTimezone) return cachedServerTimezone;

    try {
        const data = await prisma.site_settings.findFirst({
            where: { key: 'timezone' },
            select: { value: true }
        });

        if (!data?.value) {
            console.warn('[Timezone Server] Not configured, using default:', DEFAULT_TIMEZONE);
            return DEFAULT_TIMEZONE;
        }

        const validTimezones = TIMEZONE_OPTIONS.map(t => t.value);
        if (!validTimezones.includes(data.value as any)) {
            console.warn('[Timezone Server] Invalid timezone:', data.value, '- using default');
            return DEFAULT_TIMEZONE;
        }

        cachedServerTimezone = data.value;
        return cachedServerTimezone;
    } catch (err) {
        console.error('[Timezone Server] Error:', err);
        return DEFAULT_TIMEZONE;
    }
}

export function clearServerTimezoneCache(): void {
    cachedServerTimezone = null;
}

export async function getCurrentDateInTz(): Promise<string> {
    const tz = await getServerTimezone();
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

export async function getCurrentDateTimeInTz(): Promise<string> {
    const tz = await getServerTimezone();
    const now = new Date();
    const tanggal = now.toLocaleDateString('en-CA', { timeZone: tz });
    const jam = now.toLocaleTimeString('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return `${tanggal}T${jam}`;
}

export function geserWaktuDinding(tanggal: string, jam: string, menit: number): string {
    const dasar = new Date(`${String(tanggal).slice(0, 10)}T${String(jam).slice(0, 5)}:00Z`);
    if (Number.isNaN(dasar.getTime())) return '';
    return new Date(dasar.getTime() + menit * 60_000).toISOString().slice(0, 16);
}

export async function getCurrentYearInTz(): Promise<number> {
    const tz = await getServerTimezone();
    return parseInt(new Date().toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric' }));
}

export async function getCurrentMonthInTz(): Promise<number> {
    const tz = await getServerTimezone();
    return parseInt(new Date().toLocaleDateString('en-CA', { timeZone: tz, month: 'numeric' }));
}

export async function getCurrentDayNameInTz(): Promise<string> {
    const tz = await getServerTimezone();
    return new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        timeZone: tz
    });
}

export async function formatDateInTz(date: Date | string, options?: Intl.DateTimeFormatOptions): Promise<string> {
    const d = typeof date === 'string' ? new Date(date) : date;
    const tz = await getServerTimezone();
    return d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        ...options,
        timeZone: tz
    });
}

export function parseLocalDate(localDateStr: string): Date {
    return new Date(localDateStr + 'T12:00:00');
}

export function dateToIsoString(date: Date): string {
    return date.toISOString();
}

export async function getTimezoneLabel(): Promise<string> {
    const tz = await getServerTimezone();
    const found = TIMEZONE_OPTIONS.find(t => t.value === tz);
    return found ? found.label.split(' ')[0] : tz;
}