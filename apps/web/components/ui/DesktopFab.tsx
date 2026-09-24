'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { registerPageFab, unregisterPageFab, FAB_PRIORITY } from '@/components/mobile/page-fab';
import './desktop-fab.css';

/** Posisi FAB dipakai bersama semua halaman, jadi user cukup menggeser sekali. */
const STORAGE_KEY = 'acca:desktop-fab-pos';
/** Jarak minimum dari tepi layar saat posisi dijepit ulang. */
const EDGE_MARGIN = 12;
/** Geseran sependek ini masih dianggap klik, bukan drag. */
const DRAG_THRESHOLD = 4;

type Pos = { x: number; y: number };

function readStoredPos(): Pos | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            return { x: parsed.x, y: parsed.y };
        }
    } catch {
        /* localStorage bisa diblokir / isinya rusak — jatuh ke posisi bawaan. */
    }
    return null;
}

/**
 * Tombol aksi melayang untuk desktop, meniru perilaku FAB di halaman Jadwal:
 * lingkaran kecil yang melebar dan memunculkan label sesaat sebelum aksinya
 * jalan, supaya user sempat membaca aksi apa yang barusan ia picu.
 *
 * Tombolnya bisa diseret ke mana saja; posisinya disimpan di localStorage dan
 * berlaku untuk semua halaman, karena yang sering mengganggu bukan satu halaman
 * tertentu melainkan sudut layar tempat FAB itu duduk.
 *
 * Di mobile komponen ini tidak dirender (CSS), karena aksi utama halaman sudah
 * dipegang <MobileFab> di slot tengah BottomNav.
 */
export function DesktopFab({
    label,
    icon,
    onClick,
    title,
    mobileLabel,
    mobileIcon,
}: {
    label: string;
    /**
     * Nama ikon Bootstrap tanpa awalan `bi-` (mis. "gear-fill"), atau elemen
     * ikon siap pakai untuk halaman yang sudah memakai set ikon lain
     * (mis. `<CalendarCheck size={20} />` dari lucide-react).
     */
    icon: string | ReactNode;
    onClick: () => void;
    title?: string;
    /**
     * Label untuk tombol tengah BottomNav; ruangnya sempit, jadi isi ini kalau
     * `label` terlalu panjang ("Tambah" untuk "Tambah Tahun Ajaran").
     */
    mobileLabel?: string;
    /**
     * Nama ikon Bootstrap untuk BottomNav. Wajib diisi hanya kalau `icon`
     * berupa elemen, karena elemen ikon tidak bisa dipakai di sana.
     */
    mobileIcon?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState<Pos | null>(null);
    const [dragging, setDragging] = useState(false);
    // Sisi tempat tombol "dipaku" saat melebar. Anchor kiri (default) membuatnya
    // melebar ke kanan; anchor kanan menyimpan jarak ke tepi kanan viewport
    // sehingga tombol justru memanjang ke kiri.
    const [anchor, setAnchor] = useState<{ side: 'left' } | { side: 'right'; offset: number }>({ side: 'left' });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    // Disimpan di ref supaya identitas fungsi yang berubah tiap render tidak
    // memicu daftar-ulang ke BottomNav.
    const onClickRef = useRef(onClick);
    onClickRef.current = onClick;
    const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
    // Pointerup setelah drag tetap diikuti event click; tandai supaya aksinya
    // tidak ikut jalan cuma karena user memindahkan tombol.
    const suppressClick = useRef(false);

    // Dirender via portal ke <body> supaya `position: fixed`-nya tidak terjebak
    // stacking context milik kartu/tabel halaman — itu yang bikin FAB tertutup
    // baris tabel saat disorot.
    useEffect(() => setMounted(true), []);

    // Aksi bisa melepas komponen ini (mis. pindah ke halaman Kelola), jadi timer
    // yang belum jalan harus dibatalkan agar tidak setState di komponen mati.
    useEffect(() => () => {
        timers.current.forEach(clearTimeout);
    }, []);

    // Daftarkan aksi ini sebagai tombol tengah BottomNav, supaya halaman yang
    // cuma memasang FAB desktop tetap punya aksi utama di mobile. Prioritasnya
    // di bawah <MobileFab>, jadi halaman yang menulisnya sendiri tetap menang.
    const fabToken = useRef({});
    const inferredIcon = typeof icon === 'string'
        ? icon
        : ((icon as any)?.type?.displayName || (icon as any)?.type?.name || 'plus-lg');
    const navIcon = mobileIcon || inferredIcon;
    const navLabel = mobileLabel || label;
    useEffect(() => {
        const token = fabToken.current;
        registerPageFab(token, { label: navLabel, icon: navIcon, run: () => onClickRef.current() }, FAB_PRIORITY.auto);
        return () => unregisterPageFab(token);
    }, [navLabel, navIcon]);

    /** Jepit posisi supaya tombol selalu utuh di dalam viewport. */
    const clamp = (p: Pos): Pos => {
        const el = wrapperRef.current;
        const w = el?.offsetWidth || 52;
        const h = el?.offsetHeight || 52;
        const maxX = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
        const maxY = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
        return {
            x: Math.min(Math.max(p.x, EDGE_MARGIN), maxX),
            y: Math.min(Math.max(p.y, EDGE_MARGIN), maxY),
        };
    };

    // Selama user belum pernah menggeser, `pos` sengaja dibiarkan null supaya
    // posisi datang dari CSS (sudut kanan bawah) — tidak perlu mengukur tombol,
    // yang ukurannya nol selama viewport masih mobile atau tab belum tampil.
    useLayoutEffect(() => {
        if (!mounted) return;
        const stored = readStoredPos();
        if (stored) setPos(clamp(stored));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    // Layar mengecil / device rotate: tarik tombol kembali ke dalam viewport.
    useEffect(() => {
        if (!mounted) return;
        const onResize = () => setPos((prev) => (prev ? clamp(prev) : prev));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        // Belum pernah digeser: titik awal diambil dari posisi bawaan CSS.
        const rect = wrapperRef.current?.getBoundingClientRect();
        const origin = pos ?? { x: rect?.left ?? 0, y: rect?.top ?? 0 };
        drag.current = { startX: e.clientX, startY: e.clientY, originX: origin.x, originY: origin.y, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!d.moved) {
            d.moved = true;
            setDragging(true);
            // Selama diseret posisi harus mengikuti `pos.x`, bukan jarak ke tepi
            // kanan yang dipakai anchor kanan.
            setAnchor({ side: 'left' });
        }
        setPos(clamp({ x: d.originX + dx, y: d.originY + dy }));
    };

    const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        if (!d.moved) return;
        suppressClick.current = true;
        setDragging(false);
        setPos((prev) => {
            if (prev) {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
                } catch {
                    /* Simpan gagal: posisi tetap berlaku sampai halaman dimuat ulang. */
                }
            }
            return prev;
        });
    };

    /**
     * Tentukan ke arah mana tombol boleh melebar. Label bisa jauh lebih lebar
     * dari lingkarannya, jadi tanpa ini tombol yang duduk dekat tepi kanan akan
     * memanjang keluar layar.
     */
    const resolveAnchor = (): { side: 'left' } | { side: 'right'; offset: number } => {
        const el = wrapperRef.current;
        if (!el) return { side: 'left' };
        const rect = el.getBoundingClientRect();
        const text = el.querySelector('.dfab-text') as HTMLElement | null;
        // Label disembunyikan lewat `max-width: 0`, jadi lebar aslinya dibaca
        // dari scrollWidth — dipotong 200px mengikuti batas di desktop-fab.css.
        // +58 = padding kiri-kanan saat melebar + jarak ikon ke label.
        const grow = Math.min(text?.scrollWidth || 0, 200) + 58;
        const vw = document.documentElement.clientWidth;
        const roomRight = vw - rect.right - EDGE_MARGIN;
        const roomLeft = rect.left - EDGE_MARGIN;
        const growLeft = grow <= roomRight ? false : grow <= roomLeft ? true : roomLeft > roomRight;
        return growLeft ? { side: 'right', offset: Math.max(EDGE_MARGIN, vw - rect.right) } : { side: 'left' };
    };

    const handleClick = () => {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
        // Anchor diganti bersamaan dengan expand: geometri tombol saat menguncup
        // identik di kedua anchor, jadi tidak ada lompatan posisi.
        setAnchor(resolveAnchor());
        setExpanded(true);
        timers.current.push(setTimeout(() => {
            onClick();
            timers.current.push(setTimeout(() => setExpanded(false), 500));
        }, 400));
    };

    if (!mounted) return null;

    return createPortal(
        <div
            ref={wrapperRef}
            className="dfab-wrapper"
            style={pos
                ? anchor.side === 'right'
                    ? { right: anchor.offset, top: pos.y, left: 'auto', bottom: 'auto' }
                    : { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
                : undefined}
        >
            <button
                type="button"
                className={`dfab ${expanded ? 'is-expanded' : ''} ${dragging ? 'is-dragging' : ''}`}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                aria-label={label}
                title={title || `${label} — seret untuk memindahkan tombol`}
            >
                <span className="dfab-icon">
                    {typeof icon === 'string' ? <i className={`bi bi-${icon}`} /> : icon}
                </span>
                <span className="dfab-text">{label}</span>
            </button>
        </div>,
        document.body
    );
}

export default DesktopFab;
