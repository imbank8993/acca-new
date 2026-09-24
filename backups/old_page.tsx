'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useDashboardUser } from '@/components/UserContext';

export default function FormDashboard() {
    const { user } = useDashboardUser();
    const canManage = user?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'OP_FORM'].includes(r.toUpperCase())) || false;

    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchForms();
    }, []);

    const fetchForms = async () => {
        try {
            const res = await fetch('/api/forms');
            const data = await res.json();
            if (res.ok) {
                setForms(data.forms || []);
            }
        } catch (error) {
            console.error('Error fetching forms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: 'Hapus Form?',
            text: 'Jawaban yang sudah masuk juga akan ikut terhapus.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            customClass: {
                confirmButton: 'bg-red-600 text-white px-5 py-2.5 rounded font-bold text-xs ml-2',
                cancelButton: 'bg-slate-200 text-slate-700 px-5 py-2.5 rounded font-bold text-xs'
            },
            buttonsStyling: false
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/forms/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    Swal.fire({
                        title: 'Terhapus!', 
                        text: 'Form berhasil dihapus.', 
                        icon: 'success',
                        customClass: { confirmButton: 'bg-[#3083FF] text-white px-5 py-2 rounded font-bold text-xs' },
                        buttonsStyling: false
                    });
                    fetchForms();
                } else {
                    Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus.', 'error');
                }
            } catch {
                Swal.fire('Gagal', 'Terjadi kesalahan server.', 'error');
            }
        }
    };

    const handleCopyLink = (id: string) => {
        const link = `${window.location.origin}/f/${id}`;
        navigator.clipboard.writeText(link);
        Swal.fire({
            title: 'Tersalin!',
            text: 'Link form telah disalin ke clipboard.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    };

    const filteredForms = forms.filter(f => 
        (f.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (f.schema?.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    /**
     * Kirim perubahan status ke server. Kalau gagal, tarik ulang daftar dari server
     * supaya tampilan optimistis tidak "bertahan" sampai user refresh.
     */
    const persistFormPatch = async (id: string, payload: any) => {
        try {
            const res = await fetch(`/api/forms/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Perubahan status gagal disimpan.');
            }
        } catch (err: any) {
            console.error('Error saving form status:', err);
            await fetchForms();
            Swal.fire({
                title: 'Gagal Menyimpan',
                text: err?.message || 'Perubahan status tidak tersimpan di server.',
                icon: 'error',
                customClass: { confirmButton: 'bg-[#3083FF] text-white px-5 py-2 rounded font-bold text-xs' },
                buttonsStyling: false
            });
        }
    };

    /** Toggle public/private status */
    const handleTogglePublic = async (item: any, isPublic: boolean) => {
        if (!canManage) return;
        const newIsPublic = !isPublic;

        // Optimistic UI Update
        setForms(prev => prev.map(f => f.id === item.id ? {
            ...f,
            is_public: newIsPublic,
            show_in_academic_navbar: newIsPublic,
            schema: { ...(f.schema || {}), is_public: newIsPublic, show_in_academic_navbar: newIsPublic }
        } : f));

        await persistFormPatch(item.id, { is_public: newIsPublic, show_in_academic_navbar: newIsPublic });
    };

    /** Toggle active/closed status */
    const handleToggleActive = async (item: any, isActive: boolean) => {
        if (!canManage) return;
        const newIsActive = !isActive;

        // Optimistic UI Update
        setForms(prev => prev.map(f => f.id === item.id ? {
            ...f,
            schema: { ...(f.schema || {}), is_active: newIsActive }
        } : f));

        await persistFormPatch(item.id, { schema: { ...(item.schema || {}), is_active: newIsActive } });
    };

    /** Reusable Status Toggle Button */
    const StatusToggle = ({ item }: { item: any }) => {
        const isPublic = item.is_public === true || item.schema?.is_public === true;
        return (
            <button
                disabled={!canManage}
                onClick={() => handleTogglePublic(item, isPublic)}
                className={`flex items-center gap-2.5 text-left bg-transparent border-0 p-0 ${canManage ? 'cursor-pointer group' : 'cursor-default'}`}
                title={canManage ? "Klik untuk beralih Status Akses" : "Status Akses Formulir"}
            >
                <div style={{
                    width: '38px',
                    height: '20px',
                    borderRadius: '9999px',
                    backgroundColor: isPublic ? '#10b981' : '#ef4444',
                    position: 'relative',
                    transition: 'background-color 0.2s ease',
                    padding: '2px',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        transform: isPublic ? 'translateX(18px)' : 'translateX(0px)',
                        transition: 'transform 0.2s ease'
                    }} />
                </div>
                <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 800, 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }} className={isPublic ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    <i className={`bi bi-${isPublic ? 'globe' : 'lock-fill'} text-xs`} />
                    {isPublic ? 'Publik' : 'Privat'}
                </span>
            </button>
        );
    };

    /** Reusable Active Toggle Button */
    const ActiveToggle = ({ item }: { item: any }) => {
        const isActive = item.schema?.is_active !== false; // Default true if undefined
        return (
            <button
                disabled={!canManage}
                onClick={() => handleToggleActive(item, isActive)}
                className={`flex items-center gap-2.5 text-left bg-transparent border-0 p-0 ${canManage ? 'cursor-pointer group' : 'cursor-default'}`}
                title={canManage ? "Klik untuk Buka/Tutup Formulir" : "Status Buka/Tutup Formulir"}
            >
                <div style={{
                    width: '38px',
                    height: '20px',
                    borderRadius: '9999px',
                    backgroundColor: isActive ? '#3b82f6' : '#64748b',
                    position: 'relative',
                    transition: 'background-color 0.2s ease',
                    padding: '2px',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        transform: isActive ? 'translateX(18px)' : 'translateX(0px)',
                        transition: 'transform 0.2s ease'
                    }} />
                </div>
                <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 800, 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}>
                    <i className={`bi bi-${isActive ? 'door-open-fill' : 'door-closed-fill'} text-xs`} />
                    {isActive ? 'Buka' : 'Tutup'}
                </span>
            </button>
        );
    };

    return (
        <div className="w-full">
            {/* Header Banner Eksak Halaman Informasi */}
            <div style={{
                position: 'relative',
                background: 'var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)))',
                borderRadius: '16px',
                padding: '22px 32px',
                color: 'white',
                margin: '0',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}>
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <h1 style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        margin: 0,
                        lineHeight: 1.2,
                        letterSpacing: '-0.02em',
                        color: 'white'
                    }}>Manajemen Formulir</h1>
                    <p style={{
                        fontSize: '0.78rem',
                        color: 'rgba(255, 255, 255, 0.85)',
                        margin: 0,
                        lineHeight: 1.4
                    }}>Buat dan kelola formulir pendataan secara custom</p>
                </div>
            </div>

            <div className="w-full">
                <div 
                    style={{ 
                        borderRadius: '6px', 
                        backgroundColor: 'var(--n-card)', 
                        border: '1px solid var(--n-border)', 
                        padding: '24px 28px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)' 
                    }}
                >
                    {/* Header Seksi Daftar Form */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '2px dashed var(--n-border)', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--n-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="bi bi-list-task" style={{ fontSize: '16px' }} /> 
                                <span>{canManage ? 'DAFTAR FORMULIR DINAMIS' : 'DAFTAR FORMULIR TERSEDIA'}</span>
                            </h3>
                            <p style={{ fontSize: '11px', color: 'var(--n-muted)', margin: '4px 0 0 0', fontWeight: 500 }}>
                                {canManage ? 'Kelola akses publik, salin tautan, dan pantau tanggapan masuk.' : 'Pilih formulir di bawah ini untuk mengisi dan mengirimkan jawaban Anda.'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ position: 'relative' }}>
                                <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--n-muted)', fontSize: '12px' }} />
                                <input 
                                    type="text" 
                                    placeholder="Cari form..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '0 12px 0 32px',
                                        height: '42px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--n-border)',
                                        backgroundColor: 'var(--n-soft)',
                                        color: 'var(--n-text)',
                                        fontSize: '12px',
                                        outline: 'none',
                                        width: '100%',
                                        minWidth: '240px',
                                        boxSizing: 'border-box'
                                    }}
                                    className="focus:ring-2 focus:ring-[#3083FF]/20 focus:border-[#3083FF] transition-all"
                                />
                            </div>
                            {canManage && (
                                <Link 
                                    href="/form/builder" 
                                    style={{
                                        background: 'var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)))',
                                        borderRadius: '4px',
                                        height: '42px',
                                        padding: '0 20px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontWeight: 800,
                                        fontSize: '12px',
                                        color: '#ffffff',
                                        textDecoration: 'none',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        flexShrink: 0,
                                    }}
                                    className="hover:opacity-95 transition-opacity hide-text-mobile"
                                >
                                    <i className="bi bi-plus-lg text-xs" />
                                    <span>Buat Form Baru</span>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div style={{ padding: 0 }}>
                        {loading ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-[#3083FF] rounded-full mb-2"></div>
                                <div style={{ fontSize: '12px', fontWeight: 600 }}>Memuat daftar formulir...</div>
                            </div>
                        ) : forms.length === 0 ? (
                            <div style={{ padding: '64px', textAlign: 'center', color: '#94a3b8' }}>
                                <i className="bi bi-inbox text-4xl block mb-2 opacity-40"></i>
                                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Belum ada form yang dibuat.</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Klik tombol &apos;Buat Form Baru&apos; di atas untuk membuat formulir pertama Anda.</p>
                            </div>
                        ) : (
                            <div className="w-full">
                                {/* ═══════════════════════════════════════════════════════════════
                                    DESKTOP TABLE VIEW — hidden di mobile, tampil di md ke atas
                                   ═══════════════════════════════════════════════════════════════ */}
                                <div className="desktop-table-view" style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead style={{ backgroundColor: '#f8fafc' }}>
                                            <tr>
                                                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#3083FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
                                                    Judul Formulir
                                                </th>
                                                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#3083FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
                                                    Status (Akses & Form)
                                                </th>
                                                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#3083FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
                                                    Tanggal Dibuat
                                                </th>
                                                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#3083FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                                                    Aksi Manajemen
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredForms.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                                        <i className="bi bi-search text-2xl block mb-2 opacity-40"></i>
                                                        <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Form tidak ditemukan.</p>
                                                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Coba gunakan kata kunci pencarian yang lain.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredForms.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td style={{ padding: '14px 18px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                                        <div className="max-w-[240px] md:max-w-[320px] lg:max-w-[380px] whitespace-normal break-words">
                                                            <span style={{ display: 'block', lineHeight: 1.3 }}>{item.title}</span>
                                                            {item.schema?.description && (
                                                                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, margin: '4px 0 0 0', lineHeight: 1.4 }}>
                                                                    {item.schema.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 18px', fontSize: '12px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <StatusToggle item={item} />
                                                            <ActiveToggle item={item} />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                            {/* Button Isi Form Langsung untuk Pengguna ACCA */}
                                                            <a
                                                                href={`/f/${item.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    borderRadius: '4px',
                                                                    height: '34px',
                                                                    padding: '0 14px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 800,
                                                                    color: '#ffffff',
                                                                    backgroundColor: '#059669',
                                                                    border: 'none',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    textDecoration: 'none',
                                                                }}
                                                                className="hover:bg-emerald-700 transition-colors shadow-xs"
                                                                title="Buka & Isi Formulir Langsung"
                                                            >
                                                                <i className="bi bi-pencil-square text-xs" />
                                                                <span>Isi</span>
                                                            </a>

                                                            {canManage && (
                                                                <>
                                                                    {/* Button Lihat Hasil Tanggapan */}
                                                                    <Link
                                                                        href={`/form/responses?id=${item.id}`}
                                                                        style={{
                                                                            borderRadius: '4px',
                                                                            height: '34px',
                                                                            padding: '0 12px',
                                                                            fontSize: '11px',
                                                                            fontWeight: 700,
                                                                            color: '#3083FF',
                                                                            backgroundColor: '#eff6ff',
                                                                            border: '1px solid #bfdbfe',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            textDecoration: 'none',
                                                                        }}
                                                                        title="Lihat Hasil Tanggapan Responden"
                                                                    >
                                                                        <i className="bi bi-bar-chart-line-fill text-xs" />
                                                                        <span>Hasil</span>
                                                                    </Link>

                                                                    {/* Button Salin Link */}
                                                                    <button 
                                                                        onClick={() => handleCopyLink(item.id)}
                                                                        style={{
                                                                            borderRadius: '4px',
                                                                            height: '34px',
                                                                            width: '34px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            color: 'var(--n-text)',
                                                                            backgroundColor: 'var(--n-soft)',
                                                                            border: '1px solid var(--n-border)',
                                                                            cursor: 'pointer',
                                                                        }}
                                                                        className="hover:text-[#3083FF] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                                        title="Salin Link Publik"
                                                                    >
                                                                        <i className="bi bi-link-45deg text-base" />
                                                                    </button>

                                                                    {/* Button Edit Builder */}
                                                                    <Link 
                                                                        href={`/form/builder?id=${item.id}`}
                                                                        style={{
                                                                            borderRadius: '4px',
                                                                            height: '34px',
                                                                            width: '34px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            color: 'var(--n-text)',
                                                                            backgroundColor: 'var(--n-soft)',
                                                                            border: '1px solid var(--n-border)',
                                                                        }}
                                                                        className="hover:text-[#3083FF] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                                        title="Edit Form Builder"
                                                                    >
                                                                        <i className="bi bi-pencil text-sm" />
                                                                    </Link>

                                                                    {/* Button Hapus */}
                                                                    <button 
                                                                        onClick={() => handleDelete(item.id)}
                                                                        style={{
                                                                            borderRadius: '4px',
                                                                            height: '34px',
                                                                            width: '34px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            color: '#e11d48',
                                                                            backgroundColor: 'var(--n-soft)',
                                                                            border: '1px solid var(--n-border)',
                                                                            cursor: 'pointer',
                                                                        }}
                                                                        className="hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                                                        title="Hapus Form"
                                                                    >
                                                                        <i className="bi bi-trash text-sm" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* ═══════════════════════════════════════════════════════════════
                                    MOBILE CARD VIEW — tampil di mobile, hidden di md ke atas
                                   ═══════════════════════════════════════════════════════════════ */}
                                <div className="mobile-card-view flex-col gap-3">
                                    {filteredForms.length === 0 ? (
                                        <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                                            <i className="bi bi-search text-2xl block mb-2 opacity-40"></i>
                                            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Form tidak ditemukan.</p>
                                            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Coba kata kunci lain.</p>
                                        </div>
                                    ) : (
                                        filteredForms.map((item, index) => {
                                            const isPublic = item.is_public === true || item.schema?.is_public === true;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="form-mobile-card"
                                                    style={{ animationDelay: `${index * 40}ms` }}
                                                >
                                                    {/* Card Top: Accent Bar + Status Pill */}
                                                    <div className="form-mobile-card-accent" />

                                                    <div style={{ padding: '16px 16px 14px' }}>
                                                        {/* Row 1: Title + Status */}
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <h4 style={{ 
                                                                    fontSize: '14px', 
                                                                    fontWeight: 800, 
                                                                    color: '#0f172a', 
                                                                    margin: 0, 
                                                                    lineHeight: 1.35,
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: 'vertical',
                                                                    overflow: 'hidden',
                                                                }}>
                                                                    {item.title}
                                                                </h4>
                                                                {item.schema?.description && (
                                                                    <p style={{ 
                                                                        fontSize: '11px', 
                                                                        color: '#64748b', 
                                                                        fontWeight: 500, 
                                                                        margin: '4px 0 0 0', 
                                                                        lineHeight: 1.45,
                                                                        display: '-webkit-box',
                                                                        WebkitLineClamp: 2,
                                                                        WebkitBoxOrient: 'vertical',
                                                                        overflow: 'hidden',
                                                                    }}>
                                                                        {item.schema.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {/* Status Pill */}
                                                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                                                <StatusToggle item={item} />
                                                                <ActiveToggle item={item} />
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Meta Info */}
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '12px', 
                                                            marginBottom: '14px',
                                                            paddingBottom: '12px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                        }}>
                                                            <span style={{ 
                                                                fontSize: '11px', 
                                                                color: '#94a3b8', 
                                                                fontWeight: 600, 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '5px' 
                                                            }}>
                                                                <i className="bi bi-calendar3" style={{ fontSize: '11px' }} />
                                                                {new Date(item.created_at).toLocaleDateString('id-ID', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                            {canManage && (
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    color: '#94a3b8', 
                                                                    fontWeight: 600, 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '5px' 
                                                                }}>
                                                                    <i className="bi bi-layers" style={{ fontSize: '11px' }} />
                                                                    {item.schema?.fields?.length || 0} komponen
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Row 3: Action Buttons — full-width elegant row */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {/* Primary: Isi Form */}
                                                            <a
                                                                href={`/f/${item.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="form-mobile-btn-primary"
                                                                style={{ width: '36px', padding: 0 }}
                                                                title="Isi Form"
                                                            >
                                                                <i className="bi bi-pencil-square" style={{ fontSize: '13px' }} />
                                                            </a>

                                                            {canManage && (
                                                                <>
                                                                    {/* Secondary: Hasil */}
                                                                    <Link
                                                                        href={`/form/responses?id=${item.id}`}
                                                                        className="form-mobile-btn-secondary"
                                                                        style={{ width: '36px', padding: 0 }}
                                                                        title="Hasil"
                                                                    >
                                                                        <i className="bi bi-bar-chart-line-fill" style={{ fontSize: '12px' }} />
                                                                    </Link>

                                                                    {/* Icon buttons group */}
                                                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <button 
                                                                            onClick={() => handleCopyLink(item.id)}
                                                                            className="form-mobile-btn-icon"
                                                                            title="Salin Link"
                                                                        >
                                                                            <i className="bi bi-link-45deg" />
                                                                        </button>
                                                                        <Link 
                                                                            href={`/form/builder?id=${item.id}`}
                                                                            className="form-mobile-btn-icon"
                                                                            title="Edit Form"
                                                                        >
                                                                            <i className="bi bi-pencil" />
                                                                        </Link>
                                                                        <button 
                                                                            onClick={() => handleDelete(item.id)}
                                                                            className="form-mobile-btn-icon form-mobile-btn-danger"
                                                                            title="Hapus Form"
                                                                        >
                                                                            <i className="bi bi-trash" />
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Styling */}
            <style dangerouslySetInnerHTML={{ __html: `
                .desktop-table-view { display: block; }
                .mobile-card-view { display: none; }
                
                @media (max-width: 639px) {
                  .desktop-table-view { display: none !important; }
                  .mobile-card-view { display: flex !important; }
                }

                /* ══════════════════════════════════════════════════════════
                   MOBILE CARD STYLES
                   ══════════════════════════════════════════════════════════ */

                @keyframes formCardSlideUp {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .form-mobile-card {
                    background-color: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
                    transition: all 0.2s ease;
                    animation: formCardSlideUp 0.35s ease-out both;
                }
                .form-mobile-card:active {
                    transform: scale(0.99);
                }

                .form-mobile-card-accent {
                    height: 3px;
                    background: linear-gradient(90deg, var(--n-primary, #3083FF) 0%, #c2185b 100%);
                }

                .form-mobile-status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 10px;
                    border-radius: 9999px;
                    font-size: 10px;
                    font-weight: 800;
                    border: 1px solid;
                    white-space: nowrap;
                    flex-shrink: 0;
                    letter-spacing: 0.02em;
                }

                .form-mobile-btn-primary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    height: 36px;
                    padding: 0 16px;
                    border-radius: 6px;
                    background-color: #059669;
                    color: #ffffff;
                    font-size: 12px;
                    font-weight: 800;
                    text-decoration: none;
                    border: none;
                    transition: all 0.15s ease;
                    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25);
                }
                .form-mobile-btn-primary:active {
                    transform: scale(0.96);
                    background-color: #047857;
                }

                .form-mobile-btn-secondary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    height: 36px;
                    padding: 0 14px;
                    border-radius: 6px;
                    background-color: #eff6ff;
                    color: #3083FF;
                    font-size: 12px;
                    font-weight: 700;
                    text-decoration: none;
                    border: 1px solid #bfdbfe;
                    transition: all 0.15s ease;
                }
                .form-mobile-btn-secondary:active {
                    transform: scale(0.96);
                    background-color: #dbeafe;
                }

                .form-mobile-btn-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    border-radius: 6px;
                    background-color: #f8fafc;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    text-decoration: none;
                }
                .form-mobile-btn-icon:active {
                    transform: scale(0.92);
                    background-color: #e2e8f0;
                }

                .form-mobile-btn-danger {
                    color: #e11d48;
                }
                .form-mobile-btn-danger:active {
                    background-color: #fff1f2;
                }
            `}} />
        </div>
    );
}
