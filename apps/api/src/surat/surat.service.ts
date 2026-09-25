import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuratService {
  constructor(private prisma: PrismaService) {}

  // ── Template Surat ──────────────────────────────────────────

  async getTemplates() {
    return this.prisma.surat_templates.findMany({
      where: { is_active: true },
      select: {
        id: true,
        nama_template: true,
        jenis_surat: true,
        description: true,
        template_html: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [{ jenis_surat: 'asc' }, { created_at: 'desc' }],
    });
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.surat_templates.findUnique({
      where: { id },
      select: {
        id: true,
        nama_template: true,
        jenis_surat: true,
        description: true,
        template_html: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template tidak ditemukan');
    }

    return template;
  }

  async getTemplateUrls() {
    const data = await this.prisma.surat_templates.findMany({
      where: { is_active: true },
      select: {
        id: true,
        nama_template: true,
        jenis_surat: true,
        template_html: true,
        is_active: true,
        updated_at: true,
      },
    });

    const templateMap: Record<
      string,
      { id: string; nama_template: string; template_html: string | null }
    > = {};
    for (const tm of data || []) {
      if (!templateMap[tm.jenis_surat]) {
        templateMap[tm.jenis_surat] = {
          id: tm.id,
          nama_template: tm.nama_template || tm.jenis_surat,
          template_html: tm.template_html || null,
        };
      }
    }

    return { ok: true, data: templateMap };
  }

  async createOrUpdateTemplate(data: {
    nama_template: string;
    jenis_surat: string;
    template_html: string;
    created_by: string;
  }) {
    const existing = await this.prisma.surat_templates.findFirst({
      where: {
        jenis_surat: data.jenis_surat,
        is_active: true,
      },
      select: { id: true, template_html: true },
    });

    if (existing) {
      const updated = await this.prisma.surat_templates.update({
        where: { id: existing.id },
        data: {
          nama_template: data.nama_template,
          template_html: data.template_html,
          description: `Updated via admin panel`,
          updated_at: new Date(),
        },
      });
      return { template: updated, old_html: existing.template_html };
    } else {
      const created = await this.prisma.surat_templates.create({
        data: {
          nama_template: data.nama_template,
          jenis_surat: data.jenis_surat,
          template_html: data.template_html,
          description: `Uploaded via admin panel`,
          is_active: true,
          created_by: data.created_by,
        },
      });
      return { template: created, old_html: null };
    }
  }

  async updateTemplate(id: string, data: Prisma.surat_templatesUpdateInput) {
    return this.prisma.surat_templates.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  async softDeleteTemplate(id: string) {
    const existing = await this.prisma.surat_templates.findUnique({
      where: { id },
      select: { template_html: true },
    });

    if (!existing) throw new NotFoundException('Template tidak ditemukan');

    await this.prisma.surat_templates.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    return existing;
  }

  // ── Surat Records ──────────────────────────────────────────

  async getAllSurat(query: any) {
    const { status, jenis_surat, search } = query || {};
    const where: any = {};
    if (status) where.status = String(status);
    if (jenis_surat) where.jenis_surat = String(jenis_surat);
    if (search) {
      where.OR = [
        { nomor_surat: { contains: String(search), mode: 'insensitive' } },
        { perkara: { contains: String(search), mode: 'insensitive' } },
        { kepada: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    const data = await this.prisma.surat.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return { ok: true, data };
  }

  async getSuratById(id: string) {
    const item = await this.prisma.surat.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Surat tidak ditemukan');
    return { ok: true, data: item };
  }

  async getSuratByNomor(nomor: string) {
    if (!nomor) throw new BadRequestException('Nomor surat required');
    const data = await this.prisma.surat.findFirst({
      where: { nomor_surat: nomor.trim() },
    });
    if (!data) throw new NotFoundException('Surat tidak ditemukan');
    return { ok: true, data };
  }

  async searchSurat(query: string, limit: number = 10) {
    if (!query || query.length < 3) return { ok: true, data: [] };
    const letters = await this.prisma.surat.findMany({
      where: {
        status: { in: ['DRAFT', 'FINAL'] },
        OR: [
          { nomor_surat: { contains: query, mode: 'insensitive' } },
          { kepada: { contains: query, mode: 'insensitive' } },
          { perkara: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nomor_surat: true,
        jenis_surat: true,
        kepada: true,
        tanggal_surat: true,
        perkara: true,
        status: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    const result = letters.map((surat) => ({
      id: surat.id,
      nomor_surat: surat.nomor_surat,
      jenis_surat: surat.jenis_surat,
      kepada: surat.kepada || '-',
      tanggal_surat: surat.tanggal_surat,
      perkara: surat.perkara || '-',
      status: surat.status,
      label: surat.nomor_surat,
      sub: `${surat.jenis_surat} • ${surat.kepada || surat.perkara || '-'}${surat.status === 'DRAFT' ? ' (Draft)' : ''}`,
    }));

    return { ok: true, data: result };
  }

  async createSurat(body: any, user: any) {
    const data = await this.prisma.surat.create({
      data: {
        ...body,
        created_by: user ? (user.auth_id || String(user.id)) : undefined,
      },
    });
    return { ok: true, data };
  }

  async updateSurat(id: string, body: any, user: any) {
    const existing = await this.prisma.surat.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Surat tidak ditemukan');

    const role = (user?.role || '').toUpperCase();
    const roles: string[] = Array.isArray(user?.roles)
      ? user.roles.map((r: string) => String(r).toUpperCase())
      : role.split(/[,|]/).map((r: string) => r.trim().toUpperCase());

    const isAdminOrSurat = roles.some((r: string) =>
      ['ADMIN', 'ADMINISTRATOR', 'SURAT'].includes(r),
    );

    if (!isAdminOrSurat && existing.created_by && existing.created_by !== (user?.auth_id || String(user?.id))) {
      throw new ForbiddenException('Anda tidak berhak mengubah surat ini');
    }

    const data = await this.prisma.surat.update({
      where: { id },
      data: {
        ...body,
        updated_at: new Date(),
      },
    });
    return { ok: true, data };
  }

  async deleteSurat(id: string, apiUser: any) {
    const existing = await this.prisma.surat.findUnique({ where: { id } });
    if (!existing) throw new (require('@nestjs/common').NotFoundException)('Surat tidak ditemukan');
    
    const role = (apiUser?.role || '').toUpperCase();
    const isAdminOrSurat = role.includes('ADMIN') || role.includes('ADMINISTRATOR') || role.includes('SURAT');
    
    if (!isAdminOrSurat && existing.created_by !== (apiUser?.auth_id || String(apiUser?.id))) {
      throw new (require('@nestjs/common').ForbiddenException)('Anda tidak berhak menghapus surat ini');
    }

    await this.prisma.surat.delete({ where: { id } });
    return { ok: true, message: 'Surat berhasil dihapus' };
  }

  async verifySurat(letterId: string) {
    if (!letterId) throw new BadRequestException('Missing letter_id parameter');
    const actualId = letterId.replace(/^SRT-/i, '');
    const isUUID =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        actualId,
      );

    let surat = null;
    if (isUUID) {
      surat = await this.prisma.surat.findUnique({
        where: { id: actualId },
        select: {
          id: true,
          nomor_surat: true,
          jenis_surat: true,
          perkara: true,
          kepada: true,
          alamat_tujuan: true,
          tempat_ttd: true,
          tanggal_ttd: true,
          created_at: true,
          status: true,
          pejabat_nama: true,
          pejabat_jabatan: true,
          file_url: true,
        },
      });
    }

    if (!surat) {
      return { ok: false, error: 'Surat tidak ditemukan', found: false };
    }

    const isValid =
      surat.status === 'FINAL' ||
      surat.status === 'ACTIVE' ||
      surat.status === 'VALID';

    return {
      ok: true,
      found: true,
      valid: isValid,
      surat: {
        id: surat.id,
        nomor_surat: surat.nomor_surat,
        jenis_surat: surat.jenis_surat,
        perkara: surat.perkara,
        kepada: surat.kepada,
        alamat_tujuan: surat.alamat_tujuan,
        tempat_ttd: surat.tempat_ttd,
        tanggal_ttd: surat.tanggal_ttd,
        created_at: surat.created_at,
        status: surat.status,
        pejabat_nama: surat.pejabat_nama,
        pejabat_jabatan: surat.pejabat_jabatan,
        penandatangan_nama: surat.pejabat_nama,
        penandatangan_jabatan: surat.pejabat_jabatan,
        file_url: surat.file_url,
      },
      message: isValid
        ? 'Dokumen Terverifikasi Asli'
        : 'Dokumen Berstatus Draft / Belum Sah',
    };
  }

  async generateNumber(params: any) {
    const { tahun, kode1 = '', kode2 = '', kode3 = '', profil_id } = params;
    const now = new Date();
    const year = parseInt(tahun) || now.getFullYear();
    const month = now.getMonth() + 1;
    const roman = [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
    ];
    const monthRoman = roman[month - 1] || 'I';
    const monthNumber = String(month).padStart(2, '0');

    let formatTemplate =
      '{nomor}/{kode1}/{kode2}/{kode3}/{bulan_romawi}/{tahun}';
    const configWhere: any = { is_default: true };
    if (profil_id) configWhere.profil_sekolah_id = profil_id;

    const config = await this.prisma.config_surat.findFirst({
      where: configWhere,
    });
    if (config?.format_nomor_template) {
      formatTemplate = config.format_nomor_template;
    }

    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const allLetters = await this.prisma.surat.findMany({
      where: { created_at: { gte: yearStart } },
      select: { nomor_surat: true, nomor_urut: true },
    });

    let maxSaved = 0;
    for (const item of allLetters) {
      const uNum = Number(item.nomor_urut);
      if (!isNaN(uNum) && uNum > maxSaved) maxSaved = uNum;
      if (item.nomor_surat) {
        const firstPart = parseInt(item.nomor_surat.split('/')[0]);
        if (!isNaN(firstPart) && firstPart > maxSaved) maxSaved = firstPart;
      }
    }

    let nextNumber = maxSaved + 1;

    const formatNomor = (num: number) => {
      let res = formatTemplate;
      const values: Record<string, string> = {
        nomor: String(num).padStart(3, '0'),
        kode1,
        kode2,
        kode3,
        bulan_romawi: monthRoman,
        bulan: monthNumber,
        tahun: String(year),
      };
      for (const [k, v] of Object.entries(values)) {
        res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '');
      }
      return res.replace(/\/{2,}/g, '/').replace(/\/$/, '');
    };

    let finalNumber = nextNumber;
    let found = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!found && attempts < maxAttempts) {
      attempts++;
      const candidate = formatNomor(finalNumber);
      const duplicate = await this.prisma.surat.findFirst({
        where: {
          nomor_surat: candidate,
          status: { in: ['DRAFT', 'FINAL'] },
        },
      });
      if (duplicate) {
        finalNumber++;
      } else {
        found = true;
      }
    }

    // Upsert nomor urut terbaru ke nomor_surat_sequence
    await this.prisma.nomor_surat_sequence
      .upsert({
        where: {
          tahun_kategori_bagian: {
            tahun: year,
            kategori: 'GLOBAL',
            bagian: 'GLOBAL',
          },
        },
        create: {
          tahun: year,
          kategori: 'GLOBAL',
          bagian: 'GLOBAL',
          last_number: finalNumber,
          updated_at: new Date(),
        },
        update: {
          last_number: finalNumber,
          updated_at: new Date(),
        },
      })
      .catch((e) => {
        // Abaikan jika sequence update gagal
      });

    const formattedNumber = formatNomor(finalNumber);
    return {
      ok: true,
      data: {
        nomor_surat: formattedNumber,
        nomor_urut: finalNumber,
        tahun: year,
        kode1,
        kode2,
        kode3,
        bulan_romawi: monthRoman,
      },
    };
  }

  async getGuru(query: any) {
    const { guru_id, limit = '500', periode } = query || {};
    if (!guru_id) {
      const data = await this.prisma.master_guru.findMany({
        where: { aktif: true },
        select: { id: true, nama_lengkap: true, nip: true },
        orderBy: { nama_lengkap: 'asc' },
        take: parseInt(limit),
      });
      return { ok: true, data };
    }

    // Jika guru_id diisi, ambil riwayat surat yang berkaitan dengan guru tsb
    const where: any = {
      OR: [
        { penandatangan_id: guru_id },
        { penandatangan_nip: guru_id },
        {
          lampiran_guru_ids: {
            array_contains: guru_id,
          },
        },
      ],
    };

    if (periode) {
      const [year, month] = periode.split('-');
      const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = new Date(
        `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`,
      );
      where.tanggal_surat = {
        gte: startDate,
        lte: endDate,
      };
    }

    const data = await this.prisma.surat.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
    });

    return { ok: true, data };
  }

  async getSiswa(query: any) {
    const { q, limit = '500' } = query || {};
    const where: any = { aktif: true };
    if (q) {
      where.nama_lengkap = { contains: q, mode: 'insensitive' };
    }

    const data = await this.prisma.master_siswa.findMany({
      where,
      select: { id: true, nama_lengkap: true, nisn: true },
      orderBy: { nama_lengkap: 'asc' },
      take: parseInt(limit),
    });

    return { ok: true, data };
  }

  // ── Permintaan Surat ────────────────────────────────────────

  async getPermintaanList(query: any) {
    const { status, jenis, q } = query || {};
    const where: any = {};
    if (status) where.status = status;
    if (jenis) where.jenis_surat = jenis;
    if (q) {
      where.OR = [
        { judul: { contains: q, mode: 'insensitive' } },
        { pemohon_nama: { contains: q, mode: 'insensitive' } },
      ];
    }
    const data = await this.prisma.permintaan_surat.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return { ok: true, data };
  }

  async getPermintaanById(id: string) {
    const data = await this.prisma.permintaan_surat.findUnique({
      where: { id },
    });
    if (!data) throw new NotFoundException('Permintaan surat tidak ditemukan');
    return { ok: true, data };
  }

  async createPermintaan(body: any, user: any) {
    const {
      jenis_surat,
      judul,
      keperluan,
      data_json = {},
      lampiran_json = [],
    } = body;
    if (!jenis_surat || !judul || !keperluan) {
      throw new BadRequestException(
        'jenis_surat, judul, dan keperluan wajib diisi',
      );
    }
    const data = await this.prisma.permintaan_surat.create({
      data: {
        jenis_surat,
        judul,
        keperluan,
        pemohon_nip: user.nip || '',
        pemohon_nama: user.nama || user.nama_lengkap || '',
        pemohon_role: user.roles?.[0] || user.role || 'GURU',
        data_json,
        lampiran_json,
        status: 'MENUNGGU',
        created_by: user.auth_id || String(user.id),
      },
    });
    return { ok: true, data };
  }

  async updatePermintaan(id: string, body: any, user: any) {
    const existing = await this.prisma.permintaan_surat.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Permintaan surat tidak ditemukan');

    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : String(user.role || '')
          .split(/[,|]/)
          .map((r: string) => r.trim().toUpperCase());
    const isAdminOrLayanan =
      userRoles.includes('ADMIN') ||
      userRoles.includes('ADMINISTRATOR') ||
      userRoles.includes('OP_LAYANAN');
    const isOwner =
      existing.created_by === (user.auth_id || String(user.id)) ||
      existing.pemohon_nip === user.nip;

    if (!isAdminOrLayanan && !isOwner) {
      throw new ForbiddenException(
        'Anda tidak memiliki akses untuk mengubah permohonan ini',
      );
    }

    const updateData: any = {
      updated_at: new Date(),
      updated_by: user.auth_id || String(user.id),
    };

    if (body.status !== undefined) {
      if (!isAdminOrLayanan) {
        throw new ForbiddenException(
          'Hanya admin atau operator layanan yang dapat mengubah status',
        );
      }
      updateData.status = body.status;
      if (body.status === 'DISETUJUI' || body.status === 'DITOLAK') {
        updateData.approved_by = user.nama || user.nama_lengkap || user.nip;
        updateData.approved_at = new Date();
      }
    }
    if (body.status_catatan !== undefined)
      updateData.status_catatan = body.status_catatan;
    if (body.approved_catatan !== undefined)
      updateData.approved_catatan = body.approved_catatan;
    if (body.nomor_surat !== undefined)
      updateData.nomor_surat = body.nomor_surat;
    if (body.judul !== undefined) updateData.judul = body.judul;
    if (body.keperluan !== undefined) updateData.keperluan = body.keperluan;
    if (body.data_json !== undefined) updateData.data_json = body.data_json;
    if (body.lampiran_json !== undefined)
      updateData.lampiran_json = body.lampiran_json;

    const data = await this.prisma.permintaan_surat.update({
      where: { id },
      data: updateData,
    });
    return { ok: true, data };
  }

  async deletePermintaan(id: string, user: any) {
    const existing = await this.prisma.permintaan_surat.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Permintaan surat tidak ditemukan');

    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : String(user.role || '')
          .split(/[,|]/)
          .map((r: string) => r.trim().toUpperCase());
    const isAdminOrLayanan =
      userRoles.includes('ADMIN') ||
      userRoles.includes('ADMINISTRATOR') ||
      userRoles.includes('OP_LAYANAN');
    const isOwner =
      existing.created_by === (user.auth_id || String(user.id)) ||
      existing.pemohon_nip === user.nip;

    if (!isAdminOrLayanan && !isOwner) {
      throw new ForbiddenException(
        'Anda tidak memiliki akses untuk membatalkan permohonan ini',
      );
    }

    await this.prisma.permintaan_surat.delete({ where: { id } });
    return { ok: true, message: 'Permintaan surat berhasil dihapus' };
  }

  // ── Konfigurasi Surat ───────────────────────────────────────

  async getConfigSurat(profilId?: string) {
    let config = null;
    if (profilId) {
      config = await this.prisma.config_surat.findFirst({
        where: { profil_sekolah_id: profilId },
      });
    } else {
      config = await this.prisma.config_surat.findFirst({
        where: { is_default: true },
      });
      if (!config) {
        config = await this.prisma.config_surat.findFirst();
      }
    }

    const templates: any[] = [];
    return { ok: true, data: config ? { ...config, templates } : null };
  }

  async saveConfigSurat(body: any) {
    const {
      id,
      profil_sekolah_id,
      background_url,
      logo_url,
      logo_kecil_url,
      logo_qr_url,
      header_text,
      footer_text,
      format_nomor_template,
      kode1_options,
      kode2_options,
      kode3_options,
      bagian_default,
      pejabat_default_id,
      pejabat_default_nama,
      pejabat_default_jabatan,
      pejabat_default_nip,
      is_default,
    } = body;

    const data: any = {
      updated_at: new Date(),
    };

    if (background_url !== undefined) data.background_url = background_url;
    if (logo_url !== undefined) data.logo_url = logo_url;
    if (logo_kecil_url !== undefined) data.logo_kecil_url = logo_kecil_url;
    if (logo_qr_url !== undefined) data.logo_qr_url = logo_qr_url;
    if (header_text !== undefined) data.header_text = header_text;
    if (footer_text !== undefined) data.footer_text = footer_text;
    if (format_nomor_template !== undefined)
      data.format_nomor_template = format_nomor_template;
    if (bagian_default !== undefined) data.bagian_default = bagian_default;
    if (kode1_options !== undefined)
      data.kode1_options =
        typeof kode1_options === 'string'
          ? kode1_options
          : JSON.stringify(kode1_options);
    if (kode2_options !== undefined)
      data.kode2_options =
        typeof kode2_options === 'string'
          ? kode2_options
          : JSON.stringify(kode2_options);
    if (kode3_options !== undefined)
      data.kode3_options =
        typeof kode3_options === 'string'
          ? kode3_options
          : JSON.stringify(kode3_options);
    if (pejabat_default_id !== undefined)
      data.pejabat_default_id = pejabat_default_id || null;
    if (pejabat_default_nama !== undefined)
      data.pejabat_default_nama = pejabat_default_nama;
    if (pejabat_default_jabatan !== undefined)
      data.pejabat_default_jabatan = pejabat_default_jabatan;
    if (pejabat_default_nip !== undefined)
      data.pejabat_default_nip = pejabat_default_nip;
    if (is_default !== undefined) data.is_default = Boolean(is_default);

    if (is_default && profil_sekolah_id) {
      await this.prisma.config_surat.updateMany({
        where: {
          profil_sekolah_id,
          ...(id ? { id: { not: id } } : {}),
        },
        data: { is_default: false },
      });
    }

    let result;
    if (id) {
      result = await this.prisma.config_surat.update({
        where: { id },
        data,
      });
    } else {
      const existing = await this.prisma.config_surat.findFirst({
        where: { is_default: true },
      });
      if (existing) {
        result = await this.prisma.config_surat.update({
          where: { id: existing.id },
          data,
        });
      } else {
        result = await this.prisma.config_surat.create({
          data: {
            ...data,
            profil_sekolah_id: profil_sekolah_id,
            is_default: true,
            created_at: new Date(),
          },
        });
      }
    }

    return { ok: true, data: result };
  }

  async getJenisSuratDropdown() {
    const data = await this.prisma.master_dropdown.findMany({
      where: { jenis_surat: { not: null } },
      select: { id: true, jenis_surat: true, urutan: true },
      orderBy: { urutan: 'asc' },
    });
    const result = data
      .filter((row) => row.jenis_surat)
      .map((row) => ({
        kode: row.jenis_surat!.toUpperCase().replace(/\s+/g, '_'),
        nama: row.jenis_surat,
      }));
    return { ok: true, data: result };
  }

  async getSuratForPdf(suratId?: string) {
    let suratData: any = null;
    if (suratId) {
      suratData = await this.prisma.surat.findUnique({
        where: { id: String(suratId) },
      });
    }

    const configData = await this.prisma.config_surat.findFirst({
      where: { is_default: true },
    });

    const guruList = await this.prisma.master_guru.findMany({ select: { id: true, nama_lengkap: true, nip: true } });
    const siswaList = await this.prisma.master_siswa.findMany({ select: { id: true, nama_lengkap: true, nisn: true } });

    return {
      ok: true,
      suratData: suratData ? { ...suratData, id: suratData.id.toString() } : null,
      configData,
      guruList: guruList.map((g) => ({ ...g, id: g.id.toString(), nama: g.nama_lengkap })),
      siswaList: siswaList.map((s) => ({ ...s, id: s.id.toString(), nama: s.nama_lengkap })),
    };
  }
}

