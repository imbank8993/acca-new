'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { Modal, ModalBody, ModalFooter, ModalField, ModalFileInput } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineSelect } from '@/components/ui/InlineSelect';
import SearchableSelect from '@/components/ui/SearchableSelect';
import DatePicker from '@/components/ui/DatePicker';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { DetailHeader } from '@/components/ui/DetailHeader';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { useIsMobile } from '@/hooks/use-breakpoint';
import DocViewerModal from '@/components/ui/DocViewerModal';
import { BULAN, fmtRupiah, fmtTanggal, StatCards, StatusBadge, EmptyState, type BadgeTone } from './parts';

const day = (v: any) => v ? String(v).slice(0, 10) : '';
const localDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const statusOf = (total: any, paid: any) => Number(paid) <= 0 ? 'Belum Dibayar' : Number(paid) >= Number(total) ? 'Lunas' : 'Dibayar Sebagian';
const toneOf = (status: string): BadgeTone => status === 'Lunas' ? 'paid' : status === 'Dibayar Sebagian' ? 'partial' : 'unpaid';
const flowLabel = (flow: string) => flow === 'PJ_ADVANCE' ? 'Transfer PJ (riwayat lama)' : flow === 'REIMBURSEMENT' ? 'Penggantian PJ (riwayat lama)' : 'Pembayaran Bendahara';
const outstandingAdvance = (item: any) => Number(item.advanced || 0) - Number(item.reimbursed || 0);
const recipientRemaining = (item: any) => Number(item.amount) - Number(item.paid) - outstandingAdvance(item);
const itemStatus = (item: any) => Number(item.amount) === 0 ? 'Perlu Harga' : outstandingAdvance(item) > 0 ? Number(item.reimbursed || 0) > 0 ? 'Penggantian PJ Sebagian' : 'Menunggu Penggantian PJ' : statusOf(item.amount, item.paid);
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
type FormKind = 'activity' | 'single-item' | 'payment' | 'history' | 'delete-item' | 'cancel-payment' | 'edit-proof';

const isViewable = (url: string) => /\.(pdf|png|jpe?g|webp|gif)(\?|$)/i.test(url);

export default function CommitteeTab() {
    const isMobile = useIsMobile();
    const [activities, setActivities] = useState<any[]>([]);
    const [data, setData] = useState<any>(null);
    const [selected, setSelected] = useState('');
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
    const [masterPeople, setMasterPeople] = useState<{ name: string; kind: string }[]>([]);
    const [masterLoading, setMasterLoading] = useState(false);
    const [masterError, setMasterError] = useState('');
    const [masterRefresh, setMasterRefresh] = useState(0);
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
    }, []);

    useEffect(() => { void loadList(); }, [loadList]);

    useEffect(() => {
        if (form?.kind !== 'single-item') return;
        let active = true;
        setMasterLoading(true);
        setMasterError('');
        void authFetch('/api/master/guru?limit=1000').then(res => res.json()).then(result => {
            if (!result.ok || !Array.isArray(result.data)) throw new Error('Daftar guru/staf belum dapat dimuat.');
            if (active) {
                const people = new Map<string, { name: string; kind: string }>();
                for (const person of result.data) {
                    const name = String(person.nama_lengkap || '').trim();
                    if (name && !people.has(name)) people.set(name, { name, kind: String(person.jenis_pegawai || 'GURU').toUpperCase() });
                }
                setMasterPeople([...people.values()]);
            }
        }).catch(() => { if (active) setMasterError('Daftar guru/staf belum dapat dimuat. Nama tetap bisa diketik manual.'); })
            .finally(() => { if (active) setMasterLoading(false); });
        return () => { active = false; };
    }, [form?.kind, masterRefresh]);

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
            proposed_total: '', proposal_url: '', proposal_name: '', proposal_files: [],
            attachments: [], files: [], replacement_files: {}, reason: '', note: '', paid_on: today, amount: '', remaining: old.amount, partial_payment: false,
            ampra_files: [], new_attachment_titles: [],
            requestId: crypto.randomUUID(), ...old,
            start_date: day(old.start_date) || today, end_date: day(old.end_date) || today,
        });
    };

    const change = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));
    const pickItemFiles = (files: File[]) => setForm((old: any) => {
        const titles = new Map<File, string>((old.ampra_files || []).map((file: File, i: number) => [file, old.new_attachment_titles?.[i] || '']));
        return { ...old, ampra_files: files, new_attachment_titles: files.map(file => titles.get(file) ?? file.name.replace(/\.[^.]+$/, '')) };
    });

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
            const body = { ...form, activityId: selected, termId: form.term_id, quantity: Number(form.quantity), unit_price: Number(form.unit_price), amount: Number(form.amount) };
            if (form.kind === 'activity') {
                body.proposed_total = form.proposed_total === '' || form.proposed_total == null ? null : Number(form.proposed_total);
                const proposalFile = form.proposal_files?.[0] as File | undefined;
                if (proposalFile) {
                    if (!/\.(pdf|docx?|jpe?g|png|webp)$/i.test(proposalFile.name)) throw new Error('Proposal harus berupa PDF, Word, atau gambar.');
                    const proposal = await upload(proposalFile);
                    body.proposal_url = proposal.url;
                    body.proposal_name = proposal.name;
                    setForm((old: any) => ({ ...old, proposal_url: proposal.url, proposal_name: proposal.name, proposal_files: [] }));
                }
            }
            if (form.kind === 'single-item') {
                const attachments: Attachment[] = [...(form.attachments || [])];
                const newFiles: File[] = form.ampra_files || [];
                if (attachments.length + newFiles.length > 10) throw new Error('Maksimal 10 lampiran item.');
                if (attachments.some(a => !a.name.trim())) throw new Error('Isi judul setiap dokumen yang tersimpan.');
                for (let i = 0; i < newFiles.length; i++) {
                    const title = String(form.new_attachment_titles?.[i] || '').trim();
                    if (!title) throw new Error(`Isi judul dokumen baru ${i + 1}.`);
                    const uploaded = await upload(newFiles[i]);
                    attachments.push({ name: title, url: uploaded.url });
                }
                if (newFiles.length) setForm((old: any) => ({ ...old, attachments, ampra_files: [], new_attachment_titles: [] }));
                body.attachments = attachments;
            }
            if (form.kind === 'payment' || form.kind === 'edit-proof') {
                const attachments: Attachment[] = [];
                if ((form.attachments?.length || 0) + (form.files?.length || 0) > 10) throw new Error('Maksimal 10 lampiran.');
                for (const old of form.attachments || []) {
                    if (!String(old.name || '').trim()) throw new Error('Isi judul setiap bukti pembayaran.');
                    const replacement = form.kind === 'edit-proof' ? form.replacement_files?.[old.url]?.[0] as File | undefined : undefined;
                    attachments.push(replacement ? { name: old.name, url: (await upload(replacement)).url } : old);
                }
                for (const f of form.files || []) attachments.push(await upload(f));
                body.attachments = attachments;
                if ((form.files?.length || 0) || Object.keys(form.replacement_files || {}).length) setForm((old: any) => ({ ...old, attachments, files: [], replacement_files: {} }));
            }
            if (['payment', 'edit-proof'].includes(form.kind) && !body.attachments.length) throw new Error('Lampirkan bukti transfer terlebih dahulu.');
            delete body.files;
            delete body.replacement_files;
            delete body.item_total;
            delete body.proposal_files;
            delete body.ampra_files;
            for (const key of ['new_attachment_titles', 'partial_payment']) delete body[key];
            const r = await api('/api/payments/committee', body);
            const activityId = form.kind === 'activity' ? (form.id || r.id) : selected;
            await loadList();
            await loadDetail(activityId);
            setSelected(activityId);
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
    const items: any[] = data?.items || [];
    const hasLegacyAdvances = items.some(item => Number(item.advanced || 0) > 0);
    const total = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const paid = (data?.payments || []).filter((p: any) => !p.voided_at && p.flow !== 'PJ_ADVANCE').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const itemPayments: any[] = data?.payments || [];
    const pjProofs = (itemId: string): Attachment[] => itemPayments
        .filter((p: any) => p.item_id === itemId && p.flow === 'PJ_ADVANCE' && !p.voided_at)
        .flatMap((p: any) => p.attachments?.length ? p.attachments : [{ name: 'Bukti transfer PJ', url: p.proof_url }]);

    const filtered = useMemo(() => activities.filter(a =>
        `${a.title} ${a.owner_name}`.toLowerCase().includes(search.toLowerCase())
        && (filter === 'ALL' || statusOf(a.total, a.paid) === filter)), [activities, search, filter]);

    const listStats = useMemo(() => {
        const sum = (k: string) => activities.reduce((s, a) => s + Number(a[k] || 0), 0);
        return { total: sum('total'), paid: sum('paid') };
    }, [activities]);

    const titles: Record<FormKind, string> = {
        activity: form?.id ? 'Edit Kegiatan' : 'Tambah Kegiatan',
        'single-item': form?.id ? 'Edit Item' : 'Tambah Item',
        payment: 'Catat Pembayaran',
        history: 'Riwayat Perubahan',
        'delete-item': 'Hapus Item',
        'cancel-payment': 'Batalkan Pembayaran',
        'edit-proof': 'Edit Bukti Pembayaran',
    };
    const icons: Record<FormKind, string> = {
        activity: 'calendar2-week', 'single-item': 'list-check', payment: 'wallet2',
        history: 'clock-history', 'delete-item': 'trash', 'cancel-payment': 'x-octagon', 'edit-proof': 'paperclip',
    };
    const variantOf = (kind: FormKind) => kind === 'delete-item' || kind === 'cancel-payment' ? 'delete' : form?.id ? 'edit' : kind === 'history' ? 'default' : 'add';

    const itemActions = (item: any) => {
        const hasPayments = Number(item.paid) + Number(item.advanced || 0) > 0;
        const pay = () => {
            const flow = outstandingAdvance(item) > 0 ? 'REIMBURSEMENT' : 'DIRECT';
            const remaining = flow === 'REIMBURSEMENT' ? outstandingAdvance(item) : recipientRemaining(item);
            start('payment', { ...item, flow, amount: remaining, remaining, attachments: [], destination_account: '' });
        };
        return (
            <ActionGroup>
                {canEdit && <ActionButton action="edit" tooltip={hasPayments && !canPay ? 'Edit dokumen item' : 'Edit item'} onClick={() => start('single-item', item)} />}
                {canEdit && !hasPayments && <ActionButton action="delete" tooltip="Hapus item" onClick={() => start('delete-item', item)} />}
                {canPay && (recipientRemaining(item) > 0 || outstandingAdvance(item) > 0) && <Button type="button" size="sm" variant="primary" leftIcon={<i className="bi bi-check2-circle" />} onClick={pay}>Tandai Dibayar</Button>}
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
                        { label: 'Total Anggaran', icon: 'wallet2', tone: 'violet', value: fmtRupiah(listStats.total), sub: 'Seluruh item' },
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
                ) : isMobile ? (
                    <div className="pay-mobile-cards" aria-label="Daftar kegiatan pengajuan komite">
                        {filtered.map(a => {
                            const st = statusOf(a.total, a.paid);
                            return <article className="pay-mobile-card" key={a.id}>
                                <div className="pay-mobile-card__top"><strong>{a.title}</strong><StatusBadge tone={toneOf(st)}>{st}</StatusBadge></div>
                                <div className="pay-mobile-card__meta"><span><i className="bi bi-person" /> {a.owner_name}</span><span><i className="bi bi-calendar3" /> {dateRange(a.start_date, a.end_date)}</span></div>
                                <dl className="pay-mobile-card__facts"><div><dt>Diajukan di proposal</dt><dd>{a.proposed_total == null ? 'Belum diisi' : fmtRupiah(a.proposed_total)}</dd></div><div><dt>Anggaran item</dt><dd>{fmtRupiah(a.total)}</dd></div><div><dt>Dibayar Bendahara</dt><dd>{fmtRupiah(a.paid)}</dd></div><div><dt>Sisa</dt><dd>{fmtRupiah(Number(a.total) - Number(a.paid))}</dd></div></dl>
                                {a.proposal_url && <div className="pay-mobile-card__files"><span>Proposal</span>{fileLinks([{ name: a.proposal_name || 'Proposal', url: a.proposal_url }])}</div>}
                                <Button variant="outline" size="sm" onClick={() => void open(a.id)}>Lihat Kegiatan</Button>
                            </article>;
                        })}
                    </div>
                ) : (
                    <div className="pay-card pay-table-wrap">
                        <table className="pay-table" aria-label="Daftar kegiatan pengajuan komite">
                            <thead><tr><th>Kegiatan</th><th>PJ</th><th>Periode</th><th className="pay-num">Anggaran</th><th className="pay-num">Dibayar Bendahara</th><th className="pay-num">Sisa</th><th>Status Bendahara</th><th>Aksi</th></tr></thead>
                            <tbody>{filtered.map(a => {
                                const st = statusOf(a.total, a.paid);
                                return <tr key={a.id}>
                                    <td><div className="pay-cell-stack"><strong className="pay-cell-strong">{a.title}</strong><span className="pay-cell-muted">Proposal: {a.proposed_total == null ? 'belum diisi' : fmtRupiah(a.proposed_total)}</span>{a.proposal_url && fileLinks([{ name: a.proposal_name || 'Proposal', url: a.proposal_url }])}</div></td><td>{a.owner_name}</td><td>{dateRange(a.start_date, a.end_date)}</td>
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
                {canEdit && <ActionButton action="edit" tooltip="Edit kegiatan" onClick={() => start('activity', activity)} />}
            </DetailHeader>

            {alerts}
            {activity?.description && <p className="pay-desc">{activity.description}</p>}
            <div className="pay-proposal-summary">
                <div><span>Total diajukan di proposal</span><strong>{activity?.proposed_total == null ? 'Belum diisi' : fmtRupiah(activity.proposed_total)}</strong></div>
                <div><span>Berkas proposal</span>{activity?.proposal_url ? fileLinks([{ name: activity.proposal_name || 'Lihat proposal', url: activity.proposal_url }]) : <strong>Belum diunggah</strong>}</div>
            </div>

            <StatCards
                items={[
                    { label: 'Total Kegiatan', icon: 'wallet2', tone: 'blue', value: fmtRupiah(total), sub: `${items.length} item` },
                    { label: 'Dibayar Bendahara', icon: 'check2-circle', tone: 'green', value: fmtRupiah(paid), sub: `${percent(paid, total)}% dari total`, progress: percent(paid, total) },
                    { label: 'Sisa Pembayaran', icon: 'hourglass-split', tone: 'amber', value: fmtRupiah(total - paid), sub: total - paid > 0 ? 'Belum dibayarkan' : 'Tidak ada sisa' },
                ]}
            />

            <div className="pay-card">
                <div className="pay-section-head">
                    <div><h4>Item</h4><span className="pay-cell-muted">{items.length} item · {fmtRupiah(total)} · dibayar bendahara {fmtRupiah(paid)}</span></div>
                    {canEdit && <Button size="sm" variant="primary" icon="add" onClick={() => start('single-item')}>Tambah Item</Button>}
                </div>
                {items.length === 0 ? <EmptyState icon="list-check" title="Belum ada item">Tambahkan item beserta harganya.</EmptyState> : isMobile ? (
                    <div className="pay-mobile-cards pay-mobile-cards--in-card" aria-label="Item pengajuan komite">
                        {items.map(item => {
                            const st = itemStatus(item);
                            return <article className="pay-mobile-card" key={item.id}>
                                <div className="pay-mobile-card__top"><strong>{item.description}</strong><StatusBadge tone={outstandingAdvance(item) > 0 ? 'partial' : toneOf(st)}>{st}</StatusBadge></div>
                                <div className="pay-mobile-card__meta"><span>{BULAN[item.month - 1]} {item.year}</span><span>Ditransfer kepada: {item.recipient || 'Belum dicatat'}</span></div>
                                <dl className="pay-mobile-card__facts"><div><dt>Jumlah</dt><dd>{Number(item.quantity)} {item.unit}</dd></div><div><dt>Harga Satuan</dt><dd>{fmtRupiah(item.unit_price)}</dd></div><div><dt>Total Item</dt><dd>{fmtRupiah(item.amount)}</dd></div>{Number(item.advanced || 0) > 0 && <><div><dt>Transfer PJ terdahulu</dt><dd>{fmtRupiah(item.advanced)}</dd></div><div><dt>Diganti ke PJ</dt><dd>{fmtRupiah(item.reimbursed || 0)}</dd></div></>}<div><dt>Dibayar Bendahara</dt><dd>{fmtRupiah(item.paid)}</dd></div></dl>
                                {(item.attachments || []).length > 0 && <div className="pay-mobile-card__files"><span>Lampiran item</span>{fileLinks(item.attachments)}</div>}
                                {pjProofs(item.id).length > 0 && <div className="pay-mobile-card__files"><span>Bukti transfer PJ</span>{fileLinks(pjProofs(item.id))}</div>}
                                <div className="pay-mobile-card__actions">{itemActions(item)}</div>
                            </article>;
                        })}
                    </div>
                ) : (
                    <div className="pay-table-wrap"><table className={`pay-table pay-committee-items-table ${hasLegacyAdvances ? '' : 'pay-committee-items-table--simple'}`} aria-label="Item pengajuan komite">
                        <thead><tr><th>Item</th><th>Anggaran</th>{hasLegacyAdvances && <th>Transfer PJ terdahulu</th>}<th>Dibayar Bendahara</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>{items.map(item => {
                            const st = itemStatus(item);
                            return <tr key={item.id}>
                                <td><div className="pay-cell-stack"><strong className="pay-cell-strong">{item.description}</strong><span className="pay-cell-muted">{BULAN[item.month - 1]} {item.year} · Ditransfer kepada: {item.recipient || 'Belum dicatat'}</span><span className="pay-cell-muted">{Number(item.quantity)} {item.unit} × {fmtRupiah(item.unit_price)}</span>{(item.attachments || []).length > 0 && <span className="pay-committee-items-table__files">{fileLinks(item.attachments)}</span>}{pjProofs(item.id).length > 0 && <span className="pay-committee-items-table__files">{fileLinks(pjProofs(item.id))}</span>}</div></td>
                                <td className="pay-amount">{fmtRupiah(item.amount)}</td>
                                {hasLegacyAdvances && <td><div className="pay-cell-stack"><span>Bayar: {fmtRupiah(item.advanced || 0)}</span><span className="pay-cell-muted">Diganti: {fmtRupiah(item.reimbursed || 0)}</span></div></td>}
                                <td>{fmtRupiah(item.paid)}</td>
                                <td><StatusBadge tone={outstandingAdvance(item) > 0 ? 'partial' : toneOf(st)}>{st}</StatusBadge></td>
                                <td className="pay-col-action">{itemActions(item)}</td>
                            </tr>;
                        })}</tbody>
                    </table></div>
                )}
                <div className="pay-section-head"><div><h4>Riwayat Pembayaran</h4><span className="pay-cell-muted">{itemPayments.length} catatan pembayaran</span></div></div>
                {itemPayments.length === 0 ? <EmptyState icon="receipt" title="Belum ada pembayaran">Pembayaran Bendahara akan muncul di sini.</EmptyState> : isMobile ? (
                    <div className="pay-mobile-cards pay-mobile-cards--in-card" aria-label="Riwayat pembayaran item">
                        {itemPayments.map((payment: any) => {
                            const item = items.find((i: any) => i.id === payment.item_id);
                            return <article className="pay-mobile-card" key={payment.id}>
                                <div className="pay-mobile-card__top"><strong>{item?.description || 'Item'}</strong><StatusBadge tone={payment.voided_at ? 'void' : 'paid'}>{payment.voided_at ? 'Dibatalkan' : 'Tercatat'}</StatusBadge></div>
                                <div className="pay-mobile-card__meta"><span>{fmtTanggal(day(payment.paid_on))}</span><span>{flowLabel(payment.flow)}</span></div>
                                <dl className="pay-mobile-card__facts"><div><dt>Nominal</dt><dd>{fmtRupiah(payment.amount)}</dd></div>{payment.destination_account && <div><dt>Rekening Tujuan (riwayat)</dt><dd>{payment.destination_account}</dd></div>}<div><dt>Pencatat</dt><dd>{payment.actor_name}</dd></div>{payment.note && <div><dt>Catatan</dt><dd>{payment.note}</dd></div>}{payment.void_reason && <div><dt>Alasan Pembatalan</dt><dd>{payment.void_reason}</dd></div>}</dl>
                                <div className="pay-mobile-card__files"><span>Bukti Transfer</span>{fileLinks(payment.attachments?.length ? payment.attachments : [{ name: 'Bukti transfer', url: payment.proof_url }])}</div>
                                {!payment.voided_at && (canPay || (canRecordAdvance && payment.flow === 'PJ_ADVANCE' && payment.actor_id === ownerId)) && <div className="pay-mobile-card__actions"><ActionGroup>
                                    <Button type="button" size="sm" variant="edit" icon="edit" onClick={() => start('edit-proof', { ...payment, term_id: item?.term_id, itemId: payment.item_id, revision: item?.revision, attachments: payment.attachments?.length ? payment.attachments : [{ name: 'Bukti transfer', url: payment.proof_url }] })}>Edit Bukti</Button>
                                    <ActionButton action="reject" tooltip="Batalkan pembayaran" onClick={() => start('cancel-payment', { ...payment, term_id: item?.term_id, itemId: payment.item_id, revision: item?.revision })} />
                                </ActionGroup></div>}
                            </article>;
                        })}
                    </div>
                ) : (
                    <div className="pay-table-wrap"><table className="pay-table" aria-label="Riwayat pembayaran item">
                        <thead><tr><th>Tanggal</th><th>Item</th><th>Keterangan Pembayaran</th><th className="pay-num">Nominal</th><th>Lampiran</th><th>Catatan / Pencatat</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>{itemPayments.map((payment: any) => {
                            const item = items.find((i: any) => i.id === payment.item_id);
                            return <tr key={payment.id}>
                                <td>{fmtTanggal(day(payment.paid_on))}</td><td>{item?.description}</td>
                                <td><div className="pay-cell-stack"><strong>{flowLabel(payment.flow)}</strong>{payment.destination_account && <span>{payment.destination_account}</span>}</div></td>
                                <td className="pay-num">{fmtRupiah(payment.amount)}</td>
                                <td><div className="pay-cell-stack">{fileLinks(payment.attachments?.length ? payment.attachments : [{ name: 'Bukti transfer', url: payment.proof_url }])}</div></td>
                                <td><div className="pay-cell-stack"><span>{payment.note}</span><span className="pay-cell-muted">{payment.actor_name}</span>{payment.void_reason && <span>Alasan pembatalan: {payment.void_reason}</span>}</div></td>
                                <td><StatusBadge tone={payment.voided_at ? 'void' : 'paid'}>{payment.voided_at ? 'Dibatalkan' : 'Tercatat'}</StatusBadge></td>
                                <td>{!payment.voided_at && (canPay || (canRecordAdvance && payment.flow === 'PJ_ADVANCE' && payment.actor_id === ownerId)) && <ActionGroup>
                                    <Button type="button" size="sm" variant="edit" icon="edit" onClick={() => start('edit-proof', { ...payment, term_id: item?.term_id, itemId: payment.item_id, revision: item?.revision, attachments: payment.attachments?.length ? payment.attachments : [{ name: 'Bukti transfer', url: payment.proof_url }] })}>Edit Bukti</Button>
                                    <ActionButton action="reject" tooltip="Batalkan pembayaran" onClick={() => start('cancel-payment', { ...payment, term_id: item?.term_id, itemId: payment.item_id, revision: item?.revision })} />
                                </ActionGroup>}</td>
                            </tr>;
                        })}</tbody>
                    </table></div>
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
        const itemLockedForPj = form.kind === 'single-item' && !!form.id && Number(form.paid || 0) + Number(form.advanced || 0) > 0 && !canPay;
        switch (form.kind as FormKind) {
            case 'activity':
                return (
                    <>
                        <ModalField label="Nama kegiatan" required>
                            <input required maxLength={300} value={form.title} onChange={e => change('title', e.target.value)} placeholder="Contoh: Lomba Sains Antar Madrasah" />
                        </ModalField>
                        <div className="pay-form-row">
                            <ModalField label="Tanggal mulai" required>
                                <DatePicker required value={form.start_date} max={form.end_date || undefined} onChange={value => change('start_date', value)} />
                            </ModalField>
                            <ModalField label="Tanggal selesai" required>
                                <DatePicker required value={form.end_date} min={form.start_date || undefined} onChange={value => change('end_date', value)} />
                            </ModalField>
                        </div>
                        <ModalField label="Total diajukan di proposal (Rp)" hint="Nominal sesuai proposal; terpisah dari total anggaran item.">
                            <input type="number" min="1" max="1000000000000000" step="1" value={form.proposed_total ?? ''} onChange={e => change('proposed_total', e.target.value)} placeholder="Contoh: 3500000" />
                        </ModalField>
                        <ModalField label="Proposal kegiatan" hint="PDF, Word, atau gambar. Maksimal 15 MB. Pilih berkas baru untuk mengganti proposal.">
                            <ModalFileInput files={form.proposal_files || []} onPick={files => change('proposal_files', files)} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" disabled={busy} />
                            {form.proposal_url && <div className="pay-cell-stack">{fileLinks([{ name: form.proposal_name || 'Proposal saat ini', url: form.proposal_url }])}</div>}
                        </ModalField>
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
            case 'single-item':
                return <>
                    {itemLockedForPj && <p className="pay-desc">Item sudah memiliki pembayaran. PJ dapat memperbarui dokumen dan catatan transfer; perubahan harga dilakukan oleh bendahara.</p>}
                    <ModalField label="Nama item" required><input required disabled={itemLockedForPj} maxLength={300} value={form.description} onChange={e => change('description', e.target.value)} placeholder="Contoh: Honor tentor" /></ModalField>
                    <div className="pay-form-row">
                        <ModalField label="Bulan" required><InlineSelect title="Bulan item" value={String(form.month)} onChange={v => change('month', Number(v))} disabled={itemLockedForPj} options={BULAN.map((label, i) => ({ value: String(i + 1), label }))} /></ModalField>
                        <ModalField label="Tahun" required><input required disabled={itemLockedForPj} type="number" min={2000} max={2200} value={form.year} onChange={e => change('year', Number(e.target.value))} /></ModalField>
                    </div>
                    <ModalField label="Ditransfer kepada (catatan)" hint="Pilih guru/staf dari data master atau ketik nama secara manual.">
                        <SearchableSelect creatable value={form.recipient || ''} onChange={value => change('recipient', String(value).slice(0, 200))} options={masterPeople.map(person => ({ value: person.name, label: person.name, subLabel: person.kind === 'TENDIK' ? 'Staf' : 'Guru' }))} placeholder="Cari guru/staf atau ketik nama..." />
                        {masterLoading && <small className="pay-cell-muted">Memuat daftar guru/staf...</small>}
                        {masterError && <span className="pay-master-error">{masterError}<Button type="button" size="sm" variant="ghost" onClick={() => setMasterRefresh(value => value + 1)}>Coba lagi</Button></span>}
                    </ModalField>
                    <div className="pay-form-row pay-form-row--3">
                        <ModalField label="Jumlah" required><input required disabled={itemLockedForPj} type="number" step="0.01" min="0.01" value={form.quantity} onChange={e => change('quantity', e.target.value)} /></ModalField>
                        <ModalField label="Satuan" required><input required disabled={itemLockedForPj} maxLength={40} value={form.unit} onChange={e => change('unit', e.target.value)} /></ModalField>
                        <ModalField label="Harga satuan (Rp)" required><input required disabled={itemLockedForPj} type="number" step="1" min="1" value={form.unit_price} onChange={e => change('unit_price', e.target.value)} /></ModalField>
                    </div>
                    <div className="pay-subtotal"><span>Total item</span><strong>{fmtRupiah(Math.round(Math.round(Number(form.quantity) * 100) * Number(form.unit_price) / 100))}</strong></div>
                    <div className="pay-evidence-section">
                        <strong>1. Dokumen pengajuan item</strong>
                        <span>Ubah judul dokumen tersimpan, lepas dokumen yang tidak diperlukan, atau unggah berkas baru.</span>
                        {(form.attachments || []).length > 0 && <>
                            <span className="pay-evidence-caption">Dokumen tersimpan</span>
                            <ul className="pay-item-documents">{form.attachments.map((a: Attachment, i: number) => <li key={`${a.url}-${i}`}>
                                <input aria-label={`Ubah judul dokumen ${i + 1}`} maxLength={200} value={a.name} onChange={e => change('attachments', form.attachments.map((old: Attachment, j: number) => j === i ? { ...old, name: e.target.value } : old))} />
                                {fileLinks([a])}
                                <button type="button" aria-label={`Lepas ${a.name}`} onClick={() => change('attachments', form.attachments.filter((_: any, j: number) => j !== i))}><i className="bi bi-x-lg" /></button>
                            </li>)}</ul>
                        </>}
                        <ModalField label="Tambah dokumen" hint="PDF, gambar, atau Excel. Maksimal 10 berkas, 15 MB per berkas."><ModalFileInput multiple files={form.ampra_files || []} onPick={pickItemFiles} accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx" disabled={busy} /></ModalField>
                        {(form.ampra_files || []).map((file: File, i: number) => <ModalField key={`${file.name}-${i}`} label={`Judul berkas baru ${i + 1}`} required>
                            <input required maxLength={200} value={form.new_attachment_titles?.[i] || ''} onChange={e => change('new_attachment_titles', form.new_attachment_titles.map((title: string, j: number) => j === i ? e.target.value : title))} placeholder="Contoh: Ampra honor tentor November" />
                        </ModalField>)}
                    </div>
                    {canPay && (Number(form.paid) + Number(form.advanced || 0)) > 0 && <ModalField label="Alasan koreksi" hint="Wajib hanya jika mengubah harga, jumlah, atau periode item yang sudah dibayar."><input value={form.reason} onChange={e => change('reason', e.target.value)} /></ModalField>}
                </>;
            case 'payment':
                return (
                    <>
                        {form.flow === 'REIMBURSEMENT' && <p className="pay-desc">Item ini memiliki transfer PJ dari riwayat lama. Pembayaran berikutnya dicatat sebagai penggantian dana PJ.</p>}
                        <div className="pay-summary">
                            <div className="pay-summary__who">
                                <span className="pay-summary__label">Item</span>
                                <strong>{form.description}</strong>
                                <span className="pay-summary__detail">Catatan transfer kepada: {form.recipient || 'Belum dicatat'}</span>
                            </div>
                            <div className="pay-summary__amount">
                                <span className="pay-summary__label">Sisa tagihan</span>
                                <strong>{fmtRupiah(Number(form.remaining))}</strong>
                            </div>
                        </div>
                        <label className="pay-evidence-toggle"><input type="checkbox" checked={!!form.partial_payment} onChange={e => setForm((old: any) => ({ ...old, partial_payment: e.target.checked, amount: e.target.checked ? old.amount : old.remaining }))} /><span>Bayar sebagian</span></label>
                        {form.partial_payment && <ModalField label="Nominal pembayaran (Rp)" required>
                            <input required type="number" min="1" max={form.remaining} step="1" value={form.amount} onChange={e => change('amount', e.target.value)} />
                        </ModalField>}
                        <ModalField label="Tanggal pembayaran" required><DatePicker required value={form.paid_on} onChange={value => change('paid_on', value)} /></ModalField>
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
                    <p>Perbaiki bukti transfer untuk pembayaran {fmtRupiah(form.amount)}. Nominal dan tanggal pembayaran tetap.</p>
                    <ul className="pay-proof-documents">{(form.attachments || []).map((a: Attachment, i: number) => <li key={`${a.url}-${i}`}>
                        <ModalField label={`Judul bukti ${i + 1}`}><input maxLength={200} value={a.name} onChange={e => change('attachments', form.attachments.map((old: Attachment, j: number) => j === i ? { ...old, name: e.target.value } : old))} /></ModalField>
                        <div className="pay-proof-documents__actions">{fileLinks([a])}<Button type="button" variant="danger" size="sm" icon="delete" onClick={() => change('attachments', form.attachments.filter((_: any, j: number) => j !== i))}>Lepas</Button></div>
                        <ModalField label="Ganti berkas ini"><ModalFileInput files={form.replacement_files?.[a.url] || []} onPick={files => change('replacement_files', { ...form.replacement_files, [a.url]: files })} accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx" disabled={busy} placeholder="Pilih berkas pengganti" /></ModalField>
                    </li>)}</ul>
                    <ModalField label="Tambah bukti lain" hint="Minimal satu bukti tersimpan. Maksimal 10 berkas, 15 MB per berkas.">
                        <ModalFileInput multiple files={form.files || []} onPick={files => change('files', files)} accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx" disabled={busy} />
                    </ModalField>
                </>;
            case 'delete-item':
                return <p className="pay-confirm">Hapus item <strong>“{form.description}”</strong>? Tindakan ini tidak dapat dibatalkan.</p>;
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
