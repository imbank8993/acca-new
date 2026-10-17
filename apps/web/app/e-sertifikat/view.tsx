'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Award, Plus, ArrowLeft, Download, FileCheck2, Upload, QrCode, ExternalLink, CalendarDays, UsersRound } from 'lucide-react';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { Button } from '@/components/ui/Button';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import Tab from '@/components/ui/Tab';
import { DEFAULT_TEMPLATE, type CertificateEvent, type Recipient, type Asset } from '@/lib/e-sertifikat/model';
import TemplateEditor from './TemplateEditor';
import { pointTemplate, newSigner } from '@/lib/e-sertifikat/layout';
import './e-sertifikat.css';

type Detail = { event: CertificateEvent; recipients: Recipient[]; assets: Asset[]; audit: { action: string; created_at: string }[] };
type Excel = { headers: string[]; rows: string[][]; ids: string[] };
const endpoint = '/api/e-sertifikat';
async function request(path = '', init?: RequestInit) {
    const response = await fetch(endpoint + path, { cache: 'no-store', ...init });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || 'Permintaan gagal');
    return json.data;
}
const send = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const initialEvent = () => ({ title: '', organizer: 'MAN Insan Cendekia Gowa', description: '', location: '',
    start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10),
    number_prefix: `ACCA-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, template: structuredClone(DEFAULT_TEMPLATE), archived: false });
const dateLabel = (value: string) => new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('id-ID', { dateStyle: 'long' });

export default function CertificateManager() {
    const [events, setEvents] = useState<CertificateEvent[]>([]), [detail, setDetail] = useState<Detail | null>(null);
    const [draft, setDraft] = useState<CertificateEvent | null>(null), [creating, setCreating] = useState(false), [newEvent, setNewEvent] = useState(initialEvent);
    const [tab, setTab] = useState<'template' | 'penerima' | 'dokumen'>('template');
    const [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [recipientQuery, setRecipientQuery] = useState('');
    const [recipientStatus, setRecipientStatus] = useState('all'), [page, setPage] = useState(1), [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [excel, setExcel] = useState<Excel | null>(null), [nameCol, setNameCol] = useState('0'), [schoolCol, setSchoolCol] = useState(''), [extras, setExtras] = useState<string[]>([]);
    const [preview, setPreview] = useState(''), [revoke, setRevoke] = useState<Recipient | null>(null), [reason, setReason] = useState(''), [confirmIssue, setConfirmIssue] = useState(false);
    const [editRecipient, setEditRecipient] = useState<Recipient | null>(null), [removeAsset, setRemoveAsset] = useState<Asset | null>(null);
    const [kind, setKind] = useState('documentation');
    const selection = useRef(0), selectedEventId = useRef<string | null>(null);
    const loadList = async () => { setEvents(await request()); };
    const load = async (id: string) => {
        const version = ++selection.current; selectedEventId.current = id;
        const data = await request(`/${id}`);
        if (version !== selection.current) return;
        setDetail(data); setDraft(structuredClone(data.event)); setSelected([]);
    };
    useEffect(() => { loadList().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    useEffect(() => { setPage(1); }, [recipientQuery, recipientStatus]);
    const work = async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Permintaan gagal'); } finally { setBusy(false); }
    };
    const save = async () => {
        if (!draft) return;
        const saved = await request(`/${draft.id}`, send(draft, 'PATCH'));
        if (selectedEventId.current === saved.id) { setDraft(saved); setDetail(old => old ? { ...old, event: saved } : old); }
        await loadList();
    };
    const filtered = useMemo(() => (detail?.recipients || []).filter(row =>
        (recipientStatus === 'all' || row.status === recipientStatus) && `${row.name} ${row.institution} ${row.certificate_number || ''}`.toLowerCase().includes(recipientQuery.toLowerCase())), [detail, recipientStatus, recipientQuery]);
    const visible = filtered.slice((page - 1) * 25, page * 25);
    useEffect(() => { setPage(current => Math.min(current, Math.max(1, Math.ceil(filtered.length / 25)))); }, [filtered.length]);
    const changeTab = (next: typeof tab) => {
        if (busy) return;
        if (draft && JSON.stringify(draft) !== JSON.stringify(detail?.event)) work(async () => { await save(); setTab(next); });
        else setTab(next);
    };
    const leaveEvent = async () => {
        if (draft && JSON.stringify(draft) !== JSON.stringify(detail?.event)) await save();
        selection.current++; selectedEventId.current = null;
        setDraft(null); setDetail(null); setExcel(null); setSelected([]); setPage(1);
    };
    const selectedDrafts = (detail?.recipients || []).filter(row => row.status === 'draft' && selected.includes(row.id));
    const selectedIssued = (detail?.recipients || []).filter(row => row.status === 'issued' && selected.includes(row.id));
    const filteredEvents = useMemo(() => events.filter(event => (status === 'all' || event.archived === (status === 'archived')) && `${event.title} ${event.organizer}`.toLowerCase().includes(query.toLowerCase())), [events, status, query]);
    const uploadAsset = async (file: File, assetKind: string) => {
        if (!draft) return;
        const data = new FormData(); data.set('file', file); data.set('kind', assetKind);
        const asset = await request(`/${draft.id}/assets`, { method: 'POST', body: data });
        if (assetKind === 'template') {
            const geometry = await request(`/${draft.id}/geometry/${asset.id}`);
            const template = pointTemplate({ ...structuredClone(DEFAULT_TEMPLATE), assetId: asset.id, signers: draft.template.signers?.map((signer, index) => ({ ...newSigner(geometry, index), id: signer.id, name: signer.name, title: signer.title, print: signer.print })) }, geometry);
            await request(`/${draft.id}`, send({ ...draft, template }, 'PATCH'));
        }
        await load(draft.id); setMessage(assetKind === 'template' ? 'Template diunggah dan disimpan. Atur posisi teks dan QR, lalu periksa pratinjau.' : 'Dokumen diunggah sebagai berkas internal.');
    };
    const showPreview = async () => {
        if (!draft) return;
        await save();
        const example = detail?.recipients.find(row => selected.includes(row.id)) || detail?.recipients[0];
        const response = await fetch(`${endpoint}/${draft.id}/preview`, send({ name: example?.name, institution: example?.institution, identities: example?.identities }));
        if (!response.ok) throw new Error((await response.json()).error || 'Pratinjau gagal');
        setPreview(URL.createObjectURL(await response.blob()));
    };
    const importRows = excel?.rows.map((row, index) => ({ id: excel.ids[index], name: row[Number(nameCol)] || '', institution: schoolCol === '' ? '' : row[Number(schoolCol)] || '',
        identities: Object.fromEntries(extras.map(value => [excel.headers[Number(value)], row[Number(value)] || ''])) })) || [];
    const eventFields = (value: ReturnType<typeof initialEvent> | CertificateEvent, change: (next: any) => void) => <div className="ec-form-grid">
        <label>Nama kegiatan<input required maxLength={200} value={value.title} onChange={e => change({ ...value, title: e.target.value })} /></label>
        <label>Penyelenggara<input required maxLength={200} value={value.organizer} onChange={e => change({ ...value, organizer: e.target.value })} /></label>
        <label>Tanggal mulai<input type="date" required value={value.start_date} onChange={e => change({ ...value, start_date: e.target.value })} /></label>
        <label>Tanggal akhir<input type="date" required value={value.end_date} onChange={e => change({ ...value, end_date: e.target.value })} /></label>
        <label>Lokasi<input maxLength={200} value={value.location} onChange={e => change({ ...value, location: e.target.value })} /></label>
        <label>Awalan nomor sertifikat<input required maxLength={60} value={value.number_prefix} onChange={e => change({ ...value, number_prefix: e.target.value })} /><small>Nomor berurutan otomatis, misalnya {value.number_prefix}/0001.</small></label>
        <label className="ec-full">Keterangan kegiatan<textarea rows={3} maxLength={3000} value={value.description} onChange={e => change({ ...value, description: e.target.value })} /><small>Keterangan ini akan tampil pada verifikasi sertifikat yang terbit.</small></label>
    </div>;
    const recipientActions = (row: Recipient) => !draft ? null : <div className="ec-row-actions">
        {row.status === 'issued' && <><a className="ec-icon-button" href={`${endpoint}/${draft.id}/certificates/${row.id}/pdf`} aria-label={`Unduh PDF ${row.name}`} title="Unduh PDF"><Download size={18} /></a><a className="ec-icon-button" href={`/e-sertifikat/verifikasi/${row.verify_token}`} target="_blank" rel="noopener noreferrer" title="Verifikasi" aria-label={`Verifikasi ${row.name}`}><ExternalLink size={18} /></a><button className="ec-text-button ec-danger" disabled={busy} onClick={() => { setRevoke(row); setReason(''); }}>Cabut</button></>}
        {row.status === 'draft' && <><button className="ec-text-button" disabled={busy} onClick={() => setEditRecipient(structuredClone(row))}>Edit</button><button className="ec-text-button ec-danger" disabled={busy} onClick={() => work(async () => { await request(`/${draft.id}/recipients/${row.id}`, { method: 'DELETE' }); await load(draft.id); })}>Hapus draf</button></>}
        {row.status === 'revoked' && <button className="ec-text-button" disabled={busy} onClick={() => work(async () => { await request(`/${draft.id}/recipients`, send({ rows: [{ id: crypto.randomUUID(), name: row.name, institution: row.institution, identities: row.identities }] })); await load(draft.id); setMessage('Draf pengganti dibuat. Perbaiki identitas sebelum menerbitkan nomor baru.'); })}>Buat pengganti</button>}
    </div>;
    return <div className="ec-root ec-manager" aria-busy={busy}>
        {!draft && !loading && !creating && <DesktopFab label="Kegiatan baru" mobileLabel="Tambah" icon={<Plus size={21} />} mobileIcon="plus-lg" title="Tambah kegiatan sertifikat" onClick={() => { if (busy) return; setNewEvent(initialEvent()); setCreating(true); }} />}
        {error && typeof document !== 'undefined' && createPortal(<div className="ec-root ec-error-toast"><div className="ec-alert ec-alert--error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Tutup pesan">×</button></div></div>, document.body)}
        {message && <div className="ec-alert" role="status">{message}</div>}
        {loading ? <div className="ec-empty" role="status">Memuat kegiatan…</div> : !draft ? <section className="ec-panel ec-events-panel" aria-label="Daftar kegiatan sertifikat">
            <div className="ec-panel-heading"><div className="ec-panel-title"><span className="ec-heading-icon"><Award size={21} /></span><div><h2>Daftar kegiatan</h2><p>Kelola template, peserta, dan penerbitan sertifikat kegiatan.</p></div></div><span className="ec-list-count">{filteredEvents.length} kegiatan</span></div>
            <FilterToolbar><FilterSearch value={query} onChange={setQuery} placeholder="Cari kegiatan atau penyelenggara" /><FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Semua kegiatan' }, { value: 'active', label: 'Aktif' }, { value: 'archived', label: 'Diarsipkan' }]} /></FilterToolbar>
            {!!filteredEvents.length && <div className="ec-event-grid">{filteredEvents.map(event =>
                <button className="ec-event-card" key={event.id} aria-label={`Kelola ${event.title}`} disabled={busy} onClick={() => work(async () => { await load(event.id); setTab('template'); })}>
                    <div className="ec-event-card-top"><span className="ec-event-icon"><Award size={22} /></span><span className={`ec-pill${event.archived ? ' ec-pill--archived' : ''}`}>{event.archived ? 'Diarsipkan' : 'Aktif'}</span></div><h3>{event.title}</h3><p>{event.organizer}</p><div className="ec-event-meta"><span><CalendarDays size={15} />{dateLabel(event.start_date)}</span><span><UsersRound size={15} />{event.total || 0} peserta</span></div><div className="ec-event-counts"><strong><FileCheck2 size={15} />{event.issued || 0} sertifikat terbit</strong><span className="ec-event-open">Kelola kegiatan</span></div>
                </button>)}</div>}
            {!filteredEvents.length && <div className="ec-empty"><span className="ec-empty-icon"><Award size={30} /></span><h3>{events.length ? 'Kegiatan tidak ditemukan' : 'Belum ada kegiatan'}</h3><p>{events.length ? 'Sesuaikan pencarian atau status untuk melihat kegiatan lainnya.' : 'Gunakan tombol tambah untuk membuat kegiatan, unggah template, lalu impor peserta dari Excel.'}</p>{!!events.length && <Button variant="secondary" size="sm" onClick={() => { setQuery(''); setStatus('all'); }}>Reset filter</Button>}</div>}
        </section> : <>
            <div className="ec-detail-heading"><Button variant="secondary" size="sm" className="ec-button ec-button--soft ec-detail-back" aria-label="Kembali ke daftar kegiatan" title="Kembali ke daftar kegiatan" disabled={busy} onClick={() => work(leaveEvent)}><ArrowLeft size={16} /><span className="ec-detail-back-label">Kegiatan</span></Button><div className="ec-detail-summary"><h2>{detail?.event.title}</h2><div className="ec-detail-meta"><span><UsersRound size={13} />{detail?.recipients.length || 0} peserta</span><span><FileCheck2 size={13} />{detail?.recipients.filter(row => row.status === 'issued').length || 0} terbit</span><span className={`ec-pill${draft.archived ? ' ec-pill--archived' : ''}`}>{draft.archived ? 'Diarsipkan' : 'Aktif'}</span></div></div></div>
            <Tab variant="slider" ariaLabel="Pengelolaan e-sertifikat" tabs={[{ key: 'template', label: 'Kegiatan & Template', shortLabel: 'Template', icon: 'award' }, { key: 'penerima', label: 'Penerima & Sertifikat', shortLabel: 'Penerima', icon: 'people' }, { key: 'dokumen', label: 'Dokumen Pendukung', shortLabel: 'Dokumen', icon: 'folder2-open' }]} activeTab={tab} onChange={changeTab} />
            {tab === 'template' && <>
                <section className="ec-panel"><h2>Informasi kegiatan</h2>{eventFields(draft, setDraft)}<label className="ec-check"><input type="checkbox" checked={draft.archived} onChange={e => setDraft({ ...draft, archived: e.target.checked })} /> Arsipkan kegiatan (hentikan impor dan penerbitan baru)</label></section>
                <section className="ec-panel"><div className="ec-section-title"><div><h2>Desain sertifikat</h2><p>Unggah desain tanpa identitas peserta dan QR. Ukuran asli template dipertahankan. PDF satu halaman, PNG, atau JPG, maksimal 5 MB.</p></div><label className="ec-button ec-button--soft"><Upload size={17} /> Unggah template<input type="file" hidden accept="application/pdf,image/png,image/jpeg" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) work(() => uploadAsset(file, 'template')); }} /></label></div>
                    {draft.template.assetId ? <p className="ec-template-file"><FileCheck2 size={18} /> {detail?.assets.find(asset => asset.id === draft.template.assetId)?.filename || 'Template terpasang'}</p> : <div className="ec-empty ec-empty--small">Template wajib diunggah sebelum menerbitkan sertifikat.</div>}
                    {draft.template.assetId && <TemplateEditor eventId={draft.id} template={draft.template} numberPrefix={draft.number_prefix} recipients={detail?.recipients || []} disabled={busy} onChange={template => setDraft(current => current ? { ...current, template } : current)} />}
                    <div className="ec-actions"><Button variant="primary" className="ec-button" disabled={busy} onClick={() => work(async () => { await save(); setMessage('Informasi kegiatan dan tata letak disimpan.'); })}>Simpan perubahan</Button><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy || !draft.template.assetId} onClick={() => work(showPreview)}><QrCode size={17} /> Simpan & pratinjau PDF</Button></div>
                </section>
            </>}
            {tab === 'penerima' && <section className="ec-panel">
                <div className="ec-section-title"><div><h2>Penerima sertifikat</h2><p>Data Excel: pilih kolom nama, asal sekolah, dan identitas tambahan yang dicetak.</p></div><label className="ec-button"><Upload size={17} /> Impor Excel<input type="file" hidden accept=".xlsx,.csv" disabled={busy || draft.archived} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) work(async () => { const form = new FormData(); form.set('file', file); const result = await request('/excel', { method: 'POST', body: form }); setExcel({ ...result, ids: result.rows.map(() => crypto.randomUUID()) }); setNameCol(String(Math.max(0, result.headers.findIndex((h: string) => /nama|name/i.test(h))))); const index = result.headers.findIndex((h: string) => /sekolah|instansi|institution/i.test(h)); setSchoolCol(index < 0 ? '' : String(index)); setExtras([]); }); }} /></label></div>
                <div className="ec-actions"><a className="ec-link" href="/templates/peserta-e-sertifikat.xlsx" download>Unduh format peserta Excel (.xlsx)</a><a className="ec-link" href="/templates/peserta-e-sertifikat.csv" download>Versi CSV</a></div>
                <FilterToolbar><FilterSearch value={recipientQuery} onChange={setRecipientQuery} placeholder="Cari nama, sekolah, atau nomor" /><FilterSelect label="Status sertifikat" value={recipientStatus} onChange={setRecipientStatus} options={[{ value: 'all', label: 'Semua status' }, { value: 'draft', label: 'Draf' }, { value: 'issued', label: 'Terbit' }, { value: 'revoked', label: 'Dicabut' }]} /></FilterToolbar>
                <div className="ec-actions"><Button variant="primary" className="ec-button" disabled={busy || !selectedDrafts.length || selectedDrafts.length > 100 || draft.archived} onClick={() => setConfirmIssue(true)}>Terbitkan ({selectedDrafts.length})</Button><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy || !selectedIssued.length || selectedIssued.length > 25} onClick={() => work(async () => {
                    const response = await fetch(`${endpoint}/${draft.id}/download`, send({ ids: selectedIssued.map(row => row.id) }));
                    if (!response.ok) throw new Error((await response.json()).error || 'Unduhan gagal');
                    const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sertifikat-kegiatan.zip'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
                })}><Download size={17} /> Unduh ZIP ({selectedIssued.length})</Button><small>Pilih maksimal 100 draf untuk terbit atau 25 sertifikat untuk unduh ZIP.</small></div>
                <div className="ec-table-scroll ec-recipients-table"><table className="ec-table"><thead><tr><th><input type="checkbox" aria-label="Pilih peserta pada halaman ini" checked={visible.length > 0 && visible.every(row => selected.includes(row.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...visible.map(row => row.id)])] : selected.filter(id => !visible.some(row => row.id === id)))} /></th><th>Nama</th><th>Asal sekolah / instansi</th><th>Nomor & Status</th><th>Aksi</th></tr></thead>
                    <tbody>{visible.map(row => <tr key={row.id}><td><input type="checkbox" aria-label={`Pilih ${row.name}`} checked={selected.includes(row.id)} onChange={e => setSelected(e.target.checked ? [...selected, row.id] : selected.filter(id => id !== row.id))} /></td><td><strong>{row.name}</strong>{Object.entries(row.identities).map(([key, value]) => <small key={key}>{key}: {value}</small>)}</td><td>{row.institution || '-'}</td><td><span className={`ec-pill ec-pill--${row.status}`}>{({ draft: 'Draf', issued: 'Terbit', revoked: 'Dicabut' })[row.status]}</span><small>{row.certificate_number || 'Belum bernomor'}</small></td><td>{recipientActions(row)}</td></tr>)}</tbody></table></div>
                <div className="ec-recipient-cards"><label className="ec-check"><input type="checkbox" aria-label="Pilih semua peserta di mobile" checked={visible.length > 0 && visible.every(row => selected.includes(row.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...visible.map(row => row.id)])] : selected.filter(id => !visible.some(row => row.id === id)))} /> Pilih semua pada halaman ini</label>{visible.map(row => <article key={row.id} className="ec-recipient-card"><div className="ec-recipient-card-head"><label className="ec-check"><input type="checkbox" aria-label={`Pilih ${row.name} di mobile`} checked={selected.includes(row.id)} onChange={e => setSelected(e.target.checked ? [...selected, row.id] : selected.filter(id => id !== row.id))} /><strong>{row.name}</strong></label><span className={`ec-pill ec-pill--${row.status}`}>{({ draft: 'Draf', issued: 'Terbit', revoked: 'Dicabut' })[row.status]}</span></div><p>{row.institution || 'Asal sekolah / instansi belum diisi'}</p>{Object.entries(row.identities).map(([key, value]) => <small key={key}>{key}: {value}</small>)}<small>{row.certificate_number || 'Belum bernomor'}</small>{recipientActions(row)}</article>)}</div>
                {!filtered.length && <div className="ec-empty ec-empty--small">Belum ada peserta yang sesuai.</div>}
                <div className="ec-pagination"><span>{filtered.length} peserta · Halaman {page} / {Math.max(1, Math.ceil(filtered.length / 25))}</span><Button variant="secondary" className="ec-button ec-button--soft" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button><Button variant="secondary" className="ec-button ec-button--soft" disabled={page * 25 >= filtered.length} onClick={() => setPage(page + 1)}>Berikutnya</Button></div>
            </section>}
            {tab === 'dokumen' && <section className="ec-panel"><h2>Dokumen pendukung kegiatan</h2><p>Berkas bersifat internal sampai Anda mengaktifkan “Tampil pada verifikasi”. Dokumen publik dapat dibuka oleh siapa pun yang memiliki QR sertifikat aktif kegiatan ini.</p>
                <div className="ec-actions"><label>Kategori<select value={kind} onChange={e => setKind(e.target.value)}><option value="documentation">Dokumentasi kegiatan</option><option value="correspondence">Dokumen persuratan</option></select></label><label className="ec-button"><Upload size={17} /> Unggah dokumen<input type="file" hidden accept="application/pdf,image/png,image/jpeg" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) work(() => uploadAsset(file, kind)); }} /></label><small>PDF, PNG, JPG, maksimal 5 MB per berkas; 20 berkas per kegiatan termasuk template.</small></div>
                <div className="ec-document-list">{detail?.assets.map(asset => <div key={asset.id} className="ec-document"><div><a className="ec-link" href={`${endpoint}/${draft.id}/assets/${asset.id}`} target="_blank" rel="noopener noreferrer">{asset.filename}</a><small>{asset.kind === 'documentation' ? 'Dokumentasi kegiatan' : asset.kind === 'template' ? 'Template sertifikat' : 'Dokumen persuratan'}</small></div><div className="ec-row-actions">{asset.kind !== 'template' && <label className="ec-check"><input type="checkbox" checked={asset.is_public} disabled={busy} onChange={e => { const checked = e.target.checked; work(async () => { await request(`/${draft.id}/assets/${asset.id}`, send({ is_public: checked }, 'PATCH')); await load(draft.id); }); }} /> Tampil pada verifikasi</label>}<button className="ec-text-button ec-danger" disabled={busy || asset.id === draft.template.assetId} onClick={() => setRemoveAsset(asset)}>Hapus</button></div></div>)}</div>
                <details className="ec-audit"><summary>Riwayat pengelolaan</summary>{detail?.audit.map((item, index) => <p key={index}>{new Date(item.created_at).toLocaleString('id-ID')} · {item.action}</p>)}</details>
            </section>}
        </>}
        {creating && <Modal title="Kegiatan baru" size="lg" onClose={() => !busy && setCreating(false)}><ModalBody><div className="ec-root">{eventFields(newEvent, setNewEvent)}</div></ModalBody><ModalFooter><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy} onClick={() => setCreating(false)}>Batal</Button><Button variant="primary" className="ec-button" disabled={busy} onClick={() => work(async () => { const created = await request('', send(newEvent)); await loadList(); await load(created.id); setCreating(false); setTab('template'); })}>Buat kegiatan</Button></ModalFooter></Modal>}
        {excel && <Modal title="Petakan kolom Excel" size="xl" onClose={() => !busy && setExcel(null)}><ModalBody><div className="ec-root"><p>{excel.rows.length} peserta ditemukan. Nama wajib dipilih. Identitas tambahan yang dipilih akan dicetak sesuai tata letak template dan tidak dipublikasikan pada halaman verifikasi.</p><div className="ec-form-grid"><label>Kolom nama<select value={nameCol} onChange={e => setNameCol(e.target.value)}>{excel.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label><label>Kolom asal sekolah / instansi<select value={schoolCol} onChange={e => setSchoolCol(e.target.value)}><option value="">Tidak dicetak / tidak tersedia</option>{excel.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label></div><fieldset><legend>Identitas tambahan (maksimal 8)</legend><div className="ec-actions">{excel.headers.map((header, index) => <label className="ec-check" key={index}><input type="checkbox" checked={extras.includes(String(index))} disabled={busy || (extras.length >= 8 && !extras.includes(String(index)))} onChange={e => setExtras(e.target.checked ? [...extras, String(index)] : extras.filter(value => value !== String(index)))} />{header}</label>)}</div></fieldset><h3>Pratinjau 5 peserta pertama</h3><div className="ec-table-scroll"><table className="ec-table"><thead><tr><th>Nama</th><th>Asal sekolah / instansi</th><th>Identitas tambahan</th></tr></thead><tbody>{importRows.slice(0, 5).map(row => <tr key={row.id}><td>{row.name || <span className="ec-danger">Nama kosong</span>}</td><td>{row.institution || '-'}</td><td>{Object.entries(row.identities).map(([key, value]) => <small key={key}>{key}: {value}</small>)}</td></tr>)}</tbody></table></div></div></ModalBody><ModalFooter><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy} onClick={() => setExcel(null)}>Batal</Button><Button variant="primary" className="ec-button" disabled={busy || importRows.some(row => !row.name) || !draft} onClick={() => work(async () => { await request(`/${draft!.id}/recipients`, send({ rows: importRows })); await load(draft!.id); setExcel(null); setMessage('Peserta diimpor sebagai draf. Periksa pratinjau sebelum menerbitkan.'); })}>Impor {excel.rows.length} peserta</Button></ModalFooter></Modal>}
        {preview && <Modal title="Pratinjau sertifikat" size="xl" onClose={() => setPreview('')}><ModalBody><iframe className="ec-pdf-preview" title="Pratinjau PDF sertifikat" src={preview} /><a className="ec-link" href={preview} target="_blank" rel="noopener noreferrer">Buka pratinjau PDF</a></ModalBody><ModalFooter><Button variant="primary" className="ec-button" onClick={() => setPreview('')}>Tutup</Button></ModalFooter></Modal>}
        {editRecipient && <Modal title="Perbaiki identitas peserta" onClose={() => !busy && setEditRecipient(null)}><ModalBody><div className="ec-root"><div className="ec-form-grid"><label>Nama<input maxLength={180} value={editRecipient.name} onChange={e => setEditRecipient({ ...editRecipient, name: e.target.value })} /></label><label>Asal sekolah / instansi<input maxLength={200} value={editRecipient.institution} onChange={e => setEditRecipient({ ...editRecipient, institution: e.target.value })} /></label>{Object.entries(editRecipient.identities).map(([key, value]) => <label key={key}>{key}<input maxLength={200} value={value} onChange={e => setEditRecipient({ ...editRecipient, identities: { ...editRecipient.identities, [key]: e.target.value } })} /></label>)}</div></div></ModalBody><ModalFooter><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy} onClick={() => setEditRecipient(null)}>Batal</Button><Button variant="primary" className="ec-button" disabled={busy || !editRecipient.name.trim()} onClick={() => work(async () => { await request(`/${draft!.id}/recipients/${editRecipient.id}`, send(editRecipient, 'PATCH')); await load(draft!.id); setEditRecipient(null); setMessage('Identitas peserta diperbaiki.'); })}>Simpan identitas</Button></ModalFooter></Modal>}
        {removeAsset && <Modal title="Hapus berkas kegiatan" onClose={() => !busy && setRemoveAsset(null)}><ModalBody><p>Berkas {removeAsset.filename} akan dihapus dan tidak lagi tersedia pada verifikasi. Template yang sudah digunakan pada sertifikat terbit tidak dapat dihapus.</p></ModalBody><ModalFooter><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy} onClick={() => setRemoveAsset(null)}>Batal</Button><Button variant="danger" className="ec-button ec-button--danger" disabled={busy} onClick={() => work(async () => { await request(`/${draft!.id}/assets/${removeAsset.id}`, { method: 'DELETE' }); await load(draft!.id); setRemoveAsset(null); setMessage('Berkas dihapus.'); })}>Hapus berkas</Button></ModalFooter></Modal>}
        {confirmIssue && <Modal title="Terbitkan sertifikat" onClose={() => !busy && setConfirmIssue(false)}><ModalBody><p>{selectedDrafts.length} sertifikat akan diberi nomor dan QR unik. Pastikan desain dan identitas peserta sudah benar. Data pada sertifikat yang terbit tidak berubah ketika kegiatan diedit.</p></ModalBody><ModalFooter><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy} onClick={() => setConfirmIssue(false)}>Batal</Button><Button variant="primary" className="ec-button" disabled={busy} onClick={() => work(async () => { const result = await request(`/${draft!.id}/issue`, send({ ids: selectedDrafts.map(row => row.id) })); await load(draft!.id); await loadList(); setConfirmIssue(false); setMessage(`${result.count} sertifikat diterbitkan. PDF sudah dapat diunduh.`); })}>Terbitkan sekarang</Button></ModalFooter></Modal>}
        {revoke && <Modal title="Cabut sertifikat" onClose={() => !busy && setRevoke(null)}><ModalBody><div className="ec-root"><p>Sertifikat {revoke.name} akan berstatus Dicabut saat QR dipindai. Tindakan ini tidak dapat dibatalkan; terbitkan sertifikat pengganti bila diperlukan.</p><label>Alasan pencabutan<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3} /></label></div></ModalBody><ModalFooter><Button variant="secondary" className="ec-button ec-button--soft" disabled={busy} onClick={() => setRevoke(null)}>Batal</Button><Button variant="danger" className="ec-button ec-button--danger" disabled={busy || !reason.trim()} onClick={() => work(async () => { await request(`/${draft!.id}/certificates/${revoke.id}/revoke`, send({ reason })); await load(draft!.id); setRevoke(null); setMessage('Sertifikat dicabut.'); })}>Cabut sertifikat</Button></ModalFooter></Modal>}
    </div>;
}
