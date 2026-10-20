'use client';

import React, { useState, useEffect, useContext, useMemo } from 'react';
import './ketidakhadiran.css';
import Tab, { TabItem } from '@/components/ui/Tab';
import { useTabParam } from '@/hooks/useTabParam';
import { DashboardUserContext } from '@/components/UserContext';
import { getCurrentUser } from '@/lib/auth-client';
import { InputDataTab } from './tabs/InputDataTab';
import { DaftarSuratTab } from './tabs/DaftarSuratTab';
import { KehadiranSiswaTab } from './tabs/KehadiranSiswaTab';
import { KetidakhadiranLogTab } from './tabs/KetidakhadiranLogTab';

type TabKey = 'ketidakhadiran' | 'daftar' | 'presensi' | 'log';

export default function KetidakhadiranPage(props: { user?: any }) {
    const dashboardCtx = useContext(DashboardUserContext);
    const [user, setUser] = useState<any>(props.user || dashboardCtx?.user || null);

    useEffect(() => {
        if (props.user) {
            setUser(props.user);
        } else if (dashboardCtx?.user) {
            setUser(dashboardCtx.user);
        } else {
            getCurrentUser().then(u => {
                if (u) setUser(u);
            });
        }
    }, [props.user, dashboardCtx?.user]);

    const userRoles: string[] = useMemo(() => {
        if (!user) return [];
        if (Array.isArray(user.roles) && user.roles.length > 0) {
            return user.roles.map((r: string) => String(r).trim().toUpperCase().replace(/\s+/g, '_'));
        }
        return (user.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase().replace(/\s+/g, '_')).filter(Boolean);
    }, [user]);

    const isAdmin = useMemo(() => {
        return userRoles.some(r => r === 'ADMIN' || r === 'ADMINISTRATOR') || !!user?.isAdmin;
    }, [userRoles, user?.isAdmin]);

    // HANYA Admin, OP_UKS, dan OP_IZIN yang berhak melihat tab 'Input Data' dan 'Daftar Surat'
    const canManageData = useMemo(() => {
        return isAdmin || userRoles.includes('OP_UKS') || userRoles.includes('OP_IZIN');
    }, [isAdmin, userRoles]);

    const availableTabs: TabItem[] = useMemo(() => {
        const tabs: TabItem[] = [];
        if (canManageData) {
            tabs.push(
                { key: 'ketidakhadiran', label: 'Input Data', icon: 'bi-clipboard-check' },
                { key: 'daftar', label: 'Daftar Surat', icon: 'bi-envelope-paper' }
            );
        }
        tabs.push(
            { key: 'presensi', label: 'Kehadiran Siswa', icon: 'bi-person-check' },
            { key: 'log', label: 'Log Ketidakhadiran', icon: 'bi-clock-history' }
        );
        return tabs;
    }, [canManageData]);

    const allowedKeys = useMemo(() => availableTabs.map(t => t.key as TabKey), [availableTabs]);
    const defaultTab: TabKey = canManageData ? 'ketidakhadiran' : 'presensi';

    const [mainTab, setMainTab] = useTabParam<TabKey>(
        defaultTab,
        allowedKeys
    );

    // Jika tab saat ini tidak ada dalam daftar yang diizinkan (misal user bukan staff tapi URL memiliki ?tab=ketidakhadiran),
    // alihkan otomatis ke defaultTab yang diizinkan
    useEffect(() => {
        if (!allowedKeys.includes(mainTab)) {
            setMainTab(defaultTab);
        }
    }, [allowedKeys, mainTab, setMainTab, defaultTab]);

    return (
        <div className="kh-page-wrap">
            <Tab
                tabs={availableTabs}
                activeTab={allowedKeys.includes(mainTab) ? mainTab : defaultTab}
                onChange={(k) => setMainTab(k as TabKey)}
                ariaLabel="Navigasi Halaman Ketidakhadiran"
                variant="slider"
            />

            {/* Proteksi Konten: Hanya render tab yang memang diizinkan */}
            {mainTab === 'daftar' && canManageData ? (
                <DaftarSuratTab />
            ) : mainTab === 'presensi' ? (
                <KehadiranSiswaTab pageAccess />
            ) : mainTab === 'log' ? (
                <KetidakhadiranLogTab user={user} />
            ) : canManageData ? (
                <InputDataTab />
            ) : (
                <KehadiranSiswaTab pageAccess />
            )}
        </div>
    );
}
