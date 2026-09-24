import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decodeSessionCookie } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import DetailAnakClient from './components/DetailAnakClient';

export const metadata = {
    title: 'Detail Anak | ACCA',
};

export default async function AnakDetailPage({ params }: { params: Promise<{ nisn: string }> }) {
    const { nisn } = await params;

    const cookieStore = await cookies();
    const raw = cookieStore.get('acca_session')?.value || '';
    const token = decodeSessionCookie(raw);
    if (!token) {
        redirect('/login');
    }

    // Kepemilikan relasi & pengambilan profil diverifikasi backend NestJS
    // (PostgreSQL VPS) dalam satu panggilan — halaman ini tidak lagi bertanya
    // langsung ke database.
    const { status, body } = await nestFetchAsUser(`/orangtua/anak/${encodeURIComponent(nisn)}`, token);

    if (status === 401) {
        redirect('/login');
    }
    if (status === 403) {
        return (
            <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                    <i className="bi bi-shield-lock" style={{ fontSize: '4rem', color: '#ef4444', marginBottom: '1rem' }}></i>
                    <h2>Akses Ditolak</h2>
                    <p style={{ color: '#64748b' }}>Anda tidak memiliki akses untuk melihat data siswa dengan NISN {nisn}.</p>
                </div>
            </div>
        );
    }
    if (status === 404) {
        notFound();
    }
    if (status !== 200 || !body?.data) {
        redirect('/dashboard');
    }

    return <DetailAnakClient siswa={body.data} />;
}
