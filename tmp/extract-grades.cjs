const fs=require('fs'),{Client,types}=require('pg');
types.setTypeParser(1082,v=>v);
const env=require('dotenv').parse(fs.readFileSync('.env'));
const c=new Client({connectionString:env.DATABASE_URL,connectionTimeoutMillis:12000});
(async()=>{try{await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const qs={
 scores:'select * from nilai_data order by created_at asc,id',
 weights:'select * from nilai_bobot order by updated_at desc nulls last,id',
 tasks:'select * from nilai_tagihan order by created_at asc,id',
 rosters:'select nisn,nama_siswa,kelas,tahun_ajaran,semester,aktif from siswa_kelas',
 teachers:'select nip,nama_lengkap,aktif,jenis_pegawai from master_guru',
 years:'select * from master_tahun_ajaran',
 subjects:'select * from master_mapel',
 classes:'select * from master_kelas',
 profile:'select * from profil_sekolah',
};let d={extracted_at:new Date().toISOString()};
for(const [key,sql] of Object.entries(qs)){d[key]=(await c.query(sql)).rows;console.log(key,d[key].length)}
await c.query('ROLLBACK');fs.writeFileSync('tmp/grades-source.json',JSON.stringify(d,null,2));
console.log('Periods',(await c.query('select tahun_ajaran,semester,count(*),count(distinct kelas) kelas,count(distinct mapel) mapel,count(*) filter(where nilai is null) kosong from nilai_data group by 1,2 order by 1,2')).rows);
console.log('KKM',d.weights.map(r=>({kelas:r.kelas,mapel:r.mapel,ta:r.tahun_ajaran,sem:r.semester,config:r.bobot_config})).slice(0,10));
console.log('Years',d.years);
}finally{await c.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
