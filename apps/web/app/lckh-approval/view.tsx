'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { swalSuccess, swalError, swalInfo, swalWarning, swalConfirm } from '@/lib/swal-premium';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { hasPermission } from '@/lib/permissions-client';
import { useModalBlur } from '@/components/ModalBlurProvider';
import './lckh-approval.css';

export default function LckhApprovalPage() {
    const [loading, setLoading] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);

    // Filters
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail View
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [reviewerNote, setReviewerNote] = useState('');
    const [saving, setSaving] = useState(false);

    // Modals
    const [previewModule, setPreviewModule] = useState<string | null>(null);
    const [showNilaiModal, setShowNilaiModal] = useState(false);
    const [nilaiDetailQuery, setNilaiDetailQuery] = useState<any>(null);
    const [nilaiStudents, setNilaiStudents] = useState<any[]>([]);
    const [loadingNilai, setLoadingNilai] = useState(false);

    const [showJurnalModal, setShowJurnalModal] = useState(false);
    const [activeJurnal, setActiveJurnal] = useState<any>(null);

    const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
    const [assignmentRoles, setAssignmentRoles] = useState<string[]>([]);
    const [detailAbsensiPerClass, setDetailAbsensiPerClass] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [absensiClassFilter, setAbsensiClassFilter] = useState<string>('');
    const [absensiMonthFilter, setAbsensiMonthFilter] = useState<number>(0); // index into monthGroups

    const { openModal, closeModal } = useModalBlur();

    useEffect(() => {
        if (showNilaiModal || showJurnalModal) {
            openModal();
        } else {
            closeModal();
        }
    }, [showNilaiModal, showJurnalModal]);

    const userRoles = useMemo(() => {
        if (!user) return [];
        const list = Array.isArray(user.roles) ? [...user.roles] : [user.role || ''];
        if (user.jabatan) list.push(user.jabatan);
        if (user.role) list.push(user.role);
        return list.filter(Boolean).map((r: string) => r.toString().toUpperCase());
    }, [user]);

    const isAdmin = useMemo(() => userRoles.some(r => r.includes('ADMIN')), [userRoles]);
    const isWkmAkademik = useMemo(() => userRoles.some(r => r.includes('WKM_AKADEMIK') || r.includes('WAKA_AKADEMIK')), [userRoles]);
    const isWkmKesiswaan = useMemo(() => userRoles.some(r => r.includes('WKM_KESISWAAN') || r.includes('WAKA_KESISWAAN')), [userRoles]);
    const isWaka = useMemo(() => isWkmAkademik || isWkmKesiswaan || userRoles.some(r => r.includes('WAKA') || r.includes('WKM')), [isWkmAkademik, isWkmKesiswaan, userRoles]);
    const isKamad = useMemo(() => userRoles.some(r => r.includes('KAMAD') || r.includes('KEPALA')), [userRoles]);

    // WKM tanpa hak admin/kamad tunduk pada routing approver per tugas tambahan guru.
    const isRestrictedWkm = useMemo(
        () => !isAdmin && !isKamad && (isWkmAkademik || isWkmKesiswaan),
        [isAdmin, isKamad, isWkmAkademik, isWkmKesiswaan]
    );

    // Semua tugas tambahan guru disetujui langsung Kepala Madrasah → tahap WKM dilewati,
    // Kamad menyetujui langsung dari status Submitted.
    const kamadDirect = useMemo(
        () => assignmentRoles.length > 0 && assignmentRoles.every(r => r === 'KEPALA_MADRASAH'),
        [assignmentRoles]
    );

    // Apakah WKM yang login berwenang menyetujui laporan guru terpilih.
    // Tanpa tugas tambahan atau ada tugas SEMUA_WKM => kedua WKM boleh (union).
    const wkmApprovalAllowed = useMemo(() => {
        if (!isRestrictedWkm) return true;
        if (kamadDirect) return false;
        if (assignmentRoles.length === 0) return true;
        if (assignmentRoles.includes('SEMUA_WKM')) return true;
        if (isWkmAkademik && assignmentRoles.includes('WKM_AKADEMIK')) return true;
        if (isWkmKesiswaan && assignmentRoles.includes('WKM_KESISWAAN')) return true;
        return false;
    }, [isRestrictedWkm, kamadDirect, assignmentRoles, isWkmAkademik, isWkmKesiswaan]);

    const canDo = useCallback((action: string) => {
        if (isAdmin || isWaka || isKamad) return true;
        return hasPermission(user?.permissions || [], 'lckh_approval', action, isAdmin);
    }, [isAdmin, isWaka, isKamad, user?.permissions]);

    useEffect(() => {
        const init = async () => {
            try {
                const meRes = await fetch('/api/auth/me');
                const meData = await meRes.json();
                if (meData.ok && meData.user) {
                    setUser(meData.user);

                    // Fetch Periods
                    const pRes = await fetch('/api/lckh/periods');
                    const pJson = await pRes.json().catch(() => null);
                    const pData = pJson?.data || [];

                    if (Array.isArray(pData) && pData.length > 0) {
                        setPeriods(pData);
                        setSelectedPeriod(pData[0].periode_kode);
                    }
                }
            } catch (err) {
                console.error('Error init in lckh-approval:', err);
            }
        };
        init();
    }, []);

    // Fetch Submissions
    const fetchSubmissions = async (pCode: string) => {
        setLoading(true);
        try {
            let url = `/api/lckh/submissions?periode_kode=${encodeURIComponent(pCode)}`;
            if (filterStatus !== 'ALL') {
                url += `&status=${encodeURIComponent(filterStatus)}`;
            }
            const res = await fetch(url);
            const json = await res.json();
            if (json.ok && Array.isArray(json.data)) {
                setSubmissions(json.data.filter((s: any) => s.status !== 'Draft'));
            }
        } catch { }
        setLoading(false);
    }

    // Refresh when filter changes
    useEffect(() => {
        if (user && selectedPeriod) {
            fetchSubmissions(selectedPeriod);
            setSelectedItem(null);
        }
    }, [filterStatus, selectedPeriod, user]);

    // Fetch approval history when item selected
    useEffect(() => {
        if (selectedItem?.id) {
            fetch(`/api/lckh/approvals/${selectedItem.id}`)
                .then(r => r.json())
                .then(json => {
                    if (json.ok && Array.isArray(json.data)) {
                        setApprovalHistory(json.data);
                    }
                })
                .catch(() => setApprovalHistory([]));

            // Ambil tugas tambahan guru untuk menentukan WKM penyetuju
            setAssignmentRoles([]);
            if (selectedItem.nip) {
                fetch(`/api/tugas-tambahan?nip=${encodeURIComponent(selectedItem.nip)}`)
                    .then(r => r.json())
                    .then(json => {
                        if (json.ok && Array.isArray(json.data)) {
                            setAssignmentRoles(json.data.map((t: any) => t.approver_role || 'SEMUA_WKM'));
                        }
                    })
                    .catch(() => {});
            }

            // Fetch detailed absensi data for the submission's period
            setLoadingDetail(true);
            setDetailAbsensiPerClass([]);
            const pData = periods.find(p => p.periode_kode === selectedItem.periode_kode);
            if (pData && selectedItem.nip) {
                fetch(`/api/lckh/summary?startDate=${pData.tgl_awal}&endDate=${pData.tgl_akhir}&nip=${selectedItem.nip}&month=0&year=0`)
                    .then(r => r.json())
                    .then(json => {
                        if (json.ok && json.data.detail_absensi_per_class) {
                            setDetailAbsensiPerClass(json.data.detail_absensi_per_class);
                            if (json.data.detail_absensi_per_class.length > 0) {
                                setAbsensiClassFilter(json.data.detail_absensi_per_class[0].kelas);
                                setAbsensiMonthFilter(0);
                            }
                        }
                    })
                    .catch(() => {})
                    .finally(() => setLoadingDetail(false));
            } else {
                setLoadingDetail(false);
            }
        } else {
            setApprovalHistory([]);
            setAssignmentRoles([]);
            setDetailAbsensiPerClass([]);
            setAbsensiClassFilter('');
        }
    }, [selectedItem?.id]);

    const handleApprove = async () => {
        if (!selectedItem || !user) return;

        let nextStatus = '';
        const current = selectedItem.status;

        if (current === 'Submitted') {
            if (kamadDirect) {
                // Tugas tambahan guru ini disetujui langsung Kamad: lompat ke pengesahan akhir
                if (isKamad || isAdmin) {
                    nextStatus = 'Approved_Kamad';
                } else {
                    swalError(
                        'Bukan Kewenangan Anda',
                        'Laporan guru ini disetujui langsung oleh Kepala Madrasah (tanpa tahap WKM) sesuai jenis tugas tambahannya. Pengaturan penyetuju ada di Pengaturan Tugas → Ploting Tugas.'
                    );
                    return;
                }
            }
            else if (isWaka || isKamad || isAdmin || canDo('approve')) {
                if (isRestrictedWkm && !wkmApprovalAllowed) {
                    swalError(
                        'Bukan Kewenangan Anda',
                        'Laporan guru ini disetujui oleh WKM lain sesuai jenis tugas tambahannya. Pengaturan penyetuju ada di Pengaturan Tugas → Ploting Tugas.'
                    );
                    return;
                }
                nextStatus = 'Approved_Waka';
            }
            else {
                swalError('Akses Ditolak', 'Hanya WKM Akademik / WKM Kesiswaan / Kamad / Admin yang dapat melakukan persetujuan.');
                return;
            }
        } else if (current === 'Approved_Waka') {
            if (isKamad || isWaka || isAdmin || canDo('approve')) nextStatus = 'Approved_Kamad';
            else {
                swalError('Akses Ditolak', 'Hanya Kepala Madrasah / Admin yang dapat melakukan pengesahan akhir.');
                return;
            }
        } else {
            swalWarning('Status Invalid', `Status dokumen ${current} tidak dapat disetujui.`);
            return;
        }

        const confirm = await swalConfirm({
            title: 'Setujui Laporan?',
            text: `Anda akan memberikan persetujuan untuk laporan ${selectedItem.nama_guru_snap}.`,
            icon: 'question',
            confirmText: 'Ya, Setujui',
            cancelText: 'Batal',
            confirmColor: '#3083FF'
        });

        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            let approvalCode = null;
            if (nextStatus === 'Approved_Kamad') {
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                const nipSafe = selectedItem.nip ? selectedItem.nip.replace(/[^0-9]/g, '').substring(0, 6) : 'NONIP';
                approvalCode = `LCKH-${selectedItem.periode_kode}-${nipSafe}-${randomSuffix}`;
            }

            const updatePayload: any = {
                status: nextStatus,
                catatan_reviewer: reviewerNote,
                updated_at: new Date().toISOString()
            };

            if (nextStatus === 'Approved_Kamad' && approvalCode) {
                updatePayload.approval_code = approvalCode;
                updatePayload.full_approved_at = new Date().toISOString();
                updatePayload.approved_by_kamad = user.id;
            } else if (nextStatus === 'Approved_Waka') {
                updatePayload.approved_by_waka = user.id;
            }

            const approveRes = await fetch(`/api/lckh/approvals/${selectedItem.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: nextStatus === 'Approved_Kamad' ? 'KAMAD' : (isWkmKesiswaan ? 'WKM_KESISWAAN' : 'WKM_AKADEMIK'),
                    status_approval: 'Disetujui',
                    catatan: reviewerNote,
                }),
            });
            const approveJson = await approveRes.json();
            if (!approveRes.ok || !approveJson.ok) throw new Error(approveJson.error || 'Gagal menyetujui laporan');

            swalSuccess('Berhasil', 'Laporan berhasil disetujui.');
            setSelectedItem(null);
            fetchSubmissions(selectedPeriod);
            window.dispatchEvent(new Event('refresh-lckh-notification'));
        } catch (e: any) {
            swalError('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!selectedItem) return;
        if (!reviewerNote.trim()) {
            swalWarning('Catatan Wajib', 'Harap isi alasan pengembalian/revisi.');
            return;
        }

        const confirm = await swalConfirm({
            title: 'Kembalikan Laporan?',
            text: 'Laporan akan dikembalikan ke Guru untuk diperbaiki.',
            icon: 'warning',
            confirmText: 'Ya, Kembalikan',
            cancelText: 'Batal',
            confirmColor: '#dc2626'
        });

        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            const rejectRes = await fetch(`/api/lckh/approvals/${selectedItem.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'VERIFICATOR',
                    status_approval: 'Ditolak',
                    catatan: reviewerNote,
                }),
            });
            const rejectJson = await rejectRes.json();
            if (!rejectRes.ok || !rejectJson.ok) throw new Error(rejectJson.error || 'Gagal mengembalikan laporan');

            swalInfo('Berhasil', 'Laporan telah dikembalikan.');
            setSelectedItem(null);
            fetchSubmissions(selectedPeriod);
            window.dispatchEvent(new Event('refresh-lckh-notification'));
        } catch (e: any) {
            swalError('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const getStatusStyle = (s: string) => {
        switch (s) {
            case 'Submitted': return { bg: '#eff6ff', color: '#1d4ed8', label: 'MENUNGGU WKM', icon: 'bi-hourglass-split', step: 1 };
            case 'Approved_Waka': return { bg: '#fef3c7', color: '#d97706', label: 'MENUNGGU KAMAD', icon: 'bi-hourglass-bottom', step: 2 };
            case 'Approved_Kamad': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'DISAHKAN', icon: 'bi-check-circle-fill', step: 3 };
            case 'Revisi': return { bg: '#fee2e2', color: '#dc2626', label: 'REVISI', icon: 'bi-exclamation-triangle-fill', step: 0 };
            default: return { bg: 'var(--n-surface)', color: 'var(--n-muted)', label: s, icon: 'bi-circle', step: 0 };
        }
    };

    const parsedRingkasan = useMemo(() => {
        if (!selectedItem?.catatan_guru) return [];
        try {
            const clean = selectedItem.catatan_guru.trim();
            if (clean.startsWith('[{')) return JSON.parse(clean);
            return [];
        } catch (e) {
            return [];
        }
    }, [selectedItem]);

    const openNilaiDetail = async (item: any) => {
        setNilaiDetailQuery(item);
        setShowNilaiModal(true);
        setLoadingNilai(true);
        setNilaiStudents([]);

        try {
            const params = new URLSearchParams({
                kelas: item.kelas,
                mapel: item.mapel,
                jenis: item.jenis,
                tagihan: item.tagihan || '',
                materi: item.materi_tp || item.materi || ''
            });

            const res = await fetch(`/api/lckh/nilai-detail?${params.toString()}`);
            const data = await res.json();
            if (data.ok) {
                setNilaiStudents(data.students);
            }
        } catch (e) {
            console.error('Error fetching nilai detail:', e);
        } finally {
            setLoadingNilai(false);
        }
    };

    const openJurnalDetail = (j: any) => {
        setActiveJurnal(j);
        setShowJurnalModal(true);
    };

    // Filter submissions by search
    const filteredSubmissions = useMemo(() => {
        if (!searchQuery.trim()) return submissions;
        const q = searchQuery.toLowerCase();
        return submissions.filter(s =>
            (s.nama_guru_snap || '').toLowerCase().includes(q) ||
            (s.nip || '').toLowerCase().includes(q)
        );
    }, [submissions, searchQuery]);

    // Stats counts
    const statsCount = useMemo(() => ({
        total: submissions.length,
        menungguWkm: submissions.filter(s => s.status === 'Submitted').length,
        menungguKamad: submissions.filter(s => s.status === 'Approved_Waka').length,
        disahkan: submissions.filter(s => s.status === 'Approved_Kamad').length,
        revisi: submissions.filter(s => s.status === 'Revisi').length,
    }), [submissions]);

    const [showSidebar, setShowSidebar] = useState(false);

    return (
        <>
        <div className="lckhg">
            {/* Banner Header */}
            <header className="lckhg-banner">
                <div className="lckhg-banner-title">
                    <button className="lckhg-banner-menu lckhg-mobile-only" onClick={() => setShowSidebar(!showSidebar)} title="Daftar Laporan">
                        <i className="bi bi-list"></i>
                    </button>
                    <div>
                        <h1>Approval LCKH</h1>
                        <p>
                            {selectedItem
                                ? `${selectedItem.nama_guru_snap || 'Guru'} · NIP. ${selectedItem.nip || '-'}`
                                : 'Verifikasi & Pengesahan Laporan Capaian Kinerja Harian Guru'}
                        </p>
                    </div>
                </div>
                {selectedItem?.status === 'Approved_Kamad' && selectedItem?.approval_code && (
                    <div className="lckhg-banner-actions">
                        <div className="lckhg-approval-code">
                            <i className="bi bi-qr-code"></i>
                            <span>{selectedItem.approval_code}</span>
                        </div>
                    </div>
                )}
            </header>

            <div className="lckhg-wrap">
                {showSidebar && <div className="lckhg-overlay" onClick={() => setShowSidebar(false)}></div>}

                {/* Left Panel Sidebar */}
                <aside className={`lckhg-panel-left ${showSidebar ? 'is-open' : ''}`}>
                    <div className="lckhg-pheader">
                        <div className="lckhg-pheader-top">
                            <div className="lckhg-pheader-title">
                                <i className="bi bi-shield-check"></i> Daftar Pengajuan
                            </div>
                        </div>

                        <div className="lckhg-pheader-filters">
                            <select
                                className="lckhg-select"
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                {periods.map(p => (
                                    <option key={p.periode_kode} value={p.periode_kode}>{p.periode_nama}</option>
                                ))}
                            </select>

                            <select
                                className="lckhg-select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="ALL">Semua ({statsCount.total})</option>
                                <option value="Submitted">WKM ({statsCount.menungguWkm})</option>
                                <option value="Approved_Waka">Kamad ({statsCount.menungguKamad})</option>
                                <option value="Approved_Kamad">Disahkan ({statsCount.disahkan})</option>
                                <option value="Revisi">Revisi ({statsCount.revisi})</option>
                            </select>

                            <div className="lckhg-search-wrap">
                                <i className="bi bi-search"></i>
                                <input
                                    type="text"
                                    className="lckhg-search"
                                    placeholder="Cari nama atau NIP..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submission List */}
                    <div className="lckhg-list">
                        {loading && (
                            <div className="p-4 text-center text-xs text-slate-400">Loading data...</div>
                        )}
                        {!loading && filteredSubmissions.length === 0 && (
                            <div className="lckhg-list-empty">
                                <i className="bi bi-inbox"></i>
                                Tidak ada laporan
                            </div>
                        )}
                        {filteredSubmissions.map(sub => (
                            <div
                                key={sub.id}
                                className={`submission-item ${selectedItem?.id === sub.id ? 'active' : ''}`}
                                onClick={() => {
                                    setSelectedItem(sub);
                                    setReviewerNote(sub.catatan_reviewer || '');
                                    setShowSidebar(false);
                                }}
                            >
                                <div className="lckhg-sub-item-avatar">
                                    {sub.nama_guru_snap ? sub.nama_guru_snap.charAt(0) : 'G'}
                                </div>
                                <div className="lckhg-sub-item-body">
                                    <div className="lckhg-sub-item-name">{sub.nama_guru_snap || 'Guru'}</div>
                                    <div className="lckhg-sub-item-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '2px' }}>
                                        <span className="lckhg-sub-item-nip">NIP. {sub.nip || '-'}</span>
                                        <ApprovalStepBadge status={sub.status} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Right Panel Main Content */}
                <main className="lckhg-content">
                    {selectedItem ? (
                        <>
                            <div className="lckhg-body">
                                {/* Stepper Progress Bar */}
                                <div className="lckhg-stepper">
                                    <div className={`lckhg-step ${selectedItem.status !== 'Draft' ? 'done' : 'active'}`}>
                                        <div className="lckhg-step-head">
                                            <div className="lckhg-step-dot"><i className="bi bi-check-lg"></i></div>
                                            <div className="lckhg-step-info">
                                                <div className="lckhg-step-label">Pengajuan Guru</div>
                                                <div className="lckhg-step-sub">{selectedItem.nama_guru_snap || 'Selesai'}</div>
                                            </div>
                                        </div>
                                        <div className="lckhg-step-line"></div>
                                    </div>
                                    <div className={`lckhg-step ${['Approved_Waka', 'Approved_Kamad'].includes(selectedItem.status) ? 'done' : selectedItem.status === 'Submitted' ? 'active' : 'pending'}`}>
                                        <div className="lckhg-step-head">
                                            <div className="lckhg-step-dot"><i className={`bi ${['Approved_Waka', 'Approved_Kamad'].includes(selectedItem.status) ? 'bi-check-lg' : 'bi-person-check-fill'}`}></i></div>
                                            <div className="lckhg-step-info">
                                                <div className="lckhg-step-label">Verifikasi WKM</div>
                                                <div className="lckhg-step-sub">WKM Akademik / Kesiswaan</div>
                                            </div>
                                        </div>
                                        <div className="lckhg-step-line"></div>
                                    </div>
                                    <div className={`lckhg-step ${selectedItem.status === 'Approved_Kamad' ? 'done' : selectedItem.status === 'Approved_Waka' ? 'active' : 'pending'}`}>
                                        <div className="lckhg-step-head">
                                            <div className="lckhg-step-dot"><i className={`bi ${selectedItem.status === 'Approved_Kamad' ? 'bi-check-lg' : 'bi-patch-check-fill'}`}></i></div>
                                            <div className="lckhg-step-info">
                                                <div className="lckhg-step-label">Pengesahan Kamad</div>
                                                <div className="lckhg-step-sub">Kepala Madrasah</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="lckhg-stats">
                                    <div className="lckhg-stat-item">
                                        <div className="lckhg-stat-ico jam"><i className="bi bi-clock-history"></i></div>
                                        <div className="lckhg-stat-meta">
                                            <div className="lckhg-stat-value">{selectedItem.snap_total_jam_mengajar || 0}</div>
                                            <div className="lckhg-stat-label">Total Jam Mengajar</div>
                                        </div>
                                    </div>
                                    <div className="lckhg-stat-item">
                                        <div className="lckhg-stat-ico jurnal"><i className="bi bi-journal-check"></i></div>
                                        <div className="lckhg-stat-meta">
                                            <div className="lckhg-stat-value">{selectedItem.snap_ringkasan_umum?.total_jurnal_isi || 0}</div>
                                            <div className="lckhg-stat-label">Jurnal Terisi</div>
                                        </div>
                                    </div>
                                    <div className="lckhg-stat-item">
                                        <div className="lckhg-stat-ico nilai"><i className="bi bi-pencil-square"></i></div>
                                        <div className="lckhg-stat-meta">
                                            <div className="lckhg-stat-value">{selectedItem.snap_ringkasan_umum?.total_nilai_input || 0}</div>
                                            <div className="lckhg-stat-label">Input Nilai</div>
                                        </div>
                                    </div>
                                    <div className="lckhg-stat-item">
                                        <div className="lckhg-stat-ico tugas"><i className="bi bi-briefcase"></i></div>
                                        <div className="lckhg-stat-meta">
                                            <div className="lckhg-stat-value">{selectedItem.snap_ringkasan_umum?.total_tugas || selectedItem.lampiran_tugas?.length || 0}</div>
                                            <div className="lckhg-stat-label">Tugas Tambahan</div>
                                        </div>
                                    </div>
                                </div>

                                {/* ═══ Level 2 — Lampiran Laporan Module Cards (Adopted from /lckh) ═══ */}
                                <div className="flex items-center justify-between mt-6 mb-3">
                                    <div className="lckhg-section-head" style={{ margin: 0 }}>
                                        <i className="bi bi-paperclip"></i>
                                        <span>Lampiran Laporan</span>
                                    </div>
                                    <button
                                        onClick={() => window.open(`/lckh/print-lampiran?id=${selectedItem.id}`, '_blank', 'width=900,height=700,scrollbars=yes')}
                                        className="lckhg-btn-detail"
                                        style={{ background: 'var(--lckhg-surface)', border: '1px solid var(--lckhg-border)' }}
                                        title="Cetak Lampiran Data LCKH"
                                    >
                                        <i className="bi bi-printer-fill text-blue-600"></i>
                                        <span>Cetak Lampiran Data</span>
                                    </button>
                                </div>

                                <section className="lckhg-modules mb-6">
                                    {[
                                        {
                                            id: 'ABSENSI',
                                            label: 'Absensi Siswa',
                                            desc: 'Rekap kehadiran harian siswa per kelas',
                                            icon: 'bi-people-fill',
                                            type: 'primary',
                                            count: detailAbsensiPerClass.length || selectedItem?.lampiran_absensi?.length || 0,
                                        },
                                        {
                                            id: 'JURNAL',
                                            label: 'Jurnal Mengajar',
                                            desc: 'Catatan materi & agenda pembelajaran',
                                            icon: 'bi-journal-text',
                                            type: 'emerald',
                                            count: selectedItem?.lampiran_jurnal?.length || 0,
                                        },
                                        {
                                            id: 'NILAI',
                                            label: 'Input Nilai',
                                            desc: 'Capaian akademik & nilai siswa',
                                            icon: 'bi-pencil-square',
                                            type: 'amber',
                                            count: selectedItem?.lampiran_nilai?.length || 0,
                                        },
                                        {
                                            id: 'TUGAS',
                                            label: 'Tugas Tambahan',
                                            desc: 'Lampiran SK & tugas tambahan guru',
                                            icon: 'bi-briefcase-fill',
                                            type: 'blue',
                                            count: selectedItem?.lampiran_tugas?.length || 0,
                                        },
                                    ].map(m => (
                                        <div key={m.id} className="lckhg-module-card">
                                            <div className={`lckhg-module-icon ${m.type}`}>
                                                <i className={`bi ${m.icon}`}></i>
                                            </div>
                                            <div className="lckhg-module-info">
                                                <div className="lckhg-module-title">{m.label}</div>
                                                <div className="lckhg-module-desc">{m.desc}</div>
                                            </div>
                                            <div className="lckhg-module-count">
                                                <div className="lckhg-module-count-val">{m.count}</div>
                                                <div className="lckhg-module-count-lbl">entri</div>
                                            </div>
                                            <div className="lckhg-module-actions">
                                                <button onClick={() => setPreviewModule(m.id)} className="lckhg-btn-detail">
                                                    <i className="bi bi-eye"></i>
                                                    Detail
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                {/* 5. Ringkasan Capaian Kinerja */}
                                <div className="lckhg-section-head">
                                    <i className="bi bi-list-task"></i> Ringkasan Capaian Kinerja
                                </div>
                                <table className="table-premium">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>No</th>
                                            <th style={{ width: '15%' }}>Tanggal</th>
                                            <th style={{ width: '30%' }}>Nama Kegiatan</th>
                                            <th style={{ width: '30%' }}>Hasil Capaian</th>
                                            <th style={{ width: '20%' }}>Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRingkasan.length > 0 ? parsedRingkasan.map((r: any, i: number) => (
                                            <tr key={i}>
                                                <td className="text-center font-bold">{i + 1}</td>
                                                <td>{r.dateStr || '-'}</td>
                                                <td className="font-bold">{r.activity}</td>
                                                <td>{r.result}</td>
                                                <td>{r.note || '-'}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={5} className="text-center py-4 text-slate-400">Tidak ada data ringkasan</td></tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Catatan Reviewer */}
                                <div className="lckha-notes-card">
                                    <div className="lckhg-section-head" style={{ margin: '0 0 8px' }}>
                                        <i className="bi bi-chat-left-text"></i> Catatan Reviewer
                                    </div>
                                    <textarea
                                        className="lckha-textarea"
                                        placeholder="Berikan catatan perbaikan atau apresiasi..."
                                        value={reviewerNote}
                                        onChange={(e) => setReviewerNote(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            {/* Routing notice: pengguna tidak berwenang atas laporan ini */}
                            {selectedItem.status === 'Submitted' && kamadDirect && !isKamad && !isAdmin ? (
                                <div className="lckha-routing-note">
                                    <i className="bi bi-info-circle-fill"></i>
                                    <span>Laporan ini disetujui langsung oleh Kepala Madrasah tanpa tahap WKM, sesuai tugas tambahan guru (diatur di Ploting Tugas).</span>
                                </div>
                            ) : selectedItem.status === 'Submitted' && isRestrictedWkm && !wkmApprovalAllowed && (
                                <div className="lckha-routing-note">
                                    <i className="bi bi-info-circle-fill"></i>
                                    <span>Laporan ini bukan kewenangan WKM Anda. Persetujuan tahap ini ditangani WKM lain sesuai tugas tambahan guru (diatur di Ploting Tugas).</span>
                                </div>
                            )}

                            {/* Action Footer */}
                            <footer className="lckha-actions">
                                <button
                                    className="lckha-reject-btn"
                                    onClick={handleReject}
                                    disabled={saving || !['Submitted', 'Approved_Waka'].includes(selectedItem.status) || !canDo('approve')}
                                >
                                    {saving ? <div className="lckha-spinner"><span></span></div> : (
                                        <><i className="bi bi-arrow-return-left"></i> KEMBALIKAN / REVISI</>
                                    )}
                                </button>
                                <button
                                    className="lckha-approve-btn"
                                    onClick={handleApprove}
                                    disabled={saving || !['Submitted', 'Approved_Waka'].includes(selectedItem.status) || !canDo('approve') || (selectedItem.status === 'Submitted' && isRestrictedWkm && !wkmApprovalAllowed) || (selectedItem.status === 'Submitted' && kamadDirect && !isKamad && !isAdmin)}
                                >
                                    {saving ? <div className="lckha-spinner"><span></span></div> : (
                                        <><i className="bi bi-check2"></i> SETUJUI LAPORAN</>
                                    )}
                                </button>
                            </footer>
                        </>
                    ) : (
                        <div className="lckhg-empty-state">
                            <div className="lckhg-empty-icon">
                                <i className="bi bi-file-earmark-check"></i>
                            </div>
                            <h3 className="lckhg-empty-title">Belum Ada Laporan Terpilih</h3>
                            <p className="lckhg-empty-desc">Pilih salah satu laporan di daftar sebelah kiri untuk meninjau detail dan melakukan verifikasi.</p>
                        </div>
                    )}
                </main>
            </div>
            <MaintenanceBanner pageKey="maintenance_lckh_approval" />
        </div>

            {/* Modals */}
        {previewModule && typeof document !== 'undefined' && createPortal(
            <ModulePreviewModal
                moduleCode={previewModule}
                data={{
                    ...selectedItem,
                    detail_absensi_per_class: detailAbsensiPerClass,
                    rekap_absensi_siswa: selectedItem?.lampiran_absensi || [],
                    detail_jurnal: selectedItem?.lampiran_jurnal || [],
                    detail_nilai: selectedItem?.lampiran_nilai || [],
                    detail_tugas: selectedItem?.lampiran_tugas || []
                }}
                onClose={() => setPreviewModule(null)}
            />,
            document.body
        )}
        {showNilaiModal && typeof document !== 'undefined' && createPortal(
            <div className="lckha-modal-overlay">
                <div className="lckha-modal-card">
                    <header className="lckha-modal-header">
                        <div>
                            <h3 className="font-black text-slate-800 uppercase">{nilaiDetailQuery?.jenis} - {nilaiDetailQuery?.kelas}</h3>
                            <p className="lckha-modal-subtitle">{nilaiDetailQuery?.mapel} • {nilaiDetailQuery?.tagihan || nilaiDetailQuery?.materi_tp}</p>
                        </div>
                        <button className="lckha-modal-close" onClick={() => setShowNilaiModal(false)}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </header>
                    <div className="lckha-modal-body">
                        {loadingNilai ? (
                            <div className="lckha-modal-loading">
                                <div className="lckha-spinner lg"><span></span></div>
                                <p>Mengambil Data Siswa...</p>
                            </div>
                        ) : (
                            <>
                                {/* Stats */}
                                {(() => {
                                    const scores = nilaiStudents.map(s => s.nilai).filter(n => n !== null && n !== undefined);
                                    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
                                    const max = scores.length ? Math.max(...scores) : '-';
                                    const min = scores.length ? Math.min(...scores) : '-';
                                    return (
                                        <div className="lckha-nilai-stats">
                                            {[
                                                { label: 'Rata-rata', value: avg, type: 'avg' },
                                                { label: 'Tertinggi', value: max, type: 'max' },
                                                { label: 'Terendah', value: min, type: 'min' },
                                            ].map((item, i) => (
                                                <div key={i} className={`lckha-nilai-stat-box ${item.type}`}>
                                                    <div className="lckha-nilai-stat-lbl">{item.label}</div>
                                                    <div className="lckha-nilai-stat-val">{item.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                                <table className="lckha-table">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            <th style={{ width: '5%' }}>No</th>
                                            <th>Nama Siswa</th>
                                            <th>NISN</th>
                                            <th className="text-center">Nilai</th>
                                            <th className="text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nilaiStudents.map((s, idx) => {
                                            const val = s.nilai;
                                            const pass = val >= 75;
                                            return (
                                                <tr key={idx}>
                                                    <td className="text-center text-slate-300 font-bold">{idx + 1}</td>
                                                    <td className="font-bold">{s.nama}</td>
                                                    <td className="lckha-td-mono">{s.nisn || '-'}</td>
                                                    <td className="text-center">
                                                        <span style={{ display: 'inline-block', minWidth: '44px', padding: '0.25rem 0.75rem', borderRadius: '8px', fontWeight: 900, fontSize: '0.875rem', background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: pass ? '#16a34a' : '#dc2626' }}>
                                                            {val !== null && val !== undefined ? val : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: pass ? '#16a34a' : '#dc2626' }}>
                                                            <i className={`bi ${pass ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                                                            {pass ? 'Lulus' : 'Remed'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </div>
            </div>,
            document.body
        )}

        {showJurnalModal && activeJurnal && typeof document !== 'undefined' && createPortal(
            <div className="lckha-modal-overlay">
                <div className="lckha-modal-card max-w-[500px]">
                    <header className="lckha-modal-header">
                        <div>
                            <h3 className="font-black text-slate-800 uppercase">Detail Jurnal Mengajar</h3>
                            <p className="lckha-modal-subtitle">{activeJurnal.kelas} • {activeJurnal.mapel}</p>
                        </div>
                        <button className="lckha-modal-close" onClick={() => setShowJurnalModal(false)}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </header>
                    <div className="lckha-modal-body p-6">
                        <div className="grid gap-4">
                            <div className="flex gap-4">
                                <div className="flex-1 lckha-info-box">
                                    <div className="lckha-info-label">Hari & Tanggal</div>
                                    <div className="font-bold">{activeJurnal.hari}, {new Date(activeJurnal.tanggal).toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
                                </div>
                                <div className="w-24 lckha-info-box text-center">
                                    <div className="lckha-info-label">Jam Ke</div>
                                    <div className="font-black text-blue-700">{activeJurnal.jam_ke}</div>
                                </div>
                            </div>
                            <div className="lckha-info-box">
                                <div className="lckha-info-label">Mata Pelajaran</div>
                                <div className="font-bold">{activeJurnal.mapel}</div>
                            </div>
                            <div className="lckha-info-box">
                                <div className="lckha-info-label">Materi</div>
                                <div className="font-bold">{activeJurnal.materi}</div>
                            </div>
                            {activeJurnal.catatan && (
                                <div className="lckha-info-box amber">
                                    <div className="lckha-info-label">Catatan Refleksi</div>
                                    <div className="italic text-amber-800">{activeJurnal.catatan}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    );
}

// ─── Sub-Components ────────────────────────────────────────────────────────

function ApprovalStepBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
        Submitted: {
            label: 'WKM',
            color: '#1d4ed8',
            bg: 'rgba(29, 78, 216, 0.08)',
            border: 'rgba(29, 78, 216, 0.2)',
            icon: 'bi-hourglass-split'
        },
        Approved_Waka: {
            label: 'Kamad',
            color: '#b45309',
            bg: 'rgba(217, 119, 6, 0.1)',
            border: 'rgba(217, 119, 6, 0.25)',
            icon: 'bi-hourglass-split'
        },
        Approved_Kamad: {
            label: 'Disahkan',
            color: '#2563eb',
            bg: 'rgba(37, 99, 235, 0.1)',
            border: 'rgba(37, 99, 235, 0.25)',
            icon: 'bi-check-circle-fill'
        },
        Revisi: {
            label: 'Revisi',
            color: '#b91c1c',
            bg: 'rgba(220, 38, 38, 0.1)',
            border: 'rgba(220, 38, 38, 0.25)',
            icon: 'bi-exclamation-triangle-fill'
        },
    };

    const current = config[status] || config.Submitted;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1.5px 6px',
                borderRadius: '9999px',
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.01em',
                backgroundColor: current.bg,
                color: current.color,
                border: `1px solid ${current.border}`,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                lineHeight: '1.2'
            }}
        >
            <i className={`bi ${current.icon}`} style={{ fontSize: '9px' }}></i>
            {current.label}
        </span>
    );
}

function ApprovalProgressBar({ status, history }: { status: string; history: any[] }) {
    const steps = [
        { num: 1, label: 'Pengajuan Guru', key: 'Submitted' },
        { num: 2, label: 'Verifikasi WKM', key: 'Approved_Waka' },
        { num: 3, label: 'Pengesahan Kamad', key: 'Approved_Kamad' },
    ];

    const currentStep = steps.findIndex(s => s.key === status);
    const isRevisi = status === 'Revisi';

    return (
        <div className="lckha-progress-bar">
            {steps.map((step, i) => {
                const isDone = i < currentStep || status === 'Approved_Kamad';
                const isActive = i === currentStep && !isRevisi;
                const approver = history.find(h => (step.num === 2 ? ['WAKA', 'WKM_AKADEMIK', 'WKM_KESISWAAN'].includes(h.level) : h.level === 'KAMAD') && h.status_approval === 'APPROVED');

                return (
                    <div key={step.num} className="lckha-progress-step">
                        <div className={`lckha-progress-node ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                            {isDone ? <i className="bi bi-check"></i> : step.num}
                        </div>
                        <div className="lckha-progress-label">{step.label}</div>
                        {approver && (
                            <div className="lckha-progress-approver">
                                <i className="bi bi-person-check"></i>
                                {approver.approver_name}
                            </div>
                        )}
                        {i < steps.length - 1 && (
                            <div className={`lckha-progress-line ${isDone ? 'done' : ''}`}></div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ModulePreviewModal({ moduleCode, data, onClose }: any) {
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(0);
    const [nilaiNestedOpen, setNilaiNestedOpen] = useState(false);
    const [nilaiNestedData, setNilaiNestedData] = useState<any>(null);
    const [nilaiNestedLoading, setNilaiNestedLoading] = useState(false);
    const [nilaiNestedError, setNilaiNestedError] = useState<string | null>(null);

    useEffect(() => {
        if (moduleCode === 'ABSENSI' && data?.detail_absensi_per_class?.length > 0) {
            setSelectedClass(data.detail_absensi_per_class[0].kelas);
        } else if (moduleCode === 'ABSENSI' && data?.rekap_absensi_siswa?.length > 0) {
            setSelectedClass(data.rekap_absensi_siswa[0].kelas);
        }
    }, [data, moduleCode]);

    if (!data || !moduleCode) return null;

    const getModuleConfig = () => {
        switch (moduleCode) {
            case 'JURNAL':
                return { title: 'Detail Jurnal & Agenda', icon: 'bi-journal-richtext' };
            case 'ABSENSI':
                return { title: 'Rekap Absensi Siswa', icon: 'bi-people-fill' };
            case 'TUGAS':
                return { title: 'Tugas Tambahan', icon: 'bi-briefcase-fill' };
            case 'NILAI':
                return { title: 'Dashboard Capaian Akademik', icon: 'bi-award-fill' };
            default:
                return { title: 'Detail', icon: 'bi-info-circle' };
        }
    };

    const config = getModuleConfig();
    const rekapClasses = (data.rekap_absensi_siswa?.map((i: any) => i.kelas) || []);
    const currentClass = selectedClass || (rekapClasses.length > 0 ? rekapClasses[0] : '');

    return (
        <div className="lckhg-modal-overlay animate-fade-in" onClick={onClose} style={{ zIndex: 99999 }}>
            <div className="lckhg-modal animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px', width: '95%' }}>
                <header className="modal-header">
                    <div className="lckhg-modal-head-content">
                        <div className="lckhg-modal-icon blue">
                            <i className={`bi ${config.icon}`}></i>
                        </div>
                        <div className="lckhg-modal-text">
                            <h3>{config.title}</h3>
                            <span>Data LCKH yang diajukan</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="lckhg-modal-close">
                        <i className="bi bi-x-lg"></i>
                    </button>
                </header>

                <div className="lckhg-modal-body custom-scrollbar">
                    {/* JURNAL Module */}
                    {moduleCode === 'JURNAL' && (
                        <div>
                            <div className="lckhg-table-container">
                                <table className="table-premium">
                                    <thead>
                                        <tr>
                                            <th>Tanggal & Kelas</th>
                                            <th>Mata Pelajaran</th>
                                            <th>Materi</th>
                                            <th className="text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.detail_jurnal || []).length > 0 ? (
                                            data.detail_jurnal.map((j: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="">{new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</div>
                                                        <div className="text-xs" style={{ color: 'var(--lckhg-text-subtle)' }}>Kelas {j.kelas}</div>
                                                    </td>
                                                    <td>
                                                        <div className="">{j.mata_pelajaran || j.mapel}</div>
                                                        <div className="text-xs" style={{ color: 'var(--lckhg-accent)' }}>Jam Ke-{j.jam_ke || '-'}</div>
                                                    </td>
                                                    <td className="">
                                                        {j.materi || <span style={{ color: 'var(--lckhg-text-subtle)', fontStyle: 'italic' }}>Belum diisi</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge ${j.materi ? 'badge-success' : 'badge-warning'}`}>
                                                            {j.materi ? 'Verified' : 'Pending'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="table-empty">Data jurnal tidak ditemukan.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ABSENSI Module - Detailed Matrix View */}
                    {moduleCode === 'ABSENSI' && (
                        <div>
                            {(() => {
                                const hasMonthly = data.detail_absensi_per_class && data.detail_absensi_per_class.length > 0;
                                return (
                                    <>
                                        <div className="lckhg-filter-bar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                                            <span className="lckhg-filter-lbl">Kelas:</span>
                                            <select
                                                value={currentClass}
                                                onChange={e => { setSelectedClass(e.target.value); setSelectedMonth(0); }}
                                                className="lckhg-filter-select"
                                            >
                                                {(data.detail_absensi_per_class || data.rekap_absensi_siswa || []).map((item: any) => (
                                                    <option key={item.kelas} value={item.kelas}>KELAS {item.kelas}</option>
                                                ))}
                                            </select>
                                            {hasMonthly && (() => {
                                                const cd = data.detail_absensi_per_class.find((c: any) => c.kelas === currentClass);
                                                if (!cd?.monthGroups?.length) return null;
                                                return (
                                                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
                                                        {cd.monthGroups.map((mg: any, mi: number) => (
                                                            <button
                                                                key={mi}
                                                                onClick={() => setSelectedMonth(mi)}
                                                                style={{
                                                                    padding: '0.3rem 0.75rem',
                                                                    borderRadius: '9999px',
                                                                    border: '1px solid',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.03em',
                                                                    ...(selectedMonth === mi
                                                                        ? { background: '#3083FF', color: 'white', borderColor: '#3083FF' }
                                                                        : { background: 'white', color: 'var(--n-muted)', borderColor: '#e2e8f0' })
                                                                }}
                                                            >
                                                                {mg.monthName}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {hasMonthly ? (() => {
                                            const cd = data.detail_absensi_per_class.find((c: any) => c.kelas === currentClass);
                                            if (!cd?.monthGroups?.length) return <div className="table-empty"><i className="bi bi-calendar-x"></i><p>Tidak ada data bulanan</p></div>;
                                            const mg = cd.monthGroups[selectedMonth] || cd.monthGroups[0];
                                            if (!mg) return <div className="table-empty"><i className="bi bi-calendar-x"></i><p>Pilih bulan</p></div>;
                                            const students = mg.students || [];
                                            const dateCols = mg.dateCols || [];
                                            const tH = students.reduce((a: number, s: any) => a + (s.totalH || 0), 0);
                                            const tS = students.reduce((a: number, s: any) => a + (s.totalS || 0), 0);
                                            const tI = students.reduce((a: number, s: any) => a + (s.totalI || 0), 0);
                                            const tA = students.reduce((a: number, s: any) => a + (s.totalA || 0), 0);

                                            return (
                                                <>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                                        {[
                                                            { label: 'Hadir', val: tH, c: '#059669', bg: 'rgba(5,150,105,0.1)' },
                                                            { label: 'Sakit', val: tS, c: '#d97706', bg: 'rgba(217,119,6,0.1)' },
                                                            { label: 'Izin', val: tI, c: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
                                                            { label: 'Alpa', val: tA, c: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                                                        ].map((item, i) => (
                                                            <div key={i} style={{ background: item.bg, border: `1px solid ${item.c}20`, borderRadius: '10px', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                                <i className={`bi ${i === 0 ? 'bi-check-all' : i === 1 ? 'bi-bandaid' : i === 2 ? 'bi-envelope-paper' : 'bi-x-circle'}`} style={{ color: item.c, fontSize: '1.125rem' }}></i>
                                                                <div>
                                                                    <div style={{ fontSize: '1.125rem', fontWeight: 900, color: item.c, lineHeight: 1 }}>{item.val}</div>
                                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: item.c, marginTop: '0.2rem' }}>{item.label}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {students.length === 0 ? (
                                                        <div className="table-empty"><i className="bi bi-people"></i><p>Tidak ada siswa</p></div>
                                                    ) : (
                                                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--lckhg-border)', boxShadow: 'var(--lckhg-shadow-sm)' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: dateCols.length > 20 ? '1200px' : '900px' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ position: 'sticky', top: 0, left: 0, background: '#3083FF', color: 'white', padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '2px solid rgba(255,255,255,0.2)', zIndex: 5, minWidth: '50px' }}>No</th>
                                                                        <th style={{ position: 'sticky', top: 0, left: '50px', background: '#3083FF', color: 'white', padding: '0.5rem 0.875rem', textAlign: 'left', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '2px solid rgba(255,255,255,0.2)', zIndex: 5, minWidth: '180px' }}>Nama Siswa</th>
                                                                        {dateCols.map((dc: any, di: number) => (
                                                                            <th key={di}
                                                                                style={{
                                                                                    position: 'sticky', top: 0,
                                                                                    background: dc.isWeekend ? '#f1f5f9' : '#f8fafc',
                                                                                    color: dc.isWeekend ? '#94a3b8' : '#475569',
                                                                                    padding: '0.375rem 0.25rem', textAlign: 'center', fontWeight: 800, fontSize: '0.6rem',
                                                                                    borderRight: '1px solid #e2e8f0', zIndex: 2, minWidth: '28px',
                                                                                    borderBottom: dc.isWeekend ? '2px solid #cbd5e1' : '1px solid #e2e8f0'
                                                                                }}
                                                                            >
                                                                                {dc.day}
                                                                            </th>
                                                                        ))}
                                                                        <th style={{ position: 'sticky', top: 0, right: '114px', background: '#059669', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px', borderLeft: '2px solid rgba(255,255,255,0.3)' }}>H</th>
                                                                        <th style={{ position: 'sticky', top: 0, right: '76px', background: '#d97706', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px' }}>S</th>
                                                                        <th style={{ position: 'sticky', top: 0, right: '38px', background: '#0ea5e9', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px' }}>I</th>
                                                                        <th style={{ position: 'sticky', top: 0, right: 0, background: '#dc2626', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px' }}>A</th>
                                                                    </tr>
                                                                    <tr>
                                                                        <th colSpan={2} style={{ position: 'sticky', top: '32px', left: 0, background: '#1e40af', color: 'rgba(255,255,255,0.7)', padding: '0.25rem 0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 4, borderBottom: '1px solid #e2e8f0', minWidth: '230px' }}></th>
                                                                        {dateCols.map((dc: any, di: number) => (
                                                                            <th key={di}
                                                                                style={{
                                                                                    position: 'sticky', top: '32px',
                                                                                    background: dc.isWeekend ? '#f1f5f9' : '#f8fafc',
                                                                                    color: dc.isWeekend ? '#94a3b8' : '#64748b',
                                                                                    padding: '0.25rem 0.25rem', textAlign: 'center', fontWeight: 700, fontSize: '0.5rem',
                                                                                    borderRight: '1px solid #e2e8f0', zIndex: 2,
                                                                                    borderBottom: '1px solid #e2e8f0'
                                                                                }}
                                                                            >
                                                                                {dc.dayName.substring(0, 3)}
                                                                            </th>
                                                                        ))}
                                                                        <th colSpan={4} style={{ position: 'sticky', top: '32px', right: 0, background: '#f8fafc', color: 'var(--n-muted)', padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em', zIndex: 3, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {students.map((st: any, idx: number) => {
                                                                        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                                                                        return (
                                                                            <tr key={idx} style={{ background: rowBg }}>
                                                                                <td style={{ position: 'sticky', left: 0, background: rowBg, padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--n-muted)', fontSize: '0.7rem', borderRight: '1px solid #e2e8f0', zIndex: 1 }}>{idx + 1}</td>
                                                                                <td style={{ position: 'sticky', left: '50px', background: rowBg, padding: '0.5rem 0.875rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--n-text)', borderRight: '1px solid #e2e8f0', zIndex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{st.nama}</td>
                                                                                {dateCols.map((dc: any, di: number) => {
                                                                                    const status = st.days?.[dc.day] || '';
                                                                                    const isWeekend = dc.isWeekend;
                                                                                    const bg = isWeekend ? '#f8f9fa' : status === 'HADIR' || status === 'H' ? 'rgba(5,150,105,0.12)' : status === 'SAKIT' || status === 'S' ? 'rgba(245,158,11,0.12)' : status === 'IZIN' || status === 'I' ? 'rgba(14,165,233,0.12)' : status === 'ALPHA' || status === 'A' ? 'rgba(220,38,38,0.12)' : '#ffffff';
                                                                                    const txt = status === 'HADIR' || status === 'H' ? '#059669' : status === 'SAKIT' || status === 'S' ? '#d97706' : status === 'IZIN' || status === 'I' ? '#0284c7' : status === 'ALPHA' || status === 'A' ? '#dc2626' : isWeekend ? '#e2e8f0' : '#e2e8f0';
                                                                                    const displayChar = status === 'HADIR' ? 'H' : status === 'SAKIT' ? 'S' : status === 'IZIN' ? 'I' : status === 'ALPHA' || status === 'A' ? 'A' : '';
                                                                                    return (
                                                                                        <td key={di} style={{ padding: '0.375rem 0.25rem', textAlign: 'center', fontWeight: 900, fontSize: '0.7rem', background: bg, color: txt, borderRight: '1px solid #e2e8f0' }}>
                                                                                            {displayChar}
                                                                                        </td>
                                                                                    );
                                                                                })}
                                                                                <td style={{ position: 'sticky', right: '114px', zIndex: 1, background: '#e9f6f1', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#059669', borderLeft: '1px solid #e2e8f0' }}>{st.totalH}</td>
                                                                                <td style={{ position: 'sticky', right: '76px', zIndex: 1, background: '#fbf1e2', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#d97706', borderLeft: '1px solid #e2e8f0' }}>{st.totalS}</td>
                                                                                <td style={{ position: 'sticky', right: '38px', zIndex: 1, background: '#e7f4fc', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#0284c7', borderLeft: '1px solid #e2e8f0' }}>{st.totalI}</td>
                                                                                <td style={{ position: 'sticky', right: 0, zIndex: 1, background: '#fceaea', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#dc2626', borderLeft: '1px solid #e2e8f0' }}>{st.totalA}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })() : (
                                            <div className="table-empty"><i className="bi bi-calendar-x"></i><p>Memuat data bulanan...</p></div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* TUGAS Module */}
                    {moduleCode === 'TUGAS' && (
                        <div>
                            {(data.detail_tugas || []).length > 0 ? (
                                data.detail_tugas.map((t: any, idx: number) => (
                                    <div key={idx} className="task-card">
                                        <div className="task-card-header">
                                            <div>
                                                <div className="task-card-title">{t.tugas?.jabatan || t.nama_tugas || 'Penugasan'}</div>
                                                <div className="task-card-date">
                                                    {t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                                </div>
                                            </div>
                                            <span className="lckhg-badge verified">Verified</span>
                                        </div>
                                        <div className="task-card-content">
                                            <div className="task-card-label">Kegiatan Utama</div>
                                            <div className="task-card-text">{t.kegiatan || t.deskripsi || '-'}</div>
                                        </div>
                                        {t.hasil && (
                                            <div className="task-card-content" style={{ background: 'var(--lckhg-success-soft)' }}>
                                                <div className="task-card-label" style={{ color: 'var(--lckhg-success)' }}>Output / Hasil</div>
                                                <div className="task-card-text" style={{ color: 'var(--lckhg-text)' }}>"{t.hasil}"</div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="table-empty">
                                    <i className="bi bi-briefcase"></i>
                                    <p>Belum ada tugas tambahan</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* NILAI Module */}
                    {moduleCode === 'NILAI' && (
                        <div>
                            <table className="table-premium">
                                <thead>
                                    <tr>
                                        <th>Kelas & Mapel</th>
                                        <th className="text-center">Jenis Tes</th>
                                        <th>Materi</th>
                                        <th className="text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.detail_nilai || []).length > 0 ? data.detail_nilai.map((n: any, idx: number) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="">{n.kelas}</div>
                                                <div className="text-xs" style={{ color: 'var(--lckhg-text-subtle)' }}>{n.mapel}</div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`badge ${n.jenis === 'Sum' ? 'badge-success' : n.jenis === 'Pas' ? 'badge-warning' : 'badge-info'}`}>
                                                    {n.jenis === 'Sum' ? 'Sumatif' : n.jenis === 'Pas' ? 'SAS' : 'Formatif'}
                                                </span>
                                            </td>
                                            <td className="">
                                                <div>{n.materi || n.materi_tp}</div>
                                                <div className="text-xs" style={{ color: 'var(--lckhg-text-subtle)' }}>{n.tagihan || 'Utama'}</div>
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    onClick={async () => {
                                                        setNilaiNestedLoading(true);
                                                        setNilaiNestedError(null);
                                                        setNilaiNestedData(null);
                                                        setNilaiNestedOpen(true);
                                                        try {
                                                            const params = new URLSearchParams();
                                                            if (n.kolom_id) params.append('kolom_id', n.kolom_id);
                                                            params.append('kelas', n.kelas || '');
                                                            params.append('mapel', n.mapel || '');
                                                            const res = await fetch(`/api/lckh/nilai-detail?${params.toString()}`);
                                                            const result = await res.json();
                                                            if (!res.ok) throw new Error(result.error || 'Server error');
                                                            setNilaiNestedData(result);
                                                        } catch (err: any) {
                                                            setNilaiNestedError(err.message);
                                                        } finally {
                                                            setNilaiNestedLoading(false);
                                                        }
                                                    }}
                                                    className="lckhg-btn-detail"
                                                >
                                                    <i className="bi bi-list-ul"></i>
                                                    Detail
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="table-empty">Data nilai tidak ditemukan.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <footer className="lckhg-modal-foot">
                    <div className="lckhg-modal-foot-text">
                        <i className="bi bi-shield-lock-fill"></i>
                        Secured Verification Mode
                    </div>
                    <button onClick={onClose} className="lckhg-btn" style={{ background: 'var(--lckhg-primary)', color: 'white', borderColor: 'var(--lckhg-primary)' }}>
                        Selesai Meninjau
                    </button>
                </footer>

                {/* Nested Nilai Detail Modal */}
                {nilaiNestedOpen && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}>
                        <div style={{ background: 'var(--lckhg-surface)', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--lckhg-border)' }}>
                                <div>
                                    <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--lckhg-text)' }}>Detail Nilai</h3>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--lckhg-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.125rem' }}>Data siswa per mapel</p>
                                </div>
                                <button onClick={() => setNilaiNestedOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid var(--lckhg-border)', background: 'var(--lckhg-bg)', color: 'var(--lckhg-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                                {nilaiNestedLoading && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            {[1,2,3].map(i => <span key={i} style={{ display: 'block', width: '3px', height: '16px', background: 'var(--lckhg-primary)', borderRadius: '3px', animation: 'lckhWave 1s infinite ease-in-out', animationDelay: `${i * 0.1}s` }}></span>)}
                                        </div>
                                        <p style={{ fontWeight: 600, color: 'var(--lckhg-text-muted)', fontSize: '0.8rem' }}>Memuat...</p>
                                    </div>
                                )}
                                {nilaiNestedError && (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--lckhg-danger)', fontWeight: 600 }}>
                                        <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}></i>
                                        {nilaiNestedError}
                                    </div>
                                )}
                                {nilaiNestedData && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                            {(() => {
                                                const scores = nilaiNestedData.students?.map((s: any) => s.nilai).filter((n: any) => n !== null && n !== undefined) || [];
                                                const avg = scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '-';
                                                const max = scores.length ? Math.max(...scores) : '-';
                                                const min = scores.length ? Math.min(...scores) : '-';
                                                return [
                                                    { label: 'Rata-rata', value: avg, color: '#3083FF', bg: 'rgba(0,56,168,0.08)' },
                                                    { label: 'Nilai Tertinggi', value: max, color: '#16a34a', bg: 'rgba(16,185,129,0.08)' },
                                                    { label: 'Nilai Terendah', value: min, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
                                                ];
                                            })().map((item, i) => (
                                                <div key={i} style={{ background: item.bg, borderRadius: '12px', padding: '1rem', textAlign: 'center', border: `1px solid ${item.color}20` }}>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: item.color }}>{item.value}</div>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: item.color, marginTop: '0.25rem' }}>{item.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>No</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>Nama Siswa</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>Nilai</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {nilaiNestedData.students?.map((s: any, i: number) => {
                                                    const val = s.nilai;
                                                    const pass = val >= 75;
                                                    return (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--lckhg-border-light)' }}>
                                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--lckhg-text-subtle)', fontWeight: 700 }}>{i + 1}</td>
                                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.nama}</td>
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                <span style={{ display: 'inline-block', minWidth: '40px', padding: '0.25rem 0.75rem', borderRadius: '8px', fontWeight: 900, fontSize: '0.875rem', background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: pass ? '#16a34a' : '#dc2626' }}>
                                                                    {val !== null && val !== undefined ? val : '-'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: pass ? '#16a34a' : '#dc2626' }}>
                                                                    <i className={`bi ${pass ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                                                                    {pass ? 'Lulus' : 'Remed'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
