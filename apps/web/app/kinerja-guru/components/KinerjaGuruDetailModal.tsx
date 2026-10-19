import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface IncidentIzin {
    id?: string;
    jenis: 'izin' | 'sakit' | 'dinas_luar' | string;
    status: 'disetujui' | 'pending' | 'ditolak' | string;
    keterangan?: string | null;
    instansi_tujuan?: string | null;
    tanggal_mulai?: string;
    tanggal_selesai?: string;
}

interface IncidentDetail {
    type: string;
    tanggal: string;
    kelas: string;
    program?: string;
    mapel: string;
    jam_ke: string;
    waktu: string;
    keterangan: string;
    hari?: string;
    izin?: IncidentIzin | null;
}

interface KinerjaGuruDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    teacherName: string;
    details: IncidentDetail[];
    category: string;
}

export default function KinerjaGuruDetailModal({ isOpen, onClose, teacherName, details, category }: KinerjaGuruDetailModalProps) {
    if (!isOpen) return null;

    const filteredDetails = details.filter(d => {
        if (category === 'jamKosong' && d.type === 'Jam Kosong') return true;
        if (category === 'penugasanTanpa' && d.type === 'Tanpa Pendampingan') return true;
        if (category === 'penugasanDengan' && d.type === 'Dengan Pendampingan') return true;
        if (category === 'digabung' && d.type === 'Digabung') return true;
        if (category === 'terlambat' && d.type === 'Terlambat') return true;
        if (category === 'mengambilIstirahat' && d.type === 'Mengambil Waktu Istirahat') return true;
        if (category === 'keluarSebelumWaktu' && d.type === 'Keluar Sebelum Waktunya') return true;
        if (category === 'daring' && d.type === 'Daring') return true;
        if (category === 'piket' && d.type === 'Tidak Piket') return true;
        return false;
    });

    const getCategoryLabel = () => {
        switch (category) {
            case 'jamKosong': return 'Jam Kosong';
            case 'penugasanTanpa': return 'Tanpa Pendampingan';
            case 'penugasanDengan': return 'Dengan Pendampingan';
            case 'digabung': return 'Digabung';
            case 'terlambat': return 'Terlambat';
            case 'mengambilIstirahat': return 'Mengambil Waktu Istirahat';
            case 'keluarSebelumWaktu': return 'Keluar Sebelum Waktunya';
            case 'daring': return 'Daring';
            case 'piket': return 'Tidak Piket';
            default: return 'Detail';
        }
    };

    return (
        <Modal onClose={onClose} size="xl" className="kg-incident-modal kg-modal">
            <ModalHeader
                    title={`Detail Insiden — ${teacherName}`}
                    subtitle={`${getCategoryLabel()} • ${filteredDetails.length} Insiden`}
                    onClose={onClose}
                    icon="info-circle"
                />
                <ModalBody>
                    {filteredDetails.length === 0 ? (
                        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--n-muted)' }}>
                            <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}></i>
                            Tidak ada rincian data insiden untuk kategori ini.
                        </div>
                    ) : (
                        <>
                            {/* Desktop View Table */}
                            <div className="table-wrapper desktop-only">
                                <table>
                                        <thead>
                                            <tr>
                                                <th className="no-cell">No</th>
                                                <th className="date-cell">Tanggal & Hari</th>
                                                <th>Mata Pelajaran</th>
                                                <th>Kelas</th>
                                                <th className="waktu-cell">Jam / Waktu</th>
                                                <th className="izin-cell">Izin / Sakit</th>
                                                <th>Keterangan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDetails.map((det, idx) => (
                                                <tr key={idx}>
                                                    <td className="no-cell">{idx + 1}</td>
                                                    <td className="date-cell">
                                                        <div>{det.tanggal}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--n-muted)', fontWeight: 500 }}>{det.hari || '-'}</div>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{det.mapel || '-'}</td>
                                                    <td>
                                                        <span style={{ fontWeight: 700, color: 'var(--n-primary)' }}>{det.kelas}</span>
                                                        {det.program && <span style={{ fontSize: '0.72rem', color: 'var(--n-muted)', marginLeft: '4px' }}>({det.program})</span>}
                                                    </td>
                                                    <td className="waktu-cell">
                                                        <div>Jam ke-{det.jam_ke}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--n-muted)' }}>{det.waktu}</div>
                                                    </td>
                                                    <td className="izin-cell">
                                                        {det.izin ? (
                                                            <div className="kg-izin-cell-content">
                                                                <div className="kg-izin-badge-line">
                                                                    <span className={`kg-izin-badge ${det.izin.jenis === 'dinas_luar' ? 'dinas' : det.izin.jenis}`}>
                                                                        {det.izin.jenis === 'dinas_luar' ? 'Dinas Luar' : det.izin.jenis === 'sakit' ? 'Sakit' : 'Izin'}
                                                                    </span>
                                                                    <span className={`kg-izin-status ${det.izin.status}`}>
                                                                        {det.izin.status === 'disetujui' ? (
                                                                            <><i className="bi bi-check2"></i> Disetujui</>
                                                                        ) : det.izin.status === 'pending' ? (
                                                                            <><i className="bi bi-clock"></i> Menunggu</>
                                                                        ) : (
                                                                            <><i className="bi bi-x"></i> Ditolak</>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                {det.izin.keterangan && (
                                                                    <div className="kg-izin-desc" title={det.izin.keterangan}>
                                                                        {det.izin.keterangan}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="kg-izin-empty">-</span>
                                                        )}
                                                    </td>
                                                    <td className="keterangan-cell" title={det.keterangan}>
                                                        {det.keterangan || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                            {/* Mobile View Cards */}
                            <div className="mobile-only">
                                <div className="modal-card-list">
                                    {filteredDetails.map((det, idx) => (
                                        <div key={idx} className="detail-card">
                                            <div className="card-header-inner">
                                                <div className="card-date-info">
                                                    <span className="card-date">{det.tanggal}</span>
                                                    <span className="card-day">{det.hari || '-'} • Jam ke-{det.jam_ke}</span>
                                                </div>
                                                <span className="info-kelas">{det.kelas}</span>
                                            </div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--n-text)', marginBottom: '4px' }}>
                                                {det.mapel || '-'}
                                            </div>
                                            <div className="card-time">Waktu: {det.waktu}</div>
                                            {det.izin && (
                                                <div className="card-izin-row">
                                                    <span className={`kg-izin-badge ${det.izin.jenis === 'dinas_luar' ? 'dinas' : det.izin.jenis}`}>
                                                        {det.izin.jenis === 'dinas_luar' ? 'Dinas Luar' : det.izin.jenis === 'sakit' ? 'Sakit' : 'Izin'}
                                                    </span>
                                                    <span className={`kg-izin-status ${det.izin.status}`}>
                                                        {det.izin.status === 'disetujui' ? 'Disetujui' : det.izin.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                                                    </span>
                                                    {det.izin.keterangan && (
                                                        <span className="card-izin-desc">• {det.izin.keterangan}</span>
                                                    )}
                                                </div>
                                            )}
                                            {det.keterangan && (
                                                <div className="info-note">
                                                    <strong>Ket:</strong> {det.keterangan}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" onClick={onClose}>Tutup</Button>
                </ModalFooter>
        </Modal>
    );
}
