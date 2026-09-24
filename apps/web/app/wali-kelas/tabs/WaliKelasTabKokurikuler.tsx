'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTimezone } from '@/hooks/use-timezone';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { Modal, ModalHeader, ModalBody, ModalViewFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { ActionGroup, ActionButton } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import { isUserAdmin } from '@/lib/auth-client';

interface WaliKelasTabProps { user?: any; }

interface SiswaList {
    nisn: string;
    nama_siswa: string;
    kelas: string;
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function WaliKelasTabKokurikuler({ user }: WaliKelasTabProps) {
    const nip = user?.nip || user?.username || '';
    const isAdmin = isUserAdmin(user);

    const [loading, setLoading] = useState(false);
    const [siswa, setSiswa] = useState<SiswaList[]>([]);
    const [selectedKelas, setSelectedKelas] = useState<string>('');
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter tahun ajaran (pilihan = tahun ajaran aktif) + bulan;
    // bulan membatasi pemilih tanggal pada modal detail kegiatan.
    const ta = useTahunAjaranFilter();
    const [selectedMonth, setSelectedMonth] = useState<number>(0);

    // Modal State
    const [detailModal, setDetailModal] = useState<{ nisn: string; nama: string; } | null>(null);
    const [modalDate, setModalDate] = useState<string>('');
    const [modalData, setModalData] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (detailModal) return registerModal();
    }, [detailModal, registerModal]);

    const { getCurrentDate: getTzDate } = useTimezone();

    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            if (today) {
                setModalDate(today);
                setSelectedMonth(parseInt(today.split('-')[1]));
            }
        };
        init();
    }, [getTzDate]);

    // Rentang tanggal bulan terpilih (tahun kalender diturunkan dari tahun ajaran)
    const monthRange = useMemo(() => {
        const yStart = parseInt((ta.selected || '').split('/')[0]);
        if (isNaN(yStart) || !selectedMonth) return null;
        const y = selectedMonth >= 7 ? yStart : yStart + 1;
        const mm = String(selectedMonth).padStart(2, '0');
        const lastDay = new Date(y, selectedMonth, 0).getDate();
        return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
    }, [ta.selected, selectedMonth]);

    // Jaga tanggal modal tetap di dalam bulan terpilih
    useEffect(() => {
        if (!monthRange) return;
        setModalDate(prev => (prev && (prev < monthRange.start || prev > monthRange.end)) ? monthRange.start : prev);
    }, [monthRange]);

    const loadData = useCallback(async () => {
        if (!nip && !isAdmin) return;
        if (!selectedKelas) return;
        setLoading(true);
        try {
            const taParam = ta.selected ? `&tahun_ajaran=${encodeURIComponent(ta.selected)}` : '';
            const res = await fetch(`/api/settings/siswa-kelas?kelas=${encodeURIComponent(selectedKelas)}${taParam}`);
            const json = await res.json();
            if (json.ok) {
                // Deduplicate by NISN
                const uniqueData = (json.data || []).filter((v: any, i: number, a: any[]) => a.findIndex(t => t.nisn === v.nisn) === i);
                setSiswa(uniqueData);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [nip, selectedKelas, isAdmin, ta.selected]);

    const loadKelasList = useCallback(async () => {
        if (!nip && !isAdmin) return;
        try {
            const params = new URLSearchParams();
            params.append('nip', nip || '');
            params.append('mode', 'kelas_list');
            if (ta.selected) params.append('tahun_ajaran', ta.selected);
            const res = await fetch(`/api/wali-kelas/absensi-akumulasi?${params.toString()}`);
            const result = await res.json();
            if (result.ok && result.kelas_list) {
                const uniqueKelas = Array.from(new Set(result.kelas_list)) as string[];
                setKelasList(uniqueKelas);
                if (uniqueKelas.length > 0) {
                    if (!selectedKelas || !uniqueKelas.includes(selectedKelas)) {
                        setSelectedKelas(uniqueKelas[0]);
                    }
                } else {
                    setSelectedKelas('');
                }
            } else {
                setKelasList([]);
                setSelectedKelas('');
            }
        } catch (err) { console.error(err); }
    }, [nip, isAdmin, selectedKelas, ta.selected]);

    useEffect(() => { loadKelasList(); }, [loadKelasList]);
    useEffect(() => { if (selectedKelas) loadData(); }, [selectedKelas, loadData]);

    const loadModalData = useCallback(async (nisn: string, tanggal: string) => {
        setModalLoading(true);
        try {
            const res = await fetch(`/api/kokurikuler/siswa?nisn=${encodeURIComponent(nisn)}&tanggal=${tanggal}`);
            const json = await res.json();
            if (json.ok) {
                setModalData(json.data || []);
            }
        } catch (err) { console.error(err); } finally { setModalLoading(false); }
    }, []);

    useEffect(() => {
        if (detailModal && modalDate) {
            loadModalData(detailModal.nisn, modalDate);
        }
    }, [detailModal?.nisn, modalDate, loadModalData]);

    const formatTanggal = (dateStr: string): string => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    return (
        <div className="wkk-wrap">
            {/* Toolbar */}
            <FilterToolbar>
                {ta.years.length > 0 && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        icon="mortarboard"
                        value={ta.selected}
                        onChange={ta.setSelected}
                        title="Tahun Ajaran (aktif)"
                        options={ta.years.map(y => ({ value: y, label: `TA ${y}` }))}
                    />
                )}
                <FilterSelect
                    label="Bulan"
                    icon="calendar-event"
                    value={String(selectedMonth)}
                    onChange={v => setSelectedMonth(parseInt(v))}
                    options={MONTH_NAMES.map((b, i) => ({ value: String(i + 1), label: b }))}
                />
                <FilterSelect
                    label="Kelas"
                    icon="door-open"
                    value={selectedKelas}
                    onChange={setSelectedKelas}
                    options={kelasList.map(k => ({ value: k, label: k }))}
                />
                <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama/NISN siswa..." />
            </FilterToolbar>

            {/* Content */}
            <div className="wkk-content">
                {loading ? (
                    <div className="wkk-loading">
                        <Spinner variant="buble" size={28} />
                    </div>
                ) : (
                    <div className="wkk-daily">
                        <div className="wkk-daily-list">
                            {siswa.filter(s => {
                                if (!searchQuery) return true;
                                const q = searchQuery.toLowerCase();
                                return s.nama_siswa.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q);
                            }).map((s, idx) => (
                                <div key={s.nisn} className="wkk-item">
                                    <div className="wkk-item-left">
                                        <div className="wkk-item-avatar">
                                            {s.nama_siswa.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                        </div>
                                        <div className="wkk-item-info">
                                            <span className="wkk-item-name">{s.nama_siswa}</span>
                                            <span className="wkk-item-nisn">{s.nisn}</span>
                                        </div>
                                    </div>
                                    <div className="wkk-item-right">
                                        <Button size="sm" variant="ghost" leftIcon={<i className="bi bi-card-list" />} onClick={() => setDetailModal({
                                            nisn: s.nisn,
                                            nama: s.nama_siswa
                                        })}>
                                            Detail
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {siswa.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>
                                    Tidak ada data siswa untuk kelas ini.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {detailModal && (
                <Modal size="lg" onClose={() => setDetailModal(null)} labelledBy="wkk-detail-title">
                        <ModalHeader id="wkk-detail-title" icon="calendar-event" title="Detail Kegiatan" subtitle={detailModal.nama} onClose={() => setDetailModal(null)} />
                        <ModalBody>
                        <div className="wkk-detail-filter">
                            <label htmlFor="wkk-detail-date">Tanggal:</label>
                            <DatePicker
                                value={modalDate}
                                onChange={setModalDate}
                                min={monthRange?.start}
                                max={monthRange?.end}
                            />
                        </div>
                            {modalLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                                    <Spinner variant="buble" size={30} />
                                </div>
                            ) : modalData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                                    <p style={{ marginTop: '10px' }}>Tidak ada kegiatan yang dicatat pada tanggal {formatTanggal(modalDate)}.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {modalData.map((detail, idx) => (
                                        <div key={idx} className="wkk-detail-item" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 'bold', color: '#334155' }}>{detail.nama_kegiatan}</span>
                                                {detail.is_custom && <span style={{ fontSize: '0.7rem', color: '#3b82f6', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>Kustom</span>}
                                            </div>
                                            <span className={`wkk-badge wkk-badge-${detail.status.toLowerCase()}`}>{detail.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ModalBody>
                        <ModalViewFooter onClose={() => setDetailModal(null)} />
                </Modal>
            )}

            <style jsx>{`
                .wkk-wrap { display: flex; flex-direction: column; gap: 14px; }
                /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                /* Mobile - Standard phones (375px - 639px) */
                @media (max-width: 639px) {
                    .wkk-item-num { display: none; }
                    .wkk-item-avatar { width: 32px; height: 32px; font-size: 0.7rem; border-radius: 8px; }
                    .wkk-item-detail-btn span { display: none; }
                    .wkk-item-detail-btn { padding: 8px 12px; }
                }

                .wkk-loading { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 60px 20px; color: var(--n-muted); }
                .wkk-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                
                .wkk-daily { background: var(--n-card); border-radius: 16px; border: 1px solid var(--n-border); overflow: hidden; }
                
                .wkk-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--n-border); transition: all 0.2s; }
                .wkk-item:hover { background: var(--n-soft); }
                .wkk-item-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
                .wkk-item-num { width: 28px; height: 28px; border-radius: 8px; background: var(--n-soft); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: var(--n-muted); flex-shrink: 0; }
                .wkk-item-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #3083FF, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; flex-shrink: 0; }
                .wkk-item-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
                .wkk-item-name { font-size: 0.95rem; font-weight: 700; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .wkk-item-nisn { font-size: 0.75rem; color: var(--n-muted); }
                
                .wkk-item-right { display: flex; align-items: center; gap: 10px; }
                .wkk-item-detail-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-size: 0.8rem; font-weight: 700; color: #3b82f6; cursor: pointer; transition: all 0.2s; }
                .wkk-item-detail-btn:hover { background: #eff6ff; border-color: #3b82f6; }
                .wkk-item-detail-btn i { font-size: 0.9rem; }

                .wkk-detail-filter { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
                .wkk-detail-filter label { font-size: 0.85rem; font-weight: 700; color: var(--n-muted); }
                
                .wkk-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; }
                .wkk-badge-disetujui { background: #dcfce7; color: #166534; }
                .wkk-badge-ditolak { background: #fee2e2; color: #991b1b; }
                .wkk-badge-pending { background: #fef9c3; color: #854d0e; }

                /* Dark Mode */
                :global(.dark) .wkk-daily {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    overflow: hidden !important;
                }
                :global(.dark) .wkk-daily-list {
                    background: transparent !important;
                    border-radius: 14px !important;
                    overflow: hidden !important;
                }
                :global(.dark) .wkk-item {
                    background: transparent !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .wkk-item:hover {
                    background: rgba(26, 115, 232, 0.1) !important;
                }
                :global(.dark) .wkk-item-name { color: #ffffff !important; }
                :global(.dark) .wkk-item-avatar { background: linear-gradient(135deg, #1d6bf3, #3083FF) !important; }
                :global(.dark) .wkk-item-detail-btn {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    color: #60a5fa !important;
                    border-radius: 10px !important;
                }
                :global(.dark) .wkk-item-detail-btn:hover {
                    background: rgba(26, 115, 232, 0.2) !important;
                    border-color: #60a5fa !important;
                    color: #ffffff !important;
                }
                :global(.dark) .wkk-detail-item {
                    background: rgba(26, 115, 232, 0.1) !important;
                    border: 1px solid rgba(26, 115, 232, 0.3) !important;
                }
                :global(.dark) .wkk-detail-item span { color: #ffffff !important; }
            `}</style>
        </div>
    );
}
