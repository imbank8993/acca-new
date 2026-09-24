'use client';

import { useState } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import Swal from 'sweetalert2';
import { ensureAbsoluteUrl } from '@/lib/url';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { getDeadlineInfo } from '../deadline';
import { getJenisInfo } from '../jenis';

interface TugasSiswa {
    id: number;
    guru_id: string | null;
    nama_guru: string;
    mapel_id: number | null;
    nama_mapel: string;
    kelas: string;
    kelas_list: string[] | null;
    judul_tugas: string;
    deskripsi: string | null;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    is_range: boolean;
    file_url: string | null;
    file_name: string | null;
    nisn_pembuat: string | null;
    nama_pembuat: string | null;
    tahun_ajaran: string | null;
    semester: number | null;
    created_by: string;
    created_by_nip: string | null;
    created_at: string;
    jenis?: 'tugas' | 'pengingat';
    ruangan?: string | null;
    durasi?: string | null;
    sifat_ujian?: string | null;
    target_siswa?: Record<string, string[]> | null;
}

interface TugasSiswaTableProps {
    data: TugasSiswa[];
    loading: boolean;
    isAdmin: boolean;
    isSiswa: boolean;
    isPengurusKelas: boolean;
    isGuru: boolean;
    userNip: string;
    userNama: string;
    onEdit: (tugas: TugasSiswa) => void;
    onDelete: (id: number) => void;
    onView: (tugas: TugasSiswa) => void;
    onViewFile?: (url: string, name: string) => void;
    checklistedIds?: number[];
    onToggleChecklist?: (id: number, current: boolean) => void;
}

export default function TugasSiswaTable({
    data,
    loading,
    isAdmin,
    isSiswa,
    isPengurusKelas,
    isGuru,
    userNip,
    userNama,
    onEdit,
    onDelete,
    onView,
    onViewFile,
    checklistedIds = [],
    onToggleChecklist
}: TugasSiswaTableProps) {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [activeKelasPopover, setActiveKelasPopover] = useState<number | null>(null);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(data.map(d => d.id));
        }
    };

    const handleDelete = (id: number) => {
        Swal.fire({
            title: 'Hapus Tugas?',
            text: 'Tugas yang dihapus tidak dapat dikembalikan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                onDelete(id);
            }
        });
    };

    const getBadgeClass = (kelas: string) => {
        if (kelas.includes('X ')) return 'badge-tingkat-1';
        if (kelas.includes('XI ')) return 'badge-tingkat-2';
        if (kelas.includes('XII ')) return 'badge-tingkat-3';
        return 'badge-tingkat-1';
    };

    if (loading && data.length === 0) {
        return <PageLoader label="Memuat data tugas…" minHeight="300px" />;
    }

    return (
        <div className={`tst__wrapper ${loading ? 'tst__wrapper--loading' : ''}`}>
            {data.length === 0 ? (
                <div className="tst__emptyState">
                    <div className="tst__emptyVisual">
                        <div className="tst__emptyCircle">
                            <i className="bi bi-clipboard-x"></i>
                        </div>
                        <div className="tst__emptyDecor tst__emptyDecor1"></div>
                        <div className="tst__emptyDecor tst__emptyDecor2"></div>
                        <div className="tst__emptyDecor tst__emptyDecor3"></div>
                    </div>
                    <div className="tst__emptyContent">
                        <div className="tst__emptyBadge">
                            <i className="bi bi-info-circle"></i>
                            Kosong
                        </div>
                        <h3 className="tst__emptyTitle">Belum Ada Tugas</h3>
                        <p className="tst__emptySub">
                            Belum ada tugas yang dibuat.<br />
                            Klik tombol <strong>Tambah Tugas</strong> untuk membuat tugas baru.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="tst__tableWrap">
                    <table className="tst__table">
                    <thead>
                        <tr>
                            <th className="tst__th tst__thCheck">
                                <i className="bi bi-check2-square"></i>
                            </th>
                            <th className="tst__th tst__thInfoMapel">Mata Pelajaran & Kelas</th>
                            <th className="tst__th tst__thTugas">Tugas</th>
                            <th className="tst__th tst__thTanggal">Deadline</th>
                            <th className="tst__th tst__thLampiran">Lampiran</th>
                            <th className="tst__th tst__thAksi">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((tugas, index) => {
                            const dlInfo = getDeadlineInfo(tugas.tanggal_selesai || tugas.tanggal_mulai);
                            const jenisInfo = getJenisInfo(tugas.jenis);
                            // Baris yang sudah lewat deadline tidak lagi diberi latar
                            // merah — sorotan hanya untuk yang masih perlu dikerjakan.
                            const rowCls = dlInfo.tone === 'today' || dlInfo.tone === 'h1'
                                ? 'tst__row--overdue'
                                : (dlInfo.tone === 'h2' || dlInfo.tone === 'h3') ? 'tst__row--urgent' : '';
                            return (
                            <tr key={tugas.id} className={`${index % 2 === 0 ? 'even' : 'odd'} ${rowCls}`}>
                                <td className="tst__td tst__check">
                                    <button
                                        className={`tst__checkBtn ${checklistedIds.includes(tugas.id) ? 'checked' : ''}`}
                                        onClick={() => onToggleChecklist && onToggleChecklist(tugas.id, checklistedIds.includes(tugas.id))}
                                        title={checklistedIds.includes(tugas.id) ? 'Batalkan' : 'Tandai selesai'}
                                    >
                                        {checklistedIds.includes(tugas.id) ? (
                                            <i className="bi bi-check-circle-fill tst__checkMark"></i>
                                        ) : (
                                            <i className={`bi bi-${jenisInfo.icon} tst__checkIcon ${jenisInfo.isPengingat ? 'tst__checkIcon--pengingat' : ''}`}></i>
                                        )}
                                    </button>
                                </td>
                                <td className="tst__td">
                                    <div className="tst__infoMapel" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div className="tst__mapelName">
                                            <span>{tugas.nama_mapel}</span>
                                        </div>
                                        
                                        <div className="tst__kelasList" style={{ position: 'relative' }}>
                                            {(() => {
                                                let kelasArr: string[] = [];
                                                if (tugas.kelas_list) {
                                                    if (typeof tugas.kelas_list === 'string') {
                                                        try { kelasArr = JSON.parse(tugas.kelas_list); } catch { kelasArr = []; }
                                                    } else if (Array.isArray(tugas.kelas_list)) {
                                                        kelasArr = tugas.kelas_list;
                                                    }
                                                }
                                                if (kelasArr.length === 0 && tugas.kelas) {
                                                    kelasArr = tugas.kelas.split(',').map(k => k.trim()).filter(Boolean);
                                                }
                                                
                                                if (kelasArr.length === 0) return null;

                                                if (kelasArr.length > 1) {
                                                    return (
                                                        <div 
                                                            className="tst__kelasBadge badge-tingkat-more tst__clickableKelas" 
                                                            style={{ gap: '6px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveKelasPopover(activeKelasPopover === tugas.id ? null : tugas.id);
                                                            }}
                                                            title="Klik untuk melihat daftar kelas"
                                                        >
                                                            <i className="bi bi-collection"></i> {kelasArr.length} Kelas
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <span 
                                                        className={`tst__kelasBadge ${getBadgeClass(kelasArr[0])} tst__clickableKelas`}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => onView(tugas)}
                                                    >
                                                        {kelasArr[0]}
                                                    </span>
                                                );
                                            })()}

                                            {activeKelasPopover === tugas.id && (
                                                <>
                                                    <div 
                                                        className="tst__popoverOverlay" 
                                                        onClick={(e) => { e.stopPropagation(); setActiveKelasPopover(null); }}
                                                    />
                                                    <div className="tst__kelasPopover">
                                                        <div className="tst__kelasPopoverHeader">
                                                            <span>Daftar Kelas</span>
                                                            <button onClick={(e) => { e.stopPropagation(); setActiveKelasPopover(null); }}><i className="bi bi-x"></i></button>
                                                        </div>
                                                        <div className="tst__kelasPopoverList">
                                                            {(() => {
                                                                let kelasArr: string[] = [];
                                                                if (tugas.kelas_list) {
                                                                    if (typeof tugas.kelas_list === 'string') {
                                                                        try { kelasArr = JSON.parse(tugas.kelas_list); } catch { kelasArr = []; }
                                                                    } else if (Array.isArray(tugas.kelas_list)) {
                                                                        kelasArr = tugas.kelas_list;
                                                                    }
                                                                }
                                                                if (kelasArr.length === 0 && tugas.kelas) {
                                                                    kelasArr = tugas.kelas.split(',').map(k => k.trim()).filter(Boolean);
                                                                }
                                                                return kelasArr.map((k, i) => {
                                                                    const targetArr = tugas.target_siswa?.[k];
                                                                    const isSpecific = targetArr && targetArr.length > 0;
                                                                    return (
                                                                        <div key={i} className="tst__kelasPopoverItem">
                                                                            <span className={`tst__kelasBadge ${getBadgeClass(k)}`}>{k}</span>
                                                                            <span className="tst__kelasPopoverCount">
                                                                                {isSpecific ? `${targetArr.length} Siswa Terpilih` : 'Semua Siswa'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="tst__guruSub" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                            <span>{tugas.nama_guru}</span>
                                            {tugas.created_by && (
                                                <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>Penginput: {tugas.created_by}</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="tst__td">
                                    <button
                                        onClick={() => onView(tugas)}
                                        className="tst__titleBtn"
                                        title="Klik untuk melihat detail"
                                    >
                                        <span className="tst__judul">{tugas.judul_tugas}</span>
                                    </button>
                                    {tugas.deskripsi && (
                                        <div className="tst__deskripsi">{tugas.deskripsi}</div>
                                    )}
                                </td>
                                <td className="tst__td">
                                    <div className="tst__tanggal">
                                        {tugas.is_range && tugas.tanggal_selesai ? (
                                            <>
                                                <div className="tst__range">
                                                    <span className="tst__dateStart">{formatDate(tugas.tanggal_mulai)}</span>
                                                    <i className="bi bi-arrow-right tst__arrow"></i>
                                                    <span className="tst__dateEnd">{formatDate(tugas.tanggal_selesai)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span className="tst__dateSingle">{formatDate(tugas.tanggal_mulai)}</span>
                                        )}
                                        <div className={`tst__deadlineInfo tst__deadlineInfo--${dlInfo.tone}`}>
                                            <i className={`bi bi-${dlInfo.icon}`}></i>
                                            <span>{dlInfo.text}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="tst__td tst__center">
                                    {tugas.file_url ? (
                                        <ActionButton
                                            action="file"
                                            onClick={() => onViewFile && onViewFile(ensureAbsoluteUrl(tugas.file_url!), tugas.file_name || 'Lampiran')}
                                            className="tst__miniFileIcon"
                                            title={tugas.file_name || 'Lihat Lampiran'}
                                        />
                                    ) : (
                                        <span className="tst__noFile">-</span>
                                    )}
                                </td>
                                <td className="tst__td">
                                    <ActionGroup className="tst__actions">
                                        <ActionButton
                                            action="view"
                                            onClick={() => onView(tugas)}
                                            className="tst__btn tst__btnView"
                                            title="Lihat Detail"
                                        />
                                        {(isAdmin || ((isSiswa || isPengurusKelas) && tugas.nisn_pembuat === userNip) || (isGuru && tugas.created_by_nip === userNip)) && (
                                            <>
                                                <ActionButton
                                                    action="edit"
                                                    onClick={() => onEdit(tugas)}
                                                    className="tst__btn tst__btnEdit"
                                                    title="Edit"
                                                />
                                                <ActionButton
                                                    action="delete"
                                                    onClick={() => handleDelete(tugas.id)}
                                                    className="tst__btn tst__btnDelete"
                                                    title="Hapus"
                                                />
                                            </>
                                        )}
                                    </ActionGroup>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            )}

            <style jsx>{`
                .tst__wrapper {
                    width: 100%;
                    transition: opacity 0.2s ease;
                }

                .tst__wrapper--loading {
                    opacity: 0.6;
                    pointer-events: none;
                }

                .tst__loadingState {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 48px 20px;
                    color: var(--n-muted);
                    gap: 12px;
                }

                .tst__spinner {
                    font-size: 2rem;
                    color: var(--n-primary);
                }

                .spin-icon {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .tst__emptyState {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 56px 32px;
                    gap: 20px;
                }

                .tst__emptyVisual {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100px;
                    height: 100px;
                }

                .tst__emptyCircle {
                    width: 88px;
                    height: 88px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(0,63,136,0.08) 0%, rgba(194,24,91,0.08) 100%);
                    border: 2px solid rgba(0,63,136,0.12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.2rem;
                    color: var(--n-primary);
                    position: relative;
                    z-index: 1;
                }

                .tst__emptyDecor {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(0,63,136,0.06);
                }

                .tst__emptyDecor1 {
                    width: 120px;
                    height: 120px;
                    top: -10px;
                    left: -10px;
                    animation: pulseDecor 3s ease-in-out infinite;
                }

                .tst__emptyDecor2 {
                    width: 80px;
                    height: 80px;
                    bottom: -8px;
                    right: -12px;
                    background: rgba(194,24,91,0.06);
                    animation: pulseDecor 3s ease-in-out infinite 0.5s;
                }

                .tst__emptyDecor3 {
                    width: 40px;
                    height: 40px;
                    top: -16px;
                    right: 0px;
                    background: rgba(0,63,136,0.04);
                    animation: pulseDecor 3s ease-in-out infinite 1s;
                }

                @keyframes pulseDecor {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.08); opacity: 0.7; }
                }

                .tst__emptyContent {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    text-align: center;
                }

                .tst__emptyBadge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 14px;
                    background: rgba(0,63,136,0.06);
                    border: 1px solid rgba(0,63,136,0.12);
                    border-radius: 20px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--n-primary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .tst__emptyBadge i {
                    font-size: 0.75rem;
                }

                .tst__emptyTitle {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    margin: 0;
                }

                .tst__emptySub {
                    font-size: 0.85rem;
                    color: var(--n-muted);
                    margin: 0;
                    line-height: 1.6;
                }

                .tst__emptySub strong {
                    color: var(--n-ink);
                    font-weight: 600;
                }

                .tst__tableWrap {
                    overflow-x: auto;
                    border-radius: 0;
                    border: none;
                    background: transparent;
                    box-shadow: none;
                }

                .tst__table {
                    width: 100%;
                    min-width: 900px;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }

                .tst__th {
                    padding: 10px 14px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--n-muted);
                    background: rgba(0,63,136,0.03);
                    border-bottom: 2px solid var(--n-border);
                    white-space: nowrap;
                }

                .tst__thInfoMapel { min-width: 160px; }
                .tst__thTugas { min-width: 200px; }
                .tst__thTanggal { min-width: 150px; }
                .tst__thLampiran { min-width: 100px; text-align: center; }
                .tst__thAksi { min-width: 100px; text-align: center; }
                .tst__thCheck { width: 48px; text-align: center; font-size: 0.85rem; }

                .tst__td {
                    padding: 10px 14px;
                    border-bottom: 1px solid rgba(0,63,136,0.05);
                    vertical-align: top;
                }

                .tst__table tbody tr {
                    transition: background 0.15s ease;
                }

                .tst__table tbody tr:hover {
                    background: var(--n-soft);
                }

                .tst__table tbody tr:last-child td {
                    border-bottom: none;
                }

                .tst__check {
                    text-align: center;
                    width: 48px;
                }

                /* Kotak nomor (berfungsi sebagai checklist): sudut lengkung tipis,
                   ikon centang muncul di pojok kanan atas saat aktif */
                .tst__checkBtn {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    border-radius: 6px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-muted);
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tst__checkBtn:hover {
                    border-color: #22c55e;
                    color: #22c55e;
                    background: rgba(34, 197, 94, 0.08);
                    transform: scale(1.06);
                }

                .tst__checkBtn.checked {
                    background: rgba(34, 197, 94, 0.12);
                    border-color: #22c55e;
                    color: #166534;
                }

                .tst__checkIcon {
                    line-height: 1;
                    font-size: 0.85rem;
                    color: #3b82f6;
                }
                
                .tst__checkIcon--pengingat {
                    color: #06b6d4;
                }
                
                :global(.dark) .tst__checkIcon {
                    color: #3b82f6;
                }

                :global(.dark) .tst__checkIcon--pengingat {
                    color: #38bdf8;
                }

                .tst__checkMark {
                    font-size: 1.1rem;
                    line-height: 1;
                    color: #2563eb;
                }

                .tst__mapelName {
                    font-weight: 700;
                    color: var(--n-primary);
                    font-size: 0.88rem;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                /* Penanda jenis — lihat app/tugas-siswa/jenis.ts */
                .tst__jenisIcon {
                    flex-shrink: 0;
                    font-size: 0.85rem;
                    color: var(--n-muted);
                    cursor: help;
                }

                .tst__jenisIcon--pengingat { color: #1d4ed8; }

                :global(.dark) .tst__jenisIcon--pengingat { color: #60a5fa; }

                :global(.dark) .tst__checkBtn {
                    background: #000000 !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: var(--n-muted);
                }

                :global(.dark) .tst__checkBtn:hover {
                    border-color: #3b82f6 !important;
                    color: #60a5fa !important;
                    background: rgba(26, 115, 232, 0.15) !important;
                }

                :global(.dark) .tst__checkBtn.checked {
                    background: rgba(26, 115, 232, 0.25) !important;
                    border-color: #3b82f6 !important;
                    color: #60a5fa !important;
                }

                :global(.dark) .tst__checkMark {
                    color: #60a5fa !important;
                    background: transparent !important;
                }

                .tst__checkbox {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                    accent-color: var(--n-primary);
                }

                .tst__infoMapel {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }
                .tst__mapelName {
                    font-weight: 700;
                    color: var(--n-primary);
                    font-size: 0.88rem;
                }
                .tst__guruSub {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    font-weight: 500;
                    white-space: nowrap;
                }

                .tst__kelasBadge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-align: center;
                    white-space: normal;
                    line-height: 1.2;
                }

                .tst__kelasList {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                }

                .badge-tingkat-1 {
                    background: rgba(59, 130, 246, 0.12);
                    color: #2563eb;
                }

                .badge-tingkat-2 {
                    background: rgba(16, 185, 129, 0.12);
                    color: #059669;
                }

                .badge-tingkat-3 {
                    background: rgba(59, 130, 246, 0.12);
                    color: #3083FF;
                }

                .badge-tingkat-more {
                    background: rgba(100, 116, 139, 0.12);
                    color: #475569;
                }

                .tst__clickableKelas {
                    transition: opacity 0.2s;
                }
                .tst__clickableKelas:hover {
                    opacity: 0.7;
                }

                .tst__popoverOverlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    z-index: 99;
                }

                .tst__kelasPopover {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 8px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    border: 1px solid var(--n-border);
                    z-index: 100;
                    width: 260px;
                    overflow: hidden;
                    animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes popIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .tst__kelasPopoverHeader {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    background: rgba(0,63,136,0.03);
                    border-bottom: 1px solid var(--n-border);
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--n-ink);
                }

                .tst__kelasPopoverHeader button {
                    background: none;
                    border: none;
                    color: var(--n-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    transition: all 0.2s;
                }

                .tst__kelasPopoverHeader button:hover {
                    background: rgba(0,0,0,0.05);
                    color: var(--n-ink);
                }

                .tst__kelasPopoverList {
                    padding: 8px;
                    max-height: 200px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .tst__kelasPopoverItem {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px;
                    border-radius: 8px;
                    background: var(--n-bg);
                }

                .tst__kelasPopoverCount {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }

                .tst__titleBtn {
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    text-align: left;
                    width: 100%;
                }

                .tst__judul {
                    font-weight: 600;
                    color: var(--n-ink);
                    display: block;
                    line-height: 1.4;
                    transition: color 0.15s ease;
                }

                .tst__titleBtn:hover .tst__judul {
                    color: var(--n-primary);
                    text-decoration: underline;
                }

                .tst__deskripsi {
                    font-size: 0.78rem;
                    color: var(--n-muted);
                    margin-top: 4px;
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .tst__tanggal {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .tst__range {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.82rem;
                    flex-wrap: wrap;
                }

                .tst__dateStart {
                    color: var(--n-ink);
                    font-weight: 500;
                }

                .tst__arrow {
                    color: var(--n-muted);
                    font-size: 0.7rem;
                }

                .tst__dateEnd {
                    color: var(--n-ink);
                    font-weight: 500;
                }

                .tst__dateSingle {
                    font-weight: 500;
                    color: var(--n-ink);
                }

                .tst__deadlineInfo {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--n-muted);
                }

                /* Gradasi mendekati deadline: oranye → merah pekat.
                   Sudah lewat = abu-abu (redup), bukan merah. */
                .tst__deadlineInfo--lewat { color: #94a3b8; font-weight: 600; }
                .tst__deadlineInfo--jauh  { color: var(--n-muted); }
                .tst__deadlineInfo--h3    { color: #f59e0b; }
                .tst__deadlineInfo--h2    { color: #f97316; }
                .tst__deadlineInfo--h1    { color: #ef4444; }
                .tst__deadlineInfo--today { color: #b91c1c; font-weight: 800; }

                :global(.dark) .tst__deadlineInfo--lewat { color: #64748b; }
                :global(.dark) .tst__deadlineInfo--h3    { color: #fbbf24; }
                :global(.dark) .tst__deadlineInfo--h2    { color: #fb923c; }
                :global(.dark) .tst__deadlineInfo--h1    { color: #f87171; }
                :global(.dark) .tst__deadlineInfo--today { color: #ff5f5f; }

                .tst__center { text-align: center; }

                .tst__row--overdue td { background: rgba(239,68,68,0.04) !important; }
                .tst__row--urgent td { background: rgba(245,158,11,0.04) !important; }
                .tst__row--overdue:hover td { background: rgba(239,68,68,0.08) !important; }
                .tst__row--urgent:hover td { background: rgba(245,158,11,0.08) !important; }

                .tst__miniFileIcon { color: var(--n-primary); font-size: 1.1rem; }

                .tst__rangeLabel {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    background: rgba(59, 130, 246, 0.1);
                    color: #3083FF;
                    border-radius: 10px;
                    font-weight: 500;
                    width: fit-content;
                }

                .tst__fileLink {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: rgba(59, 130, 246, 0.08);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 10px;
                    color: var(--n-primary);
                    font-size: 0.78rem;
                    font-weight: 500;
                    text-decoration: none;
                    transition: all 0.2s ease;
                    max-width: 150px;
                }

                .tst__fileLink:hover {
                    background: rgba(59, 130, 246, 0.15);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
                }

                .tst__fileName {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .tst__noFile {
                    color: var(--n-muted);
                    font-size: 0.82rem;
                }

                .tst__actions {
                    display: flex;
                    justify-content: center;
                    gap: 6px;
                }

                .tst__btn {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 0.85rem;
                }

                .tst__btnView {
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--n-primary);
                }

                .tst__btnView:hover {
                    background: rgba(59, 130, 246, 0.2);
                    transform: translateY(-1px);
                }

                .tst__btnEdit {
                    background: rgba(16, 185, 129, 0.1);
                    color: #059669;
                }

                .tst__btnEdit:hover {
                    background: rgba(16, 185, 129, 0.2);
                    transform: translateY(-1px);
                }

                .tst__btnDelete {
                    background: rgba(239, 68, 68, 0.1);
                    color: #dc2626;
                }

                .tst__btnDelete:hover {
                    background: rgba(239, 68, 68, 0.2);
                    transform: translateY(-1px);
                }

                /* Mobile Cards */
                @media (max-width: 768px) {
                    .tst__tableWrap {
                        display: none;
                    }

                    .tst__mobileCards {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                }

                /* Dark Mode */
                :global(.dark) .tst__tableWrap {
                    background: transparent;
                }

                :global(.dark) .tst__emptyCircle {
                    background: linear-gradient(135deg, rgba(79,142,247,0.12) 0%, rgba(79,142,247,0.06) 100%);
                    border-color: rgba(79,142,247,0.2);
                    color: #60a5fa;
                }

                :global(.dark) .tst__emptyDecor1 {
                    background: rgba(79,142,247,0.06);
                }

                :global(.dark) .tst__emptyDecor2 {
                    background: rgba(99,102,241,0.06);
                }

                :global(.dark) .tst__emptyDecor3 {
                    background: rgba(79,142,247,0.04);
                }

                :global(.dark) .tst__emptyBadge {
                    background: rgba(79,142,247,0.1);
                    border-color: rgba(79,142,247,0.2);
                    color: #60a5fa;
                }

                :global(.dark) .tst__emptyTitle {
                    color: #e2e8f0;
                }

                :global(.dark) .tst__emptySub {
                    color: var(--n-muted);
                }

                :global(.dark) .tst__emptySub strong {
                    color: #e2e8f0;
                }

                :global(.dark) .tst__th {
                    background: rgba(79,142,247,0.06);
                    color: var(--n-muted);
                    border-bottom-color: rgba(255,255,255,0.08);
                }

                :global(.dark) .tst__td {
                    border-bottom-color: rgba(255,255,255,0.04);
                }

                :global(.dark) .tst__table tbody tr:hover {
                    background: rgba(79,142,247,0.06);
                }

                :global(.dark) .tst__guruName,
                :global(.dark) .tst__dateStart,
                :global(.dark) .tst__dateEnd,
                :global(.dark) .tst__dateSingle {
                    color: #e2e8f0;
                }

                :global(.dark) .tst__mapel {
                    color: #60a5fa;
                }

                :global(.dark) .tst__kelasBadge {
                    background: rgba(96, 165, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .badge-tingkat-1 {
                    background: rgba(96, 165, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .badge-tingkat-2 {
                    background: rgba(52, 211, 153, 0.15);
                    color: #34d399;
                }

                :global(.dark) .badge-tingkat-3 {
                    background: rgba(167, 139, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .tst__rangeLabel {
                    background: rgba(167, 139, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .tst__fileLink {
                    background: rgba(59, 130, 246, 0.12);
                    border-color: rgba(59, 130, 246, 0.25);
                    color: #60a5fa;
                }

                :global(.dark) .tst__fileLink:hover {
                    background: rgba(59, 130, 246, 0.2);
                }

                :global(.dark) .tst__btnView {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .tst__btnView:hover {
                    background: rgba(59, 130, 246, 0.25);
                }

                :global(.dark) .tst__btnEdit {
                    background: rgba(52, 211, 153, 0.15);
                    color: #34d399;
                }

                :global(.dark) .tst__btnEdit:hover {
                    background: rgba(52, 211, 153, 0.25);
                }

                :global(.dark) .tst__btnDelete {
                    background: rgba(248, 113, 113, 0.15);
                    color: #f87171;
                }

                :global(.dark) .tst__btnDelete:hover {
                    background: rgba(248, 113, 113, 0.25);
                }

                :global(.dark) .tst__kelasPopover {
                    background: #1e293b;
                    border-color: rgba(255,255,255,0.1);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                }

                :global(.dark) .tst__kelasPopoverHeader {
                    background: rgba(255,255,255,0.03);
                    border-bottom-color: rgba(255,255,255,0.08);
                    color: #e2e8f0;
                }

                :global(.dark) .tst__kelasPopoverHeader button:hover {
                    background: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }

                :global(.dark) .tst__kelasPopoverItem {
                    background: rgba(255,255,255,0.03);
                }

                /* -- Dark Mode: pola referensi master/pengaturan-data.
                }

                .tst__btnView {
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--n-primary);
                }

                .tst__btnView:hover {
                    background: rgba(59, 130, 246, 0.2);
                    transform: translateY(-1px);
                }

                .tst__btnEdit {
                    background: rgba(16, 185, 129, 0.1);
                    color: #059669;
                }

                .tst__btnEdit:hover {
                    background: rgba(16, 185, 129, 0.2);
                    transform: translateY(-1px);
                }

                .tst__btnDelete {
                    background: rgba(239, 68, 68, 0.1);
                    color: #dc2626;
                }

                .tst__btnDelete:hover {
                    background: rgba(239, 68, 68, 0.2);
                    transform: translateY(-1px);
                }

                /* Mobile Cards */
                @media (max-width: 768px) {
                    .tst__tableWrap {
                        display: none;
                    }

                    .tst__mobileCards {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                }

                /* Dark Mode */
                :global(.dark) .tst__tableWrap {
                    background: transparent;
                }

                :global(.dark) .tst__emptyCircle {
                    background: linear-gradient(135deg, rgba(79,142,247,0.12) 0%, rgba(79,142,247,0.06) 100%);
                    border-color: rgba(79,142,247,0.2);
                    color: #60a5fa;
                }

                :global(.dark) .tst__emptyDecor1 {
                    background: rgba(79,142,247,0.06);
                }

                :global(.dark) .tst__emptyDecor2 {
                    background: rgba(99,102,241,0.06);
                }

                :global(.dark) .tst__emptyDecor3 {
                    background: rgba(79,142,247,0.04);
                }

                :global(.dark) .tst__emptyBadge {
                    background: rgba(79,142,247,0.1);
                    border-color: rgba(79,142,247,0.2);
                    color: #60a5fa;
                }

                :global(.dark) .tst__emptyTitle {
                    color: #e2e8f0;
                }

                :global(.dark) .tst__emptySub {
                    color: var(--n-muted);
                }

                :global(.dark) .tst__emptySub strong {
                    color: #e2e8f0;
                }

                :global(.dark) .tst__th {
                    background: rgba(79,142,247,0.06);
                    color: var(--n-muted);
                    border-bottom-color: rgba(255,255,255,0.08);
                }

                :global(.dark) .tst__td {
                    border-bottom-color: rgba(255,255,255,0.04);
                }

                :global(.dark) .tst__table tbody tr:hover {
                    background: rgba(79,142,247,0.06);
                }

                :global(.dark) .tst__guruName,
                :global(.dark) .tst__dateStart,
                :global(.dark) .tst__dateEnd,
                :global(.dark) .tst__dateSingle {
                    color: #e2e8f0;
                }

                :global(.dark) .tst__mapel {
                    color: #60a5fa;
                }

                :global(.dark) .tst__kelasBadge {
                    background: rgba(96, 165, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .badge-tingkat-1 {
                    background: rgba(96, 165, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .badge-tingkat-2 {
                    background: rgba(52, 211, 153, 0.15);
                    color: #34d399;
                }

                :global(.dark) .badge-tingkat-3 {
                    background: rgba(167, 139, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .tst__rangeLabel {
                    background: rgba(167, 139, 250, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .tst__fileLink {
                    background: rgba(59, 130, 246, 0.12);
                    border-color: rgba(59, 130, 246, 0.25);
                    color: #60a5fa;
                }

                :global(.dark) .tst__fileLink:hover {
                    background: rgba(59, 130, 246, 0.2);
                }

                :global(.dark) .tst__btnView {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                }

                :global(.dark) .tst__btnView:hover {
                    background: rgba(59, 130, 246, 0.25);
                }

                :global(.dark) .tst__btnEdit {
                    background: rgba(52, 211, 153, 0.15);
                    color: #34d399;
                }

                :global(.dark) .tst__btnEdit:hover {
                    background: rgba(52, 211, 153, 0.25);
                }

                :global(.dark) .tst__btnDelete {
                    background: rgba(248, 113, 113, 0.15);
                    color: #f87171;
                }

                :global(.dark) .tst__btnDelete:hover {
                    background: rgba(248, 113, 113, 0.25);
                }

                :global(.dark) .tst__kelasPopover {
                    background: #1e293b;
                    border-color: rgba(255,255,255,0.1);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                }

                :global(.dark) .tst__kelasPopoverHeader {
                    background: rgba(255,255,255,0.03);
                    border-bottom-color: rgba(255,255,255,0.08);
                    color: #e2e8f0;
                }

                :global(.dark) .tst__kelasPopoverHeader button:hover {
                    background: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }

                :global(.dark) .tst__kelasPopoverItem {
                    background: rgba(255,255,255,0.03);
                }

                /* -- Dark Mode: pola referensi master/pengaturan-data.
                   Palet biru bersama (sama di semua halaman): aksen #60a5fa
                   diletakkan paling akhir agar menang atas aturan dark di
                   atasnya (urutan cascade + !important). -- */
                /* Bingkai HANYA di .tst__wrapper. .tst__tableWrap bersarang di
                   dalamnya (baris 155) — kalau ikut diberi bingkai, hasilnya
                   kotak di dalam kotak. */
                
                /* ===== DARK MODE STANDARD ===== */
                :global(.dark) .tst__wrapper { background: transparent !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
                :global(.dark) .tst__tableWrap { background: transparent !important; border: none !important; box-shadow: none !important; }
                :global(.dark) .tst__th, :global(.dark) .tst__thAksi, :global(.dark) .tst__thCheck, :global(.dark) .tst__thInfoMapel, :global(.dark) .tst__thLampiran, :global(.dark) .tst__thTanggal, :global(.dark) .tst__thTugas { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; color: #94a3b8 !important; border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important; }
                :global(.dark) .tst__td { color: #ffffff !important; border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .tst__row:hover .tst__td { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .tst__judul, :global(.dark) .tst__guruName, :global(.dark) .tst__mapelName { color: #ffffff !important; }
                :global(.dark) .tst__deskripsi, :global(.dark) .tst__guruSub, :global(.dark) .tst__tanggal, :global(.dark) .tst__rangeLabel, :global(.dark) .tst__noFile { color: #94a3b8 !important; }
                :global(.dark) .tst__kelasBadge, :global(.dark) .tst__mapel { background: rgba(96, 165, 250, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .tst__range { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
                :global(.dark) .tst__jenisIcon, :global(.dark) .tst__miniFileIcon, :global(.dark) .tst__fileLink { color: #60a5fa !important; }
                :global(.dark) .tst__btnView { background: rgba(26, 115, 232, 0.18) !important; color: #60a5fa !important; border: 1px solid rgba(59, 130, 246, 0.35) !important; }
                :global(.dark) .tst__btnView:hover { background: rgba(26, 115, 232, 0.3) !important; color: #ffffff !important; }
                :global(.dark) .tst__btnEdit { background: rgba(14, 165, 233, 0.18) !important; color: #38bdf8 !important; border: 1px solid rgba(56, 189, 248, 0.35) !important; }
                :global(.dark) .tst__btnEdit:hover { background: rgba(14, 165, 233, 0.3) !important; color: #ffffff !important; }
                :global(.dark) .tst__btnDelete { color: #f87171 !important; }
                :global(.dark) .tst__btnDelete:hover { background: rgba(239, 68, 68, 0.15) !important; }
                :global(.dark) .tst__kelasPopover { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; border-radius: 16px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important; }
                :global(.dark) .tst__kelasPopoverHeader { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important; color: #ffffff !important; }
                :global(.dark) .tst__kelasPopoverItem { color: #ffffff !important; border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .tst__kelasPopoverCount { color: #60a5fa !important; }
                :global(.dark) .tst__emptyState, :global(.dark) .tst__loadingState { background: #000000 !important; }
                :global(.dark) .tst__emptyTitle { color: #ffffff !important; }
                :global(.dark) .tst__emptySub { color: #64748b !important; }
                :global(.dark) .tst__emptyCircle, :global(.dark) .tst__emptyBadge { background: rgba(96, 165, 250, 0.15) !important; color: #60a5fa !important; }
            `}</style>
        </div>
    );
}