import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { isTreasurer, requireStaff } from './payment-access';
import { committeeFileUrl } from './committee.service';

/** Replace evidence only: historical payment dates and amounts remain authoritative. */
export async function updatePaymentProof(db: any, user: any, body: any) {
  const actor = requireStaff(user);
  if (!isTreasurer(user)) throw new ForbiddenException('Hanya Bendahara Komite/Admin yang dapat mengganti bukti pembayaran.');
  const models: Record<string, string> = { KLINIK: 'klinik_slots', GURU_ASUH: 'laporan_guru_asuh_submissions', EKSKUL: 'laporan_ekskul_submissions' };
  if (!Object.prototype.hasOwnProperty.call(models, body.kind) || typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new BadRequestException('Pembayaran tidak valid.');
  if (body.expectedNote !== null && typeof body.expectedNote !== 'string') throw new BadRequestException('Muat ulang data pembayaran.');
  const url = typeof body.url === 'string' && /^\/api\/pembayaran-massal\/bukti\?id=[0-9a-f-]{36}$/i.test(body.url) ? body.url : committeeFileUrl(body.url);
  if (typeof body.text !== 'string' || body.text.length > 1000) throw new BadRequestException('Catatan maksimal 1000 karakter.');
  try {
    return await db.$transaction(async (tx: any) => {
      const model = tx[models[body.kind]];
      const row = await model.findUnique({ where: { id: body.id } });
      if (!row) throw new NotFoundException('Pembayaran tidak ditemukan.');
      const paid = body.kind === 'KLINIK' ? { status: 'paid' } : { dibayarkan: true };
      if ((body.kind === 'KLINIK' ? row.status !== 'paid' : !row.dibayarkan) || row.catatan_pembayaran !== body.expectedNote) throw new ConflictException('Pembayaran berubah. Muat ulang data.');
      let previous: any = {};
      try { previous = JSON.parse(row.catatan_pembayaran || '{}'); } catch { previous = { text: row.catatan_pembayaran || '' }; }
      if (!previous || typeof previous !== 'object' || Array.isArray(previous)) previous = {};
      const history = Array.isArray(previous.proof_history) ? previous.proof_history : [];
      const catatan = JSON.stringify({ ...previous, text: body.text.trim(), url,
        proof_history: [...history, { url: previous.url || '', text: previous.text || '', replaced_at: new Date().toISOString(), actor_id: actor }] });
      const result = await model.updateMany({ where: { id: body.id, ...paid, catatan_pembayaran: body.expectedNote }, data: { catatan_pembayaran: catatan } });
      if (result.count !== 1) throw new ConflictException('Pembayaran berubah. Muat ulang data.');
      return { ok: true };
    }, { isolationLevel: 'Serializable' });
  } catch (e: any) {
    if (e.code === 'P2034' || e.meta?.code === '40001') throw new ConflictException('Pembayaran sedang diperbarui. Muat ulang data.');
    throw e;
  }
}
