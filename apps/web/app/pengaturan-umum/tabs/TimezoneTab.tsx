'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { hasPermission } from '@/lib/permissions-client'
import Swal from 'sweetalert2'
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone'
import { Spinner } from '@/components/ui/Spinner'

interface TimezoneInfo {
    current: string
    label: string
    serverTime: string
}

export default function TimezoneTab({ user }: { user?: any }) {
    const permissions = user?.permissions || []
    const isAdmin = (user?.role === 'ADMIN') || (user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN')) || false
    const canManage = hasPermission(permissions, 'pengaturan_umum', 'manage', isAdmin, user?.roles)

    const [settings, setSettings] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo>({
        current: DEFAULT_TIMEZONE,
        label: 'WITA (Asia/Makassar)',
        serverTime: '',
    })

    const fetchSettings = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/site-settings?key=timezone')
            const result = await res.json()
            
            if (res.ok && result?.data && result.data.length > 0) {
                const tzValue = result.data[0].value || DEFAULT_TIMEZONE
                const found = TIMEZONE_OPTIONS.find(t => t.value === tzValue)
                const label = found ? found.label : tzValue

                // Get current time in the selected timezone
                const now = new Date()
                const serverTime = now.toLocaleString('id-ID', { timeZone: tzValue })

                setTimezoneInfo({
                    current: tzValue,
                    label,
                    serverTime,
                })
                setSettings(prev => ({ ...prev, timezone: tzValue }))
            } else {
                // Set default if not configured
                setTimezoneInfo({
                    current: DEFAULT_TIMEZONE,
                    label: 'WITA (Asia/Makassar)',
                    serverTime: new Date().toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
                })
                setSettings(prev => ({ ...prev, timezone: DEFAULT_TIMEZONE }))
            }
        } catch (err) {
            console.error('Error fetching timezone:', err)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const saveTimezone = async (value: string) => {
        if (!canManage) {
            Swal.fire({ icon: 'warning', title: 'Tidak punya akses', text: 'Hanya admin yang dapat mengubah pengaturan.' })
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'timezone',
                    value,
                    label: 'Zona Waktu',
                    description: 'Pengaturan zona waktu sekolah (WIB/WITA/WIT)',
                })
            })
            const result = await res.json()

            if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal menyimpan')

            // Update local state
            const found = TIMEZONE_OPTIONS.find(t => t.value === value)
            const label = found ? found.label : value
            const serverTime = new Date().toLocaleString('id-ID', { timeZone: value })

            setTimezoneInfo({
                current: value,
                label,
                serverTime,
            })
            setSettings(prev => ({ ...prev, timezone: value }))

            // Clear timezone cache in lib/timezone.ts
            // The cache will auto-refresh on next request

            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: `Zona waktu berhasil diubah ke ${label}`,
                timer: 2000,
                showConfirmButton: false,
            })
        } catch (err: any) {
            console.error('Error saving timezone:', err)
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="tz-loading">
                <Spinner variant="buble" />
            </div>
        )
    }

    return (
        <div className="tz-container">
            
            <div className="tz-current">
                <div className="tz-label">Zona waktu saat ini</div>
                <div className="tz-value">
                    <span className="tz-badge">{timezoneInfo.label}</span>
                    <span className="tz-time">
                        <i className="bi bi-clock-history me-1"></i> Server: {timezoneInfo.serverTime}
                    </span>
                </div>
            </div>

            <div className="tz-options">
                <div className="tz-options-label">Pilih Zona Waktu</div>
                <div className="tz-options-grid">
                    {TIMEZONE_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`tz-option ${settings.timezone === option.value ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="timezone"
                                value={option.value}
                                checked={settings.timezone === option.value}
                                onChange={(e) => saveTimezone(e.target.value)}
                                disabled={!canManage || saving}
                            />
                            <div className="tz-option-content">
                                <div className="tz-option-header">
                                    <span className="tz-option-label">{option.label}</span>
                                    {settings.timezone === option.value && (
                                        <span className="tz-check"><i className="bi bi-check-circle-fill"></i></span>
                                    )}
                                </div>
                                <div className="tz-option-desc">{option.description}</div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {!canManage && (
                <div className="tz-warning">
                    <i className="bi bi-exclamation-triangle"></i>
                    <span>Anda tidak memiliki akses untuk mengubah pengaturan zona waktu.</span>
                </div>
            )}

            <style jsx>{`
                .tz-container {
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

                .tz-loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 150px;
                }

                .tz-current {
                    background: var(--n-card);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    padding: 10px 16px;
                    margin-bottom: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.02);
                }

                .tz-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 6px;
                }

                .tz-value {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .tz-badge {
                    background: var(--n-primary, #3083ff);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(48, 131, 255, 0.2);
                }

                .tz-time {
                    color: var(--n-muted);
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .tz-options {
                    background: var(--n-card);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                    padding: 12px 16px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.02);
                }

                .tz-options-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--n-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }

                .tz-options-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .tz-option {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 8px 12px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tz-option:hover {
                    border-color: #cbd5e1;
                    background: var(--n-soft);
                    transform: translateY(-1px);
                }

                .tz-option.is-selected {
                    border-color: var(--n-primary, #3083ff);
                    background: #f0f7ff;
                    box-shadow: 0 0 0 1px var(--n-primary, #3083ff);
                }

                .tz-option input[type="radio"] {
                    margin-top: 2px;
                    accent-color: var(--n-primary, #3083ff);
                    width: 16px;
                    height: 16px;
                }

                .tz-option-content {
                    flex: 1;
                }

                .tz-option-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 2px;
                }

                .tz-option-label {
                    font-weight: 700;
                    font-size: 0.85rem;
                    color: var(--n-text);
                }

                .tz-check {
                    color: var(--n-primary, #3083ff);
                    font-size: 1rem;
                }

                .tz-option-desc {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    line-height: 1.3;
                }

                .tz-warning {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 10px;
                    padding: 8px 12px;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    color: #92400e;
                    font-weight: 500;
                }

                /* DARK MODE GLOBAL SCOPE FIXES */
                :global(.dark) .tz-badge {
                    background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
                    border: 1px solid rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important;
                    color: #ffffff !important;
                    border-radius: 8px !important;
                }
                :global(.dark) .tz-current {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .tz-current:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                :global(.dark) .tz-options {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .tz-options:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }
                :global(.dark) .tz-label, :global(.dark) .tz-options-label {
                    color: #94a3b8 !important;
                    font-weight: 750 !important;
                }
                :global(.dark) .tz-time {
                    color: #94a3b8 !important;
                }
                :global(.dark) .tz-option {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                }
                :global(.dark) .tz-option input[type="radio"] {
                    accent-color: #3b82f6 !important;
                }
                :global(.dark) .tz-option:hover {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .tz-option.is-selected {
                    background: rgba(26, 115, 232, 0.18) !important;
                    border: 1px solid #3b82f6 !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .tz-option-label {
                    color: #ffffff !important;
                }
                :global(.dark) .tz-option-desc {
                    color: #94a3b8 !important;
                }
                :global(.dark) .tz-check {
                    color: #60a5fa !important;
                }
                :global(.dark) .tz-warning {
                    background: rgba(251, 191, 36, 0.12) !important;
                    border: 1px solid rgba(251, 191, 36, 0.4) !important;
                    color: #fcd34d !important;
                    border-radius: 12px !important;
                }



                @media (max-width: 576px) {
                    .tz-value {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                }
            `}</style>
        </div>
    )
}

