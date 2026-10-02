'use client';

import { useEffect } from 'react';

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const isChunkError =
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Load failed');

    useEffect(() => {
        if (isChunkError) {
            const lastReload = sessionStorage.getItem('chunk_reload_retry');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
                sessionStorage.setItem('chunk_reload_retry', String(now));
                window.location.reload();
            }
        }
    }, [error, isChunkError]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            background: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '36px 28px',
                maxWidth: '440px',
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
                    {isChunkError ? 'Pembaruan Halaman Diperlukan' : 'Terjadi Kendala pada Halaman'}
                </h3>

                <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                    {isChunkError
                        ? 'Aplikasi telah diperbarui dengan versi terbaru. Silakan muat ulang halaman untuk melanjutkan.'
                        : 'Terjadi kesalahan saat memproses halaman ini. Silakan coba lagi atau muat ulang halaman.'}
                </p>

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
                        Muat Ulang Halaman
                    </button>
                </div>
            </div>
        </div>
    );
}
