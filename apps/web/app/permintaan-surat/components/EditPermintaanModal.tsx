'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Button } from '@/components/ui/Button';
import type { PermintaanSuratRow } from './DetailPermintaanModal';
import type { JenisSuratConfig } from './AddPermintaanModal';

interface EditPermintaanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row: PermintaanSuratRow | null;
  configList?: JenisSuratConfig[];
}

export default function EditPermintaanModal({
  isOpen,
  onClose,
  onSuccess,
  row,
  configList: externalConfigList,
}: EditPermintaanModalProps) {
  const [internalConfigs, setInternalConfigs] = useState<JenisSuratConfig[]>([]);
  const [jenisSurat, setJenisSurat] = useState('');
  const [customJenis, setCustomJenis] = useState('');
  const [judul, setJudul] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploadedName, setUploadedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load configs dari pengaturan jika externalConfigList belum tersedia
  useEffect(() => {
    if (!isOpen) return;
    if (externalConfigList && externalConfigList.length > 0) {
      setInternalConfigs(externalConfigList);
      return;
    }

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/permintaan-surat/pengaturan');
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          setInternalConfigs(json.data);
        }
      } catch (e) {
        console.error('Error fetching pengaturan surat in edit modal:', e);
      }
    };

    fetchConfig();
  }, [isOpen, externalConfigList]);

  // Daftar opsi jenis surat berdasarkan data Pengaturan
  const options = useMemo(() => {
    const list = (externalConfigList && externalConfigList.length > 0)
      ? externalConfigList
      : internalConfigs;

    const activeList = list.filter((c) => c.is_active !== false);
    const opts = activeList.map((c) => ({
      value: c.nama,
      label: c.nama,
    }));

    // Jika row memiliki jenis_surat yang belum ada di opsi aktif dan bukan Lainnya, tambahkan agar tidak hilang
    if (row?.jenis_surat && !opts.some((o) => o.value.toLowerCase() === row.jenis_surat.toLowerCase())) {
      opts.unshift({ value: row.jenis_surat, label: row.jenis_surat });
    }

    opts.push({ value: 'Lainnya', label: 'Jenis Surat Lainnya...' });
    return opts;
  }, [externalConfigList, internalConfigs, row?.jenis_surat]);

  useEffect(() => {
    if (isOpen && row) {
      const matchJenis = options.find(
        (p) => p.value.toLowerCase().trim() === (row.jenis_surat || '').toLowerCase().trim()
      );

      if (matchJenis && matchJenis.value !== 'Lainnya') {
        setJenisSurat(matchJenis.value);
        setCustomJenis('');
      } else {
        setJenisSurat('Lainnya');
        setCustomJenis(row.jenis_surat || '');
      }

      setJudul(row.judul || '');
      setKeperluan(row.keperluan || '');

      // Parse lampiran
      if (Array.isArray(row.lampiran_json) && row.lampiran_json.length > 0) {
        const first = row.lampiran_json[0];
        if (typeof first === 'string') {
          setUploadedUrl(first);
          setUploadedName(first.split('/').pop() || 'Dokumen Terlampir');
        } else if (first && typeof first === 'object') {
          setUploadedUrl(first.url || '');
          setUploadedName(first.name || 'Dokumen Terlampir');
        }
      } else if (typeof row.lampiran_json === 'string' && row.lampiran_json) {
        setUploadedUrl(row.lampiran_json);
        setUploadedName(row.lampiran_json.split('/').pop() || 'Dokumen Terlampir');
      } else {
        setUploadedUrl('');
        setUploadedName('');
      }
    }
  }, [isOpen, row, options]);

  if (!row) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 15 * 1024 * 1024) {
      Swal.fire({
        title: 'Error',
        text: 'Ukuran file maksimal 15 MB',
        icon: 'error',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setUploadedName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'PermintaanSurat');

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 150);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
      if (data.ok) {
        const fileUrl = data.publicUrl || data.url;
        setUploadedUrl(fileUrl);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Lampiran berhasil diperbarui',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        throw new Error(data.error || data.message || 'Gagal mengunggah file');
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
    const finalJenis = jenisSurat === 'Lainnya' ? customJenis.trim() : jenisSurat;
    if (!finalJenis) {
      Swal.fire({
        title: 'Validasi',
        text: 'Jenis surat wajib dipilih atau diisi',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    if (!keperluan.trim()) {
      Swal.fire({
        title: 'Validasi',
        text: 'Keperluan / alasan pengajuan wajib diisi',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    const finalJudul = judul.trim() || `Permohonan ${finalJenis}`;

    setSubmitting(true);
    try {
      const lampiranPayload = uploadedUrl
        ? [{ name: uploadedName || 'Lampiran Berkas', url: uploadedUrl }]
        : [];

      const res = await fetch(`/api/permintaan-surat/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis_surat: finalJenis,
          judul: finalJudul,
          keperluan: keperluan.trim(),
          lampiran_json: lampiranPayload,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        await Swal.fire({
          title: 'Perubahan Disimpan!',
          text: 'Permintaan surat berhasil diperbarui.',
          icon: 'success',
          timer: 1800,
          showConfirmButton: false,
        });
        onSuccess();
        onClose();
      } else {
        Swal.fire({
          title: 'Gagal',
          text: data.error || 'Terjadi kesalahan saat menyimpan perubahan',
          icon: 'error',
          confirmButtonColor: '#3083FF',
        });
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Error',
        text: err.message || 'Gagal menghubungi server',
        icon: 'error',
        confirmButtonColor: '#3083FF',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      variant="default"
      icon="pencil-square"
      title="Edit Permintaan Surat"
      subtitle={`Perbarui rincian permohonan surat oleh ${row.pemohon_nama}`}
    >
      <ModalBody>
        {/* Jenis Surat dari Pengaturan */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Jenis Surat <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <InlineSelect
            value={jenisSurat}
            onChange={(val) => setJenisSurat(val)}
            options={options}
            minWidth="100%"
            height="40px"
          />
        </div>

        {jenisSurat === 'Lainnya' && (
          <div className="ps-form-group">
            <label className="ps-form-label">
              Nama Jenis Surat Lainnya <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              className="ps-form-input"
              value={customJenis}
              onChange={(e) => setCustomJenis(e.target.value)}
              placeholder="Masukkan jenis surat..."
            />
          </div>
        )}

        {/* Judul Permintaan */}
        <div className="ps-form-group">
          <label className="ps-form-label">Judul / Perihal Surat</label>
          <input
            type="text"
            className="ps-form-input"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
          />
        </div>

        {/* Keperluan / Deskripsi */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Keperluan / Alasan Pengajuan <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            className="ps-form-textarea"
            rows={3}
            value={keperluan}
            onChange={(e) => setKeperluan(e.target.value)}
          />
        </div>

        {/* Upload Lampiran */}
        <div className="ps-form-group">
          <label className="ps-form-label">Berkas Lampiran / Pendukung</label>

          {!uploadedUrl ? (
            <div
              className="ps-file-upload"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.8rem', color: 'var(--ps-accent)' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500, marginTop: 4 }}>
                {uploading ? 'Sedang mengunggah...' : 'Klik untuk mengunggah berkas pengganti'}
              </div>
            </div>
          ) : (
            <div className="ps-file-preview">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <i className="bi bi-file-earmark-check-fill" style={{ color: '#16a34a', fontSize: '1.2rem', flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {uploadedName || 'Berkas Terlampir'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                title="Hapus berkas"
              >
                <i className="bi bi-trash" />
              </button>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={submitting}
          icon="check-lg"
        >
          Simpan Perubahan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
