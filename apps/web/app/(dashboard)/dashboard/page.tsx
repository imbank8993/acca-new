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

    const roles = [
        ...(user?.roles || []),
        ...String(user?.role || '').split(/[,|]/),
    ].map(role => String(role).trim().toUpperCase().replace(/\s+/g, '_'));
    // Cocokkan role utuh: WALI_KELAS bukan role WALI/orang tua.
    const isParent = roles.some(role => ['ORANG_TUA', 'ORANGTUA', 'WALI'].includes(role));

    if (isParent) {
        return <ParentDashboard user={user} />
    }

    return <DashboardContent user={user} />
}
