import math
if extra=='barisan':
 element='Bilangan';cp_section='6.1 Bilangan'
 cp='CP Bilangan Fase F mencakup penalaran barisan dan deret aritmetika/geometri, penggunaannya pada bunga sederhana dan majemuk, pemodelan pinjaman serta investasi dengan anuitas, dan penyelidikan pengaruh parameter keuangan secara numerik atau grafis. [5]'
 scope='Barisan dan deret aritmetika/geometri; bunga tunggal/majemuk; pengantar anuitas dan sensitivitas parameter.'
 goals=[
 ('TP1','Menentukan pola dan suku ke-n barisan aritmetika.','Menetapkan suku pertama, beda, indeks awal, dan rumus; memeriksa hasil pada suku yang diketahui.'),
 ('TP2','Menentukan suku dan jumlah deret geometri berhingga.','Menetapkan rasio, menggunakan pangkat dan rumus jumlah dengan benar, serta memeriksa kasus sederhana.'),
 ('TP3','Memodelkan jumlah aritmetika/geometri dalam konteks.','Membedakan suku dan jumlah, memilih model, menentukan batas banyak suku, dan menafsirkan satuan.'),
 ('TP4','Membandingkan bunga tunggal dan majemuk.','Menggunakan bunga dan periode yang sepadan, menghitung saldo, serta menjelaskan asumsi model.'),
 ('TP5','Menganalisis pinjaman beranuitas dan perubahan parameter.','Menghitung pembayaran tetap akhir periode, memisahkan bunga/angsuran pokok, memeriksa sisa pinjaman, dan menafsirkan satu perubahan parameter.')]
 concept=[
 ('Aritmetika',r'$U_n=a+(n-1)b$',r'$S_n=\frac n2\bigl(2a+(n-1)b\bigr)$.'),
 ('Geometri',r'$U_n=ar^{n-1}$',r'$S_n=a\frac{1-r^n}{1-r}$ untuk $r\ne1$; jika $r=1$, $S_n=na$.'),
 ('Bunga tunggal',r'$F_n=P(1+ni)$','Bunga dihitung dari modal awal; periode dan satuan bunga harus sama.'),
 ('Bunga majemuk',r'$F_n=P(1+i)^n$','Bunga tiap periode ditambahkan ke saldo sebelum periode berikutnya.'),
 ('Anuitas akhir periode',r'$A=P\frac{i}{1-(1+i)^{-n}}$',r'$i>0$, $n$ bulat positif; jika $i=0$, $A=P/n$.'),
 ('Sisa pinjaman',r'$B_k=(1+i)B_{k-1}-A$',r'$B_0=P$; bunga $I_k=iB_{k-1}$; pokok $C_k=A-I_k$.'),
 ]
 notation=r'$U_n$: suku ke-$n$; $S_n$: jumlah $n$ suku; $a$: suku pertama; $b$: beda; $r$: rasio. Untuk barisan, indeks dimulai $n=1$. Pada keuangan, $P$: modal/pinjaman awal; $i$: bunga per periode; $F_n$: saldo akhir; $A$: pembayaran tetap; $B_k$: sisa pokok setelah pembayaran ke-$k$.'
 diagnostic=[
 r'Diketahui barisan $3,7,11,15,\ldots$. Tentukan $a$, $b$, rumus $U_n$, dan $U_{10}$. Periksa rumus untuk $n=1$ dan $n=3$.',
 r'Diketahui barisan $2,6,18,\ldots$. Tentukan rasio, $U_5$, dan $S_5$. Jelaskan perbedaan suku ke-5 dan jumlah lima suku.',
 r'Baris pertama kursi berisi 8 kursi dan setiap baris berikutnya bertambah 2 kursi. Ada 12 baris. Tentukan banyak kursi baris terakhir dan jumlah seluruh kursi. Tuliskan asumsi.',
 r'Modal Rp1.000.000 mendapat bunga 10% per tahun selama dua tahun. Bandingkan saldo bunga tunggal dan majemuk tahunan tanpa biaya atau penarikan. Jelaskan penyebab selisihnya.',
 r'Pinjaman Rp210.000 dibayar dengan dua pembayaran tetap pada akhir setiap periode. Bunga simulasi 10% per periode dari sisa pokok. Hitung anuitas dan susun dua baris tabel bunga, angsuran pokok, dan sisa pinjaman.'
 ]
 remedial=[
 r'Barisan $5,8,11,\ldots$. Tentukan beda, rumus $U_n$, $U_8$, dan jumlah delapan sukunya. Bantuan: tandai bahwa suku pertama bersesuaian dengan $n=1$.',
 r'Barisan $3,6,12,\ldots$. Tentukan $r$, $U_6$, dan $S_6$. Periksa jumlah tiga suku pertama secara langsung sebelum menggunakan rumus.',
 r'Terdapat 10 baris tanaman. Baris pertama berisi 10 tanaman, lalu bertambah 3 tanaman tiap baris. Hitung baris terakhir dan jumlah semua tanaman. Jelaskan alasan memilih deret aritmetika.',
 r'Bandingkan saldo modal Rp2.000.000 selama dua tahun pada bunga tunggal 5% per tahun dan bunga majemuk 5% dengan kapitalisasi tahunan. Buat tabel tahun 0, 1, dan 2.',
 r'Pinjaman Rp420.000 dibayar dua kali pada akhir periode, bunga simulasi 10% tiap periode. Gunakan rumus anuitas; pisahkan bunga dan pokok pada tiap pembayaran, lalu periksa sisa akhir nol.'
 ]
 retest=[
 r'Barisan $4,9,14,\ldots$. Tentukan $a$, $b$, rumus $U_n$, dan $U_{12}$; periksa dua suku awal.',
 r'Barisan $4,8,16,\ldots$. Tentukan rasio, $U_6$, dan $S_6$. Jelaskan perbedaan hasil kedua besaran itu.',
 r'Sebuah susunan kursi memiliki 10 baris. Baris pertama berisi 12 kursi dan tiap baris bertambah 2 kursi. Hitung banyak kursi pada baris terakhir serta jumlah keseluruhannya.',
 r'Modal Rp1.000.000 diberi bunga 20% per tahun selama dua tahun. Bandingkan bunga tunggal dengan bunga majemuk tahunan dan jelaskan satu asumsi model.',
 r'Pinjaman Rp630.000 dibayar dengan dua anuitas akhir periode, bunga simulasi 10% tiap periode dari sisa pokok. Tentukan pembayaran tetap dan lengkapi tabel bunga, pokok, serta sisa pinjaman.'
 ]
 kd=[
 r'$a=3$, $b=4$; $U_n=4n-1$; $U_{10}=39$. Pemeriksaan: $U_1=3$, $U_3=11$.',
 r'$r=3$; $U_5=2\cdot3^4=162$; $S_5=2\frac{3^5-1}{3-1}=242$. Suku berbeda dengan jumlah.',
 r'$U_{12}=8+11\cdot2=30$ kursi; $S_{12}=\frac{12}{2}(8+30)=228$ kursi. Semua baris mengikuti pola tanpa pengurangan kursi.',
 r'Tunggal: $1\,000\,000(1+2\cdot0{,}1)=1\,200\,000$. Majemuk: $1\,000\,000(1{,}1)^2=1\,210\,000$. Selisih Rp10.000 berasal dari bunga atas bunga tahun pertama.',
 r'$A=121\,000$. Periode 1: bunga Rp21.000, pokok Rp100.000, sisa Rp110.000. Periode 2: bunga Rp11.000, pokok Rp110.000, sisa nol.'
 ]
 kr=[
 r'$b=3$; $U_n=3n+2$; $U_8=26$; $S_8=\frac82(5+26)=124$.',
 r'$r=2$; $U_6=96$; $S_6=3(2^6-1)=189$. Tiga suku pertama berjumlah 21.',
 r'$U_{10}=10+9\cdot3=37$; $S_{10}=\frac{10}{2}(10+37)=235$ tanaman.',
 r'Saldo tunggal tahun 0, 1, 2: Rp2.000.000; Rp2.100.000; Rp2.200.000. Majemuk: Rp2.000.000; Rp2.100.000; Rp2.205.000.',
 r'$A=242\,000$. Periode 1: bunga Rp42.000, pokok Rp200.000, sisa Rp220.000. Periode 2: bunga Rp22.000, pokok Rp220.000, sisa nol.'
 ]
 ku=[
 r'$a=4$, $b=5$; $U_n=5n-1$; $U_{12}=59$.',
 r'$r=2$; $U_6=128$; $S_6=4(2^6-1)=252$.',
 r'$U_{10}=30$ kursi; $S_{10}=\frac{10}{2}(12+30)=210$ kursi.',
 r'Tunggal Rp1.400.000; majemuk Rp1.440.000; selisih Rp40.000. Bunga dan kapitalisasi tahunan; tanpa biaya atau penarikan.',
 r'$A=363\,000$. Periode 1: bunga Rp63.000, pokok Rp300.000, sisa Rp330.000. Periode 2: bunga Rp33.000, pokok Rp330.000, sisa nol.'
 ]
 projects=[
 ('Proyek A - Membandingkan dua rencana penanaman',r'Rencana A menanam 6 bibit pada pekan pertama dan bertambah 2 bibit tiap pekan. Rencana B menanam 3 bibit pada pekan pertama dan berlipat dua tiap pekan. Buat rumus dan tabel enam pekan; bandingkan total bibit, tentukan pekan pertama jumlah mingguan B melampaui A, dan evaluasi batas model terhadap lahan serta ketersediaan bibit.'),
 ('Proyek B - Membandingkan skema pembayaran',r'Gunakan pinjaman simulasi Rp210.000 selama dua periode. Skema flat: pokok Rp105.000 tiap periode dan bunga 10% dari pinjaman awal tiap periode. Skema anuitas: pembayaran akhir periode dengan bunga 10% dari sisa pokok. Bandingkan pembayaran dan total bunga. Pada anuitas, selidiki dampak bunga menjadi 20% dengan lama tetap dua periode, lalu lama menjadi tiga periode pada bunga 10%. Nyatakan asumsi dan pembulatan.')]
 kp=[
 ('Proyek A',r'$U_n^{(A)}=6+2(n-1)$, $S_6^{(A)}=66$. $U_n^{(B)}=3\cdot2^{n-1}$, $S_6^{(B)}=189$. Jumlah mingguan B pertama melampaui A pada pekan ke-3: 12 dibanding 10.'),
 ('Proyek B: dasar',r'Flat: pembayaran Rp126.000 per periode, total Rp252.000, bunga Rp42.000. Anuitas: Rp121.000 per periode, total Rp242.000, bunga Rp31.000. Perbedaan berasal dari dasar penghitungan bunga.'),
 ('Proyek B: parameter',r'Bunga 20%, dua periode: $A\approx137\,454{,}55$. Bunga 10%, tiga periode: $A\approx84\,444{,}11$; total bunga sekitar Rp43.332,33. Periode lebih panjang menurunkan pembayaran per periode, tetapi dapat meningkatkan total bunga. Pembayaran terakhir disesuaikan jika ada pembulatan.')]
 focuses=[('TP1-TP2','Kartu beda/rasio, daftar suku, garis indeks, serta perbedaan suku dan jumlah.'),('TP3-TP4','Model kursi/tanaman, tabel akumulasi, dan saldo bunga tahun demi tahun.'),('TP5','Tabel sisa pokok, bunga, dan pembayaran tetap; satu parameter diubah setiap kali.')]
else:
 element='Geometri';cp_section='6.3 Geometri'
 cp='CP Geometri Fase F menekankan penggunaan, pengenalan, serta penjelasan keterkaitan unsur lingkaran untuk memecahkan masalah. Unit ini menurunkannya ke hubungan sudut, tali busur, garis singgung, dan penerapan kontekstual. Panjang busur dan luas juring digunakan sebagai penguatan prasyarat. [5]'
 scope='Unsur lingkaran; sudut pusat/keliling; tali busur dan apotema; garis singgung; panjang busur dan luas juring dalam konteks.'
 goals=[
 ('TP1','Mengidentifikasi unsur serta hubungan dasar lingkaran.','Menandai pusat, jari-jari, diameter, tali busur, busur, juring, dan apotema pada sketsa; menjelaskan bahwa diameter melalui pusat.'),
 ('TP2','Menggunakan hubungan sudut pada lingkaran.','Menetapkan busur yang sama, menghubungkan sudut pusat dan keliling, serta menggunakan sudut berhadapan segiempat siklik.'),
 ('TP3','Menyelesaikan masalah tali busur dan jarak ke pusat.','Membuat segitiga siku-siku, menjelaskan pembagian tali busur oleh garis dari pusat yang tegak lurus, dan menghitung panjang dengan benar.'),
 ('TP4','Menentukan hubungan garis singgung dari titik luar.','Menjelaskan tegak lurus jari-jari dan singgung, menghitung panjang, serta menunjukkan dua ruas singgung dari titik luar sama panjang.'),
 ('TP5','Memodelkan situasi menggunakan hubungan unsur lingkaran.','Memilih hubungan geometri, menghitung panjang/luas sesuai satuan, membandingkan alternatif, serta menjelaskan asumsi dan kewajaran hasil.')]
 concept=[
 ('Jari-jari dan diameter',r'$d=2r$',r'Diameter melalui pusat; setiap diameter adalah tali busur, tetapi tidak sebaliknya.'),
 ('Sudut pada busur sama',r'$\angle AOB=2\angle ACB$',r'$C$ berada pada busur pelengkap dari busur $AB$ yang ditinjau.'),
 ('Segiempat siklik',r'$\angle A+\angle C=180^\circ$',r'Sudut yang berhadapan berjumlah $180^\circ$; seluruh titik sudut pada lingkaran.'),
 ('Tali busur',r'$AB=2\sqrt{r^2-d_O^2}$',r'$d_O$ adalah jarak tegak lurus pusat ke tali busur; $0\le d_O<r$.'),
 ('Garis singgung',r'$PA=\sqrt{OP^2-r^2}$',r'$OA\perp PA$, $OP>r$; dari titik luar sama, $PA=PB$.'),
 ('Busur dan juring',r'$s=\frac{\theta}{360^\circ}2\pi r$; $L=\frac{\theta}{360^\circ}\pi r^2$',r'$\theta$ dalam derajat, $r>0$; gunakan satuan panjang dan luas yang sesuai.'),
 ]
 notation=r'$O$: pusat; $r$: jari-jari; $d$: diameter; $d_O$: jarak pusat ke tali busur; $P$: titik luar; $\theta$: sudut pusat; $s$: panjang busur; $L$: luas juring. Tanda siku-siku dan busur yang ditinjau harus diperlihatkan pada sketsa.'
 diagnostic=[
 r'Gambarlah lingkaran berpusat $O$ dengan diameter $AB=14$ cm. Tambahkan tali busur $CD$ yang tidak melalui pusat, satu busur, juring, dan apotema terhadap $CD$. Tentukan jari-jari dan jelaskan perbedaan diameter dengan tali busur.',
 r'Sudut pusat yang menghadap busur $AB$ adalah $100^\circ$. Titik $C$ terletak pada busur pelengkap. Tentukan $\angle ACB$. Pada segiempat siklik $KLMN$, jika sudut $K=70^\circ$, berapa sudut $M$? Jelaskan.',
 r'Jari-jari lingkaran 13 cm dan jarak tegak lurus pusat ke tali busur 5 cm. Buat sketsa dan hitung panjang tali busur.',
 r'Titik $P$ berjarak 13 cm dari pusat lingkaran berjari-jari 5 cm. Dua garis dari $P$ menyinggung lingkaran di $A$ dan $B$. Hitung $PA$ dan $PB$, serta jelaskan alasannya.',
 r'Taman berbentuk lingkaran berjari-jari 14 m. Jalur dan bidang hias membentuk juring $90^\circ$. Tentukan panjang busur dan luas juring; gunakan $\pi=\frac{22}{7}$. Jelaskan asumsi bentuk taman.'
 ]
 remedial=[
 r'Gambar lingkaran dengan diameter 20 cm. Tandai pusat, dua jari-jari, diameter, tali busur lain, busur, juring, dan apotema. Hitung jari-jari dan jelaskan unsur yang melalui pusat.',
 r'Sudut pusat untuk busur $AB$ adalah $120^\circ$. Tentukan sudut keliling pada busur yang sama. Jika satu sudut segiempat siklik $85^\circ$, tentukan sudut berhadapannya.',
 r'Lingkaran berjari-jari 10 cm memiliki tali busur berjarak 6 cm dari pusat. Gambarkan segitiga bantu, hitung setengah tali busur, kemudian panjang seluruh tali busur.',
 r'Titik luar $P$ berjarak 10 cm dari pusat, sedangkan jari-jari 6 cm. Hitung panjang ruas singgung. Tunjukkan sudut siku-siku dan jelaskan kesamaan dua ruas singgung dari $P$.',
 r'Sebuah juring berjari-jari 7 m memiliki sudut pusat $120^\circ$. Hitung panjang busur dan luasnya dalam bentuk eksak memuat $\pi$. Bandingkan panjang busur dengan keliling lingkaran penuh.'
 ]
 retest=[
 r'Gambar lingkaran dengan diameter 18 cm. Tentukan jari-jari dan tandai pusat, diameter, tali busur yang bukan diameter, busur, juring, serta apotema. Jelaskan satu hubungan antarunsur.',
 r'Sudut pusat untuk busur $AB$ adalah $140^\circ$. Tentukan sudut keliling pada busur yang sama. Pada segiempat siklik, satu sudut $115^\circ$; tentukan sudut berhadapannya.',
 r'Jari-jari lingkaran 17 cm dan jarak tegak lurus pusat ke tali busur 8 cm. Tentukan panjang tali busur dan jelaskan segitiga yang digunakan.',
 r'Titik $P$ berjarak 25 cm dari pusat lingkaran berjari-jari 7 cm. Hitung panjang kedua ruas singgung dari $P$; jelaskan hubungan jari-jari dan garis singgung.',
 r'Sebuah juring berjari-jari 21 m bersudut pusat $60^\circ$. Tentukan panjang busur dan luas juring dengan $\pi=\frac{22}{7}$, lengkap dengan satuan serta pemeriksaan kewajaran.'
 ]
 kd=[
 r'$r=7$ cm. Diameter adalah tali busur yang melalui pusat. Apotema tegak lurus tali busur; juring dibatasi dua jari-jari dan sebuah busur. Periksa penandaan pada sketsa.',
 r'$\angle ACB=50^\circ$ karena menghadap busur yang sama. Sudut $M=110^\circ$ karena berhadapan dengan $K$ pada segiempat siklik.',
 r'Setengah tali busur $=\sqrt{13^2-5^2}=12$ cm, sehingga panjangnya 24 cm. Garis dari pusat yang tegak lurus tali busur membaginya sama panjang.',
 r'$PA=PB=\sqrt{13^2-5^2}=12$ cm. Segitiga $OAP$ siku-siku di $A$ dan kedua ruas singgung dari $P$ sama panjang.',
 r'$s=\frac{90}{360}\cdot2\pi(14)=7\pi=22$ m; $L=\frac{90}{360}\pi(14)^2=49\pi=154$ m$^2$. Bentuk diasumsikan lingkaran sempurna.'
 ]
 kr=[
 r'$r=10$ cm. Pusat terletak pada diameter; tali busur lain dapat tidak melalui pusat. Periksa unsur dan apotema pada gambar murid.',
 r'Sudut keliling $60^\circ$; sudut berhadapan $95^\circ$. Busur yang dihadapi harus sama pada hubungan sudut pusat-keliling.',
 r'Setengah tali busur $=\sqrt{10^2-6^2}=8$ cm; panjang seluruhnya 16 cm.',
 r'Ruas singgung $=\sqrt{10^2-6^2}=8$ cm. Jari-jari tegak lurus di titik singgung; kedua ruas dari titik luar sama panjang.',
 r'$s=\frac{14\pi}{3}$ m; $L=\frac{49\pi}{3}$ m$^2$. Panjang busur adalah sepertiga keliling karena sudutnya sepertiga putaran penuh.'
 ]
 ku=[
 r'$r=9$ cm. Periksa pusat, jari-jari, diameter, tali busur, busur, juring, apotema, dan alasan hubungan pada sketsa.',
 r'Sudut keliling $70^\circ$; sudut berhadapan $65^\circ$.',
 r'Setengah tali busur $=\sqrt{17^2-8^2}=15$ cm; panjang seluruhnya 30 cm.',
 r'$PA=PB=\sqrt{25^2-7^2}=24$ cm; jari-jari tegak lurus garis singgung di titik singgung.',
 r'$s=\frac{60}{360}\cdot2\pi(21)=7\pi=22$ m; $L=\frac{60}{360}\pi(21)^2=\frac{147\pi}{2}=231$ m$^2$. Keduanya seperenam besaran lingkaran penuh.'
 ]
 projects=[
 ('Proyek A - Memilih jalur taman',r'Dua titik $A$ dan $B$ pada taman lingkaran berjari-jari 14 m membentuk sudut pusat $90^\circ$. Bandingkan jalur busur pendek dengan jalur lurus tali busur. Hitung panjang keduanya, selisihnya, jarak pusat ke tali busur, dan tinggi tembereng di tengah. Beri rekomendasi dengan mempertimbangkan jarak serta ruang hijau; nyatakan asumsi dan sketsa berskala.'),
 ('Proyek B - Membuktikan hubungan dua garis singgung',r'Lingkaran berpusat $O$ berjari-jari 5 cm; $OP=10$ cm. Dua ruas dari $P$ menyinggung di $A$ dan $B$. Buktikan $PA=PB$ menggunakan segitiga siku-siku. Hitung panjang keduanya, sudut pusat minor $\angle AOB$, dan sudut $\angle APB$. Jelaskan mengapa kedua sudut terakhir berjumlah $180^\circ$ dan verifikasi lewat gambar.')]
 kp=[
 ('Proyek A: panjang',r'Busur pendek $7\pi$ m; tali busur $14\sqrt2$ m. Selisih $7\pi-14\sqrt2$ m. Jika memakai $\pi\approx3{,}14159$, selisih sekitar 2,192 m; busur lebih panjang.'),
 ('Proyek A: jarak',r'Jarak pusat ke tali busur $7\sqrt2$ m; tinggi tembereng tengah $14-7\sqrt2$ m. Rekomendasi harus memperhitungkan ruang hijau dan akses, tidak hanya hasil hitungan.'),
 ('Proyek B',r'$PA=PB=5\sqrt3$ cm. Segitiga $OAP$ dan $OBP$ kongruen karena siku-siku, sisi miring $OP$ sama, dan $OA=OB$. Diperoleh $\angle AOP=\angle POB=60^\circ$, sehingga sudut pusat minor $120^\circ$ dan $\angle APB=60^\circ$. Dua sudut siku-siku pada segiempat $OAPB$ membuat jumlah dua sudut lainnya $180^\circ$.')]
 focuses=[('TP1-TP2','Sketsa berwarna, penandaan busur, dan perbandingan sudut pada busur sama.'),('TP3-TP4','Segitiga siku-siku bantu, jarak tegak lurus, serta pembuktian dua ruas singgung.'),('TP5','Model taman, perbandingan alternatif panjang/luas, dan pemeriksaan satuan serta asumsi.')]

page('PROGRAM REMEDIAL DAN PENGAYAAN')
para('TAHUN PELAJARAN 2026/2027','CenterID');story.append(Spacer(1,7*mm))
table(None,[['Satuan pendidikan',prof['nama']],['Mata pelajaran','Matematika'],['Fase / kelas','F / XI'],['Elemen',element],['Materi',material],['Guru penyusun',teacher],['NIP',teacher_nip],['Semester','Ganjil'],['Alokasi rencana','Remedial: 6 JP; pengayaan: 4 JP. Satu JP direncanakan 45 menit; penjadwalan mengikuti kebutuhan murid dan program madrasah.']],[1.6,3.9]);sig()

page('A. LANDASAN DAN ARAH PROGRAM')
table(['Acuan','Penerapan'],[
 ['KMA 450 Tahun 2024 sebagaimana diubah KMA 1503 Tahun 2025','Layanan sesuai kebutuhan murid dan budaya cinta ilmu, kepedulian, serta saling membantu. [1]'],
 ['Permendikdasmen 13 Tahun 2025; 1 Tahun 2026','Kerangka kurikulum dan standar proses: perencanaan, pelaksanaan, serta penilaian proses. [2][3]'],
 ['Permendikbudristek 21 Tahun 2022','Asesmen berdasarkan bukti untuk menilai kemajuan dan tindak lanjut. [4]'],
 ['Keputusan Kepala BSKAP 046/H/KR/2025','CP Matematika Fase F, elemen '+cp_section+'. [5]'],
 ['Panduan Pembelajaran dan Asesmen, revisi 2025','Pendampingan untuk kompetensi yang belum dikuasai, asesmen formatif, dan pengayaan. [6]']],[2,3.6])
sub('Ringkasan CP yang relevan');para(cp)
para('Kemendikdasmen pada 23 Juni 2026 menjelaskan bahwa pembaruan CP tahun 2026 terbatas pada Agama dan Budi Pekerti. CP Matematika tetap menggunakan keputusan tahun 2025. [7]','SmallID')
sub('Tujuan dan lingkup program');para(scope)
para('Program ditujukan untuk pemulihan kompetensi yang belum tercapai serta pendalaman bagi murid yang sudah menguasainya. Penempatan di kelas XI diselaraskan dengan ATP madrasah; CP merupakan target akhir fase. Tanggal pelaksanaan, peserta, dan hasil program diisi setelah kegiatan berdasarkan bukti nyata.','SmallID')

page('B. TUJUAN PEMBELAJARAN DAN KKTP')
table(['Kode','Tujuan pembelajaran','Bukti esensial ketercapaian'],goals,[.6,2.5,3])
sub('Rubrik ketercapaian per TP')
table(['Level','Deskripsi operasional'],[
 ['1 - Perlu dukungan intensif','Konsep utama belum tampak walau diberi pertanyaan penuntun.'],
 ['2 - Berkembang','Sebagian langkah benar; masih ada kesalahan konsep atau arahan pada langkah utama.'],
 ['3 - Tercapai','Seluruh bukti esensial TP tampak mandiri dengan hasil dan alasan yang dapat diperiksa.'],
 ['4 - Melampaui','Memenuhi level 3 serta memberi pemeriksaan berbeda, generalisasi, atau argumen baru yang sah.']],[1.5,4.6])
para('KKTP program: setiap TP minimal level 3. TP level 1-2 diberi remedial terarah; TP yang telah tercapai dapat mendapat pengayaan. Kriteria dan level ini ditetapkan guru untuk unit, bukan angka ketuntasan nasional. Kompetensi yang belum terbukti tidak ditutupi oleh kelebihan skor TP lain.','SmallID')

page('C. PETA KONSEP DAN NOTASI')
table(['Pokok konsep','Hubungan / rumus','Syarat dan pemaknaan'],concept,[1.2,2.4,3.2]);para(notation,'SmallID')
if extra=='barisan':
 sub('Urutan pemeriksaan model')
 para('Kenali pola; tentukan indeks dan satuan; pilih rumus suku/jumlah; hitung; periksa kasus kecil; tafsirkan hasil dan batas model.')
 para('Pada soal keuangan, seluruh angka merupakan simulasi pembelajaran. Bunga selalu dinyatakan per periode yang sama dengan pembayaran; pembayaran anuitas dilakukan di akhir periode, tanpa biaya tambahan. Pembulatan dicatat dan sisa pembayaran terakhir disesuaikan bila perlu.','SmallID')
else:
 from reportlab.pdfgen import canvas as diagramcanvas
 c=diagramcanvas.Canvas(str(target/'lingkaran.pdf'),pagesize=(430,150))
 c.setFont('Times-Roman',9);c.setLineWidth(.8)
 for ox in [90,310]:c.circle(ox,75,56,stroke=1,fill=0);c.circle(ox,75,1.4,stroke=0,fill=1);c.drawString(ox-9,64,'O')
 c.line(34,75,146,75);c.line(90,75,90,131);c.drawString(25,72,'A');c.drawString(150,72,'B');c.drawString(88,135,'C')
 c.line(48,112,132,112);c.line(90,75,90,112);c.lines([(90,107,95,107),(95,107,95,112)])
 c.drawString(40,116,'D');c.drawString(135,116,'E')
 # External P with two exact tangent points to a circle of radius 56.
 P=(422,75);T=(338,75+28*math.sqrt(3));B=(338,75-28*math.sqrt(3))
 for t in [T,B]:c.line(*P,*t);c.line(310,75,*t)
 c.line(310,75,*P);c.drawString(418,62,'P');c.drawString(T[0]+2,T[1]+3,'A');c.drawString(B[0]+2,B[1]-9,'B');c.save()
 story.append(r'\begin{center}\includegraphics[width=\linewidth,height=55mm,keepaspectratio]{lingkaran.pdf}\end{center}')
 para(r'Kiri: diameter $AB$, jari-jari $OC$, tali busur $DE$, dan jarak tegak lurus pusat ke tali busur. Kanan: dua ruas singgung $PA$ dan $PB$; gambar ilustratif, bukan ukuran soal.','SmallID')

page('LAMPIRAN 1. ASESMEN AWAL');ident();para('Waktu rencana: 30 menit. Kerjakan mandiri, sertakan langkah dan alasan; gunakan lembar tambahan atau sketsa bila perlu.','SmallID')
for i,q in enumerate(diagnostic,1):question(f'D{i} / TP{i}',q,10)
para('Guru mengonfirmasi pemahaman lewat pertanyaan lisan bila bukti tertulis belum cukup. Kelompok layanan dibentuk per TP dan dapat berubah mengikuti kemajuan.','SmallID')

page('D. RENCANA PROGRAM REMEDIAL')
para('Peserta adalah murid dengan bukti TP level 1-2. Satu siklus direncanakan 3 pertemuan × 2 JP, hanya untuk kompetensi yang masih memerlukan bantuan. Durasi disesuaikan perkembangan peserta.')
rows=[]
for i,(tp,focus) in enumerate(focuses,1):
 activity=('Memahami: wawancara kesalahan (15 menit). Mengaplikasi: contoh terurai dan latihan terbimbing (35 menit), latihan mandiri (30 menit). Merefleksi: tiket keluar (10 menit). ' if i<3 else 'Memahami: identifikasi model (15 menit). Mengaplikasi: latihan terarah (20 menit), asesmen ulang TP sasaran (40 menit). Merefleksi: umpan balik dan tindak lanjut (15 menit). ')+focus
 rows.append([f'R{i}\n{tp}',activity,'2 JP\n90 menit','Catat alasan, hasil, bantuan yang masih diperlukan, dan level TP terbaru.'])
table(['Sesi','Kegiatan pendampingan','Waktu','Bukti kemajuan'],rows,[.7,3.7,.7,1.6])
sub('Dukungan dan nilai pembelajaran')
para('Gunakan tabel, sketsa, kartu konsep, serta contoh konkret. Guru memodelkan cara berpikir lalu mengurangi bantuan. Tutor sebaya mendukung diskusi dan tidak menggantikan pendampingan guru. Sediakan lembar cetak, instruksi yang mudah dibaca, tambahan waktu atau jawaban lisan sesuai kebutuhan.')
para('Cinta ilmu diwujudkan melalui ketelitian dan kejujuran pemeriksaan; cinta diri dan sesama melalui bantuan tanpa mempermalukan kesalahan. Konteks tanaman atau taman menumbuhkan kepedulian lingkungan.','SmallID')
sub('Keputusan setelah layanan')
para('TP level 3 kembali ke kegiatan reguler atau mendapat pengayaan. Jika belum tercapai, ubah bantuan dan jadwalkan siklus singkat berikutnya. Simpan bukti awal, lembar kerja, asesmen ulang, dan umpan balik. Pelaporan nilai mengikuti kebijakan madrasah tanpa pembatasan otomatis nilai remedial dalam program ini.','SmallID')

page('LAMPIRAN 2. LEMBAR KERJA REMEDIAL');ident();para('Guru memilih butir sesuai TP sasaran. Jelaskan alasan pemilihan rumus dan tunjukkan pemeriksaan hasil.','SmallID')
for i,q in enumerate(remedial,1):question(f'R{i} / TP{i}',q,10)
para('Kesalahan yang saya perbaiki: ________________________________________\nCara saya memeriksa jawaban: _________________________________________','SmallID')

page('LAMPIRAN 3. ASESMEN ULANG');ident();para('Waktu rencana: 40 menit. Kerjakan mandiri; asesmen dipilih sesuai TP sasaran remedial.','SmallID')
for i,q in enumerate(retest,1):question(f'U{i} / TP{i}',q,10)
para('Penetapan hasil memakai rubrik bagian B. TP tercapai ketika seluruh bukti esensialnya tampak mandiri minimal level 3. Periksa konsep, alasan, satuan, dan kewajaran hasil.','SmallID')

page('E. RENCANA PROGRAM PENGAYAAN')
para('Peserta telah mencapai minimal level 3 pada TP sasaran. Pilih satu proyek; peserta tetap menjelaskan kontribusi dan pemikirannya sendiri. Pengayaan memperluas pemodelan dan penalaran, tidak sekadar menambah soal sejenis.')
table(['Sesi','Aktivitas','Waktu / produk'],[
 ['P1','Pilih konteks dan nyatakan asumsi (15 menit); eksplorasi rumus/tabel/sketsa (60 menit); pemeriksaan dan refleksi (15 menit).','2 JP / 90 menit\nDraf solusi dan bukti pemeriksaan.'],
 ['P2','Perbaiki model berdasar umpan balik (35 menit); presentasi serta verifikasi individual (35 menit); evaluasi keterbatasan (20 menit).','2 JP / 90 menit\nLaporan 1-2 halaman dan refleksi individual.']],[.6,4.3,1.4])
for title,text in projects:sub(title);para(text)
para('Produk memuat masalah, variabel/unsur, rumus, tabel atau sketsa, pemeriksaan, kesimpulan, dan batas model. Gunakan data soal sebagai simulasi; data nyata hanya dicantumkan bila benar-benar diperoleh.','SmallID')

page('F. RUBRIK PENGAYAAN DAN REFLEKSI')
table(['Aspek','Level 1','Level 2','Level 3','Level 4'],[
 ['Model / representasi','Belum sesuai konteks.','Sebagian sesuai; asumsi belum jelas.','Model dan representasi tepat serta beralasan.','Menguji batas atau memberi alternatif yang sah.'],
 ['Prosedur / argumen','Langkah utama belum benar.','Memerlukan arahan pada langkah utama.','Perhitungan serta alasan runtut dan mandiri.','Memberi generalisasi atau pemeriksaan berbeda.'],
 ['Evaluasi konteks','Belum menafsirkan hasil.','Tafsiran sebagian sesuai.','Kesimpulan wajar; satuan dan asumsi jelas.','Menguji keterbatasan dan memberi usul validasi.'],
 ['Komunikasi individual','Belum menjelaskan kontribusi.','Bergantung pada pasangan.','Menjelaskan kontribusi dan alasan sendiri.','Menanggapi sanggahan serta memperbaiki penjelasan.']],[1.1,1.05,1.15,1.4,1.5])
para('Target produk: minimal level 3 pada keempat aspek. Skala ditetapkan guru untuk tugas ini. Penilaian kelompok dilengkapi verifikasi individual; kerja sama diberi umpan balik dan tidak menggantikan bukti matematika.','SmallID')
sub('Refleksi murid')
for i,t in enumerate(['Konsep apa yang membantu saya memilih rumus atau hubungan?','Bagaimana saya memeriksa indeks, satuan, atau unsur pada sketsa?','Asumsi apa yang membatasi penggunaan hasil?','Bantuan dan langkah belajar berikutnya apa yang saya perlukan?'],1):question(i,t,6)
sub('Refleksi guru');para('Kesulitan yang masih muncul: _________________________________________\nBantuan yang efektif dan buktinya: _____________________________________\nPerubahan untuk siklus berikutnya: ____________________________________','SmallID')

page('LAMPIRAN 4. KUNCI ASESMEN AWAL\nDAN LEMBAR KERJA REMEDIAL')
table(['Butir','Jawaban dan bukti yang diperiksa'],[(f'D{i}',t) for i,t in enumerate(kd,1)]+[(f'R{i}',t) for i,t in enumerate(kr,1)],[.55,5.8])
para('Jawaban ekuivalen diterima jika langkah dan alasan sah. Kunci membantu pemeriksaan; level TP tetap ditentukan dengan memperhatikan seluruh bukti esensial dan kemandirian.','SmallID')

page('LAMPIRAN 5. KUNCI ASESMEN ULANG\nDAN PENGAYAAN')
table(['Butir','Jawaban / panduan pemeriksaan'],[(f'U{i}',t) for i,t in enumerate(ku,1)]+kp,[1.2,5.2])

page('LAMPIRAN 6. FORMAT PELAKSANAAN\nDAN TINDAK LANJUT')
sub('1. Pemetaan dan keputusan per peserta')
table(['No','Nama / kelas','TP sasaran','Level awal','Layanan','Level akhir / tindak lanjut'],[[i,'\n','','','',''] for i in range(1,7)],[.4,1.5,.8,.7,.9,1.8])
sub('2. Jurnal kegiatan');table(['Tanggal / JP','TP / kelompok','Bantuan atau tugas','Bukti belajar / umpan balik'],[['\n\n','','',''] for _ in range(3)],[1,1.1,1.8,2.2])
sub('3. Evaluasi program');table(None,[['Jumlah peserta remedial / pengayaan','____________ / ____________'],['TP tercapai setelah layanan','________________________________'],['TP masih perlu dukungan','________________________________'],['Tindak lanjut dan jadwal berikutnya','________________________________'],['Dokumen bukti','Asesmen awal, lembar kerja, asesmen ulang, produk, rubrik, dan umpan balik.']],[2.8,3.3])
para('Diisi setelah kegiatan berdasarkan bukti nyata; kehadiran atau selesainya tugas tidak menggantikan bukti ketercapaian kompetensi.','SmallID')
refcode=src[src.index("page('DAFTAR RUJUKAN RESMI')"):src.index('\nlogo=ImageReader')].replace('elemen 6.2 Aljabar dan Fungsi.', 'elemen '+cp_section+'.')
exec(refcode)
