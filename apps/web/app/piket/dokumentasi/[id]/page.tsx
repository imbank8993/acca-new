import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import GalleryClient from './GalleryClient'
import styles from './report.module.css'

export const metadata: Metadata = {
    title: 'Laporan Piket - ACCA',
    // Tautan publik dari WhatsApp tetap tidak diindeks mesin pencari.
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ id: string }> }

export default async function DokumentasiPiketPage({ params }: Props) {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return notFound();
    const laporan = await prisma.laporan_piket.findUnique({
        where: { id },
        include: { laporan_piket_detail: true },
    });
    if (!laporan) return notFound();

    const formattedDate = new Date(laporan.tanggal).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'UTC', // PostgreSQL DATE is a calendar date, not a local timestamp.
    });
    const documents = laporan.laporan_piket_detail
        .filter(d => d.dokumentasi_url)
        .sort((a, b) => (a.nama_kelas || '').localeCompare(b.nama_kelas || '', 'id', { numeric: true }));

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true"><i className="bi bi-journal-check" /></span>ACCA<span className={styles.brandDivider} />Dokumentasi akademik</div>
                    <p className={styles.eyebrow}>LAPORAN KEGIATAN</p>
                    <h1>Laporan Piket</h1>
                    <p className={styles.date}><i className="bi bi-calendar3" aria-hidden="true" />{formattedDate}</p>
                </header>

                <section className={styles.summary} aria-label="Ringkasan laporan piket">
                    <dl className={styles.summaryGrid}>
                        <div><dt><i className="bi bi-person-badge" aria-hidden="true" />Guru piket</dt><dd>{laporan.nama_guru_piket || 'Belum dicantumkan'}</dd></div>
                        <div><dt><i className="bi bi-clock" aria-hidden="true" />Jam pelajaran</dt><dd>Jam {laporan.jam_ke || '—'}</dd></div>
                        <div><dt><i className="bi bi-images" aria-hidden="true" />Dokumentasi</dt><dd>{documents.length}<span className={styles.unit}>foto kelas</span></dd></div>
                    </dl>
                    {laporan.keterangan && <div className={styles.note}><h2>Catatan piket</h2><p>{laporan.keterangan}</p></div>}
                </section>

                <main aria-labelledby="documentation-title">
                    <div className={styles.sectionHeading}>
                        <div><h2 id="documentation-title">Dokumentasi kelas <span>{documents.length}</span></h2><p>Rekaman kegiatan kelas selama pelaksanaan piket.</p></div>
                        {documents.length > 0 && <span className={styles.hint}><i className="bi bi-arrows-fullscreen" aria-hidden="true" />Ketuk foto untuk memperbesar</span>}
                    </div>
                    {documents.length ? <GalleryClient detailsWithDocs={documents} /> : <div className={styles.empty}><i className="bi bi-image" aria-hidden="true" /><h3>Belum ada dokumentasi</h3><p>Foto dokumentasi belum dilampirkan pada laporan piket ini.</p></div>}
                </main>
                <footer className={styles.footer}><strong>ACCA</strong><span>Academic Center &amp; Administration</span></footer>
            </div>
        </div>
    );
}
