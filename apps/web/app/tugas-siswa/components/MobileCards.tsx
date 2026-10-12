'use client';

import Swal from 'sweetalert2';
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
    created_by: string;
    created_by_nip: string | null;
    created_at: string;
    jenis?: 'tugas' | 'pengingat';
    ruangan?: string | null;
    durasi?: string | null;
    sifat_ujian?: string | null;
}

interface MobileCardsProps {
    data: TugasSiswa[];
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

export default function MobileCards({
    data,
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
}: MobileCardsProps) {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (data.length === 0) {
        return (
            <div className="mc__empty">
                <div className="mc__emptyVisual">
                    <div className="mc__emptyCircle">
                        <i className="bi bi-clipboard-x"></i>
                    </div>
                    <div className="mc__emptyDecor mc__emptyDecor1"></div>
                    <div className="mc__emptyDecor mc__emptyDecor2"></div>
                </div>
                <div className="mc__emptyContent">
                    <div className="mc__emptyBadge">
                        <i className="bi bi-info-circle"></i>
                        Kosong
                    </div>
                    <h3 className="mc__emptyTitle">Belum Ada Tugas</h3>
                    <p className="mc__emptySub">
                        Belum ada tugas. Klik <strong>Tambah Tugas</strong> untuk membuat tugas baru.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mc__container">
            {data.map((tugas) => {
                const info = getDeadlineInfo(tugas.tanggal_selesai || tugas.tanggal_mulai);
                const sudahDicentang = checklistedIds.includes(tugas.id);

                return (
                    <div
                        key={tugas.id}
                        className={`mc__listItem mc__listItem--${info.tone} ${sudahDicentang ? 'mc__listItem--done' : ''}`}
                        onClick={() => onView(tugas)}
                    >
                        {/* Baris Atas: Judul Tugas (Melebar penuh) & Tombol Tandai */}
                        <div className="mc__listTop">
                            <h3 className="mc__listTitle">
                                {tugas.judul_tugas}
                            </h3>
                            {(isSiswa || isPengurusKelas) && <div className="mc__listAction" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className={`mc__btnCheck ${sudahDicentang ? 'is-done' : ''}`}
                                    onClick={() => onToggleChecklist && onToggleChecklist(tugas.id, sudahDicentang)}
                                >
                                    <i className={`bi ${sudahDicentang ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
                                    <span>{sudahDicentang ? 'Selesai' : 'Tandai'}</span>
                                </button>
                            </div>}
                        </div>

                        {/* Baris Bawah: Mapel di Kiri (teks kecil) & Tanggal di Kanan (teks kecil) */}
                        <div className="mc__listBottom">
                            <span className="mc__listSubText mc__listMapel">
                                {tugas.nama_mapel}
                            </span>
                            <span className="mc__listSubText mc__listDate">
                                <i className="bi bi-calendar3"></i>
                                {tugas.is_range && tugas.tanggal_selesai
                                    ? `${formatDate(tugas.tanggal_mulai)} → ${formatDate(tugas.tanggal_selesai)}`
                                    : formatDate(tugas.tanggal_mulai)}
                            </span>
                        </div>
                    </div>
                );
            })}

            <style jsx>{`
                .mc__container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 0;
                }

                .mc__listItem {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-left: 3.5px solid var(--n-border);
                    border-radius: 14px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
                    transition: all 0.15s ease;
                }

                .mc__listItem:active {
                    transform: scale(0.99);
                }

                .mc__listItem--h3    { border-left-color: #f59e0b; }
                .mc__listItem--h2    { border-left-color: #f97316; }
                .mc__listItem--h1    { border-left-color: #ef4444; }
                .mc__listItem--today { border-left-color: #b91c1c; }
                .mc__listItem--lewat { border-left-color: #cbd5e1; opacity: 0.8; }
                .mc__listItem--done  { opacity: 0.7; }

                /* Baris Atas: Judul melebar + Tombol Tandai */
                .mc__listTop {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 10px;
                    width: 100%;
                }

                .mc__listTitle {
                    flex: 1;
                    min-width: 0;
                    font-size: 0.92rem;
                    font-weight: 700;
                    line-height: 1.35;
                    color: var(--n-ink);
                    margin: 0;
                    word-break: break-word;
                }

                .mc__listAction {
                    flex-shrink: 0;
                }

                .mc__btnCheck {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 10px;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    background: var(--n-soft, rgba(148,163,184,0.1));
                    color: var(--n-muted);
                    font-size: 0.74rem;
                    font-weight: 650;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                }

                .mc__btnCheck.is-done {
                    background: rgba(34, 197, 94, 0.12);
                    color: #15803d;
                    border-color: rgba(34, 197, 94, 0.3);
                }

                /* Baris Bawah: Mapel di kiri, Tanggal di kanan */
                .mc__listBottom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    width: 100%;
                }

                .mc__listSubText {
                    font-size: 0.72rem;
                    font-weight: 500;
                    color: var(--n-muted);
                }

                .mc__listMapel {
                    color: var(--n-primary);
                    font-weight: 600;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .mc__listDate {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                /* Empty state */
                .mc__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 48px 24px;
                    gap: 16px;
                }

                .mc__emptyVisual {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 80px;
                    height: 80px;
                }

                .mc__emptyCircle {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(0,63,136,0.08) 0%, rgba(194,24,91,0.08) 100%);
                    border: 2px solid rgba(0,63,136,0.12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                    color: var(--n-primary);
                    position: relative;
                    z-index: 1;
                }

                .mc__emptyDecor {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(0,63,136,0.06);
                }

                .mc__emptyDecor1 {
                    width: 96px;
                    height: 96px;
                    top: -8px;
                    left: -8px;
                    animation: mcPulse 3s ease-in-out infinite;
                }

                .mc__emptyDecor2 {
                    width: 64px;
                    height: 64px;
                    bottom: -6px;
                    right: -10px;
                    background: rgba(194,24,91,0.06);
                    animation: mcPulse 3s ease-in-out infinite 0.6s;
                }

                @keyframes mcPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.08); opacity: 0.7; }
                }

                .mc__emptyContent {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    text-align: center;
                }

                .mc__emptyBadge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 3px 12px;
                    background: rgba(0,63,136,0.06);
                    border: 1px solid rgba(0,63,136,0.12);
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--n-primary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .mc__emptyTitle {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--n-ink);
                    margin: 0;
                }

                .mc__emptySub {
                    font-size: 0.82rem;
                    color: var(--n-muted);
                    margin: 0;
                    line-height: 1.5;
                }

                .mc__emptySub strong {
                    color: var(--n-ink);
                    font-weight: 600;
                }

                /* Dark Mode */
                :global(.dark) .mc__listItem {
                    background: var(--n-card) !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
                }
                :global(.dark) .mc__listTitle {
                    color: #ffffff !important;
                }
                :global(.dark) .mc__listSubText {
                    color: #94a3b8 !important;
                }
                :global(.dark) .mc__listMapel {
                    color: #60a5fa !important;
                }
                :global(.dark) .mc__btnCheck {
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(255,255,255,0.15) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .mc__btnCheck.is-done {
                    background: rgba(26, 115, 232, 0.25) !important;
                    color: #60a5fa !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .mc__empty { background: var(--n-card) !important; }
                :global(.dark) .mc__emptyTitle { color: #ffffff !important; }
                :global(.dark) .mc__emptySub { color: #64748b !important; }
                :global(.dark) .mc__emptyCircle, :global(.dark) .mc__emptyBadge { background: rgba(96, 165, 250, 0.15) !important; color: #60a5fa !important; }
            `}</style>
        </div>
    );
}
