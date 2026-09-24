'use client';

import { Journal } from '../types';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface JurnalCardsProps {
    loading: boolean;
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

export default function JurnalCards({
    loading,
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
}: JurnalCardsProps) {
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
        <div className="jt__cards">
            {loading ? (
                <div className="jt__card">
                    <div className="jt__cardHead">
                        <div className="jt__cardTitle">
                            <div className="jt__cardName">Memuat data...</div>
                            <div className="jt__cardSub">Mohon tunggu</div>
                        </div>
                    </div>
                </div>
            ) : paginatedData.length === 0 ? (
                <div className="jt__card">
                    <div className="jt__cardHead">
                        <div className="jt__cardTitle">
                            <div className="jt__cardName">Tidak ada data</div>
                            <div className="jt__cardSub">Belum ada jurnal</div>
                        </div>
                    </div>
                </div>
            ) : (
                paginatedData.map((journal: any) => (
                    <div className="jt__card" key={`m-${journal.id}`}>
                        <div className="jt__cardHead">
                            <div className="jt__cardTitle">
                                <div className="jt__cardName">
                                    {journal.nama_guru}
                                    {['diganti', 'tukaran', 'tim teaching', 'guru pengganti'].includes((journal.kategori_kehadiran || '').toLowerCase()) && journal.guru_pengganti && (
                                        <div className="jt__penggantiLabel font-normal mt-0.5 flex items-center gap-1">
                                            <i className="bi bi-arrow-right"></i> {journal.guru_pengganti}
                                        </div>
                                    )}
                                </div>
                                <div className="jt__cardSub">{formatDate(journal.tanggal)} • {journal.hari || getDayName(journal.tanggal)}</div>
                            </div>
                            <div className="jt__cardStatus">
                                <span className={getCategoryClass(journal.kategori_kehadiran)}>
                                    {journal.kategori_kehadiran}
                                </span>
                            </div>
                        </div>

                        <div className="jt__cardBody">
                            <div className="jt__kv">
                                <div className="jt__k">Kelas</div>
                                <div className="jt__v">{journal.kelas}</div>
                            </div>
                            <div className="jt__kv">
                                <div className="jt__k">Waktu</div>
                                <div className="jt__v">
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

                                        if (timeDisplay && jamStr) {
                                            return `${timeDisplay} (Jam ${jamStr})`;
                                        }
                                        return jamStr ? `Jam ${jamStr}` : '-';
                                    })()}
                                </div>
                            </div>
                            <div className="jt__kv">
                                <div className="jt__k">Mata Pelajaran</div>
                                <div className="jt__v">{journal.mata_pelajaran}</div>
                            </div>
                            <div className="jt__kv border-none">
                                <div className="jt__k" style={{ fontSize: '0.65rem' }}>Sumber Data</div>
                                <div className="jt__v">
                                    {journal.filled_by === 'SISWA' && <span className="jt__badge Siswa"><i className="bi bi-person-fill"></i> Siswa</span>}
                                    {journal.filled_by === 'GURU' && <span className="jt__badge Guru"><i className="bi bi-mortarboard-fill"></i> Guru</span>}
                                    {(!journal.filled_by || journal.filled_by === 'ADMIN') && <span className="jt__badge System">System</span>}
                                </div>
                            </div>
                        </div>

                        <div className="jt__cardActions">
                            <ActionGroup>
                                <ActionButton
                                    action="view"
                                    title="Detail"
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
                                        title="Hapus"
                                        onClick={() => handleDelete(journal.allIds || journal.id)}
                                    />
                                )}
                            </ActionGroup>
                        </div>
                    </div>
                ))
            )}
            <style jsx>{`
                .jt__cards { display: flex; flex-direction: column; gap: 16px; }
                
                /* Hide cards on desktop, show on mobile */
                @media (min-width: 769px) {
                    .jt__cards {
                        display: none;
                    }
                }
                .jt__card {
                    background: var(--n-card);
                    padding: 24px;
                    border-radius: 24px;
                    border: 1px solid var(--n-border);
                    box-shadow: var(--n-shadow);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                :global(.dark) .jt__card {
                    background: #000000 !important;
                    border: 1px solid rgba(37, 99, 235, 0.4) !important;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
                }
                .jt__card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 4px;
                    background: #3083FF;
                }
                :global(.dark) .jt__card::before {
                    background: #1a73e8 !important;
                }

                .jt__card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.2); }
                .jt__cardHead { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: flex-start; }
                .jt__cardTitle { flex: 1; }
                .jt__cardName { font-weight: 700; font-size: 1.1rem; color: var(--n-ink); margin-bottom: 4px; }
                .jt__cardSub { font-size: 0.85rem; color: var(--n-muted); }
                .jt__cardStatus { margin-left: 12px; }
                .jt__cardBody { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; font-size: 0.9rem; }
                .jt__kv {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--n-border);
                }
                .jt__k { color: var(--n-muted); font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .jt__v { color: var(--n-ink); font-weight: 600; }
                .jt__cardActions { display: flex; gap: 12px; justify-content: flex-end; }

                :global(.dark) .jt__cardName { color: #f1f5f9 !important; }
                :global(.dark) .jt__cardSub { color: #94a3b8 !important; }
                :global(.dark) .jt__kv { border-color: rgba(59, 130, 246, 0.15) !important; }
                :global(.dark) .jt__k { color: #94a3b8 !important; }
                :global(.dark) .jt__v { color: #f1f5f9 !important; }
                :global(.dark) .jt__cardActions .jt__iconBtn {
                    background: #000000 !important;
                    border: 1px solid rgba(59, 130, 246, 0.35) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .jt__cardActions .jt__iconBtn:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #ffffff !important;
                    border-color: #3b82f6 !important;
                }
                :global(.dark) .sk__status.isInfo { background: rgba(26, 115, 232, 0.2) !important; color: #38bdf8 !important; }
                :global(.dark) .sk__status.isOff { background: rgba(100, 116, 139, 0.15) !important; color: #94a3b8 !important; }

                .sk__status {
                    padding: 6px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
                    white-space: nowrap; text-align: center; line-height: 1.1; display: inline-block;
                    max-width: 100%; overflow: hidden; text-overflow: ellipsis;
                }
                .sk__status.isOn { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
                .sk__status.isWarning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .sk__status.isInfo { background: var(--n-soft); color: var(--n-primary); }
                .sk__status.isOff { background: var(--n-soft); color: var(--n-muted); }

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

                .jt__badge {
                  font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; text-transform: uppercase; letter-spacing: 0.03em;
                }
                .jt__badge.Siswa { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
                .jt__badge.Guru { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
                .jt__badge.System { background: rgba(100, 116, 139, 0.18); color: var(--n-muted); }

                .jt__penggantiLabel { font-size: 0.75rem; font-weight: 600; color: #d97706; }
                :global(.dark) .jt__penggantiLabel { color: #fbbf24; }

                @media (max-width: 768px) {
                  .jt__card { padding: 18px; border-radius: 20px; }
                  .jt__cardName { font-size: 0.95rem; font-weight: 750; }
                  .jt__cardSub { font-size: 0.78rem; opacity: 0.85; }
                  .jt__kv { padding: 6px 0; }
                  .jt__k { font-size: 0.65rem; }
                  .jt__v { font-size: 0.82rem; }
                }
            `}</style>
        </div>
    );
}
