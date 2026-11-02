import json,html,math,datetime,collections
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Table,TableStyle,Spacer,PageBreak,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parent.parent
x=json.loads((ROOT/'tmp/sop-program-source.json').read_text(encoding='utf8'))
DATE='31 Oktober 2026';DAYS=['Senin','Selasa','Rabu','Kamis','Jumat']
versions=[v for v in x['versions'] if v['berlaku_mulai']<='2026-10-31'];base=[v for v in versions if v['jenis']=='penuh'][-1]
per=collections.defaultdict(list)
slot=lambda r:(r['kelas'].strip(),r['hari'].strip(),int(r['jam_ke']))
for r in x['schedule']:
 if r['aktif'] and r['versi_id']==base['id']:per[slot(r)].append(r)
for v in versions:
 if v['jenis']=='parsial' and v['berlaku_mulai']>=base['berlaku_mulai']:
  patch=[r for r in x['schedule'] if r['aktif'] and r['versi_id']==v['id']]
  for k in set(slot(r) for r in patch):per[k]=[]
  for r in patch:per[slot(r)].append(r)
schedule=[r for rows in per.values() for r in rows]
cls={c['nama']:c for c in x['classes']};reg=[];exc=[]
minutes=lambda s:int(s[:2])*60+int(s[3:5])
for r in schedule:
 prog=cls.get(r['kelas'],{}).get('program') or 'Reguler'
 ts=[t for t in x['times'] if t['aktif'] and not t['is_istirahat'] and t['hari']==r['hari'] and str(t['jam_ke'])==str(r['jam_ke']) and (t['program'] or 'Reguler')==prog]
 assert len(ts)==1,(r,ts)
 z={**r,'start':ts[0]['mulai'][:5],'end':ts[0]['selesai'][:5]}
 z['exception']='Malam' if minutes(z['start'])>=18*60 else ('PJOK pagi' if r['mata_pelajaran'].strip().casefold()=='pjok' and minutes(z['start'])<7*60+30 else None)
 (exc if z['exception'] else reg).append(z)
bounds={day:(min(r['start'] for r in reg if r['hari']==day),max(r['end'] for r in reg if r['hari']==day)) for day in DAYS}
matrix=[
 ['Senin','16.00-17.00','60 menit','Remedial / Klinik kelas X','Guru mapel / pengampu klinik','Ruang belajar yang dipesan'],
 ['Selasa','16.00-17.00','60 menit','Remedial / Klinik kelas XI, termasuk peminatan','Guru mapel / pengampu klinik','Ruang belajar/laboratorium yang dipesan'],
 ['Rabu','16.00-17.00','60 menit','Remedial / Klinik kelas XII','Guru mapel / pengampu klinik','Ruang belajar/laboratorium yang dipesan'],
 ['Kamis','16.00-17.00','60 menit','Pengayaan lintas tingkat menurut TP','Guru mapel; kelompok terpisah','Ruang belajar yang dipesan'],
 ['Jumat','16.15-17.15','60 menit','Asesmen ulang / penyelesaian rujukan remedial','Guru mapel / pengampu klinik','Ruang belajar yang dipesan'],
]
night=[
 ['Senin-Rabu','20.30-21.30','Cadangan Klinik / remedial, sesuai kebutuhan','Di luar PBM reguler; cek kegiatan asrama, ibadah, guru dan peserta.'],
 ['Kamis','20.45-21.30','Cadangan bersyarat, 45 menit','X A/X B selesai KIR 20.40; sediakan transisi. Peserta/pengampu tidak boleh rangkap.'],
 ['Jumat','Tidak menjadi slot rutin','Pengecualian malam','X C/X D mengikuti KIR sampai 21.20. Jangan menggeser layanan terlalu larut; gunakan slot sore atau hari lain.'],
 ['Sabtu/Minggu','Tidak menjadi slot rutin','Pengganti bila ditetapkan','Tidak adanya baris PBM bukan jaminan bebas kegiatan. Perlu telaah kalender dan asrama.'],
]
for row in matrix:
 start,end=[a.replace('.',':') for a in row[1].split('-')]
 assert not any(minutes(start)<minutes(r['end']) and minutes(end)>minutes(r['start']) for r in reg+exc if r['hari']==row[0])
for day in DAYS[:3]:assert not any(1230<minutes(r['end']) and 1290>minutes(r['start']) for r in reg+exc if r['hari']==day)
assert not any(1245<minutes(r['end']) and 1290>minutes(r['start']) for r in reg+exc if r['hari']=='Kamis')
assert len(reg)+len(exc)==len(schedule)==620
for h in x['holidays']:assert not ('2026-11-02'<=h['tanggal']<='2026-11-06'),h
audit={'version':base,'schedule_rows':len(schedule),'regular_rows':len(reg),'exception_rows':len(exc),'bounds':bounds,'matrix':matrix,'clinic_status':dict(collections.Counter(c['status'] for c in x['clinics'])),'missing_time_mappings':0,'planned_slot_pbm_conflicts':0,'example_week':'2-6 November 2026','example_week_master_holiday_rows':0}
(ROOT/'tmp/sop-program-validation.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(audit,ensure_ascii=False))

styles=getSampleStyleSheet()
for name,font,size,lead in [('SOP','Helvetica',7,8.2),('SOPB','Helvetica-Bold',7,8.2),('BodyID','Helvetica',10,13.5),('SmallID','Helvetica',8.5,11),('CellID','Helvetica',8.5,11),('HeadID','Helvetica-Bold',8.5,10.5),('TitleID','Helvetica-Bold',14,18),('SubID','Helvetica-Bold',11,14)]:
 styles.add(ParagraphStyle(name=name,fontName=font,fontSize=size,leading=lead,spaceAfter=5 if name in ['BodyID','SmallID'] else 0,alignment=TA_CENTER if name in ['TitleID','HeadID'] else 0))
def p(t,style='BodyID'):return Paragraph(html.escape(str(t)).replace('\n','<br/>'),styles[style])
styles.add(ParagraphStyle(name='SOPH',fontName='Helvetica-Bold',fontSize=6,leading=7,alignment=TA_CENTER))
styles['TitleID'].spaceAfter=14
styles['SubID'].alignment=TA_CENTER
styles['SubID'].spaceBefore=6
styles['SubID'].spaceAfter=7
styles['BodyID'].fontSize=10.5
styles['BodyID'].leading=14
styles['BodyID'].spaceAfter=8
styles['SmallID'].fontSize=9
styles['SmallID'].leading=12
styles['SmallID'].spaceAfter=7
styles['CellID'].fontSize=9
styles['CellID'].leading=12
styles['HeadID'].fontSize=9
styles['HeadID'].leading=11.5
styles.add(ParagraphStyle(name='CenterID',parent=styles['BodyID'],alignment=TA_CENTER))
styles.add(ParagraphStyle(name='SignID',fontName='Helvetica',fontSize=10,leading=13,alignment=0))
def drawpara(c,text,xpos,ytop,width,style='SOP',maxheight=None):
 q=p(text,style);w,h=q.wrap(width,2000)
 if maxheight:assert h<=maxheight+.1,(h,maxheight,text[:100])
 q.drawOn(c,xpos,ytop-h);return h
greenlogo=ImageReader(str(ROOT/'tmp/sop-logo-0.png'))
def line(c,text,xpos,ypos,size=8,bold=False):c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(xpos,ypos,text)
def foot(c,page,label,W):
 c.setFont('Helvetica',7);c.setFillColor(colors.HexColor('#444444'));c.drawString(36,22,label);c.drawRightString(W-36,22,str(page));c.setFillColor(colors.black)
def header(c,W,H,short=False):
 c.drawImage(greenlogo,38,H-91,width=45,height=53,preserveAspectRatio=True,mask='auto')
 cx=(91+W-36)/2
 for text,y,sz,bold in [('KEMENTERIAN AGAMA REPUBLIK INDONESIA',43,10,1),('KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA',56,9.3,1),('MADRASAH ALIYAH NEGERI INSAN CENDEKIA GOWA',70,10.5,1),('Jalan Pendidikan Nomor 1, Sunggumanai, Desa Belapunranga, Kecamatan Parangloe',83,7,0),('Kabupaten Gowa, Sulawesi Selatan 92179 | Pos-el: insancendekiagowa@gmail.com | Laman: icgowa.sch.id',94,6.8,0)]:
  c.setFont('Helvetica-Bold' if bold else 'Helvetica',sz);c.drawCentredString(cx,H-y,text)
 c.setLineWidth(1);c.line(36,H-104,W-36,H-104);c.setLineWidth(.3);c.line(36,H-107,W-36,H-107)
def ctable(c,xpos,ytop,width,head,rows,ratios,style='SOP',caption=None):
 data=([[p(caption,'SOPB')]+['']*(len(head)-1)] if caption else [])+[[p(v,'SOPB') for v in head]]+[[p(v,style) for v in row] for row in rows]
 t=Table(data,colWidths=[width*w/sum(ratios) for w in ratios]);ts=[('GRID',(0,0),(-1,-1),.4,colors.black),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]
 ts.append(('BACKGROUND',(0,0),(-1,1 if caption else 0),colors.HexColor('#f0f2f5')))
 if caption:ts.append(('SPAN',(0,0),(-1,0)))
 t.setStyle(TableStyle(ts));_,h=t.wrap(width,2000);assert ytop-h>36,(ytop,h,head);t.drawOn(c,xpos,ytop-h);return ytop-h

legal=[
 'UU No. 20 Tahun 2003 tentang Sistem Pendidikan Nasional.',
 'PP No. 57 Tahun 2021 jo. PP No. 4 Tahun 2022 tentang Standar Nasional Pendidikan.',
 'Permendikbudristek No. 21 Tahun 2022 tentang Standar Penilaian Pendidikan.',
 'Permendikdasmen No. 1 Tahun 2026 tentang Standar Proses.',
 'KMA No. 450 Tahun 2024 jo. KMA No. 1503 Tahun 2025 tentang implementasi kurikulum madrasah.',
 'PermenPANRB No. 35 Tahun 2012 tentang pedoman penyusunan SOP Administrasi Pemerintahan.'
]
refs=[
 ('KMA 1503/2025, terutama Bab IV Pembelajaran dan Asesmen.','https://sulteng.kemenag.go.id/index.php/files/show/20251020162801surat-penyampaian-kma-kurikulum-2025%2Blampiran_compressed-tzR.pdf'),
 ('Permendikdasmen 1/2026, terutama Pasal 2-8, 9-14 dan 20.','https://peraturan.bpk.go.id/Download/407441/Permendikdasmen-no-1-tahun-2026.pdf'),
 ('Standar penilaian: rujukan Permendikbudristek 21/2022 pada laman PSKP.','https://pskp.kemendikdasmen.go.id/standar-nasional-pendidikan-a/standar-proses'),
 ('Panduan Pembelajaran dan Asesmen, revisi 2025: KKTP, remedial, pengayaan.','https://kurikulum.kemendikdasmen.go.id/file/1755668120_manage_file.pdf'),
 ('PermenPANRB 35/2012: format dan simbol SOP AP.','https://peraturan.bpk.go.id/Home/Download/123614/PERMENPAN%20NOMOR%2035%20TAHUN%202012.pdf')]
clinicpaths=[
 ['Guru','Buka Jadwal Klinik - isi mapel, topik/TP, tanggal, jam, ruang, kuota, target tingkat dan peserta yang ditugaskan bila ada. Kirim Pengajuan.','Menunggu Admin - petugas Approval Sesi memeriksa dan menyetujui/menolak. Jika disetujui, sesi dibuka untuk pendaftaran sesuai kuota.'],
 ['Kelompok siswa','Ajukan Kelompok - Ajukan Klinik Kelompok. Pilih guru pengampu dan minimal satu teman seangkatan. Pengaju ikut menjadi peserta; pengajuan maksimal 12 siswa.','Menunggu Guru - guru yang dipilih menyatakan bersedia/menolak. Jika bersedia: Menunggu Admin - Approval Sesi. Kelompok minimal dua peserta saat disetujui.'],
 ['Akademik / pengelola','Kelola Sesi - Buat Sesi Klinik. Petugas yang diberi kewenangan memilih guru, mapel, topik, jadwal, ruang, kuota dan peserta.','Sesi dibuat langsung Dibuka atau Penuh sesuai keterisian. Verifikasi jadwal dan kesediaan guru dilakukan sebelum menyimpan; tidak melewati antrean pengajuan guru/siswa.'],
]
clinicafter=[
 ['Peserta dan pelaksanaan','Siswa mendaftar melalui Klinik Tersedia saat sesi Dibuka; peserta yang ditugaskan guru/pengelola sudah tercantum. Periksa target tingkat, kapasitas, jadwal dan daftar peserta sebelum pelaksanaan.'],
 ['Kehadiran','Gunakan Saya Hadir untuk absensi mandiri atau Isi Absensi oleh guru/pengelola. H/S/I/A dibedakan dari belum diabsen. Pendaftaran bukan bukti hadir.'],
 ['Laporan guru','Guru membuka Bukti Pembelajaran Klinik, mengisi Materi & hasil pembelajaran, melampirkan dokumentasi, lalu Ajukan Laporan. Aplikasi memerlukan minimal dua peserta terdaftar; jumlah hadir tetap diperiksa melalui absensi.'],
 ['Pemeriksaan laporan','Laporan diajukan berstatus Submitted dan sesi menjadi Selesai. Petugas pada Laporan memeriksa: setujui menjadi Approved, atau kembalikan Revisi dengan catatan. Selesai belum berarti laporan disahkan atau TP tercapai.'],
 ['Perbaikan dan penutupan','Guru memperbaiki bukti lalu Ajukan Ulang jika Revisi. Setelah pengesahan, arsipkan rekap. Guru mapel tetap melakukan asesmen ulang per TP dan menetapkan tindak lanjut remedial/pengayaan.'],
]

# Formal SOP: exact 612 x 936 pt paper and information/flow structure of the reference.
outdir=ROOT/'output/pdf';outdir.mkdir(exist_ok=True,parents=True)
sopfile=outdir/'SOP_Program_Remedial_Pengayaan_dan_Klinik_Pembelajaran_MAN_IC_Gowa.pdf'
c=canvas.Canvas(str(sopfile),pagesize=(612,936));c.setTitle('SOP Program Remedial, Pengayaan, dan Klinik Pembelajaran');c.setAuthor('MAN Insan Cendekia Gowa')
L=36;R=576;U=540;top=900;left=338;right=202
c.setLineWidth(.5);c.rect(L,top-96,U,96);c.line(L+left,top,L+left,top-96)
c.drawImage(greenlogo,53,top-61,width=42,height=48,preserveAspectRatio=True,mask='auto')
for txt,dy,sz,b in [('KEMENTERIAN AGAMA REPUBLIK INDONESIA',15,7.5,1),('KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA',27,7,1),('MADRASAH ALIYAH NEGERI INSAN CENDEKIA GOWA',39,7.4,1),('Jalan Pendidikan Nomor 1, Sunggumanai, Desa Belapunranga,',51,5.8,0),('Kecamatan Parangloe, Kabupaten Gowa, Sulawesi Selatan, 92179',61,5.8,0),('Pos-el: insancendekiagowa@gmail.com | Laman: icgowa.sch.id',71,5.8,0),('Nomor WhatsApp: 085173279846',81,5.8,0)]:
 c.setFont('Helvetica-Bold' if b else 'Helvetica',sz);c.drawCentredString(L+218,top-dy,txt)
for i,(lab,val) in enumerate([('Nomor SOP','Diisi pada registrasi'),('Tanggal Pembuatan',DATE),('Tanggal Revisi','-'),('Tanggal Efektif','Setelah ditetapkan')]):
 y=top-i*10;c.line(L+left,y-10,R,y-10);line(c,lab,L+left+3,y-7,5.8,1);line(c,val,L+left+71,y-7,5.8)
for xx,role,name,nip in [(L+left+50.5,'Mengetahui, Kepala Madrasah','Dr. Burhanuddin, S.Ag., M.Fil.I.','197609152007101001'),(L+left+151.5,'WKM Akademik','Imran, S.Si.','199309082019031013')]:
 c.setFont('Helvetica',6);c.drawCentredString(xx,top-49,role)
 c.setFont('Helvetica-Bold',6.2);c.drawCentredString(xx,top-81,name)
 c.setFont('Helvetica',6);c.drawCentredString(xx,top-90,'NIP '+nip)
y=top-96;c.rect(L,y-18,U,18);c.setFont('Helvetica-Bold',8);c.drawCentredString(306,y-11,'SOP PROGRAM REMEDIAL, PENGAYAAN, DAN KLINIK PEMBELAJARAN')
y-=18
for h,a,b in [
 (112,'Dasar Hukum\n'+'\n'.join(f'{i}. {s}' for i,s in enumerate(legal,1)),'Kualifikasi Pelaksana\n1. Memahami CP, TP, KKTP dan analisis hasil belajar.\n2. Guru/pengampu sesuai penugasan.\n3. Mampu membimbing dan menilai kemajuan.\n4. Memahami pemeriksaan jadwal serta pencatatan layanan.'),
 (48,'Keterkaitan\n1. SOP penyusunan jadwal PBM.\n2. SOP penilaian hasil belajar.\n3. Pengelolaan Klinik Pembelajaran dan kegiatan asrama.','Peralatan/perlengkapan\nData nilai, CP/TP/KKTP, jadwal PBM, daftar peserta, perangkat bimbingan/asesmen, ruang dan aplikasi klinik.'),
 (42,'Peringatan\nLayanan dilakukan di luar PBM reguler. Jadwal malam dan PJOK pagi adalah pengecualian yang tetap diperiksa agar guru/peserta tidak rangkap. Nilai kosong perlu klarifikasi sebelum rujukan.','Pencatatan dan pendataan\nRujukan TP, jadwal sah, kehadiran, jurnal bimbingan, asesmen ulang/proyek, serta tindak lanjut. Klinik remedial dicatat sebagai bagian program.')]:
 c.rect(L,y-h,U,h);c.line(L+left,y,L+left,y-h);drawpara(c,a,L+3,y-3,left-6,'SOP',h-5);drawpara(c,b,L+left+3,y-3,right-6,'SOP',h-5);y-=h

steps=[
 ('Menganalisis hasil belajar dan TP yang belum/sudah tercapai.',3,'Nilai, TP, KKTP','1 hari','Peta kebutuhan','Mulai'),
 ('Mendiagnosis kesulitan dan menyusun rujukan/kelompok layanan.',3,'Peta kebutuhan','1 hari','Rujukan TP','Remedial / pengayaan'),
 ('Menyusun sesi di luar PBM reguler; cek pengecualian dan ruang.',1,'PBM, daftar peserta','1 hari','Draf jadwal','Lihat matriks'),
 ('Apakah jadwal layak dan bebas bentrok?',1,'Draf, kalender asrama','1 hari','Hasil verifikasi','Ya: 5; Tidak: 3'),
 ('Menetapkan jadwal, pengampu dan penanggung jawab.',1,'Jadwal terverifikasi','1 hari','Penetapan program','WKM Akademik'),
 ('Memproses pengajuan klinik, persetujuan dan peserta sesuai aplikasi.',2,'Rujukan, jadwal sah','1 hari','Daftar peserta','Lihat alur klinik'),
 ('Melaksanakan remedial/klinik atau pengayaan sesuai TP.',3,'Perangkat, daftar hadir','Per sesi','Jurnal dan bukti','Di luar jam reguler'),
 ('Melaksanakan asesmen ulang atau penilaian produk pengayaan.',3,'Instrumen, rubrik','Per TP','Bukti terbaru','Sesudah bimbingan'),
 ('Apakah TP sasaran tercapai?',3,'Bukti terbaru, KKTP','1 hari','Keputusan TP','Ya: 10; Tidak: 2'),
 ('Melaporkan klinik dan memperbarui capaian TP.',3,'Hasil, jurnal klinik','1 hari','Rekap tindak lanjut','Approval laporan terpisah'),
 ('Memonitor layanan, kehadiran, benturan, dan kemajuan.',1,'Rekap program','Bulanan','Umpan balik','Koordinasi wali/asrama'),
 ('Menetapkan perbaikan program periode berikutnya.',0,'Laporan evaluasi','Semester','Tindak lanjut','Selesai')]
y-=10;flowtop=y;heads=34;rh=37;widths=[18,90]+[30]*5+[55,34,51,42];xs=[L]
for w in widths:xs.append(xs[-1]+w)
height=heads+len(steps)*rh;c.rect(L,y-height,U,height)
for j,X in enumerate(xs[1:-1],1):c.line(X,y-(12 if j in [3,4,5,6,8,9] else 0),X,y-height)
c.line(xs[2],y-12,xs[7],y-12);c.line(xs[7],y-12,xs[10],y-12);c.line(L,y-heads,R,y-heads)
for i in range(1,len(steps)):c.line(L,y-heads-i*rh,R,y-heads-i*rh)
for title,a,b in [('PELAKSANA',xs[2],xs[7]),('MUTU BAKU',xs[7],xs[10])]:c.setFont('Helvetica-Bold',6.5);c.drawCentredString((a+b)/2,y-8,title)
labels=['No','KEGIATAN','KAMAD','WKM\nAKAD.','KOOR.\nKLINIK','GURU\nMAPEL','WALI/\nASR.','KELENG-\nKAPAN','WAKTU','OUTPUT','KETE-\nRANGAN']
for j,t in enumerate(labels):drawpara(c,t,xs[j]+2,y-(16 if 2<=j<=9 else 11),widths[j]-4,'SOPH',18)
centers=[]
for i,(act,role,req,time,result,note) in enumerate(steps):
 yt=y-heads-i*rh;cy=yt-rh/2;cx=xs[2+role]+15;centers.append((cx,cy))
 for col,txt in [(0,str(i+1)),(1,act),(7,req),(8,time),(9,result),(10,note)]:drawpara(c,txt,xs[col]+2,yt-4,widths[col]-4,'SOP',rh-6)
for i in range(len(centers)-1):
 x1,y1=centers[i];x2,y2=centers[i+1];ym=(y1+y2)/2;c.setLineWidth(.5);c.lines([(x1,y1-8,x1,ym),(x1,ym,x2,ym),(x2,ym,x2,y2+8)]);c.line(x2,y2+8,x2-1.8,y2+11);c.line(x2,y2+8,x2+1.8,y2+11)
for i,(cx,cy) in enumerate(centers):
 if i in [3,8]:
  c.setFillColor(colors.HexColor('#4e89c5'));q=c.beginPath();q.moveTo(cx,cy+10);q.lineTo(cx+11,cy);q.lineTo(cx,cy-10);q.lineTo(cx-11,cy);q.close();c.drawPath(q,stroke=1,fill=1)
 elif i in [0,11]:c.setFillColor(colors.HexColor('#a8a8a8'));c.roundRect(cx-12,cy-6,24,12,5,stroke=1,fill=1)
 else:c.setFillColor(colors.HexColor('#f28a36'));c.rect(cx-11,cy-6,22,12,stroke=1,fill=1)
 c.setFillColor(colors.white);c.setFont('Helvetica-Bold',6.5);c.drawCentredString(cx,cy-2,str(i+1));c.setFillColor(colors.black)
for dec,dest in [(3,2),(8,1)]:
 cx,cy=centers[dec];dx,dy=centers[dest];lane=cx-14;c.setStrokeColor(colors.HexColor('#ba3030'));c.lines([(cx-11,cy,lane,cy),(lane,cy,lane,dy),(lane,dy,dx-11,dy)]);c.line(dx-11,dy,dx-14,dy+1.8);c.line(dx-11,dy,dx-14,dy-1.8);c.setStrokeColor(colors.black)
foot(c,1,'SOP Remedial, Pengayaan, dan Klinik | Rancangan untuk penetapan',612);c.showPage()

header(c,612,936);y=805;drawpara(c,'LAMPIRAN 1 - MATRIKS JADWAL DI LUAR PBM REGULER',36,y,U,'SubID');y-=28
drawpara(c,'Seluruh waktu dalam WITA. Matriks merupakan rancangan alokasi untuk ditetapkan madrasah; peserta, pengampu, dan ruang ditetapkan tiap pekan.',36,y,U,'SmallID');y-=36
y=ctable(c,36,y,U,['Hari','Waktu','Durasi','Layanan / sasaran','Pelaksana','Ruang'],matrix,[.65,.9,.65,2,1.6,1.6])
y-=22;drawpara(c,'Pilihan malam dan slot pengganti',36,y,U,'SubID');y-=22
y=ctable(c,36,y,U,['Hari','Waktu WITA','Peruntukan','Pengendalian'],night,[1,1.1,1.4,2.8]);y-=18
for t in [
 'Batas PBM reguler terpetakan: Senin 07.40-15.00; Selasa-Rabu 07.00-15.40; Kamis 07.00-15.40; Jumat 07.20-16.00. Ini rentang gabungan antarkelas, bukan durasi belajar setiap siswa.',
 'PJOK pagi dan jadwal malam dikeluarkan dari batas jam reguler sesuai pengaturan program. Keduanya tetap menjadi batas ketersediaan guru/peserta yang benar-benar terlibat.',
 'Prioritas pengampu/ruang/peserta ditentukan dari rujukan TP. Satu peserta hanya boleh mengikuti satu layanan pada waktu yang sama. Kelompok dapat paralel jika guru, peserta, dan ruang berbeda.',
 'Sesi dicatat dalam menit aktual, tidak otomatis diklaim sebagai JP tatap muka atau ekuivalensi beban kerja. Asrama, waktu ibadah, makan, istirahat dan kegiatan lain harus ditelaah sebelum publikasi.'
]:h=drawpara(c,t,36,y,U,'SmallID');y-=h+10
foot(c,2,'Lampiran matriks | Sumber jadwal: ACCA, pemeriksaan 31 Oktober 2026',612);c.showPage()

header(c,612,936);y=805;drawpara(c,'LAMPIRAN 2 - VERIFIKASI DAN PENGENDALIAN',36,y,U,'SubID');y-=28
exceptions=[['Selasa','06.00-07.20','PJOK kelas X A-X D'],['Rabu','06.00-07.20','PJOK kelas XI A-XI D'],['Jumat','06.00-07.20','PJOK kelas XII A-XII D'],['Kamis','20.00-20.40','KIR kelas X A/X B'],['Jumat','20.00-21.20','KIR kelas X C/X D']]
y=ctable(c,36,y,U,['Hari','Waktu pengecualian','Peserta terkait'],exceptions,[.8,1.3,3]);y-=18
checks=[
 ('1','Baca versi jadwal yang berlaku dan cocokkan waktu berdasarkan hari, jam, dan program kelas.'),
 ('2','Cek kelas reguler dan peminatan setiap peserta; jam kosong guru belum berarti siswa bebas.'),
 ('3','Cek PJOK pagi, kegiatan malam, asrama/ibadah/ekskul, tugas guru, ruang serta slot klinik pada tanggal nyata.'),
 ('4','Cek Master Libur sesuai tanggal, kelas/tingkat dan jam. Hari tidak efektif PBM bukan otomatis izin membuka sesi.'),
 ('5','Jika bentrok, ubah peserta/pengampu/ruang/waktu; minta penetapan WKM Akademik sebelum informasi dikirim.'),
 ('6','Arsipkan bukti verifikasi, jadwal sah, rujukan TP, kehadiran, jurnal, asesmen ulang dan evaluasi. Sesi batal harus dijadwalkan ulang.')]
y=ctable(c,36,y,U,['No','Daftar periksa wajib'],checks,[.4,5.8]);y-=18
drawpara(c,'Dasar data dan rujukan',36,y,U,'SubID');y-=20
txt='Basis data ACCA: Jadwal Guru, Versi Jadwal, Master Waktu, Master Kelas, Master Libur, dan Klinik Pembelajaran. Versi penuh berlaku 9 Agustus 2026: 620 baris aktif; 602 baris PBM reguler dan 18 baris pengecualian. Seluruh baris memperoleh pasangan waktu; matriks utama dan pilihan malam yang dicantumkan lolos uji tumpang tindih dengan jadwal yang dipetakan. Kegiatan non-PBM yang belum tercatat diperiksa melalui koordinasi.'
y-=drawpara(c,txt,36,y,U,'SmallID')+12
for label,url in refs:
 h=drawpara(c,label,36,y,U,'SmallID');y-=h+3;line(c,'Buka sumber resmi',36,y-7,7);c.linkURL(url,(36,y-9,140,y+2),relative=0);y-=22
drawpara(c,'Format mengacu pada SOP AKADEMIK 05 - Penilaian Hasil Belajar di folder SOP AKADEMIK. Nomor, tanggal efektif, dan pengesahan diisi melalui administrasi madrasah. Lampiran adalah bagian SOP.',36,y,U,'SmallID')
foot(c,3,'Rancangan siap telaah dan penetapan | 31 Oktober 2026',612);c.showPage()
header(c,612,936);y=805;drawpara(c,'LAMPIRAN 3 - ALUR KLINIK PEMBELAJARAN',36,y,U,'SubID');y-=30
y=ctable(c,36,y,U,['Jalur','Pengajuan / pembentukan sesi','Persetujuan / hasil'],clinicpaths,[.9,2.55,2.55]);y-=20
y=ctable(c,36,y,U,['Tahap lanjutan','Ketentuan'],clinicafter,[1.25,4.75]);y-=16
drawpara(c,'Kewenangan menu mengikuti Pengaturan Klinik: pembentukan sesi, Approval Sesi, pengesahan laporan dan rekap merupakan kewenangan yang terpisah. WKM Akademik mengoordinasikan program; petugas aplikasi menjalankan fungsi sesuai kewenangan yang diberikan. Pengajuan yang waktu mulainya sudah terlewati harus dijadwalkan ulang melalui pengajuan baru.',36,y,U,'SmallID')
foot(c,4,'Alur sesuai halaman Klinik ACCA | Pemeriksaan 31 Oktober 2026',612);c.save()

# Detailed guide, separate artifact in the same formal portrait paper size.
guide=outdir/'Petunjuk_Pelaksanaan_Remedial_Pengayaan_dan_Klinik_MAN_IC_Gowa.pdf'
story=[];WU=540
def para(t,style='BodyID'):story.append(p(t,style))
def page(title,sub=None):
 if story:story.append(PageBreak())
 para(title,'TitleID')
 if sub:para(sub,'CenterID')
def sub(t):para(t,'SubID');story.append(Spacer(1,5))
def table(head,rows,ratios):
 t=Table([[p(v,'HeadID') for v in head]]+[[p(v,'CellID') for v in row] for row in rows],colWidths=[WU*r/sum(ratios) for r in ratios],repeatRows=1)
 t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,colors.HexColor('#555555')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eef1f5')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(t);story.append(Spacer(1,10))

page('PETUNJUK PELAKSANAAN\nPROGRAM REMEDIAL DAN PENGAYAAN\nDENGAN DUKUNGAN KLINIK PEMBELAJARAN','MAN Insan Cendekia Gowa | Tahun pelajaran 2026/2027')
story.append(Spacer(1,14));sub('Ketentuan pokok')
para('Program remedial dan pengayaan yang diatur dalam petunjuk ini dilaksanakan di luar jam pembelajaran reguler. Pengaturan waktu tersebut merupakan kebijakan operasional program madrasah. Bantuan dan umpan balik dalam pembelajaran reguler tetap berlangsung sesuai kebutuhan murid.')
para('Klinik Pembelajaran MAN Insan Cendekia Gowa menjadi salah satu bentuk layanan remedial untuk murid yang belum mencapai TP/KKTP. Klinik menghubungkan rujukan guru, pendampingan terarah, pencatatan kehadiran, bukti belajar, dan asesmen ulang.')
para('Jadwal malam dan PJOK pagi diperlakukan sebagai pengecualian, sehingga tidak menentukan rentang PBM reguler. Pada saat menetapkan sesi nyata, kegiatan tersebut tetap diperiksa untuk peserta dan guru yang terlibat.')
table(['Identitas','Keterangan'],[['Penanggung jawab','WKM Akademik: Imran, S.Si.'],['Pelaksana','Guru mapel, pengampu dan pengelola Klinik Pembelajaran, wali kelas serta bidang keasramaan sesuai penugasan'],['Dasar jadwal','Data ACCA per 31 Oktober 2026; versi penuh berlaku 9 Agustus 2026'],['Waktu / durasi','Seluruh waktu WITA; durasi menggunakan menit aktual']],[1.4,4.6])
story.append(Spacer(1,20))
sig=Table([[p('Mengetahui,\nKepala Madrasah,','SignID'),p('Gowa, 31 Oktober 2026\nWKM Akademik,','SignID')],['',''],[p('Dr. Burhanuddin, S.Ag., M.Fil.I.\nNIP 197609152007101001','SignID'),p('Imran, S.Si.\nNIP 199309082019031013','SignID')]],colWidths=[300,240],rowHeights=[30,42,32])
sig.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]));story.append(sig)

page('1. DASAR, TUJUAN, DAN DEFINISI')
for i,t in enumerate(legal,1):para(f'{i}. {t}','SmallID')
para('Panduan Pembelajaran dan Asesmen revisi 2025 digunakan sebagai rujukan pedagogis: remedial memperbaiki kompetensi melalui pendampingan; pengayaan memperdalam atau memperluas penguasaan. Jadwal, durasi, ukuran kelompok, dan tata kerja di petunjuk ini ditetapkan sebagai rancangan operasional madrasah.')
table(['Istilah','Pemaknaan operasional'],[['Remedial','Pembelajaran perbaikan pada TP/indikator yang belum tercapai, dengan diagnosis, intervensi, dan pemeriksaan bukti terbaru.'],['Pengayaan','Pendalaman, perluasan, penyelidikan atau penerapan pada TP yang telah tercapai; bukan sekadar tambahan banyak soal.'],['Klinik remedial','Layanan kelompok kecil dengan bantuan sesuai kesulitan tiap peserta, rujukan TP dan tindak lanjut guru mapel. Pelaksanaan sesi pada aplikasi memerlukan minimal dua peserta terdaftar.'],['KKTP dan KKM aplikasi','KKTP menjelaskan bukti kompetensi yang harus tampak. KKM pada aplikasi dipakai sebagai penanda awal yang dikonfirmasi melalui bukti per TP. Tidak ada satu nilai angka nasional yang ditetapkan petunjuk ini.'],['Belum dipublish / nilai kosong','Perlu klarifikasi kelengkapan nilai atau kesempatan asesmen. Tidak otomatis membuktikan murid belum menguasai TP.']],[1.5,4.5])
sub('Tujuan layanan')
para('Memberi akses bantuan yang adil, memperbaiki kesulitan spesifik, menyediakan tantangan bagi murid yang telah menguasai TP, serta menjaga agar layanan tambahan tidak mengurangi pembelajaran reguler, waktu ibadah, makan, istirahat, dan kesehatan murid.')

page('2. PENANGGUNG JAWAB DAN ALUR KERJA')
table(['Peran','Tanggung jawab'],[['Kepala Madrasah','Mengetahui program, memberikan arahan dan dukungan sumber daya; menerima evaluasi dan tindak lanjut perbaikan.'],['WKM Akademik\nImran, S.Si.','Menandatangani dan mengoordinasikan program; memverifikasi kebutuhan, jadwal di luar PBM, pembagian tugas dan mutu tindak lanjut.'],['Guru mapel / pengampu','Menganalisis TP, menerima/menolak kesediaan mengampu ajuan siswa, mengajukan sesi, membimbing, mengisi absensi serta laporan, dan menilai ulang capaian.'],['Petugas Klinik yang ditunjuk','Menjalankan Kelola Sesi, Approval Sesi, pemeriksaan Laporan dan rekap sesuai kewenangan masing-masing pada Pengaturan Klinik. Kewenangan tersebut tidak otomatis sama.'],['Wali kelas dan keasramaan','Memastikan akses dan kehadiran, memeriksa kegiatan asrama/ibadah, membantu komunikasi serta penjadwalan pengganti.'],['Murid','Mengajukan kelompok atau mendaftar sesi yang tersedia, memahami target, mengikuti layanan, mengisi absensi mandiri dan menghasilkan bukti belajar.']],[1.6,4.4])
sub('Urutan satu siklus')
for i,t in enumerate(['Analisis bukti hasil belajar per TP dan klarifikasi nilai kosong.','Diagnosis kesalahan serta pilihan remedial, pengayaan, atau klinik remedial.','Susun rujukan, kelompok, perangkat, dan waktu berdasarkan matriks.','Verifikasi peserta, guru, ruang, kalender, PBM, serta pengecualian; tetapkan dan informasikan.','Laksanakan pendampingan / tugas pengayaan, dokumentasikan kehadiran dan bukti.','Lakukan asesmen ulang / penilaian produk dan tentukan ketercapaian TP.','Perbarui catatan; jika belum tercapai, ubah bantuan dan jalankan siklus berikutnya.'],1):para(f'{i}. {t}','SmallID')

page('3. DASAR PENYESUAIAN JADWAL PBM')
para('Pemetaan memakai versi penuh terakhir yang sudah berlaku pada 31 Oktober 2026 dan perubahan parsial sesudahnya jika ada. Baris aktif dipasangkan dengan Master Waktu berdasarkan hari, nomor jam, dan program kelas. Hasil pemeriksaan: 620 baris jadwal; 602 reguler dan 18 pengecualian; seluruhnya memiliki pasangan waktu.')
table(['Hari','Awal reguler','Akhir reguler','Jeda ke slot sore'],[[d,bounds[d][0],bounds[d][1],('60 menit' if d=='Senin' else '15 menit' if d=='Jumat' else '20 menit')] for d in DAYS],[1,.9,.9,1.3])
para('Rentang tersebut merupakan gabungan jadwal antarkelas. Peserta kelas peminatan tetap diperiksa pada seluruh kelas yang diikutinya; rentang satu kelas tidak cukup untuk menyatakan siswa bebas.','SmallID')
table(['Hari','Waktu pengecualian','Kegiatan'],exceptions,[1,1.3,3.3])
sub('Batas pemeriksaan')
para('Pemisahan jadwal malam dan PJOK pagi mengikuti arahan penyusunan program. Sesi tambahan tidak boleh berbarengan dengan pengecualian bagi orang yang terlibat. Kekosongan jadwal PBM tidak membuktikan ruang, guru atau peserta bebas dari tugas lain; hasil koordinasi asrama, ibadah, ekstrakurikuler, dan pemesanan ruang dilampirkan pada verifikasi.')
para('Durasi pada Master Waktu digunakan untuk membaca rentang nyata, bukan untuk menetapkan ulang standar JP. Petunjuk ini mencatat sesi tambahan dalam menit dan tidak otomatis mengklaimnya sebagai beban tatap muka/ekuivalensi guru.','SmallID')

page('4. MATRIKS JADWAL PELAKSANAAN')
para('Jadwal utama berikut berada di luar rentang PBM reguler dan lolos pemeriksaan tumpang tindih dengan seluruh baris jadwal yang dipetakan, termasuk pengecualian. Nama peserta/pengampu, ruang, serta tanggal ditetapkan setiap pekan setelah verifikasi.')
table(['Hari','Waktu WITA','Layanan / prioritas','Pelaksana'],[[r[0],r[1],r[3],r[4]] for r in matrix],[.8,1.2,2.4,1.8])
table(['Pilihan','Waktu WITA','Ketentuan'],[[r[0],r[1],r[3]] for r in night],[1,1.4,3.8])
sub('Contoh penerapan tanggal: 2-6 November 2026')
para('Senin 2 November: kelas X; Selasa 3 November: kelas XI; Rabu 4 November: kelas XII; Kamis 5 November: pengayaan; Jumat 6 November: asesmen ulang/rujukan. Waktu mengikuti matriks. Pada snapshot, tidak ada entri Master Libur pada rentang tersebut dan tidak ada slot klinik masa depan yang tercatat. Ini contoh usulan, bukan jadwal yang sudah disahkan atau bukti seluruh agenda non-PBM bebas.')
para('Kelompok dapat berjalan paralel hanya bila guru, siswa dan ruang berbeda. Untuk seorang murid, tetapkan satu sesi pada satu waktu; penggunaan sesi malam dibatasi sesuai kebutuhan dan ditelaah bersama keasramaan.','SmallID')

page('5. PENGAJUAN KLINIK PEMBELAJARAN')
para('Klinik Pembelajaran MAN Insan Cendekia Gowa menjadi salah satu bentuk program remedial. Guru mengaitkan topik klinik dengan TP yang belum tercapai, diagnosis kesulitan dan bukti awal. Sesi untuk pendalaman TP yang sudah dikuasai dicatat sebagai pengayaan. Alur operasional berikut mengikuti halaman Klinik pada ACCA.')
table(['Jalur','Pengajuan / pembentukan sesi','Persetujuan / hasil'],clinicpaths,[1,2.5,2.5])
sub('Ketentuan peserta dan pengajuan')
para('Pengajuan kelompok siswa memuat minimal dua peserta: pengaju dan sedikitnya satu teman seangkatan. Batas pengajuan guru/siswa adalah 12 peserta; kuota sesi guru dipilih pada form. Sesi guru dapat disetujui sebelum ada pendaftar, kemudian diisi melalui pendaftaran atau penugasan peserta. Sesi Akademik mengikuti kuota yang ditetapkan pengelola.','SmallID')
para('Siswa dapat bergabung ke ajuan kelompok yang masih menunggu proses selama memenuhi ketentuan tingkat dan kuota. Untuk sesi yang sudah dibuka, siswa memilih melalui Klinik Tersedia sesuai target tingkat. Peserta yang ditugaskan sudah tercantum pada daftar sesi.','SmallID')
para('Persetujuan diperoleh sebelum waktu mulai. Ajuan yang melewati waktu mulai tidak disetujui; pengaju menyusun jadwal baru. Penolakan atau ketidaksediaan guru disertai alasan agar pengaju dapat memperbaiki rencana.','SmallID')

page('6. PELAKSANAAN DAN LAPORAN KLINIK')
table(['Tahap','Tindakan sesuai alur ACCA'],clinicafter,[1.3,4.7])
sub('Pengisian absensi dan bukti pembelajaran')
para('Absensi mandiri melalui Saya Hadir tersedia mulai 15 menit sebelum sesi sampai 24 jam sesudah selesai, sepanjang sesi/laporan masih mengizinkan. Guru memeriksa kehadiran nyata dan melengkapi H (hadir), S (sakit), I (izin), atau A (alpa) melalui Isi Absensi. Kolom kosong berarti belum diabsen; tidak otomatis alpa ataupun hadir.','SmallID')
para('Pada Materi & hasil pembelajaran, tuliskan TP, kesulitan awal, bentuk bantuan, hasil kerja/kemajuan dan tindak lanjut. Gunakan foto/dokumentasi yang relevan sebagai bukti pendukung. Jumlah peserta terdaftar tidak menggantikan pemeriksaan jumlah yang benar-benar hadir.','SmallID')
sub('Pengesahan dan tindak lanjut')
para('Approval Sesi dan pengesahan Laporan merupakan dua pemeriksaan terpisah. WKM Akademik mengoordinasikan pelaksanaannya; petugas bertindak sesuai kewenangan pada Pengaturan Klinik. Di tab Laporan, gunakan cakupan Hanya Laporan Disahkan untuk rekap layanan yang telah disahkan.','SmallID')
para('Jika laporan dikembalikan Revisi, guru membaca catatan pemeriksa, memperbaiki laporan, lalu Ajukan Ulang. Penilaian ketercapaian TP tetap dilakukan guru mapel melalui asesmen ulang. Status Selesai atau Approved pada aplikasi adalah status pelaksanaan/administrasi, bukan jaminan murid sudah mencapai TP.','SmallID')

page('7. DESAIN PENDAMPINGAN DAN ASESMEN')
table(['Bagian sesi 60 menit','Kegiatan','Bukti'],[['10 menit','Konfirmasi TP dan analisis satu kesalahan/prasyarat.','Target spesifik serta catatan kebutuhan.'],['20 menit','Contoh terurai, diskusi alasan, atau representasi alternatif.','Langkah bantuan yang diberikan.'],['20 menit','Latihan mandiri/penyelidikan singkat; bantuan dikurangi.','Hasil kerja dan penjelasan murid.'],['10 menit','Umpan balik, refleksi, dan keputusan kesiapan asesmen ulang.','Catatan perkembangan dan rencana berikutnya.']],[1.4,2.8,1.9])
para('Untuk slot 45 menit, kurangi banyak contoh atau pecah kegiatan menjadi dua sesi; jangan memaksakan perangkat 60 menit ke waktu yang lebih singkat. Asesmen ulang dapat dilaksanakan pada sesi tersendiri setelah pendampingan, menggunakan instrumen berbeda yang tetap menilai TP dan tingkat tuntutan yang setara.')
sub('Remedial dan pengayaan')
para('Remedial dimulai dari diagnosis, bukan pengulangan tes tanpa pembelajaran. Pengayaan dapat berbentuk proyek kecil, pemecahan masalah terbuka, pengujian model, telaah sumber atau presentasi. Target, kriteria, dan cara memeriksa bukti dijelaskan sebelum murid mengerjakan.')
table(['Keputusan TP','Tindak lanjut'],[['Belum tercapai','Simpan bukti dan jenis kesalahan; ubah bantuan, kelompok atau media; jadwalkan siklus lanjutan.'],['Tercapai','Catat bukti terbaru dan tanggal; kembali ke pembelajaran reguler atau pilih pengayaan yang sesuai.'],['Belum ada bukti / nilai kosong','Klarifikasi pencatatan, ketidakhadiran dan kesempatan asesmen; jangan langsung menyimpulkan perlu remedial.']],[1.5,4.6])
para('Hasil awal dan terbaru sama-sama diarsipkan. Pengolahan nilai mengikuti kebijakan madrasah yang sah; tidak ada nilai remedial otomatis atau pembatasan angka yang ditetapkan petunjuk ini.','SmallID')

page('8. FORMAT RUJUKAN DAN VERIFIKASI JADWAL')
table(['Komponen rujukan','Isian'],[['Nama / NISN / kelas','________________________________________________'],['Mapel / guru / TP sasaran','________________________________________________'],['Bukti awal dan kesulitan spesifik','________________________________________________\n________________________________________________'],['Target bantuan / layanan','Remedial guru / Klinik remedial / Pengayaan: ______________'],['Pengampu dan kebutuhan akses','________________________________________________'],['Tanggal / jam / durasi / ruang','________________________________________________'],['Bukti kehadiran dan penilaian yang akan dikumpulkan','________________________________________________']],[2.2,3.9])
sub('Daftar periksa sebelum jadwal dipublikasikan')
for i,t in enumerate(['Versi PBM berlaku dan Master Waktu telah diperiksa.','Kelas reguler serta peminatan peserta sudah diperiksa.','PJOK pagi dan jadwal malam yang terkait tidak bertabrakan.','Guru, peserta, ruangan dan slot klinik tidak rangkap.','Master Libur serta agenda asrama/ibadah/makan/istirahat sudah dikoordinasikan.','Sesi, pengampu, kapasitas dan ruang telah ditetapkan pejabat berwenang.','Perubahan jadwal dan sesi pengganti tercatat serta diinformasikan.'],1):para(f'[   ] {i}. {t}','SmallID')
para('Verifikator / tanggal: ____________________\nPersetujuan operasional: ____________________\nCatatan perubahan: __________________________________________________','SmallID')

page('9. JURNAL, PEMANTAUAN, DAN EVALUASI')
table(['Tanggal / peserta','TP dan layanan','Bantuan / bukti kerja','Hasil / tindak lanjut'],[['\n\n','','',''] for _ in range(4)],[1.3,1.4,1.8,1.6])
table(['Indikator pemantauan','Cara membaca / keputusan'],[['Keterlaksanaan jadwal','Bandingkan sesi direncanakan, terlaksana, batal dan dijadwalkan ulang. Pisahkan laporan diajukan, revisi dan disahkan.'],['Akses dan kehadiran','Telaah peserta yang dirujuk, terdaftar dan hadir. Ketidakhadiran memerlukan komunikasi dan kesempatan layanan pengganti.'],['Kemajuan TP','Bandingkan bukti awal dan terbaru per TP. Laporkan proporsi yang mencapai TP di antara peserta yang telah dinilai ulang; peserta tanpa asesmen terbaru dipisahkan.'],['Mutu dan penjadwalan','Catat temuan benturan, kejelasan rubrik, efektivitas bantuan, dan umpan balik murid/pengampu.'],['Peninjauan','Petugas Klinik merekap mingguan, WKM Akademik menelaah bulanan, dan Kepala Madrasah meninjau per semester sebagai standar kerja internal program.']],[1.6,4.5])
para('Berkas minimum: rujukan, verifikasi, jadwal sah, daftar hadir, jurnal, bukti belajar, hasil asesmen/produk, umpan balik dan tindak lanjut. Akses daftar peserta dan hasil belajar dibatasi kepada petugas yang menangani. Masa simpan mengikuti kebijakan arsip madrasah.','SmallID')

page('10. RUJUKAN DAN CATATAN PENGGUNAAN')
for label,url in refs:
 para(label,'SmallID');story.append(Paragraph('<link href="'+html.escape(url,quote=True)+'" color="#174b6e"><u>Buka sumber resmi</u></link>',styles['SmallID']));story.append(Spacer(1,6))
sub('Dokumen internal dan data yang digunakan')
para('Format formal: SOP AKADEMIK 05 - Penilaian Hasil Belajar, pada folder SOP AKADEMIK. Keterkaitan jadwal ditelaah pula melalui SOP AKADEMIK 02 - Penyusunan Kaldik dan Jadwal Pelajaran. Nomor regulasi pada contoh tidak disalin otomatis; rujukan yang digunakan dicantumkan di atas.')
para('Data: Jadwal Guru, Versi Jadwal, Master Waktu, Master Kelas, Master Libur dan Klinik Pembelajaran ACCA per 31 Oktober 2026. Alur klinik dicocokkan dengan halaman Klinik: Klinik Tersedia, Sesi Saya, Ajukan Kelompok, Approval Sesi, Kelola Sesi, dan Laporan. Pemisahan jadwal malam dan PJOK pagi mengikuti pengaturan program. Matriks direvisi bila jadwal/kalender berubah.')
para('Jam, ukuran kelompok, durasi, target pencatatan dan frekuensi evaluasi merupakan rancangan operasional madrasah. Penetapan final dilakukan melalui administrasi dan pengesahan madrasah. Penyusunan dua dokumen ini tidak mengubah jadwal atau data pada aplikasi.','SmallID')

def guideheader(c,doc):header(c,612,936);foot(c,doc.page,'Petunjuk Remedial, Pengayaan, dan Klinik Pembelajaran',612)
doc=SimpleDocTemplate(str(guide),pagesize=(612,936),leftMargin=36,rightMargin=36,topMargin=126,bottomMargin=40,title='Petunjuk Pelaksanaan Remedial, Pengayaan, dan Klinik Pembelajaran',author='MAN Insan Cendekia Gowa')
doc.build(story,onFirstPage=guideheader,onLaterPages=guideheader)
print('SOP',sopfile);print('GUIDE',guide)
