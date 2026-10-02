'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface AnakChip {
    nisn: string;
    nama_lengkap: string;
    kelas?: string;
}

/**
 * Switcher anak untuk dashboard orang tua — dropdown dengan nama lengkap anak.
 * Aturan tampil:
 *  - 0 anak  → tidak render apa pun
 *  - 1 anak  → tanpa dropdown; hanya `actions` rata kanan (bila ada)
 *  - ≥2 anak → dropdown pemilih anak + `actions` di kanan
 */
export default function AnakSwitcher({
    anakList,
    selectedNisn,
    onSelect,
    actions,
}: {
    anakList: AnakChip[];
    selectedNisn: string;
    onSelect: (nisn: string) => void;
    actions?: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    if (anakList.length === 0) return null;
    const single = anakList.length === 1;
    if (single && !actions) return null;

    const selected = (selectedNisn ? anakList.find(a => a.nisn === selectedNisn) : null) || anakList[0];
    const initialOf = (nama: string) => (nama || '?').trim().charAt(0).toUpperCase();

    return (
        <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: single ? 'flex-end' : 'space-between',
            flexWrap: 'wrap', gap: '10px', marginBottom: '14px'
        }}>
            {!single && (
                <div ref={wrapRef} style={{ position: 'relative', minWidth: 0 }}>
                    {/* Tombol dropdown: avatar + nama lengkap + kelas */}
                    <button
                        onClick={() => setOpen(o => !o)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '10px', maxWidth: '100%',
                            padding: '6px 14px 6px 6px', borderRadius: '999px', cursor: 'pointer',
                            border: '1.5px solid #c7d2fe', background: '#fff',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.10)', transition: 'all 0.15s ease'
                        }}
                    >
                        <span style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.9rem', background: '#4f46e5', color: '#fff'
                        }}>
                            {selected ? initialOf(selected.nama_lengkap) : '?'}
                        </span>
                        <span style={{ textAlign: 'left', lineHeight: 1.2, minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {selected?.nama_lengkap || selected?.nisn || '-'}
                            </span>
                            {selected?.kelas && (
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, color: '#64748b' }}>
                                    {selected.kelas}
                                </span>
                            )}
                        </span>
                        <i className="bi bi-chevron-down" style={{
                            fontSize: '0.8rem', color: '#4f46e5', flexShrink: 0, marginLeft: '2px',
                            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease'
                        }}></i>
                    </button>

                    {/* Menu daftar anak */}
                    {open && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                            minWidth: '280px', maxWidth: 'min(92vw, 380px)',
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px',
                            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.15)', padding: '6px', overflow: 'hidden'
                        }}>
                            {anakList.map(anak => {
                                const active = anak.nisn === selectedNisn;
                                return (
                                    <button
                                        key={anak.nisn}
                                        onClick={() => { onSelect(anak.nisn); setOpen(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                            padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                                            border: 'none', background: active ? '#eef2ff' : 'transparent',
                                            textAlign: 'left', transition: 'background 0.12s ease'
                                        }}
                                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span style={{
                                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 700, fontSize: '0.9rem',
                                            background: active ? '#4f46e5' : '#e0e7ff',
                                            color: active ? '#fff' : '#4f46e5'
                                        }}>
                                            {initialOf(anak.nama_lengkap)}
                                        </span>
                                        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                                            <span style={{ display: 'block', fontWeight: active ? 700 : 600, fontSize: '0.86rem', color: active ? '#312e81' : '#334155' }}>
                                                {anak.nama_lengkap}
                                            </span>
                                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                                                {anak.kelas ? `${anak.kelas} · ` : ''}NISN {anak.nisn}
                                            </span>
                                        </span>
                                        {active && <i className="bi bi-check-lg" style={{ color: '#4f46e5', flexShrink: 0 }}></i>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            {actions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    {actions}
                </div>
            )}
        </div>
    );
}
