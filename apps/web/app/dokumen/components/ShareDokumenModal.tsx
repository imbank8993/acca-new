'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAlert } from '@/components/ui/AlertProvider';
import '@/components/ui/share-links.css';

interface DokumenShareLink {
    id: string;
    token: string;
    revoked: boolean;
    view_count: number;
    created_at: string;
    created_by_name: string | null;
}

/**
 * Modal "Bagikan" untuk satu berkas di tab Dokumen Sekolah.
 *
 * Bentuknya meniru bagian "Link Publik" di modal Bagikan Informasi (kelas
 * `.ish-*` dari components/ui/share-links.css): buat link, salin, kirim ke WA,
 * nonaktifkan sementara, atau hapus. Link dibuka di /dokumen-link/<token> tanpa
 * login dan langsung menampilkan berkasnya.
 */
export default function ShareDokumenModal({
    doc,
    onClose,
}: {
    doc: { id: string; file_name: string; category_name?: string | null };
    onClose: () => void;
}) {
    const { showToast, showError, showConfirm } = useAlert();
    const [origin, setOrigin] = useState('');
    const [links, setLinks] = useState<DokumenShareLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const endpoint = `/api/uploaded-documents/${encodeURIComponent(doc.id)}/share`;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(endpoint);
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal memuat link');
            setLinks(json.data || []);
        } catch (e: any) {
            setError(e.message || 'Gagal memuat link');
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    useEffect(() => { load(); }, [load]);

    const urlOf = (l: DokumenShareLink) => `${origin}/dokumen-link/${l.token}`;

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Link disalin', { type: 'success' });
        } catch {
            showError(text, 'Salin link ini secara manual');
        }
    };

    const shareWa = (text: string) => {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${doc.file_name}\n${text}`)}`, '_blank', 'noopener');
    };

    const create = async () => {
        setCreating(true);
        try {
            const res = await fetch(endpoint, { method: 'POST' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal membuat link');
            setLinks(prev => [json.data, ...prev]);
            setError('');
            showToast('Link publik dibuat', { type: 'success' });
        } catch (e: any) {
            showError(e.message || 'Gagal membuat link publik');
        } finally {
            setCreating(false);
        }
    };

    const toggle = async (l: DokumenShareLink) => {
        try {
            const res = await fetch(`${endpoint}?linkId=${encodeURIComponent(l.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revoked: !l.revoked }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal mengubah status link');
            setLinks(prev => prev.map(x => (x.id === l.id ? { ...x, revoked: !l.revoked } : x)));
            showToast(l.revoked ? 'Link publik diaktifkan' : 'Link publik dinonaktifkan', { type: 'success' });
        } catch (e: any) {
            showError(e.message || 'Gagal mengubah status link');
        }
    };

    const remove = async (l: DokumenShareLink) => {
        const ok = await showConfirm('Hapus link publik ini? Orang yang memegang link tidak bisa membukanya lagi.', {
            type: 'warning',
            confirmText: 'Hapus',
        });
        if (!ok) return;
        try {
            const res = await fetch(`${endpoint}?linkId=${encodeURIComponent(l.id)}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menghapus link');
            setLinks(prev => prev.filter(x => x.id !== l.id));
            showToast('Link publik dihapus', { type: 'success' });
        } catch (e: any) {
            showError(e.message || 'Gagal menghapus link');
        }
    };

    return (
        <Modal open onClose={onClose} size="md" title="Bagikan Dokumen" subtitle={doc.file_name} icon="share" labelledBy="share-dokumen-title">
            <ModalBody>
                <div className="ish-root">
                    <section className="ish-section">
                        <div className="ish-section__head">
                            <i className="bi bi-globe2" />
                            <h4>Link Publik (Tanpa Login)</h4>
                        </div>
                        <p className="ish-note" style={{ margin: 0 }}>
                            Siapa pun yang memegang link dapat melihat dan mengunduh berkas ini. Nonaktifkan atau hapus link bila tidak diperlukan lagi.
                        </p>

                        <div className="ish-create">
                            <Button variant="primary" size="sm" isLoading={creating} onClick={create} leftIcon={<i className="bi bi-link-45deg" />}>
                                Buat Link Publik
                            </Button>
                        </div>

                        {loading ? (
                            <p className="ish-empty">Memuat link…</p>
                        ) : error ? (
                            <p className="ish-empty">{error}</p>
                        ) : links.length === 0 ? (
                            <p className="ish-empty">Belum ada link publik.</p>
                        ) : (
                            <ul className="ish-links">
                                {links.map(l => {
                                    const url = urlOf(l);
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
                                                    aria-label="Link publik"
                                                />
                                                <button className="ish-icon-btn" title="Salin link" onClick={() => copy(url)}>
                                                    <i className="bi bi-clipboard" />
                                                </button>
                                                <button className="ish-icon-btn ish-icon-btn--wa" title="Bagikan via WhatsApp" onClick={() => shareWa(url)}>
                                                    <i className="bi bi-whatsapp" />
                                                </button>
                                                <button
                                                    className={`ish-icon-btn ${l.revoked ? 'ish-icon-btn--toggle-inactive' : 'ish-icon-btn--toggle-active'}`}
                                                    title={l.revoked ? 'Aktifkan link publik' : 'Nonaktifkan link publik'}
                                                    onClick={() => toggle(l)}
                                                >
                                                    <i className={`bi ${l.revoked ? 'bi-toggle2-off' : 'bi-toggle2-on'}`} />
                                                </button>
                                                <button className="ish-icon-btn ish-icon-btn--danger" title="Hapus link publik" onClick={() => remove(l)}>
                                                    <i className="bi bi-trash" />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </ModalBody>
            <ModalFooter align="end">
                <Button variant="cancel" onClick={onClose}>Tutup</Button>
            </ModalFooter>
        </Modal>
    );
}
