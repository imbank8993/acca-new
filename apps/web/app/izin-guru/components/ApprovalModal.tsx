'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { JenisBadge, StatusBadge } from './StatusBadge';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { IzinRow } from '../tabs/TabSemuaIzin';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  row: IzinRow | null;
}

export default function ApprovalModal({ isOpen, onClose, onSuccess, row }: ApprovalModalProps) {
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<'approve' | 'tolak'>('approve');
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const { openFile, viewer } = useFileViewer();

  useEffect(() => {
    const fetchTz = async () => {
      try {
        const res = await fetch('/api/site-settings?key=timezone');
        const json = await res.json();
        const tzVal = json.data?.value || json.value;
        if (tzVal) {
          const valid = TIMEZONE_OPTIONS.map((t) => t.value);
          if (valid.includes(tzVal as any)) {
            setTimezone(tzVal);
          }
        }
      } catch (e) {
        console.error('Error fetching timezone:', e);
      }
    };
    fetchTz();
  }, []);


  const formatDate = (d: string) => {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      timeZone: timezone,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setCatatan('');
      setAction('approve');
    }
  }, [isOpen]);

  if (!row) return null;

  const isDinasLuar = row.jenis === 'dinas_luar';
  const isRange = row.tanggal_mulai !== row.tanggal_selesai;

  const doAction = async () => {
    if (action === 'tolak' && !catatan.trim()) {
      Swal.fire({ title: 'Validasi', text: 'Catatan penolakan wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/izin-guru/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, catatan_penolakan: catatan.trim() || null }),
      });
      const data = await res.json();

      if (data.ok) {
        const msg = action === 'approve' ? 'Disetujui!' : 'Ditolak';
        await Swal.fire({
          title: msg,
          text: action === 'approve'
            ? `Pengajuan ${row.jenis === 'dinas_luar' ? 'Dinas Luar' : row.jenis} berhasil disetujui`
            : 'Pengajuan telah ditolak',
          icon: action === 'approve' ? 'success' : 'info',
          timer: 1800, showConfirmButton: false,
        });
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
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="lg"
        variant={action === 'approve' ? 'default' : 'delete'}
        icon={action === 'approve' ? 'check-circle' : 'x-circle'}
        title={`${action === 'approve' ? 'Setujui' : 'Tolak'} Pengajuan`}
        subtitle={
          action === 'approve'
            ? (isDinasLuar ? 'Verifikasi dan setujui Dinas Luar' : 'Setujui pengajuan izin/sakit')
            : 'Berikan alasan penolakan'
        }
      >
        <ModalBody>
          {/* Info box */}
          <div className="ig-info-box" style={{ marginBottom: 16 }}>
            <table className="ig-info-table">
              <tbody>
                <tr>
                  <td className="ig-dt-label">Nama Guru</td>
                  <td className="ig-dt-colon">:</td>
                  <td className="ig-dt-value font-semibold">{row.nama_guru}</td>
                </tr>
                <tr>
                  <td className="ig-dt-label">NIP</td>
                  <td className="ig-dt-colon">:</td>
                  <td className="ig-dt-value font-mono">{row.nip || '—'}</td>
                </tr>
                <tr>
                  <td className="ig-dt-label">Jenis Pengajuan</td>
                  <td className="ig-dt-colon">:</td>
                  <td className="ig-dt-value"><JenisBadge jenis={row.jenis} /></td>
                </tr>
                <tr>
                  <td className="ig-dt-label">Waktu Pelaksanaan</td>
                  <td className="ig-dt-colon">:</td>
                  <td className="ig-dt-value">
                    {isRange
                      ? `${formatDate(row.tanggal_mulai)} – ${formatDate(row.tanggal_selesai)}`
                      : formatDate(row.tanggal_mulai)}
                  </td>
                </tr>
                {row.instansi_tujuan && (
                  <tr>
                    <td className="ig-dt-label">Instansi Tujuan</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value">{row.instansi_tujuan}</td>
                  </tr>
                )}
                {row.nomor_surat && (
                  <tr>
                    <td className="ig-dt-label">No. Surat Tugas</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value font-mono">{row.nomor_surat}</td>
                  </tr>
                )}
                <tr>
                  <td className="ig-dt-label">Status</td>
                  <td className="ig-dt-colon">:</td>
                  <td className="ig-dt-value"><StatusBadge status={row.status} /></td>
                </tr>
                {row.keterangan && (
                  <tr>
                    <td className="ig-dt-label">Keperluan / Ket.</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value" style={{ lineHeight: 1.5 }}>{row.keterangan}</td>
                  </tr>
                )}
                {row.surat_tugas_url && (
                  <tr>
                    <td className="ig-dt-label">Surat Tugas</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openFile(row.surat_tugas_url!, `Surat Tugas — ${row.nama_guru}`)}
                        leftIcon={<i className="bi bi-file-earmark-pdf" />}
                      >
                        Lihat Surat
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Catatan penolakan */}
          {action === 'tolak' && (
            <div className="ig-field">
              <label className="ig-label">Alasan Penolakan <span>(Wajib)</span></label>
              <textarea
                className="ig-input ig-textarea"
                rows={2}
                placeholder="Jelaskan alasan penolakan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>
          )}
        </ModalBody>

        <ModalFooter align="between">
          {action === 'approve' ? (
            <>
              <Button
                variant="danger"
                onClick={() => setAction('tolak')}
                disabled={submitting}
                leftIcon={<i className="bi bi-x-circle" />}
              >
                Tolak Pengajuan
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="cancel" onClick={onClose} disabled={submitting}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={doAction}
                  isLoading={submitting}
                  leftIcon={<i className="bi bi-check-lg" />}
                >
                  Setujui Pengajuan
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => { setAction('approve'); setCatatan(''); }}
                disabled={submitting}
                leftIcon={<i className="bi bi-arrow-left" />}
              >
                Kembali
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="cancel" onClick={onClose} disabled={submitting}>
                  Batal
                </Button>
                <Button
                  variant="danger"
                  onClick={doAction}
                  isLoading={submitting}
                  leftIcon={<i className="bi bi-send" />}
                >
                  Konfirmasi Penolakan
                </Button>
              </div>
            </>
          )}
        </ModalFooter>
      </Modal>
      {viewer}
    </>
  );
}
