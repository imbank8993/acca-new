'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useDashboardUser } from '@/components/UserContext';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import './form.css';

export default function FormDashboard() {
    const { user } = useDashboardUser();
    const isAdmin = user?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) || false;
    const isOpForm = user?.roles?.some((r: string) => r.toUpperCase() === 'OP_FORM') || false;
    const isPengurusKelas = user?.roles?.some((r: string) => r.toUpperCase() === 'PENGURUS_KELAS') || false;
    
    // canManage determines if they can use the builder and see management actions
    const canManage = isAdmin || isOpForm || isPengurusKelas;

    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});
    const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);

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

    const handleCopyLink = async (item: any) => {
        let slug = item.schema?.slug;
        if (!slug) {
            slug = (item.title || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            // Save slug back if not exists
            persistFormPatch(item.id, { schema: { slug } });
            // Optimistic update
            setForms(prev => prev.map(f => f.id === item.id ? { ...f, schema: { ...(f.schema || {}), slug } } : f));
        }

        const link = `${window.location.origin}/f/${slug}`;
        try {
            await navigator.clipboard.writeText(link);
            Swal.fire({
                title: 'Tersalin!',
                text: 'Link form telah disalin ke clipboard.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire('Gagal', 'Tidak dapat menyalin ke clipboard. Salin secara manual: ' + link, 'error');
        }
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

    /** Toggle Akses via Link (is_link_public) */
    const handleToggleLink = async (item: any, isLinkPublic: boolean) => {
        if (!canManage) return;
        setToggleLoading(p => ({ ...p, [item.id + '_link']: true }));
        const newIsLinkPublic = !isLinkPublic;

        // Optimistic UI Update
        setForms(prev => prev.map(f => f.id === item.id ? {
            ...f,
            schema: { ...(f.schema || {}), is_link_public: newIsLinkPublic }
        } : f));

        await persistFormPatch(item.id, { schema: { is_link_public: newIsLinkPublic } });
        setToggleLoading(p => ({ ...p, [item.id + '_link']: false }));
    };

    /** Toggle active/closed status */
    const handleToggleActive = async (item: any, isActive: boolean) => {
        if (!canManage) return;
        setToggleLoading(p => ({ ...p, [item.id + '_active']: true }));
        const newIsActive = !isActive;

        // Optimistic UI Update
        setForms(prev => prev.map(f => f.id === item.id ? {
            ...f,
            schema: { ...(f.schema || {}), is_active: newIsActive }
        } : f));

        await persistFormPatch(item.id, { schema: { is_active: newIsActive } });
        setToggleLoading(p => ({ ...p, [item.id + '_active']: false }));
    };

    /** Toggle Akademik App (Khusus Admin/OP) - Updates is_public */
    const handleToggleAkademik = async (item: any, isAkademik: boolean) => {
        if (!isAdmin && !isOpForm) return;
        setToggleLoading(p => ({ ...p, [item.id + '_akademik']: true }));
        const newIsAkademik = !isAkademik;

        // Optimistic UI Update - Jika tampil di akademik, maka otomatis link publik juga aktif!
        setForms(prev => prev.map(f => f.id === item.id ? {
            ...f,
            is_public: newIsAkademik,
            schema: { 
                ...(f.schema || {}), 
                ...(newIsAkademik ? { is_link_public: true } : {}) 
            }
        } : f));

        const payload: any = { is_public: newIsAkademik };
        if (newIsAkademik) {
            payload.schema = { is_link_public: true };
        }

        await persistFormPatch(item.id, payload);
        setToggleLoading(p => ({ ...p, [item.id + '_akademik']: false }));
    };

    /** Toggle Boleh Diisi Berkali-kali (schema.allow_multiple_responses). Tidak berlaku
     *  untuk form publik — pengisi anonim memang tidak pernah bisa dibatasi. */
    const handleToggleMultiple = async (item: any, allowMultiple: boolean) => {
        if (!canManage) return;
        setToggleLoading(p => ({ ...p, [item.id + '_multi']: true }));
        const newAllowMultiple = !allowMultiple;

        setForms(prev => prev.map(f => f.id === item.id ? {
            ...f,
            schema: { ...(f.schema || {}), allow_multiple_responses: newAllowMultiple }
        } : f));

        await persistFormPatch(item.id, { schema: { allow_multiple_responses: newAllowMultiple } });
        setToggleLoading(p => ({ ...p, [item.id + '_multi']: false }));
    };

    /** Turunkan status akses/isian sebuah form dari kolom schema/is_public-nya. */
    const getFormFlags = (item: any) => {
        const isAkademik = item.is_public === true || item.schema?.is_public === true;
        const isAccessible = isAkademik || item.schema?.is_link_public === true;
        const isActive = item.schema?.is_active !== false; // Default true if undefined
        // Form publik tidak pernah bisa dibatasi sekali isi (tidak ada identitas pengisi).
        const allowMultiple = isAccessible || item.schema?.allow_multiple_responses === true;
        return { isAkademik, isAccessible, isActive, allowMultiple };
    };

    /** Switch kecil tanpa label, dipakai di dalam modal Pengaturan Formulir */
    const SwitchVisual = ({ on, onColor, offColor = '#94a3b8' }: { on: boolean; onColor: string; offColor?: string }) => (
        <div style={{
            width: '42px', height: '22px', borderRadius: '9999px',
            backgroundColor: on ? onColor : offColor,
            position: 'relative', transition: 'background-color 0.2s ease', padding: '2px', flexShrink: 0
        }}>
            <div style={{
                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transform: on ? 'translateX(20px)' : 'translateX(0px)', transition: 'transform 0.2s ease'
            }} />
        </div>
    );

    /** Satu baris pengaturan di dalam modal: judul + deskripsi di kiri, switch di kanan */
    const SettingRow = ({ icon, iconColor, title, description, on, onColor, offColor, disabled, loading, disabledNote, onClick }: {
        icon: string; iconColor: string; title: string; description?: string;
        on: boolean; onColor: string; offColor?: string;
        disabled?: boolean; loading?: boolean; disabledNote?: string; onClick: () => void;
    }) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--n-border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: 'var(--n-text)' }}>
                    <i className={`bi bi-${icon}`} style={{ color: iconColor, fontSize: '15px' }} />
                    {title}
                </div>
                {description && <p style={{ fontSize: '11.5px', color: 'var(--n-muted)', margin: '5px 0 0 0', lineHeight: 1.5 }}>{description}</p>}
                {disabled && disabledNote && (
                    <p style={{ fontSize: '11px', color: '#d97706', margin: '7px 0 0 0', fontWeight: 700, display: 'flex', alignItems: 'flex-start', gap: '5px', lineHeight: 1.4 }}>
                        <i className="bi bi-info-circle-fill" style={{ marginTop: '1px', flexShrink: 0 }} />
                        <span>{disabledNote}</span>
                    </p>
                )}
            </div>
            <button
                disabled={disabled || loading}
                onClick={onClick}
                style={{ background: 'transparent', border: 'none', padding: 0, flexShrink: 0, cursor: disabled || loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
                <SwitchVisual on={on} onColor={onColor} offColor={offColor} />
            </button>
        </div>
    );

    /** Teks status kecil (bukan badge) — hanya tampil kalau flag-nya aktif */
    const StatusText = ({ icon, label, color }: { icon: string; label: string; color: string }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color, whiteSpace: 'nowrap' }}>
            <i className={`bi bi-${icon}`} style={{ fontSize: '10px' }} />
            {label}
        </span>
    );

    /** Ringkasan status form (read-only) — pengaturan sesungguhnya ada di FormSettingsModal */
    const StatusBadges = ({ item }: { item: any }) => {
        const { isAccessible, isActive, isAkademik, allowMultiple } = getFormFlags(item);
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px' }}>
                {isAccessible && <StatusText icon="globe" label="Publik" color="#059669" />}
                {isActive && <StatusText icon="door-open-fill" label="Aktif" color="#2563eb" />}
                {(isAdmin || isOpForm) && isAkademik && <StatusText icon="app-indicator" label="Akademik" color="#7c3aed" />}
                {allowMultiple && <StatusText icon="arrow-repeat" label="Multiple Entry" color="#0284c7" />}
            </div>
        );
    };

    /** Modal Pengaturan Formulir — menggantikan toggle-toggle inline di kolom status */
    const FormSettingsModal = ({ item, onClose }: { item: any; onClose: () => void }) => {
        if (!item || typeof document === 'undefined') return null;
        const { isAkademik, isAccessible, isActive, allowMultiple } = getFormFlags(item);

        return createPortal(
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ backgroundColor: 'var(--n-card)', borderRadius: '14px', maxWidth: '480px', width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--n-border)' }}
                >
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--n-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--n-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="bi bi-gear-fill" style={{ color: 'var(--n-primary)' }} />
                                Pengaturan Formulir
                            </h3>
                            <p style={{ fontSize: '11.5px', color: 'var(--n-muted)', margin: '4px 0 0 0' }} className="truncate">{item.title}</p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{ background: 'var(--n-soft)', border: '1px solid var(--n-border)', borderRadius: '8px', width: '30px', height: '30px', flexShrink: 0, cursor: 'pointer', color: 'var(--n-muted)' }}
                            title="Tutup"
                        >
                            <i className="bi bi-x-lg" style={{ fontSize: '12px' }} />
                        </button>
                    </div>

                    <div style={{ padding: '4px 24px 0' }}>
                        <SettingRow
                            icon={isAccessible ? 'globe' : 'lock-fill'}
                            iconColor={isAccessible ? '#10b981' : '#ef4444'}
                            title={isAccessible ? 'Akses via Link (Publik)' : 'Privat (Wajib Login)'}
                            description="Jika aktif, siapa saja dengan link bisa mengisi tanpa login. Jika mati, pengisi wajib login ke akun ACCA."
                            on={isAccessible}
                            onColor="#10b981"
                            offColor="#ef4444"
                            disabled={!canManage || !!toggleLoading[item.id + '_link'] || isAkademik}
                            loading={!!toggleLoading[item.id + '_link']}
                            disabledNote={isAkademik ? "Formulir yang tampil di Akademik otomatis publik. Matikan 'Tampil di Akademik App' dahulu untuk mengubah ini." : undefined}
                            onClick={() => handleToggleLink(item, isAccessible)}
                        />
                        <SettingRow
                            icon={isActive ? 'door-open-fill' : 'door-closed-fill'}
                            iconColor={isActive ? '#3b82f6' : '#64748b'}
                            title={isActive ? 'Formulir Dibuka' : 'Formulir Ditutup'}
                            description="Saat ditutup, formulir tidak menerima tanggapan baru namun data yang sudah masuk tetap tersimpan."
                            on={isActive}
                            onColor="#3b82f6"
                            offColor="#64748b"
                            disabled={!canManage}
                            loading={!!toggleLoading[item.id + '_active']}
                            onClick={() => handleToggleActive(item, isActive)}
                        />
                        {(isAdmin || isOpForm) && (
                            <SettingRow
                                icon={isAkademik ? 'app-indicator' : 'app'}
                                iconColor={isAkademik ? '#8b5cf6' : '#94a3b8'}
                                title={isAkademik ? 'Tampil di Akademik App' : 'Disembunyikan dari Akademik App'}
                                description="Menampilkan formulir ini di navigasi Akademik App. Mengaktifkan ini otomatis membuka akses via link."
                                on={isAkademik}
                                onColor="#8b5cf6"
                                offColor="#94a3b8"
                                disabled={!isAdmin}
                                loading={!!toggleLoading[item.id + '_akademik']}
                                onClick={() => handleToggleAkademik(item, isAkademik)}
                            />
                        )}
                        <SettingRow
                            icon={allowMultiple ? 'arrow-repeat' : '1-circle-fill'}
                            iconColor={allowMultiple ? '#0ea5e9' : '#64748b'}
                            title={allowMultiple ? 'Boleh Diisi Berkali-kali' : 'Hanya Sekali Isi per Akun'}
                            description="Menentukan apakah satu akun boleh mengirim lebih dari satu tanggapan untuk formulir ini."
                            on={allowMultiple}
                            onColor="#0ea5e9"
                            offColor="#64748b"
                            disabled={!canManage || !!toggleLoading[item.id + '_multi'] || isAccessible}
                            loading={!!toggleLoading[item.id + '_multi']}
                            disabledNote={isAccessible ? "Formulir publik tidak mewajibkan login, sehingga jumlah isian tidak bisa dibatasi per orang. Matikan 'Akses via Link' agar bisa dikunci sekali isi per akun." : undefined}
                            onClick={() => handleToggleMultiple(item, allowMultiple)}
                        />
                    </div>

                    <div style={{ padding: '16px 24px 20px' }}>
                        <button
                            onClick={onClose}
                            style={{ width: '100%', height: '40px', borderRadius: '8px', border: 'none', background: 'var(--n-primary)', color: '#fff', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer' }}
                        >
                            Selesai
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    return (
        <div className="w-full flex flex-col gap-5">
            {/* Header Banner */}
            

            <div className="w-full">
                <div 
                    style={{ 
                        borderRadius: '6px', 
                        padding: '24px 28px',
                        borderWidth: '1.5px',
                        borderStyle: 'solid',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)' 
                    }}
                    className="bg-white dark:bg-black border-slate-300 dark:border-blue-600/80"
                >
                    {/* Header Seksi Daftar Form */}
                    <div className="border-b border-dashed border-slate-200 dark:border-blue-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5">
                        <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--n-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="bi bi-list-task text-[#3083FF] dark:text-blue-400" style={{ fontSize: '16px' }} /> 
                                <span>{canManage ? 'DAFTAR FORMULIR DINAMIS' : 'DAFTAR FORMULIR TERSEDIA'}</span>
                            </h3>
                            <p style={{ fontSize: '11px', color: 'var(--n-muted)', margin: '4px 0 0 0', fontWeight: 500 }}>
                                {canManage ? 'Kelola akses publik, salin tautan, dan pantau tanggapan masuk.' : 'Pilih formulir di bawah ini untuk mengisi dan mengirimkan jawaban Anda.'}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:flex-none w-full sm:w-[240px]">
                                <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--n-muted)', fontSize: '12px' }} />
                                <input 
                                    type="text" 
                                    placeholder="Cari form..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '0 12px 0 32px',
                                        height: '42px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        outline: 'none',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}
                                    className="bg-slate-50 dark:bg-black border-slate-300 dark:border-blue-600/80 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                            {canManage && (
                                <Link href="/form/builder" className="w-full sm:w-auto" style={{ textDecoration: 'none' }}>
                                    <Button variant="primary" icon="add" className="w-full sm:w-auto justify-center whitespace-nowrap">
                                        Buat Form Baru
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div style={{ padding: 0 }}>
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center">
                                <Spinner variant="buble" size={36} />
                            </div>
                        ) : forms.length === 0 ? (
                            <div className="text-slate-400 dark:text-slate-500" style={{ padding: '64px', textAlign: 'center' }}>
                                <i className="bi bi-inbox text-4xl block mb-2 opacity-40"></i>
                                <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: '13px', fontWeight: 600 }}>Belum ada form yang dibuat.</p>
                                <p className="text-slate-400 dark:text-slate-500" style={{ fontSize: '11px', marginTop: '4px' }}>Klik tombol &apos;Buat Form Baru&apos; di atas untuk membuat formulir pertama Anda.</p>
                            </div>
                        ) : (
                            <div className="w-full">
                                {/* ═══════════════════════════════════════════════════════════════
                                    DESKTOP TABLE VIEW — hidden di mobile, tampil di md ke atas
                                   ═══════════════════════════════════════════════════════════════ */}
                                <div className="desktop-table-view" style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead className="bg-slate-50 dark:bg-black">
                                            <tr>
                                                <th className="text-[#3083FF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-700/60" style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Judul Formulir
                                                </th>
                                                <th className="text-[#3083FF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-700/60" style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Status (Akses & Form)
                                                </th>
                                                <th className="text-[#3083FF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-700/60" style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Tanggal Dibuat
                                                </th>
                                                <th className="text-[#3083FF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-700/60" style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                                                    Aksi Manajemen
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                            {filteredForms.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="text-slate-400 dark:text-slate-500" style={{ padding: '48px', textAlign: 'center' }}>
                                                        <i className="bi bi-search text-2xl block mb-2 opacity-40"></i>
                                                        <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: '13px', fontWeight: 600 }}>Form tidak ditemukan.</p>
                                                        <p className="text-slate-400 dark:text-slate-500" style={{ fontSize: '11px', marginTop: '4px' }}>Coba gunakan kata kunci pencarian yang lain.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredForms.map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                                        style={{ opacity: getFormFlags(item).isActive ? 1 : 0.5 }}
                                                        title={getFormFlags(item).isActive ? undefined : 'Formulir ditutup — tidak menerima tanggapan baru'}
                                                    >
                                                        <td className="text-slate-900 dark:text-slate-100" style={{ padding: '14px 18px', fontSize: '13px', fontWeight: 700 }}>
                                                        <div className="max-w-[240px] md:max-w-[320px] lg:max-w-[380px] whitespace-normal break-words">
                                                            <span style={{ display: 'block', lineHeight: 1.3 }}>{item.title}</span>
                                                            {item.schema?.description && (
                                                                <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: '11px', fontWeight: 500, margin: '4px 0 0 0', lineHeight: 1.4 }}>
                                                                    {item.schema.description}
                                                                </p>
                                                            )}
                                                            <div style={{ marginTop: '8px' }}>
                                                                <span style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '4px',
                                                                    backgroundColor: 'var(--n-soft)',
                                                                    color: 'var(--n-text)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    border: '1px solid var(--n-border)'
                                                                }}>
                                                                    <i className="bi bi-person-lines-fill" style={{ fontSize: '10px' }} />
                                                                    {item.custom_form_responses?.[0]?.count || 0} Tanggapan
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 18px', fontSize: '12px' }}>
                                                        <StatusBadges item={item} />
                                                    </td>
                                                    <td className="text-slate-500 dark:text-slate-400" style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 500 }}>
                                                        {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        }) : '—'}
                                                    </td>
                                                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                                                        <ActionGroup>
                                                            {/* Button Isi Form Langsung */}
                                                            <a href={`/f/${item.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                                <ActionButton action="fill" iconOnly={false} label="Isi" />
                                                            </a>

                                                            {canManage && (
                                                                <>
                                                                    {/* Button Lihat Hasil Tanggapan */}
                                                                    <Link href={`/form/responses?id=${item.id}`} style={{ textDecoration: 'none' }}>
                                                                        <ActionButton action="chart" iconOnly={false} label="Hasil" />
                                                                    </Link>

                                                                    {/* Button Pengaturan Formulir */}
                                                                    <ActionButton
                                                                        action="settings"
                                                                        onClick={() => setSettingsOpenId(item.id)}
                                                                        title="Pengaturan Formulir"
                                                                    />

                                                                    {/* Button Copy Link */}
                                                                    <ActionButton 
                                                                        action="copy"
                                                                        onClick={() => handleCopyLink(item)}
                                                                        title="Salin Link Publik"
                                                                    />

                                                                    {/* Button Edit Builder */}
                                                                    <Link href={`/form/builder?id=${item.id}`} style={{ textDecoration: 'none' }}>
                                                                        <ActionButton action="edit" title="Edit Form Builder" />
                                                                    </Link>

                                                                    {/* Button Hapus */}
                                                                    {(canManage || item.created_by === user?.id) && (
                                                                        <ActionButton 
                                                                            action="delete"
                                                                            onClick={() => handleDelete(item.id)}
                                                                            title="Hapus Form"
                                                                        />
                                                                    )}
                                                                </>
                                                            )}
                                                        </ActionGroup>
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
                                        <div style={{ padding: '48px 16px', textAlign: 'center' }} className="text-slate-400 dark:text-slate-500">
                                            <i className="bi bi-search text-2xl block mb-2 opacity-40"></i>
                                            <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: '13px', fontWeight: 600 }}>Form tidak ditemukan.</p>
                                            <p className="text-slate-400 dark:text-slate-500" style={{ fontSize: '11px', marginTop: '4px' }}>Coba kata kunci lain.</p>
                                        </div>
                                    ) : (
                                        filteredForms.map((item, index) => {
                                            const isActive = getFormFlags(item).isActive;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="form-mobile-card bg-white dark:bg-black border border-slate-200 dark:border-blue-600/80"
                                                    style={{ animationDelay: `${index * 40}ms`, opacity: isActive ? 1 : 0.5 }}
                                                >
                                                    {/* Card Top: Accent Bar */}
                                                    <div className="form-mobile-card-accent" />

                                                    <div style={{ padding: '16px 16px 14px' }}>
                                                        {/* Row 1: Title + Description */}
                                                        <div style={{ marginBottom: '10px' }}>
                                                            <h4 className="text-slate-900 dark:text-slate-100" style={{ 
                                                                fontSize: '14px', 
                                                                fontWeight: 800, 
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
                                                                <p className="text-slate-500 dark:text-slate-400" style={{ 
                                                                    fontSize: '11px', 
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
                                                            <div style={{ marginTop: '8px' }}>
                                                                <span className="bg-slate-100 dark:bg-blue-950/60 text-slate-700 dark:text-blue-300 border border-slate-200 dark:border-blue-800/60" style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '4px',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '10px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 600
                                                                }}>
                                                                    <i className="bi bi-person-lines-fill" style={{ fontSize: '9px' }} />
                                                                    {item.custom_form_responses?.[0]?.count || 0} Tanggapan
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Meta Info */}
                                                        <div className="border-b border-dashed border-slate-200 dark:border-blue-900/40" style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '12px', 
                                                            marginBottom: '14px',
                                                            paddingBottom: '12px'
                                                        }}>
                                                            <span className="text-slate-500 dark:text-slate-400" style={{ 
                                                                fontSize: '11px', 
                                                                fontWeight: 600, 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '5px' 
                                                            }}>
                                                                <i className="bi bi-calendar3" style={{ fontSize: '11px' }} />
                                                                {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                }) : '—'}
                                                            </span>
                                                            {canManage && (
                                                                <span className="text-slate-500 dark:text-slate-400" style={{ 
                                                                    fontSize: '11px', 
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

                                                        {/* Row 3: Action Buttons — ActionGroup */}
                                                        <ActionGroup className="w-full justify-between">
                                                            {/* Primary: Isi Form */}
                                                            <a href={`/f/${item.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                                <ActionButton action="fill" iconOnly label="Isi" />
                                                            </a>

                                                            {(canManage || item.created_by === user?.id) && (
                                                                <>
                                                                    <Link href={`/form/responses?id=${item.id}`} style={{ textDecoration: 'none' }}>
                                                                        <ActionButton action="chart" iconOnly label="Hasil" />
                                                                    </Link>

                                                                    <ActionButton
                                                                        action="settings"
                                                                        onClick={() => setSettingsOpenId(item.id)}
                                                                        title="Pengaturan Formulir"
                                                                    />
                                                                    <ActionButton
                                                                        action="copy"
                                                                        onClick={() => handleCopyLink(item)}
                                                                        title="Salin Link"
                                                                    />
                                                                    <Link href={`/form/builder?id=${item.id}`} style={{ textDecoration: 'none' }}>
                                                                        <ActionButton action="edit" title="Edit Form" />
                                                                    </Link>
                                                                    <ActionButton
                                                                        action="delete"
                                                                        onClick={() => handleDelete(item.id)}
                                                                        title="Hapus Form"
                                                                    />
                                                                </>
                                                            )}
                                                        </ActionGroup>

                                                        {/* Status Toggles Mobile */}
                                                        <div className="border-t border-dashed border-slate-200 dark:border-blue-900/40" style={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: '12px 16px',
                                                            alignItems: 'center',
                                                            marginTop: '14px',
                                                            paddingTop: '14px'
                                                        }}>
                                                            <StatusBadges item={item} />
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

            <FormSettingsModal
                item={forms.find(f => f.id === settingsOpenId) || null}
                onClose={() => setSettingsOpenId(null)}
            />
        </div>
    );
}
