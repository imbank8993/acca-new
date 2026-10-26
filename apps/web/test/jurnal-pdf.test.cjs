const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),ts=require('typescript');
const {PDFDocument}=require('pdf-lib');
function load(file,imports={},globals={}){const box={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:box,exports:box.exports,Date,console,...globals,require:n=>Object.hasOwn(imports,n)?imports[n]:require(n)});return box.exports;}
const logo=load('apps/web/lib/branding-logo.ts');
const header=load('apps/web/lib/pdf-report-header.ts',{'./branding-logo':logo});
const {createJurnalPdf}=load('apps/web/lib/jurnal-pdf.ts',{'./pdf-report-header':header});
const base={id:1,tanggal:'2026-09-07',hari:'Senin',jam_ke:'1, 2',kelas:'X A',mata_pelajaran:'Matematika',kategori_kehadiran:'Sesuai',materi:'Persamaan linear',refleksi:'Siswa memahami konsep dasar.',nama_guru:'Guru Satu',nip:'001',jamIds:[1,2]};
const journals=[base,{...base,id:2,nip:'002',nama_guru:'Guru Dua'},{...base,id:3,tanggal:'2026-10-05'},{...base,id:4,kelas:'X B'},{...base,id:5,tanggal:'2025-09-01'}];
const time=[{hari:'Senin',jam_ke:1,mulai:'07:00',selesai:'07:40'},{hari:'Senin',jam_ke:2,mulai:'07:40',selesai:'08:20'}];
const user={nip:'001',nama:'Guru Satu'};
const related=(j,nip,name)=>j.nip===nip||j.guru_pengganti===name;
const match=(a,b)=>a===b;
function exporter(fetch){let captured,filename;const api=load('apps/web/app/jurnal/lib/exportUtils.ts',{
 sweetalert2:{fire:()=>{},close:()=>{},showLoading:()=>{}},
 '@/lib/jurnal-pdf':{createJurnalPdf:(rows,options)=>{captured={rows,options};return{save:name=>{filename=name;}};}},
},{fetch});return{api,get captured(){return captured;},get filename(){return filename;}};}
test('teacher PDF export retains school year, month, class and ownership filters and grouped time',async()=>{
 const run=exporter();await run.api.executeExport('GURU',{bulan:[9],kelas:['X A']},user,journals,null,null,null,'',related,match,x=>x,time,{},'2026/2027');
 assert.equal(run.captured.rows.length,1);assert.equal(run.captured.rows[0]['Nama Guru'],'Guru Satu');assert.equal(run.captured.rows[0]['Jam Ke'],'07:00 - 08:20 (1-2)');assert.equal(run.captured.rows[0].Tanggal,'07/09/2026');assert(run.filename.endsWith('.pdf'));assert(!run.filename.endsWith('.xlsx'));
});
test('admin PDF respects teacher, subject, selected classes and search filters',async()=>{
 const run=exporter();await run.api.executeExport('ADMIN',{bulan:[9],kelas:['X A']},user,journals,'Guru Dua','Matematika','X B','linear',related,match,x=>x,time,{},'2026/2027');
 assert.equal(run.captured.rows.length,1);assert.equal(run.captured.rows[0].nama_guru,'Guru Dua');assert.equal(run.captured.options.mode,'ADMIN');
});
test('homeroom PDF obtains assigned class journals for the selected academic year before exporting',async()=>{
 let url='';const run=exporter(async request=>{url=request;return{ok:true,json:async()=>({ok:true,data:[{...base,kelas:'XI Matematika Lanjut 1'}]})};});
 await run.api.executeExport('WALI',{bulan:[9],kelas:[]},user,[],null,null,null,'',related,match,x=>x,time,{},'2026/2027');
 assert(url.includes('wali_nip=001'));assert(url.includes('wali_tahun=2026%2F2027'));assert(url.includes('startDate=2026-07-01'));assert.equal(run.captured.rows.length,1);assert.equal(run.captured.rows[0].Kelas,'XI Matematika Lanjut 1');
});
function fixtureRows(count=8){return Array.from({length:count},(_,i)=>({No:i+1,NIP:'000000001','Nama Guru':i%2?'Guru Contoh Kedua':'Guru Contoh Pertama',Hari:'Senin',Tanggal:'07/09/2026','Jam Ke':'07:00 - 08:20 (1-2)',Kelas:i%2?'XI A':'X A','Mata Pelajaran':'Matematika','Kategori Kehadiran':i===2?'Penugasan dengan pendampingan':'Sesuai',Materi:'Persamaan dan pertidaksamaan linear. Siswa menyelesaikan soal kontekstual melalui diskusi kelompok dan mempresentasikan langkah penyelesaian secara bergantian. Refleksi dilakukan setelah latihan untuk menilai pemahaman konsep.',Refleksi:'Sebagian besar siswa mampu menjelaskan hubungan antarkonsep. Tindak lanjut berupa latihan bertahap dan pendampingan bagi siswa yang memerlukan penguatan.','Guru Pengganti':i===2?'Guru Pendamping':'','Status Pengganti':i===2?'Hadir':'',Keterangan:i===2?'LKPD digunakan untuk kegiatan terstruktur dan dibahas bersama pada pertemuan berikutnya.':'Pembelajaran berlangsung sesuai jadwal.'}));}
test('journal PDF uses A4 landscape with repeated headings and full materials/reflections',async()=>{
 const doc=createJurnalPdf(fixtureRows(),{mode:'GURU',tahunAjaran:'2026/2027'});const bytes=new Uint8Array(doc.output('arraybuffer'));
 const pdf=await PDFDocument.load(bytes);assert(pdf.getPageCount()>1);for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()-841.89)<1);assert(Math.abs(p.getHeight()-595.28)<1);}
 const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');const read=await pdfjs.getDocument({data:bytes,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep}).promise;
 let text='';for(let i=1;i<=read.numPages;i++){const page=await read.getPage(i);const content=await page.getTextContent();const pageText=content.items.map(x=>x.str).join(' ');assert(pageText.includes('JURNAL PEMBELAJARAN'));assert(pageText.includes('Hari / Tanggal'));assert(pageText.includes(`Halaman ${i} dari`));for(const item of content.items){assert(item.transform[4]>=20);assert(item.transform[4]+item.width<=page.view[2]-15);assert(item.transform[5]>=15);}text+=pageText+' ';}
 assert(text.includes('NIP 000000001'));assert(text.includes('Pengganti: Guru Pendamping (Hadir)'));assert(text.includes('Refleksi:'));assert(text.includes('pendampingan bagi siswa'));assert(!text.includes('undefined'));await read.destroy();
 const output=path.join(os.tmpdir(),'acca-jurnal-a4.pdf');fs.writeFileSync(output,bytes);console.log('PDF preview: '+output);
});
test('admin row labels stay readable and empty reports are rejected',()=>{
 assert.throws(()=>createJurnalPdf([],{mode:'ADMIN',tahunAjaran:'2026/2027'}),/Tidak ada jurnal/);
 const doc=createJurnalPdf([{tanggal:'07/09/2026',nama_guru:'Guru Admin',nip:'001',hari:'Senin',kelas:'X A',jam_ke:'1-2',mata_pelajaran:'Matematika',kategori_kehadiran:'Terlambat',materi:'Konsep',refleksi:'Latihan',guru_pengganti:'Guru Pengganti',status_pengganti:'Hadir',guru_piket:'Guru Piket',keterangan_tambahan:'Catatan',durasi_terlambat:10}],{mode:'ADMIN',tahunAjaran:'2026/2027'});assert.equal(doc.getNumberOfPages(),1);
});
