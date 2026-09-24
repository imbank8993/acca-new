'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';

import AgendaDisplayView from '../agenda-madrasah/components/AgendaDisplayView';

function TampilanAgendaPage() {
    return (
        <div className="p-4 md:p-6">
            <AgendaDisplayView />
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedTampilanAgendaPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_tampilan_agenda" />
            <TampilanAgendaPage {...props} />
        </>
    );
}
