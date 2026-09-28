'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { hasPermission } from '@/lib/permissions-client'
import Swal from 'sweetalert2'
import { ActionButton } from '@/components/ui/ActionButtons'
import Button from '@/components/ui/Button'

interface WATarget {
    id: string
    name: string
    code: string
    isSelected?: boolean
}

interface WAAccount {
    id: string
    name: string
    token: string
    targets: WATarget[]
    isSelected: boolean
}

interface WASettingConfig {
    key: string
    tokenKey: string
    targetsKey: string
    label: string
    description: string
    icon: string
    color: string
    hideTargets?: boolean
    supportsImage?: boolean
}

const WA_CONFIGS: WASettingConfig[] = [
    {
        key: 'piket',
        tokenKey: 'wa_token_piket',
        targetsKey: 'wa_targets_piket',
        label: 'Piket',
        description: 'Notifikasi laporan piket harian',
        icon: 'bi-calendar-check',
        color: '#1d6bf3',
        supportsImage: true,
    },
    {
        key: 'ketidakhadiran',
        tokenKey: 'wa_token_ketidakhadiran',
        targetsKey: 'wa_targets_ketidakhadiran',
        label: 'Ketidakhadiran',
        description: 'Notifikasi ketidakhadiran siswa',
        icon: 'bi-person-exclamation',
        color: '#38bdf8',
        supportsImage: true,
    },
    {
        key: 'ptsp',
        tokenKey: 'wa_token_ptsp',
        targetsKey: 'wa_targets_ptsp',
        label: 'PTSP',
        description: 'Notifikasi status PTSP (via cron)',
        icon: 'bi-building',
        color: '#6366f1',
        hideTargets: true,
    },
    {
        key: 'sanggar',
        tokenKey: 'wa_token_sanggar',
        targetsKey: 'wa_targets_sanggar',
        label: 'Sanggar',
        description: 'Notifikasi broadcast Sanggar Kurikulum',
        icon: 'bi-megaphone',
        color: '#00b4d8',
        hideTargets: true,
    },
]

interface WAProvider {
    id: string
    name: string
    tokenLabel: string
    tokenPlaceholder: string
    supportsImage: 'yes' | 'no' | 'depends'
    supportsGroup: boolean
    help: string
}

const WA_PROVIDERS: WAProvider[] = [
    {
        id: 'fonnte',
        name: 'Fonnte',
        tokenLabel: 'Token API Fonnte',
        tokenPlaceholder: 'Token perangkat Fonnte',
        supportsImage: 'depends',
        supportsGroup: true,
        help: 'Murah & stabil. Dukungan kirim gambar tergantung paket yang dibeli — gunakan tombol "Kirim Test Gambar" untuk memastikan.',
    },
    {
        id: 'watzap',
        name: 'Watzap.me',
        tokenLabel: 'API Key Watzap',
        tokenPlaceholder: 'API Key dari dashboard Watzap',
        supportsImage: 'yes',
        supportsGroup: true,
        help: 'Mendukung kirim gambar & grup. Isi API Key pada kolom token.',
    },
    {
        id: 'ultramsg',
        name: 'UltraMsg',
        tokenLabel: 'Instance ID UltraMsg',
        tokenPlaceholder: 'instanceXXXXX (Instance ID)',
        supportsImage: 'yes',
        supportsGroup: true,
        help: 'Mendukung kirim gambar & grup. Isi Instance ID pada kolom token.',
    },
    {
        id: 'baileys',
        name: 'Baileys (Gratis, Self-host)',
        tokenLabel: 'Tanpa token (scan QR)',
        tokenPlaceholder: 'Tidak perlu token — pairing via QR',
        supportsImage: 'yes',
        supportsGroup: true,
        help: '',
    },
]

function generateId() {
    return Math.random().toString(36).substring(2, 9)
}

/** Panel pairing Baileys: menampilkan QR untuk scan atau status tersambung. */
function BaileysPairing({ color, canManage }: { color: string; canManage: boolean }) {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [loggingOut, setLoggingOut] = useState(false)

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/baileys/status', { cache: 'no-store' })
            const data = await res.json()
            setStatus(data)
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
        const id = setInterval(fetchStatus, 4000)
        return () => clearInterval(id)
    }, [fetchStatus])

    const handleLogout = async () => {
        const c = await Swal.fire({
            title: 'Putuskan Baileys?',
            text: 'Sesi akan dihapus. Anda perlu scan QR ulang untuk memakainya lagi.',
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Putuskan', cancelButtonText: 'Batal',
        })
        if (!c.isConfirmed) return
        setLoggingOut(true)
        try { await fetch('/api/whatsapp/baileys/logout', { method: 'POST' }); await fetchStatus() } finally { setLoggingOut(false) }
    }

    const connected = status?.connected
    return (
        <div className="wa__baileys">
            <div className="wa__baileysHead">
                <span className={`wa__statusDot ${connected ? 'ready' : 'empty'}`}></span>
                <b>Koneksi WhatsApp (Baileys)</b>
                <span className="wa__baileysState">
                    {loading ? null : connected ? 'Tersambung' : status?.qr ? 'Menunggu scan QR' : null}
                </span>
            </div>

            {connected ? (
                <div className="wa__baileysConnected">
                    <i className="bi bi-check-circle-fill" style={{ color: '#3b82f6', fontSize: '1.4rem' }}></i>
                    <div>
                        <div style={{ fontWeight: 700 }}>Nomor tersambung</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--n-muted)' }}>{status?.user?.name || status?.user?.id || '—'}</div>
                    </div>
                    {canManage && (
                        <button type="button" className="wa__baileysLogout" onClick={handleLogout} disabled={loggingOut}>
                            <i className="bi bi-box-arrow-right"></i> {loggingOut ? null : 'Putuskan'}
                        </button>
                    )}
                </div>
            ) : status?.qr ? (
                <div className="wa__baileysQr">
                    <img src={status.qr} alt="QR Baileys" width={140} height={140} />
                    <div className="wa__baileysQrHelp">
                        <b>Cara pairing:</b>
                        <ol>
                            <li>Buka WhatsApp di HP (nomor khusus)</li>
                            <li>Menu <b>Perangkat Tertaut</b> → <b>Tautkan Perangkat</b></li>
                            <li>Scan QR di samping</li>
                        </ol>
                        <small style={{ color: 'var(--n-muted)', fontSize: '0.7rem' }}>QR menyegar otomatis. Jika kedaluwarsa, tunggu sebentar.</small>
                    </div>
                </div>
            ) : (
                <div className="wa__baileysWaiting">
                    <Spinner variant="buble" />
                    {status?.error && <span>Error: {status.error}</span>}
                </div>
            )}

            <style jsx>{`
                .wa__baileys {
                    padding: 10px 14px;
                    margin-bottom: 10px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    border-left: 3px solid ${color};
                }
                .wa__baileysHead { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--n-text); }
                .wa__baileysState { margin-left: auto; font-size: 0.75rem; font-weight: 600; color: var(--n-muted); }
                .wa__baileysConnected { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
                .wa__baileysLogout {
                    margin-left: auto; display: flex; align-items: center; gap: 6px;
                    padding: 0 12px; height: 32px; background: #fef2f2; color: #dc2626;
                    border: 1px solid #fecaca; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;
                }
                .wa__baileysLogout:disabled { opacity: 0.6; cursor: not-allowed; }
                .wa__baileysQr { display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
                .wa__baileysQr img { background: #fff; padding: 4px; border-radius: 8px; border: 1px solid var(--n-border); }
                .wa__baileysQrHelp { flex: 1; min-width: 180px; font-size: 0.78rem; color: var(--n-text); }
                .wa__baileysQrHelp ol { margin: 4px 0; padding-left: 16px; color: var(--n-muted); }
                .wa__baileysQrHelp li { margin-bottom: 2px; }
                .wa__baileysWaiting { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 0.8rem; color: var(--n-muted); }
            `}</style>
        </div>
    )
}

export default function WhatsAppTab({ user }: { user?: any }) {
    const permissions = user?.permissions || []
    const isAdmin = (user?.role === 'ADMIN') || (user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN')) || false
    const canManage = hasPermission(permissions, 'pengaturan_umum', 'manage', isAdmin, user?.roles)

    const [settings, setSettings] = useState<Record<string, string>>({})
    const [accountsMap, setAccountsMap] = useState<Record<string, WAAccount[]>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testingConfig, setTestingConfig] = useState<string | null>(null)
    const [testingImage, setTestingImage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState('piket')
    const [showTokens, setShowTokens] = useState<Record<string, boolean>>({})

    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
    const latestAccountsRef = useRef<Record<string, WAAccount[]>>({})

    const currentConfig = WA_CONFIGS.find(c => c.key === activeTab) || WA_CONFIGS[0]

    const parseAccountsFromSettings = (settingsMap: Record<string, string>, key: string): WAAccount[] => {
        try {
            const raw = settingsMap[`wa_accounts_v2_${key}`]
            if (!raw) {
                // Migration: check old format
                const oldToken = settingsMap[`wa_token_${key}`]
                const oldTargetsRaw = settingsMap[`wa_targets_${key}`]
                if (oldToken) {
                    let oldTargets: WATarget[] = []
                    try { if (oldTargetsRaw) oldTargets = JSON.parse(oldTargetsRaw) } catch {}
                    return [{
                        id: 'default',
                        name: 'Akun Utama',
                        token: oldToken,
                        targets: oldTargets.map(t => ({ ...t, isSelected: true })),
                        isSelected: true
                    }]
                }
                return []
            }
            return JSON.parse(raw)
        } catch {
            return []
        }
    }

    const fetchSettings = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/site-settings')
            const result = await res.json()
            if (res.ok && result.data) {
                const map: Record<string, string> = {}
                result.data.forEach((row: any) => { map[row.key] = row.value })
                setSettings(map)

                const initialAccountsMap: Record<string, WAAccount[]> = {}
                WA_CONFIGS.forEach(c => {
                    initialAccountsMap[c.key] = parseAccountsFromSettings(map, c.key)
                })
                setAccountsMap(initialAccountsMap)
                latestAccountsRef.current = initialAccountsMap
            }
        } catch (err) {
            console.error('Error fetching settings:', err)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    useEffect(() => {
        const timeouts = saveTimeoutRef.current
        return () => {
            Object.values(timeouts).forEach(clearTimeout)
        }
    }, [])

    const saveSettingRaw = async (key: string, value: string) => {
        try {
            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            })
            const data = await res.json()
            if (!data.ok) throw new Error(data.error || 'Unknown error')
            setSettings(prev => ({ ...prev, [key]: value }))
        } catch (err: any) {
            console.error('Error saving setting:', err)
        }
    }

    const saveSetting = async (key: string, value: string) => {
        setSaving(true)
        try {
            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            })
            const data = await res.json()

            if (!data.ok) throw new Error(data.error || 'Unknown error')

            setSettings(prev => ({ ...prev, [key]: value }))
        } catch (err: any) {
            console.error(err)
            Swal.fire('Error', 'Gagal menyimpan pengaturan', 'error')
        } finally {
            setSaving(false)
        }
    }

    const persistAccountsToBackend = async (key: string, accounts: WAAccount[]) => {
        if (saveTimeoutRef.current[key]) {
            clearTimeout(saveTimeoutRef.current[key])
            delete saveTimeoutRef.current[key]
        }

        const accountsKey = `wa_accounts_v2_${key}`
        const jsonValue = JSON.stringify(accounts)

        // Save accounts library
        await saveSettingRaw(accountsKey, jsonValue)

        // Sync active config for backend compatibility
        const activeAccount = accounts.find(a => a.isSelected)
        if (activeAccount) {
            await saveSettingRaw(`wa_token_${key}`, activeAccount.token)
            const selectedTargets = activeAccount.targets.filter(t => t.isSelected)
            await saveSettingRaw(`wa_targets_${key}`, JSON.stringify(selectedTargets))
        } else {
            await saveSettingRaw(`wa_token_${key}`, '')
            await saveSettingRaw(`wa_targets_${key}`, '[]')
        }
    }

    const triggerDebouncedSave = (key: string, accounts: WAAccount[]) => {
        if (saveTimeoutRef.current[key]) {
            clearTimeout(saveTimeoutRef.current[key])
        }
        saveTimeoutRef.current[key] = setTimeout(() => {
            persistAccountsToBackend(key, accounts)
        }, 600)
    }

    const getAccounts = (key: string): WAAccount[] => {
        return accountsMap[key] || []
    }

    const addAccount = async (key: string) => {
        const current = [...getAccounts(key)]
        const newAccount: WAAccount = {
            id: generateId(),
            name: 'Akun Baru',
            token: '',
            targets: [],
            isSelected: current.length === 0
        }
        current.push(newAccount)
        setAccountsMap(prev => ({ ...prev, [key]: current }))
        latestAccountsRef.current[key] = current
        await persistAccountsToBackend(key, current)
    }

    const updateAccount = (key: string, id: string, field: keyof WAAccount, value: any) => {
        const current = getAccounts(key).map(a => {
            if (field === 'isSelected') {
                return { ...a, isSelected: a.id === id }
            }
            if (a.id === id) {
                return { ...a, [field]: value }
            }
            return a
        })

        setAccountsMap(prev => ({ ...prev, [key]: current }))
        latestAccountsRef.current[key] = current

        if (field === 'isSelected') {
            persistAccountsToBackend(key, current)
        } else {
            triggerDebouncedSave(key, current)
        }
    }

    const removeAccount = async (key: string, id: string) => {
        const result = await Swal.fire({
            title: 'Hapus Akun?',
            text: "Semua target di akun ini juga akan terhapus.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        })
        if (!result.isConfirmed) return

        let filtered = getAccounts(key).filter(a => a.id !== id)
        if (filtered.length > 0 && !filtered.some(a => a.isSelected)) {
            filtered = filtered.map((a, idx) => idx === 0 ? { ...a, isSelected: true } : a)
        }
        setAccountsMap(prev => ({ ...prev, [key]: filtered }))
        latestAccountsRef.current[key] = filtered
        await persistAccountsToBackend(key, filtered)
    }

    const addTargetToAccount = async (key: string, accountId: string) => {
        const current = getAccounts(key).map(a => {
            if (a.id === accountId) {
                return {
                    ...a,
                    targets: [...a.targets, { id: generateId(), name: '', code: '', isSelected: true }]
                }
            }
            return a
        })
        setAccountsMap(prev => ({ ...prev, [key]: current }))
        latestAccountsRef.current[key] = current
        await persistAccountsToBackend(key, current)
    }

    const updateTargetInAccount = (key: string, accountId: string, targetId: string, field: keyof WATarget, value: any) => {
        const current = getAccounts(key).map(a => {
            if (a.id === accountId) {
                return {
                    ...a,
                    targets: a.targets.map(t => {
                        if (t.id === targetId) {
                            return { ...t, [field]: value }
                        }
                        return t
                    })
                }
            }
            return a
        })

        setAccountsMap(prev => ({ ...prev, [key]: current }))
        latestAccountsRef.current[key] = current

        if (field === 'isSelected') {
            persistAccountsToBackend(key, current)
        } else {
            triggerDebouncedSave(key, current)
        }
    }

    const removeTargetFromAccount = async (key: string, accountId: string, targetId: string) => {
        const current = getAccounts(key).map(a => {
            if (a.id === accountId) {
                return {
                    ...a,
                    targets: a.targets.filter(t => t.id !== targetId)
                }
            }
            return a
        })
        setAccountsMap(prev => ({ ...prev, [key]: current }))
        latestAccountsRef.current[key] = current
        await persistAccountsToBackend(key, current)
    }

    const toggleTokenVisibility = (accountId: string) => {
        setShowTokens(prev => ({ ...prev, [accountId]: !prev[accountId] }))
    }

    const handleToggle = async (key: string) => {
        const newValue = settings[key] === 'true' ? 'false' : 'true'
        await saveSetting(key, newValue)
    }

    // Provider aktif untuk sebuah fitur: per-fitur → global → fonnte.
    const getProviderId = (key: string): string =>
        settings[`wa_provider_${key}`] || settings['wa_provider'] || 'fonnte'

    const getProvider = (key: string): WAProvider =>
        WA_PROVIDERS.find(p => p.id === getProviderId(key)) || WA_PROVIDERS[0]

    const formatRaw = (results: any[]): string =>
        results
            .map((r: any) => `• ${r.target}: ${r.ok ? '✅' : '❌'} ${typeof r.raw === 'object' && r.raw ? (r.raw.detail || r.raw.reason || r.raw.message || r.raw.error || JSON.stringify(r.raw)) : r.raw}`)
            .join('\n')

    const handleTestSend = async (config: WASettingConfig) => {
        const accounts = getAccounts(config.key)
        await persistAccountsToBackend(config.key, accounts)

        const selectedAccount = accounts.find(a => a.isSelected)
        const token = selectedAccount?.token
        const validTargets = selectedAccount?.targets?.filter(t => t.isSelected && t.code.trim()).map(t => t.code.trim()) || []

        if (!token && getProviderId(config.key) !== 'baileys') {
            Swal.fire('Info', `Token API untuk ${config.label} belum diisi di akun terpilih`, 'info')
            return
        }

        if (validTargets.length === 0) {
            Swal.fire('Info', `Target untuk ${config.label} belum ada yang dipilih di akun ${selectedAccount?.name || ''}`, 'info')
            return
        }

        setTestingConfig(config.key)
        try {
            const res = await fetch('/api/whatsapp/test-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: config.label,
                    token,
                    targets: validTargets,
                    provider: getProviderId(config.key),
                }),
            })
            const data = await res.json()
            const rawText = data.results ? formatRaw(data.results) : (data.error || 'Tidak ada respons.')

            if (data.ok) {
                Swal.fire({
                    icon: 'success',
                    title: `Terkirim ke ${data.successCount}/${data.total} target`,
                    html: `<div style="text-align:left;font-size:0.85rem;white-space:pre-wrap">${rawText}</div>`,
                })
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal mengirim',
                    html: `<div style="text-align:left;font-size:0.85rem;white-space:pre-wrap">${rawText}</div>`,
                })
            }
        } catch (err: any) {
            Swal.fire('Error', `Terjadi kesalahan: ${err.message}`, 'error')
        } finally {
            setTestingConfig(null)
        }
    }

    const handleTestImage = async (config: WASettingConfig) => {
        const accounts = getAccounts(config.key)
        await persistAccountsToBackend(config.key, accounts)

        const selectedAccount = accounts.find(a => a.isSelected)
        const token = selectedAccount?.token
        const validTargets = selectedAccount?.targets?.filter(t => t.isSelected && t.code.trim()).map(t => t.code.trim()) || []

        if (!token && getProviderId(config.key) !== 'baileys') {
            Swal.fire('Info', `Token API untuk ${config.label} belum diisi di akun terpilih`, 'info')
            return
        }
        if (validTargets.length === 0) {
            Swal.fire('Info', `Target untuk ${config.label} belum ada yang dipilih`, 'info')
            return
        }

        setTestingImage(config.key)
        try {
            const res = await fetch('/api/whatsapp/test-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature: config.key,
                    token,
                    targets: validTargets,
                    provider: getProviderId(config.key),
                }),
            })
            const data = await res.json()

            // Tampilkan raw response provider agar admin tahu apakah paket mendukung gambar.
            const rawText = data.results ? formatRaw(data.results) : (data.error || 'Tidak ada respons.')

            if (data.ok) {
                Swal.fire({
                    icon: 'success',
                    title: `Terkirim ke ${data.successCount}/${data.total} target`,
                    html: `<div style="text-align:left;font-size:0.85rem;white-space:pre-wrap">${rawText}</div>`,
                })
            } else {
                Swal.fire({
                    icon: 'error',
                    title: data.stage === 'render' ? 'Gagal render gambar' : data.stage === 'upload' ? 'Gagal upload gambar' : 'Gagal kirim gambar',
                    html: `<div style="text-align:left;font-size:0.85rem;white-space:pre-wrap">${rawText}</div><br><small style="color:#94a3b8">Jika provider menolak media, kemungkinan paket Fonnte Anda belum mendukung pengiriman gambar.</small>`,
                })
            }
        } catch (err: any) {
            Swal.fire('Error', `Terjadi kesalahan: ${err.message}`, 'error')
        } finally {
            setTestingImage(null)
        }
    }

    const handleManualSave = async (key: string) => {
        if (!canManage) {
            Swal.fire({ icon: 'warning', title: 'Tidak punya akses', text: 'Hanya admin yang dapat mengubah pengaturan.' })
            return
        }

        setSaving(true)
        try {
            const accounts = getAccounts(key)
            await persistAccountsToBackend(key, accounts)

            Swal.fire({
                icon: 'success',
                title: 'Berhasil Disimpan',
                text: `Pengaturan WhatsApp ${currentConfig.label} berhasil disimpan.`,
                timer: 2000,
                showConfirmButton: false,
            })
        } catch (err: any) {
            console.error('Error saving WhatsApp settings:', err)
            Swal.fire('Error', 'Gagal menyimpan pengaturan WhatsApp', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="wa-loading">
                <Spinner variant="buble" />
            </div>
        )
    }

    const accounts = getAccounts(currentConfig.key)
    const selectedAccount = accounts.find(a => a.isSelected)
    const isEnabled = settings[`notif_wa_${currentConfig.key}`] === 'true'
    const isBaileys = getProviderId(currentConfig.key) === 'baileys'
    // Baileys tidak butuh token (pakai sesi QR), jadi anggap "token" terpenuhi.
    const hasToken = isBaileys || !!selectedAccount?.token
    const hasTarget = currentConfig.hideTargets || selectedAccount?.targets?.some(t => t.code.trim() && t.isSelected)
    const isReady = currentConfig.hideTargets ? hasToken : (hasToken && hasTarget)

    return (
        <div className="wa">
            {/* Tabs */}
            <div className="wa__tabs">
                {WA_CONFIGS.map(tab => (
                    <button
                        key={tab.key}
                        className={`wa__tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{ '--tab-color': tab.color } as React.CSSProperties}
                    >
                        <i className={`bi ${tab.icon}`}></i>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Main Card */}
            <div className="wa__card">
                <div className="wa__cardHeader" style={{ borderLeftColor: currentConfig.color }}>
                    <div className="wa__cardTitle">
                        <i className={`bi ${currentConfig.icon}`} style={{ color: currentConfig.color }}></i>
                        <span>{currentConfig.label}</span>
                    </div>
                    <div className="wa__cardToggle">
                        <span className="wa__toggleLabel">{isEnabled ? 'Aktif' : 'Nonaktif'}</span>
                        <button
                            className={`wa__toggle ${isEnabled ? 'on' : ''}`}
                            onClick={() => handleToggle(`notif_wa_${currentConfig.key}`)}
                            disabled={!canManage || saving}
                            type="button"
                            style={{ '--toggle-color': currentConfig.color } as React.CSSProperties}
                        >
                            <span className="wa__toggleThumb"></span>
                        </button>
                    </div>
                </div>

                <div className="wa__cardBody">
                    <p className="wa__cardDesc">{currentConfig.description}</p>

                    {/* Provider Selector */}
                    <div className="wa__provider">
                        <div className="wa__providerHead">
                            <label>
                                <i className="bi bi-hdd-network"></i>
                                Provider Pengirim WA
                            </label>
                            <select
                                className="wa__select"
                                value={getProviderId(currentConfig.key)}
                                onChange={e => saveSetting(`wa_provider_${currentConfig.key}`, e.target.value)}
                                disabled={!canManage || saving}
                            >
                                {WA_PROVIDERS.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="wa__providerHint">
                            <div className="wa__providerBadges">
                                <span className="wa__pBadge ok"><i className="bi bi-people-fill"></i> Grup {getProvider(currentConfig.key).supportsGroup ? '✓' : '✗'}</span>
                                <span className={`wa__pBadge ${getProvider(currentConfig.key).supportsImage === 'yes' ? 'ok' : getProvider(currentConfig.key).supportsImage === 'no' ? 'no' : 'warn'}`}>
                                    <i className="bi bi-image"></i> Gambar: {getProvider(currentConfig.key).supportsImage === 'yes' ? 'Ya' : getProvider(currentConfig.key).supportsImage === 'no' ? 'Tidak' : 'Tergantung paket'}
                                </span>
                            </div>
                            {getProvider(currentConfig.key).help && <p>{getProvider(currentConfig.key).help}</p>}
                        </div>
                    </div>

                    {/* Baileys pairing (QR) */}
                    {isBaileys && (
                        <BaileysPairing color={currentConfig.color} canManage={canManage} />
                    )}

                    {/* Mode Gambar */}
                    {currentConfig.supportsImage && (
                        <div className="wa__imageMode">
                            <div className="wa__imageModeInfo">
                                <i className="bi bi-image" style={{ color: currentConfig.color }}></i>
                                <div>
                                    <div className="wa__imageModeTitle">Kirim sebagai gambar</div>
                                    <div className="wa__imageModeDesc">Laporan dikemas jadi gambar rapi (bukan teks) saat dikirim ke grup.</div>
                                </div>
                            </div>
                            <button
                                className={`wa__toggle ${settings[`wa_as_image_${currentConfig.key}`] === 'true' ? 'on' : ''}`}
                                onClick={() => handleToggle(`wa_as_image_${currentConfig.key}`)}
                                disabled={!canManage || saving}
                                type="button"
                                style={{ '--toggle-color': currentConfig.color } as React.CSSProperties}
                            >
                                <span className="wa__toggleThumb"></span>
                            </button>
                        </div>
                    )}

                    <div className="wa__fields">
                        {/* Accounts Section */}
                        <div className="wa__field">
                            <div className="wa__fieldHeader">
                                <label>
                                    <i className={`bi ${isBaileys ? 'bi-collection' : 'bi-key-fill'}`}></i>
                                    {isBaileys ? `Daftar Akun / Grup (${accounts.length})` : `Daftar Token / Akun (${accounts.length})`}
                                </label>
                                {canManage && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        type="button"
                                        onClick={() => addAccount(currentConfig.key)}
                                        icon="add"
                                    >
                                        {isBaileys ? 'Tambah' : 'Tambah Akun'}
                                    </Button>
                                )}
                            </div>

                            <div className="wa__accountsList">
                                {accounts.length === 0 && (
                                    <div className="wa__targetsEmpty">
                                        <i className="bi bi-person-x"></i>
                                        <span>Belum ada akun. Klik &quot;Tambah Akun&quot; untuk memulai.</span>
                                    </div>
                                )}
                                {accounts.map((acc) => (
                                    <div key={acc.id} className={`wa__accountItem ${acc.isSelected ? 'active' : ''}`}>
                                        <div className="wa__accountMain">
                                            <div className="wa__accountSelect">
                                                <input
                                                    type="radio"
                                                    name={`active_account_${currentConfig.key}`}
                                                    checked={acc.isSelected}
                                                    onChange={() => updateAccount(currentConfig.key, acc.id, 'isSelected', true)}
                                                    disabled={!canManage}
                                                />
                                            </div>
                                            <div className="wa__accountInputs">
                                                <input
                                                    type="text"
                                                    value={acc.name}
                                                    onChange={e => updateAccount(currentConfig.key, acc.id, 'name', e.target.value)}
                                                    onBlur={() => persistAccountsToBackend(currentConfig.key, getAccounts(currentConfig.key))}
                                                    placeholder="Nama Akun"
                                                    disabled={!canManage}
                                                    className="wa__input wa__accName"
                                                />
                                                {!isBaileys && (
                                                    <div className="wa__tokenInputGroup">
                                                        <input
                                                            type={showTokens[acc.id] ? 'text' : 'password'}
                                                            value={acc.token}
                                                            onChange={e => updateAccount(currentConfig.key, acc.id, 'token', e.target.value)}
                                                            onBlur={() => persistAccountsToBackend(currentConfig.key, getAccounts(currentConfig.key))}
                                                            placeholder={getProvider(currentConfig.key).tokenPlaceholder}
                                                            disabled={!canManage}
                                                            className="wa__input wa__accToken"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="wa__tokenToggle"
                                                            onClick={() => toggleTokenVisibility(acc.id)}
                                                            title={showTokens[acc.id] ? 'Sembunyikan' : 'Tampilkan'}
                                                        >
                                                            <i className={`bi ${showTokens[acc.id] ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {canManage && (
                                                <ActionButton
                                                    action="delete"
                                                    onClick={() => removeAccount(currentConfig.key, acc.id)}
                                                    title="Hapus akun"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Targets Section for Selected Account */}
                        {selectedAccount && !currentConfig.hideTargets && (
                            <div className="wa__field mt-4">
                                <div className="wa__fieldHeader">
                                    <label>
                                        <i className="bi bi-people-fill"></i>
                                        Target Grup / Nomor untuk: <span style={{color: currentConfig.color, marginLeft: '4px'}}>{selectedAccount.name}</span> ({selectedAccount.targets.length})
                                    </label>
                                    {canManage && (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            type="button"
                                            onClick={() => addTargetToAccount(currentConfig.key, selectedAccount.id)}
                                            icon="add"
                                        >
                                            Tambah Target
                                        </Button>
                                    )}
                                </div>

                                <div className="wa__targets">
                                    {selectedAccount.targets.length === 0 && (
                                        <div className="wa__targetsEmpty">
                                            <i className="bi bi-chat-left-dots"></i>
                                            <span>Belum ada target untuk akun ini.</span>
                                        </div>
                                    )}
                                    {selectedAccount.targets.map((target) => (
                                        <div key={target.id} className="wa__targetItem">
                                            <div className="wa__targetCheck">
                                                <input
                                                    type="checkbox"
                                                    checked={target.isSelected}
                                                    onChange={e => updateTargetInAccount(currentConfig.key, selectedAccount.id, target.id, 'isSelected', e.target.checked)}
                                                    disabled={!canManage}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={target.name}
                                                onChange={e => updateTargetInAccount(currentConfig.key, selectedAccount.id, target.id, 'name', e.target.value)}
                                                onBlur={() => persistAccountsToBackend(currentConfig.key, getAccounts(currentConfig.key))}
                                                placeholder="Nama Target (Grup/Personal)"
                                                disabled={!canManage}
                                                className="wa__input wa__targetName"
                                            />
                                            <input
                                                type="text"
                                                value={target.code}
                                                onChange={e => updateTargetInAccount(currentConfig.key, selectedAccount.id, target.id, 'code', e.target.value)}
                                                onBlur={() => persistAccountsToBackend(currentConfig.key, getAccounts(currentConfig.key))}
                                                placeholder="ID Grup / No HP"
                                                disabled={!canManage}
                                                className="wa__input wa__targetCode"
                                            />
                                            {canManage && (
                                                <ActionButton
                                                    action="delete"
                                                    onClick={() => removeTargetFromAccount(currentConfig.key, selectedAccount.id, target.id)}
                                                    title="Hapus target"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <span className="wa__fieldHint">Centang target yang ingin dikirimi pesan secara otomatis.</span>
                            </div>
                        )}
                    </div>

                    {/* Status & Actions */}
                    <div className="wa__cardFooter">
                        <div className="wa__status">
                            <span className={`wa__statusDot ${isReady ? 'ready' : 'empty'}`}></span>
                            <span>
                                {isReady ? 'Konfigurasi siap' : !hasToken ? 'Token belum diisi' : 'Target belum diisi'}
                            </span>
                        </div>
                        <div className="wa__footerActions">
                            {canManage && (
                                <Button
                                    variant="primary"
                                    type="button"
                                    onClick={() => handleManualSave(currentConfig.key)}
                                    disabled={saving}
                                    isLoading={saving}
                                    leftIcon={<i className="bi bi-floppy2-fill" />}
                                >
                                    Simpan Pengaturan
                                </Button>
                            )}
                            {canManage && isReady && !currentConfig.hideTargets && (
                                <div className="wa__testGroup">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={() => handleTestSend(currentConfig)}
                                        disabled={testingConfig === currentConfig.key || testingImage === currentConfig.key || saving}
                                        isLoading={testingConfig === currentConfig.key}
                                        leftIcon={<i className="bi bi-send-check" />}
                                    >
                                        Kirim Test
                                    </Button>
                                    {currentConfig.supportsImage && (
                                        <Button
                                            variant="outline"
                                            type="button"
                                            onClick={() => handleTestImage(currentConfig)}
                                            disabled={testingImage === currentConfig.key || testingConfig === currentConfig.key || saving}
                                            isLoading={testingImage === currentConfig.key}
                                            leftIcon={<i className="bi bi-image" />}
                                            title="Kirim gambar contoh untuk menguji apakah paket WA mendukung media"
                                        >
                                            Kirim Test Gambar
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <style jsx>{`
                .wa {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                /* Loading */
                .wa-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    color: var(--n-muted);
                    gap: 12px;
                }
                .wa-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid rgba(148, 163, 184, 0.2);
                    border-top-color: #25D366;
                    border-radius: 50%;
                    animation: spin 0.75s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }


                /* Tabs */
                /* Wrap & Tabs */
                .wa__wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .wa__tabs {
                    display: flex;
                    gap: 4px;
                    padding: 4px;
                    background: var(--n-soft);
                    border-radius: 10px;
                }
                .wa__tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 7px 12px;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__tab:hover { background: rgba(255,255,255,0.5); color: var(--n-text); }
                .wa__tab.active {
                    background: var(--n-card);
                    color: var(--tab-color);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
                }
                .wa__tab i { font-size: 0.95rem; }

                /* Card */
                .wa__card {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .wa__cardHeader {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 16px;
                    background: var(--n-soft);
                    border-left: 4px solid;
                    border-bottom: 1px solid var(--n-border);
                }
                .wa__cardTitle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--n-text);
                }
                .wa__cardTitle i { font-size: 0.95rem; }
                .wa__cardToggle {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .wa__toggleLabel {
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }

                /* Toggle */
                .wa__toggle {
                    width: 42px;
                    height: 22px;
                    border-radius: 11px;
                    border: none;
                    background: #e2e8f0;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.3s;
                    padding: 0;
                }
                .wa__toggle:disabled { opacity: 0.6; cursor: not-allowed; }
                .wa__toggle.on { background: var(--toggle-color, #25D366); }
                .wa__toggleThumb {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: var(--n-card);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    transition: all 0.3s;
                }
                .wa__toggle.on .wa__toggleThumb { transform: translateX(20px); }

                .wa__cardBody { padding: 12px 16px; }
                .wa__cardDesc {
                    margin: 0 0 10px 0;
                    font-size: 0.78rem;
                    color: var(--n-muted);
                }
                .wa__imageMode {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 8px 12px;
                    margin-bottom: 10px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                }
                .wa__imageModeInfo {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .wa__imageModeInfo > i { font-size: 1.1rem; }
                .wa__imageModeTitle {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--n-text);
                }
                .wa__imageModeDesc {
                    font-size: 0.7rem;
                    color: var(--n-muted);
                    margin-top: 1px;
                    line-height: 1.3;
                }

                /* Provider Selector */
                .wa__provider {
                    padding: 8px 12px;
                    margin-bottom: 10px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                }
                .wa__providerHead {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .wa__providerHead label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                }
                .wa__select {
                    min-width: 160px;
                    padding: 4px 10px;
                    height: 34px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    background: var(--n-card);
                    color: var(--n-text);
                    outline: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__select:focus { border-color: #25D366; box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1); }
                .wa__select:disabled { opacity: 0.6; cursor: not-allowed; }
                .wa__providerHint { margin-top: 8px; }
                .wa__providerHint p {
                    margin: 4px 0 0 0;
                    font-size: 0.74rem;
                    color: var(--n-muted);
                    line-height: 1.4;
                }
                .wa__providerBadges { display: flex; gap: 6px; flex-wrap: wrap; }
                .wa__pBadge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .wa__pBadge.ok { background: #dcfce7; color: #15803d; }
                .wa__pBadge.warn { background: #fef3c7; color: #b45309; }
                .wa__pBadge.no { background: #fee2e2; color: #b91c1c; }
                .wa__fields {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .wa__field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .wa__field label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                }
                .wa__field label i { color: var(--n-muted); }
                .wa__fieldHeader {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                .wa__input {
                    width: 100%;
                    padding: 5px 10px;
                    height: 34px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    background: var(--n-card);
                    color: var(--n-text);
                    outline: none;
                    transition: all 0.2s;
                }
                .wa__input:focus {
                    border-color: #25D366;
                    box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
                }
                .wa__input:disabled {
                    background: var(--n-soft);
                    color: var(--n-muted);
                    cursor: not-allowed;
                }
                .wa__input.filled { border-color: #bbf7d0; }
                .wa__textarea { resize: vertical; min-height: 70px; height: auto; font-family: inherit; line-height: 1.4; padding: 6px 10px; font-size: 0.85rem; border-radius: 8px; border: 1px solid var(--n-border); }
                .wa__textarea-sm { min-height: 50px; }
                .wa__fieldHint { font-size: 0.7rem; color: var(--n-muted); margin-top: 2px; display: block; line-height: 1.3; }

                /* Add Button */
                .wa__addBtn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    background: #eff6ff;
                    color: #3083ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__addBtn:hover { background: #dbeafe; }

                /* Targets */
                .wa__targets {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .wa__targetsEmpty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 24px;
                    background: var(--n-soft);
                    border: 2px dashed #e2e8f0;
                    border-radius: 10px;
                    color: var(--n-muted);
                    font-size: 0.82rem;
                }
                .wa__targetsEmpty i { font-size: 1.5rem; }
                .wa__targetItem {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .wa__targetIdx {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    flex-shrink: 0;
                }
                .wa__targetDel:hover { background: #fee2e2; }

                /* Accounts List */
                .wa__accountsList {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .wa__accountItem {
                    padding: 12px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    transition: all 0.2s;
                }
                .wa__accountItem.active {
                    border-color: #3083ff;
                    background: #f0f7ff;
                    box-shadow: 0 2px 8px rgba(0, 56, 168, 0.1);
                }
                .wa__accountMain {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .wa__accountSelect {
                    display: flex;
                    align-items: center;
                }
                .wa__accountSelect input[type="radio"] {
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                    accent-color: #3083ff;
                }
                .wa__accountInputs {
                    flex: 1;
                    display: flex;
                    gap: 8px;
                }
                .wa__accName { flex: 1; }
                .wa__tokenInputGroup {
                    flex: 2;
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .wa__accToken { padding-right: 40px !important; }
                .wa__tokenToggle {
                    position: absolute;
                    right: 8px;
                    background: transparent;
                    border: none;
                    color: var(--n-muted);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }
                .wa__tokenToggle:hover { color: var(--n-muted); }

                /* Targets */
                .wa__targetCheck {
                    display: flex;
                    align-items: center;
                }
                .wa__targetCheck input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: #3083ff;
                }
                .wa__targetName { flex: 1; }
                .wa__targetCode { flex: 2; }
                .mt-4 { margin-top: 1.5rem; }

                /* Help */
                .wa__helpBtn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    background: #eff6ff;
                    color: #3083ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__helpBtn:hover { background: #dbeafe; }
                .wa__helpBox {
                    margin-top: 12px;
                    padding: 14px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.78rem;
                }
                .wa__helpTitle {
                    font-weight: 700;
                    color: var(--n-text);
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--n-border);
                }
                .wa__helpContent h4 {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    margin: 12px 0 6px 0;
                    text-transform: uppercase;
                }
                .wa__helpContent ul { margin: 0; padding-left: 20px; }
                .wa__helpContent li { margin-bottom: 4px; color: var(--n-muted); }
                .wa__helpContent code {
                    background: #e2e8f0;
                    padding: 1px 5px;
                    border-radius: 3px;
                    font-size: 0.75rem;
                    color: var(--n-text);
                }

                /* Footer */
                .wa__cardFooter {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid var(--n-border);
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .wa__footerActions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .wa__status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }
                .wa__statusDot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .wa__statusDot.ready { background: #1d6bf3; }
                .wa__statusDot.empty { background: #ef4444; }
                .wa__testBtn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    background: #eff6ff;
                    color: #3083ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__testBtn:hover { background: #dbeafe; }
                .wa__testBtn.loading { opacity: 0.7; cursor: not-allowed; }
                .wa__testGroup { display: flex; gap: 8px; flex-wrap: wrap; }
                .wa__testBtnImg { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
                .wa__testBtnImg:hover { background: #dbeafe; }

                /* Preview */
                .wa__preview {
                    margin-top: 16px;
                    border: 2px dashed #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                }
                .wa__previewHeader {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }
                .wa__previewHeader i { color: var(--n-muted); }
                .wa__previewContent {
                    padding: 14px;
                    font-size: 0.8rem;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    background: var(--n-card);
                    color: var(--n-text);
                }
                :global(.wa__placeholder) {
                    background: #eff6ff;
                    color: #3083ff;
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-weight: 600;
                }
                :global(.wa__placeholder-empty) {
                    background: #fef3c7;
                    color: #92400e;
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-weight: 600;
                }

                /* Target List (Pesan Umum) */
                .wa__targetList {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .wa__targetCheckItem {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    background: var(--n-soft);
                    border: 2px solid var(--n-border);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__targetCheckItem:hover { border-color: #3083ff; }
                .wa__targetCheckItem.selected { border-color: #3083ff; background: #f0f7ff; }
                .wa__targetCheckItem.invalid { opacity: 0.5; cursor: not-allowed; }
                .wa__checkIcon {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--n-card);
                    border: 2px solid var(--n-border);
                    border-radius: 6px;
                    font-size: 1rem;
                    color: var(--n-muted);
                    flex-shrink: 0;
                    transition: all 0.2s;
                }
                .wa__checkIcon.checked { background: #3083ff; border-color: #3083ff; color: white; }
                .wa__targetInfo { flex: 1; }
                .wa__targetInfo .wa__targetName { font-weight: 600; font-size: 0.88rem; color: var(--n-text); }
                .wa__targetInfo .wa__targetCode { font-size: 0.75rem; color: var(--n-muted); }
                .wa__invalidBadge {
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    background: #fef2f2;
                    color: #dc2626;
                    border-radius: 4px;
                }
                .wa__targetActions {
                    display: flex;
                    gap: 8px;
                }
                .wa__selectAllBtn {
                    padding: 4px 10px;
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa__selectAllBtn:hover { background: #e2e8f0; }
                .wa__selectAllBtn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* Send Section */
                .wa__sendSection {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 20px;
                    background: var(--n-soft);
                    border-radius: 12px;
                    margin-top: 16px;
                }
                .wa__sendBtn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 14px 32px;
                    background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(29, 107, 243, 0.3);
                }
                .wa__sendBtn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(29, 107, 243, 0.4); }
                .wa__sendBtn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .wa__sendBtn.loading { animation: pulse 1.5s infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                .wa__sendHint { font-size: 0.75rem; color: var(--n-muted); }


                /* Dark Mode - Electric Blue & Pitch Black Standard */
                :global(.dark) .wa__tabs { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .wa__tab { color: rgba(255, 255, 255, 0.65) !important; }
                :global(.dark) .wa__tab:hover { background: rgba(26, 115, 232, 0.15) !important; color: #ffffff !important; }
                :global(.dark) .wa__tab.active { background: #1a73e8 !important; color: #ffffff !important; box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important; }
                :global(.dark) .wa__card {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .wa__card:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                :global(.dark) .wa__cardHeader { background: rgba(37, 99, 235, 0.15) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .wa__cardTitle { color: #e2e8f0 !important; }
                :global(.dark) .wa__cardDesc { color: #94a3b8 !important; }
                :global(.dark) .wa__toggle { background: rgba(255, 255, 255, 0.1) !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
                :global(.dark) .wa__toggle.on { background: #1a73e8 !important; border-color: #3b82f6 !important; box-shadow: 0 0 10px rgba(26, 115, 232, 0.5) !important; }
                :global(.dark) .wa__toggleThumb { background: #ffffff !important; }
                :global(.dark) .wa__imageMode { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .wa__provider { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .wa__pBadge.ok { background: rgba(26, 115, 232, 0.2) !important; color: #60a5fa !important; border: 1px solid rgba(59, 130, 246, 0.4) !important; }
                :global(.dark) .wa__pBadge.warn { background: rgba(245, 158, 11, 0.15) !important; color: #fbbf24 !important; }
                :global(.dark) .wa__pBadge.no { background: rgba(239, 68, 68, 0.15) !important; color: #f87171 !important; }
                :global(.dark) .wa__input, :global(.dark) .wa__textarea { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #e2e8f0 !important; }
                :global(.dark) .wa__input:focus, :global(.dark) .wa__textarea:focus { border-color: #3b82f6 !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important; }
                :global(.dark) .wa__select { height: 40px !important; background-color: #0b1329 !important; background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important; background-repeat: no-repeat !important; background-position: right 12px center !important; background-size: 16px 16px !important; padding-right: 36px !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #e2e8f0 !important; -webkit-appearance: none !important; appearance: none !important; }
                :global(.dark) .wa__input.filled { border-color: #3b82f6 !important; }
                :global(.dark) .wa__accountItem { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .wa__accountItem.active { background: rgba(26, 115, 232, 0.15) !important; border: 1px solid #3b82f6 !important; box-shadow: 0 0 14px rgba(26, 115, 232, 0.4) !important; }
                :global(.dark) .wa__accountSelect input[type="radio"] { accent-color: #3b82f6 !important; }
                :global(.dark) .wa__addBtn { background: #0b1329 !important; color: #60a5fa !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 10px !important; }
                :global(.dark) .wa__addBtn:hover { background: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; border-color: #3b82f6 !important; }
                :global(.dark) .wa__targetIdx { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .wa__targetsEmpty { background: rgba(26, 115, 232, 0.08) !important; border: 1px dashed rgba(26, 115, 232, 0.4) !important; color: #94a3b8 !important; border-radius: 12px !important; }
                :global(.dark) .wa__targetCheck input[type="checkbox"] { accent-color: #3b82f6 !important; }
                :global(.dark) .wa__statusDot.ready { background: #3b82f6 !important; box-shadow: 0 0 8px #3b82f6 !important; }
                :global(.dark) .wa__testBtn, :global(.dark) .wa__testBtnImg { background: #0b1329 !important; color: #60a5fa !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 10px !important; }
                :global(.dark) .wa__testBtn:hover, :global(.dark) .wa__testBtnImg:hover { background: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; border-color: #3b82f6 !important; }
                :global(.dark) .wa__helpBtn { background: #0b1329 !important; color: #60a5fa !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 10px !important; }
                :global(.dark) .wa__helpBtn:hover { background: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; }
                :global(.dark) .wa__helpBox { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; border-radius: 12px !important; }
                :global(.dark) .wa__helpTitle { border-bottom-color: rgba(26, 115, 232, 0.4) !important; color: #e2e8f0 !important; }
                :global(.dark) .wa__helpContent code { background: rgba(26, 115, 232, 0.2) !important; color: #60a5fa !important; }
                :global(.dark) .wa__preview { border-color: rgba(26, 115, 232, 0.4) !important; border-radius: 12px !important; }
                :global(.dark) .wa__previewHeader { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; color: #e2e8f0 !important; }
                :global(.dark) .wa__previewContent { background: #0b1329 !important; color: #cbd5e1 !important; }
                :global(.dark) .wa__placeholder { background: rgba(26, 115, 232, 0.2) !important; color: #60a5fa !important; }
                :global(.dark) .wa__targetCheckItem { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .wa__targetCheckItem:hover { border-color: #3b82f6 !important; }
                :global(.dark) .wa__targetCheckItem.selected { background: rgba(26, 115, 232, 0.15) !important; border-color: #3b82f6 !important; box-shadow: 0 0 12px rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .wa__checkIcon { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .wa__checkIcon.checked { background: #1a73e8 !important; border-color: #3b82f6 !important; color: #ffffff !important; }
                :global(.dark) .wa__targetInfo .wa__targetName { color: #e2e8f0 !important; }
                :global(.dark) .wa__sendSection { background: rgba(26, 115, 232, 0.08) !important; border: 1px solid rgba(26, 115, 232, 0.3) !important; border-radius: 12px !important; }
                :global(.dark) .wa__sendBtn { background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important; color: #ffffff !important; border: 1px solid rgba(59, 130, 246, 0.6) !important; border-radius: 12px !important; box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important; }
                :global(.dark) .wa__sendBtn:hover:not(:disabled) { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important; box-shadow: 0 6px 20px rgba(26, 115, 232, 0.65) !important; transform: translateY(-1px) !important; }




                @media (max-width: 768px) {
                    .wa__tabs { flex-wrap: nowrap; }
                    .wa__tab { flex: 1; min-width: 0; padding: 8px 4px; font-size: 0.72rem; gap: 4px; }
                    .wa__tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .wa__targetItem { flex-wrap: wrap; }
                    .wa__targetName, .wa__targetCode { flex: 1 1 100%; }
                    .wa__cardFooter { flex-direction: column; gap: 12px; }
                    .wa__testGroup { width: 100%; }
                    .wa__testBtn { flex: 1; justify-content: center; }
                }
            `}</style>
        </div>
    )
}


