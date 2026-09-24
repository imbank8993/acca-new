'use client';

import { useState, useEffect } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { getCurrentUser } from '@/lib/auth-client';
import GuruAsuhTabKehadiran from './tabs/GuruAsuhTabKehadiran';
import GuruAsuhTabPenilaian from './tabs/GuruAsuhTabPenilaian';
import GuruAsuhTabKlaim from './tabs/GuruAsuhTabKlaim';
import GuruAsuhTabLaporan from './tabs/GuruAsuhTabLaporan';
import GuruAsuhTabApproval from './tabs/GuruAsuhTabApproval';
import GuruAsuhTabKokurikuler from './tabs/GuruAsuhTabKokurikuler';
import GuruAsuhTabEkskul from './tabs/GuruAsuhTabEkskul';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Tab, type TabItem } from '@/components/ui/Tab';
import { useStickyState } from '@/hooks/useStickyState';
import { checkFeatureAccess, parseKonfigurasiAksesClient } from '@/lib/feature-access-client';
import './guru-asuh.css';

interface GuruAsuhPageProps { user?: any; }

type GuruAsuhTabKey = 'kehadiran' | 'penilaian' | 'laporan' | 'approval' | 'klaim' | 'kokurikuler' | 'ekskul';

export default function GuruAsuhPage({ user: propUser }: GuruAsuhPageProps) {
    const [user, setUser] = useState<any>(propUser || null);
    const [activeTab, setActiveTab] = useTabParam<GuruAsuhTabKey>('laporan', ['laporan', 'approval', 'kehadiran', 'penilaian', 'kokurikuler', 'ekskul', 'klaim']);

    useEffect(() => {
        const load = async () => {
            let u = user || propUser;
            if (!u) {
                u = await getCurrentUser();
                if (u) setUser(u);
            }
        };
        load();
    }, [propUser]);

    // Hak akses tab Approval diatur melalui "Hak Akses Fitur" (site_settings: guru_asuh_approval_access_config).
    // Admin otomatis memiliki akses; role lain (bawaan: WKM_KEASRAMAAN) atau user tertentu ditunjuk di sana.
    const [approvalConfig, setApprovalConfig] = useState<any>(null);

    useEffect(() => {
        let active = true;
        fetch('/api/site-settings?key=guru_asuh_approval_access_config')
            .then(r => r.json())
            .catch(() => null)
            .then(res => {
                if (active && res?.ok && res.data?.value) {
                    setApprovalConfig(parseKonfigurasiAksesClient(res.data.value));
                }
            });
        return () => { active = false; };
    }, []);

    const isApprover = checkFeatureAccess(user, approvalConfig, ['WKM_KEASRAMAAN']);

    const TABS: TabItem<GuruAsuhTabKey>[] = [
        { key: 'laporan', label: 'Laporan', icon: 'file-earmark-text' },
        ...(isApprover ? [{ key: 'approval', label: 'Approval', icon: 'patch-check' } as const] : []),
        { key: 'kehadiran', label: 'Kehadiran', icon: 'clipboard-data' },
        { key: 'penilaian', label: 'Penilaian', icon: 'graph-up' },
        { key: 'kokurikuler', label: 'Kokurikuler', icon: 'calendar-check' },
        { key: 'ekskul', label: 'Ekstrakurikuler', icon: 'bookmark-star' },
        { key: 'klaim', label: 'Klaim Anak', icon: 'person-plus' },
    ];

    return (
        <MaintenanceBanner pageKey="maintenance_guru_asuh">
            <div className="ga-page-wrap">
                {/* Header Banner */}
                

                {/* Tab Navigation */}
                <Tab
                    tabs={TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Tabs Guru Asuh"
                    variant="slider"
                />

                {/* Tab Content */}
                <div className="ga-page-content" role="tabpanel">
                    {activeTab === 'laporan' && <GuruAsuhTabLaporan user={user} />}
                    {activeTab === 'approval' && isApprover && <GuruAsuhTabApproval user={user} />}
                    {activeTab === 'kehadiran' && <GuruAsuhTabKehadiran user={user} />}
                    {activeTab === 'penilaian' && <GuruAsuhTabPenilaian user={user} />}
                    {activeTab === 'kokurikuler' && <GuruAsuhTabKokurikuler user={user} />}
                    {activeTab === 'ekskul' && <GuruAsuhTabEkskul user={user} />}
                    {activeTab === 'klaim' && <GuruAsuhTabKlaim user={user} />}
                </div>
            </div>
        </MaintenanceBanner>
    );
}