'use client';

import { useEffect, useState } from 'react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [showDetails, setShowDetails] = useState(false);
    const [copied, setCopied] = useState(false);

    const isChunkError =
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Load failed');

    useEffect(() => {
        console.error('[DashboardError] Unhandled error caught by dashboard boundary:', error);
        if (isChunkError) {
            const lastReload = sessionStorage.getItem('chunk_reload_retry');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
                sessionStorage.setItem('chunk_reload_retry', String(now));
                window.location.reload();
            }
        }
    }, [error, isChunkError]);

    const handleCopy = () => {
        const text = `Error: ${error?.name || 'Error'}\nMessage: ${error?.message || 'Unknown'}\nDigest: ${error?.digest || 'N/A'}\nStack:\n${error?.stack || 'N/A'}`;
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '24px',
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '36px 28px',
                maxWidth: '480px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
            }}>
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: isChunkError ? '#eff6ff' : '#fef2f2',
                    color: isChunkError ? '#2563eb' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: '1.6rem'
                }}>
                    <i className={isChunkError ? 'bi bi-arrow-repeat' : 'bi bi-exclamation-triangle'}></i>
                </div>

                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                    {isChunkError ? 'Pembaruan Halaman Diperlukan' : 'Gagal Memuat Konten'}
                </h3>

                <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                    {isChunkError
                        ? 'Terdapat versi terbaru dari aplikasi. Halaman perlu dimuat ulang untuk memperbarui modul.'
                        : 'Terjadi kendala saat memuat bagian dashboard. Anda dapat mencoba memuat ulang atau memuat kembali halaman.'}
                </p>

                {error?.message && !isChunkError && (
                    <div style={{ margin: '0 0 20px', textAlign: 'left' }}>
                        <button
                            type="button"
                            onClick={() => setShowDetails(!showDetails)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span>{showDetails ? 'Sembunyikan Detail Galat' : 'Lihat Detail Galat'}</span>
                            <i className={`bi bi-chevron-${showDetails ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
                        </button>

                        {showDetails && (
                            <div style={{
                                marginTop: '8px',
                                padding: '12px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                color: '#334155',
                                wordBreak: 'break-word',
                                maxHeight: '180px',
                                overflowY: 'auto'
                            }}>
                                <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                                    {error.name || 'Error'}: {error.message}
                                </div>
                                {error.digest && (
                                    <div style={{ color: '#64748b', marginBottom: '8px' }}>
                                        Digest: {error.digest}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    style={{
                                        marginTop: '6px',
                                        padding: '4px 8px',
                                        background: '#e2e8f0',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        cursor: 'pointer',
                                        color: '#334155'
                                    }}
                                >
                                    {copied ? 'Tersalin!' : 'Salin Detail'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    {!isChunkError && (
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '10px 20px',
                                background: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                cursor: 'pointer'
                            }}
                        >
                            <i className="bi bi-arrow-clockwise" style={{ marginRight: '6px' }}></i>
                            Coba Lagi
                        </button>
                    )}
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('chunk_reload_retry');
                            window.location.reload();
                        }}
                        style={{
                            padding: '10px 20px',
                            background: isChunkError ? '#2563eb' : '#f1f5f9',
                            color: isChunkError ? '#fff' : '#334155',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            cursor: 'pointer'
                        }}
                    >
                        <i className="bi bi-arrow-repeat" style={{ marginRight: '6px' }}></i>
                        Muat Ulang Halaman
                    </button>
                </div>
            </div>
        </div>
    );
}
