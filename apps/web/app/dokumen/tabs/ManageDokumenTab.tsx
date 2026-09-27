'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import Swal from 'sweetalert2'
import { ensureAbsoluteUrl } from '@/lib/url'
import { useModalBlur } from '@/components/ModalBlurProvider'
import Pagination from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar'
import { Button } from '@/components/ui/Button'
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons'
import Modal, { ModalBody, ModalFooter } from '@/components/ui/Modal'
import { isUserAdmin, getUserRoles } from '@/lib/auth-client'

// Use PDFViewerWrapper instead of direct dynamic import to prevent
// react-pdf/pdfjs-dist Object.defineProperty crash in webpack Evaluate phase
const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false })

interface BulkFilePreview {
    file: File
    previewName: string
    detectedId: string | null
    detectedType: 'NIP' | 'NISN' | null
}

export default function ManageDokumenTab({ user, canManageOverride }: { user?: any; canManageOverride?: boolean }) {
    const userRoles = useMemo(() => {
        return getUserRoles(user);
    }, [user]);

    const isAdmin = useMemo(() => {
        return isUserAdmin(user);
    }, [user]);

    const canManage = typeof canManageOverride === 'boolean' ? canManageOverride : isAdmin;
    const [categories, setCategories] = useState<any[]>([])
    const [documents, setDocuments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isDownloading, setIsDownloading] = useState(false)
    const [filterCategory, setFilterCategory] = useState('')
    const [filterUploader, setFilterUploader] = useState('')
    const [filterUploaderDebounced, setFilterUploaderDebounced] = useState('')
    const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null)
    // Bulk upload state
    const [bulkFiles, setBulkFiles] = useState<BulkFilePreview[]>([])
    const [bulkCategoryId, setBulkCategoryId] = useState('')
    const [bulkUploading, setBulkUploading] = useState(false)
    const [bulkProgress, setBulkProgress] = useState(0)
    const [bulkDragOver, setBulkDragOver] = useState(false)
    const bulkFileInputRef = useRef<HTMLInputElement>(null)
    // Folder settings modal state
    const [folderSettingsModalOpen, setFolderSettingsModalOpen] = useState(false)
    const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [newFolderRole, setNewFolderRole] = useState<string>('semua')
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
    const [editingFolderName, setEditingFolderName] = useState('')
    const [editingFolderRole, setEditingFolderRole] = useState<string>('semua')
    const [folderSaving, setFolderSaving] = useState(false)

    const getTargetRoleLabel = (role?: string) => {
        const r = (role || 'semua').toLowerCase();
        if (r === 'semua' || r === 'all') return 'Semua Role';
        if (r === 'guru') return 'Guru';
        if (r === 'siswa') return 'Siswa';
        if (r === 'staf' || r === 'tu' || r === 'tata_usaha') return 'Staf';
        if (r === 'orang_tua' || r === 'orangtua' || r === 'wali') return 'Orang Tua';
        return r.toUpperCase();
    };

    // Pagination & Selection State
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [totalItems, setTotalItems] = useState(0)
    const [selectedDocs, setSelectedDocs] = useState<string[]>([])

    // Modal blur - sync with global blur context
    const { openModal, closeModal } = useModalBlur()

    // Extract NIP/NISN from filename (mirrors API logic)
    const extractIdentifier = (fileName: string): { id: string; type: 'NIP' | 'NISN' } | null => {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
        // Pattern: NIP_xxxxx or NISN_xxxxx
        const explicitMatch = nameWithoutExt.match(/^(NIP|NISN)[_-](\d+)/i)
        if (explicitMatch) {
            return { id: explicitMatch[2], type: explicitMatch[1].toUpperCase() as 'NIP' | 'NISN' }
        }
        // Pattern: starts with numeric ID
        const numericMatch = nameWithoutExt.match(/^(\d+)/)
        if (numericMatch) {
            const id = numericMatch[1]
            if (id.length === 18) return { id, type: 'NIP' }
            if (id.length === 10) return { id, type: 'NISN' }
        }
        return null
    }

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase()
        if (ext === 'pdf') return 'bi-file-earmark-pdf-fill'
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'bi-image'
        if (['doc', 'docx'].includes(ext || '')) return 'bi-file-earmark-word'
        if (['xls', 'xlsx'].includes(ext || '')) return 'bi-file-earmark-excel'
        return 'bi-file-earmark'
    }

    const processBulkFiles = (fileList: FileList | File[]) => {
        const processed: BulkFilePreview[] = []
        for (const file of fileList) {
            if (file.size > 20 * 1024 * 1024) {
                Swal.fire('Error', `"${file.name}" terlalu besar (maks 20MB)`, 'error')
                continue
            }
            const identifier = extractIdentifier(file.name)
            processed.push({
                file,
                previewName: file.name,
                detectedId: identifier?.id || null,
                detectedType: identifier?.type || null
            })
        }
        setBulkFiles(prev => [...prev, ...processed])
    }

    const handleBulkDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setBulkDragOver(false)
        if (e.dataTransfer.files) {
            processBulkFiles(e.dataTransfer.files)
        }
    }

    const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processBulkFiles(e.target.files)
            e.target.value = ''
        }
    }

    const removeBulkFile = (index: number) => {
        setBulkFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleBulkUpload = async () => {
        if (bulkFiles.length === 0 || !bulkCategoryId) return

        const category = categories.find(c => c.id === bulkCategoryId)
        if (!category) {
            Swal.fire('Error', 'Folder tidak ditemukan', 'error')
            return
        }

        const unverified = bulkFiles.filter(f => !f.detectedId)
        if (unverified.length > 0) {
            const result = await Swal.fire({
                title: 'Peringatan',
                html: `${unverified.length} file tidak memiliki NIP/NISN yang valid dan akan <strong>ditandai sebagai error</strong> oleh sistem. Lanjutkan?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Ya, Upload Saja',
                cancelButtonText: 'Batal'
            })
            if (!result.isConfirmed) return
        }

        setBulkUploading(true)
        setBulkProgress(0)

        try {
            let totalSuccess = 0;
            let totalError = 0;
            let allResults: any[] = [];
            let hasServerError = false;
            let serverErrorMsg = '';

            const chunkSize = 5;
            for (let i = 0; i < bulkFiles.length; i += chunkSize) {
                const chunk = bulkFiles.slice(i, i + chunkSize);
                
                const formData = new FormData();
                formData.append('category_id', bulkCategoryId);
                formData.append('category_name', category.name);
                formData.append('uploader_id', user?.id || '');
                formData.append('uploader_name', user?.nama_lengkap || user?.name || 'Admin');

                chunk.forEach((bf, j) => {
                    formData.append(`file_${j}`, bf.file);
                });

                const res = await fetch('/api/admin/bulk-upload-dokumen', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await res.json();
                
                if (result.ok) {
                    totalSuccess += result.summary.success;
                    totalError += result.summary.error;
                    if (result.results) {
                        allResults = [...allResults, ...result.results];
                    }
                } else {
                    hasServerError = true;
                    serverErrorMsg = result.error || 'Upload massal gagal pada beberapa file';
                    // We can choose to continue or break. Let's break to avoid spamming errors
                    break;
                }
                
                setBulkProgress(Math.round(((i + chunk.length) / bulkFiles.length) * 100));
            }

            if (hasServerError && totalSuccess === 0 && totalError === 0) {
                 Swal.fire('Error', serverErrorMsg, 'error');
            } else {
                let errorHtml = '';
                if (totalError > 0 && allResults.length > 0) {
                    const errorDetails = allResults
                        .filter((r: any) => r.status === 'error')
                        .map((r: any) => `<li><strong>${r.fileName}</strong>: ${r.message}</li>`)
                        .join('');
                    errorHtml = `<ul style="text-align: left; max-height: 150px; overflow-y: auto; font-size: 0.85em; background: #fee2e2; padding: 10px 10px 10px 25px; border-radius: 5px; color: #991b1b; margin-top: 10px;">${errorDetails}</ul>`;
                }

                Swal.fire({
                    icon: totalError > 0 ? (totalSuccess > 0 ? 'warning' : 'error') : 'success',
                    title: 'Upload Massal Selesai',
                    html: `
                        <p><strong>${totalSuccess}</strong> file berhasil diupload</p>
                        <p><strong>${totalError}</strong> file gagal</p>
                        ${errorHtml}
                    `
                });
                setBulkFiles([]);
                setBulkCategoryId('');
                fetchDocuments();
                setBulkUploadModalOpen(false);
            }
        } catch (err: any) {
            console.error('Bulk upload error:', err)
            Swal.fire('Error', err.message || 'Terjadi kesalahan saat upload massal', 'error')
        } finally {
            setBulkUploading(false)
            setBulkProgress(0)
        }
    }

    useEffect(() => {
        fetchCategories()
        fetchDocuments()
    }, [])

    // Debounce filter uploader
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilterUploaderDebounced(filterUploader)
        }, 500)
        return () => clearTimeout(timer)
    }, [filterUploader])

    // Auto-fetch when filters change
    useEffect(() => {
        if (categories.length > 0) {
            fetchDocuments()
        }
    }, [filterCategory, filterUploaderDebounced, currentPage, pageSize])

    // Sync modal blur with global context
    useEffect(() => {
        const isOpen = selectedDoc !== null || folderSettingsModalOpen || bulkUploadModalOpen;
        if (isOpen) {
            openModal();
        } else {
            closeModal();
        }
        return () => {
            closeModal();
        };
    }, [selectedDoc, folderSettingsModalOpen, bulkUploadModalOpen, openModal, closeModal])

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/upload-categories')
            const data = await res.json()
            if (data) setCategories(Array.isArray(data) ? data : (data.data || []))
        } catch (e) {
            console.error('Error fetching categories:', e)
        }
    }

    const fetchDocuments = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterCategory) params.set('categoryId', filterCategory)
            if (filterUploaderDebounced) params.set('uploaderName', filterUploaderDebounced)
            const res = await fetch('/api/uploaded-documents?' + params.toString())
            const data = await res.json()
            const list = Array.isArray(data) ? data : (data.data || [])
            setDocuments(list)
            setTotalItems(list.length)
        } catch (error) {
            console.error('Error fetching docs:', error)
            setDocuments([])
            setTotalItems(0)
        }
        setLoading(false)
    }, [filterCategory, filterUploaderDebounced, currentPage, pageSize])

    const handleDeleteDocument = async (id: string, fileName: string) => {
        const result = await Swal.fire({
            title: 'Hapus Dokumen?',
            text: `Anda akan menghapus "${fileName}". File fisik di storage juga akan ikut terhapus permanen.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        })

        if (result.isConfirmed) {
            try {
                const res = await fetch('/api/admin/bulk-upload-dokumen/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [id] })
                });
                const data = await res.json();
                
                if (!data.ok) throw new Error(data.error || 'Gagal menghapus dokumen');

                Swal.fire({
                    icon: 'success',
                    title: 'Terhapus',
                    text: 'Dokumen dan file fisiknya berhasil dihapus.',
                    timer: 1500,
                    showConfirmButton: false
                })
                fetchDocuments()
            } catch (err: any) {
                Swal.fire('Gagal', err.message || 'Gagal menghapus dokumen', 'error')
            }
        }
    }

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedDocs(documents.map(d => d.id))
        } else {
            setSelectedDocs([])
        }
    }

    const handleSelectDoc = (id: string) => {
        setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
    }

    const handleBulkDelete = async () => {
        if (selectedDocs.length === 0) return;
        const result = await Swal.fire({
            title: 'Hapus Dokumen Terpilih?',
            text: `Anda akan menghapus ${selectedDocs.length} dokumen. File fisik di storage juga akan ikut terhapus permanen.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus Semua',
            cancelButtonText: 'Batal'
        })

        if (result.isConfirmed) {
            try {
                const res = await fetch('/api/admin/bulk-upload-dokumen/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedDocs })
                });
                const data = await res.json();
                
                if (!data.ok) throw new Error(data.error || 'Gagal menghapus dokumen');

                Swal.fire('Terhapus', `${selectedDocs.length} dokumen beserta file fisiknya berhasil dihapus.`, 'success')
                setSelectedDocs([])
                fetchDocuments()
            } catch (err: any) {
                Swal.fire('Gagal', err.message || 'Gagal menghapus dokumen', 'error')
            }
        }
    }

    const handleView = (url: string, fileName: string) => {
        setSelectedDoc({ url: ensureAbsoluteUrl(url), title: fileName });
    };

    const handleDownload = async (doc: any) => {
        try {
            const response = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(ensureAbsoluteUrl(doc.file_url))}`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const blob = await response.blob()
            saveAs(blob, doc.file_name)
        } catch (err: any) {
            console.error(`Gagal mengunduh ${doc.file_name}:`, err)
            Swal.fire('Gagal', `Tidak dapat mengunduh "${doc.file_name}"`, 'error')
        }
    }

    const handleDownloadZip = async () => {
        const docsToDownload = selectedDocs.length > 0 
            ? documents.filter(d => selectedDocs.includes(d.id))
            : documents

        if (docsToDownload.length === 0) {
            Swal.fire('Info', 'Tidak ada dokumen untuk didownload.', 'info')
            return
        }

        setIsDownloading(true)
        const zip = new JSZip()
        const folder = zip.folder("dokumen_akademik")

        try {
            const promises = docsToDownload.map(async (doc) => {
                try {
                    const response = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(ensureAbsoluteUrl(doc.file_url))}`)
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
                    const blob = await response.blob()
                    const fileName = `${doc.uploader_name}_${doc.file_name}`
                    folder?.file(fileName, blob)
                } catch (err) {
                    console.error(`Gagal mendownload ${doc.file_name}:`, err)
                }
            })

            await Promise.all(promises)
            const content = await zip.generateAsync({ type: "blob" })
            const zipFileName = selectedDocs.length > 0 
                ? `dokumen_terpilih_${selectedDocs.length}.zip`
                : "semua_dokumen_akademik.zip"
            saveAs(content, zipFileName)
            Swal.fire('Berhasil!', `File ZIP (${docsToDownload.length} dokumen) berhasil dibuat.`, 'success')
        } catch (error) {
            console.error('Zip error:', error)
            Swal.fire('Error', 'Gagal membuat file ZIP.', 'error')
        } finally {
            setIsDownloading(false)
        }
    }

    // Folder modal inline handlers
    const handleAddFolderInline = async () => {
        if (!newFolderName.trim()) {
            Swal.fire('Peringatan', 'Nama folder tidak boleh kosong', 'warning')
            return
        }
        setFolderSaving(true)
        try {
            const res = await fetch('/api/upload-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newFolderName.trim(),
                    target_role: newFolderRole
                })
            })
            if (!res.ok) throw new Error('Gagal menambahkan folder')
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: `Folder "${newFolderName}" berhasil ditambahkan`,
                timer: 1500,
                showConfirmButton: false
            })
            setNewFolderName('')
            setNewFolderRole('semua')
            fetchCategories()
            fetchDocuments()
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error')
        } finally {
            setFolderSaving(false)
        }
    }

    const handleSaveEditInline = async (cat: any) => {
        if (!editingFolderName.trim()) {
            Swal.fire('Peringatan', 'Nama folder tidak boleh kosong', 'warning')
            return
        }
        setFolderSaving(true)
        try {
            const res = await fetch(`/api/upload-categories/${cat.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: editingFolderName.trim(),
                    target_role: editingFolderRole
                })
            })
            if (!res.ok) throw new Error('Gagal memperbarui folder')

            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: `Folder berhasil diperbarui`,
                timer: 1500,
                showConfirmButton: false
            })
            setEditingFolderId(null)
            fetchCategories()
            fetchDocuments()
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error')
        } finally {
            setFolderSaving(false)
        }
    }

    const handleDeleteFolderModal = async (cat: any) => {
        const result = await Swal.fire({
            title: 'Hapus Folder?',
            html: `Folder "${cat.name}" dan semua dokumen di dalamnya akan dihapus. Lanjutkan?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        })
        if (result.isConfirmed) {
            await fetch(`/api/upload-categories/${cat.id}`, { method: 'DELETE' })
            fetchCategories()
            fetchDocuments()
            Swal.fire('Berhasil', 'Folder berhasil dihapus', 'success')
        }
    }

    return (
        <div className="ds-container">
            {/* Standalone FilterToolbar placed right below the tab */}
            <FilterToolbar>
                <FilterSelect
                    label="Folder"
                    icon="folder2"
                    value={filterCategory}
                    onChange={setFilterCategory}
                    width={180}
                >
                    <option value="">Semua Folder</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name} ({getTargetRoleLabel(cat.target_role)})
                        </option>
                    ))}
                </FilterSelect>

                <FilterSearch
                    label="Cari"
                    value={filterUploader}
                    onChange={setFilterUploader}
                    placeholder="Ketik nama pengunggah..."
                    grow={1}
                />

                <FilterActions>
                    {(filterCategory || filterUploader) && (
                        <button
                            type="button"
                            onClick={() => { setFilterCategory(''); setFilterUploader('') }}
                            className="ftb-btn ftb-btn--reset"
                            title="Reset filter"
                        >
                            <i className="bi bi-x-circle"></i> Reset
                        </button>
                    )}
                    {selectedDocs.length > 0 && canManage && (
                        <Button
                            variant="danger"
                            size="md"
                            onClick={handleBulkDelete}
                            title="Hapus Terpilih"
                            leftIcon={<i className="bi bi-trash-fill" />}
                        >
                            <span className="btn-text-desktop">Hapus ({selectedDocs.length})</span>
                            <span className="btn-text-mobile">Hapus ({selectedDocs.length})</span>
                        </Button>
                    )}
                    {canManage && (
                        <>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setBulkUploadModalOpen(true)}
                                title="Upload Massal"
                                leftIcon={<i className="bi bi-cloud-arrow-up-fill" />}
                            >
                                <span className="btn-text-desktop">Upload Massal</span>
                                <span className="btn-text-mobile">Upload</span>
                            </Button>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setFolderSettingsModalOpen(true)}
                                title="Pengaturan Folder"
                                leftIcon={<i className="bi bi-folder-fill" />}
                            >
                                <span className="btn-text-desktop">Pengaturan Folder</span>
                                <span className="btn-text-mobile">Folder</span>
                            </Button>
                        </>
                    )}
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleDownloadZip}
                        disabled={isDownloading || documents.length === 0}
                        isLoading={isDownloading}
                        leftIcon={!isDownloading ? <i className="bi bi-file-earmark-zip" /> : undefined}
                    >
                        {isDownloading ? (
                            'Mengompres...'
                        ) : (
                            <>
                                <span className="btn-text-desktop">
                                    Download ZIP ({selectedDocs.length > 0 ? selectedDocs.length : documents.length})
                                </span>
                                <span className="btn-text-mobile">
                                    ZIP ({selectedDocs.length > 0 ? selectedDocs.length : documents.length})
                                </span>
                            </>
                        )}
                    </Button>
                </FilterActions>
            </FilterToolbar>

            <div className="ds-table-wrap">
                    <table className="ds-table">
                        <thead>
                            <tr>
                                {canManage && (
                                    <th className="cell-checkbox" style={{ width: '40px', textAlign: 'center' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={documents.length > 0 && selectedDocs.length === documents.length}
                                            onChange={handleSelectAll}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </th>
                                )}
                                <th className="cell-uploader">Pengunggah</th>
                                <th className="cell-folder">Folder</th>
                                <th className="cell-file">File/Dokumen</th>
                                <th className="cell-action" style={{ textAlign: 'right', paddingRight: '16px' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={canManage ? 5 : 4} className="loading-cell"><Spinner variant="trace" /></td></tr>
                            ) : documents.length === 0 ? (
                                <tr><td colSpan={canManage ? 5 : 4} className="loading-cell">Belum ada dokumen yang diunggah.</td></tr>
                            ) : documents.map(doc => (
                                <tr key={doc.id} className={selectedDocs.includes(doc.id) ? 'selected-row' : ''}>
                                    {canManage && (
                                        <td className="cell-checkbox" style={{ textAlign: 'center' }}>
                                            <input 
                                                type="checkbox"
                                                checked={selectedDocs.includes(doc.id)}
                                                onChange={() => handleSelectDoc(doc.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                    )}
                                    <td className="cell-uploader" data-label="Pengunggah">
                                        <div className="uploader-cell">
                                            <span className="u-name">{doc.uploader_name}</span>
                                            <span className="u-role">{doc.uploader_role}</span>
                                        </div>
                                    </td>
                                    <td className="cell-folder" data-label="Folder"><span className="folder-tag">{doc.category_name}</span></td>
                                    <td className="cell-file" data-label="File">
                                        <div className="file-info">
                                            <i className={`bi ${doc.file_name.toLowerCase().endsWith('.pdf') ? 'bi-file-earmark-pdf-fill' : 'bi-image'}`}></i>
                                            <div className="file-details">
                                                <span className="file-name-text" title={doc.file_name}>{doc.file_name}</span>
                                                <span className="file-date-sub">
                                                    <i className="bi bi-calendar3" style={{ fontSize: '10px', marginRight: '4px' }}></i>
                                                    {new Date(doc.created_at).toLocaleDateString('id-ID')}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="cell-action" data-label="Aksi" style={{ paddingRight: '16px' }}>
                                        <ActionGroup>
                                            <ActionButton
                                                action="view"
                                                onClick={() => handleView(doc.file_url, doc.file_name)}
                                                title="Buka Dokumen"
                                            />
                                            <ActionButton
                                                action="download"
                                                onClick={() => handleDownload(doc)}
                                                title="Unduh Dokumen"
                                            />
                                            <ActionButton
                                                action="delete"
                                                onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                                                title={!canManage ? "Anda tidak memiliki izin" : "Hapus Dokumen"}
                                                disabled={!canManage}
                                            />
                                        </ActionGroup>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalItems > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <Pagination itemLabel="dokumen"
                            currentPage={currentPage}
                            totalPages={Math.ceil(totalItems / pageSize)}
                            limit={pageSize}
                            totalItems={totalItems}
                            onPageChange={setCurrentPage}
                            onLimitChange={(newLimit) => {
                                setCurrentPage(1)
                                setPageSize(newLimit)
                            }}
                        />
                    </div>
                )}

            <style jsx>{`
                .ds-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* ── SECTIONS ── */
                .ds-section {
                    background: transparent;
                    border: none;
                    padding: 0;
                    box-shadow: none;
                }
                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 18px;
                }
                .section-title i { font-size: 1.3rem; color: var(--n-primary); }
                .section-title h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--n-ink); }
                .section-title .btn-add-folder {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s;
                    font-family: inherit;
                }
                .section-title .btn-add-folder:hover { filter: brightness(1.1); transform: translateY(-1px); }
                .section-title .btn-add-folder i { font-size: 0.9rem; }

                /* ── FOLDER GRID ── */
                    gap: 6px;
                    white-space: nowrap;
                }
                .ds-input-group button:hover:not(:disabled) {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                }
                .ds-input-group button:disabled { opacity: 0.5; cursor: not-allowed; }

                /* ── FOLDER GRID ── */
                .ds-folder-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 12px;
                }
                .ds-folder-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    transition: all 0.2s;
                    cursor: default;
                }
                .ds-folder-card:hover { border-color: var(--n-primary); background: var(--n-card); box-shadow: 0 4px 12px rgba(0,0,0,0.06); transform: translateY(-1px); }
                .folder-info { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
                .folder-info i { font-size: 1.5rem; color: var(--n-primary); flex-shrink: 0; }
                .folder-info span {
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--n-ink);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .folder-actions { display: flex; gap: 4px; flex-shrink: 0; }
                .btn-edit-mini, .btn-del-mini {
                    width: 30px; height: 30px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    transition: all 0.15s;
                    border-radius: 8px;
                }
                .btn-edit-mini { color: var(--n-muted); }
                .btn-edit-mini:hover { color: var(--n-primary); border-color: var(--n-primary); background: rgba(59,130,246,0.08); }
                .btn-del-mini { color: var(--n-muted); }
                .btn-del-mini:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.08); }
                .empty-text { font-size: 0.82rem; color: var(--n-muted); font-style: italic; }

                /* ── FOLDER MODAL ── */
                .fm-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: fadeIn 0.2s ease;
                }
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                .fm-modal {
                    background: var(--n-card);
                    border-radius: 20px;
                    border: 1px solid var(--n-border);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                    width: 100%;
                    max-width: 480px;
                    animation: slideUp 0.25s ease;
                    overflow: hidden;
                }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
                .fm-header {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, var(--n-primary) 0%, #002a7a 100%);
                    color: white;
                }
                .fm-icon {
                    width: 48px; height: 48px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .fm-icon i { font-size: 1.4rem; }
                .fm-title-group { flex: 1; min-width: 0; }
                .fm-title-group h2 { font-size: 1rem; font-weight: 700; margin: 0 0 2px; }
                .fm-title-group p { font-size: 0.75rem; margin: 0; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .fm-close {
                    width: 32px; height: 32px;
                    background: rgba(255,255,255,0.15);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s;
                    font-size: 0.9rem;
                    flex-shrink: 0;
                }
                .fm-close:hover { background: rgba(255,255,255,0.25); }
                .fm-body { padding: 24px; }
                .fm-field { display: flex; flex-direction: column; gap: 8px; }
                .fm-field label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .fm-field label i { color: var(--n-primary); }
                .fm-field input {
                    padding: 12px 16px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 12px;
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.15s;
                    font-family: inherit;
                    background: var(--n-soft);
                    color: var(--n-ink);
                }
                .fm-field input:focus { border-color: var(--n-primary); background: var(--n-card); }
                .fm-hint {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.72rem;
                    color: var(--n-muted);
                }
                .fm-warning {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 12px 14px;
                    background: rgba(245,158,11,0.1);
                    border: 1px solid rgba(245,158,11,0.3);
                    border-radius: 10px;
                    margin-top: 12px;
                }
                .fm-warning i { color: #d97706; font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
                .fm-warning span { font-size: 0.78rem; color: #92400e; line-height: 1.4; }
                .fm-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 24px;
                    border-top: 1px solid var(--n-border);
                    background: var(--n-soft);
                }
                .fm-btn-cancel {
                    padding: 10px 20px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.15s;
                    font-family: inherit;
                }
                .fm-btn-cancel:hover { border-color: var(--n-ink); color: var(--n-ink); }
                .fm-btn-save {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 22px;
                    background: var(--n-primary);
                    border: none;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: white;
                    cursor: pointer;
                    transition: all 0.15s;
                    font-family: inherit;
                }
                .fm-btn-save:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
                .fm-btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .fm-spinner {
                    width: 14px; height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    display: inline-block;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* ── TOOLBAR ── */
                .ds-toolbar {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    margin-bottom: 16px;
                    gap: 12px;
                }
                .toolbar-left { display: flex; align-items: center; gap: 10px; }
                .toolbar-left i { font-size: 1.3rem; color: var(--n-primary); }
                .toolbar-left h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--n-ink); }
                .btn-zip {
                    padding: 8px 16px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .btn-zip:hover { filter: brightness(1.08); transform: translateY(-1px); }
                .btn-zip:disabled { opacity: 0.5; cursor: not-allowed; }

                .btn-folder-settings {
                    padding: 8px 16px;
                    background: var(--n-soft);
                    color: var(--n-primary);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .btn-folder-settings:hover {
                    border-color: var(--n-primary);
                    background: var(--n-card);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                .btn-bulk-upload-trigger {
                    padding: 8px 16px;
                    background: var(--n-soft);
                    color: var(--n-primary);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.15s;
                    white-space: nowrap;
                    font-family: inherit;
                }
                .btn-bulk-upload-trigger:hover {
                    border-color: var(--n-primary);
                    background: var(--n-card);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                .inline-add-section {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .inline-label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .inline-add-row {
                    display: flex;
                    gap: 8px;
                }
                .inline-add-row input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    outline: none;
                    background: var(--n-soft);
                    color: var(--n-ink);
                    transition: all 0.15s;
                    font-family: inherit;
                }
                .inline-add-row input:focus {
                    border-color: var(--n-primary);
                    background: var(--n-card);
                }
                .inline-add-row select {
                    padding: 10px 14px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    outline: none;
                    background: var(--n-soft);
                    color: var(--n-ink);
                    transition: all 0.15s;
                    font-family: inherit;
                    cursor: pointer;
                }
                .inline-add-row select:focus {
                    border-color: var(--n-primary);
                    background: var(--n-card);
                }
                .btn-add-inline {
                    padding: 0 16px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.15s;
                }
                .btn-add-inline:hover:not(:disabled) {
                    filter: brightness(1.1);
                    transform: translateY(-1px);
                }
                .btn-add-inline:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .inline-list-section {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .inline-folder-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-height: 250px;
                    overflow-y: auto;
                    padding-right: 4px;
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 8px;
                    background: var(--n-soft);
                }
                .inline-folder-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    transition: all 0.15s;
                }
                .inline-folder-item:hover:not(.editing) {
                    border-color: var(--n-primary);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                }
                .inline-folder-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    flex: 1;
                }
                .inline-folder-info i {
                    font-size: 1.15rem;
                    color: var(--n-primary);
                    flex-shrink: 0;
                }
                .inline-folder-name {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-ink);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                    min-width: 0;
                }
                .inline-folder-actions {
                    display: flex;
                    gap: 4px;
                    flex-shrink: 0;
                }

                .inline-edit-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    width: 100%;
                }
                .inline-edit-row input {
                    flex: 1;
                    padding: 6px 10px;
                    border: 1.5px solid var(--n-primary);
                    border-radius: 8px;
                    font-size: 0.82rem;
                    outline: none;
                    background: var(--n-card);
                    color: var(--n-ink);
                    font-family: inherit;
                }
                .inline-edit-row select {
                    padding: 6px 10px;
                    border: 1.5px solid var(--n-primary);
                    border-radius: 8px;
                    font-size: 0.82rem;
                    outline: none;
                    background: var(--n-card);
                    color: var(--n-ink);
                    font-family: inherit;
                    cursor: pointer;
                }
                .role-badge {
                    font-size: 0.65rem;
                    padding: 2px 7px;
                    border-radius: 6px;
                    font-weight: 700;
                    text-transform: uppercase;
                    flex-shrink: 0;
                    white-space: nowrap !important;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .role-badge.semua, .role-badge.all {
                    background: rgba(147, 51, 234, 0.12);
                    color: #9333ea;
                }
                .role-badge.siswa {
                    background: rgba(16, 185, 129, 0.12);
                    color: #059669;
                }
                .role-badge.guru {
                    background: rgba(59, 130, 246, 0.12);
                    color: var(--n-primary);
                }
                .role-badge.staf, .role-badge.tu, .role-badge.tata_usaha {
                    background: rgba(245, 158, 11, 0.12);
                    color: #d97706;
                }
                .role-badge.orang_tua, .role-badge.orangtua, .role-badge.wali {
                    background: rgba(236, 72, 153, 0.12);
                    color: #db2777;
                }
                .btn-save-inline, .btn-cancel-inline {
                    width: 28px;
                    height: 28px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: all 0.15s;
                    background: var(--n-card);
                }
                .btn-save-inline {
                    color: #0284c7;
                    border-color: rgba(2, 132, 199, 0.4);
                }
                .btn-save-inline:hover:not(:disabled) {
                    background: rgba(2, 132, 199, 0.1);
                    border-color: #0284c7;
                }
                .btn-cancel-inline {
                    color: var(--n-muted);
                }
                .btn-cancel-inline:hover:not(:disabled) {
                    color: #ef4444;
                    border-color: #ef4444;
                    background: rgba(239, 68, 68, 0.08);
                }
                .empty-inline-list {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 30px;
                    color: var(--n-muted);
                    gap: 6px;
                }
                .empty-inline-list i {
                    font-size: 1.8rem;
                }
                .empty-inline-list p {
                    margin: 0;
                    font-size: 0.78rem;
                    font-style: italic;
                }

                /* ── FILTERS ── */
                .ds-filters {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 24px;
                    background: var(--n-card);
                    padding: 18px 20px;
                    border-radius: 16px;
                    align-items: flex-end;
                    border: 1px solid var(--n-border);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
                }
                .filter-item { display: flex; flex-direction: column; gap: 8px; }
                .filter-item.search { flex: 1.5; }
                .filter-item.select-folder { flex: 1; }
                .filter-item label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .filter-item label i { font-size: 0.7rem; margin-right: 2px; }
                .filter-spinner {
                    display: inline-block;
                    width: 10px; height: 10px;
                    border: 1.5px solid var(--n-border);
                    border-top-color: var(--n-primary);
                    border-radius: 50%;
                    animation: spin 0.6s linear infinite;
                    margin-left: 5px;
                }
                .ds-filters select {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    outline: none;
                    background: var(--n-soft);
                    color: var(--n-ink);
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }
                .ds-filters select:focus {
                    border-color: var(--n-primary);
                    background-color: var(--n-card);
                    box-shadow: 0 0 0 3px rgba(30, 86, 211, 0.12);
                }
                .ds-filters select:hover:not(:focus) {
                    border-color: var(--n-muted);
                }
                .ds-filters select.loading { opacity: 0.7; cursor: wait; }
                .search-wrap { position: relative; display: flex; align-items: center; }
                .search-wrap i { position: absolute; left: 12px; color: var(--n-muted); font-size: 0.95rem; pointer-events: none; }
                .search-wrap input {
                    width: 100%;
                    padding: 10px 14px 10px 36px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    outline: none;
                    transition: all 0.2s ease;
                    background: var(--n-soft);
                    color: var(--n-ink);
                    padding-right: 38px;
                }
                .search-wrap input:focus {
                    border-color: var(--n-primary);
                    background-color: var(--n-card);
                    box-shadow: 0 0 0 3px rgba(30, 86, 211, 0.12);
                }
                .search-wrap input:hover:not(:focus) {
                    border-color: var(--n-muted);
                }
                .search-clear {
                    position: absolute;
                    right: 8px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--n-muted);
                    font-size: 0.9rem;
                    padding: 2px 4px;
                    display: flex;
                    align-items: center;
                    transition: color 0.15s;
                }
                .search-clear:hover { color: var(--n-ink); }
                .btn-refresh {
                    padding: 10px 18px;
                    background: var(--n-card);
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    color: var(--n-ink);
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    height: fit-content;
                }
                .btn-refresh:hover {
                    color: var(--n-primary);
                    border-color: var(--n-primary);
                    background: rgba(30, 86, 211, 0.04);
                }
                .btn-reset {
                    padding: 10px 18px;
                    background: rgba(239, 68, 68, 0.06);
                    border: 1.5px solid rgba(239, 68, 68, 0.2);
                    border-radius: 10px;
                    color: #ef4444;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }
                .btn-reset:hover {
                    background: rgba(239, 68, 68, 0.12);
                    border-color: #ef4444;
                }

                /* ── TABLE ── */
                .ds-table-wrap {
                    overflow-x: auto;
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    box-shadow: var(--n-shadow-soft);
                    max-width: 100%;
                }
                .ds-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    min-width: 0;
                    table-layout: fixed;
                }
                .ds-table th {
                    background: var(--n-soft);
                    padding: 10px 14px;
                    text-align: left;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--n-border);
                    white-space: nowrap;
                }
                .ds-table td {
                    padding: 11px 14px;
                    border-bottom: 1px solid var(--n-soft);
                    font-size: 0.84rem;
                    vertical-align: middle;
                    color: var(--n-ink);
                }
                .ds-table tbody tr:last-child td { border-bottom: none; }
                .ds-table tbody tr:hover td { background: var(--n-soft); }

                .cell-uploader { width: 250px; min-width: 230px; }
                .cell-folder { width: 150px; min-width: 140px; }
                .cell-file { min-width: 250px; overflow: hidden; }
                .cell-action {
                    width: 140px;
                    min-width: 140px;
                    text-align: right;
                    white-space: nowrap;
                }

                .uploader-cell { display: flex; flex-direction: column; gap: 2px; }
                .u-name { font-weight: 700; font-size: 0.88rem; color: var(--n-ink); }
                .u-role { font-size: 0.68rem; color: var(--n-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }

                .folder-tag {
                    padding: 3px 9px;
                    background: var(--n-soft);
                    color: var(--n-primary);
                    border: 1px solid var(--n-border);
                    border-radius: 6px;
                    font-size: 0.73rem;
                    font-weight: 700;
                    display: inline-block;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .file-info { display: flex; align-items: center; gap: 8px; font-weight: 500; }
                .file-info i { font-size: 1.25rem; color: #0284c7; flex-shrink: 0; }
                .file-details { display: flex; flex-direction: column; gap: 1px; min-width: 0; overflow: hidden; }
                .file-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.84rem; font-weight: 600; color: var(--n-ink); }
                .file-date-sub { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; display: flex; align-items: center; }

                .action-row { display: flex; gap: 3px; justify-content: center; align-items: center; }
                .btn-view, .btn-dl, .btn-del {
                    width: 26px; height: 26px;
                    border-radius: 6px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    cursor: pointer;
                    text-decoration: none;
                    flex-shrink: 0;
                    font-size: 0.78rem;
                }
                .btn-view { color: var(--n-primary); }
                .btn-view:hover { border-color: var(--n-primary); background: var(--n-soft); }
                .btn-dl { color: var(--n-primary); }
                .btn-dl:hover { border-color: var(--n-primary); background: var(--n-soft); }
                .btn-del { color: var(--n-muted); }
                .btn-del:hover { border-color: #ef4444; background: rgba(239,68,68,0.08); color: #ef4444; }

                .spinner {
                    width: 12px; height: 12px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.75s linear infinite;
                    display: inline-block;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .loading-cell { text-align: center; padding: 56px; color: var(--n-muted); font-size: 0.85rem; }

                /* ── BULK UPLOAD ── */
                .ds-bulk-upload { }
                .bulk-desc {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                    margin: -8px 0 16px;
                    line-height: 1.5;
                }
                .bulk-desc code {
                    background: var(--n-soft);
                    padding: 2px 6px;
                    border-radius: 5px;
                    font-size: 0.78rem;
                    color: var(--n-primary);
                    font-family: monospace;
                }
                .bulk-form { display: flex; flex-direction: column; gap: 12px; }
                .bulk-row {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .bulk-row label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .bulk-row select {
                    padding: 9px 14px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.85rem;
                    outline: none;
                    background: var(--n-card);
                    color: var(--n-ink);
                    cursor: pointer;
                    font-family: inherit;
                    transition: border-color 0.15s;
                }
                .bulk-row select:focus { border-color: var(--n-primary); }
                .bulk-row select:disabled { opacity: 0.5; cursor: not-allowed; }

                .bulk-dropzone {
                    border: 2px dashed var(--n-border);
                    border-radius: 14px;
                    padding: 24px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: var(--n-soft);
                    min-height: 120px;
                }
                .bulk-dropzone.drag-over {
                    border-color: var(--n-primary);
                    background: rgba(59, 130, 246, 0.08);
                }
                .bulk-dropzone:hover:not(.drag-over) { border-color: var(--n-primary); }

                .bulk-drop-idle { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--n-muted); }
                .bulk-drop-idle i { font-size: 2.5rem; }
                .bulk-drop-idle p { margin: 0; font-size: 0.88rem; color: var(--n-ink); }
                .bulk-drop-idle small { font-size: 0.75rem; color: var(--n-muted); }
                .bulk-browse { color: var(--n-primary); font-weight: 600; cursor: pointer; }

                .bulk-file-list { display: flex; flex-direction: column; gap: 8px; text-align: left; }
                .bulk-file-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    transition: all 0.15s;
                }
                .bulk-file-item:hover { border-color: var(--n-primary); }
                .bulk-file-item > i { font-size: 1.4rem; flex-shrink: 0; color: var(--n-primary); }
                .bulk-file-item > i.text-red { color: #0284c7; }
                .bulk-file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
                .bulk-file-name {
                    font-size: 0.83rem;
                    font-weight: 600;
                    color: var(--n-ink);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .bulk-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 5px;
                    width: fit-content;
                }
                .bulk-badge.nip {
                    background: rgba(59, 130, 246, 0.12);
                    color: var(--n-primary);
                }
                .bulk-badge.nisn {
                    background: rgba(16, 185, 129, 0.12);
                    color: #059669;
                }
                .bulk-badge-unknown {
                    background: rgba(245, 158, 11, 0.12);
                    color: #d97706;
                }
                .bulk-remove {
                    width: 26px; height: 26px;
                    border-radius: 6px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--n-muted);
                    transition: all 0.15s;
                    flex-shrink: 0;
                    font-size: 0.75rem;
                }
                .bulk-remove:hover { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,0.08); }
                .bulk-remove:disabled { opacity: 0.5; cursor: not-allowed; }

                .bulk-meta {
                    display: flex;
                    gap: 16px;
                    font-size: 0.78rem;
                    color: var(--n-muted);
                    flex-wrap: wrap;
                }
                .bulk-meta span { display: flex; align-items: center; gap: 5px; }
                .bulk-meta span.warn { color: #d97706; }

                .btn-bulk-upload {
                    padding: 11px 20px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.88rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.15s;
                    font-family: inherit;
                    width: 100%;
                }
                .btn-bulk-upload:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
                .btn-bulk-upload:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .btn-bulk-upload.uploading { background: var(--n-muted); }

                .spinner-sm {
                    width: 14px; height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.75s linear infinite;
                    display: inline-block;
                }

                /* ── GOOGLE ONE PITCH BLACK DARK THEME ── */
                :global(.dark) .ds-section {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                :global(.dark) .ds-table-wrap {
                    background: #0b1329 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                :global(.dark) .section-title h3,
                :global(.dark) .toolbar-left h3,
                :global(.dark) .folder-info span {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .ds-folder-card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(59, 130, 246, 0.3) !important;
                }
                :global(.dark) .ds-folder-card:hover {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .folder-tag {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #93c5fd !important;
                    border: 1px solid rgba(59, 130, 246, 0.3) !important;
                }
                :global(.dark) .ds-filters {
                    background: #0b1329 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                :global(.dark) .filter-item label,
                :global(.dark) .inline-label,
                :global(.dark) .cell-date {
                    color: #94a3b8 !important;
                }
                :global(.dark) .ds-filters select,
                :global(.dark) .search-wrap input,
                :global(.dark) .fm-field input,
                :global(.dark) .fm-field select,
                :global(.dark) .inline-add-row input,
                :global(.dark) .inline-add-row select,
                :global(.dark) .inline-edit-row input,
                :global(.dark) .inline-edit-row select {
                    background-color: #0b1329 !important;
                    background: #0b1329 !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    color: #f1f5f9 !important;
                    border-radius: 10px !important;
                }
                :global(.dark) .ds-filters select:focus,
                :global(.dark) .search-wrap input:focus,
                :global(.dark) .fm-field input:focus,
                :global(.dark) .fm-field select:focus,
                :global(.dark) .inline-add-row input:focus,
                :global(.dark) .inline-add-row select:focus,
                :global(.dark) .inline-edit-row input:focus,
                :global(.dark) .inline-edit-row select:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .ds-table {
                    background: #0b1329 !important;
                }
                :global(.dark) .ds-table th {
                    background: rgba(26, 115, 232, 0.1) !important;
                    color: #93c5fd !important;
                    border-bottom: 1.5px solid rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .ds-table td {
                    background: #0b1329 !important;
                    color: #f1f5f9 !important;
                    border-bottom: 1px solid rgba(59, 130, 246, 0.12) !important;
                }
                :global(.dark) .ds-table tbody tr:hover td {
                    background: rgba(26, 115, 232, 0.06) !important;
                }
                :global(.dark) .btn-zip,
                :global(.dark) .fm-btn-save,
                :global(.dark) .btn-add-inline,
                :global(.dark) .section-title .btn-add-folder {
                    background: linear-gradient(180deg, #3b82f6 0%, #1a73e8 100%) !important;
                    border: 1px solid #93c5fd !important;
                    color: #ffffff !important;
                    box-shadow: inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 4px 0 rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.4) !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .btn-zip:hover,
                :global(.dark) .fm-btn-save:hover,
                :global(.dark) .btn-add-inline:hover,
                :global(.dark) .section-title .btn-add-folder:hover {
                    background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%) !important;
                    border-color: #bfdbfe !important;
                    box-shadow: inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.7), 0 6px 14px rgba(0, 0, 0, 0.5) !important;
                    transform: translateY(-1.5px) !important;
                }
                :global(.dark) .btn-folder-settings,
                :global(.dark) .btn-bulk-upload-trigger,
                :global(.dark) .btn-refresh,
                :global(.dark) .fm-btn-cancel {
                    background: #0b1329 !important;
                    border: 1.5px solid rgba(59, 130, 246, 0.4) !important;
                    color: #93c5fd !important;
                    border-radius: 10px !important;
                }
                :global(.dark) .btn-folder-settings:hover,
                :global(.dark) .btn-bulk-upload-trigger:hover,
                :global(.dark) .btn-refresh:hover,
                :global(.dark) .fm-btn-cancel:hover {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .btn-view,
                :global(.dark) .btn-dl,
                :global(.dark) .btn-edit-mini,
                :global(.dark) .btn-save-inline {
                    background: #0b1329 !important;
                    border: 1px solid rgba(59, 130, 246, 0.35) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .btn-save-inline:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .btn-del,
                :global(.dark) .btn-del-mini {
                    background: #0b1329 !important;
                    border: 1px solid rgba(239, 68, 68, 0.35) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .btn-del:hover,
                :global(.dark) .btn-del-mini:hover {
                    background: rgba(239, 68, 68, 0.15) !important;
                }
                :global(.dark) .inline-folder-list {
                    background: #0b1329 !important;
                    border-color: rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .inline-folder-item {
                    background: #0b1329 !important;
                    border-color: rgba(59, 130, 246, 0.2) !important;
                }
                :global(.dark) .fm-overlay {
                    background: rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: blur(8px) !important;
                }
                :global(.dark) .fm-modal {
                    background: #0b1329 !important;
                    background-image: linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(11, 19, 41, 0.6) 30%, #0b1329 100%) !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 20px !important;
                    box-shadow: inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.4), inset 0 0 20px 0 rgba(26, 115, 232, 0.25), 0 25px 60px rgba(0, 0, 0, 0.95) !important;
                    overflow: hidden !important;
                }
                :global(.dark) .fm-header {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .fm-title-group h2 {
                    background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                    background-clip: text !important;
                    color: transparent !important;
                    display: inline-block;
                }
                :global(.dark) .fm-footer {
                    background: #0b1329 !important;
                    border-top: 1px solid rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .fm-icon {
                    background: rgba(26, 115, 232, 0.18) !important;
                    border: 1.5px solid rgba(59, 130, 246, 0.4) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .fm-icon i {
                    color: #38bdf8 !important;
                }
                :global(.dark) .fm-close {
                    background: rgba(255, 255, 255, 0.06) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .fm-close:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .file-info i,
                :global(.dark) .file-info i.bi-image,
                :global(.dark) .file-info i.bi-file-earmark-pdf-fill {
                    color: #38bdf8 !important;
                }
                :global(.dark) .bulk-dropzone {
                    background: #0b1329 !important;
                    border: 1.5px dashed rgba(59, 130, 246, 0.4) !important;
                }
                :global(.dark) .bulk-dropzone.drag-over {
                    border-color: #3b82f6 !important;
                    background: rgba(26, 115, 232, 0.12) !important;
                }
                :global(.dark) .bulk-drop-idle i {
                    color: #38bdf8 !important;
                }
                :global(.dark) .bulk-drop-idle p {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .bulk-drop-idle small {
                    color: #94a3b8 !important;
                }
                :global(.dark) .bulk-browse {
                    color: #38bdf8 !important;
                }
                :global(.dark) .bulk-file-item {
                    background: #0b1329 !important;
                    border-color: rgba(59, 130, 246, 0.3) !important;
                }
                :global(.dark) .bulk-file-item > i {
                    color: #38bdf8 !important;
                }
                :global(.dark) .bulk-file-item > i.text-red {
                    color: #38bdf8 !important;
                }

                /* ── MOBILE RESPONSIVE ── */
                @media (max-width: 768px) {
                    .ds-section { padding: 14px; border-radius: 14px; }
                    .section-title { flex-wrap: wrap; }
                    .section-title h3, .toolbar-left h3 { font-size: 0.88rem; }
                    .section-title .btn-add-folder { width: 100%; justify-content: center; padding: 10px; font-size: 0.82rem; }
                    .ds-folder-grid { grid-template-columns: 1fr 1fr; }
                    .ds-toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
                    .toolbar-actions { width: 100%; display: flex; flex-direction: column; gap: 8px; }
                    .btn-folder-settings { width: 100%; justify-content: center; }
                    .btn-bulk-upload-trigger { width: 100%; justify-content: center; }
                    .btn-zip { width: 100%; justify-content: center; }
                    .ds-filters { flex-direction: column; gap: 10px; }
                    .filter-item { width: 100%; }
                    .btn-reset { width: 100%; justify-content: center; }
                    .ds-folder-card { padding: 12px; }
                    .folder-info i { font-size: 1.2rem; }
                    .folder-info span { font-size: 0.78rem; }
                    .btn-edit-mini, .btn-del-mini { width: 26px; height: 26px; }

                    /* Modal Mobile Responsiveness */
                    .inline-add-row {
                        flex-wrap: wrap !important;
                        gap: 8px !important;
                    }
                    .inline-add-row input {
                        width: 100% !important;
                        flex: 1 1 100% !important;
                    }
                    .inline-add-row select {
                        flex: 1 !important;
                        width: auto !important;
                        min-width: 0 !important;
                    }
                    .inline-add-row .ui-btn {
                        flex: 1 !important;
                        width: auto !important;
                    }

                    .inline-folder-list {
                        padding: 6px !important;
                        max-height: 280px !important;
                        overflow-x: hidden !important;
                    }
                    .inline-folder-item {
                        padding: 10px 12px !important;
                        gap: 8px !important;
                    }
                    .inline-folder-info {
                        flex: 1 !important;
                        min-width: 0 !important;
                        gap: 6px !important;
                    }
                    .inline-folder-name {
                        white-space: normal !important;
                        word-break: break-word !important;
                        font-size: 0.82rem !important;
                        line-height: 1.35 !important;
                    }
                    .role-badge {
                        font-size: 0.62rem !important;
                        padding: 2px 6px !important;
                        flex-shrink: 0 !important;
                        white-space: nowrap !important;
                    }
                    .inline-edit-row {
                        flex-wrap: wrap !important;
                        gap: 6px !important;
                    }
                    .inline-edit-row input {
                        width: 100% !important;
                        flex: 1 1 100% !important;
                    }

                    .ds-table-wrap,
                    .ds-table,
                    .ds-table tbody { 
                        border: none !important; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        overflow: visible !important; 
                        background: transparent !important; 
                        box-shadow: none !important;
                        width: 100% !important; 
                    }
                    :global(.dark) .ds-table-wrap,
                    :global(.dark) .ds-table,
                    :global(.dark) .ds-table tbody {
                        border: none !important;
                        background: transparent !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                    }
                    :global(.dark) .ds-table td {
                        background: transparent !important;
                        border: none !important;
                    }
                    .ds-table { display: block; min-width: 0; width: 100%; }
                    .ds-table thead { display: none; }
                    .ds-table tbody { display: flex; flex-direction: column; gap: 14px; width: 100%; }
                    .ds-table tr {
                        display: grid;
                        grid-template-columns: auto minmax(0, 1fr) auto;
                        grid-template-areas: 
                            "checkbox date folder" 
                            "file file file" 
                            "uploader uploader uploader" 
                            "action action action";
                        background: var(--n-card);
                        border: 1px solid var(--n-border);
                        border-radius: 16px;
                        padding: 16px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.025);
                        gap: 12px;
                        margin-bottom: 4px;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    :global(.dark) .ds-table tr {
                        background: #0b1329 !important;
                        border: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
                    }
                    .ds-table tr.selected-row {
                        border-color: #1a73e8 !important;
                        background: rgba(26, 115, 232, 0.04) !important;
                        box-shadow: 0 0 12px rgba(26, 115, 232, 0.25) !important;
                    }
                    .ds-table td {
                        display: flex;
                        align-items: center;
                        width: 100%;
                        min-width: 0;
                        padding: 0;
                        border: none;
                        margin: 0;
                        box-sizing: border-box;
                    }
                    .ds-table td::before {
                        display: none; /* Hide cluttered, repetitive data labels! */
                    }
                    .cell-checkbox {
                        grid-area: checkbox;
                        justify-content: flex-start;
                        padding-right: 6px;
                    }
                    .cell-checkbox input[type="checkbox"] {
                        width: 18px;
                        height: 18px;
                        accent-color: #1a73e8;
                        cursor: pointer;
                    }
                    .cell-date {
                        grid-area: date;
                        font-size: 0.78rem;
                        color: var(--n-muted);
                        font-weight: 700;
                        justify-content: flex-start;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .cell-folder {
                        grid-area: folder;
                        justify-content: flex-end;
                        min-width: 0;
                    }
                    .folder-tag {
                        font-size: 0.68rem;
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        max-width: 100%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .cell-file {
                        grid-area: file;
                        width: 100%;
                        min-width: 0;
                    }
                    .file-info {
                        background: var(--n-soft);
                        padding: 10px 14px;
                        border-radius: 10px;
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border: 1px solid var(--n-border);
                        overflow: hidden;
                    }
                    .file-info span {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-size: 0.82rem;
                        font-weight: 600;
                        color: var(--n-ink);
                    }
                    .file-info i { font-size: 1.25rem; color: #0284c7; flex-shrink: 0; }
                    .file-info i.bi-image { color: #0284c7; }
                    .cell-uploader {
                        grid-area: uploader;
                        width: 100%;
                        min-width: 0;
                    }
                    .uploader-cell {
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        gap: 6px;
                        background: rgba(30, 86, 211, 0.04);
                        padding: 6px 12px;
                        border-radius: 8px;
                        border: 1px dashed rgba(30, 86, 211, 0.15);
                        width: 100%;
                        min-width: 0;
                        overflow: hidden;
                        box-sizing: border-box;
                    }
                    .uploader-cell::before {
                        content: "\F4E2"; /* Bootstrap Bi Person Icon */
                        font-family: "bootstrap-icons";
                        font-size: 0.9rem;
                        color: var(--n-primary);
                        opacity: 0.8;
                        flex-shrink: 0;
                    }
                    .u-name {
                        font-size: 0.78rem;
                        font-weight: 700;
                        color: var(--n-ink);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        min-width: 0;
                        flex: 1;
                    }
                    .u-role {
                        font-size: 0.65rem;
                        color: var(--n-muted);
                        font-weight: 600;
                        text-transform: uppercase;
                        margin-left: auto;
                        flex-shrink: 0;
                    }
                    .cell-action {
                        grid-area: action;
                        display: flex;
                        justify-content: flex-end;
                        align-items: center;
                        padding-top: 10px;
                        margin-top: 4px;
                        border-top: 1px dashed var(--n-border);
                        width: 100%;
                    }
                    .action-row { gap: 8px; display: flex; width: 100%; justify-content: flex-end; }
                    .btn-view, .btn-dl, .btn-del {
                        width: 32px;
                        height: 32px;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        flex: 1; /* Make action buttons tap-friendly on mobile by spreading */
                        max-width: 80px;
                        justify-content: center;
                        align-items: center;
                    }
                    .loading-cell { padding: 40px 20px; }
                }
            `}</style>

            {/* PDF Viewer Modal - PDFViewer handles its own createPortal internally */}
            {selectedDoc && (
                <PDFViewer
                    url={selectedDoc.url}
                    title={selectedDoc.title}
                    onClose={() => setSelectedDoc(null)}
                />
            )}

            {/* Folder Settings Modal */}
            <Modal
                open={folderSettingsModalOpen}
                onClose={() => setFolderSettingsModalOpen(false)}
                size="md"
                title="Pengaturan Folder"
                subtitle="Kelola, edit, atau hapus kategori folder dokumen"
                icon="folder-fill"
            >
                <ModalBody style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Tambah Folder Inline */}
                    <div className="inline-add-section">
                        <label className="inline-label">Tambah Folder Baru</label>
                        <div className="inline-add-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Nama folder baru..."
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddFolderInline()}
                                style={{ flex: 1 }}
                            />
                            <select
                                value={newFolderRole}
                                onChange={(e) => setNewFolderRole(e.target.value)}
                                disabled={folderSaving}
                                style={{ width: '130px' }}
                            >
                                <option value="semua">Semua Role</option>
                                <option value="guru">Guru</option>
                                <option value="siswa">Siswa</option>
                                <option value="staf">Staf</option>
                                <option value="orang_tua">Orang Tua</option>
                            </select>
                            <Button 
                                variant="primary"
                                size="md"
                                onClick={handleAddFolderInline} 
                                disabled={!newFolderName.trim() || folderSaving}
                                isLoading={folderSaving && !editingFolderId}
                                leftIcon={(!folderSaving || editingFolderId) ? <i className="bi bi-plus-lg" /> : undefined}
                            >
                                Tambah
                            </Button>
                        </div>
                    </div>

                    {/* Daftar Folder Scrollable */}
                    <div className="inline-list-section">
                        <label className="inline-label">Daftar Folder ({categories.length})</label>
                        <div className="inline-folder-list">
                            {categories.map(cat => {
                                const isEditing = editingFolderId === cat.id;
                                return (
                                    <div key={cat.id} className={`inline-folder-item ${isEditing ? 'editing' : ''}`}>
                                        {isEditing ? (
                                            <div className="inline-edit-row">
                                                <input
                                                    type="text"
                                                    value={editingFolderName}
                                                    onChange={(e) => setEditingFolderName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEditInline(cat)}
                                                    autoFocus
                                                />
                                                <select
                                                    value={editingFolderRole}
                                                    onChange={(e) => setEditingFolderRole(e.target.value)}
                                                    disabled={folderSaving}
                                                >
                                                    <option value="semua">Semua Role</option>
                                                    <option value="guru">Guru</option>
                                                    <option value="siswa">Siswa</option>
                                                    <option value="staf">Staf</option>
                                                    <option value="orang_tua">Orang Tua</option>
                                                </select>
                                                <button 
                                                    onClick={() => handleSaveEditInline(cat)} 
                                                    className="btn-save-inline"
                                                    disabled={!editingFolderName.trim() || folderSaving}
                                                    title="Simpan"
                                                >
                                                    {folderSaving && editingFolderId === cat.id ? (
                                                        <span className="fm-spinner"></span>
                                                    ) : (
                                                        <i className="bi bi-check-lg"></i>
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => setEditingFolderId(null)} 
                                                    className="btn-cancel-inline"
                                                    title="Batal"
                                                    disabled={folderSaving}
                                                >
                                                    <i className="bi bi-x-lg"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="inline-folder-info">
                                                    <i className="bi bi-folder-fill"></i>
                                                    <span className="inline-folder-name" title={cat.name}>{cat.name}</span>
                                                    <span className={`role-badge ${cat.target_role || 'semua'}`}>
                                                        {getTargetRoleLabel(cat.target_role)}
                                                    </span>
                                                </div>
                                                <ActionGroup>
                                                    <ActionButton 
                                                        action="edit"
                                                        tooltipPos="bottom"
                                                        onClick={() => { 
                                                            setEditingFolderId(cat.id); 
                                                            setEditingFolderName(cat.name);
                                                            setEditingFolderRole(cat.target_role || 'semua');
                                                        }} 
                                                        title="Edit Nama/Peran Folder"
                                                    />
                                                    <ActionButton 
                                                        action="delete"
                                                        tooltipPos="bottom"
                                                        onClick={() => handleDeleteFolderModal(cat)} 
                                                        title="Hapus Folder"
                                                    />
                                                </ActionGroup>
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                            {categories.length === 0 && (
                                <div className="empty-inline-list">
                                    <i className="bi bi-folder-x"></i>
                                    <p>Belum ada kategori folder.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter align="end">
                    <Button variant="cancel" onClick={() => setFolderSettingsModalOpen(false)}>
                        Tutup
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Bulk Upload Modal */}
            <Modal
                open={bulkUploadModalOpen}
                onClose={() => setBulkUploadModalOpen(false)}
                size="lg"
                title="Upload Massal"
                subtitle="Unggah banyak file dokumen sekaligus berdasarkan NIP/NISN"
                icon="cloud-arrow-up-fill"
            >
                <ModalBody style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <p className="bulk-desc" style={{ margin: 0 }}>
                        Upload beberapa file sekaligus. Nama file harus mengandung NIP (Guru) atau NISN (Siswa) di awal.
                        Format: <code>NIP_199208302023212038_dokumen.pdf</code> atau <code>0087654321_raport.pdf</code>
                    </p>

                    <div className="bulk-form">
                        {/* Folder selector */}
                        <div className="bulk-row">
                            <label>Folder Tujuan</label>
                            <select
                                value={bulkCategoryId}
                                onChange={(e) => setBulkCategoryId(e.target.value)}
                                disabled={bulkUploading}
                            >
                                <option value="">-- Pilih Folder --</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name} ({getTargetRoleLabel(cat.target_role)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Drop zone */}
                        <div
                            className={`bulk-dropzone ${bulkDragOver ? 'drag-over' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setBulkDragOver(true) }}
                            onDragLeave={(e) => { e.preventDefault(); setBulkDragOver(false) }}
                            onDrop={handleBulkDrop}
                            onClick={() => bulkFileInputRef.current?.click()}
                        >
                            <input
                                ref={bulkFileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                style={{ display: 'none' }}
                                onChange={handleBulkFileSelect}
                            />
                            {bulkFiles.length === 0 ? (
                                <div className="bulk-drop-idle">
                                    <i className="bi bi-cloud-arrow-up"></i>
                                    <p>Seret file ke sini, atau <span className="bulk-browse">klik untuk pilih file</span></p>
                                    <small>Multiple file (PDF, JPG, PNG, DOC, XLSX) · Maks 20MB per file</small>
                                </div>
                            ) : (
                                <div className="bulk-file-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {bulkFiles.map((f, i) => (
                                        <div key={i} className="bulk-file-item">
                                            <i className={`bi ${getFileIcon(f.file.name)}`}></i>
                                            <div className="bulk-file-info">
                                                <span className="bulk-file-name">{f.file.name}</span>
                                                {f.detectedId ? (
                                                    <span className={`bulk-badge ${f.detectedType?.toLowerCase()}`}>
                                                        <i className={`bi ${f.detectedType === 'NIP' ? 'bi-person-badge' : 'bi-mortarboard'}`}></i>
                                                        {f.detectedType}: {f.detectedId}
                                                    </span>
                                                ) : (
                                                    <span className="bulk-badge-unknown">
                                                        <i className="bi bi-exclamation-triangle"></i>
                                                        ID tidak terdeteksi
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                className="bulk-remove"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    removeBulkFile(i)
                                                }}
                                                disabled={bulkUploading}
                                            >
                                                <i className="bi bi-x"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Progress info */}
                        {bulkFiles.length > 0 && (
                            <div className="bulk-meta">
                                <span><i className="bi bi-file-earmark"></i> {bulkFiles.length} file dipilih</span>
                                <span><i className="bi bi-check-circle"></i> {bulkFiles.filter(f => f.detectedId).length} terverifikasi</span>
                                <span className={bulkFiles.some(f => !f.detectedId) ? 'warn' : ''}>
                                    <i className="bi bi-exclamation-triangle"></i> {bulkFiles.filter(f => !f.detectedId).length} perlu nama yang valid
                                </span>
                            </div>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter align="end">
                    <Button
                        variant="cancel"
                        onClick={() => setBulkUploadModalOpen(false)}
                        disabled={bulkUploading}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleBulkUpload}
                        disabled={bulkFiles.length === 0 || !bulkCategoryId || bulkUploading}
                        isLoading={bulkUploading}
                        leftIcon={!bulkUploading ? <i className="bi bi-cloud-arrow-up-fill" /> : undefined}
                    >
                        {bulkUploading ? `Mengunggah ${bulkProgress}/${bulkFiles.length}...` : 'Upload Massal Sekarang'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    )
}