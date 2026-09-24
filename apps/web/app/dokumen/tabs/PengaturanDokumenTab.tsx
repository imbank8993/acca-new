'use client';

import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { PageLoader } from '@/components/ui/Spinner';

interface UserAccessItem {
    id: string;
    nama: string;
    role?: string;
    nip?: string;
    username?: string;
}

interface AccessConfig {
    allowedRoles: string[];
    allowedUsers: UserAccessItem[];
}

const AVAILABLE_ROLES = [
    { key: 'ADMIN', label: 'Admin Utama', isDefaultAdmin: true },
    { key: 'ADMINISTRATOR', label: 'Administrator', isDefaultAdmin: true },
    { key: 'GURU', label: 'Guru / Tenaga Pendidik', isDefaultAdmin: false },
    { key: 'WALI_KELAS', label: 'Wali Kelas', isDefaultAdmin: false },
    { key: 'KEPALA_SEKOLAH', label: 'Kepala Sekolah / Madrasah', isDefaultAdmin: false },
    { key: 'BENDAHARA', label: 'Bendahara / Keuangan', isDefaultAdmin: false },
    { key: 'STAF', label: 'Staf / Tata Usaha', isDefaultAdmin: false },
    { key: 'SISWA', label: 'Siswa / Peserta Didik', isDefaultAdmin: false },
    { key: 'ORANG_TUA', label: 'Orang Tua / Wali Siswa', isDefaultAdmin: false },
];

export default function PengaturanDokumenTab({ user, onConfigSaved }: { user?: any; onConfigSaved?: () => void }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allowedRoles, setAllowedRoles] = useState<string[]>(['ADMIN', 'ADMINISTRATOR']);
    const [allowedUsers, setAllowedUsers] = useState<UserAccessItem[]>([]);

    // User Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/site-settings?key=dokumen_access_config');
            const json = await res.json();
            
            if (json.ok && json.data) {
                let parsed: AccessConfig = { allowedRoles: ['ADMIN', 'ADMINISTRATOR'], allowedUsers: [] };
                try {
                    const raw = typeof json.data.value === 'string' ? JSON.parse(json.data.value) : json.data.value;
                    if (raw && typeof raw === 'object') {
                        parsed = {
                            allowedRoles: Array.isArray(raw.allowedRoles) ? raw.allowedRoles : ['ADMIN', 'ADMINISTRATOR'],
                            allowedUsers: Array.isArray(raw.allowedUsers) ? raw.allowedUsers : []
                        };
                    }
                } catch (e) {
                    console.error('Error parsing dokumen_access_config:', e);
                }
                
                // Ensure default admin roles are always included
                const rolesSet = new Set([...parsed.allowedRoles, 'ADMIN', 'ADMINISTRATOR']);
                setAllowedRoles(Array.from(rolesSet));
                setAllowedUsers(parsed.allowedUsers || []);
            }
        } catch (e) {
            console.error('Failed to load dokumen access config:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // Search users for specific access assignment
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingUsers(true);
            try {
                const res = await fetch(`/api/personal/users/search?q=${encodeURIComponent(searchQuery)}`);
                const json = await res.json();
                if (json.ok) {
                    setSearchResults(json.data || []);
                } else if (Array.isArray(json)) {
                    setSearchResults(json);
                }
            } catch (err) {
                console.error('Error searching users:', err);
            } finally {
                setSearchingUsers(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleToggleRole = (roleKey: string) => {
        if (roleKey === 'ADMIN' || roleKey === 'ADMINISTRATOR') return; // Cannot disable default admin roles
        setAllowedRoles(prev => 
            prev.includes(roleKey) ? prev.filter(r => r !== roleKey) : [...prev, roleKey]
        );
    };

    const handleAddUser = (targetUser: any) => {
        const uId = String(targetUser.id || targetUser.user_id || '');
        if (!uId) return;

        if (allowedUsers.some(u => String(u.id) === uId)) {
            Swal.fire('Info', 'Pengguna ini sudah terdaftar dalam daftar akses khusus', 'info');
            return;
        }

        const newItem: UserAccessItem = {
            id: uId,
            nama: targetUser.nama || targetUser.name || targetUser.nama_lengkap || 'Pengguna',
            role: targetUser.role || targetUser.roles?.[0] || '',
            nip: targetUser.nip || targetUser.nisn || '',
            username: targetUser.username || ''
        };

        setAllowedUsers(prev => [...prev, newItem]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveUser = (userId: string) => {
        setAllowedUsers(prev => prev.filter(u => String(u.id) !== String(userId)));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const configPayload: AccessConfig = {
                allowedRoles,
                allowedUsers
            };

            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'dokumen_access_config',
                    value: JSON.stringify(configPayload),
                    label: 'Pengaturan Akses Pusat Dokumen',
                    description: 'Daftar role dan pengguna yang diberikan akses penuh (full akses) untuk mengelola dokumen sekolah dan pengaturan.'
                })
            });

            const json = await res.json();
            if (json.ok) {
                Swal.fire('Berhasil!', 'Pengaturan akses Pusat Dokumen berhasil disimpan.', 'success');
                if (onConfigSaved) onConfigSaved();
            } else {
                throw new Error(json.error || 'Gagal menyimpan pengaturan');
            }
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Terjadi kesalahan saat menyimpan pengaturan', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageLoader minHeight="300px" dotsOnly size={18} />;
    }

    return (
        <div className="pdt-container">
            {/* Header info */}
            <div className="pdt-hero">
                <div className="pdt-hero-icon">
                    <i className="bi bi-shield-lock-fill"></i>
                </div>
                <div className="pdt-hero-text">
                    <h3>Pengaturan Akses Pengelola Dokumen</h3>
                    <p>Khusus Admin: Atur Role atau Pengguna tertentu agar memiliki hak akses pengelola (Kelola Dokumen) di Pusat Dokumen ini.</p>
                </div>
            </div>

            {/* Section 1: Akses Berdasarkan Role */}
            <div className="pdt-section">
                <div className="pdt-section-header">
                    <i className="bi bi-people-fill"></i>
                    <h4>Akses Berdasarkan Role (Peran)</h4>
                </div>
                <p className="pdt-section-desc">Pilih role yang diberikan wewenang untuk mengakses fitur Kelola Dokumen.</p>

                <div className="pdt-roles-grid">
                    {AVAILABLE_ROLES.map(role => {
                        const isChecked = allowedRoles.includes(role.key);
                        return (
                            <label
                                key={role.key}
                                className={`pdt-role-card ${isChecked ? 'active' : ''} ${role.isDefaultAdmin ? 'disabled' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={role.isDefaultAdmin}
                                    onChange={() => handleToggleRole(role.key)}
                                />
                                <div className="pdt-role-info">
                                    <span className="pdt-role-name">{role.label}</span>
                                    <span className="pdt-role-key">ROLE: {role.key}</span>
                                </div>
                                {role.isDefaultAdmin && (
                                    <span className="pdt-badge-default">Bawaan Admin</span>
                                )}
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Section 2: Akses Spesifik Pengguna */}
            <div className="pdt-section">
                <div className="pdt-section-header">
                    <i className="bi bi-person-check-fill"></i>
                    <h4>Akses Pengguna Khusus (User Level)</h4>
                </div>
                <p className="pdt-section-desc">Tambahkan pengguna spesifik yang diberikan akses penuh secara individu tanpa memandang role dasar mereka.</p>

                {/* User Search Input */}
                <div className="pdt-search-box">
                    <div className="pdt-search-input-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            placeholder="Cari nama pengguna atau NIP/NISN untuk menambahkan akses..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchingUsers && <span className="pdt-spinner"></span>}
                    </div>

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="pdt-search-dropdown">
                            {searchResults.map(u => (
                                <div
                                    key={u.id || u.user_id}
                                    className="pdt-search-item"
                                    onClick={() => handleAddUser(u)}
                                >
                                    <div className="pdt-user-avatar">
                                        <i className="bi bi-person-fill"></i>
                                    </div>
                                    <div className="pdt-user-detail">
                                        <span className="pdt-user-name">{u.nama || u.name || u.nama_lengkap}</span>
                                        <span className="pdt-user-meta">
                                            {u.role && `[${u.role}] `}
                                            {u.nip ? `NIP: ${u.nip}` : u.nisn ? `NISN: ${u.nisn}` : `@${u.username || ''}`}
                                        </span>
                                    </div>
                                    <button className="pdt-btn-add">
                                        <i className="bi bi-plus-lg"></i> Tambah
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* List of Users with Specific Access */}
                <div className="pdt-user-list">
                    {allowedUsers.length === 0 ? (
                        <div className="pdt-empty-users">
                            <i className="bi bi-person-dash"></i>
                            <p>Belum ada pengguna khusus yang ditambahkan. Gunakan kolom pencarian di atas untuk menambahkan pengguna.</p>
                        </div>
                    ) : (
                        allowedUsers.map(u => (
                            <div key={u.id} className="pdt-user-chip">
                                <div className="pdt-chip-icon">
                                    <i className="bi bi-person-fill"></i>
                                </div>
                                <div className="pdt-chip-info">
                                    <span className="pdt-chip-name">{u.nama}</span>
                                    {u.role && <span className="pdt-chip-role">{u.role}</span>}
                                    {u.nip && <span className="pdt-chip-nip">({u.nip})</span>}
                                </div>
                                <button
                                    className="pdt-chip-remove"
                                    onClick={() => handleRemoveUser(u.id)}
                                    title="Hapus akses pengguna ini"
                                >
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="pdt-actions">
                <button
                    className="pdt-btn-save"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <span className="pdt-spinner"></span>
                            Menyimpan...
                        </>
                    ) : (
                        <>
                            <i className="bi bi-check2-circle"></i>
                            Simpan Pengaturan Akses
                        </>
                    )}
                </button>
            </div>

            <style jsx>{`
                .pdt-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* HERO */
                .pdt-hero {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px 24px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 16px;
                    box-shadow: var(--n-shadow-soft);
                }
                .pdt-hero-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--n-primary, #3b82f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    flex-shrink: 0;
                }
                .pdt-hero-text h3 {
                    margin: 0 0 4px 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }
                .pdt-hero-text p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--n-muted, #64748b);
                    line-height: 1.4;
                }

                /* SECTION */
                .pdt-section {
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 16px;
                    padding: 20px 24px;
                    box-shadow: var(--n-shadow-soft);
                }
                .pdt-section-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 4px;
                }
                .pdt-section-header i {
                    font-size: 1.2rem;
                    color: var(--n-primary, #3b82f6);
                }
                .pdt-section-header h4 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }
                .pdt-section-desc {
                    margin: 0 0 16px 0;
                    font-size: 0.78rem;
                    color: var(--n-muted, #64748b);
                }

                /* ROLES GRID */
                .pdt-roles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                    gap: 12px;
                }
                .pdt-role-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    background: var(--n-soft, #f8fafc);
                    border: 1.5px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .pdt-role-card.active {
                    background: rgba(59, 130, 246, 0.05);
                    border-color: var(--n-primary, #3b82f6);
                }
                .pdt-role-card.disabled {
                    cursor: not-allowed;
                    opacity: 0.85;
                }
                .pdt-role-card input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--n-primary, #3b82f6);
                    cursor: pointer;
                }
                .pdt-role-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex: 1;
                }
                .pdt-role-name {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-ink, #0f172a);
                }
                .pdt-role-key {
                    font-size: 0.68rem;
                    color: var(--n-muted, #64748b);
                    font-weight: 500;
                }
                .pdt-badge-default {
                    font-size: 0.65rem;
                    font-weight: 700;
                    background: rgba(59, 130, 246, 0.12);
                    color: var(--n-primary, #3b82f6);
                    padding: 3px 8px;
                    border-radius: 6px;
                }

                /* SEARCH BOX */
                .pdt-search-box {
                    position: relative;
                    margin-bottom: 16px;
                }
                .pdt-search-input-wrap {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 16px;
                    background: var(--n-soft, #f8fafc);
                    border: 1.5px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    transition: border-color 0.2s;
                }
                .pdt-search-input-wrap:focus-within {
                    border-color: var(--n-primary, #3b82f6);
                }
                .pdt-search-input-wrap i {
                    color: var(--n-muted, #64748b);
                }
                .pdt-search-input-wrap input {
                    flex: 1;
                    border: none;
                    background: transparent;
                    font-size: 0.88rem;
                    outline: none;
                    color: var(--n-ink, #0f172a);
                    font-family: inherit;
                }
                .pdt-search-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 6px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 14px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                    max-height: 240px;
                    overflow-y: auto;
                    z-index: 100;
                }
                .pdt-search-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--n-border, #e2e8f0);
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .pdt-search-item:last-child {
                    border-bottom: none;
                }
                .pdt-search-item:hover {
                    background: var(--n-soft, #f8fafc);
                }
                .pdt-user-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--n-primary, #3b82f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    flex-shrink: 0;
                }
                .pdt-user-detail {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    min-width: 0;
                }
                .pdt-user-name {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-ink, #0f172a);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .pdt-user-meta {
                    font-size: 0.72rem;
                    color: var(--n-muted, #64748b);
                }
                .pdt-btn-add {
                    padding: 6px 12px;
                    background: var(--n-primary, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                /* USER LIST CHIPS */
                .pdt-user-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .pdt-empty-users {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 16px;
                    background: var(--n-soft, #f8fafc);
                    border: 1px dashed var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    width: 100%;
                    color: var(--n-muted, #64748b);
                    font-size: 0.8rem;
                }
                .pdt-empty-users i {
                    font-size: 1.2rem;
                }
                .pdt-user-chip {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: var(--n-soft, #f8fafc);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 10px;
                }
                .pdt-chip-icon {
                    color: var(--n-primary, #3b82f6);
                    font-size: 0.9rem;
                }
                .pdt-chip-info {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .pdt-chip-name {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--n-ink, #0f172a);
                }
                .pdt-chip-role {
                    font-size: 0.65rem;
                    font-weight: 700;
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--n-primary, #3b82f6);
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .pdt-chip-nip {
                    font-size: 0.72rem;
                    color: var(--n-muted, #64748b);
                }
                .pdt-chip-remove {
                    background: transparent;
                    border: none;
                    color: var(--n-muted, #64748b);
                    cursor: pointer;
                    width: 22px;
                    height: 22px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    margin-left: 4px;
                }
                .pdt-chip-remove:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                /* ACTIONS */
                .pdt-actions {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 8px;
                }
                .pdt-btn-save {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: var(--n-primary, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                }
                .pdt-btn-save:hover:not(:disabled) {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
                }
                .pdt-btn-save:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .pdt-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: pdtSpin 0.75s linear infinite;
                    display: inline-block;
                }
                @keyframes pdtSpin { to { transform: rotate(360deg); } }

                /* DARK MODE */
                :global(.dark) .pdt-hero,
                :global(.dark) .pdt-section {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                }
                :global(.dark) .pdt-hero-text h3,
                :global(.dark) .pdt-section-header h4,
                :global(.dark) .pdt-role-name,
                :global(.dark) .pdt-user-name,
                :global(.dark) .pdt-chip-name {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .pdt-hero-text p,
                :global(.dark) .pdt-section-desc,
                :global(.dark) .pdt-role-key,
                :global(.dark) .pdt-user-meta,
                :global(.dark) .pdt-chip-nip {
                    color: #94a3b8 !important;
                }
                :global(.dark) .pdt-role-card,
                :global(.dark) .pdt-search-input-wrap,
                :global(.dark) .pdt-empty-users,
                :global(.dark) .pdt-user-chip {
                    background: #000000 !important;
                    border-color: rgba(59, 130, 246, 0.35) !important;
                }
                :global(.dark) .pdt-role-card.active {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .pdt-search-dropdown {
                    background: #000000 !important;
                    border-color: rgba(59, 130, 246, 0.5) !important;
                }
                :global(.dark) .pdt-search-item {
                    border-bottom-color: rgba(59, 130, 246, 0.2) !important;
                }
                :global(.dark) .pdt-search-item:hover {
                    background: rgba(26, 115, 232, 0.12) !important;
                }
                :global(.dark) .pdt-search-input-wrap input {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .pdt-btn-save {
                    background: #1a73e8 !important;
                    border: 1.5px solid #3b82f6 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important;
                }
            `}</style>
        </div>
    );
}
