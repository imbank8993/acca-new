import { formAnswer, formLabelKey } from '@acca/shared';
// ============================================================
// Mesin skoring & seleksi kuota untuk Form Builder
//
// Dipakai oleh:
//  - POST /api/forms/submit              → hitung skor saat tanggapan masuk
//  - GET/POST /api/forms/[id]/allocate   → jalankan seleksi kuota
//
// Skor SELALU dihitung ulang dari schema yang berlaku sekarang, tidak
// mengandalkan kolom total_score yang tersimpan. Alasannya: schema form bisa
// diubah (bobot/kategori diperbaiki) setelah tanggapan masuk, sehingga nilai
// yang tersimpan bisa basi terhadap aturan penilaian terkini.
// ============================================================

export const TOTAL_SCORE_KEY = '__total__';

export interface ScoreResult {
    total: number;
    categories: Record<string, number>;
}

/** Ambil jawaban sebuah field dari data tanggapan (data dikunci per LABEL field). */
export function readAnswer(data: Record<string, any>, labels: string[]): any {
    for (const label of labels) {
        if (label && data && data[label] !== undefined && data[label] !== null && data[label] !== '') {
            return data[label];
        }
    }
    return undefined;
}

/** Hitung total skor & skor per kategori dari jawaban + schema. */
export function computeScores(fields: any[], data: Record<string, any>): ScoreResult {
    let total = 0;
    const categories: Record<string, number> = Object.create(null);

    if (!Array.isArray(fields) || !data) return { total, categories };

    for (const field of fields) {
        if (!field?.enableScoring || !Array.isArray(field.options)) continue;

        const answer = formAnswer(fields, field, data);
        if (answer === undefined || answer === null || answer === '') continue;

        if (Array.isArray(answer) && field.type !== 'checkbox') continue;
        const answers = [...new Set(Array.isArray(answer) ? answer : [answer])];
        let fieldScore = 0;
        for (const ans of answers) {
            const opt = field.options.find((o: any) => o.value === ans) || (!Object.prototype.hasOwnProperty.call(data, field.id) ? field.options.find((o: any) => o.label === ans) : undefined);
            if (opt && typeof opt.score === 'number' && Number.isSafeInteger(opt.score) && Math.abs(opt.score) <= 10000) fieldScore += opt.score;
        }

        total += fieldScore;
        if (field.scoreCategory) {
            categories[field.scoreCategory] = (categories[field.scoreCategory] || 0) + fieldScore;
        }
    }

    return { total, categories };
}

/** Semua kategori skor yang dipakai sebuah form, urut kemunculan di schema. */
export function listScoreCategories(fields: any[]): string[] {
    const out: string[] = [];
    for (const f of fields || []) {
        if (f?.enableScoring && f.scoreCategory && !out.includes(f.scoreCategory)) out.push(f.scoreCategory);
    }
    return out;
}

// ── Seleksi ────────────────────────────────────────────────

export type PlacementStage = 'pilihan_1' | 'pilihan_2' | 'cadangan' | 'tidak_diterima';

export interface AllocationCandidate {
    id: string;
    created_at: string;
    data: Record<string, any>;
}

export interface PlacementResult {
    id: string;
    choices: (string | null)[];      // nilai pilihan 1, 2, ... apa adanya
    scores: ScoreResult;
    stage: PlacementStage;
    option: string | null;           // program tempat dia ditempatkan / diantrikan
    rank: number | null;             // peringkat dalam program tsb (diterima maupun cadangan)
}

export interface AllocationSummaryRow {
    option: string;
    label: string;
    quota: number | null;            // null = tidak dibatasi
    pilihan1: number;
    pilihan2: number;
    terisi: number;
    sisa: number | null;
    cadangan: number;
    peminatPilihan1: number;
}

export interface AllocationOutcome {
    results: PlacementResult[];
    summary: AllocationSummaryRow[];
    unplaced: number;                // tanpa pilihan sama sekali / tidak diterima
    warnings: string[];
}

interface Ranked {
    cand: AllocationCandidate;
    res: PlacementResult;
}

/**
 * Bandingkan dua kandidat: kategori skor sesuai urutan prioritas (besar menang),
 * lalu total skor, lalu waktu submit paling awal.
 */
function makeComparator(rankBy: string[]) {
    return (a: Ranked, b: Ranked): number => {
        for (const key of rankBy) {
            const av = key === TOTAL_SCORE_KEY ? a.res.scores.total : (a.res.scores.categories[key] || 0);
            const bv = key === TOTAL_SCORE_KEY ? b.res.scores.total : (b.res.scores.categories[key] || 0);
            if (av !== bv) return bv - av;
        }
        if (a.res.scores.total !== b.res.scores.total) return b.res.scores.total - a.res.scores.total;
        return new Date(a.cand.created_at).getTime() - new Date(b.cand.created_at).getTime();
    };
}

/**
 * Seleksi dua putaran:
 *  1. Tiap program diisi dari peminat Pilihan Pertama, diurutkan skor, sebanyak kuota.
 *  2. Yang gagal di putaran 1 memperebutkan SISA kuota program Pilihan Keduanya.
 *  3. Yang masih tidak tertampung → cadangan bernomor (kalau waitlist aktif) di program
 *     Pilihan Pertamanya, atau tidak diterima.
 */
export function allocate(
    fields: any[],
    config: {
        choiceFields: { id: string; label: string }[];
        quotas: Record<string, number>;
        rankBy: string[];
        waitlist?: boolean;
    },
    candidates: AllocationCandidate[]
): AllocationOutcome {
    const warnings: string[] = [];
    const rankBy = (config.rankBy || []).length > 0 ? config.rankBy : [TOTAL_SCORE_KEY];
    const cmp = makeComparator(rankBy);

    // Label field pilihan: pakai label terkini dari schema, dengan label snapshot sebagai cadangan
    const choiceLabels: string[][] = (config.choiceFields || []).map(cf => {
        const current = (fields || []).find((f: any) => f.id === cf.id);
        const labels = [cf.id, current ? formLabelKey(fields, current) : null, cf.label].filter(Boolean) as string[];
        return [...new Set(labels)];
    });

    // Peta value → label opsi (untuk tampilan), diambil dari field pilihan pertama
    const optionLabels: Record<string, string> = {};
    for (const cf of config.choiceFields || []) {
        const field = (fields || []).find((f: any) => f.id === cf.id);
        for (const o of field?.options || []) {
            if (o?.value && !optionLabels[o.value]) optionLabels[o.value] = o.label || o.value;
        }
    }

    const ranked: Ranked[] = candidates.map(cand => {
        const choices = choiceLabels.map(labels => {
            const val = readAnswer(cand.data || {}, labels);
            if (val === undefined) return null;
            return Array.isArray(val) ? (val[0] ?? null) : String(val);
        });
        return {
            cand,
            res: {
                id: cand.id,
                choices,
                scores: computeScores(fields, cand.data || {}),
                stage: 'tidak_diterima' as PlacementStage,
                option: null,
                rank: null,
            },
        };
    });

    const quotaOf = (option: string): number | null => {
        const q = config.quotas?.[option];
        return typeof q === 'number' && !Number.isNaN(q) ? q : null; // null = tidak dibatasi
    };

    const filled: Record<string, number> = {};
    const countP1: Record<string, number> = {};
    const countP2: Record<string, number> = {};
    const peminat1: Record<string, number> = {};

    const takeRound = (pool: Ranked[], choiceIndex: number, stage: 'pilihan_1' | 'pilihan_2'): Ranked[] => {
        const byOption: Record<string, Ranked[]> = {};
        const leftovers: Ranked[] = [];

        for (const r of pool) {
            const opt = r.res.choices[choiceIndex];
            if (!opt) { leftovers.push(r); continue; }
            (byOption[opt] = byOption[opt] || []).push(r);
        }

        for (const [opt, group] of Object.entries(byOption)) {
            group.sort(cmp);
            const quota = quotaOf(opt);
            const used = filled[opt] || 0;
            const room = quota === null ? group.length : Math.max(0, quota - used);

            group.forEach((r, i) => {
                if (i < room) {
                    filled[opt] = (filled[opt] || 0) + 1;
                    r.res.stage = stage;
                    r.res.option = opt;
                    r.res.rank = filled[opt];
                    if (stage === 'pilihan_1') countP1[opt] = (countP1[opt] || 0) + 1;
                    else countP2[opt] = (countP2[opt] || 0) + 1;
                } else {
                    leftovers.push(r);
                }
            });
        }

        return leftovers;
    };

    // Statistik peminat pilihan pertama (untuk kartu ringkasan)
    for (const r of ranked) {
        const p1 = r.res.choices[0];
        if (p1) peminat1[p1] = (peminat1[p1] || 0) + 1;
    }

    let pool = ranked;
    if (choiceLabels.length === 0) {
        warnings.push('Field pilihan belum dipilih di pengaturan seleksi.');
    } else {
        pool = takeRound(pool, 0, 'pilihan_1');
        if (choiceLabels.length > 1) pool = takeRound(pool, 1, 'pilihan_2');
    }

    // Sisa: cadangan bernomor di program pilihan pertamanya, atau tidak diterima
    if (config.waitlist !== false) {
        const byOption: Record<string, Ranked[]> = {};
        for (const r of pool) {
            const opt = r.res.choices[0];
            if (!opt) continue;
            (byOption[opt] = byOption[opt] || []).push(r);
        }
        for (const [opt, group] of Object.entries(byOption)) {
            group.sort(cmp);
            group.forEach((r, i) => {
                r.res.stage = 'cadangan';
                r.res.option = opt;
                r.res.rank = i + 1;
            });
        }
    }

    const noChoice = ranked.filter(r => !r.res.choices.some(Boolean)).length;
    if (noChoice > 0) warnings.push(`${noChoice} tanggapan tidak mengisi pilihan dan dilewati.`);

    const optionKeys = [...new Set([
        ...Object.keys(config.quotas || {}),
        ...Object.keys(peminat1),
        ...ranked.map(r => r.res.option).filter(Boolean) as string[],
    ])];

    const summary: AllocationSummaryRow[] = optionKeys.map(option => {
        const quota = quotaOf(option);
        const terisi = filled[option] || 0;
        return {
            option,
            label: optionLabels[option] || option,
            quota,
            pilihan1: countP1[option] || 0,
            pilihan2: countP2[option] || 0,
            terisi,
            sisa: quota === null ? null : Math.max(0, quota - terisi),
            cadangan: ranked.filter(r => r.res.stage === 'cadangan' && r.res.option === option).length,
            peminatPilihan1: peminat1[option] || 0,
        };
    }).sort((a, b) => a.label.localeCompare(b.label));

    return {
        results: ranked.map(r => r.res),
        summary,
        unplaced: ranked.filter(r => r.res.stage === 'tidak_diterima').length,
        warnings,
    };
}
