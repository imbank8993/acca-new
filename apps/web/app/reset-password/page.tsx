'use client'

import { useState, FormEvent, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal, ModalBody, ModalFooter, ModalField } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { UserKey } from 'lucide-react'

function FormResetPassword() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showKonfirmasi, setShowKonfirmasi] = useState(false)

  const [checkingToken, setCheckingToken] = useState(true)
  const [tokenInvalidMessage, setTokenInvalidMessage] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [selesai, setSelesai] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Verifikasi keabsahan token saat halaman pertama kali dimuat
  useEffect(() => {
    if (!token) {
      setCheckingToken(false)
      setTokenInvalidMessage('Tautan tidak memuat kode verifikasi pemulihan.')
      return
    }

    let isMounted = true
    fetch('/api/auth/verify-recovery-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return
        if (data.valid === false) {
          setTokenInvalidMessage(data.message || 'Tautan pemulihan ini tidak sah atau sudah kedaluwarsa.')
        }
        setCheckingToken(false)
      })
      .catch(() => {
        if (isMounted) setCheckingToken(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    setGalat(null)

    if (password.length < 6) {
      setGalat('Kata sandi baru minimal 6 karakter.')
      return
    }
    if (password !== konfirmasi) {
      setGalat('Konfirmasi kata sandi tidak cocok.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) {
        setGalat(
          data.error ||
            'Tautan tidak sah atau sudah kedaluwarsa. Silakan minta tautan baru.',
        )
      } else {
        setSelesai(true)
      }
    } catch {
      setGalat('Tidak dapat terhubung ke server. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return null
  }

  // 1. Sedang memeriksa token
  if (checkingToken) {
    return (
      <Modal open={true} onClose={() => {}} title="Memeriksa Tautan" size="sm" closeOnOverlayClick={false}>
        <ModalBody style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '36px 16px' }}>
          <Spinner variant="buble" size={28} />
        </ModalBody>
      </Modal>
    )
  }

  // 2. Token tidak sah / kedaluwarsa
  if (tokenInvalidMessage) {
    return (
      <Modal open={true} onClose={() => router.push('/login')} title="Tautan Tidak Berlaku" size="sm">
        <ModalBody>
          <div style={{ fontSize: '0.85rem', padding: '12px 14px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-x-circle-fill" />
            <span>{tokenInvalidMessage}</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" type="button" onClick={() => router.push('/login')}>
            Kembali ke Halaman Masuk
          </Button>
        </ModalFooter>
      </Modal>
    )
  }

  // 3. Selesai diperbarui
  if (selesai) {
    return (
      <Modal open={true} onClose={() => router.push('/login')} title="Kata Sandi Diperbarui" size="sm">
        <ModalBody>
          <div style={{ fontSize: '0.85rem', padding: '12px 14px', borderRadius: '10px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-check-circle-fill" />
            <span>Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" type="button" onClick={() => router.push('/login')}>
            Masuk ke Akun
          </Button>
        </ModalFooter>
      </Modal>
    )
  }

  // 4. Form Buat Kata Sandi Baru
  return (
    <Modal
      open={true}
      onClose={() => router.push('/login')}
      title="Atur Ulang Kata Sandi"
      icon={<UserKey size={18} strokeWidth={2.2} />}
      size="sm"
    >
      <form onSubmit={kirim}>
        <ModalBody>
          <ModalField label="Kata Sandi Baru" required>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Kata Sandi Baru"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoFocus
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan' : 'Lihat'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </ModalField>

          <ModalField label="Konfirmasi Kata Sandi" required>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                type={showKonfirmasi ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Konfirmasi Kata Sandi"
                value={konfirmasi}
                onChange={(e) => setKonfirmasi(e.target.value)}
                disabled={loading}
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowKonfirmasi(!showKonfirmasi)}
                aria-label={showKonfirmasi ? 'Sembunyikan' : 'Lihat'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <i className={`bi ${showKonfirmasi ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </ModalField>

          {galat && (
            <div style={{ fontSize: '0.85rem', padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="bi bi-x-circle-fill" />
              <span>{galat}</span>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="cancel"
            type="button"
            onClick={() => router.push('/login')}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={loading}
            disabled={!password || !konfirmasi}
          >
            Simpan Kata Sandi
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Suspense fallback={null}>
        <FormResetPassword />
      </Suspense>
    </div>
  )
}
