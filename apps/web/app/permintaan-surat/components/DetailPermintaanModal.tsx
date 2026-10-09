'use client';

import { useState, useEffect } from 'react';
import { StatusBadge, JenisBadge } from './StatusBadge';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getRoleApproverLabel } from './AddPermintaanModal';

export interface PermintaanSuratRow {
  id: string;
  nomor_surat?: string | null;
  jenis_surat: string;
  judul: string;
  keperluan?: string | null;
  pemohon_nip?: string | null;
  pemohon_nama?: string | null;
  pemohon_role?: string | null;
  data_json?: any;
  lampiran_json?: any;
  status: string;
  status_catatan?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approved_catatan?: string | null;
  created_at: string;
  updated_at?: string;
  foto_profil?: string | null;
}

interface DetailPermintaanModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: PermintaanSuratRow | null;
  canManage?: boolean;
  onEdit?: (row: PermintaanSuratRow) => void;
  onApprove?: (row: PermintaanSuratRow) => void;
  onDelete?: (id: string) => void;
}

export default function DetailPermintaanModal({
  isOpen,
  onClose,
  row,
  canManage,
  onEdit,
  onApprove,
  onDelete,
}: DetailPermintaanModalProps) {
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
    return new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    });
  };

  const formatDateTime = (dt?: string | null) => {
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

  const statusNorm = (row.status || '').toLowerCase();
  const isPending = statusNorm === 'menunggu' || statusNorm === 'pending';
  const isDiproses = statusNorm === 'diproses';
  const canAct = canManage && (isPending || isDiproses);

  // Workflow metadata
  const alur = row.data_json?.alur || {};
  const perluApproval = Boolean(alur.perlu_approval);
  const tahapWkm = row.data_json?.tahap_pihak_berwenang;
  const tahapOp = row.data_json?.tahap_operator;

  const approverLabel =
    alur.approver_type === 'USER'
      ? alur.approver_user_nama
        ? `${alur.approver_user_nama} (NIP: ${alur.approver_user_nip || '—'})`
        : `NIP ${alur.approver_user_nip}`
      : getRoleApproverLabel(alur.approver_role);

  // Parse attachments
  let lampiranItems: { name: string; url: string }[] = [];
  if (Array.isArray(row.lampiran_json)) {
    lampiranItems = row.lampiran_json
      .map((l: any) => {
        if (typeof l === 'string') return { name: l.split('/').pop() || 'Dokumen', url: l };
        return { name: l.name || l.title || 'Dokumen', url: l.url || l.path || '' };
      })
      .filter((l) => Boolean(l.url));
  } else if (typeof row.lampiran_json === 'string' && row.lampiran_json) {
    lampiranItems = [{ name: 'Dokumen', url: row.lampiran_json }];
  }

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="lg"
        variant="default"
        icon="card-text"
        title="Detail Permintaan Surat"
        subtitle={`Informasi lengkap permohonan surat oleh ${row.pemohon_nama || 'Pemohon'}`}
      >
        <ModalBody>
          {/* Timeline / Alur Persetujuan Bertingkat */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ps-text-secondary)', marginBottom: 8 }}>
              <i className="bi bi-diagram-3-fill" style={{ marginRight: 6, color: 'var(--ps-accent)' }} />
              Alur Proses Permohonan Surat
            </div>

            <div className="ps-timeline">
              {/* Step 1: Pengajuan Pemohon */}
              <div className="ps-timeline-step completed">
                <div className="ps-timeline-dot">
                  <i className="bi bi-check-lg" />
                </div>
                <div className="ps-timeline-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>1. Diajukan oleh Pemohon</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--ps-text-muted)' }}>
                      {formatDateTime(row.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ps-text-secondary)', marginTop: 2 }}>
                    Pemohon: <strong>{row.pemohon_nama}</strong> ({row.pemohon_nip || 'NIP —'})
                  </div>
                </div>
              </div>

              {/* Step 2: Persetujuan Pihak Berwenang (jika dikonfigurasi) */}
              {perluApproval && (
                <div
                  className={`ps-timeline-step ${
                    tahapWkm?.status === 'disetujui'
                      ? 'completed'
                      : tahapWkm?.status === 'ditolak'
                      ? 'rejected'
                      : isPending
                      ? 'active'
                      : ''
                  }`}
                >
                  <div className="ps-timeline-dot">
                    {tahapWkm?.status === 'disetujui' ? (
                      <i className="bi bi-check-lg" />
                    ) : tahapWkm?.status === 'ditolak' ? (
                      <i className="bi bi-x-lg" />
                    ) : (
                      '2'
                    )}
                  </div>
                  <div className="ps-timeline-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                        2. Verifikasi Pihak Berwenang: {approverLabel}
                      </span>
                      {tahapWkm?.at && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--ps-text-muted)' }}>
                          {formatDateTime(tahapWkm.at)}
                        </span>
                      )}
                    </div>
                    {tahapWkm ? (
                      <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: tahapWkm.status === 'disetujui' ? '#0284c7' : '#dc2626',
                          }}
                        >
                          {tahapWkm.status === 'disetujui' ? '✓ Disetujui' : '✗ Ditolak'}
                        </span>{' '}
                        oleh {tahapWkm.by_nama} ({tahapWkm.by_role || 'Verifikator'})
                        {tahapWkm.catatan && (
                          <div style={{ color: 'var(--ps-text-muted)', marginTop: 2 }}>
                            Catatan: {tahapWkm.catatan}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: 2 }}>
                        {statusNorm === 'ditolak'
                          ? 'Dibatalkan / Ditolak'
                          : 'Menunggu peninjauan dan persetujuan dari pihak berwenang'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 (atau Step 2 jika tanpa WKM): Penerbitan Operator TU */}
              <div
                className={`ps-timeline-step ${
                  statusNorm === 'disetujui'
                    ? 'completed'
                    : statusNorm === 'ditolak' && tahapWkm?.status !== 'ditolak'
                    ? 'rejected'
                    : isDiproses || (!perluApproval && isPending)
                    ? 'active'
                    : ''
                }`}
              >
                <div className="ps-timeline-dot">
                  {statusNorm === 'disetujui' ? (
                    <i className="bi bi-check-lg" />
                  ) : statusNorm === 'ditolak' && tahapWkm?.status !== 'ditolak' ? (
                    <i className="bi bi-x-lg" />
                  ) : (
                    perluApproval ? '3' : '2'
                  )}
                </div>
                <div className="ps-timeline-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                      {perluApproval ? '3.' : '2.'} Penerbitan Surat oleh Operator Layanan TU
                    </span>
                    {(row.approved_at || tahapOp?.at) && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--ps-text-muted)' }}>
                        {formatDateTime(row.approved_at || tahapOp?.at)}
                      </span>
                    )}
                  </div>
                  {statusNorm === 'disetujui' ? (
                    <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>✓ Selesai & Diterbitkan</span> oleh{' '}
                      {row.approved_by || tahapOp?.by_nama || 'Operator TU'}
                      {row.nomor_surat && (
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--ps-accent)', marginTop: 2 }}>
                          Nomor Surat: {row.nomor_surat}
                        </div>
                      )}
                      {(row.approved_catatan || tahapOp?.catatan) && (
                        <div style={{ color: 'var(--ps-text-muted)', marginTop: 2 }}>
                          Catatan: {row.approved_catatan || tahapOp?.catatan}
                        </div>
                      )}
                    </div>
                  ) : statusNorm === 'ditolak' && tahapWkm?.status !== 'ditolak' ? (
                    <div style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: 2 }}>
                      ✗ Ditolak oleh Operator TU. Alasan: {row.approved_catatan || row.status_catatan || '—'}
                    </div>
                  ) : isDiproses ? (
                    <div style={{ fontSize: '0.78rem', color: '#7e22ce', marginTop: 2 }}>
                      <i className="bi bi-hourglass-split" /> Telah disetujui pihak berwenang. Menunggu penomoran dan finalisasi oleh Operator TU.
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--ps-text-muted)', marginTop: 2 }}>
                      {perluApproval
                        ? 'Menunggu persetujuan tahap sebelumnya selesai'
                        : 'Menunggu penomoran dan penerbitan oleh Operator Layanan TU'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Permintaan */}
          <div className="ps-info-box">
            <table className="ps-info-table">
              <tbody>
                <tr>
                  <td className="ps-dt-label">Pemohon</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value font-semibold">
                    {row.pemohon_nama || '—'}
                  </td>
                </tr>
                <tr>
                  <td className="ps-dt-label">NIP / ID</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value font-mono">
                    {row.pemohon_nip || '—'}
                  </td>
                </tr>
                <tr>
                  <td className="ps-dt-label">Peran Pemohon</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value">
                    {row.pemohon_role || 'Pegawai / Guru'}
                  </td>
                </tr>
                <tr>
                  <td className="ps-dt-label">Jenis Surat</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value">
                    <JenisBadge jenis={row.jenis_surat} />
                  </td>
                </tr>
                {row.nomor_surat && (
                  <tr>
                    <td className="ps-dt-label">Nomor Surat</td>
                    <td className="ps-dt-colon">:</td>
                    <td className="ps-dt-value font-mono" style={{ color: 'var(--ps-accent)', fontWeight: 600 }}>
                      {row.nomor_surat}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="ps-dt-label">Judul Surat</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value font-medium">
                    {row.judul || '—'}
                  </td>
                </tr>
                <tr>
                  <td className="ps-dt-label">Keperluan / Keterangan</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {row.keperluan || '—'}
                  </td>
                </tr>
                <tr>
                  <td className="ps-dt-label">Status Permohonan</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
                <tr>
                  <td className="ps-dt-label">Waktu Diajukan</td>
                  <td className="ps-dt-colon">:</td>
                  <td className="ps-dt-value">
                    {formatDateTime(row.created_at)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Lampiran Dokumen */}
          {lampiranItems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ps-text-secondary)', marginBottom: 8 }}>
                <i className="bi bi-paperclip" style={{ marginRight: 4 }} />
                Berkas Pendukung / Lampiran
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lampiranItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="ps-file-preview"
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => openFile(item.url, item.name)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="bi bi-file-earmark-pdf-fill" style={{ color: '#ef4444', fontSize: '1.2rem' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ps-accent)' }}>
                        {item.name}
                      </span>
                    </div>
                    <Button variant="secondary" size="sm" icon="eye">
                      Lihat Berkas
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {isPending && onEdit && (
            <Button
              variant="secondary"
              icon="pencil"
              onClick={() => {
                onClose();
                onEdit(row);
              }}
            >
              Edit Pengajuan
            </Button>
          )}

          {canAct && onApprove && (
            <Button
              variant="primary"
              icon="check2-circle"
              onClick={() => {
                onClose();
                onApprove(row);
              }}
            >
              Proses / Keputusan
            </Button>
          )}

          {isPending && onDelete && (
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                onClose();
                onDelete(row.id);
              }}
            >
              Hapus
            </Button>
          )}

          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </ModalFooter>
      </Modal>

      {viewer}
    </>
  );
}
