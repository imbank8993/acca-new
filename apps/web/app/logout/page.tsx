'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { cameFromAccaApplication, trustedLogoutOrigins } from '@/lib/logout-referrer'
import { logoutAcrossApplications, setLogoutInProgress } from '@/lib/single-logout-client'

/**
 * Pintu keluar bersama untuk aplikasi pendamping (CBT, Tools).
 *
 * Logout bersama dikoordinasikan dari halaman ACCA: hanya di sini browser bisa
 * memanggil endpoint logout setiap aplikasi dengan cookie masing-masing. Dulu
 * tombol keluar CBT hanya menghapus cookie CBT, sehingga sesi ACCA, Tools, dan
 * WordPress tetap aktif. CBT kini mengarahkan ke halaman ini.
 *
 * Logout berjalan otomatis hanya bila pengguna datang dari aplikasi ACCA sendiri
 * (dibaca dari `document.referrer`). Dari tempat lain halaman meminta konfirmasi,
 * supaya situs pihak ketiga tidak bisa diam-diam mengeluarkan pengguna.
 */
type State =
    | { step: 'confirm' }
    | { step: 'running' }
    | { step: 'partial'; failed: string[] }
    | { step: 'error'; localDone: boolean }

export default function LogoutPage() {
    const [state, setState] = useState<State>({ step: 'running' })
    const started = useRef(false)

    const run = useCallback(async () => {
        setState({ step: 'running' })
        setLogoutInProgress(true)
        let localDone = false
        try {
            const failed = await logoutAcrossApplications()
            localDone = true
            if (!failed.length) { window.location.replace('/login?logged_out=1'); return }
            setState({ step: 'partial', failed })
        } catch {
            setState({ step: 'error', localDone })
        } finally {
            setLogoutInProgress(false)
        }
    }, [])

    useEffect(() => {
        if (started.current) return
        started.current = true
        if (cameFromAccaApplication(document.referrer, trustedLogoutOrigins(window.location.origin))) void run()
        else setState({ step: 'confirm' })
    }, [run])

    const card: CSSProperties = { maxWidth: 420, width: '100%', padding: 28, borderRadius: 16, textAlign: 'center', background: 'var(--card-bg, #fff)', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)' }
    const primary: CSSProperties = { padding: '10px 20px', borderRadius: 10, border: 0, background: '#3083ff', color: '#fff', fontWeight: 600, cursor: 'pointer' }
    const secondary: CSSProperties = { ...primary, background: 'transparent', color: '#3083ff', border: '1px solid #3083ff' }

    return (
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={card}>
                {state.step === 'running' && (
                    <>
                        <Spinner variant="buble" />
                        <p style={{ marginTop: 16 }}>Keluar dari semua aplikasi ACCA…</p>
                    </>
                )}
                {state.step === 'confirm' && (
                    <>
                        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Keluar dari ACCA?</h1>
                        <p style={{ marginBottom: 20 }}>Sesi Anda di ACCA, ACCA CBT, ACCA Tools, dan website madrasah pada browser ini akan ditutup.</p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button type="button" style={primary} onClick={() => void run()}>Keluar</button>
                            <button type="button" style={secondary} onClick={() => window.location.replace('/dashboard')}>Batal</button>
                        </div>
                    </>
                )}
                {state.step === 'partial' && (
                    <>
                        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Sebagian sesi belum ditutup</h1>
                        <p style={{ marginBottom: 20 }}>Anda sudah keluar dari ACCA. Logout {state.failed.join(', ')} belum berhasil.</p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button type="button" style={primary} onClick={() => void run()}>Coba lagi</button>
                            <button type="button" style={secondary} onClick={() => window.location.replace('/login?logout=partial')}>Ke halaman login</button>
                        </div>
                    </>
                )}
                {state.step === 'error' && (
                    <>
                        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Logout belum selesai</h1>
                        <p style={{ marginBottom: 20 }}>Koneksi terganggu. Silakan coba lagi untuk menutup sesi Anda.</p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button type="button" style={primary} onClick={() => void run()}>Coba lagi</button>
                            {state.localDone && (
                                <button type="button" style={secondary} onClick={() => window.location.replace('/login?logout=partial')}>Ke halaman login</button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}
