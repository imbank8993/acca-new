'use client'

import { useDashboardUser } from '@/components/UserContext'
import JadwalPage from '@/app/jadwal/view'
import OrangTuaWrapper from '@/app/jadwal/OrangTuaWrapper'

export default function Page() {
    const { user } = useDashboardUser()
    if (!user) return null
    return user.roles?.includes('ORANG_TUA') ? <OrangTuaWrapper user={user} /> : <JadwalPage user={user} />
}
