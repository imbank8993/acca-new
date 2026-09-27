'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { mutate } from 'swr';
import { MENU_GROUPS, PAGE_LABELS, type MenuGroupDef } from '@/lib/sidebar-menu';
import { PageLoader } from '@/components/ui/Spinner';

interface MaintenanceSetting {
    id: number;
    key: string;
    label: string;
    description: string | null;
    value: string;
    message: string;
    updated_at: string;
}

interface PageRow {
    setting: MaintenanceSetting;
    label: string;
}

interface PageGroup {
    title: string;
    icon: string;
    items: PageRow[];
}

interface DiscoveredPage {
    id: string;
    label: string;
    icon: string;
    color: string;
    path: string;
}

// Halaman yang key maintenance-nya berbeda dari pola default `maintenance_<id>`.
// Harus cocok dengan pageKey pada <MaintenanceBanner> di tiap halaman.
const MAINTENANCE_KEY_OVERRIDE: Record<string, string> = {
    'informasi-akademik': 'maintenance_informasi_akademik',   // app/informasi-akademik
    'agenda-madrasah': 'maintenance_agenda_akademik',
    'dokumen': 'maintenance_dokumen_siswa',
};

let globalAutoCreateAttempted = false;

export default function MaintenanceTab({ user }: { user?: any }) {
    const [settings, setSettings] = useState<MaintenanceSetting[]>([]);
    /** `true` hanya bila daftar setting BENAR-BENAR terbaca dari server. */
    const [settingsTerbaca, setSettingsTerbaca] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
    const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
    // Sumber susunan halaman — SAMA dengan tab "Susun Menu" (lib/sidebar-menu + /api/menu-layout)
    const [menuGroups, setMenuGroups] = useState<MenuGroupDef[]>([]);
    const [menuLabels, setMenuLabels] = useState<Record<string, string>>({});

    // Nama tampilan halaman — sama persis dengan tab "Susun Menu"
    const effLabel = (id: string) => menuLabels[id] ?? PAGE_LABELS[id] ?? id;
    // Page id → key setting maintenance. Sebagian halaman pakai key yg berbeda dari
    // pola default (key harus sama dgn pageKey di <MaintenanceBanner> halaman ybs,
    // kalau tidak toggle-nya tak berefek).
    const keyOf = (id: string) => MAINTENANCE_KEY_OVERRIDE[id] ?? `maintenance_${id.replace(/-/g, '_')}`;

    const showSnackbar = (msg: string, type: 'success' | 'error') => {
        setSnackbar({ msg, type });
        setTimeout(() => setSnackbar(null), 3000);
    };

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch('/api/site-settings');
            const json = await res.json();
            if (json.ok) {
                setSettings(json.data);
                setSettingsTerbaca(true);
            } else {
                setSettingsTerbaca(false);
                showSnackbar(json.message || json.error || 'Gagal mengambil data pengaturan', 'error');
            }
        } catch (e) {
            setSettingsTerbaca(false);
            showSnackbar('Gagal mengambil data pengaturan', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDiscoveredPages = useCallback(async () => {
        try {
            const res = await fetch('/api/pages');
            const json = await res.json();
            if (json.ok) {
                setDiscoveredPages(json.data || []);
            }
        } catch (e) {
            console.error('Failed to fetch discovered pages:', e);
        }
    }, []);

    // Ambil susunan menu yang sama dengan tab "Susun Menu" (urutan grup, label, ikon)
    const fetchMenuLayout = useCallback(async () => {
        try {
            const res = await fetch('/api/menu-layout');
            const d = await res.json();
            if (d?.ok) {
                // Layout kosong = belum disusun → template bawaan sebagai titik awal.
                if (Array.isArray(d.layout)) setMenuGroups(d.layout.length ? d.layout : MENU_GROUPS);
                if (d.labels && typeof d.labels === 'object') setMenuLabels(d.labels);
            }
        } catch (e) {
            console.error('Failed to fetch menu layout:', e);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
        fetchDiscoveredPages();
        fetchMenuLayout();
    }, [fetchSettings, fetchDiscoveredPages, fetchMenuLayout]);

    // Filter settings based on search
    const filteredSettings = useMemo(() => {
        if (!searchQuery.trim()) return settings;
        const q = searchQuery.toLowerCase();
        return settings.filter(s =>
            s.key.toLowerCase().includes(q) ||
            s.label.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        );
    }, [settings, searchQuery]);

    const handleToggle = async (setting: MaintenanceSetting) => {
        setSaving(setting.key);
        try {
            const newValue = setting.value === 'true' ? 'false' : 'true';
            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: setting.key, value: newValue }),
            });
            const json = await res.json();
            if (json.ok) {
                setSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: newValue } : s));
                mutate('maintenance-banner-data');
                showSnackbar(`${setting.label} ${newValue === 'true' ? 'dikunci' : 'dibuka'}`, 'success');
            } else {
                showSnackbar(json.message || json.error || 'Gagal update', 'error');
            }
        } catch (e) {
            showSnackbar('Terjadi kesalahan', 'error');
        } finally {
            setSaving(null);
        }
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    const getLockedCount = (items: PageRow[]) => {
        return items.filter(i => i.setting.value === 'true').length;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Susun grup & urutan halaman PERSIS seperti tab "Susun Menu":
    // grup, urutan grup, ikon, dan label diambil dari susunan menu yang sama.
    const groupedSettings: PageGroup[] = useMemo(() => {
        const byKey: Record<string, MaintenanceSetting> = {};
        filteredSettings.forEach(s => { byKey[s.key] = s; });
        const used = new Set<string>();

        const groups: PageGroup[] = menuGroups.map(g => {
            const items: PageRow[] = g.pages
                .map(id => ({ setting: byKey[keyOf(id)], label: effLabel(id) }))
                .filter((r): r is PageRow => Boolean(r.setting));
            items.forEach(r => used.add(r.setting.key));
            return { title: g.label, icon: g.icon, items };
        }).filter(g => g.items.length > 0);

        // Setting maintenance yg tak terpetakan ke halaman menu (global, home,
        // link_auth, reset_data, atau key legacy spt agenda_akademik) → "Sistem &
        // Lainnya". HANYA key berawalan `maintenance_` — site-settings lain (token
        // WA, target piket, notifikasi PTSP, dll.) tidak boleh ikut tampil di sini.
        const leftover = filteredSettings
            .filter(s => s.key.startsWith('maintenance_') && !used.has(s.key))
            .map(s => ({ setting: s, label: s.label || s.key }));
        if (leftover.length > 0) {
            groups.push({ title: 'Sistem & Lainnya', icon: 'fa-ellipsis', items: leftover });
        }
        return groups;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredSettings, menuGroups, menuLabels]);

    // Auto-create settings for discovered pages that don't exist
    useEffect(() => {
        /**
         * Pembuatan otomatis baris maintenance untuk halaman yang belum punya.
         *
         * `settingsTerbaca` WAJIB ikut diperiksa. Efek ini sengaja tetap berjalan
         * saat `settings` kosong — supaya pemasangan pertama, yang memang belum
         * punya baris apa pun, tetap terisi. Tapi `settings` juga kosong ketika
         * PEMUATANNYA GAGAL, dan pada keadaan itu seluruh kunci dianggap hilang lalu
         * ditulis ulang dengan `value: 'false'` — mematikan setiap mode pemeliharaan
         * yang sedang aktif, tanpa siapa pun menyadarinya.
         *
         * Penanda ini memisahkan "berhasil dibaca, isinya kosong" dari "gagal
         * dibaca", sehingga niat aslinya tetap jalan tanpa efek samping itu.
         */
        if (!loading && settingsTerbaca && discoveredPages.length > 0 && !globalAutoCreateAttempted) {
            globalAutoCreateAttempted = true; // Lock to prevent retry storms
            const existingKeys = new Set(settings.map(s => s.key));
            const missingPages = discoveredPages.filter(p => !existingKeys.has(keyOf(p.id)));

            if (missingPages.length > 0) {
                // Auto-create settings for missing pages (pakai keyOf → hormati override
                // agar tidak membuat key kembar yg tak berefek, mis. agenda_madrasah)
                Promise.all(missingPages.map(page => {
                    const key = keyOf(page.id);
                    return fetch('/api/site-settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            key,
                            value: 'false',
                            message: `Halaman ${page.label} sedang dalam pemeliharaan`,
                            label: page.label,
                            description: `Otomatis dibuat dari deteksi halaman: ${page.path}`
                        })
                    });
                })).then(() => {
                    // Refresh settings after creating new ones
                    fetchSettings();
                }).catch(console.error);
            }
        }
    }, [loading, settingsTerbaca, settings.length, discoveredPages.length, fetchSettings]);

    // Auto-expand semua grup sekali saat awal (mengikuti grup susunan menu)
    useEffect(() => {
        if (!loading && !hasAutoExpanded) {
            setHasAutoExpanded(true); // Lock so user collapse state persists
            setExpandedGroups(new Set([...menuGroups.map(g => g.label), 'Sistem & Lainnya']));
        }
    }, [loading, hasAutoExpanded, menuGroups]);

    // Show count badge on search
    const searchResultCount = searchQuery.trim() ? filteredSettings.length : null;

    if (loading) {
        return <PageLoader minHeight="300px" variant="trace" />;
    }

    return (
        <div className="mt-container">
            <div className="mt-info">
                <i className="bi bi-info-circle-fill"></i>
                <span>Aktifkan kunci halaman untuk menampilkan pesan maintenance. Admin tetap bisa melihat halaman.</span>
            </div>

            <div className="mt-search">
                <i className="bi bi-search"></i>
                <input
                    type="text"
                    placeholder="Cari halaman..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="mt-search-clear" onClick={() => setSearchQuery('')} title="Hapus pencarian">
                        <i className="bi bi-x-lg"></i>
                    </button>
                )}
                {searchResultCount !== null && (
                    <span className="mt-search-count">{searchResultCount} hasil</span>
                )}
                <button className="mt-btn-icon" onClick={fetchMenuLayout} title="Muat ulang susunan menu" style={{ marginLeft: "auto" }}>
                    <i className="bi bi-arrow-clockwise"></i>
                </button>
            </div>

            {discoveredPages.length > 0 && (
                <div className="mt-page-info">
                    <i className="bi bi-folder-check"></i>
                    <span>Total {discoveredPages.length} halaman terdeteksi</span>
                </div>
            )}

            <div className="mt-list">
                {groupedSettings.map((group) => {
                    const lockedCount = getLockedCount(group.items);
                    const isExpanded = expandedGroups.has(group.title);

                    return (
                        <div key={group.title} className="mt-group">
                            <button
                                className="mt-group-header"
                                onClick={() => toggleGroup(group.title)}
                                type="button"
                            >
                                <div className="mt-group-left">
                                    <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} mt-group-chevron`}></i>
                                    <span className="mt-group-iconWrap"><i className={`fa-solid ${group.icon}`}></i></span>
                                    <span className="mt-group-title">{group.title}</span>
                                    {lockedCount > 0 && (
                                        <span className="mt-group-badge">{lockedCount} dikunci</span>
                                    )}
                                </div>
                                <span className="mt-group-count">{group.items.length} halaman</span>
                            </button>

                            {isExpanded && (
                                <div className="mt-group-items">
                                    {group.items.map((row) => {
                                        const setting = row.setting;
                                        const isLocked = setting.value === 'true';
                                        const isSaving = saving === setting.key;

                                        return (
                                            <div key={setting.key} className={`mt-item ${isLocked ? 'is-locked' : ''}`}>
                                                <div className="mt-item-row">
                                                    <div className="mt-item-info">
                                                        <span className="mt-item-label">{row.label}</span>
                                                        {setting.description && (
                                                            <span className="mt-item-desc">{setting.description}</span>
                                                        )}
                                                    </div>
                                                    <div className="mt-item-actions">
                                                        <label className="mt-toggle">
                                                            <input
                                                                type="checkbox"
                                                                checked={isLocked}
                                                                onChange={() => handleToggle(setting)}
                                                                disabled={isSaving}
                                                            />
                                                            <span className="mt-toggle-slider"></span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {snackbar && (
                <div className={`mt-snackbar ${snackbar.type}`}>
                    <i className={`bi ${snackbar.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                    {snackbar.msg}
                </div>
            )}

            <style jsx>{`
                .mt-container {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .mt-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0, 56, 168, 0.06);
                    border: 1px solid rgba(0, 56, 168, 0.12);
                    border-radius: 12px;
                    padding: 12px 16px;
                    font-size: 0.875rem;
                    color: var(--n-primary, #3083ff);
                }

                .mt-info i { font-size: 1rem; flex-shrink: 0; }

                :global(.dark) .mt-info {
                    background: rgba(0, 56, 168, 0.15);
                    border-color: rgba(100, 116, 139, 0.2);
                    color: #93c5fd;
                }

                .mt-search {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    background: var(--n-card, white);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                }

                :global(.dark) .mt-search {
                    background: var(--n-surface, #1e293b);
                    border-color: rgba(255, 255, 255, 0.1);
                }

                .mt-search i {
                    color: var(--n-text-muted, #94a3b8);
                    font-size: 1rem;
                }

                .mt-search input {
                    flex: 1;
                    border: none;
                    background: transparent;
                    font-size: 0.9rem;
                    color: var(--n-text, #1e293b);
                    outline: none;
                }

                :global(.dark) .mt-search input {
                    color: #e2e8f0;
                    background: transparent !important;
                }

                :global(.dark) .mt-search input::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }

                .mt-search-clear {
                    background: transparent;
                    border: none;
                    color: var(--n-text-muted, #94a3b8);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.15s;
                }

                .mt-search-clear:hover {
                    color: var(--n-text, #1e293b);
                    background: rgba(0, 0, 0, 0.05);
                }

                :global(.dark) .mt-search-clear:hover {
                    color: #e2e8f0;
                    background: rgba(255, 255, 255, 0.1);
                }

                .mt-search-count {
                    font-size: 0.75rem;
                    color: var(--n-primary, #3083ff);
                    background: rgba(0, 56, 168, 0.08);
                    padding: 2px 10px;
                    border-radius: 12px;
                    font-weight: 600;
                }

                .mt-page-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    background: rgba(16, 185, 129, 0.08);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    border-radius: 10px;
                    font-size: 0.8rem;
                    color: #059669;
                }

                :global(.dark) .mt-page-info {
                    background: rgba(16, 185, 129, 0.1);
                    border-color: rgba(16, 185, 129, 0.3);
                    color: #34d399;
                }

                .mt-page-info i {
                    font-size: 0.9rem;
                }

                .mt-list { display: flex; flex-direction: column; gap: 10px; }

                .mt-group {
                    background: var(--n-card, white);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 14px;
                    overflow: hidden;
                }

                :global(.dark) .mt-group {
                    background: var(--n-surface, #1e293b);
                    border-color: rgba(255, 255, 255, 0.06);
                }

                .mt-group-header {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 18px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .mt-group-header:hover {
                    background: rgba(0, 0, 0, 0.02);
                }

                :global(.dark) .mt-group-header:hover {
                    background: rgba(255, 255, 255, 0.02);
                }

                .mt-group-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .mt-group-chevron {
                    font-size: 0.8rem;
                    color: var(--n-text-secondary, #64748b);
                }

                .mt-group-iconWrap {
                    width: 26px;
                    height: 26px;
                    border-radius: 7px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 56, 168, 0.08);
                    color: var(--n-primary, #3083ff);
                    font-size: 0.8rem;
                    flex-shrink: 0;
                }

                :global(.dark) .mt-group-iconWrap {
                    background: rgba(255, 255, 255, 0.06);
                    color: #93c5fd;
                }

                .mt-group-title {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-text, #1e293b);
                }

                .mt-group-badge {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 20px;
                }

                .mt-group-count {
                    font-size: 0.75rem;
                    color: var(--n-text-muted, #94a3b8);
                }

                .mt-group-items {
                    border-top: 1px solid var(--n-border, #e2e8f0);
                }

                :global(.dark) .mt-group-items { border-color: rgba(255, 255, 255, 0.06); }

                .mt-item {
                    padding: 12px 18px;
                    border-bottom: 1px solid var(--n-border, #e2e8f0);
                    transition: background 0.15s;
                }

                .mt-item:last-child { border-bottom: none; }

                :global(.dark) .mt-item { border-color: rgba(255, 255, 255, 0.04); }

                .mt-item.is-locked {
                    background: rgba(245, 158, 11, 0.03);
                }

                :global(.dark) .mt-item.is-locked {
                    background: rgba(245, 158, 11, 0.04);
                }

                .mt-item-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .mt-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex: 1;
                }

                .mt-item-label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--n-text, #1e293b);
                }

                .mt-item-desc {
                    font-size: 0.72rem;
                    color: var(--n-text-muted, #94a3b8);
                }

                .mt-item-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                /* Toggle */
                .mt-toggle {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }

                .mt-toggle input {
                    opacity: 0; width: 0; height: 0;
                }

                .mt-toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    inset: 0;
                    background: #cbd5e1;
                    border-radius: 24px;
                    transition: 0.3s;
                }

                .mt-toggle-slider::before {
                    content: '';
                    position: absolute;
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background: white;
                    border-radius: 50%;
                    transition: 0.3s;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }

                .mt-toggle input:checked + .mt-toggle-slider {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                }

                .mt-toggle input:checked + .mt-toggle-slider::before {
                    transform: translateX(20px);
                }

                .mt-toggle input:disabled + .mt-toggle-slider {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .mt-btn-icon {
                    background: transparent;
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 6px;
                    padding: 4px 8px;
                    cursor: pointer;
                    color: var(--n-text-secondary, #64748b);
                    font-size: 0.8rem;
                    transition: all 0.2s;
                }

                .mt-btn-icon:hover {
                    background: rgba(0, 56, 168, 0.06);
                    color: var(--n-primary, #3083ff);
                    border-color: var(--n-primary, #3083ff);
                }

                .mt-item-message {
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px dashed rgba(245, 158, 11, 0.3);
                }

                .mt-message-preview {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .mt-message-preview i {
                    color: #d97706;
                    font-size: 0.8rem;
                    flex-shrink: 0;
                }

                .mt-message-preview p {
                    font-size: 0.8rem;
                    color: var(--n-text, #475569);
                    font-style: italic;
                    margin: 0;
                    flex: 1;
                }

                .mt-btn-edit-msg {
                    background: transparent;
                    border: 1px solid rgba(0, 56, 168, 0.3);
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 0.72rem;
                    color: var(--n-primary, #3083ff);
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .mt-btn-edit-msg:hover {
                    background: rgba(0, 56, 168, 0.06);
                }

                .mt-edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .mt-textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 8px;
                    font-size: 0.8rem;
                    color: var(--n-text, #1e293b);
                    background: var(--n-bg, #f8fafc);
                    resize: vertical;
                    font-family: inherit;
                    box-sizing: border-box;
                }

                .mt-textarea:focus {
                    outline: none;
                    border-color: var(--n-primary, #3083ff);
                }

                :global(.dark) .mt-textarea {
                    background: rgba(0, 0, 0, 0.2);
                    border-color: rgba(255, 255, 255, 0.1);
                    color: #e2e8f0;
                }

                .mt-edit-actions {
                    display: flex;
                    gap: 6px;
                }

                .mt-btn-save {
                    background: linear-gradient(135deg, var(--n-primary, #3083ff) 0%, #c2185b 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 14px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                }

                .mt-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

                .mt-btn-cancel {
                    background: transparent;
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 6px;
                    padding: 6px 12px;
                    font-size: 0.75rem;
                    color: var(--n-text-secondary, #64748b);
                    cursor: pointer;
                }

                /* Snackbar */
                .mt-snackbar {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                    animation: slideUp 0.3s ease;
                }

                .mt-snackbar.success {
                    background: linear-gradient(135deg, #16a34a, #15803d);
                    color: white;
                }

                .mt-snackbar.error {
                    background: linear-gradient(135deg, #dc2626, #b91c1c);
                    color: white;
                }

                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                /* Loading */
                .mt-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    gap: 12px;
                    color: var(--n-text-secondary, #64748b);
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--n-border, #e2e8f0);
                    border-top-color: var(--n-primary, #3083ff);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 600px) {
                    .mt-container { padding: 12px; }
                    .mt-item-row { flex-wrap: wrap; }
                    .mt-snackbar { bottom: 16px; right: 16px; left: 16px; }
                }
            `}</style>
        </div>
    );
}
