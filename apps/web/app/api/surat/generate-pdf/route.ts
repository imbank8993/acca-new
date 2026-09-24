/**
 * API Route: Generate Surat PDF using React-PDF
 * Proper multi-page with background on EVERY page
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PDFDocument, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import React from 'react';

// A4 dimensions in points (72 dpi)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_TOP = 35 * 2.83465; // 35mm
const MARGIN_LEFT = 30 * 2.83465; // 30mm = 3cm
const MARGIN_RIGHT = 25 * 2.83465;
const MARGIN_BOTTOM = 30 * 2.83465; // 30mm
const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const CONTENT_HEIGHT = A4_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

// Helper: Download image and convert to base64 data URL
async function imageToDataUrl(url: string): Promise<string> {
    if (!url || url === '') {
        console.error('[PDF] Invalid image URL: empty or undefined');
        return '';
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[PDF] Failed to fetch image: ${url}, status: ${response.status}`);
            return '';
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = url.includes('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error(`[PDF] Error downloading image: ${url}`, error);
        return '';
    }
}

// Helper: Download any file from URL and convert to base64 data URL
async function fetchFileToDataUrl(url: string): Promise<string> {
    if (!url || !url.startsWith('http')) return url;
    try {
        console.log(`[PDF] Fetching external file attachment from URL: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[PDF] Failed to download file: ${url}, status: ${response.status}`);
            return url; // Fallback
        }
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        console.log(`[PDF] Fetch success! Type: ${contentType}, Base64 size: ${Math.round(base64.length / 1024)} KB`);
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error(`[PDF] Error downloading file attachment: ${url}`, error);
        return url; // Fallback
    }
}

// Generate QR code with logo embedded using canvas
async function generateQRWithLogo(logoDataUrl: string, scanUrl: string): Promise<string> {
    try {
        // Dynamically import canvas only when needed
        const { createCanvas } = await import('canvas');

        // Create canvas for QR code
        const size = 200;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Generate QR code as raw pixel data
        const qrData = await QRCode.toString(scanUrl, { type: 'terminal' });

        // Use qrcode library to generate to canvas (if supported) or fallback
        await QRCode.toCanvas(canvas, scanUrl, {
            width: size,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // If logo exists, draw it in center
        if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
            const logo = await loadImageFromDataUrl(logoDataUrl);

            // Draw white circle background
            const centerX = size / 2;
            const centerY = size / 2;
            const radius = 30;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
            ctx.fill();

            // Draw logo in center
            const logoSize = radius * 2;
            ctx.drawImage(logo, centerX - logoSize/2, centerY - logoSize/2, logoSize, logoSize);
        }

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('[PDF] Error generating QR with logo:', error);
        // Fallback: generate QR without logo
        return await QRCode.toDataURL(scanUrl, { width: 200 });
    }
}

// Load image from data URL to canvas Image
async function loadImageFromDataUrl(dataUrl: string): Promise<any> {
    const { createCanvas, loadImage } = await import('canvas');
    return await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// Elegant professional styles
const styles = StyleSheet.create({
    // Page wrapper
    page: {
        width: A4_WIDTH,
        height: A4_HEIGHT,
        position: 'relative',
        backgroundColor: '#ffffff',
    },
    // Page content wrapper
    pageContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: A4_WIDTH,
        height: A4_HEIGHT,
    },
    // Background image - FULL page
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: A4_WIDTH,
        height: A4_HEIGHT,
    },
    // Content area - flex with auto margins for QR
    contentArea: {
        position: 'absolute',
        top: MARGIN_TOP,
        left: MARGIN_LEFT,
        right: MARGIN_RIGHT,
        bottom: MARGIN_BOTTOM,
        flexDirection: 'column',
    },
    // Header info
    headerRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    headerLabel: {
        width: 80,
        fontSize: 10,
        color: '#1a1a2e',
    },
    headerColon: {
        width: 15,
        fontSize: 10,
        color: '#1a1a2e',
    },
    headerValue: {
        flex: 1,
        fontSize: 10,
        color: '#1a1a2e',
    },
    // Kepada section
    kepadaSection: {
        marginTop: 18,
    },
    kepadaLabel: {
        marginLeft: 40,
        fontSize: 10,
        color: '#1a1a2e',
        marginBottom: 4,
    },
    kepadaNama: {
        marginLeft: 40,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 2,
    },
    kepadaAlamat: {
        marginLeft: 40,
        fontSize: 10,
        color: '#1a1a2e',
        marginBottom: 2,
    },
    // Salam pembuka
    salam: {
        marginTop: 20,
        fontSize: 10,
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#1a1a2e',
    },
    // Paragraf
    paragraf: {
        fontSize: 10,
        marginTop: 12,
        textAlign: 'justify',
        color: '#1a1a2e',
        lineHeight: 1.6,
    },
    // Meeting table
    meetingTable: {
        marginTop: 18,
        marginLeft: 40,
    },
    meetingRow: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-start',
    },
    meetingLabel: {
        width: 100,
        fontSize: 10,
        color: '#1a1a2e',
    },
    meetingColon: {
        width: 15,
        fontSize: 10,
        color: '#1a1a2e',
        textAlign: 'center',
    },
    meetingValue: {
        flex: 1,
        fontSize: 10,
        color: '#1a1a2e',
        textAlign: 'justify',
    },
    // Closing
    closingText: {
        fontSize: 10,
        marginTop: 18,
        textAlign: 'justify',
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#1a1a2e',
    },
    salamClosing: {
        marginTop: 18,
        fontSize: 10,
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#1a1a2e',
    },
    // Signature section - VERTICAL: tempat, QR, nama, jabatan (all left aligned for proper layout)
    signatureSection: {
        marginTop: 20,
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    signaturePlace: {
        fontSize: 10,
        color: '#1a1a2e',
        marginBottom: 8,
        textAlign: 'left',
    },
    qrSection: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    signatureName: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 2,
        textAlign: 'left',
    },
    signatureJabatan: {
        fontSize: 9,
        color: '#444444',
        marginTop: 2,
        textAlign: 'left',
    },
    qrImage: {
        width: 70,
        height: 70,
    },
    letterId: {
        fontSize: 6,
        color: '#888888',
        marginTop: 4,
    },
    pageFooter: {
        position: 'absolute',
        bottom: 10 * 2.83465, // 10mm bottom margin (1cm)
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 6,
        color: '#888888',
        fontFamily: 'Courier',
        letterSpacing: 1,
    },
    // Lampiran table
    lampiranSection: {
        marginTop: 20,
    },
    lampiranTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 8,
        textAlign: 'center',
        textDecoration: 'underline',
    },
    lampiranTable: {
        borderWidth: 1,
        borderColor: '#000000',
        marginLeft: 0,
        marginRight: 0,
    },
    lampiranTableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        backgroundColor: '#f0f0f0',
    },
    lampiranTableRowAlt: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        backgroundColor: '#ffffff',
    },
    lampiranTableHeaderCell: {
        padding: 4,
        fontSize: 9,
        fontWeight: 'bold',
        color: '#1a1a2e',
        textAlign: 'center',
    },
    lampiranTableCell: {
        padding: 4,
        fontSize: 9,
        color: '#1a1a2e',
    },
    // Poin section
    poinSection: {
        marginTop: 12,
        marginLeft: 20 * 2.83465, // Convert 20mm from preview HTML to PDF points (1cm ≈ 28.35pt)
    },
    poinItem: {
        fontSize: 10,
        color: '#1a1a2e',
        marginBottom: 6,
        textAlign: 'justify',
    },
});

// Format Indonesian date
function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Types
interface ContentElement {
    type: string;
    content: any;
}

// Build lampiran table rows
function buildLampiranTable(suratData: any): string {
    if (!suratData.lampiran_count || suratData.lampiran_count === 0) return '';
    if (suratData.lampiran_type === 'guru' && suratData.lampiran_guru_ids?.length > 0) {
        return 'GURU_TABLE';
    }
    if (suratData.lampiran_type === 'siswa' && suratData.lampiran_siswa_ids?.length > 0) {
        return 'SISWA_TABLE';
    }
    return '';
}

// Build all content elements
function buildContentElements(suratData: any, qrCodeUrl: string, logoUrl: string, guruList?: any[], siswaList?: any[], excludeLampiran?: any, providedLetterId?: string): { elements: ContentElement[]; letterId: string; lampiranType?: string; lampiranData?: any[] } {
    const letterId = providedLetterId ? `SRT-${providedLetterId}` : `SRT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const elements: ContentElement[] = [];

    // Header info
    if (suratData.nomor_surat || suratData.perkara || suratData.lampiran) {
        elements.push({ type: 'header', content: { nomor: suratData.nomor_surat, perkara: suratData.perkara, lampiran: suratData.lampiran } });
    }

    // Kepada
    if (suratData.kepada || suratData.alamat_tujuan) {
        elements.push({ type: 'kepada', content: { kepada: suratData.kepada, alamat: suratData.alamat_tujuan } });
    }

    // Salam & content
    // Split paragraf by --- separator, and === for meeting insertion
    const blocks = suratData.paragraf
        ? suratData.paragraf.split(/---/).filter((b: string) => b.trim() || b.includes('==='))
        : [];
    const hasContent = blocks.length > 0 || suratData.penutup;

    let lampiranType = '';
    let lampiranData: any[] = [];

    if (hasContent) {
        if (suratData.pembuka) {
            elements.push({ type: 'salam', content: { text: suratData.pembuka, isOpening: true } });
        }

        // Process each block
        blocks.forEach((block: string) => {
            const parts = block.split('===');
            parts.forEach((part: string, idx: number) => {
                const trimmed = part.trim();
                if (trimmed) {
                    // Check if block contains @poin marker
                    if (trimmed.includes('@poin')) {
                        const cleanPart = trimmed.replace('@poin', '').trim();
                        if (cleanPart) {
                            elements.push({ type: 'paragraf', content: cleanPart });
                        }
                        // Insert poin section
                        if (suratData.poin) {
                            elements.push({ type: 'poin', content: suratData.poin });
                        }
                    } else {
                        elements.push({ type: 'paragraf', content: trimmed });
                    }
                }
                // Insert meeting info after this part if not the last part
                if (idx < parts.length - 1 && (suratData.hari_tanggal || suratData.waktu || suratData.tempat || suratData.agenda)) {
                    elements.push({ type: 'meeting', content: { hari_tanggal: suratData.hari_tanggal, waktu: suratData.waktu, tempat: suratData.tempat, agenda: suratData.agenda } });
                }
            });
        });

        if (suratData.penutup) elements.push({ type: 'closing', content: suratData.penutup });


    }

    // Signature with QR for the main letter
    elements.push({
        type: 'signature',
        content: {
            tempat_ttd: suratData.tempat_ttd || 'Gowa',
            tanggal_ttd: formatDate(suratData.tanggal_ttd),
            pejabat_nama: suratData.pejabat_nama || 'Imran, S.Si.',
            pejabat_jabatan: suratData.pejabat_jabatan || 'WKM Akademik',
            qrCodeUrl: qrCodeUrl,
            showQr: true
        }
    });

    // Handle lampiran tables natively in elements array for automatic pagination
    if (!excludeLampiran) {
        const hasGuru = suratData.lampiran_count > 0 && suratData.lampiran_guru_ids?.length > 0;
        const hasSiswa = suratData.lampiran_count > 0 && suratData.lampiran_siswa_ids?.length > 0;
        const multipleData = hasGuru && hasSiswa;

        if (hasGuru || hasSiswa) {
            elements.push({ type: 'page_break', content: null });
        }

        if (hasGuru) {
            const normalizedIds = suratData.lampiran_guru_ids.map((id: any) => id.toString());
            const gData = (guruList || []).filter(g => normalizedIds.includes(g.id.toString())).sort((a, b) => a.nama.localeCompare(b.nama));
            if (gData.length > 0) {
                const title = suratData.lampiran_title ? (multipleData ? `${suratData.lampiran_title} (Guru)` : suratData.lampiran_title) : 'DAFTAR GURU';
                elements.push({ type: 'lampiran_guru', content: { title, rows: gData } });
            }
        }
        
        if (hasSiswa) {
            const normalizedIds = suratData.lampiran_siswa_ids.map((id: any) => id.toString());
            const sData = (siswaList || []).filter(s => normalizedIds.includes(s.id.toString())).sort((a, b) => a.nama.localeCompare(b.nama));
            if (sData.length > 0) {
                const title = suratData.lampiran_title ? (multipleData ? `${suratData.lampiran_title} (Siswa)` : suratData.lampiran_title) : 'DAFTAR SISWA';
                elements.push({ type: 'lampiran_siswa', content: { title, rows: sData } });
            }
        }

        if (hasGuru || hasSiswa) {
            // Append signature at the end of the tables
            elements.push({
                type: 'signature',
                content: {
                    tempat_ttd: suratData.tempat_ttd || 'Gowa',
                    tanggal_ttd: formatDate(suratData.tanggal_ttd),
                    pejabat_nama: suratData.pejabat_nama || 'Imran, S.Si.',
                    pejabat_jabatan: suratData.pejabat_jabatan || 'WKM Akademik',
                    qrCodeUrl: qrCodeUrl,
                    showQr: true
                }
            });
        }
    }

    return { elements, letterId, lampiranType, lampiranData };
}

// Render single element
function renderElement(el: ContentElement, idx: number) {
    switch (el.type) {
        case 'header':
            return React.createElement(View, { key: idx },
                el.content.nomor && React.createElement(View, { key: 'n', style: styles.headerRow },
                    React.createElement(Text, { style: styles.headerLabel }, 'Nomor'),
                    React.createElement(Text, { style: styles.headerColon }, ':'),
                    React.createElement(Text, { style: styles.headerValue }, el.content.nomor)
                ),
                el.content.perkara && React.createElement(View, { key: 'p', style: styles.headerRow },
                    React.createElement(Text, { style: styles.headerLabel }, 'Perihal'),
                    React.createElement(Text, { style: styles.headerColon }, ':'),
                    React.createElement(Text, { style: styles.headerValue }, el.content.perkara)
                ),
                el.content.lampiran && React.createElement(View, { key: 'l', style: styles.headerRow },
                    React.createElement(Text, { style: styles.headerLabel }, 'Lampiran'),
                    React.createElement(Text, { style: styles.headerColon }, ':'),
                    React.createElement(Text, { style: styles.headerValue }, el.content.lampiran)
                )
            );
        case 'kepada':
            return React.createElement(View, { key: idx, style: styles.kepadaSection },
                React.createElement(Text, { style: styles.kepadaLabel }, 'Kepada Yth.'),
                el.content.kepada && React.createElement(Text, { style: styles.kepadaNama }, el.content.kepada),
                el.content.alamat && React.createElement(Text, { style: styles.kepadaAlamat }, el.content.alamat)
            );
        case 'salam':
            return React.createElement(Text, {
                key: idx,
                style: el.content === 'closing' ? styles.salamClosing : styles.salam
            }, el.content === 'closing' ? "Wassalamu'alaikum Warahmatullahi Wabarakatuh." : (el.content.text || 'Assalamualaikum Wr. Wb.'));
        case 'paragraf':
            return React.createElement(Text, { key: idx, style: styles.paragraf }, el.content);
        case 'meeting':
            return React.createElement(View, { key: idx, style: styles.meetingTable },
                el.content.hari_tanggal && React.createElement(View, { key: 'h', style: styles.meetingRow },
                    React.createElement(Text, { style: styles.meetingLabel }, 'Hari, Tanggal'),
                    React.createElement(Text, { style: styles.meetingColon }, ':'),
                    React.createElement(Text, { style: styles.meetingValue }, el.content.hari_tanggal)
                ),
                el.content.waktu && React.createElement(View, { key: 'w', style: styles.meetingRow },
                    React.createElement(Text, { style: styles.meetingLabel }, 'Waktu'),
                    React.createElement(Text, { style: styles.meetingColon }, ':'),
                    React.createElement(Text, { style: styles.meetingValue }, el.content.waktu)
                ),
                el.content.tempat && React.createElement(View, { key: 't', style: styles.meetingRow },
                    React.createElement(Text, { style: styles.meetingLabel }, 'Tempat'),
                    React.createElement(Text, { style: styles.meetingColon }, ':'),
                    React.createElement(Text, { style: styles.meetingValue }, el.content.tempat)
                ),
                el.content.agenda && React.createElement(View, { key: 'a', style: styles.meetingRow },
                    React.createElement(Text, { style: styles.meetingLabel }, 'Agenda'),
                    React.createElement(Text, { style: styles.meetingColon }, ':'),
                    React.createElement(Text, { style: styles.meetingValue }, el.content.agenda?.replace ? el.content.agenda.replace(/\n/g, '\n') : el.content.agenda)
                )
            );
        case 'closing':
            return React.createElement(Text, { key: idx, style: styles.closingText }, el.content);
        case 'poin':
            const poinLines = el.content.split('\n').filter((l: string) => l.trim());
            return React.createElement(View, { key: idx, style: styles.poinSection },
                poinLines.map((line: string, i: number) =>
                    React.createElement(View, { key: i, style: { flexDirection: 'row', marginBottom: 6 } },
                        React.createElement(Text, { style: { ...styles.poinItem, width: 12, minWidth: 12 } }, '•'),
                        React.createElement(Text, { style: { ...styles.poinItem, flex: 1 } }, line)
                    )
                )
            );
        case 'lampiran_guru':
            return React.createElement(View, { key: idx, style: styles.lampiranSection },
                React.createElement(Text, { style: styles.lampiranTitle }, el.content.title),
                React.createElement(View, { style: styles.lampiranTable },
                    // Header row - 3 columns: No, Nama, NIP
                    React.createElement(View, { style: styles.lampiranTableRow },
                        React.createElement(Text, { style: { ...styles.lampiranTableHeaderCell, width: 30 } }, 'No'),
                        React.createElement(Text, { style: { ...styles.lampiranTableHeaderCell, flex: 2 } }, 'Nama'),
                        React.createElement(Text, { style: { ...styles.lampiranTableHeaderCell, width: 120 } }, 'NIP')
                    ),
                    // Data rows
                    el.content.rows.map((g: any, i: number) =>
                        React.createElement(View, { key: i, style: i % 2 === 0 ? styles.lampiranTableRow : styles.lampiranTableRowAlt },
                            React.createElement(Text, { style: { ...styles.lampiranTableCell, width: 30, textAlign: 'center' } }, `${i + 1}`),
                            React.createElement(Text, { style: { ...styles.lampiranTableCell, flex: 2 } }, g.nama),
                            React.createElement(Text, { style: { ...styles.lampiranTableCell, width: 120, textAlign: 'center' } }, g.nip || '-')
                        )
                    )
                )
            );
        case 'lampiran_siswa':
            return React.createElement(View, { key: idx, style: styles.lampiranSection },
                React.createElement(Text, { style: styles.lampiranTitle }, el.content.title),
                React.createElement(View, { style: styles.lampiranTable },
                    React.createElement(View, { style: styles.lampiranTableRow },
                        React.createElement(Text, { style: { ...styles.lampiranTableHeaderCell, width: 30 } }, 'No'),
                        React.createElement(Text, { style: { ...styles.lampiranTableHeaderCell, flex: 2 } }, 'Nama'),
                        React.createElement(Text, { style: { ...styles.lampiranTableHeaderCell, width: 120 } }, 'NISN')
                    ),
                    el.content.rows.map((s: any, i: number) =>
                        React.createElement(View, { key: i, style: i % 2 === 0 ? styles.lampiranTableRow : styles.lampiranTableRowAlt },
                            React.createElement(Text, { style: { ...styles.lampiranTableCell, width: 30, textAlign: 'center' } }, `${i + 1}`),
                            React.createElement(Text, { style: { ...styles.lampiranTableCell, flex: 2 } }, s.nama),
                            React.createElement(Text, { style: { ...styles.lampiranTableCell, width: 120, textAlign: 'center' } }, s.nisn || '-')
                        )
                    )
                )
            );
        case 'signature':
            return React.createElement(View, { key: idx, style: styles.signatureSection },
                React.createElement(Text, { style: styles.signaturePlace }, `${el.content.tempat_ttd}, ${el.content.tanggal_ttd}`),
                el.content.showQr && React.createElement(View, { key: 'qr', style: styles.qrSection },
                    React.createElement(Image, { src: el.content.qrCodeUrl, style: styles.qrImage })
                ),
                React.createElement(Text, { style: styles.signatureName }, el.content.pejabat_nama),
                React.createElement(Text, { style: styles.signatureJabatan }, el.content.pejabat_jabatan)
            );
        default:
            return null;
    }
}

// Build lampiran table component
function buildLampiranTableElement(title: string, rows: any[], type: 'guru' | 'siswa') {
    const headerStyle = { ...styles.lampiranTableHeaderCell };
    const cellStyle = { ...styles.lampiranTableCell };

    return React.createElement(View, { style: styles.lampiranSection, key: 'lamp-table' },
        React.createElement(Text, { style: styles.lampiranTitle }, title),
        React.createElement(View, { style: styles.lampiranTable },
            React.createElement(View, { style: styles.lampiranTableRow },
                React.createElement(Text, { style: { ...headerStyle, width: 30 } }, 'No'),
                React.createElement(Text, { style: { ...headerStyle, flex: 2 } }, type === 'guru' ? 'Nama' : 'Nama'),
                React.createElement(Text, { style: { ...headerStyle, width: 120 } }, type === 'guru' ? 'NIP' : 'NISN')
            ),
            rows.map((row: any, i: number) =>
                React.createElement(View, { key: i, style: i % 2 === 0 ? styles.lampiranTableRow : styles.lampiranTableRowAlt },
                    React.createElement(Text, { style: { ...cellStyle, width: 30, textAlign: 'center' } }, `${i + 1}`),
                    React.createElement(Text, { style: { ...cellStyle, flex: 2 } }, row.nama),
                    React.createElement(Text, { style: { ...cellStyle, width: 120, textAlign: 'center' } },
                        type === 'guru' ? (row.nip || '-') : (row.nisn || '-')
                    )
                )
            )
        )
    );
}

// Build lampiran page content - supports table data AND uploaded file
function buildLampiranPageContent(title: string, rows: any[], type: 'guru' | 'siswa', signatureEl: React.ReactElement, fileData?: string) {
    const elements: any[] = [];

    // If we have table data, render the lampiran table
    if (rows && rows.length > 0) {
        elements.push(buildLampiranTableElement(title, rows, type));
    }

    // If we have an uploaded file (data URL), render it as an image ONLY if it's an image
    if (fileData && fileData.startsWith('data:image/')) {
        elements.push(
            React.createElement(View, { key: 'file-attach', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Image, {
                    src: fileData,
                    style: { width: 450, height: 600, objectFit: 'contain' }
                })
            )
        );
    } else if (fileData && fileData.startsWith('data:application/pdf')) {
        // We cannot embed PDF into PDF easily on server with React-PDF
        // Add a text placeholder to avoid crash
        elements.push(
            React.createElement(View, { key: 'file-attach-pdf', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Text, { style: { fontSize: 12, color: '#666' } }, '[ File Lampiran PDF Terlampir dalam Sistem ]')
            )
        );
    }

    // Add signature
    elements.push(signatureEl);

    return elements;
}

// Build signature element for reuse
function buildSignatureElement(qrCodeUrl: string, logoUrl: string, tempat_ttd: string, tanggal_ttd: string, pejabat_nama: string, pejabat_jabatan: string, letterId: string) {
    return React.createElement(View, { style: styles.signatureSection },
        React.createElement(Text, { style: styles.signaturePlace }, `${tempat_ttd}, ${tanggal_ttd}`),
        qrCodeUrl && React.createElement(View, { key: 'qr', style: styles.qrSection },
            React.createElement(Image, { src: qrCodeUrl, style: styles.qrImage })
        ),
        React.createElement(Text, { style: styles.signatureName }, pejabat_nama),
        React.createElement(Text, { style: styles.signatureJabatan }, pejabat_jabatan)
    );
}

// Page component WITH background on every page
function SuratPage({ elements, backgroundUrl, qrCodeUrl, logoUrl, letterId, isLastPage }: {
    elements: ContentElement[];
    backgroundUrl: string;
    qrCodeUrl: string;
    logoUrl: string;
    letterId: string;
    isLastPage: boolean;
}) {
    // For lampiran pages (those with lampiran signature), render content directly
    return React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(View, { style: styles.pageContent },
            React.createElement(Image, { src: backgroundUrl, style: styles.backgroundImage }),
            React.createElement(View, { style: styles.contentArea },
                ...elements.map((el, idx) => renderElement(el, idx))
            ),
            React.createElement(Text, { style: styles.pageFooter }, letterId)
        )
    );
}

// Lampiran page component - separate page with background + lampiran table + same signature
function LampiranPage({ elements, backgroundUrl, letterId }: {
    elements: any[];
    backgroundUrl: string;
    letterId: string;
}) {
    // elements[0] = lampiran table, elements[1] = signature (or file image then signature)
    const contentElements = elements.filter((_, idx) => idx < elements.length - 1);
    const signatureElement = elements.length > 0 ? elements[elements.length - 1] : null;

    return React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(View, { style: styles.pageContent },
            React.createElement(Image, { src: backgroundUrl, style: styles.backgroundImage }),
            React.createElement(View, { style: { ...styles.contentArea, flexDirection: 'column', justifyContent: 'space-between' } },
                React.createElement(View, { key: 'main-area', style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' } },
                    ...contentElements
                ),
                signatureElement
            ),
            React.createElement(Text, { style: styles.pageFooter }, letterId)
        )
    );
}

// Estimate element height for page breaking
function estimateHeight(el: ContentElement): number {
    switch (el.type) {
        case 'header':
            return 15 * ((el.content.nomor ? 1 : 0) + (el.content.perkara ? 1 : 0) + (el.content.lampiran ? 1 : 0));
        case 'kepada': return 50;
        case 'salam': return 20;
        case 'paragraf': return Math.ceil(((el.content || '').length / 70)) * 14 + 12;
        case 'meeting': return 60;
        case 'closing': return 30;
        case 'poin': return Math.ceil(((el.content || '').split('\n').filter((l: string) => l.trim()).length * 18));
        case 'lampiran_guru': return 30 + (el.content.rows?.length || 0) * 20;
        case 'lampiran_siswa': return 30 + (el.content.rows?.length || 0) * 20;
        case 'signature': return 100; // Include QR height
        case 'page_break': return 9999; // Force new page
        default: return 20;
    }
}

// Split elements into pages - more generous for first page
function splitIntoPages(elements: ContentElement[], maxHeight: number): ContentElement[][] {
    const pages: ContentElement[][] = [];
    let current: ContentElement[] = [];
    let height = 0;
    const keepers = ['header', 'kepada', 'salam'];

    // More conservative height estimates
    for (const el of elements) {
        // Use more generous height estimates
        const baseH = estimateHeight(el);
        const h = baseH * 1.2; // Add 20% buffer

        if (current.length === 0 && keepers.includes(el.type)) {
            current.push(el);
            height += h;
        } else if (height + h <= maxHeight) {
            current.push(el);
            height += h;
        } else {
            if (current.length > 0) pages.push([...current]);
            current = [el];
            height = h;
        }
    }

    if (current.length > 0) pages.push(current);
    return pages.length > 0 ? pages : [[]];
}

// Document component - handles main content + separate lampiran page
function SuratDocument({ pages, backgroundUrl, qrCodeUrl, logoUrl, letterId, lampiranData, suratData }: {
    pages: ContentElement[][];
    backgroundUrl: string;
    qrCodeUrl: string;
    logoUrl: string;
    letterId: string;
    lampiranData?: { title: string; rows: any[]; type: 'guru' | 'siswa'; fileData?: string };
    suratData: any;
}) {
    const tempat_ttd = suratData.tempat_ttd || 'Gowa';
    const tanggal_ttd = formatDate(suratData.tanggal_ttd);
    const pejabat_nama = suratData.pejabat_nama || 'Imran, S.Si.';
    const pejabat_jabatan = suratData.pejabat_jabatan || 'WKM Akademik';

    // Build signature element for lampiran page
    const lampiranSignatureEl = buildSignatureElement(qrCodeUrl, logoUrl, tempat_ttd, tanggal_ttd, pejabat_nama, pejabat_jabatan, letterId);

    // Lampiran page elements
    const lampiranPageElements = lampiranData
        ? buildLampiranPageContent(lampiranData.title, lampiranData.rows, lampiranData.type, lampiranSignatureEl, lampiranData.fileData)
        : [];

    return React.createElement(Document, {},
        ...pages.map((pageElements, i) =>
            React.createElement(SuratPage, {
                key: i,
                elements: pageElements,
                backgroundUrl,
                qrCodeUrl,
                logoUrl,
                letterId,
                isLastPage: i === pages.length - 1 && !lampiranData
            })
        ),
        // Add separate lampiran page if lampiran data exists
        lampiranData && lampiranPageElements.length > 0
            ? React.createElement(LampiranPage, {
                key: 'lampiran',
                elements: lampiranPageElements,
                backgroundUrl,
                letterId
            })
            : null
    );
}

export async function POST(request: NextRequest) {
    try {
        // 0. Enforce authentication immediately before any payload processing or network access
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized: Sesi atau token tidak valid' }, { status: 401 });
        }

        const body = await request.json();
        const { suratData, baseUrl = '', suratId } = body;

        if (!suratData || !suratData.nomor_surat) {
            return NextResponse.json({ ok: false, error: 'Data surat tidak lengkap' }, { status: 400 });
        }

        // 1. Background & Logo Setup
        // CRITICAL FIX: Use baseUrl from frontend (window.location.origin) instead of hardcoded localhost.
        // Server-side fetch cannot reach localhost:3000 on Vercel/Cloudflare.
        const localBaseUrl = baseUrl && baseUrl.startsWith('http') ? baseUrl : 'http://localhost:3000';
        let backgroundUrl = `${localBaseUrl}/images/Surat%20ACCA.png`;
        let logoUrl = `${localBaseUrl}/logo-icon.png`;
        let qrLogoUrl = `${localBaseUrl}/logo_final.png`; // Default: logo ACCA untuk QR
        console.log('[PDF] Using localBaseUrl:', localBaseUrl, '(passed baseUrl from frontend:', baseUrl, ')');

        // 2. Validate session & letter data against NestJS backend
        let guruList: any[] = [];
        let siswaList: any[] = [];
        try {
            const { status, body: pdfData } = await nestFetchAsUser('/surat/generate-pdf-data', token, {
                method: 'POST',
                body: JSON.stringify({ surat_id: suratId }),
            });
            if (status === 401 || status === 403) {
                return NextResponse.json({ ok: false, error: 'Sesi autentikasi tidak valid atau tidak memiliki izin' }, { status });
            }
            if (!pdfData?.ok) {
                const errMsg = pdfData?.error || pdfData?.message || 'Gagal mengambil data konfigurasi dan lampiran surat dari server backend';
                return NextResponse.json({ ok: false, error: errMsg }, { status: status >= 400 ? status : 500 });
            }

            const configData = pdfData.configData;
            if (configData) {
                if (configData.background_url) backgroundUrl = configData.background_url;
                if (configData.logo_kecil_url) logoUrl = configData.logo_kecil_url;
                else if (configData.logo_url) logoUrl = configData.logo_url;
                if (configData.logo_qr_url) qrLogoUrl = configData.logo_qr_url;
            }
            guruList = pdfData.guruList || [];
            siswaList = pdfData.siswaList || [];
        } catch (configErr: any) {
            console.error('[PDF] Gagal menghubungi backend NestJS:', configErr);
            return NextResponse.json(
                { ok: false, error: 'Gagal terhubung ke backend untuk validasi data surat: ' + (configErr?.message || String(configErr)) },
                { status: 502 }
            );
        }

        // 3. Resolve Attachment File URL to Base64 ONLY AFTER authentication & authorization succeed
        if (suratData.lampiran_file && typeof suratData.lampiran_file === 'string' && suratData.lampiran_file.startsWith('http')) {
            suratData.lampiran_file = await fetchFileToDataUrl(suratData.lampiran_file);
        }

        // Build elements first to get letterId (pass suratId received from frontend if exists)
        const tempResult = buildContentElements(suratData, '', '', guruList, siswaList, null, suratId);
        const letterId = tempResult.letterId;

        // Fleksibel mengarah ke halaman hosting saat ini
        const verificationUrl = `${baseUrl}/surat/scan/${letterId}`;

        console.log('[PDF] Generating PDF...');
        console.log('[PDF] Scan URL:', verificationUrl);

        // Download background, logo (kop), and QR logo (ACCA) as base64
        console.log('[PDF] Downloading background, logo, and QR logo...');
        const [bgDataUrl, logoDataUrl, qrLogoDataUrl] = await Promise.all([
            imageToDataUrl(backgroundUrl),
            imageToDataUrl(logoUrl),
            imageToDataUrl(qrLogoUrl),
        ]);

        console.log('[PDF] bgDataUrl length:', bgDataUrl.length);
        console.log('[PDF] logoDataUrl (kop) length:', logoDataUrl.length);
        console.log('[PDF] qrLogoDataUrl (ACCA) length:', qrLogoDataUrl.length);

        // Generate QR code WITH logo embedded (use ACCA logo for QR)
        console.log('[PDF] Generating QR with logo...');
        const qrWithLogo = await generateQRWithLogo(qrLogoDataUrl, verificationUrl);
        console.log('[PDF] QR with logo length:', qrWithLogo.length);

        // Use data URLs (with better fallback handling)
        const finalBgUrl = bgDataUrl || backgroundUrl;
        const finalLogoUrl = logoDataUrl || logoUrl;
        const finalQrUrl = qrWithLogo;

        // Diagnostic logging
        console.log('[PDF] Background config:', {
            originalBgUrl: backgroundUrl,
            bgDataUrlLength: bgDataUrl.length,
            finalBgUrlStart: finalBgUrl.substring(0, 50) + (finalBgUrl.length > 50 ? '...' : ''),
            isDataUrl: finalBgUrl.startsWith('data:')
        });
        console.log('[PDF] Logo config:', {
            originalLogoUrl: logoUrl,
            logoDataUrlLength: logoDataUrl.length,
            finalLogoUrlStart: finalLogoUrl.substring(0, 50) + (finalLogoUrl.length > 50 ? '...' : ''),
            isDataUrl: finalLogoUrl.startsWith('data:'),
            qrLogoUrl,
            qrLogoDataUrlLength: qrLogoDataUrl.length
        });

        // If we got no valid images, return error
        if (!finalBgUrl && !finalLogoUrl && !finalQrUrl) {
            return NextResponse.json({ ok: false, error: 'Gagal mengambil gambar. Pastikan server eksternal dapat diakses.' }, { status: 500 });
        }

        const hasLampiranFile = !!(suratData.lampiran_file && suratData.lampiran_file.trim().length > 5);

        const lampiranData = hasLampiranFile ? {
            title: suratData.lampiran_title || 'Lampiran File',
            rows: [],
            type: (suratData.lampiran_type === 'guru' ? 'guru' : 'siswa') as 'guru' | 'siswa',
            fileData: suratData.lampiran_file || null
        } : undefined;

        // Now build with actual URLs - excludeLampiran=false to let it handle tables inline
        const { elements } = buildContentElements(suratData, finalQrUrl, finalLogoUrl, guruList, siswaList, false, suratId);

        // CRITICAL: Remove page_break markers — they cause splitIntoPages to overflow onto an
        // unreachable page (SuratDocument doesn't render extra pages from splitIntoPages).
        // Let React-PDF's <Page> wrap each logical page break instead.
        const filteredElements = elements.filter(el => el.type !== 'page_break');

        const pages = splitIntoPages(filteredElements, CONTENT_HEIGHT - 150); // Reserve space for QR + signature

        // Create document with data URLs for reliable image embedding
        const doc = React.createElement(SuratDocument, {
            pages,
            backgroundUrl: finalBgUrl,
            logoUrl: finalLogoUrl,
            qrCodeUrl: finalQrUrl,
            letterId,
            lampiranData,
            suratData
        });
        const pdfBuffer = await renderToBuffer(doc as any);
        let finalPdfBuffer = Buffer.from(pdfBuffer);

        // MERGE PDF ATTACHMENT IF EXISTS
        if (suratData.lampiran_file && suratData.lampiran_file.startsWith('data:application/pdf')) {
            console.log('[PDF] Merging uploaded PDF attachment...');
            try {
                const mainPdfDoc = await PDFDocument.load(finalPdfBuffer);
                const attachmentPdfBytes = Buffer.from(suratData.lampiran_file.split(',')[1], 'base64');
                const attachmentPdfDoc = await PDFDocument.load(attachmentPdfBytes);
                
                const copiedPages = await mainPdfDoc.copyPages(attachmentPdfDoc, attachmentPdfDoc.getPageIndices());
                
                const verificationText = `ID Verifikasi: ${letterId}`;
                
                for (const page of copiedPages) {
                    mainPdfDoc.addPage(page);
                    
                    // Add verification footer to the appended page
                    const { width } = page.getSize();
                    page.drawText(verificationText, {
                        x: 20 * 2.83465, // 20mm from left
                        y: 10 * 2.83465, // 10mm from bottom
                        size: 8,
                        color: rgb(0.39, 0.45, 0.54), // #64748b approx
                    });
                }
                
                const mergedPdfBytes = await mainPdfDoc.save();
                finalPdfBuffer = Buffer.from(mergedPdfBytes);
                console.log('[PDF] Merge successful, new size:', finalPdfBuffer.length, 'bytes');
            } catch (mergeErr) {
                console.error('[PDF] Merge error:', mergeErr);
                // Fallback to main PDF only if merge fails
            }
        }

        console.log('[PDF] Generated successfully, final size:', finalPdfBuffer.length, 'bytes');

        return new NextResponse(new Uint8Array(finalPdfBuffer as unknown as ArrayBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="SURAT_${suratData.nomor_surat.replace(/\//g, '-')}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('[PDF] Error:', error.message || String(error));
        return NextResponse.json({ ok: false, error: error.message || 'Gagal generate PDF' }, { status: 500 });
    }
}
