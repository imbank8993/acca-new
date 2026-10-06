'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';

interface VerificationData {
    bulan: number;
    tahun: number;
    namaBulan: string;
    periode: string;
    kodeVerifikasi: string;
    jumlahSesi: number;
    jumlahGuru: number;
    jumlahFoto: number;
    disahkanOleh: string;
    sekolah: string;
    logoUrl?: string | null;
}

function RekapVerifyContent() {
    const searchParams = useSearchParams();
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const sah = searchParams.get('sah') ?? '1';

    const [loading, setLoading] = useState(true);
    const [verified, setVerified] = useState(false);
    const [data, setData] = useState<VerificationData | null>(null);
    const [htmlDoc, setHtmlDoc] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!bulan || !tahun) {
            setError('Parameter verifikasi tidak lengkap (bulan dan tahun diperlukan).');
            setLoading(false);
            return;
        }

        const verifyDoc = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/klinik/verify/rekap?bulan=${encodeURIComponent(bulan)}&tahun=${encodeURIComponent(tahun)}&sah=${encodeURIComponent(sah)}`
                );
                const json = await res.json();
                if (json.ok && json.verified && json.data) {
                    setData(json.data);
                    setHtmlDoc(json.html || '');
                    setVerified(true);
                } else {
                    setError(json.error || 'Dokumen rekapitulasi tidak ditemukan atau belum disahkan.');
                    setVerified(false);
                }
            } catch (err: any) {
                setError(err.message || 'Gagal memverifikasi dokumen.');
                setVerified(false);
            } finally {
                setLoading(false);
            }
        };

        verifyDoc();
    }, [bulan, tahun, sah]);

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
        } else if (htmlDoc) {
            const printWin = window.open('', '_blank');
            if (printWin) {
                printWin.document.write(htmlDoc);
                printWin.document.close();
                printWin.focus();
                printWin.print();
            }
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #e2e8f0 100%)',
            padding: '24px 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
                {/* Header Card */}
                <div style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                    border: '1px solid #e2e8f0',
                    marginBottom: 20
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{
                            width: 52,
                            height: 52,
                            borderRadius: 12,
                            background: '#dcfce7',
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 26
                        }}>
                            <i className="bi bi-shield-check" />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                Verifikasi Dokumen Resmi
                            </h1>
                            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                Rekapitulasi Klinik Pembelajaran — {data?.sekolah || 'Madrasah'}
                            </p>
                        </div>
                        {verified && (
                            <button
                                onClick={handlePrint}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '10px 18px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
                                }}
                            >
                                <i className="bi bi-printer-fill" /> Cetak / Unduh Dokumen
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Spinner variant="buble" size={28} />
                            <p style={{ marginTop: 12, color: '#64748b', fontSize: '0.9rem' }}>
                                Memverifikasi keabsahan dokumen rekapitulasi...
                            </p>
                        </div>
                    ) : error || !verified ? (
                        <div style={{
                            marginTop: 20,
                            padding: 16,
                            borderRadius: 12,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            color: '#991b1b'
                        }}>
                            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.6rem' }} />
                            <div>
                                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Dokumen Tidak Terverifikasi</strong>
                                <span style={{ fontSize: '0.85rem' }}>{error || 'Data rekap tidak cocok atau belum disahkan.'}</span>
                            </div>
                        </div>
                    ) : data && (
                        <div style={{ marginTop: 20 }}>
                            {/* Validation Status Banner */}
                            <div style={{
                                padding: '14px 18px',
                                borderRadius: 12,
                                background: '#f0fdf4',
                                border: '1.5px solid #86efac',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                marginBottom: 18
                            }}>
                                <i className="bi bi-patch-check-fill" style={{ fontSize: '1.8rem', color: '#16a34a' }} />
                                <div>
                                    <strong style={{ display: 'block', color: '#15803d', fontSize: '1rem' }}>
                                        DOKUMEN TELAH DISAHKAN SECARA RESMI
                                    </strong>
                                    <span style={{ fontSize: '0.85rem', color: '#166534' }}>
                                        Disahkan oleh: <strong>{data.disahkanOleh}</strong> &middot; Keaslian dokumen terjamin secara digital
                                    </span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 12,
                                fontSize: '0.85rem'
                            }}>
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Jenis Dokumen</span>
                                    <strong style={{ color: '#0f172a' }}>Rekap Pelaksanaan Klinik</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Periode Kegiatan</span>
                                    <strong style={{ color: '#0f172a' }}>{data.periode}</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Kode Verifikasi</span>
                                    <strong style={{ color: '#2563eb', fontFamily: 'monospace' }}>{data.kodeVerifikasi}</strong>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Rincian Pelaksanaan</span>
                                    <strong style={{ color: '#0f172a' }}>{data.jumlahGuru} Guru &middot; {data.jumlahSesi} Sesi</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Document Preview Section */}
                {verified && htmlDoc && (
                    <div style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '14px 20px',
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="bi bi-file-earmark-richtext-fill" style={{ color: '#2563eb' }} />
                                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                                    Pratinjau Dokumen Resmi (Format A4)
                                </strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    style={{
                                        background: 'none',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        fontSize: '0.78rem',
                                        color: '#475569',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {showPreview ? 'Sembunyikan Pratinjau' : 'Tampilkan Pratinjau'}
                                </button>
                                <button
                                    onClick={handlePrint}
                                    style={{
                                        background: '#2563eb',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '4px 12px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <i className="bi bi-printer" style={{ marginRight: 4 }} /> Cetak
                                </button>
                            </div>
                        </div>

                        {showPreview && (
                            <div style={{ padding: '16px', background: '#e2e8f0' }}>
                                <div style={{
                                    maxWidth: 820,
                                    margin: '0 auto',
                                    background: '#fff',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                    borderRadius: 4,
                                    overflow: 'hidden'
                                }}>
                                    <iframe
                                        ref={iframeRef}
                                        srcDoc={htmlDoc}
                                        title="Pratinjau Rekap Bulanan Klinik"
                                        style={{
                                            width: '100%',
                                            height: 900,
                                            border: 'none',
                                            display: 'block'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function RekapVerifyPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner variant="buble" size={32} />
            </div>
        }>
            <RekapVerifyContent />
        </Suspense>
    );
}
