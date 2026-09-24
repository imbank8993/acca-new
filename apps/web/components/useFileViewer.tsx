'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';

// Viewer yang sama dengan halaman Informasi. Dibungkus PDFViewerWrapper +
// dynamic(ssr:false) supaya react-pdf/pdfjs tidak ikut ter-bundle di server.
const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });

/**
 * Membuka file (PDF/gambar/Office/video) di viewer in-app alih-alih
 * mengarahkan pengguna ke URL storage di tab baru.
 *
 * Pakai:
 *   const { openFile, viewer } = useFileViewer();
 *   <button onClick={() => openFile(row.file_url, row.title)}>Lihat</button>
 *   {viewer}   // taruh sekali di akhir JSX
 */
export function useFileViewer() {
    const [file, setFile] = useState<{ url: string; title: string } | null>(null);

    const openFile = useCallback((url: string | null | undefined, title?: string | null) => {
        if (!url) return;
        setFile({ url, title: title?.trim() || 'Dokumen' });
    }, []);

    const closeFile = useCallback(() => setFile(null), []);

    const viewer = file
        ? <PDFViewer url={file.url} title={file.title} onClose={closeFile} />
        : null;

    return { openFile, closeFile, viewer, isOpen: file !== null };
}

export default useFileViewer;
