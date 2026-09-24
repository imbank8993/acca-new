'use client'

/**
 * useTimezone hook for client components.
 * Provides synchronous timezone value after initial fetch.
 *
 * Usage:
 *   const { timezone, formatDate, formatTime, getCurrentDate } = useTimezone()
 */

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@/lib/timezone'

export function useTimezone() {
    const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTimezone = async () => {
            try {
                const res = await fetch('/api/site-settings?key=timezone')
                const data = await res.json().catch(() => null)

                const val = data?.data?.value || data?.value
                if (val) {
                    const validTimezones = TIMEZONE_OPTIONS.map((t: { value: string }) => t.value)
                    if (validTimezones.includes(val)) {
                        setTimezone(val)
                    }
                }
            } catch (err) {
                console.error('[useTimezone] Error:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchTimezone()
    }, [])

    const formatDate = useCallback((date: Date | string, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            ...options,
            timeZone: timezone
        })
    }, [timezone])

    const formatTime = useCallback((date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit',
            timeZone: timezone
        })
    }, [timezone])

    const formatDateTime = useCallback((date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: timezone
        })
    }, [timezone])

    const getCurrentDate = useCallback(() => {
        return new Date().toLocaleDateString('en-CA', { timeZone: timezone })
    }, [timezone])

    const getDayName = useCallback(() => {
        return new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            timeZone: timezone
        })
    }, [timezone])

    const formatDayName = useCallback((date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString('id-ID', {
            weekday: 'long',
            timeZone: timezone
        })
    }, [timezone])

    return {
        timezone,
        loading,
        formatDate,
        formatTime,
        formatDateTime,
        getCurrentDate,
        getDayName,
        formatDayName,
    }
}