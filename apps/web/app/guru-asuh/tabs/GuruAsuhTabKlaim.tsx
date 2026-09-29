'use client';

import Pagination from '@/components/ui/Pagination';
import { useState, useEffect, useMemo } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import Swal from 'sweetalert2';
import Select from 'react-select';
import GuruAsuhForm from '@/app/guru-asuh/components/GuruAsuhForm';
import { getAllAcademicYears, getActiveAcademicYear, getAllActiveAcademicYears } from '@/lib/settings-client';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Spinner } from '@/components/ui/Spinner';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { MobileFab } from '@/components/mobile';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface GuruAsuhTabKlaimProps { user?: any; }

interface GuruAsuh {
    id: number;
    nip: string;
    nama_guru: string;
    nisn_siswa: string;
    nama_siswa: string;
    kelas: string;
    tahun_ajaran: string;
    aktif: boolean;
    foto_profil?: string | null;
}



export default function GuruAsuhTabKlaim({ user: propUser }: GuruAsuhTabKlaimProps) {
    const [user, setUser] = useState<any>(propUser || null);
    const nip = user?.nip || '';
    const [tahunOptions, setTahunOptions] = useState<string[]>(['Semua']);
    const [tahunAjaran, setTahunAjaran] = useState('');
    const [filterKelas, setFilterKelas] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [list, setList] = useState<GuruAsuh[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState<GuruAsuh | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<GuruAsuh | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (showForm || deleteTarget) return registerModal();
    }, [showForm, deleteTarget, registerModal]);

    useEffect(() => {
        const load = async () => {
            let u = user || propUser;
            if (!u) {
                u = await getCurrentUser();
                if (u) setUser(u);
            }
            
            // Load dynamic tahun ajaran from settings
            try {
                const activeYearsData = await getAllActiveAcademicYears();
                if (activeYearsData && activeYearsData.length > 0) {
                    const uniqueActiveTahun = Array.from(new Set(activeYearsData.map(y => y.tahun_ajaran)));
                    setTahunOptions(['Semua', ...uniqueActiveTahun]);
                    
                    if (!tahunAjaran || tahunAjaran === '') {
                        const activeTa = await getActiveAcademicYear();
                        setTahunAjaran(activeTa || uniqueActiveTahun[0]);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };
        load();
    }, [propUser, tahunAjaran]);

    useEffect(() => { fetchData(); }, [tahunAjaran, nip]);

    const fetchData = async () => {
        if (!nip || !tahunAjaran) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ tahun_ajaran: tahunAjaran, limit: '500' });
            params.set('nip', nip);
            const res = await fetch(`/api/settings/guru-asuh?${params.toString()}`);
            const json = await res.json();
            if (json.ok) {
                const data = json.data || [];
                setList(data);
                // Extract unique kelas
                const kelasSet = new Set<string>();
                data.forEach((d: GuruAsuh) => { if (d.kelas) kelasSet.add(d.kelas); });
                setKelasList(Array.from(kelasSet).sort());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered list by kelas & search query
    const filteredList = list.filter(a => {
        if (filterKelas && a.kelas !== filterKelas) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = (a.nama_siswa || '').toLowerCase().includes(q);
            const matchNisn = (a.nisn_siswa || '').toLowerCase().includes(q);
            const matchKelas = (a.kelas || '').toLowerCase().includes(q);
            if (!matchName && !matchNisn && !matchKelas) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filteredList.length / pageSize);
    const paginatedList = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredList.slice(start, start + pageSize);
    }, [filteredList, page, pageSize]);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 4000);
    };

    const handleEdit = (item: GuruAsuh) => {
        setEditData(item);
        setShowForm(true);
    };

    const handleDelete = (item: GuruAsuh) => {
        setDeleteTarget(item);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/settings/guru-asuh?id=${deleteTarget.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                showMsg('success', 'Siswa asuh berhasil dihapus');
                fetchData();
            } else {
                showMsg('error', json.error || 'Gagal menghapus');
            }
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const [copying, setCopying] = useState(false);
    const handleBulkCopy = async () => {
        if (!tahunAjaran || tahunAjaran === 'Semua') {
            showMsg('error', 'Pilih spesifik Tahun Ajaran tujuan terlebih dahulu (bukan "Semua").');
            return;
        }
        
        // Deterministic previous academic year calculation (e.g. 2024/2025 -> 2023/2024)
        let prevTahunAjaran = '';
        const match = tahunAjaran.match(/^(\d{4})\/(\d{4})$/);
        if (match) {
            const startYear = parseInt(match[1], 10);
            const endYear = parseInt(match[2], 10);
            prevTahunAjaran = `${startYear - 1}/${endYear - 1}`;
        } else {
            const allYears = await getAllAcademicYears();
            const idx = allYears.indexOf(tahunAjaran);
            if (idx !== -1 && idx < allYears.length - 1) {
                prevTahunAjaran = allYears[idx + 1];
            }
        }

        if (!prevTahunAjaran) {
            showMsg('error', 'Tidak dapat menentukan referensi tahun ajaran sebelumnya untuk disalin.');
            return;
        }

        const c = await Swal.fire({
            title: 'Salin Daftar Siswa Asuh?',
            html: `<p>Sistem akan menyalin semua siswa asuh Anda dari <strong>TA ${prevTahunAjaran}</strong> ke <strong>TA ${tahunAjaran}</strong>, dan otomatis memperbarui ke kelas baru mereka.</p><p>Apakah Anda yakin?</p>`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Salin Sekarang!',
            cancelButtonText: 'Batal',
        });
        if (!c.isConfirmed) return;

        setCopying(true);
        try {
            const res = await fetch('/api/settings/guru-asuh/bulk-copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nip: user.nip,
                    from_tahun_ajaran: prevTahunAjaran,
                    to_tahun_ajaran: tahunAjaran
                })
            });
            const json = await res.json();
            if (json.ok) {
                Swal.fire('Berhasil!', json.message, 'success');
                fetchData();
            } else {
                Swal.fire('Gagal', json.error, 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setCopying(false);
        }
    };

    const stats = { total: list.length, aktif: list.filter(l => l.aktif).length };
    const filteredStats = { total: filteredList.length, aktif: filteredList.filter(l => l.aktif).length };

    return (
        <div className="gakl__wrap">
            {toast && (
                <div className={`gakl__toast gakl__toast--${toast.type}`}>
                    <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Stats */}
            <div className="gakl__statsGrid">
                <div className="gakl__statCard gakl__statTotal">
                    <div className="gakl__statNum">{filteredStats.total}</div>
                    <div className="gakl__statLbl">{filterKelas ? `${filterKelas}` : 'Total'} Siswa Asuh</div>
                </div>
                <div className="gakl__statCard gakl__statActive">
                    <div className="gakl__statNum">{filteredStats.aktif}</div>
                    <div className="gakl__statLbl">Aktif</div>
                </div>
            </div>

            {/* Toolbar */}
            <FilterToolbar actionsInline>
                <FilterSelect
                    label="Tahun Ajaran"
                    icon="mortarboard"
                    value={tahunAjaran}
                    onChange={setTahunAjaran}
                    options={tahunOptions.map(t => ({ value: t, label: t }))}
                />
                {kelasList.length > 0 && (
                    <FilterSelect
                        label="Kelas"
                        icon="door-open"
                        value={filterKelas}
                        onChange={setFilterKelas}
                        options={[
                            { value: '', label: 'Semua Kelas' },
                            ...kelasList.map(k => ({ value: k, label: k })),
                        ]}
                    />
                )}
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari Nama / NISN Siswa..."
                />
                {tahunAjaran !== 'Semua' && (
                    <FilterActions>
                        <button className="ftb-btn ftb-btn--ghost ftb-btn-icon-mobile" onClick={handleBulkCopy} disabled={copying} title="Salin Tahun Lalu">
                            {copying ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-files" />} 
                            <span className="hidden-mobile">Salin Tahun Lalu</span>
                        </button>
                    </FilterActions>
                )}
            </FilterToolbar>

            <DesktopFab
                label="Klaim Siswa Asuh"
                icon="plus-lg"
                mobileLabel="Klaim"
                onClick={() => { setEditData(null); setShowForm(true); }}
            />
            <MobileFab
                label="Klaim Siswa Asuh"
                icon="plus-lg"
                mobileLabel="Klaim"
                onClick={() => { setEditData(null); setShowForm(true); }}
            />

            {/* Content */}
            <div className="gakl__content">
                {loading ? (
                    <div className="gakl__loading">
                        <Spinner variant="buble" size={18} />
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="gakl__empty">
                        <div className="gakl__emptyIcon"><i className="bi bi-people" /></div>
                        <h3>{list.length === 0 ? 'Belum Punya Siswa Asuh' : 'Tidak Ada di Kelas Ini'}</h3>
                        <p>{list.length === 0 ? 'Klik tombol "Klaim Siswa Asuh" untuk mulai menambahkan siswa asuh Anda.' : 'Pilih tahun ajaran atau kelas lain.'}</p>
                        {list.length === 0 && (
                            <button className="gakl__btnEmpty" onClick={() => { setEditData(null); setShowForm(true); }}>
                                <i className="bi bi-plus-circle-fill" /> Klaim Siswa Asuh
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="gakl__tableWrap">
                            <table className="gakl__table">
                                <thead>
                                    <tr>
                                        <th>No</th><th>Nama Siswa</th><th>Kelas</th><th>NISN</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedList.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td className="gakl__tdNum">{((page - 1) * pageSize) + idx + 1}</td>
                                            <td><div className="gakl__studentName">{item.nama_siswa}</div></td>
                                            <td><span className="gakl__kelasBadge">{item.kelas}</span></td>
                                            <td className="gakl__tdNisn">{item.nisn_siswa}</td>
                                            <td>
                                                <ActionGroup>
                                                    <ActionButton action="edit" onClick={() => handleEdit(item)} title="Edit" />
                                                    <ActionButton action="delete" onClick={() => handleDelete(item)} title="Hapus" />
                                                </ActionGroup>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="gakl__cards">
                            {paginatedList.map((item) => (
                                <div key={item.id} className="gakl__card">
                                    <div className="gakl__cardAvatar">
                                        {item.foto_profil && (
                                            <img
                                                src={getProxiedImageUrl(item.foto_profil)}
                                                alt={item.nama_siswa}
                                                className="gakl__avatarImg"
                                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                            />
                                        )}
                                        <span>{item.nama_siswa[0]}</span>
                                    </div>
                                    <div className="gakl__cardInfo">
                                        <div className="gakl__cardNama">{item.nama_siswa}</div>
                                        <div className="gakl__cardMeta">
                                            <span className="gakl__kelasBadge">{item.kelas}</span>
                                            <span className="gakl__tdNisn">NISN: {item.nisn_siswa}</span>
                                        </div>
                                    </div>
                                    <ActionGroup>
                                        <ActionButton action="edit" onClick={() => handleEdit(item)} title="Edit" />
                                        <ActionButton action="delete" onClick={() => handleDelete(item)} title="Hapus" />
                                    </ActionGroup>
                                </div>
                            ))}
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} limit={pageSize} totalItems={filteredList.length} onPageChange={setPage} onLimitChange={setPageSize} itemLabel="siswa" />
                    </>
                )}
            </div>

            {showForm && user && (
                <GuruAsuhForm
                    user={user}
                    editData={editData}
                    tahunAjaran={tahunAjaran}
                    onClose={() => { setShowForm(false); setEditData(null); }}
                    onSuccess={(msg) => { showMsg('success', msg); fetchData(); }}
                    onError={(msg) => showMsg('error', msg)}
                />
            )}

            {deleteTarget && (
                <Modal
                    size="sm"
                    variant="delete"
                    onClose={() => setDeleteTarget(null)}
                    labelledBy="klaim-delete-title"
                >
                    <ModalHeader
                        id="klaim-delete-title"
                        icon="trash3"
                        title={deleteTarget.nama_siswa}
                        onClose={() => setDeleteTarget(null)}
                    />
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => setDeleteTarget(null)} leftIcon={<i className="bi bi-x-lg" />}>
                            Batal
                        </Button>
                        <Button type="button" variant="danger" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
                            Ya, Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .gakl__wrap { display: flex; flex-direction: column; gap: 16px; animation: gaklFadeIn 0.3s ease-out; }
                @keyframes gaklFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

                /* Toast */
                .gakl__toast { position: fixed; bottom: 28px; right: 28px; padding: 14px 22px; border-radius: 14px; font-weight: 700; font-size: 0.88rem; box-shadow: 0 8px 30px rgba(0,0,0,0.18); z-index: 9999; display: flex; align-items: center; gap: 10px; animation: gaklToastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(8px); }
                @keyframes gaklToastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
                .gakl__toast--success { background: rgba(16,185,129,0.92); color: white; border: 1px solid rgba(255,255,255,0.2); }
                .gakl__toast--error { background: rgba(239,68,68,0.92); color: white; border: 1px solid rgba(255,255,255,0.2); }

                /* Stats */
                .gakl__statsGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .gakl__statCard { display: flex; flex-direction: column; align-items: center; padding: 16px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); text-align: center; transition: all 0.2s; }
                .gakl__statCard:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                .gakl__statNum { font-size: 2rem; font-weight: 900; color: var(--n-primary); }
                .gakl__statTotal .gakl__statNum { color: var(--n-primary); }
                .gakl__statActive .gakl__statNum { color: #1d4ed8; }
                .gakl__statLbl { font-size: 0.72rem; font-weight: 700; color: var(--n-muted); margin-top: 4px; }

                /* Toolbar */
                .gakl__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
                .gakl__filterGroup { display: flex; gap: 8px; flex-wrap: wrap; }
                .gakl__select-group { position: relative; display: flex; align-items: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 0 12px; gap: 8px; min-height: 42px; transition: all 0.2s; }
                .gakl__select-group i { font-size: 0.9rem; color: var(--n-muted); flex-shrink: 0; }
                .gakl__select-group select { flex: 1; border: none; background: transparent; padding: 10px 28px 10px 4px; font-size: 0.85rem; font-weight: 600; color: var(--n-ink); outline: none; appearance: none; -webkit-appearance: none; -moz-appearance: none; cursor: pointer; }
                .gakl__btnAdd { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; border: 1px solid #1a73e8; background: var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #1d6bf3 100%)); color: white; font-size: 0.85rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(26,115,232,0.25); transition: all 0.2s; }
                .gakl__btnAdd:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(26,115,232,0.35); filter: brightness(1.05); }
                .gakl__btnCopy { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-ink); font-size: 0.85rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: all 0.2s; }
                .gakl__btnCopy:hover:not(:disabled) { border-color: var(--n-primary); color: var(--n-primary); transform: translateY(-2px); }
                .gakl__btnCopy:disabled { opacity: 0.5; cursor: not-allowed; }
                @media (max-width: 600px) { .hidden-mobile { display: none; } .gakl__btnAdd, .gakl__btnCopy { padding: 10px 14px; } }

                /* Loading */
                .gakl__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px; color: var(--n-muted); }
                .gakl__spinner { width: 36px; height: 36px; border: 3px solid var(--n-border); border-top-color: var(--n-primary); border-radius: 50%; animation: gaklSpin 0.8s linear infinite; }
                @keyframes gaklSpin { to { transform: rotate(360deg); } }

                /* Empty */
                .gakl__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px 24px; text-align: center; }
                .gakl__emptyIcon { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--n-primary) 0%, #1d6bf3 100%); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white; }
                .gakl__empty h3 { font-size: 1rem; font-weight: 800; color: var(--n-ink); margin: 0; }
                .gakl__empty p { font-size: 0.82rem; color: var(--n-muted); margin: 0; max-width: 320px; line-height: 1.6; }
                .gakl__btnEmpty { display: flex; align-items: center; gap: 7px; padding: 10px 20px; border-radius: 12px; border: 1px solid #1a73e8; background: var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #1d6bf3 100%)); color: white; font-size: 0.85rem; font-weight: 700; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 12px rgba(26,115,232,0.25); }

                /* Table */
                .gakl__tableWrap { overflow-x: auto; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); }
                .gakl__table { width: 100%; border-collapse: collapse; }
                .gakl__table th { padding: 12px 16px; text-align: left; font-size: 0.72rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; border-bottom: 1px solid var(--n-border); }
                .gakl__table td { padding: 12px 16px; border-bottom: 1px solid var(--n-border); font-size: 0.85rem; color: var(--n-ink); }
                .gakl__table tr:last-child td { border-bottom: none; }
                .gakl__table tr:hover td { background: var(--n-soft); }
                .gakl__tdNum { color: var(--n-muted) !important; font-weight: 600; font-size: 0.8rem !important; width: 40px; }
                .gakl__studentName { font-weight: 700; color: var(--n-ink); }
                .gakl__kelasBadge { font-size: 0.72rem; font-weight: 700; background: linear-gradient(135deg, var(--n-primary) 0%, #1d6bf3 100%); color: white; padding: 3px 10px; border-radius: 50px; }
                .gakl__tdNisn { color: var(--n-muted) !important; font-size: 0.8rem !important; }
                .gakl__actions { display: flex; gap: 6px; }
                .gakl__btnEdit, .gakl__btnDelete { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--n-border); background: var(--n-card); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.15s; }
                .gakl__btnEdit { color: var(--n-primary); }
                .gakl__btnEdit:hover { background: var(--n-primary); color: white; border-color: var(--n-primary); }
                .gakl__btnDelete { color: #ef4444; }
                .gakl__btnDelete:hover { background: #ef4444; color: white; border-color: #ef4444; }

                /* Mobile Cards */
                .gakl__cards { display: none; flex-direction: column; gap: 8px; }
                .gakl__card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--n-border); background: var(--n-card); }
                .gakl__cardAvatar { width: 44px; height: 44px; border-radius: 14px; background: rgba(26, 115, 232, 0.08); border: 1px solid #1a73e8; display: flex; align-items: center; justify-content: center; color: #1a73e8; font-weight: 800; font-size: 1.1rem; flex-shrink: 0; position: relative; overflow: hidden; }
                .gakl__avatarImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gakl__cardInfo { flex: 1; }
                .gakl__cardNama { font-size: 0.9rem; font-weight: 700; color: var(--n-ink); }
                .gakl__cardMeta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
                .gakl__cardActions { display: flex; gap: 5px; }

                /* Dark */
                :global(.dark) .gakl__statCard { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gakl__statNum { color: #60a5fa !important; }
                :global(.dark) .gakl__statActive .gakl__statNum { color: #1d6bf3 !important; }
                :global(.dark) .gakl__statLbl { color: #94a3b8 !important; }
                :global(.dark) .gakl__select-group {
                    background-color: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gakl__select-group i {
                    color: #60a5fa !important;
                }
                :global(.dark) .gakl__select-group select {
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
                :global(.dark) .gakl__select-group select option {
                    background-color: #0b1329 !important;
                    color: #ffffff !important;
                }
                :global(.dark) .gakl__btnCopy { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gakl__btnAdd,
                :global(.dark) .gakl__btnEmpty { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.25) !important; }
                :global(.dark) .gakl__btnAdd:hover,
                :global(.dark) .gakl__btnEmpty:hover { background: rgba(26, 115, 232, 0.15) !important; border-color: #60a5fa !important; color: #ffffff !important; }
                :global(.dark) .gakl__tableWrap { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gakl__table { background: #0b1329 !important; }
                :global(.dark) .gakl__table th { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; }
                :global(.dark) .gakl__table td { border-bottom-color: rgba(26, 115, 232, 0.2) !important; color: #ffffff !important; }
                :global(.dark) .gakl__table tr:hover td { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .gakl__studentName { color: #ffffff !important; }
                :global(.dark) .gakl__btnEdit, :global(.dark) .gakl__btnDelete { background: #0b1329 !important; border-color: rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gakl__card { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gakl__cardAvatar { background: rgba(26, 115, 232, 0.15) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #60a5fa !important; }
                :global(.dark) .gakl__cardNama { color: #ffffff !important; }

                /* Responsive */
                @media (max-width: 640px) {
                    .gakl__toolbar { flex-direction: column; align-items: stretch; }
                    .gakl__filterGroup { flex-direction: column; }
                    .gakl__tableWrap { display: none; }
                    .gakl__cards { display: flex; }
                    .gakl__btnAdd { justify-content: center; }
                }
            `}</style>
        </div>
    );
}