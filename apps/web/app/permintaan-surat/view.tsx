'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageLoader } from '@/components/ui/Spinner'
import { useTabParam } from '@/hooks/useTabParam'
import { getCurrentUser, getUserRoles } from '@/lib/auth-client'
import Swal from 'sweetalert2'
import type { User } from '@/lib/types'
import FormPermintaanSurat from './components/FormPermintaanSurat'
import TabPengajuan from './tabs/TabPengajuan'
import TabPengelolaan from './tabs/TabPengelolaan'

export default function PermintaanSuratPage() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useTabParam<'pengajuan' | 'pengelolaan'>('pengajuan', ['pengajuan', 'pengelolaan'])
    const [showForm, setShowForm] = useState(false)
    const [editData, setEditData] = useState<any>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const userData = await getCurrentUser()
                if (!userData) {
                    window.location.href = '/login'
                    return
                }

                setUser(userData)
            } catch (e) {
                console.error('[permintaan-surat] load error:', e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const userRoles = getUserRoles(user)
    const isAdmin = userRoles.includes('ADMIN')
    const isOpLayanan = userRoles.includes('OP_LAYANAN')
    const canManage = isAdmin || isOpLayanan

    if (loading) {
        return <PageLoader label="Memuat…" />
    }

    const handleEdit = (data: any) => {
        setEditData(data)
        setShowForm(true)
    }

    const handleCloseForm = () => {
        setShowForm(false)
        setEditData(null)
    }

    return (
        <div className="ps-wrapper">
            {/* Header */}
            <div className="ps-header">
                <div className="ps-header__bg">
                    <div className="ps-header__bg-accent"></div>
                    <div className="ps-header__bg-grid"></div>
                </div>
                <div className="ps-header__content">
                    <div className="ps-header__left">
                        <div className="ps-header__icon-wrap">
                            <i className="bi bi-file-earmark-text"></i>
                            <div className="ps-header__icon-shine"></div>
                        </div>
                        <div className="ps-header__text">
                            <h1 className="ps-header__title">Permintaan Surat</h1>
                            <p className="ps-header__sub">
                                {canManage ? 'Kelola permintaan surat dari pengguna' : `Ajukan permintaan surat - ${user?.nama_lengkap || user?.nama || 'User'}`}
                            </p>
                        </div>
                    </div>
                    <div className="ps-header__right">
                        <div className="ps-header__stat">
                            <div className="ps-header__stat-value">3</div>
                            <div className="ps-header__stat-label">Jenis Surat</div>
                        </div>
                        <div className="ps-header__divider"></div>
                        <div className="ps-header__stat">
                            <div className="ps-header__stat-value" style={{ color: '#fbbf24' }}>2</div>
                            <div className="ps-header__stat-label">Menunggu</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs & Actions */}
            <div className="ps-toolbar">
                {canManage && (
                    <div className="ps-tabs">
                        <button
                            className={`ps-tab-btn ${activeTab === 'pengajuan' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('pengajuan')}
                        >
                            <i className="bi bi-file-earmark-plus"></i>
                            Pengajuan Saya
                        </button>
                        <button
                            className={`ps-tab-btn ${activeTab === 'pengelolaan' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('pengelolaan')}
                        >
                            <i className="bi bi-gear"></i>
                            Pengelolaan
                        </button>
                    </div>
                )}
                {!showForm && !canManage && (
                    <button className="ps-btn ps-btn--primary" onClick={() => setShowForm(true)}>
                        <i className="bi bi-plus-circle"></i>
                        Ajukan Permintaan
                    </button>
                )}
            </div>

            {/* Content */}
            {showForm ? (
                <FormPermintaanSurat
                    user={user}
                    editData={editData}
                    onClose={handleCloseForm}
                    onSuccess={() => {
                        handleCloseForm()
                        setActiveTab('pengajuan')
                    }}
                />
            ) : activeTab === 'pengajuan' ? (
                <TabPengajuan
                    user={user}
                    onEdit={handleEdit}
                    onNew={() => setShowForm(true)}
                />
            ) : (
                <TabPengelolaan
                    user={user}
                    onEdit={handleEdit}
                />
            )}

            <style jsx>{`
                .ps-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding-bottom: 48px;
                    font-family: 'Poppins', sans-serif;
                }

                .ps-header {
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    background: linear-gradient(135deg, #1e40af 0%, #1e40af 100%);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }

                .ps-header__bg {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }

                .ps-header__bg-accent {
                    position: absolute;
                    top: -40px;
                    right: -40px;
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
                }

                .ps-header__bg-grid {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 40px 40px;
                }

                .ps-header__content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 22px 32px;
                    gap: 20px;
                }

                .ps-header__left {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .ps-header__icon-wrap {
                    position: relative;
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #3083FF 0%, #3083FF 160%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 1.5rem;
                    flex-shrink: 0;
                    box-shadow: 0 4px 20px rgba(0, 56, 168, 0.35);
                }

                .ps-header__icon-shine {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 50%;
                    background: linear-gradient(to bottom, rgba(255,255,255,0.15), transparent);
                    border-radius: 16px 16px 0 0;
                    pointer-events: none;
                }

                .ps-header__text { color: white; }

                .ps-header__title {
                    margin: 0;
                    font-size: 1.6rem;
                    font-weight: 800;
                    color: white;
                    letter-spacing: -0.03em;
                    line-height: 1.1;
                }

                .ps-header__sub {
                    margin: 4px 0 0;
                    font-size: 0.78rem;
                    font-weight: 400;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.02em;
                }

                .ps-header__right {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .ps-header__stat {
                    text-align: center;
                }

                .ps-header__stat-value {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: white;
                    line-height: 1;
                    letter-spacing: -0.02em;
                }

                .ps-header__stat-label {
                    font-size: 0.68rem;
                    font-weight: 500;
                    color: rgba(255,255,255,0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-top: 3px;
                }

                .ps-header__divider {
                    width: 1px;
                    height: 40px;
                    background: rgba(255,255,255,0.1);
                }

                .ps-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .ps-tabs {
                    display: flex;
                    gap: 4px;
                    background: #f1f5f9;
                    padding: 4px;
                    border-radius: 12px;
                }

                .ps-tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ps-tab-btn:hover {
                    color: #1e40af;
                }

                .ps-tab-btn.is-active {
                    background: white;
                    color: #1e40af;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                }

                .ps-tab-btn i {
                    font-size: 1rem;
                }

                .ps-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .ps-btn--primary {
                    background: #1e40af;
                    color: white;
                }

                .ps-btn--primary:hover {
                    background: #1e3a8a;
                    box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
                }

                @media (max-width: 768px) {
                    .ps-header__content {
                        padding: 16px;
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .ps-header__title { font-size: 1.25rem; }
                    .ps-tabs {
                        width: 100%;
                        overflow-x: auto;
                    }
                    .ps-toolbar {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .ps-btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    )
}