'use client';

import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';
import type { User } from '@/lib/types';
import Swal from 'sweetalert2';
import { cachedGet } from '../svCache';
import {
    generateLaporanHasilSupervisiHtml,
    generateLembarHasilGuruHtml,
    labelTahunAjaran,
    BATAS_BAIK,
} from '@/lib/e-supervisi/laporan-report';

/**
 * Tab Hasil: rekap nilai + dokumen administrasi.
 *
 * Cakupan data diputuskan SERVER: guru/supervisor hanya menerima penugasan
 * yang melibatkan dirinya; pengelola & pimpinan menerima semuanya. (Dulu
 * seluruh nilai semua guru dikirim ke setiap pengguna lalu disaring di sini.)
 */
export default function TabHasil({ user, tahunAjaranId }: { user: User, tahunAjaranId: number | null }) {
    const [rekap, setRekap] = useState<any[]>([]);
    const [stages, setStages] = useState<string[]>([]);
    const [indikatorStats, setIndikatorStats] = useState<any[]>([]);
    const [profilSekolah, setProfilSekolah] = useState<any>(null);
    const [tahunAjaran, setTahunAjaran] = useState<any>(null);
    const [bolehLaporan, setBolehLaporan] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<{ html: string; title: string } | null>(null);

    useEffect(() => {
        if (tahunAjaranId) fetchRekap();
        else { setRekap([]); setLoading(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tahunAjaranId, user.nip]);

    const fetchRekap = async () => {
        setLoading(true);
        setError('');
        try {
            const json = await cachedGet(`/api/e-supervisi/rekap?tahun_ajaran_id=${tahunAjaranId}`, 30_000);
            if (!json.ok) throw new Error(json.message || json.error || 'Gagal memuat rekap');
            setRekap(json.data || []);
            setStages(json.stages || []);
            setIndikatorStats(json.indikator_stats || []);
            setProfilSekolah(json.profil_sekolah || null);
            setTahunAjaran(json.tahun_ajaran || null);
            setBolehLaporan(Boolean(json.akses?.pantau));
        } catch (e: any) {
            setRekap([]);
            setError(e.message || 'Gagal memuat rekap');
        } finally {
            setLoading(false);
        }
    };

    const cetakLaporan = () => {
        if (!profilSekolah?.nama) {
            Swal.fire('Profil Sekolah Belum Lengkap', 'Lengkapi Profil Sekolah (Pengaturan Umum) agar kop laporan tercetak.', 'info');
        }
        const html = generateLaporanHasilSupervisiHtml({
            rekap,
            stages,
            indikatorStats,
            profil: profilSekolah,
            tahunAjaran,
            penyusunNama: user.nama_lengkap || user.nama,
            penyusunNip: user.nip,
        });
        setPreview({ html, title: `Laporan Hasil Supervisi Akademik — ${labelTahunAjaran(tahunAjaran)}` });
    };

    const cetakLembar = async (p: any) => {
        try {
            Swal.fire({ title: 'Menyusun lembar hasil…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const [docJson, nilaiJson] = await Promise.all([
                cachedGet(`/api/e-supervisi/dokumen?tahun_ajaran_id=${tahunAjaranId}`),
                fetch(`/api/e-supervisi/nilai?penugasan_id=${p.id}`, { cache: 'no-store' }).then(r => r.json()),
            ]);
            if (!docJson.ok) throw new Error(docJson.message || docJson.error || 'Gagal memuat instrumen');
            if (!nilaiJson.ok) throw new Error(nilaiJson.message || nilaiJson.error || 'Gagal memuat nilai');
            const html = generateLembarHasilGuruHtml({
                penugasan: p,
                dokumen: docJson.data || [],
                nilaiRows: nilaiJson.data || [],
                profil: profilSekolah,
                tahunAjaran,
            });
            Swal.close();
            setPreview({ html, title: `Lembar Hasil Supervisi — ${p.guru_nama}` });
        } catch (e: any) {
            Swal.fire('Gagal', e.message || 'Gagal menyusun lembar hasil', 'error');
        }
    };

    // Belum ada tahun ajaran yang memiliki dokumen/penugasan supervisi.
    // (Versi lama menampilkan loader selamanya pada keadaan ini.)
    if (!tahunAjaranId) {
        return (
            <div className="sv-card sv-empty">
                <i className="bi bi-calendar-x"></i>
                <h3>Belum Ada Data Supervisi</h3>
                <p>Belum ada tahun ajaran yang memiliki dokumen atau penugasan supervisi. Tambahkan dokumen &amp; indikator di tab <b>Dokumen dan Indikator</b>, lalu tetapkan supervisor di tab <b>Supervisor</b>.</p>
            </div>
        );
    }

    if (loading) {
        return <PageLoader label="Memuat data rekapitulasi…" minHeight="300px" />;
    }

    const dinilai = rekap.filter(p => p.nilai?.rata_rata !== null && p.nilai?.rata_rata !== undefined);
    const avgScore = dinilai.length ? dinilai.reduce((sum, p) => sum + Number(p.nilai.rata_rata), 0) / dinilai.length : null;
    const baikCount = dinilai.filter(p => Number(p.nilai.rata_rata) >= BATAS_BAIK).length;

    return (
        <div className="sv-card">
            {preview && (
                <HtmlPreviewModal html={preview.html} title={preview.title} onClose={() => setPreview(null)} />
            )}

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px'}}>
                <h3 style={{margin: 0}}>Rekapitulasi Nilai Supervisi</h3>
                {bolehLaporan && (
                    <button className="sv-btn sv-btn-outline" onClick={cetakLaporan} disabled={rekap.length === 0}>
                        <i className="bi bi-file-earmark-text"></i> Laporan Hasil Supervisi
                    </button>
                )}
            </div>

            {error && (
                <div role="alert" style={{padding: '10px 14px', marginBottom: '16px', border: '1px solid #fca5a5', borderRadius: '10px', color: '#b91c1c'}}>
                    {error} <button className="sv-btn sv-btn-outline" style={{marginLeft: 8, padding: '2px 10px'}} onClick={fetchRekap}>Coba lagi</button>
                </div>
            )}

            <div className="sv-stats">
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Total Penugasan</span>
                    <span className="sv-stat-value">{rekap.length}</span>
                </div>
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Sudah Dinilai</span>
                    <span className="sv-stat-value">{dinilai.length}</span>
                </div>
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Rata-rata Nilai</span>
                    <span className="sv-stat-value">{avgScore === null ? '-' : avgScore.toFixed(2)}</span>
                </div>
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Predikat Baik/Sangat Baik</span>
                    <span className="sv-stat-value">{dinilai.length > 0 ? Math.round((baikCount / dinilai.length) * 100) : 0}%</span>
                </div>
            </div>

            <div className="sv-table-scroll">
                <table className="sv-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Nama Guru</th>
                            <th>Supervisor</th>
                            {stages.map(t => <th key={t} style={{textTransform: 'capitalize'}}>{t}</th>)}
                            <th>Nilai Akhir</th>
                            <th>Predikat</th>
                            <th>Status</th>
                            <th style={{textAlign: 'center'}}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rekap.map((p, i) => (
                            <tr key={p.id}>
                                <td data-label="No">{i + 1}</td>
                                <td data-label="Nama Guru">
                                    <div>
                                        <div style={{fontWeight: 600}}>{p.guru_nama}</div>
                                        <small style={{color: 'var(--n-muted)'}}>{p.guru_nip}</small>
                                    </div>
                                </td>
                                <td data-label="Supervisor">{p.supervisor_nama}</td>
                                {stages.map(t => (
                                    <td key={t} data-label={t} style={{textTransform: 'capitalize'}}>
                                        <span className={`sv-badge ${p.nilai?.[t] !== null && p.nilai?.[t] !== undefined ? 'sv-badge-success' : ''}`}>
                                            {p.nilai?.[t] ?? '-'}
                                        </span>
                                    </td>
                                ))}
                                <td data-label="Nilai Akhir" style={{fontWeight: 600}}>{p.nilai?.rata_rata ?? '-'}</td>
                                <td data-label="Predikat">{p.nilai?.predikat || '-'}</td>
                                <td data-label="Status">
                                    {p.status === 'terkunci'
                                        ? <span className="sv-badge" style={{background: 'rgba(100,116,139,0.15)', color: 'var(--n-muted)'}}><i className="bi bi-lock-fill"></i> Final</span>
                                        : <span style={{fontSize: '12px', color: 'var(--n-muted)'}}>{p.progres ?? 0}% dinilai</span>}
                                </td>
                                <td data-label="Aksi" style={{textAlign: 'center'}}>
                                    <button
                                        className="sv-btn sv-btn-outline"
                                        style={{padding: '6px 12px', fontSize: '12px'}}
                                        onClick={() => cetakLembar(p)}
                                        title={`Lembar hasil supervisi ${p.guru_nama}`}
                                    >
                                        <i className="bi bi-printer"></i> Lembar Hasil
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rekap.length === 0 && !error && <tr><td colSpan={7 + stages.length} className="sv-empty">Belum ada data nilai supervisi.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
