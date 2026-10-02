'use client'

/**
 * Beranda dashboard (/dashboard) — konten utama dirender di dalam shell
 * app/(dashboard)/layout.tsx.
 */

import { useDashboardUser } from '@/components/UserContext'
import DashboardContent from './DashboardContent'
import ParentDashboard from './ParentDashboard'

export default function DashboardHomePage() {
    const { user } = useDashboardUser()

    const isParent =
        user?.roles?.some(r => ['ORANG_TUA', 'ORANGTUA', 'WALI'].includes(String(r).trim().toUpperCase())) ||
        ['ORANG_TUA', 'ORANGTUA', 'WALI'].some(r => String(user?.role || '').toUpperCase().includes(r));

    if (isParent) {
        return <ParentDashboard user={user} />
    }

    return <DashboardContent user={user} />
}
