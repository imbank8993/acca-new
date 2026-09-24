'use client'

import { useDashboardUser } from '@/components/UserContext'
import ViewComponent from '@/app/profile/view'

export default function Page() {
    const { user, refreshUser } = useDashboardUser()
    if (!user) return null
    return <ViewComponent user={user} onRefreshUser={refreshUser} />
}
