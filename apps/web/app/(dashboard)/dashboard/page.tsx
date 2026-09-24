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

    if (user.roles?.includes('ORANG_TUA')) {
        return <ParentDashboard user={user} />
    }

    return <DashboardContent user={user} />
}
