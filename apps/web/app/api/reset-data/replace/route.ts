import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { bolehAksesFitur, PENGATURAN_DATA_ACCESS_KEYS } from '@/lib/feature-access-server'
import { dbAdmin } from '@/lib/db-admin'
import { prisma } from '@/lib/prisma'
import { createPrismaDbAdapter } from '@/lib/prisma-db-adapter'

interface ReplaceRow {
  table: string
  column: string
  newValue: string
  tableKey: string
  rowId: string
  oldValue?: string
}

// Tables where 'id' is BIGSERIAL/IDENTITY (BIGINT) primary key
const BIGINT_ID_TABLES = new Set([
  'master_guru', 'master_siswa', 'master_mapel', 'master_kelas',
  'master_dropdown', 'master_tahun_ajaran',
  'master_agenda_kategori', 'profile_sekolah',
  'kelas_mapel', 'master_mapel_kelas',
  'jadwal_guru', 'jadwal_piket', 'laporan_piket', 'laporan_piket_detail',
  'nilai', 'ketidakhadiran',
  'jurnal', 'lckh_submissions', 'lckh_rekap_siswa',
  'informasi_akademik', 'agenda_akademik',
  'tugas_tambahan', 'tugas_siswa',
  'ekskul', 'ekskul_siswa', 'ekskul_pembina',
  'izin_guru',
  'kelulusan_data',
  'surat', 'notifications', 'chat_messages',
  'kokurikuler_responses',
])

// All tables + columns that store a NIP value and need cascade when master_guru.nip changes
const NIP_CASCADE: { table: string; nipColumn: string }[] = [
  { table: 'guru_mapel',              nipColumn: 'nip'      },
  { table: 'guru_asuh',              nipColumn: 'nip'      },
  { table: 'wali_kelas',            nipColumn: 'nip'      },
  { table: 'users',                 nipColumn: 'nip'      },
  { table: 'jadwal_guru',            nipColumn: 'nip'      },
  { table: 'jadwal_piket',          nipColumn: 'nip'      },
  { table: 'jurnal',                 nipColumn: 'nip'      },
  { table: 'lckh_submissions',      nipColumn: 'nip'      },
  { table: 'catatan_keuangan_guru', nipColumn: 'nip'      },
  { table: 'kelas_mapel',           nipColumn: 'nip_guru' },
  { table: 'master_mapel_kelas',    nipColumn: 'guru_nip' },
  { table: 'izin_guru',             nipColumn: 'nip'      },
  { table: 'ekskul_pembina',        nipColumn: 'nip'      },
  { table: 'tugas_tambahan',        nipColumn: 'nip'      },
]

/**
 * Semua tabel yang menyimpan NISN sebagai teks dan perlu ikut berubah saat NISN di
 * `master_siswa` dibetulkan.
 *
 * Daftarnya disusun dari `information_schema` basis data ini: 24 kolom bernama
 * nisn/nisn_* ditemukan, dikurangi `master_siswa` sendiri dan dua tabel `_backup_*`.
 *
 * Sebelumnya cascade ini TIDAK ADA sama sekali — hanya NIP yang punya. Jadi
 * membetulkan satu NISN membuat nilai, absensi, rekam medis, kartu siswa, relasi
 * orang tua, dan data kelulusan siswa itu menjadi yatim, tanpa satu pun pesan.
 *
 * CATATAN: daftar di kode ini harus dijaga manual sejalan dengan skema — tambah
 * tabel ke-22, seseorang harus ingat menyuntingnya. Perbaikan yang sebenarnya
 * adalah foreign key `ON UPDATE CASCADE` di database, yang dijaga Postgres sendiri.
 * Dua dari 21 tabel sudah punya FK (student_cards, log_kokurikuler_siswa) tetapi
 * `ON UPDATE NO ACTION`, sehingga justru MENOLAK perubahan — itulah sebabnya
 * perilaku hari ini berbeda tergantung siswanya.
 */
const NISN_CASCADE: { table: string; nisnColumn: string }[] = [
  { table: 'absensi_detail',        nisnColumn: 'nisn'         },
  { table: 'catatan_siswa',         nisnColumn: 'nisn'         },
  { table: 'dokumen_siswa',         nisnColumn: 'nisn'         },
  { table: 'guru_asuh',             nisnColumn: 'nisn_siswa'   },
  { table: 'jurnal_guru',           nisnColumn: 'nisn'         },
  { table: 'kelulusan_data',        nisnColumn: 'nisn'         },
  { table: 'ketidakhadiran',        nisnColumn: 'nisn'         },
  { table: 'log_kokurikuler_siswa', nisnColumn: 'nisn'         },
  { table: 'nilai_apresiasi_poin',  nisnColumn: 'nisn'         },
  { table: 'nilai_data',            nisnColumn: 'nisn'         },
  { table: 'orangtua_siswa',        nisnColumn: 'nisn'         },
  { table: 'prestasi_lomba',        nisnColumn: 'nisn'         },
  { table: 'ptsp_mutasi_siswa',     nisnColumn: 'nisn'         },
  { table: 'ptsp_pengganti_ijazah', nisnColumn: 'nisn'         },
  { table: 'rekam_medis_siswa',     nisnColumn: 'nisn'         },
  { table: 'siswa_kelas',           nisnColumn: 'nisn'         },
  { table: 'siswa_kelompok',        nisnColumn: 'nisn'         },
  { table: 'student_cards',         nisnColumn: 'nisn'         },
  { table: 'tugas_siswa',           nisnColumn: 'nisn_pembuat' },
  { table: 'ujian_madrasah',        nisnColumn: 'nisn'         },
  { table: 'um_rata_raport',        nisnColumn: 'nisn'         },
]

const ALLOWED_TABLES = new Set([
  // Core Master Data
  'users', 'master_guru', 'master_siswa', 'master_mapel', 'master_kelas', 'master_kode_guru',
  'master_dropdown', 'master_tahun_ajaran',
  'master_agenda_kategori', 'profile_sekolah',
  // Guru & Mapel Relations
  'guru_mapel', 'kelas_mapel', 'master_mapel_kelas', 'guru_asuh', 'wali_kelas',
  'izin_guru',
  // Jadwal & Piket
  'jadwal_guru', 'jadwal_piket', 'laporan_piket', 'laporan_piket_detail',
  // Siswa
  'siswa_kelas', 'nilai', 'ketidakhadiran',
  // Jurnal & LCKH
  'jurnal', 'lckh_submissions', 'lckh_rekap_siswa',
  // Akademik & Informasi
  'informasi_akademik', 'agenda_akademik',
  'tugas_tambahan', 'tugas_siswa',
  'ekskul', 'ekskul_siswa', 'ekskul_pembina',
  // Keuangan & Catatan
  'catatan_keuangan_guru', 'kelulusan_data',
  // Lainnya
  'surat', 'notifications', 'chat_messages',
  'kokurikuler_responses',
])

/**
 * Kolom yang boleh dipakai sebagai KUNCI BARIS (`tableKey`) di klausa WHERE.
 *
 * Sebelumnya `tableKey` dipakai apa adanya dari body permintaan, sementara daftar
 * izin hanya memeriksa `table` dan `column`. Karena nama kolom tidak bisa
 * diparameterkan di SQL, nilai seperti `id" OR 1=1 --` keluar dari tanda kutip dan
 * mengubah klausa WHERE sebuah UPDATE. Adapter kini menolak identifier tak sah
 * (lihat `kutipIdentifier`), dan daftar ini menambah lapisan kedua sekaligus
 * memberi pesan 400 yang jelas alih-alih galat dari lapisan bawah.
 */
const ALLOWED_KEYS = new Set(['id', 'nip', 'nisn', 'nisn_siswa', 'kode', 'username', 'key']);

const ALLOWED_COLUMNS = new Set([
  // Basic identifiers
  'nip', 'nisn', 'nama', 'nama_lengkap', 'nama_guru', 'nama_siswa',
  // Akademik
  'mata_pelajaran', 'kelas', 'divisi', 'kode_guru', 'kode_mapel',
  'hari', 'jam', 'jam_ke', 'waktu', 'semester', 'tahun_ajaran',
  'tahun_pelajaran',
  // Konten
  'jumlah', 'keterangan', 'tanggal', 'username', 'email',
  'nip_guru', 'guru_nip', 'kategori', 'nilai', 'label',
  // Informasi & Akademik
  'judul', 'konten', 'kegiatan', 'perihal', 'penerima',
  'jenis_surat', 'status', 'body', 'title', 'content',
  // Tugas & Tambahan
  'nama_tugas', 'point', 'deskripsi', 'role', 'menu_key',
  // Siswa
  'student_id',
  // Lainnya
  'alamat', 'nss', 'npsm', 'message_type',
])

/**
 * GERBANG WEWENANG — WAJIB, dan sebelumnya TIDAK ADA SAMA SEKALI.
 *
 * Route ini tidak memeriksa sesi maupun role, dan middleware Next tidak berjalan
 * untuk `/api/*` (lihat matcher di middleware.ts). Artinya siapa pun tanpa login
 * bisa memanggilnya. Pada endpoint `replace` akibatnya berat: `ALLOWED_TABLES`
 * memuat `users` dan `ALLOWED_COLUMNS` memuat `role`, `username`, `email`, dan
 * `nip` — cukup untuk menaikkan role sebuah akun menjadi ADMIN, atau mengunci
 * admin yang ada dengan menukar username/email-nya. Endpoint `search` melengkapi
 * rantainya: ia mengembalikan id baris, tanpa login juga.
 *
 * Gerbangnya: role ADMIN, atau ditunjuk di Pengaturan Users → Hak Akses Fitur
 * ("Pengaturan Data: Ganti Data Massal"). Aturan yang sama dipakai halaman
 * Master Data, lihat lib/feature-access-server.ts.
 */
async function pastikanBerwenang(request: NextRequest) {
  const user = await getApiUser(request)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Tidak terautentikasi' }, { status: 401 })
  }
  const boleh = await bolehAksesFitur(user, PENGATURAN_DATA_ACCESS_KEYS.ganti_massal)
  if (!boleh) {
    return NextResponse.json(
      { ok: false, error: 'Anda tidak berwenang memakai Ganti Data Massal.' },
      { status: 403 },
    )
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const ditolak = await pastikanBerwenang(request)
    if (ditolak) return ditolak

    const body = await request.json()
    const { rows } = body as { rows: ReplaceRow[] }

    console.log('[replace] Request received, rows:', JSON.stringify(rows, null, 2))

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Tidak ada baris untuk diperbarui.' }, { status: 400 })
    }

    // Security validation
    for (const row of rows) {
      if (!ALLOWED_TABLES.has(row.table)) {
        return NextResponse.json({ ok: false, error: `Tabel '${row.table}' tidak diizinkan.` }, { status: 400 })
      }
      if (!ALLOWED_COLUMNS.has(row.column)) {
        return NextResponse.json({ ok: false, error: `Kolom '${row.column}' tidak diizinkan.` }, { status: 400 })
      }
      if (!ALLOWED_KEYS.has(row.tableKey)) {
        return NextResponse.json({ ok: false, error: `Kunci baris '${row.tableKey}' tidak diizinkan.` }, { status: 400 })
      }
    }

    const results: {
      table: string; column: string; rowId: string;
      status: 'ok' | 'error' | 'skipped'; error?: string
    }[] = []
    let updated = 0
    let failed = 0

    // Separate master_guru.nip replacements (need cascade) from everything else
    const guruNipRows  = rows.filter(r => r.table === 'master_guru' && r.column === 'nip')
    const siswaNisnRows = rows.filter(r => r.table === 'master_siswa' && r.column === 'nisn')
    const otherRows    = rows.filter(r =>
      !(r.table === 'master_guru' && r.column === 'nip') &&
      !(r.table === 'master_siswa' && r.column === 'nisn'))

    // Deduplicate by guru id to avoid double-cascade
    const guruById = new Map<string, ReplaceRow>()
    for (const r of guruNipRows) {
      if (!guruById.has(r.rowId)) guruById.set(r.rowId, r)
    }
    const siswaById = new Map<string, ReplaceRow>()
    for (const r of siswaNisnRows) {
      if (!siswaById.has(r.rowId)) siswaById.set(r.rowId, r)
    }

    // ── master_guru.nip: update by id + cascade ─────────────────────────────
    //
    // TIGA masalah yang diperbaiki di blok ini:
    //
    // 1. TIDAK ATOMIK. Pembaruan `master_guru` dan 14 cascade-nya dulu berjalan
    //    sebagai perintah terpisah. Kalau salah satu cascade gagal di tengah, NIP
    //    di master SUDAH berubah sementara sebagian tabel masih memegang nilai
    //    lama — seluruh riwayat pegawai itu terlepas, tanpa bisa dibatalkan.
    //    Sekarang semuanya dalam satu transaksi: gagal satu, batal semua.
    //
    // 2. KEGAGALAN CASCADE DITELAN. Dulu `if (errFk) console.error(...)` — tanpa
    //    `failed++`, tanpa masuk ke `results`. Responsnya melaporkan `ok` padahal
    //    sampai 14 pembaruan bisa gagal diam-diam.
    //
    // 3. "TIDAK ADA BARIS COCOK" DILAPORKAN SUKSES. Adapter memakai `RETURNING *`,
    //    jadi jumlah baris terpengaruh sebenarnya tersedia — tetapi kodenya hanya
    //    membaca `error` dan mengabaikan `data`. `rowId` yang salah atau `oldValue`
    //    yang tidak cocok menghasilkan 0 baris berubah dan tetap dilaporkan "ok".
    for (const [guruId, row] of guruById) {
      const oldNip = row.oldValue
      const newNip = row.newValue
      const guruIdNum = parseInt(guruId, 10)

      if (!Number.isFinite(guruIdNum)) {
        results.push({ table: 'master_guru', column: 'nip', rowId: guruId, status: 'error', error: `rowId bukan angka: ${guruId}` })
        failed++
        continue
      }
      if (!oldNip) {
        // Tanpa nilai lama, cascade tidak punya patokan pencarian — dan kalau
        // dibiarkan lanjut, master berubah sementara tabel lain tidak tersentuh.
        results.push({ table: 'master_guru', column: 'nip', rowId: guruId, status: 'error', error: 'oldValue wajib dikirim untuk penggantian NIP (dibutuhkan cascade)' })
        failed++
        continue
      }

      try {
        const rincian = await prisma.$transaction(async (tx) => {
          const db = createPrismaDbAdapter(tx as unknown as typeof prisma)

          const { data: barisGuru, error: errGuru } = await db
            .from('master_guru')
            .update({ nip: newNip })
            .eq('id', guruIdNum)
          if (errGuru) throw new Error(`master_guru: ${errGuru.message}`)
          if (!Array.isArray(barisGuru) || barisGuru.length === 0) {
            throw new Error(`Tidak ada pegawai dengan id ${guruIdNum}`)
          }

          const perTabel: { table: string; changed: number }[] = []
          for (const { table, nipColumn } of NIP_CASCADE) {
            const { data: barisIkut, error: errFk } = await db
              .from(table)
              .update({ [nipColumn]: newNip })
              .eq(nipColumn, oldNip)
            if (errFk) throw new Error(`${table}.${nipColumn}: ${errFk.message}`)
            perTabel.push({ table, changed: Array.isArray(barisIkut) ? barisIkut.length : 0 })
          }
          return perTabel
        })

        const totalIkut = rincian.reduce((n, r) => n + r.changed, 0)
        results.push({ table: 'master_guru', column: 'nip', rowId: guruId, status: 'ok' })
        updated++
        console.log(`[replace] master_guru.nip OK '${oldNip}' -> '${newNip}', cascade ${totalIkut} baris di ${rincian.filter(r => r.changed > 0).length} tabel`)
      } catch (e) {
        // Transaksi dibatalkan: NIP di master pun kembali seperti semula.
        const pesan = e instanceof Error ? e.message : String(e)
        console.error('[replace] master_guru.nip DIBATALKAN:', pesan)
        results.push({ table: 'master_guru', column: 'nip', rowId: guruId, status: 'error', error: `Dibatalkan, tidak ada perubahan tersimpan. ${pesan}` })
        failed++
      }
    }

    // ── master_siswa.nisn: update by id + cascade ──────────────────────────
    // Aturan dan penjagaannya sama dengan blok NIP di atas: satu transaksi,
    // kegagalan dilaporkan, dan 0 baris berubah bukan dianggap sukses.
    for (const [siswaId, row] of siswaById) {
      const oldNisn = row.oldValue
      const newNisn = row.newValue
      const siswaIdNum = parseInt(siswaId, 10)

      if (!Number.isFinite(siswaIdNum)) {
        results.push({ table: 'master_siswa', column: 'nisn', rowId: siswaId, status: 'error', error: `rowId bukan angka: ${siswaId}` })
        failed++
        continue
      }
      if (!oldNisn) {
        results.push({ table: 'master_siswa', column: 'nisn', rowId: siswaId, status: 'error', error: 'oldValue wajib dikirim untuk penggantian NISN (dibutuhkan cascade)' })
        failed++
        continue
      }

      try {
        const rincian = await prisma.$transaction(async (tx) => {
          const db = createPrismaDbAdapter(tx as unknown as typeof prisma)

          const { data: barisSiswa, error: errSiswa } = await db
            .from('master_siswa')
            .update({ nisn: newNisn })
            .eq('id', siswaIdNum)
          if (errSiswa) throw new Error(`master_siswa: ${errSiswa.message}`)
          if (!Array.isArray(barisSiswa) || barisSiswa.length === 0) {
            throw new Error(`Tidak ada siswa dengan id ${siswaIdNum}`)
          }

          const perTabel: { table: string; changed: number }[] = []
          for (const { table, nisnColumn } of NISN_CASCADE) {
            const { data: barisIkut, error: errFk } = await db
              .from(table)
              .update({ [nisnColumn]: newNisn })
              .eq(nisnColumn, oldNisn)
            if (errFk) throw new Error(`${table}.${nisnColumn}: ${errFk.message}`)
            perTabel.push({ table, changed: Array.isArray(barisIkut) ? barisIkut.length : 0 })
          }
          return perTabel
        })

        const totalIkut = rincian.reduce((n, r) => n + r.changed, 0)
        results.push({ table: 'master_siswa', column: 'nisn', rowId: siswaId, status: 'ok' })
        updated++
        console.log(`[replace] master_siswa.nisn OK '${oldNisn}' -> '${newNisn}', cascade ${totalIkut} baris di ${rincian.filter(r => r.changed > 0).length} tabel`)
      } catch (e) {
        const pesan = e instanceof Error ? e.message : String(e)
        console.error('[replace] master_siswa.nisn DIBATALKAN:', pesan)
        results.push({ table: 'master_siswa', column: 'nisn', rowId: siswaId, status: 'error', error: `Dibatalkan, tidak ada perubahan tersimpan. ${pesan}` })
        failed++
      }
    }

    // ── All other replacements ───────────────────────────────────────────────
    for (const row of otherRows) {
      const keyVal = (BIGINT_ID_TABLES.has(row.table) && row.tableKey === 'id')
        ? parseInt(row.rowId, 10)
        : row.rowId

      console.log(`[replace] UPDATE ${row.table} SET ${row.column}='${row.newValue}' WHERE ${row.tableKey}=${keyVal}`)

      const { data: barisBerubah, error } = await dbAdmin
        .from(row.table)
        .update({ [row.column]: row.newValue })
        .eq(row.tableKey, keyVal)

      if (error) {
        console.error(`[replace] FAILED [${row.table}]:`, error)
        results.push({ table: row.table, column: row.column, rowId: row.rowId, status: 'error', error: error.message })
        failed++
      } else if (!Array.isArray(barisBerubah) || barisBerubah.length === 0) {
        // Bukan galat, tapi juga bukan keberhasilan: tidak ada baris yang cocok.
        // Dulu kasus ini dihitung sebagai 'ok' dan hasilnya dilaporkan tersimpan.
        console.warn(`[replace] TIDAK ADA BARIS COCOK [${row.table}] ${row.tableKey}=${keyVal}`)
        results.push({ table: row.table, column: row.column, rowId: row.rowId, status: 'skipped', error: `Tidak ada baris dengan ${row.tableKey}=${keyVal}` })
        failed++
      } else {
        console.log(`[replace] OK [${row.table}]`)
        results.push({ table: row.table, column: row.column, rowId: row.rowId, status: 'ok' })
        updated++
      }
    }

    const response = {
      ok: failed === 0,
      updated,
      failed,
      results,
      message: `Berhasil: ${updated}, Gagal: ${failed}`,
    }
    console.log('[replace] Final response:', JSON.stringify(response, null, 2))
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[replace] Fatal error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
