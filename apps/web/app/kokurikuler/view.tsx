"use client"

import React, { useState, useEffect, useMemo } from 'react'
import type { User } from '@/lib/types'
import { Spinner } from '@/components/ui/Spinner'
import Tab from '@/components/ui/Tab'
import KokurikulerSiswaPage from './siswa/view'
import KokurikulerVerifikasiPage from './verifikasi/view'
import KokurikulerAdminPage from './admin/view'
import { getActiveSettings } from '@/lib/settings-client'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import { getUserRoles, isUserAdmin } from '@/lib/auth-client'

export default function KokurikulerPage(props: { user: User }) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_kokurikuler" />
            <KokurikulerPageContent {...props} />
        </>
    );
}

function KokurikulerPageContent({ user }: { user: User }) {
    const roles = getUserRoles(user)
    const isSiswa = roles.includes('SISWA') || roles.includes('ORANG_TUA') || roles.includes('ORANGTUA')
    const isGuru = roles.includes('GURU') || roles.includes('KAMAD')
    const isAdmin = isUserAdmin(user) || roles.includes('TATA_USAHA') || roles.includes('TU')
    const userNip = user?.nip || user?.username || ''

    const [loading, setLoading] = useState(isGuru && !isAdmin) // Only fetch for non-admin gurus
    const [isPembina, setIsPembina] = useState(false)
    const [isKoordinator, setIsKoordinator] = useState(false)
    const [pembinaJabatan, setPembinaJabatan] = useState('')
    const [koordinatorJabatan, setKoordinatorJabatan] = useState('')

    const tabs = useMemo<{ id: string; label: string; icon: string }[]>(() => {
        const availableTabs: { id: string; label: string; icon: string }[] = []
        if (isSiswa || (!isGuru && !isAdmin)) {
            availableTabs.push({ id: 'catatan', label: 'Catatan Harian', icon: 'bi-calendar-check-fill' })
        }
        if (isPembina || isAdmin) {
            availableTabs.push({ id: 'verifikasi', label: 'Verifikasi Kegiatan', icon: 'bi-shield-fill-check' })
        }
        if (isKoordinator || isAdmin) {
            availableTabs.push({ id: 'master', label: 'Master Kegiatan', icon: 'bi-list-check' })
            availableTabs.push({ id: 'laporan', label: 'Laporan & Tren', icon: 'bi-pie-chart' })
        }
        return availableTabs
    }, [isSiswa, isGuru, isAdmin, isPembina, isKoordinator])

    const [activeTab, setActiveTab] = useState<string>(() => {
        if (isSiswa || (!isGuru && !isAdmin)) return 'catatan'
        if (isAdmin) return 'verifikasi'
        return 'catatan'
    })

    useEffect(() => {
        if (tabs.length > 0 && !tabs.some((t: { id: string }) => t.id === activeTab)) {
            setActiveTab(tabs[0].id)
        }
    }, [tabs, activeTab])

    useEffect(() => {
        let mounted = true
        
        async function fetchTugasTambahan() {
            if (!isGuru || isAdmin) {
                setLoading(false)
                return
            }

            try {
                const settings = await getActiveSettings()
                const ta = settings?.tahun_ajaran || ''
                const res = await fetch(`/api/tugas-tambahan?nip=${encodeURIComponent(userNip)}&tahun_ajaran=${encodeURIComponent(ta)}`)
                const json = await res.json()
                
                if (json.ok && mounted) {
                    const data = json.data || []
                    const pembinaTugas = data.find((t: any) => t.jabatan?.toLowerCase().includes('pembina asrama'))
                    const koordinatorTugas = data.find((t: any) => t.jabatan?.toLowerCase().includes('koordinator kokurikuler'))

                    setIsPembina(!!pembinaTugas)
                    setIsKoordinator(!!koordinatorTugas)
                    setPembinaJabatan(pembinaTugas?.jabatan || '')
                    setKoordinatorJabatan(koordinatorTugas?.jabatan || '')
                }
            } catch (err) {
                console.error("Gagal memuat tugas tambahan", err)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchTugasTambahan()
        return () => { mounted = false }
    }, [isGuru, isAdmin, userNip])

    if (loading) {
        return (
            <div className="db">
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                    <Spinner size={32} />
                </div>
            </div>
        )
    }

    if (tabs.length === 0) {
        return (
            <div className="db">
                
                <div className="db__denied">
                    <div className="db__deniedIcon"><i className="bi bi-shield-lock"></i></div>
                    <h3 className="db__deniedTitle">Akses Dibatasi</h3>
                    <p className="db__deniedText">Anda belum ditugaskan sebagai Pembina Asrama atau Koordinator Kokurikuler pada periode ini.</p>
                </div>
                <style jsx>{`
                    .db { display: flex; flex-direction: column; gap: 16px; animation: dbFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
                    @keyframes dbFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    .db__denied {
                        display: flex; flex-direction: column; align-items: center; text-align: center;
                        padding: 56px 24px; background: var(--n-card); border: 1px solid var(--n-border);
                        border-radius: 16px; box-shadow: var(--n-shadow-soft);
                    }
                    .db__deniedIcon {
                        width: 84px; height: 84px; border-radius: 24px; display: flex; align-items: center;
                        justify-content: center; font-size: 2.4rem; margin-bottom: 20px;
                        background: linear-gradient(135deg, rgba(0,56,168,0.12), rgba(194,24,91,0.12));
                        color: var(--n-primary);
                    }
                    .db__deniedTitle { margin: 0 0 8px; color: var(--n-ink); font-weight: 800; font-size: 1.25rem; }
                    .db__deniedText { margin: 0; color: var(--n-muted); max-width: 460px; line-height: 1.6; font-size: 0.95rem; }
                    :global(.dark) .db__deniedIcon { background: rgba(59,130,246,0.12); color: #60a5fa; }
                    :global(.dark) .db__deniedTitle { color: #e8edf5; }
                `}</style>
            </div>
        )
    }

    return (
        <div className="db">
            

            <Tab
                variant="slider"
                activeTab={activeTab}
                onChange={setActiveTab}
                tabs={tabs.map((t: { id: string; label: string; icon: string }) => ({ key: t.id, label: t.label, icon: t.icon }))}
            />

            <div className="db__content">
                {activeTab === 'catatan' && <KokurikulerSiswaPage user={user} />}
                {activeTab === 'verifikasi' && <KokurikulerVerifikasiPage user={user} isAdmin={!!isAdmin} pembinaJabatan={pembinaJabatan} />}
                {activeTab === 'master' && <KokurikulerAdminPage user={user} isAdmin={!!isAdmin} koordinatorJabatan={koordinatorJabatan} initialTab="master" />}
                {activeTab === 'laporan' && <KokurikulerAdminPage user={user} isAdmin={!!isAdmin} koordinatorJabatan={koordinatorJabatan} initialTab="laporan" />}
            </div>

            <style jsx>{`
                .db { display: flex; flex-direction: column; gap: 16px; animation: dbFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
                .db__content { display: flex; flex-direction: column; }
                @keyframes dbFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    )
}
