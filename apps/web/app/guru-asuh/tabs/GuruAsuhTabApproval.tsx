'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { swalSuccess, swalError, swalWarning, swalConfirm } from '@/lib/swal-premium';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { Spinner } from '@/components/ui/Spinner';
import { getProxiedImageUrl } from '@/lib/image-utils';
import { useFileViewer } from '@/components/useFileViewer';

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

interface GroupedKegiatan {
    tanggal: string;
    kegiatan: string;
    items: LaporanEntry[];
    photos: string[];
}

/** Satu kali "Baru" dengan banyak siswa terpilih membuat 1 baris DB per siswa
 * — gabung jadi 1 baris tampilan per tanggal+kegiatan, mirip tabel di PDF. */
function groupEntriesByKegiatan(entries: LaporanEntry[]): GroupedKegiatan[] {
    const map = new Map<string, GroupedKegiatan>();
    const order: string[] = [];
    for (const e of entries) {
        const key = `${e.tanggal}|${e.kegiatan}`;
        let g = map.get(key);
        if (!g) {
            g = { tanggal: e.tanggal, kegiatan: e.kegiatan, items: [], photos: [] };
            map.set(key, g);
            order.push(key);
        }
        g.items.push(e);
        if (e.foto_url && !g.photos.includes(e.foto_url)) {
            g.photos.push(e.foto_url);
        }
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
    const [modalStudents, setModalStudents] = useState<{ activityTitle: string; tanggal: string; students: LaporanEntry[] } | null>(null);
    const { openFile, viewer } = useFileViewer();
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterMonth, setFilterMonth] = useState('ALL');
    const [filterYear, setFilterYear] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (previewHtml || modalStudents) return registerModal();
    }, [previewHtml, modalStudents, registerModal]);

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

    const handleSelect = (sub: Submission) => {
        setSelected(sub);
        if (typeof window !== 'undefined' && window.innerWidth <= 800) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleBack = () => {
        setSelected(null);
        if (typeof window !== 'undefined' && window.innerWidth <= 800) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleDecision = async (action: 'approve' | 'revisi') => {
        if (!selected) return;
        if (action === 'revisi' && !reviewerNote.trim()) {
            swalWarning('Catatan Wajib', 'Harap isi alasan pengembalian/revisi.');
            return;
        }
        const isRevokingApproval = action === 'revisi' && selected.status === 'Approved';
        const approverName = user?.nama_lengkap || user?.nama || 'Anda';
        const confirm = await swalConfirm({
            title: action === 'approve' ? 'Setujui Laporan?' : isRevokingApproval ? 'Batalkan Persetujuan?' : 'Kembalikan Laporan?',
            text: action === 'approve'
                ? `Laporan ${selected.nama_guru_snap} akan disahkan dan ${approverName} akan tercatat sebagai penanda tangan dokumen.`
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
            if (typeof window !== 'undefined' && window.innerWidth <= 800) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
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
                openFile(url, `Laporan Guru Asuh - ${selected.nama_guru_snap || 'Guru'}`);
            } else {
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal membuat PDF');
                if (data.file_url) openFile(data.file_url, `Laporan Guru Asuh - ${selected.nama_guru_snap || 'Guru'}`);
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
        <div className={`gta__wrap ${selected ? 'gta__wrap--hasSelected' : ''}`}>
            <div className="gta__filterWrapper">
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
            </div>

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
                                <div key={sub.id} className={`gta__item ${selected?.id === sub.id ? 'gta__item--active' : ''}`} onClick={() => handleSelect(sub)}>
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
                                    <i className="bi bi-chevron-right gta__itemChevron" />
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <main className="gta__content">
                    {selected ? (
                        <>
                            <div className="gta__detailHeader">
                                <button
                                    type="button"
                                    className="gta__btn gta__btn--soft-red gta__backBtn"
                                    onClick={handleBack}
                                    title="Kembali"
                                    aria-label="Kembali"
                                >
                                    <i className="bi bi-arrow-left" />
                                    <span className="gta__backBtnLabel">Kembali</span>
                                </button>
                                <div className="gta__detailTeacher">
                                    <div className="gta__detailAvatar">
                                        {selected.foto_profil && (
                                            <img
                                                src={getProxiedImageUrl(selected.foto_profil)}
                                                alt={selected.nama_guru_snap || 'Guru'}
                                                className="gta__avatarImg"
                                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                            />
                                        )}
                                        <span>{(selected.nama_guru_snap || 'G')[0]}</span>
                                    </div>
                                    <div className="gta__detailTeacherInfo">
                                        <div className="gta__detailTeacherName">{selected.nama_guru_snap || 'Guru'}</div>
                                        <div className="gta__detailTeacherNip">
                                            <span className="gta__nipLabel">NIP. </span>
                                            {selected.nip}
                                        </div>
                                    </div>
                                </div>
                                <div className="gta__detailHeaderBadge">
                                    <span
                                        className={`gta__badge gta__badge--${getStatusStyle(selected.status).cls}`}
                                        title={getStatusStyle(selected.status).label}
                                        aria-label={getStatusStyle(selected.status).label}
                                    >
                                        {selected.status === 'Approved' && <i className="bi bi-patch-check-fill gta__badgeIcon" />}
                                        <span className="gta__badgeLabel">{getStatusStyle(selected.status).label}</span>
                                    </span>
                                </div>
                            </div>

                            <div className="gta__body">
                                <div className="gta__meta">
                                    <div className="gta__metaItem">
                                        <span>Periode</span>
                                        <strong>{BULAN[selected.bulan - 1]} {selected.tahun}</strong>
                                    </div>
                                    <div className="gta__metaItem">
                                        <span>Kegiatan</span>
                                        <strong>{groupEntriesByKegiatan(entries).length} kegiatan</strong>
                                    </div>
                                    <div className="gta__metaItem">
                                        <span>Diajukan</span>
                                        <strong>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</strong>
                                    </div>
                                    {selected.status === 'Approved' && (
                                        <div className="gta__metaItem">
                                            <span>Disahkan</span>
                                            <strong>{selected.approved_by_name || '-'}</strong>
                                        </div>
                                    )}
                                </div>

                                <div className="gta__sectionHead">
                                    <i className="bi bi-list-task" /> Daftar Kegiatan
                                </div>

                                {loadingEntries ? (
                                    <div className="gta__empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Spinner variant="buble" size={18} />
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="gta__tableWrap">
                                            <table className="gta__table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '130px' }}>Tanggal</th>
                                                        <th style={{ width: '220px' }}>Siswa (Kelas)</th>
                                                        <th>Kegiatan</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupEntriesByKegiatan(entries).map((g, idx) => (
                                                        <tr key={`${g.tanggal}|${g.kegiatan}-${idx}`}>
                                                            <td className="gta__nowrap" style={{ verticalAlign: 'top' }}>
                                                                {new Date(g.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            <td style={{ verticalAlign: 'top' }}>
                                                                {g.items.slice(0, 2).map(e => (
                                                                    <div key={e.id} style={{ marginBottom: '4px' }}>
                                                                        {e.guru_asuh?.nama_siswa || '-'} <span className="gta__muted">({e.guru_asuh?.kelas || '-'})</span>
                                                                    </div>
                                                                ))}
                                                                {g.items.length > 2 && (
                                                                    <button
                                                                        type="button"
                                                                        className="gta__moreLink"
                                                                        onClick={() => setModalStudents({ activityTitle: g.kegiatan, tanggal: g.tanggal, students: g.items })}
                                                                    >
                                                                        +{g.items.length - 2} siswa lainnya
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td style={{ verticalAlign: 'top' }}>
                                                                <div>{g.kegiatan}</div>
                                                                {g.photos.length > 0 && (
                                                                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                        {g.photos.map((url, i) => (
                                                                            <button
                                                                                key={url}
                                                                                type="button"
                                                                                onClick={() => openFile(getProxiedImageUrl(url), g.photos.length > 1 ? `Foto Dokumentasi ${i + 1} - ${g.kegiatan}` : `Foto Dokumentasi - ${g.kegiatan}`)}
                                                                                className="gta__photoLink"
                                                                                title="Buka Foto Dokumentasi di Viewer"
                                                                            >
                                                                                <i className="bi bi-image" /> {g.photos.length > 1 ? `Foto Dokumentasi ${i + 1}` : 'Foto Dokumentasi'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {entries.length === 0 && (
                                                        <tr><td colSpan={3} className="gta__empty">Tidak ada kegiatan</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Activity Cards */}
                                        <div className="gta__mobileActivities">
                                            {groupEntriesByKegiatan(entries).map((g, idx) => (
                                                <div className="gta__activityCard" key={`${g.tanggal}|${g.kegiatan}-${idx}`}>
                                                    <div className="gta__activityCardHead">
                                                        <div className="gta__activityDate">
                                                            <i className="bi bi-calendar3" />
                                                            <span>{new Date(g.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                        </div>
                                                        <span className="gta__studentCountBadge">
                                                            <i className="bi bi-people" /> {g.items.length} Siswa
                                                        </span>
                                                    </div>

                                                    <div className="gta__activityDesc">
                                                        <div className="gta__activitySectionTitle">Kegiatan</div>
                                                        <p className="gta__activityDescText">{g.kegiatan}</p>
                                                    </div>

                                                    <div className="gta__activityStudents">
                                                        <div className="gta__activitySectionTitle">Siswa Bimbingan ({g.items.length})</div>
                                                        <div className="gta__studentChips">
                                                            {g.items.slice(0, 2).map(e => (
                                                                <div key={e.id} className="gta__studentChip">
                                                                    <span className="gta__studentName">{e.guru_asuh?.nama_siswa || '-'}</span>
                                                                    <span className="gta__studentClass">{e.guru_asuh?.kelas || '-'}</span>
                                                                </div>
                                                            ))}
                                                            {g.items.length > 2 && (
                                                                <button
                                                                    type="button"
                                                                    className="gta__moreChipBtn"
                                                                    onClick={() => setModalStudents({ activityTitle: g.kegiatan, tanggal: g.tanggal, students: g.items })}
                                                                >
                                                                    <i className="bi bi-people" /> +{g.items.length - 2} lainnya
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {g.photos.length > 0 && (
                                                        <div className="gta__activityPhotos">
                                                            <div className="gta__activitySectionTitle">Dokumentasi Kegiatan</div>
                                                            <div className="gta__photoGrid">
                                                                {g.photos.map((url, i) => (
                                                                    <button
                                                                        key={url}
                                                                        type="button"
                                                                        onClick={() => openFile(getProxiedImageUrl(url), g.photos.length > 1 ? `Foto Dokumentasi ${i + 1} - ${g.kegiatan}` : `Foto Dokumentasi - ${g.kegiatan}`)}
                                                                        className="gta__photoCard"
                                                                        title="Buka Foto Dokumentasi di Viewer"
                                                                    >
                                                                        <img src={getProxiedImageUrl(url)} alt={`Dokumentasi ${i + 1}`} className="gta__photoCardThumb" />
                                                                        <div className="gta__photoCardBody">
                                                                            <span className="gta__photoCardTitle">{g.photos.length > 1 ? `Foto Dokumentasi ${i + 1}` : 'Foto Dokumentasi'}</span>
                                                                            <span className="gta__photoCardAction"><i className="bi bi-eye-fill" /> Buka Foto</span>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {entries.length === 0 && (
                                                <div className="gta__emptyCard">
                                                    <i className="bi bi-inbox" style={{ fontSize: '1.4rem', display: 'block', marginBottom: '4px' }} />
                                                    Tidak ada kegiatan
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                <div className="gta__notes">
                                    <div className="gta__sectionHead">
                                        <i className="bi bi-chat-left-text" /> Catatan Reviewer
                                    </div>
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

            {modalStudents && (
                <Modal
                    open={true}
                    onClose={() => setModalStudents(null)}
                    size="sm"
                    title="Daftar Siswa Bimbingan"
                    subtitle={`${new Date(modalStudents.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · ${modalStudents.students.length} Siswa`}
                    icon="people"
                >
                    <ModalBody>
                        <div className="gta__modalContent">
                            <div className="gta__modalKegiatan">
                                <span className="gta__modalKegiatanLabel">Kegiatan</span>
                                <p className="gta__modalKegiatanText">{modalStudents.activityTitle}</p>
                            </div>
                            <div className="gta__modalList">
                                {modalStudents.students.map((e, idx) => (
                                    <div key={e.id || idx} className="gta__modalItem">
                                        <span className="gta__modalItemNum">{idx + 1}</span>
                                        <div className="gta__modalItemInfo">
                                            <span className="gta__modalItemName">{e.guru_asuh?.nama_siswa || '-'}</span>
                                            <span className="gta__modalItemClass">Kelas {e.guru_asuh?.kelas || '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setModalStudents(null)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {viewer}

            <style jsx>{`
                .gta__wrap { display: flex; flex-direction: column; gap: 12px; animation: gtaFadeIn 0.3s ease-out; }
                @keyframes gtaFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

                .gta__filterWrapper { width: 100%; }

                .gta__grid { display: grid; grid-template-columns: 320px 1fr; gap: 14px; min-height: 60vh; max-height: 74vh; }

                .gta__left { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--n-border); border-radius: 16px; background: var(--n-card); }
                .gta__list { flex: 1; overflow-y: auto; }
                .gta__empty { padding: 24px 14px; text-align: center; color: var(--n-muted); font-size: 0.82rem; }

                .gta__item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--n-border); cursor: pointer; transition: background 0.15s; }
                .gta__item:last-child { border-bottom: none; }
                .gta__item:hover { background: var(--n-soft); }
                .gta__item--active { background: var(--n-soft); border-left: 3px solid var(--n-primary); }
                .gta__itemAvatar { width: 36px; height: 36px; border-radius: 10px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; color: #1a73e8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; position: relative; overflow: hidden; }
                .gta__avatarImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gta__itemBody { flex: 1; min-width: 0; }
                .gta__itemName { font-size: 0.84rem; font-weight: 700; color: var(--n-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .gta__itemRow { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 3px; }
                .gta__itemNip { font-size: 0.7rem; color: var(--n-muted); }
                .gta__itemPeriod { font-size: 0.68rem; color: var(--n-muted); margin-top: 3px; }
                .gta__itemChevron { display: none; color: var(--n-muted); font-size: 0.85rem; margin-left: auto; flex-shrink: 0; }

                .gta__badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 0.62rem; font-weight: 800; white-space: nowrap; }
                .gta__badge--pending { background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.28); }
                .gta__badge--approved { background: rgba(37, 99, 235, 0.1); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.25); }
                .gta__badge--revisi { background: rgba(220, 38, 38, 0.1); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.25); }

                .gta__content { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--n-border); border-radius: 16px; background: var(--n-card); }
                .gta__detailHeader { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--n-border); background: var(--n-card); flex-shrink: 0; }
                .gta__backBtn { display: none; padding: 6px 12px; font-size: 0.78rem; font-weight: 700; }
                .gta__detailTeacher { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
                .gta__detailAvatar { width: 36px; height: 36px; border-radius: 10px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; color: #1a73e8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; position: relative; overflow: hidden; }
                .gta__detailTeacherInfo { flex: 1; min-width: 0; }
                .gta__detailTeacherName { font-size: 0.88rem; font-weight: 800; color: var(--n-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .gta__detailTeacherNip { font-size: 0.7rem; color: var(--n-muted); }
                .gta__badgeIcon { margin-right: 4px; }
                .gta__detailHeaderBadge { flex-shrink: 0; }

                .gta__body { flex: 1; overflow-y: auto; padding: 16px 18px; }

                .gta__meta {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                    gap: 0;
                    margin-bottom: 14px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .gta__metaItem {
                    background: transparent;
                    border: none;
                    border-right: 1px solid var(--n-border);
                    border-radius: 0;
                    padding: 8px 12px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .gta__metaItem:last-child { border-right: none; }
                .gta__metaItem span { display: block; font-size: 0.6rem; color: var(--n-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 2px; }
                .gta__metaItem strong { font-size: 0.82rem; color: var(--n-ink); word-break: break-word; line-height: 1.25; }

                .gta__sectionHead { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 800; color: var(--n-ink); margin: 14px 0 8px; }

                .gta__tableWrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-card); }
                .gta__table { width: 100%; border-collapse: collapse; }
                .gta__table th { padding: 9px 12px; text-align: left; font-size: 0.65rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; background: var(--n-soft); border-bottom: 1px solid var(--n-border); }
                .gta__table td { padding: 10px 12px; font-size: 0.78rem; color: var(--n-ink); border-bottom: 1px solid var(--n-border); vertical-align: top; }
                .gta__table tr:last-child td { border-bottom: none; }
                .gta__nowrap { white-space: nowrap; }
                .gta__muted { color: var(--n-muted); font-size: 0.7rem; }

                .gta__mobileActivities { display: none; }
                .gta__activityCard { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04); }
                .gta__activityCardHead { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--n-border); }
                .gta__activityDate { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700; color: var(--n-ink); }
                .gta__activityDate i { color: #3b82f6; font-size: 0.85rem; }
                .gta__studentCountBadge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: rgba(37, 99, 235, 0.08); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.2); }
                .gta__activitySectionTitle { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-muted); margin-bottom: 4px; }
                .gta__activityDescText { margin: 0; font-size: 0.82rem; line-height: 1.45; color: var(--n-ink); word-break: break-word; }
                .gta__studentChips { display: flex; flex-wrap: wrap; gap: 6px; }
                .gta__studentChip { display: inline-flex; align-items: center; gap: 5px; background: var(--n-soft); border: 1px solid var(--n-border); border-radius: 8px; padding: 4px 8px; font-size: 0.74rem; max-width: 100%; }
                .gta__studentName { font-weight: 600; color: var(--n-ink); word-break: break-word; }
                .gta__studentClass { color: var(--n-muted); font-size: 0.68rem; background: rgba(0, 0, 0, 0.04); padding: 1px 4px; border-radius: 4px; }
                .gta__moreChipBtn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: rgba(37, 99, 235, 0.08);
                    color: #2563eb;
                    border: 1px dashed rgba(37, 99, 235, 0.4);
                    border-radius: 8px;
                    padding: 4px 10px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .gta__moreChipBtn:hover {
                    background: rgba(37, 99, 235, 0.18);
                    border-color: #2563eb;
                }
                .gta__moreLink {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: none;
                    padding: 0;
                    margin-top: 4px;
                    color: #2563eb;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                    text-decoration: underline;
                }
                .gta__moreLink:hover {
                    color: #1d4ed8;
                }

                /* Modal Content */
                .gta__modalContent { display: flex; flex-direction: column; gap: 12px; }
                .gta__modalKegiatan { background: var(--n-soft); border: 1px solid var(--n-border); border-radius: 10px; padding: 10px 12px; }
                .gta__modalKegiatanLabel { display: block; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--n-muted); letter-spacing: 0.03em; margin-bottom: 2px; }
                .gta__modalKegiatanText { margin: 0; font-size: 0.82rem; color: var(--n-ink); line-height: 1.4; }
                .gta__modalList { display: flex; flex-direction: column; gap: 8px; max-height: 52vh; overflow-y: auto; padding-right: 2px; }
                .gta__modalItem { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; background: var(--n-card); border: 1px solid var(--n-border); }
                .gta__modalItemNum { width: 22px; height: 22px; border-radius: 6px; background: rgba(37, 99, 235, 0.08); color: #2563eb; font-size: 0.72rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .gta__modalItemInfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
                .gta__modalItemName { font-size: 0.82rem; font-weight: 700; color: var(--n-ink); word-break: break-word; }
                .gta__modalItemClass { font-size: 0.7rem; color: var(--n-muted); font-weight: 500; }
                .gta__activityPhotos { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
                .gta__photoGrid { display: flex; flex-direction: column; gap: 8px; }
                .gta__photoCard {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: rgba(37, 99, 235, 0.06);
                    border: 1px solid rgba(37, 99, 235, 0.18);
                    text-decoration: none;
                    transition: all 0.15s;
                    cursor: pointer;
                    text-align: left;
                    font-family: inherit;
                    width: 100%;
                }
                .gta__photoCard:hover {
                    background: rgba(37, 99, 235, 0.12);
                }
                .gta__photoCardThumb {
                    width: 44px;
                    height: 44px;
                    border-radius: 8px;
                    object-fit: cover;
                    background: #e2e8f0;
                    flex-shrink: 0;
                }
                .gta__photoCardBody {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }
                .gta__photoCardTitle {
                    font-size: 0.76rem;
                    font-weight: 700;
                    color: var(--n-ink);
                }
                .gta__photoCardAction {
                    font-size: 0.68rem;
                    color: #2563eb;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .gta__photoLink {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.74rem;
                    font-weight: 600;
                    color: #2563eb;
                    text-decoration: none;
                    padding: 4px 10px;
                    background: rgba(37, 99, 235, 0.08);
                    border-radius: 6px;
                    border: 1px solid rgba(37, 99, 235, 0.2);
                    width: fit-content;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.15s;
                }
                .gta__photoLink:hover {
                    background: rgba(37, 99, 235, 0.16);
                }
                .gta__emptyCard { padding: 24px; text-align: center; color: var(--n-muted); font-size: 0.8rem; background: var(--n-card); border: 1px dashed var(--n-border); border-radius: 12px; }

                .gta__notes textarea { width: 100%; min-height: 76px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-ink); font-size: 0.83rem; resize: vertical; }
                .gta__notes textarea:disabled { opacity: 0.6; }

                .gta__actions { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--n-border); background: var(--n-card); flex-shrink: 0; }
                .gta__actionsSpacer { flex: 1; }
                .gta__btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid var(--n-border); transition: all 0.2s; }
                .gta__btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .gta__btn--ghost { background: var(--n-card); color: var(--n-muted); }
                .gta__btn--ghost:hover:not(:disabled) { background: var(--n-border); color: var(--n-ink); }
                .gta__btn--soft-red { background: rgba(220, 38, 38, 0.1); color: #dc2626; border-color: transparent; }
                .gta__btn--soft-red:hover:not(:disabled) { background: rgba(220, 38, 38, 0.2); }
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
                :global(.dark) .gta__detailHeader { background: #0b1329 !important; border-bottom-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__detailAvatar { background: rgba(26, 115, 232, 0.15) !important; border-color: rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gta__detailTeacherName { color: #ffffff !important; }
                :global(.dark) .gta__detailTeacherNip { color: #94a3b8 !important; }
                :global(.dark) .gta__notes textarea { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #ffffff !important; }
                :global(.dark) .gta__meta { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__metaItem { background: transparent !important; border-color: rgba(26, 115, 232, 0.25) !important; }
                :global(.dark) .gta__metaItem span { color: #94a3b8 !important; }
                :global(.dark) .gta__metaItem strong { color: #ffffff !important; }
                :global(.dark) .gta__tableWrap { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__table { background: #0b1329 !important; }
                :global(.dark) .gta__table th { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; }
                :global(.dark) .gta__table td { border-bottom-color: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; }
                :global(.dark) .gta__activityCard { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__activityCardHead { border-bottom-color: rgba(26, 115, 232, 0.25) !important; }
                :global(.dark) .gta__activityDate { color: #ffffff !important; }
                :global(.dark) .gta__activityDate i { color: #60a5fa !important; }
                :global(.dark) .gta__studentCountBadge { background: rgba(59, 130, 246, 0.16) !important; color: #60a5fa !important; border-color: rgba(59, 130, 246, 0.35) !important; }
                :global(.dark) .gta__activitySectionTitle { color: #94a3b8 !important; }
                :global(.dark) .gta__activityDescText { color: #f1f5f9 !important; }
                :global(.dark) .gta__studentChip { background: rgba(26, 115, 232, 0.1) !important; border-color: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .gta__studentName { color: #ffffff !important; }
                :global(.dark) .gta__studentClass { color: #94a3b8 !important; background: rgba(255, 255, 255, 0.08) !important; }
                :global(.dark) .gta__moreChipBtn { background: rgba(59, 130, 246, 0.16) !important; color: #60a5fa !important; border-color: rgba(59, 130, 246, 0.4) !important; }
                :global(.dark) .gta__moreChipBtn:hover { background: rgba(59, 130, 246, 0.25) !important; }
                :global(.dark) .gta__moreLink { color: #60a5fa !important; }
                :global(.dark) .gta__modalKegiatan { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__modalKegiatanLabel { color: #94a3b8 !important; }
                :global(.dark) .gta__modalKegiatanText { color: #f1f5f9 !important; }
                :global(.dark) .gta__modalItem { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .gta__modalItemNum { background: rgba(59, 130, 246, 0.2) !important; color: #60a5fa !important; }
                :global(.dark) .gta__modalItemName { color: #ffffff !important; }
                :global(.dark) .gta__modalItemClass { color: #94a3b8 !important; }
                :global(.dark) .gta__photoLink { background: rgba(37, 99, 235, 0.16) !important; border-color: rgba(37, 99, 235, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gta__photoCard { background: rgba(37, 99, 235, 0.12) !important; border-color: rgba(37, 99, 235, 0.3) !important; }
                :global(.dark) .gta__photoCardTitle { color: #ffffff !important; }
                :global(.dark) .gta__photoCardAction { color: #60a5fa !important; }
                :global(.dark) .gta__photoCardThumb { background: #1e293b !important; }
                :global(.dark) .gta__emptyCard { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; }
                :global(.dark) .gta__item { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .gta__item:hover { background: rgba(26, 115, 232, 0.1) !important; }
                :global(.dark) .gta__item--active { background: rgba(26, 115, 232, 0.2) !important; border-left-color: #60a5fa !important; }
                :global(.dark) .gta__itemAvatar { background: rgba(26, 115, 232, 0.15) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gta__itemName { color: #ffffff !important; }
                :global(.dark) .gta__actions { background: #0b1329 !important; border-top-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__btn--ghost { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gta__btn--ghost:hover { background: rgba(26, 115, 232, 0.15) !important; color: #ffffff !important; }
                :global(.dark) .gta__btn--reject,
                :global(.dark) .gta__btn--soft-red { background: rgba(239, 68, 68, 0.18) !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; color: #f87171 !important; }
                :global(.dark) .gta__btn--reject:hover { background: rgba(239, 68, 68, 0.35) !important; color: #ffffff !important; }
                :global(.dark) .gta__badge--revisi { background: rgba(239, 68, 68, 0.16) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; }
                :global(.dark) .gta__badge--approved { background: rgba(59, 130, 246, 0.16) !important; color: #60a5fa !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gta__badge--pending { background: rgba(245, 158, 11, 0.16) !important; color: #fbbf24 !important; border: 1px solid rgba(245, 158, 11, 0.35) !important; }

                @media (max-width: 800px) {
                    /* Sembunyikan FilterToolbar saat sedang membuka detail di mobile */
                    .gta__wrap--hasSelected .gta__filterWrapper {
                        display: none !important;
                    }

                    /* Hilangkan batas tinggi tetap dan inner scrollbox */
                    .gta__grid {
                        display: flex;
                        flex-direction: column;
                        min-height: auto;
                        max-height: none;
                        gap: 0;
                    }

                    /* Mode Daftar Laporan */
                    .gta__left {
                        display: flex;
                        flex-direction: column;
                        height: auto;
                        max-height: none;
                        overflow: visible;
                        border-radius: 16px;
                        background: var(--n-card);
                        border: 1px solid var(--n-border);
                    }
                    .gta__list {
                        overflow: visible;
                        height: auto;
                        padding-bottom: calc(var(--app-bottomnav-h, 62px) + 24px);
                    }
                    .gta__itemChevron {
                        display: block;
                    }
                    .gta__content {
                        display: none;
                    }

                    /* Mode Detail Laporan */
                    .gta__grid--hasSelected .gta__left {
                        display: none;
                    }
                    .gta__grid--hasSelected .gta__content {
                        display: flex;
                        flex-direction: column;
                        height: auto;
                        max-height: none;
                        overflow: visible;
                        border-radius: 16px;
                        background: var(--n-card);
                        border: 1px solid var(--n-border);
                        margin-bottom: calc(var(--app-bottomnav-h, 62px) + 24px);
                    }
                    .gta__body {
                        overflow: visible;
                        height: auto;
                        padding: 14px 12px;
                    }
                    .gta__backBtn {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 34px;
                        height: 34px;
                        padding: 0;
                        flex-shrink: 0;
                        border-radius: 10px;
                        font-size: 1rem;
                    }
                    .gta__backBtnLabel {
                        display: none;
                    }
                    .gta__detailHeader {
                        padding: 10px 12px;
                        gap: 8px;
                    }
                    .gta__detailTeacher {
                        gap: 0;
                    }
                    .gta__detailAvatar {
                        display: none !important;
                    }
                    .gta__nipLabel {
                        display: none;
                    }
                    .gta__detailTeacherName {
                        font-size: 0.84rem;
                        font-weight: 800;
                        line-height: 1.25;
                        white-space: normal;
                        word-break: break-word;
                    }
                    .gta__detailTeacherNip {
                        font-size: 0.68rem;
                        line-height: 1.2;
                        margin-top: 1px;
                    }
                    .gta__badge--approved {
                        padding: 4px 6px;
                        border-radius: 8px;
                    }
                    .gta__badge--approved .gta__badgeIcon {
                        margin-right: 0 !important;
                        font-size: 0.95rem;
                    }
                    .gta__badge--approved .gta__badgeLabel {
                        display: none;
                    }

                    /* Statistik Ringkas - Satu Kartu Ramping Terpadu */
                    .gta__meta {
                        grid-template-columns: 1fr 1fr;
                        gap: 0;
                        margin-bottom: 10px;
                        border-radius: 10px;
                    }
                    .gta__metaItem {
                        padding: 6px 10px;
                        border-right: 1px solid var(--n-border);
                        border-bottom: 1px solid var(--n-border);
                    }
                    .gta__metaItem:nth-child(2n) {
                        border-right: none;
                    }
                    .gta__metaItem:nth-child(n+3) {
                        border-bottom: none;
                    }
                    .gta__metaItem:nth-child(3):last-child {
                        grid-column: span 2;
                        border-right: none;
                        border-bottom: none;
                    }
                    .gta__metaItem span {
                        font-size: 0.58rem;
                        margin-bottom: 1px;
                    }
                    .gta__metaItem strong {
                        font-size: 0.76rem;
                        line-height: 1.2;
                    }

                    /* Sembunyikan tabel kaku di mobile, tampilkan kartu kegiatan */
                    .gta__tableWrap {
                        display: none;
                    }
                    .gta__mobileActivities {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }

                    /* Tombol aksi 2x2 rapi & mudah ditekan */
                    .gta__actions {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                        padding: 12px 14px;
                    }
                    .gta__actionsSpacer {
                        display: none;
                    }
                    .gta__actions .gta__btn {
                        width: 100%;
                        justify-content: center;
                        text-align: center;
                        white-space: nowrap;
                        font-size: 0.78rem;
                        padding: 9px 10px;
                        min-height: 38px;
                    }
                }
            `}</style>
        </div>
    );
}

