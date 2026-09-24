import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET(request: NextRequest) {
    let pool: Pool | null = null;
    try {
        if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
            throw new Error("No database connection string provided in environment.");
        }
        
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
        });
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sv_master_tahap (
                id SERIAL PRIMARY KEY,
                nama_tahap VARCHAR NOT NULL,
                urutan INT DEFAULT 0,
                aktif BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE sv_penugasan ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
            
            ALTER TABLE sv_master_dokumen ADD COLUMN IF NOT EXISTS butuh_dokumen BOOLEAN DEFAULT true;
        `);
        
        return NextResponse.json({ ok: true, message: 'Migration successful' });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    } finally {
        if (pool) await pool.end();
    }
}
