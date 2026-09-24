'use client'

// This file contains ALL react-pdf / pdfjs-dist imports.
// Because this file is ONLY loaded via dynamic() + ssr:false in a
// lazy sub-component, webpack never evaluates this until the component
// is actually rendered in the browser (after all other modules have loaded).
//
// This defeats the Object.defineProperty crash that occurs when
// pdfjs-dist is evaluated during webpack's module initialization phase.
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export { Document, Page, pdfjs }