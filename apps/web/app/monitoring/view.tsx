'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { Spinner } from '@/components/ui/Spinner';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { getProxiedImageUrl } from '@/lib/image-utils';
import { Tab, type TabItem } from '@/components/ui/Tab';
import FilterToolbar, { FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import './monitoring.css';

type TabType = 'semua' | 'guru' | 'siswa' | 'orang_tua' | 'lainnya';

const MONITORING_TABS: TabItem<TabType>[] = [
    { key: 'semua', label: 'Semua Pengguna', icon: 'people-fill' },
    { key: 'guru', label: 'Guru', icon: 'person-badge-fill' },
    { key: 'siswa', label: 'Siswa', icon: 'mortarboard-fill' },
    { key: 'orang_tua', label: 'Orang Tua', icon: 'person-heart' },
    { key: 'lainnya', label: 'Lainnya', icon: 'shield-lock-fill' },
];

// Helper to extract tab name from URL
function getTabLabel(location: string): string {
    if (!location || typeof location !== 'string') return '';
    const cleanLocation = location.split('#')[0];
    try {
        const url = new URL(cleanLocation, 'http://localhost');
        const tab = url.searchParams.get('tab') || url.searchParams.get('activeTab');
        if (tab) {
            return formatPageName(tab);
        }
    } catch (e) {
        // Fallback for invalid URLs
        const tabMatch = cleanLocation.match(/[?&](?:tab|activeTab)=([^&]+)/);
        if (tabMatch) {
            return formatPageName(decodeURIComponent(tabMatch[1]));
        }
    }
    return '';
}

// Helper to convert last_location URL to friendly page name
function getPageLabel(location: string): string {
    if (!location || typeof location !== 'string') return '—';
    const cleanLocation = location.split('#')[0];
    let pathname = cleanLocation;
    let pageParam: string | null = null;
    try {
        const url = new URL(cleanLocation, 'http://localhost');
        pathname = url.pathname;
        pageParam = url.searchParams.get('page');
    } catch (e) {
        pathname = cleanLocation.split('?')[0];
    }
    
    // Normalize path to fix double slashes (e.g. from buggy heartbeat logic)
    pathname = pathname.replace(/\/{2,}/g, '/');
    
    const pathMap: Record<string, string> = {
        '/': 'Beranda',
        '/dashboard': 'Dashboard',
        '/monitoring': 'Pusat Kontrol',
        '/absensi': 'Absensi',
        '/jurnal': 'Jurnal',
        '/piket': 'Piket',
        '/master': 'Master Data',
        '/pengaturan-data': 'Pengaturan Data',
        '/pengaturan-tugas': 'Pengaturan Tugas',
        '/pengaturan-users': 'Pengaturan Users',
        '/nilai': 'Nilai',
        '/lckh': 'LCKH',
        '/lckh-approval': 'LCKH Approval',
        '/catatan-keuangan': 'Catatan Keuangan',
        '/agenda-madrasah': 'Agenda Madrasah',
        '/agenda-akademik': 'Agenda Madrasah',
        '/tampilan-agenda': 'Agenda Madrasah',
        '/notulensi-rapat': 'Notulensi Rapat',
        '/kinerja-guru': 'Kinerja Guru',
        '/e-supervisi': 'E-Supervisi',
        '/informasi': 'Informasi',
        '/ujian-madrasah': 'Ujian Madrasah',
        '/profile': 'Profil Saya',
        '/dokumen': 'Pusat Dokumen',
        '/ketidakhadiran': 'Ketidakhadiran',
        '/tugas-tambahan': 'Tugas Tambahan',
        '/laporan/jurnal': 'Laporan Jurnal',
        '/laporan/absensi': 'Laporan Absensi',
        '/laporan/nilai': 'Laporan Nilai',
    };
    
    // If it's a legacy URL structure (e.g., /?page=Jurnal or /dashboard?page=Jurnal)
    if ((pathname === '/' || pathname === '/dashboard') && pageParam && pageParam !== 'Dashboard') {
        const legacyPath = `/${pageParam.toLowerCase()}`;
        if (pathMap[legacyPath]) return pathMap[legacyPath];
        return formatPageName(pageParam);
    }
    
    if (pathMap[pathname]) return pathMap[pathname];
    if (pathname.startsWith('/api')) return 'System API';
    return formatPageName(pathname.split('/')[1] || 'Dashboard');
}

function formatPageName(page: string): string {
    return page
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

const ROLE_COLORS: Record<string, string> = {
    'ADMIN': '#c2185b',
    'KEPSEK': '#3083FF',
    'KAMAD': '#3083FF',
    'SUPERVISOR': '#059669',
    'GURU': '#0369a1',
    'WALI KELAS': '#0f766e',
    'DEFAULT': '#3083FF',
};

// Lighter variants for dark mode visibility
const ROLE_COLORS_DARK: Record<string, string> = {
    'ADMIN': '#f472b6',
    'KEPSEK': '#60a5fa',
    'GURU': '#38bdf8',
    'WALI KELAS': '#2dd4bf',
    'DEFAULT': '#60a5fa',
};

function getRoleColor(role: string, darkMode = false): string {
    const palette = darkMode ? ROLE_COLORS_DARK : ROLE_COLORS;
    return palette[role?.toUpperCase()] || (darkMode ? ROLE_COLORS_DARK['DEFAULT'] : ROLE_COLORS['DEFAULT']);
}

export default function MonitoringPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [activeTab, setActiveTab] = useTabParam<TabType>('semua', ['semua', 'guru', 'siswa', 'orang_tua', 'lainnya']);
    const [searchQuery, setSearchQuery] = useState('');
    const [onlyOnline, setOnlyOnline] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDarkMode(document.documentElement.classList.contains('dark'));
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            // Online-only toggle filter
            if (onlyOnline && !u.is_online) return false;

            const roles: string[] = u.roles || (u.role ? u.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean) : []);
            const isGuru = roles.some((r) => r === 'GURU');
            const isSiswa = roles.some((r) => r === 'SISWA');
            const isOrangTua = roles.some((r) => r === 'ORANG_TUA' || r === 'ORANGTUA');

            let roleMatch = true;
            if (activeTab === 'guru') roleMatch = isGuru;
            else if (activeTab === 'siswa') roleMatch = isSiswa;
            else if (activeTab === 'orang_tua') roleMatch = isOrangTua;
            else if (activeTab === 'lainnya') roleMatch = !isGuru && !isSiswa && !isOrangTua;

            if (!roleMatch) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const nameMatch = (u.nama || '').toLowerCase().includes(query);
                const nipMatch = (u.nip || u.username || '').toLowerCase().includes(query);
                if (!nameMatch && !nipMatch) return false;
            }

            return true;
        }).map(u => ({
            ...u,
            pageLabel: u.last_location ? getPageLabel(u.last_location) : '—',
            tabLabel: u.last_location ? getTabLabel(u.last_location) : ''
        }));
    }, [users, activeTab, searchQuery, onlyOnline]);

    const tabStats = useMemo(() => {
        const usersInCurrentTab = users.filter(u => {
            const roles: string[] = u.roles || (u.role ? u.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean) : []);
            const isGuru = roles.some((r) => r === 'GURU');
            const isSiswa = roles.some((r) => r === 'SISWA');
            const isOrangTua = roles.some((r) => r === 'ORANG_TUA' || r === 'ORANGTUA');

            if (activeTab === 'guru') return isGuru;
            if (activeTab === 'siswa') return isSiswa;
            if (activeTab === 'orang_tua') return isOrangTua;
            if (activeTab === 'lainnya') return !isGuru && !isSiswa && !isOrangTua;
            return true;
        });

        const onlineCount = usersInCurrentTab.filter(u => u.is_online).length;
        const totalUsers = usersInCurrentTab.length;
        return { onlineCount, totalUsers };
    }, [users, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/monitoring/users', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) setUsers(data.data || []);
            else setError(data.error || 'Failed to fetch users');
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Gagal memuat data pengguna');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <MaintenanceBanner pageKey="maintenance_monitoring">
            <div className="mc-wrapper">
                {/* Tab Navigation */}
                <Tab
                    tabs={MONITORING_TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Tipe Pengguna Monitoring"
                    className="mc-tabs"
                    variant="slider"
                />

                {/* Search Toolbar with Online Filter Button */}
                <FilterToolbar>
                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Cari pengguna berdasarkan nama, NIP, atau username..."
                    />
                    <FilterActions>
                        <div className="mc-total-chip">
                            <span className="mc-total-val">{tabStats.totalUsers}</span>
                            <span className="mc-total-label">Total</span>
                        </div>
                        <button
                            type="button"
                            className={`mc-online-filter-btn ${onlyOnline ? 'active' : ''}`}
                            onClick={() => setOnlyOnline(prev => !prev)}
                            title="Filter hanya pengguna yang sedang aktif/online"
                        >
                            <span className="mc-pulse-dot-blue"></span>
                            <span>{onlyOnline ? 'Online Saja' : `${tabStats.onlineCount} Online`}</span>
                        </button>
                    </FilterActions>
                </FilterToolbar>

                {/* User Grid */}
                <div className="mc-content">
                    {loading && users.length === 0 ? (
                        <div className="mc-loading">
                            <Spinner variant="buble" />
                        </div>
                    ) : error ? (
                        <div className="mc-error">
                            <div className="mc-error-icon">
                                <i className="bi bi-exclamation-triangle"></i>
                            </div>
                            <p>{error}</p>
                            <Button variant="secondary" onClick={fetchData} leftIcon={<i className="bi bi-arrow-clockwise" />}>
                                Coba Lagi
                            </Button>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="mc-empty">
                            <div className="mc-empty-icon">
                                <i className="bi bi-people"></i>
                            </div>
                            <p>Belum ada data pengguna.</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="mc-empty">
                            <div className="mc-empty-icon">
                                <i className="bi bi-filter"></i>
                            </div>
                            <p>
                                {onlyOnline
                                    ? 'Tidak ada pengguna yang sedang online untuk tab/kriteria ini.'
                                    : 'Tidak ada pengguna untuk filter ini.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="mc-table-wrap desktop-only">
                                <table className="mc-table">
                                    <thead>
                                        <tr>
                                            <th>Pengguna</th>
                                            <th>Role</th>
                                            <th>Halaman Terakhir</th>
                                            <th>Terakhir Aktif</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className={`mc-row ${user.is_online ? 'is-online' : ''}`}>
                                                <td>
                                                    <div className="mc-user-cell">
                                                        <div className="mc-avatar" style={{ background: `linear-gradient(135deg, ${getRoleColor(user.role, darkMode)}, ${getRoleColor(user.role, darkMode)}aa)` }}>
                                                            {user.foto_profil && (
                                                                <img
                                                                    src={getProxiedImageUrl(user.foto_profil)}
                                                                    alt=""
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        const span = e.currentTarget.nextElementSibling as HTMLElement;
                                                                        if (span) span.style.display = 'flex';
                                                                    }}
                                                                />
                                                            )}
                                                            <span style={{ display: user.foto_profil ? 'none' : 'flex' }}>
                                                                {getInitials(user.nama || 'U')}
                                                            </span>
                                                            {user.is_online && <span className="mc-online-dot"></span>}
                                                        </div>
                                                        <div className="mc-user-info">
                                                            <span className="mc-user-name">{user.nama}</span>
                                                            <span className="mc-user-sub">{user.nip || user.username}{user.kelas ? ` · ${user.kelas}` : ''}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="mc-role-badge" style={{ background: `${getRoleColor(user.roles?.[0] || user.role, darkMode)}18`, color: getRoleColor(user.roles?.[0] || user.role, darkMode) }}>
                                                        {user.roles?.[0] || user.role || 'User'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="mc-location">
                                                        <i className="bi bi-geo-alt-fill"></i>
                                                        {user.pageLabel}
                                                        {user.tabLabel && (
                                                            <span className="mc-tab-badge">→ {user.tabLabel}</span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="mc-time">{user.last_seen_text}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="mc-cards mobile-only">
                                {filteredUsers.map((user) => (
                                    <div key={user.id} className={`mc-card ${user.is_online ? 'is-online' : ''}`}>
                                        <div className="mc-card-left">
                                            <div className="mc-avatar mc-avatar-lg" style={{ background: `linear-gradient(135deg, ${getRoleColor(user.role, darkMode)}, ${getRoleColor(user.role, darkMode)}aa)` }}>
                                                {user.foto_profil && (
                                                    <img
                                                        src={getProxiedImageUrl(user.foto_profil)}
                                                        alt=""
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const span = e.currentTarget.nextElementSibling as HTMLElement;
                                                            if (span) span.style.display = 'flex';
                                                        }}
                                                    />
                                                )}
                                                <span style={{ display: user.foto_profil ? 'none' : 'flex' }}>
                                                    {getInitials(user.nama || 'U')}
                                                </span>
                                                {user.is_online && <span className="mc-online-dot"></span>}
                                            </div>
                                            <div className="mc-card-info">
                                                <span className="mc-name-lg">{user.nama}</span>
                                                {user.kelas && <span className="mc-kelas-sub">{user.kelas}</span>}
                                            </div>
                                        </div>
                                        <div className="mc-card-details">
                                            <span className="mc-role-badge mc-role-xs" style={{ background: `${getRoleColor(user.roles?.[0] || user.role, darkMode)}18`, color: getRoleColor(user.roles?.[0] || user.role, darkMode) }}>
                                                {user.roles?.[0] || user.role || 'User'}
                                            </span>
                                            <span className="mc-detail-sep"></span>
                                            <div className="mc-detail-item">
                                                <i className="bi bi-geo-alt-fill"></i>
                                                <span>
                                                    {user.pageLabel}
                                                    {user.tabLabel && (
                                                        <span className="mc-tab-badge"> → {user.tabLabel}</span>
                                                    )}
                                                </span>
                                            </div>
                                            <span className="mc-detail-sep"></span>
                                            <div className="mc-detail-item">
                                                <i className="bi bi-clock"></i>
                                                <span>{user.last_seen_text}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </MaintenanceBanner>
    );
}
