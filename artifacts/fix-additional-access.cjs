const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')))}const root='apps/api/src/';
edit(root+'tugas-siswa/tugas-siswa.service.ts',s=>s.replace("return { OR: [{ kelas: { in: names } }, { kelas_list: { hasSome: names } }] };", "return { OR: [{ kelas: { in: names } }, ...names.map(name => ({ kelas_list: { array_contains: [name] } }))] };"));
edit(root+'site-settings/site-settings.service.ts',s=>s.replace("const folder = row.folder || 'general';", "const folder = (row.folder || 'general').replace(/^owner:[^:]+:/, '');"));
edit('apps/web/app/api/upload/route.ts',s=>{
s=s.replace("import { verifyAppToken } from '@/lib/app-jwt';","import { getApiUser } from '@/lib/api-auth';\nimport { nestFetchAsUser } from '@/lib/nest-api';");
s=s.replaceAll('await verifyAppToken(token)', 'await getApiUser(req)');
s=s.replace('        const formData = await req.formData();',`        const formData = await req.formData();
        const file = formData.get('file');
        if (!(file instanceof File) || file.size > 25 * 1024 * 1024) return NextResponse.json({ok:false,error:'Berkas wajib diisi, maksimal 25 MB'},{status:400});
        const folder = String(formData.get('folder') || 'general');
        if (!/^[a-zA-Z0-9_/-]+$/.test(folder) || folder.includes('..')) return NextResponse.json({ok:false,error:'Folder tidak valid'},{status:400});
        formData.set('folder', folder);`);
s=s.replace('                    file_url: fileUrl,','                    file_url: fileUrl,\n                    owner_auth_id: user.authId,');
s=s.replace('        // 1. Ambil konfigurasi penyimpanan aktif dari database',`        const authorization = await nestFetchAsUser('/site-settings/file-registry/can-delete?url=' + encodeURIComponent(fileUrl), token);
        if (authorization.status !== 200 || !authorization.body?.allowed) return NextResponse.json({ok:false,error:'Berkas bukan milik Anda atau kepemilikannya belum tercatat'},{status:403});

        // 1. Ambil konfigurasi penyimpanan aktif dari database`);
return s;
});
edit(root+'e-supervisi/e-supervisi.controller.ts',s=>{
s=s.replace("import { Request as", "import { FeatureAccess, FeatureAccessGuard } from '../auth/feature-access.guard';\nimport { Request as");
for(const route of ["@Post('dokumen')","@Delete('dokumen')","@Post('penugasan')","@Delete('penugasan')"])s=s.replace(route,route+"\n  @UseGuards(FeatureAccessGuard)\n  @FeatureAccess('supervisi_access_config', 'WKM_AKADEMIK', 'WAKAMAD_KURIKULUM')");
s=s.replace('async upsertUnggahanRecord(@Body()', 'async upsertUnggahanRecord(@Req() req: any, @Body()').replace('this.eSupervisiService.upsertUnggahanRecord(body)','this.eSupervisiService.upsertUnggahanRecord(body, req.user)');
s=s.replace('async deleteUnggahan(@Query(', 'async deleteUnggahan(@Req() req: any, @Query(').replace('this.eSupervisiService.deleteUnggahan(parseInt(id))','this.eSupervisiService.deleteUnggahan(parseInt(id), req.user)');
return s;
});
edit(root+'e-supervisi/e-supervisi.service.ts',s=>{
s=s.replace("import { Injectable", "import { rolesUser } from '../auth/feature-access.guard';\nimport { Injectable");
s=s.replaceAll("const isAdmin = role.includes('ADMIN') || role.includes('KURIKULUM');", "const isAdmin = rolesUser(apiUser).some(r => ['ADMIN','ADMINISTRATOR'].includes(r));");
s=s.replaceAll('!isAdmin && penugasan.supervisor_nip !== apiUser?.nip', '!isAdmin && (!apiUser?.nip || penugasan.supervisor_nip !== apiUser.nip || penugasan.guru_nip === apiUser.nip)');
s=s.replace('async deleteUnggahan(id: number)', 'async deleteUnggahan(id: number, user: any)').replace('    if (!unggahan) return { ok: true };', `    if (!unggahan) return { ok: true };
    if (!user?.nip || unggahan.guru_nip !== user.nip) throw new (require('@nestjs/common').ForbiddenException)('Hanya pemilik unggahan yang dapat menghapus');`);
s=s.replace('file_name: string; size_bytes?: number }) {', `file_name: string; size_bytes?: number }, user: any) {
    if (!user?.nip || body.guru_nip !== user.nip) throw new (require('@nestjs/common').ForbiddenException)('NIP unggahan tidak sesuai sesi');`);
return s;
});
edit(root+'keuangan/keuangan.service.ts',s=>{
s=s.replace("upperRoles.includes('SUPERADMIN')", "upperRoles.includes('ADMINISTRATOR')");
const start=s.indexOf('namespace CK'),end=s.indexOf('namespace TH');let ck=s.slice(start,end);
ck=ck.replace('        const nip = searchParams.get(\'nip\');', `        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();
        const privileged = user.isAdmin || user.roles.includes('BENDAHARA_KOMITE');
        if (!privileged && !user.nip) return forbiddenResponse('Identitas diperlukan');
        const nip = privileged ? searchParams.get('nip') : user.nip;`);
ck=ck.replace('        const body = await request.json();\n        const { nama_guru', `        const user = await getApiUser(request);
        if (!user) return unauthorizedResponse();
        const body = await request.json();
        if (!user.isAdmin && !user.roles.includes('BENDAHARA_KOMITE')) {
            if (!user.nip) return forbiddenResponse('Identitas diperlukan');
            body.nip = user.nip; body.nama_guru = user.nama; body.status = 'BELUM_TERGANTI';
        }
        const { nama_guru`);
ck=ck.replaceAll("if (existing.nip !== user.nip)","if (!user.nip || existing.nip !== user.nip)");
ck=ck.replace('        // Convert nominal if present', `        if (!isBendaharaOrAdmin) {
            delete updates.nip; delete updates.nama_guru; delete updates.status;
        }
        for (const key of Object.keys(updates)) if (!['nama_guru','nip','nama_kegitan','item','nominal','keterangan','status','tahun_ajaran','tanggal'].includes(key)) delete updates[key];
        // Convert nominal if present`);
s=s.slice(0,start)+ck+s.slice(end);return s;
});
