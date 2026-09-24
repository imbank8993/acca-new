'use client';

import React from 'react';
import Link from 'next/link';

export default function NilaiTab({ siswa }: { siswa: any }) {
    return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            <i className="bi bi-journal-text" style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '16px', display: 'block' }}></i>
            <p style={{ fontWeight: 600, color: '#334155' }}>Modul Nilai Akademik</p>
            <p style={{ fontSize: '0.9rem' }}>Rekap nilai {siswa.nama_lengkap} tersedia di halaman Nilai Siswa.</p>
            <Link href="/nilai-siswa" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 18px', background: 'var(--n-primary)', color: '#fff', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
                <i className="bi bi-box-arrow-up-right"></i> Buka Nilai Siswa
            </Link>
        </div>
    );
}
