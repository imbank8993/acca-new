'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';

const MonitoringLaporanView = dynamic(() => import('./view'), {
    ssr: false,
    loading: () => (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'var(--n-bg, #f8fafc)',
        }}>
            <Spinner size={36} />
            <span style={{ color: 'var(--n-muted, #64748b)', fontSize: '0.88rem', fontWeight: 600 }}>
                Memuat Portal Monitoring Laporan...
            </span>
        </div>
    ),
});

export default function MonitoringLaporanClient() {
    return <MonitoringLaporanView />;
}
