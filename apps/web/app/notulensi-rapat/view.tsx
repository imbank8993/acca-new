'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { Tab, type TabItem } from '@/components/ui/Tab';
import { PageLoader } from '@/components/ui/Spinner';
import type { User } from '@/lib/types';
import DaftarNotulensiTab from './tabs/DaftarNotulensiTab';
import PengaturanAksesTab from './tabs/PengaturanAksesTab';
import './notulensi.css';

type NotulensiTabKey = 'daftar' | 'pengaturan';

export default function NotulensiRapatView({ user }: { user?: User | null }) {
    const roles = user?.roles || [];
    const isLocalAdmin = roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase()));

    const [izin, setIzin] = useState<{ bolehKelola: boolean; isAdmin: boolean }>({
        bolehKelola: isLocalAdmin,
        isAdmin: isLocalAdmin,
    });
    const [loadingIzin, setLoadingIzin] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function fetchIzin() {
            try {
                const res = await fetch('/api/notulensi-rapat/izin-saya');
                const json = await res.json();
                if (mounted && json.success && json.data) {
                    setIzin({
                        bolehKelola: !!json.data.bolehKelola || isLocalAdmin,
                        isAdmin: !!json.data.isAdmin || isLocalAdmin,
                    });
                }
            } catch (err) {
                console.error('Error fetching izin notulensi:', err);
            } finally {
                if (mounted) setLoadingIzin(false);
            }
        }
        fetchIzin();
        return () => {
            mounted = false;
        };
    }, [isLocalAdmin]);

    const tabs: TabItem<NotulensiTabKey>[] = useMemo(() => {
        const t: TabItem<NotulensiTabKey>[] = [
            { key: 'daftar', label: 'Notulensi Rapat', icon: 'journal-text' },
        ];
        if (izin.isAdmin) {
            t.push({ key: 'pengaturan', label: 'Pengaturan Akses', icon: 'gear-fill' });
        }
        return t;
    }, [izin.isAdmin]);

    const [activeTab, setActiveTab] = useTabParam<NotulensiTabKey>('daftar', ['daftar', 'pengaturan']);

    // Jika tab aktif adalah pengaturan tetapi bukan admin, kembalikan ke daftar
    useEffect(() => {
        if (!loadingIzin && activeTab === 'pengaturan' && !izin.isAdmin) {
            setActiveTab('daftar');
        }
    }, [loadingIzin, activeTab, izin.isAdmin, setActiveTab]);

    const headerTabs = (
        <Tab
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Navigasi Notulensi Rapat"
            variant="slider"
        />
    );

    if (loadingIzin) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <PageLoader />
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            {activeTab === 'daftar' && (
                <DaftarNotulensiTab
                    bolehKelola={izin.bolehKelola}
                    headerTabs={headerTabs}
                />
            )}
            {activeTab === 'pengaturan' && izin.isAdmin && (
                <PengaturanAksesTab headerTabs={headerTabs} />
            )}
        </div>
    );
}
