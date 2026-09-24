import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { bolehAksesFitur, PENGATURAN_DATA_ACCESS_KEYS } from '@/lib/feature-access-server'
import { dbAdmin } from '@/lib/db-admin'

interface PreviewRow {
  id: string
  table: string
  column: string
  oldValue: string
  newValue: string
  rowLabel: string
  nip?: string
  nisn?: string
  tableKey: string
  rowId: string
}

interface TableConfig {
  tableKey: string
  labelFn: (row: any) => string
}

// Known table configs (manually curated for best UX)
const KNOWN_TABLE_CONFIGS: Record<string, TableConfig> = {
  users: {
    tableKey: 'nip',
    labelFn: (r) => `Users: ${r.nama || '(tanpa nama)'} — NIP: ${r.nip || ''} / NISN: ${r.nisn || ''}`,
  },
  master_guru: {
    tableKey: 'id',
    labelFn: (r) => `Master Guru: ${r.nama_lengkap} — NIP: ${r.nip}`,
  },
  master_siswa: {
    tableKey: 'id',
    labelFn: (r) => `Master Siswa: ${r.nama_lengkap} — NISN: ${r.nisn}`,
  },
  master_kode_guru: {
    tableKey: 'kode_guru',
    labelFn: (r) => `Kode Guru: ${r.kode_guru} — NIP: ${r.nip} — ${r.nama_guru || ''}`,
  },
  master_mapel: {
    tableKey: 'id',
    labelFn: (r) => `Mapel: ${r.nama_mapel}`,
  },
  master_kelas: {
    tableKey: 'id',
    labelFn: (r) => `Kelas: ${r.nama_kelas}`,
  },
  master_dropdown: {
    tableKey: 'id',
    labelFn: (r) => `Master Dropdown: ${r.kategori || ''} — ${r.nilai || ''}`,
  },
  master_tahun_ajaran: {
    tableKey: 'id',
    labelFn: (r) => `Tahun Ajaran: ${r.tahun_ajaran || ''} — Semester ${r.semester || ''}`,
  },
  master_agenda_kategori: {
    tableKey: 'id',
    labelFn: (r) => `Agenda Kategori: ${r.nama || ''}`,
  },
  profile_sekolah: {
    tableKey: 'id',
    labelFn: (r) => `Profil Sekolah: ${r.nama_sekolah || ''}`,
  },
  guru_mapel: {
    tableKey: 'nip',
    labelFn: (r) => `Guru Mapel: NIP ${r.nip} — ${r.mata_pelajaran || ''}`,
  },
  kelas_mapel: {
    tableKey: 'id',
    labelFn: (r) => `Kelas Mapel: Kode ${r.kode_mapel || r.id} — NIP ${r.nip || r.nip_guru || ''} — ${r.nama_guru || ''}`,
  },
  master_mapel_kelas: {
    tableKey: 'id',
    labelFn: (r) => `Master Mapel Kelas: Guru NIP ${r.guru_nip || ''} — Mapel ${r.nama_mapel || ''} — ${r.nama_kelas || ''}`,
  },
  guru_asuh: {
    tableKey: 'nip',
    labelFn: (r) => `Guru Asuh: NIP ${r.nip} — Kelas ${r.kelas || ''}`,
  },
  wali_kelas: {
    tableKey: 'nip',
    labelFn: (r) => `Wali Kelas: NIP ${r.nip} — Kelas ${r.kelas || ''}`,
  },
  izin_guru: {
    tableKey: 'id',
    labelFn: (r) => `Izin Guru: NIP ${r.nip || ''} — ${r.tanggal || ''} — ${r.status || ''}`,
  },
  jadwal_guru: {
    tableKey: 'id',
    labelFn: (r) => `Jadwal Guru: NIP ${r.nip} — ${r.hari || ''} ${r.jam || ''} — ${r.kelas || ''} ${r.mata_pelajaran || ''}`,
  },
  jadwal_piket: {
    tableKey: 'id',
    labelFn: (r) => `Jadwal Piket: NIP ${r.nip} — ${r.hari || ''} Jam ${r.jam_ke || ''} — ${r.kelas || ''}`,
  },
  laporan_piket: {
    tableKey: 'id',
    labelFn: (r) => `Laporan Piket: ${r.tanggal || ''} — Kelas ${r.kelas || ''}`,
  },
  laporan_piket_detail: {
    tableKey: 'id',
    labelFn: (r) => `Laporan Piket Detail: Laporan ${r.laporan_id || ''} — Jam ${r.jam_ke || ''}`,
  },
  siswa_kelas: {
    tableKey: 'nisn',
    labelFn: (r) => `Siswa Kelas: NISN ${r.nisn} — ${r.kelas || ''}`,
  },
  nilai: {
    tableKey: 'id',
    labelFn: (r) => `Nilai: NISN ${r.nisn} — ${r.mata_pelajaran || ''} — ${r.kelas || ''}`,
  },
  ketidakhadiran: {
    tableKey: 'id',
    labelFn: (r) => `Ketidakhadiran: NISN ${r.nisn} — ${r.kelas || ''} — ${r.tanggal || r.id}`,
  },
  jurnal: {
    tableKey: 'id',
    labelFn: (r) => `Jurnal: NIP ${r.nip} — ${r.tanggal || r.id}`,
  },
  lckh_submissions: {
    tableKey: 'id',
    labelFn: (r) => `LCKH: NIP ${r.nip} — ${r.tanggal || r.id}`,
  },
  lckh_rekap_siswa: {
    tableKey: 'id',
    labelFn: (r) => `LCKH Rekap Siswa: NISN ${r.nisn || ''} — ${r.periode || ''}`,
  },
  informasi_akademik: {
    tableKey: 'id',
    labelFn: (r) => `Info Akademik: ${r.judul || ''} — ${r.kategori || ''}`,
  },
  agenda_akademik: {
    tableKey: 'id',
    labelFn: (r) => `Agenda Akademik: ${r.kegiatan || ''} — ${r.tanggal || ''}`,
  },
  tugas_tambahan: {
    tableKey: 'id',
    labelFn: (r) => `Tugas Tambahan: ${r.nama_tugas || ''} — NIP ${r.nip || ''}`,
  },
  tugas_siswa: {
    tableKey: 'id',
    labelFn: (r) => `Tugas Siswa: ${r.judul || ''} — NISN ${r.nisn || ''}`,
  },
  ekskul: {
    tableKey: 'id',
    labelFn: (r) => `Ekstrakurikuler: ${r.nama || ''} — Hari ${r.hari || ''}`,
  },
  ekskul_siswa: {
    tableKey: 'id',
    labelFn: (r) => `Ekstrakurikuler Siswa: NISN ${r.nisn || ''} — Ekskul ${r.ekskul_id || ''}`,
  },
  ekskul_pembina: {
    tableKey: 'id',
    labelFn: (r) => `Pembina Ekskul: NIP ${r.nip || ''} — Ekskul ${r.ekskul_id || ''}`,
  },
  catatan_keuangan_guru: {
    tableKey: 'id',
    labelFn: (r) => `Catatan Keuangan Guru: NIP ${r.nip} — ${r.tanggal || r.id}`,
  },
  kelulusan_data: {
    tableKey: 'id',
    labelFn: (r) => `Kelulusan: NISN ${r.nisn || ''} — ${r.tahun_pelajaran || ''}`,
  },
  surat: {
    tableKey: 'id',
    labelFn: (r) => `Surat: ${r.perihal || ''} — ${r.jenis_surat || ''}`,
  },
  notifications: {
    tableKey: 'id',
    labelFn: (r) => `Notifikasi: ${r.title || ''} — User ${r.user_id || ''}`,
  },
  chat_messages: {
    tableKey: 'id',
    labelFn: (r) => `Chat: ${r.sender_id || ''} → ${r.receiver_id || ''} — ${r.created_at || ''}`,
  },
  kokurikuler_responses: {
    tableKey: 'id',
    labelFn: (r) => `Kokurikuler Response: Siswa ${r.student_id || ''} — Form ${r.form_id || ''}`,
  },
}

// Known text columns
const KNOWN_TEXT_COLUMNS: Record<string, string[]> = {
  users:                    ['nip', 'nisn', 'nama', 'nama_lengkap', 'divisi', 'username', 'email'],
  master_guru:             ['nip', 'nama_lengkap', 'nama_guru', 'divisi', 'kode_guru'],
  master_siswa:            ['nisn', 'nama_lengkap', 'nama_siswa', 'kelas'],
  master_kode_guru:        ['kode_guru', 'nip', 'nama_guru'],
  master_mapel:            ['nama_mapel', 'kode_mapel'],
  master_kelas:           ['nama_kelas'],
  master_dropdown:         ['kategori', 'nilai', 'label'],
  master_tahun_ajaran:     ['tahun_ajaran', 'semester'],
  master_agenda_kategori:  ['nama'],
  profile_sekolah:         ['nama_sekolah', 'alamat', 'nss', 'npsm'],
  guru_mapel:              ['nip', 'nama_guru', 'mata_pelajaran'],
  kelas_mapel:             ['nip', 'nip_guru', 'nama_guru', 'kode_mapel', 'nama_mapel', 'nama_kelas'],
  master_mapel_kelas:       ['guru_nip', 'nama_mapel', 'nama_kelas', 'kode_guru'],
  guru_asuh:               ['nip', 'nama_guru', 'kelas'],
  wali_kelas:              ['nip', 'nama_guru', 'kelas'],
  izin_guru:               ['nip', 'keterangan', 'status'],
  jadwal_guru:             ['nip', 'nama_guru', 'kelas', 'mata_pelajaran', 'hari', 'jam'],
  jadwal_piket:            ['nip', 'kode_guru', 'kelas', 'hari', 'jam_ke', 'waktu'],
  laporan_piket:            ['kelas', 'keterangan', 'status'],
  laporan_piket_detail:   ['keterangan', 'status_temuan'],
  siswa_kelas:            ['nisn', 'nama_siswa', 'kelas'],
  nilai:                   ['nisn', 'mata_pelajaran', 'kelas'],
  ketidakhadiran:           ['nisn', 'kelas', 'keterangan'],
  jurnal:                   ['nip', 'keterangan'],
  lckh_submissions:        ['nip', 'keterangan'],
  lckh_rekap_siswa:        ['nisn', 'keterangan'],
  informasi_akademik:      ['judul', 'kategori', 'konten'],
  agenda_akademik:        ['kegiatan', 'kategori', 'keterangan'],
  tugas_tambahan:          ['nama_tugas', 'keterangan'],
  tugas_siswa:             ['judul', 'deskripsi', 'keterangan'],
  ekskul:                  ['nama', 'hari', 'keterangan'],
  ekskul_siswa:            ['nisn', 'status'],
  ekskul_pembina:          ['nip', 'status'],
  catatan_keuangan_guru: ['nip', 'jumlah', 'keterangan'],
  kelulusan_data:          ['nisn', 'nama_siswa', 'status'],
  surat:                  ['perihal', 'penerima', 'jenis_surat'],
  notifications:          ['title', 'body', 'type'],
  chat_messages:          ['content', 'message_type'],
  kokurikuler_responses:  ['student_id', 'status'],
}

// Tables where 'id' is BIGSERIAL / IDENTITY primary key
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

// Auto-detect all tables from information_schema
async function getAllTables(): Promise<string[]> {
  try {
    const { data, error } = await dbAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .not('table_name', 'like', 'pg_%')
      .not('table_name', 'like', 'sql_%')

    if (error) {
      console.warn('[search] Failed to get tables from information_schema:', error.message)
      return []
    }

    return (data || []).map((r: any) => r.table_name as string)
  } catch (e) {
    console.warn('[search] Exception getting tables:', e)
    return []
  }
}

// Auto-detect text/varchar columns for a table
async function getTextColumns(tableName: string): Promise<string[]> {
  try {
    const { data, error } = await dbAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .in('data_type', ['character varying', 'text', 'character', 'jsonb'])

    if (error) return []
    return (data || []).map((r: any) => r.column_name as string)
  } catch {
    return []
  }
}

// Auto-generate label function for unknown tables
function autoLabelFn(tableName: string): (r: any) => string {
  return (r) => {
    const name = r.nama || r.name || r.title || r.label || r.judul || r.keterangan || ''
    const id = r.id || r.nip || r.nisn || ''
    return `${tableName}: ${name}${id ? ` (${id})` : ''}`
  }
}

// Build table config (use known or auto-generate)
async function buildTableConfig(tableName: string): Promise<{ config: TableConfig; columns: string[] } | null> {
  if (KNOWN_TABLE_CONFIGS[tableName]) {
    return {
      config: KNOWN_TABLE_CONFIGS[tableName],
      columns: KNOWN_TEXT_COLUMNS[tableName] || [],
    }
  }

  const columns = await getTextColumns(tableName)
  if (columns.length === 0) return null

  return {
    config: {
      tableKey: 'id',
      labelFn: autoLabelFn(tableName),
    },
    columns,
  }
}

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

export async function GET(request: NextRequest) {
  try {
    const ditolak = await pastikanBerwenang(request)
    if (ditolak) return ditolak

    const { searchParams } = new URL(request.url)
    const value = searchParams.get('value')
    const detectNewTables = searchParams.get('detectNewTables') !== 'false'

    if (!value || !value.trim()) {
      return NextResponse.json({ ok: false, error: 'Parameter value wajib ada.' }, { status: 400 })
    }

    const searchVal = value.trim()
    const results: PreviewRow[] = []

    // Build configs for all tables to search
    const tablesToSearch: { name: string; config: TableConfig; columns: string[] }[] = []

    // Add known tables
    for (const [tableName, config] of Object.entries(KNOWN_TABLE_CONFIGS)) {
      const columns = KNOWN_TEXT_COLUMNS[tableName] || []
      if (columns.length > 0) {
        tablesToSearch.push({ name: tableName, config, columns })
      }
    }

    // Auto-detect new tables if enabled
    if (detectNewTables) {
      const allTables = await getAllTables()
      for (const tableName of allTables) {
        if (!KNOWN_TABLE_CONFIGS[tableName]) {
          const built = await buildTableConfig(tableName)
          if (built && built.columns.length > 0) {
            tablesToSearch.push({ name: tableName, config: built.config, columns: built.columns })
            console.log(`[search] Auto-detected new table: ${tableName}`)
          }
        }
      }
    }

    // Search in all tables
    for (const { name: tableName, config, columns } of tablesToSearch) {
      const seen = new Set<string>()

      for (const col of columns) {
        const { data, error } = await dbAdmin
          .from(tableName)
          .select('*')
          .eq(col, searchVal)
          .limit(200)

        if (error) {
          console.warn(`[search] Skipping ${tableName}.${col}: ${error.message}`)
          continue
        }

        for (const row of data || []) {
          const rawRowId = row[config.tableKey] ?? row.id
          const rowId = BIGINT_ID_TABLES.has(tableName) && config.tableKey === 'id'
            ? String(Number(rawRowId))
            : String(rawRowId ?? '')

          const id = `${tableName}:${rowId}:${col}`
          if (seen.has(id)) continue
          seen.add(id)

          results.push({
            id,
            table: tableName,
            column: col,
            oldValue: String(row[col] ?? ''),
            newValue: searchVal,
            rowLabel: config.labelFn(row),
            nip: row.nip || row.nip_guru || undefined,
            nisn: row.nisn || undefined,
            tableKey: config.tableKey,
            rowId,
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      value: searchVal,
      results,
      count: results.length,
      tablesSearched: tablesToSearch.length,
    })
  } catch (error: any) {
    console.error('[search] Fatal:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}