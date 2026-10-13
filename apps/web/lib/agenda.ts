export const SASARAN_AGENDA = [
  { value: 'GURU', label: 'Guru' },
  { value: 'STAF', label: 'Staf' },
  { value: 'SISWA', label: 'Siswa' },
  { value: 'UMUM', label: 'Umum' },
];

export function sasaranAgenda(raw?: string[] | null): string[] {
  const selected = SASARAN_AGENDA.filter(option => raw?.includes(option.value)).map(option => option.value);
  return selected.length ? selected : ['UMUM'];
}

export async function fetchAgendaList(allowPublic = false, signal?: AbortSignal) {
  const response = await fetch('/api/agenda-madrasah', { signal });
  if (allowPublic && [401, 403].includes(response.status)) {
    const list: any[] = [];
    let page = 1;
    for (;;) {
      const res = await fetch(`/api/agenda-madrasah/public?limit=200&page=${page}`, { signal });
      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.data)) throw new Error(json.error || json.message || 'Gagal memuat agenda publik.');
      list.push(...json.data);
      if (!json.has_more) return list;
      if (!json.data.length || page >= 10000) throw new Error('Data agenda belum lengkap. Silakan coba lagi.');
      page++;
    }
  }
  const json = await response.json();
  if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error(json.error || json.message || 'Gagal memuat data agenda.');
  return json.data as any[];
}
