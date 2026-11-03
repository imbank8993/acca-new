import { ForbiddenException } from '@nestjs/common';
export const isTreasurer = (user: any) => user.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'BENDAHARA_KOMITE'].includes(r)) === true;
export async function canReadPayments(db: any, user: any) {
  if (isTreasurer(user) || user.roles?.some((r: string) => ['KAMAD','KTU','SUPERVISOR','PENGAWAS_MADRASAH'].includes(r))) return true;
  const override = user.page_overrides;
  if (override?.remove?.includes('pembayaran')) return false;
  if (override?.add?.includes('pembayaran')) return true;
  return Boolean(await db.role_pages.findFirst({ where: { role: { in: user.roles || [] }, page_id: 'pembayaran' } }));
}
export function requireStaff(user: any) {
  if (!user.auth_id && !user.authId) throw new ForbiddenException('Silakan masuk kembali.');
  const internal=user.roles?.some((r:string)=>!['SISWA','ORANG_TUA','GUEST'].includes(r));
  const staffRole=user.roles?.some((r:string)=>['GURU','KAMAD','KTU','OP_MADRASAH','STAF','TENDIK','SUPERVISOR','PENGAWAS_MADRASAH'].includes(r));
  if (!isTreasurer(user) && (!internal || (!user.nip&&!staffRole))) throw new ForbiddenException('Pengajuan Komite hanya untuk pengaju/PJ kegiatan.');
  return user.auth_id || user.authId;
}
