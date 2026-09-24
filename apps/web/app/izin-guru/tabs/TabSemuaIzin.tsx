'use client';

import { useState, useEffect, useMemo } from 'react';
import { StatusBadge, JenisBadge } from '../components/StatusBadge';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone';
import { useFileViewer } from '@/components/useFileViewer';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import { useIsMobile } from '@/hooks/use-breakpoint';
import { MobileList, MobileListItem, MobileEmpty } from '@/components/mobile';
import { getProxiedImageUrl } from '@/lib/image-utils';

export interface IzinRow {
  id: string;
  nip: string;
  nama_guru: string;
  jenis: 'izin' | 'sakit' | 'dinas_luar';
  tanggal_mulai: string;
  tanggal_selesai: string;
  keterangan: string | null;
  nomor_surat: string | null;
  instansi_tujuan: string | null;
  surat_tugas_url: string | null;
  status: 'pending' | 'disetujui' | 'ditolak';
  catatan_penolakan: string | null;
  approved_by: string | null;
  approved_by_nama: string | null;
  approved_at: string | null;
  created_at: string;
  /** Foto profil pemilik NIP, ditempelkan oleh GET /api/izin-guru. */
  foto_profil?: string | null;
}

interface TabSemuaIzinProps {
  rows: IzinRow[];
  loading: boolean;
  onView: (row: IzinRow) => void;
  onDelete: (id: string) => void;
  onEdit: (row: IzinRow) => void;
  onApprove: (row: IzinRow) => void;
}

const JENIS_LABEL: Record<IzinRow['jenis'], string> = {
  izin: 'Izin',
  sakit: 'Sakit',
  dinas_luar: 'Dinas Luar',
};

export default function TabSemuaIzin({ rows, loading, onView, onDelete, onEdit, onApprove }: TabSemuaIzinProps) {
  // Timezone state
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const { openFile, viewer } = useFileViewer();
  const isMobile = useIsMobile();

  /**
   * URL foto per baris, dihitung sekali per perubahan `rows`.
   *
   * getProxiedImageUrl menempelkan `t=Date.now()` untuk URL yang lewat proxy;
   * memanggilnya langsung di dalam render akan menghasilkan URL baru tiap
   * render, sehingga tiap foto diunduh ulang dan berkedip saat daftar
   * di-render ulang (mis. saat saringan berubah).
   */
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
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: timezone,
    });
  };

  /** Tanggal tanpa tahun — dipakai di ujung awal rentang yang setahun. */
  const formatDateNoYear = (d: string) => {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short',
      timeZone: timezone,
    });
  };

  /**
   * Tanggal ringkas untuk satu baris daftar mobile. Rentang dalam tahun yang
   * sama menulis tahunnya sekali di ujung — "03 Sep 2026 s/d 05 Sep 2026"
   * memakan lebar yang tidak ada di layar HP.
   */
  const tanggalRingkas = (row: IzinRow) => {
    const mulai = row.tanggal_mulai;
    const selesai = row.tanggal_selesai || mulai;
    if (!mulai) return '—';
    if (mulai === selesai) return formatDate(mulai);
    const setahun = mulai.slice(0, 4) === selesai.slice(0, 4);
    return `${setahun ? formatDateNoYear(mulai) : formatDate(mulai)} – ${formatDate(selesai)}`;
  };

  /* ── Mobile: daftar baris, bukan kartu ────────────────────────────────────
     Baris sengaja hanya memuat nama, jenis, tanggal, dan penanda "Menunggu".
     Sisa field (keterangan, instansi, verifikator, lampiran) beserta seluruh
     aksinya sudah tersedia di DetailIzinModal yang terbuka saat baris diketuk,
     jadi tidak perlu diulang di tiap baris. */
  if (isMobile) {
    return (
      <>
        {loading ? (
          <div className="mui-loading"><Spinner variant="trace" /></div>
        ) : rows.length === 0 ? (
          <MobileEmpty
            icon="folder2-open"
            title="Belum ada data pengajuan"
            subtitle="Tidak ada pengajuan yang cocok dengan saringan saat ini"
          />
        ) : (
          <MobileList label="Daftar pengajuan izin guru">
            {rows.map(row => (
              <MobileListItem
                key={row.id}
                title={row.nama_guru}
                // Rona avatar dikunci ke NIP supaya guru yang sama selalu
                // sewarna walau namanya ditulis berbeda antar baris. Rona ini
                // hanya terlihat saat fotonya tidak ada.
                seed={row.nip || row.nama_guru}
                avatarSrc={fotoById.get(row.id)}
                // Cadangan saat guru belum mengunggah foto: avatar orang, bukan
                // inisial nama.
                icon="person-fill"
                subtitle={`${JENIS_LABEL[row.jenis] ?? row.jenis} · ${tanggalRingkas(row)}`}
                // Hanya yang belum diputuskan yang diberi tanda. "Disetujui"
                // adalah keadaan normal — menandainya di tiap baris jadi derau.
                badge={row.status === 'pending'
                  ? <span className="mui-badge isWarn">Menunggu</span>
                  : undefined}
                onClick={() => onView(row)}
              />
            ))}
          </MobileList>
        )}
        {viewer}
      </>
    );
  }

  return (
    <div className="ig-card">
      <div className="ig-table-wrap">
        <table className="ig-table">
          <thead>
            <tr>
              <th>Guru / NIP</th>
              <th>Jenis</th>
              <th>Tanggal</th>
              <th>Keterangan / Tujuan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spinner variant="trace" label="Memuat data pengajuan..." />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="ig-empty">
                    <i className="bi bi-folder2-open" />
                    <p>Belum ada data pengajuan</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isRange = row.tanggal_mulai !== row.tanggal_selesai;
                const isDinas = row.jenis === 'dinas_luar';
                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.nama_guru}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--ig-text-muted)' }}>{row.nip}</div>
                    </td>
                    <td><JenisBadge jenis={row.jenis} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isRange
                        ? <><span style={{ fontSize: '0.78rem' }}>{formatDate(row.tanggal_mulai)}</span><br /><span style={{ fontSize: '0.78rem', color: 'var(--ig-text-muted)' }}>s/d {formatDate(row.tanggal_selesai)}</span></>
                        : formatDate(row.tanggal_mulai)
                      }
                    </td>
                    <td>
                      {isDinas ? (
                        <div>
                          <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }} title={row.instansi_tujuan || ''}>
                            <i className="bi bi-building" style={{ marginRight: 4, color: 'var(--ig-text-muted)' }} />
                            {row.instansi_tujuan || '—'}
                          </div>
                          {row.keterangan && (
                             <div style={{ fontSize: '0.75rem', color: 'var(--ig-text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.keterangan}>
                               {row.keterangan}
                             </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ maxWidth: 200, fontSize: '0.85rem', color: 'var(--ig-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.keterangan || ''}>
                          {row.keterangan || '-'}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <StatusBadge status={row.status} />
                        {row.status === 'ditolak' && row.catatan_penolakan && (
                          <span style={{ fontSize: '0.68rem', color: '#991b1b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.catatan_penolakan}>
                            <i className="bi bi-exclamation-circle" /> {row.catatan_penolakan}
                          </span>
                        )}
                        {row.approved_at && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--ig-text-muted)' }}>
                            <i className="bi bi-person-check" /> {row.approved_by_nama || '—'}
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
                        {row.status === 'pending' && (
                          <>
                            <ActionButton
                              action="edit"
                              title="Edit Pengajuan"
                              onClick={() => onEdit(row)}
                            />
                            <button
                              type="button"
                              className="btn-icon-soft ig-btn-icon--approve"
                              data-tooltip={isDinas ? "Verifikasi & Setujui" : "Setujui / Tolak"}
                              aria-label={isDinas ? "Verifikasi & Setujui" : "Setujui / Tolak"}
                              onClick={() => onApprove(row)}
                            >
                              <i className={isDinas ? "bi bi-check-lg" : "bi bi-check-circle"} />
                            </button>
                            <ActionButton
                              action="delete"
                              title="Hapus Pengajuan"
                              onClick={() => onDelete(row.id)}
                            />
                          </>
                        )}
                        {row.surat_tugas_url && (
                          <ActionButton
                            action="file"
                            title="Lihat Lampiran"
                            onClick={() => openFile(row.surat_tugas_url!, `Lampiran - ${row.nama_guru}`)}
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

      {viewer}
    </div>
  );
}
