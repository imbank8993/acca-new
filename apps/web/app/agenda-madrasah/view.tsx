'use client';

import React, { useMemo, useEffect } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { Tab } from '@/components/ui/Tab';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { PageLoader } from '@/components/ui/Spinner';
import type { User } from '@/lib/types';
import { hasPermission } from '@/lib/permissions-client';
import { useIzinAgenda } from './useIzinAgenda';
import KalenderAgendaTab from './tabs/KalenderAgendaTab';
import KelolaAgendaTab from './tabs/KelolaAgendaTab';
import LiburAgendaTab from './tabs/LiburAgendaTab';
import './agenda.css';

type AgendaTabKey = 'kelola' | 'kalender' | 'libur';

export default function AgendaAkademikPage({ user }: { user?: User | null }) {
    const roles = user?.roles || [];
    const isAdmin = roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase()));
    const isOPJurnal = roles.some(r => r.toUpperCase() === 'OP_JURNAL');
    const permissions = (user as any)?.permissions || [];

    const { canManageAgenda: serverCanManageAgenda, canManageLibur: serverCanManageLibur, memuat } = useIzinAgenda();

    const canManageAgenda = serverCanManageAgenda || isAdmin;
    const canManageLibur = serverCanManageLibur || isAdmin || isOPJurnal
        || hasPermission(permissions, 'pengaturan_data:libur', 'manage', isAdmin, roles)
        || hasPermission(permissions, 'pengaturan_data.libur', 'manage', isAdmin, roles);

    const tabs = useMemo(() => {
        const t: { key: AgendaTabKey; label: string; icon: string }[] = [
            { key: 'kalender', label: 'Agenda', icon: 'calendar3' },
        ];
        if (canManageAgenda) t.push({ key: 'kelola', label: 'Kelola Agenda', icon: 'calendar-check-fill' });
        if (canManageLibur) t.push({ key: 'libur', label: 'Data Libur', icon: 'calendar-event-fill' });
        return t;
    }, [canManageAgenda, canManageLibur]);

    const [activeTab, setActiveTab] = useTabParam<AgendaTabKey>('kalender', ['kelola', 'kalender', 'libur']);

    useEffect(() => {
        if (!memuat && activeTab === 'kelola' && !canManageAgenda) {
            setActiveTab('kalender');
        }
        if (!memuat && activeTab === 'libur' && !canManageLibur) {
            setActiveTab('kalender');
        }
    }, [memuat, activeTab, canManageAgenda, canManageLibur, setActiveTab]);

    const headerTabs = (
        <Tab
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Navigasi Agenda"
            variant="slider"
        />
    );

    if (memuat) {
        return (
            <div className="agw-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <PageLoader />
            </div>
        );
    }

    return (
        <MaintenanceBanner pageKey="maintenance_agenda_akademik" isAdmin={isAdmin}>
            <div className="agw-root">
                <div className="agw-content" role="tabpanel">
                    {activeTab === 'kelola' && canManageAgenda && (
                        <KelolaAgendaTab user={user} headerTabs={headerTabs} canManage={canManageAgenda} />
                    )}
                    {activeTab === 'kalender' && (
                        <KalenderAgendaTab headerTabs={headerTabs} />
                    )}
                    {activeTab === 'libur' && canManageLibur && (
                        <LiburAgendaTab user={user} headerTabs={headerTabs} canManage={canManageLibur} />
                    )}
                </div>
            </div>
        </MaintenanceBanner>
    );
}
