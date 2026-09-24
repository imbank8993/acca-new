import { prisma } from './prisma';

// ─── Types ───────────────────────────────────────────────
export interface ConfigSurat {
    background_url: string | null;
    logo_url: string | null;
    logo_kecil_url: string | null;
    header_text: string | null;
    footer_text: string | null;
    format_nomor_template: string | null;
    pejabat_default_nama: string | null;
    pejabat_default_jabatan: string | null;
    pejabat_default_nip: string | null;
    kode1_options: string | null;
    kode2_options: string | null;
    kode3_options: string | null;
}

export interface ProfilSekolah {
    nama: string;
    logo_url: string | null;
    background_surat_url: string | null;
    header_surat_text: string | null;
    footer_surat_text: string | null;
    format_nomor_surat: string | null;
    bagian_default: string | null;
    kepala_sekolah_nama: string | null;
}

// ─── Get Surat Config ────────────────────────────────────
export async function getSuratConfig() {
    // Try config_surat first (has is_default flag)
    const configData = await prisma.config_surat.findFirst({
        where: { is_default: true }
    });

    // Get profil_sekolah
    const profilData = await prisma.profil_sekolah.findFirst();

    // Merge config (config_surat overrides profil_sekolah)
    return {
        background_url: configData?.background_url || profilData?.background_surat_url || null,
        logo_url: configData?.logo_url || profilData?.logo_url || null,
        logo_kecil_url: configData?.logo_kecil_url || profilData?.logo_kecil_url || null,
        header_text: configData?.header_text || profilData?.header_surat_text || null,
        footer_text: configData?.footer_text || profilData?.footer_surat_text || null,
        format_nomor_template: configData?.format_nomor_template || profilData?.format_nomor_surat || '{nomor}/{kode1}/{kode2}/{kode3}/{bulan_romawi}/{tahun}',
        kode1_options: configData?.kode1_options || null,
        kode2_options: configData?.kode2_options || null,
        kode3_options: configData?.kode3_options || null,
        pejabat_default: {
            nama: configData?.pejabat_default_nama || profilData?.kepala_sekolah_nama || null,
            jabatan: configData?.pejabat_default_jabatan || null,
            nip: configData?.pejabat_default_nip || null
        }
    };
}

// ─── Get Default Pejabat ────────────────────────────────
export async function getDefaultPejabat() {
    const config = await getSuratConfig();
    return config.pejabat_default;
}

// ─── Get Template Background URL ─────────────────────────
/**
 * Resolves the background template image URL for a given letter type.
 * Priority:
 * 1. Active template in `surat_templates` (configured via /pengaturan-umum?tab=surat)
 * 2. `config_surat` (default surat config)
 * 3. `profil_sekolah` (school profile background)
 * 4. Fallback static image (/images/Surat ACCA A4.png)
 */
export async function getTemplateBackgroundUrl(letterType?: string): Promise<string> {
    try {
        if (letterType) {
            let targetTypes: string[] = [];

            if (letterType === 'REKAM_MEDIK') {
                targetTypes = ['REKAM_MEDIK', 'REKOMENDASI_KONTROL'];
            } else if (letterType === 'REKOMENDASI_KONTROL' || letterType === 'SAKIT') {
                targetTypes = ['REKOMENDASI_KONTROL', 'REKAM_MEDIK'];
            } else if (
                letterType === 'MENINGGALKAN_ASRAMA' ||
                letterType === 'AKHIR_PEKAN' ||
                letterType === 'P' ||
                letterType === 'M' ||
                letterType === 'IZIN'
            ) {
                targetTypes = ['MENINGGALKAN_ASRAMA'];
            } else if (letterType === 'REKAPAN_IZIN') {
                targetTypes = ['MENINGGALKAN_ASRAMA'];
            } else if (letterType === 'REKAPAN_SAKIT') {
                targetTypes = ['REKAM_MEDIK', 'REKOMENDASI_KONTROL'];
            } else {
                targetTypes = [letterType];
            }

            for (const t of targetTypes) {
                const tm = await prisma.surat_templates.findFirst({
                    where: { jenis_surat: t, is_active: true },
                    select: { template_html: true },
                    orderBy: { updated_at: 'desc' },
                });

                if (tm?.template_html && typeof tm.template_html === 'string' && tm.template_html.trim().startsWith('http')) {
                    const url = tm.template_html.trim();
                    const isDocx = url.toLowerCase().endsWith('.docx') || url.toLowerCase().endsWith('.doc');
                    if (!isDocx) {
                        return url;
                    }
                }
            }
        }

        // Fallback 1: config_surat
        const configData = await prisma.config_surat.findFirst({
            where: { is_default: true },
            select: { background_url: true },
        });
        if (configData?.background_url) return configData.background_url;

        // Fallback 2: profil_sekolah
        const profilData = await prisma.profil_sekolah.findFirst({
            select: { background_surat_url: true },
        });
        if (profilData?.background_surat_url) return profilData.background_surat_url;
    } catch (e) {
        console.warn('[getTemplateBackgroundUrl] Error resolving template:', e);
    }

    return '/images/Surat ACCA A4.png';
}

// ─── Get Background URL ──────────────────────────────────
export async function getBackgroundUrl(letterType?: string): Promise<string> {
    return getTemplateBackgroundUrl(letterType);
}

// ─── Format Variables ────────────────────────────────────
export const FORMAT_VARIABLES = [
    { code: '{nomor}', desc: 'Nomor urut (001, 002, ...)' },
    { code: '{kode}', desc: 'Kode bagian (A, B, C)' },
    { code: '{bagian}', desc: 'Nama bagian (Umum, Akademik, dll)' },
    { code: '{kode1}', desc: 'Kode-1 (A=Umum, B=Guru, C=Siswa)' },
    { code: '{kode2}', desc: 'Kode-2 (001=Reguler, 002=Khusus)' },
    { code: '{kode3}', desc: 'Kode-3 (G=Guru, S=Siswa)' },
    { code: '{bulan_romawi}', desc: 'Bulan Romawi (I, II, III, ..., XII)' },
    { code: '{bulan}', desc: 'Bulan angka (01, 02, ..., 12)' },
    { code: '{tahun}', desc: 'Tahun (2026)' },
    { code: '{jenis}', desc: 'Jenis surat (UNDANGAN, dll)' },
    { code: '{klasifikasi}', desc: 'Klasifikasi (BIASA, RAHASIA)' },
];

// ─── Format Nomor Surat ──────────────────────────────────
export function formatNomorSurat(
    template: string,
    variables: {
        nomor: string;
        kode?: string;
        bagian?: string;
        kode1?: string;
        kode2?: string;
        kode3?: string;
        bulan_romawi: string;
        bulan: string;
        tahun: string;
        jenis?: string;
        klasifikasi?: string;
    }
): string {
    return template
        .replace('{nomor}', variables.nomor)
        .replace('{kode}', variables.kode || '')
        .replace('{bagian}', variables.bagian || '')
        .replace('{kode1}', variables.kode1 || '')
        .replace('{kode2}', variables.kode2 || '')
        .replace('{kode3}', variables.kode3 || '')
        .replace('{bulan_romawi}', variables.bulan_romawi)
        .replace('{bulan}', variables.bulan)
        .replace('{tahun}', variables.tahun)
        .replace('{jenis}', variables.jenis || '')
        .replace('{klasifikasi}', variables.klasifikasi || '');
}

// ─── Get Month Roman ─────────────────────────────────────
export function getMonthRoman(month: number): string {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[month - 1] || 'I';
}