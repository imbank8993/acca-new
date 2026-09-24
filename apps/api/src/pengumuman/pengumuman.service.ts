import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  FeatureAccessGuard,
  PENGUMUMAN_KELOLA_KEY,
  aksesDiizinkan,
} from '../auth/feature-access.guard';
import sanitizeHtml = require('sanitize-html');

@Injectable()
export class PengumumanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess?: FeatureAccessGuard,
    private readonly audit?: AuditService,
  ) {}

  private sanitize(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'width', 'height']
      }
    });
  }

  async bolehKelola(user: any): Promise<boolean> {
    if (!this.featureAccess) return true;
    const konfig = await this.featureAccess.bacaKonfigurasi(PENGUMUMAN_KELOLA_KEY);
    return aksesDiizinkan(user, konfig, ['OP_PENGUMUMAN']);
  }

  async getAllPengumumanForManage() {
    const data = await this.prisma.pengumuman.findMany({
      orderBy: [
        { pinned: 'desc' },
        { updated_at: 'desc' }
      ]
    });

    const mapped = data.map(p => ({ ...p, content: this.sanitize(p.content || '') }));

    mapped.sort((a: any, b: any) => {
      const aPinned = a.pinned === true;
      const bPinned = b.pinned === true;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return { ok: true, data: JSON.parse(JSON.stringify(mapped, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
  }

  async getPengumuman(roleFilter?: string) {
    return this.getPengumumanMultipleRoles(roleFilter ? [roleFilter] : undefined);
  }

  async getPengumumanMultipleRoles(roleFilters?: string[]) {
    let data = await this.prisma.pengumuman.findMany({
      orderBy: [
        { pinned: 'desc' },
        { updated_at: 'desc' }
      ]
    });

    if (roleFilters !== undefined) {
      const upperFilters = roleFilters.map(r => r.toUpperCase());
      data = data.filter((p: any) => {
        if (!p.target_roles || !Array.isArray(p.target_roles) || p.target_roles.length === 0) return true; // public
        return p.target_roles.some((r: string) => upperFilters.includes(r.toUpperCase()));
      });
    }
    
    data = data.map(p => ({ ...p, content: this.sanitize(p.content || '') }));

    data.sort((a: any, b: any) => {
      const aPinned = a.pinned === true;
      const bPinned = b.pinned === true;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return { ok: true, data: JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
  }

  async createPengumuman(user: any, body: any) {
    const { title, content, category, pinned, target_roles } = body;

    if (!title || !content) {
      throw new BadRequestException('Judul dan isi pengumuman wajib diisi');
    }

    const normalizedRoles = Array.isArray(target_roles)
      ? target_roles.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean)
      : [];

    const data = await this.prisma.pengumuman.create({
      data: {
        title,
        content: this.sanitize(content),
        category: category || 'Umum',
        pinned: pinned || false,
        target_roles: normalizedRoles,
        created_by: user.nama || 'ADMIN',
        created_by_nip: user.nip || 'ADMIN',
      }
    });

    return { ok: true, data: JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
  }

  async updatePengumuman(idStr: string, body: any) {
    const { title, content, category, pinned, target_roles } = body;

    if (!title || !content) {
      throw new BadRequestException('Judul dan isi pengumuman wajib diisi');
    }

    const id = BigInt(idStr);

    const updateData: any = {
      title,
      content: this.sanitize(content),
      category: category || 'Umum',
      pinned: pinned || false,
      updated_at: new Date()
    };
    
    if (target_roles !== undefined) {
      updateData.target_roles = Array.isArray(target_roles)
        ? target_roles.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean)
        : [];
    }

    const data = await this.prisma.pengumuman.update({
      where: { id },
      data: updateData
    });

    return { ok: true, data: JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
  }

  async deletePengumuman(idStr: string, user?: any, req?: any) {
    const id = BigInt(idStr);
    const existing = await this.prisma.pengumuman.findUnique({
      where: { id }
    }).catch(() => null);

    await this.prisma.pengumuman.delete({
      where: { id }
    });

    if (existing && this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_PENGUMUMAN',
        entity: 'pengumuman',
        entityId: idStr,
        details: {
          title: existing.title,
          category: existing.category,
          pinned: existing.pinned,
          target_roles: existing.target_roles,
          created_by: existing.created_by,
          created_by_nip: existing.created_by_nip,
        },
      });
    }

    return { ok: true, message: 'Announcement deleted successfully' };
  }
}
