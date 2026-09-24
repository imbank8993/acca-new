// TypeScript types for ACCA application

export interface User {
    id: number;
    auth_id: string | null;
    username: string;
    // `password` sengaja TIDAK ada di sini. Dulu field ini mencerminkan kolom
    // users.password_hash yang berisi teks polos; kolomnya dihapus, dan
    // kredensial tidak pernah dikirim ke klien dalam bentuk apa pun.
    nip: string; // Renamed from guruId
    nisn?: string; // NISN for students
    nama: string;
    nama_lengkap?: string;
    tanggal_lahir?: string; // Date of birth
    email?: string;
    role: string; // Raw role string: "GURU,KAMAD" or "GURU|KAMAD"
    roles: string[]; // Parsed roles: ["GURU", "KAMAD"]
    /**
     * Kapabilitas efektif (fungsi yang boleh dijalankan) — lihat lib/capabilities.ts.
     * `undefined` = belum ter-resolve; `can()` akan memakai paket bawaan registry.
     */
    caps?: string[];
    divisi: string;
    pages: string; // Raw pages string
    pagesArray: string[]; // Parsed pages array
    pagesTree: PageNode[]; // Hierarchical menu structure
    aktif: boolean;
    photoUrl: string | null;
    permissions?: Array<{ resource: string, action: string, is_allowed: boolean }>;
    can_use_dark_mode?: boolean;
    forced_theme?: 'light' | 'dark' | null;
}

export interface PageNode {
    title: string;
    page: string | null; // null if it's a parent with children
    children: PageNode[];
}

export interface AuthResponse {
    ok: boolean;
    error?: string;
    user?: User;
    token?: string;
}

export interface SessionData {
    user: User;
    expiresAt: number;
}

// ============================================
// Absensi Module Types
// ============================================

export interface JadwalGuru {
    id: number;
    nip: string; // Renamed from guru_id
    nama_guru: string;
    hari: string; // Senin, Selasa, Rabu, Kamis, Jumat, Sabtu
    jam_ke: string; // Format: "1", "2-5", "3-4"
    kelas: string;
    mata_pelajaran: string;
    tahun_ajaran: string;
    semester: number; // 1 atau 2
    aktif: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface AbsensiSesi {
    id: number;
    sesi_id: string; // UUID
    jadwal_id?: number | null;
    tanggal: string; // ISO date: "2026-01-21"
    kelas: string;
    mapel: string;
    jam_ke: string; // Range: "2-5"
    nip: string; // Renamed from guru_id
    nama_guru: string; // Snapshot
    status_sesi: 'DRAFT' | 'FINAL';
    draft_type: 'DRAFT_DEFAULT' | 'DRAFT_GURU' | 'FINAL';
    materi?: string;
    catatan?: string;
    refleksi?: string;
    tahun_ajaran: string;
    semester: number;
    guru_pengganti_nip?: string | null;
    guru_pengganti_nama?: string | null;
    /** Mode substitusi manual ('Tukaran' | 'Diganti'); tidak disimpan di DB, hanya diteruskan ke sync jurnal */
    status_kehadiran?: string;
    created_at: string;
    created_by: string;
    updated_at: string;
}

export interface AbsensiDetail {
    id?: number;
    sesi_id: string; // UUID dari AbsensiSesi
    nisn: string; // WAJIB TEXT (leading zero)
    nama_snapshot: string;
    status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';
    otomatis: boolean;
    ref_ketidakhadiran_id?: string | null;
    catatan?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Siswa {
    siswa_id: string;
    nama_siswa: string;
    nisn: string;
    kelas: string;
    aktif: boolean;
}

// ============================================
// Catatan Pembelajaran (Positif/Negatif) Module Types
// ============================================

export interface CatatanSiswa {
    id: string;
    sesi_id?: string | null;
    nisn: string;
    nama_snapshot: string;
    kelas: string;
    tanggal: string;
    jam_ke?: string;
    mapel?: string;
    nip: string;
    nama_guru: string;
    jenis: 'POSITIF' | 'NEGATIF';
    catatan: string;
    status: 'BARU' | 'DITINDAKLANJUTI' | 'SELESAI';
    tahun_ajaran?: string;
    semester?: number;
    created_at: string;
    updated_at: string;
    /** Nested via Supabase select join: .select('*, catatan_siswa_tindak_lanjut(*)') */
    catatan_siswa_tindak_lanjut?: CatatanSiswaTindakLanjut[];
}

export interface CatatanSiswaTindakLanjut {
    id: string;
    catatan_id: string;
    nip: string;
    nama: string;
    catatan: string;
    status_baru: 'DITINDAKLANJUTI' | 'SELESAI';
    created_at: string;
}

// API Response types
export interface ApiResponse<T = any> {
    ok: boolean;
    error?: string;
    data?: T;
    holidays?: any[];
    ketidakhadiran?: any[];
    sessions?: any[];
    allSessions?: any[];
}

export interface MyScopes {
    ok: boolean;
    error?: string;
    guru?: {
        nip: string; // Renamed from guruId
        nama: string;
    };
    kelasList?: string[];
    mapelByKelas?: Record<string, string[]>;
    jamKeByKelasMapel?: Record<string, { jamKe: string; berlaku_mulai: string }[]>;
    schedule?: {
        hari: string;
        jam_ke: string;
        kelas: string;
        mata_pelajaran: string;
        berlaku_mulai?: string;
    }[];
    allJadwal?: {
        hari: string;
        jam_ke: string;
        kelas: string;
        mata_pelajaran: string;
        berlaku_mulai?: string;
    }[];
    masterWaktu?: Record<string, { mulai: string; selesai: string }>;
    masterKelas?: Record<string, string>;
}

// ============================================
// Chat Module Types
// ============================================

export interface ConversationParticipant {
    id: string;
    conversation_id: string;
    user_id: string;
    joined_at: string;
    is_admin: boolean;
    unread_messages: number;
    last_read_at: string | null;
    user?: {
        id: string;
        email: string;
        user_metadata?: {
            name?: string;
            avatar_url?: string;
        };
        profile?: {
            auth_id: string;
            nip: string;
            nama: string;
            photo_url: string | null;
        };
    };
}

export interface Conversation {
    id: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    is_group: boolean;
    name: string | null;
    last_message_preview: string | null;
    last_message_at: string | null;
    last_message_sender_id: string | null;
    unread_count: number;
    participants: ConversationParticipant[];
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    is_edited: boolean;
    sender?: {
        id: string;
        email: string;
        user_metadata?: {
            name?: string;
            avatar_url?: string;
        };
        profile?: {
            auth_id: string;
            nip: string;
            nama: string;
            photo_url: string | null;
        };
    };
}

export interface ChatUser {
    id: string;
    nip: string;
    nama: string;
    photo_url: string | null;
}

