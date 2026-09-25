'use client';
import Pagination from '@/components/ui/Pagination';

import React, { useState, useEffect, useCallback } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { getActiveTahunAjaranList } from '@/lib/tahun-ajaran-client';
import BandingTable from '../components/BandingTable';
import BandingDetailModal from '../components/BandingDetailModal';
import { BandingItem, BandingStatusCounts, fetchBandings } from '../lib/bandingApi';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Tab, { TabItem } from '@/components/ui/Tab';
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { checkFeatureAccess, parseKonfigurasiAksesClient } from '@/lib/feature-access-client';

const STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Disetujui' },
    { value: 'REJECTED', label: 'Ditolak' },
];

const MONTH_OPTIONS = [
    { value: '', label: 'Semua Bulan' },
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
];

export default function BandingPage({ user, activeTabProp, hideHeaderTab = false }: { user?: any; activeTabProp?: 'saya' | 'review'; hideHeaderTab?: boolean }) {
    const roles = (user?.roles || []).map((r: string) => String(r).toUpperCase());
    const role = String(user?.role || '').toUpperCase();
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || role === 'ADMIN';
    const isGuru = roles.includes('GURU') || role === 'GURU';
    const [reviewConfig, setReviewConfig] = useState<any>(null);

    useEffect(() => {
        let active = true;
        fetch('/api/site-settings?key=jurnal_review_banding_access_config')
            .then(res => res.json())
            .then(json => {
                if (active && json?.ok && json.data?.value) {
                    setReviewConfig(parseKonfigurasiAksesClient(json.data.value));
                }
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const isReviewer = React.useMemo(() => {
        return checkFeatureAccess(user, reviewConfig, ['OP_JURNAL']);
    }, [user, reviewConfig]);

    const initialDefaultTab = isGuru ? 'saya' : 'review';
    const [tabState, setTabState] = useTabParam<'saya' | 'review'>(initialDefaultTab, ['saya', 'review']);
    const activeTab = activeTabProp || (
        (!isGuru && tabState === 'saya') ? 'review' : tabState
    );
    const setActiveTab = (t: 'saya' | 'review') => setTabState(t);

    // Dynamic Active Academic Years Options
    const [yearOptions, setYearOptions] = useState<{ value: string; label: string }[]>([
        { value: '', label: 'Semua Tahun' }
    ]);

    useEffect(() => {
        async function loadActiveYears() {
            try {
                const activeYears = await getActiveTahunAjaranList();
                const yearsSet = new Set<string>();
                if (activeYears && activeYears.length > 0) {
                    activeYears.forEach((ta: string) => {
                        const matches = ta.match(/\b\d{4}\b/g);
                        if (matches) {
                            matches.forEach((y: string) => yearsSet.add(y));
                        }
                    });
                }

                if (yearsSet.size === 0) {
                    const curY = new Date().getFullYear();
                    yearsSet.add(String(curY - 1));
                    yearsSet.add(String(curY));
                }

                const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
                setYearOptions([
                    { value: '', label: 'Semua Tahun' },
                    ...sortedYears.map(y => ({ value: y, label: y }))
                ]);
            } catch (err) {
                console.error('[Banding] loadActiveYears error:', err);
            }
        }
        loadActiveYears();
    }, []);

    // Saya
    const [sayaBandings, setSayaBandings] = useState<BandingItem[]>([]);
    const [sayaTotal, setSayaTotal]       = useState(0);
    const [sayaCounts, setSayaCounts]     = useState<BandingStatusCounts | null>(null);
    const [sayaLoading, setSayaLoading]   = useState(true);
    const [sayaPage, setSayaPage]        = useState(1);
    const [sayaStatus, setSayaStatus]    = useState('');
    const [sayaBulan, setSayaBulan]      = useState('');
    const [sayaTahun, setSayaTahun]      = useState('');
    const [sayaSearch, setSayaSearch]    = useState('');

    // Review
    const [reviewBandings, setReviewBandings] = useState<BandingItem[]>([]);
    const [reviewTotal, setReviewTotal]       = useState(0);
    const [reviewCounts, setReviewCounts]     = useState<BandingStatusCounts | null>(null);
    const [reviewLoading, setReviewLoading]   = useState(true);
    const [reviewPage, setReviewPage]        = useState(1);
    const [reviewStatus, setReviewStatus]     = useState('');
    const [reviewBulan, setReviewBulan]       = useState('');
    const [reviewTahun, setReviewTahun]       = useState('');
    const [reviewSearch, setReviewSearch]    = useState('');

    // Detail Modal
    const [selectedBanding, setSelectedBanding] = useState<BandingItem | null>(null);
    const [showDetail, setShowDetail]           = useState(false);

    // Delete Modal (menggunakan Modal.tsx)
    const [deleteTargetId, setDeleteTargetId]     = useState<number | null>(null);
    const [deleteTargetItem, setDeleteTargetItem] = useState<BandingItem | null>(null);
    const [isDeleting, setIsDeleting]             = useState(false);

    const [limit, setLimit] = useState(10);

    const loadSaya = useCallback(async () => {
        if (!isGuru) return;
        setSayaLoading(true);
        try {
            const res = await fetchBandings({
                status: sayaStatus || undefined,
                bulan: sayaBulan || undefined,
                tahun: sayaTahun || undefined,
                q: sayaSearch || undefined,
                page: sayaPage,
                limit,
                mine: true,
                counts: true
            });
            setSayaBandings(res.bandings || []);
            setSayaTotal(res.total || 0);
            if (res.statusCounts) setSayaCounts(res.statusCounts);
        } catch (err: any) {
            console.error('[Banding] loadSaya error:', err);
            Swal.fire({ toast: true, position: 'top', icon: 'error', title: err.message || 'Gagal memuat data', showConfirmButton: false, timer: 3000 });
        } finally {
            setSayaLoading(false);
        }
    }, [isGuru, sayaStatus, sayaBulan, sayaTahun, sayaSearch, sayaPage]);

    const loadReview = useCallback(async () => {
        setReviewLoading(true);
        try {
            const res = await fetchBandings({
                status: reviewStatus || undefined,
                bulan: reviewBulan || undefined,
                tahun: reviewTahun || undefined,
                q: reviewSearch || undefined,
                page: reviewPage,
                limit,
                counts: true
            });
            setReviewBandings(res.bandings || []);
            setReviewTotal(res.total || 0);
            if (res.statusCounts) setReviewCounts(res.statusCounts);
        } catch (err: any) {
            console.error('[Banding] loadReview error:', err);
            Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Gagal memuat data', showConfirmButton: false, timer: 3000 });
        } finally {
            setReviewLoading(false);
        }
    }, [reviewStatus, reviewBulan, reviewTahun, reviewSearch, reviewPage]);

    useEffect(() => {
        if (activeTab === 'saya' && isGuru) {
            loadSaya();
        }
    }, [loadSaya, activeTab, isGuru]);

    useEffect(() => {
        if (activeTab === 'review') {
            loadReview();
        }
    }, [loadReview, activeTab]);

    const handleRowClick = (b: BandingItem) => {
        setSelectedBanding(b);
        setShowDetail(true);
    };

    const sayaPages = Math.ceil(sayaTotal / limit);
    const reviewPages = Math.ceil(reviewTotal / limit);
    const pendingReview = reviewCounts?.PENDING ?? 0;

    const stats = [
        {
            label: 'Total Banding',
            value: reviewCounts?.total ?? reviewTotal,
            icon: 'bi-folder2-open',
            cls: 'bp__statTotal',
            statusKey: '',
        },
        {
            label: 'Pending',
            value: reviewCounts?.PENDING ?? 0,
            icon: 'bi-clock-history',
            cls: 'bp__statPending',
            statusKey: 'PENDING',
        },
        {
            label: 'Disetujui',
            value: reviewCounts?.APPROVED ?? 0,
            icon: 'bi-check-circle-fill',
            cls: 'bp__statApproved',
            statusKey: 'APPROVED',
        },
        {
            label: 'Ditolak',
            value: reviewCounts?.REJECTED ?? 0,
            icon: 'bi-x-circle-fill',
            cls: 'bp__statRejected',
            statusKey: 'REJECTED',
        },
    ];

    const handleDeletePrompt = (id: number) => {
        const item = (activeTab === 'saya' ? sayaBandings : reviewBandings).find(b => b.id === id);
        setDeleteTargetId(id);
        setDeleteTargetItem(item || null);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/jurnal/banding/${deleteTargetId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus data');

            Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Data berhasil dihapus', showConfirmButton: false, timer: 2000 });
            setDeleteTargetId(null);
            setDeleteTargetItem(null);
            loadSaya();
            loadReview();
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
        } finally {
            setIsDeleting(false);
        }
    };

    const tabItems: TabItem<'saya' | 'review'>[] = React.useMemo(() => {
        const items: TabItem<'saya' | 'review'>[] = [];
        if (isGuru) {
            items.push({ key: 'saya', label: 'Banding Saya', icon: 'person-badge' });
        }
        if (isReviewer || isAdmin) {
            items.push({
                key: 'review',
                label: pendingReview > 0 ? `Review Banding (${pendingReview})` : 'Review Banding',
                icon: 'shield-check'
            });
        }
        return items;
    }, [isGuru, isReviewer, isAdmin, pendingReview]);

    return (
        <MaintenanceBanner pageKey="maintenance_jurnal_banding" isAdmin={isAdmin}>
        <div className="bp__wrap font-sans">
            {/* ===== PAGE BANNER ===== */}
            

            {/* ===== TAB NAVIGATION ===== */}
            {!hideHeaderTab && (
                <Tab
                    tabs={tabItems}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Navigasi Banding Jurnal"
                    variant="slider"
                />
            )}

            {activeTab === 'saya' && !isGuru ? (
                <div style={{
                    textAlign: 'center',
                    padding: '48px 20px',
                    background: 'var(--n-card)',
                    borderRadius: '16px',
                    border: '1.5px solid var(--n-border)',
                    margin: '16px 0'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        margin: '0 auto 12px'
                    }}>
                        <i className="bi bi-shield-lock-fill" />
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--n-ink)' }}>
                        Akses Terbatas
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--n-muted)' }}>
                        Tab Banding Saya hanya dapat diakses oleh akun dengan role Guru.
                    </p>
                </div>
            ) : (
                <>
            {/* ===== STAT CARDS (HANYA PADA TAB REVIEW BANDING) ===== */}
            {activeTab === 'review' && (
                <div className="bp__statsGrid">
                    {stats.map(s => {
                        const isActive = reviewStatus === s.statusKey;
                        return (
                            <div
                                key={s.label}
                                className={`bp__statCard ${s.cls} ${isActive ? 'bp__statCardActive' : ''}`}
                                onClick={() => {
                                    setReviewStatus(s.statusKey);
                                    setReviewPage(1);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        setReviewStatus(s.statusKey);
                                        setReviewPage(1);
                                    }
                                }}
                                title={`Klik untuk memfilter status: ${s.label}`}
                            >
                                <div className="bp__statIcon"><i className={`bi ${s.icon}`} /></div>
                                <div className="bp__statInfo">
                                    <span className="bp__statValue">{s.value}</span>
                                    <span className="bp__statLabel">{s.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ===== FILTER TOOLBAR ===== */}
            <FilterToolbar
                leading={
                    !hideHeaderTab ? (
                        <button
                            type="button"
                            className="ftb-backBtn"
                            onClick={() => {
                                const newUrl = new URL(window.location.href);
                                newUrl.searchParams.set('page', 'jurnal');
                                window.history.pushState({}, '', newUrl);
                                window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'jurnal' }));
                            }}
                            title="Kembali ke Jurnal"
                            aria-label="Kembali ke Jurnal"
                        >
                            <i className="bi bi-arrow-left" />
                        </button>
                    ) : null
                }
            >
                <FilterSearch
                    label="Pencarian"
                    placeholder="Cari guru, NIP, alasan..."
                    value={activeTab === 'saya' ? sayaSearch : reviewSearch}
                    onChange={val => {
                        if (activeTab === 'saya') { setSayaSearch(val); setSayaPage(1); }
                        else { setReviewSearch(val); setReviewPage(1); }
                    }}
                    grow={2}
                />

                <FilterSelect
                    label="Status"
                    icon="funnel"
                    value={activeTab === 'saya' ? sayaStatus : reviewStatus}
                    onChange={val => {
                        if (activeTab === 'saya') { setSayaStatus(val); setSayaPage(1); }
                        else { setReviewStatus(val); setReviewPage(1); }
                    }}
                    options={STATUS_OPTIONS}
                    grow={0}
                    width={160}
                />

                <FilterSelect
                    label="Bulan"
                    icon="calendar-month"
                    value={activeTab === 'saya' ? sayaBulan : reviewBulan}
                    onChange={val => {
                        if (activeTab === 'saya') { setSayaBulan(val); setSayaPage(1); }
                        else { setReviewBulan(val); setReviewPage(1); }
                    }}
                    options={MONTH_OPTIONS}
                    grow={0}
                    width={150}
                />

                <FilterSelect
                    label="Tahun"
                    icon="calendar3"
                    value={activeTab === 'saya' ? sayaTahun : reviewTahun}
                    onChange={val => {
                        if (activeTab === 'saya') { setSayaTahun(val); setSayaPage(1); }
                        else { setReviewTahun(val); setReviewPage(1); }
                    }}
                    options={yearOptions}
                    grow={0}
                    width={165}
                />


            </FilterToolbar>

            {/* ===== CONTENT ===== */}
            <div className="bp__content">
                <BandingTable
                    bandings={activeTab === 'saya' ? sayaBandings : reviewBandings}
                    isReviewer={isReviewer}
                    onRowClick={handleRowClick}
                    onDelete={handleDeletePrompt}
                    loading={activeTab === 'saya' ? sayaLoading : reviewLoading}
                />
            </div>

            {/* ===== PAGINATION ===== */}
            {(activeTab === 'saya' ? sayaPages : reviewPages) > 1 && (
                <div className="bp__pagination">
                    <button
                        className="bp__pageBtn"
                        onClick={() => activeTab === 'saya' ? setSayaPage(p => Math.max(1, p - 1)) : setReviewPage(p => Math.max(1, p - 1))}
                        disabled={activeTab === 'saya' ? sayaPage === 1 : reviewPage === 1}
                    >
                        <i className="bi bi-chevron-left" />
                    </button>
                    <div className="bp__pageDots">
                        {Array.from({ length: Math.min((activeTab === 'saya' ? sayaPages : reviewPages), 5) }, (_, i) => {
                            const pNum = i + 1;
                            const curr = activeTab === 'saya' ? sayaPage : reviewPage;
                            return (
                                <button
                                    key={pNum}
                                    className={`bp__pageDot ${curr === pNum ? 'bp__pageDotActive' : ''}`}
                                    onClick={() => activeTab === 'saya' ? setSayaPage(pNum) : setReviewPage(pNum)}
                                >
                                    {pNum}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        className="bp__pageBtn"
                        onClick={() => activeTab === 'saya' ? setSayaPage(p => Math.min(sayaPages, p + 1)) : setReviewPage(p => Math.min(reviewPages, p + 1))}
                        disabled={activeTab === 'saya' ? sayaPage === sayaPages : reviewPage === reviewPages}
                    >
                        <i className="bi bi-chevron-right" />
                    </button>
                </div>
            )}
            </>
            )}


            {/* ===== MODAL DETAIL ===== */}
            <BandingDetailModal
                open={showDetail}
                isOpen={showDetail}
                onClose={() => { setShowDetail(false); setSelectedBanding(null); }}
                item={selectedBanding}
                banding={selectedBanding}
                isReviewer={isReviewer}
                user={user}
                onSuccess={() => {
                    loadSaya();
                    loadReview();
                }}
                onReviewed={() => {
                    loadSaya();
                    loadReview();
                }}
            />

            {/* ===== MODAL HAPUS (MENGGUNAKAN Modal.tsx) ===== */}
            <Modal
                open={deleteTargetId !== null}
                onClose={() => { if (!isDeleting) { setDeleteTargetId(null); setDeleteTargetItem(null); } }}
                variant="delete"
                size="sm"
                title="Hapus Data Banding"
                icon="trash-fill"
            >
                <ModalBody>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--n-ink)', lineHeight: '1.5' }}>
                        Apakah Anda yakin ingin menghapus data pengajuan banding dari <strong>{deleteTargetItem?.nama_guru || 'guru ini'}</strong>?
                    </p>

                    {deleteTargetItem?.status === 'APPROVED' && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            lineHeight: '1.4'
                        }}>
                            <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '6px' }} />
                            <strong>Perhatian:</strong> Banding ini sudah berstatus <strong>Disetujui</strong>. Menghapus data ini hanya menghapus riwayat log banding, tetapi <u>isi data jurnal yang telah diperbaiki akan tetap tersimpan</u> di sistem.
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" onClick={() => { setDeleteTargetId(null); setDeleteTargetItem(null); }} disabled={isDeleting}>
                        Batal
                    </Button>
                    <Button variant="danger" isLoading={isDeleting} onClick={confirmDelete}>
                        Ya, Hapus
                    </Button>
                </ModalFooter>
            </Modal>
        </div>

        <style jsx>{`
            .bp__wrap {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding-bottom: 30px;
            }

            .bp__statsGrid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 14px;
            }

            .bp__statCard {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 16px 20px;
                border-radius: 16px;
                background: var(--n-card);
                border: 1.5px solid var(--n-border);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
            }

            .bp__statCard:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                border-color: var(--n-primary);
            }

            .bp__statCardActive {
                border-color: var(--n-primary) !important;
                background: var(--n-soft) !important;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
            }

            .bp__statIcon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
                flex-shrink: 0;
            }

            .bp__statTotal .bp__statIcon { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
            .bp__statPending .bp__statIcon { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
            .bp__statApproved .bp__statIcon { background: rgba(16, 185, 129, 0.12); color: #10b981; }
            .bp__statRejected .bp__statIcon { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

            .bp__statInfo {
                display: flex;
                flex-direction: column;
            }

            .bp__statValue {
                font-size: 1.4rem;
                font-weight: 800;
                color: var(--n-ink);
                line-height: 1.2;
            }

            .bp__statLabel {
                font-size: 0.78rem;
                font-weight: 600;
                color: var(--n-muted);
            }

            .bp__resultCount {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                height: 38px;
                font-size: 0.82rem;
                font-weight: 650;
                color: var(--n-ink);
                padding: 0 14px;
                border-radius: 10px;
                background: var(--n-soft);
                border: 1.5px solid var(--n-border);
                box-sizing: border-box;
                white-space: nowrap;
            }

            .bp__resultCount i {
                color: var(--n-primary);
                font-size: 0.9rem;
            }

            .bp__content {
                width: 100%;
            }

            .bp__pagination {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                margin-top: 10px;
            }

            .bp__pageBtn {
                width: 36px;
                height: 36px;
                border-radius: 10px;
                border: 1px solid var(--n-border);
                background: var(--n-card);
                color: var(--n-ink);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.85rem;
                transition: all 0.2s;
                font-weight: 700;
            }

            .bp__pageBtn:hover:not(:disabled) {
                background: var(--n-primary);
                color: white;
                border-color: var(--n-primary);
            }

            .bp__pageBtn:disabled {
                opacity: 0.35;
                cursor: not-allowed;
            }

            .bp__pageDots {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .bp__pageDot {
                width: 34px;
                height: 34px;
                border-radius: 8px;
                border: 1px solid transparent;
                background: transparent;
                color: var(--n-muted);
                font-size: 0.82rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
            }

            .bp__pageDot:hover {
                background: var(--n-soft);
                color: var(--n-primary);
            }

            .bp__pageDotActive {
                background: var(--n-primary) !important;
                color: white !important;
                border-color: var(--n-primary);
            }

            .bp__infoNote {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 18px;
                border-radius: 14px;
                background: rgba(59, 130, 246, 0.08);
                border: 1px solid rgba(59, 130, 246, 0.2);
                color: var(--n-primary);
                font-size: 0.82rem;
                line-height: 1.5;
                font-weight: 550;
            }

            .bp__infoNote i {
                font-size: 1.1rem;
                flex-shrink: 0;
                margin-top: 1px;
            }

            @media (max-width: 768px) {
                .bp__statsGrid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                .bp__statCard {
                    padding: 12px 14px;
                    gap: 10px;
                }
                .bp__statValue {
                    font-size: 1.2rem;
                }
                .bp__statIcon {
                    width: 38px;
                    height: 38px;
                    font-size: 1rem;
                }
            }
        `}</style>
        </MaintenanceBanner>
    );
}
