"use client";

import { useEffect, useState, useMemo } from "react";
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

const toDateStr = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.split('T')[0];
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
};

const isSameDateRange = (r: any, d: any): boolean => {
  if (!r || !d) return false;
  const dStart = toDateStr(d.tgl_mulai);
  const dEnd = toDateStr(d.tgl_selesai) || dStart;
  const rStart = toDateStr(r.tgl_mulai);
  const rEnd = toDateStr(r.tgl_selesai) || rStart;
  return rStart === dStart && rEnd === dEnd;
};

export default function PrintModal({
  isOpen, onClose, data, allRows,
  onPrintSingle, onPrintGroup,
  asramaOnly = false,
}: PrintModalProps) {
  const [docType, setDocType] = useState<"SAKIT"|"TUGAS"|"IZIN"|"MENINGGALKAN_ASRAMA"|"REKAM_MEDIK">("IZIN");
  const [printMode, setPrintMode] = useState<"SINGLE"|"GROUP">("SINGLE");
  const [siblings, setSiblings] = useState<any[]>([]);
  const [selectedSiblingIds, setSelectedSiblingIds] = useState<Set<string>>(new Set());
  const [candidateRows, setCandidateRows] = useState<any[]>([]);
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

  // ── Fetch candidate rows with matching date range when modal opens ──
  useEffect(() => {
    if (!isOpen || !data?.tgl_mulai) {
      setCandidateRows([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const from = toDateStr(data.tgl_mulai);
        const to = toDateStr(data.tgl_selesai) || from;
        const res = await fetch(`/api/ketidakhadiran?from=${from}&to=${to}&limit=100`);
        const json = await res.json();
        if (cancel) return;
        if (json.ok && Array.isArray(json.data)) {
          setCandidateRows(json.data);
        }
      } catch (e) {
        // Fallback to allRows on error
      }
    })();
    return () => { cancel = true; };
  }, [isOpen, data?.tgl_mulai, data?.tgl_selesai]);

  // ── Combine allRows and candidateRows deduplicated by ID ──────
  const combinedRows = useMemo(() => {
    const map = new Map<string, any>();
    (allRows || []).forEach(r => { if (r?.id) map.set(String(r.id), r); });
    (candidateRows || []).forEach(r => { if (r?.id) map.set(String(r.id), r); });
    if (data?.id) map.set(String(data.id), data);
    return Array.from(map.values());
  }, [allRows, candidateRows, data]);

  // ── Reset docType & mode when modal opens ────────────────────
  useEffect(() => {
    if (!isOpen || !data) return;
    if (asramaOnly) {
      setDocType("MENINGGALKAN_ASRAMA");
    } else if (data.jenis === "SAKIT") {
      setDocType(bolehRekomendasi ? "SAKIT" : "REKAM_MEDIK");
    } else {
      setDocType("IZIN");
    }
    setPrintMode("SINGLE");
    setPenandatanganError(false);
  }, [isOpen, data?.id, asramaOnly, bolehRekomendasi]);

  // ── Recalculate siblings when docType, combinedRows, or data changes ──
  useEffect(() => {
    if (!isOpen || !data) return;

    if (docType === "MENINGGALKAN_ASRAMA") {
      const related = combinedRows.filter((r) => {
        if (!isSameDateRange(r, data)) return false;
        if (asramaOnly) {
          return r.rekom_kontrol_issued || ASRAMA_STATUS.includes(r.status);
        }
        // General MENINGGALKAN_ASRAMA:
        // Include any student on the same date range regardless of keterangan differences!
        return true;
      });
      setSiblings(related);
      setSelectedSiblingIds(new Set(related.map(r => String(r.id))));
    } else if (docType === "IZIN" || docType === "TUGAS") {
      const related = combinedRows.filter((r) => {
        if (r.jenis !== data.jenis || !isSameDateRange(r, data)) return false;
        if (docType === "TUGAS" && r.status !== 'MADRASAH') return false;
        return r.keterangan === data.keterangan;
      });
      setSiblings(related);
      setSelectedSiblingIds(new Set(related.map(r => String(r.id))));
    } else {
      // REKAM_MEDIK or SAKIT
      setSiblings([data]);
      setSelectedSiblingIds(new Set([String(data.id)]));
    }
  }, [isOpen, data, docType, combinedRows, asramaOnly]);

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
          const guru = guruData.find((g) => g.nip === wkmKeasramaan.nip || (wkmKeasramaan.nama && g.nama_lengkap?.toLowerCase().includes(wkmKeasramaan.nama.toLowerCase())));
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
  useEffect(() => {
    if (docType !== "MENINGGALKAN_ASRAMA" || selectedGuruId || !defaultAsramaSigner) return;
    setSelectedGuruId(defaultAsramaSigner.id);
    setPenandatanganNama(defaultAsramaSigner.nama);
    setPenandatanganJabatan('WKM Keasramaan');
    setPenandatanganError(false);
  }, [docType, defaultAsramaSigner, selectedGuruId]);

  const selectedSiblings = useMemo(() => {
    return siblings.filter(s => selectedSiblingIds.has(String(s.id)));
  }, [siblings, selectedSiblingIds]);

  const toggleSibling = (id: string) => {
    setSelectedSiblingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) {
          next.delete(id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllSiblings = () => {
    if (selectedSiblingIds.size === siblings.length) {
      setSelectedSiblingIds(new Set([String(data.id)]));
    } else {
      setSelectedSiblingIds(new Set(siblings.map(s => String(s.id))));
    }
  };

  if (!isOpen || !data) return null;

  const isGroup = siblings.length > 1;
  const nama = data?.nama ?? "Siswa";

  // ── Current doc config ───────────────────────────────────────
  const docConfig = (() => {
    if (docType === "MENINGGALKAN_ASRAMA") return {
      icon: "bi-calendar-weekend-fill",
      label: "Izin Keasramaan",
      sub: printMode === "GROUP" && isGroup ? `Kolektif · ${selectedSiblings.length} siswa` : "Perorangan",
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
      sub: printMode === "GROUP" && isGroup ? `Kolektif · ${selectedSiblings.length} siswa` : "Perorangan",
      color: PALETTE.TUGAS.primary,
      bg: PALETTE.TUGAS.bg,
      border: PALETTE.TUGAS.border,
    };
    return {
      icon: isSakit ? "bi-heart-pulse-fill" : "bi-envelope-paper-fill",
      label: isSakit ? "Surat Rekomendasi" : "Surat ACCA",
      sub: printMode === "GROUP" && isGroup ? `Kolektif · ${selectedSiblings.length} siswa` : "Perorangan",
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
      const penandatangan = {
        nama: penandatanganNama || (guruList.find(g => String(g.id) === selectedGuruId)?.nama_lengkap || ''),
        jabatan: penandatanganJabatan || 'WKM Keasramaan'
      };
      if (printMode === "GROUP" && isGroup && selectedSiblings.length > 1) {
        onPrintGroup(selectedSiblings, data, "MENINGGALKAN_ASRAMA", penandatangan);
      } else {
        const targetStudent = selectedSiblings.length === 1 ? selectedSiblings[0] : data;
        onPrintSingle(targetStudent, "MENINGGALKAN_ASRAMA", penandatangan);
      }
    } else if (printMode === "GROUP" && isGroup && !isSakit && (docType === "IZIN" || docType === "TUGAS")) {
      onPrintGroup(selectedSiblings, data, docType as "IZIN" | "TUGAS");
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
          {isGroup && (docType === "MENINGGALKAN_ASRAMA" || (!isSakit && (docType === "IZIN" || docType === "TUGAS"))) && (
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
                <>
                  <p className="pm-hint" style={{ marginBottom: '10px' }}>
                    <i className="bi bi-info-circle" />
                    {docType === "MENINGGALKAN_ASRAMA"
                      ? asramaOnly
                        ? `1 surat untuk ${selectedSiblings.length} siswa dengan rentang tanggal yang sama (keterangan tetap dicatat per siswa)`
                        : `1 surat untuk ${selectedSiblings.length} siswa dengan rentang tanggal yang sama`
                      : `1 surat + lampiran daftar ${selectedSiblings.length} siswa`}
                  </p>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--n-ink, #0f172a)' }}>
                        Pilih Siswa ({selectedSiblings.length} dari {siblings.length})
                      </span>
                      <button
                        type="button"
                        onClick={toggleAllSiblings}
                        style={{ fontSize: '0.72rem', color: '#3083FF', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontWeight: 500 }}
                      >
                        {selectedSiblingIds.size === siblings.length ? 'Hanya Siswa Ini' : 'Pilih Semua'}
                      </button>
                    </div>
                    <div style={{
                      maxHeight: '170px',
                      overflowY: 'auto',
                      border: '1px solid var(--n-border, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      background: 'var(--n-surface, #f8fafc)'
                    }}>
                      {siblings.map((s) => {
                        const isChecked = selectedSiblingIds.has(String(s.id));
                        const isCurrent = String(s.id) === String(data.id);
                        return (
                          <label
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: isChecked ? 'var(--n-card, #ffffff)' : 'transparent',
                              border: isChecked ? '1px solid var(--n-border, #cbd5e1)' : '1px solid transparent',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSibling(String(s.id))}
                              style={{ width: '15px', height: '15px', accentColor: '#3083FF', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--n-ink, #0f172a)' }}>{s.nama}</span>
                                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(48,131,255,0.1)', color: '#3083FF', fontWeight: 600 }}>{s.kelas}</span>
                                {isCurrent && (
                                  <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>Pemohon</span>
                                )}
                                {s.letter_issued && (
                                  <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>Sudah terbit</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--n-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.keterangan || 'Tanpa keterangan tambahan'}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
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
          disabled={(docType === "SAKIT" && !bolehRekomendasi) || (printMode === "GROUP" && selectedSiblings.length === 0)}
          leftIcon={<i className="bi bi-download" />}
        >
          Cetak Sekarang
        </Button>
      </ModalFooter>
    </Modal>
  );
}