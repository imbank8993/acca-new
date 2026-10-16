'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX, FileText, Download } from 'lucide-react';
import type { Asset } from '@/lib/e-sertifikat/model';
import '../../e-sertifikat.css';
export default function CertificateVerification({ token }: { token: string }) {
    const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setData(null);
        fetch(`/api/public/e-sertifikat/${encodeURIComponent(token)}`, { cache: 'no-store', signal: controller.signal })
            .then(async response => { const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error || 'Verifikasi gagal'); return body.data; })
            .then(result => { if (!controller.signal.aborted) setData(result); })
            .catch(e => { if (!controller.signal.aborted) setError(e.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [token, retry]);
    const fileUrl = (asset: Asset) => `/api/public/e-sertifikat/${encodeURIComponent(token)}/files/${asset.id}`;
    const date = (value: string) => new Date(value).toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'Asia/Makassar' });
    return <main className="ec-public"><div className="ec-root">
        <div className="ec-heading"><div><h2>ACCA · Verifikasi E-Sertifikat</h2><p>Pemeriksaan keaslian sertifikat kegiatan.</p></div></div>
        {loading ? <section className="ec-panel" role="status">Memeriksa sertifikat…</section> : error ? <section className="ec-panel"><div className="ec-verification-status ec-verification-status--revoked"><ShieldX size={40} /><h1>Sertifikat belum dapat diverifikasi</h1></div><p role="alert">{error}</p><button className="ec-button" onClick={() => setRetry(retry + 1)}>Coba lagi</button></section> : data && <>
            <section className="ec-panel"><div className={`ec-verification-status${data.status === 'revoked' ? ' ec-verification-status--revoked' : ''}`}>{data.status === 'revoked' ? <ShieldX size={42} /> : <ShieldCheck size={42} />}<div><h1>{data.status === 'revoked' ? 'Sertifikat dicabut' : 'Sertifikat terverifikasi'}</h1><span className={`ec-pill ec-pill--${data.status}`}>{data.status === 'revoked' ? 'Tidak berlaku' : 'Terbit dan aktif'}</span></div></div>
                <dl className="ec-public-dl"><dt>Nomor sertifikat</dt><dd><strong>{data.certificate_number}</strong></dd>
                    {data.status === 'revoked' ? <><dt>Tanggal pencabutan</dt><dd>{date(data.revoked_at)}</dd><dt>Alasan</dt><dd>{data.revoke_reason}</dd></> : <>
                        <dt>Nama penerima</dt><dd><strong>{data.name}</strong></dd><dt>Asal sekolah / instansi</dt><dd>{data.institution || '-'}</dd>
                        <dt>Kegiatan</dt><dd>{data.event.title}</dd><dt>Penyelenggara</dt><dd>{data.event.organizer}</dd><dt>Waktu kegiatan</dt><dd>{date(data.event.start_date)}{data.event.end_date !== data.event.start_date ? ` – ${date(data.event.end_date)}` : ''}</dd>
                        {!!data.signers?.length && <><dt>Penandatangan</dt><dd>{data.signers.map((signer: { name: string; title: string }, index: number) => <div key={index}><strong>{signer.name}</strong><br />{signer.title}</div>)}</dd></>}
                        <dt>Lokasi</dt><dd>{data.event.location || '-'}</dd><dt>Tanggal terbit</dt><dd>{date(data.issued_at)}</dd><dt>Keterangan</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{data.event.description || '-'}</dd>
                    </>}
                </dl></section>
            {data.status !== 'revoked' && <>{(['documentation', 'correspondence'] as const).map(kind => {
                const assets = (data.assets as Asset[]).filter(asset => asset.kind === kind);
                return <section className="ec-panel" key={kind}><h2>{kind === 'documentation' ? 'Dokumentasi kegiatan' : 'Dokumen persuratan'}</h2>{!assets.length ? <p>Belum ada dokumen yang dipublikasikan.</p> : <div className="ec-gallery">{assets.map(asset => <div key={asset.id}>
                    {asset.mime.startsWith('image/') ? <a href={fileUrl(asset)} target="_blank" rel="noopener noreferrer"><img src={fileUrl(asset)} loading="lazy" alt={asset.filename} /></a> : <FileText size={36} />}
                    <a className="ec-link" href={fileUrl(asset)} target="_blank" rel="noopener noreferrer"><Download size={14} style={{ display: 'inline', marginRight: 6 }} />{asset.filename}</a></div>)}</div>}</section>;
            })}</>}
        </>}
        <p className="ec-muted">Verifikasi dilakukan terhadap catatan penerbitan sertifikat ACCA.</p>
    </div></main>;
}
