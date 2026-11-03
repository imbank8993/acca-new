'use client';
import { useEffect, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';
import './bulk-payment.css';

type Candidate = { key: string; name: string; nip: string; label: string; amount: number };
type Receipt = { id: string; filename: string; extracted: { recipient: string; bank: string; account: string; amount: number | null; date: string; reference: string; status: string }; suggestedKey: string; ready: boolean; reason: string; applied_at?: string; paymentActive?: boolean; selected?: Candidate };
type Row = { localId: string; file?: File; filename: string; receipt?: Receipt; key: string; checked: boolean; reviewed: boolean; error?: string };
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
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
export default function BulkPaymentModal({ initialKind, initialMonth, initialYear, onClose, onApplied }: { initialKind: string; initialMonth: number; initialYear: number; onClose: () => void; onApplied: () => void }) {
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
    const input = useRef<HTMLInputElement>(null);
    const lock = useRef(false);
    const scope = { kind, month, year, batchId };
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        try { sessionStorage.setItem('payment-batch', JSON.stringify({ id: batchId, kind, month, year })); } catch { /* Optional resume only. */ }
        request('/api/pembayaran-massal?' + new URLSearchParams({ kind, month: String(month), year: String(year), batchId })).then(data => {
            if (!active) return;
            setConfigured(data.configured); setCandidates(data.candidates);
            setRows(data.receipts.map((r: Receipt) => ({ localId: r.id, filename: r.filename, receipt: r, key: r.selected?.key || r.suggestedKey, checked: r.ready && !r.applied_at, reviewed: false })));
        }).catch(e => { if (active) { setConfigured(false); setError(e.message); } }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [kind, month, year, batchId]);
    const update = (id: string, patch: Partial<Row>) => setRows(old => old.map(r => r.localId === id ? { ...r, ...patch } : r));
    const analyze = async (queue: Row[]) => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(''); setMessage('');
        try {
            for (let i = 0; i < queue.length; i++) {
                const row = queue[i];
                setProgress(`Membaca ${i + 1} dari ${queue.length} bukti…`);
                try {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Berkas tidak dapat dibaca.')); reader.readAsDataURL(row.file!);
                    });
                    const data = await request('/api/pembayaran-massal', { ...scope, action: 'analyze', receiptId: row.localId, base64, filename: row.filename });
                    setCandidates(data.candidates);
                    setRows(old => old.map(r => r.localId === row.localId ? { ...r, receipt: data.receipt, key: data.receipt.suggestedKey, checked: data.receipt.ready && !data.receipt.applied_at && !old.some(other => other.localId !== r.localId && other.checked && other.key === data.receipt.suggestedKey), reviewed: false, error: undefined } : r));
                } catch (e: any) { update(row.localId, { error: e.message }); }
            }
        } finally { lock.current = false; setBusy(false); setProgress(''); }
    };
    const addFiles = (files: File[]) => {
        if (lock.current || loading || !configured) return;
        if (files.length + rows.length > 30) { setError('Maksimal 30 gambar dalam satu paket.'); return; }
        if (files.some(f => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024 || !f.size)) { setError('Gunakan JPG, PNG, atau WEBP maksimal 5 MB per gambar.'); return; }
        const queue = files.map(file => ({ localId: crypto.randomUUID(), filename: file.name, file, key: '', checked: false, reviewed: false }));
        setRows(old => [...old, ...queue]); void analyze(queue);
    };
    const duplicate = (row: Row) => !!row.key && rows.some(r => r.localId !== row.localId && r.checked && r.key === row.key && !r.receipt?.applied_at);
    const eligible = (r: Row) => {
        const c = candidates.find(c => c.key === r.key);
        return !!r.receipt && !r.receipt.applied_at && r.receipt.extracted.status === 'success' && !!c && c.amount === r.receipt.extracted.amount && (r.reviewed || (r.receipt.ready && r.receipt.suggestedKey === r.key));
    };
    const selected = rows.filter(r => r.checked && eligible(r));
    const apply = async () => {
        if (lock.current || !selected.length) return;
        if (new Set(selected.map(r => r.key)).size !== selected.length) { setError('Pilih satu bukti untuk setiap tagihan.'); return; }
        lock.current = true; setBusy(true); setError(''); setMessage('');
        try {
            const data = await request('/api/pembayaran-massal', { ...scope, action: 'apply', selections: selected.map(r => ({ id: r.receipt!.id, key: r.key, reviewed: r.reviewed })) });
            const ids = new Set(selected.map(r => r.localId));
            setRows(old => old.map(r => ids.has(r.localId) ? { ...r, checked: false, receipt: { ...r.receipt!, selected: candidates.find(c => c.key === r.key), paymentActive: true, applied_at: new Date().toISOString() } } : r));
            setMessage(`${data.count} bukti berhasil diterapkan. Pembayaran telah ditandai dibayar.`); onApplied();
        } catch (e: any) { setError(e.message); }
        finally { lock.current = false; setBusy(false); }
    };
    const close = () => { if (!lock.current) onClose(); };
    return <Modal size="xl" title="Upload Bukti Pembayaran Massal" subtitle="Pilih periode, unggah bukti, lalu periksa hasil pencocokan." icon="receipt" labelledBy="bulk-payment-title" onClose={close} closeOnOverlayClick={false} className="bulk-payment-modal">
        <ModalBody>
            <div className="bp-scope">
                <label>Jenis pembayaran<InlineSelect title="Jenis pembayaran" value={kind} onChange={setKind} disabled={busy || rows.length > 0} options={[{ value: 'GURU_ASUH', label: 'Guru Asuh' }, { value: 'KLINIK', label: 'Klinik' }, { value: 'EKSKUL', label: 'Ekstrakurikuler' }]} /></label>
                <label>Bulan kegiatan<InlineSelect title="Bulan kegiatan" value={String(month)} onChange={v => setMonth(Number(v))} disabled={busy || rows.length > 0} options={months.map((label, i) => ({ value: String(i + 1), label }))} /></label>
                <label>Tahun<InlineSelect title="Tahun" value={String(year)} onChange={v => setYear(Number(v))} disabled={busy || rows.length > 0} options={Array.from(new Set([year, ...Array.from({ length: 7 }, (_, i) => now.year + 1 - i)])).sort((a, b) => b - a).map(v => ({ value: String(v), label: String(v) }))} /></label>
            </div>
            <p className="bp-hint">Bukti dicocokkan dengan tagihan yang sudah disahkan dan belum dibayar pada periode ini. Gambar dibaca secara lokal di server ACCA.</p>
            {error && <div className="bp-notice bp-notice--error" role="alert">{error}</div>}
            {!loading && !configured && !error && <div className="bp-notice" role="status">Pembaca gambar lokal belum tersedia. Administrator perlu memperbarui aplikasi beserta paket pembaca gambarnya.</div>}
            {message && <div className="bp-notice bp-notice--success" role="status">{message}</div>}
            <div className="bp-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}>
                <i className="bi bi-cloud-arrow-up" aria-hidden="true" /><strong>{busy ? progress || 'Menyimpan pembayaran…' : 'Tarik gambar bukti transfer ke sini'}</strong>
                <span>JPG, PNG, WEBP · Maksimal 5 MB per gambar · 30 bukti per paket</span>
                <Button variant="outline" size="sm" disabled={busy || loading || !configured} onClick={() => input.current?.click()}>{loading ? 'Memuat…' : 'Pilih Gambar'}</Button>
                <input ref={input} aria-label="Pilih gambar bukti transfer" type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            </div>
            {!loading && configured && !candidates.length && <p className="bp-hint">Tidak ada tagihan siap bayar dengan nominal valid untuk pilihan ini. Periksa persetujuan laporan dan tarif honor.</p>}
            {rows.length > 0 && <div className="bp-summary" aria-live="polite"><strong>{rows.length} bukti</strong><span>{selected.length} dipilih · {money(selected.reduce((sum, r) => sum + (r.receipt?.extracted.amount || 0), 0))}</span></div>}
            <div className="bp-rows">{rows.map(row => {
                const receipt = row.receipt;
                const manual = !!receipt && (!receipt.ready || receipt.suggestedKey !== row.key);
                const paid = !!receipt?.applied_at;
                return <article key={row.localId} className="bp-row">
                    <div className="bp-row-head"><label className="bp-check"><input type="checkbox" aria-label={`Pilih ${row.filename}`} checked={row.checked} disabled={busy || !eligible(row) || (!row.checked && duplicate(row))} onChange={e => update(row.localId, { checked: e.target.checked })} /><strong>{row.filename}</strong></label><span className={`bp-status ${(paid && receipt.paymentActive !== false) || (!paid && receipt?.ready) ? 'bp-status--success' : ''}`}>{paid ? receipt.paymentActive === false ? 'Dibatalkan / berubah' : 'Dibayar' : row.error ? 'Gagal dibaca' : receipt ? receipt.ready ? 'Cocok' : 'Perlu diperiksa' : 'Menunggu'}</span></div>
                    {row.error && <div className="bp-notice bp-notice--error" role="alert">{row.error}{row.file && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void analyze([row])}>Coba Lagi</Button>}</div>}
                    {receipt && <>
                        <div className="bp-extracted"><span><small>Penerima terbaca</small>{receipt.extracted.recipient || 'Tidak terbaca'}</span><span><small>Rekening tujuan</small>{receipt.extracted.bank} {receipt.extracted.account || 'Tidak terbaca'}</span><span><small>Nominal transfer</small>{money(receipt.extracted.amount)}</span><span><small>Tanggal / Referensi</small>{receipt.extracted.date || '—'} · {receipt.extracted.reference || '—'}</span></div>
                        <div className="bp-mapping"><InlineSelect title={`Tujuan pembayaran ${row.filename}`} minWidth="0" value={row.key} disabled={busy || paid} onChange={key => update(row.localId, { key, reviewed: false, checked: false })} options={[{ value: '', label: 'Pilih tujuan pembayaran…' }, ...(paid && receipt.selected && !candidates.some(c => c.key === receipt.selected!.key) ? [receipt.selected] : []), ...candidates].map(c => 'name' in c ? ({ value: c.key, label: `${c.name} · ${c.label} · ${money(c.amount)}`, disabled: c.amount !== receipt.extracted.amount }) : c)} /><Button size="sm" variant="ghost" onClick={() => setPreview(preview === receipt.id ? '' : receipt.id)}>{preview === receipt.id ? 'Tutup Bukti' : 'Lihat Bukti'}</Button></div>
                        {preview === receipt.id && <img className="bp-preview" src={`/api/pembayaran-massal/bukti?id=${receipt.id}`} alt={`Bukti transfer ${row.filename}`} />}
                        {!paid && <p className="bp-hint">{receipt.reason}{receipt.extracted.status !== 'success' && ' · Bukti ini tidak dapat ditandai dibayar.'}{duplicate(row) && ' · Tujuan ini sudah dipilih pada bukti lain.'}</p>}
                        {!paid && manual && row.key && receipt.extracted.status === 'success' && <label className="bp-review"><input type="checkbox" checked={row.reviewed} disabled={busy} onChange={e => update(row.localId, { reviewed: e.target.checked, checked: e.target.checked })} />Saya sudah memeriksa bukti dan memastikan penerima serta tujuan pembayaran benar.</label>}
                    </>}
                </article>;
            })}</div>
        </ModalBody>
        <ModalFooter align="between"><div><Button variant="ghost" disabled={busy || !rows.length} onClick={() => { setRows([]); setBatchId(crypto.randomUUID()); setMessage(''); setPreview(''); }}>Paket Baru</Button></div><div className="bp-footer-actions"><Button variant="cancel" disabled={busy} onClick={close}>Tutup</Button><Button variant="primary" disabled={busy || !selected.length} isLoading={busy} onClick={() => void apply()}>Terapkan {selected.length || ''} Pembayaran</Button></div></ModalFooter>
    </Modal>;
}
