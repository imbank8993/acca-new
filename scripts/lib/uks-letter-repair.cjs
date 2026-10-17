const wrongDefaultSigner = value => String(value || '').toLowerCase().replace(/[^a-z]/g, '') === 'imranssi';
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function repairSignatureHtml(html, signer) {
    if (!html) return html;
    let names = 0, titles = 0;
    const updated = html.replace(/<div class="sign-box">[\s\S]*?<div class="barcode-id">/g, block => {
        let next = block.replace(/(<div class="sign-name">)([^<]*)(<\/div>)/g, (_all, before, name, after) => {
            if (!wrongDefaultSigner(name)) throw new Error('Snapshot signer differs from the targeted default');
            names++; return before + escapeHtml(signer.nama) + after;
        });
        next = next.replace(/(<div class="sign-place">[\s\S]*?<\/div>\s*<div>)[^<]*(<\/div>)/, (_all, before, after) => { titles++; return before + 'Petugas UKS' + after; });
        return next.replace(/<div(?: class="sign-nip")?>NIP\.[^<]*<\/div>/g, () => signer.nip && signer.nip !== '-' ? `<div>NIP. ${escapeHtml(signer.nip)}</div>` : '');
    });
    if (names !== 1 || titles !== 1) throw new Error('Unexpected signature structure; no partial repair allowed');
    return updated;
}
module.exports = { wrongDefaultSigner, repairSignatureHtml };
