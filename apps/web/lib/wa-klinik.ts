/**
 * Pemberitahuan WhatsApp untuk seluruh alur approval pada modul Klinik Pembelajaran:
 *
 * 1. `siswa_ajukan_sesi`       → Siswa mengajukan sesi klinik kelompok ke guru pengampu yang ditunjuk.
 *                                Notifikasi WA dikirim ke nomor Guru Pengampu.
 * 2. `guru_terima_sesi_siswa`  → Guru menyetujui sesi siswa (pending_guru -> pending).
 *                                Notifikasi WA dikirim ke Reviewer/Approver Sesi Klinik (klinik.approve_slot).
 * 3. `guru_ajukan_sesi`        → Guru membuat sesi klinik baru (status: pending).
 *                                Notifikasi WA dikirim ke Reviewer/Approver Sesi Klinik (klinik.approve_slot).
 * 4. `guru_ajukan_laporan`     → Guru memfinalisasi laporan klinik (status: Submitted).
 *                                Notifikasi WA dikirim ke Reviewer/Approver Laporan Klinik (klinik.approve_laporan).
 *
 * Sesuai pola kebutuhan:
 * "{nama} telah mengajukan [sesi/laporan] klinik periode {bulan} pada tanggal {tanggal}, silakan akses {laman} untuk meninjau ajuan."
 *
 * Semua kegagalan ditelan / safe-handled: WA adalah usaha terbaik (best-effort),
 * tidak boleh menggagalkan proses pengajuan yang sudah tersimpan di basis data.
 */

import { prisma } from './prisma';
import { isWAToggleEnabled, sendWhatsApp } from './wa-sender';

const NAMA_BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TAUTAN_APPROVAL = '/klinik?tab=approval';

export type PeristiwaKlinik =
    | 'siswa_ajukan_sesi'
    | 'guru_terima_sesi_siswa'
    | 'guru_ajukan_sesi'
    | 'guru_ajukan_laporan';

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
        if (hp && hp.replace(/\D/g, '').length >= 8) {
            return hp;
        }
        return null;
    } catch (e: any) {
        console.error('[WA klinik] Gagal membaca no_hp untuk NIP', nip, ':', e?.message);
        return null;
    }
}

/**
 * Mengambil nama guru pengampu klinik.
 */
export async function resolveNamaGuru(nipOrId?: string | bigint | null, fallback?: string): Promise<string> {
    const bersihFallback = String(fallback ?? '').trim();
    if (bersihFallback && !['Guru Pembimbing Klinik', 'Guru Pengampu', 'Guru'].includes(bersihFallback)) {
        return bersihFallback;
    }
    if (!nipOrId) return bersihFallback || 'Guru Pembimbing Klinik';

    try {
        const nipStr = String(nipOrId).trim();
        const kandidat = [...new Set([nipStr, nipStr.padStart(10, '0'), nipStr.replace(/^0+/, '')])].filter(Boolean);

        const guru = await prisma.master_guru.findFirst({
            where: { nip: { in: kandidat } },
            select: { nama_lengkap: true },
        });
        if (guru?.nama_lengkap) return guru.nama_lengkap;

        const userByNip = await prisma.public_users.findFirst({
            where: { nip: { in: kandidat } },
            select: { nama_lengkap: true, nama: true },
        });
        if (userByNip?.nama_lengkap || userByNip?.nama) {
            return userByNip.nama_lengkap || userByNip.nama || nipStr;
        }

        let idBigInt: bigint | null = null;
        try { idBigInt = BigInt(nipStr); } catch {}
        if (idBigInt) {
            const userById = await prisma.public_users.findFirst({
                where: { id: idBigInt },
                select: { nama_lengkap: true, nama: true, nip: true },
            });
            if (userById?.nama_lengkap || userById?.nama) {
                return userById.nama_lengkap || userById.nama || nipStr;
            }
            if (userById?.nip) {
                const kandidatUser = [...new Set([userById.nip, userById.nip.padStart(10, '0'), userById.nip.replace(/^0+/, '')])].filter(Boolean);
                const guru2 = await prisma.master_guru.findFirst({
                    where: { nip: { in: kandidatUser } },
                    select: { nama_lengkap: true },
                });
                if (guru2?.nama_lengkap) return guru2.nama_lengkap;
            }
        }

        return bersihFallback || nipStr || 'Guru Pembimbing Klinik';
    } catch {
        return bersihFallback || 'Guru Pembimbing Klinik';
    }
}

/**
 * Mengambil nama siswa pembuat pengajuan klinik.
 */
export async function resolveNamaSiswa(idOrNisn?: bigint | string | null, fallback?: string): Promise<string> {
    const bersihFallback = String(fallback ?? '').trim();
    if (bersihFallback && bersihFallback !== 'Siswa') return bersihFallback;
    if (!idOrNisn) return bersihFallback || 'Siswa';

    try {
        const idStr = String(idOrNisn).trim();
        let idBigInt: bigint | null = null;
        try { idBigInt = BigInt(idStr); } catch {}

        if (idBigInt) {
            const user = await prisma.public_users.findFirst({
                where: { id: idBigInt },
                select: { nama_lengkap: true, nama: true, nip: true },
            });
            if (user?.nama_lengkap || user?.nama) {
                return user.nama_lengkap || user.nama || 'Siswa';
            }
            if (user?.nip) {
                const siswa = await prisma.master_siswa.findFirst({
                    where: { nisn: user.nip },
                    select: { nama_lengkap: true },
                });
                if (siswa?.nama_lengkap) return siswa.nama_lengkap;
            }
        }

        const siswa = await prisma.master_siswa.findFirst({
            where: { nisn: idStr },
            select: { nama_lengkap: true },
        });
        if (siswa?.nama_lengkap) return siswa.nama_lengkap;

        return bersihFallback || 'Siswa';
    } catch {
        return bersihFallback || 'Siswa';
    }
}

export interface ApproverInfo {
    nip: string;
    nama: string;
    noHp: string | null;
}

/**
 * Ambil data guru yang ditunjuk sebagai approver sesi kelompok dari siswa.
 */
export async function getApproverGuruSesi(guruNipOrId?: string | bigint | null): Promise<ApproverInfo[]> {
    if (!guruNipOrId) return [];
    try {
        const nipStr = String(guruNipOrId);
        let userNip: string | null = null;
        let userName: string = 'Guru Pengampu';

        if (nipStr.length >= 8 && !isNaN(Number(nipStr))) {
            userNip = nipStr;
        } else {
            let idBigInt: bigint | null = null;
            try { idBigInt = BigInt(nipStr); } catch {}
            if (idBigInt) {
                const u = await prisma.public_users.findFirst({
                    where: { id: idBigInt },
                    select: { nip: true, nama: true, nama_lengkap: true },
                });
                userNip = u?.nip || null;
                userName = u?.nama_lengkap || u?.nama || userName;
            }
        }

        if (!userNip) return [];
        const hp = await nomorHpGuru(userNip);
        const nama = await resolveNamaGuru(userNip, userName);
        return [{ nip: userNip, nama, noHp: hp }];
    } catch (e: any) {
        console.error('[WA klinik] Gagal mengambil approver guru sesi:', e?.message);
        return [];
    }
}

/**
 * Helper generic untuk membaca approver berdasarkan capability key (klinik.approve_slot / klinik.approve_laporan).
 */
async function getApproversByCapability(capabilityKey: string, settingKey: string): Promise<ApproverInfo[]> {
    try {
        const nips: Set<string> = new Set();
        const userIdsToLookup: Set<bigint> = new Set();

        // 1. Cek user_capabilities
        try {
            const userCaps = await prisma.user_capabilities.findMany({
                where: { capability_key: capabilityKey, mode: 'grant' },
                select: { user_id: true },
            });
            for (const uc of userCaps) {
                if (uc.user_id) userIdsToLookup.add(uc.user_id);
            }
        } catch (e: any) {
            console.error(`[WA klinik] Gagal query user_capabilities (${capabilityKey}):`, e?.message);
        }

        // 2. Cek role_capabilities
        try {
            const roleCaps = await prisma.role_capabilities.findMany({
                where: { capability_key: capabilityKey },
                select: { role: true },
            });
            const roles = roleCaps.map(rc => String(rc.role || '').toUpperCase()).filter((r: string) => r && !['ADMIN', 'ADMINISTRATOR'].includes(r));
            if (roles.length > 0) {
                const roleUsers = await prisma.public_users.findMany({
                    where: { nip: { not: null }, aktif: true },
                    select: { nip: true, role: true },
                });
                for (const ru of roleUsers) {
                    if (!ru.nip) continue;
                    const uRoles = String(ru.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
                    if (roles.some((r: string) => uRoles.includes(r))) {
                        nips.add(ru.nip);
                    }
                }
            }
        } catch (e: any) {
            console.error(`[WA klinik] Gagal query role_capabilities (${capabilityKey}):`, e?.message);
        }

        // 3. Cek site_settings
        try {
            const settingRow = await prisma.site_settings.findFirst({
                where: { key: { in: [capabilityKey, settingKey] } },
                select: { value: true },
            });
            if (settingRow?.value) {
                const parsed = typeof settingRow.value === 'string' ? JSON.parse(settingRow.value) : settingRow.value;
                if (Array.isArray(parsed?.allowedUsers)) {
                    for (const u of parsed.allowedUsers) {
                        if (u?.nip) nips.add(String(u.nip).trim());
                        else if (u?.id) {
                            try { userIdsToLookup.add(BigInt(u.id)); } catch {}
                        }
                    }
                }
                if (Array.isArray(parsed?.allowedRoles)) {
                    const roles = parsed.allowedRoles.map((r: any) => String(r).trim().toUpperCase()).filter((r: string) => r && !['ADMIN', 'ADMINISTRATOR'].includes(r));
                    if (roles.length > 0) {
                        const rUsers = await prisma.public_users.findMany({
                            where: { nip: { not: null }, aktif: true },
                            select: { nip: true, role: true },
                        });
                        for (const ru of rUsers) {
                            if (!ru.nip) continue;
                            const uRoles = String(ru.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
                            if (roles.some((r: string) => uRoles.includes(r))) {
                                nips.add(ru.nip);
                            }
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error(`[WA klinik] Gagal query site_settings (${settingKey}):`, e?.message);
        }

        // Ambil NIP dari user_id
        if (userIdsToLookup.size > 0) {
            const foundUsers = await prisma.public_users.findMany({
                where: { id: { in: Array.from(userIdsToLookup) }, nip: { not: null }, aktif: true },
                select: { nip: true },
            });
            for (const fu of foundUsers) {
                if (fu.nip) nips.add(fu.nip);
            }
        }

        // 4. Fallback bawaan: WKM_AKADEMIK
        if (nips.size === 0) {
            const wkmUsers = await prisma.public_users.findMany({
                where: { role: { contains: 'WKM_AKADEMIK' }, aktif: true, nip: { not: null } },
                select: { nip: true },
            });
            for (const wu of wkmUsers) {
                if (wu.nip) nips.add(wu.nip);
            }
        }

        // Ambil nama & no HP
        const approvers: ApproverInfo[] = [];
        for (const nip of nips) {
            const hp = await nomorHpGuru(nip);
            const nama = await resolveNamaGuru(nip);
            approvers.push({ nip, nama, noHp: hp });
        }

        return approvers;
    } catch (e: any) {
        console.error(`[WA klinik] Gagal mengambil approver (${capabilityKey}):`, e?.message);
        return [];
    }
}

/**
 * Approver untuk persetujuan Sesi Klinik (pemegang klinik.approve_slot).
 */
export async function getApproversSesiKlinik(): Promise<ApproverInfo[]> {
    return getApproversByCapability('klinik.approve_slot', 'klinik_sesi_approval_access_config');
}

/**
 * Approver untuk persetujuan Laporan Pelaksanaan Klinik (pemegang klinik.approve_laporan).
 */
export async function getApproversLaporanKlinik(): Promise<ApproverInfo[]> {
    return getApproversByCapability('klinik.approve_laporan', 'klinik_approval_access_config');
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
                        'wa_klinik_dry_run',
                        'wa_klinik_test_target',
                        'wa_jadwal_dry_run',
                        'wa_jadwal_test_target',
                    ],
                },
            },
            select: { key: true, value: true },
        });
        const map = Object.fromEntries(rows.map(r => [r.key, String(r.value ?? '').trim()]));
        return {
            dryRun: map['wa_klinik_dry_run'] === 'true' || map['wa_jadwal_dry_run'] === 'true',
            testTarget: map['wa_klinik_test_target'] || map['wa_jadwal_test_target'] || '',
        };
    } catch (e: any) {
        console.error('[WA klinik] Gagal membaca mode uji:', e?.message);
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
 * Susun pesan notifikasi sesuai peristiwa persetujuan klinik beserta variabel pengganti detail.
 */
export async function susunPesanKlinikDetail(
    peristiwa: PeristiwaKlinik,
    slot: any,
    extra?: any
) {
    const userCaller = extra?.userCaller;
    const isGuruCaller = userCaller?.role?.includes('GURU') || userCaller?.nip;

    const fallbackGuru = slot?.nama_guru || (isGuruCaller ? (userCaller?.nama_lengkap || userCaller?.nama) : undefined);
    const namaGuru = await resolveNamaGuru(slot?.guru_id, fallbackGuru);

    const fallbackSiswa = extra?.nama_siswa || (!isGuruCaller ? (userCaller?.nama_lengkap || userCaller?.nama) : undefined);
    const namaSiswa = await resolveNamaSiswa(slot?.initiator_siswa_id, fallbackSiswa);

    // Tentukan siapa yang bertindak sebagai "nama pengaju" untuk placeholder {{nama}}
    const namaPengaju = (peristiwa === 'siswa_ajukan_sesi') ? namaSiswa : namaGuru;

    const tanggalRef = slot?.tanggal ? new Date(slot.tanggal) : new Date();
    const bulanIndex = tanggalRef.getMonth();
    const namaBulan = NAMA_BULAN[bulanIndex] || '';
    const tahunStr = String(tanggalRef.getFullYear());
    const periodeStr = `${namaBulan} ${tahunStr}`;
    const tanggalStr = formatTanggalIndo(tanggalRef);

    const mapelStr = slot?.mapel ? ` ${slot.mapel}` : '';
    const topikStr = slot?.topik ? ` (${slot.topik})` : '';

    const url = baseUrl();
    const lamanUrl = url ? `${url}${TAUTAN_APPROVAL}` : TAUTAN_APPROVAL;

    const dataParams: Record<string, string> = {
        nama: namaPengaju,
        nama_pengaju: namaPengaju,
        nama_guru: namaGuru,
        nama_siswa: namaSiswa,
        bulan: periodeStr,
        nama_bulan: namaBulan,
        tahun: tahunStr,
        tanggal: tanggalStr,
        mapel: slot?.mapel || '',
        topik: slot?.topik || '',
        laman: lamanUrl,
        url: lamanUrl,
    };

    let pesan = '';
    switch (peristiwa) {
        case 'siswa_ajukan_sesi': {
            // Siswa mengajukan sesi kelompok, ditujukan ke guru pengampu
            pesan = `${namaSiswa} telah mengajukan sesi klinik${mapelStr}${topikStr} pada tanggal ${tanggalStr}, silakan akses ${lamanUrl} untuk meninjau ajuan.`;
            break;
        }

        case 'guru_terima_sesi_siswa': {
            // Guru telah bersedia, diajukan ke reviewer sesi
            pesan = `Sesi klinik${mapelStr}${topikStr} dari ${namaSiswa} telah disetujui oleh ${namaGuru} pada tanggal ${tanggalStr}, silakan akses ${lamanUrl} untuk meninjau ajuan.`;
            break;
        }

        case 'guru_ajukan_sesi': {
            // Guru membuat sesi baru, diajukan ke reviewer sesi
            pesan = `${namaGuru} telah mengajukan sesi klinik${mapelStr}${topikStr} periode ${periodeStr} pada tanggal ${tanggalStr}, silakan akses ${lamanUrl} untuk meninjau ajuan.`;
            break;
        }

        case 'guru_ajukan_laporan':
        default: {
            // Guru memfinalisasi laporan klinik, diajukan ke reviewer laporan
            let template: string | null = null;
            try {
                const row = await prisma.site_settings.findUnique({
                    where: { key: 'wa_template_klinik' },
                    select: { value: true },
                });
                if (row?.value && row.value.trim()) template = row.value.trim();
            } catch {}

            if (template) {
                pesan = template
                    .replace(/\{\{nama\}\}/gi, namaGuru)
                    .replace(/\{\{nama_pengaju\}\}/gi, namaGuru)
                    .replace(/\{\{nama_guru\}\}/gi, namaGuru)
                    .replace(/\{\{nama_siswa\}\}/gi, namaSiswa)
                    .replace(/\{\{bulan\}\}/gi, periodeStr)
                    .replace(/\{\{nama_bulan\}\}/gi, namaBulan)
                    .replace(/\{\{tahun\}\}/gi, tahunStr)
                    .replace(/\{\{tanggal\}\}/gi, tanggalStr)
                    .replace(/\{\{mapel\}\}/gi, slot?.mapel || '')
                    .replace(/\{\{topik\}\}/gi, slot?.topik || '')
                    .replace(/\{\{laman\}\}/gi, lamanUrl)
                    .replace(/\{\{url\}\}/gi, lamanUrl);
            } else {
                pesan = `${namaGuru} telah mengajukan laporan klinik periode ${periodeStr} pada tanggal ${tanggalStr}, silakan akses ${lamanUrl} untuk meninjau ajuan.`;
            }
            break;
        }
    }

    return { pesan, dataParams, namaPengaju, namaGuru, namaSiswa };
}

/**
 * Susun pesan notifikasi sesuai peristiwa persetujuan klinik.
 */
export async function susunPesanKlinik(
    peristiwa: PeristiwaKlinik,
    slot: any,
    extra?: any
): Promise<string> {
    const detail = await susunPesanKlinikDetail(peristiwa, slot, extra);
    return detail.pesan;
}

/**
 * Kirim notifikasi WA ke nomor pengguna yang ditunjuk sebagai approval.
 * Hanya dikirim jika nomor WA tersedia ("jika nomor WA tersedia").
 */
export async function notifKlinikWa(
    peristiwa: PeristiwaKlinik,
    slotIdOrData: any,
    extraPayload?: any,
    userCaller?: any
): Promise<void> {
    try {
        if (!slotIdOrData) return;

        const isEnabled = await isWAToggleEnabled('notif_wa_klinik');
        if (!isEnabled) {
            console.info('[WA klinik] Toggle notif_wa_klinik nonaktif, notifikasi dilewati.');
            return;
        }

        let slot: any = null;
        if (typeof slotIdOrData === 'object' && slotIdOrData?.id) {
            slot = slotIdOrData;
        }

        const slotId = typeof slotIdOrData === 'string' ? slotIdOrData : slot?.id;
        if (slotId && (!slot || !slot.nama_guru || !slot.mapel || !slot.tanggal)) {
            const dbSlot = await prisma.klinik_slots.findUnique({
                where: { id: slotId },
                select: {
                    id: true,
                    guru_id: true,
                    nama_guru: true,
                    mapel: true,
                    topik: true,
                    tanggal: true,
                    initiator_type: true,
                    initiator_siswa_id: true,
                    status: true,
                },
            });
            if (dbSlot) {
                slot = { ...slot, ...dbSlot };
            }
        }

        if (!slot) {
            console.warn('[WA klinik] Slot klinik tidak ditemukan untuk notifikasi.');
            return;
        }

        // Tentukan daftar penerima approval sesuai peristiwanya
        let approvers: ApproverInfo[] = [];

        if (peristiwa === 'siswa_ajukan_sesi') {
            // Ditujukan ke guru pengampu yang dipilih siswa
            const targetGuru = slot.guru_id || extraPayload?.guru_nip;
            approvers = await getApproverGuruSesi(targetGuru);
        } else if (peristiwa === 'guru_terima_sesi_siswa' || peristiwa === 'guru_ajukan_sesi') {
            // Ditujukan ke Reviewer Sesi Klinik (klinik.approve_slot)
            approvers = await getApproversSesiKlinik();
        } else if (peristiwa === 'guru_ajukan_laporan') {
            // Ditujukan ke Reviewer Laporan Klinik (klinik.approve_laporan)
            approvers = await getApproversLaporanKlinik();
        }

        if (approvers.length === 0) {
            console.warn(`[WA klinik] Tidak ada approver ditemukan untuk peristiwa ${peristiwa}.`);
            return;
        }

        const mode = await bacaModeUji();
        const { pesan, dataParams } = await susunPesanKlinikDetail(peristiwa, slot, {
            ...extraPayload,
            userCaller,
        });

        for (const approver of approvers) {
            if (!approver.noHp) {
                console.warn(
                    `[WA klinik] Nomor WA untuk approver ${approver.nama} (NIP: ${approver.nip}) tidak tersedia, dilewati.`
                );
                continue;
            }

            let teks = pesan;
            let tujuan = approver.noHp;

            if (mode.testTarget) {
                teks = `🧪 *UJI COBA NOTIFIKASI KLINIK*\n_Aslinya untuk ${approver.nama} (${approver.noHp})_\n\n────────\n\n${teks}`;
                tujuan = mode.testTarget;
            }

            if (mode.dryRun) {
                console.info(`[WA klinik][DRY-RUN] → ${approver.nama} (${tujuan}):\n${teks}\n`);
                continue;
            }

            try {
                const hasil = await sendWhatsApp(teks, 'klinik', dataParams, tujuan);
                if (hasil.ok) {
                    console.info(`[WA klinik] Notifikasi (${peristiwa}) berhasil dikirim ke ${approver.nama} (${tujuan})`);
                } else {
                    console.warn(`[WA klinik] Gagal mengirim ke ${approver.nama} (${tujuan}):`, hasil.error);
                }
            } catch (err: any) {
                console.error(`[WA klinik] Error saat mengirim ke ${approver.nama} (${tujuan}):`, err?.message);
            }
        }
    } catch (e: any) {
        console.error('[WA klinik] Error dalam proses notifikasi:', e?.message || e);
    }
}

/**
 * Pratinjau pesan dan daftar penerima untuk debugging / UI.
 */
export async function pratinjauKlinikWa(peristiwa: PeristiwaKlinik, slotId: string, extraPayload?: any) {
    const slot = await prisma.klinik_slots.findUnique({
        where: { id: slotId },
        select: {
            id: true,
            guru_id: true,
            nama_guru: true,
            mapel: true,
            topik: true,
            tanggal: true,
            initiator_type: true,
            initiator_siswa_id: true,
            status: true,
        },
    });

    let approvers: ApproverInfo[] = [];
    if (peristiwa === 'siswa_ajukan_sesi') {
        approvers = await getApproverGuruSesi(slot?.guru_id || extraPayload?.guru_nip);
    } else if (peristiwa === 'guru_terima_sesi_siswa' || peristiwa === 'guru_ajukan_sesi') {
        approvers = await getApproversSesiKlinik();
    } else {
        approvers = await getApproversLaporanKlinik();
    }

    const pesan = await susunPesanKlinik(peristiwa, slot, extraPayload);
    return {
        peristiwa,
        pesan,
        approvers: approvers.map(a => ({
            nip: a.nip,
            nama: a.nama,
            noHp: a.noHp,
            statusHp: a.noHp ? 'Tersedia' : 'Tidak tersedia',
        })),
    };
}
