import { buildLckhSummary } from './lckh-summary';
import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj.toJSON === 'function') return obj.toJSON();
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeBigInt(v);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class LckhService {
  private readonly logger = new Logger(LckhService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: any) { return user?.roles?.some((r: string) => ['ADMIN','ADMINISTRATOR'].includes(r)); }
  private isHead(user: any) { return user?.roles?.some((r: string) => ['KAMAD','KEPALA','KEPALA_MADRASAH'].includes(r)); }
  private isReviewer(user: any) { return this.isAdmin(user) || this.isHead(user) || user?.roles?.some((r: string) => ['WKM_AKADEMIK','WKM_KESISWAAN','WAKA_AKADEMIK','WAKA_KESISWAAN','WAKAMAD_KURIKULUM'].includes(r)); }
  private scopeNip(user: any, nip?: string) {
    if (!user?.id) throw new ForbiddenException('Sesi tidak dikenali');
    if (this.isReviewer(user)) return nip;
    if (!user.nip || (nip && nip !== user.nip)) throw new ForbiddenException('Laporan di luar kepemilikan Anda');
    return user.nip;
  }
  private async readable(id: string, user: any) {
    const row = await this.prisma.lckh_submissions.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Laporan tidak ditemukan');
    this.scopeNip(user, row.nip || '');
    return row;
  }
  async getPeriods() {
    const periods = await this.prisma.lckh_periods.findMany({
      orderBy: { tgl_awal: 'desc' },
    });
    return serializeBigInt(periods);
  }

  async getSummary(user: any, query: any) {
    const nip = this.scopeNip(user, query.nip) || user.nip;
    if (!nip) throw new BadRequestException('NIP wajib diisi');
    return buildLckhSummary(this.prisma, nip, query.startDate, query.endDate);
  }

  async getSubmissions(apiUser: any, query: any) {
    const { periode_kode, nip, status } = query;
    const where: any = {};

    if (periode_kode) where.periode_kode = periode_kode;
    if (status) where.status = status;

    const scopedNip = this.scopeNip(apiUser, nip);
    if (scopedNip) where.nip = scopedNip;

    const items = await this.prisma.lckh_submissions.findMany({
      where,
      orderBy: { id: 'desc' },
    });

    return serializeBigInt(items);
  }

  async getSubmissionById(id: string, user: any) {
    return serializeBigInt(await this.readable(id, user));
  }

  async saveSubmission(user: any, payload: any) {
    if (!user?.id || !user.nip || user.roles?.includes('SISWA')) throw new ForbiddenException('Akun guru diperlukan');
    const editable = ['Draft','Returned','Ditolak'];
    const existing = payload.id ? await this.readable(payload.id, user) : null;
    if (existing && (existing.nip !== user.nip || !editable.includes(existing.status || 'Draft'))) throw new ForbiddenException('Hanya draft milik sendiri yang dapat diubah');
    if (payload.nip && payload.nip !== user.nip) throw new ForbiddenException('NIP tidak sesuai sesi');
    const status = payload.status || existing?.status || 'Draft';
    if (![...editable,'Submitted'].includes(status)) throw new BadRequestException('Status tidak sah untuk penulis');
    const allowed = ['periode_kode','bulan','tahun','snap_total_hari_masuk','snap_total_jam_mengajar','snap_rekap_kehadiran','snap_ringkasan_umum','snap_ada_jurnal','snap_ada_absensi','snap_ada_nilai','snap_ada_tugas','lampiran_jurnal','lampiran_absensi','lampiran_nilai','lampiran_tugas','catatan_guru','detail_jurnal'];
    const data: any = Object.fromEntries(allowed.filter(k => payload[k] !== undefined).map(k => [k,payload[k]]));
    Object.assign(data, { nip: user.nip, nama_guru_snap: user.nama_lengkap || user.nama, status, updated_at: new Date(), ...(status === 'Submitted' ? { submitted_at: new Date() } : {}) });
    if (existing) {
      const changed = await this.prisma.lckh_submissions.updateMany({ where: { id: existing.id, nip: user.nip, status: existing.status }, data });
      if (!changed.count) throw new ConflictException('Laporan telah berubah; muat ulang');
      return this.getSubmissionById(existing.id, user);
    }
    return serializeBigInt(await this.prisma.lckh_submissions.create({ data }));
  }

  async deleteSubmission(id: string, user: any) {
    const row = await this.readable(id, user);
    if (row.nip !== user.nip || !['Draft','Returned','Ditolak'].includes(row.status || 'Draft')) throw new ForbiddenException('Hanya draft milik sendiri yang dapat dihapus');
    const result = await this.prisma.lckh_submissions.deleteMany({ where: { id, nip: user.nip, status: row.status } });
    if (!result.count) throw new ConflictException('Laporan telah berubah; muat ulang');
    return { success: true };
  }

  async getApprovals(lckh_submission_id: string, user: any) {
    await this.readable(lckh_submission_id, user);
    return serializeBigInt(await this.prisma.lckh_approvals.findMany({ where: { lckh_submission_id }, orderBy: { created_at: 'asc' } }));
  }

  async approveSubmission(user: any, submissionId: string, payload: any) {
    if (!this.isReviewer(user)) throw new ForbiddenException('Tidak memiliki hak persetujuan');
    if (!['Disetujui','Ditolak'].includes(payload.status_approval)) throw new BadRequestException('Keputusan tidak valid');
    return this.prisma.$transaction(async tx => {
      const row = await tx.lckh_submissions.findUnique({ where: { id: submissionId } });
      if (!row) throw new NotFoundException('Laporan tidak ditemukan');
      if (!['Submitted','Approved_Waka'].includes(row.status || '')) throw new ConflictException('Laporan belum diajukan atau sudah disahkan');
      if (row.nip === user.nip && !this.isAdmin(user)) throw new ForbiddenException('Tidak dapat menyetujui laporan sendiri');
      const period = row.periode_kode ? await tx.lckh_periods.findFirst({ where: { periode_kode: row.periode_kode } }) : null;
      const duties = await tx.tugas_tambahan.findMany({ where: { nip: row.nip || '', ...(period ? { tahun_ajaran: period.tgl_awal.getUTCMonth() >= 6 ? `${period.tgl_awal.getUTCFullYear()}/${period.tgl_awal.getUTCFullYear()+1}` : `${period.tgl_awal.getUTCFullYear()-1}/${period.tgl_awal.getUTCFullYear()}`, semester: period.tgl_awal.getUTCMonth() >= 6 ? 1 : 2 } : {}) }, select: { approver_role: true } });
      const targets = duties.map(d => d.approver_role || 'SEMUA_WKM');
      const direct = targets.length > 0 && targets.every(r => r === 'KEPALA_MADRASAH');
      const final = row.status === 'Approved_Waka' || direct;
      if (final && !this.isHead(user) && !this.isAdmin(user)) throw new ForbiddenException('Pengesahan akhir oleh Kepala Madrasah');
      if (!this.isAdmin(user) && !this.isHead(user) && targets.length && !targets.includes('SEMUA_WKM') && !targets.some(r => user.roles.includes(r))) throw new ForbiddenException('Bukan penyetuju tugas guru ini');
      const rejected = payload.status_approval === 'Ditolak';
      if (rejected && !String(payload.catatan || '').trim()) throw new BadRequestException('Alasan pengembalian wajib diisi');
      const level = final ? 'KAMAD' : (user.roles.includes('WKM_KESISWAAN') ? 'WKM_KESISWAAN' : 'WKM_AKADEMIK');
      const status = rejected ? 'Returned' : final ? 'Approved_Kamad' : 'Approved_Waka';
      const result = await tx.lckh_submissions.updateMany({ where: { id: submissionId, status: row.status }, data: {
        status, catatan_reviewer: payload.catatan || null, updated_at: new Date(),
        ...(!rejected && final ? { approval_code: randomUUID(), approved_by_kamad: String(user.id), full_approved_at: new Date() } : {}),
        ...(!rejected && !final ? { approved_by_waka: String(user.id) } : {}),
      } });
      if (!result.count) throw new ConflictException('Laporan telah berubah; muat ulang');
      return serializeBigInt(await tx.lckh_approvals.create({ data: { lckh_submission_id: submissionId, level, status_approval: payload.status_approval, approver_id: String(user.id), approver_name: user.nama_lengkap || user.nama || '', approved_at: new Date(), catatan: payload.catatan || null } }));
    });
  }

  async getNilaiDetail(query: any, user: any) {
    const kolomId = query.kolom_id;
    const f_kelas = query.kelas;
    const f_mapel = query.mapel;
    const f_jenis = query.jenis;
    const f_materi = query.materi;
    const f_tagihan = query.tagihan;

    if (!kolomId && !f_kelas) {
      throw new BadRequestException('Missing kolom_id or metadata parameters');
    }

    let metadata: any = null;
    if (kolomId && kolomId !== 'undefined') {
      const tagihan = await this.prisma.nilai_tagihan.findUnique({
        where: { id: kolomId },
      });
      if (tagihan) {
        metadata = {
          nip: tagihan.nip,
          kelas: tagihan.kelas,
          mapel: tagihan.mapel,
          semester: tagihan.semester,
          jenis: tagihan.jenis,
          tagihan: tagihan.nama_tagihan,
          materi: tagihan.materi_tp,
        };
      } else {
        const nilaiSample = await this.prisma.nilai_data.findUnique({
          where: { id: kolomId },
        });
        if (nilaiSample) {
          metadata = {
            nip: nilaiSample.nip,
            kelas: nilaiSample.kelas,
            mapel: nilaiSample.mapel,
            semester: nilaiSample.semester,
            jenis: nilaiSample.jenis,
            tagihan: nilaiSample.tagihan,
            materi: nilaiSample.materi_tp,
          };
        }
      }
    }

    if (!metadata && f_kelas && f_mapel && f_jenis) {
      const sample = await this.prisma.nilai_data.findFirst({
        where: {
          kelas: f_kelas,
          mapel: f_mapel,
          jenis: f_jenis,
          tagihan: f_tagihan || '',
          materi_tp: f_materi || '',
        },
      });
      if (sample) {
        metadata = {
          nip: sample.nip,
          kelas: sample.kelas,
          mapel: sample.mapel,
          semester: sample.semester,
          jenis: sample.jenis,
          tagihan: sample.tagihan,
          materi: sample.materi_tp,
        };
      }
    }

    if (!metadata) {
      throw new NotFoundException('Informasi kolom tidak ditemukan');
    }

    this.scopeNip(user, metadata.nip);
    const studentsRaw = await this.prisma.siswa_kelas.findMany({
      where: { kelas: metadata.kelas },
      select: { nisn: true, nama_siswa: true },
      orderBy: { nama_siswa: 'asc' },
    });

    const studentsMap = new Map<string, { nisn: string; nama_siswa: string }>();
    studentsRaw.forEach((student) => {
      if (student.nisn && !studentsMap.has(student.nisn)) {
        studentsMap.set(student.nisn, { nisn: student.nisn, nama_siswa: student.nama_siswa || '' });
      }
    });
    const students = Array.from(studentsMap.values());

    const grades = await this.prisma.nilai_data.findMany({
      where: {
        nip: metadata.nip,
        kelas: metadata.kelas,
        mapel: metadata.mapel,
        semester: metadata.semester,
        jenis: metadata.jenis,
        tagihan: metadata.tagihan,
        materi_tp: metadata.materi,
      },
      select: { nisn: true, nilai: true, updated_at: true },
    });

    const gradesMap = new Map(grades.map((g) => [g.nisn, g]));

    const studentsWithGrades = students.map((student) => {
      const grade = gradesMap.get(student.nisn);
      return {
        nisn: student.nisn,
        nama: student.nama_siswa,
        nilai: grade?.nilai ?? null,
        updated_at: grade?.updated_at ?? null,
      };
    });

    return {
      ok: true,
      kolom_info: {
        kelas: metadata.kelas,
        mapel: metadata.mapel,
        jenis: metadata.jenis,
        materi: metadata.materi || '-',
        tagihan: metadata.tagihan || 'Kolom Utama',
      },
      students: studentsWithGrades,
    };
  }

  async getPrintData(submissionId: string, user: any) {
    await this.readable(submissionId, user);
    if (!submissionId) throw new BadRequestException('Submission ID is required');

    const submission = await this.prisma.lckh_submissions.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const period = submission.periode_kode
      ? await this.prisma.lckh_periods.findFirst({
          where: { periode_kode: submission.periode_kode },
        })
      : null;

    const profil = await this.prisma.profil_sekolah.findFirst();

    const approvals = await this.prisma.lckh_approvals.findMany({
      where: { lckh_submission_id: submissionId },
      orderBy: { approved_at: 'asc' },
    });

    let ringkasanItems: any[] = [];
    try {
      if (submission.catatan_guru?.startsWith('[')) {
        ringkasanItems = JSON.parse(submission.catatan_guru);
      }
    } catch {}

    return {
      ok: true,
      data: {
        guru_name: submission.nama_guru_snap || '-',
        nip: submission.nip || '-',
        periode: period?.periode_nama || submission.periode_kode,
        periode_start: period?.tgl_awal ? period.tgl_awal.toISOString().split('T')[0] : '-',
        periode_end: period?.tgl_akhir ? period.tgl_akhir.toISOString().split('T')[0] : '-',
        total_jam: submission.snap_total_jam_mengajar || 0,
        lampiran_absensi: submission.lampiran_absensi || [],
        lampiran_jurnal: submission.lampiran_jurnal || [],
        lampiran_tugas: submission.lampiran_tugas || [],
        lampiran_nilai: submission.lampiran_nilai || [],
        ringkasan_umum: submission.snap_ringkasan_umum || {},
        ringkasan: ringkasanItems,
        catatan_guru: submission.catatan_guru || '',
        approval_status: submission.status || 'Unknown',
        approval_code: submission.approval_code || null,
        madrasah_name: profil?.nama || 'MIN 1 KOTA MALANG',
        madrasah_address: profil?.alamat || '',
        madrasah_logo: profil?.logo_url || null,
        profil: profil || null,
        approvals,
      },
    };
  }
}


