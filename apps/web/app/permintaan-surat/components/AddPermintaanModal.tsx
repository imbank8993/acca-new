'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Button } from '@/components/ui/Button';

interface AddPermintaanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configList?: JenisSuratConfig[];
}

export interface JenisSuratConfig {
  id: string;
  nama: string;
  deskripsi?: string;
  perlu_approval: boolean;
  approver_type: 'ROLE' | 'USER' | 'NONE';
  approver_role?: string | null;
  approver_user_nip?: string | null;
  approver_user_nama?: string | null;
  is_active: boolean;
}

const DEFAULT_OPTIONS = [
  { value: 'Surat Keterangan', label: 'Surat Keterangan' },
  { value: 'Surat Tugas', label: 'Surat Tugas' },
  { value: 'Nota Dinas', label: 'Nota Dinas' },
  { value: 'Surat Rekomendasi', label: 'Surat Rekomendasi' },
  { value: 'Surat Pengantar', label: 'Surat Pengantar' },
  { value: 'Surat Izin', label: 'Surat Izin' },
  { value: 'Undangan', label: 'Undangan' },
  { value: 'Surat Panggilan', label: 'Surat Panggilan' },
  { value: 'Lainnya', label: 'Jenis Surat Lainnya...' },
];

export function getRoleApproverLabel(role?: string | null): string {
  switch (role) {
    case 'WKM_AKADEMIK':
      return 'WKM Bidang Akademik / Kurikulum';
    case 'WKM_KESISWAAN':
      return 'WKM Bidang Kesiswaan';
    case 'WKM_SARPRAS':
      return 'WKM Bidang Sarana & Prasarana';
    case 'WKM_HUMAS':
      return 'WKM Bidang Hubungan Masyarakat';
    case 'KAMAD':
      return 'Kepala Madrasah';
    case 'WALI_KELAS':
      return 'Wali Kelas';
    case 'BK':
      return 'Guru Bimbingan Konseling (BK)';
    default:
      return role ? `Pihak Berwenang (${role})` : 'Pihak Berwenang Terkait';
  }
}

export default function AddPermintaanModal({
  isOpen,
  onClose,
  onSuccess,
  configList: externalConfigList,
}: AddPermintaanModalProps) {
  const [internalConfigs, setInternalConfigs] = useState<JenisSuratConfig[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [jenisSurat, setJenisSurat] = useState('');
  const [customJenis, setCustomJenis] = useState('');
  const [judul, setJudul] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active list from external or internal
  const activeConfigs = useMemo(() => {
    const list = (externalConfigList && externalConfigList.length > 0)
      ? externalConfigList
      : internalConfigs;
    return list.filter((c) => c.is_active !== false);
  }, [externalConfigList, internalConfigs]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploadedName, setUploadedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load konfigurasi jenis surat saat modal dibuka jika external belum ada
  useEffect(() => {
    if (!isOpen) {
      setJenisSurat('');
      setCustomJenis('');
      setJudul('');
      setKeperluan('');
      setUploadedUrl('');
      setUploadedName('');
      setUploadProgress(0);
      setUploading(false);
      return;
    }

    if (externalConfigList && externalConfigList.length > 0) {
      const actives = externalConfigList.filter((c) => c.is_active !== false);
      if (actives.length > 0) {
        setJenisSurat(actives[0].nama);
      }
      return;
    }

    const loadConfig = async () => {
      setLoadingConfig(true);
      try {
        const res = await fetch('/api/permintaan-surat/pengaturan');
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          setInternalConfigs(json.data);
          const actives = json.data.filter((c: JenisSuratConfig) => c.is_active !== false);
          if (actives.length > 0) {
            setJenisSurat(actives[0].nama);
          } else {
            setJenisSurat('Surat Keterangan');
          }
        } else {
          setJenisSurat('Surat Keterangan');
        }
      } catch (e) {
        console.error('Error fetching pengaturan surat:', e);
        setJenisSurat('Surat Keterangan');
      } finally {
        setLoadingConfig(false);
      }
    };

    loadConfig();
  }, [isOpen, externalConfigList]);

  // Options untuk InlineSelect diambil murni dari data pengaturan
  const selectOptions = useMemo(() => {
    if (activeConfigs.length > 0) {
      const opts = activeConfigs.map((c) => ({
        value: c.nama,
        label: c.nama,
      }));
      opts.push({ value: 'Lainnya', label: 'Jenis Surat Lainnya...' });
      return opts;
    }
    return DEFAULT_OPTIONS;
  }, [activeConfigs]);

  // Konfigurasi terpilih
  const selectedConfig = useMemo(() => {
    return activeConfigs.find(
      (c) => c.nama.toLowerCase().trim() === (jenisSurat || '').toLowerCase().trim()
    );
  }, [activeConfigs, jenisSurat]);

  const approverLabel = useMemo(() => {
    if (!selectedConfig || !selectedConfig.perlu_approval) return '';
    if (selectedConfig.approver_type === 'USER' && (selectedConfig.approver_user_nama || selectedConfig.approver_user_nip)) {
      return selectedConfig.approver_user_nama
        ? `${selectedConfig.approver_user_nama} (${selectedConfig.approver_user_nip || 'Guru'})`
        : `NIP ${selectedConfig.approver_user_nip}`;
    }
    return getRoleApproverLabel(selectedConfig.approver_role);
  }, [selectedConfig]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 15 * 1024 * 1024) {
      Swal.fire({
        title: 'Ukuran Terlalu Besar',
        text: 'Ukuran file maksimal yang diperbolehkan adalah 15 MB.',
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
          title: 'Lampiran berhasil diunggah',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        throw new Error(data.error || data.message || 'Gagal mengunggah berkas');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Upload Gagal',
        text: err.message || 'Gagal menghubungi server pengunggahan',
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
        text: 'Silakan pilih atau masukkan jenis surat yang diajukan.',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    if (!keperluan.trim()) {
      Swal.fire({
        title: 'Validasi',
        text: 'Keperluan atau alasan pengajuan surat wajib diisi.',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    const finalJudul = judul.trim() || `Permohonan ${finalJenis}`;

    setSubmitting(true);
    try {
      const lampiranPayload = uploadedUrl ? [{ name: uploadedName || 'Lampiran Berkas', url: uploadedUrl }] : [];

      const res = await fetch('/api/permintaan-surat', {
        method: 'POST',
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
          title: 'Permohonan Berhasil Dikirim!',
          text: selectedConfig?.perlu_approval
            ? `Permohonan akan diverifikasi oleh ${approverLabel} sebelum diterbitkan Operator TU.`
            : 'Permohonan telah diterima dan menunggu pemrosesan Operator TU.',
          icon: 'success',
          timer: 2200,
          showConfirmButton: false,
        });
        onSuccess();
        onClose();
      } else {
        Swal.fire({
          title: 'Gagal Mengirim',
          text: data.error || 'Terjadi kesalahan saat memproses permohonan surat.',
          icon: 'error',
          confirmButtonColor: '#3083FF',
        });
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Error Server',
        text: err.message || 'Gagal menghubungi server.',
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
      variant="add"
      icon="plus-circle"
      title="Ajukan Permintaan Surat"
      subtitle="Kirimkan permohonan penerbitan surat ke bagian tata usaha / pihak berwenang"
    >
      <ModalBody>
        {/* Jenis Surat menggunakan InlineSelect */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Jenis Surat <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <InlineSelect
            value={jenisSurat}
            onChange={(val) => setJenisSurat(val)}
            options={selectOptions}
            minWidth="100%"
            height="40px"
            disabled={loadingConfig}
          />

          {/* Notifikasi / Info Alur Approval Bertingkat */}
          {selectedConfig?.perlu_approval && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(48, 131, 255, 0.08)',
                border: '1px solid rgba(48, 131, 255, 0.25)',
                color: '#1d4ed8',
                fontSize: '0.82rem',
                lineHeight: 1.45,
                marginTop: 8,
              }}
            >
              <i className="bi bi-shield-check" style={{ fontSize: '1.15rem', flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Persetujuan Bertingkat:</strong> Permohonan jenis ini memerlukan persetujuan dari{' '}
                <span style={{ fontWeight: 600 }}>{approverLabel}</span> terlebih dahulu sebelum diproses dan
                diterbitkan oleh Operator Layanan TU.
              </div>
            </div>
          )}

          {selectedConfig?.deskripsi && !selectedConfig.perlu_approval && (
            <div style={{ fontSize: '0.78rem', color: 'var(--ps-text-muted)', marginTop: 4 }}>
              <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
              {selectedConfig.deskripsi}
            </div>
          )}
        </div>

        {/* Input jika jenis = Lainnya */}
        {jenisSurat === 'Lainnya' && (
          <div className="ps-form-group">
            <label className="ps-form-label">
              Nama Jenis Surat Lainnya <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              className="ps-form-input"
              placeholder="Misal: Surat Keterangan Penghasilan"
              value={customJenis}
              onChange={(e) => setCustomJenis(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Judul Permintaan */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Judul / Perihal Surat <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Opsional)</span>
          </label>
          <input
            type="text"
            className="ps-form-input"
            placeholder="Contoh: Permohonan Transkrip Nilai Semester Gasal"
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
            placeholder="Jelaskan secara rinci tujuan pembuatan surat ini, instansi yang dituju, atau keperluan lainnya..."
            value={keperluan}
            onChange={(e) => setKeperluan(e.target.value)}
          />
        </div>

        {/* Upload Lampiran */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Berkas Lampiran / Dokumen Pendukung{' '}
            <span style={{ color: '#94a3b8', fontWeight: 400 }}>(PDF, Word, atau Gambar, maks 15 MB)</span>
          </label>

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
                {uploading ? 'Sedang mengunggah...' : 'Klik untuk memilih berkas pendukung'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ps-text-muted)' }}>
                Format: PDF, Word, JPG, PNG (opsional)
              </div>
              {uploading && (
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    background: '#e2e8f0',
                    borderRadius: 4,
                    marginTop: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'var(--ps-accent)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="ps-file-preview">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <i
                  className="bi bi-file-earmark-check-fill"
                  style={{ color: '#16a34a', fontSize: '1.2rem', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
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
          icon="send"
        >
          Kirim Pengajuan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
