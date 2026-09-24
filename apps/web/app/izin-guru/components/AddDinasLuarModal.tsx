'use client';

import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import DatePicker from '@/components/ui/DatePicker';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface AddDinasLuarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDinasLuarModal({ isOpen, onClose, onSuccess }: AddDinasLuarModalProps) {
  const [tanggalMulai, setTanggalMulai]     = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [keterangan, setKeterangan]         = useState('');
  const [nomorSurat, setNomorSurat]         = useState('');
  const [instansi, setInstansi]             = useState('');

  const [uploading, setUploading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl]     = useState('');
  const [uploadedName, setUploadedName]   = useState('');

  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setTanggalMulai('');
      setTanggalSelesai('');
      setKeterangan('');
      setNomorSurat('');
      setInstansi('');
      setUploadedUrl('');
      setUploadedName('');
    }
  }, [isOpen]);

  // ── File Upload via centralized API ─────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validasi format file wajib PDF
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      Swal.fire({
        title: 'Format Tidak Sesuai',
        text: 'File surat tugas dinas luar wajib berformat PDF (.pdf)',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validasi ukuran maksimal 10 MB
    if (file.size > 10 * 1024 * 1024) {
      Swal.fire({
        title: 'Ukuran Terlalu Besar',
        text: 'Ukuran file surat tugas maksimal 10 MB',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadedName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'DinasLuar');

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
      if (data.ok || data.status === 'success') {
        const fileUrl = data.publicUrl || data.file_url || data.url;
        setUploadedUrl(fileUrl);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Upload surat tugas (PDF) berhasil!', timer: 1500, showConfirmButton: false });
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
      Swal.fire({ title: 'Validasi', text: 'Tanggal mulai wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    if (!instansi.trim()) {
      Swal.fire({ title: 'Validasi', text: 'Instansi tujuan wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    if (!keterangan.trim()) {
      Swal.fire({ title: 'Validasi', text: 'Keterangan / keperluan dinas luar wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    if (uploading) {
      Swal.fire({ title: 'Mohon Tunggu', text: 'File surat tugas masih dalam proses pengunggahan', icon: 'info', confirmButtonColor: '#3083FF' });
      return;
    }
    if (!uploadedUrl) {
      Swal.fire({
        title: 'Validasi',
        text: 'File surat tugas (PDF) wajib dicantumkan untuk pengajuan Dinas Luar',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/izin-guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis: 'dinas_luar',
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai || tanggalMulai,
          keterangan: keterangan.trim(),
          nomor_surat: nomorSurat.trim() || null,
          instansi_tujuan: instansi.trim(),
          surat_tugas_url: uploadedUrl,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        await Swal.fire({ title: 'Berhasil', text: 'Pengajuan Dinas Luar berhasil dikirim', icon: 'success', timer: 1800, showConfirmButton: false });
        onSuccess();
        onClose();
      } else {
        Swal.fire({ title: 'Gagal', text: data.error || 'Terjadi kesalahan', icon: 'error', confirmButtonColor: '#3083FF' });
      }
    } catch (err: any) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#3083FF' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      variant="add"
      icon="briefcase"
      title="Ajukan Dinas Luar"
      subtitle="Upload surat tugas (PDF) dan isi detail kegiatan dinas"
    >
      <ModalBody>
        <div className="ig-form">
          {/* Tanggal (1 isian, rentang) */}
          <div className="ig-field">
            <label className="ig-label">
              Tanggal / Rentang Kegiatan Dinas <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <DatePicker
              value={tanggalMulai}
              valueEnd={tanggalSelesai}
              isRange={true}
              placeholder="Pilih tanggal atau rentang kegiatan..."
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

          {/* Instansi & Nomor Surat */}
          <div className="ig-grid-2">
            <div className="ig-field">
              <label className="ig-label">Instansi Tujuan <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="ig-input"
                placeholder="Contoh: Kemenag Kab. Bone"
                value={instansi}
                onChange={(e) => setInstansi(e.target.value)}
              />
            </div>
            <div className="ig-field">
              <label className="ig-label">Nomor Surat Tugas <span>(Opsional)</span></label>
              <input
                type="text"
                className="ig-input"
                placeholder="Contoh: B-123/MTs.../2026"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
              />
            </div>
          </div>

          {/* Keterangan */}
          <div className="ig-field">
            <label className="ig-label">Keperluan / Keterangan <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              className="ig-input ig-textarea"
              rows={2}
              placeholder="Jelaskan keperluan dinas luar..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>

          {/* Upload Surat Tugas (Wajib PDF) */}
          <div className="ig-field">
            <label className="ig-label">
              Surat Tugas <span style={{ color: '#ef4444' }}>*</span> <span style={{ color: 'var(--ig-text-muted)', fontWeight: 400 }}>(Wajib, format PDF)</span>
            </label>
            <input
              type="file"
              id="ig-file-upload"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,application/pdf"
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <label htmlFor="ig-file-upload" className={`ig-upload__box ${uploadedUrl ? 'is-success' : ''}`}>
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
                  <i className="bi bi-file-earmark-pdf-fill" style={{ fontSize: '1.5rem', color: '#dc2626' }} />
                  <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                    <span className="ig-upload__success-label">Upload Berhasil (PDF)</span>
                    <span className="ig-upload__success-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedName || 'surat_tugas.pdf'}</span>
                  </div>
                  <button type="button" className="ig-upload__remove-btn" onClick={handleRemoveFile} title="Hapus file">
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              ) : (
                <div>
                  <i className="bi bi-file-earmark-pdf" style={{ fontSize: '1.6rem', color: '#dc2626', display: 'block', marginBottom: 6 }} />
                  <span className="ig-upload__text-main">Klik untuk upload surat tugas (PDF)</span>
                  <span className="ig-upload__text-sub">Wajib format .pdf (maks. 10 MB)</span>
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
