'use client';

import React from 'react';
import Spinner from '@/components/ui/Spinner';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';

export interface RekamMedisRow {
    id: string;
    no_rekam_medis: string;
    nisn: string;
    nama_siswa: string;
    kelas: string;
    guru_asuh: string;
    gender: string;
    tempat_lahir: string;
    tanggal_lahir: string | null;
    alamat: string;
    tanggal: string;
    waktu: string;
    riwayat_penyakit: string[];
    riwayat_alergi_obat: string[];
    keluhan: string;
    tata_laksana: string;
    tindakan: string[];
    tindak_lanjut: string;
    petugas_nama: string;
    petugas_nip: string | null;
    created_at: string;
    is_synced?: boolean;
    synced_status?: string | null;
}

export interface SpanInfoItem {
    showStudentCell: boolean;
    rowSpan: number;
    studentIndex: number;
}

export interface StudentGroupItem {
    nisn: string;
    nama_siswa: string;
    kelas: string;
    guru_asuh: string;
    records: RekamMedisRow[];
}

interface DaftarMedisTabProps {
    loadingList: boolean;
    filteredRows: RekamMedisRow[];
    studentSpanInfo: SpanInfoItem[];
    studentGroups: StudentGroupItem[];
    syncingId: string | null;
    handleOpenEditModal: (row: RekamMedisRow) => void;
    setSelectedRowDetail: (row: RekamMedisRow | null) => void;
    handleDeleteRecord: (row: RekamMedisRow) => void;
    handleManualSync: (row: RekamMedisRow) => void;
    tzFormatDate: (dateStr: any) => string;
}

export default function DaftarMedisTab({
    loadingList,
    filteredRows,
    studentSpanInfo,
    studentGroups,
    syncingId,
    handleOpenEditModal,
    setSelectedRowDetail,
    handleDeleteRecord,
    handleManualSync,
    tzFormatDate,
}: DaftarMedisTabProps) {
    const ensureArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {}
            }
            return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [];
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
            <div className="kh-table-wrap" style={{ padding: '0', background: 'transparent', border: 'none' }}>
                {loadingList ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: 'var(--n-card)', borderRadius: '16px', border: '1px solid var(--kh-tb-border)' }}>
                        <Spinner variant="buble" />
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--kh-text-secondary)', background: 'var(--n-card)', borderRadius: '16px', border: '1px solid var(--kh-tb-border)' }}>
                        <i className="bi bi-journal-x" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px', color: 'var(--kh-text-muted)' }}></i>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--kh-text-primary)' }}>Belum ada Rekam Medis</div>
                        <div style={{ fontSize: '0.85rem' }}>Data rekam medis siswa yang diinput akan muncul di sini.</div>
                    </div>
                ) : (
                    <>
                        {/* DESKTOP TABLE VIEW */}
                        <div className="kh-table-wrap desktop-only" style={{ background: 'var(--n-card)', border: '1px solid var(--kh-tb-border)', borderRadius: '16px', overflow: 'hidden' }}>
                            <div className="kh-table-inner">
                                <table className="kh-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '32px', minWidth: '32px', padding: '6px 4px', textAlign: 'center', fontSize: '0.7rem' }}>No.</th>
                                            <th style={{ minWidth: '180px', fontSize: '0.74rem' }}>Siswa</th>
                                            <th style={{ minWidth: '130px', fontSize: '0.74rem' }}>Data RM</th>
                                            <th style={{ minWidth: '220px', fontSize: '0.74rem' }}>Keluhan, Tindakan & Tindak Lanjut</th>
                                            <th style={{ minWidth: '100px', fontSize: '0.74rem' }}>Status</th>
                                            <th style={{ minWidth: '90px', fontSize: '0.74rem' }}>Petugas</th>
                                            <th style={{ textAlign: 'right', width: '105px', minWidth: '105px', fontSize: '0.74rem' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.map((row, idx) => {
                                            const span = studentSpanInfo[idx];
                                            const isLastInGroup = (idx === filteredRows.length - 1) || studentSpanInfo[idx + 1]?.showStudentCell;
                                            return (
                                                <tr key={row.id} style={{ borderBottom: isLastInGroup ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--kh-tb-border)' }}>
                                                    {span && span.showStudentCell && (
                                                        <td
                                                            rowSpan={span.rowSpan}
                                                            style={{
                                                                textAlign: 'center',
                                                                fontWeight: 800,
                                                                fontSize: '0.75rem',
                                                                width: '32px',
                                                                minWidth: '32px',
                                                                padding: '4px 2px',
                                                                color: 'var(--kh-accent)',
                                                                verticalAlign: 'middle',
                                                                background: span.rowSpan > 1 ? 'rgba(0, 56, 168, 0.02)' : 'transparent',
                                                                borderRight: '1px solid var(--kh-tb-border)'
                                                            }}
                                                        >
                                                            {(typeof span.studentIndex === 'number' ? span.studentIndex : idx) + 1}
                                                        </td>
                                                    )}
                                                    {span && span.showStudentCell && (
                                                        <td
                                                            rowSpan={span.rowSpan}
                                                            style={{
                                                                verticalAlign: 'middle',
                                                                background: span.rowSpan > 1 ? 'rgba(0, 56, 168, 0.02)' : 'transparent',
                                                                borderRight: span.rowSpan > 1 ? '1.5px solid var(--kh-tb-border)' : undefined,
                                                                padding: '6px 10px'
                                                            }}
                                                        >
                                                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--kh-text-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                {row.nama_siswa}
                                                                {span.rowSpan > 1 && (
                                                                    <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.65rem', padding: '1px 5px' }}>
                                                                        {span.rowSpan} RM
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--kh-text-secondary)', marginTop: '2px' }}>
                                                                <code>{row.nisn}</code> &nbsp;|&nbsp; <b>{row.kelas}</b>
                                                            </div>
                                                            {row.guru_asuh && row.guru_asuh !== '-' && (
                                                                <div style={{ fontSize: '0.67rem', color: 'var(--kh-text-secondary)', marginTop: '1px', opacity: 0.85 }}>
                                                                    {row.guru_asuh}
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td style={{ verticalAlign: 'middle', padding: '6px 10px' }}>
                                                        <div style={{ fontWeight: 800, color: 'var(--kh-accent)', fontSize: '0.76rem' }}>{row.no_rekam_medis}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--kh-text-secondary)' }}>
                                                            <i className="bi bi-calendar3"></i> {tzFormatDate(row.tanggal)} ({row.waktu?.slice(0,5)})
                                                        </div>
                                                    </td>
                                                    <td style={{ maxWidth: '280px', verticalAlign: 'middle', padding: '6px 10px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--kh-text-primary)' }}>{row.keluhan || '-'}</div>
                                                        {ensureArray(row.riwayat_alergi_obat).some(a => a !== 'Tidak Ada Alergi Obat') && (
                                                            <div style={{ color: '#dc2626', fontSize: '0.71rem', fontWeight: 700, marginTop: '2px' }}>
                                                                <i className="bi bi-exclamation-triangle-fill"></i> Alergi: {ensureArray(row.riwayat_alergi_obat).filter(a => a !== 'Tidak Ada Alergi Obat').join(', ')}
                                                            </div>
                                                        )}
                                                        {row.tindakan && row.tindakan.length > 0 && (
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--kh-text-secondary)', marginTop: '3px' }}>
                                                                {row.tindakan.join(', ')}
                                                            </div>
                                                        )}
                                                        {row.tindak_lanjut && (
                                                            <div style={{ marginTop: '3px' }}>
                                                                <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.68rem', padding: '1px 6px', display: 'inline-block', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                                                    {row.tindak_lanjut}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', padding: '6px 10px' }}>
                                                        {row.is_synced ? (
                                                            <span className="surat-badge" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '2px 8px' }}>
                                                                <i className="bi bi-check-circle-fill"></i> {row.synced_status || 'Ringan'}
                                                            </span>
                                                        ) : row.tindak_lanjut?.toLowerCase().includes('kembali ke kelas') ? (
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--kh-text-muted)' }}>Tanpa Absensi</span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleManualSync(row)}
                                                                disabled={syncingId === row.id}
                                                                className="btn-kh-navy"
                                                                style={{ minHeight: '26px', padding: '2px 8px', fontSize: '0.7rem', background: '#059669', width: 'auto' }}
                                                            >
                                                                {syncingId === row.id ? <i className="bi bi-arrow-repeat spin"></i> : <><i className="bi bi-arrow-repeat"></i> Sinkron</>}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', padding: '6px 10px' }}>
                                                        <div style={{ fontSize: '0.76rem', color: 'var(--kh-text-primary)' }}>{row.petugas_nama}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '6px 10px' }}>
                                                        <ActionGroup>
                                                            <ActionButton action="edit" title="Edit Rekam Medis" onClick={() => handleOpenEditModal(row)} />
                                                            <ActionButton action="view" title="Lihat Detail" onClick={() => setSelectedRowDetail(row)} />
                                                            <ActionButton action="delete" title="Hapus Rekam Medis" onClick={() => handleDeleteRecord(row)} />
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* MOBILE CARDS VIEW */}
                        <div className="kh-mobile-cards mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {studentGroups.map(group => (
                                <div key={group.nisn} style={{
                                    background: 'var(--n-card)', border: '1px solid var(--kh-tb-border)',
                                    borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column',
                                    gap: '10px', borderTop: '4px solid var(--kh-accent)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                }}>
                                    <div style={{ borderBottom: '1px solid var(--kh-tb-border)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--kh-text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{group.nama_siswa}</span>
                                            {group.records.length > 1 && (
                                                <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.72rem' }}>
                                                    {group.records.length} Rekam Medis
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--kh-text-secondary)', marginTop: '3px' }}>
                                            <code>{group.nisn}</code> &nbsp;|&nbsp; <b>{group.kelas}</b>
                                        </div>
                                        {group.guru_asuh && group.guru_asuh !== '-' && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--kh-text-secondary)', marginTop: '1px', opacity: 0.85 }}>
                                                {group.guru_asuh}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {group.records.map(row => (
                                            <div key={row.id} style={{ background: 'var(--kh-tb-stripe)', border: '1px solid var(--kh-tb-border)', borderRadius: '12px', padding: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <span style={{ color: 'var(--kh-accent)', fontWeight: 800, fontSize: '0.88rem' }}>{row.no_rekam_medis}</span>
                                                    <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.72rem' }}>
                                                        {row.tindak_lanjut}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: '0.82rem', color: 'var(--kh-text-primary)', marginBottom: '6px' }}>
                                                    <b>Keluhan:</b> {row.keluhan}
                                                </div>

                                                {ensureArray(row.riwayat_alergi_obat).some(a => a !== 'Tidak Ada Alergi Obat') && (
                                                    <div style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
                                                        <i className="bi bi-exclamation-triangle-fill"></i> Alergi: {ensureArray(row.riwayat_alergi_obat).filter(a => a !== 'Tidak Ada Alergi Obat').join(', ')}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--kh-text-secondary)', borderTop: '1px solid var(--kh-tb-border)', paddingTop: '8px', marginTop: '6px' }}>
                                                    <div><i className="bi bi-calendar3"></i> {tzFormatDate(row.tanggal)} ({row.waktu?.slice(0,5)})</div>
                                                    {row.is_synced ? (
                                                        <span style={{ color: '#059669', fontWeight: 700 }}><i className="bi bi-check-circle-fill"></i> {row.synced_status || 'Ringan'}</span>
                                                    ) : !row.tindak_lanjut?.toLowerCase().includes('kembali ke kelas') ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleManualSync(row)}
                                                            disabled={syncingId === row.id}
                                                            style={{ border: 'none', background: 'transparent', color: '#059669', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            <i className="bi bi-arrow-repeat"></i> Sinkron
                                                        </button>
                                                    ) : null}
                                                </div>

                                                <div className="rm-mobile-actions">
                                                    <ActionButton action="view" label="Detail" iconOnly={false} onClick={() => setSelectedRowDetail(row)} />
                                                    <ActionButton action="edit" label="Edit" iconOnly={false} onClick={() => handleOpenEditModal(row)} />
                                                    <ActionButton action="delete" label="Hapus" iconOnly={false} onClick={() => handleDeleteRecord(row)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
