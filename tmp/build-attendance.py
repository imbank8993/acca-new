import json, re, collections, datetime, os, html
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parent.parent
x=json.loads((ROOT/'tmp/attendance-source.json').read_text(encoding='utf8'))
START='2026-07-01'; END='2026-10-31'
months={'2026-07':'Juli','2026-08':'Agustus','2026-09':'September','2026-10':'Oktober'}
norm=lambda v: re.sub(r'\s+',' ',str(v or '').strip()).casefold()
nip=lambda v: str(v or '').strip().lstrip('0')
names={nip(t['nip']):t['nama_lengkap'] for t in x['teachers']}
ids={nip(t['nip']):t['nip'] for t in x['teachers']}
classes={norm(t['nama']):str(t['tingkat']) for t in x['classes']}
def grade(k):
    if norm(k) in classes:return classes[norm(k)]
    a=str(k).split()[0].upper();return {'X':'10','XI':'11','XII':'12'}.get(a,a)
def holiday(date,k,j):
    for h in x['holidays']:
        if h['tanggal']!=date:continue
        scope=h['lingkup']; targets=h['target_kelas'] or []
        if targets and scope=='kelas' and norm(k) not in [norm(t) for t in targets]:continue
        if targets and scope=='tingkat' and grade(k) not in targets:continue
        if norm(h['jam_ke']) not in ('','semua') and str(j)!=str(h['jam_ke']):continue
        return h
    return None
def hour(r):
    if r.get('jam_ke_id') is not None:return int(r['jam_ke_id'])
    z=re.search(r'(?:Jam Ke[- ]*)?(\d+)',str(r['jam_ke']),re.I)
    return int(z[1]) if z else -1
def slot(r):return (norm(r['kelas']),norm(r['hari']),hour(r))
def resolve(date):
    vs=[v for v in x['versions'] if v['berlaku_mulai']<=date]
    full=[v for v in vs if v['jenis']=='penuh'];base=full[-1] if full else None
    per=collections.defaultdict(list)
    if vs:
        if base:
            for r in x['schedule']:
                if r['aktif'] and r['versi_id']==base['id']:per[slot(r)].append(r)
        for v in vs:
            if v['jenis']=='parsial' and (not base or v['berlaku_mulai']>=base['berlaku_mulai']):
                patch=[r for r in x['schedule'] if r['aktif'] and r['versi_id']==v['id']]
                for k in set(slot(r) for r in patch):per[k]=[]
                for r in patch:per[slot(r)].append(r)
    else:
        for r in sorted(x['schedule'],key=lambda r:r['berlaku_mulai'] or '',reverse=True):
            if r['aktif'] and r['berlaku_mulai'] and r['berlaku_mulai']<=date and slot(r) not in per:per[slot(r)]=[r]
    return [r for rows in per.values() for r in rows],base

# Reconciliation unit: date, class, teacher and period; subject verified separately.
expected={};raw=[]; schedule_duplicates=0;calendar=[]
d=datetime.date.fromisoformat(START)
while d.isoformat()<=END:
    date=d.isoformat();rows,base=resolve(date);day=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'][d.weekday()]
    dayrows=[r for r in rows if norm(r['hari'])==norm(day)]
    for r in dayrows:
        n=nip(r['nip']);names.setdefault(n,r['nama_guru']);ids.setdefault(n,r['nip'])
        key=(date,n,norm(r['kelas']),hour(r))
        if key in expected:schedule_duplicates+=1;continue
        record={**r,'date':date,'teacher':n,'holiday':holiday(date,r['kelas'],hour(r)), 'journal':None}
        expected[key]=record;raw.append(record)
    calendar.append({'date':date,'version':base['berlaku_mulai'] if base else '', 'slots':len(dayrows)})
    d+=datetime.timedelta(days=1)

exceptions=[]; matched=[]
for j in x['journals']:
    n=nip(j['nip']);names.setdefault(n,j['nama_guru']);ids.setdefault(n,j['nip'])
    key=(j['tanggal'],n,norm(j['kelas']),hour(j));r=expected.get(key)
    h=holiday(j['tanggal'],j['kelas'],hour(j))
    if h:reason='Tanggal/jam dinonaktifkan Master Libur'
    elif not r:reason='Guru/kelas/jam tidak cocok dengan jadwal berlaku'
    elif norm(j['mata_pelajaran'])!=norm(r['mata_pelajaran']):reason='Mata pelajaran berbeda dari jadwal'
    elif r['journal']:reason='Jurnal ganda pada slot yang sama'
    else:
        r['journal']=j;matched.append(j);continue
    exceptions.append({'reason':reason,'j':j})

teacher_set=set(r['teacher'] for r in raw)|set(nip(j['nip']) for j in x['journals'])
teacher_set|={nip(t['nip']) for t in x['teachers'] if t['aktif'] and norm(t.get('jenis_pegawai')) in ('','guru')}
teachers=sorted(teacher_set,key=lambda n:norm(names[n]))
categories=sorted(set(j['kategori_kehadiran'] or '(Kosong status)' for j in matched))
def stats(n=None,m=None):
    rows=[r for r in raw if (n is None or r['teacher']==n) and (m is None or r['date'].startswith(m))]
    lib=[r for r in rows if r['holiday']];eff=[r for r in rows if not r['holiday']]
    js=[r['journal'] for r in eff if r['journal']]
    cat=collections.Counter(j['kategori_kehadiran'] or '(Kosong status)' for j in js)
    present=sum(cat[c] for c in ['Sesuai','Terlambat','Daring','Penugasan dengan pendampingan','Keluar sebelum waktunya','Terlambat Keluar Kelas','Mengambil waktu istirahat'])
    return dict(raw=len(rows),lib=len(lib),eff=len(eff),js=len(js),missing=len(eff)-len(js),cat=cat,present=present,
      days=len(set(r['date'] for r in eff)),jdays=len(set(j['tanggal'] for j in js)))
total=stats()
assert len(matched)+len(exceptions)==len(x['journals'])
assert total['raw']==total['lib']+total['eff']
assert total['eff']==total['js']+total['missing']
assert sum(stats(n)['js'] for n in teachers)==total['js']
assert sum(stats(m=m)['raw'] for m in months)==total['raw']
audit={'total':total,'teachers':len(teachers),'matched':len(matched),'exceptions':dict(collections.Counter(e['reason'] for e in exceptions)),'schedule_duplicates':schedule_duplicates,'per_month':{m:stats(m=m) for m in months},'categories':categories}
(ROOT/'tmp/attendance-validation.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(audit,ensure_ascii=False,indent=2))

styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyID',fontName='Helvetica',fontSize=9,leading=13,spaceAfter=6,textColor=colors.HexColor('#263445')))
styles.add(ParagraphStyle(name='SmallID',parent=styles['BodyID'],fontSize=7.4,leading=10,spaceAfter=3))
styles.add(ParagraphStyle(name='CellID',fontName='Helvetica',fontSize=7.2,leading=9))
styles.add(ParagraphStyle(name='HeadID',parent=styles['CellID'],textColor=colors.white,fontName='Helvetica-Bold',alignment=TA_CENTER))
styles.add(ParagraphStyle(name='TitleID',fontName='Helvetica-Bold',fontSize=15,leading=19,spaceAfter=9,textColor=colors.HexColor('#123c60')))
styles.add(ParagraphStyle(name='SubID',parent=styles['TitleID'],fontSize=11,leading=14,spaceBefore=8,spaceAfter=7))
def p(v,style='BodyID'):return Paragraph(html.escape(str(v)).replace('\n','<br/>'),styles[style])
story=[];W,H=landscape(A4);usable=W-28*mm
def table(headers,rows,widths):
    data=[[p(h,'HeadID') for h in headers]]+[[p(c,'CellID') for c in row] for row in rows]
    t=Table(data,colWidths=[usable*w/sum(widths) for w in widths],repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#174b6e')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f1f5f8')]),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#cad4dd')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
    story.append(t);story.append(Spacer(1,4*mm))
def title(t,sub=None):
    story.append(p(t,'TitleID'))
    if sub:story.append(p(sub,'SmallID'))
def new():story.append(PageBreak())
def num(v):return f'{v:,}'.replace(',','.')
def pct(a,b):return f'{100*a/b:.1f}%'.replace('.',',') if b else '-'
def fdate(s):return datetime.date.fromisoformat(s).strftime('%d-%m-%Y')
def sign():
    story.append(Spacer(1,4*mm))
    t=Table([[p('Disiapkan untuk pemeriksaan Bidang Akademik','SmallID'),p('Gowa, 31 Oktober 2026\nMengetahui,\nKepala Madrasah','BodyID')],['',Spacer(1,13*mm)],['',p(x['profile'][0]['kepala_sekolah_nama']+'\nNIP '+x['profile'][0]['kepala_sekolah_nip'],'BodyID')]],colWidths=[usable*.65,usable*.35])
    story.append(KeepTogether([t]))

title('REKAP KEHADIRAN GURU','Kegiatan pembelajaran/pembimbingan | 1 Juli - 31 Oktober 2026 | Tahun pelajaran 2026/2027')
story.append(p('Rekap disusun dengan mencocokkan Jadwal Guru yang berlaku pada setiap tanggal dengan Jurnal Pembelajaran, setelah mengeluarkan slot yang dinonaktifkan oleh Master Libur. Satuan utama adalah slot guru-kelas-jam; satu slot jam ke-0 atau pembimbingan dihitung satu, sesuai struktur sumber.'))
table(['Guru dalam rekap','Jadwal sebelum libur','Dikurangi libur','Jadwal efektif','Jurnal cocok','Belum tercatat'],[[len(teachers),num(total['raw']),num(total['lib']),num(total['eff']),num(total['js']),num(total['missing'])]],[1,1,1,1,1,1])
table(['Bulan 2026','Jadwal awal','Libur','Efektif','Jurnal cocok','Belum tercatat','Cakupan jurnal'],[[label,num((s:=stats(m=m))['raw']),num(s['lib']),num(s['eff']),num(s['js']),num(s['missing']),pct(s['js'],s['eff'])] for m,label in months.items()],[1.2,1,1,1,1,1,1])
story.append(p('Cakupan jurnal = jurnal cocok / jadwal efektif. Angka ini menunjukkan kelengkapan pencatatan, bukan persentase kehadiran fisik. Jurnal yang berstatus "Kosong" atau "Penugasan tanpa pendampingan" tetap merupakan jurnal tercatat dan dipisahkan pada rincian kategori.'))
story.append(p(f"Sumber jurnal: {num(len(x['journals']))} baris, tanggal {fdate(min(j['tanggal'] for j in x['journals']))} sampai {fdate(max(j['tanggal'] for j in x['journals']))}. Sebanyak {num(len(exceptions))} baris tidak masuk hitungan jurnal cocok; rinciannya disajikan dalam lampiran rekonsiliasi.",'SmallID'))
sign()
new();title('DASAR PERHITUNGAN DAN BATAS INTERPRETASI')
notes=[
'Periode laporan adalah 1 Juli sampai 31 Oktober 2026. Hari tanpa jadwal tidak dihitung sebagai kewajiban mengajar; akhir pekan mengikuti data Jadwal Guru.',
'Versi jadwal mengikuti logika aplikasi: gunakan versi penuh terakhir yang sudah berlaku, lalu terapkan perubahan parsial setelahnya. Hanya baris berstatus aktif pada sumber saat pengambilan data yang diperhitungkan. Status aktif saat ini dapat memengaruhi rekonstruksi masa lalu; arsip yang telah dihapus atau dinonaktifkan tidak diasumsikan masih berlaku.',
'Pencocokan menggunakan tanggal, NIP yang dinormalisasi, kelas, nomor jam (termasuk jam ke-0), dan mata pelajaran. Perbedaan kapital/spasi diabaikan. Baris jadwal dengan kunci guru-kelas-tanggal-jam yang sama dihitung sekali.',
'Master Libur diterapkan sesuai tanggal, jam, dan cakupan semua kelas/tingkat/kelas. Entri kosong pada cakupan mengikuti aturan lama aplikasi, yaitu semua kelas. Libur nasional di luar Master Libur tidak ditambahkan otomatis.',
'Jurnal yang ada pada hari libur, tidak sesuai guru/kelas/jam, atau berbeda mata pelajaran dikeluarkan dari hitungan cocok dan ditampilkan untuk pemeriksaan. Pertukaran/penggantian guru yang tidak tercermin dalam versi jadwal tidak otomatis diatribusikan kepada guru jadwal.',
'Belum tercatat berarti jadwal efektif belum mempunyai jurnal yang cocok. Ini tidak sama dengan alfa/tidak hadir. Kategori "Sesuai" dibaca sebagai status yang tercatat pada jurnal, bukan bukti presensi independen. Penanda is_generated tidak digunakan untuk menyimpulkan hadir; materi kosong tidak otomatis berarti absen.',
'Ringkasan hari pada rincian guru menunjukkan hari yang memiliki setidaknya satu slot efektif atau satu jurnal cocok. Satu hari berjurnal belum berarti semua jam pada hari itu telah terpenuhi.',
'Pembimbingan yang masuk Jadwal Guru ikut dalam rekap slot. Dua catatan jurnal tugas tambahan disajikan tersendiri sebagai kegiatan tercatat; tidak dikonversi menjadi JP karena sumber tidak mencatat durasi atau jadwal pembanding.',
]
for i,n in enumerate(notes,1):story.append(p(f'{i}. {n}'))
story.append(p('Sumber: basis data ACCA - Jadwal Guru, Versi Jadwal, Jurnal Guru, Master Libur, Master Guru, Master Kelas, Jurnal Tugas Tambahan, dan Profil Sekolah. Snapshot sumber diambil pada 31 Oktober 2026. Nama kepala madrasah dan logo mengikuti Profil Sekolah. Ruang tanda tangan disediakan untuk pengesahan manual.','SmallID'))

for start in range(0,len(teachers),14):
    new();title('REKAP PER GURU - JULI S.D. OKTOBER 2026',f'Daftar {start+1}-{min(start+14,len(teachers))} dari {len(teachers)} guru | Seluruh angka jam adalah slot guru-kelas-jam')
    rows=[]
    for i,n in enumerate(teachers[start:start+14],start+1):
        s=stats(n);rows.append([i,names[n]+'\nNIP '+ids[n],s['raw'],s['lib'],s['eff'],s['js'],s['missing'],f"{s['jdays']}/{s['days']}",pct(s['js'],s['eff'])])
    table(['No','Nama guru / NIP','Jadwal awal','Libur','Efektif','Jurnal cocok','Belum tercatat','Hari jurnal / efektif','Cakupan jurnal'],rows,[.4,3.5,.8,.6,.8,.85,.95,1.1,.9])
    story.append(p('Guru aktif yang tidak memiliki jadwal efektif tetap ditampilkan dengan angka 0. Daftar juga mencakup guru yang muncul pada jadwal/jurnal periode ini, meskipun status pegawainya saat ini berbeda.','SmallID'))

for m,label in months.items():
    for start in range(0,len(teachers),21):
        new();title(f'REKAP BULAN {label.upper()} 2026',f'Daftar {start+1}-{min(start+21,len(teachers))} | Hari = jumlah tanggal berbeda; slot = guru-kelas-jam')
        rows=[]
        for i,n in enumerate(teachers[start:start+21],start+1):
            s=stats(n,m);rows.append([i,names[n],s['days'],s['raw'],s['lib'],s['eff'],s['js'],s['missing'],pct(s['js'],s['eff'])])
        table(['No','Nama guru','Hari efektif','Jadwal awal','Libur','Efektif','Jurnal cocok','Belum tercatat','Cakupan jurnal'],rows,[.4,3.3,.85,.85,.6,.8,.85,1,.9])
        s=stats(m=m);story.append(p(f"Total {label}: {num(s['raw'])} jadwal awal - {num(s['lib'])} libur = {num(s['eff'])} efektif; {num(s['js'])} jurnal cocok dan {num(s['missing'])} belum tercatat.",'SmallID'))

new();title('KATEGORI KEHADIRAN PADA JURNAL YANG COCOK')
table(['Kategori sesuai sumber','Jumlah slot','Makna pembacaan'],[[c,total['cat'][c], 'Status jurnal pada slot jadwal efektif; tidak dinilai ulang dari materi/refleksi.'] for c in categories],[2.4,1,6])
story.append(p('Kategori lain seperti Tukaran, Diganti, Digabung, Sosialisasi, dan TKA dipertahankan apa adanya. Kategori tersebut tidak otomatis disamakan dengan kehadiran guru yang terjadwal.','SmallID'))
new();title('RINCIAN KATEGORI PER GURU','S = Sesuai | T = Terlambat | D = Daring | PD = Penugasan dengan pendampingan | W = kategori waktu | TP = Penugasan tanpa pendampingan | K = Kosong | L = kategori lainnya')
rows=[]
for i,n in enumerate(teachers,1):
    c=stats(n)['cat'];w=sum(c[k] for k in ['Keluar sebelum waktunya','Terlambat Keluar Kelas','Mengambil waktu istirahat']);known=sum(c[k] for k in ['Sesuai','Terlambat','Daring','Penugasan dengan pendampingan','Penugasan tanpa pendampingan','Kosong'])+w
    rows.append([i,names[n],c['Sesuai'],c['Terlambat'],c['Daring'],c['Penugasan dengan pendampingan'],w,c['Penugasan tanpa pendampingan'],c['Kosong'],sum(c.values())-known,sum(c.values())])
table(['No','Nama guru','S','T','D','PD','W','TP','K','L','Total jurnal'],rows,[.4,4.5,.6,.6,.6,.6,.6,.6,.6,.6,.9])

new();title('MASTER LIBUR YANG DIGUNAKAN','Cakupan libur mengikuti data master; kegiatan nonpembelajaran dapat dicatat sebagai hari tidak efektif.')
table(['Tanggal','Jam','Cakupan','Keterangan','Slot dikurangi'],[[fdate(h['tanggal']),h['jam_ke'],('Tingkat '+', '.join(h['target_kelas'])) if h['lingkup']=='tingkat' else (', '.join(h['target_kelas']) if h['lingkup']=='kelas' else 'Semua kelas'),h['keterangan'],sum(1 for r in raw if r['holiday'] and r['holiday']['id']==h['id'])] for h in x['holidays']],[1.1,.6,1.2,4.5,1])

new();title('REKONSILIASI JURNAL DI LUAR HITUNGAN COCOK')
table(['Alasan pemeriksaan','Jumlah baris'],[[k,v] for k,v in collections.Counter(e['reason'] for e in exceptions).items()],[5,1])
story.append(p('Baris ini tetap dipertahankan sebagai catatan sumber, tetapi tidak menambah jumlah jurnal cocok atau mengurangi kolom belum tercatat. Perbedaan perlu diperiksa pada sumber sebelum dipakai sebagai penilaian kehadiran.'))
groups=collections.defaultdict(list)
for e in exceptions:
    j=e['j'];groups[(e['reason'],nip(j['nip']),j['tanggal'][:7])].append(j)
table(['Nama guru','Bulan','Alasan','Baris','Tanggal jurnal'],[[names[n],months[m],reason,len(js),', '.join(sorted(set(j['tanggal'][8:] for j in js)))] for (reason,n,m),js in sorted(groups.items(),key=lambda z:(norm(names[z[0][1]]),z[0][2],z[0][0]))],[2.3,.85,3.2,.5,2.2])

new();title('CATATAN PEMBIMBINGAN / TUGAS TAMBAHAN','Catatan berikut disajikan terpisah dari jadwal efektif; satu catatan tidak otomatis setara satu JP.')
table(['Tanggal','Guru','Kegiatan','Hasil tercatat'],[[fdate(r['tanggal']),names.get(nip(r['nip']),r['nip']),r['kegiatan'],r['hasil']] for r in sorted(x['extra'],key=lambda r:r['tanggal'])],[1,1.8,3,4])
story.append(p('Riwayat versi yang memengaruhi periode laporan','SubID'))
used=set(c['version'] for c in calendar if c['version'])
table(['Berlaku mulai','Jenis','Keterangan sumber'],[[fdate(v['berlaku_mulai']),v['jenis'],v['catatan'] or '-'] for v in x['versions'] if v['berlaku_mulai'] in used],[1,1,7])
story.append(p(f"Pemeriksaan hitungan: jadwal awal = libur + efektif; efektif = jurnal cocok + belum tercatat; seluruh {num(len(x['journals']))} baris jurnal = {num(len(matched))} cocok + {num(len(exceptions))} di luar hitungan. {schedule_duplicates} duplikasi kunci jadwal dihapus dari penghitungan.",'SmallID'))

logo=ImageReader(str(ROOT/'tmp/logo-sekolah.png')); prof=x['profile'][0]
def header(c,doc):
    c.saveState();c.drawImage(logo,14*mm,H-35*mm,width=22*mm,height=22*mm,preserveAspectRatio=True,anchor='c',mask='auto')
    cx=W/2+8*mm
    c.setFillColor(colors.HexColor('#18374c'));c.setFont('Helvetica-Bold',11);c.drawCentredString(cx,H-16*mm,'KEMENTERIAN AGAMA REPUBLIK INDONESIA')
    c.setFont('Helvetica-Bold',15);c.drawCentredString(cx,H-23*mm,prof['nama'].upper())
    c.setFont('Helvetica',8);c.drawCentredString(cx,H-28.5*mm,prof['alamat']+', Kec. '+prof['kecamatan']+', '+prof['kabupaten_kota']+', '+prof['provinsi']+' '+prof['kode_pos'])
    c.setFont('Helvetica',7.8);c.drawCentredString(cx,H-33*mm,'NPSN '+prof['npsn']+' | '+prof['website']+' | '+prof['email'])
    c.setStrokeColor(colors.HexColor('#174b6e'));c.setLineWidth(1.3);c.line(14*mm,H-38*mm,W-14*mm,H-38*mm)
    c.setLineWidth(.3);c.line(14*mm,H-39*mm,W-14*mm,H-39*mm)
    c.setStrokeColor(colors.HexColor('#cad4dd'));c.line(14*mm,13*mm,W-14*mm,13*mm)
    c.setFillColor(colors.HexColor('#586775'));c.setFont('Helvetica',7)
    c.drawString(14*mm,9*mm,'Bidang Akademik | Rekap pembelajaran/pembimbingan | 1 Juli - 31 Oktober 2026')
    c.drawRightString(W-14*mm,9*mm,f'Halaman {doc.page}');c.restoreState()
out=ROOT/'output/pdf/Rekap_Kehadiran_Guru_Juli-Oktober_2026.pdf';out.parent.mkdir(parents=True,exist_ok=True)
doc=SimpleDocTemplate(str(out),pagesize=landscape(A4),rightMargin=14*mm,leftMargin=14*mm,topMargin=44*mm,bottomMargin=18*mm,title='Rekap Kehadiran Guru Juli-Oktober 2026 - MAN Insan Cendekia Gowa',author=prof['nama'])
doc.build(story,onFirstPage=header,onLaterPages=header)
print('PDF',out)

