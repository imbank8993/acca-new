'use client'

import { useEffect } from 'react'
import { clearUserCache } from '@/lib/auth-client'
import { isLogoutInProgress } from '@/lib/single-logout-client'

/** Follow logout in another ACCA tab without interrupting the tab coordinating it. */
export default function SingleLogoutListener() {
    useEffect(() => {
        const readMarker = () => document.cookie.split('; ').find(entry => entry.startsWith('acca_logout_at=')) || ''
        let previous = readMarker()
        const leave = () => { if (!isLogoutInProgress()) { clearUserCache(); window.location.replace('/login?logged_out=1') } }
        const check = () => { const current = readMarker(); if (current && current !== previous) { previous = current; leave() } }
        const onStorage = (event: StorageEvent) => { if (event.key === 'acca_logout_at' && event.newValue) leave() }
        const timer = setInterval(check, 2000)
        window.addEventListener('focus', check)
        window.addEventListener('storage', onStorage)
        document.addEventListener('visibilitychange', check)
        return () => { clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', check) }
    }, [])
    return null
}
