'use client'

import { useDashboardUser } from '@/components/UserContext'
import ViewComponent from '@/app/kinerja-guru/view'

export default function Page() {
    const { user } = useDashboardUser()
    if (!user) return null
    return <ViewComponent {...({ user } as any)} />
}
