function isUksRecommendation(type, number = '') {
    return !['REKAM_MEDIK', 'REKAPAN_SAKIT', 'REKAPAN_IZIN'].includes(type) &&
        (['REKOMENDASI_KONTROL', 'SAKIT', 'UKS'].includes(type) || number.includes('/UKS/'));
}
/** The recommender is the recorded clinician, independent of who prints the letter. */
function uksRecommendationSigner(record) {
    const source = record?.rekam_medis_siswa?.petugas_nama?.trim() ? record.rekam_medis_siswa : record;
    const nama = source?.petugas_nama?.trim();
    if (!nama || /^(?:-|petugas(?: uks)?|admin uks)$/i.test(nama)) return null;
    return { nama, nip: source?.petugas_nip?.trim() || '-', jabatan: 'Petugas UKS' };
}

module.exports = { isUksRecommendation, uksRecommendationSigner };
