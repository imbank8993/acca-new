/** Bentuk data yang dipakai halaman Bank Data (hasil /api/bank-data). */

export interface KolomKatalog {
    key: string;
    label: string;
    sensitif?: boolean;
    /**
     * Kolom yang isinya dirangkum dari tabel lain (kelas, ekskul, wali kelas,
     * mapel, tugas tambahan). Dipisahkan di UI supaya jelas mana identitas orang
     * dan mana data yang menempel padanya lewat tahun ajaran.
     */
    pendukung?: boolean;
}

/** Dataset seperti yang dilihat PENGEKSPOR — kolomnya sudah tersaring server. */
export interface DatasetKatalog {
    id: string;
    label: string;
    ikon: string;
    deskripsi: string;
    filter: ('tahun_ajaran' | 'semester' | 'kelas')[];
    batasBaris: number;
    kolom: KolomKatalog[];
}

/** Dataset seperti yang dilihat ADMIN di tab Pengaturan — katalog utuh + konfigurasi. */
export interface DatasetKonfig extends Omit<DatasetKatalog, 'batasBaris'> {
    table: string;
    batasBarisKatalog: number;
    batasBaris: number | null;
    aktif: boolean;
    kolomDiizinkan: string[];
    catatan: string;
}

export interface BarisLog {
    id: number;
    user_id: number | null;
    nama_user: string | null;
    dataset_id: string;
    dataset_label: string;
    filter: Record<string, any> | null;
    kolom: string[] | null;
    jumlah_baris: number | null;
    ip: string | null;
    created_at: string;
}
