'use client';

import { useState, useEffect, useMemo } from 'react';
import Pagination from '@/components/ui/Pagination';
import { StatusBadge, JenisBadge } from '../components/StatusBadge';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import { useIsMobile } from '@/hooks/use-breakpoint';
import { getProxiedImageUrl } from '@/lib/image-utils';
import type { PermintaanSuratRow } from '../components/DetailPermintaanModal';

interface TabSemuaPermintaanProps {
  rows: PermintaanSuratRow[];
  loading: boolean;
  canManage?: boolean;
  userNip?: string;
  onView: (row: PermintaanSuratRow) => void;
  onDelete: (id: string) => void;
  onEdit: (row: PermintaanSuratRow) => void;
  onApprove: (row: PermintaanSuratRow) => void;
}

export default function TabSemuaPermintaan({
  rows,
  loading,
  canManage,
  userNip,
  onView,
  onDelete,
  onEdit,
  onApprove,
}: TabSemuaPermintaanProps) {
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const { openFile, viewer } = useFileViewer();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const fotoById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.foto_profil) map.set(r.id, getProxiedImageUrl(r.foto_profil));
    }
    return map;
  }, [rows]);

  useEffect(() => {
    const fetchTz = async () => {
      try {
        const res = await fetch('/api/site-settings?key=timezone');
        const json = await res.json();
        const tzVal = json.data?.value || json.value;
        if (tzVal) {
          const valid = TIMEZONE_OPTIONS.map((t) => t.value);
          if (valid.includes(tzVal as any)) {
            setTimezone(tzVal);
          }
        }
      } catch (e) {
        console.error('Error fetching timezone:', e);
      }
    };
    fetchTz();
  }, []);

  const formatDate = (d: string) => {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: timezone,
    });
  };

  const isPending = (status: string) => {
    const s = (status || '').toLowerCase();
    return s === 'pending' || s === 'menunggu';
  };

  const getFirstAttachmentUrl = (row: PermintaanSuratRow): { url: string; name: string } | null => {
    if (Array.isArray(row.lampiran_json) && row.lampiran_json.length > 0) {
      const first = row.lampiran_json[0];
      if (typeof first === 'string') return { url: first, name: first.split('/').pop() || 'Lampiran' };
      if (first && first.url) return { url: first.url, name: first.name || 'Lampiran' };
    } else if (typeof row.lampiran_json === 'string' && row.lampiran_json) {
      return { url: row.lampiran_json, name: 'Lampiran' };
    }
    return null;
  };

  const getInitials = (nama: string) => {
    if (!nama) return '?';
    const parts = nama.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // ── Mobile View — Custom Clean Cards ───────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {loading ? (
          <div className="ps-mob-loading">
            <Spinner variant="buble" label="Memuat data..." />
          </div>
        ) : rows.length === 0 ? (
          <div className="ps-mob-empty">
            <i className="bi bi-folder2-open" />
            <p>Belum ada permintaan surat</p>
            <span>Tidak ada data yang sesuai dengan saringan saat ini</span>
          </div>
        ) : (
          <div className="ps-mob-list">
            {paginatedRows.map((row) => {
              const pending = isPending(row.status);
              const isOwner = !userNip || row.pemohon_nip === userNip;
              const canEditRow = pending && (isOwner || canManage);
              const canDeleteRow = pending && (isOwner || canManage);
              const canApproveRow = canManage && (pending || (row.status || '').toLowerCase() === 'diproses');
              const fileAttachment = getFirstAttachmentUrl(row);
              const avatarSrc = fotoById.get(row.id);
              const initials = getInitials(row.pemohon_nama || '');

              return (
                <div
                  key={row.id}
                  className="ps-mob-card"
                  onClick={() => onView(row)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(row); }
                  }}
                >
                  {/* Header: avatar + nama + status */}
                  <div className="ps-mob-card__header">
                    <div className="ps-mob-avatar">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={row.pemohon_nama || ''} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="ps-mob-card__meta">
                      <div className="ps-mob-card__name">{row.pemohon_nama || '—'}</div>
                      {row.pemohon_nip && (
                        <div className="ps-mob-card__nip">{row.pemohon_nip}</div>
                      )}
                    </div>
                    <StatusBadge status={row.status} />
                  </div>

                  {/* Body */}
                  <div className="ps-mob-card__body">
                    <div className="ps-mob-card__row">
                      <JenisBadge jenis={row.jenis_surat} />
                      <span className="ps-mob-card__date">
                        <i className="bi bi-calendar3" />
                        {formatDate(row.created_at)}
                      </span>
                    </div>
                    {row.judul && (
                      <div className="ps-mob-card__judul">{row.judul}</div>
                    )}
                    {row.keperluan && (
                      <div className="ps-mob-card__keperluan">{row.keperluan}</div>
                    )}
                    {row.nomor_surat && (
                      <div className="ps-mob-card__nomor">
                        <i className="bi bi-hash" />
                        {row.nomor_surat}
                      </div>
                    )}
                    {(row.status || '').toLowerCase() === 'ditolak' &&
                      (row.approved_catatan || row.status_catatan) && (
                        <div className="ps-mob-card__tolak-note">
                          <i className="bi bi-exclamation-circle-fill" />
                          {row.approved_catatan || row.status_catatan}
                        </div>
                      )}
                  </div>

                  {/* Footer actions */}
                  {(canEditRow || canApproveRow || canDeleteRow || fileAttachment) && (
                    <div className="ps-mob-card__footer" onClick={(e) => e.stopPropagation()}>
                      {canApproveRow && (
                        <button type="button" className="ps-mob-btn ps-mob-btn--approve" onClick={() => onApprove(row)}>
                          <i className="bi bi-check-circle" /> Tinjau
                        </button>
                      )}
                      {canEditRow && (
                        <button type="button" className="ps-mob-btn ps-mob-btn--edit" onClick={() => onEdit(row)}>
                          <i className="bi bi-pencil" /> Edit
                        </button>
                      )}
                      {fileAttachment && (
                        <button type="button" className="ps-mob-btn ps-mob-btn--file" onClick={() => openFile(fileAttachment.url, fileAttachment.name)}>
                          <i className="bi bi-paperclip" /> Lampiran
                        </button>
                      )}
                      {canDeleteRow && (
                        <button type="button" className="ps-mob-btn ps-mob-btn--delete" onClick={() => onDelete(row.id)}>
                          <i className="bi bi-trash3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          limit={pageSize}
          totalItems={rows.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          itemLabel="permintaan"
        />
        {viewer}
      </>
    );
  }

  // ── Desktop Table View ─────────────────────────────────────────────────────
  return (
    <div className="ps-card">
      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead>
            <tr>
              <th>Pemohon / NIP</th>
              <th>Jenis Surat</th>
              <th>Tanggal</th>
              <th>Judul & Keperluan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spinner variant="buble" label="Memuat data permintaan surat..." />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="ps-empty">
                    <i className="bi bi-folder2-open" />
                    <p>Belum ada data permintaan surat</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const pending = isPending(row.status);
                const isOwner = !userNip || row.pemohon_nip === userNip;
                const canEditRow = pending && (isOwner || canManage);
                const canDeleteRow = pending && (isOwner || canManage);
                const canApproveRow = canManage && (pending || (row.status || '').toLowerCase() === 'diproses');
                const fileAttachment = getFirstAttachmentUrl(row);

                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.pemohon_nama || '—'}</div>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: 'var(--ps-text-muted)',
                        }}
                      >
                        {row.pemohon_nip || '—'}
                      </div>
                    </td>
                    <td>
                      <JenisBadge jenis={row.jenis_surat} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem' }}>
                      {formatDate(row.created_at)}
                    </td>
                    <td>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.86rem',
                            maxWidth: 240,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.judul}
                        >
                          {row.judul}
                        </div>
                        {row.nomor_surat && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              color: 'var(--ps-accent)',
                              marginTop: 2,
                            }}
                          >
                            <i className="bi bi-hash" /> {row.nomor_surat}
                          </div>
                        )}
                        {row.keperluan && (
                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: 'var(--ps-text-muted)',
                              maxWidth: 240,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: 2,
                            }}
                            title={row.keperluan}
                          >
                            {row.keperluan}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <StatusBadge status={row.status} />
                        {(row.status || '').toLowerCase() === 'ditolak' &&
                          (row.approved_catatan || row.status_catatan) && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: '#991b1b',
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={row.approved_catatan || row.status_catatan || ''}
                            >
                              <i className="bi bi-exclamation-circle" />{' '}
                              {row.approved_catatan || row.status_catatan}
                            </span>
                          )}
                        {row.approved_at && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--ps-text-muted)',
                            }}
                          >
                            <i className="bi bi-person-check" />{' '}
                            {row.approved_by || 'Disetujui'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <ActionGroup>
                        <ActionButton
                          action="view"
                          title="Lihat Detail"
                          onClick={() => onView(row)}
                        />

                        {canEditRow && (
                          <ActionButton
                            action="edit"
                            title="Edit Pengajuan"
                            onClick={() => onEdit(row)}
                          />
                        )}

                        {canApproveRow && (
                          <button
                            type="button"
                            className="btn-icon-soft ps-btn-icon--approve"
                            data-tooltip="Setujui / Tolak"
                            aria-label="Setujui / Tolak"
                            onClick={() => onApprove(row)}
                          >
                            <i className="bi bi-check-circle" />
                          </button>
                        )}

                        {canDeleteRow && (
                          <ActionButton
                            action="delete"
                            title="Batalkan / Hapus"
                            onClick={() => onDelete(row.id)}
                          />
                        )}

                        {fileAttachment && (
                          <ActionButton
                            action="file"
                            title="Lihat Lampiran"
                            onClick={() =>
                              openFile(fileAttachment.url, fileAttachment.name)
                            }
                          />
                        )}
                      </ActionGroup>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--ps-tb-border)' }}>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          limit={pageSize}
          totalItems={rows.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          itemLabel="permintaan"
        />
      </div>

      {viewer}
    </div>
  );
}
