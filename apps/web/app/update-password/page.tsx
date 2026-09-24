'use client'

import { useState, FormEvent, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#64748b', fontWeight: 600 }}>Memuat...</p>
      </div>
    }>
      <UpdatePasswordContent />
    </Suspense>
  )
}

function UpdatePasswordContent() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // 1. Coba tangkap token reset dari URL jika datang dari tautan reset email
    const url = window.location.href;
    const tokenMatch = url.match(/access_token=([^&]+)/);
    const codeMatch = url.match(/code=([^&]+)/);
    
    if (tokenMatch && tokenMatch[1]) {
      const cleanToken = tokenMatch[1].replace(/&amp;/g, '').split('#')[0];
      setToken(cleanToken);
      console.log('Token berhasil ditangkap dari URL');
    } else if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1].replace(/&amp;/g, '').split('#')[0];
      setToken(code);
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      // 2. Cek apakah pengguna sudah memiliki sesi login aktif via /api/auth/me
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.user) {
            setToken('active-cookie-session');
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password minimal harus 6 karakter');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok');
      return;
    }

    setLoading(true);

    try {
      if (!token) {
        setError('Sesi tidak valid atau telah kedaluwarsa. Silakan minta tautan reset baru.');
        setLoading(false);
        return;
      }

      // Sync ke database PostgreSQL VPS via API route internal
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && token !== 'active-cookie-session') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || 'Gagal memperbarui password');
        setLoading(false);
        return;
      }

      setSuccess(true);

      // Redirect ke login setelah 3 detik
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="up-wrap">
        <div className="up-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '3rem', color: '#16a34a', marginBottom: '20px' }}>
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#0f172a' }}>Password Diperbarui!</h2>
          <p style={{ color: '#64748b', marginBottom: '20px' }}>Password Anda telah berhasil diubah. Anda akan diarahkan ke halaman login dalam beberapa detik.</p>
          <button className="up-btn" onClick={() => router.push('/login')}>
            Ke Halaman Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="up-wrap">
      <div className="up-card">
        <div className="up-card-head">
          <h2>Atur Ulang Password</h2>
          <p>Masukkan password baru untuk akun Anda.</p>
        </div>

        <form className="up-form" onSubmit={handleUpdate}>
          <div className="up-field">
            <label htmlFor="password">Password Baru</label>
            <div className="up-input-wrap">
              <i className="bi bi-lock up-icon-field" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
                suppressHydrationWarning
              />
              <button
                type="button"
                className="up-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>

          <div className="up-field">
            <label htmlFor="confirmPassword">Konfirmasi Password Baru</label>
            <div className="up-input-wrap">
              <i className="bi bi-lock-fill up-icon-field" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                placeholder="Ketik ulang password baru"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                suppressHydrationWarning
              />
            </div>
          </div>

          {error && (
            <div className="up-error">
              <i className="bi bi-x-circle-fill" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="up-btn" disabled={loading} suppressHydrationWarning>
            {loading ? (
              <>
                <span className="up-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <i className="bi bi-check2" />
                Simpan Password Baru
              </>
            )}
          </button>
        </form>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          font-family: 'Poppins', system-ui, sans-serif;
          font-size: 14px;
          color: #0f172a;
          background: #f1f5f9;
          height: 100%;
          min-height: 100vh;
        }

        .up-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }

        .up-card {
          background: #ffffff;
          width: 100%;
          max-width: 450px;
          border-radius: 24px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
          padding: 40px;
          animation: slideUp 0.4s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .up-card-head {
          margin-bottom: 30px;
          text-align: center;
        }

        .up-card-head h2 {
          font-size: 1.5rem;
          color: #3083FF;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .up-card-head p {
          color: #64748b;
          font-size: 0.95rem;
        }

        .up-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .up-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .up-field label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .up-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .up-icon-field {
          position: absolute;
          left: 16px;
          color: #94a3b8;
          font-size: 1.1rem;
        }

        .up-input-wrap input {
          width: 100%;
          padding: 14px 16px 14px 44px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 0.95rem;
          font-family: inherit;
          color: #0f172a;
          background: #f8fafc;
          transition: all 0.2s;
        }

        .up-input-wrap input:focus {
          outline: none;
          border-color: #3083FF;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(0, 56, 168, 0.1);
        }

        .up-toggle-pw {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .up-toggle-pw:hover { color: #3083FF; }

        .up-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .up-btn {
          margin-top: 10px;
          width: 100%;
          padding: 14px;
          background: #3083FF;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 56, 168, 0.2);
        }

        .up-btn:hover:not(:disabled) {
          background: #00287a;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 56, 168, 0.3);
        }

        .up-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .up-spin {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
