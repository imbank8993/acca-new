/**
 * Konfigurasi entitas data referensi.
 *
 * Semua route master lama mengulang pola yang sama persis: daftar dengan
 * pencarian + paginasi + filter `aktif`, simpan dengan pengecekan duplikat pada
 * satu kolom unik, dan hapus lunak (`aktif = false`). Alih-alih menulis ulang
 * controller per tabel, bentuknya dideklarasikan di sini dan dijalankan oleh
 * satu service generik.
 */
export interface MasterEntityConfig {
  /** Nama model Prisma. */
  model: string;
  /** Kolom unik untuk deteksi duplikat & update berbasis nama. */
  uniqueField: string;
  /**
   * Kunci unik gabungan, bila keunikan di database memang gabungan beberapa
   * kolom. `uniqueField` sendirian tidak cukup di kasus itu: mencocokkan
   * duplikat pada satu kolom saja menolak baris yang sah (mapel yang sama untuk
   * tingkat berbeda) dan, pada `?upsert=true`, menimpa baris lain yang kebetulan
   * senama. Bila diisi, cek duplikat memakai kombinasi ini.
   */
  uniqueFields?: string[];
  /**
   * Kolom yang boleh diisi saat pembuatan tetapi TIDAK boleh diubah lewat
   * `PUT /master/:entity`.
   *
   * Dua alasan berbeda bermuara ke sini. `nip`/`nisn` dipakai sebagai kunci
   * penghubung oleh tabel yang menyimpannya sebagai teks biasa tanpa foreign key
   * (guru_mapel, wali_kelas, guru_asuh, jadwal_guru, tugas_tambahan) — menggantinya
   * memutus seluruh penugasan orang itu tanpa error. `jenis_pegawai` punya jalur
   * sendiri (`POST /master/guru/pindah`) yang khusus Admin dan menampilkan dampak
   * penugasan lebih dulu; membiarkannya ikut PUT membuat gerbang itu bisa dilewati.
   */
  protectedFields?: string[];
  /** Kolom yang dicari lewat `?q=`. */
  searchFields: string[];
  /** Kolom yang boleh ditulis dari body. */
  writable: string[];
  /**
   * Kolom bertipe DATE (tanpa jam). Prisma mengembalikannya sebagai DateTime
   * penuh dan menolak string `YYYY-MM-DD` saat menulis, padahal seluruh UI
   * memakai format tanggal polos. Kolom yang terdaftar di sini dinormalkan dua
   * arah: `YYYY-MM-DD` saat dibaca, `Date` saat ditulis.
   */
  dateFields?: string[];
  /**
   * Kolom berisi data pribadi yang hanya boleh dilihat ADMIN.
   *
   * Daftar entitas ini dipakai luas sebagai sumber dropdown oleh halaman lain
   * (jadwal, jurnal, surat, dll) yang cuma butuh nama + nomor induk, jadi
   * barisnya tetap dikembalikan untuk pegawai yang login — kolom di bawah ini
   * saja yang dibuang. Lihat MasterController.list().
   */
  sensitiveFields?: string[];
  /** Nilai bawaan saat pembuatan. */
  defaults?: Record<string, any>;
  /** Punya kolom `aktif` (hapus lunak). */
  hasAktif: boolean;
  /**
   * Nama kolom boolean aktif/nonaktif. Default `'aktif'`.
   * Gunakan untuk entitas yang kolom aktifnya bernama berbeda (mis. `is_active`).
   */
  activeField?: string;
  orderBy: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  /** Tipe primary key, untuk mengubah `id` dari query string. */
  idType: 'int' | 'bigint' | 'uuid';
}

export const MASTER_ENTITIES: Record<string, MasterEntityConfig> = {
  kelas: {
    model: 'master_kelas',
    uniqueField: 'nama',
    searchFields: ['nama'],
    writable: ['nama', 'tingkat', 'program', 'kode', 'aktif'],
    defaults: { program: 'Reguler' },
    hasAktif: true,
    orderBy: { nama: 'asc' },
    idType: 'bigint',
  },
  ruangan: {
    model: 'master_ruangan',
    uniqueField: 'nama',
    searchFields: ['nama', 'kode', 'lokasi', 'keterangan'],
    writable: ['kode', 'nama', 'lokasi', 'kapasitas', 'keterangan', 'aktif'],
    hasAktif: true,
    orderBy: { nama: 'asc' },
    idType: 'bigint',
  },
  mapel: {
    model: 'master_mapel',
    uniqueField: 'kode',
    searchFields: ['nama', 'kode'],
    writable: ['kode', 'nama', 'kelompok', 'aktif'],
    hasAktif: true,
    orderBy: { nama: 'asc' },
    idType: 'bigint',
  },
  waktu: {
    model: 'master_waktu',
    uniqueField: 'id',
    searchFields: ['hari', 'program'],
    writable: ['jam_ke', 'mulai', 'selesai', 'hari', 'is_istirahat', 'program', 'aktif'],
    defaults: { program: 'Reguler' },
    hasAktif: true,
    orderBy: [{ jam_ke: 'asc' }],
    idType: 'bigint',
  },
  'kode-guru': {
    model: 'master_kode_guru',
    uniqueField: 'nip',
    searchFields: ['nama_guru', 'nip', 'kode_guru'],
    writable: ['nip', 'nama_guru', 'kode_guru', 'aktif'],
    hasAktif: true,
    orderBy: { nama_guru: 'asc' },
    idType: 'int',
  },
  'jp-mapel': {
    model: 'master_jp_mapel',
    uniqueField: 'nama_mapel',
    // Unik di database adalah gabungan empat kolom (idx_master_jp_mapel_unique).
    uniqueFields: ['nama_mapel', 'tingkat_kelas', 'tahun_ajaran', 'semester'],
    searchFields: ['nama_mapel', 'tingkat_kelas'],
    writable: [
      'nama_mapel',
      'tingkat_kelas',
      'tahun_ajaran',
      'semester',
      'jumlah_jp',
      'jp_intra',
      'jp_ko',
      'aktif',
    ],
    hasAktif: true,
    orderBy: [{ nama_mapel: 'asc' }],
    idType: 'int',
  },
  'mapel-kelas': {
    model: 'master_mapel_kelas',
    uniqueField: 'id',
    searchFields: ['mapel_kode', 'kelas_nama'],
    writable: ['mapel_kode', 'kelas_nama', 'tahun_ajaran', 'guru_nip'],
    hasAktif: false,
    orderBy: [{ kelas_nama: 'asc' }],
    idType: 'uuid',
  },

  // ─── Entitas yang sebelumnya menulis ke Supabase cloud ─────────────────────

  siswa: {
    model: 'master_siswa',
    uniqueField: 'nisn',
    searchFields: ['nama_lengkap', 'nisn'],
    writable: [
      'nisn', 'nik', 'nama_lengkap', 'gender',
      'tempat_lahir', 'tanggal_lahir',
      'nama_ayah', 'nama_ibu',
      'nomor_hp_ayah', 'nomor_hp_ibu',
      'alamat', 'asal_sekolah', 'aktif',
    ],
    dateFields: ['tanggal_lahir'],
    // student_cards, log_kokurikuler_siswa, dan siswa_kelas menempel pada nisn.
    protectedFields: ['nisn'],
    // Pemakai non-master (dropdown di permintaan-surat, prestasi, ekskul,
    // siswa-kelas) hanya membaca id/nisn/nama_lengkap.
    sensitiveFields: [
      'nik', 'tempat_lahir', 'tanggal_lahir',
      'nama_ayah', 'nama_ibu', 'nomor_hp_ayah', 'nomor_hp_ibu',
      'alamat', 'asal_sekolah',
    ],
    hasAktif: true,
    orderBy: { nama_lengkap: 'asc' },
    idType: 'bigint',
  },

  guru: {
    model: 'master_guru',
    uniqueField: 'nip',
    searchFields: ['nama_lengkap', 'nip'],
    writable: [
      'nip', 'nama_lengkap', 'jenis_pegawai',
      'tempat_lahir', 'tanggal_lahir',
      'golongan', 'pangkat', 'tmt_tugas',
      'riwayat_pendidikan', 'alamat', 'no_hp', 'aktif',
      'rekening_1_nama_bank', 'rekening_1_nomor', 'rekening_1_atas_nama', 'rekening_1_aktif',
      'rekening_2_nama_bank', 'rekening_2_nomor', 'rekening_2_atas_nama', 'rekening_2_aktif',
    ],
    dateFields: ['tanggal_lahir', 'tmt_tugas'],
    protectedFields: ['nip', 'jenis_pegawai'],
    // Nomor rekening, alamat rumah, dan nomor HP pegawai tidak dipakai satu pun
    // pemakai dropdown (absensi, jurnal, e-supervisi, ketidakhadiran,
    // catatan-keuangan, kode-guru) — semuanya cuma butuh nip + nama_lengkap.
    sensitiveFields: [
      'tempat_lahir', 'tanggal_lahir', 'alamat', 'no_hp', 'riwayat_pendidikan',
      'rekening_1_nama_bank', 'rekening_1_nomor', 'rekening_1_atas_nama', 'rekening_1_aktif',
      'rekening_2_nama_bank', 'rekening_2_nomor', 'rekening_2_atas_nama', 'rekening_2_aktif',
    ],
    hasAktif: true,
    orderBy: { nama_lengkap: 'asc' },
    idType: 'bigint',
  },

  /**
   * Kolom aktif di tabel ini bernama `is_active` (bukan `aktif`).
   * uniqueField = 'id' agar service tidak melakukan cek duplikat manual;
   * constraint DB `(tahun_ajaran, semester)` yang menangkap konflik.
   */
  'tahun-ajaran': {
    model: 'master_tahun_ajaran',
    uniqueField: 'id',
    searchFields: ['tahun_ajaran', 'semester'],
    writable: ['tahun_ajaran', 'semester', 'is_active'],
    hasAktif: false,       // is_active dikelola manual lewat PUT, bukan hapus-lunak
    activeField: 'is_active',
    orderBy: [{ tahun_ajaran: 'desc' }, { semester: 'asc' }],
    idType: 'bigint',
  },
};
