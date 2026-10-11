'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ResolvedShare } from '@/lib/informasi/share';
import type { InformasiDoc } from '@/lib/informasi/docs';
import './info-link.css';

const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });

function fileIconInfo(fileName: string) {
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    switch (ext) {
        case 'pdf': return { icon: 'bi-file-earmark-pdf-fill', color: '#0284c7' };
        case 'doc':
        case 'docx': return { icon: 'bi-file-earmark-word-fill', color: '#2563eb' };
        case 'xls':
        case 'xlsx': return { icon: 'bi-file-earmark-excel-fill', color: '#10b981' };
        case 'ppt':
        case 'pptx': return { icon: 'bi-file-earmark-ppt-fill', color: '#f59e0b' };
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg': return { icon: 'bi-file-earmark-image-fill', color: '#06b6d4' };
        case 'zip':
        case 'rar':
        case '7z': return { icon: 'bi-file-earmark-zip-fill', color: '#3b82f6' };
        case 'html':
        case 'htm': return { icon: 'bi-filetype-html', color: '#ea580c' };
        default: return { icon: 'bi-file-earmark-text-fill', color: '#3083FF' };
    }
}

function formatFileSize(bytes: number): string {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Berkas TIDAK diambil langsung dari file_url: PDFViewer melewatkan URL http
 * eksternal ke /api/pdf-proxy yang ber-auth, sehingga pengunjung anonim selalu
 * kena 401. URL relatif di bawah ini dipakai apa adanya oleh PDFViewer, dan
 * route-nya hanya mau melayani dokumen yang tercakup token.
 * Segmen nama berkas ada supaya deteksi jenis berkas lewat ekstensi tetap jalan.
 */
function proxyUrl(token: string, doc: InformasiDoc): string {
    const name = doc.file_name || `${doc.title}.pdf`;
    return `/api/informasi-akademik/share/file/${encodeURIComponent(token)}/${encodeURIComponent(doc.id)}/${encodeURIComponent(name)}`;
}

export default function ShareLinkClient({
    share,
    token,
    schoolName,
}: {
    share: ResolvedShare;
    token: string;
    schoolName?: string;
}) {
    const [selected, setSelected] = useState<InformasiDoc | null>(null);

    // Link satu file langsung membuka dokumennya — penerima tidak perlu
    // menekan apa pun lagi setelah membuka tautan dari WA.
    useEffect(() => {
        if (share.scope === 'file' && share.docs.length === 1) {
            setSelected(share.docs[0]);
        }
    }, [share]);

    return (
        <div className="ifl-page">
            <header className="ifl-hero">
                <div className="ifl-hero__icon">
                    <i className={`bi ${share.scope === 'file' ? 'bi-file-earmark-text' : 'bi-folder2-open'}`} />
                </div>
                <div className="ifl-hero__text">
                    <span className="ifl-hero__eyebrow">Informasi dibagikan</span>
                    <h1>{share.label}</h1>
                    <p>
                        {share.division ? `${share.division} • ` : ''}
                        {share.docs.length} dokumen
                        {schoolName ? ` • ${schoolName}` : ''}
                    </p>
                </div>
            </header>

            <div className="ifl-card">
                <div className="ifl-card__head">
                    <i className="bi bi-collection" />
                    <span>{share.scope === 'file' ? 'Dokumen' : 'Daftar dokumen'}</span>
                    <span className="ifl-count">{share.docs.length}</span>
                </div>
                <div className="ifl-list">
                    {share.docs.map(doc => {
                        const info = fileIconInfo(doc.file_name);
                        return (
                            <button
                                key={doc.id}
                                className="ifl-item"
                                onClick={() => setSelected(doc)}
                                title={`Buka "${doc.title}"`}
                            >
                                <span className="ifl-item__icon" style={{ color: info.color }}>
                                    <i className={`bi ${info.icon}`} />
                                </span>
                                <span className="ifl-item__info">
                                    <span className="ifl-item__title">{doc.title}</span>
                                    <span className="ifl-item__meta">
                                        {new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ''}
                                    </span>
                                </span>
                                <span className="ifl-item__action">Buka</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="ifl-note">
                Tautan ini hanya menampilkan {share.scope === 'file' ? 'dokumen di atas' : 'isi folder di atas'}.
                Untuk melihat seluruh informasi, masuk ke aplikasi menggunakan akun Anda.
            </p>

            {selected && (
                <PDFViewer
                    url={proxyUrl(token, selected)}
                    title={selected.title}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}
