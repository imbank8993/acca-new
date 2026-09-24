'use client'

/**
 * MobileToolbar — baris kontrol "search-first" untuk mobile.
 *
 * Hanya pencarian yang selalu terlihat; sisanya (filter, import/export, aksi
 * massal) dilipat ke menu overflow atau sheet filter. Toolbar desktop yang
 * diturunkan utuh menghabiskan ~252px sebelum baris data pertama — di sini
 * anggarannya 56px.
 *
 * Filter yang sedang aktif ditampilkan sebagai chip di bawah bar, supaya
 * pengguna tahu daftar yang dilihatnya sudah disaring — informasi yang hilang
 * begitu toolbar desktop ter-scroll ke atas.
 */

import React, { ReactNode, useEffect, useRef, useState } from 'react'
import './mobile-ui.css'

export function MobileToolbar({
    value,
    onChange,
    placeholder = 'Cari…',
    ariaLabel = 'Cari',
    children,
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    ariaLabel?: string
    /** Slot kanan — biasanya <MobileMenu>. */
    children?: ReactNode
}) {
    return (
        <div className="mui-bar">
            <div className="mui-search">
                <i className="bi bi-search" aria-hidden="true" />
                <input
                    type="text"
                    className="mui-input"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={ariaLabel}
                />
                {value && (
                    <button
                        type="button"
                        className="mui-iconbtn"
                        style={{ width: 32, height: 32, fontSize: '0.9rem' }}
                        onClick={() => onChange('')}
                        aria-label="Bersihkan pencarian"
                    >
                        <i className="bi bi-x-circle-fill" aria-hidden="true" />
                    </button>
                )}
            </div>
            {children}
        </div>
    )
}

export interface MobileMenuItem {
    label: string
    /** Nama ikon bootstrap tanpa prefix, mis. "qr-code". */
    icon: string
    onClick: () => void
    danger?: boolean
    /** Garis pemisah DI ATAS item ini. */
    separated?: boolean
}

export function MobileMenu({ items, ariaLabel = 'Menu lainnya' }: { items: MobileMenuItem[]; ariaLabel?: string }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('touchstart', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('touchstart', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    if (items.length === 0) return null

    return (
        <div className="mui-menuWrap" ref={ref}>
            <button
                type="button"
                className={`mui-iconbtn ${open ? 'isOpen' : ''}`.trim()}
                onClick={() => setOpen(v => !v)}
                aria-label={ariaLabel}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <i className="bi bi-three-dots-vertical" aria-hidden="true" />
            </button>

            {open && (
                <div className="mui-menu" role="menu">
                    {items.map((item, i) => (
                        <React.Fragment key={item.label}>
                            {item.separated && i > 0 && <div className="mui-menuSep" />}
                            <button
                                type="button"
                                role="menuitem"
                                className={`mui-menuItem ${item.danger ? 'isDanger' : ''}`.trim()}
                                onClick={() => { setOpen(false); item.onClick() }}
                            >
                                <i className={`bi bi-${item.icon}`} aria-hidden="true" />
                                <span>{item.label}</span>
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    )
}

export function MobileChips({ children }: { children: ReactNode }) {
    return <div className="mui-chips">{children}</div>
}

export function MobileChip({
    icon,
    children,
    onClick,
}: {
    /** Nama ikon bootstrap tanpa prefix. Default: panah bawah (membuka sheet). */
    icon?: string
    children: ReactNode
    onClick: () => void
}) {
    return (
        <button type="button" className="mui-chip" onClick={onClick}>
            <span>{children}</span>
            <i className={`bi bi-${icon || 'chevron-down'}`} aria-hidden="true" />
        </button>
    )
}
