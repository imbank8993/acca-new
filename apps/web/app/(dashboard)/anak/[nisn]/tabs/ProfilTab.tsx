'use client';

import React from 'react';

export default function ProfilTab({ siswa }: { siswa: any }) {
    return (
        <div>
            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Detail Siswa</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 4px' }}>Nama Lengkap</p>
                    <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>{siswa.nama_lengkap}</p>
                </div>
                <div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 4px' }}>Jenis Kelamin</p>
                    <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>{siswa.gender || '-'}</p>
                </div>
                <div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 4px' }}>Tempat, Tanggal Lahir</p>
                    <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>
                        {siswa.tempat_lahir || '-'}, {siswa.tanggal_lahir ? new Date(siswa.tanggal_lahir).toLocaleDateString('id-ID') : '-'}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 4px' }}>Asal Sekolah</p>
                    <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>{siswa.asal_sekolah || '-'}</p>
                </div>
            </div>
        </div>
    );
}
