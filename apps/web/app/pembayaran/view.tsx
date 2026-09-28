'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { swalSuccess, swalError, swalConfirm } from '@/lib/swal-premium';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { Tab } from '@/components/ui/Tab';
import './pembayaran.css';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

interface Submission {
    id: string; nip: string; nama_guru_snap: string | null; bulan: number; tahun: number;
    status: 'Submitted' | 'Approved' | 'Revisi'; total_laporan: number;
    approved_by_name?: string | null; approved_at?: string | null; pdf_url?: string | null;
    dibayarkan: boolean; dibayarkan_at?: string | null; dibayarkan_by_name?: string | null; catatan_pembayaran?: string | null;
}

interface KlinikSlot {
    id: string; guru_id: number; nama_guru: string; mapel: string; topik: string;
    tanggal: string; status: string; max_siswa: number;
    klinik_peserta?: any[]; klinik_laporan?: any;
    guru?: { nip: string; nama: string };
}

interface EkskulSubmission {
    id: string; ekskul_id: string; pembina_nip: string; pembina_nama: string | null;
    bulan: number; tahun: number; status: string; total_pertemuan: number;
    jml_internal: number; jml_eksternal: number;
    dibayarkan: boolean; dibayarkan_at?: string | null; dibayarkan_by_name?: string | null; catatan_pembayaran?: string | null;
    pdf_url?: string | null;
    ekskul?: { nama_ekskul: string };
}

interface TarifHonor {
    id: string; modul: string; label: string; satuan: 'per_bulan' | 'per_pertemuan'; nominal: number;
    updated_at?: string | null; updated_by_name?: string | null;
}

/** Helper parsing nominal yang kebal terhadap number, string, Decimal object {s,e,d}, null, undefined */
function parseNominal(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
        const parsed = Number(val);
        return isNaN(parsed) ? 0 : parsed;
    }
    // Handle Prisma Decimal object: { s, e, d: [250000] }
    if (typeof val === 'object') {
        if (typeof val.toNumber === 'function') {
            try { return val.toNumber(); } catch {}
        }
        if (typeof val.toFixed === 'function') {
            try { return Number(val.toFixed()); } catch {}
        }
        if (Array.isArray(val.d) && val.d.length > 0) {
            const rawNum = Number(val.d.join(''));
            if (!isNaN(rawNum)) {
                return (val.s === -1 ? -1 : 1) * rawNum;
            }
        }
        if ('toString' in val && typeof val.toString === 'function') {
            const str = val.toString();
            if (str && str !== '[object Object]') {
                const parsed = Number(str);
                if (!isNaN(parsed)) return parsed;
            }
        }
    }
    return 0;
}

const fmtRupiah = (n: any) => {
    const num = parseNominal(n);
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
};

/** klinik_laporan bisa datang sbg array (embed Supabase/Prisma) atau objek tunggal. */
function getKlinikLaporan(slot: KlinikSlot): any {
    return Array.isArray(slot.klinik_laporan) ? slot.klinik_laporan[0] : slot.klinik_laporan;
}

/** Validasi protokol URL aman untuk mencegah Stored XSS */
function isSafeHttpUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

interface CatatanData {
    text: string;
    url: string;
    nominal: number | null;
    paid_at?: string | null;
}

const getCatatanData = (raw: string | null | undefined): CatatanData => {
    if (!raw) return { text: '', url: '', nominal: null };
    try {
        const trimmed = raw.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const p = JSON.parse(trimmed);
            const parsedNominal = p.nominal !== undefined && p.nominal !== null ? parseNominal(p.nominal) : null;
            return {
                text: typeof p.text === 'string' ? p.text : '',
                url: typeof p.url === 'string' ? p.url : '',
                nominal: parsedNominal !== null && parsedNominal > 0 ? parsedNominal : null,
                paid_at: typeof p.paid_at === 'string' ? p.paid_at : null,
            };
        }
    } catch(e) {}
    return { text: raw, url: '', nominal: null };
};

interface PembayaranPageProps {
    user?: any;
}

export default function PembayaranPage({ user: propUser }: PembayaranPageProps = {}) {
    const [user, setUser] = useState<any>(propUser || null);
    const [loading, setLoading] = useState(false);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [saving, setSaving] = useState(false);
    const [filterBayar, setFilterBayar] = useState('BELUM');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('GURU_ASUH');

    const [klinikSlots, setKlinikSlots] = useState<KlinikSlot[]>([]);
    const [loadingKlinik, setLoadingKlinik] = useState(false);
    const [savingKlinik, setSavingKlinik] = useState(false);
    const [klinikFilterBayar, setKlinikFilterBayar] = useState('BELUM');
    const [klinikSearchQuery, setKlinikSearchQuery] = useState('');

    const [ekskulSubmissions, setEkskulSubmissions] = useState<EkskulSubmission[]>([]);
    const [loadingEkskul, setLoadingEkskul] = useState(false);
    const [savingEkskul, setSavingEkskul] = useState(false);
    const [ekskulFilterBayar, setEkskulFilterBayar] = useState('BELUM');
    const [ekskulSearchQuery, setEkskulSearchQuery] = useState('');

    const [tarifList, setTarifList] = useState<TarifHonor[]>([]);
    const [loadingTarif, setLoadingTarif] = useState(false);
    const [savingTarifModul, setSavingTarifModul] = useState<string | null>(null);
    const [tarifDraft, setTarifDraft] = useState<Record<string, string>>({});

    const [rekapanBulan, setRekapanBulan] = useState(new Date().getMonth() + 1);
    const [rekapanTahun, setRekapanTahun] = useState(new Date().getFullYear());

    const TABS = [
        { id: 'KLINIK', label: 'Klinik Pembelajaran', icon: 'bi-heart-pulse' },
        { id: 'GURU_ASUH', label: 'Guru Asuh', icon: 'bi-person-heart' },
        { id: 'EKSKUL', label: 'Ekstrakurikuler', icon: 'bi-person-plus' },
        { id: 'REKAPAN', label: 'Rekapan', icon: 'bi-journal-check' },
        { id: 'NOMINAL', label: 'Nominal', icon: 'bi-cash-stack' },
    ];

    const userRoles = useMemo(() => {
        if (!user) return [];
        const list = Array.isArray(user.roles) ? [...user.roles] : [user.role || ''];
        return list.filter(Boolean).map((r: string) => r.toString().toUpperCase());
    }, [user]);
    const isAdmin = useMemo(() => userRoles.some((r: string) => r.includes('ADMIN')), [userRoles]);
    const isBendahara = useMemo(() => isAdmin || userRoles.includes('BENDAHARA_KOMITE'), [isAdmin, userRoles]);

    useEffect(() => {
        if (propUser) {
            setUser(propUser);
            return;
        }
        const init = async () => {
            try {
                const meRes = await fetch('/api/auth/me');
                const meData = await meRes.json();
                if (meData.ok && meData.user) {
                    setUser(meData.user);
                }
            } catch (err) {
                console.error('Error init user in pembayaran:', err);
            }
        };
        init();
    }, [propUser]);

    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/guru-asuh/laporan-submission?status=Approved');
            const data = await res.json();
            if (data.ok) setSubmissions(data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    const fetchTarif = useCallback(async () => {
        setLoadingTarif(true);
        try {
            const res = await authFetch('/api/tarif-honor');
            const data = await res.json();
            if (data.ok) {
                setTarifList(data.data || []);
                const draft: Record<string, string> = {};
                (data.data || []).forEach((t: TarifHonor) => { 
                    draft[t.modul] = String(parseNominal(t.nominal)); 
                });
                setTarifDraft(draft);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingTarif(false); }
    }, []);

    const fetchKlinikSlots = useCallback(async () => {
        setLoadingKlinik(true);
        try {
            const res = await authFetch('/api/klinik');
            const data = await res.json();
            if (data.ok) {
                // Sesi yang laporannya sudah Approved atau status sudah paid
                setKlinikSlots((data.data || []).filter((s: KlinikSlot) => 
                    s.status === 'paid' || getKlinikLaporan(s)?.status === 'Approved'
                ));
            }
        } catch (e) { console.error(e); }
        finally { setLoadingKlinik(false); }
    }, []);

    const fetchEkskulSubmissions = useCallback(async () => {
        setLoadingEkskul(true);
        try {
            const res = await authFetch('/api/ekskul/submission?status=Disahkan');
            const data = await res.json();
            if (data.ok) setEkskulSubmissions(data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoadingEkskul(false); }
    }, []);

    useEffect(() => {
        if (isBendahara) {
            fetchSubmissions();
            fetchTarif();
        }
    }, [isBendahara, fetchSubmissions, fetchTarif]);

    useEffect(() => {
        if (isBendahara && (activeTab === 'KLINIK' || activeTab === 'REKAPAN')) {
            fetchKlinikSlots();
        }
    }, [isBendahara, activeTab, fetchKlinikSlots]);

    useEffect(() => {
        if (isBendahara && (activeTab === 'EKSKUL' || activeTab === 'REKAPAN')) {
            fetchEkskulSubmissions();
        }
    }, [isBendahara, activeTab, fetchEkskulSubmissions]);

    const getTarif = useCallback((modul: string) => {
        const found = tarifList.find(t => t.modul === modul);
        return found ? parseNominal(found.nominal) : 0;
    }, [tarifList]);

    const handleUpdateTarif = async (modul: string) => {
        const raw = tarifDraft[modul] ?? '0';
        const nominal = Number(raw);
        if (isNaN(nominal) || nominal < 0) { swalError('Error', 'Nominal harus berupa angka >= 0'); return; }
        setSavingTarifModul(modul);
        try {
            const res = await authFetch('/api/tarif-honor', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modul, nominal }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal menyimpan tarif');
            swalSuccess('Berhasil', 'Tarif honor diperbarui.');
            fetchTarif();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSavingTarifModul(null); }
    };

    const filteredEkskulSubmissions = useMemo(() => {
        let list = ekskulSubmissions;
        if (ekskulFilterBayar === 'BELUM') list = list.filter(s => !s.dibayarkan);
        else if (ekskulFilterBayar === 'SUDAH') list = list.filter(s => s.dibayarkan);
        if (ekskulSearchQuery.trim()) {
            const q = ekskulSearchQuery.toLowerCase();
            list = list.filter(s => 
                (s.pembina_nama || '').toLowerCase().includes(q) || 
                (s.pembina_nip || '').toLowerCase().includes(q) || 
                (s.ekskul?.nama_ekskul || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [ekskulSubmissions, ekskulFilterBayar, ekskulSearchQuery]);

    const ekskulStats = useMemo(() => ({
        total: ekskulSubmissions.length,
        belum: ekskulSubmissions.filter(s => !s.dibayarkan).length,
        sudah: ekskulSubmissions.filter(s => s.dibayarkan).length,
    }), [ekskulSubmissions]);

    const handleTandaiEkskul = async (sub: EkskulSubmission, dibayarkan: boolean) => {
        let catatanInput = '';
        let buktiUrl = '';

        const internalCount = Number(sub.jml_internal ?? sub.total_pertemuan ?? 0) || 0;
        const eksternalCount = Number(sub.jml_eksternal ?? 0) || 0;
        const calculatedNominal = internalCount * getTarif('EKSKUL_INTERNAL') + eksternalCount * getTarif('EKSKUL_EKSTERNAL');

        if (dibayarkan) {
            const { value: result, isDismissed } = await Swal.fire({
                title: 'Catatan Pembayaran Ekstrakurikuler',
                html: `
                    <div style="text-align:left; padding:0 10px 15px; font-size:0.85rem; color:#475569;">
                        Internal: <strong>${internalCount}</strong> pertemuan &nbsp;·&nbsp; Eksternal: <strong>${eksternalCount}</strong> pertemuan<br>
                        Nominal yang akan dibayarkan: <strong>${fmtRupiah(calculatedNominal)}</strong>
                    </div>
                    <div style="text-align: left; padding: 0 10px;">
                        <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 5px;">Catatan (Opsional)</label>
                        <textarea id="swal-catatan" class="swal2-textarea" placeholder="Nomor bukti transfer, keterangan, dll..." style="margin: 0; width: 100%; box-sizing: border-box; min-height: 80px;"></textarea>
                    </div>
                    <div style="text-align: left; padding: 0 10px; margin-top: 15px;">
                        <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 5px;">Bukti Pembayaran (Opsional)</label>
                        <input type="file" id="swal-file" class="swal2-file" accept="image/*,.pdf" style="margin: 0; display: block; width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; font-size: 0.85rem;">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Tandai Dibayar',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#16a34a',
                cancelButtonColor: '#64748b',
                customClass: { confirmButton: 'whitespace-nowrap' },
                preConfirm: () => {
                    const textarea = document.getElementById('swal-catatan') as HTMLTextAreaElement;
                    const fileInput = document.getElementById('swal-file') as HTMLInputElement;
                    return {
                        text: textarea?.value || '',
                        file: fileInput?.files?.[0] || null
                    };
                }
            });
            if (isDismissed || !result) return;

            catatanInput = result.text;
            const file = result.file;

            if (file) {
                if (file.size > 25 * 1024 * 1024) {
                    swalError('File Terlalu Besar', 'Ukuran berkas maksimal adalah 25 MB.');
                    return;
                }
                setSavingEkskul(true);
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'pembayaran');

                try {
                    const uploadRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (!uploadData.ok) throw new Error(uploadData.error || 'Gagal mengupload file bukti');
                    buktiUrl = uploadData.publicUrl || uploadData.url || uploadData.file_url || '';
                } catch (e: any) {
                    swalError('Upload Gagal', e.message);
                    setSavingEkskul(false);
                    return;
                }
            }
        } else {
            const confirm = await swalConfirm({
                title: 'Batalkan Tanda Dibayar?',
                text: 'Status pembayaran akan dikembalikan ke Belum Dibayar.',
                icon: 'warning', confirmText: 'Ya, Batalkan', cancelText: 'Batal', confirmColor: '#dc2626',
            });
            if (!confirm.isConfirmed) return;
        }

        // Snapshot nominal dan waktu saat pembayaran disahkan
        const catatanFinal = dibayarkan
            ? JSON.stringify({
                text: catatanInput,
                url: buktiUrl,
                nominal: calculatedNominal,
                paid_at: new Date().toISOString()
            })
            : null;

        setSavingEkskul(true);
        try {
            const res = await authFetch('/api/ekskul/submission/pembayaran', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sub.id, dibayarkan, catatan: catatanFinal }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memproses');
            swalSuccess('Berhasil', dibayarkan ? 'Ditandai sudah dibayarkan.' : 'Tanda dibayar dibatalkan.');
            fetchEkskulSubmissions();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSavingEkskul(false); }
    };

    const filteredKlinikSlots = useMemo(() => {
        let list = klinikSlots;
        if (klinikFilterBayar === 'BELUM') list = list.filter(s => s.status !== 'paid');
        else if (klinikFilterBayar === 'SUDAH') list = list.filter(s => s.status === 'paid');
        if (klinikSearchQuery.trim()) {
            const q = klinikSearchQuery.toLowerCase();
            list = list.filter(s => 
                (s.nama_guru || '').toLowerCase().includes(q) || 
                (s.guru?.nip || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [klinikSlots, klinikFilterBayar, klinikSearchQuery]);

    const klinikStats = useMemo(() => ({
        total: klinikSlots.length,
        belum: klinikSlots.filter(s => s.status !== 'paid').length,
        sudah: klinikSlots.filter(s => s.status === 'paid').length,
    }), [klinikSlots]);

    const handleTandaiKlinik = async (slot: KlinikSlot) => {
        const nominal = getTarif('KLINIK');
        const confirm = await swalConfirm({
            title: 'Tandai Sudah Dibayar?',
            text: `Honor klinik ${slot.nama_guru} (${slot.mapel}) sebesar ${fmtRupiah(nominal)} akan ditandai sudah dibayarkan.`,
            icon: 'question', confirmText: 'Ya, Tandai', cancelText: 'Batal', confirmColor: '#16a34a',
        });
        if (!confirm.isConfirmed) return;
        setSavingKlinik(true);
        try {
            const res = await authFetch('/api/klinik', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_paid', id: slot.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memproses');
            swalSuccess('Berhasil', 'Ditandai sudah dibayarkan.');
            fetchKlinikSlots();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSavingKlinik(false); }
    };

    const handleBatalKlinik = async (slot: KlinikSlot) => {
        const confirm = await swalConfirm({
            title: 'Batalkan Status Dibayar?',
            text: `Honor klinik ${slot.nama_guru} (${slot.mapel}) akan dikembalikan ke Belum Dibayar.`,
            icon: 'warning', confirmText: 'Ya, Batalkan', cancelText: 'Batal', confirmColor: '#dc2626',
        });
        if (!confirm.isConfirmed) return;
        setSavingKlinik(true);
        try {
            const res = await authFetch('/api/klinik', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unmark_paid', id: slot.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal membatalkan status bayar');
            swalSuccess('Berhasil', 'Status pembayaran dibatalkan.');
            fetchKlinikSlots();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSavingKlinik(false); }
    };

    const filteredSubmissions = useMemo(() => {
        let list = submissions;
        if (filterBayar === 'BELUM') list = list.filter(s => !s.dibayarkan);
        else if (filterBayar === 'SUDAH') list = list.filter(s => s.dibayarkan);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s => 
                (s.nama_guru_snap || '').toLowerCase().includes(q) || 
                (s.nip || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [submissions, filterBayar, searchQuery]);

    const statsCount = useMemo(() => ({
        total: submissions.length,
        belum: submissions.filter(s => !s.dibayarkan).length,
        sudah: submissions.filter(s => s.dibayarkan).length,
    }), [submissions]);

    const rekapanData = useMemo(() => {
        const guruAsuhPaid = submissions.filter(s => s.dibayarkan && (rekapanBulan === 0 || s.bulan === rekapanBulan) && s.tahun === rekapanTahun);
        let totalGuruAsuh = 0;
        guruAsuhPaid.forEach(sub => {
            const cData = getCatatanData(sub.catatan_pembayaran);
            const nominal = cData.nominal !== null ? cData.nominal : getTarif('GURU_ASUH');
            totalGuruAsuh += parseNominal(nominal);
        });

        const klinikPaid = klinikSlots.filter(s => {
            if (s.status !== 'paid') return false;
            if (!s.tanggal) return false;
            const match = s.tanggal.match(/^(\d{4})-(\d{2})/);
            if (match) {
                const y = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                return (rekapanBulan === 0 || m === rekapanBulan) && y === rekapanTahun;
            }
            const d = new Date(s.tanggal);
            return (rekapanBulan === 0 || (d.getMonth() + 1) === rekapanBulan) && d.getFullYear() === rekapanTahun;
        });
        const totalKlinik = klinikPaid.length * parseNominal(getTarif('KLINIK'));

        const ekskulPaid = ekskulSubmissions.filter(s => s.dibayarkan && (rekapanBulan === 0 || s.bulan === rekapanBulan) && s.tahun === rekapanTahun);
        let totalEkskul = 0;
        ekskulPaid.forEach(sub => {
            const cData = getCatatanData(sub.catatan_pembayaran);
            const internalCount = Number(sub.jml_internal ?? sub.total_pertemuan ?? 0) || 0;
            const eksternalCount = Number(sub.jml_eksternal ?? 0) || 0;
            const fallbackNominal = internalCount * getTarif('EKSKUL_INTERNAL') + eksternalCount * getTarif('EKSKUL_EKSTERNAL');
            const nominal = cData.nominal !== null ? cData.nominal : fallbackNominal;
            totalEkskul += parseNominal(nominal);
        });

        return {
            guruAsuh: totalGuruAsuh,
            klinik: totalKlinik,
            ekskul: totalEkskul,
            total: totalGuruAsuh + totalKlinik + totalEkskul
        };
    }, [submissions, klinikSlots, ekskulSubmissions, rekapanBulan, rekapanTahun, getTarif]);

    const handleTandai = async (sub: Submission, dibayarkan: boolean) => {
        let catatanInput = '';
        let buktiUrl = '';
        
        const currentTarif = getTarif('GURU_ASUH');

        if (dibayarkan) {
            const { value: result, isDismissed } = await Swal.fire({
                title: 'Catatan Pembayaran Guru Asuh',
                html: `
                    <div style="text-align:left; padding:0 10px 15px; font-size:0.85rem; color:#475569;">
                        Penerima: <strong>${sub.nama_guru_snap || 'Guru'}</strong><br>
                        Nominal yang akan dibayarkan: <strong>${fmtRupiah(currentTarif)}</strong>
                    </div>
                    <div style="text-align: left; padding: 0 10px; margin-top: 5px;">
                        <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 5px;">Catatan (Opsional)</label>
                        <textarea id="swal-catatan" class="swal2-textarea" placeholder="Nomor bukti transfer, keterangan, dll..." style="margin: 0; width: 100%; box-sizing: border-box; min-height: 80px;"></textarea>
                    </div>
                    <div style="text-align: left; padding: 0 10px; margin-top: 15px;">
                        <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 5px;">Bukti Pembayaran (Opsional)</label>
                        <input type="file" id="swal-file" class="swal2-file" accept="image/*,.pdf" style="margin: 0; display: block; width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; font-size: 0.85rem;">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Tandai Dibayar',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#16a34a',
                cancelButtonColor: '#64748b',
                customClass: { confirmButton: 'whitespace-nowrap' },
                preConfirm: () => {
                    const textarea = document.getElementById('swal-catatan') as HTMLTextAreaElement;
                    const fileInput = document.getElementById('swal-file') as HTMLInputElement;
                    return {
                        text: textarea?.value || '',
                        file: fileInput?.files?.[0] || null
                    };
                }
            });
            if (isDismissed || !result) return;
            
            catatanInput = result.text;
            const file = result.file;
            
            if (file) {
                if (file.size > 25 * 1024 * 1024) {
                    swalError('File Terlalu Besar', 'Ukuran berkas maksimal adalah 25 MB.');
                    return;
                }
                setSaving(true);
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'pembayaran');
                
                try {
                    const uploadRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (!uploadData.ok) throw new Error(uploadData.error || 'Gagal mengupload file bukti');
                    buktiUrl = uploadData.publicUrl || uploadData.url || uploadData.file_url || '';
                } catch (e: any) {
                    swalError('Upload Gagal', e.message);
                    setSaving(false);
                    return;
                }
            }
        } else {
            const confirm = await swalConfirm({
                title: 'Batalkan Tanda Dibayar?',
                text: 'Status pembayaran akan dikembalikan ke Belum Dibayar.',
                icon: 'warning', confirmText: 'Ya, Batalkan', cancelText: 'Batal', confirmColor: '#dc2626',
            });
            if (!confirm.isConfirmed) return;
        }

        // Snapshot nominal dan waktu saat pembayaran disahkan
        const catatanFinal = dibayarkan
            ? JSON.stringify({
                text: catatanInput,
                url: buktiUrl,
                nominal: currentTarif,
                paid_at: new Date().toISOString()
            })
            : null;

        setSaving(true);
        try {
            const res = await authFetch('/api/guru-asuh/laporan-submission/pembayaran', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sub.id, dibayarkan, catatan: catatanFinal }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memproses');
            swalSuccess('Berhasil', dibayarkan ? 'Ditandai sudah dibayarkan.' : 'Tanda dibayar dibatalkan.');
            fetchSubmissions();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSaving(false); }
    };

    if (!user) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <Spinner variant="buble" />
            </div>
        );
    }

    if (!isBendahara) {
        return (
            <div className="gap-denied">
                <i className="bi bi-shield-lock" />
                <h3>Akses Ditolak</h3>
                <p>Halaman ini hanya untuk Bendahara Komite atau Admin.</p>
            </div>
        );
    }

    return (
        <div className="gap">
            <Tab
                tabs={TABS.map(t => ({ key: t.id, label: t.label, icon: t.icon }))}
                activeTab={activeTab}
                onChange={(key) => setActiveTab(key)}
                ariaLabel="Modul Pembayaran"
                variant="slider"
            />

            {activeTab === 'GURU_ASUH' && (
                <>
                    <div className="gap-stats">
                        <div className="gap-stat-item"><div className="gap-stat-val">{statsCount.total}</div><div className="gap-stat-lbl">Total</div></div>
                        <div className="gap-stat-item amber"><div className="gap-stat-val">{statsCount.belum}</div><div className="gap-stat-lbl">Belum Dibayar</div></div>
                        <div className="gap-stat-item green"><div className="gap-stat-val">{statsCount.sudah}</div><div className="gap-stat-lbl">Sudah Dibayar</div></div>
                    </div>

                    <FilterToolbar>
                        <FilterSelect
                            label="Status Pembayaran"
                            icon="funnel"
                            value={filterBayar}
                            onChange={(val) => setFilterBayar(val)}
                            options={[
                                { value: 'BELUM', label: 'Belum Dibayar' },
                                { value: 'SUDAH', label: 'Sudah Dibayar' },
                                { value: 'ALL', label: 'Semua Status' }
                            ]}
                        />
                        <FilterSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Cari nama atau NIP..."
                        />
                    </FilterToolbar>

                    <div className="gap-table-card">
                        <div className="gap-table-wrap">
                    <table className="gap-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Penerima</th>
                                <th>Periode</th>
                                <th>Jumlah Laporan</th>
                                <th>Nominal</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="gap-td-center" style={{ padding: '24px 0' }}>
                                        <Spinner variant="buble" />
                                    </td>
                                </tr>
                            )}
                            {!loading && filteredSubmissions.length === 0 && (
                                <tr><td colSpan={7} className="gap-td-center">Tidak ada laporan</td></tr>
                            )}
                                {filteredSubmissions.map((sub, i) => {
                                    const cData = getCatatanData(sub.catatan_pembayaran);
                                    const nominalTampil = sub.dibayarkan && cData.nominal !== null ? cData.nominal : getTarif('GURU_ASUH');
                                    return (
                                        <tr key={sub.id}>
                                            <td>{i + 1}</td>
                                            <td>
                                                <div className="gap-td-name">{sub.nama_guru_snap || 'Guru'}</div>
                                                <div className="gap-td-nip">NIP. {sub.nip}</div>
                                            </td>
                                            <td>{BULAN[sub.bulan - 1]} {sub.tahun}</td>
                                            <td>{sub.total_laporan} laporan</td>
                                            <td style={{ fontWeight: 700 }}>{fmtRupiah(nominalTampil)}</td>
                                            <td>
                                                <span className={`gap-badge gap-badge--${sub.dibayarkan ? 'sudah' : 'belum'}`}>
                                                    {sub.dibayarkan ? 'Dibayar' : 'Belum'}
                                                </span>
                                                {sub.dibayarkan && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                                        {cData.text && (
                                                            <div className="gap-td-note" title={cData.text}>
                                                                <i className="bi bi-chat-left-text" /> Catatan
                                                            </div>
                                                        )}
                                                        {isSafeHttpUrl(cData.url) && (
                                                            <a href={cData.url} target="_blank" rel="noreferrer noopener" className="gap-td-note" style={{ color: '#0ea5e9', textDecoration: 'none' }} title="Lihat Bukti Transfer">
                                                                <i className="bi bi-receipt" /> Bukti Pembayaran
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                        <div className="gap-actions-cell">
                                            {(sub.pdf_url || sub.id) && (
                                                <a
                                                    href={sub.pdf_url && isSafeHttpUrl(sub.pdf_url) ? sub.pdf_url : `/api/guru-asuh/laporan-submission/pdf?submissionId=${sub.id}`}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="gap-btn-icon gap-btn-icon--info"
                                                    title="Lihat PDF"
                                                >
                                                    <i className="bi bi-file-earmark-pdf" />
                                                </a>
                                            )}
                                            {sub.dibayarkan ? (
                                                <button onClick={() => handleTandai(sub, false)} className="gap-btn-icon gap-btn-icon--danger" title="Batal Dibayar" disabled={saving}>
                                                    <i className="bi bi-x-circle" />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleTandai(sub, true)} className="gap-btn-icon gap-btn-icon--success" title="Tandai Dibayar" disabled={saving}>
                                                    <i className="bi bi-check-circle" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
            )}

            {activeTab === 'KLINIK' && (
                <>
                    <div className="gap-stats">
                        <div className="gap-stat-item"><div className="gap-stat-val">{klinikStats.total}</div><div className="gap-stat-lbl">Total</div></div>
                        <div className="gap-stat-item amber"><div className="gap-stat-val">{klinikStats.belum}</div><div className="gap-stat-lbl">Belum Dibayar</div></div>
                        <div className="gap-stat-item green"><div className="gap-stat-val">{klinikStats.sudah}</div><div className="gap-stat-lbl">Sudah Dibayar</div></div>
                    </div>

                    <FilterToolbar>
                        <FilterSelect
                            label="Status Pembayaran"
                            icon="funnel"
                            value={klinikFilterBayar}
                            onChange={(val) => setKlinikFilterBayar(val)}
                            options={[
                                { value: 'BELUM', label: 'Belum Dibayar' },
                                { value: 'SUDAH', label: 'Sudah Dibayar' },
                                { value: 'ALL', label: 'Semua Status' }
                            ]}
                        />
                        <FilterSearch
                            value={klinikSearchQuery}
                            onChange={setKlinikSearchQuery}
                            placeholder="Cari nama atau NIP guru..."
                        />
                    </FilterToolbar>

                    <div className="gap-table-card">
                        <div className="gap-table-wrap">
                            <table className="gap-table">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Penerima</th>
                                        <th>Tanggal</th>
                                        <th>Kegiatan</th>
                                        <th>Nominal</th>
                                        <th>Status</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingKlinik && (
                                        <tr>
                                            <td colSpan={7} className="gap-td-center" style={{ padding: '24px 0' }}>
                                                <Spinner variant="buble" />
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingKlinik && filteredKlinikSlots.length === 0 && (
                                        <tr><td colSpan={7} className="gap-td-center">Tidak ada laporan klinik yang disetujui</td></tr>
                                    )}
                                    {filteredKlinikSlots.map((slot, i) => (
                                        <tr key={slot.id}>
                                            <td>{i + 1}</td>
                                            <td>
                                                <div className="gap-td-name">{slot.nama_guru}</div>
                                                <div className="gap-td-nip">NIP. {slot.guru?.nip || '-'}</div>
                                            </td>
                                            <td>{new Date(slot.tanggal).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</td>
                                            <td>{slot.mapel} — {slot.topik}</td>
                                            <td style={{ fontWeight: 700 }}>{fmtRupiah(getTarif('KLINIK'))}</td>
                                            <td>
                                                <span className={`gap-badge gap-badge--${slot.status === 'paid' ? 'sudah' : 'belum'}`}>
                                                    {slot.status === 'paid' ? 'Dibayar' : 'Belum'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="gap-actions-cell">
                                                    {slot.status === 'paid' ? (
                                                        <button onClick={() => handleBatalKlinik(slot)} className="gap-btn-icon gap-btn-icon--danger" title="Batalkan Tanda Dibayar" disabled={savingKlinik}>
                                                            <i className="bi bi-x-circle" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleTandaiKlinik(slot)} className="gap-btn-icon gap-btn-icon--success" title="Tandai Dibayar" disabled={savingKlinik}>
                                                            <i className="bi bi-check-circle" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'EKSKUL' && (
                <>
                    <div className="gap-stats">
                        <div className="gap-stat-item"><div className="gap-stat-val">{ekskulStats.total}</div><div className="gap-stat-lbl">Total</div></div>
                        <div className="gap-stat-item amber"><div className="gap-stat-val">{ekskulStats.belum}</div><div className="gap-stat-lbl">Belum Dibayar</div></div>
                        <div className="gap-stat-item green"><div className="gap-stat-val">{ekskulStats.sudah}</div><div className="gap-stat-lbl">Sudah Dibayar</div></div>
                    </div>

                    <FilterToolbar>
                        <FilterSelect
                            label="Status Pembayaran"
                            icon="funnel"
                            value={ekskulFilterBayar}
                            onChange={(val) => setEkskulFilterBayar(val)}
                            options={[
                                { value: 'BELUM', label: 'Belum Dibayar' },
                                { value: 'SUDAH', label: 'Sudah Dibayar' },
                                { value: 'ALL', label: 'Semua Status' }
                            ]}
                        />
                        <FilterSearch
                            value={ekskulSearchQuery}
                            onChange={setEkskulSearchQuery}
                            placeholder="Cari nama pembina, NIP, atau ekskul..."
                        />
                    </FilterToolbar>

                    <div className="gap-table-card">
                        <div className="gap-table-wrap">
                            <table className="gap-table">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Penerima</th>
                                        <th>Periode</th>
                                        <th>Ekstrakurikuler</th>
                                        <th>Pertemuan</th>
                                        <th>Nominal</th>
                                        <th>Status</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingEkskul && (
                                        <tr>
                                            <td colSpan={8} className="gap-td-center" style={{ padding: '24px 0' }}>
                                                <Spinner variant="buble" />
                                            </td>
                                        </tr>
                                    )}
                                    {!loadingEkskul && filteredEkskulSubmissions.length === 0 && (
                                        <tr><td colSpan={8} className="gap-td-center">Tidak ada laporan ekstrakurikuler yang disahkan</td></tr>
                                    )}
                                    {filteredEkskulSubmissions.map((sub, i) => {
                                        const cData = getCatatanData(sub.catatan_pembayaran);
                                        const internalCount = Number(sub.jml_internal ?? sub.total_pertemuan ?? 0) || 0;
                                        const eksternalCount = Number(sub.jml_eksternal ?? 0) || 0;
                                        const calculatedRate = internalCount * getTarif('EKSKUL_INTERNAL') + eksternalCount * getTarif('EKSKUL_EKSTERNAL');
                                        const nominalTampil = sub.dibayarkan && cData.nominal !== null ? cData.nominal : calculatedRate;

                                        return (
                                            <tr key={sub.id}>
                                                <td>{i + 1}</td>
                                                <td>
                                                    <div className="gap-td-name">{sub.pembina_nama || 'Pembina'}</div>
                                                    <div className="gap-td-nip">NIP. {sub.pembina_nip}</div>
                                                </td>
                                                <td>{BULAN[sub.bulan - 1]} {sub.tahun}</td>
                                                <td>{sub.ekskul?.nama_ekskul || '-'}</td>
                                                <td>
                                                    {sub.total_pertemuan} kali
                                                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                                        <span style={{ backgroundColor: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Internal: {internalCount}</span>
                                                        <span style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Eksternal: {eksternalCount}</span>
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>
                                                    {fmtRupiah(nominalTampil)}
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--n-muted)', marginTop: '2px' }}>
                                                        {internalCount}×{fmtRupiah(getTarif('EKSKUL_INTERNAL'))} + {eksternalCount}×{fmtRupiah(getTarif('EKSKUL_EKSTERNAL'))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`gap-badge gap-badge--${sub.dibayarkan ? 'sudah' : 'belum'}`}>
                                                        {sub.dibayarkan ? 'Dibayar' : 'Belum'}
                                                    </span>
                                                    {sub.dibayarkan && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                                            {cData.text && (
                                                                <div className="gap-td-note" title={cData.text}>
                                                                    <i className="bi bi-chat-left-text" /> Catatan
                                                                </div>
                                                            )}
                                                            {isSafeHttpUrl(cData.url) && (
                                                                <a href={cData.url} target="_blank" rel="noreferrer noopener" className="gap-td-note" style={{ color: '#0ea5e9', textDecoration: 'none' }} title="Lihat Bukti Transfer">
                                                                    <i className="bi bi-receipt" /> Bukti Pembayaran
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="gap-actions-cell">
                                                        {sub.pdf_url && isSafeHttpUrl(sub.pdf_url) && (
                                                            <a href={sub.pdf_url} target="_blank" rel="noreferrer noopener" className="gap-btn-icon gap-btn-icon--info" title="Lihat PDF Laporan">
                                                                <i className="bi bi-file-earmark-pdf" />
                                                            </a>
                                                        )}
                                                        {sub.dibayarkan ? (
                                                            <button onClick={() => handleTandaiEkskul(sub, false)} className="gap-btn-icon gap-btn-icon--danger" title="Batal Dibayar" disabled={savingEkskul}>
                                                                <i className="bi bi-x-circle" />
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleTandaiEkskul(sub, true)} className="gap-btn-icon gap-btn-icon--success" title="Tandai Dibayar" disabled={savingEkskul}>
                                                                <i className="bi bi-check-circle" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'NOMINAL' && (
                <div className="gap-table-card">
                    <div className="gap-toolbar">
                        <div style={{ fontSize: '0.85rem', color: 'var(--n-muted)' }}>
                            <i className="bi bi-info-circle" /> Atur tarif honor per kegiatan. Guru Asuh dihitung per bulan; Klinik dan Ekstrakurikuler dihitung per pertemuan.
                        </div>
                    </div>
                    <div className="gap-table-wrap">
                        <table className="gap-table">
                            <thead>
                                <tr>
                                    <th>Kegiatan</th>
                                    <th>Satuan</th>
                                    <th>Nominal</th>
                                    <th>Terakhir Diubah</th>
                                    <th style={{ width: '110px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingTarif && (
                                    <tr>
                                        <td colSpan={5} className="gap-td-center" style={{ padding: '24px 0' }}>
                                            <Spinner variant="buble" />
                                        </td>
                                    </tr>
                                )}
                                {!loadingTarif && tarifList.length === 0 && (
                                    <tr><td colSpan={5} className="gap-td-center">Tarif belum tersedia. Jalankan migrasi tarif_honor terlebih dahulu.</td></tr>
                                )}
                                {tarifList.map(t => (
                                    <tr key={t.modul}>
                                        <td className="gap-td-name">{t.label}</td>
                                        <td>
                                            <span className={`gap-badge ${t.satuan === 'per_bulan' ? 'gap-badge--per-bulan' : 'gap-badge--per-pertemuan'}`}>
                                                {t.satuan === 'per_bulan' ? 'Per Bulan' : 'Per Pertemuan'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ color: 'var(--n-muted)' }}>Rp</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="gap-select"
                                                    style={{ minWidth: '140px', width: '160px', fontWeight: 700 }}
                                                    value={tarifDraft[t.modul] ?? String(parseNominal(t.nominal))}
                                                    onChange={e => setTarifDraft(prev => ({ ...prev, [t.modul]: e.target.value }))}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>
                                            {t.updated_at ? new Date(t.updated_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                                            {t.updated_by_name && <div>oleh {t.updated_by_name}</div>}
                                        </td>
                                        <td>
                                            <button
                                                className="gap-btn-icon gap-btn-icon--success"
                                                style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', fontWeight: 700 }}
                                                onClick={() => handleUpdateTarif(t.modul)}
                                                disabled={savingTarifModul === t.modul || String(parseNominal(t.nominal)) === (tarifDraft[t.modul] ?? String(parseNominal(t.nominal)))}
                                            >
                                                {savingTarifModul === t.modul ? 'Menyimpan...' : 'Simpan'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'REKAPAN' && (
                <div className="gap-table-card">
                    <div className="gap-toolbar" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select className="gap-select" value={rekapanBulan} onChange={e => setRekapanBulan(Number(e.target.value))}>
                            <option value={0}>Semua Bulan</option>
                            {BULAN.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
                        </select>
                        <input 
                            type="number" 
                            className="gap-select" 
                            style={{ width: '100px' }} 
                            value={rekapanTahun} 
                            onChange={e => setRekapanTahun(Number(e.target.value))} 
                        />
                    </div>
                    <div className="gap-table-wrap">
                        <table className="gap-table">
                            <thead>
                                <tr>
                                    <th>Kategori Pembayaran</th>
                                    <th style={{ textAlign: 'right' }}>Total Terbayar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(loading || loadingKlinik || loadingEkskul) ? (
                                    <tr>
                                        <td colSpan={2} className="gap-td-center" style={{ padding: '24px 0' }}>
                                            <Spinner variant="buble" />
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        <tr>
                                            <td><i className="bi bi-heart-pulse" style={{ marginRight: '8px', color: '#ec4899' }} />Klinik Pembelajaran</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtRupiah(rekapanData.klinik)}</td>
                                        </tr>
                                        <tr>
                                            <td><i className="bi bi-person-plus" style={{ marginRight: '8px', color: '#8b5cf6' }} />Ekstrakurikuler</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtRupiah(rekapanData.ekskul)}</td>
                                        </tr>
                                        <tr>
                                            <td><i className="bi bi-person-heart" style={{ marginRight: '8px', color: '#3b82f6' }} />Guru Asuh</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtRupiah(rekapanData.guruAsuh)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{ fontWeight: 800, fontSize: '1.1rem', padding: '16px' }}>Total Keseluruhan</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.1rem', color: '#60a5fa', padding: '16px' }}>
                                        {fmtRupiah(rekapanData.total)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            <MaintenanceBanner pageKey="pembayaran" />
        </div>
    );
}
