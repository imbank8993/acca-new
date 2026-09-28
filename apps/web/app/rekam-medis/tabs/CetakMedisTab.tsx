'use client';

import React from 'react';
import FilterToolbar, { FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import Spinner from '@/components/ui/Spinner';

export type PrintStudentItem = {
    nisn: string;
    nama_siswa: string;
    kelas: string;
    guru_asuh: string;
    gender: string;
    tempat_lahir: string;
    tanggal_lahir: string | null;
    alamat: string;
    count: number;
};

interface CetakMedisTabProps {
    printSiswaQuery: string;
    setPrintSiswaQuery: (q: string) => void;
    printFilterKelas: string;
    setPrintFilterKelas: (k: string) => void;
    printFilterGuruAsuh: string;
    setPrintFilterGuruAsuh: (g: string) => void;
    availableClasses: string[];
    availablePrintGuruAsuh: string[];
    printLoadingList: boolean;
    filteredPrintStudentList: PrintStudentItem[];
    printingNisn: string | null;
    handleDirectPrintStudent: (student: PrintStudentItem) => void;
}

export default function CetakMedisTab({
    printSiswaQuery,
    setPrintSiswaQuery,
    printFilterKelas,
    setPrintFilterKelas,
    printFilterGuruAsuh,
    setPrintFilterGuruAsuh,
    availableClasses,
    availablePrintGuruAsuh,
    printLoadingList,
    filteredPrintStudentList,
    printingNisn,
    handleDirectPrintStudent,
}: CetakMedisTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
            <FilterToolbar>
                <FilterSearch
                    value={printSiswaQuery}
                    onChange={setPrintSiswaQuery}
                    placeholder="Cari nama siswa, NISN, atau kelas..."
                />
                <FilterSelect
                    label="Kelas"
                    icon="door-open"
                    value={printFilterKelas}
                    onChange={setPrintFilterKelas}
                    options={[
                        { value: '', label: 'Semua Kelas' },
                        ...availableClasses.map(c => ({ value: c, label: c }))
                    ]}
                />
                <FilterSelect
                    label="Guru Asuh"
                    icon="person-badge"
                    value={printFilterGuruAsuh}
                    onChange={setPrintFilterGuruAsuh}
                    options={[
                        { value: '', label: 'Semua Guru Asuh' },
                        ...availablePrintGuruAsuh.map(g => ({ value: g, label: g }))
                    ]}
                />
                {(printSiswaQuery || printFilterKelas || printFilterGuruAsuh) && (
                    <FilterActions>
                        <button
                            type="button"
                            className="ftb-btn ftb-btn--ghost"
                            onClick={() => {
                                setPrintSiswaQuery('');
                                setPrintFilterKelas('');
                                setPrintFilterGuruAsuh('');
                            }}
                            title="Reset semua filter cetak"
                        >
                            <i className="bi bi-arrow-counterclockwise"></i> Reset Filter
                        </button>
                    </FilterActions>
                )}
            </FilterToolbar>

            {/* DESKTOP TABLE VIEW */}
            <div className="kh-table-wrap desktop-only">
                <div className="kh-table-inner">
                    <table className="kh-table">
                        <thead>
                            <tr>
                                <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                                <th>Nama Siswa</th>
                                <th>Kelas</th>
                                <th>Guru Asuh</th>
                                <th style={{ width: '130px', textAlign: 'center' }}>Jumlah RM</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printLoadingList ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                                        <Spinner variant="buble" />
                                    </td>
                                </tr>
                            ) : filteredPrintStudentList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--kh-text-muted)' }}>
                                        <i className="bi bi-person-x" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.4 }}></i>
                                        {printSiswaQuery ? 'Tidak ada siswa yang sesuai dengan pencarian.' : 'Belum ada data rekam medis siswa.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredPrintStudentList.map((s, idx) => (
                                    <tr key={s.nisn}>
                                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--kh-text-muted)', fontSize: '0.8rem' }}>
                                            {idx + 1}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--kh-text-primary)' }}>{s.nama_siswa}</div>
                                            <div style={{ fontSize: '0.76rem', color: 'var(--kh-text-secondary)', marginTop: '2px' }}>
                                                NISN: <code style={{ fontWeight: 700, color: 'var(--kh-accent)' }}>{s.nisn}</code>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600, color: 'var(--kh-text-primary)' }}>
                                            {s.kelas}
                                        </td>
                                        <td style={{ fontSize: '0.84rem', color: 'var(--kh-text-primary)' }}>
                                            {s.guru_asuh && s.guru_asuh !== '-' ? s.guru_asuh : '-'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                                                {s.count} RM
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <ActionGroup>
                                                <ActionButton
                                                    action="print"
                                                    title="Cetak Dokumen Rekam Medis (PDF)"
                                                    onClick={() => handleDirectPrintStudent(s)}
                                                    isLoading={printingNisn === s.nisn}
                                                />
                                            </ActionGroup>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="kh-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>Total Siswa Berobat: <b>{filteredPrintStudentList.length}</b> siswa</div>
                </div>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="kh-mobile-cards mobile-only" style={{ flexDirection: 'column', gap: '12px' }}>
                {printLoadingList ? (
                    <div style={{ textAlign: 'center', padding: '32px', background: 'var(--n-card)', borderRadius: '14px', border: '1px solid var(--kh-tb-border)' }}>
                        <Spinner variant="buble" />
                    </div>
                ) : filteredPrintStudentList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--kh-text-muted)', background: 'var(--n-card)', borderRadius: '14px', border: '1px solid var(--kh-tb-border)' }}>
                        <i className="bi bi-person-x" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.4 }}></i>
                        {printSiswaQuery ? 'Tidak ada siswa yang sesuai dengan pencarian.' : 'Belum ada data rekam medis siswa.'}
                    </div>
                ) : (
                    filteredPrintStudentList.map((s, idx) => (
                        <div
                            key={s.nisn}
                            className="rm-card-box"
                            style={{
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--kh-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--kh-text-muted)', fontWeight: 600 }}>#{idx + 1}</span>
                                        {s.nama_siswa}
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--kh-text-secondary)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <span>NISN: <code style={{ fontWeight: 700, color: 'var(--kh-accent)' }}>{s.nisn}</code></span>
                                        <span>Kelas: <b>{s.kelas}</b></span>
                                    </div>
                                </div>
                                <span style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {s.count} RM
                                </span>
                            </div>

                            {s.guru_asuh && s.guru_asuh !== '-' && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--kh-text-secondary)', borderTop: '1px solid var(--kh-tb-border)', paddingTop: '8px' }}>
                                    Guru Asuh: <b style={{ color: 'var(--kh-text-primary)' }}>{s.guru_asuh}</b>
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid var(--kh-tb-border)', paddingTop: '10px', marginTop: '2px' }}>
                                <button
                                    type="button"
                                    className="btn-action-primary"
                                    onClick={() => handleDirectPrintStudent(s)}
                                    disabled={printingNisn === s.nisn}
                                    style={{ width: '100%', height: '36px', fontSize: '0.82rem', borderRadius: '10px' }}
                                >
                                    {printingNisn === s.nisn ? (
                                        <>
                                            <i className="bi bi-arrow-repeat spin"></i> Memproses PDF...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-printer-fill"></i> Cetak Rekam Medis (PDF)
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
