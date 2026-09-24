/**
 * lib/whatsapp-group.ts
 * Kirim notifikasi ketidakhadiran ke grup WA via konfigurasi database (site_settings).
 *
 * Konfigurasi (site_settings):
 * - wa_token_ketidakhadiran                  → Token API
 * - wa_targets_ketidakhadiran                → JSON array [{id, name, code}, ...]
 * - wa_template_ketidakhadiran              → Template pesan (placeholder sesuai kolom)
 * - wa_details_row_template_ketidakhadiran  → Template baris data (placeholder sesuai kolom tabel)
 * - notif_wa_ketidakhadiran                  → Toggle aktif/nonaktif
 *
 * Kolom tabel ketidakhadiran:
 * - id, timestamp, jenis (IZIN/SAKIT), nisn, nama, kelas, tgl_mulai, tgl_selesai,
 *   keterangan, status, petugas_role, petugas_guru_id, petugas_nama, aktif
 *
 * DEFAULT TEMPLATES:
 * Template utama: Digunakan ketika site_settings tidak memiliki template.
 * Template baris: Placeholder {{no}}, {{nama}}, {{nisn}}, {{kelas}}, {{status}}, {{waktu}}, {{keterangan}}
 */

import { sendWhatsAppWithDetails, buildWhatsAppDetailsMessage, isWAToggleEnabled, isWAImageMode } from './wa-sender';
import { prisma } from './prisma';
import { ketidakhadiranReportHtml } from './report-templates';
import { sendReportAsImage } from './wa-report-image';
import { REPORT_IMAGE_EXT, renderHtmlToImage } from './report-image';

// Default templates hardcoded agar tidak perlu UI edit
const DEFAULT_TEMPLATE = `📋 LAPORAN KETIDAKHADIRAN

🗓️ {{tanggal}}
👤 Petugas: {{petugas_nama}}
📁 Jenis: {{jenis}}

─────────────────────

{{details}}

─────────────────────
📊 Total: {{total}} siswa
_Dikirim dari Sistem ACCA_`;

const DEFAULT_ROW_TEMPLATE = `{{no}}. {{nama}} ({{kelas}})
   NISN: {{nisn}} | {{waktu}}
   Status: {{status}} | {{keterangan}}`;

export interface KetidakhadiranHeader {
    tanggal: string;
    petugas_nama: string;
    jenis: string;
    total: number;
}

export interface KetidakhadiranInputRow {
    nama: string;
    nisn?: string;
    kelas: string;
    status?: string;
    waktu?: string;
    keterangan?: string;
}

const CHUNK_SIZE = 15;

/** Satu bagian laporan siap kirim: baris-barisnya plus mention khusus bagian itu. */
interface Part {
    rows: Record<string, string>[];
    /** Nomor bagian & totalnya, kosong bila laporan muat dalam satu pesan. */
    label: string;
    mentions: string[];
    tags: string[];
}

/**
 * Peta NISN → nomor WA guru asuhnya, untuk menandai (mention) guru asuh yang relevan.
 * Dikembalikan per-NISN (bukan satu daftar global) supaya laporan yang terpecah jadi
 * beberapa bagian hanya menandai guru asuh siswa yang ada di bagian itu — sebelumnya
 * setiap bagian menandai seluruh guru asuh, termasuk yang siswanya tidak ada di sana.
 */
async function guruAsuhByNisn(nisns: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (nisns.length === 0) return map;

    try {
        const taData = await prisma.master_tahun_ajaran.findFirst({
            where: { is_active: true },
            select: { tahun_ajaran: true }
        });

        const activeTA = taData?.tahun_ajaran;
        if (!activeTA) return map;

        const asuhData = await prisma.guru_asuh.findMany({
            where: {
                nisn_siswa: { in: nisns },
                tahun_ajaran: activeTA,
                aktif: true
            },
            select: { nip: true, nisn_siswa: true }
        });

        if (!asuhData || asuhData.length === 0) return map;

        const nips = Array.from(new Set(asuhData.map(a => a.nip).filter(Boolean))) as string[];
        const guruData = await prisma.master_guru.findMany({
            where: {
                nip: { in: nips },
                no_hp: { not: null }
            },
            select: { nip: true, no_hp: true }
        });

        const hpByNip = new Map<string, string>();
        for (const g of guruData || []) {
            if (!g.nip || !g.no_hp) continue;
            let num = String(g.no_hp).trim().replace(/[^\d]/g, '');
            if (num.startsWith('0')) num = '62' + num.slice(1);
            else if (num.startsWith('8')) num = '62' + num;
            if (num) hpByNip.set(g.nip, num);
        }

        for (const a of asuhData) {
            if (!a.nip || !a.nisn_siswa) continue;
            const num = hpByNip.get(a.nip);
            if (!num) continue;
            const list = map.get(a.nisn_siswa) || [];
            if (!list.includes(num)) list.push(num);
            map.set(a.nisn_siswa, list);
        }
    } catch (err) {
        console.warn('[WA Ketidakhadiran] Failed to fetch guru asuh tags', err);
    }

    return map;
}

/** Siapkan data template + pembagian bagian; dipakai bersama oleh pratinjau dan pengiriman. */
async function prepare(header: KetidakhadiranHeader, rows: KetidakhadiranInputRow[]) {
    let namaSekolah = 'Sekolah';
    try {
        const schoolData = await prisma.profil_sekolah.findFirst({
            select: { nama: true }
        });
        if (schoolData?.nama) {
            namaSekolah = schoolData.nama;
        }
    } catch (err) {
        console.warn("[WA Ketidakhadiran] Failed to fetch school name", err);
    }

    const templateData = {
        tanggal: header.tanggal,
        petugas_nama: header.petugas_nama,
        jenis: header.jenis,
        total: String(header.total ?? rows.length),
        nama_sekolah: namaSekolah,
    };

    const formattedRows: Record<string, string>[] = rows.map((row, i) => ({
        no: (i + 1).toString(),
        nama: row.nama,
        nisn: row.nisn || '-',
        kelas: row.kelas,
        status: row.status || '-',
        waktu: row.waktu || '-',
        keterangan: row.keterangan || '-',
    }));

    const asuhMap = await guruAsuhByNisn(rows.map(r => r.nisn).filter(Boolean) as string[]);

    const parts: Part[] = [];
    for (let i = 0; i < formattedRows.length; i += CHUNK_SIZE) {
        const chunk = formattedRows.slice(i, i + CHUNK_SIZE);
        const numbers = new Set<string>();
        for (const r of chunk) {
            for (const num of asuhMap.get(r.nisn) || []) numbers.add(num);
        }
        parts.push({
            rows: chunk,
            label: '',
            mentions: Array.from(numbers).map(n => `${n}@s.whatsapp.net`),
            tags: Array.from(numbers).map(n => `@${n}`),
        });
    }

    if (parts.length > 1) {
        parts.forEach((p, idx) => { p.label = `Bagian ${idx + 1}/${parts.length}`; });
    }

    return { templateData, parts, isImageMode: await isWAImageMode('ketidakhadiran') };
}

function bagianAppend(label: string) {
    return label ? { key: 'bagian', text: `\n\n_(${label})_` } : undefined;
}

export async function sendWhatsAppGroup(
    header: KetidakhadiranHeader,
    rows: KetidakhadiranInputRow[]
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    try {
        const isEnabled = await isWAToggleEnabled('notif_wa_ketidakhadiran');
        if (!isEnabled) {
            console.log("[WA Ketidakhadiran] Notifications disabled");
            return { ok: false, skipped: true, error: 'Notifikasi WhatsApp ketidakhadiran sedang dimatikan (notif_wa_ketidakhadiran).' };
        }

        const { templateData, parts, isImageMode } = await prepare(header, rows);

        let allOk = true;
        const failures: string[] = [];

        for (let idx = 0; idx < parts.length; idx++) {
            const part = parts[idx];
            const partText = part.label ? ` (${part.label})` : '';
            const partLabel = part.label ? `${part.label}: ` : '';
            let imageError: string | undefined;

            if (isImageMode) {
                const html = ketidakhadiranReportHtml({ ...templateData, bagian: part.label }, part.rows);
                const captionTitle = `📋 Laporan Ketidakhadiran${partText}`;
                const caption = part.tags.length > 0 ? `${captionTitle}\nCC: ${part.tags.join(' ')}` : captionTitle;
                const fileName = `ketidakhadiran-${Date.now()}-p${idx + 1}.${REPORT_IMAGE_EXT}`;

                const imgResult = await sendReportAsImage('ketidakhadiran', html, fileName, caption, part.mentions);
                if (imgResult.ok) {
                    console.log(`[WA Ketidakhadiran] Sent part ${idx + 1} as image!`);
                    continue;
                }
                imageError = imgResult.error || 'unknown';
                console.error(`[WA Ketidakhadiran] Image mode failed for part ${idx + 1}, fallback ke teks:`, imageError);
            }

            const result = await sendWhatsAppWithDetails(
                'ketidakhadiran',
                { ...templateData, bagian: part.label },
                part.rows,
                { template: DEFAULT_TEMPLATE, rowTemplate: DEFAULT_ROW_TEMPLATE },
                part.mentions,
                bagianAppend(part.label)
            );

            if (result.ok) {
                console.log(`[WA Ketidakhadiran] Sent part ${idx + 1} successfully!`);
            } else {
                console.error(`[WA Ketidakhadiran] Failed part ${idx + 1}:`, result.error);
                allOk = false;
                const reason = imageError
                    ? `mode gambar: ${imageError}; teks: ${result.error || 'unknown'}`
                    : (result.error || 'unknown');
                failures.push(`${partLabel}${reason}`);
            }
        }

        return allOk ? { ok: true } : { ok: false, error: failures.join(' | ') };
    } catch (err: any) {
        console.error("[WA Ketidakhadiran] Error:", err);
        return { ok: false, error: err?.message || String(err) };
    }
}

/** Satu bagian pratinjau: teks apa adanya, atau gambar yang persis akan dikirim. */
export interface KetidakhadiranPreviewPart {
    label: string;
    /** Terisi pada mode teks. */
    text?: string;
    /** Terisi pada mode gambar: data URL JPEG hasil render yang sama dengan pengiriman. */
    imageDataUrl?: string;
    /** Caption pendamping gambar. */
    caption?: string;
}

export async function previewWhatsAppGroup(
    header: KetidakhadiranHeader,
    rows: KetidakhadiranInputRow[]
): Promise<{ ok: boolean; mode?: 'image' | 'text'; parts?: KetidakhadiranPreviewPart[]; error?: string }> {
    try {
        const { templateData, parts, isImageMode } = await prepare(header, rows);
        const out: KetidakhadiranPreviewPart[] = [];

        for (const part of parts) {
            const partText = part.label ? ` (${part.label})` : '';

            if (isImageMode) {
                const html = ketidakhadiranReportHtml({ ...templateData, bagian: part.label }, part.rows);
                const captionTitle = `📋 Laporan Ketidakhadiran${partText}`;
                const caption = part.tags.length > 0 ? `${captionTitle}\nCC: ${part.tags.join(' ')}` : captionTitle;
                const buffer = await renderHtmlToImage(html);
                out.push({
                    label: part.label,
                    imageDataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
                    caption,
                });
                continue;
            }

            const built = await buildWhatsAppDetailsMessage(
                'ketidakhadiran',
                { ...templateData, bagian: part.label },
                part.rows,
                { template: DEFAULT_TEMPLATE, rowTemplate: DEFAULT_ROW_TEMPLATE },
                part.mentions,
                bagianAppend(part.label)
            );
            if (!built.ok || !built.message) {
                return { ok: false, error: built.error || 'Gagal menyusun pratinjau' };
            }
            out.push({ label: part.label, text: built.message });
        }

        return { ok: true, mode: isImageMode ? 'image' : 'text', parts: out };
    } catch (err: any) {
        console.error("[WA Ketidakhadiran] Preview error:", err);
        return { ok: false, error: err?.message || String(err) };
    }
}
