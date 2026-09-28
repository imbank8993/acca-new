'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { formatDateTime } from '@/lib/timezone';
import { ApiResponse } from '@/lib/types';
import DatePicker from '@/components/ui/DatePicker';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { InlineSelect, InlineSelectOption } from '@/components/ui/InlineSelect';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

interface SiswaRow {
  nisn: string;
  nama_siswa: string;
  kelas: string;
}
interface KelulusanRow {
  nisn: string;
  status: string;
  nomor_ijazah: string | null;
  catatan: string | null;
  rata_um: number | null;
  rata_ijazah: number | null;
}

const STATUS_OPTIONS: InlineSelectOption[] = [
  { value: 'MENUNGGU', label: 'MENUNGGU' },
  { value: 'LULUS', label: 'LULUS' },
  { value: 'TIDAK_LULUS', label: 'TIDAK LULUS' },
];

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  LULUS: { label: 'LULUS', badge: 'kl-status-select--lulus' },
  TIDAK_LULUS: { label: 'TIDAK LULUS', badge: 'kl-status-select--tidak_lulus' },
  MENUNGGU: { label: 'MENUNGGU', badge: 'kl-status-select--menunggu' },
};

interface KelulusanTabProps {
  tahunAjaranList: string[];
  tahunAjaran: string;
  setTahunAjaran: (ta: string) => void;
}

export default function KelulusanTab({
  tahunAjaranList,
  tahunAjaran,
  setTahunAjaran,
}: KelulusanTabProps) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [kelasList, setKelasList] = useState<string[]>([]);
  const [kelas, setKelas] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [siswa, setSiswa] = useState<SiswaRow[]>([]);
  const [kelulusanData, setKelulusanData] = useState<KelulusanRow[]>([]);
  const [publishData, setPublishData] = useState<{
    tahun_ajaran: string;
    publish_at: string | null;
  } | null>(null);

  const [changes, setChanges] = useState<Record<string, string>>({});
  const [editPublish, setEditPublish] = useState(false);
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [publishDateFormatted, setPublishDateFormatted] = useState('');
  const [tzLabel, setTzLabel] = useState('WITA');

  useEffect(() => {
    const init = async () => {
      const userData = await getCurrentUser();
      if (!userData) return;
      setUser(userData);
      setIsAdmin(
        userData?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || !!(userData as any).isAdmin ||
          false
      );

      const { getTimezoneLabel } = await import('@/lib/timezone');
      const label = await getTimezoneLabel();
      setTzLabel(label);
    };
    init();
  }, []);

  useEffect(() => {
    if (kelasList.length > 0 && !kelas) {
      setKelas(kelasList[0]);
    }
  }, [kelasList]);

  const parsePublishDate = async (isoStr: string | null) => {
    if (!isoStr) return { date: '', time: '', formatted: '' };
    const tz = await getTimezone();
    const d = new Date(isoStr);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: tz });
    const timeStr = d.toLocaleTimeString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });
    const formatted = await formatDateTime(isoStr);
    return { date: dateStr, time: timeStr, formatted };
  };

  const getTimezone = async () => {
    const { getTimezone: getTz } = await import('@/lib/timezone');
    return getTz();
  };

  const loadInitialData = useCallback(async () => {
    if (!tahunAjaran) return;
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/kelulusan?tahun_ajaran=${encodeURIComponent(tahunAjaran)}`
      );
      const json: ApiResponse = await res.json();
      if (json.ok && json.data) {
        setSiswa(json.data.siswa || []);
        setKelulusanData(json.data.kelulusan || []);
        setPublishData(json.data.publish || null);

        const kelasSet = new Set<string>();
        (json.data.siswa || []).forEach((s: SiswaRow) => {
          if (s.kelas) kelasSet.add(s.kelas);
        });
        const newKelasList = Array.from(kelasSet).sort();
        setKelasList(newKelasList);

        if (newKelasList.length > 0) {
          setKelas((prev) => prev || newKelasList[0]);
        }

        if (json.data.publish?.publish_at) {
          const { date, time, formatted } = await parsePublishDate(
            json.data.publish.publish_at
          );
          setPublishDate(date);
          setPublishTime(time);
          setPublishDateFormatted(formatted);
        } else {
          setPublishDate('');
          setPublishTime('');
          setPublishDateFormatted('');
        }
        setChanges({});
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal memuat data',
        text: String(e),
      });
    } finally {
      setLoadingData(false);
    }
  }, [tahunAjaran]);

  const loadFilteredData = useCallback(async () => {
    if (!tahunAjaran || !kelas) return;
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/kelulusan?tahun_ajaran=${encodeURIComponent(
          tahunAjaran
        )}&kelas=${encodeURIComponent(kelas)}`
      );
      const json: ApiResponse = await res.json();
      if (json.ok && json.data) {
        setSiswa(json.data.siswa || []);
        setKelulusanData(json.data.kelulusan || []);
        setPublishData(json.data.publish || null);

        if (json.data.publish?.publish_at) {
          const { date, time, formatted } = await parsePublishDate(
            json.data.publish.publish_at
          );
          setPublishDate(date);
          setPublishTime(time);
          setPublishDateFormatted(formatted);
        } else {
          setPublishDate('');
          setPublishTime('');
          setPublishDateFormatted('');
        }
        setChanges({});
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal memuat data',
        text: String(e),
      });
    } finally {
      setLoadingData(false);
    }
  }, [tahunAjaran, kelas]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!kelas) return;
    loadFilteredData();
  }, [loadFilteredData]);

  const getRataUm = (nisn: string): number | null =>
    changes[`rata_um-${nisn}`] !== undefined
      ? parseFloat(changes[`rata_um-${nisn}`]) || null
      : kelulusanData.find((k) => k.nisn === nisn)?.rata_um ?? null;
  const getRataIjazah = (nisn: string): number | null =>
    changes[`rata_ijazah-${nisn}`] !== undefined
      ? parseFloat(changes[`rata_ijazah-${nisn}`]) || null
      : kelulusanData.find((k) => k.nisn === nisn)?.rata_ijazah ?? null;
  const getStatus = (nisn: string): string =>
    changes[`status-${nisn}`] !== undefined
      ? changes[`status-${nisn}`]
      : kelulusanData.find((k) => k.nisn === nisn)?.status || 'MENUNGGU';
  const handleChange = (nisn: string, field: string, val: string) =>
    setChanges((prev) => ({ ...prev, [`${field}-${nisn}`]: val }));
  const isChanged = (nisn: string, field: string): boolean => {
    const key = `${field}-${nisn}`;
    if (changes[key] === undefined) return false;
    const found = kelulusanData.find((k) => k.nisn === nisn);
    return changes[key] !== String(found?.[field as keyof KelulusanRow] || '');
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

  const pendingCount = Object.keys(changes).filter(
    (k) =>
      k.startsWith('status-') ||
      k.startsWith('rata_um-') ||
      k.startsWith('rata_ijazah-') ||
      k.startsWith('ijazah-') ||
      k.startsWith('catatan-')
  ).length;

  const stats = useMemo(() => {
    const c = { LULUS: 0, TIDAK_LULUS: 0, MENUNGGU: 0 };
    filteredSiswa.forEach((s) => c[getStatus(s.nisn) as keyof typeof c]++);
    return c;
  }, [filteredSiswa, changes, kelulusanData]);

  const handleSave = async () => {
    if (!user) return;
    const updates = filteredSiswa.map((s) => {
      const kl = kelulusanData.find((k) => k.nisn === s.nisn);
      const rata_um = changes[`rata_um-${s.nisn}`]
        ? parseFloat(changes[`rata_um-${s.nisn}`])
        : kl?.rata_um ?? null;
      const rata_ijazah = changes[`rata_ijazah-${s.nisn}`]
        ? parseFloat(changes[`rata_ijazah-${s.nisn}`])
        : kl?.rata_ijazah ?? null;
      return {
        nisn: s.nisn,
        status: changes[`status-${s.nisn}`] || kl?.status || 'MENUNGGU',
        rata_um,
        rata_ijazah,
      };
    });
    try {
      const res = await fetch('/api/kelulusan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          tahun_ajaran: tahunAjaran,
          nip: user.nip,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Data kelulusan ${updates.length} siswa disimpan.`,
      });
      setChanges({});
      loadFilteredData();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal menyimpan',
        text: err.message,
      });
    }
  };

  const handleBulkStatus = (status: 'LULUS' | 'TIDAK_LULUS') => {
    const newChanges = { ...changes };
    filteredSiswa.forEach((s) => {
      newChanges[`status-${s.nisn}`] = status;
    });
    setChanges(newChanges);
  };

  const localToISO = async (date: string, time: string): Promise<string> => {
    const tz = await getTimezone();
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    const fakeDate = new Date(year, month - 1, day, hour, minute);
    const offsetMs = fakeDate.getTimezoneOffset() * 60 * 1000;
    let tzOffsetMs: number;
    if (tz === 'Asia/Jakarta') tzOffsetMs = 7 * 60 * 60 * 1000;
    else if (tz === 'Asia/Makassar') tzOffsetMs = 8 * 60 * 60 * 1000;
    else tzOffsetMs = 9 * 60 * 60 * 1000;

    const utcMs = fakeDate.getTime() - offsetMs * 1000 + tzOffsetMs;
    return new Date(utcMs).toISOString();
  };

  const handleSavePublish = async () => {
    if (!publishDate || !publishTime) {
      Swal.fire({
        icon: 'warning',
        title: 'Lengkapi',
        text: 'Isi tanggal dan waktu publish.',
      });
      return;
    }
    const publishAt = await localToISO(publishDate, publishTime);
    setSaving(true);
    try {
      const res = await fetch('/api/kelulusan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahun_ajaran: tahunAjaran,
          publish_at: publishAt,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Jadwal publish diperbarui.',
      });
      setEditPublish(false);
      loadFilteredData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleClearPublish = async () => {
    try {
      const res = await fetch('/api/kelulusan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahun_ajaran: tahunAjaran,
          publish_at: null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Pengumuman dipublish sekarang.',
      });
      setPublishDate('');
      setPublishTime('');
      setEditPublish(false);
      loadFilteredData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  };

  const handleDownloadTemplate = async () => {
    if (!kelas) {
      Swal.fire({
        icon: 'warning',
        title: 'Pilih Kelas',
        text: 'Pilih kelas terlebih dahulu.',
      });
      return;
    }
    try {
      const res = await fetch(
        `/api/kelulusan?template=true&tahun_ajaran=${encodeURIComponent(
          tahunAjaran
        )}&kelas=${encodeURIComponent(kelas)}`
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([json.header, ...(json.body || [])]);
      XLSX.utils.book_append_sheet(wb, ws, 'Kelulusan');
      XLSX.writeFile(wb, `template-kelulusan-${kelas.replace(/\//g, '-')}.xlsx`);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Template berhasil diunduh.',
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  };

  const handleExport = async () => {
    if (!kelas) {
      Swal.fire({
        icon: 'warning',
        title: 'Pilih Kelas',
        text: 'Pilih kelas terlebih dahulu.',
      });
      return;
    }
    try {
      const res = await fetch(
        `/api/kelulusan?export=true&tahun_ajaran=${encodeURIComponent(
          tahunAjaran
        )}&kelas=${encodeURIComponent(kelas)}`
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([json.header, ...(json.rows || [])]);
      XLSX.utils.book_append_sheet(wb, ws, 'Kelulusan');
      XLSX.writeFile(
        wb,
        `kelulusan-${kelas.replace(/\//g, '-')}-${tahunAjaran.replace(
          /\//g,
          '-'
        )}.xlsx`
      );
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data berhasil diekspor.',
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  };

  const handleFileChange = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      Swal.fire({
        icon: 'error',
        title: 'Format Salah',
        text: 'Hanya file .xlsx atau .xls.',
      });
      return;
    }
    setImportFile(file);
  };

  const handleImport = async () => {
    if (!importFile) {
      Swal.fire({
        icon: 'warning',
        title: 'Pilih File',
        text: 'Pilih file Excel.',
      });
      return;
    }
    setImporting(true);
    try {
      const buffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) throw new Error('Template tidak memiliki data.');

      const res = await fetch('/api/kelulusan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahun_ajaran: tahunAjaran,
          header: Object.values(rows[0] as any).map(String),
          rows: rows.slice(1),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text:
          json.errors?.length > 0
            ? `${json.imported} data diimpor. ${json.errors.length} baris dilewati.`
            : `${json.imported} data berhasil diimpor.`,
      });
      setShowImportModal(false);
      setImportFile(null);
      loadFilteredData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="kl-wrapper">
      {/* ── 4 Stat Cards (1 Baris) ──────────────────────────────────── */}
      <div className="um__statsRow">
        {/* 1. Total */}
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--blue">
            <i className="bi bi-people-fill" />
          </div>
          <div>
            <div className="um__statVal">{filteredSiswa.length}</div>
            <div className="um__statLabel">Total Siswa</div>
          </div>
        </div>

        {/* 2. Menunggu */}
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--amber">
            <i className="bi bi-hourglass-split" />
          </div>
          <div>
            <div className="um__statVal">{stats.MENUNGGU}</div>
            <div className="um__statLabel">Menunggu</div>
          </div>
        </div>

        {/* 3. Lulus */}
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--green">
            <i className="bi bi-check-circle-fill" />
          </div>
          <div>
            <div className="um__statVal">{stats.LULUS}</div>
            <div className="um__statLabel">Lulus</div>
          </div>
        </div>

        {/* 4. Tidak Lulus */}
        <div className="um__statCard">
          <div className="um__statIcon um__statIcon--red">
            <i className="bi bi-x-circle-fill" />
          </div>
          <div>
            <div className="um__statVal">{stats.TIDAK_LULUS}</div>
            <div className="um__statLabel">Tidak Lulus</div>
          </div>
        </div>
      </div>

      {/* ── Status Jadwal & Aksi Eksternal ────────────────────────────── */}
      <div className="kl-actions">
        <div className="kl-actions__left">
          <div className="kl-actions__publish">
            <i className="bi bi-calendar-event-fill" />
            <span className="kl-actions__publishText">
              {publishData?.publish_at
                ? `Jadwal: ${publishDateFormatted}`
                : 'Sudah dipublikasikan'}
            </span>
          </div>
          <span
            className={`kl-badge ${
              publishData?.publish_at ? 'kl-badge--warn' : 'kl-badge--success'
            }`}
          >
            {publishData?.publish_at ? (
              <>
                <i className="bi bi-clock-fill" />
                Terjadwal
              </>
            ) : (
              <>
                <i className="bi bi-globe" />
                Published
              </>
            )}
          </span>
        </div>
        <div className="kl-actions__right" style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditPublish(true)}
            leftIcon={<i className="bi bi-calendar-event" style={{ color: '#6366f1' }} />}
          >
            Atur Jadwal
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon="import"
            onClick={() => setShowImportModal(true)}
          >
            Import
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon="export"
            onClick={handleExport}
            disabled={!kelas || loadingData}
          >
            Export
          </Button>
        </div>
      </div>

      {/* ── Filter Toolbar ───────────────────────────────────────────── */}
      <FilterToolbar>
        <FilterSelect
          label="Tahun Ajaran"
          icon="calendar3"
          value={tahunAjaran}
          onChange={setTahunAjaran}
          options={tahunAjaranList.map((ta) => ({ value: ta, label: ta }))}
        />
        <FilterSelect
          label="Kelas XII"
          icon="mortarboard"
          value={kelas}
          onChange={setKelas}
          options={[
            { value: '', label: '-- Pilih Kelas --' },
            ...kelasList.map((k) => ({ value: k, label: k })),
          ]}
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
            variant="activate"
            onClick={() => handleBulkStatus('LULUS')}
            disabled={loadingData || filteredSiswa.length === 0}
            leftIcon={<i className="bi bi-check-circle-fill" />}
          >
            Semua Lulus
          </Button>
          <Button
            size="md"
            variant="reset"
            onClick={() => handleBulkStatus('TIDAK_LULUS')}
            disabled={loadingData || filteredSiswa.length === 0}
            leftIcon={<i className="bi bi-x-circle-fill" />}
          >
            Tidak Lulus
          </Button>
          {pendingCount > 0 && (
            <Button
              size="md"
              variant="primary"
              icon="save"
              onClick={handleSave}
            >
              Simpan ({pendingCount})
            </Button>
          )}
        </FilterActions>
      </FilterToolbar>

      {/* ── Table & Cards Content ────────────────────────────────────── */}
      <div className="kl-tableWrap">
        <div className="kl-tableDesktop">
          <div className="overflow-x-auto rounded-xl border border-[var(--n-border)] shadow-sm bg-[var(--n-card)]">
            <table className="kl-table min-w-[700px]">
              <thead>
                <tr>
                  <th className="kl-th kl-th--num">#</th>
                  <th className="kl-th kl-th--nisn">NISN</th>
                  <th className="kl-th kl-th--nama">Nama Siswa</th>
                  <th className="kl-th kl-th--center">Status</th>
                  <th className="kl-th kl-th--center">Rata2 UM</th>
                  <th className="kl-th kl-th--center">Rata2 Ijazah</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Spinner variant="buble" label="Memuat data kelulusan..." />
                    </td>
                  </tr>
                ) : filteredSiswa.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="kl-td kl-td--center">
                      <div className="flex flex-col items-center gap-2 py-8">
                        <i className="bi bi-inbox text-4xl text-gray-300 dark:text-gray-600" />
                        <p className="text-gray-400 dark:text-gray-500 text-sm">
                          {kelas
                            ? 'Tidak ada data siswa.'
                            : 'Pilih kelas terlebih dahulu.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSiswa.map((s, i) => {
                    const currStatus =
                      changes[`status-${s.nisn}`] ?? getStatus(s.nisn);
                    const cfg =
                      STATUS_CONFIG[currStatus] || STATUS_CONFIG.MENUNGGU;
                    const rataUm = getRataUm(s.nisn);
                    const rataIj = getRataIjazah(s.nisn);
                    const isDirty =
                      isChanged(s.nisn, 'status') ||
                      isChanged(s.nisn, 'rata_um') ||
                      isChanged(s.nisn, 'rata_ijazah');

                    return (
                      <tr
                        key={s.nisn}
                        className={`kl-tr ${isDirty ? 'kl-tr--dirty' : ''}`}
                      >
                        <td className="kl-td kl-td--num">{i + 1}</td>
                        <td className="kl-td kl-td--nisn">{s.nisn}</td>
                        <td className="kl-td kl-td--nama">{s.nama_siswa}</td>
                        <td className="kl-td kl-td--center">
                          <InlineSelect
                            value={currStatus}
                            onChange={(val) =>
                              handleChange(s.nisn, 'status', val)
                            }
                            options={STATUS_OPTIONS}
                            className={`kl-status-select ${cfg.badge}`}
                            height="28px"
                            minWidth="120px"
                          />
                        </td>
                        <td className="kl-td kl-td--center kl-td--blue">
                          <input
                            type="number"
                            step="0.01"
                            value={
                              changes[`rata_um-${s.nisn}`] ??
                              (rataUm !== null ? rataUm : '')
                            }
                            onChange={(e) =>
                              handleChange(s.nisn, 'rata_um', e.target.value)
                            }
                            placeholder="-"
                            className="kl-inputTable text-center font-mono w-full"
                          />
                        </td>
                        <td className="kl-td kl-td--center kl-td--blue">
                          <input
                            type="number"
                            step="0.01"
                            value={
                              changes[`rata_ijazah-${s.nisn}`] ??
                              (rataIj !== null ? rataIj : '')
                            }
                            onChange={(e) =>
                              handleChange(s.nisn, 'rata_ijazah', e.target.value)
                            }
                            placeholder="-"
                            className="kl-inputTable text-center font-mono w-full"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE CARDS */}
        <div className="kl-cards">
          {loadingData ? (
            <div className="kl-card kl-card--empty" style={{ padding: '30px 0', textAlign: 'center' }}>
              <Spinner variant="buble" label="Memuat data..." />
            </div>
          ) : filteredSiswa.length === 0 ? (
            <div className="kl-card kl-card--empty">
              <i className="bi bi-inbox text-4xl text-gray-300" />
              <p className="text-gray-400 text-sm">
                {kelas
                  ? 'Tidak ada data siswa.'
                  : 'Pilih kelas terlebih dahulu.'}
              </p>
            </div>
          ) : (
            filteredSiswa.map((s, i) => {
              const currStatus =
                changes[`status-${s.nisn}`] ?? getStatus(s.nisn);
              const cfg = STATUS_CONFIG[currStatus] || STATUS_CONFIG.MENUNGGU;
              const rataUm = getRataUm(s.nisn);
              const rataIj = getRataIjazah(s.nisn);
              const isDirty =
                isChanged(s.nisn, 'status') ||
                isChanged(s.nisn, 'rata_um') ||
                isChanged(s.nisn, 'rata_ijazah');

              return (
                <div
                  key={s.nisn}
                  className={`kl-card ${isDirty ? 'kl-card--dirty' : ''}`}
                >
                  <div className="kl-card__header">
                    <div className="kl-card__id">
                      <span className="kl-card__num">#{i + 1}</span>
                      <span className="kl-card__nisn">{s.nisn}</span>
                    </div>
                    <InlineSelect
                      value={currStatus}
                      onChange={(val) =>
                        handleChange(s.nisn, 'status', val)
                      }
                      options={STATUS_OPTIONS}
                      className={`kl-status-select ${cfg.badge}`}
                      height="28px"
                      minWidth="110px"
                    />
                  </div>
                  <div className="kl-card__name">{s.nama_siswa}</div>
                  <div className="kl-card__vals">
                    <div className="kl-card__val">
                      <span className="kl-card__valLbl">Rata2 UM</span>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          changes[`rata_um-${s.nisn}`] ??
                          (rataUm !== null ? rataUm : '')
                        }
                        onChange={(e) =>
                          handleChange(s.nisn, 'rata_um', e.target.value)
                        }
                        placeholder="-"
                        className="kl-inputTable text-center font-mono w-full"
                      />
                    </div>
                    <div className="kl-card__val">
                      <span className="kl-card__valLbl">Rata2 Ijazah</span>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          changes[`rata_ijazah-${s.nisn}`] ??
                          (rataIj !== null ? rataIj : '')
                        }
                        onChange={(e) =>
                          handleChange(s.nisn, 'rata_ijazah', e.target.value)
                        }
                        placeholder="-"
                        className="kl-inputTable text-center font-mono w-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="kl-footer">Nilai Rata2 UM dan Ijazah diinput manual</p>

      {/* ── Modal Import Excel (Modal.tsx) ────────────────────────────── */}
      {showImportModal && (
        <Modal
          open={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
          }}
          size="md"
          variant="add"
          icon="file-earmark-arrow-up"
          title="Import Data Kelulusan"
          subtitle="Unggah berkas Excel data kelulusan kelas XII"
        >
          <ModalBody>
            <div style={{ marginBottom: 14 }}>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={!kelas}
                leftIcon={<i className="bi bi-file-earmark-arrow-down" />}
                className="w-full justify-start"
              >
                <div>
                  <div style={{ fontWeight: 700 }}>Download Template Excel</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                    Unduh format Excel khusus kelas {kelas || 'terpilih'}
                  </div>
                </div>
              </Button>
            </div>

            <div
              className="kl-dropzone"
              style={{
                borderColor: isDragOver
                  ? 'var(--n-primary)'
                  : 'var(--n-border)',
                background: isDragOver
                  ? 'rgba(0,56,168,0.04)'
                  : 'var(--n-surface)',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileChange(f);
              }}
            >
              <i
                className="bi bi-cloud-arrow-up"
                style={{
                  fontSize: '2.2rem',
                  color: 'var(--n-primary)',
                  marginBottom: '10px',
                }}
              />
              <p
                style={{
                  color: 'var(--n-muted)',
                  fontSize: '0.82rem',
                  marginBottom: '12px',
                }}
              >
                Seret file Excel ke sini, atau
              </p>
              <label className="kl-uploadBtn">
                <i className="bi bi-folder2-open" />
                Pilih File
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />
              </label>
            </div>

            {importFile && (
              <div className="kl-fileCard" style={{ marginTop: 12 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(22,163,74,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i
                    className="bi bi-file-earmark-excel-fill"
                    style={{ fontSize: '1.3rem', color: '#16a34a' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      color: 'var(--n-ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {importFile.name}
                  </p>
                  <p
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--n-muted)',
                      marginTop: '2px',
                    }}
                  >
                    {(importFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportFile(null)}
                  className="kl-removeBtn"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            )}

            <div className="kl-hint" style={{ marginTop: 12 }}>
              <i
                className="bi bi-info-circle"
                style={{
                  fontSize: '0.8rem',
                  marginRight: '6px',
                  color: 'rgba(245,158,11,0.8)',
                }}
              />
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--n-muted)',
                  lineHeight: 1.5,
                }}
              >
                Edit kolom <strong>status</strong> dan <strong>nilai</strong>{' '}
                sesuai data kelas XII.
              </span>
            </div>
          </ModalBody>

          <ModalFooter align="end">
            <Button
              variant="cancel"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
              disabled={importing}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              isLoading={importing}
              disabled={!importFile}
              leftIcon={<i className="bi bi-upload" />}
            >
              Import Data
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── Modal Atur Jadwal Publish (Modal.tsx) ──────────────────────── */}
      {editPublish && (
        <Modal
          open={editPublish}
          onClose={() => setEditPublish(false)}
          size="sm"
          variant="default"
          icon="calendar-event"
          title="Jadwal Pengumuman Kelulusan"
          subtitle={`Atur tanggal & jam kelulusan kelas XII (${tzLabel})`}
        >
          <ModalBody>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-muted)' }}>
                  Tanggal Pengumuman
                </label>
                <DatePicker
                  value={publishDate}
                  onChange={setPublishDate}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-muted)' }}>
                  Waktu ({tzLabel})
                </label>
                <input
                  type="time"
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1.5px solid var(--n-border)',
                    background: 'var(--n-surface)',
                    color: 'var(--n-ink)',
                  }}
                />
              </div>
            </div>
          </ModalBody>

          <ModalFooter align="between">
            <Button
              variant="outline"
              onClick={handleClearPublish}
              disabled={saving}
              leftIcon={<i className="bi bi-globe" />}
            >
              Publish Sekarang
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="cancel"
                onClick={() => setEditPublish(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePublish}
                isLoading={saving}
                leftIcon={<i className="bi bi-check2" />}
              >
                Simpan Jadwal
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}