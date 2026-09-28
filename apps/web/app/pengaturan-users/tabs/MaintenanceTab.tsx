'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { mutate } from 'swr';
import { MENU_GROUPS, PAGE_LABELS, type MenuGroupDef, humanize } from '@/lib/sidebar-menu';
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

interface DiscoveredPage {
    id: string;
    label: string;
    icon: string;
    color: string;
    path: string;
}

interface PageItem {
    key: string;
    setting: MaintenanceSetting;
    label: string;
    pageId?: string;
    groupLabel?: string;
    groupIcon?: string;
    path?: string;
    isFromMenu: boolean;
}

interface MainGroupDef {
    id: 'menu_pages' | 'other_pages';
    title: string;
    subtitle: string;
    icon: string;
    items: PageItem[];
}

// Halaman yang key maintenance-nya berbeda dari pola default `maintenance_<id>`.
// Harus cocok dengan pageKey pada <MaintenanceBanner> di tiap halaman.
const MAINTENANCE_KEY_OVERRIDE: Record<string, string> = {
    'informasi-akademik': 'maintenance_informasi_akademik',
    'agenda-madrasah': 'maintenance_agenda_akademik',
    'dokumen': 'maintenance_dokumen_siswa',
    'observasi-kelas': 'maintenance_observasi_kelas',
    'pembayaran': 'maintenance_pembayaran',
};

let globalAutoCreateAttempted = false;

export default function MaintenanceTab({ user }: { user?: any }) {
    const [settings, setSettings] = useState<MaintenanceSetting[]>([]);
    const [settingsTerbaca, setSettingsTerbaca] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['menu_pages', 'other_pages']));
    const [searchQuery, setSearchQuery] = useState('');
    const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
    const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

    // Sumber susunan halaman — SAMA dengan tab "Susun Menu" (lib/sidebar-menu + /api/menu-layout)
    const [menuGroups, setMenuGroups] = useState<MenuGroupDef[]>([]);
    const [menuLabels, setMenuLabels] = useState<Record<string, string>>({});

    // Inline edit pesan maintenance
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingMsg, setEditingMsg] = useState('');
    const [savingMsg, setSavingMsg] = useState(false);

    // Nama tampilan halaman — sama persis dengan tab "Susun Menu" (label kustom > PAGE_LABELS > humanize)
    const effLabel = useCallback((id: string) => {
        return menuLabels[id] ?? PAGE_LABELS[id] ?? humanize(id);
    }, [menuLabels]);

    // Page id → key setting maintenance
    const keyOf = useCallback((id: string) => {
        return MAINTENANCE_KEY_OVERRIDE[id] ?? `maintenance_${id.replace(/-/g, '_')}`;
    }, []);

    // Pembersih label untuk halaman di luar menu
    const cleanLabelFromKey = useCallback((key: string, existingLabel?: string | null): string => {
        if (existingLabel && !existingLabel.startsWith('maintenance_') && !existingLabel.startsWith('maintenance-')) {
            return existingLabel;
        }
        const stripped = key.replace(/^maintenance_/, '').replace(/^maintenance-/, '');
        if (PAGE_LABELS[stripped]) return PAGE_LABELS[stripped];
        const hyphens = stripped.replace(/_/g, '-');
        if (PAGE_LABELS[hyphens]) return PAGE_LABELS[hyphens];
        return stripped
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }, []);

    const showSnackbar = (msg: string, type: 'success' | 'error') => {
        setSnackbar({ msg, type });
        setTimeout(() => setSnackbar(null), 3000);
    };

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch('/api/site-settings');
            const json = await res.json();
            if (json.ok) {
                setSettings(json.data || []);
                setSettingsTerbaca(true);
            } else {
                setSettingsTerbaca(false);
                showSnackbar(json.message || json.error || 'Gagal mengambil data pengaturan', 'error');
            }
        } catch {
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
                if (Array.isArray(d.layout)) setMenuGroups(d.layout.length ? d.layout : MENU_GROUPS);
                if (d.labels && typeof d.labels === 'object') setMenuLabels(d.labels);
            }
        } catch (e) {
            console.error('Failed to fetch menu layout:', e);
        }
    }, []);

    const reloadAll = useCallback(() => {
        setLoading(true);
        Promise.all([fetchSettings(), fetchDiscoveredPages(), fetchMenuLayout()]).finally(() => {
            setLoading(false);
            showSnackbar('Data berhasil dimuat ulang', 'success');
        });
    }, [fetchSettings, fetchDiscoveredPages, fetchMenuLayout]);

    useEffect(() => {
        fetchSettings();
        fetchDiscoveredPages();
        fetchMenuLayout();
    }, [fetchSettings, fetchDiscoveredPages, fetchMenuLayout]);

    // Membangun 2 KELOMPOK HALAMAN:
    // Kelompok 1: Halaman yang tercatat di Susun Menu (sesuai judul & urutan Susun Menu)
    // Kelompok 2: Halaman lainnya yang tidak tercatat di Susun Menu
    const { menuPages, otherPages } = useMemo(() => {
        const byKey: Record<string, MaintenanceSetting> = {};
        settings.forEach(s => {
            byKey[s.key] = s;
            const bare = s.key.replace(/^maintenance_/, '');
            if (!byKey[bare]) byKey[bare] = s;
        });

        const discoveredMap = new Map<string, DiscoveredPage>();
        discoveredPages.forEach(p => {
            discoveredMap.set(p.id, p);
        });

        const usedKeys = new Set<string>();
        const usedPageIds = new Set<string>();

        // ──────────────────────────────────────────────────────────
        // 1. KELOMPOK 1: Tercatat di Susun Menu
        // ──────────────────────────────────────────────────────────
        const effectiveLayout = menuGroups.length > 0 ? menuGroups : MENU_GROUPS;
        const list1: PageItem[] = [];

        effectiveLayout.forEach(g => {
            g.pages.forEach(pageId => {
                const k = keyOf(pageId);
                usedPageIds.add(pageId);
                usedKeys.add(k);

                const s = byKey[k] || byKey[`maintenance_${pageId.replace(/-/g, '_')}`] || byKey[pageId];
                if (s) {
                    usedKeys.add(s.key);
                }

                // Judul halaman PERSIS mengikuti tab Susun Menu
                const label = effLabel(pageId);
                const setting: MaintenanceSetting = s || {
                    id: 0,
                    key: k,
                    label,
                    description: `Halaman ${label}`,
                    value: 'false',
                    message: `Halaman ${label} sedang dalam pemeliharaan`,
                    updated_at: new Date().toISOString()
                };

                list1.push({
                    key: setting.key,
                    setting,
                    label,
                    pageId,
                    groupLabel: g.label,
                    groupIcon: g.icon,
                    path: discoveredMap.get(pageId)?.path || `/${pageId}`,
                    isFromMenu: true
                });
            });
        });

        // ──────────────────────────────────────────────────────────
        // 2. KELOMPOK 2: Tidak Tercatat di Susun Menu
        // ──────────────────────────────────────────────────────────
        const list2: PageItem[] = [];

        // 2a. Halaman belum dikelompokkan dari PAGE_LABELS
        Object.keys(PAGE_LABELS).forEach(id => {
            if (usedPageIds.has(id)) return;
            const k = keyOf(id);
            if (usedKeys.has(k)) return;

            usedPageIds.add(id);
            usedKeys.add(k);
            const s = byKey[k] || byKey[`maintenance_${id.replace(/-/g, '_')}`] || byKey[id];
            if (s) usedKeys.add(s.key);

            const label = PAGE_LABELS[id] || humanize(id);
            const setting: MaintenanceSetting = s || {
                id: 0,
                key: k,
                label,
                description: `Halaman ${label}`,
                value: 'false',
                message: `Halaman ${label} sedang dalam pemeliharaan`,
                updated_at: new Date().toISOString()
            };

            list2.push({
                key: setting.key,
                setting,
                label,
                pageId: id,
                groupLabel: 'Luar Menu',
                groupIcon: 'fa-folder',
                path: discoveredMap.get(id)?.path || `/${id}`,
                isFromMenu: false
            });
        });

        // 2b. Discovered pages dari file system /api/pages yang belum masuk
        discoveredPages.forEach(p => {
            if (usedPageIds.has(p.id)) return;
            const k = keyOf(p.id);
            if (usedKeys.has(k)) return;

            usedPageIds.add(p.id);
            usedKeys.add(k);
            const s = byKey[k] || byKey[`maintenance_${p.id.replace(/-/g, '_')}`] || byKey[p.id];
            if (s) usedKeys.add(s.key);

            const label = p.label || PAGE_LABELS[p.id] || humanize(p.id);
            const setting: MaintenanceSetting = s || {
                id: 0,
                key: k,
                label,
                description: `Deteksi halaman: ${p.path}`,
                value: 'false',
                message: `Halaman ${label} sedang dalam pemeliharaan`,
                updated_at: new Date().toISOString()
            };

            list2.push({
                key: setting.key,
                setting,
                label,
                pageId: p.id,
                groupLabel: 'Rute Sistem',
                groupIcon: 'fa-folder-tree',
                path: p.path,
                isFromMenu: false
            });
        });

        // 2c. Sisa setting maintenance_* yang ada di basis data
        settings.forEach(s => {
            if (!s.key.startsWith('maintenance_')) return;
            if (usedKeys.has(s.key)) return;

            usedKeys.add(s.key);
            const label = cleanLabelFromKey(s.key, s.label);

            list2.push({
                key: s.key,
                setting: s,
                label,
                pageId: s.key.replace(/^maintenance_/, ''),
                groupLabel: 'Sistem & Lainnya',
                groupIcon: 'fa-box-archive',
                path: s.description || undefined,
                isFromMenu: false
            });
        });

        // Urutkan kelompok 2 secara alfabetis agar rapi
        list2.sort((a, b) => a.label.localeCompare(b.label, 'id'));

        return { menuPages: list1, otherPages: list2 };
    }, [settings, discoveredPages, menuGroups, effLabel, keyOf, cleanLabelFromKey]);

    // Auto-create settings yang belum tersimpan di DB
    useEffect(() => {
        if (!loading && settingsTerbaca && !globalAutoCreateAttempted) {
            const existingKeys = new Set(settings.map(s => s.key));
            const allItems = [...menuPages, ...otherPages];
            const missingItems = allItems.filter(item => !existingKeys.has(item.key));

            if (missingItems.length > 0) {
                globalAutoCreateAttempted = true;
                Promise.all(missingItems.map(item => {
                    return fetch('/api/site-settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            key: item.key,
                            value: 'false',
                            message: `Halaman ${item.label} sedang dalam pemeliharaan`,
                            label: item.label,
                            description: item.setting.description || `Halaman ${item.label}`
                        })
                    });
                })).then(() => {
                    fetchSettings();
                }).catch(console.error);
            }
        }
    }, [loading, settingsTerbaca, settings, menuPages, otherPages, fetchSettings]);

    // Auto-expand kedua kelompok saat awal
    useEffect(() => {
        if (!loading && !hasAutoExpanded) {
            setHasAutoExpanded(true);
            setExpandedGroups(new Set(['menu_pages', 'other_pages']));
        }
    }, [loading, hasAutoExpanded]);

    // Filter berdasarkan pencarian
    const filteredGroups = useMemo<MainGroupDef[]>(() => {
        const q = searchQuery.toLowerCase().trim();

        const filterItems = (items: PageItem[]) => {
            if (!q) return items;
            return items.filter(item =>
                item.label.toLowerCase().includes(q) ||
                item.setting.key.toLowerCase().includes(q) ||
                (item.pageId && item.pageId.toLowerCase().includes(q)) ||
                (item.groupLabel && item.groupLabel.toLowerCase().includes(q)) ||
                (item.setting.description && item.setting.description.toLowerCase().includes(q))
            );
        };

        const items1 = filterItems(menuPages);
        const items2 = filterItems(otherPages);

        return [
            {
                id: 'menu_pages',
                title: 'Halaman Utama (Tercatat di Susun Menu)',
                subtitle: 'Halaman yang disusun dan aktif pada menu navigasi aplikasi',
                icon: 'fa-list-check',
                items: items1
            },
            {
                id: 'other_pages',
                title: 'Halaman Lainnya (Tidak Tercatat di Susun Menu)',
                subtitle: 'Halaman rute internal, fitur pendukung, dan halaman yang belum dikelompokkan',
                icon: 'fa-layer-group',
                items: items2
            }
        ];
    }, [menuPages, otherPages, searchQuery]);

    const handleToggle = async (setting: MaintenanceSetting) => {
        setSaving(setting.key);
        try {
            const newValue = setting.value === 'true' ? 'false' : 'true';
            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: setting.key,
                    value: newValue,
                    label: setting.label,
                    message: setting.message || `Halaman ${setting.label} sedang dalam pemeliharaan`,
                    description: setting.description || `Halaman ${setting.label}`
                }),
            });
            const json = await res.json();
            if (json.ok) {
                setSettings(prev => {
                    const exists = prev.some(s => s.key === setting.key);
                    if (exists) {
                        return prev.map(s => s.key === setting.key ? { ...s, value: newValue } : s);
                    } else {
                        return [...prev, { ...setting, value: newValue, id: json.data?.id || Date.now() }];
                    }
                });
                mutate('maintenance-banner-data');
                showSnackbar(`${setting.label} ${newValue === 'true' ? 'dikunci (Maintenance ON)' : 'dibuka (Maintenance OFF)'}`, 'success');
            } else {
                showSnackbar(json.message || json.error || 'Gagal mengubah status', 'error');
            }
        } catch {
            showSnackbar('Terjadi kesalahan koneksi', 'error');
        } finally {
            setSaving(null);
        }
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const getLockedCount = (items: PageItem[]) => {
        return items.filter(i => i.setting.value === 'true').length;
    };

    const startEditMessage = (item: PageItem) => {
        setEditingKey(item.key);
        setEditingMsg(item.setting.message || `Halaman ${item.label} sedang dalam pemeliharaan`);
    };

    const cancelEditMessage = () => {
        setEditingKey(null);
        setEditingMsg('');
    };

    const saveMessage = async (item: PageItem) => {
        if (!editingMsg.trim()) return;
        setSavingMsg(true);
        try {
            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: item.setting.key,
                    value: item.setting.value,
                    label: item.setting.label,
                    message: editingMsg.trim(),
                    description: item.setting.description
                }),
            });
            const json = await res.json();
            if (json.ok) {
                setSettings(prev => {
                    const exists = prev.some(s => s.key === item.setting.key);
                    if (exists) {
                        return prev.map(s => s.key === item.setting.key ? { ...s, message: editingMsg.trim() } : s);
                    } else {
                        return [...prev, { ...item.setting, message: editingMsg.trim(), id: json.data?.id || Date.now() }];
                    }
                });
                mutate('maintenance-banner-data');
                showSnackbar(`Pesan maintenance untuk ${item.label} berhasil disimpan`, 'success');
                setEditingKey(null);
            } else {
                showSnackbar(json.message || json.error || 'Gagal menyimpan pesan', 'error');
            }
        } catch {
            showSnackbar('Terjadi kesalahan', 'error');
        } finally {
            setSavingMsg(false);
        }
    };

    const totalMenuLocked = getLockedCount(menuPages);
    const totalOtherLocked = getLockedCount(otherPages);
    const totalLockedAll = totalMenuLocked + totalOtherLocked;
    const totalPagesAll = menuPages.length + otherPages.length;
    const searchResultTotal = searchQuery.trim()
        ? filteredGroups.reduce((acc, g) => acc + g.items.length, 0)
        : null;

    if (loading) {
        return <PageLoader minHeight="300px" variant="trace" />;
    }

    return (
        <div className="mt-container">
            {/* Banner Informasi */}
            <div className="mt-info">
                <i className="bi bi-shield-lock-fill"></i>
                <div className="mt-info-text">
                    <strong>Mode Pemeliharaan (Maintenance) Halaman</strong>
                    <span>Kunci halaman untuk membatasi akses pengguna biasa dengan pesan pemeliharaan. Administrator tetap dapat membuka dan mengakses seluruh halaman.</span>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="mt-stats-bar">
                <div className="mt-stat-item">
                    <span className="mt-stat-icon blue"><i className="fa-solid fa-list-check"></i></span>
                    <div className="mt-stat-info">
                        <span className="mt-stat-label">Susun Menu</span>
                        <span className="mt-stat-val">{menuPages.length} halaman</span>
                    </div>
                </div>
                <div className="mt-stat-item">
                    <span className="mt-stat-icon purple"><i className="fa-solid fa-layer-group"></i></span>
                    <div className="mt-stat-info">
                        <span className="mt-stat-label">Luar Menu</span>
                        <span className="mt-stat-val">{otherPages.length} halaman</span>
                    </div>
                </div>
                <div className="mt-stat-item">
                    <span className={`mt-stat-icon ${totalLockedAll > 0 ? 'red' : 'green'}`}>
                        <i className={`fa-solid ${totalLockedAll > 0 ? 'fa-lock' : 'fa-lock-open'}`}></i>
                    </span>
                    <div className="mt-stat-info">
                        <span className="mt-stat-label">Status Terkunci</span>
                        <span className="mt-stat-val">
                            {totalLockedAll > 0 ? `${totalLockedAll} terkunci` : 'Semua aktif'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Search & Action Bar */}
            <div className="mt-search">
                <i className="bi bi-search"></i>
                <input
                    type="text"
                    placeholder="Cari berdasarkan nama halaman, ID rute, grup menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="mt-search-clear" onClick={() => setSearchQuery('')} title="Hapus pencarian">
                        <i className="bi bi-x-lg"></i>
                    </button>
                )}
                {searchResultTotal !== null && (
                    <span className="mt-search-count">{searchResultTotal} hasil</span>
                )}
                <button className="mt-btn-reload" onClick={reloadAll} title="Muat ulang susunan menu & status maintenance">
                    <i className="bi bi-arrow-clockwise"></i>
                    <span>Muat Ulang</span>
                </button>
            </div>

            {/* 2 KELOMPOK UTAMA */}
            <div className="mt-list">
                {filteredGroups.map((group) => {
                    const lockedCount = getLockedCount(group.items);
                    const isExpanded = expandedGroups.has(group.id);
                    const isGroup1 = group.id === 'menu_pages';

                    return (
                        <div key={group.id} className={`mt-group ${isGroup1 ? 'group-menu' : 'group-other'}`}>
                            <button
                                className="mt-group-header"
                                onClick={() => toggleGroup(group.id)}
                                type="button"
                            >
                                <div className="mt-group-left">
                                    <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} mt-group-chevron`}></i>
                                    <span className={`mt-group-iconWrap ${isGroup1 ? 'icon-menu' : 'icon-other'}`}>
                                        <i className={`fa-solid ${group.icon}`}></i>
                                    </span>
                                    <div className="mt-group-titleWrap">
                                        <div className="mt-group-titleRow">
                                            <span className="mt-group-title">{group.title}</span>
                                            {lockedCount > 0 && (
                                                <span className="mt-group-badge">{lockedCount} dikunci</span>
                                            )}
                                        </div>
                                        <span className="mt-group-subtitle">{group.subtitle}</span>
                                    </div>
                                </div>
                                <div className="mt-group-right">
                                    <span className="mt-group-count">{group.items.length} halaman</span>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="mt-group-items">
                                    {group.items.length === 0 ? (
                                        <div className="mt-empty-group">
                                            <i className="bi bi-search"></i>
                                            <span>Tidak ada halaman yang cocok dengan pencarian</span>
                                        </div>
                                    ) : (
                                        group.items.map((item) => {
                                            const setting = item.setting;
                                            const isLocked = setting.value === 'true';
                                            const isSaving = saving === setting.key;
                                            const isEditingThisMsg = editingKey === item.key;

                                            return (
                                                <div key={item.key} className={`mt-item ${isLocked ? 'is-locked' : ''}`}>
                                                    <div className="mt-item-row">
                                                        <div className="mt-item-info">
                                                            <div className="mt-item-header">
                                                                <span className="mt-item-label">{item.label}</span>
                                                                {item.groupLabel && (
                                                                    <span className={`mt-cat-pill ${item.isFromMenu ? 'menu' : 'other'}`}>
                                                                        <i className={`fa-solid ${item.groupIcon || 'fa-folder'}`}></i>
                                                                        <span>{item.groupLabel}</span>
                                                                    </span>
                                                                )}
                                                                {isLocked && (
                                                                    <span className="mt-locked-tag">
                                                                        <i className="fa-solid fa-lock"></i> Maintenance Aktif
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="mt-item-meta">
                                                                <span className="mt-key-tag">
                                                                    <code>{item.pageId ? `ID: ${item.pageId}` : item.key}</code>
                                                                </span>
                                                                {item.path && item.path !== `/${item.pageId}` && (
                                                                    <span className="mt-path-tag">{item.path}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="mt-item-actions">
                                                            <label className="mt-toggle" title={isLocked ? 'Buka kunci halaman' : 'Kunci halaman (Mode Maintenance)'}>
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

                                                    {/* Panel Pesan Maintenance ketika halaman terkunci */}
                                                    {isLocked && (
                                                        <div className="mt-item-message-box">
                                                            {!isEditingThisMsg ? (
                                                                <div className="mt-message-preview">
                                                                    <div className="mt-msg-content">
                                                                        <i className="bi bi-info-circle"></i>
                                                                        <span><b>Pesan Pemeliharaan:</b> {setting.message || `Halaman ${item.label} sedang dalam pemeliharaan`}</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="mt-btn-edit-msg"
                                                                        onClick={() => startEditMessage(item)}
                                                                        title="Ubah teks pesan maintenance"
                                                                    >
                                                                        <i className="bi bi-pencil"></i> Ubah Pesan
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="mt-edit-form">
                                                                    <label className="mt-edit-label">Sesuaikan pesan pemeliharaan untuk pengguna:</label>
                                                                    <textarea
                                                                        className="mt-textarea"
                                                                        value={editingMsg}
                                                                        onChange={(e) => setEditingMsg(e.target.value)}
                                                                        rows={2}
                                                                        placeholder="Tulis pesan maintenance..."
                                                                    />
                                                                    <div className="mt-edit-actions">
                                                                        <button
                                                                            type="button"
                                                                            className="mt-btn-save"
                                                                            onClick={() => saveMessage(item)}
                                                                            disabled={savingMsg}
                                                                        >
                                                                            {savingMsg ? 'Menyimpan...' : 'Simpan Pesan'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="mt-btn-cancel"
                                                                            onClick={cancelEditMessage}
                                                                            disabled={savingMsg}
                                                                        >
                                                                            Batal
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Snackbar Notifikasi */}
            {snackbar && (
                <div className={`mt-snackbar ${snackbar.type}`}>
                    <i className={`bi ${snackbar.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                    {snackbar.msg}
                </div>
            )}

            <style jsx>{`
                .mt-container {
                    padding: 8px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                /* Banner Info */
                .mt-info {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    background: rgba(48, 131, 255, 0.08);
                    border: 1px solid rgba(48, 131, 255, 0.2);
                    border-radius: 12px;
                    padding: 14px 18px;
                    color: var(--n-primary, #3083ff);
                }

                .mt-info i {
                    font-size: 1.25rem;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .mt-info-text {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    font-size: 0.85rem;
                    line-height: 1.45;
                }

                .mt-info-text strong {
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }

                .mt-info-text span {
                    color: var(--n-muted, #64748b);
                }

                :global(.dark) .mt-info {
                    background: rgba(48, 131, 255, 0.12);
                    border-color: rgba(48, 131, 255, 0.3);
                }

                :global(.dark) .mt-info-text strong {
                    color: #93c5fd;
                }

                :global(.dark) .mt-info-text span {
                    color: #94a3b8;
                }

                /* Quick Stats Bar */
                .mt-stats-bar {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                }

                .mt-stat-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                }

                :global(.dark) .mt-stat-item {
                    background: #0f172a;
                    border-color: rgba(255, 255, 255, 0.08);
                }

                .mt-stat-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.95rem;
                    flex-shrink: 0;
                }

                .mt-stat-icon.blue {
                    background: rgba(48, 131, 255, 0.1);
                    color: #3083ff;
                }

                .mt-stat-icon.purple {
                    background: rgba(147, 51, 234, 0.1);
                    color: #a855f7;
                }

                .mt-stat-icon.red {
                    background: rgba(239, 68, 68, 0.12);
                    color: #ef4444;
                }

                .mt-stat-icon.green {
                    background: rgba(16, 185, 129, 0.12);
                    color: #10b981;
                }

                .mt-stat-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .mt-stat-label {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .mt-stat-val {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }

                :global(.dark) .mt-stat-val {
                    color: #f1f5f9;
                }

                /* Search Bar */
                .mt-search {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 14px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
                }

                :global(.dark) .mt-search {
                    background: #0f172a;
                    border-color: rgba(255, 255, 255, 0.08);
                }

                .mt-search i {
                    color: var(--n-muted, #94a3b8);
                    font-size: 0.9rem;
                }

                .mt-search input {
                    flex: 1;
                    border: none;
                    background: transparent;
                    font-size: 0.88rem;
                    color: var(--n-ink, #1e293b);
                    outline: none;
                }

                :global(.dark) .mt-search input {
                    color: #e2e8f0;
                }

                .mt-search-clear {
                    background: transparent;
                    border: none;
                    color: var(--n-muted, #94a3b8);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.15s;
                }

                .mt-search-clear:hover {
                    color: var(--n-ink, #1e293b);
                }

                .mt-search-count {
                    font-size: 0.75rem;
                    color: var(--n-primary, #3083ff);
                    background: rgba(48, 131, 255, 0.1);
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .mt-btn-reload {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: transparent;
                    border: 1px solid var(--n-border, #cbd5e1);
                    border-radius: 8px;
                    padding: 6px 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-muted, #475569);
                    cursor: pointer;
                    transition: all 0.15s;
                    white-space: nowrap;
                }

                .mt-btn-reload:hover {
                    background: rgba(48, 131, 255, 0.08);
                    border-color: var(--n-primary, #3083ff);
                    color: var(--n-primary, #3083ff);
                }

                :global(.dark) .mt-btn-reload {
                    border-color: rgba(255, 255, 255, 0.12);
                    color: #94a3b8;
                }

                /* Group Cards (2 Kelompok) */
                .mt-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .mt-group {
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
                    transition: border-color 0.2s;
                }

                :global(.dark) .mt-group {
                    background: #0f172a;
                    border-color: rgba(255, 255, 255, 0.08);
                }

                .mt-group.group-menu {
                    border-top: 3px solid #3083ff;
                }

                .mt-group.group-other {
                    border-top: 3px solid #a855f7;
                }

                .mt-group-header {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: background 0.15s;
                    text-align: left;
                }

                .mt-group-header:hover {
                    background: rgba(0, 0, 0, 0.015);
                }

                :global(.dark) .mt-group-header:hover {
                    background: rgba(255, 255, 255, 0.02);
                }

                .mt-group-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                }

                .mt-group-chevron {
                    font-size: 0.85rem;
                    color: var(--n-muted, #64748b);
                    transition: transform 0.2s;
                }

                .mt-group-iconWrap {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    flex-shrink: 0;
                }

                .mt-group-iconWrap.icon-menu {
                    background: rgba(48, 131, 255, 0.12);
                    color: #3083ff;
                }

                .mt-group-iconWrap.icon-other {
                    background: rgba(168, 85, 247, 0.12);
                    color: #a855f7;
                }

                .mt-group-titleWrap {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .mt-group-titleRow {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .mt-group-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                    letter-spacing: -0.01em;
                }

                :global(.dark) .mt-group-title {
                    color: #f1f5f9;
                }

                .mt-group-subtitle {
                    font-size: 0.76rem;
                    color: var(--n-muted, #64748b);
                }

                .mt-group-badge {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 20px;
                    box-shadow: 0 1px 3px rgba(239, 68, 68, 0.3);
                }

                .mt-group-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .mt-group-count {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                    background: var(--n-surface, #f1f5f9);
                    padding: 4px 10px;
                    border-radius: 20px;
                }

                :global(.dark) .mt-group-count {
                    background: rgba(255, 255, 255, 0.06);
                    color: #94a3b8;
                }

                .mt-group-items {
                    border-top: 1px solid var(--n-border, #e2e8f0);
                }

                :global(.dark) .mt-group-items {
                    border-color: rgba(255, 255, 255, 0.06);
                }

                .mt-empty-group {
                    padding: 32px 20px;
                    text-align: center;
                    color: var(--n-muted, #94a3b8);
                    font-size: 0.85rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }

                .mt-empty-group i {
                    font-size: 1.5rem;
                }

                /* Items */
                .mt-item {
                    padding: 12px 20px;
                    border-bottom: 1px solid var(--n-border, #f1f5f9);
                    transition: background 0.15s;
                }

                .mt-item:last-child {
                    border-bottom: none;
                }

                :global(.dark) .mt-item {
                    border-color: rgba(255, 255, 255, 0.04);
                }

                .mt-item.is-locked {
                    background: rgba(239, 68, 68, 0.03);
                }

                :global(.dark) .mt-item.is-locked {
                    background: rgba(239, 68, 68, 0.05);
                }

                .mt-item-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }

                .mt-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                }

                .mt-item-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .mt-item-label {
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }

                :global(.dark) .mt-item-label {
                    color: #f1f5f9;
                }

                .mt-cat-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: 6px;
                }

                .mt-cat-pill.menu {
                    background: rgba(48, 131, 255, 0.08);
                    color: #2563eb;
                    border: 1px solid rgba(48, 131, 255, 0.2);
                }

                :global(.dark) .mt-cat-pill.menu {
                    background: rgba(48, 131, 255, 0.15);
                    color: #93c5fd;
                    border-color: rgba(48, 131, 255, 0.3);
                }

                .mt-cat-pill.other {
                    background: rgba(168, 85, 247, 0.08);
                    color: #7c3aed;
                    border: 1px solid rgba(168, 85, 247, 0.2);
                }

                :global(.dark) .mt-cat-pill.other {
                    background: rgba(168, 85, 247, 0.15);
                    color: #c084fc;
                    border-color: rgba(168, 85, 247, 0.3);
                }

                .mt-locked-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 4px;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.25);
                }

                .mt-item-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .mt-key-tag code {
                    font-size: 0.72rem;
                    font-family: ui-monospace, monospace;
                    color: var(--n-muted, #64748b);
                    background: var(--n-surface, #f8fafc);
                    padding: 1px 6px;
                    border-radius: 4px;
                    border: 1px solid var(--n-border, #e2e8f0);
                }

                :global(.dark) .mt-key-tag code {
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 255, 255, 0.08);
                    color: #94a3b8;
                }

                .mt-path-tag {
                    font-size: 0.72rem;
                    color: var(--n-muted, #94a3b8);
                }

                .mt-item-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                }

                /* Toggle Switch */
                .mt-toggle {
                    position: relative;
                    display: inline-block;
                    width: 46px;
                    height: 26px;
                }

                .mt-toggle input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .mt-toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    inset: 0;
                    background: #cbd5e1;
                    border-radius: 26px;
                    transition: 0.25s ease;
                }

                :global(.dark) .mt-toggle-slider {
                    background: #334155;
                }

                .mt-toggle-slider::before {
                    content: '';
                    position: absolute;
                    height: 20px;
                    width: 20px;
                    left: 3px;
                    bottom: 3px;
                    background: white;
                    border-radius: 50%;
                    transition: 0.25s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
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

                /* Locked Message Box */
                .mt-item-message-box {
                    margin-top: 10px;
                    padding: 8px 12px;
                    background: rgba(239, 68, 68, 0.05);
                    border: 1px dashed rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                }

                :global(.dark) .mt-item-message-box {
                    background: rgba(239, 68, 68, 0.08);
                    border-color: rgba(239, 68, 68, 0.35);
                }

                .mt-message-preview {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    font-size: 0.78rem;
                }

                .mt-msg-content {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--n-ink, #1e293b);
                    flex: 1;
                }

                :global(.dark) .mt-msg-content {
                    color: #f1f5f9;
                }

                .mt-msg-content i {
                    color: #ef4444;
                    font-size: 0.9rem;
                    flex-shrink: 0;
                }

                .mt-btn-edit-msg {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: 1px solid rgba(48, 131, 255, 0.3);
                    border-radius: 6px;
                    padding: 3px 8px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-primary, #3083ff);
                    cursor: pointer;
                    transition: all 0.15s;
                    flex-shrink: 0;
                }

                .mt-btn-edit-msg:hover {
                    background: rgba(48, 131, 255, 0.08);
                    border-color: var(--n-primary, #3083ff);
                }

                .mt-edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .mt-edit-label {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                }

                .mt-textarea {
                    width: 100%;
                    padding: 6px 10px;
                    border: 1px solid var(--n-border, #cbd5e1);
                    border-radius: 6px;
                    font-size: 0.8rem;
                    color: var(--n-ink, #0f172a);
                    background: var(--n-card, #ffffff);
                    font-family: inherit;
                    resize: vertical;
                    outline: none;
                    box-sizing: border-box;
                }

                .mt-textarea:focus {
                    border-color: var(--n-primary, #3083ff);
                }

                :global(.dark) .mt-textarea {
                    background: #1e293b;
                    border-color: rgba(255, 255, 255, 0.1);
                    color: #f1f5f9;
                }

                .mt-edit-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .mt-btn-save {
                    background: #3083ff;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 0.74rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .mt-btn-save:hover {
                    background: #2563eb;
                }

                .mt-btn-cancel {
                    background: transparent;
                    border: 1px solid var(--n-border, #cbd5e1);
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 0.74rem;
                    color: var(--n-muted, #64748b);
                    cursor: pointer;
                }

                /* Snackbar */
                .mt-snackbar {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-size: 0.85rem;
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

                @media (max-width: 600px) {
                    .mt-item-row { flex-wrap: wrap; }
                    .mt-stats-bar { grid-template-columns: 1fr; }
                    .mt-search { flex-wrap: wrap; }
                    .mt-btn-reload { width: 100%; justify-content: center; }
                }
            `}</style>
        </div>
    );
}
