import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EkskulService } from './ekskul.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  aksesDiizinkan,
  parseKonfigurasiAkses,
  PENGATURAN_DATA_ACCESS_KEYS,
  PENGATURAN_TUGAS_ACCESS_KEYS,
} from '../auth/feature-access.guard';
import { MASTER_EKSKUL_ACCESS_KEY } from '../master/master.controller';

@ApiTags('Ekskul')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ekskul')
export class EkskulController {
  constructor(
    private readonly ekskulService: EkskulService,
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService,
  ) {}

  private async getUserRoles(req: any) {
    const access = await this.accessService.resolveUserAccess(req.user);
    return access.roles;
  }

  /**
   * Boleh mengelola DAFTAR master ekskul (tab Ekstrakurikuler di Master Data).
   *
   * Hanya ADMIN yang melekat di kode — dijamin `aksesDiizinkan`, yang meloloskan
   * ADMIN tanpa bisa dicabut. Pengelola lainnya ditunjuk di Pengaturan Users →
   * Hak Akses Fitur → "Master Data: Ekstrakurikuler".
   *
   * PERHATIAN: `EkskulService.isManager` (ADMIN / ADMINISTRATOR / WKM_KESISWAAN)
   * TIDAK dipakai di sini, dan kini juga tidak di tab Siswa Ekskul maupun Pembina
   * Ekskul. WKM Kesiswaan karena itu perlu ditunjuk di layar tersebut untuk
   * ketiganya. `isManager` sendiri tetap utuh di halaman Ekstrakurikuler, untuk
   * pembatasan DATA (peserta yang boleh dilihat pembina, kepemilikan sesi
   * pertemuan, pengesahan laporan) — halaman itu di luar cakupan aturan ini.
   */
  private async bolehKelolaMasterEkskul(req: any): Promise<boolean> {
    const [roles, konfigRow] = await Promise.all([
      this.getUserRoles(req),
      this.prisma.site_settings.findUnique({
        where: { key: MASTER_EKSKUL_ACCESS_KEY },
        select: { value: true },
      }),
    ]);

    return aksesDiizinkan({ ...req.user, roles }, parseKonfigurasiAkses(konfigRow?.value));
  }

  /**
   * Boleh mengelola PENUGASAN PEMBINA, yaitu tab "Pembina Ekskul" di halaman
   * Pengaturan Tugas.
   *
   * Hanya ADMIN yang melekat di kode — dijamin `aksesDiizinkan`, yang meloloskan
   * ADMIN tanpa bisa dicabut. Sisanya ditunjuk di Pengaturan Users -> Hak Akses
   * Fitur -> "Pengaturan Tugas: Pembina Ekskul".
   *
   * `EkskulService.isManager` TIDAK dipakai di sini. Ia meloloskan WKM_KESISWAAN
   * secara melekat di kode, dan itu sudah dicabut: WKM Kesiswaan kini perlu
   * ditunjuk di layar tersebut seperti role lainnya.
   *
   * Penugasan pembina menulis `tugas_tambahan` dengan
   * `granted_role: 'PEMBINA_EKSKUL'`, jadi ini ikut menentukan role — wewenangnya
   * sengaja disejajarkan dengan tab Tugas Tambahan.
   */
  private async bolehKelolaPembina(req: any, roles: string[]): Promise<boolean> {
    const konfigRow = await this.prisma.site_settings.findUnique({
      where: { key: PENGATURAN_TUGAS_ACCESS_KEYS.pembina_ekskul },
      select: { value: true },
    });
    return aksesDiizinkan({ ...req.user, roles }, parseKonfigurasiAkses(konfigRow?.value));
  }

  /**
   * Boleh bertindak atas kepesertaan ekskul MILIK ORANG LAIN, yaitu apa yang
   * dilakukan tab "Siswa Ekskul" di halaman Pengaturan Data.
   *
   * Hanya ADMIN yang melekat di kode; sisanya ditunjuk di Pengaturan Users -> Hak
   * Akses Fitur. `EkskulService.isManager` tidak dipakai di sini — jalur
   * WKM_KESISWAAN yang dulu melekat di kode sudah dicabut.
   *
   * Tanpa jalur kedua, menunjuk seseorang sebagai pengelola tab itu hanya membuka
   * tabnya: daftarnya menyusut jadi kepesertaan dirinya sendiri, lalu tombol
   * tambah dan hapus gagal dengan "Data siswa tidak ditemukan" — karena
   * `upsertEkskulSiswa` memaksa `siswa_id` ke milik pemanggil, dan untuk seorang
   * pegawai pencarian NISN itu selalu kosong. Ketimpangan itu dulu tidak terlihat
   * sebab tab ini hanya bisa dipakai ADMIN dan WKM Kesiswaan.
   *
   * Yang TIDAK berubah: `POST/DELETE /ekskul/siswa` tetap terbuka untuk siswa
   * mendaftar dan membatalkan diri sendiri — di jalur itu `EkskulService` tetap
   * memaksa `siswa_id` ke miliknya dan memeriksa kepemilikan per baris.
   */
  private async bolehKelolaPeserta(req: any, roles: string[]): Promise<boolean> {
    const konfigRow = await this.prisma.site_settings.findUnique({
      where: { key: PENGATURAN_DATA_ACCESS_KEYS.ekskul_siswa },
      select: { value: true },
    });
    return aksesDiizinkan({ ...req.user, roles }, parseKonfigurasiAkses(konfigRow?.value));
  }

  /**
   * Izin pemanggil untuk halaman Ekstrakurikuler, supaya UI tidak lagi menebak
   * dari daftar role sendiri (dulu hardcode ADMIN/WKM_KESISWAAN, yang tidak
   * cocok dengan aturan server).
   *
   * - `kelolaSemua`: `EkskulService.isManager` — melihat semua ekskul,
   *   pertemuan & absensinya, dan tab Approval.
   * - `kelolaPeserta`: Hak Akses Fitur "Siswa Ekskul" — mengatur peserta ekskul
   *   mana pun. Pembina selalu boleh mengatur peserta ekskul yang ia bina.
   */
  @Get('izin-saya')
  @ApiOperation({ summary: 'Izin pemanggil di halaman Ekstrakurikuler' })
  async getIzinSaya(@Request() req: any) {
    const roles = await this.getUserRoles(req);
    const kelolaPeserta = await this.bolehKelolaPeserta(req, roles);
    return {
      ok: true,
      data: { kelolaSemua: this.ekskulService.isManager(roles), kelolaPeserta },
    };
  }

  // --- Ekskul (Master) ---

  @Get()
  @ApiOperation({ summary: 'Daftar master ekskul' })
  async getEkskul(@Query('aktif') aktif?: string) {
    return { ok: true, data: await this.ekskulService.getEkskulList(aktif) };
  }

  @Post()
  @ApiOperation({ summary: 'Tambah atau ubah master ekskul' })
  async upsertEkskul(@Request() req: any, @Body() body: any) {
    if (!(await this.bolehKelolaMasterEkskul(req))) {
      throw new ForbiddenException(
        'Anda tidak berwenang mengelola daftar ekskul. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }
    return { ok: true, data: await this.ekskulService.upsertEkskul(body) };
  }

  @Delete()
  @ApiOperation({ summary: 'Hapus master ekskul (confirm=cascade bila masih ada isinya)' })
  async deleteEkskul(
    @Request() req: any,
    @Query('id') id: string,
    @Query('confirm') confirm?: string,
  ) {
    if (!(await this.bolehKelolaMasterEkskul(req))) {
      throw new ForbiddenException(
        'Anda tidak berwenang menghapus ekskul. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }
    return await this.ekskulService.deleteEkskul(String(id ?? ''), String(confirm ?? ''));
  }

  // --- Ekskul Siswa ---

  @Get('siswa')
  @ApiOperation({ summary: 'Daftar relasi siswa ekskul' })
  async getEkskulSiswa(
    @Request() req: any,
    @Query('ekskul_id') ekskul_id?: string,
    @Query('siswa_id') siswa_id?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('semester') semester?: string,
    @Query('distinct') distinct?: string,
  ) {
    const roles = await this.getUserRoles(req);
    const nip = req.user.nip || req.user.username || '';
    const nisn = req.user.nisn || req.user.username || '';
    // Membaca saja: pengelola halaman Ekstrakurikuler (isManager) sudah melihat
    // pertemuan & absensi — berisi nama siswa — dari ekskul mana pun, jadi daftar
    // pesertanya ikut terbuka. Menulis tetap butuh `bolehKelolaPeserta` atau
    // status pembina ekskul itu.
    const bolehBaca =
      (await this.bolehKelolaPeserta(req, roles)) || this.ekskulService.isManager(roles);

    // We parse bigints to string before returning via a custom replacer
    const data = await this.ekskulService.getEkskulSiswaList(nip, nisn, {
      ekskul_id,
      siswa_id,
      tahun_ajaran,
      semester,
      distinct,
    }, bolehBaca);
    
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Post('siswa')
  @ApiOperation({ summary: 'Tambah atau ubah data siswa ekskul' })
  async upsertEkskulSiswa(@Request() req: any, @Body() body: any) {
    const roles = await this.getUserRoles(req);
    const nip = req.user.nip || req.user.username || '';
    const nisn = req.user.nisn || req.user.username || '';

    const bolehKelola = await this.bolehKelolaPeserta(req, roles);
    const data = await this.ekskulService.upsertEkskulSiswa(nip, nisn, body, bolehKelola);
    
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Get('kandidat')
  @ApiOperation({ summary: 'Calon peserta (siswa per kelas) untuk ditambahkan pembina ke ekskulnya' })
  async getKandidat(
    @Request() req: any,
    @Query('ekskul_id') ekskul_id?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('semester') semester?: string,
  ) {
    const roles = await this.getUserRoles(req);
    const bolehKelola = await this.bolehKelolaPeserta(req, roles);
    const data = await this.ekskulService.getKandidatPeserta(req.user.nip || req.user.username || '', bolehKelola, {
      ekskul_id,
      tahun_ajaran,
      semester,
    });
    return { ok: true, data };
  }

  @Post('siswa/tambah')
  @ApiOperation({ summary: 'Tambah beberapa peserta ke satu ekskul (pembina ekskul itu / pengelola)' })
  async tambahPeserta(@Request() req: any, @Body() body: any) {
    const roles = await this.getUserRoles(req);
    const bolehKelola = await this.bolehKelolaPeserta(req, roles);
    return this.ekskulService.tambahPesertaEkskul(req.user.nip || req.user.username || '', bolehKelola, body);
  }

  @Delete('siswa')
  @ApiOperation({ summary: 'Hapus relasi siswa ekskul' })
  async deleteEkskulSiswa(@Request() req: any, @Query('id') id: string) {
    const roles = await this.getUserRoles(req);
    const nip = req.user.nip || req.user.username || '';
    const nisn = req.user.nisn || req.user.username || '';

    const bolehKelola = await this.bolehKelolaPeserta(req, roles);
    return await this.ekskulService.deleteEkskulSiswa(nip, nisn, id, bolehKelola);
  }

  // --- Ekskul Pembina ---

  @Get('pembina')
  @ApiOperation({ summary: 'Daftar pembina ekskul (non-pengelola: hanya penugasan sendiri)' })
  async getPembina(
    @Request() req: any,
    @Query('ekskul_id') ekskul_id?: string,
    @Query('nip') nip?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('semester') semester?: string,
  ) {
    const roles = await this.getUserRoles(req);
    const bolehKelola = await this.bolehKelolaPembina(req, roles);
    const data = await this.ekskulService.getPembinaList(bolehKelola, req.user.nip || '', {
      ekskul_id,
      nip,
      tahun_ajaran,
      semester,
    });
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Post('pembina')
  @ApiOperation({ summary: 'Tambah atau ubah pembina ekskul' })
  async upsertPembina(@Request() req: any, @Body() body: any) {
    const roles = await this.getUserRoles(req);
    const bolehKelola = await this.bolehKelolaPembina(req, roles);
    const data = await this.ekskulService.upsertPembina(body, bolehKelola);
    return JSON.parse(
      JSON.stringify({ ok: true, data }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  @Delete('pembina')
  @ApiOperation({ summary: 'Hapus pembina ekskul' })
  async deletePembina(@Request() req: any, @Query('id') id: string) {
    const roles = await this.getUserRoles(req);
    const bolehKelola = await this.bolehKelolaPembina(req, roles);
    return await this.ekskulService.deletePembina(id, bolehKelola);
  }

  // --- Pertemuan & Absensi ---

  @Get('pertemuan')
  @ApiOperation({ summary: 'Daftar pertemuan ekskul' })
  async getPertemuan(
    @Request() req: any,
    @Query('ekskul_id') ekskul_id?: string,
    @Query('submission_id') submission_id?: string,
    @Query('tahun_ajaran') tahun_ajaran?: string,
    @Query('semester') semester?: string,
  ) {
    const data = await this.ekskulService.getPertemuanList(req.user, {
      ekskul_id,
      submission_id,
      tahun_ajaran,
      semester,
    });
    return { ok: true, data };
  }

  @Post('pertemuan')
  @ApiOperation({ summary: 'Simpan / update pertemuan ekskul' })
  async upsertPertemuan(@Request() req: any, @Body() body: any) {
    const data = await this.ekskulService.upsertPertemuan(req.user, body);
    return { ok: true, data };
  }

  @Delete('pertemuan')
  @ApiOperation({ summary: 'Hapus pertemuan ekskul' })
  async deletePertemuan(@Request() req: any, @Query('id') id: string) {
    return await this.ekskulService.deletePertemuan(req.user, id);
  }

  @Get('absensi')
  @ApiOperation({ summary: 'Ambil absensi pertemuan ekskul' })
  async getAbsensi(@Request() req: any, @Query('pertemuan_id') pertemuan_id: string) {
    return await this.ekskulService.getAbsensiPertemuan(req.user, pertemuan_id);
  }

  @Post('absensi')
  @ApiOperation({ summary: 'Simpan absensi pertemuan ekskul' })
  async saveAbsensi(@Request() req: any, @Body() body: any) {
    const data = await this.ekskulService.saveAbsensiPertemuan(req.user, body);
    return { ok: true, data };
  }

  // --- Approval & Submissions ---

  @Post('approval')
  @ApiOperation({ summary: 'Approve atau revisi laporan ekskul' })
  async approveSubmission(@Request() req: any, @Body() body: any) {
    return await this.ekskulService.approveSubmission(req.user, body);
  }

  @Post('report-data')
  @ApiOperation({ summary: 'Ambil data lengkap untuk laporan PDF ekskul' })
  async getReportData(@Request() req: any, @Body() body: any) {
    return await this.ekskulService.getReportData(req.user, body);
  }

  @Post('update-pdf')
  @ApiOperation({ summary: 'Update URL PDF laporan ekskul' })
  async updatePdfUrl(@Request() req: any, @Body() body: any) {
    const data = await this.ekskulService.updatePdfUrl(req.user, body.submissionId || body.id, body.pdf_url);
    return { ok: true, data };
  }
}
