page('PROGRAM REMEDIAL DAN PENGAYAAN')
para('TAHUN PELAJARAN 2026/2027','CenterID')
story.append(Spacer(1,7*mm))
table(None,[['Satuan pendidikan',prof['nama']],['Mata pelajaran','Matematika'],['Fase / kelas','F / XI'],['Elemen','Aljabar dan Fungsi'],['Materi','Transformasi Fungsi'],['Guru penyusun',teacher],['NIP',teacher_nip],['Semester','Ganjil'],['Alokasi rencana','Remedial: 6 JP; pengayaan: 4 JP. Satu JP direncanakan 45 menit. Penjadwalan mengikuti kebutuhan peserta dan program madrasah.']],[1.6,3.9])
sig()

page('A. LANDASAN DAN TUJUAN PROGRAM')
table(['Acuan','Arah penerapan'],[
 ['KMA 450 Tahun 2024 sebagaimana diubah dengan KMA 1503 Tahun 2025','Layanan belajar sesuai kebutuhan murid dan penguatan nilai cinta ilmu, saling membantu, serta kepedulian lingkungan. [1]'],
 ['Permendikdasmen 13 Tahun 2025 dan 1 Tahun 2026','Kerangka kurikulum serta standar proses untuk perencanaan, pelaksanaan, dan penilaian proses. [2][3]'],
 ['Permendikbudristek 21 Tahun 2022','Bukti belajar digunakan untuk menilai kemajuan secara objektif dan menentukan tindak lanjut. [4]'],
 ['Keputusan Kepala BSKAP 046/H/KR/2025','CP Matematika Fase F, elemen Aljabar dan Fungsi. [5]'],
 ['Panduan Pembelajaran dan Asesmen, revisi 2025','Asesmen formatif, pendampingan pada kompetensi yang belum dikuasai, serta pengayaan untuk pendalaman. [6]'],
 ],[2,3.6])
sub('Capaian Pembelajaran yang relevan')
para('“Menentukan fungsi invers, komposisi fungsi, dan transformasi fungsi untuk memodelkan situasi dunia nyata menggunakan fungsi yang sesuai (linear, kuadrat, eksponensial).” [5]')
para('Penjelasan resmi Kemendikdasmen tanggal 23 Juni 2026 menyatakan perubahan CP melalui Keputusan Kepala BKPDM Nomor 020 Tahun 2026 hanya mencakup Agama dan Budi Pekerti. CP Matematika tetap menggunakan keputusan tahun 2025. [7]','SmallID')
sub('Tujuan program')
para('Program membantu murid menghubungkan perubahan rumus dengan perubahan grafik, memperbaiki miskonsepsi arah translasi dan faktor skala, serta memodelkan situasi melalui transformasi fungsi linear, kuadrat, dan eksponensial. Penempatan materi di kelas XI diselaraskan dengan ATP madrasah; CP merupakan target akhir fase.')
para('Program memuat rencana dan instrumen. Nama peserta, tanggal pelaksanaan, level awal/akhir, serta hasil program dicatat setelah kegiatan berdasarkan bukti nyata.','SmallID')

page('B. TUJUAN PEMBELAJARAN DAN KKTP')
table(['Kode','Tujuan pembelajaran','Bukti esensial ketercapaian'],[
 ['TP1','Membaca grafik dasar fungsi linear, kuadrat, dan eksponensial.','Menentukan minimal tiga titik, titik acuan, domain dan range pada konteks yang diberikan.'],
 ['TP2','Menentukan translasi horizontal dan vertikal suatu fungsi.','Menggunakan rumus pergeseran dengan tanda yang tepat serta memeriksa minimal dua titik.'],
 ['TP3','Menganalisis refleksi grafik terhadap sumbu koordinat.','Membedakan perubahan keluaran dan masukan; memeriksa pasangan titik sebelum dan sesudah refleksi.'],
 ['TP4','Menentukan peregangan/pemampatan vertikal dan horizontal.','Menentukan faktor skala geometris dengan benar dan menjelaskan perbedaan pengali di luar dan di dalam fungsi.'],
 ['TP5','Menyusun urutan transformasi dan menafsirkan modelnya.','Memperoleh rumus dan titik acuan yang benar, menjelaskan urutan operasi, serta menafsirkan domain, satuan, dan batas model.'],
 ],[.6,2.5,3])
sub('Rubrik ketercapaian per tujuan')
table(['Level','Deskripsi operasional'],[
 ['1 - Perlu dukungan intensif','Belum menunjukkan konsep utama walaupun diberi pertanyaan penuntun.'],
 ['2 - Berkembang','Sebagian langkah tepat; masih terdapat kesalahan konsep atau membutuhkan arahan pada langkah utama.'],
 ['3 - Tercapai','Seluruh bukti esensial TP tampak secara mandiri, dengan hasil dan penjelasan yang dapat diperiksa.'],
 ['4 - Melampaui','Memenuhi level 3 serta memberi pemeriksaan berbeda, contoh pembanding, atau generalisasi yang sah.'],
 ],[1.5,4.6])
para('KKTP program: setiap TP ditargetkan minimal level 3. TP level 1-2 diberi remedial terarah; TP yang telah tercapai dapat diberi pengayaan. Level dan kriteria ini merupakan rancangan guru untuk unit, bukan ambang nilai nasional. Penilaian tidak hanya berdasarkan total jawaban benar.','SmallID')

page('C. PETA KONSEP DAN MEDIA PENDAMPING')
table(['Transformasi','Rumus hasil','Pemetaan titik / makna'],[
 ['Translasi',r'$g(x)=f(x-h)+k$',r'$(u,v)\mapsto(u+h,v+k)$. Positif $h$: ke kanan; positif $k$: ke atas.'],
 ['Refleksi sumbu x',r'$g(x)=-f(x)$',r'$(u,v)\mapsto(u,-v)$.'],
 ['Refleksi sumbu y',r'$g(x)=f(-x)$',r'$(u,v)\mapsto(-u,v)$. Pada fungsi genap, grafik dapat tetap sama.'],
 ['Skala vertikal',r'$g(x)=af(x)$, $a\ne0$',r'$(u,v)\mapsto(u,av)$. Faktor geometris $|a|$; jika $a<0$, disertai refleksi sumbu x.'],
 ['Skala horizontal',r'$g(x)=f(bx)$, $b\ne0$',r'$(u,v)\mapsto\left(\frac{u}{b},v\right)$. Faktor geometris $\frac1{|b|}$; jika $b<0$, disertai refleksi sumbu y.'],
 ['Gabungan',r'$g(x)=af\bigl(b(x-h)\bigr)+k$',r'$(u,v)\mapsto\left(h+\frac{u}{b},k+av\right)$; $a,b\ne0$. Pemetaan membantu memeriksa hasil.'],
 ],[1.2,2.2,3.3])

# Vector diagrams remain sharp in the final PDF.
from reportlab.pdfgen import canvas as plotcanvas
from reportlab.lib import colors as plotcolors
c=plotcanvas.Canvas(str(target/'grafik.pdf'),pagesize=(440,165))
def drawplot(origin,fn,gn,ylim):
 ox,oy=origin;pw,ph=180,123;xmin,xmax=-3,3;ymin,ymax=ylim
 def point(x,y):return ox+(x-xmin)/(xmax-xmin)*pw,oy+(y-ymin)/(ymax-ymin)*ph
 c.setStrokeColor(plotcolors.HexColor('#d8dee5'));c.setLineWidth(.35)
 for x in range(-3,4):
  X,_=point(x,0);c.line(X,oy,X,oy+ph)
 for y in range(int(ymin),int(ymax)+1,2):
  _,Y=point(0,y);c.line(ox,Y,ox+pw,Y)
 c.setStrokeColor(plotcolors.black);c.setLineWidth(.6)
 x0,y0=point(0,0);c.line(ox,y0,ox+pw,y0);c.line(x0,oy,x0,oy+ph)
 c.setFont('Times-Roman',7)
 for x in [-2,0,2]:
  X,Y=point(x,0);c.drawString(X+1,Y+2,str(x))
 for y in [int(ymin)+2,int(ymax)-2]:
  X,Y=point(0,y);c.drawString(X+2,Y+2,str(y))
 c.drawString(ox+pw+3,y0,'x');c.drawString(x0+3,oy+ph+3,'y')
 for fun,color,dash in [(fn,'#64748b',[3,2]),(gn,'#164e63',[])]:
  c.setStrokeColor(plotcolors.HexColor(color));c.setLineWidth(1.15);c.setDash(dash);path=c.beginPath();active=False
  for i in range(401):
   x=xmin+(xmax-xmin)*i/400;y=fun(x)
   if ymin<=y<=ymax:
    X,Y=point(x,y)
    if active:path.lineTo(X,Y)
    else:path.moveTo(X,Y);active=True
   else:active=False
  c.drawPath(path)
 c.setDash([])
drawplot((20,20),lambda x:x*x,lambda x:(x-1)**2-2,(-3,10))
drawplot((245,20),lambda x:x*x,lambda x:-2*x*x,(-10,10))
c.setFont('Times-Bold',8);c.drawCentredString(110,154,'Grafik A');c.drawCentredString(335,154,'Grafik B');c.save()
story.append(r'\begin{center}\includegraphics[width=\linewidth,height=62mm,keepaspectratio]{grafik.pdf}\end{center}')
para(r'Garis putus-putus: $f(x)=x^2$. Garis penuh grafik A: $g(x)=(x-1)^2-2$; grafik B: $g(x)=-2x^2$. Bandingkan titik acuan dan faktor skala.','SmallID')

page('LAMPIRAN 1. ASESMEN AWAL')
ident();para('Waktu rencana: 30 menit. Kerjakan mandiri dan jelaskan alasan. Gunakan kertas berpetak bila diperlukan.','SmallID')
question('D1 / TP1',r'Lengkapi nilai $x=-1,0,1$ untuk $f(x)=2x+1$, $p(x)=x^2$, dan $q(x)=2^x$. Tentukan domain dan range masing-masing jika domain asalnya seluruh bilangan real.',10)
question('D2 / TP2',r'Dari $f(x)=x^2$ diperoleh $g(x)=(x-2)^2+3$. Jelaskan pergeseran, tentukan titik puncak, serta periksa $g(1)$ dan $g(3)$.',10)
question('D3 / TP3',r'Untuk $f(x)=2^x$, tulis rumus hasil refleksi terhadap sumbu x dan terhadap sumbu y. Tentukan pasangan titik bayangan dari $(1,2)$ pada masing-masing refleksi.',10)
question('D4 / TP4',r'Diketahui $f(x)=x^2$. Bandingkan $g(x)=2f(x)$ dengan $h(x)=f(2x)$. Tentukan faktor skala geometrisnya, bayangan titik $(1,1)$, dan nilai $g(1)$ serta $h(1)$.',10)
question('D5 / TP5',r'Grafik $f(x)=x^2$ direfleksikan terhadap sumbu x, lalu digeser 1 satuan ke kanan dan 4 ke atas. Tentukan rumus hasil, titik puncak, dan range-nya. Jelaskan urutan operasi.',10)
para('Guru menilai setiap TP dengan rubrik, kemudian mengonfirmasi alasan melalui wawancara singkat jika jawaban tertulis belum cukup.','SmallID')

page('D. RENCANA PROGRAM REMEDIAL')
para('Peserta dipilih berdasarkan TP level 1-2, bukan pelabelan kemampuan tetap. Satu siklus direncanakan 3 pertemuan × 2 JP. Guru memilih sesi sesuai kebutuhan dan menyesuaikan durasi dengan kemajuan murid.')
table(['Sesi','Kegiatan pendampingan','Waktu','Bukti kemajuan'],[
 ['R1\nTP1-TP2','Memahami: wawancara kesalahan dan grafik dasar (15 menit). Mengaplikasi: tabel titik dan kartu pergeseran (35 menit), latihan terbimbing lalu mandiri (30 menit). Merefleksi: tiket keluar tentang tanda pergeseran (10 menit).','2 JP\n90 menit','Tabel, titik puncak, dan dua titik pemeriksaan benar; bantuan dikurangi secara bertahap.'],
 ['R2\nTP3-TP4','Memahami: bedakan masukan dan keluaran (15 menit). Mengaplikasi: pasangkan titik refleksi (25 menit), bandingkan skala vertikal dan horizontal (40 menit). Merefleksi: jelaskan satu miskonsepsi yang diperbaiki (10 menit).','2 JP\n90 menit','Murid menjelaskan faktor kebalikan pada skala horizontal dan memeriksa hasil sendiri.'],
 ['R3\nTP5','Memahami: urutan transformasi dengan kartu proses (15 menit). Mengaplikasi: latihan model dan pemetaan titik (20 menit), asesmen ulang TP sasaran (40 menit). Merefleksi: umpan balik individual dan tindak lanjut (15 menit).','2 JP\n90 menit','Bukti level terbaru dibandingkan dengan awal; TP yang belum tercapai diberi bantuan lanjutan.'],
 ],[.7,3.7,.7,1.6])
sub('Pelaksanaan yang mendukung murid')
para('Gunakan kertas berpetak atau aplikasi grafik bila tersedia. Guru memberikan contoh terurai, mengajak murid menyebutkan alasan, lalu mengurangi bantuan. Tutor sebaya mendukung diskusi dan tidak menggantikan peran guru. Sediakan instruksi terbaca, waktu tambahan, atau jawaban lisan sesuai kebutuhan.')
para('Cinta ilmu dibiasakan melalui pemeriksaan jawaban yang jujur; cinta diri dan sesama melalui bantuan tanpa mempermalukan kesalahan. Tugas konteks lingkungan mendorong kepedulian pada penggunaan sumber daya.','SmallID')
sub('Keputusan setelah layanan')
para('TP minimal level 3 dinyatakan tercapai. Jika belum, ubah bentuk bantuan dan laksanakan siklus singkat berikutnya. Simpan bukti awal, lembar kerja, asesmen ulang, dan umpan balik. Pengolahan nilai mengikuti kebijakan madrasah; program ini tidak menetapkan pembatasan otomatis nilai remedial.')

page('LAMPIRAN 2. LEMBAR KERJA REMEDIAL')
ident();para('Guru memilih butir sesuai TP sasaran. Gunakan grafik dasar, pemetaan titik, dan pemeriksaan minimal dua titik.','SmallID')
question('R1 / TP1',r'Buat tabel $x=-1,0,1$ untuk $f(x)=x+2$, $p(x)=x^2$, dan $q(x)=2^x$. Bandingkan bentuk grafik, domain, dan range saat fungsi dipandang pada domain real.',9)
question('R2 / TP2',r'Untuk $f(x)=x^2$, tentukan rumus setelah pergeseran 1 ke kiri dan 2 ke bawah. Tuliskan puncak dan bayangan titik $(0,0)$ serta $(1,1)$. Bantuan: perubahan horizontal ditempatkan pada masukan fungsi.',9)
question('R3 / TP3',r'Untuk $f(x)=2^x$, tulis $-f(x)$ dan $f(-x)$. Cari bayangan $(1,2)$ dan hitung nilai kedua fungsi saat $x=1$. Mengapa arah pantulnya berbeda?',9)
question('R4 / TP4',r'Bandingkan $g(x)=3f(x)$ dan $h(x)=f(3x)$ untuk $f(x)=x^2$. Tuliskan rumus, faktor skala geometris, serta bayangan titik $(1,1)$ untuk masing-masing.',9)
question('R5 / TP5',r'Bentuk $g(x)=-2f(x-1)+3$ dari $f(x)=x^2$. Jelaskan satu urutan transformasi yang sesuai, tentukan puncak, range, serta $g(0)$ dan $g(2)$.',9)
para('Kesalahan yang saya perbaiki: ________________________________________\nCara memeriksa hasil saya: ___________________________________________','SmallID')

page('LAMPIRAN 3. ASESMEN ULANG')
ident();para('Waktu rencana: 40 menit. Kerjakan mandiri; guru menilai TP yang menjadi sasaran remedial.','SmallID')
question('U1 / TP1',r'Buat tabel $x=-1,0,1$ untuk $f(x)=3x-1$, $p(x)=x^2$, dan $q(x)=3^x$. Tentukan domain dan range pada domain real.',9)
question('U2 / TP2',r'Grafik $f(x)=x^2$ digeser 3 ke kanan dan 1 ke bawah. Tentukan rumus, puncak, serta nilai fungsi hasil saat $x=2$ dan $x=4$.',9)
question('U3 / TP3',r'Untuk $f(x)=3^x$, tentukan hasil refleksi terhadap sumbu x dan sumbu y. Tuliskan bayangan titik $(1,3)$ dan nilai kedua fungsi hasil saat $x=1$.',9)
question('U4 / TP4',r'Untuk $f(x)=x^2$, tentukan rumus, faktor skala geometris, dan bayangan titik $(1,1)$ pada $g(x)=\frac12 f(x)$ dan $h(x)=f\left(\frac{x}{2}\right)$.',9)
question('U5 / TP5',r'Grafik $f(x)=x^2$ mengalami skala vertikal faktor 2, kemudian refleksi terhadap sumbu x, translasi 2 ke kanan dan 5 ke atas. Tentukan rumus, puncak, range, serta nilai fungsi hasil saat $x=1$ dan $x=3$.',9)
para('Gunakan rubrik bagian B. TP tercapai ketika seluruh bukti esensialnya tampak mandiri pada level 3. Periksa konsep dan alasan; kelebihan pada TP lain tidak menggantikan bukti TP yang belum tercapai.','SmallID')

page('E. RENCANA PROGRAM PENGAYAAN')
para('Peserta telah mencapai minimal level 3 pada TP sasaran. Tugas dipilih sesuai minat; murid dapat mendapat pengayaan pada TP yang dikuasai sambil menyelesaikan remedial TP lain.')
table(['Sesi','Aktivitas','Waktu / produk'],[
 ['P1','Memahami konteks dan memilih tugas (15 menit); mengeksplorasi rumus, grafik, serta pemetaan titik (60 menit); merefleksi asumsi dan memeriksa hasil (15 menit).','2 JP / 90 menit\nDraf model, tabel, dan grafik.'],
 ['P2','Memperbaiki solusi berdasarkan umpan balik (35 menit); presentasi dan verifikasi individual (35 menit); refleksi keterbatasan serta rencana validasi (20 menit).','2 JP / 90 menit\nLaporan 1-2 halaman dan penjelasan individual.'],
 ],[.6,4.3,1.4])
sub('Proyek A - Apakah urutan transformasi berpengaruh?')
para(r'Definisikan operator $T(f)(x)=f(x-2)$ dan $D(f)(x)=2f(x)$. Untuk fungsi $f(x)=x^2$, bandingkan $D(T(f))$ dan $T(D(f))$ melalui rumus serta minimal tiga titik. Selanjutnya definisikan $V(f)(x)=f(x)+3$; bandingkan $D(V(f))$ dan $V(D(f))$.')
para('Tugas: buat tabel/grafik; nyatakan pasangan operasi yang dapat dipertukarkan dan yang tidak; jelaskan alasan; periksa apakah hasil tersebut berlaku untuk fungsi lain dengan satu argumen umum. Hasil diskusi dipertanggungjawabkan masing-masing murid.')
sub('Proyek B - Transformasi model penghematan kertas')
para(r'Model awal $P(t)=100\left(\frac12\right)^t$ lembar per pekan untuk $t\ge0$. Program baru dimulai pada pekan ke-1 dan dimodelkan $Q(t)=100\left(\frac12\right)^{2(t-1)}$ untuk $t\ge1$. Seluruh angka merupakan data simulasi.')
para(r'Tugas: nyatakan $Q$ sebagai transformasi $P$; gunakan pemetaan titik untuk menentukan faktor skala dan pergeseran; hitung $Q(1)$, $Q(2)$, $Q(3)$; tentukan waktu real saat $Q(t)=25$. Jelaskan pembatasan domain, keterbatasan nilai lembar pecahan, serta cara memeriksa model dengan pengamatan nyata tanpa mengarang data.')

page('F. RUBRIK PENGAYAAN DAN REFLEKSI')
table(['Aspek','Level 1','Level 2','Level 3','Level 4'],[
 ['Model dan grafik','Rumus atau titik acuan belum sesuai.','Sebagian tepat; ada kesalahan tanda atau skala.','Rumus, domain dan titik acuan benar.','Menguji batas atau memberi representasi alternatif yang sah.'],
 ['Argumen transformasi','Belum dapat memberi urutan.','Urutan dijelaskan dengan arahan.','Urutan dan faktor skala dijelaskan mandiri.','Memberi generalisasi atau contoh penyangkal yang valid.'],
 ['Evaluasi hasil','Tidak memeriksa kewajaran.','Pemeriksaan terbatas pada hasil akhir.','Memeriksa titik/rumus serta menyebut asumsi.','Menguji keterbatasan dan memberi rencana validasi.'],
 ['Komunikasi individual','Belum menjelaskan kontribusi.','Bergantung pada jawaban pasangan.','Menjelaskan alasan dan kontribusinya sendiri.','Menanggapi sanggahan serta memperbaiki penjelasan.'],
 ],[1.1,1.05,1.15,1.4,1.5])
para('Target: minimal level 3 pada keempat aspek. Ketentuan ini ditetapkan guru untuk tugas pengayaan. Produk kelompok dilengkapi verifikasi individual; kerja sama diberi umpan balik dan tidak menggantikan bukti kompetensi matematika.','SmallID')
sub('Refleksi murid')
for i,t in enumerate(['Bagaimana saya membedakan perubahan masukan dan keluaran?','Bagaimana saya memeriksa arah pergeseran atau faktor skala?','Apakah urutan transformasi selalu dapat dipertukarkan? Jelaskan.','Bantuan atau bukti apa yang masih saya perlukan?'],1):question(i,t,6)
sub('Refleksi guru')
para('Miskonsepsi yang masih muncul: _______________________________________\nBantuan yang efektif dan buktinya: _____________________________________\nPenyesuaian kegiatan berikutnya: ______________________________________','SmallID')

page('LAMPIRAN 4. KUNCI ASESMEN AWAL\nDAN LEMBAR KERJA REMEDIAL')
table(['Butir','Jawaban dan bukti yang diperiksa'],[
 ['D1',r'Nilai linear: $-1,1,3$; kuadrat: $1,0,1$; eksponensial: $\frac12,1,2$. Domain ketiganya $\mathbb R$. Range berturut-turut $\mathbb R$, $[0,\infty)$, dan $(0,\infty)$.'],
 ['D2',r'Geser 2 ke kanan dan 3 ke atas. Puncak $(2,3)$; $g(1)=g(3)=4$.'],
 ['D3',r'Sumbu x: $g(x)=-2^x$, bayangan $(1,-2)$. Sumbu y: $h(x)=2^{-x}$, bayangan $(-1,2)$.'],
 ['D4',r'$g(x)=2x^2$: faktor vertikal 2, bayangan $(1,2)$, $g(1)=2$. $h(x)=4x^2$: faktor horizontal $\frac12$, bayangan $\left(\frac12,1\right)$, $h(1)=4$.'],
 ['D5',r'$g(x)=-(x-1)^2+4$; puncak $(1,4)$; range $(-\infty,4]$. Urutan: refleksi, kemudian translasi.'],
 ['R1',r'Nilai linear: $1,2,3$; kuadrat: $1,0,1$; eksponensial: $\frac12,1,2$. Domain dan range seperti D1. Bandingkan garis lurus, parabola, dan kurva eksponensial.'],
 ['R2',r'$g(x)=(x+1)^2-2$. Puncak dan bayangan $(0,0)$ adalah $(-1,-2)$; bayangan $(1,1)$ adalah $(0,-1)$.'],
 ['R3',r'$g(x)=-2^x$, bayangan $(1,-2)$ dan $g(1)=-2$. $h(x)=2^{-x}$, bayangan $(-1,2)$ dan $h(1)=\frac12$. Tanda minus di luar mengubah keluaran; di dalam mengubah masukan.'],
 ['R4',r'$g(x)=3x^2$: faktor vertikal 3 dan bayangan $(1,3)$. $h(x)=9x^2$: faktor horizontal $\frac13$ dan bayangan $\left(\frac13,1\right)$.'],
 ['R5',r'$g(x)=-2(x-1)^2+3$. Urutan sah: skala vertikal 2, refleksi sumbu x, translasi 1 ke kanan dan 3 ke atas. Puncak $(1,3)$, range $(-\infty,3]$; $g(0)=g(2)=1$.'],
 ],[.55,5.8])
para('Jawaban dan urutan lain diterima jika menghasilkan pemetaan yang sama dan alasan yang benar. Kemandirian serta pemeriksaan titik digunakan untuk menetapkan level tiap TP.','SmallID')

page('LAMPIRAN 5. KUNCI ASESMEN ULANG\nDAN PENGAYAAN')
table(['Butir','Jawaban / panduan pemeriksaan'],[
 ['U1',r'Nilai linear: $-4,-1,2$; kuadrat: $1,0,1$; eksponensial: $\frac13,1,3$. Domain ketiganya $\mathbb R$; range berturut-turut $\mathbb R$, $[0,\infty)$, dan $(0,\infty)$.'],
 ['U2',r'$g(x)=(x-3)^2-1$; puncak $(3,-1)$; $g(2)=g(4)=0$.'],
 ['U3',r'Sumbu x: $g(x)=-3^x$, bayangan $(1,-3)$, $g(1)=-3$. Sumbu y: $h(x)=3^{-x}$, bayangan $(-1,3)$, $h(1)=\frac13$.'],
 ['U4',r'$g(x)=\frac12x^2$: faktor vertikal $\frac12$, bayangan $\left(1,\frac12\right)$. $h(x)=\frac{x^2}{4}$: faktor horizontal 2, bayangan $(2,1)$.'],
 ['U5',r'$g(x)=-2(x-2)^2+5$. Puncak $(2,5)$; range $(-\infty,5]$; $g(1)=g(3)=3$. Periksa urutan dan pemetaan titik.'],
 ['Proyek A: pasangan pertama',r'$D(T(f))(x)=2(x-2)^2=T(D(f))(x)$. Untuk fungsi umum, kedua operasi menghasilkan $2f(x-2)$ sehingga dapat dipertukarkan.'],
 ['Proyek A: pasangan kedua',r'$D(V(f))(x)=2x^2+6$, sedangkan $V(D(f))(x)=2x^2+3$. Selisih 3; tidak dapat dipertukarkan. Untuk fungsi umum hasilnya $2f(x)+6$ dan $2f(x)+3$.'],
 ['Proyek B: transformasi',r'$Q(t)=P(2(t-1))$. Pemetaan $(u,v)\mapsto\left(1+\frac u2,v\right)$: pemampatan horizontal faktor $\frac12$, lalu translasi 1 ke kanan. Domain hasil $t\ge1$ sesuai domain asal $u\ge0$.'],
 ['Proyek B: nilai dan batas',r'$Q(1)=100$, $Q(2)=25$, $Q(3)=\frac{25}{4}=6{,}25$. Persamaan $Q(t)=25$ memberi $2(t-1)=2$ sehingga $t=2$. Model kontinu dapat memberi nilai pecahan; hasil nyata perlu diuji melalui catatan pemakaian per pekan.'],
 ],[1.2,5.2])

page('LAMPIRAN 6. FORMAT PELAKSANAAN\nDAN TINDAK LANJUT')
sub('1. Pemetaan dan keputusan per peserta')
table(['No','Nama / kelas','TP sasaran','Level awal','Layanan','Level akhir / tindak lanjut'],[[i,'\n','','','',''] for i in range(1,7)],[.4,1.5,.8,.7,.9,1.8])
sub('2. Jurnal kegiatan')
table(['Tanggal / JP','TP / kelompok','Bantuan atau tugas','Bukti belajar / umpan balik'],[['\n\n','','',''] for _ in range(3)],[1,1.1,1.8,2.2])
sub('3. Evaluasi program')
table(None,[['Jumlah peserta remedial / pengayaan','____________ / ____________'],['TP yang tercapai setelah layanan','________________________________'],['TP yang masih perlu dukungan','________________________________'],['Tindak lanjut dan jadwal berikutnya','________________________________'],['Dokumen bukti','Asesmen awal, lembar kerja, grafik, asesmen ulang, produk, rubrik, dan umpan balik.']],[2.8,3.3])
para('Format diisi setelah pelaksanaan. Kehadiran atau selesainya tugas tidak menggantikan bukti ketercapaian kompetensi.','SmallID')

# Retain the same verified official references and publication information.
exec(src[src.index("page('DAFTAR RUJUKAN RESMI')"):src.index('\nlogo=ImageReader')])
