'use client';

import { useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DocViewerModalProps {
    fileUrl: string;
    title?: string;
    onClose: () => void;
}

/**
 * In-app File & Document Viewer Modal
 * Menampilkan berkas (foto/gambar bukti, dokumen PDF) secara langsung di dalam modal
 * tanpa mengekspos link mentah lokasi file atau endpoint backend ke user.
 */
export default function DocViewerModal({ fileUrl, title, onClose }: DocViewerModalProps) {
    const [loading, setLoading] = useState(true);

    if (!fileUrl) return null;

    const isPdf = fileUrl.toLowerCase().includes('.pdf') || fileUrl.startsWith('data:application/pdf') || fileUrl.includes('application/pdf');

    return (
        <Modal size="xl" className="dvm-modal" onClose={onClose} labelledBy="doc-viewer-title">
            <ModalHeader
                id="doc-viewer-title"
                icon={isPdf ? 'file-earmark-pdf' : 'image'}
                title={title || (isPdf ? 'Pratinjau Dokumen PDF' : 'Pratinjau Berkas')}
                onClose={onClose}
            />
            <ModalBody className="dvm-canvas">
                {loading && (
                    <div className="dvm-loading">
                        <div className="dvm-spinner" />
                        <span>Memuat berkas...</span>
                    </div>
                )}
                {isPdf ? (
                    <iframe
                        src={fileUrl}
                        className="dvm-iframe"
                        style={{ opacity: loading ? 0 : 1 }}
                        onLoad={() => setLoading(false)}
                        title={title || 'Pratinjau Dokumen'}
                    />
                ) : (
                    <div className="dvm-img-wrap" style={{ opacity: loading ? 0 : 1 }}>
                        <img
                            src={fileUrl}
                            alt={title || 'Pratinjau Berkas'}
                            className="dvm-img"
                            onLoad={() => setLoading(false)}
                            onError={() => setLoading(false)}
                        />
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>
                    Tutup
                </Button>
            </ModalFooter>

            <style jsx>{`
                :global(.dvm-modal) {
                    height: min(90vh, 900px);
                }
                .dvm-canvas {
                    position: relative;
                    overflow: auto;
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 400px;
                    background: #f8fafc;
                }
                :global(.dark) .dvm-canvas {
                    background: #0f172a;
                }
                .dvm-iframe {
                    width: 100%;
                    max-width: 860px;
                    height: 100%;
                    min-height: 650px;
                    border: none;
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
                    transition: opacity 0.2s ease;
                }
                .dvm-img-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                    transition: opacity 0.2s ease;
                }
                .dvm-img {
                    max-width: 100%;
                    max-height: 75vh;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
                }
                .dvm-loading {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    color: #64748b;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .dvm-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #cbd5e1;
                    border-top-color: #3083ff;
                    border-radius: 50%;
                    animation: dvmSpin 0.8s linear infinite;
                }
                @keyframes dvmSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Modal>
    );
}
