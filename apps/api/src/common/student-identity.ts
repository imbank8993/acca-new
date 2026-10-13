import type { PrismaService } from '../prisma/prisma.service';

/** Resolve the student's NISN from verified account fields, never from a request override. */
export async function resolveStudentNisn(db: Pick<PrismaService, 'master_siswa'>, user: any): Promise<string | null> {
  const candidates = [...new Set([user?.nip, user?.username]
    .filter(value => value != null).map(value => String(value).trim()).filter(Boolean))];
  for (const nisn of candidates) {
    const student = await db.master_siswa.findUnique({ where: { nisn }, select: { nisn: true } });
    if (student) return nisn;
  }
  return null;
}
