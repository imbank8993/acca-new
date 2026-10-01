'use client';

import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { BarisLog } from '../types';

export default function RiwayatTab() {
  const [rows, setRows] = useState<BarisLog[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(50);
  const [loading, setLoading] = useState(true);

  const muat = useCallback(async (h: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bank-data/log?halaman=${h}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal memuat riwayat');
      setRows(json.data || []);
      setTotal(json.total || 0);
      setPerHalaman(json.perHalaman || 50);
    } catch (e: any) {
      Swal.fire('Gagal', e.message || 'Riwayat tidak dapat dimuat', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    muat(halaman);
  }, [muat, halaman]);

  const maksHalaman = Math.max(1, Math.ceil(total / perHalaman));

  const waktu = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const ringkasFilter = (f: Record<string, any> | null) => {
    if (!f || Object.keys(f).length === 0) return '—';
    const entries = Object.entries(f).filter(([k]) => !k.startsWith('_'));
    if (entries.length === 0) return 'Semua';
    return entries
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ');
  };

  return (
    <div className="bd-panel" style={{ padding: 0, border: 'none', background: 'transparent' }}>
      {loading ? (
        <div className="bd-loading"><Spinner variant="buble" label="Memuat riwayat..." /></div>
      ) : rows.length === 0 ? (
        <div className="bd-empty">
          <div className="bd-empty__icon">
            <i className="bi bi-clock-history" />
          </div>
          <h3>Belum ada riwayat ekspor</h3>
          <p>Aktivitas unduhan file Excel dan pratinjau data akan dicatat secara otomatis di sini.</p>
        </div>
      ) : (
        <>
          <div className="bd-tablewrap">
            <table className="bd-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Dataset</th>
                  <th>Tipe Aksi</th>
                  <th>Filter</th>
                  <th style={{ textAlign: 'right' }}>Jumlah Baris</th>
                  <th>Kolom</th>
                  <th>Alamat IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isPreview = r.filter && r.filter._tipe === 'preview';
                  return (
                    <tr key={r.id}>
                      <td className="bd-table__time">{waktu(r.created_at)}</td>
                      <td>
                        <span className="bd-user-tag">
                          <i className="bi bi-person-fill" /> {r.nama_user || `#${r.user_id ?? '?'}`}
                        </span>
                      </td>
                      <td>
                        <strong>{r.dataset_label}</strong>
                      </td>
                      <td>
                        {isPreview ? (
                          <span className="bd-action-badge bd-action-badge--preview">
                            <i className="bi bi-eye" /> Pratinjau
                          </span>
                        ) : (
                          <span className="bd-action-badge bd-action-badge--export">
                            <i className="bi bi-download" /> Ekspor Excel
                          </span>
                        )}
                      </td>
                      <td className="bd-table__muted">{ringkasFilter(r.filter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {(r.jumlah_baris ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="bd-table__muted">{r.kolom?.length ?? 0} kolom</td>
                      <td className="bd-table__muted">{r.ip || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {maksHalaman > 1 && (
            <div className="bd-pager" style={{ marginTop: 16 }}>
              <Button
                variant="secondary"
                disabled={halaman <= 1}
                onClick={() => setHalaman(h => h - 1)}
                icon="arrow-left"
              >
                Sebelumnya
              </Button>
              <span className="bd-pager__info">
                Halaman {halaman} dari {maksHalaman} ({total.toLocaleString('id-ID')} Total)
              </span>
              <Button
                variant="secondary"
                disabled={halaman >= maksHalaman}
                onClick={() => setHalaman(h => h + 1)}
                icon="arrow-right"
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
