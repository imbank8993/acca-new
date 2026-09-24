'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import SeleksiTab from './tabs/SeleksiTab';
import { useDashboardUser } from '@/components/UserContext';

function ResponsesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const formId = searchParams.get('id');
    const { user } = useDashboardUser();
    // Sama dengan gate di /form dan API: Admin & OP_Form boleh mengelola tanggapan
    const canManage = user?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'OP_FORM'].includes(r.toUpperCase())) || false;

    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'charts' | 'table' | 'seleksi'>('charts');
    const [searchTerm, setSearchTerm] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formSchema, setFormSchema] = useState<any>({});
    const [responses, setResponses] = useState<any[]>([]);
    const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (!formId) {
            Swal.fire('Error', 'ID Form tidak ditemukan', 'error');
            router.push('/form');
            return;
        }

        fetchResponses();
    }, [formId, mounted]);

    const fetchResponses = async () => {
        try {
            const res = await fetch(`/api/forms/${formId}/responses`);
            const data = await res.json();
            if (res.ok && data.form) {
                if (!canManage && data.form.created_by !== user?.id) {
                    Swal.fire('Ditolak', 'Anda tidak memiliki akses ke tanggapan formulir ini.', 'error');
                    router.push('/form');
                    return;
                }
                setFormTitle(data.form.title);
                setFormSchema(data.form.schema || {});
                setResponses(data.responses || []);
            } else {
                Swal.fire('Gagal Memuat', data.error || 'Gagal memuat hasil tanggapan form', 'error');
            }
        } catch (error) {
            console.error('Error fetching responses:', error);
            Swal.fire('Error', 'Terjadi kesalahan server saat mengambil data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteResponse = async (item: any) => {
        const dateVal = item.created_at || item.submitted_at;
        const dateStr = dateVal ? new Date(dateVal).toLocaleString('id-ID') : '-';
        // Ambil jawaban pertama yang terisi sebagai penanda responden di dialog konfirmasi
        const preview = Object.values(item.data || {}).find(v => v !== null && v !== undefined && v !== '');

        const confirm = await Swal.fire({
            title: 'Hapus Tanggapan?',
            html: `<div style="text-align:left;font-size:13px">
                <p style="margin:0 0 8px"><b>${preview ? String(Array.isArray(preview) ? preview.join(', ') : preview) : 'Tanggapan ini'}</b></p>
                <p style="margin:0;color:#64748b">Waktu submit: ${dateStr}</p>
                <p style="margin:8px 0 0;color:#dc2626">Data tanggapan ini dihapus permanen dan tidak bisa dikembalikan.</p>
            </div>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
        });

        if (!confirm.isConfirmed) return;

        try {
            const res = await fetch(`/api/forms/${formId}/responses?responseId=${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                Swal.fire('Gagal', json.error || 'Tanggapan gagal dihapus', 'error');
                return;
            }

            setResponses(prev => prev.filter(r => r.id !== item.id));
            setSelectedResponse((prev: any) => (prev?.id === item.id ? null : prev));
            Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Tanggapan responden telah dihapus.', timer: 1600, showConfirmButton: false });
        } catch (e: any) {
            Swal.fire('Error', e.message || 'Terjadi kesalahan server saat menghapus', 'error');
        }
    };

    const handleExportExcel = () => {
        if (responses.length === 0) {
            Swal.fire('Informasi', 'Belum ada data tanggapan untuk diekspor', 'info');
            return;
        }

        const fields = (formSchema.fields || []).filter(
            (f: any) => !['heading', 'paragraph', 'divider', 'page_break'].includes(f.type)
        );
        const hasScoring = (formSchema.fields || []).some((f: any) => f.enableScoring);

        const categoryScoreKeys = hasScoring ? Array.from(new Set(responses.flatMap((r: any) => Object.keys(r.category_scores || {})))) : [];

        let tableHtml = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
    <meta charset="utf-8">
    <style>
        table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
        th { background-color: #3083FF; color: white; font-weight: bold; padding: 12px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 13px; text-align: left; }
        td { padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; color: #334155; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th width="50" class="text-center">NO</th>
                <th width="150">WAKTU SUBMIT</th>
                ${hasScoring ? '<th width="100" class="text-center">TOTAL SKOR</th>' : ''}`;
        
        categoryScoreKeys.forEach(k => {
            tableHtml += `<th>${k.toUpperCase()}</th>`;
        });

        fields.forEach((f: any) => {
            tableHtml += `<th>${f.label}</th>`;
        });

        tableHtml += `
            </tr>
        </thead>
        <tbody>`;

        responses.forEach((resp, idx) => {
            const dateVal = resp.created_at || resp.submitted_at;
            const dateStr = dateVal ? new Date(dateVal).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-';
            
            tableHtml += `<tr>
                <td class="text-center font-bold">${idx + 1}</td>
                <td>${dateStr}</td>
                ${hasScoring ? `<td class="text-center font-bold">${resp.total_score ?? '-'}</td>` : ''}`;
                
            categoryScoreKeys.forEach(k => {
                tableHtml += `<td class="text-center font-bold" style="color:#3083FF">${resp.category_scores?.[k] ?? '-'}</td>`;
            });

            fields.forEach((f: any) => {
                const val = resp.data?.[f.label];
                let displayVal = '-';
                if (val !== undefined && val !== null && val !== '') {
                    if (Array.isArray(val)) displayVal = val.join(', ');
                    else displayVal = String(val);
                }
                // Escape HTML
                displayVal = displayVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                tableHtml += `<td>${displayVal}</td>`;
            });
            
            tableHtml += `</tr>`;
        });

        tableHtml += `
        </tbody>
    </table>
</body>
</html>`;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Hasil_Tanggapan_${formTitle.replace(/\s+/g, '_')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handlePrintSummary = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="w-full">
                <div 
                    className="print:hidden w-full relative overflow-hidden" 
                    style={{ 
                        marginBottom: '24px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #3083ff 0%, #c2185b 100%)',
                        padding: '24px 32px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                >
                    <div className="relative z-10 flex items-center gap-4">
                        <Link
                            href="/form"
                            style={{ borderRadius: '8px' }}
                            className="w-10 h-10 bg-white dark:bg-slate-900/20 hover:bg-white dark:bg-slate-900/30 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
                            title="Kembali ke Daftar Form"
                        >
                            <i className="bi bi-arrow-left text-lg" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-white m-0 leading-tight animate-pulse">
                                Tanggapan dan Statistik...
                            </h1>
                            <p className="text-blue-100 mt-1 mb-0 text-sm opacity-90 font-medium">
                                Memuat data form...
                            </p>
                        </div>
                    </div>
                </div>
                <div className="w-full">
                    <div 
                        style={{ borderRadius: '8px', backgroundColor: 'var(--n-card)', border: '1px solid var(--n-border)', padding: '64px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }} 
                        className="text-center"
                    >
                        <div className="animate-spin inline-block w-10 h-10 border-4 border-blue-100 dark:border-blue-800/50 border-t-[#3083FF] rounded-full mb-4"></div>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: '#334155', margin: 0 }}>Memuat Hasil Tanggapan & Analisis...</p>
                        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>Mohon tunggu sebentar, sedang menyinkronkan data.</p>
                    </div>
                </div>
            </div>
        );
    }

    const inputFields = (formSchema.fields || []).filter(
        (f: any) => !['heading', 'paragraph', 'divider', 'page_break'].includes(f.type)
    );
    const hasScoring = (formSchema.fields || []).some((f: any) => f.enableScoring);
    const categoryScoreKeys = hasScoring ? Array.from(new Set(responses.flatMap((r: any) => Object.keys(r.category_scores || {})))) : [];

    // Filter responses for table search
    const filteredResponses = responses.filter(resp => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return Object.values(resp.data || {}).some(val => 
            String(val).toLowerCase().includes(q)
        );
    });

    const latestSubmissionDate = responses.length > 0 
        ? new Date(responses[0].created_at || responses[0].submitted_at).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        : '-';

    // Palette warna grafik
    const barColors = [
        { bg: '#059669', bar: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', light: '#ecfdf5', border: '#a7f3d0' },
        { bg: '#0284c7', bar: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)', light: '#f0f9ff', border: '#bae6fd' },
        { bg: '#7c3aed', bar: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)', light: '#f5f3ff', border: '#ddd6fe' },
        { bg: '#d97706', bar: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)', light: '#fffbeb', border: '#fde68a' },
        { bg: '#e11d48', bar: 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)', light: '#fff1f2', border: '#fecdd3' },
        { bg: '#0891b2', bar: 'linear-gradient(90deg, #22d3ee 0%, #0891b2 100%)', light: '#ecfeff', border: '#a5f3fc' },
    ];

    return (
        <div className="w-full pb-12">
            <style>{`
                @media print {
                    /* Print resets to show multi-page correctly */
                    html, body {
                        background-color: white !important;
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        position: static !important;
                        width: auto !important;
                    }
                    
                    /* Force ALL wrappers to be visible to kill internal scrollbars */
                    * {
                        overflow: visible !important;
                    }

                    .dashboard-layout, 
                    .main-content, 
                    .content-area, 
                    .content-container {
                        position: static !important;
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        left: 0 !important;
                        top: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: auto !important;
                        max-width: none !important;
                        border-radius: 0 !important;
                        transform: none !important;
                    }
                    
                    /* Hide EVERYTHING in dashboard layout by default */
                    .dashboard-layout > * {
                        display: none !important;
                    }
                    
                    /* Except the main content wrapper */
                    .dashboard-layout > .main-content {
                        display: block !important;
                    }
                }
            `}</style>
            {/* Header Banner — Informasi */}
            <div 
                className="print:hidden w-full relative overflow-hidden" 
                style={{ 
                    marginBottom: '24px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3083ff 0%, #c2185b 100%)',
                    padding: '24px 32px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
            >
                {/* Dekorasi Banner */}
                <div className="absolute top-0 right-0 w-64 h-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)', transform: 'translate(30%, -20%)' }}></div>
                <div className="absolute bottom-0 left-0 w-48 h-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)', transform: 'translate(-20%, 30%)' }}></div>

                <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/form"
                            style={{ borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)' }}
                            className="w-10 h-10 border border-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0 hover:bg-white/20"
                            title="Kembali ke Daftar Form"
                        >
                            <i className="bi bi-arrow-left text-lg" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-white m-0 leading-tight drop-shadow-sm">
                                Tanggapan dan Statistik
                            </h1>
                            <p className="text-blue-100 mt-1 mb-0 text-sm opacity-90 font-medium">
                                {formTitle}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrintSummary}
                            style={{
                                borderRadius: '6px',
                                height: '40px',
                                padding: '0 18px',
                                fontSize: '13px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                backdropFilter: 'blur(4px)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer'
                            }}
                            className="hover:bg-white dark:bg-slate-900/25 transition-colors"
                        >
                            <i className="bi bi-printer text-base" />
                            <span>Cetak Laporan</span>
                        </button>
                        <button
                            onClick={handleExportExcel}
                            style={{
                                borderRadius: '6px',
                                height: '40px',
                                padding: '0 20px',
                                fontSize: '13px',
                                fontWeight: 800,
                                backgroundColor: '#ffffff',
                                color: '#3083FF',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            className="hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 transition-colors text-[#3083FF] dark:text-blue-400"
                        >
                            <i className="bi bi-file-earmark-spreadsheet-fill text-base text-emerald-600" />
                            <span>EXPORT</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Title Header (hanya muncul saat cetak) */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-black text-slate-900 mb-1">{formTitle}</h1>
                <p className="text-sm font-medium text-slate-600">Laporan Ringkasan Statistik Isian Formulir • Total Tanggapan: {responses.length}</p>
            </div>

            <div className="w-full space-y-6">
                {/* ── KARTU STATISTIK UTAMA (KPI CARDS) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
                    <div 
                        style={{ 
                            borderRadius: '6px', 
                            padding: '18px 20px', 
                            backgroundColor: 'var(--n-card)', 
                            border: '1px solid var(--n-border)', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '14px' 
                        }}
                    >
                        <div style={{ borderRadius: '4px' }} className="w-11 h-11 bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xl flex-shrink-0">
                            <i className="bi bi-inbox-fill" />
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>TOTAL TANGGAPAN</p>
                            <h4 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--n-text)', margin: 0 }}>{responses.length} <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Responden</span></h4>
                        </div>
                    </div>

                    <div 
                        style={{ 
                            borderRadius: '6px', 
                            padding: '18px 20px', 
                            backgroundColor: 'var(--n-card)', 
                            border: '1px solid var(--n-border)', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '14px' 
                        }}
                    >
                        <div style={{ borderRadius: '4px' }} className="w-11 h-11 bg-blue-50 dark:bg-blue-900/30 text-[#3083FF] dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-xl flex-shrink-0">
                            <i className="bi bi-layout-text-sidebar-reverse" />
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>TOTAL PERTANYAAN</p>
                            <h4 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--n-text)', margin: 0 }}>{inputFields.length} <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Komponen</span></h4>
                        </div>
                    </div>

                    <div 
                        style={{ 
                            borderRadius: '6px', 
                            padding: '18px 20px', 
                            backgroundColor: 'var(--n-card)', 
                            border: '1px solid var(--n-border)', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '14px' 
                        }}
                    >
                        <div style={{ borderRadius: '4px' }} className="w-11 h-11 bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center text-xl flex-shrink-0">
                            <i className="bi bi-clock-history" />
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>TANGGAPAN TERAKHIR</p>
                            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--n-text)', margin: 0 }} className="truncate max-w-[160px]">{latestSubmissionDate}</h4>
                        </div>
                    </div>

                    <div 
                        style={{ 
                            borderRadius: '6px', 
                            padding: '18px 20px', 
                            backgroundColor: 'var(--n-card)', 
                            border: '1px solid var(--n-border)', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '14px' 
                        }}
                    >
                        <div style={{ borderRadius: '4px' }} className="w-11 h-11 bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xl flex-shrink-0">
                            <i className="bi bi-pie-chart-fill" />
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>STATUS ANALISIS</p>
                            <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--n-text)', margin: 0 }} className="flex items-center gap-1.5">
                                <i className="bi bi-check-circle-fill text-xs" />
                                Real-Time Sync
                            </h4>
                        </div>
                    </div>
                </div>

                {/* ── NAVIGASI TAB MODAL (CHARTS VS TABLE) ── */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-4 mb-6 print:hidden">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('charts')}
                            style={{
                                borderRadius: '4px',
                                padding: '8px 18px',
                                fontSize: '12px',
                                fontWeight: 800,
                                backgroundColor: activeTab === 'charts' ? 'var(--n-primary)' : 'var(--n-card)',
                                color: activeTab === 'charts' ? '#ffffff' : 'var(--n-text)',
                                border: activeTab === 'charts' ? '1px solid var(--n-primary)' : '1px solid var(--n-border)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            className="transition-all shadow-2xs"
                        >
                            <i className="bi bi-bar-chart-line-fill text-sm" />
                            <span>Ringkasan & Grafik Statistik</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('table')}
                            style={{
                                borderRadius: '4px',
                                padding: '0 18px',
                                height: '36px',
                                fontSize: '12px',
                                fontWeight: 800,
                                backgroundColor: activeTab === 'table' ? 'var(--n-primary)' : 'var(--n-card)',
                                color: activeTab === 'table' ? '#ffffff' : 'var(--n-text)',
                                border: activeTab === 'table' ? '1px solid var(--n-primary)' : '1px solid var(--n-border)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            className="transition-all shadow-2xs"
                        >
                            <i className="bi bi-table text-sm" />
                            <span>Tabel Tanggapan Individual ({responses.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('seleksi')}
                            style={{
                                borderRadius: '4px',
                                padding: '0 18px',
                                height: '36px',
                                fontSize: '12px',
                                fontWeight: 800,
                                backgroundColor: activeTab === 'seleksi' ? 'var(--n-primary)' : 'var(--n-card)',
                                color: activeTab === 'seleksi' ? '#ffffff' : 'var(--n-text)',
                                border: activeTab === 'seleksi' ? '1px solid var(--n-primary)' : '1px solid var(--n-border)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            className="transition-all shadow-2xs"
                        >
                            <i className="bi bi-funnel-fill text-sm" />
                            <span>Kuota & Hasil Seleksi</span>
                        </button>
                    </div>

                    {activeTab === 'table' && (
                        <div className="relative w-64 flex items-center">
                            <i className="bi bi-search absolute left-3 text-slate-400 text-sm" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                placeholder="Cari isi tanggapan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ borderRadius: '6px', padding: '0 12px 0 34px', height: '36px' }}
                                className="w-full text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-[#3083FF] focus:ring-1 focus:ring-[#3083FF] bg-white dark:bg-slate-900 transition-all shadow-sm"
                            />
                        </div>
                    )}
                </div>

                {/* ── TAB 1: RINGKASAN & GRAFIK STATISTIK ── */}
                {(activeTab === 'charts' || typeof window !== 'undefined' && window.matchMedia('print').matches) && (
                    <div className="flex flex-col gap-4 clear-both w-full" style={{ marginTop: '12px' }}>
                        {responses.length === 0 ? (
                            <div style={{ borderRadius: '6px', padding: '64px', backgroundColor: 'var(--n-card)', border: '1px solid var(--n-border)' }} className="text-center text-slate-500 dark:text-slate-400">
                                <i className="bi bi-pie-chart text-4xl block mb-2 opacity-40 text-blue-600" />
                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Belum Ada Tanggapan Masuk</p>
                                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Grafik statistik dan analisis persentase akan muncul secara otomatis setelah responden mengisi formulir ini.</p>
                            </div>
                        ) : (
                            inputFields.map((f: any, idx: number) => {
                                const label = f.label || `Pertanyaan #${idx + 1}`;
                                const type = f.type;
                                const isChoiceField = ['radio', 'select', 'checkbox', 'dropdown'].includes(type);
                                const isRatingField = type === 'rating';
                                const isNumberField = type === 'number';

                                // Hitung Frekuensi Jawaban
                                const optionCounts: Record<string, number> = {};
                                let totalAnsweredCount = 0;
                                let numericSum = 0;
                                let numericMin = Infinity;
                                let numericMax = -Infinity;
                                const textAnswers: string[] = [];

                                responses.forEach((resp) => {
                                    const val = resp.data?.[label];
                                    if (val !== undefined && val !== null && val !== '') {
                                        totalAnsweredCount++;

                                        if (Array.isArray(val)) {
                                            val.forEach(v => {
                                                const s = String(v).trim();
                                                if (s) optionCounts[s] = (optionCounts[s] || 0) + 1;
                                            });
                                        } else if (isChoiceField || isRatingField) {
                                            const s = String(val).trim();
                                            optionCounts[s] = (optionCounts[s] || 0) + 1;
                                        } else if (isNumberField) {
                                            const num = Number(val);
                                            if (!isNaN(num)) {
                                                numericSum += num;
                                                if (num < numericMin) numericMin = num;
                                                if (num > numericMax) numericMax = num;
                                            }
                                        } else {
                                            textAnswers.push(String(val));
                                        }
                                    }
                                });

                                // Untuk Choice Field: kumpulkan semua opsi bawaan jika ada
                                const allOptions: string[] = [];
                                if (Array.isArray(f.options)) {
                                    f.options.forEach((opt: any) => {
                                        const optLabel = typeof opt === 'string' ? opt : opt.label;
                                        if (optLabel && !allOptions.includes(optLabel)) allOptions.push(optLabel);
                                    });
                                }
                                // Tambahkan opsi yang mungkin tidak terdaftar tetapi diisi
                                Object.keys(optionCounts).forEach(opt => {
                                    if (!allOptions.includes(opt)) allOptions.push(opt);
                                });

                                return (
                                    <div
                                        key={f.id || idx}
                                        style={{
                                            borderRadius: '8px',
                                            padding: '20px 24px',
                                            backgroundColor: 'var(--n-card)',
                                            border: '1px solid var(--n-border)',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                        }}
                                        className="break-inside-avoid"
                                    >
                                        {/* Header Card Pertanyaan */}
                                        <div className="flex flex-col gap-1.5 pb-5 mb-5 border-b-2 border-dashed border-slate-200 dark:border-slate-700/50">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-[#3083FF] dark:text-blue-400 tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/50 shadow-sm">
                                                    Pertanyaan #{idx + 1} • {type.toUpperCase()}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700/50">
                                                    {totalAnsweredCount} / {responses.length} Terisi ({responses.length > 0 ? Math.round((totalAnsweredCount / responses.length) * 100) : 0}%)
                                                </span>
                                            </div>
                                            <h3 className="text-[15px] font-extrabold text-[#0f172a] dark:text-slate-100 leading-snug mt-1">
                                                {label}
                                            </h3>
                                        </div>

                                        {/* GRAFIK PILIHAN GANDA / CHECKBOX / DROPDOWN */}
                                        {isChoiceField && (
                                            <div className="flex flex-col gap-3 clear-both w-full" style={{ marginTop: '12px' }}>
                                                {allOptions.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic">Tidak ada opsi terkonfigurasi.</p>
                                                ) : (
                                                    allOptions.map((opt, optIdx) => {
                                                        const count = optionCounts[opt] || 0;
                                                        const pct = totalAnsweredCount > 0 ? Math.round((count / totalAnsweredCount) * 100) : 0;
                                                        const palette = barColors[optIdx % barColors.length];

                                                        return (
                                                            <div key={opt} className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between text-[13px] font-bold">
                                                                    <span className="text-slate-800 flex items-center gap-2.5">
                                                                        <span 
                                                                            className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 shadow-sm"
                                                                            style={{ backgroundColor: palette.bg }}
                                                                        />
                                                                        {opt}
                                                                    </span>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">{count} tanggapan</span>
                                                                        <span 
                                                                            className="px-2 py-0.5 text-[11px] font-black rounded"
                                                                            style={{ backgroundColor: palette.light, color: palette.bg }}
                                                                        >
                                                                            {pct}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {/* Progress bar container */}
                                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                                    <div 
                                                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                                                        style={{ 
                                                                            width: `${pct}%`, 
                                                                            background: palette.bar 
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}

                                        {/* GRAFIK RATING BINTANG (1-5 STARS) */}
                                        {isRatingField && (
                                            <div className="flex flex-col gap-4 clear-both w-full" style={{ marginTop: '12px' }}>
                                                <div className="w-fit self-end flex bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm overflow-hidden mb-3" style={{ borderRadius: '6px' }}>
                                                    <div className="flex flex-col items-center justify-center bg-amber-100/40 border-r border-amber-200/60" style={{ padding: '6px 10px' }}>
                                                        <span className="text-lg font-black text-amber-600 leading-none mb-1">
                                                            {(totalAnsweredCount > 0 
                                                                ? (Object.entries(optionCounts).reduce((acc, [k, v]) => acc + (Number(k) || 0) * v, 0) / totalAnsweredCount).toFixed(1)
                                                                : '0.0')}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-amber-700/80 uppercase tracking-widest">Rata-rata</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-amber-400 text-base" style={{ padding: '6px 10px' }}>
                                                        <i className="bi bi-star-fill" />
                                                        <i className="bi bi-star-fill" />
                                                        <i className="bi bi-star-fill" />
                                                        <i className="bi bi-star-fill" />
                                                        <i className="bi bi-star-half" />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2.5 px-1 mt-1">
                                                {[5, 4, 3, 2, 1].map((star) => {
                                                    const count = optionCounts[String(star)] || 0;
                                                    const pct = totalAnsweredCount > 0 ? Math.round((count / totalAnsweredCount) * 100) : 0;
                                                    return (
                                                        <div key={star} className="flex items-center gap-3 text-xs">
                                                            <span className="w-10 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1 text-[13px]">
                                                                {star} <i className="bi bi-star-fill text-amber-400 text-[11px]" />
                                                            </span>
                                                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                                <div 
                                                                    className="h-full bg-amber-400 rounded-full transition-all duration-700 ease-out"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="w-20 text-right text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                                                                {count} ({pct}%)
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                </div>
                                            </div>
                                        )}

                                        {/* STATISTIK NUMERIK (ANGKA) */}
                                        {isNumberField && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 clear-both w-full" style={{ marginTop: '12px' }}>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded border border-slate-200 dark:border-slate-700/50 text-center">
                                                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Rata-Rata</span>
                                                    <span className="text-base font-black text-[#3083FF] dark:text-blue-400">
                                                        {totalAnsweredCount > 0 ? (numericSum / totalAnsweredCount).toFixed(2) : 0}
                                                    </span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded border border-slate-200 dark:border-slate-700/50 text-center">
                                                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Nilai Tertinggi</span>
                                                    <span className="text-base font-black text-emerald-700">
                                                        {numericMax !== -Infinity ? numericMax : 0}
                                                    </span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded border border-slate-200 dark:border-slate-700/50 text-center">
                                                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Nilai Terendah</span>
                                                    <span className="text-base font-black text-rose-600">
                                                        {numericMin !== Infinity ? numericMin : 0}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* LIST TEKS JAWABAN */}
                                        {!isChoiceField && !isRatingField && !isNumberField && (
                                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                                                {textAnswers.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic">Belum ada isian teks.</p>
                                                ) : (
                                                    textAnswers.map((txt, txtIdx) => (
                                                        <div 
                                                            key={txtIdx} 
                                                            className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-2.5 rounded font-medium flex items-start gap-2"
                                                        >
                                                            <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 px-1.5 py-0.5 rounded">
                                                                #{txtIdx + 1}
                                                            </span>
                                                            <span className="flex-1 whitespace-pre-wrap">{txt}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ── TAB 2: TABEL TANGGAPAN INDIVIDUAL ── */}
                {activeTab === 'table' && (
                    <div 
                        style={{ 
                            borderRadius: '6px', 
                            padding: '24px 28px', 
                            backgroundColor: 'var(--n-card)', 
                            border: '1px solid var(--n-border)', 
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            marginTop: '12px',
                            clear: 'both'
                        }}
                        className="print:block w-full"
                    >
                        {filteredResponses.length === 0 ? (
                            <div style={{ padding: '64px', textAlign: 'center', color: '#94a3b8' }}>
                                <i className="bi bi-inbox text-4xl block mb-2 opacity-40 text-[#3083FF] dark:text-blue-400"></i>
                                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Tidak ada tanggapan ditemukan.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '50px' }}>
                                                #
                                            </th>
                                            <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '160px' }}>
                                                Waktu Submit
                                            </th>
                                            {hasScoring && (
                                                <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 700, color: '#3083FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '100px', textAlign: 'center' }}>
                                                    Total Skor
                                                </th>
                                            )}
                                            {categoryScoreKeys.map(k => (
                                                <th key={k} style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 700, color: '#3083FF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '100px', textAlign: 'center' }}>
                                                    {k}
                                                </th>
                                            ))}
                                            {inputFields.map((f: any, idx: number) => (
                                                <th key={f.id || idx} style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', minWidth: '180px' }}>
                                                    {f.label}
                                                </th>
                                            ))}
                                            <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', textAlign: 'right', width: '80px' }} className="print:hidden">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredResponses.map((item, idx) => {
                                            const dateVal = item.created_at || item.submitted_at;
                                            const dateStr = dateVal ? new Date(dateVal).toLocaleString('id-ID', {
                                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            }) : '-';

                                            return (
                                                <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-xs">
                                                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#64748b' }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>
                                                        {dateStr}
                                                    </td>
                                                    {hasScoring && (
                                                        <td style={{ padding: '12px 16px', color: '#3083FF', fontWeight: 800, textAlign: 'center' }}>
                                                            {item.total_score ?? '-'}
                                                        </td>
                                                    )}
                                                    {categoryScoreKeys.map(k => (
                                                        <td key={k} style={{ padding: '12px 16px', color: '#3083FF', fontWeight: 700, textAlign: 'center' }}>
                                                            {item.category_scores?.[k] ?? '-'}
                                                        </td>
                                                    ))}
                                                    {inputFields.map((f: any, fIdx: number) => {
                                                        const val = item.data?.[f.label];
                                                        let displayVal = '-';
                                                        if (val !== undefined && val !== null && val !== '') {
                                                            if (Array.isArray(val)) displayVal = val.join(', ');
                                                            else displayVal = String(val);
                                                        }
                                                        return (
                                                            <td key={f.id || fIdx} style={{ padding: '12px 16px', color: 'var(--n-text)', fontWeight: 500 }} className="max-w-xs truncate">
                                                                {displayVal}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '12px 16px', textAlign: 'right' }} className="print:hidden">
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => setSelectedResponse(item)}
                                                                style={{
                                                                    borderRadius: '4px',
                                                                    height: '28px',
                                                                    padding: '0 10px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 700,
                                                                    color: '#3083FF',
                                                                    backgroundColor: '#eff6ff',
                                                                    border: '1px solid #bfdbfe',
                                                                    cursor: 'pointer',
                                                                }}
                                                                title="Lihat Detail Tanggapan"
                                                            >
                                                                Detail
                                                            </button>
                                                            {canManage && (
                                                                <button
                                                                    onClick={() => handleDeleteResponse(item)}
                                                                    style={{
                                                                        borderRadius: '4px',
                                                                        height: '28px',
                                                                        padding: '0 10px',
                                                                        fontSize: '10px',
                                                                        fontWeight: 700,
                                                                        color: '#dc2626',
                                                                        backgroundColor: '#fef2f2',
                                                                        border: '1px solid #fecaca',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                    title="Hapus Tanggapan Responden"
                                                                >
                                                                    <i className="bi bi-trash" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 3: KUOTA & HASIL SELEKSI ── */}
                {activeTab === 'seleksi' && (
                    <SeleksiTab
                        formId={formId as string}
                        formTitle={formTitle}
                        formSchema={formSchema}
                        responses={responses}
                        onPersisted={fetchResponses}
                    />
                )}
            </div>

            {/* ── MODAL DETAIL RESPONDEN INDIVIDUAL ── */}
            {selectedResponse && mounted && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50" style={{ padding: '20px' }}>
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col" style={{ width: '700px', maxWidth: '100%' }}>
                        
                        {/* HEADER */}
                        <div className="bg-[#3083FF] text-white flex items-center justify-between border-b border-[#002878]" style={{ padding: '14px 24px' }}>
                            <div className="flex items-center" style={{ gap: '14px' }}>
                                <i className="bi bi-person-lines-fill text-blue-200" style={{ fontSize: '24px' }} />
                                <div>
                                    <h3 className="font-black m-0 text-white leading-none tracking-wide" style={{ fontSize: '17px' }}>Detail Tanggapan Responden</h3>
                                    <p className="text-blue-200 m-0 font-medium tracking-wide" style={{ fontSize: '12px', marginTop: '4px' }}>
                                        Waktu Submit: {selectedResponse.created_at ? new Date(selectedResponse.created_at).toLocaleString('id-ID') : '-'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedResponse(null)}
                                className="text-blue-200 hover:text-white transition-colors cursor-pointer"
                                style={{ padding: '8px', background: 'none', border: 'none' }}
                            >
                                <i className="bi bi-x-lg" style={{ fontSize: '20px' }} />
                            </button>
                        </div>

                        {/* BODY */}
                        <div className="bg-white dark:bg-slate-900" style={{ padding: '24px 32px', maxHeight: '65vh', overflowY: 'auto' }}>
                            {hasScoring && categoryScoreKeys.length > 0 && (
                                                                <div className="mb-4 bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex gap-4 flex-wrap">
                                                                    <div className="flex-1 min-w-[120px]">
                                                                        <label className="font-bold text-slate-500 uppercase tracking-widest block text-[10px] mb-1">Total Skor Utama</label>
                                                                        <p className="font-black text-[#3083FF] dark:text-blue-400 text-xl m-0">{selectedResponse.total_score ?? '-'}</p>
                                                                    </div>
                                                                    {categoryScoreKeys.map(k => (
                                                                        <div key={k} className="flex-1 min-w-[120px]">
                                                                            <label className="font-bold text-slate-500 uppercase tracking-widest block text-[10px] mb-1">{k}</label>
                                                                            <p className="font-black text-[#3083FF] dark:text-blue-400 text-xl m-0">{selectedResponse.category_scores?.[k] ?? '-'}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {inputFields.map((f: any, idx: number) => {
                                const val = selectedResponse.data?.[f.label];
                                let displayVal = 'Tidak Diisi';
                                if (val !== undefined && val !== null && val !== '') {
                                    if (Array.isArray(val)) displayVal = val.join(', ');
                                    else displayVal = String(val);
                                }
                                return (
                                    <div key={f.id || idx} style={{ marginBottom: '16px' }} className="last:mb-0">
                                        <label className="font-bold text-slate-500 uppercase tracking-widest block" style={{ fontSize: '11px', marginBottom: '6px' }}>
                                            {f.label}
                                        </label>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 shadow-sm" style={{ padding: '10px 14px', borderRadius: '8px' }}>
                                            <p className="font-bold text-slate-800 whitespace-pre-wrap m-0 leading-relaxed" style={{ fontSize: '14px' }}>
                                                {displayVal}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* FOOTER */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/50 flex justify-end" style={{ padding: '16px 32px', gap: '10px' }}>
                            {canManage && (
                                <button
                                    onClick={() => handleDeleteResponse(selectedResponse)}
                                    className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 text-red-600 font-bold transition-colors shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"
                                    style={{ fontSize: '14px', padding: '10px 24px', borderRadius: '6px' }}
                                >
                                    <i className="bi bi-trash" style={{ marginRight: '6px' }} />
                                    Hapus Responden
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedResponse(null)}
                                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 hover:text-[#3083FF] dark:text-blue-400 dark:hover:text-blue-400 cursor-pointer"
                                style={{ fontSize: '14px', padding: '10px 24px', borderRadius: '6px' }}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default function ResponsesPage() {
    return (
        <Suspense fallback={
            <div className="p-12 text-center text-slate-500">
                <div className="animate-spin inline-block w-8 h-8 border-3 border-blue-200 dark:border-blue-800/60 border-t-[#3083FF] rounded-full mb-3"></div>
                <p className="text-xs font-semibold">Memuat Hasil Tanggapan...</p>
            </div>
        }>
            <ResponsesContent />
        </Suspense>
    );
}
