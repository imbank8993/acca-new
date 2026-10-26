const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const box={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/lib/jadwal-pdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{module:box,exports:box.exports,require,console});
const rows=[],master=[],waktuMap={};
for(let g=1;g<=18;g++)master.push({nip:String(g),nama_guru:`Guru ${g} Nama Lengkap, S.Pd., M.Pd.`,kode_guru:String(g),nama_mapel:`Mata Pelajaran ${g}`,kode_mapel:`MP${g}`});
for(const hari of ['Senin','Selasa'])for(let jam=1;jam<=10;jam++){waktuMap[`${hari}|${jam}`]='07:00 - 07:45';for(let c=1;c<=12;c++){const m=master[(jam+c)%18];rows.push({nip:m.nip,nama_guru:m.nama_guru,mapel:m.nama_mapel,hari,jam_ke:String(jam),kelas:`XI ${c}`});}}
const options={type:'mengajar',berlaku:'2026-08-09',master,waktuMap,sortColumns:c=>c.sort((a,b)=>a.localeCompare(b,'id',{numeric:true}))};
const doc=box.exports.createJadwalPdf(rows,options);assert.equal(doc.getNumberOfPages(),4);assert.equal(Buffer.from(doc.output('arraybuffer')).subarray(0,4).toString(),'%PDF');
assert.throws(()=>box.exports.createJadwalPdf(rows,{...options,search:'TIDAK ADA'}),/Tidak ada jadwal/);
const filtered=box.exports.createJadwalPdf(rows,{...options,selectedKelas:'XI 1'});assert.equal(filtered.getNumberOfPages(),2);
console.log('Generated',doc.getNumberOfPages(),'pages; empty filter validated.');
