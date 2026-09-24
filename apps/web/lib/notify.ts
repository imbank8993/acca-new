import { prisma } from './prisma'

export type NotificationType =
    // Users
    | 'user_baru'
    | 'user_activated'
    | 'user_deactivated'
    | 'user_role_changed'
    | 'user_profile_updated'
    // Nilai
    | 'nilai_updated'
    | 'nilai_tagihan_baru'
    // Jurnal
    | 'jurnal_baru'
    | 'jurnal_deleted'
    | 'jurnal_banding_baru'
    // LCKH
    | 'lckh_submitted'
    | 'lckh_disetujui'
    | 'lckh_ditolak'
    | 'lckh_revisi'
    // Izin Guru
    | 'izin_guru_baru'
    | 'izin_guru_disetujui'
    | 'izin_guru_ditolak'
    | 'izin_guru_status_changed'
    // Ketidakhadiran
    | 'ketidakhadiran_baru'
    | 'ketidakhadiran_approved'
    // Kehadiran Siswa
    | 'kehadiran_siswa_updated'
    // Jadwal
    | 'jadwal_berubah'
    | 'jadwal_import'
    // Piket
    | 'piket_baru'
    | 'piket_input'
    // Master Data
    | 'siswa_baru'
    | 'mapel_baru'
    | 'kelas_baru'
    // Sistem
    | 'maintenance'
    | 'informasi_baru'
    | 'agenda_akademik_baru'
    | 'dokumen_dibagikan'
    | 'folder_dibagikan'
    | 'tagihan_baru'
    | 'survey_pengembangan_diri'
    | 'ujian_madrasah_updated'
    | 'kinerja_guru_updated'
    | 'laporan_guru_asuh_baru'
    // Klinik Pembelajaran
    | 'klinik_request'
    | 'klinik_approved'

export interface NotifyParams {
    type: NotificationType
    title: string
    message?: string
    link?: string
    recipient_role?: string
    recipient_user_id?: string
    source_table?: string
    source_id?: string
    created_by?: string
}

/**
 * Insert a notification into the notifications table.
 * Non-blocking: errors are caught and logged, never thrown.
 */
export async function notify(params: NotifyParams): Promise<void> {
    try {
        await prisma.notifications.create({
            data: {
                type: params.type,
                title: params.title,
                message: params.message ?? null,
                link: params.link ?? null,
                recipient_role: params.recipient_role ?? null,
                recipient_user_id: params.recipient_user_id ?? null,
                source_table: params.source_table ?? null,
                source_id: params.source_id ?? null,
                created_by: params.created_by ?? null,
            }
        })
    } catch (err) {
        console.error('[notify] Failed to insert notification:', err)
    }
}

/**
 * Broadcast to all users with a given role.
 * Convenience wrapper for role-based notifications.
 */
export async function notifyRole(
    role: string,
    params: Omit<NotifyParams, 'recipient_role'>
): Promise<void> {
    await notify({ ...params, recipient_role: role })
}

/**
 * Notify a specific user by their auth/user_id.
 */
export async function notifyUser(
    userId: string,
    params: Omit<NotifyParams, 'recipient_user_id'>
): Promise<void> {
    await notify({ ...params, recipient_user_id: userId })
}