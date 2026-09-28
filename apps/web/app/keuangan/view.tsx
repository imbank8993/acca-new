'use client';
import { useTabParam } from '@/hooks/useTabParam';
import { useState, useEffect, Fragment } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import Swal from 'sweetalert2';
import type { User } from '@/lib/types';
import Tab, { TabItem } from '@/components/ui/Tab';
import FilterToolbar, { FilterSearch } from '@/components/ui/FilterToolbar';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalDetailGrid, ModalDetailField } from '@/components/ui/Modal';
import { useFileViewer } from '@/components/useFileViewer';
import './keuangan.css';
import KeuanganTabPengaturan from './tabs/KeuanganTabPengaturan';
import KeuanganTabPengajuan from './tabs/KeuanganTabPengajuan';
import KeuanganTabAntrean from './tabs/KeuanganTabAntrean';
import KeuanganTabPencairan from './tabs/KeuanganTabPencairan';
import KeuanganTabPagu from './tabs/KeuanganTabPagu';
import KeuanganTabMonitoring from './tabs/KeuanganTabMonitoring';

export default function KeuanganPage({ user: propUser }: { user?: User }) {
    const [user, setUser] = useState<any>(propUser || null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    const allTabs = ['pengajuan', 'antrean', 'pencairan', 'pagu', 'monitoring', 'pengaturan'] as const;
    type TabType = typeof allTabs[number];
    const [activeTab, setActiveTab] = useTabParam<TabType>('pengajuan', [...allTabs]);

    const [roles, setRoles] = useState<string[]>([]);
    const [myOfficerRoles, setMyOfficerRoles] = useState<string[]>([]);
    const [myDivisionIds, setMyDivisionIds] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const isAdmin = roles.includes('ADMIN');
    const isPureAdmin = isAdmin && myOfficerRoles.length === 0;
    const canSeeAllBudget = isPureAdmin || myOfficerRoles.includes('BENDAHARA') || myOfficerRoles.includes('KTU') || myOfficerRoles.includes('PPK');
    const canManageBudget = isPureAdmin || myOfficerRoles.includes('BENDAHARA') || myOfficerRoles.includes('KTU');

    // Format Rupiah
    const fmtRp = (v: any): string => {
        if (v === null || v === undefined) return '🔒 Dirahasiakan';
        return `Rp ${Number(v).toLocaleString('id-ID')}`;
    };

    // Map status ke class badge
    const stBadge = (status: string): string => {
        if (!status) return 'status-draft';
        if (status === 'Menunggu KTU') return 'st-menunggu-ktu';
        if (status === 'Menunggu Divisi') return 'st-menunggu-divisi';
        if (status === 'Menunggu PPK') return 'st-menunggu-ppk';
        if (status === 'Antrean Pencairan') return 'st-antrean';
        if (status === 'Dicairkan Sebagian') return 'st-dicairkan-sebagian';
        if (status === 'Pending Pencairan') return 'st-pending';
        if (status === 'Menunggu Konfirmasi PJ') return 'st-konfirmasi-pj';
        if (status === 'Menunggu Laporan PJ' || status === 'Menunggu Laporan') return 'st-menunggu-laporan';
        if (status === 'Proses Laporan') return 'st-proses-laporan';
        if (status === 'Revisi PJ') return 'st-revisi';
        if (status === 'Ditolak') return 'st-ditolak';
        if (status === 'Lunas/Selesai' || status === 'Dicairkan Sepenuhnya') return 'st-selesai';
        if (status === 'Arsip Selesai') return 'st-arsip';
        return 'status-wait';
    };

    const isTuName = (name?: string): boolean => {
        const n = (name || '').trim().toUpperCase();
        return n === 'TU' || n.includes('TATA USAHA');
    };
    const isTuDivisionId = (id: string): boolean => isTuName(divisions.find((d: any) => d.id === id)?.name);

    const getProgressStages = (r: any) => {
        const isTu = isTuName(r.divisions?.name);
        const logs = r.approval_logs || [];
        const logAt = (role: string, action?: string) => {
            const l = logs.find((x: any) => x.role === role && (!action || x.action === action));
            return l?.created_at || null;
        };
        const disbs = r.disbursements || [];
        const firstDisbAt = disbs.length ? [...disbs].map((d: any) => d.disbursed_at).filter(Boolean).sort()[0] : null;
        const confirmAt = logAt('Pemohon (PJ)', 'Diterima');
        const reportAt = (logs.filter((x: any) => (x.notes || '').toLowerCase().includes('laporan')).map((x: any) => x.created_at).sort()[0]) || null;

        const stages: any[] = [{ key: 'ajukan', label: 'Diajukan', icon: 'bi-send-fill', at: r.created_at }];
        stages.push({ key: 'ktu', label: 'Verifikasi KTU', icon: 'bi-clipboard-check', at: logAt('KTU', 'Approved') });
        if (!isTu) stages.push({ key: 'divisi', label: 'Verifikasi Kepala Divisi', icon: 'bi-person-badge', at: logAt('Kepala Divisi', 'Approved') });
        stages.push({ key: 'ppk', label: 'Verifikasi PPK', icon: 'bi-clipboard2-check', at: logAt('PPK', 'Approved') });
        stages.push({ key: 'cair', label: 'Pencairan oleh Bendahara', icon: 'bi-cash-coin', at: firstDisbAt });
        stages.push({ key: 'terima', label: 'Dana Diterima PJ', icon: 'bi-hand-thumbs-up', at: confirmAt });
        stages.push({ key: 'lapor', label: 'Pelaporan', icon: 'bi-journal-text', at: reportAt });
        stages.push({ key: 'selesai', label: 'Selesai / Arsip', icon: 'bi-check2-circle', at: null });

        const order = stages.map(s => s.key);
        const statusToKey: Record<string, string> = {
            'Menunggu Divisi': 'divisi', 'Menunggu KTU': 'ktu', 'Menunggu PPK': 'ppk',
            'Antrean Pencairan': 'cair', 'Pending Pencairan': 'cair',
            'Menunggu Konfirmasi PJ': 'terima', 'Dicairkan Sebagian': 'terima',
            'Menunggu Laporan PJ': 'lapor', 'Proses Laporan': 'lapor',
            'Arsip Selesai': 'selesai', 'Selesai': 'selesai', 'Lunas/Selesai': 'selesai',
        };
        const terminal = ['Arsip Selesai', 'Selesai', 'Lunas/Selesai'].includes(r.status);
        const currentIdx = order.indexOf(statusToKey[r.status] ?? 'ajukan');
        const canDetail = !r.nominal_masked;
        stages.forEach((s, i) => {
            s.state = terminal ? 'done' : (i < currentIdx ? 'done' : (i === currentIdx ? 'current' : 'pending'));
            if (canDetail && s.state === 'done' && ['divisi', 'ktu', 'ppk'].includes(s.key) && !s.at) {
                s.state = 'skipped';
            }
        });
        return { stages, isRevisi: r.status === 'Revisi PJ' };
    };

    const pendingOf = (r: any): number =>
        (r.disbursements || [])
            .filter((d: any) => d.status === 'Menunggu Konfirmasi')
            .reduce((s: number, d: any) => s + parseFloat(d.amount || 0), 0);

    const canApproveStage = (req: any): boolean => {
        if (isPureAdmin) return false;
        if (req.status === 'Menunggu Divisi') return myOfficerRoles.includes('KEPALA DIVISI') && myDivisionIds.includes(req.division_id);
        if (req.status === 'Menunggu KTU') return myOfficerRoles.includes('KTU');
        if (req.status === 'Menunggu PPK') return myOfficerRoles.includes('PPK');
        return false;
    };

    const canManageRegisters = (req: any): boolean => {
        if (isPureAdmin) return false;
        return myOfficerRoles.includes('KEPALA DIVISI') && myDivisionIds.includes(req.division_id);
    };

    // Data States
    const [officers, setOfficers] = useState<any[]>([]);
    const [divisions, setDivisions] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [budgets, setBudgets] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [mutations, setMutations] = useState<any[]>([]);

    // Form States
    const [officerForm, setOfficerForm] = useState({ role_type: 'Kepala Divisi', user_id: '', division_id: '' });
    const [budgetForm, setBudgetForm] = useState<any>({ division_id: '', period: new Date().getFullYear().toString(), category: 'Bahan', total_budget: 0 });
    const [mutationForm, setMutationForm] = useState<any>({ type: 'Penyesuaian' as 'Penyesuaian' | 'Transfer', division_id: '', to_division_id: '', direction: 'add' as 'add' | 'subtract', category: 'Bahan', amount: 0, reason: '' });
    const [savingMutation, setSavingMutation] = useState(false);
    const [selectedBudgetYear, setSelectedBudgetYear] = useState(new Date().getFullYear().toString());
    
    const [requestForm, setRequestForm] = useState({
        id: null as string | null,
        division_id: '', activity_name: '', description: '',
        route: 'normal' as 'normal' | 'bendahara',
        proof_file_url: '',
        items: [{ item_name: '', category: 'Bahan', quantity: 1, unit: 'Pcs', unit_price: 0 }]
    });
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);

    // Import / Export Modal States
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);

    useEffect(() => {
        if (!propUser) fetchUser();
        else initRoles(propUser);
    }, [propUser]);

    useEffect(() => {
        if (!loading) {
            if (activeTab === 'pengaturan') { fetchOfficers(); fetchDivisions(); fetchUsersList(); }
            if (activeTab === 'pagu') { fetchBudgets(); fetchDivisions(); fetchMutations(); }
            if (activeTab === 'pencairan') { fetchRequests('bendahara'); fetchBudgets(); }
            if (activeTab === 'antrean') { fetchDivisions(); fetchRequests('semua'); }
            if (activeTab === 'monitoring') fetchRequests('bendahara');
            if (activeTab === 'pengajuan') { fetchDivisions(); fetchRequests('pj'); }
        }
    }, [activeTab, loading]);

    async function fetchUser() {
        const userData = await getCurrentUser();
        if (userData) {
            setUser(userData);
            initRoles(userData);
        }
    }

    async function initRoles(userData: any) {
        if (!userData) return;
        const userRoles = (userData.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
        if (Array.isArray(userData.roles)) userData.roles.forEach((r: string) => userRoles.push(r.toUpperCase()));
        setRoles(userRoles);
        
        try {
            const res = await fetch('/api/keuangan?action=get_my_roles');
            const json = await res.json();
            if (json.ok && json.data) {
                const offRoles = (json.data.officerRoles || []).map((r: string) => r.toUpperCase());
                setMyOfficerRoles(offRoles);
                setMyDivisionIds(json.data.divisionIds || []);
                if (offRoles.includes('BENDAHARA')) setActiveTab('pencairan');
                else if (offRoles.includes('KTU') || offRoles.includes('PPK') || offRoles.includes('KEPALA DIVISI')) setActiveTab('antrean');
                else if (userRoles.includes('ADMIN')) setActiveTab('pengaturan');
                else setActiveTab('pengajuan');
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    // --- FETCHERS ---
    async function fetchOfficers() {
        const res = await fetch('/api/keuangan?action=get_officers');
        const json = await res.json();
        if (json.ok) setOfficers(json.data);
    }
    async function fetchDivisions() {
        const res = await fetch('/api/keuangan?action=get_divisions');
        const json = await res.json();
        if (json.ok) setDivisions(json.data);
    }
    async function fetchUsersList() {
        const res = await fetch('/api/keuangan?action=get_users');
        const json = await res.json();
        if (json.ok) setUsersList(json.data);
    }
    async function fetchBudgets() {
        const res = await fetch('/api/keuangan?action=get_budgets');
        const json = await res.json();
        if (json.ok) setBudgets(json.data);
    }
    async function fetchMutations() {
        const res = await fetch('/api/keuangan?action=get_mutations');
        const json = await res.json();
        if (json.ok) setMutations(json.data);
    }
    async function fetchRequests(roleContext: string) {
        const res = await fetch(`/api/keuangan?action=get_requests&role_context=${roleContext}&user_id=${user?.id}`);
        const json = await res.json();
        if (json.ok) setRequests(json.data);
    }

    // --- ACTIONS ---
    async function handleSaveOfficer(e: any) {
        e.preventDefault();
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'save_officer', ...officerForm }) });
        const json = await res.json();
        if (json.ok) { Swal.fire('Berhasil', 'Pejabat disimpan', 'success'); fetchOfficers(); }
        else Swal.fire('Gagal', json.error, 'error');
    }

    async function handleDeleteOfficer(id: string) {
        if (!(await Swal.fire({ title: 'Hapus?', icon: 'warning', showCancelButton: true })).isConfirmed) return;
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'delete_officer', id }) });
        if ((await res.json()).ok) fetchOfficers();
    }

    async function handleSaveBudget(e: any) {
        e.preventDefault();
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'save_budget', ...budgetForm }) });
        const json = await res.json();
        if (json.ok) { Swal.fire('Berhasil', 'Anggaran disimpan', 'success'); fetchBudgets(); }
        else Swal.fire('Gagal', json.error, 'error');
    }

    async function handleSaveMutation(e: any) {
        e.preventDefault();
        const amt = Number(mutationForm.amount);
        if (!Number.isFinite(amt) || amt <= 0) return Swal.fire('Gagal', 'Nominal harus lebih dari 0', 'warning');
        if (!mutationForm.reason.trim()) return Swal.fire('Gagal', 'Alasan mutasi wajib diisi', 'warning');
        const period = selectedBudgetYear;
        let payload: any;
        if (mutationForm.type === 'Transfer') {
            if (!mutationForm.division_id || !mutationForm.to_division_id) return Swal.fire('Gagal', 'Pilih divisi asal dan tujuan', 'warning');
            if (mutationForm.division_id === mutationForm.to_division_id) return Swal.fire('Gagal', 'Divisi asal dan tujuan tidak boleh sama', 'warning');
            payload = { action: 'transfer_budget', from_division_id: mutationForm.division_id, to_division_id: mutationForm.to_division_id, period, category: (mutationForm as any).category, amount: amt, reason: mutationForm.reason.trim() };
        } else {
            if (!mutationForm.division_id) return Swal.fire('Gagal', 'Pilih divisi', 'warning');
            const signed = mutationForm.direction === 'subtract' ? -amt : amt;
            payload = { action: 'adjust_budget', division_id: mutationForm.division_id, period, category: (mutationForm as any).category, amount: signed, reason: mutationForm.reason.trim() };
        }
        setSavingMutation(true);
        try {
            const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify(payload) });
            const json = await res.json();
            if (json.ok) {
                Swal.fire('Berhasil', 'Mutasi anggaran tercatat', 'success');
                setMutationForm({ type: mutationForm.type, division_id: '', to_division_id: '', direction: 'add', category: 'Bahan', amount: 0, reason: '' });
                fetchBudgets(); fetchMutations();
            } else Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
        } catch (e: any) {
            Swal.fire('Gagal', e.message, 'error');
        } finally {
            setSavingMutation(false);
        }
    }

    async function handleCreateRequest(e: any) {
        e.preventDefault();
        if (requestForm.items.length === 0) return Swal.fire('Gagal', 'Minimal 1 item', 'warning');

        let proofUrl = requestForm.proof_file_url;
        if (proofFile) {
            setUploadingProof(true);
            try {
                const formData = new FormData();
                formData.append('file', proofFile);
                formData.append('folder', 'bukti_keuangan');
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                const uploadJson = await uploadRes.json();
                if (!uploadRes.ok || !uploadJson.ok) throw new Error(uploadJson.error || 'Gagal mengunggah bukti');
                proofUrl = uploadJson.url || uploadJson.file_url || uploadJson.file_path;
            } catch (err: any) {
                setUploadingProof(false);
                return Swal.fire('Gagal', `Bukti gagal diunggah: ${err.message}`, 'error');
            }
            setUploadingProof(false);
        }

        const action = requestForm.id ? 'update_request' : 'create_request';
        const route = isTuDivisionId(requestForm.division_id) ? requestForm.route : 'normal';
        const bodyObj: any = { action, activity_name: requestForm.activity_name, description: requestForm.description, items: requestForm.items, route, proof_url: proofUrl };
        if (requestForm.id) bodyObj.request_id = requestForm.id;
        else { bodyObj.pj_user_id = user.id; bodyObj.division_id = requestForm.division_id; }

        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify(bodyObj) });
        const json = await res.json();
        if (json.ok) {
            Swal.fire('Berhasil', requestForm.id ? 'Perbaiki disimpan' : 'Pengajuan dibuat', 'success');
            fetchRequests('pj');
            setRequestForm({ id: null, division_id: '', activity_name: '', description: '', route: 'normal', proof_file_url: '', items: [{ item_name: '', category: 'Bahan', quantity: 1, unit: 'Pcs', unit_price: 0 }] });
            setProofFile(null);
        }
        else Swal.fire('Gagal', json.error, 'error');
    }

    const KATEGORI_ANGGARAN = ['Bahan', 'Transport', 'Honor'];

    const normalizeKategori = (raw: any): string | null => {
        const v = String(raw ?? '').trim().toLowerCase();
        return KATEGORI_ANGGARAN.find(c => c.toLowerCase() === v) || null;
    };

    // Export Template Excel
    const handleExportTemplate = () => {
        import('xlsx').then(XLSX => {
            const header = ['No', 'Nama Barang/Jasa', 'Kategori', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah'];
            const BARIS_KOSONG = 25;
            const aoa: any[][] = [header];
            for (let i = 0; i < BARIS_KOSONG; i++) aoa.push([i + 1, '', '', null, '', null, null]);

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const fmtInt = '#,##0';
            for (let i = 0; i < BARIS_KOSONG; i++) {
                const r = i + 1;
                const excelRow = r + 1;
                ws[XLSX.utils.encode_cell({ r, c: 6 })] = { t: 'n', f: `D${excelRow}*F${excelRow}`, z: fmtInt };
            }

            ws['!cols'] = [
                { wch: 5 }, { wch: 34 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
            ];
            ws['!rows'] = [{ hpt: 24 }];
            ws['!autofilter'] = { ref: `A1:G${BARIS_KOSONG + 1}` };

            const petunjuk: any[][] = [
                ['PETUNJUK PENGISIAN TEMPLATE RINCIAN ANGGARAN'],
                [],
                ['1.', 'Isi data HANYA di sheet "Rincian". Jangan mengubah, menghapus, atau memindahkan judul kolom di baris 1.'],
                ['2.', 'Satu baris = satu item. Baris yang kolom "Nama Barang/Jasa"-nya kosong akan diabaikan saat import.'],
                ['3.', 'Kolom "Jumlah" sudah berisi rumus Qty x Harga Satuan — biarkan saja, tidak perlu diketik.'],
                ['4.', 'Kalau butuh lebih dari 25 baris, salin baris terakhir ke bawah secukupnya.'],
                ['5.', 'Simpan sebagai .xlsx, lalu unggah lewat modal Import Excel.'],
            ];

            const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
            wsPetunjuk['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 62 }, { wch: 40 }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rincian');
            XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
            XLSX.writeFile(wb, 'Template_Rincian_Anggaran.xlsx');
        });
    };

    // Export Data Tabel Item (Format sama dengan Import)
    const exportRequestItemsToExcel = (items: any[], activityName?: string, requestNumber?: string) => {
        if (!items || items.length === 0) {
            return Swal.fire('Informasi', 'Belum ada item untuk diexport.', 'info');
        }
        import('xlsx').then(XLSX => {
            const header = ['No', 'Nama Barang/Jasa', 'Kategori', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah'];
            const rows = items.map((it, idx) => [
                idx + 1,
                it.item_name || '',
                it.category || 'Bahan',
                it.quantity || 0,
                it.unit || 'Pcs',
                it.unit_price || 0,
                (it.quantity || 0) * (it.unit_price || 0)
            ]);

            const aoa = [header, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(aoa);

            ws['!cols'] = [
                { wch: 5 }, { wch: 34 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rincian');
            const safeName = (requestNumber || activityName || 'Pengajuan').replace(/[^a-zA-Z0-9_-]/g, '_');
            XLSX.writeFile(wb, `Rincian_Item_${safeName}.xlsx`);
        });
    };

    function validateExcelRow(row: any, rowIndex: number): { ok: 'skip' } | { ok: true } | { ok: false; error: string } {
        const nama = String(row["Nama Barang/Jasa"] || '').trim();
        if (!nama) return { ok: 'skip' };

        const kategori = String(row["Kategori"] || '').trim();
        const qtyRaw = row["Qty"];
        const satuan = String(row["Satuan"] || '').trim();
        const hargaRaw = row["Harga Satuan"];

        if (!normalizeKategori(kategori)) return { ok: false, error: `Baris ${rowIndex + 2}: Kategori "${kategori || '(kosong)'}" tidak dikenal.` };
        const qty = Number(qtyRaw);
        if (qtyRaw === undefined || qtyRaw === null || qtyRaw === '') return { ok: false, error: `Baris ${rowIndex + 2}: Qty wajib diisi.` };
        if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) return { ok: false, error: `Baris ${rowIndex + 2}: Qty harus bilangan bulat positif.` };
        if (!satuan) return { ok: false, error: `Baris ${rowIndex + 2}: Satuan wajib diisi.` };
        const harga = Number(hargaRaw);
        if (hargaRaw === undefined || hargaRaw === null || hargaRaw === '') return { ok: false, error: `Baris ${rowIndex + 2}: Harga Satuan wajib diisi.` };
        if (!Number.isFinite(harga) || harga < 0) return { ok: false, error: `Baris ${rowIndex + 2}: Harga Satuan harus bilangan ≥ 0.` };

        return { ok: true };
    }

    function processImportFile(file: File) {
        import('xlsx').then(XLSX => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames.find(n => n.trim().toLowerCase() === 'rincian')
                    || wb.SheetNames.find(n => n.trim().toLowerCase() !== 'petunjuk')
                    || wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[] = XLSX.utils.sheet_to_json(ws);
                if (!data || data.length === 0) {
                    return Swal.fire('Gagal', 'File Excel kosong — tidak ada baris data.', 'warning');
                }
                if (!data.some((row: any) => Object.prototype.hasOwnProperty.call(row, 'Nama Barang/Jasa'))) {
                    return Swal.fire('Gagal', 'Judul kolom tidak dikenali. Pastikan baris 1 sheet "Rincian" berisi: No, Nama Barang/Jasa, Kategori, Qty, Satuan, Harga Satuan, Jumlah.', 'warning');
                }

                const errors: string[] = [];
                const newItems: any[] = [];

                data.forEach((row: any, rowIndex: number) => {
                    const v = validateExcelRow(row, rowIndex);
                    if (v.ok === 'skip') return;
                    if (!v.ok) {
                        errors.push(v.error);
                        return;
                    }
                    newItems.push({
                        item_name: String(row["Nama Barang/Jasa"] || '').trim(),
                        category: normalizeKategori(row["Kategori"]) || 'Bahan',
                        quantity: parseInt(String(row["Qty"]), 10),
                        unit: String(row["Satuan"] || 'Pcs').trim(),
                        unit_price: parseInt(String(row["Harga Satuan"]), 10),
                    });
                });

                if (errors.length > 0) {
                    return Swal.fire({
                        title: 'Gagal — Data Excel tidak valid',
                        html: `<div style="text-align:left;font-size:0.85rem;max-height:60vh;overflow-y:auto;">
                            <p style="margin:0 0 8px;color:#dc2626;font-weight:700;">Ditemukan ${errors.length} kesalahan:</p>
                            <ul style="margin:0;padding-left:20px;">${errors.map(e => `<li style="margin-bottom:4px;color:#7f1d1d;">${e.replace(/</g, '&lt;')}</li>`).join('')}</ul>
                        </div>`,
                        icon: 'error',
                        confirmButtonText: 'Tutup',
                    });
                }

                setRequestForm(prev => ({ ...prev, items: newItems }));
                Swal.fire('Berhasil', `${newItems.length} item berhasil diimpor`, 'success');
            };
            reader.readAsBinaryString(file);
        });
    }

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const { openFile, viewer } = useFileViewer();
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [rejectionNotesMap, setRejectionNotesMap] = useState<Record<number, string>>({});
    const [rejectedItems, setRejectedItems] = useState<number[]>([]);
    const [isApproving, setIsApproving] = useState(false);

    const [showLaporanModal, setShowLaporanModal] = useState(false);
    const [laporanRequest, setLaporanRequest] = useState<any>(null);
    const [receiptForm, setReceiptForm] = useState({ amount: 0, description: '' });
    const [savingReceipt, setSavingReceipt] = useState(false);

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmRequest, setConfirmRequest] = useState<any>(null);
    const [checkedDisbIds, setCheckedDisbIds] = useState<string[]>([]);
    const [confirmingDisb, setConfirmingDisb] = useState(false);

    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerRequestId, setRegisterRequestId] = useState<string | null>(null);
    const [registerInputs, setRegisterInputs] = useState<string[]>(['']);
    const [savingRegisters, setSavingRegisters] = useState(false);

    function openRegisterModal(r: any) {
        setRegisterRequestId(r.id);
        const existing = (r.budget_request_registers || []).map((x: any) => x.register_number);
        setRegisterInputs(existing.length > 0 ? existing : ['']);
        setShowRegisterModal(true);
    }

    async function handleSaveRegisters() {
        if (!registerRequestId) return;
        const registers = registerInputs.map(s => s.trim()).filter(Boolean);
        setSavingRegisters(true);
        try {
            const res = await fetch('/api/keuangan', {
                method: 'POST',
                body: JSON.stringify({ action: 'save_registers', request_id: registerRequestId, registers }),
            });
            const json = await res.json();
            if (json.ok) {
                Swal.fire('Berhasil', json.count > 0 ? `${json.count} nomor register disimpan` : 'Nomor register dikosongkan', 'success');
                setShowRegisterModal(false);
                refreshCurrentRequests();
            } else {
                Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
            }
        } catch (e: any) {
            Swal.fire('Gagal', e.message, 'error');
        } finally {
            setSavingRegisters(false);
        }
    }

    function openApprovalModal(req: any, isBendaharaReject = false) {
        let nextStatus = '';
        let roleAction = '';
        if (isBendaharaReject) {
             nextStatus = 'Antrean Pencairan'; 
             roleAction = 'Bendahara';
        }
        else if (req.status === 'Menunggu KTU') { nextStatus = isTuDivisionId(req.division_id) ? 'Menunggu PPK' : 'Menunggu Divisi'; roleAction = 'KTU'; }
        else if (req.status === 'Menunggu Divisi') { nextStatus = 'Menunggu PPK'; roleAction = 'Kepala Divisi'; }
        else if (req.status === 'Menunggu PPK') { nextStatus = 'Antrean Pencairan'; roleAction = 'PPK'; }

        setSelectedRequest({ ...req, roleAction, nextStatus });
        setRejectionNotes('');
        setRejectionNotesMap({});
        setRejectedItems([]);
        setShowApprovalModal(true);
    }

    async function submitApproval(isRejected: boolean) {
        if (isRejected) {
            if (rejectedItems.length === 0 && !rejectionNotes.trim()) {
                return Swal.fire('Gagal', 'Catatan revisi umum wajib diisi jika tidak ada item spesifik yang ditandai', 'warning');
            }
            if (rejectedItems.length > 0) {
                const missingNotes = rejectedItems.some(idx => !rejectionNotesMap[idx] || !rejectionNotesMap[idx].trim());
                if (missingNotes) return Swal.fire('Gagal', 'Catatan revisi wajib diisi untuk setiap item yang ditandai', 'warning');
            }
        }
        
        setIsApproving(true);
        const actionStatus = isRejected ? 'Rejected' : 'Approved';
        const nextStatus = isRejected ? 'Revisi PJ' : selectedRequest.nextStatus;
        
        let finalNotes = '';
        if (isRejected) {
            if (rejectedItems.length > 0) {
                const notesArr = rejectedItems.map(idx => {
                    const item = selectedRequest.budget_request_items[idx];
                    return `${idx + 1}. [${item.item_name}]: ${rejectionNotesMap[idx]}`;
                });
                finalNotes = `Revisi Item:\n${notesArr.join('\n')}`;
                if (rejectionNotes.trim()) finalNotes += `\n\nCatatan Tambahan: ${rejectionNotes}`;
            } else {
                finalNotes = `Catatan Revisi: ${rejectionNotes}`;
            }
        }

        try {
            const res = await fetch('/api/keuangan', { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'approve_request', request_id: selectedRequest.id, user_id: user?.id,
                    role: selectedRequest.roleAction, status_action: actionStatus,
                    next_status: nextStatus, notes: finalNotes
                }) 
            });

            const json = await res.json();
            if (json.ok) { 
                Swal.fire('Berhasil', isRejected ? 'Dikembalikan ke PJ' : 'Disetujui', 'success'); 
                setShowApprovalModal(false);
                if (activeTab === 'pencairan') fetchRequests('bendahara');
                else fetchRequests('semua');
            } else {
                Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
            }
        } catch (e: any) {
            Swal.fire('Gagal', e.message, 'error');
        } finally {
            setIsApproving(false);
        }
    }

    async function handleDisburse(reqId: string, totalAmount: number, currentDisbursed: number) {
        const resReq = await fetch(`/api/keuangan?action=get_requests&role_context=bendahara`);
        const jsonReq = await resReq.json();
        const freshReq = jsonReq.data?.find((x: any) => x.id === reqId);
        if (!freshReq) return Swal.fire('Gagal', 'Pengajuan tidak ditemukan', 'error');

        const freshDisbursed = parseFloat(freshReq.total_disbursed || 0);
        const pendingSum = (freshReq.disbursements || [])
            .filter((d: any) => d.status === 'Menunggu Konfirmasi')
            .reduce((s: number, d: any) => s + parseFloat(d.amount || 0), 0);
            
        const req = freshReq;

        const html = `
            <div style="text-align: left; font-size: 0.9rem;">
                <p style="margin-top: 0;">Silakan isi realisasi pencairan untuk tiap item (jika cair sebagian). Jika tidak dicairkan, isi 0.</p>
                <div style="max-height: 50vh; overflow-y: auto; padding-right: 8px;">
                ${req.budget_request_items.map((item: any, idx: number) => `
                    <div style="margin-bottom: 12px; background: var(--n-surface); padding: 10px; border-radius: 8px; border: 1px solid var(--n-border);">
                        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--n-ink);">${item.item_name} <span style="color:var(--n-muted); font-size:0.8em">(${item.category})</span></label>
                        <div style="font-size: 0.8rem; margin-bottom: 6px; color: #059669;">Pengajuan: Rp ${Number(item.total_price).toLocaleString('id-ID')}</div>
                        <input type="number" id="disburse_item_${item.id}" class="swal2-input" style="width: 100%; box-sizing: border-box; margin: 0; font-size: 0.9rem;" value="${item.actual_price ?? item.total_price}" min="0" max="${item.total_price}" />
                    </div>
                `).join('')}
                </div>
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--n-border);">
                    <label style="display: block; font-weight: bold; margin-bottom: 4px;">Total Nominal Pencairan (Otomatis)</label>
                    <input type="number" id="disburse_total" class="swal2-input" style="width: 100%; box-sizing: border-box; margin: 0; background: #e2e8f0;" readonly />
                </div>
            </div>
        `;

        const maxAmount = totalAmount - freshDisbursed - pendingSum;

        const { value: formData } = await Swal.fire({
            title: 'Rincian Pencairan',
            html,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: 'Cairkan',
            didOpen: () => {
                const inputs = req.budget_request_items.map((item: any) => document.getElementById(`disburse_item_${item.id}`) as HTMLInputElement);
                const totalInput = document.getElementById('disburse_total') as HTMLInputElement;
                const calcTotal = () => {
                    const sum = inputs.reduce((acc: number, el: HTMLInputElement) => acc + (parseFloat(el.value) || 0), 0);
                    totalInput.value = sum.toString();
                };
                inputs.forEach((el: HTMLInputElement) => el.addEventListener('input', calcTotal));
                calcTotal();
            },
            preConfirm: () => {
                const totalInput = document.getElementById('disburse_total') as HTMLInputElement;
                const amount = parseFloat(totalInput.value) || 0;
                
                if (amount <= 0) {
                    Swal.showValidationMessage('Total nominal harus lebih dari 0');
                    return false;
                }
                if (amount > maxAmount) {
                    Swal.showValidationMessage(`Total nominal tidak boleh melebihi sisa yang belum dicairkan (Rp ${maxAmount.toLocaleString('id-ID')})`);
                    return false;
                }
                
                const items = req.budget_request_items.map((item: any) => {
                    const el = document.getElementById(`disburse_item_${item.id}`) as HTMLInputElement;
                    return { id: item.id, actual_price: el ? (parseFloat(el.value) || 0) : 0 };
                });
                
                return { amount, items };
            }
        });

        if (!formData) return;
        
        const res = await fetch('/api/keuangan', { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'disburse_request', 
                request_id: reqId, 
                user_id: user.id, 
                amount_to_disburse: formData.amount,
                items: formData.items
            }) 
        });
        const json = await res.json();
        
        if (json.ok) {
            Swal.fire('Berhasil', 'Dana berhasil dicairkan', 'success');
            if (activeTab === 'pencairan') fetchRequests('bendahara');
            else fetchRequests('semua');
        } else {
            Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
        }
    }

    function openConfirmModal(r: any) {
        setConfirmRequest(r);
        setCheckedDisbIds([]);
        setShowConfirmModal(true);
    }

    async function submitConfirmDisbursement() {
        if (!confirmRequest) return;
        if (checkedDisbIds.length === 0) {
            return Swal.fire('Belum ada tahap dipilih', 'Centang minimal satu tahap pencairan yang telah Anda terima.', 'warning');
        }
        setConfirmingDisb(true);
        try {
            const res = await fetch('/api/keuangan', {
                method: 'POST',
                body: JSON.stringify({ action: 'confirm_disbursement', request_id: confirmRequest.id, disbursement_ids: checkedDisbIds, user_id: user.id }),
            });
            const json = await res.json();
            if (json.ok) {
                setShowConfirmModal(false);
                Swal.fire('Berhasil', 'Tahap pencairan yang dipilih telah dikonfirmasi.', 'success');
                fetchRequests('pj');
            } else {
                Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
            }
        } catch (e: any) {
            Swal.fire('Gagal', e.message, 'error');
        } finally {
            setConfirmingDisb(false);
        }
    }

    async function handlePending(reqId: string) {
        if (!(await Swal.fire({ title: 'Tunda Pencairan?', icon: 'warning', showCancelButton: true })).isConfirmed) return;
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'set_pending_request', request_id: reqId, user_id: user.id }) });
        if ((await res.json()).ok) { Swal.fire('Berhasil', 'Status diubah ke Pending', 'success'); fetchRequests('bendahara'); }
    }

    function refreshCurrentRequests() {
        if (activeTab === 'pengajuan') fetchRequests('pj');
        else if (activeTab === 'monitoring' || activeTab === 'antrean') fetchRequests(activeTab === 'monitoring' ? 'bendahara' : 'semua');
        else fetchRequests('bendahara');
    }

    async function handleUploadReport(reqId: string) {
        const { value: file } = await Swal.fire({
            title: 'Unggah Laporan (PDF)',
            html: `
                <div style="text-align: left; font-size: 0.9rem;">
                    <label>File Laporan Kegiatan (PDF):</label><br/>
                    <input type="file" id="swal-input-report" class="swal2-file" accept=".pdf,image/*">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                const rep = (document.getElementById('swal-input-report') as HTMLInputElement).files?.[0];
                if (!rep) Swal.showValidationMessage('File laporan wajib diunggah');
                return rep;
            }
        });
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'laporan_keuangan');
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok || !uploadJson.ok) throw new Error(uploadJson.error || 'Gagal mengunggah laporan');
            const url = uploadJson.url || uploadJson.file_url || uploadJson.file_path;
            
            const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'upload_report', request_id: reqId, report_url: url }) });
            const json = await res.json();
            if (json.ok) { Swal.fire('Berhasil', 'Laporan berhasil diunggah', 'success'); refreshCurrentRequests(); if (laporanRequest?.id === reqId) setShowLaporanModal(false); }
            else Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
        } catch (err: any) {
            Swal.fire('Error Upload', err.message, 'error');
        } finally {
            setUploading(false);
        }
    }

    async function handleVerifyReceipt(reqId: string) {
        if (!(await Swal.fire({ title: 'Centang Nota Lengkap?', text: 'Tandai bahwa nota telah disetor & diterima lengkap.', icon: 'question', showCancelButton: true })).isConfirmed) return;
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'verify_receipt', request_id: reqId }) });
        if ((await res.json()).ok) { Swal.fire('Berhasil', 'Nota ditandai lengkap', 'success'); refreshCurrentRequests(); setShowLaporanModal(false); }
    }

    async function handleVerifyReportReceived(reqId: string) {
        if (!(await Swal.fire({ title: 'Centang Laporan Diterima?', text: 'Tandai laporan (fisik + digital) sudah diterima lengkap.', icon: 'question', showCancelButton: true })).isConfirmed) return;
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'verify_report_received', request_id: reqId }) });
        if ((await res.json()).ok) { Swal.fire('Berhasil', 'Laporan ditandai diterima', 'success'); refreshCurrentRequests(); setShowLaporanModal(false); }
    }

    const receiptSubmittedOf = (r: any): number =>
        (r.receipt_submissions || []).reduce((s: number, x: any) => s + parseFloat(x.amount || 0), 0);

    async function handleAddReceipt() {
        if (!laporanRequest) return;
        const amt = Number(receiptForm.amount);
        if (!Number.isFinite(amt) || amt <= 0) return Swal.fire('Gagal', 'Nominal nota harus lebih dari 0', 'warning');
        setSavingReceipt(true);
        try {
            const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'add_receipt', request_id: laporanRequest.id, amount: amt, description: receiptForm.description.trim() }) });
            const json = await res.json();
            if (json.ok) {
                setReceiptForm({ amount: 0, description: '' });
                await refreshLaporanRequest();
            } else Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
        } catch (e: any) { Swal.fire('Gagal', e.message, 'error'); }
        finally { setSavingReceipt(false); }
    }

    async function handleDeleteReceipt(receiptId: string) {
        if (!laporanRequest) return;
        if (!(await Swal.fire({ title: 'Hapus entri nota?', icon: 'warning', showCancelButton: true })).isConfirmed) return;
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'delete_receipt', receipt_id: receiptId, request_id: laporanRequest.id }) });
        if ((await res.json()).ok) await refreshLaporanRequest();
    }

    async function refreshLaporanRequest() {
        const ctx = activeTab === 'pengajuan' ? 'pj' : (activeTab === 'antrean' ? 'semua' : 'bendahara');
        const res = await fetch(`/api/keuangan?action=get_requests&role_context=${ctx}&user_id=${user?.id}`);
        const json = await res.json();
        if (json.ok) {
            setRequests(json.data);
            const updated = json.data.find((x: any) => x.id === laporanRequest?.id);
            if (updated) setLaporanRequest(updated);
        }
    }

    function openLaporanModal(r: any) {
        setLaporanRequest(r);
        setReceiptForm({ amount: 0, description: '' });
        setShowLaporanModal(true);
    }

    async function handleApproveReport(reqId: string, nextStatus: string) {
        if (!(await Swal.fire({ title: 'Setujui Laporan?', text: `Teruskan ke tahap: ${nextStatus}?`, icon: 'question', showCancelButton: true })).isConfirmed) return;
        const res = await fetch('/api/keuangan', { method: 'POST', body: JSON.stringify({ action: 'verify_report', request_id: reqId }) });
        const json = await res.json();
        if (json.ok) { Swal.fire('Berhasil', 'Laporan Disetujui', 'success'); refreshCurrentRequests(); setShowLaporanModal(false); }
        else Swal.fire('Gagal', json.error || 'Terjadi kesalahan', 'error');
    }

    // Spinner trace tanpa label
    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <Spinner variant="buble" />
        </div>
    );

    const isOfficer = myOfficerRoles.some(r => ['KEPALA DIVISI', 'KTU', 'PPK', 'BENDAHARA'].includes(r));
    const hasPengajuan = true;
    const hasAntrean = !isPureAdmin;
    const hasPencairan = myOfficerRoles.includes('BENDAHARA');
    const hasPagu = isOfficer;
    const hasMonitoring = isOfficer;
    const hasPengaturan = isAdmin;

    const tabs: TabItem<TabType>[] = [
        ...(hasPengajuan ? [{ key: 'pengajuan' as const, label: 'Pengajuan Saya', icon: 'journal-plus' }] : []),
        ...(hasAntrean ? [{ key: 'antrean' as const, label: 'Antrean Persetujuan', icon: 'inbox' }] : []),
        ...(hasPencairan ? [{ key: 'pencairan' as const, label: 'Pencairan', icon: 'cash-coin' }] : []),
        ...(hasPagu ? [{ key: 'pagu' as const, label: canManageBudget ? 'Kelola Pagu' : (canSeeAllBudget ? 'Pagu Anggaran' : 'Pagu Divisi'), icon: 'wallet2' }] : []),
        ...(hasMonitoring ? [{ key: 'monitoring' as const, label: 'Arsip & Laporan', icon: 'archive' }] : []),
        ...(hasPengaturan ? [{ key: 'pengaturan' as const, label: 'Pengaturan', icon: 'gear' }] : []),
    ];

    const filteredRequests = requests.filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (r.activity_name || '').toLowerCase().includes(q) ||
            (r.request_number || '').toLowerCase().includes(q) ||
            (r.users?.nama || '').toLowerCase().includes(q) ||
            (r.divisions?.name || '').toLowerCase().includes(q) ||
            (r.status || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="keuangan-container">
            {/* 1. PageBanner Component */}
            <Tab
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                ariaLabel="Tab Keuangan"
                variant="slider"
            />

            {/* 3. FilterToolbar & FilterSearch Component */}
            {['pengajuan', 'antrean', 'pencairan', 'monitoring'].includes(activeTab) && (
                <FilterToolbar>
                    <FilterSearch 
                        value={search} 
                        onChange={setSearch} 
                        placeholder="Cari kegiatan, pemohon, nomor register, atau status..." 
                    />
                </FilterToolbar>
            )}

            <div style={{ marginTop: '4px' }}>
                {activeTab === 'pengaturan' && (
                    <KeuanganTabPengaturan
                        officerForm={officerForm}
                        setOfficerForm={setOfficerForm}
                        handleSaveOfficer={handleSaveOfficer}
                        usersList={usersList}
                        divisions={divisions}
                        officers={officers}
                        handleDeleteOfficer={handleDeleteOfficer}
                    />
                )}
                {activeTab === 'pengajuan' && (
                    <KeuanganTabPengajuan
                        requestForm={requestForm}
                        setRequestForm={setRequestForm}
                        handleCreateRequest={handleCreateRequest}
                        isTuDivisionId={isTuDivisionId}
                        divisions={divisions}
                        setShowImportModal={setShowImportModal}
                        exportRequestItemsToExcel={exportRequestItemsToExcel}
                        proofFile={proofFile}
                        setProofFile={setProofFile}
                        openFile={openFile}
                        uploadingProof={uploadingProof}
                        filteredRequests={filteredRequests}
                        stBadge={stBadge}
                        setSelectedRequest={setSelectedRequest}
                        setShowDetailModal={setShowDetailModal}
                        canApproveStage={canApproveStage}
                        openApprovalModal={openApprovalModal}
                        canManageRegisters={canManageRegisters}
                        openRegisterModal={openRegisterModal}
                    />
                )}
                {activeTab === 'antrean' && (
                    <KeuanganTabAntrean
                        filteredRequests={filteredRequests}
                        stBadge={stBadge}
                        fmtRp={fmtRp}
                        setSelectedRequest={setSelectedRequest}
                        setShowDetailModal={setShowDetailModal}
                        exportRequestItemsToExcel={exportRequestItemsToExcel}
                        canApproveStage={canApproveStage}
                        openApprovalModal={openApprovalModal}
                        canManageRegisters={canManageRegisters}
                        openRegisterModal={openRegisterModal}
                    />
                )}
                {activeTab === 'pencairan' && (
                    <KeuanganTabPencairan
                        filteredRequests={filteredRequests}
                        stBadge={stBadge}
                        fmtRp={fmtRp}
                        setSelectedRequest={setSelectedRequest}
                        setShowDetailModal={setShowDetailModal}
                        exportRequestItemsToExcel={exportRequestItemsToExcel}
                        myOfficerRoles={myOfficerRoles}
                        handleDisburse={handleDisburse}
                        handlePending={handlePending}
                        openApprovalModal={openApprovalModal}
                    />
                )}
                {activeTab === 'pagu' && (
                    <KeuanganTabPagu
                        canManageBudget={canManageBudget}
                        handleSaveBudget={handleSaveBudget}
                        budgetForm={budgetForm}
                        setBudgetForm={setBudgetForm}
                        divisions={divisions}
                        handleSaveMutation={handleSaveMutation}
                        mutationForm={mutationForm}
                        setMutationForm={setMutationForm}
                        savingMutation={savingMutation}
                    />
                )}
                {activeTab === 'monitoring' && (
                    <KeuanganTabMonitoring
                        filteredRequests={filteredRequests}
                        stBadge={stBadge}
                        openFile={openFile}
                        setSelectedRequest={setSelectedRequest}
                        setShowDetailModal={setShowDetailModal}
                        exportRequestItemsToExcel={exportRequestItemsToExcel}
                        openLaporanModal={openLaporanModal}
                    />
                )}
            </div>

            {/* 7. Modal Component - IMPORT EXCEL MODAL */}
            {showImportModal && (
                <Modal size="md" onClose={() => { setShowImportModal(false); setImportFile(null); }} labelledBy="import-modal-title">
                    <ModalHeader 
                        id="import-modal-title" 
                        icon="upload" 
                        title="Import Rincian Item dari Excel" 
                        subtitle="Unggah file spreadsheet rincian item pengajuan" 
                        onClose={() => { setShowImportModal(false); setImportFile(null); }} 
                    />
                    <ModalBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ background: 'var(--n-surface)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--n-border)' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--n-ink)', fontWeight: 600 }}>
                                    Petunjuk Import & Template:
                                </p>
                                <p style={{ margin: '4px 0 10px 0', fontSize: '0.8rem', color: 'var(--n-muted)' }}>
                                    Gunakan template Excel resmi agar format kolom sesuai dengan sistem.
                                </p>
                                <Button type="button" variant="secondary" size="sm" icon="download" onClick={handleExportTemplate}>
                                    Unduh Template
                                </Button>
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n-muted)', textTransform: 'uppercase' }}>
                                    File Excel (.xlsx / .xls)
                                </label>
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    className="form-control" 
                                    onChange={e => setImportFile(e.target.files?.[0] || null)} 
                                />
                                {importFile && (
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                                        <i className="bi bi-check-circle-fill" style={{ marginRight: 4 }} />
                                        Terpilih: {importFile.name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
                            Batal
                        </Button>
                        <Button 
                            variant="primary" 
                            disabled={!importFile} 
                            icon="import"
                            onClick={() => {
                                if (importFile) {
                                    processImportFile(importFile);
                                    setShowImportModal(false);
                                    setImportFile(null);
                                }
                            }}
                        >
                            Proses Import
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - VERIFIKASI PIMPINAN */}
            {showApprovalModal && selectedRequest && (
                <Modal size="lg" onClose={() => setShowApprovalModal(false)} labelledBy="approval-modal-title">
                    <ModalHeader 
                        id="approval-modal-title" 
                        icon="clipboard-check" 
                        title="Verifikasi Rincian Pengajuan" 
                        subtitle={`${selectedRequest.request_number || ''} — ${selectedRequest.activity_name || ''}`} 
                        onClose={() => setShowApprovalModal(false)} 
                    />
                    <ModalBody>
                        <ModalDetailGrid>
                            <ModalDetailField label="Pemohon">
                                {selectedRequest.users?.nama || '-'}
                            </ModalDetailField>
                            <ModalDetailField label="Total Pengajuan">
                                <span style={{ fontWeight: 700, color: 'var(--n-primary)' }}>{fmtRp(selectedRequest.total_amount)}</span>
                            </ModalDetailField>
                        </ModalDetailGrid>

                        <div style={{ overflowX: 'auto', margin: '16px 0', border: '1px solid var(--n-border)', borderRadius: '8px' }}>
                            <table className="data-table" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>⚠️</th>
                                        <th>Nama Barang</th>
                                        <th>Kategori</th>
                                        <th>Qty</th>
                                        <th>Harga</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.budget_request_items?.map((item: any, idx: number) => (
                                        <tr key={idx} style={{ background: rejectedItems.includes(idx) ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={rejectedItems.includes(idx)} onChange={e => {
                                                    if (e.target.checked) setRejectedItems([...rejectedItems, idx]);
                                                    else setRejectedItems(rejectedItems.filter(i => i !== idx));
                                                }} />
                                            </td>
                                            <td>{item.item_name}</td>
                                            <td>{item.category}</td>
                                            <td>{item.quantity} {item.unit}</td>
                                            <td>{fmtRp(item.unit_price)}</td>
                                            <td>{item.unit_price === null || item.unit_price === undefined ? fmtRp(null) : `Rp ${(item.quantity * item.unit_price).toLocaleString('id-ID')}`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {rejectedItems.length > 0 ? (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Catatan Penolakan Per Item (Wajib)</label>
                                {rejectedItems.map(idx => (
                                    <div key={idx} style={{ marginBottom: '10px' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#be123c', display: 'block', marginBottom: '4px' }}>
                                            {idx + 1}. {selectedRequest.budget_request_items[idx].item_name}
                                        </label>
                                        <textarea 
                                            className="form-control" 
                                            rows={2} 
                                            placeholder="Alasan penolakan..." 
                                            value={rejectionNotesMap[idx] || ''} 
                                            onChange={e => setRejectionNotesMap({...rejectionNotesMap, [idx]: e.target.value})}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Catatan Penolakan Umum (Wajib jika menolak seluruhnya)</label>
                                <textarea className="form-control" rows={3} placeholder="Alasan penolakan..." value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)} />
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="secondary" icon="export" onClick={() => exportRequestItemsToExcel(selectedRequest.budget_request_items, selectedRequest.activity_name, selectedRequest.request_number)}>
                            Export
                        </Button>
                        <Button variant="cancel" onClick={() => setShowApprovalModal(false)} disabled={isApproving}>
                            Batal
                        </Button>
                        <Button variant="danger" onClick={() => submitApproval(true)} isLoading={isApproving} leftIcon={<i className="bi bi-x-circle" />}>
                            Tolak (Revisi)
                        </Button>
                        {selectedRequest.roleAction !== 'Bendahara' && (
                            <Button variant="primary" onClick={() => submitApproval(false)} isLoading={isApproving} leftIcon={<i className="bi bi-check-circle" />}>
                                Setujui (ACC)
                            </Button>
                        )}
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - VIEW DETAIL MODAL */}
            {showDetailModal && selectedRequest && (
                <Modal size="lg" onClose={() => setShowDetailModal(false)} labelledBy="detail-modal-title">
                    <ModalHeader 
                        id="detail-modal-title" 
                        icon="eye" 
                        title="Rincian Pengajuan Dana" 
                        subtitle={`${selectedRequest.request_number || ''} — ${selectedRequest.activity_name || ''}`} 
                        onClose={() => setShowDetailModal(false)} 
                    />
                    <ModalBody>
                        <ModalDetailGrid>
                            <ModalDetailField label="Nomor Pengajuan">
                                {selectedRequest.request_number || '-'}
                            </ModalDetailField>
                            <ModalDetailField label="Pemohon">
                                {selectedRequest.users?.nama || '-'}
                            </ModalDetailField>
                            <ModalDetailField label="Kegiatan" full>
                                {selectedRequest.activity_name}
                            </ModalDetailField>
                            <ModalDetailField label="Total Anggaran">
                                <span style={{ fontWeight: 700, color: 'var(--n-primary)' }}>{fmtRp(selectedRequest.total_amount)}</span>
                            </ModalDetailField>
                            <ModalDetailField label="Status">
                                <span className={`status-badge ${stBadge(selectedRequest.status)}`}>{selectedRequest.status}</span>
                            </ModalDetailField>
                        </ModalDetailGrid>

                        <div style={{ overflowX: 'auto', margin: '16px 0', border: '1px solid var(--n-border)', borderRadius: '8px' }}>
                            <table className="data-table" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Nama Barang</th>
                                        <th>Kategori</th>
                                        <th>Qty</th>
                                        <th>Harga Satuan</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.budget_request_items?.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                            <td>{item.item_name}</td>
                                            <td>{item.category}</td>
                                            <td>{item.quantity} {item.unit}</td>
                                            <td>{fmtRp(item.unit_price)}</td>
                                            <td>{item.unit_price === null || item.unit_price === undefined ? fmtRp(null) : `Rp ${(item.quantity * item.unit_price).toLocaleString('id-ID')}`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="secondary" icon="export" onClick={() => exportRequestItemsToExcel(selectedRequest.budget_request_items, selectedRequest.activity_name, selectedRequest.request_number)}>
                            Export
                        </Button>
                        <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - LAPORAN MODAL */}
            {showLaporanModal && laporanRequest && (
                <Modal size="lg" onClose={() => setShowLaporanModal(false)} labelledBy="laporan-modal-title">
                    <ModalHeader 
                        id="laporan-modal-title" 
                        icon="journal-text" 
                        title="Kelola Laporan & Nota" 
                        subtitle={laporanRequest.activity_name} 
                        onClose={() => setShowLaporanModal(false)} 
                    />
                    <ModalBody>
                        <ModalDetailGrid>
                            <ModalDetailField label="Status Laporan">
                                <span className={`status-badge ${stBadge(laporanRequest.report_status || '')}`}>{laporanRequest.report_status || 'Belum Ada'}</span>
                            </ModalDetailField>
                            <ModalDetailField label="Status Nota">
                                <span className={`status-badge ${stBadge(laporanRequest.receipt_status || '')}`}>{laporanRequest.receipt_status || 'Belum Ada'}</span>
                            </ModalDetailField>
                        </ModalDetailGrid>

                        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <Button type="button" variant="primary" size="sm" onClick={() => handleUploadReport(laporanRequest.id)} leftIcon={<i className="bi bi-upload" />}>
                                Unggah File Laporan (PDF)
                            </Button>
                            {myOfficerRoles.includes('BENDAHARA') && (
                                <>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => handleVerifyReceipt(laporanRequest.id)} leftIcon={<i className="bi bi-check-lg" />}>
                                        Tandai Nota Lengkap
                                    </Button>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => handleVerifyReportReceived(laporanRequest.id)} leftIcon={<i className="bi bi-check-all" />}>
                                        Tandai Laporan Diterima
                                    </Button>
                                </>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="secondary" onClick={() => setShowLaporanModal(false)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {/* 7. Modal Component - REGISTER MODAL */}
            {showRegisterModal && (
                <Modal size="md" onClose={() => setShowRegisterModal(false)} labelledBy="register-modal-title">
                    <ModalHeader 
                        id="register-modal-title" 
                        icon="journal-bookmark" 
                        title="Nomor Register Pengajuan" 
                        subtitle="Dikelola oleh Kepala Divisi" 
                        onClose={() => setShowRegisterModal(false)} 
                    />
                    <ModalBody>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {registerInputs.map((val, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder={`Nomor Register #${idx + 1}...`} 
                                        value={val} 
                                        onChange={e => {
                                            const updated = [...registerInputs];
                                            updated[idx] = e.target.value;
                                            setRegisterInputs(updated);
                                        }} 
                                    />
                                    {registerInputs.length > 1 && (
                                        <Button type="button" variant="danger" size="sm" onClick={() => setRegisterInputs(registerInputs.filter((_, i) => i !== idx))}>
                                            <i className="bi bi-trash" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="secondary" size="sm" onClick={() => setRegisterInputs([...registerInputs, ''])} leftIcon={<i className="bi bi-plus-lg" />}>
                                Tambah Nomor Register
                            </Button>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setShowRegisterModal(false)} disabled={savingRegisters}>
                            Batal
                        </Button>
                        <Button variant="primary" onClick={handleSaveRegisters} isLoading={savingRegisters} leftIcon={<i className="bi bi-save" />}>
                            Simpan Register
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {viewer}
        </div>
    );
}
