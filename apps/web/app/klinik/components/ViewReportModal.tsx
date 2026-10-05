'use client';

import { useState, useMemo, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatJam } from '../view';

const LABEL_KEHADIRAN: Record<string, string> = {
  H: 'Hadir',
  S: 'Sakit',
  I: 'Izin',
  A: 'Alpa',
};

interface ViewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  openFile: (url: string, title: string) => void;
  onPrintPreview: (slotId: string) => void;
  loadingPreviewSlotId: string | null;
  onOpenAbsensi?: (slot: any) => void;
  canRevisiApproved?: boolean;
  onRevisiApproved?: (laporanId: string) => void;
}

export default function ViewReportModal({
  isOpen,
  onClose,
  slot,
  openFile,
  onPrintPreview,
  loadingPreviewSlotId,
  onOpenAbsensi,
  canRevisiApproved,
  onRevisiApproved,
}: ViewReportModalProps) {
  const [showPeserta, setShowPeserta] = useState(false);

  useEffect(() => {
    setShowPeserta(false);
  }, [isOpen, slot?.id]);

  const pesertaList = useMemo(() => {
    const raw = slot?.klinik_peserta || [];
    return [...raw].sort((a: any, b: any) =>
      (a.nama_siswa || '').localeCompare(b.nama_siswa || '', 'id-ID')
    );
  }, [slot]);

  const rekapAbsen = useMemo(() => {
    const r = { H: 0, S: 0, I: 0, A: 0, belum: 0 };
    for (const p of pesertaList) {
      const k = p.kehadiran;
      if (k === 'H' || k === 'S' || k === 'I' || k === 'A') r[k as 'H' | 'S' | 'I' | 'A'] += 1;
      else r.belum += 1;
    }
    return r;
  }, [pesertaList]);

  if (!slot) return null;

  const laporan = Array.isArray(slot.klinik_laporan)
    ? slot.klinik_laporan[0]
    : slot.klinik_laporan;

  const fotos: string[] = laporan?.foto_bukti || [];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      variant="default"
      icon="file-earmark-text"
      title="Detail Laporan Klinik"
      subtitle={`${slot.mapel} • ${slot.nama_guru}`}
    >
      <ModalBody>
        <section className="form-section" style={{ paddingTop: 0 }}>
          <h3 className="form-section__title">
            <i className="bi bi-info-circle-fill" /> Ringkasan Sesi
            {laporan?.status && (
              <span
                className={`laporan-badge ${String(
                  laporan.status
                ).toLowerCase()}`}
              >
                {laporan.status}
              </span>
            )}
          </h3>

          <table className="klinik-detail-table" style={{ marginTop: 8 }}>
            <tbody>
              <tr>
                <td className="kdt-label">Topik Pembahasan</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value" style={{ fontWeight: 600 }}>{slot.topik || '-'}</td>
              </tr>
              <tr>
                <td className="kdt-label">Tanggal Pelaksanaan</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  {new Date(slot.tanggal?.includes('T') ? slot.tanggal : `${slot.tanggal}T12:00:00`).toLocaleDateString('id-ID', {
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
                  {formatJam(slot.jam_mulai)} – {formatJam(slot.jam_selesai)}
                </td>
              </tr>
              <tr>
                <td className="kdt-label">Ruangan</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">{slot.ruangan || '-'}</td>
              </tr>
              <tr>
                <td className="kdt-label">Peserta &amp; Absensi</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, marginRight: 4 }}>
                      {pesertaList.length} siswa <span style={{ color: 'var(--n-muted)', fontWeight: 400 }}>(kuota {slot.max_siswa})</span>
                    </span>
                    <span className="abs-ringkas__item abs-ringkas__item--h">
                      Hadir {rekapAbsen.H}
                    </span>
                    {rekapAbsen.S > 0 && (
                      <span className="abs-ringkas__item">Sakit {rekapAbsen.S}</span>
                    )}
                    {rekapAbsen.I > 0 && (
                      <span className="abs-ringkas__item">Izin {rekapAbsen.I}</span>
                    )}
                    {rekapAbsen.A > 0 && (
                      <span className="abs-ringkas__item abs-ringkas__item--a">Alpa {rekapAbsen.A}</span>
                    )}
                    {rekapAbsen.belum > 0 && (
                      <span className="abs-ringkas__item abs-ringkas__item--kosong">
                        Belum diabsen {rekapAbsen.belum}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              {slot.initiator_type === 'SISWA' && (
                <tr>
                  <td className="kdt-label">Diajukan Oleh Siswa</td>
                  <td className="kdt-colon">:</td>
                  <td className="kdt-value">
                    {slot.initiator_nama || 'Tidak diketahui'}{' '}
                    {slot.initiator_kelas ? `(${slot.initiator_kelas})` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {pesertaList.length > 0 && (
            <div className="vrm-peserta-wrap">
              <div className="vrm-peserta-bar">
                <button
                  type="button"
                  className="vrm-peserta-toggle"
                  onClick={() => setShowPeserta((v) => !v)}
                >
                  <i className={`bi ${showPeserta ? 'bi-chevron-up' : 'bi-people-fill'}`} />
                  <span>
                    {showPeserta
                      ? 'Sembunyikan Daftar Peserta & Absensi'
                      : `Lihat Daftar Peserta & Absensi (${pesertaList.length} siswa)`}
                  </span>
                  <i className={`bi ${showPeserta ? 'bi-chevron-up' : 'bi-chevron-down'}`} style={{ marginLeft: 'auto' }} />
                </button>
                {onOpenAbsensi && (
                  <button
                    type="button"
                    className="vrm-absen-btn"
                    onClick={() => {
                      onClose();
                      onOpenAbsensi(slot);
                    }}
                    title="Isi atau ubah absensi peserta"
                  >
                    <i className="bi bi-clipboard-check" /> Kelola Absensi
                  </button>
                )}
              </div>

              {showPeserta && (
                <div className="vrm-peserta-list">
                  {pesertaList.map((p: any, idx: number) => {
                    const kode = p.kehadiran as string | null | undefined;
                    return (
                      <div key={p.id || idx} className="vrm-peserta-row">
                        <span className="vrm-peserta-no">{idx + 1}.</span>
                        <span className="vrm-peserta-nama">{p.nama_siswa}</span>
                        {p.kelas && <span className="p-class" style={{ marginTop: 0 }}>{p.kelas}</span>}
                        <span
                          className={`kehadiran-pill ${kode ? `k-${kode}` : 'k-belum'}`}
                          style={{ marginLeft: 'auto' }}
                          title={
                            kode
                              ? p.kehadiran_sumber === 'MANDIRI'
                                ? 'Absen mandiri oleh siswa'
                                : 'Ditandai oleh guru pengampu'
                              : 'Belum diabsen'
                          }
                        >
                          {kode ? `${kode} · ${LABEL_KEHADIRAN[kode] || kode}` : 'Belum diabsen'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">
            <i className="bi bi-journal-text" /> Materi yang Disampaikan
          </h3>
          <p className="detail-teks">
            {laporan?.materi_disampaikan || 'Guru belum mengisi ringkasan materi.'}
          </p>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">
            <i className="bi bi-images" /> Foto Dokumentasi
            {fotos.length > 0 && (
              <span className="form-section__count">{fotos.length} foto</span>
            )}
          </h3>
          {fotos.length > 0 ? (
            <div className="detail-fotos">
              {fotos.map((url, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() =>
                    openFile(url, `Dokumentasi ${slot.mapel}`)
                  }
                  title="Perbesar"
                >
                  <img src={url} alt={`Dokumentasi ${i + 1}`} />
                </button>
              ))}
            </div>
          ) : (
            <p className="detail-teks">Belum ada foto dokumentasi.</p>
          )}
        </section>

        {laporan?.catatan_reviewer && (
          <section className="form-section">
            <h3 className="form-section__title">
              <i className="bi bi-chat-left-quote-fill" /> Catatan Reviewer
            </h3>
            <p className="detail-teks detail-teks--catatan">
              {laporan.catatan_reviewer}
            </p>
          </section>
        )}
      </ModalBody>

      <ModalFooter align="between">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="cancel" onClick={onClose}>
            Tutup
          </Button>
          {canRevisiApproved && laporan?.status === 'Approved' && onRevisiApproved && (
            <Button
              variant="danger"
              onClick={() => onRevisiApproved(laporan.id)}
              leftIcon={<i className="bi bi-arrow-return-left" />}
            >
              Batalkan Persetujuan (Revisi)
            </Button>
          )}
        </div>
        <Button
          variant="primary"
          onClick={() => onPrintPreview(slot.id)}
          isLoading={loadingPreviewSlotId === slot.id}
          leftIcon={<i className="bi bi-printer-fill" />}
        >
          Pratinjau Cetak
        </Button>
      </ModalFooter>
    </Modal>
  );
}
