import { Injectable, BadRequestException, ForbiddenException, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { DATASETS, DatasetDef, KolomDef, getDataset, kolomEfektif } from './datasets';
@Injectable()
export class BankDataService {
    constructor(private readonly prisma: PrismaService, private readonly access: AccessService) { }
    private async permission(user: any) {
        if (!user?.id)
            throw new ForbiddenException('Sesi diperlukan');
        const a = await this.access.resolveUserAccess(user);
        const admin = a.roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r));
        
        let bolehKelola = admin || !!a.caps?.includes('bank_data.kelola');
        if (!bolehKelola) {
            try {
                const setting = await this.prisma.site_settings.findUnique({ where: { key: 'bank_data.kelola' } });
                if (setting?.value) {
                    const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
                    const roles = a.roles.map(r => r.toUpperCase());
                    const idStr = String(user.id);
                    if (Array.isArray(parsed?.allowedRoles) && parsed.allowedRoles.some((r: string) => roles.includes(r.toUpperCase()))) {
                        bolehKelola = true;
                    }
                    if (Array.isArray(parsed?.allowedUsers) && parsed.allowedUsers.some((u: any) => String(u?.id) === idStr)) {
                        bolehKelola = true;
                    }
                }
            } catch {
                // Abaikan jika tidak ada
            }
        }

        // Cek apakah user memiliki akses halaman Bank Data (via role_pages, page_overrides, atau hak kelola)
        const hasAccess = admin || bolehKelola || a.pageIds.includes('bank-data');

        if (!hasAccess) {
            throw new ForbiddenException('Tidak memiliki akses Bank Data');
        }

        return { bolehKelola, bolehSensitif: admin || !!a.caps?.includes('bank_data.export_sensitif') };
    }
    private async manager(user: any) { if (!(await this.permission(user)).bolehKelola)
        throw new ForbiddenException('Izin pengelola diperlukan'); }
    private config(def: DatasetDef, row: any) {
        const defaultCols = def.kolom.filter(k => !k.sensitif).map(k => k.key);
        const validSet = new Set(def.kolom.map(c => c.key));
        const savedCols = Array.isArray(row?.kolom_diizinkan) ? row.kolom_diizinkan.filter((k: string) => validSet.has(k)) : [];
        return {
            aktif: row ? row.aktif === true : true,
            kolomDiizinkan: row ? savedCols : defaultCols,
            batasBaris: Math.max(1, Math.min(def.batasBaris, Math.floor(Number(row?.batas_baris) || def.batasBaris))),
            catatan: row?.catatan || ''
        };
    }
    async getCatalog(user: any) {
        const permission = await this.permission(user);
        const configs = await this.prisma.bank_data_dataset_config.findMany();
        return { ok: true, ...permission, data: Object.values(DATASETS).map(def => {
                const cfg = this.config(def as DatasetDef, configs.find(c => c.dataset_id === def.id));
                return { id: def.id, label: def.label, ikon: def.ikon, deskripsi: def.deskripsi, filter: def.filter, ...cfg,
                    kolom: kolomEfektif(def as DatasetDef, null, cfg.kolomDiizinkan, permission.bolehSensitif).map(k => ({ ...k, pendukung: !!k.pendukung })) };
            }).filter(d => d.aktif && d.kolom.length > 0) };
    }
    async getConfig(user: any) {
        await this.manager(user);
        const rows = await this.prisma.bank_data_dataset_config.findMany();
        return { ok: true, data: Object.values(DATASETS).map(def => ({ ...def, ...this.config(def as DatasetDef, rows.find(r => r.dataset_id === def.id)), batasBarisKatalog: def.batasBaris, kolom: def.kolom.map(k => ({ ...k, pendukung: !!('pendukung' in k && k.pendukung) })) })) };
    }
    async updateConfig(body: any, user: any) {
        await this.manager(user);
        const def = getDataset(body?.dataset_id);
        if (!def)
            throw new BadRequestException('Dataset tidak dikenal');
        if (!Array.isArray(body.kolomDiizinkan))
            throw new BadRequestException('Kolom tidak valid');
        const validSet = new Set(def.kolom.map(c => c.key));
        const cleanKolom = body.kolomDiizinkan.filter((k: any) => typeof k === 'string' && validSet.has(k));
        const limit = body.batasBaris ? Number(body.batasBaris) : null;
        if (limit !== null && (!Number.isInteger(limit) || limit < 1))
            throw new BadRequestException('Batas baris tidak valid');
        const userId = user?.id ? BigInt(user.id) : null;
        const data = {
            aktif: body.aktif === true,
            kolom_diizinkan: cleanKolom,
            batas_baris: limit,
            catatan: body.catatan || null,
            updated_by: userId,
            updated_at: new Date(),
        };
        await this.prisma.bank_data_dataset_config.upsert({ where: { dataset_id: def.id }, create: { dataset_id: def.id, ...data }, update: data });
        return { ok: true };
    }
    async getLogs(user: any, page = 1, limit = 50, datasetId?: string) {
        await this.manager(user);
        page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
        const where = datasetId ? { dataset_id: datasetId } : {};
        const [data, total] = await Promise.all([this.prisma.bank_data_log.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' } }), this.prisma.bank_data_log.count({ where })]);
        return { ok: true, data: JSON.parse(JSON.stringify(data.map(r => ({ ...r, dataset_label: getDataset(r.dataset_id)?.label || r.dataset_id })), (_, v) => typeof v === 'bigint' ? String(v) : v)), total, halaman: page, perHalaman: limit };
    }
    // Dynamic identifiers below come only from the server catalog, never the request.
    private model(table: string): any { return (this.prisma as any)[table]; }
    private values(table: string, column: string, values: any[]) {
        const type = Prisma.dmmf.datamodel.models.find(m => m.name === table)?.fields.find(f => f.name === column)?.type;
        return values.map(v => type === 'BigInt' ? BigInt(v) : type === 'Int' ? Number(v) : String(v));
    }
    private filter(p: any, f: any) {
        const where: any = {};
        if (p.kolomAktif)
            where[p.kolomAktif] = true;
        if (p.kolomTahunAjaran && typeof f?.tahun_ajaran === 'string' && f.tahun_ajaran.trim())
            where[p.kolomTahunAjaran] = f.tahun_ajaran.trim();
        if (p.kolomSemester && f?.semester) {
            const semStr = String(f.semester).trim().toLowerCase();
            const n = ['1', 'ganjil'].includes(semStr) ? 1 : ['2', 'genap'].includes(semStr) ? 2 : 0;
            if (!n)
                throw new BadRequestException('Semester tidak valid');
            where[p.kolomSemester] = p.tipeSemester === 'angka' ? n : n === 1 ? 'Ganjil' : 'Genap';
        }
        return where;
    }
    private async rows(def: DatasetDef, columns: KolomDef[], filter: any, take: number, skip = 0, query = '') {
        const where: any = {};
        for (const b of def.baseFilter || [])
            where[b.kolom] = b.op === 'eq' ? b.nilai : { equals: b.nilai, mode: 'insensitive' };
        // Search only permitted identity fields; hidden columns cannot be probed.
        if (query) {
            const fields = columns.filter(c => !c.pendukung && c.tipe === 'teks');
            where.OR = fields.length ? fields.map(c => ({ [c.key]: { contains: query, mode: 'insensitive' } })) : [{ id: { in: [] } }];
        }
        const p = def.prasaring;
        if (p && (filter.tahun_ajaran || filter.semester || filter.kelas?.length)) {
            const pre = this.filter(p, filter);
            if (p.kolomKelas && filter.kelas?.length)
                pre[p.kolomKelas] = { in: filter.kelas };
            const keys = await this.model(p.table).findMany({ where: pre, select: { [p.kolomKunci]: true }, distinct: [p.kolomKunci] });
            where[p.kunciInduk] = { in: keys.map((r: any) => r[p.kolomKunci]) };
        }
        const needed = new Set(columns.map(c => c.key));
        for (const c of [...def.kolom].reverse())
            if (needed.has(c.key) && c.pendukung?.kunciDari)
                needed.add(c.pendukung.kunciDari);
        const working = def.kolom.filter(c => needed.has(c.key));
        const select: any = { id: true };
        for (const c of working) {
            if (!c.pendukung)
                select[c.key] = true;
            else if (c.pendukung.kunciInduk)
                select[c.pendukung.kunciInduk] = true;
        }
        const [total, rows] = await Promise.all([
            this.model(def.table).count({ where }),
            this.model(def.table).findMany({
                where,
                select,
                take,
                skip,
                orderBy: def.urut && def.urut.kolom !== 'id' ? [{ [def.urut.kolom]: def.urut.naik === false ? 'desc' : 'asc' }, { id: 'asc' }] : { id: 'asc' }
            })
        ]);
        const raw: Record<string, any[]>[] = rows.map(() => ({}));
        for (const col of working.filter(c => c.pendukung)) {
            const d = col.pendukung!;
            const perRow = rows.map((r: any, i: number) => d.kunciDari ? raw[i][d.kunciDari] || [] : r[d.kunciInduk!] == null ? [] : [r[d.kunciInduk!]]);
            const keys = [...new Set(perRow.flat())];
            const related = keys.length ? await this.model(d.table).findMany({ where: { ...this.filter(d, filter), [d.kunciPendukung]: { in: this.values(d.table, d.kunciPendukung, keys) } }, select: { [d.kunciPendukung]: true, [d.kolomNilai]: true } }) : [];
            const labels = new Map<string, string>();
            if (d.lewat && related.length) {
                const l = d.lewat;
                const ids = [...new Set(related.map((r: any) => r[d.kolomNilai]).filter((v: any) => v != null))];
                const refs = await this.model(l.table).findMany({ where: { [l.kunci]: { in: this.values(l.table, l.kunci, ids) } }, select: { [l.kunci]: true, [l.kolomNilai]: true } });
                refs.forEach((r: any) => labels.set(String(r[l.kunci]), String(r[l.kolomNilai] ?? '')));
            }
            rows.forEach((r: any, i: number) => {
                const keys = new Set(perRow[i].map(String));
                const vals: string[] = related.filter((x: any) => keys.has(String(x[d.kunciPendukung]))).map((x: any) => d.lewat ? labels.get(String(x[d.kolomNilai])) : x[d.kolomNilai]).filter((v: any) => v != null && v !== '').map(String);
                raw[i][col.key] = [...new Set(vals)].sort();
                r[col.key] = raw[i][col.key].join(', ');
            });
        }
        return { total, data: rows.map((r: any) => Object.fromEntries(columns.map(c => [c.key, typeof r[c.key] === 'bigint' ? String(r[c.key]) : r[c.key]]))) };
    }
    async handlePost(body: any, user: any, ip = '') {
        const permission = await this.permission(user);
        const def = getDataset(body?.dataset_id);
        if (!def || !['data', 'preview', 'export'].includes(body?.action))
            throw new BadRequestException('Dataset atau aksi tidak dikenal');
        const cfg = this.config(def, await this.prisma.bank_data_dataset_config.findUnique({ where: { dataset_id: def.id } }));
        if (!cfg.aktif)
            throw new ForbiddenException('Dataset tidak aktif');
        if (!Array.isArray(body.kolom) || !body.kolom.length)
            throw new BadRequestException('Pilih kolom');
        const columns = kolomEfektif(def, body.kolom, cfg.kolomDiizinkan, permission.bolehSensitif);
        if (!columns.length || body.kolom.some((k: any) => !columns.some(c => c.key === k)))
            throw new ForbiddenException('Kolom tidak diizinkan');
        const filter = body.filter ?? {};
        if (typeof filter !== 'object' || Array.isArray(filter) || Object.keys(filter).some(k => !def.filter.includes(k as any)))
            throw new BadRequestException('Filter tidak didukung');
        if (filter.kelas !== undefined && (!Array.isArray(filter.kelas) || filter.kelas.some((v: any) => typeof v !== 'string')))
            throw new BadRequestException('Filter kelas tidak valid');
        if (filter.tahun_ajaran !== undefined && typeof filter.tahun_ajaran !== 'string')
            throw new BadRequestException('Filter tahun ajaran tidak valid');
        if (filter.semester !== undefined && typeof filter.semester !== 'string')
            throw new BadRequestException('Filter semester tidak valid');
        if (filter.semester && !['1', '2', 'ganjil', 'genap'].includes(filter.semester.trim().toLowerCase()))
            throw new BadRequestException('Semester tidak valid');
        if ((filter.kelas?.length || 0) > 200 || filter.kelas?.some((v: string) => v.length > 100) || (filter.tahun_ajaran?.length || 0) > 50)
            throw new BadRequestException('Filter terlalu panjang');
        if (body.q !== undefined && (typeof body.q !== 'string' || body.q.length > 100))
            throw new BadRequestException('Pencarian tidak valid');
        const query = body.q?.trim() || '';
        const page = body.halaman ?? 1, limit = body.perHalaman ?? 20;
        if (body.action === 'data' && (!Number.isSafeInteger(page) || page < 1 || page > cfg.batasBaris || !Number.isInteger(limit) || limit < 1 || limit > 100))
            throw new BadRequestException('Halaman tidak valid');
        const skip = body.action === 'data' ? (page - 1) * limit : 0;
        const take = body.action === 'data' ? Math.max(0, Math.min(limit, cfg.batasBaris - skip)) : Math.min(body.action === 'preview' ? 50 : cfg.batasBaris, cfg.batasBaris);
        const result = await this.rows(def, columns, filter, take, skip, query);
        
        if (body.action !== 'export') {
            // Catat audit trail pratinjau jika terdapat kolom sensitif
            if (columns.some(c => c.sensitif)) {
                await this.prisma.bank_data_log.create({
                    data: {
                        user_id: user?.id ? BigInt(user.id) : null,
                        nama_user: user?.nama || user?.username || '',
                        dataset_id: def.id,
                        filter: { ...filter, q: query, _tipe: body.action },
                        kolom: columns.map(c => c.key),
                        jumlah_baris: result.data.length,
                        ip: ip || null,
                    },
                });
            }
            return {
                ok: true,
                ...result,
                totalTersedia: Math.min(result.total, cfg.batasBaris),
                batas: cfg.batasBaris,
                terpotong: result.total > cfg.batasBaris,
                halaman: page,
                perHalaman: limit,
                kolom: columns.map(c => ({ key: c.key, label: c.label })),
            };
        }

        const book = new Workbook();
        book.creator = 'ACCA Madrasah';
        book.lastModifiedBy = user?.nama || user?.username || 'ACCA System';
        book.created = new Date();
        book.modified = new Date();

        let totalRowsExported = 0;
        const isSiswaAllYears = def.id === 'siswa' && (!filter.tahun_ajaran || !String(filter.tahun_ajaran).trim());

        if (isSiswaAllYears) {
            let distinctTas: any[] = [];
            let masterTas: any[] = [];
            try {
                if (this.prisma.siswa_kelas?.findMany) {
                    distinctTas = await this.prisma.siswa_kelas.findMany({
                        where: { tahun_ajaran: { not: '' } },
                        select: { tahun_ajaran: true },
                        distinct: ['tahun_ajaran'],
                        orderBy: { tahun_ajaran: 'desc' },
                    });
                }
            } catch {
                distinctTas = [];
            }
            try {
                if (this.prisma.master_tahun_ajaran?.findMany) {
                    masterTas = await this.prisma.master_tahun_ajaran.findMany({
                        select: { tahun_ajaran: true },
                        distinct: ['tahun_ajaran'],
                        orderBy: { tahun_ajaran: 'desc' },
                    });
                }
            } catch {
                masterTas = [];
            }

            const allTas = Array.from(new Set([
                ...distinctTas.map((t: any) => t.tahun_ajaran).filter(Boolean),
                ...masterTas.map((t: any) => t.tahun_ajaran).filter(Boolean),
            ])).sort().reverse();

            const exportedNisns = new Set<string>();
            let hasSheet = false;

            for (const ta of allTas) {
                const taResult = await this.rows(def, columns, { ...filter, tahun_ajaran: ta }, cfg.batasBaris, 0, query);
                if (taResult.data.length > 0) {
                    this.buildWorksheet(book, ta, columns, taResult.data);
                    totalRowsExported += taResult.data.length;
                    taResult.data.forEach((r: any) => { if (r.nisn) exportedNisns.add(String(r.nisn)); });
                    hasSheet = true;
                }
            }

            const unassigned = result.data.filter((r: any) => r.nisn && !exportedNisns.has(String(r.nisn)));
            if (unassigned.length > 0) {
                this.buildWorksheet(book, 'Tanpa Tahun Ajaran', columns, unassigned);
                totalRowsExported += unassigned.length;
                hasSheet = true;
            }

            if (!hasSheet) {
                const sheetName = (def.label || 'Data').replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
                this.buildWorksheet(book, sheetName, columns, result.data);
                totalRowsExported = result.data.length;
            }
        } else {
            const sheetName = (filter.tahun_ajaran ? filter.tahun_ajaran : (def.label || 'Data')).replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
            this.buildWorksheet(book, sheetName, columns, result.data);
            totalRowsExported = result.data.length;
        }

        const buffer = await book.xlsx.writeBuffer();

        await this.prisma.bank_data_log.create({
            data: {
                user_id: user?.id ? BigInt(user.id) : null,
                nama_user: user?.nama || user?.username || '',
                dataset_id: def.id,
                filter: { ...filter, q: query },
                kolom: columns.map(c => c.key),
                jumlah_baris: totalRowsExported,
                ip: ip || null,
            },
        });
        return new StreamableFile(Buffer.from(buffer));
    }

    private buildWorksheet(book: Workbook, sheetName: string, columns: KolomDef[], rowData: Record<string, any>[]) {
        const sanitizeCellValue = (val: any, tipe: string, key: string) => {
            if (val === null || val === undefined) return '';
            if (tipe === 'boolean') {
                return val ? 'Ya' : 'Tidak';
            }
            if (val instanceof Date) {
                return val.toISOString().slice(0, 10);
            }
            if (typeof val === 'string') {
                if (/^\d{4}-\d{2}-\d{2}(T|\b)/.test(val)) {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                        return val.slice(0, 10);
                    }
                }
                if (/^[=+@-]/s.test(val)) {
                    return `'${val}`;
                }
                return val;
            }
            return String(val);
        };

        const safeSheetName = sheetName.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
        const sheet = book.addWorksheet(safeSheetName, {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
        });

        sheet.columns = columns.map(c => ({
            header: c.label,
            key: c.key,
            width: Math.max(c.label.length + 4, 14),
        }));

        const headerRow = sheet.getRow(1);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
            cell.font = {
                name: 'Segoe UI',
                size: 11,
                bold: true,
                color: { argb: 'FFFFFFFF' },
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E40AF' },
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true,
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
        });

        const textKeyPatterns = ['nisn', 'nip', 'nik', 'no_hp', 'nomor', 'rekening'];
        rowData.forEach((r: any, idx: number) => {
            const cleanRow: Record<string, any> = {};
            for (const c of columns) {
                cleanRow[c.key] = sanitizeCellValue(r[c.key], c.tipe, c.key);
            }
            const row = sheet.addRow(cleanRow);
            row.height = 22;
            const isEven = idx % 2 === 0;

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const colDef = columns[colNumber - 1];
                const key = colDef?.key || '';
                const isNumericId = textKeyPatterns.some(p => key.includes(p));

                if (isNumericId && cell.value) {
                    cell.numFmt = '@';
                }

                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    color: { argb: 'FF0F172A' },
                };

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
                };

                let hAlign: 'left' | 'center' | 'right' = 'left';
                if (colDef?.tipe === 'boolean' || colDef?.tipe === 'tanggal' || isNumericId || key === 'gender' || key === 'golongan') {
                    hAlign = 'center';
                } else if (colDef?.tipe === 'angka') {
                    hAlign = 'right';
                }

                cell.alignment = {
                    vertical: 'middle',
                    horizontal: hAlign,
                };

                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
            });
        });

        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length },
        };

        sheet.columns.forEach((column: any) => {
            let maxLen = column.header ? String(column.header).length : 10;
            if (column.eachCell) {
                column.eachCell({ includeEmpty: false }, (cell: any, rowNumber: number) => {
                    if (rowNumber > 1) {
                        const len = cell.value ? String(cell.value).length : 0;
                        if (len > maxLen) maxLen = len;
                    }
                });
            }
            column.width = Math.min(Math.max(maxLen + 4, 12), 48);
        });

        return sheet;
    }
}
