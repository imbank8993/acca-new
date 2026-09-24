import {
  Controller, Get, Post, Delete, Query, Body,
  UseGuards, Req, Param, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonalDocsService } from './personal-docs.service';

@ApiTags('Personal Docs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personal')
export class PersonalDocsController {
  constructor(private readonly service: PersonalDocsService) {}

  private userId(req: any): number {
    return Number(req.user.id);
  }

  // ==================== FOLDERS ====================
  @Get('folders')
  async getFolders(@Req() req: any, @Query('shared') shared: string, @Query('id') id?: string) {
    try {
      const data = await this.service.getFolders(this.userId(req), shared === 'true', id);
      return { ok: true, data };
    } catch (e: any) {
      // Exception yang sudah punya status sendiri diteruskan apa adanya.
      // Tanpa ini, penolakan gerbang Master Guru (403) ikut tersapu menjadi
      // 500 — pemakai yang tidak berhak melihat "server error", bukan alasan
      // sebenarnya, dan galat tak terduga jadi tak terbedakan dari penolakan
      // yang memang disengaja.
      if (e instanceof HttpException) throw e;
      throw new HttpException({ ok: false, error: e.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('folders')
  async createFolder(@Req() req: any, @Body() body: { nama: string }) {
    if (!body.nama) throw new HttpException({ ok: false, error: 'Nama wajib diisi' }, 400);
    const data = await this.service.createFolder(this.userId(req), body.nama);
    return { ok: true, data };
  }

  @Delete('folders/delete')
  async deleteFolder(@Req() req: any, @Query('id') id: string) {
    if (!id) throw new HttpException({ ok: false, error: 'ID wajib diisi' }, 400);
    try {
      return await this.service.deleteFolder(this.userId(req), id);
    } catch (e: any) {
      throw new HttpException({ ok: false, error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('folders/share')
  async shareFolder(@Req() req: any, @Body() body: { folder_id: string; target_user_id: number }) {
    const data = await this.service.shareFolder(this.userId(req), body.folder_id, body.target_user_id);
    return { ok: true, data };
  }

  @Delete('folders/share/revoke')
  async revokeFolderShare(@Req() req: any, @Query('share_id') shareId: string) {
    if (!shareId) throw new HttpException({ ok: false, error: 'share_id wajib diisi' }, 400);
    return await this.service.revokeFolderShare(this.userId(req), shareId);
  }

  // ==================== DOCUMENTS ====================
  @Get('documents')
  async getDocuments(
    @Req() req: any,
    @Query('folder_id') folderId: string,
    @Query('shared') shared: string,
    @Query('ids') ids?: string,
  ) {
    try {
      const daftarId = ids ? ids.split(',').map(v => v.trim()).filter(Boolean) : undefined;
      const data = await this.service.getDocuments(this.userId(req), folderId, shared === 'true', daftarId);
      return { ok: true, data };
    } catch (e: any) {
      // Exception yang sudah punya status sendiri diteruskan apa adanya.
      // Tanpa ini, penolakan gerbang Master Guru (403) ikut tersapu menjadi
      // 500 — pemakai yang tidak berhak melihat "server error", bukan alasan
      // sebenarnya, dan galat tak terduga jadi tak terbedakan dari penolakan
      // yang memang disengaja.
      if (e instanceof HttpException) throw e;
      throw new HttpException({ ok: false, error: e.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('documents')
  async createDocument(@Req() req: any, @Body() body: any) {
    const data = await this.service.createDocument(this.userId(req), body);
    return { ok: true, data };
  }

  @Post('documents/move')
  async moveDocuments(
    @Req() req: any,
    @Body() body: { document_ids: string[]; target_folder_id: string | null },
  ) {
    return await this.service.moveDocuments(this.userId(req), body.document_ids, body.target_folder_id ?? null);
  }

  @Delete('documents/delete')
  async deleteDocuments(@Req() req: any, @Query('id') id: string, @Query('ids') ids: string) {
    const allIds = ids ? ids.split(',').map(s => s.trim()) : id ? [id] : [];
    if (!allIds.length) throw new HttpException({ ok: false, error: 'ID wajib diisi' }, 400);
    return await this.service.deleteDocuments(this.userId(req), allIds);
  }

  @Post('documents/share')
  async shareDocument(@Req() req: any, @Body() body: { document_id: string; target_user_id: number }) {
    const data = await this.service.shareDocument(this.userId(req), body.document_id, body.target_user_id);
    return { ok: true, data };
  }

  @Delete('documents/share/revoke')
  async revokeDocumentShare(@Req() req: any, @Query('share_id') shareId: string) {
    if (!shareId) throw new HttpException({ ok: false, error: 'share_id wajib diisi' }, 400);
    return await this.service.revokeDocumentShare(this.userId(req), shareId);
  }

  @Get('documents/:id/file')
  async getDocumentFile(@Req() req: any, @Param('id') id: string) {
    try {
      const data = await this.service.getDocumentFile(this.userId(req), id);
      return { ok: true, data };
    } catch (e: any) {
      throw new HttpException({ ok: false, error: e.message }, HttpStatus.NOT_FOUND);
    }
  }

  // ==================== USERS SEARCH ====================
  @Get('users/search')
  async searchUsers(@Req() req: any, @Query('q') q: string) {
    const data = await this.service.searchUsers(this.userId(req), q || '');
    return { ok: true, data };
  }
}
