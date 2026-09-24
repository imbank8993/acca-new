/**
 * Pemetaan ekstensi → MIME type, satu sumber untuk semua backend penyimpanan.
 *
 * Penting: MIME yang salah (mis. application/octet-stream untuk file PDF) bikin
 * browser menolak menampilkan file secara inline dan memaksa unduh sebagai blob
 * tanpa tipe — akibatnya file tersimpan tanpa ekstensi yang dikenali dan tidak
 * bisa dibuka/dicetak. Jadi tipe SELALU diturunkan dari nama file, bukan ditebak.
 */

const MIME_BY_EXT: Record<string, string> = {
    // Gambar
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    // Dokumen
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    txt: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    // Arsip & media
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
};

export const DEFAULT_MIME = 'application/octet-stream';

/** MIME type dari ekstensi nama file; DEFAULT_MIME kalau ekstensinya tak dikenal. */
export function getMimeTypeFromFileName(fileName: string): string {
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    return MIME_BY_EXT[ext] || DEFAULT_MIME;
}

/**
 * Kebalikannya: MIME → ekstensi (tanpa titik), '' kalau tak dikenal.
 *
 * Dipakai sebagai CADANGAN saat menamai file unduhan yang URL-nya tidak
 * berekstensi. Sumber utama tetap nama/URL berkasnya — satu MIME bisa berasal
 * dari beberapa ekstensi (image/jpeg ← jpg & jpeg), jadi hasil di sini adalah
 * ejaan pertama yang terdaftar di atas, bukan tentu ejaan yang diunggah orang.
 */
export function getExtensionFromMimeType(mimeType: string): string {
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    if (!mime || mime === DEFAULT_MIME) return '';
    for (const [ext, tipe] of Object.entries(MIME_BY_EXT)) {
        if (tipe === mime) return ext;
    }
    return '';
}
