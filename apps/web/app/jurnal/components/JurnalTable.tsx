'use client';

import { Journal } from '../types';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface JurnalTableProps {
    loading: boolean;
    error: any;
    paginatedData: Journal[];
    allWaktu: any[];
    user: any;
    canDo: (action: string) => boolean;
    isAdmin: boolean;
    isOPJurnal: boolean;
    setSelectedJournal: (journal: Journal) => void;
    setShowDetailModal: (val: boolean) => void;
    setEditJournal: (journal: Journal) => void;
    setShowEditModal: (val: boolean) => void;
    handleDelete: (ids: number | number[]) => void;
    getCategoryClass: (kategori: string) => string;
}

export default function JurnalTable({
    loading,
    error,
    paginatedData,
    allWaktu,
    user,
    canDo,
    isAdmin,
    isOPJurnal,
    setSelectedJournal,
    setShowDetailModal,
    setEditJournal,
    setShowEditModal,
    handleDelete,
    getCategoryClass
}: JurnalTableProps) {
    const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, d] = clean.split('-').map(Number);
        if (y && m && d) {
            const dObj = new Date(y, m - 1, d);
            return dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        const dObj = new Date(dateStr);
        return isNaN(dObj.getTime()) ? clean : dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getDayName = (dateStr?: string) => {
        if (!dateStr) return '';
        const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, d] = clean.split('-').map(Number);
        if (y && m && d) {
            return DAY_NAMES[new Date(y, m - 1, d).getDay()] || '';
        }
        return '';
    };

    return (
        <div className="jt__tableWrap">
            <table className="jt__table">
                <thead>
                    <tr>
                        <th className="cTanggalHari">Hari/Tanggal</th>
                        <th className="cJam">Jam Ke</th>
                        <th className="cGuruMapel">Guru & Mapel</th>
                        <th className="cKelas">Kelas</th>
                        <th className="cKategori">Kategori</th>
                        <th className="cMateriRefleksi hidden-lg">Materi & Refleksi</th>
                        <th className="cAksi">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={7} className="jt__empty">
                                <div className="jt__loading">
                                    <div className="loading-bars-inline">
                                        <div className="bar"></div>
                                        <div className="bar"></div>
                                        <div className="bar"></div>
                                    </div>
                                    Memuat data...
                                </div>
                            </td>
                        </tr>
                    ) : error ? (
                        <tr>
                            <td colSpan={7} className="jt__empty jt__error">
                                <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                                Error: {error}
                            </td>
                        </tr>
                    ) : paginatedData.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="jt__empty jt__muted">
                                <div className="jt__emptyContent">
                                    <i className="bi bi-journal-x" aria-hidden="true" />
                                    <div>Tidak ada data jurnal</div>
                                    <div className="jt__emptySub">Coba ubah filter atau tambahkan data baru</div>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        paginatedData.map((journal: any) => (
                            <tr key={journal.id}>
                                <td>
                                    <div className="jt__day">{journal.hari || getDayName(journal.tanggal)}</div>
                                    <div className="jt__date">{formatDate(journal.tanggal)}</div>
                                </td>
                                <td>
                                    {(() => {
                                        const dayName = journal.hari || getDayName(journal.tanggal);
                                        let jamStr = String(journal.jam_ke || '').trim();
                                        if (!jamStr && journal.jam_ke_id) jamStr = String(journal.jam_ke_id);

                                        const parts = jamStr.split('-').map(s => s.trim());
                                        const startJam = parts[0];
                                        const endJam = parts.length > 1 ? parts[1] : startJam;
                                        const isNumeric = !isNaN(Number(startJam));

                                        let timeDisplay = '';
                                        if (isNumeric && allWaktu && allWaktu.length > 0) {
                                            const dayWaktu = allWaktu.filter((w: any) => 
                                                w.hari?.toLowerCase() === dayName?.toLowerCase()
                                            );
                                            const startSch = dayWaktu.find((w: any) => String(w.jam_ke) === startJam && w.program === 'Reguler')
                                                          || dayWaktu.find((w: any) => String(w.jam_ke) === startJam);
                                            const endSch = dayWaktu.find((w: any) => String(w.jam_ke) === endJam && w.program === (startSch?.program || 'Reguler'))
                                                        || dayWaktu.find((w: any) => String(w.jam_ke) === endJam);

                                            if (startSch?.mulai && endSch?.selesai) {
                                                const sMulai = String(startSch.mulai).includes('T') ? String(startSch.mulai).substring(11, 16) : String(startSch.mulai).slice(0, 5);
                                                const sSelesai = String(endSch.selesai).includes('T') ? String(endSch.selesai).substring(11, 16) : String(endSch.selesai).slice(0, 5);
                                                timeDisplay = `${sMulai} - ${sSelesai}`;
                                            }
                                        }

                                        const jamLabel = jamStr ? `Jam ke: ${jamStr}` : '';

                                        return (
                                            <>
                                                <div className="jt__jamMain whitespace-nowrap font-bold text-[var(--n-primary)]">
                                                    {timeDisplay || jamLabel || '-'}
                                                </div>
                                                {timeDisplay && jamLabel && (
                                                    <div className="jt__jamSub whitespace-nowrap text-[var(--n-muted)] text-xs">
                                                        {jamLabel}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </td>
                                <td>
                                    <div className="jt__guru">{journal.nama_guru}</div>
                                    {journal.guru_pengganti && journal.guru_pengganti !== '-' && (
                                        <div className="jt__penggantiLabel mt-0.5 mb-1 flex items-center gap-1">
                                            <i className="bi bi-arrow-return-right" title="Digantikan oleh"></i>
                                            <span>{journal.guru_pengganti}</span>
                                        </div>
                                    )}
                                    <div className="jt__mapel">{journal.mata_pelajaran}</div>
                                </td>
                                <td className="jt__kelas">{journal.kelas}</td>
                                <td>
                                    <span className={getCategoryClass(journal.kategori_kehadiran)}>
                                        {(journal.kategori_kehadiran || '').toLowerCase() === 'penugasan dengan pendampingan' ? 'Penugasan DP' :
                                            (journal.kategori_kehadiran || '').toLowerCase() === 'penugasan tanpa pendampingan' ? 'Penugasan TP' :
                                                journal.kategori_kehadiran}
                                    </span>
                                </td>
                                <td className="jt__materiRefleksi hidden-lg">
                                    <div className="text-xs font-medium text-[var(--n-ink)] mb-1 line-clamp-1" title={journal.materi || ''}>
                                        {journal.materi || '-'}
                                    </div>
                                    {journal.refleksi && (
                                        <div className="text-[0.7rem] text-[var(--n-muted)] italic border-l-2 border-[var(--n-border)] pl-2 line-clamp-1" title={journal.refleksi}>
                                            "{journal.refleksi}"
                                        </div>
                                    )}
                                    <div className="mt-2 flex gap-1">
                                        {journal.filled_by === 'SISWA' && <span className="jt__badge Siswa"><i className="bi bi-person-fill"></i> Siswa</span>}
                                        {journal.filled_by === 'GURU' && <span className="jt__badge Guru"><i className="bi bi-mortarboard-fill"></i> Guru</span>}
                                        {(!journal.filled_by || journal.filled_by === 'ADMIN') && <span className="jt__badge System">System</span>}
                                    </div>
                                </td>
                                <td>
                                    <ActionGroup>
                                        <ActionButton
                                            action="view"
                                            title="Lihat Detail"
                                            onClick={() => { setSelectedJournal(journal); setShowDetailModal(true); }}
                                        />

                                        {(() => {
                                            const isOwner = journal.nip === user?.nip || journal.nama_guru === user?.nama;
                                            const hasSubstitute = journal.guru_pengganti && journal.guru_pengganti !== '-' && journal.guru_pengganti.trim() !== '';
                                            const isSubstitute = hasSubstitute && journal.guru_pengganti === user?.nama;
                                            // Bersumber tunggal dari `canDo`. Pintasan `isAdmin || isOPJurnal` dibuang:
                                            // keduanya ditebak dari daftar peran di sisi klien, sementara API
                                            // memakai Hak Akses Fitur — tombolnya bisa tampil lalu ditolak 403.
                                            const hasFullAccess = canDo('update_any');
                                            const canEditLimited = canDo('edit_materi_refleksi') && (isSubstitute || (!hasSubstitute && isOwner));

                                            if (hasFullAccess || canEditLimited) {
                                                return (
                                                    <ActionButton
                                                        action="edit"
                                                        title={hasFullAccess ? "Edit Full" : "Edit Materi & Refleksi"}
                                                        onClick={() => { setEditJournal(journal); setShowEditModal(true); }}
                                                    />
                                                );
                                            }
                                            return null;
                                        })()}

                                        {canDo('delete_any') && (
                                            <ActionButton
                                                action="delete"
                                                title="Hapus Jurnal"
                                                onClick={() => handleDelete(journal.allIds || journal.id)}
                                            />
                                        )}
                                    </ActionGroup>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            <style jsx>{`
                .jt__tableWrap {
                  width: 100%;
                  overflow-x: auto;
                  border-radius: 24px;
                  border: 1px solid var(--n-border);
                  background: var(--n-card);
                  box-shadow: var(--n-shadow);
                  overflow-y: hidden; 
                  transition: background 0.3s ease, border-color 0.3s ease;
                }

                /* Hide table on mobile, show on desktop */
                @media (max-width: 768px) {
                    .jt__tableWrap {
                        display: none;
                    }
                }

                :global(.dark) .jt__tableWrap {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 20px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                    transition: all 0.2s ease !important;
                }
                :global(.dark) .jt__tableWrap:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.15) !important;
                }

                .jt__table {
                  width: 100%;
                  border-collapse: separate;
                  border-spacing: 0;
                  min-width: 860px;
                }

                .cTanggalHari { width: 100px; }
                .cJam { width: 95px; }
                .cGuruMapel { width: 200px; min-width: 170px; white-space: normal; }
                .cKelas { width: 72px; }
                .cKategori { width: 124px; }
                /* Muat 3 tombol aksi 32px + gap + padding sel tanpa terpotong */
                .cAksi { width: 136px; min-width: 136px; }
                /* Kolom fleksibel: menyerap sisa lebar agar total tabel pas 1 layar desktop */
                .cMateriRefleksi { min-width: 150px; }

                .jt__table thead th {
                  background: var(--n-soft);
                  padding: 18px 10px;
                  text-align: left;
                  border-bottom: 1px solid var(--n-border);
                  font-weight: 700;
                  color: var(--n-muted);
                  font-size: 0.8rem;
                  letter-spacing: 0.05em;
                  text-transform: uppercase;
                  opacity: 0.85;
                }

                .jt__table td {
                  padding: 16px 10px;
                  border-bottom: 1px solid var(--n-border);
                  vertical-align: middle;
                  font-size: 0.9rem;
                  color: var(--n-ink);
                  transition: background 0.2s;
                }

                .jt__table tbody tr:hover td {
                    background: var(--n-soft);
                }

                .jt__day { font-weight: 600; color: var(--n-ink); font-size: 0.92rem; }
                .jt__date { font-size: 0.8rem; color: var(--n-muted); }
                .jt__jamMain { font-weight: 600; color: var(--n-primary); font-size: 0.92rem; }
                .jt__jamSub { font-size: 0.8rem; color: var(--n-muted); }
                .jt__guru { 
                    font-weight: 600; font-size: 0.92rem; color: var(--n-ink); line-height: 1.3;
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;
                }
                .jt__mapel { 
                    font-size: 0.8rem; color: var(--n-muted);
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;
                }

                .sk__status {
                    padding: 6px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
                    white-space: nowrap; text-align: center; line-height: 1.1; display: inline-block;
                    max-width: 100%; overflow: hidden; text-overflow: ellipsis;
                }
                .sk__status.isOn { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
                .sk__status.isWarning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .sk__status.isInfo { background: var(--n-soft); color: var(--n-primary); }
                .sk__status.isOff { background: var(--n-soft); color: var(--n-muted); }

                .jt__rowActions { display: flex; gap: 8px; justify-content: center; width: 100%; padding-right: 4px; }
                .jt__iconBtn {
                    width: 32px; height: 32px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    border: 1px solid var(--n-border);
                    background: var(--n-card); color: var(--n-ink);
                    cursor: pointer; transition: all 0.2s;
                }
                .jt__iconBtn:hover { transform: translateY(-2px); background: var(--n-soft); color: var(--n-primary); }
                .jt__iconBtn.danger { color: #ef4444; }
                .jt__iconBtn.danger:hover { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); }

                :global(.dark) .jt__table thead th {
                    background: rgba(37, 99, 235, 0.15) !important;
                    color: #93c5fd !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                :global(.dark) .jt__table td {
                    background: #0b1329 !important;
                    color: #f1f5f9 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .jt__table tbody tr:hover td {
                    background: rgba(26, 115, 232, 0.08) !important;
                }
                :global(.dark) .jt__guru { color: #f1f5f9 !important; }
                :global(.dark) .jt__mapel { color: #94a3b8 !important; }
                :global(.dark) .jt__jamMain { color: #38bdf8 !important; }
                :global(.dark) .jt__iconBtn {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .jt__iconBtn:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .jt__iconBtn.danger {
                    color: #f87171 !important;
                    border-color: rgba(239, 68, 68, 0.35) !important;
                }
                :global(.dark) .jt__iconBtn.danger:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ffffff !important;
                }
                :global(.dark) .jt__loading { color: #94a3b8 !important; }
                :global(.dark) .jt__error { color: #f87171 !important; }
                :global(.dark) .sk__status.isInfo { background: rgba(26, 115, 232, 0.2) !important; color: #38bdf8 !important; }
                :global(.dark) .sk__status.isOff { background: rgba(100, 116, 139, 0.15) !important; color: #94a3b8 !important; }
                .jt__penggantiLabel { font-size: 0.75rem; font-weight: 600; color: #d97706; }
                :global(.dark) .jt__penggantiLabel { color: #fbbf24 !important; }

                .jt__loading { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 12px; color: var(--n-muted); font-weight: 500;
                }
                .loading-bars-inline {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                    justify-content: center;
                }

                .loading-bars-inline .bar {
                    width: 4px;
                    height: 16px;
                    background: var(--n-primary);
                    border-radius: 99px;
                    animation: waveInline 1s infinite ease-in-out;
                }

                .loading-bars-inline .bar:nth-child(2) { animation-delay: 0.1s; opacity: 0.8; }
                .loading-bars-inline .bar:nth-child(3) { animation-delay: 0.2s; opacity: 0.6; }

                @keyframes waveInline {
                    0%, 40%, 100% { transform: scaleY(0.5); }
                    20% { transform: scaleY(1.3); }
                }

                .jt__spinner { display: none; }

                .jt__badge {
                  font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; text-transform: uppercase; letter-spacing: 0.03em;
                }
                .jt__badge.Siswa { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
                .jt__badge.Guru { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
                .jt__badge.System { background: rgba(100, 116, 139, 0.18); color: var(--n-muted); }

                @media (max-width: 1024px) {
                    .hidden-lg { display: none; }
                    /* Kolom materi tersembunyi — turunkan lebar minimum & rapatkan padding agar muat tanpa scroll */
                    .jt__table { min-width: 700px; }
                    .jt__table thead th, .jt__table td { padding-left: 6px; padding-right: 6px; }
                }
            `}</style>
        </div>
    );
}
