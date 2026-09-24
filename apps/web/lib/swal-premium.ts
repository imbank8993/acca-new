// Premium Swal Alert Helper Functions
// Consistent styling for all alerts across the app

import Swal from 'sweetalert2';

/**
 * Success alert with premium styling
 */
export const swalSuccess = (title: string, text?: string) => Swal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonText: 'OK',
    confirmButtonColor: '#1e3a5f',
    customClass: {
        popup: 'swal-premium',
        confirmButton: 'swal-btn-primary'
    }
});

/**
 * Error alert with premium styling
 */
export const swalError = (title: string, text?: string) => Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'OK',
    confirmButtonColor: '#ef4444',
    customClass: {
        popup: 'swal-premium',
        confirmButton: 'swal-btn-danger'
    }
});

/**
 * Info alert with premium styling
 */
export const swalInfo = (title: string, text?: string) => Swal.fire({
    title,
    text,
    icon: 'info',
    confirmButtonText: 'OK',
    confirmButtonColor: '#0ea5e9',
    customClass: {
        popup: 'swal-premium',
        confirmButton: 'swal-btn-info'
    }
});

/**
 * Warning alert with premium styling
 */
export const swalWarning = (title: string, text?: string) => Swal.fire({
    title,
    text,
    icon: 'warning',
    confirmButtonText: 'OK',
    confirmButtonColor: '#f59e0b',
    customClass: {
        popup: 'swal-premium',
        confirmButton: 'swal-btn-warning'
    }
});

/**
 * Confirmation dialog with premium styling
 */
export const swalConfirm = async (options: {
    title: string;
    text?: string;
    html?: string;
    icon?: 'warning' | 'question' | 'info' | 'success' | 'error';
    confirmText?: string;
    cancelText?: string;
    confirmColor?: string;
}): Promise<{ isConfirmed: boolean; isDismissed: boolean }> => {
    return Swal.fire({
        title: options.title,
        text: options.text,
        html: options.html,
        icon: options.icon || 'warning',
        showCancelButton: true,
        confirmButtonText: options.confirmText || 'Ya',
        cancelButtonText: options.cancelText || 'Batal',
        confirmButtonColor: options.confirmColor || '#1e3a5f',
        customClass: {
            popup: 'swal-premium',
            confirmButton: 'swal-btn-primary',
            cancelButton: 'swal-btn-cancel'
        }
    });
};

/** Lolos ke innerHTML Swal — teks dari data (nama siswa, judul dokumen) harus di-escape. */
const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Dialog konfirmasi hapus — SATU-SATUNYA cara yang benar untuk mengonfirmasi
 * aksi hapus di aplikasi ini.
 *
 * Tampilan (ikon, warna, label tombol, dark mode) dikunci di sini; yang berbeda
 * per halaman hanya ISI pesannya lewat `item` dan `warning`. Jangan menyetel
 * `confirmButtonColor` di pemanggil — nilai itu selalu ditimpa aturan
 * `.swal2-confirm` di globals.css. Warna merah datang dari class
 * `swal-btn-danger` yang selectornya sudah dibuat cukup spesifik di sana.
 *
 * @example
 * if (!(await swalConfirmDelete({
 *   item: `${data.nama} — ${data.kelas}`,
 *   warning: 'Rekam medis UKS yang tertaut akan ikut terhapus.',
 * }))) return;
 */
export const swalConfirmDelete = async (options: {
    /** Pertanyaannya. Default: "Hapus data ini?" */
    title?: string;
    /** Identitas baris yang dihapus, mis. "AIRA RAMADHANI IKRAM — XI D". */
    item?: string;
    /** Akibat khusus halaman ini, mis. "Jawaban yang sudah masuk ikut terhapus." */
    warning?: string;
    /** true bila data tidak bisa dipulihkan (bukan soft delete). */
    permanent?: boolean;
    /** Default: "Ya, Hapus". Pakai bila kata kerjanya bukan "hapus". */
    confirmText?: string;
} = {}): Promise<boolean> => {
    const baris: string[] = [];
    if (options.item) baris.push(`<span class="swal-delete__item">${esc(options.item)}</span>`);
    if (options.permanent) baris.push('Data tidak bisa dikembalikan setelah dihapus.');
    const warning = options.warning
        ? `<span class="swal-delete__warning"><i class="bi bi-exclamation-triangle-fill"></i> ${esc(options.warning)}</span>`
        : '';

    const result = await Swal.fire({
        title: options.title || 'Hapus data ini?',
        html: `${baris.join('<br/>')}${warning}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: options.confirmText || 'Ya, Hapus',
        cancelButtonText: 'Batal',
        focusCancel: true,
        customClass: {
            popup: 'swal-premium',
            confirmButton: 'swal-btn-danger',
            cancelButton: 'swal-btn-cancel',
        },
    });

    return result.isConfirmed;
};

/**
 * Custom alert with full options
 */
export const swalCustom = (options: {
    title?: string;
    text?: string;
    html?: string;
    icon?: 'success' | 'error' | 'warning' | 'info' | 'question';
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: string;
    timer?: number;
}) => Swal.fire({
    title: options.title,
    text: options.text,
    html: options.html,
    icon: options.icon,
    showCancelButton: options.showCancel,
    confirmButtonText: options.confirmText || 'OK',
    cancelButtonText: options.cancelText || 'Batal',
    confirmButtonColor: options.confirmColor || '#1e3a5f',
    timer: options.timer,
    customClass: {
        popup: 'swal-premium',
        confirmButton: 'swal-btn-primary',
        cancelButton: 'swal-btn-cancel'
    }
});
