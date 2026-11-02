from pathlib import Path
import json, hashlib, shutil, re
from pypdf import PdfReader
import pdfplumber
ROOT=Path(__file__).resolve().parent.parent
layout=json.loads((ROOT/'tmp/sop-table-layout.json').read_text(encoding='utf8'))
FILES=[('SOP_Program_Remedial_Pengayaan_dan_Klinik_Pembelajaran_MAN_IC_Gowa.pdf',layout['sop_pages']),('Petunjuk_Pelaksanaan_Remedial_Pengayaan_dan_Klinik_MAN_IC_Gowa.pdf',layout['guide_pages'])]
for name,count in FILES:
 source=ROOT/'output/pdf'/name
 reader=PdfReader(source);assert len(reader.pages)==count
 text=' '.join(page.extract_text() for page in reader.pages)
 for term in ['Approval','Submitted','Approved','snapshot','Master Waktu','Master Libur','database','pending','finished','cancelled','baris aktif','versi penuh','slot','dipublish']:
  assert not re.search(re.escape(term),text,re.IGNORECASE),(name,term)
 for term in ['Imran, S.Si.','WKM Akademik','199309082019031013','197609152007101001','Mengetahui','PJOK pagi','di luar','16.00-17.00','16.15-17.15','1503','Persetujuan']:
  assert term.casefold() in text.casefold(),(name,term)
 assert sum(len(page.get('/Annots',[])) for page in reader.pages)>=5
 with pdfplumber.open(source) as pdf:
  for i,page in enumerate(pdf.pages,1):
   assert all(35<=ch['x0']<=ch['x1']<=577 for ch in page.chars),(name,i,'margin')
   assert all('TimesNewRoman' in ch['fontname'] for ch in page.chars),(name,i,'font')
   body=[ch for ch in page.chars if 135<ch['top']<890]
   assert all(round(ch['size']) in [11,12] for ch in body),(name,i,'ukuran huruf')
   assert len(body)>100,(name,i,'halaman kosong')
   titles={}
   for ch in body:
    if abs(ch['size']-12)<.1:titles.setdefault(round(ch['top'],1),[]).append(ch)
   for line in titles.values():assert abs((min(c['x0'] for c in line)+max(c['x1'] for c in line))/2-306)<1
 print(f'Terverifikasi: {name}; {count} halaman; Times New Roman; istilah Indonesia; tautan rujukan tersedia.')
dest=Path(r'D:\TW 3 Akademik')
assert dest.is_dir()
for name,_ in FILES:
 source=ROOT/'output/pdf'/name;target=dest/name
 shutil.copy2(source,target)
 assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest()
 print(f'Tersimpan: {target}')
