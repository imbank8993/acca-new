import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { TugasSiswaService } from './tugas-siswa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';

@Controller('tugas-siswa')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@RequiresPage('tugas-siswa')
export class TugasSiswaController {
  constructor(private readonly tugasSiswaService: TugasSiswaService) {}

  private getApiUser(reqUser: any) {
    const roles: string[] = reqUser?.roles || (reqUser?.role
      ? reqUser.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
      : []);
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const nip = reqUser?.nip || '';
    const authId = reqUser?.authId || reqUser?.auth_id || String(reqUser?.id || '');
    const nama_lengkap = reqUser?.nama_lengkap || reqUser?.nama || '';
    const nama = reqUser?.nama || '';

    return { nip, roles, isAdmin, authId, id: reqUser?.id, nama_lengkap, nama };
  }

  @Get('master')
  async getMaster(@Req() req: any, @Query('tahunAjaran') tahunAjaran?: string) {
    return this.tugasSiswaService.getMasterData(tahunAjaran, this.getApiUser(req.user));
  }

  @Get('upload-access')
  async uploadAccess(@Req() req: any) {
    return this.tugasSiswaService.uploadAccess(this.getApiUser(req.user));
  }

  @Get('action')
  async getStats(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    return this.tugasSiswaService.getStats(query, apiUser);
  }

  @Post('action')
  async setChecklist(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Data checklist tidak valid');
    const { tugas_id, siswa_id, is_done } = body;
    if (typeof is_done !== 'boolean' || !/^\d+$/.test(String(tugas_id)) || !/^\d+$/.test(String(siswa_id))) throw new BadRequestException('ID dan status checklist tidak valid');
    return this.tugasSiswaService.toggleChecklist(
      Number(tugas_id),
      Number(siswa_id),
      is_done,
      apiUser,
    );
  }

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    return this.tugasSiswaService.findAll(query, apiUser);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const data = await this.tugasSiswaService.findById(id, this.getApiUser(req.user));
    return { ok: true, data };
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.tugasSiswaService.create(body, apiUser);
    return { ok: true, data };
  }

  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.tugasSiswaService.update(id, body, apiUser);
    return { ok: true, data };
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const apiUser = this.getApiUser(req.user);
    return this.tugasSiswaService.remove(id, apiUser);
  }
}
