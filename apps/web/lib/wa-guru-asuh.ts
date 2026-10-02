/**
 * Pemberitahuan WhatsApp untuk pengajuan laporan Guru Asuh.
 *
 * Mengirim notifikasi ke nomor WhatsApp pengguna yang ditunjuk sebagai approval
 * (berdasarkan Hak Akses Fitur: `guru_asuh_approval_access_config`, bawaan: WKM Keasramaan).
 *
 * Sesuai kebutuhan:
 * "nama' telah mengajukan laporan guru asuh periode 'bulan' pada tanggal ..... , silakan akses 'laman' untuk meninjau ajuan."
 *
 * Semua kegagalan ditelan / safe-handled: WA adalah usaha terbaik (best-effort),
 * tidak boleh menggagalkan pengajuan laporan yang sudah tersimpan di basis data.
 */

import { prisma } from './prisma';
import { isWAToggleEnabled, sendWhatsApp } from './wa-sender';

const NAMA_BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TAUTAN_APPROVAL = '/guru-asuh?tab=approval';

/**
 * Alamat publik aplikasi untuk tautan yang diklik dari WhatsApp.
 */
function baseUrl(): string {
    const kandidat = [
        process.env.NEXT_PUBLIC_BASE_URL,
        process.env.APP_PUBLIC_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.NEXT_PUBLIC_ACCA_URL,
    ];
    for (const c of kandidat) {
        const url = String(c ?? '').trim().replace(/\/+$/, '');
        if (!url) continue;
        if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\/\/192\.168\.|\/\/10\./i.test(url)) continue;
        return url;
    }
    return 'https://acca.icgowa.sch.id';
}

/**
 * Cari nomor HP guru/pegawai dari master_guru berdasarkan NIP.
 */
export async function nomorHpGuru(nip: string | null | undefined): Promise<string | null> {
    const asli = String(nip ?? '').trim();
    if (!asli) return null;
    const kandidat = [...new Set([asli, asli.padStart(10, '0'), asli.replace(/^0+/, '')])].filter(Boolean);
    try {
        const guru = await prisma.master_guru.findFirst({
            where: { nip: { in: kandidat } },
            select: { no_hp: true },
        });
        const hp = String(guru?.no_hp ?? '').trim();
        // Pastikan nomor memuat digit yang cukup (minimal 8 angka)
        if (hp && hp.replace(/\D/g, '').length >= 8) {
            return hp;
        }
        return null;
    } catch (e: any) {
        console.error('[WA guru-asuh] Gagal membaca no_hp untuk NIP', nip, ':', e?.message);
        return null;
    }
}

/**
 * Mengambil nama guru pengaju laporan.
 */
export async function resolveNamaGuru(nip?: string | null, fallback?: string): Promise<string> {
    const bersihFallback = String(fallback ?? '').trim();
    if (bersihFallback && bersihFallback !== 'Guru Asuh') return bersihFallback;
    const asli = String(nip ?? '').trim();
    if (!asli) return bersihFallback || 'Guru Asuh';

    const kandidat = [...new Set([asli, asli.padStart(10, '0'), asli.replace(/^0+/, '')])].filter(Boolean);
    try {
        const guru = await prisma.master_guru.findFirst({
            where: { nip: { in: kandidat } },
            select: { nama_lengkap: true },
        });
        if (guru?.nama_lengkap) return guru.nama_lengkap;

        const user = await prisma.public_users.findFirst({
            where: { nip: { in: kandidat } },
            select: { nama_lengkap: true, nama: true },
        });
        return user?.nama_lengkap || user?.nama || bersihFallback || asli || 'Guru Asuh';
    } catch {
        return bersihFallback || asli || 'Guru Asuh';
    }
}

export interface ApproverInfo {
    nip: string;
    nama: string;
    noHp: string | null;
}

/**
 * Ambil daftar approver yang berwenang meninjau laporan guru asuh.
 *
 * Mengacu pada pengaturan site_settings `guru_asuh_approval_access_config`:
 * - Pengguna yang ditunjuk langsung di `allowedUsers` (berdasarkan nip atau id)
 * - Pengguna yang memiliki role di `allowedRoles` (atau default bawaan: `WKM_KEASRAMAAN`)
 */
export async function getApproversGuruAsuh(): Promise<ApproverInfo[]> {
    try {
        const row = await prisma.site_settings.findUnique({
            where: { key: 'guru_asuh_approval_access_config' },
            select: { value: true },
        });

        let allowedRoles: string[] = ['WKM_KEASRAMAAN'];
        let allowedUsers: Array<{ id?: string; nip?: string; nama?: string }> = [];

        if (row?.value) {
            try {
                const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                if (Array.isArray(parsed?.allowedRoles) && parsed.allowedRoles.length > 0) {
                    allowedRoles = parsed.allowedRoles.map((r: any) => String(r).trim().toUpperCase());
                }
                if (Array.isArray(parsed?.allowedUsers)) {
                    allowedUsers = parsed.allowedUsers;
                }
            } catch (err: any) {
                console.error('[WA guru-asuh] Gagal parse guru_asuh_approval_access_config:', err?.message);
            }
        }

        // 1. Kumpulkan NIP dan ID dari allowedUsers
        const nips: Set<string> = new Set();
        const userIdsToLookup: bigint[] = [];

        for (const u of allowedUsers) {
            if (u.nip && String(u.nip).trim()) {
                nips.add(String(u.nip).trim());
            } else if (u.id) {
                try {
                    userIdsToLookup.push(BigInt(u.id));
                } catch {}
            }
        }

        if (userIdsToLookup.length > 0) {
            const foundUsers = await prisma.public_users.findMany({
                where: { id: { in: userIdsToLookup }, nip: { not: null } },
                select: { nip: true },
            });
            for (const fu of foundUsers) {
                if (fu.nip) nips.add(fu.nip);
            }
        }

        // 2. Kumpulkan dari allowedRoles (filter role murni ADMIN umum agar tidak spam ke technical admin)
        const relevantRoles = allowedRoles.filter(r => r && !['ADMIN', 'ADMINISTRATOR'].includes(r));
        if (relevantRoles.length > 0) {
            const roleUsers = await prisma.public_users.findMany({
                where: { nip: { not: null }, aktif: true },
                select: { nip: true, role: true },
            });

            for (const ru of roleUsers) {
                if (!ru.nip) continue;
                const userRoles = String(ru.role || '')
                    .split(/[,|]/)
                    .map(r => r.trim().toUpperCase());
                if (relevantRoles.some(role => userRoles.includes(role))) {
                    nips.add(ru.nip);
                }
            }
        }

        // 3. Untuk setiap NIP unik, ambil nama dan nomor HP
        const approvers: ApproverInfo[] = [];
        for (const nip of nips) {
            const hp = await nomorHpGuru(nip);
            const nama = await resolveNamaGuru(nip);
            approvers.push({ nip, nama, noHp: hp });
        }

        return approvers;
    } catch (e: any) {
        console.error('[WA guru-asuh] Gagal mengambil daftar approver:', e?.message);
        return [];
    }
}

/**
 * Mode pengujian (dry-run & test-target), dibaca dari site_settings.
 */
interface ModeUji {
    dryRun: boolean;
    testTarget: string;
}

async function bacaModeUji(): Promise<ModeUji> {
    try {
        const rows = await prisma.site_settings.findMany({
            where: {
                key: {
                    in: [
                        'wa_guru_asuh_dry_run',
                        'wa_guru_asuh_test_target',
                        'wa_jadwal_dry_run',
                        'wa_jadwal_test_target',
                    ],
                },
            },
            select: { key: true, value: true },
        });
        const map = Object.fromEntries(rows.map(r => [r.key, String(r.value ?? '').trim()]));
        return {
            dryRun: map['wa_guru_asuh_dry_run'] === 'true' || map['wa_jadwal_dry_run'] === 'true',
            testTarget: map['wa_guru_asuh_test_target'] || map['wa_jadwal_test_target'] || '',
        };
    } catch (e: any) {
        console.error('[WA guru-asuh] Gagal membaca mode uji:', e?.message);
        return { dryRun: false, testTarget: '' };
    }
}

/**
 * Format tanggal dalam bahasa Indonesia (WITA / Asia/Makassar).
 */
function formatTanggalIndo(dateInput?: string | Date | null): string {
    const d = dateInput ? new Date(dateInput) : new Date();
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Makassar',
    });
}

/**
 * Susun pesan notifikasi pengajuan laporan guru asuh secara mendetail beserta variabel penggantinya.
 */
export async function susunPesanGuruAsuhDetail(submission: any, bodyExtra?: any) {
    const userCaller = bodyExtra?.userCaller;
    const nip = String(
        submission?.nip ||
        bodyExtra?.nip ||
        userCaller?.nip ||
        ''
    ).trim();

    const fallbackNama =
        userCaller?.nama_lengkap ||
        userCaller?.nama ||
        submission?.nama_guru_snap ||
        bodyExtra?.nama_guru ||
        bodyExtra?.nama_pengaju ||
        bodyExtra?.nama;

    const namaGuru = await resolveNamaGuru(nip, fallbackNama);

    const bulanNum = Number(submission?.bulan || bodyExtra?.bulan || 0);
    const namaBulan = (bulanNum >= 1 && bulanNum <= 12) ? NAMA_BULAN[bulanNum - 1] : String(bulanNum);
    const tahunStr = String(submission?.tahun || bodyExtra?.tahun || new Date().getFullYear());
    const periodeStr = `${namaBulan} ${tahunStr}`;

    const tanggalStr = formatTanggalIndo(submission?.submitted_at || new Date());
    const url = baseUrl();
    const lamanUrl = url ? `${url}${TAUTAN_APPROVAL}` : TAUTAN_APPROVAL;

    const dataParams: Record<string, string> = {
        nama: namaGuru,
        nama_guru: namaGuru,
        nama_pengaju: namaGuru,
        bulan: periodeStr,
        nama_bulan: namaBulan,
        tahun: tahunStr,
        tanggal: tanggalStr,
        laman: lamanUrl,
        url: lamanUrl,
    };

    // Cek apakah ada custom template tersimpan di site_settings
    let template: string | null = null;
    try {
        const row = await prisma.site_settings.findUnique({
            where: { key: 'wa_template_guru_asuh' },
            select: { value: true },
        });
        if (row?.value && row.value.trim()) {
            template = row.value.trim();
        }
    } catch {}

    let pesan: string;
    if (template) {
        pesan = template
            .replace(/\{\{nama\}\}/gi, namaGuru)
            .replace(/\{\{nama_guru\}\}/gi, namaGuru)
            .replace(/\{\{nama_pengaju\}\}/gi, namaGuru)
            .replace(/\{\{bulan\}\}/gi, periodeStr)
            .replace(/\{\{nama_bulan\}\}/gi, namaBulan)
            .replace(/\{\{tahun\}\}/gi, tahunStr)
            .replace(/\{\{tanggal\}\}/gi, tanggalStr)
            .replace(/\{\{laman\}\}/gi, lamanUrl)
            .replace(/\{\{url\}\}/gi, lamanUrl);
    } else {
        // Pesan baku sesuai instruksi:
        // "{nama} telah mengajukan laporan guru asuh periode {bulan} pada tanggal ..... , silakan akses {laman} untuk meninjau ajuan."
        pesan = `${namaGuru} telah mengajukan laporan guru asuh periode ${periodeStr} pada tanggal ${tanggalStr}, silakan akses ${lamanUrl} untuk meninjau ajuan.`;
    }

    return { pesan, dataParams, namaGuru };
}

/**
 * Susun pesan notifikasi pengajuan laporan guru asuh.
 */
export async function susunPesanGuruAsuh(submission: any, bodyExtra?: any): Promise<string> {
    const detail = await susunPesanGuruAsuhDetail(submission, bodyExtra);
    return detail.pesan;
}

/**
 * Kirim notifikasi WA ke nomor pengguna yang ditunjuk sebagai approval laporan guru asuh.
 * Hanya dikirim jika nomor WA tersedia ("jika nomor WA tersedia").
 */
export async function notifGuruAsuhWa(
    peristiwa: 'diajukan',
    submission: any,
    bodyExtra?: any
): Promise<void> {
    try {
        if (!submission) return;

        const isEnabled = await isWAToggleEnabled('notif_wa_guru_asuh');
        if (!isEnabled) {
            console.info('[WA guru-asuh] Toggle notif_wa_guru_asuh nonaktif, notifikasi dilewati.');
            return;
        }

        const mode = await bacaModeUji();
        const { pesan, dataParams } = await susunPesanGuruAsuhDetail(submission, bodyExtra);
        const approvers = await getApproversGuruAsuh();

        if (approvers.length === 0) {
            console.warn('[WA guru-asuh] Tidak ada approver yang ditemukan untuk Guru Asuh.');
            return;
        }

        for (const approver of approvers) {
            if (!approver.noHp) {
                console.warn(
                    `[WA guru-asuh] Nomor WA untuk approver ${approver.nama} (NIP: ${approver.nip}) tidak tersedia, dilewati.`
                );
                continue;
            }

            let teks = pesan;
            let tujuan = approver.noHp;

            if (mode.testTarget) {
                teks = `🧪 *UJI COBA NOTIFIKASI GURU ASUH*\n_Aslinya untuk ${approver.nama} (${approver.noHp})_\n\n────────\n\n${teks}`;
                tujuan = mode.testTarget;
            }

            if (mode.dryRun) {
                console.info(`[WA guru-asuh][DRY-RUN] → ${approver.nama} (${tujuan}):\n${teks}\n`);
                continue;
            }

            try {
                const hasil = await sendWhatsApp(teks, 'guru_asuh', dataParams, tujuan);
                if (hasil.ok) {
                    console.info(`[WA guru-asuh] Notifikasi berhasil dikirim ke ${approver.nama} (${tujuan})`);
                } else {
                    console.warn(`[WA guru-asuh] Gagal mengirim ke ${approver.nama} (${tujuan}):`, hasil.error);
                }
            } catch (err: any) {
                console.error(`[WA guru-asuh] Error saat mengirim ke ${approver.nama} (${tujuan}):`, err?.message);
            }
        }
    } catch (e: any) {
        console.error('[WA guru-asuh] Error dalam proses notifikasi:', e?.message || e);
    }
}

/**
 * Pratinjau pesan dan daftar penerima (tanpa mengirim apa pun).
 */
export async function pratinjauGuruAsuhWa(submission: any, bodyExtra?: any) {
    const pesan = await susunPesanGuruAsuh(submission, bodyExtra);
    const approvers = await getApproversGuruAsuh();
    return {
        pesan,
        approvers: approvers.map(a => ({
            nip: a.nip,
            nama: a.nama,
            noHp: a.noHp,
            statusHp: a.noHp ? 'Tersedia' : 'Tidak tersedia',
        })),
    };
}
