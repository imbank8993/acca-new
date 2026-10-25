'use client';

import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { createPortal } from 'react-dom';

const PiketInputPage = lazy(() => import('./input/page'));
import Pagination from '@/components/ui/Pagination';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import type { User } from '@/lib/types';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useFileViewer } from '@/components/useFileViewer';
import { getProxiedImageUrl } from '@/lib/image-utils';
import { useTimezone } from '@/hooks/use-timezone';
import { Tab, type TabItem } from '@/components/ui/Tab';
import FilterToolbar, { FilterField, FilterSearch, FilterActions, FilterSelect } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';

interface PiketDetail {
    id: number;
    piket_id: number;
    nama_kelas: string;
    nama_guru: string;
    status_kehadiran: string;
    status_tambahan_1?: string | null;
    status_tambahan_2?: string | null;
    status_tambahan_3?: string | null;
    dokumentasi_url: string | null;
}

interface PiketReport {
    id: number;
    tanggal: string;
    nama_guru_piket: string;
    jam_ke: string;
    keterangan: string;
    created_at: string;
    details: PiketDetail[];
}

const STATUS_COLORS: Record<string, string> = {
    'hadir': 'bg-green-100 text-green-700',
    'izin': 'bg-yellow-100 text-yellow-700',
    'sakit': 'bg-blue-100 text-blue-700',
    'tugas': 'bg-blue-100 text-blue-700',
    'tanpa keterangan': 'bg-red-100 text-red-700',
};

// ─── Dokumentasi Tab ─────────────────────────────────────────────────────────
interface DokumentasiItem {
    id: number;
    piket_id: number;
    piket_date: string;
    piket_guru: string;
    nama_kelas: string;
    nama_guru: string;
    dokumentasi_url: string;
    statuses: string[];
}

function DokumentasiTab({ reports, loading, isAdminOrOpJurnal }: { reports: PiketReport[]; loading: boolean; isAdminOrOpJurnal: boolean }) {
    const [searchDoc, setSearchDoc] = useState('');
    const [filterDateDoc, setFilterDateDoc] = useState('');
    const [filterStatusDoc, setFilterStatusDoc] = useState('');
    const [currentDocPage, setCurrentDocPage] = useState(1);
    const [itemsPerDocPage, setItemsPerDocPage] = useState(10);
    const [lightboxMeta, setLightboxMeta] = useState<{ url: string; kelas: string; guru: string; tanggal: string; guruPiket: string; statuses: string[] } | null>(null);

    // Flatten all dokumentasi items from reports
    const allDocs = reports.flatMap(r =>
        (r.details || [])
            .filter((d: PiketDetail) => d.dokumentasi_url)
            .map((d: PiketDetail) => ({
                id: d.id,
                piket_id: r.id,
                piket_date: r.tanggal,
                piket_guru: r.nama_guru_piket,
                nama_kelas: d.nama_kelas,
                nama_guru: d.nama_guru || '–',
                dokumentasi_url: d.dokumentasi_url!,
                statuses: Array.from(new Map(
                    [d.status_kehadiran, d.status_tambahan_1, d.status_tambahan_2, d.status_tambahan_3]
                        .map(value => (value || '').trim())
                        .filter(value => value && value !== '-')
                        .map(value => [value.toLowerCase(), value] as const)
                ).values()),
            }))
    );

    const filteredDocs = allDocs.filter(doc => {
        const docDate = doc.piket_date.split('T')[0];
        const matchSearch =
            doc.nama_kelas.toLowerCase().includes(searchDoc.toLowerCase()) ||
            doc.nama_guru.toLowerCase().includes(searchDoc.toLowerCase()) ||
            doc.piket_guru.toLowerCase().includes(searchDoc.toLowerCase()) ||
            doc.statuses.some(status => status.toLowerCase().includes(searchDoc.toLowerCase()));
        const matchDate = filterDateDoc === '' || docDate === filterDateDoc;
        const matchStatus = !filterStatusDoc || doc.statuses.some(status => status.toLowerCase() === filterStatusDoc);
        return matchSearch && matchDate && matchStatus;
    });

    const totalPages = Math.ceil(filteredDocs.length / itemsPerDocPage);
    const indexLast = currentDocPage * itemsPerDocPage;
    const indexFirst = indexLast - itemsPerDocPage;
    const currentDocs = filteredDocs.slice(indexFirst, indexLast);

    const { timezone } = useTimezone();

    const formatTanggal = (d: string) =>
        new Date(d.split('T')[0] + 'T12:00:00').toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', timeZone: timezone
        });

    // ── Avatar helpers ────────────────────────────────────────────────────────
    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };
    const AVATAR_COLORS = [
        { bg: 'rgba(99,102,241,0.18)', color: '#3083FF', border: 'rgba(99,102,241,0.35)' },
        { bg: 'rgba(20,184,166,0.18)', color: '#0d9488', border: 'rgba(20,184,166,0.35)' },
        { bg: 'rgba(245,158,11,0.18)', color: '#d97706', border: 'rgba(245,158,11,0.35)' },
        { bg: 'rgba(236,72,153,0.18)', color: '#db2777', border: 'rgba(236,72,153,0.35)' },
        { bg: 'rgba(59,130,246,0.18)', color: '#2563eb', border: 'rgba(59,130,246,0.35)' },
        { bg: 'rgba(34,197,94,0.18)', color: '#16a34a', border: 'rgba(34,197,94,0.35)' },
        { bg: 'rgba(96,165,250,0.18)', color: '#3083FF', border: 'rgba(96,165,250,0.35)' },
        { bg: 'rgba(239,68,68,0.18)', color: '#dc2626', border: 'rgba(239,68,68,0.35)' },
    ];
    const getAvatarColor = (name: string) => {
        const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return AVATAR_COLORS[hash % AVATAR_COLORS.length];
    };

    return (
        <>
            {/* Administrative Stats - Only for Admin/Op Jurnal */}
            {isAdminOrOpJurnal && (
                <div className="piket-stats-grid">
                    <div className="piket-stat-card">
                        <div className="piket-stat-icon">
                            <i className="bi bi-camera"></i>
                        </div>
                        <div className="piket-stat-info">
                            <span className="piket-stat-num">{filteredDocs.length}</span>
                            <span className="piket-stat-label">Dokumentasi</span>
                        </div>
                    </div>
                    <div className="piket-stat-card">
                        <div className="piket-stat-icon today">
                            <i className="bi bi-files"></i>
                        </div>
                        <div className="piket-stat-info">
                            <span className="piket-stat-num">{reports.length}</span>
                            <span className="piket-stat-label">Laporan</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Toolbar */}
            <FilterToolbar>
                <FilterField label="Tanggal" icon="calendar-date" bare width="180px">
                    <DatePicker value={filterDateDoc} onChange={v => { setFilterDateDoc(v); setCurrentDocPage(1); }} />
                </FilterField>
                <FilterSelect
                    label="Status Kehadiran"
                    value={filterStatusDoc}
                    onChange={value => { setFilterStatusDoc(value); setCurrentDocPage(1); }}
                    options={[
                        { value: '', label: 'Semua Status' },
                        ...Array.from(new Map(allDocs.flatMap(doc => doc.statuses.map(status => [status.toLowerCase(), status] as const))).entries())
                            .sort((a, b) => a[1].localeCompare(b[1], 'id'))
                            .map(([value, label]) => ({ value, label }))
                    ]}
                    width="240px"
                />
                <FilterSearch
                    value={searchDoc}
                    onChange={v => { setSearchDoc(v); setCurrentDocPage(1); }}
                    placeholder="Kelas, guru, piket, status..."
                />
                {(filterDateDoc || filterStatusDoc || searchDoc) && (
                    <FilterActions>
                        <Button
                            variant="cancel"
                            onClick={() => { setFilterDateDoc(''); setFilterStatusDoc(''); setSearchDoc(''); setCurrentDocPage(1); }}
                            leftIcon={<i className="bi bi-x-lg" />}
                        >
                            Reset
                        </Button>
                    </FilterActions>
                )}
            </FilterToolbar>

            {/* Photo Grid */}
            <div className="doc-grid-wrapper">
                {loading ? (
                    <div className="doc-loading">
                        <div className="doc-shimmer-grid">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="doc-shimmer-card">
                                    <div className="doc-shimmer-img"></div>
                                    <div className="doc-shimmer-body">
                                        <div className="doc-shimmer-line wide"></div>
                                        <div className="doc-shimmer-line narrow"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : currentDocs.length === 0 ? (
                    <div className="doc-empty">
                        <div className="doc-empty-icon">
                            <i className="bi bi-camera2"></i>
                        </div>
                        <h3>Belum Ada Dokumentasi</h3>
                        <p>Foto dokumentasi piket akan muncul di sini setelah guru piket mengunggah</p>
                    </div>
                ) : (
                    <>
                        <div className="doc-grid">
                            {currentDocs.map((doc, idx) => (
                                <div
                                    key={doc.id}
                                    className="doc-card"
                                    style={{ animationDelay: `${idx * 40}ms` }}
                                    onClick={() => setLightboxMeta({
                                        url: doc.dokumentasi_url,
                                        kelas: doc.nama_kelas,
                                        guru: doc.nama_guru,
                                        tanggal: formatTanggal(doc.piket_date),
                                        guruPiket: doc.piket_guru,
                                        statuses: doc.statuses,
                                    })}
                                >
                                    <div className="doc-card-img-wrap">
                                        <img
                                            src={getProxiedImageUrl(doc.dokumentasi_url)}
                                            alt={`${doc.nama_kelas} — ${doc.nama_guru}`}
                                            className="doc-card-img"
                                            loading="lazy"
                                        />
                                        <div className="doc-card-img-overlay">
                                            <div className="doc-card-zoom">
                                                <i className="bi bi-arrows-fullscreen"></i>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="doc-card-body">
                                        <div className="doc-card-kelas-row">
                                            <span className="doc-card-kelas">{doc.nama_kelas}</span>
                                            <span className="doc-card-jam">
                                                <i className="bi bi-calendar3-week"></i>
                                                {formatTanggal(doc.piket_date)}
                                            </span>
                                        </div>
                                        <div className="doc-card-guru-wrap">
                                            <i className="bi bi-person-fill"></i>
                                            <span className="doc-card-guru-text">{doc.nama_guru}</span>
                                        </div>
                                        <div className="doc-status-list" aria-label="Status kehadiran">
                                            {doc.statuses.map(status => <span key={status} className="doc-status-badge">{status}</span>)}
                                        </div>
                                        {/* Piket guru avatar */}
                                        <div className="doc-piket-avatar">
                                            {(() => {
                                                const av = getAvatarColor(doc.piket_guru);
                                                return (
                                                    <div
                                                        className="doc-piket-avatar-circle"
                                                        style={{ background: av.bg, color: av.color, border: `1.5px solid ${av.border}` }}
                                                    >
                                                        {getInitials(doc.piket_guru)}
                                                    </div>
                                                );
                                            })()}
                                            <div className="doc-piket-avatar-info">
                                                <span className="doc-piket-avatar-label">Guru Piket</span>
                                                <span className="doc-piket-avatar-name">{doc.piket_guru}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="doc-pagination">
                                <button
                                    className="doc-page-btn"
                                    disabled={currentDocPage === 1}
                                    onClick={() => setCurrentDocPage(p => p - 1)}
                                >
                                    <i className="bi bi-chevron-left"></i>
                                </button>
                                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                    const page = i + 1;
                                    return (
                                        <button
                                            key={page}
                                            className={`doc-page-num ${currentDocPage === page ? 'active' : ''}`}
                                            onClick={() => setCurrentDocPage(page)}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                                <button
                                    className="doc-page-btn"
                                    disabled={currentDocPage === totalPages}
                                    onClick={() => setCurrentDocPage(p => p + 1)}
                                >
                                    <i className="bi bi-chevron-right"></i>
                                </button>
                            </div>
                        )}
                        <div className="doc-pagination-info">
                            Menampilkan {indexFirst + 1}–{Math.min(indexLast, filteredDocs.length)} dari {filteredDocs.length} foto
                        </div>
                    </>
                )}
            </div>

            {/* Lightbox */}
            {lightboxMeta && typeof document !== 'undefined' && createPortal(
                <div className="doc-lightbox" onClick={() => setLightboxMeta(null)}>
                    <div className="doc-lightbox-panel" onClick={e => e.stopPropagation()}>
                        <div className="doc-lightbox-topbar">
                            <div className="doc-lightbox-meta">
                                <span className="doc-lb-kelas">{lightboxMeta.kelas}</span>
                                <span className="doc-lb-sep">·</span>
                                <span className="doc-lb-guru">{lightboxMeta.guru}</span>
                            </div>
                            <div className="doc-lightbox-actions">
                                <a href={lightboxMeta.url} target="_blank" rel="noreferrer" className="doc-lb-dl" title="Unduh">
                                    <i className="bi bi-download"></i>
                                </a>
                                <button className="doc-lightbox-close" onClick={() => setLightboxMeta(null)}>
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>
                        <div className="doc-lightbox-img-wrap">
                            <img src={getProxiedImageUrl(lightboxMeta.url)} alt={lightboxMeta.kelas} className="doc-lightbox-img" />
                        </div>
                        <div className="doc-lightbox-footer">
                            <div className="doc-status-list" aria-label="Status kehadiran">
                                {lightboxMeta.statuses.map(status => <span key={status} className="doc-status-badge">{status}</span>)}
                            </div>
                            <div className="doc-lb-info">
                                <span><i className="bi bi-calendar3"></i> {lightboxMeta.tanggal}</span>
                                <span className="doc-lb-piket-avatar">
                                    {(() => {
                                        const av = getAvatarColor(lightboxMeta.guruPiket);
                                        return (
                                            <span
                                                className="doc-lb-av-circle"
                                                style={{ background: av.bg, color: av.color, border: `1.5px solid ${av.border}` }}
                                            >
                                                {getInitials(lightboxMeta.guruPiket)}
                                            </span>
                                        );
                                    })()}
                                    {lightboxMeta.guruPiket}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

export default function PiketPage({ user, initialTab }: { user?: User; initialTab?: 'dokumentasi' | 'input' }) {
    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();
    const [reports, setReports] = useState<PiketReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [activeTab, setActiveTab] = useTabParam<'dokumentasi' | 'input'>(initialTab || 'input', ['dokumentasi', 'input']);

    // ── Role checks ─────────────────────────────────────────────────────────────
    const rawRoles = Array.isArray(user?.roles) ? user.roles.map(r => r.toUpperCase()) : (user?.role || '').toUpperCase().split(/[,|]/).map(r => r.trim()).filter(Boolean);
    const userRoleList = [...new Set([
        ...rawRoles,
        ...(user?.roles || []).map(r => r.toUpperCase()),
        ...rawRoles.map(r => r.replace(/\s+/g, '_')),
        ...rawRoles.map(r => r.replace(/_/g, ' '))
    ])];

    const isAdminOrOpJurnal = userRoleList.includes('ADMIN') || userRoleList.includes('ADMINISTRATOR') || userRoleList.includes('OP_JURNAL') || userRoleList.includes('OP JURNAL');
    const canAccessInput = isAdminOrOpJurnal || userRoleList.includes('GURU');

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/laporan/piket?limit=500');
            const result = await res.json();
            if (result.ok) {
                setReports(result.data);
            }
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    // Sync with initialTab
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Effect to handle tab access
    useEffect(() => {
        if (activeTab === 'input' && !canAccessInput) {
            setActiveTab('dokumentasi');
        }
    }, [canAccessInput, activeTab]);

    const tabs: TabItem<'input' | 'dokumentasi'>[] = useMemo(() => {
        const list: TabItem<'input' | 'dokumentasi'>[] = [];
        if (canAccessInput) {
            list.push({ key: 'input', label: 'Laporan Piket', icon: 'bi-plus-circle-fill' });
        }
        list.push({ key: 'dokumentasi', label: 'Dokumentasi Piket', icon: 'bi-camera-fill' });
        return list;
    }, [canAccessInput]);

    const pageTitle = activeTab === 'dokumentasi'
        ? 'Dokumentasi Piket'
        : 'Laporan Piket';

    const pageDesc = activeTab === 'dokumentasi'
        ? 'Kumpulan foto dokumentasi kegiatan piket harian.'
        : 'Input laporan kehadiran kelas per jam pelajaran.';

    return (
        <>
            {/* NOTIFICATION */}
            {notification && (
                <div className={`notif-bar ${notification.type === 'success' ? 'notif-success' : 'notif-error'}`}>
                    <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                    {notification.message}
                </div>
            )}

            <div className="piket-container">
                {/* ── Header Banner ── */}
                

                {/* ── Tab Bar ── */}
                <Tab
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Navigasi Piket"
                    variant="slider"
                />

                {/* ── Tab: Dokumentasi ─────────────────────────────────────────── */}
                {activeTab === 'dokumentasi' && <DokumentasiTab reports={reports} loading={loading} isAdminOrOpJurnal={isAdminOrOpJurnal} />}

                {/* ── Tab: Input ───────────────────────────────────────────────── */}
                {activeTab === 'input' && (
                    <Suspense fallback={<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px' }}><Spinner variant="buble" /><p style={{ color: 'var(--n-muted)', fontSize: '0.875rem' }}>Memuat Form Input...</p></div>}>
                        <PiketInputPage isTabMode={true} />
                    </Suspense>
                )}
            </div>

            <style jsx global>{`
                .doc-status-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                .doc-status-badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 6px;
                    background: var(--n-soft, #eff6ff);
                    color: var(--n-primary, #2563eb);
                    font-size: 0.75rem;
                    line-height: 1.4;
                }
                .piket-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-bottom: 2rem;
                    width: 100%;
                }

                /* Notification */
                .notif-bar {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 2000;
                    padding: 14px 20px;
                    border-radius: 16px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                    animation: slideIn 0.3s ease;
                    max-width: 380px;
                }
                .notif-success { background: #ecfdf5; color: #166534; border: 1px solid #bbf7d0; }
                .notif-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                /* ── Stats Grid ────────────────────────────────────────────── */
                .piket-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 12px;
                    margin: 0;
                }
                .piket-stat-card {
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
                    transition: transform 0.2s;
                }
                .piket-stat-card:hover { transform: translateY(-2px); }
                .piket-stat-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--n-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.4rem;
                    flex-shrink: 0;
                }
                .piket-stat-icon.today {
                    background: rgba(34, 197, 94, 0.1);
                    color: #16a34a;
                }
                .piket-stat-info { display: flex; flex-direction: column; gap: 2px; }
                .piket-stat-num {
                    font-size: 1.4rem;
                    font-weight: 800;
                    color: var(--n-ink);
                    line-height: 1.1;
                }
                .piket-stat-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                /* Table Wrapper */
                .table-wrapper {
                    background: var(--n-card);
                    border-radius: 18px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    margin: 0;
                }
                .table-scroll {
                    overflow-x: auto;
                }
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.85rem;
                }
                .data-table thead tr {
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }
                .data-table th {
                    padding: 12px 16px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    white-space: nowrap;
                }
                .data-table tbody tr {
                    border-bottom: 1px solid var(--n-border);
                    transition: background 0.15s;
                }
                .data-table tbody tr:hover { background: rgba(59, 130, 246, 0.03); }
                .data-table tbody tr:last-child { border-bottom: none; }
                .data-table td {
                    padding: 14px 16px;
                    color: var(--n-ink);
                    vertical-align: middle;
                }
                .col-no {
                    color: var(--n-muted);
                    font-weight: 700;
                    font-size: 0.75rem;
                    width: 45px;
                }
                .desktop-only { display: inline; }
                .mobile-only { display: none; }
                .col-date .date-cell {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--n-ink);
                    font-weight: 600;
                }
                .col-date i { color: var(--n-muted); font-size: 0.85rem; }
                .col-guru .guru-cell {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .guru-avatar {
                    width: 34px;
                    height: 34px;
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--n-primary);
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.95rem;
                    flex-shrink: 0;
                }
                .jam-badge {
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--n-primary);
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 4px 9px;
                    border-radius: 7px;
                    white-space: nowrap;
                }
                .ket-text {
                    display: block;
                    max-width: 200px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: var(--n-muted);
                    font-size: 0.82rem;
                }
                .kelas-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    max-width: 240px;
                }
                .kelas-chip {
                    background: var(--n-soft);
                    color: var(--n-ink);
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 3px 7px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                }
                .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .status-dot.hadir { background: #22c55e; }
                .status-dot.izin { background: #eab308; }
                .status-dot.sakit { background: #3b82f6; }
                .status-dot.tugas { background: #6366f1; }
                .status-dot.tanpa-keterangan { background: #ef4444; }
                .kelas-more {
                    background: var(--n-border);
                    color: var(--n-muted);
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 3px 6px;
                    border-radius: 6px;
                }
                .col-aksi {
                    width: 90px;
                    white-space: nowrap;
                }

                /* Modal Specific Custom Sections */
                .summary-section {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    background: var(--n-soft);
                    padding: 20px;
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                }
                .summary-item label {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 4px;
                }
                .summary-item p { font-size: 0.95rem; font-weight: 600; color: var(--n-ink); margin: 0; }
                .summary-item.full { grid-column: span 2; }
                .details-section h3 { font-size: 1.1rem; font-weight: 800; color: var(--n-ink); margin-bottom: 12px; }
                .table-responsive { width: 100%; overflow-x: auto; }
                .details-table { width: 100%; border-collapse: collapse; text-align: left; }
                .details-table th {
                    padding: 10px 14px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    border-bottom: 1px solid var(--n-border);
                    background: var(--n-soft);
                }
                .details-table td { padding: 12px 14px; font-size: 0.85rem; color: var(--n-ink); border-bottom: 1px solid var(--n-border); }
                .status-badge {
                    padding: 3px 10px;
                    border-radius: 99px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    display: inline-block;
                }
                .status-badge.hadir { background: #dcfce7; color: #166534; }
                .status-badge.izin { background: #fef9c3; color: #854d0e; }
                .status-badge.sakit { background: #eff6ff; color: #1e40af; }
                .status-badge.tugas { background: #eff6ff; color: #1e40af; }
                .status-badge.tanpa-keterangan { background: #fee2e2; color: #991b1b; }
                .img-link { color: var(--n-primary); font-weight: 600; display: flex; align-items: center; gap: 6px; text-decoration: none; padding: 0; border: none; background: none; cursor: pointer; font-family: inherit; font-size: inherit; }
                .img-link:hover { text-decoration: underline; }

                /* Edit Form */
                .edit-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .form-group { display: flex; flex-direction: column; gap: 6px; }
                .form-group.full { grid-column: span 2; }
                .form-group label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .form-group input, .form-group textarea {
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1.5px solid var(--n-border);
                    font-size: 0.85rem;
                    color: var(--n-ink);
                    background: var(--n-card);
                    outline: none;
                    transition: border-color 0.2s;
                    font-family: inherit;
                }
                .form-group input:focus, .form-group textarea:focus {
                    border-color: var(--n-primary);
                }

                /* Empty state */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 50px 20px;
                    color: var(--n-muted);
                    gap: 14px;
                }
                .empty-state i { font-size: 3.5rem; opacity: 0.3; }

                /* ── Dokumentasi Tab ────────────────────────────────────────── */
                @keyframes docFadeUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes docShimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* Grid Wrapper */
                .doc-grid-wrapper {
                    background: var(--n-card);
                    border-radius: 18px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    margin: 0;
                }

                /* Loading shimmer */
                .doc-shimmer-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    padding: 12px;
                }
                .doc-shimmer-card {
                    border-radius: 14px;
                    overflow: hidden;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                }
                .doc-shimmer-img {
                    aspect-ratio: 4/3;
                    background: linear-gradient(90deg, var(--n-soft) 25%, var(--n-border) 50%, var(--n-soft) 75%);
                    background-size: 200% 100%;
                    animation: docShimmer 1.4s ease infinite;
                }
                .doc-shimmer-body {
                    padding: 10px 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .doc-shimmer-line {
                    height: 9px;
                    border-radius: 6px;
                    background: linear-gradient(90deg, var(--n-soft) 25%, var(--n-border) 50%, var(--n-soft) 75%);
                    background-size: 200% 100%;
                    animation: docShimmer 1.4s ease infinite;
                }
                .doc-shimmer-line.wide { width: 65%; }
                .doc-shimmer-line.narrow { width: 40%; }

                /* Empty state */
                .doc-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    gap: 12px;
                    text-align: center;
                }
                .doc-empty-icon {
                    width: 60px; height: 60px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                    color: var(--n-muted);
                    margin-bottom: 4px;
                }
                .doc-empty h3 {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    margin: 0;
                }
                .doc-empty p {
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    margin: 0;
                    max-width: 300px;
                    line-height: 1.4;
                }

                /* Photo Grid */
                .doc-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    padding: 14px;
                }
                .doc-card {
                    background: var(--n-card);
                    border-radius: 14px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
                    animation: docFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .doc-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
                    border-color: var(--n-primary);
                }
                .doc-card-img-wrap {
                    position: relative;
                    aspect-ratio: 4/3;
                    overflow: hidden;
                    background: var(--n-soft);
                }
                .doc-card-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.3s ease;
                }
                .doc-card:hover .doc-card-img {
                    transform: scale(1.05);
                }
                .doc-card-img-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%);
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    padding-bottom: 10px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .doc-card:hover .doc-card-img-overlay { opacity: 1; }
                .doc-card-zoom {
                    width: 32px; height: 32px;
                    background: rgba(255,255,255,0.9);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--n-primary);
                    font-size: 0.8rem;
                }
                .doc-card-body { padding: 10px 12px; }
                .doc-card-kelas-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 6px;
                    margin-bottom: 6px;
                }
                .doc-card-kelas {
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: var(--n-ink);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }
                .doc-card-jam {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 0.65rem;
                    color: var(--n-muted);
                    white-space: nowrap;
                    font-weight: 500;
                    flex-shrink: 0;
                }
                .doc-card-jam i { color: var(--n-primary); font-size: 0.72rem; }
                .doc-card-guru-wrap {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-primary);
                    margin-bottom: 2px;
                    line-height: 1.35;
                }
                .doc-card-guru-wrap i {
                    color: var(--n-primary);
                    font-size: 0.85rem;
                    flex-shrink: 0;
                }
                .doc-card-guru-text {
                    white-space: normal;
                    word-break: break-word;
                }
                .doc-piket-avatar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid var(--n-border);
                }
                .doc-piket-avatar-circle {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.62rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }
                .doc-piket-avatar-info {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    min-width: 0;
                    overflow: hidden;
                }
                .doc-piket-avatar-label {
                    font-size: 0.55rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                    line-height: 1;
                }
                .doc-piket-avatar-name {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Lightbox piket avatar */
                .doc-lb-piket-avatar {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    font-size: 0.82rem;
                    color: var(--n-ink);
                    font-weight: 600;
                }
                .doc-lb-av-circle {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.62rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }

                /* Pagination */
                .doc-pagination {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    padding: 14px 14px 6px;
                    border-top: 1px solid var(--n-border);
                }
                .doc-page-btn {
                    width: 32px; height: 32px;
                    border-radius: 9px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.82rem;
                }
                .doc-page-btn:hover:not(:disabled) {
                    background: var(--n-soft);
                    color: var(--n-primary);
                }
                .doc-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
                .doc-page-num {
                    width: 32px; height: 32px;
                    border-radius: 9px;
                    border: 1px solid transparent;
                    background: transparent;
                    color: var(--n-muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.8rem;
                    font-weight: 600;
                    font-family: inherit;
                }
                .doc-page-num:hover { background: var(--n-soft); color: var(--n-ink); }
                .doc-page-num.active {
                    background: var(--n-primary);
                    border-color: var(--n-primary);
                    color: white;
                }
                .doc-pagination-info {
                    text-align: center;
                    font-size: 0.7rem;
                    color: var(--n-muted);
                    padding: 0 14px 12px;
                    font-weight: 500;
                }

                /* Lightbox */
                .doc-lightbox {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.85);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    padding: 20px;
                    animation: fadeIn 0.25s ease;
                }
                .doc-lightbox-panel {
                    width: 100%;
                    max-width: 820px;
                    background: var(--n-card);
                    border-radius: 20px;
                    overflow: hidden;
                    border: 1px solid var(--n-border);
                    box-shadow: 0 30px 80px rgba(0,0,0,0.35);
                }
                .doc-lightbox-topbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 18px;
                    border-bottom: 1px solid var(--n-border);
                    background: var(--n-soft);
                }
                .doc-lightbox-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    overflow: hidden;
                }
                .doc-lb-kelas {
                    font-size: 0.95rem;
                    font-weight: 800;
                    color: var(--n-ink);
                    white-space: nowrap;
                }
                .doc-lb-sep { color: var(--n-muted); font-size: 0.82rem; }
                .doc-lb-guru { font-size: 0.82rem; color: var(--n-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .doc-lightbox-actions { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
                .doc-lb-dl {
                    width: 34px; height: 34px;
                    border-radius: 9px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    color: var(--n-muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    font-size: 0.85rem;
                    text-decoration: none;
                }
                .doc-lb-dl:hover { color: var(--n-primary); border-color: var(--n-primary); }
                .doc-lightbox-close {
                    width: 34px; height: 34px;
                    border-radius: 9px;
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.15);
                    color: #ef4444;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .doc-lightbox-close:hover { background: rgba(239,68,68,0.15); }
                .doc-lightbox-img-wrap {
                    background: var(--n-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 240px;
                    max-height: 60vh;
                }
                .doc-lightbox-img {
                    width: 100%;
                    height: auto;
                    max-height: 60vh;
                    object-fit: contain;
                    display: block;
                }
                .doc-lightbox-footer {
                    padding: 12px 18px;
                    border-top: 1px solid var(--n-border);
                    background: var(--n-soft);
                }
                .doc-lb-info { display: flex; align-items: center; gap: 20px; }
                .doc-lb-info span {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }
                .doc-lb-info i { color: var(--n-primary); font-size: 0.8rem; }

                /* =========================================================
                   DARK MODE — THEME OVERRIDES
                ========================================================= */

                /* Stats Cards */
                .dark .piket-stat-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    transition: all 0.2s ease !important;
                }
                .dark .piket-stat-card:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                .dark .piket-stat-num {
                    color: #f1f5f9 !important;
                }
                .dark .piket-stat-label {
                    color: #94a3b8 !important;
                }
                .dark .piket-stat-icon {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(59, 130, 246, 0.35) !important;
                }
                .dark .piket-stat-icon.today {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(59, 130, 246, 0.35) !important;
                }

                /* Table */
                .dark .table-wrapper {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 20px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }
                .dark .data-table thead tr {
                    background: rgba(37, 99, 235, 0.15) !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                .dark .data-table th {
                    color: #93c5fd !important;
                }
                .dark .data-table tbody tr {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                }
                .dark .data-table tbody tr:hover td {
                    background: rgba(26, 115, 232, 0.08) !important;
                }
                .dark .data-table td {
                    color: #f1f5f9 !important;
                }
                .dark .col-date .date-cell {
                    color: #f1f5f9 !important;
                }
                .dark .col-date i {
                    color: #60a5fa !important;
                }
                .dark .guru-avatar {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(59, 130, 246, 0.3) !important;
                }
                .dark .jam-badge {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(59, 130, 246, 0.3) !important;
                }
                .dark .kelas-chip {
                    background: rgba(26, 115, 232, 0.12) !important;
                    color: #f1f5f9 !important;
                    border: 1px solid rgba(59, 130, 246, 0.25) !important;
                }
                .dark .kelas-more {
                    background: rgba(148, 163, 184, 0.15) !important;
                    color: #94a3b8 !important;
                }
                .dark .ket-text {
                    color: #94a3b8 !important;
                }

                /* Dokumentasi Grid */
                .dark .doc-grid-wrapper {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 18px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }
                .dark .doc-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 14px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    transition: all 0.2s ease !important;
                }
                .dark .doc-card:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                .dark .doc-card-body {
                    background: #0b1329 !important;
                }
                .dark .doc-card-kelas {
                    color: #f1f5f9 !important;
                }
                .dark .doc-card-jam {
                    color: #94a3b8 !important;
                }
                .dark .doc-card-guru-wrap {
                    color: #60a5fa !important;
                }
                .dark .doc-card-guru-wrap i {
                    color: #60a5fa !important;
                }
                .dark .doc-piket-avatar {
                    border-top-color: rgba(59, 130, 246, 0.2) !important;
                }
                .dark .doc-piket-avatar-name {
                    color: #f1f5f9 !important;
                }
                .dark .doc-piket-avatar-label {
                    color: #94a3b8 !important;
                }
                .dark .doc-empty {
                    color: #94a3b8 !important;
                }
                .dark .doc-empty h3 {
                    color: #f1f5f9 !important;
                }
                .dark .doc-empty-icon {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #60a5fa !important;
                }

                /* Pagination */
                .dark .doc-pagination {
                    border-top-color: rgba(59, 130, 246, 0.25) !important;
                }
                .dark .doc-page-btn {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #60a5fa !important;
                }
                .dark .doc-page-num {
                    color: #94a3b8 !important;
                }
                .dark .doc-page-num:hover {
                    background: rgba(26, 115, 232, 0.12) !important;
                    color: #93c5fd !important;
                }
                .dark .doc-page-num.active {
                    background: #1a73e8 !important;
                    border-color: #3b82f6 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important;
                }

                /* Lightbox */
                .dark .doc-lightbox-panel {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 20px !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7) !important;
                }
                .dark .doc-lightbox-topbar,
                .dark .doc-lightbox-footer {
                    background: #0b1329 !important;
                    border-color: rgba(26, 115, 232, 0.25) !important;
                }
                .dark .doc-lb-kelas {
                    color: #f1f5f9 !important;
                }
                .dark .doc-lb-guru {
                    color: #94a3b8 !important;
                }
                .dark .doc-lb-dl {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #60a5fa !important;
                }
                .dark .doc-lb-info span {
                    color: #94a3b8 !important;
                }

                /* Modals Custom Elements */
                .dark .summary-section {
                    background: rgba(26, 115, 232, 0.06) !important;
                    border: 1px solid rgba(59, 130, 246, 0.25) !important;
                    border-radius: 16px !important;
                }
                .dark .summary-item label {
                    color: #94a3b8 !important;
                }
                .dark .summary-item p {
                    color: #f1f5f9 !important;
                }
                .dark .details-section h3 {
                    color: #f1f5f9 !important;
                }
                .dark .details-table th {
                    background: rgba(37, 99, 235, 0.15) !important;
                    color: #93c5fd !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                .dark .details-table td {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                    color: #f1f5f9 !important;
                }
                .dark .img-link {
                    color: #60a5fa !important;
                }
                .dark .form-group label {
                    color: #94a3b8 !important;
                }
                .dark .form-group input,
                .dark .form-group textarea {
                    background-color: #0b1329 !important;
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #f1f5f9 !important;
                    border-radius: 10px !important;
                }
                .dark .form-group input:focus,
                .dark .form-group textarea:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
                }

                @media (max-width: 768px) {
                    /* Stats grid mobile */
                    .piket-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
                    .piket-stat-card { padding: 12px; gap: 10px; border-radius: 14px; align-items: center; }
                    .piket-stat-icon { width: 40px; height: 40px; font-size: 1.2rem; border-radius: 10px; }
                    .piket-stat-num { font-size: 1.2rem; }
                    .piket-stat-label { font-size: 0.7rem; }
                    
                    .desktop-only { display: none !important; }
                    .mobile-only { display: inline !important; }
                    .col-jam { display: none !important; }

                    /* Dokumentasi grid mobile */
                    .doc-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; padding: 8px !important; }
                    .doc-shimmer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
                    .doc-empty { padding: 48px 24px; }
                    .doc-empty-icon { width: 60px; height: 60px; font-size: 1.6rem; }
                    .doc-lightbox-panel { border-radius: 20px 20px 0 0; max-height: 95vh; overflow-y: auto; }
                }
            `}</style>
            <MaintenanceBanner pageKey="maintenance_piket">{null}</MaintenanceBanner>
            {viewer}
        </>
    );
}

