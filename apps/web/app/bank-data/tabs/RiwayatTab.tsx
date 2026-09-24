'use client';

import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { BarisLog } from '../types';

/**
 * Riwayat ekspor — jejak siapa mengunduh dataset apa, kapan, berapa baris.
 * Hanya untuk pemegang `bank_data.kelola`; gerbangnya juga dipasang di
 * /api/bank-data/log, bukan cuma di sini.
 */
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

  useEffect(() => { muat(halaman); }, [muat, halaman]);

  const maksHalaman = Math.max(1, Math.ceil(total / perHalaman));

  const waktu = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  /** Filter tersimpan sebagai objek; ditampilkan ringkas supaya baris tetap terbaca. */
  const ringkasFilter = (f: Record<string, any> | null) => {
    if (!f || Object.keys(f).length === 0) return '—';
    return Object.entries(f)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ');
  };

  if (loading) {
    return <div className="bd-loading"><Spinner variant="trace" label="Memuat riwayat ekspor..." /></div>;
  }

  return (
    <div className="bd-panel">
      <div className="bd-panel__head">
        <div>
          <h3>Riwayat Ekspor</h3>
          <p>{total.toLocaleString('id-ID')} unduhan tercatat.</p>
        </div>
        <Button variant="secondary" icon="refresh" onClick={() => muat(halaman)}>Muat Ulang</Button>
      </div>

      {rows.length === 0 ? (
        <div className="bd-empty">
          <i className="bi bi-clock-history" />
          <h3>Belum ada ekspor tercatat</h3>
          <p>Setiap unduhan akan muncul di sini beserta filter dan jumlah barisnya.</p>
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
                  <th>Filter</th>
                  <th style={{ textAlign: 'right' }}>Baris</th>
                  <th>Kolom</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{waktu(r.created_at)}</td>
                    <td>{r.nama_user || `#${r.user_id ?? '?'}`}</td>
                    <td>{r.dataset_label}</td>
                    <td className="bd-table__muted">{ringkasFilter(r.filter)}</td>
                    <td style={{ textAlign: 'right' }}>{(r.jumlah_baris ?? 0).toLocaleString('id-ID')}</td>
                    <td className="bd-table__muted">{r.kolom?.length ?? 0} kolom</td>
                    <td className="bd-table__muted">{r.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {maksHalaman > 1 && (
            <div className="bd-pager">
              <Button variant="secondary" disabled={halaman <= 1} onClick={() => setHalaman(h => h - 1)}>
                Sebelumnya
              </Button>
              <span>Halaman {halaman} dari {maksHalaman}</span>
              <Button variant="secondary" disabled={halaman >= maksHalaman} onClick={() => setHalaman(h => h + 1)}>
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
