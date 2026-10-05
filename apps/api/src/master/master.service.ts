import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MASTER_ENTITIES, type MasterEntityConfig } from './master.config';

export interface ListQuery {
  q?: string;
  search?: string;       // alias untuk q (kompatibilitas SiswaTab)
  show_inactive?: string;
  page?: string;
  limit?: string;
  [key: string]: any;
}

@Injectable()
export class MasterService {
  constructor(private prisma: PrismaService) {}

  getConfig(entity: string): MasterEntityConfig {
    const config = MASTER_ENTITIES[entity];
    if (!config) throw new NotFoundException(`Entitas master '${entity}' tidak dikenal`);
    return config;
  }

  private delegate(config: MasterEntityConfig) {
    return (this.prisma as any)[config.model];
  }

  /**
   * `null` bila `id` bukan primary key yang sah untuk entitas ini — pemanggil
   * memutuskan sendiri apakah itu error atau alasan untuk mencari lewat
   * `uniqueField`. Sebelumnya `BigInt('G-01')` melempar SyntaxError mentah dan
   * keluar sebagai 500.
   */
  private castId(config: MasterEntityConfig, id: string | number) {
    if (config.idType === 'uuid') return String(id);
    try {
      if (config.idType === 'bigint') return BigInt(id);
      const n = Number(id);
      return Number.isInteger(n) ? n : null;
    } catch {
      return null;
    }
  }

  /** BigInt & Date tidak bisa di-JSON-kan apa adanya oleh Nest. */
  private serialize<T>(value: T, entity?: string): T {
    let json = JSON.parse(
      JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    );
    if (entity === 'waktu') {
      const formatTime = (t: any) => {
        if (!t) return t;
        if (typeof t === 'string' && t.includes('T')) {
          return t.substring(11, 19);
        }
        return t;
      };
      if (Array.isArray(json)) {
        json = json.map((item) => ({
          ...item,
          mulai: formatTime(item.mulai),
          selesai: formatTime(item.selesai),
        }));
      } else if (json && typeof json === 'object') {
        json.mulai = formatTime(json.mulai);
        json.selesai = formatTime(json.selesai);
      }
    }

    // Kolom @db.Date keluar dari Prisma sebagai DateTime penuh dan ikut
    // ter-JSON jadi '1986-03-05T00:00:00.000Z'. UI (tabel, modal detail,
    // DatePicker) mengharapkan 'YYYY-MM-DD'; nilainya tersimpan pada tengah
    // malam UTC sehingga memotong 10 karakter pertama tidak menggeser hari.
    const dateFields = entity ? MASTER_ENTITIES[entity]?.dateFields : undefined;
    if (dateFields?.length) {
      const toDateOnly = (v: any) =>
        typeof v === 'string' && v.includes('T') ? v.slice(0, 10) : v;
      const apply = (row: any) => {
        if (!row || typeof row !== 'object') return row;
        for (const f of dateFields) {
          if (row[f] !== undefined) row[f] = toDateOnly(row[f]);
        }
        return row;
      };
      json = Array.isArray(json) ? json.map(apply) : apply(json);
    }

    return json;
  }

  /**
   * Buang kolom pribadi dari baris yang akan dikirim ke pemakai tanpa akses
   * halaman `master`. Dijalankan setelah `serialize` supaya bekerja pada objek
   * biasa, bukan hasil Prisma.
   */
  private stripSensitive(config: MasterEntityConfig, rows: any) {
    const fields = config.sensitiveFields;
    if (!fields?.length) return rows;
    const strip = (row: any) => {
      if (!row || typeof row !== 'object') return row;
      for (const f of fields) delete row[f];
      return row;
    };
    return Array.isArray(rows) ? rows.map(strip) : strip(rows);
  }

  /**
   * Ambil hanya kolom yang boleh ditulis, buang `undefined`.
   *
   * Pada `isUpdate`, `protectedFields` ikut dibuang: kolom itu boleh ditentukan
   * saat baris dibuat, tapi tidak boleh berubah lewat PUT generik. Dibuang diam-diam
   * dan bukan ditolak, karena form Edit memantulkan kembali seluruh baris hasil
   * pembacaan — termasuk nilai yang tidak diubah pengguna.
   */
  private pickWritable(
    config: MasterEntityConfig,
    body: Record<string, any>,
    entity?: string,
    isUpdate = false,
  ) {
    const protectedFields = isUpdate ? (config.protectedFields ?? []) : [];
    const data: Record<string, any> = {};
    for (const field of config.writable) {
      if (protectedFields.includes(field)) continue;
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (entity === 'waktu') {
      if (typeof data.mulai === 'string' && !data.mulai.includes('T')) {
        const t = data.mulai.length === 5 ? `${data.mulai}:00` : data.mulai;
        data.mulai = new Date(`1970-01-01T${t}Z`);
      }
      if (typeof data.selesai === 'string' && !data.selesai.includes('T')) {
        const t = data.selesai.length === 5 ? `${data.selesai}:00` : data.selesai;
        data.selesai = new Date(`1970-01-01T${t}Z`);
      }
    }
    if (entity === 'ruangan' && 'kapasitas' in data) {
      if (data.kapasitas === '' || data.kapasitas === null || data.kapasitas === undefined) {
        data.kapasitas = null;
      } else {
        const parsed = parseInt(String(data.kapasitas), 10);
        data.kapasitas = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      }
    }

    // DatePicker mengirim 'YYYY-MM-DD'; Prisma menolaknya untuk kolom DateTime
    // ("premature end of input. Expected ISO-8601 DateTime"). Terima juga ISO
    // penuh, karena form Edit memantulkan kembali nilai hasil pembacaan.
    for (const field of config.dateFields || []) {
      const value = data[field];
      if (value === undefined || value instanceof Date) continue;
      if (value === null || value === '') {
        data[field] = null;
        continue;
      }
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
      if (!match) {
        throw new BadRequestException(`Format tanggal '${field}' tidak dikenal: ${value}`);
      }
      data[field] = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
    }

    return data;
  }

  /**
   * `parseInt('abc')` menghasilkan NaN, dan NaN lolos dari `Math.max`/`Math.min`
   * (keduanya mengembalikan NaN) sampai ke `skip`/`take` Prisma — yang menolaknya
   * sebagai 500. Nilai yang tidak terbaca sebagai angka dikembalikan ke bawaannya.
   */
  private toPositiveInt(value: any, fallback: number, max?: number) {
    const n = parseInt(Array.isArray(value) ? value[0] : value, 10);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return max ? Math.min(max, n) : n;
  }

  /**
   * Express mem-parsing query string dengan `qs` (mode extended), jadi
   * `?nama[contains]=A` tiba sebagai objek dan `?nip=a&nip=b` sebagai array.
   * Keduanya diteruskan apa adanya ke `where` Prisma: yang pertama menyelundupkan
   * operator filter yang tidak diniatkan route ini, yang kedua memicu 500. Filter
   * di sini hanya mengenal pencocokan persis, jadi apa pun selain string ditolak.
   */
  private scalarFilter(value: any): string | null {
    return typeof value === 'string' ? value : null;
  }

  async list(entity: string, query: ListQuery, canManageMaster = false) {
    const config = this.getConfig(entity);
    const page = this.toPositiveInt(query.page, 1);
    const limit = this.toPositiveInt(query.limit, 50, 1000);
    const activeField = config.activeField ?? 'aktif';

    const where: Record<string, any> = {};
    // Baris hasil hapus-lunak hanya relevan bagi pengelola master. Pemakai
    // dropdown tidak perlu melihatnya, dan `?show_inactive=true` tidak boleh jadi
    // jalan pintas untuk membaca siswa/pegawai yang sudah dinonaktifkan.
    const showInactive = canManageMaster && query.show_inactive === 'true';
    if (config.hasAktif && !showInactive) {
      where[activeField] = true;
    }

    // Dukung ?q= dan ?search= (alias, dipakai SiswaTab)
    const searchTerm = this.scalarFilter(query.q) ?? this.scalarFilter(query.search);
    if (searchTerm && config.searchFields.length > 0) {
      where.OR = config.searchFields.map((f) => ({
        [f]: { contains: searchTerm, mode: 'insensitive' },
      }));
    }
    /**
     * Filter tambahan untuk kolom writable (mis. ?jenis_pegawai=GURU).
     *
     * Kolom pribadi sengaja TIDAK boleh dijadikan filter oleh pemakai yang
     * tidak berhak melihatnya. Membuang kolomnya dari respons saja tidak cukup:
     * `?rekening_1_nomor=1234` tetap memberi tahu apakah tebakan itu benar,
     * dan `nama_lengkap` yang ikut terkirim langsung menunjuk pemiliknya —
     * jadi kolom yang diredaksi berubah jadi alat tebak-cocok. Lihat
     * `stripSensitive` dan MasterController.list().
     */
    const blockedFilters = canManageMaster ? [] : (config.sensitiveFields ?? []);
    for (const field of config.writable) {
      if (field === activeField || field === 'aktif') continue;
      if (blockedFilters.includes(field)) continue;
      if (field === 'jenis_pegawai') {
        const jenisPegawai = this.scalarFilter(query.jenis_pegawai);
        if (jenisPegawai) {
          const jp = jenisPegawai.trim().toUpperCase();
          if (jp === 'TENDIK') {
            where.jenis_pegawai = { equals: 'TENDIK', mode: 'insensitive' };
          } else if (jp === 'GURU') {
            // `jenis_pegawai` NOT NULL (default 'GURU'), jadi baris lama yang
            // belum terisi bernilai string kosong — bukan NULL. Menyaring
            // dengan `null` membuat Prisma menolak seluruh query
            // (PrismaClientValidationError: Expected StringFilter or String),
            // sehingga tab Guru tampil kosong padahal datanya ada.
            where.AND = [
              ...(where.AND || []),
              {
                OR: [
                  { jenis_pegawai: { equals: 'GURU', mode: 'insensitive' } },
                  { jenis_pegawai: '' },
                ],
              },
            ];
          }
        }
        continue;
      }
      const raw = this.scalarFilter(query[field]);
      if (raw !== null && raw !== '') {
        let val: any = raw;
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        where[field] = val;
      }
    }

    const delegate = this.delegate(config);
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: this.stableOrderBy(config),
        skip: (page - 1) * limit,
        take: limit,
      }),
      delegate.count({ where }),
    ]);

    const rows = this.serialize(data, entity);
    return {
      data: canManageMaster ? rows : this.stripSensitive(config, rows),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Urutan bawaan tiap entitas memakai kolom yang tidak unik (nama, jam ke-).
   * Baris bernilai sama boleh muncul dalam urutan berbeda di tiap query, jadi
   * pemanggil yang mengambil bertahap (PegawaiTab & SiswaTab menyusun daftar
   * penuh 1000 baris sekali jalan) bisa menerima baris ganda di satu halaman dan
   * kehilangan baris lain. `id` ditambahkan sebagai pemutus supaya urutannya tetap.
   */
  private stableOrderBy(config: MasterEntityConfig) {
    const base = Array.isArray(config.orderBy) ? config.orderBy : [config.orderBy];
    if (base.some((o) => 'id' in o)) return base;
    return [...base, { id: 'asc' as const }];
  }

  async create(entity: string, body: Record<string, any>, upsert = false) {
    const config = this.getConfig(entity);
    const delegate = this.delegate(config);
    const activeField = config.activeField ?? 'aktif';

    const uniqueValue = body[config.uniqueField];
    if (config.uniqueField !== 'id' && (uniqueValue === undefined || uniqueValue === '')) {
      throw new BadRequestException(`Kolom '${config.uniqueField}' wajib diisi`);
    }

    const data = { ...config.defaults, ...this.pickWritable(config, body, entity) };
    // Jalur upsert di bawah memperbarui baris yang sudah ada, jadi tunduk pada
    // aturan yang sama dengan PUT: `protectedFields` tidak ikut berubah.
    const updatable = this.pickWritable(config, body, entity, true);

    /**
     * Menyimpan ulang baris yang sudah ada berarti menghidupkannya kembali —
     * itu memang gunanya "tambah data yang pernah dinonaktifkan". Tapi kalau
     * pemanggil menyebut `aktif` secara eksplisit (kolom "Status Aktif" pada
     * berkas impor), nilai itulah yang menang; sebelumnya selalu ditimpa `true`
     * sehingga re-import diam-diam mengaktifkan lagi pegawai yang nonaktif.
     */
    const reviveData =
      config.hasAktif && updatable[activeField] === undefined
        ? { ...updatable, [activeField]: true }
        : updatable;

    if (entity === 'waktu' && body.hari && body.program && body.jam_ke !== undefined) {
      const existing = await delegate.findFirst({
        where: { hari: body.hari, program: body.program, jam_ke: Number(body.jam_ke) },
      });
      if (existing) {
        if (upsert || (config.hasAktif && existing[activeField] === false)) {
          const updated = await delegate.update({
            where: { id: existing.id },
            data: reviveData,
          });
          return this.serialize(updated, entity);
        }
        throw new BadRequestException(
          `Jam ke-${body.jam_ke} untuk hari ${body.hari} (${body.program}) sudah ada`,
        );
      }
    } else if (config.uniqueField !== 'id') {
      /**
       * Duplikat dicari memakai kunci unik yang sebenarnya. Untuk entitas dengan
       * unik gabungan, mencocokkan `uniqueField` sendirian salah di dua arah:
       * baris sah ditolak ("nama_mapel sudah ada" untuk tingkat kelas yang
       * berbeda), dan `?upsert=true` menimpa baris milik tingkat/tahun lain.
       */
      const keyFields = config.uniqueFields ?? [config.uniqueField];
      const missing = keyFields.filter((f) => body[f] === undefined || body[f] === '');
      if (missing.length > 0) {
        throw new BadRequestException(`Kolom '${missing.join("', '")}' wajib diisi`);
      }
      const keyWhere = Object.fromEntries(keyFields.map((f) => [f, body[f]]));
      const existing = await delegate.findFirst({ where: keyWhere });

      if (existing) {
        if (upsert || (config.hasAktif && existing[activeField] === false)) {
          const updated = await delegate.update({
            where: { id: existing.id },
            data: reviveData,
          });
          return this.serialize(updated, entity);
        }
        const label = keyFields.map((f) => `${f} '${body[f]}'`).join(' + ');
        throw new BadRequestException(`${label} sudah ada`);
      }
    }

    try {
      return this.serialize(await delegate.create({ data }), entity);
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Data sudah ada (duplikat)');
      throw e;
    }
  }

  async update(entity: string, body: Record<string, any>) {
    const config = this.getConfig(entity);
    const delegate = this.delegate(config);
    const data = this.pickWritable(config, body, entity, true);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Tidak ada kolom yang diperbarui');
    }

    let where: Record<string, any>;
    const castedId =
      body.id !== undefined && body.id !== null && body.id !== ''
        ? this.castId(config, body.id)
        : null;
    const keyFields = config.uniqueFields ?? [config.uniqueField];
    if (castedId !== null) {
      where = { id: castedId };
    } else if (config.uniqueField !== 'id' && keyFields.every((f) => body[f])) {
      const existing = await delegate.findFirst({
        where: Object.fromEntries(keyFields.map((f) => [f, body[f]])),
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Data tidak ditemukan');
      where = { id: existing.id };
    } else {
      throw new BadRequestException(`ID atau ${config.uniqueField} wajib disertakan untuk update`);
    }

    try {
      return this.serialize(await delegate.update({ where, data }), entity);
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Data tidak ditemukan');
      throw e;
    }
  }

  async remove(
    entity: string,
    id: string | null,
    scope?: string,
    fullQuery?: Record<string, string>,
  ) {
    const config = this.getConfig(entity);
    const delegate = this.delegate(config);
    const activeField = config.activeField ?? 'aktif';

    if (scope === 'all') {
      const where: Record<string, any> = {};
      for (const field of config.writable) {
        const val = fullQuery?.[field];
        if (val !== undefined && val !== '') {
          where[field] = val;
        }
      }
      // `scope=all` memakai `deleteMany` — penghapusan PERMANEN, bukan hapus
      // lunak, dan tanpa jejak. Dulu yang menjaganya adalah role ADMIN; sejak
      // wewenang tab bisa ditunjuk dari layar Hak Akses Fitur, penjaganya adalah
      // konfirmasi ini.
      //
      // Konfirmasinya diminta untuk SEMUA `scope=all`, termasuk yang berfilter:
      // `?scope=all&tahun_ajaran=2020/2021` juga menghapus massal permanen, dan
      // satu nama filter yang salah ketik membuat filternya diabaikan sehingga
      // yang terhapus adalah seluruh tabel.
      if (fullQuery?.confirm !== 'all') {
        throw new BadRequestException(
          'Penghapusan permanen (?scope=all) harus disertai ?confirm=all',
        );
      }
      const { count } = await delegate.deleteMany({ where });
      return { deleted: count };
    }

    if (!id) throw new BadRequestException('ID is required');

    /**
     * `id` bisa berupa primary key atau nilai `uniqueField` — PegawaiTab
     * mengirim NIP. Primary key didahulukan agar perilaku pemanggil lama persis
     * sama; pencarian lewat kolom unik hanya jadi cadangan. Tanpa ini
     * `BigInt('G-01')` melempar 500, sedangkan NIP numerik ter-cast jadi angka
     * besar yang menunjuk baris lain (atau tidak ada).
     */
    const castedId = this.castId(config, id);
    let target: { id: any } | null = null;
    if (castedId !== null) {
      target = await delegate.findUnique({ where: { id: castedId }, select: { id: true } });
    }
    if (!target && config.uniqueField !== 'id') {
      target = await delegate.findFirst({
        where: { [config.uniqueField]: String(id) },
        select: { id: true },
      });
    }
    if (!target) throw new NotFoundException('Data tidak ditemukan');
    const where = { id: target.id };

    if (entity === 'tahun-ajaran') {
      await this.assertTahunAjaranDeletable(target.id);
    }

    try {
      if (config.hasAktif) {
        await delegate.update({ where, data: { [activeField]: false } });
      } else {
        await delegate.delete({ where });
      }
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Data tidak ditemukan');
      throw e;
    }

    return { deleted: 1 };
  }

  /**
   * `tahun-ajaran` tidak punya kolom `aktif`, jadi DELETE di entitas ini adalah
   * hapus permanen — dan dua jenis kerusakan menunggu di baliknya.
   *
   * `guru_mapel.tahun_ajaran` dan `wali_kelas.tahun_ajaran` menyimpan tahunnya
   * sebagai teks tanpa foreign key, jadi barisnya tertinggal menunjuk tahun yang
   * sudah tidak ada tanpa satu pun error dari database. Sebaliknya tiga tabel
   * e-supervisi menunjuk lewat `tahun_ajaran_id` dengan `onDelete: Cascade` —
   * penugasan, dokumen, dan unggahan guru satu tahun ajaran ikut terhapus diam-diam.
   *
   * Pola pemeriksaannya mengikuti pratinjau dampak pada mutasi pegawai: hitung
   * dulu, lalu tolak sambil menyebut angkanya.
   */
  private async assertTahunAjaranDeletable(id: any) {
    const row = await this.prisma.master_tahun_ajaran.findUnique({
      where: { id },
      select: { id: true, tahun_ajaran: true, semester: true, is_active: true },
    });
    if (!row) throw new NotFoundException('Data tidak ditemukan');

    if (row.is_active) {
      throw new BadRequestException(
        `${row.tahun_ajaran} ${row.semester ?? ''} sedang aktif. Nonaktifkan dulu sebelum menghapus.`.replace(
          /\s+/g,
          ' ',
        ),
      );
    }

    const tahunAjaran = row.tahun_ajaran;
    const [guruMapel, waliKelas, penugasan, unggahan, dokumen] = await Promise.all([
      this.prisma.guru_mapel.count({ where: { tahun_ajaran: tahunAjaran } }),
      this.prisma.wali_kelas.count({ where: { tahun_ajaran: tahunAjaran } }),
      this.prisma.sv_penugasan.count({ where: { tahun_ajaran_id: row.id } }),
      this.prisma.sv_unggahan_guru.count({ where: { tahun_ajaran_id: row.id } }),
      this.prisma.sv_master_dokumen.count({ where: { tahun_ajaran_id: row.id } }),
    ]);

    const dipakai = [
      { label: 'Guru Mapel', count: guruMapel },
      { label: 'Wali Kelas', count: waliKelas },
      { label: 'Penugasan Supervisi', count: penugasan },
      { label: 'Unggahan Supervisi', count: unggahan },
      { label: 'Dokumen Supervisi', count: dokumen },
    ].filter((c) => c.count > 0);

    if (dipakai.length > 0) {
      const rincian = dipakai.map((c) => `${c.label} (${c.count})`).join(', ');
      throw new BadRequestException(
        `${tahunAjaran} masih dipakai oleh ${rincian}. Hapus atau pindahkan data itu lebih dulu.`,
      );
    }
  }

  async getDropdowns() {
    const data = await this.prisma.master_dropdown.findMany({
      where: { aktif: true },
      orderBy: { urutan: 'asc' },
    });
    const extractOptions = (key: string) =>
      Array.from(new Set(data.map((d: any) => d[key]).filter(Boolean)))
        .map((v: any) => ({ value: v, label: v }));

    /**
     * `terlambat: extractOptions('keterangan_terlambat')` dihapus dari sini.
     *
     * Kolom `keterangan_terlambat` ada di migrasi awal tabel ini, tetapi sudah
     * TIDAK ADA lagi di tabel `master_dropdown` di database (diperiksa langsung ke
     * information_schema: tabelnya hanya punya 12 kolom, dan itu bukan salah
     * satunya) — dan karena itu juga tidak ada di schema.prisma. Prisma hanya
     * mengambil kolom yang dikenalnya, jadi baris ini selalu menghasilkan larik
     * kosong: bukan "belum ada datanya", tapi tidak mungkin ada.
     */
    return {
      kategori_kehadiran: extractOptions('kategori_kehadiran'),
      status_ketidakhadiran: extractOptions('status_ketidakhadiran'),
      jenis_ketidakhadiran: extractOptions('jenis_ketidakhadiran'),
      golongan: extractOptions('golongan'),
      pangkat: extractOptions('pangkat'),
      tugas_tambahan: extractOptions('tugas_tambahan'),
      jenis_surat: extractOptions('jenis_surat'),
    };
  }

  async bulkCreateJpMapel(body: any) {
    if (Array.isArray(body)) {
      const validItems = body.filter(
        (item) => item.nama_mapel && item.tingkat_kelas && item.tahun_ajaran && item.semester,
      );
      if (validItems.length === 0) {
        throw new BadRequestException('Tidak ada data valid untuk diimport (kolom wajib kosong)');
      }
      let count = 0;
      for (const item of validItems) {
        const intra = parseInt(item.jp_intra) || 0;
        const ko = parseInt(item.jp_ko) || 0;
        const smtArr =
          item.semester?.toString().toLowerCase() === 'semua' ? ['Ganjil', 'Genap'] : [item.semester];
        for (const s of smtArr) {
          const payload: any = {
            nama_mapel: item.nama_mapel,
            tingkat_kelas: item.tingkat_kelas,
            tahun_ajaran: item.tahun_ajaran,
            semester: s,
            jp_intra: intra,
            jp_ko: ko,
            jumlah_jp: intra + ko,
            aktif: item.aktif ?? true,
            updated_at: new Date(),
          };
          if (item.id && smtArr.length === 1) {
            await this.prisma.master_jp_mapel.upsert({
              where: { id: Number(item.id) },
              update: payload,
              create: payload,
            });
          } else {
            const existing = await this.prisma.master_jp_mapel.findFirst({
              where: {
                nama_mapel: payload.nama_mapel,
                tingkat_kelas: payload.tingkat_kelas,
                tahun_ajaran: payload.tahun_ajaran,
                semester: payload.semester,
              },
            });
            if (existing) {
              await this.prisma.master_jp_mapel.update({
                where: { id: existing.id },
                data: payload,
              });
            } else {
              await this.prisma.master_jp_mapel.create({ data: payload });
            }
          }
          count++;
        }
      }
      return { count };
    }

    // Single item
    const { nama_mapel, tingkat_kelas, tahun_ajaran, semester, jp_intra, jp_ko, aktif, id } = body;
    if (!nama_mapel || !tingkat_kelas || !tahun_ajaran || !semester) {
      throw new BadRequestException('Semua field wajib diisi');
    }
    const intra = parseInt(jp_intra) || 0;
    const ko = parseInt(jp_ko) || 0;
    const jumlah_jp = intra + ko;
    const smtArr = semester.toLowerCase() === 'semua' ? ['Ganjil', 'Genap'] : [semester];
    let lastData: any = null;
    for (const s of smtArr) {
      const payload: any = {
        nama_mapel,
        tingkat_kelas,
        tahun_ajaran,
        semester: s,
        jp_intra: intra,
        jp_ko: ko,
        jumlah_jp,
        aktif: aktif ?? true,
        updated_at: new Date(),
      };
      if (id && smtArr.length === 1) {
        lastData = await this.prisma.master_jp_mapel.upsert({
          where: { id: Number(id) },
          update: payload,
          create: payload,
        });
      } else {
        const existing = await this.prisma.master_jp_mapel.findFirst({
          where: { nama_mapel, tingkat_kelas, tahun_ajaran, semester: s },
        });
        if (existing) {
          lastData = await this.prisma.master_jp_mapel.update({
            where: { id: existing.id },
            data: payload,
          });
        } else {
          lastData = await this.prisma.master_jp_mapel.create({ data: payload });
        }
      }
    }
    return this.serialize(lastData);
  }

  async getMapelKelas(kelas: string, tahun_ajaran: string) {
    if (!kelas || !tahun_ajaran) {
      throw new BadRequestException('Kelas dan Tahun Ajaran wajib diisi');
    }
    const data = await this.prisma.master_mapel_kelas.findMany({
      where: { kelas_nama: kelas, tahun_ajaran },
      include: {
        master_mapel: { select: { nama: true, kelompok: true } },
        master_guru: { select: { nama_lengkap: true } },
      },
    });
    return this.serialize(data);
  }

  async saveMapelKelas(body: any) {
    const { kelas, tahun_ajaran, mappings } = body;
    if (!kelas || !tahun_ajaran || !Array.isArray(mappings)) {
      throw new BadRequestException('Data tidak lengkap');
    }
    await this.prisma.master_mapel_kelas.deleteMany({
      where: { kelas_nama: kelas, tahun_ajaran },
    });
    if (mappings.length > 0) {
      await this.prisma.master_mapel_kelas.createMany({
        data: mappings.map((m: any) => ({
          kelas_nama: kelas,
          tahun_ajaran,
          mapel_kode: m.mapel_kode,
          guru_nip: m.guru_nip || null,
        })),
      });
    }
    return { message: 'Mapping berhasil diperbarui' };
  }

  async getPindahPreview(nip: string) {
    if (!nip) throw new BadRequestException('NIP wajib disertakan');
    const pegawai = await this.prisma.master_guru.findUnique({
      where: { nip },
      select: { nip: true, nama_lengkap: true, jenis_pegawai: true, aktif: true },
    });
    if (!pegawai) throw new NotFoundException(`NIP ${nip} tidak ditemukan`);

    const asal = pegawai.jenis_pegawai?.toUpperCase() === 'TENDIK' ? 'TENDIK' : 'GURU';
    const tujuan = asal === 'GURU' ? 'TENDIK' : 'GURU';

    let penugasan: any[] = [];
    if (asal === 'GURU') {
      const [gm, wk, ga, jg, jp, tt] = await Promise.all([
        this.prisma.guru_mapel.count({ where: { nip, aktif: true } }).catch(() => 0),
        this.prisma.wali_kelas.count({ where: { nip, aktif: true } }).catch(() => 0),
        this.prisma.guru_asuh.count({ where: { nip, aktif: true } }).catch(() => 0),
        this.prisma.jadwal_guru.count({ where: { nip, aktif: true } }).catch(() => 0),
        this.prisma.jadwal_piket.count({ where: { nip, aktif: true } }).catch(() => 0),
        this.prisma.tugas_tambahan.count({ where: { nip } }).catch(() => 0),
      ]);
      const checks = [
        { label: 'Guru Mapel', count: gm },
        { label: 'Wali Kelas', count: wk },
        { label: 'Guru Asuh', count: ga },
        { label: 'Jadwal Mengajar', count: jg },
        { label: 'Jadwal Piket', count: jp },
        { label: 'Tugas Tambahan', count: tt },
      ];
      penugasan = checks.filter((c) => c.count > 0);
    }

    return {
      nip: pegawai.nip,
      nama_lengkap: pegawai.nama_lengkap,
      asal,
      tujuan,
      penugasan,
    };
  }

  async executePindah(nip: string, tujuanInput?: string) {
    if (!nip) throw new BadRequestException('NIP wajib disertakan');
    const pegawai = await this.prisma.master_guru.findUnique({
      where: { nip },
      select: { nip: true, nama_lengkap: true, jenis_pegawai: true },
    });
    if (!pegawai) throw new NotFoundException(`NIP ${nip} tidak ditemukan`);

    const asal = pegawai.jenis_pegawai?.toUpperCase() === 'TENDIK' ? 'TENDIK' : 'GURU';
    const tujuan =
      tujuanInput?.toUpperCase() === 'TENDIK'
        ? 'TENDIK'
        : tujuanInput?.toUpperCase() === 'GURU'
          ? 'GURU'
          : asal === 'GURU'
            ? 'TENDIK'
            : 'GURU';

    if (asal === tujuan) {
      throw new BadRequestException(`${pegawai.nama_lengkap} sudah berstatus ${tujuan}`);
    }

    const updated = await this.prisma.master_guru.update({
      where: { nip },
      data: { jenis_pegawai: tujuan },
      select: { nip: true, nama_lengkap: true, jenis_pegawai: true },
    });

    return {
      ...updated,
      message: `${updated.nama_lengkap} dipindahkan dari ${asal} ke ${tujuan}`,
    };
  }

  async checkImport(type: string, data: any[]) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { conflicts: [], cleanData: [] };
    }

    let table = '';
    let keyField = '';
    let keyProp = '';
    let nameField = '';
    let nameProp = '';

    if (type === 'siswa') {
      table = 'master_siswa';
      keyField = 'nisn';
      keyProp = 'nisn';
      nameField = 'nama_lengkap';
      nameProp = 'nama_lengkap';
    } else if (type === 'guru') {
      table = 'master_guru';
      keyField = 'nip';
      keyProp = 'nip';
      nameField = 'nama_lengkap';
      nameProp = 'nama_lengkap';
    } else if (type === 'mapel') {
      table = 'master_mapel';
      keyField = 'kode';
      keyProp = 'kode';
      nameField = 'nama';
      nameProp = 'nama';
    } else if (type === 'ruangan') {
      table = 'master_ruangan';
      keyField = 'kode';
      keyProp = 'kode';
      nameField = 'nama';
      nameProp = 'nama';
    } else {
      return { conflicts: [] as any[], cleanData: data };
    }

    const dbData: any[] = await (this.prisma as any)[table].findMany({
      select: { [keyField]: true, [nameField]: true, aktif: true },
    });

    const conflicts: any[] = [];
    const newItems: any[] = [];
    const identicalItems: any[] = [];

    const dbMapByKey = new Map(dbData.map((d) => [String(d[keyField]), d]));
    const dbMapByName = new Map(dbData.map((d) => [String(d[nameField] || '').toLowerCase().trim(), d]));

    for (const row of data) {
      const rowKey = String(row[keyProp] || '').trim();
      const rowName = String(row[nameProp] || '').trim();
      const rowNameLower = rowName.toLowerCase();

      const matchByKey = dbMapByKey.get(rowKey);
      const matchByName = dbMapByName.get(rowNameLower);

      if (matchByKey) {
        const dbName = String(matchByKey[nameField] || '').trim();
        if (dbName.toLowerCase() !== rowNameLower) {
          conflicts.push({
            id: rowKey,
            type: 'ID_MATCH_NAME_DIFF',
            excel: row,
            db: matchByKey,
          });
          continue;
        }
        identicalItems.push(row);
        continue;
      }

      if (matchByName) {
        conflicts.push({
          id: rowKey,
          type: 'NAME_MATCH_ID_DIFF',
          excel: row,
          db: matchByName,
        });
        continue;
      }

      newItems.push(row);
    }

    return { conflicts, newItems, identicalItems };
  }

  async getGuruRekening(nip: string) {
    if (!nip) throw new BadRequestException('NIP wajib diisi');
    const guru = await this.prisma.master_guru.findUnique({
      where: { nip },
      select: {
        nip: true,
        rekening_1_nama_bank: true,
        rekening_1_nomor: true,
        rekening_1_atas_nama: true,
        rekening_1_aktif: true,
        rekening_2_nama_bank: true,
        rekening_2_nomor: true,
        rekening_2_atas_nama: true,
        rekening_2_aktif: true,
      },
    });
    if (!guru) return [];
    const accounts: any[] = [];
    if (guru.rekening_1_nama_bank && guru.rekening_1_aktif) {
      accounts.push({
        id: 1,
        nip: guru.nip,
        nama_bank: guru.rekening_1_nama_bank,
        nomor_rekening: guru.rekening_1_nomor,
        atas_nama: guru.rekening_1_atas_nama,
        is_primary: true,
        aktif: true,
      });
    }
    if (guru.rekening_2_nama_bank && guru.rekening_2_aktif) {
      accounts.push({
        id: 2,
        nip: guru.nip,
        nama_bank: guru.rekening_2_nama_bank,
        nomor_rekening: guru.rekening_2_nomor,
        atas_nama: guru.rekening_2_atas_nama,
        is_primary: false,
        aktif: true,
      });
    }
    return accounts;
  }
}
