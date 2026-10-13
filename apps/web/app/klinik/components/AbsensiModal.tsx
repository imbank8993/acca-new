'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/** Kode kehadiran yang sah — sinkron dengan KEHADIRAN_VALID di app/api/klinik/route.ts. */
const PILIHAN = [
  { kode: 'H', label: 'Hadir' },
  { kode: 'S', label: 'Sakit' },
  { kode: 'I', label: 'Izin' },
  { kode: 'A', label: 'Alpa' },
] as const;

interface AbsensiModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  onSubmit: (entries: { siswa_id: number; kehadiran: string | null }[]) => Promise<void> | void;
  saving?: boolean;
}

/** Jam lokal singkat dari timestamptz, mis. "07:22". */
function jamSingkat(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function AbsensiModal({
  isOpen,
  onClose,
  slot,
  onSubmit,
  saving = false,
}: AbsensiModalProps) {
  // '' = belum diabsen, yang berbeda maknanya dari 'A' (alpa).
  const [nilai, setNilai] = useState<Record<number, string>>({});

  const pesertaList = useMemo(
    () => (slot?.klinik_peserta || []) as any[],
    [slot]
  );

  // Muat ulang setiap kali modal dibuka untuk sesi lain, supaya tidak membawa
  // sisa isian sesi sebelumnya.
  useEffect(() => {
    if (!isOpen || !slot) return;
    const awal: Record<number, string> = {};
    for (const p of slot.klinik_peserta || []) awal[p.siswa_id] = p.kehadiran || '';
    setNilai(awal);
  }, [isOpen, slot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ringkas = useMemo(() => {
    const n = { H: 0, S: 0, I: 0, A: 0, kosong: 0 };
    for (const p of pesertaList) {
      const v = nilai[p.siswa_id];
      if (v === 'H' || v === 'S' || v === 'I' || v === 'A') n[v] += 1;
      else n.kosong += 1;
    }
    return n;
  }, [nilai, pesertaList]);

  if (!slot) return null;

  /** Klik pada kode yang sudah aktif = mengosongkan (kembali "belum diabsen"). */
  const pilih = (siswaId: number, kode: string) =>
    setNilai((prev) => ({ ...prev, [siswaId]: prev[siswaId] === kode ? '' : kode }));

  const tandaiSemuaHadir = () =>
    setNilai(Object.fromEntries(pesertaList.map((p) => [p.siswa_id, 'H'])));

  const simpan = () =>
    onSubmit(
      pesertaList.map((p) => ({
        siswa_id: p.siswa_id,
        kehadiran: nilai[p.siswa_id] || null,
      }))
    );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      variant="default"
      icon="clipboard-check"
      title="Absensi Peserta"
      subtitle={`${slot.mapel} • ${slot.nama_guru}`}
    >
      <ModalBody>
        <div className="abs-ringkas">
          <span className="abs-ringkas__item abs-ringkas__item--h">Hadir {ringkas.H}</span>
          <span className="abs-ringkas__item">Sakit {ringkas.S}</span>
          <span className="abs-ringkas__item">Izin {ringkas.I}</span>
          <span className="abs-ringkas__item abs-ringkas__item--a">Alpa {ringkas.A}</span>
          {ringkas.kosong > 0 && (
            <span className="abs-ringkas__item abs-ringkas__item--kosong">
              Belum diabsen {ringkas.kosong}
            </span>
          )}
          <button
            type="button"
            className="abs-semua"
            onClick={tandaiSemuaHadir}
            disabled={pesertaList.length === 0 || saving}
          >
            <i className="bi bi-check2-all" /> Semua hadir
          </button>
        </div>

        <div className="abs-list">
          {pesertaList.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-people" />
              <p>Belum ada peserta pada sesi ini</p>
            </div>
          ) : (
            pesertaList.map((p: any) => (
              <div key={p.id} className="abs-row">
                <div className="abs-row__info">
                  <p className="p-name">{p.nama_siswa}</p>
                  <span className="p-class">
                    {p.kelas || 'SISWA'}
                    {p.kehadiran && p.kehadiran_sumber === 'MANDIRI' && (
                      <span className="abs-jejak">
                        · absen mandiri {jamSingkat(p.kehadiran_at)}
                      </span>
                    )}
                    {p.kehadiran && p.kehadiran_sumber === 'GURU' && (
                      <span className="abs-jejak">· ditandai guru</span>
                    )}
                  </span>
                </div>
                <div className="abs-seg">
                  {PILIHAN.map((o) => (
                    <button
                      type="button"
                      key={o.kode}
                      className={`abs-seg__btn ${nilai[p.siswa_id] === o.kode ? `on-${o.kode}` : ''}`}
                      onClick={() => pilih(p.siswa_id, o.kode)}
                      title={o.label}
                      disabled={saving}
                    >
                      {o.kode}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="form-hint">
          Tekan kode yang sudah aktif untuk mengosongkannya kembali menjadi
          &ldquo;belum diabsen&rdquo;.
        </p>
      </ModalBody>

      <ModalFooter align="end">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Tutup
        </Button>
        <Button
          variant="primary"
          onClick={simpan}
          isLoading={saving}
          disabled={pesertaList.length === 0}
          icon="save"
        >
          Simpan Absensi
        </Button>
      </ModalFooter>
    </Modal>
  );
}
