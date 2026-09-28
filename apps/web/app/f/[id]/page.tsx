'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { Spinner } from '@/components/ui/Spinner';
import { FormSchema, FormField, FieldCondition } from '@/app/form/types';

/** Evaluates whether a field should be shown based on conditional logic */
function checkFieldVisibility(field: FormField, formData: Record<string, any>): boolean {
    if (!field.conditions || field.conditions.length === 0) return true;

    const evaluate = (cond: FieldCondition) => {
        const val = formData[cond.targetFieldId];

        switch (cond.operator) {
            case 'equals':
                if (Array.isArray(val)) return val.includes(cond.value);
                return String(val ?? '') === String(cond.value ?? '');
            case 'not_equals':
                if (Array.isArray(val)) return !val.includes(cond.value);
                return String(val ?? '') !== String(cond.value ?? '');
            case 'contains':
                return String(val ?? '').toLowerCase().includes(String(cond.value ?? '').toLowerCase());
            case 'is_not_empty':
                if (Array.isArray(val)) return val.length > 0;
                return val !== undefined && val !== null && String(val).trim() !== '';
            case 'is_empty':
                if (Array.isArray(val)) return val.length === 0;
                return val === undefined || val === null || String(val).trim() === '';
            default:
                return true;
        }
    };

    // 'or' = cukup satu syarat terpenuhi (mis. jurusan dipilih di Pilihan 1 ATAU Pilihan 2)
    const isSatisfied = field.conditionLogic === 'or'
        ? field.conditions.some(evaluate)
        : field.conditions.every(evaluate);

    return field.conditionAction === 'hide' ? !isSatisfied : isSatisfied;
}

/** Kumpulkan nilai terpilih pada sebuah field, baik tunggal maupun ganda (checkbox) */
function chosenValues(raw: any): string[] {
    if (raw === undefined || raw === null || raw === '') return [];
    return (Array.isArray(raw) ? raw : [raw]).map((v) => String(v));
}

/**
 * Opsi yang benar-benar tampil untuk sebuah field: opsi yang sudah dipilih di
 * field-field pada `excludeChosenFrom` dibuang, sehingga dua pertanyaan bisa
 * dibuat saling meniadakan (Pilihan 1 & Pilihan 2 tidak boleh sama).
 */
function resolveVisibleOptions(field: FormField, formData: Record<string, any>) {
    const options = field.options || [];
    const sources = field.excludeChosenFrom || [];
    if (options.length === 0 || sources.length === 0) return options;

    const taken = new Set(sources.flatMap((sourceId) => chosenValues(formData[sourceId])));
    if (taken.size === 0) return options;

    return options.filter((opt) => !taken.has(String(opt.value)));
}

export default function FormViewerPage() {
    const routeParams = useParams();
    const id = (routeParams?.id as string) || null;

    const [formConfig, setFormConfig] = useState<{ id: string; title: string; schema: FormSchema } | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const [isAccessDenied, setIsAccessDenied] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    // ── Mode Embed (dipasang di dalam iframe aplikasi lain) ──
    const [embedded, setEmbedded] = useState(false);

    useEffect(() => {
        if (id) {
            fetchForm(id);
        }
    }, [id]);

    useEffect(() => {
        try {
            if (window.self !== window.top) setEmbedded(true);
        } catch {
            // Akses window.top diblokir cross-origin => pasti di dalam iframe
            setEmbedded(true);
        }
    }, []);

    // ── Kirim tinggi konten ke parent agar iframe menyesuaikan (hindari scroll ganda) ──
    useEffect(() => {
        if (!embedded) return;

        // html/body memakai min-height:100% (globals.css) sehingga tinggi selalu
        // minimal setinggi iframe. Dilepas agar tinggi benar-benar mengikuti konten.
        const html = document.documentElement;
        const body = document.body;
        const prev = {
            htmlMinHeight: html.style.minHeight,
            htmlHeight: html.style.height,
            htmlOverflow: html.style.overflow,
            bodyMinHeight: body.style.minHeight,
            bodyHeight: body.style.height,
            bodyOverflow: body.style.overflow,
            bodyBackground: body.style.background,
        };
        body.style.background = 'transparent';
        html.style.minHeight = '0';
        html.style.height = 'auto';
        html.style.overflow = 'hidden';
        body.style.minHeight = '0';
        body.style.height = 'auto';
        body.style.overflow = 'hidden';

        // Tinggi konten = posisi bawah terjauh dari elemen non-fixed di dalam body
        const measure = () => {
            let bottom = 0;
            Array.from(body.children).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                const style = window.getComputedStyle(node);
                if (style.position === 'fixed' || style.display === 'none') return;
                const rect = node.getBoundingClientRect();
                if (rect.height === 0) return;
                bottom = Math.max(bottom, rect.bottom + window.scrollY + (parseFloat(style.marginBottom) || 0));
            });
            return Math.ceil(bottom);
        };

        let lastHeight = 0;
        const postHeight = () => {
            const height = measure();
            if (height > 0 && Math.abs(height - lastHeight) > 1) {
                lastHeight = height;
                window.parent.postMessage({ type: 'acca:form-height', height }, '*');
            }
        };

        postHeight();

        const resizeObserver = new ResizeObserver(postHeight);
        resizeObserver.observe(body);
        Array.from(body.children).forEach((node) => {
            if (node instanceof HTMLElement) resizeObserver.observe(node);
        });

        // Konten baru (mis. field kondisional / ganti halaman) ikut terpantau
        const mutationObserver = new MutationObserver(postHeight);
        mutationObserver.observe(body, { childList: true, subtree: true, attributes: true });

        window.addEventListener('load', postHeight);
        window.addEventListener('resize', postHeight);
        const interval = window.setInterval(postHeight, 500);

        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            window.removeEventListener('load', postHeight);
            window.removeEventListener('resize', postHeight);
            window.clearInterval(interval);
            html.style.minHeight = prev.htmlMinHeight;
            html.style.height = prev.htmlHeight;
            html.style.overflow = prev.htmlOverflow;
            body.style.minHeight = prev.bodyMinHeight;
            body.style.height = prev.bodyHeight;
            body.style.overflow = prev.bodyOverflow;
            body.style.background = prev.bodyBackground;
        };
    }, [embedded]);

    const scrollToTop = () => {
        if (embedded) {
            window.parent.postMessage({ type: 'acca:form-scroll-top' }, '*');
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const fetchForm = async (targetId: string) => {
        try {
            const res = await fetch(`/api/forms/${targetId}`);
            if (res.ok) {
                const data = await res.json();
                const config = data.form;
                setFormConfig(config);

                // ── Auto-Fill User Identity jika User ACCA Logged-In (Admin / Guru / User) ──
                let loggedInUser: any = null;
                try {
                    const meRes = await fetch('/api/auth/me');
                    if (meRes.ok) {
                        const meJson = await meRes.json();
                        if (meJson.ok) loggedInUser = meJson.user;
                    }
                    if (!loggedInUser) {
                        const localUserStr = localStorage.getItem('acca_user') || localStorage.getItem('user');
                        if (localUserStr) {
                            loggedInUser = JSON.parse(localUserStr);
                        }
                    }
                } catch { /* ignored */ }

                // ── Strict Access Control: Jika Form Privat, Pengguna Harus Logged-In ACCA ──
                const isPublic = config?.is_public === true || config?.schema?.is_public === true || config?.schema?.is_link_public === true;
                if (!isPublic && !loggedInUser) {
                    setIsAccessDenied(true);
                    setLoading(false);
                    return;
                }

                // ── Cek Status Aktif Formulir ──
                if (config?.schema?.is_active === false) {
                    setIsClosed(true);
                    setLoading(false);
                    return;
                }

                const fields: FormField[] = config?.schema?.fields || [];
                const initialData: Record<string, any> = {};

                fields.forEach((f) => {
                    if (loggedInUser && !['heading', 'paragraph', 'divider', 'page_break'].includes(f.type)) {
                        const targetType = f.autoFillUser;
                        const labelLower = (f.label || '').toLowerCase();

                        // 1. Deteksi melalui Pengaturan Eksplisit Pembuat Form ATAU Deteksi Kata Kunci Label Cerdas
                        const isNameField = targetType === 'name' || (targetType !== 'none' && (labelLower.includes('nama') || labelLower.includes('pemohon')));
                        const isEmailField = targetType === 'email' || (targetType !== 'none' && (labelLower.includes('email') || labelLower.includes('surel')));
                        const isNipNisField = targetType === 'nip_nis' || (targetType !== 'none' && (labelLower.includes('nip') || labelLower.includes('nisn') || labelLower.includes('nik')));

                        const userValName = loggedInUser.nama || loggedInUser.name || loggedInUser.fullName || loggedInUser.username;
                        const userValEmail = loggedInUser.email;
                        const userValNipNis = loggedInUser.nip || loggedInUser.nisn || loggedInUser.nik || loggedInUser.nuptk;

                        if (isNameField && userValName) {
                            initialData[f.id] = userValName;
                        } else if (isEmailField && userValEmail) {
                            initialData[f.id] = userValEmail;
                        } else if (isNipNisField && userValNipNis) {
                            initialData[f.id] = userValNipNis;
                        }
                    }
                });
                if (Object.keys(initialData).length > 0) {
                    setFormData(prev => ({ ...initialData, ...prev }));
                }
            } else {
                setFormConfig(null);
            }
        } catch (error) {
            console.error('Error fetching form:', error);
            setFormConfig(null);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleCheckboxChange = (fieldId: string, optionValue: string, checked: boolean) => {
        setFormData(prev => {
            const current: string[] = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
            if (checked) {
                return { ...prev, [fieldId]: [...current, optionValue] };
            } else {
                return { ...prev, [fieldId]: current.filter(v => v !== optionValue) };
            }
        });
    };

    // Jawaban yang opsinya menghilang harus ikut dikosongkan. Contoh: responden memilih
    // Kedokteran di Pilihan 2, lalu mengubah Pilihan 1 menjadi Kedokteran — tanpa ini,
    // nilai lama tetap tersimpan dan ikut terkirim walau opsinya sudah tidak tampil.
    useEffect(() => {
        const fields: FormField[] = formConfig?.schema?.fields || [];
        const dependents = fields.filter((f) => (f.excludeChosenFrom || []).length > 0);
        if (dependents.length === 0) return;

        setFormData((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const field of dependents) {
                const current = prev[field.id];
                if (current === undefined || current === null || current === '') continue;

                const allowed = new Set(resolveVisibleOptions(field, prev).map((o) => String(o.value)));

                if (Array.isArray(current)) {
                    const kept = current.filter((v) => allowed.has(String(v)));
                    if (kept.length !== current.length) { next[field.id] = kept; changed = true; }
                } else if (!allowed.has(String(current))) {
                    next[field.id] = '';
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [formData, formConfig]);

    const showValidationError = (message: string) => {
        // Saat embed, iframe bisa jauh lebih tinggi dari viewport parent — tampilkan
        // dialog di bagian atas dan minta parent menggulir ke formulir agar terlihat.
        if (embedded) scrollToTop();
        Swal.fire({
            title: 'Gagal Kirim',
            text: message,
            icon: 'warning',
            position: embedded ? 'top' : 'center',
            confirmButtonText: 'OK',
            confirmButtonColor: '#3083FF',
            customClass: {
                confirmButton: 'bg-[#3083FF] hover:bg-[#002b80] text-white h-11 px-10 min-w-[130px] rounded-md font-extrabold text-xs inline-flex items-center justify-center transition-colors shadow-xs cursor-pointer'
            },
            buttonsStyling: false
        });
    };

    // Validasi field per halaman
    const validateFields = (fieldsToValidate: FormField[]): boolean => {
        for (const field of fieldsToValidate) {
            if (['heading', 'paragraph', 'divider', 'page_break'].includes(field.type)) continue;

            const isVisible = checkFieldVisibility(field, formData);
            if (!isVisible) continue;

            const val = formData[field.id];

            if (field.required) {
                if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                    showValidationError(`Harap isi field "${field.label}"`);
                    return false;
                }
            }

            if (val !== undefined && val !== null && val !== '') {
                if (typeof val === 'string') {
                    if (field.minLength && val.length < field.minLength) {
                        showValidationError(`"${field.label}" minimal ${field.minLength} karakter`);
                        return false;
                    }
                    if (field.maxLength && val.length > field.maxLength) {
                        showValidationError(`"${field.label}" maksimal ${field.maxLength} karakter`);
                        return false;
                    }
                    if (field.pattern) {
                        try {
                            const regex = new RegExp(field.pattern);
                            if (!regex.test(val)) {
                                showValidationError(field.patternMessage || `Format "${field.label}" tidak sesuai ketentuan`);
                                return false;
                            }
                        } catch { /* ignore regex parse error */ }
                    }
                }
            }
        }
        return true;
    };

    const isSubmittingRef = useRef(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (submitting || isSubmittingRef.current) return;

        if (!formConfig) return;
        const allFields: FormField[] = formConfig.schema.fields || [];

        // Validasi semua field sebelum submit
        if (!validateFields(allFields)) return;

        isSubmittingRef.current = true;
        setSubmitting(true);

        try {
            const cleanSubmissionData: Record<string, any> = {};
            for (const field of allFields) {
                if (['heading', 'paragraph', 'divider', 'page_break'].includes(field.type)) continue;
                if (checkFieldVisibility(field, formData)) {
                    let key = field.label || 'Tanggapan';
                    if (cleanSubmissionData[key] !== undefined) {
                        let count = 2;
                        while (cleanSubmissionData[`${key} (${count})`] !== undefined) {
                            count++;
                        }
                        key = `${key} (${count})`;
                    }
                    cleanSubmissionData[key] = formData[field.id];
                }
            }

            const res = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    form_id: id,
                    data: cleanSubmissionData
                })
            });

            if (res.ok) {
                setSubmitted(true);
                if (embedded) scrollToTop();
                Swal.fire({
                    title: 'Terima Kasih!',
                    text: 'Data Anda telah berhasil dikirim dan dicatat oleh sistem.',
                    icon: 'success',
                    position: embedded ? 'top' : 'center',
                    confirmButtonText: 'Tutup',
                    customClass: { confirmButton: 'bg-[#3083FF] hover:bg-[#002b80] text-white h-11 px-10 min-w-[130px] rounded-md font-extrabold text-xs inline-flex items-center justify-center transition-colors shadow-xs cursor-pointer' },
                    buttonsStyling: false
                });
            } else {
                const data = await res.json();
                Swal.fire('Gagal', data.error || 'Terjadi kesalahan saat mengirim data.', 'error');
            }
        } catch (error) {
            Swal.fire('Gagal', 'Terjadi kesalahan jaringan atau server tidak merespons.', 'error');
        } finally {
            setSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    // ── Kelas pembungkus halaman: tanpa min-h-screen saat embed agar tinggi = tinggi konten ──
    // Saat embed: tanpa padding & background sendiri agar menyatu dengan halaman induk

    // Deteksi mode dark secara lokal (read-only, tidak menulis ke document global agar
    // tidak bocor ke halaman lain saat komponen unmount).
    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        const update = () => setIsDark(document.documentElement.classList.contains('dark'));
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Palet warna: bg kolom isian sengaja disamakan dengan bg kartu ("surface") agar
    // menyatu dengan area di luarnya, sementara fieldBorder dibuat lebih tegas di mode
    // dark supaya tepi kolom tetap jelas terlihat walau warnanya menyatu.
    const theme = {
        text: isDark ? '#f1f5f9' : '#0f172a',
        textStrong: isDark ? '#f8fafc' : '#1e293b',
        muted: isDark ? '#94a3b8' : '#64748b',
        light: isDark ? '#64748b' : '#94a3b8',
        brand: isDark ? '#60a5fa' : '#475569',
        border: isDark ? 'rgba(37, 99, 235, 0.85)' : '#cbd5e1',
        fieldBorder: isDark ? 'rgba(37, 99, 235, 0.85)' : '#cbd5e1',
        surface: isDark ? '#000000' : '#ffffff',
        soft: isDark ? '#000000' : '#f8fafc',
        softer: isDark ? '#000000' : '#f1f5f9',
    };

    const shellClass = embedded
        ? 'bg-transparent px-4 py-8 sm:py-10 flex flex-col items-center justify-start'
        : 'min-h-screen bg-slate-50 dark:bg-transparent pt-8 sm:pt-14 pb-16 px-4 sm:px-6 flex flex-col items-center justify-start';
    const centeredShellClass = embedded
        ? 'bg-transparent flex items-center justify-center px-0 py-8'
        : 'min-h-screen bg-slate-50 dark:bg-transparent flex items-center justify-center p-4';
    const centeredCardOffset = embedded ? '0px' : '-180px';

    if (isClosed) {
        return (
            <div className={centeredShellClass}>
                <div
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/80 max-w-md w-full flex flex-col items-center text-center"
                    style={{ paddingTop: '40px', paddingBottom: '48px', paddingLeft: '32px', paddingRight: '32px', marginTop: centeredCardOffset }}
                >
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300 rounded-full flex items-center justify-center text-4xl mb-8 border border-slate-100 shadow-sm">
                        <i className="bi bi-door-closed-fill" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Formulir Ditutup</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-0 leading-relaxed max-w-sm">
                        Pengisian formulir telah ditutup oleh pengelola. Anda tidak dapat lagi mengirimkan tanggapan untuk formulir ini.
                    </p>
                </div>
            </div>
        );
    }

    if (isAccessDenied) {
        return (
            <div className={centeredShellClass}>
                <div
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/80 max-w-md w-full flex flex-col items-center text-center"
                    style={{ paddingTop: '40px', paddingBottom: '48px', paddingLeft: '32px', paddingRight: '32px', marginTop: centeredCardOffset }}
                >
                    <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-4xl mb-8 border border-rose-100 shadow-sm">
                        <i className="bi bi-shield-lock-fill" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Formulir Terbatas</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-sm">
                        Formulir ini bersifat <strong>Privat</strong> dan hanya dapat diakses oleh pengguna terdaftar yang telah login ke aplikasi ACCA.
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center justify-center gap-2 w-full bg-[#3083FF] hover:bg-[#002b80] text-white text-sm font-bold h-12 rounded-lg transition-colors shadow-md hover:shadow-lg"
                    >
                        <i className="bi bi-box-arrow-in-right" />
                        <span>Login ke ACCA App</span>
                    </a>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={embedded ? 'bg-transparent flex flex-col items-center justify-center py-24' : 'min-h-screen bg-slate-50 dark:bg-black flex flex-col items-center justify-center'}>
                <Spinner variant="buble" size={44} />
            </div>
        );
    }

    if (!formConfig) {
        return (
            <div className={shellClass}>
                <div className="max-w-3xl w-full mx-auto" style={{ marginTop: '20px' }}>
                    <div
                        style={{
                            background: 'var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%))',
                            borderRadius: '8px',
                            padding: '32px 36px',
                            marginBottom: '16px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        }}
                        className="text-white relative overflow-hidden text-center"
                    >
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px 0', color: '#ffffff' }}>
                                Formulir Tidak Ditemukan
                            </h2>
                            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.88)', marginTop: '4px', fontWeight: 500 }}>
                                Layanan Pendataan ACCA App
                            </p>
                        </div>
                    </div>

                    <div
                        style={{
                            borderRadius: '8px',
                            backgroundColor: theme.surface,
                            padding: '48px 36px',
                            border: `1.5px solid ${theme.border}`,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                        }}
                        className="text-center"
                    >
                        <div 
                            style={{ 
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: '#ffe4e6',
                                border: '1px solid #fecdd3',
                                color: '#e11d48',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 18px auto',
                            }}
                        >
                            <i className="bi bi-x-circle text-3xl" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: theme.text, margin: '0 0 8px 0' }}>Formulir Tidak Tersedia</h3>
                        <p style={{ fontSize: '13px', color: theme.muted, margin: '0 0 24px 0' }}>Pastikan link tautan formulir yang Anda ikuti sudah benar.</p>
                    </div>

                    <div style={{ marginTop: '24px', paddingBottom: '40px' }} className="text-center">
                        <p style={{ fontSize: '11px', color: theme.light }}>
                            Powered by <strong style={{ color: theme.brand }}>ACCA</strong>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className={shellClass}>
                <div className="max-w-xl w-full mx-auto" style={{ marginTop: '8px' }}>
                    <div
                        style={{
                            borderRadius: '8px',
                            backgroundColor: theme.surface,
                            padding: '48px 36px',
                            border: `1px solid ${theme.border}`,
                            }}
                        className="text-center"
                    >
                        <div
                            style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                color: '#059669',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px auto',
                            }}
                        >
                            <i className="bi bi-check-lg text-3xl" />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, color: theme.text, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                            Terkirim!
                        </h2>
                        <p style={{ fontSize: '13px', color: theme.muted, margin: '0 0 28px 0', lineHeight: '1.6' }}>
                            Tanggapan Anda telah berhasil disimpan ke dalam sistem database secara aman.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            style={{
                                borderRadius: '4px',
                                height: '42px',
                                padding: '0 28px',
                                fontSize: '12px',
                                fontWeight: 800,
                                color: '#3083FF',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                            }}
                            className="hover:bg-blue-100 transition-colors shadow-xs"
                        >
                            <i className="bi bi-arrow-counterclockwise text-sm" />
                            <span>Kirim Tanggapan Lain</span>
                        </button>
                    </div>
                    <div style={{ marginTop: '24px', paddingBottom: '40px' }} className="text-center">
                        <p style={{ fontSize: '11px', color: theme.light }}>
                            Powered by <strong style={{ color: theme.brand }}>ACCA</strong>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const rawFields: FormField[] = formConfig.schema.fields || [];

    // ── Pengelompokan Halaman (Multi-Step Pages) Berdasarkan page_break ──
    const pages: { title: string; fields: FormField[] }[] = [];
    let currentPageFields: FormField[] = [];
    let currentTitle = 'Bagian 1';

    rawFields.forEach((field) => {
        if (field.type === 'page_break') {
            if (currentPageFields.length > 0) {
                pages.push({ title: currentTitle, fields: currentPageFields });
            }
            currentPageFields = [];
            currentTitle = field.pageTitle || field.label || `Bagian ${pages.length + 1}`;
        } else {
            currentPageFields.push(field);
        }
    });
    if (currentPageFields.length > 0) {
        pages.push({ title: currentTitle, fields: currentPageFields });
    }

    const activePage = pages[currentStep] || pages[0] || { title: 'Bagian 1', fields: rawFields };

    const handleNextStep = () => {
        if (validateFields(activePage.fields)) {
            setCurrentStep(prev => Math.min(prev + 1, pages.length - 1));
            scrollToTop();
        }
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
        scrollToTop();
    };

    return (
        <div className={shellClass}>
            <div className="max-w-3xl w-full mx-auto" style={{ marginTop: '8px' }}>
                {/* ══ Header Banner Card ══ */}
                <div
                    style={{
                        borderRadius: '8px',
                        padding: '32px 36px',
                        marginBottom: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    }}
                    className="form-header-card relative overflow-hidden text-center"
                >
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <h2 className="form-header-title" style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px 0' }}>
                            {formConfig.title}
                        </h2>
                        {formConfig.schema.description ? (
                            <p 
                                style={{ 
                                    fontSize: '13px', 
                                    marginTop: '6px',
                                    fontWeight: 500,
                                    lineHeight: '1.5',
                                }} 
                                className="form-header-desc max-w-xl text-center"
                            >
                                {formConfig.schema.description}
                            </p>
                        ) : (
                            <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} className="form-header-desc">
                                <i className="bi bi-shield-check"></i>
                                Formulir resmi dikelola oleh ACCA App
                            </p>
                        )}
                    </div>
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
                </div>

                {/* ══ Form Fields Container Card ══ */}
                <form 
                    onSubmit={handleSubmit} 
                    style={{
                        borderRadius: '8px',
                        backgroundColor: theme.surface,
                        padding: '32px 36px',
                        border: `1.8px solid ${theme.border}`,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    }}
                >
                    {/* Stepper Header Bar jika terdapat lebih dari 1 bagian */}
                    {pages.length > 1 && (
                        <div style={{ marginBottom: '28px', padding: '16px 20px', backgroundColor: theme.soft, border: `1px solid ${theme.border}`, borderRadius: '6px' }}>
                            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                                {pages.map((p, idx) => {
                                    const isCurrent = idx === currentStep;
                                    const isCompleted = idx < currentStep;
                                    return (
                                        <div key={idx} className="flex-1 flex items-center min-w-0">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div 
                                                    style={{
                                                        backgroundColor: isCurrent ? '#3083FF' : isCompleted ? '#059669' : '#e2e8f0',
                                                        color: isCurrent || isCompleted ? '#ffffff' : '#64748b',
                                                        borderRadius: '50%',
                                                        width: '30px',
                                                        height: '30px',
                                                        fontSize: '12px',
                                                        fontWeight: 800,
                                                        flexShrink: 0,
                                                    }}
                                                    className="flex items-center justify-center shadow-2xs"
                                                >
                                                    {isCompleted ? <i className="bi bi-check-lg text-sm" /> : idx + 1}
                                                </div>
                                                <div className="hidden sm:block min-w-0">
                                                    <span style={{ fontSize: '9px', color: isCurrent ? '#3083FF' : theme.light, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                                                        LANGKAH {idx + 1}
                                                    </span>
                                                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? theme.text : theme.muted, margin: 0 }} className="truncate">
                                                        {p.title}
                                                    </h4>
                                                </div>
                                            </div>
                                            {idx < pages.length - 1 && (
                                                <div style={{ backgroundColor: isCompleted ? '#059669' : '#cbd5e1', height: '2px' }} className="flex-1 mx-2 transition-colors" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-6">
                        {activePage.fields.map((field) => {
                            const visible = checkFieldVisibility(field, formData);
                            if (!visible) return null;

                            return (
                                <RenderField
                                    key={field.id}
                                    field={field}
                                    options={resolveVisibleOptions(field, formData)}
                                    value={formData[field.id]}
                                    onChange={(val) => handleInputChange(field.id, val)}
                                    onCheckboxChange={(optVal, checked) => handleCheckboxChange(field.id, optVal, checked)}
                                    theme={theme}
                                />
                            );
                        })}
                    </div>

                    {/* Navigasi Tombol Multi-Step (Kembali, Selanjutnya, Kirim) */}
                    <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: isDark ? '1px dashed rgba(37, 99, 235, 0.7)' : '1px dashed #cbd5e1' }} className="flex justify-between items-center gap-4">
                        {currentStep > 0 ? (
                            <button
                                type="button"
                                onClick={handlePrevStep}
                                style={{
                                    borderRadius: '4px',
                                    height: '42px',
                                    padding: '0 24px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: isDark ? '#60a5fa' : theme.brand,
                                    backgroundColor: isDark ? 'rgba(26, 115, 232, 0.15)' : theme.softer,
                                    border: isDark ? '1px solid rgba(26, 115, 232, 0.6)' : `1px solid ${theme.border}`,
                                    cursor: 'pointer',
                                }}
                                className="inline-flex items-center gap-2 hover:opacity-90 transition-all shadow-2xs"
                            >
                                <i className="bi bi-arrow-left text-sm" />
                                <span>Kembali</span>
                            </button>
                        ) : <div />}

                        {currentStep < pages.length - 1 ? (
                            <button
                                type="button"
                                onClick={handleNextStep}
                                style={{
                                    background: isDark ? 'linear-gradient(135deg, #1d6bf3 0%, #2563eb 100%)' : 'linear-gradient(135deg, #3083FF 0%, #c2185b 100%)',
                                    borderRadius: '4px',
                                    height: '44px',
                                    padding: '0 32px',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: '#ffffff',
                                    border: isDark ? '1px solid rgba(147, 197, 253, 0.4)' : 'none',
                                    cursor: 'pointer',
                                    boxShadow: isDark ? '0 4px 16px rgba(29, 107, 243, 0.4)' : '0 2px 6px rgba(0,0,0,0.12)',
                                }}
                                className="inline-flex items-center gap-2 hover:opacity-95 transition-opacity ml-auto"
                            >
                                <span>Selanjutnya ({currentStep + 2}/{pages.length})</span>
                                <i className="bi bi-arrow-right text-sm" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    background: isDark ? 'linear-gradient(135deg, #1d6bf3 0%, #2563eb 100%)' : 'linear-gradient(135deg, #3083FF 0%, #c2185b 100%)',
                                    borderRadius: '4px',
                                    height: '44px',
                                    padding: '0 40px',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: '#ffffff',
                                    border: isDark ? '1px solid rgba(147, 197, 253, 0.4)' : 'none',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.6 : 1,
                                    boxShadow: isDark ? '0 4px 16px rgba(29, 107, 243, 0.4)' : '0 2px 6px rgba(0,0,0,0.12)',
                                }}
                                className="inline-flex items-center gap-2 hover:opacity-95 transition-opacity ml-auto"
                            >
                                {submitting ? (
                                    <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> Mengirim...</>
                                ) : (
                                    <><i className="bi bi-send-fill text-sm"></i> Kirim Formulir</>
                                )}
                            </button>
                        )}
                    </div>
                </form>

                <div style={{ marginTop: '24px', paddingBottom: '40px' }} className="text-center">
                    <p style={{ fontSize: '11px', color: theme.light }}>
                        Powered by <strong style={{ color: theme.brand }}>ACCA</strong>
                    </p>
                </div>
            </div>
        </div>
    );
}

type FieldTheme = {
    text: string; textStrong: string; muted: string; light: string; brand: string;
    border: string; fieldBorder: string; surface: string; soft: string; softer: string;
};

function RenderField({
    field,
    options,
    value,
    onChange,
    onCheckboxChange,
    theme
}: {
    field: FormField;
    /** Opsi setelah disaring excludeChosenFrom; default ke field.options */
    options?: FormField['options'];
    value: any;
    onChange: (val: any) => void;
    onCheckboxChange: (optVal: string, checked: boolean) => void;
    theme: FieldTheme;
}) {
    const fieldOptions = options ?? field.options ?? [];
    const widthClass = 
        field.width === 'half' ? 'w-full sm:w-[calc(50%-12px)]' :
        field.width === 'third' ? 'w-full sm:w-[calc(33.333%-16px)]' :
        'w-full';

    if (field.type === 'heading') {
        return (
            <div className="w-full pt-4">
                {field.headingLevel === 'h1' && <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{field.label}</h1>}
                {field.headingLevel === 'h3' && <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 leading-snug">{field.label}</h3>}
                {(!field.headingLevel || field.headingLevel === 'h2') && <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-snug">{field.label}</h2>}
            </div>
        );
    }

    if (field.type === 'paragraph') {
        return (
            <div className="w-full">
                {field.label && <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">{field.label}</p>}
                <p 
                    style={{ 
                        borderRadius: '4px', 
                        padding: '16px 24px', 
                        backgroundColor: theme.surface, 
                        border: `1.5px solid ${theme.border}`,
                        color: theme.text 
                    }} 
                    className="text-xs sm:text-sm leading-relaxed"
                >
                    {field.content || field.description}
                </p>
            </div>
        );
    }

    if (field.type === 'divider') {
        return (
            <div className="w-full pt-4 pb-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{field.label}</h3>
                <div className="mt-2.5 border-b border-slate-200" />
            </div>
        );
    }

    return (
        <div className={widthClass}>
            {/* Label dengan Jarak mb-1.5 & Indent 2px */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: theme.textStrong, marginBottom: '4px', paddingLeft: '2px', lineHeight: 1.3 }}>
                {field.label}
                {field.required && <span style={{ color: '#e11d48', marginLeft: '4px', fontWeight: 800 }}>*</span>}
            </label>
            {field.description && <p style={{ fontSize: '12px', color: theme.muted, marginBottom: '8px', paddingLeft: '2px', fontWeight: 500, lineHeight: 1.4 }}>{field.description}</p>}

            {field.type === 'textarea' && (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows || 4}
                    style={{
                        borderRadius: '4px',
                        minHeight: '100px',
                        padding: '12px 16px',
                        border: `1px solid ${theme.fieldBorder}`,
                        backgroundColor: theme.surface,
                        color: theme.text,
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                        lineHeight: 1.6,
                    }}
                    className="focus:ring-2 focus:ring-[#3083FF]/20 focus:border-[#3083FF] transition-all"
                />
            )}

            {field.type === 'select' && (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        borderRadius: '4px',
                        height: '42px',
                        padding: '0 16px',
                        border: `1px solid ${theme.fieldBorder}`,
                        backgroundColor: theme.surface,
                        color: theme.text,
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                    className="focus:ring-2 focus:ring-[#3083FF]/20 focus:border-[#3083FF] transition-all"
                >
                    <option value="">-- Pilih {field.label} --</option>
                    {fieldOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            )}

            {field.type === 'radio' && (
                <div className="space-y-3 pt-1 pl-0.5">
                    {fieldOptions.map((opt) => {
                        const isSelected = value === opt.value;
                        return (
                            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                                <span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
                                    <input
                                        type="radio"
                                        name={field.id}
                                        value={opt.value}
                                        checked={isSelected}
                                        onChange={(e) => onChange(e.target.value)}
                                        style={{ backgroundColor: theme.surface, borderColor: isSelected ? '#3083FF' : theme.fieldBorder }}
                                        className="appearance-none w-4 h-4 rounded-full border-2 cursor-pointer transition-colors"
                                    />
                                    {isSelected && <span className="absolute w-2 h-2 rounded-full bg-[#3083FF] pointer-events-none" />}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 leading-relaxed font-medium">{opt.label}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            {field.type === 'checkbox' && (
                <div className="space-y-3 pt-1 pl-0.5">
                    {fieldOptions.map((opt) => {
                        const checked = Array.isArray(value) && value.includes(opt.value);
                        return (
                            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                                <span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => onCheckboxChange(opt.value, e.target.checked)}
                                        style={{ backgroundColor: checked ? '#3083FF' : theme.surface, borderColor: checked ? '#3083FF' : theme.fieldBorder }}
                                        className="appearance-none w-4 h-4 rounded border-2 cursor-pointer transition-colors"
                                    />
                                    {checked && <i className="bi bi-check-lg absolute text-white pointer-events-none" style={{ fontSize: '11px', lineHeight: 1 }} />}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 leading-relaxed font-medium">{opt.label}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            {field.type === 'rating' && (
                <div className="flex items-center gap-3.5 py-1 pl-0.5">
                    {field.photoUrl && (
                        <img
                            src={field.photoUrl}
                            alt={field.label}
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `2px solid ${theme.border}`,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                                flexShrink: 0,
                            }}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    )}
                    <div className="flex items-center gap-2 text-2xl text-amber-400">
                        {Array.from({ length: field.maxRating || 5 }).map((_, i) => {
                            const val = i + 1;
                            const isFilled = (value || 0) >= val;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onChange(val)}
                                    className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                                >
                                    <i className={`bi ${isFilled ? 'bi-star-fill text-amber-400' : 'bi-star text-slate-300 dark:text-slate-600'}`} />
                                </button>
                            );
                        })}
                        {value && <span className="text-xs font-bold text-slate-600 ml-2">({value} / {field.maxRating || 5})</span>}
                    </div>
                </div>
            )}

            {field.type === 'slider' && (
                <div className="space-y-2 py-1 pl-0.5">
                    <input
                        type="range"
                        min={Number(field.min ?? 1)}
                        max={Number(field.max ?? 10)}
                        step={Number(field.step ?? 1)}
                        value={value ?? field.min ?? 1}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="w-full accent-[#3083FF] cursor-pointer"
                    />
                    <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>Min: {field.min ?? 1}</span>
                        <span className="text-[#3083FF] font-bold bg-blue-50 px-2.5 py-0.5 rounded">Nilai: {value ?? field.min ?? 1}</span>
                        <span>Maks: {field.max ?? 10}</span>
                    </div>
                </div>
            )}

            {field.type === 'file' && (
                <div>
                    <input
                        type="file"
                        accept={field.accept}
                        multiple={field.multiple}
                        onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                                onChange(Array.from(files).map(f => f.name));
                            }
                        }}
                        style={{
                            borderRadius: '4px',
                            height: '42px',
                            padding: '8px 20px',
                            border: `1px solid ${theme.fieldBorder}`,
                            backgroundColor: theme.surface,
                            color: theme.text,
                            fontSize: '13px',
                            fontWeight: 500,
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                        className="focus:ring-2 focus:ring-[#3083FF]/20 focus:border-[#3083FF] transition-all"
                    />
                    <p style={{ fontSize: '11px', color: theme.light, marginTop: '6px', paddingLeft: '2px' }}>Maksimum {field.maxSize || 5} MB</p>
                </div>
            )}

            {['text', 'number', 'email', 'phone', 'url', 'date', 'time', 'datetime'].includes(field.type) && (
                <input
                    type={
                        field.type === 'phone' ? 'tel' :
                        field.type === 'datetime' ? 'datetime-local' :
                        field.type
                    }
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    min={field.min as any}
                    max={field.max as any}
                    style={{
                        borderRadius: '4px',
                        height: '42px',
                        padding: '0 16px',
                        border: `1px solid ${theme.fieldBorder}`,
                        backgroundColor: theme.surface,
                        color: theme.text,
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                    className="focus:ring-2 focus:ring-[#3083FF]/20 focus:border-[#3083FF] transition-all"
                />
            )}
        </div>
    );
}
