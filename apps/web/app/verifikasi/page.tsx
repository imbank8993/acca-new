'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Spinner } from '@/components/ui/Spinner';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import '../surat/surat.css';

interface SuratVerified {
    found: boolean;
    valid: boolean;
    verified_at: string;
    letter: {
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
        penandatangan: {
            nama: string;
            jabatan: string;
        };
    };
}

function VerifikasiSuratPage() {
    return (
        <Suspense fallback={<div className="verify-page"><div className="verify-loading"><Spinner size={36} /><p>Memuat...</p></div></div>}>
            <VerifikasiContent />
        </Suspense>
    );
}

function VerifikasiContent() {
    const searchParams = useSearchParams();
    const [data, setData] = useState<SuratVerified | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [madrasahName, setMadrasahName] = useState('Madrasah');

    const letterId = searchParams.get('id');

    useEffect(() => {
        // Fetch school profile
        fetch('/api/profil-sekolah').then(r => r.json()).then(json => {
            if (json.ok && json.data?.nama) setMadrasahName(json.data.nama);
        }).catch(() => {});

        if (letterId) {
            fetchVerification();
        } else {
            setLoading(false);
        }
    }, [letterId]);

    const fetchVerification = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/surat/verify?letter_id=${letterId}`);
            const json = await res.json();
            setData(json);
            if (!json.ok) {
                setError(json.error || 'Gagal memverifikasi');
            }
        } catch (e: any) {
            setError(e.message);
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
            <div className="verify-page">
                <div className="verify-loading">
                    <Spinner size={36} />
                    <p>Memverifikasi dokumen...</p>
                </div>
            </div>
        );
    }

    if (error || !data?.found) {
        return (
            <div className="verify-page">
                <div className="verify-result verify-invalid">
                    <div className="verify-icon">
                        <i className="bi bi-x-circle-fill"></i>
                    </div>
                    <h1>Dokumen Tidak Ditemukan</h1>
                    <p>{error || 'Dokumen tidak ditemukan dalam database kami.'}</p>
                    <div className="verify-help">
                        <p>Pastikan Anda memindai QR Code yang benar dari dokumen asli.</p>
                    </div>
                    <div className="verify-id-display">
                        <span>ID: {letterId || '-'}</span>
                    </div>
                </div>
            </div>
        );
    }

    const { letter, verified_at } = data;

    return (
        <div className="verify-page animate-srt-fade-in">
            {letter.file_url ? (
                /* 2-Column Layout */
                <div className="scan-2col-layout" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', width: '100%' }}>
                    {/* LEFT Column: Info Container */}
                    <div className="scan-info-col">
                        <div className="verify-container" style={{ margin: 0, width: '100%', maxWidth: 'none' }}>
                            <div className="verify-header">
                                <div className="verify-logo">
                                    <img src="/logo-icon.png" alt={madrasahName} />
                                </div>
                                <h1>Verifikasi Dokumen</h1>
                                <p>{madrasahName}</p>
                            </div>

                            <div className="verify-result verify-valid" style={{ padding: '1.25rem' }}>
                                <div className="verify-badge">
                                    <i className="bi bi-patch-check-fill"></i>
                                    <span>DOKUMEN ASLI</span>
                                </div>

                                <div className="verify-timestamp" style={{ marginBottom: '1rem' }}>
                                    diverifikasi pada {formatDate(verified_at)}
                                </div>

                                <div className="verify-letter-info">
                                    <div className="info-row">
                                        <label>Nomor Surat</label>
                                        <span className="nomor-surat">{letter.nomor_surat}</span>
                                    </div>
                                    <div className="info-row">
                                        <label>Jenis</label>
                                        <span>{getJenisLabel(letter.jenis_surat)}</span>
                                    </div>
                                    <div className="info-row">
                                        <label>Perihal</label>
                                        <span className="perihal">{letter.perkara}</span>
                                    </div>
                                    <div className="info-row">
                                        <label>Dikirim Kepada</label>
                                        <span>{letter.kepada}</span>
                                    </div>
                                    {letter.alamat && (
                                        <div className="info-row">
                                            <label>Alamat</label>
                                            <span>{letter.alamat}</span>
                                        </div>
                                    )}
                                    <div className="info-row">
                                        <label>Tempat & Tanggal</label>
                                        <span>{letter.tempat_ttd}, {formatDate(letter.tanggal_ttd)}</span>
                                    </div>
                                    <div className="info-row">
                                        <label>Penandatangan</label>
                                        <span className="penandatangan">
                                            {letter.penandatangan?.nama || '-'}
                                            <small>{letter.penandatangan?.jabatan || ''}</small>
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <label>Tanggal Dibuat</label>
                                        <span>{formatDate(letter.created_at)}</span>
                                    </div>
                                    <div className="info-row">
                                        <label>Status</label>
                                        <span className={`status-pill status-${letter.status?.toLowerCase()}`}>
                                            {letter.status === 'FINAL' ? 'Dipublikasikan' : letter.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="verify-qr-section" style={{ marginTop: '1rem', padding: '0.75rem' }}>
                                    <p className="qr-label">Pindai QR Code di dokumen untuk verifikasi ulang</p>
                                    <img
                                        src={`/api/qrcode?data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/verifikasi?id=SRT-${letter.id}`)}`}
                                        alt="QR Code Verifikasi"
                                        className="verify-qr-image"
                                        style={{ width: '80px', height: '80px' }}
                                    />
                                    <p className="qr-url">SRT-{letter.id}</p>
                                </div>
                            </div>

                            <div className="verify-footer" style={{ marginTop: '1rem' }}>
                                <p>Terverifikasi oleh sistem ACCA {madrasahName}</p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT Column: PDF Viewer */}
                    <div className="scan-pdf-col">
                        <div className="scan-pdf-header">
                            <h3><i className="bi bi-file-earmark-pdf"></i> Preview Dokumen Asli</h3>
                            <a href={letter.file_url} target="_blank" rel="noopener noreferrer" className="verify-home-link" style={{ margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                <i className="bi bi-download"></i> Download
                            </a>
                        </div>
                        <div className="scan-pdf-viewer">
                            <iframe
                                src={letter.file_url}
                                title="Preview Surat"
                                className="scan-pdf-iframe"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                /* Standard 1-Column Layout */
                <div className="verify-container">
                    <div className="verify-header">
                        <div className="verify-logo">
                            <img src="/logo-icon.png" alt={madrasahName} />
                        </div>
                        <h1>Verifikasi Dokumen</h1>
                        <p>{madrasahName}</p>
                    </div>

                    <div className="verify-result verify-valid">
                        <div className="verify-badge">
                            <i className="bi bi-patch-check-fill"></i>
                            <span>DOKUMEN ASLI</span>
                        </div>

                        <div className="verify-timestamp">
                            diverifikasi pada {formatDate(verified_at)}
                        </div>

                        <div className="verify-letter-info">
                            <div className="info-row">
                                <label>Nomor Surat</label>
                                <span className="nomor-surat">{letter.nomor_surat}</span>
                            </div>
                            <div className="info-row">
                                <label>Jenis</label>
                                <span>{getJenisLabel(letter.jenis_surat)}</span>
                            </div>
                            <div className="info-row">
                                <label>Perihal</label>
                                <span className="perihal">{letter.perkara}</span>
                            </div>
                            <div className="info-row">
                                <label>Dikirim Kepada</label>
                                <span>{letter.kepada}</span>
                            </div>
                            {letter.alamat && (
                                <div className="info-row">
                                    <label>Alamat</label>
                                    <span>{letter.alamat}</span>
                                </div>
                            )}
                            <div className="info-row">
                                <label>Tempat & Tanggal</label>
                                <span>{letter.tempat_ttd}, {formatDate(letter.tanggal_ttd)}</span>
                            </div>
                            <div className="info-row">
                                <label>Penandatangan</label>
                                <span className="penandatangan">
                                    {letter.penandatangan?.nama || '-'}
                                    <small>{letter.penandatangan?.jabatan || ''}</small>
                                </span>
                            </div>
                            <div className="info-row">
                                <label>Tanggal Dibuat</label>
                                <span>{formatDate(letter.created_at)}</span>
                            </div>
                            <div className="info-row">
                                <label>Status</label>
                                <span className={`status-pill status-${letter.status?.toLowerCase()}`}>
                                    {letter.status === 'FINAL' ? 'Dipublikasikan' : letter.status}
                                </span>
                            </div>
                        </div>

                        <div className="verify-qr-section">
                            <p className="qr-label">Pindai QR Code di dokumen untuk verifikasi ulang</p>
                            <img
                                src={`/api/qrcode?data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/verifikasi?id=SRT-${letter.id}`)}`}
                                alt="QR Code Verifikasi"
                                className="verify-qr-image"
                            />
                            <p className="qr-url">app.adacode.ai/surat/scan/{letter.id}</p>
                        </div>

                        <div className="verify-id-display">
                            <span>ID Verifikasi: SRT-{letter.id}</span>
                        </div>
                    </div>

                    <div className="verify-footer">
                        <p>Dokumen ini terverifikasi oleh sistem ACCA {madrasahName}</p>
                        <a href="/" className="verify-home-link">
                            <i className="bi bi-house"></i>
                            Kunjungi Website
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedVerifikasiSuratPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_verifikasi" />
            <VerifikasiSuratPage {...props} />
        </>
    );
}
