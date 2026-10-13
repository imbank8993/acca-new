import { SASARAN_AGENDA, sasaranAgenda } from '@/lib/agenda';

export default function SasaranAgenda({ sasaran }: { sasaran?: string[] | null }) {
  const selected = sasaranAgenda(sasaran);
  return <div className="ag-sasaran-badges" aria-label="Sasaran agenda">
    {SASARAN_AGENDA.filter(option => selected.includes(option.value)).map(option =>
      <span className="ag-sasaran-badge" key={option.value}>{option.label}</span>)}
  </div>;
}
