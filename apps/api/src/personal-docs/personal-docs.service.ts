import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';

/**
 * Kolom profil yang dibutuhkan UI berbagi: nama untuk ditampilkan, foto untuk
 * avatar. Sebelumnya hanya `id` & `username` yang di-select, sehingga daftar
 * berbagi hanya menampilkan "@" dan avatar "?" .
 */
const PILIH_PROFIL = {
  id: true,
  username: true,
  nama: true,
  nama_lengkap: true,
  foto_profil: true,
} as const;

function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}

@Injectable()
export class PersonalDocsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ==================== PENJAGA KEPEMILIKAN ====================
  // Brankas pribadi: tiap operasi harus dipastikan menyentuh milik pemanggil.
  // Sebelumnya beberapa fungsi menerima `userId` lalu tidak memakainya sama
  // sekali, sehingga id milik orang lain diterima apa adanya.

  /** Folder milik `userId`, atau lempar. */
  private async folderMilik(userId: number, folderId: string) {
    const folder = await this.prisma.personal_folders.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Folder tidak ditemukan');
    if (Number(folder.user_id) !== userId) {
      throw new ForbiddenException('Folder ini bukan milik Anda');
    }
    return folder;
  }

  /** Dokumen milik `userId`, atau lempar. */
  private async dokumenMilik(userId: number, documentId: string) {
    const doc = await this.prisma.personal_documents.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan');
    if (Number(doc.user_id) !== userId) {
      throw new ForbiddenException('Dokumen ini bukan milik Anda');
    }
    return doc;
  }

  /**
   * Memastikan pengguna terdaftar sebagai Guru / Tendik di Master Guru.
   *
   * Syaratnya tunggal dan disengaja: NIP akun harus ada di `master_guru` dan
   * masih aktif. Tidak ada jalan pintas lewat daftar role, termasuk untuk ADMIN —
   * yang menentukan seseorang punya loker dokumen pribadi adalah keberadaannya di
   * data kepegawaian, bukan peran yang kebetulan melekat di akunnya.
   *
   * Dua jebakan yang perlu diketahui sebelum mengubah fungsi ini:
   *
   *  1. Model Prisma-nya bernama `public_users`, bukan `users`. Yang bernama
   *     `users` adalah tabel di database — modelnya memakai `@@map("users")`.
   *  2. Kolom `nip` TIDAK hanya berisi NIP. Untuk akun siswa, kolom itu diisi
   *     NISN (223 akun aktif seperti ini). Jadi "punya nip" sama sekali bukan
   *     penanda pegawai. Pencocokan ke `master_guru`-lah yang membedakannya:
   *     NISN siswa tidak akan pernah cocok di sana, sehingga akun siswa tertolak
   *     dengan sendirinya tanpa perlu kolom pembeda tersendiri.
   *
   * `public_users` juga tidak punya kolom `nisn` maupun `roles` — rolenya satu
   * kolom `role` berisi beberapa nilai dipisah koma.
   */
  private async pastikanMasterGuruUser(userId: number) {
    const user = await this.prisma.public_users.findUnique({
      where: { id: BigInt(userId) },
      select: { nip: true },
    });
    if (!user) throw new ForbiddenException('Pengguna tidak ditemukan');

    const nip = String(user.nip || '').trim();
    const terdaftar = nip
      ? await this.prisma.master_guru.findFirst({
          where: { nip, aktif: true },
          select: { nip: true },
        })
      : null;

    if (!terdaftar) {
      throw new ForbiddenException(
        'Akses Dokumen Pribadi hanya diperbolehkan untuk Guru & Tendik terdaftar di Master Guru',
      );
    }
  }

  /** Apakah dokumen dibagikan kepada `userId`, langsung atau lewat foldernya? */
  private async dibagikanKe(userId: number, doc: { id: string; folder_id: string | null }) {
    const langsung = await this.prisma.personal_document_shares.findFirst({
      where: { document_id: doc.id, shared_with_user_id: userId },
      select: { id: true },
    });
    if (langsung) return true;
    if (!doc.folder_id) return false;
    const lewatFolder = await this.prisma.personal_folder_shares.findFirst({
      where: { folder_id: doc.folder_id, shared_with_user_id: userId },
      select: { id: true },
    });
    return !!lewatFolder;
  }

  // ==================== FOLDERS ====================
  async getFolders(userId: number, shared: boolean, id?: string) {
    await this.pastikanMasterGuruUser(userId);
    if (shared) {
      const shares = await this.prisma.personal_folder_shares.findMany({
        where: { shared_with_user_id: userId },
        include: {
          personal_folders: {
            include: { users: { select: PILIH_PROFIL } }
          }
        }
      });
      return serializeBigInt(shares.map(s => s.personal_folders));
    }
    const folders = await this.prisma.personal_folders.findMany({
      // `id` dipakai unduh-per-folder. Tanpa ini parameternya diabaikan diam-diam
      // dan pemanggil menerima SELURUH folder, lalu memakai yang pertama.
      where: { user_id: userId, ...(id ? { id } : {}) },
      include: {
        personal_folder_shares: {
          include: { users: { select: PILIH_PROFIL } }
        }
      },
      orderBy: { nama: 'asc' }
    });
    return serializeBigInt(folders);
  }

  async createFolder(userId: number, nama: string) {
    const folder = await this.prisma.personal_folders.create({
      data: { user_id: userId, nama }
    });
    return serializeBigInt(folder);
  }

  async deleteFolder(userId: number, id: string) {
    await this.folderMilik(userId, id);
    // Delete shares & docs first
    await this.prisma.personal_folder_shares.deleteMany({ where: { folder_id: id } });
    await this.prisma.personal_document_shares.deleteMany({
      where: { personal_documents: { folder_id: id } }
    });
    await this.prisma.personal_documents.deleteMany({ where: { folder_id: id } });
    await this.prisma.personal_folders.delete({ where: { id } });
    return { ok: true };
  }

  async shareFolder(userId: number, folderId: string, targetUserId: number) {
    // Hanya pemilik yang boleh membagikan. Tanpa ini, siapa pun dapat
    // membagikan folder orang lain KEPADA DIRINYA SENDIRI lalu membacanya
    // lewat daftar "Dibagikan".
    await this.folderMilik(userId, folderId);
    if (Number(targetUserId) === userId) {
      throw new ForbiddenException('Tidak perlu membagikan folder kepada diri sendiri');
    }
    const share = await this.prisma.personal_folder_shares.create({
      data: { folder_id: folderId, shared_with_user_id: targetUserId }
    });
    return serializeBigInt(share);
  }

  async revokeFolderShare(userId: number, shareId: string) {
    const share = await this.prisma.personal_folder_shares.findUnique({
      where: { id: shareId },
      select: { folder_id: true },
    });
    if (!share) throw new NotFoundException('Data berbagi tidak ditemukan');
    // Pencabutan hanya oleh pemilik foldernya.
    await this.folderMilik(userId, share.folder_id);
    await this.prisma.personal_folder_shares.delete({ where: { id: shareId } });
    return { ok: true };
  }

  // ==================== DOCUMENTS ====================
  async getDocuments(
    userId: number,
    folderId: string | null | undefined,
    shared: boolean,
    ids?: string[],
  ) {
    await this.pastikanMasterGuruUser(userId);
    if (shared) {
      // Get doc IDs shared directly
      const docShares = await this.prisma.personal_document_shares.findMany({
        where: { shared_with_user_id: userId },
        select: { document_id: true }
      });
      // Get folder IDs shared with user
      const folderShares = await this.prisma.personal_folder_shares.findMany({
        where: { shared_with_user_id: userId },
        select: { folder_id: true }
      });
      const sharedDocIds = docShares.map(s => s.document_id);
      const sharedFolderIds = folderShares.map(f => f.folder_id);

      const docs = await this.prisma.personal_documents.findMany({
        where: {
          OR: [
            ...(sharedDocIds.length > 0 ? [{ id: { in: sharedDocIds } }] : []),
            ...(sharedFolderIds.length > 0 ? [{ folder_id: { in: sharedFolderIds } }] : [])
          ]
        },
        include: { users: { select: PILIH_PROFIL } }
      });
      return serializeBigInt(docs);
    }

    const where: any = { user_id: userId };
    // `ids` dipakai unduh-batch. Tanpa ini parameternya diabaikan dan ZIP berisi
    // seluruh dokumen pengguna, bukan yang dicentang.
    if (ids && ids.length > 0) where.id = { in: ids };
    if (folderId === 'null' || folderId === null) {
      where.folder_id = null;
    } else if (folderId) {
      where.folder_id = folderId;
    }

    const docs = await this.prisma.personal_documents.findMany({
      where,
      include: {
        personal_document_shares: {
          include: { users: { select: PILIH_PROFIL } }
        }
      },
      orderBy: { uploaded_at: 'desc' }
    });
    return serializeBigInt(docs);
  }

  /**
   * `file_url` ikut diambil server saat mengunduh (batch & per-folder), jadi
   * nilainya tidak boleh bebas: URL kiriman klien yang menunjuk alamat internal
   * akan mengubah server menjadi proksi ke jaringan sendiri (SSRF). Hanya
   * diterima URL relatif milik aplikasi, atau http(s) ke host non-privat.
   */
  private pastikanUrlAman(url: unknown): string {
    const nilai = String(url ?? '').trim();
    if (!nilai) throw new ForbiddenException('URL berkas wajib diisi');
    if (nilai.startsWith('/')) return nilai; // relatif terhadap aplikasi sendiri

    let parsed: URL;
    try {
      parsed = new URL(nilai);
    } catch {
      throw new ForbiddenException('URL berkas tidak valid');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ForbiddenException('URL berkas harus http atau https');
    }
    const host = parsed.hostname.toLowerCase();
    const privat =
      host === 'localhost' ||
      host === '::1' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (privat) {
      throw new ForbiddenException('URL berkas tidak boleh menunjuk alamat internal');
    }
    return nilai;
  }

  async createDocument(userId: number, data: any) {
    const fileUrl = this.pastikanUrlAman(data.file_url);
    // `size` dari klien bisa bukan angka; `BigInt()` akan melempar dan berujung 500.
    const ukuran = Number(data.size);
    const doc = await this.prisma.personal_documents.create({
      data: {
        user_id: userId,
        folder_id: data.folder_id || null,
        judul: data.judul,
        file_url: fileUrl,
        file_path: data.file_path ? this.pastikanUrlAman(data.file_path) : fileUrl,
        size: Number.isFinite(ukuran) && ukuran >= 0 ? BigInt(Math.trunc(ukuran)) : null,
        extension: data.extension || null,
      }
    });
    return serializeBigInt(doc);
  }

  async moveDocuments(userId: number, documentIds: string[], targetFolderId: string | null) {
    await this.prisma.personal_documents.updateMany({
      where: { id: { in: documentIds }, user_id: userId },
      data: { folder_id: targetFolderId }
    });
    return { ok: true, moved: documentIds.length };
  }

  async deleteDocuments(userId: number, ids: string[]) {
    // Sisihkan dulu id yang benar-benar milik pemanggil. Sebelumnya penghapusan
    // share dijalankan atas SEMUA id yang dikirim tanpa penyaringan pemilik,
    // sehingga id milik orang lain tetap menghapus seluruh share mereka
    // walaupun dokumennya sendiri selamat.
    const milik = await this.prisma.personal_documents.findMany({
      where: { id: { in: ids }, user_id: userId },
      select: { id: true, file_url: true, file_path: true },
    });
    const idMilik = milik.map(d => d.id);
    if (idMilik.length === 0) return { ok: true, deleted: 0 };

    for (const doc of milik) {
      const targetUrl = doc.file_url || doc.file_path;
      if (targetUrl) {
        await this.storage.removeByUrl(targetUrl).catch((err) => {
          console.error(`[deleteDocuments] Gagal menghapus file fisik ${targetUrl}:`, err);
        });
      }
    }

    await this.prisma.personal_document_shares.deleteMany({
      where: { document_id: { in: idMilik } }
    });
    const result = await this.prisma.personal_documents.deleteMany({
      where: { id: { in: idMilik }, user_id: userId }
    });
    return { ok: true, deleted: result.count };
  }

  async shareDocument(userId: number, documentId: string, targetUserId: number) {
    await this.dokumenMilik(userId, documentId);
    if (Number(targetUserId) === userId) {
      throw new ForbiddenException('Tidak perlu membagikan dokumen kepada diri sendiri');
    }
    const share = await this.prisma.personal_document_shares.create({
      data: { document_id: documentId, shared_with_user_id: targetUserId }
    });
    return serializeBigInt(share);
  }

  async revokeDocumentShare(userId: number, shareId: string) {
    const share = await this.prisma.personal_document_shares.findUnique({
      where: { id: shareId },
      select: { document_id: true },
    });
    if (!share) throw new NotFoundException('Data berbagi tidak ditemukan');
    await this.dokumenMilik(userId, share.document_id);
    await this.prisma.personal_document_shares.delete({ where: { id: shareId } });
    return { ok: true };
  }

  /**
   * Metadata satu dokumen. Boleh dibuka pemiliknya, atau orang yang memang
   * dibagikan dokumen/foldernya. Sebelumnya `userId` diterima tapi tidak pernah
   * dipakai di klausa `where`, sehingga dokumen pribadi siapa pun terbaca hanya
   * dengan mengetahui id-nya.
   */
  async getDocumentFile(userId: number, id: string) {
    const doc = await this.prisma.personal_documents.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan');

    if (Number(doc.user_id) !== userId && !(await this.dibagikanKe(userId, doc))) {
      throw new ForbiddenException('Anda tidak memiliki akses ke dokumen ini');
    }
    return serializeBigInt(doc);
  }

  // ==================== USERS SEARCH ====================
  async searchUsers(currentUserId: number, q: string) {
    const users = await this.prisma.public_users.findMany({
      where: {
        aktif: true,
        id: { not: currentUserId },
        // Pencarian ikut menyasar nama & NIP/NISN, bukan username saja —
        // pengguna mencari rekannya dengan nama, bukan dengan nomor induk.
        ...(q ? {
          OR: [
            { nama: { contains: q, mode: 'insensitive' } },
            { nama_lengkap: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { nip: { contains: q, mode: 'insensitive' } },
          ]
        } : {})
      },
      select: PILIH_PROFIL,
      take: 20,
      // Urut berdasar nama agar hasilnya terbaca manusiawi.
      orderBy: [{ nama: 'asc' }, { username: 'asc' }]
    });
    return serializeBigInt(users);
  }
}
