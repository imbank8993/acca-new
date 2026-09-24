/**
 * Pemberitahuan WhatsApp untuk alur tukar jadwal.
 *
 * Melengkapi — bukan menggantikan — notifikasi in-app: baris `notifications`
 * (lonceng) dan badge sidebar/tab tetap dibuat backend seperti biasa. WA
 * dipakai supaya pihak yang ditunggu tindakannya tahu tanpa harus membuka
 * aplikasi lebih dulu, dan pesannya memuat tautan langsung ke tab terkait.
 *
 * Sengaja ditempatkan di sisi Next, bukan NestJS, karena provider yang dipakai
 * madrasah ini didominasi Baileys yang pustakanya hidup di sini (`lib/baileys`).
 *
 * Semua kegagalan ditelan: WA adalah usaha terbaik, tidak boleh menggagalkan
 * pengajuan atau persetujuan yang sudah tersimpan di database.
 */

import { prisma } from './prisma'
import { isWAToggleEnabled, sendWhatsApp } from './wa-sender'

/**
 * Alamat publik aplikasi, untuk tautan yang diketuk dari aplikasi WhatsApp.
 *
 * `NEXT_PUBLIC_BASE_URL` didahulukan karena itulah yang berisi domain publik;
 * `NEXT_PUBLIC_SITE_URL` dan `NEXT_PUBLIC_ACCA_URL` di lingkungan ini justru
 * menunjuk localhost. Alamat localhost/IP privat dibuang supaya nilai
 * pengembangan tidak pernah ikut terkirim sebagai tautan mati ke penerima.
 */
function baseUrl(): string {
    const kandidat = [
        process.env.NEXT_PUBLIC_BASE_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.NEXT_PUBLIC_ACCA_URL,
    ]
    for (const c of kandidat) {
        const url = String(c ?? '').trim().replace(/\/+$/, '')
        if (!url) continue
        if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\/\/192\.168\.|\/\/10\./i.test(url)) continue
        return url
    }
    return ''
}

const TAUTAN_TUKAR = '/jadwal?tab=tukar'

/** Nomor HP guru diambil dari master_guru; NIP bisa tersimpan dengan/ tanpa nol depan. */
async function nomorHpGuru(nip: string | null | undefined): Promise<string | null> {
    const asli = String(nip ?? '').trim()
    if (!asli) return null
    const kandidat = [...new Set([asli, asli.padStart(10, '0'), asli.replace(/^0+/, '')])].filter(Boolean)
    try {
        const guru = await prisma.master_guru.findFirst({
            where: { nip: { in: kandidat } },
            select: { no_hp: true },
        })
        const hp = String(guru?.no_hp ?? '').trim()
        return hp || null
    } catch (e: any) {
        console.error('[WA tukar-jadwal] gagal membaca no_hp:', e?.message)
        return null
    }
}

function ringkasSlot(req: any, sisi: 'requester' | 'target'): string {
    const slots = req?.[`${sisi}_slots`]
    if (Array.isArray(slots) && slots.length > 0) {
        return slots
            .map((s: any) => [`${s.hari} jam ke-${s.jam_ke}`, s.kelas, s.mapel].filter(Boolean).join(' • '))
            .join(', ')
    }
    return [
        `${req?.[`${sisi}_hari`] ?? '-'} jam ke-${req?.[`${sisi}_jam_ke`] ?? '-'}`,
        req?.[`${sisi}_kelas`],
        req?.[`${sisi}_mapel`],
    ].filter(Boolean).join(' • ')
}

/**
 * Mode pengujian, dibaca dari site_settings.
 *
 * Alasannya: begitu toggle dinyalakan, setiap percobaan alur tukar jadwal akan
 * mengirim WhatsApp ke guru sungguhan. Dua sakelar di bawah membuat pengujian
 * bisa dilakukan tanpa mengganggu siapa pun.
 *
 *   wa_jadwal_dry_run     = 'true'  → tidak mengirim apa pun, hanya mencatat
 *                                     pesan lengkap ke log server.
 *   wa_jadwal_test_target = '08xx'  → SEMUA pesan dibelokkan ke satu nomor itu,
 *                                     diberi kepala penanda berisi tujuan asli.
 *
 * Keduanya berlaku global untuk fitur jadwal; kosongkan/hapus barisnya untuk
 * beroperasi normal.
 */
interface ModeUji {
    dryRun: boolean
    testTarget: string
}

async function bacaModeUji(): Promise<ModeUji> {
    try {
        const rows = await prisma.site_settings.findMany({
            where: { key: { in: ['wa_jadwal_dry_run', 'wa_jadwal_test_target'] } },
            select: { key: true, value: true },
        })
        const map = Object.fromEntries(rows.map(r => [r.key, String(r.value ?? '').trim()]))
        return {
            dryRun: map['wa_jadwal_dry_run'] === 'true',
            testTarget: map['wa_jadwal_test_target'] || '',
        }
    } catch (e: any) {
        // Gagal membaca pengaturan = tidak tahu apakah ini uji coba. Pilih yang
        // aman: anggap dry-run, jangan sampai salah kirim ke guru sungguhan.
        console.error('[WA tukar-jadwal] gagal membaca mode uji, dipaksa dry-run:', e?.message)
        return { dryRun: true, testTarget: '' }
    }
}

async function kirim(nip: string | null | undefined, pesan: string, mode: ModeUji): Promise<void> {
    const hp = await nomorHpGuru(nip)
    if (!hp) {
        console.warn(`[WA tukar-jadwal] nomor HP untuk NIP ${nip} tidak ditemukan, dilewati`)
        return
    }

    const url = baseUrl()
    let teks = url ? `${pesan}\n\n🔗 Buka: ${url}${TAUTAN_TUKAR}` : pesan
    let tujuan = hp

    if (mode.testTarget) {
        teks = `🧪 *UJI COBA*\n_Aslinya untuk NIP ${nip} (${hp})_\n\n────────\n\n${teks}`
        tujuan = mode.testTarget
    }

    if (mode.dryRun) {
        console.info(`[WA tukar-jadwal][DRY-RUN] → ${tujuan}\n${teks}\n`)
        return
    }

    const hasil = await sendWhatsApp(teks, 'jadwal', {}, tujuan)
    if (!hasil.ok) console.warn('[WA tukar-jadwal] gagal kirim:', hasil.error)
}

/**
 * Kirim ke banyak penerima sekaligus. Berurutan akan membuat guru menunggu
 * sepanjang akumulasi seluruh pengiriman setelah menekan tombol — persetujuan
 * WKM bisa menyasar 6 orang. `allSettled` supaya satu nomor bermasalah tidak
 * menggagalkan sisanya.
 */
async function kirimBanyak(nips: Array<string | null | undefined>, pesan: string, mode: ModeUji): Promise<void> {
    const unik = [...new Set(nips.map(n => String(n ?? '').trim()).filter(Boolean))]
    await Promise.allSettled(unik.map(nip => kirim(nip, pesan, mode)))
}

export type PeristiwaTukar = 'diajukan' | 'diterima_guru' | 'ditolak_guru' | 'disetujui_wkm' | 'ditolak_wkm' | 'dibatalkan'

/** Satu pesan beserta penerimanya. `peninjau` = semua pemegang peran peninjau. */
interface Instruksi {
    penerima: Array<string | null | undefined> | 'peninjau'
    pesan: string
}

/**
 * Susun pesan untuk satu peristiwa — murni, tanpa efek samping.
 *
 * Dipisahkan dari pengiriman supaya pratinjau memakai jalur penyusunan yang
 * SAMA PERSIS dengan yang benar-benar dikirim; pratinjau yang dibangun terpisah
 * cepat berbeda dari kenyataan begitu salah satunya diubah.
 */
function susunPesan(peristiwa: PeristiwaTukar, req: any): Instruksi[] {
    const jenis = req.jenis === 'piket' ? 'Piket' : 'PBM'
    const pemohon = req.requester_nama || 'Rekan guru'
    const tujuan = req.target_nama || 'Rekan guru'
    const milikPemohon = ringkasSlot(req, 'requester')
    const milikTujuan = ringkasSlot(req, 'target')
    // Dipisah: pada keputusan WKM yang relevan adalah catatan WKM. Sebelumnya
    // keduanya digabung dengan `guru_catatan` lebih dulu, sehingga pesan
    // "Disetujui WKM" menampilkan catatan guru tujuan dan terbaca seolah itu
    // alasan WKM.
    const catatanGuru = req.guru_catatan || ''
    const catatanWkm = req.wkm_catatan || ''
    const imbuhan = (teks: string) => (teks ? `\n\n📝 Catatan: ${teks}` : '')

    switch (peristiwa) {
        case 'diajukan':
            // Bola ada di guru tujuan.
            return [{
                penerima: [req.target_nip],
                pesan:
                    `🔄 *Permintaan Tukar Jadwal ${jenis}*\n\n` +
                    `${pemohon} ingin menukar jadwal dengan Anda.\n\n` +
                    `• Jadwal ${pemohon}: ${milikPemohon}\n` +
                    `• Jadwal Anda: ${milikTujuan}\n` +
                    (req.alasan ? `\n📝 Alasan: ${req.alasan}\n` : '') +
                    `\nMohon ditanggapi (terima / tolak).`,
            }]

        case 'diterima_guru':
            // Bola pindah ke WKM; pemohon cukup diberi kabar.
            return [
                {
                    penerima: [req.requester_nip],
                    pesan:
                        `✅ *Tukar Jadwal Disetujui Guru*\n\n` +
                        `${tujuan} menyetujui pengajuan tukar jadwal ${jenis} Anda.\n` +
                        `Menunggu persetujuan WKM Akademik.`,
                },
                {
                    penerima: 'peninjau',
                    pesan:
                        `📋 *Perlu Persetujuan Akademik*\n\n` +
                        `Tukar jadwal ${jenis} ${pemohon} ↔ ${tujuan} sudah disetujui guru tujuan.\n\n` +
                        `• ${pemohon}: ${milikPemohon}\n` +
                        `• ${tujuan}: ${milikTujuan}\n\n` +
                        `Mohon ditinjau.`,
                },
            ]

        case 'ditolak_guru':
            return [{
                penerima: [req.requester_nip],
                pesan:
                    `❌ *Tukar Jadwal Ditolak*\n\n` +
                    `${tujuan} menolak pengajuan tukar jadwal ${jenis} Anda.` +
                    imbuhan(catatanGuru),
            }]

        case 'disetujui_wkm':
            // Jadwal benar-benar berubah — kedua pihak wajib tahu.
            return [{
                penerima: [req.requester_nip, req.target_nip],
                pesan:
                    `🎉 *Tukar Jadwal Disetujui*\n\n` +
                    `Pertukaran jadwal ${jenis} antara ${pemohon} dan ${tujuan} telah disetujui WKM Akademik ` +
                    `dan jadwal sudah diperbarui.\n\n` +
                    `• ${pemohon}: ${milikPemohon}\n` +
                    `• ${tujuan}: ${milikTujuan}` +
                    imbuhan(catatanWkm),
            }]

        case 'ditolak_wkm':
            return [{
                penerima: [req.requester_nip, req.target_nip],
                pesan:
                    `❌ *Tukar Jadwal Ditolak WKM*\n\n` +
                    `Pengajuan tukar jadwal ${jenis} ${pemohon} ↔ ${tujuan} ditolak WKM Akademik.` +
                    imbuhan(catatanWkm),
            }]

        case 'dibatalkan':
            // Hanya guru tujuan yang perlu tahu; pemohon yang membatalkan.
            return [{
                penerima: [req.target_nip],
                pesan:
                    `🚫 *Pengajuan Tukar Jadwal Dibatalkan*\n\n` +
                    `${pemohon} membatalkan pengajuan tukar jadwal ${jenis} kepada Anda.`,
            }]
    }
}

/**
 * Kirim pemberitahuan untuk satu peristiwa tukar jadwal.
 * `req` adalah objek hasil `formatTukarRequest` dari backend.
 */
export async function notifTukarJadwalWa(peristiwa: PeristiwaTukar, req: any): Promise<void> {
    try {
        if (!req) return
        if (!(await isWAToggleEnabled('notif_wa_jadwal'))) return

        const mode = await bacaModeUji()
        const instruksi = susunPesan(peristiwa, req)

        await Promise.allSettled(instruksi.map(async i => {
            const nips = i.penerima === 'peninjau' ? await nipPeninjau() : i.penerima
            return kirimBanyak(nips, i.pesan, mode)
        }))
    } catch (e: any) {
        console.error('[WA tukar-jadwal] error:', e?.message)
    }
}

/**
 * Pratinjau teks yang AKAN dikirim, tanpa mengirim apa pun dan tanpa menyentuh
 * toggle. Dipakai layar pengaturan untuk memeriksa kata-kata & tautan sebelum
 * fitur dinyalakan.
 */
export async function pratinjauTukarJadwalWa(peristiwa: PeristiwaTukar, req: any) {
    const url = baseUrl()
    const hasil = []
    for (const i of susunPesan(peristiwa, req)) {
        const nips = i.penerima === 'peninjau' ? await nipPeninjau() : i.penerima
        hasil.push({
            penerima: i.penerima === 'peninjau' ? 'Semua peninjau akademik' : nips.filter(Boolean).join(', '),
            teks: url ? `${i.pesan}\n\n🔗 Buka: ${url}${TAUTAN_TUKAR}` : i.pesan,
        })
    }
    return { tautanAktif: !!url, pesan: hasil }
}

/** Peninjau = penerima blok "Persetujuan Akademik"; samakan dengan PENINJAU_TUKAR di backend. */
const PERAN_PENINJAU = ['WKM_AKADEMIK', 'ADMIN', 'ADMINISTRATOR', 'KURIKULUM']

async function nipPeninjau(): Promise<string[]> {
    try {
        const users = await prisma.public_users.findMany({
            where: { nip: { not: null } },
            select: { nip: true, role: true },
        })
        return users
            .filter(u => String(u.role || '')
                .split(/[,|]/)
                .map(r => r.trim().toUpperCase())
                .some(r => PERAN_PENINJAU.includes(r)))
            .map(u => u.nip!)
    } catch (e: any) {
        console.error('[WA tukar-jadwal] gagal membaca daftar peninjau:', e?.message)
        return []
    }
}
