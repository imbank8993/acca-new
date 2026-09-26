import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

/**
 * Pendaftaran mandiri orang tua — sengaja TANPA JwtAuthGuard karena pemakainya
 * belum punya akun. Verifikasinya bersandar pada NISN + tanggal lahir siswa
 * (dicek di master_siswa) dan kuota klaim per siswa.
 */
@ApiTags('Registration')
@Controller('register')
export class RegisterController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Batas 5 percobaan per 10 menit per IP, jauh di bawah batas global (120/menit).
   *
   * Kuncinya di sini hanya NISN + tanggal lahir. Tanggal lahir satu angkatan
   * mencakup sekitar seribu kemungkinan, jadi dengan batas global saja satu IP
   * bisa menyisirnya habis dalam belasan menit dan mengklaim akun siswa mana pun
   * sebagai "orang tua" — lengkap dengan akses ke nilai dan absensinya. Pesan
   * galat `verifySiswa` juga disamarkan di jalur ini (lihat `registerParent`)
   * supaya kegagalan tidak memberi tahu NISN mana yang benar.
   */
  @Post('parent')
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @ApiOperation({ summary: 'Daftar akun orang tua sekaligus klaim anak' })
  async registerParent(
    @Body()
    body: {
      nama: string;
      status_keluarga: string;
      email: string;
      password: string;
      nisn: string;
      tanggal_lahir_siswa: string;
    },
  ) {
    return { ok: true, ...(await this.usersService.registerParent(body)) };
  }

  @Post('student')
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @ApiOperation({ summary: 'Aktivasi mandiri akun siswa' })
  async registerStudent(
    @Body()
    body: {
      nisn: string;
      tanggal_lahir: string;
      email: string;
      password: string;
    },
  ) {
    return { ok: true, ...(await this.usersService.registerStudent(body)) };
  }

  @Post('staff')
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @ApiOperation({ summary: 'Aktivasi mandiri akun pegawai (Guru / Tendik)' })
  async registerStaff(
    @Body()
    body: {
      nip: string;
      tanggal_lahir: string;
      digit_hp: string;
      username: string;
      email: string;
      password: string;
    },
  ) {
    return { ok: true, ...(await this.usersService.registerStaff(body)) };
  }
}
