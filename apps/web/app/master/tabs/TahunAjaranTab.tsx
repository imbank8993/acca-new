'use client';
import Pagination from '@/components/ui/Pagination';

import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';

interface TahunAjaran {
    id: number;
    tahun_ajaran: string;
    semester: string;
    is_active: boolean;
    created_at: string;
}

import { useModalBlur } from '@/components/ModalBlurProvider'
import { Spinner } from '@/components/ui/Spinner'
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalViewFooter } from '@/components/ui/Modal'
import { ActionButton } from '@/components/ui/ActionButtons'
import { useIsMobile } from '@/hooks/use-breakpoint'
import { DesktopFab } from '@/components/ui/DesktopFab'
import {
    MobileList,
    MobileListItem,
    MobileEmpty,
    MobileFab,
} from '@/components/mobile'
import { useMasterAccess } from '@/lib/use-master-access'

const STATUS_OPTIONS = [
    { value: 'semua', label: 'Semua Status' },
    { value: 'aktif', label: 'Aktif' },
    { value: 'nonaktif', label: 'Non-Aktif' },
]

const capitalize = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''

/**
 * Rentang bulan sebuah semester, diturunkan dari kalender sekolah Indonesia:
 * Ganjil = Juli–Desember tahun pertama, Genap = Januari–Juni tahun kedua.
 *
 * Diturunkan, bukan dibaca dari DB: `master_tahun_ajaran` tidak menyimpan
 * tanggal mulai/selesai. Dipakai hanya untuk teks bantu di daftar dan untuk
 * menandai mana yang sedang berjalan — tidak pernah untuk menulis data.
 */
function rentangSemester(tahunAjaran: string, semester: string) {
    const [y1, y2] = String(tahunAjaran).split('/').map(n => parseInt(n, 10))
    if (!y1) return null

    const s = String(semester).toLowerCase()
    if (s === 'ganjil') {
        return { mulai: new Date(y1, 6, 1), selesai: new Date(y1, 11, 31, 23, 59, 59), label: `Juli – Desember ${y1}` }
    }
    if (s === 'genap') {
        const yy = y2 || y1 + 1
        return { mulai: new Date(yy, 0, 1), selesai: new Date(yy, 5, 30, 23, 59, 59), label: `Januari – Juni ${yy}` }
    }
    return null // "Semua" — tidak terikat rentang bulan
}

/**
 * Tahun ajaran aktif selalu DUA baris (Ganjil + Genap), jadi badge "Aktif"
 * saja tidak menjawab "yang mana yang sedang berjalan sekarang?".
 */
function sedangBerjalan(item: TahunAjaran, now: Date) {
    if (!item.is_active) return false
    const r = rentangSemester(item.tahun_ajaran, item.semester)
    return !!r && now >= r.mulai && now <= r.selesai
}

export default function TahunAjaranTab({ user }: { user?: any }) {
    const [list, setList] = useState<TahunAjaran[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('semua')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10);
    const [showModal, setShowModal] = useState(false);
    const [newTahun, setNewTahun] = useState('');
    const [newSemester, setNewSemester] = useState('Ganjil');
    const [saving, setSaving] = useState(false);

    const isMobile = useIsMobile();

    // View Detail States — menyimpan ID, bukan salinan barisnya: setelah status
    // di-toggle dari dalam detail, salinan lama tidak ikut berubah sehingga
    // togglenya terlihat tidak bergerak sampai panel ditutup.
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const selectedTA = useMemo(
        () => list.find(l => l.id === selectedId) ?? null,
        [list, selectedId]
    );

    const handleView = (item: TahunAjaran) => setSelectedId(item.id);
    const closeView = () => setSelectedId(null);

    // Delete Modal States
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
    const [deleteItemName, setDeleteItemName] = useState('');
    const [deleting, setDeleting] = useState(false);

    const { registerModal } = useModalBlur()

    useEffect(() => {
        if (showModal || showDeleteModal || selectedId !== null) {
            return registerModal()
        }
    }, [showModal, showDeleteModal, selectedId, registerModal])

    // Permissions Check
    // Gerbangnya mengikuti backend (MasterController.resolveFlags): Admin ATAU
    // pemegang halaman `master`. Sebelumnya di sini hanya role ADMIN, sehingga
    // operator yang sah diberi halaman ini melihat layar tanpa satu tombol pun.
    // `isAdmin` dipertahankan sebagai nama untuk JSX di bawah.
    // `canManage` = ADMIN atau yang ditunjuk di Hak Akses Fitur.
    // `isAdminRole` khusus aksi yang TIDAK pernah diberikan lewat layar itu.
    const { boleh, isAdmin: isAdminRole } = useMasterAccess()
    const isAdmin = boleh('tahun-ajaran')
    const canManage = isAdmin

    useEffect(() => {
        fetchData();
    }, []);

    const sortTahunAjaran = (items: TahunAjaran[]): TahunAjaran[] => {
        return [...items].sort((a, b) => {
            const yearA = parseInt(String(a.tahun_ajaran).split('/')[0]) || 0;
            const yearB = parseInt(String(b.tahun_ajaran).split('/')[0]) || 0;
            if (yearA !== yearB) {
                return yearB - yearA;
            }
            const semOrder: Record<string, number> = { 'ganjil': 1, 'genap': 2, 'semua': 3 };
            const semA = semOrder[String(a.semester).toLowerCase()] || 99;
            const semB = semOrder[String(b.semester).toLowerCase()] || 99;
            return semA - semB;
        });
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/tahun-ajaran', { cache: 'no-store' });
            const json = await res.json();
            if (json.ok) setList(sortTahunAjaran(json.data));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (item: TahunAjaran) => {
        const newValue = !item.is_active;
        if (!newValue) {
            const activeCount = list.filter(l => l.is_active).length;
            if (activeCount <= 1) {
                Swal.fire('Info', 'Minimal harus ada satu Tahun Ajaran yang aktif.', 'info');
                return;
            }
        }

        // Optimistic update: ubah UI seketika agar responsif tanpa menunggu round-trip
        // ke server (di VPS latensi lebih tinggi). Tidak lagi memanggil fetchData()
        // yang menampilkan spinner & reload seluruh tabel.
        setList(prev => prev.map(l => (l.id === item.id ? { ...l, is_active: newValue } : l)));

        try {
            const res = await fetch('/api/admin/tahun-ajaran', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, is_active: newValue }),
                cache: 'no-store'
            });
            const json = await res.json();
            if (!json.ok) {
                // Gagal → kembalikan status semula
                setList(prev => prev.map(l => (l.id === item.id ? { ...l, is_active: item.is_active } : l)));
                Swal.fire('Gagal', json.error, 'error');
            }
        } catch (err) {
            console.error(err);
            setList(prev => prev.map(l => (l.id === item.id ? { ...l, is_active: item.is_active } : l)));
            Swal.fire('Gagal', 'Terjadi kesalahan jaringan. Coba lagi.', 'error');
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTahun) return;

        setSaving(true);
        try {
            const res = await fetch('/api/admin/tahun-ajaran', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tahun_ajaran: newTahun, semester: newSemester })
            });
            const json = await res.json();
            if (json.ok) {
                setNewTahun('');
                setNewSemester('Ganjil');
                setShowModal(false);
                fetchData();
                Swal.fire({ icon: 'success', title: 'Berhasil', timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire('Gagal', json.error, 'error');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: number, name: string) => {
        setDeleteItemId(id);
        setDeleteItemName(name);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteItemId) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/admin/tahun-ajaran?id=${deleteItemId}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                setShowDeleteModal(false);
                setDeleteItemId(null);
                setDeleteItemName('');
                fetchData();
                Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
            } else {
                Swal.fire('Gagal', json.error, 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

    const filteredList = useMemo(() => {
        return list.filter(item => {
            const matchSearch = !searchTerm ||
                (item.tahun_ajaran || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.semester || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = !statusFilter || statusFilter === 'semua' ||
                (statusFilter === 'aktif' ? item.is_active : !item.is_active);
            return matchSearch && matchStatus;
        });
    }, [list, searchTerm, statusFilter]);

    // Satu titik waktu untuk seluruh render: dipakai bersama oleh daftar, detail,
    // dan tabel desktop supaya tidak ada baris yang dinilai dengan jam berbeda.
    const now = new Date();

    const namaLengkap = (item: TahunAjaran) =>
        `${item.tahun_ajaran} · ${capitalize(item.semester)}`;

    const totalPages = Math.ceil(filteredList.length / pageSize);
    const paginatedList = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredList.slice(start, start + pageSize);
    }, [filteredList, page, pageSize]);

    /* ------------------------------- Mobile ------------------------------- */

    const renderMobile = () => (
        <>
            <div className="mui-meta">
                <span className="mui-count">{filteredList.length} tahun ajaran</span>
            </div>

            {loading ? (
                <div className="mui-loading"><Spinner variant="trace" /></div>
            ) : filteredList.length === 0 ? (
                <MobileEmpty
                    icon="calendar3"
                    title="Tidak ada data"
                    subtitle={searchTerm || statusFilter !== 'semua'
                        ? 'Tidak ada tahun ajaran yang cocok dengan saringan'
                        : 'Belum ada tahun ajaran yang dibuat'}
                />
            ) : (
                <MobileList label="Daftar tahun ajaran">
                    {paginatedList.map(item => {
                        const berjalan = sedangBerjalan(item, now)
                        return (
                            <MobileListItem
                                key={item.id}
                                icon="calendar3"
                                // Rona avatar dikunci ke tahunnya, bukan ke judul penuh:
                                // Ganjil & Genap dari tahun yang sama jadi sewarna.
                                seed={item.tahun_ajaran}
                                title={namaLengkap(item)}
                                subtitle={rentangSemester(item.tahun_ajaran, item.semester)?.label}
                                // Non-aktif TIDAK diberi badge: itu mayoritas isi daftar,
                                // menandainya di tiap baris cuma menambah derau.
                                badge={item.is_active
                                    ? <span className="mui-badge isOn">{berjalan ? 'Berjalan' : 'Aktif'}</span>
                                    : undefined}
                                onClick={() => handleView(item)}
                            />
                        )
                    })}
                </MobileList>
            )}
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                limit={pageSize}
                totalItems={filteredList.length}
                onPageChange={setPage}
                onLimitChange={setPageSize}
                itemLabel="tahun ajaran"
            />
        </>
    )

    /* ------------------------------- Toolbar ------------------------------ */

    /* Dipakai kedua mode, sama persis seperti tab Siswa dan tab master lainnya.
       FilterToolbar sudah punya wujud mobilenya sendiri di ≤639px: pil pencarian
       dengan tombol filter DI DALAM pil (`.ftb-embedded-filter-btn`) yang membuka
       modal filter. Toolbar mobile terpisah bikinan halaman ini dulu menaruh
       tombol filter di luar pil, jadi bentuknya beda sendiri dari tab tetangga.

       `actionsInline`: satu-satunya aksi (Tambah) kini jadi FAB di desktop maupun
       mobile, jadi baris aksinya tinggal kotak kosong — tapi celah 10px dari
       .ftb-mobile-wrap tetap terpakai. */
    const renderToolbar = () => (
        <FilterToolbar actionsInline>
            <FilterSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Cari tahun ajaran / semester..."
                label="Cari"
            />

            <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            />

        </FilterToolbar>
    )

    /* ------------------------------ Desktop ------------------------------- */

    const renderDesktop = () => (
        <>
            <div className="sk__tableWrap">
                <table className="sk__table">
                    <thead>
                        <tr>
                            <th className="cNo">No</th>
                            <th>Tahun Ajaran</th>
                            <th className="cSem">Semester</th>
                            <th className="cStatus">Status</th>
                            {isAdmin && <th className="cAksi">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={isAdmin ? 5 : 4} className="sk__loadingCell"><Spinner variant="trace" /></td></tr>
                        ) : filteredList.length === 0 ? (
                            <tr><td colSpan={isAdmin ? 5 : 4} className="sk__empty sk__muted">Belum ada data tahun ajaran.</td></tr>
                        ) : (
                            paginatedList.map((item, idx) => (
                                <tr key={item.id}>
                                    <td className="tCenter">{((page - 1) * pageSize) + idx + 1}</td>
                                    <td className="font-bold text-blue-600">{item.tahun_ajaran}</td>
                                    <td className="tCenter">
                                        <span className={`sk__semesterBadge ${item.semester.toLowerCase()}`}>
                                            {capitalize(item.semester)}
                                        </span>
                                    </td>
                                    <td className="tCenter">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <div
                                                className={`ta__toggle ${item.is_active ? 'isActive' : ''} ${!canManage ? 'isReadOnly' : ''}`}
                                                onClick={() => canManage && handleToggle(item)}
                                            >
                                                <div className="ta__toggleDot"></div>
                                            </div>
                                            <span className={`sk__status ${item.is_active ? 'isOn' : 'isOff'}`}>
                                                {item.is_active ? (sedangBerjalan(item, now) ? 'Berjalan' : 'Aktif') : 'Nonaktif'}
                                            </span>
                                        </div>
                                    </td>
                                    {isAdmin && (
                                        <td>
                                            <ActionButton action="delete" onClick={() => handleDelete(item.id, namaLengkap(item))} />
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                limit={pageSize}
                totalItems={filteredList.length}
                onPageChange={setPage}
                onLimitChange={setPageSize}
                itemLabel="tahun ajaran"
            />
        </>
    )

    /* Modal (Tambah + Detail) dipakai kedua mode — sama seperti GuruTab dkk:
       satu sumber (components/Modal.tsx + modal.css) untuk desktop & mobile,
       bukan sheet mobile terpisah. modal.css sudah punya layout
       @media (max-width: 767px) sendiri untuk breakpoint ini. */
    const renderModals = () => (
        <>
            {/* Modal Tambah */}
            {showModal && (
                <Modal
                    size="md"
                    variant="add"
                    onClose={() => setShowModal(false)}
                    labelledBy="ta-modal-title"
                >
                    <ModalHeader
                        id="ta-modal-title"
                        icon="plus-lg"
                        title="Tambah Tahun Ajaran"
                        subtitle="Tahun & semester baru"
                        onClose={() => setShowModal(false)}
                    />
                    <form onSubmit={handleAdd}>
                        <ModalBody>
                            <div className="sk__field">
                                <label>Tahun Ajaran <span className="required" style={{ color: '#ef4444' }}>*</span></label>
                                <input
                                    type="text"
                                    placeholder="Contoh: 2025/2026"
                                    value={newTahun}
                                    onChange={e => setNewTahun(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <p className="sk__hint">Gunakan format YYYY/YYYY (contoh: 2025/2026)</p>
                            </div>
                            <div className="sk__field" style={{ marginTop: '16px' }}>
                                <label>Semester <span className="required" style={{ color: '#ef4444' }}>*</span></label>
                                <select
                                    value={newSemester}
                                    onChange={e => setNewSemester(e.target.value)}
                                    required
                                >
                                    <option value="Ganjil">Ganjil</option>
                                    <option value="Genap">Genap</option>
                                    <option value="Semua">Semua</option>
                                </select>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button type="button" variant="cancel" onClick={() => setShowModal(false)} leftIcon={<i className="bi bi-x-lg" />}>
                                Batal
                            </Button>
                            <Button type="submit" variant="primary" isLoading={saving} disabled={!newTahun} leftIcon={<i className="bi bi-check-lg" />}>
                                Simpan
                            </Button>
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            {/* View Detail Modal */}
            {selectedTA && (
                <Modal size="md" variant="edit" onClose={closeView} labelledBy="ta-view-title">
                    <ModalHeader
                        id="ta-view-title"
                        icon="calendar-range"
                        title="Detail Data Tahun Ajaran"
                        subtitle="Informasi tahun ajaran dan semester aktif"
                        onClose={closeView}
                    />
                    <ModalBody>
                        <div className="sk__grid2">
                            <div className="sk__field sk__fieldFull">
                                <label>Tahun Ajaran</label>
                                <div className="sk__readInput font-mono" style={{ fontWeight: 750, fontSize: '0.92rem' }}>
                                    {selectedTA.tahun_ajaran || '-'}
                                </div>
                            </div>

                            <div className="sk__field">
                                <label>Semester</label>
                                <div className="sk__readInput">
                                    <span className={`badge-semester ${selectedTA.semester.toLowerCase()}`}>
                                        {capitalize(selectedTA.semester)}
                                    </span>
                                </div>
                            </div>

                            <div className="sk__field">
                                <label>Status</label>
                                <div className="sk__readInput">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div
                                            className={`ta__toggle ${selectedTA.is_active ? 'isActive' : ''} ${!canManage ? 'isReadOnly' : ''}`}
                                            onClick={() => canManage && handleToggle(selectedTA)}
                                        >
                                            <div className="ta__toggleDot"></div>
                                        </div>
                                        <span className={`ta__statusText ${selectedTA.is_active ? 'isActive' : 'isInactive'}`}>
                                            {selectedTA.is_active ? (sedangBerjalan(selectedTA, now) ? 'Berjalan' : 'Aktif') : 'Nonaktif'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalViewFooter
                        onClose={closeView}
                        onDelete={isAdmin ? () => { handleDelete(selectedTA.id, namaLengkap(selectedTA)); closeView(); } : undefined}
                    />
                </Modal>
            )}
        </>
    )

    // Sengaja BUKAN `.mui-surface` (semua lebur jadi satu bidang): di sini
    // kontrol dan data dipisah — kolom cari telanjang di atas kanvas, daftar
    // sebagai kartunya sendiri.
    return (
        <div className={isMobile ? 'mui ta' : 'ta ta--desktop'}>
            {renderToolbar()}
            {isMobile ? renderMobile() : renderDesktop()}

            {/* FAB digerbangi CSS (.mui-fabWrap), bukan `isMobile`: ambangnya harus
                sama persis dengan yang menyembunyikan tombol di toolbar. */}
            {/* Aksi utama tab: FAB melayang di desktop, tombol tengah bottom nav di mobile */}
            {isAdmin && <DesktopFab label="Tambah Tahun Ajaran" icon="plus-lg" onClick={() => setShowModal(true)} />}
            {isAdmin && <MobileFab label="Tambah Tahun Ajaran" onClick={() => setShowModal(true)} />}
            {renderModals()}

            {/* Delete Modal — dipakai kedua mode; konfirmasi hapus memang harus
                merebut perhatian, bukan menempel di tepi bawah layar. */}
            {showDeleteModal && (
                <Modal
                    size="sm"
                    variant="delete"
                    onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
                    labelledBy="ta-delete-title"
                >
                    <ModalHeader
                        id="ta-delete-title"
                        icon="trash3"
                        title={deleteItemName}
                        onClose={() => { setShowDeleteModal(false); setDeleteItemId(null); }}
                    />
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => { setShowDeleteModal(false); setDeleteItemId(null); }} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                        <Button type="button" variant="danger" onClick={confirmDelete} isLoading={deleting} leftIcon={<i className="bi bi-trash3-fill" />}>
                            Ya, Hapus
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .ta {
                  animation: fadeIn 0.3s ease-out;
                }
                /* Hanya varian desktop yang mengatur tata letaknya sendiri; di mobile
                   kerangkanya datang dari .mui / .mui-surface di
                   components/mobile/mobile-ui.css. Tidak ada lagi salinan
                   .sk__card* di berkas ini. */
                .ta--desktop {
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
                  position: relative;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                .ta__loadingCell {
                    text-align: center !important;
                    padding: 48px 16px !important;
                    background: transparent !important;
                }

                :global(.sk__tableWrap) { overflow-x: auto; margin-top: 8px; }
                :global(.sk__table) { width: 100%; border-collapse: collapse; background: var(--n-card, #ffffff); border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); border: 1px solid var(--n-border, #e2e8f0); }
                :global(.sk__table th) { background: linear-gradient(135deg, var(--n-primary, #3083ff) 0%, #3083FF 100%) !important; color: white !important; font-weight: 550 !important; font-size: 0.68rem !important; letter-spacing: 0.04em !important; text-transform: uppercase !important; padding: 10px 14px !important; text-align: left !important; white-space: nowrap !important; }
                :global(.sk__table td) { padding: 10px 14px !important; border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important; font-size: 0.88rem !important; color: var(--n-text, #0f172a) !important; vertical-align: middle !important; }
                :global(.sk__table tbody tr:last-child td) { border-bottom: none !important; }
                :global(.sk__table tbody tr:hover td) { background: rgba(59, 130, 246, 0.03) !important; }

                :global(.cNo) { width: 60px !important; text-align: center !important; }
                :global(.cSem) { width: 140px !important; text-align: center !important; }
                :global(.cStatus) { width: 200px !important; text-align: center !important; }
                :global(.cAksi) { width: 90px !important; text-align: center !important; }

                :global(.sk__semesterBadge) { display: inline-flex !important; padding: 4px 10px !important; border-radius: 8px !important; font-size: 0.78rem !important; font-weight: 600 !important; white-space: nowrap !important; }
                :global(.sk__semesterBadge.ganjil) { background: rgba(245, 158, 11, 0.1) !important; color: #d97706 !important; border: 1px solid rgba(245, 158, 11, 0.25) !important; }
                :global(.sk__semesterBadge.genap) { background: rgba(59, 130, 246, 0.1) !important; color: #3b82f6 !important; border: 1px solid rgba(59, 130, 246, 0.25) !important; }
                :global(.sk__semesterBadge.semua) { background: rgba(148, 163, 184, 0.15) !important; color: #64748b !important; border: 1px solid rgba(148, 163, 184, 0.25) !important; }

                :global(.sk__status) { display: inline-flex !important; padding: 4px 10px !important; border-radius: 6px !important; font-size: 0.78rem !important; font-weight: 600 !important; white-space: nowrap !important; text-transform: capitalize !important; }
                :global(.sk__status.isOn) { background: rgba(0, 56, 168, 0.08) !important; border: 1px solid rgba(0, 56, 168, 0.25) !important; color: #3083FF !important; }
                :global(.sk__status.isOff) { background: rgba(148, 163, 184, 0.12) !important; border: 1px solid rgba(148, 163, 184, 0.25) !important; color: #64748b !important; }

                .ta__loadingCell {
                    text-align: center !important;
                    padding: 48px 16px !important;
                    background: transparent !important;
                }

                .ta__tableWrap { background: var(--n-card); border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.22); overflow: hidden; box-shadow: 0 14px 34px rgba(2, 6, 23, 0.08); }
                .ta__table { width: 100%; border-collapse: collapse; }
                .ta__table th { padding: 12px 16px; text-align: left; background: var(--n-soft); color: var(--n-muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--n-border); }
                .ta__table td { padding: 12px 16px; border-bottom: 1px solid var(--n-border); vertical-align: middle; color: var(--n-text); font-size: 0.82rem; }
                .ta__table tr:last-child td { border-bottom: none; }
                .ta__table tbody tr:hover td { background: rgba(58, 166, 255, 0.04); }

                .tCenter { text-align: center; }
                .ta__name { font-weight: 700; color: var(--n-text); font-size: 0.88rem; }

                :global(.badge-semester) { padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; text-transform: capitalize; display: inline-block; }
                :global(.badge-semester.ganjil) { background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); }
                :global(.badge-semester.genap) { background: rgba(79, 70, 229, 0.12); color: #4f46e5; border: 1px solid rgba(79, 70, 229, 0.3); }
                :global(.badge-semester.semua) { background: rgba(37, 99, 235, 0.12); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.3); }

                .ta__status { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; }
                :global(.ta__toggle) {
                    width: 40px; height: 22px; background: #cbd5e1; border-radius: 99px; position: relative; cursor: pointer;
                    border: 1.5px solid #94a3b8; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0;
                }
                :global(.ta__toggle.isActive) { background: #2563eb; border-color: #1d4ed8; box-shadow: 0 0 10px rgba(37, 99, 235, 0.3); }
                :global(.ta__toggle.isReadOnly) { cursor: default; opacity: 0.8; }
                :global(.ta__toggleDot) {
                    width: 16px; height: 16px; background: #ffffff; border-radius: 50%; position: absolute;
                    top: 1.5px; left: 2px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                }
                :global(.ta__toggle.isActive .ta__toggleDot) { transform: translateX(18px); }

                :global(.ta__statusText) { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.03em; }
                :global(.ta__statusText.isActive) { color: #2563eb; }
                :global(.ta__statusText.isInactive) { color: #94a3b8; }

                :global(.sk__readInput) {
                  display: flex;
                  align-items: center;
                  width: 100%;
                  min-height: 42px;
                  padding: 8px 12px;
                  background: rgba(248, 250, 252, 0.85);
                  border: 1px solid var(--n-border, #e2e8f0);
                  border-radius: 10px;
                  color: var(--n-text, #0f172a);
                  font-size: var(--sk-fs-sm, 0.85rem);
                  box-sizing: border-box;
                }

                .ta__empty { padding: 40px; text-align: center; color: var(--n-muted); font-style: italic; }

                :global(.dark) .ta__tableWrap { background: var(--n-card); border-color: var(--n-border); }
                :global(.dark) .ta__table th { background: rgba(255,255,255,0.05); color: var(--n-muted); border-bottom-color: var(--n-border); }
                :global(.dark) .ta__table td { background: var(--n-card); color: var(--n-ink); border-bottom-color: var(--n-border); }
                :global(.dark) .ta__table tbody tr:hover td { background: rgba(79,142,247,0.05); }
                :global(.dark) .ta__name { color: var(--n-ink); }

                :global(.dark .sk__readInput) {
                  background: rgba(255, 255, 255, 0.05) !important;
                  border-color: rgba(59, 130, 246, 0.4) !important;
                  color: #ffffff !important;
                }

                :global(.dark .badge-semester.ganjil) { background: rgba(14, 165, 233, 0.18) !important; color: #38bdf8 !important; border: 1.5px solid rgba(56, 189, 248, 0.5) !important; box-shadow: 0 0 10px rgba(56, 189, 248, 0.25) !important; }
                :global(.dark .badge-semester.genap) { background: rgba(79, 70, 229, 0.22) !important; color: #818cf8 !important; border: 1.5px solid rgba(129, 140, 248, 0.6) !important; box-shadow: 0 0 10px rgba(129, 140, 248, 0.3) !important; }
                :global(.dark .badge-semester.semua) { background: rgba(37, 99, 235, 0.2) !important; color: #60a5fa !important; border: 1.5px solid rgba(96, 165, 250, 0.5) !important; box-shadow: 0 0 10px rgba(37, 99, 235, 0.25) !important; }

                :global(.dark .ta__toggle) { background: rgba(255, 255, 255, 0.08) !important; border-color: rgba(148, 163, 184, 0.4) !important; }
                :global(.dark .ta__toggleDot) { background: #cbd5e1 !important; }
                :global(.dark .ta__toggle.isActive) { background: #1a73e8 !important; border-color: #3b82f6 !important; box-shadow: 0 0 14px rgba(26, 115, 232, 0.6) !important; }
                :global(.dark .ta__toggle.isActive .ta__toggleDot) { background: #ffffff !important; box-shadow: 0 1px 4px rgba(0,0,0,0.5) !important; }

                :global(.dark .ta__statusText.isActive) { color: #60a5fa !important; text-shadow: 0 0 10px rgba(96, 165, 250, 0.4); }
                :global(.dark .ta__statusText.isInactive) { color: #94a3b8 !important; }

                :global(.dark) .ta__empty { color: var(--n-muted) !important; }
            `}</style>
        </div>
    );
}
