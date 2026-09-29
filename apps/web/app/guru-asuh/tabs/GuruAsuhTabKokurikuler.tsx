'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTimezone } from '@/hooks/use-timezone';
import { Spinner } from '@/components/ui/Spinner';
import DatePicker from '@/components/ui/DatePicker';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { ActionButton } from '@/components/ui/ActionButtons';
import { getProxiedImageUrl } from '@/lib/image-utils';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

interface GuruAsuhTabProps { user?: any; }

interface SiswaList {
    nisn: string;
    nama: string;
    kelas: string;
    foto_profil?: string | null;
}

export default function GuruAsuhTabKokurikuler({ user }: GuruAsuhTabProps) {
    const nip = user?.nip || user?.username || '';
    
    const [loading, setLoading] = useState(false);
    const [siswa, setSiswa] = useState<SiswaList[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Filters
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
                const m = parseInt(today.split('-')[1]);
                if (!selectedMonth) setSelectedMonth(m);
                setModalDate(today);
            }
        };
        init();
    }, [getTzDate]);

    const monthRange = useMemo(() => {
        const yStart = parseInt((ta.selected || '').split('/')[0]);
        if (isNaN(yStart) || !selectedMonth) return null;
        const y = selectedMonth >= 7 ? yStart : yStart + 1;
        const mm = String(selectedMonth).padStart(2, '0');
        const lastDay = new Date(y, selectedMonth, 0).getDate();
        return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
    }, [ta.selected, selectedMonth]);

    useEffect(() => {
        if (!monthRange) return;
        setModalDate(prev => (prev && (prev < monthRange.start || prev > monthRange.end)) ? monthRange.start : prev);
    }, [monthRange]);

    const loadData = useCallback(async () => {
        if (!nip) return;
        setLoading(true);
        try {
            let params = new URLSearchParams();
            params.append('nip', nip);
            if (ta.selected) params.append('tahun_ajaran', ta.selected);
            
            const res = await fetch(`/api/guru-asuh/kokurikuler?${params.toString()}`);
            const result = await res.json();
            if (res.ok && !result.error && result.siswa) {
                setSiswa(result.siswa);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [nip, ta.selected]);

    useEffect(() => { if (nip && ta.selected) loadData(); }, [nip, ta.selected, loadData]);

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
        <div className="gakk-wrap">
            {/* Toolbar Filters & Search */}
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
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari nama/NISN siswa..."
                />
            </FilterToolbar>

            <div className="gakk-content">
                {loading ? (
                    <div className="gakk-loading">
                        <Spinner variant="buble" size={18} />
                    </div>
                ) : (
                    <div className="gakk-daily">
                        <div className="gakk-daily-hdr">
                            <div className="gakk-daily-hdr-l">
                                <span className="gakk-daily-date">Anak Asuh Anda</span>
                                <span className="gakk-daily-class">{siswa.length} Siswa</span>
                            </div>
                        </div>
                        <div className="gakk-daily-list">
                            {siswa.filter(s => {
                                if (!searchQuery) return true;
                                const q = searchQuery.toLowerCase();
                                return s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q);
                            }).map((s, idx) => (
                                <div key={s.nisn} className="gakk-item">
                                    <div className="gakk-item-left">
                                        <div className="gakk-item-avatar">
                                            {s.foto_profil && (
                                                <img
                                                    src={getProxiedImageUrl(s.foto_profil)}
                                                    alt={s.nama}
                                                    className="gakk-avatar-img"
                                                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                                />
                                            )}
                                            <span>{s.nama.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}</span>
                                        </div>
                                        <div className="gakk-item-info">
                                            <span className="gakk-item-name">{s.nama}</span>
                                            <span className="gakk-item-nisn">NISN: {s.nisn} • Kelas {s.kelas}</span>
                                        </div>
                                    </div>
                                    <div className="gakk-item-right">
                                        <ActionButton action="view" label="Detail" iconOnly={false} onClick={() => setDetailModal({
                                            nisn: s.nisn,
                                            nama: s.nama
                                        })} />
                                    </div>
                                </div>
                            ))}
                            {siswa.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>
                                    Anda belum mengklaim anak asuh untuk tahun ajaran ini.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {detailModal && (
                <Modal size="lg" onClose={() => setDetailModal(null)} labelledBy="kokurikuler-detail-title">
                    <ModalHeader
                        id="kokurikuler-detail-title"
                        icon="calendar-check"
                        title="Detail Kegiatan"
                        subtitle={detailModal.nama}
                        onClose={() => setDetailModal(null)}
                    />
                    <ModalBody className="gakk-modal-body">
                        <div className="gakk-modal-filter">
                            <label>Tanggal:</label>
                            <DatePicker
                                value={modalDate}
                                onChange={setModalDate}
                                min={monthRange?.start}
                                max={monthRange?.end}
                            />
                        </div>
                            {modalLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                                    <Spinner variant="buble" size={24} />
                                </div>
                            ) : modalData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                                    <p style={{ marginTop: '10px' }}>Tidak ada kegiatan yang dicatat pada tanggal {formatTanggal(modalDate)}.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {modalData.map((detail, idx) => (
                                        <div key={idx} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 'bold', color: '#334155' }}>{detail.nama_kegiatan}</span>
                                                {detail.is_custom && <span style={{ fontSize: '0.7rem', color: '#3b82f6', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>Kustom</span>}
                                            </div>
                                            <span className={`gakk-badge gakk-badge-${detail.status.toLowerCase()}`}>{detail.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </ModalBody>
                    <ModalFooter>
                        <Button type="button" variant="cancel" onClick={() => setDetailModal(null)} leftIcon={<i className="bi bi-x-lg" />}>Tutup</Button>
                    </ModalFooter>
                </Modal>
            )}

            <style jsx>{`
                .gakk-wrap { display: flex; flex-direction: column; gap: 14px; }
                .gakk-toolbar { display: flex; flex-direction: column; gap: 12px; padding: 0; background: transparent; border: none; }
                
                .gakk-loading { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 60px 20px; color: var(--n-muted); }
                .gakk-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                
                .gakk-daily { background: var(--n-card); border-radius: 16px; border: 1px solid var(--n-border); overflow: hidden; }
                .gakk-daily-hdr { padding: 16px; background: linear-gradient(135deg, #1e293b, #334155); color: white; display: flex; justify-content: space-between; }
                .gakk-daily-date { font-size: 0.95rem; font-weight: 800; display: block; margin-bottom: 6px; }
                .gakk-daily-class { font-size: 0.75rem; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-weight: 600; }
                
                .gakk-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--n-border); transition: all 0.2s; }
                .gakk-item:hover { background: var(--n-soft); }
                .gakk-item-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
                .gakk-item-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #3083FF, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; position: relative; overflow: hidden; flex-shrink: 0; }
                .gakk-avatar-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gakk-item-info { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
                .gakk-item-name { font-size: 0.95rem; font-weight: 700; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .gakk-item-nisn { font-size: 0.75rem; color: var(--n-muted); }
                
                .gakk-item-right { display: flex; align-items: center; gap: 10px; }
                .gakk-item-detail-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-size: 0.8rem; font-weight: 700; color: #3b82f6; cursor: pointer; transition: all 0.2s; white-space: nowrap; height: 36px; min-width: 36px; }
                .gakk-item-detail-btn:hover { background: #eff6ff; border-color: #3b82f6; }
                .gakk-item-detail-btn i { font-size: 0.9rem; }

                /* Base (Mobile) */
                .gakk-toolbar { display: flex; flex-direction: column; gap: 12px; }
                .gakk-left-panel { display: flex; flex-direction: column; gap: 12px; }
                .gakk-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

                .gakk-search { position: relative; display: flex; align-items: center; width: 100%; }
                .gakk-search i { position: absolute; left: 12px; font-size: 0.9rem; color: var(--n-muted); }
                .gakk-search input { width: 100%; min-height: 44px; padding: 0 12px 0 36px; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; font-size: 0.85rem; font-weight: 600; color: var(--n-ink); outline: none; transition: all 0.2s; }
                .gakk-search input:focus { border-color: #3b82f6; }
                .gakk-select-group { position: relative; display: flex; align-items: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; padding: 0 12px; gap: 8px; min-height: 44px; transition: all 0.2s; }
                .gakk-select-group i { font-size: 0.9rem; color: var(--n-muted); }
                .gakk-select-group select { flex: 1; border: none; background: transparent; padding: 12px 4px; font-size: 0.85rem; font-weight: 600; color: var(--n-ink); outline: none; -webkit-appearance: none; cursor: pointer; }
                .gakk-select-group:hover, .gakk-search input:hover { border-color: var(--n-muted); }

                @media (max-width: 639px) {
                    .gakk-item { flex-direction: column; align-items: flex-start; gap: 12px; }
                    .gakk-item-right { width: 100%; justify-content: flex-start; }
                    .gakk-item-avatar { display: none; }
                    .gakk-item-detail-btn span { display: none; }
                    .gakk-item-detail-btn { width: 100%; }
                }

                /* Desktop - Small desktop (1024px+) */
                @media (min-width: 1024px) {
                    .gakk-toolbar { flex-direction: row; align-items: center; justify-content: space-between; width: 100%; gap: 16px; padding: 0; }
                    .gakk-left-panel { flex-direction: row; align-items: center; gap: 16px; flex: 1; margin-left: 12px; }
                    .gakk-filters { display: contents; }
                    .gakk-search { flex: 2; order: 5; }
                    .gakk-select-group { flex: 1; min-width: 130px; }
                }

                /* Isi modal detail; kerangka berasal dari components/modal.css. */
                .gakk-modal-filter { padding: 0 0 16px; background: transparent; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
                .gakk-modal-filter label { font-size: 0.85rem; font-weight: 700; color: #475569; }
                .gakk-modal-filter input { flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; color: #1e293b; font-weight: 600; outline: none; transition: border-color 0.2s; }
                .gakk-modal-filter input:focus { border-color: #3b82f6; }
                
                .gakk-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; }
                .gakk-badge-disetujui { background: #dcfce7; color: #166534; }
                .gakk-badge-ditolak { background: #fee2e2; color: #991b1b; }
                .gakk-badge-pending { background: #fef9c3; color: #854d0e; }

                :global(.dark) .gakk-daily { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gakk-daily-hdr { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gakk-item { border-bottom-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .gakk-item:hover { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .gakk-item-name { color: #ffffff !important; }
                :global(.dark) .gakk-item-nisn { color: #94a3b8 !important; }
                :global(.dark) .gakk-search input,
                :global(.dark) .gakk-select-group { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #ffffff !important; }
                :global(.dark) .gakk-select-group i { color: #60a5fa !important; }
                :global(.dark) .gakk-select-group select {
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
                }
                :global(.dark) .gakk-modal-filter { border-bottom-color: rgba(26, 115, 232, 0.3) !important; color: #94a3b8 !important; }
            `}</style>
        </div>
    );
}
