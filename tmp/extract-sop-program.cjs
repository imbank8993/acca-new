const fs=require('fs'),{Client,types}=require('pg');
types.setTypeParser(1082,v=>v);types.setTypeParser(1083,v=>v);
const env=require('dotenv').parse(fs.readFileSync('.env'));
const c=new Client({connectionString:env.DATABASE_URL,connectionTimeoutMillis:12000});
(async()=>{try{await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const q={schedule:'select id,nip,nama_guru,hari,jam_ke,kelas,mata_pelajaran,aktif,berlaku_mulai,versi_id,ruang from jadwal_guru',versions:'select id,berlaku_mulai,jenis,catatan from jadwal_versi order by berlaku_mulai',times:'select * from master_waktu order by program,hari,jam_ke',classes:'select * from master_kelas',teachers:'select nip,nama_lengkap,aktif,jenis_pegawai from master_guru',clinics:"select id,nama_guru,mapel,topik,tanggal,jam_mulai,jam_selesai,max_siswa,status,target_kelas,ruangan from klinik_slots where tanggal >= '2026-07-01' order by tanggal,jam_mulai",holidays:"select id,tanggal,jam_ke,keterangan,lingkup,target_kelas from libur where tanggal >= '2026-07-01' order by tanggal",profile:'select * from profil_sekolah'};
let d={extracted_at:new Date().toISOString()};for(const [k,sql] of Object.entries(q)){d[k]=(await c.query(sql)).rows;console.log(k,d[k].length)}
await c.query('ROLLBACK');fs.writeFileSync('tmp/sop-program-source.json',JSON.stringify(d,null,2));
console.log('times',d.times.filter(r=>r.aktif));console.log('clinic-summary',(await c.query("select status,to_char(jam_mulai,'HH24:MI') mulai,to_char(jam_selesai,'HH24:MI') selesai,count(*) from klinik_slots where tanggal >= '2026-07-01' group by 1,2,3 order by count(*) desc limit 20")).rows);console.log('clinic-latest',d.clinics.slice(-6));
}finally{await c.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
