import type { Metadata } from 'next';
import { nestFetch } from '@/lib/nest-api';
import PdfHashCheck from './PdfHashCheck';
import '../verifikasi.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Verifikasi Rekapan Pembayaran',
    robots: { index: false, follow: false },
};

type Snapshot = {
    code: string; month: number; year: number; category: string; amount: number; entries: number;
    issuedAt: string; issuerName: string; proofs: number; missingAmounts: number; missingProofs: number;
    unavailableProofs: number; pdfHash: string;
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KATEGORI: Record<string, string> = { ALL: 'Semua pembayaran rutin', GURU_ASUH: 'Guru Asuh', KLINIK: 'Klinik Pembelajaran', EKSKUL: 'Ekstrakurikuler' };
const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const waktu = (v: string) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime())
        ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'long', timeStyle: 'short' }).format(d) + ' WITA'
        : '-';
};

/**
 * Tujuan barcode pada PDF Rekapan Pembayaran Bulanan. Halaman ini publik
 * (dibuka lewat pemindai, tanpa login) dan hanya menampilkan ringkasan dokumen
 * yang disimpan saat cetak: tidak ada nama penerima, rekening, atau bukti.
 */
export default async function VerifikasiRekapanPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const result = /^[0-9a-f]{48}$/.test(token || '') ? await nestFetch(`/payments/report-verifications/${token}`) : null;
    const doc: Snapshot | null = result?.status === 200 && result.body?.verified ? result.body.document : null;
    const offline = !!result && result.status !== 200 && result.status !== 404;
    const incomplete = doc && (doc.missingAmounts > 0 || doc.missingProofs > 0 || doc.unavailableProofs > 0);

    return (
        <main className="rpv">
            <section className="rpv-card" aria-labelledby="rpv-title">
                <header className="rpv-head">
                    <i className={`bi ${doc ? 'bi-patch-check-fill' : 'bi-exclamation-octagon'}`} aria-hidden="true" />
                    <div>
                        <h1 id="rpv-title">Verifikasi Rekapan Pembayaran</h1>
                        <p>MAN Insan Cendekia Gowa · ACCA</p>
                    </div>
                </header>

                {doc ? <>
                    <div className="rpv-status rpv-status--ok" role="status">
                        <strong>Dokumen terdaftar.</strong> Rekapan ini diterbitkan melalui aplikasi ACCA.
                    </div>
                    <dl className="rpv-list">
                        <div><dt>Kode dokumen</dt><dd className="rpv-mono">{doc.code}</dd></div>
                        <div><dt>Periode kegiatan</dt><dd>{BULAN[doc.month - 1]} {doc.year}</dd></div>
                        <div><dt>Kategori</dt><dd>{KATEGORI[doc.category] || doc.category}</dd></div>
                        <div><dt>Jumlah pembayaran</dt><dd>{doc.entries} baris</dd></div>
                        <div><dt>Total nominal tercatat</dt><dd>{rupiah(doc.amount)}</dd></div>
                        <div><dt>Lampiran bukti</dt><dd>{doc.proofs} berkas</dd></div>
                        <div><dt>Dicetak oleh</dt><dd>{doc.issuerName}</dd></div>
                        <div><dt>Waktu cetak</dt><dd>{waktu(doc.issuedAt)}</dd></div>
                    </dl>
                    {incomplete && (
                        <p className="rpv-note">
                            Saat dicetak, dokumen ini tercatat belum lengkap: {doc.missingAmounts} pembayaran tanpa nominal tersimpan,{' '}
                            {doc.missingProofs} pembayaran tanpa bukti, dan {doc.unavailableProofs} lampiran tidak dapat dimuat.
                        </p>
                    )}
                    <PdfHashCheck expected={doc.pdfHash} />
                    <p className="rpv-small">Halaman ini hanya menampilkan ringkasan dokumen. Rincian penerima dan bukti transfer hanya dapat dilihat petugas di aplikasi.</p>
                </> : (
                    <div className="rpv-status rpv-status--bad" role="alert">
                        {offline
                            ? <><strong>Layanan verifikasi sedang tidak dapat dihubungi.</strong> Silakan coba beberapa saat lagi.</>
                            : <><strong>Dokumen tidak terdaftar.</strong> Kode verifikasi tidak dikenali. Pastikan barcode dipindai dari rekapan asli, atau hubungi Bendahara Komite.</>}
                    </div>
                )}
            </section>
        </main>
    );
}
