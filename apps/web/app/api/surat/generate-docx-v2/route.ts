import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();

        // Read template
        const templatePath = path.join(process.cwd(), 'public/templates/Surat ACCA.docx');
        const templateBuffer = fs.readFileSync(templatePath);
        const zip = await JSZip.loadAsync(templateBuffer);

        // Get document.xml
        let docXml = await zip.file('word/document.xml')?.async('string');

        if (!docXml) {
            throw new Error('Template document.xml not found');
        }

        // Helper functions
        const formatDate = (dateStr: string) => {
            if (!dateStr) return '_______________';
            const d = new Date(dateStr);
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        };

        const escapeXml = (str: string) => {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        // Generate letter ID for barcode
        const letterId = `SRT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const verifyUrl = `https://app.adacode.ai/surat/verify?id=${letterId}`;

        // Create our content XML - positioned text blocks
        const contentXml = `
        <!-- Header Left Section -->
        <w:p>
            <w:pPr>
                <w:jc w:val="left"/>
                <w:spacing w:after="120"/>
            </w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Nomor   : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.nomor_surat || '-')}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr>
                <w:jc w:val="left"/>
                <w:spacing w:after="120"/>
            </w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Perihal : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.perkara || '-')}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr>
                <w:jc w:val="left"/>
                <w:spacing w:after="360"/>
            </w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Lampiran: </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.lampiran || '-')}</w:t></w:r>
        </w:p>

        <!-- Kepada -->
        <w:p>
            <w:pPr><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t xml:space="preserve">Kepada Yth. </w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>${escapeXml(data.kepada || '-')}</w:t></w:r>
        </w:p>
        ${data.alamat_tujuan ? `
        <w:p>
            <w:pPr><w:spacing w:after="360"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>di ${escapeXml(data.alamat_tujuan)}</w:t></w:r>
        </w:p>` : `
        <w:p><w:pPr><w:spacing w:after="360"/></w:pPr></w:p>`}

        <!-- Title -->
        <w:p>
            <w:pPr>
                <w:jc w:val="center"/>
                <w:spacing w:before="240" w:after="360"/>
            </w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="28"/></w:rPr><w:t>${data.jenis_surat === 'PEMBERITAHUAN' ? 'PEMBERITAHUAN' : 'UNDANGAN'}</w:t></w:r>
        </w:p>

        <!-- Meeting Details Table -->
        <w:p>
            <w:pPr><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Hari, Tanggal : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.hari_tanggal || '_______________')}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Waktu         : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.waktu || '_______________')}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Tempat        : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.tempat || '_______________')}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>Agenda        : </w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:jc w:val="left"/><w:ind w:left="720"/><w:spacing w:after="480"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t xml:space="preserve">${escapeXml(data.agenda || '..................................................................')}</w:t></w:r>
        </w:p>

        <!-- Spacing before signature -->
        <w:p><w:pPr><w:spacing w:before="960"/></w:pPr></w:p>

        <!-- Signature -->
        <w:p>
            <w:pPr><w:jc w:val="right"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.tempat_ttd || 'Gowa')}, ${formatDate(data.tanggal_ttd)}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="120"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${escapeXml(data.pejabat_jabatan || 'WKM Akademik')}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:spacing w:before="1440"/><w:jc w:val="right"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/></w:rPr><w:t>${escapeXml(data.pejabat_nama || 'Imran, S.Si.')}</w:t></w:r>
        </w:p>

        <!-- Barcode -->
        <w:p>
            <w:pPr><w:spacing w:before="480"/><w:jc w:val="right"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="16"/></w:rPr><w:t>ID: ${letterId}</w:t></w:r>
        </w:p>
        <w:p>
            <w:pPr><w:jc w:val="right"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="14"/><w:color w:val="666666"/></w:rPr><w:t>${verifyUrl}</w:t></w:r>
        </w:p>
        `;

        // Remove the placeholder text "Selama" and clean up
        docXml = docXml.replace(/<w:t>Selama<\/w:t>/g, '<w:t></w:t>');

        // Find the body and insert our content before sectPr
        const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
        if (sectPrMatch) {
            const beforeSectPr = docXml.split(sectPrMatch[0])[0];
            // Find the last paragraph before sectPr
            const lastPIndex = beforeSectPr.lastIndexOf('</w:p>');
            if (lastPIndex > 0) {
                const beforeLastP = beforeSectPr.substring(0, lastPIndex + 6);
                const afterLastP = beforeSectPr.substring(lastPIndex + 6);
                docXml = beforeLastP + contentXml + afterLastP + sectPrMatch[0];
            } else {
                // Insert before sectPr
                docXml = beforeSectPr + contentXml + sectPrMatch[0];
            }
        }

        // Update the document.xml
        zip.file('word/document.xml', docXml);

        // Generate the new docx
        const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        return new NextResponse(outputBuffer as any, {
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