import { Injectable, HttpException, HttpStatus, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { FeatureAccessGuard, aksesDiizinkan } from '../auth/feature-access.guard';

/** Kunci site_settings untuk hak kelola Pusat Dokumen. */
export const DOKUMEN_KELOLA_KEY = 'dokumen_access_config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UploadResult {
    fileName: string;
    status: 'success' | 'error';
    message: string;
    detectedId?: string;
    detectedType?: 'NIP' | 'NISN';
    targetName?: string;
}

@Injectable()
export class DokumenService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly featureAccess: FeatureAccessGuard,
    ) {}

    private extractIdentifier(fileName: string): { id: string; type: 'NIP' | 'NISN' } | null {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const explicitMatch = nameWithoutExt.match(/^(NIP|NISN)[_-](\d+)/i);
        if (explicitMatch) {
            return { id: explicitMatch[2], type: explicitMatch[1].toUpperCase() as 'NIP' | 'NISN' };
        }
        const numericMatch = nameWithoutExt.match(/^(\d+)/);
        if (numericMatch) {
            const id = numericMatch[1];
            if (id.length === 18) return { id, type: 'NIP' };
            if (id.length === 10) return { id, type: 'NISN' };
            if (id.length >= 15) return { id, type: 'NIP' };
            if (id.length >= 8) return { id, type: 'NISN' };
        }
        return null;
    }

    async bulkUpload(files: any[], fields: any) {
        const categoryId = fields.category_id;
        const categoryName = fields.category_name;
        const uploaderId = fields.uploader_id;
        const uploaderName = fields.uploader_name;

        if (!categoryId || !categoryName) {
            throw new HttpException('Folder tujuan belum dipilih.', HttpStatus.BAD_REQUEST);
        }

        let fileParts = files.filter(f => f.fieldname.startsWith('file_'));
        if (fileParts.length === 0) {
            fileParts = files.filter(f => f.originalname && f.originalname.trim() !== '');
            if (fileParts.length === 0) {
                throw new HttpException('Tidak ada file yang diunggah', HttpStatus.BAD_REQUEST);
            }
        }

        const results: UploadResult[] = [];

        for (const filePart of fileParts) {
            try {
                const identifier = this.extractIdentifier(filePart.originalname || '');

                if (!identifier) {
                    results.push({
                        fileName: filePart.originalname || 'unknown',
                        status: 'error',
                        message: 'Tidak dapat mendeteksi NIP atau NISN dari nama file.'
                    });
                    continue;
                }

                let targetName = '';
                let targetExists = false;

                if (identifier.type === 'NIP') {
                    const guru = await this.prisma.master_guru.findFirst({
                        where: { nip: identifier.id },
                        select: { nip: true, nama_lengkap: true }
                    });
                    if (guru) { targetExists = true; targetName = guru.nama_lengkap || 'Guru'; }
                } else {
                    const siswa = await this.prisma.master_siswa.findFirst({
                        where: { nisn: identifier.id },
                        select: { nisn: true, nama_lengkap: true }
                    });
                    if (siswa) { targetExists = true; targetName = siswa.nama_lengkap || 'Siswa'; }
                }

                if (!targetExists) {
                    results.push({
                        fileName: filePart.originalname || 'unknown',
                        status: 'error',
                        message: `${identifier.type} ${identifier.id} tidak ditemukan di database`,
                        detectedId: identifier.id,
                        detectedType: identifier.type
                    });
                    continue;
                }

                const existingDoc = await this.prisma.uploaded_documents.findFirst({
                    where: {
                        category_id: categoryId,
                        file_name: filePart.originalname || ''
                    },
                    select: { id: true }
                });

                if (existingDoc) {
                    results.push({
                        fileName: filePart.originalname || 'unknown',
                        status: 'error',
                        message: 'File sudah ada di folder ini (di-skip)',
                        detectedId: identifier.id,
                        detectedType: identifier.type,
                        targetName
                    });
                    continue;
                }

                // Skip physical upload, just mock it per instructions
                const uploadResult = { 
                    ok: true, 
                    file_url: `/uploads/mock/${Date.now()}_${filePart.originalname}`, 
                    file_path: filePart.originalname 
                };

                const insertData: any = {
                    file_url: uploadResult.file_url,
                    file_path: uploadResult.file_path || 'unknown',
                    file_name: filePart.originalname || 'unknown',
                    uploader_name: uploaderName || 'Admin',
                    uploader_role: 'guru',
                    category_id: categoryId,
                    category_name: categoryName,
                    file_size: filePart.size,
                };

                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (uploaderId && uuidRegex.test(uploaderId)) {
                    insertData.uploader_id = uploaderId;
                }

                if (identifier.type === 'NIP') {
                    insertData.uploader_nip = identifier.id;
                    insertData.target_nip = identifier.id;
                } else {
                    insertData.uploader_nisn = identifier.id;
                    insertData.target_nisn = identifier.id;
                }

                await this.prisma.uploaded_documents.create({ data: insertData });

                results.push({
                    fileName: filePart.originalname || 'unknown',
                    status: 'success',
                    message: `Berhasil diproses untuk ${targetName}`,
                    detectedId: identifier.id,
                    detectedType: identifier.type,
                    targetName
                });

            } catch (fileError: any) {
                results.push({
                    fileName: filePart.originalname || 'unknown',
                    status: 'error',
                    message: fileError.message || 'Terjadi kesalahan saat memproses file'
                });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        return {
            ok: true,
            summary: { total: fileParts.length, success: successCount, error: errorCount },
            results
        };
    }

    async bulkDelete(ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new HttpException('ID dokumen tidak ditemukan', HttpStatus.BAD_REQUEST);
        }

        const docs = await this.prisma.uploaded_documents.findMany({
            where: { id: { in: ids } },
            select: { id: true, file_url: true, file_name: true }
        });

        if (!docs || docs.length === 0) {
            throw new HttpException('Dokumen tidak ditemukan', HttpStatus.NOT_FOUND);
        }

        for (const doc of docs) {
            if (doc.file_url) {
                await this.storage.removeByUrl(doc.file_url).catch((err) => {
                    console.error(`[bulkDelete] Gagal menghapus file fisik ${doc.file_url}:`, err);
                });
            }
        }
        
        await this.prisma.uploaded_documents.deleteMany({
            where: { id: { in: ids } }
        });

        return {
            ok: true,
            message: `${docs.length} dokumen berhasil dihapus`
        };
    }

    async getUploadedDocuments(categoryId?: string, uploaderName?: string, uploaderNip?: string, uploaderNisn?: string) {
        const where: any = {};
        if (categoryId) where.category_id = categoryId;
        if (uploaderName) where.uploader_name = { contains: uploaderName, mode: 'insensitive' };
        if (uploaderNip) where.uploader_nip = uploaderNip;
        if (uploaderNisn) where.uploader_nisn = uploaderNisn;

        const docs = await this.prisma.uploaded_documents.findMany({
            where,
            include: { upload_categories: { select: { name: true } } },
            orderBy: { created_at: 'desc' }
        });
        return docs;
    }

    async createUploadedDocument(body: any) {
        const doc = await this.prisma.uploaded_documents.create({
            data: body
        });
        return doc;
    }

    async getCategories(jenis?: string, targetRole?: string) {
        const where: any = {};
        if (jenis) where.jenis = jenis;
        if (targetRole) {
            where.OR = [
                { target_role: targetRole },
                { target_role: 'semua' },
                { target_role: 'all' },
            ];
        }
        return this.prisma.upload_categories.findMany({
            where,
            orderBy: { name: 'asc' },
        });
    }

    async createCategory(body: any) {
        return this.prisma.upload_categories.create({
            data: {
                name: body.name,
                jenis: body.jenis || 'official',
                target_role: body.target_role || 'siswa',
                audience: body.audience || 'umum',
            },
        });
    }

    async updateCategory(id: string, body: any) {
        return this.prisma.upload_categories.update({
            where: { id },
            data: body,
        });
    }

    async deleteCategory(id: string) {
        return this.prisma.upload_categories.delete({
            where: { id },
        });
    }

    async deleteUploadedDocument(id: string) {
        const doc = await this.prisma.uploaded_documents.findUnique({
            where: { id },
            select: { id: true, file_url: true }
        });
        if (doc?.file_url) {
            await this.storage.removeByUrl(doc.file_url).catch((err) => {
                console.error(`[deleteUploadedDocument] Gagal menghapus file fisik ${doc.file_url}:`, err);
            });
        }
        return this.prisma.uploaded_documents.delete({
            where: { id },
        });
    }

    async createDokumenSiswa(body: any) {
        return this.prisma.dokumen_siswa.create({
            data: body,
        });
    }

    async searchUploader(type: string, q: string = '') {
        if (type === 'guru') {
            const where: any = { aktif: true };
            if (q) where.nama_lengkap = { contains: q, mode: 'insensitive' };
            const data = await this.prisma.master_guru.findMany({
                where,
                select: { id: true, nip: true, nama_lengkap: true },
                orderBy: { nama_lengkap: 'asc' },
                take: 20,
            });
            return data.map((g) => ({
                label: g.nama_lengkap || 'Tanpa Nama',
                value: g.nama_lengkap || '',
                id: g.nip || String(g.id),
            }));
        } else if (type === 'siswa') {
            const where: any = { aktif: true };
            if (q) where.nama_siswa = { contains: q, mode: 'insensitive' };
            const data = await this.prisma.siswa_kelas.findMany({
                where,
                select: { id: true, nisn: true, nama_siswa: true, kelas: true },
                orderBy: { nama_siswa: 'asc' },
                take: 20,
            });
            return data.map((s) => ({
                label: s.nama_siswa || 'Tanpa Nama',
                value: s.nama_siswa || '',
                id: s.nisn || String(s.id),
                kelas: s.kelas,
            }));
        }
        return [];
    }

    /* ----------------------- Link publik per berkas ----------------------- */

    /**
     * Pemilik berkas (NIP/NISN/akun pengunggah) atau pengelola Pusat Dokumen.
     * Link publik membuka berkas untuk siapa pun yang memegang tokennya, jadi
     * hak membuat/melihat token tidak boleh lebih longgar dari ini.
     */
    private async aksesBerbagi(id: string, user: any) {
        if (!UUID_RE.test(id || '')) throw new BadRequestException('ID dokumen tidak valid');
        const doc = await this.prisma.uploaded_documents.findUnique({
            where: { id },
            include: { upload_categories: { select: { audience: true } } },
        });
        if (!doc) throw new NotFoundException('Dokumen tidak ditemukan');

        const ids = [user?.nip, user?.nisn, user?.username].filter(Boolean).map(String);
        const pemilik = (!!doc.uploader_id && doc.uploader_id === user?.auth_id)
            || (!!doc.uploader_nip && ids.includes(doc.uploader_nip))
            || (!!doc.uploader_nisn && ids.includes(doc.uploader_nisn));
        const pengelola = !pemilik && aksesDiizinkan(user, await this.featureAccess.bacaKonfigurasi(DOKUMEN_KELOLA_KEY));
        if (!pemilik && !pengelola) {
            throw new ForbiddenException('Hanya pengunggah berkas atau pengelola dokumen yang dapat membagikan berkas ini.');
        }
        return doc;
    }

    async listShareLinks(id: string, user: any) {
        await this.aksesBerbagi(id, user);
        const data = await this.prisma.uploaded_document_share_links.findMany({
            where: { document_id: id },
            orderBy: { created_at: 'desc' },
        });
        return { ok: true, data };
    }

    async createShareLink(id: string, user: any) {
        const doc = await this.aksesBerbagi(id, user);
        // Folder ber-audience "none" (mis. bank soal) memang tidak untuk dibaca
        // orang lain; link publik akan membocorkannya ke luar madrasah.
        const audience = String(doc.audience || doc.upload_categories?.audience || 'umum').toLowerCase();
        if (audience === 'none') {
            throw new ForbiddenException('Berkas di folder privat tidak dapat dibagikan sebagai link publik.');
        }
        const authId = String(user?.auth_id || '');
        const data = await this.prisma.uploaded_document_share_links.create({
            data: {
                // Token adalah satu-satunya pelindung berkas: harus acak kriptografis.
                token: randomBytes(12).toString('base64url'),
                document_id: id,
                created_by: UUID_RE.test(authId) ? authId : null,
                created_by_name: user?.nama_lengkap || user?.nama || user?.username || null,
            },
        });
        return { ok: true, data };
    }

    private async linkMilik(linkId: string, user: any) {
        if (!UUID_RE.test(linkId || '')) throw new BadRequestException('ID link tidak valid');
        const link = await this.prisma.uploaded_document_share_links.findUnique({ where: { id: linkId } });
        if (!link) throw new NotFoundException('Link publik tidak ditemukan');
        await this.aksesBerbagi(link.document_id, user);
        return link;
    }

    async toggleShareLink(linkId: string, revoked: unknown, user: any) {
        const link = await this.linkMilik(linkId, user);
        const data = await this.prisma.uploaded_document_share_links.update({
            where: { id: link.id },
            data: { revoked: typeof revoked === 'boolean' ? revoked : !link.revoked },
        });
        return { ok: true, data };
    }

    async deleteShareLink(linkId: string, user: any) {
        const link = await this.linkMilik(linkId, user);
        await this.prisma.uploaded_document_share_links.delete({ where: { id: link.id } });
        return { ok: true };
    }
}
