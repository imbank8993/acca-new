const fs=require('fs'),{Client,types}=require('pg');
types.setTypeParser(1082,v=>v);
const e=require('dotenv').parse(fs.readFileSync('.env'));
const c=new Client({connectionString:e.DATABASE_URL,connectionTimeoutMillis:12000});
(async()=>{try{await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const q={
schedule:'select id,nip,nama_guru,hari,jam_ke,kelas,mata_pelajaran,aktif,berlaku_mulai,versi_id from jadwal_guru',
versions:'select id,berlaku_mulai,jenis,catatan from jadwal_versi order by berlaku_mulai',
journals:"select * from jurnal_guru where tanggal between '2026-07-01' and '2026-10-31' order by tanggal,id",
holidays:"select * from libur where tanggal between '2026-07-01' and '2026-10-31' order by tanggal,id",
profile:'select * from profil_sekolah',
teachers:'select nip,nama_lengkap,aktif,jenis_pegawai from master_guru',
classes:'select * from master_kelas',
extra:"select * from jurnal_tugas_tambahan where tanggal between '2026-07-01' and '2026-10-31'",
};const data={extracted_at:new Date().toISOString()};
for(const [k,sql] of Object.entries(q)){data[k]=(await c.query(sql)).rows;console.log(k,data[k].length)}
await c.query('ROLLBACK');fs.writeFileSync('tmp/attendance-source.json',JSON.stringify(data,null,2));
console.log('active versions',(await c.query('select versi_id,aktif,count(*) from jadwal_guru group by 1,2 order by 1')).rows);
console.log('journal examples',data.journals.slice(0,3));console.log('libur',data.holidays);console.log('classes',data.classes.slice(0,2));console.log('extra examples',data.extra.slice(0,2));
}finally{await c.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
