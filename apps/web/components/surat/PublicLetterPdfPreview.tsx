'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import './public-letter-pdf.css';

function LetterPage({ pdf, number, width }: { pdf: PDFDocumentProxy; number: number; width: number }) {
    const container = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState(false);
    const [rendered, setRendered] = useState(false);
    useEffect(() => {
        if (!container.current) return;
        if (!('IntersectionObserver' in window)) { setVisible(true); return; }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: '600px' });
        observer.observe(container.current);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (!visible || !width || !canvas.current) return;
        let cancelled = false;
        let task: RenderTask | undefined;
        setError(false);
        setRendered(false);
        (async () => {
            try {
                const page = await pdf.getPage(number);
                if (cancelled || !canvas.current) return;
                const original = page.getViewport({ scale: 1 });
                const scale = width / original.width;
                const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (width * width * original.height / original.width)));
                const viewport = page.getViewport({ scale: scale * ratio });
                const element = canvas.current;
                element.width = Math.ceil(viewport.width);
                element.height = Math.ceil(viewport.height);
                const context = element.getContext('2d');
                if (!context) throw Error('Canvas unavailable');
                task = page.render({ canvasContext: context, viewport });
                await task.promise;
                if (!cancelled) setRendered(true);
            } catch (e: any) {
                if (!cancelled && e?.name !== 'RenderingCancelledException') setError(true);
            }
        })();
        return () => { cancelled = true; task?.cancel(); };
    }, [pdf, number, width, visible]);
    return <figure className="letter-pdf-page" style={{ width }} ref={container}>
        <div className="letter-pdf-sheet">
            {error ? <p className="letter-pdf-message">Halaman {number} belum dapat ditampilkan. Gunakan Unduh PDF untuk membukanya.</p>
                : <canvas ref={canvas} role="img" aria-label={`Halaman ${number} dari ${pdf.numPages}`} aria-busy={!rendered} data-rendered={rendered} />}
        </div>
        <figcaption>Halaman {number} dari {pdf.numPages}</figcaption>
    </figure>;
}

/** Canvas pages avoid the single-page PDF iframe on iOS and fit the available column. */
export default function PublicLetterPdfPreview({ letterId }: { letterId: string }) {
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [width, setWidth] = useState(0);
    const [zoom, setZoom] = useState(1);
    const container = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const measure = () => setWidth(Math.max(0, Math.floor(element.clientWidth - 24)));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        let task: PDFDocumentLoadingTask | undefined;
        setPdf(null); setError(''); setZoom(1);
        (async () => {
            try {
                const response = await fetch(`/api/public/surat/file?id=${encodeURIComponent(letterId)}`, { signal: controller.signal });
                if (!response.ok) throw Error((await response.json()).error || 'Pratinjau gagal dimuat');
                const bytes = await response.arrayBuffer();
                const pdfjs = await import('pdfjs-dist');
                if (controller.signal.aborted) return;
                pdfjs.GlobalWorkerOptions.workerSrc = '/api/public/e-sertifikat-worker';
                task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
                const document = await task.promise;
                if (!controller.signal.aborted) setPdf(document);
            } catch (e: any) {
                if (!controller.signal.aborted) setError(e?.name === 'PasswordException' ? 'PDF ini dilindungi sandi. Unduh berkas untuk membukanya.' : e.message || 'Pratinjau gagal dimuat');
            }
        })();
        return () => { controller.abort(); task?.destroy().catch(() => {}); };
    }, [letterId, retry]);
    return <div className="letter-pdf-preview" ref={container}>
        <div className="letter-pdf-toolbar" role="toolbar" aria-label="Pengaturan pratinjau PDF">
            <span className="letter-pdf-count" aria-live="polite">{pdf ? `${pdf.numPages} halaman` : 'Pratinjau PDF'}</span>
            <div className="letter-pdf-zoom">
                <button type="button" aria-label="Perkecil dokumen" disabled={zoom <= 0.75 || !pdf} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))}>−</button>
                <button type="button" disabled={!pdf} onClick={() => setZoom(1)} aria-label="Sesuaikan dokumen dengan lebar layar">{zoom === 1 ? 'Pas lebar' : `${Math.round(zoom * 100)}%`}</button>
                <button type="button" aria-label="Perbesar dokumen" disabled={zoom >= 2 || !pdf} onClick={() => setZoom(value => Math.min(2, value + 0.25))}>+</button>
            </div>
        </div>
        {error ? <div className="letter-pdf-message" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div>
            : !pdf ? <p className="letter-pdf-message" role="status">Memuat seluruh halaman PDF…</p>
                : <div className="letter-pdf-pages">
                    {Array.from({ length: pdf.numPages }, (_, index) => <LetterPage key={`${letterId}-${retry}-${index}`} pdf={pdf} number={index + 1} width={Math.max(1, width * zoom)} />)}
                </div>}
    </div>;
}
