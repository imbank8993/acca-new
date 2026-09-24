// Status SAKIT yang berarti "dirawat/kontrol di luar asrama".
//
// Dipisah dari lib/antrean-asrama.ts karena file itu meng-import Prisma sehingga
// hanya boleh dipakai di server. Konstanta ini dibutuhkan juga oleh komponen klien
// (PrintModal), jadi harus bebas import.
export const ASRAMA_STATUS = ['Sedang', 'Berat', 'Kontrol'];
