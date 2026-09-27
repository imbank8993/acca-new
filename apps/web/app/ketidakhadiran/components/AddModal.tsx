'use client';

import { useState, useEffect, useRef } from 'react';
import StudentSelect from './StudentSelect';
import Swal from 'sweetalert2';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { InlineSelect, InlineSelectOption } from '@/components/ui/InlineSelect';

interface JamOption {
  jam_ke: number;
  mulai: string;
  selesai: string;
}

// Escape HTML untuk konten yang dirender lewat opsi `html` SweetAlert (cegah XSS)
const escapeHtml = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  canDo: (res: string, act: string) => boolean;
  allowedTypes?: {
    IZIN: boolean;
    SAKIT: boolean;
  };
}

export default function AddModal({ isOpen, onClose, onSuccess, canDo, allowedTypes }: AddModalProps) {
  const [jenis, setJenis] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [status, setStatus] = useState('MADRASAH');
  const [isInitialized, setIsInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ketIzin, setKetIzin] = useState('');
  const [ketSakit, setKetSakit] = useState('');
  const [tglMulai, setTglMulai] = useState('');
  const [tglSelesai, setTglSelesai] = useState('');
  const [selectedNisns, setSelectedNisns] = useState<string[]>([]);
  const [studentClasses, setStudentClasses] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [jamMode, setJamMode] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [jamOptions, setJamOptions] = useState<JamOption[]>([]);

  const [waktuMulai, setWaktuMulai] = useState('');
  const [waktuSelesai, setWaktuSelesai] = useState('');
  const [isKontinu, setIsKontinu] = useState(false);

  // Rekam Medis Fields (Sakit Only)

  // Rekam Medis Fields (Sakit Only)
  const [tindakan, setTindakan] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');

  const getJamOptions = (): JamOption[] =>
    jamOptions.length > 0 ? jamOptions
      : Array.from({ length: 12 }, (_, i) => ({ jam_ke: i + 1, mulai: '', selesai: '' }));

  // Fetch jam options on mount
  useEffect(() => {
    const fetchWaktu = async () => {
      try {
        const res = await fetch('/api/master/waktu?program=Reguler&limit=10000');
        const json = await res.json();
        if (json.ok && json.data && json.data.length > 0) {
          const seen = new Set<number>();
          const opts: JamOption[] = [];
          for (const item of json.data) {
            if (!seen.has(item.jam_ke) && !item.is_istirahat) {
              seen.add(item.jam_ke);
              opts.push({ jam_ke: item.jam_ke, mulai: item.mulai, selesai: item.selesai });
            }
          }
          opts.sort((a, b) => a.jam_ke - b.jam_ke);
          setJamOptions(opts);
        }
      } catch { /* silent fallback */ }
    };
    fetchWaktu();
  }, []);

  // Initialize form
  useEffect(() => {
    if (isOpen && !isInitialized) {
      if (allowedTypes?.IZIN && !allowedTypes?.SAKIT) {
        setJenis('IZIN');
        setStatus('MADRASAH');
      } else if (allowedTypes?.SAKIT && !allowedTypes?.IZIN) {
        setJenis('SAKIT');
        setStatus('Ringan');
      } else if (allowedTypes?.IZIN && allowedTypes?.SAKIT) {
        setJenis('IZIN');
        setStatus('MADRASAH');
      } else if (canDo('ketidakhadiran.izin', 'manage') && !canDo('ketidakhadiran.sakit', 'manage')) {
        setJenis('IZIN');
        setStatus('MADRASAH');
      } else if (canDo('ketidakhadiran.sakit', 'manage')) {
        setJenis('SAKIT');
        setStatus('Ringan');
      }

      const opts = getJamOptions();
      if (opts.length > 0) {
        setWaktuMulai(opts[0].mulai || '07:00');
        setWaktuSelesai(opts[opts.length - 1].selesai || '15:30');
      } else {
        setWaktuMulai('07:00');
        setWaktuSelesai('15:30');
      }

      setIsInitialized(true);
    }

    if (!isOpen) {
      setIsInitialized(false);
      // Reset seluruh state form agar modal selalu bersih saat dibuka ulang
      setJenis('IZIN');
      setStatus('MADRASAH');
      setTglMulai('');
      setTglSelesai('');
      setWaktuMulai('');
      setWaktuSelesai('');
      setIsKontinu(false);
      setKetIzin('');
      setKetSakit('');
      setSelectedNisns([]);
      setStudentClasses({});
      setTindakan('');
      setTindakLanjut('');
      setUploadedFileUrl('');
      setUploadedFileName('');
      setUploading(false);
      setUploadProgress(0);
      setJamMode('ALL');
      // Reset file input element agar upload bisa dipilih ulang
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, allowedTypes, isInitialized]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', `Ketidakhadiran/${jenis.charAt(0) + jenis.slice(1).toLowerCase()}`);

      // Simulate progress (API doesn't support streaming progress)
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 15;
        if (progress <= 85) setUploadProgress(progress);
      }, 150);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
      if (data.ok) {
        setUploadedFileUrl(data.publicUrl || data.url);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Upload berhasil!', timer: 1500, showConfirmButton: false });
      } else {
        throw new Error(data.error || 'Upload gagal');
      }
    } catch (error: any) {
      Swal.fire('Upload Gagal', error.message || 'Gagal menghubungi server', 'error');
      setUploadedFileUrl('');
      setUploadedFileName('');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

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

      // Auto-sync Date ONLY if tglSelesai is single-day or empty
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

  const calculateJamRange = () => {
    if (!waktuMulai || !waktuSelesai) return { jm: null, js: null };

    const opts = getJamOptions();
    let jm: number | null = null;
    let js: number | null = null;

    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startMin = toMin(waktuMulai);
    const endMin = toMin(waktuSelesai);

    // Rentang waktu lintas hari (misal 15:00 s.d. 15:00 besok)
    if (endMin <= startMin) {
      if (opts.length > 0) {
        return { jm: opts[0].jam_ke, js: opts[opts.length - 1].jam_ke };
      }
      return { jm: 1, js: 12 };
    }

    opts.forEach(opt => {
      const optStart = toMin(opt.mulai);
      const optEnd = toMin(opt.selesai);
      
      if (!(endMin <= optStart || startMin >= optEnd)) {
        if (jm === null || opt.jam_ke < jm) jm = opt.jam_ke;
        if (js === null || opt.jam_ke > js) js = opt.jam_ke;
      }
    });

    return { jm, js };
  };

  const handleSubmit = async () => {
    if (!tglMulai) {
      Swal.fire({ title: 'Validasi', text: 'Tanggal mulai wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    if (!waktuMulai || !waktuSelesai) {
      Swal.fire({ title: 'Validasi', text: 'Waktu mulai dan selesai wajib diisi', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }
    // Block submission if user only has one type but the jenis is different
    if (allowedOnly && jenis !== allowedOnly) {
      Swal.fire({ title: 'Akses Ditolak', text: `Anda tidak memiliki hak untuk menambah data ${jenis}`, icon: 'error', confirmButtonColor: '#3083FF' });
      return;
    }
    const finalTglSelesai = tglSelesai || tglMulai;
    if (selectedNisns.length === 0) {
      Swal.fire({ title: 'Validasi', text: 'Pilih minimal 1 siswa', icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }

    let keterangan = jenis === 'IZIN' ? ketIzin : ketSakit;
    if (!keterangan) {
      Swal.fire({ title: 'Validasi', text: `Keterangan ${jenis === 'IZIN' ? 'izin' : 'sakit'} wajib diisi`, icon: 'warning', confirmButtonColor: '#3083FF' });
      return;
    }

    const { jm, js } = calculateJamRange();

    setSubmitting(true);

    const payload: any = {
      jenis, status,
      tgl_mulai: tglMulai,
      tgl_selesai: finalTglSelesai,
      keterangan,
      nisList: selectedNisns,
      studentClasses,
      file_url: uploadedFileUrl || null,
      tindakan: jenis === 'SAKIT' ? tindakan : null,
      tindak_lanjut: jenis === 'SAKIT' ? tindakLanjut : null,
      jam_mulai: jm,
      jam_selesai: js,
      waktu_mulai_real: waktuMulai,
      waktu_selesai_real: waktuSelesai,
      is_kontinu: tglMulai && finalTglSelesai && tglMulai !== finalTglSelesai ? isKontinu : false,
    };

    try {
      const res = await fetch('/api/ketidakhadiran/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSubmitting(false);

      if (data.ok) {
        const count = data.added ?? data.data?.added ?? (Array.isArray(data.data) ? data.data.length : 0);
        const failedList: { nisn: string; error: string }[] = data.failed ?? data.data?.failed ?? [];
        const totalRequested = data.total_requested ?? data.data?.total_requested ?? (count + failedList.length);
        const note = data.per_day_split ? `<br><small style="color:#3083FF">${data.per_day_split}</small>` : '';

        if (failedList.length > 0) {
          // Sebagian (atau semua) siswa gagal ditambahkan (mis. duplikasi tanggal) —
          // JANGAN tampilkan sebagai sukses biasa & auto-close, tampilkan rinciannya
          // supaya petugas tahu persis siswa mana yang perlu ditinjau ulang.
          const failedHtml = failedList.map(f => `<li><b>${escapeHtml(f.nisn)}</b>: ${escapeHtml(f.error)}</li>`).join('');
          await Swal.fire({
            title: count > 0 ? 'Sebagian Berhasil' : 'Tidak Ada Data Ditambahkan',
            icon: count > 0 ? 'warning' : 'error',
            html: `
              ${count > 0 ? `<p>Berhasil menambahkan <b>${count}</b> dari <b>${totalRequested}</b> siswa.${note}</p>` : ''}
              <p style="color:#dc2626;margin-bottom:4px;">${failedList.length} siswa <b>gagal</b> ditambahkan:</p>
              <ul style="text-align:left;max-height:180px;overflow-y:auto;padding-left:1.2rem;margin:0;">${failedHtml}</ul>
            `,
            confirmButtonColor: '#3083FF'
          });
        } else {
          await Swal.fire({ title: 'Berhasil', html: `Berhasil menambahkan <b>${count}</b> data ketidakhadiran${note}`, icon: 'success', timer: 2500, showConfirmButton: false });
        }

        // Hanya refresh + tutup modal jika ada data yang benar-benar tersimpan.
        // Jika SEMUA gagal, biarkan modal tetap terbuka agar petugas bisa memperbaiki pilihan.
        if (count > 0) {
          onSuccess();
          onClose();
        }
      } else {
        Swal.fire({ title: 'Gagal', text: data.error || 'Terjadi kesalahan', icon: 'error', confirmButtonColor: '#3083FF' });
      }
    } catch (error: any) {
      console.error(error);
      setSubmitting(false);
      Swal.fire({ title: 'Error', text: error.message || 'Terjadi kesalahan sistem', icon: 'error', confirmButtonColor: '#3083FF' });
    }
  };

  const isIzin = jenis === 'IZIN';
  // Only allow switch if user has manage permission for BOTH jenis, OR separately for each
  const canSwitchToIzin = allowedTypes?.IZIN || canDo('ketidakhadiran.izin', 'manage');
  const canSwitchToSakit = allowedTypes?.SAKIT || canDo('ketidakhadiran.sakit', 'manage');
  const canManageBoth = (allowedTypes?.IZIN && allowedTypes?.SAKIT) || (canDo('ketidakhadiran.izin', 'manage') && canDo('ketidakhadiran.sakit', 'manage'));

  // Additional guard: if user only has one type, prevent form submission of the other
  const allowedOnly = (!allowedTypes?.IZIN && allowedTypes?.SAKIT) ? 'SAKIT'
                    : (!allowedTypes?.SAKIT && allowedTypes?.IZIN) ? 'IZIN'
                    : null;

  // Helper for hint
  const jamRangeInfo = () => {
    const { jm, js } = calculateJamRange();
    if (jm === null) return null;
    return `Mencakup Jam Pelajaran ${jm} s/d ${js}`;
  };

  const jenisOptions: InlineSelectOption[] = [];
  if (allowedTypes?.IZIN || canDo('ketidakhadiran.izin', 'manage')) {
    jenisOptions.push({ value: 'IZIN', label: 'IZIN' });
  }
  if (allowedTypes?.SAKIT || canDo('ketidakhadiran.sakit', 'manage')) {
    jenisOptions.push({ value: 'SAKIT', label: 'SAKIT' });
  }
  if (jenisOptions.length === 0) {
    jenisOptions.push({ value: jenis, label: jenis });
  }

  const statusOptions: InlineSelectOption[] = isIzin
    ? [
        { value: 'MADRASAH', label: 'Madrasah' },
        { value: 'PERSONAL', label: 'Personal' },
      ]
    : [
        { value: 'Ringan', label: 'Ringan' },
        { value: 'Sedang', label: 'Sedang' },
        { value: 'Berat', label: 'Berat' },
        { value: 'Kontrol', label: 'Kontrol' },
      ];

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title="Tambah Data Ketidakhadiran"
        icon="calendar-plus"
        onClose={onClose}
      />

      <ModalBody>
        <div className="kh-form">

            {/* Jenis + Status */}
            <div className="kh-grid-2">
              <div className="kh-field">
                <label className="kh-label">Jenis Ketidakhadiran</label>
                <InlineSelect
                  value={jenis}
                  onChange={(val) => {
                    const nj = val as 'IZIN' | 'SAKIT';
                    setJenis(nj);
                    if (nj === 'IZIN') setStatus('MADRASAH'); else setStatus('Ringan');
                  }}
                  options={jenisOptions}
                  disabled={!canManageBoth || !!allowedOnly}
                  minWidth="100%"
                  height="38px"
                />
                {allowedOnly && (
                  <p className="kh-hint" style={{ color: '#3083FF', marginTop: '4px' }}>
                    <i className="bi bi-info-circle" style={{ marginRight: '4px' }} />
                    Anda hanya dapat menambah data <b>{allowedOnly}</b>
                  </p>
                )}
              </div>
              <div className="kh-field">
                <label className="kh-label">Status</label>
                <InlineSelect
                  value={status}
                  onChange={(val) => setStatus(val)}
                  options={statusOptions}
                  minWidth="100%"
                  height="38px"
                />
              </div>
            </div>

            {/* Tanggal & Waktu Range */}
            <div className="kh-grid-2">
              {/* Date Range - Single Input Field */}
              <div className="kh-field">
                <label className="kh-label">Tanggal</label>
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
                  <p className="kh-hint" style={{ marginTop: '4px', color: '#3083FF' }}>
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
                <label className="kh-label">Waktu</label>

                <div className="kh-time-range">
                  <label className="kh-time-unit">
                    <span className="kh-time-tag">Mulai</span>
                    <input
                      type="time"
                      className="kh-time-input"
                      value={waktuMulai}
                      onChange={(e) => handleWaktuChange(e.target.value, waktuSelesai)}
                    />
                  </label>
                  <span className="kh-time-sep">—</span>
                  <label className="kh-time-unit">
                    <span className="kh-time-tag">Selesai</span>
                    <input
                      type="time"
                      className="kh-time-input"
                      value={waktuSelesai}
                      onChange={(e) => handleWaktuChange(waktuMulai, e.target.value)}
                    />
                  </label>
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

            {/* Keterangan + Dokumen Pendukung */}
            <div className="kh-grid-2" style={{ marginTop: '-4px' }}>
              {/* Keterangan */}
              <div className="kh-field" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <label className="kh-label">Keterangan</label>
                {isIzin && <p className="kh-hint" style={{ marginBottom: 4 }}>Gunakan <b>|</b> untuk memisahkan</p>}
                <textarea
                  className="kh-input kh-textarea"
                  rows={5}
                  placeholder={isIzin ? "Contoh: Lomba | Penyelenggara | Lokasi" : "Jelaskan kondisi kesehatan..."}
                  value={isIzin ? ketIzin : ketSakit}
                  onChange={(e) => isIzin ? setKetIzin(e.target.value) : setKetSakit(e.target.value)}
                  style={{ minHeight: '135px', flex: 1, resize: 'vertical' }}
                />
              </div>

              {/* File Upload */}
              <div className="kh-field" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <label className="kh-label">Dokumen Pendukung <span style={{ fontWeight: 400, textTransform: 'none' }}>(Opsional)</span></label>
                <input type="file" id="file-upload" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" disabled={uploading} />
                <label htmlFor="file-upload" className={`kh-upload__box ${uploading ? 'is-uploading' : ''} ${uploadedFileUrl ? 'is-success' : ''}`} style={{ flex: 1, minHeight: '135px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem' }}>
                  {uploading ? (
                    <div className="kh-upload__progress" style={{ width: '100%' }}>
                      <div className="kh-progress-header">
                        <i className="bi bi-cloud-arrow-up" />
                        <span className="kh-progress-name">{uploadedFileName}</span>
                      </div>
                      <div className="kh-progress-bar-bg">
                        <div className="kh-progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div className="kh-progress-percent">{uploadProgress}%</div>
                    </div>
                  ) : uploadedFileUrl ? (
                    <div className="kh-upload__success" style={{ width: '100%' }}>
                      <i className="bi bi-check-circle-fill" />
                      <div className="kh-upload__success-info">
                        <span className="kh-upload__success-label">Upload berhasil</span>
                        <span className="kh-upload__success-name">{uploadedFileName}</span>
                      </div>
                      <button type="button" className="kh-upload__remove-btn" onClick={(e) => { e.preventDefault(); setUploadedFileUrl(''); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.4rem', color: 'var(--kh-text-muted)', marginBottom: '0.2rem', display: 'block' }} />
                      <span className="kh-upload__text-main" style={{ fontSize: '0.8rem' }}>Klik untuk upload</span>
                      <span className="kh-upload__text-sub" style={{ fontSize: '0.7rem' }}>PDF / Gambar</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Student Selector */}
            <div className="kh-field">
              <label className="kh-label">Pilih Siswa</label>
              <StudentSelect
                selectedNisns={selectedNisns}
                onSelectionChange={(nisns, classMap) => {
                  setSelectedNisns(nisns);
                  if (classMap) setStudentClasses(classMap);
                }}
              />
            </div>

            {/* Rekam Medis Section (Sakit Only) - Moved to Bottom */}
            {!isIzin && (
              <div className="kh-rekam-medis-section">
                <div className="kh-rekam-medis-header">
                  <i className="bi bi-hospital-fill"></i>
                  <span>Data Rekam Medis</span>
                </div>

                <div className="kh-grid-2">
                  <div className="kh-field">
                    <label className="kh-label">Tindakan</label>
                    <textarea
                      className="kh-input kh-textarea"
                      rows={2}
                      placeholder="Tindakan yang diberikan..."
                      value={tindakan}
                      onChange={(e) => setTindakan(e.target.value)}
                    />
                  </div>
                  <div className="kh-field">
                    <label className="kh-label">Tindak Lanjut</label>
                    <textarea
                      className="kh-input kh-textarea"
                      rows={2}
                      placeholder="Observasi, rujuk, dll..."
                      value={tindakLanjut}
                      onChange={(e) => setTindakLanjut(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
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
