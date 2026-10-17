# Font Arab pada jurnal, absensi, dan nilai

Font utama teks Arab pada ACCA-CBT adalah Amiri (apps/web/app/styles/cbt-editor.css). ACCA sekarang menyertakan Amiri Arabic regular/bold secara lokal, dengan lisensi SIL Open Font License pada public/fonts/amiri/OFL.txt.

Penerapan memakai wajah font dengan Unicode range Arab pada keluarga Poppins, cocok dengan bobot 300–900 yang dimuat RootLayout. Dengan cara ini, CSS halaman dan aturan mobile yang menggunakan Poppins !important tetap merender huruf Arab memakai Amiri. Huruf Latin, angka, arah layout, ikon, nilai input, dan data tersimpan tidak diubah. Modal melalui portal juga mengikuti font ini tanpa pembungkus tambahan. Italic menggunakan sintesis browser, mempertahankan perilaku Latin Poppins yang ada.

Verifikasi browser menggunakan CSS aktual jurnal/absensi/nilai/global/modal dan font yang benar-benar dipakai pada glyph melalui Chrome DevTools Protocol, bukan hanya nilai computed font-family. Mencakup harakat, regular/tebal/miring, campuran Arab–Indonesia, input dinamis, serta lebar 320/390/768/1280 piksel. Poppins untuk Latin tetap sama, Amiri terdeteksi sebagai font lokal untuk Arab, dan tidak ada overflow. Juga diperiksa ketika stylesheet font Latin tiba setelah stylesheet aplikasi.

Font Arab tidak memerlukan layanan font eksternal saat dipakai. Tidak diperlukan migrasi atau pembaruan data jurnal, kehadiran, maupun nilai.
