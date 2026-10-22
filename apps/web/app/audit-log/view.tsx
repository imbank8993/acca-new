'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/lib/types';
import { Tab } from '@/components/ui/Tab';
import { useTabParam } from '@/hooks/useTabParam';
import { useTimezone } from '@/hooks/use-timezone';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { FilterToolbar, FilterSearch, FilterInput, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import './audit-log.css';

type Log = { id: string; user_name: string | null; user_nip: string | null; user_role: string | null; entity: string; entity_id: string | null; action: string; created_at: string; ip_address: string | null; details: any };
type Table = { schema: string; name: string; columns: number; estimated_rows: string; readable: boolean };
type Column = { name: string; type: string; nullable: boolean; primary_key: boolean };
type ObjectFile = { key: string; name: string; size: number; modified: string | null };
type Files = { bucket: string; folders: { key: string; name: string }[]; files: ObjectFile[]; nextCursor: string | null };

/** A response belongs to its URL: late requests never replace the current table/folder. */
function useRemote<T>(url: string | null, refresh = 0) {
    const [state, setState] = useState<{ url: string | null; refresh: number; data?: T; error?: string; loading: boolean }>({ url: null, refresh: 0, loading: true });
    useEffect(() => {
        if (!url) return;
        const controller = new AbortController(); let active = true;
        const timeout = setTimeout(() => controller.abort(), 30000);
        setState({ url, refresh, loading: true });
        (async () => {
            try {
                const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
                const body = await response.json();
                if (!response.ok || !body.ok) throw Error(typeof body.error === 'string' ? body.error : 'Data belum dapat dimuat.');
                if (active) setState({ url, refresh, data: body, loading: false });
            } catch (error) { if (active) setState({ url, refresh, error: controller.signal.aborted ? 'Permintaan terlalu lama. Silakan coba lagi.' : error instanceof Error ? error.message : 'Koneksi terganggu.', loading: false }); }
            finally { clearTimeout(timeout); }
        })();
        return () => { active = false; clearTimeout(timeout); controller.abort(); };
    }, [url, refresh]);
    return state.url === url && state.refresh === refresh ? state : { loading: !!url, data: undefined, error: undefined };
}

function useAuditDate() {
    const { timezone, formatDateTime } = useTimezone();
    return { date: (value?: string | null) => value ? formatDateTime(value) : '—', zone: timezone === 'Asia/Jakarta' ? 'WIB' : timezone === 'Asia/Jayapura' ? 'WIT' : 'WITA' };
}
function pretty(value: unknown) { return JSON.stringify(value, null, 2); }
function cell(value: unknown) { return value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''); }
function size(bytes: number) { if (!bytes) return '0 B'; const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4); return `${(bytes / 1024 ** unit).toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${['B','KB','MB','GB','TB'][unit]}`; }
function Loading() { return <div className="audit-empty"><Spinner size={28} /><p>Memuat data...</p></div>; }
function Failure({ message, retry }: { message: string; retry: () => void }) { return <div className="audit-error" role="alert"><p>{message}</p><Button size="sm" variant="secondary" onClick={retry}>Coba lagi</Button></div>; }
function Pager({ page, next, count, limit, onChange }: { page: number; next: boolean; count: number; limit: number; onChange: (value: number) => void }) {
    return <div className="audit-pager"><span>{count ? `${(page - 1) * limit + 1}–${(page - 1) * limit + count}` : '0'} data</span><div><Button size="sm" variant="secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>Sebelumnya</Button><span>Halaman {page}</span><Button size="sm" variant="secondary" disabled={!next} onClick={() => onChange(page + 1)}>Berikutnya</Button></div></div>;
}

function History() {
    const { date, zone } = useAuditDate();
    const [refresh, setRefresh] = useState(0), [page, setPage] = useState(1), [limit, setLimit] = useState(20);
    const [draft, setDraft] = useState(''), [search, setSearch] = useState(''), [entityDraft, setEntityDraft] = useState(''), [entity, setEntity] = useState('');
    const [action, setAction] = useState('Semua'), [selected, setSelected] = useState<Log | null>(null);
    // Apply shared mobile filters, including their reset/clear controls.
    useEffect(() => {
        const timeout = setTimeout(() => { setSearch(draft.trim()); setEntity(entityDraft.trim()); setPage(1); }, 300);
        return () => clearTimeout(timeout);
    }, [draft, entityDraft]);
    const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit), action, search, entity });
    const result = useRemote<{ data: Log[]; total: number }>('/api/audit-logs?' + params, refresh);
    const coverage = useRemote<{ active: boolean; covered: number; total: number }>('/api/audit-logs/status', refresh);
    const retry = () => setRefresh(value => value + 1);
    const applySearch = () => { setSearch(draft.trim()); setEntity(entityDraft.trim()); setPage(1); };
    return <>
        <div className={`audit-notice ${coverage.data?.active ? '' : 'is-warning'}`}>
            <i className={`bi bi-${coverage.data?.active ? 'shield-check' : 'info-circle'}`} />
            <span>{coverage.loading ? 'Memeriksa cakupan audit...' : coverage.error ? 'Status pencatatan belum dapat diperiksa.' : coverage.data?.active ? `Pencatatan aktif pada ${coverage.data.covered} tabel. Setiap penambahan, perubahan, dan penghapusan data tersimpan otomatis.` : 'Pencatatan menyeluruh belum aktif di server. Riwayat yang sudah tersedia tetap ditampilkan.'}</span>
        </div>
        <FilterToolbar className="audit-filters">
            <FilterSearch label="Cari catatan audit" value={draft} onChange={setDraft} placeholder="Cari nama, NIP, tabel, atau ID data" onKeyDown={event => { if (event.key === 'Enter') applySearch(); }} />
            <FilterInput label="Nama tabel" icon="table" value={entityDraft} onChange={setEntityDraft} placeholder="Filter nama tabel" clearable onKeyDown={event => { if (event.key === 'Enter') applySearch(); }} />
            <FilterSelect label="Tindakan" icon="activity" value={action} onChange={value => { setAction(value || 'Semua'); setPage(1); }} options={[
                { value: 'Semua', label: 'Semua tindakan' }, { value: 'CREATE', label: 'Tambah' },
                { value: 'UPDATE', label: 'Edit' }, { value: 'DELETE', label: 'Hapus' },
            ]} />
            <FilterActions>
                <Button type="button" size="sm" variant="primary" icon="search" onClick={applySearch}>Cari</Button>
                <Button type="button" size="sm" variant="secondary" icon="refresh" onClick={retry}>Segarkan</Button>
            </FilterActions>
        </FilterToolbar>
        {result.loading ? <Loading /> : result.error ? <Failure message={result.error} retry={retry} /> : <>
            <div className="audit-scroll"><table className="audit-table"><thead><tr><th>Waktu · {zone}</th><th>Pelaku</th><th>Tindakan</th><th>Tabel / modul</th><th>Data & lokasi</th><th>Aksi</th></tr></thead><tbody>
                {!result.data?.data.length && <tr><td colSpan={6} className="audit-empty-cell">Belum ada catatan yang sesuai.</td></tr>}
                {result.data?.data.map(log => <tr key={log.id}><td className="audit-nowrap">{date(log.created_at)}</td><td><strong>{log.user_name || 'Sistem / database'}</strong><small>{log.user_nip || log.user_role || 'Proses sistem'}</small></td>
                    <td><span className={`audit-badge ${log.action.startsWith('DELETE') ? 'is-delete' : log.action.startsWith('CREATE') ? 'is-create' : ''}`}>{log.action === 'CREATE' ? 'Tambah' : log.action === 'UPDATE' ? 'Edit' : log.action === 'DELETE' ? 'Hapus' : log.action.replaceAll('_', ' ')}</span></td>
                    <td>{log.entity}</td><td><span className="audit-ellipsis">{log.entity_id || '—'}</span><small className="audit-ellipsis">{log.details?.page || '—'}</small></td><td><ActionGroup><ActionButton action="view" tooltip={`Detail perubahan ${log.entity}`} onClick={() => setSelected(log)} /></ActionGroup></td></tr>)}
            </tbody></table></div>
            <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil((result.data?.total || 0) / limit))} totalItems={result.data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={value => { setLimit(value); setPage(1); }} />
        </>}
        {selected && <Modal title="Detail perubahan" icon="shield-check" size="xl" onClose={() => setSelected(null)}><ModalBody>
            <div className="audit-detail-meta"><strong>{selected.entity}</strong><span>{selected.user_name || 'Sistem / database'} · {date(selected.created_at)} {zone}</span><span>{selected.details?.page || '—'}{selected.ip_address ? ` · ${selected.ip_address}` : ''}</span></div>
            {Array.isArray(selected.details?.changed_columns) && <div className="audit-chips">{selected.details.changed_columns.map((column: string) => <span key={column}>{column}</span>)}</div>}
            {selected.details?.values_hidden ? <p className="audit-notice">Isi tabel autentikasi disembunyikan. Nama kolom yang berubah tetap tercatat.</p> : null}
            {selected.details?.source === 'database' ? <div className="audit-diff"><section><h3>Sebelum</h3><pre>{pretty(selected.details.before)}</pre></section><section><h3>Sesudah</h3><pre>{pretty(selected.details.after)}</pre></section></div> : <pre className="audit-json">{pretty(selected.details || {})}</pre>}
        </ModalBody><ModalFooter><Button variant="cancel" onClick={() => setSelected(null)}>Tutup</Button></ModalFooter></Modal>}
    </>;
}

function DatabaseExplorer() {
    const [filter, setFilter] = useState(''), [selected, setSelected] = useState<Table | null>(null), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
    const [row, setRow] = useState<Record<string, unknown> | null>(null);
    const catalog = useRemote<{ data: Table[] }>('/api/audit-logs/tables', refresh);
    const result = useRemote<{ columns: Column[]; rows: Record<string, unknown>[]; hasMore: boolean; readable: boolean }>(selected ? '/api/audit-logs/table?' + new URLSearchParams({ schema: selected.schema, name: selected.name, page: String(page), limit: '25' }) : null, refresh);
    const tables = (catalog.data?.data || []).filter(item => `${item.schema}.${item.name}`.toLowerCase().includes(filter.toLowerCase()));
    const retry = () => setRefresh(value => value + 1);
    return <div className="audit-explorer"><aside className="audit-sidebar"><div className="audit-sidebar-head"><strong>Tabel</strong><span>{catalog.data?.data.length || 0}</span></div>
        <FilterToolbar><FilterSearch label="Cari tabel" value={filter} onChange={setFilter} placeholder="Cari tabel..." width={120} grow={1} /></FilterToolbar>
        {catalog.loading ? <Loading /> : catalog.error ? <Failure message={catalog.error} retry={retry} /> : <div className="audit-table-list">{tables.map(table => {
            const active = selected?.schema === table.schema && selected.name === table.name;
            return <Button type="button" variant={active ? 'secondary' : 'ghost'} size="sm" className="audit-table-choice" aria-pressed={active} leftIcon={<i className={`bi bi-${table.readable ? 'table' : 'lock'}`} />} key={`${table.schema}.${table.name}`} onClick={() => { setSelected(table); setPage(1); }}><span>{table.name}</span><small>{table.schema} · {table.columns} kolom</small></Button>;
        })}{!tables.length && <p className="audit-muted">Tabel tidak ditemukan.</p>}</div>}
    </aside><section className="audit-explorer-body">{!selected ? <div className="audit-empty"><i className="bi bi-database" /><h3>Pilih tabel untuk melihat data</h3><p>Struktur kolom dan isi tabel ditampilkan tanpa mengubah data.</p></div> : <>
        <DetailHeader avatar={false} name={`${selected.schema}.${selected.name}`} meta={`${result.data?.columns.length || selected.columns} kolom · hanya lihat`}><Button type="button" variant="secondary" size="sm" icon="refresh" onClick={retry}>Segarkan</Button></DetailHeader>
        {result.loading ? <Loading /> : result.error ? <Failure message={result.error} retry={retry} /> : <>
            {result.data?.readable === false && <p className="audit-notice">Struktur tabel dapat dilihat. Isi tabel autentikasi dan migrasi disembunyikan.</p>}
            <div className="audit-scroll"><table className="audit-table audit-data-grid"><thead><tr><th># / Detail</th>{result.data?.columns.map(column => <th key={column.name}>{column.primary_key && <i className="bi bi-key" />} {column.name}<small>{column.type}{column.nullable ? ' · nullable' : ''}</small></th>)}</tr></thead><tbody>
                {result.data?.rows.map((item, index) => <tr key={index} onDoubleClick={() => setRow(item)}><td><div className="audit-row-actions"><span>{(page - 1) * 25 + index + 1}</span><ActionButton action="view" size="sm" tooltip={`Detail baris ${(page - 1) * 25 + index + 1}`} onClick={() => setRow(item)} /></div></td>{result.data?.columns.map(column => <td key={column.name}><span className={`audit-cell ${item[column.name] === null ? 'is-null' : ''}`} title="Klik dua kali pada baris untuk melihat detail">{cell(item[column.name])}</span></td>)}</tr>)}
                {!result.data?.rows.length && <tr><td colSpan={(result.data?.columns.length || 0) + 1} className="audit-empty-cell">{result.data?.readable === false ? 'Isi data disembunyikan.' : 'Tidak ada data pada halaman ini.'}</td></tr>}
            </tbody></table></div>
            {result.data?.readable && <Pager page={page} next={result.data.hasMore} count={result.data.rows.length} limit={25} onChange={setPage} />}
        </>}
    </>}</section>{row && <Modal title="Detail baris" size="lg" onClose={() => setRow(null)}><ModalBody><pre className="audit-json">{pretty(row)}</pre></ModalBody><ModalFooter><Button variant="cancel" onClick={() => setRow(null)}>Tutup</Button></ModalFooter></Modal>}</div>;
}

function FileExplorer() {
    const { date } = useAuditDate();
    const [prefix, setPrefix] = useState(''), [cursors, setCursors] = useState<(string | null)[]>([null]), [index, setIndex] = useState(0);
    const [refresh, setRefresh] = useState(0), [search, setSearch] = useState(''), [mode, setMode] = useState<'list' | 'grid'>('list');
    const params = new URLSearchParams({ prefix }); if (cursors[index]) params.set('cursor', cursors[index]!);
    const result = useRemote<Files>('/api/audit-logs/files?' + params, refresh);
    const folders = (result.data?.folders || []).filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
    const files = (result.data?.files || []).filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
    const go = (key: string) => { setPrefix(key); setCursors([null]); setIndex(0); setSearch(''); };
    const parts = prefix.split('/').filter(Boolean);
    const contentUrl = (file: ObjectFile, download = false) => '/api/audit-logs/files/content?' + new URLSearchParams({ key: file.key, ...(download ? { download: '1' } : {}) });
    const fileActions = (file: ObjectFile) => (
        <ActionGroup>
            <ActionButton action="view" tooltip={`Buka ${file.name}`} onClick={() => window.open(contentUrl(file), '_blank', 'noopener,noreferrer')} />
            <ActionButton action="download" tooltip={`Unduh ${file.name}`} onClick={() => window.open(contentUrl(file, true), '_blank', 'noopener,noreferrer')} />
        </ActionGroup>
    );
    return <>
        <nav className="audit-breadcrumb" aria-label="Folder dokumen">
            <Button type="button" variant="ghost" size="sm" icon="hdd" aria-current={!prefix ? 'location' : undefined} onClick={() => go('')}>{result.data?.bucket || 'Dokumen'}</Button>
            {parts.map((part, at) => <span key={at}><i className="bi bi-chevron-right" aria-hidden="true" /><Button type="button" variant="ghost" size="sm" aria-current={at === parts.length - 1 ? 'location' : undefined} onClick={() => go(parts.slice(0, at + 1).join('/') + '/')}>{part}</Button></span>)}
        </nav>
        <FilterToolbar className="audit-filters" leading={<Button type="button" variant="secondary" size="sm" icon="arrow-up" disabled={!prefix} onClick={() => go(parts.slice(0, -1).join('/') + (parts.length > 1 ? '/' : ''))}>Folder induk</Button>}>
            <FilterSearch label="Cari file pada halaman ini" value={search} onChange={setSearch} placeholder="Cari nama pada halaman ini..." />
            <FilterActions>
                <InlineSelect title="Tampilan dokumen" minWidth="110px" value={mode} onChange={value => setMode(value === 'grid' ? 'grid' : 'list')} options={[{ value: 'list', label: 'Daftar' }, { value: 'grid', label: 'Ikon' }]} />
                <Button type="button" size="sm" variant="secondary" icon="refresh" onClick={() => setRefresh(value => value + 1)}>Segarkan</Button>
            </FilterActions>
        </FilterToolbar>
        <p className="audit-muted">Pencarian berlaku pada halaman folder yang sedang ditampilkan.</p>
        {result.loading ? <Loading /> : result.error ? <Failure message={result.error} retry={() => setRefresh(value => value + 1)} /> : <>
            {mode === 'grid' ? (
                <div className="audit-file-grid">
                    {folders.map(folder => <Button type="button" variant="ghost" className="audit-folder-card" key={folder.key} leftIcon={<i className="bi bi-folder-fill" />} onClick={() => go(folder.key)}><strong>{folder.name}</strong><small>Folder</small></Button>)}
                    {files.map(file => <div className="audit-file-card" key={file.key}><i className="bi bi-file-earmark-text" /><a href={contentUrl(file)} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{size(file.size)}</small>{fileActions(file)}</div>)}
                </div>
            ) : (
                <div className="audit-scroll">
                    <table className="audit-table">
                        <thead><tr><th>Nama</th><th>Ukuran</th><th>Diubah</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {folders.map(folder => <tr key={folder.key}>
                                <td><Button type="button" variant="ghost" size="sm" className="audit-file-name" leftIcon={<i className="bi bi-folder-fill audit-folder-icon" />} onClick={() => go(folder.key)}>{folder.name}</Button></td>
                                <td>—</td><td>—</td><td><ActionGroup><ActionButton action="view" tooltip={`Buka folder ${folder.name}`} icon={<i className="bi bi-folder2-open" />} onClick={() => go(folder.key)} /></ActionGroup></td>
                            </tr>)}
                            {files.map(file => <tr key={file.key}>
                                <td><a className="audit-file-link" href={contentUrl(file)} target="_blank" rel="noopener noreferrer"><i className="bi bi-file-earmark-text" /> {file.name}</a></td>
                                <td className="audit-nowrap">{size(file.size)}</td><td className="audit-nowrap">{date(file.modified)}</td><td>{fileActions(file)}</td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            )}
            {!folders.length && !files.length && <div className="audit-empty"><i className="bi bi-folder2-open" /><p>{search ? 'Tidak ada nama yang sesuai pada halaman ini.' : 'Folder ini kosong.'}</p></div>}
            <div className="audit-pager"><span>{folders.length} folder · {files.length} file</span><div><Button size="sm" variant="secondary" disabled={index === 0} onClick={() => { setIndex(value => value - 1); setSearch(''); }}>Sebelumnya</Button><span>Halaman {index + 1}</span><Button size="sm" variant="secondary" disabled={!result.data?.nextCursor} onClick={() => { setCursors(current => [...current.slice(0, index + 1), result.data!.nextCursor]); setIndex(value => value + 1); setSearch(''); }}>Berikutnya</Button></div></div>
        </>}
    </>;
}

export default function AuditLogView({ user }: { user?: User }) {
    const [tab, setTab] = useTabParam<'logs' | 'tables' | 'files'>('logs', ['logs','tables','files']);
    const roles = [...(user?.roles || []), ...(user?.role || '').split(/[,|]/)].map(role => role.trim().toUpperCase());
    if (!roles.some(role => ['ADMIN','ADMINISTRATOR'].includes(role))) return <div className="audit-page"><div className="audit-empty"><i className="bi bi-shield-lock" /><h3>Akses administrator diperlukan</h3><p>Audit, tabel, dan dokumen sistem hanya dapat dilihat administrator.</p></div></div>;
    return <div className="audit-page"><div className="audit-heading"><div><h2>Audit & Data Sistem</h2><p>Riwayat perubahan, tabel database, dan dokumen tersimpan.</p></div><span className="audit-readonly"><i className="bi bi-lock" /> Hanya lihat</span></div>
        <Tab variant="slider" activeTab={tab} onChange={setTab} ariaLabel="Audit dan data sistem" tabs={[{ key:'logs',label:'Log Audit',icon:'shield-check' },{ key:'tables',label:'Tabel Data',icon:'database' },{ key:'files',label:'Dokumen',icon:'folder2-open' }]} />
        <div className="audit-panel">{tab === 'logs' ? <History /> : tab === 'tables' ? <DatabaseExplorer /> : <FileExplorer />}</div>
    </div>;
}
