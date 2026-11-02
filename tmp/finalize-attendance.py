from pathlib import Path
revision=Path(__file__).with_name('revise-attendance.py').read_text(encoding='utf-8-sig')
exec(revision[:revision.index("\ntitle('REKAP KEHADIRAN GURU'")])
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
fontdir=Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('TimesNewRoman',str(fontdir/'times.ttf')))
pdfmetrics.registerFont(TTFont('TimesNewRomanBold',str(fontdir/'timesbd.ttf')))
for st in ['BodyID','SmallID','CellID']:
    styles[st].fontName='TimesNewRoman';styles[st].textColor=colors.black
styles['CellID'].fontSize=9;styles['CellID'].leading=10
styles['HeadID'].fontName='TimesNewRomanBold';styles['HeadID'].textColor=colors.black;styles['HeadID'].fontSize=9;styles['HeadID'].leading=10
styles['TitleID'].fontName='TimesNewRomanBold';styles['TitleID'].textColor=colors.black;styles['TitleID'].alignment=TA_CENTER;styles['TitleID'].fontSize=13
styles['SmallID'].fontSize=10;styles['SmallID'].leading=12;styles['SmallID'].alignment=TA_CENTER

def table(headers,rows,widths):
    t=Table([[p(h,'HeadID') for h in headers]]+[[p(c,'CellID') for c in row] for row in rows],colWidths=[usable*w/sum(widths) for w in widths],repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#f1f5f9')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#333333')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5)]))
    story.append(t);story.append(Spacer(1,4*mm))

def jp(n=None,date=END):
    rows,_=resolve(date)
    keys={(r['nip'],norm(r['hari']),norm(r['kelas']),hour(r),norm(r['mata_pelajaran'])) for r in rows if n is None or nip(r['nip'])==n}
    return len(keys)

def sign():
    story.append(Spacer(1,3*mm))
    t=Table([['',p('Gowa, 31 Oktober 2026\nKepala Madrasah,','BodyID')],['',Spacer(1,16*mm)],['',p(x['profile'][0]['kepala_sekolah_nama']+'\nNIP '+x['profile'][0]['kepala_sekolah_nip'],'BodyID')]],colWidths=[usable*.64,usable*.36])
    story.append(KeepTogether([t]))

title('REKAP KEHADIRAN GURU\nKEGIATAN PEMBELAJARAN/PEMBIMBINGAN','Periode: 1 Juli - 31 Oktober 2026')
table(['Periode','Jumlah\nJP/Pekan','Jadwal\n(pertemuan)','Tidak Hadir','Persentase\nKehadiran'],[['Juli - Oktober 2026',jp(),num(rt[0]),num(rt[1]),rt[2]]],[3,1.4,1.7,1.4,1.8])
dates={'2026-07':'2026-07-31','2026-08':'2026-08-31','2026-09':'2026-09-30','2026-10':END}
table(['Bulan','Jumlah\nJP/Pekan','Jadwal\n(pertemuan)','Tidak Hadir','Persentase\nKehadiran'],[[label+' 2026',jp(date=dates[m]),*revised(m=m)] for m,label in months.items()],[3,1.4,1.7,1.4,1.8])
sign()

for start in range(0,len(teachers),12):
    new();title('REKAP KEHADIRAN PER GURU','Periode: 1 Juli - 31 Oktober 2026')
    table(['No','Nama Guru / NIP','Jumlah\nJP/Pekan','Jadwal\n(pertemuan)','Tidak Hadir','Persentase\nKehadiran'],[[i,names[n]+'\nNIP '+ids[n],jp(n),*revised(n)] for i,n in enumerate(teachers[start:start+12],start+1)],[.45,4.1,1,1.2,1,1.3])

for m,label in months.items():
    for start in range(0,len(teachers),21):
        new();title('REKAP KEHADIRAN GURU','Bulan: '+label+' 2026')
        table(['No','Nama Guru','Jumlah\nJP/Pekan','Jadwal\n(pertemuan)','Tidak Hadir','Persentase\nKehadiran'],[[i,names[n],jp(n,dates[m]),*revised(n,m)] for i,n in enumerate(teachers[start:start+21],start+1)],[.45,4.1,1,1.2,1,1.3])

for start in range(0,len(teachers),21):
    new();title('RINCIAN TIDAK HADIR','Periode: 1 Juli - 31 Oktober 2026')
    rows=[]
    for i,n in enumerate(teachers[start:start+21],start+1):
        ms=[r for r in meetings if r['teacher']==n]
        counts=[sum(bool(r['cats'] & set(c)) for r in ms) for c in [('penugasan tanpa pendampingan',),('kosong','jam kosong'),('penugasan dengan pendampingan',)]]
        rows.append([i,names[n],*counts,revised(n)[1]])
    table(['No','Nama Guru','Penugasan Tanpa\nPendampingan','Jam Kosong','Penugasan Dengan\nPendampingan','Jumlah Pertemuan\nTidak Hadir'],rows,[.45,3.6,1.5,1,1.5,1.5])

logo=ImageReader(str(ROOT/'tmp/logo-sekolah.png'));prof=x['profile'][0]
def header(c,doc):
    c.saveState();c.setFillColor(colors.black)
    c.drawImage(logo,14*mm,H-36*mm,width=22*mm,height=22*mm,preserveAspectRatio=True,mask='auto')
    cx=W/2
    for text,y,size,bold in [
      ('KEMENTERIAN AGAMA REPUBLIK INDONESIA',15,12,True),
      ('KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA',20.5,12,True),
      (prof['nama'].upper(),27,15,True),
      (', '.join([prof['alamat'],'Kec. '+prof['kecamatan'],prof['kabupaten_kota'],prof['provinsi'],prof['kode_pos']]),32,9,False),
      ('Telp. '+prof['telepon']+' · Pos-el: '+prof['email']+' · Laman: '+prof['website'],36.5,9,False),
    ]:
        c.setFont('TimesNewRomanBold' if bold else 'TimesNewRoman',size);c.drawCentredString(cx,H-y*mm,text)
    c.setStrokeColor(colors.black);c.setLineWidth(2.2);c.line(14*mm,H-40*mm,W-14*mm,H-40*mm)
    c.setLineWidth(.7);c.line(14*mm,H-41*mm,W-14*mm,H-41*mm)
    c.setFont('TimesNewRoman',8);c.drawRightString(W-14*mm,10*mm,f'Halaman {doc.page}');c.restoreState()

assert sum(jp(n) for n in teachers)==jp()
assert revised()==(4087,119,'97,1%')
print('JP/Pekan',jp(),'monthly',{m:jp(date=dt) for m,dt in dates.items()})
out=ROOT/'output/pdf/Rekap_Kehadiran_Guru_Juli-Oktober_2026.pdf'
doc=SimpleDocTemplate(str(out),pagesize=landscape(A4),rightMargin=14*mm,leftMargin=14*mm,topMargin=46*mm,bottomMargin=18*mm,title='Rekap Kehadiran Guru Juli-Oktober 2026',author=prof['nama'])
doc.build(story,onFirstPage=header,onLaterPages=header)
print('PDF',out)
