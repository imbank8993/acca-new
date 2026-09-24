'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { User } from '@/lib/types'
import { OPEN_NOTIFICATIONS_EVENT, NOTIF_COUNT_EVENT } from '@/lib/app-events'
import { Bell, CheckCheck, Clock, BellOff, X } from 'lucide-react'
import LucideIcon from './ui/LucideIcon'
import './notification-dropdown.css'

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    created_at: string;
    count?: number;
    ids?: string[]; // Tracking all grouped IDs
}

// ── Read-state persistence (localStorage) ────────────────────────────────
// Disimpan sbg { [id]: readAtMs } + prune otomatis agar tak membengkak.
// Backward-compatible dgn format lama (array of id).
const READ_KEY = 'read-notifications'
const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000 // 30 hari

function loadReadMap(): Record<string, number> {
    if (typeof window === 'undefined') return {}
    try {
        const raw = localStorage.getItem(READ_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        const now = Date.now()
        let map: Record<string, number> = {}
        if (Array.isArray(parsed)) parsed.forEach((id: string) => { map[id] = now })
        else if (parsed && typeof parsed === 'object') map = parsed
        for (const id in map) {
            if (now - map[id] > READ_RETENTION_MS) delete map[id]
        }
        return map
    } catch { return {} }
}

function saveReadMap(map: Record<string, number>) {
    try { localStorage.setItem(READ_KEY, JSON.stringify(map)) } catch { /* storage penuh/diblokir */ }
}

// ── Type → kategori / ikon / warna ───────────────────────────────────────
// Dipetakan via prefix type + override warna berdasar status (disetujui/ditolak/revisi).
function getTypeMeta(type: string): { icon: string; colorClass: string; category: string } {
    const t = type || ''
    let colorClass = 'notification-icon-info'
    if (/(_disetujui|_approved|_activated)$/.test(t)) colorClass = 'notification-icon-success'
    else if (/(_ditolak|_deactivated|_deleted)$/.test(t)) colorClass = 'notification-icon-danger'
    else if (/_revisi$/.test(t)) colorClass = 'notification-icon-warning'

    const base = (cls: string) => (colorClass === 'notification-icon-info' ? cls : colorClass)

    if (t.startsWith('jurnal')) return { icon: 'book', colorClass: base('notification-icon-jurnal'), category: 'Jurnal' }
    if (t.startsWith('nilai')) return { icon: 'percent', colorClass: base('notification-icon-nilai'), category: 'Nilai' }
    if (t.startsWith('lckh')) return { icon: 'file-signature', colorClass: base('notification-icon-jurnal'), category: 'LCKH' }
    if (t.startsWith('izin')) return { icon: 'clock', colorClass: base('notification-icon-izin'), category: 'Izin' }
    if (t.startsWith('ketidakhadiran') || t.startsWith('kehadiran')) return { icon: 'user-check', colorClass: base('notification-icon-izin'), category: 'Kehadiran' }
    if (t.startsWith('jadwal')) return { icon: 'calendar-range', colorClass: base('notification-icon-jadwal'), category: 'Jadwal' }
    if (t.startsWith('piket')) return { icon: 'calendar-check', colorClass: base('notification-icon-piket'), category: 'Piket' }
    if (t.startsWith('user')) return { icon: 'user-cog', colorClass: base('notification-icon-user'), category: 'User' }
    if (t.startsWith('siswa') || t.startsWith('mapel') || t.startsWith('kelas')) return { icon: 'database', colorClass: base('notification-icon-master'), category: 'Master' }
    if (t.startsWith('maintenance')) return { icon: 'wrench', colorClass: 'notification-icon-warning', category: 'Sistem' }
    if (t.startsWith('informasi')) return { icon: 'info', colorClass: base('notification-icon-info'), category: 'Informasi' }
    if (t.startsWith('agenda')) return { icon: 'calendar-days', colorClass: base('notification-icon-info'), category: 'Agenda' }
    if (t.startsWith('dokumen') || t.startsWith('folder')) return { icon: 'folder', colorClass: base('notification-icon-nilai'), category: 'Dokumen' }
    if (t.startsWith('tagihan')) return { icon: 'receipt', colorClass: base('notification-icon-warning'), category: 'Tagihan' }
    if (t.startsWith('survey')) return { icon: 'poll', colorClass: base('notification-icon-info'), category: 'Survey' }
    if (t.startsWith('ujian')) return { icon: 'file-edit', colorClass: base('notification-icon-info'), category: 'Ujian' }
    if (t.startsWith('kinerja')) return { icon: 'trending-up', colorClass: base('notification-icon-info'), category: 'Kinerja' }
    if (t.startsWith('laporan')) return { icon: 'clipboard-list', colorClass: base('notification-icon-info'), category: 'Laporan' }
    return { icon: 'bell', colorClass, category: 'Info' }
}

// ── Pengelompokan tanggal ────────────────────────────────────────────────
const DATE_SECTIONS = ['Hari Ini', 'Kemarin', 'Minggu Ini', 'Sebelumnya'] as const
function dateSection(dateStr: string): string {
    const d = new Date(dateStr).getTime()
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const DAY = 86400000
    if (d >= startToday) return 'Hari Ini'
    if (d >= startToday - DAY) return 'Kemarin'
    if (d >= startToday - 6 * DAY) return 'Minggu Ini'
    return 'Sebelumnya'
}

/**
 * Lonceng notifikasi + dropdown/sheet-nya — diekstrak dari Header.tsx supaya
 * bisa dipakai juga di kartu identitas profil pada halaman dashboard (yang
 * tidak lagi merender <Header>). Mandiri sepenuhnya: fetch, polling, dan
 * penandaan "sudah dibaca" tidak bergantung pada komponen induk mana pun.
 */
export default function NotificationBell({ user, iconSize = 18, className }: { user: User; iconSize?: number; className?: string }) {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const readMapRef = useRef<Record<string, number>>(loadReadMap())
    const [readNotifications, setReadNotifications] = useState<Set<string>>(() => new Set(Object.keys(readMapRef.current)))
    const [unreadCount, setUnreadCount] = useState(0)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [bellPulse, setBellPulse] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const seenIdsRef = useRef<Set<string> | null>(null)
    const notificationRef = useRef<HTMLDivElement>(null)
    const roleRef = useRef('')
    const uidRef = useRef('')
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 992)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Fetch notifications filtered by user role + userId
    const fetchNotifications = async (role?: string, userId?: string) => {
        try {
            if (!role && !userId) return;
            // Cancel previous in-flight request to prevent race conditions
            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            const params = new URLSearchParams();
            if (role) params.set('role', role);
            if (userId) params.set('userId', userId);
            const res = await fetch(`/api/notifications?${params}`, { signal: controller.signal })
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (data?.ok && data?.data) {
                const rawNotifs: Notification[] = data.data;

                // 1. Cleanup: Filter out read notifications older than 24 hours
                const now = new Date().getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;

                const filteredNotifs = rawNotifs.filter(n => {
                    const isRead = readNotifications.has(n.id);
                    if (!isRead) return true;
                    const createdTime = new Date(n.created_at).getTime();
                    return (now - createdTime) < oneDayMs;
                });

                // 2. Deduplication/Grouping: Group similar notifications within 1 hour
                const grouped: Notification[] = [];
                const oneHourMs = 60 * 60 * 1000;

                filteredNotifs.forEach(n => {
                    const existing = grouped.find(g =>
                        g.title === n.title &&
                        g.type === n.type &&
                        (g.message || '').substring(0, 50) === (n.message || '').substring(0, 50) &&
                        Math.abs(new Date(g.created_at).getTime() - new Date(n.created_at).getTime()) < oneHourMs
                    );

                    if (existing) {
                        existing.count = (existing.count || 1) + 1;
                        if (!existing.ids) existing.ids = [existing.id];
                        existing.ids.push(n.id);

                        // Keep the latest timestamp
                        if (new Date(n.created_at) > new Date(existing.created_at)) {
                            existing.created_at = n.created_at;
                            existing.message = n.message || existing.message;
                            existing.id = n.id; // Use latest ID as primary
                        }
                    } else {
                        grouped.push({ ...n, count: 1, ids: [n.id] });
                    }
                });

                setNotifications(grouped);

                // Pulse bell hanya bila ada notif baru yg belum dibaca pada fetch berikutnya
                // (bukan pada load pertama, agar tidak mengganggu saat baru masuk).
                const currentIds = new Set(grouped.map(n => n.id));
                if (seenIdsRef.current) {
                    const hasNewUnread = grouped.some(n => !seenIdsRef.current!.has(n.id) && !readMapRef.current[n.id]);
                    if (hasNewUnread) {
                        setBellPulse(true);
                        setTimeout(() => setBellPulse(false), 1200);
                    }
                }
                seenIdsRef.current = currentIds;
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return; // Cancelled by newer request
            if (error.message !== 'Failed to fetch') {
                console.error('Failed to fetch notifications:', error);
            }
        }
    }

    useEffect(() => {
        const allRoles = (user.roles || []).join(',')
        const uid = String((user as any).auth_id || '')
        roleRef.current = allRoles
        uidRef.current = uid
        fetchNotifications(allRoles, uid)
        const interval = setInterval(() => fetchNotifications(roleRef.current, uidRef.current), 30000)
        return () => {
            clearInterval(interval)
            if (abortRef.current) abortRef.current.abort()
        }
    }, [user])

    useEffect(() => {
        const unread = notifications.filter(item => (item.ids || [item.id]).some(id => !readNotifications.has(id))).length
        setUnreadCount(unread)
    }, [notifications, readNotifications])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (
                (notificationRef.current && notificationRef.current.contains(target)) ||
                (target as HTMLElement).closest?.('.bnav__item') ||
                (target as HTMLElement).closest?.('.notification-dropdown')
            ) {
                return
            }
            setShowNotifications(false)
        }
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowNotifications(false)
        }
        if (showNotifications) {
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside)
                document.addEventListener('keydown', handleKey)
            }, 50)
            return () => {
                clearTimeout(timer)
                document.removeEventListener('mousedown', handleClickOutside)
                document.removeEventListener('keydown', handleKey)
            }
        }
    }, [showNotifications])

    // ── Jembatan ke BottomNav ────────────────────────────────────────────────
    // Tab "Notifikasi" di bar bawah membuka panel yang sama, dan lencananya
    // memakai hitungan yang sama. Lewat event, bukan mengangkat state ke layout:
    // `notifications` + `unreadCount` dipakai belasan tempat di komponen ini.
    useEffect(() => {
        const open = () => {
            setShowNotifications(true)
            if (roleRef.current || uidRef.current) {
                fetchNotifications(roleRef.current, uidRef.current)
            }
        }
        window.addEventListener(OPEN_NOTIFICATIONS_EVENT, open)
        return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, open)
    }, [])

    useEffect(() => {
        window.dispatchEvent(new CustomEvent(NOTIF_COUNT_EVENT, { detail: unreadCount }))
    }, [unreadCount])

    const markAsRead = (ids: string[]) => {
        const now = Date.now()
        const map = { ...readMapRef.current }
        ids.forEach(id => { map[id] = now })
        readMapRef.current = map
        saveReadMap(map)
        setReadNotifications(new Set(Object.keys(map)))
    }

    const markAllAsRead = () => {
        const now = Date.now()
        const map = { ...readMapRef.current }
        notifications.forEach(n => {
            (n.ids || [n.id]).forEach(id => { map[id] = now })
        })
        readMapRef.current = map
        saveReadMap(map)
        setReadNotifications(new Set(Object.keys(map)))
    }

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Baru saja'
        if (minutes < 60) return `${minutes} menit lalu`
        if (hours < 24) return `${hours} jam lalu`
        if (days < 7) return `${days} hari lalu`
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    }

    const handleNotificationClick = (notification: Notification) => {
        if (notification.ids) {
            markAsRead(notification.ids)
        } else {
            markAsRead([notification.id])
        }
        setShowNotifications(false)
    }

    const renderNotifList = () => {
        const visible = filter === 'unread'
            ? notifications.filter(n => (n.ids || [n.id]).some(id => !readNotifications.has(id)))
            : notifications
        const limitedVisible = visible
        if (limitedVisible.length === 0) {
            return (
                <div className="notification-empty">
                    {filter === 'unread' ? <CheckCheck size={28} /> : <BellOff size={28} />}
                    <p>{filter === 'unread' ? 'Semua sudah dibaca' : 'Tidak ada notifikasi'}</p>
                </div>
            )
        }
        const sections = DATE_SECTIONS
            .map(label => ({ label, items: limitedVisible.filter(n => dateSection(n.created_at) === label) }))
            .filter(s => s.items.length > 0)
        return sections.map(section => (
            <div key={section.label} className="notification-group">
                <div className="notification-section-label">{section.label}</div>
                {section.items.map((n) => {
                    const isRead = (n.ids || [n.id]).every(id => readNotifications.has(id))
                    const meta = getTypeMeta(n.type)
                    return (
                        <div
                            key={n.id}
                            className={`notification-item ${isRead ? 'notification-read' : 'notification-unread'}`}
                            onClick={() => handleNotificationClick(n)}
                        >
                            <div className="notification-icon-wrapper">
                                <div className={`notification-icon ${meta.colorClass}`}>
                                    <LucideIcon name={meta.icon} size={16} />
                                </div>
                                {n.count && n.count > 1 && (
                                    <span className="group-count">{n.count}</span>
                                )}
                            </div>
                            <div className="notification-content">
                                <div className="notification-title">
                                    {n.title}
                                    {n.count && n.count > 1 && <span className="mass-label">+{n.count}</span>}
                                </div>
                                {n.message && <div className="notification-note">{n.message}</div>}
                                <div className="notification-meta">
                                    <span className="notification-cat">{meta.category}</span>
                                    <span className="notification-time">
                                        <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        {formatTime(n.created_at)}
                                    </span>
                                    {!isRead && <span className="unread-dot"></span>}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        ))
    }

    const notifPanel = (closeBtnAutoFocus?: boolean) => (
        <div className="notification-dropdown" role="dialog" aria-label="Notifikasi" onClick={e => e.stopPropagation()}>
            <div className="notification-header">
                <div className="notification-title-wrap">
                    <h3>Notifikasi</h3>
                </div>
                <div className="header-actions">
                    {unreadCount > 0 && (
                        <button className="mark-all-btn" onClick={markAllAsRead}>
                            <CheckCheck size={15} />
                            Tandai Dibaca
                        </button>
                    )}
                    <button
                        type="button"
                        className="notification-close-btn"
                        onClick={() => setShowNotifications(false)}
                        aria-label="Tutup"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
            <div className="notification-filter" role="tablist">
                <button
                    role="tab"
                    aria-selected={filter === 'all'}
                    className={`notif-filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    Semua
                </button>
                <button
                    role="tab"
                    aria-selected={filter === 'unread'}
                    className={`notif-filter-btn ${filter === 'unread' ? 'active' : ''}`}
                    onClick={() => setFilter('unread')}
                >
                    Belum dibaca
                    {unreadCount > 0 && <span className="notif-filter-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
            </div>
            <div className="notification-list">
                {renderNotifList()}
            </div>
        </div>
    )

    return (
        <div className={`notification-wrapper ${className || ''}`} ref={notificationRef}>
            <button
                className={`header-icon-btn ${bellPulse ? 'bell-pulse' : ''}`}
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifikasi"
                aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
                aria-haspopup="dialog"
                aria-expanded={showNotifications}
            >
                <Bell size={iconSize} />
            </button>
            {unreadCount > 0 && (
                <span className="notification-badge" role="status" aria-live="polite">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}

            {showNotifications && (
                typeof document !== 'undefined' && (isMobile || window.innerWidth < 992) ? (
                    createPortal(
                        <div className="notification-sheet-backdrop" onClick={() => setShowNotifications(false)}>
                            {notifPanel()}
                        </div>,
                        document.body
                    )
                ) : (
                    <>
                        <div className="notification-overlay" onClick={() => setShowNotifications(false)} />
                        {notifPanel()}
                    </>
                )
            )}
        </div>
    )
}
