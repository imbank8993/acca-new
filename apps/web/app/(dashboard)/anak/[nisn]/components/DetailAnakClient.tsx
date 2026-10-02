'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfilTab from '../tabs/ProfilTab';
import KehadiranTab from '../tabs/KehadiranTab';
import NilaiTab from '../tabs/NilaiTab';

export default function DetailAnakClient({ siswa }: { siswa: any }) {
    const [activeTab, setActiveTab] = useState<'profil' | 'kehadiran' | 'nilai'>('profil');
    const router = useRouter();

    return (
        <div className="page-wrapper" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
                <button 
                    onClick={() => router.push('/dashboard')}
                    style={{ background: 'none', border: 'none', color: 'var(--n-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <i className="bi bi-arrow-left"></i> Kembali ke Dasbor
                </button>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {/* Header Profil Singkat */}
                <div style={{ padding: '32px 36px', background: 'var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%))', color: '#fff', display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', background: '#fff', color: 'var(--n-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold'
                    }}>
                        {siswa.foto ? (
                            <img src={siswa.foto} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                            (siswa.nama_lengkap || '?').charAt(0)
                        )}
                    </div>
                    <div>
                        <h2 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700 }}>{siswa.nama_lengkap || 'Data Siswa'}</h2>
                        <p style={{ margin: 0, opacity: 0.9 }}>NISN: {siswa.nisn} &bull; Kelas: {siswa.kelas || '-'}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    {(['profil', 'kehadiran', 'nilai'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '16px', background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: activeTab === tab ? '3px solid var(--n-primary)' : '3px solid transparent',
                                color: activeTab === tab ? 'var(--n-primary)' : '#64748b',
                                fontWeight: activeTab === tab ? 700 : 500,
                                textTransform: 'capitalize',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div style={{ padding: '24px' }}>
                    {activeTab === 'profil' && <ProfilTab siswa={siswa} />}
                    {activeTab === 'kehadiran' && <KehadiranTab siswa={siswa} />}
                    {activeTab === 'nilai' && <NilaiTab siswa={siswa} />}
                </div>
            </div>
        </div>
    );
}
