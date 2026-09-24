'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';

const BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function GuruAsuhVerifyPage() {
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [verified, setVerified] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const fetchVerification = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/guru-asuh/laporan-submission/verify?id=${encodeURIComponent(id)}`);
                const json = await res.json();
                if (json.ok && json.verified && json.data) {
                    setData(json.data);
                    setVerified(true);
                } else {
                    setError(json.error || 'Dokumen laporan guru asuh tidak ditemukan atau belum disahkan.');
                    setVerified(false);
                }
            } catch (err: any) {
                setError(err.message || 'Gagal memverifikasi dokumen.');
                setVerified(false);
            } finally {
                setLoading(false);
            }
        };

        fetchVerification();
    }, [id]);

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' WIB';
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="gav-container">
            <div className="gav-card">
                {/* Header */}
                <div className="gav-header">
                    <div className="gav-logo-badge">
                        <i className="bi bi-shield-check" />
                    </div>
                    <h1 className="gav-title">Verifikasi Dokumen Resmi</h1>
                    <p className="gav-subtitle">Sistem Informasi Manajemen Guru Asuh</p>
                </div>

                {loading ? (
                    <div className="gav-loading">
                        <Spinner variant="buble" size={24} />
                        <p>Memverifikasi keaslian dokumen...</p>
                    </div>
                ) : error || !verified ? (
                    <div className="gav-error-state">
                        <div className="gav-error-icon">
                            <i className="bi bi-exclamation-octagon" />
                        </div>
                        <h2>Dokumen Tidak Terverifikasi</h2>
                        <p>{error || 'Kode verifikasi tidak cocok atau dokumen belum disahkan oleh pihak berwenang.'}</p>
                        <div className="gav-doc-id">ID: {id || '-'}</div>
                    </div>
                ) : (
                    <div className="gav-content">
                        {/* Status Banner */}
                        <div className={`gav-status-banner ${data.status === 'Approved' ? 'approved' : 'pending'}`}>
                            <i className={`bi ${data.status === 'Approved' ? 'bi-patch-check-fill' : 'bi-hourglass-split'}`} />
                            <div>
                                <strong>{data.status === 'Approved' ? 'Dokumen Resmi Terverifikasi' : 'Menunggu Pengesahan'}</strong>
                                <span>{data.status === 'Approved' ? 'Telah disahkan oleh WKM Keasramaan dan sah secara digital.' : 'Laporan telah diajukan namun belum disahkan.'}</span>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="gav-info-grid">
                            <div className="gav-info-item full">
                                <span className="gav-info-label">Nama Guru Asuh</span>
                                <span className="gav-info-value highlight">{data.nama_guru_snap || '-'}</span>
                            </div>

                            <div className="gav-info-item">
                                <span className="gav-info-label">NIP</span>
                                <span className="gav-info-value">{data.nip || '-'}</span>
                            </div>

                            <div className="gav-info-item">
                                <span className="gav-info-label">Periode Laporan</span>
                                <span className="gav-info-value">{BULAN[data.bulan - 1] || data.bulan} {data.tahun}</span>
                            </div>

                            <div className="gav-info-item">
                                <span className="gav-info-label">Total Kegiatan</span>
                                <span className="gav-info-value">{data.total_laporan ?? 0} Kegiatan</span>
                            </div>

                            <div className="gav-info-item">
                                <span className="gav-info-label">Diajukan Pada</span>
                                <span className="gav-info-value">{formatDate(data.submitted_at)}</span>
                            </div>

                            {data.status === 'Approved' && (
                                <>
                                    <div className="gav-info-item">
                                        <span className="gav-info-label">Disahkan Oleh</span>
                                        <span className="gav-info-value">{data.approved_by_name || 'WKM Keasramaan'}</span>
                                    </div>

                                    <div className="gav-info-item">
                                        <span className="gav-info-label">Waktu Pengesahan</span>
                                        <span className="gav-info-value">{formatDate(data.approved_at)}</span>
                                    </div>
                                </>
                            )}

                            <div className="gav-info-item full">
                                <span className="gav-info-label">ID Dokumen (UUID)</span>
                                <span className="gav-info-value monospace">{data.id}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        {data.pdf_url && (
                            <div className="gav-action-wrap">
                                <a
                                    href={data.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="gav-btn-primary"
                                >
                                    <i className="bi bi-file-earmark-pdf-fill" /> Unduh Dokumen PDF Resmi
                                </a>
                            </div>
                        )}

                        <div className="gav-footer-note">
                            <i className="bi bi-info-circle" /> Dokumen ini diterbitkan secara elektronik dan sah tanpa memerlukan tanda tangan basah sesuai ketentuan verifikasi dokumen digital.
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .gav-container {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }

                .gav-card {
                    width: 100%;
                    max-width: 580px;
                    background: #ffffff;
                    border-radius: 24px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
                    padding: 32px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .gav-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .gav-logo-badge {
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    border-radius: 18px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                    font-size: 1.8rem;
                    box-shadow: 0 8px 16px rgba(37, 99, 235, 0.25);
                    margin-bottom: 12px;
                }

                .gav-title {
                    font-size: 1.35rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                }

                .gav-subtitle {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-top: 4px;
                }

                .gav-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 48px 0;
                    color: #64748b;
                    font-size: 0.9rem;
                }

                .gav-error-state {
                    text-align: center;
                    padding: 32px 16px;
                }

                .gav-error-icon {
                    width: 64px;
                    height: 64px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 50%;
                    color: #dc2626;
                    font-size: 2rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 16px;
                }

                .gav-error-state h2 {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #991b1b;
                    margin: 0 0 8px;
                }

                .gav-error-state p {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin: 0 0 16px;
                    line-height: 1.5;
                }

                .gav-doc-id {
                    font-family: monospace;
                    font-size: 0.75rem;
                    color: #94a3b8;
                    background: #f8fafc;
                    padding: 6px 12px;
                    border-radius: 8px;
                    display: inline-block;
                }

                .gav-status-banner {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 18px;
                    border-radius: 14px;
                    margin-bottom: 20px;
                }

                .gav-status-banner.approved {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    color: #166534;
                }

                .gav-status-banner.pending {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    color: #1e40af;
                }

                .gav-status-banner i {
                    font-size: 1.5rem;
                    flex-shrink: 0;
                }

                .gav-status-banner strong {
                    display: block;
                    font-size: 0.9rem;
                    margin-bottom: 2px;
                }

                .gav-status-banner span {
                    display: block;
                    font-size: 0.78rem;
                    opacity: 0.9;
                }

                .gav-info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 20px;
                }

                .gav-info-item {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .gav-info-item.full {
                    grid-column: span 2;
                }

                .gav-info-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .gav-info-value {
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .gav-info-value.highlight {
                    font-size: 1.05rem;
                    font-weight: 800;
                    color: #1d4ed8;
                }

                .gav-info-value.monospace {
                    font-family: monospace;
                    font-size: 0.78rem;
                    color: #64748b;
                    word-break: break-all;
                }

                .gav-action-wrap {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 16px;
                }

                .gav-btn-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 12px;
                    font-size: 0.88rem;
                    font-weight: 700;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
                    transition: transform 0.15s, box-shadow 0.15s;
                }

                .gav-btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
                }

                .gav-footer-note {
                    font-size: 0.74rem;
                    color: #94a3b8;
                    text-align: center;
                    line-height: 1.4;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                @media (max-width: 480px) {
                    .gav-card {
                        padding: 24px 18px;
                    }
                    .gav-info-grid {
                        grid-template-columns: 1fr;
                    }
                    .gav-info-item.full {
                        grid-column: span 1;
                    }
                }
            `}</style>
        </div>
    );
}
