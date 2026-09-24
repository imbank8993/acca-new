'use client'

/**
 * MobileSheet — panel yang naik dari bawah layar.
 *
 * Pengganti `Modal` untuk mobile. Bedanya bukan sekadar posisi: sheet menempel
 * di tepi bawah (jangkauan ibu jari), tingginya dibatasi 92dvh sehingga isi
 * panjang men-scroll di dalam BODY-nya sendiri, dan footer aksinya sticky —
 * tombol simpan tidak ikut hanyut seperti pada dialog terpusat.
 *
 * Contoh:
 *   <MobileSheet title="Ahmad Fauzi" subtitle="0071234567" onClose={close}
 *     footer={<button className="mui-btn mui-btn--primary">Edit</button>}>
 *     …isi…
 *   </MobileSheet>
 */

import React, { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'
import LucideIcon from '../ui/LucideIcon'
import './mobile-ui.css'

export function MobileSheet({
    title,
    subtitle,
    leading,
    onClose,
    children,
    footer,
    full = false,
    labelledBy = 'mui-sheet-title',
}: {
    title: ReactNode
    subtitle?: ReactNode
    /** Slot di kiri judul — biasanya avatar/ikon. */
    leading?: ReactNode
    onClose: () => void
    children: ReactNode
    /** Baris tombol sticky di dasar sheet. */
    footer?: ReactNode
    /** Setinggi layar penuh — untuk form panjang, bukan detail singkat. */
    full?: boolean
    labelledBy?: string
}) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKeyDown)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = prevOverflow
        }
    }, [onClose])

    if (typeof document === 'undefined') return null

    return createPortal(
        <div
            className="mui-sheetOverlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            // mousedown, bukan click: menyeret teks dari dalam sheet lalu melepas
            // di luar tidak boleh ikut menutup (sama seperti components/Modal.tsx).
            onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className={`mui-sheet ${full ? 'mui-sheet--full' : ''}`.trim()}>
                <div className="mui-sheet__grab" aria-hidden="true" />

                <div className="mui-sheet__head">
                    {leading}
                    <div className="mui-sheet__headText">
                        <h2 className="mui-sheet__title" id={labelledBy}>{title}</h2>
                        {subtitle && <div className="mui-sheet__sub">{subtitle}</div>}
                    </div>
                    <button type="button" className="mui-iconbtn" onClick={onClose} aria-label="Tutup">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="mui-sheet__body">{children}</div>

                {footer && <div className="mui-sheet__foot">{footer}</div>}
            </div>
        </div>,
        document.body
    )
}

/** Satu baris label-di-atas-nilai untuk isi sheet detail. */
export function MobileKV({
    label,
    children,
    mono = false,
}: {
    label: string
    children: ReactNode
    mono?: boolean
}) {
    return (
        <div className="mui-kv">
            <div className="mui-kv__k">{label}</div>
            <div className={`mui-kv__v ${mono ? 'isMono' : ''}`.trim()}>{children}</div>
        </div>
    )
}

/** Judul kelompok di dalam sheet detail. */
export function MobileSection({ children }: { children: ReactNode }) {
    return <div className="mui-sheet__section">{children}</div>
}

/**
 * Baris pilihan tunggal (radio) untuk sheet filter / pemilih tab.
 *
 * Centangnya di KANAN, bukan kiri: dengan ikon opsional di kiri, dua penanda
 * berdampingan di sisi yang sama membuat label terdorong jauh ke tengah.
 */
export function MobileOption({
    selected,
    onClick,
    children,
    icon,
    hint,
}: {
    selected: boolean
    onClick: () => void
    children: ReactNode
    /** Nama ikon bootstrap tanpa prefix, mis. "people-fill". */
    icon?: string
    /** Baris kedua — ringkasan isi pilihan ini, mis. "912 aktif · 34 non-aktif". */
    hint?: ReactNode
}) {
    return (
        <button
            type="button"
            className={`mui-opt ${selected ? 'isSelected' : ''}`.trim()}
            onClick={onClick}
            role="radio"
            aria-checked={selected}
        >
            {icon && (
                <span className="mui-opt__icon" aria-hidden="true">
                    <LucideIcon name={icon} size={18} />
                </span>
            )}
            <span className="mui-opt__text">
                <span className="mui-opt__label">{children}</span>
                {hint && <span className="mui-opt__hint">{hint}</span>}
            </span>
            <span className="mui-opt__mark" aria-hidden="true">
                {selected && <Check size={18} />}
            </span>
        </button>
    )
}

export default MobileSheet
