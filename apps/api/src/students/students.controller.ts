import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  BadRequestException,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';
import { StudentsService } from './students.service';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly accessService: AccessService,
  ) {}

  /** Pastikan user adalah ADMIN. */
  private async assertAdmin(req: any) {
    const access = await this.accessService.resolveUserAccess(req.user);
    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
    if (!isAdmin) {
      throw new ForbiddenException('Hanya Admin yang dapat melakukan aksi ini');
    }
  }

  /**
   * GET /students/card
   * ?nisn_list=...&batch=true  → batch mode
   * ?nisn=...                  → single lookup
   */
  @Get('card')
  @ApiOperation({ summary: 'Ambil atau buat kartu siswa (batch atau single)' })
  async getCard(
    @Query('nisn_list') nisnListParam: string,
    @Query('batch') batch: string,
    @Query('nisn') nisn: string,
  ) {
    if (batch === 'true' && nisnListParam) {
      const nisns = nisnListParam
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      if (nisns.length === 0) {
        throw new BadRequestException('nisn_list kosong');
      }
      const data = await this.studentsService.getOrCreateCards(nisns);
      return { ok: true, data, meta: { total: nisns.length, found: Object.keys(data).length } };
    }

    if (nisn) {
      const data = await this.studentsService.getOrCreateCards([nisn]);
      if (!data[nisn]) {
        throw new NotFoundException('Gagal generate card ID');
      }
      return { ok: true, data: data[nisn] };
    }

    throw new BadRequestException('nisn atau nisn_list wajib diisi');
  }

  /**
   * GET /students/bulk-status
   * Audit siswa kandidat aktif/nonaktif — hanya ADMIN.
   */
  @Get('bulk-status')
  @ApiOperation({ summary: 'Audit status massal siswa (hanya Admin)' })
  async getBulkStatus(
    @Request() req: any,
    @Query('tahun_ajaran') tahunAjaran: string,
    @Query('mode') mode: string,
  ) {
    await this.assertAdmin(req);
    if (!tahunAjaran) {
      throw new BadRequestException('Parameter tahun_ajaran wajib diisi');
    }
    const resolvedMode: 'aktif' | 'nonaktif' = mode === 'aktif' ? 'aktif' : 'nonaktif';
    const result = await this.studentsService.auditBulkStatus(tahunAjaran, resolvedMode);
    return { ok: true, ...result };
  }

  /**
   * POST /students/bulk-status
   * Terapkan perubahan status massal — hanya ADMIN.
   * Body: { nisns: string[], aktif: boolean, sertakan_akun?: boolean }
   */
  @Post('bulk-status')
  @ApiOperation({ summary: 'Terapkan status massal siswa (hanya Admin)' })
  async postBulkStatus(@Request() req: any, @Body() body: Record<string, any>) {
    await this.assertAdmin(req);

    if (typeof body?.aktif !== 'boolean') {
      throw new BadRequestException('Field aktif (boolean) wajib diisi');
    }

    const nisns: string[] = [
      ...new Set(
        (Array.isArray(body.nisns) ? body.nisns : [])
          .map((n: any) => String(n).trim())
          .filter(Boolean) as string[],
      ),
    ];
    if (nisns.length === 0) {
      throw new BadRequestException('Daftar NISN kosong');
    }

    const result = await this.studentsService.applyBulkStatus(
      nisns,
      body.aktif as boolean,
      body.sertakan_akun === true,
    );

    return { ok: true, data: { ...result, aktif: body.aktif } };
  }

  /**
   * GET /students/verify
   * ?nisn=... atau ?card_id=...
   */
  @Get('verify')
  @ApiOperation({ summary: 'Verifikasi identitas siswa lewat kartu atau NISN' })
  async verifyStudent(
    @Query('nisn') nisn: string,
    @Query('card_id') cardId: string,
  ) {
    if (!nisn && !cardId) {
      throw new BadRequestException('NISN atau card_id wajib disertakan');
    }
    const result = await this.studentsService.verifyStudent(
      nisn || undefined,
      cardId || undefined,
    );
    if (!result.ok && (result as any).status) {
      const s = (result as any).status as number;
      if (s === 404) throw new NotFoundException(result.error);
      if (s === 400) throw new BadRequestException(result.error);
    }
    return result;
  }
}
