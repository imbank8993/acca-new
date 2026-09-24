import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Role yang menandai akun siswa. */
const ROLE_SISWA = ['SISWA'];

/**
 * Role yang bukan pegawai madrasah, tetapi BOLEH berdampingan dengan role pegawai.
 *
 * `ORANG_TUA` ada di sini, bukan di `ROLE_SISWA`: ada akun `TU,ORANG_TUA` —
 * pegawai TU yang juga orang tua siswa — dan dia tetap harus dapat akses pegawai.
 * `TAMU` ikut karena akun tamu tidak mewakili pegawai mana pun.
 *
 * Daftar yang sama sudah tersalin di MasterController dan SettingsController;
 * guard ini ada supaya penyalinan berikutnya tidak perlu terjadi.
 */
const BUKAN_PEGAWAI = ['ORANG_TUA', 'ORANGTUA', 'TAMU'];

/**
 * Batasi endpoint ke pegawai madrasah saja.
 *
 * Dipasang BERDAMPINGAN dengan `PageAccessGuard`, bukan menggantikannya. Alasannya
 * ada pada semantik `PageAccessGuard`: ia meloloskan pemanggil yang memegang SALAH
 * SATU halaman yang disebut, sehingga `@RequiresPage(...)` dengan beberapa halaman
 * MELEBARKAN akses, bukan mempersempitnya. Gerbang halaman juga bersumber dari
 * `role_pages`, yang isinya mengatur NAVIGASI — daftar itu bisa memuat role tamu,
 * dan pada kenyataannya memang memuatnya.
 *
 * Akibat nyatanya di modul ketidakhadiran: role `TAMU` memegang halaman
 * `ketidakhadiran`, jadi ia lolos setiap gerbang yang menyebut halaman itu —
 * termasuk POST, PATCH, dan DELETE. Akun tamu punya akses tulis penuh atas data
 * ketidakhadiran siswa, dan bisa membaca NISN yang merupakan username login siswa.
 *
 * Guard ini menutup celah itu tanpa menyentuh `role_pages`: siapa yang berwenang
 * tetap diatur admin, tapi seorang tamu tidak pernah bisa menjadi pengelola data
 * pegawai hanya karena satu baris navigasi.
 */
@Injectable()
export class PegawaiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Pemanggilan antar-service dilewatkan, mengikuti JwtAuthGuard dan
    // PageAccessGuard. Proxy Next yang memakai kunci internal karena itu TIDAK
    // terlindungi guard ini — gerbangnya harus ada di route handler Next-nya.
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (expectedKey && req.headers['x-internal-key'] === expectedKey) return true;

    if (!req.user) throw new ForbiddenException('Sesi tidak dikenali');

    // `roles` dari JwtStrategy sudah termasuk duty role (wali kelas, guru asuh).
    // Cadangannya mengurai kolom mentah `role` yang berisi beberapa role
    // dipisah koma — perbandingan seluruh string tidak pernah cocok di basis data
    // ini, karena tidak ada satu pun akun yang rolenya tepat `'ADMIN'` saja.
    const roles: string[] = Array.isArray(req.user?.roles)
      ? req.user.roles.map((r: string) => String(r).toUpperCase())
      : req.user?.role
        ? String(req.user.role)
            .split(/[,|]/)
            .map((r: string) => r.trim().toUpperCase())
            .filter(Boolean)
        : [];

    const isSiswa = roles.some((r) => ROLE_SISWA.includes(r));
    const isPegawai = !isSiswa && roles.some((r) => !BUKAN_PEGAWAI.includes(r));

    if (!isPegawai) {
      throw new ForbiddenException('Bagian ini hanya untuk guru & pegawai madrasah');
    }
    return true;
  }
}
