import { NextRequest } from 'next/server';
import { proxy } from '@/lib/nest-proxy';
export const dynamic = 'force-dynamic';
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy(req, `/jadwal/sementara/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
