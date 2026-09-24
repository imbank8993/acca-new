const path = require('path');
const fs = require('fs');

// Load backend/.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class PostgresQueryBuilder {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.operation = 'select';
    this.selectCols = '*';
    this.whereClauses = [];
    this.values = [];
    this.orderClauses = [];
    this.limitCount = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.insertPayload = null;
    this.updatePayload = null;
  }

  select(cols = '*', options = {}) {
    if (this.operation === 'select') {
      this.selectCols = cols;
    }
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.insertPayload = data;
    return this;
  }

  update(data) {
    this.operation = 'update';
    this.updatePayload = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(col, val) {
    if (val === null || val === undefined) {
      this.whereClauses.push(`"${col}" IS NULL`);
    } else {
      this.values.push(val);
      this.whereClauses.push(`"${col}" = $${this.values.length}`);
    }
    return this;
  }

  neq(col, val) {
    if (val === null || val === undefined) {
      this.whereClauses.push(`"${col}" IS NOT NULL`);
    } else {
      this.values.push(val);
      this.whereClauses.push(`"${col}" != $${this.values.length}`);
    }
    return this;
  }

  in(col, vals) {
    if (!Array.isArray(vals) || vals.length === 0) {
      this.whereClauses.push('1 = 0');
    } else {
      this.values.push(vals);
      this.whereClauses.push(`"${col}" = ANY($${this.values.length})`);
    }
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orderClauses.push(`"${col}" ${ascending ? 'ASC' : 'DESC'}`);
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    this.limitCount = 1;
    return this;
  }

  async execute() {
    try {
      let query = '';
      const vals = [...this.values];

      if (this.operation === 'select') {
        query = `SELECT ${this.selectCols} FROM "${this.table}"`;
        if (this.whereClauses.length > 0) {
          query += ` WHERE ${this.whereClauses.join(' AND ')}`;
        }
        if (this.orderClauses.length > 0) {
          query += ` ORDER BY ${this.orderClauses.join(', ')}`;
        }
        if (this.limitCount) {
          query += ` LIMIT ${this.limitCount}`;
        }
      } else if (this.operation === 'insert') {
        const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
        if (rows.length === 0) return { data: [], error: null };

        const cols = Object.keys(rows[0]);
        const valuePlaceholders = [];
        const insertVals = [];

        for (const row of rows) {
          const rowPlaceholders = [];
          for (const col of cols) {
            insertVals.push(row[col]);
            rowPlaceholders.push(`$${insertVals.length}`);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        query = `INSERT INTO "${this.table}" ("${cols.join('", "')}") VALUES ${valuePlaceholders.join(', ')} RETURNING *`;
        const res = await this.pool.query(query, insertVals);
        const data = Array.isArray(this.insertPayload) ? res.rows : (res.rows[0] || null);
        return { data, error: null };
      } else if (this.operation === 'update') {
        const cols = Object.keys(this.updatePayload);
        const setClauses = [];
        const updateVals = [];

        for (const col of cols) {
          updateVals.push(this.updatePayload[col]);
          setClauses.push(`"${col}" = $${updateVals.length}`);
        }

        const offset = updateVals.length;
        const whereSql = this.whereClauses.map(clause => {
          return clause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num, 10) + offset}`);
        });

        query = `UPDATE "${this.table}" SET ${setClauses.join(', ')}`;
        if (whereSql.length > 0) {
          query += ` WHERE ${whereSql.join(' AND ')}`;
        }
        query += ` RETURNING *`;

        const res = await this.pool.query(query, [...updateVals, ...vals]);
        const data = this.isSingle || this.isMaybeSingle ? (res.rows[0] || null) : res.rows;
        return { data, error: null };
      } else if (this.operation === 'delete') {
        query = `DELETE FROM "${this.table}"`;
        if (this.whereClauses.length > 0) {
          query += ` WHERE ${this.whereClauses.join(' AND ')}`;
        }
        query += ` RETURNING *`;
        const res = await this.pool.query(query, vals);
        return { data: res.rows, error: null };
      }

      const res = await this.pool.query(query, vals);
      if (this.isSingle) {
        if (res.rows.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
        }
        return { data: res.rows[0], error: null };
      }
      if (this.isMaybeSingle) {
        return { data: res.rows[0] || null, error: null };
      }
      return { data: res.rows, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

async function test() {
  console.log('Testing PostgresQueryBuilder on VPS database...');
  const from = (table) => new PostgresQueryBuilder(pool, table);

  // Test 1: SELECT from catatan_keuangan
  const { data: ck, error: ckErr } = await from('catatan_keuangan').select('*').limit(3);
  console.log('1. Catatan Keuangan records:', ck?.length, 'error:', ckErr);

  // Test 2: SELECT from klinik_slots
  const { data: slots, error: slotsErr } = await from('klinik_slots').select('*').limit(3);
  console.log('2. Klinik Slots records:', slots?.length, 'error:', slotsErr);

  // Test 3: SELECT from users single
  const { data: user, error: userErr } = await from('users').select('id, nama, nip').eq('id', 4708).maybeSingle();
  console.log('3. User 4708:', user?.nama, 'error:', userErr);

  await pool.end();
  console.log('Done!');
}

test().catch(console.error);
