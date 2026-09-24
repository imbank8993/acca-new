'use client'

import React, { useState } from 'react';
import { getProxiedImageUrl } from '@/lib/image-utils';

export default function GalleryClient({ detailsWithDocs }: { detailsWithDocs: any[] }) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {detailsWithDocs.map((d: any) => {
                    const isSesuai = d.keterangan?.toLowerCase().includes('sesuai') || d.status_kehadiran?.toLowerCase() === 'sesuai';
                    
                    return (
                        <div key={d.id} className="bg-white dark:bg-black rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-[1.8px] dark:border-[rgba(26,115,232,0.75)] overflow-hidden flex flex-col group cursor-pointer" onClick={() => setSelectedImage(d.dokumentasi_url)}>
                            
                            {/* Image Section */}
                            <div className="block relative aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                                <img 
                                    src={getProxiedImageUrl(d.dokumentasi_url)} 
                                    alt={`Dokumentasi ${d.nama_kelas}`} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                
                                {/* Status Badge Over Image (Hanya tampil jika BUKAN 'Sesuai') */}
                                {d.status_kehadiran && d.status_kehadiran.toLowerCase() !== 'sesuai' && (
                                    <div className="absolute top-3 left-3">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded shadow-sm text-xs font-bold border ${
                                            d.status_kehadiran === 'Hadir' ? 'bg-emerald-500 text-white border-emerald-600' :
                                            d.status_kehadiran === 'Izin' ? 'bg-amber-500 text-white border-amber-600' :
                                            d.status_kehadiran === 'Sakit' ? 'bg-blue-500 text-white border-blue-600' :
                                            'bg-rose-500 text-white border-rose-600'
                                        }`}>
                                            {d.status_kehadiran}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Content Section - Centered with more padding */}
                            <div className="p-6 flex flex-col items-center text-center flex-1">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">{d.nama_kelas}</h3>
                                
                                {/* Checkmark Sesuai */}
                                {isSesuai && (
                                    <div className="mb-4 inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-md border border-emerald-100 dark:border-emerald-800">
                                        <i className="bi bi-check-circle-fill"></i> Sesuai
                                    </div>
                                )}

                                <div className="flex-1 w-full flex flex-col justify-center space-y-3">
                                    {/* Guru Utama */}
                                    <div>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-1">Guru Utama</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">{d.nama_guru || '-'}</p>
                                    </div>

                                    {/* Guru Pengganti (if any) */}
                                    {d.guru_pengganti && d.guru_pengganti !== d.nama_guru && (
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 w-full">
                                            <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold mb-1">Guru Pengganti</p>
                                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-snug">{d.guru_pengganti}</p>
                                        </div>
                                    )}
                                    
                                    {/* Status Tambahan / Keterangan Teks */}
                                    {(() => {
                                        const tambahan = [d.status_tambahan_1, d.status_tambahan_2, d.status_tambahan_3, d.keterangan].filter(Boolean).join(', ');
                                        if (!tambahan) return null;
                                        return (
                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 w-full">
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-1">Status Tambahan</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-300">{tambahan}</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button 
                        className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-black/50 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center transition-colors focus:outline-none"
                        onClick={() => setSelectedImage(null)}
                        aria-label="Tutup"
                    >
                        <i className="bi bi-x-lg text-2xl"></i>
                    </button>
                    <img 
                        src={getProxiedImageUrl(selectedImage)} 
                        alt="Zoomed" 
                        className="max-w-full max-h-[90vh] object-contain rounded-md select-none cursor-default shadow-2xl"
                        onClick={(e) => e.stopPropagation()} 
                    />
                </div>
            )}
        </>
    );
}
