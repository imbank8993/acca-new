'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalField } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import { BULAN, StatusBadge, type BadgeTone } from './parts';
import './bulk-payment.css';

type Candidate = { key: string; name: string; nip: string; label: string; amount: number };
type Receipt = {
    id: string;
    filename: string;
    extracted: { recipient: string; bank: string; account: string; amount: number | null; date: string; reference: string; status: string };
    suggestedKey: string;
    ready: boolean;
    reason: string;
    applied_at?: string;
    paymentActive?: boolean;
    selected?: Candidate;
};
type Row = { localId: string; file?: File; filename: string; receipt?: Receipt; key: string; checked: boolean; reviewed: boolean; error?: string };

const money = (n: number | null) => n == null ? 'Tidak terbaca' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const today = () => {
    const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Makassar' }).formatToParts(new Date());
    return { year: Number(parts.find(p => p.type === 'year')?.value), month: Number(parts.find(p => p.type === 'month')?.value) };
};

async function request(url: string, body?: any) {
    const res = await authFetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || data.message || 'Permintaan gagal. Silakan coba kembali.');
    return data;
}

export default function BulkPaymentModal({ initialKind, initialMonth, initialYear, onClose, onApplied }: {
    initialKind: string;
    initialMonth: number;
    initialYear: number;
    onClose: () => void;
    onApplied: () => void;
}) {
    const now = today();
    const [kind, setKind] = useState(initialKind);
    const [month, setMonth] = useState(initialMonth || now.month);
    const [year, setYear] = useState(initialYear || now.year);
    const [batchId, setBatchId] = useState(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem('payment-batch') || 'null');
            if (saved?.kind === initialKind && saved.month === (initialMonth || now.month) && saved.year === (initialYear || now.year) && /^[0-9a-f-]{36}$/i.test(saved.id)) return saved.id as string;
        } catch { /* Storage may be unavailable in private browsing. */ }
        return crypto.randomUUID();
    });
    const [rows, setRows] = useState<Row[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [configured, setConfigured] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState('');
    const [preview, setPreview] = useState('');
    const [dragging, setDragging] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const lock = useRef(false);
    const scope = { kind, month, year, batchId };

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        try { sessionStorage.setItem('payment-batch', JSON.stringify({ id: batchId, kind, month, year })); } catch { /* Optional resume only. */ }
        request('/api/pembayaran-massal?' + new URLSearchParams({ kind, month: String(month), year: String(year), batchId })).then(data => {
            if (!active) return;
            setConfigured(data.configured);
            setCandidates(data.candidates);
            setRows(data.receipts.map((r: Receipt) => ({ localId: r.id, filename: r.filename, receipt: r, key: r.selected?.key || r.suggestedKey, checked: r.ready && !r.applied_at, reviewed: false })));
        }).catch(e => {
            if (active) { setConfigured(false); setError(e.message); }
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [kind, month, year, batchId]);

    const update = (id: string, patch: Partial<Row>) => setRows(old => old.map(r => r.localId === id ? { ...r, ...patch } : r));

    const analyze = async (queue: Row[]) => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            for (let i = 0; i < queue.length; i++) {
                const row = queue[i];
                setProgress(`Membaca ${i + 1} dari ${queue.length} bukti…`);
                try {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result).split(',')[1]);
                        reader.onerror = () => reject(new Error('Berkas tidak dapat dibaca.'));
                        reader.readAsDataURL(row.file!);
                    });
                    const data = await request('/api/pembayaran-massal', { ...scope, action: 'analyze', receiptId: row.localId, base64, filename: row.filename });
                    setCandidates(data.candidates);
                    setRows(old => old.map(r => r.localId === row.localId ? {
                        ...r,
                        receipt: data.receipt,
                        key: data.receipt.suggestedKey,
                        checked: data.receipt.ready && !data.receipt.applied_at && !old.some(other => other.localId !== r.localId && other.checked && other.key === data.receipt.suggestedKey),
                        reviewed: false,
                        error: undefined,
                    } : r));
                } catch (e: any) { update(row.localId, { error: e.message }); }
            }
        } finally {
            lock.current = false;
            setBusy(false);
            setProgress('');
        }
    };

    const addFiles = (files: File[]) => {
        if (lock.current || loading || !configured) return;
        if (files.length + rows.length > 30) { setError('Maksimal 30 gambar dalam satu paket.'); return; }
        if (files.some(f => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024 || !f.size)) {
            setError('Gunakan JPG, PNG, atau WEBP maksimal 5 MB per gambar.');
            return;
        }
        const queue = files.map(file => ({ localId: crypto.randomUUID(), filename: file.name, file, key: '', checked: false, reviewed: false }));
        setRows(old => [...old, ...queue]);
        void analyze(queue);
    };

    const duplicate = (row: Row) => !!row.key && rows.some(r => r.localId !== row.localId && r.checked && r.key === row.key && !r.receipt?.applied_at);
    const eligible = (r: Row) => {
        const c = candidates.find(c => c.key === r.key);
        return !!r.receipt && !r.receipt.applied_at && r.receipt.extracted.status === 'success' && !!c && c.amount === r.receipt.extracted.amount
            && (r.reviewed || (r.receipt.ready && r.receipt.suggestedKey === r.key));
    };
    const selected = rows.filter(r => r.checked && eligible(r));

    const apply = async () => {
        if (lock.current || !selected.length) return;
        if (new Set(selected.map(r => r.key)).size !== selected.length) { setError('Pilih satu bukti untuk setiap tagihan.'); return; }
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const data = await request('/api/pembayaran-massal', { ...scope, action: 'apply', selections: selected.map(r => ({ id: r.receipt!.id, key: r.key, reviewed: r.reviewed })) });
            const ids = new Set(selected.map(r => r.localId));
            setRows(old => old.map(r => ids.has(r.localId) ? { ...r, checked: false, receipt: { ...r.receipt!, selected: candidates.find(c => c.key === r.key), paymentActive: true, applied_at: new Date().toISOString() } } : r));
            setMessage(`${data.count} bukti berhasil diterapkan. Pembayaran telah ditandai dibayar.`);
            onApplied();
        } catch (e: any) { setError(e.message); }
        finally {
            lock.current = false;
            setBusy(false);
        }
    };

    const close = () => { if (!lock.current) onClose(); };
    const scopeLocked = busy || rows.length > 0;
    const years = Array.from(new Set([year, ...Array.from({ length: 7 }, (_, i) => now.year + 1 - i)])).sort((a, b) => b - a);

    const statusOf = (row: Row): { tone: BadgeTone; label: string } => {
        const receipt = row.receipt;
        if (receipt?.applied_at) return receipt.paymentActive === false ? { tone: 'void', label: 'Dibatalkan / berubah' } : { tone: 'paid', label: 'Dibayar' };
        if (row.error) return { tone: 'void', label: 'Gagal dibaca' };
        if (!receipt) return { tone: 'neutral', label: 'Membaca…' };
        return receipt.ready ? { tone: 'paid', label: 'Cocok' } : { tone: 'unpaid', label: 'Perlu diperiksa' };
    };

    return (
        <Modal
            size="xl"
            title="Upload Bukti Pembayaran Massal"
            subtitle="Pilih periode, unggah bukti transfer, lalu periksa hasil pencocokan."
            icon="cloud-arrow-up"
            labelledBy="bulk-payment-title"
            onClose={close}
            closeOnOverlayClick={false}
            className="bulk-payment-modal"
        >
            <ModalBody>
                <ol className="bp-steps" aria-label="Langkah">
                    <li className="is-active"><span>1</span>Pilih periode</li>
                    <li className={rows.length ? 'is-active' : ''}><span>2</span>Unggah bukti</li>
                    <li className={selected.length ? 'is-active' : ''}><span>3</span>Terapkan</li>
                </ol>

                <div className="bp-scope">
                    <ModalField label="Jenis pembayaran">
                        <InlineSelect title="Jenis pembayaran" value={kind} onChange={setKind} disabled={scopeLocked} options={[{ value: 'GURU_ASUH', label: 'Guru Asuh' }, { value: 'KLINIK', label: 'Klinik' }, { value: 'EKSKUL', label: 'Ekstrakurikuler' }]} />
                    </ModalField>
                    <ModalField label="Bulan kegiatan">
                        <InlineSelect title="Bulan kegiatan" value={String(month)} onChange={v => setMonth(Number(v))} disabled={scopeLocked} options={BULAN.map((label, i) => ({ value: String(i + 1), label }))} />
                    </ModalField>
                    <ModalField label="Tahun">
                        <InlineSelect title="Tahun" value={String(year)} onChange={v => setYear(Number(v))} disabled={scopeLocked} options={years.map(v => ({ value: String(v), label: String(v) }))} />
                    </ModalField>
                </div>
                {rows.length > 0 && <p className="bp-hint"><i className="bi bi-lock" /> Periode terkunci selama paket berisi bukti. Gunakan “Paket Baru” untuk mengganti periode.</p>}

                {error && <div className="pay-alert pay-alert--error" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}
                {!loading && !configured && !error && (
                    <div className="pay-alert pay-alert--warning" role="status"><i className="bi bi-exclamation-triangle" />Pembaca gambar lokal belum tersedia. Administrator perlu memperbarui aplikasi beserta paket pembaca gambarnya.</div>
                )}
                {message && <div className="pay-alert pay-alert--success" role="status"><i className="bi bi-check-circle" />{message}</div>}

                <div
                    className={`bp-drop ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                >
                    <span className="bp-drop__icon" aria-hidden="true"><i className={`bi ${busy ? 'bi-hourglass-split' : 'bi-cloud-arrow-up'}`} /></span>
                    <strong>{busy ? progress || 'Menyimpan pembayaran…' : 'Tarik gambar bukti transfer ke sini'}</strong>
                    <span>JPG, PNG, WEBP · maks. 5 MB per gambar · 30 bukti per paket</span>
                    <Button variant="outline" size="sm" disabled={busy || loading || !configured} onClick={() => input.current?.click()}>
                        {loading ? 'Memuat…' : 'Pilih Gambar'}
                    </Button>
                    <input ref={input} aria-label="Pilih gambar bukti transfer" type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
                </div>
                <p className="bp-hint">Bukti dicocokkan dengan tagihan yang sudah disahkan dan belum dibayar pada periode ini. Gambar dibaca secara lokal di server ACCA.</p>
                {!loading && configured && !candidates.length && (
                    <p className="bp-hint bp-hint--warn">Tidak ada tagihan siap bayar dengan nominal valid untuk pilihan ini. Periksa persetujuan {kind === 'GURU_ASUH' ? 'kegiatan' : 'laporan'} dan tarif honor.</p>
                )}

                {rows.length > 0 && (
                    <div className="bp-summary" aria-live="polite">
                        <strong>{rows.length} bukti</strong>
                        <span>{selected.length} dipilih · {money(selected.reduce((sum, r) => sum + (r.receipt?.extracted.amount || 0), 0))}</span>
                    </div>
                )}

                <div className="bp-rows">
                    {rows.map(row => {
                        const receipt = row.receipt;
                        const manual = !!receipt && (!receipt.ready || receipt.suggestedKey !== row.key);
                        const paid = !!receipt?.applied_at;
                        const st = statusOf(row);
                        return (
                            <article key={row.localId} className={`bp-row ${row.checked ? 'is-checked' : ''}`}>
                                <div className="bp-row-head">
                                    <label className="bp-check">
                                        <input
                                            type="checkbox"
                                            className="ui-checkbox"
                                            aria-label={`Pilih ${row.filename}`}
                                            checked={row.checked}
                                            disabled={busy || !eligible(row) || (!row.checked && duplicate(row))}
                                            onChange={e => update(row.localId, { checked: e.target.checked })}
                                        />
                                        <i className="bi bi-image" aria-hidden="true" />
                                        <strong title={row.filename}>{row.filename}</strong>
                                    </label>
                                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                                </div>

                                {row.error && (
                                    <div className="pay-alert pay-alert--error" role="alert">
                                        <i className="bi bi-exclamation-circle" />{row.error}
                                        {row.file && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void analyze([row])}>Coba Lagi</Button>}
                                    </div>
                                )}

                                {receipt && (
                                    <>
                                        <dl className="bp-extracted">
                                            <div><dt>Penerima terbaca</dt><dd>{receipt.extracted.recipient || 'Tidak terbaca'}</dd></div>
                                            <div><dt>Rekening tujuan</dt><dd>{receipt.extracted.bank} {receipt.extracted.account || 'Tidak terbaca'}</dd></div>
                                            <div><dt>Nominal transfer</dt><dd className="bp-amount">{money(receipt.extracted.amount)}</dd></div>
                                            <div><dt>Tanggal / Referensi</dt><dd>{receipt.extracted.date || '—'} · {receipt.extracted.reference || '—'}</dd></div>
                                        </dl>
                                        <div className="bp-mapping">
                                            <span className="bp-mapping__label">Tujuan pembayaran</span>
                                            <InlineSelect
                                                title={`Tujuan pembayaran ${row.filename}`}
                                                minWidth="0"
                                                value={row.key}
                                                disabled={busy || paid}
                                                onChange={key => update(row.localId, { key, reviewed: false, checked: false })}
                                                options={[
                                                    { value: '', label: 'Pilih tujuan pembayaran…' },
                                                    ...[...(paid && receipt.selected && !candidates.some(c => c.key === receipt.selected!.key) ? [receipt.selected] : []), ...candidates]
                                                        .map(c => ({ value: c.key, label: `${c.name} · ${c.label} · ${money(c.amount)}`, disabled: c.amount !== receipt.extracted.amount })),
                                                ]}
                                            />
                                            <Button size="sm" variant="ghost" leftIcon={<i className={`bi bi-${preview === receipt.id ? 'eye-slash' : 'eye'}`} />} onClick={() => setPreview(preview === receipt.id ? '' : receipt.id)}>
                                                {preview === receipt.id ? 'Tutup Bukti' : 'Lihat Bukti'}
                                            </Button>
                                        </div>
                                        {preview === receipt.id && <img className="bp-preview" src={`/api/pembayaran-massal/bukti?id=${receipt.id}`} alt={`Bukti transfer ${row.filename}`} />}
                                        {!paid && (
                                            <p className="bp-hint">
                                                {receipt.reason}
                                                {receipt.extracted.status !== 'success' && ' · Bukti ini tidak dapat ditandai dibayar.'}
                                                {duplicate(row) && ' · Tujuan ini sudah dipilih pada bukti lain.'}
                                            </p>
                                        )}
                                        {!paid && manual && row.key && receipt.extracted.status === 'success' && (
                                            <label className="bp-review">
                                                <input type="checkbox" className="ui-checkbox" checked={row.reviewed} disabled={busy} onChange={e => update(row.localId, { reviewed: e.target.checked, checked: e.target.checked })} />
                                                Saya sudah memeriksa bukti dan memastikan penerima serta tujuan pembayaran benar.
                                            </label>
                                        )}
                                    </>
                                )}
                            </article>
                        );
                    })}
                </div>
            </ModalBody>
            <ModalFooter align="between">
                <div>
                    <Button
                        variant="ghost"
                        leftIcon={<i className="bi bi-plus-square" />}
                        disabled={busy || !rows.length}
                        onClick={() => { setRows([]); setBatchId(crypto.randomUUID()); setMessage(''); setPreview(''); }}
                    >
                        Paket Baru
                    </Button>
                </div>
                <div className="bp-footer-actions">
                    <Button variant="cancel" disabled={busy} onClick={close}>Tutup</Button>
                    <Button variant="primary" disabled={busy || !selected.length} isLoading={busy} leftIcon={<i className="bi bi-check2-all" />} onClick={() => void apply()}>
                        Terapkan {selected.length || ''} Pembayaran
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}
