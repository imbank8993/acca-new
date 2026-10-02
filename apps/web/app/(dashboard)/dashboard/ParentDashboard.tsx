'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { User } from '@/lib/types';
import DashboardContent from './DashboardContent';
import AnakSwitcher from '@/components/AnakSwitcher';
import DatePicker from '@/components/ui/DatePicker';

interface Anak {
    nisn: string;
    nama_lengkap: string;
    kelas: string;
    tahun_ajaran: string;
    foto: string | null;
    status_keluarga: string;
}

/**
 * Dashboard orang tua = dashboard siswa (DashboardContent) untuk anak yang
 * dipilih, dirender lewat user mock ber-role SISWA (nip/nisn = NISN anak) —
 * pola yang sama dengan JadwalOrangTuaWrapper. Orang tua dengan >1 anak
 * berganti anak lewat chip di bar atas.
 */
export default function ParentDashboard({ user }: { user: User }) {
    const [anakList, setAnakList] = useState<Anak[]>([]);
    const [selectedNisn, setSelectedNisn] = useState('');
    const [loading, setLoading] = useState(true);

    // Klaim anak tambahan (modal)
    const [showAddModal, setShowAddModal] = useState(false);
    const [addNisn, setAddNisn] = useState('');
    const [addTanggalLahir, setAddTanggalLahir] = useState('');
    const [addStatus, setAddStatus] = useState('Ayah');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
    const [addSuccess, setAddSuccess] = useState('');

    const fetchAnak = async (selectNisn?: string) => {
        try {
            const res = await fetch('/api/orangtua/anak');
            const json = await res.json();
            if (json.ok) {
                const list: Anak[] = json.data || [];
                setAnakList(list);
                if (selectNisn && list.some(a => a.nisn === selectNisn)) {
                    setSelectedNisn(selectNisn);
                } else if (list.length > 0 && !list.some(a => a.nisn === selectedNisn)) {
                    // Dashboard adalah halaman pendaratan: langsung tampilkan anak
                    // pertama; berganti anak lewat chip (tanpa halaman pemilih).
                    setSelectedNisn(list[0].nisn);
                }
            }
        } catch (err) {
            console.error('Failed to fetch children data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnak();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openAddModal = () => {
        setAddNisn('');
        setAddTanggalLahir('');
        setAddStatus(anakList[0]?.status_keluarga || 'Ayah');
        setAddError('');
        setAddSuccess('');
        setShowAddModal(true);
    };

    const handleAddAnak = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');
        setAddSuccess('');
        if (!addTanggalLahir) { setAddError('Tanggal Lahir Siswa wajib diisi.'); return; }
        setAddLoading(true);
        try {
            const res = await fetch('/api/orangtua/anak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nisn: addNisn,
                    tanggal_lahir_siswa: addTanggalLahir,
                    status_keluarga: addStatus
                })
            });
            const json = await res.json();
            if (json.ok) {
                setAddSuccess(json.message || 'Anak berhasil ditambahkan.');
                const newNisn = addNisn.trim();
                setTimeout(async () => {
                    setShowAddModal(false);
                    setLoading(true);
                    await fetchAnak(newNisn);
                }, 1000);
            } else {
                setAddError(json.error || 'Gagal menambahkan anak');
            }
        } catch (err) {
            setAddError('Terjadi kesalahan jaringan');
        } finally {
            setAddLoading(false);
        }
    };

    const selectedAnak = useMemo(
        () => anakList.find(a => a.nisn === selectedNisn) || null,
        [anakList, selectedNisn]
    );

    // User mock ber-role SISWA: semua loader DashboardContent membaca NISN
    // dari nip/username/nisn; nama tetap nama orang tua untuk sapaan hero.
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

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: '10px',
        border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff'
    };

    function renderAddModal() {
        if (typeof window === 'undefined') return null;
        // Portal ke body + backdrop blur agar sidebar/header ikut tertutup,
        // konsisten dengan modal lain di aplikasi (mis. rh-modal-overlay).
        return createPortal(
            <div
                onClick={() => setShowAddModal(false)}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}
            >
                <div
                    onClick={e => e.stopPropagation()}
                    style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>Tambah Anak</h3>
                        <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
                        Masukkan NISN dan tanggal lahir anak untuk verifikasi data sekolah.
                    </p>

                    {addSuccess ? (
                        <div style={{ padding: '14px', background: '#dcfce7', color: '#166534', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="bi bi-check-circle-fill" style={{ fontSize: '1.1rem' }}></i>
                            <span style={{ fontSize: '0.9rem' }}>{addSuccess}</span>
                        </div>
                    ) : (
                        <form onSubmit={handleAddAnak} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>NISN Siswa</label>
                                <input type="text" value={addNisn} onChange={e => setAddNisn(e.target.value)} required disabled={addLoading} placeholder="Nomor Induk Siswa Nasional" style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Tanggal Lahir Siswa</label>
                                <DatePicker value={addTanggalLahir} onChange={setAddTanggalLahir} required disabled={addLoading} style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Status Keluarga</label>
                                <select value={addStatus} onChange={e => setAddStatus(e.target.value)} disabled={addLoading} style={inputStyle}>
                                    <option value="Ayah">Ayah</option>
                                    <option value="Ibu">Ibu</option>
                                    <option value="Wali">Wali</option>
                                </select>
                            </div>

                            {addError && (
                                <div style={{ padding: '10px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <i className="bi bi-x-circle-fill" style={{ marginTop: '2px' }}></i>
                                    <span>{addError}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={addLoading}
                                style={{
                                    padding: '11px', background: '#3083FF', color: '#fff', border: 'none',
                                    borderRadius: '10px', fontWeight: 700, fontSize: '0.92rem',
                                    cursor: addLoading ? 'wait' : 'pointer', opacity: addLoading ? 0.7 : 1
                                }}
                            >
                                {addLoading ? 'Memverifikasi...' : 'Verifikasi & Tambahkan'}
                            </button>
                        </form>
                    )}
                </div>
            </div>,
            document.body
        );
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                <p>Memuat data anak...</p>
            </div>
        );
    }

    if (anakList.length === 0) {
        return (
            <div className="db">
                
                <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b', background: '#f8fafc', borderRadius: '16px', marginTop: '20px' }}>
                    <i className="bi bi-person-x" style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '16px', display: 'block' }}></i>
                    <p style={{ fontWeight: 600, color: '#334155' }}>Belum ada data anak</p>
                    <p style={{ fontSize: '0.9rem' }}>Klaim anak Anda dengan tombol di bawah, atau hubungi admin sekolah.</p>
                    <button
                        onClick={openAddModal}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px',
                            padding: '10px 18px', background: '#3083FF', color: '#fff', border: 'none',
                            borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
                        }}
                    >
                        <i className="bi bi-person-plus-fill"></i> Tambah Anak
                    </button>
                </div>
                {showAddModal && renderAddModal()}
            </div>
        );
    }

    // Switcher anak + aksi, dirender DI BAWAH banner hero lewat prop headerExtra
    // (1 anak = tanpa chip, hanya tombol aksi rata kanan)
    const switcherRow = useMemo(() => (
        <AnakSwitcher
            anakList={anakList}
            selectedNisn={selectedNisn}
            onSelect={setSelectedNisn}
            actions={
                <>
                    {selectedAnak && (
                        <Link
                            href={`/anak/${selectedAnak.nisn}`}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '10px', background: 'transparent',
                                border: '1px solid #cbd5e1', color: '#3083FF', fontWeight: 600,
                                fontSize: '0.82rem', textDecoration: 'none', whiteSpace: 'nowrap'
                            }}
                        >
                            <i className="bi bi-person-vcard"></i> Profil Anak
                        </Link>
                    )}
                    <button
                        onClick={openAddModal}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '10px', background: '#3083FF',
                            border: '1px solid #3083FF', color: '#fff', fontWeight: 600,
                            fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap'
                        }}
                    >
                        <i className="bi bi-person-plus-fill"></i> Tambah Anak
                    </button>
                </>
            }
        />
    ), [anakList, selectedNisn, selectedAnak]);

    return (
        <div>
            {/* Dashboard identik dengan dashboard siswa untuk anak terpilih.
                key memaksa remount saat ganti anak agar semua data dimuat ulang. */}
            {mockUser ? (
                <DashboardContent key={selectedNisn} user={mockUser} headerExtra={switcherRow} />
            ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p>Menyiapkan data siswa...</p>
                </div>
            )}

            {showAddModal && renderAddModal()}
        </div>
    );
}
