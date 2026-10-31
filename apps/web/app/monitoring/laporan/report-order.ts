type ReportModule = 'GURU_ASUH' | 'KLINIK' | 'EKSKUL';

interface ReportRow {
    id?: string;
    bulan?: number | string;
    tahun?: number | string;
    tanggal?: string;
    nama_guru_snap?: string;
    nama_guru?: string;
    pembina_nama?: string;
    nip?: string;
    pembina_nip?: string;
    submitted_at?: string;
    approved_at?: string;
    created_at?: string;
}

const names = new Intl.Collator('id-ID', { sensitivity: 'base', numeric: true });

export function reportPeriod(row: ReportRow, module: ReportModule) {
    // Use the calendar date in the API value, without browser timezone shifts.
    const date = module === 'KLINIK' ? /^(\d{4})-(\d{2})-\d{2}/.exec(row.tanggal || '') : null;
    const year = Number(module === 'KLINIK' ? date?.[1] : row.tahun) || 0;
    const month = Number(module === 'KLINIK' ? date?.[2] : row.bulan) || 0;
    const valid = year > 0 && month >= 1 && month <= 12;
    return { year: valid ? year : 0, month: valid ? month : 0, key: valid ? `${year}-${month}` : 'unknown' };
}

export function sortReports<T extends ReportRow>(rows: T[], module: ReportModule): T[] {
    const name = (row: T) => (module === 'GURU_ASUH' ? row.nama_guru_snap : module === 'KLINIK' ? row.nama_guru : row.pembina_nama)?.trim() || '';
    const time = (row: T) => Date.parse((module === 'KLINIK' ? row.tanggal : row.submitted_at || row.approved_at || row.created_at) || '') || 0;
    return [...rows].sort((a, b) => {
        const pa = reportPeriod(a, module);
        const pb = reportPeriod(b, module);
        return pb.year - pa.year || pb.month - pa.month
            || names.compare(name(a), name(b))
            || names.compare(a.nip || a.pembina_nip || '', b.nip || b.pembina_nip || '')
            || time(b) - time(a)
            || names.compare(String(a.id || ''), String(b.id || ''));
    });
}
