/** Shared account presentation for the data table and export preview. */
export default function RekeningCell({ value }: { value: unknown }) {
  if (typeof value !== 'string' || !value.trim()) return <span className="bd-account-empty">-</span>;

  return <div className="bd-accounts">
    {value.split('\n').filter(line => line.trim()).map((line, index) => {
      const account = /^Nomor: (.*?) \| Bank: (.*?) \| Atas nama: (.*)$/.exec(line);
      if (!account) return <div key={index} className="bd-account bd-account--fallback">{line.replace(/ \| /g, '\n')}</div>;

      const [, nomor, bank, atasNama] = account;
      return <div key={index} className="bd-account">
        <strong className="bd-account-number">{nomor}</strong>
        <span className="bd-account-bank">{bank}</span>
        <span className="bd-account-holder"><span>Atas nama</span><span>{atasNama}</span></span>
      </div>;
    })}
  </div>;
}
