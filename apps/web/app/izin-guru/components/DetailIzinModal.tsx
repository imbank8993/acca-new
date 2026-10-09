'use client';

import { useState, useEffect } from 'react';
import { JenisBadge, StatusBadge } from './StatusBadge';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { IzinRow } from '../tabs/TabSemuaIzin';

interface DetailIzinModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: IzinRow | null;
  onEdit?: (row: IzinRow) => void;
  onApprove?: (row: IzinRow) => void;
  onDelete?: (id: string) => void;
}

export default function DetailIzinModal({
  isOpen,
  onClose,
  row,
  onEdit,
  onApprove,
  onDelete,
}: DetailIzinModalProps) {
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


  if (!row) return null;

  const formatDate = (d: string) => {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    });
  };

  const formatDateTime = (dt: string) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
  };

  const isDinasLuar = row.jenis === 'dinas_luar';
  const isRange = row.tanggal_mulai !== row.tanggal_selesai;

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="lg"
        variant="default"
        icon="card-text"
        title="Detail Pengajuan Izin"
        subtitle={`Informasi lengkap pengajuan oleh ${row.nama_guru}`}
      >
        <ModalBody>
          <div className="ig-info-box">
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
                {row.status === 'ditolak' && row.catatan_penolakan && (
                  <tr style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                    <td className="ig-dt-label" style={{ color: '#dc2626', padding: '6px 4px' }}>
                      <i className="bi bi-exclamation-circle" style={{ marginRight: 4 }} />
                      Alasan Penolakan
                    </td>
                    <td className="ig-dt-colon" style={{ color: '#dc2626', padding: '6px 8px 6px 0' }}>:</td>
                    <td className="ig-dt-value" style={{ color: '#b91c1c', fontWeight: 500, padding: '6px 0' }}>
                      {row.catatan_penolakan}
                    </td>
                  </tr>
                )}
                {row.approved_at && (
                  <tr>
                    <td className="ig-dt-label">Diverifikasi Oleh</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--ig-text-primary)]">{row.approved_by_nama || '—'}</span>
                        <span className="text-xs text-[var(--ig-text-muted)] font-mono">({formatDateTime(row.approved_at)})</span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="ig-dt-label">Waktu Diajukan</td>
                  <td className="ig-dt-colon">:</td>
                  <td className="ig-dt-value text-[var(--ig-text-muted)] text-xs">
                    {formatDateTime(row.created_at)}
                  </td>
                </tr>
                {row.keterangan && (
                  <tr>
                    <td className="ig-dt-label">Keperluan / Ket.</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value" style={{ lineHeight: 1.5 }}>
                      {row.keterangan}
                    </td>
                  </tr>
                )}
                {row.surat_tugas_url && (
                  <tr>
                    <td className="ig-dt-label">Dokumen Lampiran</td>
                    <td className="ig-dt-colon">:</td>
                    <td className="ig-dt-value">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openFile(row.surat_tugas_url!, `Lampiran - ${row.nama_guru}`)}
                        leftIcon={<i className="bi bi-file-earmark-pdf" />}
                      >
                        Lihat Dokumen
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ModalBody>

        <ModalFooter align="between">
          {row.status === 'pending' && onDelete ? (
            <Button
              variant="danger"
              onClick={() => {
                onClose();
                onDelete(row.id);
              }}
              leftIcon={<i className="bi bi-trash" />}
            >
              Hapus
            </Button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="cancel" onClick={onClose}>
              Tutup
            </Button>
            {row.status === 'pending' && onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEdit(row);
                }}
                leftIcon={<i className="bi bi-pencil" />}
              >
                Edit
              </Button>
            )}
            {row.status === 'pending' && onApprove && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onApprove(row);
                }}
                leftIcon={<i className={isDinasLuar ? "bi bi-check-lg" : "bi bi-check-circle"} />}
              >
                {isDinasLuar ? "Verifikasi" : "Setujui"}
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>
      {viewer}
    </>
  );
}
