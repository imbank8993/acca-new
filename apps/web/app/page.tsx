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

  useEffect(() => {
    const checkAuth = async () => {
      // Jalur pintas `bypass_access` sudah dihapus dari middleware; cookie-nya
      // httpOnly sejak awal sehingga cek `document.cookie` di sini memang tidak
      // pernah bisa membacanya. Sesi ditentukan murni oleh /api/auth/me.
      let hasSession = false
      try {
        // Cek via /api/auth/me (cookie server) — getSession() tidak andal di app ini
        const userData = await getCurrentUser()
        hasSession = !!userData
      } catch (error) {
        console.error('Auth verify error:', error)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (showLogin) return <LoginPage />

  return <PageLoader variant="buble" minHeight="100vh" />
}
