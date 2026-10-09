'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { StatusBadge, JenisBadge } from './StatusBadge';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { PermintaanSuratRow } from './DetailPermintaanModal';
import { getRoleApproverLabel } from './AddPermintaanModal';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row: PermintaanSuratRow | null;
}

export default function ApprovalModal({ isOpen, onClose, onSuccess, row }: ApprovalModalProps) {
  const [action, setAction] = useState<'approve' | 'tolak'>('approve');
  const [nomorSurat, setNomorSurat] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && row) {
      setAction('approve');
      setNomorSurat(row.nomor_surat || '');
      setCatatan('');
    }
  }, [isOpen, row]);

  if (!row) return null;

  const alur = row.data_json?.alur || {};
  const stepCurrent = alur.step_current || 'OPERATOR';
  const isPihakBerwenangStep = stepCurrent === 'APPROVAL_PIHAK_BERWENANG';

  const approverLabel =
    alur.approver_type === 'USER'
      ? alur.approver_user_nama
        ? `${alur.approver_user_nama} (NIP: ${alur.approver_user_nip || '—'})`
        : `NIP ${alur.approver_user_nip}`
      : getRoleApproverLabel(alur.approver_role);

  const handleSubmit = async () => {
    if (action === 'tolak' && !catatan.trim()) {
      Swal.fire({
        title: 'Validasi',
        text: 'Catatan alasan penolakan wajib diisi agar pemohon mengetahui alasan permohonan ditolak.',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        action,
        catatan: catatan.trim() || undefined,
        catatan_penolakan: catatan.trim() || undefined,
      };

      if (!isPihakBerwenangStep && action === 'approve' && nomorSurat.trim()) {
        payload.nomor_surat = nomorSurat.trim();
      }

      const res = await fetch(`/api/permintaan-surat/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        let msg = '';
        if (isPihakBerwenangStep) {
          msg =
            action === 'approve'
              ? 'Permohonan berhasil disetujui dan diteruskan ke Operator TU untuk penerbitan.'
              : 'Permohonan surat telah ditolak.';
        } else {
          msg =
            action === 'approve'
              ? 'Surat telah resmi disetujui & diterbitkan.'
              : 'Permohonan surat telah ditolak.';
        }

        await Swal.fire({
          title: action === 'approve' ? 'Berhasil Diproses!' : 'Permohonan Ditolak',
          text: msg,
          icon: action === 'approve' ? 'success' : 'info',
          timer: 2000,
          showConfirmButton: false,
        });
        onSuccess();
        onClose();
      } else {
        Swal.fire({
          title: 'Gagal Memproses',
          text: data.error || 'Terjadi kesalahan saat memproses keputusan.',
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
      variant="default"
      icon={action === 'approve' ? 'check2-circle' : 'x-circle'}
      title={
        isPihakBerwenangStep
          ? `Verifikasi: ${approverLabel}`
          : 'Penerbitan Surat (Operator Layanan TU)'
      }
      subtitle={
        isPihakBerwenangStep
          ? `Tinjau dan putuskan persetujuan bertingkat untuk ${row.pemohon_nama}`
          : `Tinjau, beri nomor surat, dan terbitkan surat untuk ${row.pemohon_nama}`
      }
    >
      <ModalBody>
        {/* Ringkasan Singkat */}
        <div className="ps-info-box" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{row.pemohon_nama}</span>
            <JenisBadge jenis={row.jenis_surat} />
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ps-text-secondary)', marginBottom: 4 }}>
            <strong>Perihal:</strong> {row.judul}
          </div>
          {row.keperluan && (
            <div style={{ fontSize: '0.8rem', color: 'var(--ps-text-muted)' }}>
              <strong>Keperluan:</strong> {row.keperluan}
            </div>
          )}

          {isPihakBerwenangStep && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px dashed var(--ps-tb-border)',
                fontSize: '0.76rem',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="bi bi-info-circle-fill" />
              <span>
                Tahap 1 dari 2: Persetujuan Anda akan meneruskan permohonan ini ke Operator TU untuk penomoran & pencetakan surat.
              </span>
            </div>
          )}
        </div>

        {/* Pilihan Tindakan */}
        <div className="ps-form-group">
          <label className="ps-form-label">Tindakan Keputusan</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 10,
                border: `2px solid ${action === 'approve' ? 'var(--ps-accent)' : 'var(--ps-tb-border)'}`,
                background: action === 'approve' ? 'rgba(48, 131, 255, 0.08)' : 'transparent',
                cursor: 'pointer',
                fontWeight: action === 'approve' ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="decision"
                value="approve"
                checked={action === 'approve'}
                onChange={() => setAction('approve')}
              />
              <i className="bi bi-check-circle-fill" style={{ color: '#0284c7' }} />
              {isPihakBerwenangStep ? 'Setujui & Teruskan' : 'Setujui & Terbitkan'}
            </label>

            <label
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 10,
                border: `2px solid ${action === 'tolak' ? '#dc2626' : 'var(--ps-tb-border)'}`,
                background: action === 'tolak' ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
                cursor: 'pointer',
                fontWeight: action === 'tolak' ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="decision"
                value="tolak"
                checked={action === 'tolak'}
                onChange={() => setAction('tolak')}
              />
              <i className="bi bi-x-circle-fill" style={{ color: '#dc2626' }} />
              Tolak Permohonan
            </label>
          </div>
        </div>

        {/* Nomor Surat jika Operator TU dan Setujui */}
        {!isPihakBerwenangStep && action === 'approve' && (
          <div className="ps-form-group">
            <label className="ps-form-label">
              Nomor Surat Resmi <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Opsional)</span>
            </label>
            <input
              type="text"
              className="ps-form-input font-mono"
              placeholder="Contoh: B-123/Ma.21.05/PP.00.6/10/2026"
              value={nomorSurat}
              onChange={(e) => setNomorSurat(e.target.value)}
            />
          </div>
        )}

        {/* Catatan */}
        <div className="ps-form-group">
          <label className="ps-form-label">
            {action === 'tolak' ? (
              <>Catatan Alasan Penolakan <span style={{ color: '#ef4444' }}>*</span></>
            ) : (
              <>Catatan / Rekomendasi <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Opsional)</span></>
            )}
          </label>
          <textarea
            className="ps-form-textarea"
            rows={3}
            placeholder={
              action === 'tolak'
                ? 'Tuliskan alasan penolakan agar pemohon dapat memperbaiki pengajuannya...'
                : isPihakBerwenangStep
                ? 'Tuliskan catatan rekomendasi atau verifikasi jika ada...'
                : 'Tuliskan instruksi atau catatan penerbitan surat jika ada...'
            }
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Batal
        </Button>
        <Button
          variant={action === 'approve' ? 'primary' : 'danger'}
          onClick={handleSubmit}
          isLoading={submitting}
          icon={action === 'approve' ? 'check-lg' : 'x-lg'}
        >
          {action === 'approve'
            ? isPihakBerwenangStep
              ? 'Konfirmasi Persetujuan'
              : 'Konfirmasi Terbitkan'
            : 'Konfirmasi Penolakan'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
