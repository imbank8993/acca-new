'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save, Smartphone, RefreshCw } from 'lucide-react'
import Swal from 'sweetalert2'
import { Spinner } from '@/components/ui/Spinner'
import { hasPermission } from '@/lib/permissions-client'
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown'
import InlineSelect from '@/components/ui/InlineSelect'
import './whatsapp-accounts.css'

type Provider = 'fonnte' | 'watzap' | 'ultramsg' | 'baileys'
type Target = { id: string; name: string; code: string; isSelected: boolean }
type WAAccount = { id: string; name: string; provider: Provider; token: string; targets: Target[]; targetsByFeature?: Record<string, Target[]>; features: string[]; enabled: boolean }

const FEATURES = [
    { id: 'piket', label: 'Piket', recipient: 'group' },
    { id: 'ketidakhadiran', label: 'Ketidakhadiran', recipient: 'group' },
    { id: 'ptsp', label: 'PTSP', recipient: 'personal' },
    { id: 'sanggar', label: 'Sanggar', recipient: 'personal' },
    { id: 'guru_asuh', label: 'Guru Asuh', recipient: 'personal' },
    { id: 'klinik', label: 'Klinik', recipient: 'personal' },
    { id: 'jadwal', label: 'Jadwal & tukar jadwal', recipient: 'personal' },
]
const PROVIDERS: { id: Provider; label: string }[] = [
    { id: 'fonnte', label: 'Fonnte' },
    { id: 'watzap', label: 'Watzap.me' },
    { id: 'ultramsg', label: 'UltraMsg' },
    { id: 'baileys', label: 'Baileys' },
]
const CENTRAL_ACCOUNTS_KEY = 'wa_accounts_v3'
const FEATURE_MAP_KEY = 'wa_feature_account_map'

function makeId() { return `wa_${Math.random().toString(36).slice(2, 10)}` }
function defaultAccount(): WAAccount { return { id: makeId(), name: 'Akun WhatsApp baru', provider: 'fonnte', token: '', targets: [], features: [], enabled: true } }
function cleanLegacyName(account: WAAccount, index: number): WAAccount {
    if (account.name.toLowerCase() === 'baileys lama') return { ...account, name: `Akun WhatsApp ${index + 1}` }
    if (account.name.toLowerCase().endsWith(' lama')) return { ...account, name: `Akun ${account.name.slice(0, -5)}` }
    return account
}
function normalizeAccountTargets(account: WAAccount): WAAccount {
    const features = Array.isArray(account.features) ? account.features : []
    const targets = Array.isArray(account.targets) ? account.targets : []
    if (account.targetsByFeature) return { ...account, features, targets, targetsByFeature: account.targetsByFeature }
    return { ...account, features, targets, targetsByFeature: Object.fromEntries(features.map(feature => [feature, targets.map(target => ({ ...target, id: makeId() }))])) }
}

function migrateLegacy(settings: Record<string, string>): WAAccount[] {
    const accounts: WAAccount[] = []
    for (const feature of FEATURES) {
        let legacy: any[] = []
        try { legacy = JSON.parse(settings[`wa_accounts_v2_${feature.id}`] || '[]') } catch { /* use legacy token below */ }
        const selected = legacy.find(account => account.isSelected) || legacy[0]
        const provider = (settings[`wa_provider_${feature.id}`] || settings.wa_provider || 'fonnte') as Provider
        const token = selected?.token || settings[`wa_token_${feature.id}`] || ''
        let targets = selected?.targets || []
        if (!targets.length) {
            try { targets = JSON.parse(settings[`wa_targets_${feature.id}`] || '[]') } catch { targets = [] }
        }
        if (!selected && !token && provider !== 'baileys' && !targets.length) continue

        // Semua fitur yang selama ini memakai satu socket Baileys mewarisi sesi lama.
        const existing = provider === 'baileys' ? accounts.find(account => account.id === 'default') : undefined
        const featureTargets = targets.map((item: any) => ({ id: item.id || makeId(), name: item.name || '', code: item.code || '', isSelected: item.isSelected !== false }))
        const account: WAAccount = existing || {
            id: provider === 'baileys' ? 'default' : `legacy_${feature.id}`,
            name: provider === 'baileys' ? 'Akun WhatsApp 1' : `Akun ${feature.label}`,
            provider,
            token,
            targets: featureTargets,
            targetsByFeature: {},
            features: [],
            enabled: true,
        }
        if (!accounts.includes(account)) accounts.push(account)
        if (!account.features.includes(feature.id)) account.features.push(feature.id)
        if (!account.targetsByFeature) account.targetsByFeature = {}
        account.targetsByFeature[feature.id] = featureTargets.map((target: Target) => ({ ...target, id: makeId() }))
    }
    return accounts
}

function BaileysSession({ accountId, canManage }: { accountId: string; canManage: boolean }) {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const refresh = useCallback(async () => {
        try {
            const response = await fetch(`/api/whatsapp/baileys/status?accountId=${encodeURIComponent(accountId)}`, { cache: 'no-store' })
            setStatus(await response.json())
        } catch { setStatus({ ok: false, error: 'Status koneksi tidak dapat dibaca' }) }
        finally { setLoading(false) }
    }, [accountId])
    useEffect(() => {
        refresh()
        const timer = setInterval(refresh, 5000)
        return () => clearInterval(timer)
    }, [refresh])
    const disconnect = async () => {
        const answer = await Swal.fire({ title: 'Putuskan akun ini?', text: 'Anda perlu scan QR lagi untuk menyambungkannya.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Putuskan', cancelButtonText: 'Batal' })
        if (!answer.isConfirmed) return
        setBusy(true)
        try {
            await fetch('/api/whatsapp/baileys/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId }) })
            await refresh()
        } finally { setBusy(false) }
    }
    if (loading) return <small>Memeriksa koneksi Baileys…</small>
    return <div className="wa-account-session">
        <div className="wa-account-session__state"><span className={`wa-account-session__dot ${status?.connected ? 'is-connected' : ''}`} />
            <div><strong>{status?.connected ? `Tersambung${status.user?.name ? ` · ${status.user.name}` : ''}` : 'Belum tersambung'}</strong><small>{status?.connected ? 'Koneksi WhatsApp aktif' : status?.qr ? 'Pindai QR dari WhatsApp untuk menghubungkan akun' : status?.error || 'Menyiapkan kode koneksi…'}</small></div>
            {!status?.connected && status?.qr && <img className="wa-account-session__qr" src={status.qr} alt={`QR pairing ${accountId}`} width={128} height={128} />}
            {status?.connected && canManage && <button type="button" onClick={disconnect} disabled={busy} className="wa-account-button">{busy ? 'Memutuskan…' : 'Putuskan akun'}</button>}
        </div>
    </div>
}

export default function WhatsAppAccountsTab({ user }: { user?: any }) {
    const roles = user?.roles || []
    const isAdmin = user?.role === 'ADMIN' || roles.some((role: string) => role.toUpperCase() === 'ADMIN')
    const canManage = hasPermission(user?.permissions || [], 'pengaturan_umum', 'manage', isAdmin, roles)
    const [accounts, setAccounts] = useState<WAAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testingAccount, setTestingAccount] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/site-settings', { cache: 'no-store' })
            const result = await response.json()
            const settings = Object.fromEntries((result.data || []).map((row: any) => [row.key, row.value])) as Record<string, string>
            let loaded: WAAccount[] = []
            try { loaded = JSON.parse(settings[CENTRAL_ACCOUNTS_KEY] || '[]') } catch { loaded = [] }
            setAccounts((loaded.length ? loaded : migrateLegacy(settings)).map(cleanLegacyName).map(normalizeAccountTargets))
        } catch (error) {
            console.error('Failed to load WhatsApp accounts', error)
            await Swal.fire('Gagal memuat', 'Pengaturan akun WhatsApp tidak dapat dibaca.', 'error')
        } finally { setLoading(false) }
    }, [])
    useEffect(() => { load() }, [load])

    const updateAccount = (id: string, patch: Partial<WAAccount>) => setAccounts(current => current.map(account => account.id === id ? { ...account, ...patch } : account))
    const updateFeatureTargets = (account: WAAccount, featureId: string, targets: Target[]) => updateAccount(account.id, { targetsByFeature: { ...(account.targetsByFeature || {}), [featureId]: targets } })
    const addTarget = (account: WAAccount, featureId: string) => updateFeatureTargets(account, featureId, [...(account.targetsByFeature?.[featureId] || []), { id: makeId(), name: '', code: '', isSelected: true }])
    const testAccount = async (account: WAAccount, featureId: string) => {
        const targets = (account.targetsByFeature?.[featureId] || []).filter(target => target.isSelected && target.code.trim()).map(target => target.code.trim())
        if (account.provider !== 'baileys' && !account.token) {
            await Swal.fire('Token belum diisi', 'Masukkan token provider terlebih dahulu.', 'info')
            return
        }
        if (!targets.length) {
            await Swal.fire('Target belum diisi', 'Tambahkan dan pilih minimal satu target pesan.', 'info')
            return
        }
        setTestingAccount(account.id)
        try {
            const response = await fetch('/api/whatsapp/test-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: `${account.name} · ${FEATURES.find(feature => feature.id === featureId)?.label || featureId}`, provider: account.provider, token: account.token, accountId: account.id, targets }) })
            const result = await response.json()
            const details = (result.results || []).map((item: any) => `${item.ok ? '✅' : '❌'} ${item.target}: ${item.raw?.detail || item.raw?.error || item.raw?.message || ''}`).join('\n')
            await Swal.fire({ icon: result.ok ? 'success' : 'error', title: result.ok ? `Terkirim ${result.successCount}/${result.total}` : 'Pesan uji gagal', text: details || result.error || 'Tidak ada respons dari provider.' })
        } catch (error: any) { await Swal.fire('Gagal mengirim', error?.message || 'Terjadi kesalahan.', 'error') }
        finally { setTestingAccount(null) }
    }
    const save = async () => {
        setSaving(true)
        try {
            const mapping = Object.fromEntries(FEATURES.map(feature => [feature.id, accounts.find(account => account.enabled && account.features.includes(feature.id))?.id || '']))
            const writes: [string, string][] = [
                [CENTRAL_ACCOUNTS_KEY, JSON.stringify(accounts)],
                [FEATURE_MAP_KEY, JSON.stringify(mapping)],
            ]
            for (const feature of FEATURES) {
                const account = accounts.find(item => item.id === mapping[feature.id])
                const targets = account?.targetsByFeature?.[feature.id]?.filter(target => target.isSelected && target.code.trim()) || []
                writes.push(
                    [`wa_provider_${feature.id}`, account?.provider || ''],
                    [`wa_token_${feature.id}`, account?.token || ''],
                    [`wa_targets_${feature.id}`, JSON.stringify(targets)],
                    [`wa_target_${feature.id}`, targets[0]?.code || ''],
                    [`wa_account_id_${feature.id}`, account?.id || ''],
                )
            }
            const response = await fetch('/api/site-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: writes.map(([key, value]) => ({ key, value })) }) })
            const result = await response.json()
            if (!response.ok || !result.ok) throw new Error(result.message || result.error || 'Gagal menyimpan pengaturan akun WhatsApp')
            await Swal.fire({ icon: 'success', title: 'Pengaturan tersimpan', timer: 1400, showConfirmButton: false })
            await load()
        } catch (error: any) {
            await Swal.fire('Gagal menyimpan', error?.message || 'Terjadi kesalahan.', 'error')
        } finally { setSaving(false) }
    }

    if (loading) return <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}><Spinner variant="buble" /></div>

    return <section className="wa-accounts">
        <div className="wa-accounts__toolbar">
            {canManage && <div className="wa-accounts__actions"><button type="button" className="wa-account-button wa-account-button--primary" onClick={() => setAccounts(current => [...current, defaultAccount()])}><Plus size={16} /> Tambah akun</button><button type="button" className="wa-account-button wa-account-button--icon" onClick={load} title="Muat ulang"><RefreshCw size={16} /></button></div>}
        </div>

        {accounts.length === 0 && <div style={{ padding: 24, border: '1px dashed var(--n-border,#cbd5e1)', borderRadius: 14, color: 'var(--n-muted,#64748b)' }}>Belum ada akun WhatsApp. Tambahkan akun untuk mengatur koneksi halaman.</div>}
        {accounts.map((account, index) => <article key={account.id} className="wa-account-card">
            <div className="wa-account-card__head"><div className="wa-account-card__identity"><span className="wa-account-card__icon"><Smartphone size={17} /></span><div><strong>{account.name || `Akun WhatsApp ${index + 1}`}</strong><small>{account.features.length ? `${account.features.length} halaman terhubung` : 'Belum ada halaman terhubung'}</small></div><span className="wa-account-card__provider">{PROVIDERS.find(provider => provider.id === account.provider)?.label || account.provider}</span></div>{canManage && <button type="button" aria-label="Hapus akun" title="Hapus akun" onClick={() => setAccounts(current => current.filter(item => item.id !== account.id))} className="wa-account-button wa-account-button--danger"><Trash2 size={16} /></button>}</div>
            <div className="wa-account-fields">
                <label>Nama akun<input disabled={!canManage} className="wa-account-input" value={account.name} onChange={event => updateAccount(account.id, { name: event.target.value })} placeholder="Misal: WA Piket" /></label>
                <label>Provider<InlineSelect
                    value={account.provider}
                    onChange={value => updateAccount(account.id, { provider: value as Provider })}
                    options={PROVIDERS.map(provider => ({ value: provider.id, label: provider.label }))}
                    disabled={!canManage}
                    minWidth="100%"
                    height="40px"
                    className="wa-account-provider-select"
                /></label>
                {account.provider !== 'baileys' && <label>Token / ID<input disabled={!canManage} type="password" autoComplete="new-password" className="wa-account-input" value={account.token} onChange={event => updateAccount(account.id, { token: event.target.value })} placeholder="Token provider" /></label>}
            </div>
            {account.provider === 'baileys' && <BaileysSession accountId={account.id} canManage={canManage} />}

            <div className="wa-account-section"><strong>Hubungkan ke halaman</strong><MultiSelectDropdown
                options={FEATURES.map(feature => ({
                    value: feature.id,
                    label: feature.label,
                    disabled: accounts.some(item => item.id !== account.id && item.enabled && item.features.includes(feature.id)),
                }))}
                value={account.features}
                onChange={selected => setAccounts(current => current.map(item => item.id === account.id
                    ? { ...item, features: selected }
                    : { ...item, features: item.features.filter(featureId => !selected.includes(featureId)) }))}
                placeholder="Pilih halaman"
                allSelectedText="Semua halaman"
                columns={2}
                showQuickActions={false}
                disabled={!canManage}
                className="wa-account-feature-select"
            /></div>

            {account.features.map(featureId => {
                const feature = FEATURES.find(item => item.id === featureId)
                const targets = account.targetsByFeature?.[featureId] || []
                if (feature?.recipient === 'personal') return <div key={featureId} className="wa-account-section wa-account-service-targets"><strong>Tujuan {feature.label}</strong><p className="wa-account-recipient-note">Pesan dikirim ke nomor WhatsApp pribadi penerima yang diambil dari data layanan. Target grup tidak diperlukan.</p></div>
                return <div key={featureId} className="wa-account-section wa-account-service-targets"><div className="wa-account-section__head"><strong>Target {feature?.label || featureId}</strong>{canManage && <button type="button" className="wa-account-button" onClick={() => addTarget(account, featureId)}><Plus size={14} /> Tambah target</button>}</div>
                    {targets.map(target => <div key={target.id} className="wa-account-target"><input type="checkbox" aria-label="Aktifkan target" disabled={!canManage} checked={target.isSelected} onChange={event => updateFeatureTargets(account, featureId, targets.map(item => item.id === target.id ? { ...item, isSelected: event.target.checked } : item))} /><input disabled={!canManage} className="wa-account-input" value={target.name} onChange={event => updateFeatureTargets(account, featureId, targets.map(item => item.id === target.id ? { ...item, name: event.target.value } : item))} placeholder="Nama target" /><input disabled={!canManage} className="wa-account-input" value={target.code} onChange={event => updateFeatureTargets(account, featureId, targets.map(item => item.id === target.id ? { ...item, code: event.target.value } : item))} placeholder="Nomor WA atau ID grup" />{canManage && <button type="button" onClick={() => updateFeatureTargets(account, featureId, targets.filter(item => item.id !== target.id))} className="wa-account-button wa-account-button--danger" aria-label="Hapus target"><Trash2 size={14} /></button>}</div>)}
                    {targets.length === 0 && <small className="wa-account-hint">Belum ada target untuk halaman ini.</small>}
                    {canManage && <button type="button" className="wa-account-button wa-account-test" disabled={testingAccount === account.id} onClick={() => testAccount(account, featureId)}>{testingAccount === account.id ? 'Mengirim…' : `Kirim pesan uji · ${feature?.label || featureId}`}</button>}
                </div>
            })}
        </article>)}

        {canManage && <div className="wa-accounts__save"><button type="button" onClick={save} disabled={saving} className="wa-account-button wa-account-button--save"><Save size={16} />{saving ? 'Menyimpan…' : 'Simpan pengaturan'}</button></div>}
    </section>
}
