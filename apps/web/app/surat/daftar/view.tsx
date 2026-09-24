'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import '../../surat/surat.css';

interface SuratItem {
    id: string;
    nomor_surat: string;
    jenis_surat: string;
    perkara: string;
    kepada: string;
    created_at: string;
    status: string;
    tempat_ttd: string;
    tanggal_ttd: string;
    tanggal_dibuat?: string;
    file_url?: string;
    penandatangan_nama?: string;
    penandatangan_jabatan?: string;
    pejabat_nama?: string;
    pejabat_jabatan?: string;
}

function DaftarSuratPage({ hideHeader = false }: { hideHeader?: boolean }) {
    return (
        <Suspense fallback={<div className="daftar-surat-wrap"><div className="srt-empty"><div className="srt-empty-title">Memuat...</div></div></div>}>
            <DaftarSuratContent hideHeader={hideHeader} />
        </Suspense>
    );
}

function DaftarSuratContent({ hideHeader = false }: { hideHeader?: boolean }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { openModal, closeModal } = useModalBlur();
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);
    const [surats, setSurats] = useState<SuratItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSurat, setSelectedSurat] = useState<SuratItem | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const [deleteSurat, setDeleteSurat] = useState<SuratItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleOpenDetail = (surat: SuratItem) => {
        openModal();
        setSelectedSurat(surat);
    };

    const handleCloseDetail = () => {
        closeModal();
        setSelectedSurat(null);
    };

    const handleOpenDelete = (surat: SuratItem) => {
        openModal();
        setDeleteSurat(surat);
    };

    const handleCloseDelete = () => {
        closeModal();
        setDeleteSurat(null);
    };

    const confirmDeleteSurat = async () => {
        if (!deleteSurat) return;
        const surat = deleteSurat;
        try {
            setIsDeleting(true);
            if (surat.file_url) {
                try {
                    const cleanUrl = `/api/upload?file_url=${encodeURIComponent(surat.file_url)}`;
                    const delRes = await fetch(cleanUrl, { method: 'DELETE' });
                    const delJson = await delRes.json();
                    if (!delRes.ok || !delJson.ok) {
                        console.warn('[Storage Cleanup Warning]:', delJson.error);
                    }
                } catch (storageErr) {
                    console.error('[Storage Conn Err]:', storageErr);
                }
            }

            const res = await fetch(`/api/surat/${surat.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus surat');

            setSurats(prev => prev.filter(s => s.id !== surat.id));
            if (selectedSurat?.id === surat.id) setSelectedSurat(null);
            handleCloseDelete();

            await Swal.fire({
                title: 'Berhasil Dihapus!',
                text: `Dokumen "${surat.nomor_surat || surat.perkara}" telah dihapus dari sistem.`,
                icon: 'success',
                confirmButtonText: 'Selesai',
                confirmButtonColor: '#3083FF',
                customClass: { popup: 'swal-compact' }
            });
        } catch (e: any) {
            await Swal.fire({ title: 'Gagal!', text: e.message, icon: 'error', confirmButtonText: 'OK', confirmButtonColor: '#dc2626', customClass: { popup: 'swal-compact' } });
        } finally {
            setIsDeleting(false);
        }
    };

    // Check if accessed via barcode scan (public access)
    const letterId = searchParams.get('letter_id');
    const isScanMode = !!letterId;

    useEffect(() => {
        const init = async () => {
            try {
                const meRes = await fetch('/api/auth/me');
                const meData = await meRes.json();
                if (meData.ok && meData.user) {
                    const uData = meData.user;
                    setUser(uData);
                    setUserData(uData);
                    const role = uData?.role?.toUpperCase() || '';
                    const roles: string[] = Array.isArray(uData.roles) && uData.roles.length > 0
                        ? uData.roles.map((r: string) => String(r).toUpperCase().replace(/\s+/g, '_'))
                        : role.split(/[,|]/).map((r: string) => r.trim().toUpperCase().replace(/\s+/g, '_')).filter(Boolean);
                    const adminCheck = roles.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r)) || role.includes('ADMIN') || role.includes('ADMINISTRATOR') || !!uData.isAdmin;
                    const izinCheck = roles.includes('OP_IZIN');
                    setIsAdmin(adminCheck);
                    setCanManage(adminCheck || izinCheck);
                }
            } catch (err) {
                console.error('Error init user in surat/daftar:', err);
            }
            await fetchSurats();
            setLoading(false);
        };
        init();
    }, []);

    const fetchSurats = async () => {
        try {
            // If accessed via QR scan, fetch only that specific letter
            if (letterId) {
                const res = await fetch(`/api/surat/by-id?id=${encodeURIComponent(letterId.replace('SRT-', ''))}`);
                const json = await res.json();
                if (json.ok && json.data) {
                    setSurats([json.data]);
                } else {
                    setSurats([]);
                }
            } else {
                // Normal mode - show all letters
                const res = await fetch('/api/surat/items');
                const json = await res.json();
                setSurats(json.data || []);
            }
        } catch (e: any) {
            console.error('Fetch error:', e);
            setSurats([]);
        }
    };

    const filteredSurats = surats.filter(surat => {
        const query = searchQuery.toLowerCase();
        return (
            surat.nomor_surat?.toLowerCase().includes(query) ||
            surat.perkara?.toLowerCase().includes(query) ||
            surat.kepada?.toLowerCase().includes(query)
        );
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const getJenisLabel = (jenis: string) => {
        const labels: Record<string, string> = {
            'UNDANGAN': 'Undangan',
            'PEMBERITAHUAN': 'Pemberitahuan'
        };
        return labels[jenis] || jenis;
    };

    // Delete Surat Akademik Handler
    // Unduh berkas surat lewat proxy /api/surat/download. Sebelumnya tombol ini
    // hanya <a href={file_url} target="_blank">, sehingga browser membuka viewer
    // PDF di tab baru dan alamat asli penyimpanan terlihat di address bar.
    const handleDownload = async (surat: SuratItem) => {
        if (!surat.file_url || downloadingId) return;
        setDownloadingId(surat.id);
        try {
            const res = await fetch(`/api/surat/download?id=${encodeURIComponent(surat.id)}`);
            if (!res.ok) {
                throw new Error((await res.text()) || 'Berkas surat gagal diunduh.');
            }

            // Nama berkas mengikuti Content-Disposition dari server (nomor surat)
            const disposition = res.headers.get('content-disposition') || '';
            const named = /filename\*=UTF-8''([^;]+)/i.exec(disposition) || /filename="([^"]+)"/i.exec(disposition);
            const fileName = named ? decodeURIComponent(named[1]) : `${surat.nomor_surat || 'surat'}.pdf`;

            const blob = await res.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (e: any) {
            Swal.fire('Gagal Mengunduh', e?.message || 'Berkas surat tidak dapat diunduh.', 'error');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDeleteSurat = async (surat: SuratItem) => {
        const result = await Swal.fire({
            title: 'Hapus Surat?',
            html: `
                <div style="text-align: left;">
                    <p><strong>Nomor:</strong> ${surat.nomor_surat || '-'}</p>
                    <p><strong>Perihal:</strong> ${surat.perkara || '-'}</p>
                    <hr style="margin: 15px 0; border-color: #e2e8f0;">
                    <p style="color: #dc2626; font-weight: 700; font-size: 0.95rem;">
                        <i class="bi bi-exclamation-triangle-fill"></i> Surat akan dihapus permanen dari database
                    </p>
                </div>
            `,
            icon: 'warning', showCancelButton: true,
            confirmButtonText: '<span style="white-space: nowrap;"><i class="bi bi-exclamation-triangle"></i> Ya, Hapus</span>',
            cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
            customClass: { popup: 'swal-compact' }
        });

        if (!result.isConfirmed) return;

        const doubleConfirm = await Swal.fire({
            title: 'Konfirmasi Final',
            text: `Yakin ingin menghapus surat "${surat.nomor_surat}"?`,
            icon: 'error', showCancelButton: true,
            confirmButtonText: '<span style="white-space: nowrap;">Hapus Sekarang</span>', cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
            customClass: { popup: 'swal-compact' }
        });

        if (!doubleConfirm.isConfirmed) return;

        try {
            setLoading(true);

            // ─── STEP 1: PHYSICAL FILE STORAGE DELETION ───
            let storageNote = '';
            if (surat.file_url) {
                try {
                    const cleanUrl = `/api/upload?file_url=${encodeURIComponent(surat.file_url)}`;
                    const delRes = await fetch(cleanUrl, { method: 'DELETE' });
                    const delJson = await delRes.json();
                    
                    if (!delRes.ok || !delJson.ok) {
                        console.warn('[Storage Cleanup Warning]:', delJson.error);
                        storageNote = `<div style="margin-top: 8px; padding: 8px; background: #fff7ed; color: #c2410c; border-radius: 4px; font-size: 0.75rem; border: 1px solid #ffedd5; font-weight: 500;">
                            <i class="bi bi-exclamation-circle-fill"></i> File fisik gagal dibersihkan di cloud/hosting: ${delJson.error || 'Respon Gagal'}
                        </div>`;
                    }
                } catch (storageErr) {
                    console.error('[Storage Conn Err]:', storageErr);
                    storageNote = '<div style="margin-top: 8px; padding: 8px; background: #fef2f2; color: #b91c1c; border-radius: 4px; font-size: 0.75rem;">Koneksi terputus saat menghapus file fisik.</div>';
                }
            }

            // ─── STEP 2: DATABASE DELETION ───
            const res = await fetch(`/api/surat/${surat.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus surat');
            
            setSurats(prev => prev.filter(s => s.id !== surat.id));
            if (selectedSurat?.id === surat.id) setSelectedSurat(null);
            
            await Swal.fire({ 
                title: 'Berhasil Dihapus!', 
                html: `
                    <div>
                        <p>Dokumen "${surat.nomor_surat}" beserta data verifikasinya telah dibersihkan dari sistem.</p>
                        ${storageNote}
                    </div>
                `, 
                icon: 'success', 
                confirmButtonText: 'Selesai', 
                confirmButtonColor: '#3083FF', 
                customClass: { popup: 'swal-compact' } 
            });
        } catch (e: any) {
            await Swal.fire({ title: 'Gagal!', text: e.message, icon: 'error', confirmButtonText: 'OK', confirmButtonColor: '#dc2626', customClass: { popup: 'swal-compact' } });
        } finally {
            setLoading(false);
        }
    };

    const showStats = canManage && !isScanMode;

    return (
        <div className="daftar-surat-wrap animate-srt-fade-in">
            {/* Search Bar & Total Stats Row */}
            {showStats && (
                <FilterToolbar style={{ marginBottom: '1.25rem' }}>
                    <FilterSearch
                        placeholder="Cari surat (nomor, perihal, tujuan)..."
                        value={searchQuery}
                        onChange={v => setSearchQuery(v)}
                    />
                    <FilterActions>
                        {!hideHeader && isAdmin && !isScanMode && (
                            <button onClick={() => router.push('/surat?tab=sign')} className="srt-btn srt-btn-success" style={{ height: '42px', padding: '0 16px' }}>
                                <i className="bi bi-shield-check"></i>
                                Tanda Tangani
                            </button>
                        )}
                        <div style={{ padding: '6px 16px', display: 'flex', flexDirection: 'row', gap: '0.6rem', alignItems: 'center', justifyContent: 'center', background: 'var(--srt-surface, #fff)', border: '1px solid var(--n-border, #e2e8f0)', borderRadius: '12px', height: '42px', boxSizing: 'border-box' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>{filteredSurats.length}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--srt-muted, #64748b)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Surat</span>
                        </div>
                    </FilterActions>
                </FilterToolbar>
            )}

            <div className="daftar-surat-content">
                {loading ? (
                    <div className="srt-empty">
                        <div className="srt-empty-icon"><i className="bi bi-hourglass-split"></i></div>
                        <div className="srt-empty-title">Memuat data...</div>
                    </div>
                ) : (
                    filteredSurats.length === 0 ? (
                        <div className="srt-empty">
                            <div className="srt-empty-icon"><i className="bi bi-inbox"></i></div>
                            <div className="srt-empty-title">Belum ada surat akademik</div>
                            <div className="srt-empty-desc">Surat undangan dan pemberitahuan akan muncul di sini.</div>
                            {isAdmin && (
                                <button onClick={() => router.push('/surat?tab=sign')} className="srt-btn srt-btn-primary" style={{ marginTop: '1rem' }}>
                                    <i className="bi bi-plus-circle"></i> Buat Surat Baru
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="desktop-table-view">
                                <table className="srt-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                                            <th>Nomor Surat</th>
                                            <th style={{ width: '130px' }}>Jenis</th>
                                            <th>Perihal</th>
                                            <th style={{ width: '150px' }}>Tanggal Ttd</th>
                                            <th style={{ width: '160px', textAlign: 'center' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSurats.map((surat, index) => (
                                            <tr key={surat.id}>
                                                <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--srt-muted)', fontSize: '0.8rem' }}>
                                                    {String(index + 1).padStart(3, '0')}
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 700, color: 'var(--srt-ink)' }}>{surat.nomor_surat || '-'}</span>
                                                </td>
                                                <td>
                                                    <span className="surat-badge">
                                                        {getJenisLabel(surat.jenis_surat)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ color: 'var(--srt-text)', fontSize: '0.875rem', fontWeight: 500 }}>{surat.perkara || '-'}</span>
                                                </td>
                                                <td>
                                                    <span style={{ color: 'var(--srt-muted)', fontSize: '0.825rem', fontWeight: 600 }}>{formatDate(surat.tanggal_ttd || surat.created_at)}</span>
                                                </td>
                                                <td>
                                                    <ActionGroup className="justify-center">
                                                        <ActionButton action="view" onClick={() => handleOpenDetail(surat)} title="Detail Surat" tooltipPos="top" />
                                                        {surat.file_url && (
                                                            <ActionButton
                                                                action="download"
                                                                onClick={() => handleDownload(surat)}
                                                                disabled={downloadingId === surat.id}
                                                                isLoading={downloadingId === surat.id}
                                                                title="Unduh PDF"
                                                                tooltipPos="top"
                                                            />
                                                        )}
                                                        <ActionButton action="file" onClick={() => router.push(`/surat/scan/${surat.id}`)} title="Verifikasi QR" tooltipPos="top" />
                                                        {isAdmin && (
                                                            <ActionButton action="delete" onClick={() => handleOpenDelete(surat)} title="Hapus Surat" tooltipPos="top" />
                                                        )}
                                                    </ActionGroup>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards View */}
                            <div className="mobile-cards-view">
                                <div className="surat-list">
                                    {filteredSurats.map(surat => (
                                        <div key={surat.id} className="surat-card">
                                            <div className="surat-card-header">
                                                <span className="surat-nomor">{surat.nomor_surat || '-'}</span>
                                                <div className="surat-header-actions">
                                                    <span className="surat-badge">{getJenisLabel(surat.jenis_surat)}</span>
                                                    {surat.status === 'DRAFT' && (
                                                        <span className="surat-badge" style={{background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d'}}>DRAFT</span>
                                                    )}
                                                    {surat.file_url && (
                                                        <span className="pdf-indicator" title="Memiliki file PDF">
                                                            <i className="bi bi-file-earmark-pdf-fill"></i>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="surat-card-body">
                                                <div className="surat-perihal"><strong>Perihal:</strong> {surat.perkara || '-'}</div>
                                                {surat.tempat_ttd && (
                                                    <div className="surat-tempat"><strong>Tempat/Tanggal:</strong> {surat.tempat_ttd}, {formatDate(surat.tanggal_ttd)}</div>
                                                )}
                                            </div>
                                            <div className="surat-card-footer">
                                                <div className="surat-meta"><i className="bi bi-calendar3"></i>{formatDate(surat.created_at)}</div>
                                                <div className="surat-id"><i className="bi bi-hash"></i> SRT-{surat.id.slice(0, 8)}</div>
                                            </div>
                                            <div className="surat-card-actions">
                                                <ActionGroup>
                                                    <ActionButton action="view" onClick={() => handleOpenDetail(surat)} title="Detail" iconOnly={false} label="Detail" />
                                                    {surat.file_url && (
                                                        <ActionButton
                                                            action="download"
                                                            onClick={() => handleDownload(surat)}
                                                            disabled={downloadingId === surat.id}
                                                            isLoading={downloadingId === surat.id}
                                                            title="Unduh PDF"
                                                            iconOnly={false}
                                                            label="Unduh"
                                                        />
                                                    )}
                                                    <ActionButton action="file" onClick={() => router.push(`/surat/scan/${surat.id}`)} title="Verifikasi" iconOnly={false} label="QR" />
                                                    {isAdmin && (
                                                        <ActionButton action="delete" onClick={() => handleOpenDelete(surat)} title="Hapus" iconOnly={false} label="Hapus" />
                                                    )}
                                                </ActionGroup>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )
                )}
            </div>

            {/* Detail Modal - Surat Akademik */}
            <Modal
                open={!!selectedSurat}
                onClose={handleCloseDetail}
                title="Detail Surat Akademik"
                subtitle={selectedSurat?.nomor_surat || '-'}
                icon="file-earmark-text"
                size="md"
                variant="default"
            >
                {selectedSurat && (
                    <>
                        <ModalBody>
                            {/* Unified Info Grid */}
                            <div className="mdl-detail__grid">
                                {/* Jenis */}
                                <div className="mdl-detail__item">
                                    <span className="mdl-detail__label">Jenis</span>
                                    <span className="mdl-detail__value" style={{ fontWeight: 700 }}>{getJenisLabel(selectedSurat.jenis_surat)}</span>
                                </div>
                                {/* Status */}
                                <div className="mdl-detail__item">
                                    <span className="mdl-detail__label">Status</span>
                                    <span className="mdl-detail__value">
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: selectedSurat.status === 'FINAL' ? '#dcfce7' : '#fef3c7', color: selectedSurat.status === 'FINAL' ? '#15803d' : '#b45309', padding: '1px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${selectedSurat.status === 'FINAL' ? '#bbf7d0' : '#fde68a'}` }}>
                                            {selectedSurat.status}
                                        </span>
                                    </span>
                                </div>

                                {/* Perihal */}
                                <div className="mdl-detail__item mdl-detail__item--full">
                                    <span className="mdl-detail__label">Perihal</span>
                                    <span className="mdl-detail__value" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--srt-primary, #3b82f6)' }}>{selectedSurat.perkara || '-'}</span>
                                </div>

                                {/* Penandatangan */}
                                <div className="mdl-detail__item">
                                    <span className="mdl-detail__label">Penandatangan</span>
                                    <span className="mdl-detail__value" style={{ fontWeight: 700 }}>{selectedSurat.penandatangan_nama || selectedSurat.pejabat_nama || '-'}</span>
                                </div>
                                {/* Jabatan */}
                                <div className="mdl-detail__item">
                                    <span className="mdl-detail__label">Jabatan</span>
                                    <span className="mdl-detail__value">{selectedSurat.penandatangan_jabatan || selectedSurat.pejabat_jabatan || '-'}</span>
                                </div>

                                {/* Tempat TTD */}
                                <div className="mdl-detail__item">
                                    <span className="mdl-detail__label">Tempat TTD</span>
                                    <span className="mdl-detail__value">{selectedSurat.tempat_ttd || '-'}</span>
                                </div>
                                {/* Tanggal TTD */}
                                <div className="mdl-detail__item">
                                    <span className="mdl-detail__label">Tanggal TTD</span>
                                    <span className="mdl-detail__value">{formatDate(selectedSurat.tanggal_ttd)}</span>
                                </div>

                                {selectedSurat.tanggal_dibuat && (
                                    <div className="mdl-detail__item mdl-detail__item--full">
                                        <span className="mdl-detail__label">Tanggal Dibuat / Keluar</span>
                                        <span className="mdl-detail__value">{formatDate(selectedSurat.tanggal_dibuat)}</span>
                                    </div>
                                )}
                            </div>

                            {/* ID Verifikasi Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(148,163,184,0.08)', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.12)', margin: '14px 0 10px' }}>
                                <span className="mdl-detail__label" style={{ margin: 0 }}>ID Verifikasi</span>
                                <span style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-text)' }}>SRT-{selectedSurat.id}</span>
                            </div>

                            {/* QR Section */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '14px', padding: '14px' }}>
                                {/* Left: QR Code */}
                                <div style={{ position: 'relative', display: 'flex', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <img
                                        src={`/api/qrcode?data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/surat/scan/${selectedSurat.id}`)}`}
                                        alt="QR Verifikasi"
                                        style={{ width: '84px', height: '84px', border: '1px solid #e2e8f0', background: 'white', display: 'block' }}
                                    />
                                    <img
                                        src="/logo-icon.png" alt="Logo"
                                        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '20px', height: '20px', borderRadius: '50%', background: 'white', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                                    />
                                </div>

                                {/* Right: Verifikasi Info & Action Buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--n-text)' }}>Verifikasi Keaslian</h4>
                                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--n-muted)', lineHeight: 1.3 }}>Pindai QR Code atau gunakan tombol untuk verifikasi dokumen resmi.</p>

                                    <div style={{ background: 'var(--srt-surface)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0, 56, 168, 0.08)', fontFamily: 'Courier New, monospace', fontSize: '0.65rem', color: 'var(--n-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                        {typeof window !== 'undefined' ? window.location.origin : ''}/surat/scan/{selectedSurat.id}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                        {selectedSurat.file_url && (
                                            <Button
                                                variant="primary"
                                                type="button"
                                                onClick={() => handleDownload(selectedSurat)}
                                                disabled={downloadingId === selectedSurat.id}
                                                isLoading={downloadingId === selectedSurat.id}
                                                leftIcon={<i className={downloadingId === selectedSurat.id ? 'bi bi-arrow-repeat' : 'bi bi-download'} />}
                                                style={{ flex: 1, height: '34px', fontSize: '0.75rem' }}
                                            >
                                                PDF
                                            </Button>
                                        )}
                                        <Button
                                            variant="primary"
                                            type="button"
                                            onClick={() => router.push(`/surat/scan/${selectedSurat.id}`)}
                                            leftIcon={<i className="bi bi-qr-code" />}
                                            style={{ flex: 1, height: '34px', fontSize: '0.75rem' }}
                                        >
                                            Verifikasi
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter align="end">
                            <Button variant="cancel" type="button" onClick={handleCloseDetail}>
                                Tutup
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={!!deleteSurat}
                onClose={handleCloseDelete}
                size="sm"
                variant="delete"
                title="Hapus Surat?"
                icon="trash"
            >
                {deleteSurat && (
                    <>
                        <ModalBody>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', width: '100%', marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--n-text)', lineHeight: 1.5 }}>
                                    <strong>Nomor:</strong> {deleteSurat.nomor_surat || deleteSurat.perkara || '-'}<br />
                                    <strong>Perihal:</strong> {deleteSurat.perkara || '-'}
                                </div>
                                <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)', margin: '4px 0' }}></div>
                                <div style={{ color: '#ef4444', fontSize: '0.825rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center' }}>
                                    <i className="bi bi-exclamation-triangle-fill"></i> Surat akan dihapus permanen dari database
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter align="end">

                            <Button variant="danger" type="button" onClick={confirmDeleteSurat} isLoading={isDeleting} leftIcon={<i className="bi bi-exclamation-triangle" />}>
                                Ya, Hapus
                            </Button>
                            <Button variant="cancel" type="button" onClick={handleCloseDelete}>
                                Batal
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </Modal>
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedDaftarSuratPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_surat_daftar" />
            <DaftarSuratPage {...props} />
        </>
    );
}
