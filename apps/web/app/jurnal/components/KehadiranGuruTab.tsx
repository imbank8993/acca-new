'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CalendarDays } from 'lucide-react';
import { FilterToolbar, FilterField, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import './kehadiran-guru.css';

type JenisIzin = 'izin' | 'sakit' | 'dinas_luar';
interface KehadiranHarian {
    tanggal: string;
    hari_ini: string;
    timezone: string;
    diperbarui_pada: string;
    ringkasan: { total: number } & Record<JenisIzin, number>;
    guru: {
        id: string;
        nama: string;
        izin: { id: string; jenis: JenisIzin; tanggal_mulai: string; tanggal_selesai: string }[];
    }[];
}

const JENIS: Record<JenisIzin, string> = { izin: 'Izin', sakit: 'Sakit', dinas_luar: 'Dinas Luar' };

async function fetchKehadiran(url: string): Promise<KehadiranHarian> {
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error || 'Data kehadiran guru belum dapat dimuat.');
    }
    return json.data;
}

function formatTanggal(tanggal: string, long = false) {
    return new Date(`${tanggal}T00:00:00Z`).toLocaleDateString('id-ID', {
        timeZone: 'UTC', day: 'numeric', month: long ? 'long' : 'short', year: 'numeric',
        ...(long ? { weekday: 'long' as const } : {}),
    });
}

function KehadiranDateFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <FilterField label="Tanggal" width={180} grow={0} bare>
            <DatePicker value={value} onChange={onChange} min="2000-01-01" max="2100-12-31" title="Tanggal kehadiran guru" />
        </FilterField>
    );
}

export default function KehadiranGuruTab() {
    // Nilai kosong berarti selalu mengikuti hari ini, termasuk setelah tengah malam.
    const [tanggal, setTanggal] = useState('');
    const [search, setSearch] = useState('');
    const url = '/api/jurnal/kehadiran-guru' + (tanggal ? `?tanggal=${encodeURIComponent(tanggal)}` : '');
    const { data, error, isLoading, isValidating, mutate } = useSWR<KehadiranHarian>(url, fetchKehadiran, {
        refreshInterval: 30_000,
        refreshWhenHidden: false,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        keepPreviousData: false,
    });
    const selectedDate = tanggal || data?.tanggal || '';
    const query = search.trim().toLocaleLowerCase('id');
    const rows = (data?.guru || []).filter(g => g.nama.toLocaleLowerCase('id').includes(query));

    return (
        <section className="jkg" aria-label="Kehadiran Guru">
            <FilterToolbar actionsInline>
                <FilterSearch label="Pencarian" value={search} onChange={setSearch} placeholder="Cari nama guru..." grow={3} />
                <KehadiranDateFilter value={selectedDate} onChange={setTanggal} />
                <FilterActions>
                    <Button variant="outline" size="sm" leftIcon={<CalendarDays size={16} />} className="ftb-btn-icon-mobile" aria-label="Hari ini" title="Hari ini"
                        onClick={() => { setTanggal(''); if (!tanggal) void mutate(); }}>Hari ini</Button>
                    <Button variant="outline" size="sm" icon="refresh" className="ftb-btn-icon-mobile" aria-label="Perbarui" title="Perbarui"
                        isLoading={isValidating} onClick={() => void mutate()}>Perbarui</Button>
                </FilterActions>
            </FilterToolbar>

            {error && (
                <div className="jkg-error" role="alert">
                    {data ? 'Pembaruan gagal. Daftar masih menampilkan data terakhir yang berhasil dimuat.' : error.message}
                    <Button variant="outline" size="sm" onClick={() => void mutate()}>Coba lagi</Button>
                </div>
            )}

            {isLoading ? (
                <div className="jkg-empty" role="status"><Spinner variant="buble" /><p>Memuat kehadiran guru...</p></div>
            ) : data && (
                <div className="jkg-panel">
                    <div className="jkg-overview">
                        <div className="jkg-heading">
                            <h2>{formatTanggal(data.tanggal, true)}</h2>
                            <span>{data.ringkasan.total} guru tidak hadir</span>
                        </div>
                        <div className="jkg-counts" aria-label="Ringkasan jenis izin">
                            {(Object.keys(JENIS) as JenisIzin[]).filter(jenis => data.ringkasan[jenis] > 0).map(jenis => (
                                <span key={jenis}>{JENIS[jenis]} <strong>{data.ringkasan[jenis]}</strong></span>
                            ))}
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <div className="jkg-empty">
                            <i className="bi bi-calendar-check" aria-hidden="true" />
                            <p>{query ? 'Tidak ada guru yang cocok dengan pencarian.' : 'Tidak ada izin guru yang disetujui dan berlaku pada tanggal ini.'}</p>
                        </div>
                    ) : (
                        <>
                        <div className="jkg-list-head" aria-hidden="true">
                            <span>Nama guru</span><div><span>Jenis izin</span><span>Periode</span></div>
                        </div>
                        <ul className="jkg-list" aria-label="Daftar guru tidak hadir">
                            {rows.map(guru => (
                                <li key={guru.id} className="jkg-row">
                                    <div className="jkg-teacher">{guru.nama}</div>
                                    <ul className="jkg-permits" aria-label={`Izin ${guru.nama}`}>
                                        {guru.izin.map(izin => (
                                            <li key={izin.id}>
                                                <span className={`jkg-badge jkg-badge--${izin.jenis}`}>{JENIS[izin.jenis]}</span>
                                                <span>{formatTanggal(izin.tanggal_mulai)}{izin.tanggal_selesai !== izin.tanggal_mulai && ` – ${formatTanggal(izin.tanggal_selesai)}`}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                        </>
                    )}
                    <footer className="jkg-footer">
                        <span>Berdasarkan izin yang telah disetujui.</span>
                        <span className="jkg-updated" title="Diperbarui otomatis setiap 30 detik">
                            <span className="jkg-live-dot" aria-hidden="true" />
                            Diperbarui {new Date(data.diperbarui_pada).toLocaleString('id-ID', {
                                timeZone: data.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                        </span>
                    </footer>
                </div>
            )}
        </section>
    );
}
