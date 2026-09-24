'use client';

import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { FilterToolbar, FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useFileViewer } from '@/components/useFileViewer';
import { MobileList, MobileListItem, MobileAvatar } from '@/components/mobile/MobileList';
import { getProxiedImageUrl } from '@/lib/image-utils';

type User = any;

interface Prestasi {
    id: string;
    nisn: string;
    nama_siswa?: string;
    kelas?: string;
    foto_siswa?: string | null;
    nama_lomba: string;
    kategori: string;
    tingkat: string;
    penyelenggara: string;
    tanggal_pelaksanaan: string;
    prestasi_diraih: string;
    bukti_sertifikat: string;
    foto_kegiatan: string | null;
    status_validasi: 'Menunggu' | 'Disetujui' | 'Ditolak';
    catatan_validator: string | null;
    validated_by: string | null;
    validated_at: string | null;
    created_at: string;
}

const KATEGORI_OPTIONS = [
    { value: '', label: 'Semua Kategori' },
    { value: 'Akademik', label: 'Akademik' },
    { value: 'Olahraga', label: 'Olahraga' },
    { value: 'Seni & Budaya', label: 'Seni & Budaya' },
    { value: 'Keagamaan', label: 'Keagamaan' },
    { value: 'Lainnya', label: 'Lainnya' },
];

const STATUS_OPTIONS = [
    { value: 'Semua', label: 'Semua Status' },
    { value: 'Menunggu', label: 'Menunggu' },
    { value: 'Disetujui', label: 'Disetujui' },
    { value: 'Ditolak', label: 'Ditolak' },
];

export default function PrestasiPage({ user }: { user: User }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<Prestasi[]>([]);

    // Role checks
    const isValidator = useMemo(() => {
        if (!user) return false;
        const roles = user.roles || [];
        const userRole = user.role?.toUpperCase() || '';
        return roles.some((r: string) => ['ADMIN', 'OP_LOMBA', 'WKM KESISWAAN', 'WKM_KESISWAAN'].includes(r.toUpperCase())) ||
            ['ADMIN', 'OP_LOMBA', 'WKM KESISWAAN', 'WKM_KESISWAAN'].includes(userRole);
    }, [user]);

    const isSiswa = useMemo(() => {
        if (!user) return false;
        return user.roles?.some((r: string) => r.toUpperCase() === 'SISWA') || user.role?.toUpperCase() === 'SISWA';
    }, [user]);

    const nisn = user?.nisn || user?.nip || user?.username || '';

    useEffect(() => {
        fetchData();
    }, [isValidator, isSiswa, nisn]);

    // Badge "hasil validasi" di sidebar hilang karena halaman ini dibuka, bukan
    // karena siswa mengerjakan sesuatu — sebuah keputusan tidak bisa "dikerjakan".
    // Hanya untuk siswa; validator punya antreannya sendiri yang turun saat ia
    // memvalidasi. Gagal menandai dibiarkan diam supaya tidak mengganggu daftar.
    useEffect(() => {
        if (!isSiswa) return;
        fetch('/api/sidebar-badges/seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queue: 'prestasi-hasil' }),
        }).catch(() => { });
    }, [isSiswa]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let endpoint = '/api/prestasi';
            if (!isValidator && isSiswa && nisn) {
                endpoint += `?nisn=${encodeURIComponent(nisn)}`;
            }

            const res = await fetch(endpoint);
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal mengambil data prestasi');

            let rows = (json.data || []) as Prestasi[];

            // Build student name & regular class lookup via siswa_kelas & master_siswa & users
            try {
                const resSk = await fetch('/api/settings/siswa-kelas?aktif=true');
                const jsonSk = resSk.ok ? await resSk.json().catch(() => null) : null;
                const siswaKelasData = jsonSk?.data || jsonSk || [];

                /**
                 * Daftar induk siswa hanya dilengkapi untuk pemakai pegawai.
                 * `/api/master/students` menolak akun siswa & orang tua sejak
                 * daftar itu setara daftar username akun siswa (NISN dipakai
                 * sebagai username) — lihat MasterController.list(). Isinya di sini
                 * memang cuma pelengkap: nama diambil dari siswa_kelas lebih dulu,
                 * dan baris prestasi sendiri sudah membawa `nama_siswa`.
                 */
                const bolehBacaMaster = !isSiswa || isValidator;
                const res = bolehBacaMaster
                    ? await fetch('/api/master/students?limit=2000')
                    : null;
                const json = res?.ok ? await res.json().catch(() => null) : null;

                const isRegulerName = (kName: string) => {
                    const peminatanKeywords = ['utbk', 'peminatan', 'klinik', 'klub', 'bimbingan', 'olimpiade', 'lintas minat', 'ekskul', 'tahfidz', 'lanjut', 'biologi', 'fisika', 'kimia', 'ekonomi', 'geografi', 'informatika', 'sejarah', 'sosiologi', 'bahasa'];
                    return !peminatanKeywords.some(kw => (kName || '').toLowerCase().includes(kw));
                };

                const siswaMap = new Map<string, { nama: string; kelas: string }>();

                // Populate from siswa_kelas first
                (Array.isArray(siswaKelasData) ? siswaKelasData : []).forEach((sk: any) => {
                    if (!sk.nisn) return;
                    const rawNisn = String(sk.nisn).trim();
                    const unpadded = rawNisn.replace(/^0+/, '');
                    const padded10 = unpadded.padStart(10, '0');

                    const existing = siswaMap.get(rawNisn);
                    if (!existing || (isRegulerName(sk.kelas) && !isRegulerName(existing.kelas))) {
                        const info = {
                            nama: sk.nama_siswa || sk.nama || existing?.nama || '',
                            kelas: sk.kelas || existing?.kelas || ''
                        };
                        siswaMap.set(rawNisn, info);
                        siswaMap.set(unpadded, info);
                        siswaMap.set(padded10, info);
                    }
                });

                // Complement with master_students API
                if (json && json.ok && Array.isArray(json.data)) {
                    json.data.forEach((s: any) => {
                        if (!s.nisn) return;
                        const rawNisn = String(s.nisn).trim();
                        const unpadded = rawNisn.replace(/^0+/, '');
                        const padded10 = unpadded.padStart(10, '0');

                        const existing = siswaMap.get(rawNisn);
                        const info = {
                            nama: s.nama_lengkap || existing?.nama || '',
                            kelas: existing?.kelas || ''
                        };
                        if (!existing) {
                            siswaMap.set(rawNisn, info);
                            siswaMap.set(unpadded, info);
                            siswaMap.set(padded10, info);
                        } else if (!existing.nama && s.nama_lengkap) {
                            existing.nama = s.nama_lengkap;
                        }
                    });
                }

                // Photo map built from fetched student/user photo fields
                const photoMap: Record<string, string> = {};
                (Array.isArray(siswaKelasData) ? siswaKelasData : []).forEach((u: any) => {
                    const photo = u.foto_profil || u.foto;
                    if (!photo) return;
                    const url = getProxiedImageUrl(photo);
                    if (u.nisn) {
                        const raw = String(u.nisn).trim();
                        const unpadded = raw.replace(/^0+/, '');
                        const padded10 = unpadded.padStart(10, '0');
                        photoMap[raw] = url;
                        photoMap[unpadded] = url;
                        photoMap[padded10] = url;
                    }
                });

                rows = rows.map(r => {
                    const rawNisn = String(r.nisn || '').trim();
                    const unpadded = rawNisn.replace(/^0+/, '');
                    const padded10 = unpadded.padStart(10, '0');

                    const s = siswaMap.get(rawNisn) || siswaMap.get(unpadded) || siswaMap.get(padded10);
                    const studentPhoto = photoMap[rawNisn] || photoMap[unpadded] || photoMap[padded10] || null;
                    const kegiatanPhoto = r.foto_kegiatan ? getProxiedImageUrl(r.foto_kegiatan) : null;
                    return {
                        ...r,
                        nama_siswa: s?.nama || r.nama_siswa || '',
                        kelas: s?.kelas || r.kelas || '',
                        foto_siswa: studentPhoto || kegiatanPhoto
                    };
                });
            } catch (e) {
                console.error('Lookup error:', e);
            }
            setData(rows);
        } catch (error: any) {
            console.error('Fetch error:', error);
            Swal.fire('Error', 'Gagal memuat data prestasi', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="prestasi-container prs-scope">
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                    <Spinner size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="prestasi-container prs-scope">
            

            {isValidator ? (
                <ValidatorView data={data} refresh={fetchData} user={user} />
            ) : isSiswa ? (
                <SiswaView data={data} refresh={fetchData} nisn={nisn} user={user} />
            ) : (
                <div className="empty-state">
                    <i className="bi bi-exclamation-triangle"></i>
                    <h3>Akses Terbatas</h3>
                    <p>Anda tidak memiliki akses yang sesuai untuk melihat halaman ini.</p>
                </div>
            )}

            <style jsx global>{`
                .prestasi-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    width: 100%;
                    animation: fadeIn 0.5s ease-out;
                    padding-bottom: 32px;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .prestasi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }

                .prestasi-table-wrap {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    overflow: auto;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
                }
                .prestasi-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                    min-width: 900px;
                }
                .prestasi-table thead th {
                    position: sticky;
                    top: 0;
                    background: var(--n-surface);
                    color: var(--n-muted);
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    text-align: left;
                    padding: 14px 16px;
                    border-bottom: 1px solid var(--n-border);
                    white-space: nowrap;
                }
                .prestasi-table tbody tr {
                    border-bottom: 1px solid var(--n-border);
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .prestasi-table tbody tr:last-child { border-bottom: none; }
                .prestasi-table tbody tr:hover { background: var(--n-surface); }
                .prestasi-table td { padding: 12px 16px; vertical-align: middle; color: var(--n-ink); }
                .prestasi-table .pt-num { color: var(--n-muted); font-weight: 700; }
                .prestasi-table .pt-muted { color: var(--n-muted); }
                .pt-name { font-weight: 800; color: var(--n-ink); line-height: 1.25; }
                .pt-noname { font-weight: 600; color: #d97706; font-style: italic; }
                .pt-nisn { font-size: 0.72rem; color: var(--n-muted); font-family: monospace; margin-top: 2px; }
                .pt-lomba { font-weight: 700; color: var(--n-ink); line-height: 1.3; }
                .pt-tingkat {
                    display: inline-block; margin-top: 4px; font-size: 0.62rem; font-weight: 800;
                    text-transform: uppercase; letter-spacing: 0.03em; color: var(--n-primary);
                    background: rgba(0,56,168,0.08); padding: 2px 8px; border-radius: 999px;
                }
                .pt-prestasi { font-weight: 700; }

                .card-item {
                    background: var(--n-card);
                    border-radius: 14px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                    position: relative;
                }
                .card-item:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); border-color: var(--n-primary); }

                .card-level-badge {
                    position: absolute;
                    top: 0; right: 0;
                    background: var(--n-soft); color: var(--n-primary);
                    font-size: 0.6rem; font-weight: 800; text-transform: uppercase;
                    padding: 4px 10px;
                    border-bottom-left-radius: 12px;
                    border-left: 1px solid var(--n-border);
                    border-bottom: 1px solid var(--n-border);
                }

                .card-header { padding: 20px; padding-top: 24px; border-bottom: 1px solid var(--n-border); }
                .card-header h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--n-ink); padding-right: 20px; }
                .tags { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
                
                .status-tag { padding: 4px 10px; border-radius: 6px; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; display: inline-flex; align-items: center; gap: 5px; border: 1px solid transparent; }
                .status-tag.disetujui { background: rgba(59, 130, 246, 0.14); color: #2563eb; border-color: rgba(59, 130, 246, 0.35); }
                .status-tag.menunggu { background: rgba(245, 158, 11, 0.14); color: #d97706; border-color: rgba(245, 158, 11, 0.35); }
                .status-tag.ditolak { background: rgba(239, 68, 68, 0.14); color: #dc2626; border-color: rgba(239, 68, 68, 0.35); }
                .status-tag.neutral { background: var(--n-soft); color: var(--n-muted); border-color: var(--n-border); }

                .card-body { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 14px; }
                .info-row { display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; color: var(--n-muted); font-weight: 500; }
                .info-row i { font-size: 1rem; color: var(--n-primary); opacity: 0.8; margin-top: 2px; }
                .info-row span { color: var(--n-ink); font-weight: 600; flex: 1; }
                
                .rejection-note { background: #fee2e2; border-radius: 8px; padding: 10px; font-size: 0.75rem; color: #dc2626; font-weight: 600; margin-top: auto; }

                .card-footer { padding: 16px 20px; background: var(--n-surface); display: flex; justify-content: space-between; align-items: center; gap: 12px; }

                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .form-group { display: flex; flex-direction: column; gap: 6px; }
                .form-group.full { grid-column: 1 / -1; }
                .form-group label { font-size: 0.8rem; font-weight: 700; color: var(--n-ink); }
                .form-group input, .form-group textarea, .form-group select { padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--n-border); background: var(--n-surface); outline: none; transition: 0.2s; font-family: inherit; color: var(--n-ink); }
                .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: var(--n-primary); }

                .file-dropzone { border: 2px dashed var(--n-border); border-radius: 12px; padding: 20px; text-align: center; background: var(--n-surface); cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 8px; }
                .file-dropzone:hover { border-color: var(--n-primary); background: rgba(59,130,246,0.05); }
                .file-dropzone i { font-size: 2rem; color: var(--n-muted); }
                .file-dropzone .file-name { font-weight: 700; color: var(--n-primary); font-size: 0.85rem; }

                .pt-locked-note { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); color: var(--n-ink); font-size: 0.82rem; line-height: 1.45; }
                .pt-locked-note i { color: #10b981; font-size: 1rem; margin-top: 1px; }

                .empty-state { padding: 60px 20px; text-align: center; background: var(--n-card); border-radius: 12px; border: 1px solid var(--n-border); }
                .empty-state i { font-size: 3rem; color: var(--n-border); margin-bottom: 16px; display: block; }
                .empty-state h3 { font-size: 1.1rem; font-weight: 700; color: var(--n-ink); margin: 0 0 8px; }
                .empty-state p { font-size: 0.85rem; color: var(--n-muted); margin: 0; }

                .prs-list-card {
                    background: var(--n-card);
                    border-radius: 14px;
                    border: 1px solid var(--n-border);
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
                    cursor: pointer;
                }
                .prs-list-card:hover {
                    border-color: var(--n-primary);
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
                }

                .prs-list-top {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                }
                .prs-list-title-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                }
                .prs-list-title {
                    margin: 0;
                    font-size: 0.98rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    line-height: 1.35;
                }
                .prs-list-badge-level {
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    color: var(--n-primary);
                    background: rgba(0, 56, 168, 0.08);
                    padding: 2px 8px;
                    border-radius: 6px;
                    width: fit-content;
                }

                .prs-list-body {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .prs-list-student-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    flex-wrap: wrap;
                }
                .prs-list-student-row i {
                    color: var(--n-primary);
                    font-size: 1rem;
                }
                .prs-list-student-name {
                    color: var(--n-ink);
                }
                .prs-list-nisn {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    font-family: monospace;
                    background: var(--n-surface);
                    padding: 1px 6px;
                    border-radius: 4px;
                    border: 1px solid var(--n-border);
                }
                .prs-list-achievement-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }
                .prs-list-submeta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 0.78rem;
                    color: var(--n-muted);
                    flex-wrap: wrap;
                }
                .prs-list-submeta span {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .prs-list-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 10px;
                    border-top: 1px solid var(--n-border);
                    gap: 8px;
                }

                .prs-separated-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 0;
                    width: 100%;
                }

                .prs-separated-item {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 12px 14px;
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 14px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-sizing: border-box;
                    -webkit-tap-highlight-color: transparent;
                }

                .prs-separated-item:hover,
                .prs-separated-item:active {
                    border-color: var(--n-primary);
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
                    transform: translateY(-1px);
                }

                .prs-separated-text {
                    flex: 1 1 auto;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .prs-separated-title {
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .prs-separated-sub {
                    font-size: 0.76rem;
                    font-weight: 500;
                    color: var(--n-muted);
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .prs-separated-badge {
                    flex: 0 0 auto;
                    display: flex;
                    align-items: center;
                }

                .status-icon-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    font-size: 1rem;
                    flex-shrink: 0;
                    transition: transform 0.15s ease;
                }

                .status-icon-badge.disetujui {
                    background: rgba(59, 130, 246, 0.14);
                    color: #2563eb;
                    border: 1px solid rgba(59, 130, 246, 0.35);
                }

                .status-icon-badge.menunggu {
                    background: rgba(245, 158, 11, 0.14);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.35);
                }

                .status-icon-badge.ditolak {
                    background: rgba(239, 68, 68, 0.14);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.35);
                }

                .desktop-only { display: block; }
                .mobile-only { display: none; }

                @media (max-width: 768px) {
                    .form-grid { grid-template-columns: 1fr; }
                    .desktop-only { display: none !important; }
                    .mobile-only { display: flex !important; flex-direction: column !important; gap: 10px !important; }
                }

                /* Dark mode */
                .dark .prs-scope .prs-separated-item {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 14px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
                }
                .dark .prs-scope .prs-separated-title {
                    color: #ffffff;
                }
                .dark .prs-scope .prs-separated-sub {
                    color: #94a3b8;
                }
                .dark .prs-scope .prs-list-card {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
                }
                .dark .prs-scope .prs-list-title {
                    color: #ffffff;
                }
                .dark .prs-scope .prs-list-student-name {
                    color: #ffffff;
                }
                .dark .prs-scope .prs-list-badge-level {
                    background: rgba(96, 165, 250, 0.18);
                    color: #60a5fa;
                }
                .dark .prs-scope .prs-list-footer {
                    border-top: 1.5px solid rgba(26, 115, 232, 0.3);
                }
                .dark .prs-scope .form-group input,
                .dark .prs-scope .form-group select,
                .dark .prs-scope .form-group textarea {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 12px;
                    color: #ffffff;
                    color-scheme: dark;
                }
                .dark .prs-scope .form-group label { color: #94a3b8; }
                .dark .prs-scope .card-item {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
                }
                .dark .prs-scope .card-header {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25));
                    border-bottom: 1px solid rgba(37, 99, 235, 0.4);
                }
                .dark .prs-scope .card-body { color: #ffffff; }
                .dark .prs-scope .card-footer {
                    background: #000000;
                    border-top: 1px solid rgba(37, 99, 235, 0.4);
                }
                .dark .prs-scope .card-level-badge {
                    background: rgba(96, 165, 250, 0.18);
                    color: #60a5fa;
                }
                .dark .prs-scope .info-row { color: #94a3b8; }
                .dark .prs-scope .prestasi-table-wrap {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
                }
                .dark .prs-scope .prestasi-table th {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25));
                    color: #94a3b8;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4);
                }
                .dark .prs-scope .prestasi-table td { color: #ffffff; }
                .dark .prs-scope .pt-name { color: #ffffff; }
                .dark .prs-scope .file-dropzone {
                    background: #000000;
                    border-color: rgba(26, 115, 232, 0.5);
                }
                .dark .prs-scope .file-dropzone:hover { border-color: #60a5fa; background: rgba(96, 165, 250, 0.08); }
                .dark .prs-scope .file-dropzone i { color: #60a5fa; }
                .dark .prs-scope .empty-state {
                    background: #000000;
                    border: 1.8px solid rgba(26, 115, 232, 0.75);
                    border-radius: 12px;
                }
                .dark .prs-scope .empty-state i { color: rgba(96, 165, 250, 0.35); }
                .dark .prs-scope .empty-state h3 { color: #ffffff; }
                .dark .prs-scope .empty-state p { color: #64748b; }
            `}</style>
        </div>
    );
}

function getStatusIconBadge(status: string) {
    const isApproved = status === 'Disetujui';
    const isRejected = status === 'Ditolak';
    const statusClass = isApproved ? 'disetujui' : isRejected ? 'ditolak' : 'menunggu';
    const iconClass = isApproved ? 'bi-check-circle-fill' : isRejected ? 'bi-x-circle-fill' : 'bi-clock-fill';

    return (
        <span className={`status-icon-badge ${statusClass}`} title={status} aria-label={status}>
            <i className={`bi ${iconClass}`}></i>
        </span>
    );
}

// -----------------------------------------------------------------------------
// SISWA VIEW
// -----------------------------------------------------------------------------
function SiswaView({ data, refresh, nisn, user }: { data: Prestasi[], refresh: () => void, nisn: string, user: User }) {
    const [statusFilter, setStatusFilter] = useState('Semua');
    const [kategoriFilter, setKategoriFilter] = useState('');
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (!isModalOpen) return;
        return registerModal();
    }, [isModalOpen, registerModal]);

    const filtered = useMemo(() => {
        let res = data;
        if (statusFilter && statusFilter !== 'Semua') {
            res = res.filter(i => i.status_validasi === statusFilter);
        }
        if (kategoriFilter) {
            res = res.filter(i => i.kategori === kategoriFilter);
        }
        if (search) {
            const q = search.toLowerCase();
            res = res.filter(i =>
                i.nama_lomba.toLowerCase().includes(q) ||
                i.nisn.toLowerCase().includes(q) ||
                (i.nama_siswa || '').toLowerCase().includes(q)
            );
        }
        return res;
    }, [data, statusFilter, kategoriFilter, search]);

    const sortedFiltered = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aIsMenunggu = a.status_validasi === 'Menunggu' ? 0 : 1;
            const bIsMenunggu = b.status_validasi === 'Menunggu' ? 0 : 1;
            if (aIsMenunggu !== bIsMenunggu) return aIsMenunggu - bIsMenunggu;
            const tA = new Date(a.created_at || a.tanggal_pelaksanaan || 0).getTime();
            const tB = new Date(b.created_at || b.tanggal_pelaksanaan || 0).getTime();
            return tB - tA;
        });
    }, [filtered]);

    const handleDelete = async (id: string, namaLomba: string) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Hapus Prestasi?',
            text: `Apakah Anda yakin ingin menghapus data lomba "${namaLomba}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#ef4444'
        });

        if (isConfirmed) {
            const res = await fetch(`/api/prestasi/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.ok) {
                Swal.fire('Gagal', json.error || 'Gagal menghapus data', 'error');
            } else {
                Swal.fire('Berhasil', 'Data terhapus', 'success');
                refresh();
            }
        }
    };

    return (
        <>
            <FilterToolbar style={{ marginBottom: '20px' }}>
                <FilterSelect
                    label="Status"
                    icon="check2-circle"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={STATUS_OPTIONS}
                    width="170px"
                />

                <FilterSelect
                    label="Kategori"
                    icon="tag"
                    value={kategoriFilter}
                    onChange={setKategoriFilter}
                    options={KATEGORI_OPTIONS}
                    width="180px"
                />

                <FilterSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari Nama Lomba..."
                />

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                    <Button variant="primary" onClick={() => setIsModalOpen(true)} leftIcon={<i className="bi bi-plus-lg" />}>
                        Tambah Prestasi
                    </Button>
                </div>
            </FilterToolbar>

            {sortedFiltered.length === 0 ? (
                <div className="empty-state">
                    <i className="bi bi-award"></i>
                    <h3>Belum ada prestasi</h3>
                    <p>Ayo mulai catat prestasimu dan kumpulkan pencapaian terbaikmu!</p>
                </div>
            ) : (
                <>
                    {/* Desktop View */}
                    <div className="prestasi-grid desktop-only">
                        {sortedFiltered.map(item => (
                            <PrestasiCard key={item.id} item={item} onDelete={() => handleDelete(item.id, item.nama_lomba)} />
                        ))}
                    </div>

                    {/* Mobile Separated List Items */}
                    <div className="mobile-only prs-separated-list">
                        {sortedFiltered.map(item => {
                            const studentSubtitle = item.nama_siswa
                                ? `${item.nama_siswa}${item.kelas ? ` (${item.kelas})` : ''}`
                                : `${item.prestasi_diraih} · ${item.tingkat}`;

                            return (
                                <div key={item.id} className="prs-separated-item" onClick={() => handleDelete(item.id, item.nama_lomba)}>
                                    <MobileAvatar
                                        name={item.nama_siswa || item.nama_lomba}
                                        seed={item.nisn}
                                        src={item.foto_siswa || item.foto_kegiatan || null}
                                    />
                                    <div className="prs-separated-text">
                                        <span className="prs-separated-title">{item.nama_lomba}</span>
                                        <span className="prs-separated-sub">{studentSubtitle}</span>
                                    </div>
                                    <div className="prs-separated-badge">
                                        {getStatusIconBadge(item.status_validasi)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isModalOpen && <FormModal onClose={() => setIsModalOpen(false)} refresh={refresh} nisn={nisn} />}
        </>
    );
}

// -----------------------------------------------------------------------------
// VALIDATOR VIEW
// -----------------------------------------------------------------------------
function ValidatorView({ data, refresh, user }: { data: Prestasi[], refresh: () => void, user: User }) {
    const [statusFilter, setStatusFilter] = useState('Semua');
    const [kategoriFilter, setKategoriFilter] = useState('');
    const [kelasFilter, setKelasFilter] = useState('');
    const [kelasList, setKelasList] = useState<{ id: number; nama: string }[]>([]);
    const [search, setSearch] = useState('');

    const [selectedItem, setSelectedItem] = useState<Prestasi | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [catatan, setCatatan] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { openFile, viewer } = useFileViewer();

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (!isReviewOpen) return;
        return registerModal();
    }, [isReviewOpen, registerModal]);

    // Fetch master kelas (hanya kelas reguler, diurutkan per tingkatan)
    useEffect(() => {
        fetch('/api/master/kelas')
            .then(res => res.json())
            .then(json => {
                if (json.ok && Array.isArray(json.data)) {
                    const regulerOnly = json.data.filter((k: any) => k.program === 'Reguler');
                    
                    const getTingkatRank = (k: { nama: string; tingkat?: number }) => {
                        if (k.tingkat) return Number(k.tingkat);
                        const name = (k.nama || '').trim().toUpperCase();
                        if (name.startsWith('XII') || name.startsWith('12')) return 12;
                        if (name.startsWith('XI') || name.startsWith('11')) return 11;
                        if (name.startsWith('X') || name.startsWith('10')) return 10;
                        return 99;
                    };

                    const sorted = [...regulerOnly].sort((a, b) => {
                        const rankA = getTingkatRank(a);
                        const rankB = getTingkatRank(b);
                        if (rankA !== rankB) return rankA - rankB;
                        return (a.nama || '').localeCompare(b.nama || '', undefined, { numeric: true, sensitivity: 'base' });
                    });

                    setKelasList(sorted);
                }
            })
            .catch(() => {});
    }, []);

    const filtered = useMemo(() => {
        let res = data;
        if (statusFilter && statusFilter !== 'Semua') {
            res = res.filter(i => i.status_validasi === statusFilter);
        }
        if (kategoriFilter) {
            res = res.filter(i => i.kategori === kategoriFilter);
        }
        if (kelasFilter) {
            res = res.filter(i => (i.kelas || '').toLowerCase() === kelasFilter.toLowerCase());
        }
        if (search) {
            const q = search.toLowerCase();
            res = res.filter(i =>
                i.nama_lomba.toLowerCase().includes(q) ||
                i.nisn.toLowerCase().includes(q) ||
                (i.nama_siswa || '').toLowerCase().includes(q)
            );
        }
        return res;
    }, [data, statusFilter, kategoriFilter, kelasFilter, search]);

    const sortedFiltered = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aIsMenunggu = a.status_validasi === 'Menunggu' ? 0 : 1;
            const bIsMenunggu = b.status_validasi === 'Menunggu' ? 0 : 1;
            if (aIsMenunggu !== bIsMenunggu) return aIsMenunggu - bIsMenunggu;
            const tA = new Date(a.created_at || a.tanggal_pelaksanaan || 0).getTime();
            const tB = new Date(b.created_at || b.tanggal_pelaksanaan || 0).getTime();
            return tB - tA;
        });
    }, [filtered]);

    const openReview = (item: Prestasi) => {
        setSelectedItem(item);
        setCatatan(item.catatan_validator || '');
        setIsReviewOpen(true);
    };

    const fmtDate = (d: string) => {
        try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
        catch { return d; }
    };

    const statusOf = (s: string) => s === 'Disetujui' ? 'disetujui' : s === 'Ditolak' ? 'ditolak' : 'menunggu';

    const isLocked = selectedItem?.status_validasi === 'Disetujui';

    const handleValidate = async (status: 'Disetujui' | 'Ditolak') => {
        if (!selectedItem || isLocked) return;
        if (status === 'Ditolak' && !catatan.trim()) {
            return Swal.fire('Perhatian', 'Catatan alasan penolakan wajib diisi', 'warning');
        }

        setIsSubmitting(true);
        try {
            const updatePayload: any = {
                status_validasi: status,
                validated_at: new Date().toISOString(),
                validated_by: user?.nama || user?.nip || user?.username || null,
            };
            if (catatan.trim()) updatePayload.catatan_validator = catatan.trim();

            const res = await fetch(`/api/prestasi/${selectedItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                if (res.status === 409) {
                    setIsReviewOpen(false);
                    refresh();
                    return Swal.fire(
                        'Sudah Divalidasi',
                        'Prestasi ini sudah disetujui oleh validator lain, sehingga keputusannya tidak dapat diubah lagi.',
                        'info'
                    );
                }
                throw new Error(json.error || 'Gagal menyimpan validasi');
            }

            Swal.fire('Berhasil', `Prestasi berhasil ${status.toLowerCase()}`, 'success');
            setIsReviewOpen(false);
            refresh();
        } catch (error: any) {
            Swal.fire('Gagal', 'Terjadi kesalahan sistem', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <FilterToolbar style={{ marginBottom: '20px' }}>
                <FilterSelect
                    label="Status"
                    icon="check2-circle"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={STATUS_OPTIONS}
                    width="170px"
                />

                <FilterSelect
                    label="Kategori"
                    icon="tag"
                    value={kategoriFilter}
                    onChange={setKategoriFilter}
                    options={KATEGORI_OPTIONS}
                    width="180px"
                />

                <FilterSelect
                    label="Kelas"
                    icon="door-open"
                    value={kelasFilter}
                    onChange={setKelasFilter}
                    options={[
                        { value: '', label: 'Semua Kelas' },
                        ...kelasList.map(k => ({ value: k.nama, label: `Kelas ${k.nama}` }))
                    ]}
                    width="170px"
                />

                <FilterSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari Nama / Lomba / NISN..."
                />
            </FilterToolbar>

            {sortedFiltered.length === 0 ? (
                <div className="empty-state">
                    <i className="bi bi-inbox"></i>
                    <h3>Tidak ada data</h3>
                    <p>Belum ada data prestasi yang sesuai dengan filter.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="prestasi-table-wrap desktop-only">
                        <table className="prestasi-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '46px' }}>No</th>
                                    <th>Siswa</th>
                                    <th>Lomba</th>
                                    <th>Kategori</th>
                                    <th>Penyelenggara</th>
                                    <th>Tanggal</th>
                                    <th>Pencapaian</th>
                                    <th>Status</th>
                                    <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFiltered.map((item, idx) => (
                                    <tr key={item.id} onClick={() => openReview(item)}>
                                        <td className="pt-num">{idx + 1}</td>
                                        <td>
                                            <div className="pt-name">{item.nama_siswa || <span className="pt-noname">Nama tidak ditemukan</span>}</div>
                                            <div className="pt-nisn">
                                                NISN {item.nisn} {item.kelas && <span style={{ marginLeft: '6px', color: 'var(--n-primary)', fontWeight: 700 }}>({item.kelas})</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="pt-lomba">{item.nama_lomba}</div>
                                            <span className="pt-tingkat">{item.tingkat}</span>
                                        </td>
                                        <td>{item.kategori}</td>
                                        <td className="pt-muted">{item.penyelenggara}</td>
                                        <td className="pt-muted">{fmtDate(item.tanggal_pelaksanaan)}</td>
                                        <td className="pt-prestasi">{item.prestasi_diraih}</td>
                                        <td><span className={`status-tag ${statusOf(item.status_validasi)}`}>{item.status_validasi}</span></td>
                                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            <ActionGroup align="center">
                                                <ActionButton
                                                    action="view"
                                                    size="sm"
                                                    onClick={() => openReview(item)}
                                                    title={item.status_validasi === 'Disetujui' ? 'Lihat Detail' : 'Tinjau Validasi'}
                                                />
                                            </ActionGroup>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Separated List Items */}
                    <div className="mobile-only prs-separated-list">
                        {sortedFiltered.map(item => {
                            const studentSubtitle = item.nama_siswa
                                ? `${item.nama_siswa}${item.kelas ? ` (${item.kelas})` : ''}`
                                : `${item.prestasi_diraih} · ${item.tingkat}`;

                            return (
                                <div key={item.id} className="prs-separated-item" onClick={() => openReview(item)}>
                                    <MobileAvatar
                                        name={item.nama_siswa || item.nama_lomba}
                                        seed={item.nisn}
                                        src={item.foto_siswa || item.foto_kegiatan || null}
                                    />
                                    <div className="prs-separated-text">
                                        <span className="prs-separated-title">{item.nama_lomba}</span>
                                        <span className="prs-separated-sub">{studentSubtitle}</span>
                                    </div>
                                    <div className="prs-separated-badge">
                                        {getStatusIconBadge(item.status_validasi)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isReviewOpen && selectedItem && (
                <Modal onClose={() => !isSubmitting && setIsReviewOpen(false)} size="lg">
                    <ModalHeader
                        title="Validasi Prestasi"
                        icon="shield-check"
                        onClose={() => !isSubmitting && setIsReviewOpen(false)}
                    />
                    <ModalBody>
                        <div style={{ background: 'var(--n-surface)', padding: '16px', borderRadius: '10px', border: '1px solid var(--n-border)' }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: 'var(--n-ink)' }}>{selectedItem.nama_lomba}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                                <div>
                                    <div style={{ color: 'var(--n-muted)', fontSize: '0.75rem', fontWeight: 700 }}>NAMA SISWA</div>
                                    <div style={{ fontWeight: 600, color: 'var(--n-ink)' }}>{selectedItem.nama_siswa || '—'} {selectedItem.kelas && `(${selectedItem.kelas})`}</div>
                                    <div style={{ color: 'var(--n-muted)', fontSize: '0.72rem', marginTop: '2px' }}>NISN {selectedItem.nisn}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--n-muted)', fontSize: '0.75rem', fontWeight: 700 }}>PENCAPAIAN</div>
                                    <div style={{ fontWeight: 600, color: 'var(--n-ink)' }}>{selectedItem.prestasi_diraih}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--n-muted)', fontSize: '0.75rem', fontWeight: 700 }}>KATEGORI</div>
                                    <div style={{ fontWeight: 600, color: 'var(--n-ink)' }}>{selectedItem.kategori} ({selectedItem.tingkat})</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--n-muted)', fontSize: '0.75rem', fontWeight: 700 }}>TANGGAL</div>
                                    <div style={{ fontWeight: 600, color: 'var(--n-ink)' }}>{new Date(selectedItem.tanggal_pelaksanaan).toLocaleDateString('id-ID')}</div>
                                </div>
                            </div>
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--n-border)' }}>
                                <Button
                                    variant="outline"
                                    onClick={() => openFile(selectedItem.bukti_sertifikat, `Sertifikat — ${selectedItem.nama_siswa || selectedItem.nama_lomba || ''}`)}
                                    leftIcon={<i className="bi bi-eye" />}
                                    style={{ width: '100%' }}
                                >
                                    Lihat File Sertifikat
                                </Button>
                            </div>
                        </div>

                        {isLocked && (
                            <div className="pt-locked-note">
                                <i className="bi bi-lock-fill"></i>
                                <div>
                                    <strong>Sudah disetujui{selectedItem.validated_by ? ` oleh ${selectedItem.validated_by}` : ''}</strong>
                                    {selectedItem.validated_at && <> pada {fmtDate(selectedItem.validated_at)}</>}.
                                    {' '}Keputusan ini final dan tidak dapat disetujui ulang maupun ditolak oleh validator lain.
                                </div>
                            </div>
                        )}

                        <div className="form-group" style={{ marginTop: '16px' }}>
                            <label>{isLocked ? 'Catatan Validator' : 'Catatan Validator (Opsional untuk Setuju, Wajib untuk Tolak)'}</label>
                            <textarea
                                rows={3}
                                value={catatan}
                                onChange={e => setCatatan(e.target.value)}
                                readOnly={isLocked}
                                placeholder={isLocked ? 'Tidak ada catatan' : 'Berikan apresiasi atau alasan penolakan...'}
                            ></textarea>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        {isLocked ? (
                            <Button variant="cancel" onClick={() => setIsReviewOpen(false)}>Tutup</Button>
                        ) : (
                            <>
                                <Button variant="cancel" type="button" disabled={isSubmitting} onClick={() => setIsReviewOpen(false)}>
                                    Batal
                                </Button>
                                <Button variant="danger" isLoading={isSubmitting} onClick={() => handleValidate('Ditolak')} leftIcon={<i className="bi bi-x-circle" />}>
                                    Tolak
                                </Button>
                                <Button variant="primary" isLoading={isSubmitting} onClick={() => handleValidate('Disetujui')} leftIcon={<i className="bi bi-check-circle" />}>
                                    Setujui
                                </Button>
                            </>
                        )}
                    </ModalFooter>
                </Modal>
            )}

            {viewer}
        </>
    );
}

// -----------------------------------------------------------------------------
// REUSABLE CARD
// -----------------------------------------------------------------------------
function PrestasiCard({ item, onDelete, onValidate }: { item: Prestasi, onDelete?: () => void, onValidate?: () => void }) {
    const { openFile, viewer } = useFileViewer();
    const isApproved = item.status_validasi === 'Disetujui';
    const isRejected = item.status_validasi === 'Ditolak';
    const isPending = item.status_validasi === 'Menunggu';

    const statusClass = isApproved ? 'disetujui' : isRejected ? 'ditolak' : 'menunggu';
    const iconClass = isApproved ? 'bi-check-circle-fill' : isRejected ? 'bi-x-circle-fill' : 'bi-clock-fill';

    const studentDisplay = item.nama_siswa ? `${item.nama_siswa}${item.kelas ? ` (${item.kelas})` : ''}` : null;
    const dateFormatted = item.tanggal_pelaksanaan ? new Date(item.tanggal_pelaksanaan).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    return (
        <div className="prs-list-card" onClick={onValidate}>
            <div className="prs-list-top">
                <div className="prs-list-title-wrap">
                    <h3 className="prs-list-title">{item.nama_lomba}</h3>
                    {item.tingkat && <span className="prs-list-badge-level">{item.tingkat}</span>}
                </div>
                <span className={`status-tag ${statusClass}`}>
                    <i className={`bi ${iconClass}`}></i> {item.status_validasi}
                </span>
            </div>

            <div className="prs-list-body">
                {studentDisplay ? (
                    <div className="prs-list-student-row">
                        <i className="bi bi-person-fill"></i>
                        <span className="prs-list-student-name">{studentDisplay}</span>
                        {item.nisn && <span className="prs-list-nisn">NISN: {item.nisn}</span>}
                    </div>
                ) : (
                    <div className="prs-list-achievement-row">
                        <i className="bi bi-award-fill"></i>
                        <span>{item.prestasi_diraih}</span>
                    </div>
                )}

                <div className="prs-list-submeta">
                    {item.kategori && <span><i className="bi bi-tag-fill"></i> {item.kategori}</span>}
                    {dateFormatted && <span><i className="bi bi-calendar-event"></i> {dateFormatted}</span>}
                    {item.penyelenggara && <span><i className="bi bi-building"></i> {item.penyelenggara}</span>}
                </div>

                {isRejected && item.catatan_validator && (
                    <div className="rejection-note" style={{ marginTop: '6px' }}>
                        <i className="bi bi-exclamation-triangle"></i> {item.catatan_validator}
                    </div>
                )}
            </div>

            <div className="prs-list-footer" onClick={e => e.stopPropagation()}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFile(item.bukti_sertifikat, `Sertifikat — ${item.nama_siswa || item.nama_lomba || ''}`)}
                    leftIcon={<i className="bi bi-file-earmark-text" />}
                >
                    Sertifikat
                </Button>
                
                <ActionGroup align="right">
                    {onValidate && (
                        <ActionButton action="view" size="sm" onClick={onValidate} title="Tinjau" label="Tinjau" />
                    )}
                    {onDelete && (isPending || isRejected) && (
                        <ActionButton action="delete" size="sm" onClick={onDelete} title="Hapus" label="Hapus" />
                    )}
                </ActionGroup>
            </div>

            {viewer}
        </div>
    );
}

// -----------------------------------------------------------------------------
// FORM MODAL SISWA
// -----------------------------------------------------------------------------
function FormModal({ onClose, refresh, nisn }: { onClose: () => void, refresh: () => void, nisn: string }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fileSertifikat, setFileSertifikat] = useState<File | null>(null);
    const [form, setForm] = useState({
        nama_lomba: '',
        kategori: 'Akademik',
        tingkat: 'Kabupaten/Kota',
        penyelenggara: '',
        tanggal_pelaksanaan: '',
        prestasi_diraih: ''
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) {
                Swal.fire('Error', 'Ukuran file maksimal 10MB', 'error');
                e.target.value = '';
                return;
            }
            setFileSertifikat(file);
        }
    };

    const uploadSertifikat = async (): Promise<string | null> => {
        if (!fileSertifikat) return null;
        const formData = new FormData();
        formData.append('file', fileSertifikat);
        formData.append('folder', 'prestasi');

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (!result.ok) throw new Error(result.error);
            return result.publicUrl || result.url || result.file_url;
        } catch (error: any) {
            console.error('Upload fail:', error);
            throw new Error('Gagal mengunggah file sertifikat');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileSertifikat) {
            return Swal.fire('Perhatian', 'Sertifikat wajib diunggah!', 'warning');
        }
        if (!form.tanggal_pelaksanaan) {
            return Swal.fire('Perhatian', 'Tanggal Pelaksanaan wajib diisi!', 'warning');
        }

        setIsSubmitting(true);
        try {
            const fileUrl = await uploadSertifikat();
            if (!fileUrl) throw new Error('File URL kosong');

            const res = await fetch('/api/prestasi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nisn,
                    nama_lomba: form.nama_lomba,
                    kategori: form.kategori,
                    tingkat: form.tingkat,
                    penyelenggara: form.penyelenggara,
                    tanggal_pelaksanaan: form.tanggal_pelaksanaan,
                    prestasi_diraih: form.prestasi_diraih,
                    bukti_sertifikat: fileUrl,
                    status_validasi: 'Menunggu'
                })
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal menyimpan data');

            Swal.fire('Berhasil', 'Prestasi berhasil disimpan dan menunggu validasi.', 'success');
            refresh();
            onClose();
        } catch (error: any) {
            Swal.fire('Gagal', error.message || 'Terjadi kesalahan sistem', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal onClose={onClose} size="lg">
            <ModalHeader
                title="Input Prestasi Baru"
                icon="award-fill"
                onClose={onClose}
            />
            <form onSubmit={handleSubmit}>
                <ModalBody>
                    <div className="form-grid">
                        <div className="form-group full">
                            <label>Nama Lomba / Kompetisi</label>
                            <input required type="text" value={form.nama_lomba} onChange={e => setForm({...form, nama_lomba: e.target.value})} placeholder="Contoh: Olimpiade Sains Nasional (OSN) Matematika" />
                        </div>

                        <div className="form-group">
                            <label>Kategori</label>
                            <select required value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})}>
                                <option>Akademik</option>
                                <option>Olahraga</option>
                                <option>Seni & Budaya</option>
                                <option>Keagamaan</option>
                                <option>Lainnya</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Tingkat Lomba</label>
                            <select required value={form.tingkat} onChange={e => setForm({...form, tingkat: e.target.value})}>
                                <option>Sekolah</option>
                                <option>Kabupaten/Kota</option>
                                <option>Provinsi</option>
                                <option>Nasional</option>
                                <option>Internasional</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Penyelenggara</label>
                            <input required type="text" value={form.penyelenggara} onChange={e => setForm({...form, penyelenggara: e.target.value})} placeholder="Contoh: Kemdikbud / Universitas Hasanuddin" />
                        </div>

                        <div className="form-group">
                            <label>Tanggal Pelaksanaan</label>
                            <DatePicker required value={form.tanggal_pelaksanaan} onChange={v => setForm({...form, tanggal_pelaksanaan: v})} />
                        </div>

                        <div className="form-group full">
                            <label>Prestasi yang Diraih</label>
                            <input required type="text" value={form.prestasi_diraih} onChange={e => setForm({...form, prestasi_diraih: e.target.value})} placeholder="Contoh: Juara 1 / Medali Emas / Harapan 2" />
                        </div>

                        <div className="form-group full">
                            <label>Bukti Sertifikat / Piagam (PDF/JPG/PNG)</label>
                            <div className="file-dropzone" onClick={() => document.getElementById('file-sertifikat')?.click()}>
                                <input id="file-sertifikat" required type="file" accept=".pdf,image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                {fileSertifikat ? (
                                    <>
                                        <i className="bi bi-file-earmark-check-fill" style={{ color: '#10b981' }}></i>
                                        <div className="file-name">{fileSertifikat.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>{(fileSertifikat.size / 1024 / 1024).toFixed(2)} MB</div>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-cloud-arrow-up"></i>
                                        <div className="file-name" style={{ color: 'var(--n-primary)' }}>Klik untuk mengunggah file</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)' }}>Maksimal 10MB. Format didukung: PDF, JPG, PNG.</div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="cancel" type="button" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                    <Button variant="primary" type="submit" isLoading={isSubmitting} leftIcon={<i className="bi bi-check-lg" />}>Simpan Prestasi</Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
