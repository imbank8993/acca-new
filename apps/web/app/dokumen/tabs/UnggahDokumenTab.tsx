'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/ui/Spinner'
import { Modal, ModalBody } from '@/components/ui/Modal'
import Swal from 'sweetalert2'
import { FilterToolbar, FilterSelect } from '@/components/ui/FilterToolbar'
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons'

const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });

export default function UnggahDokumenTab({
    user,
    externalTab,
    onExternalTabChange
}: {
    user?: any
    externalTab?: 'upload' | 'files'
    onExternalTabChange?: (tab: 'upload' | 'files') => void
}) {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [selectedCategory, setSelectedCategory] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [loading, setLoading] = useState(true)
    const [recentUploads, setRecentUploads] = useState<any[]>([])
    const [dragOver, setDragOver] = useState(false)
    const [viewerFile, setViewerFile] = useState<{ url: string; name: string } | null>(null)

    // User info auto-detected
    const userInfo = useMemo(() => {
        if (!user) return { name: 'Unknown', role: 'UNKNOWN', nip: null, nisn: null, userId: null, isGuru: false, isSiswa: false, isStaf: false, isOrangTua: false, isAdmin: false }

        const rolesList = (user.roles || [user.role]).filter(Boolean).map((r: string) => String(r).toUpperCase());
        const isAdmin = rolesList.includes('ADMIN') || rolesList.includes('ADMINISTRATOR');
        const isGuru = rolesList.includes('GURU');
        const isSiswa = rolesList.includes('SISWA');
        const isStaf = rolesList.some((r: string) => ['STAF', 'TATA_USAHA', 'TU', 'BENDAHARA'].includes(r));
        const isOrangTua = rolesList.some((r: string) => ['ORANG_TUA', 'ORANGTUA', 'WALI'].includes(r));

        const displayName = user.nama_lengkap || user.name || 'Unknown'
        const effectiveNisn = user.nisn || (isSiswa ? user.nip : null) || null
        const effectiveNip = isSiswa ? null : (user.nip || null)

        return {
            name: displayName,
            role: user.roles?.[0] || user.role || 'UNKNOWN',
            nip: effectiveNip,
            nisn: effectiveNisn,
            isGuru,
            isSiswa,
            isStaf,
            isOrangTua,
            isAdmin,
            userId: user.id || user.user_id || null
        }
    }, [user])

    useEffect(() => {
        fetchCategories()
        fetchRecentUploads()
    }, [userInfo.nip, userInfo.nisn, userInfo.isGuru, userInfo.isSiswa, userInfo.isStaf, userInfo.isOrangTua, userInfo.isAdmin])

    const fetchCategories = async () => {
        try {
            const params = new URLSearchParams()
            if (!userInfo.isAdmin) {
                let targetRole = ''
                if (userInfo.isGuru) targetRole = 'guru'
                else if (userInfo.isSiswa) targetRole = 'siswa'
                else if (userInfo.isStaf) targetRole = 'staf'
                else if (userInfo.isOrangTua) targetRole = 'orang_tua'
                else if (userInfo.role) targetRole = String(userInfo.role).toLowerCase()

                if (targetRole) {
                    params.set('target_role', targetRole)
                }
            }
            const res = await fetch('/api/upload-categories?' + params.toString())
            const data = await res.json()
            const list = Array.isArray(data) ? data : (data?.data || [])
            setCategories(list)
        } catch (e) {
            console.error('Error fetching categories:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchRecentUploads = async () => {
        if (!user) return
        try {
            const params = new URLSearchParams()
            if (userInfo.isSiswa && userInfo.nisn) {
                params.set('uploaderNisn', userInfo.nisn)
            } else if (userInfo.nip) {
                params.set('uploaderNip', userInfo.nip)
            }
            const res = await fetch('/api/uploaded-documents?' + params.toString())
            const data = await res.json()
            const list = Array.isArray(data) ? data : (data?.data || [])
            setRecentUploads(list)
        } catch (e) {
            console.error('Error fetching recent uploads:', e)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            if (file.size > 20 * 1024 * 1024) {
                Swal.fire('Error', 'Ukuran file maksimal 20MB', 'error')
                return
            }
            setSelectedFile(file)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            if (file.size > 20 * 1024 * 1024) {
                Swal.fire('Error', 'Ukuran file maksimal 20MB', 'error')
                return
            }
            setSelectedFile(file)
        }
    }

    const triggerFileSelect = () => {
        const fileInput = document.getElementById('file-input-modal') as HTMLInputElement
        if (fileInput) fileInput.click()
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            Swal.fire('Error', 'Pilih file terlebih dahulu', 'error')
            return
        }
        if (!selectedCategory) {
            Swal.fire('Error', 'Pilih folder tujuan terlebih dahulu', 'error')
            return
        }

        setIsUploading(true)

        try {
            const category = categories.find(c => c.id === selectedCategory)
            if (!category) throw new Error('Folder tidak ditemukan')

            // Upload to storage
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('folder', category.name)

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const uploadResult = await uploadRes.json()

            if (!uploadResult.ok) {
                throw new Error(uploadResult.error || 'Gagal mengunggah file')
            }

            // Determine correct uploader_role (must be lowercase 'guru' or 'siswa')
            let dbRole = null
            if (userInfo.isGuru) {
                dbRole = 'guru'
            } else if (userInfo.isSiswa) {
                dbRole = 'siswa'
            } else if (userInfo.role) {
                const lowerRole = userInfo.role.toLowerCase()
                if (lowerRole === 'guru' || lowerRole === 'siswa') {
                    dbRole = lowerRole
                }
            }

            // Verify if userInfo.userId is a valid UUID to prevent "invalid input syntax for type uuid" database error
            const isUuid = (val: any) => {
                if (typeof val !== 'string') return false
                return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
            }
            const dbUploaderId = isUuid(userInfo.userId) ? userInfo.userId : null

            // Save metadata to database with NIP/NISN
            const insertData: any = {
                file_url: uploadResult.publicUrl,
                file_name: selectedFile.name,
                file_path: uploadResult.fileName || uploadResult.publicUrl || '',
                uploader_name: userInfo.name,
                uploader_role: dbRole,
                category_id: selectedCategory,
                category_name: category.name,
                file_size: selectedFile.size,
                uploader_id: dbUploaderId,
                // Bawaannya 'cloudflare', bukan 'supabase': unggahan baru tidak
                // pernah mendarat di Supabase lagi, jadi nilai cadangan yang lama
                // akan salah melabeli berkas R2 dan membuat penghapusannya mencari
                // di penyedia yang salah.
                storage_type: uploadResult.storageType || 'cloudflare'
            }

            // Add NIP for Guru or NISN for Siswa
            if (userInfo.isGuru && userInfo.nip) {
                insertData.uploader_nip = userInfo.nip
            } else if (userInfo.isSiswa && userInfo.nisn) {
                insertData.uploader_nisn = userInfo.nisn
            }

            const res = await fetch('/api/uploaded-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(insertData),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error('Database insert error details:', errData);
                throw new Error(errData.message || 'Gagal menyimpan metadata file ke database');
            }

            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: `File "${selectedFile.name}" berhasil diunggah ke folder "${category.name}"`,
                confirmButtonText: 'OK'
            })

            setSelectedFile(null)
            setSelectedCategory('')
            setIsUploadModalOpen(false)
            const fileInput = document.getElementById('file-input-modal') as HTMLInputElement
            if (fileInput) fileInput.value = ''

            fetchRecentUploads()

        } catch (err: any) {
            console.error('Upload error:', err)
            Swal.fire('Error', err.message || 'Terjadi kesalahan saat mengunggah file', 'error')
        } finally {
            setIsUploading(false)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase()
        if (ext === 'pdf') return 'bi-file-earmark-pdf-fill'
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'bi-file-earmark-image'
        if (['doc', 'docx'].includes(ext || '')) return 'bi-file-earmark-word'
        if (['xls', 'xlsx'].includes(ext || '')) return 'bi-file-earmark-excel'
        return 'bi-file-earmark'
    }

    if (loading) {
        return <PageLoader minHeight="300px" dotsOnly size={18} />
    }

    return (
        <div className="ud-container">
            {/* Main Section: File List (Dokumen Sekolah) */}
            <div className="ud-section ud-files-section">
                <div className="section-title">
                    <div className="title-left">
                        <i className="bi bi-folder2-open"></i>
                        <h3>Dokumen Sekolah</h3>
                        <span className="file-count">{recentUploads.length} file</span>
                    </div>
                    <button
                        className="btn-trigger-upload"
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        <i className="bi bi-cloud-arrow-up-fill"></i>
                        <span>Unggah Dokumen</span>
                    </button>
                </div>

                {recentUploads.length === 0 ? (
                    <div className="empty-files">
                        <i className="bi bi-inbox"></i>
                        <p>Belum ada file dokumen sekolah yang diunggah</p>
                        <button className="btn-go-upload" onClick={() => setIsUploadModalOpen(true)}>
                            <i className="bi bi-cloud-arrow-up-fill"></i>
                            Unggah File Pertama
                        </button>
                    </div>
                ) : (
                    <div className="files-list">
                        {recentUploads.map((upload, idx) => (
                            <div key={upload.id || idx} className="file-item">
                                <div className="file-main-row">
                                    <div className="file-icon">
                                        <i className={`bi ${getFileIcon(upload.file_name)}`}></i>
                                    </div>
                                    <div className="file-details">
                                        <span className="file-name">{upload.file_name}</span>
                                        <div className="file-meta">
                                            <span className="file-folder">
                                                <i className="bi bi-folder"></i>
                                                {upload.category_name}
                                            </span>
                                            <span className="file-date">
                                                <i className="bi bi-calendar"></i>
                                                {new Date(upload.created_at).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            <span className="file-size">
                                                <i className="bi bi-hdd"></i>
                                                {formatFileSize(upload.file_size)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <ActionGroup>
                                    <ActionButton
                                        action="view"
                                        onClick={() => setViewerFile({ url: upload.file_url, name: upload.file_name })}
                                        title="Lihat File"
                                    />
                                    <ActionButton
                                        action="download"
                                        onClick={() => {
                                            const link = document.createElement('a')
                                            link.href = upload.file_url
                                            link.download = upload.file_name
                                            link.target = '_blank'
                                            document.body.appendChild(link)
                                            link.click()
                                            document.body.removeChild(link)
                                        }}
                                        title="Download File"
                                    />
                                </ActionGroup>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Unggah Dokumen */}
            {isUploadModalOpen && (
                <Modal
                    title="Unggah Dokumen Sekolah"
                    icon="cloud-arrow-up-fill"
                    labelledBy="unggah-dokumen-sekolah-title"
                    size="lg"
                    variant="add"
                    onClose={() => { if (!isUploading) setIsUploadModalOpen(false) }}
                    closeOnOverlayClick={!isUploading}
                >
                    <ModalBody>
                        {/* Folder Selection */}
                        <div className="ud-form-group" style={{ marginBottom: '20px' }}>
                            <FilterToolbar style={{ background: 'transparent', border: 'none', padding: 0 }}>
                                <FilterSelect
                                    label="Pilih Folder Tujuan"
                                    icon="folder2-open"
                                    value={selectedCategory}
                                    onChange={setSelectedCategory}
                                    width="100%"
                                    grow={1}
                                >
                                    <option value="">-- Pilih Folder --</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </FilterSelect>
                            </FilterToolbar>
                            {categories.length === 0 && (
                                <p className="help-text">Belum ada folder tersedia. Hubungi admin untuk membuat folder.</p>
                            )}
                        </div>

                        {/* File Drop Zone */}
                        <div
                            className={`ud-dropzone ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={!selectedFile ? triggerFileSelect : undefined}
                        >
                            {selectedFile ? (
                                <div className="file-preview">
                                    <i className={`bi ${getFileIcon(selectedFile.name)}`}></i>
                                    <div className="file-info">
                                        <span className="file-name">{selectedFile.name}</span>
                                        <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                                    </div>
                                    <button
                                        className="btn-remove-file"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedFile(null)
                                            const fileInput = document.getElementById('file-input-modal') as HTMLInputElement
                                            if (fileInput) fileInput.value = ''
                                        }}
                                        title="Hapus file"
                                    >
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>
                            ) : (
                                <div className="dropzone-content">
                                    <div className="dropzone-icon">
                                        <i className="bi bi-cloud-arrow-up"></i>
                                    </div>
                                    <p className="dropzone-text">
                                        Drag & drop file di sini, atau <span className="browse-label">pilih file</span>
                                    </p>
                                    <p className="dropzone-hint">Format yang didukung: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (Max 20MB)</p>
                                    <input
                                        type="file"
                                        id="file-input-modal"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Upload Submit Button */}
                        <button
                            className={`btn-upload ${isUploading ? 'uploading' : ''}`}
                            onClick={handleUpload}
                            disabled={!selectedFile || !selectedCategory || isUploading}
                        >
                            {isUploading ? (
                                <>
                                    <span className="spinner"></span>
                                    Mengunggah...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-upload"></i>
                                    Unggah Dokumen
                                </>
                            )}
                        </button>
                    </ModalBody>
                </Modal>
            )}

            {viewerFile && (
                <PDFViewer
                    url={viewerFile.url}
                    title={viewerFile.name}
                    onClose={() => setViewerFile(null)}
                />
            )}

            <style jsx>{`
                .ud-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* ── HERO HEADER ── */
                .ud-hero {
                    position: relative;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    padding: 22px 32px;
                    border-radius: 16px;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .ud-hero-grid {
                    position: absolute;
                    inset: 0;
                    opacity: 0.08;
                    background-image: radial-gradient(#fff 1px, transparent 1px);
                    background-size: 20px 20px;
                    pointer-events: none;
                }
                .ud-hero__bg1 {
                    position: absolute;
                    top: -30%;
                    right: -5%;
                    width: 280px;
                    height: 280px;
                    background: radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(56, 189, 248, 0) 70%);
                    filter: blur(60px);
                    pointer-events: none;
                    z-index: 1;
                }
                .ud-hero__bg2 {
                    position: absolute;
                    bottom: -30%;
                    left: 10%;
                    width: 220px;
                    height: 220px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0) 70%);
                    filter: blur(50px);
                    pointer-events: none;
                    z-index: 1;
                }
                .ud-hero__inner {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .ud-hero__text {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .ud-hero__text h1 {
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: white;
                    margin: 0;
                    letter-spacing: -0.02em;
                }
                .ud-hero__text p {
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 0.78rem;
                    margin: 0;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                }

                /* ── TABS ── */
                .ud-tabs {
                    display: flex;
                    gap: 8px;
                    background: var(--n-card);
                    padding: 8px;
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                }
                .ud-tab {
                    flex: 1;
                    padding: 12px 20px;
                    border: none;
                    background: transparent;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                    font-family: inherit;
                }
                .ud-tab:hover:not(.active) {
                    background: var(--n-soft);
                    color: var(--n-ink);
                }
                .ud-tab.active {
                    background: var(--n-primary);
                    color: white;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                .ud-tab i { font-size: 1.1rem; }
                .tab-badge {
                    background: rgba(255,255,255,0.25);
                    color: white;
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 10px;
                    min-width: 20px;
                    text-align: center;
                }
                .ud-tab:not(.active) .tab-badge {
                    background: var(--n-primary);
                    color: white;
                }

                /* ── SECTIONS ── */
                .ud-section {
                    background: var(--n-card);
                    border-radius: 20px;
                    border: 1px solid var(--n-border);
                    padding: 24px;
                    box-shadow: var(--n-shadow-soft);
                }
                .section-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .title-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .title-left i { font-size: 1.3rem; color: var(--n-primary); }
                .title-left h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--n-ink); }
                .file-count {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    background: var(--n-soft);
                    padding: 4px 12px;
                    border-radius: 20px;
                }
                .btn-trigger-upload {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 18px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: inherit;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
                }
                .btn-trigger-upload:hover {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
                }

                /* ── FORM GROUP ── */
                .ud-form-group {
                    margin-bottom: 20px;
                }
                .ud-form-group label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .ud-form-group label i { color: var(--n-primary); }
                .ud-form-group select {
                    width: 100%;
                    padding: 12px 16px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 12px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    background: var(--n-card);
                    color: var(--n-ink);
                    cursor: pointer;
                    outline: none;
                    transition: border-color 0.15s;
                }
                .ud-form-group select:focus { border-color: var(--n-primary); }
                .help-text {
                    font-size: 0.78rem;
                    color: var(--n-muted);
                    margin-top: 6px;
                    font-style: italic;
                }

                /* ── DROPZONE ── */
                .ud-dropzone {
                    border: 2px dashed var(--n-border);
                    border-radius: 16px;
                    padding: 40px 24px;
                    text-align: center;
                    transition: all 0.2s;
                    background: var(--n-soft);
                    cursor: pointer;
                    margin-bottom: 20px;
                }
                .ud-dropzone.drag-over {
                    border-color: var(--n-primary);
                    background: rgba(59, 130, 246, 0.08);
                }
                .ud-dropzone.has-file {
                    border-style: solid;
                    border-color: var(--n-primary);
                    background: rgba(59, 130, 246, 0.04);
                }

                .dropzone-icon {
                    margin-bottom: 16px;
                }
                .dropzone-icon i {
                    font-size: 3rem;
                    color: var(--n-muted);
                }
                .dropzone-text {
                    font-size: 0.95rem;
                    color: var(--n-ink);
                    margin: 0 0 8px;
                }
                .browse-label {
                    color: var(--n-primary);
                    font-weight: 700;
                    cursor: pointer;
                    text-decoration: underline;
                }
                .dropzone-hint {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    margin: 0;
                }

                /* ── FILE PREVIEW ── */
                .file-preview {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: var(--n-card);
                    border-radius: 12px;
                    border: 1px solid var(--n-border);
                }
                .file-preview > i {
                    font-size: 2.5rem;
                    color: var(--n-primary);
                    flex-shrink: 0;
                }
                .file-preview .file-info {
                    flex: 1;
                    text-align: left;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 0;
                }
                .file-preview .file-name {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--n-ink);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .file-preview .file-size {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                }
                .btn-remove-file {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--n-muted);
                    transition: all 0.15s;
                    flex-shrink: 0;
                }
                .btn-remove-file:hover {
                    border-color: #ef4444;
                    color: #ef4444;
                    background: rgba(239,68,68,0.08);
                }

                /* ── UPLOAD BUTTON ── */
                .btn-upload {
                    width: 100%;
                    padding: 14px 24px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: all 0.2s;
                    font-family: inherit;
                }
                .btn-upload:hover:not(:disabled) {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                }
                .btn-upload:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }
                .btn-upload.uploading {
                    background: var(--n-muted);
                }
                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.75s linear infinite;
                    display: inline-block;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* ── FILES LIST ── */
                .files-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .file-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 16px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    transition: all 0.15s;
                }
                .file-item:hover {
                    border-color: var(--n-primary);
                    background: var(--n-card);
                }
                .file-main-row {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    flex: 1;
                    min-width: 0;
                }
                .file-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: rgba(59, 130, 246, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .file-icon i {
                    font-size: 1.6rem;
                    color: var(--n-primary);
                }
                .file-details {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .file-details .file-name {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--n-ink);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .file-meta {
                    display: flex;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .file-meta span {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.72rem;
                    color: var(--n-muted);
                }
                .file-meta i { font-size: 0.8rem; }
                .file-actions {
                    display: flex;
                    gap: 6px;
                    flex-shrink: 0;
                }
                .btn-action {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s;
                    text-decoration: none;
                    color: var(--n-primary);
                }
                .btn-action:hover {
                    border-color: var(--n-primary);
                    background: var(--n-soft);
                }
                .btn-action i { font-size: 1rem; }

                /* ── EMPTY STATE ── */
                .empty-files {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    text-align: center;
                }
                .empty-files > i {
                    font-size: 4rem;
                    color: var(--n-muted);
                    margin-bottom: 16px;
                    opacity: 0.5;
                }
                .empty-files p {
                    font-size: 0.95rem;
                    color: var(--n-muted);
                    margin: 0 0 20px;
                }
                .btn-go-upload {
                    padding: 10px 20px;
                    background: var(--n-primary);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                    font-family: inherit;
                }
                .btn-go-upload:hover {
                    filter: brightness(1.08);
                }

                /* ── DARK NAVY BLUE DARK THEME ── */
                :global(.dark) .ud-hero {
                    background: #0b1329 !important;
                    border: 2px solid #1a73e8 !important;
                    border-radius: 20px !important;
                    box-shadow: 0 0 30px rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .ud-hero__text h1 {
                    background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                    background-clip: text !important;
                    color: transparent !important;
                    display: inline-block;
                }
                :global(.dark) .ud-hero__text p {
                    color: #94a3b8 !important;
                }
                :global(.dark) .ud-section {
                    background: #0b1329 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                :global(.dark) .section-title h3 {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .ud-tabs {
                    background: #0b1329 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 14px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                }
                :global(.dark) .ud-tab {
                    color: #94a3b8 !important;
                }
                :global(.dark) .ud-tab:hover:not(.active) {
                    color: #60a5fa !important;
                    background: rgba(26, 115, 232, 0.1) !important;
                }
                :global(.dark) .ud-tab.active {
                    background: #1a73e8 !important;
                    border: 1.5px solid #3b82f6 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .ud-form-group select {
                    background-color: #0b1329 !important;
                    background: #0b1329 !important;
                    border: 2px solid rgba(59, 130, 246, 0.5) !important;
                    color: #f1f5f9 !important;
                    border-radius: 10px !important;
                }
                :global(.dark) .ud-form-group select:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .ud-form-group label {
                    color: #94a3b8 !important;
                }
                :global(.dark) .ud-dropzone {
                    background: rgba(26, 115, 232, 0.05) !important;
                    border: 2px dashed rgba(59, 130, 246, 0.45) !important;
                }
                :global(.dark) .ud-dropzone.drag-over {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .dropzone-text {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .dropzone-hint {
                    color: #94a3b8 !important;
                }
                :global(.dark) .file-preview {
                    background: #0b1329 !important;
                    border: 1px solid rgba(59, 130, 246, 0.35) !important;
                }
                :global(.dark) .file-name {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .file-size,
                :global(.dark) .file-meta span {
                    color: #94a3b8 !important;
                }
                :global(.dark) .file-item {
                    background: #0b1329 !important;
                    border: 1px solid rgba(59, 130, 246, 0.3) !important;
                }
                :global(.dark) .file-item:hover {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .file-icon {
                    background: rgba(26, 115, 232, 0.15) !important;
                    border: 1px solid rgba(59, 130, 246, 0.3) !important;
                }
                :global(.dark) .file-icon i {
                    color: #38bdf8 !important;
                }
                :global(.dark) .file-preview > i {
                    color: #38bdf8 !important;
                }
                :global(.dark) .dropzone-icon i {
                    color: #38bdf8 !important;
                }
                :global(.dark) .browse-label {
                    color: #38bdf8 !important;
                }
                :global(.dark) .ud-dropzone {
                    background: #0b1329 !important;
                    border-color: rgba(59, 130, 246, 0.4) !important;
                }
                :global(.dark) .ud-dropzone.drag-over {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .ud-dropzone.has-file {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .file-preview {
                    background: #0b1329 !important;
                    border-color: rgba(59, 130, 246, 0.3) !important;
                }
                :global(.dark) .file-count {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #93c5fd !important;
                }
                :global(.dark) .btn-upload,
                :global(.dark) .btn-go-upload,
                :global(.dark) .btn-trigger-upload {
                    background: #1a73e8 !important;
                    border: 1.5px solid #3b82f6 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important;
                    border-radius: 10px !important;
                }
                :global(.dark) .btn-action,
                :global(.dark) .btn-remove-file {
                    background: #0b1329 !important;
                    border: 1px solid rgba(59, 130, 246, 0.35) !important;
                    color: #93c5fd !important;
                }
                :global(.dark) .btn-action:hover {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #ffffff !important;
                }

                /* ── MOBILE RESPONSIVE ── */
                @media (max-width: 768px) {
                    .ud-section { padding: 16px; border-radius: 14px; }
                    .section-title h3 { font-size: 0.9rem; }
                    .ud-dropzone { padding: 30px 16px; }
                    .dropzone-icon i { font-size: 2.5rem; }
                    .file-preview { padding: 12px; gap: 12px; }
                    .file-preview > i { font-size: 2rem; }
                    .ud-tabs { flex-direction: row; gap: 6px; padding: 6px; }
                    .ud-tab { flex: 1; padding: 10px 8px; font-size: 0.78rem; gap: 6px; }
                    
                    .file-item {
                        display: flex;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                        padding: 14px;
                        border-radius: 14px;
                    }
                    .file-main-row {
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        width: 100%;
                    }
                    .file-icon {
                        width: 42px;
                        height: 42px;
                        border-radius: 10px;
                        flex-shrink: 0;
                    }
                    .file-icon i { font-size: 1.35rem; }
                    .file-details {
                        flex: 1;
                        min-width: 0;
                        gap: 4px;
                    }
                    .file-details .file-name {
                        font-size: 0.88rem;
                        font-weight: 700;
                        white-space: normal;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        line-height: 1.35;
                        word-break: break-word;
                    }
                    .file-meta {
                        gap: 6px 12px;
                        margin-top: 4px;
                    }
                    .file-meta span {
                        font-size: 0.72rem;
                    }
                    .ab-actions-row {
                        width: 100% !important;
                        display: flex !important;
                        justify-content: flex-end !important;
                        padding-top: 10px;
                        margin-top: 2px;
                        border-top: 1px dashed var(--n-border);
                    }
                    :global(.dark) .ab-actions-row {
                        border-top-color: rgba(59, 130, 246, 0.25);
                    }
                }
            `}</style>
        </div>
    )
}