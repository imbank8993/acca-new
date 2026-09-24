'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Spinner } from '@/components/ui/Spinner';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import '../../../surat/surat.css';



function AccaVerifyPage() {
    const params = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const barcode = params.barcode as string;

    useEffect(() => {
        if (barcode) fetchData();
    }, [barcode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ketidakhadiran/acca-letter/verify?barcode=${encodeURIComponent(barcode)}`);
            const json = await res.json();
            if (json.ok && json.verified) {
                setData(json.data);
            } else {
                setError(json.error || 'Surat tidak ditemukan');
            }
        } catch (e: any) {
            setError(e.message || 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        // If d is already an ISO timestamp (contains 'T'), parse directly; otherwise append T00:00:00 for date-only strings
        const dt = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
        if (isNaN(dt.getTime())) return '-';
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    };

    const getJenisLabel = (j: string) => {
        if (j === 'REKAM_MEDIK') return 'Rekam Medik';
        if (j === 'REKOMENDASI_KONTROL') return 'Rekomendasi';
        if (j === 'MENINGGALKAN_ASRAMA') return 'Izin Meninggalkan Asrama';
        if (j === 'REKAPAN_IZIN') return 'Rekapan Izin';
        if (j === 'REKAPAN_SAKIT') return 'Rekapan Sakit';
        return j === 'M' ? 'Madrasah' : 'Pribadi';
    };

    const getBadgeLabel = (j: string) => {
        if (j === 'REKAM_MEDIK') return 'Rekam Medik Kesehatan';
        if (j === 'REKOMENDASI_KONTROL') return 'Surat Rekomendasi';
        if (j === 'MENINGGALKAN_ASRAMA') return 'Surat Izin Meninggalkan Asrama';
        if (j === 'REKAPAN_IZIN') return 'Rekapitulasi Izin Siswa';
        if (j === 'REKAPAN_SAKIT') return 'Rekapitulasi Sakit Siswa';
        return 'Surat ACCA — Izin';
    };

    const getScanSubtitle = (j: string) => {
        if (j === 'MENINGGALKAN_ASRAMA') return 'Surat Izin Meninggalkan Asrama — MAN Insan Cendekia Gowa';
        if (j === 'REKAM_MEDIK') return 'Rekam Medik Kesehatan — MAN Insan Cendekia Gowa';
        if (j === 'REKOMENDASI_KONTROL') return 'Surat Rekomendasi — MAN Insan Cendekia Gowa';
        if (j === 'REKAPAN_IZIN') return 'Rekapitulasi Izin — MAN Insan Cendekia Gowa';
        if (j === 'REKAPAN_SAKIT') return 'Rekapitulasi Sakit — MAN Insan Cendekia Gowa';
        return 'Surat ACCA — MAN Insan Cendekia Gowa';
    };

    if (loading) {
        return (
            <div className="scan-page-wrap">
                <div className="scan-loading">
                    <Spinner size={40} />
                    <p>Memverifikasi dokumen ACCA...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="scan-page-wrap">
                <div className="scan-error">
                    <div className="scan-error-icon"><i className="bi bi-x-circle-fill"></i></div>
                    <h1>Dokumen ACCA Tidak Ditemukan</h1>
                    <p>{error || 'Barcode tidak valid atau dokumen sudah tidak berlaku.'}</p>
                    <div className="scan-help">
                        <p>Pastikan Anda memindai QR Code atau barcode yang benar dari surat ACCA.</p>
                    </div>
                    <div className="scan-id-display">
                        <span>ID: {barcode || '-'}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="scan-page-wrap animate-srt-fade-in">
            {/* Header Bar */}
            <header className="scan-header-bar" style={{ padding: '0.85rem 1.5rem', borderRadius: '12px' }}>
                <div className="scan-header-left">
                    <a href="/" className="scan-btn-back">
                        <i className="bi bi-arrow-left"></i>
                        <span>Kembali</span>
                    </a>
                </div>
                <div className="scan-header-right">
                    <div className="scan-system-badge" style={{ margin: 0 }}>
                        <i className="bi bi-shield-check"></i>
                        <span>Sistem Verifikasi ACCA</span>
                    </div>
                </div>
            </header>

            {/* 2-Column Layout: Left = Info, Right = PDF */}
            <div className="scan-2col-layout">
                {/* LEFT: Info Panel */}
                <div className="scan-info-col">
                    {/* Verification Badge */}
                    <div className="scan-verification-header">
                        <div className="scan-valid-badge">
                            <i className="bi bi-patch-check-fill"></i>
                            <span>DOKUMEN ASLI</span>
                        </div>
                        <div className="scan-timestamp">
                            Diverifikasi {formatDate(new Date().toISOString())}
                        </div>
                    </div>

                    {/* Letter Info Card */}
                    <div className="scan-letter-card">
                        <div className="scan-letter-header" style={{ justifyContent: 'center', padding: '0.85rem 1.5rem' }}>
                            <span className="scan-nomor" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', width: '100%', textAlign: 'center', letterSpacing: '0.02em', margin: 0 }}>{data.nomor_surat}</span>
                        </div>

                        <div className="scan-letter-body">
                            <div className="scan-info-grid">
                                <div className="scan-info-item scan-col-span-2">
                                    <label>Jenis</label>
                                    <span className="scan-value scan-value-lg">{getBadgeLabel(data.jenis_izin)}</span>
                                </div>
                                {data.siswa_nama && data.siswa_nama !== 'REKAM MEDIK' && (
                                    <div className="scan-info-item scan-col-span-2">
                                        <label>Nama Siswa</label>
                                        <span className="scan-value scan-value-lg" style={{ fontWeight: 600 }}>{data.siswa_nama}</span>
                                    </div>
                                )}
                                {data.siswa_nisn && data.siswa_nisn !== '-' && (
                                    <div className="scan-info-item">
                                        <label>NISN</label>
                                        <span className="scan-value">{data.siswa_nisn}</span>
                                    </div>
                                )}
                                {data.siswa_kelas && data.siswa_kelas !== '-' && (
                                    <div className="scan-info-item">
                                        <label>{data.jenis_izin === 'REKAM_MEDIK' ? 'Periode' : 'Kelas'}</label>
                                        <span className="scan-value">{data.siswa_kelas}</span>
                                    </div>
                                )}
                                <div className="scan-info-item">
                                    <label>Tanggal Mulai</label>
                                    <span className="scan-value">{formatDate(data.tgl_mulai)}</span>
                                </div>
                                <div className="scan-info-item">
                                    <label>Tanggal Selesai</label>
                                    <span className="scan-value">{formatDate(data.tgl_selesai)}</span>
                                </div>
                                {data.keterangan && (
                                    <div className="scan-info-item scan-col-span-2">
                                        <label>Keterangan</label>
                                        <span className="scan-value">{data.keterangan}</span>
                                    </div>
                                )}
                                {data.penjabat_nama && (
                                    <>
                                        <div className="scan-info-item scan-col-span-2">
                                            <label>Penandatangan</label>
                                            <span className="scan-value" style={{ fontWeight: 600 }}>{data.penjabat_nama}</span>
                                        </div>
                                        <div className="scan-info-item scan-col-span-2">
                                            <label>Jabatan</label>
                                            <span className="scan-value">{data.penjabat_jabatan || '-'}</span>
                                        </div>
                                    </>
                                )}
                                <div className="scan-info-item">
                                    <label>Dibuat</label>
                                    <span className="scan-value">{formatDate(data.generated_at)}</span>
                                </div>
                                <div className="scan-info-item">
                                    <label>ID Verifikasi</label>
                                    <span className="scan-verify-id">{data.barcode}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Letter Preview */}
                <div className="scan-pdf-col">
                    <div className="scan-pdf-header">
                        <h3><i className="bi bi-file-earmark-text"></i> Pratinjau Dokumen Asli ACCA</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const iframe = document.querySelector('.scan-pdf-iframe') as HTMLIFrameElement;
                                    if (iframe?.contentWindow) {
                                        iframe.contentWindow.print();
                                    } else {
                                        window.open(`/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(barcode)}&print=1`, '_blank');
                                    }
                                }}
                                className="scan-btn scan-btn-success"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}
                            >
                                <i className="bi bi-printer"></i> Cetak / Simpan PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    window.open(`/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(barcode)}`, '_blank');
                                }}
                                className="scan-btn scan-btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}
                                title="Buka surat di tab baru"
                            >
                                <i className="bi bi-box-arrow-up-right"></i> Tab Baru
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof window !== 'undefined') {
                                        navigator.clipboard.writeText(window.location.href);
                                        alert("Link verifikasi berhasil disalin!");
                                    }
                                }}
                                className="scan-btn scan-btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}
                            >
                                <i className="bi bi-share"></i> Salin Link
                            </button>
                        </div>
                    </div>
                    <div className="scan-pdf-viewer" style={{ background: '#525659', padding: '0px', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
                        <iframe
                            src={`/api/ketidakhadiran/pdf-preview?barcode=${encodeURIComponent(barcode)}`}
                            title="Pratinjau Surat Ketidakhadiran"
                            className="scan-pdf-iframe"
                            style={{ width: '100%', height: '680px', background: 'white', border: 'none', display: 'block' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedAccaVerifyPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_ketidakhadiran_verify" />
            <AccaVerifyPage {...props} />
        </>
    );
}

