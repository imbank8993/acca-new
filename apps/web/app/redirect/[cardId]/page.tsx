'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function RedirectPage() {
    const params = useParams();
    const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [appName, setAppName] = useState('ACCA');

    const cardId = params.cardId as string;

    useEffect(() => {
        if (!cardId) {
            setStatus('error');
            setErrorMsg('Card ID tidak ditemukan di URL');
            return;
        }

        const doRedirect = async () => {
            try {
                // 1. Get app base URL from config (hosting-agnostic)
                let baseUrl = '';
                try {
                    const configRes = await fetch('/api/config?key=verify_base_url');
                    const configJson = await configRes.json();
                    if (configJson.ok && configJson.data) {
                        baseUrl = configJson.data.trim();
                    }
                } catch (e) {
                    console.warn('[Redirect] Could not fetch verify_base_url config:', e);
                }

                // 2. Fallback: use current origin if config not set
                if (!baseUrl) {
                    baseUrl = window.location.origin;
                }

                // 3. Also get app name for display
                try {
                    const nameRes = await fetch('/api/config?key=app_name');
                    const nameJson = await nameRes.json();
                    if (nameJson.ok && nameJson.data) {
                        setAppName(nameJson.data.trim());
                    }
                } catch (e) {
                    // ignore
                }

                // 4. Build target URL and redirect
                const finalUrl = `${baseUrl}/verify/siswa/${cardId}`;
                setTargetUrl(`/verify/siswa/${cardId}`);
                setStatus('redirecting');

                // Short delay for UX
                setTimeout(() => {
                    window.location.href = finalUrl;
                }, 1500);

            } catch (e: any) {
                setStatus('error');
                setErrorMsg(e.message || 'Terjadi kesalahan saat mengarahkan');
            }
        };

        doRedirect();
    }, [cardId]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: 'linear-gradient(135deg, #3083FF 0%, #c2185b 100%)',
            color: 'white',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            {status === 'loading' || status === 'redirecting' ? (
                <>
                    {/* Logo */}
                    <div style={{
                        width: '64px', height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '24px',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <i className="bi bi-qr-code-scan" style={{ fontSize: '2rem', color: 'white' }}></i>
                    </div>

                    <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700 }}>
                        {appName} — Card Reader
                    </h1>
                    <p style={{ margin: '0 0 32px', fontSize: '0.9rem', opacity: 0.8 }}>
                        Memverifikasi kartu siswa...
                    </p>

                    {/* Spinner */}
                    <div style={{
                        width: '40px', height: '40px',
                        border: '4px solid rgba(255,255,255,0.2)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'rSpin 0.8s linear infinite',
                        marginBottom: '16px'
                    }} />

                    <p style={{ fontSize: '0.8rem', opacity: 0.7, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>
                        {cardId || 'Memuat...'}
                    </p>

                    <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '32px' }}>
                        Mengarahkan ke halaman verifikasi...
                    </p>

                    {targetUrl && (
                        <div style={{
                            marginTop: '12px',
                            padding: '8px 16px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            fontSize: '0.7rem',
                            fontFamily: 'ui-monospace, monospace',
                            opacity: 0.7,
                            maxWidth: '320px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {targetUrl}
                        </div>
                    )}

                    <style>{`
                        @keyframes rSpin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </>
            ) : (
                <>
                    <div style={{
                        width: '64px', height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(239,68,68,0.2)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '24px'
                    }}>
                        <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', color: '#fca5a5' }}></i>
                    </div>

                    <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700 }}>
                        Terjadi Kesalahan
                    </h1>
                    <p style={{ margin: '0 0 24px', fontSize: '0.9rem', opacity: 0.8, textAlign: 'center', maxWidth: '360px' }}>
                        {errorMsg || 'Tidak dapat mengarahkan ke halaman verifikasi.'}
                    </p>

                    <a
                        href="/"
                        style={{
                            padding: '12px 28px',
                            background: 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '12px',
                            color: 'white',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            backdropFilter: 'blur(8px)'
                        }}
                    >
                        Kembali ke Beranda
                    </a>
                </>
            )}
        </div>
    );
}