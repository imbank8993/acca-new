/**
 * Penanda jenis baris: tugas vs pengingat.
 *
 * Dibedakan lewat IKON saja, tanpa teks — teks "PENGINGAT" berhuruf kapital
 * sebelumnya terbaca lebih keras daripada kepentingannya, dan warnanya (amber)
 * bertabrakan dengan gradasi deadline yang juga memakai amber untuk "3 hari
 * lagi". Ungu dipilih karena berada di luar rentang oranye→merah milik deadline,
 * jadi tidak ada satu warna yang punya dua arti.
 *
 * Ikon tanpa teks wajib membawa label: pemakainya lewat `title` (tooltip) dan
 * `aria-label` di komponen.
 */
export interface JenisInfo {
    isPengingat: boolean;
    /** Nama ikon Bootstrap Icons tanpa awalan `bi-`. */
    icon: string;
    /** Dipakai sebagai tooltip sekaligus label pembaca layar. */
    label: string;
}

export function getJenisInfo(jenis?: string | null): JenisInfo {
    const isPengingat = jenis === 'pengingat';
    return {
        isPengingat,
        icon: isPengingat ? 'bell-fill' : 'clipboard-check',
        label: isPengingat ? 'Pengingat' : 'Tugas'
    };
}
