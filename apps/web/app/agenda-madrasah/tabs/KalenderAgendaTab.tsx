'use client';

import React from 'react';
import AgendaDisplayView from '../components/AgendaDisplayView';

export interface KalenderAgendaTabProps {
    headerTabs?: React.ReactNode;
}

export default function KalenderAgendaTab({ headerTabs }: KalenderAgendaTabProps) {
    return (
        <div className="agw-kalender">
            <AgendaDisplayView headerTabs={headerTabs} />
        </div>
    );
}
