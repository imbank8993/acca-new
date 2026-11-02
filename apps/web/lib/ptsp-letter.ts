export type LetterNotice = {
    id: string; recipient_id: string; sender_name: string; recipient_name: string;
    instructions: string; created_at: string; read_at: string | null;
    snapshot: Record<string, unknown>;
};

const LABELS: Record<string, string> = {
    layanan: 'Jenis layanan', nama: 'Nama pemohon', nama_siswa: 'Nama siswa', wa: 'Nomor WhatsApp',
    no_wa: 'Nomor WhatsApp', instansi: 'Instansi', instansi_sekolah: 'Instansi / sekolah',
    alamat: 'Alamat', tujuan: 'Tujuan', bertemu_dengan: 'Bertemu dengan', kelas: 'Kelas',
    sekolah_kampus: 'Sekolah / kampus', jurusan: 'Jurusan', judul_penelitian: 'Judul penelitian',
    tanggal_mulai: 'Tanggal mulai', tanggal_selesai: 'Tanggal selesai', tanggal_lahir: 'Tanggal lahir',
    tempat_lahir: 'Tempat lahir', jenis_kelamin: 'Jenis kelamin', nisn: 'NISN', nama_ibu: 'Nama ibu',
    alasan: 'Alasan', alasan_lainnya: 'Alasan lainnya', alasan_pindah: 'Alasan pindah',
    keterangan: 'Keterangan', jenis_dokumen: 'Jenis dokumen', jumlah_lembar: 'Jumlah lembar',
    jenis: 'Jenis kegiatan', jenis_lainnya: 'Jenis lainnya', jenis_laporan: 'Jenis laporan',
    isi_laporan: 'Isi laporan', target: 'Sasaran', jumlah_tim: 'Jumlah tim', rencana_waktu: 'Rencana waktu',
    created_at: 'Permohonan diterima', catatan_admin: 'Catatan petugas',
};
const FILES: Record<string, string> = {
    file_surat_pengantar: 'Surat pengantar', file_proposal: 'Proposal', file_dokumen: 'Dokumen permohonan',
    file_permohonan_ortu: 'Surat permohonan orang tua', file_rekomendasi_tujuan: 'Surat rekomendasi tujuan',
    file_copy_ijazah: 'Salinan ijazah', file_copy_ktp: 'Salinan KTP', file_pas_foto: 'Pas foto',
    file_surat_kehilangan: 'Surat kehilangan', file_bukti: 'Bukti pendukung', file_url: 'Lampiran surat',
};

export function letterDate(value: unknown): string {
    if (typeof value !== 'string' || !value) return '-';
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Makassar', day: 'numeric', month: 'long', year: 'numeric',
        ...(value.includes('T') ? { hour: '2-digit', minute: '2-digit' } as const : {}),
    });
}

export function letterFields(snapshot: Record<string, unknown> = {}) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
    return Object.entries(snapshot).flatMap(([key, value]) => {
        if (!LABELS[key] || value === null || value === undefined || typeof value === 'object') return [];
        const text = String(value).trim();
        return text ? [{ label: LABELS[key], value: /^(tanggal_|created_at|rencana_waktu)/.test(key) ? letterDate(text) : text }] : [];
    });
}

export function letterAttachments(snapshot: Record<string, unknown> = {}) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
    return Object.entries(snapshot).flatMap(([key, value]) => {
        if (!FILES[key] || typeof value !== 'string' || !value.trim()) return [];
        const url = value.trim();
        try {
            if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return [{ label: FILES[key], url }];
            if (!/^https?:\/\//i.test(url)) return [];
            const parsed = new URL(url);
            if (parsed.username || parsed.password) return [];
            return [{ label: FILES[key], url }];
        } catch { return []; }
    });
}
