'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { ApiResponse } from '@/lib/types';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions, FilterToggle } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

interface UMNilai {
  id?: string;
  kelas: string;
  nisn: string;
  mapel: string;
  guru_nip?: string;
  nilai: number | string | null;
  catatan?: string;
  tahun_ajaran?: string;
}

interface MapelUM {
  id: string;
  nama_mapel: string;
  kode: string;
  guru_nip?: string;
  guru_nama?: string;
  guru_kode?: string;
  urutan?: number;
  aktif: boolean;
}

interface SiswaRow {
  nisn: string;
  nama_siswa: string;
  kelas: string;
}

const DEFAULT_MAPEL_UM: MapelUM[] = [];

function matchMapelGuru(jadwalMapel: string, umMapel: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/bahasa/g, 'bhs')
      .replace(/\bb\.\s*/g, 'bhs')
      .replace(/matematika/g, 'mat')
      .replace(/[^a-z0-9]/g, '');

  const j = normalize(jadwalMapel);
  const u = normalize(umMapel);

  const languages = ['ind', 'ing', 'arab'];
  for (const lang of languages) {
    if (u.includes(lang) && !j.includes(lang)) return false;
    if (j.includes(lang) && !u.includes(lang)) return false;
  }

  return j.includes(u) || u.includes(j);
}

interface NilaiUMTabProps {
  tahunAjaranList: string[];
  tahunAjaran: string;
  setTahunAjaran: (ta: string) => void;
}

export default function NilaiUMTab({
  tahunAjaranList,
  tahunAjaran,
  setTahunAjaran,
}: NilaiUMTabProps) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [guruMapelByKelas, setGuruMapelByKelas] = useState<
    Record<string, string[]>
  >({});
  const [filterMyMapel, setFilterMyMapel] = useState(false);

  const [kelasList, setKelasList] = useState<string[]>([]);
  const [kelas, setKelas] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [siswa, setSiswa] = useState<SiswaRow[]>([]);

  const KKM = 75;
  const [nilaiData, setNilaiData] = useState<UMNilai[]>([]);
  const [allMapelUM, setAllMapelUM] = useState<MapelUM[]>(DEFAULT_MAPEL_UM);
  const [changes, setChanges] = useState<Record<string, string>>({});

  const [isLocked, setIsLocked] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapelList = useMemo((): MapelUM[] => {
    if (user?.nip && filterMyMapel) {
      return allMapelUM.filter(
        (m) =>
          m.guru_nip === user.nip ||
          guruMapelByKelas[kelas]?.some((gm) =>
            matchMapelGuru(gm, m.nama_mapel)
          )
      );
    }
    return allMapelUM;
  }, [allMapelUM, isAdmin, user, filterMyMapel, kelas, guruMapelByKelas]);

  const isAuthorizedToInput = (m: MapelUM) => {
    if (isLocked && !isAdmin) return false;
    if (isAdmin) return true;
    if (!user || !user.nip) return false;
    if (m.guru_nip === user.nip) return true;
    const guruMapels = kelas ? guruMapelByKelas[kelas] || [] : [];
    return guruMapels.some((gm) => matchMapelGuru(gm, m.nama_mapel));
  };

  useEffect(() => {
    const controller = new AbortController();
    const init = async () => {
      try {
        const userData = await getCurrentUser();
        if (!userData) return;
        setUser(userData);

        const adminFlag =
          userData?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || !!(userData as any).isAdmin ||
          false;
        setIsAdmin(adminFlag);

        const scopeRes = await fetch(`/api/scopes?nip=${userData.nip}`, {
          signal: controller.signal,
        });
        const scopeJson = await scopeRes.json();
        const allKelas: string[] = scopeJson.ok
          ? scopeJson.data?.kelasList || []
          : [];
        const mapelByKelasRaw: Record<string, string[]> = scopeJson.ok
          ? scopeJson.data?.mapelByKelas || {}
          : {};
        setGuruMapelByKelas(mapelByKelasRaw);

        if (adminFlag) {
          const qRes = await fetch('/api/ujian-madrasah/kelas-xii', {
            signal: controller.signal,
          });
          const qJson = await qRes.json();
          const dbKelas: string[] = qJson.ok ? qJson.data || [] : [];
          const finalKelas =
            dbKelas.length > 0
              ? dbKelas
              : allKelas.filter(
                  (k) =>
                    k.toUpperCase().includes('XII') ||
                    k.toUpperCase().startsWith('12')
                );
          setKelasList(finalKelas);
          if (finalKelas.length > 0) setKelas(finalKelas[0]);
        } else {
          const currentYear = tahunAjaran || '';
          const qRes = await fetch(
            `/api/ujian-madrasah/kelas-xii?nip=${encodeURIComponent(
              userData.nip
            )}&tahun_ajaran=${encodeURIComponent(currentYear)}`,
            { signal: controller.signal }
          );
          const qJson = await qRes.json();
          const kelasDariMapel: string[] = qJson.ok ? qJson.data || [] : [];
          const finalKelas =
            kelasDariMapel.length > 0
              ? kelasDariMapel
              : allKelas.filter(
                  (k) =>
                    k.toUpperCase().includes('XII') ||
                    k.toUpperCase().startsWith('12')
                );
          setKelasList(finalKelas);
          if (finalKelas.length > 0) setKelas(finalKelas[0]);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.error('Init error:', e);
      }
    };
    init();
    return () => controller.abort();
  }, [tahunAjaran]);

  useEffect(() => {
    const controller = new AbortController();
    if (kelas && tahunAjaran) loadData(controller.signal);
    return () => controller.abort();
  }, [kelas, tahunAjaran]);

  const loadData = async (signal?: AbortSignal) => {
    if (!kelas || !tahunAjaran) return;
    setLoadingData(true);
    try {
      const nipParam =
        isAdmin || !user?.nip ? '' : `&nip=${encodeURIComponent(user.nip)}`;
      const res = await fetch(
        `/api/ujian-madrasah?kelas=${encodeURIComponent(
          kelas
        )}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}${nipParam}`,
        { signal }
      );
      const json: ApiResponse = await res.json();
      if (json.ok && json.data) {
        setSiswa(json.data.siswa || []);
        setNilaiData(json.data.nilai || []);
        setIsLocked(json.data.isLocked === true);
        setAllMapelUM(json.data.mapelList || []);
        setChanges({});
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Load error:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const getScore = (
    nisn: string,
    mapel: string,
    guru_nip?: string
  ): string => {
    const key = `${nisn}||${mapel}||${guru_nip || ''}`;
    if (changes[key] !== undefined) return changes[key];
    const found = nilaiData.find(
      (d) =>
        d.nisn === nisn &&
        d.mapel === mapel &&
        d.guru_nip === (guru_nip || null)
    );
    return found && found.nilai !== null && found.nilai !== undefined
      ? String(found.nilai)
      : '';
  };

  const isChanged = (
    nisn: string,
    mapel: string,
    guru_nip?: string
  ): boolean => {
    const key = `${nisn}||${mapel}||${guru_nip || ''}`;
    if (changes[key] === undefined) return false;
    const found = nilaiData.find(
      (d) =>
        d.nisn === nisn &&
        d.mapel === mapel &&
        d.guru_nip === (guru_nip || null)
    );
    const original =
      found && found.nilai !== null ? String(found.nilai) : '';
    return changes[key] !== original;
  };

  const handleScoreChange = (
    nisn: string,
    mapel: string,
    guru_nip: string | undefined,
    val: string
  ) => {
    if (isLocked && !isAdmin) return;
    let raw = val.replace(',', '.');
    if (raw === '') {
      setChanges((prev) => ({
        ...prev,
        [`${nisn}||${mapel}||${guru_nip || ''}`]: '',
      }));
      return;
    }
    if (!/^\d+\.?\d{0,2}$/.test(raw)) return;
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 100) return;
    if (raw.length > 1 && raw.startsWith('0') && raw[1] !== '.')
      raw = raw.substring(1);
    setChanges((prev) => ({
      ...prev,
      [`${nisn}||${mapel}||${guru_nip || ''}`]: raw,
    }));
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    mapelIndex: number
  ) => {
    const { key } = e;
    const totalRows = filteredSiswa.length;
    const totalCols = mapelList.length;
    let nextRow = rowIndex;
    let nextCol = mapelIndex;

    if (key === 'Enter' || key === 'ArrowDown') {
      e.preventDefault();
      nextRow++;
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      nextRow--;
    } else if (key === 'ArrowRight') {
      const input = e.target as HTMLInputElement;
      if (input.selectionStart === input.value.length) nextCol++;
      else return;
    } else if (key === 'ArrowLeft') {
      const input = e.target as HTMLInputElement;
      if (input.selectionStart === 0) nextCol--;
      else return;
    } else return;

    if (nextRow < 0) nextRow = 0;
    if (nextRow >= totalRows) nextRow = totalRows - 1;
    if (nextCol < 0) nextCol = 0;
    if (nextCol >= totalCols) nextCol = totalCols - 1;

    if (nextRow !== rowIndex || nextCol !== mapelIndex) {
      const nextSiswa = filteredSiswa[nextRow];
      const nextMapel = mapelList[nextCol];
      if (nextSiswa && nextMapel) {
        const nextId = `um-score-${nextSiswa.nisn}-${nextMapel.id}`;
        const nextInput = document.getElementById(nextId) as HTMLInputElement;
        if (nextInput && !nextInput.disabled) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  const pendingCount = Object.keys(changes).filter((k) => {
    const [n, m, g] = k.split('||');
    return isChanged(n, m, g);
  }).length;

  const filteredSiswa = useMemo(() => {
    if (!searchTerm.trim()) return siswa;
    const low = searchTerm.toLowerCase();
    return siswa.filter(
      (s) =>
        s.nama_siswa.toLowerCase().includes(low) ||
        s.nisn.toLowerCase().includes(low)
    );
  }, [siswa, searchTerm]);

  const stats = useMemo(() => {
    const totalCells = filteredSiswa.length * mapelList.length;
    let filledCells = 0,
      sumNilai = 0,
      countNilai = 0,
      belowKKM = 0;

    siswa.forEach((s) => {
      mapelList.forEach((m) => {
        const v = getScore(s.nisn, m.nama_mapel, m.guru_nip);
        if (v !== '') {
          filledCells++;
          const n = parseFloat(v);
          if (!isNaN(n)) {
            sumNilai += n;
            countNilai++;
            if (n < KKM) belowKKM++;
          }
        }
      });
    });
    return {
      totalSiswa: siswa.length,
      progress:
        totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0,
      rata: countNilai > 0 ? (sumNilai / countNilai).toFixed(1) : '-',
      belowKKM,
    };
  }, [siswa, mapelList, nilaiData, changes, KKM, filteredSiswa.length]);

  const handleSave = async () => {
    if (!user || !kelas) return;
    if (isLocked && !isAdmin) {
      Swal.fire({
        icon: 'error',
        title: 'Dikunci',
        text: 'Input nilai Ujian Madrasah sedang dikunci.',
      });
      return;
    }
    const updates: any[] = [];
    Object.keys(changes).forEach((key) => {
      const [nisn, mapel, guru_nip] = key.split('||');
      if (isChanged(nisn, mapel, guru_nip))
        updates.push({
          nisn,
          mapel,
          guru_nip: guru_nip || null,
          nilai: changes[key],
        });
    });
    if (updates.length === 0) {
      Swal.fire({ icon: 'info', text: 'Tidak ada perubahan.' });
      return;
    }
    setLoadingData(true);
    try {
      const res = await fetch('/api/ujian-madrasah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas,
          tahun_ajaran: tahunAjaran,
          nip: user.nip,
          updates,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Disimpan!',
          timer: 1200,
          showConfirmButton: false,
        });
        loadData();
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal', text: json.error });
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleToggleLock = async () => {
    if (!isAdmin || !kelas) return;
    const newLocked = !isLocked;
    const result = await Swal.fire({
      icon: 'warning',
      title: `Yakin ingin ${
        newLocked ? 'mengunci' : 'membuka'
      } nilai kelas ${kelas}?`,
      showCancelButton: true,
      confirmButtonText: 'Ya',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;

    setTogglingLock(true);
    try {
      const res = await fetch('/api/settings/um-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas,
          tahun_ajaran: tahunAjaran,
          locked: newLocked,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setIsLocked(newLocked);
        await Swal.fire({
          icon: 'success',
          title: newLocked ? 'Dikunci' : 'Dibuka',
          timer: 1200,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal' });
    } finally {
      setTogglingLock(false);
    }
  };

  const handleExport = async (isTemplate = false) => {
    try {
      const XLSXStyle = await import('xlsx-js-style');
      const wb = XLSXStyle.utils.book_new();

      const headers = [
        'NO',
        'NISN',
        'NAMA SISWA',
        'KELAS',
        ...mapelList.map((m) => m.nama_mapel),
      ];
      const rows = filteredSiswa.map((s, i) => {
        const row: any = {
          NO: i + 1,
          NISN: s.nisn,
          'NAMA SISWA': s.nama_siswa,
          KELAS: s.kelas || kelas,
        };
        mapelList.forEach((m) => {
          row[m.nama_mapel] = isTemplate
            ? ''
            : getScore(s.nisn, m.nama_mapel, m.guru_nip) || '';
        });
        return row;
      });

      const applyStyles = (ws: any) => {
        const range = XLSXStyle.utils.decode_range(ws['!ref']!);
        ws['!cols'] = [
          { wch: 5 },
          { wch: 15 },
          { wch: 35 },
          { wch: 12 },
        ];
        for (let i = 4; i <= range.e.c; i++) ws['!cols'].push({ wch: 20 });

        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSXStyle.utils.encode_cell({ r: 0, c: C });
          if (!ws[addr]) continue;
          ws[addr].s = {
            fill: { fgColor: { rgb: '0D47A1' } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' },
            },
          };
        }
      };

      const ws = XLSXStyle.utils.json_to_sheet(rows, { header: headers });
      applyStyles(ws);
      XLSXStyle.utils.book_append_sheet(wb, ws, 'NILAI_UM');

      const prefix = isTemplate ? 'TEMPLATE_UM' : 'NILAI_UM';
      XLSXStyle.writeFile(
        wb,
        `${prefix}_${kelas}_${tahunAjaran}.xlsx`
          .replace(/\s+/g, '_')
          .replace(/\//g, '-')
      );
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal export',
        text: 'Library Excel tidak dapat dimuat.',
      });
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length < 2) {
          Swal.fire({ icon: 'warning', text: 'File kosong' });
          return;
        }
        const headers = (data[0] as string[]).map((h) =>
          String(h || '').trim()
        );
        const previewRows = data
          .slice(1, Math.min(11, data.length))
          .map((row) => {
            const obj: any = {};
            headers.forEach((h, i) => {
              obj[h] = (row as any[])[i] ?? '';
            });
            return obj;
          });
        setImportPreview(previewRows);
        Swal.fire({
          icon: 'info',
          title: 'File Dipilih',
          text: `${wb.SheetNames.length} sheet, ${data.length - 1} baris`,
          timer: 2000,
        });
      } catch {
        Swal.fire({ icon: 'error', text: 'Gagal membaca file' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportConfirm = async () => {
    if (isLocked && !isAdmin) {
      Swal.fire({
        icon: 'error',
        title: 'Dikunci',
        text: 'Input nilai sedang dikunci.',
      });
      return;
    }
    if (!importFile) {
      Swal.fire({ icon: 'warning', text: 'Pilih file terlebih dahulu' });
      return;
    }

    Swal.fire({
      title: 'Memproses...',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) throw new Error('File tidak dapat dibaca');
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const siswaMap = new Map(siswa.map((s) => [s.nisn, s]));
        if (siswaMap.size === 0)
          throw new Error('Data siswa tidak ditemukan');

        const rawHeaders = (data[0] as any[]).map((h) =>
          String(h || '').trim()
        );
        if (!rawHeaders.includes('NISN'))
          throw new Error('Kolom NISN tidak ditemukan');

        const mapelCols = rawHeaders.filter(
          (h) => h && !['NO', 'NISN', 'NAMA SISWA', 'KELAS', ''].includes(h)
        );
        const allUpdates: any[] = [];
        const errors: string[] = [];

        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length === 0) continue;
          const rowObj: any = {};
          rawHeaders.forEach((h, idx) => {
            if (h && idx < row.length) rowObj[h] = row[idx];
          });
          const nisn = String(rowObj['NISN'] || '').trim();
          if (!nisn) continue;
          if (!siswaMap.has(nisn)) {
            errors.push(
              `Baris ${i + 1}: NISN ${nisn} tidak terdaftar di kelas ini`
            );
            continue;
          }

          mapelCols.forEach((mapelCol) => {
            const val = rowObj[mapelCol];
            if (val === '' || val === undefined) return;
            const num = parseFloat(String(val).replace(',', '.'));
            if (isNaN(num) || num < 0 || num > 100) return;
            const mapelMatch = mapelList.find(
              (m) => m.nama_mapel.toLowerCase() === mapelCol.toLowerCase()
            );
            allUpdates.push({
              nisn,
              mapel: mapelCol,
              nilai: num,
              guru_nip: mapelMatch?.guru_nip || null,
            });
          });
        }

        if (allUpdates.length === 0) throw new Error('Tidak ada data valid');

        Swal.close();
        const result = await Swal.fire({
          title: 'Import Nilai UM?',
          html: `<p>${allUpdates.length} nilai siap diimport</p>${
            errors.length > 0
              ? `<p style="color:red; font-size: 0.9em;">Ada ${errors.length} baris tidak cocok</p>`
              : ''
          }`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Import',
        });
        if (!result.isConfirmed) return;

        Swal.fire({
          title: 'Menyimpan...',
          didOpen: () => Swal.showLoading(),
          allowOutsideClick: false,
        });
        const res = await fetch('/api/ujian-madrasah', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kelas,
            tahun_ajaran: tahunAjaran,
            nip: user.nip,
            updates: allUpdates,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: `${allUpdates.length} nilai berhasil diimport.`,
          });
          setShowImportModal(false);
          setImportFile(null);
          setImportPreview([]);
          loadData();
        } else throw new Error(json.error || 'Gagal menyimpan nilai');
      } catch (err: any) {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
      }
    };
    reader.readAsBinaryString(importFile);
  };

  return (
    <div className="um">
      {/* ── Stats Row ────────────────────────────────────────────────── */}
      <div className="um__statsRow">
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--blue">
            <i className="bi bi-people-fill" />
          </div>
          <div>
            <div className="um__statVal">{stats.totalSiswa}</div>
            <div className="um__statLabel">Total Siswa</div>
          </div>
        </div>
        <div className="um__statCard">
          <div
            className="um__statIcon um__statIcon--blue"
            style={{ background: 'rgba(21,101,192,0.12)', color: '#1565c0' }}
          >
            <i className="bi bi-journal-bookmark-fill" />
          </div>
          <div>
            <div className="um__statVal">{mapelList.length}</div>
            <div className="um__statLabel">
              {isAdmin ? 'Total Mapel' : 'Mapel Anda'}
            </div>
          </div>
        </div>
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--green">
            <i className="bi bi-pie-chart-fill" />
          </div>
          <div>
            <div className="um__statVal">{stats.progress}%</div>
            <div className="um__statLabel">Progress</div>
            <div className="um__progress" style={{ width: 100 }}>
              <div
                className="um__progressBar"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>
        </div>
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--amber">
            <i className="bi bi-star-half" />
          </div>
          <div>
            <div className="um__statVal">{stats.rata}</div>
            <div className="um__statLabel">Rata-rata</div>
          </div>
        </div>
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--red">
            <i className="bi bi-exclamation-triangle-fill" />
          </div>
          <div>
            <div className="um__statVal">
              {stats.belowKKM}{' '}
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'var(--n-muted)',
                }}
              >
                / KKM {KKM}
              </span>
            </div>
            <div className="um__statLabel">Di bawah KKM</div>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ───────────────────────────────────────────── */}
      <FilterToolbar>
        <FilterSelect
          label="Kelas"
          icon="mortarboard"
          value={kelas}
          onChange={setKelas}
          options={kelasList.map((k) => ({ value: k, label: k }))}
        />
        <FilterSearch
          placeholder="Cari nama atau NISN siswa..."
          value={searchTerm}
          onChange={setSearchTerm}
          grow={2}
        />

        {user?.nip && (
          <FilterToggle
            label="Filter"
            text="Mapel Saya"
            checked={filterMyMapel}
            onChange={setFilterMyMapel}
          />
        )}

        <FilterActions>
          {isAdmin && (
            <Button
              size="md"
              variant={isLocked ? 'danger' : 'primary'}
              onClick={handleToggleLock}
              disabled={togglingLock}
              leftIcon={
                <i className={`bi bi-${isLocked ? 'lock-fill' : 'unlock-fill'}`} />
              }
            >
              {isLocked ? 'Buka Kunci' : 'Kunci Nilai'}
            </Button>
          )}

          <Button
            size="md"
            variant="outline"
            icon="export"
            onClick={() => handleExport(false)}
            disabled={filteredSiswa.length === 0}
          >
            Export
          </Button>

          <Button
            size="md"
            variant="outline"
            icon="import"
            onClick={() => setShowImportModal(true)}
            disabled={kelasList.length === 0 || mapelList.length === 0}
          >
            Import
          </Button>

          {pendingCount > 0 && !isLocked && (
            <Button
              size="md"
              variant="primary"
              icon="save"
              onClick={handleSave}
              isLoading={loadingData}
            >
              Simpan ({pendingCount})
            </Button>
          )}
        </FilterActions>
      </FilterToolbar>

      {/* ── Matrix Table Content ─────────────────────────────────────── */}
      {loadingData ? (
        <div className="um__tableWrap" style={{ padding: '40px 0', textAlign: 'center' }}>
          <Spinner variant="trace" label="Memuat nilai ujian madrasah..." />
        </div>
      ) : mapelList.length === 0 ? (
        <div className="um__tableWrap">
          <div className="um__empty">
            <i className="bi bi-book" />
            <p>Tidak ada mata pelajaran yang diplotkan untuk kelas ini.</p>
          </div>
        </div>
      ) : filteredSiswa.length === 0 ? (
        <div className="um__tableWrap">
          <div className="um__empty">
            <i className="bi bi-inbox" />
            <p>{kelas ? 'Tidak ada data siswa' : 'Pilih kelas terlebih dahulu'}</p>
          </div>
        </div>
      ) : (
        <div className="um__tableWrap" style={{ position: 'relative' }}>
          {isLocked && !isAdmin && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 200,
                background: 'rgba(15,23,42,0.45)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  background: 'var(--n-card)',
                  padding: '16px 24px',
                  borderRadius: 12,
                  textAlign: 'center',
                  color: 'var(--n-ink)',
                  fontWeight: 600,
                  border: '1px solid var(--n-border)',
                }}
              >
                <i
                  className="bi bi-lock-fill"
                  style={{
                    fontSize: '1.4rem',
                    color: '#ef4444',
                    display: 'block',
                    marginBottom: 8,
                  }}
                />
                Input Nilai Kelas {kelas} Sedang Dikunci
              </div>
            </div>
          )}

          <div className="um__tableScroll">
            <table className="um__table">
              <thead>
                <tr>
                  <th style={{ minWidth: 54, width: 54 }}>No</th>
                  <th style={{ minWidth: 260 }}>NAMA / NISN</th>
                  {mapelList.map((m) => (
                    <th key={m.id} style={{ minWidth: 120, maxWidth: 160 }}>
                      <div className="um__thMapel">{m.kode}</div>
                      <div className="um__thGuru">
                        {m.guru_kode || m.guru_nama?.split(' ')[0] || '-'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSiswa.map((s, idx) => (
                  <tr key={s.nisn}>
                    <td className="um__cellNo">{idx + 1}</td>
                    <td className="um__cellInfo">
                      <div className="um__cellName">{s.nama_siswa}</div>
                      <div className="um__cellNisnSub">{s.nisn}</div>
                    </td>
                    {mapelList.map((m) => {
                      const val = getScore(s.nisn, m.nama_mapel, m.guru_nip);
                      const changed = isChanged(
                        s.nisn,
                        m.nama_mapel,
                        m.guru_nip
                      );
                      const numVal = parseFloat(val);
                      const isBelowKKM =
                        val !== '' && !isNaN(numVal) && numVal < KKM;
                      return (
                        <td
                          key={m.id}
                          style={{
                            opacity:
                              !isAdmin && !isAuthorizedToInput(m) ? 0.6 : 1,
                          }}
                        >
                          <input
                            id={`um-score-${s.nisn}-${m.id}`}
                            type="text"
                            inputMode="decimal"
                            className={`um__scoreInput${
                              changed ? ' is-changed' : ''
                            }${isBelowKKM ? ' below-kkm' : ''}`}
                            value={val}
                            placeholder="—"
                            disabled={!isAuthorizedToInput(m)}
                            onChange={(e) =>
                              handleScoreChange(
                                s.nisn,
                                m.nama_mapel,
                                m.guru_nip,
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, idx, mapelList.indexOf(m))
                            }
                            onFocus={(e) =>
                              (e.target as HTMLInputElement).select()
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--n-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.82rem', color: 'var(--n-muted)' }}>
              {filteredSiswa.length} siswa · {mapelList.length} mapel
            </span>
            {pendingCount > 0 && (
              <span
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--n-primary)',
                  fontWeight: 700,
                }}
              >
                {pendingCount} perubahan belum disimpan
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Import Nilai UM (Modal.tsx) ─────────────────────────── */}
      {showImportModal && (
        <Modal
          open={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setImportPreview([]);
          }}
          size="lg"
          variant="add"
          icon="file-earmark-arrow-up"
          title="Import Nilai Ujian Madrasah"
          subtitle={`Kelas ${kelas || 'XII'} • ${tahunAjaran}`}
        >
          <ModalBody>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.2)',
                color: 'var(--n-ink)',
                fontSize: '0.8rem',
                marginBottom: 12,
              }}
            >
              <i
                className="bi bi-info-circle-fill"
                style={{ color: 'var(--n-primary)', fontSize: '1rem' }}
              />
              <div>
                Format kolom wajib: <strong>NISN</strong>,{' '}
                <strong>NAMA SISWA</strong>, dan kolom nama mata pelajaran.
              </div>
            </div>

            <div
              className={`um__dropzone${isDragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(f);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="bi bi-cloud-arrow-up-fill" />
              {importFile ? (
                <>
                  <strong>{importFile.name}</strong>
                  <p>{(importFile.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <strong>Seret file Excel ke sini atau Klik untuk Pilih</strong>
                  <p>Mendukung format .xlsx dan .xls</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />

            {importPreview.length > 0 && (
              <div className="um__importPreview" style={{ marginTop: 14 }}>
                <table className="um__importPreviewTable">
                  <thead>
                    <tr>
                      {Object.keys(importPreview[0])
                        .slice(0, 8)
                        .map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(importPreview[0])
                          .slice(0, 8)
                          .map((h) => (
                            <td key={h}>{String(row[h] ?? '')}</td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModalBody>

          <ModalFooter align="between">
            <Button
              variant="outline"
              onClick={() => handleExport(true)}
              disabled={mapelList.length === 0}
              leftIcon={<i className="bi bi-file-earmark-arrow-down" />}
            >
              Download Template
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="cancel"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleImportConfirm}
                disabled={!importFile}
                leftIcon={<i className="bi bi-check2" />}
              >
                Import Nilai
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}