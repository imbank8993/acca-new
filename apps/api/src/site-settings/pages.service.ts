import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const EXCLUDE_PATTERNS = [
  'login', 'page.tsx', 'layout.tsx', 'loading.tsx',
  'api', 'admin/api', 'auth', 'link-auth', 'verifikasi',
];

const ONLY_TOP_LEVEL = false;

const ICON_MAP: Record<string, string> = {
  'dashboard': 'bi-house',
  'jurnal': 'bi-journal-text',
  'absensi': 'bi-clipboard-check',
  'nilai': 'bi-graph-up',
  'piket': 'bi-calendar-week',
  'lckh': 'bi-file-earmark-check',
  'lckh-approval': 'bi-clipboard-check-fill',
  'pembayaran': 'bi-cash-coin',
  'informasi': 'bi-info-circle',
  'ketidakhadiran': 'bi-calendar-x',
  'master': 'bi-database',
  'pengaturan-data': 'bi-gear',
  'pengaturan-tugas': 'bi-person-check',
  'pengaturan-users': 'bi-people',
  'monitoring': 'bi-eye',
  'tugas-tambahan': 'bi-star',
  'rekap-jurnal': 'bi-bar-chart',
  'kinerja-guru': 'bi-graph-up-arrow',
  'guru-asuh': 'bi-person-heart',
  'wali-kelas': 'bi-mortarboard-fill',
  'nilai-siswa': 'bi-award',
  'kehadiran-siswa': 'bi-calendar-check',
  'tugas-siswa': 'bi-list-task',
  'izin-guru': 'bi-calendar-plus',
  'surat': 'bi-file-earmark-word',
  'ujian-madrasah': 'bi-file',
  'unggah-dokumen': 'bi-folder-open',
  'catatan-keuangan': 'bi-wallet2',
  'klinik': 'bi-heart-pulse',
  'layanan-ptsp': 'bi-building',
  'ekskul': 'bi-person-plus',
  'kelulusan': 'bi-mortarboard',
  'agenda-madrasah': 'bi-calendar-event',
  'audit-log': 'bi-shield-check',
};

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3083FF', '#f97316', '#3b82f6', '#64748b', '#475569',
];

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  private generatePageId(relativePath: string): string {
    const segments = relativePath
      .replace(/\\/g, '/')
      .split('/')
      .filter(s => s && !s.startsWith('(') && !s.endsWith(')') && !s.includes('[') && !s.includes(']'));
    return segments.join('-');
  }

  private getDefaultIcon(pageId: string): string {
    const normalized = pageId.replace(/_/g, '-');
    return ICON_MAP[pageId] || ICON_MAP[normalized] || 'bi-folder';
  }

  private getDefaultColor(pageId: string): string {
    const hash = pageId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[hash % COLORS.length];
  }

  private formatLabel(pageId: string): string {
    return pageId
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private scanDirectory(dir: string, baseDir: string = ''): any[] {
    const pages: any[] = [];
    try {
      if (!fs.existsSync(dir)) return pages;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(baseDir, entry.name);

        if (EXCLUDE_PATTERNS.some(pattern => relativePath.includes(pattern))) continue;

        if (entry.isDirectory()) {
          if (ONLY_TOP_LEVEL && baseDir !== '') continue;

          const pageFile = path.join(fullPath, 'page.tsx');
          const viewFile = path.join(fullPath, 'view.tsx');
          
          if (fs.existsSync(pageFile) || fs.existsSync(viewFile)) {
            const generatedId = this.generatePageId(relativePath);
            if (generatedId) {
              pages.push({
                id: generatedId,
                label: this.formatLabel(generatedId),
                icon: this.getDefaultIcon(generatedId),
                color: this.getDefaultColor(generatedId),
                path: '/' + relativePath.replace(/\\/g, '/'),
              });
            }
          }
          if (!ONLY_TOP_LEVEL) {
            const subPages = this.scanDirectory(fullPath, relativePath);
            pages.push(...subPages);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
    return pages;
  }

  getPages() {
    try {
      // process.cwd() is backend root. We go up and into web/app
      const appDir = path.join(process.cwd(), '../web/app');
      if (!fs.existsSync(appDir)) {
        this.logger.warn(`App directory not found for page scanning: ${appDir}`);
        return [];
      }
      const discoveredPages = this.scanDirectory(appDir);
      return discoveredPages;
    } catch (error) {
      throw new InternalServerErrorException('Failed to scan pages');
    }
  }
}
