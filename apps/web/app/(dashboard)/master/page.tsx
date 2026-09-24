'use client'

import { useDashboardUser } from '@/components/UserContext'
import ViewComponent from '@/app/master/view'

/**
 * Gerbang wewenangnya ada di dalam `ViewComponent` (app/master/view.tsx), bukan
 * di sini — halaman ini juga bisa dirender lewat registry SPA lama pada route
 * catch-all `[...pageId]`, dan gerbang yang hanya dipasang di satu route akan
 * menyisakan jalur lain terbuka.
 */
export default function Page() {
    const { user } = useDashboardUser()
    if (!user) return null
    return <ViewComponent user={user} />
}
