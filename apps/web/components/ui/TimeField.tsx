'use client';

import { useRef } from 'react';
import './time-field.css';

/**
 * Kolom jam dengan ikon di kiri, sebentuk dengan <DatePicker>.
 *
 * Ikon jam bawaan browser disembunyikan lewat CSS; penggantinya tombol asli
 * yang memanggil `showPicker()` — bukan sekadar gambar — supaya pemilih jam
 * tetap terbuka sekali klik tanpa bergantung pada trik menumpuk
 * `::-webkit-calendar-picker-indicator` yang hanya jalan di Chrome.
 */
export function TimeField({
    value,
    onChange,
    label,
    disabled = false,
    className = '',
}: {
    value: string;
    onChange: (value: string) => void;
    /** Dipakai sebagai aria-label kontrol dan judul tombol ikonnya. */
    label: string;
    disabled?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);

    const openPicker = () => {
        const el = ref.current;
        if (!el || disabled) return;
        el.focus();
        // showPicker() belum ada di sebagian browser (mis. Safari lama); di sana
        // fokus di atas sudah cukup untuk mulai mengetik.
        try { el.showPicker?.(); } catch { /* dipanggil tanpa gestur pengguna */ }
    };

    return (
        <div className={`tfd ${className}`.trim()}>
            <button
                type="button"
                className="tfd__icon"
                onClick={openPicker}
                disabled={disabled}
                aria-label={`Pilih ${label}`}
                title={`Pilih ${label}`}
                /* Tab tidak perlu berhenti dua kali di kolom yang sama; kontrol
                   jamnya sendiri sudah bisa difokus dan diketik. */
                tabIndex={-1}
            >
                {/* SVG bergaris dengan tebal & ukuran yang sama dengan .dpk-icon,
                    supaya jam dan kalender terlihat satu keluarga ikon. */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M12 7.5V12L15 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <input
                ref={ref}
                type="time"
                className="tfd__input"
                aria-label={label}
                value={value}
                disabled={disabled}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
}

export default TimeField;
