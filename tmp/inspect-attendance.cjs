const fs=require('fs');
const {Client}=require('pg');
const e=require('dotenv').parse(fs.readFileSync('.env'));
const c=new Client({connectionString:e.DATABASE_URL,connectionTimeoutMillis:12000});
(async()=>{try{
await c.connect();
await c.query('BEGIN READ ONLY');
for(const t of ['jadwal_guru','jadwal_versi','jurnal_guru','libur','profil_sekolah'])console.log(t,(await c.query('select count(*) from '+t)).rows);
console.log('profile',(await c.query('select nama,alamat,kabupaten_kota,header_surat_text,logo_url,kepala_sekolah_nama,kepala_sekolah_nip from profil_sekolah')).rows);
console.log('versions',(await c.query('select * from jadwal_versi order by berlaku_mulai')).rows);
console.log('journal',(await c.query("select min(tanggal),max(tanggal),count(*) from jurnal_guru where tanggal between '2026-07-01' and '2026-10-31'")).rows);
console.log('categories',(await c.query("select kategori_kehadiran,is_generated,filled_by,count(*) from jurnal_guru where tanggal between '2026-07-01' and '2026-10-31' group by 1,2,3 order by count(*) desc")).rows);
await c.query('ROLLBACK');
}catch(err){console.log(err.message)}finally{await c.end()}})();
