import { ReceiptFields, receiptFields } from './payment-rules';

export type OcrLine = { text: string; confidence: number };
type Hit = { value: string; confidence: number; index: number };
// Preserve line order and confidence; never silently replace O/0 or I/1 in account numbers.
export function tsvLines(tsv: string): OcrLine[] {
  const lines = new Map<string, { words: string[]; confidence: number }>();
  for (const raw of tsv.split(/\r?\n/).slice(1)) {
    const cols = raw.split('\t');
    if (cols[0] !== '5' || cols.length < 12) continue;
    const word = cols.slice(11).join('\t').trim();
    if (!word) continue;
    const key = cols.slice(1, 5).join(':');
    const confidence = Number(cols[10]);
    const line = lines.get(key) || { words: [], confidence: 100 };
    line.words.push(word);
    line.confidence = Math.min(line.confidence, Number.isFinite(confidence) ? confidence : 0);
    lines.set(key, line);
  }
  return [...lines.values()].map(l => ({ text: l.words.join(' '), confidence: l.confidence }));
}

export function rupiahAmount(raw: string): number | null {
  if (/(?:USD|SGD|EUR|MYR|\$|€)/i.test(raw)) return null;
  let value = raw.trim().replace(/^(?:Rp\.?|IDR)\s*/i, '').replace(/[,.-]-$/, '').replace(/\s+/g, '');
  if (/[.,]\d{2}$/.test(value)) {
    if (!value.endsWith('00')) return null;
    value = value.slice(0, -3);
  }
  if (!/^\d+$/.test(value) && !/^\d{1,3}(?:\.\d{3})+$/.test(value) && !/^\d{1,3}(?:,\d{3})+$/.test(value)) return null;
  const n = Number(value.replace(/[.,]/g, ''));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const keyLine = /^(?:nama|nomor|no[.\s]|rekening|bank\b|tanggal|waktu|jumlah|nominal|total|biaya|pesan|berita|catatan|referensi|status|sumber|dari\b|ke\b|tujuan\b|penerima\b|pengirim\b|recipient|beneficiary|destination|amount|transfer amount|reference|date\b|sender)/i;
const moneyText = /(?:Rp\.?|IDR)\s*\d[\d.,]*(?:\s*[,.-]-)?/i;
const knownBank = /\b(BRI|BCA|BNI|BSI|MANDIRI|CIMB(?:\s+NIAGA)?|BTN|PERMATA|DANAMON|BTPN|JAGO|SEABANK|BANK\s+RAKYAT\s+INDONESIA|BANK\s+CENTRAL\s+ASIA|BANK\s+NEGARA\s+INDONESIA|BANK\s+SYARIAH\s+INDONESIA)\b/i;

export function parseReceiptLines(input: OcrLine[]): ReceiptFields {
  const lines = input.map(l => ({ ...l, text: l.text.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() })).filter(l => l.text);
  const warnings: string[] = [];
  const source: boolean[] = [];
  let inSource = false;
  lines.forEach((line, i) => {
    if (/^(?:dari|pengirim|sumber dana|rekening sumber|rekening asal|sender|from)(?:\b|\s*:)/i.test(line.text)) inSource = true;
    if (/^(?:(?:(?:no\.?|nomor)\s+)?rekening\s+(?:tujuan|penerima)|bank\s+(?:tujuan|penerima)|ke|tujuan|penerima|nama penerima|beneficiary|destination|recipient)(?:\b|\s*:)/i.test(line.text)) inSource = false;
    source[i] = inSource;
  });
  const hits = (pattern: RegExp, allowSource = false): Hit[] => {
    const found: Hit[] = [];
    lines.forEach((l, index) => {
      if (!allowSource && source[index]) return;
      const match = l.text.match(pattern);
      if (!match) return;
      let value = l.text.slice(match[0].length).replace(/^[\s:|=\-]+/, '').trim();
      let confidence = l.confidence;
      if (!value) {
        const next = lines[index + 1];
        if (!next || keyLine.test(next.text)) return;
        value = next.text; confidence = Math.min(confidence, next.confidence);
      }
      found.push({ value, confidence, index });
    });
    return found;
  };
  const unique = (values: Hit[], label: string): Hit | undefined => {
    if (new Set(values.map(v => v.value.toUpperCase())).size > 1) { warnings.push(`${label} ambigu`); return; }
    return values[0];
  };
  const recipient = unique(hits(/^(?:(?:nama\s+)?(?:penerima|tujuan)|nama\s+pemilik\s+rekening|beneficiary\s+name|recipient(?:\s+name)?|account\s+name)\b/i)
    .filter(h => /[a-z]/i.test(h.value) && !keyLine.test(h.value) && !moneyText.test(h.value)), 'Nama penerima');
  const explicitAccount = hits(/^(?:(?:no\.?|nomor)\s+)?(?:rekening|akun)\s+(?:tujuan|penerima)\b|^(?:destination|recipient)\s+account(?:\s+number)?\b/i);
  const genericAccount = hits(/^(?:(?:no\.?|nomor)\s+(?:rekening|rek\.?|akun)|rekening|account\s+(?:no\.?|number))\b/i);
  const accounts = (explicitAccount.length ? explicitAccount : genericAccount).map(h => {
    const match = h.value.match(/(?<![a-z0-9])[\d*xX•][\d*xX• .-]{4,38}[\d*xX•](?![a-z0-9])/i);
    return { ...h, value: match?.[0].trim() || '' };
  }).filter(h => h.value && !/[a-z]/i.test(h.value.replace(/[xX]/g, '')));
  const account = unique(accounts, 'Rekening tujuan');
  if (account && !explicitAccount.length && !lines.slice(0, account.index + 1).some(l => /\b(penerima|tujuan|recipient|beneficiary|destination)\b/i.test(l.text))) warnings.push('Periksa apakah rekening merupakan rekening tujuan');
  const bankHits = hits(/^(?:(?:nama\s+)?bank(?:\s+(?:tujuan|penerima))?|(?:destination|recipient)\s+bank)\b/i).map(h => ({ ...h, value: h.value.match(knownBank)?.[0] || h.value }));
  let bank = unique(bankHits, 'Bank tujuan');
  if (!bank && !bankHits.length) {
    // A bank logo/header may identify the sending bank, so it can only suggest a match.
    const codes = lines.map((l, index) => ({ value: l.text.match(knownBank)?.[0] || '', confidence: l.confidence, index })).filter(h => h.value);
    bank = unique(codes, 'Bank');
    if (bank) warnings.push('Bank dari judul bukti perlu diperiksa');
  }
  const amountLabels = hits(/^(?:nominal(?:\s+(?:transfer|transaksi))?|jumlah(?:\s+(?:transfer|dikirim|diterima|uang))?|transfer\s+amount|amount)\b/i, true);
  const amountHits = amountLabels
    .map(h => ({ ...h, value: String(rupiahAmount(h.value) ?? '') })).filter(h => h.value);
  let amount = unique(amountHits, 'Nominal transfer');
  if (amountLabels.length !== amountHits.length) { amount = undefined; warnings.push('Nominal berlabel belum terbaca dengan jelas'); }
  if (!amount && !amountLabels.length) {
    const values: Hit[] = [];
    lines.forEach((l, index) => {
      if (/(biaya|admin|fee|total|saldo|balance)/i.test(l.text)) return;
      if (index && /^(?:biaya|admin|fee|total|saldo|balance)/i.test(lines[index - 1].text)) return;
      const m = l.text.match(moneyText);
      const n = m && rupiahAmount(m[0]);
      if (n) values.push({ value: String(n), confidence: l.confidence, index });
    });
    amount = unique(values, 'Nominal transfer');
    if (amount) warnings.push('Nominal tanpa label perlu diperiksa');
  }
  const reference = unique(hits(/^(?:(?:no\.?|nomor|id)\s*(?:referensi|ref\.?|transaksi|resi)|reference\s*(?:no\.?|number|id)?|transaction\s+(?:no\.?|number|id)|ref\.?\s*(?:no\.?)?)\b/i, true)
    .map(h => ({ ...h, value: /^[a-z0-9][a-z0-9 .\-/]{5,100}$/i.test(h.value) ? h.value : '' })).filter(h => h.value), 'Referensi');
  const text = lines.map(l => l.text).join('\n');
  let status: ReceiptFields['status'] = 'unknown';
  let statusLine: OcrLine | undefined;
  for (const l of lines) {
    if (/\b(?:gagal|failed|tidak\s+berhasil|unsuccessful|dibatalkan|cancelled|canceled)\b/i.test(l.text)) { status = 'failed'; statusLine = l; break; }
    if (/\b(?:pending|tertunda|menunggu|diproses|sedang\s+diproses|in\s+progress|scheduled|terjadwal)\b/i.test(l.text)) { status = 'pending'; statusLine = l; }
    else if (status !== 'pending' && /\b(?:berhasil|sukses|successful|success|completed)\b/i.test(l.text) && !/\b(?:belum|not)\b/i.test(l.text)) { status = 'success'; statusLine = l; }
  }
  const dateHit = unique(hits(/^(?:tanggal(?:\s+(?:transfer|transaksi))?|date|waktu(?:\s+transaksi)?)\b/i, true), 'Tanggal');
  const dateSource = dateHit?.value || text;
  let date = '';
  const numeric = dateSource.match(/\b(?:(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{4}))\b/);
  const monthNames = ['jan(?:uari|uary)?', 'feb(?:ruari|ruary)?', 'mar(?:et|ch)?', 'apr(?:il)?', 'mei|may', 'jun(?:i|e)?', 'jul(?:i|y)?', 'agu(?:stus)?|aug(?:ust)?', 'sep(?:tember)?', 'okt(?:ober)?|oct(?:ober)?', 'nov(?:ember)?', 'des(?:ember)?|dec(?:ember)?'];
  if (numeric) date = numeric[1] ? `${numeric[1]}-${numeric[2].padStart(2, '0')}-${numeric[3].padStart(2, '0')}` : `${numeric[6]}-${numeric[5].padStart(2, '0')}-${numeric[4].padStart(2, '0')}`;
  else for (let i = 0; i < monthNames.length; i++) {
    const m = dateSource.match(new RegExp(`\\b(\\d{1,2})\\s+(?:${monthNames[i]})\\s+(\\d{4})\\b`, 'i'));
    if (m) { date = `${m[2]}-${String(i + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; break; }
  }
  if (date && (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) date = '';
  if ([account, bank, amount, statusLine].some(h => !h || h.confidence < 85)) warnings.push('Ada bagian penting yang belum terbaca jelas');
  const result = receiptFields({ recipient: recipient?.value || '', account: account?.value || '', bank: bank?.value || '', amount: amount ? Number(amount.value) : null, date, reference: reference?.value || '', status });
  return { ...result, reviewRequired: warnings.length > 0, warnings: [...new Set(warnings)] };
}
