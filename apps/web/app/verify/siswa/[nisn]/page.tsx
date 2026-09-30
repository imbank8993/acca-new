'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Spinner } from '@/components/ui/Spinner';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import '../../../surat/surat.css';

function VerifySiswaPage() {
    const params = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const identifier = params?.nisn ? String(params.nisn).trim() : '';

    useEffect(() => {
        if (identifier) {
            fetchData();
        } else {
            setLoading(false);
            setError('ID Kartu atau NISN tidak ditemukan di URL.');
        }
    }, [identifier]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Try card_id first (format: ACCA-XXXXXXXX)
            const isCardId = identifier.startsWith('ACCA-');
            const paramKey = isCardId ? 'card_id' : 'nisn';
            const res = await fetch(`/api/master/students/verify?${paramKey}=${encodeURIComponent(identifier)}`);
            const json = await res.json();
            if (json.ok) {
                setData(json.data);
            } else {
                setError(json.error || 'Siswa tidak ditemukan');
            }
        } catch (e: any) {
            setError(e.message || 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        const dt = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
        if (isNaN(dt.getTime())) return '-';
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    };

    const getGenderLabel = (g: string) => {
        return g === 'L' ? 'Laki-laki' : 'Perempuan';
    };

    if (loading) {
        return (
            <div className="scan-page-wrap animate-srt-fade-in" style={{ padding: '16px', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: 'var(--n-text)' }}>
                <div className="scan-loading" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner size={40} />
                    <p style={{ marginTop: '16px', color: 'var(--n-muted)', fontWeight: 500 }}>Memverifikasi identitas siswa...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="scan-page-wrap animate-srt-fade-in" style={{ padding: '16px', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: 'var(--n-text)' }}>
                {/* Header Bar */}
                <header className="scan-header-bar" style={{ padding: '12px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href="/" className="scan-btn-back" style={{ color: 'var(--n-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <i className="bi bi-arrow-left"></i>
                        <span>Kembali</span>
                    </a>
                    <div className="scan-system-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: 600, fontSize: '0.85rem' }}>
                        <i className="bi bi-shield-check"></i>
                        <span className="hide-mobile">Sistem Verifikasi Siswa</span>
                    </div>
                </header>

                <div className="scan-error">
                    <div className="scan-error-icon"><i className="bi bi-x-circle-fill"></i></div>
                    <h1>{data?.status === 'CARD_INACTIVE' ? 'Kartu Tidak Aktif' : 'Siswa Tidak Ditemukan'}</h1>
                    <p>{data?.message || error || 'NISN atau ID Kartu tidak valid.'}</p>
                    <div className="scan-help">
                        <p>Pastikan Anda memindai QR Code yang benar dari kartu siswa.</p>
                    </div>
                    <div className="scan-id-display">
                        <span>ID: {identifier || '-'}</span>
                    </div>
                </div>
            </div>
        );
    }

    const { siswa, card_id, schoolName, schoolLogo, verified, message } = data;

    return (
        <div className="scan-page-wrap animate-srt-fade-in" style={{ padding: '16px', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: 'var(--n-text)' }}>
            {/* Header Bar */}
            <header className="scan-header-bar" style={{ padding: '12px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a href="/" className="scan-btn-back" style={{ color: 'var(--n-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <i className="bi bi-arrow-left"></i>
                    <span>Kembali</span>
                </a>
                <div className="scan-system-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: 600, fontSize: '0.85rem' }}>
                    <i className="bi bi-shield-check"></i>
                    <span className="hide-mobile">Sistem Verifikasi Siswa</span>
                </div>
            </header>

            {/* Main Content */}
            <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Verification Badge */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '6px',
                    padding: '20px', borderRadius: '16px', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                    {verified ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 800, fontSize: '1.2rem' }}>
                            <i className="bi bi-patch-check-fill" style={{ fontSize: '1.5rem' }}></i>
                            <span>SISWA AKTIF</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 800, fontSize: '1.2rem' }}>
                            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.5rem' }}></i>
                            <span>SISWA NON-AKTIF</span>
                        </div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: 'var(--n-muted)' }}>
                        Diverifikasi: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                {/* Student Card */}
                <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    {/* School Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: 'white' }}>
                        {schoolLogo ? (
                            <img src={schoolLogo} alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain', background: 'white', borderRadius: '50%', padding: '4px' }} />
                        ) : (
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="bi bi-building" style={{ fontSize: '1.5rem', color: 'white' }}></i>
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2 }}>{schoolName}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Kartu Identitas Siswa</div>
                        </div>
                    </div>

                    {/* Student Info Body */}
                    <div style={{ padding: '20px' }}>
                        {/* Large Name Display */}
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--n-text)', lineHeight: 1.2 }}>
                                {siswa?.nama_lengkap || '-'}
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginTop: '8px', padding: '6px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--n-muted)', fontWeight: 600 }}>
                                <span>NISN: {siswa?.nisn || '-'}</span>
                                {card_id && (
                                    <>
                                        <span style={{ color: '#cbd5e1' }}>|</span>
                                        <span>ID: {card_id}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Jenis Kelamin</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--n-text)', fontWeight: 500 }}>{getGenderLabel(siswa?.gender)}</span>
                            </div>
                            {siswa?.nik && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>NIK</span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--n-text)', fontWeight: 500 }}>{siswa.nik}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tempat Lahir</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--n-text)', fontWeight: 500 }}>{siswa?.tempat_lahir || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tanggal Lahir</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--n-text)', fontWeight: 500 }}>{formatDate(siswa?.tanggal_lahir)}</span>
                            </div>
                            {siswa?.asal_sekolah && (
                                <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Asal Sekolah</span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--n-text)', fontWeight: 500 }}>{siswa.asal_sekolah}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Alamat</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--n-text)', fontWeight: 500 }}>{siswa?.alamat || '-'}</span>
                            </div>
                        </div>

                        {/* Status Message */}
                        <div style={{
                            marginTop: '16px', padding: '12px 16px', borderRadius: '10px',
                            background: verified ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${verified ? '#bbf7d0' : '#fecaca'}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700, color: verified ? '#16a34a' : '#dc2626' }}>
                                <i className={`bi ${verified ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}></i>
                                <span>{message}</span>
                            </div>
                            {!verified && (
                                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>
                                    Siswa telah lulus atau pindah sekolah
                                </div>
                            )}
                        </div>

                        {/* System Usage Hints */}
                        {verified && card_id && (
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>
                                    <i className="bi bi-info-circle" style={{ marginRight: '6px' }}></i> Fasilitas Kartu:
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {[
                                        { icon: 'bi-qr-code-scan', label: 'Verifikasi' },
                                        { icon: 'bi-calendar-check', label: 'Absensi' },
                                        { icon: 'bi-book', label: 'Perpustakaan' },
                                        { icon: 'bi-clock-history', label: 'Peminjaman' },
                                    ].map((item) => (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--n-muted)', fontWeight: 500, padding: '6px', background: '#f8fafc', borderRadius: '6px' }}>
                                            <i className={item.icon} style={{ fontSize: '0.9rem', color: '#3b82f6' }}></i>
                                            {item.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Custom style for mobile hide */}
            <style jsx>{`
                @media (max-width: 640px) {
                    .hide-mobile { display: none; }
                }
            `}</style>
        </div>
    );
}

export default function MaintenanceWrappedVerifySiswaPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_verify_siswa" />
            <VerifySiswaPage {...props} />
        </>
    );
}