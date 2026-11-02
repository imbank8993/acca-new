import json,html,math
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parent.parent
prof=json.loads((ROOT/'tmp/attendance-source.json').read_text(encoding='utf8'))['profile'][0]
for name,file in [('TNR','times.ttf'),('TNRB','timesbd.ttf'),('TNRI','timesi.ttf')]:pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
styles=getSampleStyleSheet()
for name,kw in {
 'BodyID':dict(fontName='TNR',fontSize=10.5,leading=14,spaceAfter=7),
 'SmallID':dict(fontName='TNR',fontSize=9,leading=12,spaceAfter=5),
 'CellID':dict(fontName='TNR',fontSize=9,leading=11),
 'HeadID':dict(fontName='TNRB',fontSize=9,leading=11,alignment=TA_CENTER),
 'TitleID':dict(fontName='TNRB',fontSize=14,leading=18,alignment=TA_CENTER,spaceAfter=12),
 'SubID':dict(fontName='TNRB',fontSize=11.5,leading=14,spaceBefore=8,spaceAfter=7),
 'CenterID':dict(fontName='TNR',fontSize=11,leading=15,alignment=TA_CENTER,spaceAfter=7),
}.items():styles.add(ParagraphStyle(name=name,**kw))
W,H=A4;U=W-32*mm;story=[]
def p(t,style='BodyID'):return Paragraph(html.escape(str(t)).replace('\n','<br/>'),styles[style])
def para(t,style='BodyID'):story.append(p(t,style))
def sub(t):para(t,'SubID')
def page(t):
 if story:story.append(PageBreak())
 para(t,'TitleID')
def table(head,rows,widths):
 data=([[p(v,'HeadID') for v in head]] if head else [])+[[p(v,'CellID') for v in row] for row in rows]
 t=Table(data,colWidths=[U*w/sum(widths) for w in widths],repeatRows=1 if head else 0,hAlign='LEFT')
 t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,colors.HexColor('#555555')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6)]+([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#f1f5f9'))] if head else [])))
 story.extend([t,Spacer(1,4*mm)])
def question(no,text,space=6):
 story.append(KeepTogether([p(f'{no}. {text}'),Spacer(1,space*mm)]))
def ident():para('Nama: __________________________________  Kelas: __________','SmallID')
def sig():
 story.append(Spacer(1,8*mm))
 t=Table([[p('Mengetahui,\nKepala Madrasah'),p('Gowa, 31 Oktober 2026\nGuru Mata Pelajaran')],[Spacer(1,21*mm),Spacer(1,21*mm)],[p(prof['kepala_sekolah_nama']+'\nNIP '+prof['kepala_sekolah_nip']),p('Imran, S.Si.')]],colWidths=[U*.59,U*.41])
 story.append(KeepTogether([t]))

page('PROGRAM REMEDIAL DAN PENGAYAAN\nMATEMATIKA FASE F KELAS XI\nMATERI FUNGSI')
para('TAHUN PELAJARAN 2026/2027','CenterID')
story.append(Spacer(1,7*mm))
table(None,[['Satuan pendidikan',prof['nama']],['Mata pelajaran','Matematika'],['Fase / kelas','F / XI'],['Elemen','Aljabar dan Fungsi'],['Lingkup materi','Representasi fungsi, komposisi, invers, transformasi, dan pemodelan'],['Guru penyusun','Imran, S.Si.'],['Semester','Ganjil'],['Alokasi rencana','Remedial: 6 JP; pengayaan: 4 JP. Satu JP direncanakan 45 menit. Pelaksanaan sesuai kebutuhan dan jadwal madrasah.']],[1.6,3.9])
sig()

page('A. LANDASAN DAN ARAH PROGRAM')
table(['Acuan','Penerapan dalam program'],[
 ['KMA 450 Tahun 2024 sebagaimana diubah dengan KMA 1503 Tahun 2025','Kurikulum madrasah, layanan sesuai kebutuhan murid, serta integrasi nilai cinta ilmu, kepedulian, dan saling membantu. [1]'],
 ['Permendikdasmen 13 Tahun 2025','Perubahan kerangka kurikulum nasional yang menjadi konteks CP 2025. [2]'],
 ['Permendikdasmen 1 Tahun 2026','Rujukan standar proses terbaru; perencanaan, pelaksanaan, dan penilaian proses pembelajaran. [3]'],
 ['Permendikbudristek 21 Tahun 2022','Rujukan standar penilaian; pengumpulan bukti belajar dan pelaporan kemajuan. [4]'],
 ['Keputusan Kepala BSKAP 046/H/KR/2025','Acuan CP Matematika Fase F, elemen Aljabar dan Fungsi. [5]'],
 ['Panduan Pembelajaran dan Asesmen, revisi 2025','Pendampingan pada kompetensi yang belum dikuasai, asesmen formatif, dan pengayaan untuk pendalaman. [6]'],
 ],[2,3.6])
sub('CP yang menjadi acuan')
para('“Menentukan fungsi invers, komposisi fungsi, dan transformasi fungsi untuk memodelkan situasi dunia nyata menggunakan fungsi yang sesuai (linear, kuadrat, eksponensial).” [5]')
para('Keterangan pemutakhiran: penjelasan resmi Kemendikdasmen tanggal 23 Juni 2026 menyatakan perubahan CP melalui Keputusan Kepala BKPDM Nomor 020 Tahun 2026 terbatas pada Agama dan Budi Pekerti. CP Matematika tetap menggunakan keputusan tahun 2025. [7]','SmallID')
sub('Tujuan dan lingkup')
para('Program memberi bantuan terarah pada kesulitan fungsi dan memperluas kemampuan murid yang telah menguasainya. Representasi, domain, dan range dipakai sebagai prasyarat; sasaran unit diturunkan ke TP1-TP5. Capaian fase merupakan target akhir fase, sedangkan unit ini direncanakan untuk kelas XI sesuai ATP madrasah.')
para('Identifikasi peserta, tanggal kegiatan, dan hasil belajar diisi setelah asesmen nyata. Dokumen ini merupakan rencana program beserta instrumennya.','SmallID')

page('B. TUJUAN DAN KRITERIA KETERCAPAIAN')
table(['Kode','Tujuan pembelajaran unit','Bukti ketercapaian yang diamati'],[
 ['TP1','Membaca representasi fungsi serta menentukan nilai, domain, dan range pada konteks yang diberikan.','Menetapkan satu keluaran tiap masukan; nilai fungsi tepat; domain dan range sesuai batas konteks.'],
 ['TP2','Menentukan komposisi dua fungsi dan menafsirkan urutan proses.','Menuliskan urutan substitusi; memperoleh rumus dan nilai yang benar; memeriksa kecocokan domain.'],
 ['TP3','Menentukan invers fungsi yang dapat dibalik serta memeriksanya.','Menukar peran masukan-keluaran; memperoleh invers benar; memeriksa komposisi identitas dan pembatasan domain bila diperlukan.'],
 ['TP4','Menganalisis perubahan grafik fungsi akibat translasi, refleksi, atau skala.','Mengaitkan perubahan rumus dengan grafik; menempatkan titik acuan; memberi penjelasan arah/perubahan.'],
 ['TP5','Membangun dan mengevaluasi model fungsi linear, kuadrat, atau eksponensial.','Menentukan variabel, rumus, domain dan satuan; menyelesaikan pertanyaan konteks; menjelaskan makna dan keterbatasan model.'],
 ],[.6,2.5,3])
sub('Rubrik ketercapaian per TP')
table(['Level','Deskripsi operasional'],[
 ['1 - Perlu dukungan intensif','Konsep utama belum tampak; penyelesaian belum sesuai meskipun diberi pertanyaan penuntun.'],
 ['2 - Berkembang','Sebagian langkah tepat, tetapi masih terdapat kesalahan konsep atau memerlukan arahan langsung pada langkah utama.'],
 ['3 - Tercapai','Bukti esensial pada kolom di atas tampak secara mandiri; langkah dan penjelasan dapat dipertanggungjawabkan.'],
 ['4 - Melampaui','Memenuhi level 3 serta memeriksa dengan cara lain atau memberi generalisasi/contoh baru yang sah.'],
 ],[1.5,4.6])
para('KKTP program: setiap TP ditargetkan minimal level 3. TP level 1-2 mendapat remedial terarah; TP yang telah tercapai dapat diberi pengayaan. Pengelompokan bersifat fleksibel per TP. Rubrik dan batas level ini merupakan rancangan guru untuk unit ini, bukan ambang angka nasional.','SmallID')

page('C. PEMETAAN KEBUTUHAN BELAJAR')
para('Gunakan hasil pembelajaran reguler, tugas sebelumnya, wawancara singkat, dan asesmen awal pada halaman berikut. Catat jenis kesalahan, bukan hanya jumlah jawaban benar. Sampaikan TP dan rubrik sebelum kegiatan. [6]')
table(['Temuan','Layanan yang dipilih','Bukti kemajuan'],[
 ['TP1 belum tercapai','Model mesin fungsi, diagram panah, tabel masukan-keluaran; bantu membedakan domain dan range.','Murid menyusun tabel baru dan menjelaskan batas masukan dengan bahasanya sendiri.'],
 ['TP2 belum tercapai','Kartu proses bertingkat; warna berbeda untuk fungsi luar dan dalam; contoh terurai lalu bantuan dikurangi.','Murid menyusun dan memeriksa komposisi baru dengan urutan yang tepat.'],
 ['TP3 belum tercapai','Operasi balik bertahap; pasangan titik (x,y) dan (y,x); pemeriksaan melalui substitusi.','Murid memperoleh invers dan menjelaskan mengapa domain kuadrat perlu dibatasi.'],
 ['TP4 belum tercapai','Kertas berpetak atau aplikasi grafik; bandingkan titik acuan sebelum dan sesudah transformasi.','Murid menafsirkan perubahan rumus dan menggambar minimal tiga titik tepat.'],
 ['TP5 belum tercapai','Tabel variabel-satuan, gambar situasi, dan pemeriksaan kewajaran hasil.','Murid menghasilkan model dan alasan pemilihan domain yang dapat diterima.'],
 ['TP terkait telah tercapai','Pilihan tugas pengayaan dengan pembuktian sederhana, evaluasi model, dan komunikasi hasil.','Produk, penjelasan individual, dan refleksi tentang batas model.'],
 ],[1.3,2.6,2.5])
sub('Dukungan dan suasana belajar')
para('Kelompok kecil dibentuk berdasarkan kesulitan yang sama tanpa pelabelan kemampuan tetap. Guru mencontohkan cara berpikir, memberi umpan balik spesifik, dan memindahkan tanggung jawab secara bertahap. Tutor sebaya membantu diskusi dan tidak menggantikan pendampingan guru.')
para('Sediakan lembar cetak, waktu tambahan, pembacaan instruksi, atau jawaban lisan sesuai kebutuhan. Keterbatasan perangkat tidak mengurangi akses. Budaya cinta ilmu tampak melalui kejujuran proses; cinta diri dan sesama melalui bantuan yang menghargai usaha dan tidak mempermalukan kesalahan. [1]')

page('LAMPIRAN 1. ASESMEN AWAL')
ident();para('Waktu rencana: 30 menit. Kerjakan mandiri dan tuliskan alasan. Tanda ∘ menyatakan komposisi; f⁻¹ menyatakan invers fungsi.','SmallID')
question('D1 / TP1','Sewa alat mengikuti C(t) = 5.000t + 10.000 rupiah, dengan lama sewa t = 1, 2, 3 jam. Tentukan C(2), domain, dan range. Mengapa hubungan ini merupakan fungsi?',10)
question('D2 / TP2','Diketahui f(x) = 2x + 1 dan g(x) = x². Tentukan (g ∘ f)(x) dan (f ∘ g)(x). Apakah keduanya sama? Jelaskan urutan prosesnya. Domain kedua fungsi adalah bilangan real.',10)
question('D3 / TP3','Diketahui f(x) = 3x - 6 pada bilangan real. Tentukan f⁻¹(x), lalu periksa dengan menghitung f(f⁻¹(x)). Jelaskan peran masukan dan keluaran yang dipertukarkan.',10)
question('D4 / TP4','Grafik y = x² berubah menjadi y = (x - 2)² + 3. Jelaskan kedua pergeseran dan koordinat titik puncak grafik baru.',10)
question('D5 / TP5','Sebuah program menabung dimulai dengan saldo Rp20.000 dan penambahan tetap Rp5.000 per pekan tanpa bunga. Buat model S(n), tentukan domain n dari saat awal hingga akhir pekan keempat, hitung S(4), dan sebutkan satu asumsi model.',10)
para('Guru memberi level 1-4 untuk tiap TP menggunakan rubrik, lalu mengonfirmasi alasan melalui pertanyaan lisan bila bukti tertulis belum memadai. Tidak menempatkan semua murid pada satu layanan hanya berdasarkan nilai total.','SmallID')

page('D. RENCANA PROGRAM REMEDIAL')
para('Peserta: murid dengan bukti TP level 1-2. Layanan dipilih hanya untuk TP yang belum tercapai. Rencana maksimum satu siklus adalah 3 pertemuan × 2 JP; durasi dapat dikurangi atau ditambah menurut perkembangan. Tanggal ditetapkan setelah pemetaan.')
table(['Pertemuan','Fokus dan kegiatan','Waktu','Bukti / keputusan'],[
 ['R1\nTP1-TP2','Memahami: wawancara kesalahan dan contoh mesin fungsi (15 menit). Mengaplikasi: tabel dan kartu urutan proses dengan contoh terurai (35 menit), latihan berpasangan lalu mandiri (30 menit). Merefleksi: tiket keluar (10 menit).','2 JP\n90 menit','Dua contoh baru dijelaskan mandiri; TP yang tercapai tidak diulang pada R2.'],
 ['R2\nTP3-TP4','Memahami: operasi balik dan pasangan titik (15 menit). Mengaplikasi: bimbingan invers linear dan kuadrat terbatas (30 menit), grafik transformasi dengan titik acuan (35 menit). Merefleksi: jelaskan satu kesalahan awal (10 menit).','2 JP\n90 menit','Murid memeriksa invers dan memberi arah pergeseran yang benar; guru mencatat bantuan yang masih diperlukan.'],
 ['R3\nTP5 dan asesmen ulang','Memahami: tentukan variabel dan batas konteks (15 menit). Mengaplikasi: model tabungan/penurunan pemakaian (20 menit), asesmen ulang sesuai TP sasaran (40 menit). Merefleksi: umpan balik individual dan rencana lanjutan (15 menit).','2 JP\n90 menit','Nilai level TP dari bukti terbaru, bandingkan dengan bukti awal, lalu putuskan selesai atau layanan lanjutan.'],
 ],[.9,3.4,.7,1.6])
sub('Keputusan setelah remedial')
para('Jika TP mencapai level 3, murid kembali ke pembelajaran reguler atau masuk pengayaan pada TP tersebut. Jika belum, guru menelusuri kesalahan tersisa, mengubah bantuan, dan menjadwalkan siklus singkat berikutnya. Remedial meliputi pembelajaran ulang dan pendampingan, tidak berhenti pada pemberian tes. [6]')
para('Simpan hasil awal dan bukti terbaru beserta umpan balik. Pelaporan nilai mengikuti mekanisme madrasah; program ini tidak menetapkan pembatasan otomatis nilai remedial.','SmallID')

page('LAMPIRAN 2. LEMBAR KERJA REMEDIAL')
ident();para('Gunakan lembar tambahan jika perlu. Guru memilih butir sesuai TP sasaran. Jelaskan langkah, periksa hasil, lalu tulis bagian yang sudah dipahami.','SmallID')
question('R1 / TP1','Lengkapi tabel f(x) = 2x + 3 untuk x = -1, 0, 1. Tulis domain dan range. Bantuan: hitung hasil perkalian terlebih dahulu, lalu tambahkan 3.',8)
question('R2 / TP2','Diketahui f(x) = x + 2 dan g(x) = 3x, dengan domain real. Gambarkan alur x → f(x) → g(f(x)), tuliskan rumusnya, lalu hitung hasil saat x = 4. Bandingkan dengan f(g(4)).',8)
question('R3 / TP3','Tentukan invers f(x) = 2x + 5 pada domain real dan periksa f(f⁻¹(x)). Selanjutnya, apakah q(x) = x² pada domain real mempunyai invers yang juga fungsi? Jelaskan dan berikan satu pembatasan domain yang membuatnya dapat dibalik.',9)
question('R4 / TP4','Dari p(x) = x² diperoleh h(x) = (x + 1)² - 4. Tentukan pergeseran, titik puncak, serta h(-2), h(-1), dan h(0). Sketsakan grafik pada kertas berpetak.',9)
question('R5 / TP5','Pemakaian kertas dimodelkan P(n) = 80(1/2)ⁿ lembar per pekan, untuk n = 0, 1, 2, 3 setelah program digitalisasi. Hitung nilai-nilainya, jelaskan mengapa model eksponensial, dan makna pengali 1/2. Sebutkan satu keterbatasan model.',8)
para('Refleksi: Kesalahan yang saya perbaiki: __________________________________\nCara memeriksa jawaban saya: _________________________________________','SmallID')

page('LAMPIRAN 3. ASESMEN ULANG')
ident();para('Waktu rencana: 40 menit. Guru memilih TP yang perlu dinilai ulang. Kerjakan secara mandiri; bantuan pembelajaran diberikan kembali setelah asesmen bila masih diperlukan.','SmallID')
question('U1 / TP1','Biaya pengiriman C(n) = 4.000n + 6.000 rupiah, untuk n = 1, 2, 3 paket. Tentukan C(3), domain, dan range. Jelaskan mengapa hubungan ini merupakan fungsi.',8)
question('U2 / TP2','Diketahui f(x) = x - 1 dan g(x) = 2x + 3, keduanya berdomain real. Tentukan g(f(x)) dan f(g(x)), hitung g(f(4)), dan jelaskan urutan yang menghasilkan jawaban tersebut.',8)
question('U3 / TP3','Diketahui f(x) = 4x - 8 pada domain real. Tentukan inversnya dan periksa f(f⁻¹(x)). Untuk q(x) = x² dengan x ≥ 0, tuliskan invers dan domain inversnya.',8)
question('U4 / TP4','Dari p(x) = x² diperoleh h(x) = -(x - 3)² + 2. Jelaskan transformasinya, tentukan titik puncak, dan hitung nilai h(2), h(3), h(4) sebagai pemeriksaan.',8)
question('U5 / TP5','Pemakaian listrik awal 160 kWh per pekan dimodelkan turun 25% setiap pekan. Nyatakan E(n), domain n dari saat awal hingga akhir pekan ketiga, hitung E(2), dan jelaskan asumsi serta keterbatasan model.',8)
sub('Penetapan hasil')
para('Gunakan rubrik TP pada bagian B dan kunci pada lampiran guru. Tandai bukti yang sudah tampak dan satu perbaikan berikutnya. TP tercapai jika seluruh bukti esensialnya tampak mandiri pada level 3; kesalahan konsep tidak ditutupi oleh kelebihan skor pada TP lain.','SmallID')

page('E. RENCANA PROGRAM PENGAYAAN')
para('Peserta: murid yang telah mencapai level 3-4 pada TP sasaran. Murid dapat mengikuti pengayaan suatu TP sambil menyelesaikan remedial TP lain. Tugas memperluas penalaran dan pemodelan, bukan menambah banyak soal sejenis.')
table(['Pertemuan','Kegiatan','Waktu / produk'],[
 ['P1','Memahami (15 menit): pilih konteks, rumuskan variabel dan asumsi. Mengaplikasi (60 menit): kerjakan proyek A atau B dalam pasangan, uji dengan tabel/grafik, dan berikan argumen. Merefleksi (15 menit): periksa kecocokan rumus dan konteks.','2 JP / 90 menit\nDraf model dan catatan pemeriksaan.'],
 ['P2','Mengaplikasi (35 menit): perbaiki model berdasarkan masukan. Mengomunikasikan (35 menit): presentasi singkat dan verifikasi individual. Merefleksi (20 menit): evaluasi keterbatasan model dan rencana penerapan.','2 JP / 90 menit\nLaporan 1-2 halaman, grafik/tabel, dan refleksi individual.'],
 ],[.8,4,.9])
sub('Proyek A - Urutan diskon yang adil')
para('Harga barang awal x rupiah dengan x ≥ 25.000. D(x) = 0,8x merupakan diskon 20%; V(x) = x - 20.000 merupakan voucher. Bandingkan A(x) = V(D(x)) dan B(x) = D(V(x)).')
para('Tugas: (1) turunkan kedua rumus dan hitung pada x = 100.000; (2) buktikan selisih keduanya untuk semua x pada domain; (3) tentukan A⁻¹(y) dan B⁻¹(y) beserta domain invers; (4) rekomendasikan urutan paling menguntungkan pembeli dengan alasan; (5) sebutkan asumsi tentang syarat promo. Hubungkan dengan komunikasi harga yang jujur.')
sub('Proyek B - Model pengurangan penggunaan kertas')
para('Gunakan model P(n) = 160(3/4)ⁿ untuk n = 0, 1, 2, ...; Q(n) = 160(3/4)ⁿ⁺¹. Semua data dalam tugas ini adalah data simulasi, bukan hasil pengukuran madrasah.')
para('Tugas: (1) buat tabel P dan Q untuk n = 0 sampai 3; (2) tunjukkan Q(n) = 0,75P(n) dan tafsirkan pergeserannya jika fungsi diperluas ke waktu real; (3) cari pekan pertama ketika P(n) kurang dari 80; (4) jelaskan keterbatasan model kontinu untuk jumlah lembar; (5) usulkan satu cara menguji model dengan data nyata tanpa mengarang data.')

page('F. RUBRIK PENGAYAAN DAN REFLEKSI')
table(['Aspek','Level 1','Level 2','Level 3','Level 4'],[
 ['Model dan domain','Variabel/model belum sesuai.','Sebagian rumus tepat; domain belum jelas.','Rumus, variabel, satuan, dan domain benar.','Memeriksa batas domain dan memberi alternatif model yang sah.'],
 ['Prosedur dan pembuktian','Langkah utama tidak benar.','Ada langkah benar dengan arahan.','Perhitungan tepat dan argumen runtut secara mandiri.','Memberi generalisasi atau pemeriksaan berbeda.'],
 ['Evaluasi konteks','Tidak menafsirkan hasil.','Penafsiran sebagian sesuai.','Kesimpulan sesuai hasil dan menyebut asumsi.','Menguji keterbatasan serta memberi usul validasi.'],
 ['Komunikasi individual','Belum dapat menjelaskan proses.','Penjelasan bergantung pada pasangan.','Mampu menjelaskan kontribusi dan alasan sendiri.','Mampu menanggapi sanggahan dan memperbaiki penjelasan.'],
 ],[1.1,1.05,1.15,1.4,1.5])
para('Target produk: minimal level 3 pada keempat aspek. Skala ini ditetapkan guru untuk tugas pengayaan. Penjelasan individual wajib digunakan agar penilaian tidak hanya mengikuti hasil kelompok. Nilai kerja sama dicatat sebagai umpan balik dan tidak menggantikan bukti kompetensi matematika.','SmallID')
sub('Refleksi murid')
for i,t in enumerate(['Konsep fungsi apa yang paling membantu menyelesaikan tugas?','Bagaimana saya memeriksa kebenaran rumus atau grafik?','Asumsi apa yang dapat membuat model kurang sesuai kenyataan?','Bantuan apa yang saya perlukan dan langkah apa yang akan saya coba?'],1):question(i,t,6)
sub('Refleksi guru')
para('TP yang paling sering belum tercapai: __________________________________\nBantuan yang efektif dan bukti keberhasilannya: ____________________________\nPerubahan kegiatan untuk siklus berikutnya: ______________________________\nPeserta yang membutuhkan koordinasi lanjutan: ____________________________','SmallID')

page('LAMPIRAN 4. KUNCI ASESMEN AWAL\nDAN LEMBAR KERJA REMEDIAL')
table(['Butir','Jawaban dan bukti yang diperiksa'],[
 ['D1','C(2) = Rp20.000; domain {1, 2, 3}; range {15.000, 20.000, 25.000} rupiah. Setiap lama sewa memiliki tepat satu biaya.'],
 ['D2','g(f(x)) = (2x + 1)² = 4x² + 4x + 1; f(g(x)) = 2x² + 1. Tidak sama sebagai fungsi; proses yang dikerjakan lebih dahulu berada di bagian dalam. Domain keduanya real.'],
 ['D3','y = 3x - 6 → x = (y + 6)/3, sehingga f⁻¹(x) = (x + 6)/3. Pemeriksaan: 3[(x + 6)/3] - 6 = x. Invers mengembalikan keluaran menjadi masukan semula.'],
 ['D4','Bergeser 2 satuan ke kanan dan 3 ke atas; titik puncak (2, 3).'],
 ['D5','S(n) = 20.000 + 5.000n; domain {0, 1, 2, 3, 4}; S(4) = Rp40.000. Contoh asumsi: tidak ada penarikan, bunga, atau perubahan setoran.'],
 ['R1','f(-1) = 1, f(0) = 3, f(1) = 5. Domain {-1, 0, 1}; range {1, 3, 5}.'],
 ['R2','x → x + 2 → 3(x + 2); g(f(x)) = 3x + 6. Pada x = 4 hasilnya 18; f(g(4)) = 14. Domain real.'],
 ['R3','f⁻¹(x) = (x - 5)/2; 2[(x - 5)/2] + 5 = x. q pada domain real tidak satu-satu, misalnya q(-2) = q(2) = 4. Dapat dibatasi x ≥ 0; inversnya √x dengan domain x ≥ 0.'],
 ['R4','Bergeser 1 ke kiri dan 4 ke bawah; puncak (-1, -4). h(-2) = -3, h(-1) = -4, h(0) = -3.'],
 ['R5','P(0), P(1), P(2), P(3) berturut-turut 80, 40, 20, 10 lembar. Faktor pengali tetap 1/2, berarti turun 50% tiap pekan. Model tidak selalu dapat diteruskan karena jumlah lembar diskret dan penurunan nyata tidak selalu konstan.'],
 ],[.6,5.5])
para('Jawaban ekuivalen yang benar diterima. Periksa penalaran, penggunaan domain/satuan, dan kemandirian sesuai TP; hasil akhir tanpa penjelasan belum cukup untuk menetapkan seluruh bukti ketercapaian.','SmallID')

page('LAMPIRAN 5. KUNCI ASESMEN ULANG\nDAN PENGAYAAN')
table(['Butir','Jawaban / panduan pemeriksaan'],[
 ['U1','C(3) = Rp18.000; domain {1, 2, 3}; range {10.000, 14.000, 18.000} rupiah. Satu banyak paket menentukan tepat satu biaya.'],
 ['U2','g(f(x)) = 2x + 1; f(g(x)) = 2x + 2; g(f(4)) = 9. Urutan: 4 → f(4) = 3 → g(3) = 9.'],
 ['U3','f⁻¹(x) = (x + 8)/4; f(f⁻¹(x)) = 4[(x + 8)/4] - 8 = x. Untuk q pada x ≥ 0, q⁻¹(x) = √x dengan domain x ≥ 0.'],
 ['U4','Refleksi terhadap sumbu x, kemudian translasi 3 ke kanan dan 2 ke atas. Puncak (3, 2); h(2) = 1, h(3) = 2, h(4) = 1.'],
 ['U5','E(n) = 160(0,75)ⁿ kWh; domain {0, 1, 2, 3}; E(2) = 90 kWh. Asumsi: pengurangan 25% konsisten dan pembandingnya pekan sebelumnya. Keterbatasan: kebutuhan listrik tidak mungkin terus turun dengan pola tetap tanpa batas.'],
 ['Proyek A','A(x) = 0,8x - 20.000; B(x) = 0,8x - 16.000. Pada x = 100.000: A = Rp60.000 dan B = Rp64.000. B(x) - A(x) = 4.000 sehingga A selalu lebih murah pada domain yang diberikan.'],
 ['Invers proyek A','A⁻¹(y) = (y + 20.000)/0,8 dengan y ≥ 0; B⁻¹(y) = (y + 16.000)/0,8 dengan y ≥ 4.000. Keduanya berkodomain harga awal x ≥ 25.000. Syarat promo dan pembulatan diabaikan dalam model.'],
 ['Proyek B','Tabel P untuk n = 0, 1, 2, 3: 160; 120; 90; 67,5. Tabel Q: 120; 90; 67,5; 50,625. Q(n) = P(n + 1) = 0,75P(n). Pada perluasan real, grafik bergeser 1 ke kiri. Pada domain pekan, Q adalah pola yang satu langkah lebih maju.'],
 ['Evaluasi proyek B','P(2) = 90 ≥ 80 dan P(3) = 67,5 < 80, sehingga pekan pertama adalah n = 3. Nilai pecahan merepresentasikan model/rerata, bukan jumlah lembar teramati. Usul validasi: ukur pemakaian mingguan dengan prosedur tetap, bandingkan dengan prediksi, dan perbaiki parameter.'],
 ],[1,5.1])

page('LAMPIRAN 6. FORMAT PELAKSANAAN\nDAN TINDAK LANJUT')
sub('1. Pemetaan dan keputusan per peserta')
table(['No','Nama / kelas','TP sasaran','Level awal','Layanan','Level akhir / tindak lanjut'],[[i,'\n','', '', '', ''] for i in range(1,7)],[.4,1.5,.8,.7,.9,1.8])
sub('2. Jurnal pelaksanaan')
table(['Tanggal / JP','TP / kelompok','Bantuan atau tugas','Bukti belajar / umpan balik'],[['\n\n','','',''] for _ in range(3)],[1,1.1,1.8,2.2])
sub('3. Rekap evaluasi program')
table(None,[['Jumlah peserta remedial / pengayaan','____________ / ____________'],['TP yang tercapai setelah layanan','________________________________'],['TP yang masih perlu dukungan','________________________________'],['Tindak lanjut dan jadwal berikutnya','________________________________'],['Dokumen bukti','Hasil awal, lembar kerja, asesmen ulang, produk, rubrik, dan catatan umpan balik.']],[2.8,3.3])
para('Lembar ini diisi setelah kegiatan berdasarkan bukti yang tersedia. Kehadiran atau selesainya tugas saja tidak menggantikan bukti ketercapaian TP.','SmallID')

page('DAFTAR RUJUKAN RESMI')
refs=[
 ('[1] Kementerian Agama. KMA Nomor 1503 Tahun 2025 tentang perubahan atas KMA Nomor 450 Tahun 2024; terutama Bab IV Pembelajaran dan Asesmen.','https://sulteng.kemenag.go.id/files/show/20251020162801surat-penyampaian-kma-kurikulum-2025%2Blampiran_compressed-tzR.pdf'),
 ('[2] Permendikdasmen Nomor 13 Tahun 2025 tentang perubahan ketentuan kurikulum; tercantum dalam dasar hukum Keputusan Kepala BSKAP 046/H/KR/2025.','https://bpmpbabel.kemendikdasmen.go.id/PPID/wp-content/uploads/2025/07/KepKaBSKAP-046_2025-ttg-CP.pdf'),
 ('[3] Kemendikdasmen. Abstrak resmi Permendikdasmen Nomor 1 Tahun 2026 tentang Standar Proses. Berlaku 5 Januari 2026 dan menggantikan standar proses tahun 2022.','https://jdih.kemendikdasmen.go.id/sjdih/siperpu/dokumen/abstraksi/Abstrak%20RPM%20Standar%20Proses.pdf'),
 ('[4] Pusat Standar dan Kebijakan Pendidikan. Laman Standar Nasional Pendidikan, bagian Standar Penilaian; memuat rujukan Permendikbudristek Nomor 21 Tahun 2022.','https://pskp.kemendikdasmen.go.id/standar-nasional-pendidikan-a/standar-proses'),
 ('[5] Keputusan Kepala BSKAP Nomor 046/H/KR/2025. Lampiran II, Matematika, Fase F, elemen 6.2 Aljabar dan Fungsi.','https://bpmpbabel.kemendikdasmen.go.id/PPID/wp-content/uploads/2025/07/KepKaBSKAP-046_2025-ttg-CP.pdf'),
 ('[6] Kemendikdasmen. Panduan Pembelajaran dan Asesmen, Edisi Revisi 2025. Bagian kriteria ketercapaian, remedial, pengayaan, dan pengolahan hasil asesmen.','https://kurikulum.kemendikdasmen.go.id/file/1755668120_manage_file.pdf'),
 ('[7] Kemendikdasmen. Siaran pers 23 Juni 2026 tentang ruang lingkup pembaruan CP melalui Keputusan Kepala BKPDM Nomor 020 Tahun 2026.','https://www.kemendikdasmen.go.id/siaran-pers/15636-capaian-pembelajaran-baru-telah-terbit-yang-berubah-hanya-mata-pelajaran-agama-dan-budi-pekerti'),
]
for text,url in refs:
 para(text)
 story.append(Paragraph(f'<link href="{html.escape(url,quote=True)}" color="#174b6e"><u>Buka sumber resmi</u></link>',styles['SmallID']))
 story.append(Spacer(1,3*mm))
para('Pemeriksaan sumber: 31 Oktober 2026. Rencana waktu, perangkat tugas, rubrik, dan format administrasi dalam program ini disusun untuk kebutuhan unit oleh guru dan dapat diselaraskan dengan ATP serta kebijakan penilaian madrasah.','SmallID')

logo=ImageReader(str(ROOT/'tmp/logo-sekolah.png'))
def header(c,doc):
 c.saveState();c.setFillColor(colors.black)
 c.drawImage(logo,16*mm,H-36*mm,width=20*mm,height=20*mm,preserveAspectRatio=True,mask='auto')
 for text,y,size,bold in [
  ('KEMENTERIAN AGAMA REPUBLIK INDONESIA',14,10.2,True),
  ('KANTOR KEMENTERIAN AGAMA KABUPATEN GOWA',19,10.2,True),
  (prof['nama'].upper(),25,13,True),
  (prof['alamat']+', Kec. '+prof['kecamatan']+', '+prof['kabupaten_kota'],30,8.3,False),
  (prof['provinsi']+' '+prof['kode_pos']+' · Telp. '+prof['telepon'],34,8.3,False),
  ('Pos-el: '+prof['email']+' · Laman: '+prof['website'],38,8.3,False),
 ]:
  c.setFont('TNRB' if bold else 'TNR',size);c.drawCentredString(W/2,H-y*mm,text)
 c.setLineWidth(1.7);c.line(16*mm,H-42*mm,W-16*mm,H-42*mm);c.setLineWidth(.5);c.line(16*mm,H-43*mm,W-16*mm,H-43*mm)
 c.setFont('TNR',8);c.drawString(16*mm,11*mm,'Program Remedial dan Pengayaan Matematika | Imran, S.Si.');c.drawRightString(W-16*mm,11*mm,f'{doc.page}');c.restoreState()
out=ROOT/'output/pdf/Program_Remedial_Pengayaan_Matematika_Fase_F_XI_Fungsi_Imran.pdf'
doc=SimpleDocTemplate(str(out),pagesize=A4,leftMargin=16*mm,rightMargin=16*mm,topMargin=49*mm,bottomMargin=19*mm,title='Program Remedial dan Pengayaan Matematika Fase F XI - Fungsi',author='Imran, S.Si.')
doc.build(story,onFirstPage=header,onLaterPages=header)
print(out)
