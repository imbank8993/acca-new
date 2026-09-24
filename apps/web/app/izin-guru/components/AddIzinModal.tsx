'use client';

import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import DatePicker from '@/components/ui/DatePicker';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface AddIzinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddIzinModal({ isOpen, onClose, onSuccess }: AddIzinModalProps) {
  const [jenis, setJenis] = useState<'izin' | 'sakit'>('izin');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploadedName, setUploadedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset saat modal ditutup
  useEffect(() => {
    if (!isOpen) {
      setJenis('izin');
      setTanggalMulai('');
      setTanggalSelesai('');
      setKeterangan('');
      setUploadedUrl('');
      setUploadedName('');
    }
  }, [isOpen]);

  // ── File Upload via centralized API ─────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire({ title: 'Error', text: 'Ukuran file maksimal 10 MB', icon: 'error', confirmButtonColor: '#3083FF' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadedName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'IzinGuru');

      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 15;
        if (progress <= 85) setUploadProgress(progress);
      }, 150);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
      if (data.ok) {
        const fileUrl = data.publicUrl || data.url;
        setUploadedUrl(fileUrl);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Upload berhasil!', timer: 1500, showConfirmButton: false });
      } else {
        throw new Error(data.error || data.message || 'Upload gagal');
      }
    } catch (err: any) {
      Swal.fire({ title: 'Upload Gagal', text: err.message || 'Gagal menghubungi server', icon: 'error', confirmButtonColor: '#3083FF' });
      setUploadedUrl('');
      setUploadedName('');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    setUploadedUrl('');
    setUploadedName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!tanggalMulai) {
      Swal.fire({ title: 'Validasi', text: 'Tanggal izin wajib dipilih', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    if (!keterangan.trim()) {
      Swal.fire({ title: 'Validasi', text: 'Keterangan wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/izin-guru', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jenis,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai || tanggalMulai,
          keterangan: keterangan.trim(),
          surat_tugas_url: uploadedUrl || null,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        await Swal.fire({ title: 'Berhasil', text: 'Pengajuan berhasil dikirim', icon: 'success', timer: 1800, showConfirmButton: false });
        onSuccess();
        onClose();
      } else {
        if (res.status === 401) {
          Swal.fire({ title: 'Sesi Habis', text: 'Silakan refresh halaman dan login ulang.', icon: 'warning', confirmButtonColor: '#3083FF' });
        } else {
          Swal.fire({ title: 'Gagal', text: data.error || 'Terjadi kesalahan', icon: 'error', confirmButtonColor: '#3083FF' });
        }
      }
    } catch (err: any) {
      console.error('[AddIzinModal] Unexpected error:', err);
      Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#3083FF' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      variant="add"
      icon={jenis === 'izin' ? 'calendar-check' : 'heart-pulse'}
      title={`Ajukan ${jenis === 'izin' ? 'Izin' : 'Sakit'}`}
      subtitle="Isi formulir pengajuan dan tunggu persetujuan Kepala Madrasah"
    >
      <ModalBody>
        <div className="ig-form">
          {/* Jenis */}
          <div className="ig-field">
            <label className="ig-label">Jenis Pengajuan</label>
            <InlineSelect
              value={jenis}
              onChange={(val) => setJenis(val as 'izin' | 'sakit')}
              options={[
                { value: 'izin', label: 'Izin' },
                { value: 'sakit', label: 'Sakit' },
              ]}
              minWidth="100%"
              height="38px"
            />
          </div>

          {/* Tanggal (1 isian, rentang) */}
          <div className="ig-field">
            <label className="ig-label">
              Tanggal / Rentang Waktu <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <DatePicker
              value={tanggalMulai}
              valueEnd={tanggalSelesai}
              isRange={true}
              placeholder="Pilih tanggal atau rentang waktu..."
              onChangeRange={(start, end) => {
                setTanggalMulai(start);
                setTanggalSelesai(end);
              }}
              onChange={(start) => {
                setTanggalMulai(start);
                if (!tanggalSelesai) setTanggalSelesai(start);
              }}
            />
            <p className="ig-hint">Pilih 1 tanggal atau pilih rentang tanggal awal s/d selesai</p>
          </div>

          {/* Keterangan */}
          <div className="ig-field">
            <label className="ig-label">
              {jenis === 'izin' ? 'Keperluan Izin' : 'Keterangan / Diagnosa'}
            </label>
            <textarea
              className="ig-input ig-textarea"
              rows={3}
              placeholder={jenis === 'izin'
                ? 'Jelaskan keperluan izin...'
                : 'Jelaskan kondisi kesehatan / diagnosa...'
              }
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>

          {/* Upload File Pendukung */}
          <div className="ig-field">
            <label className="ig-label">
              File Pendukung <span>(Opsional)</span>
            </label>
            <input
              type="file"
              id="ig-izin-file-upload"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,application/pdf"
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <label htmlFor="ig-izin-file-upload" className={`ig-upload__box ${uploadedUrl ? 'is-success' : ''}`}>
              {uploading ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="bi bi-cloud-arrow-up" />
                    <span style={{ fontSize: '0.78rem' }}>{uploadedName}</span>
                  </div>
                  <div className="ig-progress-bar-bg">
                    <div className="ig-progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="ig-progress-percent">{uploadProgress}%</div>
                </div>
              ) : uploadedUrl ? (
                <div className="ig-upload__success">
                  <i className="bi bi-check-circle-fill" />
                  <div>
                    <span className="ig-upload__success-label">Upload berhasil</span>
                    <span className="ig-upload__success-name">{uploadedName}</span>
                  </div>
                  <button type="button" className="ig-upload__remove-btn" onClick={handleRemoveFile}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              ) : (
                <div>
                  <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.4rem', color: 'var(--ig-text-muted)', display: 'block', marginBottom: 6 }} />
                  <span className="ig-upload__text-main">Klik untuk upload file pendukung</span>
                  <span className="ig-upload__text-sub">PDF atau Gambar (maks. 10 MB)</span>
                </div>
              )}
            </label>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="cancel" onClick={onClose} disabled={submitting || uploading}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={submitting}
          disabled={uploading}
          leftIcon={<i className="bi bi-send" />}
        >
          Kirim Pengajuan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
