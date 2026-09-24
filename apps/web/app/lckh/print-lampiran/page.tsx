'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { renderKopHTML, KOP_CSS, type ProfilSekolah } from '@/lib/lckh/print-shared';

interface LampiranData {
    guru_name: string;
    nip: string;
    periode: string;
    periode_start: string;
    periode_end: string;
    total_jam: number;
    lampiran_absensi: any[];
    lampiran_jurnal: any[];
    lampiran_tugas: any[];
    lampiran_nilai: any[];
    semester_nilai: any[];
    ringkasan_umum: any;
    ringkasan?: any[];
    catatan_guru: string;
    detail_absensi_per_class: any[];
    approval_status: string;
    approval_code: string | null;
    qr_code?: string | null;
    madrasah_name?: string;
    madrasah_address?: string;
    madrasah_logo?: string | null;
    profil?: ProfilSekolah | null;
    guru_nip?: string;
    waka_name?: string;
    waka_nip?: string;
    waka_date?: string;
    waka_jabatan?: string;
    kamad_name?: string;
    kamad_nip?: string;
    kamad_date?: string;
    kota?: string;
    bulan?: string;
    semester?: string;
    tahun_ajaran?: string;
}

import MaintenanceBanner from '@/components/MaintenanceBanner';

export default function LampiranPrintPage() {
    return (
        <MaintenanceBanner pageKey="maintenance_lckh_print_lampiran">
            <Suspense fallback={<div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui' }}><div>Memuat...</div></div>}>
                <LampiranPrintInner />
            </Suspense>
        </MaintenanceBanner>
    );
}

function LampiranPrintInner() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const [data, setData] = useState<LampiranData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isPreview = data?.approval_status !== 'Approved_Kamad';

    useEffect(() => {
        if (!id) {
            setError('ID tidak ditemukan');
            setLoading(false);
            return;
        }

        fetch(`/api/lckh/print/data?id=${id}`)
            .then(r => r.json())
            .then(json => {
                if (json.ok) {
                    setData(json.data);
                } else {
                    setError(json.error || 'Gagal memuat data');
                }
            })
            .catch((e: any) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    // Picu print sekali setelah data dirender. Pakai flag di window (bukan React state)
    // dan TANPA cleanup clearTimeout — kalau guard-nya berupa state di dependency array,
    // re-render/StrictMode akan menjalankan cleanup dan membatalkan timer sebelum
    // window.print() sempat berjalan (dialog print tak pernah muncul).
    useEffect(() => {
        if (!data || loading || error) return;
        if ((window as any).__lckhLampiranPrinted) return;
        (window as any).__lckhLampiranPrinted = true;
        setTimeout(() => { window.focus(); window.print(); }, 600);
    }, [data, loading, error]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem' }}>⏳</div>
                    <p style={{ marginTop: '1rem', color: '#666' }}>Memuat data lampiran...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem' }}>⚠️</div>
                    <p style={{ marginTop: '1rem', color: '#dc2626' }}>{error || 'Data tidak ditemukan'}</p>
                    <button onClick={() => window.close()} style={{ marginTop: '1rem', padding: '8px 24px', cursor: 'pointer' }}>
                        Tutup
                    </button>
                </div>
            </div>
        );
    }

    const formatDate = (d: string) => {
        if (!d || d === '-') return '-';
        try {
            return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch { return d; }
    };

    return (
        <div className="doc-root" style={{ fontFamily: 'Times New Roman, Georgia, serif', fontSize: '11pt', color: '#000' }}>
            <style>
                {`
                @page { size: A4 landscape; margin: 10mm 10mm 16mm 10mm; }
                html, body { margin: 0; padding: 0; }
                html, body { background: #fff; }
                .doc-root { padding: 0 16px; background: #fff; min-height: 100vh; }
                .print-footer { display: none; }
                .print-btn { position: fixed; top: 16px; right: 16px; z-index: 50; background: #3083ff; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-size: 12pt; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-family: system-ui, sans-serif; }
                @media print { .print-btn { display: none !important; } }
                ${KOP_CSS}
                .doc-title { text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 4px; }
                .doc-sub { text-align: center; font-size: 10pt; color: #444; margin-bottom: 18px; }
                .qr-area { display: flex; gap: 15px; align-items: center; text-align: right; }
                .qr-code { width: 80px; height: 80px; }
                .code-box { display: inline-block; border: 1px solid #000; padding: 4px 10px; font-family: monospace; font-size: 10pt; font-weight: bold; margin-top: 5px; }
                .code-box-preview { display: inline-block; border: 2px dashed #dc2626; padding: 4px 10px; font-family: monospace; font-size: 10pt; color: #dc2626; font-weight: bold; margin-top: 5px; }
                .section { margin-bottom: 24px; }
                .page-break { break-before: page; page-break-before: always; }
                .section-title { font-size: 11pt; font-weight: bold; border-bottom: 1.5px solid #000; padding-bottom: 5px; margin: 0 0 10px; text-transform: uppercase; }
                .data-table { width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed; }
                .data-table th { border: 1px solid #000; padding: 6px 8px; background: #eee; text-align: left; font-weight: bold; }
                .data-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
                .data-table tbody tr:nth-child(even) td { background: #fafafa; }
                .empty-note { border: 1px solid #000; padding: 10px; text-align: center; font-style: italic; color: #666; font-size: 10pt; }
                .abs-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                .abs-table th, .abs-table td { border: 1px solid #888; padding: 2px 1px; text-align: center; font-size: 7pt; line-height: 1.15; overflow: hidden; }
                .abs-table thead th { background: #e6e6e6; font-weight: bold; }
                .abs-table .abs-name { text-align: left; padding: 2px 4px; font-size: 8pt; white-space: normal; word-break: break-word; overflow-wrap: break-word; line-height: 1.15; }
                .abs-table .abs-wknd { background: #f2f2f2; color: #999; }
                .abs-table td.abs-tot { font-weight: bold; }
                .abs-h { color: #16a34a; font-weight: bold; }
                .abs-s { color: #d97706; font-weight: bold; }
                .abs-i { color: #0284c7; font-weight: bold; }
                .abs-a { color: #dc2626; font-weight: bold; }
                @media print {
                    /* globals.css memberi html/body height:100% + overflow-x:hidden yang
                       mematikan page-break & memunculkan halaman kosong — override di sini. */
                    html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .doc-root { padding: 0; }
                    table { page-break-inside: auto; max-width: 100%; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    .print-footer {
                        display: flex; justify-content: space-between; align-items: center;
                        position: fixed; left: 0; right: 0; bottom: 0;
                        font-size: 8pt; color: #333; background: #fff;
                        border-top: 1px solid #999; padding: 3px 6px 2px;
                    }
                    .print-footer .pf-code { font-family: monospace; font-weight: bold; }
                }
                `}
            </style>
            
            <button className="print-btn" onClick={() => window.print()}>
                <i className="bi bi-printer" style={{ marginRight: 6 }}></i>Cetak
            </button>

            {isPreview && (
                <div style={{ background: '#dc2626', color: 'white', textAlign: 'center', padding: '10px 20px', fontWeight: 'bold', fontSize: '13pt', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '20px', borderRadius: '6px', border: '2px dashed rgba(255,255,255,0.5)' }}>
                    PREVIEW — BELUM DISAHKAN OLEH KEPALA MADRASAH
                </div>
            )}
            
            {/* KOP Surat (dari profil_sekolah) */}
            <div dangerouslySetInnerHTML={{ __html: renderKopHTML(data.profil) }} />

            {/* Judul Dokumen */}
            <div className="doc-title">Laporan Pelaksanaan Tugas Guru dalam Kegiatan Pembelajaran</div>
            <div className="doc-sub">Semester {data.semester || '-'} — Tahun Ajaran {data.tahun_ajaran || '-'}</div>

            {/* Info Guru + Verifikasi */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <table style={{ fontSize: '10pt', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr><td style={{ paddingRight: '8px', fontWeight: 'bold' }}>Nama Guru</td><td style={{ paddingRight: '6px' }}>:</td><td>{data.guru_name}</td></tr>
                        <tr><td style={{ paddingRight: '8px', fontWeight: 'bold' }}>NIP</td><td style={{ paddingRight: '6px' }}>:</td><td>{data.nip}</td></tr>
                        <tr><td style={{ paddingRight: '8px', fontWeight: 'bold' }}>Bulan</td><td style={{ paddingRight: '6px' }}>:</td><td>{data.bulan || data.periode}</td></tr>
                        <tr><td style={{ paddingRight: '8px', fontWeight: 'bold' }}>Periode</td><td style={{ paddingRight: '6px' }}>:</td><td>{formatDate(data.periode_start)} s/d {formatDate(data.periode_end)}</td></tr>
                    </tbody>
                </table>
                <div className="qr-area">
                    <div>
                        <div style={{ fontSize: '9pt', color: '#555' }}>Verifikasi LCKH</div>
                        <div className={isPreview ? 'code-box-preview' : 'code-box'}>{data.approval_code || 'BELUM ADA'}</div>
                    </div>
                    {data.qr_code ? <img src={data.qr_code} className="qr-code" alt="QR Verifikasi" /> : null}
                </div>
            </div>

            {/* Ringkasan Umum */}
            <div style={{ marginBottom: '25px' }}>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '10px', textTransform: 'uppercase' }}>
                    1. Rekapitulasi Capaian
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {[
                        { label: 'Total Jam Mengajar', value: data.total_jam },
                        { label: 'Jurnal Terisi', value: data.ringkasan_umum?.total_jurnal_isi || 0 },
                        { label: 'Input Nilai', value: data.ringkasan_umum?.total_nilai_input || 0 },
                        { label: 'Tugas Tambahan', value: data.ringkasan_umum?.total_tugas || 0 },
                    ].map((item, i) => (
                        <div key={i} style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '9pt', color: '#555' }}>{item.label}</div>
                            <div style={{ fontSize: '18pt', fontWeight: 'bold', marginTop: '5px' }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Ringkasan Capaian Kinerja */}
            <div className="section page-break">
                <div className="section-title">2. Ringkasan Capaian Kinerja</div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%', textAlign: 'center' }}>No</th>
                            <th style={{ width: '15%' }}>Tanggal</th>
                            <th style={{ width: '30%' }}>Nama Kegiatan</th>
                            <th style={{ width: '30%' }}>Hasil Capaian</th>
                            <th style={{ width: '20%' }}>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.ringkasan && data.ringkasan.length > 0 ? (
                            data.ringkasan.map((r: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ textAlign: 'center', color: '#666' }}>{i + 1}</td>
                                    <td>{r.dateStr || (r.tanggal ? formatDate(r.tanggal) : '-')}</td>
                                    <td>{r.activity || '-'}</td>
                                    <td>{r.result || '-'}</td>
                                    <td>{r.note || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>Tidak ada ringkasan kegiatan</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 3. Rekap Absensi Siswa — semua kelas, matriks bulanan */}
            {data.detail_absensi_per_class && data.detail_absensi_per_class.length > 0 && (
                <div className="section page-break">
                    <div className="section-title">3. Rekap Absensi Siswa (Seluruh Kelas)</div>
                    {data.detail_absensi_per_class.flatMap((cd: any, cdIdx: number) =>
                        (cd.monthGroups || []).map((mg: any, mgIdx: number) => {
                        const students = mg.students || [];
                        const dateCols = mg.dateCols || [];
                        const tH = students.reduce((a: number, s: any) => a + (s.totalH || 0), 0);
                        const tS = students.reduce((a: number, s: any) => a + (s.totalS || 0), 0);
                        const tI = students.reduce((a: number, s: any) => a + (s.totalI || 0), 0);
                        const tA = students.reduce((a: number, s: any) => a + (s.totalA || 0), 0);

                        return (
                            <div key={`${cdIdx}-${mgIdx}`} style={{ marginBottom: '30px' }}>
                                {/* Month Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        {mg.monthName} — KELAS {cd.kelas}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {[
                                            { label: 'H', val: tH, bg: '#dcfce7', c: '#16a34a' },
                                            { label: 'S', val: tS, bg: '#fef3c7', c: '#d97706' },
                                            { label: 'I', val: tI, bg: '#e0f2fe', c: '#0284c7' },
                                            { label: 'A', val: tA, bg: '#fee2e2', c: '#dc2626' },
                                        ].map((s, i) => (
                                            <div key={i} style={{ background: s.bg, border: `1px solid ${s.c}40`, borderRadius: '6px', padding: '4px 10px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '11pt', fontWeight: 900, color: s.c }}>{s.val}</div>
                                                <div style={{ fontSize: '7pt', fontWeight: 700, color: s.c, textTransform: 'uppercase' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Matrix Table — muat 1 halaman landscape (table-layout fixed) */}
                                <table className="abs-table">
                                    <colgroup>
                                        <col style={{ width: '22px' }} />
                                        <col style={{ width: '135px' }} />
                                        {dateCols.map((_: any, di: number) => <col key={di} />)}
                                        <col style={{ width: '20px' }} />
                                        <col style={{ width: '20px' }} />
                                        <col style={{ width: '20px' }} />
                                        <col style={{ width: '20px' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th className="abs-name">Nama Siswa</th>
                                            {dateCols.map((dc: any, di: number) => (
                                                <th key={di} className={dc.isWeekend ? 'abs-wknd' : ''}>{dc.day}</th>
                                            ))}
                                            <th>H</th>
                                            <th>S</th>
                                            <th>I</th>
                                            <th>A</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((st: any, idx: number) => (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td className="abs-name">{st.nama}</td>
                                                {dateCols.map((dc: any, di: number) => {
                                                    const status = (st.days?.[dc.day] || '').toUpperCase();
                                                    const char = status.startsWith('H') ? 'H' : status.startsWith('S') ? 'S' : status.startsWith('I') ? 'I' : status.startsWith('A') ? 'A' : '';
                                                    const cls = char === 'H' ? 'abs-h' : char === 'S' ? 'abs-s' : char === 'I' ? 'abs-i' : char === 'A' ? 'abs-a' : '';
                                                    return (
                                                        <td key={di} className={!char && dc.isWeekend ? 'abs-wknd' : cls}>{char}</td>
                                                    );
                                                })}
                                                <td className="abs-tot abs-h">{st.totalH}</td>
                                                <td className="abs-tot abs-s">{st.totalS}</td>
                                                <td className="abs-tot abs-i">{st.totalI}</td>
                                                <td className="abs-tot abs-a">{st.totalA}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                        })
                    )}
                </div>
            )}

            {/* Fallback Simple Absensi */}
            {(data.lampiran_absensi && data.lampiran_absensi.length > 0 && (!data.detail_absensi_per_class || data.detail_absensi_per_class.length === 0)) && (
                <div className="section page-break">
                    <div className="section-title">3. Rekap Absensi Siswa</div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Kelas / Mapel</th>
                                <th style={{ textAlign: 'center' }}>Hadir</th>
                                <th style={{ textAlign: 'center' }}>Sakit</th>
                                <th style={{ textAlign: 'center' }}>Izin</th>
                                <th style={{ textAlign: 'center' }}>Alfa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lampiran_absensi.map((a: any, i: number) => (
                                <tr key={i}>
                                    <td>
                                        <strong>{a.kelas}</strong><br /><span style={{ fontSize: '9pt', color: '#555' }}>{a.mapel}</span>
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#16a34a' }}><strong>{a.H || 0}</strong></td>
                                    <td style={{ textAlign: 'center', color: '#b45309' }}><strong>{a.S || 0}</strong></td>
                                    <td style={{ textAlign: 'center', color: '#0ea5e9' }}><strong>{a.I || 0}</strong></td>
                                    <td style={{ textAlign: 'center', color: '#dc2626' }}><strong>{a.A || 0}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 4. Jurnal Mengajar Harian */}
            {data.lampiran_jurnal && data.lampiran_jurnal.length > 0 && (
                <div className="section page-break">
                    <div className="section-title">4. Jurnal Mengajar Harian</div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '4%' }}>No</th>
                                <th style={{ width: '13%' }}>Tanggal</th>
                                <th style={{ textAlign: 'center', width: '7%' }}>Jam Ke</th>
                                <th style={{ width: '15%' }}>Kelas / Mapel</th>
                                <th>Materi / Uraian Kegiatan</th>
                                <th style={{ textAlign: 'center', width: '7%' }}>Hadir</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lampiran_jurnal.map((j: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ textAlign: 'center', color: '#666' }}>{i + 1}</td>
                                    <td>
                                        <strong style={{ fontSize: '9pt', textTransform: 'uppercase' }}>{j.hari || '-'}</strong><br />
                                        {formatDate(j.tanggal)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{j.jam_ke || '-'}</td>
                                    <td>
                                        <strong>{j.kelas}</strong><br />
                                        <span style={{ fontSize: '9pt', color: '#555', textTransform: 'uppercase' }}>{j.mapel || j.mata_pelajaran}</span>
                                    </td>
                                    <td>{j.materi || '-'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>
                                        {j.H || j.jml_hadir || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 5. Daftar Nilai */}
            {(data.semester_nilai && data.semester_nilai.length > 0) || (data.lampiran_nilai && data.lampiran_nilai.length > 0) ? (
                <div className="section page-break">
                    <div className="section-title">
                        5. Daftar Nilai {data.semester_nilai && data.semester_nilai.length > 0 ? '(Semester Penuh)' : '(Periode)'}
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '4%' }}>No</th>
                                <th style={{ width: '18%' }}>Kelas / Mapel</th>
                                <th style={{ textAlign: 'center', width: '12%' }}>Jenis</th>
                                <th>Materi / Tagihan</th>
                                <th style={{ textAlign: 'center', width: '13%' }}>Tgl Input</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.semester_nilai && data.semester_nilai.length > 0 ? data.semester_nilai : data.lampiran_nilai).map((n: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ textAlign: 'center', color: '#666' }}>{i + 1}</td>
                                    <td>
                                        <strong>{n.kelas}</strong><br /><span style={{ fontSize: '9pt', color: '#555' }}>{n.mapel}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {n.jenis === 'Sum' ? 'Sumatif' : n.jenis === 'Pas' ? 'SAS' : 'Formatif'}
                                    </td>
                                    <td>
                                        {n.tagihan || n.materi || '-'}
                                    </td>
                                    <td style={{ textAlign: 'center', fontSize: '9pt', color: '#555' }}>
                                        {n.last_update ? formatDate(n.last_update) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {/* 6. Tugas Tambahan */}
            {data.lampiran_tugas && data.lampiran_tugas.length > 0 && (
                <div className="section page-break">
                    <div className="section-title">6. Tugas Tambahan</div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '4%' }}>No</th>
                                <th style={{ width: '13%' }}>Tanggal</th>
                                <th style={{ width: '22%' }}>Tugas / Jabatan</th>
                                <th>Kegiatan</th>
                                <th>Hasil</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lampiran_tugas.map((t: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ textAlign: 'center', color: '#666' }}>{i + 1}</td>
                                    <td>{formatDate(t.tanggal)}</td>
                                    <td>
                                        <strong>{t.tugas?.jabatan || t.title || '-'}</strong>
                                    </td>
                                    <td>{t.kegiatan || '-'}</td>
                                    <td style={{ fontStyle: 'italic' }}>
                                        {t.hasil ? `"${t.hasil}"` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer verifikasi — tampil di setiap halaman saat dicetak (tanpa TTD) */}
            <div className="print-footer">
                <span>{data.madrasah_name} · LCKH {data.periode} · {data.guru_name}</span>
                <span>Kode Verifikasi: <span className="pf-code">{data.approval_code || 'BELUM ADA'}</span></span>
            </div>
        </div>
    );
}
