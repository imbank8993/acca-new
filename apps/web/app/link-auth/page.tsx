'use client';

import { useState } from 'react';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Swal from 'sweetalert2';

export default function LinkAuthPage() {
    const [loading, setLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    const handleLink = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users/link-auth', { method: 'GET' });
            const data = await res.json();

            if (!data.ok) {
                Swal.fire('Error', data.error || 'Gagal mengambil data', 'error');
                return;
            }

            setDebugInfo(data);

            // Check if current user already linked
            if (data.hasThisAuthId > 0) {
                Swal.fire('Info', 'Akun Anda sudah ter-link dengan user di database.', 'info');
                return;
            }

            if (data.nullAuthIdCount === 0) {
                Swal.fire('Info', 'Tidak ada user yang perlu di-link.', 'info');
                return;
            }

            // Find the current user's email in the list
            const email = data.currentUserEmail?.replace('@acca.local', '');

            Swal.fire({
                title: 'Link Akun Anda',
                html: `
                    <p style="text-align:left; font-size:14px; margin-bottom:10px;">
                        <b>Email login:</b> ${data.currentUserEmail}<br/>
                        <b>Auth ID:</b> ${data.currentAuthId?.slice(0, 8)}...<br/>
                        <b>User tanpa auth_id:</b> ${data.nullAuthIdCount} user<br/><br/>
                        Masukkan <b>username</b> atau <b>NIP</b> akun Anda untuk di-link dengan auth ini:
                    </p>
                    <input id="swal-input-username" class="swal2-input" placeholder="Username (cth: 199208302023212038)" style="font-size:13px;">
                    <p style="text-align:left; font-size:12px; color:#666; margin-top:5px;">atau</p>
                    <input id="swal-input-nip" class="swal2-input" placeholder="NIP" style="font-size:13px;">
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Link Sekarang',
                cancelButtonText: 'Batal',
                preConfirm: () => {
                    const username = (Swal.getPopup()?.querySelector('#swal-input-username') as HTMLInputElement)?.value?.trim();
                    const nip = (Swal.getPopup()?.querySelector('#swal-input-nip') as HTMLInputElement)?.value?.trim();
                    return { username, nip };
                }
            }).then(async (result) => {
                if (result.isConfirmed && (result.value?.username || result.value?.nip)) {
                    const linkRes = await fetch('/api/admin/users/link-auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(result.value)
                    });
                    const linkData = await linkRes.json();

                    if (linkData.ok) {
                        Swal.fire('Berhasil!', linkData.message, 'success').then(() => {
                            window.location.reload();
                        });
                    } else {
                        Swal.fire('Gagal', linkData.error || 'Terjadi kesalahan', 'error');
                    }
                }
            });
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MaintenanceBanner pageKey="maintenance_link_auth">
        <div style={{ maxWidth: 600, margin: '40px auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: 32,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: '#eff6ff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <span style={{ fontSize: 32 }}>🔗</span>
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--n-text)' }}>Link Akun Auth</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--n-muted)', fontSize: '0.9rem' }}>
                        Hubungkan session login Anda dengan data user di database
                    </p>
                </div>

                <button
                    onClick={handleLink}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '14px 24px',
                        background: '#3083FF',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        transition: 'all 0.2s'
                    }}
                >
                    {loading ? 'Memproses...' : '🔗 Link Akun Saya'}
                </button>

                {debugInfo && (
                    <div style={{
                        marginTop: 20,
                        padding: 16,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontFamily: 'monospace'
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--n-text)' }}>Debug Info:</div>
                        <div>Current Auth ID: <span style={{ color: '#3083FF' }}>{debugInfo.currentAuthId}</span></div>
                        <div>Current Email: {debugInfo.currentUserEmail}</div>
                        <div>Has This Auth ID: <span style={{ color: debugInfo.hasThisAuthId > 0 ? 'green' : 'red' }}>{debugInfo.hasThisAuthId}</span></div>
                        <div>Null auth_id count: <span style={{ color: debugInfo.nullAuthIdCount > 0 ? 'orange' : 'green' }}>{debugInfo.nullAuthIdCount}</span></div>

                        {debugInfo.allUsers?.length > 0 && (
                            <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
                                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--n-text)' }}>Users (dari DB):</div>
                                {debugInfo.allUsers.map((u: any) => (
                                    <div key={u.id} style={{
                                        padding: '6px 8px',
                                        background: u.auth_id === debugInfo.currentAuthId ? '#dcfce7' :
                                            !u.auth_id ? '#fef9c3' : 'white',
                                        borderRadius: 6,
                                        marginBottom: 4,
                                        display: 'flex',
                                        gap: 8,
                                        fontSize: '0.75rem'
                                    }}>
                                        <span style={{ fontWeight: 600, minWidth: 120 }}>{u.username}</span>
                                        <span style={{ color: 'var(--n-muted)' }}>{u.nip || '-'}</span>
                                        <span style={{
                                            color: u.auth_id === debugInfo.currentAuthId ? 'green' :
                                                !u.auth_id ? 'orange' : '#94a3b8',
                                            fontWeight: 500
                                        }}>
                                            {u.auth_id === debugInfo.currentAuthId ? '✓ (YOU)' :
                                                !u.auth_id ? 'NULL' : u.auth_id?.slice(0, 8) + '...'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        </MaintenanceBanner>
    );
}
