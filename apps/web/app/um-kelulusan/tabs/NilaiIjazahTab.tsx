'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { ApiResponse } from '@/lib/types';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

interface UMNilai {
  nisn: string;
  mapel: string;
  guru_nip?: string;
  nilai: number | string | null;
}

interface UMRaport {
  nisn: string;
  mapel: string;
  nilai: number | null;
}

interface UMConfig {
  tahun_ajaran: string;
  bobot_raport: number;
  bobot_ujian: number;
}

interface MapelUM {
  id: string;
  nama_mapel: string;
  kode: string;
  guru_nip?: string;
  guru_nama?: string;
  guru_kode?: string;
}

interface SiswaRow {
  nisn: string;
  nama_siswa: string;
  kelas: string;
}

interface NilaiIjazahTabProps {
  tahunAjaranList: string[];
  tahunAjaran: string;
  setTahunAjaran: (ta: string) => void;
}

export default function NilaiIjazahTab({
  tahunAjaranList,
  tahunAjaran,
  setTahunAjaran,
}: NilaiIjazahTabProps) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [kelasList, setKelasList] = useState<string[]>([]);
  const [kelas, setKelas] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [siswa, setSiswa] = useState<SiswaRow[]>([]);
  const [nilaiData, setNilaiData] = useState<UMNilai[]>([]);
  const [raportData, setRaportData] = useState<UMRaport[]>([]);
  const [configData, setConfigData] = useState<UMConfig>({
    tahun_ajaran: '',
    bobot_raport: 0.6,
    bobot_ujian: 0.4,
  });
  const [allMapelUM, setAllMapelUM] = useState<MapelUM[]>([]);

  const [showImportRaportModal, setShowImportRaportModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Config local edit
  const [editBobotRaport, setEditBobotRaport] = useState(60);
  const [editBobotUjian, setEditBobotUjian] = useState(40);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

        if (adminFlag) {
          const qRes = await fetch('/api/ujian-madrasah/kelas-xii', {
            signal: controller.signal,
          });
          const qJson = await qRes.json();
          const dbKelas: string[] = qJson.ok ? qJson.data || [] : [];
          setKelasList(dbKelas);
          if (dbKelas.length > 0) setKelas(dbKelas[0]);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error(e);
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
      const res = await fetch(
        `/api/ujian-madrasah?kelas=${encodeURIComponent(
          kelas
        )}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`,
        { signal }
      );
      const json: ApiResponse = await res.json();
      if (json.ok && json.data) {
        setSiswa(json.data.siswa || []);
        setNilaiData(json.data.nilai || []);
        setRaportData(json.data.raport || []);
        if (json.data.config) {
          setConfigData(json.data.config);
          setEditBobotRaport(
            Math.round((json.data.config.bobot_raport || 0.6) * 100)
          );
          setEditBobotUjian(
            Math.round((json.data.config.bobot_ujian || 0.4) * 100)
          );
        }
        setAllMapelUM(json.data.mapelList || []);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const getScore = (
    nisn: string,
    mapel: string,
    guru_nip?: string
  ): string => {
    const found = nilaiData.find(
      (d) =>
        d.nisn === nisn &&
        d.mapel === mapel &&
        d.guru_nip === (guru_nip || null)
    );
    return found && found.nilai !== null ? String(found.nilai) : '';
  };

  const getRaportScore = (nisn: string, mapel: string): number | null => {
    const found = raportData.find((d) => d.nisn === nisn && d.mapel === mapel);
    return found && found.nilai !== null ? found.nilai : null;
  };

  const calculateIjazah = (
    nisn: string,
    mapel: string,
    guru_nip?: string
  ): string => {
    const umVal = getScore(nisn, mapel, guru_nip);
    const rapVal = getRaportScore(nisn, mapel);
    if (umVal === '' || rapVal === null) return '-';
    const umNum = parseFloat(umVal);
    const rapNum = rapVal;
    const result =
      rapNum * configData.bobot_raport + umNum * configData.bobot_ujian;
    return result.toFixed(2);
  };

  const filteredSiswa = useMemo(() => {
    if (!searchTerm.trim()) return siswa;
    const low = searchTerm.toLowerCase();
    return siswa.filter(
      (s) =>
        s.nama_siswa.toLowerCase().includes(low) ||
        s.nisn.toLowerCase().includes(low)
    );
  }, [siswa, searchTerm]);

  const mapelList = allMapelUM;

  const stats = useMemo(() => {
    let below80 = 0;
    let totalIjazah = 0;
    let sumIjazah = 0;

    filteredSiswa.forEach((s) => {
      mapelList.forEach((m) => {
        const ij = calculateIjazah(s.nisn, m.nama_mapel, m.guru_nip);
        if (ij !== '-') {
          totalIjazah++;
          const n = parseFloat(ij);
          sumIjazah += n;
          if (n < 80) below80++;
        }
      });
    });

    return {
      totalSiswa: siswa.length,
      progress: totalIjazah,
      rata: totalIjazah > 0 ? (sumIjazah / totalIjazah).toFixed(1) : '-',
      below80,
    };
  }, [filteredSiswa, mapelList, nilaiData, raportData, configData, siswa.length]);

  const handleSaveConfig = async () => {
    const bRaport = editBobotRaport / 100;
    const bUjian = editBobotUjian / 100;
    if (bRaport <= 0 || bUjian <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Bobot Tidak Valid',
        text: 'Bobot raport dan ujian harus lebih besar dari 0.',
      });
      return;
    }
    setLoadingData(true);
    try {
      const newConfig: UMConfig = {
        tahun_ajaran: tahunAjaran,
        bobot_raport: bRaport,
        bobot_ujian: bUjian,
      };
      const res = await fetch('/api/ujian-madrasah/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const json = await res.json();
      if (json.ok) {
        setConfigData(newConfig);
        setShowConfigModal(false);
        Swal.fire({
          icon: 'success',
          title: 'Disimpan!',
          timer: 1200,
          showConfirmButton: false,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleImportRaportConfirm = async () => {
    if (!importFile) return;
    Swal.fire({
      title: 'Memproses...',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length < 2) throw new Error('File kosong');

        const headers = (data[0] as string[]).map((h) =>
          String(h || '').trim()
        );
        if (!headers.includes('NISN'))
          throw new Error('Kolom NISN tidak ditemukan');

        const mapelCols = headers.filter(
          (h) => h && !['NO', 'NISN', 'NAMA SISWA', 'KELAS', ''].includes(h)
        );
        const allUpdates: any[] = [];

        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          const nisn = String(row[headers.indexOf('NISN')] || '').trim();
          if (!nisn) continue;
          mapelCols.forEach((m) => {
            const val = row[headers.indexOf(m)];
            if (val !== undefined && val !== '') {
              allUpdates.push({ nisn, mapel: m, nilai: val });
            }
          });
        }

        Swal.close();
        const res = await fetch('/api/ujian-madrasah/import-raport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: allUpdates,
            tahun_ajaran: tahunAjaran,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: `${json.count} data nilai raport diimport`,
            timer: 2000,
          });
          setShowImportRaportModal(false);
          setImportFile(null);
          setImportPreview([]);
          loadData();
        } else throw new Error(json.error);
      } catch (err: any) {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const handleExportRaportTemplate = async () => {
    try {
      const XLSXStyle = await import('xlsx-js-style');
      const wb = XLSXStyle.utils.book_new();
      const headers = [
        'NISN',
        'NAMA SISWA',
        ...mapelList.map((m) => m.nama_mapel),
      ];
      const rows = filteredSiswa.map((s) => {
        const row: any = { NISN: s.nisn, 'NAMA SISWA': s.nama_siswa };
        mapelList.forEach((m) => {
          row[m.nama_mapel] = '';
        });
        return row;
      });
      const ws = XLSXStyle.utils.json_to_sheet(rows, { header: headers });
      XLSXStyle.utils.book_append_sheet(wb, ws, 'RAPORT_S1-5');
      XLSXStyle.writeFile(
        wb,
        `TEMPLATE_RAPORT_S1-5_${kelas}_${tahunAjaran}.xlsx`
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
      } catch {
        Swal.fire({ icon: 'error', text: 'Gagal membaca file' });
      }
    };
    reader.readAsBinaryString(file);
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
            <div className="um__statLabel">Total Mapel</div>
          </div>
        </div>
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--green">
            <i className="bi bi-check2-circle" />
          </div>
          <div>
            <div className="um__statVal">{stats.progress}</div>
            <div className="um__statLabel">Nilai Terisi</div>
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
              {stats.below80} <span style={{ fontSize: '0.7rem' }}>/ KKM 80</span>
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

        <FilterActions>
          <Button
            size="md"
            variant="outline"
            icon="import"
            onClick={() => setShowImportRaportModal(true)}
          >
            Import Raport
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => setShowConfigModal(true)}
            leftIcon={<i className="bi bi-sliders" style={{ color: '#3b82f6' }} />}
          >
            Bobot Nilai
          </Button>
        </FilterActions>
      </FilterToolbar>

      {/* ── Matrix Table Content ─────────────────────────────────────── */}
      {loadingData ? (
        <div className="um__tableWrap" style={{ padding: '40px 0', textAlign: 'center' }}>
          <Spinner variant="trace" label="Memuat kalkulasi nilai ijazah..." />
        </div>
      ) : mapelList.length === 0 ? (
        <div className="um__tableWrap">
          <div className="um__empty">
            <i className="bi bi-book" />
            <p>Tidak ada mata pelajaran.</p>
          </div>
        </div>
      ) : filteredSiswa.length === 0 ? (
        <div className="um__tableWrap">
          <div className="um__empty">
            <i className="bi bi-inbox" />
            <p>Pilih kelas terlebih dahulu</p>
          </div>
        </div>
      ) : (
        <div className="um__tableWrap">
          <div className="um__tableScroll">
            <table className="um__table">
              <thead>
                <tr>
                  <th style={{ minWidth: 54, width: 54 }}>No</th>
                  <th style={{ minWidth: 260 }}>NAMA / NISN</th>
                  {mapelList.map((m) => (
                    <th key={m.id} style={{ minWidth: 240, maxWidth: 280 }}>
                      <div className="um__thMapel">{m.nama_mapel}</div>
                      <div className="um__thSubHeader">
                        <span>Raport</span>
                        <span>UM</span>
                        <span>Ijazah</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSiswa.map((s, idx) => {
                  const hasBelow80 = mapelList.some((m) => {
                    const ij = calculateIjazah(
                      s.nisn,
                      m.nama_mapel,
                      m.guru_nip
                    );
                    return ij !== '-' && parseFloat(ij) < 80;
                  });
                  return (
                    <tr
                      key={s.nisn}
                      className={hasBelow80 ? 'um__tr--warning' : ''}
                    >
                      <td className="um__cellNo">{idx + 1}</td>
                      <td className="um__cellInfo">
                        <div className="um__cellName">{s.nama_siswa}</div>
                        <div className="um__cellNisnSub">{s.nisn}</div>
                      </td>
                      {mapelList.map((m) => {
                        const rapVal = getRaportScore(s.nisn, m.nama_mapel);
                        const umVal = getScore(
                          s.nisn,
                          m.nama_mapel,
                          m.guru_nip
                        );
                        const ijazahVal = calculateIjazah(
                          s.nisn,
                          m.nama_mapel,
                          m.guru_nip
                        );
                        const isDanger =
                          ijazahVal !== '-' && parseFloat(ijazahVal) < 80;
                        return (
                          <td key={m.id} className="um__tdIjazah">
                            <div className="um__ijazahGrid">
                              <div className="um__ijazahVal um__ijazahVal--raport">
                                {rapVal ?? '-'}
                              </div>
                              <div className="um__ijazahVal um__ijazahVal--um">
                                {umVal || '-'}
                              </div>
                              <div
                                className={`um__ijazahVal um__ijazahVal--final ${
                                  isDanger ? 'um__score--danger' : ''
                                }`}
                              >
                                {ijazahVal}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
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
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--n-muted)',
                fontWeight: 600,
              }}
            >
              Bobot Aktif: Raport{' '}
              {Math.round(configData.bobot_raport * 100)}% + UM{' '}
              {Math.round(configData.bobot_ujian * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Modal Import Raport (Modal.tsx) ───────────────────────────── */}
      {showImportRaportModal && (
        <Modal
          open={showImportRaportModal}
          onClose={() => {
            setShowImportRaportModal(false);
            setImportFile(null);
            setImportPreview([]);
          }}
          size="lg"
          variant="add"
          icon="file-earmark-arrow-up"
          title="Import Nilai Raport (Semester 1 - 5)"
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
              onClick={handleExportRaportTemplate}
              disabled={mapelList.length === 0}
              leftIcon={<i className="bi bi-file-earmark-arrow-down" />}
            >
              Download Template
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="cancel"
                onClick={() => {
                  setShowImportRaportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleImportRaportConfirm}
                disabled={!importFile}
                leftIcon={<i className="bi bi-check2" />}
              >
                Import Nilai Raport
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* ── Modal Konfigurasi Bobot (Modal.tsx) ────────────────────────── */}
      {showConfigModal && (
        <Modal
          open={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          size="sm"
          variant="edit"
          icon="sliders"
          title="Pengaturan Bobot Ijazah"
          subtitle={`Tahun Ajaran ${tahunAjaran}`}
        >
          <ModalBody>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-muted)' }}>
                  Bobot Nilai Raport (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editBobotRaport}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditBobotRaport(val);
                    setEditBobotUjian(100 - val);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1.5px solid var(--n-border)',
                    background: 'var(--n-surface)',
                    color: 'var(--n-ink)',
                  }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-muted)' }}>
                  Bobot Nilai UM (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editBobotUjian}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditBobotUjian(val);
                    setEditBobotRaport(100 - val);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1.5px solid var(--n-border)',
                    background: 'var(--n-surface)',
                    color: 'var(--n-ink)',
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--n-muted)',
                  textAlign: 'center',
                }}
              >
                Total: <strong>{editBobotRaport + editBobotUjian}%</strong> (harus 100%)
              </div>
            </div>
          </ModalBody>

          <ModalFooter align="end">
            <Button
              variant="cancel"
              onClick={() => setShowConfigModal(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveConfig}
              leftIcon={<i className="bi bi-save" />}
            >
              Simpan Bobot
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
