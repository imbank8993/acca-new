import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();

        // Dynamically import docx to avoid SSR issues
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = await import('docx');

        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        };

        // Split isi_surat into paragraphs
        const paragraphs = (data.isi_surat || '').split('\n').filter((p: string) => p.trim());

        // Build document sections
        const docContent: any[] = [];

        // Header - Institution
        docContent.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: data.dari || 'MTs Negeri 2 Malang',
                        bold: true,
                        size: 32,
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: 'Jl. Soekarno Hatta No. 88 Malang, Jawa Timur 65141',
                        size: 18,
                    }),
                ],
            })
        );

        // Horizontal line
        docContent.push(
            new Paragraph({
                border: {
                    bottom: {
                        color: '000000',
                        space: 1,
                        style: BorderStyle.SINGLE,
                        size: 6,
                    },
                },
            })
        );

        // Title
        const jenisNama = getJenisNama(data.jenis_surat);
        const displayNomor = data.nomor_surat || `${String(data.nomor_urut || 1).padStart(3, '0')}/${data.nomor_kategori || 'A'}/${data.nomor_bagian || 'Akademik'}/${getMonthRoman(new Date(data.tanggal_surat || Date.now()).getMonth() + 1)}/${new Date(data.tanggal_surat || Date.now()).getFullYear()}`;

        docContent.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: jenisNama.toUpperCase(),
                        bold: true,
                        size: 28,
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: `Nomor: ${displayNomor}`,
                        size: 22,
                    }),
                ],
            })
        );

        // Meta info
        docContent.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Lampiran  : ', bold: true, size: 22 }),
                    new TextRun({ text: data.lampiran || '-', size: 22 }),
                ],
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: 'Hal        : ', bold: true, size: 22 }),
                    new TextRun({ text: data.perihal || '-', size: 22 }),
                ],
            })
        );

        // Date and recipient
        docContent.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: `Malang, ${formatDate(data.tanggal_surat)}`, size: 22 }),
                ],
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: 'Kepada Yth.', size: 22 }),
                ],
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: data.kepada || '-', bold: true, size: 22 }),
                ],
            })
        );

        if (data.alamat_tujuan) {
            docContent.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `di ${data.alamat_tujuan}`, size: 22 }),
                    ],
                })
            );
        }

        // Opening
        docContent.push(
            new Paragraph({
                children: [
                    new TextRun({ text: '', size: 22 }),
                ],
            })
        );

        // Pembuka
        docContent.push(
            new Paragraph({
                children: [
                    new TextRun({ text: data.pembuka || 'Dengan hormat,', bold: true, italics: true, size: 22 }),
                ],
            })
        );

        // Body paragraphs
        for (const para of paragraphs) {
            docContent.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({ text: para, size: 22 }),
                    ],
                })
            );
        }

        // Closing
        docContent.push(
            new Paragraph({
                children: [new TextRun({ text: '', size: 22 })],
            }),
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({ text: data.penutup || 'Demikian surat ini dibuat dan diajukan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.', bold: true, italics: true, size: 22 }),
                ],
            })
        );

        // Signature
        docContent.push(
            new Paragraph({
                children: [new TextRun({ text: '', size: 22 })],
            }),
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({ text: `${data.tempat_ttd || 'Malang'}, ${formatDate(data.tanggal_ttd)}`, size: 22 }),
                ],
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: data.pejabat_jabatan || '-', size: 22 }),
                ],
            }),
            new Paragraph({
                children: [new TextRun({ text: '', size: 22 })],
            }),
            new Paragraph({
                children: [new TextRun({ text: '', size: 22 })],
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: data.pejabat_nama || '-', bold: true, underline: {}, size: 22 }),
                ],
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: `NIP. ${data.pejabat_nip || '-'}`, size: 22 }),
                ],
            })
        );

        // Create document
        const doc = new Document({
            creator: 'ACCA App - Surat Generator',
            title: `${jenisNama} - ${data.nomor_surat || 'Draft'}`,
            description: `Surat ${data.perihal || 'Draft'}`,
            styles: {
                default: {
                    document: {
                        run: {
                            font: 'Times New Roman',
                            size: 22,
                        },
                    },
                },
            },
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: 1440,
                                right: 1440,
                                bottom: 1440,
                                left: 1440,
                            },
                        },
                    },
                    children: docContent,
                },
            ],
        });

        const buffer = await Packer.toBuffer(doc);
        const uint8Array = new Uint8Array(buffer);

        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="SURAT_${Date.now()}.docx"`,
            },
        });
    } catch (error: any) {
        console.error('Generate DOCX Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Gagal generate dokumen' },
            { status: 500 }
        );
    }
}

function getJenisNama(kode: string): string {
    const map: Record<string, string> = {
        'SURAT_MASUK': 'Surat Masuk',
        'SURAT_KELUAR': 'Surat Keluar',
        'NOTA_DINAS': 'Nota Dinas',
        'UNDANGAN': 'Undangan',
        'PENGANTAR': 'Surat Pengantar',
        'PEMBERITAHUAN': 'Pemberitahuan',
        'REKOMENDASI': 'Surat Rekomendasi',
        'IZIN': 'Surat Izin',
        'BERITA_ACARA': 'Berita Acara',
    };
    return map[kode] || 'SURAT';
}

function getMonthRoman(month: number): string {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[month - 1] || 'I';
}