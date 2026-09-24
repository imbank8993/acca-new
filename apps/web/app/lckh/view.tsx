'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentUser } from '@/lib/auth-client';
import Swal from 'sweetalert2';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { hasPermission } from '@/lib/permissions-client';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { renderKopHTML, KOP_CSS } from '@/lib/lckh/print-shared';
import { DesktopFab } from '@/components/ui/DesktopFab';
import './lckh.css';

const swalSuccess = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'success', confirmButtonText: 'OK',
    confirmButtonColor: '#1e3a5f', customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-primary' }
});

const swalError = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'error', confirmButtonText: 'OK',
    confirmButtonColor: '#ef4444', customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-danger' }
});

const swalInfo = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'info', confirmButtonText: 'OK',
    confirmButtonColor: '#0ea5e9', customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-info' }
});

const swalWarning = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'warning', confirmButtonText: 'OK',
    confirmButtonColor: '#f59e0b', customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-warning' }
});

const swalConfirm = (options: {
    title: string; text?: string; icon?: 'warning' | 'question' | 'info';
    confirmText?: string; cancelText?: string; confirmColor?: string;
}) => Swal.fire({
    title: options.title, text: options.text, icon: options.icon || 'warning',
    showCancelButton: true, confirmButtonText: options.confirmText || 'Ya',
    cancelButtonText: options.cancelText || 'Batal',
    confirmButtonColor: options.confirmColor || '#1e3a5f',
    customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-primary', cancelButton: 'swal-btn-cancel' }
});

// ─── Print Helpers ───────────────────────────────────────────────────────────
async function openLembarPengesahan(submissionId: number) {
    try {
        const res = await fetch(`/api/lckh/print/lembar-pengesahan?id=${submissionId}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Gagal mengambil data');

        const d = json.data;
        const isPreview = !d.approval_code || d.approval_code === '-';

        // Build print-ready HTML
        const printHTML = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${isPreview ? '[PREVIEW] ' : ''}Lembar Pengesahan LCKH - ${d.guru_name}</title>
<style>
  @page { size: A4 portrait; margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; color: #000; }
  ${KOP_CSS}
  ${isPreview ? '.preview-banner { background: #dc2626; color: white; text-align: center; padding: 10px 20px; font-weight: bold; font-size: 13pt; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 20px; border-radius: 6px; border: 2px dashed rgba(255,255,255,0.5); }' : ''}
  .title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-top: 10px; text-decoration: underline; letter-spacing: 1px; }
  .subtitle { text-align: center; font-size: 11pt; margin-top: 5px; color: #444; margin-bottom: 10px; }
  .info-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
  .info-table td { padding: 6px 8px; vertical-align: top; font-size: 11pt; }
  .info-table td:first-child { width: 30%; font-weight: bold; }
  .info-table td:nth-child(2) { width: 5%; }
  .summary-list-title { font-size: 12pt; font-weight: bold; margin: 20px 0 8px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 5px; }
  .summary-list { border: 1px solid #000; margin-bottom: 30px; }
  .summary-list-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; font-size: 11pt; border-bottom: 1px solid #ccc; }
  .summary-list-row:last-child { border-bottom: none; }
  .summary-list-row span:first-child { color: #333; }
  .summary-list-row span:last-child { font-weight: bold; font-size: 12pt; }
  .approval-wrap { margin-top: 30px; page-break-inside: avoid; }
  .approval-top { display: flex; justify-content: space-between; }
  .approval-center { display: flex; justify-content: center; margin-top: 30px; }
  .approval-col { width: 42%; text-align: center; display: flex; flex-direction: column; align-items: center; min-height: 140px; }
  .approval-place { font-size: 10pt; margin-bottom: 4px; min-height: 16px; }
  .approval-role { font-size: 10pt; }
  .approval-space { flex: 1; min-height: 60px; }
  .approval-name { font-size: 11pt; font-weight: bold; text-decoration: underline; }
  .approval-nip { font-size: 10pt; margin-top: 2px; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; page-break-inside: avoid; }
  .qr-code { width: 80px; height: 80px; }
  .code-box { display: inline-block; border: 1px solid #000; padding: 5px 15px; font-family: monospace; font-size: 11pt; margin-top: 5px; }
  .code-box-preview { display: inline-block; border: 2px dashed #dc2626; padding: 5px 15px; font-family: monospace; font-size: 11pt; color: #dc2626; font-weight: bold; margin-top: 5px; }
</style>
</head>
<body>
${isPreview ? '<div class="preview-banner">PREVIEW — DOKUMEN INI BELUM DISAHKAN OLEH KEPALA MADRASAH</div>' : ''}
${renderKopHTML(d.profil)}
<div class="title">Lembar Pengesahan</div>
<div class="subtitle">Laporan Capaian Kinerja Harian (LCKH) — Semester ${d.semester} T.A. ${d.tahun_ajaran}</div>

<table class="info-table">
  <tr><td>Periode</td><td>:</td><td>${d.periode}</td></tr>
  <tr><td>Nama Guru</td><td>:</td><td>${d.guru_name}</td></tr>
  <tr><td>NIP</td><td>:</td><td>${d.nip}</td></tr>
  <tr><td>Tanggal Pengajuan</td><td>:</td><td>${d.submitted_at}</td></tr>
</table>

<div class="summary-list-title">Rekapitulasi Capaian Kinerja</div>
<div class="summary-list">
  <div class="summary-list-row"><span>Total Jam Mengajar</span><span>${d.total_jam}</span></div>
  <div class="summary-list-row"><span>Jurnal Terisi</span><span>${d.total_jurnal}</span></div>
  <div class="summary-list-row"><span>Input Nilai</span><span>${d.total_nilai}</span></div>
  <div class="summary-list-row"><span>Tugas Tambahan</span><span>${d.total_tugas}</span></div>
</div>

<div class="approval-wrap">
  <div class="approval-top">
    <div class="approval-col">
      <div class="approval-place">&nbsp;</div>
      <div class="approval-role">Divalidasi,</div>
      <div class="approval-role">${d.waka_jabatan}</div>
      <div class="approval-space"></div>
      <div class="approval-name">${d.waka_name}</div>
      <div class="approval-nip">NIP. ${d.waka_nip}</div>
    </div>
    <div class="approval-col">
      <div class="approval-place">${d.kota ? d.kota + ', ' : ''}${d.submitted_at && d.submitted_at !== '-' ? d.submitted_at : d.today}</div>
      <div class="approval-role">Dibuat oleh,</div>
      <div class="approval-role">Guru Mata Pelajaran</div>
      <div class="approval-space"></div>
      <div class="approval-name">${d.guru_name}</div>
      <div class="approval-nip">NIP. ${d.guru_nip}</div>
    </div>
  </div>
  <div class="approval-center">
    <div class="approval-col">
      <div class="approval-place">${d.kota ? d.kota + ', ' : ''}${d.kamad_date && d.kamad_date !== '-' ? d.kamad_date : ''}</div>
      <div class="approval-role">Mengesahkan,</div>
      <div class="approval-role">Kepala Madrasah</div>
      <div class="approval-space"></div>
      <div class="approval-name">${d.kamad_name}</div>
      <div class="approval-nip">NIP. ${d.kamad_nip}</div>
    </div>
  </div>
</div>

<div class="footer">
  <div style="display: flex; gap: 15px; align-items: center;">
    ${d.qr_code ? `<img src="${d.qr_code}" class="qr-code" alt="QR Verifikasi" />` : ''}
    <div>
      <div>Kode Verifikasi Approval:</div>
      <div class="${isPreview ? 'code-box-preview' : 'code-box'}">${d.approval_code || 'BELUM ADA'}</div>
    </div>
  </div>
  <div style="text-align: right; color: #666; font-size: 9pt;">
    Dicetak pada ${d.today}
  </div>
</div>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
        if (w) {
            w.document.write(printHTML);
            w.document.close();
            setTimeout(() => w.print(), 500);
        }
    } catch (e: any) {
        swalError('Gagal', e.message);
    }
}

function openLampiranPrint(submissionId: number) {
    // Buka halaman print di tab penuh; halaman memicu window.print() sendiri setelah
    // data selesai dimuat. Jangan panggil w.print() di sini — print() memblokir event
    // loop sehingga fetch data pada halaman tidak akan pernah selesai ("stuck memuat").
    window.open(`/lckh/print-lampiran?id=${submissionId}`, '_blank');
}

export default function LckhPage() {
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);

    const isAdmin = userData?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN') || false;
    const canDo = (action: string) => {
        return hasPermission(userData?.permissions || [], 'lckh', action, isAdmin);
    };

    const [periods, setPeriods] = useState<any[]>([]);
    const [submissionsList, setSubmissionsList] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [catatan, setCatatan] = useState('');

    const [modules, setModules] = useState([
        { id: 'JURNAL', label: 'Ringkasan Jurnal Mengajar', desc: 'Jurnal KBM & agenda kelas selama periode.', checked: true, count: 0, icon: 'bi-journal-check', type: 'journal' },
        { id: 'ABSENSI', label: 'Rekap Absensi Siswa', desc: 'Matriks kehadiran siswa per kelas per bulan.', checked: true, count: 0, icon: 'bi-person-check', type: 'absensi' },
        { id: 'NILAI', label: 'Daftar Nilai', desc: 'Kolom penilaian yang diinput semester berjalan.', checked: false, count: 0, icon: 'bi-patch-check', type: 'nilai' },
        { id: 'TUGAS', label: 'Tugas Tambahan', desc: 'Capaian tugas tambahan / jabatan yang diemban.', checked: false, count: 0, icon: 'bi-briefcase', type: 'tugas' },
    ]);
    const [previewModule, setPreviewModule] = useState<string | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [nilaiDetailModal, setNilaiDetailModal] = useState<{
        open: boolean;
        loading: boolean;
        data: any;
        error: string | null;
    }>({
        open: false,
        loading: false,
        data: null,
        error: null
    });

    // Track any modal open state for blur effect
    const isAnyModalOpen = previewModule !== null || createModalOpen || nilaiDetailModal.open;
    const { openModal, closeModal } = useModalBlur();

    useEffect(() => {
        if (isAnyModalOpen) {
            openModal();
        } else {
            closeModal();
        }
    }, [isAnyModalOpen]);

    useEffect(() => {
        const init = async () => {
            const uData = await getCurrentUser();
            if (uData) {
                setUser({ id: uData.auth_id, email: uData.email, user_metadata: { role: uData.role, username: uData.username } });
                setUserData(uData);

                // Fetch ALL periods via API
                try {
                    const pRes = await fetch('/api/lckh/periods');
                    const pJson = await pRes.json();
                    if (pJson.ok && pJson.data) setPeriods(pJson.data);
                } catch { }

                if (uData?.nip) {
                    fetchSubmissionsList(uData.nip);
                }
            }
        };
        init();
    }, []);

    const fetchSubmissionsList = async (nip: string) => {
        try {
            const res = await fetch(`/api/lckh/submissions?nip=${encodeURIComponent(nip)}`);
            const json = await res.json();
            if (json.ok && json.data) setSubmissionsList(json.data);
        } catch { }
    };

    useEffect(() => {
        if (userData && selectedPeriod) {
            fetchSubmissionDetail(userData.nip, selectedPeriod);
        } else {
            setSubmission(null);
            setSummary(null);
            setCatatan('');
        }
    }, [userData, selectedPeriod]);

    const fetchSubmissionDetail = async (nip: string, pCode: string) => {
        setLoading(true);

        // Find period metadata (tgl_awal / tgl_akhir)
        const p = periods.find(per => per.periode_kode === pCode);

        let data = null;
        try {
            const res = await fetch(`/api/lckh/submissions?nip=${encodeURIComponent(nip)}&periode_kode=${encodeURIComponent(pCode)}`);
            const json = await res.json();
            if (json.ok && json.data && json.data.length > 0) {
                data = json.data[0];
            }
        } catch { }

        if (data) {
            // Existing submission — load from saved snapshot
            setSubmission(data);

            let fullData: any = {
                total_jam_mengajar: data.snap_total_jam_mengajar,
                total_jurnal_isi: data.snap_ringkasan_umum?.total_jurnal_isi || 0,
                total_nilai_input: data.snap_ringkasan_umum?.total_nilai_input || 0,
                total_tugas: data.snap_ringkasan_umum?.total_tugas || (data.lampiran_tugas?.length || 0),
                rekap_absensi_siswa: data.lampiran_absensi || [],
                detail_jurnal: data.lampiran_jurnal || [],
                detail_tugas: data.lampiran_tugas || [],
                detail_nilai: data.lampiran_nilai || [],
                detail_absensi_per_class: [],
            };

            // Also fetch fresh absensi per-class matrix from API
            if (p) {
                try {
                    const res = await fetch(`/api/lckh/summary?startDate=${p.tgl_awal}&endDate=${p.tgl_akhir}&nip=${nip}&month=0&year=0`);
                    const json = await res.json();
                    if (json.ok && json.data.detail_absensi_per_class) {
                        fullData.detail_absensi_per_class = json.data.detail_absensi_per_class;
                    }
                } catch (e) {
                    console.error('Error fetching absensi detail:', e);
                }
            }

            setSummary(fullData);
            setCatatan(data.catatan_guru || '');

            setModules(prev => prev.map(m => {
                if (m.id === 'JURNAL') return { ...m, count: data.snap_ringkasan_umum?.total_jurnal_isi || 0 };
                if (m.id === 'ABSENSI') return { ...m, count: fullData.detail_absensi_per_class?.length || 0 };
                if (m.id === 'NILAI') return { ...m, count: data.snap_ringkasan_umum?.total_nilai_input || 0 };
                if (m.id === 'TUGAS') return { ...m, count: data.lampiran_tugas?.length || 0 };
                return m;
            }));

        } else {
            // NEW period — auto-fetch fresh data from API immediately
            setSubmission(null);
            setSummary(null);
            setCatatan('');
            setModules(prev => prev.map(m => ({ ...m, count: 0 })));

            if (p) {
                try {
                    const res = await fetch(`/api/lckh/summary?startDate=${p.tgl_awal}&endDate=${p.tgl_akhir}&nip=${nip}&month=0&year=0`);
                    const json = await res.json();
                    if (json.ok) {
                        setSummary(json.data);
                        setModules(prev => prev.map(m => {
                            if (m.id === 'JURNAL') return { ...m, count: json.data.total_jurnal_isi || 0 };
                            if (m.id === 'ABSENSI') return { ...m, count: json.data.rekap_absensi_siswa?.length || 0 };
                            if (m.id === 'NILAI') return { ...m, count: json.data.total_nilai_input || 0 };
                            if (m.id === 'TUGAS') return { ...m, count: json.data.total_tugas || 0 };
                            return m;
                        }));
                        // Draft baru: langsung susun ringkasan capaian otomatis
                        syncSummary(json.data);
                    }
                } catch (e) {
                    console.error('Error auto-fetching summary:', e);
                }
            }
        }
        setLoading(false);
    }

    const generateSummary = async () => {
        if (!userData?.nip) {
            swalError('Error', 'Data NIP Anda tidak ditemukan.');
            return;
        }
        const p = periods.find(p => p.periode_kode === selectedPeriod);
        if (!p) return;

        setLoading(true);
        try {
            const startDate = p.tgl_awal;
            const endDate = p.tgl_akhir;
            const res = await fetch(`/api/lckh/summary?startDate=${startDate}&endDate=${endDate}&nip=${userData.nip}&month=0&year=0`);
            const json = await res.json();

            if (json.ok) {
                setSummary(json.data);

                setModules(prev => prev.map(m => {
                    if (m.id === 'JURNAL') return { ...m, count: json.data.total_jurnal_isi || 0 };
                    if (m.id === 'ABSENSI') return { ...m, count: json.data.rekap_absensi_siswa?.length || 0 };
                    if (m.id === 'NILAI') return { ...m, count: json.data.total_nilai_input || 0 };
                    if (m.id === 'TUGAS') return { ...m, count: json.data.total_tugas || 0 };
                    return m;
                }));

                Swal.fire({
                    title: 'Generate Berhasil',
                    html: `
                        <div class="text-left text-sm space-y-2">
                            <p><strong>Periode:</strong> ${json.data.debug?.startDate} s/d ${json.data.debug?.endDate}</p>
                            <hr class="my-2" />
                            <p>Jurnal: <strong>${json.data.total_jurnal_isi}</strong></p>
                            <p>Nilai: <strong>${json.data.total_nilai_input}</strong></p>
                            <p>Tugas: <strong>${json.data.total_tugas}</strong></p>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonText: 'OK',
                    customClass: {
                        popup: 'swal-premium',
                        confirmButton: 'swal-btn-primary'
                    }
                });
                syncSummary(json.data);
            } else {
                throw new Error(json.error);
            }
        } catch (e: any) {
            swalError('Gagal', e.message);
        } finally {
            setLoading(false);
        }
    };

    const [summaryItems, setSummaryItems] = useState<any[]>([]);

    useEffect(() => {
        if (catatan) {
            try {
                if (catatan.startsWith('[{')) {
                    setSummaryItems(JSON.parse(catatan));
                } else if (catatan.includes('|')) {
                    const lines = catatan.split('\n').filter(l => l.includes('|') && !l.includes('---|'));
                    const items = lines.slice(1).map(l => {
                        const parts = l.split('|').map(p => p.trim()).filter(p => p !== '');
                        return {
                            no: parts[0],
                            dateStr: parts[1],
                            activity: parts[2],
                            result: parts[3],
                            note: parts[4]
                        };
                    });
                    setSummaryItems(items);
                }
            } catch (e) {
                console.log('Error parsing catatan:', e);
            }
        } else {
            setSummaryItems([]);
        }
    }, [catatan]);

    const syncSummary = (targetData: any = summary) => {
        if (!targetData) return;

        const journals = targetData.detail_jurnal || [];
        const tasks = targetData.detail_tugas || [];
        const currentName = userData?.nama_lengkap || '';

        let items: any[] = [];

        journals.forEach((j: any) => {
            const isSub = j.guru_pengganti && (j.guru_pengganti.includes(currentName) || j.guru_pengganti.includes(userData?.nip));
            items.push({
                date: new Date(j.tanggal),
                activity: isSub ? `Mengajar di Kelas ${j.kelas} (Guru Pengganti)` : `Mengajar di Kelas ${j.kelas}`,
                result: `KBM ${j.mapel || j.mata_pelajaran || '-'} terlaksana. Materi: ${j.materi || '-'}`,
                note: `Siswa hadir: ${j.jml_hadir || j.H || 0}, Jam ${j.jam_ke}`
            });
        });

        tasks.forEach((t: any) => {
            items.push({
                date: new Date(t.tanggal),
                activity: t.kegiatan || (t.tugas?.jabatan || t.title || 'Tugas Tambahan'),
                result: t.hasil || 'Tugas selesai dilaksanakan',
                note: t.tugas?.jabatan || 'Tugas Tambahan'
            });
        });

        items.sort((a, b) => a.date.getTime() - b.date.getTime());

        const formatted = items.map((it, i) => ({
            no: i + 1,
            dateStr: it.date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            activity: it.activity,
            result: it.result,
            note: it.note
        }));

        setSummaryItems(formatted);
        setCatatan(JSON.stringify(formatted));
    };

    const handleSave = async (isSubmit = false) => {
        if (!summary) return;

        try {
            setLoading(true);
            const p = periods.find(p => p.periode_kode === selectedPeriod);
            const pMeta = p ? { month: new Date(p.tgl_awal).getMonth() + 1, year: new Date(p.tgl_awal).getFullYear() } : { month: 0, year: 0 };

            const payload = {
                user_id: user.id,
                nip: userData.nip,
                nama_guru_snap: userData.nama_lengkap,
                periode_kode: selectedPeriod,
                bulan: pMeta.month,
                tahun: pMeta.year,
                snap_total_jam_mengajar: summary.total_jam_mengajar,
                snap_ringkasan_umum: {
                    total_jurnal_isi: summary.total_jurnal_isi,
                    total_nilai_input: summary.total_nilai_input,
                    total_tugas: summary.total_tugas
                },
                lampiran_absensi: summary.rekap_absensi_siswa,
                lampiran_jurnal: summary.detail_jurnal,
                lampiran_tugas: summary.detail_tugas,
                lampiran_nilai: summary.detail_nilai || [],
                catatan_guru: catatan,
                // Simpan biasa tidak boleh menurunkan status yang sudah diajukan/revisi
                status: isSubmit ? 'Submitted' : (submission?.status || 'Draft'),
                submitted_at: isSubmit ? new Date().toISOString() : (submission?.submitted_at || null)
            };

            const postBody = submission?.id ? { ...payload, id: submission.id } : payload;
            const res = await fetch('/api/lckh/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postBody),
            });
            const resJson = await res.json();
            if (!res.ok || !resJson.ok) throw new Error(resJson.error || 'Gagal menyimpan laporan');

            swalSuccess('Sukses', isSubmit ? 'Laporan berhasil diajukan ke WKM Akademik.' : 'Draft tersimpan.');

            // Refresh submissions list + detail agar status/stepper langsung ter-update
            if (userData?.nip) {
                await fetchSubmissionsList(userData.nip);
                await fetchSubmissionDetail(userData.nip, selectedPeriod);
            }

        } catch (e: any) {
            swalError('Gagal', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!submission) return;

        if (!canDo('create')) {
            swalError('Akses Ditolak', 'Anda tidak memiliki izin untuk menghapus laporan.');
            return;
        }

        const conf = await swalConfirm({
            title: 'Hapus Laporan?',
            text: 'Data draft akan dihapus permanen.',
            icon: 'warning',
            confirmText: 'Hapus',
            confirmColor: '#ef4444'
        });
        if (!conf.isConfirmed) return;

        setLoading(true);
        const delRes = await fetch(`/api/lckh/submissions/${submission.id}`, { method: 'DELETE' });
        const delJson = await delRes.json();
        setLoading(false);

        if (delRes.ok && delJson.ok) {
            swalSuccess('Terhapus', 'Laporan dihapus.');
            setSubmission(null);
            setSummary(null);
            if (userData?.nip) fetchSubmissionsList(userData.nip);
        } else {
            swalError('Gagal', delJson.error || 'Gagal menghapus laporan.');
        }
    };

    const handleCreateNew = () => {
        const existingCodes = submissionsList.map(s => s.periode_kode);
        const available = periods.filter(p => !existingCodes.includes(p.periode_kode));

        if (available.length === 0) {
            swalInfo('Info', 'Semua periode sudah ada laporannya.');
            return;
        }

        // Open custom modal for period selection
        setCreateModalOpen(true);
    };

    const handlePeriodSelect = async (periodCode: string) => {
        // Extra check: prevent selecting periods with existing submissions
        const alreadyHasSubmission = submissionsList.some(s => s.periode_kode === periodCode);
        if (alreadyHasSubmission) {
            swalInfo('Info', 'LCKH untuk periode ini sudah pernah diajukan.');
            return;
        }

        setCreateModalOpen(false);

        const year = periodCode.split('-')[0];
        const month = parseInt(periodCode.split('-')[1]);
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const monthName = monthNames[month - 1];

        // Calculate correct start and end dates
        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDateObj = new Date(parseInt(year), month, 0); // last day of month
        const endDateStr = endDateObj.toISOString().split('T')[0]; // e.g. 2026-04-30

        setLoading(true);
        try {
            // Upsert: INSERT if not exists, UPDATE tgl_awal/tgl_akhir if exists (fix wrong dates)
            const res = await fetch('/api/lckh/periods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    periode_kode: periodCode,
                    periode_nama: `${monthName} ${year}`,
                    tgl_awal: startDateStr,
                    tgl_akhir: endDateStr,
                    status_periode: 'OPEN'
                })
            });
            const resJson = await res.json().catch(() => ({}));
            if (!res.ok && resJson.error) throw new Error(resJson.error);

            // Refresh periods list so UI has correct dates
            const pRes = await fetch('/api/lckh/periods');
            const pJson = await pRes.json();
            if (pJson.ok && pJson.data) setPeriods(pJson.data);

        } catch (e: any) {
            swalError('Error', `Gagal membuat periode: ${e.message}`);
            setLoading(false);
            return;
        }
        setLoading(false);

        setSelectedPeriod(periodCode);
    };

    const handleCloseCreateModal = () => {
        setCreateModalOpen(false);
    };

    const currentPeriodObj = periods.find(p => p.periode_kode === selectedPeriod);

    // Laporan masih bisa diubah selama belum masuk proses persetujuan final
    const isEditable = !submission || ['Draft', 'Revisi', 'Submitted'].includes(submission.status);

    const getStatusBadge = (status: string) => {
        const cfg = getStatusConfig(status);
        return <span className={`lckhg-sub-badge ${cfg.cls}`}>{cfg.label}</span>;
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'Approved_Kamad':
                return { cls: 'approved', label: 'Disahkan', icon: 'bi-check-circle-fill', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };
            case 'Approved_Waka':
                return { cls: 'waka-ok', label: 'Kamad', icon: 'bi-hourglass-split', color: '#0284c7', bg: 'rgba(2,132,199,0.12)' };
            case 'Submitted':
                return { cls: 'submitted', label: 'WKM', icon: 'bi-hourglass-split', color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' };
            case 'Revisi':
                return { cls: 'revisi', label: 'Revisi', icon: 'bi-exclamation-triangle-fill', color: '#b91c1c', bg: 'rgba(220,38,38,0.1)' };
            default:
                return { cls: 'draft', label: 'Draft', icon: 'bi-pencil', color: 'var(--n-muted)', bg: '#f1f5f9' };
        }
    };

    return (
        <>
        <div className="lckhg">
            {/* Banner header — membentang di atas kedua kolom, gaya halaman Surat */}
            <header className="lckhg-banner">
                <div className="lckhg-banner-title">
                    <button className="lckhg-banner-menu lckhg-mobile-only" onClick={() => setShowSidebar(true)} title="Daftar Laporan">
                        <i className="bi bi-list"></i>
                    </button>
                    <div>
                        <h1>Laporan Capaian Kinerja Harian</h1>
                        <p>
                            {currentPeriodObj
                                ? `${currentPeriodObj.periode_nama} · ${currentPeriodObj.tgl_awal} — ${currentPeriodObj.tgl_akhir}`
                                : selectedPeriod
                                    ? selectedPeriod
                                    : 'Rekap jurnal, absensi, nilai & tugas tambahan tiap bulan'}
                        </p>
                    </div>
                </div>
                {submission?.status && (
                    <div className="lckhg-banner-actions">
                        {submission.status === 'Approved_Kamad' && submission.approval_code && (
                            <div className="lckhg-approval-code">
                                <i className="bi bi-qr-code"></i>
                                <span>{submission.approval_code}</span>
                            </div>
                        )}
                        {getStatusBadge(submission.status)}
                    </div>
                )}
            </header>

            {/* Aksi utama halaman: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
            {canDo('create') && (
                <>
                    <DesktopFab label="Buat LCKH Baru" icon="plus-lg" mobileLabel="LCKH Baru" onClick={() => setCreateModalOpen(true)} />
                </>
            )}

            <div className="lckhg-wrap">

                {/* Sidebar Overlay (mobile) */}
                {showSidebar && (
                    <div className="lckhg-overlay" onClick={() => setShowSidebar(false)} />
                )}

                {/* Left Panel */}
                <aside className={`lckhg-panel-left ${showSidebar ? 'is-open' : ''}`}>
                    <div className="lckhg-pheader">
                        <div className="lckhg-pheader-top">
                            <h2 className="lckhg-pheader-title">Daftar Laporan</h2>
                            <div className="lckhg-pheader-actions">
                                <button onClick={() => setShowSidebar(false)} className="lckhg-btn lckhg-mobile-only" title="Tutup daftar">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="lckhg-list custom-scrollbar">
                        {submissionsList.length === 0 && !selectedPeriod && (
                            <div className="lckhg-list-empty">
                                <i className="bi bi-inbox"></i>
                                Belum ada laporan
                            </div>
                        )}
                        {submissionsList.map(sub => {
                            const pName = periods.find(p => p.periode_kode === sub.periode_kode)?.periode_nama || sub.periode_kode;
                            const isActive = sub.periode_kode === selectedPeriod;
                            const statusCfg = getStatusConfig(sub.status);

                            return (
                                <div
                                    key={sub.id}
                                    onClick={() => setSelectedPeriod(sub.periode_kode)}
                                    className={`submission-item ${isActive ? 'active' : ''}`}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="lckhg-sub-item-name">{pName}</span>
                                        <span className={`lckhg-sub-badge ${statusCfg.cls}`}>
                                            <i className={`bi ${statusCfg.icon}`}></i>
                                            {statusCfg.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--lckhg-text-subtle)' }}>
                                        <i className="bi bi-calendar3"></i>
                                        <span>{new Date(sub.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Draft indicator */}
                        {selectedPeriod && !submissionsList.some(s => s.periode_kode === selectedPeriod) && (
                            <div className="submission-item active">
                                <div className="lckhg-sub-item-name" style={{ color: 'var(--lckhg-accent)' }}>
                                    {periods.find(p => p.periode_kode === selectedPeriod)?.periode_nama || selectedPeriod}
                                </div>
                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--lckhg-accent)' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                                    Draft Baru
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Main Content */}
                <main className={`lckhg-content ${isAnyModalOpen ? 'modal-blur' : ''}`}>
                    {selectedPeriod ? (
                        <>
                            {/* Scroll Body */}
                            <div className="lckhg-body custom-scrollbar">

                                {/* ═══ Level 1 — Hero: status persetujuan & aksi ═══ */}
                                <section className="lckhg-hero animate-slide-up">
                                <ApprovalStepper status={submission?.status || 'Draft'} />

                                {/* Reviewer Alert */}
                                {submission?.catatan_reviewer && (
                                    <div className={`lckhg-reviewer-alert in-hero ${submission.status === 'Revisi' ? 'warning' : 'info'}`}>
                                        <div className="lckhg-reviewer-icon">
                                            <i className={`bi ${submission.status === 'Revisi' ? 'bi-exclamation-triangle-fill' : 'bi-chat-left-text-fill'}`}></i>
                                        </div>
                                        <div>
                                            <div className="lckhg-reviewer-label">
                                                {submission.status === 'Revisi' ? 'PERLU PERBAIKAN' : 'CATATAN REVIEWER'}
                                            </div>
                                            <div className="lckhg-reviewer-text">
                                                {submission.catatan_reviewer}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action bar — pola footer dialog: destruktif+caption di kiri, aksi utama di kanan */}
                                <div className="lckhg-hero-actions">
                                    <div className="lckhg-actions-left">
                                        {isEditable && submission && (
                                            <button
                                                onClick={handleDelete}
                                                disabled={loading}
                                                className="lckhg-btn lckhg-btn-delete"
                                                title="Hapus laporan periode ini"
                                            >
                                                <i className="bi bi-trash3"></i>
                                                <span>Hapus</span>
                                            </button>
                                        )}
                                        {submission?.status === 'Approved_Kamad' ? (
                                            <span className="lckhg-actions-caption ok">
                                                <i className="bi bi-patch-check-fill"></i>
                                                Laporan final & telah disahkan
                                            </span>
                                        ) : submission?.status === 'Approved_Waka' ? (
                                            <span className="lckhg-actions-caption">
                                                <i className="bi bi-shield-lock-fill"></i>
                                                Terkunci — cetak tersedia setelah disahkan Kepala Madrasah
                                            </span>
                                        ) : submission ? (
                                            <span className="lckhg-actions-caption">
                                                <i className="bi bi-lock"></i>
                                                Cetak tersedia setelah disahkan Kepala Madrasah
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="lckhg-toolbar-group">
                                        {isEditable ? (
                                            <>
                                                <button
                                                    onClick={() => handleSave(false)}
                                                    disabled={loading || !canDo('create')}
                                                    className="lckhg-btn"
                                                    title="Simpan tanpa mengajukan"
                                                >
                                                    <i className="bi bi-cloud-arrow-up"></i>
                                                    <span>Simpan Draft</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        swalConfirm({
                                                            title: submission?.status === 'Submitted' ? 'Update Ajuan?' : 'Ajukan LCKH?',
                                                            text: 'Laporan akan dikirim ke WKM Akademik untuk diverifikasi.',
                                                            icon: 'question',
                                                            confirmText: submission?.status === 'Submitted' ? 'Update Sekarang' : 'Ajukan Sekarang'
                                                        }).then(r => { if (r.isConfirmed) handleSave(true); });
                                                    }}
                                                    disabled={loading || !canDo('create')}
                                                    className="lckhg-btn lckhg-btn-primary"
                                                >
                                                    <i className="bi bi-send-check"></i>
                                                    <span>{submission?.status === 'Submitted' ? 'Update Ajuan' : 'Ajukan'}</span>
                                                </button>
                                            </>
                                        ) : submission?.status === 'Approved_Kamad' ? (
                                            <>
                                                <button
                                                    onClick={() => openLembarPengesahan(submission.id)}
                                                    title="Cetak Lembar Pengesahan"
                                                    className="lckhg-btn lckhg-btn-print"
                                                >
                                                    <i className="bi bi-printer-fill"></i>
                                                    <span>Lembar Pengesahan</span>
                                                </button>
                                                <button
                                                    onClick={() => openLampiranPrint(submission.id)}
                                                    title="Cetak Lampiran Data"
                                                    className="lckhg-btn lckhg-btn-print-secondary"
                                                >
                                                    <i className="bi bi-file-earmark-pdf"></i>
                                                    <span>Lampiran Data</span>
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                </section>

                                {/* ═══ Level 2 — Rekap angka periode ═══ */}
                                <div className="lckhg-section-head">
                                    <i className="bi bi-bar-chart-fill"></i>
                                    <span>Rekap Data Periode</span>
                                    {isEditable && (
                                        <button
                                            onClick={generateSummary}
                                            disabled={loading || !canDo('create')}
                                            className="lckhg-section-action"
                                            title="Ambil ulang data jurnal, absensi, nilai & tugas terbaru, lalu susun ulang ringkasan"
                                        >
                                            <i className={`bi bi-arrow-repeat ${loading ? 'animate-spin' : ''}`}></i>
                                            Perbarui Data
                                        </button>
                                    )}
                                </div>
                                <section className="lckhg-stats animate-slide-up">
                                    {[
                                        { label: 'Jam Efektif', value: summary?.total_jam_mengajar || 0, icon: 'bi-clock-history', cls: 'jam' },
                                        { label: 'Jurnal & Agenda', value: summary?.total_jurnal_isi || 0, icon: 'bi-journal-check', cls: 'jurnal' },
                                        { label: 'Input Nilai', value: summary?.total_nilai_input || 0, icon: 'bi-patch-check', cls: 'nilai' },
                                        { label: 'Tugas Tambahan', value: summary?.total_tugas || 0, icon: 'bi-briefcase', cls: 'tugas' },
                                    ].map((s, i) => (
                                        <div key={i} className="lckhg-stat-item">
                                            <div className={`lckhg-stat-ico ${s.cls}`}>
                                                <i className={`bi ${s.icon}`}></i>
                                            </div>
                                            <div className="lckhg-stat-meta">
                                                <div className="lckhg-stat-value">{s.value}</div>
                                                <div className="lckhg-stat-label">{s.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                {/* ═══ Level 2 — Lampiran laporan ═══ */}
                                <div className="lckhg-section-head">
                                    <i className="bi bi-paperclip"></i>
                                    <span>Lampiran Laporan</span>
                                </div>
                                <section className="lckhg-modules">
                                    {modules.map(m => (
                                        <div key={m.id} className="lckhg-module-card">
                                            <div className={`lckhg-module-icon ${m.type}`}>
                                                <i className={`bi ${m.icon}`}></i>
                                            </div>
                                            <div className="lckhg-module-info">
                                                <div className="lckhg-module-title">{m.label}</div>
                                                <div className="lckhg-module-desc">{m.desc}</div>
                                            </div>
                                            <div className="lckhg-module-count">
                                                <div className="lckhg-module-count-val">{m.count}</div>
                                                <div className="lckhg-module-count-lbl">entri</div>
                                            </div>
                                            <div className="lckhg-module-actions">
                                                <button onClick={() => setPreviewModule(m.id)} className="lckhg-btn-detail">
                                                    <i className="bi bi-eye"></i>
                                                    Detail
                                                </button>
                                                <label className="lckhg-toggle" title="Sertakan dalam laporan">
                                                    <input
                                                        type="checkbox"
                                                        checked={m.checked}
                                                        onChange={(e) => setModules(prev => prev.map(mm => mm.id === m.id ? { ...mm, checked: e.target.checked } : mm))}
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                {/* ═══ Level 3 — Isi utama laporan ═══ */}
                                <div className="lckhg-section-head">
                                    <i className="bi bi-file-earmark-text-fill"></i>
                                    <span>Isi Laporan</span>
                                </div>
                                <section className="lckhg-summary">
                                    <div className="lckhg-summary-head">
                                        <h3 className="lckhg-summary-title">
                                            <i className="bi bi-blockquote-left"></i>
                                            Ringkasan Capaian Kinerja
                                        </h3>
                                        <span className="lckhg-summary-count">
                                            <i className="bi bi-list-check"></i>
                                            {summaryItems.length} kegiatan
                                        </span>
                                    </div>
                                    <div className="lckhg-table-wrap">
                                        <table className="table-premium">
                                            <thead>
                                                <tr>
                                                    <th className="w-12 text-center">No</th>
                                                    <th className="w-32">Tanggal</th>
                                                    <th>Nama Kegiatan</th>
                                                    <th>Hasil Capaian</th>
                                                    <th className="w-40">Keterangan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {summaryItems.length > 0 ? (
                                                    summaryItems.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="text-center" style={{ color: 'var(--lckhg-text-subtle)' }}>{item.no}</td>
                                                            <td>{item.dateStr}</td>
                                                            <td>{item.activity}</td>
                                                            <td>{item.result}</td>
                                                            <td>{item.note}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="table-empty">
                                                            <i className="bi bi-table"></i>
                                                            <p>Belum ada data ringkasan</p>
                                                            <span>Klik "Perbarui Data" pada bagian Rekap Data Periode</span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </div>
                        </>
                    ) : (
                        <div className="lckhg-empty-state">
                            <div className="lckhg-empty-icon">
                                <i className="bi bi-calendar-check-fill"></i>
                            </div>
                            <div className="lckhg-empty-title">Belum Ada Periode Dipilih</div>
                            <div className="lckhg-empty-desc">
                                Pilih periode LCKH dari daftar di samping untuk melihat dan mengelola laporan kinerja harian Anda.
                            </div>
                            {canDo('create') && (
                                <button className="lckhg-empty-cta" onClick={() => setCreateModalOpen(true)}>
                                    <i className="bi bi-plus-circle-fill"></i>
                                    Buat LCKH Baru
                                </button>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Modals - Rendered via Portal to escape stacking context */}
            {previewModule && typeof document !== 'undefined' && createPortal(
                <ModulePreviewModal
                    moduleCode={previewModule}
                    data={summary}
                    userData={userData}
                    onClose={() => setPreviewModule(null)}
                    nilaiDetailModal={nilaiDetailModal}
                    setNilaiDetailModal={setNilaiDetailModal}
                />,
                document.body
            )}

            {createModalOpen && typeof document !== 'undefined' && createPortal(
                <PeriodSelectionModal
                    periods={periods}
                    submissionsList={submissionsList}
                    onSelect={handlePeriodSelect}
                    onClose={handleCloseCreateModal}
                />,
                document.body
            )}
            <MaintenanceBanner pageKey="maintenance_lckh" />
        </div>
    </>
    );
}

// Stepper alur persetujuan: Pengajuan → Verifikasi WKM Akademik → Pengesahan Kepala Madrasah
function ApprovalStepper({ status }: { status: string }) {
    const steps = [
        { label: 'Pengajuan Guru', icon: 'bi-send-fill' },
        { label: 'Verifikasi WKM', icon: 'bi-person-check-fill' },
        { label: 'Pengesahan Kepala Madrasah', icon: 'bi-patch-check-fill' },
    ];
    const isRevisi = status === 'Revisi';
    const isDraft = status === 'Draft' || !status;
    // Jumlah langkah yang sudah selesai
    const done = status === 'Approved_Kamad' ? 3
        : status === 'Approved_Waka' ? 2
        : status === 'Submitted' ? 1
        : 0;

    return (
        <div className={`lckhg-stepper ${isRevisi ? 'is-revisi' : ''} ${done === 3 ? 'is-complete' : ''}`}>
            {steps.map((s, i) => {
                const isDone = i < done;
                const isActive = !isRevisi && i === done && done < 3;
                const stateCls = isDone ? 'done' : isActive ? 'active' : 'pending';
                return (
                    <div key={i} className={`lckhg-step ${stateCls}`}>
                        <div className="lckhg-step-head">
                            <div className="lckhg-step-dot">
                                <i className={`bi ${isDone ? 'bi-check-lg' : s.icon}`}></i>
                            </div>
                            <div className="lckhg-step-info">
                                <div className="lckhg-step-label">{s.label}</div>
                                <div className="lckhg-step-sub">
                                    {isDone ? 'Selesai'
                                        : isActive ? (i === 0 && isDraft ? 'Belum diajukan' : 'Sedang diproses')
                                        : isRevisi && i === 0 ? 'Perlu diajukan ulang'
                                        : 'Menunggu'}
                                </div>
                            </div>
                        </div>
                        {i < steps.length - 1 && <div className="lckhg-step-line" />}
                    </div>
                );
            })}
            {isRevisi && (
                <div className="lckhg-stepper-note">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    Dikembalikan untuk revisi
                </div>
            )}
        </div>
    );
}

// Period Selection Modal Component - Free selection, no restrictions
function PeriodSelectionModal({ periods, submissionsList, onSelect, onClose }: any) {
    // Get list of period codes that THIS USER has already submitted
    const mySubmissionCodes = submissionsList.map((s: any) => s.periode_kode);

    // Get current year and next year for options
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    const months = [
        { value: 1, label: 'Januari' },
        { value: 2, label: 'Februari' },
        { value: 3, label: 'Maret' },
        { value: 4, label: 'April' },
        { value: 5, label: 'Mei' },
        { value: 6, label: 'Juni' },
        { value: 7, label: 'Juli' },
        { value: 8, label: 'Agustus' },
        { value: 9, label: 'September' },
        { value: 10, label: 'Oktober' },
        { value: 11, label: 'November' },
        { value: 12, label: 'Desember' },
    ];

    // Check period status for this user
    const getPeriodStatus = (year: number, month: number) => {
        const kode = `${year}-${String(month).padStart(2, '0')}`;
        const periodExists = periods.some((p: any) => p.periode_kode === kode);
        const hasMySubmission = mySubmissionCodes.includes(kode);
        return { kode, periodExists, hasMySubmission };
    };

    const handleSelect = (kode: string, hasMySubmission: boolean) => {
        if (hasMySubmission) {
            return; // Already disabled, shouldn't be clickable
        }
        onSelect(kode);
    };

    return (
        <div className="lckhg-modal-overlay animate-fade-in" onClick={onClose}>
            <div className="lckhg-modal animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="lckhg-modal-head-content">
                        <div className="lckhg-modal-icon blue">
                            <i className="bi bi-calendar-plus"></i>
                        </div>
                        <div className="lckhg-modal-text">
                            <h3>Ajukan LCKH Baru</h3>
                            <span>Pilih bulan dan tahun pengajuan</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="lckhg-modal-close">
                        <i className="bi bi-x-lg"></i>
                    </button>
                </header>

                <div className="lckhg-modal-body custom-scrollbar">
                    <div className="lckhg-period-picker-grid">
                        {years.map(year => (
                            <div key={year} className="lckhg-period-year-section">
                                <div className="lckhg-period-year-title">
                                    <i className="bi bi-calendar3"></i>
                                    {year}
                                </div>
                                <div className="lckhg-period-months-grid">
                                    {months.map(month => {
                                        const { kode, periodExists, hasMySubmission } = getPeriodStatus(year, month.value);

                                        return (
                                            <button
                                                key={`${year}-${month.value}`}
                                                onClick={() => handleSelect(kode, hasMySubmission)}
                                                className={`lckhg-period-month-btn ${hasMySubmission ? 'lckhg-period-taken' : ''}`}
                                                disabled={hasMySubmission}
                                            >
                                                <span className="lckhg-period-month-name">{month.label}</span>
                                                {hasMySubmission ? (
                                                    <span className="lckhg-period-taken">
                                                        <i className="bi bi-check-circle-fill"></i>
                                                        Terbuat
                                                    </span>
                                                ) : periodExists ? (
                                                    <span className="lckhg-period-status-ready">
                                                        <i className="bi bi-circle-fill"></i>
                                                        Siap
                                                    </span>
                                                ) : (
                                                    <span className="lckhg-period-status-new">
                                                        <i className="bi bi-plus-circle"></i>
                                                        Baru
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="lckhg-period-info-box">
                        <i className="bi bi-info-circle"></i>
                        <div>
                            <p><strong>Cara Kerja:</strong></p>
                            <ul>
                                <li>Pilih bulan dan tahun pengajuan LCKH</li>
                                <li>Sistem akan otomatis membuat periode jika belum ada</li>
                                <li>Setiap guru bisa mengajukan LCKH untuk bulan yang sama</li>
                                <li>LCKH yang sudah diajukan tidak bisa diulang</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <footer className="lckhg-modal-foot">
                    <div className="lckhg-modal-foot-text">
                        <i className="bi bi-shield-check"></i>
                        Bebas pilih bulan sesuai kebutuhan
                    </div>
                    <button onClick={onClose} className="lckhg-btn">
                        Batal
                    </button>
                </footer>
            </div>
        </div>
    );
}

function ModulePreviewModal({ moduleCode, data, userData, onClose, nilaiDetailModal, setNilaiDetailModal }: any) {
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(0);
    const [nilaiNestedOpen, setNilaiNestedOpen] = useState(false);
    const [nilaiNestedData, setNilaiNestedData] = useState<any>(null);
    const [nilaiNestedLoading, setNilaiNestedLoading] = useState(false);
    const [nilaiNestedError, setNilaiNestedError] = useState<string | null>(null);

    useEffect(() => {
        if (moduleCode === 'ABSENSI' && data?.detail_absensi_per_class?.length > 0) {
            setSelectedClass(data.detail_absensi_per_class[0].kelas);
        } else if (moduleCode === 'ABSENSI' && data?.rekap_absensi_siswa?.length > 0) {
            setSelectedClass(data.rekap_absensi_siswa[0].kelas);
        }
    }, [data, moduleCode]);

    if (!data || !moduleCode) return null;

    const getModuleConfig = () => {
        switch (moduleCode) {
            case 'JURNAL':
                return { title: 'Detail Jurnal & Agenda', icon: 'bi-journal-richtext' };
            case 'ABSENSI':
                return { title: 'Rekap Absensi Siswa', icon: 'bi-people-fill' };
            case 'TUGAS':
                return { title: 'Tugas Tambahan', icon: 'bi-briefcase-fill' };
            case 'NILAI':
                return { title: 'Dashboard Capaian Akademik', icon: 'bi-award-fill' };
            default:
                return { title: 'Detail', icon: 'bi-info-circle' };
        }
    };

    const config = getModuleConfig();
    const rekapClasses = (data.rekap_absensi_siswa?.map((i: any) => i.kelas) || []);
    const currentClass = selectedClass || (rekapClasses.length > 0 ? rekapClasses[0] : '');
    const filteredRecap = data.rekap_absensi_siswa?.filter((item: any) => item.kelas === currentClass) || [];

    return (
        <div className="lckhg-modal-overlay animate-fade-in" onClick={onClose}>
            <div className="lckhg-modal animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="lckhg-modal-head-content">
                        <div className="lckhg-modal-icon blue">
                            <i className={`bi ${config.icon}`}></i>
                        </div>
                        <div className="lckhg-modal-text">
                            <h3>{config.title}</h3>
                            <span>Data periode aktif</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="lckhg-modal-close">
                        <i className="bi bi-x-lg"></i>
                    </button>
                </header>

                <div className="lckhg-modal-body custom-scrollbar">
                    {/* JURNAL Module */}
                    {moduleCode === 'JURNAL' && (
                        <div>
                            <div className="lckhg-table-container">
                                <table className="table-premium">
                                    <thead>
                                        <tr>
                                            <th>Tanggal & Kelas</th>
                                            <th>Mata Pelajaran</th>
                                            <th>Materi</th>
                                            <th className="text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.detail_jurnal || []).length > 0 ? (
                                            data.detail_jurnal.map((j: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="">{new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</div>
                                                        <div className="text-xs" style={{ color: 'var(--lckhg-text-subtle)' }}>Kelas {j.kelas}</div>
                                                    </td>
                                                    <td>
                                                        <div className="">{j.mata_pelajaran || j.mapel}</div>
                                                        <div className="text-xs" style={{ color: 'var(--lckhg-accent)' }}>Jam Ke-{j.jam_ke || '-'}</div>
                                                    </td>
                                                    <td className="">
                                                        {j.materi || <span style={{ color: 'var(--lckhg-text-subtle)', fontStyle: 'italic' }}>Belum diisi</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge ${j.materi ? 'badge-success' : 'badge-warning'}`}>
                                                            {j.materi ? 'Verified' : 'Pending'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="table-empty">Data jurnal tidak ditemukan.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ABSENSI Module - Detailed Matrix View */}
                    {moduleCode === 'ABSENSI' && (
                        <div>
                            {/* Class + Month Filters */}
                            {(() => {
                                const hasMonthly = data.detail_absensi_per_class && data.detail_absensi_per_class.length > 0;
                                return (
                                    <>
                                        <div className="lckhg-filter-bar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                                            <span className="lckhg-filter-lbl">Kelas:</span>
                                            <select
                                                value={currentClass}
                                                onChange={e => { setSelectedClass(e.target.value); setSelectedMonth(0); }}
                                                className="lckhg-filter-select"
                                            >
                                                {(data.detail_absensi_per_class || data.rekap_absensi_siswa || []).map((item: any) => (
                                                    <option key={item.kelas} value={item.kelas}>KELAS {item.kelas}</option>
                                                ))}
                                            </select>
                                            {/* Month Tabs */}
                                            {hasMonthly && (() => {
                                                const cd = data.detail_absensi_per_class.find((c: any) => c.kelas === currentClass);
                                                if (!cd?.monthGroups?.length) return null;
                                                return (
                                                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
                                                        {cd.monthGroups.map((mg: any, mi: number) => (
                                                            <button
                                                                key={mi}
                                                                onClick={() => setSelectedMonth(mi)}
                                                                style={{
                                                                    padding: '0.3rem 0.75rem',
                                                                    borderRadius: '9999px',
                                                                    border: '1px solid',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.03em',
                                                                    ...(selectedMonth === mi
                                                                        ? { background: '#3083FF', color: 'white', borderColor: '#3083FF' }
                                                                        : { background: 'white', color: 'var(--n-muted)', borderColor: '#e2e8f0' })
                                                                }}
                                                            >
                                                                {mg.monthName}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Monthly Matrix View */}
                                        {hasMonthly ? (() => {
                                            const cd = data.detail_absensi_per_class.find((c: any) => c.kelas === currentClass);
                                            if (!cd?.monthGroups?.length) return <div className="table-empty"><i className="bi bi-calendar-x"></i><p>Tidak ada data bulanan</p></div>;
                                            const mg = cd.monthGroups[selectedMonth] || cd.monthGroups[0];
                                            if (!mg) return <div className="table-empty"><i className="bi bi-calendar-x"></i><p>Pilih bulan</p></div>;
                                            const students = mg.students || [];
                                            const dateCols = mg.dateCols || [];
                                            const tH = students.reduce((a: number, s: any) => a + (s.totalH || 0), 0);
                                            const tS = students.reduce((a: number, s: any) => a + (s.totalS || 0), 0);
                                            const tI = students.reduce((a: number, s: any) => a + (s.totalI || 0), 0);
                                            const tA = students.reduce((a: number, s: any) => a + (s.totalA || 0), 0);

                                            return (
                                                <>
                                                    {/* Summary */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                                        {[
                                                            { label: 'Hadir', val: tH, c: '#059669', bg: 'rgba(5,150,105,0.1)' },
                                                            { label: 'Sakit', val: tS, c: '#d97706', bg: 'rgba(217,119,6,0.1)' },
                                                            { label: 'Izin', val: tI, c: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
                                                            { label: 'Alpa', val: tA, c: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                                                        ].map((item, i) => (
                                                            <div key={i} style={{ background: item.bg, border: `1px solid ${item.c}20`, borderRadius: '10px', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                                <i className={`bi ${i === 0 ? 'bi-check-all' : i === 1 ? 'bi-bandaid' : i === 2 ? 'bi-envelope-paper' : 'bi-x-circle'}`} style={{ color: item.c, fontSize: '1.125rem' }}></i>
                                                                <div>
                                                                    <div style={{ fontSize: '1.125rem', fontWeight: 900, color: item.c, lineHeight: 1 }}>{item.val}</div>
                                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: item.c, marginTop: '0.2rem' }}>{item.label}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Table */}
                                                    {students.length === 0 ? (
                                                        <div className="table-empty"><i className="bi bi-people"></i><p>Tidak ada siswa</p></div>
                                                    ) : (
                                                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--lckhg-border)', boxShadow: 'var(--lckhg-shadow-sm)' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: dateCols.length > 20 ? '1200px' : '900px' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ position: 'sticky', top: 0, left: 0, background: '#3083FF', color: 'white', padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '2px solid rgba(255,255,255,0.2)', zIndex: 5, minWidth: '50px' }}>No</th>
                                                                        <th style={{ position: 'sticky', top: 0, left: '50px', background: '#3083FF', color: 'white', padding: '0.5rem 0.875rem', textAlign: 'left', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '2px solid rgba(255,255,255,0.2)', zIndex: 5, minWidth: '180px' }}>Nama Siswa</th>
                                                                        {dateCols.map((dc: any, di: number) => (
                                                                            <th key={di}
                                                                                style={{
                                                                                    position: 'sticky', top: 0,
                                                                                    background: dc.isWeekend ? '#f1f5f9' : '#f8fafc',
                                                                                    color: dc.isWeekend ? '#94a3b8' : '#475569',
                                                                                    padding: '0.375rem 0.25rem', textAlign: 'center', fontWeight: 800, fontSize: '0.6rem',
                                                                                    borderRight: '1px solid #e2e8f0', zIndex: 2, minWidth: '28px',
                                                                                    borderBottom: dc.isWeekend ? '2px solid #cbd5e1' : '1px solid #e2e8f0'
                                                                                }}
                                                                            >
                                                                                {dc.day}
                                                                            </th>
                                                                        ))}
                                                                        <th style={{ position: 'sticky', top: 0, right: '114px', background: '#059669', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px', borderLeft: '2px solid rgba(255,255,255,0.3)' }}>H</th>
                                                                        <th style={{ position: 'sticky', top: 0, right: '76px', background: '#d97706', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px' }}>S</th>
                                                                        <th style={{ position: 'sticky', top: 0, right: '38px', background: '#0ea5e9', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px' }}>I</th>
                                                                        <th style={{ position: 'sticky', top: 0, right: 0, background: '#dc2626', color: 'white', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.65rem', zIndex: 3, minWidth: '38px', width: '38px' }}>A</th>
                                                                    </tr>
                                                                    <tr>
                                                                        <th colSpan={2} style={{ position: 'sticky', top: '32px', left: 0, background: '#1e40af', color: 'rgba(255,255,255,0.7)', padding: '0.25rem 0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 4, borderBottom: '1px solid #e2e8f0', minWidth: '230px' }}></th>
                                                                        {dateCols.map((dc: any, di: number) => (
                                                                            <th key={di}
                                                                                style={{
                                                                                    position: 'sticky', top: '32px',
                                                                                    background: dc.isWeekend ? '#f1f5f9' : '#f8fafc',
                                                                                    color: dc.isWeekend ? '#94a3b8' : '#64748b',
                                                                                    padding: '0.25rem 0.25rem', textAlign: 'center', fontWeight: 700, fontSize: '0.5rem',
                                                                                    borderRight: '1px solid #e2e8f0', zIndex: 2,
                                                                                    borderBottom: '1px solid #e2e8f0'
                                                                                }}
                                                                            >
                                                                                {dc.dayName.substring(0, 3)}
                                                                            </th>
                                                                        ))}
                                                                        <th colSpan={4} style={{ position: 'sticky', top: '32px', right: 0, background: '#f8fafc', color: 'var(--n-muted)', padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em', zIndex: 3, borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {students.map((st: any, idx: number) => {
                                                                        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                                                                        return (
                                                                            <tr key={idx} style={{ background: rowBg }}>
                                                                                <td style={{ position: 'sticky', left: 0, background: rowBg, padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--n-muted)', fontSize: '0.7rem', borderRight: '1px solid #e2e8f0', zIndex: 1 }}>{idx + 1}</td>
                                                                                <td style={{ position: 'sticky', left: '50px', background: rowBg, padding: '0.5rem 0.875rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--n-text)', borderRight: '1px solid #e2e8f0', zIndex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{st.nama}</td>
                                                                                {dateCols.map((dc: any, di: number) => {
                                                                                    const status = st.days?.[dc.day] || '';
                                                                                    const isWeekend = dc.isWeekend;
                                                                                    const bg = isWeekend ? '#f8f9fa' : status === 'HADIR' || status === 'H' ? 'rgba(5,150,105,0.12)' : status === 'SAKIT' || status === 'S' ? 'rgba(245,158,11,0.12)' : status === 'IZIN' || status === 'I' ? 'rgba(14,165,233,0.12)' : status === 'ALPHA' || status === 'A' ? 'rgba(220,38,38,0.12)' : '#ffffff';
                                                                                    const txt = status === 'HADIR' || status === 'H' ? '#059669' : status === 'SAKIT' || status === 'S' ? '#d97706' : status === 'IZIN' || status === 'I' ? '#0284c7' : status === 'ALPHA' || status === 'A' ? '#dc2626' : isWeekend ? '#e2e8f0' : '#e2e8f0';
                                                                                    const displayChar = status === 'HADIR' ? 'H' : status === 'SAKIT' ? 'S' : status === 'IZIN' ? 'I' : status === 'ALPHA' || status === 'A' ? 'A' : '';
                                                                                    return (
                                                                                        <td key={di} style={{ padding: '0.375rem 0.25rem', textAlign: 'center', fontWeight: 900, fontSize: '0.7rem', background: bg, color: txt, borderRight: '1px solid #e2e8f0' }}>
                                                                                            {displayChar}
                                                                                        </td>
                                                                                    );
                                                                                })}
                                                                                <td style={{ position: 'sticky', right: '114px', zIndex: 1, background: '#e9f6f1', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#059669', borderLeft: '1px solid #e2e8f0' }}>{st.totalH}</td>
                                                                                <td style={{ position: 'sticky', right: '76px', zIndex: 1, background: '#fbf1e2', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#d97706', borderLeft: '1px solid #e2e8f0' }}>{st.totalS}</td>
                                                                                <td style={{ position: 'sticky', right: '38px', zIndex: 1, background: '#e7f4fc', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#0284c7', borderLeft: '1px solid #e2e8f0' }}>{st.totalI}</td>
                                                                                <td style={{ position: 'sticky', right: 0, zIndex: 1, background: '#fceaea', padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#dc2626', borderLeft: '1px solid #e2e8f0' }}>{st.totalA}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })() : (
                                            <div className="table-empty"><i className="bi bi-calendar-x"></i><p>Memuat data bulanan...</p></div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* TUGAS Module */}
                    {moduleCode === 'TUGAS' && (
                        <div>
                            {(data.detail_tugas || []).length > 0 ? (
                                data.detail_tugas.map((t: any, idx: number) => (
                                    <div key={idx} className="task-card">
                                        <div className="task-card-header">
                                            <div>
                                                <div className="task-card-title">{t.tugas?.jabatan || 'Penugasan'}</div>
                                                <div className="task-card-date">
                                                    {new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </div>
                                            </div>
                                            <span className="lckhg-badge verified">Verified</span>
                                        </div>
                                        <div className="task-card-content">
                                            <div className="task-card-label">Kegiatan Utama</div>
                                            <div className="task-card-text">{t.kegiatan}</div>
                                        </div>
                                        {t.hasil && (
                                            <div className="task-card-content" style={{ background: 'var(--lckhg-success-soft)' }}>
                                                <div className="task-card-label" style={{ color: 'var(--lckhg-success)' }}>Output / Hasil</div>
                                                <div className="task-card-text" style={{ color: 'var(--lckhg-text)' }}>"{t.hasil}"</div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="table-empty">
                                    <i className="bi bi-briefcase"></i>
                                    <p>Belum ada tugas tambahan</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* NILAI Module */}
                    {moduleCode === 'NILAI' && (
                        <div>
                            <table className="table-premium">
                                <thead>
                                    <tr>
                                        <th>Kelas & Mapel</th>
                                        <th className="text-center">Jenis Tes</th>
                                        <th>Materi</th>
                                        <th className="text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.detail_nilai?.map((n: any, idx: number) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="">{n.kelas}</div>
                                                <div className="text-xs" style={{ color: 'var(--lckhg-text-subtle)' }}>{n.mapel}</div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`badge ${n.jenis === 'Sum' ? 'badge-success' : n.jenis === 'Pas' ? 'badge-warning' : 'badge-info'}`}>
                                                    {n.jenis === 'Sum' ? 'Sumatif' : n.jenis === 'Pas' ? 'SAS' : 'Formatif'}
                                                </span>
                                            </td>
                                            <td className="">
                                                <div>{n.materi}</div>
                                                <div className="text-xs" style={{ color: 'var(--lckhg-text-subtle)' }}>{n.tagihan || 'Utama'}</div>
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    onClick={async () => {
                                                        setNilaiNestedLoading(true);
                                                        setNilaiNestedError(null);
                                                        setNilaiNestedData(null);
                                                        setNilaiNestedOpen(true);
                                                        try {
                                                            const params = new URLSearchParams();
                                                            if (n.kolom_id) params.append('kolom_id', n.kolom_id);
                                                            params.append('kelas', n.kelas || '');
                                                            params.append('mapel', n.mapel || '');
                                                            const res = await fetch(`/api/lckh/nilai-detail?${params.toString()}`);
                                                            const result = await res.json();
                                                            if (!res.ok) throw new Error(result.error || 'Server error');
                                                            setNilaiNestedData(result);
                                                        } catch (err: any) {
                                                            setNilaiNestedError(err.message);
                                                        } finally {
                                                            setNilaiNestedLoading(false);
                                                        }
                                                    }}
                                                    className="lckhg-btn-detail"
                                                >
                                                    <i className="bi bi-list-ul"></i>
                                                    Detail
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <footer className="lckhg-modal-foot">
                    <div className="lckhg-modal-foot-text">
                        <i className="bi bi-shield-lock-fill"></i>
                        Secured Verification Mode
                    </div>
                    <button onClick={onClose} className="lckhg-btn" style={{ background: 'var(--lckhg-primary)', color: 'white', borderColor: 'var(--lckhg-primary)' }}>
                        Selesai Meninjau
                    </button>
                </footer>

                {/* Nested Nilai Detail Modal */}
                {nilaiNestedOpen && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}>
                        <div style={{ background: 'var(--lckhg-surface)', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--lckhg-border)' }}>
                                <div>
                                    <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--lckhg-text)' }}>Detail Nilai</h3>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--lckhg-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.125rem' }}>Data siswa per mapel</p>
                                </div>
                                <button onClick={() => setNilaiNestedOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid var(--lckhg-border)', background: 'var(--lckhg-bg)', color: 'var(--lckhg-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                                {nilaiNestedLoading && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            {[1,2,3].map(i => <span key={i} style={{ display: 'block', width: '3px', height: '16px', background: 'var(--lckhg-primary)', borderRadius: '3px', animation: 'lckhWave 1s infinite ease-in-out', animationDelay: `${i * 0.1}s` }}></span>)}
                                        </div>
                                        <p style={{ fontWeight: 600, color: 'var(--lckhg-text-muted)', fontSize: '0.8rem' }}>Memuat...</p>
                                    </div>
                                )}
                                {nilaiNestedError && (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--lckhg-danger)', fontWeight: 600 }}>
                                        <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}></i>
                                        {nilaiNestedError}
                                    </div>
                                )}
                                {nilaiNestedData && (
                                    <>
                                        {/* Stats */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                            {(() => {
                                                const scores = nilaiNestedData.students?.map((s: any) => s.nilai).filter((n: any) => n !== null && n !== undefined) || [];
                                                const avg = scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '-';
                                                const max = scores.length ? Math.max(...scores) : '-';
                                                const min = scores.length ? Math.min(...scores) : '-';
                                                return [
                                                    { label: 'Rata-rata', value: avg, color: '#3083FF', bg: 'rgba(0,56,168,0.08)' },
                                                    { label: 'Nilai Tertinggi', value: max, color: '#16a34a', bg: 'rgba(16,185,129,0.08)' },
                                                    { label: 'Nilai Terendah', value: min, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
                                                ];
                                            })().map((item, i) => (
                                                <div key={i} style={{ background: item.bg, borderRadius: '12px', padding: '1rem', textAlign: 'center', border: `1px solid ${item.color}20` }}>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: item.color }}>{item.value}</div>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: item.color, marginTop: '0.25rem' }}>{item.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>No</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>Nama Siswa</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>Nilai</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lckhg-text-muted)', background: 'var(--lckhg-bg)', borderBottom: '1px solid var(--lckhg-border)' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {nilaiNestedData.students?.map((s: any, i: number) => {
                                                    const val = s.nilai;
                                                    const pass = val >= 75;
                                                    return (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--lckhg-border-light)' }}>
                                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--lckhg-text-subtle)', fontWeight: 700 }}>{i + 1}</td>
                                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.nama}</td>
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                <span style={{ display: 'inline-block', minWidth: '40px', padding: '0.25rem 0.75rem', borderRadius: '8px', fontWeight: 900, fontSize: '0.875rem', background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: pass ? '#16a34a' : '#dc2626' }}>
                                                                    {val !== null && val !== undefined ? val : '-'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', background: pass ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: pass ? '#16a34a' : '#dc2626' }}>
                                                                    <i className={`bi ${pass ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                                                                    {pass ? 'Lulus' : 'Remed'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
