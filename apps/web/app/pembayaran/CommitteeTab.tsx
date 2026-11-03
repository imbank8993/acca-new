'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { Modal, ModalBody, ModalFooter, ModalField, ModalFileInput } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { DetailHeader } from '@/components/ui/DetailHeader';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import DocViewerModal from '@/components/ui/DocViewerModal';
import { BULAN, fmtRupiah, fmtTanggal, StatCards, StatusBadge, EmptyState, type BadgeTone } from './parts';

const day = (v: any) => v ? String(v).slice(0, 10) : '';
const localDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const statusOf = (total: any, paid: any) => Number(paid) <= 0 ? 'Belum Dibayar' : Number(paid) >= Number(total) ? 'Lunas' : 'Dibayar Sebagian';
const toneOf = (status: string): BadgeTone => status === 'Lunas' ? 'paid' : status === 'Dibayar Sebagian' ? 'partial' : 'unpaid';
const flowLabel = (flow: string) => flow === 'PJ_ADVANCE' ? 'PJ → Penerima' : flow === 'REIMBURSEMENT' ? 'Bendahara → PJ (penggantian)' : 'Bendahara → Penerima';
const outstandingAdvance = (item: any) => Number(item.advanced || 0) - Number(item.reimbursed || 0);
const recipientRemaining = (item: any) => Number(item.amount) - Number(item.paid) - outstandingAdvance(item);
const percent = (part: number, whole: number) => whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
const dateRange = (a: any, b: any) => {
    const start = day(a), end = day(b);
    return start === end ? fmtTanggal(start) : `${fmtTanggal(start)} – ${fmtTanggal(end)}`;
};

async function api(url: string, body?: any) {
    const res = await authFetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || data.message || 'Gagal memproses data.');
    return data;
}

type Attachment = { name: string; url: string };
type FormKind = 'activity' | 'term' | 'item' | 'payment' | 'history' | 'delete-item' | 'cancel-payment' | 'edit-proof';

const isViewable = (url: string) => /\.(pdf|png|jpe?g|webp|gif)(\?|$)/i.test(url);

export default function CommitteeTab() {
    const [activities, setActivities] = useState<any[]>([]);
    const [data, setData] = useState<any>(null);
    const [selected, setSelected] = useState('');
    const [termId, setTermId] = useState('');
    const [canPay, setCanPay] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [form, setForm] = useState<any>(null);
    const [formError, setFormError] = useState('');
    const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
    const [canRecordAdvance, setCanRecordAdvance] = useState(false);
    const [ownerId, setOwnerId] = useState('');
    const saving = useRef(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api('/api/payments/committee');
            setActivities(r.data);
            setCanPay(r.canPay);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    const loadDetail = useCallback(async (id: string) => {
        const r = await api('/api/payments/committee/detail?id=' + encodeURIComponent(id));
        setData(r.data);
        setCanEdit(r.canEdit);
        setCanRecordAdvance(r.canRecordAdvance);
        setOwnerId(r.ownerId);
        setCanPay(r.canPay);
        setTermId(old => r.data.terms.some((t: any) => t.id === old) ? old : r.data.terms[0]?.id || '');
    }, []);

    useEffect(() => { void loadList(); }, [loadList]);

    // Pesan sukses hilang sendiri supaya tidak menumpuk di atas konten.
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(''), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    const open = async (id: string) => {
        setError('');
        setNotice('');
        setLoading(true);
        try {
            await loadDetail(id);
            setSelected(id);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const back = () => {
        setSelected('');
        setData(null);
        setNotice('');
        setError('');
    };

    const start = (kind: FormKind, old: any = {}) => {
        const today = localDay(), month = Number(today.slice(5, 7)), year = Number(today.slice(0, 4));
        setFormError('');
        setNotice('');
        setForm({
            kind, title: '', description: '', recipient: '', quantity: 1, unit: 'paket', unit_price: '', month, year,
            attachments: [], files: [], reason: '', note: '', paid_on: today, amount: '', remaining: old.amount,
            requestId: crypto.randomUUID(), ...old,
            start_date: day(old.start_date) || today, end_date: day(old.end_date) || today,
        });
    };

    const change = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));

    const upload = async (file: File) => {
        if (file.size > 15 * 1024 * 1024) throw new Error('Maksimal 15 MB per lampiran.');
        const body = new FormData();
        body.append('file', file);
        body.append('folder', 'pengajuan-komite');
        const res = await authFetch('/api/upload', { method: 'POST', body });
        const r = await res.json();
        if (!res.ok || !r.ok) throw new Error(r.error || 'Gagal mengunggah lampiran.');
        const url = r.publicUrl || r.url || r.file_url;
        if (!url) throw new Error('Tautan lampiran belum tersedia.');
        return { name: file.name, url };
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setFormError('');
        try {
            const body = { ...form, activityId: selected, termId, quantity: Number(form.quantity), unit_price: Number(form.unit_price), amount: Number(form.amount) };
            if (form.kind === 'term' || form.kind === 'payment' || form.kind === 'edit-proof') {
                const attachments: Attachment[] = [...(form.attachments || [])];
                if (attachments.length + (form.files?.length || 0) > 10) throw new Error('Maksimal 10 lampiran.');
                for (const f of form.files || []) attachments.push(await upload(f));
                body.attachments = attachments;
                setForm((old: any) => ({ ...old, attachments, files: [] }));
            }
            if (['payment', 'edit-proof'].includes(form.kind) && !body.attachments.length) throw new Error('Lampirkan bukti transfer terlebih dahulu.');
            delete body.files;
            const r = await api('/api/payments/committee', body);
            const activityId = form.kind === 'activity' ? (form.id || r.id) : selected;
            await loadList();
            await loadDetail(activityId);
            setSelected(activityId);
            if (form.kind === 'term') setTermId(r.id);
            setForm(null);
            setNotice(form.kind === 'payment' ? 'Pembayaran berhasil dicatat.' : form.kind === 'cancel-payment' ? 'Pembayaran dibatalkan dan riwayatnya tetap tersimpan.' : 'Data berhasil disimpan.');
        } catch (err: any) { setFormError(err.message); }
        finally {
            saving.current = false;
            setBusy(false);
        }
    };

    /* ------------------------------ Turunan ------------------------------- */

    const activity = data?.activity;
    const terms: any[] = data?.terms || [];
    const term = terms.find((t: any) => t.id === termId);
    const items: any[] = (data?.items || []).filter((i: any) => i.term_id === termId);
    const total = (data?.items || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const paid = (data?.payments || []).filter((p: any) => !p.voided_at && p.flow !== 'PJ_ADVANCE').reduce((s: number, p: any) => s + Number(p.amount), 0);
    const termPaid = items.reduce((s: number, i: any) => s + Number(i.paid), 0);
    const termTotal = items.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const termPayments = (data?.payments || []).filter((p: any) => items.some((i: any) => i.id === p.item_id));

    const filtered = useMemo(() => activities.filter(a =>
        `${a.title} ${a.owner_name}`.toLowerCase().includes(search.toLowerCase())
        && (filter === 'ALL' || statusOf(a.total, a.paid) === filter)), [activities, search, filter]);

    const listStats = useMemo(() => {
        const sum = (k: string) => activities.reduce((s, a) => s + Number(a[k] || 0), 0);
        return { total: sum('total'), paid: sum('paid') };
    }, [activities]);

    const titles: Record<FormKind, string> = {
        activity: form?.id ? 'Edit Kegiatan' : 'Tambah Kegiatan',
        term: form?.id ? 'Edit Item' : 'Tambah Item',
        item: form?.id ? 'Edit Rincian Biaya' : 'Tambah Rincian Biaya',
        payment: 'Catat Pembayaran',
        history: 'Riwayat Perubahan',
        'delete-item': 'Hapus Rincian Biaya',
        'cancel-payment': 'Batalkan Pembayaran',
        'edit-proof': 'Edit Bukti Pembayaran',
    };
    const icons: Record<FormKind, string> = {
        activity: 'calendar2-week', term: 'journal-text', item: 'list-check', payment: 'wallet2',
        history: 'clock-history', 'delete-item': 'trash', 'cancel-payment': 'x-octagon', 'edit-proof': 'paperclip',
    };
    const variantOf = (kind: FormKind) => kind === 'delete-item' || kind === 'cancel-payment' ? 'delete' : form?.id ? 'edit' : kind === 'history' ? 'default' : 'add';

    const itemActions = (item: any) => {
        const hasPayments = Number(item.paid) + Number(item.advanced || 0) > 0;
        const pay = (flow: string) => {
            const remaining = flow === 'REIMBURSEMENT' ? outstandingAdvance(item) : recipientRemaining(item);
            start('payment', { ...item, flow, amount: remaining, remaining, attachments: [], destination_account: '' });
        };
        return (
            <ActionGroup>
                {canEdit && (!hasPayments || canPay) && <ActionButton action="edit" tooltip="Edit rincian" onClick={() => start('item', item)} />}
                {canEdit && !hasPayments && <ActionButton action="delete" tooltip="Hapus rincian" onClick={() => start('delete-item', item)} />}
                {canRecordAdvance && recipientRemaining(item) > 0 && <Button size="sm" variant="outline" onClick={() => pay('PJ_ADVANCE')}>Catat Bayar PJ</Button>}
                {canPay && recipientRemaining(item) > 0 && <Button size="sm" variant="primary" onClick={() => pay('DIRECT')}>Bayar Langsung</Button>}
                {canPay && outstandingAdvance(item) > 0 && <Button size="sm" variant="primary" onClick={() => pay('REIMBURSEMENT')}>Ganti Dana PJ</Button>}
            </ActionGroup>
        );
    };

    const fileLinks = (attachments: Attachment[]) => attachments.map((a, i) => isViewable(a.url) ? (
        <button key={i} type="button" className="pay-file" onClick={() => setPreview({ url: a.url, title: a.name })}>{a.name}</button>
    ) : <a key={i} className="pay-file" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>);

    const alerts = (
        <>
            {error && <div role="alert" className="pay-alert pay-alert--error"><i className="bi bi-exclamation-circle" />{error}</div>}
            {notice && <div role="status" className="pay-alert pay-alert--success"><i className="bi bi-check-circle" />{notice}</div>}
        </>
    );

    /* ------------------------------- Daftar ------------------------------- */

    if (!selected) {
        return (
            <div className="pay-committee">
                {alerts}
                <DesktopFab label="Tambah Kegiatan" mobileLabel="Tambah" icon="plus-lg" onClick={() => start('activity')} />

                <StatCards
                    items={[
                        { label: 'Kegiatan', icon: 'calendar2-week', tone: 'blue', value: activities.length, sub: `${activities.filter(a => statusOf(a.total, a.paid) === 'Lunas').length} lunas` },
                        { label: 'Total Anggaran', icon: 'wallet2', tone: 'violet', value: fmtRupiah(listStats.total), sub: 'Seluruh rincian biaya' },
                        { label: 'Dibayar Bendahara', icon: 'check2-circle', tone: 'green', value: fmtRupiah(listStats.paid), sub: `Sisa ${fmtRupiah(listStats.total - listStats.paid)}`, progress: percent(listStats.paid, listStats.total) },
                    ]}
                />

                <FilterToolbar>
                    <FilterSelect
                        label="Status"
                        icon="funnel"
                        value={filter}
                        onChange={v => setFilter(v || 'ALL')}
                        options={[
                            { value: 'ALL', label: 'Semua Status' },
                            { value: 'Belum Dibayar', label: 'Belum Dibayar' },
                            { value: 'Dibayar Sebagian', label: 'Dibayar Sebagian' },
                            { value: 'Lunas', label: 'Lunas' },
                        ]}
                    />
                    <FilterSearch value={search} onChange={setSearch} placeholder="Cari kegiatan atau PJ..." />
                </FilterToolbar>

                {loading ? (
                    <div className="pay-loading"><Spinner variant="buble" /></div>
                ) : filtered.length === 0 ? (
                    <div className="pay-card">
                        <EmptyState icon="journal-richtext" title={activities.length ? 'Tidak ada kegiatan yang cocok' : 'Belum ada kegiatan'}>
                            {activities.length ? 'Ubah kata kunci atau status pencarian.' : 'Tambahkan kegiatan untuk mulai mengisi ampra.'}
                        </EmptyState>
                    </div>
                ) : (
                    <div className="pay-card pay-table-wrap">
                        <table className="pay-table" aria-label="Daftar kegiatan pengajuan komite">
                            <thead><tr><th>Kegiatan</th><th>PJ</th><th>Periode</th><th className="pay-num">Anggaran</th><th className="pay-num">Dibayar Bendahara</th><th className="pay-num">Sisa</th><th>Status Bendahara</th><th>Aksi</th></tr></thead>
                            <tbody>{filtered.map(a => {
                                const st = statusOf(a.total, a.paid);
                                return <tr key={a.id}>
                                    <td className="pay-cell-strong">{a.title}</td><td>{a.owner_name}</td><td>{dateRange(a.start_date, a.end_date)}</td>
                                    <td className="pay-num">{fmtRupiah(a.total)}</td><td className="pay-num">{fmtRupiah(a.paid)}</td><td className="pay-num">{fmtRupiah(Number(a.total) - Number(a.paid))}</td>
                                    <td><StatusBadge tone={toneOf(st)}>{st}</StatusBadge></td><td><Button size="sm" variant="outline" onClick={() => void open(a.id)}>Detail</Button></td>
                                </tr>;
                            })}</tbody>
                        </table>
                    </div>
                )}
                {renderForm()}
            </div>
        );
    }

    /* ------------------------------- Detail ------------------------------- */

    return (
        <div className="pay-committee">
            <DetailHeader
                onBack={back}
                backLabel="Kembali ke daftar kegiatan"
                name={activity?.title || 'Kegiatan'}
                meta={`PJ ${activity?.owner_name || '-'} · ${dateRange(activity?.start_date, activity?.end_date)}`}
                avatar={false}
            >
                <Button size="sm" variant="outline" icon="history" onClick={() => start('history')}>Riwayat</Button>
                {canEdit && <Button size="sm" variant="edit" icon="edit" onClick={() => start('activity', activity)}>Edit Kegiatan</Button>}
            </DetailHeader>

            {alerts}
            {activity?.description && <p className="pay-desc">{activity.description}</p>}

            <StatCards
                items={[
                    { label: 'Total Kegiatan', icon: 'wallet2', tone: 'blue', value: fmtRupiah(total), sub: `${terms.length} item` },
                    { label: 'Dibayar Bendahara', icon: 'check2-circle', tone: 'green', value: fmtRupiah(paid), sub: `${percent(paid, total)}% dari total`, progress: percent(paid, total) },
                    { label: 'Sisa Pembayaran', icon: 'hourglass-split', tone: 'amber', value: fmtRupiah(total - paid), sub: total - paid > 0 ? 'Belum dibayarkan' : 'Tidak ada sisa' },
                ]}
            />

            <div className="pay-card">
                <div className="pay-card__head">
                    <div className="pay-term-pick">
                        <span className="pay-card__eyebrow">Item</span>
                        {terms.length ? (
                            <InlineSelect
                                title="Pilih item kegiatan"
                                minWidth="240px"
                                value={termId}
                                onChange={setTermId}
                                options={terms.map((t: any) => ({ value: t.id, label: `${BULAN[t.month - 1]} ${t.year} · ${t.title}` }))}
                            />
                        ) : <strong>Belum ada item</strong>}
                    </div>
                    <div className="pay-actions">
                        {term && canEdit && <Button size="sm" variant="outline" icon="edit" onClick={() => start('term', term)}>Edit Item</Button>}
                        {canEdit && <Button size="sm" variant="primary" icon="add" onClick={() => start('term')}>Tambah Item</Button>}
                    </div>
                </div>

                {!term ? (
                    <EmptyState icon="journal-plus" title="Belum ada item">
                        {canEdit ? 'Tambahkan item pertama untuk mengisi rincian ampra.' : 'PJ kegiatan belum menambahkan item.'}
                    </EmptyState>
                ) : (
                    <>
                        <div className="pay-ampra">
                            <span className="pay-ampra__label"><i className="bi bi-paperclip" /> Lampiran ampra</span>
                            <span className="pay-ampra__files">
                                {(term.attachments || []).map((a: Attachment, i: number) => isViewable(a.url) ? (
                                    <button key={i} type="button" className="pay-file" onClick={() => setPreview({ url: a.url, title: a.name })}>
                                        <i className="bi bi-file-earmark" /> {a.name}
                                    </button>
                                ) : (
                                    <a key={i} className="pay-file" href={a.url} target="_blank" rel="noopener noreferrer">
                                        <i className="bi bi-file-earmark-arrow-down" /> {a.name}
                                    </a>
                                ))}
                                {!term.attachments?.length && <span className="pay-cell-muted">Belum ada lampiran.</span>}
                            </span>
                        </div>

                        <div className="pay-section-head">
                            <div>
                                <h4>Rincian Biaya</h4>
                                <span className="pay-cell-muted">{items.length} rincian · {fmtRupiah(termTotal)} · dibayar bendahara {fmtRupiah(termPaid)}</span>
                            </div>
                            {canEdit && <Button size="sm" variant="outline" icon="add" onClick={() => start('item')}>Tambah Rincian</Button>}
                        </div>

                        {items.length === 0 ? (
                            <EmptyState icon="list-check" title="Belum ada rincian biaya">Tambahkan rincian biaya untuk item ini.</EmptyState>
                        ) : (
                            <div className="pay-table-wrap">
                                <table className="pay-table">
                                    <thead>
                                        <tr>
                                            <th>Uraian / Penerima</th>
                                            <th>Jumlah</th>
                                            <th className="pay-num">Harga Satuan</th>
                                            <th className="pay-num">Subtotal</th>
                                            <th className="pay-num">Dibayar PJ</th><th className="pay-num">Diganti ke PJ</th><th className="pay-num">Dibayar Bendahara</th>
                                            <th>Status Bendahara</th>
                                            <th className="pay-col-action">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item: any) => {
                                            const st = statusOf(item.amount, item.paid);
                                            return (
                                                <tr key={item.id}>
                                                    <td>
                                                        <div className="pay-cell-stack">
                                                            <span className="pay-cell-strong">{item.description}</span>
                                                            <span className="pay-cell-muted">{item.recipient || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="pay-nowrap">{Number(item.quantity)} {item.unit}</td>
                                                    <td className="pay-num">{fmtRupiah(item.unit_price)}</td>
                                                    <td className="pay-num pay-amount">{fmtRupiah(item.amount)}</td>
                                                    <td className="pay-num">{fmtRupiah(item.advanced || 0)}</td><td className="pay-num">{fmtRupiah(item.reimbursed || 0)}</td><td className="pay-num">{fmtRupiah(item.paid)}</td>
                                                    <td><StatusBadge tone={toneOf(st)}>{st}</StatusBadge></td>
                                                    <td className="pay-col-action">{itemActions(item)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="pay-section-head">
                            <div>
                                <h4>Riwayat Pembayaran Item</h4>
                                <span className="pay-cell-muted">{termPayments.length} catatan pembayaran</span>
                            </div>
                        </div>
                        {termPayments.length === 0 ? (
                            <EmptyState icon="receipt" title="Belum ada pembayaran">Pembayaran PJ dan bendahara akan muncul di sini.</EmptyState>
                        ) : (
                            <div className="pay-table-wrap">
                                <table className="pay-table" aria-label="Riwayat pembayaran item">
                                    <thead><tr><th>Tanggal</th><th>Rincian</th><th>Alur / Rekening Tujuan</th><th className="pay-num">Nominal</th><th>Lampiran</th><th>Catatan / Pencatat</th><th>Status</th><th>Aksi</th></tr></thead>
                                    <tbody>{termPayments.map((p: any) => {
                                        const item = items.find((i: any) => i.id === p.item_id);
                                        return <tr key={p.id}>
                                            <td>{fmtTanggal(day(p.paid_on))}</td><td>{item?.description}</td>
                                            <td><div className="pay-cell-stack"><strong>{flowLabel(p.flow)}</strong><span>{p.destination_account || '—'}</span></div></td>
                                            <td className="pay-num">{fmtRupiah(p.amount)}</td>
                                            <td><div className="pay-cell-stack">{fileLinks(p.attachments?.length ? p.attachments : [{ name: 'Bukti transfer', url: p.proof_url }])}</div></td>
                                            <td><div className="pay-cell-stack"><span>{p.note}</span><span className="pay-cell-muted">{p.actor_name}</span>{p.void_reason && <span>Alasan pembatalan: {p.void_reason}</span>}</div></td>
                                            <td><StatusBadge tone={p.voided_at ? 'void' : 'paid'}>{p.voided_at ? 'Dibatalkan' : 'Tercatat'}</StatusBadge></td>
                                            <td>{!p.voided_at && (canPay || (canRecordAdvance && p.flow === 'PJ_ADVANCE' && p.actor_id === ownerId)) && (
                                                <ActionGroup>
                                                <ActionButton action="edit" tooltip="Edit bukti pembayaran" onClick={() => start('edit-proof', { ...p, itemId: p.item_id, revision: item?.revision, attachments: p.attachments?.length ? p.attachments : [{ name: 'Bukti transfer', url: p.proof_url }] })} />
                                                <ActionButton action="reject" tooltip="Batalkan pembayaran" onClick={() => start('cancel-payment', { ...p, itemId: p.item_id, revision: item?.revision })} />
                                                </ActionGroup>
                                            )}</td>
                                        </tr>;
                                    })}</tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {renderForm()}
        </div>
    );

    /* ------------------------------- Formulir ------------------------------- */

    function renderForm() {
        return (
            <>
                {form && (
                    <Modal
                        size={form.kind === 'history' ? 'lg' : 'md'}
                        variant={variantOf(form.kind)}
                        title={titles[form.kind as FormKind]}
                        icon={icons[form.kind as FormKind]}
                        labelledBy="committee-form-title"
                        onClose={() => { if (!saving.current) setForm(null); }}
                        closeOnOverlayClick={false}
                    >
                        <form onSubmit={save}>
                            <ModalBody>
                                {formError && <div className="pay-alert pay-alert--error" role="alert"><i className="bi bi-exclamation-circle" />{formError}</div>}
                                {formBody()}
                            </ModalBody>
                            <ModalFooter>
                                <Button type="button" variant="cancel" disabled={busy} onClick={() => setForm(null)}>{form.kind === 'history' ? 'Tutup' : 'Batal'}</Button>
                                {form.kind !== 'history' && (
                                    <Button type="submit" variant={form.kind === 'delete-item' || form.kind === 'cancel-payment' ? 'danger' : 'primary'} isLoading={busy} disabled={busy}>
                                        {form.kind === 'payment' ? 'Catat Pembayaran' : form.kind === 'delete-item' ? 'Hapus Item' : form.kind === 'cancel-payment' ? 'Batalkan Pembayaran' : 'Simpan'}
                                    </Button>
                                )}
                            </ModalFooter>
                        </form>
                    </Modal>
                )}
                {preview && <DocViewerModal fileUrl={preview.url} title={preview.title} onClose={() => setPreview(null)} />}
            </>
        );
    }

    function formBody() {
        switch (form.kind as FormKind) {
            case 'activity':
                return (
                    <>
                        <ModalField label="Nama kegiatan" required>
                            <input required maxLength={300} value={form.title} onChange={e => change('title', e.target.value)} placeholder="Contoh: Lomba Sains Antar Madrasah" />
                        </ModalField>
                        <div className="pay-form-row">
                            <ModalField label="Tanggal mulai" required>
                                <input required type="date" value={form.start_date} onChange={e => change('start_date', e.target.value)} />
                            </ModalField>
                            <ModalField label="Tanggal selesai" required>
                                <input required type="date" value={form.end_date} onChange={e => change('end_date', e.target.value)} />
                            </ModalField>
                        </div>
                        <ModalField label="Keterangan">
                            <textarea rows={3} maxLength={2000} value={form.description} onChange={e => change('description', e.target.value)} />
                        </ModalField>
                        {form.id && canPay && data?.payments?.some((p: any) => !p.voided_at) && (
                            <ModalField label="Alasan koreksi" required hint="Kegiatan ini sudah memiliki pembayaran.">
                                <input required value={form.reason} onChange={e => change('reason', e.target.value)} />
                            </ModalField>
                        )}
                    </>
                );
            case 'term':
                return (
                    <>
                        <ModalField label="Nama item" required>
                            <input required maxLength={300} placeholder="Contoh: Honor tentor" value={form.title} onChange={e => change('title', e.target.value)} />
                        </ModalField>
                        <div className="pay-form-row">
                            <ModalField label="Bulan" required>
                                <InlineSelect title="Bulan item" value={String(form.month)} onChange={v => change('month', Number(v))} options={BULAN.map((label, i) => ({ value: String(i + 1), label }))} />
                            </ModalField>
                            <ModalField label="Tahun" required>
                                <input required type="number" min={2000} max={2200} value={form.year} onChange={e => change('year', Number(e.target.value))} />
                            </ModalField>
                        </div>
                        {!form.id && terms.length > 0 && (
                            <ModalField label="Salin rincian dari">
                                <InlineSelect
                                    title="Salin rincian item"
                                    value={form.copyFrom || ''}
                                    onChange={v => change('copyFrom', v)}
                                    options={[{ value: '', label: 'Mulai dengan rincian kosong' }, ...terms.map((t: any) => ({ value: t.id, label: `${BULAN[t.month - 1]} ${t.year} · ${t.title}` }))]}
                                />
                            </ModalField>
                        )}
                        <ModalField label="Lampiran ampra" hint="PDF, gambar, atau Excel. Maksimal 10 berkas, 15 MB per berkas.">
                            <ModalFileInput multiple files={form.files || []} onPick={files => change('files', files)} accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx" disabled={busy} />
                        </ModalField>
                        {(form.attachments || []).length > 0 && (
                            <ul className="pay-attach">
                                {form.attachments.map((a: Attachment, i: number) => (
                                    <li key={i}>
                                        <i className="bi bi-file-earmark-check" />
                                        <span title={a.name}>{a.name}</span>
                                        <button type="button" onClick={() => change('attachments', form.attachments.filter((_: any, j: number) => j !== i))} aria-label={`Lepas ${a.name}`}>
                                            <i className="bi bi-x-lg" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {form.id && termPayments.some((p: any) => !p.voided_at) && canPay && (
                            <ModalField label="Alasan koreksi" required>
                                <input required value={form.reason} onChange={e => change('reason', e.target.value)} />
                            </ModalField>
                        )}
                    </>
                );
            case 'item':
                return (
                    <>
                        <ModalField label="Uraian biaya" required>
                            <input required maxLength={300} value={form.description} onChange={e => change('description', e.target.value)} placeholder="Contoh: Konsumsi peserta" />
                        </ModalField>
                        <ModalField label="Nama penerima / penyedia">
                            <input maxLength={200} value={form.recipient} onChange={e => change('recipient', e.target.value)} />
                        </ModalField>
                        <div className="pay-form-row pay-form-row--3">
                            <ModalField label="Jumlah" required>
                                <input required type="number" step="0.01" min="0.01" value={form.quantity} onChange={e => change('quantity', e.target.value)} />
                            </ModalField>
                            <ModalField label="Satuan" required>
                                <input required maxLength={40} value={form.unit} onChange={e => change('unit', e.target.value)} />
                            </ModalField>
                            <ModalField label="Harga satuan (Rp)" required>
                                <input required type="number" step="1" min="1" value={form.unit_price} onChange={e => change('unit_price', e.target.value)} />
                            </ModalField>
                        </div>
                        <div className="pay-subtotal">
                            <span>Subtotal</span>
                            <strong>{fmtRupiah(Math.round(Math.round(Number(form.quantity) * 100) * Number(form.unit_price) / 100))}</strong>
                        </div>
                        {(Number(form.paid) + Number(form.advanced || 0)) > 0 && (
                            <ModalField label="Alasan koreksi" required hint="Riwayat sebelum dan sesudah perubahan disimpan.">
                                <input required value={form.reason} onChange={e => change('reason', e.target.value)} />
                            </ModalField>
                        )}
                    </>
                );
            case 'payment':
                return (
                    <>
                        <p className="pay-desc"><strong>{flowLabel(form.flow)}</strong>{form.flow === 'REIMBURSEMENT' && ` · Penggantian dana kepada ${activity?.owner_name}`}</p>
                        <ModalField label={form.flow === 'REIMBURSEMENT' ? 'Rekening PJ penerima penggantian' : 'Rekening penerima'} required hint="Nama bank, nomor rekening, dan nama pemilik rekening.">
                            <input required maxLength={300} value={form.destination_account || ''} onChange={e => change('destination_account', e.target.value)} />
                        </ModalField>
                        <div className="pay-summary">
                            <div className="pay-summary__who">
                                <span className="pay-summary__label">Rincian</span>
                                <strong>{form.description}</strong>
                                <span className="pay-summary__detail">{form.recipient || 'Tanpa penerima'}</span>
                            </div>
                            <div className="pay-summary__amount">
                                <span className="pay-summary__label">Sisa tagihan</span>
                                <strong>{fmtRupiah(Number(form.remaining))}</strong>
                            </div>
                        </div>
                        <div className="pay-form-row">
                            <ModalField label="Nominal pembayaran (Rp)" required>
                                <input required type="number" min="1" max={form.remaining} step="1" value={form.amount} onChange={e => change('amount', e.target.value)} />
                            </ModalField>
                            <ModalField label="Tanggal pembayaran" required>
                                <input required type="date" value={form.paid_on} onChange={e => change('paid_on', e.target.value)} />
                            </ModalField>
                        </div>
                        <ModalField label="Bukti transfer" required hint="Bisa melampirkan beberapa file. Maksimal 10 berkas, 15 MB per berkas.">
                            <ModalFileInput multiple files={form.files || []} onPick={files => change('files', files)} accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx" disabled={busy} />
                            {form.attachments?.length > 0 && <div className="pay-cell-stack">{fileLinks(form.attachments)}</div>}
                        </ModalField>
                        <ModalField label="Catatan">
                            <textarea rows={3} maxLength={1000} value={form.note} onChange={e => change('note', e.target.value)} />
                        </ModalField>
                    </>
                );
            case 'edit-proof':
                return <>
                    <p>Tambah, lepas, atau ganti lampiran pembayaran {fmtRupiah(form.amount)}. Minimal satu bukti harus tersimpan.</p>
                    <ul className="pay-attach">{(form.attachments || []).map((a: Attachment, i: number) => <li key={i}>
                        <span>{a.name}</span><button type="button" aria-label={`Lepas ${a.name}`} onClick={() => change('attachments', form.attachments.filter((_: any, j: number) => j !== i))}><i className="bi bi-x-lg" /></button>
                    </li>)}</ul>
                    <ModalField label="Lampiran pengganti / tambahan" hint="Maksimal 10 berkas, 15 MB per berkas.">
                        <ModalFileInput multiple files={form.files || []} onPick={files => change('files', files)} accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx" disabled={busy} />
                    </ModalField>
                </>;
            case 'delete-item':
                return <p className="pay-confirm">Hapus rincian <strong>“{form.description}”</strong> dari item ini? Tindakan ini tidak dapat dibatalkan.</p>;
            case 'cancel-payment':
                return (
                    <>
                        <p className="pay-confirm">Pembayaran <strong>{fmtRupiah(form.amount)}</strong> akan dibatalkan. Bukti dan riwayat pencatatan tetap tersimpan.</p>
                        <ModalField label="Alasan pembatalan" required>
                            <textarea required rows={3} maxLength={1000} value={form.reason} onChange={e => change('reason', e.target.value)} />
                        </ModalField>
                    </>
                );
            case 'history':
                return (data?.history || []).length === 0 ? (
                    <EmptyState icon="clock-history" title="Belum ada riwayat perubahan" />
                ) : (
                    <ul className="pay-timeline">
                        {(data?.history || []).map((h: any) => (
                            <li key={h.id}>
                                <span className="pay-timeline__dot" aria-hidden="true" />
                                <div className="pay-timeline__body">
                                    <div className="pay-timeline__top">
                                        <strong>{h.action}</strong>
                                        <span className="pay-cell-muted">{h.actor_name} · {new Date(h.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}</span>
                                    </div>
                                    {h.reason && <span className="pay-timeline__note">{h.reason}</span>}
                                    {h.snapshot?.before && h.snapshot?.after && (
                                        <span className="pay-cell-muted">
                                            {h.snapshot.before.description || h.snapshot.before.title} → {h.snapshot.after.description || h.snapshot.after.title}
                                            {h.snapshot.after.unit_price && ` · ${fmtRupiah(h.snapshot.before.unit_price)} → ${fmtRupiah(h.snapshot.after.unit_price)}`}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                );
            default:
                return null;
        }
    }
}
