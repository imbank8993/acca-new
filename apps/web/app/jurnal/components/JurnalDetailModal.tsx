'use client';

import React, { useState } from 'react';
import AjukanBandingModal from './AjukanBandingModal';
import { formatDateId } from '@/lib/date-utils';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface Journal {
  id: number;
  tanggal: string;
  hari: string;
  jam_ke: string;
  nama_guru: string;
  kelas: string;
  mata_pelajaran: string;
  kategori_kehadiran: string;
  materi?: string;
  refleksi?: string;
  nip: string;
  guru_pengganti?: string;
  status_pengganti?: string;
  durasi_terlambat?: string | number;
  durasi_keluar_awal?: number;
  keterangan_terlambat?: string;
  keterangan_tambahan?: string;
  guru_piket?: string;
  status_tambahan_1?: string;
  status_tambahan_2?: string;
  status_tambahan_3?: string;
  [key: string]: any;
}

interface JurnalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  journal: Journal | null;
  user?: any;
  onBandingSuccess?: () => void;
}

function getStatusClass(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'sesuai' || s === 'hadir penuh') return 'success';
  if (s.includes('terlambat')) return 'warning';
  if (s.includes('tidak') || s.includes('mangkir')) return 'danger';
  return 'info';
}

export default function JurnalDetailModal({ isOpen, onClose, journal, user, onBandingSuccess }: JurnalDetailModalProps) {
  const [showBanding, setShowBanding] = useState(false);
  const [bandingJournal, setBandingJournal] = useState<Journal | null>(null);

  const userNip = user?.nip || '';
  const isGuruOwner = journal && (journal.nip === userNip || journal.nama_guru === user?.nama);
  const isGuru = user?.roles?.some((r: string) => r.toUpperCase() === 'GURU') || false;

  if (!isOpen || !journal) return null;

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="xl"
        variant="default"
        title="Detail Jurnal Pembelajaran"
        subtitle="Informasi agenda kelas & catatan pembelajaran yang tersimpan."
        icon="journal-text"
      >
        <ModalBody className="jm__body">
          <div className="jm__cols">
            {/* KOLOM KIRI */}
            <div className="jm__group">
              <div className="jm__sectionTitle !mt-0">Identitas & Waktu</div>

              <div className="jm__field">
                <label>Nama Guru</label>
                <div className="jm__value-view">{journal.nama_guru}</div>
              </div>

              <div className="jm__autoFill">
                <i className="bi bi-person-badge"></i>
                <span>NIP: <strong>{journal.nip || '-'}</strong></span>
              </div>

              <div className="jm__grid2">
                <div className="jm__field">
                  <label>Tanggal</label>
                  <div className="jm__value-view">{journal.hari ? `${journal.hari}, ` : ''}{formatDateId(journal.tanggal)}</div>
                </div>
                <div className="jm__field">
                  <label>Kelas</label>
                  <div className="jm__value-view">{journal.kelas}</div>
                </div>
              </div>

              <div className="jm__field">
                <label>Mata Pelajaran</label>
                <div className="jm__value-view">{journal.mata_pelajaran}</div>
              </div>

              <div className="jm__field">
                <label>Jam Ke</label>
                <div className="jm__value-view">{journal.jam_ke}</div>
              </div>

              <div className="jm__sectionTitle mt-2">Status Kehadiran</div>
              <div className="jm__field">
                <label>Status</label>
                <div className="jm__value-view">
                  <span className={`jd__badge ${getStatusClass(journal.kategori_kehadiran)}`}>
                    {journal.kategori_kehadiran}
                  </span>
                </div>
              </div>

              {(journal.durasi_terlambat || journal.keterangan_terlambat) && (
                <div className="jm__field mt-2">
                  <label>{journal.durasi_terlambat ? 'Durasi Terlambat' : 'Alasan Terlambat'}</label>
                  <div className="jm__value-view jm__valueAmber">
                    {journal.durasi_terlambat ? (
                      <span className="flex items-center gap-1.5">
                        <i className="bi bi-clock-history"></i>
                        {journal.durasi_terlambat} Menit
                        {journal.keterangan_terlambat && <span className="text-[10px] opacity-70 ml-1">({journal.keterangan_terlambat})</span>}
                      </span>
                    ) : (
                      journal.keterangan_terlambat
                    )}
                  </div>
                </div>
              )}

              {(journal.durasi_keluar_awal) && (
                <div className="jm__field mt-2">
                  <label>Durasi Keluar Awal</label>
                  <div className="jm__value-view jm__valueOrange">
                    <span className="flex items-center gap-1.5">
                      <i className="bi bi-clock"></i>
                      {journal.durasi_keluar_awal} Menit
                    </span>
                  </div>
                </div>
              )}

              {(journal.status_tambahan_1 || journal.status_tambahan_2 || journal.status_tambahan_3) && (
                <div className="jm__field mt-2">
                  <label>Status Tambahan</label>
                  <div className="jm__value-view jm__valueBlue">
                    <div className="flex flex-wrap gap-1">
                      {journal.status_tambahan_1 && <span className="status-tag">{journal.status_tambahan_1}</span>}
                      {journal.status_tambahan_2 && <span className="status-tag">{journal.status_tambahan_2}</span>}
                      {journal.status_tambahan_3 && <span className="status-tag">{journal.status_tambahan_3}</span>}
                    </div>
                  </div>
                </div>
              )}

              {(journal.guru_pengganti || journal.status_pengganti) && (
                <div className="jm__subSection">
                  <div className="flex flex-col gap-3">
                    <div className="jm__field">
                      <label>Guru Pengganti/Mitra</label>
                      <div className="jm__value-view">{journal.guru_pengganti || '-'}</div>
                    </div>
                    <div className="jm__field">
                      <label>Status Kehadiran Pengganti</label>
                      <div className="jm__value-view">{journal.status_pengganti || '-'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* KOLOM KANAN */}
            <div className="jm__group">
              <div className="jm__sectionTitle !mt-0">Detail Pembelajaran</div>

              <div className="jm__field">
                <label>Materi Pembelajaran</label>
                <div className="jm__value-view jm__textarea-view">
                  {journal.materi || '-'}
                </div>
              </div>

              <div className="jm__field">
                <label>Refleksi / Catatan</label>
                <div className="jm__value-view jm__textarea-view">
                  {journal.refleksi || '-'}
                </div>
              </div>

              <div className="jm__sectionTitle mt-1">Informasi Lain</div>
              <div className="jm__field">
                <label>Guru Piket</label>
                <div className="jm__value-view">{journal.guru_piket || '-'}</div>
              </div>
              <div className="jm__field mt-2">
                <label>Ket. Tambahan</label>
                <div className="jm__value-view">{journal.keterangan_tambahan || '-'}</div>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter align="between">
          <div>
            {isGuru && isGuruOwner && (
              <Button
                variant="ajukan"
                icon="ajukan"
                onClick={() => { setBandingJournal(journal); setShowBanding(true); }}
              >
                Ajukan Banding
              </Button>
            )}
          </div>
          <Button variant="cancel" onClick={onClose}>
            Tutup
          </Button>
        </ModalFooter>
      </Modal>

      <AjukanBandingModal
        isOpen={showBanding}
        onClose={() => setShowBanding(false)}
        onSuccess={() => { setShowBanding(false); setBandingJournal(null); onBandingSuccess?.(); }}
        journal={bandingJournal}
      />

      <style jsx>{`
        :global(.jm__body) {
          padding: 14px 18px !important;
          overflow-y: auto !important;
          max-height: calc(85vh - 120px);
          scrollbar-width: thin;
        }
        :global(.jm__body::-webkit-scrollbar) {
          width: 4px;
        }
        :global(.jm__body::-webkit-scrollbar-thumb) {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }

        .jm__cols {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .jm__cols {
            grid-template-columns: 4.5fr 5.5fr;
            align-items: start;
          }
        }

        .jm__group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .jm__sectionTitle {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: var(--n-muted);
          border-bottom: 1px solid var(--n-border);
          padding-bottom: 4px;
          margin-bottom: 4px;
          margin-top: 6px;
        }

        .jm__field {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .jm__field label {
          display: block;
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--n-muted);
        }

        .jm__value-view {
          width: 100%;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--n-border);
          background: var(--n-soft);
          color: var(--n-ink);
          font-weight: 600;
          font-size: 0.82rem;
          line-height: 1.4;
          min-height: 38px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
        }

        .jm__textarea-view {
          align-items: flex-start;
          min-height: 72px;
          white-space: pre-line;
          font-weight: 500;
        }

        .jm__grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .jm__subSection {
          margin-top: 6px;
          padding: 10px;
          background: var(--n-soft);
          border: 1px dashed var(--n-border);
          border-radius: 10px;
        }

        .jm__autoFill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--n-soft);
          border: 1px solid var(--n-primary);
          border-radius: 8px;
          font-size: 0.74rem;
          color: var(--n-primary);
        }

        .jd__badge {
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
        }
        .jd__badge.success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
        .jd__badge.warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .jd__badge.danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .jd__badge.info { background: var(--n-soft); color: var(--n-primary); }

        .jm__valueAmber {
          color: #f59e0b;
          font-weight: 700;
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.4);
        }

        .jm__valueOrange {
          color: #f97316;
          font-weight: 700;
          background: rgba(249, 115, 22, 0.1);
          border-color: rgba(249, 115, 22, 0.4);
        }

        .jm__valueBlue {
          color: #3083FF;
          font-weight: 700;
          background: rgba(0, 56, 168, 0.1);
          border-color: rgba(0, 56, 168, 0.4);
        }

        .status-tag {
          display: inline-block;
          padding: 2px 8px;
          background: rgba(0, 56, 168, 0.15);
          color: #3083FF;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
        }

        :global(.dark) .status-tag {
          background: rgba(0, 56, 168, 0.2);
          color: #60a5fa;
        }
        :global(.dark) .jm__valueOrange { color: #fb923c; background: rgba(249, 115, 22, 0.1); border-color: rgba(249, 115, 22, 0.3); }
        :global(.dark) .jm__valueBlue { color: #60a5fa; background: rgba(0, 56, 168, 0.1); border-color: rgba(0, 56, 168, 0.3); }
        :global(.dark) .jd__badge.success { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
        :global(.dark) .jd__badge.warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        :global(.dark) .jd__badge.danger { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        :global(.dark) .jd__badge.info { background: rgba(26, 115, 232, 0.2) !important; color: #38bdf8 !important; }
        :global(.dark) .jm__valueAmber { color: #fbbf24; background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); }
      `}</style>
    </>
  );
}