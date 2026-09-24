import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Batasi endpoint ke daftar role tertentu. Dipakai bersama `RolesGuard`.
 *
 * Nama role ditulis huruf besar, sama seperti yang dihasilkan `JwtStrategy`
 * dari kolom `public_users.role` (dipisah koma / pipa).
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('ADMIN', 'ADMINISTRATOR')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
