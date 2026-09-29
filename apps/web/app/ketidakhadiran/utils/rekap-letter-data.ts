import { prisma } from '@/lib/prisma';
import type { AbsenceDetail, RekamMedisPrintRow } from '@/lib/print/rekam-medis-letter';

export type RekapLetterJenis = 'IZIN' | 'SAKIT';

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeRoleList(role: string | null | undefined): string[] {
  return (role || '')
    .split(/[,|]/)
    .map((item) => item.trim().toUpperCase().replace(/\s+/g, '_'))
    .filter(Boolean);
}

export async function getRekapLetterData(
  jenis: RekapLetterJenis,
  month: number,
  year: number,
  fallbackSigner: string,
): Promise<{ rekamRows: RekamMedisPrintRow[]; penandatangan: string[] }> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const records = await prisma.ketidakhadiran.findMany({
    where: {
      jenis,
      aktif: true,
      tgl_mulai: { gte: startDate, lte: endDate },
    },
    select: {
      nisn: true,
      nama: true,
      kelas: true,
      tgl_mulai: true,
      tgl_selesai: true,
      keterangan: true,
      status: true,
      tindakan: true,
      tindak_lanjut: true,
    },
    orderBy: { tgl_mulai: 'asc' },
  });

  const students = new Map<string, RekamMedisPrintRow>();
  for (const record of records) {
    const key = (record.nisn || record.nama || '-').trim().toLocaleLowerCase('id');
    let student = students.get(key);
    if (!student) {
      student = {
        no: 0,
        nama: record.nama || '-',
        nisn: record.nisn || '-',
        kelas: record.kelas || '-',
        absences: [],
      };
      students.set(key, student);
    }

    const rawParts = (record.keterangan || '').includes('|')
      ? record.keterangan.split('|').map((part) => part.trim())
      : [record.keterangan || '', record.tindakan || '', record.tindak_lanjut || ''];
    const absence: AbsenceDetail = {
      tgl_mulai_fmt: formatShortDate(record.tgl_mulai),
      tgl_selesai_fmt: record.tgl_selesai.getTime() !== record.tgl_mulai.getTime()
        ? formatShortDate(record.tgl_selesai)
        : '-',
      keterangan: rawParts[0] || '-',
      tindakan: jenis === 'IZIN' ? record.status || '-' : rawParts[1] || record.tindakan || '-',
      tindak_lanjut: rawParts[2] || record.tindak_lanjut || '-',
    };
    student.absences.push(absence);
  }

  const rekamRows = [...students.values()]
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
    .map((student, index) => ({ ...student, no: index + 1 }));

  const role = jenis === 'SAKIT' ? 'OP_UKS' : 'OP_IZIN';
  const users = await prisma.public_users.findMany({
    where: { aktif: true, role: { contains: role, mode: 'insensitive' } },
    select: { nip: true, nama: true, nama_lengkap: true, role: true },
  });
  const roleHolders = users.filter((user) => normalizeRoleList(user.role).includes(role));
  const nips = roleHolders.map((user) => user.nip).filter((nip): nip is string => Boolean(nip));
  const guruRows = nips.length > 0
    ? await prisma.master_guru.findMany({
        where: { nip: { in: nips } },
        select: { nip: true, nama_lengkap: true },
      })
    : [];
  const guruNames = new Map(guruRows.map((guru) => [guru.nip, guru.nama_lengkap]));
  const penandatangan = [...new Set(roleHolders
    .map((user) => (user.nip ? guruNames.get(user.nip) : undefined) || user.nama_lengkap || user.nama || '')
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id'))
    .slice(0, 3);

  return {
    rekamRows,
    penandatangan: penandatangan.length > 0
      ? penandatangan
      : fallbackSigner
        ? [fallbackSigner]
        : [],
  };
}
