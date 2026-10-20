'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import SearchableSelect, { type Option } from '@/components/ui/SearchableSelect';
import { swalSuccess, swalError } from '@/lib/swal-premium';
import { formatRoleDisplay } from '@/lib/auth';
import { Trash2 } from 'lucide-react';

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
                {/* ── SECTION 1: ROLE ACCESS ── */}
                <div className="nr-akses-section">
                    <div className="nr-akses-section-head">
                        <span className="nr-akses-section-icon">
                            <i className="bi bi-person-badge-fill" />
                        </span>
                        <h4 className="nr-akses-section-title">
                            Berdasarkan jabatan
                        </h4>
                    </div>
                    <p className="nr-akses-section-desc">
                        Jabatan terpilih dapat membuat notulen. Setiap pembuat hanya dapat mengedit notulen buatannya sendiri.
                    </p>

                    <SearchableSelect
                        multiple
                        options={roleOptions}
                        value={customRoles}
                        onChange={handleRoleChange}
                        placeholder="Pilih jabatan..."
                        itemLabel="role"
                    />

                    {customRoles.length > 0 ? (
                        <ul className="nr-akses-list" aria-label="Jabatan dengan hak kelola">
                            {customRoles.map(roleKey => (
                                <li key={roleKey} className="nr-akses-list-row">
                                    <span className="nr-akses-list-name">{formatRoleDisplay(roleKey)}</span>
                                    <button
                                        type="button"
                                        className="nr-akses-list-remove"
                                        onClick={() => handleRemoveRole(roleKey)}
                                        title={`Hapus akses ${formatRoleDisplay(roleKey)}`}
                                        aria-label={`Hapus akses jabatan ${formatRoleDisplay(roleKey)}`}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="nr-akses-empty-state">Belum ada jabatan tambahan yang diberi akses.</div>
                    )}
                </div>

                {/* ── SECTION 2: SPECIFIC USER ACCESS ── */}
                <div className="nr-akses-section">
                    <div className="nr-akses-section-head">
                        <span className="nr-akses-section-icon">
                            <i className="bi bi-person-check-fill" />
                        </span>
                        <h4 className="nr-akses-section-title">
                            Pengguna tertentu
                        </h4>
                    </div>
                    <p className="nr-akses-section-desc">
                        Izinkan pengguna tertentu membuat notulen. Akses ini tidak membuka isi atau hak edit notulen milik orang lain.
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
                        <ul className="nr-akses-list" aria-label="Pengguna dengan hak kelola">
                            {config.allowedUsers.map(u => (
                                <li key={u.id} className="nr-akses-list-row">
                                    <div className="nr-akses-list-person">
                                        <span className="nr-akses-list-name">{u.nama}</span>
                                        {(u.nip || u.role) && (
                                            <span className="nr-akses-list-meta">
                                                {u.nip ? `NIP: ${u.nip}` : formatRoleDisplay(u.role || '')}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="nr-akses-list-remove"
                                        onClick={() => handleRemoveUser(u.id)}
                                        title={`Hapus akses ${u.nama}`}
                                        aria-label={`Hapus akses pengguna ${u.nama}`}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="nr-akses-empty-state">
                            <i className="bi bi-people" style={{ fontSize: '1.1rem' }} />
                            <span>Belum ada pengguna khusus. Akses mengikuti jabatan yang dipilih.</span>
                        </div>
                    )}

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
                            Simpan pengaturan
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
