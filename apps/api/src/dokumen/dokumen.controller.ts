import { Controller, Post, UseInterceptors, UploadedFiles, Body, Req, Delete, Get, Put, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { DokumenService, DOKUMEN_KELOLA_KEY } from './dokumen.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeatureAccess, FeatureAccessGuard } from '../auth/feature-access.guard';

/**
 * Controller ini sebelumnya TIDAK punya guard sama sekali: daftar kategori dan
 * dokumen sekolah — termasuk kategori ber-`audience: none` seperti bank soal —
 * terkirim ke siapa pun yang dapat menjangkau port ini, dan seluruh operasi
 * tulisnya terbuka.
 *
 * Membaca cukup terautentikasi karena tab "Dokumen Sekolah" memang untuk semua
 * warga madrasah; mengubah dibatasi pengelola lewat Hak Akses Fitur.
 */
@ApiTags('Dokumen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureAccessGuard)
@Controller('dokumen')
export class DokumenController {
  constructor(private readonly dokumenService: DokumenService) {}

  @Post('bulk-upload')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  @UseInterceptors(AnyFilesInterceptor())
  async bulkUpload(
    @UploadedFiles() files: any[],
    @Body() body: any,
  ) {
    return this.dokumenService.bulkUpload(files, body);
  }

  @Post('bulk-delete')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async bulkDelete(@Body() body: any) {
    return this.dokumenService.bulkDelete(body.ids);
  }

  @Get('uploaded-documents')
  async getUploadedDocuments(
    @Query('categoryId') categoryId?: string,
    @Query('uploaderName') uploaderName?: string,
    @Query('uploaderNip') uploaderNip?: string,
    @Query('uploaderNisn') uploaderNisn?: string,
  ) {
    return this.dokumenService.getUploadedDocuments(categoryId, uploaderName, uploaderNip, uploaderNisn);
  }

  @Post('uploaded-documents')
  async createUploadedDocument(@Body() body: any) {
    return this.dokumenService.createUploadedDocument(body);
  }

  @Delete('uploaded-documents/:id')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async deleteUploadedDocument(@Param('id') id: string) {
    await this.dokumenService.deleteUploadedDocument(id);
    return { ok: true, message: 'Dokumen berhasil dihapus' };
  }

  /**
   * Link publik per berkas. Tanpa @FeatureAccess: pengunggah boleh membagikan
   * berkasnya sendiri; service yang memeriksa pemilik atau pengelola.
   */
  @Get('uploaded-documents/:id/share')
  async listShareLinks(@Req() req: any, @Param('id') id: string) {
    return this.dokumenService.listShareLinks(id, req.user);
  }

  @Post('uploaded-documents/:id/share')
  async createShareLink(@Req() req: any, @Param('id') id: string) {
    return this.dokumenService.createShareLink(id, req.user);
  }

  @Patch('share-links/:linkId')
  async toggleShareLink(@Req() req: any, @Param('linkId') linkId: string, @Body() body: any) {
    return this.dokumenService.toggleShareLink(linkId, body?.revoked, req.user);
  }

  @Delete('share-links/:linkId')
  async deleteShareLink(@Req() req: any, @Param('linkId') linkId: string) {
    return this.dokumenService.deleteShareLink(linkId, req.user);
  }

  @Get('categories')
  async getCategories(
    @Query('jenis') jenis?: string,
    @Query('target_role') targetRole?: string,
  ) {
    const data = await this.dokumenService.getCategories(jenis, targetRole);
    return { ok: true, data };
  }

  @Post('categories')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async createCategory(@Body() body: any) {
    const data = await this.dokumenService.createCategory(body);
    return { ok: true, data };
  }

  @Put('categories/:id')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async updateCategory(@Param('id') id: string, @Body() body: any) {
    const data = await this.dokumenService.updateCategory(id, body);
    return { ok: true, data };
  }

  @Delete('categories/:id')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async deleteCategory(@Param('id') id: string) {
    await this.dokumenService.deleteCategory(id);
    return { ok: true, message: 'Kategori berhasil dihapus' };
  }

  @Post('dokumen-siswa')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async createDokumenSiswa(@Body() body: any) {
    const data = await this.dokumenService.createDokumenSiswa(body);
    return { ok: true, data };
  }

  @Get('uploader-search')
  @FeatureAccess(DOKUMEN_KELOLA_KEY)
  async searchUploader(
    @Query('type') type: string,
    @Query('q') q: string,
  ) {
    return this.dokumenService.searchUploader(type, q);
  }
}
