'use client'

/**
 * Context user untuk shell dashboard.
 * Di-provide oleh app/(dashboard)/layout.tsx, dikonsumsi halaman-halaman di dalam group.
 */

import { createContext, useContext } from 'react'
import type { User } from '@/lib/types'

interface DashboardUserContextValue {
    user: User
    refreshUser: () => Promise<void>
}

export const DashboardUserContext = createContext<DashboardUserContextValue | null>(null)

export function useDashboardUser(): DashboardUserContextValue {
    const ctx = useContext(DashboardUserContext)
    if (!ctx) {
        throw new Error('useDashboardUser harus dipakai di dalam app/(dashboard)/layout.tsx')
    }
    return ctx
}
