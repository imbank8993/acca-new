'use client'

import { useState, FormEvent, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DatePicker from '@/components/ui/DatePicker'
import { Spinner } from '@/components/ui/Spinner'
import { Button, SubmitButton } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter, ModalField } from '@/components/ui/Modal'
import { InlineSelect } from '@/components/ui/InlineSelect'
import { UserKey } from 'lucide-react'
import Swal from 'sweetalert2'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Spinner variant="trace" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [isDark, setIsDark] = useState(false)

  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')
  const [forgotError, setForgotError] = useState('')

  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [regName, setRegName] = useState('')
  const [regStatus, setRegStatus] = useState('Ayah')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [regNisn, setRegNisn] = useState('')
  const [regTanggalLahir, setRegTanggalLahir] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')

  useEffect(() => {
    setMounted(true)
    setIsDark(document.documentElement.classList.contains('dark'))
    let isMounted = true

    // Fetch school profile for branding
    fetch('/api/profil-sekolah')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.ok && data.data?.nama) {
          setSchoolName(data.data.nama)
        }
      })
      .catch(() => { /* ignore network errors on login page */ })

    const errorParam = searchParams.get('error')
    const ERROR_MESSAGES: Record<string, string> = {
      not_registered: 'Sesi valid tapi akun Anda tidak terdaftar di database sistem. Hubungi administrator.',
      // Dikirim middleware saat sesi Supabase sudah dicabut. Tanpa pesan ini
      // pengguna hanya "terlempar" ke halaman login tanpa tahu sebabnya.
      'session-expired': 'Sesi Anda sudah berakhir dan telah dibersihkan dari perangkat ini. Silakan masuk kembali.',
      'sso-no-session': 'Sesi Anda sudah berakhir. Silakan masuk kembali lalu buka CBT dari menu.',
    }
    if (errorParam && ERROR_MESSAGES[errorParam]) {
      setError(ERROR_MESSAGES[errorParam])
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      router.replace(url.pathname, { scroll: false })
    }

    return () => { isMounted = false }
  }, [searchParams, router])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!username || !password) {
        setError('Username/Email dan password wajib diisi')
        return
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const contentType = res.headers.get('content-type') || ''
      let data: any
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const errorText = await res.text()
        console.error(`[login] Server returned non-JSON response (HTTP ${res.status}):`, errorText.slice(0, 200))
        setError(`Server sedang memperbarui atau bermasalah (${res.status}). Silakan coba beberapa saat lagi.`)
        return
      }

      console.log('Login response:', data)

      if (!data.ok) {
        setError(data.error || 'Gagal masuk')
        return
      }

      // Clear any stale user cache (sessionStorage) before redirecting
      try {
        const { clearUserCache } = await import('@/lib/auth-client')
        clearUserCache()
      } catch (e) {
        sessionStorage.removeItem('__acca_user')
        sessionStorage.removeItem('__acca_user_ts')
      }

      // Success! Tombol kembali ke bentuk semula + tampilkan centang sebelum redirect
      setLoading(false)
      setLoginSuccess(true)

      // Password sementara dari admin: arahkan ke Profil, yang tab bawaannya
      // ('akun') memang memuat form ganti password. Tanpa pengarahan ini penanda
      // `must_change_password` tidak berarti apa-apa bagi pemakai, dan password
      // sementara bisa bertahan berbulan-bulan.
      if (data.must_change_password) {
        setError('')
        await Swal.fire({
          icon: 'info',
          title: 'Ganti password Anda',
          text: 'Anda masuk memakai password sementara dari Admin. Silakan ganti sekarang agar akun Anda aman.',
          confirmButtonText: 'Ganti sekarang',
          allowOutsideClick: false,
        })
        window.location.href = '/profile'
        return
      }

      window.location.href = '/dashboard'
      return

    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const { clearUserCache } = await import('@/lib/auth-client')
      clearUserCache()
      await fetch('/api/auth/login', { method: 'DELETE' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotMessage('')
    setForgotLoading(true)

    try {
      const inputVal = forgotEmail.trim()
      if (!inputVal) {
        setForgotError('Email atau Username/NIP wajib diisi')
        setForgotLoading(false)
        return
      }

      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inputVal.includes('@') ? inputVal : '',
          username: inputVal,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        }),
      })
      const data = await res.json()

      if (!res.ok || data.ok === false) {
        setForgotError(data.error || 'Permintaan gagal. Coba lagi beberapa saat.')
      } else {
        setForgotMessage(
          data.message ||
            'Kalau akun itu ada dan punya email terdaftar, tautan untuk membuat password baru sudah dikirim.',
        )
      }
      setForgotLoading(false)

    } catch (err: any) {
      setForgotError(err.message || 'Terjadi kesalahan')
      setForgotLoading(false)
    }
  }

  const handleRegisterParent = async (e: FormEvent) => {
    e.preventDefault()
    setRegError('')
    setRegSuccess('')
    if (regPassword !== regPassword2) {
      setRegError('Konfirmasi kata sandi tidak cocok. Silakan ulangi.')
      return
    }
    if (!regTanggalLahir) {
      setRegError('Tanggal Lahir Siswa wajib diisi.')
      return
    }
    setRegLoading(true)
    try {
      const res = await fetch('/api/auth/register-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: regName,
          status_keluarga: regStatus,
          email: regEmail,
          password: regPassword,
          nisn: regNisn,
          tanggal_lahir_siswa: regTanggalLahir
        })
      })
      const data = await res.json()
      if (data.ok) {
        setRegSuccess('Akun berhasil dibuat! Silakan login menggunakan email dan kata sandi Anda.')
        setTimeout(() => {
          setShowRegisterModal(false)
          setUsername(regEmail)
          setPassword('')
        }, 3000)
      } else {
        setRegError(data.error || 'Gagal mendaftar')
      }
    } catch (err) {
      setRegError('Terjadi kesalahan jaringan')
    } finally {
      setRegLoading(false)
    }
  }

  const toggleTheme = () => {
    const nextDark = !document.documentElement.classList.contains('dark')
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', '1')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', '0')
    }
    setIsDark(nextDark)
  }

  return (
    <div className="lp-wrap">

      {/* ── Segmented Premium Theme Switch ── */}
      <button
        type="button"
        className={`lp-theme-switch ${isDark ? 'is-dark' : ''}`}
        onClick={toggleTheme}
        title={isDark ? "Mode Terang" : "Mode Gelap"}
        aria-label="Toggle Theme"
      >
        <span className="lp-switch-track">
          <span className={`lp-switch-slot ${!isDark ? 'is-active' : ''}`}>
            <i className="bi bi-sun-fill" />
          </span>
          <span className={`lp-switch-slot ${isDark ? 'is-active' : ''}`}>
            <i className="bi bi-moon-stars-fill" />
          </span>
          <span className="lp-switch-knob" />
        </span>
      </button>

      {/* ── Left Brand Panel ── */}
      <div className="lp-brand">
        {/* Gambar / artwork khusus dark mode */}
        <div className="lp-brand-art" aria-hidden="true" />

        <div className="lp-brand-inner">
          <div className="lp-brand-logo">
            {/* Dua varian logo; yang tampil dipilih lewat class .dark di <html> */}
            <img
              src="/logo-login-light.png"
              alt="Logo MAN IC Gowa"
              width="80"
              height="80"
              className="lp-brand-img-top lp-logo-light"
            />
            <img
              src="/logo-login-dark.png"
              alt="Logo MAN IC Gowa"
              width="80"
              height="80"
              className="lp-brand-img-top lp-logo-dark"
            />
          </div>
          <div className="lp-brand-acca-wrap">
            <img
              src="/acca_login_teks.png"
              alt="ACCA Text Logo"
              className="lp-brand-acca-img"
            />
          </div>
          <div className="lp-brand-text">
            <h1>{schoolName || 'MAN Insan Cendekia Gowa'}</h1>
            <p>Academic Center &amp; Administration</p>
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="lp-form-wrap">
        <div className="lp-card">
          <div className="lp-card-head">
            <h2>Masuk ke ACCA</h2>
            <p>Gunakan akun resmi {schoolName || 'MAN IC Gowa'}</p>
          </div>

          {!mounted && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
              <Spinner variant="trace" size={80} />
            </div>
          )}

          {mounted && (
            <form className="lp-form" onSubmit={handleLogin}>
              <div className="lp-field">
                <label htmlFor="username">Username / Email</label>
                <div className="lp-input-wrap">
                  <i className="bi bi-person lp-icon-field" />
                  <input
                    type="text"
                    id="username"
                    placeholder="Masukkan Username atau Email"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    suppressHydrationWarning
                  />
                </div>
              </div>

              <div className="lp-field">
                <label htmlFor="password">Password</label>
                <div className="lp-input-wrap">
                  <i className="bi bi-lock lp-icon-field" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="Ketik password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    className="lp-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="lp-error">
                  <i className="bi bi-x-circle-fill" />
                  <span>{error}</span>
                </div>
              )}

              <SubmitButton className="lp-btn" isLoading={loading} isSuccess={loginSuccess}>
                <i className="bi bi-box-arrow-in-right" />
                Masuk
              </SubmitButton>

              <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button type="button" className="lp-forgot-link" onClick={() => setShowForgotModal(true)}>Lupa Password?</button>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Belum punya akun? <button type="button" className="lp-forgot-link" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'inline' }} onClick={() => { setRegError(''); setRegSuccess(''); setRegPassword(''); setRegPassword2(''); setShowRegisterModal(true) }}>Daftar di sini</button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      <Modal
        open={showForgotModal}
        onClose={() => {
          setShowForgotModal(false)
          setForgotError('')
          setForgotMessage('')
        }}
        title="Lupa Password"
        icon={<UserKey size={18} strokeWidth={2.2} />}
        size="sm"
      >
        <form onSubmit={handleForgotPassword}>
          <ModalBody>
            <ModalField label="Email atau Username / NIP" required>
              <input
                type="text"
                placeholder="Email atau Username / NIP"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                disabled={forgotLoading}
                required
                autoFocus
              />
            </ModalField>

            {forgotError && (
              <div style={{ fontSize: '0.85rem', padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-x-circle-fill" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotMessage && (
              <div style={{ fontSize: '0.85rem', padding: '10px 14px', borderRadius: '10px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-check-circle-fill" />
                <span>{forgotMessage}</span>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowForgotModal(false)
                setForgotError('')
                setForgotMessage('')
              }}
              disabled={forgotLoading}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={forgotLoading}
            >
              Kirim Tautan Reset
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ── Register Parent Modal ── */}
      {showRegisterModal && (
        <div className="lp-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="lp-modal-content lp-register-modal" onClick={e => e.stopPropagation()}>
            <div className="lp-reg-header">
              <div>
                <h3>Pendaftaran Akun Orang Tua</h3>
                <p>Pantau perkembangan akademik anak Anda secara langsung.</p>
              </div>
              <button className="lp-reg-close" onClick={() => setShowRegisterModal(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="lp-modal-body lp-reg-body">
              {regSuccess ? (
                <div style={{ padding: '16px', background: '#dcfce7', color: '#166534', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="bi bi-check-circle-fill" style={{ fontSize: '1.2rem' }} />
                  <span>{regSuccess}</span>
                </div>
              ) : (
                <form onSubmit={handleRegisterParent}>
                  <p className="lp-reg-section"><i className="bi bi-person-fill" /> Data Orang Tua</p>
                  <div className="lp-reg-grid">
                    <div className="lp-field">
                      <label htmlFor="regName">Nama Lengkap</label>
                      <div className="lp-input-wrap">
                        <i className="bi bi-person lp-icon-field" />
                        <input type="text" id="regName" value={regName} onChange={e => setRegName(e.target.value)} required disabled={regLoading} placeholder="Nama orang tua" />
                      </div>
                    </div>

                    <div className="lp-field">
                      <label>Status Keluarga</label>
                      <InlineSelect
                        className="lp-reg-select"
                        value={regStatus}
                        onChange={setRegStatus}
                        disabled={regLoading}
                        height="42px"
                        minWidth="100%"
                        options={[
                          { value: 'Ayah', label: 'Ayah' },
                          { value: 'Ibu', label: 'Ibu' },
                          { value: 'Wali', label: 'Wali' },
                        ]}
                      />
                    </div>

                    <div className="lp-field lp-reg-full">
                      <label htmlFor="regEmail">Email (Username Login)</label>
                      <div className="lp-input-wrap">
                        <i className="bi bi-envelope lp-icon-field" />
                        <input type="email" id="regEmail" value={regEmail} onChange={e => setRegEmail(e.target.value)} required disabled={regLoading} placeholder="contoh@email.com" />
                      </div>
                    </div>

                    <div className="lp-field">
                      <label htmlFor="regPassword">Kata Sandi</label>
                      <div className="lp-input-wrap">
                        <i className="bi bi-lock lp-icon-field" />
                        <input type="password" id="regPassword" value={regPassword} onChange={e => setRegPassword(e.target.value)} required disabled={regLoading} minLength={6} placeholder="Min. 6 karakter" />
                      </div>
                    </div>

                    <div className="lp-field">
                      <label htmlFor="regPassword2">Ulangi Kata Sandi</label>
                      <div className="lp-input-wrap">
                        <i className="bi bi-shield-lock lp-icon-field" />
                        <input type="password" id="regPassword2" value={regPassword2} onChange={e => setRegPassword2(e.target.value)} required disabled={regLoading} minLength={6} placeholder="Ketik ulang sandi" />
                      </div>
                    </div>
                  </div>

                  {regPassword2 && regPassword !== regPassword2 && (
                    <p className="lp-reg-mismatch"><i className="bi bi-exclamation-circle" /> Kata sandi belum sama</p>
                  )}

                  <p className="lp-reg-section" style={{ marginTop: '16px' }}><i className="bi bi-mortarboard-fill" /> Verifikasi Data Anak</p>
                  <div className="lp-reg-grid">
                    <div className="lp-field">
                      <label htmlFor="regNisn">NISN Siswa</label>
                      <div className="lp-input-wrap">
                        <i className="bi bi-person-badge lp-icon-field" />
                        <input type="text" id="regNisn" value={regNisn} onChange={e => setRegNisn(e.target.value)} required disabled={regLoading} placeholder="NISN" />
                      </div>
                    </div>

                    <div className="lp-field">
                      <label htmlFor="regTanggalLahir">Tanggal Lahir Siswa</label>
                      <div className="lp-input-wrap">
                        <DatePicker id="regTanggalLahir" value={regTanggalLahir} onChange={setRegTanggalLahir} required disabled={regLoading} />
                      </div>
                    </div>
                  </div>

                  {regError && (
                    <div className="lp-error" style={{ fontSize: '0.85rem', padding: '10px', marginTop: '14px' }}>
                      <i className="bi bi-x-circle-fill" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <button type="submit" className="lp-btn" disabled={regLoading} style={{ marginTop: '18px' }}>
                    {regLoading ? (
                      <>
                        <span className="lp-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-person-plus-fill" />
                        Daftar & Klaim Anak
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* Ukuran teks semua kontrol isian (input, select, pemicu DatePicker).
           14px adalah ukuran desainnya; 16px cuma pengaman iOS. */
        :root { --lp-fs-control: 14px; }
        /* WebKit di iOS men-zoom halaman saat fokus ke kontrol form dengan
           font-size terhitung < 16px, dan mengabaikan maximum-scale. Gate-nya
           @supports (bukan pointer: coarse) supaya laptop layar sentuh Windows
           dan Android — yang tidak pernah auto-zoom — tetap dapat 14px.
           Alasan yang sama dengan --mdl-fs-control di components/modal.css. */
        @supports (-webkit-touch-callout: none) {
          :root { --lp-fs-control: 16px; }
        }

        .lp-theme-switch {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0;
          cursor: pointer;
          outline: none !important;
        }

        .lp-switch-track {
          position: relative;
          display: flex;
          align-items: center;
          width: 74px;
          height: 38px;
          padding: 3px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.65) !important;
          border: 1.5px solid rgba(203, 213, 225, 0.8) !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .lp-switch-slot {
          position: relative;
          z-index: 3;
          flex: 1;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 0.9rem;
          transition: color 0.3s ease;
        }

        .lp-switch-slot.is-active {
          color: #2563eb;
        }

        .lp-switch-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 33px;
          height: 30px;
          border-radius: 9px;
          background: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          z-index: 2;
          pointer-events: none;
          transition: transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
        }

        /* Mode Dark */
        .dark .lp-switch-track {
          background: rgba(15, 23, 42, 0.65) !important;
          border-color: rgba(37, 99, 235, 0.35) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.05);
        }

        .dark .lp-switch-slot {
          color: #475569;
        }

        .dark .lp-switch-slot.is-active {
          color: #60a5fa;
        }

        .dark .lp-switch-knob {
          transform: translateX(33px);
          background: rgba(37, 99, 235, 0.25) !important;
          border: 1.5px solid rgba(96, 165, 250, 0.6) !important;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 0 16px rgba(37, 99, 235, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }

        .lp-theme-switch:hover .lp-switch-track {
          transform: translateY(-1px);
        }

        .lp-forgot-link {
          background: none;
          border: none;
          color: #3083FF;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
        }
        .lp-forgot-link:hover { text-decoration: underline; color: #DB2777; }

        .lp-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          animation: fadeIn 0.2s ease;
          padding: 20px;
        }
        .lp-modal-content {
          /* Border transparan 1px: mode gelap menambahkan border di sini, dan
             tanpa padanan di mode terang kotak modal melar 2px saat mode
             ditukar. Lebarnya kini sama, yang berubah cuma warnanya. */
          border: 1px solid transparent;
          background: #ffffff;
          width: 100%;
          max-width: 420px;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .lp-modal-header h3 {
          margin: 0;
          font-size: 1.15rem;
          color: #0f172a;
          font-weight: 700;
        }
        .lp-modal-close {
          background: #f8fafc;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }
        .lp-modal-close:hover { background: #fee2e2; color: #dc2626; }
        .lp-modal-body {
          padding: 24px;
        }
        .lp-modal-body p {
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        /* ── Register Parent Modal ── */
        .lp-register-modal {
          max-width: 560px;
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
        }
        .lp-reg-header {
          /* Alasan sama dengan .lp-modal-content di atas: mode gelap memberi
             border-bottom, jadi mode terang perlu tebal yang sama agar isi
             modal tidak turun 1px saat berpindah mode. */
          border-bottom: 1px solid transparent;
          padding: 18px 24px;
          background: linear-gradient(135deg, var(--n-primary) 0%, #1d6bf3 100%);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-shrink: 0;
        }
        .lp-reg-header h3 {
          margin: 0 0 3px;
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
        }
        .lp-reg-header p {
          margin: 0;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.4;
        }
        .lp-reg-close {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ffffff;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .lp-reg-close:hover { background: rgba(255, 255, 255, 0.3); }
        .lp-reg-body {
          overflow-y: auto;
          padding: 18px 24px 22px;
        }
        .lp-reg-section {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--n-primary);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin: 0 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }
        .lp-reg-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 14px;
        }
        .lp-reg-full { grid-column: 1 / -1; }
        .lp-reg-mismatch {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 8px 0 0;
          font-size: 0.78rem;
          font-weight: 600;
          color: #dc2626;
        }
        /* <InlineSelect> default-nya ringkas (34px, 0.75rem) untuk disandingkan
           dengan ActionButton. Di modal ini dia berdiri sejajar .lp-input-wrap
           input, jadi geometri + fokusnya disamakan dengan input. */
        .lp-reg-select { display: flex; width: 100%; }
        .lp-reg-select select.uisel-input {
          padding: 0 32px 0 14px !important;
          background-color: #ffffff;
          border: 1.5px solid #94a3b8;
          border-radius: 12px;
          color: #0f172a;
          font-size: var(--lp-fs-control);
          font-weight: 400;
          transition: all 0.2s;
        }
        .lp-reg-select select.uisel-input:focus {
          border-color: #3083FF;
          box-shadow: 0 0 0 4px rgba(0, 56, 168, 0.12);
        }
        .lp-reg-select .uisel-icon { right: 12px; }
        @media (max-width: 560px) {
          .lp-reg-grid { grid-template-columns: 1fr; }
          .lp-register-modal { max-height: calc(100dvh - 24px); }
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        html, body {
          font-family: 'Poppins', system-ui, sans-serif;
          font-size: 14px;
          color: #0f172a;
          background: #f8fafc;
          height: 100%;
          min-height: 100vh;
          min-height: -webkit-fill-available;
        }

        /* ── Layout ── */
        .lp-wrap {
          display: flex;
          min-height: 100vh;
          min-height: -webkit-fill-available;
          animation: lpIn 0.5s ease;
        }
        @keyframes lpIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ── Left Brand (light mode) ── */
        .lp-brand {
          flex: 1;
          position: relative;
          background: linear-gradient(155deg, var(--n-primary) 0%, var(--n-primary) 40%, #DB2777 150%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 56px 44px 92px;
          overflow: hidden;
        }

        /* Soft glow blobs */
        .lp-brand::before {
          content: "";
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          top: -120px;
          left: -120px;
          pointer-events: none;
        }
        .lp-brand::after {
          content: "";
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(220,38,220,0.18) 0%, transparent 70%);
          bottom: -80px;
          right: -60px;
          pointer-events: none;
        }

        /* Artwork panel kiri. Berlaku di KEDUA mode; yang berbeda cuma
           berkasnya, ditimpa lewat background-image di aturan .dark di bawah
           supaya posisi/ukurannya tidak perlu ditulis dua kali.

           .lp-brand-inner punya z-index 1, jadi logo dan teksnya tetap berada
           di atas lapisan ini.

           CATATAN: jangan pakai backtick di komentar berkas ini. Seluruh CSS
           di sini hidup di dalam template literal styled-jsx, jadi satu
           backtick saja menutup literalnya dan build gagal. */
        .lp-brand-art {
          display: block;
          position: absolute;
          inset: 0;
          background: url('/login-kiri-light.webp?v=1') center center / cover no-repeat;
          pointer-events: none;
        }

        .lp-brand-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 430px;
        }

        .lp-brand-logo {
          position: relative;
          z-index: 1;
          margin-bottom: 16px;
        }
        .lp-brand-logo img, .lp-brand-img-top {
          /* 60px, turun dari 80px. Hanya nilai desktop — dua blok media query
             di bawah sudah menyetel 44px dan 36px sendiri untuk layar sempit,
             jadi keduanya tidak ikut terpengaruh. */
          width: 60px;
          height: auto;
          display: block;
          transition: filter 0.3s ease, transform 0.3s ease;
        }
        /* Spesifisitas sengaja disamakan dengan ".lp-brand-logo img" di atas,
           kalau tidak aturan display:block-nya menang dan kedua logo tampil. */
        .lp-brand-logo img.lp-logo-dark { display: none; }
        .lp-brand-acca-wrap {
          margin-bottom: 14px;
        }
        .lp-brand-acca-img {
          display: block;
          height: 45px;
          width: auto;
          margin: 0 auto;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.2));
          transition: filter 0.3s ease, transform 0.3s ease, height 0.2s ease;
        }
        .lp-brand-acca {
          position: relative;
          z-index: 1;
          font-family: 'Poppins', sans-serif;
          font-weight: 800;
          font-size: 3.5rem;
          letter-spacing: 0.05em;
          color: #ffffff;
          line-height: 1;
          margin-bottom: 14px;
          text-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .lp-brand-text {
          position: relative;
          z-index: 1;
          text-align: center;
        }
        .lp-brand-text h1 {
          font-size: 1.8rem;
          font-weight: 700;
          color: white;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
          text-shadow: 0 2px 16px rgba(0,0,0,0.2);
        }
        .lp-brand-text p {
          font-size: 0.7rem;
          /* Naik dari putih 70% / bobot 500, dan diberi bayangan.
             Latarnya FOTO, bukan warna rata — keterbacaan barisnya dulu
             bergantung pada bagian foto mana yang kebetulan ada di belakangnya,
             dan di area terang artwork mode terang ia nyaris lenyap. Bayangan
             gelap tipis inilah yang benar-benar memisahkannya dari latar;
             menaikkan opacity saja tidak menolong di bidang yang sudah terang.
             Pola yang sama sudah dipakai h1 di atasnya. */
          color: rgba(255,255,255,0.92);
          /* 2,4px — disamakan dengan mode gelap yang dulu menimpanya sendiri.
             Jarak huruf mengubah LEBAR baris, jadi nilai berbeda per mode
             membuat teks ini memanjang-memendek saat mode ditukar. */
          letter-spacing: 2.4px;
          text-transform: uppercase;
          font-weight: 600;
          text-shadow: 0 1px 10px rgba(0,0,0,0.35);
        }

        /* ── Right Form ── */
        .lp-form-wrap {
          flex: 1;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }

        .lp-card {
          width: 100%;
          max-width: 400px;
          background: white;
          border-radius: 24px;
          padding: 44px 36px;
          box-shadow:
            0 20px 40px -10px rgba(0, 56, 168, 0.1),
            0 30px 60px -15px rgba(0, 56, 168, 0.15),
            0 0 20px rgba(0, 0, 0, 0.03);
          /* 2px, sama dengan mode gelap. Tebalnya harus sama supaya kotak
             kartu tidak berubah ukuran saat berpindah mode; warnanya yang
             alphanya cuma 0,07 membuat tambahan 1px ini praktis tak terlihat. */
          border: 2px solid rgba(0,56,168,0.07);
          animation: cardIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .lp-card-head {
          text-align: center;
          margin-bottom: 32px;
        }

        .lp-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, var(--n-primary) 0%, var(--n-primary) 30%, #DB2777 125%);
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          font-size: 1.4rem;
          color: white;
          box-shadow: 0 8px 20px rgba(0,56,168,0.25);
        }

        .lp-card-head h2 {
          /* inline-block, menyamai mode gelap yang MEMBUTUHKANNYA agar
             background-clip:text pada judul bergradiennya bekerja. Dibiarkan
             block di sini, kotak judul melebar sepenuh kartu di mode terang
             lalu menyusut ke lebar teks di mode gelap — geometri yang berubah
             saat mode ditukar, padahal teksnya sama-sama terlihat di tengah. */
          display: inline-block;
          font-size: 1.3rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
          letter-spacing: -0.3px;
        }
        .lp-card-head p {
          font-size: 0.82rem;
          color: #94a3b8;
          font-weight: 500;
        }

        /* Form */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lp-field label {
          font-size: 0.78rem;
          font-weight: 750;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .lp-input-wrap {
          position: relative;
        }

        .lp-icon-field {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1rem;
          color: #475569;
          pointer-events: none;
          z-index: 1;
          transition: color 0.2s;
        }

        .lp-input-wrap input {
          width: 100%;
          height: 42px;
          padding: 0 14px 0 42px;
          background: #ffffff;
          border: 1.5px solid #94a3b8;
          border-radius: 12px;
          color: #0f172a;
          font-size: var(--lp-fs-control);
          font-weight: 400;
          outline: none;
          transition: all 0.2s;
          caret-color: #3083FF;
        }

        .lp-input-wrap input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .lp-input-wrap input:focus {
          border-color: #3083FF;
          background: white;
          box-shadow: 0 0 0 4px rgba(0, 56, 168, 0.12);
        }

        .lp-input-wrap input:focus ~ .lp-toggle-pw,
        .lp-input-wrap input:focus + .lp-toggle-pw {
          color: #3083FF;
        }

        .lp-input-wrap input:disabled {
          background: #f1f5f9;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .lp-input-wrap .dpk-trigger {
          height: 42px;
          padding: 0 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
          font-size: var(--lp-fs-control);
          transition: all 0.2s;
        }
        .lp-input-wrap .dpk-trigger.dpk-open {
          border-color: #3083FF;
          background: white;
          box-shadow: 0 0 0 4px rgba(0, 56, 168, 0.12);
        }
        .lp-input-wrap .dpk-trigger .dpk-icon {
          color: #94a3b8;
          font-size: 1rem;
        }
        .lp-input-wrap .dpk-trigger .dpk-placeholder {
          color: #cbd5e1;
        }

        .lp-toggle-pw {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #3083FF;
          font-size: 1.05rem;
          padding: 4px 6px;
          border-radius: 6px;
          transition: color 0.2s;
          line-height: 1;
        }
        .lp-toggle-pw:hover { color: #1d6bf3; }

        /* Error */
        .lp-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          color: #dc2626;
          font-size: 0.82rem;
          font-weight: 500;
        }
        .lp-error i { font-size: 0.95rem; flex-shrink: 0; }

        /* Button */
        .lp-btn {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 700;
          /* Biru rata, tanpa magenta. Sebelumnya gradien yang berakhir di
             #DB2777 pada 125% — magentanya cuma menyapu sudut kanan-bawah dan
             membuat tombol utama ini punya dua warna sementara mode gelapnya
             sudah biru polos (#2563eb). Sekarang kedua mode sepaham. */
          background: var(--n-primary);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          box-shadow: 0 6px 20px rgba(0,56,168,0.22);
          letter-spacing: 0.2px;
          margin-top: 4px;
        }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          /* Ikut biru. Nilai lama rgba(109,40,217) ungu — sisa dari gradien
             magenta, dan bayangan berona ungu di bawah tombol biru polos
             terbaca seperti warna yang tercecer. */
          box-shadow: 0 12px 28px rgba(48,131,255,0.32);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .lp-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .lp-btn i { font-size: 1rem; }

        /* Spinner */
        .lp-spin {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: lpRot 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes lpRot { to { transform: rotate(360deg); } }

        /* ── Responsive ── */
        @media (max-width: 820px) {
          /* Terkunci ke tinggi layar (bukan min-height) supaya panel brand +
             kartu login TIDAK PERNAH mendorong halaman untuk di-scroll —
             kalau isinya tetap kepanjangan di layar yang sangat pendek,
             .lp-form-wrap sendiri yang scroll secara internal (lihat di
             bawah), brand tetap terlihat. */
          .lp-wrap { flex-direction: column; height: 100dvh; overflow: hidden; }

          /* min-height berlaku untuk KEDUA mode. Sebelumnya hanya
             html:not(.dark) yang mendapat 280px, sedangkan mode gelap jatuh
             ke min-height auto sehingga panel brand menyusut mengikuti
             isinya — proporsi brand vs kartu login jadi berbeda antara
             terang dan gelap. Aturan .dark .lp-brand tidak menyetel
             min-height, jadi aturan (0,1,0) ini aman untuk dua-duanya.
             (Tanpa backtick: blok ini template literal styled-jsx.) */
          .lp-brand {
            flex: 0 0 auto;
            padding: 20px 24px 16px;
            min-height: 280px;
            background: linear-gradient(135deg, var(--n-primary) 0%, var(--n-primary) 40%, #DB2777 130%);
          }
          /* Padding TIDAK perlu ditandingi lagi di sini: aturan .dark .lp-brand
             sudah tidak menyetel padding sama sekali, jadi nilai .lp-brand di
             atas berlaku untuk kedua mode.
             Yang tetap dinetralkan cuma bayangannya: di mobile panel ini
             ditumpuk vertikal, jadi garis pemisah di sisi kanan salah sisi dan
             tidak punya padanan di mode terang. */
          .dark .lp-brand {
            box-shadow: none;
          }
          .lp-brand-logo { margin-bottom: 8px; }
          .lp-brand-logo img { width: 44px; }
          .lp-brand-acca-wrap { margin-bottom: 6px; }
          .lp-brand-acca-img { height: 28px; }
          .lp-brand-acca { font-size: 2.8rem; }
          .lp-brand-text h1 { font-size: 1.05rem; margin-bottom: 2px; }
          /* Tagline dekoratif, bukan informasi penting — dilepas dulu di layar
             pendek supaya form login (bagian fungsional) selalu muat tanpa
             scroll. */
          .lp-brand-text p { display: none; }
          .lp-brand-accent { display: none; }

          .lp-form-wrap {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding: 16px 20px 20px;
            align-items: flex-start;
          }
          .lp-card {
            padding: 22px 22px;
            border-radius: 20px;
          }
          .lp-card-head { margin-bottom: 16px; }
          .lp-card-head h2 { font-size: 1.1rem; }
          .lp-form { gap: 12px; }
          .lp-input-wrap input { height: 42px; }
          .lp-btn { height: 44px; }
        }

        /* Layar pendek (mis. ponsel landscape, atau ponsel kecil dengan chrome
           browser memakan porsi besar viewport) — susutkan lagi bagian yang
           masih bisa disusutkan sebelum .lp-form-wrap terpaksa scroll. */
        @media (max-width: 820px) and (max-height: 620px) {
          .lp-brand { padding: 14px 24px 10px; min-height: 210px; }
          .lp-brand-logo { margin-bottom: 6px; }
          .lp-brand-logo img { width: 36px; }
          .lp-brand-acca-wrap { margin-bottom: 4px; }
          .lp-brand-acca-img { height: 22px; }
          .lp-brand-text h1 { font-size: 0.92rem; }
          .lp-card-head { margin-bottom: 10px; }
          .lp-form { gap: 10px; }
        }

        /* ── Dark Mode Overrides ── */
        .dark .lp-wrap { background: #000000; }
        .dark .lp-form-wrap { 
          background: 
            radial-gradient(ellipse 120% 90% at 50% 15%, rgba(29, 78, 216, 0.45) 0%, rgba(17, 44, 122, 0.35) 45%, rgba(5, 14, 45, 0.75) 80%, #020718 100%),
            radial-gradient(ellipse 120% 90% at 50% 85%, rgba(29, 78, 216, 0.38) 0%, rgba(17, 44, 122, 0.3) 45%, rgba(5, 14, 45, 0.75) 80%, #020718 100%),
            radial-gradient(circle at 50% 50%, rgba(30, 64, 175, 0.3) 0%, rgba(10, 25, 75, 0.5) 50%, transparent 85%),
            #020718 !important; 
        }
        /* ── Panel kiri versi dark: tema tech gelap dengan login-kiri.webp ── */
        .dark .lp-brand {
          background: #01030A !important;
          /* TIDAK menyetel padding. Nilainya dulu 56px 44px 92px — persis
             sama dengan .lp-brand terang — jadi murni duplikat, dan justru
             duplikat itulah yang merusak: aturan ini berada SESUDAH media
             query mobile dan kekhususannya sama (0,2,0), sehingga ia menang
             karena urutan dan memaksa padding desktop dipakai di ponsel.
             Akibatnya isi panel melompat 20px setiap kali mode ditukar.
             Dengan padding dilepas, mode gelap mewarisi nilai mode terang di
             setiap breakpoint dan cukup dirawat di satu tempat. */
          /* Garis pemisah digambar sebagai box-shadow INSET, bukan border-right.
             Border menambah 1px pada lebar kotak, sedangkan mode terang tidak
             punya border — jadi panel kiri melebar 1px setiap kali berpindah ke
             mode gelap dan seluruh isinya ikut bergeser. box-shadow tidak
             memengaruhi tata letak sama sekali, jadi geometrinya kini identik di
             kedua mode dan yang berubah cuma warnanya. */
          box-shadow: inset -1px 0 0 rgba(37, 99, 235, 0.3), 4px 0 24px rgba(0, 0, 0, 0.4);
          position: relative;
        }
        /* Mode gelap cuma menukar BERKASNYA — posisi, ukuran, dan cover
           diwarisi dari .lp-brand-art di atas.

           v=5: berkasnya diperkecil dari 12154x12154 (147,7 MP, ~591 MB sekali
           di-decode) jadi 1400x1400. Versi lama membuat halaman login gagal
           dirender di mode gelap. Cache-buster dinaikkan supaya pengguna lama
           tidak tetap memakai berkas raksasa dari cache. */
        .dark .lp-brand-art {
          background-image: url('/login-kiri.webp?v=5');
          opacity: 0.95;
        }

        .dark .lp-brand-text h1 { text-shadow: 0 2px 16px rgba(0,0,0,0.45); }
        .dark .lp-brand-text p {
          color: rgba(96,165,250,0.85);
        }

        /* Varian logo per mode */
        .dark .lp-brand-logo img.lp-logo-light { display: none; }
        .dark .lp-brand-logo img.lp-logo-dark { display: block; }
        .dark .lp-card { 
          background: #000000; 
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.95);
        }
        .dark .lp-card-head h2 {
          background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%);
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          color: transparent !important;
          display: inline-block;
        }
        .dark .lp-card-head p { color: #94a3b8; }
        .dark .lp-field label { color: #cbd5e1; }
        .dark .lp-input-wrap input {
          background: #000000 !important;
          border-color: rgba(37, 99, 235, 0.4) !important;
          color: #f8fafc !important;
          /* Tanpa ini caret mewarisi magenta dari aturan light mode */
          caret-color: #60a5fa;
        }
        .dark .lp-input-wrap input:-webkit-autofill,
        .dark .lp-input-wrap input:-webkit-autofill:hover,
        .dark .lp-input-wrap input:-webkit-autofill:focus,
        .dark .lp-input-wrap input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #000000 inset !important;
          -webkit-text-fill-color: #f8fafc !important;
          caret-color: #60a5fa;
        }
        .dark .lp-input-wrap input:focus {
          background: #000000;
          border-color: #1a73e8;
          box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.15);
        }
        .dark .lp-input-wrap input:focus:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 30px #000000 inset !important;
        }
        .dark .lp-input-wrap input:disabled { background: rgba(255, 255, 255, 0.05); opacity: 0.5; }
        .dark .lp-input-wrap input::placeholder { color: #64748b; opacity: 1; }
        .dark .lp-icon-field, .dark .lp-toggle-pw { color: #60a5fa; }
        .dark .lp-toggle-pw:hover { color: #93c5fd; }
        /* Aturan light mode ".lp-input-wrap input:focus + .lp-toggle-pw" lebih
           spesifik dari ".dark .lp-toggle-pw", jadi ikon mata jadi magenta saat
           input password difokus. Perlu tandingan dengan spesifisitas setara. */
        .dark .lp-input-wrap input:focus ~ .lp-toggle-pw,
        .dark .lp-input-wrap input:focus + .lp-toggle-pw {
          color: #93c5fd;
        }
        .dark .lp-btn {
          background: #2563eb;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
          color: #ffffff;
        }
        .dark .lp-btn:hover:not(:disabled) {
          background: #1d6bf3;
          box-shadow: 0 12px 30px rgba(29, 107, 243, 0.65);
          transform: translateY(-2px);
        }
        .dark .lp-forgot-link { color: #60a5fa; }
        .dark .lp-forgot-link:hover { color: #93c5fd; }
        .dark .lp-form > div:last-child > div { color: #94a3b8 !important; }
        .dark .lp-error {
          background: rgba(220, 38, 38, 0.1);
          border-color: rgba(220, 38, 38, 0.2);
          color: #f87171;
        }

        /* Modal Dark Mode */
        .dark .lp-modal-content {
          background: #000000;
          border: 1px solid rgba(37, 99, 235, 0.45);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.95);
        }
        .dark .lp-modal-header { border-bottom-color: rgba(37, 99, 235, 0.2); }
        .dark .lp-modal-header h3 { color: #f8fafc; }
        .dark .lp-modal-close { background: rgba(37, 99, 235, 0.1); color: #94a3b8; }
        .dark .lp-modal-close:hover { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .dark .lp-modal-body p { color: #94a3b8; }
        .dark .lp-reg-header {
          background: #000000;
          border-bottom: 1px solid rgba(37, 99, 235, 0.45);
        }
        .dark .lp-reg-section {
          color: #60a5fa;
          border-bottom-color: rgba(37, 99, 235, 0.2);
        }
        .dark .lp-reg-select select.uisel-input {
          background-color: #000000 !important;
          border-color: rgba(37, 99, 235, 0.4) !important;
          color: #f8fafc !important;
        }
        .dark .lp-reg-select select.uisel-input:focus {
          border-color: #1a73e8 !important;
          box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.15) !important;
        }
        .dark .lp-reg-mismatch { color: #fb7185; }

        /* DatePicker Dark Mode Overrides */
        .dark .lp-input-wrap .dpk-trigger {
          background: #000000 !important;
          border-color: rgba(37, 99, 235, 0.4) !important;
          color: #f8fafc !important;
        }
        .dark .lp-input-wrap .dpk-trigger.dpk-open {
          background: #000000 !important;
          border-color: #1a73e8 !important;
          box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.15) !important;
        }
        .dark .lp-input-wrap .dpk-trigger .dpk-placeholder { color: #64748b !important; }
        .dark .lp-input-wrap .dpk-trigger .dpk-icon { color: #94a3b8 !important; }
        .dark .dpk-panel {
          background: #000000 !important;
          border: 1px solid rgba(37, 99, 235, 0.45) !important;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.95) !important;
        }
        .dark .dpk-header .dpk-title, .dark .dpk-header .dpk-nav { color: #f8fafc !important; }
        .dark .dpk-header .dpk-nav:hover, .dark .dpk-header .dpk-title:hover { background: rgba(37, 99, 235, 0.2) !important; }
        .dark .dpk-weekdays span { color: #60a5fa !important; }
        .dark .dpk-day { color: #cbd5e1 !important; }
        .dark .dpk-day:hover:not(:disabled) { background: rgba(37, 99, 235, 0.2) !important; color: #f8fafc !important; }
        .dark .dpk-day-today { box-shadow: inset 0 0 0 1.5px #1a73e8 !important; }
        .dark .dpk-day-selected { background: #1a73e8 !important; color: #ffffff !important; }
        .dark .dpk-footer { border-top-color: rgba(37, 99, 235, 0.2) !important; }
        .dark .dpk-link { color: #60a5fa !important; }
        .dark .dpk-link:hover { background: rgba(37, 99, 235, 0.2) !important; }
        .dark .dpk-cell { color: #cbd5e1 !important; }
        .dark .dpk-cell:hover { background: rgba(37, 99, 235, 0.2) !important; color: #f8fafc !important; }
        .dark .dpk-cell-selected { background: #1a73e8 !important; color: #ffffff !important; }

        /* Dark Mode Logo Effects */
        .dark .lp-brand-img-top, .dark .lp-brand-acca-img {
          /* Hanya filter. transform: translateY(-2px) dibuang — ia menggeser
             logo dan teks ACCA dua piksel ke atas HANYA di mode gelap, jadi
             keduanya terlihat melompat saat mode ditukar. drop-shadow tidak
             memengaruhi tata letak, jadi ini aman ditinggalkan sendiri. */
          filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.8)) drop-shadow(0 2px 4px rgba(255, 255, 255, 0.2)) !important;
        }
      `}</style>
    </div>
  )
}
