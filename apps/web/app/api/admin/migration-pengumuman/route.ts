import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    let pool: Pool | null = null;
    try {
        if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
            return NextResponse.json({
                ok: false,
                error: 'No database connection string (DATABASE_URL or POSTGRES_URL) found in environment.'
            }, { status: 500 });
        }

        pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
        });

        // Read migration file
        const migrationPath = path.join(process.cwd(), 'sql', 'create_pengumuman.sql');
        if (!fs.existsSync(migrationPath)) {
            return NextResponse.json({ ok: false, error: 'Migration SQL file not found at: ' + migrationPath }, { status: 500 });
        }
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('[Migration] Executing announcements DDL...');
        await pool.query(sql);
        console.log('[Migration] Announcements DDL executed successfully');

        return NextResponse.json({
            ok: true,
            message: 'Migration executed successfully! Table public.pengumuman and permissions created.'
        });
    } catch (error: any) {
        console.error('[Migration] Error executing DDL:', error);
        return NextResponse.json({
            ok: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}
