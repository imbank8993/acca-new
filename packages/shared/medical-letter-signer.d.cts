type MedicalStaff = { petugas_nama?: string | null; petugas_nip?: string | null };
export type MedicalLetterRecord = MedicalStaff & { rekam_medis_siswa?: MedicalStaff | null };
export function isUksRecommendation(type: string, number?: string): boolean;
export function uksRecommendationSigner(record: MedicalLetterRecord | null | undefined): { nama: string; nip: string; jabatan: string } | null;
