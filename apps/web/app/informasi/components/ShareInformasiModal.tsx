'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAlert } from '@/components/ui/AlertProvider';
import '../informasi.css';

export interface ShareTarget {
    scope: 'folder' | 'file';
    division?: string;
    folder?: string;
    docId?: string;
    label: string;
}

interface PublicLink {
    id: string;
    token: string;
    label: string | null;
    expires_at: string | null;
    revoked: boolean;
    view_count: number;
    created_at: string;
    created_by_name: string | null;
}

export function buildInternalShareUrl(target: ShareTarget, origin: string): string {
    const base = `${origin}/informasi`;
    if (target.scope === 'file') {
        return `${base}?doc=${encodeURIComponent(target.docId || '')}`;
    }
    const params = new URLSearchParams();
    if (target.division) params.set('div', target.division);
    params.set('folder', target.folder || '');
    return `${base}?${params.toString()}`;
}

export default function ShareInformasiModal({
    target,
    canManage,
    onClose,
}: {
    target: ShareTarget;
    canManage: boolean;
    onClose: () => void;
}) {
    const { showToast, showError, showConfirm } = useAlert();
    const [origin, setOrigin] = useState('');
    const [links, setLinks] = useState<PublicLink[]>([]);
    const [loadingLinks, setLoadingLinks] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const internalUrl = origin ? buildInternalShareUrl(target, origin) : '';

    const targetQuery = useCallback(() => {
        const p = new URLSearchParams({ scope: target.scope });
        if (target.scope === 'file') p.set('doc_id', target.docId || '');
        else {
            p.set('folder', target.folder || '');
            if (target.division) p.set('division', target.division);
        }
        return p.toString();
    }, [target]);

    const loadLinks = useCallback(async () => {
        if (!canManage) return;
        setLoadingLinks(true);
        try {
            const res = await fetch(`/api/informasi-akademik/share?${targetQuery()}`);
            const json = await res.json();
            if (json.ok) setLinks(json.data || []);
        } catch {
        } finally {
            setLoadingLinks(false);
        }
    }, [canManage, targetQuery]);

    useEffect(() => { loadLinks(); }, [loadLinks]);

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Link disalin', { type: 'success' });
        } catch {
            showError(text, 'Salin link ini secara manual');
        }
    };

    const shareWa = (text: string) => {
        const pesan = `${target.label}\n${text}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener');
    };

    const createLink = async () => {
        setCreating(true);
        try {
            const res = await fetch('/api/informasi-akademik/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: target.scope,
                    division: target.division,
                    folder: target.folder,
                    doc_id: target.docId,
                    label: target.label,
                }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal membuat link');
            setLinks(prev => [json.data, ...prev]);
            showToast('Link publik dibuat', { type: 'success' });
        } catch (e: any) {
            showError(e.message || 'Gagal membuat link publik');
        } finally {
            setCreating(false);
        }
    };

    const toggleLink = async (id: string, currentRevoked: boolean) => {
        const nextRevoked = !currentRevoked;
        try {
            const res = await fetch('/api/informasi-akademik/share', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, revoked: nextRevoked }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal mengubah status link');
            setLinks(prev => prev.map(l => (l.id === id ? { ...l, revoked: nextRevoked } : l)));
            showToast(nextRevoked ? 'Link publik dinonaktifkan' : 'Link publik diaktifkan', { type: 'success' });
        } catch (e: any) {
            showError(e.message || 'Gagal mengubah status link');
        }
    };

    const deleteLink = async (id: string) => {
        const ok = await showConfirm('Hapus link publik ini secara permanen dari riwayat?', {
            type: 'warning',
            confirmText: 'Hapus',
        });
        if (!ok) return;
        try {
            const res = await fetch(`/api/informasi-akademik/share?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus link');
            setLinks(prev => prev.filter(l => l.id !== id));
            showToast('Link publik dihapus', { type: 'success' });
        } catch (e: any) {
            showError(e.message || 'Gagal menghapus link');
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            size="md"
            title="Bagikan"
            subtitle={target.label}
            icon="share"
        >
            <ModalBody>
                <div className="ish-root">
                    <section className="ish-section">
                        <div className="ish-section__head">
                            <i className="bi bi-people-fill" />
                            <h4>Link Internal (Warga Madrasah)</h4>
                        </div>
                        <div className="ish-linkrow">
                            <input className="ish-url" readOnly value={internalUrl} onFocus={e => e.currentTarget.select()} />
                            <button className="ish-icon-btn" title="Salin link" onClick={() => copy(internalUrl)}>
                                <i className="bi bi-clipboard" />
                            </button>
                            <button className="ish-icon-btn ish-icon-btn--wa" title="Bagikan via WhatsApp" onClick={() => shareWa(internalUrl)}>
                                <i className="bi bi-whatsapp" />
                            </button>
                        </div>
                    </section>

                    {canManage ? (
                        <section className="ish-section">
                            <div className="ish-section__head">
                                <i className="bi bi-globe2" />
                                <h4>Link Publik (Tanpa Login)</h4>
                            </div>

                            <div className="ish-create">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    isLoading={creating}
                                    onClick={createLink}
                                    leftIcon={<i className="bi bi-link-45deg" />}
                                >
                                    Buat Link Publik
                                </Button>
                            </div>

                            {loadingLinks ? (
                                <p className="ish-empty">Memuat link…</p>
                            ) : links.length === 0 ? (
                                <p className="ish-empty">Belum ada link publik.</p>
                            ) : (
                                <ul className="ish-links">
                                    {links.map(l => {
                                        const url = `${origin}/info-link/${l.token}`;
                                        return (
                                            <li key={l.id} className={`ish-link ${l.revoked ? 'ish-link--inactive' : ''}`}>
                                                <div className="ish-link__header">
                                                    <span className={`ish-badge ${l.revoked ? 'ish-badge--inactive' : 'ish-badge--active'}`}>
                                                        <i className={`bi ${l.revoked ? 'bi-dash-circle-fill' : 'bi-check-circle-fill'}`} />
                                                        {l.revoked ? 'Nonaktif' : 'Aktif'}
                                                    </span>
                                                    <span className="ish-link__meta">
                                                        {l.view_count || 0}x dibuka{l.created_by_name ? ` • oleh ${l.created_by_name}` : ''}
                                                    </span>
                                                </div>
                                                <div className="ish-link__main">
                                                    <input
                                                        className={`ish-url ${l.revoked ? 'ish-url--inactive' : ''}`}
                                                        readOnly
                                                        value={url}
                                                        onFocus={e => e.currentTarget.select()}
                                                    />
                                                    <button
                                                        className="ish-icon-btn"
                                                        title="Salin link"
                                                        onClick={() => copy(url)}
                                                    >
                                                        <i className="bi bi-clipboard" />
                                                    </button>
                                                    <button
                                                        className="ish-icon-btn ish-icon-btn--wa"
                                                        title="Bagikan via WhatsApp"
                                                        onClick={() => shareWa(url)}
                                                    >
                                                        <i className="bi bi-whatsapp" />
                                                    </button>
                                                    <button
                                                        className={`ish-icon-btn ${l.revoked ? 'ish-icon-btn--toggle-inactive' : 'ish-icon-btn--toggle-active'}`}
                                                        title={l.revoked ? 'Aktifkan link publik' : 'Nonaktifkan link publik'}
                                                        onClick={() => toggleLink(l.id, l.revoked)}
                                                    >
                                                        <i className={`bi ${l.revoked ? 'bi-toggle2-off' : 'bi-toggle2-on'}`} />
                                                    </button>
                                                    <button
                                                        className="ish-icon-btn ish-icon-btn--danger"
                                                        title="Hapus link publik"
                                                        onClick={() => deleteLink(l.id)}
                                                    >
                                                        <i className="bi bi-trash" />
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    ) : (
                        <p className="ish-note">
                            Link publik hanya dapat dibuat oleh pengelola.
                        </p>
                    )}
                </div>
            </ModalBody>
            <ModalFooter align="end">
                <Button variant="cancel" onClick={onClose}>Tutup</Button>
            </ModalFooter>
        </Modal>
    );
}
