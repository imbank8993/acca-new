'use client';

import React from 'react';
import Link from 'next/link';

export default function KehadiranTab({ siswa }: { siswa: any }) {
    return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            <i className="bi bi-calendar-check" style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '16px', display: 'block' }}></i>
            <p style={{ fontWeight: 600, color: '#334155' }}>Modul Kehadiran</p>
            <p style={{ fontSize: '0.9rem' }}>Riwayat izin dan sakit {siswa.nama_lengkap} tersedia di halaman Kehadiran Siswa.</p>
            <Link href="/ketidakhadiran?tab=presensi" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 18px', background: 'var(--n-primary)', color: '#fff', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
                <i className="bi bi-box-arrow-up-right"></i> Buka Kehadiran Siswa
            </Link>
        </div>
    );
}
