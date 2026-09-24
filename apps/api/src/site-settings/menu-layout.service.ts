import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeGroups(raw: any): any[] | null {
    if (!Array.isArray(raw)) return null;
    const groups: any[] = [];
    raw.forEach((g: any, i: number) => {
      if (!g || !Array.isArray(g.pages)) return;
      groups.push({
        key: String(g.key || `grup-${i}`),
        label: String(g.label || 'Grup'),
        icon: String(g.icon || 'fa-folder'),
        pages: g.pages.map((p: any) => String(p)).filter((p: string) => Boolean(p)),
      });
    });
    return groups;
  }

  private sanitizeLabels(raw: any): Record<string, string> {
    const out: Record<string, string> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string' && v.trim()) out[String(k)] = v.trim().substring(0, 80);
      }
    }
    return out;
  }

  async getMenuLayout() {
    const record = await this.prisma.menu_layout.findUnique({
      where: { id: 1 },
    });

    let groupsRaw: any = null;
    let labelsRaw: any = null;

    if (record && record.layout) {
      const stored = record.layout as any;
      if (Array.isArray(stored)) {
        groupsRaw = stored;
      } else if (stored && typeof stored === 'object') {
        groupsRaw = stored.groups;
        labelsRaw = stored.labels;
      }
    }

    return {
      groups: this.sanitizeGroups(groupsRaw) || [],
      labels: this.sanitizeLabels(labelsRaw),
    };
  }

  async setMenuLayout(groups: any[], labels: Record<string, string> = {}) {
    const cleanGroups = this.sanitizeGroups(groups);
    if (!cleanGroups) throw new BadRequestException('Format layout tidak valid');
    const cleanLabels = this.sanitizeLabels(labels);

    const layoutData = { groups: cleanGroups, labels: cleanLabels };

    await this.prisma.menu_layout.upsert({
      where: { id: 1 },
      update: { layout: layoutData, updated_at: new Date() },
      create: { id: 1, layout: layoutData, updated_at: new Date() },
    });
  }
}
