'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { useTimezone } from '@/hooks/use-timezone';
import { getActiveAcademicYear } from '@/lib/settings-client';
import { authFetch } from '@/lib/auth-fetch';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';
import DatePicker from '@/components/ui/DatePicker';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { MobileFab } from '@/components/mobile';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface GuruAsuh { id: number; nip: string; nama_guru: string; nisn_siswa: string; nama_siswa: string; kelas: string; tahun_ajaran: string; aktif: boolean; }
interface LaporanGuruAsuh { id: string; guru_asuh_id: number; nip: string; tanggal: string; kegiatan: string; foto_url?: string; guru_asuh?: GuruAsuh; submission_id?: string | null; laporan_guru_asuh_submissions?: { id: string; status: 'Submitted' | 'Approved' | 'Revisi'; } | null; }
interface LaporanSubmission { id: string; status: 'Submitted' | 'Approved' | 'Revisi'; catatan_reviewer?: string | null; approved_by_name?: string | null; approved_at?: string | null; pdf_url?: string | null; }

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

/** Kompres foto dokumentasi di browser: resize maks 1280px & konversi ke WebP untuk ukuran ultra-ringan dengan kualitas tajam */
async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        // Konversi ke WebP dengan kualitas 0.82 (ukuran menyusut hingga ~80-180 KB dengan ketajaman tinggi)
        let blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
        let ext = 'webp';
        let mime = 'image/webp';

        // Fallback ke JPEG jika browser tidak mendukung encode WebP pada canvas
        if (!blob || blob.type !== 'image/webp') {
            blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
            ext = 'jpg';
            mime = 'image/jpeg';
        }

        if (!blob) return file;
        const baseName = file.name.replace(/\.[^.]+$/, '');
        return new File([blob], `${baseName}.${ext}`, { type: mime });
    } catch {
        return file;
    }
}

export default function GuruAsuhTabLaporan({ user }: { user?: any }) {
    const nip = user?.nip || '';
    const [myStudents, setMyStudents] = useState<GuruAsuh[]>([]);
    const [laporanList, setLaporanList] = useState<LaporanGuruAsuh[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingGroup, setEditingGroup] = useState<{ tanggal: string; kegiatan: string; items: LaporanGuruAsuh[] } | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dokumenText, setDokumenText] = useState('');
    const [tanggalValue, setTanggalValue] = useState(new Date().toISOString().split('T')[0]);
    const [filterStudent, setFilterStudent] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    // Bulan selalu spesifik — laporan diajukan & disahkan per bulan, jadi
    // pilihan "Semua Bulan" tidak punya arti untuk pengajuan.
    const [selectedMonth, setSelectedMonth] = useState<number>(1);
    const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(2024);
    const [activeTa, setActiveTa] = useState('');
    const [submission, setSubmission] = useState<LaporanSubmission | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [printingPdf, setPrintingPdf] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [modalStudents, setModalStudents] = useState<{ activityTitle: string; tanggal: string; students: LaporanGuruAsuh[] } | null>(null);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setShowActionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (showForm || previewHtml || previewFileUrl || modalStudents) return registerModal();
    }, [showForm, previewHtml, previewFileUrl, modalStudents, registerModal]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const camInputRef = useRef<HTMLInputElement>(null);

    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();

    // Initialize month/year from timezone
    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            if (today) {
                const [y, m] = today.split('-').map(Number);
                setSelectedYear(y);
                setSelectedMonth(m);
            }
            const ta = await getActiveAcademicYear();
            if (ta) setActiveTa(ta);
        };
        init();
    }, [getTzDate]);

    const filteredList = laporanList.filter(l => {
        if (filterStudent && l.guru_asuh_id.toString() !== filterStudent) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const namaSiswa = l.guru_asuh?.nama_siswa?.toLowerCase() || '';
            const kelas = l.guru_asuh?.kelas?.toLowerCase() || '';
            const kegiatan = l.kegiatan?.toLowerCase() || '';
            const tanggal = l.tanggal?.toLowerCase() || '';
            return namaSiswa.includes(q) || kelas.includes(q) || kegiatan.includes(q) || tanggal.includes(q);
        }
        return true;
    });

    // Satu kali "Baru" dengan banyak siswa terpilih membuat 1 baris DB per
    // siswa (perlu utk edit/hapus per-siswa) — tapi di tampilan, entri dengan
    // tanggal+kegiatan sama digabung jadi 1 baris/kartu berisi daftar siswa.
    const groupedList = (() => {
        const map = new Map<string, { tanggal: string; kegiatan: string; items: LaporanGuruAsuh[] }>();
        const order: string[] = [];
        for (const l of filteredList) {
            const key = `${l.tanggal}|${l.kegiatan}`;
            let g = map.get(key);
            if (!g) { g = { tanggal: l.tanggal, kegiatan: l.kegiatan, items: [] }; map.set(key, g); order.push(key); }
            g.items.push(l);
        }
        const result = order.map(k => map.get(k)!);
        for (const g of result) {
            g.items.sort((a, b) => (a.guru_asuh?.nama_siswa || '').localeCompare(b.guru_asuh?.nama_siswa || '', 'id-ID'));
        }
        return result;
    })();

    const showMsg = (type: 'success' | 'error', text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 4000);
    };

    // Penjaga supaya respons yang lambat/telat (mis. karena nip/bulan berganti
    // cepat berturut-turut) tidak menimpa hasil fetch yang lebih baru — inilah
    // yang bikin data kadang "hilang" sampai halaman di-refresh manual.
    const loadRequestRef = useRef(0);

    const loadData = useCallback(async () => {
        if (!nip) { setLoading(false); return; }
        const requestId = ++loadRequestRef.current;
        setLoading(true);
        try {
            let startDate = '', endDate = '';
            
            if (selectedYear === 'ALL') {
                // Tahun bebas: ambil semua, penyaringan bulan dilakukan di tampilan.
                startDate = '2000-01-01';
                endDate = '2100-12-31';
            } else {
                startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
                const lastDay = new Date(selectedYear as number, selectedMonth, 0).getDate();
                endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }

            const [sRes, lRes, subRes] = await Promise.all([
                fetch(`/api/settings/guru-asuh?nip=${nip}&tahun_ajaran=Semua`),
                fetch(`/api/guru-asuh/laporan?nip=${nip}&startDate=${startDate}&endDate=${endDate}`),
                fetch(`/api/guru-asuh/laporan-submission?nip=${nip}&bulan=${selectedMonth}&tahun=${selectedYear}`),
            ]);
            const [sData, lData, subData] = await Promise.all([sRes.json(), lRes.json(), subRes.json()]);

            if (requestId !== loadRequestRef.current) return; // ada request lebih baru, buang hasil ini

            if (sData.ok) setMyStudents(sData.data || []);
            if (lData.ok) setLaporanList(lData.data || []);
            setSubmission(subData.ok && subData.data?.length ? subData.data[0] : null);
        } catch (e) { console.error(e); }
        finally { if (requestId === loadRequestRef.current) setLoading(false); }
    }, [nip, selectedMonth, selectedYear]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFile = e.target.files?.[0];
        if (!rawFile) return;

        if (!rawFile.type.startsWith('image/')) {
            showMsg('error', 'Format file tidak didukung. Harap pilih berkas foto kegiatan (JPG, PNG, WEBP, dsb).');
            if (e.target) e.target.value = '';
            return;
        }

        setUploading(true);
        try {
            // Berkas foto ukuran berapa pun (mis. 20-30MB dari kamera resolusi tinggi)
            // dikonversi dan dikompresi di memori browser ke WebP (~80-180 KB) sebelum diunggah
            const compressed = await compressImage(rawFile);
            const fd = new FormData();
            fd.append('file', compressed);
            fd.append('folder', 'laporan_guru_asuh');

            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
            setDokumenText(data.publicUrl || data.url);
            showMsg('success', 'Foto berhasil dikonversi ke WebP dan diunggah.');
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleAjukan = async () => {
        if (laporanList.length === 0) { showMsg('error', 'Tidak ada laporan pada bulan ini untuk diajukan'); return; }
        const c = await Swal.fire({
            title: 'Ajukan Laporan Bulan Ini?',
            html: `Laporan ${BULAN[selectedMonth - 1]} ${selectedYear} akan diajukan ke WKM Keasramaan untuk ditinjau dan ditandatangani. Setelah diajukan, entri laporan bulan ini terkunci sampai disetujui atau dikembalikan.`,
            icon: 'question', showCancelButton: true, confirmButtonColor: '#3083FF',
            confirmButtonText: 'Ya, Ajukan', cancelButtonText: 'Batal',
        });
        if (!c.isConfirmed) return;
        setSubmitting(true);
        try {
            const res = await authFetch('/api/guru-asuh/laporan-submission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nip, bulan: selectedMonth, tahun: selectedYear, nama_guru: user?.nama || user?.nama_lengkap }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal mengajukan laporan');
            showMsg('success', 'Laporan berhasil diajukan');
            loadData();
        } catch (e: any) { showMsg('error', e.message || 'Gagal mengajukan laporan'); }
        finally { setSubmitting(false); }
    };

    const handleBatalkan = async () => {
        if (!submission?.id) return;
        const c = await Swal.fire({
            title: 'Batalkan Ajuan?',
            html: 'Laporan akan kembali ke mode draft dan dapat Anda edit atau tambahkan kembali.',
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444',
            confirmButtonText: 'Ya, Batalkan', cancelButtonText: 'Tutup',
        });
        if (!c.isConfirmed) return;
        setSubmitting(true);
        try {
            const res = await authFetch(`/api/guru-asuh/laporan-submission?id=${submission.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal membatalkan ajuan');
            showMsg('success', 'Ajuan berhasil dibatalkan');
            loadData();
        } catch (e: any) { showMsg('error', e.message || 'Gagal membatalkan ajuan'); }
        finally { setSubmitting(false); }
    };

    const handlePratinjau = async () => {
        if (laporanList.length === 0) return;
        setLoadingPreview(true);
        try {
            const payload = submission?.id
                ? { submissionId: submission.id }
                : { nip, bulan: selectedMonth, tahun: selectedYear, nama_guru: user?.nama || user?.nama_lengkap };
            const res = await fetch('/api/guru-asuh/laporan-submission/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memuat pratinjau');
            setPreviewHtml(data.html);
        } catch (e: any) { showMsg('error', e.message || 'Gagal memuat pratinjau'); }
        finally { setLoadingPreview(false); }
    };

    const handleCetakPdf = async () => {
        if (laporanList.length === 0) return;
        setPrintingPdf(true);
        try {
            const payload = submission?.id
                ? { submissionId: submission.id }
                : { nip, bulan: selectedMonth, tahun: selectedYear, nama_guru: user?.nama || user?.nama_lengkap };
            const res = await fetch('/api/guru-asuh/laporan-submission/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.headers.get('content-type')?.includes('application/pdf')) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                setPreviewFileUrl(url);
            } else {
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal membuat PDF');
                if (data.file_url) setPreviewFileUrl(data.file_url);
            }
        } catch (e: any) { showMsg('error', e.message || 'Gagal membuat PDF'); }
        finally { setPrintingPdf(false); }
    };

    const handleSaveLaporan = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (selectedStudentIds.length === 0) { showMsg('error', 'Pilih siswa terlebih dahulu'); return; }
        const fd = new FormData(e.currentTarget);
        setLoading(true);
        try {
            const promises: Promise<any>[] = [];
            const newTanggal = fd.get('tanggal') as string;
            const newKegiatan = fd.get('kegiatan') as string;
            const newFoto = dokumenText || '';

            if (editingGroup) {
                const removed = editingGroup.items.filter(l => !selectedStudentIds.includes(l.guru_asuh_id));
                removed.forEach(l => promises.push(fetch(`/api/guru-asuh/laporan?id=${l.id}`, { method: 'DELETE' })));
                
                const kept = editingGroup.items.filter(l => selectedStudentIds.includes(l.guru_asuh_id));
                kept.forEach(l => promises.push(fetch('/api/guru-asuh/laporan', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: l.id, guru_asuh_id: l.guru_asuh_id, nip, tanggal: newTanggal, kegiatan: newKegiatan, foto_url: newFoto })
                }).then(r => r.json())));

                const addedIds = selectedStudentIds.filter(id => !editingGroup.items.some(l => l.guru_asuh_id === id));
                addedIds.forEach(id => promises.push(fetch('/api/guru-asuh/laporan', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guru_asuh_id: id, nip, tanggal: newTanggal, kegiatan: newKegiatan, foto_url: newFoto })
                }).then(r => r.json())));
            } else {
                selectedStudentIds.forEach(id => promises.push(fetch('/api/guru-asuh/laporan', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guru_asuh_id: id, nip, tanggal: newTanggal, kegiatan: newKegiatan, foto_url: newFoto })
                }).then(r => r.json())));
            }

            await Promise.all(promises);
            showMsg('success', 'Laporan berhasil disimpan');
            setShowForm(false); setEditingGroup(null); setSelectedStudentIds([]); setDokumenText('');
            loadData();
        } catch { showMsg('error', 'Gagal menyimpan'); }
        finally { setLoading(false); }
    };

    const handleDelete = async (g: { tanggal: string; kegiatan: string; items: LaporanGuruAsuh[] }) => {
        const c = await Swal.fire({
            title: 'Hapus Kegiatan?', 
            html: `Kegiatan ini terkait dengan <b>${g.items.length} siswa</b>. Yakin ingin menghapus seluruh kegiatan ini?`, 
            icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
        });
        if (!c.isConfirmed) return;
        try {
            const promises = g.items.map(s => fetch(`/api/guru-asuh/laporan?id=${s.id}`, { method: 'DELETE' }));
            await Promise.all(promises);
            showMsg('success', 'Kegiatan berhasil dihapus');
            loadData();
        } catch { showMsg('error', 'Gagal menghapus'); }
    };

    const openEdit = (g: { tanggal: string; kegiatan: string; items: LaporanGuruAsuh[] }) => {
        setEditingGroup(g); setSelectedStudentIds(g.items.map(i => i.guru_asuh_id)); setDokumenText(g.items[0]?.foto_url || ''); setTanggalValue(g.tanggal || new Date().toISOString().split('T')[0]); setShowForm(true);
    };
    const openAdd = () => { setEditingGroup(null); setDokumenText(''); setSelectedStudentIds([]); setTanggalValue(new Date().toISOString().split('T')[0]); setShowForm(true); };

    const siswaOpts = myStudents
        .filter(s => (s.aktif && s.tahun_ajaran === activeTa) || editingGroup?.items.some(i => i.guru_asuh_id === s.id))
        .map(s => ({ value: s.id, label: `${s.nama_siswa} (${s.kelas})` }));

    // "Siswa Asuh" di kartu statistik = hanya siswa aktif di tahun ajaran berjalan.
    // myStudents sendiri berisi semua tahun ajaran (fetch pakai tahun_ajaran=Semua)
    // supaya laporan lama lintas tahun tetap bisa difilter di dropdown toolbar.
    const activeStudentsCount = myStudents.filter(s => s.aktif && s.tahun_ajaran === activeTa).length;

    const availableYears = (() => {
        if (!activeTa) return [new Date().getFullYear()];
        const parts = activeTa.split('/');
        const years = parts.map(p => parseInt(p, 10)).filter(y => !isNaN(y));
        if (years.length === 0) return [new Date().getFullYear()];
        return Array.from(new Set(years)).sort();
    })();

    return (
        <div className="gal__wrap">
            {toast && (
                <div className={`gal__toast gal__toast--${toast.type}`}>
                    <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Stats */}
            <div className="gal__statsGrid">
                <div className="gal__statCard gal__statTotal">
                    <div className="gal__statNum">{new Set(laporanList.map(l => `${l.tanggal}|${l.kegiatan}`)).size}</div>
                    <div className="gal__statLbl">Total Laporan</div>
                </div>
                <div className="gal__statCard gal__statFiltered">
                    <div className="gal__statNum">{groupedList.length}</div>
                    <div className="gal__statLbl">Tampil</div>
                </div>
                <div className="gal__statCard">
                    <div className="gal__statNum">{activeStudentsCount}</div>
                    <div className="gal__statLbl">Siswa Asuh</div>
                </div>
            </div>

            {/* Toolbar */}
            <FilterToolbar actionsInline>
                <FilterSelect
                    label="Bulan"
                    icon="calendar3"
                    value={String(selectedMonth)}
                    onChange={v => setSelectedMonth(parseInt(v))}
                    options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))}
                />
                <FilterSelect
                    label="Tahun"
                    icon="mortarboard"
                    value={String(selectedYear)}
                    onChange={v => setSelectedYear(v === 'ALL' ? 'ALL' : parseInt(v))}
                    options={[
                        { value: 'ALL', label: 'Semua Tahun' },
                        ...availableYears.map(y => ({ value: String(y), label: String(y) })),
                    ]}
                />
                <FilterSelect
                    label="Siswa"
                    icon="person"
                    value={filterStudent}
                    onChange={setFilterStudent}
                    options={[
                        { value: '', label: 'Semua Siswa' },
                        ...myStudents.filter(s => s.aktif && s.tahun_ajaran === activeTa).map(s => ({ value: String(s.id), label: `${s.nama_siswa} (${s.kelas})` })),
                    ]}
                />
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari kegiatan / siswa..."
                />
                <FilterActions>
                    <Button variant="secondary" icon="pratinjau" className="desktop-only" onClick={handlePratinjau} disabled={laporanList.length === 0 || loadingPreview} isLoading={loadingPreview}>
                        Pratinjau
                    </Button>
                    <Button variant="secondary" icon="cetak" className="desktop-only" onClick={handleCetakPdf} disabled={submission?.status !== 'Approved' || printingPdf} isLoading={printingPdf} title={submission?.status !== 'Approved' ? 'Cetak PDF hanya bisa dilakukan setelah laporan disahkan oleh WKM Keasramaan' : ''}>
                        Cetak
                    </Button>
                    {selectedYear === 'ALL' ? (
                        <span className="gal__statusBadge gal__statusBadge--pending desktop-only"><i className="bi bi-info-circle-fill" /> Pilih tahun spesifik</span>
                    ) : submission?.status === 'Approved' ? (
                        null
                    ) : submission?.status === 'Submitted' ? (
                        <div className="desktop-only" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="gal__statusBadge gal__statusBadge--pending"><i className="bi bi-hourglass-split" /> Menunggu WKM</span>
                            <Button variant="outline" onClick={handleBatalkan} isLoading={submitting} leftIcon={<i className="bi bi-x-circle" />}>
                                Batal Ajukan
                            </Button>
                        </div>
                    ) : submission?.status === 'Revisi' ? (
                        <span className="gal__statusBadge gal__statusBadge--revisi desktop-only"><i className="bi bi-exclamation-triangle-fill" /> Revisi</span>
                    ) : (
                        <Button variant="primary" icon="ajukan" className="desktop-only" onClick={handleAjukan} isLoading={submitting} disabled={submitting || laporanList.length === 0}>
                            Ajukan
                        </Button>
                    )}

                    <div className="sk__more mobile-only" ref={actionMenuRef}>
                        <button
                            type="button"
                            className="ui-btn ftb-btn-icon-mobile"
                            onClick={() => setShowActionMenu(v => !v)}
                            title="Menu Aksi"
                            aria-label="Menu Aksi"
                        >
                            <i className="bi bi-three-dots" />
                        </button>
                        {showActionMenu && (
                            <div className="sk__moreMenu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={laporanList.length === 0 || loadingPreview}
                                    onClick={() => { setShowActionMenu(false); handlePratinjau(); }}
                                >
                                    <span className="sk__menuIcon"><i className="bi bi-eye" style={{ color: '#3083FF' }} /></span>
                                    <span className="sk__menuLabel">Pratinjau Laporan</span>
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={submission?.status !== 'Approved' || printingPdf}
                                    onClick={() => { setShowActionMenu(false); handleCetakPdf(); }}
                                >
                                    <span className="sk__menuIcon"><i className="bi bi-file-earmark-pdf" style={{ color: '#10b981' }} /></span>
                                    <span className="sk__menuLabel">Cetak PDF</span>
                                </button>
                                {selectedYear !== 'ALL' && !submission?.status && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={submitting || laporanList.length === 0}
                                        onClick={() => { setShowActionMenu(false); handleAjukan(); }}
                                    >
                                        <span className="sk__menuIcon"><i className="bi bi-send-fill" style={{ color: '#3083FF' }} /></span>
                                        <span className="sk__menuLabel">Ajukan Laporan</span>
                                    </button>
                                )}
                                {submission?.status === 'Submitted' && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={submitting}
                                        onClick={() => { setShowActionMenu(false); handleBatalkan(); }}
                                        className="danger"
                                    >
                                        <span className="sk__menuIcon"><i className="bi bi-x-circle" style={{ color: '#ef4444' }} /></span>
                                        <span className="sk__menuLabel">Batal Ajukan</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </FilterActions>
            </FilterToolbar>

            <DesktopFab
                label="Tambah Laporan"
                icon="plus-lg"
                onClick={openAdd}
            />
            <MobileFab
                label="Tambah Laporan"
                icon="plus-lg"
                onClick={openAdd}
            />

            {submission?.status === 'Revisi' && (
                <div className="gal__revisiBanner">
                    <div className="gal__revisiContent">
                        <i className="bi bi-exclamation-triangle-fill" />
                        <div>
                            <strong>Laporan dikembalikan oleh WKM Keasramaan.</strong>
                            <p>{submission.catatan_reviewer || 'Silakan perbaiki laporan dan ajukan kembali.'}</p>
                        </div>
                    </div>
                    <Button variant="primary" onClick={handleAjukan} isLoading={submitting} disabled={submitting || laporanList.length === 0} leftIcon={<i className="bi bi-send-fill" />}>
                        Ajukan Ulang
                    </Button>
                </div>
            )}

            {/* Content */}
            <div className="gal__content">
                {loading ? (
                    <div className="gal__loading">
                        <Spinner variant="buble" size={18} />
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="gal__empty">
                        <div className="gal__emptyIcon"><i className="bi bi-file-earmark-text" /></div>
                        <h3>Belum Ada Laporan</h3>
                    </div>
                ) : (
                    <>
                        <div className="gal__tableWrap">
                            <table className="gal__table">
                                <thead>
                                    <tr><th style={{ width: '12%' }}>Tanggal</th><th style={{ width: '25%' }}>Siswa / Kelas</th><th>Kegiatan</th><th className="gal__thRight" style={{ width: '12%', minWidth: '120px' }}>Aksi</th></tr>
                                </thead>
                                <tbody>
                                    {groupedList.map(g => {
                                        const fotoUrl = g.items.find(i => Boolean(i.foto_url))?.foto_url;
                                        const isLocked = Boolean(g.items[0]?.submission_id);
                                        const isApproved = g.items.some(i => i.laporan_guru_asuh_submissions?.status === 'Approved') || (isLocked && submission?.status === 'Approved');

                                        return g.items.map((l, idx) => (
                                            <tr key={l.id}>
                                                {idx === 0 && (
                                                    <td className="gal__tdDate" rowSpan={g.items.length}>{formatDate(g.tanggal)}</td>
                                                )}
                                                <td>
                                                    <div className="gal__stuWrap">
                                                        <div>
                                                            <div className="gal__stuName">{l.guru_asuh?.nama_siswa || '-'}</div>
                                                            <div className="gal__stuClass">Kelas {l.guru_asuh?.kelas || '-'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {idx === 0 && (
                                                    <td rowSpan={g.items.length}>
                                                        <div className="gal__keg">{g.kegiatan}</div>
                                                    </td>
                                                )}
                                                {idx === 0 && (
                                                    <td className="gal__tdRight" rowSpan={g.items.length}>
                                                        <ActionGroup align="right">
                                                            {fotoUrl && (
                                                                <ActionButton
                                                                    action="view"
                                                                    icon={<i className="bi bi-eye-fill" />}
                                                                    title="Lihat Foto Kegiatan"
                                                                    onClick={() => setPreviewFileUrl(fotoUrl)}
                                                                />
                                                            )}
                                                            {isLocked ? (
                                                                isApproved ? (
                                                                    <span className="gal__approvedBadge" title="Laporan telah disahkan oleh WKM Keasramaan"><i className="bi bi-patch-check-fill" /> Disahkan</span>
                                                                ) : (
                                                                    <span className="gal__lockBadge" title="Sudah diajukan, tidak bisa diubah"><i className="bi bi-lock-fill" /> Terkunci</span>
                                                                )
                                                            ) : (
                                                                <>
                                                                    <ActionButton action="edit" onClick={() => openEdit(g)} title="Edit" />
                                                                    <ActionButton action="delete" onClick={() => handleDelete(g)} title="Hapus" />
                                                                </>
                                                            )}
                                                        </ActionGroup>
                                                    </td>
                                                )}
                                            </tr>
                                        ));
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="gal__cards">
                            {groupedList.map(g => {
                                const fotoUrl = g.items.find(i => Boolean(i.foto_url))?.foto_url;
                                const isLocked = Boolean(g.items[0]?.submission_id);
                                const isApproved = g.items.some(i => i.laporan_guru_asuh_submissions?.status === 'Approved') || (isLocked && submission?.status === 'Approved');

                                return (
                                    <div key={`${g.tanggal}|${g.kegiatan}`} className="gal__card">
                                        <div className="gal__cardTop">
                                            <div className="gal__cardDate">{formatDate(g.tanggal)}</div>
                                            <ActionGroup align="right">
                                                {fotoUrl && (
                                                    <ActionButton
                                                        action="view"
                                                        icon={<i className="bi bi-eye-fill" />}
                                                        title="Lihat Foto Kegiatan"
                                                        onClick={() => setPreviewFileUrl(fotoUrl)}
                                                    />
                                                )}
                                                {isLocked ? (
                                                    isApproved ? (
                                                        <span className="gal__approvedBadge" title="Laporan telah disahkan oleh WKM Keasramaan"><i className="bi bi-patch-check-fill" /> Disahkan</span>
                                                    ) : (
                                                        <span className="gal__lockBadge" title="Sudah diajukan, tidak bisa diubah"><i className="bi bi-lock-fill" /> Terkunci</span>
                                                    )
                                                ) : (
                                                    <>
                                                        <ActionButton action="edit" onClick={() => openEdit(g)} title="Edit" />
                                                        <ActionButton action="delete" onClick={() => handleDelete(g)} title="Hapus" />
                                                    </>
                                                )}
                                            </ActionGroup>
                                        </div>
                                        <div className="gal__cardKeg">
                                            <div className="gal__cardLbl">Kegiatan</div>
                                            <div className="gal__cardTxt">{g.kegiatan}</div>
                                        </div>
                                        <div className="gal__cardStudents">
                                            {g.items.slice(0, 2).map(l => (
                                                <div key={l.id} className="gal__cardStudentRow">
                                                    <div className="gal__cardBody">
                                                        <div className="gal__cardName">{l.guru_asuh?.nama_siswa || '-'}</div>
                                                        <div className="gal__cardClass">Kelas {l.guru_asuh?.kelas || '-'}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {g.items.length > 2 && (
                                                <button
                                                    type="button"
                                                    className="gal__moreChipBtn"
                                                    onClick={() => setModalStudents({ activityTitle: g.kegiatan, tanggal: g.tanggal, students: g.items })}
                                                >
                                                    <i className="bi bi-people" /> +{g.items.length - 2} lainnya
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {showForm && (
                <Modal size="lg" variant={editingGroup ? 'edit' : 'add'} onClose={() => setShowForm(false)} labelledBy="laporan-form-title">
                    <ModalHeader
                        id="laporan-form-title"
                        icon={editingGroup ? 'pencil-square' : 'file-earmark-plus'}
                        title={editingGroup ? 'Edit Laporan' : 'Laporan Baru'}
                        onClose={() => setShowForm(false)}
                    />
                    <form id="laporanForm" onSubmit={handleSaveLaporan}>
                        <ModalBody className="gal__modalBd">
                            <div className="gal__fg">
                                <MultiSelectDropdown<number>
                                    label="Siswa Asuh"
                                    options={siswaOpts}
                                    value={selectedStudentIds}
                                    onChange={setSelectedStudentIds}
                                    placeholder="Pilih siswa..."
                                    allSelectedText="Semua Siswa Terpilih"
                                    showQuickActions={true}
                                    height="44px"
                                />
                            </div>
                            <div className="gal__fg">
                                <label>Tanggal</label>
                                <DatePicker name="tanggal" value={tanggalValue} onChange={setTanggalValue} required />
                            </div>
                            <div className="gal__fg">
                                <label>Kegiatan</label>
                                <textarea name="kegiatan" className="gal__fi gal__fi--ta"
                                    defaultValue={editingGroup?.kegiatan} placeholder="Jelaskan kegiatan..." required />
                            </div>
                            <div className="gal__fg">
                                <label>Foto Kegiatan</label>
                                {dokumenText ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--n-border)', background: 'var(--n-surface)' }}>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--n-primary)', fontWeight: 600, fontSize: '0.85rem' }} onClick={() => setPreviewFileUrl(dokumenText)}>
                                            <i className="bi bi-image" style={{ fontSize: '1.1rem' }}></i> Lihat Foto Kegiatan
                                        </div>
                                        <button type="button" onClick={() => setDokumenText('')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center' }} title="Hapus foto">
                                            <i className="bi bi-x-circle-fill"></i>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="gal__fiRow" style={{ display: 'flex', gap: '8px' }}>
                                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} accept="image/*" />
                                        <button type="button" className="gal__upbtn" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, width: 'auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {uploading ? <Spinner variant="buble" size={14} /> : <><i className="bi bi-folder2-open" /> Penyimpanan</>}
                                        </button>
                                        
                                        <input type="file" ref={camInputRef} style={{ display: 'none' }} onChange={handleFileUpload} accept="image/*" capture="environment" />
                                        <button type="button" className="gal__upbtn" onClick={() => camInputRef.current?.click()} style={{ flex: 1, width: 'auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {uploading ? <Spinner variant="buble" size={14} /> : <><i className="bi bi-camera-fill" /> Kamera</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </ModalBody>
                    </form>
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => setShowForm(false)} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button type="submit" form="laporanForm" variant="primary" isLoading={uploading} leftIcon={<i className="bi bi-check-lg" />}>Simpan</Button>
                    </ModalFooter>
                </Modal>
            )}

            {previewHtml && (
                <HtmlPreviewModal html={previewHtml} title="Pratinjau Laporan Guru Asuh" onClose={() => setPreviewHtml(null)} />
            )}

            {previewFileUrl && (
                <Modal size="xl" className="gal__filePreview" onClose={() => setPreviewFileUrl(null)} labelledBy="file-preview-title">
                    <ModalHeader id="file-preview-title" icon="image" title="Foto Dokumentasi Kegiatan" onClose={() => setPreviewFileUrl(null)} />
                    <ModalBody className="gal__modalBd" >
                            {previewFileUrl?.match(/\.(jpeg|jpg|gif|png|webp|bmp)($|\?)/i) || !previewFileUrl?.match(/\.pdf($|\?)/i) ? (
                                <img src={getProxiedImageUrl(previewFileUrl)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Foto Dokumentasi Kegiatan" />
                            ) : (
                                <iframe src={previewFileUrl} style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }} title="Pratinjau Dokumen" />
                            )}
                    </ModalBody>
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => setPreviewFileUrl(null)} leftIcon={<i className="bi bi-x-lg" />}>Tutup</Button>
                    </ModalFooter>
                </Modal>
            )}

            {modalStudents && (
                <Modal
                    open={true}
                    onClose={() => setModalStudents(null)}
                    size="sm"
                    title="Daftar Siswa Bimbingan"
                    subtitle={`${new Date(modalStudents.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · ${modalStudents.students.length} Siswa`}
                    icon="people"
                >
                    <ModalBody>
                        <div className="gal__modalStudentsContent">
                            <div className="gal__modalKegiatan">
                                <span className="gal__modalKegiatanLabel">Kegiatan</span>
                                <p className="gal__modalKegiatanText">{modalStudents.activityTitle}</p>
                            </div>
                            <div className="gal__modalList">
                                {modalStudents.students.map((e, idx) => (
                                    <div key={e.id || idx} className="gal__modalItem">
                                        <span className="gal__modalItemNum">{idx + 1}</span>
                                        <div className="gal__modalItemInfo">
                                            <span className="gal__modalItemName">{e.guru_asuh?.nama_siswa || '-'}</span>
                                            <span className="gal__modalItemClass">Kelas {e.guru_asuh?.kelas || '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" onClick={() => setModalStudents(null)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .gal__wrap { display: flex; flex-direction: column; gap: 16px; animation: galFadeIn 0.3s ease-out; }
                @keyframes galFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

                /* Toast */
                .gal__toast { position: fixed; bottom: 28px; right: 28px; padding: 14px 22px; border-radius: 14px; font-weight: 700; font-size: 0.88rem; box-shadow: 0 8px 30px rgba(0,0,0,0.18); z-index: 9999; display: flex; align-items: center; gap: 10px; animation: galToastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(8px); }
                @keyframes galToastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
                .gal__toast--success { background: rgba(16,185,129,0.92); color: white; border: 1px solid rgba(255,255,255,0.2); }
                .gal__toast--error { background: rgba(239,68,68,0.92); color: white; border: 1px solid rgba(255,255,255,0.2); }

                /* Stats */
                .gal__statsGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
                .gal__statCard { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--n-border); background: var(--n-card); text-align: left; transition: all 0.2s; }
                .gal__statCard:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                .gal__statNum { font-size: 1.45rem; font-weight: 900; color: var(--n-primary); line-height: 1; }
                .gal__statTotal .gal__statNum { color: var(--n-primary); }
                .gal__statFiltered .gal__statNum { color: #10b981; }
                .gal__statLbl { font-size: 0.72rem; font-weight: 700; color: var(--n-muted); margin-top: 0; line-height: 1.2; }

                /* Toolbar */
                .gal__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
                .gal__select-group { position: relative; display: flex; align-items: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 0 12px; gap: 8px; min-height: 42px; transition: all 0.2s; }
                .gal__select-group i { font-size: 0.9rem; color: var(--n-muted); flex-shrink: 0; }
                .gal__select-group select { flex: 1; border: none; background: transparent; padding: 10px 28px 10px 4px; font-size: 0.85rem; font-weight: 600; color: var(--n-ink); outline: none; appearance: none; -webkit-appearance: none; -moz-appearance: none; cursor: pointer; text-overflow: ellipsis; white-space: nowrap; }
                .gal__select-group--auto { flex: 1 1 auto; min-width: 120px; max-width: 160px; }
                .gal__select-group--flex { flex: 1.5 1 auto; min-width: 160px; max-width: 260px; }
                .gal__actions { display: flex; gap: 6px; flex-shrink: 0; }
                .gal__btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 12px; font-size: 0.82rem; font-weight: normal; cursor: pointer; transition: all 0.2s; white-space: nowrap; border: 1px solid var(--n-border); }
                .gal__btn--ghost { background: var(--n-card); color: var(--n-muted); }
                .gal__btn--ghost:hover { background: var(--n-border); color: var(--n-ink); }
                .gal__btn--outline { background: transparent; color: var(--n-muted); }
                .gal__btn--outline:hover { background: var(--n-soft); }
                .gal__btn--primary { background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%))); color: white; border: none; box-shadow: 0 4px 12px rgba(194,24,91,0.25); }
                .gal__btn--primary:hover { filter: brightness(1.05); transform: translateY(-1px); }
                .gal__spin { animation: galSpin 1s linear infinite; }
                @keyframes galSpin { to { transform: rotate(360deg); } }

                /* Status badge & lock */
                .gal__statusBadge { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 12px; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
                .gal__statusBadge--approved { background: transparent; color: #2563eb; border: none; padding: 0; }
                .gal__statusBadge--pending { background: #eff6ff; color: #1d4ed8; }
                .gal__statusBadge--revisi { background: #fee2e2; color: #dc2626; }
                .gal__lockBadge { display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; color: var(--n-muted); white-space: nowrap; }
                .gal__approvedBadge { display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; color: #2563eb; white-space: nowrap; }
                .gal__revisiBanner { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-radius: 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
                .gal__revisiContent { display: flex; align-items: flex-start; gap: 10px; flex: 1; }
                .gal__revisiContent > i { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
                .gal__revisiContent > div { flex: 1; }
                .gal__revisiBanner strong { display: block; font-size: 0.85rem; margin-bottom: 2px; }
                .gal__revisiBanner p { margin: 0; font-size: 0.8rem; line-height: 1.5; }
                :global(.dark) .gal__btn--ghost,
                :global(.dark) .gal__btn--outline { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #ffffff !important; border-radius: 12px !important; }
                :global(.dark) .gal__btn--ghost:hover,
                :global(.dark) .gal__btn--outline:hover { background: rgba(26, 115, 232, 0.12) !important; border-color: #60a5fa !important; color: #60a5fa !important; }
                :global(.dark) .gal__approvedBadge { color: #60a5fa !important; }
                :global(.dark) .gal__statusBadge--revisi { background: rgba(239, 68, 68, 0.14) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .gal__statusBadge--approved { background: rgba(59, 130, 246, 0.14) !important; color: #60a5fa !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .gal__statusBadge--pending { background: rgba(245, 158, 11, 0.14) !important; color: #fbbf24 !important; border: 1px solid rgba(245, 158, 11, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .gal__revisiBanner { background: rgba(220,38,38,0.1); border-color: rgba(220,38,38,0.3); color: #fca5a5; }

                @media (max-width: 800px) {
                    .gal__revisiBanner { flex-direction: column; align-items: stretch; gap: 12px; padding: 14px; }
                    .gal__revisiContent { width: 100%; }
                    .gal__revisiBanner :global(.ui-btn),
                    .gal__revisiBanner button { width: 100% !important; justify-content: center; height: 38px; }

                    .gal__sel, .gal__btn, .gal__statusBadge { font-size: 0.7rem; font-weight: normal; height: 36px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; }
                    .gal__sel { font-size: 0.7rem !important; }
                    .gal__filters { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; }
                    .gal__actions { width: 100%; display: flex; flex-wrap: nowrap; gap: 4px; overflow-x: auto; padding-bottom: 2px; }
                    .gal__actions::-webkit-scrollbar, .gal__filters::-webkit-scrollbar { display: none; }
                    .gal__btn, .gal__statusBadge { flex: 1 1 auto; white-space: nowrap; gap: 5px; padding: 0 8px; }
                    .gal__btn i, .gal__statusBadge i { font-size: 0.8rem; }
                    
                    .gal__statsGrid { gap: 8px; }
                    .gal__statCard { padding: 8px; flex-direction: column; gap: 4px; text-align: center; border-radius: 12px; }
                    .gal__statNum { font-size: 1.3rem; }
                    .gal__statLbl { font-size: 0.62rem; text-transform: capitalize; }
                }

                /* Loading */
                .gal__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px; color: var(--n-muted); }
                .gal__spinner { width: 36px; height: 36px; border: 3px solid var(--n-border); border-top-color: var(--n-primary); border-radius: 50%; animation: galSpin 0.8s linear infinite; }

                /* Empty */
                .gal__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 48px 24px; text-align: center; }
                .gal__emptyIcon { font-size: 2.8rem; color: var(--n-muted); opacity: 0.4; display: flex; align-items: center; justify-content: center; }
                .gal__empty h3 { font-size: 0.95rem; font-weight: 700; color: var(--n-muted); margin: 0; }

                /* Table */
                .gal__tableWrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); }
                .gal__table { width: 100%; border-collapse: collapse; }
                .gal__table th { padding: 12px 18px; text-align: left; font-size: 0.72rem; font-weight: 500; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; border-bottom: 1px solid var(--n-border); }
                .gal__table td { padding: 14px 18px; border-bottom: 1px solid var(--n-border); font-size: 0.85rem; color: var(--n-ink); vertical-align: middle; }
                .gal__table tr:last-child td { border-bottom: none; }
                .gal__table td[rowspan] { vertical-align: top; padding-top: 16px; }
                .gal__tdDate { white-space: nowrap; color: var(--n-muted); font-weight: 500; }
                .gal__stuWrap { display: flex; align-items: center; gap: 10px; }
                .gal__stuAvatar { width: 36px; height: 36px; border-radius: 10px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; display: flex; align-items: center; justify-content: center; color: #1a73e8; font-weight: 600; font-size: 0.9rem; flex-shrink: 0; }
                .gal__stuName { font-weight: 500; color: var(--n-ink); }
                .gal__stuClass { font-size: 0.7rem; color: var(--n-muted); }
                .gal__keg { font-weight: 500; color: var(--n-ink); margin-bottom: 2px; }
                .gal__thRight, .gal__tdRight { text-align: right; }
                .gal__rowAct { display: flex; gap: 6px; justify-content: flex-end; }

                /* Icon Button */
                .gal__ibtn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--n-border); background: var(--n-card); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; transition: all 0.15s; color: var(--n-primary); }
                .gal__ibtn:hover { background: var(--n-primary); color: white; border-color: var(--n-primary); }
                .gal__ibtn--danger { color: #ef4444; }
                .gal__ibtn--danger:hover { background: #ef4444; color: white; border-color: #ef4444; }

                /* Mobile Cards */
                .gal__cards { display: none; flex-direction: column; gap: 10px; }
                .gal__card { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; transition: box-shadow 0.2s; }
                .gal__card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.07); transform: translateY(-1px); }
                .gal__cardTop { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed var(--n-border); padding-bottom: 12px; margin-bottom: 4px; }
                .gal__cardAvatar { width: 36px; height: 36px; border-radius: 10px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; display: flex; align-items: center; justify-content: center; color: #1a73e8; font-weight: 600; font-size: 0.9rem; flex-shrink: 0; }
                .gal__cardBody { flex: 1; }
                .gal__cardName { font-size: 0.86rem; font-weight: 500; color: var(--n-ink); }
                .gal__cardClass { font-size: 0.7rem; color: var(--n-muted); }
                .gal__cardDate { font-size: 0.68rem; font-weight: 500; color: var(--n-primary); white-space: nowrap; }
                .gal__cardKeg { display: flex; flex-direction: column; gap: 3px; }
                .gal__cardLbl { font-size: 0.62rem; font-weight: 500; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.04em; }
                .gal__cardTxt { font-size: 0.83rem; color: var(--n-ink); line-height: 1.5; }
                .gal__cardStudents { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--n-border); padding-top: 10px; }
                .gal__cardStudentRow { display: flex; align-items: center; gap: 10px; }
                .gal__moreChipBtn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(37, 99, 235, 0.08);
                    color: #2563eb;
                    border: 1px dashed rgba(37, 99, 235, 0.4);
                    border-radius: 8px;
                    padding: 6px 12px;
                    font-size: 0.74rem;
                    font-weight: 700;
                    cursor: pointer;
                    width: fit-content;
                    margin-top: 4px;
                    transition: all 0.15s ease;
                }
                .gal__moreChipBtn:hover {
                    background: rgba(37, 99, 235, 0.16);
                    border-color: #2563eb;
                }

                /* Modal Siswa */
                .gal__modalStudentsContent { display: flex; flex-direction: column; gap: 12px; }
                .gal__modalKegiatan { background: var(--n-soft); border: 1px solid var(--n-border); border-radius: 10px; padding: 10px 12px; }
                .gal__modalKegiatanLabel { display: block; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--n-muted); letter-spacing: 0.03em; margin-bottom: 2px; }
                .gal__modalKegiatanText { margin: 0; font-size: 0.82rem; color: var(--n-ink); line-height: 1.4; }
                .gal__modalList { display: flex; flex-direction: column; gap: 8px; max-height: 52vh; overflow-y: auto; padding-right: 2px; }
                .gal__modalItem { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; background: var(--n-card); border: 1px solid var(--n-border); }
                .gal__modalItemNum { width: 22px; height: 22px; border-radius: 6px; background: rgba(37, 99, 235, 0.08); color: #2563eb; font-size: 0.72rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .gal__modalItemInfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
                .gal__modalItemName { font-size: 0.82rem; font-weight: 700; color: var(--n-ink); word-break: break-word; }
                .gal__modalItemClass { font-size: 0.7rem; color: var(--n-muted); font-weight: 500; }
                .gal__cardActions { display: flex; gap: 6px; flex-shrink: 0; }
                .gal__cardActions .gal__ibtn { width: 28px; height: 28px; }

                /* Modal */
                :global(.gal__cb) { appearance: none; -webkit-appearance: none; background: transparent; border: 1px solid var(--n-border); border-radius: 4px; width: 16px; height: 16px; margin-right: 12px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0; }
                :global(.gal__cb:checked) { background: var(--n-primary); border-color: var(--n-primary); }
                .gal__modalBd { display: flex; flex-direction: column; flex: 1; }
                .gal__fg { margin-bottom: 14px; }
                .gal__fg label,
                .gal__fg :global(.uimsel-label) { display: block; font-size: 0.7rem; font-weight: 700; color: var(--n-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
                .gal__fg :global(.uimsel-trigger) { width: 100%; height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--n-border); font-size: 0.88rem; background-color: var(--n-card); color: var(--n-ink); }
                .gal__fi { width: 100%; height: 44px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--n-border); font-size: 0.88rem; background: var(--n-card); color: var(--n-ink); outline: none; transition: border-color 0.2s; }
                .gal__fi:focus { border-color: var(--n-primary); }
                .gal__fi--ta { min-height: 90px; height: auto; resize: vertical; line-height: 1.5; }
                .gal__fiRow { display: flex; gap: 8px; align-items: center; }
                .gal__fi--flex { flex: 1; }
                .gal__upbtn { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-surface); color: var(--n-muted); cursor: pointer; flex-shrink: 0; transition: all 0.2s; margin: 0; padding: 0; display: block; position: relative; }
                .gal__upbtnIcon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
                .gal__upbtn:hover { background: var(--n-border); color: var(--n-primary); }
                :global(.gal__filePreview) { height: min(85vh, 800px); }
                :global(.gal__filePreview) .gal__modalBd { padding: 0; background: #f1f5f9; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }

                /* Dark */
                :global(.dark) .gal__fi,
                :global(.dark) .gal__upbtn,
                :global(.dark) .gal__fg :global(.uimsel-trigger) { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #ffffff !important; }
                :global(.dark) .gal__fg :global(.uimsel-label) { color: #94a3b8 !important; }
                :global(.dark) .gal__upbtn { color: #94a3b8; }
                :global(.dark) .gal__upbtn:hover { border-color: #60a5fa !important; color: #60a5fa; }
                :global(.dark) .gal__statCard { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gal__statNum { color: #60a5fa !important; }
                :global(.dark) .gal__statFiltered .gal__statNum { color: #34d399 !important; }
                :global(.dark) .gal__statLbl { color: #94a3b8 !important; }
                :global(.dark) .gal__select-group {
                    background-color: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gal__select-group i {
                    color: #60a5fa !important;
                }
                :global(.dark) .gal__select-group select {
                    background-color: transparent !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2360a5fa' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 10px center !important;
                    padding-right: 28px !important;
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                    color: #ffffff !important;
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                    cursor: pointer !important;
                }
                :global(.dark) .gal__select-group select option {
                    background-color: #0b1329 !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gal__tableWrap { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gal__table { background: #0b1329 !important; }
                :global(.dark) .gal__table th { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; }
                :global(.dark) .gal__table td { border-bottom-color: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; }
                :global(.dark) .gal__table tr:hover td { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .gal__stuAvatar, :global(.dark) .gal__cardAvatar { background: rgba(26, 115, 232, 0.15) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gal__stuName { color: #ffffff !important; }
                :global(.dark) .gal__keg { color: #ffffff !important; }
                :global(.dark) .gal__ibtn { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gal__card { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gal__cardName { color: #ffffff !important; }
                :global(.dark) .gal__cardTxt { color: #ffffff !important; }
                :global(.dark) .gal__moreChipBtn {
                    background: rgba(59, 130, 246, 0.16) !important;
                    color: #60a5fa !important;
                    border-color: rgba(59, 130, 246, 0.4) !important;
                }
                :global(.dark) .gal__moreChipBtn:hover {
                    background: rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .gal__modalKegiatan { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gal__modalKegiatanLabel { color: #94a3b8 !important; }
                :global(.dark) .gal__modalKegiatanText { color: #f1f5f9 !important; }
                :global(.dark) .gal__modalItem { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .gal__modalItemNum { background: rgba(59, 130, 246, 0.2) !important; color: #60a5fa !important; }
                :global(.dark) .gal__modalItemName { color: #ffffff !important; }
                :global(.dark) .gal__modalItemClass { color: #94a3b8 !important; }

                :global(.dark) .gal__btn,
                :global(.dark) .gal__btn--ghost,
                :global(.dark) .gal__btn--outline,
                :global(.dark) .gal__btn--primary,
                :global(.dark) .gal__btnEmpty {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                    color: #60a5fa !important;
                    font-weight: 600 !important;
                    box-shadow: none !important;
                }
                :global(.dark) .gal__btn i,
                :global(.dark) .gal__btn--ghost i,
                :global(.dark) .gal__btn--outline i,
                :global(.dark) .gal__btn--primary i,
                :global(.dark) .gal__btnEmpty i {
                    color: #60a5fa !important;
                }
                :global(.dark) .gal__btn:hover,
                :global(.dark) .gal__btn--ghost:hover,
                :global(.dark) .gal__btn--outline:hover,
                :global(.dark) .gal__btn--primary:hover,
                :global(.dark) .gal__btnEmpty:hover {
                    background: rgba(26, 115, 232, 0.15) !important;
                    border-color: #60a5fa !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 8px rgba(96, 165, 250, 0.3) !important;
                }
                :global(.dark) .gal__btn:hover i,
                :global(.dark) .gal__btn--ghost:hover i,
                :global(.dark) .gal__btn--outline:hover i,
                :global(.dark) .gal__btn--primary:hover i,
                :global(.dark) .gal__btnEmpty:hover i {
                    color: #ffffff !important;
                }

                /* Responsive */
                @media (max-width: 640px) {
                    .gal__toolbar { flex-direction: column; align-items: stretch; min-width: 0; }
                    .gal__actions { justify-content: center; flex-wrap: wrap; width: 100%; min-width: 0; }
                    .gal__tableWrap { display: none; }
                    .gal__cards { display: flex; }
                    .gal__modalBd { padding: 16px; }
                }
            `}</style>
        </div>
    );
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}