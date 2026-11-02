from pathlib import Path
from pypdf import PdfReader
import hashlib, json, shutil
import pdfplumber

root=Path(__file__).resolve().parent.parent
dest=Path(r'D:\TW 3 Akademik')
files=[('SOP_Program_Remedial_Pengayaan_dan_Klinik_Pembelajaran_MAN_IC_Gowa.pdf',4),('Petunjuk_Pelaksanaan_Remedial_Pengayaan_dan_Klinik_MAN_IC_Gowa.pdf',11)]
audit=json.loads((root/'tmp/sop-program-validation.json').read_text(encoding='utf8'))
assert audit['planned_slot_pbm_conflicts']==0
assert audit['missing_time_mappings']==0
assert audit['regular_rows']==602 and audit['exception_rows']==18
for name,count in files:
    source=root/'output/pdf'/name
    reader=PdfReader(source)
    assert len(reader.pages)==count
    texts=[p.extract_text() for p in reader.pages]
    assert all(len(t)>200 for t in texts)
    full=' '.join(texts)
    for key in ['PJOK pagi','pengecualian','16.00-17.00','16.15-17.15','1503','2026','Klinik','WKM Akademik','Imran, S.Si.','199309082019031013','Mengetahui','Menunggu Guru','Approval Sesi','Ajukan Ulang','Approved']:
        assert key in full,(name,key)
    assert any('di luar' in t and 'reguler' in t for t in texts)
    assert sum(len(p.get('/Annots',[])) for p in reader.pages)>=5
    assert all(abs(float(p.mediabox.width)-612)<1 and abs(float(p.mediabox.height)-936)<1 for p in reader.pages)
    with pdfplumber.open(source) as pdf:
        for i,page in enumerate(pdf.pages,1):
            assert all(35<=c['x0']<=c['x1']<=577 for c in page.chars),(name,i,'teks di luar margin')
            headings={}
            for ch in page.chars:
                if abs(ch['size']-14)<.1 or abs(ch['size']-11)<.1:
                    headings.setdefault(round(ch['top'],1),[]).append(ch)
            for chars in headings.values():
                center=(min(c['x0'] for c in chars)+max(c['x1'] for c in chars))/2
                assert abs(center-306)<1,(name,i,'judul belum tengah',center)
    print(f'Terverifikasi: {name}; {count} halaman; rujukan aktif; tidak ada halaman kosong.')
dest.mkdir(parents=True,exist_ok=True)
for name,count in files:
    source=root/'output/pdf'/name
    target=dest/name
    shutil.copy2(source,target)
    assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest()
    print(f'Tersimpan: {target} ({target.stat().st_size:,} byte)')
