'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface HtmlPreviewModalProps {
    html: string;
    title?: string;
    onClose: () => void;
}

/** Modal generik utk menampilkan dokumen HTML mandiri (KOP+tabel dsb) di
 * dalam iframe — dipakai utk pratinjau laporan tanpa perlu generate PDF.
 * Pakai Blob URL (bukan srcDoc) supaya lebih konsisten dimuat browser dan
 * tidak berpotensi race saat konten iframe berganti. */
export default function HtmlPreviewModal({ html, title, onClose }: HtmlPreviewModalProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!html) { setBlobUrl(null); return; }
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoaded(false);
        return () => URL.revokeObjectURL(url);
    }, [html]);

    return (
        <Modal size="xl" className="hpm-modal" onClose={onClose} labelledBy="html-preview-title">
            <ModalHeader id="html-preview-title" icon="file-earmark-text" title={title || 'Pratinjau Dokumen'} onClose={onClose} />
            <ModalBody className="hpm-canvas">
                    {!html ? (
                        <div className="hpm-msg">
                            <i className="bi bi-exclamation-triangle" />
                            <p>Dokumen kosong — tidak ada data untuk ditampilkan.</p>
                        </div>
                    ) : (
                        <>
                            {!loaded && (
                                <div className="hpm-loading">
                                    <div className="hpm-spinner" />
                                    <span>Memuat pratinjau...</span>
                                </div>
                            )}
                            {blobUrl && (
                                <iframe
                                    src={blobUrl}
                                    className="hpm-iframe"
                                    style={{ opacity: loaded ? 1 : 0 }}
                                    onLoad={() => setLoaded(true)}
                                    title={title || 'Pratinjau Dokumen'}
                                />
                            )}
                        </>
                    )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>Tutup</Button>
            </ModalFooter>

            <style jsx>{`
                :global(.hpm-modal) { height: min(92vh, 960px); }
                .hpm-canvas { position: relative; overflow: hidden; padding: 20px 0; display: flex; justify-content: center; min-height: 0; }
                .hpm-iframe { width: 100%; max-width: 820px; height: 100%; border: none; background: #fff; border-radius: 6px; box-shadow: 0 10px 34px rgba(0,0,0,0.22); transition: opacity 0.25s ease; }
                .hpm-loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #64748b; font-size: 0.82rem; font-weight: 600; }
                .hpm-spinner { width: 32px; height: 32px; border: 3px solid #cbd5e1; border-top-color: var(--n-primary, #3083FF); border-radius: 50%; animation: hpmSpin 0.8s linear infinite; }
                @keyframes hpmSpin { to { transform: rotate(360deg); } }
                .hpm-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; margin: auto; color: #94a3b8; text-align: center; }
                .hpm-msg i { font-size: 2rem; }
                .hpm-msg p { font-size: 0.85rem; margin: 0; }

                @media (max-width: 640px) {
                    .hpm-canvas { padding: 12px; }
                    :global(.hpm-modal) { height: 100vh; }
                }
            `}</style>
        </Modal>
    );
}
