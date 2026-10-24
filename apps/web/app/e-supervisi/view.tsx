'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import { useStickyState } from '@/hooks/useStickyState';
import { useTabParam } from '@/hooks/useTabParam';
import { hasPermission } from '@/lib/permissions-client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import dynamic from 'next/dynamic';
import type { User } from '@/lib/types';
import Tab, { Tabs, type TabItem } from '@/components/ui/Tab';
import FilterToolbar, { FilterSelect } from '@/components/ui/FilterToolbar';

// Dynamic imports for heavy tab components
const DokumenSettings = dynamic(() => import('./tabs/TabPengaturan').then(mod => mod.DokumenSettings), { ssr: false, loading: () => <div className="sv-container" style={{padding: '40px', textAlign: 'center'}}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat Pengaturan Dokumen...</div> });
const PenugasanSettings = dynamic(() => import('./tabs/TabPengaturan').then(mod => mod.PenugasanSettings), { ssr: false, loading: () => <div className="sv-container" style={{padding: '40px', textAlign: 'center'}}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat Pengaturan Supervisor...</div> });
const TabUnggahDokumen = dynamic(() => import('./tabs/TabUnggahDokumen'), { ssr: false, loading: () => <div className="sv-container" style={{padding: '40px', textAlign: 'center'}}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat Modul Unggah...</div> });
const TabSupervisi = dynamic(() => import('./tabs/TabSupervisi'), { ssr: false, loading: () => <div className="sv-container" style={{padding: '40px', textAlign: 'center'}}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat Modul Penilaian...</div> });
const TabHasil = dynamic(() => import('./tabs/TabHasil'), { ssr: false, loading: () => <div className="sv-container" style={{padding: '40px', textAlign: 'center'}}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat Hasil...</div> });

type MainTab = 'dokumen' | 'supervisor' | 'unggah' | 'supervisi' | 'hasil';

interface MainTabConfig {
    key: MainTab;
    label: string;
    shortLabel: string;
    icon: string;
    req: string;
    action: string;
}

const MAIN_TABS: MainTabConfig[] = [
    { key: 'dokumen', label: 'Dokumen dan Indikator', shortLabel: 'Indikator', icon: 'file-text', req: 'e-supervisi:pengaturan', action: 'manage' },
    { key: 'supervisor', label: 'Supervisor', shortLabel: 'Supervisor', icon: 'users', req: 'e-supervisi:pengaturan', action: 'manage' },
    { key: 'unggah', label: 'Unggah Dokumen', shortLabel: 'Dokumen', icon: 'cloud-arrow-up', req: 'e-supervisi:unggah', action: 'edit' },
    { key: 'supervisi', label: 'Penilaian', shortLabel: 'Penilaian', icon: 'clipboard-check', req: 'e-supervisi:supervisi', action: 'edit' },
    { key: 'hasil', label: 'Hasil', shortLabel: 'Hasil', icon: 'bar-chart-fill', req: 'e-supervisi:hasil', action: 'view' },
];

export default function ESupervisiPage({ user }: { user?: User }) {
    const [activeTab, setActiveTab] = useTabParam<MainTab>('hasil', ['dokumen', 'supervisor', 'unggah', 'supervisi', 'hasil']);
    const [tahunAjaranId, setTahunAjaranId] = useStickyState<number | null>(null, 'esv_tahunAjaranId');
    const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
    const [allTahunAjaran, setAllTahunAjaran] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Hak akses yang diputuskan SERVER (Hak Akses Fitur + penugasan supervisor).
    const [akses, setAkses] = useState<{ kelola: boolean; pantau: boolean; admin: boolean; supervisor: boolean }>({
        kelola: false, pantau: false, admin: false, supervisor: false,
    });

    useEffect(() => {
        fetchTahunAjaran();
    }, []);

    const fetchTahunAjaran = async () => {
        try {
            const res = await fetch('/api/e-supervisi/tahun-ajaran', { cache: 'no-store' });
            const json = await res.json();
            const { docs, assignments } = json.data || {};
            if (json.data?.akses) setAkses(json.data.akses);
            // ID tahun ajaran (BigInt) dikirim server sebagai STRING. Disamakan
            // ke number supaya pembandingan dengan nilai filter tidak meleset
            // (dulu pilihan tahun ajaran selalu kembali ke yang pertama).
            const allTa = (json.data?.allTa || []).map((ta: any) => ({ ...ta, id: Number(ta.id) }));

            const usedIds = new Set<number>();
            docs?.forEach((d: any) => { if (d.tahun_ajaran_id) usedIds.add(Number(d.tahun_ajaran_id)); });
            assignments?.forEach((a: any) => { if (a.tahun_ajaran_id) usedIds.add(Number(a.tahun_ajaran_id)); });

            if (allTa.length > 0) {
                setAllTahunAjaran(allTa);
                // Filter: ONLY keep years that have supervisi data
                const filteredTa = allTa.filter((ta: any) => usedIds.has(ta.id));
                setTahunAjaranList(filteredTa);
                
                if (filteredTa.length > 0) {
                    // Try to keep current selection if valid, else fallback to first available
                    setTahunAjaranId(prevId => {
                        if (prevId && filteredTa.find((t: any) => t.id === Number(prevId))) return Number(prevId);
                        return filteredTa[0].id;
                    });
                } else {
                    setTahunAjaranId(null);
                }
            }
        } catch (e) {
            console.error('Error fetching tahun ajaran', e);
        } finally {
            setLoading(false);
        }
    };

    const allowedTabs = useMemo<TabItem<MainTab>[]>(() => {
        if (!user) return [];
        const roles = (user.role || '').split(',').map(r => r.trim());
        // Gabungan izin halaman (peran) dan hak yang diputuskan server: pengelola
        // (WKM Akademik / Hak Akses Fitur) melihat tab pengaturan, dan guru yang
        // DITUNJUK sebagai supervisor melihat tab Penilaian meski perannya GURU.
        const dariServer = (key: MainTab) =>
            key === 'dokumen' || key === 'supervisor' ? akses.kelola
                : key === 'supervisi' ? akses.supervisor || akses.admin
                    : key === 'hasil' ? akses.pantau
                        : false;
        return MAIN_TABS
            .filter(tab => dariServer(tab.key) || hasPermission(user.permissions || [], tab.req, tab.action as any, false, roles))
            .map(tab => ({
                key: tab.key,
                label: tab.label,
                shortLabel: tab.shortLabel,
                icon: tab.icon,
            }));
    }, [user, akses]);

    useEffect(() => {
        // Tunggu hak akses dari server, kalau tidak tab dari URL (mis. Indikator
        // untuk WKM) langsung tergeser sebelum aksesnya diketahui.
        if (loading) return;
        if (allowedTabs.length > 0 && !allowedTabs.find(t => t.key === activeTab)) {
            // Only set if we don't have a valid active tab
            setActiveTab(allowedTabs[0].key);
        }
    }, [allowedTabs, activeTab, setActiveTab, loading]);

    if (!user) return <div className="sv-container">Anda harus login untuk mengakses halaman ini.</div>;
    if (loading) return <PageLoader label="Memuat…" />;
    if (allowedTabs.length === 0) return <div className="sv-container">Anda tidak memiliki akses ke modul E-Supervisi. Pastikan Anda memiliki role yang sesuai.</div>;

    // Jangan pernah merender tab yang tidak diizinkan, walau URL memintanya.
    const tabAktif: MainTab = allowedTabs.find(t => t.key === activeTab) ? activeTab : allowedTabs[0].key;

    return (
        <MaintenanceBanner pageKey="maintenance_e_supervisi">
            <div className="sv-container">
                <Tabs<MainTab>
                    tabs={allowedTabs}
                    activeTab={tabAktif}
                    onChange={(key) => setActiveTab(key)}
                    ariaLabel="Navigasi E-Supervisi"
                    variant="slider"
                />

                {tabAktif !== 'dokumen' && tabAktif !== 'supervisor' && (
                    <FilterToolbar alwaysExpanded>
                        <FilterSelect
                            label="Tahun Ajaran"
                            icon="calendar-event"
                            value={tahunAjaranId ? String(tahunAjaranId) : ''}
                            onChange={(val) => setTahunAjaranId(val ? Number(val) : null)}
                            width={280}
                            options={
                                tahunAjaranList.length > 0
                                    ? tahunAjaranList.map(ta => ({
                                          value: String(ta.id),
                                          label: `${ta.tahun_ajaran} - Semester ${ta.semester}`,
                                      }))
                                    : [{ value: '', label: 'Belum ada data supervisi' }]
                            }
                        />
                    </FilterToolbar>
                )}

                {tabAktif === 'dokumen' && (
                    <DokumenSettings 
                        tahunAjaranId={tahunAjaranId} 
                        setTahunAjaranId={setTahunAjaranId}
                        tahunAjaranList={tahunAjaranList}
                        allTahunAjaran={allTahunAjaran} 
                        onDataAdded={(id: number) => { setTahunAjaranId(id); fetchTahunAjaran(); }} 
                    />
                )}
                {tabAktif === 'supervisor' && (
                    <PenugasanSettings 
                        tahunAjaranId={tahunAjaranId} 
                        setTahunAjaranId={setTahunAjaranId}
                        tahunAjaranList={tahunAjaranList}
                        allTahunAjaran={allTahunAjaran} 
                        onDataAdded={(id: number) => { setTahunAjaranId(id); fetchTahunAjaran(); }} 
                    />
                )}
                {tabAktif === 'unggah' && <TabUnggahDokumen user={user} tahunAjaranId={tahunAjaranId} />}
                {tabAktif === 'supervisi' && <TabSupervisi user={user} tahunAjaranId={tahunAjaranId} isAdmin={akses.admin} />}
                {tabAktif === 'hasil' && <TabHasil user={user} tahunAjaranId={tahunAjaranId} />}
            </div>
        </MaintenanceBanner>
    );
}
