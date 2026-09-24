// @ts-nocheck

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaDbAdapter } from '../prisma/prisma-db-adapter';
import { Request, Response } from 'express';

class MockNextResponse {
    constructor(private res: Response) {}
    json(data: any, options?: { status?: number }) {
        return this.res.status(options?.status || 200).json(data);
    }
}

class MockNextRequest {
    constructor(private req: Request) {}
    get url() {
        return 'http://localhost' + (this.req.originalUrl || this.req.url);
    }
    get nextUrl() {
        return new URL(this.url);
    }
    async json() {
        return this.req.body;
    }
    get headers() {
        return {
            get: (name: string) => this.req.headers[name.toLowerCase()]
        };
    }
    get cookies() {
        return {
            get: (name: string) => ({ value: this.req.cookies?.[name] })
        };
    }
}

let globalDb: any;
let globalPrisma: PrismaService;
import { randomUUID } from "crypto";

/**
 * Akses database bergaya `.from(tabel).select(...)`.
 *
 * Isinya PRISMA, bukan Supabase: setiap metode di KeuanganService mengisi
 * `globalDb` dengan `createPrismaDbAdapter(this.prisma)`, jadi semua query
 * berjalan di PostgreSQL VPS. Dulu keduanya bernama `supabaseAdmin` dan
 * `globalSupabase` — warisan dari sebelum modul ini bermigrasi. Nama itu diganti
 * karena menyesatkan: mencari "supabaseAdmin" di repo memunculkan berkas ini
 * seolah masih memakai Supabase, dan itu pernah membuat kesimpulan audit salah.
 */
const db: any = new Proxy({}, {
    get: (target, prop) => {
        if (!globalDb) throw new Error("Adapter database belum disiapkan");
        return globalDb[prop];
    }
});

// Mock getApiUser
async function getApiUser(reqWrapper: MockNextRequest): Promise<any> {
    const req = (reqWrapper as any)?.req || reqWrapper;
    if (!req?.user) return null;
    const roleStr = String(req.user.role || '');
    const roles = req.user.roles || roleStr.split(/[,|]/).map((r: string) => r.trim()).filter(Boolean);
    const upperRoles = roles.map((r: string) => r.toUpperCase());
    const isAdmin = upperRoles.includes('ADMIN') || upperRoles.includes('ADMINISTRATOR');
    return {
        id: req.user.id,
        authId: req.user.auth_id || req.user.authId,
        nama: req.user.nama || req.user.name || '',
        nip: req.user.nip || '',
        nisn: req.user.nisn || '',
        roles: upperRoles,
        isAdmin,
        isPrivileged: isAdmin || upperRoles.includes('OP_JURNAL'),
    };
}

function unauthorizedResponse() {
    return { isResponseMock: true, status: 401, data: { ok: false, error: 'Unauthorized' } };
}

function forbiddenResponse(msg: string) {
    return { isResponseMock: true, status: 403, data: { ok: false, error: msg } };
}

// Namespace for Catatan Keuangan
namespace CK {
    const NextResponse = {
        json: (data: any, options?: { status?: number }) => ({ isResponseMock: true, status: options?.status || 200, data })
    };
    
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // GET /api/catatan-keuangan - Get all catatan keuangan
    export async function _GET(request: any) {
        try {
            const { searchParams } = new URL(request.url);
            const user = await getApiUser(request);
            if (!user) return unauthorizedResponse();
            const privileged = user.isAdmin || user.roles.includes('BENDAHARA_KOMITE');
            if (!privileged && !user.nip) return forbiddenResponse('Identitas diperlukan');
            const nip = privileged ? searchParams.get('nip') : user.nip;
            const status = searchParams.get('status');
            const tahun_ajaran = searchParams.get('tahun_ajaran');

            let query = db
                .from('catatan_keuangan')
                .select('*')
                .order('created_at', { ascending: false });

            if (nip) {
                query = query.eq('nip', String(nip).trim());
            }

            if (status && ['BELUM_TERGANTI', 'TERGANTI'].includes(status)) {
                query = query.eq('status', status);
            }

            if (tahun_ajaran && tahun_ajaran !== 'Semua') {
                query = query.eq('tahun_ajaran', String(tahun_ajaran).trim());
            }

            const { data, error } = await query;

            if (error) throw error;

            // Calculate totals
            const parseNominal = (val: any): number => {
                if (typeof val === 'number') return isNaN(val) ? 0 : val;
                if (typeof val === 'string') {
                    const parsed = parseFloat(val);
                    return isNaN(parsed) ? 0 : parsed;
                }
                if (val && typeof val === 'object' && Array.isArray(val.d)) {
                    const sign = val.s < 0 ? -1 : 1;
                    const digits = val.d.join('');
                    return sign * Number(digits) * Math.pow(10, (val.e ?? 0) - (digits.length - 1));
                }
                const num = Number(val);
                return isNaN(num) ? 0 : num;
            };

            const allData = (data || []).map((item: any) => ({
                ...item,
                nominal: parseNominal(item.nominal)
            }));
            const totalPengeluaran = allData.reduce((sum: number, item: any) => sum + item.nominal, 0);
            const totalTerganti = allData
                .filter((item: any) => item.status === 'TERGANTI')
                .reduce((sum: number, item: any) => sum + item.nominal, 0);
            const totalBelumTerganti = allData
                .filter((item: any) => item.status === 'BELUM_TERGANTI')
                .reduce((sum: number, item: any) => sum + item.nominal, 0);

            return NextResponse.json({
                ok: true,
                data: {
                    records: allData,
                    totals: {
                        total_pengeluaran: totalPengeluaran,
                        total_terganti: totalTerganti,
                        total_belum_terganti: totalBelumTerganti
                    }
                }
            });
        } catch (e: any) {
            console.error('API CK GET Error:', e);
            return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
        }
    }

    // POST /api/catatan-keuangan - Create catatan keuangan
    export async function _POST(request: any) {
        try {
            const user = await getApiUser(request);
            if (!user) return unauthorizedResponse();
            const body = await request.json();
            const privileged = user.isAdmin || user.roles.includes('BENDAHARA_KOMITE');

            if (!privileged) {
                if (!user.nip) return forbiddenResponse('Identitas NIP diperlukan untuk mencatat pengeluaran.');
                body.nip = user.nip;
                body.nama_guru = user.nama;
                body.status = 'BELUM_TERGANTI';
            }

            let { nama_guru, nip, nama_kegitan, item, nominal, keterangan, status, tahun_ajaran } = body;

            if (!nama_guru || !nama_kegitan || !item || nominal === undefined || nominal === null || nominal === '') {
                return NextResponse.json({ ok: false, error: 'Nama Guru, Nama Kegiatan, Item, dan Nominal wajib diisi.' }, { status: 400 });
            }

            nama_guru = String(nama_guru).trim();
            nama_kegitan = String(nama_kegitan).trim();
            item = String(item).trim();
            const nominalNum = parseFloat(nominal);

            if (isNaN(nominalNum) || nominalNum <= 0 || nominalNum > 1_000_000_000) {
                return NextResponse.json({ ok: false, error: 'Nominal harus berupa angka valid lebih dari Rp 0 dan maksimal Rp 1.000.000.000.' }, { status: 400 });
            }

            if (nama_guru.length > 200) {
                return NextResponse.json({ ok: false, error: 'Nama guru maksimal 200 karakter.' }, { status: 400 });
            }
            if (nama_kegitan.length > 255) {
                return NextResponse.json({ ok: false, error: 'Nama kegiatan maksimal 255 karakter.' }, { status: 400 });
            }
            if (item.length > 255) {
                return NextResponse.json({ ok: false, error: 'Nama item maksimal 255 karakter.' }, { status: 400 });
            }
            if (keterangan && String(keterangan).length > 2000) {
                return NextResponse.json({ ok: false, error: 'Keterangan maksimal 2.000 karakter.' }, { status: 400 });
            }

            const finalStatus = (privileged && status === 'TERGANTI') ? 'TERGANTI' : 'BELUM_TERGANTI';

            const { data, error } = await db
                .from('catatan_keuangan')
                .insert({
                    nama_guru,
                    nip: nip ? String(nip).trim() : null,
                    nama_kegitan,
                    item,
                    nominal: nominalNum,
                    keterangan: keterangan ? String(keterangan).trim() : null,
                    status: finalStatus,
                    tahun_ajaran: tahun_ajaran ? String(tahun_ajaran).trim() : null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({ ok: true, data });
        } catch (e: any) {
            console.error('API CK POST Error:', e);
            return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
        }
    }

    // PUT /api/catatan-keuangan - Update catatan keuangan
    export async function _PUT(request: any) {
        try {
            const user = await getApiUser(request);
            if (!user) return unauthorizedResponse();

            const body = await request.json();
            const { id, ...updates } = body;

            if (!id || !UUID_REGEX.test(String(id))) {
                return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
            }

            const isBendaharaOrAdmin = user.isAdmin || user.roles.includes('BENDAHARA_KOMITE');

            // Cek kepemilikan dan status
            const { data: existing, error: errExisting } = await db
                .from('catatan_keuangan')
                .select('id, nip, status')
                .eq('id', id)
                .single();

            if (errExisting || !existing) {
                return NextResponse.json({ ok: false, error: 'Data tidak ditemukan' }, { status: 404 });
            }

            if (!isBendaharaOrAdmin) {
                if (!user.nip || existing.nip !== user.nip) {
                    return forbiddenResponse('Anda tidak berhak mengubah data ini');
                }
                // Catatan yang sudah dicairkan/terganti terkunci untuk guru biasa
                if (existing.status === 'TERGANTI') {
                    return forbiddenResponse('Catatan keuangan yang sudah terganti (cair) tidak dapat diubah.');
                }
                // Non-bendahara tidak boleh mengubah status, nama guru, atau nip
                delete updates.nip;
                delete updates.nama_guru;
                delete updates.status;
            }

            // Validasi field yang diizinkan
            for (const key of Object.keys(updates)) {
                if (!['nama_guru','nip','nama_kegitan','item','nominal','keterangan','status','tahun_ajaran'].includes(key)) {
                    delete updates[key];
                }
            }

            // Validasi nominal jika diupdate
            if (updates.nominal !== undefined && updates.nominal !== null) {
                const nominalNum = parseFloat(updates.nominal);
                if (isNaN(nominalNum) || nominalNum <= 0 || nominalNum > 1_000_000_000) {
                    return NextResponse.json({ ok: false, error: 'Nominal harus berupa angka valid lebih dari Rp 0 dan maksimal Rp 1.000.000.000.' }, { status: 400 });
                }
                updates.nominal = nominalNum;
            }

            // Validasi string lengths
            if (updates.nama_kegitan && String(updates.nama_kegitan).length > 255) {
                return NextResponse.json({ ok: false, error: 'Nama kegiatan maksimal 255 karakter.' }, { status: 400 });
            }
            if (updates.item && String(updates.item).length > 255) {
                return NextResponse.json({ ok: false, error: 'Nama item maksimal 255 karakter.' }, { status: 400 });
            }
            if (updates.keterangan && String(updates.keterangan).length > 2000) {
                return NextResponse.json({ ok: false, error: 'Keterangan maksimal 2.000 karakter.' }, { status: 400 });
            }

            if (updates.status && !['BELUM_TERGANTI', 'TERGANTI'].includes(updates.status)) {
                return NextResponse.json({ ok: false, error: 'Status tidak valid.' }, { status: 400 });
            }

            updates.updated_at = new Date().toISOString();

            const { data, error } = await db
                .from('catatan_keuangan')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({ ok: true, data });
        } catch (e: any) {
            console.error('API CK PUT Error:', e);
            return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
        }
    }

    // DELETE /api/catatan-keuangan
    export async function _DELETE(request: any) {
        try {
            const user = await getApiUser(request);
            if (!user) return unauthorizedResponse();

            const { searchParams } = new URL(request.url);
            const id = searchParams.get('id');

            if (!id || !UUID_REGEX.test(String(id))) {
                return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
            }

            const isBendaharaOrAdmin = user.isAdmin || user.roles.includes('BENDAHARA_KOMITE');

            const { data: existing, error: errExisting } = await db
                .from('catatan_keuangan')
                .select('id, nip, status')
                .eq('id', id)
                .single();

            if (errExisting || !existing) {
                return NextResponse.json({ ok: false, error: 'Data tidak ditemukan' }, { status: 404 });
            }

            if (!isBendaharaOrAdmin) {
                if (!user.nip || existing.nip !== user.nip) {
                    return forbiddenResponse('Anda tidak berhak menghapus data ini');
                }
                // Catatan yang sudah dicairkan/terganti terkunci dari penghapusan oleh guru biasa
                if (existing.status === 'TERGANTI') {
                    return forbiddenResponse('Catatan keuangan yang sudah terganti (cair) tidak dapat dihapus karena dana telah dicairkan.');
                }
            }

            const { error } = await db
                .from('catatan_keuangan')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return NextResponse.json({ ok: true });
        } catch (e: any) {
            console.error('API CK DELETE Error:', e);
            return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
        }
    }

    
    export async function GET(req: any) { return _GET(req); }
    export async function POST(req: any) { return _POST(req); }
    export async function PUT(req: any) { return _PUT(req); }
    export async function DELETE(req: any) { return _DELETE(req); }
}

// Namespace for Tarif Honor
namespace TH {
    const NextResponse = {
        json: (data: any, options?: { status?: number }) => ({ isResponseMock: true, status: options?.status || 200, data })
    };
    
function isBendaharaOrAdmin(user: { isAdmin: boolean; roles: string[] }) {
    return user.isAdmin || user.roles.includes('BENDAHARA_KOMITE');
}

export async function _GET(request: any) {
    try {
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();

        const { data, error } = await db
            .from('tarif_honor')
            .select('*')
            .order('modul', { ascending: true });
        if (error) throw error;

        return NextResponse.json({ ok: true, data: data || [] });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function _PUT(request: any) {
    try {
        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();
        if (!isBendaharaOrAdmin(user)) {
            return forbiddenResponse('Hanya Bendahara Komite / Admin yang dapat mengubah tarif honor.');
        }

        const body = await request.json();
        const { modul, nominal } = body;
        if (!modul || typeof nominal !== 'number' || nominal < 0) {
            return NextResponse.json({ ok: false, error: 'modul dan nominal (angka >= 0) wajib diisi' }, { status: 400 });
        }

        const { data: reviewer } = await db
            .from('users')
            .select('nama, nama_lengkap')
            .eq('auth_id', user.authId)
            .maybeSingle();
        const reviewerName = reviewer?.nama_lengkap || reviewer?.nama || 'Bendahara Komite';

        const { data, error } = await db
            .from('tarif_honor')
            .update({ nominal, updated_at: new Date().toISOString(), updated_by: user.authId, updated_by_name: reviewerName })
            .eq('modul', modul)
            .select()
            .single();
        if (error) throw error;

        return NextResponse.json({ ok: true, data });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

    
    export async function GET(req: any) { return _GET(req); }
    export async function PUT(req: any) { return _PUT(req); }
}

// Namespace for Keuangan Utama
namespace KG {
    const NextResponse = {
        json: (data: any, options?: { status?: number }) => ({ isResponseMock: true, status: options?.status || 200, data })
    };
    let supabase = db;

// ---------------------------------------------------------------------------
// Helper autorisasi
// ---------------------------------------------------------------------------
interface Actor {
    id: number;                 // users.id (BIGINT)
    roles: string[];            // identity roles (UPPERCASE)
    isAdmin: boolean;
    officerRoles: string[];     // ['Kepala Divisi','KTU','PPK','Bendahara']
    divisionIds: string[];      // divisi yg dipimpin (utk Kepala Divisi)
}

/** Verifikasi token + rakit identitas + role keuangan (officer) pemanggil. */
async function getActor(request: any): Promise<Actor | null> {
    const apiUser = await getApiUser(request);
    if (!apiUser) return null;

    let urow: any = null;
    if (apiUser.authId) {
        const { data } = await supabase.from('users').select('id').eq('auth_id', apiUser.authId).maybeSingle();
        urow = data;
    }
    if (!urow && apiUser.id) {
        const { data } = await supabase.from('users').select('id').eq('id', apiUser.id).maybeSingle();
        urow = data;
    }
    if (!urow) return null;

    const { data: offs } = await supabase
        .from('financial_officers')
        .select('role_type, division_id')
        .eq('user_id', urow.id);

    const officerRoles = (offs || []).map((o: any) => o.role_type);
    const divisionIds = (offs || [])
        .filter((o: any) => o.role_type === 'Kepala Divisi' && o.division_id)
        .map((o: any) => o.division_id);

    return {
        id: urow.id,
        roles: apiUser.roles,
        isAdmin: apiUser.isAdmin,
        officerRoles,
        divisionIds,
    };
}

/**
 * Admin MURNI = punya role ADMIN tapi TIDAK memegang jabatan keuangan apa pun.
 * Hanya admin murni yang "view-only di luar Pengaturan" & "lihat semua nominal".
 * Jika akun juga Kepala Divisi/KTU/PPK/Bendahara, ia bertindak sesuai jabatannya
 * (mis. Kepala Divisi yang juga admin tetap dibatasi ke divisinya).
 */
const isPureAdmin = (a: Actor) => a.isAdmin && a.officerRoles.length === 0;

// Kapabilitas jabatan ditentukan MURNI dari officerRoles (bukan dari isAdmin),
// supaya akun admin+jabatan tidak otomatis mendapat semua kuasa jabatan.
const hasOfficer = (a: Actor, role: string) => a.officerRoles.includes(role);
const isDivisionHead = (a: Actor, divId: string | null) =>
    a.officerRoles.includes('Kepala Divisi') && !!divId && a.divisionIds.includes(divId);

/**
 * Bolehkah pemanggil melihat NOMINAL pada suatu pengajuan?
 * - Admin murni / KTU / PPK / Bendahara : semua nominal.
 * - Kepala Divisi                       : hanya nominal pengajuan divisinya.
 * - PJ (pemohon)                        : hanya nominal pengajuan miliknya.
 * - lainnya                             : tidak boleh (nominal disembunyikan).
 */
function canSeeNominal(a: Actor, row: any): boolean {
    if (isPureAdmin(a)) return true;
    if (a.officerRoles.some((r) => r === 'KTU' || r === 'PPK' || r === 'Bendahara')) return true;
    if (row.pj_user_id === a.id) return true;
    if (a.officerRoles.includes('Kepala Divisi') && row.division_id && a.divisionIds.includes(row.division_id)) return true;
    return false;
}

/**
 * Boleh melihat nomor register?
 * Register adalah urusan internal Kepala Divisi & Bendahara — PJ pemohon
 * TIDAK boleh melihatnya walaupun itu pengajuannya sendiri.
 * - Bendahara     : semua pengajuan.
 * - Kepala Divisi : hanya pengajuan divisinya.
 * - Admin murni   : semua (konsisten dgn kewenangan lihat-semua admin).
 */
function canSeeRegisters(a: Actor, row: any): boolean {
    if (isPureAdmin(a)) return true;
    if (a.officerRoles.includes('Bendahara')) return true;
    if (a.officerRoles.includes('Kepala Divisi') && row.division_id && a.divisionIds.includes(row.division_id)) return true;
    return false;
}

/** Sembunyikan field nominal & nomor register bila pemanggil tidak berhak. */
function maskRequest(a: Actor, row: any): any {
    // Nomor register dimask terpisah dari nominal (aturannya beda: PJ boleh
    // lihat nominal miliknya, tapi tidak boleh lihat nomor registernya).
    const registersVisible = canSeeRegisters(a, row);
    const base = registersVisible
        ? { ...row, registers_masked: false }
        : { ...row, budget_request_registers: [], registers_masked: true };

    if (canSeeNominal(a, row)) return { ...base, nominal_masked: false };
    const items = (row.budget_request_items || []).map((it: any) => ({ ...it, unit_price: null }));
    
    // BUG-07: Mask nominal in notes instead of clearing logs
    const maskedLogs = (row.approval_logs || []).map((log: any) => ({
        ...log,
        notes: log.notes ? log.notes.replace(/Rp\s*\d[\d,.]*/g, 'Rp ***') : log.notes
    }));

    return {
        ...base,
        total_amount: null,
        total_disbursed: null,
        budget_request_items: items,
        approval_logs: maskedLogs,      // Masked nominals
        disbursements: [],      // pencairan memuat nominal → ikut disembunyikan
        receipt_submissions: [],// nilai nota memuat nominal → ikut disembunyikan
        nominal_masked: true,
    };
}

class HttpError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function _GET(req: any) {
    const actor = await getActor(req);
    if (!actor) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    try {
        if (action === 'get_my_roles') {
            // Dipakai client utk menentukan tab & tombol yang boleh tampil.
            return NextResponse.json({
                ok: true,
                data: {
                    id: actor.id,
                    isAdmin: actor.isAdmin,
                    officerRoles: actor.officerRoles,
                    divisionIds: actor.divisionIds,
                },
            });
        }

        if (action === 'get_officers') {
            if (!actor.isAdmin) return forbiddenResponse();
            const { data, error } = await supabase
                .from('financial_officers')
                .select('id, role_type, division_id, user_id, users(nama, username), divisions(name)');
            if (error) throw error;
            return NextResponse.json({ ok: true, data });
        }

        if (action === 'get_divisions') {
            // Dibutuhkan semua user utk form pengajuan.
            const { data, error } = await supabase.from('divisions').select('*').order('name');
            if (error) throw error;
            return NextResponse.json({ ok: true, data });
        }

        if (action === 'get_users') {
            if (!actor.isAdmin) return forbiddenResponse();
            const { data, error } = await supabase.from('users').select('id, nama, username, role').eq('aktif', true).order('nama');
            if (error) throw error;
            return NextResponse.json({ ok: true, data });
        }

        if (action === 'get_budgets') {
            // Bendahara/KTU/PPK/Admin murni: semua pagu. Kepala Divisi: hanya pagu divisinya.
            const canSeeAll = isPureAdmin(actor) || actor.officerRoles.some((r) => r === 'Bendahara' || r === 'KTU' || r === 'PPK');
            const isKadiv = actor.officerRoles.includes('Kepala Divisi');
            if (!canSeeAll && !isKadiv) return forbiddenResponse();

            let q = supabase
                .from('division_budgets')
                .select('*, divisions(name)')
                .order('period', { ascending: false })
                .order('category');
            if (!canSeeAll) {
                if (actor.divisionIds.length === 0) return NextResponse.json({ ok: true, data: [] });
                q = q.in('division_id', actor.divisionIds);
            }
            const { data, error } = await q;
            if (error) throw error;

            // BULK CALCULATE USED AMOUNT
            const { data: activeRequests } = await supabase
                .from('budget_requests')
                .select('division_id, created_at, status, budget_request_items(category, total_price)');

            const usedMap: Record<string, number> = {};
            (activeRequests || []).forEach(req => {
                // Jangan kurangi saldo jika masih 'Menunggu Kadiv' (Menunggu Divisi) atau 'Menunggu KTU' (sebelum Kadiv)
                // Atau jika sudah Ditolak / Revisi.
                if (['Menunggu Divisi', 'Menunggu KTU', 'Ditolak', 'Revisi PJ'].includes(req.status)) return;
                
                const reqYear = new Date(req.created_at).getFullYear().toString();
                const divId = req.division_id;
                
                // Jika pencairan sudah selesai, gunakan actual_price (bila ada), jika belum gunakan total_price (pencadangan/encumbrance)
                const isFinished = ['Dicairkan Sepenuhnya', 'Arsip Selesai', 'Lunas/Selesai'].includes(req.status);
                
                (req.budget_request_items || []).forEach((item: any) => {
                    const cat = item.category || 'Bahan';
                    const key = `${divId}_${reqYear}_${cat}`;
                    
                    const amountToUse = (isFinished && item.actual_price != null) 
                        ? Number(item.actual_price) 
                        : Number(item.total_price || 0);
                        
                    usedMap[key] = (usedMap[key] || 0) + amountToUse;
                });
            });

            const enrichedData = (data || []).map(b => {
                const key = `${b.division_id}_${b.period}_${b.category}`;
                const used = usedMap[key] || 0;
                // If the backend has been modifying total_budget (by deducting disbursements),
                // then total_budget is already reduced. 
                // To display it nicely on the frontend: limit = initial_budget, remain = limit - ALL used.
                const limit = Number(b.initial_budget || b.total_budget);
                return {
                    ...b,
                    total_budget: limit, // Restore total_budget as limit for frontend
                    used_budget: used,
                    remaining_budget: limit - used
                };
            });

            return NextResponse.json({ ok: true, data: enrichedData });
        }

        if (action === 'get_mutations') {
            // Riwayat mutasi/transfer pagu. Bendahara/KTU/PPK/Admin murni: semua.
            // Kepala Divisi: hanya mutasi divisinya.
            const canSeeAll = isPureAdmin(actor) || actor.officerRoles.some((r) => r === 'Bendahara' || r === 'KTU' || r === 'PPK');
            const isKadiv = actor.officerRoles.includes('Kepala Divisi');
            if (!canSeeAll && !isKadiv) return forbiddenResponse();

            let q = supabase
                .from('budget_mutations')
                .select('*, divisions:division_id(name), counterpart:counterpart_division_id(name), users:created_by(nama)')
                .order('created_at', { ascending: false });
            if (!canSeeAll) {
                if (actor.divisionIds.length === 0) return NextResponse.json({ ok: true, data: [] });
                q = q.in('division_id', actor.divisionIds);
            }
            const { data, error } = await q;
            if (error) throw error;
            return NextResponse.json({ ok: true, data });
        }

        if (action === 'get_requests') {
            const roleContext = searchParams.get('role_context');
            let query = supabase
                .from('budget_requests')
                .select('*, divisions(name), users(nama), budget_request_items(*), approval_logs(*), budget_request_registers(*), disbursements(*), receipt_submissions(*)')
                .order('created_at', { ascending: false });

            if (roleContext === 'pj') {
                // Selalu dibatasi ke milik pemanggil (abaikan user_id dari client).
                query = query.eq('pj_user_id', actor.id);
            } else if (roleContext === 'divisi') {
                if (actor.isAdmin) {
                    // admin lihat semua
                } else if (actor.divisionIds.length > 0) {
                    query = query.in('division_id', actor.divisionIds);
                } else {
                    return NextResponse.json({ ok: true, data: [] });
                }
            } else if (roleContext === 'semua') {
                // Transparansi: SEMUA user boleh melihat daftar seluruh pengajuan,
                // tetapi nominal dimask per-baris (lihat maskRequest di bawah).
                // Tidak ada filter tambahan.
            } else {
                // Konteks 'all' (ktu/ppk/bendahara/monitoring): wajib punya
                // salah satu jabatan keuangan atau admin.
                if (!actor.isAdmin && actor.officerRoles.length === 0) return forbiddenResponse();
            }

            const { data, error } = await query;
            if (error) throw error;
            // Mask nominal per-baris sesuai kewenangan pemanggil (berlaku utk
            // semua konteks — mis. Kepala Divisi yg membuka Monitoring hanya
            // melihat nominal divisinya sendiri).
            const maskedData = (data || []).map((row: any) => maskRequest(actor, row));
            return NextResponse.json({ ok: true, data: maskedData });
        }

        if (action === 'get_disbursements') {
            if (!actor.isAdmin && actor.officerRoles.length === 0) return forbiddenResponse();
            const reqId = searchParams.get('request_id');
            if (!reqId) return NextResponse.json({ ok: false, error: 'request_id is required' }, { status: 400 });
            const { data, error } = await supabase.from('disbursements').select('*').eq('budget_request_id', reqId).order('disbursed_at', { ascending: true });
            if (error) throw error;
            return NextResponse.json({ ok: true, data });
        }

        return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    } catch (e: any) {
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ ok: false, error: e.message }, { status });
    }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function _POST(req: any) {
    const actor = await getActor(req);
    if (!actor) return unauthorizedResponse();

    try {
        const body = await req.json();
        const { action } = body;

        // Admin MURNI (tanpa jabatan keuangan): boleh MENGAJUKAN (aksi PJ) &
        // mengelola Pengaturan, tetapi TIDAK boleh memproses alur jabatan
        // keuangan (persetujuan/pencairan/pagu). Akun admin yang juga memegang
        // jabatan tetap bertindak sesuai jabatannya (isPureAdmin=false).
        const OFFICER_ONLY_WRITES = [
            'approve_request', 'disburse_request', 'set_pending_request',
            'verify_receipt', 'verify_report', 'verify_report_received',
            'add_receipt', 'delete_receipt', 'save_budget', 'adjust_budget', 'transfer_budget',
        ];
        if (isPureAdmin(actor) && OFFICER_ONLY_WRITES.includes(action)) {
            return forbiddenResponse('Admin tidak dapat memproses alur jabatan keuangan. Admin hanya bisa mengajukan anggaran & mengelola Pengaturan.');
        }

        // --- PENGATURAN (Admin) ---------------------------------------------
        if (action === 'save_officer') {
            if (!actor.isAdmin) return forbiddenResponse();
            const { user_id, role_type, division_id } = body;
            if (!user_id || !role_type) throw new HttpError(400, 'user_id dan role_type wajib diisi');
            const payload: any = { user_id, role_type };
            if (role_type === 'Kepala Divisi') {
                if (!division_id) throw new HttpError(400, 'Divisi wajib dipilih untuk Kepala Divisi');
                payload.division_id = division_id;
            }
            const { error } = await supabase.from('financial_officers').insert([payload]);
            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        if (action === 'delete_officer') {
            if (!actor.isAdmin) return forbiddenResponse();
            const { id } = body;
            const { error } = await supabase.from('financial_officers').delete().eq('id', id);
            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        // --- PAGU (Admin / Bendahara) ---------------------------------------
        if (action === 'save_budget') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { division_id, period, category } = body;
            const totalBudget = Number(body.total_budget);
            if (!division_id || !period || !category) throw new HttpError(400, 'Data pagu tidak lengkap');
            if (!Number.isFinite(totalBudget) || totalBudget < 0) throw new HttpError(400, 'Total anggaran tidak valid');

            const { data: existing } = await supabase.from('division_budgets').select('*')
                .eq('division_id', division_id).eq('period', period).eq('category', category).maybeSingle();

            if (existing) {
                throw new HttpError(409, 'Pagu untuk kombinasi divisi, tahun, dan kategori ini sudah ada. Gunakan Mutasi Anggaran untuk merubahnya.');
            } else {
                const { error } = await supabase.from('division_budgets')
                    .insert({ division_id, period, category, initial_budget: totalBudget, total_budget: totalBudget });
                if (error) throw error;
            }
            return NextResponse.json({ ok: true });
        }

        // --- MUTASI ANGGARAN (Bendahara): penyesuaian & transfer antar divisi ---
        if (action === 'adjust_budget') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { division_id, period, category, reason } = body;
            const delta = Number(body.amount); // bertanda: + menambah, - mengurangi
            if (!division_id || !period || !category) throw new HttpError(400, 'Divisi, tahun, dan kategori wajib diisi');
            if (!Number.isFinite(delta) || delta === 0) throw new HttpError(400, 'Nominal penyesuaian tidak valid');
            if (!reason || !String(reason).trim()) throw new HttpError(400, 'Alasan mutasi wajib diisi');

            const { data: budget } = await supabase.from('division_budgets').select('*')
                .eq('division_id', division_id).eq('period', period).eq('category', category).maybeSingle();
            if (!budget) throw new HttpError(404, 'Pagu divisi untuk tahun tsb belum ada. Tetapkan pagu awal dulu.');

            const newTotal = parseFloat(budget.total_budget) + delta;
            if (newTotal < -0.001) throw new HttpError(400, 'Penyesuaian ditolak: sisa anggaran divisi tidak boleh menjadi minus.');
            const newInitial = parseFloat(budget.initial_budget ?? budget.total_budget) + delta;

            const { error: updErr } = await supabase.from('division_budgets')
                .update({ initial_budget: newInitial, total_budget: newTotal }).eq('id', budget.id);
            if (updErr) throw updErr;

            const { error: mutErr } = await supabase.from('budget_mutations').insert({
                division_id, period, category, amount: delta, mutation_type: 'Penyesuaian',
                reason: String(reason).trim(), created_by: actor.id,
            });
            if (mutErr) throw mutErr;
            return NextResponse.json({ ok: true });
        }

        if (action === 'transfer_budget') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { from_division_id, to_division_id, period, category, reason } = body;
            const amount = Number(body.amount);
            if (!from_division_id || !to_division_id || !period || !category) throw new HttpError(400, 'Data transfer tidak lengkap');
            if (from_division_id === to_division_id) throw new HttpError(400, 'Divisi asal dan tujuan tidak boleh sama');
            if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Nominal transfer tidak valid');
            if (!reason || !String(reason).trim()) throw new HttpError(400, 'Alasan mutasi wajib diisi');

            const { data: fromB } = await supabase.from('division_budgets').select('*')
                .eq('division_id', from_division_id).eq('period', period).eq('category', category).maybeSingle();
            if (!fromB) throw new HttpError(404, 'Pagu divisi asal untuk tahun dan kategori tsb belum ada.');
            if (parseFloat(fromB.total_budget) < amount - 0.001) {
                throw new HttpError(400, 'Transfer ditolak: sisa anggaran divisi asal tidak mencukupi (tidak boleh minus).');
            }

            const { data: toB } = await supabase.from('division_budgets').select('*')
                .eq('division_id', to_division_id).eq('period', period).eq('category', category).maybeSingle();

            // Kurangi divisi asal.
            const { error: fromErr } = await supabase.from('division_budgets').update({
                initial_budget: parseFloat(fromB.initial_budget ?? fromB.total_budget) - amount,
                total_budget: parseFloat(fromB.total_budget) - amount,
            }).eq('id', fromB.id);
            if (fromErr) throw fromErr;

            // Tambah divisi tujuan (buat baris bila belum ada).
            if (toB) {
                const { error: toErr } = await supabase.from('division_budgets').update({
                    initial_budget: parseFloat(toB.initial_budget ?? toB.total_budget) + amount,
                    total_budget: parseFloat(toB.total_budget) + amount,
                }).eq('id', toB.id);
                if (toErr) throw toErr;
            } else {
                const { error: toErr } = await supabase.from('division_budgets')
                    .insert({ division_id: to_division_id, period, category, initial_budget: amount, total_budget: amount });
                if (toErr) throw toErr;
            }

            const groupId = randomUUID();
            const cleanReason = String(reason).trim();
            const { error: mutErr } = await supabase.from('budget_mutations').insert([
                { division_id: from_division_id, period, category, amount: -amount, mutation_type: 'Transfer', reason: cleanReason, counterpart_division_id: to_division_id, transfer_group_id: groupId, created_by: actor.id },
                { division_id: to_division_id, period, category, amount: amount, mutation_type: 'Transfer', reason: cleanReason, counterpart_division_id: from_division_id, transfer_group_id: groupId, created_by: actor.id },
            ]);
            if (mutErr) throw mutErr;
            return NextResponse.json({ ok: true });
        }

        // --- PENGAJUAN (PJ) -------------------------------------------------
        if (action === 'create_request') {
            // Nomor register sengaja TIDAK diterima di sini — pengisiannya wewenang
            // Kepala Divisi lewat action 'save_registers', bukan PJ saat mengajukan.
            const { division_id, activity_name, description, items, route, proof_url } = body;
            if (!activity_name || !division_id) throw new HttpError(400, 'Nama kegiatan dan divisi wajib diisi');
            const { processedItems, total } = normalizeItems(items);

            // Tentukan status awal: jalur cepat langsung-Bendahara HANYA utk divisi TU.
            const isTu = isTuName(await getDivisionName(division_id));
            const { status: initialStatus, bypass } = initialFlowStatus(isTu, route);

            const request_number = await generateRequestNumber();

            const { data: reqData, error: reqError } = await supabase.from('budget_requests').insert({
                pj_user_id: actor.id,            // dipaksa ke pemanggil
                division_id,
                activity_name,
                description,
                total_amount: total,
                status: initialStatus,
                request_number,
                proof_file_url: cleanUrl(proof_url),   // bukti pendukung (opsional)
            }).select('id').single();
            if (reqError) throw reqError;

            const { error: itemError } = await supabase.from('budget_request_items')
                .insert(itemsForInsert(processedItems, reqData.id));
            if (itemError) {
                // rollback manual: hapus header agar tidak ada request tanpa item
                await supabase.from('budget_requests').delete().eq('id', reqData.id);
                throw itemError;
            }

            // Jejak jalur cepat TU.
            if (bypass) {
                await supabase.from('approval_logs').insert({
                    budget_request_id: reqData.id, user_id: actor.id, role: 'Pemohon (PJ)', action: 'Diproses',
                    notes: 'Anggaran TU diajukan via jalur cepat langsung ke Bendahara (tanpa verifikasi KTU/PPK).',
                });
            }
            return NextResponse.json({ ok: true, id: reqData.id });
        }

        if (action === 'update_request') {
            const { request_id, activity_name, description, items, route, proof_url } = body;
            const { data: reqRow } = await supabase.from('budget_requests')
                .select('pj_user_id, status, division_id').eq('id', request_id).single();
            if (!reqRow) throw new HttpError(404, 'Pengajuan tidak ditemukan');
            if (reqRow.pj_user_id !== actor.id && !actor.isAdmin) return forbiddenResponse();
            if (reqRow.status !== 'Revisi PJ') throw new HttpError(409, 'Pengajuan hanya bisa diperbaiki saat berstatus Revisi PJ');

            const { processedItems, total } = normalizeItems(items);

            // Recompute alur (TU boleh jalur cepat; non-TU wajib lewat Kepala Divisi).
            const isTu = isTuName(await getDivisionName(reqRow.division_id));
            const { status: newStatus, bypass } = initialFlowStatus(isTu, route);

            // proof_url hanya disentuh bila dikirim — biar revisi tanpa unggah
            // ulang tidak menghapus bukti yang sudah ada.
            const updatePayload: any = { activity_name, description, total_amount: total, status: newStatus };
            if (proof_url !== undefined) updatePayload.proof_file_url = cleanUrl(proof_url);

            const { error: reqError } = await supabase.from('budget_requests').update(updatePayload).eq('id', request_id);
            if (reqError) throw reqError;

            await supabase.from('budget_request_items').delete().eq('budget_request_id', request_id);
            const { error: itemError } = await supabase.from('budget_request_items')
                .insert(itemsForInsert(processedItems, request_id));
            if (itemError) throw itemError;

            // Nomor register sengaja tidak disentuh saat PJ merevisi — nomor yang
            // sudah diisi Kepala Divisi harus tetap utuh.

            if (bypass) {
                await supabase.from('approval_logs').insert({
                    budget_request_id: request_id, user_id: actor.id, role: 'Pemohon (PJ)', action: 'Diproses',
                    notes: 'Anggaran TU diajukan via jalur cepat langsung ke Bendahara (tanpa verifikasi KTU/PPK).',
                });
            }
            return NextResponse.json({ ok: true });
        }

        // --- NOMOR REGISTER (Kepala Divisi) ----------------------------------
        // Nomor register diisi oleh Kepala Divisi pemilik pengajuan, BUKAN PJ.
        // Sifatnya opsional: boleh kosong, boleh >1, dan tidak memblokir alur.
        if (action === 'save_registers') {
            const { request_id, registers } = body;
            const { data: reqRow } = await supabase.from('budget_requests')
                .select('division_id').eq('id', request_id).single();
            if (!reqRow) throw new HttpError(404, 'Pengajuan tidak ditemukan');
            if (!isDivisionHead(actor, reqRow.division_id) && !actor.isAdmin) {
                return forbiddenResponse('Hanya Kepala Divisi terkait yang boleh mengelola nomor register');
            }

            await replaceRegisters(request_id, registers);
            return NextResponse.json({ ok: true, count: cleanRegisters(registers).length });
        }

        // --- PERSETUJUAN (Kepala Divisi / KTU / PPK / Bendahara) -------------
        if (action === 'approve_request') {
            const { request_id, status_action, notes } = body;
            const { data: reqRow } = await supabase.from('budget_requests')
                .select('status, division_id').eq('id', request_id).single();
            if (!reqRow) throw new HttpError(404, 'Pengajuan tidak ditemukan');

            const cur = reqRow.status;
            const isReject = status_action === 'Rejected';
            let nextStatus = '';
            let roleLabel = '';

            const pencairanStatuses = ['Antrean Pencairan', 'Dicairkan Sebagian', 'Pending Pencairan'];

            if (cur === 'Menunggu KTU') {
                // Tahap 1: KTU memverifikasi lebih dulu.
                if (!hasOfficer(actor, 'KTU')) return forbiddenResponse('Hanya KTU yang boleh memproses tahap ini');
                roleLabel = 'KTU';
                // Setelah KTU: non-TU wajib lewat Kepala Divisi, TU langsung ke PPK
                // (kepala divisi TU adalah KTU itu sendiri).
                const isTu = isTuName(await getDivisionName(reqRow.division_id));
                nextStatus = isReject ? 'Revisi PJ' : (isTu ? 'Menunggu PPK' : 'Menunggu Divisi');
            } else if (cur === 'Menunggu Divisi') {
                // Tahap 2: Kepala Divisi divisinya masing-masing.
                if (!isDivisionHead(actor, reqRow.division_id)) return forbiddenResponse('Hanya Kepala Divisi terkait yang boleh memproses tahap ini');
                roleLabel = 'Kepala Divisi';
                nextStatus = isReject ? 'Revisi PJ' : 'Menunggu PPK';
            } else if (cur === 'Menunggu PPK') {
                if (!hasOfficer(actor, 'PPK')) return forbiddenResponse('Hanya PPK yang boleh memproses tahap ini');
                roleLabel = 'PPK';
                nextStatus = isReject ? 'Revisi PJ' : 'Antrean Pencairan';
            } else if (isReject && pencairanStatuses.includes(cur)) {
                if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse('Hanya Bendahara yang boleh mengembalikan pada tahap pencairan');
                roleLabel = 'Bendahara';
                nextStatus = 'Revisi PJ';
            } else {
                throw new HttpError(409, `Aksi tidak valid untuk status "${cur}"`);
            }

            const { error: logError } = await supabase.from('approval_logs').insert({
                budget_request_id: request_id, user_id: actor.id, role: roleLabel,
                action: isReject ? 'Rejected' : 'Approved', notes,
            });
            if (logError) throw logError;

            const { error: reqError } = await supabase.from('budget_requests').update({ status: nextStatus }).eq('id', request_id);
            if (reqError) throw reqError;
            return NextResponse.json({ ok: true });
        }

        // --- PENCAIRAN (Bendahara) ------------------------------------------
        if (action === 'disburse_request') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { request_id, items } = body;
            const targetAmount = Number(body.amount_to_disburse);
            if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new HttpError(400, 'Nominal pencairan tidak valid');

            const { data: reqData, error: reqError } = await supabase.from('budget_requests')
                .select('*, budget_request_items(*)').eq('id', request_id).single();
            if (reqError || !reqData) throw new HttpError(404, 'Pengajuan tidak ditemukan');
            if (!['Antrean Pencairan', 'Dicairkan Sebagian', 'Pending Pencairan'].includes(reqData.status)) {
                throw new HttpError(409, 'Pengajuan belum siap dicairkan');
            }

            const totalAmount = parseFloat(reqData.total_amount);
            if (!(totalAmount > 0)) throw new HttpError(400, 'Total pengajuan tidak valid untuk pencairan');

            // Sisa yang boleh dicairkan = total - (sudah diterima + yang masih pending konfirmasi)
            const { data: pend } = await supabase.from('disbursements').select('amount')
                .eq('budget_request_id', request_id).eq('status', 'Menunggu Konfirmasi');
            const pendingSum = (pend || []).reduce((s: number, d: any) => s + parseFloat(d.amount), 0);
            const committed = parseFloat(reqData.total_disbursed || 0) + pendingSum;
            const maxAllowed = totalAmount - committed;
            if (targetAmount > maxAllowed + 0.001) {
                throw new HttpError(400, `Maksimal pencairan saat ini adalah Rp ${maxAllowed.toLocaleString('id-ID')}`);
            }
            
            // Simpan actual_price tiap item jika ada
            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    if (item.id && typeof item.actual_price === 'number') {
                        await supabase.from('budget_request_items')
                            .update({ actual_price: item.actual_price })
                            .eq('id', item.id)
                            .eq('budget_request_id', request_id);
                    }
                }
            }

            const { error: insErr } = await supabase.from('disbursements').insert({
                budget_request_id: request_id, amount: targetAmount,
                notes: 'Pencairan Tahap (Menunggu Konfirmasi)', status: 'Menunggu Konfirmasi',
            });
            if (insErr) throw insErr;

            await supabase.from('budget_requests').update({ status: 'Menunggu Konfirmasi PJ' }).eq('id', request_id);
            await supabase.from('approval_logs').insert({
                budget_request_id: request_id, user_id: actor.id, role: 'Bendahara', action: 'Diproses',
                notes: `Pencairan Rp ${targetAmount.toLocaleString('id-ID')} diproses, menunggu konfirmasi PJ.`,
            });
            return NextResponse.json({ ok: true });
        }

        if (action === 'set_pending_request') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { request_id } = body;
            await supabase.from('budget_requests').update({ status: 'Pending Pencairan' }).eq('id', request_id);
            await supabase.from('approval_logs').insert({
                budget_request_id: request_id, user_id: actor.id, role: 'Bendahara', action: 'Pending', notes: 'Pencairan ditunda',
            });
            return NextResponse.json({ ok: true });
        }

        // --- KONFIRMASI PENERIMAAN DANA (PJ) --------------------------------
        if (action === 'confirm_disbursement') {
            // disbursement_ids opsional: bila diisi, hanya tahap tsb yang dikonfirmasi
            // (PJ mencentang tahap tertentu di modal). Bila kosong → semua pending.
            const { request_id, disbursement_ids } = body;
            const selectedIds = Array.isArray(disbursement_ids)
                ? disbursement_ids.filter((x: any) => !!x)
                : null;

            const { data: reqData, error: reqError } = await supabase.from('budget_requests')
                .select('*, budget_request_items(*)').eq('id', request_id).single();
            if (reqError || !reqData) throw new HttpError(404, 'Pengajuan tidak ditemukan');
            if (reqData.pj_user_id !== actor.id && !actor.isAdmin) return forbiddenResponse('Hanya pemohon yang boleh konfirmasi penerimaan dana');

            const totalAmount = parseFloat(reqData.total_amount);
            if (!(totalAmount > 0)) throw new HttpError(400, 'Total pengajuan tidak valid');

            // Ambil pending yang menunggu konfirmasi (dibatasi ke tahap terpilih bila ada).
            let pendQuery = supabase.from('disbursements').select('*')
                .eq('budget_request_id', request_id).eq('status', 'Menunggu Konfirmasi');
            if (selectedIds && selectedIds.length > 0) pendQuery = pendQuery.in('id', selectedIds);
            const { data: pendingDisbursements } = await pendQuery;
            if (!pendingDisbursements || pendingDisbursements.length === 0) {
                throw new HttpError(409, 'Tidak ada tahap pencairan yang bisa dikonfirmasi.');
            }

            // Klaim atomik: hanya baris yg benar-benar masih 'Menunggu Konfirmasi'
            // yang kita proses (mencegah double-konfirmasi bersamaan).
            const nowIso = new Date().toISOString();
            let claimQuery = supabase.from('disbursements')
                .update({ status: 'Telah Diterima', confirmed_by_pj_at: nowIso, notes: 'Diterima oleh PJ' })
                .eq('budget_request_id', request_id).eq('status', 'Menunggu Konfirmasi');
            if (selectedIds && selectedIds.length > 0) claimQuery = claimQuery.in('id', selectedIds);
            const { data: claimed, error: claimErr } = await claimQuery.select();
            if (claimErr) throw claimErr;
            if (!claimed || claimed.length === 0) {
                throw new HttpError(409, 'Dana sudah dikonfirmasi sebelumnya.');
            }

            // Hitung total dana yang benar-benar diklaim.
            let totalConfirmedNow = 0;
            for (const disb of claimed) {
                totalConfirmedNow += parseFloat(disb.amount);
            }

            // BUG-06: Fetch latest total_disbursed to avoid race condition
            const { data: latestReq } = await supabase.from('budget_requests').select('total_disbursed').eq('id', request_id).single();
            const newTotalDisbursed = parseFloat(latestReq?.total_disbursed || 0) + totalConfirmedNow;
            // Masih ada tahap pending lain? Biarkan status agar PJ bisa konfirmasi sisanya.
            const { count: remainingPending } = await supabase.from('disbursements')
                .select('*', { count: 'exact', head: true })
                .eq('budget_request_id', request_id).eq('status', 'Menunggu Konfirmasi');
            let newStatus: string;
            if ((remainingPending || 0) > 0) {
                newStatus = 'Menunggu Konfirmasi PJ';
            } else {
                newStatus = (newTotalDisbursed >= totalAmount - 0.001) ? 'Menunggu Laporan PJ' : 'Dicairkan Sebagian';
            }
            await supabase.from('budget_requests').update({ status: newStatus, total_disbursed: newTotalDisbursed }).eq('id', request_id);

            await supabase.from('approval_logs').insert({
                budget_request_id: request_id, user_id: actor.id, role: 'Pemohon (PJ)', action: 'Diterima',
                notes: `PJ mengonfirmasi penerimaan dana sebesar Rp ${totalConfirmedNow.toLocaleString('id-ID')}`,
            });
            return NextResponse.json({ ok: true });
        }

        // --- PELAPORAN: UNGGAH LAPORAN PDF (PJ atau Bendahara) --------------
        if (action === 'upload_report') {
            const { request_id, report_url } = body;
            if (!report_url) throw new HttpError(400, 'File laporan (PDF) wajib diunggah');
            const { data: reqRow } = await supabase.from('budget_requests')
                .select('pj_user_id, status, report_status').eq('id', request_id).single();
            if (!reqRow) throw new HttpError(404, 'Pengajuan tidak ditemukan');
            const isOwner = reqRow.pj_user_id === actor.id;
            if (!isOwner && !hasOfficer(actor, 'Bendahara')) {
                return forbiddenResponse('Hanya PJ pemohon atau Bendahara yang boleh mengunggah laporan');
            }
            const payload: any = { report_file_url: report_url };
            // Mulai alur verifikasi laporan bila belum berjalan (KTU lebih dulu).
            if (!reqRow.report_status) {
                payload.report_status = 'Menunggu KTU';
                payload.status = 'Proses Laporan';
            }
            await supabase.from('budget_requests').update(payload).eq('id', request_id);
            await supabase.from('approval_logs').insert({
                budget_request_id: request_id, user_id: actor.id,
                role: isOwner ? 'Pemohon (PJ)' : 'Bendahara', action: 'Diproses',
                notes: 'Laporan (PDF) diunggah.',
            });
            return NextResponse.json({ ok: true });
        }

        // --- NOTA (Bendahara): catat nilai nota disetor fisik (akumulasi) ---
        if (action === 'add_receipt') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { request_id, description } = body;
            const amount = Number(body.amount);
            if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Nominal nota tidak valid');
            const { error: insErr } = await supabase.from('receipt_submissions')
                .insert({ budget_request_id: request_id, amount, description: description || null, created_by: actor.id });
            if (insErr) throw insErr;
            await recomputeReceiptStatus(request_id);
            return NextResponse.json({ ok: true });
        }

        if (action === 'delete_receipt') {
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { receipt_id, request_id } = body;
            
            // BUG-05: Validasi ownership
            const { data: receipt } = await supabase
                .from('receipt_submissions')
                .select('id, budget_request_id')
                .eq('id', receipt_id)
                .single();
            
            if (!receipt || receipt.budget_request_id !== request_id) {
                return forbiddenResponse('Receipt tidak ditemukan atau tidak milik pengajuan ini');
            }

            await supabase.from('receipt_submissions').delete().eq('id', receipt_id);
            if (request_id) await recomputeReceiptStatus(request_id);
            return NextResponse.json({ ok: true });
        }

        // --- VERIFIKASI LAPORAN ---------------------------------------------
        if (action === 'verify_receipt') {
            // Centang "nota sudah disetor lengkap" oleh Bendahara.
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { request_id } = body;
            await supabase.from('budget_requests').update({ receipt_status: 'Disetujui Bendahara' }).eq('id', request_id);
            return NextResponse.json({ ok: true });
        }

        if (action === 'verify_report_received') {
            // Centang "laporan (fisik + digital) sudah diterima" oleh Bendahara.
            if (!hasOfficer(actor, 'Bendahara')) return forbiddenResponse();
            const { request_id } = body;
            await supabase.from('budget_requests').update({ report_received_by_bendahara: true }).eq('id', request_id);
            return NextResponse.json({ ok: true });
        }

        if (action === 'verify_report') {
            const { request_id } = body;
            const { data: reqRow } = await supabase.from('budget_requests')
                .select('report_status, division_id').eq('id', request_id).single();
            if (!reqRow) throw new HttpError(404, 'Pengajuan tidak ditemukan');

            const cur = reqRow.report_status;
            let nextStatus = '';
            if (cur === 'Menunggu KTU') {
                if (!hasOfficer(actor, 'KTU')) return forbiddenResponse('Hanya KTU yang boleh memverifikasi tahap ini');
                const isTu = isTuName(await getDivisionName(reqRow.division_id));
                nextStatus = isTu ? 'Menunggu PPK' : 'Menunggu Divisi';
            } else if (cur === 'Menunggu Divisi') {
                if (!isDivisionHead(actor, reqRow.division_id)) return forbiddenResponse('Hanya Kepala Divisi terkait yang boleh memverifikasi tahap ini');
                nextStatus = 'Menunggu PPK';
            } else if (cur === 'Menunggu PPK') {
                if (!hasOfficer(actor, 'PPK')) return forbiddenResponse('Hanya PPK yang boleh memverifikasi tahap ini');
                nextStatus = 'Selesai';
            } else {
                throw new HttpError(409, `Laporan tidak dapat diverifikasi pada status "${cur}"`);
            }

            const updatePayload: any = { report_status: nextStatus };
            if (nextStatus === 'Selesai') updatePayload.status = 'Arsip Selesai';
            await supabase.from('budget_requests').update(updatePayload).eq('id', request_id);
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    } catch (e: any) {
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ ok: false, error: e.message }, { status });
    }
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------
/** Divisi Tata Usaha — satu-satunya yang boleh jalur cepat langsung ke Bendahara. */
function isTuName(name?: string | null): boolean {
    const n = (name || '').trim().toUpperCase();
    return n === 'TU' || n.includes('TATA USAHA');
}

/** Ambil nama divisi berdasarkan id. */
async function getDivisionName(divisionId: string): Promise<string | null> {
    const { data } = await supabase.from('divisions').select('name').eq('id', divisionId).maybeSingle();
    return data?.name ?? null;
}

/**
 * Status awal alur verifikasi berdasarkan divisi + pilihan jalur PJ.
 * Urutan verifikasi: KTU → Kepala Divisi → PPK → Bendahara.
 * - Semua divisi mulai di KTU → 'Menunggu KTU'.
 * - Non-TU  : setelah KTU wajib lewat Kepala Divisi (lihat approve_request).
 * - TU normal: setelah KTU langsung ke PPK (kepala divisi TU = KTU).
 * - TU cepat : PJ pilih langsung ke Bendahara → 'Antrean Pencairan' (skip semua verifikasi).
 */
function initialFlowStatus(isTu: boolean, route: any): { status: string; bypass: boolean } {
    if (isTu && route === 'bendahara') return { status: 'Antrean Pencairan', bypass: true };
    return { status: 'Menunggu KTU', bypass: false };
}

/** Hitung ulang status nota dari akumulasi nilai yang telah disetor. */
async function recomputeReceiptStatus(requestId: string): Promise<void> {
    const { data: subs } = await supabase.from('receipt_submissions').select('amount').eq('budget_request_id', requestId);
    const sum = (subs || []).reduce((s: number, r: any) => s + parseFloat(r.amount || 0), 0);
    const { data: req } = await supabase.from('budget_requests').select('total_amount, receipt_status').eq('id', requestId).single();
    if (!req) return;
    const total = parseFloat(req.total_amount || 0);
    // Jangan turunkan status bila Bendahara sudah men-centang final ("Disetujui Bendahara").
    if (req.receipt_status === 'Disetujui Bendahara') return;
    let status = 'Belum Ada';
    if (sum > 0.001) status = (sum >= total - 0.001) ? 'Lunas' : 'Sebagian';
    await supabase.from('budget_requests').update({ receipt_status: status }).eq('id', requestId);
}

/** URL lampiran: trim; kosong/bukan string → null (kolom opsional). */
function cleanUrl(url: any): string | null {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Bersihkan daftar nomor register: trim, buang kosong, buang duplikat (case-insensitive). */
function cleanRegisters(registers: any): string[] {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of Array.isArray(registers) ? registers : []) {
        const val = String(raw ?? '').trim();
        if (!val) continue;
        const key = val.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(val);
    }
    return cleaned;
}

/** Ganti (replace-all) daftar nomor register milik sebuah pengajuan. */
async function replaceRegisters(requestId: string, registers: any): Promise<void> {
    const cleaned = cleanRegisters(registers);
    await globalPrisma.$transaction(async tx => {
        await tx.budget_request_registers.deleteMany({ where: { budget_request_id: requestId } });
        if (cleaned.length) await tx.budget_request_registers.createMany({ data: cleaned.map(register_number => ({ budget_request_id: requestId, register_number })) });
    });
}

function normalizeItems(items: any[]): { processedItems: any[]; total: number } {
    if (!Array.isArray(items) || items.length === 0) {
        throw new HttpError(400, 'Minimal 1 item rincian');
    }
    let total = 0;
    const processedItems = items.map((i: any) => {
        const qty = Number(i.quantity);
        const price = Number(i.unit_price);
        const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
        const p = Number.isFinite(price) && price >= 0 ? price : 0;
        if (!i.item_name || String(i.item_name).trim() === '') throw new HttpError(400, 'Nama barang wajib diisi pada setiap item');
        const itemTotal = q * p;
        total += itemTotal;
        return { item_name: i.item_name, category: i.category, quantity: q, unit: i.unit || 'Pcs', unit_price: p };
    });
    return { processedItems, total };
}

function itemsForInsert(items: any[], requestId: string) {
    return items.map((i: any) => ({
        budget_request_id: requestId,
        item_name: i.item_name,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit || 'Pcs',
        unit_price: i.unit_price,
    }));
}

async function generateRequestNumber(): Promise<string> {
    // Tanggal lokal WIB (UTC+7)
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dateStr = wib.toISOString().slice(0, 10);          // YYYY-MM-DD (WIB)
    const compact = dateStr.replace(/-/g, '');
    
    // BUG-02: Use UUID/timestamp instead of sequence to avoid race condition
    const randomHex = randomUUID().slice(0, 6).toUpperCase();
    return `REQ-${compact}-${randomHex}`;
}

    
    export async function GET(req: any) { return _GET(req); }
    export async function POST(req: any) { return _POST(req); }
}

@Injectable()
export class KeuanganService {
  private readonly logger = new Logger(KeuanganService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) { globalPrisma = prisma; }

  private handleResult(res: Response, result: any) {
      if (result && result.isResponseMock) {
          return res.status(result.status).json(result.data);
      }
      return res.status(200).json(result);
  }

  async getCatatanKeuangan(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await CK.GET(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }
  async postCatatanKeuangan(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await CK.POST(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }
  async putCatatanKeuangan(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await CK.PUT(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }
  async deleteCatatanKeuangan(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await CK.DELETE(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }

  async getTarifHonor(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await TH.GET(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }
  async putTarifHonor(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await TH.PUT(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }

  async getKeuangan(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await KG.GET(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }
  async postKeuangan(req: Request, res: Response) {
      globalDb = createPrismaDbAdapter(this.prisma);
      const result = await KG.POST(new MockNextRequest(req) as any);
      return this.handleResult(res, result);
  }
}

