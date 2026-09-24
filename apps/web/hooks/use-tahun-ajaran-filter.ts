'use client';

/**
 * lib/use-tahun-ajaran-filter.ts
 * Hook filter Tahun Ajaran untuk halaman data (Jurnal, Absensi, Wali Kelas).
 *
 * Pilihan diisi HANYA dari tahun ajaran yang berstatus aktif (is_active) di
 * master_tahun_ajaran — bisa lebih dari satu (mis. 2025/2026 terkunci + 2026/2027).
 * Default mengikuti tahun ajaran yang direkomendasikan dari tanggal hari ini.
 */

import { useState, useEffect } from 'react';

export interface TahunAjaranRange {
    start: string; // YYYY-07-01
    end: string;   // YYYY+1-06-30
}

/** Rentang tanggal satu tahun ajaran (Juli s.d. Juni). */
export function taDateRange(tahunAjaran: string): TahunAjaranRange | null {
    const y = parseInt(String(tahunAjaran || '').split('/')[0]);
    if (isNaN(y)) return null;
    return { start: `${y}-07-01`, end: `${y + 1}-06-30` };
}

export interface TahunAjaranFilter {
    /** Daftar tahun ajaran aktif, terbaru dulu. */
    years: string[];
    /** Tahun ajaran terpilih ('' selama belum termuat). */
    selected: string;
    setSelected: (v: string) => void;
    /** Rentang tanggal tahun terpilih (null selama belum termuat). */
    range: TahunAjaranRange | null;
}

export function useTahunAjaranFilter(): TahunAjaranFilter {
    const [years, setYears] = useState<string[]>([]);
    const [selected, setSelected] = useState<string>('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { getActivePeriods, getRecommendedSettings } = await import('@/lib/settings-client');
                const periods = await getActivePeriods();
                const uniq = Array.from(new Set(periods.map(p => p.tahun_ajaran)));
                let def = uniq[0] || '';
                try {
                    const rec = await getRecommendedSettings();
                    if (rec && uniq.includes(rec.tahun_ajaran)) def = rec.tahun_ajaran;
                } catch { /* pakai tahun aktif pertama */ }
                if (!cancelled) {
                    setYears(uniq);
                    setSelected(def);
                }
            } catch (e) {
                console.error('Gagal memuat tahun ajaran aktif', e);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { years, selected, setSelected, range: selected ? taDateRange(selected) : null };
}
