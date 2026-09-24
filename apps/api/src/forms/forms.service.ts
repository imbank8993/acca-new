import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { allocate, computeScores } from './form-allocation';

const ADMIN_ROLES = ['ADMIN', 'ADMINISTRATOR'];

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  private isUserAdmin(user: any): boolean {
    if (!user) return false;
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles
      : String(user.role || '')
          .split(/[,|]/)
          .map((r: string) => r.trim().toUpperCase());
    return roles.some((r) => ADMIN_ROLES.includes(r));
  }

  private getUserIdentifier(user: any): string {
    return user.auth_id || String(user.id);
  }

  async getForms(user: any) {
    const isAdmin = this.isUserAdmin(user);
    const userId = this.getUserIdentifier(user);

    const where: any = {};
    if (!isAdmin) {
      where.OR = [
        { created_by: userId },
        { created_by: String(user.id) },
        ...(user.auth_id ? [{ created_by: user.auth_id }] : []),
      ];
    }

    const forms = await this.prisma.custom_forms.findMany({
      where,
      include: {
        _count: {
          select: { custom_form_responses: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Sesuaikan format kembalian agar kompatibel dengan frontend
    const mapped = forms.map((f) => ({
      ...f,
      custom_form_responses: [{ count: f._count.custom_form_responses }],
    }));

    return { forms: mapped };
  }

  async getFormById(id: string, user?: any) {
    const isUUID =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        id,
      );

    let form = null;
    if (isUUID) {
      form = await this.prisma.custom_forms.findUnique({ where: { id } });
    } else {
      // Cari berdasarkan slug kolom atau slug di dalam JSON schema
      form = await this.prisma.custom_forms.findFirst({
        where: {
          OR: [
            { slug: id },
            {
              schema: {
                path: ['slug'],
                equals: id,
              },
            },
          ],
        },
      });
    }

    if (!form) {
      throw new NotFoundException('Formulir tidak ditemukan atau akses ditolak');
    }

    const schema = (form.schema as any) || {};
    const isPublic =
      form.is_public === true ||
      schema.is_public === true ||
      schema.is_link_public === true;

    if (!user) {
      if (!isPublic) {
        throw new ForbiddenException('Unauthorized');
      }
      return { form };
    }

    const isAdmin = this.isUserAdmin(user);
    const userId = this.getUserIdentifier(user);

    if (
      !isAdmin &&
      form.created_by !== userId &&
      form.created_by !== String(user.id) &&
      form.created_by !== user.auth_id &&
      !isPublic
    ) {
      throw new ForbiddenException('Anda tidak berhak mengakses formulir ini');
    }

    return { form };
  }

  async createForm(body: any, user: any) {
    const { title, schema, is_public } = body;
    if (!title) {
      throw new BadRequestException('Judul formulir wajib diisi');
    }

    const userId = this.getUserIdentifier(user);
    const slug = schema?.slug || null;

    const newForm = await this.prisma.custom_forms.create({
      data: {
        title,
        slug,
        schema: schema || {},
        is_public: is_public ?? false,
        created_by: userId,
      },
    });

    return { form: newForm };
  }

  async updateForm(id: string, body: any, user: any) {
    const existing = await this.prisma.custom_forms.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Form tidak ditemukan');
    }

    const isAdmin = this.isUserAdmin(user);
    const userId = this.getUserIdentifier(user);

    if (
      !isAdmin &&
      existing.created_by !== userId &&
      existing.created_by !== String(user.id) &&
      existing.created_by !== user.auth_id
    ) {
      throw new ForbiddenException('Anda tidak berhak mengubah formulir ini');
    }

    const { title, schema, is_public, show_in_academic_navbar } = body;
    const currentSchema = (existing.schema as any) || {};
    const updatedSchema = {
      ...currentSchema,
      ...(schema || {}),
      ...(is_public !== undefined ? { is_public } : {}),
      ...(show_in_academic_navbar !== undefined
        ? { show_in_academic_navbar }
        : {}),
    };

    const updateData: any = { schema: updatedSchema };
    if (title !== undefined) updateData.title = title;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (updatedSchema.slug) updateData.slug = updatedSchema.slug;

    const updated = await this.prisma.custom_forms.update({
      where: { id },
      data: updateData,
    });

    return { form: updated };
  }

  async deleteForm(id: string, user: any) {
    const existing = await this.prisma.custom_forms.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Form tidak ditemukan');
    }

    const isAdmin = this.isUserAdmin(user);
    const userId = this.getUserIdentifier(user);

    if (
      !isAdmin &&
      existing.created_by !== userId &&
      existing.created_by !== String(user.id) &&
      existing.created_by !== user.auth_id
    ) {
      throw new ForbiddenException('Anda tidak berhak menghapus formulir ini');
    }

    // Hapus seluruh tanggapan terlebih dahulu
    await this.prisma.custom_form_responses.deleteMany({
      where: { form_id: id },
    });

    await this.prisma.custom_forms.delete({
      where: { id },
    });

    return { message: 'Form berhasil dihapus' };
  }

  async getResponses(formId: string, query: any, user: any) {
    const { form } = await this.getFormById(formId, user);

    const responses = await this.prisma.custom_form_responses.findMany({
      where: { form_id: form.id },
      orderBy: { created_at: 'desc' },
    });

    return { form, responses };
  }

  async deleteResponses(formId: string, responseIds: string[], user: any) {
    const { form } = await this.getFormById(formId, user);

    await this.prisma.custom_form_responses.deleteMany({
      where: {
        form_id: form.id,
        id: { in: responseIds },
      },
    });

    return { success: true, count: responseIds.length };
  }

  async getPublicForms() {
    const forms = await this.prisma.custom_forms.findMany({
      orderBy: { created_at: 'desc' },
    });

    const publicForms = forms.filter((f) => {
      const schema = (f.schema as any) || {};
      const isPublic = f.is_public === true || schema.is_public === true;
      const isPengurusForm = schema.is_pengurus_form === true;
      const explicitShow = schema.show_in_academic_navbar;

      if (explicitShow === true) return true;
      if (explicitShow === false) return false;

      return isPublic && !isPengurusForm;
    });

    return { ok: true, forms: publicForms };
  }

  async getDynamicOptions(source: string) {
    let options: { label: string; value: string }[] = [];

    switch (source) {
      case 'guru': {
        const data = await this.prisma.master_guru.findMany({
          where: { aktif: true },
          select: { id: true, nama_lengkap: true, nip: true },
          orderBy: { nama_lengkap: 'asc' },
        });
        options = data.map((g) => ({
          label: (g.nama_lengkap || '') + (g.nip ? ` (${g.nip})` : ''),
          value: g.nama_lengkap || '',
        }));
        break;
      }

      case 'students': {
        const data = await this.prisma.master_siswa.findMany({
          where: { aktif: true },
          select: { id: true, nama_lengkap: true, nisn: true },
          orderBy: { nama_lengkap: 'asc' },
        });
        options = data.map((s) => ({
          label: s.nama_lengkap || '',
          value: s.nama_lengkap || '',
        }));
        break;
      }

      case 'classes': {
        const data = await this.prisma.master_kelas.findMany({
          where: { aktif: true },
          select: { id: true, nama: true },
          orderBy: { nama: 'asc' },
        });
        options = data.map((c) => ({
          label: c.nama || '',
          value: c.nama || '',
        }));
        break;
      }

      default:
        options = [];
    }

    return { options };
  }

  async submitResponse(body: any, user?: any) {
    const { form_id, data } = body;
    if (!form_id || !data) {
      throw new BadRequestException('form_id and data are required');
    }

    const isUUID =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        String(form_id),
      );

    let form = null;
    if (isUUID) {
      form = await this.prisma.custom_forms.findUnique({
        where: { id: form_id },
      });
    } else {
      form = await this.prisma.custom_forms.findFirst({
        where: {
          OR: [
            { slug: form_id },
            {
              schema: {
                path: ['slug'],
                equals: form_id,
              },
            },
          ],
        },
      });
    }

    if (!form) {
      throw new NotFoundException('Formulir tidak ditemukan');
    }

    const schema = (form.schema as any) || {};
    if (schema.is_active === false) {
      throw new ForbiddenException('Pengisian Formulir telah ditutup');
    }

    const isPublicForm =
      form.is_public === true ||
      schema.is_public === true ||
      schema.is_link_public === true;
    const allowMultiple =
      isPublicForm || schema.allow_multiple_responses === true;

    const userId = user ? this.getUserIdentifier(user) : null;

    // Cek duplikasi pengisian untuk user yang sudah login pada form privat
    if (!allowMultiple && userId) {
      const existing = await this.prisma.custom_form_responses.findFirst({
        where: {
          form_id: form.id,
          OR: [
            { user_id: userId },
            ...(user.id ? [{ user_id: String(user.id) }] : []),
            ...(user.auth_id ? [{ user_id: user.auth_id }] : []),
          ],
        },
      });

      if (existing) {
        throw new ForbiddenException(
          'Anda sudah pernah mengisi formulir ini sebelumnya',
        );
      }
    }

    // Hitung skor otomatis jika field memiliki bobot nilai
    const fields = schema.fields || [];
    const scores = computeScores(fields, data);

    const newResponse = await this.prisma.custom_form_responses.create({
      data: {
        form_id: form.id,
        user_id: userId,
        data,
        total_score: scores.total,
        category_scores: scores.categories,
      },
    });

    return { response: newResponse };
  }

  async allocate(formId: string, body: any, user: any) {
    const { form } = await this.getFormById(formId, user);
    const persist = body?.persist === true;
    const schema = (form.schema as any) || {};
    const fields = schema.fields || [];
    const config = body?.config || schema.allocation;

    if (
      !config ||
      !Array.isArray(config.choiceFields) ||
      config.choiceFields.length === 0
    ) {
      throw new BadRequestException(
        'Pengaturan seleksi belum lengkap. Tentukan dulu field Pilihan Pertama.',
      );
    }

    const responses = await this.prisma.custom_form_responses.findMany({
      where: { form_id: form.id },
      orderBy: { created_at: 'asc' },
    });

    const candidates = responses.map((r) => ({
      id: r.id,
      created_at: r.created_at || new Date(),
      data: (r.data as Record<string, any>) || {},
    }));

    const outcome = allocate(fields, config, candidates);

    // Jika persist = true, simpan hasil seleksi ke database
    if (persist && outcome.results.length > 0) {
      const now = new Date();
      await this.prisma.$transaction(
        outcome.results.map((r) =>
          this.prisma.custom_form_responses.update({
            where: { id: r.id },
            data: {
              placement_option: r.option,
              placement_stage: r.stage,
              placement_rank: r.rank,
              placed_at: now,
              total_score: r.scores.total,
              category_scores: r.scores.categories,
            },
          }),
        ),
      );
    }

    return outcome;
  }

  async recalculateScores(formId: string, user: any) {
    const { form } = await this.getFormById(formId, user);
    const schema = (form.schema as any) || {};
    const fields = schema.fields || [];

    const responses = await this.prisma.custom_form_responses.findMany({
      where: { form_id: form.id },
    });

    let updated = 0;
    for (const r of responses) {
      const scores = computeScores(fields, (r.data as any) || {});
      await this.prisma.custom_form_responses.update({
        where: { id: r.id },
        data: {
          total_score: scores.total,
          category_scores: scores.categories,
        },
      });
      updated++;
    }

    return { updated, total: responses.length };
  }

  async getPengembanganDiriSurvey(kelas?: string, page = 1, limit = 50) {
    const from = (page - 1) * limit;
    const where: any = { deleted_at: null };
    if (kelas) where.kelas_nama = kelas;

    const [data, count] = await Promise.all([
      this.prisma.pengembangan_diri_responses.findMany({
        where,
        orderBy: { submitted_at: 'desc' },
        skip: from,
        take: limit,
      }),
      this.prisma.pengembangan_diri_responses.count({ where }),
    ]);

    return {
      ok: true,
      data,
      meta: {
        total: count,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    };
  }

  async deletePengembanganDiriSurvey(id: string) {
    if (!id) throw new BadRequestException('ID required');
    await this.prisma.pengembangan_diri_responses.update({
      where: { id: parseInt(id, 10) },
      data: { deleted_at: new Date() },
    });
    return { ok: true };
  }

  async submitPengembanganDiriSurvey(body: any, reqHeaders: any) {
    if (!body.kelas_nama) {
      throw new BadRequestException('Kelas wajib dipilih');
    }
    const insertData: any = {
      kelas_id: body.kelas_id || null,
      kelas_nama: body.kelas_nama,
      tingkat: body.tingkat || null,
      ketertarikan: body.ketertarikan || null,
      bidang_minati: body.bidang_minati || null,
      bidang_minati_lainnya: body.bidang_minati_lainnya || null,
      keterampilan: body.keterampilan || [],
      waktu_pelaksanaan: body.waktu_pelaksanaan || null,
      durasi_ideal: body.durasi_ideal ? parseInt(body.durasi_ideal) : null,
      kendala: body.kendala || [],
      kesediaan_rutin: body.kesediaan_rutin || null,
      ip_address: reqHeaders['x-forwarded-for'] || reqHeaders['x-real-ip'] || null,
      user_agent: reqHeaders['user-agent'] || null,
    };

    const data = await this.prisma.pengembangan_diri_responses.create({
      data: insertData,
    });
    return { ok: true, data, message: 'Response submitted successfully' };
  }
}

