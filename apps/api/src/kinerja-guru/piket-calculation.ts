type Row = Record<string, any>;
export const dateOnly = (value: unknown): string => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const hours = (value: unknown) => String(value ?? '').split(',').map(part => Number(part.trim())).filter(hour => Number.isInteger(hour) && hour > 0);

export function schoolClock(now: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (type: string) => parts.find(part => part.type === type)!.value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function endsAt(value: unknown): number | null {
    const match = /(?:-|–|—|s\/?d)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/i.exec(String(value || '').trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// Scoped holidays follow the same all/class/grade rules as libur.ts in the web app.
function holidayApplies(row: Row, jam: number, kelas: string, tingkat: unknown) {
    const rawHour = normalize(row.jam_ke);
    if (rawHour && rawHour !== 'semua' && !hours(row.jam_ke).includes(jam)) return false;
    const targets: string[] = Array.isArray(row.target_kelas) ? row.target_kelas.map(normalize) : String(row.target_kelas || '').replace(/^[{]|[}]$/g, '').split(',').map(value => normalize(value).replace(/^"|"$/g, '')).filter(Boolean);
    const scope = normalize(row.lingkup);
    if (!targets.length || !['kelas', 'tingkat'].includes(scope)) return true;
    return scope === 'kelas' ? targets.includes(normalize(kelas)) : tingkat != null && targets.includes(normalize(tingkat));
}

export function calculateMissingPiket(input: {
    schedules: Row[]; reports: Row[]; holidays: Row[]; classes: Row[];
    start: string; end: string; today: string; currentMinutes: number;
}) {
    const { schedules, reports, holidays, classes, start, today, currentMinutes } = input;
    const end = input.end < today ? input.end : today;
    const classInfo = new Map(classes.map(row => [normalize(row.nama), row]));
    const holidayMap = new Map<string, Row[]>();
    for (const row of holidays) {
        const date = dateOnly(row.tanggal);
        holidayMap.set(date, [...(holidayMap.get(date) || []), row]);
    }
    const reported = new Set<string>();
    const reportedHours = new Set<string>();
    for (const report of reports) for (const detail of report.laporan_piket_detail || []) {
        for (const jam of hours(detail.jam_ke)) {
            const date = dateOnly(report.tanggal);
            reported.add(`${date}|${normalize(detail.nama_kelas)}|${jam}`);
            reportedHours.add(`${date}|${String(report.nip || '').trim()}|${jam}`);
        }
    }
    // A version is a complete timetable, matching SettingsService's as_of rule.
    // Selecting versions per slot would resurrect removed classes/teachers.
    const versions = new Map<string, Row[]>();
    for (const row of schedules) {
        if (row.aktif === false) continue;
        const version = dateOnly(row.berlaku_mulai);
        if (version) versions.set(version, [...(versions.get(version) || []), row]);
    }
    const dates = [...versions.keys()].sort();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const result: { nip: string; nama: string; tanggal: string; hari: string; jam: number; kelas: string; waktu: string }[] = [];
    for (let time = Date.parse(`${start}T00:00:00Z`); time <= Date.parse(`${end}T00:00:00Z`); time += 86400000) {
        const date = new Date(time), dateStr = dateOnly(date), day = dayNames[date.getUTCDay()];
        if (day === 'Minggu') continue;
        const applicable = dates.filter(value => value <= dateStr);
        const version = applicable[applicable.length - 1];
        if (!version) continue;
        const groups = new Map<string, { nip: string; nama: string; jam: number; kelas: Set<string>; waktu: Set<string> }>();
        for (const slot of versions.get(version)!) {
            if (normalize(slot.hari) !== normalize(day)) continue;
            const nip = String(slot.nip || '').trim(), jam = Number(slot.jam_ke);
            if (!nip || !Number.isInteger(jam) || jam <= 0) continue;
            // Unknown finishing time is evaluated tomorrow, avoiding a premature penalty.
            const finish = endsAt(slot.waktu);
            if (dateStr === today && (finish === null || finish > currentMinutes)) continue;
            const kelas = String(slot.kelas || '').trim();
            if ((holidayMap.get(dateStr) || []).some(row => holidayApplies(row, jam, kelas, classInfo.get(normalize(kelas))?.tingkat))) continue;
            const complete = kelas ? reported.has(`${dateStr}|${normalize(kelas)}|${jam}`) : reportedHours.has(`${dateStr}|${nip}|${jam}`);
            if (complete) continue;
            const key = `${nip}|${jam}`;
            if (!groups.has(key)) groups.set(key, { nip, nama: slot.nama_guru || nip, jam, kelas: new Set(), waktu: new Set() });
            const group = groups.get(key)!;
            group.kelas.add(kelas || 'Seluruh kelas');
            if (slot.waktu) group.waktu.add(slot.waktu);
        }
        for (const group of groups.values()) result.push({ nip: group.nip, nama: group.nama, tanggal: dateStr, hari: day, jam: group.jam, kelas: [...group.kelas].join(', '), waktu: [...group.waktu].join(', ') });
    }
    return result;
}
