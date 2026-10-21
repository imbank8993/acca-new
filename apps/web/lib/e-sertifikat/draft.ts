import { DEFAULT_TEMPLATE } from './model';
import { DEFAULT_TIMEZONE } from '../timezone';

export function createEventDraft(timeZone = DEFAULT_TIMEZONE, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (type: string) => parts.find(value => value.type === type)!.value;
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    return {
        title: '', organizer: 'MAN Insan Cendekia Gowa', description: '', location: '', start_date: date, end_date: date,
        number_prefix: `ACCA-${part('year')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        template: structuredClone(DEFAULT_TEMPLATE), archived: false,
    };
}
