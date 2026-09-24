'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { User } from '@/lib/types';
import JadwalPage from './view';
import { UserX, Users, ArrowLeft } from 'lucide-react';
import '@/app/ketidakhadiran/ketidakhadiran.css';

interface Anak {
    nisn: string;
    nama_lengkap: string;
    kelas: string;
    tahun_ajaran?: string;
}

/**
 * Jadwal untuk orang tua — pola sama dengan halaman Nilai/Kehadiran:
 *  - 1 anak  → langsung tampil jadwalnya (tanpa pemilih, desain bersih)
 *  - ≥2 anak → daftar kartu anak dengan tombol "Lihat Jadwal";
 *              setelah dipilih ada tombol kembali untuk berganti anak.
 */
export default function OrangTuaWrapper({ user }: { user: User }) {
    const [anakList, setAnakList] = useState<Anak[]>([]);
    const [selectedNisn, setSelectedNisn] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTahunAjaran, setFilterTahunAjaran] = useState('');
    const [filterKelas, setFilterKelas] = useState('');

    useEffect(() => {
        const fetchAnak = async () => {
            try {
                const res = await fetch('/api/orangtua/anak');
                const json = await res.json();
                if (json.ok && json.data) {
                    setAnakList(json.data);
                    // Auto-pilih hanya anak tunggal
                    if (json.data.length === 1) {
                        setSelectedNisn(json.data[0].nisn);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAnak();
    }, []);

    const selectedAnak = useMemo(
        () => anakList.find(a => a.nisn === selectedNisn) || null,
        [anakList, selectedNisn]
    );

    const mockUser = useMemo<User | null>(() => {
        if (!selectedAnak) return null;
        return {
            ...user,
            role: 'SISWA',
            roles: ['SISWA'],
            nip: selectedAnak.nisn,
            username: selectedAnak.nisn,
            nisn: selectedAnak.nisn,
        };
    }, [user, selectedAnak]);

    const { kelasList, tahunAjaranList } = useMemo(() => {
        const kelasSet = new Set<string>();
        const taSet = new Set<string>();
        anakList.forEach(s => {
            if (s.kelas) kelasSet.add(s.kelas);
            if (s.tahun_ajaran) taSet.add(s.tahun_ajaran);
        });
        return {
            kelasList: Array.from(kelasSet).sort(),
            tahunAjaranList: Array.from(taSet).sort((a, b) => b.localeCompare(a))
        };
    }, [anakList]);

    const filteredAnak = useMemo(() => {
        return anakList.filter(s => {
            if (filterKelas && s.kelas !== filterKelas) return false;
            if (filterTahunAjaran && s.tahun_ajaran !== filterTahunAjaran) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!s.nisn.toLowerCase().includes(q) && !s.nama_lengkap.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [anakList, filterKelas, filterTahunAjaran, searchQuery]);

    const hasActiveFilters = filterKelas || filterTahunAjaran || searchQuery;

    if (loading) {
        return (
            <div className="kehadiran-page">
                <div className="kehadiran-page__spinner">
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(48, 131, 255, 0.15)', borderTopColor: 'var(--n-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <p className="kehadiran-page__spinner-text">Memuat data...</p>
                </div>
            </div>
        );
    }

    if (anakList.length === 0) {
        return (
            <div className="kehadiran-page">
                <div className="kehadiran-page__card kehadiran-page__empty-state" style={{ margin: '20px' }}>
                    <div className="kehadiran-page__empty-icon">
                        <UserX size={40} style={{ color: 'var(--n-muted)' }} />
                    </div>
                    <h3 className="kehadiran-page__empty-title">Belum ada data anak</h3>
                    <p className="kehadiran-page__empty-desc">Klaim anak Anda lewat tombol Tambah Anak di Dashboard.</p>
                </div>
            </div>
        );
    }

    // --- Pemilih anak (hanya bila ≥2 anak dan belum ada yang dipilih) ---
    if (!selectedNisn) {
        return (
            <div className="kehadiran-page">
                <div className="kehadiran-page__inner">
                    {/* Hero Header */}
                    <div className="kehadiran-page__hero">
                        <div className="kehadiran-page__hero-grid"></div>
                        <div className="kehadiran-page__hero-left">
                            <div className="kehadiran-page__hero-text">
                                <h1 className="kehadiran-page__hero-title">Jadwal Pelajaran</h1>
                                <p className="kehadiran-page__hero-sub">Pilih anak Anda untuk melihat jadwal pelajarannya</p>
                            </div>
                        </div>
                        <div className="kehadiran-page__hero-badge">
                            <p className="kehadiran-page__hero-badge-label">Jumlah Anak</p>
                            <p className="kehadiran-page__hero-badge-value">{filteredAnak.length}</p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="kehadiran-page__content">
                        {/* Filters Card */}
                        <div className="kehadiran-page__card kehadiran-page__filter-card">
                            <div className="kehadiran-page__filter-grid">
                                <div className="kehadiran-page__filter-search">
                                    <label className="kehadiran-page__label">Cari Siswa</label>
                                    <div className="kehadiran-page__input-wrap">
                                        <svg className="kehadiran-page__input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Ketik nama atau NISN..."
                                            className="kehadiran-page__input"
                                        />
                                    </div>
                                </div>
                                <div className="kehadiran-page__filter-select">
                                    <label className="kehadiran-page__label">Tahun Ajaran</label>
                                    <div className="kehadiran-page__select-wrap">
                                        <select value={filterTahunAjaran} onChange={(e) => setFilterTahunAjaran(e.target.value)} className="kehadiran-page__select">
                                            <option value="">Semua</option>
                                            {tahunAjaranList.map((ta) => <option key={ta} value={ta}>{ta}</option>)}
                                        </select>
                                        <svg className="kehadiran-page__select-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="kehadiran-page__filter-select">
                                    <label className="kehadiran-page__label">Kelas</label>
                                    <div className="kehadiran-page__select-wrap">
                                        <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="kehadiran-page__select">
                                            <option value="">Semua</option>
                                            {kelasList.map((kelas) => <option key={kelas} value={kelas}>{kelas}</option>)}
                                        </select>
                                        <svg className="kehadiran-page__select-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <div className="kehadiran-page__filter-chips">
                                    <span className="kehadiran-page__chip-label">Filter aktif:</span>
                                    {filterKelas && (
                                        <span className="kehadiran-page__chip kehadiran-page__chip--blue">
                                            {filterKelas}
                                            <button onClick={() => setFilterKelas('')} className="kehadiran-page__chip-remove">×</button>
                                        </span>
                                    )}
                                    {filterTahunAjaran && (
                                        <span className="kehadiran-page__chip kehadiran-page__chip--blue">
                                            {filterTahunAjaran}
                                            <button onClick={() => setFilterTahunAjaran('')} className="kehadiran-page__chip-remove">×</button>
                                        </span>
                                    )}
                                    {searchQuery && (
                                        <span className="kehadiran-page__chip kehadiran-page__chip--emerald">
                                            &ldquo;{searchQuery}&rdquo;
                                            <button onClick={() => setSearchQuery('')} className="kehadiran-page__chip-remove">×</button>
                                        </span>
                                    )}
                                    <button onClick={() => { setFilterKelas(''); setFilterTahunAjaran(''); setSearchQuery(''); }} className="kehadiran-page__chip-reset">Reset Filter</button>
                                </div>
                            )}
                        </div>

                        {/* Student List - Desktop Table */}
                        <div className="kehadiran-page__card kehadiran-page__table-container">
                            <div className="kehadiran-page__table-header">
                                <h3 className="kehadiran-page__table-title">
                                    <Users size={18} style={{ marginRight: '8px', color: 'var(--n-primary)', display: 'inline', verticalAlign: 'middle' }} />
                                    Daftar Siswa
                                </h3>
                                <span className="kehadiran-page__table-count">{filteredAnak.length} siswa</span>
                            </div>
                            
                            {filteredAnak.length === 0 ? (
                                <div className="kehadiran-page__empty-state">
                                    <div className="kehadiran-page__empty-icon">
                                        <svg className="kehadiran-page__empty-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="kehadiran-page__empty-title">Tidak Ada Siswa Ditemukan</h3>
                                    <p className="kehadiran-page__empty-desc">Coba ubah filter pencarian</p>
                                </div>
                            ) : (
                                <div className="kehadiran-page__table-wrap">
                                    <table className="kehadiran-page__table">
                                        <thead>
                                            <tr>
                                                <th className="kehadiran-page__th">No</th>
                                                <th className="kehadiran-page__th">Nama Siswa</th>
                                                <th className="kehadiran-page__th">NISN</th>
                                                <th className="kehadiran-page__th">Kelas</th>
                                                <th className="kehadiran-page__th">Tahun Ajaran</th>
                                                <th className="kehadiran-page__th">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAnak.map((anak, idx) => (
                                                <tr key={anak.nisn} className="kehadiran-page__tr">
                                                    <td className="kehadiran-page__td">{idx + 1}</td>
                                                    <td className="kehadiran-page__td">
                                                        <div className="kehadiran-page__student-info-row">
                                                            <div className="kehadiran-page__student-avatar-row">
                                                                {anak.nama_lengkap.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="kehadiran-page__name-stack">
                                                                <span className="kehadiran-page__student-name">{anak.nama_lengkap}</span>
                                                                <span className="kehadiran-page__student-nisn">NISN: {anak.nisn}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="kehadiran-page__td" style={{ fontWeight: 600, color: 'var(--n-muted)' }}>{anak.nisn}</td>
                                                    <td className="kehadiran-page__td">
                                                        <span className="kehadiran-page__badge kehadiran-page__badge--blue">{anak.kelas || '-'}</span>
                                                    </td>
                                                    <td className="kehadiran-page__td">
                                                        <span className="kehadiran-page__badge kehadiran-page__badge--blue">{anak.tahun_ajaran || '-'}</span>
                                                    </td>
                                                    <td className="kehadiran-page__td">
                                                        <button
                                                            onClick={() => setSelectedNisn(anak.nisn)}
                                                            className="kehadiran-page__btn-table"
                                                        >
                                                            <svg className="kehadiran-page__btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            Lihat Jadwal
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Student Cards - Mobile */}
                        <div className="kehadiran-page__student-grid-mobile">
                            {filteredAnak.map((anak) => (
                                <div key={anak.nisn} className="kehadiran-page__student-card">
                                    <div className="kehadiran-page__student-card-body">
                                        <div className="kehadiran-page__student-avatar">
                                            {anak.nama_lengkap.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="kehadiran-page__student-info">
                                            <h3 className="kehadiran-page__student-name">{anak.nama_lengkap}</h3>
                                            <p className="kehadiran-page__student-nisn">{anak.nisn}</p>
                                        </div>
                                    </div>
                                    <div className="kehadiran-page__student-meta">
                                        <span className="kehadiran-page__student-tag">{anak.kelas || '-'}</span>
                                        <span className="kehadiran-page__student-tag kehadiran-page__student-tag--cyan">{anak.tahun_ajaran || '-'}</span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedNisn(anak.nisn)}
                                        className="kehadiran-page__btn kehadiran-page__btn--primary kehadiran-page__btn--full"
                                    >
                                        <svg className="kehadiran-page__btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Lihat Jadwal
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Jadwal anak terpilih ---
    return (
        <div>
            {anakList.length > 1 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '8px 24px', marginBottom: '10px'
                }}>
                    <button
                        onClick={() => setSelectedNisn('')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '10px', background: 'var(--n-card)',
                            border: '1px solid var(--n-border)', color: 'var(--n-primary)', fontWeight: 600,
                            fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap'
                        }}
                    >
                        <ArrowLeft size={16} /> Pilih Anak Lain
                    </button>
                    <span style={{ fontSize: '0.88rem', color: 'var(--n-muted)' }}>
                        Jadwal untuk <strong style={{ color: 'var(--n-ink)' }}>{selectedAnak?.nama_lengkap}</strong>
                        {selectedAnak?.kelas ? ` · ${selectedAnak.kelas}` : ''}
                    </span>
                </div>
            )}

            {mockUser && <JadwalPage key={selectedNisn} user={mockUser} />}
        </div>
    );
}
