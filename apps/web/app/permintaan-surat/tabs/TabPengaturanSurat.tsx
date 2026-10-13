'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { Spinner } from '@/components/ui/Spinner';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-breakpoint';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import ModalPengaturanJenisSurat, { ROLE_OPTIONS } from '../components/ModalPengaturanJenisSurat';
import { getRoleApproverLabel, JenisSuratConfig } from '../components/AddPermintaanModal';

interface TabPengaturanSuratProps {
  onSaved?: () => void;
}

export default function TabPengaturanSurat({ onSaved }: TabPengaturanSuratProps = {}) {
  const [configs, setConfigs] = useState<JenisSuratConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterApprover, setFilterApprover] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<JenisSuratConfig | null>(null);
  const isMobile = useIsMobile();

  const loadPengaturan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/permintaan-surat/pengaturan');
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setConfigs(json.data);
      } else {
        setConfigs([]);
      }
    } catch (e) {
      console.error('Error fetching pengaturan:', e);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPengaturan();
  }, [loadPengaturan]);

  const saveAllConfigs = async (updatedList: JenisSuratConfig[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/permintaan-surat/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedList),
      });
      const json = await res.json();
      if (json.ok) {
        setConfigs(json.data || updatedList);
        onSaved?.();
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Pengaturan alur surat disimpan',
          timer: 1800,
          showConfirmButton: false,
        });
      } else {
        throw new Error(json.error || 'Gagal menyimpan pengaturan');
      }
    } catch (e: any) {
      Swal.fire({
        title: 'Gagal Menyimpan',
        text: e.message || 'Terjadi kesalahan pada server',
        icon: 'error',
        confirmButtonColor: '#3083FF',
      });
      loadPengaturan();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: JenisSuratConfig) => {
    setEditItem(item);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (savedItem: JenisSuratConfig) => {
    let updated: JenisSuratConfig[] = [];
    if (editItem) {
      updated = configs.map((c) => (c.id === editItem.id ? savedItem : c));
    } else {
      updated = [...configs, savedItem];
    }
    await saveAllConfigs(updated);
  };

  const handleToggleActive = async (item: JenisSuratConfig) => {
    const updated = configs.map((c) =>
      c.id === item.id ? { ...c, is_active: !c.is_active } : c
    );
    await saveAllConfigs(updated);
  };

  const handleDelete = async (item: JenisSuratConfig) => {
    const confirm = await Swal.fire({
      title: 'Hapus Jenis Surat?',
      text: `Apakah Anda yakin ingin menghapus konfigurasi "${item.nama}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;

    const updated = configs.filter((c) => c.id !== item.id);
    await saveAllConfigs(updated);
  };

  const approverOptions = useMemo(() => {
    const opts = [
      { value: '', label: 'Semua Approver' },
      { value: 'NONE', label: 'Langsung TU (Tanpa Verifikasi)' },
    ];

    // Standard roles
    ROLE_OPTIONS.forEach((r) => {
      opts.push({ value: r.value, label: r.label });
    });

    // Custom roles jika ada dalam konfigurasi
    const standardRoleValues = new Set(ROLE_OPTIONS.map((r) => r.value));
    configs.forEach((c) => {
      if (c.perlu_approval && c.approver_type === 'ROLE' && c.approver_role && !standardRoleValues.has(c.approver_role)) {
        standardRoleValues.add(c.approver_role);
        opts.push({
          value: c.approver_role,
          label: getRoleApproverLabel(c.approver_role),
        });
      }
    });

    // Specific user approvers jika ada dalam konfigurasi
    const seenUsers = new Set<string>();
    configs.forEach((c) => {
      if (c.perlu_approval && c.approver_type === 'USER') {
        const userKey = c.approver_user_nip || c.approver_user_nama || '';
        if (userKey && !seenUsers.has(userKey)) {
          seenUsers.add(userKey);
          opts.push({
            value: `USER:${userKey}`,
            label: c.approver_user_nama
              ? `${c.approver_user_nama} (Pegawai)`
              : `NIP ${c.approver_user_nip}`,
          });
        }
      }
    });

    return opts;
  }, [configs]);

  const filteredConfigs = useMemo(() => {
    return configs.filter((item) => {
      // 1. Filter Pencarian
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          (item.nama && item.nama.toLowerCase().includes(q)) ||
          (item.deskripsi && item.deskripsi.toLowerCase().includes(q)) ||
          (item.id && item.id.toLowerCase().includes(q)) ||
          (item.approver_user_nama && item.approver_user_nama.toLowerCase().includes(q)) ||
          (item.approver_user_nip && item.approver_user_nip.toLowerCase().includes(q)) ||
          (item.approver_role && getRoleApproverLabel(item.approver_role).toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Filter Sesuai Siapa yang Mengapprove
      if (filterApprover) {
        if (filterApprover === 'NONE') {
          return !item.perlu_approval || item.approver_type === 'NONE';
        }

        if (!item.perlu_approval) return false;

        if (filterApprover.startsWith('USER:')) {
          const targetKey = filterApprover.slice(5);
          return (
            item.approver_type === 'USER' &&
            (item.approver_user_nip === targetKey || item.approver_user_nama === targetKey)
          );
        }

        return item.approver_type === 'ROLE' && item.approver_role === filterApprover;
      }

      return true;
    });
  }, [configs, search, filterApprover]);

  return (
    <>
      {/* FAB Tambah Jenis Surat (ikon berbeda dari Ajukan Surat) */}
      <DesktopFab label="Tambah Jenis Surat" icon={<Plus size={20} />} mobileIcon="plus-lg" mobileLabel="Tambah" onClick={handleOpenAdd} />
      <MobileFab label="Tambah" icon="plus-lg" onClick={handleOpenAdd} />

      {/* Toolbar Filter & Pencarian */}
      <FilterToolbar>
        <FilterSearch
          label="Pencarian"
          placeholder="Cari jenis surat atau keterangan..."
          value={search}
          onChange={setSearch}
          grow={2}
        />

        <FilterSelect
          label="Pihak Berwenang"
          icon="person-check"
          value={filterApprover}
          onChange={setFilterApprover}
          options={approverOptions}
        />

      </FilterToolbar>

      {/* Tampilan Mobile — Kartu */}
      {isMobile && (
        loading ? (
          <div className="ps-mob-loading">
            <Spinner variant="buble" label="Memuat konfigurasi jenis surat..." />
          </div>
        ) : filteredConfigs.length === 0 ? (
          <div className="ps-mob-empty">
            <i className="bi bi-gear" />
            <p>
              {configs.length === 0
                ? 'Belum ada konfigurasi jenis surat'
                : 'Tidak ada jenis surat yang cocok'}
            </p>
          </div>
        ) : (
          <div className="ps-mob-list">
            {filteredConfigs.map((item, idx) => {
              const aktif = item.is_active !== false;
              const approverText =
                item.approver_type === 'USER'
                  ? item.approver_user_nama || `NIP ${item.approver_user_nip}`
                  : getRoleApproverLabel(item.approver_role);

              return (
                <div
                  key={item.id || idx}
                  className="ps-mob-card ps-mob-card--compact"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenEdit(item)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenEdit(item)}
                >
                  <div className="ps-mob-card__header">
                    <div className="ps-mob-avatar ps-mob-avatar--doc">
                      <i className="bi bi-file-earmark-text" />
                    </div>
                    <div className="ps-mob-card__meta">
                      <div className="ps-mob-card__name">{item.nama}</div>
                      <div className="ps-mob-card__nip">ID: {item.id}</div>
                    </div>
                  </div>

                  <div className="ps-mob-card__body">
                    {item.deskripsi && (
                      <div className="ps-mob-card__keperluan">{item.deskripsi}</div>
                    )}
                    <div className="ps-mob-flow">
                      {item.perlu_approval ? (
                        <>
                          <span className="ps-mob-flow__step ps-mob-flow__step--verif">
                            <b>1</b>
                            <span>{approverText}</span>
                          </span>
                          <i className="bi bi-arrow-right ps-mob-flow__arrow" />
                          <span className="ps-mob-flow__step ps-mob-flow__step--tu">
                            <b>2</b>
                            <span>Operator TU</span>
                          </span>
                        </>
                      ) : (
                        <span className="ps-mob-flow__step ps-mob-flow__step--direct">
                          <i className="bi bi-lightning-charge-fill" />
                          <span>Langsung Operator TU</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ps-mob-card__footer ps-mob-card__footer--split" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`ps-mob-toggle ${aktif ? 'is-on' : ''}`}
                      onClick={() => handleToggleActive(item)}
                      disabled={saving}
                      title="Ketuk untuk mengubah status"
                    >
                      <span className="ps-mob-toggle__dot" />
                      {aktif ? 'Aktif' : 'Nonaktif'}
                    </button>
                    <div className="ps-mob-icon-group">
                      <button
                        type="button"
                        className="ps-mob-icon-btn ps-mob-icon-btn--edit"
                        onClick={() => handleOpenEdit(item)}
                        aria-label="Ubah"
                        title="Ubah"
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="ps-mob-icon-btn ps-mob-icon-btn--delete"
                        onClick={() => handleDelete(item)}
                        aria-label="Hapus"
                        title="Hapus"
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tabel Konfigurasi Data (Desktop) */}
      {!isMobile && (
      <div className="ps-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>No</th>
                <th>Nama Jenis Surat</th>
                <th>Keterangan / Deskripsi</th>
                <th>Alur Persetujuan (Workflow)</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 0', textAlign: 'center' }}>
                    <Spinner variant="buble" label="Memuat konfigurasi jenis surat..." />
                  </td>
                </tr>
              ) : filteredConfigs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="ps-empty">
                      <i className="bi bi-gear" />
                      <p>
                        {configs.length === 0
                          ? 'Belum ada konfigurasi jenis surat'
                          : 'Tidak ada jenis surat yang cocok dengan filter / pencarian'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((item, idx) => {
                  const approverText =
                    item.approver_type === 'USER'
                      ? item.approver_user_nama
                        ? `${item.approver_user_nama} (NIP: ${item.approver_user_nip || '—'})`
                      : `NIP ${item.approver_user_nip}`
                    : getRoleApproverLabel(item.approver_role);

                return (
                  <tr key={item.id || idx}>
                    <td style={{ textAlign: 'center', color: 'var(--ps-text-muted)', fontSize: '0.82rem' }}>
                      {idx + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ps-text-primary)' }}>{item.nama}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--ps-text-muted)' }}>
                        ID: {item.id}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.84rem', color: 'var(--ps-text-secondary)', maxWidth: 280 }}>
                        {item.deskripsi || '—'}
                      </div>
                    </td>
                    <td>
                      {item.perlu_approval ? (
                        <div className="ps-workflow">
                          <div className="ps-workflow-steps">
                            <div className="ps-workflow-step ps-workflow-step--verif">
                              <span className="ps-workflow-num">1</span>
                              <span className="ps-workflow-label">{approverText}</span>
                            </div>
                            <i className="bi bi-chevron-right ps-workflow-arrow" />
                            <div className="ps-workflow-step ps-workflow-step--tu">
                              <span className="ps-workflow-num">2</span>
                              <span className="ps-workflow-label">Operator TU</span>
                            </div>
                          </div>
                          <span className="ps-workflow-desc">Verifikasi → Proses &amp; Terbit</span>
                        </div>
                      ) : (
                        <div className="ps-workflow">
                          <div className="ps-workflow-steps">
                            <div className="ps-workflow-step ps-workflow-step--direct">
                              <i className="bi bi-lightning-charge-fill" style={{ fontSize: '0.7rem' }} />
                              <span className="ps-workflow-label">Langsung Operator TU</span>
                            </div>
                          </div>
                          <span className="ps-workflow-desc">Tanpa verifikasi tambahan</span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: 'none',
                          background: item.is_active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: item.is_active !== false ? '#047857' : '#64748b',
                          transition: 'all 0.15s ease',
                        }}
                        title="Klik untuk mengubah status aktif"
                      >
                        <i className={`bi bi-${item.is_active !== false ? 'check-circle-fill' : 'x-circle-fill'}`} />
                        {item.is_active !== false ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <ActionGroup>
                        <ActionButton
                          action="edit"
                          title="Ubah Konfigurasi"
                          onClick={() => handleOpenEdit(item)}
                        />
                        <ActionButton
                          action="delete"
                          title="Hapus Jenis Surat"
                          onClick={() => handleDelete(item)}
                        />
                      </ActionGroup>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
      )}

      {/* Modal Pengaturan Item */}
      <ModalPengaturanJenisSurat
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditItem(null);
        }}
        onSave={handleSaveModal}
        initialData={editItem}
      />
    </>
  );
}
