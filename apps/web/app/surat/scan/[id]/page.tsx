'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Spinner } from '@/components/ui/Spinner';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import '../../surat.css';

interface SuratDetail {
    id: string;
    nomor_surat: string;
    jenis_surat: string;
    perkara: string;
    kepada: string;
    alamat: string;
    tempat_ttd: string;
    tanggal_ttd: string;
    created_at: string;
    status: string;
    file_url?: string;
    penandatangan_nama?: string;
    penandatangan_jabatan?: string;
}

function ScanVerificationPage() {
    const params = useParams();
    const router = useRouter();
    const [surat, setSurat] = useState<SuratDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const letterId = params.id as string;

    useEffect(() => {
        // Catatan: halaman ini dibuka anonim lewat scan QR, jadi jangan memanggil
        // API ber-auth di sini — permintaannya pasti 401 dan hasilnya tidak terpakai.
        if (letterId) {
            fetchSurat();
        }
    }, [letterId]);

    const fetchSurat = async () => {
        setLoading(true);
        try {
            // Clean the letter ID - remove SRT- prefix if present
            const cleanId = letterId.replace('SRT-', '');

            const res = await fetch(`/api/surat/verify?letter_id=${cleanId}`);
            const data = await res.json();

            if (!data.ok || !data.letter) {
                setError(data.error || 'Surat tidak ditemukan atau belum dipublikasikan.');
                setLoading(false);
                return;
            }

            // Ensure only final status can be viewed on public verification page
            if (data.letter.status !== 'FINAL') {
                setError('Dokumen surat belum dipublikasikan secara final.');
                setLoading(false);
                return;
            }

            setSurat(data.letter);
        } catch (e: any) {
            setError(e.message || 'Gagal memuat data surat');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const getJenisLabel = (jenis: string) => {
        const labels: Record<string, string> = {
            'UNDANGAN': 'Surat Undangan',
            'PEMBERITAHUAN': 'Surat Pemberitahuan'
        };
        return labels[jenis] || jenis;
    };

    if (loading) {
        return (
            <div className="scan-page-wrap">
                <div className="scan-loading">
                    <Spinner size={40} />
                    <p>Memverifikasi dokumen...</p>
                </div>
            </div>
        );
    }

    if (error || !surat) {
        return (
            <div className="scan-page-wrap">
                <div className="scan-error">
                    <div className="scan-error-icon">
                        <i className="bi bi-x-circle-fill"></i>
                    </div>
                    <h1>Dokumen Tidak Ditemukan</h1>
                    <p>{error || 'Dokumen tidak ditemukan dalam database kami.'}</p>
                    <div className="scan-help">
                        <p>Pastikan Anda memindai QR Code yang benar dari dokumen asli.</p>
                    </div>
                    <div className="scan-id-display">
                        <span>ID: {letterId || '-'}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="scan-page-wrap animate-srt-fade-in">
            {/* Verification Page Header */}
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
                        <span>Sistem Verifikasi Digital</span>
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
                            <span className="scan-nomor" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', width: '100%', textAlign: 'center', letterSpacing: '0.02em', margin: 0 }}>{surat.nomor_surat || '-'}</span>
                        </div>

                        <div className="scan-letter-body">
                            <div className="scan-info-grid">
                                <div className="scan-info-item">
                                    <label>Perihal</label>
                                    <span className="scan-value scan-value-lg">{surat.perkara || '-'}</span>
                                </div>
                                <div className="scan-info-item">
                                    <label>Penandatangan</label>
                                    <span className="scan-value scan-value-lg" style={{ fontWeight: 600 }}>{surat.penandatangan_nama || '-'}</span>
                                </div>
                                {surat.penandatangan_jabatan && (
                                    <div className="scan-info-item">
                                        <label>Jabatan</label>
                                        <span className="scan-value">{surat.penandatangan_jabatan}</span>
                                    </div>
                                )}
                                <div className="scan-info-item">
                                    <label>Tempat & Tanggal</label>
                                    <span className="scan-value">{surat.tempat_ttd || '-'}, {formatDate(surat.tanggal_ttd)}</span>
                                </div>
                                <div className="scan-info-item">
                                    <label>Dibuat</label>
                                    <span className="scan-value">{formatDate(surat.created_at)}</span>
                                </div>
                                <div className="scan-info-item">
                                    <label>ID Verifikasi</label>
                                    <span className="scan-verify-id">SRT-{surat.id}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="scan-actions">
                        {surat.file_url && (
                            <a href={surat.file_url} target="_blank" rel="noopener noreferrer" className="scan-btn scan-btn-success">
                                <i className="bi bi-download"></i>
                                Download PDF
                            </a>
                        )}
                        <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="scan-btn scan-btn-secondary">
                            <i className="bi bi-share"></i>
                            Salin Link
                        </button>
                    </div>
                </div>

                {/* RIGHT: PDF Viewer */}
                {surat.file_url && (
                    <div className="scan-pdf-col">
                        <div className="scan-pdf-header">
                            <h3><i className="bi bi-file-earmark-pdf"></i> Dokumen Surat</h3>
                        </div>
                        <div className="scan-pdf-viewer">
                            <iframe
                                src={surat.file_url}
                                title="Preview Surat"
                                className="scan-pdf-iframe"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedScanVerificationPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_surat_scan" />
            <ScanVerificationPage {...props} />
        </>
    );
}
