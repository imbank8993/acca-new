'use client';

import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import DatePicker from '@/components/ui/DatePicker';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { IzinRow } from '../tabs/TabSemuaIzin';

interface EditIzinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row: IzinRow | null;
}

export default function EditIzinModal({ isOpen, onClose, onSuccess, row }: EditIzinModalProps) {
  const [jenis, setJenis] = useState<'izin' | 'sakit' | 'dinas_luar'>('izin');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [nomorSurat, setNomorSurat] = useState('');
  const [instansi, setInstansi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploadedName, setUploadedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && row) {
      setJenis(row.jenis);
      setTanggalMulai(row.tanggal_mulai ? String(row.tanggal_mulai).slice(0, 10) : '');
      setTanggalSelesai(row.tanggal_selesai ? String(row.tanggal_selesai).slice(0, 10) : '');
      setKeterangan(row.keterangan || '');
      setNomorSurat(row.nomor_surat || '');
      setInstansi(row.instansi_tujuan || '');
      setUploadedUrl(row.surat_tugas_url || '');
      setUploadedName(
        row.surat_tugas_url
          ? row.surat_tugas_url.split('/').pop()?.split('?')[0] || 'Dokumen Terlampir'
          : ''
      );
    }
    if (!isOpen) {
      setTanggalMulai('');
      setTanggalSelesai('');
      setKeterangan('');
      setNomorSurat('');
      setInstansi('');
      setUploadedUrl('');
      setUploadedName('');
      setUploadProgress(0);
      setUploading(false);
    }
  }, [isOpen, row]);

  if (!row) return null;

  const isDinasLuar = jenis === 'dinas_luar';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (isDinasLuar) {
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
    }

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire({
        title: 'Ukuran Terlalu Besar',
        text: 'Ukuran file maksimal 10 MB',
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
      formData.append('folder', isDinasLuar ? 'DinasLuar' : 'IzinGuru');

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
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: isDinasLuar ? 'Upload surat tugas (PDF) berhasil!' : 'Upload berhasil!',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        throw new Error(data.error || data.message || 'Upload gagal');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Upload Gagal',
        text: err.message || 'Gagal menghubungi server',
        icon: 'error',
        confirmButtonColor: '#3083FF',
      });
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
    if (!keterangan.trim()) {
      Swal.fire({ title: 'Validasi', text: 'Keterangan wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    if (isDinasLuar) {
      if (!instansi.trim()) {
        Swal.fire({ title: 'Validasi', text: 'Instansi tujuan wajib diisi untuk Dinas Luar', icon: 'warning', confirmButtonColor: '#3083FF' });
        return;
      }
      if (uploading) {
        Swal.fire({ title: 'Mohon Tunggu', text: 'File masih dalam proses pengunggahan', icon: 'info', confirmButtonColor: '#3083FF' });
        return;
      }
      if (!uploadedUrl) {
        Swal.fire({
          title: 'Validasi',
          text: 'File surat tugas (PDF) wajib dicantumkan untuk Dinas Luar',
          icon: 'warning',
          confirmButtonColor: '#3083FF',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/izin-guru/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          jenis,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai || tanggalMulai,
          keterangan: keterangan.trim(),
          nomor_surat: nomorSurat.trim() || null,
          instansi_tujuan: instansi.trim() || null,
          surat_tugas_url: uploadedUrl || null,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        await Swal.fire({ title: 'Berhasil', text: 'Pengajuan berhasil diperbarui', icon: 'success', timer: 1800, showConfirmButton: false });
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
      variant="edit"
      icon="pencil-square"
      title="Edit Pengajuan"
      subtitle="Perbarui data pengajuan izin / sakit / dinas luar"
    >
      <ModalBody>
        <div className="ig-form">
          {/* Info nip & nama (read-only) */}
          <div className="ig-read-only-box" style={{
            padding: '10px 14px',
            fontSize: '0.8rem', display: 'flex', gap: 16,
          }}>
            <div>
              <span style={{ color: 'var(--ig-text-muted)', fontSize: '0.7rem', display: 'block' }}>Nama</span>
              <span style={{ fontWeight: 600 }}>{row.nama_guru}</span>
            </div>
            <div>
              <span style={{ color: 'var(--ig-text-muted)', fontSize: '0.7rem', display: 'block' }}>NIP</span>
              <span style={{ fontFamily: 'monospace' }}>{row.nip}</span>
            </div>
          </div>

          {/* Jenis */}
          <div className="ig-field">
            <label className="ig-label">Jenis Pengajuan</label>
            <InlineSelect
              value={jenis}
              onChange={(val) => setJenis(val as 'izin' | 'sakit' | 'dinas_luar')}
              options={[
                { value: 'izin', label: 'Izin' },
                { value: 'sakit', label: 'Sakit' },
                { value: 'dinas_luar', label: 'Dinas Luar' },
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
              placeholder="Pilih tanggal atau rentang..."
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

          {/* Kolom khusus Dinas Luar */}
          {isDinasLuar && (
            <div className="ig-grid-2">
              <div className="ig-field">
                <label className="ig-label">Instansi Tujuan <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" className="ig-input" placeholder="Contoh: Kemenag Kab. Bone" value={instansi} onChange={(e) => setInstansi(e.target.value)} />
              </div>
              <div className="ig-field">
                <label className="ig-label">Nomor Surat Tugas <span>(Opsional)</span></label>
                <input type="text" className="ig-input" placeholder="Contoh: B-123/MTs.../2026" value={nomorSurat} onChange={(e) => setNomorSurat(e.target.value)} />
              </div>
            </div>
          )}

          {/* Keterangan */}
          <div className="ig-field">
            <label className="ig-label">
              {jenis === 'izin' ? 'Keperluan Izin' : jenis === 'sakit' ? 'Keterangan / Diagnosa' : 'Keperluan / Keterangan'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className="ig-input ig-textarea"
              rows={3}
              placeholder="Jelaskan..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>

          {/* Upload Dokumen Lampiran (Wajib PDF jika Dinas Luar) */}
          <div className="ig-field">
            <label className="ig-label">
              {isDinasLuar ? (
                <>
                  Surat Tugas <span style={{ color: '#ef4444' }}>*</span> <span style={{ color: 'var(--ig-text-muted)', fontWeight: 400 }}>(Wajib, format PDF)</span>
                </>
              ) : (
                <>
                  Dokumen Pendukung <span>(Opsional, PDF/Gambar)</span>
                </>
              )}
            </label>
            <input
              type="file"
              id="ig-edit-file-upload"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept={isDinasLuar ? '.pdf,application/pdf' : 'image/*,application/pdf'}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <label htmlFor="ig-edit-file-upload" className={`ig-upload__box ${uploadedUrl ? 'is-success' : ''}`}>
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
                  <i className={isDinasLuar ? 'bi bi-file-earmark-pdf-fill' : 'bi bi-file-earmark-check-fill'} style={{ fontSize: '1.5rem', color: isDinasLuar ? '#dc2626' : '#059669' }} />
                  <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                    <span className="ig-upload__success-label">
                      {isDinasLuar ? 'Surat Tugas (PDF) Terlampir' : 'Dokumen Terlampir'}
                    </span>
                    <span className="ig-upload__success-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {uploadedName || (isDinasLuar ? 'surat_tugas.pdf' : 'lampiran')}
                    </span>
                  </div>
                  <button type="button" className="ig-upload__remove-btn" onClick={handleRemoveFile} title="Hapus file">
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              ) : (
                <div>
                  <i className={isDinasLuar ? 'bi bi-file-earmark-pdf' : 'bi bi-cloud-arrow-up'} style={{ fontSize: '1.5rem', color: isDinasLuar ? '#dc2626' : 'var(--ig-text-muted)', display: 'block', marginBottom: 6 }} />
                  <span className="ig-upload__text-main">
                    {isDinasLuar ? 'Klik untuk upload surat tugas (PDF)' : 'Klik untuk upload dokumen pendukung'}
                  </span>
                  <span className="ig-upload__text-sub">
                    {isDinasLuar ? 'Wajib format .pdf (maks. 10 MB)' : 'PDF atau Gambar (maks. 10 MB)'}
                  </span>
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
          leftIcon={<i className="bi bi-check-lg" />}
        >
          Simpan Perubahan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
