import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj?.toNumber === 'function') return obj.toNumber();
  if (typeof obj?.toFixed === 'function') return Number(obj.toFixed());
  if (Prisma.Decimal.isDecimal(obj)) return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj.toISOString();
    if (typeof obj.toNumber === 'function') return obj.toNumber();
    if (typeof obj.toFixed === 'function') return Number(obj.toFixed());
    if (Prisma.Decimal.isDecimal(obj)) return obj.toNumber();
    if (typeof obj.s === 'number' && typeof obj.e === 'number' && Array.isArray(obj.d)) {
      try {
        Object.setPrototypeOf(obj, Prisma.Decimal.prototype);
        return obj.toNumber();
      } catch {
        const sign = obj.s < 0 ? -1 : 1;
        return Number(obj.d.join('')) * sign;
      }
    }
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeBigInt(v);
    }
    return res;
  }
  return obj;
}

/**
 * Kutip nama kolom/tabel untuk disisipkan ke SQL, setelah memastikan bentuknya sah.
 *
 * Nilai selalu diparameterkan ($1, $2, ...), tetapi IDENTIFIER tidak bisa —
 * Postgres tidak menerima parameter di posisi nama kolom. Jadi identifier disisipkan
 * sebagai teks, dan itulah satu-satunya jalan masuk injeksi di adapter ini.
 *
 * Ditemukan lewat `POST /api/reset-data/replace`, yang meneruskan `tableKey` dari
 * body permintaan langsung ke `.eq()` tanpa divalidasi — hanya `table` dan `column`
 * yang dicek ke daftar izin. Nilai seperti `id" OR 1=1 --` akan keluar dari tanda
 * kutip dan mengubah klausa WHERE sebuah UPDATE.
 *
 * Diperiksa di sini, bukan di pemanggil, supaya seluruh pemakai adapter (keuangan,
 * klinik, reset-data) ikut terlindungi sekaligus.
 */
function kutipIdentifier(nama: string): string {
  const bersih = String(nama ?? '');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(bersih)) {
    throw new Error(`Nama kolom/tabel tidak sah: ${JSON.stringify(nama)}`);
  }
  return `"${bersih}"`;
}

/**
 * Kolom PostgreSQL bertipe khusus (date, time) yang membutuhkan casting eksplisit
 * saat nilainya dikirimkan sebagai teks/string melalui parameter Prisma $queryRawUnsafe.
 *
 * PostgreSQL melempar galat 42804 bila parameter string dimasukkan langsung ke kolom date/time:
 * "ERROR: column "tanggal" is of type date but expression is of type text"
 */
function getColumnCast(table: string, column: string): string {
  const c = column.toLowerCase();
  const t = table.toLowerCase();

  // 1. Kolom DATE
  if (
    c === 'tanggal' ||
    c === 'tanggal_lahir' ||
    c === 'tanggal_surat' ||
    c === 'tanggal_ttd' ||
    c === 'tanggal_mulai' ||
    c === 'tanggal_selesai' ||
    (t === 'perizinan' && (c === 'tanggal_mulai' || c === 'tanggal_selesai')) ||
    (t === 'klinik_slots' && c === 'tanggal') ||
    (t === 'catatan_siswa' && c === 'tanggal') ||
    c === 'tgl_mulai' ||
    c === 'tgl_selesai' ||
    c === 'tgl_awal' ||
    c === 'tgl_akhir' ||
    c === 'tmt_tugas' ||
    c === 'berlaku_mulai'
  ) {
    return '::date';
  }

  // 2. Kolom TIME
  if (
    c === 'jam_mulai' ||
    c === 'jam_selesai' ||
    (t === 'catatan_pelanggaran' && c === 'waktu')
  ) {
    return '::time';
  }

  // 3. Kolom BIGINT
  if (
    c === 'guru_id' ||
    c === 'siswa_id' ||
    c === 'user_id' ||
    c === 'initiator_siswa_id' ||
    c === 'dibuat_oleh' ||
    c === 'kehadiran_oleh' ||
    c === 'shared_with_user_id' ||
    c === 'guru_asuh_id' ||
    c === 'pj_user_id' ||
    c === 'jadwal_id' ||
    c === 'jurnal_id' ||
    c === 'jadwal_versi_id' ||
    c === 'tahun_ajaran_id' ||
    c === 'tugas_id' ||
    c === 'size_bytes' ||
    c === 'file_size' ||
    (t === 'klinik_laporan' && c === 'approved_by') ||
    (t === 'budget_mutations' && c === 'created_by') ||
    ((t === 'users' ||
      t === 'public_users' ||
      t === 'master_siswa' ||
      t === 'master_guru' ||
      t === 'master_kelas' ||
      t === 'master_mapel' ||
      t === 'master_tahun_ajaran' ||
      t === 'master_waktu' ||
      t === 'siswa_kelas' ||
      t === 'siswa_kelompok' ||
      t === 'wali_kelas' ||
      t === 'guru_mapel' ||
      t === 'guru_asuh' ||
      t === 'jadwal_guru' ||
      t === 'jadwal_versi' ||
      t === 'jadwal_piket' ||
      t === 'libur' ||
      t === 'pengumuman' ||
      t === 'tugas_siswa') &&
      c === 'id')
  ) {
    return '::bigint';
  }

  // 4. Kolom UUID
  if (
    c === 'slot_id' ||
    c === 'ekskul_id' ||
    c === 'pertemuan_id' ||
    c === 'division_id' ||
    c === 'counterpart_division_id' ||
    c === 'budget_request_id' ||
    c === 'recipient_user_id' ||
    (t === 'laporan_ekskul_submissions' && c === 'approved_by') ||
    ((t === 'klinik_slots' ||
      t === 'klinik_peserta' ||
      t === 'klinik_laporan' ||
      t === 'notifications' ||
      t === 'divisions' ||
      t === 'division_budgets' ||
      t === 'budget_mutations' ||
      t === 'budget_requests' ||
      t === 'budget_request_items' ||
      t === 'approval_logs' ||
      t === 'budget_request_registers' ||
      t === 'disbursements' ||
      t === 'receipt_submissions' ||
      t === 'ekskul' ||
      t === 'ekskul_pertemuan' ||
      t === 'laporan_ekskul_submissions') &&
      c === 'id')
  ) {
    return '::uuid';
  }

  return '';
}

export class PostgresQueryBuilder {
  private table: string;
  private prisma: PrismaService;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selectColumns = '*';
  private countOption: string | null = null;
  private headOption = false;
  private conditions: string[] = [];
  private orderClauses: string[] = [];
  private limitVal: number | null = null;
  private offsetVal: number | null = null;
  private insertData: any = null;
  private updateData: any = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private params: any[] = [];

  constructor(table: string, prismaClient: PrismaService) {
    this.table = table;
    this.prisma = prismaClient;
  }

  select(columns = '*', options: { count?: string; head?: boolean } = {}) {
    this.selectColumns = columns;
    if (options.count) this.countOption = options.count;
    if (options.head) this.headOption = options.head;
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    if (value === null || value === undefined) {
      this.conditions.push(`${kutipIdentifier(column)} IS NULL`);
    } else {
      this.params.push(value);
      const cast = getColumnCast(this.table, column);
      this.conditions.push(`${kutipIdentifier(column)} = $${this.params.length}${cast}`);
    }
    return this;
  }

  neq(column: string, value: any) {
    if (value === null || value === undefined) {
      this.conditions.push(`${kutipIdentifier(column)} IS NOT NULL`);
    } else {
      this.params.push(value);
      const cast = getColumnCast(this.table, column);
      this.conditions.push(`${kutipIdentifier(column)} != $${this.params.length}${cast}`);
    }
    return this;
  }

  gt(column: string, value: any) {
    this.params.push(value);
    const cast = getColumnCast(this.table, column);
    this.conditions.push(`${kutipIdentifier(column)} > $${this.params.length}${cast}`);
    return this;
  }

  gte(column: string, value: any) {
    this.params.push(value);
    const cast = getColumnCast(this.table, column);
    this.conditions.push(`${kutipIdentifier(column)} >= $${this.params.length}${cast}`);
    return this;
  }

  lt(column: string, value: any) {
    this.params.push(value);
    const cast = getColumnCast(this.table, column);
    this.conditions.push(`${kutipIdentifier(column)} < $${this.params.length}${cast}`);
    return this;
  }

  lte(column: string, value: any) {
    this.params.push(value);
    const cast = getColumnCast(this.table, column);
    this.conditions.push(`${kutipIdentifier(column)} <= $${this.params.length}${cast}`);
    return this;
  }

  in(column: string, values: any[]) {
    const arr = Array.isArray(values) ? values : [values];
    if (arr.length === 0) {
      this.conditions.push('1 = 0');
      return this;
    }
    const cast = getColumnCast(this.table, column);
    const placeholders = arr.map((v) => {
      this.params.push(v);
      return `$${this.params.length}${cast}`;
    });
    this.conditions.push(`${kutipIdentifier(column)} IN (${placeholders.join(', ')})`);
    return this;
  }

  is(column: string, value: any) {
    if (value === null) {
      this.conditions.push(`${kutipIdentifier(column)} IS NULL`);
    } else if (value === true) {
      this.conditions.push(`${kutipIdentifier(column)} IS TRUE`);
    } else if (value === false) {
      this.conditions.push(`${kutipIdentifier(column)} IS FALSE`);
    }
    return this;
  }

  like(column: string, pattern: string) {
    this.params.push(pattern);
    this.conditions.push(`${kutipIdentifier(column)} LIKE $${this.params.length}`);
    return this;
  }

  ilike(column: string, pattern: string) {
    this.params.push(pattern);
    this.conditions.push(`${kutipIdentifier(column)} ILIKE $${this.params.length}`);
    return this;
  }

  or(conditionString: string) {
    const parts = conditionString.split(',').map((p) => p.trim());
    const orSub: string[] = [];
    for (const part of parts) {
      const match = part.match(/^([a-zA-Z0-9_]+)\.([a-z]+)\.(.*)$/);
      if (match) {
        const [, col, op, val] = match;
        const cast = getColumnCast(this.table, col);
        // Operator yang tidak dikenal DILEWATI dengan sengaja di bawah, tapi
        // kalau SEMUA bagian terlewat, `or()` tidak menambahkan kondisi apa pun
        // dan filternya hilang diam-diam — query berubah jadi "ambil semua".
        // `ilike`/`like` dulu termasuk yang terlewat, sehingga kotak pencarian
        // siswa di klinik mengembalikan seluruh baris alih-alih yang cocok.
        if (op === 'eq') {
          this.params.push(val);
          orSub.push(`${kutipIdentifier(col)} = $${this.params.length}${cast}`);
        } else if (op === 'neq') {
          this.params.push(val);
          orSub.push(`${kutipIdentifier(col)} != $${this.params.length}${cast}`);
        } else if (op === 'ilike') {
          this.params.push(val);
          orSub.push(`${kutipIdentifier(col)} ILIKE $${this.params.length}`);
        } else if (op === 'like') {
          this.params.push(val);
          orSub.push(`${kutipIdentifier(col)} LIKE $${this.params.length}`);
        } else {
          throw new Error(`or(): operator "${op}" belum didukung adapter (bagian: ${part})`);
        }
      }
    }
    if (orSub.length > 0) {
      this.conditions.push(`(${orSub.join(' OR ')})`);
    }
    return this;
  }

  order(column: string, { ascending = true, nullsFirst }: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const dir = ascending ? 'ASC' : 'DESC';
    let nulls = '';
    if (nullsFirst !== undefined) nulls = nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
    this.orderClauses.push(`${kutipIdentifier(column)} ${dir}${nulls}`);
    return this;
  }

  range(from: number, to: number) {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }

  limit(count: number) {
    this.limitVal = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private _parseSelect(table: string, columnsStr: string): string[] {
    if (!columnsStr || columnsStr === '*') return ['*'];

    const tokens: string[] = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < columnsStr.length; i++) {
      const char = columnsStr[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    const result: string[] = [];
    for (const token of tokens) {
      // Handles alias:field(subfields) e.g. divisions:division_id(name) or simple relation users(nama)
      const relMatch = token.match(/^(?:([a-zA-Z0-9_]+):)?([a-zA-Z0-9_]+)\((.*)\)$/);
      if (relMatch) {
        const alias = relMatch[1] || relMatch[2];
        const relOrFk = relMatch[2];
        const innerColsStr = relMatch[3].trim();
        const innerCols = innerColsStr === '*' ? ['*'] : innerColsStr.split(',').map((c) => c.trim()).filter(Boolean);

        const subJson =
          innerCols[0] === '*'
            ? `row_to_json(sub_${alias})`
            : `json_build_object(${innerCols.map((c) => `'${c}', sub_${alias}.${kutipIdentifier(c)}`).join(', ')})`;

        // Explicit known joins for financial and klinik modules
        if (table === 'financial_officers' && alias === 'users') {
          result.push(`(SELECT json_build_object('nama', sub_users."nama", 'username', sub_users."username") FROM public.users sub_users WHERE sub_users.id = "${table}".user_id) as "${alias}"`);
        } else if (table === 'financial_officers' && alias === 'divisions') {
          result.push(`(SELECT json_build_object('name', sub_divisions."name") FROM public.divisions sub_divisions WHERE sub_divisions.id = "${table}".division_id) as "${alias}"`);
        } else if (table === 'division_budgets' && alias === 'divisions') {
          result.push(`(SELECT json_build_object('name', sub_divisions."name") FROM public.divisions sub_divisions WHERE sub_divisions.id = "${table}".division_id) as "${alias}"`);
        } else if (table === 'budget_mutations' && alias === 'divisions') {
          result.push(`(SELECT json_build_object('name', sub_divisions."name") FROM public.divisions sub_divisions WHERE sub_divisions.id = "${table}".division_id) as "${alias}"`);
        } else if (table === 'budget_mutations' && alias === 'counterpart') {
          result.push(`(SELECT json_build_object('name', sub_divisions."name") FROM public.divisions sub_divisions WHERE sub_divisions.id = "${table}".counterpart_division_id) as "${alias}"`);
        } else if (table === 'budget_mutations' && alias === 'users') {
          result.push(`(SELECT json_build_object('nama', sub_users."nama") FROM public.users sub_users WHERE sub_users.id = "${table}".created_by) as "${alias}"`);
        } else if (table === 'budget_requests' && alias === 'divisions') {
          result.push(`(SELECT json_build_object('name', sub_divisions."name") FROM public.divisions sub_divisions WHERE sub_divisions.id = "${table}".division_id) as "${alias}"`);
        } else if (table === 'budget_requests' && alias === 'users') {
          result.push(`(SELECT json_build_object('nama', sub_users."nama") FROM public.users sub_users WHERE sub_users.id = "${table}".pj_user_id) as "${alias}"`);
        } else if (table === 'budget_requests' && ['budget_request_items', 'approval_logs', 'budget_request_registers', 'disbursements', 'receipt_submissions'].includes(alias)) {
          result.push(`(SELECT COALESCE(json_agg(${subJson}), '[]'::json) FROM public."${alias}" sub_${alias} WHERE sub_${alias}.budget_request_id = "${table}".id) as "${alias}"`);
        } else if (table === 'klinik_slots' && alias === 'klinik_peserta') {
          result.push(`(SELECT COALESCE(json_agg(${subJson}), '[]'::json) FROM public.klinik_peserta sub_${alias} WHERE sub_${alias}.slot_id = "${table}".id) as "${alias}"`);
        } else {
          // Generic heuristic: try sub query by table_id or id
          result.push(`(SELECT ${subJson} FROM public."${relOrFk}" sub_${alias} WHERE sub_${alias}.id = "${table}"."${relOrFk}_id") as "${alias}"`);
        }
      } else if (token === '*') {
        result.push(`"${table}".*`);
      } else {
        result.push(`"${table}"."${token}"`);
      }
    }
    return result;
  }

  async _execute(): Promise<{ data: any; error: any; count?: number | null }> {
    try {
      let count: number | null = null;
      if (this.countOption) {
        let countSql = `SELECT COUNT(*)::int as count FROM public.${kutipIdentifier(this.table)}`;
        if (this.conditions.length > 0) {
          countSql += ` WHERE ${this.conditions.join(' AND ')}`;
        }
        const countRes: any = await this.prisma.$queryRawUnsafe(countSql, ...this.params);
        count = countRes[0]?.count ?? 0;
        if (this.headOption) {
          return { data: null, error: null, count };
        }
      }

      if (this.operation === 'select') {
        const selectFields = this._parseSelect(this.table, this.selectColumns).join(', ');
        let sql = `SELECT ${selectFields} FROM public.${kutipIdentifier(this.table)} ${kutipIdentifier(this.table)}`;
        if (this.conditions.length > 0) {
          sql += ` WHERE ${this.conditions.join(' AND ')}`;
        }
        if (this.orderClauses.length > 0) {
          sql += ` ORDER BY ${this.orderClauses.join(', ')}`;
        }
        if (this.limitVal !== null) {
          sql += ` LIMIT ${this.limitVal}`;
        }
        if (this.offsetVal !== null) {
          sql += ` OFFSET ${this.offsetVal}`;
        }

        const rows: any = await this.prisma.$queryRawUnsafe(sql, ...this.params);
        const serialized = serializeBigInt(rows);

        if (this.isSingle) {
          if (!serialized || serialized.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count };
          }
          return { data: serialized[0], error: null, count };
        }
        if (this.isMaybeSingle) {
          return { data: serialized && serialized.length > 0 ? serialized[0] : null, error: null, count };
        }
        return { data: serialized, error: null, count };
      }

      if (this.operation === 'insert') {
        const records = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        if (records.length === 0) return { data: [], error: null };

        const allInserted: any[] = [];
        for (const row of records) {
          const keys = Object.keys(row);
          const cols = keys.map((k) => `${kutipIdentifier(k)}`).join(', ');
          const rowParams: any[] = [];
          const placeholders = keys
            .map((k, idx) => {
              rowParams.push(row[k]);
              const cast = getColumnCast(this.table, k);
              return `$${idx + 1}${cast}`;
            })
            .join(', ');

          const sql = `INSERT INTO public.${kutipIdentifier(this.table)} (${cols}) VALUES (${placeholders}) RETURNING *`;
          const res: any = await this.prisma.$queryRawUnsafe(sql, ...rowParams);
          if (res && res[0]) allInserted.push(res[0]);
        }

        const serialized = serializeBigInt(allInserted);
        if (this.isSingle) {
          return { data: serialized[0] || null, error: null };
        }
        return { data: Array.isArray(this.insertData) ? serialized : (serialized[0] || null), error: null };
      }

      if (this.operation === 'update') {
        const keys = Object.keys(this.updateData);
        if (keys.length === 0) return { data: null, error: null };

        const setClauses: string[] = [];
        const updateParams: any[] = [];
        for (const k of keys) {
          updateParams.push(this.updateData[k]);
          const cast = getColumnCast(this.table, k);
          setClauses.push(`${kutipIdentifier(k)} = $${updateParams.length}${cast}`);
        }

        let sql = `UPDATE public.${kutipIdentifier(this.table)} SET ${setClauses.join(', ')}`;
        if (this.conditions.length > 0) {
          const offset = updateParams.length;
          const adjustedConditions = this.conditions.map((c) => {
            return c.replace(/\$(\d+)/g, (_, num) => `$${parseInt(num) + offset}`);
          });
          sql += ` WHERE ${adjustedConditions.join(' AND ')}`;
        }
        sql += ` RETURNING *`;

        const totalParams = [...updateParams, ...this.params];
        const res: any = await this.prisma.$queryRawUnsafe(sql, ...totalParams);
        const serialized = serializeBigInt(res);

        if (this.isSingle) {
          return { data: serialized[0] || null, error: null };
        }
        if (this.isMaybeSingle) {
          return { data: serialized[0] || null, error: null };
        }
        return { data: serialized, error: null };
      }

      if (this.operation === 'delete') {
        let sql = `DELETE FROM public.${kutipIdentifier(this.table)}`;
        if (this.conditions.length > 0) {
          sql += ` WHERE ${this.conditions.join(' AND ')}`;
        }
        sql += ` RETURNING *`;

        const res: any = await this.prisma.$queryRawUnsafe(sql, ...this.params);
        const serialized = serializeBigInt(res);
        return { data: serialized, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error('PostgresQueryBuilder Error on table', this.table, err);
      return { data: null, error: err };
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any): Promise<any> {
    return this._execute().then(onfulfilled, onrejected);
  }
}

export function createPrismaDbAdapter(prisma: PrismaService) {
  return {
    from(table: string) {
      return new PostgresQueryBuilder(table, prisma);
    },
  };
}

/**
 * Tipe objek adapter, untuk dipakai di anotasi parameter.
 *
 * Sebelumnya `klinik.service.ts` menganotasi parameternya dengan
 * `ReturnType<typeof getSupabaseAdmin>` — simbol yang tidak pernah ada di berkas
 * itu maupun diimpor dari mana pun. Anotasi itu lolos hanya karena `@ts-nocheck`
 * di baris pertama, jadi efektifnya tanpa tipe sama sekali.
 */
export type PrismaDbAdapter = ReturnType<typeof createPrismaDbAdapter>;
