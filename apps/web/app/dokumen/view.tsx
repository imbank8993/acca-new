'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Tab, { TabItem } from '@/components/ui/Tab';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import PersonalDocumentsPage from './tabs/PersonalDocumentsTab';
import UnggahDokumenTab from './tabs/UnggahDokumenTab';
import ManageDokumenTab from './tabs/ManageDokumenTab';
import type { User } from '@/lib/types';

type DokumenTabKey = 'pribadi' | 'sekolah' | 'kelola';

interface AccessConfig {
    allowedRoles: string[];
    allowedUsers: { id: string; nama: string; role?: string; nip?: string; username?: string }[];
}

function PusatDokumenContent({ user }: { user?: User }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [accessConfig, setAccessConfig] = useState<AccessConfig>({
        allowedRoles: ['ADMIN', 'ADMINISTRATOR'],
        allowedUsers: []
    });

    const fetchAccessConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/site-settings?key=dokumen_access_config');
            const json = await res.json();
            if (json.ok && json.data) {
                const raw = typeof json.data.value === 'string' ? JSON.parse(json.data.value) : json.data.value;
                if (raw && typeof raw === 'object') {
                    setAccessConfig({
                        allowedRoles: Array.isArray(raw.allowedRoles) ? raw.allowedRoles : ['ADMIN', 'ADMINISTRATOR'],
                        allowedUsers: Array.isArray(raw.allowedUsers) ? raw.allowedUsers : []
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching dokumen_access_config:', err);
        }
    }, []);

    useEffect(() => {
        fetchAccessConfig();
    }, [fetchAccessConfig]);

    const isAdmin = useMemo(() => {
        if (!user) return false;
        const userRoles = (user.roles || [user.role]).filter(Boolean).map(r => String(r).toUpperCase());
        return userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR');
    }, [user]);

    const hasFullAccess = useMemo(() => {
        if (isAdmin) return true;
        if (!user) return false;

        const userRoles = (user.roles || [user.role]).filter(Boolean).map(r => String(r).toUpperCase());
        
        const effectiveRoles = accessConfig.allowedRoles.length > 0 
            ? accessConfig.allowedRoles 
            : ['ADMIN', 'ADMINISTRATOR', 'WALI_KELAS'];

        const roleAllowed = effectiveRoles.some(r => userRoles.includes(String(r).toUpperCase()));
        if (roleAllowed) return true;

        const userIdStr = String(user.id || (user as any).user_id || '');
        const userNipStr = String(user.nip || '');
        const userNisnStr = String(user.nisn || '');

        const userAllowed = accessConfig.allowedUsers.some(u => {
            const uId = String(u.id || '');
            const uNip = String(u.nip || '');
            return (userIdStr && uId === userIdStr) || 
                   (userNipStr && uNip === userNipStr) || 
                   (userNisnStr && uId === userNisnStr);
        });

        return userAllowed;
    }, [isAdmin, user, accessConfig]);

    const isMasterGuruUser = useMemo(() => {
        if (!user) return false;
        const userRoles = (user.roles || [user.role]).filter(Boolean).map(r => String(r).toUpperCase());
        const hasGuruOrStaffRole = userRoles.some(r => [
            'GURU', 'STAF', 'TU', 'TATA_USAHA', 'BENDAHARA', 
            'KAMAD', 'KEPALA_SEKOLAH', 'WAKAMAD', 'WALI_KELAS', 
            'ADMIN', 'ADMINISTRATOR'
        ].includes(r));
        const hasNip = Boolean(user.nip && String(user.nip).trim() !== '' && !user.nisn);
        return hasNip || hasGuruOrStaffRole;
    }, [user]);

    // Initial tab based on URL query param
    const initialTabFromUrl = useMemo<DokumenTabKey>(() => {
        const paramTab = searchParams.get('tab')?.toLowerCase();
        if (paramTab === 'sekolah' || paramTab === 'upload') return 'sekolah';
        if (paramTab === 'kelola' && hasFullAccess) return 'kelola';
        if (paramTab === 'pribadi' || paramTab === 'personal') return isMasterGuruUser ? 'pribadi' : 'sekolah';
        return isMasterGuruUser ? 'pribadi' : 'sekolah';
    }, [searchParams, hasFullAccess, isMasterGuruUser]);

    const [activeTab, setActiveTab] = useState<DokumenTabKey>(initialTabFromUrl);

    // Sync activeTab when query param changes
    useEffect(() => {
        const paramTab = searchParams.get('tab')?.toLowerCase();
        if (paramTab === 'sekolah' || paramTab === 'upload') {
            setActiveTab('sekolah');
        } else if (paramTab === 'kelola' && hasFullAccess) {
            setActiveTab('kelola');
        } else if ((paramTab === 'pribadi' || paramTab === 'personal') && isMasterGuruUser) {
            setActiveTab('pribadi');
        }
    }, [searchParams, hasFullAccess, isMasterGuruUser]);

    // Guard: jika kelola/pribadi dipilih tapi tidak punya izin, kembalikan ke sekolah
    const resolvedTab = useMemo(() => {
        if (activeTab === 'pribadi' && !isMasterGuruUser) return 'sekolah';
        if (activeTab === 'kelola' && !hasFullAccess) return isMasterGuruUser ? 'pribadi' : 'sekolah';
        return activeTab;
    }, [activeTab, hasFullAccess, isMasterGuruUser]);

    const handleTabChange = (key: DokumenTabKey) => {
        setActiveTab(key);
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', key);
        router.replace(`/dokumen?${newParams.toString()}`, { scroll: false });
    };

    const tabsConfig = useMemo<TabItem<DokumenTabKey>[]>(() => {
        const items: TabItem<DokumenTabKey>[] = [];
        if (isMasterGuruUser) {
            items.push({ key: 'pribadi', label: 'Dokumen Pribadi', icon: 'bi-vault' });
        }
        items.push({ key: 'sekolah', label: 'Dokumen Sekolah', icon: 'bi-file-earmark-arrow-up-fill' });
        if (hasFullAccess) {
            items.push({ key: 'kelola', label: 'Kelola Dokumen', icon: 'bi-sliders' });
        }
        return items;
    }, [hasFullAccess, isMasterGuruUser]);

    return (
        <div className="pd-center-page">
            {/* Universal Tab Component */}
            <Tab<DokumenTabKey>
                tabs={tabsConfig}
                activeTab={resolvedTab}
                onChange={handleTabChange}
                ariaLabel="Pusat Dokumen"
            />

            {/* Tab Contents */}
            <div className="pd-center-content">
                {resolvedTab === 'pribadi' && (
                    <PersonalDocumentsPage user={user} />
                )}

                {resolvedTab === 'sekolah' && (
                    <UnggahDokumenTab user={user} />
                )}

                {resolvedTab === 'kelola' && hasFullAccess && (
                    <ManageDokumenTab user={user} canManageOverride={hasFullAccess} />
                )}
            </div>

            <style jsx>{`
                .pd-center-page {
                    display: flex;
                    flex-direction: column;
                    gap: var(--page-gap, 20px);
                    padding-bottom: 80px;
                }
                .pd-center-content {
                    width: 100%;
                }
            `}</style>
        </div>
    );
}

export default function PusatDokumenPage({ user }: { user?: User }) {
    return (
        <>
            <Suspense fallback={<div className="p-4 text-center">Memuat Pusat Dokumen...</div>}>
                <PusatDokumenContent user={user} />
            </Suspense>
            <MaintenanceBanner pageKey="maintenance_dokumen" />
        </>
    );
}
