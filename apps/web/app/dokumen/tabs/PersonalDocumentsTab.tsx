'use client';



import { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import UploadModal from '@/components/personal/UploadModal';
import ShareModal from '@/components/personal/ShareModal';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useFileViewer } from '@/components/useFileViewer';
import FilterToolbar, { FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { DesktopFab } from '@/components/ui/DesktopFab';
import Button from '@/components/ui/Button';
import { FolderPen } from 'lucide-react';
// --- Types ---
interface Folder {
    id: string;
    nama: string;
    personal_folder_shares?: {
        id: string;
        shared_with: {
            id: string;
            nama: string;
            username: string;
        };
    }[];
}

interface PersonalDoc {
    id: string;
    judul: string;
    file_url: string;
    size: number;
    extension: string;
    uploaded_at: string;
    folder_id?: string | null;
    owner?: {
        nama: string;
        username: string;
    };
    personal_document_shares?: {
        id: string;
        shared_with: {
            id: string;
            nama: string;
            username: string;
        };
    }[];
}

export default function PersonalDocumentsPage({ user }: { user: any }) {

    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();

    /**
     * Buka dokumen di viewer.
     *
     * Sebelumnya `/api/personal/documents/{id}/file?action=view` diserahkan
     * langsung ke viewer. Rute itu TIDAK menyajikan berkasnya — ia selalu
     * membalas JSON berisi metadata dokumen, termasuk `file_url` yang
     * sesungguhnya. Akibatnya viewer mengunduh JSON, tidak mengenalinya sebagai
     * jenis berkas apa pun, dan tampil kosong untuk SEMUA dokumen pribadi —
     * PDF, Word, maupun Excel.
     *
     * Jadi: pakai `file_url` yang memang sudah ada di daftar, dan hanya kalau
     * tidak ada barulah tanyakan ke rute metadata itu. Memanggil rute tersebut
     * juga yang menjalankan pemeriksaan hak akses di backend, jadi jalur
     * cadangannya tetap aman.
     */
    const bukaDokumen = useCallback(async (doc: { id: string; judul: string; file_url?: string | null }) => {
        if (doc.file_url) {
            openFile(doc.file_url, doc.judul);
            return;
        }
        try {
            const res = await fetch(`/api/personal/documents/${doc.id}/file`);
            const json = await res.json();
            if (json?.ok && json.data?.file_url) {
                openFile(json.data.file_url, doc.judul);
            } else {
                Swal.fire('Gagal', json?.error || 'Berkas tidak dapat dibuka.', 'error');
            }
        } catch {
            Swal.fire('Gagal', 'Berkas tidak dapat dibuka.', 'error');
        }
    }, [openFile]);

    const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');

    const [folders, setFolders] = useState<Folder[]>([]);

    const [documents, setDocuments] = useState<PersonalDoc[]>([]);

    const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = all, '__root__' = no folder

    const [loading, setLoading] = useState(true);



    // Modal states

    const [isUploadOpen, setIsUploadOpen] = useState(false);

    const [shareData, setShareData] = useState<{

        id?: string,

        ids?: string[],

        folderId?: string,

        title: string,

        existingShares?: any[]

    } | null>(null);



    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [searchQuery, setSearchQuery] = useState('');
    const [moveData, setMoveData] = useState<{ doc: PersonalDoc } | null>(null);
    const [batchMoveOpen, setBatchMoveOpen] = useState(false);
    const [moveFolder, setMoveFolder] = useState<string>('__root__');
    const [isMoving, setIsMoving] = useState(false);
    const [manageShareData, setManageShareData] = useState<{ id: string, type: 'doc' | 'folder', title: string, shares: any[] } | null>(null);
    const [isRevoking, setIsRevoking] = useState<string | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null);

    // Menu aksi kartu mobile ("...") — cuma satu yang boleh terbuka sekaligus,
    // jadi cukup simpan id dokumennya, bukan per-kartu.
    const [openCardMenu, setOpenCardMenu] = useState<string | null>(null);

    const { registerModal, openModal, closeModal } = useModalBlur()

    useEffect(() => {
        if (isUploadOpen || shareData || moveData || batchMoveOpen || manageShareData || selectedDoc) {
            return registerModal()
        }
    }, [isUploadOpen, shareData, moveData, batchMoveOpen, manageShareData, selectedDoc, registerModal])

    useEffect(() => {
        if (!openCardMenu) return;
        const onPointerDown = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.pd-mobile-card-menu-wrap')) setOpenCardMenu(null);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [openCardMenu]);

    const isMasterGuruUser = useMemo(() => {
        if (!user) return false;
        const userRoles = (user.roles || [user.role]).filter(Boolean).map((r: any) => String(r).toUpperCase());
        const hasGuruOrStaffRole = userRoles.some((r: string) => [
            'GURU', 'STAF', 'TU', 'TATA_USAHA', 'BENDAHARA',
            'KAMAD', 'KEPALA_SEKOLAH', 'WAKAMAD', 'WALI_KELAS',
            'ADMIN', 'ADMINISTRATOR'
        ].includes(r));
        const hasNip = Boolean(user.nip && String(user.nip).trim() !== '' && !user.nisn);
        return hasNip || hasGuruOrStaffRole;
    }, [user]);

    const canManage = true; // All users can manage their own documents
    const canShare = true; // All users can share their own documents

    const toggleSelectArr = (id: string) => {

        setSelectedIds(prev =>

            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]

        );

    };



    const handleShareMultiple = () => {

        if (selectedIds.length === 0) return;

        setShareData({

            ids: selectedIds,

            title: `${selectedIds.length} Dokumen Terpilih`,

            existingShares: []

        });

    };



    const handleDownloadFolder = async (folderId: string, folderName: string) => {

        setIsDownloading(folderId);

        try {

            const res = await fetch(`/api/personal/documents/download/folder?folder_id=${folderId}`);

            if (!res.ok) throw new Error('Gagal mengunduh folder');



            const blob = await res.blob();

            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');

            a.href = url;

            a.download = `${folderName}.zip`;

            document.body.appendChild(a);

            a.click();

            a.remove();

        } catch (error) {

            Swal.fire('Error', 'Gagal mengunduh folder', 'error');

        } finally {

            setIsDownloading(null);

        }

    };



    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const isMine = activeTab === 'mine';

            // 1. Prepare URLs
            const folderUrl = isMine ? '/api/personal/folders' : '/api/personal/folders?shared=true';
            let docUrl = isMine ? '/api/personal/documents' : '/api/personal/documents?shared=true';

            if (selectedFolder === '__root__') {
                docUrl += (docUrl.includes('?') ? '&' : '?') + 'folder_id=null';
            } else if (selectedFolder) {
                docUrl += (docUrl.includes('?') ? '&' : '?') + 'folder_id=' + selectedFolder;
            }

            // 2. Fetch in parallel
            const [fRes, dRes] = await Promise.all([
                fetch(folderUrl),
                fetch(docUrl)
            ]);

            const [fJson, dJson] = await Promise.all([
                fRes.json(),
                dRes.json()
            ]);

            if (fJson.ok) setFolders(fJson.data);
            else console.error("Folder fetch error:", fJson.error);

            if (dJson.ok) setDocuments(dJson.data);
            else {
                console.error("Doc fetch error:", dJson.error);
                if (dJson.error !== 'Unauthorized') {
                    Swal.fire('Gagal Memuat', dJson.error || 'Terjadi kesalahan saat mengambil dokumen', 'error');
                }
            }

        } catch (error: any) {
            console.error('Fetch fetchData error:', error);
            Swal.fire('Error', 'Gagal menghubungkan ke server unit personal dokumen', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedFolder]);



    const sortedDocuments = useMemo(() => {

        return [...documents].sort((a, b) =>

            sortOrder === 'asc'

                ? a.judul.localeCompare(b.judul, 'id')

                : b.judul.localeCompare(a.judul, 'id')

        );

    }, [documents, sortOrder]);



    const filteredDocuments = useMemo(() => {

        if (!searchQuery.trim()) return sortedDocuments;

        const q = searchQuery.toLowerCase();

        return sortedDocuments.filter(d => d.judul.toLowerCase().includes(q));

    }, [sortedDocuments, searchQuery]);



    const handleMoveDoc = async () => {

        if (!moveData) return;

        setIsMoving(true);

        try {

            const res = await fetch('/api/personal/documents/move', {

                method: 'PATCH',

                headers: { 'Content-Type': 'application/json' },

                body: JSON.stringify({

                    doc_id: moveData.doc.id,

                    folder_id: moveFolder === '__root__' ? null : moveFolder,

                }),

            });

            const json = await res.json();

            if (json.ok) {

                Swal.fire('Berhasil', 'Dokumen berhasil dipindahkan.', 'success');

                setMoveData(null);

                fetchData();

            } else {

                Swal.fire('Gagal', json.error, 'error');

            }

        } catch {

            Swal.fire('Error', 'Gagal memindahkan dokumen', 'error');

        } finally {

            setIsMoving(false);

        }

    };


    const handleRevokeShare = async (shareId: string, type: 'doc' | 'folder') => {
        setIsRevoking(shareId);
        try {
            const endpoint = type === 'doc' ? '/api/personal/documents/share/revoke' : '/api/personal/folders/share/revoke';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ share_id: shareId }),
            });
            const json = await res.json();
            if (json.ok) {
                if (manageShareData) {
                    setManageShareData({
                        ...manageShareData,
                        shares: manageShareData.shares.filter(s => s.id !== shareId)
                    });
                }
                fetchData();
            } else {
                Swal.fire('Gagal', json.error, 'error');
            }
        } catch {
            Swal.fire('Error', 'Gagal membatalkan sharing', 'error');
        } finally {
            setIsRevoking(null);
        }
    };


    const handleBatchMove = async () => {

        if (selectedIds.length === 0) return;

        setIsMoving(true);

        try {

            const res = await fetch('/api/personal/documents/move', {

                method: 'PATCH',

                headers: { 'Content-Type': 'application/json' },

                body: JSON.stringify({

                    doc_ids: selectedIds,

                    folder_id: moveFolder === '__root__' ? null : moveFolder,

                }),

            });

            const json = await res.json();

            if (json.ok) {

                Swal.fire('Berhasil', json.message, 'success');

                setBatchMoveOpen(false);

                setSelectedIds([]);

                fetchData();

            } else {

                Swal.fire('Gagal', json.error, 'error');

            }

        } catch {

            Swal.fire('Error', 'Gagal memindahkan dokumen', 'error');

        } finally {

            setIsMoving(false);

        }

    };



    useEffect(() => {

        fetchData();

    }, [fetchData]);



    const handleCreateFolder = async () => {

        const { value: folderName } = await Swal.fire({

            title: 'Buat Folder Baru',

            input: 'text',

            inputLabel: 'Nama Folder',

            inputPlaceholder: 'Masukkan nama folder...',

            showCancelButton: true,

            confirmButtonText: 'Buat',

            cancelButtonText: 'Batal',

            confirmButtonColor: '#1e3a8a',

        });



        if (folderName) {

            try {

                const res = await fetch('/api/personal/folders', {

                    method: 'POST',

                    headers: { 'Content-Type': 'application/json' },

                    body: JSON.stringify({ nama: folderName }),

                });

                const json = await res.json();

                if (json.ok) {

                    Swal.fire('Berhasil', 'Folder berhasil dibuat', 'success');

                    fetchData();

                } else {

                    Swal.fire('Gagal', json.error, 'error');

                }

            } catch (error) {

                Swal.fire('Error', 'Terjadi kesalahan sistem', 'error');

            }

        }

    };



    const handleDeleteDoc = async (docId: string, title: string) => {

        const isShared = activeTab === 'shared';

        const result = await Swal.fire({

            title: isShared ? 'Lepas Berbagi?' : 'Hapus Dokumen?',

            text: isShared

                ? `Hapus "${title}" dari daftar Anda? Dokumen asli akan tetap ada di pemiliknya.`

                : `Apakah Anda yakin ingin menghapus "${title}"?`,

            icon: 'warning',

            showCancelButton: true,

            confirmButtonColor: '#ef4444',

            confirmButtonText: isShared ? 'Ya, Lepas' : 'Ya, Hapus',

            cancelButtonText: 'Batal'

        });



        if (result.isConfirmed) {

            try {

                const res = await fetch(`/api/personal/documents/delete?id=${docId}`, {

                    method: 'DELETE'

                });

                const json = await res.json();

                if (json.ok) {

                    Swal.fire('Terhapus!', 'Dokumen berhasil dihapus.', 'success');

                    fetchData();

                } else {

                    Swal.fire('Gagal', json.error, 'error');

                }

            } catch (error) {

                Swal.fire('Error', 'Gagal menghapus dokumen', 'error');

            }

        }

    };



    const handleDeleteFolder = async (folderId: string, folderName: string) => {

        const isShared = activeTab === 'shared';

        const result = await Swal.fire({

            title: isShared ? 'Lepas Folder?' : 'Hapus Folder?',

            text: isShared

                ? `Hapus folder "${folderName}" dari daftar Anda? Isinya akan tetap ada di pemiliknya.`

                : `Apakah Anda yakin ingin menghapus folder "${folderName}" beserta seluruh isinya? Tindakan ini tidak dapat dibatalkan.`,

            icon: 'warning',

            showCancelButton: true,

            confirmButtonColor: '#ef4444',

            confirmButtonText: isShared ? 'Ya, Lepas' : 'Ya, Hapus Semua',

            cancelButtonText: 'Batal'

        });



        if (result.isConfirmed) {

            try {

                const res = await fetch(`/api/personal/folders/delete?id=${folderId}`, {

                    method: 'DELETE'

                });

                const json = await res.json();

                if (json.ok) {

                    Swal.fire('Terhapus!', json.message, 'success');

                    fetchData();

                } else {

                    Swal.fire('Gagal', json.error, 'error');

                }

            } catch (error) {

                Swal.fire('Error', 'Gagal menghapus folder', 'error');

            }

        }

    };



    const handleBatchDelete = async () => {

        if (selectedIds.length === 0) return;



        const isShared = activeTab === 'shared';

        const result = await Swal.fire({

            title: isShared ? 'Lepas Berbagi Terpilih?' : 'Hapus Terpilih?',

            text: isShared

                ? `Lepas ${selectedIds.length} dokumen dari daftar Anda?`

                : `Apakah Anda yakin ingin menghapus ${selectedIds.length} dokumen terpilih?`,

            icon: 'warning',

            showCancelButton: true,

            confirmButtonColor: '#ef4444',

            confirmButtonText: isShared ? 'Ya, Lepas' : 'Ya, Hapus',

            cancelButtonText: 'Batal'

        });



        if (result.isConfirmed) {

            try {

                const res = await fetch(`/api/personal/documents/delete?ids=${selectedIds.join(',')}`, {

                    method: 'DELETE'

                });

                const json = await res.json();

                if (json.ok) {

                    Swal.fire('Berhasil!', json.message, 'success');

                    setSelectedIds([]);

                    fetchData();

                } else {

                    Swal.fire('Gagal', json.error, 'error');

                }

            } catch (error) {

                Swal.fire('Error', 'Gagal memproses penghapusan', 'error');

            }

        }

    };



    const handleBatchDownload = async () => {

        if (selectedIds.length === 0) return;

        setIsDownloading('batch');

        try {

            const res = await fetch(`/api/personal/documents/download/batch?ids=${selectedIds.join(',')}`);

            if (!res.ok) throw new Error('Gagal mengunduh dokumen');



            const blob = await res.blob();

            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');

            a.href = url;

            a.download = `ruang_dokumen_${new Date().getTime()}.zip`;

            document.body.appendChild(a);

            a.click();

            a.remove();

        } catch (error) {

            Swal.fire('Error', 'Gagal mengunduh dokumen terpilih', 'error');

        } finally {

            setIsDownloading(null);

        }

    };



    const formatSize = (bytes: number) => {

        if (!bytes) return '0 B';

        const k = 1024;

        const sizes = ['B', 'KB', 'MB', 'GB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];

    };



    const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // 100 MB Limit per user

    const totalStorageBytes = useMemo(() => {
        return documents.reduce((acc, doc) => acc + (doc.size || 0), 0);
    }, [documents]);

    const storagePercentage = useMemo(() => {
        return Math.min(100, Math.round((totalStorageBytes / MAX_STORAGE_BYTES) * 100));
    }, [totalStorageBytes]);

    if (!isMasterGuruUser) {
        return (
            <div style={{
                padding: '32px 24px',
                textAlign: 'center',
                background: 'var(--n-card, #ffffff)',
                borderRadius: '16px',
                border: '1.5px solid var(--n-border, #e2e8f0)',
                margin: '20px 0'
            }}>
                <i className="bi bi-shield-lock-fill" style={{ fontSize: '2.5rem', color: '#f59e0b', display: 'block', marginBottom: '12px' }}></i>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Akses Dokumen Pribadi Dibatasi</h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--n-muted, #64748b)', margin: 0 }}>
                    Fitur Dokumen Pribadi hanya dapat diakses oleh Guru & Tenaga Kependidikan yang terdaftar pada Master Guru.
                </p>
            </div>
        );
    }

    return (

        <MaintenanceBanner pageKey="maintenance_personal_documents">

        <div className="pd-page">

            {/* STORAGE CAPACITY BOX */}
            <div className="pd-storage-box">
                <div className="pd-storage-header">
                    <i className="fa-solid fa-hard-drive"></i>
                    <span>Kapasitas Penyimpanan Pribadi (Maks 100 MB)</span>
                    <span className="pd-storage-val">
                        {(totalStorageBytes / (1024 * 1024)).toFixed(1)} MB / 100 MB ({storagePercentage}%)
                    </span>
                </div>
                <div className="pd-storage-track">
                    <div
                        className={`pd-storage-fill ${storagePercentage > 90 ? 'danger' : storagePercentage > 75 ? 'warning' : ''}`}
                        style={{ width: `${storagePercentage}%` }}
                    ></div>
                </div>
            </div>

            {/*  BATCH BAR  */}
            {selectedIds.length > 0 && (
                <div className="pd-batch-bar" style={{ display: 'flex', gap: '8px', marginBottom: '14px', padding: '12px 16px', background: 'var(--pd-card-bg)', borderRadius: '12px', border: '1px solid var(--n-border)' }}>
                    <button className="pd-btn pd-btn-ghost" onClick={handleBatchDownload} disabled={isDownloading === 'batch'}>
                        <i className={`fa-solid ${isDownloading === 'batch' ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                        <span>Unduh ({selectedIds.length})</span>
                    </button>
                    {activeTab === 'mine' && canManage && (<>
                        {canShare && (
                            <button className="pd-btn pd-btn-ghost" onClick={handleShareMultiple}>
                                <i className="fa-solid fa-share-nodes"></i>
                                <span>Bagikan</span>
                            </button>
                        )}
                    </>)}
                    {(canManage || activeTab === 'shared') && (
                        <button className="pd-btn pd-btn-batch-delete" onClick={handleBatchDelete}>
                            <i className="fa-solid fa-trash"></i>
                            <span>{activeTab === 'shared' ? 'Lepas' : 'Hapus'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* ── TABS ── */}
            <div className="pd-tabs" style={{ marginTop: '14px', marginBottom: '14px' }}>
                <button className={`pd-tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => { setActiveTab('mine'); setSelectedFolder(null); setSelectedIds([]); }}>
                    <i className="fa-solid fa-vault"></i> Dokumen Saya
                </button>
                <button className={`pd-tab ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => { setActiveTab('shared'); setSelectedFolder(null); setSelectedIds([]); }}>
                    <i className="fa-solid fa-share-nodes"></i> Dibagikan dengan Saya
                </button>
            </div>



            {/* ── BODY ── */}

            <div className="pd-body">

                {/* SIDEBAR */}

                <aside className="pd-sidebar">

                    {/* Dokumen Saya Section */}
                    <div className="pd-sidebar-section">
                        <div className="pd-sidebar-label">Dokumen Saya</div>
                        <div className={`pd-sidebar-main-item ${activeTab === 'mine' && selectedFolder === null ? 'active' : ''}`} onClick={() => { setActiveTab('mine'); setSelectedFolder(null); }}>
                            <i className="fa-solid fa-layer-group"></i>
                            <span>Semua Dokumen</span>
                        </div>
                        {folders.filter(f => activeTab === 'mine').map(folder => (
                            <div key={folder.id} className={`pd-folder-item ${selectedFolder === folder.id ? 'active' : ''}`} onClick={() => { setActiveTab('mine'); setSelectedFolder(folder.id); }}>
                                <i className="fa-solid fa-folder"></i>
                                <span>{folder.nama}</span>
                                <div className="pd-folder-actions">
                                    {folder.personal_folder_shares && folder.personal_folder_shares.length > 0 && (
                                        <button className="pd-folder-action-btn" title="Kelola Berbagi" onClick={e => { e.stopPropagation(); setManageShareData({ id: folder.id, type: 'folder', title: folder.nama, shares: folder.personal_folder_shares || [] }); }}>
                                            <i className="fa-solid fa-share-nodes" style={{ color: '#16a34a' }}></i>
                                        </button>
                                    )}
                                    <button className="pd-folder-action-btn" title="Download ZIP" onClick={e => { e.stopPropagation(); handleDownloadFolder(folder.id, folder.nama); }} disabled={isDownloading === folder.id}>
                                        <i className={`fa-solid ${isDownloading === folder.id ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                                    </button>
                                    {canManage && (
                                        <>
                                            {canShare && (
                                                <button className="pd-folder-action-btn" title="Bagikan" onClick={e => { e.stopPropagation(); setShareData({ folderId: folder.id, title: folder.nama, existingShares: folder.personal_folder_shares || [] }); }}>
                                                    <i className="fa-solid fa-share-nodes"></i>
                                                </button>
                                            )}
                                            <button className="pd-folder-action-btn danger" title="Hapus" onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.nama); }}>
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Dibagikan ke Saya Section */}
                    <div className="pd-sidebar-section">
                        <div className="pd-sidebar-label">Dibagikan ke Saya</div>
                        <div className={`pd-sidebar-main-item ${activeTab === 'shared' && selectedFolder === null ? 'active' : ''}`} onClick={() => { setActiveTab('shared'); setSelectedFolder(null); }}>
                            <i className="fa-solid fa-user-group"></i>
                            <span>Semua Dibagikan</span>
                        </div>
                        {folders.filter(f => activeTab === 'shared').map(folder => (
                            <div key={folder.id} className={`pd-folder-item ${selectedFolder === folder.id ? 'active' : ''}`} onClick={() => { setActiveTab('shared'); setSelectedFolder(folder.id); }}>
                                <i className="fa-solid fa-folder"></i>
                                <span>{folder.nama}</span>
                            </div>
                        ))}
                    </div>

                </aside>



                {/* MAIN CONTENT */}

                <main className="pd-main">

                    {/* Toolbar */}

                    <div className="pd-toolbar-wrap">
                        <FilterToolbar actionsInline={true}>
                            <FilterSearch
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Cari dokumen..."
                                label="Cari"
                                grow={2}
                            />

                            {canManage && (
                                <FilterActions>
                                    <Button
                                        variant="outline"
                                        onClick={handleCreateFolder}
                                        leftIcon={<FolderPen size={18} />}
                                        className="ftb-btn-icon-mobile"
                                        title="Folder Baru"
                                        aria-label="Folder Baru"
                                    >
                                        <span className="btn-text-desktop">Folder Baru</span>
                                    </Button>
                                </FilterActions>
                            )}
                        </FilterToolbar>
                    </div>





                    {/* DOCUMENT LIST */}

                    {loading ? (

                        <div className="pd-loading-center">
                            <Spinner variant="trace" />
                        </div>

                    ) : filteredDocuments.length > 0 ? (

                        <>

                            {/* Desktop table */}

                            <div className="pd-doc-table">

                                <div className="pd-doc-table-header">

                                    <div>

                                        <input type="checkbox" className="pd-checkbox"

                                            checked={documents.length > 0 && selectedIds.length === documents.length}

                                            onChange={() => { if (selectedIds.length === documents.length) setSelectedIds([]); else setSelectedIds(documents.map(d => d.id)); }} />

                                    </div>

                                    <div style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>

                                        NAMA DOKUMEN <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>

                                    </div>

                                    <div>UKURAN</div>

                                    <div>TANGGAL</div>

                                    <div style={{ textAlign: 'right' }}>AKSI</div>

                                </div>

                                {filteredDocuments.map(doc => (

                                    <div key={doc.id} className={`pd-doc-row ${selectedIds.includes(doc.id) ? 'selected' : ''}`}>

                                        <div><input type="checkbox" className="pd-checkbox" checked={selectedIds.includes(doc.id)} onChange={() => toggleSelectArr(doc.id)} /></div>

                                        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: '8px' }}>

                                            <span className={`pd-ext-badge ${getIconClass(doc.extension)}`}>{doc.extension.toUpperCase()}</span>

                                            <span className="pd-doc-name">{doc.judul}</span>

                                            {activeTab === 'shared' && doc.owner && (
                                                <span className="pd-owner-badge">oleh {doc.owner.nama}</span>
                                            )}
                                        </div>

                                        <span className="pd-doc-meta">{formatSize(doc.size)}</span>

                                        <span className="pd-doc-meta">{new Date(doc.uploaded_at).toLocaleDateString('id-ID')}</span>

                                        <div className="pd-row-actions">
                                            <button type="button" onClick={() => bukaDokumen(doc)} className="pd-action-btn" title="Buka"><i className="fa-solid fa-eye"></i></button>
                                            <a href={`/api/personal/documents/${doc.id}/file?action=download`} download={doc.judul} className="pd-action-btn" title="Unduh"><i className="fa-solid fa-download"></i></a>
                                            {activeTab === 'mine' && canManage && (
                                                <button className={`pd-action-btn ${(doc.personal_document_shares && doc.personal_document_shares.length > 0) ? 'pd-action-share-active' : ''}`} title="Bagikan" onClick={() => setShareData({ id: doc.id, title: doc.judul, existingShares: doc.personal_document_shares || [] })}>
                                                    <i className="fa-solid fa-share-nodes"></i>
                                                </button>
                                            )}
                                            {(canManage || activeTab === 'shared') && (
                                                <button className="pd-action-btn danger" title={activeTab === 'mine' ? 'Hapus' : 'Lepas'} onClick={() => handleDeleteDoc(doc.id, doc.judul)}>
                                                    <i className={`fa-solid ${activeTab === 'mine' ? 'fa-trash-can' : 'fa-link-slash'}`}></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                            </div>



                            {/* Mobile cards */}

                            <div className="pd-mobile-cards">

                                {filteredDocuments.map(doc => (

                                    <div key={doc.id} className={`pd-mobile-card ${selectedIds.includes(doc.id) ? 'selected' : ''}`}>

                                        <div className="pd-mobile-card-main">
                                            <div className="pd-mobile-card-check">
                                                <input type="checkbox" className="pd-checkbox" checked={selectedIds.includes(doc.id)} onChange={() => toggleSelectArr(doc.id)} />
                                            </div>

                                            <div className="pd-mobile-card-content">
                                                <div className="pd-mobile-card-name">{doc.judul}</div>
                                                <div className="pd-mobile-card-sub">
                                                    <span className={`pd-ext-badge ${getIconClass(doc.extension)}`}>{doc.extension.toUpperCase()}</span>
                                                    <span>{formatSize(doc.size)}</span>
                                                    <span>{new Date(doc.uploaded_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    {activeTab === 'shared' && doc.owner && <span className="pd-owner-badge">oleh {doc.owner.nama}</span>}
                                                </div>
                                            </div>

                                            <div className="pd-mobile-card-menu-wrap">
                                                <button
                                                    type="button"
                                                    className="pd-action-btn"
                                                    onClick={() => setOpenCardMenu(prev => prev === doc.id ? null : doc.id)}
                                                    title="Menu aksi"
                                                    aria-haspopup="menu"
                                                    aria-expanded={openCardMenu === doc.id}
                                                >
                                                    <i className="fa-solid fa-ellipsis-vertical"></i>
                                                </button>
                                                {openCardMenu === doc.id && (
                                                    <div className="pd-mobile-card-menu" role="menu">
                                                        <button type="button" role="menuitem" className="pd-mobile-card-menu-item" onClick={() => { setOpenCardMenu(null); bukaDokumen(doc); }}>
                                                            <i className="fa-solid fa-eye"></i> Buka
                                                        </button>
                                                        <a role="menuitem" className="pd-mobile-card-menu-item" href={`/api/personal/documents/${doc.id}/file?action=download`} download={doc.judul} onClick={() => setOpenCardMenu(null)}>
                                                            <i className="fa-solid fa-download"></i> Unduh
                                                        </a>
                                                        {activeTab === 'mine' && canManage && (
                                                            <button type="button" role="menuitem" className={`pd-mobile-card-menu-item ${(doc.personal_document_shares && doc.personal_document_shares.length > 0) ? 'pd-action-share-active' : ''}`} onClick={() => { setOpenCardMenu(null); setShareData({ id: doc.id, title: doc.judul, existingShares: doc.personal_document_shares || [] }); }}>
                                                                <i className="fa-solid fa-share-nodes"></i> Bagikan
                                                            </button>
                                                        )}
                                                        {(canManage || activeTab === 'shared') && (
                                                            <button type="button" role="menuitem" className="pd-mobile-card-menu-item danger" onClick={() => { setOpenCardMenu(null); handleDeleteDoc(doc.id, doc.judul); }}>
                                                                <i className={`fa-solid ${activeTab === 'mine' ? 'fa-trash-can' : 'fa-link-slash'}`}></i> {activeTab === 'mine' ? 'Hapus' : 'Lepas'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                ))}

                            </div>

                        </>

                    ) : (
                        <div className="pd-empty">
                            <div className="pd-empty-icon">
                                {searchQuery ? <i className="fa-solid fa-magnifying-glass"></i> : <i className="fa-solid fa-folder-open"></i>}
                            </div>
                            <h3>{searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Belum ada dokumen'}</h3>
                            <p>{searchQuery ? 'Coba kata kunci lain' : activeTab === 'shared' ? 'Belum ada dokumen yang dibagikan ke Anda' : 'Klik Unggah File untuk menambahkan dokumen pertama'}</p>
                            {!searchQuery && activeTab === 'mine' && canManage && (
                                <button className="pd-btn pd-btn-primary" onClick={() => setIsUploadOpen(true)}>
                                    <i className="fa-solid fa-cloud-arrow-up"></i> Unggah File Pertama
                                </button>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Aksi utama halaman: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
            {canManage && (
                <>
                    <DesktopFab
                        label="Unggah File"
                        icon={<i className="fa-solid fa-cloud-arrow-up" />}
                        mobileLabel="Unggah"
                        mobileIcon="cloud-arrow-up"
                        onClick={() => setIsUploadOpen(true)}
                    />
                </>
            )}

            {/* ── MODALS ── */}
            {isUploadOpen && typeof document !== 'undefined' && createPortal(
                <UploadModal
                    isOpen={isUploadOpen}
                    onClose={() => setIsUploadOpen(false)}
                    onSuccess={fetchData}
                    folders={folders}
                    currentFolderId={selectedFolder}
                    totalStorageBytes={totalStorageBytes}
                    maxStorageBytes={MAX_STORAGE_BYTES}
                />,
                document.body
            )}

            {shareData && typeof document !== 'undefined' && createPortal(
                <ShareModal
                    isOpen={!!shareData}
                    onClose={() => setShareData(null)}
                    id={shareData.id}
                    ids={shareData.ids}
                    folderId={shareData.folderId}
                    title={shareData.title}
                    existingShares={shareData.existingShares}
                    onShareChange={fetchData}
                />,
                document.body
            )}

            {moveData && typeof document !== 'undefined' && createPortal(
                <div className="jt__modal" onClick={() => setMoveData(null)}>
                    <div className="jt__modalContent !p-0 border-0" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-t-2xl">
                            <h3 className="m-0 text-white">Pindahkan Dokumen</h3>
                            <p className="text-xs text-blue-200 mt-1">Pindahkan "{moveData.doc.judul}" ke folder lain</p>
                        </div>
                        <div className="p-8">
                            <div className="space-y-4">
                                <label className="jt__formLabel">Pilih Folder Tujuan</label>
                                <div className="grid gap-3">
                                    <div
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${moveFolder === '__root__' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                                        onClick={() => setMoveFolder('__root__')}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                                            <i className="fa-solid fa-folder-tree"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700">Root Directory</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Folder Utama</p>
                                        </div>
                                    </div>
                                    {folders.map(f => (
                                        <div
                                            key={f.id}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${moveFolder === f.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                                            onClick={() => setMoveFolder(f.id)}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <i className="fa-solid fa-folder"></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700">{f.nama}</p>
                                                <p className="text-[10px] text-blue-400 font-bold uppercase">Folder Personal</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex gap-3 rounded-b-2xl">
                            <button className="jt__btn flex-1" onClick={() => setMoveData(null)}>Batal</button>
                            <button className="jt__btn jt__btnPrimary flex-1" onClick={handleMoveDoc} disabled={isMoving}>
                                {isMoving ? 'Memindahkan...' : 'Pindahkan Sekarang'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {batchMoveOpen && typeof document !== 'undefined' && createPortal(
                <div className="jt__modal" onClick={() => setBatchMoveOpen(false)}>
                    <div className="jt__modalContent !p-0 border-0" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-t-2xl">
                            <h3 className="m-0 text-white">Pindahkan {selectedIds.length} Dokumen</h3>
                            <p className="text-xs text-blue-200 mt-1">Pindahkan item terpilih ke folder baru</p>
                        </div>
                        <div className="p-8">
                            <div className="space-y-4">
                                <label className="jt__formLabel">Pilih Folder Tujuan</label>
                                <div className="grid gap-3">
                                    <div
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${moveFolder === '__root__' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                                        onClick={() => setMoveFolder('__root__')}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                                            <i className="fa-solid fa-folder-tree"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700">Root Directory</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Folder Utama</p>
                                        </div>
                                    </div>
                                    {folders.map(f => (
                                        <div
                                            key={f.id}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${moveFolder === f.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                                            onClick={() => setMoveFolder(f.id)}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <i className="fa-solid fa-folder"></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700">{f.nama}</p>
                                                <p className="text-[10px] text-blue-400 font-bold uppercase">Folder Personal</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex gap-3 rounded-b-2xl">
                            <button className="jt__btn flex-1" onClick={() => setBatchMoveOpen(false)}>Batal</button>
                            <button className="jt__btn jt__btnPrimary flex-1" onClick={handleBatchMove} disabled={isMoving}>
                                {isMoving ? 'Memindahkan...' : 'Pindahkan Sekarang'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {manageShareData && typeof document !== 'undefined' && createPortal(
                <div className="jt__modal" onClick={() => setManageShareData(null)}>
                    <div className="jt__modalContent !p-0 border-0" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-t-2xl">
                            <h3 className="m-0 text-white">Kelola Berbagi</h3>
                            <p className="text-xs text-blue-200 mt-1">{manageShareData.title}</p>
                        </div>
                        <div className="p-0">
                            <div className="max-h-[400px] overflow-y-auto">
                                {manageShareData.shares.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            <i className="fa-solid fa-users-slash text-2xl"></i>
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase text-[10px]">Belum dibagikan ke siapapun</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {manageShareData.shares.map(s => (
                                            <div key={s.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg">
                                                        {(s.shared_with?.nama || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-extrabold text-slate-800">{s.shared_with?.nama}</p>
                                                        <p className="text-xs text-slate-400 font-bold">@{s.shared_with?.username}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                                                    disabled={isRevoking === s.id}
                                                    onClick={() => handleRevokeShare(s.id, manageShareData.type)}
                                                    title="Batalkan Akses"
                                                >
                                                    {isRevoking === s.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-user-minus"></i>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t rounded-b-2xl">
                            <button className="jt__btn w-full" onClick={() => setManageShareData(null)}>Tutup</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {viewer}

        </div>
        </MaintenanceBanner>

    );
}


function getFileIcon(ext: string) {

    const e = ext?.toLowerCase();

    if (e === 'pdf') return 'fa-file-pdf';

    if (['doc', 'docx'].includes(e)) return 'fa-file-word';

    if (['xls', 'xlsx', 'csv'].includes(e)) return 'fa-file-excel';

    if (e === 'jpg') return 'fa-image';

    if (e === 'jpeg') return 'fa-image';

    if (e === 'png') return 'fa-image';

    if (['gif', 'webp', 'svg', 'bmp', 'tiff'].includes(e)) return 'fa-image';

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'fa-file-zipper';

    if (['ppt', 'pptx'].includes(e)) return 'fa-file-powerpoint';

    if (['txt', 'rtf', 'log'].includes(e)) return 'fa-file-lines';

    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(e)) return 'fa-file-audio';

    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(e)) return 'fa-file-video';

    if (['html', 'css', 'js', 'ts', 'json', 'xml'].includes(e)) return 'fa-file-code';

    return 'fa-file';

}



function getIconClass(ext: string) {

    const e = ext?.toLowerCase();

    if (e === 'pdf') return 'pdf';

    if (['doc', 'docx'].includes(e)) return 'word';

    if (['xls', 'xlsx', 'csv'].includes(e)) return 'excel';

    if (['jpg', 'jpeg'].includes(e)) return 'jpg';

    if (e === 'png') return 'png';

    if (['gif', 'webp', 'svg', 'bmp', 'tiff'].includes(e)) return 'image';

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'zip';

    if (['ppt', 'pptx'].includes(e)) return 'ppt';

    if (['txt', 'rtf', 'log', 'html', 'css', 'js', 'ts', 'json', 'xml'].includes(e)) return 'text';

    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(e)) return 'audio';

    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(e)) return 'video';

    return 'default';

}


