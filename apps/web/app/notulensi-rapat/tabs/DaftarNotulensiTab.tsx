'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { swalSuccess, swalError, swalConfirm } from '@/lib/swal-premium';
import NotulensiModal, { type NotulensiItem, type PoinHasilRapat } from '../components/NotulensiModal';
import NotulensiPrintModal from '../components/NotulensiPrintModal';

interface DaftarNotulensiTabProps {
    bolehKelola: boolean;
    headerTabs?: React.ReactNode;
}

export default function DaftarNotulensiTab({ bolehKelola, headerTabs }: DaftarNotulensiTabProps) {
    const [items, setItems] = useState<NotulensiItem[]>([]);
    const [stats, setStats] = useState({ total: 0, belum: 0, proses: 0, selesai: 0 });
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('Semua');
    const [filterBulan, setFilterBulan] = useState<string>('');

    // Expandable rows in desktop
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<NotulensiItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [printItem, setPrintItem] = useState<NotulensiItem | null>(null);

    // Active quick status dropdown row
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.nr-status-select-wrap')) {
                setActiveDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus && filterStatus !== 'Semua') params.set('status', filterStatus);
            if (filterBulan) params.set('bulan', filterBulan);
            if (searchQuery.trim()) params.set('search', searchQuery.trim());

            const res = await fetch(`/api/notulensi-rapat?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                setItems(json.data || []);
                if (json.stats) setStats(json.stats);
            } else {
                throw new Error(json.error || 'Gagal memuat notulensi rapat');
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            swalError('Error', err.message || 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterBulan, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (data: NotulensiItem) => {
        setSaving(true);
        try {
            const isEdit = !!data.id;
            const url = isEdit ? `/api/notulensi-rapat/${data.id}` : '/api/notulensi-rapat';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.error || 'Gagal menyimpan notulensi');
            }

            swalSuccess(isEdit ? 'Notulensi berhasil diperbarui!' : 'Notulensi baru berhasil disimpan!');
            setIsFormOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (err: any) {
            swalError('Gagal', err.message || 'Terjadi kesalahan');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: NotulensiItem) => {
        if (!item.id) return;
        const confirm = await swalConfirm({
            title: 'Hapus Notulensi Rapat?',
            text: `Yakin ingin menghapus notulensi "${item.agenda}"? Data tidak dapat dikembalikan.`,
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
            icon: 'warning',
        });
        if (!confirm.isConfirmed) return;

        try {
            const res = await fetch(`/api/notulensi-rapat/${item.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.error || 'Gagal menghapus');
            }
            swalSuccess('Notulensi berhasil dihapus!');
            fetchData();
        } catch (err: any) {
            swalError('Gagal', err.message || 'Gagal menghapus');
        }
    };

    // Quick status toggle
    const handleQuickChangeStatus = async (item: NotulensiItem, newStatus: string) => {
        setActiveDropdownId(null);
        if (!bolehKelola || !item.id) return;
        try {
            const res = await fetch(`/api/notulensi-rapat/${item.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json.error || 'Gagal mengubah status');
            fetchData();
        } catch (err: any) {
            swalError('Gagal', err.message);
        }
    };

    // Toggle status individual poin
    const handleTogglePoinStatus = async (itemId: string, poin: PoinHasilRapat, nextStatus: string) => {
        if (!bolehKelola) return;
        try {
            const res = await fetch(`/api/notulensi-rapat/${itemId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poin_id: poin.id,
                    poin_status: nextStatus,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json.error || 'Gagal mengubah status poin');
            fetchData();
        } catch (err: any) {
            swalError('Gagal', err.message);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const formatDateShort = (d?: string) => {
        if (!d) return '-';
        try {
            const date = new Date(d + 'T00:00:00');
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return d;
        }
    };

    return (
        <div className="nr-root">
            {headerTabs}

            {/* ── KPI STATS CARDS ── */}
            <div className="nr-stats-grid">
                <div
                    className={`nr-stat-card ${filterStatus === 'Semua' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('Semua')}
                    title="Klik untuk melihat semua notulensi"
                >
                    <div className="nr-stat-icon total">
                        <i className="bi bi-journal-text" />
                    </div>
                    <div className="nr-stat-info">
                        <span className="nr-stat-val">{stats.total}</span>
                        <span className="nr-stat-lbl">Total Rapat</span>
                    </div>
                </div>

                <div
                    className={`nr-stat-card ${filterStatus === 'Belum' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('Belum')}
                    title="Klik untuk filter rapat belum ditindaklanjuti"
                >
                    <div className="nr-stat-icon belum">
                        <i className="bi bi-clock-history" />
                    </div>
                    <div className="nr-stat-info">
                        <span className="nr-stat-val">{stats.belum}</span>
                        <span className="nr-stat-lbl">Belum Ditindaklanjuti</span>
                    </div>
                </div>

                <div
                    className={`nr-stat-card ${filterStatus === 'Proses' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('Proses')}
                    title="Klik untuk filter rapat sedang diproses"
                >
                    <div className="nr-stat-icon proses">
                        <i className="bi bi-arrow-repeat" />
                    </div>
                    <div className="nr-stat-info">
                        <span className="nr-stat-val">{stats.proses}</span>
                        <span className="nr-stat-lbl">Sedang Diproses</span>
                    </div>
                </div>

                <div
                    className={`nr-stat-card ${filterStatus === 'Selesai' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('Selesai')}
                    title="Klik untuk filter rapat selesai ditindaklanjuti"
                >
                    <div className="nr-stat-icon selesai">
                        <i className="bi bi-check2-circle" />
                    </div>
                    <div className="nr-stat-info">
                        <span className="nr-stat-val">{stats.selesai}</span>
                        <span className="nr-stat-lbl">Selesai Ditindaklanjuti</span>
                    </div>
                </div>
            </div>

            {/* ── FILTER TOOLBAR ── */}
            <FilterToolbar>
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari agenda rapat, pimpinan, notulis, poin..."
                />
                <FilterSelect
                    label="Status"
                    icon="flag"
                    value={filterStatus}
                    onChange={val => setFilterStatus(String(val))}
                    options={[
                        { value: 'Semua', label: 'Semua Status' },
                        { value: 'Belum', label: 'Belum Ditindaklanjuti' },
                        { value: 'Proses', label: 'Sedang Diproses' },
                        { value: 'Selesai', label: 'Selesai Ditindaklanjuti' },
                    ]}
                    width="170px"
                />
                <FilterActions>
                    {bolehKelola && (
                        <Button
                            variant="primary"
                            onClick={() => {
                                setEditingItem(null);
                                setIsFormOpen(true);
                            }}
                            leftIcon={<i className="bi bi-plus-circle-fill" />}
                        >
                            Buat Notulen Baru
                        </Button>
                    )}
                </FilterActions>
            </FilterToolbar>

            {/* ── DAFTAR NOTULENSI ── */}
            {loading && items.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                    <Spinner variant="buble" />
                </div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--n-card, #ffffff)', borderRadius: '12px', border: '1px solid var(--n-border, #e2e8f0)', marginTop: '16px' }}>
                    <i className="bi bi-journal-x" style={{ fontSize: '2.5rem', color: 'var(--n-muted, #94a3b8)', display: 'block', marginBottom: '10px' }} />
                    <p style={{ fontWeight: 650, fontSize: '0.95rem', color: 'var(--n-ink, #0f172a)', margin: 0 }}>
                        Belum ada data notulensi rapat.
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--n-muted, #64748b)', margin: '4px 0 16px' }}>
                        {filterStatus !== 'Semua' ? 'Tidak ada notulensi dengan filter status ini.' : 'Catat agenda rapat dan hasil tindak lanjut dengan menekan tombol Buat Notulen.'}
                    </p>
                    {bolehKelola && (
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setEditingItem(null);
                                setIsFormOpen(true);
                            }}
                            leftIcon={<i className="bi bi-plus-lg" />}
                        >
                            Buat Notulen Baru
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    {/* ── DESKTOP TABLE ── */}
                    <div className="nr-table-wrap desktop-only" style={{ marginTop: '16px' }}>
                        <table className="nr-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}></th>
                                    <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                                    <th style={{ width: '150px' }}>Tanggal &amp; Waktu</th>
                                    <th>Agenda Rapat</th>
                                    <th style={{ width: '180px' }}>Pimpinan &amp; Notulis</th>
                                    <th style={{ width: '110px', textAlign: 'center' }}>Hasil Poin</th>
                                    <th style={{ width: '140px', textAlign: 'center' }}>Tindak Lanjut</th>
                                    <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const isExpanded = expandedIds.has(item.id || '');
                                    const poinList = item.poin_poin || [];
                                    const poinDone = poinList.filter(p => p.status === 'Selesai').length;

                                    return (
                                        <React.Fragment key={item.id || idx}>
                                            <tr className="nr-row">
                                                <td style={{ textAlign: 'center' }}>
                                                    {poinList.length > 0 && (
                                                        <button
                                                            type="button"
                                                            className="nr-row-expand-btn"
                                                            onClick={() => toggleExpand(item.id || '')}
                                                            title={isExpanded ? 'Tutup rincian poin' : 'Lihat rincian poin'}
                                                        >
                                                            <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`} />
                                                        </button>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', color: 'var(--n-muted)', fontWeight: 600 }}>
                                                    {idx + 1}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 650, fontSize: '0.84rem' }}>
                                                        {formatDateShort(item.tanggal)}
                                                    </div>
                                                    {item.waktu_mulai && (
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--n-muted)', marginTop: '2px' }}>
                                                            <i className="bi bi-clock" style={{ marginRight: '4px' }} />
                                                            {item.waktu_mulai}{item.waktu_selesai ? ` - ${item.waktu_selesai}` : ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--n-ink)' }}>
                                                        {item.agenda}
                                                    </div>
                                                    {item.lokasi && (
                                                        <div style={{ fontSize: '0.76rem', color: 'var(--n-muted)', marginTop: '2px' }}>
                                                            <i className="bi bi-geo-alt-fill" style={{ marginRight: '4px' }} />
                                                            {item.lokasi}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {item.pimpinan_rapat && (
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                                            <span style={{ color: 'var(--n-muted)', fontWeight: 500 }}>Pim:</span> {item.pimpinan_rapat}
                                                        </div>
                                                    )}
                                                    {item.notulis && (
                                                        <div style={{ fontSize: '0.76rem', color: 'var(--n-muted)', marginTop: '2px' }}>
                                                            <span>Not:</span> {item.notulis}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {poinList.length > 0 ? (
                                                        <span
                                                            style={{
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 650,
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(48,131,255,0.08)',
                                                                color: 'var(--n-primary, #3083FF)',
                                                            }}
                                                            onClick={() => toggleExpand(item.id || '')}
                                                            title="Klik untuk melihat rincian poin"
                                                        >
                                                            <i className="bi bi-list-check" />
                                                            {poinDone}/{poinList.length} Poin
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--n-muted)', fontSize: '0.78rem' }}>-</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div className="nr-status-select-wrap">
                                                        <button
                                                            type="button"
                                                            className="nr-status-btn-compact"
                                                            disabled={!bolehKelola}
                                                            onClick={() => setActiveDropdownId(activeDropdownId === item.id ? null : item.id || null)}
                                                            title={bolehKelola ? 'Klik untuk mengubah status tindak lanjut' : 'Status tindak lanjut'}
                                                        >
                                                            <span className={`nr-pill ${item.status.toLowerCase()}`}>
                                                                <span className="nr-pill-dot" />
                                                                <span>{item.status}</span>
                                                                {bolehKelola && <i className="bi bi-caret-down-fill" style={{ fontSize: '0.65rem', marginLeft: '2px' }} />}
                                                            </span>
                                                        </button>

                                                        {activeDropdownId === item.id && bolehKelola && (
                                                            <div className="nr-status-dropdown">
                                                                <button
                                                                    type="button"
                                                                    className="nr-status-opt"
                                                                    onClick={() => handleQuickChangeStatus(item, 'Belum')}
                                                                >
                                                                    <span className="nr-pill belum" style={{ padding: '2px 6px' }}>Belum</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="nr-status-opt"
                                                                    onClick={() => handleQuickChangeStatus(item, 'Proses')}
                                                                >
                                                                    <span className="nr-pill proses" style={{ padding: '2px 6px' }}>Proses</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="nr-status-opt"
                                                                    onClick={() => handleQuickChangeStatus(item, 'Selesai')}
                                                                >
                                                                    <span className="nr-pill selesai" style={{ padding: '2px 6px' }}>Selesai</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <ActionGroup>
                                                        <ActionButton
                                                            action="view"
                                                            onClick={() => setPrintItem(item)}
                                                            title="Pratinjau & Cetak Notulensi"
                                                        />
                                                        {bolehKelola && (
                                                            <>
                                                                <ActionButton
                                                                    action="edit"
                                                                    onClick={() => {
                                                                        setEditingItem(item);
                                                                        setIsFormOpen(true);
                                                                    }}
                                                                    title="Edit Notulensi"
                                                                />
                                                                <ActionButton
                                                                    action="delete"
                                                                    onClick={() => handleDelete(item)}
                                                                    title="Hapus Notulensi"
                                                                />
                                                            </>
                                                        )}
                                                    </ActionGroup>
                                                </td>
                                            </tr>

                                            {/* Baris Rincian Poin Terbuka */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={8} className="nr-expand-cell">
                                                        <div style={{ marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-ink)' }}>
                                                            <i className="bi bi-list-stars" style={{ marginRight: '6px', color: '#3083FF' }} />
                                                            Rincian Poin Pembahasan &amp; Tindak Lanjut:
                                                        </div>
                                                        <div className="nr-poin-list-detail">
                                                            {poinList.map((p, pIdx) => (
                                                                <div key={p.id || pIdx} className="nr-poin-item-row">
                                                                    <div className="nr-poin-left">
                                                                        <span className="nr-poin-num">{pIdx + 1}</span>
                                                                        <div>
                                                                            <span className="nr-poin-text">{p.teks}</span>
                                                                            {p.keterangan && (
                                                                                <div style={{ fontSize: '0.74rem', color: 'var(--n-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                                                                                    Catatan: {p.keterangan}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="nr-poin-meta">
                                                                        {p.pic && (
                                                                            <span className="nr-poin-pic" title="Penanggung Jawab">
                                                                                <i className="bi bi-person-fill" /> {p.pic}
                                                                            </span>
                                                                        )}
                                                                        {p.tenggat && (
                                                                            <span className="nr-poin-pic" title="Tenggat Waktu">
                                                                                <i className="bi bi-calendar-event" /> {p.tenggat}
                                                                            </span>
                                                                        )}
                                                                        {bolehKelola ? (
                                                                            <InlineSelect
                                                                                value={p.status}
                                                                                onChange={val => handleTogglePoinStatus(item.id || '', p, val)}
                                                                                options={[
                                                                                    { value: 'Belum', label: 'Belum' },
                                                                                    { value: 'Proses', label: 'Proses' },
                                                                                    { value: 'Selesai', label: 'Selesai' },
                                                                                ]}
                                                                                minWidth="95px"
                                                                                height="28px"
                                                                            />
                                                                        ) : (
                                                                            <span className={`nr-pill ${p.status.toLowerCase()}`}>
                                                                                <span className="nr-pill-dot" />
                                                                                {p.status}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── MOBILE CARDS ── */}
                    <div className="nr-cards-mobile mobile-only" style={{ marginTop: '14px' }}>
                        {items.map(item => {
                            const poinList = item.poin_poin || [];
                            const poinDone = poinList.filter(p => p.status === 'Selesai').length;

                            return (
                                <div key={item.id} className="nr-card">
                                    <div className="nr-card-header">
                                        <div className="nr-card-title">{item.agenda}</div>
                                        <span className={`nr-pill ${item.status.toLowerCase()}`}>
                                            <span className="nr-pill-dot" />
                                            {item.status}
                                        </span>
                                    </div>

                                    <div className="nr-card-meta-list">
                                        <div className="nr-meta-row">
                                            <i className="bi bi-calendar3" />
                                            <span>{formatDateShort(item.tanggal)} {item.waktu_mulai ? `· ${item.waktu_mulai}` : ''}</span>
                                        </div>
                                        {item.lokasi && (
                                            <div className="nr-meta-row">
                                                <i className="bi bi-geo-alt-fill" />
                                                <span>{item.lokasi}</span>
                                            </div>
                                        )}
                                        {item.pimpinan_rapat && (
                                            <div className="nr-meta-row">
                                                <i className="bi bi-person-badge-fill" />
                                                <span>Pimpinan: {item.pimpinan_rapat}</span>
                                            </div>
                                        )}
                                    </div>

                                    {poinList.length > 0 && (
                                        <div className="nr-card-poin-summary">
                                            <div style={{ fontWeight: 650, marginBottom: '4px' }}>
                                                Poin Tindak Lanjut: {poinDone}/{poinList.length} Selesai
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {poinList.slice(0, 3).map((p, pIdx) => (
                                                    <div key={p.id || pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                                                            • {p.teks}
                                                        </span>
                                                        <span className={`nr-pill ${p.status.toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                ))}
                                                {poinList.length > 3 && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--n-primary)', fontWeight: 600 }}>
                                                        +{poinList.length - 3} poin lainnya...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="nr-card-actions">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setPrintItem(item)}
                                            leftIcon={<i className="bi bi-printer" />}
                                        >
                                            Cetak
                                        </Button>

                                        {bolehKelola && (
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        setIsFormOpen(true);
                                                    }}
                                                    leftIcon={<i className="bi bi-pencil" />}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => handleDelete(item)}
                                                    leftIcon={<i className="bi bi-trash3" />}
                                                >
                                                    Hapus
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Modal Input/Edit */}
            {isFormOpen && (
                <NotulensiModal
                    isOpen={isFormOpen}
                    onClose={() => {
                        setIsFormOpen(false);
                        setEditingItem(null);
                    }}
                    onSave={handleSave}
                    initialData={editingItem}
                    saving={saving}
                />
            )}

            {/* Modal Cetak Berita Acara */}
            {printItem && (
                <NotulensiPrintModal
                    isOpen={!!printItem}
                    onClose={() => setPrintItem(null)}
                    data={printItem}
                />
            )}
        </div>
    );
}
