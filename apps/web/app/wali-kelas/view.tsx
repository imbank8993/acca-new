'use client';
import { useTabParam } from '@/hooks/useTabParam';

import { useState, useEffect } from 'react';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Tab, type TabItem } from '@/components/ui/Tab';
import WaliKelasTabJurnal from './tabs/WaliKelasTabJurnal';
import WaliKelasTabAbsensi from './tabs/WaliKelasTabAbsensi';
import WaliKelasTabNilai from './tabs/WaliKelasTabNilai';
import WaliKelasTabMapelPilihan from './tabs/WaliKelasTabMapelPilihan';
import WaliKelasTabKokurikuler from './tabs/WaliKelasTabKokurikuler';
import WaliKelasTabEkskul from './tabs/WaliKelasTabEkskul';
import WaliKelasTabCatatan from './tabs/WaliKelasTabCatatan';

type WaliKelasTabKey = 'jurnal' | 'absensi' | 'nilai' | 'mapel-pilihan' | 'kokurikuler' | 'ekskul' | 'catatan';

export default function WaliKelasPage({ user: propUser }: { user?: any }) {
    const [user, setUser] = useState<any>(propUser || null);
    const [activeTab, setActiveTab] = useTabParam<WaliKelasTabKey>('jurnal', ['jurnal', 'absensi', 'nilai', 'mapel-pilihan', 'kokurikuler', 'ekskul', 'catatan']);

    useEffect(() => {
        if (propUser) {
            setUser(propUser);
        } else {
            const load = async () => {
                try {
                    const res = await fetch('/api/auth/me');
                    const json = await res.json();
                    if (json.ok && json.user) {
                        setUser(json.user);
                    }
                } catch (e) {
                    console.error('Error fetching user in WaliKelasPage:', e);
                }
            };
            load();
        }
    }, [propUser]);

    const TABS: TabItem<WaliKelasTabKey>[] = [
        { key: 'jurnal', label: 'Jurnal', icon: 'book' },
        { key: 'absensi', label: 'Absensi', icon: 'clipboard-check' },
        { key: 'nilai', label: 'Nilai', icon: 'bar-chart-line' },
        { key: 'mapel-pilihan', label: 'Mapel Pilihan', icon: 'journal-bookmark' },
        { key: 'kokurikuler', label: 'Kokurikuler', icon: 'calendar-check' },
        { key: 'ekskul', label: 'Ekstrakurikuler', icon: 'bookmark-star' },
        { key: 'catatan', label: 'Catatan Pembelajaran', icon: 'journal-text' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'jurnal': return <WaliKelasTabJurnal user={user} />;
            case 'absensi': return <WaliKelasTabAbsensi user={user} />;
            case 'nilai': return <WaliKelasTabNilai user={user} />;
            case 'mapel-pilihan': return <WaliKelasTabMapelPilihan user={user} />;
            case 'kokurikuler': return <WaliKelasTabKokurikuler user={user} />;
            case 'ekskul': return <WaliKelasTabEkskul user={user} />;
            case 'catatan': return <WaliKelasTabCatatan user={user} />;
            default: return <WaliKelasTabJurnal user={user} />;
        }
    };

    return (
        <MaintenanceBanner pageKey="maintenance_wali_kelas">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                

                <Tab
                    tabs={TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Navigasi Wali Kelas"
                    variant="slider"
                />

                <div className="wk-content">
                    {renderTabContent()}
                </div>

                <style jsx>{`
                    .wk-page-wrap {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        padding: 0;
                        max-width: 100%;
                        background: transparent;
                        min-height: auto;
                    }

                    /* Hero Section */
                    .wk-hero {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 16px 16px 20px;
                        background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                        border-radius: 16px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                        font-family: 'Poppins', sans-serif;
                    }
                    .wk-hero-icon {
                        width: 48px;
                        height: 48px;
                        border-radius: 14px;
                        background: rgba(255,255,255,0.2);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    .wk-hero-icon i {
                        font-size: 1.4rem;
                        color: white;
                    }
                    .wk-hero-content {
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .wk-hero-title {
                        font-size: 1.25rem;
                        font-weight: 800;
                        color: white;
                        margin: 0;
                        line-height: 1.2;
                        letter-spacing: -0.02em;
                    }
                    .wk-hero-desc {
                        font-size: 0.78rem;
                        font-weight: 500;
                        color: rgba(255, 255, 255, 0.75);
                        margin: 2px 0 0 0;
                        line-height: 1.5;
                    }

                    /* Tab Navigation - Mobile Grid (6 tab) */
                    .wk-tabs-container {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                        padding: 4px;
                    }
                    .wk-tab {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        padding: 14px 6px;
                        border-radius: 16px;
                        border: 2px solid var(--n-border);
                        background: var(--n-card);
                        cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        overflow: hidden;
                    }
                    .wk-tab:active {
                        transform: scale(0.95);
                    }
                    .wk-tab-icon {
                        width: 40px;
                        height: 40px;
                        border-radius: 12px;
                        background: var(--n-soft);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s;
                    }
                    .wk-tab-icon i {
                        font-size: 1.2rem;
                        color: var(--n-muted);
                        transition: all 0.3s;
                    }
                    .wk-tab-label {
                        font-size: 0.6rem;
                        font-weight: 800;
                        color: var(--n-muted);
                        text-align: center;
                        transition: all 0.3s;
                        line-height: 1.2;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        width: 100%;
                    }
                    .wk-tab--active {
                        /* biru disamakan dengan banner hero (--n-primary) */
                        background: var(--n-primary);
                        border-color: transparent;
                        transform: translateY(-3px);
                    }
                    .wk-tab--active .wk-tab-icon {
                        background: rgba(255,255,255,0.25);
                    }
                    .wk-tab--active .wk-tab-icon i {
                        color: white;
                    }
                    .wk-tab--active .wk-tab-label {
                        color: white;
                    }

                    /* Content */
                    .wk-content {
                        flex: 1;
                        animation: fadeIn 0.3s ease-out;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    /* Desktop Override */
                    @media (min-width: 768px) {
                        .wk-page-wrap {
                            padding: 0;
                            gap: 16px;
                        }
                        .wk-hero {
                            padding: 22px 32px;
                        }
                        .wk-tabs-container {
                            display: flex;
                            flex-wrap: nowrap;
                            gap: 6px;
                            padding: 4px;
                            background: var(--n-soft);
                            border-radius: 16px;
                            border: 1px solid var(--n-border);
                            overflow-x: auto;
                            scrollbar-width: thin;
                        }
                        .wk-tab {
                            flex: 1;
                            min-width: max-content;
                            flex-direction: row;
                            gap: 6px;
                            padding: 10px 10px;
                            border-radius: 12px;
                            border: none;
                            background: transparent;
                            aspect-ratio: auto;
                            min-height: 0;
                            justify-content: center;
                            overflow: visible;
                        }
                        .wk-tab:hover {
                            background: var(--n-card);
                        }
                        .wk-tab-icon {
                            width: auto;
                            height: auto;
                            background: transparent;
                            border-radius: 0;
                        }
                        .wk-tab-icon i {
                            font-size: 1rem;
                        }
                        .wk-tab-label {
                            font-size: 0.76rem;
                            text-align: left;
                            white-space: nowrap;
                            width: auto;
                            overflow: visible;
                            text-overflow: unset;
                        }
                        .wk-tab--active {
                            background: var(--n-primary);
                            border-color: transparent;
                            transform: none;
                        }
                        .wk-tab--active:hover {
                            transform: none;
                            background: var(--n-primary);
                        }
                        .wk-tab--active .wk-tab-icon {
                            background: transparent;
                        }
                    }

                    /* Dark Mode */
                    :global(.dark) .wk-page-wrap {
                        background: transparent;
                    }
                    :global(.dark) .wk-hero {
                        background: #000000 !important;
                        border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                        border-radius: 18px !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                    }
                    :global(.dark) .wk-hero-title {
                        background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                        -webkit-background-clip: text !important;
                        -webkit-text-fill-color: transparent !important;
                        background-clip: text !important;
                        display: inline-block !important;
                    }
                    :global(.dark) .wk-hero-desc { color: #94a3b8 !important; }

                    /* Mobile: tiap tab jadi kartu terpisah, sama seperti light mode */
                    :global(.dark) .wk-tabs-container {
                        background: transparent !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 4px !important;
                    }
                    :global(.dark) .wk-tab {
                        color: #94a3b8 !important;
                        background: #000000 !important;
                        border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                        border-radius: 16px !important;
                        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45) !important;
                    }
                    :global(.dark) .wk-tab-icon {
                        background: rgba(26, 115, 232, 0.12) !important;
                    }
                    :global(.dark) .wk-tab-icon i {
                        color: #94a3b8 !important;
                    }
                    :global(.dark) .wk-tab-label {
                        color: #94a3b8 !important;
                    }
                    :global(.dark) .wk-tab:hover {
                        color: #60a5fa !important;
                        background: rgba(96, 165, 250, 0.12) !important;
                    }
                    :global(.dark) .wk-tab:hover .wk-tab-icon i,
                    :global(.dark) .wk-tab:hover .wk-tab-label {
                        color: #60a5fa !important;
                    }
                    :global(.dark) .wk-tab--active,
                    :global(.dark) .wk-tab--active:hover {
                        background: #1d6bf3 !important;
                        border-color: transparent !important;
                        color: #ffffff !important;
                        box-shadow: 0 4px 14px rgba(29, 107, 243, 0.4) !important;
                    }
                    :global(.dark) .wk-tab--active .wk-tab-icon {
                        background: rgba(255, 255, 255, 0.25) !important;
                    }
                    :global(.dark) .wk-tab--active .wk-tab-icon i,
                    :global(.dark) .wk-tab--active .wk-tab-label {
                        color: #ffffff !important;
                    }

                    /* Desktop: kembali ke satu bar berisi tab tanpa kartu */
                    @media (min-width: 768px) {
                        :global(.dark) .wk-tabs-container {
                            background: #000000 !important;
                            border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                            border-radius: 16px !important;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                        }
                        :global(.dark) .wk-tab {
                            background: transparent !important;
                            border: none !important;
                            border-radius: 12px !important;
                            box-shadow: none !important;
                        }
                        :global(.dark) .wk-tab-icon,
                        :global(.dark) .wk-tab--active .wk-tab-icon {
                            background: transparent !important;
                        }
                        :global(.dark) .wk-tab:hover {
                            background: rgba(96, 165, 250, 0.12) !important;
                        }
                        :global(.dark) .wk-tab--active,
                        :global(.dark) .wk-tab--active:hover {
                            background: #1d6bf3 !important;
                            border-radius: 12px !important;
                        }
                    }

                    /* Filter tiap tab memakai komponen bersama: components/FilterToolbar.tsx (.ftb-*) */

                    :global(.dark) .wka-lock-btn-open,
                    :global(.dark) .wkk-item-detail-btn {
                        background: #000000 !important;
                        border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                        color: #60a5fa !important;
                        border-radius: 12px !important;
                    }

                    :global(.dark) .wka-lock-btn-open:hover,
                    :global(.dark) .wkk-item-detail-btn:hover {
                        background: rgba(26, 115, 232, 0.15) !important;
                        border-color: #60a5fa !important;
                        color: #ffffff !important;
                    }
                `}</style>
            </div>
        </MaintenanceBanner>
    );
}
