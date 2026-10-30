/** Stable names for letter downloads and linked information documents. */
function suratFileName(nomor, perihal) {
  const clean = value => String(value || '').normalize('NFC')
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '-')
    .replace(/\s+/g, ' ').replace(/[ .]+$/g, '').trim().slice(0, 100);
  const number = clean(nomor) || 'Surat';
  const subject = clean(perihal);
  return `${number}${subject ? `_${subject}` : ''}.pdf`;
}

function edaranDivision(letter) {
  const surat = typeof letter === 'string' ? { jenis_surat: letter } : (letter || {});
  const tokens = value => String(value || '').toUpperCase().split(/[^A-Z0-9]+/);
  const jenis = tokens(surat.jenis_surat);
  if (!jenis.includes('EDARAN')) return null;
  const division = values => {
    const words = values.flatMap(tokens);
    const academic = words.includes('AKADEMIK'), student = words.includes('KESISWAAN');
    if (academic && student) return 'ambiguous';
    return academic ? 'Akademik' : student ? 'Kesiswaan' : null;
  };
  // Explicit type wins; otherwise use the numbered department, then signer role.
  const result = division([surat.jenis_surat])
    || division([surat.nomor_surat, surat.nomor_kode1_nama, surat.nomor_kode2_nama, surat.nomor_kode3_nama])
    || division([surat.pejabat_jabatan, surat.penandatangan_jabatan]);
  return result === 'ambiguous' ? null : result;
}
module.exports = { suratFileName, edaranDivision };
