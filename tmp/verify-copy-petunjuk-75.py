from pathlib import Path
import hashlib,json,re,shutil
from pypdf import PdfReader
import pdfplumber
ROOT=Path(__file__).resolve().parent.parent
audit=json.loads((ROOT/'tmp/petunjuk-75-validation.json').read_text(encoding='utf8'))
sop=Path(r'D:\TW 3 Akademik\SOP_Program_Remedial_Pengayaan_dan_Klinik_Pembelajaran_MAN_IC_Gowa.pdf')
assert hashlib.sha256(sop.read_bytes()).hexdigest()==audit['sop_sha256']
name='Petunjuk_Pelaksanaan_Remedial_Pengayaan_dan_Klinik_MAN_IC_Gowa.pdf'
source=ROOT/'output/pdf'/name
r=PdfReader(source);assert len(r.pages)==audit['guide_pages']==9
text=' '.join(page.extract_text() for page in r.pages)
for term in ['Gowa, 13 Juli 2026','paling singkat 75 menit','16.00-17.15','16.15-17.30','20.30-21.45','20.45-22.00','BIMBINGAN 75 MENIT','Imran, S.Si.','199309082019031013']:
 assert term in text,term
for term in ['31 Oktober 2026','60 menit','45 menit','16.00-17.00','16.15-17.15','Submitted','Approved','Approval','snapshot','Master Waktu','Master Libur','database']:
 assert term.casefold() not in text.casefold(),term
assert sum(audit['breakdown_minutes'])==75 and audit['schedule_conflicts']==0
assert sum(len(page.get('/Annots',[])) for page in r.pages)>=5
with pdfplumber.open(source) as doc:
 for i,page in enumerate(doc.pages,1):
  assert all(35<=ch['x0']<=ch['x1']<=577 for ch in page.chars),(i,'margin')
  assert all('TimesNewRoman' in ch['fontname'] for ch in page.chars),(i,'font')
  body=[c for c in page.chars if 135<c['top']<890]
  assert len(body)>100
  titles={}
  for ch in body:
   if abs(ch['size']-12)<.1:titles.setdefault(round(ch['top'],1),[]).append(ch)
  for line in titles.values():assert abs((min(c['x0'] for c in line)+max(c['x1'] for c in line))/2-306)<1
target=Path(r'D:\TW 3 Akademik')/name
try:
 shutil.copy2(source,target)
except PermissionError as error:
 if getattr(error,'winerror',None)!=32:raise
 target=target.with_name(target.stem+'_Revisi.pdf')
 shutil.copy2(source,target)
assert hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256(source.read_bytes()).digest()
assert hashlib.sha256(sop.read_bytes()).hexdigest()==audit['sop_sha256']
print('Petunjuk diperbarui: 9 halaman; kegiatan minimal 75 menit; tampilan dan font terverifikasi; SOP tidak berubah.')
print(target)
