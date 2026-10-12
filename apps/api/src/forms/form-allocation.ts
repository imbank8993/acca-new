import { formAnswer, formLabelKey } from './form-values';
// ============================================================
// Mesin skoring & seleksi kuota untuk Form Builder
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
    created_at: string | Date;
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
                option: null as any,
                rank: null as any,
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
            if (!byOption[opt]) byOption[opt] = [];
            byOption[opt].push(r);
        }

        for (const [opt, list] of Object.entries(byOption)) {
            list.sort(cmp);
            const quota = quotaOf(opt);
            const currentFilled = filled[opt] || 0;
            const remainingQuota = quota === null ? Infinity : Math.max(0, quota - currentFilled);

            const accepted = list.slice(0, remainingQuota);
            const rejected = list.slice(remainingQuota);

            accepted.forEach(item => {
                const newRank = (filled[opt] || 0) + 1;
                filled[opt] = newRank;
                item.res.stage = stage;
                item.res.option = opt;
                item.res.rank = newRank;
                if (stage === 'pilihan_1') countP1[opt] = (countP1[opt] || 0) + 1;
                if (stage === 'pilihan_2') countP2[opt] = (countP2[opt] || 0) + 1;
            });

            leftovers.push(...rejected);
        }

        return leftovers;
    };

    // Hitung total peminat pilihan 1 untuk summary
    for (const r of ranked) {
        const p1 = r.res.choices[0];
        if (p1) peminat1[p1] = (peminat1[p1] || 0) + 1;
    }

    // Putaran 1: Pilihan Pertama
    const afterRound1 = takeRound(ranked, 0, 'pilihan_1');

    // Putaran 2: Pilihan Kedua (jika ada)
    const afterRound2 = choiceLabels.length > 1
        ? takeRound(afterRound1, 1, 'pilihan_2')
        : afterRound1;

    // Putaran Cadangan (waitlist) pada Pilihan Pertama
    const waitlistCount: Record<string, number> = {};
    if (config.waitlist) {
        const byP1: Record<string, Ranked[]> = {};
        const trulyUnplaced: Ranked[] = [];

        for (const r of afterRound2) {
            const p1 = r.res.choices[0];
            if (!p1) { trulyUnplaced.push(r); continue; }
            if (!byP1[p1]) byP1[p1] = [];
            byP1[p1].push(r);
        }

        for (const [opt, list] of Object.entries(byP1)) {
            list.sort(cmp);
            list.forEach((item, idx) => {
                item.res.stage = 'cadangan';
                item.res.option = opt;
                item.res.rank = idx + 1; // nomor urut antrian cadangan (1, 2, ...)
            });
            waitlistCount[opt] = list.length;
        }
    }

    // Bangun tabel rekapitulasi untuk seluruh opsi yang dikenal
    const allKnownOptions = new Set<string>([
        ...Object.keys(config.quotas || {}),
        ...Object.keys(optionLabels),
        ...Object.keys(filled),
        ...Object.keys(peminat1),
    ]);

    const summary: AllocationSummaryRow[] = [...allKnownOptions]
        .filter(Boolean)
        .sort((a, b) => (optionLabels[a] || a).localeCompare(optionLabels[b] || b))
        .map(opt => {
            const quota = quotaOf(opt);
            const terisi = filled[opt] || 0;
            return {
                option: opt,
                label: optionLabels[opt] || opt,
                quota,
                pilihan1: countP1[opt] || 0,
                pilihan2: countP2[opt] || 0,
                terisi,
                sisa: quota === null ? null : Math.max(0, quota - terisi),
                cadangan: waitlistCount[opt] || 0,
                peminatPilihan1: peminat1[opt] || 0,
            };
        });

    const unplaced = ranked.filter(r => r.res.stage === 'tidak_diterima').length;

    return {
        results: ranked.map(r => r.res),
        summary,
        unplaced,
        warnings,
    };
}
