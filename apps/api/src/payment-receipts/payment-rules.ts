export type ReceiptFields = {
  recipient: string; account: string; bank: string; amount: number | null;
  date: string; reference: string; status: 'success' | 'failed' | 'pending' | 'unknown';
  reviewRequired?: boolean; warnings?: string[];
};
export type PaymentCandidate = {
  key: string; nip: string; name: string; label: string; ids: string[]; amount: number;
  accounts: { number: string; bank: string; name: string }[];
};
export const normalizeName = (v: string) => v.toUpperCase().replace(/\b(S\.?\s?PD|M\.?\s?PD|DRS|DRA|DR|HJ|H)\b\.?/g, '').replace(/[^A-Z0-9]/g, '');
export function bankCode(v: string) {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BANK/, '');
  return ({ BANKRAKYATINDONESIA: 'BRI', RAKYATINDONESIA: 'BRI', CENTRALASIA: 'BCA', NEGARAINDONESIA: 'BNI', SYARIAHINDONESIA: 'BSI', BANKMANDIRI: 'MANDIRI' } as Record<string, string>)[s] || s;
}
export function accountNumber(v: string) {
  // Never turn a masked number into a full account match.
  return /^[\d\s.-]{6,40}$/.test(v) ? v.replace(/\D/g, '') : '';
}
export function matchingReceipt(fields: ReceiptFields, candidates: PaymentCandidate[]) {
  const account = accountNumber(fields.account);
  const bank = bankCode(fields.bank);
  const matching = candidates.filter(c => account && bank && c.accounts.some(a => accountNumber(a.number) === account && bankCode(a.bank) === bank));
  const exact = matching.filter(c => c.amount === fields.amount);
  const names = candidates.filter(c => normalizeName(fields.recipient).length >= 4 &&
    [c.name, ...c.accounts.map(a => a.name)].some(n => normalizeName(n) === normalizeName(fields.recipient)));
  // A shared account is ambiguous, even if the amount happens to fit one teacher.
  const uniqueOwner = new Set(matching.map(c => c.nip)).size === 1;
  const auto = fields.status === 'success' && !fields.reviewRequired && uniqueOwner && exact.length === 1;
  const suggested = auto ? exact[0] : matching.length === 1 ? matching[0] : names.length === 1 ? names[0] : null;
  return { suggestedKey: suggested?.key || '', ready: auto,
    reason: auto ? 'Rekening, bank, dan nominal sesuai' : fields.status !== 'success' ? 'Status transfer belum dapat dipastikan berhasil' :
      fields.reviewRequired && fields.warnings?.length ? fields.warnings.join(' · ') : matching.length ? 'Periksa nominal atau tujuan pembayaran' : names.length ? 'Nama cocok; rekening perlu diperiksa' : 'Penerima belum ditemukan' };
}
export function receiptFields(value: any): ReceiptFields {
  const str = (k: string) => typeof value?.[k] === 'string' ? value[k].trim().slice(0, 250) : '';
  return { recipient: str('recipient'), account: str('account'), bank: str('bank'),
    amount: typeof value?.amount === 'number' && Number.isSafeInteger(value.amount) && value.amount > 0 ? value.amount : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(str('date')) ? str('date') : '', reference: str('reference'),
    status: ['success', 'failed', 'pending'].includes(value?.status) ? value.status : 'unknown' };
}
export function referenceKey(f: ReceiptFields) {
  const ref = f.reference.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ref.length >= 6 ? `${ref}` : null;
}
