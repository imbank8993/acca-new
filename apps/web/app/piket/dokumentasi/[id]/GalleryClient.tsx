'use client'

import { useMemo, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { getProxiedImageUrl } from '@/lib/image-utils';
import styles from './report.module.css';

type Documentation = {
    id: string | number;
    dokumentasi_url: string | null;
    nama_kelas: string | null;
    nama_guru: string | null;
    guru_pengganti?: string | null;
    status_kehadiran?: string | null;
    status_tambahan_1?: string | null;
    status_tambahan_2?: string | null;
    status_tambahan_3?: string | null;
    keterangan?: string | null;
};

export default function GalleryClient({ detailsWithDocs }: { detailsWithDocs: Documentation[] }) {
    const [index, setIndex] = useState(-1);
    // Stable URLs keep server/client markup identical and avoid reloading every
    // thumbnail whenever the lightbox opens or changes photos.
    const slides = useMemo(() => detailsWithDocs.map(detail => ({
        src: getProxiedImageUrl(detail.dokumentasi_url, false),
        alt: `Dokumentasi kelas ${detail.nama_kelas || 'tanpa nama'}`,
    })), [detailsWithDocs]);
    return <>
        <div className={styles.gallery}>
            {detailsWithDocs.map((detail, photoIndex) => {
                const status = detail.status_kehadiran?.trim();
                const normalized = status?.toLowerCase();
                const tone = normalized === 'hadir' || normalized === 'sesuai' ? styles.success : normalized === 'izin' || normalized === 'tugas' ? styles.warning : normalized === 'sakit' ? styles.info : styles.neutral;
                const notes = [detail.status_tambahan_1, detail.status_tambahan_2, detail.status_tambahan_3, detail.keterangan].filter(Boolean).join(', ');
                return <article className={styles.card} key={detail.id}>
                    <button type="button" className={styles.photoButton} onClick={() => setIndex(photoIndex)} aria-label={`Perbesar dokumentasi kelas ${detail.nama_kelas || 'tanpa nama'}`}>
                        {/* Foto berasal dari dokumentasi pengguna melalui proxy gambar aplikasi. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={slides[photoIndex].src} alt={slides[photoIndex].alt} loading="lazy" decoding="async" />
                        <span className={styles.zoomIcon} aria-hidden="true"><i className="bi bi-arrows-fullscreen" /></span>
                    </button>
                    <div className={styles.cardBody}>
                        <div className={styles.cardHeading}><h3>{detail.nama_kelas || 'Kelas belum dicantumkan'}</h3>{status && <span className={`${styles.badge} ${tone}`}>{status}</span>}</div>
                        <dl className={styles.teacher}><div><dt>Guru utama</dt><dd>{detail.nama_guru || 'Belum dicantumkan'}</dd></div>
                            {detail.guru_pengganti && detail.guru_pengganti !== detail.nama_guru && <div><dt>Guru pengganti</dt><dd>{detail.guru_pengganti}</dd></div>}
                        </dl>
                        {notes && <p className={styles.cardNote}>{notes}</p>}
                    </div>
                </article>;
            })}
        </div>
        <Lightbox open={index >= 0} index={index} close={() => setIndex(-1)} plugins={[Zoom]} slides={slides} carousel={{ finite: true }} labels={{ Close: 'Tutup', Previous: 'Foto sebelumnya', Next: 'Foto berikutnya', 'Zoom in': 'Perbesar', 'Zoom out': 'Perkecil' }} />
    </>;
}
