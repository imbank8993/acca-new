/**
 * lib/whatsapp-piket.ts
 * Kirim laporan piket harian ke grup WA via konfigurasi database (site_settings).
 *
 * Konfigurasi (site_settings):
 * - wa_token_piket                  → Token API untuk piket
 * - wa_target_piket                 → Group ID / nomor WA target
 * - wa_template_piket              → Template pesan (placeholder sesuai kolom tabel)
 * - wa_details_row_template_piket  → Template baris data (placeholder: nama_kelas, nama_guru, status_kehadiran)
 * - notif_wa_piket                 → Toggle aktif/nonaktif
 *
 * Kolom tabel laporan_piket:
 * - tanggal, nama_guru_piket, jam_ke, keterangan
 *
 * Kolom tabel laporan_piket_detail:
 * - nama_kelas, nama_guru, status_kehadiran
 */

import { sendWhatsAppWithDetails, isWAToggleEnabled, isWAImageMode } from './wa-sender';
import { getTimezone } from './timezone';
import { prisma } from './prisma';
import { piketReportHtml } from './report-templates';
import { sendReportAsImage } from './wa-report-image';
import { REPORT_IMAGE_EXT } from './report-image';

export type WASendStatus = 'sent' | 'skipped' | 'failed';

export interface WASendPiketResult {
    ok: boolean;
    status: WASendStatus;
    error?: string;
}

function kelasSortKey(nama: string): string {
    const map: Record<string, string> = { X: '1', XI: '2', XII: '3' };
    return (nama || '').replace(/^(XII|XI|X)/i, (m) => map[m.toUpperCase()] || '4');
}

function normalizeTeacherName(name: string): string {
    return (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function cleanTeacherBaseName(name: string): string {
    return (name || '')
        .replace(/\b(dr|prof|ir|drs|dra|h|hj)\b\.?/gi, '')
        .replace(/,\s*([A-Za-z\.\s]+)$/g, '') // strip trailing gelar like ", S.Pd., M.Pd."
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
}

function matchTeacher(nameA?: string | null, nameB?: string | null): boolean {
    if (!nameA || !nameB) return false;
    const a = nameA.trim().toLowerCase();
    const b = nameB.trim().toLowerCase();
    if (a === b) return true;
    const normA = normalizeTeacherName(a);
    const normB = normalizeTeacherName(b);
    if (!normA || !normB) return false;
    if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;

    const baseA = cleanTeacherBaseName(a);
    const baseB = cleanTeacherBaseName(b);
    if (baseA && baseB && (baseA === baseB || (baseA.length >= 4 && (baseA.includes(baseB) || baseB.includes(baseA))))) {
        return true;
    }
    return false;
}

function isEligibleForIzinCheck(status: string): boolean {
    const s = (status || '').toLowerCase();
    if (s.includes('kosong')) return true;
    if (s.includes('daring')) return true;
    if (s.includes('tanpa pendampingan') || (s.includes('penugasan') && s.includes('tanpa'))) return true;
    if (s.includes('tanpa keterangan') || s.includes('tidak hadir')) return true;
    if (s === 'izin' || s === 'sakit') return true;
    return false;
}

export async function sendWhatsAppPiket(data: any): Promise<WASendPiketResult> {
    try {
        console.log("=== WHATSAPP PIKET ===");
        console.log("Sending data:", JSON.stringify(data, null, 2));

        const { piketId, guruPiket, jamPiket, keteranganTambahan, details, piketDate, timestamp } = data;

        if (!timestamp) {
            console.error("No timestamp provided!");
            return { ok: false, status: 'failed', error: 'Timestamp tidak ditemukan' };
        }

        const isEnabled = await isWAToggleEnabled('notif_wa_piket');
        if (!isEnabled) {
            console.log("[WA Piket] Notifications disabled (notif_wa_piket != true)");
            return { ok: false, status: 'skipped', error: 'Notifikasi WhatsApp piket dinonaktifkan di pengaturan' };
        }

        const tz = await getTimezone();

        const isPlainDate = typeof piketDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(piketDate);
        const dateObj = isPlainDate ? new Date(piketDate + 'T00:00:00Z') : new Date(timestamp);
        const dateTz = isPlainDate ? 'UTC' : tz;
        const piketTanggal = dateObj.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: dateTz
        });
        const piketHari = dateObj.toLocaleDateString('id-ID', { weekday: 'long', timeZone: dateTz });
        const piketWaktu = new Date(timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', timeZone: tz
        });

        const fileDate = isPlainDate ? piketDate : (dateObj.toISOString ? dateObj.toISOString().slice(0, 10) : String(piketDate || ''));

        let namaSekolah = 'Sekolah';
        try {
            const schoolData = await prisma.profil_sekolah.findFirst({ select: { nama: true } });
            if (schoolData?.nama) {
                namaSekolah = schoolData.nama;
            }
        } catch (err) {
            console.warn("[WA Piket] Failed to fetch school name", err);
        }

        let izinList: any[] = [];
        if (fileDate) {
            try {
                const dateParts = String(fileDate).split('T')[0].split('-').map(Number);
                const targetDate = (dateParts.length === 3 && !dateParts.some(isNaN))
                    ? new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0))
                    : new Date(fileDate);

                const izinData = await prisma.izin_guru.findMany({
                    where: {
                        tanggal_mulai: { lte: targetDate },
                        tanggal_selesai: { gte: targetDate },
                        status: { in: ['disetujui', 'pending', 'approved', 'Disetujui', 'Pending'] }
                    },
                    select: { nama_guru: true, nip: true, jenis: true, status: true, tanggal_mulai: true, tanggal_selesai: true }
                });
                if (izinData) {
                    izinList = izinData;
                    console.log(`[WA Piket] Found ${izinList.length} izin_guru records for date ${fileDate} (${targetDate.toISOString()})`);
                }
            } catch (err) {
                console.warn("[WA Piket] Error fetching izin_guru:", err);
            }
        }

        let rows: Record<string, string>[] = [];
        if (details && details.length > 0) {
            const sorted = [...details].sort((a, b) => {
                const kelasA = kelasSortKey(a.nama_kelas || a.kelas);
                const kelasB = kelasSortKey(b.nama_kelas || b.kelas);
                if (kelasA !== kelasB) return kelasA.localeCompare(kelasB);
                return parseInt(a.jam_ke || '0') - parseInt(b.jam_ke || '0');
            });

            for (const d of sorted) {
                const statusList = [];
                const mainStatus = d.status_kehadiran || d.status;
                if (mainStatus) statusList.push(mainStatus);
                if (d.status_tambahan_1) statusList.push(d.status_tambahan_1);
                if (d.status_tambahan_2) statusList.push(d.status_tambahan_2);
                if (d.status_tambahan_3) statusList.push(d.status_tambahan_3);

                const fullStatus = statusList.length > 0 ? statusList.join(', ') : '-';
                const namaGuru = d.guru_jadwal || d.nama_guru || d.guru || '-';

                let infoPengganti = '';
                if (d.guru_pengganti && d.guru_jadwal && d.guru_pengganti !== d.guru_jadwal) {
                    infoPengganti = ` (Pengganti: ${d.guru_pengganti})`;
                }

                let izinSakit = '-';
                const matchingIzin = izinList.find(iz =>
                    matchTeacher(iz.nama_guru, d.guru_jadwal) ||
                    matchTeacher(iz.nama_guru, d.nama_guru) ||
                    matchTeacher(iz.nama_guru, d.guru) ||
                    matchTeacher(iz.nama_guru, namaGuru)
                );

                if (matchingIzin) {
                    if (matchingIzin.status === 'pending' || matchingIzin.status === 'Pending') {
                        izinSakit = 'Pending';
                    } else if (matchingIzin.status === 'disetujui' || matchingIzin.status === 'approved' || matchingIzin.status === 'Disetujui') {
                        const j = (matchingIzin.jenis || '').toLowerCase();
                        if (j === 'sakit') {
                            izinSakit = 'Sakit';
                        } else if (j === 'dinas_luar' || j.includes('dinas')) {
                            izinSakit = 'Dinas Luar';
                        } else {
                            izinSakit = 'Izin';
                        }
                    } else {
                        izinSakit = '-';
                    }
                } else if (isEligibleForIzinCheck(fullStatus)) {
                    izinSakit = 'Tidak Ada';
                }

                rows.push({
                    nama_kelas: d.nama_kelas || d.kelas || '-',
                    nama_guru: namaGuru,
                    status_kehadiran: fullStatus,
                    izin_sakit: izinSakit,
                    info_pengganti: infoPengganti,
                    status_tambahan_1: d.status_tambahan_1 || '',
                    status_tambahan_2: d.status_tambahan_2 || '',
                    status_tambahan_3: d.status_tambahan_3 || '',
                    guru_pengganti: d.guru_pengganti || '',
                    guru_jadwal: d.guru_jadwal || d.guru || '',
                    dokumentasi_url: d.dokumentasi_url || ''
                });
            }
        }

        const templateData = {
            tanggal: piketTanggal,
            hari: piketHari,
            jam_ke: jamPiket,
            keterangan: keteranganTambahan || '',
            nama_guru_piket: guruPiket,
            waktu: piketWaktu,
            nama_sekolah: namaSekolah,
        };

        const hasDocs = rows.some(r => r.dokumentasi_url);
        let docText = '';
        if (hasDocs && piketId) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://acca.icgowa.sch.id';
            docText = `\nDokumentasi : ${appUrl}/piket/dokumentasi/${piketId}`;
        }

        console.log("Template data:", templateData);
        console.log("Rows:", rows);

        let imageError: string | undefined;
        if (await isWAImageMode('piket')) {
            const html = piketReportHtml(templateData, rows);

            const caption = `Laporan Piket ${piketHari}, ${piketTanggal}${docText}`;
            const fileDate = isPlainDate ? piketDate : dateObj.toISOString().slice(0, 10);
            const fileName = `piket-${fileDate}-${Date.now()}.${REPORT_IMAGE_EXT}`;
            const imgResult = await sendReportAsImage('piket', html, fileName, caption);
            if (imgResult.ok) {
                console.log("[WA Piket] Sent as image!");
                return { ok: true, status: 'sent' };
            }
            imageError = imgResult.error;
            console.error("[WA Piket] Image mode failed, fallback ke teks:", imgResult.error);
        }

        const result = await sendWhatsAppWithDetails(
            'piket',
            { ...templateData, link_dokumentasi: docText.trim() },
            rows,
            undefined,
            undefined,
            { key: 'link_dokumentasi', text: docText }
        );

        if (result.ok) {
            console.log("[WA Piket] Sent successfully!");
            return { ok: true, status: 'sent' };
        } else {
            console.error("[WA Piket] Failed:", result.error);
            const combinedError = imageError ? `Mode gambar: ${imageError} | Teks: ${result.error || 'gagal'}` : (result.error || 'Gagal mengirim pesan WhatsApp');
            return { ok: false, status: 'failed', error: combinedError };
        }

    } catch (error: any) {
        console.error("[WA Piket] Failed to send WhatsApp:", error);
        return { ok: false, status: 'failed', error: error?.message || String(error) };
    }
}
