'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
    };

    const handleImport = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            Swal.fire('Validasi', 'Pilih file Excel terlebih dahulu', 'warning');
            return;
        }

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });

                    // Read ALL sheets — supports export files with multiple sheets (Semua, Izin, Sakit)
                    let allData: any[] = [];
                    for (const wsname of wb.SheetNames) {
                        const ws = wb.Sheets[wsname];
                        const sheetData = XLSX.utils.sheet_to_json(ws);
                        allData = allData.concat(sheetData);
                    }

                    if (allData.length === 0) {
                        throw new Error('File Excel kosong atau tidak terbaca');
                    }

                    // Map and Validate Data — kolom harus persis sama dengan export
                    const payload = allData.map((row: any) => {
                        const nisn = String(row.NISN || '').trim();
                        const jenis = String(row.Jenis || '').toUpperCase().trim();

                        // Skip baris header (NISN == "NISN" artinya ini baris judul kolom)
                        if (nisn === 'NISN' || jenis === 'JENIS') return null;
                        const status = String(row.Status || '').trim();
                        const tgl_mulai = row['Tgl Mulai'] || row['Tanggal Mulai'] || '';
                        const tgl_selesai = row['Tgl Selesai'] || row['Tanggal Selesai'] || tgl_mulai;
                        const keterangan = row.Keterangan || '';

                        // Parse "Waktu (Real)" dari format "07:00–17:00"
                        const rawWaktu = row['Waktu (Real)'] || '';
                        let waktu_mulai_real: string | null = null;
                        let waktu_selesai_real: string | null = null;

                        if (rawWaktu && typeof rawWaktu === 'string' && rawWaktu.trim() !== '-' && rawWaktu.trim() !== '') {
                            const separator = rawWaktu.includes('–') ? '–' : rawWaktu.includes('-') ? '-' : null;
                            if (separator) {
                                const [s, e] = rawWaktu.split(separator).map(t => t.trim());
                                waktu_mulai_real = s || null;
                                waktu_selesai_real = e || null;
                            }
                        }

                        // Handle date objects from XLSX (serial number or Date object)
                        const formatDate = (val: any) => {
                            if (!val || val === '') return '';
                            if (val instanceof Date) return val.toISOString().split('T')[0];
                            if (typeof val === 'number') {
                                const d = XLSX.SSF.parse_date_code(val);
                                return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                            }
                            return String(val);
                        };

                        return {
                            nisn,
                            jenis,
                            status,
                            tgl_mulai: formatDate(tgl_mulai),
                            tgl_selesai: formatDate(tgl_selesai),
                            keterangan,
                            waktu_mulai_real,
                            waktu_selesai_real,
                            tindakan: row.Tindakan || null,
                            tindak_lanjut: row['Tindak Lanjut'] || null,
                            petugas_nama: row.Petugas || null,
                            petugas_nip: row['Petugas NIP'] || null,
                            petugas_role: row['Petugas Role'] || null
                        };
                    }).filter(Boolean);

                    // Basic verification
                    const invalid = payload.filter((p: any) => !p?.nisn || !p?.jenis || !p?.tgl_mulai || !p?.keterangan);
                    if (invalid.length > 0) {
                        throw new Error(`Ada ${invalid.length} baris data yang tidak lengkap (NISN/Jenis/Tgl/Keterangan kosong)`);
                    }

                    // Call API
                    const res = await fetch('/api/ketidakhadiran/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rows: payload })
                    });

                    const resData = await res.json();
                    if (resData.ok) {
                        const parts = [`Berhasil: ${resData.added} data`];
                        if (resData.skipped > 0) parts.push(`${resData.skipped} duplikat (di-skip)`);
                        if (resData.failed_count > 0) parts.push(`${resData.failed_count} gagal`);

                        // Build detail message
                        let detailHtml = '';
                        if (resData.failed && resData.failed.length > 0) {
                            detailHtml += '<div style="text-align:left; margin-top:10px;"><b style="color:#dc2626;">Gagal:</b><ul style="margin:4px 0; padding-left:18px;">';
                            resData.failed.forEach((f: any) => {
                                detailHtml += `<li><b>${f.nisn}</b>${f.nama ? ` (${f.nama})` : ''}: ${f.error}</li>`;
                            });
                            detailHtml += '</ul></div>';
                        }
                        if (resData.skipped_details && resData.skipped_details.length > 0) {
                            detailHtml += '<div style="text-align:left; margin-top:10px;"><b style="color:#f59e0b;">Di-skip (Duplikat):</b><ul style="margin:4px 0; padding-left:18px;">';
                            resData.skipped_details.slice(0, 10).forEach((s: any) => {
                                detailHtml += `<li><b>${s.nisn}</b>${s.nama ? ` (${s.nama})` : ''} - ${s.jenis} ${s.tgl_mulai}: ${s.reason}</li>`;
                            });
                            if (resData.skipped_details.length > 10) {
                                detailHtml += `<li style="color:#888;">...dan ${resData.skipped_details.length - 10} lagi</li>`;
                            }
                            detailHtml += '</ul></div>';
                        }

                        Swal.fire({
                            title: resData.failed_count > 0 && resData.added === 0 ? 'Import Selesai' : 'Berhasil',
                            html: `<div>${parts.join(' | ')}</div>${detailHtml}`,
                            icon: resData.failed_count > 0 && resData.added === 0 ? 'warning' : 'success',
                            width: '500px'
                        });
                        onSuccess();
                        onClose();
                    } else {
                        throw new Error(resData.error || 'Gagal mengimport data');
                    }

                } catch (err: any) {
                    Swal.fire('Gagal Import', err.message, 'error');
                } finally {
                    setUploading(false);
                }
            };
            reader.readAsBinaryString(file);

        } catch (error: any) {
            Swal.fire('Error', error.message, 'error');
            setUploading(false);
        }
    };

    const downloadTemplate = () => {
        const template = [
            {
                NISN: '1234567890',
                Nama: 'Contoh Siswa',
                Kelas: 'X-A',
                Jenis: 'IZIN',
                Status: 'MADRASAH',
                'Tgl Mulai': '2024-04-20',
                'Tgl Selesai': '2024-04-21',
                'Waktu (Real)': '',
                Keterangan: 'Lomba Matematika',
                Tindakan: '',
                'Tindak Lanjut': ''
            },
            {
                NISN: '0987654321',
                Nama: 'Siswa Sakit',
                Kelas: 'XI-B',
                Jenis: 'SAKIT',
                Status: 'Ringan',
                'Tgl Mulai': '2024-04-22',
                'Tgl Selesai': '2024-04-22',
                'Waktu (Real)': '07:00–17:00',
                Keterangan: 'Demam tinggi',
                Tindakan: 'Istirahat di UKS, minum paracetamol',
                'Tindak Lanjut': 'Observasi 2 jam'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Import");
        XLSX.writeFile(wb, "Template_Import_Ketidakhadiran.xlsx");
    };

    return (
        <Modal onClose={onClose} size="sm">
            <ModalHeader
                title="Import Data Excel"
                subtitle="Unggah data ketidakhadiran massal"
                icon="file-earmark-excel"
                onClose={onClose}
            />

            <ModalBody>
                <div className="kh-form">
                    <div className="kh-alert kh-alert--info" style={{ marginBottom: '1rem' }}>
                        <div className="kh-alert__icon"><i className="bi bi-info-circle-fill"></i></div>
                        <div className="kh-alert__content">
                            <p className="kh-alert__title">Panduan Import</p>
                            <p className="kh-alert__body">
                                Pastikan kolom NISN, Jenis, Status, Tanggal, dan Keterangan terisi dengan benar.
                            </p>
                        </div>
                    </div>

                    <div className="kh-field">
                        <label className="kh-label">File Excel (.xlsx / .xls)</label>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            id="import-file"
                        />
                        <label htmlFor="import-file" className={`kh-upload__box ${fileName ? 'is-success' : ''}`}>
                            {fileName ? (
                                <div className="kh-upload__success">
                                    <i className="bi bi-file-earmark-check-fill" style={{ color: '#10b981' }}></i>
                                    <div className="kh-upload__success-info">
                                        <span className="kh-upload__success-label">File Terpilih</span>
                                        <span className="kh-upload__success-name">{fileName}</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <i className="bi bi-cloud-arrow-up-fill" style={{ fontSize: '2rem', color: 'var(--kh-text-muted)', marginBottom: '0.5rem', display: 'block' }}></i>
                                    <span className="kh-upload__text-main">Pilih File Excel</span>
                                    <span className="kh-upload__text-sub">Klik atau seret file ke sini</span>
                                </>
                            )}
                        </label>
                    </div>

                    <Button type="button" variant="outline" onClick={downloadTemplate} leftIcon={<i className="bi bi-download" />}>
                        Unduh Template Excel
                    </Button>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="cancel" onClick={onClose} disabled={uploading} leftIcon={<i className="bi bi-x-lg" />}>
                    Batal
                </Button>
                <Button type="button" variant="primary" onClick={handleImport} isLoading={uploading} disabled={!fileName} leftIcon={<i className="bi bi-cloud-arrow-up-fill" />}>
                    Mulai Import
                </Button>
            </ModalFooter>
        </Modal>
    );
}
