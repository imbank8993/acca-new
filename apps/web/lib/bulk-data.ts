import 'server-only'
import { prisma } from './prisma'

export const BULK_LIMIT = 1000
export class BulkDataError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function bulkFailure(error: unknown) {
  if (error instanceof BulkDataError) return { status: error.status, message: error.message }
  const raw = error as { code?: string; meta?: { code?: string } } | null
  const code = raw?.meta?.code || raw?.code || ''
  if (code === '23505') return { status: 409, message: 'Nilai baru sudah dipakai oleh data lain. Seluruh perubahan dibatalkan.' }
  if (code === '23503') return { status: 409, message: 'Relasi database menolak perubahan identitas tersebut. Seluruh perubahan dibatalkan.' }
  if (code.startsWith('22') || code === '23502' || code === '23514') return { status: 400, message: 'Nilai baru tidak sesuai tipe atau aturan kolom. Seluruh perubahan dibatalkan.' }
  return { status: 503, message: 'Pemrosesan belum dapat diselesaikan. Jika sedang mengganti data, seluruh transaksi dibatalkan. Coba lagi.' }
}

type Database = Pick<typeof prisma, '$queryRawUnsafe' | '$executeRawUnsafe'>
interface Column {
  table: string
  column: string
  type: string
  primary: string[]
  generated: boolean
  primaryColumn: boolean
}
export interface BulkRow {
  id: string
  table: string
  column: string
  oldValue: string
  oldJson: string
  rowLabel: string
  tableKey: string
  rowId: string
  newValue?: string
}

// Operational data only. Credentials, access control, and audit history have
// dedicated update flows and must not be exposed through a general replacement.
const protectedTable = /(^_?backup|_backup$|^audit_|^auth_|^ecert_|^_prisma|^pg_|^sql_|token|session|credential|capabilit|permission|^role_|^user_roles$|^site_settings$|^system_config$|^activity_logs$)/i
const protectedColumn = /(password|passwd|secret|token|salt|credential|private_key|auth_id|cbt_auth_id|page_overrides|permissions|^caps$|^pinned_pages$|^recovery_|^encrypted_|^mfa_)/i
const adminColumn = /^(role|roles|is_admin|is_superuser|aktif)$/i
const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"'
const tableSql = (name: string) => `"public".${quote(name)}`
const permitted = (column: Column, admin: boolean) => !protectedTable.test(column.table)
  && !protectedColumn.test(column.column) && !column.generated && !column.primaryColumn
  && (admin || !adminColumn.test(column.column)) && column.primary.length > 0

async function catalog(db: Database): Promise<Column[]> {
  return db.$queryRawUnsafe<Column[]>(`
    SELECT c.relname AS "table",a.attname AS "column",t.typname AS "type",
      (a.attgenerated<>'' OR a.attidentity<>'') AS generated,
      COALESCE(a.attnum=ANY(pk.indkey),false) AS "primaryColumn",
      COALESCE((SELECT array_agg(pa.attname::text ORDER BY k.ord)
        FROM unnest(pk.indkey) WITH ORDINALITY AS k(attnum,ord)
        JOIN pg_attribute pa ON pa.attrelid=c.oid AND pa.attnum=k.attnum),'{}'::text[]) AS "primary"
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    JOIN pg_type t ON t.oid=a.atttypid
    LEFT JOIN pg_index pk ON pk.indrelid=c.oid AND pk.indisprimary
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition
    ORDER BY c.relname,a.attnum`)
}

function jsonSearch(value: string): string {
  try { JSON.parse(value); return value } catch { return JSON.stringify(value) }
}

function rowKey(table: string, rowId: string, column: string) {
  return JSON.stringify([table, rowId, column])
}

export async function searchBulkData(value: string, admin: boolean, db?: Database) {
  if (db) return searchDatabase(value, admin, db)
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'")
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'")
    return searchDatabase(value, admin, tx)
  }, { maxWait: 10000, timeout: 60000 })
}

async function searchDatabase(value: string, admin: boolean, db: Database) {
  if (!value.trim() || value.length > 10000) throw new BulkDataError('Isi nilai pencarian sepanjang 1–10.000 karakter.')
  const columns = await catalog(db)
  const available = columns.filter(c => permitted(c, admin))
  const tables = [...new Set(available.map(c => c.table))]
  const results: BulkRow[] = []
  let truncated = false, searched = 0
  for (const table of tables) {
    const fields = available.filter(c => c.table === table)
    const pk = fields[0].primary
    const pkObject = `jsonb_build_object(${pk.flatMap(key => [`'${key.replace(/'/g, "''")}'`, `to_jsonb(t.${quote(key)})`]).join(',')})::text`
    const labelColumns = ['nama_lengkap','nama_siswa','nama_guru','nama','name','judul','title','label'].filter(key => fields.some(c => c.column === key))
    const label = labelColumns.length ? `COALESCE(${labelColumns.map(key => `t.${quote(key)}::text`).join(',')},${pkObject})` : pkObject
    const values = fields.map(c => `('${c.column.replace(/'/g, "''")}',t.${quote(c.column)}::text,COALESCE(to_jsonb(t.${quote(c.column)})::text,'null'))`).join(',')
    const rows = await db.$queryRawUnsafe<Array<{ column: string; oldValue: string | null; oldJson: string; rowId: string; rowLabel: string }>>(`
      SELECT v.col AS "column",v.raw AS "oldValue",v.js AS "oldJson",${pkObject} AS "rowId",${label} AS "rowLabel"
      FROM ${tableSql(table)} t CROSS JOIN LATERAL (VALUES ${values}) AS v(col,raw,js)
      WHERE v.raw=$1 OR v.js::jsonb=$2::jsonb
      ORDER BY ${pkObject},v.col LIMIT $3`, value, jsonSearch(value), BULK_LIMIT - results.length + 1)
    searched++
    for (const row of rows) {
      if (results.length >= BULK_LIMIT) { truncated = true; break }
      results.push({ ...row, oldValue: row.oldValue ?? 'NULL (kosong)', table, tableKey: '__primary_key__', id: rowKey(table, row.rowId, row.column) })
    }
    if (truncated) break
  }
  return { ok: true, results, count: results.length, tablesSearched: searched, tablesAvailable: tables.length,
    columnsAvailable: available.length, protectedColumns: columns.length - available.length, truncated, limit: BULK_LIMIT }
}

function replacement(column: Column, value: string): string {
  if (value === 'null') return 'null'
  if (value === '""' && !['json','jsonb'].includes(column.type) && !column.type.startsWith('_')) return '""'
  if (column.type === 'json' || column.type === 'jsonb' || column.type.startsWith('_')) {
    try { JSON.parse(value); return value } catch { throw new BulkDataError(`Nilai ${column.table}.${column.column} harus berupa JSON yang valid.`) }
  }
  // Keep numbers as strings so BIGINT and DECIMAL are never rounded in JS.
  return JSON.stringify(value)
}

function validateRows(input: unknown): BulkRow[] {
  if (!Array.isArray(input) || !input.length || input.length > BULK_LIMIT) throw new BulkDataError(`Pilih 1–${BULK_LIMIT} perubahan.`)
  const seen = new Set<string>()
  return input.map(raw => {
    if (!raw || typeof raw !== 'object') throw new BulkDataError('Baris tidak valid.')
    const row = raw as BulkRow
    for (const key of ['table','column','oldJson','rowId','newValue'] as const) {
      if (typeof row[key] !== 'string' || row[key]!.length > 100000) throw new BulkDataError('Baris tidak valid. Cari ulang data sebelum mengganti.')
    }
    const id = rowKey(row.table, row.rowId, row.column)
    if (seen.has(id)) throw new BulkDataError('Perubahan ganda pada sel yang sama.')
    seen.add(id)
    try { JSON.parse(row.oldJson) } catch { throw new BulkDataError('Nilai lama tidak valid. Cari ulang data.') }
    return { ...row, id }
  })
}

function locator(row: BulkRow, column: Column) {
  let key: Record<string, unknown>
  try { key = JSON.parse(row.rowId) } catch { throw new BulkDataError('Kunci baris tidak valid. Cari ulang data.') }
  if (!key || Array.isArray(key) || typeof key !== 'object' || Object.keys(key).length !== column.primary.length
    || column.primary.some(name => key[name] === undefined || key[name] === null)) throw new BulkDataError('Kunci baris tidak valid.')
  return column.primary.map(name => `t.${quote(name)} IS NOT DISTINCT FROM k.${quote(name)}`).join(' AND ')
}

// Textual identity references that are not backed by ON UPDATE CASCADE.
// Actual FK constraints remain enforced by PostgreSQL; any failure rolls back all cells.
async function cascadeIdentity(db: Database, columns: Column[], row: BulkRow, value: string) {
  const student = row.table === 'master_siswa' && row.column === 'nisn'
  const teacher = row.table === 'master_guru' && row.column === 'nip'
  if (!student && !teacher) return 0
  const old: unknown = JSON.parse(row.oldJson)
  if (typeof old !== 'string' || !old || !value.trim()) throw new BulkDataError('NISN/NIP lama dan baru tidak boleh kosong.')
  const names = student ? ['nisn','nisn_siswa','nisn_pembuat'] : ['nip','nip_guru','guru_nip']
  let changed = 0
  for (const column of columns.filter(c => names.includes(c.column) && c.table !== row.table && c.table !== 'users'
    && permitted({ ...c, primaryColumn: false, primary: ['identity-reference'] }, true))) {
    changed += await db.$executeRawUnsafe(`UPDATE ${tableSql(column.table)} t SET ${quote(column.column)}=v.${quote(column.column)}
      FROM jsonb_populate_record(NULL::${tableSql(column.table)},$1::jsonb) v WHERE t.${quote(column.column)}::text=$2`, JSON.stringify({ [column.column]: value }), old)
  }
  if (columns.some(c => c.table === 'users' && c.column === 'nip')) {
    changed += await db.$executeRawUnsafe(`UPDATE public.users SET nip=$1,username=CASE WHEN username=$2 THEN $1 ELSE username END WHERE nip=$2`, value, old)
  }
  return changed
}

export async function replaceBulkData(input: unknown, admin: boolean, db = prisma, actor?: { authId: string; nip: string; nama: string; roles: string[] }) {
  const rows = validateRows(input)
  const cascades = new Map<string, string>()
  for (const row of rows) if ((row.table === 'master_siswa' && row.column === 'nisn') || (row.table === 'master_guru' && row.column === 'nip')) {
    const old = JSON.parse(row.oldJson)
    if (typeof old !== 'string' || !old || !row.newValue?.trim() || ['null','""'].includes(row.newValue)) throw new BulkDataError('NISN/NIP lama dan baru tidak boleh kosong.')
    const key = `${row.column}:${old}`
    if (cascades.has(key) && cascades.get(key) !== row.newValue) throw new BulkDataError('Identitas yang sama tidak boleh diganti ke dua nilai berbeda.')
    cascades.set(key, row.newValue!)
  }
  for (const [key, value] of cascades) if (cascades.has(`${key.split(':')[0]}:${value}`)) throw new BulkDataError('Penggantian identitas saling bertabrakan. Proses identitas tersebut secara terpisah.')
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='5s'")
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='20s'")
    const columns = await catalog(tx)
    for (const identity of rows.filter(r => (r.table === 'master_siswa' && r.column === 'nisn') || (r.table === 'master_guru' && r.column === 'nip'))) {
      const references = identity.column === 'nisn' ? ['nisn','nisn_siswa','nisn_pembuat'] : ['nip','nip_guru','guru_nip']
      for (const selected of rows) if ((references.includes(selected.column) || (selected.table === 'users' && ['nip','username'].includes(selected.column)))
        && selected.oldJson === identity.oldJson && selected.newValue !== identity.newValue) throw new BulkDataError('Nilai baru identitas dan referensinya harus sama.')
    }
    const tables = [...new Set(rows.map(r => r.table))].sort()
    for (const table of tables) {
      if (rows.filter(r => r.table === table).some(r => !columns.some(c => c.table === table && c.column === r.column && permitted(c, admin)))) throw new BulkDataError('Tabel atau kolom tidak diizinkan.', 403)
    }
    // Lock all candidate data before writes. Stable ordering also avoids deadlocks.
    const locked = new Set<string>()
    for (const row of [...rows].sort((a,b) => rowKey(a.table,a.rowId,a.column).localeCompare(rowKey(b.table,b.rowId,b.column)))) {
      const column = columns.find(c => c.table === row.table && c.column === row.column)!
      const where = locator(row, column)
      const existing = await tx.$queryRawUnsafe<Array<{ oldJson: string }>>(`SELECT COALESCE(to_jsonb(t.${quote(row.column)})::text,'null') AS "oldJson"
        FROM ${tableSql(row.table)} t,jsonb_populate_record(NULL::${tableSql(row.table)},$1::jsonb) k WHERE ${where} FOR UPDATE OF t`, row.rowId)
      if (existing.length !== 1 || existing[0].oldJson !== row.oldJson) throw new BulkDataError('Data telah berubah sejak pratinjau. Cari ulang sebelum mengganti.', 409)
      locked.add(row.id)
    }
    let related = 0
    // Apply identity cascades before duplicate selected references. Row locations
    // use real primary keys rather than mutable NIP/NISN labels.
    const identities = rows.filter(r => (r.table === 'master_siswa' && r.column === 'nisn') || (r.table === 'master_guru' && r.column === 'nip'))
    const ordered = [...identities, ...rows.filter(r => !identities.includes(r))]
    for (const row of ordered) {
      const column = columns.find(c => c.table === row.table && c.column === row.column)!
      const data = replacement(column, row.newValue!)
      const affected = await tx.$executeRawUnsafe(`UPDATE ${tableSql(row.table)} t SET ${quote(row.column)}=v.${quote(row.column)}
        FROM jsonb_populate_record(NULL::${tableSql(row.table)},$1::jsonb) k,jsonb_populate_record(NULL::${tableSql(row.table)},$2::jsonb) v
        WHERE ${locator(row, column)}`, row.rowId, `{${JSON.stringify(row.column)}:${data}}`)
      if (affected !== 1) throw new BulkDataError('Jumlah baris berubah tidak sesuai. Seluruh perubahan dibatalkan.', 409)
      related += await cascadeIdentity(tx, columns, row, row.newValue!)
    }
    if (actor) await tx.audit_logs.create({ data: {
      user_id: actor.authId.slice(0,100), user_nip: actor.nip.slice(0,50), user_name: actor.nama.slice(0,100), user_role: actor.roles.join(',').slice(0,100),
      action: 'BULK_REPLACE', entity: 'pengaturan-data',
      details: { cells: rows.map(r => ({ table: r.table, column: r.column, key: r.rowId })), relatedUpdated: related },
    } })
    return { ok: true, updated: locked.size, failed: 0, relatedUpdated: related,
      results: rows.map(r => ({ id: r.id, table: r.table, column: r.column, rowId: r.rowId, status: 'ok' })),
      message: `Berhasil memperbarui ${locked.size} sel dan ${related} baris terkait.` }
  }, { maxWait: 10000, timeout: 90000 })
}
