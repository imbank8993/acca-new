'use client';

import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ViewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  openFile: (url: string, title: string) => void;
  onPrintPreview: (slotId: string) => void;
  loadingPreviewSlotId: string | null;
}

export default function ViewReportModal({
  isOpen,
  onClose,
  slot,
  openFile,
  onPrintPreview,
  loadingPreviewSlotId,
}: ViewReportModalProps) {
  if (!slot) return null;

  const laporan = Array.isArray(slot.klinik_laporan)
    ? slot.klinik_laporan[0]
    : slot.klinik_laporan;

  const fotos: string[] = laporan?.foto_bukti || [];
  const pesertaList = slot.klinik_peserta || [];

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
                  {slot.jam_mulai?.slice(0, 5)} – {slot.jam_selesai?.slice(0, 5)}
                </td>
              </tr>
              <tr>
                <td className="kdt-label">Peserta Terdaftar</td>
                <td className="kdt-colon">:</td>
                <td className="kdt-value">
                  {pesertaList.length} siswa / kuota {slot.max_siswa}
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
            <div className="anggota-chips" style={{ marginTop: 12 }}>
              {pesertaList.map((p: any) => (
                <span key={p.id} className="anggota-chip anggota-chip--plain">
                  {p.nama_siswa}
                  {p.kelas ? ` · ${p.kelas}` : ''}
                </span>
              ))}
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
        <Button variant="cancel" onClick={onClose}>
          Tutup
        </Button>
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
