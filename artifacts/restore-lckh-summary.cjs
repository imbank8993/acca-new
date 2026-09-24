const fs=require('fs');
const old=fs.readFileSync('C:/Users/imran/.gemini/antigravity/scratch/acca-app/app/api/lckh/summary/route.ts','utf8').replace(/\r\n/g,'\n');
let matrix=old.slice(old.indexOf('            // Grouping for Rekap'),old.indexOf('        // 3. Nilai Data'));
let result=old.slice(old.indexOf('        // Merge session data'),old.indexOf('                debug:'));
result=result.replace('return NextResponse.json({\n            ok: true,\n            data: {','return {').replace('                    tahun_ajaran: tahunAjaran\n                },','                    tahun_ajaran: tahunAjaran\n                }');
const helper=`import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const json = (v: any): any => JSON.parse(JSON.stringify(v, (_, x) => typeof x === 'bigint' ? String(x) : x));

/** PostgreSQL summary with the same detail/matrix contract consumed by LCKH. */
export async function buildLckhSummary(db: PrismaService, targetNip: string, startDate: string, endDate: string) {
    const start = new Date(String(startDate).slice(0,10)+'T00:00:00Z');
    const end = new Date(String(endDate).slice(0,10)+'T00:00:00Z');
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end < start || +end - +start > 366*86400000) throw new BadRequestException('Rentang tanggal wajib valid dan maksimal satu tahun');
    end.setUTCDate(end.getUTCDate()+1);
    const tanggal = { gte:start, lt:end };
    const semInt = start.getUTCMonth() >= 6 ? 1 : 2;
    const year = start.getUTCFullYear(), taStartYear = semInt === 1 ? year : year-1;
    const tahunAjaran = taStartYear + '/' + (taStartYear+1);
    const semesterStart = semInt === 1 ? taStartYear+'-07-01' : (taStartYear+1)+'-01-01';
    const semesterEnd = semInt === 1 ? taStartYear+'-12-31' : (taStartYear+1)+'-06-30';
    const [j,s,n,t,tagihan] = await Promise.all([
        db.jurnal_guru.findMany({where:{nip:targetNip,tanggal},orderBy:{tanggal:'asc'}}),
        db.absensi_sesi.findMany({where:{nip:targetNip,tanggal},orderBy:{tanggal:'asc'}}),
        db.nilai_data.findMany({where:{nip:targetNip,semester:semInt,tahun_ajaran:tahunAjaran}}),
        db.jurnal_tugas_tambahan.findMany({where:{nip:targetNip,tanggal},include:{tugas_tambahan:{select:{jabatan:true}}},orderBy:{tanggal:'asc'}}),
        db.nilai_tagihan.findMany({where:{nip:targetNip,semester:semInt,tahun_ajaran:tahunAjaran}}),
    ]);
    const journals: any[] = json(j), sessions: any[] = json(s);
    const detailTugas: any[] = json(t.map(row=>({...row,tugas:row.tugas_tambahan})));
    const detailAbsensi: any[] = sessions.length ? json(await db.absensi_detail.findMany({where:{sesi_id:{in:sessions.map(s=>s.sesi_id)}}})) : [];
    let totalHoursFromJurnal = 0;
    journals.forEach(j=>{const parts=String(j.jam_ke||'').split('-').map(Number);if(parts.every(Number.isFinite)&&parts[0]>0) totalHoursFromJurnal += parts.length===2 ? Math.max(0,parts[1]-parts[0]+1):1;});
    const unique = new Map<string,any>();
    for(const row of json(n)) unique.set([row.kelas,row.mapel,row.jenis,row.materi_tp,row.tagihan].join('|'),{kelas:row.kelas,mapel:row.mapel,jenis:row.jenis,materi:row.materi_tp,tagihan:row.tagihan,kolom_id:row.id,last_update:row.updated_at});
    for(const row of json(tagihan)) {const key=[row.kelas,row.mapel,row.jenis,row.materi_tp,row.nama_tagihan].join('|');if(!unique.has(key)) unique.set(key,{kelas:row.kelas,mapel:row.mapel,jenis:row.jenis,materi:row.materi_tp,tagihan:row.nama_tagihan,kolom_id:row.id,last_update:row.updated_at});}
    const detailNilai=Array.from(unique.values());
    let rekapAbsensi:any[]=[];let detailAbsensiPerClass:any[]=[];
    if(sessions.length) {
${matrix}
${result}
    };
}
`;
fs.writeFileSync('apps/api/src/lckh/lckh-summary.ts',helper);
let s=fs.readFileSync('apps/api/src/lckh/lckh.service.ts','utf8').replace(/\r\n/g,'\n');
s="import { buildLckhSummary } from './lckh-summary';\n"+s;
const a=s.indexOf('  async getSummary('),b=s.indexOf('  async getSubmissions(',a);
s=s.slice(0,a)+`  async getSummary(user: any, query: any) {
    const nip = this.scopeNip(user, query.nip) || user.nip;
    if (!nip) throw new BadRequestException('NIP wajib diisi');
    return buildLckhSummary(this.prisma, nip, query.startDate, query.endDate);
  }

`+s.slice(b);fs.writeFileSync('apps/api/src/lckh/lckh.service.ts',s);
for(const dir of ['lckh','tugas-siswa']) {
const p='apps/api/src/'+dir+'/'+dir+'.controller.ts';let c=fs.readFileSync(p,'utf8');c=c.replace(/const roles: string\[\] = reqUser(\??)\.role/, 'const roles: string[] = reqUser?.roles || (reqUser$1.role').replace(': [];',': []);');fs.writeFileSync(p,c);
}
