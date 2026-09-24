'use client';

import { useState } from 'react';
import Swal from 'sweetalert2';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    folders: { id: string, nama: string }[];
    currentFolderId: string | null;
    totalStorageBytes?: number;
    maxStorageBytes?: number;
}

export default function UploadModal({ isOpen, onClose, onSuccess, folders, currentFolderId, totalStorageBytes = 0, maxStorageBytes = 100 * 1024 * 1024 }: UploadModalProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>(currentFolderId && currentFolderId !== '__root__' ? currentFolderId : (folders[0]?.id || ''));
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);

    if (!isOpen) return null;

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB max per single file as well

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        const validFiles: File[] = [];
        const oversizedFiles: string[] = [];

        selectedFiles.forEach(file => {
            if (file.size <= MAX_FILE_SIZE) {
                validFiles.push(file);
            } else {
                oversizedFiles.push(file.name);
            }
        });

        if (oversizedFiles.length > 0) {
            Swal.fire({
                icon: 'error',
                title: 'File Terlalu Besar',
                text: `File berikut melebihi batas 100MB per file: ${oversizedFiles.join(', ')}`,
            });
        }

        setFiles(prev => [...prev, ...validFiles]);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadFile = async (file: File, index: number): Promise<void> => {
        const folderName = folders.find(f => f.id === selectedFolder)?.nama || 'others';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', selectedFolder || '');
        formData.append('folder_name', folderName);

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/personal/documents/upload', true);
            xhr.timeout = 600000;

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (xhr.status === 200 && response.ok) {
                        resolve();
                    } else {
                        reject(response.error || `Gagal mengunggah ${file.name}`);
                    }
                } catch (e) {
                    reject(`Respon server tidak valid untuk ${file.name}`);
                }
            };

            xhr.ontimeout = () => reject(`Unggahan ${file.name} melebihi batas waktu`);
            xhr.onerror = () => reject(`Koneksi ke server terputus saat mengunggah ${file.name}`);
            xhr.send(formData);
        });
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (files.length === 0) {
            Swal.fire('Peringatan', 'Silakan pilih file terlebih dahulu', 'warning');
            return;
        }
        if (!selectedFolder) {
            Swal.fire('Peringatan', 'Silakan pilih folder tujuan terlebih dahulu', 'warning');
            return;
        }

        // Validate 100 MB total limit per user
        const newFilesTotalSize = files.reduce((acc, f) => acc + f.size, 0);
        if (totalStorageBytes + newFilesTotalSize > maxStorageBytes) {
            const usedMB = (totalStorageBytes / (1024 * 1024)).toFixed(1);
            const newMB = (newFilesTotalSize / (1024 * 1024)).toFixed(1);
            const maxMB = (maxStorageBytes / (1024 * 1024)).toFixed(0);
            Swal.fire({
                icon: 'error',
                title: 'Batas Penyimpanan Terlampaui',
                text: `Kapasitas Dokumen Pribadi dibatasi maksimal ${maxMB} MB per pengguna.\nPenggunaan Anda saat ini: ${usedMB} MB.\nUkuran file baru: ${newMB} MB.\nSilakan hapus beberapa dokumen lama terlebih dahulu.`,
            });
            return;
        }

        setUploading(true);
        let successCount = 0;
        let failCount = 0;
        let lastError = '';
        
        for (let i = 0; i < files.length; i++) {
            setCurrentFileIndex(i);
            setProgress(0);
            try {
                await uploadFile(files[i], i);
                successCount++;
            } catch (error: any) {
                console.error(`Error uploading ${files[i].name}:`, error);
                lastError = error;
                failCount++;
            }
        }

        setUploading(false);
        if (failCount === 0) {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: `${successCount} file berhasil diunggah`,
                timer: 2000,
                showConfirmButton: false
            });
            onSuccess();
            onClose();
        } else {
            Swal.fire(
                'Gagal Mengunggah',
                `${successCount} berhasil, ${failCount} gagal diunggah.\nDetail error: ${lastError}`,
                'error'
            );
            if (successCount > 0) onSuccess();
        }
        setFiles([]);
    };

    const resetForm = () => {
        setFiles([]);
        onClose();
    };

    return (
        <div className="inf-modal-overlay" onClick={resetForm}>
            <div className="inf-modal" onClick={e => e.stopPropagation()}>
                <div className="inf-modal-head">
                    <h4>Unggah Dokumen Baru</h4>
                    <button type="button" onClick={resetForm} disabled={uploading}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
                <form onSubmit={handleUpload}>
                    <div className="inf-modal-body">
                        <div className="inf-form-group">
                            <label>Simpan ke Folder</label>
                            <select 
                                className="inf-form-input" 
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                                disabled={uploading}
                            >
                                {folders.length === 0 && <option value="">-- Belum ada folder --</option>}
                                {folders.length > 0 && !selectedFolder && <option value="">-- Pilih folder --</option>}
                                {folders.map(f => (
                                    <option key={f.id} value={f.id}>{f.nama}</option>
                                ))}
                            </select>
                        </div>
                        <div className="inf-form-group">
                            <label>File Dokumen {files.length > 0 && `(${files.length} terpilih)`}</label>
                            <input 
                                type="file" 
                                multiple 
                                className="inf-form-input" 
                                onChange={handleFileChange}
                                disabled={uploading} 
                            />
                            <small className="inf-form-hint">Maksimal 500 MB per file</small>
                        </div>
                        
                        {files.length > 0 && (
                            <div className="inf-selected-files">
                                {files.map((f, i) => (
                                    <div key={i} className="inf-selected-file">
                                        <div className="inf-file-info">
                                            <i className="bi bi-file-earmark-text"></i>
                                            <div className="inf-file-details">
                                                <span className="inf-file-name">{f.name}</span>
                                                <span className="inf-file-size">{(f.size / (1024 * 1024)).toFixed(1)} MB</span>
                                            </div>
                                        </div>
                                        {!uploading && (
                                            <button type="button" className="inf-file-remove" onClick={() => removeFile(i)}>
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="inf-modal-foot">
                        <button type="button" className="inf-btn inf-btn--ghost" onClick={resetForm} disabled={uploading}>
                            Batal
                        </button>
                        <button type="submit" className="inf-btn inf-btn--primary" disabled={uploading || files.length === 0 || !selectedFolder}>
                            {uploading ? (
                                <>
                                    <div className="inf-spinner"></div>
                                    {progress}%
                                </>
                            ) : (
                                `Upload${files.length > 1 ? ` ${files.length} File` : ''}`
                            )}
                        </button>
                    </div>
                    {uploading && (
                        <div className="inf-progress">
                            <div className="inf-progress-bar" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                </form>
            </div>

            <style jsx>{`
                /* MODAL */
                .inf-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); backdrop-filter: blur(8px); display: flex; align-items: flex-end; justify-content: center; z-index: 10000; padding: 0; }
                .inf-modal { background: var(--n-card); border-radius: 20px 20px 0 0; width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
                @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .inf-modal-head { padding: 18px 20px 14px; border-bottom: 1px solid var(--n-border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--n-card); z-index: 1; }
                .inf-modal-head h4 { font-size: 1rem; font-weight: 700; margin: 0; }
                .inf-modal-head button { width: 30px; height: 30px; border-radius: 9px; border: none; background: var(--n-surface); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--n-muted); font-size: 0.85rem; }
                .inf-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 4px; }
                .inf-form-group { margin-bottom: 12px; display: flex; flex-direction: column; gap: 5px; }
                .inf-form-group label { font-size: 0.7rem; font-weight: 700; color: var(--n-muted); }
                .inf-form-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--n-border); font-size: 0.88rem; background: var(--n-card); color: var(--n-ink); outline: none; transition: border-color 0.2s; }
                .inf-form-input:focus { border-color: var(--n-primary); }
                .inf-form-hint { font-size: 0.7rem; color: var(--n-muted); }
                .inf-modal-foot { padding: 14px 20px; border-top: 1px solid var(--n-border); display: flex; justify-content: flex-end; gap: 10px; position: sticky; bottom: 0; background: var(--n-card); }
                .inf-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 0.82rem; cursor: pointer; border: 1.5px solid var(--n-border); transition: all 0.2s; }
                .inf-btn--primary { background: var(--n-primary); color: white; border-color: var(--n-primary); }
                .inf-btn--ghost { background: transparent; color: var(--n-muted); }
                .inf-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
                .inf-progress { height: 4px; background: var(--n-border); margin: 0 20px 16px; border-radius: 2px; overflow: hidden; }
                .inf-progress-bar { height: 100%; background: var(--n-primary); transition: width 0.3s ease; }
                
                /* SELECTED FILES PREVIEW */
                .inf-selected-files { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; max-height: 180px; overflow-y: auto; padding-right: 4px; }
                .inf-selected-file { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--n-surface); border: 1px solid var(--n-border); border-radius: 10px; }
                .inf-file-info { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
                .inf-file-info i { color: var(--n-muted); font-size: 1.1rem; }
                .inf-file-details { display: flex; flex-direction: column; min-width: 0; }
                .inf-file-name { font-size: 0.8rem; font-weight: 600; color: var(--n-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .inf-file-size { font-size: 0.65rem; color: var(--n-muted); }
                .inf-file-remove { width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.6; transition: all 0.2s; }
                .inf-file-remove:hover { opacity: 1; background: rgba(239, 68, 68, 0.1); }

                @media (min-width: 769px) {
                    .inf-modal-overlay { align-items: center; padding: 20px; }
                    .inf-modal { border-radius: 16px; }
                    .inf-modal-head { border-radius: 16px 16px 0 0; }
                }
            `}</style>
        </div>
    );
}

