"use client";

import { useEffect, useState, useRef } from "react";
import Swal from "sweetalert2";
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';

interface JamOption {
  jam_ke: number;
  mulai: string;
  selesai: string;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  data: any;
  canDo: (res: string, act: string) => boolean;
  isAdmin?: boolean;
  allowedTypes?: {
    IZIN: boolean;
    SAKIT: boolean;
  };
}

export default function EditModal({ isOpen, onClose, onSuccess, data, canDo, isAdmin, allowedTypes }: EditModalProps) {
  const [jenis, setJenis] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [status, setStatus] = useState("");
  const [tglMulai, setTglMulai] = useState("");
  const [tglSelesai, setTglSelesai] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [scope, setScope] = useState<"ONE" | "ALL">("ONE");
  const [submitting, setSubmitting] = useState(false);

  // Clock-based Absence Range
  const [waktuMulai, setWaktuMulai] = useState('');
  const [waktuSelesai, setWaktuSelesai] = useState('');
  const [isKontinu, setIsKontinu] = useState(false);

  // Rekam Medis Fields (Sakit Only)
  const [tindakan, setTindakan] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jamOptions, setJamOptions] = useState<JamOption[]>([]);

  // Fallback jam options if API fails
  const getJamOptions = (): JamOption[] =>
    jamOptions.length > 0 ? jamOptions
      : Array.from({ length: 12 }, (_, i) => ({ jam_ke: i + 1, mulai: '', selesai: '' }));

  const addDaysISO = (dateStr: string, days: number): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  };

  const handleWaktuChange = (newMulai: string, newSelesai: string) => {
    setWaktuMulai(newMulai);
    setWaktuSelesai(newSelesai);

    if (newMulai && newSelesai && tglMulai) {
      const [h1, m1] = newMulai.split(':').map(Number);
      const [h2, m2] = newSelesai.split(':').map(Number);
      const min1 = h1 * 60 + m1;
      const min2 = h2 * 60 + m2;

      if (min2 <= min1) {
        if (!tglSelesai || tglSelesai === tglMulai) {
          setTglSelesai(addDaysISO(tglMulai, 1));
        }
      } else {
        const prevExpectedEnd = addDaysISO(tglMulai, 1);
        if (tglSelesai === prevExpectedEnd) {
          setTglSelesai(tglMulai);
        }
      }
    }
  };

  useEffect(() => {
    const fetchWaktu = async () => {
      try {
        const res = await fetch('/api/master/waktu?program=Reguler&limit=10000');
        const json = await res.json();
        if (json.ok && json.data) {
          const seen = new Set<number>();
          const options: JamOption[] = [];
          for (const item of json.data) {
            if (!seen.has(item.jam_ke) && !item.is_istirahat) {
              seen.add(item.jam_ke);
              options.push({ jam_ke: item.jam_ke, mulai: item.mulai, selesai: item.selesai });
            }
          }
          options.sort((a, b) => a.jam_ke - b.jam_ke);
          setJamOptions(options);
        }
      } catch { /* silent */ }
    };
    fetchWaktu();
  }, []);

  useEffect(() => {
    if (isOpen && data) {
      setJenis(data.jenis ?? "IZIN");
      setStatus(data.status ?? "");
      setTglMulai(data.tgl_mulai ?? "");
      setTglSelesai(data.tgl_selesai ?? "");
      setKeterangan(data.keterangan ?? "");
      setUploadedFileUrl(data.file_url ?? "");
      // Pulihkan mode rentang dari penanda yang tersimpan; baris kontinu juga
      // otomatis diedit sebagai satu seri (scope ALL) supaya seluruh harinya ikut.
      setIsKontinu(!!data.is_kontinu);
      setScope(data.is_kontinu ? "ALL" : "ONE");

      if (data.waktu_mulai_real || data.waktu_selesai_real) {
        if (data.waktu_mulai_real) setWaktuMulai(data.waktu_mulai_real.substring(0, 5));
        if (data.waktu_selesai_real) setWaktuSelesai(data.waktu_selesai_real.substring(0, 5));
      } else {
        const opts = getJamOptions();
        if (opts.length > 0) {
          setWaktuMulai(opts[0].mulai || '07:00');
          setWaktuSelesai(opts[opts.length - 1].selesai || '15:30');
        } else {
          setWaktuMulai('07:00');
          setWaktuSelesai('15:30');
        }
      }

      setTindakan(data.tindakan ?? "");
      setTindakLanjut(data.tindak_lanjut ?? "");
    }
  }, [isOpen, data]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const isIzin = jenis === "IZIN";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const jenisStr = String(data.jenis || "Lainnya").charAt(0).toUpperCase() + String(data.jenis || "Lainnya").slice(1).toLowerCase();
      formData.append("folder", `Ketidakhadiran/${jenisStr}`);
      formData.append("customName", `dokumen_${String(data.jenis).toLowerCase()}_${Date.now()}`);
      if (uploadedFileUrl) formData.append("old_file", uploadedFileUrl);

      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 15;
        if (progress <= 85) setUploadProgress(progress);
      }, 150);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      clearInterval(progressInterval);
      setUploadProgress(100);

      const resData = await res.json();
      if (resData.ok) {
        setUploadedFileUrl(resData.publicUrl || resData.url);
        Swal.fire({ toast: true, position: "top-end", icon: "success", title: "File berhasil diupload", timer: 1500, showConfirmButton: false });
      } else {
        throw new Error(resData.error || "Upload gagal");
      }
    } catch (error: any) {
      Swal.fire("Upload Gagal", error.message || "Gagal menghubungi server", "error");
      setUploadedFileUrl("");
      setUploadedFileName("");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!status || !tglMulai) {
      await Swal.fire({ title: "Validasi", text: "Status dan Tanggal Mulai wajib diisi", icon: "warning", confirmButtonColor: "#3083FF" });
      return;
    }

    const finalTglSelesai = tglSelesai || tglMulai;
    const currentJenis = jenis.toUpperCase() as 'IZIN' | 'SAKIT';
    const jenisLower = currentJenis.toLowerCase();
    const canManageThis = isAdmin || allowedTypes?.[currentJenis] || canDo(`ketidakhadiran.${jenisLower}`, "manage");
    if (!canManageThis) {
      await Swal.fire({ title: "Ditolak", text: `Anda tidak punya izin untuk mengubah data ${currentJenis}`, icon: "error" });
      return;
    }

    setSubmitting(true);

    const payload: any = {
      scope,
      jenis: currentJenis,
      status,
      tgl_mulai: tglMulai,
      tgl_selesai: finalTglSelesai,
      keterangan,
      file_url: uploadedFileUrl || null,
      tindakan: currentJenis === 'SAKIT' ? tindakan : null,
      tindak_lanjut: currentJenis === 'SAKIT' ? tindakLanjut : null,
      waktu_mulai_real: waktuMulai || null,
      waktu_selesai_real: waktuSelesai || null,
      is_kontinu: tglMulai && finalTglSelesai && tglMulai !== finalTglSelesai ? isKontinu : false,
    };

    try {
      const res = await fetch(`/api/ketidakhadiran/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.ok) {
        await Swal.fire({ title: "Berhasil!", text: result.message || "Data berhasil diupdate", icon: "success", confirmButtonColor: "#3083FF", timer: 1400, showConfirmButton: false });
        onSuccess();
        onClose();
      } else {
        await Swal.fire({ title: "Gagal", text: result.error || "Terjadi kesalahan", icon: "error", confirmButtonColor: "#3083FF" });
      }
    } catch (error: any) {
      console.error(error);
      await Swal.fire({ title: "Error", text: error.message || "Terjadi kesalahan sistem", icon: "error", confirmButtonColor: "#3083FF" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title="Edit Data Ketidakhadiran"
        subtitle={`${data.nama} (${data.nisn}) — ${data.kelas}`}
        icon="pencil-square"
        onClose={onClose}
      />

      <ModalBody>
        <div className="kh-form">

            {/* Jenis + Status */}
            <div className="kh-grid-2">
              <div className="kh-field">
                <label className="kh-label">Jenis Absen</label>
                {isAdmin ? (
                  <div className="kh-control">
                    <select
                      value={jenis}
                      onChange={(e) => {
                        const newJenis = e.target.value as 'IZIN' | 'SAKIT';
                        setJenis(newJenis);
                        if (newJenis === 'IZIN') setStatus('MADRASAH');
                        else setStatus('Ringan');
                      }}
                      className="kh-input"
                    >
                      <option value="IZIN">IZIN</option>
                      <option value="SAKIT">SAKIT</option>
                    </select>
                    <i className="bi bi-caret-down-fill kh-icon-right"></i>
                  </div>
                ) : (
                  <div className={`kh-badge ${isIzin ? 'kh-badge--izin' : 'kh-badge--sakit'}`} style={{ marginBottom: 0 }}>
                    <div className="kh-badge__icon">
                      <i className={`bi ${isIzin ? 'bi-envelope-open-fill' : 'bi-heart-pulse-fill'}`} />
                    </div>
                    <div>
                      <div className="kh-badge__label">Jenis Data</div>
                      <div className="kh-badge__value">{data.jenis}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="kh-field">
                <label className="kh-label">Status</label>
                <div className="kh-control">
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="kh-input">
                    {isIzin ? (
                      <>
                        <option value="MADRASAH">Madrasah</option>
                        <option value="PERSONAL">Personal</option>
                      </>
                    ) : (
                      <>
                        <option value="Ringan">Ringan</option>
                        <option value="Sedang">Sedang</option>
                        <option value="Berat">Berat</option>
                        <option value="Kontrol">Kontrol</option>
                      </>
                    )}
                  </select>
                  <i className="bi bi-caret-down-fill kh-icon-right"></i>
                </div>
              </div>
            </div>

            {/* Tanggal & Waktu Range */}
            <div className="kh-grid-2">
              {/* Date Range - Single Input Field */}
              <div className="kh-field">
                <label className="kh-label">Tanggal Ketidakhadiran</label>
                <DatePicker
                  className="kh-input"
                  value={tglMulai}
                  valueEnd={tglSelesai}
                  isRange={true}
                  placeholder="Pilih tanggal / rentang tanggal"
                  onChangeRange={(start, end) => {
                    setTglMulai(start);
                    setTglSelesai(end);
                  }}
                  onChange={(start) => {
                    setTglMulai(start);
                    if (!tglSelesai) setTglSelesai(start);
                  }}
                />
                {tglMulai && (
                  <p className="kh-hint kh-hint-info" style={{ marginTop: '4px' }}>
                    <i className="bi bi-info-circle" style={{ marginRight: '4px' }} />
                    {tglSelesai && tglSelesai !== tglMulai ? (
                      <>Berlaku <b>{Math.round((new Date(tglSelesai).getTime() - new Date(tglMulai).getTime()) / (1000 * 3600 * 24)) + 1} hari</b> ({tglMulai.split('-').reverse().join('/')} s.d. {tglSelesai.split('-').reverse().join('/')}).</>
                    ) : (
                      <>Berlaku <b>1 hari</b> ({tglMulai.split('-').reverse().join('/')}).</>
                    )}
                  </p>
                )}
              </div>

              {/* Waktu Ketidakhadiran */}
              <div className="kh-field">
                <label className="kh-label">Waktu Ketidakhadiran</label>

                <div className="kh-jam-range">
                  <div style={{ flex: 1 }}>
                    <div className="kh-jam-range__label">Mulai Pukul</div>
                    <input type="time" className="kh-input" value={waktuMulai} onChange={(e) => handleWaktuChange(e.target.value, waktuSelesai)} />
                  </div>
                  <span className="kh-jam-range__sep">—</span>
                  <div style={{ flex: 1 }}>
                    <div className="kh-jam-range__label">Selesai Pukul</div>
                    <input type="time" className="kh-input" value={waktuSelesai} onChange={(e) => handleWaktuChange(waktuMulai, e.target.value)} />
                  </div>
                </div>

                {/* Tipe Rentang Multi-Hari (Berulang vs Kontinu) */}
                {tglMulai && tglSelesai && tglMulai !== tglSelesai && (
                  <div className="kh-field" style={{ marginTop: '0.4rem' }}>
                    <label className="kh-label kh-label--tiny">Tipe Rentang Multi-Hari</label>
                    <div className="kh-seg">
                      <button
                        type="button"
                        className={`kh-seg__btn ${!isKontinu ? 'is-active' : ''}`}
                        onClick={() => setIsKontinu(false)}
                      >
                        <i className="bi bi-arrow-repeat" /> Berulang Harian
                      </button>
                      <button
                        type="button"
                        className={`kh-seg__btn ${isKontinu ? 'is-active' : ''}`}
                        onClick={() => setIsKontinu(true)}
                      >
                        <i className="bi bi-clock-history" /> Kontinu Non-Stop
                      </button>
                    </div>
                    <p className="kh-hint" style={{ marginTop: '4px' }}>
                      {isKontinu ? (
                        <>Tersimpan <b>satu baris</b>: {tglMulai.split('-').reverse().join('/')} pukul {waktuMulai || '--:--'} tanpa putus s.d. {tglSelesai.split('-').reverse().join('/')} pukul {waktuSelesai || '--:--'}.</>
                      ) : (
                        <>Tersimpan <b>satu baris per tanggal</b>, masing-masing pukul {waktuMulai || '--:--'}–{waktuSelesai || '--:--'}.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Keterangan (Left) + Scope & Dokumen (Right) */}
            <div className="kh-grid-2" style={{ marginTop: '-4px' }}>
              {/* Keterangan (Memanjang Ke Bawah) */}
              <div className="kh-field" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <label className="kh-label">Keterangan</label>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  rows={5}
                  className="kh-input kh-textarea"
                  placeholder="Masukkan keterangan..."
                  style={{ minHeight: '135px', flex: 1, resize: 'vertical' }}
                />
              </div>

              {/* Scope & File Upload (Di Bagian Kanan) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div className="kh-field">
                  <label className="kh-label">Terapkan Perubahan</label>
                  <div className="kh-seg">
                    <button type="button" onClick={() => setScope("ONE")} className={`kh-seg__btn ${scope === "ONE" ? 'is-active' : ''}`}>
                      <i className="bi bi-person" /> Siswa Ini
                    </button>
                    <button type="button" onClick={() => setScope("ALL")} className={`kh-seg__btn ${scope === "ALL" ? 'is-active' : ''}`}>
                      <i className="bi bi-people" /> Semua (Grup)
                    </button>
                  </div>
                </div>

                <div className="kh-field">
                  <label className="kh-label">Dokumen <span style={{ fontWeight: 400, textTransform: 'none' }}>(Opsional)</span></label>
                  <input
                    type="file"
                    id="edit-file-upload"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,application/pdf"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="edit-file-upload"
                    className={`kh-upload__box ${uploading ? 'is-uploading' : ''} ${uploadedFileUrl ? 'is-success' : ''}`}
                    style={{ padding: '0.65rem 0.8rem' }}
                  >
                    {uploading ? (
                      <div className="kh-upload__progress">
                        <div className="kh-progress-header">
                          <i className="bi bi-cloud-arrow-up"></i>
                          <span className="kh-progress-name">{uploadedFileName}</span>
                        </div>
                        <div className="kh-progress-bar-bg">
                          <div className="kh-progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <div className="kh-progress-percent">{uploadProgress}%</div>
                      </div>
                    ) : uploadedFileUrl ? (
                      <div className="kh-upload__success">
                        <i className="bi bi-check-circle-fill"></i>
                        <div className="kh-upload__success-info">
                          <span className="kh-upload__success-label">Upload berhasil</span>
                          <span className="kh-upload__success-name">{uploadedFileName || "File terlampir"}</span>
                        </div>
                        <button type="button" className="kh-upload__remove-btn" onClick={(e) => {
                          e.preventDefault();
                          setUploadedFileUrl('');
                          setUploadedFileName('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}>
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.2rem', color: 'var(--kh-text-muted)', marginBottom: '0.2rem', display: 'block' }}></i>
                        <span className="kh-upload__text-main" style={{ fontSize: '0.78rem' }}>Klik untuk upload</span>
                        <span className="kh-upload__text-sub" style={{ fontSize: '0.68rem' }}>PDF / Gambar</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} disabled={submitting} leftIcon={<i className="bi bi-x-lg" />}>
          Batal
        </Button>
        <Button type="button" variant="primary" onClick={handleSubmit} isLoading={submitting} leftIcon={<i className="bi bi-check-lg" />}>
          Simpan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
