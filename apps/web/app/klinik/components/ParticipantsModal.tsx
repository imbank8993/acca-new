'use client';

import { useState, useMemo } from 'react';
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
    siswaId: number,
    namaSiswa: string
  ) => Promise<void> | void;
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
  const [pesertaToDelete, setPesertaToDelete] = useState<{
    slotId: string;
    siswaId: number;
    namaSiswa: string;
    isSelf: boolean;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const pesertaList = useMemo(() => slot?.klinik_peserta || [], [slot]);

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
        onClose={onClose}
        size="md"
        variant="default"
        icon="people"
        title="Peserta & Absensi Klinik"
        subtitle={`${slot.mapel} • ${slot.nama_guru}`}
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
                <span className="abs-ringkas__item abs-ringkas__item--h">
                  Hadir {rekapAbsen.H}
                </span>
                <span className="abs-ringkas__item">Sakit {rekapAbsen.S}</span>
                <span className="abs-ringkas__item">Izin {rekapAbsen.I}</span>
                <span className="abs-ringkas__item abs-ringkas__item--a">
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

          <div className="plist-container" style={{ padding: '8px 0' }}>
            {pesertaList.length > 0 ? (
              pesertaList.map((p: any) => {
                const isInitiator = slot.initiator_type === 'SISWA' && slot.initiator_siswa_id === p.siswa_id;
                const pengelolaSesi = (isGuru && String(user?.id) === String(slot.guru_id)) || isAdmin;
                const canCancel =
                  !isInitiator &&
                  ['pending_guru', 'pending', 'open', 'full'].includes(slot.status) && (
                    pengelolaSesi ||
                    (isSiswa && String(user?.id) === String(p.siswa_id) && p.status !== 'ditugaskan')
                  );

                return (
                  <div key={p.id} className="p-card">
                    <div className="p-avatar">{p.nama_siswa?.charAt(0)}</div>
                    <div className="p-info">
                      <p className="p-name">
                        {p.nama_siswa}
                        {isInitiator && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
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
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() =>
                            setPesertaToDelete({
                              slotId: slot.id,
                              siswaId: p.siswa_id,
                              namaSiswa: p.nama_siswa,
                              isSelf: String(user?.id) === String(p.siswa_id),
                            })
                          }
                          className="p-del-btn"
                          title="Batalkan Pendaftaran"
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
          <Button variant="cancel" onClick={onClose}>
            Tutup
          </Button>
          {onOpenAbsensi && (
            <Button
              variant="primary"
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

      {/* Delete / Cancel Participant Confirmation Modal */}
      {pesertaToDelete && (
        <Modal
          open={!!pesertaToDelete}
          onClose={() => !cancelling && setPesertaToDelete(null)}
          size="sm"
          variant="delete"
          icon="trash3"
          title={pesertaToDelete.isSelf ? 'Batalkan Pendaftaran?' : 'Hapus Siswa dari Daftar?'}
        >
          <ModalBody>
            <div style={{ fontSize: '0.85rem', color: 'var(--n-ink)' }}>
              {pesertaToDelete.isSelf ? (
                <span>Apakah Anda yakin ingin membatalkan pendaftaran Anda dari klinik ini?</span>
              ) : (
                <span>
                  Apakah Anda yakin ingin menghapus <strong>{pesertaToDelete.namaSiswa}</strong> dari daftar peserta?
                </span>
              )}
            </div>
          </ModalBody>
          <ModalFooter align="end">
            <Button
              variant="cancel"
              onClick={() => setPesertaToDelete(null)}
              disabled={cancelling}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setCancelling(true);
                try {
                  await onCancelParticipant(
                    pesertaToDelete.slotId,
                    pesertaToDelete.siswaId,
                    pesertaToDelete.namaSiswa
                  );
                  setPesertaToDelete(null);
                } catch (err: any) {
                  console.error('Gagal menghapus peserta:', err);
                } finally {
                  setCancelling(false);
                }
              }}
              isLoading={cancelling}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              {pesertaToDelete.isSelf ? 'Ya, Batalkan' : 'Ya, Hapus'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
