'use client';
import Pagination from '@/components/ui/Pagination';

import { useState, useEffect, useMemo } from 'react';
import type { User } from '@/lib/types';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import MaintenanceBanner from '@/components/MaintenanceBanner';

interface AuditLog {
    id: string;
    user_id: string | null;
    user_nip: string | null;
    user_name: string | null;
    user_role: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    details: any;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    DELETE_INFORMASI_DOC: { label: 'Hapus Dokumen', color: '#dc2626', bg: '#fef2f2', icon: 'bi-file-earmark-x' },
    DELETE_INFORMASI_FOLDER: { label: 'Hapus Folder', color: '#b91c1c', bg: '#fee2e2', icon: 'bi-folder-x' },
    DELETE_PENGUMUMAN: { label: 'Hapus Pengumuman', color: '#ea580c', bg: '#fff7ed', icon: 'bi-trash3' },
    CREATE_SHARE_LINK: { label: 'Buat Link Publik', color: '#16a34a', bg: '#f0fdf4', icon: 'bi-link-45deg' },
    REVOKE_SHARE_LINK: { label: 'Nonaktifkan Link', color: '#ca8a04', bg: '#fefce8', icon: 'bi-toggle2-off' },
    RESTORE_SHARE_LINK: { label: 'Aktifkan Link', color: '#0284c7', bg: '#f0f9ff', icon: 'bi-toggle2-on' },
    DELETE_SHARE_LINK: { label: 'Hapus Link Publik', color: '#9333ea', bg: '#faf5ff', icon: 'bi-link' },
};

const ENTITY_LABELS: Record<string, string> = {
    informasi_akademik: 'Informasi Akademik',
    uploaded_documents: 'Dokumen Unggahan',
    informasi_share_links: 'Link Publik',
    pengumuman: 'Pengumuman',
};

export default function AuditLogView({ user }: { user?: User }) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('Semua');
    const [entityFilter, setEntityFilter] = useState('Semua');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const userRoles = (user?.roles || []).map(r => r.toUpperCase());
    const isAdminOrWkm = userRoles.some(r =>
        r === 'ADMIN' || r === 'ADMINISTRATOR' || r === 'OP_PENGUMUMAN' || r.startsWith('WKM_') || r === 'KAMAD' || r === 'KTU' || r === 'PENGAWAS_MADRASAH' || r === 'SUPERVISOR'
    ) || (user?.pagesArray || []).includes('audit-log');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const offset = (page - 1) * pageSize;
            const params = new URLSearchParams({
                limit: String(pageSize),
                offset: String(offset),
            });
            if (entityFilter !== 'Semua') {
                params.set('entity', entityFilter);
            }
            if (actionFilter !== 'Semua') {
                params.set('action', actionFilter);
            }
            if (searchQuery.trim()) {
                params.set('search', searchQuery.trim());
            }

            const res = await fetch(`/api/audit-logs?${params.toString()}`);
            const json = await res.json();
            if (json.ok && Array.isArray(json.data)) {
                setLogs(json.data);
                setTotal(json.total || 0);
            } else {
                setLogs([]);
                setTotal(0);
            }
        } catch (error) {
            console.error('Gagal memuat riwayat audit:', error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdminOrWkm) {
            fetchLogs();
        }
    }, [page, pageSize, entityFilter, actionFilter]);

    // Handle search on submit or debounce
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    const totalPages = Math.ceil(total / pageSize) || 1;

    const formatTimestamp = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    const renderActionBadge = (action: string) => {
        const conf = ACTION_CONFIG[action] || {
            label: action,
            color: '#64748b',
            bg: '#f1f5f9',
            icon: 'bi-activity',
        };
        return (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: conf.color,
                    background: conf.bg,
                    border: `1px solid ${conf.color}30`,
                }}
            >
                <i className={`bi ${conf.icon}`} style={{ fontSize: '0.85rem' }} />
                {conf.label}
            </span>
        );
    };

    const getPrimarySummary = (item: AuditLog) => {
        const d = item.details || {};
        if (d.title) return d.title;
        if (d.file_name) return d.file_name;
        if (d.category) return `Folder: ${d.category}`;
        if (d.token) return `Token: ${d.token.slice(0, 10)}...`;
        if (d.label) return d.label;
        return item.entity_id ? `#${item.entity_id}` : '-';
    };

    if (!isAdminOrWkm) {
        return (
            <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
                <i className="bi bi-shield-lock" style={{ fontSize: '3.5rem', color: '#94a3b8' }} />
                <h3 style={{ marginTop: '1rem', fontWeight: 700 }}>Akses Ditolak</h3>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
                    Halaman Jejak Audit Sistem hanya dapat diakses oleh Administrator dan Pengelola Sistem.
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header Title */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="bi bi-shield-shaded" style={{ color: 'var(--n-primary, #3b82f6)' }} />
                        Jejak Audit Sistem (Audit Trail)
                    </h1>
                    <p style={{ color: 'var(--n-muted, #64748b)', margin: '4px 0 0', fontSize: '0.875rem' }}>
                        Catatan forensik seluruh tindakan destruktif, penghapusan berkas, pengelolaan link publik, dan mutasi kritis di seluruh modul aplikasi.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                        variant="secondary"
                        onClick={fetchLogs}
                        title="Segarkan data"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
                        Segarkan
                    </Button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <FilterToolbar
                leading={
                    <form onSubmit={handleSearchSubmit} style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                        <FilterSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Cari nama, NIP, judul berkas..."
                        />
                    </form>
                }
            >
                <FilterSelect
                    value={actionFilter}
                    onChange={(val) => {
                        setActionFilter(val);
                        setPage(1);
                    }}
                    options={[
                        { value: 'Semua', label: 'Semua Jenis Aksi' },
                        { value: 'DELETE_INFORMASI_DOC', label: 'Hapus Dokumen' },
                        { value: 'DELETE_INFORMASI_FOLDER', label: 'Hapus Folder' },
                        { value: 'CREATE_SHARE_LINK', label: 'Buat Link Publik' },
                        { value: 'REVOKE_SHARE_LINK', label: 'Nonaktifkan Link' },
                        { value: 'RESTORE_SHARE_LINK', label: 'Aktifkan Link' },
                        { value: 'DELETE_SHARE_LINK', label: 'Hapus Link Publik' },
                        { value: 'DELETE_PENGUMUMAN', label: 'Hapus Pengumuman' },
                    ]}
                />
                <FilterSelect
                    value={entityFilter}
                    onChange={(val) => {
                        setEntityFilter(val);
                        setPage(1);
                    }}
                    options={[
                        { value: 'Semua', label: 'Semua Modul / Entitas' },
                        { value: 'informasi_akademik', label: 'Informasi Akademik' },
                        { value: 'uploaded_documents', label: 'Dokumen Unggahan' },
                        { value: 'informasi_share_links', label: 'Link Publik' },
                        { value: 'pengumuman', label: 'Pengumuman' },
                    ]}
                />
            </FilterToolbar>

            {/* Data Table */}
            {loading ? (
                <div style={{ padding: '5rem 0', textAlign: 'center' }}>
                    <Spinner size={32} />
                    <p style={{ marginTop: '1rem', color: 'var(--n-muted, #64748b)' }}>Memuat riwayat audit...</p>
                </div>
            ) : logs.length === 0 ? (
                <div
                    style={{
                        padding: '4rem 1rem',
                        textAlign: 'center',
                        background: 'var(--n-card, #ffffff)',
                        borderRadius: '12px',
                        border: '1px solid var(--n-border, #e2e8f0)',
                        margin: '1.5rem 0',
                    }}
                >
                    <i className="bi bi-shield-check" style={{ fontSize: '3.5rem', color: 'var(--n-muted, #94a3b8)' }} />
                    <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--n-ink, #0f172a)' }}>Belum Ada Catatan Audit</h4>
                    <p style={{ color: 'var(--n-muted, #64748b)', fontSize: '0.875rem' }}>
                        Setiap aksi penghapusan berkas, folder, pengumuman, atau perubahan link publik akan otomatis tercatat di halaman ini.
                    </p>
                </div>
            ) : (
                <>
                    <div
                        style={{
                            background: 'var(--n-card, #ffffff)',
                            borderRadius: '12px',
                            border: '1px solid var(--n-border, #e2e8f0)',
                            overflow: 'hidden',
                            marginTop: '1.25rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                    >
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--n-card-hover, #f8fafc)', borderBottom: '1px solid var(--n-border, #e2e8f0)' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-muted, #64748b)' }}>WAKTU</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-muted, #64748b)' }}>PELAKU</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-muted, #64748b)' }}>TINDAKAN</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-muted, #64748b)' }}>MODUL</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-muted, #64748b)' }}>RINGKASAN TARGET</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-muted, #64748b)' }}>AKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((item) => (
                                    <tr
                                        key={item.id}
                                        style={{ borderBottom: '1px solid var(--n-border, #e2e8f0)', fontSize: '0.875rem' }}
                                    >
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--n-muted, #64748b)', fontSize: '0.8rem' }}>
                                            {formatTimestamp(item.created_at)}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--n-ink, #0f172a)' }}>
                                                {item.user_name || 'Sistem / Anonim'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--n-muted, #64748b)' }}>
                                                {item.user_nip ? `NIP: ${item.user_nip}` : ''}
                                                {item.user_role && ` • ${item.user_role}`}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                            {renderActionBadge(item.action)}
                                        </td>
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--n-ink, #0f172a)' }}>
                                                {ENTITY_LABELS[item.entity] || item.entity}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', maxWidth: '320px' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--n-ink, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {getPrimarySummary(item)}
                                            </div>
                                            {item.details?.division && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--n-muted, #64748b)' }}>
                                                    Divisi: {item.details.division}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLog(item)}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--n-border, #cbd5e1)',
                                                    background: '#ffffff',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    color: 'var(--n-primary, #3b82f6)',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}
                                            >
                                                <i className="bi bi-eye" /> Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '1.5rem',
                                padding: '12px 16px',
                                background: 'var(--n-card, #ffffff)',
                                borderRadius: '10px',
                                border: '1px solid var(--n-border, #e2e8f0)',
                                fontSize: '0.85rem',
                                color: 'var(--n-muted, #64748b)',
                            }}
                        >
                            <span>
                                Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong> (Total <strong>{total}</strong> log)
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                >
                                    Sebelumnya
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal Detail Audit */}
            {selectedLog && (
                <Modal
                    open={Boolean(selectedLog)}
                    onClose={() => setSelectedLog(null)}
                    size="lg"
                    title="Rincian Jejak Audit Forensik"
                    subtitle="Snapshot lengkap metadata sebelum aksi eksekusi dilakukan"
                >
                    <ModalBody>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>WAKTU EKSEKUSI</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                                    {formatTimestamp(selectedLog.created_at)}
                                </div>
                            </div>
                            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TINDAKAN</div>
                                <div style={{ marginTop: '2px' }}>
                                    {renderActionBadge(selectedLog.action)}
                                </div>
                            </div>
                            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PELAKU AKSI</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                                    {selectedLog.user_name || 'Tidak Diketahui'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    NIP: {selectedLog.user_nip || '-'} • Peran: {selectedLog.user_role || '-'}
                                </div>
                            </div>
                            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>MODUL / ENTITAS</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                                    {ENTITY_LABELS[selectedLog.entity] || selectedLog.entity}
                                </div>
                                {selectedLog.entity_id && (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {selectedLog.entity_id}</div>
                                )}
                            </div>
                            {selectedLog.ip_address && (
                                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ALAMAT IP KLIEN</div>
                                    <code style={{ fontSize: '0.85rem', color: '#0f172a', marginTop: '2px', display: 'inline-block' }}>
                                        {selectedLog.ip_address}
                                    </code>
                                </div>
                            )}
                        </div>

                        {selectedLog.user_agent && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                                    PERAMBAN / USER AGENT
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '8px', borderRadius: '6px', wordBreak: 'break-all', lineHeight: 1.4 }}>
                                    {selectedLog.user_agent}
                                </div>
                            </div>
                        )}

                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                                DATA SNAPSHOT (JSON SEBELUM DIUBAH / DIHAPUS)
                            </div>
                            <pre
                                style={{
                                    background: '#0f172a',
                                    color: '#38bdf8',
                                    padding: '14px',
                                    borderRadius: '8px',
                                    fontSize: '0.78rem',
                                    overflowX: 'auto',
                                    maxHeight: '260px',
                                    margin: 0,
                                    lineHeight: 1.5,
                                }}
                            >
                                {JSON.stringify(selectedLog.details || {}, null, 2)}
                            </pre>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setSelectedLog(null)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <MaintenanceBanner pageKey="maintenance_audit_logs" />
        </div>
    );
}
