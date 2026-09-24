import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from '../access/access.service';

export const PAGE_ACCESS_KEY = 'page_access_key';

/**
 * Batasi endpoint ke pemegang halaman tertentu (`role_pages.page_id`).
 *
 * Banyak controller memasang `JwtAuthGuard` lalu berhenti di situ — artinya
 * sesi apa pun yang sah boleh membaca DAN menulis, termasuk peran seperti
 * SISWA atau TAMU yang menunya tidak pernah menampilkan modul itu. Pola
 * pemeriksaannya sudah ada, tapi ditulis ulang inline di MasterController;
 * guard ini mengangkatnya jadi satu tempat supaya controller lain tidak perlu
 * menyalinnya.
 *
 * Sumber kebenarannya tetap `role_pages` — daftar yang sama yang dipakai
 * sidebar dan diatur admin lewat layar Pengaturan Users. Tidak ada daftar peran
 * yang dihardcode di controller.
 *
 *   @UseGuards(JwtAuthGuard, PageAccessGuard)
 *   @RequiresPage('e-supervisi')
 *
 * Boleh disebut lebih dari satu halaman; salah satu cukup. Dipasang di method
 * akan menimpa yang dipasang di kelas — dipakai saat hanya operasi tulis yang
 * perlu dibatasi sedangkan bacanya dikonsumsi lintas halaman.
 */
export const RequiresPage = (...pageIds: string[]) => SetMetadata(PAGE_ACCESS_KEY, pageIds);

@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const pageIds = this.reflector.getAllAndOverride<string[]>(PAGE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!pageIds?.length) return true;

    const req = context.switchToHttp().getRequest();

    // Pemanggilan antar-service dilewatkan, mengikuti JwtAuthGuard dan
    // RolesGuard. Catatan penting: proxy Next yang memakai kunci internal
    // karena itu TIDAK terlindungi guard ini — gerbangnya harus dipasang di
    // route handler Next-nya sendiri.
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (expectedKey && req.headers['x-internal-key'] === expectedKey) return true;

    if (!req.user) {
      throw new ForbiddenException('Sesi tidak dikenali');
    }

    const access = await this.accessService.resolveUserAccess(req.user);
    if (access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR')) return true;
    if (pageIds.some((p) => access.pageIds.includes(p))) return true;

    throw new ForbiddenException('Anda tidak memiliki izin mengakses modul ini');
  }
}
