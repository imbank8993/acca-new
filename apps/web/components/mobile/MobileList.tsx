'use client'

/**
 * MobileList — daftar bergaya "list item", pengganti kartu key-value di mobile.
 *
 * Aturan isinya sengaja ketat, karena longgarnya aturan inilah yang dulu membuat
 * baris tabel desktop diterjemahkan apa adanya jadi kartu setinggi ~224px:
 *
 *   title     satu baris, rata kiri, ellipsis — hal yang dicari saat men-scan
 *   subtitle  satu baris metadata pembeda (mis. "NISN · asal sekolah")
 *   badge     HANYA saat nilainya menyimpang (mis. "Non-aktif"); status normal
 *             tidak diberi badge karena mengulang di tiap baris = derau
 *
 * Sisa field masuk ke MobileSheet saat baris diketuk, bukan ke barisnya.
 */

import React, { ReactNode, useCallback, useRef, useState } from 'react'
import { registerPageFab, unregisterPageFab } from './page-fab'
import './mobile-ui.css'

/* ------------------------------- Helper ---------------------------------- */

/** Dua huruf pertama dari dua kata pertama, mis. "Ahmad Fauzi R" → "AF". */
export function initials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Indeks rona 0–5, stabil untuk kunci yang sama (djb2 sederhana). */
export function tintOf(key: string): number {
    let h = 5381
    for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0
    return Math.abs(h) % 6
}

/* -------------------------------- List ----------------------------------- */

/**
 * `role="group"`, bukan `role="list"`: tiap baris adalah <button>, dan
 * `role="listitem"` di atasnya akan MENIMPA peran tombolnya — pembaca layar
 * kehilangan info bahwa baris itu bisa ditekan.
 */
export function MobileList({ children, label }: { children: ReactNode; label?: string }) {
    return <div className="mui-list" role="group" aria-label={label}>{children}</div>
}

/**
 * Foto bila `src` diisi, selain itu ikon bila `icon` diisi, selain itu inisial.
 *
 * Ikon dipakai saat judul barisnya bukan nama orang: inisial dari "2026/2027 ·
 * Ganjil" akan keluar sebagai "2·" — dua karakter yang tidak berarti apa-apa.
 * Ronanya tetap dari `seed`, jadi baris sejenis (mis. dua semester dari tahun
 * yang sama) tetap berwarna sama.
 */
export function MobileAvatar({ name, seed, icon, src }: { name: string; seed?: string; icon?: string; src?: string | null }) {
    // URL foto bisa basi (berkasnya sudah dihapus di storage) — tanpa penjaga
    // ini barisnya menampilkan ikon gambar rusak bawaan browser, yang jauh
    // lebih buruk daripada avatar cadangan.
    const [gagalMuat, setGagalMuat] = useState(false)
    const pakaiFoto = Boolean(src) && !gagalMuat

    return (
        <span className={`mui-avatar mui-avatar--t${tintOf(seed || name)}`} aria-hidden="true">
            {pakaiFoto
                ? <img className="mui-avatar__img" src={src!} alt="" loading="lazy" onError={() => setGagalMuat(true)} />
                : icon ? <i className={`bi bi-${icon}`} /> : initials(name)}
        </span>
    )
}

const LONG_PRESS_MS = 500

export function MobileListItem({
    title,
    subtitle,
    badge,
    seed,
    icon,
    avatarSrc,
    onClick,
    onLongPress,
    selectionMode = false,
    selected = false,
    noAvatar = false,
}: {
    title: string
    subtitle?: ReactNode
    /** Tampilkan hanya bila baris ini menyimpang dari yang diharapkan. */
    badge?: ReactNode
    /** Kunci stabil untuk rona avatar; default memakai `title`. */
    seed?: string
    /** Ikon avatar (nama bootstrap tanpa prefix) bila judulnya bukan nama orang. */
    icon?: string
    /** Foto avatar. Bila kosong atau gagal dimuat, jatuh ke `icon`/inisial. */
    avatarSrc?: string | null
    onClick: () => void
    /** Tekan-lama (500 ms) — biasanya untuk masuk mode seleksi. */
    onLongPress?: () => void
    selectionMode?: boolean
    selected?: boolean
    /**
     * Hilangkan avatar sama sekali. Untuk daftar yang barisnya BUKAN entitas
     * berwajah (mis. sesi absensi): inisial/ikon yang sama berulang di tiap
     * baris cuma memakan 52px lebar tanpa membedakan apa pun. Checkbox mode
     * seleksi tetap tampil.
     */
    noAvatar?: boolean
}) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Tekan-lama yang berhasil TIDAK boleh ikut memicu onClick: di browser,
    // pointerup tetap menghasilkan click walau jarinya menahan lama.
    const firedRef = useRef(false)

    const clear = useCallback(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }, [])

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!onLongPress || e.pointerType === 'mouse') return
        firedRef.current = false
        clear()
        timerRef.current = setTimeout(() => {
            firedRef.current = true
            onLongPress()
        }, LONG_PRESS_MS)
    }, [onLongPress, clear])

    const handleClick = useCallback(() => {
        if (firedRef.current) { firedRef.current = false; return }
        onClick()
    }, [onClick])

    return (
        <button
            type="button"
            className={`mui-item ${selected ? 'isSelected' : ''} ${noAvatar && !selectionMode ? 'mui-item--noAvatar' : ''}`.replace(/\s+/g, ' ').trim()}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={clear}
            onPointerMove={clear}
            onPointerCancel={clear}
            onPointerLeave={clear}
            onContextMenu={e => { if (onLongPress) e.preventDefault() }}
            aria-pressed={selectionMode ? selected : undefined}
        >
            {selectionMode ? (
                <input
                    type="checkbox"
                    className="ui-checkbox mui-check"
                    checked={selected}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                />
            ) : noAvatar ? null : (
                <MobileAvatar name={title} seed={seed} icon={icon} src={avatarSrc} />
            )}

            <span className="mui-item__text">
                <span className="mui-item__title">{title}</span>
                {subtitle && <span className="mui-item__sub">{subtitle}</span>}
            </span>

            {/* Tanpa chevron: seluruh baris sudah <button>, dan panah yang sama
                berulang di tiap baris tidak menambah informasi apa pun. */}
            <span className="mui-item__trail">{badge}</span>
        </button>
    )
}

/* ------------------------------ Pelengkap -------------------------------- */

export function MobileEmpty({ title, subtitle, icon = 'inbox' }: { title: string; subtitle?: string; icon?: string }) {
    return (
        <div className="mui-empty">
            <i className={`bi bi-${icon}`} aria-hidden="true" />
            <div className="mui-empty__title">{title}</div>
            {subtitle && <div className="mui-empty__sub">{subtitle}</div>}
        </div>
    )
}

export function MobileLoadMore({ remaining, onClick, step }: { remaining: number; onClick: () => void; step: number }) {
    if (remaining <= 0) return null
    return (
        <button type="button" className="mui-more" onClick={onClick}>
            Muat {Math.min(step, remaining)} lagi · sisa {remaining}
        </button>
    )
}

/**
 * MobileFab — aksi utama halaman untuk mobile.
 *
 * TIDAK menggambar apa pun. Ia hanya MENDAFTARKAN aksinya ke BottomNav, yang
 * menampilkannya sebagai tombol bundar menonjol di tengah bilah nav.
 *
 * Sebelumnya ini tombol bundar `position: fixed` yang mengambang bebas di atas
 * daftar dan bisa digeser. Dua masalahnya hilang sekaligus dengan pindah ke
 * bilah nav: ia tidak lagi menutupi baris terakhir daftar (dulu ditambal dengan
 * mencadangkan ruang di ujung konten), dan tidak lagi ikut terangkat saat
 * dokumen memantul di ujung guliran.
 *
 * `label` tetap wajib: tombolnya ikon saja, jadi label itu yang jadi aria-label.
 *
 * Dirender sebagai komponen (bukan dipanggil sebagai hook) supaya 13 halaman
 * pemakainya tidak perlu diubah — pemasangan/pelepasannya mengikuti daur hidup
 * render yang sudah ada, termasuk saat tab berpindah.
 */
export function MobileFab({ label, mobileLabel, icon = 'plus-lg', onClick }: { label: string; mobileLabel?: string; icon?: string; onClick: () => void }) {
    // onClick disimpan di ref supaya perubahan identitas fungsinya tiap render
    // tidak memicu daftar-ulang ke BottomNav — cukup satu kali pasang.
    const onClickRef = useRef(onClick)
    onClickRef.current = onClick

    // Token identitas komponen ini, dipakai saat melepas pendaftaran supaya
    // pembersihan halaman lama tidak menghapus pendaftaran halaman baru.
    const tokenRef = useRef({})

    const effectiveLabel = mobileLabel || label

    React.useEffect(() => {
        const token = tokenRef.current
        registerPageFab(token, { label: effectiveLabel, icon, run: () => onClickRef.current() })
        return () => unregisterPageFab(token)
    }, [effectiveLabel, icon])

    return null
}

export function MobileSelectionBar({
    count,
    onCancel,
    children,
}: {
    count: number
    onCancel: () => void
    /** Tombol aksi massal — pakai `.mui-selbar__btn`. */
    children: ReactNode
}) {
    return (
        <div className="mui-selbar">
            <button type="button" className="mui-iconbtn" onClick={onCancel} aria-label="Batalkan seleksi">
                <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
            <span className="mui-selbar__count">{count} dipilih</span>
            {children}
        </div>
    )
}
