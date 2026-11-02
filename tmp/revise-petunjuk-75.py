from pathlib import Path
import hashlib, json

ROOT=Path(__file__).resolve().parent.parent
sop_path=Path(r'D:\TW 3 Akademik\SOP_Program_Remedial_Pengayaan_dan_Klinik_Pembelajaran_MAN_IC_Gowa.pdf')
sop_before=hashlib.sha256(sop_path.read_bytes()).hexdigest()
authoring_text=(ROOT/'tmp/build-sop-tabel.py').read_text(encoding='utf8')
# Load shared typography/data only; never execute the SOP authoring block.
prefix=authoring_text[:authoring_text.index('# Standard operating procedure:')]
exec(compile(prefix,str(ROOT/'tmp/build-sop-tabel.py'),'exec'))

# Unboxed page headings; retain the same vertical spacing as the table titles.
def unboxed_page(self,title):
 if self.n:self.closepage()
 self.n+=1;self.y=TOP;kop(self.c)
 heading=p(title,'title');_,height=heading.wrap(U-12,2000)
 heading.drawOn(self.c,L+6,self.y-6-height)
 self.y-=height+24
Document.page=unboxed_page

def july_signatures(self):
 top=self.y
 for xx,role,name in [(L+6,'Mengetahui,\nKepala Madrasah,','Dr. Burhanuddin, S.Ag., M.Fil.I.\nNIP 197609152007101001'),(L+350,'Gowa, 13 Juli 2026\nWKM Akademik,','Imran, S.Si.\nNIP 199309082019031013')]:
  for text,offset in [(role,6),(name,88)]:
   paragraph=p(text);_,height=paragraph.wrap(186 if xx>L+6 else 300,2000)
   paragraph.drawOn(self.c,xx,top-offset-height)
 self.y-=136
Document.signatures=july_signatures

policy[0]=['Waktu dan durasi','Di luar jam pembelajaran reguler, paling singkat 75 menit setiap kegiatan; jadwal ditetapkan oleh WKM Akademik.']
for row in mainmatrix:
 row[1]='16.15-17.30' if row[0]=='Jumat' else '16.00-17.15'
 row[2]='75 menit'
nightmatrix[0]=['Senin-Rabu','20.30-21.45','Cadangan 75 menit sesuai kebutuhan; dikoordinasikan dengan keasramaan.']
nightmatrix[1]=['Kamis','20.45-22.00','Cadangan 75 menit setelah KIR kelas X A dan X B selesai pukul 20.40; dikoordinasikan dengan keasramaan.']
nightmatrix[3]=['Sabtu dan Minggu','Sesuai penetapan','Paling singkat 75 menit; kalender dan kegiatan asrama diperiksa sebelum penetapan.']
schedulechecks[0]=['1','Kegiatan berlangsung paling singkat 75 menit di luar jam pembelajaran reguler.']
clinicrules.insert(0,['Durasi kegiatan','Paling singkat 75 menit untuk setiap kegiatan; waktu mulai dan selesai dicantumkan dalam pengajuan.'])

# Check all proposed programme windows against regular and exceptional PBM.
windows=[]
for row in mainmatrix:
 begin,end=row[1].replace('.',':').split('-')
 assert minutes(end)-minutes(begin)>=75
 windows.append((row[0],begin,end))
windows.extend([(day,'20:30','21:45') for day in ['Senin','Selasa','Rabu']])
windows.append(('Kamis','20:45','22:00'))
for day,begin,end in windows:
 assert minutes(end)-minutes(begin)>=75
 assert not any(minutes(begin)<minutes(r['end']) and minutes(end)>minutes(r['start']) for r in reg+exc if r['hari']==day)

guide_code=authoring_text[authoring_text.index('# Detailed instructions:'):authoring_text.index("(ROOT/'tmp/sop-table-layout.json')")]
guide_code=guide_code.replace("caption='JADWAL UTAMA DI LUAR PEMBELAJARAN REGULER'","caption='JADWAL UTAMA - 75 MENIT PER KEGIATAN'")
guide_code=guide_code.replace("caption='JADWAL CADANGAN DAN PENGGANTI'","caption='JADWAL CADANGAN DAN PENGGANTI - MINIMAL 75 MENIT'")
guide_code=guide_code.replace("['Lama kegiatan','Dicatat dalam menit pelaksanaan sebenarnya.']","['Lama kegiatan','Paling singkat 75 menit; lama pelaksanaan sebenarnya dicatat dalam jurnal dan laporan.']")
guide_code=guide_code.replace("['20 menit','Memberi contoh, diskusi dan bantuan bertahap.'","['25 menit','Memberi contoh, diskusi dan bantuan bertahap.'")
guide_code=guide_code.replace("['20 menit','Latihan mandiri atau penyelidikan singkat.'","['25 menit','Latihan mandiri atau penyelidikan singkat.'")
guide_code=guide_code.replace("['10 menit','Umpan balik, refleksi dan rencana asesmen ulang.'","['15 menit','Umpan balik, refleksi dan rencana asesmen ulang.'")
guide_code=guide_code.replace('CONTOH SUSUNAN BIMBINGAN 60 MENIT','CONTOH SUSUNAN BIMBINGAN 75 MENIT')
guide_code=guide_code.replace("['Bimbingan 45 menit','Kurangi jumlah contoh atau bagi materi menjadi dua kegiatan.']","['Durasi bimbingan','Paling singkat 75 menit; dapat diperpanjang sesuai kebutuhan dan ketersediaan waktu.']")
guide_code=guide_code.replace("['Tanggal / waktu / ruang','']","['Tanggal / waktu / durasi / ruang','']")
assert 10+25+25+15==75
exec(compile(guide_code,'petunjuk-75-menit','exec'))
assert hashlib.sha256(sop_path.read_bytes()).hexdigest()==sop_before
(ROOT/'tmp/petunjuk-75-validation.json').write_text(json.dumps({'guide_pages':guide.n,'sop_sha256':sop_before,'minimum_minutes':75,'programme_windows':windows,'breakdown_minutes':[10,25,25,15],'schedule_conflicts':0,'guide_layout':guide.pages},indent=2),encoding='utf8')
print('SOP tetap; seluruh kegiatan program minimal 75 menit; tidak ada benturan PBM terpetakan.')
