'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { matchesPaymentPeriod, paymentDatePeriod } from '@/lib/payment-period';
import { swalSuccess, swalError, swalConfirm } from '@/lib/swal-premium';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Spinner } from '@/components/ui/Spinner';
import { Tab } from '@/components/ui/Tab';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { DesktopFab } from '@/components/ui/DesktopFab';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';
import DocViewerModal from '@/components/ui/DocViewerModal';
import { MobileList, MobileListItem, MobileSheet, MobileKV, MobileSection } from '@/components/mobile';
import { useIsMobile } from '@/hooks/use-breakpoint';
import BulkPaymentModal from './BulkPaymentModal';
import CommitteeTab from './CommitteeTab';
import PrintPaymentModal from './PrintPaymentModal';
import {
    BULAN, fmtRupiah, fmtTanggal, StatCards, StatusBadge, PayeeCell, EmptyState, MarkPaidModal,
    type PayTarget,
} from './parts';
import './payment.css';

/* ----------------------------------- Tipe ----------------------------------- */

interface Submission {
    id: string; nip: string; nama_guru_snap: string | null; bulan: number; tahun: number;
    total_laporan: number; status: string; dibayarkan: boolean; dibayarkan_at: string | null;
    catatan_pembayaran: string | null; pdf_url: string | null;
}

interface KlinikSlot {
    id: string; guru_id: string; nama_guru: string; mapel: string; topik: string; tanggal: string;
    status: string; nominal_dibayarkan?: number | string | null; catatan_pembayaran?: string | null;
    klinik_laporan?: any; guru?: { nip?: string | null; nama?: string | null } | null;
}

interface EkskulSubmission {
    id: string; ekskul_id: string; pembina_nip: string; pembina_nama: string; bulan: number; tahun: number;
    total_pertemuan: number; jml_internal?: number; jml_eksternal?: number; status: string;
    dibayarkan: boolean; dibayarkan_at: string | null; catatan_pembayaran: string | null;
    pdf_url: string | null; ekskul?: { nama_ekskul: string };
}

interface TarifHonor {
    modul: string; label: string; satuan: string; nominal: number | string;
    updated_at?: string | null; updated_by_name?: string | null;
}

type TabKey = 'KLINIK' | 'GURU_ASUH' | 'EKSKUL' | 'KOMITE' | 'REKAPAN' | 'NOMINAL';
type RoutineKind = 'KLINIK' | 'GURU_ASUH' | 'EKSKUL';
const ROUTINE: TabKey[] = ['KLINIK', 'GURU_ASUH', 'EKSKUL'];

/** Satu baris tagihan, sama bentuknya untuk ketiga tab pembayaran rutin. */
interface PayRow {
    key: string;
    name: string;
    nip?: string | null;
    period: string;
    detail: ReactNode;
    detailText: string;
    /** null = pembayaran lama yang nominalnya tidak tersimpan. */
    amount: number | null;
    amountNote?: ReactNode;
    paid: boolean;
    note?: string;
    proofs: { url: string; title: string }[];
    onDoc?: () => void;
    docLabel?: string;
    onPay?: () => void;
    onCancel?: () => void;
    onEditProof?: () => void;
    /** Klinik: sesi-sesi di bawah satu penerima. */
    sessions?: KlinikSlot[];
}

/* --------------------------------- Helper ----------------------------------- */

function parseNominal(val: any): number {
    if (val == null) return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return 0;
        const cleaned = trimmed.replace(/\s+/g, '').replace(/^rp/i, '');
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
        const normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof val === 'object') {
        const v: any = val;
        if (typeof v.toNumber === 'function') {
            const n = v.toNumber();
            return Number.isFinite(n) ? n : 0;
        }
        if (Array.isArray(v.d) && typeof v.e === 'number' && typeof v.s === 'number') {
            const digits = v.d.map((part: number, idx: number) => idx === 0 ? String(part) : String(part).padStart(7, '0')).join('');
            const n = Number(`${v.s < 0 ? '-' : ''}${digits}`) * Math.pow(10, v.e - digits.length + 1);
            return Number.isFinite(n) ? n : 0;
        }
        if (typeof v.toString === 'function') {
            const s = v.toString();
            if (s && s !== '[object Object]') return parseNominal(s);
        }
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
}

function getKlinikLaporan(slot: KlinikSlot): any {
    const laporan = slot.klinik_laporan;
    return Array.isArray(laporan) ? laporan[0] : laporan;
}

function isSafeHttpUrl(url: string | null | undefined): url is string {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/** Tautan bukti dari catatan: URL http(s) atau path internal `/api/...`. */
function isProofUrl(url: string | null | undefined): url is string {
    return isSafeHttpUrl(url) || (!!url && /^\/(?![\/\\])/.test(url));
}

interface CatatanData { text: string; url: string; nominal: number | null; paid_at: string | null }

const getCatatanData = (raw: string | null | undefined): CatatanData => {
    if (!raw) return { text: '', url: '', nominal: null, paid_at: null };
    try {
        const parsed = JSON.parse(raw);
        const nominal = typeof parsed.nominal === 'number' || (typeof parsed.nominal === 'string' && /^\d+(?:\.0+)?$/.test(parsed.nominal.trim())) ? Number(parsed.nominal) : null;
        return {
            text: parsed.text || '',
            url: parsed.url || '',
            nominal: Number.isSafeInteger(nominal) && nominal! >= 0 ? nominal : null,
            paid_at: parsed.paid_at || null,
        };
    } catch {
        return { text: raw, url: '', nominal: null, paid_at: null };
    }
};

async function sendJson(url: string, method: string, body: any) {
    const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || data.message || 'Gagal memproses');
    return data;
}

const sumAmounts = (rows: PayRow[]) => rows.reduce((s, r) => s + (r.amount ?? 0), 0);

/* ---------------------------------- Halaman --------------------------------- */

interface PembayaranPageProps {
    user?: any;
    komiteOnly?: boolean;
}

const TABS: { key: TabKey; label: string; shortLabel?: string; icon: string }[] = [
    { key: 'KLINIK', label: 'Klinik Pembelajaran', shortLabel: 'Klinik', icon: 'heart-pulse' },
    { key: 'GURU_ASUH', label: 'Guru Asuh', icon: 'person-heart' },
    { key: 'EKSKUL', label: 'Ekstrakurikuler', shortLabel: 'Ekskul', icon: 'person-plus' },
    { key: 'KOMITE', label: 'Pengajuan Komite', shortLabel: 'Komite', icon: 'clipboard-data-fill' },
    { key: 'REKAPAN', label: 'Rekapan', icon: 'journal-check' },
    { key: 'NOMINAL', label: 'Nominal', icon: 'cash-stack' },
];

export default function PembayaranPage({ user: propUser, komiteOnly = false }: PembayaranPageProps = {}) {
    const isMobile = useIsMobile();
    const [user, setUser] = useState<any>(propUser || null);
    const [activeTab, setActiveTab] = useState<TabKey>(komiteOnly ? 'KOMITE' : 'GURU_ASUH');

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(false);
    const [klinikSlots, setKlinikSlots] = useState<KlinikSlot[]>([]);
    const [loadingKlinik, setLoadingKlinik] = useState(false);
    const [klinikEvidence, setKlinikEvidence] = useState<Record<string, string>>({});
    const [ekskulSubmissions, setEkskulSubmissions] = useState<EkskulSubmission[]>([]);
    const [loadingEkskul, setLoadingEkskul] = useState(false);
    const [tarifList, setTarifList] = useState<TarifHonor[]>([]);
    const [loadingTarif, setLoadingTarif] = useState(false);
    const [savingTarifModul, setSavingTarifModul] = useState<string | null>(null);
    const [tarifDraft, setTarifDraft] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    // Filter per tab rutin, supaya berpindah tab tidak saling menimpa.
    const [statusFilter, setStatusFilter] = useState<Record<RoutineKind, string>>({ KLINIK: 'ALL', GURU_ASUH: 'ALL', EKSKUL: 'ALL' });
    const [searchQuery, setSearchQuery] = useState<Record<RoutineKind, string>>({ KLINIK: '', GURU_ASUH: '', EKSKUL: '' });
    const [periodMonth, setPeriodMonth] = useState(0);
    const [periodYear, setPeriodYear] = useState(0);

    const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
    const [sheetKey, setSheetKey] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [bulkOpen, setBulkOpen] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [printUrl, setPrintUrl] = useState('');
    useEffect(() => () => { if (printUrl) URL.revokeObjectURL(printUrl); }, [printUrl]);
    const [docPreview, setDocPreview] = useState<{ title: string; html?: string; fileUrl?: string } | null>(null);

    /* ------------------------------- Akses -------------------------------- */

    const userRoles = useMemo(() => {
        if (!user) return [];
        const list = Array.isArray(user.roles) ? [...user.roles] : [user.role || ''];
        return list.filter(Boolean).map((r: string) => r.toString().toUpperCase());
    }, [user]);
    const isAdmin = useMemo(() => userRoles.some((r: string) => r.includes('ADMIN')), [userRoles]);
    const isBendahara = useMemo(() => isAdmin || userRoles.includes('BENDAHARA_KOMITE'), [isAdmin, userRoles]);
    // Sama dengan isTreasurer di backend (payments/payment-access.ts).
    const canBulkUpload = useMemo(() => userRoles.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'BENDAHARA_KOMITE'].includes(r)), [userRoles]);
    const hasAccess = useMemo(() => {
        if (isBendahara) return true;
        if (user?.pagesArray?.includes('pembayaran')) return true;
        return userRoles.some((r: string) => ['KAMAD', 'KTU', 'SUPERVISOR', 'PENGAWAS_MADRASAH'].includes(r));
    }, [isBendahara, user, userRoles]);

    useEffect(() => {
        if (propUser) { setUser(propUser); return; }
        (async () => {
            try {
                const meRes = await fetch('/api/auth/me');
                const meData = await meRes.json();
                if (meData.ok && meData.user) setUser(meData.user);
            } catch (err) {
                console.error('Error init user in pembayaran:', err);
            }
        })();
    }, [propUser]);

    /* -------------------------------- Data -------------------------------- */

    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/guru-asuh/laporan-submission?status=Approved&includePaid=true');
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
                (data.data || []).forEach((t: TarifHonor) => { draft[t.modul] = String(parseNominal(t.nominal)); });
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
                // Sesi yang laporannya sudah Approved atau sudah dibayar.
                setKlinikSlots((data.data || []).filter((s: KlinikSlot) => s.status === 'paid' || getKlinikLaporan(s)?.status === 'Approved'));
            }
        } catch (e) { console.error(e); }
        finally { setLoadingKlinik(false); }
    }, []);

    // Tautan bukti upload massal untuk sesi Klinik, hanya untuk periode yang sedang ditampilkan.
    const fetchKlinikEvidence = useCallback(async () => {
        try {
            const params = new URLSearchParams({ action: 'evidence', month: String(periodMonth), year: String(periodYear) });
            const res = await authFetch('/api/pembayaran-massal?' + params.toString());
            if (res.ok) { const evidence = await res.json(); setKlinikEvidence(evidence.data || {}); }
        } catch (e) { console.error(e); }
    }, [periodMonth, periodYear]);

    const fetchEkskulSubmissions = useCallback(async () => {
        setLoadingEkskul(true);
        try {
            const res = await authFetch('/api/ekskul/submission?status=Disahkan&includePaid=true');
            const data = await res.json();
            if (data.ok) setEkskulSubmissions(data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoadingEkskul(false); }
    }, []);

    useEffect(() => {
        if (hasAccess && !komiteOnly) { fetchSubmissions(); fetchTarif(); }
    }, [hasAccess, komiteOnly, fetchSubmissions, fetchTarif]);

    useEffect(() => {
        if (hasAccess && !komiteOnly && (activeTab === 'KLINIK' || activeTab === 'REKAPAN')) fetchKlinikSlots();
    }, [hasAccess, komiteOnly, activeTab, fetchKlinikSlots]);

    useEffect(() => {
        if (hasAccess && !komiteOnly && activeTab === 'KLINIK') fetchKlinikEvidence();
    }, [hasAccess, komiteOnly, activeTab, fetchKlinikEvidence]);

    useEffect(() => {
        if (hasAccess && !komiteOnly && (activeTab === 'EKSKUL' || activeTab === 'REKAPAN')) fetchEkskulSubmissions();
    }, [hasAccess, komiteOnly, activeTab, fetchEkskulSubmissions]);

    // Detail mobile ditutup saat tab berganti supaya tidak menampilkan baris tab lain.
    useEffect(() => { setSheetKey(null); }, [activeTab]);

    const getTarif = useCallback((modul: string) => {
        const found = tarifList.find(t => t.modul === modul);
        return found ? parseNominal(found.nominal) : 0;
    }, [tarifList]);

    /* ----------------------------- Periode -------------------------------- */

    const periodSubmissions = useMemo(() => submissions.filter(s => matchesPaymentPeriod(s, periodMonth, periodYear)), [submissions, periodMonth, periodYear]);
    const periodKlinikSlots = useMemo(() => klinikSlots.filter(s => matchesPaymentPeriod(paymentDatePeriod(s.tanggal, true), periodMonth, periodYear)), [klinikSlots, periodMonth, periodYear]);
    const periodEkskulSubmissions = useMemo(() => ekskulSubmissions.filter(s => matchesPaymentPeriod(s, periodMonth, periodYear)), [ekskulSubmissions, periodMonth, periodYear]);
    const periodYears = useMemo(() => {
        const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Makassar' }).format(new Date()));
        const years = new Set([currentYear, currentYear - 1]);
        [...submissions, ...ekskulSubmissions].forEach(s => { if (s.tahun) years.add(Number(s.tahun)); });
        klinikSlots.forEach(s => { const period = paymentDatePeriod(s.tanggal, true); if (period) years.add(period.tahun); });
        if (periodYear) years.add(periodYear);
        return [...years].sort((a, b) => b - a);
    }, [submissions, ekskulSubmissions, klinikSlots, periodYear]);

    /* --------------------------- Aksi pembayaran --------------------------- */

    const viewFile = (url: string, title = 'Bukti Pembayaran') => setDocPreview({ title, fileUrl: url });

    const viewGuruAsuhDoc = async (sub: Submission) => {
        try {
            Swal.fire({ title: 'Memuat Kegiatan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await fetch('/api/guru-asuh/laporan-submission/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: sub.id }),
            });
            const json = await res.json();
            Swal.close();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat pratinjau dokumen');
            setDocPreview({
                title: `Kegiatan Guru Asuh - ${sub.nama_guru_snap || 'Guru'} (${BULAN[sub.bulan - 1] || sub.bulan} ${sub.tahun})`,
                html: json.html,
            });
        } catch (e: any) {
            Swal.close();
            swalError('Gagal Membuka Dokumen', e.message);
        }
    };

    /** Konfirmasi lalu jalankan pembatalan status dibayar. */
    const confirmCancel = async (text: string, run: () => Promise<void>) => {
        const confirm = await swalConfirm({
            title: 'Batalkan Status Dibayar?',
            text,
            icon: 'warning', confirmText: 'Ya, Batalkan', cancelText: 'Batal', confirmColor: '#dc2626',
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            await run();
            swalSuccess('Berhasil', 'Status pembayaran dikembalikan ke Belum Dibayar.');
        } catch (e: any) { swalError('Gagal', e.message); }
        finally { setBusy(false); }
    };

    const payGuruAsuh = (sub: Submission) => {
        const nominal = getTarif('GURU_ASUH');
        setPayTarget({
            recipient: sub.nama_guru_snap || 'Guru',
            detail: `Guru Asuh · ${BULAN[sub.bulan - 1]} ${sub.tahun} · ${sub.total_laporan} kegiatan`,
            amount: nominal,
            submit: async ({ text, url }) => {
                // Nominal disnapshot saat pembayaran disahkan; server menolak bila tarif sudah berubah.
                const catatan = JSON.stringify({ text, url, nominal, paid_at: new Date().toISOString() });
                await sendJson('/api/guru-asuh/laporan-submission/pembayaran', 'POST', { id: sub.id, dibayarkan: true, catatan });
                swalSuccess('Berhasil', 'Ditandai sudah dibayarkan.');
                fetchSubmissions();
            },
        });
    };

    const ekskulCounts = (sub: EkskulSubmission) => {
        const internal = Number(sub.jml_internal ?? sub.total_pertemuan ?? 0) || 0;
        const eksternal = Number(sub.jml_eksternal ?? 0) || 0;
        return { internal, eksternal, nominal: internal * getTarif('EKSKUL_INTERNAL') + eksternal * getTarif('EKSKUL_EKSTERNAL') };
    };

    const payEkskul = (sub: EkskulSubmission) => {
        const { internal, eksternal, nominal } = ekskulCounts(sub);
        setPayTarget({
            recipient: sub.pembina_nama || 'Pembina',
            detail: `${sub.ekskul?.nama_ekskul || 'Ekstrakurikuler'} · ${BULAN[sub.bulan - 1]} ${sub.tahun}`,
            amount: nominal,
            amountNote: `Internal ${internal} × ${fmtRupiah(getTarif('EKSKUL_INTERNAL'))} + Eksternal ${eksternal} × ${fmtRupiah(getTarif('EKSKUL_EKSTERNAL'))}`,
            submit: async ({ text, url }) => {
                const catatan = JSON.stringify({ text, url, nominal, paid_at: new Date().toISOString() });
                await sendJson('/api/ekskul/submission/pembayaran', 'POST', { id: sub.id, dibayarkan: true, catatan });
                swalSuccess('Berhasil', 'Ditandai sudah dibayarkan.');
                fetchEkskulSubmissions();
            },
        });
    };

    const payKlinik = (slots: KlinikSlot[]) => {
        const nominal = getTarif('KLINIK');
        const first = slots[0];
        setPayTarget({
            recipient: first.nama_guru || first.guru?.nama || 'Guru',
            detail: `Klinik Pembelajaran · ${slots.length} kegiatan dibayar dalam satu transfer`,
            amount: nominal * slots.length,
            amountNote: `${slots.length} × ${fmtRupiah(nominal)}`,
            submit: async ({ text, url }) => {
                await sendJson('/api/klinik', 'PATCH', {
                    action: 'mark_paid_batch',
                    ids: slots.map(s => s.id),
                    expectedTotal: nominal * slots.length,
                    catatan: JSON.stringify({ text, url }),
                });
                swalSuccess('Berhasil', 'Ditandai sudah dibayarkan.');
                fetchKlinikSlots();
            },
        });
    };

    const editRoutineProof = (kind: RoutineKind, row: { id: string; catatan_pembayaran?: string | null }, recipient: string, amount: number | null, detail: string, fallbackUrl = '') => {
        const note = getCatatanData(row.catatan_pembayaran || null);
        setSheetKey(null);
        setPayTarget({ recipient, detail, amount, editProof: true, initialNote: { text: note.text, url: note.url || fallbackUrl },
            submit: async ({ text, url }) => {
                await sendJson('/api/payments/proof', 'POST', { kind, id: row.id, expectedNote: row.catatan_pembayaran ?? null, text, url });
                if (kind === 'KLINIK') await fetchKlinikSlots();
                else if (kind === 'GURU_ASUH') await fetchSubmissions();
                else await fetchEkskulSubmissions();
                swalSuccess('Berhasil', 'Bukti pembayaran diperbarui.');
            },
        });
    };

    const editKlinikProof = (slot: KlinikSlot) => editRoutineProof('KLINIK', slot, slot.nama_guru || 'Guru', slot.nominal_dibayarkan == null ? null : parseNominal(slot.nominal_dibayarkan), `Klinik · ${slot.mapel} · ${fmtTanggal(slot.tanggal)}`, klinikEvidence[slot.id] ? `/api/pembayaran-massal/bukti?id=${klinikEvidence[slot.id]}` : '');

    const cancelGuruAsuh = (sub: Submission) => confirmCancel(
        `Pembayaran Guru Asuh ${sub.nama_guru_snap || ''} akan dikembalikan ke Belum Dibayar.`,
        async () => { await sendJson('/api/guru-asuh/laporan-submission/pembayaran', 'POST', { id: sub.id, dibayarkan: false, catatan: null }); fetchSubmissions(); },
    );

    const cancelEkskul = (sub: EkskulSubmission) => confirmCancel(
        `Pembayaran ekstrakurikuler ${sub.ekskul?.nama_ekskul || ''} akan dikembalikan ke Belum Dibayar.`,
        async () => { await sendJson('/api/ekskul/submission/pembayaran', 'POST', { id: sub.id, dibayarkan: false, catatan: null }); fetchEkskulSubmissions(); },
    );

    const cancelKlinik = (slot: KlinikSlot) => confirmCancel(
        `Honor klinik ${slot.nama_guru} (${slot.mapel}, ${fmtTanggal(slot.tanggal)}) akan dikembalikan ke Belum Dibayar.`,
        async () => { await sendJson('/api/klinik', 'PATCH', { action: 'unmark_paid', id: slot.id }); fetchKlinikSlots(); },
    );

    const handleUpdateTarif = async (modul: string) => {
        const nominal = Number(tarifDraft[modul] ?? '0');
        if (isNaN(nominal) || nominal < 0) { swalError('Error', 'Nominal harus berupa angka >= 0'); return; }
        setSavingTarifModul(modul);
        try {
            await sendJson('/api/tarif-honor', 'PUT', { modul, nominal });
            swalSuccess('Berhasil', 'Tarif honor diperbarui.');
            fetchTarif();
        } catch (e: any) { swalError('Error', e.message); }
        finally { setSavingTarifModul(null); }
    };

    /* ---------------------------- Baris per tab ---------------------------- */

    const klinikProofs = (slot: KlinikSlot) => {
        const proofs: string[] = [];
        const url = getCatatanData(slot.catatan_pembayaran).url;
        if (isProofUrl(url)) proofs.push(url);
        else if (klinikEvidence[slot.id]) proofs.push(`/api/pembayaran-massal/bukti?id=${klinikEvidence[slot.id]}`);
        return proofs;
    };

    const guruAsuhRows = useMemo<PayRow[]>(() => periodSubmissions.map(sub => {
        const c = getCatatanData(sub.catatan_pembayaran);
        const name = sub.nama_guru_snap || 'Guru';
        return {
            key: sub.id,
            name,
            nip: sub.nip,
            period: `${BULAN[sub.bulan - 1]} ${sub.tahun}`,
            detail: `${sub.total_laporan} kegiatan`,
            detailText: `${sub.total_laporan} kegiatan`,
            amount: sub.dibayarkan ? c.nominal : getTarif('GURU_ASUH'),
            paid: !!sub.dibayarkan,
            note: sub.dibayarkan ? c.text : '',
            proofs: sub.dibayarkan && isProofUrl(c.url) ? [{ url: c.url, title: `Bukti Pembayaran - ${name}` }] : [],
            onDoc: () => viewGuruAsuhDoc(sub),
            docLabel: 'Lihat Kegiatan',
            onPay: () => payGuruAsuh(sub),
            onCancel: () => cancelGuruAsuh(sub),
            onEditProof: () => editRoutineProof('GURU_ASUH', sub, name, c.nominal, `Guru Asuh · ${BULAN[sub.bulan - 1]} ${sub.tahun}`),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [periodSubmissions, getTarif]);

    const ekskulRows = useMemo<PayRow[]>(() => periodEkskulSubmissions.map(sub => {
        const c = getCatatanData(sub.catatan_pembayaran);
        const { internal, eksternal, nominal } = ekskulCounts(sub);
        const name = sub.pembina_nama || 'Pembina';
        const ekskulName = sub.ekskul?.nama_ekskul || 'Ekstrakurikuler';
        return {
            key: sub.id,
            name,
            nip: sub.pembina_nip,
            period: `${BULAN[sub.bulan - 1]} ${sub.tahun}`,
            detail: (
                <div className="pay-cell-stack">
                    <span className="pay-cell-strong">{ekskulName}</span>
                    <span className="pay-chips">
                        <span className="pay-chip pay-chip--blue">Internal {internal}</span>
                        <span className="pay-chip pay-chip--violet">Eksternal {eksternal}</span>
                    </span>
                </div>
            ),
            detailText: `${ekskulName} · ${sub.total_pertemuan} pertemuan`,
            amount: sub.dibayarkan ? c.nominal : nominal,
            amountNote: sub.dibayarkan ? undefined : `${internal}×${fmtRupiah(getTarif('EKSKUL_INTERNAL'))} + ${eksternal}×${fmtRupiah(getTarif('EKSKUL_EKSTERNAL'))}`,
            paid: !!sub.dibayarkan,
            note: sub.dibayarkan ? c.text : '',
            proofs: sub.dibayarkan && isProofUrl(c.url) ? [{ url: c.url, title: `Bukti Pembayaran - ${name}` }] : [],
            onDoc: sub.pdf_url && isSafeHttpUrl(sub.pdf_url) ? () => viewFile(sub.pdf_url!, `Laporan Ekskul - ${ekskulName}`) : undefined,
            docLabel: 'Lihat PDF Laporan',
            onPay: () => payEkskul(sub),
            onCancel: () => cancelEkskul(sub),
            onEditProof: () => editRoutineProof('EKSKUL', sub, name, c.nominal, `${ekskulName} · ${BULAN[sub.bulan - 1]} ${sub.tahun}`),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [periodEkskulSubmissions, getTarif]);

    // Klinik dikelompokkan per penerima: sesi yang belum dibayar ditransfer sekaligus.
    const klinikRows = useMemo<PayRow[]>(() => {
        const groups = new Map<string, KlinikSlot[]>();
        periodKlinikSlots.forEach(slot => {
            const key = `${slot.guru_id}:${slot.status === 'paid' ? 'paid' : 'unpaid'}`;
            groups.set(key, [...(groups.get(key) || []), slot]);
        });
        return [...groups.entries()].map(([key, slots]) => {
            const sessions = [...slots].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
            const first = sessions[0];
            const paid = first.status === 'paid';
            const name = (first.nama_guru || first.guru?.nama || 'Guru').trim().replace(/\s+/g, ' ');
            const missing = paid && sessions.some(s => s.nominal_dibayarkan == null);
            const amount = missing ? null : sessions.reduce((sum, s) => sum + (paid ? parseNominal(s.nominal_dibayarkan) : getTarif('KLINIK')), 0);
            const proofUrls = [...new Set(sessions.flatMap(klinikProofs))];
            const notes = [...new Set(sessions.map(s => getCatatanData(s.catatan_pembayaran).text).filter(Boolean))];
            const dates = sessions.length === 1
                ? fmtTanggal(first.tanggal)
                : `${fmtTanggal(first.tanggal, { day: 'numeric', month: 'short' })} – ${fmtTanggal(sessions[sessions.length - 1].tanggal)}`;
            return {
                key,
                name,
                nip: first.guru?.nip,
                period: dates,
                detail: `${sessions.length} kegiatan`,
                detailText: `${sessions.length} kegiatan`,
                amount,
                amountNote: !paid && sessions.length > 1 ? `${sessions.length} × ${fmtRupiah(getTarif('KLINIK'))}` : undefined,
                paid,
                note: notes.join(' · '),
                proofs: proofUrls.map((url, i) => ({ url, title: `Bukti Pembayaran - ${name}${proofUrls.length > 1 ? ` (${i + 1})` : ''}` })),
                onPay: () => payKlinik(sessions),
                onEditProof: sessions.length === 1 ? () => editKlinikProof(first) : undefined,
                sessions,
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodKlinikSlots, getTarif, klinikEvidence]);

    const routineRows: Record<RoutineKind, PayRow[]> = { KLINIK: klinikRows, GURU_ASUH: guruAsuhRows, EKSKUL: ekskulRows };
    const routineLoading: Record<RoutineKind, boolean> = { KLINIK: loadingKlinik, GURU_ASUH: loading, EKSKUL: loadingEkskul };

    const visibleRows = useMemo(() => {
        if (!ROUTINE.includes(activeTab)) return [];
        const kind = activeTab as RoutineKind;
        const status = statusFilter[kind];
        const q = searchQuery[kind].trim().toLowerCase();
        return routineRows[kind]
            .filter(r => status === 'ALL' || (status === 'SUDAH' ? r.paid : !r.paid))
            .filter(r => !q || `${r.name} ${r.nip || ''} ${r.detailText}`.toLowerCase().includes(q))
            .sort((a, b) => Number(a.paid) - Number(b.paid) || a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, statusFilter, searchQuery, klinikRows, guruAsuhRows, ekskulRows]);

    /* ------------------------------ Rekapan ------------------------------- */

    const rekapan = useMemo(() => {
        const guruAsuhPaid = periodSubmissions.filter(s => s.dibayarkan);
        const klinikPaid = periodKlinikSlots.filter(s => s.status === 'paid');
        const ekskulPaid = periodEkskulSubmissions.filter(s => s.dibayarkan);
        const noteSum = (list: { catatan_pembayaran: string | null }[]) => list.reduce((s, x) => s + parseNominal(getCatatanData(x.catatan_pembayaran).nominal), 0);
        const guruAsuh = noteSum(guruAsuhPaid);
        const ekskul = noteSum(ekskulPaid);
        const klinik = klinikPaid.reduce((sum, slot) => sum + parseNominal(slot.nominal_dibayarkan), 0);
        const missing = klinikPaid.filter(s => s.nominal_dibayarkan == null).length
            + guruAsuhPaid.filter(s => getCatatanData(s.catatan_pembayaran).nominal === null).length
            + ekskulPaid.filter(s => getCatatanData(s.catatan_pembayaran).nominal === null).length;
        return {
            categories: [
                { key: 'KLINIK', label: 'Klinik Pembelajaran', icon: 'heart-pulse', tone: 'rose', count: klinikPaid.length, unit: 'kegiatan', total: klinik },
                { key: 'EKSKUL', label: 'Ekstrakurikuler', icon: 'person-plus', tone: 'violet', count: ekskulPaid.length, unit: 'laporan', total: ekskul },
                { key: 'GURU_ASUH', label: 'Guru Asuh', icon: 'person-heart', tone: 'blue', count: guruAsuhPaid.length, unit: 'kegiatan', total: guruAsuh },
            ],
            total: guruAsuh + klinik + ekskul,
            missing,
        };
    }, [periodSubmissions, periodKlinikSlots, periodEkskulSubmissions]);

    /* ------------------------------- Render ------------------------------- */

    if (!user) {
        return <div className="pay-loading"><Spinner variant="buble" /></div>;
    }

    if (!hasAccess && !komiteOnly) {
        return (
            <div className="pay">
                <EmptyState icon="shield-lock" title="Akses Ditolak">
                    Halaman ini hanya untuk Bendahara Komite, Pimpinan, atau Pengguna yang diberikan akses.
                </EmptyState>
            </div>
        );
    }

    const periodLabel = `${periodMonth ? BULAN[periodMonth - 1] : 'Semua bulan'}${periodYear ? ` ${periodYear}` : periodMonth ? ' · semua tahun' : ''}`;

    const periodFilters = (
        <>
            <FilterSelect
                label="Bulan"
                icon="calendar3"
                value={periodMonth === 0 ? 'ALL' : String(periodMonth)}
                onChange={value => setPeriodMonth(value === 'ALL' ? 0 : Number(value))}
                options={[{ value: 'ALL', label: 'Semua Bulan' }, ...BULAN.map((label, i) => ({ value: String(i + 1), label }))]}
            />
            <FilterSelect
                label="Tahun"
                icon="calendar-event"
                value={periodYear === 0 ? 'ALL' : String(periodYear)}
                onChange={value => setPeriodYear(value === 'ALL' ? 0 : Number(value))}
                options={[{ value: 'ALL', label: 'Semua Tahun' }, ...periodYears.map(year => ({ value: String(year), label: String(year) }))]}
            />
        </>
    );

    const isRoutine = ROUTINE.includes(activeTab);
    const kind = activeTab as RoutineKind;
    const allRows = isRoutine ? routineRows[kind] : [];
    const unpaidRows = allRows.filter(r => !r.paid);
    const paidRows = allRows.filter(r => r.paid);
    const countOf = (rows: PayRow[]) => kind === 'KLINIK' ? rows.reduce((n, r) => n + (r.sessions?.length || 0), 0) : rows.length;
    const unit = kind === 'EKSKUL' ? 'laporan' : 'kegiatan';
    const totalCount = countOf(allRows);
    const paidCount = countOf(paidRows);
    const sheetRow = sheetKey ? visibleRows.find(r => r.key === sheetKey) || null : null;

    const amountCell = (row: PayRow) => (
        <div className="pay-cell-stack">
            <span className="pay-amount">{row.amount === null ? 'Nominal belum tercatat' : fmtRupiah(row.amount)}</span>
            {row.amountNote && <span className="pay-cell-muted">{row.amountNote}</span>}
        </div>
    );

    const proofLinks = (row: PayRow) => (row.proofs.length > 0 || row.note) ? (
        <span className="pay-proofs">
            {row.proofs.map(p => (
                <button key={p.url} type="button" className="pay-link" onClick={() => viewFile(p.url, p.title)}>
                    <i className="bi bi-receipt" /> Bukti
                </button>
            ))}
            {row.note && <span className="pay-note" title={row.note}><i className="bi bi-chat-left-text" /> Catatan</span>}
        </span>
    ) : null;

    const rowActions = (row: PayRow) => (
        <ActionGroup>
            {row.onDoc && <ActionButton action="file" tooltip={row.docLabel} onClick={row.onDoc} />}
            {isBendahara && !row.paid && row.onPay && (
                <ActionButton action="approve" tooltip="Tandai Dibayar" disabled={busy} onClick={row.onPay} />
            )}
            {isBendahara && row.paid && row.onEditProof && <ActionButton action={row.proofs.length ? 'edit' : 'file'} tooltip={row.proofs.length ? 'Edit bukti' : 'Unggah bukti'} onClick={row.onEditProof} />}
            {isBendahara && row.paid && (row.sessions?.length || 0) > 1 && <ActionButton action="file" tooltip="Kelola bukti setiap sesi" onClick={() => setExpanded(old => ({ ...old, [row.key]: !old[row.key] }))} />}
            {isBendahara && row.paid && row.onCancel && (
                <ActionButton action="reject" tooltip="Batalkan Pembayaran" disabled={busy} onClick={row.onCancel} />
            )}
        </ActionGroup>
    );

    const sessionList = (row: PayRow) => (
        <ul className="pay-sessions">
            {row.sessions!.map(slot => {
                const proofs = klinikProofs(slot);
                return (
                    <li key={slot.id}>
                        <span className="pay-sessions__date">{fmtTanggal(slot.tanggal, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="pay-sessions__topic"><strong>{slot.mapel}</strong> — {slot.topik}</span>
                        <span className="pay-sessions__amount">
                            {slot.status === 'paid'
                                ? slot.nominal_dibayarkan == null ? 'Nominal belum tercatat' : fmtRupiah(slot.nominal_dibayarkan)
                                : fmtRupiah(getTarif('KLINIK'))}
                        </span>
                        <span className="pay-sessions__actions">
                            {proofs.map(url => (
                                <button key={url} type="button" className="pay-link" onClick={() => viewFile(url, `Bukti Pembayaran - ${slot.nama_guru}`)}>
                                    <i className="bi bi-receipt" /> Bukti
                                </button>
                            ))}
                            {isBendahara && slot.status === 'paid' && (
                                <>
                                <ActionButton action={proofs.length ? 'edit' : 'file'} size="sm" tooltip={proofs.length ? 'Edit bukti' : 'Unggah bukti'} onClick={() => editKlinikProof(slot)} />
                                <ActionButton action="reject" size="sm" tooltip="Batalkan pembayaran sesi ini" disabled={busy} onClick={() => cancelKlinik(slot)} />
                                </>
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );

    const emptyRoutine = {
        KLINIK: 'Belum ada laporan klinik yang disetujui pada periode ini.',
        GURU_ASUH: 'Belum ada kegiatan Guru Asuh yang disahkan pada periode ini.',
        EKSKUL: 'Belum ada laporan ekstrakurikuler yang disahkan pada periode ini.',
    } as const;

    return (
        <div className="pay">
            <Tab
                tabs={TABS.filter(t => !komiteOnly || t.key === 'KOMITE').map(t => ({ key: t.key, label: t.label, shortLabel: t.shortLabel, icon: t.icon }))}
                activeTab={activeTab}
                onChange={key => setActiveTab(key)}
                ariaLabel="Modul Pembayaran"
                variant="slider"
            />

            {/* Upload Bukti Massal hanya untuk tagihan rutin. Di mobile tombol
                ini otomatis pindah ke tombol tengah BottomNav. */}
            {!komiteOnly && canBulkUpload && isRoutine && (
                <DesktopFab
                    label="Upload Bukti Massal"
                    mobileLabel="Upload Bukti"
                    icon="cloud-arrow-up"
                    onClick={() => setBulkOpen(true)}
                />
            )}

            {activeTab === 'KOMITE' && <CommitteeTab />}

            {isRoutine && (
                <>
                    <StatCards
                        items={[
                            { label: 'Perlu Dibayar', icon: 'hourglass-split', tone: 'amber', value: `${countOf(unpaidRows)} ${unit}`, sub: fmtRupiah(sumAmounts(unpaidRows)) },
                            {
                                label: 'Sudah Dibayar', icon: 'check2-circle', tone: 'green', value: `${paidCount} ${unit}`, sub: fmtRupiah(sumAmounts(paidRows)),
                                progress: totalCount ? (paidCount / totalCount) * 100 : 0,
                            },
                            { label: 'Total Tagihan', icon: 'wallet2', tone: 'blue', value: `${totalCount} ${unit}`, sub: periodLabel },
                        ]}
                    />

                    <FilterToolbar>
                        {periodFilters}
                        <FilterSelect
                            label="Status"
                            icon="funnel"
                            value={statusFilter[kind]}
                            onChange={val => setStatusFilter(old => ({ ...old, [kind]: val || 'ALL' }))}
                            options={[
                                { value: 'ALL', label: 'Semua Status' },
                                { value: 'BELUM', label: 'Belum Dibayar' },
                                { value: 'SUDAH', label: 'Sudah Dibayar' },
                            ]}
                        />
                        <FilterSearch
                            value={searchQuery[kind]}
                            onChange={val => setSearchQuery(old => ({ ...old, [kind]: val }))}
                            placeholder={kind === 'EKSKUL' ? 'Cari pembina, NIP, atau ekskul...' : 'Cari nama atau NIP...'}
                        />
                    </FilterToolbar>

                    {routineLoading[kind] && !allRows.length ? (
                        <div className="pay-loading"><Spinner variant="buble" /></div>
                    ) : visibleRows.length === 0 ? (
                        <div className="pay-card">
                            <EmptyState icon="inbox" title="Tidak ada tagihan">
                                {allRows.length ? 'Tidak ada data yang cocok dengan filter.' : emptyRoutine[kind]}
                            </EmptyState>
                        </div>
                    ) : isMobile ? (
                        <MobileList label="Daftar tagihan">
                            {visibleRows.map(row => (
                                <MobileListItem
                                    key={row.key}
                                    title={row.name}
                                    seed={row.name}
                                    subtitle={`${row.amount === null ? 'Nominal belum tercatat' : fmtRupiah(row.amount)} · ${row.period}`}
                                    badge={<StatusBadge tone={row.paid ? 'paid' : 'unpaid'}>{row.paid ? 'Dibayar' : 'Belum'}</StatusBadge>}
                                    onClick={() => setSheetKey(row.key)}
                                />
                            ))}
                        </MobileList>
                    ) : (
                        <div className="pay-card">
                            <div className="pay-table-wrap">
                                <table className="pay-table">
                                    <thead>
                                        <tr>
                                            <th className="pay-col-no">No</th>
                                            <th>Penerima</th>
                                            <th>{kind === 'KLINIK' ? 'Tanggal' : 'Periode'}</th>
                                            <th>{kind === 'EKSKUL' ? 'Ekstrakurikuler' : 'Kegiatan'}</th>
                                            <th>Nominal</th>
                                            <th>Status</th>
                                            <th className="pay-col-action">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleRows.map((row, i) => (
                                            <FragmentRow key={row.key}>
                                                <tr className={row.paid ? 'is-paid' : ''}>
                                                    <td className="pay-col-no">{i + 1}</td>
                                                    <td><PayeeCell name={row.name} sub={row.nip ? `NIP. ${row.nip}` : undefined} /></td>
                                                    <td className="pay-nowrap">{row.period}</td>
                                                    <td>
                                                        {row.sessions ? (
                                                            <button
                                                                type="button"
                                                                className="pay-toggle"
                                                                aria-expanded={!!expanded[row.key]}
                                                                onClick={() => setExpanded(old => ({ ...old, [row.key]: !old[row.key] }))}
                                                            >
                                                                {row.detail}
                                                                <i className={`bi bi-chevron-${expanded[row.key] ? 'up' : 'down'}`} aria-hidden="true" />
                                                            </button>
                                                        ) : row.detail}
                                                    </td>
                                                    <td>{amountCell(row)}</td>
                                                    <td>
                                                        <div className="pay-cell-stack">
                                                            <StatusBadge tone={row.paid ? 'paid' : 'unpaid'}>{row.paid ? 'Dibayar' : 'Belum Dibayar'}</StatusBadge>
                                                            {proofLinks(row)}
                                                        </div>
                                                    </td>
                                                    <td className="pay-col-action">{rowActions(row)}</td>
                                                </tr>
                                                {row.sessions && expanded[row.key] && (
                                                    <tr className="pay-subrow">
                                                        <td />
                                                        <td colSpan={6}>{sessionList(row)}</td>
                                                    </tr>
                                                )}
                                            </FragmentRow>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'NOMINAL' && (
                <div className="pay-card">
                    <div className="pay-card__head">
                        <div>
                            <h3>Tarif Honor</h3>
                            <p>Guru Asuh dihitung per bulan; Klinik dan Ekstrakurikuler per pertemuan. Perubahan berlaku untuk pembayaran berikutnya.</p>
                        </div>
                    </div>
                    {loadingTarif && !tarifList.length ? (
                        <div className="pay-loading"><Spinner variant="buble" /></div>
                    ) : tarifList.length === 0 ? (
                        <EmptyState icon="cash-stack" title="Belum ada tarif" />
                    ) : (
                        <div className="pay-rates">
                            {tarifList.map(t => {
                                const current = String(parseNominal(t.nominal));
                                const draft = tarifDraft[t.modul] ?? current;
                                const dirty = draft !== current;
                                return (
                                    <div key={t.modul} className={`pay-rate ${dirty ? 'is-dirty' : ''}`}>
                                        <div className="pay-rate__info">
                                            <span className="pay-rate__name">{t.label}</span>
                                            <span className="pay-rate__meta">
                                                <span className={`pay-chip ${t.satuan === 'per_bulan' ? 'pay-chip--blue' : 'pay-chip--violet'}`}>
                                                    {t.satuan === 'per_bulan' ? 'Per Bulan' : 'Per Pertemuan'}
                                                </span>
                                                <span>Diubah {fmtTanggal(t.updated_at)}{t.updated_by_name ? ` oleh ${t.updated_by_name}` : ''}</span>
                                            </span>
                                        </div>
                                        <div className="pay-rate__edit">
                                            <label className="pay-money">
                                                <span>Rp</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    inputMode="numeric"
                                                    aria-label={`Nominal ${t.label}`}
                                                    disabled={!isBendahara}
                                                    value={draft}
                                                    onChange={e => setTarifDraft(prev => ({ ...prev, [t.modul]: e.target.value }))}
                                                />
                                            </label>
                                            {isBendahara && (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    isLoading={savingTarifModul === t.modul}
                                                    disabled={!dirty || savingTarifModul === t.modul}
                                                    onClick={() => handleUpdateTarif(t.modul)}
                                                >
                                                    Simpan
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'REKAPAN' && (
                <>
                    <FilterToolbar alwaysExpanded>{periodFilters}</FilterToolbar>
                    <div className="pay-card pay-recap">
                        <div className="pay-recap__hero">
                            <div>
                                <span className="pay-recap__label">Total Terbayar · {periodLabel}</span>
                                <strong className="pay-recap__total">
                                    {(loading || loadingKlinik || loadingEkskul) ? <Spinner variant="buble" size={22} /> : fmtRupiah(rekapan.total)}
                                </strong>
                                <span className="pay-recap__hint">Pembayaran rutin: Klinik, Ekstrakurikuler, dan Guru Asuh. Pengajuan Komite dicatat terpisah.</span>
                            </div>
                            <Button variant="outline" icon="print" onClick={() => setPrintOpen(true)}>Cetak Rekapan</Button>
                        </div>
                        {rekapan.missing > 0 && (
                            <div className="pay-alert pay-alert--warning" role="status">
                                <i className="bi bi-exclamation-triangle" />
                                {rekapan.missing} pembayaran lama belum memiliki nominal tersimpan dan belum termasuk dalam total.
                            </div>
                        )}
                        <div className="pay-recap__list">
                            {rekapan.categories.map(c => {
                                const share = rekapan.total ? Math.round((c.total / rekapan.total) * 100) : 0;
                                return (
                                    <div key={c.key} className={`pay-recap__row pay-tone--${c.tone}`}>
                                        <span className="pay-recap__icon" aria-hidden="true"><i className={`bi bi-${c.icon}`} /></span>
                                        <div className="pay-recap__info">
                                            <span className="pay-recap__name">{c.label}</span>
                                            <span className="pay-cell-muted">{c.count} {c.unit} dibayar · {share}%</span>
                                            <span className="pay-recap__bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                                        </div>
                                        <strong className="pay-recap__amount">{fmtRupiah(c.total)}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Detail tagihan (mobile) */}
            {isMobile && sheetRow && (
                <MobileSheet
                    title={sheetRow.name}
                    subtitle={sheetRow.nip ? `NIP. ${sheetRow.nip}` : undefined}
                    onClose={() => setSheetKey(null)}
                    labelledBy="pay-sheet-title"
                    footer={(
                        <>
                            {sheetRow.onDoc && <Button variant="outline" leftIcon={<i className="bi bi-file-earmark-text" />} onClick={sheetRow.onDoc}>{kind === 'GURU_ASUH' ? 'Kegiatan' : 'Laporan'}</Button>}
                            {isBendahara && !sheetRow.paid && sheetRow.onPay && (
                                <Button variant="primary" leftIcon={<i className="bi bi-check2-circle" />} disabled={busy} onClick={() => { setSheetKey(null); sheetRow.onPay!(); }}>Tandai Dibayar</Button>
                            )}
                            {isBendahara && sheetRow.paid && sheetRow.onEditProof && <ActionButton action={sheetRow.proofs.length ? 'edit' : 'file'} tooltip={sheetRow.proofs.length ? 'Edit bukti' : 'Unggah bukti'} onClick={sheetRow.onEditProof} />}
                            {isBendahara && sheetRow.paid && sheetRow.onCancel && (
                                <Button variant="danger" leftIcon={<i className="bi bi-x-circle" />} disabled={busy} onClick={() => { setSheetKey(null); sheetRow.onCancel!(); }}>Batalkan</Button>
                            )}
                        </>
                    )}
                >
                    <MobileKV label="Status"><StatusBadge tone={sheetRow.paid ? 'paid' : 'unpaid'}>{sheetRow.paid ? 'Dibayar' : 'Belum Dibayar'}</StatusBadge></MobileKV>
                    <MobileKV label={kind === 'KLINIK' ? 'Tanggal' : 'Periode'}>{sheetRow.period}</MobileKV>
                    <MobileKV label="Rincian">{sheetRow.detail}</MobileKV>
                    <MobileKV label="Nominal">{amountCell(sheetRow)}</MobileKV>
                    {sheetRow.note && <MobileKV label="Catatan">{sheetRow.note}</MobileKV>}
                    {sheetRow.proofs.length > 0 && (
                        <MobileKV label="Bukti">
                            <span className="pay-proofs">
                                {sheetRow.proofs.map(p => (
                                    <button key={p.url} type="button" className="pay-link" onClick={() => viewFile(p.url, p.title)}>
                                        <i className="bi bi-receipt" /> Lihat bukti
                                    </button>
                                ))}
                            </span>
                        </MobileKV>
                    )}
                    {sheetRow.sessions && (
                        <>
                            <MobileSection>Rincian Kegiatan</MobileSection>
                            {sessionList(sheetRow)}
                        </>
                    )}
                </MobileSheet>
            )}

            {payTarget && <MarkPaidModal target={payTarget} onClose={() => setPayTarget(null)} />}

            {bulkOpen && (
                <BulkPaymentModal
                    initialKind={isRoutine ? activeTab : 'GURU_ASUH'}
                    initialMonth={periodMonth}
                    initialYear={periodYear}
                    onClose={() => setBulkOpen(false)}
                    onApplied={() => { void fetchSubmissions(); void fetchKlinikSlots(); void fetchKlinikEvidence(); void fetchEkskulSubmissions(); }}
                />
            )}
            {printOpen && <PrintPaymentModal initialMonth={periodMonth} initialYear={periodYear} onClose={() => setPrintOpen(false)} onReady={setPrintUrl} />}
            {printUrl && <DocViewerModal fileUrl={printUrl} fileType="pdf" title="Rekapan Pembayaran Bulanan" onClose={() => setPrintUrl('')} />}

            {docPreview?.html && <HtmlPreviewModal html={docPreview.html} title={docPreview.title} onClose={() => setDocPreview(null)} />}
            {docPreview?.fileUrl && <DocViewerModal fileUrl={docPreview.fileUrl} title={docPreview.title} onClose={() => setDocPreview(null)} />}

            <MaintenanceBanner pageKey="pembayaran" />
        </div>
    );
}

/** Pembungkus tanpa elemen untuk baris utama + baris rincian dalam satu map. */
function FragmentRow({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
