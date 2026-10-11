import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Lightbox from 'yet-another-react-lightbox';
import type { ZoomRef } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Download from 'yet-another-react-lightbox/plugins/download';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import 'yet-another-react-lightbox/styles.css';
import { ensureAbsoluteUrl } from '@/lib/url';
import { fileTypeFromBlob } from 'file-type';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import * as XLSX from 'xlsx';

// Configure PDF.js worker — guard against undefined GlobalWorkerOptions in Next.js webpack
if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
}

class PageErrorBoundary extends React.Component<{ children: React.ReactNode; pageNo: number }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: any) {
        console.warn(`[PDFViewer] Page ${this.props.pageNo} error:`, error?.message);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: '#888', textAlign: 'center', fontSize: '0.8rem' }}>
                    Gagal merender halaman {this.props.pageNo}
                </div>
            );
        }
        return this.props.children;
    }
}

interface PDFViewerProps {
    url: string;
    title: string;
    onClose: () => void;
    inline?: boolean;
}

const IMAGE_EXTS = /\.(jpg|jpeg|jfif|jpe|png|apng|gif|webp|bmp|dib|tiff?|svgz?|ico|heic|heif|avif|jp2|jpx)$/i;
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov)$/i;
const AUDIO_EXTS = /\.(mp3|wav|ogg|aac|flac|m4a)$/i;
const EXCEL_EXTS = /\.(xlsx|xls|xlsm)$/i;
const WORD_EXTS = /\.(doc|docx)$/i;
const PPT_EXTS = /\.(ppt|pptx)$/i;
const PDF_EXTS = /\.pdf$/i;
const HTML_EXTS = /\.html?$/i;

// Batas zoom (persen) — langkah 5% supaya render canvas tetap tajam
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP_FACTOR = 1.25;
// Jeda sebelum canvas dirender ulang (tajam) setelah zoom berhenti
const SHARPEN_DELAY = 260;
// Anggaran piksel canvas per halaman — batas zoom diturunkan untuk halaman
// berukuran besar (A3/poster) supaya canvas tidak gagal dirender di HP/tablet
const MAX_CANVAS_PIXELS = 12_000_000;

export default function PDFViewer({ url, title, onClose, inline = false }: PDFViewerProps) {
    const urlMentah = ensureAbsoluteUrl(url);

    /**
     * Hanya http(s) dan path relatif milik sendiri yang boleh dibuka.
     *
     * URL berkas di beberapa modul berasal dari masukan pengguna, dan viewer ini
     * memasangnya di `<a href>` serta tombol unduh. Tanpa penyaringan, nilai
     * seperti `javascript:` ikut terpasang dan dijalankan saat diklik —
     * `ensureAbsoluteUrl` tidak menyaringnya karena tugasnya hanya membetulkan
     * protokol yang kurang garis miring.
     *
     * Dijaga di sini, bukan hanya di titik penyimpanan, supaya berlaku untuk
     * SEMUA pemanggil viewer sekaligus — termasuk baris lama yang sudah
     * tersimpan sebelum validasi di sisi penulisan dipasang.
     */
    const urlAman = (() => {
        if (!urlMentah) return false;
        if (urlMentah.startsWith('/')) return true;
        try {
            const p = new URL(urlMentah);
            return p.protocol === 'http:' || p.protocol === 'https:';
        } catch {
            return false;
        }
    })();

    const fileUrl = urlAman ? urlMentah : '';
    const filename = fileUrl.split('?')[0];
    const ext = (filename.split('.').pop() || '').toLowerCase();

    // Determine viewer type by extension first (synchronous, fast)
    const isImageByExt = IMAGE_EXTS.test(filename);
    const isPdfPreview = filename.includes('/api/ketidakhadiran/pdf-preview');
    const isHtmlByExt = HTML_EXTS.test(filename) || isPdfPreview;
    const isPdfByExt = PDF_EXTS.test(filename);
    const isExcelByExt = EXCEL_EXTS.test(filename);
    const isWordByExt = WORD_EXTS.test(filename);
    const isPptByExt = PPT_EXTS.test(filename);
    const isVideoByExt = VIDEO_EXTS.test(filename);
    const isAudioByExt = AUDIO_EXTS.test(filename);
    // Ekstensi yang tidak cocok kategori manapun — bisa jadi gambar dengan
    // ekstensi aneh/salah/hilang. Dicoba diunduh & disniff MIME-nya, bukan
    // langsung dianggap tidak didukung.
    const isKnownExt = isImageByExt || isHtmlByExt || isPdfByExt || isExcelByExt
        || isWordByExt || isPptByExt || isVideoByExt || isAudioByExt || isPdfPreview;

    const [mounted, setMounted] = useState(false);
    // Zoom state — percentage-based (50-400), rendered via CSS transform for GPU-accelerated smoothness
    const [zoomPercent, setZoomPercent] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 75 : 100;
        }
        return 100;
    });
    const [numPages, setNumPages] = useState<number | null>(null);
    const [excelData, setExcelData] = useState<{ sheetName: string; data: any[][] }[]>([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [isHtmlFullPage, setIsHtmlFullPage] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState('Memuat dokumen...');
    /**
     * Isi dokumen Word yang sudah dikonversi ke HTML di peramban.
     *
     * Menggantikan iframe `view.officeapps.live.com`. Dua alasan:
     *
     *  1. Privasi. Viewer itu tidak menerima berkas yang sudah kita unduh —
     *     ia hanya diberi URL-nya, lalu server Microsoft mengambil sendiri
     *     berkasnya. Artinya setiap surat tugas, SK, dan dokumen pribadi yang
     *     dibuka ikut terkirim ke pihak ketiga, beserta URL-nya.
     *  2. Ia mensyaratkan berkasnya bisa diambil publik. Untuk berkas di balik
     *     sesi login (mis. `/api/personal/documents/{id}/file`) viewer itu tidak
     *     akan pernah bisa menampilkannya.
     *
     * `mammoth` sudah ada di proyek ini dan sudah dipakai di
     * `api/surat/sign-pdf`, jadi tidak ada ketergantungan baru.
     */
    const [wordHtml, setWordHtml] = useState<string | null>(null);
    /** Berkas yang memang tidak bisa dirender lokal (mis. .doc/.ppt lama). */
    const [tidakDidukung, setTidakDidukung] = useState(false);
    const [detectedMime, setDetectedMime] = useState<string | null>(null);
    const cancelledRef = useRef(false);

    // Deteksi final "ini gambar": lewat ekstensi (cepat), atau lewat MIME asli
    // hasil sniffing blob (menyusul, untuk file berekstensi aneh/hilang/salah).
    const isImage = isImageByExt || (!!detectedMime && detectedMime.startsWith('image/'));

    /**
     * Jenis berkas final: ekstensi ATAU MIME asli hasil sniffing.
     *
     * Penting karena tidak semua pemanggil punya ekstensi di URL-nya. Dokumen
     * Pribadi, misalnya, menyajikan berkas lewat
     * `/api/personal/documents/{id}/file?action=view` — sama sekali tanpa
     * ekstensi. Selama penentuan jenis hanya bersandar pada ekstensi, SELURUH
     * berkas di sana (PDF, Word, maupun Excel) jatuh ke luar semua cabang render
     * dan viewer tampil kosong.
     *
     * Pola ini sudah dipakai untuk gambar di baris atas; di sini tinggal
     * diperluas ke jenis lain.
     */
    const cocokMime = (daftar: string[]) => !!detectedMime && daftar.includes(detectedMime);
    const isPdf = isPdfByExt || cocokMime(['application/pdf']);
    const isWord = isWordByExt || cocokMime([
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
    ]);
    const isExcel = isExcelByExt || cocokMime([
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
    ]);
    const isPpt = isPptByExt || cocokMime([
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
    ]);
    const isHtml = isHtmlByExt || cocokMime(['text/html', 'application/xhtml+xml']) || (!!detectedMime && detectedMime.startsWith('text/html'));

    // ── Mesin zoom viewer PDF ───────────────────────────────────────────
    // Dua skala dipisah supaya zoom tidak pernah menampilkan halaman kosong:
    //   zoomPercent   = skala yang DILIHAT user → hanya CSS transform, instan.
    //   renderPercent = skala rasterisasi canvas react-pdf → diperbarui setelah
    //                   zoom berhenti (SHARPEN_DELAY) dengan snapshot bitmap lama
    //                   ditahan di belakang canvas selama render berjalan.
    const pdfScrollRef = useRef<HTMLDivElement>(null);
    const [renderPercent, setRenderPercent] = useState(zoomPercent);
    const renderRef = useRef(zoomPercent);
    const zoomRef = useRef(zoomPercent);
    // Titik jangkar transform (koordinat layout .pdf-content)
    const [origin, setOrigin] = useState({ x: 0, y: 0 });
    const originRef = useRef({ x: 0, y: 0 });
    const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
    const sharpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollPinRef = useRef<{ cancelled: boolean } | null>(null);
    const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pageDimsRef = useRef<Record<number, { width: number; height: number }>>({});
    const [dimsTick, setDimsTick] = useState(0);
    const autoFitRef = useRef(false);
    const [win, setWin] = useState({ start: 1, end: 2 });
    const winRef = useRef(win);
    const [currentPage, setCurrentPage] = useState(1);
    const [showPagePill, setShowPagePill] = useState(false);
    const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Zoom untuk gambar dikendalikan oleh plugin Zoom-nya lightbox (pinch/double-tap bawaan)
    const imgZoomRef = useRef<ZoomRef>(null);
    const [imgZoom, setImgZoom] = useState(1);

    useEffect(() => {
        setMounted(true);
        if (!inline) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [inline]);

    // Batas zoom efektif dokumen ini (lihat MAX_CANVAS_PIXELS)
    const maxZoomRef = useRef(MAX_ZOOM);
    const clampView = useCallback(
        (v: number) => Math.min(maxZoomRef.current, Math.max(MIN_ZOOM, v)), []);
    const snapView = useCallback(
        (v: number) => clampView(Math.round(v / 5) * 5), [clampView]);

    // Skala transform aktif: >1 berarti canvas sedang "diperbesar" secara CSS
    const viewScale = zoomPercent / renderPercent;

    // Koordinat layout dari offset layar (memperhitungkan transform yang aktif)
    const toLayout = useCallback((cx: number, cy: number) => {
        const el = pdfScrollRef.current;
        const O = originRef.current;
        if (!el) return O;
        const s = zoomRef.current / renderRef.current;
        return {
            x: O.x + (cx + el.scrollLeft - O.x) / s,
            y: O.y + (cy + el.scrollTop - O.y) / s,
        };
    }, []);

    // Pindahkan titik jangkar tanpa membuat tampilan melompat
    const moveOrigin = useCallback((x: number, y: number) => {
        const el = pdfScrollRef.current;
        const s = zoomRef.current / renderRef.current;
        if (el && Math.abs(s - 1) > 0.001) {
            el.scrollLeft += (x - originRef.current.x) * (1 - s);
            el.scrollTop += (y - originRef.current.y) * (1 - s);
        }
        originRef.current = { x, y };
        setOrigin({ x, y });
    }, []);

    // Kembalikan titik jangkar ke posisi layar semula setelah halaman dirender
    // ulang. Diukur dari kotak halaman yang sebenarnya (bukan hasil hitungan
    // skala) supaya jarak antar halaman & padding yang tidak ikut membesar
    // tidak membuat tampilan bergeser. Diulang beberapa frame karena ukuran
    // canvas baru datang async.
    const reanchor = useCallback((page: number, fx: number, fy: number, screenX: number, screenY: number) => {
        if (scrollPinRef.current) scrollPinRef.current.cancelled = true;
        const token = { cancelled: false };
        scrollPinRef.current = token;
        let frames = 0;
        const step = () => {
            const el = pdfScrollRef.current;
            if (token.cancelled || !el) return;
            const wrap = el.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`);
            if (wrap) {
                const rect = el.getBoundingClientRect();
                const box = wrap.getBoundingClientRect();
                const dx = (box.left + fx * box.width) - (rect.left + screenX);
                const dy = (box.top + fy * box.height) - (rect.top + screenY);
                if (Math.abs(dx) > 0.5) el.scrollLeft += dx;
                if (Math.abs(dy) > 0.5) el.scrollTop += dy;
            }
            originRef.current = { x: screenX + el.scrollLeft, y: screenY + el.scrollTop };
            if (++frames < 15) requestAnimationFrame(step);
            else setOrigin(originRef.current);
        };
        requestAnimationFrame(step);
    }, []);

    // Bekukan bitmap halaman yang terlihat, dipasang di belakang canvas.
    // Saat react-pdf mengosongkan canvas untuk render ulang, yang terlihat
    // tetap gambar lama (bukan halaman putih).
    const freezePages = useCallback(() => {
        const root = pdfScrollRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        root.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((wrap) => {
            const box = wrap.getBoundingClientRect();
            if (box.bottom < rect.top - rect.height || box.top > rect.bottom + rect.height) return;
            const src = wrap.querySelector('canvas.pdf-live') as HTMLCanvasElement | null;
            const holder = wrap.querySelector('.pdf-snap') as HTMLElement | null;
            if (!src || !holder || !src.width || !src.height) return;
            const snap = document.createElement('canvas');
            snap.width = src.width;
            snap.height = src.height;
            snap.style.width = '100%';
            snap.style.height = '100%';
            snap.style.display = 'block';
            const ctx = snap.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(src, 0, 0);
            holder.replaceChildren(snap);
        });
        // Jaring pengaman: bersihkan snapshot walau onRenderSuccess tidak terpanggil
        if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
        snapTimerRef.current = setTimeout(() => {
            root.querySelectorAll<HTMLElement>('.pdf-snap').forEach((h) => h.replaceChildren());
        }, 4000);
    }, []);

    // Dokumen dengan campuran potret/landscape membuat area konten lebih lebar
    // dari layar; tanpa ini halaman potret tampak terdorong ke kanan & terpotong.
    const centerHorizontally = useCallback(() => {
        let frames = 0;
        const step = () => {
            const el = pdfScrollRef.current;
            if (!el) return;
            const extra = el.scrollWidth - el.clientWidth;
            if (extra > 0) el.scrollLeft = extra / 2;
            if (++frames < 12) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, []);

    const clearSnapshot = useCallback((page: number) => {
        const root = pdfScrollRef.current;
        if (!root) return;
        const holder = root.querySelector(`[data-pdf-page="${page}"] .pdf-snap`);
        if (holder) (holder as HTMLElement).replaceChildren();
    }, []);

    // Render ulang canvas pada skala baru (dipanggil setelah zoom berhenti).
    // Selalu menyusul skala tampilan → transform kembali 1:1 sehingga seluruh
    // halaman tetap bisa digeser dan teks selalu tajam.
    const sharpen = useCallback(() => {
        const el = pdfScrollRef.current;
        if (!el) return;
        const target = snapView(zoomRef.current);
        const prev = renderRef.current;
        if (target === prev) return;

        // Titik jangkar saat ini: posisinya di layar + di halaman mana (fraksi kotak halaman)
        const rect = el.getBoundingClientRect();
        const O = originRef.current;
        const screenX = O.x - el.scrollLeft;
        const screenY = O.y - el.scrollTop;
        const px = rect.left + screenX;
        const py = rect.top + screenY;
        let anchor: { page: number; fx: number; fy: number } | null = null;
        let nearest = Infinity;
        el.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((wrap) => {
            const box = wrap.getBoundingClientRect();
            if (!box.width || !box.height) return;
            const gap = py < box.top ? box.top - py : py > box.bottom ? py - box.bottom : 0;
            if (gap < nearest) {
                nearest = gap;
                anchor = {
                    page: Number(wrap.dataset.pdfPage),
                    fx: (px - box.left) / box.width,
                    fy: (py - box.top) / box.height,
                };
            }
        });

        freezePages();
        renderRef.current = target;
        setRenderPercent(target);
        if (anchor) {
            const a = anchor as { page: number; fx: number; fy: number };
            reanchor(a.page, a.fx, a.fy, screenX, screenY);
        }
    }, [freezePages, reanchor, snapView]);

    const scheduleSharpen = useCallback(() => {
        if (sharpenTimerRef.current) clearTimeout(sharpenTimerRef.current);
        sharpenTimerRef.current = setTimeout(sharpen, SHARPEN_DELAY);
    }, [sharpen]);

    // Zoom visual: hanya mengubah CSS transform → tidak ada render canvas, tidak ada blank.
    // `screenX/screenY` = titik yang harus tetap diam (jari / kursor).
    const applyZoom = useCallback((nextRaw: number, screenX?: number, screenY?: number, snap = true) => {
        const next = snap ? snapView(nextRaw) : clampView(nextRaw);
        if (screenX != null && screenY != null) {
            const p = toLayout(screenX, screenY);
            moveOrigin(p.x, p.y);
        }
        if (Math.abs(next - zoomRef.current) < 0.01) return;
        zoomRef.current = next;
        setZoomPercent(next);
    }, [moveOrigin, toLayout, clampView, snapView]);

    const commitZoom = useCallback((nextRaw: number, screenX?: number, screenY?: number) => {
        applyZoom(nextRaw, screenX, screenY);
        scheduleSharpen();
    }, [applyZoom, scheduleSharpen]);

    const fitWidthPercent = useCallback(() => {
        const el = pdfScrollRef.current;
        const dim = pageDimsRef.current[1];
        if (!el || !dim) return null;
        return snapView(((el.clientWidth - 24) / dim.width) * 100);
    }, [snapView]);

    const isFitWidth = (() => {
        const el = pdfScrollRef.current;
        const dim = pageDimsRef.current[1];
        if (!el || !dim) return false;
        return Math.abs(snapView(((el.clientWidth - 24) / dim.width) * 100) - zoomPercent) <= 5;
    })();

    const handleFitToggle = useCallback(() => {
        const fit = fitWidthPercent();
        if (!fit) return;
        commitZoom(Math.abs(fit - zoomRef.current) <= 5 ? 100 : fit, 0, 0);
    }, [commitZoom, fitWidthPercent]);

    const stepZoom = useCallback((dir: 1 | -1) => {
        const el = pdfScrollRef.current;
        const next = dir > 0
            ? zoomRef.current * ZOOM_STEP_FACTOR
            : zoomRef.current / ZOOM_STEP_FACTOR;
        commitZoom(next, el ? el.clientWidth / 2 : undefined, el ? el.clientHeight / 2 : undefined);
    }, [commitZoom]);

    // Hanya halaman di sekitar viewport yang dirasterisasi — halaman lain jadi
    // placeholder seukuran aslinya. Ini yang membuat render ulang saat zoom cepat.
    const computeWindow = useCallback(() => {
        const node = pdfScrollRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        let start = 0;
        let end = 0;
        node.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((wrap) => {
            const n = Number(wrap.dataset.pdfPage);
            const box = wrap.getBoundingClientRect();
            const relTop = box.top - rect.top;
            const relBottom = box.bottom - rect.top;
            if (relBottom > -node.clientHeight && relTop < node.clientHeight * 2) {
                if (!start || n < start) start = n;
                if (n > end) end = n;
            }
        });
        if (!start) return;
        if (winRef.current.start === start && winRef.current.end === end) return;
        winRef.current = { start, end };
        setWin({ start, end });
    }, []);

    // Gesture: pinch dua jari, double-tap, dan ctrl/⌘+wheel (trackpad pinch di desktop).
    // Listener native supaya bisa preventDefault (React memasang touchmove sebagai passive).
    useEffect(() => {
        if (!isPdf) return;
        const el = pdfScrollRef.current;
        if (!el) return;

        const touchDist = (t: TouchList) =>
            Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

        const tapRef = { time: 0, x: 0, y: 0, moved: false };
        let moveRaf = 0;
        let pendingZoom = 0;

        const onTouchStart = (e: TouchEvent) => {
            if (scrollPinRef.current) scrollPinRef.current.cancelled = true;
            if (sharpenTimerRef.current) clearTimeout(sharpenTimerRef.current);
            if (e.touches.length === 1) {
                tapRef.moved = false;
                tapRef.x = e.touches[0].clientX;
                tapRef.y = e.touches[0].clientY;
                return;
            }
            if (e.touches.length !== 2) return;
            const rect = el.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
            const p = toLayout(midX, midY);
            moveOrigin(p.x, p.y);
            pinchRef.current = { dist: touchDist(e.touches), zoom: zoomRef.current };
            e.preventDefault();
        };

        const onTouchMove = (e: TouchEvent) => {
            const p = pinchRef.current;
            if (p && e.touches.length === 2) {
                e.preventDefault();
                // Nilai zoom di-update per frame (bukan per event) → transform mulus
                pendingZoom = clampView(p.zoom * (touchDist(e.touches) / p.dist));
                if (!moveRaf) {
                    moveRaf = requestAnimationFrame(() => {
                        moveRaf = 0;
                        if (pinchRef.current) applyZoom(pendingZoom, undefined, undefined, false);
                    });
                }
                return;
            }
            if (e.touches.length === 1) {
                if (Math.abs(e.touches[0].clientX - tapRef.x) > 12 ||
                    Math.abs(e.touches[0].clientY - tapRef.y) > 12) tapRef.moved = true;
            }
        };

        const finishPinch = () => {
            if (!pinchRef.current) return;
            pinchRef.current = null;
            if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
            // Bulatkan ke kelipatan 5% lalu render ulang supaya tajam
            commitZoom(zoomRef.current);
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (pinchRef.current) {
                if (e.touches.length >= 2) return;
                finishPinch();
                return;
            }
            if (e.touches.length > 0 || tapRef.moved) return;
            // Double-tap: fit lebar ⇄ 200%
            const now = Date.now();
            const t = e.changedTouches[0];
            if (now - tapRef.time < 300 && t &&
                Math.abs(t.clientX - tapRef.x) < 30 && Math.abs(t.clientY - tapRef.y) < 30) {
                tapRef.time = 0;
                const rect = el.getBoundingClientRect();
                const fit = fitWidthPercent();
                const target = fit && zoomRef.current > fit + 5 ? fit : 200;
                commitZoom(target, t.clientX - rect.left, t.clientY - rect.top);
                e.preventDefault();
            } else {
                tapRef.time = now;
            }
        };

        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            if (scrollPinRef.current) scrollPinRef.current.cancelled = true;
            const rect = el.getBoundingClientRect();
            applyZoom(
                zoomRef.current * Math.exp(-e.deltaY / 250),
                e.clientX - rect.left,
                e.clientY - rect.top,
                false
            );
            scheduleSharpen();
        };

        let scrollRaf = 0;
        const onScroll = () => {
            if (scrollRaf) return;
            scrollRaf = requestAnimationFrame(() => {
                scrollRaf = 0;
                const node = pdfScrollRef.current;
                if (!node) return;
                const threshold = node.getBoundingClientRect().top + node.clientHeight * 0.3;
                let cur = 1;
                node.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((w) => {
                    if (w.getBoundingClientRect().top <= threshold) cur = Number(w.dataset.pdfPage);
                });
                setCurrentPage(cur);
                setShowPagePill(true);
                if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
                pillTimerRef.current = setTimeout(() => setShowPagePill(false), 1400);
                computeWindow();
            });
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: false });
        el.addEventListener('touchcancel', finishPinch);
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', finishPinch);
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('scroll', onScroll);
            if (moveRaf) cancelAnimationFrame(moveRaf);
            if (scrollRaf) cancelAnimationFrame(scrollRaf);
            if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
            if (sharpenTimerRef.current) clearTimeout(sharpenTimerRef.current);
            if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
            if (scrollPinRef.current) scrollPinRef.current.cancelled = true;
        };
    }, [isPdf, blobUrl, loading, error, applyZoom, commitZoom, scheduleSharpen,
        fitWidthPercent, computeWindow, moveOrigin, toLayout, clampView]);

    // Hitung ulang jendela render setelah jumlah halaman / skala berubah
    useEffect(() => {
        if (!isPdf) return;
        const raf = requestAnimationFrame(computeWindow);
        return () => cancelAnimationFrame(raf);
    }, [isPdf, numPages, renderPercent, dimsTick, computeWindow]);

    // Keyboard zoom (desktop): Ctrl/⌘ +, -, 0
    useEffect(() => {
        if (!isPdf) return;
        const onKey = (e: KeyboardEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
            else if (e.key === '-') { e.preventDefault(); stepZoom(-1); }
            else if (e.key === '0') { e.preventDefault(); commitZoom(100); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isPdf, stepZoom, commitZoom]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Load blob + detect MIME for PDF/Office/Image files. Ekstensi tak dikenal
    // ikut diunduh & disniff juga — satu-satunya cara tahu itu gambar (mis.
    // .heic, tanpa ekstensi, atau ekstensi salah) sebelum menyerah.
    useEffect(() => {
        const needsProxy = isPdfByExt || isExcelByExt || isWordByExt || isPptByExt || isImageByExt || isHtmlByExt || !isKnownExt;
        if (!needsProxy) return;

        cancelledRef.current = false;
        autoFitRef.current = false;
        pageDimsRef.current = {};
        setBlobUrl(null);
        setHtmlContent(null);
        setNumPages(null);
        setError('');
        setWordHtml(null);
        setTidakDidukung(false);
        let objectUrl: string | null = null;

        const load = async () => {
            if (!urlAman) {
                setError('URL berkas tidak sah, sehingga tidak dibuka.');
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            setProgress('Menghubungi server...');
            try {
                // `/api/pdf-proxy` cuma dibutuhkan untuk URL EKSTERNAL (storage
                // lain), untuk mem-fetch-nya dari server tanpa CORS/X-Frame
                // block. Untuk rute sendiri yang relatif (mis. viewer dokumen
                // pribadi `/api/personal/documents/{id}/file`), fetch langsung
                // dari browser — proxy tidak bisa meneruskan cookie login user,
                // dan `fetch()` di server tidak bisa memuat URL relatif sama
                // sekali (selalu gagal dengan "Gagal memuat: 500").
                const proxyUrl = fileUrl.startsWith('http')
                    ? `/api/pdf-proxy?url=${encodeURIComponent(fileUrl)}`
                    : fileUrl;
                setProgress('Mengunduh file...');
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`Gagal memuat: ${res.status}`);
                if (cancelledRef.current) return;
                setProgress('Memproses dokumen...');
                const blob = await res.blob();
                if (cancelledRef.current) return;

                // Deteksi MIME asli. Nilainya dipegang di variabel lokal juga,
                // bukan hanya di state: `detectedMime` baru terlihat pada render
                // BERIKUTNYA, sedangkan keputusan parsing di bawah terjadi pada
                // jalannya efek ini. Tanpa variabel lokal, berkas dari URL tanpa
                // ekstensi tidak akan pernah masuk cabang parsing mana pun.
                let mimeAsli: string | null = null;
                if (blob.type && blob.type !== 'application/octet-stream') {
                    mimeAsli = blob.type.split(';')[0].trim().toLowerCase();
                } else {
                    try {
                        const ft = await fileTypeFromBlob(blob);
                        if (ft) mimeAsli = ft.mime;
                    } catch { /* ignore */ }
                }
                if (mimeAsli) setDetectedMime(mimeAsli);

                const cocok = (daftar: string[]) => !!mimeAsli && daftar.includes(mimeAsli);
                const excelSekarang = isExcelByExt || cocok([
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                ]);
                const wordSekarang = isWordByExt || cocok([
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/msword',
                ]);
                const pptSekarang = isPptByExt || cocok([
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/vnd.ms-powerpoint',
                ]);
                // OOXML (.docx/.xlsx/.pptx) sejatinya arsip ZIP. Sebagian sumber
                // melaporkannya sebagai application/zip, jadi ekstensi tetap
                // dipakai sebagai penentu kalau MIME-nya generik.
                const docxSekarang = ext === 'docx'
                    || cocok(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

                let finalBlob = blob;
                if ((isHtmlByExt || isPdfPreview || mimeAsli?.startsWith('text/html')) && !blob.type.startsWith('text/html')) {
                    finalBlob = new Blob([blob], { type: 'text/html' });
                }

                objectUrl = URL.createObjectURL(finalBlob);
                setBlobUrl(objectUrl);

                if (isHtmlByExt || isPdfPreview || mimeAsli?.startsWith('text/html') || ext === 'html' || ext === 'htm') {
                    try {
                        const text = await blob.text();
                        if (!cancelledRef.current) {
                            setHtmlContent(text);
                        }
                    } catch (err) {
                        console.warn('[PDFViewer] Gagal membaca isi teks HTML:', err);
                    }
                }

                // Native Excel Parsing - Load ALL sheets
                if (excelSekarang) {
                    try {
                        const buffer = await blob.arrayBuffer();
                        const workbook = XLSX.read(buffer, { type: 'array' });
                        const allSheets = workbook.SheetNames.map(sheetName => {
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                            return { sheetName, data: jsonData as any[][] };
                        });
                        setExcelData(allSheets);
                        setActiveSheetIndex(0);
                    } catch (err) {
                        console.error('Excel parse error:', err);
                        setTidakDidukung(true);
                    }
                } else if (wordSekarang) {
                    // Hanya .docx (OOXML) yang bisa dibaca mammoth. Format .doc
                    // lama adalah biner OLE2 yang tidak ada pembacanya di
                    // peramban — untuk itu ditawarkan unduhan, bukan viewer
                    // pihak ketiga.
                    if (docxSekarang) {
                        try {
                            // Diimpor sebagai 'mammoth', bukan 'mammoth/mammoth.browser':
                            // package.json-nya punya field `browser` yang menukar modul
                            // Node-only (unzip, fs) dengan padanan peramban, jadi bundler
                            // sudah menanganinya — dan versi ini yang membawa tipenya.
                            const [mammoth, { default: DOMPurify }] = await Promise.all([
                                import('mammoth'),
                                import('isomorphic-dompurify'),
                            ]);
                            const arrayBuffer = await blob.arrayBuffer();
                            if (cancelledRef.current) return;
                            const hasil = await mammoth.convertToHtml({ arrayBuffer });
                            if (cancelledRef.current) return;
                            // Keluaran mammoth berasal dari dokumen yang tidak
                            // dipercaya, jadi tetap disanitasi — pola yang sama
                            // dipakai DashboardContent untuk isi pengumuman.
                            setWordHtml(DOMPurify.sanitize(hasil.value || ''));
                        } catch (err) {
                            console.error('Word parse error:', err);
                            setTidakDidukung(true);
                        }
                    } else {
                        setTidakDidukung(true);
                    }
                } else if (pptSekarang) {
                    setTidakDidukung(true);
                }

                setLoading(false);
            } catch (err: any) {
                if (cancelledRef.current) return;
                setError(err.message || 'Gagal memuat dokumen');
                setLoading(false);
            }
        };

        load();
        return () => {
            cancelledRef.current = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [fileUrl]);

    // Nama file unduhan diturunkan dari `title`, padahal title itu teks bebas dari
    // pemanggil — mis. "047/IZIN/P/VIII/2026 — BRIAN + 10 lainnya (Kolektif)". Dipakai
    // mentah-mentah, browser membuang "/" dan hasilnya tersimpan TANPA ekstensi, jadi
    // sistem operasi tidak mengenalinya sebagai PDF dan file tidak bisa dibuka/dicetak.
    // Karena itu: bersihkan karakter ilegal, lalu pastikan ekstensinya selalu menempel.
    const downloadName = useMemo(() => {
        const mimeToExt: Record<string, string> = {
            'application/pdf': 'pdf',
            'text/html': 'html',
            'application/xhtml+xml': 'html',
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/bmp': 'bmp',
            'image/tiff': 'tiff',
            'image/svg+xml': 'svg',
            'image/x-icon': 'ico',
            'image/vnd.microsoft.icon': 'ico',
            'image/heic': 'heic',
            'image/heif': 'heif',
            'image/avif': 'avif',
        };
        const targetExt = isPdfPreview ? 'pdf' : (ext || (detectedMime ? mimeToExt[detectedMime] || '' : (isHtml ? 'html' : '')));
        const base = (title || 'dokumen')
            .replace(/[\\/:*?"<>|]+/g, '-')  // karakter yang dilarang di nama file
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[.\s]+$/, '')          // titik/spasi di akhir ditolak Windows
            || 'dokumen';
        if (!targetExt) return base;
        return base.toLowerCase().endsWith(`.${targetExt.toLowerCase()}`) ? base : `${base}.${targetExt}`;
    }, [title, ext, detectedMime, isPdfPreview]);

    const handleDownload = useCallback(async () => {
        if (isPdfPreview) {
            try {
                setDownloading(true);
                const pdfDownloadUrl = fileUrl.includes('?')
                    ? `${fileUrl}&format=pdf`
                    : `${fileUrl}?format=pdf`;
                const res = await fetch(pdfDownloadUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const dlUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = dlUrl;
                const safeName = downloadName.toLowerCase().endsWith('.pdf') ? downloadName : `${downloadName}.pdf`;
                a.download = safeName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(dlUrl);
            } catch (err: any) {
                console.error('[PDFViewer] Download error:', err);
                alert('Gagal mengunduh dokumen sebagai PDF: ' + (err?.message || 'Terjadi kesalahan'));
            } finally {
                setDownloading(false);
            }
            return;
        }

        try {
            setDownloading(true);
            let dlUrl = blobUrl;
            let tempCreated = false;

            if (!dlUrl) {
                const proxyUrl = fileUrl.startsWith('http')
                    ? `/api/pdf-proxy?url=${encodeURIComponent(fileUrl)}`
                    : fileUrl;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                dlUrl = window.URL.createObjectURL(blob);
                tempCreated = true;
            }

            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (tempCreated) {
                setTimeout(() => window.URL.revokeObjectURL(dlUrl!), 1000);
            }
        } catch (err: any) {
            console.error('[PDFViewer] Download error:', err);
            alert('Gagal mengunduh berkas: ' + (err?.message || 'Terjadi kesalahan'));
        } finally {
            setDownloading(false);
        }
    }, [isPdfPreview, fileUrl, downloadName, blobUrl]);

    const getFileIcon = () => {
        if (isPdfPreview) return 'bi bi-file-earmark-pdf-fill';
        if (isExcel) return 'bi bi-file-earmark-excel-fill';
        if (isWord) return 'bi bi-file-earmark-word-fill';
        if (isPpt) return 'bi bi-file-earmark-ppt-fill';
        if (isPdf) return 'bi bi-file-earmark-pdf-fill';
        if (isImage) return 'bi bi-file-earmark-image-fill';
        if (isHtml) return 'bi bi-filetype-html';
        if (isVideoByExt) return 'bi bi-file-earmark-play-fill';
        if (isAudioByExt) return 'bi bi-file-earmark-music-fill';
        return 'bi bi-file-earmark-fill';
    };

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
        }
    };

    if (!mounted) return null;

    // ── HTML VIEWER ──────────────────────────────────────────────────
    if (isHtml) {
        const srcUrl = blobUrl || fileUrl;
        const content = (
            <>
                {!inline && <div onClick={() => {
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                    onClose();
                }} style={{
                    position: 'fixed', inset: 0, zIndex: 99990,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)'
                }} />}
                <div 
                    className="pdf-viewer-modal"
                    style={{
                        position: inline ? 'absolute' : 'fixed', inset: 0, zIndex: inline ? 1 : 99999,
                        display: 'flex', flexDirection: 'column',
                        background: isHtmlFullPage ? '#ffffff' : '#eef1f5'
                    }}
                    onWheel={(e) => {
                        const iframe = e.currentTarget.querySelector('iframe');
                        if (iframe && iframe.contentWindow) {
                            try {
                                iframe.contentWindow.scrollBy(e.deltaX, e.deltaY);
                            } catch (err) {}
                        }
                    }}
                >
                    <div className="viewer-header" style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        color: 'white', flexShrink: 0,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        minHeight: '52px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <i className={`bi ${getFileIcon()}`} style={{ fontSize: '1.05rem', color: '#ea580c', flexShrink: 0 }}></i>
                            <h2 style={{
                                margin: 0, fontSize: '0.85rem', fontWeight: '600',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                opacity: 0.95
                            }}>{title}</h2>
                            <span style={{
                                fontSize: '0.65rem',
                                background: 'rgba(234, 88, 12, 0.25)',
                                color: '#fdba74',
                                border: '1px solid rgba(234, 88, 12, 0.4)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: '700',
                                letterSpacing: '0.5px',
                                flexShrink: 0
                            }}>
                                HTML
                            </span>
                            {isHtmlFullPage && (
                                <span style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    color: '#93c5fd',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: '600',
                                    flexShrink: 0
                                }}>
                                    Full Page
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {/* Toggle Fullpage / Boxed */}
                            <button
                                onClick={() => setIsHtmlFullPage(prev => !prev)}
                                title={isHtmlFullPage ? "Ubah ke Tampilan Box (1024px)" : "Ubah ke Tampilan Layar Penuh (Full Page)"}
                                style={{
                                    background: isHtmlFullPage ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.08)',
                                    border: isHtmlFullPage ? '1px solid rgba(59, 130, 246, 0.4)' : 'none',
                                    borderRadius: '6px',
                                    color: isHtmlFullPage ? '#93c5fd' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', width: '30px', height: '30px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = isHtmlFullPage ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255,255,255,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = isHtmlFullPage ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.08)'; }}
                            >
                                <i className={`bi ${isHtmlFullPage ? 'bi-arrows-angle-contract' : 'bi-arrows-angle-expand'}`}></i>
                            </button>

                            {/* Toggle Browser Fullscreen */}
                            <button
                                onClick={handleToggleFullscreen}
                                title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh Browser"}
                                style={{
                                    background: isFullscreen ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.08)',
                                    border: isFullscreen ? '1px solid rgba(59, 130, 246, 0.4)' : 'none',
                                    borderRadius: '6px',
                                    color: isFullscreen ? '#93c5fd' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', width: '30px', height: '30px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = isFullscreen ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255,255,255,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = isFullscreen ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.08)'; }}
                            >
                                <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
                            </button>

                            {/* Print Document */}
                            <button
                                onClick={() => {
                                    const iframe = document.querySelector('.pdf-viewer-modal iframe') as HTMLIFrameElement;
                                    if (iframe && iframe.contentWindow) {
                                        iframe.contentWindow.focus();
                                        iframe.contentWindow.print();
                                    } else if (blobUrl) {
                                        window.open(blobUrl, '_blank');
                                    }
                                }}
                                title="Cetak Dokumen"
                                style={{
                                    background: 'rgba(255,255,255,0.08)', border: 'none',
                                    borderRadius: '6px', color: 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', width: '30px', height: '30px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            >
                                <i className="bi bi-printer"></i>
                            </button>

                            {/* Download Button */}
                            <button
                                onClick={handleDownload}
                                disabled={downloading}
                                title={downloading ? "Mengunduh file..." : "Download"}
                                style={{
                                    background: 'rgba(255,255,255,0.08)', border: 'none',
                                    borderRadius: '6px', color: 'rgba(255,255,255,0.7)',
                                    cursor: downloading ? 'not-allowed' : 'pointer', width: '30px', height: '30px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', transition: 'all 0.2s ease',
                                    opacity: downloading ? 0.6 : 1,
                                }}
                                onMouseEnter={(e) => { if (!downloading) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                onMouseLeave={(e) => { if (!downloading) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            >
                                {downloading ? (
                                    <div style={{
                                        width: '13px', height: '13px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff', borderRadius: '50%',
                                        animation: 'pdfSpin 0.8s linear infinite'
                                    }} />
                                ) : (
                                    <i className="bi bi-download"></i>
                                )}
                            </button>

                            {/* Close Button */}
                            <button onClick={() => {
                                if (document.fullscreenElement) {
                                    document.exitFullscreen().catch(() => {});
                                }
                                onClose();
                            }} title="Tutup" style={{
                                background: 'rgba(255,255,255,0.05)', border: 'none',
                                borderRadius: '6px', color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer', width: '30px', height: '30px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.9rem', transition: 'all 0.2s ease', marginLeft: '2px'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div style={{
                        flex: 1,
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: isHtmlFullPage ? 'stretch' : 'center',
                        alignItems: 'stretch',
                        padding: isHtmlFullPage ? 0 : (inline ? 0 : '20px'),
                        position: 'relative',
                        background: isHtmlFullPage ? '#ffffff' : '#eef1f5',
                        width: '100%',
                        height: '100%'
                    }}>
                        {loading ? (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', color: '#888', gap: '12px'
                            }}>
                                <div style={{
                                    width: '36px', height: '36px',
                                    border: '3px solid #cbd5e1', borderTopColor: '#3083FF',
                                    borderRadius: '50%', animation: 'pdfSpin 0.9s linear infinite'
                                }} />
                                <span style={{ fontSize: '0.8rem' }}>{progress}</span>
                            </div>
                        ) : error ? (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', color: '#ef4444', gap: '12px', padding: '20px', textAlign: 'center'
                            }}>
                                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem' }}></i>
                                <span style={{ fontSize: '0.9rem' }}>{error}</span>
                                <button onClick={() => window.location.reload()} style={{
                                    padding: '8px 16px', background: '#333', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
                                }}>Coba Lagi</button>
                            </div>
                        ) : (
                            <iframe 
                                title={title}
                                srcDoc={htmlContent || undefined}
                                src={!htmlContent ? srcUrl : undefined} 
                                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-modals"
                                style={{
                                    width: '100%',
                                    maxWidth: isHtmlFullPage ? 'none' : '1024px',
                                    height: '100%',
                                    background: '#fff',
                                    border: 'none',
                                    borderRadius: isHtmlFullPage || inline ? '0' : '8px',
                                    boxShadow: isHtmlFullPage || inline ? 'none' : '0 10px 34px rgba(0,0,0,0.2)'
                                }} 
                            />
                        )}
                    </div>
                </div>
            </>
        );
        return inline ? <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{content}</div> : createPortal(content, document.body);
    }

    if (isImage) {
        const imageSrc = blobUrl || fileUrl;
        const content = (
            <>
                {!inline && <div onClick={onClose} style={{
                    position: 'fixed', inset: 0, zIndex: 99990,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)'
                }} />}
                <div style={{
                    position: inline ? 'absolute' : 'fixed', inset: 0, zIndex: inline ? 1 : 99999,
                    display: 'flex', flexDirection: 'column', background: '#111'
                }}>
                    {/* Clean Header - satu baris: Nama File | [zoom out] [%] [zoom in] | [unduh] [close] */}
                    <div className="viewer-header" style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        color: 'white', flexShrink: 0,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        minHeight: '52px'
                    }}>
                        {/* Nama File - kiri */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <i className={`bi ${getFileIcon()}`} style={{ fontSize: '1rem', opacity: 0.7, flexShrink: 0 }}></i>
                            <h2 style={{
                                margin: 0, fontSize: '0.82rem', fontWeight: '600',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                opacity: 0.9
                            }}>{title}</h2>
                        </div>

                        {/* Zoom Controls + Unduh - kanan */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                            {(() => {
                                const minZoom = imgZoomRef.current?.minZoom ?? 1;
                                const maxZoom = imgZoomRef.current?.maxZoom ?? 1;
                                const atMin = imgZoom <= minZoom + 0.001;
                                const atMax = imgZoom >= maxZoom - 0.001;
                                return (
                                    <>
                                        {/* Zoom Out */}
                                        <button
                                            onClick={() => imgZoomRef.current?.zoomOut()}
                                            disabled={atMin}
                                            title="Perkecil"
                                            style={{
                                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                                borderRadius: '6px', color: atMin ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                                                cursor: atMin ? 'default' : 'pointer',
                                                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.85rem', transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => { if (!atMin) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                        >
                                            <i className="bi bi-dash-lg"></i>
                                        </button>

                                        {/* Persentase Zoom */}
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: '600', minWidth: '44px', textAlign: 'center',
                                            color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums'
                                        }}>{Math.round(imgZoom * 100)}%</span>

                                        {/* Zoom In */}
                                        <button
                                            onClick={() => imgZoomRef.current?.zoomIn()}
                                            disabled={atMax}
                                            title="Perbesar"
                                            style={{
                                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                                borderRadius: '6px', color: atMax ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                                                cursor: atMax ? 'default' : 'pointer',
                                                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.85rem', transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => { if (!atMax) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                        >
                                            <i className="bi bi-plus-lg"></i>
                                        </button>
                                    </>
                                );
                            })()}

                            {/* Separator */}
                            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 6px' }} />

                            {/* Unduh */}
                            <button onClick={handleDownload} title="Download" style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '6px', color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer', width: '30px', height: '30px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', transition: 'all 0.2s ease'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            >
                                <i className="bi bi-download"></i>
                            </button>

                            {/* Close */}
                            <button onClick={onClose} title="Tutup" style={{
                                background: 'rgba(255,255,255,0.05)', border: 'none',
                                borderRadius: '6px', color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer', width: '30px', height: '30px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.9rem', transition: 'all 0.2s ease', marginLeft: '2px'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>

                    {/* Lightbox — using inline mode to render within this container */}
                    <div style={{ flex: 1, overflow: 'hidden', background: '#111', position: 'relative' }}>
                        {loading ? (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', color: '#888', gap: '12px'
                            }}>
                                <div style={{
                                    width: '36px', height: '36px',
                                    border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb',
                                    borderRadius: '50%', animation: 'pdfSpin 0.9s linear infinite'
                                }} />
                                <span style={{ fontSize: '0.8rem' }}>{progress}</span>
                            </div>
                        ) : error ? (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', color: '#ef4444', gap: '12px', padding: '20px', textAlign: 'center'
                            }}>
                                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem' }}></i>
                                <span style={{ fontSize: '0.9rem' }}>{error}</span>
                                <button onClick={() => window.location.reload()} style={{
                                    padding: '8px 16px', background: '#333', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
                                }}>Coba Lagi</button>
                            </div>
                        ) : (
                            <Lightbox
                                plugins={[Zoom, Download, Inline]}
                                inline={{ style: { width: '100%', height: '100%', background: '#111' } }}
                                slides={[{ src: imageSrc, alt: title }]}
                                zoom={{
                                    ref: imgZoomRef,
                                    maxZoomPixelRatio: 5,
                                    zoomInMultiplier: 1.5,
                                    scrollToZoom: true,
                                    doubleClickMaxStops: 3,
                                }}
                                on={{ zoom: ({ zoom }) => setImgZoom(zoom) }}
                                styles={{ container: { background: '#111' } }}
                            />
                        )}
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '8px', background: '#1a1a1a', borderTop: '1px solid #333', flexShrink: 0
                    }}>
                        <span style={{ fontSize: '0.7rem', color: '#888' }}>
                            Cubit 2 jari untuk zoom · ketuk 2× untuk perbesar · <strong style={{ color: '#fff' }}>ESC</strong> untuk menutup
                        </span>
                    </div>
                </div>
            </>
        );
        return inline ? <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{content}</div> : createPortal(content, document.body);
    }

    // ── VIDEO PLAYER ───────────────────────────────────────────────────
    if (isVideoByExt) {
        const content = (
            <>
                {!inline && <div onClick={onClose} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99990
                }} />}
                <div className="media-player-modal" style={{
                    position: inline ? 'absolute' : 'fixed', 
                    top: inline ? 0 : '50%', left: inline ? 0 : '50%', 
                    transform: inline ? 'none' : 'translate(-50%,-50%)',
                    width: inline ? '100%' : '95%', 
                    height: inline ? '100%' : undefined,
                    maxWidth: inline ? 'none' : '800px', zIndex: inline ? 1 : 99999,
                    display: 'flex', flexDirection: 'column', background: '#1a1a1a',
                    borderRadius: inline ? 0 : '16px', overflow: 'hidden', 
                    boxShadow: inline ? 'none' : '0 20px 60px rgba(0,0,0,0.6)'
                }}>
                    <div className="media-player-header" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3083FF 0%, #2563eb 100%)', color: 'white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className={`bi ${getFileIcon()}`} style={{ fontSize: '1.2rem' }} />
                            <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700' }}>{title}</h2>
                        </div>
                        <button onClick={onClose} className="media-player-close-btn" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px', background: 'rgba(0,0,0,0.3)',
                            border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
                        }}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div className="media-player-body" style={{ padding: '16px', background: '#111' }}>
                        <video
                            key={fileUrl}
                            src={fileUrl}
                            controls
                            style={{ width: '100%', borderRadius: '8px', outline: 'none' }}
                        />
                    </div>
                </div>
            </>
        );
        return inline ? <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{content}</div> : createPortal(content, document.body);
    }

    // ── AUDIO PLAYER ────────────────────────────────────────────────────
    if (isAudioByExt) {
        const content = (
            <>
                {!inline && <div onClick={onClose} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99990
                }} />}
                <div className="media-player-modal" style={{
                    position: inline ? 'absolute' : 'fixed', 
                    top: inline ? 0 : '50%', left: inline ? 0 : '50%', 
                    transform: inline ? 'none' : 'translate(-50%,-50%)',
                    width: inline ? '100%' : '95%', 
                    height: inline ? '100%' : undefined,
                    maxWidth: inline ? 'none' : '480px', zIndex: inline ? 1 : 99999,
                    display: 'flex', flexDirection: 'column', background: '#1a1a1a',
                    borderRadius: inline ? 0 : '16px', overflow: 'hidden', 
                    boxShadow: inline ? 'none' : '0 20px 60px rgba(0,0,0,0.6)'
                }}>
                    <div className="media-player-header" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3083FF 0%, #2563eb 100%)', color: 'white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className={`bi ${getFileIcon()}`} style={{ fontSize: '1.2rem' }} />
                            <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700' }}>{title}</h2>
                        </div>
                        <button onClick={onClose} className="media-player-close-btn" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px', background: 'rgba(0,0,0,0.3)',
                            border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
                        }}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div className="media-player-body" style={{ padding: '24px 16px', background: '#111', display: 'flex', justifyContent: 'center' }}>
                        <audio
                            key={fileUrl}
                            src={fileUrl}
                            controls
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </>
        );
        return inline ? <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{content}</div> : createPortal(content, document.body);
    }

    // ── PDF / OFFICE / OTHER ────────────────────────────────────────────
    const content = (
        <>
            {!inline && <div onClick={onClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99990
            }} />}
            <div className="pdf-viewer-modal" style={{
                position: inline ? 'absolute' : 'fixed', inset: 0, zIndex: inline ? 1 : 99999,
                display: 'flex', flexDirection: 'column', background: '#ffffff',
                animation: inline ? 'none' : 'pdfSlideUp 0.3s ease-out'
            }}>
                {/* Clean Header - satu baris untuk PDF/Office: Nama File | zoom controls | unduh | close */}
                <div className="viewer-header" style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    color: 'white', flexShrink: 0,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    minHeight: '52px'
                }}>
                    {/* Nama File - kiri */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <i className={`bi ${getFileIcon()} viewer-header-icon`} style={{ fontSize: '1rem', opacity: 0.85, flexShrink: 0 }}></i>
                        <h2 className="viewer-header-title" style={{
                            margin: 0, fontSize: '0.85rem', fontWeight: '600',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            opacity: 0.95
                        }}>{title}</h2>
                        {!loading && numPages && (
                            <span style={{
                                fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)',
                                flexShrink: 0
                            }} className="pdf-pages-badge">
                                {numPages > 1 ? `${currentPage}/${numPages} hal` : `${numPages} hal`}
                            </span>
                        )}
                    </div>

                    {/* Zoom Controls + Actions - kanan (zoom hanya untuk PDF; Office pakai viewer sendiri) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {isPdf && (<>
                        {/* Zoom Out */}
                        <button
                            onClick={() => stepZoom(-1)}
                            disabled={zoomPercent <= MIN_ZOOM}
                            title="Perkecil (Ctrl -)"
                            className="viewer-icon-btn"
                            style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '6px', color: zoomPercent <= MIN_ZOOM ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                                cursor: zoomPercent <= MIN_ZOOM ? 'default' : 'pointer',
                                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { if (zoomPercent > MIN_ZOOM) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        >
                            <i className="bi bi-dash-lg"></i>
                        </button>

                        {/* Persentase Zoom — tap untuk kembali ke 100% */}
                        <button
                            onClick={() => commitZoom(100)}
                            title="Ukuran asli (Ctrl 0)"
                            className="viewer-zoom-text"
                            style={{
                                background: 'transparent', border: 'none', padding: 0,
                                fontSize: '0.75rem', fontWeight: '600', minWidth: '44px', textAlign: 'center',
                                color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums',
                                cursor: 'pointer'
                            }}
                        >{Math.round(zoomPercent)}%</button>

                        {/* Zoom In */}
                        <button
                            onClick={() => stepZoom(1)}
                            disabled={zoomPercent >= maxZoomRef.current}
                            title="Perbesar (Ctrl +)"
                            className="viewer-icon-btn"
                            style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '6px', color: zoomPercent >= maxZoomRef.current ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                                cursor: zoomPercent >= maxZoomRef.current ? 'default' : 'pointer',
                                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { if (zoomPercent < maxZoomRef.current) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        >
                            <i className="bi bi-plus-lg"></i>
                        </button>

                        {/* Fit lebar halaman */}
                        <button
                            onClick={handleFitToggle}
                            title={isFitWidth ? 'Ukuran asli (100%)' : 'Sesuaikan lebar halaman'}
                            className={`viewer-icon-btn ${isFitWidth ? 'is-active' : ''}`}
                            style={{
                                background: isFitWidth ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '6px', color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
                                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', transition: 'all 0.2s ease', marginLeft: '4px'
                            }}
                        >
                            <i className={`bi ${isFitWidth ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`}></i>
                        </button>
                        </>)}

                        {/* Separator */}
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 6px' }} />

                        {/* Unduh */}
                        <button onClick={handleDownload} title="Download" className="viewer-icon-btn" style={{
                            background: 'rgba(255,255,255,0.08)', border: 'none',
                            borderRadius: '6px', color: 'rgba(255,255,255,0.7)',
                            cursor: 'pointer', width: '30px', height: '30px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', transition: 'all 0.2s ease'
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        >
                            <i className="bi bi-download"></i>
                        </button>

                        {/* Close */}
                        <button onClick={onClose} title="Tutup" className="viewer-close-btn" style={{
                            background: 'rgba(255,255,255,0.05)', border: 'none',
                            borderRadius: '6px', color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer', width: '30px', height: '30px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.9rem', transition: 'all 0.2s ease', marginLeft: '2px'
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="viewer-content-body" style={{ flex: 1, overflow: 'hidden', background: '#333' }}>
                    {loading && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', height: '100%', gap: '16px', color: 'white'
                        }}>
                            <div style={{
                                width: '44px', height: '44px',
                                border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'white',
                                borderRadius: '50%', animation: 'pdfSpin 0.9s linear infinite'
                            }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{progress}</span>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', height: '100%', gap: '14px',
                            color: '#f87171', textAlign: 'center', padding: '24px'
                        }}>
                            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '3rem' }} />
                            <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '260px', lineHeight: 1.5 }}>{error}</p>
                            <button onClick={handleDownload} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '10px 20px', background: '#3083FF', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '0.85rem',
                                fontWeight: '600', cursor: 'pointer', marginTop: '4px'
                            }}>
                                <i className="bi bi-download"></i> Download
                            </button>
                        </div>
                    )}

                    {blobUrl && !loading && !error && isPdf && (() => {
                        const scale = renderPercent / 100;
                        return (
                            <div className="pdf-scroll-area" style={{
                                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                background: '#0f1117', position: 'relative'
                            }}>
                                {/* PDF Content - ALL PAGES - Scrollable + pinch-to-zoom */}
                                <div
                                    ref={pdfScrollRef}
                                    className="pdf-scroll"
                                    style={{
                                        flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch',
                                        // pan-x/pan-y: geser 1 jari tetap scroll, pinch 2 jari ditangani sendiri
                                        touchAction: 'pan-x pan-y',
                                        overscrollBehavior: 'contain'
                                    }}
                                >
                                  <div
                                    className="pdf-content"
                                    style={{
                                        transform: viewScale !== 1 ? `scale(${viewScale})` : undefined,
                                        transformOrigin: `${origin.x}px ${origin.y}px`,
                                        willChange: viewScale !== 1 ? 'transform' : undefined
                                    }}
                                  >
                                    <Document
                                        file={blobUrl}
                                        onLoadSuccess={({ numPages }) => {
                                            setNumPages(numPages)
                                            pageDimsRef.current = {} // reset on new document
                                            setDimsTick(t => t + 1)
                                        }}
                                        onLoadError={(err) => {
                                            console.error('[PDFViewer] Document load error:', err);
                                            setError('Gagal membaca berkas PDF: ' + (err?.message || 'Format tidak valid'));
                                            setNumPages(null);
                                        }}
                                        loading={
                                            <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px' }}>
                                                <div style={{ width: '44px', height: '44px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'pdfSpin 0.8s linear infinite' }}></div>
                                                <span style={{ fontSize: '0.9rem' }}>Memuat PDF...</span>
                                            </div>
                                        }
                                        error={
                                            <div style={{ color: '#f87171', textAlign: 'center', padding: '40px' }}>
                                                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2.5rem' }}></i>
                                                <p style={{ margin: '12px 0 0' }}>Gagal memuat PDF</p>
                                            </div>
                                        }
                                    >
                                        {Array.from(new Array(numPages || 0), (el, index) => {
                                            const pageNo = index + 1
                                            // Hanya halaman di sekitar viewport yang dirasterisasi;
                                            // sisanya placeholder seukuran halaman aslinya.
                                            const inWindow = pageNo >= win.start && pageNo <= win.end
                                            const dim = pageDimsRef.current[pageNo] || pageDimsRef.current[1]
                                            return (
                                                <div
                                                    key={`page-${pageNo}`}
                                                    className="pdf-page-wrap"
                                                    data-pdf-page={pageNo}
                                                    style={{
                                                        position: 'relative',
                                                        background: 'white',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                        borderRadius: '2px',
                                                        overflow: 'hidden',
                                                        lineHeight: 0,
                                                        margin: '0 auto 24px',
                                                        width: dim ? `${Math.round(dim.width * scale)}px` : 'max-content',
                                                        height: dim ? `${Math.round(dim.height * scale)}px` : undefined,
                                                    }}
                                                >
                                                    {/* Bitmap render sebelumnya — menutup jeda saat canvas dirender ulang */}
                                                    <div className="pdf-snap" aria-hidden="true" />
                                                    {inWindow && (
                                                        <PageErrorBoundary pageNo={pageNo}>
                                                            <Page
                                                                pageNumber={pageNo}
                                                                scale={scale}
                                                                renderTextLayer={false}
                                                                renderAnnotationLayer={false}
                                                                canvasRef={(node) => { node?.classList.add('pdf-live') }}
                                                                onRenderSuccess={() => clearSnapshot(pageNo)}
                                                                onRenderError={(err) => { console.warn(`Page ${pageNo} render error:`, err); }}
                                                                onLoadError={(err) => { console.warn(`Page ${pageNo} load error:`, err); }}
                                                                onLoadSuccess={(page) => {
                                                                    // Store the natural viewport of this page
                                                                    // page.originalWidth / originalHeight come from the PDF page's mediaBox
                                                                    const vp = page.getViewport({ scale: 1 })
                                                                    const known = pageDimsRef.current[pageNo]
                                                                    if (!known || known.width !== vp.width || known.height !== vp.height) {
                                                                        pageDimsRef.current[pageNo] = { width: vp.width, height: vp.height }
                                                                        setDimsTick(t => t + 1)
                                                                    }
                                                                    if (pageNo === 1) {
                                                                        // Batas zoom disesuaikan ukuran halaman supaya canvas
                                                                        // tidak melewati anggaran piksel (halaman A3/poster)
                                                                        maxZoomRef.current = Math.max(150, Math.min(MAX_ZOOM,
                                                                            Math.floor(Math.sqrt(MAX_CANVAS_PIXELS / (vp.width * vp.height)) * 20) * 5))
                                                                    }
                                                                    // Sekali per dokumen: kecilkan otomatis supaya lebar halaman
                                                                    // pas di layar (penting di tablet/HP), lalu user bisa pinch bebas.
                                                                    if (pageNo === 1 && !autoFitRef.current) {
                                                                        autoFitRef.current = true
                                                                        const fit = fitWidthPercent()
                                                                        if (fit && fit < zoomRef.current) {
                                                                            zoomRef.current = fit
                                                                            renderRef.current = fit
                                                                            setZoomPercent(fit)
                                                                            setRenderPercent(fit)
                                                                        }
                                                                        centerHorizontally()
                                                                    }
                                                                }}
                                                                // Do NOT set width/height — let react-pdf use the page's natural dimensions
                                                                // Each page will render at its own natural size * scale,
                                                                // so landscape pages will be wider than portrait pages automatically.
                                                            />
                                                        </PageErrorBoundary>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </Document>
                                  </div>
                                </div>

                                {/* Indikator halaman - muncul saat scroll */}
                                {(numPages || 0) > 1 && (
                                    <div style={{
                                        position: 'absolute', bottom: '16px', left: '50%',
                                        transform: `translateX(-50%) translateY(${showPagePill ? '0' : '10px'})`,
                                        opacity: showPagePill ? 1 : 0,
                                        transition: 'opacity 0.25s ease, transform 0.25s ease',
                                        pointerEvents: 'none',
                                        background: 'rgba(15,17,23,0.85)', color: 'rgba(255,255,255,0.9)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                                        padding: '6px 14px', borderRadius: '999px',
                                        fontSize: '0.72rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
                                    }}>
                                        Halaman {currentPage} / {numPages}
                                    </div>
                                )}
                            </div>
                        );
                    })()}


                    {isExcel && excelData.length > 0 && !loading && !error && (
                        <div className="excel-container" style={{
                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                            background: '#f8f9fa'
                        }}>
                            {/* Excel Sheet Tabs */}
                            {excelData.length > 1 && (
                                <div className="excel-tabs" style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '10px 16px', background: 'white',
                                    borderBottom: '1px solid #e5e7eb', flexShrink: 0,
                                    overflowX: 'auto'
                                }}>
                                    <i className="bi bi-table" style={{ color: '#16a34a', marginRight: '8px', fontSize: '1rem', flexShrink: 0 }}></i>
                                    {excelData.map((sheet, idx) => (
                                        <button
                                            key={sheet.sheetName}
                                            onClick={() => setActiveSheetIndex(idx)}
                                            className={`excel-tab-btn touch-btn ${activeSheetIndex === idx ? 'is-active' : ''}`}
                                            style={{
                                                background: activeSheetIndex === idx ? '#16a34a' : '#f3f4f6',
                                                color: activeSheetIndex === idx ? 'white' : '#374151'
                                            }}
                                        >
                                            <i className={`bi ${activeSheetIndex === idx ? 'bi-check-circle-fill' : 'bi-circle'}`}
                                                style={{ marginRight: '6px', fontSize: '0.7rem' }}></i>
                                            {sheet.sheetName}
                                            <span style={{
                                                marginLeft: '8px', padding: '2px 6px', borderRadius: '10px',
                                                fontSize: '0.65rem', background: activeSheetIndex === idx ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                                                color: activeSheetIndex === idx ? 'white' : '#6b7280'
                                            }}>
                                                {sheet.data.length}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Excel Data Table - Scrollable */}
                            <div className="excel-table-wrap" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                                {excelData[activeSheetIndex] && excelData[activeSheetIndex].data.length > 0 ? (
                                    <table className="excel-table" style={{
                                        borderCollapse: 'collapse', width: 'max-content', minWidth: '100%',
                                        fontSize: '0.8rem', color: '#333', fontFamily: 'sans-serif',
                                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: 'white',
                                        borderRadius: '8px', overflow: 'hidden'
                                    }}>
                                        <tbody>
                                            {excelData[activeSheetIndex].data.map((row, rowIndex) => (
                                                <tr key={rowIndex} style={{
                                                    borderBottom: rowIndex < excelData[activeSheetIndex].data.length - 1 ? '1px solid #f3f4f6' : 'none'
                                                }}>
                                                    <td style={{
                                                        padding: '8px 12px', border: '1px solid #f3f4f6',
                                                        background: '#f9fafb', color: 'var(--n-muted)',
                                                        fontSize: '0.7rem', fontWeight: '600', minWidth: '40px',
                                                        textAlign: 'center'
                                                    }}>
                                                        {rowIndex + 1}
                                                    </td>
                                                    {row.map((cell: any, cellIndex: number) => (
                                                        <td key={cellIndex} style={{
                                                            padding: '8px 12px', border: '1px solid #f3f4f6',
                                                            background: rowIndex === 0 ? '#f0fdf4' : 'white',
                                                            fontWeight: rowIndex === 0 ? '700' : '400',
                                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                            maxWidth: '300px'
                                                        }}>
                                                            {cell !== null && cell !== undefined ? String(cell) : ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                                        <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.4 }}></i>
                                        <p style={{ margin: '16px 0 0', fontSize: '0.9rem' }}>Sheet kosong</p>
                                    </div>
                                )}
                            </div>

                            {/* Excel Footer Info */}
                            <div className="excel-footer" style={{
                                padding: '10px 16px', background: 'white',
                                borderTop: '1px solid #e5e7eb', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>
                                    <i className="bi bi-file-earmark-excel" style={{ color: '#16a34a', marginRight: '6px' }}></i>
                                    {excelData[activeSheetIndex]?.sheetName}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>
                                    {excelData[activeSheetIndex]?.data.length || 0} baris × {(excelData[activeSheetIndex]?.data[0]?.length || 0)} kolom
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Dokumen Word — dirender lokal, tanpa layanan pihak ketiga */}
                    {wordHtml !== null && !loading && !error && (
                        <div className="word-container" style={{
                            width: '100%', height: '100%', overflow: 'auto', background: '#f1f3f5',
                            padding: '24px 12px',
                        }}>
                            <div
                                className="word-page"
                                style={{
                                    maxWidth: '820px', margin: '0 auto', background: 'white',
                                    padding: 'clamp(24px, 5vw, 64px)', borderRadius: '4px',
                                    boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
                                    fontFamily: "'Times New Roman', Times, serif",
                                    fontSize: '1rem', lineHeight: 1.6, color: '#111',
                                    // Zoom memakai mesin yang sama dengan viewer PDF supaya
                                    // kontrol di toolbar tetap berlaku untuk Word.
                                    transform: `scale(${zoomPercent / 100})`,
                                    transformOrigin: 'top center',
                                }}
                                dangerouslySetInnerHTML={{ __html: wordHtml }}
                            />
                        </div>
                    )}

                    {/* Format yang memang tidak bisa dirender di peramban.
                        Sebelumnya di sini ada iframe view.officeapps.live.com, yang
                        mengirim URL berkas ke pihak ketiga dan hanya berfungsi untuk
                        berkas yang bisa diambil publik. */}
                    {tidakDidukung && !loading && !error && (
                        <div style={{
                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '18px',
                            padding: '32px', textAlign: 'center',
                        }}>
                            <i className={getFileIcon()} style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.45)' }} />
                            <div>
                                <div style={{ color: 'white', fontWeight: 600, marginBottom: '6px' }}>
                                    Format ini belum bisa ditampilkan di layar
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', maxWidth: '420px' }}>
                                    Silakan unduh berkasnya untuk dibuka dengan aplikasi di perangkat Anda.
                                </div>
                            </div>
                            <a
                                href={fileUrl}
                                download={downloadName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="office-btn touch-btn"
                                style={{
                                    background: 'rgba(255,255,255,0.15)', color: 'white',
                                    textDecoration: 'none', padding: '10px 20px', borderRadius: '8px',
                                }}
                            >
                                <i className="bi bi-download" /> <span className="btn-text">Unduh Berkas</span>
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="viewer-footer">
                    <span className="viewer-footer-text">
                        Tekan <strong className="viewer-footer-key">ESC</strong> untuk menutup
                    </span>
                </div>

                <style>{`
                    @keyframes pdfSlideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes pdfSpin {
                        to { transform: rotate(360deg); }
                    }
                    button:active {
                        opacity: 0.7; transform: scale(0.95);
                    }

                    .viewer-footer {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 10px;
                        background: #f5f5f5;
                        border-top: 1px solid #e5e5e5;
                        flex-shrink: 0;
                    }
                    .viewer-footer-text {
                        font-size: 0.7rem;
                        color: #888888;
                    }
                    .viewer-footer-key {
                        color: #333333;
                    }

                    /* =========================================
                       DARK MODE (Google One Theme)
                       ========================================= */
                    :global(.dark) .pdf-viewer-modal,
                    .dark .pdf-viewer-modal {
                        background: #0b1329 !important;
                    }

                    :global(.dark) .viewer-header,
                    .dark .viewer-header {
                        background: #0b1329 !important;
                        border-bottom: 1.5px solid rgba(59, 130, 246, 0.4) !important;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8) !important;
                    }

                    :global(.dark) .viewer-header-title,
                    .dark .viewer-header-title {
                        color: #e2e8f0 !important;
                    }

                    :global(.dark) .viewer-header-icon,
                    .dark .viewer-header-icon {
                        color: #60a5fa !important;
                    }

                    :global(.dark) .pdf-pages-badge,
                    .dark .pdf-pages-badge {
                        background: rgba(37, 99, 235, 0.2) !important;
                        color: #93c5fd !important;
                        border: 1px solid rgba(59, 130, 246, 0.4) !important;
                        border-radius: 6px !important;
                        padding: 2px 8px !important;
                    }

                    :global(.dark) .viewer-icon-btn,
                    .dark .viewer-icon-btn {
                        background: rgba(37, 99, 235, 0.15) !important;
                        border: 1.5px solid rgba(59, 130, 246, 0.45) !important;
                        color: #93c5fd !important;
                        border-radius: 6px !important;
                    }

                    :global(.dark) .viewer-icon-btn:hover,
                    .dark .viewer-icon-btn:hover {
                        background: #1a73e8 !important;
                        color: #ffffff !important;
                        border-color: #3b82f6 !important;
                        box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important;
                    }

                    :global(.dark) .viewer-icon-btn.is-active,
                    .dark .viewer-icon-btn.is-active {
                        background: #1a73e8 !important;
                        border-color: #3b82f6 !important;
                        color: #ffffff !important;
                        box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important;
                    }

                    :global(.dark) .viewer-zoom-text,
                    .dark .viewer-zoom-text {
                        color: #e2e8f0 !important;
                    }

                    :global(.dark) .viewer-close-btn,
                    .dark .viewer-close-btn {
                        background: rgba(239, 68, 68, 0.15) !important;
                        border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
                        color: #f87171 !important;
                        border-radius: 6px !important;
                    }

                    :global(.dark) .viewer-close-btn:hover,
                    .dark .viewer-close-btn:hover {
                        background: #dc2626 !important;
                        color: #ffffff !important;
                        border-color: #ef4444 !important;
                    }

                    :global(.dark) .viewer-content-body,
                    .dark .viewer-content-body,
                    :global(.dark) .pdf-scroll-area,
                    .dark .pdf-scroll-area,
                    :global(.dark) .pdf-scroll,
                    .dark .pdf-scroll,
                    :global(.dark) .pdf-content,
                    .dark .pdf-content {
                        background: #0b1329 !important;
                    }

                    :global(.dark) .pdf-page-wrap,
                    .dark .pdf-page-wrap {
                        background: #ffffff !important;
                        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.95) !important;
                        border-radius: 4px !important;
                        border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    }

                    :global(.dark) .viewer-footer,
                    .dark .viewer-footer {
                        background: #0b1329 !important;
                        border-top: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.8) !important;
                    }

                    :global(.dark) .viewer-footer-text,
                    .dark .viewer-footer-text {
                        color: #94a3b8 !important;
                    }

                    :global(.dark) .viewer-footer-key,
                    .dark .viewer-footer-key {
                        color: #38bdf8 !important;
                        background: rgba(56, 189, 248, 0.15) !important;
                        padding: 2px 6px !important;
                        border-radius: 4px !important;
                        border: 1px solid rgba(56, 189, 248, 0.3) !important;
                    }

                    /* Excel Dark Mode */
                    :global(.dark) .excel-container,
                    .dark .excel-container {
                        background: #0b1329 !important;
                    }

                    :global(.dark) .excel-tabs,
                    .dark .excel-tabs {
                        background: #0b1329 !important;
                        border-bottom: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                    }

                    :global(.dark) .excel-tab-btn,
                    .dark .excel-tab-btn {
                        background: #0b1329 !important;
                        border: 1.5px solid rgba(59, 130, 246, 0.45) !important;
                        color: #cbd5e1 !important;
                        border-radius: 6px !important;
                    }

                    :global(.dark) .excel-tab-btn.is-active,
                    .dark .excel-tab-btn.is-active {
                        background: #1a73e8 !important;
                        border-color: #3b82f6 !important;
                        color: #ffffff !important;
                        box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important;
                    }

                    :global(.dark) .excel-table-wrap,
                    .dark .excel-table-wrap {
                        background: #0b1329 !important;
                    }

                    :global(.dark) .excel-table,
                    .dark .excel-table {
                        background: #0b1329 !important;
                        border: 1.5px solid rgba(59, 130, 246, 0.4) !important;
                        color: #cbd5e1 !important;
                    }

                    :global(.dark) .excel-table tr:first-child td {
                        background: rgba(37, 99, 235, 0.22) !important;
                        color: #93c5fd !important;
                        border-color: rgba(59, 130, 246, 0.35) !important;
                        font-weight: 700 !important;
                    }

                    :global(.dark) .excel-table td {
                        background: #0b1329 !important;
                        color: #cbd5e1 !important;
                        border-color: rgba(59, 130, 246, 0.2) !important;
                    }

                    :global(.dark) .excel-table td:first-child {
                        background: rgba(37, 99, 235, 0.1) !important;
                        color: #94a3b8 !important;
                        border-color: rgba(59, 130, 246, 0.25) !important;
                    }

                    :global(.dark) .excel-footer,
                    .dark .excel-footer {
                        background: #0b1329 !important;
                        border-top: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                        color: #94a3b8 !important;
                    }

                    /* Office Fallback Dark Mode */
                    :global(.dark) .office-toolbar,
                    .dark .office-toolbar {
                        background: #0b1329 !important;
                        border-bottom: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                    }

                    :global(.dark) .office-btn,
                    .dark .office-btn {
                        background: rgba(37, 99, 235, 0.15) !important;
                        border: 1.5px solid rgba(59, 130, 246, 0.45) !important;
                        color: #93c5fd !important;
                        border-radius: 6px !important;
                    }

                    :global(.dark) .office-btn:hover,
                    .dark .office-btn:hover {
                        background: #1a73e8 !important;
                        color: #ffffff !important;
                        border-color: #3b82f6 !important;
                        box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important;
                    }

                    :global(.dark) .office-notice,
                    .dark .office-notice {
                        background: #0b1329 !important;
                        border-top: 1.5px solid rgba(59, 130, 246, 0.35) !important;
                        color: #94a3b8 !important;
                    }

                    /* Media Player (Audio/Video) Dark Mode */
                    :global(.dark) .media-player-modal,
                    .dark .media-player-modal {
                        background: #0b1329 !important;
                        border: 1px solid rgba(37, 99, 235, 0.4) !important;
                        box-shadow: 0 0 30px rgba(26, 115, 232, 0.3) !important;
                    }

                    :global(.dark) .media-player-header,
                    .dark .media-player-header {
                        background: #0b1329 !important;
                        border-bottom: 1.5px solid rgba(59, 130, 246, 0.4) !important;
                    }

                    :global(.dark) .media-player-close-btn,
                    .dark .media-player-close-btn {
                        background: rgba(239, 68, 68, 0.15) !important;
                        border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
                        color: #f87171 !important;
                        border-radius: 6px !important;
                    }

                    :global(.dark) .media-player-body,
                    .dark .media-player-body {
                        background: #0b1329 !important;
                    }

                    /* =========================================
                       MOBILE RESPONSIVE STYLES
                       ========================================= */

                    /* Mobile Toolbar - PDF Viewer */
                    .pdf-toolbar {
                        display: flex !important;
                        flex-wrap: wrap !important;
                        gap: 10px !important;
                        justify-content: space-between !important;
                        padding: 10px 12px !important;
                    }

                    /* PDF scroll area + lapisan konten yang di-transform saat pinch */
                    .pdf-scroll {
                        width: 100% !important;
                    }

                    .pdf-content {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        width: max-content !important;
                        min-width: 100% !important;
                        padding: 12px !important;
                        box-sizing: border-box !important;
                    }

                    /* PDF Page - natural size per page (portrait/landscape) */
                    .pdf-page-wrap {
                        background: white !important;
                        box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
                        border-radius: 4px !important;
                        overflow: hidden !important;
                        margin-bottom: 8px !important;
                    }

                    .pdf-page-wrap canvas {
                        display: block !important;
                    }

                    /* Canvas asli selalu di atas snapshot (keduanya positioned → z-index yang menentukan) */
                    .pdf-page-wrap .react-pdf__Page {
                        position: relative !important;
                        z-index: 1 !important;
                    }

                    .pdf-snap {
                        position: absolute !important;
                        inset: 0 !important;
                        z-index: 0 !important;
                        overflow: hidden !important;
                        pointer-events: none !important;
                    }

                    .pdf-page-wrap .react-pdf__Page__textContent,
                    .pdf-page-wrap .react-pdf__Page__annotations {
                        /* Let text/annotation layers follow canvas size */
                    }

                    /* Touch-friendly buttons on mobile */
                    .pdf-toolbar-btn {
                        min-width: 44px !important;
                        min-height: 44px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        border-radius: 10px !important;
                        font-size: 1.1rem !important;
                        background: rgba(255,255,255,0.15) !important;
                        border: none !important;
                        color: white !important;
                        cursor: pointer !important;
                        touch-action: manipulation !important;
                        -webkit-tap-highlight-color: transparent !important;
                        padding: 10px !important;
                        transition: all 0.15s ease !important;
                    }

                    .pdf-toolbar-btn:hover {
                        background: rgba(255,255,255,0.25) !important;
                    }

                    .pdf-toolbar-btn:active {
                        transform: scale(0.92) !important;
                        background: rgba(255,255,255,0.3) !important;
                    }

                    .pdf-toolbar-btn:disabled {
                        opacity: 0.3 !important;
                        cursor: not-allowed !important;
                    }

                    .pdf-zoom-display {
                        background: rgba(255,255,255,0.15) !important;
                        padding: 8px 12px !important;
                        border-radius: 10px !important;
                        font-size: 0.85rem !important;
                        min-width: 55px !important;
                        text-align: center !important;
                    }

                    /* Mobile Header - Smaller and more compact */
                    .viewer-header {
                        padding: 10px 12px !important;
                    }

                    .viewer-header-icon {
                        width: 32px !important;
                        height: 32px !important;
                        border-radius: 8px !important;
                        font-size: 1rem !important;
                    }

                    .viewer-header h2 {
                        font-size: 0.8rem !important;
                    }

                    .viewer-header p {
                        font-size: 0.6rem !important;
                    }

                    .viewer-header-btn {
                        width: 40px !important;
                        height: 40px !important;
                        border-radius: 10px !important;
                        min-width: 40px !important;
                        min-height: 40px !important;
                    }

                    /* Mobile Excel Sheet Tabs */
                    .excel-tabs {
                        padding: 8px 12px !important;
                        gap: 6px !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                        scroll-snap-type: x mandatory !important;
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                    }

                    .excel-tabs::-webkit-scrollbar {
                        display: none !important;
                    }

                    .excel-tab-btn {
                        padding: 10px 16px !important;
                        border-radius: 12px !important;
                        font-size: 0.8rem !important;
                        min-height: 44px !important;
                        white-space: nowrap !important;
                        scroll-snap-align: start !important;
                        flex-shrink: 0 !important;
                        border: none !important;
                        cursor: pointer !important;
                        touch-action: manipulation !important;
                        -webkit-tap-highlight-color: transparent !important;
                        transition: all 0.2s ease !important;
                    }

                    .excel-tab-btn:active {
                        transform: scale(0.95) !important;
                    }

                    /* Mobile Excel Table */
                    .excel-table-wrap {
                        padding: 8px !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                    }

                    .excel-table {
                        font-size: 0.75rem !important;
                        border-radius: 12px !important;
                        overflow: hidden !important;
                    }

                    .excel-table td {
                        padding: 10px 12px !important;
                        max-width: 150px !important;
                    }

                    .excel-footer {
                        padding: 8px 12px !important;
                        font-size: 0.7rem !important;
                        flex-wrap: wrap !important;
                        gap: 4px !important;
                        justify-content: center !important;
                    }

                    /* Mobile Footer */
                    .viewer-footer {
                        padding: 8px !important;
                        font-size: 0.65rem !important;
                    }

                    /* Mobile Office Viewer */
                    .office-toolbar {
                        flex-wrap: wrap !important;
                        gap: 8px !important;
                        padding: 10px 12px !important;
                    }

                    .office-btn {
                        padding: 10px 14px !important;
                        border-radius: 10px !important;
                        font-size: 0.75rem !important;
                        min-height: 44px !important;
                        min-width: 44px !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 6px !important;
                        touch-action: manipulation !important;
                        -webkit-tap-highlight-color: transparent !important;
                        border: none !important;
                        cursor: pointer !important;
                        transition: all 0.15s ease !important;
                    }

                    .office-btn:active {
                        transform: scale(0.95) !important;
                    }

                    .office-notice {
                        font-size: 0.6rem !important;
                        padding: 6px 12px !important;
                        text-align: center !important;
                    }

                    /* Touch feedback for all buttons */
                    .touch-btn {
                        -webkit-tap-highlight-color: rgba(255,255,255,0.1) !important;
                        touch-action: manipulation !important;
                        user-select: none !important;
                        -webkit-user-select: none !important;
                    }

                    /* Very small screens (iPhone SE size) */
                    @media (max-width: 374px) {
                        .pdf-toolbar {
                            padding: 8px !important;
                            gap: 6px !important;
                        }

                        .viewer-header {
                            padding: 8px !important;
                        }

                        .viewer-header h2 {
                            font-size: 0.75rem !important;
                        }

                        .pdf-toolbar-btn {
                            min-width: 40px !important;
                            min-height: 40px !important;
                            padding: 8px !important;
                        }

                        .pdf-zoom-display {
                            min-width: 48px !important;
                            font-size: 0.75rem !important;
                        }
                    }

                    /* Mobile PDF — canvas TIDAK dipaksa max-width 100%, kalau tidak
                       zoom/pinch di atas lebar layar jadi tidak berpengaruh.
                       Lebar awal sudah diatur otomatis (auto fit width) saat load. */
                    @media (max-width: 767px) {
                        .pdf-content {
                            padding: 8px !important;
                        }
                    }

                    /* Tablets */
                    @media (min-width: 768px) and (max-width: 1024px) {
                        .pdf-toolbar {
                            gap: 16px !important;
                            padding: 12px 20px !important;
                        }
                    }
                `}</style>
            </div>
        </>
    );
    return inline ? <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{content}</div> : createPortal(content, document.body);
}
