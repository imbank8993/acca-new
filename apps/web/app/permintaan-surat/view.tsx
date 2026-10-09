'use client';

import MaintenanceBanner from '@/components/MaintenanceBanner';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import Tab from '@/components/ui/Tab';
import { useState, useEffect, useCallback, useMemo } from 'react';
import './permintaan-surat.css';
import Swal from 'sweetalert2';
import AddPermintaanModal, { JenisSuratConfig } from './components/AddPermintaanModal';
import DetailPermintaanModal, { PermintaanSuratRow } from './components/DetailPermintaanModal';
import ApprovalModal from './components/ApprovalModal';
import EditPermintaanModal from './components/EditPermintaanModal';
import TabSemuaPermintaan from './tabs/TabSemuaPermintaan';
import TabPengaturanSurat from './tabs/TabPengaturanSurat';

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

function PermintaanSuratPageContent({ user }: { user?: any }) {
  const [rows, setRows]         = useState<PermintaanSuratRow[]>([]);
  const [loading, setLoading]   = useState(true);

  // Filters
  const [filterJenis, setFilterJenis]   = useState('');
  const [viewMode, setViewMode]         = useState<'all' | 'personal' | 'pengaturan'>('all');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBulan, setFilterBulan]   = useState(() => {
    const m = new Date().getMonth() + 1;
    return m.toString();
  });
  const [filterTahun, setFilterTahun]   = useState(() => new Date().getFullYear().toString());
  const [search, setSearch]             = useState('');

  // Pengaturan jenis surat
  const [pengaturanList, setPengaturanList] = useState<JenisSuratConfig[]>([]);

  // Modals
  const [isAddOpen, setIsAddOpen]           = useState(false);
  const [isDetailOpen, setIsDetailOpen]     = useState(false);
  const [detailRow, setDetailRow]           = useState<PermintaanSuratRow | null>(null);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [approvalRow, setApprovalRow]       = useState<PermintaanSuratRow | null>(null);
  const [isEditOpen, setIsEditOpen]         = useState(false);
  const [editRow, setEditRow]               = useState<PermintaanSuratRow | null>(null);

  // Wewenang & Identitas
  const [akses, setAkses] = useState({
    kelola: false,
    canApprove: false,
    canAdd: true,
    canManageSettings: false,
    roles: [] as string[],
  });

  const [userRoles, setUserRoles] = useState<string[]>(
    user?.roles || (user?.role ? String(user.role).split(/[,|]/).map((r: string) => r.trim().toUpperCase()) : [])
  );
  const [userNip, setUserNip]   = useState(user?.nip || '');
  const [userName, setUserName] = useState(user?.nama_lengkap || user?.nama || '');
  const [authDone, setAuthDone] = useState(Boolean(user));

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setUserNip(user.nip || '');
      setUserName(user.nama_lengkap || user.nama || '');
      const r = user.roles || (user.role ? String(user.role).split(/[,|]/).map((x: string) => x.trim().toUpperCase()) : []);
      setUserRoles(r);
      setAuthDone(true);
      return;
    }

    (async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.ok && meData.user) {
          setUserNip(meData.user.nip || '');
          setUserName(meData.user.nama_lengkap || meData.user.nama || '');
          const r = meData.user.roles || (meData.user.role ? String(meData.user.role).split(/[,|]/).map((x: string) => x.trim().toUpperCase()) : []);
          setUserRoles(r);
        }
      } catch (e) {
        console.error('Auth error:', e);
      } finally {
        setAuthDone(true);
      }
    })();
  }, [user]);

  // Ajuan pending di luar periode bulan/tahun yang dipilih
  const pendingLuarPeriode = useMemo(() => {
    if (!filterTahun) return [];
    const awal = filterBulan
      ? `${filterTahun}-${filterBulan.padStart(2, '0')}-01`
      : `${filterTahun}-01-01`;
    const akhir = filterBulan
      ? `${filterTahun}-${filterBulan.padStart(2, '0')}-${new Date(+filterTahun, +filterBulan, 0).getDate()}`
      : `${filterTahun}-12-31`;

    return rows.filter((r) => {
      const s = (r.status || '').toLowerCase();
      if (s !== 'pending' && s !== 'menunggu') return false;
      if (!r.created_at) return false;
      const tgl = String(r.created_at).slice(0, 10);
      return tgl < awal || tgl > akhir;
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

      const res = await fetch(`/api/permintaan-surat?${params}`);
      const json = await res.json();
      if (json.ok) {
        setRows(json.data || []);
        if (json.akses) setAkses(json.akses);
      } else {
        setRows([]);
      }
    } catch (e) {
      console.error('Error loading permintaan-surat:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterJenis, filterStatus, filterBulan, filterTahun, search, viewMode, authDone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Pengaturan Alur / Jenis Surat ──────────────────────────────────────────
  const loadPengaturanList = useCallback(async () => {
    try {
      const res = await fetch('/api/permintaan-surat/pengaturan');
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setPengaturanList(json.data);
      }
    } catch (e) {
      console.error('Error fetching pengaturan surat in view:', e);
    }
  }, []);

  useEffect(() => {
    loadPengaturanList();
  }, [loadPengaturanList]);

  // Options jenis surat untuk FilterToolbar (diambil dari pengaturan & baris data)
  const jenisFilterOptions = useMemo(() => {
    const options = [{ value: '', label: 'Semua Jenis' }];
    const seen = new Set<string>();

    pengaturanList.forEach((cfg) => {
      if (cfg.nama && !seen.has(cfg.nama)) {
        seen.add(cfg.nama);
        options.push({ value: cfg.nama, label: cfg.nama });
      }
    });

    rows.forEach((r) => {
      if (r.jenis_surat && !seen.has(r.jenis_surat)) {
        seen.add(r.jenis_surat);
        options.push({ value: r.jenis_surat, label: r.jenis_surat });
      }
    });

    return options;
  }, [pengaturanList, rows]);

  const isOperatorOrAdmin = useMemo(() => {
    const combinedRoles = [...userRoles, ...(akses.roles || [])];
    return (
      Boolean(akses.canManageSettings) ||
      Boolean(akses.kelola) ||
      combinedRoles.some((r) =>
        ['ADMIN', 'ADMINISTRATOR', 'OP_LAYANAN', 'KAMAD'].includes(r.toUpperCase())
      )
    );
  }, [userRoles, akses]);

  const isFullAccess = Boolean(akses.kelola || akses.canApprove || isOperatorOrAdmin);
  const hasDualRole  = isFullAccess;

  const tabsList = useMemo(() => {
    const list = [
      { key: 'all', label: 'Semua Permintaan', icon: 'bi-grid-fill' },
      { key: 'personal', label: 'Permintaan Saya', icon: 'bi-person-badge-fill' },
    ];
    if (isOperatorOrAdmin) {
      list.push({ key: 'pengaturan', label: 'Pengaturan', icon: 'bi-gear-fill' });
    }
    return list;
  }, [isOperatorOrAdmin]);

  // Fallback jika tab pengaturan aktif tetapi user bukan operator/admin
  useEffect(() => {
    if (viewMode === 'pengaturan' && !isOperatorOrAdmin && authDone) {
      setViewMode('all');
    }
  }, [viewMode, isOperatorOrAdmin, authDone]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAjukan = () => {
    setIsAddOpen(true);
  };

  const openDetail = (row: PermintaanSuratRow) => {
    setDetailRow(row);
    setIsDetailOpen(true);
  };

  const openEdit = (row: PermintaanSuratRow) => {
    setEditRow(row);
    setIsEditOpen(true);
  };

  const openApproval = (row: PermintaanSuratRow) => {
    if (!akses.canApprove && !isOperatorOrAdmin) {
      Swal.fire({
        title: 'Akses Ditolak',
        text: 'Hanya Admin, Operator Layanan, atau Pihak Berwenang yang dapat meninjau permohonan surat.',
        icon: 'warning',
        confirmButtonColor: '#3083FF',
      });
      return;
    }
    setApprovalRow(row);
    setIsApprovalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Batalkan Pengajuan?',
      text: 'Permohonan surat yang dibatalkan / dihapus tidak dapat dikembalikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Batalkan',
      cancelButtonText: 'Kembali',
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/permintaan-surat/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        await Swal.fire({
          title: 'Dibatalkan',
          text: 'Permohonan surat berhasil dihapus.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
        loadData();
      } else {
        Swal.fire({
          title: 'Gagal',
          text: json.error || 'Terjadi kesalahan saat membatalkan permohonan',
          icon: 'error',
          confirmButtonColor: '#3083FF',
        });
      }
    } catch (e: any) {
      Swal.fire({
        title: 'Error',
        text: e.message,
        icon: 'error',
        confirmButtonColor: '#3083FF',
      });
    }
  };

  return (
    <div className="ps-wrap">
      {/* Tombol Ajukan (Floating Desktop + Mobile) */}
      <DesktopFab label="Ajukan Surat" icon="plus-lg" onClick={handleAjukan} />
      <MobileFab label="Ajukan" icon="plus-lg" onClick={handleAjukan} />

      {/* Navigasi Tab (jika memiliki hak akses manajerial) */}
      {hasDualRole && (
        <Tab
          tabs={tabsList}
          activeTab={viewMode}
          onChange={(key) => setViewMode(key as 'all' | 'personal' | 'pengaturan')}
          ariaLabel="Navigasi Permintaan Surat"
        />
      )}

      {viewMode === 'pengaturan' ? (
        <TabPengaturanSurat onSaved={loadPengaturanList} />
      ) : (
        <>
          {/* Toolbar Filter & Pencarian */}
          <FilterToolbar>
            <FilterSearch
              label="Pencarian"
              placeholder="Cari nomor / judul / keperluan / pemohon..."
              value={search}
              onChange={setSearch}
              grow={2}
            />

            <FilterSelect
              label="Jenis Surat"
              icon="file-earmark-text"
              value={filterJenis}
              onChange={setFilterJenis}
              options={jenisFilterOptions}
            />

            <FilterSelect
              label="Bulan"
              icon="calendar-month"
              value={filterBulan}
              onChange={setFilterBulan}
              options={BULAN.map((b) => ({ value: b.v, label: b.l }))}
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
                }),
              ]}
            />

            <FilterSelect
              label="Status"
              icon="check2-circle"
              value={filterStatus}
              onChange={setFilterStatus}
              options={STATUS_OPTS.map((s) => ({ value: s.v, label: s.l }))}
            />
          </FilterToolbar>

          {/* Banner Notifikasi Ajuan Menunggu di luar periode aktif */}
          {pendingLuarPeriode.length > 0 && (
            <div className="ps-info-alert">
              <i className="bi bi-clock-history" style={{ flexShrink: 0, fontSize: '1.2rem' }} />
              <span>
                <strong>{pendingLuarPeriode.length} permohonan surat</strong> masih menunggu keputusan dari
                periode lain{' '}
                ({pendingLuarPeriode
                  .map((r) =>
                    new Date(r.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  )
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(', ')}
                ) — ikut ditampilkan agar segera ditindaklanjuti.
              </span>
            </div>
          )}

          {/* Konten Tabel Utama */}
          <TabSemuaPermintaan
            rows={rows}
            loading={loading}
            canManage={isFullAccess}
            userNip={userNip}
            onView={openDetail}
            onDelete={handleDelete}
            onEdit={openEdit}
            onApprove={openApproval}
          />
        </>
      )}

      {/* Modals */}
      <DetailPermintaanModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailRow(null);
        }}
        row={detailRow}
        canManage={isFullAccess}
        onEdit={openEdit}
        onApprove={openApproval}
        onDelete={handleDelete}
      />

      <AddPermintaanModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        configList={pengaturanList}
        onSuccess={() => {
          setIsAddOpen(false);
          loadData();
        }}
      />

      <ApprovalModal
        isOpen={isApprovalOpen}
        onClose={() => {
          setIsApprovalOpen(false);
          setApprovalRow(null);
        }}
        onSuccess={() => {
          setIsApprovalOpen(false);
          setApprovalRow(null);
          loadData();
        }}
        row={approvalRow}
      />

      <EditPermintaanModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditRow(null);
        }}
        configList={pengaturanList}
        onSuccess={() => {
          setIsEditOpen(false);
          setEditRow(null);
          loadData();
        }}
        row={editRow}
      />
    </div>
  );
}

// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedPermintaanSuratPage(props: any) {
  return (
    <>
      <MaintenanceBanner pageKey="maintenance_permintaan_surat" />
      <PermintaanSuratPageContent {...props} />
    </>
  );
}