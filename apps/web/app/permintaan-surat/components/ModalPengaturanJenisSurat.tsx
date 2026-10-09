'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Button } from '@/components/ui/Button';
import type { JenisSuratConfig } from './AddPermintaanModal';

interface ModalPengaturanJenisSuratProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: JenisSuratConfig) => Promise<void>;
  initialData?: JenisSuratConfig | null;
}

export const ROLE_OPTIONS = [
  { value: 'WKM_AKADEMIK', label: 'WKM Bidang Akademik / Kurikulum' },
  { value: 'WKM_KESISWAAN', label: 'WKM Bidang Kesiswaan' },
  { value: 'WKM_SARPRAS', label: 'WKM Bidang Sarana & Prasarana' },
  { value: 'WKM_HUMAS', label: 'WKM Bidang Hubungan Masyarakat' },
  { value: 'KAMAD', label: 'Kepala Madrasah' },
  { value: 'BK', label: 'Guru Bimbingan Konseling (BK)' },
  { value: 'WALI_KELAS', label: 'Wali Kelas' },
];

export default function ModalPengaturanJenisSurat({
  isOpen,
  onClose,
  onSave,
  initialData,
}: ModalPengaturanJenisSuratProps) {
  const isEdit = Boolean(initialData);

  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [perluApproval, setPerluApproval] = useState(false);
  const [approverType, setApproverType] = useState<'ROLE' | 'USER'>('ROLE');
  const [approverRole, setApproverRole] = useState('WKM_AKADEMIK');
  const [approverUserNip, setApproverUserNip] = useState('');
  const [approverUserNama, setApproverUserNama] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Guru list untuk approver_type = 'USER'
  const [guruList, setGuruList] = useState<{ id: string; nama_lengkap: string; nip: string }[]>([]);
  const [loadingGuru, setLoadingGuru] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNama(initialData.nama || '');
        setDeskripsi(initialData.deskripsi || '');
        setPerluApproval(Boolean(initialData.perlu_approval));
        setApproverType(initialData.approver_type === 'USER' ? 'USER' : 'ROLE');
        setApproverRole(initialData.approver_role || 'WKM_AKADEMIK');
        setApproverUserNip(initialData.approver_user_nip || '');
        setApproverUserNama(initialData.approver_user_nama || '');
        setIsActive(initialData.is_active !== false);
      } else {
        setNama('');
        setDeskripsi('');
        setPerluApproval(false);
        setApproverType('ROLE');
        setApproverRole('WKM_AKADEMIK');
        setApproverUserNip('');
        setApproverUserNama('');
        setIsActive(true);
      }

      // Preload guru list jika approverType = 'USER'
      fetchGuru();
    }
  }, [isOpen, initialData]);

  const fetchGuru = async () => {
    setLoadingGuru(true);
    try {
      const res = await fetch('/api/surat/guru?limit=300');
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setGuruList(json.data);
      }
    } catch (e) {
      console.error('Error fetching guru list:', e);
    } finally {
      setLoadingGuru(false);
    }
  };

  const handleTeacherChange = (nip: string) => {
    setApproverUserNip(nip);
    const found = guruList.find((g) => g.nip === nip);
    if (found) {
      setApproverUserNama(found.nama_lengkap);
    }
  };

  const handleSubmit = async () => {
    if (!nama.trim()) {
      Swal.fire({
        title: 'Validasi',
        text: 'Nama jenis surat wajib diisi.',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    if (perluApproval) {
      if (approverType === 'USER' && !approverUserNip) {
        Swal.fire({
          title: 'Validasi',
          text: 'Silakan pilih guru / pegawai yang ditugaskan sebagai verifikator surat.',
          icon: 'warning',
          confirmButtonColor: '#3083FF',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const id =
        initialData?.id ||
        nama
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

      const payload: JenisSuratConfig = {
        id,
        nama: nama.trim(),
        deskripsi: deskripsi.trim() || undefined,
        perlu_approval: perluApproval,
        approver_type: perluApproval ? approverType : 'NONE',
        approver_role: perluApproval && approverType === 'ROLE' ? approverRole : null,
        approver_user_nip: perluApproval && approverType === 'USER' ? approverUserNip : null,
        approver_user_nama: perluApproval && approverType === 'USER' ? approverUserNama : null,
        is_active: isActive,
      };

      await onSave(payload);
      onClose();
    } catch (e: any) {
      Swal.fire({
        title: 'Gagal Menyimpan',
        text: e.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
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
      variant={isEdit ? 'default' : 'add'}
      icon={isEdit ? 'pencil-square' : 'plus-circle'}
      title={isEdit ? 'Ubah Pengaturan Jenis Surat' : 'Tambah Jenis Surat Baru'}
      subtitle="Atur nama surat, ketentuan persetujuan bertingkat, dan status keaktifan"
    >
      <ModalBody>
        {/* Nama Jenis Surat */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Nama Jenis Surat <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            className="ps-form-input"
            placeholder="Contoh: Transkrip Nilai, Surat Keterangan Lulus, dll."
            value={nama}
            onChange={(e) => setNama(e.target.value)}
          />
        </div>

        {/* Deskripsi */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            Keterangan / Deskripsi Singkat <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Opsional)</span>
          </label>
          <input
            type="text"
            className="ps-form-input"
            placeholder="Contoh: Permohonan transkrip nilai akademik bagi siswa / alumni"
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
          />
        </div>

        {/* Toggle Perlu Approval */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: perluApproval ? 'rgba(48, 131, 255, 0.07)' : '#f8fafc',
            border: `1px solid ${perluApproval ? 'rgba(48, 131, 255, 0.35)' : 'var(--ps-tb-border)'}`,
            marginBottom: 16,
            transition: 'all 0.2s ease',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ps-text-primary)' }}>
                Wajib Melalui Persetujuan Pihak Berwenang
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ps-text-secondary)', marginTop: 2 }}>
                Jika dicentang, surat harus disetujui WKM / pihak berwenang terlebih dahulu sebelum diterbitkan Operator TU
              </div>
            </div>
            <input
              type="checkbox"
              checked={perluApproval}
              onChange={(e) => setPerluApproval(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--ps-accent)' }}
            />
          </label>

          {/* Konfigurasi Pihak Berwenang */}
          {perluApproval && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed rgba(48, 131, 255, 0.25)' }}>
              {/* Tipe Penyetuju */}
              <div className="ps-form-group" style={{ marginBottom: 12 }}>
                <label className="ps-form-label">Tipe Penentu Persetujuan</label>
                <InlineSelect
                  value={approverType}
                  onChange={(val) => setApproverType(val as 'ROLE' | 'USER')}
                  options={[
                    { value: 'ROLE', label: 'Berdasarkan Jabatan / Peran (Rekomendasi)' },
                    { value: 'USER', label: 'Berdasarkan Guru / Pegawai Tertentu (NIP)' },
                  ]}
                  minWidth="100%"
                  height="38px"
                />
              </div>

              {/* Berdasarkan Role */}
              {approverType === 'ROLE' && (
                <div className="ps-form-group" style={{ marginBottom: 4 }}>
                  <label className="ps-form-label">
                    Pihak / Jabatan yang Menyetujui <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <InlineSelect
                    value={approverRole}
                    onChange={(val) => setApproverRole(val)}
                    options={ROLE_OPTIONS}
                    minWidth="100%"
                    height="38px"
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--ps-text-muted)', marginTop: 6 }}>
                    Permintaan jenis ini akan dapat disetujui oleh seluruh akun yang memiliki hak peran tersebut.
                  </div>
                </div>
              )}

              {/* Berdasarkan Guru / User NIP */}
              {approverType === 'USER' && (
                <div className="ps-form-group" style={{ marginBottom: 4 }}>
                  <label className="ps-form-label">
                    Pilih Guru / Pegawai <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <InlineSelect
                    value={approverUserNip}
                    onChange={handleTeacherChange}
                    options={[
                      { value: '', label: '-- Pilih Guru / Pegawai --' },
                      ...guruList.map((g) => ({
                        value: g.nip,
                        label: `${g.nama_lengkap} (${g.nip})`,
                      })),
                    ]}
                    minWidth="100%"
                    height="38px"
                    disabled={loadingGuru}
                  />
                  {loadingGuru && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--ps-text-muted)', marginTop: 4 }}>
                      Memuat daftar pegawai...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Keaktifan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="status-active-cb"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ width: 17, height: 17, cursor: 'pointer', accentColor: 'var(--ps-accent)' }}
          />
          <label htmlFor="status-active-cb" style={{ fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer' }}>
            Aktifkan jenis surat ini dalam pilihan formulir pengajuan pemohon
          </label>
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
          {isEdit ? 'Simpan Perubahan' : 'Tambahkan'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
