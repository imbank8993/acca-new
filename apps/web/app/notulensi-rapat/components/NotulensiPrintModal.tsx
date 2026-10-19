'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { swalSuccess, swalError } from '@/lib/swal-premium';
import { type NotulensiItem } from './NotulensiModal';

interface ProfilSekolah {
    nama?: string | null;
    jenjang?: string | null;
    jenis?: string | null;
    alamat?: string | null;
    desa_kelurahan?: string | null;
    kecamatan?: string | null;
    kabupaten_kota?: string | null;
    provinsi?: string | null;
    kode_pos?: string | null;
    telepon?: string | null;
    email?: string | null;
    website?: string | null;
    logo_url?: string | null;
    kepala_sekolah_nama?: string | null;
    kepala_sekolah_nip?: string | null;
}

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

function formatDateShortIndo(dateStr?: string) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function kotaKedudukan(profil: ProfilSekolah | null | undefined): string {
    const raw = (profil?.kabupaten_kota || '').trim();
    if (!raw) return 'Gowa';
    return raw.replace(/^(kabupaten|kota)\s+/i, '').trim() || 'Gowa';
}

function buildWhatsAppMessage(item: NotulensiItem): string {
    let msg = `*NOTULENSI RAPAT*\n`;
    msg += `*${item.agenda}*\n\n`;
    msg += `📅 *Hari / Tanggal:* ${formatDateIndo(item.tanggal)}\n`;
    if (item.waktu_mulai) {
        msg += `⏰ *Waktu:* ${item.waktu_mulai} WITA${item.waktu_selesai ? ` - ${item.waktu_selesai} WITA` : ''}\n`;
    }
    if (item.lokasi) {
        msg += `📍 *Tempat:* ${item.lokasi}\n`;
    }
    if (item.pimpinan_rapat) {
        msg += `👤 *Pimpinan Rapat:* ${item.pimpinan_rapat}\n`;
    }
    if (item.notulis) {
        msg += `✍️ *Notulis:* ${item.notulis}\n`;
    }
    if (item.peserta) {
        msg += `👥 *Peserta:* ${item.peserta}\n`;
    }

    msg += `\n*HASIL RAPAT & TINDAK LANJUT:*\n`;
    if (item.poin_poin && item.poin_poin.length > 0) {
        item.poin_poin.forEach((p, idx) => {
            msg += `${idx + 1}. ${p.teks}\n`;
            const metaParts: string[] = [];
            if (p.status) metaParts.push(`Status: ${p.status}`);
            if (p.pic) metaParts.push(`PIC: ${p.pic}`);
            if (p.tenggat) metaParts.push(`Tenggat: ${p.tenggat}`);
            if (metaParts.length > 0) {
                msg += `   └─ _(${metaParts.join(' | ')})_\n`;
            }
        });
    } else {
        msg += `(Tidak ada catatan rincian poin)\n`;
    }

    if (item.catatan) {
        msg += `\n*Catatan Tambahan:*\n${item.catatan}\n`;
    }

    return msg;
}

export default function NotulensiPrintModal({ isOpen, onClose, data }: NotulensiPrintModalProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [profil, setProfil] = useState<ProfilSekolah | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function fetchProfil() {
            try {
                const res = await fetch('/api/profil-sekolah');
                const json = await res.json();
                if (mounted && json?.ok && json?.data) {
                    setProfil(json.data);
                }
            } catch (err) {
                console.error('Failed to load profil sekolah:', err);
            }
        }
        fetchProfil();
        return () => {
            mounted = false;
        };
    }, []);

    if (!isOpen || !data) return null;

    const handlePrint = () => {
        if (!sheetRef.current) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            window.print();
            return;
        }

        const styles = `
            @page {
                size: A4 portrait;
                margin: 12mm 15mm 15mm 15mm;
            }
            *, *::before, *::after {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            html, body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 10pt;
                line-height: 1.4;
                color: #000000;
                background: #ffffff;
                width: 100%;
                margin: 0;
                padding: 0;
            }
            .nr-kop {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 0;
            }
            .nr-kop-logo {
                width: 72px;
                height: 72px;
                object-fit: contain;
                flex-shrink: 0;
            }
            .nr-kop-text {
                flex: 1;
                text-align: center;
                padding-right: 10px;
            }
            .nr-kop-kemenag {
                font-size: 10.5pt;
                font-weight: bold;
                text-transform: uppercase;
                line-height: 1.25;
            }
            .nr-kop-nama {
                font-size: 12.5pt;
                font-weight: bold;
                text-transform: uppercase;
                line-height: 1.25;
                margin: 2px 0;
                letter-spacing: 0.4px;
            }
            .nr-kop-alamat, .nr-kop-kontak {
                font-size: 8pt;
                color: #222;
                line-height: 1.25;
                margin-top: 1px;
            }
            .nr-kop-rule-thick {
                border-top: 2.5px solid #000;
                margin-top: 6px;
            }
            .nr-kop-rule-thin {
                border-top: 1px solid #000;
                margin-top: 2px;
                margin-bottom: 12px;
            }
            .nr-print-title {
                text-align: center;
                margin: 6px 0 2px;
            }
            .nr-print-title h2 {
                font-size: 12pt;
                font-weight: bold;
                text-transform: uppercase;
                text-decoration: underline;
                text-underline-offset: 3px;
                letter-spacing: 0.5px;
                margin: 0;
            }
            .nr-print-subtitle {
                font-size: 9pt;
                font-style: italic;
                color: #444;
                margin-top: 2px;
                margin-bottom: 12px;
                text-align: center;
            }
            .nr-print-meta-table {
                width: 100%;
                margin-bottom: 10px;
                font-size: 10pt;
                border-collapse: collapse;
            }
            .nr-print-meta-table td {
                padding: 2px 0;
                vertical-align: top;
            }
            .nr-print-meta-table td.meta-label {
                width: 155px;
                white-space: nowrap;
            }
            .nr-print-meta-table td.meta-sep {
                width: 16px;
                text-align: center;
            }
            .nr-print-meta-table td.meta-val {
                word-break: break-word;
            }
            .nr-print-section-heading {
                font-size: 10pt;
                font-weight: bold;
                margin: 10px 0 6px;
                text-transform: uppercase;
            }
            .nr-print-poin-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 14px;
                font-size: 9pt;
            }
            .nr-print-poin-table th,
            .nr-print-poin-table td {
                border: 1px solid #000;
                padding: 5px 7px;
                vertical-align: top;
            }
            .nr-print-poin-table th {
                background-color: #f1f5f9;
                font-weight: bold;
                text-align: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .nr-print-poin-table tbody tr {
                page-break-inside: avoid;
                break-inside: avoid-page;
            }
            .nr-print-note {
                font-size: 8pt;
                font-style: italic;
                color: #4b5563;
                margin-top: 2px;
            }
            .nr-print-catatan-tambahan {
                margin-bottom: 12px;
                font-size: 9.5pt;
            }
            .nr-print-sign-row {
                display: flex;
                justify-content: space-between;
                margin-top: 18px;
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .nr-print-sign-col {
                text-align: center;
                width: 220px;
                font-size: 10pt;
            }
            .nr-print-sign-space {
                height: 48px;
            }
            .nr-print-sign-name {
                font-weight: bold;
                text-decoration: underline;
            }
        `;

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Notulensi - ${data.agenda || 'Rapat'}</title>
                <style>${styles}</style>
            </head>
            <body>
                <div class="nr-print-sheet">
                    ${sheetRef.current.innerHTML}
                </div>
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
                try {
                    document.body.removeChild(iframe);
                } catch {}
            }, 2000);
        }, 300);
    };

    // Susun data KOP persis seperti Laporan Guru Asuh / LCKH
    const p = profil || {};
    const namaMadrasah = (p.nama || 'MAN Insan Cendekia Gowa').toUpperCase();
    const rawKab = p.kabupaten_kota || 'Gowa';
    const kabLabel = /^(kabupaten|kota)\s+/i.test(rawKab) ? rawKab.toUpperCase() : `KABUPATEN ${rawKab.toUpperCase()}`;

    const alamatParts = [
        p.alamat || 'Jl. Pendidikan Desa Belapunrangan',
        p.desa_kelurahan ? `Kel./Desa ${p.desa_kelurahan}` : '',
        p.kecamatan ? `Kec. ${p.kecamatan}` : 'Kec. Parangloe',
        p.kabupaten_kota ? (/^(kabupaten|kota)\s+/i.test(p.kabupaten_kota) ? p.kabupaten_kota : `Kab. ${p.kabupaten_kota}`) : 'Kab. Gowa',
        p.provinsi || 'Sulawesi Selatan',
        p.kode_pos || '92173',
    ].filter(Boolean);
    const alamatLine = alamatParts.join(', ');

    const kontakParts = [
        p.telepon ? `Telp. ${p.telepon}` : 'Telp. 085173279846',
        p.email ? `Pos-el: ${p.email}` : 'Pos-el: insancendekiagowa@gmail.com',
        p.website ? `Laman: ${p.website}` : 'Laman: icgowa.sch.id',
    ].filter(Boolean);
    const kontakLine = kontakParts.join(' · ');

    const getPdfConfig = () => {
        const cleanAgenda = (data.agenda || 'Rapat')
            .replace(/[^a-zA-Z0-9_\-\s]/g, '')
            .trim()
            .replace(/\s+/g, '_');
        const fileName = `Notulensi_${cleanAgenda}_${data.tanggal || ''}.pdf`;

        const opt = {
            margin: [8, 10, 8, 10] as [number, number, number, number],
            filename: fileName,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true,
                backgroundColor: '#ffffff',
                windowWidth: 794,
                scrollY: 0,
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait' as const,
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };

        return { fileName, opt };
    };

    const handleDownloadPdf = async () => {
        if (!sheetRef.current) return;
        setIsDownloading(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const { fileName, opt } = getPdfConfig();

            await html2pdf().from(sheetRef.current).set(opt).save();
            swalSuccess('Berhasil!', `Dokumen PDF "${fileName}" berhasil diunduh.`);
        } catch (err: any) {
            console.error('Error generating PDF:', err);
            swalError('Gagal Mengunduh PDF', err?.message || 'Terjadi kesalahan saat memproses dokumen PDF.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShare = async () => {
        if (!sheetRef.current) return;
        setIsSharing(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const { fileName, opt } = getPdfConfig();

            const pdfBlob: Blob = await html2pdf().from(sheetRef.current).set(opt).outputPdf('blob');
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            if (
                typeof navigator !== 'undefined' &&
                navigator.canShare &&
                navigator.canShare({ files: [pdfFile] })
            ) {
                await navigator.share({
                    files: [pdfFile],
                    title: `Notulensi Rapat: ${data.agenda}`,
                    text: `Berikut notulensi rapat "${data.agenda}" tanggal ${formatDateIndo(data.tanggal)}.`,
                });
                return;
            }

            setShowShareDialog(true);
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            console.error('Error sharing PDF:', err);
            setShowShareDialog(true);
        } finally {
            setIsSharing(false);
        }
    };

    const handleShareWhatsApp = () => {
        const text = buildWhatsAppMessage(data);
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        setShowShareDialog(false);
    };

    const handleCopySummary = async () => {
        try {
            const text = buildWhatsAppMessage(data);
            await navigator.clipboard.writeText(text);
            swalSuccess('Tersalin!', 'Ringkasan notulensi rapat berhasil disalin ke clipboard.');
            setShowShareDialog(false);
        } catch (err) {
            swalError('Gagal Menyalin', 'Tidak dapat menyalin ke clipboard.');
        }
    };

    return (
        <>
            <Modal
                open={isOpen}
                onClose={onClose}
                size="xl"
                title="Pratinjau Cetak &amp; PDF Notulensi Rapat"
                icon="printer-fill"
            >
                <ModalBody style={{ padding: 0 }}>
                    <div className="nr-print-modal-container">
                        <div ref={sheetRef} className="nr-printable-area nr-print-sheet">
                            {/* KOP Surat Resmi (Identik dengan Laporan Guru Asuh / LCKH) */}
                            <div className="nr-kop">
                                <img
                                    src="/logo-madrasah.png"
                                    className="nr-kop-logo"
                                    alt="Logo Kemenag / Madrasah"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                        if (p.logo_url) {
                                            (e.target as HTMLImageElement).src = p.logo_url;
                                        }
                                    }}
                                />
                                <div className="nr-kop-text">
                                    <div className="nr-kop-kemenag">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
                                    <div className="nr-kop-kemenag">KANTOR KEMENTERIAN AGAMA {kabLabel}</div>
                                    <div className="nr-kop-nama">{namaMadrasah}</div>
                                    <div className="nr-kop-alamat">{alamatLine}</div>
                                    <div className="nr-kop-kontak">{kontakLine}</div>
                                </div>
                            </div>
                            <div className="nr-kop-rule-thick"></div>
                            <div className="nr-kop-rule-thin"></div>

                            {/* Judul Dokumen */}
                            <div className="nr-print-title">
                                <h2>NOTULENSI RAPAT</h2>
                                <div className="nr-print-subtitle">
                                    Nomor / Kode Arsip: NR-{data.id || 'DRAFT'}-{data.tanggal ? data.tanggal.replace(/-/g, '') : ''}
                                </div>
                            </div>

                            {/* Metadata Rapat (Tabel Seimbang) */}
                            <table className="nr-print-meta-table">
                                <tbody>
                                    <tr>
                                        <td className="meta-label">Agenda Rapat</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val"><strong>{data.agenda}</strong></td>
                                    </tr>
                                    <tr>
                                        <td className="meta-label">Hari / Tanggal</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val">{formatDateIndo(data.tanggal)}</td>
                                    </tr>
                                    <tr>
                                        <td className="meta-label">Waktu Pelaksanaan</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val">
                                            {data.waktu_mulai ? `${data.waktu_mulai} WITA ${data.waktu_selesai ? `- ${data.waktu_selesai} WITA` : ''}` : 'Sesuai Jadwal'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="meta-label">Tempat / Ruangan</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val">{data.lokasi || 'Lingkungan Madrasah'}</td>
                                    </tr>
                                    <tr>
                                        <td className="meta-label">Pimpinan Rapat</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val">{data.pimpinan_rapat || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="meta-label">Notulis</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val">{data.notulis || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="meta-label">Peserta Rapat</td>
                                        <td className="meta-sep">:</td>
                                        <td className="meta-val">{data.peserta || 'Seluruh Dewan Guru & Tenaga Kependidikan'}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Poin-Poin Hasil Rapat & Tindak Lanjut */}
                            <div className="nr-print-section-heading">
                                HASIL RAPAT DAN TINDAK LANJUT:
                            </div>

                            <table className="nr-print-poin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '38px' }}>No</th>
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
                                                        <div className="nr-print-note">
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
                                            <td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', padding: '12px' }}>
                                                Tidak ada catatan rincian poin.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {data.catatan && (
                                <div className="nr-print-catatan-tambahan">
                                    <strong>Catatan Tambahan:</strong>
                                    <p style={{ margin: '2px 0 0', lineHeight: 1.45 }}>{data.catatan}</p>
                                </div>
                            )}

                            {/* Kolom Tanda Tangan */}
                            <div className="nr-print-sign-row">
                                <div className="nr-print-sign-col">
                                    <p style={{ margin: 0 }}>Notulis,</p>
                                    <div className="nr-print-sign-space"></div>
                                    <p className="nr-print-sign-name" style={{ margin: 0 }}>
                                        {data.notulis || '( .......................................... )'}
                                    </p>
                                </div>
                                <div className="nr-print-sign-col">
                                    <p style={{ margin: 0 }}>{kotaKedudukan(profil)}, {formatDateShortIndo(data.tanggal)}</p>
                                    <p style={{ margin: '2px 0 0' }}>Pimpinan Rapat,</p>
                                    <div className="nr-print-sign-space"></div>
                                    <p className="nr-print-sign-name" style={{ margin: 0 }}>
                                        {data.pimpinan_rapat || '( .......................................... )'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="no-print">
                    <div className="nr-print-modal-footer">
                        <Button variant="secondary" onClick={onClose}>
                            Tutup
                        </Button>
                        <div className="nr-print-modal-actions">
                            <Button
                                variant="secondary"
                                onClick={handleShare}
                                isLoading={isSharing}
                                leftIcon={<i className="bi bi-share-fill" />}
                                title="Bagikan dokumen PDF atau ringkasan rapat"
                            >
                                Bagikan
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleDownloadPdf}
                                isLoading={isDownloading}
                                leftIcon={<i className="bi bi-file-earmark-pdf-fill" />}
                                title="Unduh langsung sebagai berkas PDF A4"
                            >
                                Unduh PDF
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handlePrint}
                                leftIcon={<i className="bi bi-printer-fill" />}
                                title="Cetak fisik atau simpan via browser"
                            >
                                Cetak
                            </Button>
                        </div>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Modal Dialog Opsi Berbagi (Fallback Share) */}
            {showShareDialog && (
                <Modal
                    open={showShareDialog}
                    onClose={() => setShowShareDialog(false)}
                    size="sm"
                    title="Bagikan Notulensi Rapat"
                    icon="share-fill"
                >
                    <ModalBody>
                        <div className="nr-share-options">
                            <button
                                type="button"
                                className="nr-share-btn"
                                onClick={handleShareWhatsApp}
                            >
                                <div className="nr-share-btn-icon wa">
                                    <i className="bi bi-whatsapp" />
                                </div>
                                <div className="nr-share-btn-content">
                                    <span className="nr-share-btn-title">Bagikan ke WhatsApp</span>
                                    <span className="nr-share-btn-desc">Kirim ringkasan lengkap agenda dan poin tindak lanjut ke kontak / grup WA</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                className="nr-share-btn"
                                onClick={handleCopySummary}
                            >
                                <div className="nr-share-btn-icon copy">
                                    <i className="bi bi-clipboard-check-fill" />
                                </div>
                                <div className="nr-share-btn-content">
                                    <span className="nr-share-btn-title">Salin Ringkasan Teks</span>
                                    <span className="nr-share-btn-desc">Salin isi notulensi ke clipboard untuk ditempel di email atau chat lain</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                className="nr-share-btn"
                                onClick={() => {
                                    setShowShareDialog(false);
                                    handleDownloadPdf();
                                }}
                            >
                                <div className="nr-share-btn-icon pdf">
                                    <i className="bi bi-file-earmark-pdf-fill" />
                                </div>
                                <div className="nr-share-btn-content">
                                    <span className="nr-share-btn-title">Unduh File PDF</span>
                                    <span className="nr-share-btn-desc">Simpan berkas PDF ke perangkat untuk dilampirkan secara manual</span>
                                </div>
                            </button>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="secondary" onClick={() => setShowShareDialog(false)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
        </>
    );
}
