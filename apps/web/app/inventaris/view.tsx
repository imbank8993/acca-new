'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalField,
  ModalFileInput,
  ModalDetailGrid,
  ModalDetailField,
} from '@/components/ui/Modal';
import { Tab, type TabItem } from '@/components/ui/Tab';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import {
  FilterToolbar,
  FilterSearch,
  FilterSelect,
  FilterActions,
} from '@/components/ui/FilterToolbar';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { Spinner } from '@/components/ui/Spinner';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import './inventaris.css';

type Item = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  condition: string;
  photo_url: string | null;
  quantity: number;
  available_now: number;
  active: boolean;
};

type Loan = {
  id: string;
  item_id: string;
  item: Pick<Item, 'code' | 'name' | 'photo_url'>;
  borrower_name: string;
  borrower_id: string;
  quantity: number;
  purpose: string;
  start_at: string;
  end_at: string;
  status: string;
  consent_at: string;
  consent_text: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  handed_over_at: string | null;
  returned_at: string | null;
  return_condition: string | null;
  created_at: string;
};

type ItemForm = Pick<
  Item,
  'code' | 'name' | 'category' | 'description' | 'location' | 'condition' | 'photo_url' | 'quantity' | 'active'
>;

const emptyItem: ItemForm = {
  code: '',
  name: '',
  category: '',
  description: '',
  location: '',
  condition: 'Baik',
  photo_url: null,
  quantity: 1,
  active: true,
};

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

const localInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const api = async (path: string, method = 'GET', body?: unknown) => {
  const response = await fetch(`/api/inventory/${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error || 'Permintaan gagal');
  return json.data;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Permintaan gagal';

export default function InventoryView({ user }: { user: { roles?: string[]; role?: string } }) {
  const isManager = [...(user?.roles || []), user?.role].some((r) =>
    ['ADMIN', 'ADMINISTRATOR', 'OP_INVENTARIS', 'KTU', 'WKM_SARPRAS'].includes(String(r).toUpperCase())
  );

  const [items, setItems] = useState<Item[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Primary Tab
  const [tab, setTab] = useState<'barang' | 'pinjaman'>('barang');

  // Filters for Items
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');

  // Filters for Loans
  const [loanStatusFilter, setLoanStatusFilter] = useState('');
  const [loanSearch, setLoanSearch] = useState('');
  const [loanSortBy, setLoanSortBy] = useState('date_desc');

  // Forms & Modals
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItem);
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState<'item' | 'loan' | 'proof' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanForm, setLoanForm] = useState({
    quantity: 1,
    purpose: '',
    start_at: localInput(new Date(Date.now() + 3600000)),
    end_at: localInput(new Date(Date.now() + 86400000)),
    consent: false,
  });
  const [photo, setPhoto] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [itemRows, loanRows] = await Promise.all([api('items'), api('loans')]);
      setItems(itemRows || []);
      setLoans(loanRows || []);
      setError('');
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Derived Categories
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return [
      { value: '', label: 'Semua Kategori' },
      ...Array.from(set)
        .sort()
        .map((cat) => ({ value: cat, label: cat })),
    ];
  }, [items]);

  // Filtered & Sorted Items
  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        const query = search.toLowerCase();
        const matchCategory = !categoryFilter || item.category === categoryFilter;
        const matchCondition = !conditionFilter || item.condition === conditionFilter;
        const matchAvailability = !availabilityFilter
          ? true
          : availabilityFilter === 'available'
            ? item.active && item.available_now > 0
            : availabilityFilter === 'unavailable'
              ? item.active && item.available_now <= 0
              : !item.active;
        const matchSearch =
          !query ||
          `${item.code} ${item.name} ${item.category} ${item.location || ''}`.toLowerCase().includes(query);
        return matchCategory && matchCondition && matchAvailability && matchSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'id');
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name, 'id');
        if (sortBy === 'qty_desc') return b.quantity - a.quantity;
        if (sortBy === 'qty_asc') return a.quantity - b.quantity;
        return 0;
      });
  }, [items, categoryFilter, conditionFilter, availabilityFilter, search, sortBy]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans
      .filter((loan) => {
        const query = loanSearch.toLowerCase();
        const matchStatus = !loanStatusFilter || loan.status === loanStatusFilter;
        const matchSearch =
          !query ||
          `${loan.item.name} ${loan.item.code} ${loan.borrower_name} ${loan.purpose}`.toLowerCase().includes(query);
        return matchStatus && matchSearch;
      })
      .sort((a, b) => {
        if (loanSortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (loanSortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return 0;
      });
  }, [loans, loanStatusFilter, loanSearch, loanSortBy]);

  const activeLoans = useMemo(
    () => loans.filter((loan) => ['Disetujui', 'Dipinjam'].includes(loan.status)).length,
    [loans]
  );
  const pendingLoans = useMemo(
    () => loans.filter((loan) => loan.status === 'Menunggu').length,
    [loans]
  );

  const available = (item: Item) => item.available_now;

  const close = () => {
    if (!busy) {
      setModal(null);
      setPhoto(null);
      setSelectedItem(null);
      setSelectedLoan(null);
    }
  };

  const openItem = (item?: Item) => {
    setEditing(item?.id || null);
    setItemForm(
      item
        ? {
            code: item.code,
            name: item.name,
            category: item.category,
            description: item.description,
            location: item.location,
            condition: item.condition,
            photo_url: item.photo_url,
            quantity: item.quantity,
            active: item.active,
          }
        : emptyItem
    );
    setPhoto(null);
    setModal('item');
  };

  const openLoan = (item: Item) => {
    setSelectedItem(item);
    setLoanForm({
      quantity: 1,
      purpose: '',
      start_at: localInput(new Date(Date.now() + 3600000)),
      end_at: localInput(new Date(Date.now() + 86400000)),
      consent: false,
    });
    setModal('loan');
  };

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!photo && !itemForm.photo_url) {
        throw new Error('Foto barang wajib diunggah');
      }
      let photo_url = itemForm.photo_url;
      if (photo) {
        const form = new FormData();
        form.append('file', photo);
        form.append('folder', 'inventaris');
        const response = await fetch('/api/upload', { method: 'POST', body: form });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || 'Gagal mengunggah foto');
        photo_url = json.publicUrl || json.url || json.file_url;
      }
      await api(editing ? `items/${editing}` : 'items', editing ? 'PATCH' : 'POST', {
        ...itemForm,
        photo_url,
      });
      setNotice(editing ? 'Barang berhasil diperbarui.' : 'Barang baru berhasil ditambahkan.');
      setModal(null);
      setPhoto(null);
      await refresh();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const requestLoan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;
    setBusy(true);
    setError('');
    try {
      await api('loans', 'POST', {
        item_id: selectedItem.id,
        quantity: loanForm.quantity,
        purpose: loanForm.purpose,
        start_at: new Date(loanForm.start_at).toISOString(),
        end_at: new Date(loanForm.end_at).toISOString(),
        consent: loanForm.consent,
      });
      setNotice('Pengajuan peminjaman tercatat. Menunggu persetujuan petugas.');
      setModal(null);
      setTab('pinjaman');
      await refresh();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const transition = async (loan: Loan, status: string) => {
    let review_note: string | null = null;
    if (status === 'Ditolak') {
      const res = await Swal.fire({
        title: 'Tolak Pengajuan',
        input: 'textarea',
        inputLabel: 'Alasan Penolakan:',
        inputPlaceholder: 'Tuliskan alasan penolakan...',
        showCancelButton: true,
        confirmButtonText: 'Tolak Pengajuan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ef4444',
        inputValidator: (v) => (!v ? 'Alasan penolakan wajib diisi' : null),
      });
      if (!res.isConfirmed || !res.value) return;
      review_note = res.value;
    }

    let return_condition: string | null = null;
    if (status === 'Dikembalikan') {
      const res = await Swal.fire({
        title: 'Catat Pengembalian Barang',
        input: 'select',
        inputOptions: {
          'Baik': 'Baik',
          'Perlu perbaikan': 'Perlu perbaikan',
          'Rusak': 'Rusak',
        },
        inputLabel: 'Kondisi barang saat dikembalikan:',
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
      });
      if (!res.isConfirmed || !res.value) return;
      return_condition = res.value;
    }

    if (status === 'Dibatalkan') {
      const res = await Swal.fire({
        title: 'Batalkan Pengajuan?',
        text: 'Pengajuan peminjaman barang ini akan dibatalkan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Kembali',
        confirmButtonColor: '#ef4444',
      });
      if (!res.isConfirmed) return;
    }

    setBusy(true);
    setError('');
    try {
      await api(`loans/${loan.id}`, 'PATCH', { status, review_note, return_condition });
      setNotice(`Status peminjaman berhasil diperbarui menjadi ${status}.`);
      await refresh();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const tabsConfig: TabItem<'barang' | 'pinjaman'>[] = [
    {
      key: 'barang',
      label: 'Daftar Barang',
      icon: 'package',
      badge: items.length > 0 ? items.length : undefined,
      hint: `${items.length} jenis inventaris tercatat`,
    },
    {
      key: 'pinjaman',
      label: 'Peminjaman',
      icon: 'arrow-left-right',
      badge: pendingLoans > 0 ? pendingLoans : undefined,
      hint: `${pendingLoans} pengajuan perlu persetujuan`,
    },
  ];

  return (
    <div className="inv-page">
      {/* -------------------- Floating Action Button (FAB) ----------------- */}
      {isManager && (
        <>
          <DesktopFab label="Tambah Barang" icon="plus-lg" onClick={() => openItem()} />
          <MobileFab label="Tambah Barang" icon="plus-lg" onClick={() => openItem()} />
        </>
      )}

      {/* ---------------- 1. TAB BAR AT TOP (Ikuti Gambar ke-2) ------------- */}
      <Tab<'barang' | 'pinjaman'>
        tabs={tabsConfig}
        activeTab={tab}
        onChange={setTab}
        ariaLabel="Navigasi Inventaris"
        variant="slider"
      />

      {/* ---------------- 2. STATS CARDS (Ikuti Gambar ke-2) --------------- */}
      <div className="inv-stats">
        <div className="inv-stat-card">
          <div className="inv-stat-icon inv-stat-icon--blue">
            <i className="bi bi-box-seam" />
          </div>
          <div className="inv-stat-content">
            <span className="inv-stat-label">Total barang</span>
            <strong className="inv-stat-val">{items.length}</strong>
            <small className="inv-stat-sub">Jenis inventaris tercatat</small>
          </div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-icon inv-stat-icon--emerald">
            <i className="bi bi-arrow-repeat" />
          </div>
          <div className="inv-stat-content">
            <span className="inv-stat-label">Sedang dipinjam</span>
            <strong className="inv-stat-val">{activeLoans}</strong>
            <small className="inv-stat-sub">Pengajuan aktif</small>
          </div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-icon inv-stat-icon--amber">
            <i className="bi bi-clock-history" />
          </div>
          <div className="inv-stat-content">
            <span className="inv-stat-label">Menunggu persetujuan</span>
            <strong className="inv-stat-val">{pendingLoans}</strong>
            <small className="inv-stat-sub">Perlu tindakan petugas</small>
          </div>
        </div>
      </div>

      {/* ------------------------- Alerts / Notices ------------------------ */}
      {notice && (
        <div className="inv-alert success" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Tutup">
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="inv-alert error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Tutup">
            ×
          </button>
        </div>
      )}

      {/* ---------------- 3. FILTER TOOLBAR: Kategori, Kondisi, Status + Search ----- */}
      {tab === 'barang' ? (
        <FilterToolbar>
          <FilterSelect
            label="Kategori"
            icon="tag"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
          />
          <FilterSelect
            label="Kondisi"
            icon="heart-pulse"
            value={conditionFilter}
            onChange={setConditionFilter}
            options={[
              { value: '', label: 'Semua Kondisi' },
              { value: 'Baik', label: 'Baik' },
              { value: 'Perlu perbaikan', label: 'Perlu Perbaikan' },
              { value: 'Rusak', label: 'Rusak' },
            ]}
          />
          <FilterSelect
            label="Status"
            icon="funnel"
            value={availabilityFilter}
            onChange={setAvailabilityFilter}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'available', label: 'Tersedia' },
              { value: 'unavailable', label: 'Habis / Dipinjam' },
              { value: 'inactive', label: 'Nonaktif' },
            ]}
          />
          <FilterSearch
            label="Pencarian"
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, kode, lokasi..."
          />
          <FilterActions>
            <InlineSelect
              title="Urutkan"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'name_asc', label: 'Nama (A-Z)' },
                { value: 'name_desc', label: 'Nama (Z-A)' },
                { value: 'qty_desc', label: 'Unit Terbanyak' },
                { value: 'qty_asc', label: 'Unit Tersedikit' },
              ]}
            />
          </FilterActions>
        </FilterToolbar>
      ) : (
        <FilterToolbar>
          <FilterSelect
            label="Status"
            icon="funnel"
            value={loanStatusFilter}
            onChange={setLoanStatusFilter}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'Menunggu', label: 'Menunggu' },
              { value: 'Disetujui', label: 'Disetujui' },
              { value: 'Dipinjam', label: 'Dipinjam' },
              { value: 'Dikembalikan', label: 'Dikembalikan' },
              { value: 'Ditolak', label: 'Ditolak' },
              { value: 'Dibatalkan', label: 'Dibatalkan' },
            ]}
          />
          <FilterSearch
            label="Pencarian"
            value={loanSearch}
            onChange={setLoanSearch}
            placeholder="Cari peminjam, kode, barang, keperluan..."
          />
          <FilterActions>
            <InlineSelect
              title="Urutkan"
              value={loanSortBy}
              onChange={setLoanSortBy}
              options={[
                { value: 'date_desc', label: 'Terbaru' },
                { value: 'date_asc', label: 'Terlama' },
              ]}
            />
          </FilterActions>
        </FilterToolbar>
      )}

      {/* ---------------- 4. TABLE VIEW ONLY (Hanya Tabel) ---------------- */}
      <div className="inv-card">
        {loading ? (
          <div className="inv-loading">
            <Spinner variant="buble" size={28} />
          </div>
        ) : tab === 'barang' ? (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '56px' }}>Foto</th>
                  <th>Kode & Nama Barang</th>
                  <th>Kategori</th>
                  <th>Lokasi</th>
                  <th>Kondisi</th>
                  <th>Ketersediaan</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center', color: 'var(--n-muted)' }}>{index + 1}</td>
                    <td>
                      <div className="inv-table-thumb">
                        {item.photo_url ? (
                          <Image
                            src={item.photo_url}
                            alt={item.name}
                            width={40}
                            height={40}
                            unoptimized
                          />
                        ) : (
                          <i className="bi bi-box-seam" />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="inv-table-title">{item.name}</div>
                      <div className="inv-table-sub font-mono">{item.code}</div>
                    </td>
                    <td>
                      <span className="inv-category-tag">{item.category}</span>
                    </td>
                    <td>{item.location || '—'}</td>
                    <td>
                      <span className="inv-badge">{item.condition}</span>
                    </td>
                    <td>
                      <strong>{available(item)}</strong> / {item.quantity} unit
                    </td>
                    <td>
                      <span
                        className={`inv-badge ${
                          !item.active
                            ? 'inv-badge--inactive'
                            : available(item) > 0
                              ? 'inv-badge--available'
                              : 'inv-badge--unavailable'
                        }`}
                      >
                        {!item.active ? 'Nonaktif' : available(item) > 0 ? 'Tersedia' : 'Habis'}
                      </span>
                    </td>
                    <td>
                      <ActionGroup align="center">
                        <ActionButton
                          action="fill"
                          tooltip="Ajukan Pinjam"
                          onClick={() => openLoan(item)}
                          disabled={!item.active || available(item) <= 0}
                        />
                        {isManager && (
                          <ActionButton
                            action="edit"
                            tooltip="Edit Barang"
                            onClick={() => openItem(item)}
                          />
                        )}
                      </ActionGroup>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={9}>
                      <div className="inv-empty">
                        <i className="bi bi-inbox" />
                        <h4>Barang tidak ditemukan</h4>
                        <p>Tidak ada data inventaris yang sesuai dengan filter pencarian.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                  <th>Barang</th>
                  <th>Peminjam</th>
                  <th>Jumlah</th>
                  <th>Jadwal Peminjaman</th>
                  <th>Status</th>
                  <th>Keperluan</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan, index) => (
                  <tr key={loan.id}>
                    <td style={{ textAlign: 'center', color: 'var(--n-muted)' }}>{index + 1}</td>
                    <td>
                      <div className="inv-table-title">{loan.item.name}</div>
                      <div className="inv-table-sub font-mono">{loan.item.code}</div>
                    </td>
                    <td>
                      <strong>{loan.borrower_name}</strong>
                      <div className="inv-table-sub">{date(loan.created_at)}</div>
                    </td>
                    <td>{loan.quantity} unit</td>
                    <td>
                      <div style={{ fontSize: '0.78rem' }}>{date(loan.start_at)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>s/d {date(loan.end_at)}</div>
                    </td>
                    <td>
                      <span className={`inv-badge inv-badge--${loan.status.toLowerCase()}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td>
                      <div className="inv-table-purpose" title={loan.purpose}>
                        {loan.purpose}
                      </div>
                    </td>
                    <td>
                      <ActionGroup align="center">
                        <ActionButton
                          action="view"
                          tooltip="Lihat Bukti Peminjaman"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setModal('proof');
                          }}
                        />
                        {loan.status === 'Menunggu' && isManager && (
                          <>
                            <ActionButton
                              action="approve"
                              tooltip="Setujui Pengajuan"
                              onClick={() => transition(loan, 'Disetujui')}
                              disabled={busy}
                            />
                            <ActionButton
                              action="reject"
                              tooltip="Tolak Pengajuan"
                              onClick={() => transition(loan, 'Ditolak')}
                              disabled={busy}
                            />
                          </>
                        )}
                        {loan.status === 'Menunggu' && !isManager && (
                          <ActionButton
                            action="delete"
                            tooltip="Batalkan Pengajuan"
                            onClick={() => transition(loan, 'Dibatalkan')}
                            disabled={busy}
                          />
                        )}
                        {loan.status === 'Disetujui' && isManager && (
                          <ActionButton
                            action="move"
                            tooltip="Serahkan Barang"
                            onClick={() => transition(loan, 'Dipinjam')}
                            disabled={busy}
                          />
                        )}
                        {loan.status === 'Dipinjam' && isManager && (
                          <ActionButton
                            action="toggle"
                            tooltip="Catat Pengembalian"
                            onClick={() => transition(loan, 'Dikembalikan')}
                            disabled={busy}
                          />
                        )}
                      </ActionGroup>
                    </td>
                  </tr>
                ))}
                {!filteredLoans.length && (
                  <tr>
                    <td colSpan={8}>
                      <div className="inv-empty">
                        <i className="bi bi-clock-history" />
                        <h4>Belum ada pengajuan</h4>
                        <p>Tidak ada riwayat pengajuan peminjaman yang sesuai dengan filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --------------------------- Item Modal ---------------------------- */}
      <Modal
        open={modal === 'item'}
        onClose={close}
        size="lg"
        variant={editing ? 'edit' : 'add'}
        title={editing ? 'Edit Barang Inventaris' : 'Tambah Barang Inventaris'}
        subtitle="ACCA • Pengelolaan Sarana Madrasah"
        icon={editing ? 'pencil-square' : 'box-seam'}
      >
        <form onSubmit={saveItem}>
          <ModalBody>
            <div className="inv-form-grid">
              <ModalField label="Kode Barang" required hint="Contoh: ELK-01, LAB-05">
                <input
                  required
                  maxLength={60}
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                  placeholder="Masukkan kode unik..."
                />
              </ModalField>
              <ModalField label="Nama Barang" required>
                <input
                  required
                  maxLength={255}
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="Contoh: Proyektor Epson EB-X400..."
                />
              </ModalField>
              <ModalField label="Kategori" required hint="Contoh: Elektronik, Olahraga, Sarana">
                <input
                  required
                  maxLength={80}
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  placeholder="Kategori barang..."
                />
              </ModalField>
              <ModalField label="Jumlah Unit" required hint="Total unit tercatat di madrasah">
                <input
                  required
                  type="number"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                />
              </ModalField>
              <ModalField label="Lokasi Penyimpanan" hint="Tempat atau ruangan barang disimpan">
                <input
                  maxLength={120}
                  value={itemForm.location || ''}
                  onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                  placeholder="Contoh: Ruang Guru, Lab Komputer..."
                />
              </ModalField>
              <ModalField label="Kondisi Fisik">
                <select
                  value={itemForm.condition}
                  onChange={(e) => setItemForm({ ...itemForm, condition: e.target.value })}
                >
                  <option value="Baik">Baik</option>
                  <option value="Perlu perbaikan">Perlu perbaikan</option>
                  <option value="Rusak">Rusak</option>
                </select>
              </ModalField>
              <div className="inv-form-grid--full">
                <ModalField label="Deskripsi Barang" hint="Spesifikasi atau informasi penting lainnya">
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={itemForm.description || ''}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    placeholder="Keterangan spesifikasi, merk, atau kondisi khusus..."
                  />
                </ModalField>
              </div>
              <div className="inv-form-grid--full">
                <ModalField
                  label="Foto Barang"
                  required={!itemForm.photo_url}
                  hint="Format JPG, PNG, atau WebP (maksimal 5 MB)"
                >
                  <ModalFileInput
                    files={photo ? [photo] : []}
                    onPick={(picked) => setPhoto(picked[0] || null)}
                    accept="image/jpeg,image/png,image/webp"
                    placeholder="Pilih berkas foto atau jatuhkan di sini"
                    disabled={busy}
                  />
                  {itemForm.photo_url && !photo && (
                    <div className="inv-photo-current">
                      <Image
                        src={itemForm.photo_url}
                        alt="Foto saat ini"
                        width={44}
                        height={44}
                        className="inv-photo-thumb"
                        unoptimized
                      />
                      <div>
                        <span>Foto saat ini tersimpan</span>
                        <small>Pilih file baru di atas jika ingin mengganti</small>
                      </div>
                    </div>
                  )}
                </ModalField>
              </div>
              <div className="inv-form-grid--full inv-check-wrap">
                <label className="inv-check-label">
                  <input
                    type="checkbox"
                    checked={itemForm.active}
                    onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                  />
                  <span>Barang aktif dan dapat dipinjam oleh warga madrasah</span>
                </label>
              </div>
            </div>
          </ModalBody>
          <ModalFooter align="between">
            <Button type="button" variant="cancel" onClick={close} disabled={busy}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={busy} icon="save">
              {editing ? 'Simpan Perubahan' : 'Tambah Barang'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* --------------------------- Loan Modal ---------------------------- */}
      <Modal
        open={modal === 'loan' && !!selectedItem}
        onClose={close}
        size="md"
        variant="default"
        title="Pengajuan Peminjaman Barang"
        subtitle={selectedItem ? `${selectedItem.name} (${selectedItem.code})` : undefined}
        icon="send"
      >
        {selectedItem && (
          <form onSubmit={requestLoan}>
            <ModalBody>
              <div className="inv-modal-item-preview">
                <div className="inv-modal-item-thumb">
                  {selectedItem.photo_url ? (
                    <Image
                      src={selectedItem.photo_url}
                      alt={selectedItem.name}
                      width={52}
                      height={52}
                      unoptimized
                    />
                  ) : (
                    <i className="bi bi-box-seam" />
                  )}
                </div>
                <div className="inv-modal-item-info">
                  <strong>{selectedItem.name}</strong>
                  <span>
                    {selectedItem.code} · Kategori: {selectedItem.category}
                  </span>
                  <span style={{ color: '#15803d', fontWeight: 600 }}>
                    Tersedia {available(selectedItem)} unit saat ini
                  </span>
                </div>
              </div>

              <ModalField
                label="Jumlah Unit Dipinjam"
                required
                hint={`Maksimal ${available(selectedItem)} unit`}
              >
                <input
                  required
                  type="number"
                  min="1"
                  max={available(selectedItem)}
                  value={loanForm.quantity}
                  onChange={(e) => setLoanForm({ ...loanForm, quantity: Number(e.target.value) })}
                />
              </ModalField>

              <div className="inv-form-grid" style={{ marginTop: 0 }}>
                <ModalField label="Mulai Pinjam" required>
                  <input
                    required
                    type="datetime-local"
                    value={loanForm.start_at}
                    onChange={(e) => setLoanForm({ ...loanForm, start_at: e.target.value })}
                  />
                </ModalField>
                <ModalField label="Rencana Kembali" required>
                  <input
                    required
                    type="datetime-local"
                    value={loanForm.end_at}
                    onChange={(e) => setLoanForm({ ...loanForm, end_at: e.target.value })}
                  />
                </ModalField>
              </div>

              <ModalField
                label="Keperluan / Alasan Pinjam"
                required
                hint="Jelaskan tujuan pemakaian barang secara jelas"
              >
                <textarea
                  required
                  rows={3}
                  maxLength={1000}
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  placeholder="Contoh: Praktikum Fisika kelas 9B di Lab IPA..."
                />
              </ModalField>

              <div className="inv-check-wrap">
                <label className="inv-check-label">
                  <input
                    type="checkbox"
                    required
                    checked={loanForm.consent}
                    onChange={(e) => setLoanForm({ ...loanForm, consent: e.target.checked })}
                  />
                  <span>
                    Saya bertanggung jawab penuh atas peminjaman ini, menjaga kondisi barang, dan
                    mengembalikannya tepat waktu. Persetujuan akun saya dicatat sebagai bukti resmi.
                  </span>
                </label>
              </div>
            </ModalBody>
            <ModalFooter align="between">
              <Button type="button" variant="cancel" onClick={close} disabled={busy}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={busy} icon="ajukan">
                Kirim Pengajuan
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* -------------------------- Proof Modal ---------------------------- */}
      <Modal
        open={modal === 'proof' && !!selectedLoan}
        onClose={close}
        size="lg"
        variant="default"
        title="Bukti Pengajuan Peminjaman"
        subtitle={selectedLoan ? `ID: ${selectedLoan.id}` : undefined}
        icon="file-earmark-check"
      >
        {selectedLoan && (
          <>
            <ModalBody>
              <ModalDetailGrid>
                <ModalDetailField icon="box-seam" label="Barang Inventaris">
                  <strong>{selectedLoan.item.name}</strong>{' '}
                  <span className="inv-text-muted">({selectedLoan.item.code})</span>
                </ModalDetailField>
                <ModalDetailField icon="person-badge" label="Nama Peminjam">
                  <strong>{selectedLoan.borrower_name}</strong>
                </ModalDetailField>
                <ModalDetailField icon="layers" label="Jumlah Unit">
                  {selectedLoan.quantity} unit
                </ModalDetailField>
                <ModalDetailField icon="tag" label="Status Peminjaman">
                  <span className={`inv-badge inv-badge--${selectedLoan.status.toLowerCase()}`}>
                    {selectedLoan.status}
                  </span>
                </ModalDetailField>
                <ModalDetailField icon="calendar-range" label="Durasi Peminjaman" full>
                  {date(selectedLoan.start_at)} — {date(selectedLoan.end_at)}
                </ModalDetailField>
                <ModalDetailField icon="card-text" label="Keperluan" full>
                  {selectedLoan.purpose}
                </ModalDetailField>
                <ModalDetailField icon="patch-check" label="Persetujuan Digital Peminjam" full>
                  <div>{selectedLoan.consent_text}</div>
                  <small className="inv-text-muted">
                    Disetujui via akun ACCA pada {date(selectedLoan.consent_at)}
                  </small>
                </ModalDetailField>
                <ModalDetailField icon="shield-check" label="Keputusan Petugas" full>
                  <div>
                    {selectedLoan.reviewed_by
                      ? `${selectedLoan.reviewed_by} · ${date(selectedLoan.reviewed_at)}`
                      : 'Belum diputuskan'}
                  </div>
                  {selectedLoan.review_note && (
                    <div className="inv-proof-note">
                      <strong>Catatan Petugas:</strong> {selectedLoan.review_note}
                    </div>
                  )}
                </ModalDetailField>
                {selectedLoan.handed_over_at && (
                  <ModalDetailField icon="box-arrow-right" label="Waktu Penyerahan">
                    {date(selectedLoan.handed_over_at)}
                  </ModalDetailField>
                )}
                {selectedLoan.returned_at && (
                  <ModalDetailField icon="box-arrow-in-left" label="Waktu Pengembalian">
                    <div>{date(selectedLoan.returned_at)}</div>
                    {selectedLoan.return_condition && (
                      <small className="inv-text-muted">
                        Kondisi barang: {selectedLoan.return_condition}
                      </small>
                    )}
                  </ModalDetailField>
                )}
              </ModalDetailGrid>
            </ModalBody>
            <ModalFooter align="between">
              <Button type="button" variant="cancel" onClick={close}>
                Tutup
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon="print"
                onClick={() => window.print()}
              >
                Cetak Bukti
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
