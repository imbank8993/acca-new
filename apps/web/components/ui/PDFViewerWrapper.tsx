'use client'

import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/Spinner'

// Use next/dynamic with ssr: false to properly isolate react-pdf and pdfjs-dist
// from Next.js Server Components and avoid Webpack eval chunk evaluation bugs.
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
    ssr: false,
    loading: () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#fff' }}>
            <Spinner size={18} dotsOnly />
        </div>
    )
})

export default function PDFViewerWrapper(props: {
    url: string
    title: string
    onClose: () => void
    inline?: boolean
    onPrevious?: () => void
    onNext?: () => void
    positionLabel?: string
}) {
    return <PDFViewer {...props} />
}