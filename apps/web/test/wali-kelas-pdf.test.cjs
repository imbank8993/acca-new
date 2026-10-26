const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),ts=require('typescript');const{PDFDocument}=require('pdf-lib');
function load(file,imports={},globals={}){const box={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:box,exports:box.exports,Date,URLSearchParams,console,...globals,require:n=>Object.hasOwn(imports,n)?imports[n]:require(n)});return box.exports;}
const builders=load('apps/web/lib/wali-kelas-report-data.ts');const logo=load('apps/web/lib/branding-logo.ts');const header=load('apps/web/lib/pdf-report-header.ts',{'./branding-logo':logo});const{createWaliKelasPdf}=load('apps/web/lib/wali-kelas-pdf.ts',{'./pdf-report-header':header});
const c={kelas:'X A',tahun:'2026/2027',wali:'Wali Kelas Contoh',semester:'1',bulan:'2026-10',jenis:'ALL'};
const baseGrade={tahun_ajaran:'2026/2027',semester:1,mapel:'Matematika',materi_tp:'Persamaan linear',jenis:'UH',nilai:85.5,sumber:'guru',nama_guru:'Guru Contoh',catatan:'Memahami konsep dan langkah penyelesaian.'};
const students=Array.from({length:6},(_,i)=>({siswa:{nisn:'00'+String(i+1).padStart(8,'0'),nama:'Siswa Contoh '+String(i+1).padStart(2,'0')},nilai:{all:[{...baseGrade,nilai:i===0?0:85.5},{...baseGrade,sumber:'cbt',mapel:'Biologi',materi_tp:'Asesmen konsep ekosistem',score_type:'classical',nilai:i===1?null:90,catatan:i===1?'Menunggu penilaian':'Skor klasikal',jenis:'ASAS'}]},apresiasi:i===0?[{mapel:'Matematika',tahun_ajaran:'2026/2027',semester:1,judul:'Keaktifan diskusi',topik:'Penyelesaian soal',tanggal:'2026-10-12',jumlah_menang:2,total_poin:10,catatan:'Aktif memberi tanggapan.'}]:[]}));
const ekskul=students.map((s,i)=>({nisn:s.siswa.nisn,nama:s.siswa.nama,ekskul:i===5?[]:[{nama_ekskul:i%2?'Pramuka':'Robotika'},{nama_ekskul:'Karya Ilmiah Remaja'}]}));
const kokur=students.map((s,i)=>({nisn:s.siswa.nisn,nama:s.siswa.nama,kegiatan:i===5?[]:[{tanggal:'2026-10-12',nama_kegiatan:'Literasi dan refleksi harian',status:i%2?'Pending':'Disetujui',catatan:'Membaca buku dan menuliskan ringkasan pembelajaran.',is_custom:false},{tanggal:'2026-10-13',nama_kegiatan:'Proyek pengelolaan lingkungan madrasah',status:'Disetujui',catatan:'Berkolaborasi dalam kelompok untuk menyusun rencana dan laporan kegiatan.',is_custom:true}]}));
const catatan=students.map((s,i)=>({id:String(i),kelas:'X A',tahun_ajaran:'2026/2027',nisn:s.siswa.nisn,nama_snapshot:s.siswa.nama,tanggal:'2026-10-12',nama_guru:'Guru Contoh',mapel:'Matematika',jenis:i%2?'NEGATIF':'POSITIF',catatan:i%2?'Memerlukan pendampingan dalam mengatur waktu dan menyelesaikan tugas pembelajaran.':'Aktif berdiskusi, membantu teman, dan menunjukkan ketekunan saat menyelesaikan soal.',status:i%2?'DITINDAKLANJUTI':'SELESAI',catatan_siswa_tindak_lanjut:[{created_at:'2026-10-13T00:00:00Z',nama:'Guru BK Contoh',status_baru:'DITINDAKLANJUTI',catatan:'Diskusi dengan siswa untuk menyusun langkah perbaikan dan penguatan kebiasaan belajar.'}]}));

test('grades preserve zero, distinguish missing scores and filter period/source without mixing appreciation',()=>{
 const raw={siswa:students[0].siswa,nilai:{all:[{...baseGrade,nilai:0},{...baseGrade,nilai:null,jenis:'PAS'},{...baseGrade,tahun_ajaran:'2025/2026'},{...baseGrade,semester:2},{...baseGrade,sumber:'cbt',nilai:null,score_type:'classical'}]},apresiasi:students[0].apresiasi};
 const r=builders.buildNilaiReport(c,[raw]);assert.equal(r.sections[0].body.length,2);assert.equal(r.sections[0].body[0][4],'0');assert.equal(r.sections[0].body[1][4],'-');assert.equal(r.sections.length,2);
 const cbt=builders.buildNilaiReport({...c,sumber:'cbt'},[raw]);assert.equal(cbt.sections.length,1);assert.equal(cbt.sections[0].body.length,1);assert.equal(cbt.sections[0].body[0][3],'ACCA-CBT');
 const missing=builders.buildNilaiReport(c,[{...raw,nilai:{all:[],cbt_linkage:'ambiguous'}}]);assert.equal(missing.sections[0].body[0][4],'-');assert(String(missing.sections[0].body[0][6]).includes('belum dapat dipastikan'));
});
test('whole-class grade export loads every matching student beyond pagination with bounded requests',async()=>{
 let pending=0,max=0;const seen=[];const signal=new AbortController().signal;
 const data=load('apps/web/lib/wali-kelas-report-data.ts',{}, {fetch:async(url,init)=>{assert.equal(init.signal,signal);assert.equal(init.cache,'no-store');seen.push(url);pending++;max=Math.max(max,pending);await new Promise(r=>setTimeout(r,2));pending--;
 if(url.startsWith('/api/settings/'))return{ok:true,json:async()=>({ok:true,data:[...Array.from({length:14},(_,i)=>({nisn:'00'+i,nama_siswa:'Siswa '+i,semester:'Ganjil'})),{nisn:'00'+0,nama_siswa:'Duplicate',semester:'Ganjil'},{nisn:'out',nama_siswa:'Other semester',semester:'Genap'}]})};
 return{ok:true,json:async()=>({ok:true,data:url.includes('/apresiasi')?[]:{all:[baseGrade]}})};}});
 const report=await data.loadNilaiReport(c,signal);assert.equal(report.sections.length,14);assert(report.sections.every(s=>s.body.length===1));assert.equal(seen.filter(u=>u.startsWith('/api/nilai/siswa?')).length,14);assert(max<=6);assert(seen[0].includes('tahun_ajaran=2026%2F2027'));
});
test('failed data request prevents partial report and aborted exports stop requests',async()=>{
 const data=load('apps/web/lib/wali-kelas-report-data.ts',{}, {fetch:async()=>({ok:false,json:async()=>({ok:false,error:'Tidak tersedia'})})});await assert.rejects(data.loadNilaiReport({...c,student:{nisn:'001',nama:'Siswa'}},new AbortController().signal),/Tidak tersedia/);
 const controller=new AbortController();controller.abort();let calls=0;
 const cancelled=load('apps/web/lib/wali-kelas-report-data.ts',{}, {fetch:async()=>{calls++;throw Error('Unexpected request');}});
 await assert.rejects(cancelled.loadNilaiReport({...c,student:{nisn:'001',nama:'Siswa'}},controller.signal),e=>e.name==='AbortError');assert.equal(calls,0);
});
test('cocurricular, extracurricular and learning-note reports use filters and retain pending/no-data states',()=>{
 const ex=builders.buildEkskulReport(c,[...ekskul.slice(0,1),{nisn:'000',nama:'Tanpa Kegiatan',ekskul:[]}]);assert.equal(ex.sections[0].body.length,2);assert(ex.sections[0].body.some(r=>r[2]==='-'));assert.equal(ex.sections[0].head.length,3);assert(!ex.sections[0].head.includes('Jumlah kegiatan'));
 const ko=builders.buildKokurikulerReport(c,kokur);assert.equal(ko.sections.length,6);const activities=ko.sections.flatMap(s=>s.body);assert.equal(activities.length,11);assert(activities.some(r=>r[3]==='Pending'));assert(activities.some(r=>String(r[2]).includes('Belum ada kegiatan')));
 const note=builders.buildCatatanReport({...c,jenis:'NEGATIF',query:'pendampingan'},[...catatan,{...catatan[1],kelas:'X B'},{...catatan[1],tanggal:'2025-10-12'}]);assert.equal(note.sections[0].body.length,3);assert(String(note.sections[0].body[0][7]).includes('Guru BK Contoh'));assert(String(note.sections[0].body[0][7]).includes('langkah perbaikan'));
 assert.throws(()=>builders.reportMonthRange('2026/2027','2026-01'),/Pilih bulan/);assert.equal(builders.reportMonthRange('2026/2027','2027-02').end,'2027-02-28');
});
test('grade and activity details are grouped under each student without repeated student columns',()=>{
 const grade=builders.buildNilaiReport(c,[...students].reverse());
 assert.equal(grade.sections[0].groupKey,'0000000001');assert.equal(grade.sections[1].groupKey,'0000000001');assert(grade.sections[1].title.includes('Apresiasi'));assert.equal(grade.sections[2].groupKey,'0000000002');
 for(const section of grade.sections){assert(section.title.includes(section.groupKey));assert(!section.head.includes('Siswa / NISN'));assert(section.body.every(row=>!row.some(value=>String(value).includes('Siswa Contoh'))));}
 const activity=builders.buildKokurikulerReport(c,[...kokur].reverse());assert.equal(activity.sections[0].groupKey,'0000000001');assert.equal(activity.sections[0].body.length,2);assert.equal(activity.sections[0].body[0][0],1);assert.equal(activity.sections[1].body[0][0],1);assert(!activity.sections[0].head.includes('Siswa / NISN'));
});
test('all four report types render A4 landscape with full text and repeated page headers',async()=>{
 const reports={Nilai:builders.buildNilaiReport(c,students),Kokurikuler:builders.buildKokurikulerReport(c,kokur),Ekstrakurikuler:builders.buildEkskulReport(c,ekskul),Catatan:builders.buildCatatanReport(c,catatan)};
 const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
 for(const[name,report]of Object.entries(reports)){
 const bytes=new Uint8Array(createWaliKelasPdf(report).output('arraybuffer'));const raw=await PDFDocument.load(bytes);for(const p of raw.getPages()){assert(Math.abs(p.getWidth()-841.89)<1);assert(Math.abs(p.getHeight()-595.28)<1);}
 const pdf=await pdfjs.getDocument({data:bytes,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep}).promise;let text='';
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();const t=content.items.map(x=>x.str).join(' ');assert(t.includes(report.title.toUpperCase()));assert(t.includes(`Halaman ${i} dari`));for(const x of content.items){assert(x.transform[4]>=20);assert(x.transform[4]+x.width<=page.view[2]-15);assert(x.transform[5]>=15);}text+=t+' ';}
 assert(text.includes('0000000001'));assert(!text.includes('undefined'));await pdf.destroy();fs.writeFileSync(path.join(os.tmpdir(),`acca-wali-${name}.pdf`),bytes);console.log('Rendered '+name+' with '+raw.getPageCount()+' A4 pages.');
 }
 const stress=reports.Catatan;stress.sections[0].body=Array.from({length:80},()=>stress.sections[0].body[0]);assert(createWaliKelasPdf(stress).getNumberOfPages()>1);
});

test('student headings repeat on continuation pages without overlapping the report header',async()=>{
 const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
 for(const report of [builders.buildNilaiReport(c,[students[1]]),builders.buildKokurikulerReport(c,[kokur[1]])]){
  const section=report.sections[0];section.body=Array.from({length:80},(_,i)=>[i+1,...section.body[0].slice(1)]);
  const bytes=new Uint8Array(createWaliKelasPdf(report).output('arraybuffer'));
  const pdf=await pdfjs.getDocument({data:bytes,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep}).promise;
  assert(pdf.numPages>1);
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i),content=await page.getTextContent();
   const headings=content.items.filter(x=>x.str===section.title);assert.equal(headings.length,1);
   const reportHeading=content.items.find(x=>x.str===report.title.toUpperCase());assert(reportHeading);assert(headings[0].transform[5]<reportHeading.transform[5]-20);
   const tableHeading=content.items.find(x=>x.str===section.head[1]);assert(tableHeading);assert(tableHeading.transform[5]<headings[0].transform[5]-5);
  }
  await pdf.destroy();
 }
});
