import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import GalleryClient from './GalleryClient'

export const metadata: Metadata = {
    title: 'Dokumentasi Laporan Piket - ACCA',
    // Halaman ini publik (lihat publicPaths di middleware.ts) supaya link di grup WA bisa
    // dibuka tanpa login. Aksesnya bersandar pada UUID laporan yang tak bisa ditebak, jadi
    // mesin pencari tidak boleh mengindeksnya.
    robots: { index: false, follow: false },
}

type Props = {
    params: Promise<{ id: string }>
}

export default async function DokumentasiPiketPage({ params }: Props) {
    const { id } = await params;

    const rawLaporan = await prisma.laporan_piket.findUnique({
        where: { id },
        include: {
            laporan_piket_detail: true,
        },
    });

    if (!rawLaporan) {
        return notFound();
    }

    const laporan = {
        ...rawLaporan,
        details: rawLaporan.laporan_piket_detail,
    };

    const { tanggal, nama_guru_piket, jam_ke, keterangan } = laporan;

    // Format tanggal
    const dateObj = new Date(tanggal);
    const formattedDate = dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const detailsWithDocs = laporan.details
        .filter((d: any) => d.dokumentasi_url)
        .sort((a: any, b: any) => (a.nama_kelas || '').localeCompare(b.nama_kelas || ''));

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-800 dark:text-slate-100 font-sans" style={{ paddingTop: '24px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '32px' }}>
            <div className="w-full flex flex-col gap-4 md:gap-6">
                
                {/* Header Hero Section */}
                <header className="bg-gradient-to-br from-[#3083FF] to-[#c2185b] dark:bg-none dark:bg-black text-white rounded-2xl shadow-md border border-white/10 dark:border-2 dark:border-[#1a73e8] dark:shadow-[0_0_30px_rgba(26,115,232,0.25)] flex flex-col justify-center" style={{ padding: '24px' }}>
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold dark:bg-gradient-to-r dark:from-[#1d6bf3] dark:via-[#3b82f6] dark:to-[#93c5fd] dark:bg-clip-text dark:text-transparent">
                        Galeri Dokumentasi Piket
                    </h1>
                    <p className="text-white/80 dark:text-slate-400 text-xs md:text-sm mt-1.5 md:mt-2 font-medium">{formattedDate}</p>
                </header>

                {/* Info Card - Redesigned for Elegance & Responsive */}
                <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-slate-200 dark:border-[1.8px] dark:border-[rgba(26,115,232,0.75)] overflow-hidden relative">
                    {/* Accent Border */}
                    <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-gradient-to-b from-[#3083FF] to-[#c2185b] dark:from-[#1a73e8] dark:to-[#3b82f6]"></div>
                    
                    <div className="p-4 sm:p-5 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                        {/* Guru Piket */}
                        <div className="flex items-center gap-3 md:gap-4 pl-1 md:pl-0">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-blue-50 dark:bg-[rgba(26,115,232,0.15)] flex items-center justify-center flex-shrink-0 text-[#3083FF] dark:text-[#60a5fa] border border-blue-100 dark:border-[rgba(59,130,246,0.3)] shadow-sm">
                                <i className="bi bi-person-badge text-lg md:text-xl"></i>
                            </div>
                            <div>
                                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-0.5">Guru Piket</p>
                                <p className="text-sm md:text-lg font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{nama_guru_piket}</p>
                            </div>
                        </div>

                        {/* Jam Ke */}
                        <div className="flex items-center gap-3 md:gap-4 pl-1 md:pl-0">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-rose-50 dark:bg-[rgba(26,115,232,0.15)] flex items-center justify-center flex-shrink-0 text-rose-600 dark:text-[#60a5fa] border border-rose-100 dark:border-[rgba(59,130,246,0.3)] shadow-sm">
                                <i className="bi bi-clock-history text-lg md:text-xl"></i>
                            </div>
                            <div>
                                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1">Sesi / Jam Ke</p>
                                <div className="inline-flex items-center justify-center px-2 md:px-3 py-0.5 bg-slate-100 dark:bg-[rgba(26,115,232,0.15)] rounded md:rounded-md text-slate-700 dark:text-[#60a5fa] font-extrabold text-xs md:text-sm border border-slate-200 dark:border-[rgba(59,130,246,0.35)]">
                                    Jam {jam_ke}
                                </div>
                            </div>
                        </div>

                        {/* Catatan Laporan */}
                        {keterangan && (
                            <div className="flex items-start gap-3 md:gap-4 lg:col-span-1 sm:col-span-2 pl-1 md:pl-0">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-amber-50 dark:bg-[rgba(26,115,232,0.15)] flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-[#60a5fa] border border-amber-100 dark:border-[rgba(59,130,246,0.3)] shadow-sm mt-1 md:mt-0">
                                    <i className="bi bi-chat-square-quote text-lg md:text-xl"></i>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1 md:mb-1.5">Catatan Laporan</p>
                                    <div className="bg-slate-50 dark:bg-[rgba(26,115,232,0.06)] p-2 md:p-3 rounded-md md:rounded-lg border border-slate-100 dark:border-[rgba(59,130,246,0.2)] relative">
                                        <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200 italic">"{keterangan}"</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid Content */}
                <main>

                {detailsWithDocs.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-black rounded-2xl border border-dashed border-slate-300 dark:border-[rgba(59,130,246,0.3)] shadow-sm">
                        <div className="text-5xl mb-4 opacity-50">📭</div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-100 mb-2">Belum Ada Dokumentasi</h3>
                        <p className="text-slate-500 dark:text-slate-400">Laporan piket ini tidak menyertakan foto dokumentasi kondisi kelas.</p>
                    </div>
                ) : (
                    <GalleryClient detailsWithDocs={detailsWithDocs} />
                )}

                </main>
            </div>
        </div>
    )
}
