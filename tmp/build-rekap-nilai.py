import json,re,math,html,collections,datetime
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4,landscape
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parent.parent
x=json.loads((ROOT/'tmp/grades-source.json').read_text(encoding='utf8'))
TA='2026/2027';SEM=1;BP='Belum dipublish';PR='Program Remedial'
period=lambda r:r.get('tahun_ajaran')==TA and r.get('semester')==SEM
score_rows=list(filter(period,x['scores']));weights=list(filter(period,x['weights']));tasks=list(filter(period,x['tasks']))
key=lambda r:(r['kelas'].strip(),r['mapel'].strip().casefold())
groups=collections.defaultdict(lambda:{'scores':[],'tasks':[],'weights':[]})
for category,rows in [('scores',score_rows),('tasks',tasks),('weights',weights)]:
 for r in rows:groups[key(r)][category].append(r)
teachers={r['nip']:r['nama_lengkap'] for r in x['teachers']}
all_names={r['nisn']:r['nama_siswa'] for r in x['rosters'] if r['nama_siswa']}
default={'sumCount':4,'kkm':75,'ratioHarian':{'kuis':1,'tugas':1,'uh':2},'ratioRapor':{'sums':3,'pas':2}}
def natural(v):return [int(z) if z.isdigit() else z.casefold() for z in re.split(r'(\d+)',v)]
def classkey(v):
 parts=v.split(' ',1);return ({'X':10,'XI':11,'XII':12}.get(parts[0],99),natural(parts[1] if len(parts)>1 else ''))
def number(v):
 if v is None or v=='':return None
 n=float(v);assert math.isfinite(n) and 0<=n<=100
 return n
def rounded(v):return math.floor(float(v)+.5)
def fmt(v,integer=True):
 if v is None:return BP
 return str(rounded(v)) if integer else f'{v:.2f}'.rstrip('0').rstrip('.').replace('.',',')

raw_remedial=[];unmapped=[];duplicate_scores=[];reports=[];outside=[]
for gkey,g in sorted(groups.items(),key=lambda z:(classkey(z[0][0]),natural(z[0][1]))):
 k=gkey[0];m=(g['scores'] or g['tasks'] or g['weights'])[0]['mapel'];nips=sorted(set(r['nip'] for cat in g.values() for r in cat))
 assert len(nips)==1,(gkey,nips)
 nip=nips[0];cfg=g['weights'][0]['bobot_config'] if g['weights'] else default
 kkm=float(cfg.get('kkm') or 75);assert 0<kkm<=100
 count=int(cfg.get('sumCount',4));assert 1<=count<=20
 ratios=cfg.get('ratioHarian') or {'kuis':1,'tugas':1,'uh':1}
 rrapor=cfg.get('ratioRapor') or {'sums':3,'pas':2}
 roster=[r for r in x['rosters'] if r['kelas'].strip()==k and r['tahun_ajaran']==TA and r['semester']=='Ganjil' and r['aktif']]
 if not roster:roster=[r for r in x['rosters'] if r['kelas'].strip()==k and r['tahun_ajaran']==TA and r['aktif']]
 pupils={r['nisn']:r['nama_siswa'] for r in roster}
 for r in g['scores']:
  if r['nisn'] not in pupils:
   pupils[r['nisn']]=all_names.get(r['nisn'],r['nisn']);outside.append((k,m,r['nisn']))
 lookup={};active=set()
 for r in g['scores']:
  cell=(r['nisn'],r['jenis'],r['materi_tp'] or '',r['tagihan'] or '')
  if cell in lookup:duplicate_scores.append({'scope':gkey,'key':cell,'ignored_id':r['id']})
  else:lookup[cell]=r
  if number(r['nilai']) is not None:active.add(cell[1:])
 def get(n,kind,mat,tag=''):
  r=lookup.get((n,kind,mat,tag));return number(r['nilai']) if r else None
 def component(n,mat):
  weighted=0;den=0;missing=[];used=[]
  for kind,wkey in [('Tugas','tugas'),('Kuis','kuis')]:
   weight=float(ratios.get(wkey,0))
   ts=[t for t in g['tasks'] if t['jenis']==kind and t['materi_tp']==mat and (kind,mat,t['nama_tagihan']) in active]
   if ts and weight>0:
    vals=[get(n,kind,mat,t['nama_tagihan']) for t in ts]
    missing += [kind+': '+t['nama_tagihan'] for t,v in zip(ts,vals) if v is None]
    weighted+=sum(v if v is not None else 0 for v in vals)/len(vals)*weight;den+=weight
    used.extend((kind,mat,t['nama_tagihan']) for t in ts)
  wh=float(ratios.get('uh',0))
  if ('UH',mat,'') in active and wh>0:
   v=get(n,'UH',mat);weighted+=(v if v is not None else 0)*wh;den+=wh;used.append(('UH',mat,''))
   if v is None:missing.append('UH')
  raw=weighted/den if den else None
  return {'value':raw if not missing else None,'system':raw,'missing':missing,'used':used}
 rows=[]
 for n,name in sorted(pupils.items(),key=lambda z:natural(z[1])):
  sums=[component(n,f'SUM {i}') for i in range(1,count+1)];pas=get(n,'PAS','-')
  # Stored incomplete inputs remain unpublished rather than being converted to zero.
  need_sums=float(rrapor.get('sums',0))>0;need_pas=float(rrapor.get('pas',0))>0
  complete=(not need_sums or all(s['value'] is not None for s in sums)) and (not need_pas or pas is not None)
  denom=(float(rrapor.get('sums',0)) if need_sums else 0)+(float(rrapor.get('pas',0)) if need_pas else 0)
  rapor=None
  if complete and denom>0:
   rapor=((sum(s['value'] for s in sums)/count*float(rrapor.get('sums',0)) if need_sums else 0)+(pas*float(rrapor.get('pas',0)) if need_pas else 0))/denom
  low=[]
  for r in g['scores']:
   if r['nisn']!=n:continue
   v=number(r['nilai'])
   if v is not None and v<kkm:
    raw_remedial.append({'kelas':k,'mapel':m,'nip':nip,'nisn':n,'nama':name,'jenis':r['jenis'],'materi':r['materi_tp'] or '-','tagihan':r['tagihan'] or '-', 'nilai':v,'kkm':kkm,'id':r['id']})
    low.append(r['materi_tp'] or r['jenis'])
  for i,s in enumerate(sums,1):
   if s['value'] is not None and s['value']<kkm:low.append('SUM '+str(i))
  if pas is not None and pas<kkm:low.append('PAS')
  if rapor is not None and rapor<kkm:low.append('Rapor')
  incomplete=any(s['value'] is None for s in sums) or pas is None or rapor is None
  status=PR if low else ('Memenuhi KKM' if not incomplete else BP)
  rows.append({'nisn':n,'nama':name,'sums':sums,'pas':pas,'rapor':rapor,'status':status,'remedial':bool(low),'low':sorted(set(low)), 'incomplete':incomplete})
  used=set(u for s in sums for u in s['used'])|{('PAS','-','')}
  for r in g['scores']:
   if r['nisn']==n and (r['jenis'],r['materi_tp'] or '',r['tagihan'] or '') not in used:
    unmapped.append(r)
 reports.append({'kelas':k,'mapel':m,'nip':nip,'guru':teachers.get(nip,nip),'kkm':kkm,'count':count,'cfg':cfg,'rows':rows,'has_config':bool(g['weights']),'source_count':len(g['scores'])})

assert len(score_rows)==sum(r['source_count'] for r in reports)
assert len({r['id'] for r in raw_remedial})==len(raw_remedial)
assert len(raw_remedial)==sum(1 for r in score_rows if number(r['nilai']) is not None and number(r['nilai'])<next(a['kkm'] for a in reports if key(r)==(a['kelas'],a['mapel'].casefold())))
classes=sorted({r['kelas'] for r in reports},key=classkey)
totals={'classes':len(classes),'subjects':len(reports),'source_rows':len(score_rows),'student_subjects':sum(len(r['rows']) for r in reports),'raw_remedial':len(raw_remedial),'remedial_student_subjects':sum(s['remedial'] for r in reports for s in r['rows']),'incomplete_student_subjects':sum(s['incomplete'] for r in reports for s in r['rows']),'unmapped_score_rows':len(unmapped),'duplicate_score_rows':len(duplicate_scores),'outside_roster':len(set(outside))}
audit={'totals':totals,'class_summary':[{ 'kelas':k,'mapel':sum(r['kelas']==k for r in reports),'rekap_siswa':sum(len(r['rows']) for r in reports if r['kelas']==k),'remedial':sum(s['remedial'] for r in reports if r['kelas']==k for s in r['rows'])} for k in classes], 'unmapped':unmapped,'duplicates':duplicate_scores,'outside_roster':list(set(outside))}
(ROOT/'tmp/grades-validation.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(totals,ensure_ascii=False))

for font,file in [('TNR','times.ttf'),('TNRB','timesbd.ttf')]:pdfmetrics.registerFont(TTFont(font,'C:/Windows/Fonts/'+file))
styles=getSampleStyleSheet()
for nm,opts in {
 'BodyID':dict(fontName='TNR',fontSize=10,leading=13,spaceAfter=6),
 'SmallID':dict(fontName='TNR',fontSize=8.5,leading=11,spaceBefore=4,spaceAfter=4),
 'CellID':dict(fontName='TNR',fontSize=8,leading=9),
 'TinyID':dict(fontName='TNR',fontSize=7,leading=8),
 'HeadID':dict(fontName='TNRB',fontSize=8.5,leading=10,alignment=TA_CENTER),
 'TitleID':dict(fontName='TNRB',fontSize=14,leading=17,alignment=TA_CENTER,spaceAfter=7),
 'CenterID':dict(fontName='TNR',fontSize=10,leading=13,alignment=TA_CENTER,spaceAfter=7),
}.items():styles.add(ParagraphStyle(name=nm,**opts))
W,H=landscape(A4);U=W-28*mm;story=[];section=0
def p(t,st='BodyID'):return Paragraph(html.escape(str(t)).replace('\n','<br/>'),styles[st])
def para(t,st='BodyID'):story.append(p(t,st))
def page(title,sub=None):
 if story:story.append(PageBreak())
 para(title,'TitleID')
 if sub:para(sub,'CenterID')
def table(headers,rows,widths,tinycols=(),scorecols=(),lowcells=(),caption=None):
 data=([[p(caption,'HeadID')]+['']*(len(headers)-1)] if caption else [])+[[p(v,'HeadID') for v in headers]]+[[p(v,'TinyID' if j in tinycols else 'CellID') for j,v in enumerate(row)] for row in rows]
 t=Table(data,colWidths=[U*w/sum(widths) for w in widths],repeatRows=2 if caption else 1,hAlign='LEFT')
 ts=[('BACKGROUND',(0,0),(-1,1 if caption else 0),colors.HexColor('#edf1f5')),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#5a6066')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4)]
 if caption:ts.append(('SPAN',(0,0),(-1,0)))
 for col,row in lowcells:ts.extend([('BACKGROUND',(col,row),(col,row),colors.HexColor('#fff0dd'))])
 t.setStyle(TableStyle(ts));story.append(t)
def sig():
 story.append(Spacer(1,3*mm))
 t=Table([['',p('Gowa, 31 Oktober 2026\nKepala Madrasah,')],['',Spacer(1,16*mm)],['',p(x['profile'][0]['kepala_sekolah_nama']+'\nNIP '+x['profile'][0]['kepala_sekolah_nip'])]],colWidths=[U*.66,U*.34]);story.append(KeepTogether([t]))

page('REKAP NILAI PER KELAS','Semester Ganjil 2026/2027 | Data per 31 Oktober 2026')
table(['Kelas','Rekap kelas-mapel','Baris nilai sumber','Rekap siswa-mapel','Program Remedial','Belum lengkap'],[[totals[k] for k in ['classes','subjects','source_rows','student_subjects','remedial_student_subjects','incomplete_student_subjects']]],[1,1,1,1,1,1])
para('Cakupan: seluruh kombinasi kelas dan mata pelajaran yang memiliki nilai, tagihan penilaian, atau pengaturan bobot pada halaman Nilai untuk semester yang dipilih. Kelas reguler dan kelas peminatan disajikan sesuai nama kelas pada sumber.','SmallID')
para('Belum dipublish: nilai kosong, termasuk kolom yang belum pernah terisi. SUM dihitung dengan bobot Kuis/Tugas/UH pada aplikasi untuk kolom yang sudah aktif; bila nilai yang diperlukan masih kosong, SUM ditandai Belum dipublish. Rapor juga ditandai Belum dipublish jika komponen SUM/PAS berbobot belum lengkap. Nilai kosong tidak diganti nol.','SmallID')
para('Program Remedial: ada nilai tagihan, SUM, PAS, atau rapor yang terisi di bawah KKM. KKM mengikuti pengaturan kelas-mapel; jika tidak diatur, digunakan 75 sesuai nilai bawaan aplikasi. Nilai tepat sama dengan KKM memenuhi batas. Perbandingan memakai nilai sebelum pembulatan; rincian nilai di bawah KKM disajikan pada lampiran.','SmallID')
para('Angka rekap siswa-mapel menghitung seorang siswa sekali untuk setiap mata pelajaran yang diikutinya. Istilah Belum dipublish digunakan untuk nilai kosong sesuai ketentuan rekap ini; sumber Nilai tidak menyediakan penanda publikasi tersendiri.','SmallID')
if unmapped:para(f'{len(unmapped)} baris nilai tidak menjadi komponen perhitungan SUM/PAS pada konfigurasi aplikasi saat ini. Baris tersebut tetap dicantumkan pada lampiran nilai sumber dan tetap diperiksa terhadap KKM.','SmallID')
sig()

page('RINGKASAN PER KELAS','Semester Ganjil 2026/2027')
table(['No','Kelas','Mata pelajaran','Rekap siswa-mapel','Program Remedial','Belum lengkap'],[[i,k,sum(r['kelas']==k for r in reports),sum(len(r['rows']) for r in reports if r['kelas']==k),sum(s['remedial'] for r in reports if r['kelas']==k for s in r['rows']),sum(s['incomplete'] for r in reports if r['kelas']==k for s in r['rows'])] for i,k in enumerate(classes,1)],[.5,3.5,1,1.2,1.2,1.2])

for r in reports:
 n=r['count'];head=['No','NISN','Nama siswa']+[f'SUM {i}' for i in range(1,n+1)]+['PAS','Rapor','Keterangan']
 rows=[];lowcells=[]
 for i,s in enumerate(r['rows'],1):
  vals=[v['value'] for v in s['sums']]+[s['pas'],s['rapor']]
  for j,v in enumerate(vals,3):
   if v is not None and v<r['kkm']:lowcells.append((j,i))
  rows.append([i,s['nisn'],s['nama']]+[fmt(v,False) for v in vals]+[s['status']])
 # Eighteen pupils per sheet keeps the full publication text legible.
 for start in range(0,max(len(rows),1),18):
  page('REKAP NILAI KELAS '+r['kelas'].upper(),r['mapel']+' | Guru: '+r['guru']+' | KKM '+fmt(r['kkm'])+' | Ganjil 2026/2027')
  chunk=rows[start:start+18]
  table(head,chunk,[7,23,40]+[(269-7-23-40-26)/(n+2)]*(n+2)+[26],tinycols=list(range(3,len(head)-1)),lowcells=[(col,row-start) for col,row in lowcells if start<row<=start+18])

for k in classes:
 rs=sorted([r for r in raw_remedial if r['kelas']==k],key=lambda r:(natural(r['mapel']),natural(r['nama']),natural(r['materi']),r['jenis']))
 if not rs:continue
 page('PROGRAM REMEDIAL - KELAS '+k.upper(),'Rincian tagihan yang nilainya di bawah KKM')
 table(['No','Nama siswa','Mata pelajaran','Materi / jenis','Tagihan','Nilai','KKM','Keterangan'],[[i,r['nama'],r['mapel'],r['materi']+' / '+r['jenis'],r['tagihan'],fmt(r['nilai'],False),fmt(r['kkm']),PR] for i,r in enumerate(rs,1)],[.5,2.3,1.8,1.2,1,.65,.6,1.2],caption='PROGRAM REMEDIAL - KELAS '+k.upper())

for k in classes:
 rs=[r for r in score_rows if r['kelas'].strip()==k]
 if not rs:continue
 page('NILAI SUMBER - KELAS '+k.upper(),'Semester Ganjil 2026/2027')
 rs.sort(key=lambda r:(natural(r['mapel']),natural(all_names.get(r['nisn'],r['nisn'])),natural(r['materi_tp'] or ''),r['jenis'],r['tagihan'] or ''))
 out=[]
 for i,r in enumerate(rs,1):
  kkm=next(a['kkm'] for a in reports if key(r)==(a['kelas'],a['mapel'].casefold()));v=number(r['nilai'])
  status=BP if v is None else (PR if v<kkm else 'Memenuhi KKM')
  out.append([i,all_names.get(r['nisn'],r['nisn']),r['mapel'],(r['materi_tp'] or '-')+' / '+r['jenis'],r['tagihan'] or '-',fmt(v,False),fmt(kkm),status])
 table(['No','Nama siswa','Mata pelajaran','Materi / jenis','Tagihan','Nilai','KKM','Keterangan'],out,[.5,2.3,1.8,1.2,1,.7,.6,1.2],caption='NILAI SUMBER - KELAS '+k.upper())

logo=ImageReader(str(ROOT/'tmp/logo-sekolah.png'));prof=x['profile'][0]
def header(c,doc):
 c.saveState();c.setFillColor(colors.black)
 c.drawImage(logo,14*mm,H-36*mm,width=22*mm,height=22*mm,preserveAspectRatio=True,mask='auto')
 for text,y,size,bold in [
 ('KEMENTERIAN AGAMA REPUBLIK INDONESIA',15,12,True),('KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA',20.5,12,True),(prof['nama'].upper(),27,15,True),
 (prof['alamat']+', Kec. '+prof['kecamatan']+', '+prof['kabupaten_kota']+', '+prof['provinsi']+' '+prof['kode_pos'],32,9,False),
 ('Telp. '+prof['telepon']+' · Pos-el: '+prof['email']+' · Laman: '+prof['website'],36.5,9,False)]:
  c.setFont('TNRB' if bold else 'TNR',size);c.drawCentredString(W/2,H-y*mm,text)
 c.setLineWidth(1.5);c.line(14*mm,H-40*mm,W-14*mm,H-40*mm);c.setLineWidth(.5);c.line(14*mm,H-41*mm,W-14*mm,H-41*mm)
 c.setFont('TNR',8);c.drawString(14*mm,10*mm,'Rekap Nilai | Ganjil 2026/2027 | Data 31 Oktober 2026');c.drawRightString(W-14*mm,10*mm,'Halaman '+str(doc.page));c.restoreState()
out=ROOT/'output/pdf/Rekap_Nilai_Per_Kelas_Ganjil_2026-2027.pdf'
doc=SimpleDocTemplate(str(out),pagesize=landscape(A4),leftMargin=14*mm,rightMargin=14*mm,topMargin=46*mm,bottomMargin=18*mm,title='Rekap Nilai Per Kelas - Ganjil 2026/2027',author=prof['nama'])
doc.build(story,onFirstPage=header,onLaterPages=header)
print('PDF',out)
