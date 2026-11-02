export interface PaymentPeriod {
    bulan: number;
    tahun: number;
}

/** Zero means all months or all years. Missing dates are included only without a filter. */
export function matchesPaymentPeriod(period: PaymentPeriod | null, month: number, year: number): boolean {
    if (month === 0 && year === 0) return true;
    return period !== null
        && (month === 0 || Number(period.bulan) === month)
        && (year === 0 || Number(period.tahun) === year);
}

/** Session dates are calendar dates; timestamped tariff changes follow the school's WITA time. */
export function paymentDatePeriod(value: string | null | undefined, calendarDate = false): PaymentPeriod | null {
    if (!value) return null;
    if (calendarDate) {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
        if (!match) return null;
        const tahun = Number(match[1]), bulan = Number(match[2]), day = Number(match[3]);
        const date = new Date(Date.UTC(tahun, bulan - 1, day));
        return date.getUTCFullYear() === tahun && date.getUTCMonth() + 1 === bulan && date.getUTCDate() === day
            ? { bulan, tahun } : null;
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Makassar', year: 'numeric', month: 'numeric' }).formatToParts(date);
    return {
        bulan: Number(parts.find(part => part.type === 'month')?.value),
        tahun: Number(parts.find(part => part.type === 'year')?.value),
    };
}
