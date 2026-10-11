'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { PageLoader } from '@/components/ui/Spinner';
import { Modal, ModalBody, ModalField, ModalFileInput, ModalFooter } from '@/components/ui/Modal';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import Button from '@/components/ui/Button';
import FilterToolbar, { FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { MobileFab } from '@/components/mobile';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { DesktopFab } from '@/components/ui/DesktopFab';
import '../informasi.css';

const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });

/** Pilihan visibilitas, dipakai select folder maupun select per-dokumen. */
const AUDIENCE_OPTIONS = [
    { value: 'umum', label: 'Umum' },
    { value: 'siswa', label: 'Siswa' },
    { value: 'guru', label: 'Guru' },
    { value: 'none', label: 'Sembunyi' },
];

interface Document {
    id: string;
    title: string;
    category: string;
    file_url: string;
    file_name: string;
    file_size: number;
    show_on_landing: boolean;
    sort_order: number;
    created_at: string;
    is_upload_doc?: boolean;
    audience?: string;
    folder_audience?: string;
    _parsed?: { division: string; folder: string };
}

const getFileIconInfo = (fileName: string) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    switch (ext) {
        case 'pdf': 
            return { icon: 'bi-file-earmark-pdf-fill', color: '#0284c7' };
        case 'doc':
        case 'docx': 
            return { icon: 'bi-file-earmark-word-fill', color: '#2563eb' };
        case 'xls':
        case 'xlsx': 
            return { icon: 'bi-file-earmark-excel-fill', color: '#10b981' };
        case 'ppt':
        case 'pptx': 
            return { icon: 'bi-file-earmark-ppt-fill', color: '#f59e0b' };
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg':
            return { icon: 'bi-file-earmark-image-fill', color: '#06b6d4' };
        case 'zip':
        case 'rar':
        case '7z':
            return { icon: 'bi-file-earmark-zip-fill', color: '#3b82f6' };
        case 'mp4':
        case 'mov':
        case 'avi':
            return { icon: 'bi-file-earmark-play-fill', color: '#3b82f6' };
        case 'mp3':
        case 'wav':
            return { icon: 'bi-file-earmark-music-fill', color: '#ec4899' };
        case 'html':
        case 'htm':
            return { icon: 'bi-filetype-html', color: '#ea580c' };
        default: 
            return { icon: 'bi-file-earmark-text-fill', color: 'var(--n-muted)' };
    }
};

export default function KelolaInformasiTab({
    user,
    allowedDivisions,
    onBack,
}: {
    user?: any;
    allowedDivisions?: string[];
    onBack?: () => void;
}) {
    const [list, setList] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const { registerModal } = useModalBlur()

    // Drag and Drop State
    const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
    const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);
    const [draggedFileFolder, setDraggedFileFolder] = useState<string | null>(null);

    useEffect(() => {
        if (showModal) return registerModal()
    }, [showModal, registerModal])

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [filterCat, setFilterCat] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [docToDelete, setDocToDelete] = useState<Document | null>(null);
    const [deletingDoc, setDeletingDoc] = useState(false);
    const [addingFolder, setAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [editingFolder, setEditingFolder] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [savingFolder, setSavingFolder] = useState(false);
    const [activeDivision, setActiveDivision] = useState('Akademik');
    // Folder dengan banyak file bisa mendorong folder lain jauh ke bawah;
    // tampilkan 4 dulu per folder, sisanya di balik "Lainnya".
    const FILES_PREVIEW_COUNT = 4;
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const toggleFolderExpand = (cat: string) =>
        setExpandedFolders(prev => ({ ...prev, [cat]: !prev[cat] }));

    const userRoles = (user?.roles || []).map((r: string) => r.toUpperCase());
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR');

    const fallbackDivisions: string[] = [];
    if (isAdmin) {
        fallbackDivisions.push('Akademik', 'Kesiswaan', 'Keasramaan', 'Umum', 'Dokumen Unggahan');
    } else {
        if (userRoles.includes('WKM_AKADEMIK')) {
            fallbackDivisions.push('Akademik', 'Dokumen Unggahan');
        }
        if (userRoles.includes('WKM_KESISWAAN')) {
            fallbackDivisions.push('Kesiswaan');
        }
        if (userRoles.includes('WKM_KEASRAMAAN')) {
            fallbackDivisions.push('Keasramaan');
        }
        if (userRoles.includes('WKM_HUMAS')) {
            fallbackDivisions.push('Umum');
        }
    }

    const availableDivisions = Array.isArray(allowedDivisions) && allowedDivisions.length > 0
        ? allowedDivisions
        : fallbackDivisions;
    
    const canManage = availableDivisions.length > 0;
    const canView = true;

    // Auto set active division based on first available if not admin
    useEffect(() => {
        if (availableDivisions.length > 0 && !availableDivisions.includes(activeDivision)) {
            setActiveDivision(availableDivisions[0]);
        }
    }, [availableDivisions, activeDivision]);

    const isPlaceholderDoc = (d: any) => d?.file_url === '#' || !d?.file_name || d?.title === 'Folder placeholder';

    // Enhanced parser: detects "[Division] Folder" or defaults to "Akademik"
    const parseCat = (rawCat: string) => {
        const clean = (rawCat || '').trim();
        const match = clean.match(/^\[([^\]]+)\]\s*(.*)$/);
        const divCategoryMap: Record<string, string> = {
            'AKADEMIK': 'Akademik',
            'KESISWAAN': 'Kesiswaan',
            'KEASRAMAAN': 'Keasramaan',
            'HUMAS': 'Umum',
            'SARPRAS': 'Umum',
            'UMUM': 'Umum',
            'WKM_AKADEMIK': 'Akademik',
            'WKM_KESISWAAN': 'Kesiswaan',
            'WKM_KEASRAMAAN': 'Keasramaan',
            'WKM_HUMAS': 'Umum',
            'UNGGAHAN': 'Dokumen Unggahan'
        };

        if (match) {
            const rawDiv = match[1].trim().toUpperCase();
            const mappedDiv = divCategoryMap[rawDiv] || match[1].trim();
            const folderName = match[2].trim() || 'Informasi Utama';
            return { division: mappedDiv, folder: folderName };
        }
        // Handle exact mapping if stored as name without brackets
        for (const [key, mapped] of Object.entries(divCategoryMap)) {
            if (clean.toUpperCase().startsWith(key + ' - ')) {
                 const folderName = clean.substring(key.length + 3).trim() || 'Informasi Utama';
                 return { division: mapped, folder: folderName };
            }
        }
        return { division: 'Akademik', folder: clean || 'Informasi Utama' }; // Legacy fallback
    };

    // Prepend current active division for DB storage
    const encodeCat = (folderName: string) => {
        const clean = (folderName || '').replace(/^\[.*?\]\s*/, '').trim() || 'Informasi Utama';
        return `[${activeDivision}] ${clean}`;
    };

    useEffect(() => { if (canView) fetchData(); }, [canView]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Pengelola (ADMIN/WKM_*) perlu melihat semua data termasuk yang disembunyikan
            let roleParam = '';
            if (!canManage) {
                const matched = [];
                if (userRoles.includes('GURU')) matched.push('guru');
                if (userRoles.includes('SISWA')) matched.push('siswa');
                roleParam = `&role=${matched.length > 0 ? matched.join(',') : 'umum'}`;
            }
            const r = await fetch(`/api/informasi-akademik?admin=${canManage ? 'true' : 'false'}${roleParam}`);
            const json = await r.json();
            if (json.ok && Array.isArray(json.data)) {
                // Enhance all items with parsed division context
                const parsed = json.data.map((d: any) => ({
                    ...d,
                    _parsed: parseCat(d.category)
                }));
                // Initial sort by sort_order
                const sorted = parsed.sort((a: any, b: any) => (a.sort_order || 999) - (b.sort_order || 999));
                setList(sorted);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    // Nilai visibilitas efektif sebuah dokumen (umum/guru/siswa/none)
    const getDocAudienceValue = (doc: Document) => {
        if (doc.is_upload_doc) return doc.audience || 'none';
        if (doc.show_on_landing === false) return 'none';
        return doc.audience || 'umum';
    };

    // Nilai visibilitas folder: seragam → nilai itu, campuran → 'mixed'
    const getFolderAudienceValue = (cat: string) => {
        if (activeDivision === 'Dokumen Unggahan') {
            return (divisionDocs.find((d: any) => d._parsed.folder === cat) as any)?.folder_audience || 'none';
        }
        const docs = list.filter((d: any) => d._parsed.division === activeDivision && d._parsed.folder === cat);
        if (docs.length === 0) return 'umum';
        const values = docs.map(d => getDocAudienceValue(d));
        return values.every(v => v === values[0]) ? values[0] : 'mixed';
    };

    const handleFolderDragStart = (e: React.DragEvent, index: number) => {
        setDraggedFolderIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleFolderDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedFolderIndex === null || draggedFolderIndex === index) return;
        // Visual feedback could go here
    };

    const handleFolderDrop = async (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedFolderIndex === null || draggedFolderIndex === targetIndex) {
            setDraggedFolderIndex(null);
            return;
        }

        const cats = [...categoriesList];
        const [movedCat] = cats.splice(draggedFolderIndex, 1);
        cats.splice(targetIndex, 0, movedCat);

        // Update local state immediately for smooth UI
        const newList = [...list];
        // Assign new sort orders based on new category sequence
        // We'll give each folder a base order (1000, 2000, ...) and maintain file order within
        const updates: any[] = [];
        cats.forEach((cat, cIdx) => {
            const folderDocs = list.filter((d: any) => d._parsed.division === activeDivision && d._parsed.folder === cat);
            folderDocs.forEach((doc, dIdx) => {
                const newOrder = (cIdx + 1) * 1000 + dIdx;
                updates.push({ id: doc.id, sort_order: newOrder });
                // Update local doc
                const localDoc = newList.find(ld => ld.id === doc.id);
                if (localDoc) localDoc.sort_order = newOrder;
            });
        });

        setList(newList.sort((a, b) => a.sort_order - b.sort_order));
        setDraggedFolderIndex(null);

        // Save to DB
        try {
            await fetch('/api/informasi-akademik', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
        } catch (err) { console.error(err); }
    };

    const handleFileDragStart = (e: React.DragEvent, docId: string, cat: string, index: number) => {
        setDraggedFileIndex(index);
        setDraggedFileFolder(cat);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleFileDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleFileDrop = async (e: React.DragEvent, targetCat: string, targetIndex: number) => {
        e.preventDefault();
        if (draggedFileIndex === null || draggedFileFolder === null) return;
        
        // Only allow reordering within the same folder for now as per "Urutan file juga sebaiknya diatur seperti urutan folder"
        // If user wants to move across folders, that's more complex but let's stick to same folder reordering first.
        if (draggedFileFolder !== targetCat) {
            setDraggedFileIndex(null);
            setDraggedFileFolder(null);
            return;
        }

        const folderDocs = list.filter((d: any) => d._parsed.division === activeDivision && d._parsed.folder === targetCat && !isPlaceholderDoc(d)).sort((a: any, b: any) => a.sort_order - b.sort_order);
        if (draggedFileIndex === targetIndex) {
            setDraggedFileIndex(null);
            setDraggedFileFolder(null);
            return;
        }

        const movedDocs = [...folderDocs];
        const [movedDoc] = movedDocs.splice(draggedFileIndex, 1);
        movedDocs.splice(targetIndex, 0, movedDoc);

        const newList = [...list];
        const updates: any[] = [];
        
        // Find base order for this folder
        const folderBaseOrder = Math.floor((movedDoc.sort_order || 1000) / 1000) * 1000;

        movedDocs.forEach((doc, idx) => {
            const newOrder = folderBaseOrder + idx;
            updates.push({ id: doc.id, sort_order: newOrder });
            const localDoc = newList.find(ld => ld.id === doc.id);
            if (localDoc) localDoc.sort_order = newOrder;
        });

        setList(newList.sort((a, b) => a.sort_order - b.sort_order));
        setDraggedFileIndex(null);
        setDraggedFileFolder(null);

        // Save to DB
        try {
            await fetch('/api/informasi-akademik', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
        } catch (err) { console.error(err); }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) return;

        const chosenFolder = (isAddingCategory ? newCategory : category).trim();
        if (!chosenFolder) {
            Swal.fire('Folder Wajib Dipilih', 'Silakan pilih folder tujuan atau masukkan nama folder baru.', 'warning');
            return;
        }

        const cleanFolder = chosenFolder.replace(/^\[.*?\]\s*/, '').trim();
        if (!cleanFolder) {
            Swal.fire('Folder Wajib', 'Nama folder tidak boleh kosong.', 'warning');
            return;
        }

        setSaving(true); setUploadProgress(0);
        let ok = 0, fail = 0;
        let lastError = '';

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > 20 * 1024 * 1024) { fail++; lastError = 'File terlalu besar (maks 20MB)'; continue; }
                let currentTitle = files.length === 1 && title
                    ? title
                    : file.name.split('.').slice(0, -1).join('.').replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                try {
                    const uploadJson = await new Promise<any>((resolve, reject) => {
                        const fd = new FormData();
                        fd.append('file', file);
                        const targetDiv = activeDivision || 'Akademik';
                        const safeCategory = cleanFolder.replace(/[/\\]/g, '-');
                        fd.append('folder', `Informasi ${targetDiv}/${safeCategory}`);

                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', '/api/upload', true);
                        xhr.withCredentials = true;
                        xhr.timeout = 600000;

                        xhr.upload.onprogress = (ev) => {
                            if (ev.lengthComputable) setUploadProgress(Math.round(((i + ev.loaded / ev.total) / files.length) * 100));
                        };
                        xhr.onload = () => {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                if (xhr.status === 200 && response.ok) {
                                    resolve(response);
                                } else {
                                    reject(new Error(response.error || `Server Status ${xhr.status}`));
                                }
                            } catch {
                                reject(new Error('Respon hosting tidak valid'));
                            }
                        };
                        xhr.ontimeout = () => reject(new Error('Upload timeout'));
                        xhr.onerror = () => reject(new Error('Koneksi ke hosting terputus'));
                        xhr.send(fd);
                    });

                    const finalCategory = encodeCat(cleanFolder);
                    const dbRes = await fetch('/api/informasi-akademik', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: currentTitle, category: finalCategory, file_url: uploadJson.publicUrl, file_name: file.name, file_type: file.type, file_size: file.size, sort_order: 999, user_id: user?.auth_id || user?.id })
                    });
                    
                    if (dbRes.ok) {
                        ok++;
                    } else { 
                        const errData = await dbRes.json();
                        fail++; 
                        lastError = errData.error || 'Gagal simpan ke database'; 
                    }
                } catch (e: any) {
                    fail++;
                    lastError = e.message;
                }
            }

            if (ok > 0) { 
                Swal.fire({ icon: 'success', title: 'Berhasil', text: `${ok} file berhasil diunggah${fail > 0 ? `, ${fail} gagal.` : '.'}`, timer: 2000, showConfirmButton: false }); 
                resetForm(); fetchData(); 
            }
            else if (fail > 0) {
                Swal.fire('Gagal', 'Detail: ' + lastError, 'error');
            }
        } catch (err: any) { 
            console.error(err); 
            Swal.fire('Error', err.message || 'Terjadi kesalahan sistem', 'error'); 
        } finally { setSaving(false); }
    };

    // Konfirmasi hapus memakai <Modal variant="delete"> (components/Modal.tsx),
    // seragam dengan 32 halaman lain — bukan Swal seperti sebelumnya.
    const handleDelete = (doc: Document) => setDocToDelete(doc);

    const confirmDeleteDoc = async () => {
        if (!docToDelete) return;
        setDeletingDoc(true);
        try {
            // Delete via centralized storage API
            await fetch(`/api/storage/upload?url=${encodeURIComponent(docToDelete.file_url)}`, { method: 'DELETE' });
            const r = await fetch(`/api/informasi-akademik?id=${docToDelete.id}`, { method: 'DELETE' });
            const json = await r.json();
            if (json.ok) {
                setDocToDelete(null);
                fetchData();
                Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Dokumen berhasil dihapus', timer: 1600, showConfirmButton: false });
            } else {
                Swal.fire('Gagal', json.error || 'Dokumen gagal dihapus', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Terjadi kesalahan saat menghapus', 'error');
        } finally {
            setDeletingDoc(false);
        }
    };

    const handleUpdateAudience = async (doc: Document, newAudience: string) => {
        const payload: any = { id: doc.id, audience: newAudience };
        // Dokumen informasi biasa: sinkronkan show_on_landing agar konsumen lama tetap konsisten
        if (!doc.is_upload_doc) payload.show_on_landing = newAudience !== 'none';
        const r = await fetch('/api/informasi-akademik', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await r.json();
        if (json.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Visibilitas diperbarui',
                timer: 1500,
                showConfirmButton: false
            });
            fetchData();
        }
    };

    const handleUpdateFolderAudience = async (cat: string, newAudience: string) => {
        const docs = list.filter((d: any) => d._parsed.division === activeDivision && d._parsed.folder === cat);
        const isUploadDivision = activeDivision === 'Dokumen Unggahan';

        try {
            if (isUploadDivision) {
                // Update the upload category itself
                await fetch('/api/informasi-akademik', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_category: true, category: cat, audience: newAudience })
                });
            }

            // Update all documents in this category to inherit the new audience
            if (docs.length > 0) {
                const updates = docs
                    .filter(d => isUploadDivision ? d.is_upload_doc : !d.is_upload_doc)
                    .map(doc => doc.is_upload_doc
                        ? { id: doc.id, audience: newAudience }
                        : { id: doc.id, audience: newAudience, show_on_landing: newAudience !== 'none' });
                if (updates.length > 0) {
                    const r = await fetch('/api/informasi-akademik', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ updates })
                    });
                    const json = await r.json();
                    if (!json.ok) throw new Error(json.error || 'Gagal menyimpan perubahan');
                }
            }

            fetchData();
            Swal.fire({
                icon: 'success',
                title: `Visibilitas folder diperbarui`,
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error: any) {
            console.error(error);
            Swal.fire('Error', error.message || 'Gagal memperbarui folder', 'error');
        }
    };


    const handleAddFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newFolderName.trim();
        if (!name) return;
        if (categoriesList.includes(name)) {
            Swal.fire('Gagal', 'Nama folder sudah ada', 'warning');
            return;
        }
        setSavingFolder(true);
        try {
            const finalCat = encodeCat(name);
            const r = await fetch('/api/informasi-akademik', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Folder placeholder', category: finalCat, file_url: '#', file_name: '', file_type: '', file_size: 0, sort_order: 999 })
            });
            const json = await r.json();
            if (json.ok) {
                setNewFolderName('');
                setAddingFolder(false);
                fetchData();
                Swal.fire({ icon: 'success', title: 'Berhasil', text: `Folder "${name}" ditambahkan`, timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire('Gagal', json.error || 'Gagal menambahkan folder', 'error');
            }
        } catch (err) { console.error(err); Swal.fire('Error', 'Terjadi kesalahan', 'error'); }
        finally { setSavingFolder(false); }
    };

    const handleRenameFolder = async (oldCat: string, newCat: string) => {
        const name = newCat.trim();
        if (!name || name === oldCat) { setEditingFolder(null); return; }
        if (categoriesList.includes(name)) {
            Swal.fire('Gagal', 'Nama folder sudah ada', 'warning');
            return;
        }
        setSavingFolder(true);
        try {
            const r = await fetch('/api/informasi-akademik', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: encodeCat(oldCat), new_category: encodeCat(name) })
            });
            const json = await r.json();
            if (json.ok) {
                setEditingFolder(null);
                fetchData();
                Swal.fire({ icon: 'success', title: 'Berhasil', text: `Folder "${oldCat}" renamed to "${name}"`, timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire('Gagal', json.error || 'Gagal mengubah nama folder', 'error');
            }
        } catch (err) { console.error(err); Swal.fire('Error', 'Terjadi kesalahan', 'error'); }
        finally { setSavingFolder(false); }
    };

    const handleDeleteFolder = async (cat: string) => {
        const docs = (list as any[]).filter(d =>
            d._parsed?.folder === cat && d._parsed?.division === activeDivision
        );
        const realDocs = docs.filter(d => !isPlaceholderDoc(d));

        const confirm = await Swal.fire({
            title: 'Hapus Folder?',
            html: realDocs.length > 0
                ? `Folder <b>"${cat}"</b> berisi <b>${realDocs.length} dokumen</b>.<br/>Folder beserta seluruh berkas di dalamnya akan dihapus.`
                : `Hapus folder kosong <b>"${cat}"</b>?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonText: 'Batal',
            confirmButtonText: 'Hapus Folder',
            showDenyButton: false
        });
        if (!confirm.isConfirmed) return;

        try {
            const r = await fetch(`/api/informasi-akademik?category=${encodeURIComponent(encodeCat(cat))}`, {
                method: 'DELETE'
            });
            const json = await r.json();
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: `Folder "${cat}" dihapus`, timer: 1500, showConfirmButton: false });
                fetchData();
            } else {
                Swal.fire('Gagal', json.error || 'Gagal menghapus folder', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Gagal menghapus folder', 'error');
        }
    };

    const formatSize = (bytes: number) => {
        if (!bytes || bytes <= 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'Bytes');
    };

    // Filter list to current active division
    const divisionDocs = list.filter((d: any) => d._parsed.division === activeDivision);

    const categoriesList = Array.from(new Set(
        divisionDocs.map((d: any) => d._parsed?.folder?.trim()).filter(Boolean)
    )).sort((a, b) => {
        const ao = divisionDocs.find((d: any) => d._parsed?.folder === a)?.sort_order ?? 999;
        const bo = divisionDocs.find((d: any) => d._parsed?.folder === b)?.sort_order ?? 999;
        return ao - bo;
    });

    const modalFolders = Array.from(new Set(
        divisionDocs.map((d: any) => d._parsed?.folder?.trim()).filter(Boolean)
    )) as string[];

    const openUploadModal = (targetFolder?: string) => {
        setTitle('');
        setFiles([]);
        setNewCategory('');
        setIsAddingCategory(false);
        const folder = (targetFolder || (filterCat !== 'ALL' ? filterCat : (modalFolders[0] || 'Informasi Utama'))).trim();
        setCategory(folder);
        setShowModal(true);
    };

    const resetForm = () => {
        setTitle('');
        setNewCategory('');
        setIsAddingCategory(false);
        setFiles([]);
        setShowModal(false);
    };

    const filteredList = (filterCat === 'ALL' ? divisionDocs : divisionDocs.filter((d: any) => d._parsed.folder === filterCat))
        .filter((d: any) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return d.title.toLowerCase().includes(q) || d._parsed.folder.toLowerCase().includes(q);
        });

    const groupedDocs = filteredList.reduce((acc: any, doc: any) => {
        const folder = doc._parsed.folder;
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push(doc);
        return acc;
    }, {});
    Object.keys(groupedDocs).forEach(cat => groupedDocs[cat].sort((a: any, b: any) => a.title.localeCompare(b.title)));
    const sortedGroupKeys = Object.keys(groupedDocs).sort((a, b) => {
        const ao = groupedDocs[a][0]?.sort_order ?? 999;
        const bo = groupedDocs[b][0]?.sort_order ?? 999;
        return ao - bo;
    });

    if (loading) return <PageLoader minHeight="300px" dotsOnly size={18} />;

    return (
        <div className="inf">
            {/* TOOLBAR */}
            <FilterToolbar
                leading={onBack ? (
                    <button
                        type="button"
                        className="inf-backBtn"
                        onClick={onBack}
                        title="Kembali ke Informasi"
                        aria-label="Kembali ke Informasi"
                    >
                        <i className="bi bi-arrow-left" />
                    </button>
                ) : undefined}
            >
                {availableDivisions.length > 1 && (
                    <FilterSelect
                        label="Divisi"
                        icon="building"
                        value={activeDivision}
                        onChange={(val) => {
                            setActiveDivision(val);
                            setFilterCat('ALL');
                        }}
                        options={availableDivisions.map(div => ({ value: div, label: div }))}
                        width="180px"
                    />
                )}
                <FilterSelect
                    label="Folder"
                    icon="folder"
                    value={filterCat}
                    onChange={setFilterCat}
                    options={[
                        { value: 'ALL', label: 'Semua Folder' },
                        ...categoriesList.map(cat => ({ value: cat, label: cat }))
                    ]}
                    width="200px"
                />
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari dokumen atau folder..."
                    label="Pencarian"
                />
            </FilterToolbar>

            {/* Aksi Unggah keluar dari baris filter: desktop pakai FAB melayang
                (pola halaman Jadwal), mobile mengambil slot tengah bottom nav
                selama berada di Kelola Informasi. */}
            {canManage && (
                <>
                    <DesktopFab label="Unggah" icon="cloud-arrow-up" onClick={() => openUploadModal()} />
                    <MobileFab label="Unggah" icon="cloud-arrow-up" onClick={() => openUploadModal()} />
                </>
            )}



            {/* SCROLL AREA */}
            <div className="inf-scroll">
                {/* Folder Ordering Section */}
                {canManage && (
                    <div className="inf__folderOrder">
                        <div className="inf__folderOrderHead">
                            <h4><i className="bi bi-folder-check"></i> Atur Urutan Folder</h4>
                            {!addingFolder ? (
                                <button className="inf__folderAddBtn" onClick={() => { setAddingFolder(true); setNewFolderName(''); }}>
                                    <i className="bi bi-plus-lg"></i> Tambah Folder
                                </button>
                            ) : (
                                <button className="inf__folderAddBtn inf__folderAddBtn--cancel" onClick={() => setAddingFolder(false)}>
                                    <i className="bi bi-x-lg"></i> Batal
                                </button>
                            )}
                        </div>

                        {addingFolder && (
                            <form className="inf__addFolderForm" onSubmit={handleAddFolder}>
                                <input
                                    type="text"
                                    className="inf__folderOrderInput"
                                    placeholder="Nama folder baru..."
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <button type="submit" className="inf__folderSaveBtn" disabled={savingFolder}>
                                    {savingFolder ? <><div className="inf-spinner"></div></> : <><i className="bi bi-check-lg"></i></>}
                                </button>
                            </form>
                        )}

                        <div className="inf__folderList">
                            {categoriesList.length === 0 && !addingFolder ? (
                                <div className="inf__folderEmpty">Belum ada folder</div>
                            ) : categoriesList.map((cat, idx) => {
                                const isEditing = editingFolder === cat;
                                const folderAudience = getFolderAudienceValue(cat);

                                return (
                                    <div 
                                        key={cat} 
                                        className={`inf__folderItem ${draggedFolderIndex === idx ? 'is-dragging' : ''}`}
                                        draggable={canManage && !isEditing}
                                        onDragStart={(e) => handleFolderDragStart(e, idx)}
                                        onDragOver={(e) => handleFolderDragOver(e, idx)}
                                        onDrop={(e) => handleFolderDrop(e, idx)}
                                        onDragEnd={(e) => {
                                            const target = e.target as HTMLElement;
                                            target.classList.remove('is-dragging');
                                            setDraggedFolderIndex(null);
                                        }}
                                    >
                                        <div className="inf__folderMain">
                                            <span className="inf__folderName">
                                                <i className="bi bi-folder-fill"></i>
                                                {isEditing ? (
                                                    <form className="inf__renameForm" onSubmit={e => { e.preventDefault(); handleRenameFolder(cat, editFolderName); }}>
                                                        <input
                                                            type="text"
                                                            className="inf__folderOrderInput"
                                                            value={editFolderName}
                                                            onChange={e => setEditFolderName(e.target.value)}
                                                            required
                                                            autoFocus
                                                        />
                                                        <button type="submit" className="inf__folderSaveBtn" disabled={savingFolder} title="Simpan">
                                                            <i className="bi bi-check-lg"></i>
                                                        </button>
                                                    </form>
                                                ) : cat}
                                            </span>
                                        </div>
                                        <div className="inf__folderControls">
                                            {!isEditing && (
                                                <>
                                                    <InlineSelect
                                                        value={folderAudience}
                                                        onChange={(val) => handleUpdateFolderAudience(cat, val)}
                                                        title="Atur visibilitas folder"
                                                        options={[
                                                            ...(folderAudience === 'mixed'
                                                                ? [{ value: 'mixed', label: 'Terbatas', disabled: true }]
                                                                : []),
                                                            ...AUDIENCE_OPTIONS,
                                                        ]}
                                                    />
                                                    <ActionGroup>
                                                        <ActionButton action="edit" onClick={() => { setEditingFolder(cat); setEditFolderName(cat); }} title="Ubah Nama" />
                                                        <ActionButton action="delete" onClick={() => handleDeleteFolder(cat)} title="Hapus Folder" />
                                                    </ActionGroup>
                                                </>
                                            )}
                                            {isEditing && (
                                                <ActionButton action="delete" onClick={() => setEditingFolder(null)} title="Batal" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {/* MOBILE CARDS */}
                <div className="inf-cards">
                    {sortedGroupKeys.length === 0 ? (
                        <div className="inf-empty"><i className="bi bi-inbox"></i><p>Belum ada dokumen</p></div>
                    ) : sortedGroupKeys.map(catKey => {
                        const allDocs = groupedDocs[catKey] || [];
                        const realDocs = allDocs.filter((d: any) => !isPlaceholderDoc(d));
                        const isExpanded = !!expandedFolders[catKey];
                        const visibleDocs = isExpanded ? realDocs : realDocs.slice(0, FILES_PREVIEW_COUNT);
                        const hiddenCount = realDocs.length - visibleDocs.length;
                        return (
                        <div key={catKey} className="inf-group">
                            <div className="inf-group-head"><i className="bi bi-folder-fill"></i>{catKey}</div>
                            <div className="inf-group-body">
                                {realDocs.length === 0 ? (
                                    <div style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--n-ink-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                        Folder ini masih kosong
                                    </div>
                                ) : visibleDocs.map((doc: Document, fIdx: number) => (
                                    <div
                                        key={doc.id}
                                        className={`inf-doc-card ${draggedFileIndex === fIdx && draggedFileFolder === catKey ? 'is-dragging-file' : ''}`}
                                        draggable={canManage && !doc.is_upload_doc}
                                        onDragStart={(e) => handleFileDragStart(e, doc.id, catKey, fIdx)}
                                        onDragOver={handleFileDragOver}
                                        onDrop={(e) => handleFileDrop(e, catKey, fIdx)}
                                        onClick={() => setSelectedDoc(doc)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {canManage && !doc.is_upload_doc && (
                                            <div className="inf-doc-drag-handle">
                                                <i className="bi bi-grip-vertical"></i>
                                            </div>
                                        )}
                                        <div className="inf-doc-link">
                                            <i 
                                                className={`bi ${getFileIconInfo(doc.file_name || doc.title).icon}`} 
                                                style={{ color: getFileIconInfo(doc.file_name || doc.title).color }}
                                            ></i>
                                            <div className="inf-doc-info">
                                                <div className="inf-doc-title">{doc.title}</div>
                                                <div className="inf-doc-meta">{formatSize(doc.file_size)} &bull; {new Date(doc.created_at).toLocaleDateString('id-ID')}</div>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="inf-doc-actions" onClick={(e) => e.stopPropagation()}>
                                                <InlineSelect
                                                    value={getDocAudienceValue(doc)}
                                                    onChange={(val) => handleUpdateAudience(doc, val)}
                                                    options={AUDIENCE_OPTIONS}
                                                    disabled={doc.is_upload_doc && doc.folder_audience === 'none'}
                                                    title={doc.is_upload_doc && doc.folder_audience === 'none' ? "Tidak bisa diubah karena folder disembunyikan" : "Visibilitas"}
                                                />
                                                {!doc.is_upload_doc && (
                                                    <ActionButton action="delete" onClick={() => handleDelete(doc)} title="Hapus" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {(hiddenCount > 0 || isExpanded) && realDocs.length > FILES_PREVIEW_COUNT && (
                                <button
                                    type="button"
                                    className="inf-group-more"
                                    onClick={() => toggleFolderExpand(catKey)}
                                >
                                    {isExpanded
                                        ? <><i className="bi bi-chevron-up"></i> Sembunyikan</>
                                        : <><i className="bi bi-chevron-down"></i> Lainnya ({hiddenCount})</>}
                                </button>
                            )}
                        </div>
                        );
                    })}
                </div>

                {/* DESKTOP TABLE */}
                <div className="inf-table-wrap">
                    <table className="inf-table">
                        <thead>
                            <tr>
                                <th>Judul Dokumen</th>
                                <th>Kategori</th>
                                <th>Info File</th>
                                <th>Tgl Unggah</th>
                                {canManage && <th>Visibilitas</th>}
                                {canManage && <th className="th-right">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!canView ? <tr><td colSpan={canManage ? 6 : 4} className="inf-empty-cell">Akses ditolak.</td></tr>
                            : filteredList.length === 0 ? <tr><td colSpan={canManage ? 6 : 4} className="inf-empty-cell">Tidak ada dokumen.</td></tr>
                            : sortedGroupKeys.map(catKey => {
                                const allDocs = groupedDocs[catKey] || [];
                                const realDocs = allDocs.filter((d: any) => !isPlaceholderDoc(d));
                                const isExpanded = !!expandedFolders[catKey];
                                const visibleDocs = isExpanded ? realDocs : realDocs.slice(0, FILES_PREVIEW_COUNT);
                                const hiddenCount = realDocs.length - visibleDocs.length;
                                return (
                                <React.Fragment key={catKey}>
                                    <tr>
                                        <td colSpan={canManage ? 6 : 4} className="inf-cat-row">
                                            <i className="bi bi-folder-fill"></i>{catKey}
                                        </td>
                                    </tr>
                                    {realDocs.length === 0 ? (
                                        <tr>
                                            <td colSpan={canManage ? 6 : 4} style={{ textAlign: 'center', padding: '16px', color: 'var(--n-ink-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                                Folder ini masih kosong
                                            </td>
                                        </tr>
                                    ) : visibleDocs.map((doc: Document, fIdx: number) => (
                                        <tr 
                                            key={doc.id}
                                            className={`${draggedFileIndex === fIdx && draggedFileFolder === catKey ? 'is-dragging-file' : ''}`}
                                            draggable={canManage && !doc.is_upload_doc}
                                            onDragStart={(e) => handleFileDragStart(e, doc.id, catKey, fIdx)}
                                            onDragOver={handleFileDragOver}
                                            onDrop={(e) => handleFileDrop(e, catKey, fIdx)}
                                        >
                                            <td className="inf-doc-title-cell">
                                                <button
                                                    className="inf-doc-link-desktop"
                                                    onClick={() => setSelectedDoc(doc)}
                                                    style={{ 
                                                        background: 'none', 
                                                        border: 'none', 
                                                        cursor: 'pointer', 
                                                        font: 'inherit',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        textAlign: 'left',
                                                        color: 'var(--n-ink)',
                                                        width: '100%',
                                                        padding: 0
                                                    }}
                                                >
                                                    <i 
                                                        className={`bi ${getFileIconInfo(doc.file_name || doc.title).icon}`} 
                                                        style={{ color: getFileIconInfo(doc.file_name || doc.title).color, marginRight: '10px', flexShrink: 0, fontSize: '1.1rem' }}
                                                    ></i>
                                                    <span style={{ fontWeight: 600 }}>{doc.title}</span>
                                                </button>
                                            </td>
                                            <td><span className="inf-cat-badge">{doc._parsed?.folder}</span></td>
                                            <td className="inf-meta-cell">{formatSize(doc.file_size)}</td>
                                            <td>{new Date(doc.created_at).toLocaleDateString('id-ID')}</td>
                                            {canManage && (
                                                <td>
                                                    <InlineSelect
                                                        value={getDocAudienceValue(doc)}
                                                        onChange={(val) => handleUpdateAudience(doc, val)}
                                                        options={AUDIENCE_OPTIONS}
                                                        disabled={doc.is_upload_doc && doc.folder_audience === 'none'}
                                                        title={doc.is_upload_doc && doc.folder_audience === 'none' ? "Tidak bisa diubah karena folder disembunyikan" : "Visibilitas"}
                                                    />
                                                </td>
                                            )}
                                            {canManage && (
                                                <td>
                                                    <div className="inf-actions">
                                                {!doc.is_upload_doc && (
                                                    <ActionButton action="delete" onClick={() => handleDelete(doc)} />
                                                )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {(hiddenCount > 0 || isExpanded) && realDocs.length > FILES_PREVIEW_COUNT && (
                                        <tr>
                                            <td colSpan={canManage ? 6 : 4} className="inf-more-row">
                                                <button
                                                    type="button"
                                                    className="inf-group-more"
                                                    onClick={() => toggleFolderExpand(catKey)}
                                                >
                                                    {isExpanded
                                                        ? <><i className="bi bi-chevron-up"></i> Sembunyikan</>
                                                        : <><i className="bi bi-chevron-down"></i> Lainnya ({hiddenCount})</>}
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="inf-modal-overlay" onClick={resetForm}>
                    <div className="inf-modal" onClick={e => e.stopPropagation()}>
                        <div className="inf-modal-head">
                            <h4>Unggah Informasi Baru</h4>
                            <button onClick={resetForm}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleUpload}>
                            <div className="inf-modal-body">
                                <ModalField label="Kategori Folder" required>
                                    <InlineSelect
                                        value={isAddingCategory ? 'TAMBAH_BARU' : category}
                                        onChange={val => {
                                            if (val === 'TAMBAH_BARU') { setIsAddingCategory(true); setCategory(''); }
                                            else { setIsAddingCategory(false); setCategory(val); }
                                        }}
                                        options={[
                                            ...(modalFolders.length > 0
                                                ? modalFolders.map(cat => ({ value: cat, label: cat }))
                                                : [{ value: 'Informasi Utama', label: 'Informasi Utama' }]),
                                            { value: 'TAMBAH_BARU', label: `+ Tambah Folder Baru di ${activeDivision}...` },
                                        ]}
                                    />
                                    {isAddingCategory && (
                                        <input type="text" placeholder={`Nama Folder di ${activeDivision}`} value={newCategory}
                                            onChange={e => { setNewCategory(e.target.value); setCategory(e.target.value); }} required autoFocus />
                                    )}
                                </ModalField>
                                {files.length <= 1 && (
                                    <ModalField label="Judul Informasi" required={files.length === 1}>
                                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                            placeholder="Contoh: Jadwal Ujian" required={files.length === 1} />
                                    </ModalField>
                                )}
                                <ModalField
                                    label={`File Dokumen${files.length > 0 ? ` (${files.length} terpilih)` : ''}`}
                                    required
                                    hint="Maksimal 20 MB per file"
                                >
                                    <ModalFileInput
                                        files={files}
                                        multiple
                                        placeholder="Pilih berkas atau jatuhkan di sini"
                                        onPick={sel => {
                                            const valid = sel.filter(f => f.size <= 20 * 1024 * 1024);
                                            if (sel.some(f => f.size > 20 * 1024 * 1024)) Swal.fire('File Terlalu Besar', 'Maksimal 20 MB.', 'warning');
                                            setFiles(valid);
                                            if (valid.length === 1) {
                                                const t = valid[0].name.split('.').slice(0, -1).join('.').replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                                setTitle(t);
                                            }
                                        }}
                                    />
                                </ModalField>
                            </div>
                            <div className="inf-modal-foot">
                                <button type="button" className="inf-btn inf-btn--ghost" onClick={resetForm}>Batal</button>
                                <button type="submit" className="inf-btn inf-btn--primary" disabled={saving || files.length === 0 || (files.length === 1 && !title)}>
                                    {saving ? <><div className="inf-spinner"></div>{uploadProgress}%</> : `Upload${files.length > 1 ? ` ${files.length} File` : ''}`}
                                </button>
                            </div>
                            {saving && <div className="inf-progress"><div className="inf-progress-bar" style={{ width: `${uploadProgress}%` }}></div></div>}
                        </form>
                    </div>
                </div>, document.body
            )}

            {/* Konfirmasi hapus dokumen — komponen Modal bersama, bukan Swal */}
            {docToDelete && (
                <Modal
                    open={!!docToDelete}
                    size="sm"
                    variant="delete"
                    icon="trash3"
                    title="Hapus Dokumen?"
                    onClose={() => !deletingDoc && setDocToDelete(null)}
                >
                    <ModalBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                            <div><strong>Judul:</strong> {docToDelete.title}</div>
                            <div><strong>Folder:</strong> {docToDelete._parsed?.folder || '-'}</div>
                            <div><strong>Berkas:</strong> {docToDelete.file_name}</div>
                            <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '6px' }}>
                                Dokumen dan berkasnya akan dihapus permanen. Lanjutkan?
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter align="end">
                        <Button
                            type="button"
                            variant="cancel"
                            onClick={() => setDocToDelete(null)}
                            disabled={deletingDoc}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={confirmDeleteDoc}
                            isLoading={deletingDoc}
                            leftIcon={<i className="bi bi-trash3" />}
                        >
                            Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {selectedDoc && (
                <PDFViewer
                    url={selectedDoc.file_url}
                    title={selectedDoc.file_name || selectedDoc.title}
                    onClose={() => setSelectedDoc(null)}
                />
            )}
        </div>
    );
}
