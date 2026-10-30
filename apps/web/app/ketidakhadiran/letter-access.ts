/** Match the deletion policy enforced by the ACCA letter backend. */
export function isSakitLetter(jenis: string, nomor = ''): boolean {
    return ['REKOMENDASI_KONTROL', 'REKAM_MEDIK', 'REKAPAN_SAKIT', 'UKS', 'SAKIT'].includes(jenis) || nomor.includes('/UKS/');
}

export function canDeleteLetter(letter: { jenis_izin: string; nomor_surat: string }, access: { isAdmin: boolean; canManageIzin: boolean; canManageSakit: boolean }): boolean {
    if (access.isAdmin) return true;
    const nomor = letter.nomor_surat || '';
    const izin = ['MENINGGALKAN_ASRAMA', 'P', 'M', 'REKAPAN_IZIN', 'IZIN'].includes(letter.jenis_izin);
    return (access.canManageIzin && izin && !nomor.includes('/UKS/'))
        || (access.canManageSakit && isSakitLetter(letter.jenis_izin, nomor));
}
