'use client'

import { useEffect, useState } from 'react'
import Spinner from '@/components/ui/Spinner'
import { getCurrentUser } from '@/lib/auth-client'
import PTSPClient from './components/PTSPClient'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import type { User } from '@/lib/types'

export default function LayananPTSPPage() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const userData = await getCurrentUser()
                if (!userData) {
                    window.location.href = '/auth/login'
                    return
                }

                setUser(userData)
            } catch (e) {
                console.error('[ptsp] load error:', e)
                setUser(null)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner variant="buble" />
            </div>
        )
    }

    return (
        <MaintenanceBanner pageKey="maintenance_layanan_ptsp">
            <div className="ptsp-wrapper">
                

                <PTSPClient user={user} />

                <style jsx>{`
                    .ptsp-wrapper {
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                        padding-bottom: 48px;
                        font-family: 'Poppins', sans-serif;
                    }
                `}</style>
            </div>
        </MaintenanceBanner>
    )
}