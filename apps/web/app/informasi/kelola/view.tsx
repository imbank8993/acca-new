'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTabParam } from '@/hooks/useTabParam';
import { Tab } from '@/components/ui/Tab';
import { PageLoader } from '@/components/ui/Spinner';
import KelolaInformasiTab from '../tabs/KelolaInformasiTab';
import KelolaPengumumanTab from '../tabs/KelolaPengumumanTab';
import { useIzinInformasi } from '../useIzinInformasi';
import type { User } from '@/lib/types';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import '../informasi.css';

export default function InformasiKelolaPage({ user, onBack }: { user?: User; onBack?: () => void }) {
    const router = useRouter();
    const { bolehKelola, bolehPengumuman, divisi, memuat } = useIzinInformasi();

    const allowedTabs: Array<'informasi' | 'pengumuman'> = [];
    if (bolehKelola) allowedTabs.push('informasi');
    if (bolehPengumuman) allowedTabs.push('pengumuman');

    const defaultTab = bolehKelola ? 'informasi' : (bolehPengumuman ? 'pengumuman' : 'informasi');
    const [activeTab, setActiveTab] = useTabParam<'informasi' | 'pengumuman'>(
        defaultTab,
        allowedTabs.length > 0 ? allowedTabs : ['informasi', 'pengumuman']
    );

    const handleBack = onBack || (() => router.push('/informasi'));

    // Otomatis arahkan tab aktif sesuai izin pengguna
    useEffect(() => {
        if (!memuat) {
            if (!bolehKelola && bolehPengumuman && activeTab !== 'pengumuman') {
                setActiveTab('pengumuman');
            } else if (bolehKelola && !bolehPengumuman && activeTab !== 'informasi') {
                setActiveTab('informasi');
            }
        }
    }, [memuat, bolehKelola, bolehPengumuman, activeTab, setActiveTab]);

    if (memuat) {
        return <PageLoader minHeight="300px" dotsOnly size={18} />;
    }

    if (!bolehKelola && !bolehPengumuman) {
        return (
            <div className="if-wrapper">
                <div
                    className="pm-empty"
                    style={{
                        padding: '5rem 2rem',
                        textAlign: 'center',
                        background: 'var(--n-card, #ffffff)',
                        borderRadius: '16px',
                        border: '1px solid var(--n-border, #e2e8f0)',
                        margin: '2rem auto',
                        maxWidth: '540px',
                    }}
                >
                    <i
                        className="bi bi-shield-lock"
                        style={{ fontSize: '3.5rem', color: 'var(--n-muted)', marginBottom: '1rem', display: 'inline-block' }}
                    />
                    <h3 style={{ color: 'var(--n-ink)', fontWeight: 700, marginBottom: '8px' }}>Akses Ditolak</h3>
                    <p style={{ color: 'var(--n-muted)', margin: '0 auto 20px', lineHeight: 1.5, fontSize: '0.9rem' }}>
                        Anda tidak memiliki hak akses untuk mengelola Informasi maupun Pengumuman.
                        Hubungi Administrator untuk mendapatkan akses melalui Hak Akses Fitur.
                    </p>
                    <button
                        type="button"
                        onClick={handleBack}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 20px',
                            background: 'var(--n-primary, #3b82f6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        <i className="bi bi-arrow-left" />
                        Kembali ke Informasi
                    </button>
                </div>
            </div>
        );
    }

    const tabsConfig = [];
    if (bolehKelola) {
        tabsConfig.push({ key: 'informasi' as const, label: 'Kelola Informasi', icon: 'info-circle-fill' });
    }
    if (bolehPengumuman) {
        tabsConfig.push({ key: 'pengumuman' as const, label: 'Kelola Pengumuman', icon: 'megaphone-fill' });
    }

    return (
        <div className="if-wrapper">
            {tabsConfig.length > 1 && (
                <Tab
                    tabs={tabsConfig}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Tab Kelola Informasi & Pengumuman"
                    variant="slider"
                />
            )}

            <div className="if-content">
                {activeTab === 'informasi' && bolehKelola && (
                    <KelolaInformasiTab user={user} allowedDivisions={divisi} onBack={handleBack} />
                )}
                {activeTab === 'pengumuman' && bolehPengumuman && user && (
                    <KelolaPengumumanTab user={user} canManage={bolehPengumuman} onBack={handleBack} />
                )}
            </div>

            <MaintenanceBanner pageKey="maintenance_informasi_akademik" />
        </div>
    );
}

