'use client';

import { useState, useEffect, useMemo } from 'react';

// Helper to extract tab name from URL
function getTabLabel(location: string): string {
    // Extract tab from URL patterns like ?tab=namaTab or ?activeTab=namaTab
    const tabMatch = location.match(/[?&](?:tab|activeTab)=([^&]+)/);
    if (tabMatch) {
        return decodeURIComponent(tabMatch[1]);
    }
    return '';
}

// Helper to convert last_location URL to friendly page name
function getPageLabel(location: string): string {
    const pageMatch = location.match(/[?&]page=([^&]+)/);
    if (pageMatch) {
        const page = decodeURIComponent(pageMatch[1]);
        return formatPageName(page);
    }
    const pathMap: Record<string, string> = {
        '/': 'Beranda',
        '/dashboard': 'Dashboard',
        '/monitoring': 'Pusat Kontrol',
        '/absensi': 'Absensi',
        '/jurnal': 'Jurnal',
        '/piket': 'Piket',
        '/piket-input': 'Input Piket',
        '/master': 'Master Data',
        '/pengaturan-data': 'Pengaturan Data',
        '/pengaturan-tugas': 'Pengaturan Tugas',
        '/pengaturan-users': 'Pengaturan Users',
        '/nilai': 'Nilai',
        '/lckh': 'LCKH',
        '/lckh-approval': 'LCKH Approval',
        '/catatan-keuangan': 'Catatan Keuangan',
        '/arsip-siswa': 'Arsip Siswa',
        '/agenda-akademik': 'Agenda Akademik',
        '/kinerja-guru': 'Kinerja Guru',
        '/informasi': 'Informasi',
        '/informasi-akademik': 'Informasi Akademik',
        '/ujian-madrasah': 'Ujian Madrasah',
        '/analisis-beban-kerja': 'Analisis Beban Kerja',
        '/profile': 'Profil Saya',
        '/personal-documents': 'Dokumen Pribadi',
        '/ketidakhadiran': 'Ketidakhadiran',
        '/tugas-tambahan': 'Tugas Tambahan',
        '/laporan-guru-asuh': 'Laporan Guru Asuh',
        '/laporan/pengembangan-diri': 'Pengembangan Diri',
        '/laporan/jurnal': 'Laporan Jurnal',
        '/laporan/absensi': 'Laporan Absensi',
        '/laporan/nilai': 'Laporan Nilai',
    };
    const normalized = location.split('?')[0];
    if (pathMap[normalized]) return pathMap[normalized];
    if (normalized.startsWith('/api')) return 'System API';
    return formatPageName(normalized.split('/')[1] || 'Dashboard');
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
    'KEPSEK': '#7c3aed',
    'GURU': '#0369a1',
    'WALI KELAS': '#0f766e',
    'DEFAULT': '#3083FF',
};

// Lighter variants for dark mode visibility
const ROLE_COLORS_DARK: Record<string, string> = {
    'ADMIN': '#f472b6',
    'KEPSEK': '#c084fc',
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

    useEffect(() => {
        setDarkMode(document.documentElement.classList.contains('dark'));
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const stats = useMemo(() => {
        const onlineCount = users.filter(u => u.is_online).length;
        const totalUsers = users.length;
        return { onlineCount, totalUsers };
    }, [users]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/monitoring/users');
            const data = await res.json();
            if (data.success) setUsers(data.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mc-wrapper">
            {/* Header */}
            <div className="mc-hero">
                <div className="mc-hero-left">
                    <h1 className="mc-hero-title">Pusat Kontrol</h1>
                    <p className="mc-hero-sub">Pantau aktivitas dan status pengguna sistem secara real-time.</p>
                </div>

                {/* Inline Stats */}
                <div className="mc-stats-row">
                    <div className="mc-stat">
                        <span className="mc-stat-val">{stats.totalUsers}</span>
                        <span className="mc-stat-lbl">Total User</span>
                    </div>
                    <div className="mc-stat-divider"></div>
                    <div className="mc-stat">
                        <span className="mc-stat-val mc-online">{stats.onlineCount}</span>
                        <span className="mc-stat-lbl">Sedang Aktif</span>
                    </div>
                </div>

            </div>

            {/* User Grid */}
            <div className="mc-content">
                {loading && users.length === 0 ? (
                    <div className="mc-loading">
                        <div className="mc-spinner"></div>
                        <span>Memuat data pengguna...</span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="mc-empty">
                        <div className="mc-empty-icon">
                            <i className="bi bi-people"></i>
                        </div>
                        <p>Belum ada data pengguna.</p>
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
                                    {users.map((user) => (
                                        <tr key={user.id} className={`mc-row ${user.is_online ? 'is-online' : ''}`}>
                                            <td>
                                                <div className="mc-user-cell">
                                                    <div className="mc-avatar" style={{ background: `linear-gradient(135deg, ${getRoleColor(user.role, darkMode)}, ${getRoleColor(user.role, darkMode)}aa)` }}>
                                                        {user.foto_profil ? (
                                                            <img src={user.foto_profil} alt="" />
                                                        ) : (
                                                            <span>{getInitials(user.nama || 'U')}</span>
                                                        )}
                                                        {user.is_online && <span className="mc-online-dot"></span>}
                                                    </div>
                                                    <div className="mc-user-info">
                                                        <span className="mc-user-name">{user.nama}</span>
                                                        <span className="mc-user-sub">{user.username || user.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="mc-role-badge" style={{ background: `${getRoleColor(user.role, darkMode)}18`, color: getRoleColor(user.role, darkMode) }}>
                                                    {user.role || 'User'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="mc-location">
                                                    <i className="bi bi-geo-alt-fill"></i>
                                                    {user.last_location ? getPageLabel(user.last_location) : '—'}
                                                    {user.last_location && getTabLabel(user.last_location) && (
                                                        <span className="mc-tab-badge">→ {getTabLabel(user.last_location)}</span>
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
                            {users.map((user) => (
                                <div key={user.id} className={`mc-card ${user.is_online ? 'is-online' : ''}`}>
                                    <div className="mc-card-left">
                                        <div className="mc-avatar mc-avatar-lg" style={{ background: `linear-gradient(135deg, ${getRoleColor(user.role, darkMode)}, ${getRoleColor(user.role, darkMode)}aa)` }}>
                                            {user.foto_profil ? (
                                                <img src={user.foto_profil} alt="" />
                                            ) : (
                                                <span>{getInitials(user.nama || 'U')}</span>
                                            )}
                                            {user.is_online && <span className="mc-online-dot"></span>}
                                        </div>
                                        <div className="mc-card-info">
                                            <span className="mc-name-lg">{user.nama}</span>
                                            <span className="mc-role-badge mc-role-xs" style={{ background: `${getRoleColor(user.role, darkMode)}18`, color: getRoleColor(user.role, darkMode) }}>
                                                {user.role || 'User'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mc-card-details">
                                        <div className="mc-detail-item">
                                            <i className="bi bi-geo-alt-fill"></i>
                                            <span>
                                                {user.last_location ? getPageLabel(user.last_location) : '—'}
                                                {user.last_location && getTabLabel(user.last_location) && (
                                                    <span className="mc-tab-badge"> → {getTabLabel(user.last_location)}</span>
                                                )}
                                            </span>
                                        </div>
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

            <style jsx>{`
                /* RESET */
                * { box-sizing: border-box; }

                /* WRAPPER */
                .mc-wrapper {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 20px;
                    font-family: 'Inter', sans-serif;
                    overflow-x: hidden;
                }

                /* HERO */
                .mc-hero {
                    background: linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%);
                    border-radius: 24px;
                    padding: 28px 36px;
                    color: white;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0, 56, 168, 0.2);
                }

                .mc-hero::before {
                    content: '';
                    position: absolute;
                    top: -60px;
                    right: -60px;
                    width: 280px;
                    height: 280px;
                    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
                    pointer-events: none;
                }

                .mc-hero::after {
                    content: '';
                    position: absolute;
                    bottom: -80px;
                    left: 30%;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
                    pointer-events: none;
                }

                .mc-hero-left {
                    flex: 1;
                    min-width: 0;
                }

                .mc-hero-title {
                    font-size: 1.6rem;
                    font-weight: 800;
                    margin: 0 0 4px;
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                }

                .mc-hero-sub {
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.7);
                    margin: 0;
                    line-height: 1.4;
                }

                /* INLINE STATS */
                .mc-stats-row {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 16px;
                    padding: 12px 20px;
                    white-space: nowrap;
                }

                .mc-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    padding: 0 16px;
                }

                .mc-stat-divider {
                    width: 1px;
                    height: 32px;
                    background: rgba(255,255,255,0.2);
                }

                .mc-stat-val {
                    font-size: 1.5rem;
                    font-weight: 800;
                    line-height: 1;
                    color: white;
                }

                .mc-stat-val.mc-online {
                    color: #4ade80;
                }

                .mc-stat-lbl {
                    font-size: 0.68rem;
                    font-weight: 600;
                    color: rgba(255,255,255,0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* CONTENT */
                .mc-content {
                    animation: fadeUp 0.3s ease-out;
                    width: 100%;
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* EMPTY STATE */
                .mc-empty {
                    text-align: center;
                    padding: 80px 20px;
                    color: var(--n-muted);
                }

                .mc-empty-icon {
                    font-size: 3rem;
                    margin-bottom: 12px;
                    opacity: 0.3;
                }

                .mc-empty p {
                    font-size: 0.95rem;
                    font-weight: 500;
                    margin: 0;
                }

                /* LOADING SPINNER */
                .mc-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 320px;
                    gap: 14px;
                }

                .mc-spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid rgba(0, 56, 168, 0.12);
                    border-top-color: var(--n-primary);
                    border-radius: 50%;
                    animation: mcSpin 0.8s linear infinite;
                }

                .mc-loading span {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                @keyframes mcSpin {
                    to { transform: rotate(360deg); }
                }

                /* TABLE */
                .mc-table-wrap {
                    background: var(--n-card);
                    border-radius: 20px;
                    overflow: hidden;
                    border: 1px solid var(--n-border);
                    box-shadow: var(--n-shadow-soft);
                }

                .mc-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .mc-table thead tr {
                    background: var(--n-soft);
                }

                .mc-table th {
                    padding: 14px 20px;
                    text-align: left;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: var(--n-muted);
                    border-bottom: 1px solid var(--n-border);
                }

                .mc-row td {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--n-soft);
                    vertical-align: middle;
                }

                .mc-row:last-child td {
                    border-bottom: none;
                }

                .mc-row:hover td {
                    background: var(--tb-hover);
                }

                .mc-row.is-online td {
                    background: rgba(74, 222, 128, 0.03);
                }

                .mc-row.is-online:hover td {
                    background: rgba(74, 222, 128, 0.06);
                }

                /* USER CELL */
                .mc-user-cell {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .mc-avatar {
                    position: relative;
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    color: white;
                    font-size: 0.85rem;
                    font-weight: 800;
                    overflow: visible;
                }

                .mc-avatar img {
                    width: 100%;
                    height: 100%;
                    border-radius: 12px;
                    object-fit: cover;
                }

                .mc-online-dot {
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    width: 11px;
                    height: 11px;
                    background: #22c55e;
                    border-radius: 50%;
                    border: 2px solid var(--n-card);
                    animation: online-pulse 2s infinite;
                }

                @keyframes online-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
                    50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
                }

                .mc-user-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .mc-user-name {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    line-height: 1.2;
                }

                .mc-user-sub {
                    font-size: 0.78rem;
                    color: var(--n-muted);
                }

                /* ROLE BADGE */
                .mc-role-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 0.78rem;
                    font-weight: 700;
                }

                .mc-role-sm {
                    font-size: 0.72rem;
                    padding: 3px 8px;
                }

                /* LOCATION */
                .mc-location {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.85rem;
                    color: var(--n-muted);
                    flex-wrap: wrap;
                }

                .mc-location i {
                    font-size: 0.8rem;
                    color: var(--n-primary);
                }

                /* TAB BADGE */
                .mc-tab-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    background: rgba(0, 56, 168, 0.08);
                    color: var(--n-primary);
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    margin-left: 4px;
                }

                /* TIME */
                .mc-time {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }

                /* MOBILE CARDS */
                .mc-cards {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 0 12px 24px;
                }

                .mc-card {
                    background: var(--n-card);
                    border-radius: 10px;
                    border: 1px solid var(--n-border);
                    padding: 12px 14px;
                    transition: border-color 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .mc-card.is-online {
                    border-color: rgba(74, 222, 128, 0.4);
                    background: rgba(74, 222, 128, 0.02);
                }

                .mc-card-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .mc-avatar-lg {
                    width: 44px;
                    height: 44px;
                    font-size: 1rem;
                    flex-shrink: 0;
                }

                .mc-card-info {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 3px;
                    overflow: hidden;
                }

                .mc-name-lg {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .mc-role-xs {
                    font-size: 0.65rem;
                    padding: 2px 7px;
                    border-radius: 6px;
                    font-weight: 700;
                    width: fit-content;
                }

                .mc-card-details {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding-top: 10px;
                    border-top: 1px solid var(--n-border);
                }

                .mc-detail-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    color: var(--n-muted);
                    min-width: 0;
                }

                .mc-detail-item span {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }

                .mc-detail-item i {
                    font-size: 0.8rem;
                    color: var(--n-primary);
                    width: 18px;
                    text-align: center;
                    flex-shrink: 0;
                }

                /* SPIN */
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* RESPONSIVE */
                .desktop-only { display: block; }
                .mobile-only { display: none; }

                /* DARK MODE */
                .dark .mc-hero-title,
                .dark .mc-hero-sub,
                .dark .mc-stat-val,
                .dark .mc-stat-val.mc-online,
                .dark .mc-stat-lbl,
                .dark .mc-stat-divider {
                    color: white;
                }

                .dark .mc-stat-val.mc-online {
                    color: #4ade80;
                }

                .dark .mc-stats-row {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.15);
                }

                .dark .mc-empty {
                    color: var(--n-muted);
                }

                .dark .mc-empty-icon {
                    color: var(--n-muted);
                }

                .dark .mc-empty p {
                    color: var(--n-ink);
                }

                .dark .mc-loading span {
                    color: var(--n-muted);
                }

                /* Table dark mode */
                .dark .mc-table-wrap {
                    background: var(--n-card);
                    border-color: var(--n-border);
                }
                .dark .mc-table thead tr {
                    background: rgba(255,255,255,0.03);
                }
                .dark .mc-table th {
                    color: var(--n-muted);
                    border-bottom-color: var(--n-border);
                }
                .dark .mc-row td {
                    border-bottom-color: var(--n-border);
                    color: var(--n-ink);
                }
                .dark .mc-row.is-online td {
                    background: rgba(74, 222, 128, 0.06);
                }
                .dark .mc-row.is-online:hover td {
                    background: rgba(74, 222, 128, 0.10);
                }

                /* User info text */
                .dark .mc-user-name {
                    color: var(--n-ink);
                }
                .dark .mc-user-sub {
                    color: var(--n-muted);
                }

                /* Location text */
                .dark .mc-location {
                    color: var(--n-ink);
                }
                .dark .mc-location i {
                    color: var(--n-primary);
                }

                /* Tab badge - make it readable on both modes */
                .dark .mc-tab-badge {
                    background: rgba(79, 142, 247, 0.15);
                    color: #7aabf9;
                }

                /* Time text */
                .dark .mc-time {
                    color: var(--n-muted);
                }

                /* Card dark mode */
                .dark .mc-card {
                    background: var(--n-card);
                    border-color: var(--n-border);
                }
                .dark .mc-card.is-online {
                    border-color: rgba(74, 222, 128, 0.35);
                    background: rgba(74, 222, 128, 0.04);
                }
                .dark .mc-card-details {
                    border-top-color: var(--n-border);
                }

                /* Card name */
                .dark .mc-name-lg {
                    color: var(--n-ink);
                }

                /* Detail items */
                .dark .mc-detail-item span {
                    color: var(--n-ink);
                }
                .dark .mc-detail-item i {
                    color: var(--n-primary);
                }

                /* Online dot */
                .dark .mc-online-dot {
                    border-color: var(--n-card);
                }

                /* Spinner */
                .dark .mc-spinner {
                    border-color: rgba(79, 142, 247, 0.15);
                    border-top-color: var(--n-primary);
                }

                @media (max-width: 1024px) {
                    .mc-hero {
                        flex-wrap: wrap;
                        gap: 16px;
                        padding: 24px;
                    }
                    .mc-stats-row {
                        width: 100%;
                        justify-content: center;
                    }
                }

                @media (max-width: 768px) {
                    .mc-wrapper { padding: 0; }
                    .mc-hero {
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 24px 24px 28px;
                        gap: 16px;
                        border-radius: 0;
                        margin: 0 0 16px;
                    }
                    .mc-hero-title { font-size: 1.5rem; }
                    .mc-stats-row {
                        width: 100%;
                        padding: 12px 16px;
                        white-space: normal;
                        justify-content: space-around;
                    }
                    .mc-stat { padding: 0 8px; }
                    .mc-stat-val { font-size: 1.4rem; }
                    .mc-cards { padding: 0 12px 24px; gap: 0; }
                    .mc-card { border-radius: 10px; padding: 13px; }
                    .desktop-only { display: none; }
                    .mobile-only { display: flex; flex-direction: column; }
                }
            `}</style>
        </div>
    );
}
