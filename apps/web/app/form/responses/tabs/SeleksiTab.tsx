'use client';

import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { TOTAL_SCORE_KEY, listScoreCategories } from '@/lib/form-allocation';

type Stage = 'pilihan_1' | 'pilihan_2' | 'cadangan' | 'tidak_diterima';

interface PlacementResult {
    id: string;
    choices: (string | null)[];
    scores: { total: number; categories: Record<string, number> };
    stage: Stage;
    option: string | null;
    rank: number | null;
}

interface SummaryRow {
    option: string;
    label: string;
    quota: number | null;
    pilihan1: number;
    pilihan2: number;
    terisi: number;
    sisa: number | null;
    cadangan: number;
    peminatPilihan1: number;
}

interface Outcome {
    results: PlacementResult[];
    summary: SummaryRow[];
    unplaced: number;
    warnings: string[];
    persisted?: boolean;
}

const CHOICE_TYPES = ['select', 'radio'];

const card: React.CSSProperties = {
    borderRadius: '6px',
    backgroundColor: 'var(--n-card)',
    border: '1px solid var(--n-border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '20px 24px',
};

const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 800,
    color: 'var(--n-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--n-text)',
    border: '1px solid var(--n-border)',
    borderRadius: '4px',
    backgroundColor: 'var(--n-card)',
};

const btn = (variant: 'primary' | 'ghost' | 'accent'): React.CSSProperties => ({
    height: '36px',
    padding: '0 16px',
    fontSize: '12px',
    fontWeight: 800,
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: variant === 'primary' ? '#3083FF' : variant === 'accent' ? '#047857' : 'transparent',
    color: variant === 'ghost' ? 'var(--n-text)' : '#ffffff',
    border: variant === 'ghost' ? '1px solid var(--n-border)' : 'none',
});

const STAGE_META: Record<Stage, { label: string; color: string; bg: string; border: string }> = {
    pilihan_1: { label: 'Pilihan 1', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
    pilihan_2: { label: 'Pilihan 2', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
    cadangan: { label: 'Cadangan', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    tidak_diterima: { label: 'Tidak diterima', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
};

export default function SeleksiTab({
    formId,
    formTitle,
    formSchema,
    responses,
    onPersisted,
}: {
    formId: string;
    formTitle: string;
    formSchema: any;
    responses: any[];
    onPersisted: () => void;
}) {
    const fields: any[] = formSchema?.fields || [];
    const choiceFields = fields.filter((f: any) => CHOICE_TYPES.includes(f.type) && Array.isArray(f.options) && f.options.length > 0);
    const categories = useMemo(() => listScoreCategories(fields), [formSchema]);

    const saved = formSchema?.allocation;

    // Tebakan awal: field yang labelnya mengandung "pilihan"
    const guess = (keyword: string) => choiceFields.find((f: any) => (f.label || '').toLowerCase().includes(keyword))?.id || '';

    const [field1, setField1] = useState<string>(saved?.choiceFields?.[0]?.id || guess('pertama'));
    const [field2, setField2] = useState<string>(saved?.choiceFields?.[1]?.id || guess('kedua'));
    const [quotas, setQuotas] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        Object.entries(saved?.quotas || {}).forEach(([k, v]) => { init[k] = String(v); });
        return init;
    });
    const [rankBy, setRankBy] = useState<string[]>(saved?.rankBy || (categories.length > 0 ? categories : [TOTAL_SCORE_KEY]));
    const [waitlist, setWaitlist] = useState<boolean>(saved?.waitlist !== false);

    const [running, setRunning] = useState(false);
    const [saving, setSaving] = useState(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    const optionsOfField1 = useMemo(() => {
        const f = fields.find((x: any) => x.id === field1);
        return (f?.options || []) as { label: string; value: string }[];
    }, [field1, formSchema]);

    // Kolom identitas untuk ditampilkan di tabel hasil
    const nameField = fields.find((f: any) => (f.label || '').toLowerCase().includes('nama'))
        || fields.find((f: any) => f.type === 'text');
    const secondaryField = fields.find((f: any) => (f.label || '').toLowerCase().includes('kelas'))
        || fields.find((f: any) => (f.label || '').toLowerCase().includes('nisn'));

    const responseById = useMemo(() => {
        const map: Record<string, any> = {};
        responses.forEach(r => { map[r.id] = r; });
        return map;
    }, [responses]);

    const buildConfig = () => {
        const pick = (id: string) => {
            const f = fields.find((x: any) => x.id === id);
            return f ? { id: f.id, label: f.label } : null;
        };
        const cf = [pick(field1), pick(field2)].filter(Boolean) as { id: string; label: string }[];
        const q: Record<string, number> = {};
        Object.entries(quotas).forEach(([k, v]) => {
            const n = Number(v);
            if (v !== '' && !Number.isNaN(n)) q[k] = n;
        });
        return { enabled: true, choiceFields: cf, quotas: q, rankBy, waitlist };
    };

    const run = async (persist: boolean) => {
        if (!field1) {
            Swal.fire('Belum lengkap', 'Tentukan dulu field Pilihan Pertama.', 'warning');
            return;
        }
        if (persist) {
            const confirm = await Swal.fire({
                title: 'Simpan hasil seleksi?',
                html: 'Hasil penempatan akan ditulis ke setiap tanggapan dan menimpa hasil seleksi sebelumnya.<br><b>Seleksi bisa dijalankan ulang kapan saja.</b>',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, simpan',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#3083FF',
            });
            if (!confirm.isConfirmed) return;
        }

        setRunning(true);
        try {
            const res = await fetch(`/api/forms/${formId}/allocate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: buildConfig(), persist }),
            });
            const json = await res.json();
            if (!res.ok) {
                Swal.fire('Gagal', json.error || 'Seleksi gagal dijalankan', 'error');
                return;
            }
            setOutcome(json);
            if (persist) {
                onPersisted();
                Swal.fire('Tersimpan', 'Hasil seleksi sudah ditulis ke seluruh tanggapan.', 'success');
            }
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error');
        } finally {
            setRunning(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/forms/${formId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: { allocation: buildConfig() }, expected_updated_at: formSchema.__formVersion ?? null }),
            });
            const json = await res.json();
            if (!res.ok) {
                Swal.fire('Gagal', json.error || 'Pengaturan gagal disimpan', 'error');
                return;
            }
            Swal.fire('Tersimpan', 'Pengaturan kuota & seleksi disimpan pada formulir.', 'success');
            onPersisted();
        } catch (e: any) {
            Swal.fire('Error', e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const moveRank = (idx: number, dir: -1 | 1) => {
        const next = [...rankBy];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setRankBy(next);
    };

    const toggleRank = (key: string) => {
        setRankBy(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const exportSeleksi = async () => {
        if (!outcome) return;
        try {
            const XLSX = await import('xlsx');
            const rows = [...outcome.results].sort((a,b) => (a.option || '').localeCompare(b.option || '') || (a.rank || 0) - (b.rank || 0));
            const headers = ['PROGRAM','PERINGKAT','STATUS',nameField?.label || 'NAMA', ...(secondaryField ? [secondaryField.label] : []), 'PILIHAN 1','PILIHAN 2', ...rankBy.map(k => k === TOTAL_SCORE_KEY ? 'TOTAL SKOR' : k), 'TOTAL SKOR'];
            const data = rows.map(r => { const resp=responseById[r.id]; const opt=outcome.summary.find(s => s.option===r.option); return [opt?.label || r.option || '-',r.rank ?? '-',STAGE_META[r.stage].label,resp?.data?.[nameField?.label] || '', ...(secondaryField ? [resp?.data?.[secondaryField.label] || ''] : []),r.choices[0] || '',r.choices[1] || '',...rankBy.map(k=>k===TOTAL_SCORE_KEY?r.scores.total:r.scores.categories[k]??0),r.scores.total]; });
            const workbook=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([headers,...data]),'Seleksi');
            XLSX.writeFile(workbook,'Seleksi_'+formTitle.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)+'.xlsx');
        } catch { Swal.fire('Gagal','Ekspor seleksi tidak berhasil','error'); }
    };

    if (choiceFields.length === 0) {
        return (
            <div style={{ ...card, textAlign: 'center', padding: '64px 24px' }}>
                <i className="bi bi-ui-checks text-4xl block mb-3 opacity-40 text-[#3083FF]" />
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--n-text)', margin: 0 }}>Formulir ini belum punya field pilihan</p>
                <p style={{ fontSize: '12px', color: 'var(--n-muted)', marginTop: '6px' }}>
                    Tambahkan field bertipe <b>Dropdown</b> atau <b>Radio</b> berisi daftar program agar seleksi kuota bisa dijalankan.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4" style={{ marginTop: '12px' }}>
            {/* ── PENGATURAN ── */}
            <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--n-text)', margin: '0 0 4px 0' }}>
                    <i className="bi bi-sliders2 text-[#3083FF] mr-2" />Pengaturan Kuota & Seleksi
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--n-muted)', margin: '0 0 18px 0' }}>
                    Peserta diranking per program berdasarkan Pilihan Pertama. Yang tidak tertampung diadu ulang
                    memperebutkan sisa kuota Pilihan Kedua{waitlist ? ', sisanya masuk daftar cadangan bernomor' : ''}.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: '18px' }}>
                    <div>
                        <label style={labelStyle}>Field Pilihan Pertama</label>
                        <select style={inputStyle} value={field1} onChange={e => setField1(e.target.value)}>
                            <option value="">— pilih field —</option>
                            {choiceFields.map((f: any) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Field Pilihan Kedua (opsional)</label>
                        <select style={inputStyle} value={field2} onChange={e => setField2(e.target.value)}>
                            <option value="">— tanpa pilihan kedua —</option>
                            {choiceFields.map((f: any) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                </div>

                <label style={labelStyle}>Kuota per Program</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ marginBottom: '18px' }}>
                    {optionsOfField1.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--n-muted)', fontStyle: 'italic' }}>Pilih field Pilihan Pertama dulu.</p>
                    ) : optionsOfField1.map(opt => (
                        <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--n-border)', borderRadius: '4px', padding: '8px 12px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--n-text)', flex: 1 }}>{opt.label}</span>
                            <input
                                type="number"
                                min={0}
                                value={quotas[opt.value] ?? ''}
                                onChange={e => setQuotas({ ...quotas, [opt.value]: e.target.value })}
                                placeholder="∞"
                                style={{ ...inputStyle, width: '80px', height: '32px', textAlign: 'center' }}
                                title="Kosongkan untuk tidak dibatasi"
                            />
                        </div>
                    ))}
                </div>

                <label style={labelStyle}>Dasar Perankingan (urut prioritas)</label>
                <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: '10px' }}>
                    {rankBy.length === 0 && (
                        <span style={{ fontSize: '12px', color: '#be123c', fontStyle: 'italic' }}>Belum ada kriteria — akan memakai total skor.</span>
                    )}
                    {rankBy.map((key, idx) => (
                        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--n-soft)', border: '1px solid var(--n-border)', borderRadius: '4px', padding: '4px 8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#3083FF' }}>{idx + 1}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a8a' }}>
                                {key === TOTAL_SCORE_KEY ? 'Total Skor' : key}
                            </span>
                            <button type="button" onClick={() => moveRank(idx, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0 }} title="Naikkan prioritas">
                                <i className="bi bi-chevron-up text-[10px]" />
                            </button>
                            <button type="button" onClick={() => moveRank(idx, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0 }} title="Turunkan prioritas">
                                <i className="bi bi-chevron-down text-[10px]" />
                            </button>
                            <button type="button" onClick={() => toggleRank(key)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--n-muted)', padding: 0 }} title="Hapus">
                                <i className="bi bi-x-lg text-[10px]" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2" style={{ marginBottom: '18px' }}>
                    {[...categories, TOTAL_SCORE_KEY].filter(k => !rankBy.includes(k)).map(key => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => toggleRank(key)}
                            style={{ fontSize: '11px', fontWeight: 700, color: 'var(--n-text)', backgroundColor: 'var(--n-soft)', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}
                        >
                            <i className="bi bi-plus-lg text-[9px] mr-1" />
                            {key === TOTAL_SCORE_KEY ? 'Total Skor' : key}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: '1px dashed var(--n-border)', paddingTop: '16px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={waitlist} onChange={e => setWaitlist(e.target.checked)} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--n-text)' }}>
                            Yang tidak tertampung jadi cadangan bernomor
                        </span>
                    </label>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" style={btn('ghost')} onClick={saveConfig} disabled={saving}>
                            <i className="bi bi-save" />{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                        </button>
                        <button type="button" style={btn('primary')} onClick={() => run(false)} disabled={running}>
                            <i className="bi bi-play-circle" />{running ? 'Menghitung...' : 'Pratinjau Seleksi'}
                        </button>
                        <button type="button" style={btn('accent')} onClick={() => run(true)} disabled={running || !outcome}>
                            <i className="bi bi-check2-square" />Simpan Hasil Seleksi
                        </button>
                    </div>
                </div>
            </div>

            {/* ── HASIL ── */}
            {!outcome ? (
                <div style={{ ...card, textAlign: 'center', padding: '56px 24px' }}>
                    <i className="bi bi-funnel text-4xl block mb-3 opacity-40 text-[#3083FF]" />
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--n-text)', margin: 0 }}>Belum ada hasil ditampilkan</p>
                    <p style={{ fontSize: '11px', color: 'var(--n-muted)', marginTop: '6px' }}>
                        Tekan <b>Pratinjau Seleksi</b> untuk menghitung tanpa menyentuh data. Hasil baru tersimpan
                        setelah Anda menekan <b>Simpan Hasil Seleksi</b>.
                    </p>
                </div>
            ) : (
                <>
                    {outcome.warnings.length > 0 && (
                        <div style={{ ...card, backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px 18px' }}>
                            {outcome.warnings.map((w, i) => (
                                <p key={i} style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', margin: 0 }}>
                                    <i className="bi bi-exclamation-triangle-fill mr-2" />{w}
                                </p>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--n-text)', margin: 0 }}>
                            {outcome.persisted
                                ? <span style={{ color: '#047857' }}><i className="bi bi-check-circle-fill mr-1" />Hasil ini sudah tersimpan di database</span>
                                : <span style={{ color: '#b45309' }}><i className="bi bi-eye mr-1" />Pratinjau — belum tersimpan</span>}
                        </p>
                        <button type="button" style={btn('ghost')} onClick={exportSeleksi}>
                            <i className="bi bi-file-earmark-spreadsheet-fill text-emerald-600" />Ekspor Hasil Seleksi
                        </button>
                    </div>

                    {/* Ringkasan kuota per program */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {outcome.summary.map(s => (
                            <div key={s.option} style={{ ...card, padding: '16px 18px' }}>
                                <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--n-text)', margin: 0 }}>{s.label}</h4>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#3083FF', backgroundColor: 'var(--n-soft)', border: '1px solid var(--n-border)', borderRadius: '4px', padding: '2px 8px' }}>
                                        {s.terisi}/{s.quota ?? '∞'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden', marginBottom: '10px' }}>
                                    <div style={{
                                        height: '100%',
                                        width: s.quota ? `${Math.min(100, Math.round((s.terisi / s.quota) * 100))}%` : '100%',
                                        background: 'linear-gradient(90deg,#38bdf8,#0369a1)',
                                    }} />
                                </div>
                                <div className="grid grid-cols-2 gap-y-1" style={{ fontSize: '11px', color: 'var(--n-text)', fontWeight: 600 }}>
                                    <span>Lewat pilihan 1</span><span style={{ textAlign: 'right', color: '#047857', fontWeight: 800 }}>{s.pilihan1}</span>
                                    <span>Lewat pilihan 2</span><span style={{ textAlign: 'right', color: '#0369a1', fontWeight: 800 }}>{s.pilihan2}</span>
                                    <span>Cadangan</span><span style={{ textAlign: 'right', color: '#b45309', fontWeight: 800 }}>{s.cadangan}</span>
                                    <span>Peminat pilihan 1</span><span style={{ textAlign: 'right', fontWeight: 800 }}>{s.peminatPilihan1}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Daftar per program */}
                    {outcome.summary.map(s => {
                        const rows = outcome.results
                            .filter(r => r.option === s.option)
                            .sort((a, b) => {
                                const order = ['pilihan_1', 'pilihan_2', 'cadangan', 'tidak_diterima'];
                                const d = order.indexOf(a.stage) - order.indexOf(b.stage);
                                if (d !== 0) return d;
                                return (a.rank || 0) - (b.rank || 0);
                            });
                        if (rows.length === 0) return null;

                        return (
                            <div key={s.option} style={{ ...card, padding: '0', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--n-border)', backgroundColor: 'var(--n-soft)' }} className="flex items-center justify-between flex-wrap gap-2">
                                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--n-text)', margin: 0 }}>
                                        <i className="bi bi-people-fill text-[#3083FF] mr-2" />{s.label}
                                    </h4>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--n-muted)' }}>
                                        {s.terisi} diterima{s.cadangan > 0 ? ` • ${s.cadangan} cadangan` : ''}
                                    </span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ backgroundColor: 'var(--n-card)' }}>
                                            <tr>
                                                <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 800, color: 'var(--n-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--n-border)', width: '60px' }}>#</th>
                                                <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 800, color: 'var(--n-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--n-border)', textAlign: 'left' }}>{nameField?.label || 'Responden'}</th>
                                                {secondaryField && <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 800, color: 'var(--n-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--n-border)', textAlign: 'left' }}>{secondaryField.label}</th>}
                                                <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 800, color: 'var(--n-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--n-border)', textAlign: 'center' }}>Status</th>
                                                {rankBy.map(k => (
                                                    <th key={k} style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 800, color: '#3083FF', textTransform: 'uppercase', borderBottom: '1px solid var(--n-border)', textAlign: 'center' }}>
                                                        {k === TOTAL_SCORE_KEY ? 'Total' : k}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rows.map(r => {
                                                const resp = responseById[r.id];
                                                const meta = STAGE_META[r.stage];
                                                return (
                                                    <tr key={r.id} style={{ backgroundColor: r.stage === 'cadangan' ? '#fffdf5' : undefined }}>
                                                        <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 800, color: 'var(--n-muted)' }}>{r.rank ?? '-'}</td>
                                                        <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--n-text)' }}>
                                                            {resp?.data?.[nameField?.label] || '(tanpa nama)'}
                                                        </td>
                                                        {secondaryField && (
                                                            <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--n-text)', fontWeight: 600 }}>
                                                                {resp?.data?.[secondaryField.label] || '-'}
                                                            </td>
                                                        )}
                                                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                            <span style={{ fontSize: '10px', fontWeight: 800, color: meta.color, backgroundColor: meta.bg, border: `1px solid ${meta.border}`, borderRadius: '4px', padding: '2px 8px' }}>
                                                                {meta.label}
                                                            </span>
                                                        </td>
                                                        {rankBy.map(k => (
                                                            <td key={k} style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 800, color: '#3083FF', textAlign: 'center' }}>
                                                                {k === TOTAL_SCORE_KEY ? r.scores.total : (r.scores.categories[k] ?? 0)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}

                    {outcome.unplaced > 0 && (
                        <div style={{ ...card, backgroundColor: '#fff1f2', border: '1px solid #fecdd3' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#be123c', margin: 0 }}>
                                <i className="bi bi-person-x-fill mr-2" />
                                {outcome.unplaced} tanggapan tidak tertempatkan (tidak mengisi pilihan{waitlist ? '' : ' atau kedua pilihannya penuh'}).
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
