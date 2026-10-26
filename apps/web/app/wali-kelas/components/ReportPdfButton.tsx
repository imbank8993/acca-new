'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { WaliPdfReport } from '@/lib/wali-kelas-pdf';
import Swal from 'sweetalert2';

export default function ReportPdfButton({ load, filename, contextKey, disabled = false }: {
    load: (signal: AbortSignal) => Promise<WaliPdfReport>;
    filename: string;
    contextKey: string;
    disabled?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const pending = useRef<AbortController | null>(null);
    useEffect(() => {
        setBusy(false);
        return () => { pending.current?.abort(); pending.current = null; };
    }, [contextKey]);
    const download = async () => {
        const controller = new AbortController();
        pending.current?.abort(); pending.current = controller; setBusy(true);
        try {
            const report = await load(controller.signal);
            const { createWaliKelasPdf } = await import('@/lib/wali-kelas-pdf');
            if (controller.signal.aborted) return;
            createWaliKelasPdf(report).save(filename.replace(/[/\\?%*:|"<>]/g, '_') + '.pdf');
        } catch (error) {
            if (!controller.signal.aborted) {
                controller.abort();
                void Swal.fire('Gagal membuat PDF', error instanceof Error ? error.message : 'Data laporan belum dapat dimuat.', 'error');
            }
        } finally {
            if (pending.current === controller) { pending.current = null; setBusy(false); }
        }
    };
    return <Button variant="outline" icon="pdf" className="ftb-btn-icon-mobile" title="Export laporan PDF A4" aria-label="Export PDF A4"
        isLoading={busy} disabled={disabled} onClick={download}>Export PDF</Button>;
}
