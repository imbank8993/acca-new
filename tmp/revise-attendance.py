from pathlib import Path
source=Path(__file__).with_name('build-attendance.py').read_text(encoding='utf-8-sig')
# Reuse the verified source snapshot, schedule resolver, holiday rules and KOP.
exec(source[:source.index("title('REKAP KEHADIRAN GURU'")])

LEAVE={'penugasan tanpa pendampingan','kosong','jam kosong','penugasan dengan pendampingan'}
by=collections.defaultdict(list)
for r in raw:
    by[(r['date'],r['teacher'],norm(r['kelas']),norm(r['mata_pelajaran']))].append(r)
meetings=[]
for key,rows in sorted(by.items()):
    rows.sort(key=hour);blocks=[]
    for r in rows:
        if not blocks or hour(r)!=hour(blocks[-1][-1])+1:blocks.append([])
        blocks[-1].append(r)
    for block in blocks:
        effective=[r for r in block if not r['holiday']]
        if not effective:continue
        cats=set(norm(r['journal']['kategori_kehadiran']) for r in effective if r['journal'])
        meetings.append({'date':key[0],'teacher':key[1],'rows':effective,'leave':bool(cats & LEAVE),'cats':cats,'hours':[hour(r) for r in effective]})

def revised(n=None,m=None):
    ms=[r for r in meetings if (n is None or r['teacher']==n) and (m is None or r['date'].startswith(m))]
    a=sum(r['leave'] for r in ms)
    return len(ms),a,pct(len(ms)-a,len(ms))
rt=revised()
assert sum(revised(n)[0] for n in teachers)==rt[0]
assert sum(revised(n)[1] for n in teachers)==rt[1]
assert sum(revised(m=m)[0] for m in months)==rt[0]
assert sum(revised(m=m)[1] for m in months)==rt[1]
for n in teachers:
    a,b,c=revised(n);assert 0<=b<=a
print('REVISED',rt,'MONTHLY',{m:revised(m=m) for m in months})
(ROOT/'tmp/attendance-revised-validation.json').write_text(json.dumps({'total':rt,'monthly':{m:revised(m=m) for m in months},'teachers':{names[n]:revised(n) for n in teachers}},ensure_ascii=False,indent=2),encoding='utf8')

title('REKAP KEHADIRAN GURU','Kegiatan pembelajaran/pembimbingan | 1 Juli - 31 Oktober 2026 | Tahun pelajaran 2026/2027')
story.append(p('Rekap kehadiran berdasarkan Jadwal Guru dan Jurnal Pembelajaran, dengan penyesuaian masa berlaku jadwal serta Master Libur. Pertemuan tanpa catatan jurnal dihitung hadir (sesuai), mengikuti ketentuan penyusunan rekap ini.'))
table(['Periode','Jadwal (pertemuan)','Izin/Cuti','Persentase kehadiran'],[['Juli - Oktober 2026',num(rt[0]),num(rt[1]),rt[2]]],[3,2,2,2])
table(['Bulan 2026','Jadwal (pertemuan)','Izin/Cuti','Persentase kehadiran'],[[label,*revised(m=m)] for m,label in months.items()],[3,2,2,2])
story.append(p('Ketentuan perhitungan','SubID'))
for t in [
'Satu pertemuan adalah rangkaian jam berurutan pada tanggal, guru, kelas, dan mata pelajaran yang sama. Jam pembimbingan yang tercantum pada jadwal ikut dihitung. Pertemuan yang seluruh jamnya terkena Master Libur dikeluarkan.',
'Izin/Cuti dihitung dari kategori jurnal Penugasan tanpa pendampingan, Kosong/Jam kosong, dan Penugasan dengan pendampingan. Jika salah satu jam efektif dalam pertemuan memiliki kategori tersebut, pertemuan dihitung Izin/Cuti satu kali, meskipun terdapat beberapa jam atau kategori.',
'Pertemuan lainnya, termasuk yang tidak memiliki jurnal, dihitung hadir (sesuai). Persentase kehadiran = (Jadwal - Izin/Cuti) / Jadwal x 100%. Guru tanpa jadwal efektif ditampilkan dengan persentase "-".',
]:story.append(p(t,'SmallID'))
story.append(p('Istilah Izin/Cuti pada laporan ini merupakan pengelompokan tiga kategori jurnal sesuai ketentuan rekap, dan tidak menyatakan adanya dokumen izin/cuti administratif.','SmallID'))

headers=['No','Nama guru / NIP','Jadwal\n(pertemuan)','Izin/Cuti','Persentase\nkehadiran']
for start in range(0,len(teachers),14):
    new();title('REKAP KEHADIRAN PER GURU','Periode 1 Juli - 31 Oktober 2026 | Jadwal telah disesuaikan dengan Master Libur')
    table(headers,[[i,names[n]+'\nNIP '+ids[n],*revised(n)] for i,n in enumerate(teachers[start:start+14],start+1)],[.5,4.8,1.5,1.2,1.7])
    story.append(p('Izin/Cuti mencakup Penugasan tanpa pendampingan, Kosong/Jam kosong, dan Penugasan dengan pendampingan. Pertemuan tanpa jurnal dihitung hadir.','SmallID'))

for m,label in months.items():
    for start in range(0,len(teachers),21):
        new();title('REKAP KEHADIRAN BULAN '+label.upper()+' 2026','Satuan: pertemuan | Pertemuan tanpa jurnal dihitung hadir (sesuai)')
        table(['No','Nama guru','Jadwal\n(pertemuan)','Izin/Cuti','Persentase\nkehadiran'],[[i,names[n],*revised(n,m)] for i,n in enumerate(teachers[start:start+21],start+1)],[.5,4.8,1.5,1.2,1.7])
        a,b,c=revised(m=m)
        story.append(p(f'Total {label}: {num(a)} pertemuan; Izin/Cuti {num(b)} pertemuan; persentase kehadiran {c}.','SmallID'))

for start in range(0,len(teachers),21):
    new();title('RINCIAN DASAR IZIN/CUTI','Jumlah pertemuan yang memuat setiap kategori; satu pertemuan dapat memuat lebih dari satu kategori.')
    rows=[]
    for i,n in enumerate(teachers[start:start+21],start+1):
        ms=[r for r in meetings if r['teacher']==n]
        counts=[sum(bool(r['cats'] & set(c)) for r in ms) for c in [('penugasan tanpa pendampingan',),('kosong','jam kosong'),('penugasan dengan pendampingan',)]]
        rows.append([i,names[n],*counts,revised(n)[1]])
    table(['No','Nama guru','Penugasan tanpa\npendampingan','Kosong /\nJam kosong','Penugasan dengan\npendampingan','Izin/Cuti\nunik'],rows,[.5,3.6,1.5,1.2,1.5,1.1])
    story.append(p('Izin/Cuti unik menghitung setiap pertemuan hanya satu kali. Karena kategori dalam satu pertemuan dapat berbeda antarjam, penjumlahan tiga kolom kategori dapat melebihi jumlah Izin/Cuti unik.','SmallID'))

new();title('DASAR PENGOLAHAN DATA')
for t in [
'Periode: 1 Juli - 31 Oktober 2026. Data menggunakan snapshot ACCA yang sama dengan rekap sebelumnya, diambil pada 31 Oktober 2026. Jurnal sumber tersedia untuk 14 Juli - 30 Oktober 2026.',
'Jadwal mengikuti versi penuh terakhir yang sudah berlaku dan perubahan parsial sesudahnya, dengan baris aktif yang tersedia pada sumber. Rekonstruksi masa lalu dibatasi oleh arsip dan status aktif jadwal yang tersimpan.',
'Master Libur diterapkan menurut tanggal, jam, kelas, dan tingkat. Rangkaian jadwal dibentuk terlebih dahulu; jika hanya sebagian jamnya terkena libur, sisa jam efektif tetap dihitung sebagai satu pertemuan.',
'Jurnal dicocokkan berdasarkan tanggal, NIP, kelas, nomor jam, dan mata pelajaran. Sebanyak 167 baris jurnal tidak cocok dengan jadwal efektif: 4 terkena Master Libur, 156 berbeda guru/kelas/jam, dan 7 berbeda mata pelajaran. Baris tersebut tidak digunakan untuk menambah Izin/Cuti. Jika pertemuan jadwal tidak memiliki jurnal yang cocok, pertemuan tetap dianggap hadir sesuai ketentuan rekap.',
'Guru aktif serta guru yang muncul pada jadwal/jurnal periode ini tetap ditampilkan. Dua jurnal tugas tambahan di luar jadwal tidak menambah jumlah pertemuan karena tidak memiliki jadwal pembanding.',
'Dokumen ini menggantikan perhitungan cakupan jurnal pada versi sebelumnya dengan persentase kehadiran berdasarkan ketentuan rekap yang ditetapkan. Logo, identitas, dan nama kepala madrasah mengikuti Profil Sekolah.',
]:story.append(p(t))
sign()

exec(source[source.index('logo=ImageReader'):])
