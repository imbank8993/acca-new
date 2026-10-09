'use client';

import React from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DetailSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  user: any;
  isGuru: boolean;
  isSiswa: boolean;
  isAdmin: boolean;
  bisaKelolaSesi: boolean;
  bisaApproveSesi: boolean;
  bisaApproveLaporan: boolean;
  bisaLihatLaporan: (slot: any) => boolean;
  bolehIsiAbsensi: (slot: any) => boolean;
  pengajuanDitolak: (slot: any) => boolean;
  getLaporan: (slot: any) => any;
  cekPeserta: (slot: any) => { kurang: number; batal: boolean };
  labelStatus: (status: string) => string;
  toTitleCase: (str: string | null | undefined) => string;
  formatJam: (val?: string | null) => string;
  parseTanggalTampil: (tanggal?: string | null) => Date;
  onEdit: (slot: any) => void;
  onDelete: (slot: any) => void;
  onAbsensi: (slot: any) => void;
  onJoinRequest: (slotId: string) => void;
  onApproveSesi: (slotId: string, status: 'open' | 'cancelled') => void;
  onApproveGuru: (slotId: string, action: 'terima' | 'tolak') => void;
  onOpenReport: (slot: any) => void;
  onViewReport: (slot: any) => void;
  onCetakPdf: (slotId: string) => void;
  onOpenParticipants: (slotId: string) => void;
  isSameId: (id1: any, id2: any) => boolean;
  STATUS_PENGAJUAN: string[];
  STATUS_BERJALAN: string[];
  PESERTA_MINIMAL: number;
}

function pendaftaranSudahTutup(slot?: any): boolean {
  if (!slot || !slot.tanggal || !slot.jam_selesai) return false;
  try {
    const parts = slot.jam_selesai.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;

    let tglStr = slot.tanggal;
    if (typeof tglStr === 'string' && tglStr.includes('T')) {
      tglStr = tglStr.split('T')[0];
    }
    const [year, month, day] = String(tglStr).split('-').map((v) => parseInt(v, 10));
    if (!year || !month || !day) return false;

    const tglSelesai = new Date(year, month - 1, day, h, m, 0, 0);
    const now = new Date();
    const sisaMenit = (tglSelesai.getTime() - now.getTime()) / (1000 * 60);

    return sisaMenit < 30;
  } catch {
    return false;
  }
}

export default function DetailSlotModal({
  isOpen,
  onClose,
  slot,
  user,
  isGuru,
  isSiswa,
  bisaKelolaSesi,
  bisaApproveSesi,
  bisaLihatLaporan,
  bolehIsiAbsensi,
  pengajuanDitolak,
  getLaporan,
  cekPeserta,
  labelStatus,
  toTitleCase,
  formatJam,
  parseTanggalTampil,
  onEdit,
  onDelete,
  onAbsensi,
  onJoinRequest,
  onApproveSesi,
  onApproveGuru,
  onOpenReport,
  onViewReport,
  onCetakPdf,
  onOpenParticipants,
  isSameId,
  STATUS_PENGAJUAN,
  STATUS_BERJALAN,
}: DetailSlotModalProps) {
  if (!slot) return null;

  const isRejected = slot.status === 'cancelled' || pengajuanDitolak(slot);
  const isCreator =
    isSameId(slot.guru_id, user?.id) ||
    (slot.initiator_type === 'SISWA' && isSameId(slot.initiator_siswa_id, user?.id));
  const sesiAdmin = slot.initiator_type === 'ADMIN';

  const canEdit =
    !isRejected &&
    ((STATUS_PENGAJUAN.includes(slot.status) && (bisaKelolaSesi || isCreator)) ||
      (bisaKelolaSesi && sesiAdmin && STATUS_BERJALAN.includes(slot.status)));
  const canDelete =
    !isRejected &&
    (bisaKelolaSesi || (STATUS_PENGAJUAN.includes(slot.status) && isCreator));
  const canAbsensi = bolehIsiAbsensi(slot);
  const canViewLaporan = bisaLihatLaporan(slot);

  const laporan = getLaporan(slot);
  const perluRevisi = laporan?.status === 'Revisi';
  const { kurang, batal } = cekPeserta(slot);

  const pesertaList = slot.klinik_peserta || [];
  const adaAbsen = pesertaList.some((p: any) => p.kehadiran);
  const jmlHadir = pesertaList.filter((p: any) => p.kehadiran === 'H').length;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Sesi Klinik Pembelajaran"
      icon="journal-bookmark-fill"
    >
      <ModalBody>
        <section className="form-section" style={{ paddingTop: 0 }}>
          <div className="flex flex-col gap-1 pb-3 border-b border-[var(--n-border)]">
            <h3 className="m-0 text-base font-extrabold text-[var(--n-ink)]">
              {slot.mapel}
            </h3>
            <p className="m-0 text-xs font-semibold text-[var(--n-ink)]">
              {slot.nama_guru}
            </p>
          </div>

          <table className="klinik-detail-table" style={{ marginTop: 12 }}>
            <tbody>
              <tr>
                <td className="kdt-label">Topik</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value font-semibold">{slot.topik}</td>
              </tr>
              <tr>
                <td className="kdt-label">Tanggal</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  {parseTanggalTampil(slot.tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </td>
              </tr>
              <tr>
                <td className="kdt-label">Waktu</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  {formatJam(slot.jam_mulai)} – {formatJam(slot.jam_selesai)} WIB
                </td>
              </tr>
              {slot.ruangan && (
                <tr>
                  <td className="kdt-label">Ruangan</td>
                  <td className="kdt-colon">:</td>
                  <td className="kdt-value text-sky-600 dark:text-sky-400 font-semibold">
                    <i className="bi bi-geo-alt-fill mr-1" />
                    {slot.ruangan}
                  </td>
                </tr>
              )}
              <tr>
                <td className="kdt-label">Status Sesi</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`status-pill ${isRejected ? 'rejected' : slot.status}`}>
                      {isRejected ? 'Ditolak' : labelStatus(slot.status)}
                    </span>
                    {batal ? (
                      <span className="status-pill batal">Batal · peserta kurang</span>
                    ) : kurang > 0 ? (
                      <span className="status-pill kurang">Butuh {kurang} siswa lagi</span>
                    ) : null}
                  </div>
                </td>
              </tr>
              {laporan?.status && (
                <tr>
                  <td className="kdt-label">Status Laporan</td>
                  <td className="kdt-colon">:</td>
                  <td className="kdt-value">
                    <span className={`laporan-badge ${laporan.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {laporan.status === 'Submitted' ? 'Dilaporkan' : laporan.status.toLowerCase() === 'menunggu laporan' ? 'Menunggu' : laporan.status}
                    </span>
                  </td>
                </tr>
              )}
              <tr>
                <td className="kdt-label">Peserta</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  <div
                    className="inline-flex items-center gap-2 cursor-pointer bg-[var(--n-soft)] border border-[var(--n-border)] px-2.5 py-1 rounded-md text-xs font-bold hover:bg-[var(--n-border)] transition-colors"
                    onClick={() => {
                      onClose();
                      onOpenParticipants(slot.id);
                    }}
                  >
                    <i className="bi bi-people-fill text-sky-600" />
                    <span>
                      {pesertaList.length}/{slot.max_siswa} Siswa
                    </span>
                    {adaAbsen && (
                      <span className="text-sky-600 dark:text-sky-400 font-extrabold">
                        · Hadir {jmlHadir}
                      </span>
                    )}
                    <i className="bi bi-chevron-right text-[0.65rem] text-[var(--n-muted)]" />
                  </div>
                </td>
              </tr>

              {/* Inisiator / Pembuat Sesi */}
              {(slot.initiator_type === 'SISWA' || sesiAdmin) && (
                <tr>
                  <td className="kdt-label">Pembuat</td>
                  <td className="kdt-colon">:</td>
                  <td className="kdt-value">
                    {slot.initiator_type === 'SISWA' && (
                      <span className="text-xs font-medium text-[var(--n-ink)]">
                        <i className="bi bi-person-badge-fill text-sky-600 mr-1" />
                        Diajukan siswa: <strong>{toTitleCase(slot.initiator_nama) || 'Tidak diketahui'}</strong>
                        {slot.initiator_kelas ? ` (${slot.initiator_kelas})` : ''}
                      </span>
                    )}
                    {sesiAdmin && (
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 inline-flex items-center gap-1.5">
                        <i className="bi bi-building-fill-check" /> Dibuat Akademik
                      </span>
                    )}
                  </td>
                </tr>
              )}

              {/* Target Kelas jika ada */}
              {slot.target_kelas && slot.target_kelas.length > 0 && (
                <tr>
                  <td className="kdt-label">Target Kelas</td>
                  <td className="kdt-colon">:</td>
                  <td className="kdt-value">
                    <span className="text-[0.68rem] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800">
                      Khusus Kelas: {slot.target_kelas.join(', ')}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Catatan Penolakan / Reviewer */}
        {isRejected && slot.catatan_penolakan && (
          <section className="form-section">
            <h3 className="form-section__title text-red-600">
              <i className="bi bi-exclamation-triangle-fill" /> Alasan Penolakan
            </h3>
            <p className="detail-teks detail-teks--catatan m-0">
              {slot.catatan_penolakan}
            </p>
          </section>
        )}

        {laporan?.catatan_reviewer && (
          <section className="form-section">
            <h3 className="form-section__title text-amber-600">
              <i className="bi bi-chat-left-quote-fill" /> Catatan Reviewer Laporan
            </h3>
            <p className="detail-teks detail-teks--catatan m-0">
              {laporan.catatan_reviewer}
            </p>
          </section>
        )}
      </ModalBody>

      <ModalFooter align="end">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isRejected && laporan && canViewLaporan && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onViewReport(slot);
                }}
                leftIcon={<i className="bi bi-eye" />}
              >
                Detail Laporan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCetakPdf(slot.id)}
                leftIcon={<i className="bi bi-printer" />}
              >
                Cetak PDF
              </Button>
            </>
          )}

          {canAbsensi && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onAbsensi(slot);
              }}
              leftIcon={<i className="bi bi-clipboard-check" />}
            >
              Absensi
            </Button>
          )}

          {/* Guru penanggung jawab terima/tolak */}
          {isGuru && slot.status === 'pending_guru' && isSameId(slot.guru_id, user?.id) && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onApproveGuru(slot.id, 'terima');
                }}
                leftIcon={<i className="bi bi-check-lg" />}
              >
                Bersedia
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onClose();
                  onApproveGuru(slot.id, 'tolak');
                }}
                leftIcon={<i className="bi bi-x-lg" />}
              >
                Tidak Bersedia
              </Button>
            </div>
          )}

          {/* Siswa Gabung */}
          {isSiswa && slot.initiator_type === 'SISWA' && STATUS_PENGAJUAN.includes(slot.status) && (
            (slot.klinik_peserta?.length || 0) >= slot.max_siswa ? (
              <span className="act-note">Kuota Penuh</span>
            ) : pendaftaranSudahTutup(slot) ? (
              <span className="act-note act-note--batal">
                <i className="bi bi-clock-history mr-1" /> Pendaftaran Ditutup (&lt;30m)
              </span>
            ) : slot.klinik_peserta?.some((p: any) => isSameId(p.siswa_id, user?.id)) ? (
              <span className="act-note act-note--ok">
                <i className="bi bi-check-circle-fill" /> Sudah Gabung
              </span>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onJoinRequest(slot.id);
                }}
              >
                Gabung Klinik
              </Button>
            )
          )}

          {/* Teacher Report Button */}
          {isGuru && isSameId(user?.id, slot.guru_id) && (slot.status === 'open' || slot.status === 'full') && (
            kurang > 0 ? (
              <span className={`act-note ${batal ? 'act-note--batal' : ''}`}>
                {batal ? 'Klinik batal · laporan ditutup' : `Butuh ${kurang} siswa lagi`}
              </span>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenReport(slot);
                }}
                leftIcon={<i className="bi bi-journal-plus" />}
              >
                {perluRevisi ? 'Perbaiki Laporan' : 'Isi Laporan'}
              </Button>
            )
          )}

          {/* Admin Approval */}
          {bisaApproveSesi && slot.status === 'pending' && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onApproveSesi(slot.id, 'open');
                }}
                leftIcon={<i className="bi bi-check-lg" />}
              >
                Setujui
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onClose();
                  onApproveSesi(slot.id, 'cancelled');
                }}
                leftIcon={<i className="bi bi-x-lg" />}
              >
                Tolak
              </Button>
            </div>
          )}

          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onEdit(slot);
              }}
              leftIcon={<i className="bi bi-pencil" />}
            >
              Edit
            </Button>
          )}

          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                onClose();
                onDelete(slot);
              }}
              leftIcon={<i className="bi bi-trash" />}
            >
              Hapus
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
