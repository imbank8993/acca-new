import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, degrees } from 'pdf-lib';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { getApiUser } from '@/lib/api-auth';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

// Load image from data URL to canvas Image helper
async function loadImageFromDataUrl(dataUrl: string): Promise<any> {
    const { loadImage } = await import('canvas');
    return await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// Generate QR code with logo (Reusing the validated helper logic)
async function generateQRWithLogo(scanUrl: string, logoPath: string | Buffer): Promise<string> {
    try {
        const { createCanvas, loadImage } = await import('canvas');

        // 2.5cm × 300dpi ÷ 2.54 = 295px (standar QR Code dokumen resmi)
        const size = 295;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Step 1: Draw white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Step 2: Draw QR to canvas
        await QRCode.toCanvas(canvas, scanUrl, {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'H', // High error correction so logo doesn't break it
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Step 3: Try embedding logo
        try {
            const logo = await loadImage(logoPath);
            const centerX = size / 2;
            const centerY = size / 2;
            // Draw white backing square box for logo to keep it neat
            const logoSize = 68; 
            const padding = 6;
            const boxSize = logoSize + padding * 2;
            const xOffset = centerX - boxSize / 2;
            const yOffset = centerY - boxSize / 2;

            // Fill background box
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(xOffset, yOffset, boxSize, boxSize);
            
            // Draw subtle gray boundary frame
            ctx.strokeStyle = '#d1d5db'; // Cool gray for a premium look
            ctx.lineWidth = 1.5;
            ctx.strokeRect(xOffset, yOffset, boxSize, boxSize);

            // Draw logo image
            ctx.drawImage(logo, centerX - logoSize / 2, centerY - logoSize / 2, logoSize, logoSize);
        } catch (logoErr) {
            console.warn('[Sign-PDF] Logo overlay failed, using plain QR:', logoErr);
        }

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('[Sign-PDF] QR Error, falling back:', error);
        return await QRCode.toDataURL(scanUrl, { width: 200, errorCorrectionLevel: 'M' });
    }
}

export async function POST(req: NextRequest) {
    try {
        const apiUser = await getApiUser(req);
        if (!apiUser) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const authenticatedUserId = apiUser.authId;

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const rawJson = formData.get('data') as string;

        if (!file || !rawJson) {
            return NextResponse.json({ ok: false, error: 'File dan data konfigurasi wajib dikirim.' }, { status: 400 });
        }

        // Check file type
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isWord = ['doc', 'docx'].includes(ext || '');
        const isPdf = ext === 'pdf';

        if (!isPdf && !isWord) {
            return NextResponse.json({ ok: false, error: 'Hanya file PDF dan Word (.doc/.docx) yang diizinkan.' }, { status: 400 });
        }

        const config = JSON.parse(rawJson);
        const {
            suratData,          // metadata for db (nomor, perkara, etc)
            placement,          // { x, y, width, height, pageNum, pageWidth, pageHeight } from client
        } = config;

        if (!placement || placement.pageNum === undefined) {
            return NextResponse.json({ ok: false, error: 'Informasi posisi penempatan QR tidak valid.' }, { status: 400 });
        }

        // ─── AMBIL PROFIL SEKOLAH UNTUK TEMPAT TTD ───
        let kabupatenKota = 'Gowa';
        const token = extractRequestToken(req);
        try {
            const { status: profStatus, body: profBody } = await nestFetchAsUser('/profil-sekolah', token || '');
            if (profStatus === 200 && profBody?.data?.kabupaten_kota) {
                kabupatenKota = profBody.data.kabupaten_kota;
                console.log('[Sign-PDF] Kabupaten/Kota dari profil:', kabupatenKota);
            }
        } catch (profilErr) {
            console.warn('[Sign-PDF] Gagal ambil profil sekolah:', profilErr);
        }

        // ─── STEP 1: DAFTAR KE DATABASE ───
        const penandatanganId = suratData.penandatangan_id || suratData.pejabat_id || null;
        const penandatanganNama = suratData.penandatangan_nama || suratData.pejabat_nama || '';
        const penandatanganJabatan = suratData.penandatangan_jabatan || suratData.pejabat_jabatan || '';
        const penandatanganNip = suratData.penandatangan_nip || suratData.pejabat_nip || '';

        let safeTanggalTtd = new Date().toISOString().split('T')[0];
        if (suratData.tanggal_ttd && !isNaN(Date.parse(suratData.tanggal_ttd))) {
            safeTanggalTtd = new Date(suratData.tanggal_ttd).toISOString().split('T')[0];
        }

        const dbPayload = {
            ...suratData,
            nomor_surat: String(suratData.nomor_surat || '').slice(0, 100),
            perkara: String(suratData.perkara || '').slice(0, 500),
            kepada: String(suratData.kepada || '').slice(0, 500),
            tempat_ttd: String(kabupatenKota || '').slice(0, 255),
            tanggal_ttd: safeTanggalTtd,
            created_by: authenticatedUserId,
            status: 'DRAFT',
            jenis_surat: String(suratData.jenis_surat || 'EXTERNAL').slice(0, 100),
            pejabat_id: penandatanganId,
            pejabat_nama: String(penandatanganNama || '').slice(0, 255),
            pejabat_jabatan: String(penandatanganJabatan || '').slice(0, 255),
            pejabat_nip: String(penandatanganNip || '').slice(0, 50),
            penandatangan_id: penandatanganId,
            penandatangan_nama: String(penandatanganNama || '').slice(0, 255),
            penandatangan_jabatan: String(penandatanganJabatan || '').slice(0, 255),
            penandatangan_nip: String(penandatanganNip || '').slice(0, 50),
        };

        const { status: createStatus, body: createBody } = await nestFetchAsUser('/surat/items', token || '', {
            method: 'POST',
            body: JSON.stringify(dbPayload),
        });

        if ((createStatus !== 200 && createStatus !== 201) || !createBody?.data) {
            throw new Error('Gagal mendaftarkan metadata surat ke database: ' + (createBody?.message || createBody?.error));
        }

        const suratId = createBody.data.id;

        // Tentukan baseUrl server yang terpercaya, JANGAN percaya baseUrl mentah dari klien
        let serverOrigin = process.env.NEXT_PUBLIC_APP_URL || '';
        if (!serverOrigin || serverOrigin.includes('localhost')) {
            const host = req.headers.get('host') || '';
            const proto = req.headers.get('x-forwarded-proto') || 'https';
            if (host) {
                serverOrigin = `${proto}://${host}`;
            }
        }
        if (!serverOrigin || serverOrigin.includes('localhost')) {
            serverOrigin = 'https://acca.icgowa.sch.id';
        }
        const cleanBaseUrl = serverOrigin.replace(/\/$/, '');
        const verificationUrl = `${cleanBaseUrl}/surat/scan/${suratId}`;

        console.log(`[Sign-PDF] Database ID Created: ${suratId}`);
        console.log(`[Sign-PDF] Verification URL: ${verificationUrl}`);

        // ─── LOGO QR CODE ───
        // Menggunakan logo-sidebar-kecil.png yang selaras dengan logo sidebar
        // File tersedia di public/logo-sidebar-kecil.png
        const logoPath = process.cwd() + '/public/logo-sidebar-kecil.png';

        // Hasilkan visual QR Code + logo-sidebar-kecil di tengah
        const qrDataUrl = await generateQRWithLogo(verificationUrl, logoPath);
        const qrBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');

        // ─── STEP 3: KONVERSI WORD KE PDF JIKA PERLU ───
        let processedPdfBuffer: Uint8Array;

        if (isWord) {
            console.log('[Sign-PDF] Converting Word document to PDF...');
            try {
                const mammoth = await import('mammoth');

                // Convert DOCX to HTML using mammoth
                const docxBuffer = Buffer.from(await file.arrayBuffer());
                const result = await mammoth.convertToHtml({ buffer: docxBuffer });
                const htmlContent = result.value;
                const messages = result.messages;

                if (messages && messages.length > 0) {
                    console.log('[Sign-PDF] Mammoth conversion messages:', messages.map((m: any) => m.message).join('; '));
                }

                // Parse HTML content for jsPDF
                // Strip HTML tags but preserve structure
                let textContent = htmlContent
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi, '\n\n')
                    .replace(/<h[1][^>]*>/gi, '\n<<BOLD>>')
                    .replace(/<h[2][^>]*>/gi, '\n<<BOLD>>')
                    .replace(/<h[3][^>]*>/gi, '\n<<BOLD>>')
                    .replace(/<h[4-6][^>]*>/gi, '\n<<BOLD>>')
                    .replace(/<\/h[1-6]>/gi, '<</BOLD>>\n')
                    .replace(/<li[^>]*>/gi, '\n- ')
                    .replace(/<\/li>/gi, '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/<\/BOLD>>/g, '</BOLD>')
                    .replace(/<<BOLD>>/g, '<BOLD>')
                    .replace(/<BOLD>/g, '')
                    .replace(/<\/BOLD>/g, '')
                    .trim();

                // Split into lines
                const lines = textContent.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

                // Use jsPDF to create PDF
                const { jsPDF } = await import('jspdf');
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageWidth = 210;
                const pageHeight = 297;
                const margin = 20;
                const lineHeight = 6;
                let y = margin;
                let pageNum = 1;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);

                for (const line of lines) {
                    // Check if we need a new page
                    if (y > pageHeight - margin - lineHeight) {
                        doc.addPage();
                        y = margin;
                        pageNum++;
                    }

                    // Bold check (simple — check if line starts with - for bullets)
                    if (line.startsWith('- ')) {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(10);
                        const bullet = '- ';
                        const text = line.substring(2);
                        const splitText = doc.splitTextToSize(text, pageWidth - 2 * margin);
                        doc.text(bullet, margin, y);
                        doc.text(splitText[0], margin + 5, y);
                        y += lineHeight * splitText.length;
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(11);
                    } else {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(11);
                        const splitText = doc.splitTextToSize(line, pageWidth - 2 * margin);
                        for (const part of splitText) {
                            if (y > pageHeight - margin - lineHeight) {
                                doc.addPage();
                                y = margin;
                            }
                            doc.text(part, margin, y);
                            y += lineHeight;
                        }
                    }
                    y += 2; // extra spacing between paragraphs
                }

                processedPdfBuffer = new Uint8Array(doc.output('arraybuffer'));
                console.log('[Sign-PDF] Word converted to PDF via jsPDF, pages:', pageNum, 'size:', processedPdfBuffer.length);
            } catch (wordErr) {
                console.error('[Sign-PDF] Word conversion error:', wordErr);
                return NextResponse.json({ ok: false, error: 'Gagal mengonversi dokumen Word: ' + (wordErr instanceof Error ? wordErr.message : String(wordErr)) }, { status: 500 });
            }
        } else {
            // PDF — gunakan langsung
            const pdfBuffer = Buffer.from(await file.arrayBuffer());
            processedPdfBuffer = new Uint8Array(pdfBuffer);
        }

        // ─── STEP 4: MANIPULASI PDF DENGAN PDF-LIB ───
        console.log(`[Sign-PDF] Loading PDF to PDF-LIB...`);
        const pdfDoc = await PDFDocument.load(processedPdfBuffer);
        const pages = pdfDoc.getPages();
        
        // Cek validitas nomor halaman
        const pageIndex = Math.max(0, Math.min(placement.pageNum - 1, pages.length - 1));
        const targetPage = pages[pageIndex];
        
        // Ambil info CropBox dan Rotasi dari target page
        const cropBox = targetPage.getCropBox();
        const cropX = cropBox.x || 0;
        const cropY = cropBox.y || 0;
        const cropW = cropBox.width;
        const cropH = cropBox.height;

        const rotation = targetPage.getRotation().angle || 0;

        // Tentukan dimensi visual halaman PDF (Point units)
        // Jika halaman diputar 90 atau 270 derajat, dimensi visual (lebar & tinggi) akan tertukar di client
        let visualPageW = cropW;
        let visualPageH = cropH;
        if (rotation === 90 || rotation === 270) {
            visualPageW = cropH;
            visualPageH = cropW;
        }

        // Embed QR Code
        const qrImage = await pdfDoc.embedPng(qrBytes);

        // Konversi Koordinat Relatif dari Client ke PDF Point Scale
        //
        // IMPORTANT: Ground Truth - Gunakan dimensi PDF HARIAN dari server (MediaBox),
        // BUKAN pagePhysicalWidth/Height dari client. Ini karena:
        // - PDF bisa di-generate dari Word ke jsPDF yang dimensinya mungkin sedikit beda dari CropBox
        // - Jika MediaBox tidak sama dengan CropBox, visualPageW/H akan berbeda dari dimensi nyata
        //
        // Scale: canvas pixel -> PDF point
        // client pixel x scaleX = visual PDF point (di dalam PDF page coordinate system)
        // scaleX = serverPageW / canvasW  (server-side ground truth!)
        const serverPdfW = targetPage.getWidth();   // MediaBox.width (ground truth!)
        const serverPdfH = targetPage.getHeight(); // MediaBox.height (ground truth!)
        const scaleX = serverPdfW / placement.pageWidth;
        const scaleY = serverPdfH / placement.pageHeight;

        // Koordinat visual dalam PDF points
        const vW = placement.width * scaleX;
        const vH = placement.height * scaleY;
        const vX = placement.x * scaleX;
        const vY = placement.y * scaleY;

        // Debug log
        console.log(`[Sign-PDF] canvasPx=${placement.pageWidth?.toFixed(0)}x${placement.pageHeight?.toFixed(0)}`);
        console.log(`[Sign-PDF] serverPdf=${serverPdfW.toFixed(0)}x${serverPdfH.toFixed(0)} cropBox=${cropW.toFixed(0)}x${cropH.toFixed(0)} visual=${visualPageW.toFixed(0)}x${visualPageH.toFixed(0)}`);
        console.log(`[Sign-PDF] scale=${scaleX.toFixed(4)}x${scaleY.toFixed(4)} physFromClient=${(placement as any).pagePhysicalWidth?.toFixed(0)}x${(placement as any).pagePhysicalHeight?.toFixed(0)}`);
        console.log(`[Sign-PDF] placementPx=(${placement.x?.toFixed(0)},${placement.y?.toFixed(0)}) -> visualPt=(${vX.toFixed(1)},${vY.toFixed(1)})`);

        let drawX = 0;
        let drawY = 0;
        let imgRotation = 0;

        // Pemetaan Koordinat Visual (vX, vY, vW, vH) ke Koordinat Fisik PDF (drawX, drawY) & Rotasi Image (imgRotation)
        // PDF-lib menggunakan koordinat (0,0) di kiri-bawah CropBox, sedangkan HTML menggunakan kiri-atas viewport
        switch (rotation) {
            case 90:
                // Halaman diputar 90 derajat searah jarum jam oleh PDF viewer.
                // visual kiri-atas (0,0) -> unrotated kiri-atas (cropX, cropY + cropH)
                drawX = cropX + vY;
                drawY = cropY + cropH - vX;
                imgRotation = 270; // Putar image 270 derajat CCW (90 derajat CW) untuk menyesuaikan
                break;

            case 180:
                // Halaman diputar 180 derajat.
                // visual kiri-atas (0,0) -> unrotated kanan-atas (cropX + cropW, cropY + cropH)
                drawX = cropX + cropW - vX;
                drawY = cropY + cropH - vY;
                imgRotation = 180;
                break;

            case 270:
                // Halaman diputar 270 derajat searah jarum jam (90 derajat berlawanan jarum jam).
                // visual kiri-atas (0,0) -> unrotated kanan-bawah (cropX + cropW, cropY)
                drawX = cropX + cropW - vY;
                drawY = cropY + vX;
                imgRotation = 90;
                break;

            case 0:
            default:
                // Halaman normal (tidak diputar).
                // visual kiri-atas (0,0) -> unrotated kiri-atas (cropX, cropY + cropH)
                drawX = cropX + vX;
                drawY = cropY + cropH - vY - vH;
                imgRotation = 0;
                break;
        }

        console.log(`[Sign-PDF] PDF Draw: PageSize=${cropW.toFixed(0)}x${cropH.toFixed(0)}, Rot=${rotation}°, Visual QR=${vW.toFixed(1)}x${vH.toFixed(1)} pts, Physical QR=(${drawX.toFixed(1)}, ${drawY.toFixed(1)})`);

        // Bubuhkan QR ke Halaman
        targetPage.drawImage(qrImage, {
            x: drawX,
            y: drawY,
            width: vW,
            height: vH,
            rotate: degrees(imgRotation)
        });

        // Export kembali menjadi Bytes
        const modifiedPdfBytes = await pdfDoc.save();
        const modifiedFileBlob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });

        console.log(`[Sign-PDF] Save complete. Modified Size: ${modifiedPdfBytes.length} bytes`);

        // ─── STEP 5: UPLOAD HASIL MODIFIKASI KE STORAGE ───
        // Kita manfaatkan Endpoint /api/upload internal yang sudah memiliki routing storage adaptif (hosting/supabase/drive)
        const uploadFormData = new FormData();
        
        // Buat nama file unik
        const rawFileName = file.name.replace(/\.pdf$/i, '');
        const finalName = `${rawFileName}_SIGNED_${Date.now()}.pdf`;
        
        uploadFormData.append('file', modifiedFileBlob, finalName);
        uploadFormData.append('folder', 'Surat Eksternal');

        const uploadApiUrl = new URL('/api/upload', req.url);
        console.log(`[Sign-PDF] Forwarding final bytes to: ${uploadApiUrl.toString()}`);

        // Forward session cookies and Authorization header so the internal API call bypasses auth middleware correctly
        const forwardHeaders: Record<string, string> = {};
        const cookieHeader = req.headers.get('cookie');
        if (cookieHeader) forwardHeaders['Cookie'] = cookieHeader;
        const authHeader = req.headers.get('authorization');
        if (authHeader) forwardHeaders['Authorization'] = authHeader;

        const uploadRes = await fetch(uploadApiUrl.toString(), {
            method: 'POST',
            headers: forwardHeaders,
            body: uploadFormData,
        });

        if (!uploadRes.ok) {
            const errTxt = await uploadRes.text();
            throw new Error('Proses upload file termodifikasi gagal di server: ' + errTxt);
        }

        const uploadJson = await uploadRes.json();
        
        if (!uploadJson.ok || !uploadJson.publicUrl) {
            throw new Error('Upload API mengembalikan sukses tapi link URL file kosong.');
        }

        const fileUrl = uploadJson.publicUrl;
        console.log(`[Sign-PDF] Successfully uploaded to: ${fileUrl}`);

        // ─── STEP 6: UPDATE DATABASE KEMBALI JADI FINAL ───
        const { status: updateStatus, body: updateBody } = await nestFetchAsUser(`/surat/items/${suratId}`, token || '', {
            method: 'PUT',
            body: JSON.stringify({
                status: 'FINAL',
                file_url: fileUrl
            })
        });

        if (updateStatus !== 200 && updateStatus !== 201) {
            console.error('[Sign-PDF] Finalization database error:', updateBody);
            // Kita kembalikan link file walaupun update status gagal agar user tdk kehilangan akses
        }

        return NextResponse.json({
            ok: true,
            suratId: suratId,
            fileUrl: fileUrl,
            message: 'Penandatanganan dokumen PDF eksternal berhasil.'
        });

    } catch (error: any) {
        console.error('[Sign-PDF] UNCAUGHT ERROR:', error);
        return NextResponse.json({
            ok: false,
            error: error.message || 'Terjadi kesalahan tak terduga di server.'
        }, { status: 500 });
    }
}
