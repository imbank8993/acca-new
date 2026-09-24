import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import 'bootstrap-icons/font/bootstrap-icons.css';

export const dynamic = 'force-dynamic';

export default async function LckhVerificationPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    
    if (!code) return notFound();

    const submission = await prisma.lckh_submissions.findFirst({
        where: { approval_code: code }
    });

    if (!submission) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
                <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center border border-gray-100">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5">
                        <i className="bi bi-x-circle text-4xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Dokumen Tidak Valid</h1>
                    <p className="text-gray-600 mb-8">Kode verifikasi <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-red-500">{code}</span> tidak ditemukan atau dokumen belum disetujui.</p>
                    <Link href="/login" className="inline-block bg-[#1e3a5f] text-white px-8 py-2.5 rounded-md hover:bg-[#152a46] transition font-medium">
                        Ke Beranda
                    </Link>
                </div>
            </div>
        );
    }

    const period = submission.periode_kode
        ? await prisma.lckh_periods.findFirst({
            where: { periode_kode: submission.periode_kode }
        })
        : null;

    const profil = await prisma.profil_sekolah.findFirst();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-xl w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 relative z-10">
                <div className="bg-emerald-600 px-6 py-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 10%)', backgroundSize: '20px 20px' }}></div>
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
                        <i className="bi bi-patch-check-fill text-6xl text-emerald-500"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1 relative z-10">Dokumen Valid & Resmi</h1>
                    <p className="text-emerald-100 text-sm relative z-10">Telah diverifikasi oleh sistem LCKH Digital</p>
                </div>
                
                <div className="p-8">
                    <div className="text-center mb-8 pb-6 border-b border-gray-100">
                        {profil?.logo_url && <img src={profil.logo_url} alt="Logo" className="w-20 h-20 mx-auto mb-4 object-contain drop-shadow-sm" />}
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">{profil?.nama || 'MIN 1 KOTA MALANG'}</h2>
                        <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">{profil?.alamat}</p>
                    </div>

                    <dl className="space-y-5">
                        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-50 pb-4">
                            <dt className="text-sm font-medium text-gray-500 mb-1 sm:mb-0">Nama Guru</dt>
                            <dd className="text-sm font-bold text-gray-900 sm:text-right">{submission.nama_guru_snap}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-50 pb-4">
                            <dt className="text-sm font-medium text-gray-500 mb-1 sm:mb-0">NIP</dt>
                            <dd className="text-sm font-medium text-gray-800 sm:text-right">{submission.nip}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-50 pb-4">
                            <dt className="text-sm font-medium text-gray-500 mb-1 sm:mb-0">Periode LCKH</dt>
                            <dd className="text-sm font-bold text-gray-900 sm:text-right">{period?.periode_nama || submission.periode_kode}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-50 pb-4">
                            <dt className="text-sm font-medium text-gray-500 mb-1 sm:mb-0">Status Persetujuan</dt>
                            <dd className="text-sm font-bold text-emerald-600 sm:text-right flex items-center justify-start sm:justify-end gap-1.5">
                                <i className="bi bi-check2-all"></i>
                                {submission.status?.replace('_', ' ') || '-'}
                            </dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-50 pb-4">
                            <dt className="text-sm font-medium text-gray-500 mb-1 sm:mb-0">Kode Verifikasi</dt>
                            <dd className="text-sm font-mono font-semibold text-[#1e3a5f] bg-blue-50 px-3 py-1 rounded-md sm:text-right self-start sm:self-auto shadow-sm border border-blue-100">
                                {submission.approval_code}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-10 text-center">
                        <Link href="/login" className="inline-block w-full sm:w-auto bg-[#1e3a5f] text-white px-10 py-3 rounded-lg hover:bg-[#152a46] transition font-medium shadow-md hover:shadow-lg">
                            Menuju Sistem
                        </Link>
                    </div>
                </div>
            </div>
            
            <div className="fixed bottom-6 text-center w-full text-xs text-gray-400 z-0">
                &copy; {new Date().getFullYear()} e-Supervisi & LCKH System
            </div>
        </div>
    );
}
