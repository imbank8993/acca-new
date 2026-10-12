'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import SearchableSelect, { type Option } from '@/components/ui/SearchableSelect';
import { swalSuccess, swalError } from '@/lib/swal-premium';
import { formatRoleDisplay } from '@/lib/auth';

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

const ROLE_ADMIN = ['ADMIN', 'ADMINISTRATOR'];

export default function PengaturanAksesTab({ headerTabs }: { headerTabs?: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState<AccessConfig>({
        allowedRoles: [...ROLE_ADMIN],
        allowedUsers: [],
    });

    const [dbRoles, setDbRoles] = useState<any[]>([]);
    const [rawUserList, setRawUserList] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cfgRes, rolesRes, usersRes] = await Promise.all([
                fetch('/api/notulensi-rapat/pengaturan').then(r => r.json()).catch(() => ({})),
                fetch('/api/admin/roles').then(r => r.json()).catch(() => ({})),
                fetch('/api/admin/users').then(r => r.json()).catch(() => ({})),
            ]);

            if (cfgRes.success && cfgRes.data) {
                setConfig({
                    allowedRoles: Array.isArray(cfgRes.data.allowedRoles) ? cfgRes.data.allowedRoles : [...ROLE_ADMIN],
                    allowedUsers: Array.isArray(cfgRes.data.allowedUsers) ? cfgRes.data.allowedUsers : [],
                });
            }

            if (rolesRes.ok && Array.isArray(rolesRes.data)) {
                setDbRoles(rolesRes.data);
            }
            if (usersRes.ok && Array.isArray(usersRes.data)) {
                setRawUserList(usersRes.data);
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            swalError('Error', 'Gagal memuat pengaturan akses');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const roleOptions: Option[] = useMemo(() => {
        return dbRoles
            .filter(r => !ROLE_ADMIN.includes(String(r.name || r.role || '').toUpperCase()))
            .map(r => {
                const name = String(r.name || r.role || '').toUpperCase();
                return {
                    value: name,
                    label: formatRoleDisplay(name),
                    subLabel: r.description ? r.description : `Role: ${name}`,
                };
            });
    }, [dbRoles]);

    const userOptions: Option[] = useMemo(() => {
        return rawUserList.map(u => {
            const roleStr = u.role || (Array.isArray(u.roles) ? u.roles[0] : '');
            const formattedRole = roleStr ? formatRoleDisplay(roleStr) : '';
            return {
                value: String(u.id || u.user_id || ''),
                label: u.nama || u.name || u.nama_lengkap || u.username || 'User',
                subLabel: u.nip ? `NIP: ${u.nip}` : u.nisn ? `NISN: ${u.nisn}` : formattedRole ? `Role: ${formattedRole}` : '',
            };
        });
    }, [rawUserList]);

    const handleRoleChange = (selected: string | number | (string | number)[]) => {
        const values = (Array.isArray(selected) ? selected : [selected]).map(String).filter(Boolean);
        setConfig(prev => ({
            ...prev,
            allowedRoles: Array.from(new Set([...ROLE_ADMIN, ...values])),
        }));
    };

    const handleRemoveRole = (roleKey: string) => {
        if (ROLE_ADMIN.includes(roleKey)) return;
        setConfig(prev => ({
            ...prev,
            allowedRoles: prev.allowedRoles.filter(r => r !== roleKey),
        }));
    };

    const handleUserChange = (selected: string | number | (string | number)[]) => {
        const ids = (Array.isArray(selected) ? selected : [selected]).map(String).filter(Boolean);
        const existingUsers = config.allowedUsers || [];
        const nextUsers: UserAccessItem[] = ids.map(id => {
            const foundExist = existingUsers.find(u => String(u.id) === id);
            if (foundExist) return foundExist;

            const foundRaw = rawUserList.find(u => String(u.id || u.user_id) === id);
            return {
                id,
                nama: foundRaw?.nama || foundRaw?.name || foundRaw?.nama_lengkap || 'Pengguna',
                role: foundRaw?.role || (Array.isArray(foundRaw?.roles) ? foundRaw.roles[0] : ''),
                nip: foundRaw?.nip || foundRaw?.nisn || '',
                username: foundRaw?.username || '',
            };
        });

        setConfig(prev => ({
            ...prev,
            allowedUsers: nextUsers,
        }));
    };

    const handleRemoveUser = (userId: string) => {
        setConfig(prev => ({
            ...prev,
            allowedUsers: prev.allowedUsers.filter(u => String(u.id) !== String(userId)),
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/notulensi-rapat/pengaturan', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.error || json.message || 'Gagal menyimpan pengaturan');
            }
            swalSuccess('Pengaturan hak akses berhasil disimpan!');
            fetchData();
        } catch (err: any) {
            swalError('Gagal', err.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Spinner variant="buble" />
            </div>
        );
    }

    const customRoles = config.allowedRoles.filter(r => !ROLE_ADMIN.includes(r));

    return (
        <div className="nr-root">
            {headerTabs}

            <div className="nr-akses-container">
                {/* ── HERO HEADER CARD ── */}
                <div className="nr-akses-hero">
                    <div className="nr-akses-hero-icon">
                        <i className="bi bi-shield-lock-fill" />
                    </div>
                    <div className="nr-akses-hero-content">
                        <h3 className="nr-akses-hero-title">
                            Pengaturan Hak Akses Kelola (CRUD) Notulensi Rapat
                        </h3>
                        <p className="nr-akses-hero-desc">
                            Tentukan siapa saja yang berwenang menambah, mengubah, mengedit status tindak lanjut, dan menghapus catatan notulensi rapat madrasah.
                        </p>

                        <div className="nr-akses-summary-pills">
                            <span className="nr-akses-summary-badge admin-fixed">
                                <i className="bi bi-shield-fill-check" />
                                Admin &amp; Administrator: Akses Penuh (Permanen)
                            </span>
                            <span className="nr-akses-summary-badge">
                                <i className="bi bi-people-fill" />
                                {customRoles.length} Role Tambahan
                            </span>
                            <span className="nr-akses-summary-badge">
                                <i className="bi bi-person-check-fill" />
                                {config.allowedUsers.length} Staf Khusus
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── SECURITY NOTE ── */}
                <div className="nr-akses-info-box">
                    <i className="bi bi-info-circle-fill" style={{ color: 'var(--n-primary, #3083FF)', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ lineHeight: '1.45' }}>
                        <strong>Catatan Keamanan:</strong> Role <strong>ADMIN</strong> &amp; <strong>ADMINISTRATOR</strong> secara otomatis memiliki hak kelola penuh bawaan sistem. Seluruh dewan guru dan staf lainnya tetap dapat membaca dan mencetak hasil rapat demi transparansi madrasah.
                    </div>
                </div>

                {/* ── SECTION 1: ROLE ACCESS ── */}
                <div className="nr-akses-section">
                    <div className="nr-akses-section-head">
                        <span className="nr-akses-section-icon">
                            <i className="bi bi-person-badge-fill" />
                        </span>
                        <h4 className="nr-akses-section-title">
                            1. Hak Kelola Berdasarkan Role (Jabatan)
                        </h4>
                    </div>
                    <p className="nr-akses-section-desc">
                        Semua pengguna dengan role terpilih akan otomatis memiliki wewenang mengelola notulensi rapat.
                    </p>

                    <SearchableSelect
                        multiple
                        options={roleOptions}
                        value={customRoles}
                        onChange={handleRoleChange}
                        placeholder="Pilih role (misal: Kepala Madrasah, KTU, Wkm Akademik)..."
                        itemLabel="role"
                    />

                    {customRoles.length > 0 && (
                        <div className="nr-akses-chips-wrap">
                            {customRoles.map(roleKey => (
                                <div key={roleKey} className="nr-akses-chip">
                                    <span className="nr-akses-chip-name">{formatRoleDisplay(roleKey)}</span>
                                    <span className="nr-akses-chip-meta">({roleKey})</span>
                                    <button
                                        type="button"
                                        className="nr-akses-chip-remove"
                                        onClick={() => handleRemoveRole(roleKey)}
                                        title={`Hapus wewenang role ${roleKey}`}
                                    >
                                        <i className="bi bi-x-lg" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── SECTION 2: SPECIFIC USER ACCESS ── */}
                <div className="nr-akses-section">
                    <div className="nr-akses-section-head">
                        <span className="nr-akses-section-icon">
                            <i className="bi bi-person-check-fill" />
                        </span>
                        <h4 className="nr-akses-section-title">
                            2. Hak Kelola Pengguna Khusus / Perorangan (Guru / Staf)
                        </h4>
                    </div>
                    <p className="nr-akses-section-desc">
                        Tunjuk staf atau guru tertentu (misalnya notulis terpilih dewan guru) yang bukan admin tetapi diberi wewenang mencatat dan memperbarui notulensi rapat.
                    </p>

                    <SearchableSelect
                        multiple
                        options={userOptions}
                        value={config.allowedUsers.map(u => u.id)}
                        onChange={handleUserChange}
                        placeholder="Cari nama guru atau NIP..."
                        itemLabel="pengguna"
                    />

                    {config.allowedUsers.length > 0 ? (
                        <div className="nr-akses-chips-wrap">
                            {config.allowedUsers.map(u => (
                                <div key={u.id} className="nr-akses-chip">
                                    <i className="bi bi-person-fill" style={{ color: 'var(--n-primary, #3083FF)' }} />
                                    <span className="nr-akses-chip-name">{u.nama}</span>
                                    {u.nip ? (
                                        <span className="nr-akses-chip-meta">({u.nip})</span>
                                    ) : u.role ? (
                                        <span className="nr-akses-chip-meta">[{formatRoleDisplay(u.role)}]</span>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="nr-akses-chip-remove"
                                        onClick={() => handleRemoveUser(u.id)}
                                        title={`Hapus wewenang ${u.nama}`}
                                    >
                                        <i className="bi bi-x-lg" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="nr-akses-empty-state">
                            <i className="bi bi-people" style={{ fontSize: '1.1rem' }} />
                            <span>Belum ada staf perorangan yang ditunjuk khusus. Akses saat ini mengikuti konfigurasi role di atas.</span>
                        </div>
                    )}
                </div>

                {/* ── FOOTER ACTIONS ── */}
                <div className="nr-akses-footer">
                    <Button
                        variant="secondary"
                        onClick={fetchData}
                        disabled={saving}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={saving}
                        leftIcon={<i className="bi bi-check-lg" />}
                    >
                        Simpan Pengaturan Akses
                    </Button>
                </div>
            </div>
        </div>
    );
}
