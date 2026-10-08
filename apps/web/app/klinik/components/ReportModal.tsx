'use client';

import React, { useRef } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  reportForm: {
    materi: string;
    fotos: string[];
  };
  setReportForm: React.Dispatch<React.SetStateAction<any>>;
  fileRef?: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export default function ReportModal({
  isOpen,
  onClose,
  slot,
  reportForm,
  setReportForm,
  fileRef,
  uploading,
  handleFileUpload,
  onSubmit,
  submitting = false,
}: ReportModalProps) {
  const localFileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  const activeFileRef = fileRef || localFileRef;

  if (!slot) return null;

  const laporan = Array.isArray(slot.klinik_laporan)
    ? slot.klinik_laporan[0]
    : slot.klinik_laporan;

  const isRevisi = laporan?.status === 'Revisi';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      variant="add"
      icon="journal-check"
      title="Bukti Pembelajaran Klinik"
      subtitle={`${slot.mapel} • ${slot.nama_guru}`}
    >
      <ModalBody>
        {isRevisi && laporan?.catatan_reviewer && (
          <section className="form-section">
            <h3 className="form-section__title">
              <i className="bi bi-arrow-return-left" /> Laporan Dikembalikan
            </h3>
            <p className="detail-teks detail-teks--catatan">
              {laporan.catatan_reviewer}
            </p>
            <p className="form-hint">
              Perbaiki sesuai catatan di atas, lalu ajukan ulang.
            </p>
          </section>
        )}

        <section className="form-section">
          <h3 className="form-section__title">
            <i className="bi bi-camera-fill" /> Foto Dokumentasi
            {reportForm.fotos.length > 0 && (
              <span className="form-section__count">
                {reportForm.fotos.length} foto
              </span>
            )}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <button
              type="button"
              className={`upload-drop ${uploading ? 'is-loading' : ''}`}
              onClick={() => !uploading && activeFileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="upload-spinner" />
                  <span className="upload-drop__title">Mengunggah...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-folder2-open" />
                  <span className="upload-drop__title">Pilih dari Perangkat</span>
                  <span className="upload-drop__sub">
                    Galeri foto / file memori
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              className={`upload-drop ${uploading ? 'is-loading' : ''}`}
              onClick={() => !uploading && camRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="upload-spinner" />
                  <span className="upload-drop__title">Mengunggah...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-camera-fill" />
                  <span className="upload-drop__title">Ambil dari Kamera</span>
                  <span className="upload-drop__sub">
                    Buka kamera foto langsung
                  </span>
                </>
              )}
            </button>
          </div>

          <input
            type="file"
            ref={activeFileRef as any}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
          />
          <input
            type="file"
            ref={camRef as any}
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
          />

          {reportForm.fotos.length > 0 && (
            <div className="detail-fotos" style={{ marginTop: 12 }}>
              {reportForm.fotos.map((url, i) => (
                <div key={i} className="foto-thumb">
                  <img src={url} alt={`Bukti ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() =>
                      setReportForm((prev: any) => ({
                        ...prev,
                        fotos: prev.fotos.filter(
                          (_: any, idx: number) => idx !== i
                        ),
                      }))
                    }
                    title="Hapus foto"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">
            <i className="bi bi-journal-text" /> Ringkasan Materi
          </h3>
          <div className="form-group">
            <label>Materi &amp; hasil pembelajaran</label>
            <textarea
              placeholder="Tuliskan apa saja yang sudah dibahas dengan siswa..."
              rows={4}
              value={reportForm.materi}
              onChange={(e) =>
                setReportForm({ ...reportForm, materi: e.target.value })
              }
            />
            <p className="form-hint">
              Laporan yang diajukan akan diperiksa Admin/OP Klinik sebelum
              disahkan.
            </p>
          </div>
        </section>
      </ModalBody>

      <ModalFooter align="end">
        <Button variant="cancel" onClick={onClose} disabled={uploading || submitting}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          isLoading={submitting}
          disabled={uploading}
          leftIcon={<i className="bi bi-check-circle-fill" />}
        >
          {isRevisi ? 'Ajukan Ulang' : 'Ajukan Laporan'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
