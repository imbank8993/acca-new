'use client';

import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import type { User } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { cachedGet } from '../svCache';

export default function TabHasil({ user, tahunAjaranId }: { user: User, tahunAjaranId: number | null }) {
    const [rekap, setRekap] = useState<any[]>([]);
    const [stages, setStages] = useState<string[]>([]);
    const [profilSekolah, setProfilSekolah] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        if (tahunAjaranId) fetchRekap();
    }, [tahunAjaranId, user.nip]);

    const fetchRekap = async () => {
        setLoading(true);
        try {
            const role = user.role || '';
            const isAdmin = role.includes('ADMIN') || role.includes('KAMAD');
            
            const json = await cachedGet(`/api/e-supervisi/rekap?tahun_ajaran_id=${tahunAjaranId}`, 30_000);

            if (json.ok) {
                let data = json.data;
                // Filter if not admin
                if (!isAdmin) {
                    if (role.includes('SUPERVISOR')) {
                        data = data.filter((p: any) => p.supervisor_nip === user.nip);
                    } else {
                        data = data.filter((p: any) => p.guru_nip === user.nip);
                    }
                }
                setRekap(data);
                if (json.stages) setStages(json.stages);
                if (json.profil_sekolah) setProfilSekolah(json.profil_sekolah);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const doc = new (jsPDF as any)('p', 'pt', 'a4');
        doc.setFontSize(16);
        doc.text('LAPORAN HASIL SUPERVISI AKADEMIK', doc.internal.pageSize.width / 2, 40, { align: 'center' });
        
        doc.setFontSize(12);
        const data = rekap.map((p, i) => [
            i + 1,
            p.guru_nama,
            p.supervisor_nama,
            ...stages.map(t => p.nilai?.[t] || '0.00'),
            p.nilai?.rata_rata || '0.00',
            p.nilai?.predikat || '-'
        ]);

        autoTable(doc, {
            startY: 70,
            head: [['No', 'Guru yang Dinilai', 'Supervisor', ...stages, 'Rata-rata', 'Predikat']],
            body: data,
        });

        doc.save('laporan-supervisi.pdf');
    };

    const loadImageAsBase64 = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            if (!url) return resolve('');
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    resolve('');
                }
            };
            img.onerror = () => resolve('');
            img.src = url;
        });
    };

    const handlePrintDetail = async (p: any) => {
        try {
            Swal.fire({
                title: 'Mempersiapkan Laporan...',
                text: 'Sedang mengunduh dan menyusun dokumen...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // Fetch Dokumen and Indikator
            const docRes = await fetch(`/api/e-supervisi/dokumen?tahun_ajaran_id=${tahunAjaranId}`);
            const docJson = await docRes.json();
            const semuaDokumen = docJson.ok ? docJson.data : [];

            // Fetch Nilai
            const nilaiRes = await fetch(`/api/e-supervisi/nilai?penugasan_id=${p.id}`);
            const nilaiJson = await nilaiRes.json();
            const scores: Record<number, any> = {};
            if (nilaiJson.ok) {
                nilaiJson.data.forEach((n: any) => {
                    scores[n.indikator_id] = n;
                });
            }

            // Load images
            let logoBase64 = '';
            if (profilSekolah?.logo_url) {
                logoBase64 = await loadImageAsBase64(profilSekolah.logo_url);
            }
            
            const qrData = encodeURIComponent(`Disahkan oleh Sistem ACCA\nSupervisor: ${p.supervisor_nama || '-'}\nGuru: ${p.guru_nama || '-'}\nNilai Akhir: ${p.nilai?.rata_rata || 0}\nDicetak pada: ${new Date().toLocaleString()}`);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
            const qrBase64 = await loadImageAsBase64(qrUrl);

            // Generate PDF
            const doc = new (jsPDF as any)('p', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.width;
            let yPos = 40;

            // 1. Kop Surat
            if (profilSekolah) {
                if (logoBase64) {
                    doc.addImage(logoBase64, 'PNG', 40, yPos, 60, 60);
                }
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(profilSekolah.nama || 'LEMBAR PENILAIAN HASIL SUPERVISI AKADEMIK', pageWidth / 2, yPos + 15, { align: 'center' });
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const alamat = `${profilSekolah.alamat || ''}, ${profilSekolah.kecamatan || ''}, ${profilSekolah.kabupaten_kota || ''}, ${profilSekolah.provinsi || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',');
                doc.text(alamat, pageWidth / 2, yPos + 35, { align: 'center' });
                
                let kontak = '';
                if (profilSekolah.telepon) kontak += `Telp: ${profilSekolah.telepon}   `;
                if (profilSekolah.email) kontak += `Email: ${profilSekolah.email}   `;
                if (profilSekolah.website) kontak += `Web: ${profilSekolah.website}`;
                if (kontak) doc.text(kontak, pageWidth / 2, yPos + 50, { align: 'center' });
                
                yPos += 70;
                doc.setLineWidth(2);
                doc.line(40, yPos, pageWidth - 40, yPos);
                yPos += 30;
            } else {
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('LEMBAR PENILAIAN HASIL SUPERVISI AKADEMIK', pageWidth / 2, yPos, { align: 'center' });
                yPos += 30;
            }

            // 2. Identitas
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Nama Guru`, 40, yPos); doc.text(`: ${p.guru_nama || '-'}`, 120, yPos);
            doc.text(`NIP Guru`, 40, yPos + 15); doc.text(`: ${p.guru_nip || '-'}`, 120, yPos + 15);
            doc.text(`Mata Pelajaran`, 40, yPos + 30); doc.text(`: ${p.guru_mapel || '-'}`, 120, yPos + 30);
            
            doc.text(`Supervisor`, 320, yPos); doc.text(`: ${p.supervisor_nama || '-'}`, 390, yPos);
            doc.text(`NIP Supervisor`, 320, yPos + 15); doc.text(`: ${p.supervisor_nip || '-'}`, 390, yPos + 15);
            doc.text(`Nilai Akhir`, 320, yPos + 30); doc.text(`: ${p.nilai?.rata_rata || '0.00'} (${p.nilai?.predikat || '-'})`, 390, yPos + 30);

            yPos += 50;

            // 3. Unified Table Data Preparation
            const tableData: any[] = [];
            
            semuaDokumen.forEach((d: any) => {
                if (d.indikators && d.indikators.length > 0) {
                    // Group Header for Document
                    tableData.push([
                        { content: d.nama_dokumen, colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] } }
                    ]);

                    let docTotalScore = 0;

                    // Build a tree of indicators to handle sub-indicators
                    // parent_id from API might be in skala_config or parent_id column
                    const getParentId = (ind: any) => ind.parent_id || ind.skala_config?.parent_id;
                    const roots = d.indikators.filter((ind: any) => !getParentId(ind));
                    const childrenMap: Record<number, any[]> = {};
                    d.indikators.forEach((ind: any) => {
                        const pId = getParentId(ind);
                        if (pId) {
                            if (!childrenMap[pId]) childrenMap[pId] = [];
                            childrenMap[pId].push(ind);
                        }
                    });

                    const addRow = (ind: any, isSub: boolean, indexStr: string) => {
                        const isGroup = ind.skala_config?.tipe === 'group';
                        const val = scores[ind.id] || { nilai_mentah: isGroup ? '' : '0' };
                        
                        if (!isGroup) {
                            docTotalScore += parseFloat(val.nilai_mentah) || 0;
                        }

                        const namaIndikator = isSub ? `   - ${ind.nama_indikator}` : ind.nama_indikator;
                        
                        tableData.push([
                            indexStr,
                            { content: namaIndikator, styles: { fontStyle: isGroup ? 'bold' : 'normal' } },
                            isGroup ? '' : val.nilai_mentah,
                            isGroup ? '' : (val.catatan || '-')
                        ]);

                        if (childrenMap[ind.id]) {
                            childrenMap[ind.id].forEach((child, cIdx) => {
                                addRow(child, true, `${indexStr}.${cIdx + 1}`);
                            });
                        }
                    };

                    roots.forEach((root: any, rIdx: number) => {
                        addRow(root, false, `${rIdx + 1}`);
                    });

                    // Total Row
                    tableData.push([
                        { content: `Total Skor ${d.nama_dokumen}`, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
                        { content: docTotalScore.toString(), styles: { halign: 'center', fontStyle: 'bold' } },
                        '-'
                    ]);
                }
            });

            if (tableData.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['No', 'Indikator', 'Skor', 'Catatan']],
                    body: tableData,
                    margin: { left: 40, right: 40 },
                    theme: 'grid',
                    headStyles: { fillColor: [0, 56, 168] },
                    columnStyles: { 
                        0: { cellWidth: 30, halign: 'center' },
                        2: { cellWidth: 40, halign: 'center' }
                    }
                });
                yPos = (doc as any).lastAutoTable.finalY + 30;
            }

            // 4. Signatures
            if (yPos > doc.internal.pageSize.height - 180) {
                doc.addPage();
                yPos = 40;
            }

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            // Guru Signature (Left)
            doc.text('Guru yang Dinilai,', 60, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(p.guru_nama || '-', 60, yPos + 120);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${p.guru_nip || '-'}`, 60, yPos + 135);
            
            // Supervisor Signature (Right)
            doc.text('Mengetahui dan Mengesahkan,', pageWidth - 200, yPos);
            doc.text('Sistem Informasi ACCA', pageWidth - 200, yPos + 15);
            if (qrBase64) {
                doc.addImage(qrBase64, 'PNG', pageWidth - 180, yPos + 30, 70, 70);
            } else {
                doc.text('[QR Code]', pageWidth - 160, yPos + 70);
            }
            doc.setFont('helvetica', 'bold');
            doc.text(p.supervisor_nama || '-', pageWidth - 200, yPos + 120);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${p.supervisor_nip || '-'}`, pageWidth - 200, yPos + 135);

            doc.save(`Hasil_Supervisi_${(p.guru_nama || 'Guru').replace(/\s+/g, '_')}.pdf`);
            Swal.close();

        } catch (e: any) {
            Swal.fire('Error', 'Gagal mencetak dokumen: ' + e.message, 'error');
        }
    };

    if (loading) {
        return <PageLoader label="Memuat data rekapitulasi…" minHeight="300px" />;
    }

    // Stats calculation
    const totalPenugasan = rekap.length;
    let avgScore = 0;
    let aboveKkmCount = 0;
    if (totalPenugasan > 0) {
        const total = rekap.reduce((sum, p) => sum + parseFloat(p.nilai?.rata_rata || 0), 0);
        avgScore = total / totalPenugasan;
        aboveKkmCount = rekap.filter(p => parseFloat(p.nilai?.rata_rata || 0) >= 76).length; // assuming 76 is KKM (Baik)
    }

    return (
        <div className="sv-card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px'}}>
                <h3 style={{margin: 0}}>Rekapitulasi Nilai Supervisi</h3>
                <button className="sv-btn sv-btn-outline" onClick={handlePrint} disabled={rekap.length === 0}>
                    <i className="bi bi-printer"></i> Cetak Laporan (PDF)
                </button>
            </div>

            <div className="sv-stats">
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Total Penugasan</span>
                    <span className="sv-stat-value">{totalPenugasan}</span>
                </div>
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Rata-rata Nilai</span>
                    <span className="sv-stat-value">{avgScore.toFixed(2)}</span>
                </div>
                <div className="sv-stat-card">
                    <span className="sv-stat-label">Predikat Baik/Sangat Baik</span>
                    <span className="sv-stat-value">{totalPenugasan > 0 ? Math.round((aboveKkmCount / totalPenugasan) * 100) : 0}%</span>
                </div>
            </div>

            <div className="sv-table-scroll">
                <table className="sv-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Nama Guru</th>
                            <th>Supervisor</th>
                            {stages.map(t => <th key={t} style={{textTransform: 'capitalize'}}>{t}</th>)}
                            <th>Rata-rata</th>
                            <th>Predikat</th>
                            <th style={{textAlign: 'center'}}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rekap.map((p, i) => (
                            <tr key={p.id}>
                                <td data-label="No">{i + 1}</td>
                                <td data-label="Nama Guru">
                                    <div>
                                        <div style={{fontWeight: 600}}>{p.guru_nama}</div>
                                        <small style={{color: 'var(--n-muted)'}}>{p.guru_nip}</small>
                                    </div>
                                </td>
                                <td data-label="Supervisor">{p.supervisor_nama}</td>
                                {stages.map(t => (
                                    <td key={t} data-label={t} style={{textTransform: 'capitalize'}}>
                                        <span className={`sv-badge ${parseFloat(p.nilai?.[t] || '0') > 0 ? 'sv-badge-success' : ''}`}>
                                            {p.nilai?.[t] || '0.00'}
                                        </span>
                                    </td>
                                ))}
                                <td data-label="Rata-rata" style={{fontWeight: 600}}>{p.nilai?.rata_rata || '0.00'}</td>
                                <td data-label="Predikat">{p.nilai?.predikat || '-'}</td>
                                <td data-label="Aksi" style={{textAlign: 'center'}}>
                                    <button
                                        className="sv-btn sv-btn-outline"
                                        style={{padding: '6px 12px', fontSize: '12px'}}
                                        onClick={() => handlePrintDetail(p)}
                                        title={`Cetak Detail ${p.guru_nama}`}
                                    >
                                        <i className="bi bi-printer"></i> Detail
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rekap.length === 0 && <tr><td colSpan={6 + stages.length} className="sv-empty">Belum ada data nilai supervisi.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
