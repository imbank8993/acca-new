const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),ts=require('typescript');
const {PDFDocument}=require('pdf-lib');
function load(file,imports={},globals={},source){const box={exports:{}};vm.runInNewContext(ts.transpileModule(source||fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:box,exports:box.exports,Date,console,...globals,require:n=>imports[n]||require(n)});return box.exports;}
const logo=load('apps/web/lib/branding-logo.ts');
const header=load('apps/web/lib/pdf-report-header.ts',{'./branding-logo':logo});
const {buildAbsensiReportData,createAbsensiPdf}=load('apps/web/lib/absensi-pdf.ts',{'./pdf-report-header':header});
const options={tahunAjaran:'2026/2027',today:'2026-10-26',timezone:'Asia/Makassar'};
function fixture(count=18){
 const students=Array.from({length:count},(_,i)=>({nisn:'00'+String(i+1).padStart(8,'0'),nama_snapshot:i===0?'Siswa Contoh dengan Nama yang Cukup Panjang':'Siswa Contoh '+String(i+1).padStart(2,'0')}));
 const sessions=Array.from({length:30},(_,i)=>{const date='2026-09-'+String(i+1).padStart(2,'0');return{sesi_id:'rekap-X A-'+date,tanggal:date,kelas:'X A',absensi_detail:students.map((s,j)=>({...s,status:j===0&&i>=1&&i<=3?'IZIN':j===1&&i===8?'SAKIT':j===2&&i===16?'ALPHA':'HADIR'}))};});
 return{sessions,holidays:[{tanggal:'2026-09-08',keterangan:'Kegiatan madrasah'}],ketidakhadiran:[{nisn:students[0].nisn,kelas:'X A',jenis:'IZIN',status:'MADRASAH',tgl_mulai:'2026-09-02',tgl_selesai:'2026-09-04',keterangan:'Mengikuti kegiatan madrasah di luar sekolah dengan pendampingan. Rincian ini ditampilkan satu kali untuk rentang izin.'},{nisn:students[0].nisn,kelas:'X A',jenis:'SAKIT',tgl_mulai:'2026-08-01',tgl_selesai:'2026-08-02',keterangan:'Outside selected period'}]};
}
test('monthly data preserves H default, explicit absence, holidays, weekends, and one permit appendix',()=>{
 const data=buildAbsensiReportData(fixture(),options);const r=data.reports[0];
 const student=r.rows.find(s=>s.nisn==='0000000001');
 assert.equal(r.rows.length,18);assert(student);assert.equal(student.counts.A,0);assert.equal(student.counts.I,3);
 assert.equal(student.cells[4],'-');assert.equal(student.cells[7],'L');assert.equal(student.cells[0],'H');
 assert.equal(data.notes.length,3);assert.equal(data.notes.filter(n=>n.jenis.startsWith('Izin')).length,1);assert(!JSON.stringify(data.notes).includes('Outside selected period'));
});
test('future dates and draft sessions do not become attendance; duplicate student rows collapse',()=>{
 const data=fixture();data.sessions.push({...data.sessions[0],sesi_id:'draft',status_sesi:'DRAFT',kelas:'Wrong class'});
 data.sessions.push({...data.sessions[0],sesi_id:'rekap-X A-2026-10-27',tanggal:'2026-10-27'});
 data.sessions[0].absensi_detail.push({...data.sessions[0].absensi_detail[0]});
 const built=buildAbsensiReportData(data,options);assert.equal(built.reports.length,2);assert.equal(built.reports[0].rows.length,18);
 const future=built.reports[1].rows[0];assert.equal(future.cells[26],'');assert.equal(future.counts.A,0);assert.equal(future.counts.H,18);
});
test('all generated pages use A4 landscape and large rosters paginate',async()=>{
 const doc=createAbsensiPdf(fixture(85),options);const pdf=await PDFDocument.load(doc.output('arraybuffer'));
 assert(pdf.getPageCount()>=3);for(const page of pdf.getPages()){const size=page.getSize();assert(Math.abs(size.width-841.89)<1);assert(Math.abs(size.height-595.28)<1);}
});
test('PDF text includes monthly table, single appendix, page numbers and no spreadsheet duplicate heading',async()=>{
 const doc=createAbsensiPdf(fixture(),options);const bytes=new Uint8Array(doc.output('arraybuffer'));
 const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');const task=pdfjs.getDocument({data:bytes,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep});const pdf=await task.promise;
 let text='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();text+=content.items.map(i=>i.str).join(' ')+' ';}
 assert(text.includes('DAFTAR HADIR SISWA'));assert(text.includes('KETERANGAN KETIDAKHADIRAN'));assert(text.includes('0000000001'));assert(text.includes('Halaman 1 dari'));
 assert.equal(text.split('Mengikuti kegiatan madrasah').length-1,1);assert(!text.includes('CATATAN IZIN / SAKIT / ALPHA'));
 await pdf.destroy();
 const output=path.join(os.tmpdir(),'acca-absensi-wali-kelas-a4.pdf');fs.writeFileSync(output,bytes);console.log('PDF preview: '+output);
});
for(const mode of ['GURU','ADMIN','WALI']) test(`${mode} export defaults to PDF and respects class/month selection without loading Excel`,async()=>{
 const file='apps/web/app/absensi/components/ExportModal.tsx';
 const source=fs.readFileSync(file,'utf8').replace('const generateWorksheet =','module.exports.performExportRequest = performExportRequest; return null; const generateWorksheet =');
 let filename='',closed=0,received,requestBody;
 const module=load(file,{
  react:{useState:v=>[v,()=>{}],useEffect:()=>{}},
  sweetalert2:{fire:()=>{}},
  '@/components/ui/Modal':{},'@/components/ui/Button':{},'@/components/ui/InlineSelect':{},'@/components/ui/MultiSelectDropdown':{},
  '@/lib/absensi-pdf':{createAbsensiPdf:(payload,options)=>{received={payload,options};return{save:name=>{filename=name;}};}},
  '@/lib/timezone':{getTimezone:async()=> 'Asia/Makassar'},
  'xlsx-js-style':new Proxy({},{get(){throw Error('Excel code should never load for PDF');}}),
 },{fetch:async(url,init)=>{requestBody=JSON.parse(init.body);const data=fixture().sessions.map(s=>({...s,sesi_id:mode==='GURU'?s.sesi_id.replace('rekap-','session-'):s.sesi_id,status_sesi:'FINAL'}));return{ok:true,json:async()=>({ok:true,data:[...data,{...data[0],kelas:'Unselected'},{...data[0],tanggal:'2026-10-01'}],holidays:[],ketidakhadiran:[]})};}},source);
 module.default({isOpen:true,onClose:()=>{closed++;},userRole:mode,namaGuru:'Guru Contoh',nip:'001'});
 await module.performExportRequest({year:'2026/2027',kelas:['X A'],mode,months:[9]});
 assert.equal(filename,`Absensi_X_A${mode==='GURU'?'_Guru_Contoh':''}_2026-2027.pdf`);assert.equal(closed,1);assert.equal(received.options.timezone,'Asia/Makassar');assert.equal(received.payload.sessions.length,30);assert.equal(received.options.mode,mode);assert.deepEqual(requestBody.months,[9]);assert.equal(received.options.namaGuru,mode==='GURU'?'Guru Contoh':undefined);
});

test('teacher and multi-class admin PDFs retain readable identity and separate monthly class tables',async()=>{
 const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
 for(const mode of ['GURU','ADMIN']){
  const payload=fixture();payload.sessions=payload.sessions.map(s=>({...s,sesi_id:s.sesi_id.replace('rekap-','session-'),status_sesi:'FINAL',mapel:'Matematika'}));
  if(mode==='ADMIN')payload.sessions.push(...payload.sessions.map(s=>({...s,sesi_id:'other-'+s.sesi_id,kelas:'X B'})));
  const doc=createAbsensiPdf(payload,{...options,mode,namaGuru:'Guru Contoh',nip:'001'});const bytes=new Uint8Array(doc.output('arraybuffer'));
  const pdf=await pdfjs.getDocument({data:bytes,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep}).promise;
  let text='';for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i),content=await page.getTextContent(),part=content.items.map(x=>x.str).join(' ');text+=part;
   assert(part.includes(mode==='GURU'?'Guru Contoh':'Admin'));
   assert(part.includes('Mata pelajaran'));assert(part.includes('Matematika'));
   const headerColons=content.items.filter(item=>item.str===':'&&item.transform[5]>page.view[3]-90);
   assert.equal(new Set(headerColons.map(item=>Math.round(item.transform[4]*100)/100)).size,2);
   for(const item of content.items){assert(item.transform[4]>=20);assert(item.transform[4]+item.width<=page.view[2]-15);assert(item.transform[5]>=15);}
  }
  assert(text.includes('X A'));if(mode==='ADMIN')assert(text.includes('X B'));
  await pdf.destroy();fs.writeFileSync(path.join(os.tmpdir(),`acca-absensi-${mode.toLowerCase()}-a4.pdf`),bytes);
 }
});

test('subject names come from final sessions in each class and month without duplicates or recap labels',()=>{
 const payload=fixture();const base={...payload.sessions[0],sesi_id:'lesson',status_sesi:'FINAL',mapel:' Matematika '};
 payload.sessions=[base,{...base,sesi_id:'lesson2',mapel:'Matematika'},{...base,sesi_id:'lesson3',mapel:'Informatika'},
  {...base,sesi_id:'lesson4',kelas:'X B',mapel:'Biologi'},{...base,sesi_id:'lesson5',tanggal:'2026-10-01',mapel:'Fisika'},
  {...base,sesi_id:'draft',status_sesi:'DRAFT',mapel:'Draft subject'},{...base,sesi_id:'rekap-test',mapel:'REKAPITULASI'}];
 const {reports}=buildAbsensiReportData(payload,options);
 assert.deepEqual(Array.from(reports.find(r=>r.kelas==='X A'&&r.month==='2026-09').mapelNames),['Informatika','Matematika']);
 assert.deepEqual(Array.from(reports.find(r=>r.kelas==='X A'&&r.month==='2026-10').mapelNames),['Fisika']);
 assert.deepEqual(Array.from(reports.find(r=>r.kelas==='X B').mapelNames),['Biologi']);
});
