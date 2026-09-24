'use client';

import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { FilterSearch } from '@/components/ui/FilterToolbar';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    ids?: string[];
    id?: string;
    folderId?: string;
    title: string;
    existingShares?: any[];
    onShareChange?: () => void;
}

interface User {
    id: number;
    nama_lengkap?: string;
    nama?: string;
    username: string;
    share_id?: string;
}

export default function ShareModal({
    isOpen,
    onClose,
    ids,
    id,
    folderId,
    title,
    existingShares = [],
    onShareChange
}: ShareModalProps) {
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [sharing, setSharing] = useState(false);
    const [revoking, setRevoking] = useState<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const isFolder = !!folderId;
    const documentIds = ids || (id ? [id] : []);

    useEffect(() => {
        if (isOpen) {
            searchInputRef.current?.focus();
        } else {
            setSearch('');
            setUsers([]);
            setSelectedIds([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const timeoutId = setTimeout(() => {
            fetchUsers();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [search, isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/personal/users/search?q=${search}`);
            const json = await res.json();
            if (json.ok) {
                const sharedIds = existingShares.map((s: any) => s.shared_with?.id).filter(Boolean);
                const availableUsers = json.data.filter((u: User) => !sharedIds.includes(u.id));
                setUsers(availableUsers);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (userId: number) => {
        setSelectedIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleShareSelected = async () => {
        if (selectedIds.length === 0) return;

        setSharing(true);
        try {
            const url = isFolder
                ? '/api/personal/folders/share'
                : '/api/personal/documents/share';

            for (const userId of selectedIds) {
                const body = isFolder
                    ? { folder_id: folderId, shared_with_user_id: userId }
                    : { document_ids: documentIds, shared_with_user_id: userId };

                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }

            setSelectedIds([]);
            onShareChange?.();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Berhasil dibagikan ke ${selectedIds.length} pengguna`,
                showConfirmButton: false,
                timer: 2000,
                customClass: { popup: 'swal-toast-popup' }
            });
        } catch (error) {
            Swal.fire('Error', 'Gagal membagikan akses', 'error');
        } finally {
            setSharing(false);
        }
    };

    const handleRevoke = async (userId: number, shareId: string) => {
        setRevoking(userId);
        try {
            const url = isFolder
                ? '/api/personal/folders/share/revoke'
                : '/api/personal/documents/share/revoke';

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ share_id: shareId })
            });
            const json = await res.json();
            if (json.ok) {
                onShareChange?.();
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Berhasil dibatalkan',
                    showConfirmButton: false,
                    timer: 2000,
                    customClass: { popup: 'swal-toast-popup' }
                });
            } else {
                Swal.fire('Gagal', json.error, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Gagal membatalkan berbagi', 'error');
        } finally {
            setRevoking(null);
        }
    };

    if (!isOpen) return null;

    const isSelected = (userId: number) => selectedIds.includes(userId);

    const sharedUsers: User[] = existingShares.map((s: any) => ({
        id: s.shared_with?.id,
        nama_lengkap: s.shared_with?.nama_lengkap,
        nama: s.shared_with?.nama,
        username: s.shared_with?.username,
        share_id: s.id,
    }));

    return (
        <Modal 
            open={isOpen} 
            onClose={onClose} 
            size="md" 
            title="Bagikan Dokumen" 
            subtitle={title} 
            icon="share"
        >
            <div className="sm-search-wrap">
                <FilterSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari nama atau username..."
                    label="Cari"
                    width="100%"
                    trailing={loading ? <div className="sm-search-spinner" style={{ marginLeft: 8 }} /> : null}
                />
            </div>

            <ModalBody className="sm-list">
                {sharedUsers.length === 0 && users.length === 0 && !loading ? (
                    <div className="sm-empty">
                        <i className="bi bi-search" style={{ fontSize: '2rem', opacity: 0.3 }} />
                        <span>{search ? 'Pengguna tidak ditemukan' : 'Ketik untuk mencari...'}</span>
                    </div>
                ) : (
                    <>
                        {sharedUsers.map(user => (
                            <div key={`shared-${user.id}`} className="sm-user-item sm-user-item--shared">
                                <div className="sm-user-avatar">
                                    {(user.nama_lengkap || user.nama || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="sm-user-info">
                                    <span className="sm-user-name">{user.nama_lengkap || user.nama}</span>
                                    <span className="sm-user-username">@{user.username}</span>
                                </div>
                                <button
                                    className={`sm-revoke-btn ${revoking === user.id ? 'sm-revoke-btn--loading' : ''}`}
                                    onClick={() => handleRevoke(user.id!, user.share_id || '')}
                                    disabled={revoking === user.id}
                                    title="Batalkan berbagi"
                                >
                                    {revoking === user.id ? (
                                        <div className="sm-btn-spinner" />
                                    ) : (
                                        <i className="bi bi-x-lg" />
                                    )}
                                </button>
                            </div>
                        ))}
                        {users.map(user => (
                            <div
                                key={`available-${user.id}`}
                                className={`sm-user-item sm-user-item--selectable ${isSelected(user.id) ? 'sm-user-item--selected' : ''}`}
                                onClick={() => toggleUser(user.id)}
                            >
                                <div className="sm-user-avatar">
                                    {(user.nama_lengkap || user.nama || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="sm-user-info">
                                    <span className="sm-user-name">{user.nama_lengkap || user.nama}</span>
                                    <span className="sm-user-username">@{user.username}</span>
                                </div>
                                {isSelected(user.id) && (
                                    <div className="sm-selected-check">
                                        <i className="bi bi-check-lg" style={{ color: 'white' }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </ModalBody>

            <ModalFooter>
                <Button
                    variant="primary"
                    disabled={selectedIds.length === 0 || sharing}
                    isLoading={sharing}
                    onClick={handleShareSelected}
                    leftIcon={<i className="bi bi-share" />}
                >
                    Bagikan {selectedIds.length > 0 && `(${selectedIds.length})`}
                </Button>
            </ModalFooter>

            <style jsx>{`
                .sm-search-wrap {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--n-border);
                }
                .sm-search-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid var(--n-border);
                    border-top-color: #4f46e5;
                    border-radius: 50%;
                    animation: smSpin 0.7s linear infinite;
                    flex-shrink: 0;
                }
                @keyframes smSpin { to { transform: rotate(360deg) } }

                .sm-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px 0;
                    min-height: 200px;
                }
                .sm-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 40px 20px;
                    color: var(--n-muted);
                    font-size: 0.82rem;
                    font-weight: 500;
                }
                .sm-user-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 16px;
                    transition: background 0.15s;
                    border-bottom: 1px solid #f8fafc;
                }
                .sm-user-item:hover { background: var(--n-soft); }
                .sm-user-item:last-child { border-bottom: none; }
                .sm-user-item--shared {
                    background: #eff6ff;
                    padding: 12px 16px;
                }
                .sm-user-item--shared:hover { background: #dbeafe; }
                .sm-user-item--selectable { cursor: pointer; }
                .sm-user-item--selected { background: #eff6ff; }
                .sm-user-item--selected:hover { background: #dbeafe; }
                .sm-user-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #1e3a8a, #4f46e5);
                    color: white;
                    font-size: 0.9rem;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(30, 58, 138, 0.25);
                }
                .sm-user-info {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .sm-user-name {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--n-text);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .sm-user-username {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }
                .sm-revoke-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    cursor: pointer;
                    border: none;
                    background: #fef2f2;
                    color: #ef4444;
                    transition: all 0.15s;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sm-revoke-btn:hover:not(:disabled) { background: #ef4444; color: white; }
                .sm-revoke-btn--loading { opacity: 0.6; cursor: not-allowed; }
                .sm-selected-check {
                    width: 22px;
                    height: 22px;
                    border-radius: 6px;
                    background: #4f46e5;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sm-btn-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: smSpin 0.7s linear infinite;
                }


                :global(.dark) .sm-user-item--shared { background: rgba(59, 130, 246, 0.1); border-bottom-color: rgba(255, 255, 255, 0.05); }
                :global(.dark) .sm-user-item--shared:hover { background: rgba(59, 130, 246, 0.15); }
                :global(.dark) .sm-user-item--selected { background: rgba(59, 130, 246, 0.1); }
                :global(.dark) .sm-user-item--selected:hover { background: rgba(59, 130, 246, 0.15); }
                :global(.dark) .sm-user-item { border-bottom-color: rgba(255, 255, 255, 0.05); }
            `}</style>
        </Modal>
    );
}
