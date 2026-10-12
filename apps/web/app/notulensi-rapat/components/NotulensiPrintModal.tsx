'use client';

import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { type NotulensiItem } from './NotulensiModal';

interface NotulensiPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: NotulensiItem | null;
}

function formatDateIndo(dateStr?: string) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

export default function NotulensiPrintModal({ isOpen, onClose, data }: NotulensiPrintModalProps) {
    if (!isOpen || !data) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            title="Pratinjau Cetak Notulensi Rapat"
            icon="printer-fill"
        >
            <ModalBody>
                <div className="nr-printable-area nr-print-sheet">
                    {/* Kop Surat */}
                    <div className="nr-print-kop">
                        <div className="nr-print-kop-text">
                            <h3>KEMENTERIAN AGAMA REPUBLIK INDONESIA</h3>
                            <h3 style={{ fontSize: '1.25rem', marginTop: '2px' }}>MADRASAH ALIYAH NEGERI INSAN CENDEKIA GOWA</h3>
                            <p>Jl. Pendidikan, Desa Sunggumanai, Kec. Pattallassang, Kab. Gowa, Sulawesi Selatan</p>
                        </div>
                    </div>

                    {/* Judul Dokumen */}
                    <div className="nr-print-title">
                        <h2>NOTULENSI RAPAT</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>
                            Nomor / Kode Arsip: NR-{data.id || 'DRAFT'}-{data.tanggal ? data.tanggal.replace(/-/g, '') : ''}
                        </p>
                    </div>

                    {/* Metadata Rapat */}
                    <table className="nr-print-meta-table">
                        <tbody>
                            <tr>
                                <td style={{ width: '160px', fontWeight: 'bold' }}>Agenda Rapat</td>
                                <td style={{ width: '15px' }}>:</td>
                                <td style={{ fontWeight: 'bold' }}>{data.agenda}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold' }}>Hari / Tanggal</td>
                                <td>:</td>
                                <td>{formatDateIndo(data.tanggal)}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold' }}>Waktu Pelaksanaan</td>
                                <td>:</td>
                                <td>{data.waktu_mulai ? `${data.waktu_mulai} WITA ${data.waktu_selesai ? `- ${data.waktu_selesai} WITA` : ''}` : 'Sesuai Jadwal'}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold' }}>Tempat / Ruangan</td>
                                <td>:</td>
                                <td>{data.lokasi || 'Lingkungan Madrasah'}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold' }}>Pimpinan Rapat</td>
                                <td>:</td>
                                <td>{data.pimpinan_rapat || '-'}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold' }}>Notulis</td>
                                <td>:</td>
                                <td>{data.notulis || '-'}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold' }}>Peserta Rapat</td>
                                <td>:</td>
                                <td>{data.peserta || 'Seluruh Dewan Guru & Tenaga Kependidikan'}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Poin-Poin Hasil Rapat */}
                    <div style={{ marginTop: '14px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>HASIL RAPAT &amp; TINDAK LANJUT:</span>
                    </div>

                    <table className="nr-print-poin-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>No</th>
                                <th>Uraian Keputusan / Pembahasan</th>
                                <th style={{ width: '130px' }}>Status Tindak Lanjut</th>
                                <th style={{ width: '120px' }}>PIC</th>
                                <th style={{ width: '100px' }}>Tenggat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.poin_poin && data.poin_poin.length > 0 ? (
                                data.poin_poin.map((p, idx) => (
                                    <tr key={p.id || idx}>
                                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                        <td>
                                            <div>{p.teks}</div>
                                            {p.keterangan && (
                                                <div style={{ fontSize: '0.82rem', fontStyle: 'italic', marginTop: '2px', color: '#4b5563' }}>
                                                    Catatan: {p.keterangan}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                            {p.status}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{p.pic || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>{p.tenggat || '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                                        Tidak ada catatan rincian poin.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {data.catatan && (
                        <div style={{ marginBottom: '20px', fontSize: '0.92rem' }}>
                            <strong>Catatan Tambahan:</strong>
                            <p style={{ margin: '4px 0 0' }}>{data.catatan}</p>
                        </div>
                    )}

                    {/* Kolom Tanda Tangan */}
                    <div className="nr-print-sign-row">
                        <div className="nr-print-sign-col">
                            <p style={{ margin: 0 }}>Notulis,</p>
                            <div className="nr-print-sign-space"></div>
                            <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>
                                {data.notulis || '( .......................................... )'}
                            </p>
                        </div>
                        <div className="nr-print-sign-col">
                            <p style={{ margin: 0 }}>Pimpinan Rapat,</p>
                            <div className="nr-print-sign-space"></div>
                            <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>
                                {data.pimpinan_rapat || '( .......................................... )'}
                            </p>
                        </div>
                    </div>
                </div>
            </ModalBody>
            <ModalFooter className="no-print">
                <Button variant="secondary" onClick={onClose}>
                    Tutup
                </Button>
                <Button variant="primary" onClick={handlePrint} leftIcon={<i className="bi bi-printer" />}>
                    Cetak Dokumen
                </Button>
            </ModalFooter>
        </Modal>
    );
}
