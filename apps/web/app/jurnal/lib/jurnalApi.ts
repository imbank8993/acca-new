import { JurnalGuru, JournalFilters, type JurnalFilters } from '../types';



export async function fetchJurnal(filter: JurnalFilters) {
    const params = new URLSearchParams();
    if (filter.nip) params.append('nip', filter.nip);
    if (filter.kelas) params.append('kelas', filter.kelas);
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.kategori) params.append('kategori', filter.kategori);
    if (filter.search) params.append('search', filter.search);

    const res = await fetch(`/api/jurnal?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch jurnal');
    return await res.json();
}

export async function deleteJurnal(id: number) {
    const res = await fetch(`/api/jurnal/${id}`, { method: 'DELETE' });
    const result = await res.json().catch(() => null);
    if (!res.ok || (result && result.ok === false && result.success === false)) {
        throw new Error(result?.error || result?.message || 'Failed to delete jurnal');
    }
    return result;
}

export async function submitJurnal(data: any) {
    const res = await fetch('/api/jurnal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.success && !result.ok) throw new Error(result.error || result.message || 'Failed to submit jurnal');
    return result;
}

// Fetch Master Waktu (for options)
export async function fetchMasterWaktu() {
    const res = await fetch('/api/master/waktu?limit=10000&show_inactive=false');
    if (!res.ok) throw new Error('Failed to fetch master waktu');
    const result = await res.json();
    return result.data || [];
}

// Fetch Master Kelas (for dropdown)
export async function fetchKelas() {
    const res = await fetch('/api/master/kelas?limit=100');
    if (!res.ok) throw new Error('Failed to fetch kelas');
    const result = await res.json();
    return result.data || [];
}
// Fetch Master Guru (for dropdown)
export async function fetchGuru() {
    const res = await fetch('/api/master/guru?limit=100');
    if (!res.ok) throw new Error('Failed to fetch guru');
    const result = await res.json();
    return result.data || [];
}
