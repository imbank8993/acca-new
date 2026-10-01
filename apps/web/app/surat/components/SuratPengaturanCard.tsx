'use client'

import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { PageLoader } from '@/components/ui/Spinner'

interface KodeItem {
    kode: string
    nama: string
}

interface SuratConfig {
    background_url: string | null
    logo_url: string | null
    logo_kecil_url: string | null
    logo_qr_url: string | null
    header_text: string | null
    footer_text: string | null
    format_nomor_template: string | null
    kode1_options: KodeItem[]
    kode2_options: KodeItem[]
    kode3_options: KodeItem[]
    pejabat_default: {
        nama: string | null
        jabatan: string | null
        nip: string | null
    }
    template_a4_url: string | null
    template_a4_nama: string | null
    template_f4_url: string | null
    template_f4_nama: string | null
}

const defaultSuratConfig: SuratConfig = {
    background_url: null,
    logo_url: null,
    logo_kecil_url: null,
    logo_qr_url: null,
    header_text: null,
    footer_text: null,
    format_nomor_template: '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}',
    kode1_options: [],
    kode2_options: [],
    kode3_options: [],
    pejabat_default: { nama: null, jabatan: null, nip: null },
    template_a4_url: null,
    template_a4_nama: null,
    template_f4_url: null,
    template_f4_nama: null,
}

const swalSuccess = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'success', confirmButtonText: 'OK',
    confirmButtonColor: '#3083FF', customClass: { popup: 'swal-compact', confirmButton: 'swal-btn-primary' }
})

const swalError = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'error', confirmButtonText: 'OK',
    confirmButtonColor: '#dc2626', customClass: { popup: 'swal-compact', confirmButton: 'swal-btn-danger' }
})

const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function getPreviewNomor(suratConfig: SuratConfig | null): string {
    const template = suratConfig?.format_nomor_template || '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}'
    const now = new Date()
    return template
        .replace('{nomor}', '001')
        .replace('{kode1}', suratConfig?.kode1_options?.[0]?.kode || 'A')
        .replace('{kode2}', suratConfig?.kode2_options?.[0]?.kode || '001')
        .replace('{kode3}', suratConfig?.kode3_options?.[0]?.kode || 'G')
        .replace('{bulan_romawi}', romanMonths[now.getMonth()])
        .replace('{bulan}', String(now.getMonth() + 1).padStart(2, '0'))
        .replace('{tahun}', String(now.getFullYear()))
}

interface Props {
    initialConfig?: SuratConfig | null
    onSaveSuccess?: (config: SuratConfig) => void
    compact?: boolean  // true = inline (no header/footer), false = full modal
}

export default function SuratPengaturanCard({ initialConfig, onSaveSuccess, compact = false }: Props) {
    const [suratConfig, setSuratConfig] = useState<SuratConfig | null>(initialConfig || null)
    const [loading, setLoading] = useState(!initialConfig)
    const [saving, setSaving] = useState(false)
    const [uploadingA4, setUploadingA4] = useState(false)
    const [uploadingF4, setUploadingF4] = useState(false)

    useEffect(() => {
        if (initialConfig) {
            setSuratConfig(initialConfig)
        } else {
            loadSuratConfig()
        }
    }, [])

    const parseJsonArray = (val: any): KodeItem[] => {
        if (!val) return []
        if (Array.isArray(val)) return val
        if (typeof val === 'string') {
            try { return JSON.parse(val) } catch { return [] }
        }
        return []
    }

    const loadSuratConfig = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/config-surat')
            const json = await res.json()
            if (json.ok && json.data) {
                const d = json.data
                setSuratConfig({
                    background_url: d?.background_url || null,
                    logo_url: d?.logo_url || null,
                    logo_kecil_url: d?.logo_kecil_url || null,
                    logo_qr_url: d?.logo_qr_url || null,
                    header_text: d?.header_text || null,
                    footer_text: d?.footer_text || null,
                    format_nomor_template: d?.format_nomor_template || '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}',
                    kode1_options: parseJsonArray(d?.kode1_options),
                    kode2_options: parseJsonArray(d?.kode2_options),
                    kode3_options: parseJsonArray(d?.kode3_options),
                    pejabat_default: {
                        nama: d?.pejabat_default_nama || null,
                        jabatan: d?.pejabat_default_jabatan || null,
                        nip: d?.pejabat_default_nip || null
                    },
                    template_a4_url: d?.template_a4_url || null,
                    template_a4_nama: d?.template_a4_nama || null,
                    template_f4_url: d?.template_f4_url || null,
                    template_f4_nama: d?.template_f4_nama || null
                })
            }
        } catch (e) {
            console.error('[Surat Config] Load error:', e)
        } finally {
            setLoading(false)
        }
    }

    const handleUploadTemplate = async (format: 'A4' | 'F4', file: File) => {
        if (!file || !suratConfig) return

        if (format === 'A4') setUploadingA4(true)
        else setUploadingF4(true)

        try {
            const reader = new FileReader()
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: 'Template Surat',
                        filename: `template_${format.toLowerCase()}_${Date.now()}.${file.name.split('.').pop()}`,
                        data: dataUrl
                    })
                })
                const uploadJson = await uploadRes.json()

                if (!uploadJson.ok || !uploadJson.publicUrl) {
                    throw new Error(uploadJson.error || 'Upload gagal')
                }

                setSuratConfig({
                    ...suratConfig,
                    [`template_${format.toLowerCase()}_url`]: uploadJson.publicUrl,
                    [`template_${format.toLowerCase()}_nama`]: file.name
                } as SuratConfig)

                await swalSuccess('Berhasil', `Template ${format} berhasil diupload`)
            }
            reader.readAsDataURL(file)
        } catch (err: any) {
            await swalError('Gagal', err.message || 'Upload gagal')
        } finally {
            setUploadingA4(false)
            setUploadingF4(false)
        }
    }

    const handleDeleteTemplate = async (format: 'A4' | 'F4') => {
        const result = await Swal.fire({
            title: `Hapus Template ${format}?`,
            text: 'Template yang dihapus tidak bisa dikembalikan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
            customClass: { popup: 'swal-compact' }
        })
        if (!result.isConfirmed) return

        setSuratConfig({
            ...suratConfig!,
            [`template_${format.toLowerCase()}_url`]: null,
            [`template_${format.toLowerCase()}_nama`]: null
        } as SuratConfig)
        await swalSuccess('Dihapus', `Template ${format} berhasil dihapus`)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            if (!suratConfig) return

            let bgUrl = suratConfig.background_url || ''
            if (bgUrl.startsWith('data:')) {
                const bgRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: 'Surat Branding',
                        filename: `background_${Date.now()}.png`,
                        data: bgUrl
                    })
                })
                const bgJson = await bgRes.json()
                if (bgJson.ok && bgJson.publicUrl) bgUrl = bgJson.publicUrl
            }

            let qrLogoUrl = suratConfig.logo_qr_url || ''
            if (qrLogoUrl.startsWith('data:')) {
                const qrRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: 'Surat Branding',
                        filename: `qr_logo_${Date.now()}.png`,
                        data: qrLogoUrl
                    })
                })
                const qrJson = await qrRes.json()
                if (qrJson.ok && qrJson.publicUrl) qrLogoUrl = qrJson.publicUrl
            }

            const saveData = {
                format_nomor_template: suratConfig.format_nomor_template,
                kode1_options: JSON.stringify(suratConfig.kode1_options || []),
                kode2_options: JSON.stringify(suratConfig.kode2_options || []),
                kode3_options: JSON.stringify(suratConfig.kode3_options || []),
                background_url: bgUrl || null,
                logo_kecil_url: suratConfig.logo_kecil_url || null,
                logo_qr_url: qrLogoUrl || null,
                template_a4_url: suratConfig.template_a4_url || null,
                template_a4_nama: suratConfig.template_a4_nama || null,
                template_f4_url: suratConfig.template_f4_url || null,
                template_f4_nama: suratConfig.template_f4_nama || null
            }

            const res = await fetch('/api/config-surat', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            })
            const result = await res.json()

            if (!result.ok) throw new Error(result.error || 'Gagal menyimpan')

            await Swal.fire({
                title: 'Berhasil',
                text: 'Konfigurasi surat berhasil diperbarui',
                icon: 'success',
                confirmButtonText: 'Selesai',
                confirmButtonColor: '#0284c7',
                customClass: { popup: 'swal-compact' }
            })

            if (onSaveSuccess) {
                onSaveSuccess(suratConfig)
            } else {
                await loadSuratConfig()
            }
        } catch (e: any) {
            console.error('[Surat Config] Error:', e)
            await Swal.fire({
                title: 'Gagal',
                text: e.message,
                icon: 'error',
                confirmButtonText: 'Tutup',
                customClass: { popup: 'swal-compact' }
            })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <PageLoader label="Memuat konfigurasi…" minHeight="300px" />
    }

    return (
        <div style={{
            background: '#f8fafc',
            borderRadius: compact ? '0' : '24px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', 'Poppins', sans-serif"
        }}>
            {/* Sticky Header */}
            {!compact && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 32px',
                    background: 'white',
                    borderBottom: '1px solid #e2e8f0',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}>
                            <i className="bi bi-gear-wide-connected" style={{ color: 'white', fontSize: '1.35rem' }}></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--n-text)', fontSize: '1.25rem' }}>Konfigurasi Kop & Penomoran</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--n-muted)' }}>Kelola template nomor surat, penomoran dinamis, dan aset media kop surat.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Scrollable Main Grid */}
            <div style={{
                flex: 1,
                overflowY: compact ? 'visible' : 'auto',
                padding: compact ? '0' : '32px',
                display: 'grid',
                gridTemplateColumns: '1.1fr 0.9fr',
                gap: '24px',
                alignContent: 'start',
                maxHeight: compact ? 'none' : 'calc(90vh - 180px)'
            }}>
                {/* LEFT COLUMN - Text & Numbers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Card 1: Template Format Nomor */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <i className="bi bi-123" style={{ color: '#0284c7', fontSize: '1.1rem' }}></i>
                            Format Nomor Surat
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--n-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Template Pola</label>
                            <input
                                type="text"
                                className="srt-input"
                                style={{ fontFamily: 'monospace', fontSize: '0.9rem', padding: '10px 14px', background: '#f8fafc', borderColor: '#e2e8f0', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', color: 'var(--n-text)' }}
                                value={suratConfig?.format_nomor_template || '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}'}
                                placeholder="{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}"
                                onChange={(e) => { if (suratConfig) setSuratConfig({ ...suratConfig, format_nomor_template: e.target.value }) }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginBottom: '8px', display: 'block' }}>Preview Live Output</label>
                            <div style={{
                                padding: '12px 16px',
                                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                                border: '1px solid #bae6fd',
                                borderRadius: '12px',
                                fontFamily: 'monospace',
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#0369a1',
                                textAlign: 'center',
                                letterSpacing: '0.5px',
                                boxShadow: 'inset 0 2px 4px rgba(2, 132, 199, 0.06)'
                            }}>
                                {getPreviewNomor(suratConfig)}
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginBottom: '8px', display: 'block' }}>Daftar Variabel (Klik untuk Sisipkan)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {[
                                    { code: '{nomor}', desc: 'Nomor urut' },
                                    { code: '{kode1}', desc: 'Kode 1' },
                                    { code: '{kode2}', desc: 'Kode 2' },
                                    { code: '{kode3}', desc: 'Kode 3' },
                                    { code: '{bulan_romawi}', desc: 'Bulan Romawi' },
                                    { code: '{bulan}', desc: 'Bulan angka' },
                                    { code: '{tahun}', desc: 'Tahun' }
                                ].map(v => (
                                    <span key={v.code} style={{
                                        background: '#f1f5f9', color: 'var(--n-muted)', padding: '4px 10px', borderRadius: '6px',
                                        fontSize: '0.75rem', fontFamily: 'monospace', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'all 0.15s ease'
                                    }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.color = '#0369a1' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569' }}
                                        onClick={() => { if (suratConfig) setSuratConfig({ ...suratConfig, format_nomor_template: (suratConfig.format_nomor_template || '') + v.code }) }}
                                        title={v.desc}>
                                        {v.code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Kode Surat Options */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <i className="bi bi-collection" style={{ color: '#3b82f6', fontSize: '1.1rem' }}></i>
                            Manajemen Opsi Kode Surat
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--n-muted)', margin: '0 0 20px' }}>Pilihan dropdown yang muncul di formulir pembuatan surat.</p>

                        {[
                            { key: 'kode1_options', label: 'Kode Kelompok 1 (A, B, dst)', bg: '#fdf8f6', color: '#c2410c' },
                            { key: 'kode2_options', label: 'Kode Kelompok 2 (Kategori)', bg: '#eff6ff', color: '#1d4ed8' },
                            { key: 'kode3_options', label: 'Kode Kelompok 3 (Sub)', bg: '#f0fdf4', color: '#15803d' }
                        ].map(group => (
                            <div key={group.key} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                                <div style={{ padding: '12px 16px', background: group.bg, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: group.color, textTransform: 'uppercase' }}>{group.label}</span>
                                    <button
                                        onClick={() => { if (suratConfig) setSuratConfig({ ...suratConfig, [group.key]: [...((suratConfig as any)[group.key] || []), { kode: '', nama: '' }] }) }}
                                        style={{ border: 'none', background: 'rgba(255,255,255,0.6)', color: group.color, padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                                        <i className="bi bi-plus-circle"></i> Tambah
                                    </button>
                                </div>
                                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', background: '#fafafa' }}>
                                    {((suratConfig as any)?.[group.key] || []).map((opt: KodeItem, idx: number) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '75px 1fr auto', gap: '8px', alignItems: 'center' }}>
                                            <input type="text" className="srt-input"
                                                style={{ padding: '6px 8px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 'bold', border: '1px solid #e2e8f0', borderRadius: '6px', color: 'var(--n-text)', background: 'white' }}
                                                placeholder="Kode" value={opt.kode}
                                                onChange={(e) => { const opts = [...((suratConfig as any)[group.key] || [])]; opts[idx] = { ...opts[idx], kode: e.target.value.toUpperCase() }; setSuratConfig({ ...suratConfig, [group.key]: opts } as any) }} />
                                            <input type="text" className="srt-input"
                                                style={{ padding: '6px 8px', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '6px', color: 'var(--n-text)', background: 'white' }}
                                                placeholder="Nama Deskriptif" value={opt.nama}
                                                onChange={(e) => { const opts = [...((suratConfig as any)[group.key] || [])]; opts[idx] = { ...opts[idx], nama: e.target.value }; setSuratConfig({ ...suratConfig, [group.key]: opts } as any) }} />
                                            <button onClick={() => { const opts = [...((suratConfig as any)[group.key] || [])]; opts.splice(idx, 1); setSuratConfig({ ...suratConfig, [group.key]: opts } as any) }}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px' }}>
                                                <i className="bi bi-trash3"></i>
                                            </button>
                                        </div>
                                    ))}
                                    {(!((suratConfig as any)?.[group.key] || []).length) && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', textAlign: 'center', padding: '8px 0' }}>Belum ada opsi terdaftar</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT COLUMN - Branding Media */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Card 3: Background Kop Surat */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <i className="bi bi-brush" style={{ color: '#3b82f6', fontSize: '1.1rem' }}></i>
                            Visual Kop Surat (BG)
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--n-muted)', marginBottom: '20px' }}>Logo/Kop permanen yang muncul di baris atas PDF.</p>

                        <div style={{ position: 'relative', width: '170px', height: '240px', margin: '0 auto 20px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 12px 30px rgba(0,0,0,0.09), 0 4px 10px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                            onClick={() => document.getElementById('bg-upload-input')?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb' }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#e2e8f0' }}
                            onDrop={(e) => {
                                e.preventDefault(); e.currentTarget.style.borderColor = '#e2e8f0'
                                const file = e.dataTransfer.files[0]
                                if (file && file.type.startsWith('image/')) {
                                    const reader = new FileReader()
                                    reader.onload = (ev) => { if (suratConfig) setSuratConfig({ ...suratConfig, background_url: ev.target?.result as string }) }
                                    reader.readAsDataURL(file)
                                }
                            }}>
                            {suratConfig?.background_url ? (
                                <>
                                    <img src={suratConfig.background_url} alt="Background Kop" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc' }} />
                                    <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', display: 'flex', flexDirection: 'column', gap: '6px', opacity: 0.4 }}>
                                        <div style={{ height: '6px', width: '40%', background: '#cbd5e1', borderRadius: '2px' }}></div>
                                        <div style={{ height: '5px', width: '85%', background: '#e2e8f0', borderRadius: '2px' }}></div>
                                        <div style={{ height: '5px', width: '95%', background: '#e2e8f0', borderRadius: '2px' }}></div>
                                    </div>
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)', opacity: 0, transition: 'opacity 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 600, backdropFilter: 'blur(2px)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0' }>
                                        <i className="bi bi-arrow-repeat" style={{ fontSize: '1.2rem', marginRight: '4px' }}></i> Ganti
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', color: 'var(--n-muted)', textAlign: 'center', background: '#f8fafc' }}>
                                    <i className="bi bi-file-earmark-image" style={{ fontSize: '2.5rem', color: '#cbd5e1' }}></i>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.3 }}>Drag & drop atau klik untuk pilih file</span>
                                </div>
                            )}
                        </div>

                        <input id="bg-upload-input" type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    const reader = new FileReader()
                                    reader.onload = (ev) => { if (suratConfig) setSuratConfig({ ...suratConfig, background_url: ev.target?.result as string }) }
                                    reader.readAsDataURL(file)
                                }
                            }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--n-muted)', display: 'block', marginBottom: '4px' }}>URL GAMBAR LANGSUNG</label>
                                <input type="text" className="srt-input"
                                    style={{ width: '100%', fontSize: '0.8rem', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: 'var(--n-text)' }}
                                    placeholder="https://example.com/kop.png" value={suratConfig?.background_url || ''}
                                    onChange={(e) => { if (suratConfig) setSuratConfig({ ...suratConfig, background_url: e.target.value }) }} />
                            </div>
                            {suratConfig?.background_url && (
                                <button onClick={() => { if (suratConfig) setSuratConfig({ ...suratConfig, background_url: '' }) }}
                                    style={{ fontSize: '0.75rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <i className="bi bi-trash3"></i> Hapus Gambar Kop
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Card 4: Logo QR Code ACCA */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <i className="bi bi-qr-code" style={{ color: '#10b981', fontSize: '1.1rem' }}></i>
                            Logo QR — TTD Digital
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--n-muted)', marginBottom: '20px' }}>Logo ACCA di tengah barcode verifikasi. Default: <code>logo-sidebar-kecil.png</code></p>
                        <div style={{ position: 'relative', width: '110px', height: '110px', margin: '0 auto 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', cursor: 'pointer' }}
                            onClick={() => document.getElementById('qr-logo-upload')?.click()}>
                            <div style={{ position: 'absolute', inset: '12px', opacity: 0.12, backgroundImage: 'radial-gradient(#0f172a 2px, transparent 2px)', backgroundSize: '6px 6px' }}></div>
                            <div style={{ position: 'absolute', top: '8px', left: '8px', width: '20px', height: '20px', border: '3.5px solid #1e293b', borderRadius: '3px' }}></div>
                            <div style={{ position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px', border: '3.5px solid #1e293b', borderRadius: '3px' }}></div>
                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', width: '20px', height: '20px', border: '3.5px solid #1e293b', borderRadius: '3px' }}></div>
                            <div style={{ position: 'relative', zIndex: 2, width: '38px', height: '38px', background: '#ffffff', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '2px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {suratConfig?.logo_qr_url
                                    ? <img src={suratConfig.logo_qr_url} alt="Logo QR ACCA" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    : <i className="bi bi-image-fill" style={{ color: '#cbd5e1', fontSize: '1.1rem' }}></i>
                                }
                            </div>
                        </div>

                        <input id="qr-logo-upload" type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file || !suratConfig) return
                                const reader = new FileReader()
                                reader.onload = (ev) => { setSuratConfig({ ...suratConfig, logo_qr_url: ev.target?.result as string }) }
                                reader.readAsDataURL(file)
                                const formData = new FormData()
                                formData.append('folder', 'Surat Branding')
                                formData.append('file', file)
                                try {
                                    const res = await fetch('/api/upload', { method: 'POST', body: formData })
                                    const json = await res.json()
                                    if (json.ok && json.publicUrl) {
                                        setSuratConfig({ ...suratConfig, logo_qr_url: json.publicUrl })
                                        swalSuccess('Berhasil', 'Logo QR berhasil diupload')
                                    } else {
                                        swalError('Gagal', json.error || 'Upload gagal')
                                    }
                                } catch (err: any) { swalError('Gagal', 'Upload gagal: ' + err.message) }
                            }} />

                        <div style={{ textAlign: 'center' }}>
                            {suratConfig?.logo_qr_url ? (
                                <button onClick={() => { if (suratConfig) setSuratConfig({ ...suratConfig, logo_qr_url: '' }) }}
                                    style={{ fontSize: '0.75rem', background: '#fee2e2', border: 'none', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', fontWeight: 600 }}>
                                    <i className="bi bi-trash"></i> Copot Logo
                                </button>
                            ) : (
                                <p style={{ fontSize: '0.75rem', color: '#10b981', margin: '0 0 8px', fontWeight: 600 }}>
                                    <i className="bi bi-check-circle"></i> Default: logo ACCA (logo-sidebar-kecil.png)
                                </p>
                            )}
                            <p style={{ fontSize: '0.75rem', color: 'var(--n-muted)', margin: 0, lineHeight: 1.4 }}>Format PNG/JPG transparan sangat disarankan. Maksimum file 500KB.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FULL-WIDTH ROW - Template A4/F4 Upload */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                paddingTop: '24px',
                borderTop: '1px solid #e2e8f0'
            }}>
                {[
                    { format: 'A4' as const, label: 'Template A4', icon: 'bi bi-file-earmark-pdf-fill', color: '#3083FF', bgIcon: 'linear-gradient(135deg, #3083FF 0%, #1565c0 100%)', fieldUrl: 'template_a4_url', fieldNama: 'template_a4_nama', uploading: uploadingA4, setUploading: setUploadingA4 },
                    { format: 'F4' as const, label: 'Template F4', icon: 'bi bi-file-earmark-pdf-fill', color: '#0ea5e9', bgIcon: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', fieldUrl: 'template_f4_url', fieldNama: 'template_f4_nama', uploading: uploadingF4, setUploading: setUploadingF4 }
                ].map(t => {
                    const templateUrl = (suratConfig as any)?.[t.fieldUrl]
                    const templateNama = (suratConfig as any)?.[t.fieldNama]
                    return (
                        <div key={t.format} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: t.bgIcon, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', boxShadow: `0 4px 12px ${t.color}30`, flexShrink: 0 }}>
                                    <i className={t.icon}></i>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)' }}>Template {t.format}</div>
                                    {templateUrl
                                        ? <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: '9999px' }}>Tersedia</span>
                                        : <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--n-muted)', background: 'rgba(100,116,139,0.1)', padding: '2px 8px', borderRadius: '9999px' }}>Belum ada</span>
                                    }
                                </div>
                            </div>

                            {templateUrl ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--n-muted)', fontWeight: 500 }}>
                                        <i className="bi bi-file-earmark" style={{ color: t.color }}></i>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{templateNama || `template_${t.format.toLowerCase()}.pdf`}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <a href={templateUrl} target="_blank" rel="noopener noreferrer" download
                                            className="srt-btn srt-btn-success srt-btn-sm"
                                            style={{ flex: 1, justifyContent: 'center' }}>
                                            <i className="bi bi-download"></i> Unduh
                                        </a>
                                        <button onClick={() => handleDeleteTemplate(t.format)}
                                            className="srt-btn srt-btn-danger srt-btn-sm"
                                            style={{ padding: '6px 10px' }}>
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #e2e8f0', borderRadius: '10px', padding: '16px', color: 'var(--n-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
                                    <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.5rem', marginRight: '6px', opacity: 0.5 }}></i>
                                    Belum ada template
                                </div>
                            )}

                            <label
                                className={`srt-btn ${templateUrl ? 'srt-btn-secondary' : 'srt-btn-primary'} srt-btn-sm`}
                                style={{ marginTop: '10px', justifyContent: 'center', cursor: 'pointer' }}>
                                <i className={`bi ${templateUrl ? 'bi-arrow-repeat' : 'bi-plus-circle'}`}></i>
                                {t.uploading ? 'Mengupload...' : templateUrl ? 'Ganti Template' : 'Upload Template'}
                                <input type="file" accept=".doc,.docx,.pdf" style={{ display: 'none' }}
                                    onChange={e => {
                                        const file = e.target.files?.[0]
                                        if (file) handleUploadTemplate(t.format, file)
                                        e.target.value = ''
                                    }} />
                            </label>
                        </div>
                    )
                })}
            </div>

            {/* Sticky Footer */}
            {!compact && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    padding: '20px 32px',
                    background: 'white',
                    borderTop: '1px solid #e2e8f0',
                    zIndex: 10
                }}>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="srt-btn srt-btn-primary"
                        style={{
                            padding: '10px 32px',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: saving ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            color: 'white'
                        }}
                    >
                        <i className="bi bi-check2-all" style={{ fontSize: '1.1rem', marginRight: '4px' }}></i>
                        Simpan Perubahan
                    </button>
                </div>
            )}

            <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}