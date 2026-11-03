import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentCandidate, matchingReceipt, referenceKey } from './payment-rules';
import { LocalReceiptOcr } from './local-receipt-ocr';
import { canReadPayments, isTreasurer } from '../payments/payment-access';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Injectable()
export class PaymentReceiptsService {
  constructor(private prisma: PrismaService, private ocr: LocalReceiptOcr = new LocalReceiptOcr()) {}
  private owner(user: any) {
    if (!isTreasurer(user)) throw new ForbiddenException('Hanya Bendahara Komite/Admin yang dapat mengelola bukti massal.');
    const owner = user.auth_id || user.authId;
    if (typeof owner !== 'string' || !uuid.test(owner)) throw new ForbiddenException('Sesi pengguna tidak valid.');
    return owner;
  }
  private scope(body: any) {
    const { kind, month, year } = body;
    if (!['GURU_ASUH', 'KLINIK', 'EKSKUL'].includes(kind) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200) throw new BadRequestException('Pilih jenis pembayaran, bulan, dan tahun yang valid.');
    return { kind, month, year };
  }
  private async candidates(db: any, scope: { kind: string; month: number; year: number }): Promise<PaymentCandidate[]> {
    const { kind, month, year } = scope;
    const tariffs = await db.tarif_honor.findMany();
    const rate = (modul: string) => {
      const row = tariffs.find((t: any) => t.modul === modul);
      const n = Number(row?.nominal);
      return row && Number.isSafeInteger(n) && n >= 0 ? n : NaN;
    };
    const teachers = await db.master_guru.findMany({ where: { aktif: true } });
    const byNip = new Map<string, any>(teachers.map((g: any) => [g.nip, g]));
    const result: PaymentCandidate[] = [];
    const add = (nip: string, name: string, ids: string[], amount: number, label: string) => {
      if (!nip || !Number.isSafeInteger(amount) || amount <= 0) return;
      const g = byNip.get(nip);
      const accounts = [1, 2].filter(i => g && g[`rekening_${i}_aktif`] !== false && g[`rekening_${i}_nomor`]).map(i => ({ number: g[`rekening_${i}_nomor`] || '', bank: g[`rekening_${i}_nama_bank`] || '', name: g[`rekening_${i}_atas_nama`] || '' }));
      result.push({ key: `${kind}:${ids.slice().sort().join(',')}`, nip, name: name || g?.nama_lengkap || nip, label, ids: ids.slice().sort(), amount, accounts });
    };
    if (kind === 'GURU_ASUH') {
      const rows = await db.laporan_guru_asuh_submissions.findMany({ where: { bulan: month, tahun: year, status: 'Approved', dibayarkan: false } });
      rows.forEach((r: any) => add(r.nip, r.nama_guru_snap, [r.id], rate('GURU_ASUH'), 'Guru Asuh'));
    } else if (kind === 'EKSKUL') {
      const rows = await db.laporan_ekskul_submissions.findMany({ where: { bulan: month, tahun: year, status: 'Disahkan', dibayarkan: { not: true } }, include: { ekskul: true, ekskul_pertemuan: true } });
      rows.forEach((r: any) => {
        const external = r.ekskul_pertemuan.filter((p: any) => p.status_pelatih === 'Eksternal').length;
        const internal = r.ekskul_pertemuan.length - external;
        const amount = (internal ? internal * rate('EKSKUL_INTERNAL') : 0) + (external ? external * rate('EKSKUL_EKSTERNAL') : 0);
        add(r.pembina_nip, r.pembina_nama, [r.id], amount, r.ekskul?.nama_ekskul || 'Ekstrakurikuler');
      });
    } else {
      const rows = await db.klinik_slots.findMany({ where: { status: 'finished', tanggal: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) }, klinik_laporan: { some: { status: 'Approved' } } }, include: { users_klinik_slots_guru_idTousers: { select: { nip: true } } } });
      const groups = new Map<string, any[]>();
      rows.forEach((r: any) => { if (r.guru_id != null) { const key = String(r.guru_id); groups.set(key, [...(groups.get(key) || []), r]); } });
      groups.forEach(rows => add(rows[0].users_klinik_slots_guru_idTousers?.nip, rows[0].nama_guru, rows.map(r => r.id), rate('KLINIK') * rows.length, `Klinik · ${rows.length} kegiatan`));
    }
    return result;
  }
  private publicCandidate(c: PaymentCandidate) {
    return { key: c.key, nip: c.nip, name: c.name, label: c.label, amount: c.amount, ids: c.ids };
  }
  private async paidTargets(db: any, kind: string, ids: string[]) {
    const where = { id: { in: ids } };
    return kind === 'KLINIK' ? db.klinik_slots.count({ where: { ...where, status: 'paid' } }) : kind === 'GURU_ASUH' ? db.laporan_guru_asuh_submissions.count({ where: { ...where, dibayarkan: true } }) : db.laporan_ekskul_submissions.count({ where: { ...where, dibayarkan: true } });
  }
  async list(user: any, query: any) {
    const owner = this.owner(user);
    if (!uuid.test(query.batchId || '')) throw new BadRequestException('Paket pembayaran tidak valid.');
    const scope = this.scope({ kind: query.kind, month: Number(query.month), year: Number(query.year) });
    const candidates = await this.candidates(this.prisma, scope);
    const rows: any[] = await this.prisma.$queryRaw`SELECT id,filename,extracted,selected,applied_at FROM payment_receipts WHERE owner_id=${owner} AND batch_id=${query.batchId}::uuid AND kind=${scope.kind} AND month=${scope.month} AND year=${scope.year} ORDER BY created_at`;
    const receipts = await Promise.all(rows.map(async r => ({ ...r, paymentActive: r.applied_at ? await this.paidTargets(this.prisma, scope.kind, r.selected.ids) === r.selected.ids.length : false, ...matchingReceipt(r.extracted, candidates) })));
    return { ok: true, configured: this.ocr.available(), candidates: candidates.map(c => this.publicCandidate(c)), receipts };
  }
  async analyze(user: any, body: any) {
    const owner = this.owner(user);
    const scope = this.scope(body);
    if (!uuid.test(body.batchId || '') || !uuid.test(body.receiptId || '')) throw new BadRequestException('Paket pembayaran tidak valid.');
    if (typeof body.base64 !== 'string' || body.base64.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.base64)) throw new BadRequestException('Berkas gambar tidak valid (maksimal 5 MB).');
    const image = Buffer.from(body.base64, 'base64');
    const png = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = image[0] === 255 && image[1] === 216 && image[2] === 255;
    const webp = image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
    const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : '';
    if (!mime || image.length > 5 * 1024 * 1024 || image.length < 32) throw new BadRequestException('Gunakan gambar JPG, PNG, atau WEBP maksimal 5 MB.');
    const hash = createHash('sha256').update(image).digest('hex');
    await this.prisma.$executeRaw`DELETE FROM payment_receipts WHERE applied_at IS NULL AND created_at < now() - interval '7 days'`;
    const duplicate: any[] = await this.prisma.$queryRaw`SELECT id,filename,extracted,applied_at,owner_id,batch_id::text,kind,month,year FROM payment_receipts WHERE file_hash=${hash} AND (applied_at IS NOT NULL OR (owner_id=${owner} AND batch_id=${body.batchId}::uuid)) LIMIT 1`;
    if (duplicate.length) {
      const row = duplicate[0];
      if (row.id === body.receiptId && row.owner_id === owner && row.batch_id === body.batchId && row.kind === scope.kind && row.month === scope.month && row.year === scope.year) {
        const candidates = await this.candidates(this.prisma, scope);
        return { ok: true, receipt: { id: row.id, filename: row.filename, extracted: row.extracted, applied_at: row.applied_at, ...matchingReceipt(row.extracted, candidates) }, candidates: candidates.map(c => this.publicCandidate(c)) };
      }
      throw new ConflictException(row.applied_at ? 'Bukti ini sudah digunakan untuk pembayaran.' : 'Berkas ini sudah ada dalam paket.');
    }
    const count: any[] = await this.prisma.$queryRaw`SELECT count(*)::int AS total FROM payment_receipts WHERE owner_id=${owner} AND batch_id=${body.batchId}::uuid`;
    if (count[0].total >= 30) throw new BadRequestException('Maksimal 30 bukti per paket.');
    const fields = await this.ocr.extract(image);
    const ref = referenceKey(fields);
    if (ref) {
      const used: any[] = await this.prisma.$queryRaw`SELECT id FROM payment_receipts WHERE reference_key=${ref} AND (applied_at IS NOT NULL OR (owner_id=${owner} AND batch_id=${body.batchId}::uuid)) LIMIT 1`;
      if (used.length) throw new ConflictException('Referensi transaksi ini sudah digunakan atau sudah ada dalam paket.');
    }
    const candidates = await this.candidates(this.prisma, scope);
    const id = body.receiptId;
    const filename = typeof body.filename === 'string' ? body.filename.slice(0, 200) : 'Bukti transfer';
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${owner + body.batchId})::bigint)::text`;
      const staged: any[] = await tx.$queryRaw`SELECT kind,month,year,reference_key,file_hash FROM payment_receipts WHERE owner_id=${owner} AND batch_id=${body.batchId}::uuid`;
      if (staged.length >= 30 || staged.some(r => r.kind !== scope.kind || r.month !== scope.month || r.year !== scope.year)) throw new ConflictException('Paket penuh atau periode paket berbeda. Buat paket baru.');
      if (staged.some(r => r.file_hash === hash || (ref && r.reference_key === ref))) throw new ConflictException('Bukti atau referensi transaksi sudah ada dalam paket.');
      await tx.$executeRaw`INSERT INTO payment_receipts (id,batch_id,owner_id,kind,month,year,filename,mime,image,file_hash,reference_key,extracted,candidates) VALUES (${id}::uuid,${body.batchId}::uuid,${owner},${scope.kind},${scope.month},${scope.year},${filename},${mime},decode(${body.base64},'base64'),${hash},${ref},${JSON.stringify(fields)}::jsonb,${JSON.stringify(candidates.map(c => this.publicCandidate(c)))}::jsonb)`;
    });
    return { ok: true, receipt: { id, filename, extracted: fields, ...matchingReceipt(fields, candidates) }, candidates: candidates.map(c => this.publicCandidate(c)) };
  }
  async image(user: any, id: string) {
    let rows: any[];
    if (isTreasurer(user)) {
      const owner = this.owner(user);
      if (!uuid.test(id || '')) throw new BadRequestException('Bukti tidak valid.');
      rows = await this.prisma.$queryRaw`SELECT image,mime FROM payment_receipts WHERE id=${id}::uuid AND (owner_id=${owner} OR applied_at IS NOT NULL)`;
    } else {
      // Pembaca rekapan (KAMAD, KTU, dll.) hanya melihat bukti yang sudah diterapkan, bukan draf.
      if (!await canReadPayments(this.prisma, user)) throw new ForbiddenException('Akses bukti pembayaran ditolak.');
      if (!uuid.test(id || '')) throw new BadRequestException('Bukti tidak valid.');
      rows = await this.prisma.$queryRaw`SELECT image,mime FROM payment_receipts WHERE id=${id}::uuid AND applied_at IS NOT NULL`;
    }
    if (!rows.length) throw new NotFoundException('Bukti tidak ditemukan.');
    return { image: Buffer.from(rows[0].image), mime: rows[0].mime };
  }
  async evidence(user: any, query: any = {}) {
    if (!await canReadPayments(this.prisma, user)) throw new ForbiddenException('Akses bukti pembayaran ditolak.');
    // 0 = semua bulan/tahun, mengikuti filter periode di halaman Pembayaran.
    const month = Number(query.month || 0), year = Number(query.year || 0);
    if (!Number.isInteger(month) || month < 0 || month > 12 || !Number.isInteger(year) || (year !== 0 && (year < 2000 || year > 2200))) throw new BadRequestException('Periode tidak valid.');
    const rows: any[] = await this.prisma.$queryRaw`SELECT id,selected FROM payment_receipts WHERE kind='KLINIK' AND applied_at IS NOT NULL AND (${month}::int=0 OR month=${month}::int) AND (${year}::int=0 OR year=${year}::int) ORDER BY applied_at DESC`;
    const data: Record<string, string> = {};
    for (const row of rows) for (const id of row.selected?.ids || []) if (!data[id]) data[id] = row.id;
    return { ok: true, data };
  }
  async apply(user: any, body: any) {
    const owner = this.owner(user);
    const scope = this.scope(body);
    if (!uuid.test(body.batchId || '') || !Array.isArray(body.selections) || !body.selections.length || body.selections.length > 30 || body.selections.some((s: any) => !uuid.test(s?.id || '') || typeof s.key !== 'string') || new Set(body.selections.map((s: any) => s.id)).size !== body.selections.length) throw new BadRequestException('Pilihan bukti tidak valid.');
    const reviewer = await this.prisma.public_users.findFirst({ where: { auth_id: owner }, select: { nama_lengkap: true, nama: true } });
    const reviewerName = reviewer?.nama_lengkap || reviewer?.nama || 'Bendahara Komite';
    try {
      return await this.prisma.$transaction(async tx => {
        const candidates = await this.candidates(tx, scope);
        const usedTargets = new Set<string>();
        for (const selection of body.selections) {
          const rows: any[] = await tx.$queryRaw`SELECT id,filename,extracted,candidates,selected,applied_at FROM payment_receipts WHERE id=${selection.id}::uuid AND batch_id=${body.batchId}::uuid AND owner_id=${owner} AND kind=${scope.kind} AND month=${scope.month} AND year=${scope.year} FOR UPDATE`;
          const row = rows[0];
          if (!row) throw new ConflictException('Bukti tidak ditemukan pada paket ini.');
          if (row.applied_at) {
            if (row.selected?.key !== selection.key) throw new ConflictException('Bukti sudah diterapkan ke pembayaran lain.');
            const ids = row.selected.ids as string[];
            const paid = await this.paidTargets(tx, scope.kind, ids);
            if (paid !== ids.length) throw new ConflictException('Pembayaran sebelumnya sudah dibatalkan atau diubah. Bukti tersimpan dalam riwayat dan tidak diterapkan ulang.');
            continue; // Safe retry after response loss: never pay twice.
          }
          if (row.extracted.status !== 'success') throw new ConflictException('Hanya bukti transfer berstatus berhasil yang dapat diterapkan.');
          const current = candidates.find(c => c.key === selection.key);
          const snapshot = (row.candidates as PaymentCandidate[]).find(c => c.key === selection.key);
          if (!current || !snapshot || current.amount !== snapshot.amount || current.amount !== row.extracted.amount) throw new ConflictException('Nominal, tagihan, atau status berubah/tidak cocok. Analisis ulang dengan paket baru.');
          if (current.ids.some(id => usedTargets.has(id))) throw new ConflictException('Dua bukti tidak boleh melunasi tagihan yang sama.');
          current.ids.forEach(id => usedTargets.add(id));
          const match = matchingReceipt(row.extracted, candidates);
          if ((!match.ready || match.suggestedKey !== selection.key) && selection.reviewed !== true) throw new ConflictException('Periksa bukti dan konfirmasi pemetaan manual terlebih dahulu.');
          const url = `/api/pembayaran-massal/bukti?id=${row.id}`;
          const catatan = JSON.stringify({ text: `Upload massal · ${row.extracted.reference || row.filename}`, url, nominal: current.amount, paid_at: new Date().toISOString(), receipt_id: row.id });
          let count = 0;
          if (scope.kind === 'KLINIK') {
            count = (await tx.klinik_slots.updateMany({ where: { id: { in: current.ids }, status: 'finished' }, data: { status: 'paid', nominal_dibayarkan: current.amount / current.ids.length, dibayarkan_at: new Date() } })).count;
          } else {
            const data = { dibayarkan: true, dibayarkan_at: new Date(), dibayarkan_by: owner, dibayarkan_by_name: reviewerName, updated_at: new Date(), catatan_pembayaran: catatan };
            count = scope.kind === 'GURU_ASUH' ? (await tx.laporan_guru_asuh_submissions.updateMany({ where: { id: { in: current.ids }, status: 'Approved', dibayarkan: false }, data })).count :
              (await tx.laporan_ekskul_submissions.updateMany({ where: { id: { in: current.ids }, status: 'Disahkan', dibayarkan: { not: true } }, data })).count;
          }
          if (count !== current.ids.length) throw new ConflictException('Status pembayaran berubah. Muat ulang data.');
          const audit = JSON.stringify({ ...this.publicCandidate(current), manual: !match.ready || match.suggestedKey !== selection.key });
          await tx.$executeRaw`UPDATE payment_receipts SET selected=${audit}::jsonb,applied_at=now(),applied_by_name=${reviewerName} WHERE id=${row.id}::uuid`;
        }
        return { ok: true, count: body.selections.length };
      }, { isolationLevel: 'Serializable', timeout: 30000 });
    } catch (error: any) {
      if (['P2002', 'P2034'].includes(error.code) || ['23505', '40001'].includes(error.meta?.code)) throw new ConflictException('Bukti sudah digunakan atau data berubah. Muat ulang paket sebelum mencoba lagi.');
      throw error;
    }
  }
}
