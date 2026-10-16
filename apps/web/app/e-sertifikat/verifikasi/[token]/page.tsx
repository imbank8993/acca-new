import type { Metadata } from 'next';
import CertificateVerification from './view';
export const metadata: Metadata = { title: 'Verifikasi Sertifikat | ACCA', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
    return <CertificateVerification token={(await params).token} />;
}
