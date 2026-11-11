import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

type CommitteeRow = {
    id: string;
    title: string;
    owner_name: string;
    start_date: Date;
    end_date: Date;
    proposed_total: string | null;
    item_count: number;
    total: string;
    paid: string;
};

export async function GET() {
    try {
        // This is a public monitoring page. Return only summary fields, never
        // proposal files, item attachments, payment proofs, or audit history.
        const rows = await prisma.$queryRaw<CommitteeRow[]>`
            SELECT a.id, a.title, a.owner_name, a.start_date, a.end_date,
                   a.proposed_total::text AS proposed_total,
                   coalesce(items.item_count, 0)::int AS item_count,
                   coalesce(items.total, 0)::text AS total,
                   coalesce(payments.paid, 0)::text AS paid
            FROM committee_activities a
            LEFT JOIN (
                SELECT t.activity_id, count(i.id)::int AS item_count, sum(i.amount) AS total
                FROM committee_terms t
                JOIN committee_items i ON i.term_id = t.id
                GROUP BY t.activity_id
            ) items ON items.activity_id = a.id
            LEFT JOIN (
                SELECT t.activity_id, sum(p.amount) AS paid
                FROM committee_terms t
                JOIN committee_items i ON i.term_id = t.id
                JOIN committee_payments p ON p.item_id = i.id
                WHERE p.voided_at IS NULL AND p.flow <> 'PJ_ADVANCE'
                GROUP BY t.activity_id
            ) payments ON payments.activity_id = a.id
            ORDER BY a.start_date DESC, a.created_at DESC
            LIMIT 500
        `;
        const data = rows.map(row => ({
            ...row,
            start_date: row.start_date.toISOString().slice(0, 10),
            end_date: row.end_date.toISOString().slice(0, 10),
        }));
        return corsResponse(NextResponse.json({ ok: true, data }), { publicRead: true });
    } catch (error) {
        console.error('[monitoring/laporan/komite GET] error:', error);
        return corsResponse(NextResponse.json({ ok: false, error: 'Gagal memuat pengajuan komite.' }, { status: 500 }), { publicRead: true });
    }
}

export async function OPTIONS() {
    return handleOptions();
}
