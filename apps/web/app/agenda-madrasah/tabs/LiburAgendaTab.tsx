'use client';

import React from 'react';
import LiburTab from './LiburTab';
import type { User } from '@/lib/types';

export interface LiburAgendaTabProps {
    user?: User | null;
    headerTabs?: React.ReactNode;
    canManage?: boolean;
}

export default function LiburAgendaTab({ user, headerTabs, canManage }: LiburAgendaTabProps) {
    return (
        <div className="agw-view-with-back" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {headerTabs}
            <LiburTab user={user} primaryActionAsFab canManageOverride={canManage} />
        </div>
    );
}
