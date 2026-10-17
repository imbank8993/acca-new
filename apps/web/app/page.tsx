'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import LoginPage from './login/page'
import { PageLoader } from '@/components/ui/Spinner'

export default function Home() {
  return (
    <Suspense fallback={<PageLoader variant="buble" minHeight="100vh" />}>
      <HomeRedirect />
    </Suspense>
  )
}

function HomeRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showLogin, setShowLogin] = useState(false)
  const [authError, setAuthError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    setAuthError('')
    setShowLogin(false)
    const checkAuth = async () => {
      // Jalur pintas `bypass_access` sudah dihapus dari middleware; cookie-nya
      // httpOnly sejak awal sehingga cek `document.cookie` di sini memang tidak
      // pernah bisa membacanya. Sesi ditentukan murni oleh /api/auth/me.
      let hasSession = false
      try {
        // Cek via /api/auth/me (cookie server) — getSession() tidak andal di app ini
        const userData = await getCurrentUser({ throwOnFailure: true })
        if (!active) return
        hasSession = !!userData
      } catch (error) {
        if (active) setAuthError(error instanceof Error && error.name === 'SessionCheckError' ? error.message : 'Koneksi pemeriksaan sesi terganggu. Silakan coba lagi.')
        return
      }

      if (hasSession) {
        // Kompatibilitas URL lama: /?page=x&tab=y → /x?tab=y
        const legacyPage = searchParams.get('page')
        if (legacyPage) {
          const tab = searchParams.get('tab')
          const path = '/' + legacyPage.split('/').map(encodeURIComponent).join('/')
          router.replace(tab ? `${path}?tab=${encodeURIComponent(tab)}` : path)
        } else {
          router.replace('/dashboard')
        }
      } else {
        setShowLogin(true)
      }
    }

    checkAuth()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount])

  if (authError) return (
    <div role="alert" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Pemeriksaan sesi tertunda</h1>
      <p>{authError}</p>
      <button type="button" onClick={() => setRetryCount(count => count + 1)} style={{ background: '#3083ff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 20px', font: 'inherit', cursor: 'pointer' }}>
        Coba lagi
      </button>
    </div>
  )

  if (showLogin) return <LoginPage />

  return <PageLoader variant="buble" minHeight="100vh" />
}
