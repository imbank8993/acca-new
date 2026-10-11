import { GuruAsuhService } from './guru-asuh.service';
import { EkskulSubmissionService } from '../ekskul/ekskul-submission.service';
import { handlePatch } from '../klinik/klinik.service';
import { EkskulService } from '../ekskul/ekskul.service';

describe('payment regressions', () => {
  const user = { nip: 'G1', roles: ['ADMIN'], role: 'ADMIN' };
  it('keeps paid revised reports in the payment list', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new GuruAsuhService({
      site_settings: { findUnique: jest.fn().mockResolvedValue(null) },
      laporan_guru_asuh_submissions: { findMany },
    } as any);
    await service.getSubmissions(user, { status: 'Approved', includePaid: 'true' });
    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ status: 'Approved' }, { dibayarkan: true }]);
  });
  it('blocks revision of paid Guru Asuh reports', async () => {
    const service = new GuruAsuhService({
      site_settings: { findUnique: jest.fn().mockResolvedValue(null) },
      laporan_guru_asuh_submissions: { findUnique: jest.fn().mockResolvedValue({ status: 'Approved', dibayarkan: true }) },
    } as any);
    await expect(service.approveSubmission(user, { id: 'id', action: 'revisi', catatan: 'Perbaiki' }))
      .rejects.toThrow('Batalkan pembayaran');
  });
  it('blocks revision of paid Ekskul reports', async () => {
    const service = new EkskulService({ laporan_ekskul_submissions: {
      findUnique: jest.fn().mockResolvedValue({ status: 'Disahkan', dibayarkan: true }),
    } } as any, {} as any);
    await expect(service.approveSubmission(user, {
      id: '12345678-1234-1234-1234-123456789012', action: 'revisi', catatan_reviewer: 'Perbaiki',
    })).rejects.toThrow('Batalkan pembayaran');
  });
  it('keeps paid revised Ekskul reports in the payment list', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new EkskulSubmissionService({ laporan_ekskul_submissions: { findMany } } as any);
    await service.getSubmissions(user, { status: 'Disahkan', includePaid: 'true' });
    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ status: 'Disahkan' }, { dibayarkan: true }]);
  });
  it('allows cancellation only from paid and clears its snapshot', async () => {
    const { db, row } = database('paid');
    row.nominal_dibayarkan = 100000;
    await handlePatch({ user }, 'unmark_paid', 'id', {}, db as any);
    expect(row.status).toBe('finished');
    expect(row.nominal_dibayarkan).toBeNull();
  });
  it.each(['guru', 'ekskul'])('allows cancelling an old paid revised %s report', async kind => {
    const table = { findUnique: jest.fn().mockResolvedValue({ id: 'id', status: 'Revisi' }), update: jest.fn().mockResolvedValue({}) };
    const prisma = { laporan_guru_asuh_submissions: table, laporan_ekskul_submissions: table };
    const service = kind === 'guru' ? new GuruAsuhService(prisma as any) : new EkskulSubmissionService(prisma as any);
    await service.postPembayaran(user, { id: 'id', dibayarkan: false });
    expect(table.update.mock.calls[0][0].data.dibayarkan).toBe(false);
  });
  function database(status: string, nominal = 100000) {
    const row: any = { id: 'id', status };
    const db = { from: (table: string) => {
      let changes: any;
      const filters: any[] = [];
      const q: any = {
        select: () => q, eq: (key: string, value: any) => { filters.push([key, value]); return q; },
        update: (value: any) => { changes = value; return q; },
        maybeSingle: async () => ({ data: table === 'tarif_honor' ? { nominal } : { status: 'Approved' } }),
        single: async () => {
          if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null };
          Object.assign(row, changes); return { data: row };
        },
      }; return q;
    } };
    return { db, row };
  }
  it.each(['pending', 'approved', 'cancelled', 'finished'])('cannot cancel payment of a %s session', async status => {
    const { db, row } = database(status);
    await expect(handlePatch({ user }, 'unmark_paid', 'id', {}, db as any)).rejects.toThrow();
    expect(row.status).toBe(status);
  });
  it('stores the server tariff, including zero, and prevents overwriting a paid snapshot', async () => {
    const { db, row } = database('finished', 0);
    await handlePatch({ user }, 'mark_paid', 'id', { nominal: 999 }, db as any);
    expect(row.nominal_dibayarkan).toBe(0);
    expect(row.dibayarkan_at).toBeTruthy();
    await expect(handlePatch({ user }, 'mark_paid', 'id', {}, db as any)).rejects.toThrow();
    expect(row.nominal_dibayarkan).toBe(0);
  });
});
