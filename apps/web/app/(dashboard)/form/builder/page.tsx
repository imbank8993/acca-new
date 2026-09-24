'use client'

import { useDashboardUser } from '@/components/UserContext'
import ViewComponent from '@/app/form/builder/view'

export default function Page() {
    const { user } = useDashboardUser()
    if (!user) return null
    return <ViewComponent {...({ user } as any)} />
}
