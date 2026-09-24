'use client';

import MaintenanceBanner from '@/components/MaintenanceBanner';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import Tab from '@/components/ui/Tab';
import { useState, useEffect, useCallback, useMemo } from 'react';
import './izin-guru.css';
import Swal from 'sweetalert2';
import AddIzinModal from './components/AddIzinModal';
import AddDinasLuarModal from './components/AddDinasLuarModal';
import ApprovalModal from './components/ApprovalModal';
import EditIzinModal from './components/EditIzinModal';
import DetailIzinModal from './components/DetailIzinModal';
import TabSemuaIzin, { IzinRow } from './tabs/TabSemuaIzin';
import PilihJenisModal from './components/PilihJenisModal';

function IzinGuruPage() {
  const [rows, setRows]             = useState<IzinRow[]>([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [filterJenis, setFilterJenis]   = useState('');
  const [viewMode, setViewMode]         = useState<'all' | 'personal'>('all');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBulan, setFilterBulan]   = useState(() => {
    const m = new Date().getMonth() + 1;
    return m.toString();
  });
  const [filterTahun, setFilterTahun]   = useState(() => new Date().getFullYear().toString());
  const [search, setSearch]             = useState('');

  // Modals
  const [isAddIzinOpen, setIsAddIzinOpen]       = useState(false);
  const [isAddDinasOpen, setIsAddDinasOpen]     = useState(false);
  const [isPilihJenisOpen, setIsPilihJenisOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen]     = useState(false);
  const [approvalRow, setApprovalRow]           = useState<IzinRow | null>(null);
  const [isEditOpen, setIsEditOpen]             = useState(false);
  const [editRow, setEditRow]                   = useState<IzinRow | null>(null);
  const [isDetailOpen, setIsDetailOpen]         = useState(false);
  const [detailRow, setDetailRow]               = useState<IzinRow | null>(null);

  // Wewenang dari Hak Akses Fitur, dikirim backend bersama data.
  // Bawaannya semua false — gagal-tertutup selagi belum termuat.
  const [akses, setAkses] = useState({
    kelola: false,
    setujuiIzinSakit: false,
    verifikasiDinas: false,
  });

  // Identitas pemakai. `userRoles` dihapus: wewenang di halaman ini tidak lagi
  // disimpulkan dari daftar peran di sisi klien.
  const [userNip, setUserNip]       = useState('');
  const [userName, setUserName]     = useState('');
  const [authDone, setAuthDone]     = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Sesi sekarang berupa cookie JWT aplikasi, bukan sesi Supabase, jadi
        // identitas diambil langsung dari /api/auth/me (cookie ikut otomatis).
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();

        if (meData.ok && meData.user) {
          setUserNip(meData.user.nip || '');
          setUserName(meData.user.nama_lengkap || meData.user.nama || 'Guru');
        }
      } catch (e) {
        console.error('Auth error:', e);
      } finally {
        setAuthDone(true);
      }
    })();
  }, []);

  // Ajuan `pending` yang tanggalnya di luar bulan/tahun yang sedang dipilih.
  const pendingLuarPeriode = useMemo(() => {
    if (!filterTahun) return [];
    const awal = filterBulan
      ? `${filterTahun}-${filterBulan.padStart(2, '0')}-01`
      : `${filterTahun}-01-01`;
    const akhir = filterBulan
      ? `${filterTahun}-${filterBulan.padStart(2, '0')}-${new Date(+filterTahun, +filterBulan, 0).getDate()}`
      : `${filterTahun}-12-31`;

    return rows.filter(r => {
      if (r.status !== 'pending' || !r.tanggal_mulai) return false;
      const mulai = String(r.tanggal_mulai).slice(0, 10);
      const selesai = String(r.tanggal_selesai || r.tanggal_mulai).slice(0, 10);
      return selesai < awal || mulai > akhir;
    });
  }, [rows, filterBulan, filterTahun]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!authDone) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterJenis)   params.set('jenis', filterJenis);
      if (filterStatus)  params.set('status', filterStatus);
      if (filterBulan)   params.set('bulan', filterBulan);
      if (filterTahun)   params.set('tahun', filterTahun);
      if (search)        params.set('q', search);
      
      if (viewMode === 'personal') {
        params.set('view_mode', 'personal');
      }

      const res = await fetch(`/api/izin-guru?${params}`);
      const json = await res.json();
      if (json.ok) {
        setRows(json.data || []);
        // Wewenang hanya diperbarui saat permintaan benar-benar berhasil.
        // Kalau gagal, nilai sebelumnya dipertahankan dan tidak pernah
        // "dianggap kosong lalu dipakai" — pola yang sudah beberapa kali
        // menjadi sumber bug di layar lain.
        if (json.akses) setAkses(json.akses);
      } else {
        setRows([]);
      }
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterJenis, filterStatus, filterBulan, filterTahun, search, viewMode, authDone]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  /**
   * Wewenang datang dari backend, bukan dihitung dari daftar peran di sini.
   *
   * Sebelumnya layar ini menyimpulkan sendiri `isKamad || isFullAccess` dari
   * role, sementara API menegakkan daftar perannya sendiri — dua sumber yang bisa
   * menyimpang. Sekarang keduanya membaca Hak Akses Fitur yang sama, dan
   * `/api/izin-guru` mengirimkan hasilnya bersama data.
   *
   * Nilai awalnya semua `false` supaya gagal-tertutup: selama data belum termuat
   * atau permintaannya gagal, tidak ada tombol wewenang yang muncul.
   */
  const isFullAccess   = akses.kelola;
  const canApproveIzin = akses.setujuiIzinSakit;
  const canVerifyDinas = akses.verifikasiDinas;

  // Mengajukan izin untuk diri sendiri adalah hak setiap pegawai — backend
  // menjaganya dengan PegawaiGuard, jadi tidak perlu disaring ulang per peran.
  const canAddIzinSakit = true;
  const canAddDinas    = true;

  const isGuruOnly  = !canApproveIzin && !canVerifyDinas && !isFullAccess;
  const hasDualRole = !isGuruOnly;

  // Hanya berhak satu jenis: langsung buka formulirnya, tanpa memaksa memilih
  // dari daftar yang isinya cuma satu.
  const handleAjukan = () => {
    if (canAddIzinSakit && !canAddDinas) {
      setIsAddIzinOpen(true);
      return;
    }
    if (!canAddIzinSakit && canAddDinas) {
      setIsAddDinasOpen(true);
      return;
    }
    if (canAddIzinSakit && canAddDinas) {
      setIsPilihJenisOpen(true);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengajuan?',
      text: 'Data yang dihapus tidak bisa dikembalikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/izin-guru/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        await Swal.fire({ title: 'Dihapus', text: 'Pengajuan berhasil dihapus.', icon: 'success', timer: 1500, showConfirmButton: false });
        loadData();
      } else {
        Swal.fire({ title: 'Gagal', text: json.error || 'Terjadi kesalahan', icon: 'error', confirmButtonColor: '#3083FF' });
      }
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message, icon: 'error', confirmButtonColor: '#3083FF' });
    }
  };

  // ── Open approval modal ─────────────────────────────────────────────────────
  const openApproval = (row: IzinRow) => {
    const isDinas = row.jenis === 'dinas_luar';
    if (isDinas) {
      if (canVerifyDinas) {
        setApprovalRow(row);
        setIsApprovalOpen(true);
      } else {
        Swal.fire({ title: 'Akses Ditolak', text: 'Hanya OP_IZINGURU / Admin yang dapat memverifikasi Dinas Luar.', icon: 'warning', confirmButtonColor: '#3083FF' });
      }
    } else {
      if (canApproveIzin) {
        setApprovalRow(row);
        setIsApprovalOpen(true);
      } else {
        Swal.fire({ title: 'Akses Ditolak', text: 'Hanya KAMAD yang dapat menyetujui Izin / Sakit.', icon: 'warning', confirmButtonColor: '#3083FF' });
      }
    }
  };

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const openEdit = (row: IzinRow) => {
    setEditRow(row);
    setIsEditOpen(true);
  };

  // ── Open detail modal ───────────────────────────────────────────────────────
  const openDetail = (row: IzinRow) => {
    setDetailRow(row);
    setIsDetailOpen(true);
  };

  // ── Options ────────────────────────────────────────────────────────────────
  const BULAN = [
    { v: '',   l: 'Semua Bulan' },
    { v: '1',  l: 'Januari' },
    { v: '2',  l: 'Februari' },
    { v: '3',  l: 'Maret' },
    { v: '4',  l: 'April' },
    { v: '5',  l: 'Mei' },
    { v: '6',  l: 'Juni' },
    { v: '7',  l: 'Juli' },
    { v: '8',  l: 'Agustus' },
    { v: '9',  l: 'September' },
    { v: '10', l: 'Oktober' },
    { v: '11', l: 'November' },
    { v: '12', l: 'Desember' },
  ];

  const STATUS_OPTS = [
    { v: '',          l: 'Semua Status' },
    { v: 'pending',   l: 'Menunggu' },
    { v: 'disetujui', l: 'Disetujui' },
    { v: 'ditolak',   l: 'Ditolak' },
  ];

  return (
    <div className="ig-wrap">

      {/* ── PageBanner ──────────────────────────────────────────────────── */}
      

      {/* Aksi utama halaman (Ajukan): FAB melayang di desktop, sedangkan di mobile
          mengambil alih tombol tengah bottom nav. MobileFab tidak menggambar apa
          pun, hanya mendaftarkan aksinya. */}
      {(canAddIzinSakit || canAddDinas) && (
        <>
          <DesktopFab label="Ajukan" icon="plus-lg" onClick={handleAjukan} />
          <MobileFab label="Ajukan" icon="plus-lg" onClick={handleAjukan} />
        </>
      )}

      {/* ── Tab Navigation (Jika memiliki akses ganda / manajerial) ──────── */}
      {(hasDualRole || isFullAccess || canApproveIzin) && (
        <Tab
          tabs={[
            { key: 'all', label: 'Semua Pengajuan', icon: 'bi-grid-fill' },
            { key: 'personal', label: 'Pengajuan Saya', icon: 'bi-person-badge-fill' },
          ]}
          activeTab={viewMode}
          onChange={(key) => setViewMode(key as 'all' | 'personal')}
          ariaLabel="Navigasi Izin Guru"
        />
      )}

      {/* ── Filter Toolbar ──────────────────────────────────────────────── */}
      <FilterToolbar>
        <FilterSearch
          label="Pencarian"
          placeholder="Cari nama / NIP / instansi..."
          value={search}
          onChange={setSearch}
          grow={2}
        />

        <FilterSelect
          label="Jenis"
          icon="file-earmark-text"
          value={filterJenis}
          onChange={setFilterJenis}
          options={[
            { value: '', label: 'Semua Jenis' },
            { value: 'izin', label: 'Izin' },
            { value: 'sakit', label: 'Sakit' },
            { value: 'dinas_luar', label: 'Dinas Luar' },
          ]}
        />

        <FilterSelect
          label="Bulan"
          icon="calendar-month"
          value={filterBulan}
          onChange={setFilterBulan}
          options={BULAN.map(b => ({ value: b.v, label: b.l }))}
        />

        <FilterSelect
          label="Tahun"
          icon="calendar3"
          value={filterTahun}
          onChange={setFilterTahun}
          options={[
            { value: '', label: 'Semua Tahun' },
            ...Array.from({ length: 5 }, (_, i) => {
              const yr = (new Date().getFullYear() - 2 + i).toString();
              return { value: yr, label: yr };
            })
          ]}
        />

        <FilterSelect
          label="Status"
          icon="check2-circle"
          value={filterStatus}
          onChange={setFilterStatus}
          options={STATUS_OPTS.map(s => ({ value: s.v, label: s.l }))}
        />

      </FilterToolbar>

      {/* ── Role info banner ────────────────────────────────────────────── */}
      {(canApproveIzin || canVerifyDinas || isFullAccess) && viewMode === 'all' && (
        <div className="ig-info-alert">
          <i className="bi bi-info-circle-fill" style={{ flexShrink: 0 }} />
          <span>
            <strong>Info: </strong>
            {canApproveIzin && !isFullAccess && 'Anda dapat menyetujui pengajuan Izin & Sakit. '}
            {canVerifyDinas && !isFullAccess && 'Anda dapat memverifikasi pengajuan Dinas Luar. '}
            {isFullAccess && 'Anda memiliki akses penuh ke semua pengajuan. '}
          </span>
        </div>
      )}

      {/* Ajuan tertunda dari periode lain sengaja tetap ditampilkan */}
      {pendingLuarPeriode.length > 0 && (
        <div className="ig-info-alert">
          <i className="bi bi-clock-history" style={{ flexShrink: 0 }} />
          <span>
            <strong>{pendingLuarPeriode.length} pengajuan</strong> masih menunggu keputusan dari
            periode lain{' '}
            ({pendingLuarPeriode
              .map(r => new Date(r.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }))
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(', ')}
            ) — ikut ditampilkan di urutan teratas agar tidak terlewat.
          </span>
        </div>
      )}

      {/* ── Table Content ─────────────────────────────────────────────────── */}
      <TabSemuaIzin
        rows={rows}
        loading={loading}
        onView={openDetail}
        onDelete={handleDelete}
        onEdit={openEdit}
        onApprove={openApproval}
      />

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <DetailIzinModal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setDetailRow(null); }}
        row={detailRow}
        onEdit={openEdit}
        onApprove={openApproval}
        onDelete={handleDelete}
      />

      <PilihJenisModal
        isOpen={isPilihJenisOpen}
        onClose={() => setIsPilihJenisOpen(false)}
        onPickIzin={() => { setIsPilihJenisOpen(false); setIsAddIzinOpen(true); }}
        onPickDinas={() => { setIsPilihJenisOpen(false); setIsAddDinasOpen(true); }}
      />

      <AddIzinModal
        isOpen={isAddIzinOpen}
        onClose={() => setIsAddIzinOpen(false)}
        onSuccess={() => { setIsAddIzinOpen(false); loadData(); }}
      />

      <AddDinasLuarModal
        isOpen={isAddDinasOpen}
        onClose={() => setIsAddDinasOpen(false)}
        onSuccess={() => { setIsAddDinasOpen(false); loadData(); }}
      />

      <ApprovalModal
        isOpen={isApprovalOpen}
        onClose={() => { setIsApprovalOpen(false); setApprovalRow(null); }}
        onSuccess={() => { setIsApprovalOpen(false); setApprovalRow(null); loadData(); }}
        row={approvalRow}
      />

      <EditIzinModal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditRow(null); }}
        onSuccess={() => { setIsEditOpen(false); setEditRow(null); loadData(); }}
        row={editRow}
      />

    </div>
  );
}

// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedIzinGuruPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_izin_guru" />
            <IzinGuruPage {...props} />
        </>
    );
}
