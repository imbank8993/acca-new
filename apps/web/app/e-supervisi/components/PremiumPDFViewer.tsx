'use client';

import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });

export default function PremiumPDFViewer({ url }: { url: string }) {
    // We use the same viewer as the Informasi page, but rendered inline
    return (
        <div style={{ height: '100%', width: '100%', backgroundColor: '#f1f5f9', position: 'relative' }}>
            <PDFViewer 
                url={url} 
                title="Pratinjau Dokumen" 
                onClose={() => {}} 
                inline={true} 
            />
        </div>
    );
}
