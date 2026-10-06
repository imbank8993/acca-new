import { prisma } from './prisma'
import { getCurrentDateInTz } from './timezone-server'
import { ASRAMA_STATUS, idRekomendasiDiLuarStatus } from './antrean-asrama'
import { can } from './capabilities'

function normNip(val: any): string {
    return String(val || '').replace(/\s+/g, '').trim()
}

export interface BadgeUser {
    nip: string
    roles: string[]
    caps?: string[]
    authId?: string

    userId?: number | null
    officerRoles?: string[]
    divisionIds?: string[]
}

interface QueueDef {
    key: string
    menuId: string
    tables: string[]
    audience: (u: BadgeUser) => boolean
    count: (u: BadgeUser) => Promise<number>
}

const has = (u: BadgeUser, ...roles: string[]) => roles.some(r => u.roles.includes(r))
const isAdmin = (u: BadgeUser) => has(u, 'ADMIN', 'ADMINISTRATOR')
const jabatan = (u: BadgeUser, role: string) => (u.officerRoles || []).includes(role)

async function resolveUserId(u: BadgeUser): Promise<number | null> {
    if (u.authId) {
        const data = await prisma.public_users.findFirst({
            where: { auth_id: u.authId },
            select: { id: true }
        })
        if (data?.id) return Number(data.id)
    }
    if (u.nip) {
        const data = await prisma.public_users.findFirst({
            where: { nip: u.nip },
            select: { id: true }
        })
        if (data?.id) return Number(data.id)
    }
    return null
}

async function lengkapiUser(u: BadgeUser): Promise<BadgeUser> {
    const userId = await resolveUserId(u)
    if (!userId) return { ...u, userId: null, officerRoles: [], divisionIds: [] }

    try {
        const officers = await prisma.financial_officers.findMany({
            where: { user_id: BigInt(userId) },
            select: { role_type: true, division_id: true }
        })

        return {
            ...u,
            userId,
            officerRoles: officers.map((o) => o.role_type),
            divisionIds: officers
                .filter((o) => o.role_type === 'Kepala Divisi' && o.division_id)
                .map((o) => o.division_id!)
        }
    } catch (err: any) {
        console.error('[sidebar-badges] gagal membaca jabatan keuangan:', err?.message)
        return { ...u, userId, officerRoles: [], divisionIds: [] }
    }
}

async function tahunAjaranAktif(): Promise<string[]> {
    try {
        const data = await prisma.master_tahun_ajaran.findMany({
            where: { is_active: true },
            select: { tahun_ajaran: true }
        })
        return Array.from(new Set(data.map((r) => r.tahun_ajaran).filter(Boolean)))
    } catch (err: any) {
        console.error('[sidebar-badges] gagal membaca tahun ajaran aktif:', err?.message)
        return []
    }
}

export const ANTREAN_BERPENANDA = ['nilai-siswa', 'prestasi-hasil'] as const
export type AntreanBerpenanda = typeof ANTREAN_BERPENANDA[number]

async function penandaDilihat(userId: number, key: string): Promise<string | null> {
    try {
        const data = await prisma.sidebar_badge_reads.findUnique({
            where: {
                user_id_queue_key: {
                    user_id: BigInt(userId),
                    queue_key: key
                }
            },
            select: { last_seen_at: true }
        })

        if (data?.last_seen_at) return data.last_seen_at.toISOString()

        const sekarang = new Date()
        await prisma.sidebar_badge_reads.upsert({
            where: {
                user_id_queue_key: {
                    user_id: BigInt(userId),
                    queue_key: key
                }
            },
            create: { user_id: BigInt(userId), queue_key: key, last_seen_at: sekarang },
            update: { last_seen_at: sekarang }
        })
        return sekarang.toISOString()
    } catch (err: any) {
        console.error(`[sidebar-badges] penanda ${key} tidak terbaca/gagal:`, err?.message)
        return null
    }
}

export async function tandaiDilihat(u: BadgeUser, key: AntreanBerpenanda): Promise<boolean> {
    const userId = await resolveUserId(u)
    if (!userId) return false

    try {
        const sekarang = new Date()
        await prisma.sidebar_badge_reads.upsert({
            where: {
                user_id_queue_key: {
                    user_id: BigInt(userId),
                    queue_key: key
                }
            },
            create: { user_id: BigInt(userId), queue_key: key, last_seen_at: sekarang },
            update: { last_seen_at: sekarang }
        })
        return true
    } catch (err: any) {
        console.error(`[sidebar-badges] gagal menandai ${key} dilihat:`, err?.message)
        return false
    }
}

function kandidatNisn(nisn: string | null | undefined): string[] {
    const raw = String(nisn ?? '').trim()
    if (!raw) return []
    const tanpaNol = raw.replace(/^0+/, '')
    return [...new Set([raw, tanpaNol, tanpaNol.padStart(10, '0')])].filter(Boolean)
}

async function kelasSiswaAktif(nisn: string, ta: string[]): Promise<string[]> {
    const kandidat = kandidatNisn(nisn)
    if (kandidat.length === 0) return []

    try {
        const data = await prisma.siswa_kelas.findMany({
            where: {
                nisn: { in: kandidat },
                aktif: true,
                ...(ta.length > 0 ? { tahun_ajaran: { in: ta } } : {})
            },
            select: { kelas: true }
        })
        return Array.from(new Set(data.map((r) => r.kelas).filter(Boolean) as string[]))
    } catch (err: any) {
        console.error('[sidebar-badges] gagal membaca kelas siswa:', err?.message)
        return []
    }
}

async function kelasWaliAktif(nip: string): Promise<string[]> {
    try {
        const data = await prisma.wali_kelas.findMany({
            where: { nip, aktif: true },
            select: { nama_kelas: true }
        })
        return Array.from(new Set(data.map((r) => r.nama_kelas).filter(Boolean)))
    } catch (err: any) {
        console.error('[sidebar-badges] gagal membaca kelas wali:', err?.message)
        return []
    }
}

const JENIS_KAMAD = ['izin', 'sakit']
const ASRAMA_QUEUE_HARI = 90

const ANTREAN: QueueDef[] = [
    {
        key: 'tukar-jadwal-guru',
        menuId: 'jadwal',
        tables: ['tukar_jadwal_request'],
        audience: u => !!u.nip,
        count: async u => {
            const kandidat = [...new Set([String(u.nip ?? '').trim(), normNip(u.nip)])].filter(Boolean)
            if (kandidat.length === 0) return 0
            return prisma.tukar_jadwal_request.count({
                where: { status: 'menunggu_guru', target_nip: { in: kandidat } }
            })
        },
    },
    {
        key: 'tukar-jadwal-wkm',
        menuId: 'jadwal',
        tables: ['tukar_jadwal_request'],
        // Samakan dengan PENINJAU_TUKAR di apps/api/src/jadwal/jadwal.service.ts —
        // kalau daftarnya berbeda, ada peninjau yang melihat blok "Persetujuan
        // Akademik" di halaman tapi tidak pernah dapat badge pemberitahuannya.
        audience: u => isAdmin(u) || has(u, 'WKM_AKADEMIK', 'KURIKULUM'),
        count: () => prisma.tukar_jadwal_request.count({ where: { status: 'menunggu_wkm' } }),
    },
    {
        key: 'jurnal-banding',
        menuId: 'jurnal',
        tables: ['jurnal_banding'],
        audience: u => isAdmin(u) || has(u, 'OP_JURNAL'),
        count: () => prisma.jurnal_banding.count({ where: { status: 'PENDING' } }),
    },
    {
        key: 'klinik-kesediaan-guru',
        menuId: 'klinik',
        tables: ['klinik_slots'],
        audience: u => !!u.userId,
        count: u => prisma.klinik_slots.count({
            where: { status: 'pending_guru', guru_id: BigInt(u.userId!) }
        }),
    },
    {
        key: 'klinik-sesi-aktif-guru',
        menuId: 'klinik',
        tables: ['klinik_slots'],
        audience: u => !!u.userId,
        count: u => prisma.klinik_slots.count({
            where: {
                guru_id: BigInt(u.userId!),
                status: { in: ['open', 'full'] },
            },
        }),
    },
    {
        key: 'klinik-laporan-revisi-guru',
        menuId: 'klinik',
        tables: ['klinik_laporan'],
        audience: u => !!u.userId,
        count: u => prisma.klinik_laporan.count({
            where: {
                guru_id: BigInt(u.userId!),
                status: 'Revisi',
            },
        }),
    },
    {
        key: 'klinik-review-sesi',
        menuId: 'klinik',
        tables: ['klinik_slots'],
        audience: u => can(u, 'klinik.approve_slot'),
        count: () => prisma.klinik_slots.count({ where: { status: 'pending' } }),
    },
    {
        key: 'klinik-review-laporan',
        menuId: 'klinik',
        tables: ['klinik_laporan'],
        audience: u => can(u, 'klinik.approve_laporan'),
        count: () => prisma.klinik_laporan.count({ where: { status: 'Submitted' } }),
    },
    {
        key: 'izin-guru-dinas-luar',
        menuId: 'izin-guru',
        tables: ['izin_guru'],
        audience: u => isAdmin(u) || has(u, 'OP_IZINGURU'),
        count: () => prisma.izin_guru.count({
            where: { status: 'pending', NOT: { jenis: { in: JENIS_KAMAD } } }
        }),
    },
    {
        key: 'izin-guru-kamad',
        menuId: 'izin-guru',
        tables: ['izin_guru'],
        audience: u => isAdmin(u) || has(u, 'OP_IZINGURU', 'KAMAD'),
        count: () => prisma.izin_guru.count({
            where: { status: 'pending', jenis: { in: JENIS_KAMAD } }
        }),
    },
    {
        key: 'ketidakhadiran-keluar-asrama',
        menuId: 'ketidakhadiran',
        tables: ['ketidakhadiran', 'acca_letters'],
        audience: u => isAdmin(u) || has(u, 'OP_IZIN'),
        count: async () => {
            const sejak = new Date(Date.now() - ASRAMA_QUEUE_HARI * 86_400_000)
            const idRekom = await idRekomendasiDiLuarStatus()

            const baris = await prisma.ketidakhadiran.findMany({
                where: {
                    aktif: true,
                    jenis: 'SAKIT',
                    tgl_mulai: { gte: sejak },
                    OR: [
                        { status: { in: ASRAMA_STATUS } },
                        ...(idRekom.length > 0 ? [{ id: { in: idRekom } }] : [])
                    ]
                },
                select: { id: true, nisn: true, tgl_mulai: true, tgl_selesai: true },
                take: 1000
            })
            if (!baris || baris.length === 0) return 0

            const ids = baris.map((r) => r.id)

            const rekomData = await prisma.acca_letters.findMany({
                where: {
                    jenis_izin: 'REKOMENDASI_KONTROL',
                    ketidakhadiran_id: { in: ids }
                },
                select: { ketidakhadiran_id: true }
            })
            const sudahRekom = new Set(rekomData.map((l) => l.ketidakhadiran_id).filter(Boolean))
            if (sudahRekom.size === 0) return 0

            const izinData = await prisma.acca_letters.findMany({
                where: {
                    jenis_izin: 'MENINGGALKAN_ASRAMA',
                    tgl_mulai: { gte: sejak.toISOString().slice(0, 10) }
                },
                select: { ketidakhadiran_id: true, tgl_mulai: true, tgl_selesai: true, siswa_nisn: true }
            })

            const getTime = (d: any) => d ? (d instanceof Date ? d.getTime() : new Date(d).getTime()) : 0
            const sudahTerbit = (r: any) => izinData.some((l: any) =>
                l.ketidakhadiran_id === r.id ||
                (getTime(l.tgl_mulai) === getTime(r.tgl_mulai) &&
                 getTime(l.tgl_selesai) === getTime(r.tgl_selesai) &&
                 (l.siswa_nisn || '').split(',').map((s: string) => s.trim()).includes(r.nisn))
            )

            return baris.filter((r) => sudahRekom.has(r.id) && !sudahTerbit(r)).length
        },
    },
    {
        key: 'guru-asuh-approval',
        menuId: 'guru-asuh',
        tables: ['laporan_guru_asuh_submissions'],
        audience: u => isAdmin(u) || has(u, 'WKM_KEASRAMAAN'),
        count: () => prisma.laporan_guru_asuh_submissions.count({ where: { status: 'Submitted' } }),
    },
    {
        key: 'catatan-siswa-bk',
        menuId: 'bimbingan-konseling',
        tables: ['catatan_siswa'],
        audience: u => isAdmin(u) || has(u, 'BK'),
        count: async () => {
            const ta = await tahunAjaranAktif()
            return prisma.catatan_siswa.count({
                where: {
                    status: 'BARU',
                    ...(ta.length > 0 ? { tahun_ajaran: { in: ta } } : {})
                }
            })
        },
    },
    {
        key: 'wali-kelas-catatan',
        menuId: 'wali-kelas',
        tables: ['catatan_siswa'],
        audience: u => has(u, 'WALI_KELAS'),
        count: async u => {
            const kelas = await kelasWaliAktif(u.nip)
            if (kelas.length === 0) return 0
            const ta = await tahunAjaranAktif()
            return prisma.catatan_siswa.count({
                where: {
                    status: 'BARU',
                    kelas: { in: kelas },
                    ...(ta.length > 0 ? { tahun_ajaran: { in: ta } } : {})
                }
            })
        },
    },
    {
        key: 'tugas-siswa',
        menuId: 'tugas-siswa',
        tables: ['tugas_siswa', 'tugas_siswa_checklist'],
        audience: u => has(u, 'SISWA') && !!u.userId,
        count: async u => {
            const ta = await tahunAjaranAktif()
            const kelas = await kelasSiswaAktif(u.nip, ta)
            if (kelas.length === 0) return 0

            const tugas = await prisma.tugas_siswa.findMany({
                where: {
                    ...(ta.length > 0 ? { tahun_ajaran: { in: ta } } : {})
                },
                select: { id: true, tanggal_mulai: true, tanggal_selesai: true, kelas_list: true },
                take: 1000
            })

            const today = await getCurrentDateInTz()
            const dateToday = new Date(today)
            const filteredTugas = tugas.filter((t) => {
                const kList = Array.isArray(t.kelas_list) ? (t.kelas_list as string[]) : []
                const hasKelas = kelas.some(k => kList.includes(k))
                if (!hasKelas) return false
                const deadline = t.tanggal_selesai || t.tanggal_mulai
                return deadline ? deadline >= dateToday : true
            })
            if (filteredTugas.length === 0) return 0

            const selesai = await prisma.tugas_siswa_checklist.findMany({
                where: {
                    siswa_id: BigInt(u.userId!),
                    is_done: true
                },
                select: { tugas_id: true }
            })
            const sudah = new Set(selesai.map((r) => r.tugas_id))

            return filteredTugas.filter((t) => !sudah.has(t.id)).length
        },
    },
    {
        key: 'prestasi-validasi',
        menuId: 'prestasi',
        tables: ['prestasi_lomba'],
        audience: u => isAdmin(u) || has(u, 'OP_LOMBA', 'WKM_KESISWAAN'),
        count: () => prisma.prestasi_lomba.count({ where: { status_validasi: 'Menunggu' } }),
    },
    {
        key: 'prestasi-hasil',
        menuId: 'prestasi',
        tables: ['prestasi_lomba'],
        audience: u => has(u, 'SISWA') && !!u.userId,
        count: async u => {
            const kandidat = kandidatNisn(u.nip)
            if (kandidat.length === 0) return 0
            const sejak = await penandaDilihat(u.userId!, 'prestasi-hasil')
            if (!sejak) return 0
            return prisma.prestasi_lomba.count({
                where: {
                    nisn: { in: kandidat },
                    status_validasi: { in: ['Disetujui', 'Ditolak'] },
                    validated_at: { gt: new Date(sejak) }
                }
            })
        },
    },
    {
        key: 'nilai-siswa',
        menuId: 'nilai-siswa',
        tables: ['nilai_data'],
        audience: u => has(u, 'SISWA') && !!u.userId,
        count: async u => {
            const kandidat = kandidatNisn(u.nip)
            if (kandidat.length === 0) return 0
            const sejak = await penandaDilihat(u.userId!, 'nilai-siswa')
            if (!sejak) return 0
            return prisma.nilai_data.count({
                where: {
                    nisn: { in: kandidat },
                    updated_at: { gt: new Date(sejak) }
                }
            })
        },
    },
    {
        key: 'keuangan-ktu',
        menuId: 'keuangan',
        tables: ['budget_requests'],
        audience: u => jabatan(u, 'KTU'),
        count: () => prisma.budget_requests.count({
            where: {
                OR: [
                    { status: 'Menunggu KTU' },
                    { report_status: 'Menunggu KTU' }
                ]
            }
        }),
    },
    {
        key: 'keuangan-kepala-divisi',
        menuId: 'keuangan',
        tables: ['budget_requests'],
        audience: u => jabatan(u, 'Kepala Divisi') && (u.divisionIds || []).length > 0,
        count: u => prisma.budget_requests.count({
            where: {
                division_id: { in: u.divisionIds || [] },
                OR: [
                    { status: 'Menunggu Divisi' },
                    { report_status: 'Menunggu Divisi' }
                ]
            }
        }),
    },
    {
        key: 'keuangan-ppk',
        menuId: 'keuangan',
        tables: ['budget_requests'],
        audience: u => jabatan(u, 'PPK'),
        count: () => prisma.budget_requests.count({
            where: {
                OR: [
                    { status: 'Menunggu PPK' },
                    { report_status: 'Menunggu PPK' }
                ]
            }
        }),
    },
    {
        key: 'keuangan-bendahara',
        menuId: 'keuangan',
        tables: ['budget_requests'],
        audience: u => jabatan(u, 'Bendahara'),
        count: () => prisma.budget_requests.count({
            where: {
                status: { in: ['Antrean Pencairan', 'Dicairkan Sebagian'] }
            }
        }),
    },
    {
        key: 'keuangan-pj',
        menuId: 'keuangan',
        tables: ['budget_requests'],
        audience: u => !!u.userId,
        count: u => prisma.budget_requests.count({
            where: {
                pj_user_id: BigInt(u.userId!),
                status: { in: ['Menunggu Konfirmasi PJ', 'Menunggu Laporan PJ', 'Revisi PJ'] }
            }
        }),
    },
    {
        key: 'kokurikuler-verifikasi',
        menuId: 'kokurikuler',
        tables: ['log_kokurikuler_siswa'],
        audience: u => isAdmin(u) || has(u, 'KAMAD'),
        count: () => prisma.log_kokurikuler_siswa.count({ where: { status: 'Pending' } }),
    },
]

export function watchedTablesFor(user: BadgeUser): string[] {
    const tables = new Set<string>()
    for (const q of ANTREAN) {
        if (q.audience(user)) q.tables.forEach(t => tables.add(t))
    }
    return Array.from(tables)
}

export interface SidebarBadges {
    counts: Record<string, number>
    detail: Record<string, number>
    tables: string[]
}

export async function computeSidebarBadges(pemanggil: BadgeUser): Promise<SidebarBadges> {
    const user = await lengkapiUser(pemanggil)
    const relevan = ANTREAN.filter(q => q.audience(user))

    const hasil = await Promise.all(
        relevan.map(async q => {
            try {
                return { q, n: await q.count(user) }
            } catch (err: any) {
                console.error(`[sidebar-badges] antrean ${q.key} error:`, err?.message || err)
                return { q, n: 0 }
            }
        })
    )

    const counts: Record<string, number> = {}
    const detail: Record<string, number> = {}

    for (const { q, n } of hasil) {
        detail[q.key] = n
        if (n > 0) counts[q.menuId] = (counts[q.menuId] || 0) + n
    }

    return { counts, detail, tables: watchedTablesFor(user) }
}
