'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { swalSuccess, swalError, swalWarning, swalConfirm } from '@/lib/swal-premium';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { Spinner } from '@/components/ui/Spinner';
import { getProxiedImageUrl } from '@/lib/image-utils';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

interface Submission {
    id: string; nip: string; nama_guru_snap: string | null; bulan: number; tahun: number;
    status: 'Submitted' | 'Approved' | 'Revisi'; total_laporan: number;
    catatan_reviewer?: string | null; approved_by_name?: string | null; approved_at?: string | null;
    submitted_at?: string | null; pdf_url?: string | null; dibayarkan?: boolean;
    foto_profil?: string | null;
}
interface LaporanEntry {
    id: string; tanggal: string; kegiatan: string; foto_url?: string;
    guru_asuh?: { nama_siswa: string; kelas: string };
}

/** Satu kali "Baru" dengan banyak siswa terpilih membuat 1 baris DB per siswa
 * — gabung jadi 1 baris tampilan per tanggal+kegiatan, mirip tabel di PDF. */
function groupEntriesByKegiatan(entries: LaporanEntry[]) {
    const map = new Map<string, { tanggal: string; kegiatan: string; items: LaporanEntry[] }>();
    const order: string[] = [];
    for (const e of entries) {
        const key = `${e.tanggal}|${e.kegiatan}`;
        let g = map.get(key);
        if (!g) { g = { tanggal: e.tanggal, kegiatan: e.kegiatan, items: [] }; map.set(key, g); order.push(key); }
        g.items.push(e);
    }
    return order.map(k => map.get(k)!);
}

export default function GuruAsuhTabApproval({ user }: { user?: any }) {
    const [loading, setLoading] = useState(false);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [selected, setSelected] = useState<Submission | null>(null);
    const [entries, setEntries] = useState<LaporanEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [reviewerNote, setReviewerNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [printingPdf, setPrintingPdf] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterMonth, setFilterMonth] = useState('ALL');
    const [filterYear, setFilterYear] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (previewHtml) return registerModal();
    }, [previewHtml, registerModal]);

    // Cegah respons yang telat menimpa state yang sudah lebih baru (mis. filter
    // status diganti cepat berturut-turut) — inilah yang bikin daftar kadang
    // tampak "hilang"/salah sampai halaman di-refresh manual.
    const listRequestRef = useRef(0);
    const entriesRequestRef = useRef(0);

    const fetchSubmissions = useCallback(async () => {
        const requestId = ++listRequestRef.current;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'ALL') params.set('status', filterStatus);
            if (filterMonth !== 'ALL') params.set('bulan', filterMonth);
            if (filterYear !== 'ALL') params.set('tahun', filterYear);
            const res = await fetch(`/api/guru-asuh/laporan-submission?${params.toString()}`);
            const data = await res.json();
            if (requestId !== listRequestRef.current) return;
            if (data.ok) setSubmissions(data.data || []);
        } catch (e) { console.error(e); }
        finally { if (requestId === listRequestRef.current) setLoading(false); }
    }, [filterStatus, filterMonth, filterYear]);

    useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

    useEffect(() => {
        if (!selected?.id) { setEntries([]); return; }
        setReviewerNote(selected.catatan_reviewer || '');
        const requestId = ++entriesRequestRef.current;
        const lastDay = new Date(selected.tahun, selected.bulan, 0).getDate();
        const mm = String(selected.bulan).padStart(2, '0');
        const startDate = `${selected.tahun}-${mm}-01`;
        const endDate = `${selected.tahun}-${mm}-${String(lastDay).padStart(2, '0')}`;
        fetch(`/api/guru-asuh/laporan?nip=${selected.nip}&startDate=${startDate}&endDate=${endDate}`)
            .then(r => r.json())
            .then(json => {
                if (requestId !== entriesRequestRef.current) return;
                if (json.ok) setEntries(json.data || []);
            })
            .catch(() => {})
            .finally(() => { if (requestId === entriesRequestRef.current) setLoadingEntries(false); });
    }, [selected?.id]);

    const filteredSubmissions = useMemo(() => {
        let result = submissions;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s => (s.nama_guru_snap || '').toLowerCase().includes(q) || s.nip.toLowerCase().includes(q));
        }
        const priority: Record<string, number> = { 'Submitted': 1, 'Revisi': 2, 'Approved': 3 };
        return [...result].sort((a, b) => {
            const pA = priority[a.status] || 99;
            const pB = priority[b.status] || 99;
            if (pA !== pB) return pA - pB;
            return (b.submitted_at || '').localeCompare(a.submitted_at || '');
        });
    }, [submissions, searchQuery]);

    const handleDecision = async (action: 'approve' | 'revisi') => {
        if (!selected) return;
        if (action === 'revisi' && !reviewerNote.trim()) {
            swalWarning('Catatan Wajib', 'Harap isi alasan pengembalian/revisi.');
            return;
        }
        const isRevokingApproval = action === 'revisi' && selected.status === 'Approved';
        const confirm = await swalConfirm({
            title: action === 'approve' ? 'Setujui Laporan?' : isRevokingApproval ? 'Batalkan Persetujuan?' : 'Kembalikan Laporan?',
            text: action === 'approve'
                ? `Laporan ${selected.nama_guru_snap} akan disahkan dan Anda tercatat sebagai penanda tangan.`
                : isRevokingApproval
                    ? 'Persetujuan yang sudah diberikan akan dibatalkan (PDF resmi sebelumnya jadi tidak berlaku) dan laporan dikembalikan ke guru untuk diperbaiki.'
                    : 'Laporan akan dikembalikan ke guru untuk diperbaiki.',
            icon: action === 'approve' ? 'question' : 'warning',
            confirmText: action === 'approve' ? 'Ya, Setujui' : 'Ya, Kembalikan',
            cancelText: 'Batal',
            confirmColor: action === 'approve' ? '#3083FF' : '#dc2626',
        });
        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            const res = await authFetch('/api/guru-asuh/laporan-submission/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selected.id, action, catatan: reviewerNote }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memproses');
            swalSuccess('Berhasil', action === 'approve' ? 'Laporan berhasil disetujui.' : 'Laporan telah dikembalikan.');
            setSelected(null);
            fetchSubmissions();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSaving(false); }
    };

    const handlePratinjau = async () => {
        if (!selected?.id) return;
        setLoadingPreview(true);
        try {
            const res = await fetch('/api/guru-asuh/laporan-submission/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: selected.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memuat pratinjau');
            setPreviewHtml(data.html);
        } catch (e: any) { swalError('Error', e.message); }
        finally { setLoadingPreview(false); }
    };

    const handleCetakPdf = async () => {
        if (!selected?.id) return;
        setPrintingPdf(true);
        try {
            const res = await fetch('/api/guru-asuh/laporan-submission/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: selected.id }),
            });
            if (res.headers.get('content-type')?.includes('application/pdf')) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
            } else {
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal membuat PDF');
                if (data.file_url) window.open(data.file_url, '_blank');
            }
        } catch (e: any) { swalError('Error', e.message); }
        finally { setPrintingPdf(false); }
    };

    const getStatusStyle = (s: string) => {
        switch (s) {
            case 'Submitted': return { label: 'MENUNGGU', cls: 'pending' };
            case 'Approved': return { label: 'DISAHKAN', cls: 'approved' };
            case 'Revisi': return { label: 'REVISI', cls: 'revisi' };
            default: return { label: s, cls: '' };
        }
    };

    return (
        <div className="gta__wrap">
            <FilterToolbar>
                <FilterSelect
                    label="Status"
                    icon="patch-check"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                        { value: 'ALL', label: 'Semua Status' },
                        { value: 'Submitted', label: 'Menunggu' },
                        { value: 'Revisi', label: 'Revisi' },
                        { value: 'Approved', label: 'Disahkan' },
                    ]}
                />
                <FilterSelect
                    label="Bulan"
                    icon="calendar3"
                    value={filterMonth}
                    onChange={setFilterMonth}
                    options={[
                        { value: 'ALL', label: 'Semua Bulan' },
                        ...BULAN.map((b, i) => ({ value: String(i + 1), label: b })),
                    ]}
                />
                <FilterSelect
                    label="Tahun"
                    icon="mortarboard"
                    value={filterYear}
                    onChange={setFilterYear}
                    options={[
                        { value: 'ALL', label: 'Semua Tahun' },
                        ...[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => ({ value: String(y), label: String(y) })),
                    ]}
                />
                <FilterSearch
                    label="Pencarian"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari nama atau NIP..."
                />
            </FilterToolbar>

            <div className={`gta__grid ${selected ? 'gta__grid--hasSelected' : ''}`}>
                <aside className="gta__left">
                    <div className="gta__list">
                        {loading && (
                            <div className="gta__empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Spinner variant="buble" size={18} />
                            </div>
                        )}
                        {!loading && filteredSubmissions.length === 0 && (
                            <div className="gta__empty"><i className="bi bi-inbox" /> Tidak ada laporan</div>
                        )}
                        {filteredSubmissions.map(sub => {
                            const st = getStatusStyle(sub.status);
                            return (
                                <div key={sub.id} className={`gta__item ${selected?.id === sub.id ? 'gta__item--active' : ''}`} onClick={() => setSelected(sub)}>
                                    <div className="gta__itemAvatar">
                                        {sub.foto_profil && (
                                            <img
                                                src={getProxiedImageUrl(sub.foto_profil)}
                                                alt={sub.nama_guru_snap || 'Guru'}
                                                className="gta__avatarImg"
                                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                            />
                                        )}
                                        <span>{(sub.nama_guru_snap || 'G')[0]}</span>
                                    </div>
                                    <div className="gta__itemBody">
                                        <div className="gta__itemName">{sub.nama_guru_snap || 'Guru'}</div>
                                        <div className="gta__itemRow">
                                            <span className="gta__itemNip">NIP. {sub.nip}</span>
                                            <span className={`gta__badge gta__badge--${st.cls}`}>
                                                {sub.status === 'Approved' && <i className="bi bi-patch-check-fill" style={{ marginRight: 4 }} />}
                                                {st.label}
                                            </span>
                                        </div>
                                        <div className="gta__itemPeriod">{BULAN[sub.bulan - 1]} {sub.tahun} · {sub.total_laporan} kegiatan</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <main className="gta__content">
                    {selected ? (
                        <>
                            <div className="gta__mobileHeader">
                                <button className="gta__btn gta__btn--soft-red" onClick={() => setSelected(null)} style={{ padding: '6px 12px' }}>
                                    <i className="bi bi-arrow-left" /> Kembali
                                </button>
                                <strong style={{ fontSize: '0.85rem' }}>Detail Laporan</strong>
                            </div>
                            <div className="gta__body">
                                <div className="gta__meta">
                                    <div className="gta__metaItem"><span>Periode</span><strong>{BULAN[selected.bulan - 1]} {selected.tahun}</strong></div>
                                    <div className="gta__metaItem"><span>Kegiatan</span><strong>{groupEntriesByKegiatan(entries).length}</strong></div>
                                    <div className="gta__metaItem"><span>Diajukan</span><strong>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</strong></div>
                                    {selected.status === 'Approved' && (
                                        <div className="gta__metaItem"><span>Disahkan</span><strong>{selected.approved_by_name}</strong></div>
                                    )}
                                </div>

                                <div className="gta__sectionHead"><i className="bi bi-list-task" /> Daftar Kegiatan</div>
                                {loadingEntries ? (
                                    <div className="gta__empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Spinner variant="buble" size={18} />
                                    </div>
                                ) : (
                                    <div className="gta__tableWrap">
                                        <table className="gta__table">
                                            <thead>
                                                <tr>
                                                    <th>Tanggal</th>
                                                    <th>Siswa (Kelas)</th>
                                                    <th className="gta__desktopOnly">Kegiatan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupEntriesByKegiatan(entries).map(g => (
                                                    <Fragment key={`${g.tanggal}|${g.kegiatan}`}>
                                                        {/* Desktop Row */}
                                                        <tr className="gta__desktopRow">
                                                            <td className="gta__nowrap" style={{ verticalAlign: 'top' }}>
                                                                {new Date(g.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            <td className="gta__nowrap" style={{ verticalAlign: 'top' }}>
                                                                {g.items.map(e => (
                                                                    <div key={e.id} style={{ marginBottom: '4px' }}>
                                                                        {e.guru_asuh?.nama_siswa || '-'} <span className="gta__muted">({e.guru_asuh?.kelas || '-'})</span>
                                                                    </div>
                                                                ))}
                                                            </td>
                                                            <td>{g.kegiatan}</td>
                                                        </tr>

                                                        {/* Mobile Rows */}
                                                        <tr className="gta__mobileRow">
                                                            <td className="gta__nowrap" style={{ borderBottom: 'none', verticalAlign: 'top' }}>
                                                                {new Date(g.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            <td className="gta__nowrap" style={{ borderBottom: 'none' }}>
                                                                {g.items.map(e => (
                                                                    <div key={e.id} style={{ marginBottom: '4px' }}>
                                                                        {e.guru_asuh?.nama_siswa || '-'} <span className="gta__muted">({e.guru_asuh?.kelas || '-'})</span>
                                                                    </div>
                                                                ))}
                                                            </td>
                                                        </tr>
                                                        <tr className="gta__mobileRow">
                                                            <td colSpan={2} style={{ paddingTop: 0, paddingBottom: '16px' }}>
                                                                <div style={{ fontSize: '0.9rem', color: 'var(--n-text)' }}>
                                                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.64rem', fontWeight: 700, color: 'var(--n-muted)', textTransform: 'uppercase' }}>Kegiatan</strong>
                                                                    {g.kegiatan}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </Fragment>
                                                ))}
                                                {entries.length === 0 && <tr><td colSpan={3} className="gta__empty">Tidak ada kegiatan</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="gta__notes">
                                    <div className="gta__sectionHead"><i className="bi bi-chat-left-text" /> Catatan Reviewer</div>
                                    <textarea
                                        placeholder="Berikan catatan perbaikan atau apresiasi..."
                                        value={reviewerNote}
                                        onChange={e => setReviewerNote(e.target.value)}
                                        disabled={selected.status === 'Revisi'}
                                    />
                                </div>
                            </div>

                            <footer className="gta__actions">
                                <button className="gta__btn gta__btn--ghost" onClick={handlePratinjau} disabled={loadingPreview}>
                                    <i className={loadingPreview ? 'bi bi-arrow-repeat gta__spin' : 'bi bi-eye'} /> Pratinjau
                                </button>
                                <button
                                    className="gta__btn gta__btn--ghost"
                                    onClick={handleCetakPdf}
                                    disabled={printingPdf || selected.status !== 'Approved'}
                                    title={selected.status !== 'Approved' ? 'Laporan harus disahkan (Approved) terlebih dahulu sebelum dapat dicetak resmi' : 'Cetak Dokumen PDF'}
                                >
                                    <i className={printingPdf ? 'bi bi-arrow-repeat gta__spin' : 'bi bi-file-earmark-pdf'} /> Cetak
                                </button>
                                <div className="gta__actionsSpacer" />
                                <button className="gta__btn gta__btn--reject" onClick={() => handleDecision('revisi')} disabled={saving || selected.status === 'Revisi' || (selected.status === 'Approved' && selected.dibayarkan)} title={selected.dibayarkan ? 'Tidak dapat membatalkan karena telah dilakukan pembayaran' : ''}>
                                    <i className="bi bi-arrow-return-left" /> {selected.status === 'Approved' ? 'Batalkan' : 'Kembalikan'}
                                </button>
                                <button className="gta__btn gta__btn--approve" onClick={() => handleDecision('approve')} disabled={saving || selected.status !== 'Submitted'}>
                                    <i className="bi bi-check2" /> Setujui
                                </button>
                            </footer>
                        </>
                    ) : (
                        <div className="gta__placeholder">
                            <i className="bi bi-file-earmark-check" />
                            <h3>Belum Ada Laporan Terpilih</h3>
                            <p>Pilih salah satu laporan di daftar sebelah kiri untuk meninjau detail.</p>
                        </div>
                    )}
                </main>
            </div>

            {previewHtml && (
                <HtmlPreviewModal html={previewHtml} title="Pratinjau Laporan Guru Asuh" onClose={() => setPreviewHtml(null)} />
            )}

            <style jsx>{`
                .gta__wrap { display: flex; flex-direction: column; gap: 12px; animation: gtaFadeIn 0.3s ease-out; }
                @keyframes gtaFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

                .gta__grid { display: grid; grid-template-columns: 300px 1fr; gap: 14px; min-height: 60vh; max-height: 74vh; }

                .gta__left { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--n-border); border-radius: 16px; background: var(--n-card); }
                .gta__select-group { position: relative; display: flex; align-items: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 0 10px; gap: 6px; min-height: 40px; transition: all 0.2s; }
                .gta__select-group i { font-size: 0.9rem; color: var(--n-muted); flex-shrink: 0; }
                .gta__select-group select { flex: 1; border: none; background: transparent; padding: 8px 24px 8px 4px; font-size: 0.82rem; font-weight: 600; color: var(--n-ink); outline: none; appearance: none; -webkit-appearance: none; -moz-appearance: none; cursor: pointer; text-overflow: ellipsis; white-space: nowrap; }

                .gta__searchWrap { position: relative; display: flex; align-items: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 0 10px; gap: 6px; min-height: 40px; }
                .gta__searchWrap i { font-size: 0.9rem; color: var(--n-muted); flex-shrink: 0; }
                .gta__searchWrap input { flex: 1; border: none; background: transparent; padding: 8px 4px; font-size: 0.82rem; font-weight: 600; color: var(--n-ink); outline: none; }

                .gta__list { flex: 1; overflow-y: auto; }
                .gta__empty { padding: 20px 14px; text-align: center; color: var(--n-muted); font-size: 0.8rem; }

                .gta__item { display: flex; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--n-border); cursor: pointer; transition: background 0.15s; }
                .gta__item:hover { background: var(--n-soft); }
                .gta__item--active { background: var(--n-soft); border-left: 3px solid var(--n-primary); }
                .gta__itemAvatar { width: 34px; height: 34px; border-radius: 10px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; color: #1a73e8; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; position: relative; overflow: hidden; }
                .gta__avatarImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gta__itemBody { flex: 1; min-width: 0; }
                .gta__itemName { font-size: 0.83rem; font-weight: 700; color: var(--n-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .gta__itemRow { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }
                .gta__itemNip { font-size: 0.68rem; color: var(--n-muted); }
                .gta__itemPeriod { font-size: 0.66rem; color: var(--n-muted); margin-top: 3px; }

                .gta__badge { display: inline-flex; align-items: center; padding: 1.5px 7px; border-radius: 9999px; font-size: 0.58rem; font-weight: 800; white-space: nowrap; }
                .gta__badge--pending { background: rgba(29,78,216,0.1); color: #1d4ed8; }
                .gta__badge--approved { background: transparent; color: #2563eb; border: none; padding: 0; }
                .gta__badge--revisi { background: rgba(220,38,38,0.1); color: #dc2626; }

                .gta__content { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--n-border); border-radius: 16px; background: var(--n-soft); }
                .gta__mobileHeader { display: none; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--n-border); background: var(--n-card); flex-shrink: 0; }
                .gta__body { flex: 1; overflow-y: auto; padding: 16px 18px; }

                .gta__meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 14px; }
                .gta__metaItem { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 9px 12px; }
                .gta__metaItem span { display: block; font-size: 0.62rem; color: var(--n-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em; }
                .gta__metaItem strong { font-size: 0.85rem; color: var(--n-ink); }

                .gta__sectionHead { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 800; color: var(--n-ink); margin: 14px 0 8px; }

                .gta__tableWrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-card); }
                .gta__table { width: 100%; border-collapse: collapse; }
                .gta__table th { padding: 9px 10px; text-align: left; font-size: 0.64rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; background: var(--n-soft); border-bottom: 1px solid var(--n-border); }
                .gta__table td { padding: 9px 10px; font-size: 0.78rem; color: var(--n-ink); border-bottom: 1px solid var(--n-border); vertical-align: top; }
                .gta__table tr:last-child td { border-bottom: none; }
                .gta__nowrap { white-space: nowrap; }
                .gta__muted { color: var(--n-muted); font-size: 0.7rem; }

                .gta__notes textarea { width: 100%; min-height: 76px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-ink); font-size: 0.83rem; resize: vertical; }
                .gta__notes textarea:disabled { opacity: 0.6; }

                .gta__actions { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--n-border); background: var(--n-card); flex-shrink: 0; }
                .gta__actionsSpacer { flex: 1; }
                .gta__btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 12px; font-size: 0.8rem; font-weight: normal; cursor: pointer; border: 1px solid var(--n-border); transition: all 0.2s; }
                .gta__btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .gta__btn--ghost { background: var(--n-card); color: var(--n-muted); }
                .gta__btn--ghost:hover:not(:disabled) { background: var(--n-border); color: var(--n-ink); }
                .gta__btn--soft-red { background: rgba(220,38,38,0.1); color: #dc2626; border-color: transparent; }
                .gta__btn--soft-red:hover:not(:disabled) { background: rgba(220,38,38,0.2); }
                .gta__btn--approve { background: #16a34a; color: white; border: none; }
                .gta__btn--approve:hover:not(:disabled) { filter: brightness(1.05); }
                .gta__btn--reject { background: white; color: #dc2626; border: 1px solid #fecaca; }
                .gta__btn--reject:hover:not(:disabled) { background: #fef2f2; }
                .gta__spin { animation: gtaSpin 1s linear infinite; }
                @keyframes gtaSpin { to { transform: rotate(360deg); } }

                .gta__placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; gap: 10px; padding: 40px; color: var(--n-muted); }
                .gta__placeholder i { font-size: 2.4rem; color: var(--n-border); }
                .gta__placeholder h3 { font-size: 0.95rem; font-weight: 800; color: var(--n-ink); margin: 0; }
                .gta__placeholder p { font-size: 0.8rem; margin: 0; max-width: 300px; }

                :global(.dark) .gta__left,
                :global(.dark) .gta__content { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gta__select-group,
                :global(.dark) .gta__searchWrap {
                    background-color: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gta__select-group i,
                :global(.dark) .gta__searchWrap i {
                    color: #60a5fa !important;
                }
                :global(.dark) .gta__select-group select {
                    background-color: transparent !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2360a5fa' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 10px center !important;
                    padding-right: 28px !important;
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                    color: #ffffff !important;
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                    cursor: pointer !important;
                }
                :global(.dark) .gta__select-group select option {
                    background-color: #0b1329 !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gta__searchWrap input {
                    background: transparent !important;
                    border: none !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gta__notes textarea { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #ffffff !important; }
                :global(.dark) .gta__metaItem { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; }
                :global(.dark) .gta__metaItem span { color: #94a3b8 !important; }
                :global(.dark) .gta__metaItem strong { color: #ffffff !important; }
                :global(.dark) .gta__tableWrap { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__table { background: #0b1329 !important; }
                :global(.dark) .gta__table th { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; }
                :global(.dark) .gta__table td { border-bottom-color: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; }
                :global(.dark) .gta__item { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .gta__item:hover { background: rgba(26, 115, 232, 0.1) !important; }
                :global(.dark) .gta__item--active { background: rgba(26, 115, 232, 0.2) !important; border-left-color: #60a5fa !important; }
                :global(.dark) .gta__itemAvatar { background: rgba(26, 115, 232, 0.15) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gta__itemName { color: #ffffff !important; }
                :global(.dark) .gta__btn--ghost { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gta__btn--ghost:hover { background: rgba(26, 115, 232, 0.15) !important; color: #ffffff !important; }
                :global(.dark) .gta__btn--reject,
                :global(.dark) .gta__btn--soft-red { background: rgba(239, 68, 68, 0.18) !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; color: #f87171 !important; }
                :global(.dark) .gta__btn--reject:hover { background: rgba(239, 68, 68, 0.35) !important; color: #ffffff !important; }
                :global(.dark) .gta__badge--revisi { background: rgba(239, 68, 68, 0.14) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; }
                :global(.dark) .gta__badge--approved { background: rgba(59, 130, 246, 0.14) !important; color: #60a5fa !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__badge--pending { background: rgba(245, 158, 11, 0.14) !important; color: #fbbf24 !important; border: 1px solid rgba(245, 158, 11, 0.35) !important; }

                .gta__mobileRow { display: none; }

                @media (max-width: 800px) {
                    .gta__grid { grid-template-columns: 1fr; max-height: 80vh; min-height: 70vh; }
                    .gta__left { max-height: none; height: 100%; }
                    .gta__content { display: none; max-height: none; height: 100%; }
                    
                    .gta__grid--hasSelected .gta__left { display: none; }
                    .gta__grid--hasSelected .gta__content { display: flex; }
                    .gta__mobileHeader { display: flex; }
                    
                    .gta__select { font-size: 0.72rem; padding: 7px 10px; height: 36px; }
                    .gta__searchWrap input { font-size: 0.72rem; padding: 7px 10px 7px 28px; height: 36px; }

                    .gta__meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
                    .gta__metaItem { padding: 10px 8px; text-align: center; }
                    .gta__metaItem span { font-size: 0.6rem; white-space: normal; line-height: 1.2; margin-bottom: 3px; }
                    .gta__metaItem strong { font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

                    .gta__actions { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; gap: 6px; justify-content: flex-start; }
                    .gta__actions::-webkit-scrollbar { display: none; }
                    .gta__actions .gta__btn { flex: 1 0 auto; justify-content: center; text-align: center; white-space: nowrap; font-size: 0.75rem; padding: 8px 12px; }
                    .gta__actionsSpacer { display: none; }
                    .gta__desktopOnly { display: none; }
                    .gta__desktopRow { display: none; }
                    .gta__mobileRow { display: table-row; }
                }
            `}</style>
        </div>
    );
}
