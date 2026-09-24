export interface Journal {
    id: number;
    tanggal: string;
    hari: string;
    jam_ke: string;
    jam_ke_id?: number;
    nama_guru: string;
    kelas: string;
    mata_pelajaran: string;
    kategori_kehadiran: string;
    materi?: string;
    refleksi?: string;
    nip: string;
    guru_pengganti?: string;
    status_pengganti?: string;
    filled_by?: string;
    keterangan_terlambat?: string;
    keterangan_tambahan?: string;
    guru_piket?: string;
    durasi_terlambat?: number;
    durasi_keluar_awal?: number;
    status_tambahan_1?: string;
    status_tambahan_2?: string;
    status_tambahan_3?: string;
    allIds?: number[];
    jamIds?: number[];
}

export interface JournalFilters {
    nip?: string;
    kelas?: string;
    startDate?: string;
    endDate?: string;
    kategori?: string;
    search?: string;
}

export type JurnalFilters = JournalFilters;

export interface JurnalGuru {
    id?: number;
    nip: string;
    nama_guru: string;
    hari: string;
    tanggal: string; // YYYY-MM-DD
    jam_ke: string; // VARCHAR "07:00 - 07:40"
    jam_ke_id?: number; // Integer index (1, 2, 3...)
    kelas: string;
    mata_pelajaran: string;
    kategori_kehadiran: string;
    materi?: string;
    refleksi?: string;
    guru_pengganti?: string;
    status_pengganti?: string;
    filled_by?: string;
    keterangan_terlambat?: string;
    keterangan_tambahan?: string;
    guru_piket?: string;
    created_at?: string;
}



export interface JadwalGuru {
    id?: number;
    nip: string;
    nama_guru: string;
    hari: string;
    jam_ke: number | string; // Handle both types from DB
    kelas: string;
    mata_pelajaran: string;
    aktif?: boolean;
    berlaku_mulai?: string;
}

export interface Libur {
    id?: number;
    tanggal: string;
    jam_ke?: number | string | null;
    keterangan?: string;
    /** 'semua' | 'tingkat' | 'kelas' — lihat lib/libur.ts */
    lingkup?: string | null;
    /** Tingkat ('10'/'11'/'12') atau nama kelas, sesuai lingkup */
    target_kelas?: string[] | string | null;
}
