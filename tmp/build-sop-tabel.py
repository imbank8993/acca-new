import json, html, collections
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parent.parent
# Reuse only the verified schedule analysis, before any document authoring.
source=(ROOT/'tmp/build-sop-remedial.py').read_text(encoding='utf8')
exec(compile(source[:source.index('styles=getSampleStyleSheet()')],str(ROOT/'tmp/build-sop-remedial.py'),'exec'))
OUT=ROOT/'output/pdf'
pdfmetrics.registerFont(TTFont('TNR','C:/Windows/Fonts/times.ttf'))
pdfmetrics.registerFont(TTFont('TNRB','C:/Windows/Fonts/timesbd.ttf'))
pdfmetrics.registerFontFamily('TNR',normal='TNR',bold='TNRB',italic='TNR',boldItalic='TNRB')
W,H=612,936; L=36; U=540; TOP=800
styles={
 'body':ParagraphStyle('body',fontName='TNR',fontSize=11,leading=13.5,splitLongWords=0),
 'head':ParagraphStyle('head',fontName='TNRB',fontSize=11,leading=13.5,alignment=TA_CENTER,splitLongWords=0),
 'title':ParagraphStyle('title',fontName='TNRB',fontSize=12,leading=15,alignment=TA_CENTER,splitLongWords=0),
 'center':ParagraphStyle('center',fontName='TNR',fontSize=11,leading=13.5,alignment=TA_CENTER,splitLongWords=0),
}
official_sources={
 'Permendikbudristek Nomor 21 Tahun 2022':'https://pskp.kemendikdasmen.go.id/standar-nasional-pendidikan-a/standar-proses',
 'Permendikdasmen Nomor 1 Tahun 2026':'https://peraturan.bpk.go.id/Download/407441/Permendikdasmen-no-1-tahun-2026.pdf',
 'KMA Nomor 450 Tahun 2024 sebagaimana diubah dengan KMA Nomor 1503 Tahun 2025':'https://sulteng.kemenag.go.id/index.php/files/show/20251020162801surat-penyampaian-kma-kurikulum-2025%2Blampiran_compressed-tzR.pdf',
 'PermenPANRB Nomor 35 Tahun 2012':'https://peraturan.bpk.go.id/Home/Download/123614/PERMENPAN%20NOMOR%2035%20TAHUN%202012.pdf',
 'Panduan Pembelajaran dan Asesmen, revisi 2025':'https://kurikulum.kemendikdasmen.go.id/file/1755668120_manage_file.pdf',
}
def p(s,sty='body'):
 text=html.escape(str(s)).replace('\n','<br/>')
 if s in official_sources:text='<link href="'+html.escape(official_sources[s],quote=True)+'">'+text+'</link>'
 return Paragraph(text,styles[sty])
logo=ImageReader(str(ROOT/'tmp/logo-sekolah.png'))
profile=x['profile'][0]
def kop(c):
 c.saveState();c.setFillColor(colors.black)
 c.drawImage(logo,L,H-96,width=57,height=62,preserveAspectRatio=True,mask='auto')
 lines=[('KEMENTERIAN AGAMA REPUBLIK INDONESIA',40,12,'TNRB'),
  ('KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA',55,12,'TNRB'),
  ('MAN INSAN CENDEKIA GOWA',73,15,'TNRB'),
  ('Jl. Pendidikan Desa Belapunrangan, Kec. Parangloe, Gowa, Sulawesi Selatan 92173',88,9,'TNR'),
  ('Telp. 085173279846 · Pos-el: insancendekiagowa@gmail.com · Laman: icgowa.sch.id',100,9,'TNR')]
 for text,dy,size,font in lines:
  assert pdfmetrics.stringWidth(text,font,size)<=U
  c.setFont(font,size);c.drawCentredString(W/2,H-dy,text)
 c.setLineWidth(1.5);c.line(L,H-109,W-L,H-109)
 c.setLineWidth(.5);c.line(L,H-112,W-L,H-112)
 c.restoreState()

class Document:
 def __init__(self,path,title):
  self.path=path;self.c=canvas.Canvas(str(path),pagesize=(W,H));self.c.setTitle(title);self.c.setAuthor('MAN Insan Cendekia Gowa');self.n=0;self.y=TOP;self.pages=[]
 def page(self,title):
  if self.n:self.closepage()
  self.n+=1;self.y=TOP;kop(self.c)
  self.table(None,[[title]],[1],title_only=True)
 def table(self,head,rows,ratios,caption=None,title_only=False,heights=None,centers=()):
  data=[];offset=0
  if caption:data.append([p(caption,'head')]+['']*(len(ratios)-1));offset=1
  if head:data.append([p(s,'head') for s in head])
  for row in rows:
   data.append([p(s,'title' if title_only else ('center' if i in centers else 'body')) for i,s in enumerate(row)])
  widths=[U*r/sum(ratios) for r in ratios]
  t=Table(data,colWidths=widths,rowHeights=heights)
  fmt=[('GRID',(0,0),(-1,-1),.45,colors.black),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]
  if caption:fmt.extend([('SPAN',(0,0),(-1,0)),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee'))])
  if head:fmt.append(('BACKGROUND',(0,offset),(-1,offset),colors.HexColor('#f4f4f4')))
  t.setStyle(TableStyle(fmt));_,height=t.wrap(U,2000)
  assert self.y-height>=44,(self.path.name,self.n,self.y,height,caption or head)
  # Check every line before drawing: no text exceeds the width of its cell.
  for ri,row in enumerate(t._cellvalues):
   for ci,cell in enumerate(row):
    if isinstance(cell,Paragraph):
     available=U-12 if caption and ri==0 else widths[ci]-12
     cell.wrap(available,2000)
     for ln in cell.blPara.lines:
      extra=ln[0] if isinstance(ln,tuple) else ln.extraSpace
      assert extra>=-.1,(self.path.name,self.n,'cell text exceeds width',ri,ci,cell.getPlainText())
  t.drawOn(self.c,L,self.y-height);self.y-=height+12
 def signatures(self):
  self.table(None,[['Mengetahui,\nKepala Madrasah,','Gowa, 31 Oktober 2026\nWKM Akademik,'],['',''],['Dr. Burhanuddin, S.Ag., M.Fil.I.\nNIP 197609152007101001','Imran, S.Si.\nNIP 199309082019031013']],[1,1],heights=[40,42,42])
 def closepage(self):
  self.c.setFont('TNR',9);self.c.drawRightString(W-L,22,str(self.n));self.pages.append({'page':self.n,'bottom':round(self.y,1)});self.c.showPage()
 def save(self):
  self.closepage();self.c.save();print(self.path.name,self.n,self.pages)

legal=[
 ['1','Undang-Undang Nomor 20 Tahun 2003','Sistem Pendidikan Nasional.'],
 ['2','Peraturan Pemerintah Nomor 57 Tahun 2021 sebagaimana diubah dengan Nomor 4 Tahun 2022','Standar Nasional Pendidikan.'],
 ['3','Permendikbudristek Nomor 21 Tahun 2022','Standar Penilaian Pendidikan.'],
 ['4','Permendikdasmen Nomor 1 Tahun 2026','Standar Proses.'],
 ['5','KMA Nomor 450 Tahun 2024 sebagaimana diubah dengan KMA Nomor 1503 Tahun 2025','Pedoman implementasi kurikulum madrasah.'],
 ['6','PermenPANRB Nomor 35 Tahun 2012','Pedoman penyusunan standar operasional prosedur administrasi pemerintahan.'],
 ['7','Panduan Pembelajaran dan Asesmen, revisi 2025','Rujukan penetapan kriteria ketercapaian, pembelajaran remedial dan pengayaan.'],
]
policy=[
 ['Waktu pelaksanaan','Di luar jam pembelajaran reguler; jadwal ditetapkan oleh WKM Akademik.'],
 ['Remedial','Bimbingan untuk tujuan pembelajaran yang belum tercapai, dilanjutkan dengan asesmen ulang.'],
 ['Pengayaan','Pendalaman atau perluasan bagi peserta didik yang telah mencapai tujuan pembelajaran.'],
 ['Klinik Pembelajaran','Salah satu bentuk layanan remedial; tujuan, bimbingan, kehadiran dan hasil belajar dicatat.'],
 ['Pengecualian jadwal','Kegiatan malam dan PJOK pagi tidak menentukan rentang jam reguler; keterlibatan guru dan peserta tetap diperiksa.'],
]
roles=[
 ['Kepala Madrasah','Mengetahui program, memberikan arahan dan dukungan, serta meninjau hasil evaluasi.'],
 ['WKM Akademik','Menandatangani program, memeriksa dan menetapkan jadwal, mengatur pembagian tugas serta menelaah hasil.'],
 ['Guru mata pelajaran','Mengidentifikasi kesulitan, menyusun rujukan, membimbing, menilai ulang dan memperbarui catatan capaian.'],
 ['Guru pembimbing klinik','Menyatakan kesediaan mengampu, membimbing peserta, mencatat kehadiran dan menyusun laporan.'],
 ['Petugas Klinik Pembelajaran','Mengelola kegiatan, memeriksa pengajuan dan laporan, serta menyusun rekapitulasi sesuai kewenangan yang diberikan.'],
 ['Wali kelas dan keasramaan','Mengoordinasikan kehadiran serta kesesuaian dengan kegiatan asrama, ibadah, makan dan istirahat.'],
]
procedure=[
 ['1','Menganalisis hasil belajar dan tujuan pembelajaran.','Guru mata pelajaran','Hasil asesmen dan kriteria ketercapaian','1 hari','Peta kebutuhan'],
 ['2','Mengidentifikasi kesulitan dan menentukan remedial atau pengayaan.','Guru mata pelajaran','Peta kebutuhan','1 hari','Rujukan peserta'],
 ['3','Menyusun jadwal di luar pembelajaran reguler dan memeriksa benturan.','WKM Akademik dan petugas klinik','Jadwal, kalender dan daftar peserta','1 hari','Rancangan jadwal'],
 ['4','Memperbaiki jadwal yang berbenturan; menetapkan jadwal yang sesuai.','WKM Akademik','Hasil pemeriksaan','1 hari','Jadwal ditetapkan'],
 ['5','Memproses pengajuan, persetujuan dan pendaftaran klinik.','Petugas klinik dan guru pembimbing','Rujukan dan jadwal','Sebelum kegiatan','Daftar peserta'],
 ['6','Melaksanakan bimbingan atau pengayaan dan mencatat kehadiran.','Guru pembimbing','Bahan belajar dan daftar hadir','Per kegiatan','Jurnal dan bukti belajar'],
 ['7','Melaksanakan asesmen ulang atau menilai hasil pengayaan.','Guru mata pelajaran','Instrumen dan rubrik','Per tujuan','Bukti capaian terbaru'],
 ['8','Menentukan ketercapaian; mengulang bimbingan bila belum tercapai.','Guru mata pelajaran','Bukti dan kriteria ketercapaian','1 hari','Keputusan tindak lanjut'],
 ['9','Mengajukan, memeriksa dan memperbaiki laporan klinik.','Guru pembimbing dan pemeriksa laporan','Jurnal dan dokumentasi','Setelah kegiatan','Laporan disahkan'],
 ['10','Merekap hasil, mengevaluasi dan memperbaiki program.','WKM Akademik','Laporan dan rekapitulasi','Bulanan','Rekomendasi perbaikan'],
]
mainmatrix=[
 ['Senin','16.00-17.00','60 menit','Remedial atau Klinik Pembelajaran kelas X','Guru mata pelajaran atau pembimbing klinik'],
 ['Selasa','16.00-17.00','60 menit','Remedial atau Klinik Pembelajaran kelas XI','Guru mata pelajaran atau pembimbing klinik'],
 ['Rabu','16.00-17.00','60 menit','Remedial atau Klinik Pembelajaran kelas XII','Guru mata pelajaran atau pembimbing klinik'],
 ['Kamis','16.00-17.00','60 menit','Pengayaan menurut tujuan pembelajaran','Guru mata pelajaran'],
 ['Jumat','16.15-17.15','60 menit','Asesmen ulang atau tindak lanjut remedial','Guru mata pelajaran atau pembimbing klinik'],
]
nightmatrix=[
 ['Senin-Rabu','20.30-21.30','Cadangan sesuai kebutuhan; dikoordinasikan dengan keasramaan.'],
 ['Kamis','20.45-21.30','Cadangan setelah kegiatan KIR kelas X A dan X B selesai pukul 20.40.'],
 ['Jumat','Tidak dijadwalkan rutin','Kegiatan KIR kelas X C dan X D berlangsung sampai pukul 21.20.'],
 ['Sabtu dan Minggu','Sesuai penetapan','Dilaksanakan hanya setelah kalender dan kegiatan asrama diperiksa.'],
]
schedulechecks=[
 ['1','Kegiatan berada di luar jam pembelajaran reguler.'],
 ['2','Jadwal kelas reguler dan mata pelajaran pilihan setiap peserta telah diperiksa.'],
 ['3','PJOK pagi, kegiatan malam dan tugas lain guru tidak berbenturan.'],
 ['4','Peserta, guru dan ruang tidak digunakan untuk dua kegiatan pada waktu yang sama.'],
 ['5','Hari libur, kegiatan asrama, ibadah, makan dan istirahat telah dikoordinasikan.'],
 ['6','Nama peserta, guru, ruang dan tanggal ditetapkan sebelum jadwal diumumkan.'],
]
paths=[
 ['Guru','Guru mengajukan kegiatan dengan mengisi mata pelajaran, materi, tanggal, waktu, ruang, kapasitas, sasaran tingkat dan peserta yang ditugaskan.','Petugas memeriksa pengajuan. Jika disetujui, pendaftaran dibuka sesuai sasaran dan kapasitas.'],
 ['Kelompok peserta didik','Pengaju memilih guru pembimbing dan sedikitnya satu teman seangkatan. Pengaju menjadi anggota kelompok.','Guru menyatakan kesediaan lebih dahulu. Setelah itu, petugas memeriksa dan menyetujui atau menolak pengajuan.'],
 ['Bidang Akademik','Petugas yang berwenang menetapkan guru, materi, waktu, ruang, kapasitas dan peserta.','Kegiatan langsung dibuka atau dinyatakan penuh sesuai jumlah peserta, setelah pemeriksaan jadwal dan kesediaan guru.'],
]
clinicrules=[
 ['Jumlah peserta','Pengajuan kelompok sedikitnya dua peserta. Pengajuan guru atau kelompok paling banyak 12 peserta; kegiatan yang dibuat Bidang Akademik mengikuti kapasitas yang ditetapkan.'],
 ['Pendaftaran','Peserta mendaftar pada kegiatan yang dibuka sesuai tingkat dan kapasitas. Peserta yang ditugaskan guru atau petugas sudah tercantum pada daftar.'],
 ['Persetujuan','Pengajuan disetujui sebelum waktu mulai. Pengajuan yang waktunya terlewati diajukan kembali dengan jadwal baru.'],
 ['Kewenangan','Pengelolaan kegiatan, persetujuan pengajuan, pengesahan laporan dan penyusunan rekapitulasi dijalankan oleh petugas sesuai penugasan masing-masing.'],
]
clinicexecution=[
 ['1','Pemeriksaan peserta','Guru memeriksa daftar peserta, sasaran tingkat, kesesuaian jadwal dan tujuan pembelajaran. Kegiatan klinik memerlukan sedikitnya dua peserta terdaftar.'],
 ['2','Bimbingan','Guru menelaah kesulitan awal, memberi bantuan bertahap, memeriksa latihan dan mencatat perkembangan tiap peserta.'],
 ['3','Kehadiran','Peserta mencatat kehadiran mandiri; guru memeriksa dan melengkapi catatan hadir, sakit, izin atau alpa. Kolom kosong berarti belum dicatat.'],
 ['4','Laporan kegiatan','Guru mencatat materi, tujuan pembelajaran, bantuan, hasil belajar dan tindak lanjut; melampirkan bukti pendukung lalu mengajukan laporan.'],
 ['5','Pemeriksaan laporan','Pemeriksa mengesahkan laporan yang sesuai atau mengembalikannya dengan catatan perbaikan. Guru memperbaiki dan mengajukan kembali laporan.'],
 ['6','Asesmen dan tindak lanjut','Guru mata pelajaran menilai ulang tujuan pembelajaran. Peserta yang belum mencapai kriteria memperoleh bimbingan lanjutan.'],
]
assessment=[
 ['Belum mencapai kriteria','Perbaiki bantuan, media atau kelompok; lanjutkan bimbingan dan asesmen ulang.'],
 ['Mencapai kriteria','Catat bukti terbaru; peserta kembali ke pembelajaran berikutnya atau memperoleh pengayaan.'],
 ['Nilai belum diumumkan atau belum tercatat','Periksa kelengkapan pencatatan dan kesempatan asesmen sebelum menetapkan peserta remedial.'],
 ['Pengolahan hasil','Simpan bukti awal dan terbaru. Pengolahan nilai mengikuti ketentuan penilaian madrasah.'],
]

# Standard operating procedure: all substantive content is inside tables.
sop=Document(OUT/'SOP_Program_Remedial_Pengayaan_dan_Klinik_Pembelajaran_MAN_IC_Gowa.pdf','SOP Program Remedial, Pengayaan, dan Klinik Pembelajaran')
sop.page('STANDAR OPERASIONAL PROSEDUR\nPROGRAM REMEDIAL, PENGAYAAN, DAN KLINIK PEMBELAJARAN')
sop.table(['Identitas','Keterangan'],[['Nomor SOP','........................................................'],['Tanggal penyusunan','31 Oktober 2026'],['Tanggal berlaku','........................................................'],['Penanggung jawab','WKM Akademik: Imran, S.Si.'],['Unit pelaksana','Bidang Akademik MAN Insan Cendekia Gowa']],[1.5,4.5])
sop.table(['Komponen','Ketentuan'],policy,[1.4,4.6],caption='KETENTUAN PELAKSANAAN')
sop.signatures()
sop.page('DASAR HUKUM DAN KELENGKAPAN PELAKSANAAN')
sop.table(['No.','Dasar hukum / pedoman','Pokok pengaturan'],legal,[.4,3.5,2.1],centers=(0,))
sop.table(['Komponen','Ketentuan'],[['Kualifikasi pelaksana','Memahami tujuan pembelajaran, kriteria ketercapaian, bimbingan dan penilaian hasil belajar.'],['Keterkaitan','Penyusunan jadwal, penilaian hasil belajar, Klinik Pembelajaran dan kegiatan keasramaan.'],['Perlengkapan','Jadwal, kalender pendidikan, daftar peserta, bahan bimbingan, instrumen penilaian dan ruang belajar.'],['Pencatatan','Rujukan, daftar hadir, jurnal, bukti belajar, hasil asesmen ulang, laporan dan tindak lanjut.']],[1.4,4.6])
sop.page('PROSEDUR PELAKSANAAN')
sop.table(['No.','Tahapan kegiatan','Pelaksana','Kelengkapan','Waktu','Hasil'],procedure,[.4,2.4,1.35,1.25,.9,1.15],centers=(0,))
sop.page('MATRIKS JADWAL PROGRAM')
sop.table(['Hari','Waktu (WITA)','Durasi','Layanan / sasaran','Pelaksana'],mainmatrix,[.8,1.3,.9,2.5,2.3],caption='JADWAL UTAMA DI LUAR PEMBELAJARAN REGULER')
sop.table(['Hari','Waktu (WITA)','Ketentuan'],nightmatrix,[1,1.4,3.6],caption='JADWAL CADANGAN DAN PENGGANTI')
sop.table(['No.','Pemeriksaan sebelum penetapan jadwal'],schedulechecks,[.4,5.6],centers=(0,))
sop.page('ALUR KLINIK PEMBELAJARAN')
sop.table(['Jalur','Pengajuan','Persetujuan'],paths,[1,2.6,2.4])
sop.table(['No.','Tahap','Tindakan'],clinicexecution,[.4,1.4,4.2],centers=(0,))
sop.save()

# Detailed instructions: tables only, using the same typeface and table size.
guide=Document(OUT/'Petunjuk_Pelaksanaan_Remedial_Pengayaan_dan_Klinik_MAN_IC_Gowa.pdf','Petunjuk Pelaksanaan Program Remedial, Pengayaan, dan Klinik Pembelajaran')
guide.page('PETUNJUK PELAKSANAAN\nPROGRAM REMEDIAL, PENGAYAAN, DAN KLINIK PEMBELAJARAN')
guide.table(['Identitas','Keterangan'],[['Satuan pendidikan','MAN Insan Cendekia Gowa'],['Tahun pelajaran','2026/2027'],['Penanggung jawab','WKM Akademik: Imran, S.Si.'],['Sasaran','Peserta didik kelas X, XI dan XII sesuai kebutuhan belajar']],[1.4,4.6])
guide.table(['Komponen','Ketentuan'],policy,[1.4,4.6],caption='KETENTUAN PELAKSANAAN')
guide.signatures()
guide.page('DASAR PELAKSANAAN DAN PEMBAGIAN TUGAS')
guide.table(['No.','Dasar hukum / pedoman','Pokok pengaturan'],legal,[.4,3.5,2.1],centers=(0,))
guide.table(['Pelaksana','Tugas'],roles,[1.7,4.3],caption='PEMBAGIAN TUGAS')
guide.page('MATRIKS JADWAL PROGRAM')
guide.table(['Hari','Mulai (WITA)','Selesai (WITA)'],[[d,bounds[d][0].replace(':','.'),bounds[d][1].replace(':','.')] for d in DAYS],[1,1,1],caption='RENTANG PEMBELAJARAN REGULER ANTARKELAS',centers=(0,1,2))
guide.table(['Hari','Waktu (WITA)','Layanan / sasaran','Pelaksana'],[[r[0],r[1],r[3],r[4]] for r in mainmatrix],[.8,1.25,2.4,2.25],caption='JADWAL UTAMA DI LUAR PEMBELAJARAN REGULER')
guide.table(['Hari','Waktu (WITA)','Ketentuan'],nightmatrix,[1,1.4,3.6],caption='JADWAL CADANGAN DAN PENGGANTI')
guide.page('PENGECUALIAN DAN PEMERIKSAAN JADWAL')
guide.table(['Hari','Waktu (WITA)','Kegiatan / peserta'],[['Selasa','06.00-07.20','PJOK kelas X A-X D'],['Rabu','06.00-07.20','PJOK kelas XI A-XI D'],['Jumat','06.00-07.20','PJOK kelas XII A-XII D'],['Kamis','20.00-20.40','KIR kelas X A dan X B'],['Jumat','20.00-21.20','KIR kelas X C dan X D']],[1,1.3,3.7],caption='KEGIATAN DI LUAR RENTANG REGULER')
guide.table(['No.','Pemeriksaan sebelum penetapan jadwal'],schedulechecks,[.4,5.6],centers=(0,))
guide.table(['Komponen','Ketentuan'],[['Rentang jam reguler','Rentang gabungan antarkelas; waktu belajar setiap peserta mengikuti jadwal kelas dan mata pelajaran pilihannya.'],['Kelompok bersamaan','Dapat dilaksanakan jika guru, peserta dan ruang berbeda.'],['Lama kegiatan','Dicatat dalam menit pelaksanaan sebenarnya.'],['Perubahan jadwal','Ditetapkan oleh WKM Akademik dan diberitahukan kepada pihak yang terlibat.']],[1.4,4.6])
guide.page('ALUR PENGAJUAN KLINIK PEMBELAJARAN')
guide.table(['Jalur','Pengajuan','Persetujuan'],paths,[1,2.6,2.4])
guide.table(['Komponen','Ketentuan'],clinicrules,[1.4,4.6],caption='PESERTA DAN PERSETUJUAN KEGIATAN')
guide.table(['Kondisi','Tindak lanjut'],[['Pengajuan ditolak','Pengaju membaca alasan penolakan dan memperbaiki rencana.'],['Guru tidak bersedia','Kelompok mengajukan kembali setelah memperoleh kesediaan guru pembimbing.'],['Waktu kegiatan terlewati','Pengajuan baru menggunakan tanggal dan waktu yang sesuai.']],[1.4,4.6])
guide.page('PELAKSANAAN DAN LAPORAN KLINIK PEMBELAJARAN')
guide.table(['No.','Tahap','Tindakan'],clinicexecution,[.4,1.4,4.2],centers=(0,))
guide.table(['Komponen','Ketentuan'],[['Kehadiran mandiri','Dapat dicatat mulai 15 menit sebelum kegiatan sampai 24 jam setelah selesai, selama pencatatan masih dibuka. Guru memeriksa kehadiran sebenarnya.'],['Isi laporan','Tujuan pembelajaran, kesulitan awal, bentuk bantuan, materi, hasil kerja, perkembangan dan tindak lanjut.'],['Laporan diajukan','Menunggu pemeriksaan; kegiatan selesai belum berarti laporan telah disahkan.'],['Laporan perlu perbaikan','Guru memperbaiki sesuai catatan pemeriksa dan mengajukan kembali.'],['Laporan disahkan','Diarsipkan dan dimasukkan dalam rekapitulasi laporan yang telah disahkan. Ketercapaian belajar ditetapkan melalui asesmen guru.']],[1.4,4.6],caption='KEHADIRAN DAN PENGESAHAN LAPORAN')
guide.page('PENDAMPINGAN DAN PENILAIAN HASIL BELAJAR')
guide.table(['Waktu','Kegiatan','Bukti'],[['10 menit','Menetapkan tujuan dan menelaah kesulitan awal.','Target dan catatan kesulitan.'],['20 menit','Memberi contoh, diskusi dan bantuan bertahap.','Catatan bantuan.'],['20 menit','Latihan mandiri atau penyelidikan singkat.','Hasil kerja peserta.'],['10 menit','Umpan balik, refleksi dan rencana asesmen ulang.','Catatan perkembangan.']],[1,3.2,1.8],caption='CONTOH SUSUNAN BIMBINGAN 60 MENIT')
guide.table(['Layanan','Pelaksanaan'],[['Bimbingan 45 menit','Kurangi jumlah contoh atau bagi materi menjadi dua kegiatan.'],['Remedial','Mulai dengan identifikasi kesulitan dan pembelajaran perbaikan sebelum asesmen ulang.'],['Pengayaan','Gunakan pendalaman, pemecahan masalah, penyelidikan, proyek atau presentasi dengan kriteria yang jelas.'],['Asesmen ulang','Gunakan instrumen yang berbeda dengan tujuan dan tingkat tuntutan yang setara.'],['Kriteria ketercapaian','Gunakan bukti per tujuan pembelajaran. Nilai batas ketuntasan menjadi petunjuk awal untuk pemeriksaan lebih lanjut.']],[1.4,4.6])
guide.table(['Hasil pemeriksaan','Tindak lanjut'],assessment,[1.5,4.5],caption='KEPUTUSAN HASIL BELAJAR')
guide.page('FORMULIR RUJUKAN DAN PEMERIKSAAN JADWAL')
guide.table(['Komponen','Isian'],[['Nama / nomor induk / kelas',''],['Mata pelajaran / guru',''],['Tujuan pembelajaran',''],['Kesulitan dan bukti awal',''],['Layanan dan guru pembimbing',''],['Tanggal / waktu / ruang',''],['Target bantuan dan bukti hasil','']],[2,4],caption='RUJUKAN LAYANAN',heights=[28,28,32,32,32,46,32,32,46])
guide.table(['No.','Daftar periksa','Hasil'],[[r[0],r[1],''] for r in schedulechecks],[.4,4.8,.8],caption='PEMERIKSAAN SEBELUM PENETAPAN',centers=(0,))
guide.table(['Petugas pemeriksa / tanggal','Persetujuan WKM Akademik'],[['\n\n','']],[1,1])
guide.page('JURNAL, PEMANTAUAN, DAN EVALUASI')
guide.table(['Tanggal / peserta','Tujuan dan layanan','Bantuan / bukti','Hasil / tindak lanjut'],[['\n\n','','',''] for _ in range(4)],[1.3,1.5,1.6,1.6],caption='JURNAL PEMBELAJARAN')
guide.table(['Aspek','Pemeriksaan / tindak lanjut'],[['Pelaksanaan','Rekap kegiatan direncanakan, terlaksana, batal dan dijadwalkan ulang.'],['Kehadiran','Pisahkan jumlah dirujuk, terdaftar dan benar-benar hadir; sediakan kesempatan pengganti.'],['Kemajuan belajar','Bandingkan bukti awal dan terbaru per tujuan pembelajaran; pisahkan peserta yang belum dinilai ulang.'],['Laporan','Pisahkan laporan diajukan, perlu perbaikan dan disahkan.'],['Evaluasi','Petugas menyusun rekap mingguan; WKM Akademik menelaah bulanan; Kepala Madrasah meninjau per semester.'],['Arsip','Simpan rujukan, pemeriksaan jadwal, daftar hadir, jurnal, bukti belajar, hasil asesmen dan laporan sesuai ketentuan arsip madrasah.']],[1.3,4.7],caption='PEMANTAUAN DAN TINDAK LANJUT')
guide.save()
(ROOT/'tmp/sop-table-layout.json').write_text(json.dumps({'sop_pages':sop.n,'guide_pages':guide.n,'font':'Times New Roman','table_font_size':11,'content':'tables','sop_layout':sop.pages,'guide_layout':guide.pages},indent=2),encoding='utf8')
