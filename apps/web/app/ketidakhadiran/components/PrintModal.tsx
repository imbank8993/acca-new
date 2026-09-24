"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ASRAMA_STATUS } from "@/lib/antrean-asrama-status";

interface GuruItem {
  id: number;
  nama_lengkap: string;
  nip: string;
  jabatan: string;
}

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  allRows: any[];
  onPrintSingle: (row: any, type: "SAKIT" | "TUGAS" | "IZIN" | "MENINGGALKAN_ASRAMA" | "REKAM_MEDIK", penandatangan?: { nama: string; jabatan: string }) => void;
  onPrintGroup: (groupRows: any[], representative: any, type: "TUGAS" | "IZIN" | "MENINGGALKAN_ASRAMA", penandatangan?: { nama: string; jabatan: string }) => void;
  /** Antrean Keluar Asrama (OP_IZIN, dari baris SAKIT Sedang/Berat/Kontrol) —
   * satu-satunya dokumen yang boleh diterbitkan, jadi pilihan jenis dokumen lain
   * (Rekomendasi/Rekam Medis) disembunyikan. */
  asramaOnly?: boolean;
}

// ── Color tokens ──────────────────────────────────────────────
const PALETTE = {
  IZIN:   { primary: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.18)',  tint: '#dcfce7' },
  SAKIT:  { primary: '#EC5800', bg: 'rgba(236,88,0,0.06)', border: 'rgba(236,88,0,0.18)', tint: '#fff7ed' },
  TUGAS:  { primary: '#3083FF', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.18)', tint: '#eff6ff' },
  MENINGGALKAN_ASRAMA: { primary: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.18)', tint: '#fef3c7' },
  REKAM:  { primary: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.18)', tint: '#dcfce7' },
};

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const YEARS  = [2024, 2025, 2026, 2027];

export default function PrintModal({
  isOpen, onClose, data, allRows,
  onPrintSingle, onPrintGroup,
  asramaOnly = false,
}: PrintModalProps) {
  const [docType, setDocType] = useState<"SAKIT"|"TUGAS"|"IZIN"|"MENINGGALKAN_ASRAMA"|"REKAM_MEDIK">("IZIN");
  const [printMode, setPrintMode] = useState<"SINGLE"|"GROUP">("SINGLE");
  const [siblings, setSiblings] = useState<any[]>([]);
  // Guru list from master_guru
  const [guruList, setGuruList] = useState<GuruItem[]>([]);
  // Penandatangan — selected from guru list for MENINGGALKAN_ASRAMA
  const [selectedGuruId, setSelectedGuruId] = useState<string>("");
  const [penandatanganNama, setPenandatanganNama] = useState('');
  const [penandatanganJabatan, setPenandatanganJabatan] = useState('');
  const [penandatanganError, setPenandatanganError] = useState(false);
  // Default penandatangan Izin Keasramaan — guru pemegang tugas tambahan WKM
  // Keasramaan saat ini, dipakai untuk pre-fill (tetap bisa diganti manual).
  const [defaultAsramaSigner, setDefaultAsramaSigner] = useState<{ id: string; nama: string } | null>(null);

  const isSakit = data?.jenis === "SAKIT";
  // Surat Rekomendasi hanya untuk status yang berarti "dirawat/kontrol di luar
  // asrama"; lihat lib/antrean-asrama.ts dan penjaga di generate-letter route.
  const bolehRekomendasi = isSakit && ASRAMA_STATUS.includes(data?.status);
  const palette = isSakit ? PALETTE.SAKIT : PALETTE.IZIN;
  const monthNames = MONTHS;

  // ── Close on Escape ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  // ── Reset state when modal opens ──────────────────────────────
  useEffect(() => {
    if (!isOpen || !data) {
      return;
    }
    if (asramaOnly) {
      setDocType("MENINGGALKAN_ASRAMA");
    } else if (data.jenis === "SAKIT") {
      setDocType(bolehRekomendasi ? "SAKIT" : "REKAM_MEDIK");
    } else {
      setDocType("IZIN");
    }
    // Antrean asrama: kelompokkan cukup berdasarkan rentang tanggal — keterangan
    // (diagnosis) boleh berbeda per siswa, beda dengan grup IZIN yang keterangannya
    // memang sama untuk semua anggota. Baris yang suratnya sudah terbit, atau yang
    // Rekomendasi dari UKS-nya belum ada, dikeluarkan dari kandidat grup.
    const related = allRows.filter((r) => {
      if (r.jenis !== data.jenis || r.tgl_mulai !== data.tgl_mulai || r.tgl_selesai !== data.tgl_selesai) return false;
      if (asramaOnly) return !r.letter_issued && !!r.rekom_kontrol_issued;
      return r.keterangan === data.keterangan;
    });
    setSiblings(related);
    setPrintMode("SINGLE");
    setPenandatanganNama("");
    setPenandatanganJabatan("");
    setPenandatanganError(false);
  }, [isOpen, data, allRows, asramaOnly]);

  // ── Load guru list from master_guru + default penandatangan Keasramaan ──
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [guruRes, tugasRes] = await Promise.all([
          fetch("/api/master/guru?limit=500"),
          fetch("/api/tugas-tambahan"),
        ]);
        const guruJson = await guruRes.json();
        const guruData: GuruItem[] = (guruJson.ok && guruJson.data) ? guruJson.data : [];
        if (guruData.length) setGuruList(guruData);

        const tugasJson = await tugasRes.json();
        const wkmKeasramaan = (tugasJson.data || []).find((t: any) => /keasramaan/i.test(t.jabatan || ''));
        if (wkmKeasramaan) {
          const guru = guruData.find((g) => g.nip === wkmKeasramaan.nip);
          setDefaultAsramaSigner(guru ? { id: String(guru.id), nama: guru.nama_lengkap } : null);
        } else {
          setDefaultAsramaSigner(null);
        }
      } catch {}
    })();
    setSelectedGuruId("");
    setPenandatanganNama("");
    setPenandatanganJabatan("");
    setPenandatanganError(false);
  }, [isOpen]);

  // ── Auto-fill nama when guru selected ─────────────────────────
  useEffect(() => {
    if (!selectedGuruId) {
      setPenandatanganNama("");
      return;
    }
    const guru = guruList.find((g) => String(g.id) === selectedGuruId);
    if (guru) {
      setPenandatanganNama(guru.nama_lengkap || "");
    }
    setPenandatanganError(false);
  }, [selectedGuruId, guruList]);

  // ── Pre-fill penandatangan Izin Keasramaan dengan WKM Keasramaan ────────
  // Cuma dipakai kalau belum ada pilihan (manual maupun default sebelumnya),
  // supaya pengguna tetap bebas mengganti penandatangan secara manual.
  useEffect(() => {
    if (docType !== "MENINGGALKAN_ASRAMA" || selectedGuruId || !defaultAsramaSigner) return;
    setSelectedGuruId(defaultAsramaSigner.id);
    setPenandatanganJabatan('WKM Keasramaan');
  }, [docType, defaultAsramaSigner, selectedGuruId]);

  if (!isOpen || !data) return null;

  const isGroup = siblings.length > 1;
  const nama = data?.nama ?? "Siswa";

  // ── Current doc config ───────────────────────────────────────
  const docConfig = (() => {
    if (docType === "MENINGGALKAN_ASRAMA") return {
      icon: "bi-calendar-weekend-fill",
      label: "Izin Keasramaan",
      sub: printMode === "GROUP" && isGroup ? `Kolektif · ${siblings.length} siswa` : "Perorangan",
      color: PALETTE.MENINGGALKAN_ASRAMA.primary,
      bg: PALETTE.MENINGGALKAN_ASRAMA.bg,
      border: PALETTE.MENINGGALKAN_ASRAMA.border,
    };
    if (docType === "REKAM_MEDIK") return {
      icon: "bi-heart-pulse-fill",
      label: "Surat Rekam Medis",
      sub: "Perorangan · PDF",
      color: PALETTE.REKAM.primary,
      bg: PALETTE.REKAM.bg,
      border: PALETTE.REKAM.border,
    };
    if (docType === "TUGAS") return {
      icon: "bi-briefcase-fill",
      label: "Surat Tugas",
      sub: printMode === "GROUP" && isGroup ? `Kolektif · ${siblings.length} siswa` : "Perorangan",
      color: PALETTE.TUGAS.primary,
      bg: PALETTE.TUGAS.bg,
      border: PALETTE.TUGAS.border,
    };
    return {
      icon: isSakit ? "bi-heart-pulse-fill" : "bi-envelope-paper-fill",
      label: isSakit ? "Surat Rekomendasi" : "Surat ACCA",
      sub: printMode === "GROUP" && isGroup ? `Kolektif · ${siblings.length} siswa` : "Perorangan",
      color: palette.primary,
      bg: palette.bg,
      border: palette.border,
    };
  })();

  const handlePrint = () => {
    if (docType === "REKAM_MEDIK") {
      onPrintSingle(data, "REKAM_MEDIK", { nama: penandatanganNama, jabatan: penandatanganJabatan });
    } else if (docType === "SAKIT") {
      onPrintSingle(data, "SAKIT", { nama: penandatanganNama, jabatan: penandatanganJabatan });
    } else if (docType === "MENINGGALKAN_ASRAMA") {
      if (!selectedGuruId) {
        setPenandatanganError(true);
        return;
      }
      const penandatangan = { nama: penandatanganNama, jabatan: penandatanganJabatan };
      if (printMode === "GROUP" && isGroup) {
        onPrintGroup(siblings, data, "MENINGGALKAN_ASRAMA", penandatangan);
      } else {
        onPrintSingle(data, "MENINGGALKAN_ASRAMA", penandatangan);
      }
    } else if (printMode === "GROUP" && isGroup && !isSakit && (docType === "IZIN" || docType === "TUGAS")) {
      onPrintGroup(siblings, data, docType as "IZIN" | "TUGAS");
    } else if (docType === "TUGAS") {
      onPrintSingle(data, "TUGAS");
    } else {
      onPrintSingle(data, "IZIN");
    }
    onClose();
  };

  // ── Student info card helper ─────────────────────────────────
  const StudentCard = () => {
    const Icon = isSakit ? "bi-heart-pulse-fill" : "bi-envelope-open-fill";
    return (
      <div className="pm-student-card">
        <div className="pm-student-avatar">
          <i className={`bi ${Icon}`} />
        </div>
        <div className="pm-student-info">
          <div className="pm-student-name">{nama}</div>
          <div className="pm-student-meta">
            <span>{data.nisn}</span>
            <span className="pm-dot">·</span>
            <span>{data.kelas}</span>
            <span className="pm-dot">·</span>
            <span>
              {data.tgl_mulai}
              {data.tgl_selesai !== data.tgl_mulai && ` – ${data.tgl_selesai}`}
            </span>
          </div>
        </div>
        <div className="pm-student-type">
          <span className={`pm-type-badge ${isSakit ? 'pm-type-sakit' : 'pm-type-izin'}`}>
            {isSakit ? "SAKIT" : "IZIN"}
          </span>
        </div>
      </div>
    );
  };

  // ── Doc type card helper ─────────────────────────────────────
  const DocCard = ({
    type, icon, label, subLabel, colorClass, selected
  }: {
    type: any; icon: string; label: string; subLabel: string; colorClass: string; selected: boolean;
  }) => (
    <button
      type="button"
      className={`pm-doc-card ${selected ? 'is-selected' : ''} ${colorClass}`}
      onClick={() => setDocType(type)}
    >
      <i className={`bi ${icon} pm-doc-card-icon`} />
      <div className="pm-doc-card-body">
        <span className="pm-doc-card-label">{label}</span>
        {subLabel && <span className="pm-doc-card-sub">{subLabel}</span>}
      </div>
    </button>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader
        title="Cetak Dokumen"
        subtitle="Pilih jenis cetakan yang diinginkan"
        icon="printer"
        onClose={onClose}
      />

      <ModalBody>
        <div className="pm-body" style={{ padding: 0 }}>

          {/* Student info card */}
          <StudentCard />

          {/* ── IZIN path ── */}
          {!isSakit && (
            <div className="pm-section">
              <div className="pm-section-label">Pilih Jenis Dokumen</div>
              <div className="pm-doc-grid">
                <DocCard
                  type="IZIN" icon="bi-envelope-paper-fill"
                  label="Surat Izin" subLabel=""
                  colorClass="pm-doc-izin"
                  selected={docType === "IZIN"}
                />
                {data.status === 'MADRASAH' && (
                  <DocCard
                    type="TUGAS" icon="bi-briefcase-fill"
                    label="Surat Tugas" subLabel=""
                    colorClass="pm-doc-tugas"
                    selected={docType === "TUGAS"}
                  />
                )}
                <DocCard
                  type="MENINGGALKAN_ASRAMA" icon="bi-door-open-fill"
                  label="Izin Keasramaan" subLabel=""
                  colorClass="pm-doc-asrama"
                  selected={docType === "MENINGGALKAN_ASRAMA"}
                />
              </div>
            </div>
          )}

          {/* ── SAKIT path: Rekam Medis & Rekomendasi ── */}
          {isSakit && !asramaOnly && (
            <div className="pm-section">
              <div className="pm-section-label">Pilih Jenis Dokumen</div>
              <div className="pm-doc-grid">
                <DocCard
                  type="REKAM_MEDIK" icon="bi-heart-pulse-fill"
                  label="Surat Rekam Medis" subLabel="Perorangan · PDF"
                  colorClass="pm-doc-sakit"
                  selected={docType === "REKAM_MEDIK"}
                />
                {bolehRekomendasi ? (
                  <DocCard
                    type="SAKIT" icon="bi-clipboard-check-fill"
                    label="Surat Rekomendasi" subLabel="Perorangan · PDF"
                    colorClass="pm-doc-sakit"
                    selected={docType === "SAKIT"}
                  />
                ) : (
                  <div className="pm-hint pm-hint--blocked" style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
                    <i className="bi bi-info-circle" />
                    <span>
                      Status <b>{data.status}</b> hanya dapat menerbitkan Surat Rekam Medis.
                      Surat Rekomendasi Kontrol hanya untuk siswa yang perlu berobat/kontrol di luar asrama ({ASRAMA_STATUS.join(', ')}).
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Antrean Keluar Asrama: satu-satunya dokumen yang bisa diterbitkan ── */}
          {isSakit && asramaOnly && (
            <div className="pm-section">
              <div className="pm-hint">
                <i className="bi bi-info-circle" />
                Menerbitkan Izin Keasramaan untuk siswa SAKIT (status: {data.status}).
              </div>
            </div>
          )}

          {/* ── Group selector for IZIN/TUGAS/MENINGGALKAN_ASRAMA (termasuk dari antrean SAKIT) ── */}
          {(!isSakit || asramaOnly) && isGroup && (docType === "IZIN" || docType === "TUGAS" || docType === "MENINGGALKAN_ASRAMA") && (
            <div className="pm-section">
              <div className="pm-section-row">
                <span className="pm-section-label">Format Cetak</span>
                <span className="pm-badge-count">{siblings.length} siswa</span>
              </div>
              <div className="pm-seg">
                <button
                  type="button"
                  className={`pm-seg-btn ${printMode === "SINGLE" ? 'is-active' : ''}`}
                  onClick={() => setPrintMode("SINGLE")}
                >
                  <i className="bi bi-person" />
                  Perorangan
                </button>
                <button
                  type="button"
                  className={`pm-seg-btn ${printMode === "GROUP" ? 'is-active' : ''}`}
                  onClick={() => setPrintMode("GROUP")}
                >
                  <i className="bi bi-collection" />
                  Kolektif
                </button>
              </div>
              {printMode === "GROUP" && (
                <p className="pm-hint">
                  <i className="bi bi-info-circle" />
                  {docType === "MENINGGALKAN_ASRAMA"
                    ? asramaOnly
                      ? `1 surat untuk ${siblings.length} siswa dengan rentang tanggal yang sama (keterangan tetap dicatat per siswa)`
                      : `1 surat untuk ${siblings.length} siswa dengan rentang tanggal & keperluan yang sama`
                    : `1 surat + lampiran daftar ${siblings.length} siswa`}
                </p>
              )}
            </div>
          )}


          {/* ── Penandatangan (MENINGGALKAN_ASRAMA — required) ── */}
          {docType === "MENINGGALKAN_ASRAMA" && (
            <div className="pm-section">
              <div className="pm-section-label">Penandatangan <span style={{ color: '#dc2626' }}>*</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--n-muted)', display: 'block', marginBottom: '4px' }}>Nama</label>
                  <select
                    className={`pm-select ${penandatanganError && !selectedGuruId ? 'pm-select-error' : ''}`}
                    value={selectedGuruId}
                    onChange={e => setSelectedGuruId(e.target.value)}
                  >
                    <option value="">— Pilih Guru —</option>
                    {guruList.map(g => (
                      <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--n-muted)', display: 'block', marginBottom: '4px' }}>Jabatan</label>
                  <input
                    type="text"
                    className="pm-input"
                    placeholder="Jabatan"
                    value={penandatanganJabatan}
                    onChange={e => setPenandatanganJabatan(e.target.value)}
                  />
                </div>
              </div>
              {penandatanganError && !selectedGuruId && (
                <div style={{ color: '#dc2626', fontSize: '0.72rem', marginTop: '4px' }}>Penandatangan wajib dipilih.</div>
              )}
            </div>
          )}

          {/* ── Preview ── */}
          <div className="pm-preview" style={{ background: docConfig.bg, borderColor: docConfig.border }}>
            <i className={`bi ${docConfig.icon} pm-preview-icon`} style={{ color: docConfig.color }} />
            <div className="pm-preview-info">
              <span className="pm-preview-label" style={{ color: docConfig.color }}>{docConfig.label}</span>
              <span className="pm-preview-sub">{docConfig.sub}</span>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>
          Batal
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handlePrint}
          disabled={docType === "SAKIT" && !bolehRekomendasi}
          leftIcon={<i className="bi bi-download" />}
        >
          Cetak Sekarang
        </Button>
      </ModalFooter>
    </Modal>
  );
}