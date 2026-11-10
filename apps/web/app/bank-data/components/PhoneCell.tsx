/** Tautan WhatsApp hanya dibuat untuk nomor seluler Indonesia yang jelas. */
export function whatsappNumber(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return null;
  const digits = raw.replace(/[\s().-]/g, '').replace(/^\+/, '');
  const international = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('8') ? `62${digits}` : digits;
  return /^628\d{8,12}$/.test(international) ? international : null;
}

export default function PhoneCell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <>—</>;
  const label = String(value);
  const number = whatsappNumber(value);
  if (!number) return <>{label}</>;

  return <a className="bd-phone-link" href={`https://wa.me/${number}`} target="_blank" rel="noopener noreferrer" aria-label={`Mulai chat WhatsApp ke ${label}`} title="Mulai chat WhatsApp">
    <span>{label}</span><i className="bi bi-whatsapp" aria-hidden="true" />
  </a>;
}
