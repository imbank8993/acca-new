'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Deteksi apakah error disebabkan oleh perbedaan chunk build saat deploy baru
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Load failed')

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('chunk_reload_retry')
      const now = Date.now()
      // Auto-reload 1 kali jika belum pernah reload dalam 15 detik terakhir
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('chunk_reload_retry', String(now))
        window.location.reload()
      }
    }
  }, [error])

  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    error?.message?.includes('Loading chunk') ||
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Load failed')

  return (
    <html lang="id">
      <body style={{
        margin: 0,
        padding: '1rem',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#f8fafc'
      }}>
        <div style={{
          maxWidth: '28rem',
          width: '100%',
          backgroundColor: '#1e293b',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155'
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            margin: '0 auto 1.25rem',
            borderRadius: '9999px',
            backgroundColor: isChunkError ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isChunkError ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem', color: '#f8fafc' }}>
            {isChunkError ? 'Pembaruan Halaman Diperlukan' : 'Terjadi Kesalahan pada Aplikasi'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1.5rem', lineHeight: '1.5' }}>
            {isChunkError
              ? 'Aplikasi telah diperbarui dengan versi terbaru. Silakan muat ulang halaman untuk melanjutkan.'
              : 'Terjadi kendala yang tidak terduga saat memuat halaman ini. Silakan coba lagi atau muat ulang.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {!isChunkError && (
              <button
                onClick={() => reset()}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
              >
                Coba Lagi
              </button>
            )}
            <button
              onClick={() => {
                sessionStorage.removeItem('chunk_reload_retry')
                window.location.reload()
              }}
              style={{
                backgroundColor: isChunkError ? '#2563eb' : '#334155',
                color: '#ffffff',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              Muat Ulang Halaman
            </button>
            <button
              onClick={() => {
                window.location.href = '/'
              }}
              style={{
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              Beranda
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
