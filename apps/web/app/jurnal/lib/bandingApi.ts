// Banding API client

export interface BandingItem {
    id: number;
    jurnal_id: number;
    nip: string;
    nama_guru: string;
    alasan: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    koreksi: Array<{ field: string; nilai_lama: any; nilai_baru: any }>;
    reviewed_by?: string;
    reviewed_by_name?: string;
    reviewed_at?: string;
    catatan_reviewer?: string;
    created_at: string;
    updated_at: string;
    jurnal?: any;
}

export interface BandingStatusCounts {
    total: number;
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
}

export interface BandingListResponse {
    success: boolean;
    bandings: BandingItem[];
    total: number;
    statusCounts: BandingStatusCounts | null;
    page: number;
    limit: number;
}

export async function fetchBandings(opts: {
    status?: string;
    bulan?: string;
    tahun?: string;
    nip?: string;
    q?: string;
    page?: number;
    limit?: number;
    mine?: boolean;    // batasi ke banding milik user sendiri (tab "Banding Saya")
    counts?: boolean;  // sertakan agregat per-status untuk kartu statistik
} = {}): Promise<BandingListResponse> {
    const params = new URLSearchParams();
    if (opts.status) params.append('status', opts.status);
    if (opts.bulan) params.append('bulan', opts.bulan);
    if (opts.tahun) params.append('tahun', opts.tahun);
    if (opts.nip) params.append('nip', opts.nip);
    if (opts.q) params.append('q', opts.q);
    if (opts.page) params.append('page', String(opts.page));
    if (opts.limit) params.append('limit', String(opts.limit ?? 20));
    if (opts.mine) params.append('mine', 'true');
    if (opts.counts) params.append('counts', 'true');

    const res = await fetch(`/api/jurnal/banding?${params.toString()}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Gagal mengambil data banding');
    }
    const json = await res.json();
    const rawList: BandingItem[] = (Array.isArray(json.bandings)
        ? json.bandings
        : (Array.isArray(json.data) ? json.data : [])).map((b: any) => ({
            ...b,
            jurnal: b.jurnal || b.jurnal_guru || null
        }));

    const statusCounts = json.statusCounts || {
        total: rawList.length,
        PENDING: rawList.filter(b => b.status === 'PENDING').length,
        APPROVED: rawList.filter(b => b.status === 'APPROVED').length,
        REJECTED: rawList.filter(b => b.status === 'REJECTED').length,
    };

    return {
        success: Boolean(json.success || json.ok),
        bandings: rawList,
        total: json.total ?? rawList.length,
        statusCounts,
        page: json.page || (opts.page ?? 1),
        limit: json.limit || (opts.limit ?? 20),
    };
}

export async function fetchBandingDetail(id: number): Promise<{ success: boolean; banding: BandingItem; history: any[] }> {
    const res = await fetch(`/api/jurnal/banding/${id}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Gagal mengambil detail banding');
    }
    const json = await res.json();
    const banding = json.banding || json.data;
    if (banding) {
        banding.jurnal = banding.jurnal || banding.jurnal_guru || null;
    }
    return {
        success: Boolean(json.success || json.ok),
        banding,
        history: json.history || banding?.jurnal_banding_history || []
    };
}

export async function createBanding(data: {
    jurnalId: number;
    alasan: string;
    koreksi: Array<{ field: string; nilai_lama: any; nilai_baru: any }>;
    nip?: string;
    nama_guru?: string;
}): Promise<{ success: boolean; banding: BandingItem }> {
    const payload = {
        ...data,
        jurnal_id: data.jurnalId,
        jurnalId: data.jurnalId,
    };
    const res = await fetch('/api/jurnal/banding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal mengirim banding');
    return result;
}

export async function reviewBanding(id: number, status: 'APPROVED' | 'REJECTED', catatan?: string): Promise<{ success: boolean; banding: BandingItem }> {
    const res = await fetch(`/api/jurnal/banding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, catatan, catatan_reviewer: catatan }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal memproses banding');
    return result;
}

export async function deleteBanding(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/jurnal/banding/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal menghapus banding');
    return result;
}

export async function fetchPendingCount(): Promise<number> {
    try {
        const res = await fetch('/api/jurnal/banding?status=PENDING&limit=1');
        if (!res.ok) return 0;
        const data = await res.json();
        if (typeof data.total === 'number') return data.total;
        if (Array.isArray(data.data)) return data.data.length;
        if (Array.isArray(data.bandings)) return data.bandings.length;
        return 0;
    } catch {
        return 0;
    }
}

