'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Tab, { TabItem } from '@/components/ui/Tab';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import PersonalDocumentsPage from './tabs/PersonalDocumentsTab';
import UnggahDokumenTab from './tabs/UnggahDokumenTab';
import ManageDokumenTab from './tabs/ManageDokumenTab';
import type { User } from '@/lib/types';
import { isUserAdmin, getUserRoles, isMasterGuruUser } from '@/lib/auth-client';
import { useOptionalDashboardUser } from '@/components/UserContext';

type DokumenTabKey = 'pribadi' | 'sekolah' | 'kelola';

interface AccessConfig {
    allowedRoles: string[];
    allowedUsers: { id: string; nama: string; role?: string; nip?: string; username?: string }[];
}

function PusatDokumenContent({ user: propUser }: { user?: User }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const contextUser = useOptionalDashboardUser()?.user;
    const user = propUser || contextUser;

    const [accessConfig, setAccessConfig] = useState<AccessConfig>({
        allowedRoles: ['ADMIN', 'ADMINISTRATOR'],
        allowedUsers: []
    });

    useEffect(() => {
        let cancelled = false;
        const loadAccessConfig = async () => {
            try {
                const res = await fetch('/api/site-settings?key=dokumen_access_config');
                const json = await res.json();
                if (!cancelled && json.ok && json.data) {
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
        };
        void loadAccessConfig();
        return () => { cancelled = true; };
    }, []);

    const isAdmin = useMemo(() => {
        return isUserAdmin(user);
    }, [user]);

    const hasFullAccess = useMemo(() => {
        if (isAdmin) return true;
        if (!user) return false;

        const userRoles = getUserRoles(user);

        const effectiveRoles = accessConfig.allowedRoles.length > 0
            ? accessConfig.allowedRoles
            : ['ADMIN', 'ADMINISTRATOR', 'WALI_KELAS'];

        const roleAllowed = effectiveRoles.some(r => userRoles.includes(String(r).toUpperCase()));
        if (roleAllowed) return true;

        const userId = 'user_id' in user ? user.user_id : undefined;
        const userIdStr = String(user.id || userId || '');
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

    const isMasterGuru = useMemo(() => {
        return isMasterGuruUser(user);
    }, [user]);

    // Initial tab based on URL query param
    const initialTabFromUrl = useMemo<DokumenTabKey>(() => {
        const paramTab = searchParams.get('tab')?.toLowerCase();
        if (paramTab === 'sekolah' || paramTab === 'upload') return 'sekolah';
        if (paramTab === 'kelola' && hasFullAccess) return 'kelola';
        if (paramTab === 'pribadi' || paramTab === 'personal') return isMasterGuru ? 'pribadi' : 'sekolah';
        return isMasterGuru ? 'pribadi' : 'sekolah';
    }, [searchParams, hasFullAccess, isMasterGuru]);

    const activeTab = initialTabFromUrl;

    // Guard: jika kelola/pribadi dipilih tapi tidak punya izin, kembalikan ke sekolah
    const resolvedTab = useMemo(() => {
        if (activeTab === 'pribadi' && !isMasterGuru) return 'sekolah';
        if (activeTab === 'kelola' && !hasFullAccess) return isMasterGuru ? 'pribadi' : 'sekolah';
        return activeTab;
    }, [activeTab, hasFullAccess, isMasterGuru]);

    const handleTabChange = (key: DokumenTabKey) => {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', key);
        router.replace(`/dokumen?${newParams.toString()}`, { scroll: false });
    };

    const tabsConfig = useMemo<TabItem<DokumenTabKey>[]>(() => {
        const items: TabItem<DokumenTabKey>[] = [];
        if (isMasterGuru) {
            items.push({
                key: 'pribadi',
                label: 'Dokumen Pribadi',
                shortLabel: 'Pribadi',
                icon: 'vault'
            });
        }
        items.push({
            key: 'sekolah',
            label: 'Dokumen Sekolah',
            shortLabel: 'Sekolah',
            icon: 'file-text'
        });
        if (hasFullAccess) {
            items.push({
                key: 'kelola',
                label: 'Kelola Dokumen',
                shortLabel: 'Kelola',
                icon: 'sliders'
            });
        }
        return items;
    }, [hasFullAccess, isMasterGuru]);

    return (
        <div className="pd-center-page">
            {/* Universal Tab Component */}
            <Tab<DokumenTabKey>
                tabs={tabsConfig}
                activeTab={resolvedTab}
                onChange={handleTabChange}
                ariaLabel="Pusat Dokumen"
                variant="slider"
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
