'use client';

import { useState, useMemo, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const LABEL_KEHADIRAN: Record<string, string> = {
  H: 'Hadir',
  S: 'Sakit',
  I: 'Izin',
  A: 'Alpa',
};

interface ParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  user: any;
  isGuru: boolean;
  isAdmin: boolean;
  isSiswa: boolean;
  onCancelParticipant: (
    slotId: string,
    siswaIds: number[]
  ) => Promise<void>;
  onOpenAbsensi?: (slot: any) => void;
}

export default function ParticipantsModal({
  isOpen,
  onClose,
  slot,
  user,
  isGuru,
  isAdmin,
  isSiswa,
  onCancelParticipant,
  onOpenAbsensi,
}: ParticipantsModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pesertaToDelete, setPesertaToDelete] = useState<any[] | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const pesertaList: any[] = useMemo(() => slot?.klinik_peserta || [], [slot]);
  const pengelolaSesi = isAdmin || (isGuru && String(user?.id) === String(slot?.guru_id));
  const isInitiator = (p: any) => slot?.initiator_type === 'SISWA'
    && String(slot?.initiator_siswa_id) === String(p.siswa_id);
  const canCancel = (p: any) => !isInitiator(p) && !p.kehadiran
    && ['pending_guru', 'pending', 'open', 'full'].includes(slot?.status)
    && (pengelolaSesi || (isSiswa && String(user?.id) === String(p.siswa_id) && p.status !== 'ditugaskan'));
  const eligible = pesertaList.filter(canCancel);
  const selected = eligible.filter(p => selectedIds.includes(Number(p.siswa_id)));
  const allSelected = eligible.length > 0 && selected.length === eligible.length;
  const isSelf = pesertaToDelete?.length === 1 && String(pesertaToDelete[0].siswa_id) === String(user?.id);

  useEffect(() => {
    setSelectedIds([]);
    setPesertaToDelete(null);
    setFeedback(null);
  }, [slot?.id, isOpen]);

  const requestDelete = (participants: any[]) => {
    setFeedback(null);
    setPesertaToDelete(participants);
  };
  const confirmDelete = async () => {
    if (!pesertaToDelete || cancelling) return;
    setCancelling(true);
    setFeedback(null);
    try {
      await onCancelParticipant(slot.id, pesertaToDelete.map(p => Number(p.siswa_id)));
      const removed = new Set(pesertaToDelete.map(p => Number(p.siswa_id)));
      setSelectedIds(ids => ids.filter(id => !removed.has(id)));
      setFeedback({ error: false, text: isSelf ? 'Pendaftaran Anda berhasil dibatalkan.' : `${pesertaToDelete.length} peserta berhasil dihapus.` });
      setPesertaToDelete(null);
    } catch (err) {
      setFeedback({ error: true, text: err instanceof Error ? err.message : 'Gagal menghapus peserta. Silakan coba lagi.' });
    } finally {
      setCancelling(false);
    }
  };

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

  /** Peserta yang ditunjuk pembentuk sesi — sinkron dgn STATUS_DITUGASKAN di API. */
  const adaPenugasan = pesertaList.some((p: any) => p.status === 'ditugaskan');
  const maxSiswa = slot.max_siswa || 1;
  const occupancyPercent = Math.min(
    100,
    (pesertaList.length / maxSiswa) * 100
  );
  const sesiAktifAtauSelesai = ['open', 'full', 'finished', 'paid'].includes(slot.status);

  return (
    <>
      <Modal
        open={isOpen}
        onClose={() => { if (!cancelling && !pesertaToDelete) onClose(); }}
        size="lg"
        variant="default"
        icon="people"
        title="Peserta & Absensi Klinik"
        subtitle={`${slot.mapel} • ${slot.nama_guru}`}
        className="participants-modal"
      >
        <ModalBody>
          <div className="quota-tracker" style={{ padding: '0 0 14px 0' }}>
            <div className="quota-label">
              <span>Okupansi Kelas</span>
              <span>
                {pesertaList.length}{' '}
                <small className="opacity-50 font-normal">/ {maxSiswa}</small>
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
            {sesiAktifAtauSelesai && pesertaList.length > 0 && (
              <div className="abs-ringkas" style={{ paddingTop: 10, paddingBottom: 0 }}>
                <span className={`abs-ringkas__item ${rekapAbsen.H > 0 ? 'abs-ringkas__item--h' : ''}`}>
                  Hadir {rekapAbsen.H}
                </span>
                <span className="abs-ringkas__item">Sakit {rekapAbsen.S}</span>
                <span className="abs-ringkas__item">Izin {rekapAbsen.I}</span>
                <span className={`abs-ringkas__item ${rekapAbsen.A > 0 ? 'abs-ringkas__item--a' : ''}`}>
                  Alpa {rekapAbsen.A}
                </span>
                {rekapAbsen.belum > 0 && (
                  <span className="abs-ringkas__item abs-ringkas__item--kosong">
                    Belum diabsen {rekapAbsen.belum}
                  </span>
                )}
              </div>
            )}
            {adaPenugasan && (
              <p className="form-hint" style={{ marginTop: 8 }}>
                Peserta yang ditugaskan madrasah tidak dapat membatalkan sendiri.
              </p>
            )}
          </div>

          {pengelolaSesi && eligible.length > 0 && (
            <div className="participants-toolbar">
              <label className="participants-select-all">
                <input type="checkbox" checked={allSelected}
                  ref={el => { if (el) el.indeterminate = selected.length > 0 && !allSelected; }}
                  disabled={cancelling || !!pesertaToDelete}
                  onChange={() => setSelectedIds(allSelected ? [] : eligible.map(p => Number(p.siswa_id)))} />
                <span>Pilih semua <small>({eligible.length})</small></span>
              </label>
              <span className="participants-selected-count">{selected.length} dipilih</span>
              <Button variant="danger" disabled={!selected.length || cancelling || !!pesertaToDelete}
                onClick={() => requestDelete(selected)} leftIcon={<i className="bi bi-trash3" />}>
                Hapus terpilih
              </Button>
            </div>
          )}
          {pengelolaSesi && pesertaList.some(p => p.kehadiran || isInitiator(p)) && (
            <p className="form-hint">Pengaju dan peserta dengan absensi tercatat tidak dapat dipilih untuk dihapus.</p>
          )}
          {feedback && (
            <div className={`participants-feedback ${feedback.error ? 'is-error' : 'is-success'}`}
              role={feedback.error ? 'alert' : 'status'}>{feedback.text}</div>
          )}
          {pesertaToDelete && (
            <div className="participants-confirm" role="group" aria-label="Konfirmasi penghapusan peserta">
              <strong>{isSelf ? 'Batalkan pendaftaran Anda?' : `Hapus ${pesertaToDelete.length} peserta dari sesi ini?`}</strong>
              <p>{pesertaToDelete.map(p => p.nama_siswa).join(', ')}</p>
              <small>Peserta akan dikeluarkan dari sesi klinik ini.</small>
              <div className="participants-confirm-actions">
                <Button variant="outline" disabled={cancelling} onClick={() => { setPesertaToDelete(null); setFeedback(null); }}>Batal</Button>
                <Button variant="danger" isLoading={cancelling} onClick={confirmDelete}
                  leftIcon={<i className="bi bi-trash3" />}>{isSelf ? 'Ya, Batalkan' : 'Ya, Hapus'}</Button>
              </div>
            </div>
          )}

          <div className="plist-container" style={{ padding: '8px 0' }}>
            {pesertaList.length > 0 ? (
              pesertaList.map((p: any) => {
                const initiator = isInitiator(p);
                const canDelete = canCancel(p);
                const checked = selectedIds.includes(Number(p.siswa_id));
                return (
                  <div key={p.id} className={`p-card ${checked && canDelete ? 'is-selected' : ''}`}>
                    {pengelolaSesi && ['pending_guru', 'pending', 'open', 'full'].includes(slot.status) && (
                      <input className="participants-checkbox" type="checkbox"
                        aria-label={`Pilih ${p.nama_siswa}`} checked={checked && canDelete}
                        disabled={!canDelete || cancelling || !!pesertaToDelete}
                        onChange={() => setSelectedIds(ids => checked
                          ? ids.filter(id => id !== Number(p.siswa_id)) : [...ids, Number(p.siswa_id)])} />
                    )}
                    <div className="p-info">
                      <p className="p-name">
                        {p.nama_siswa}
                        {initiator && (
                          <span className="p-initiator-badge">
                            Pengaju
                          </span>
                        )}
                      </p>
                      <span className="p-class">{p.kelas || 'SISWA'}</span>
                    </div>
                    {p.kehadiran ? (
                      <span
                        className={`kehadiran-pill k-${p.kehadiran}`}
                        title={
                          p.kehadiran_sumber === 'MANDIRI'
                            ? 'Dinyatakan sendiri oleh siswa'
                            : 'Ditandai guru pengampu'
                        }
                      >
                        {p.kehadiran} · {LABEL_KEHADIRAN[p.kehadiran] || p.kehadiran}
                      </span>
                    ) : sesiAktifAtauSelesai ? (
                      <span className="kehadiran-pill k-belum" title="Belum ada catatan kehadiran">
                        Belum diabsen
                      </span>
                    ) : null}
                    <div className="p-actions">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => requestDelete([p])}
                          disabled={cancelling || !!pesertaToDelete}
                          aria-label={`${String(user?.id) === String(p.siswa_id) ? 'Batalkan pendaftaran' : 'Hapus'} ${p.nama_siswa}`}
                          className="p-del-btn"
                          title={pengelolaSesi ? "Hapus peserta" : "Batalkan pendaftaran"}
                        >
                          <i className="bi bi-trash3-fill" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <i className="bi bi-people" />
                <p>Belum ada siswa yang mendaftar</p>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter align={onOpenAbsensi ? 'between' : 'end'}>
          <Button variant="outline" disabled={cancelling} onClick={onClose}>
            Tutup
          </Button>
          {onOpenAbsensi && (
            <Button
              variant="primary"
              disabled={cancelling || !!pesertaToDelete}
              onClick={() => {
                onClose();
                onOpenAbsensi(slot);
              }}
              leftIcon={<i className="bi bi-clipboard-check" />}
            >
              Isi / Ubah Absensi
            </Button>
          )}
        </ModalFooter>
      </Modal>

    </>
  );
}
