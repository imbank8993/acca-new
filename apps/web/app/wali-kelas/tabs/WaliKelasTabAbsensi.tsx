'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { Modal, ModalHeader, ModalBody, ModalViewFooter, ModalDetailGrid, ModalDetailField } from '@/components/ui/Modal';
import { useTimezone } from '@/hooks/use-timezone';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import DatePicker from '@/components/ui/DatePicker';
import { FilterToolbar, FilterSelect, FilterField, FilterToggle, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { ActionGroup, ActionButton } from '@/components/ui/ActionButtons';
import { Button } from '@/components/ui/Button';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { isUserAdmin } from '@/lib/auth-client';

const ExportModal = dynamic(() => import('@/app/absensi/components/ExportModal'), { ssr: false });

interface WaliKelasTabProps { user?: any; }

interface SiswaAkumulasi {
    nisn: string;
    nama: string;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    total: number;
    daily?: Record<string, string>;
    ktDetail?: Record<string, { jenis: string; keterangan: string; tgl_mulai: string; tgl_selesai: string }> | null;
}

interface Summary {
    total: number;
    total_hari_izin: number;
    total_hari_sakit: number;
    total_hari_alpha: number;
    hadir_count?: number;
    izin_count?: number;
    sakit_count?: number;
    alpha_count?: number;
}

const STATUS_MAP: Record<string, { label: string; badge: string; icon: string; bg: string; short: string }> = {
    'H': { label: 'Hadir', badge: 'badge-hadir', icon: 'check-circle', bg: 'rgba(16,185,129,0.12)', short: 'H' },
    'I': { label: 'Izin', badge: 'badge-izin', icon: 'envelope', bg: '#10b981', short: 'I' },
    'S': { label: 'Sakit', badge: 'badge-sakit', icon: 'thermometer-half', bg: '#f59e0b', short: 'S' },
    'A': { label: 'Alpha', badge: 'badge-alpha', icon: 'exclamation-triangle', bg: '#ef4444', short: 'A' },
    'L': { label: 'Libur', badge: 'badge-libur', icon: 'sun', bg: '#f1f5f9', short: 'L' },
    'W': { label: 'Weekend', badge: 'badge-libur', icon: 'calendar-weekend', bg: '#f1f5f9', short: 'W' },
};

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAY_NAMES_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

export default function WaliKelasTabAbsensi({ user }: WaliKelasTabProps) {
    const nip = user?.nip || user?.username || '';
    const isAdmin = isUserAdmin(user);

    const [loading, setLoading] = useState(false);
    const [locking, setLocking] = useState(false);
    const [data, setData] = useState<{
        kelas: string;
        siswa: SiswaAkumulasi[];
        summary: Summary;
        periode?: { start: string; end: string };
        holidays?: any[];
        locked?: boolean;
        locked_at?: string;
        locked_by_nama?: string;
    } | null>(null);

    const [selectedKelas, setSelectedKelas] = useState<string>('');
    const [kelasList, setKelasList] = useState<string[]>([]);
    const [periodeType, setPeriodeType] = useState<'harian' | 'bulanan'>('bulanan');
    const [tanggal, setTanggal] = useState<string>('');
    const [bulan, setBulan] = useState<string>('');
    // Bulan dipilih sebagai nama bulan (mengikuti desain tab Jurnal);
    // tahun kalender diturunkan dari tahun ajaran terpilih.
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [showToday, setShowToday] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter tahun ajaran (pilihan = tahun ajaran aktif); input bulan/tanggal
    // dibatasi ke rentang tahun ajaran terpilih (Juli s.d. Juni).
    const ta = useTahunAjaranFilter();
    const [detailModal, setDetailModal] = useState<{ nisn: string; nama: string; details: { jenis: string; keterangan: string; tgl_mulai: string; tgl_selesai: string }[] } | null>(null);

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (detailModal) return registerModal();
    }, [detailModal, registerModal]);

    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();

    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            if (today) {
                const [, m] = today.split('-');
                setTanggal(today);
                setSelectedMonth(parseInt(m, 10));
                setBulan(today.slice(0, 7));
            }
        };
        init();
    }, [getTzDate]);

    // bulan (YYYY-MM) diturunkan dari tahun ajaran + nama bulan terpilih
    // (Jul-Des = tahun pertama TA, Jan-Jun = tahun kedua)
    useEffect(() => {
        const yStart = parseInt((ta.selected || '').split('/')[0]);
        if (isNaN(yStart) || !selectedMonth) return;
        const y = selectedMonth >= 7 ? yStart : yStart + 1;
        setBulan(`${y}-${String(selectedMonth).padStart(2, '0')}`);
    }, [ta.selected, selectedMonth]);

    const [loadError, setLoadError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!nip && !isAdmin) return;
        if (!selectedKelas) return;
        if (periodeType === 'bulanan' && !bulan) return;
        if (periodeType === 'harian' && !tanggal) return;
        setLoading(true);
        setLoadError(null);
        try {
            let params = new URLSearchParams();
            params.append('nip', nip || '');
            params.append('kelas', selectedKelas);
            if (ta.selected) params.append('tahun_ajaran', ta.selected);
            if (periodeType === 'harian' && tanggal) params.append('tanggal', tanggal);
            else if (periodeType === 'bulanan' && bulan) params.append('bulan', bulan);
            const res = await fetch(`/api/wali-kelas/absensi-akumulasi?${params.toString()}`);
            const result = await res.json();
            if (res.ok && !result.error) {
                setData(result);
            } else {
                setLoadError(result.message || result.error || 'Gagal memuat rekap absensi.');
            }
        } catch (err: any) {
            console.error(err);
            setLoadError(err.message || 'Gagal memuat rekap absensi.');
        } finally { setLoading(false); }
    }, [nip, isAdmin, selectedKelas, periodeType, tanggal, bulan, ta.selected]);

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
                    setSelectedKelas(prev => (!prev || !uniqueKelas.includes(prev) ? uniqueKelas[0] : prev));
                } else {
                    setSelectedKelas('');
                }
            } else {
                setKelasList([]);
                setSelectedKelas('');
            }
        } catch (err) { console.error(err); }
    }, [nip, isAdmin, ta.selected]);

    useEffect(() => { loadKelasList(); }, [loadKelasList]);
    useEffect(() => { if (selectedKelas) loadData(); }, [selectedKelas, periodeType, tanggal, bulan, loadData]);

    // Bulan yang ditampilkan sudah lewat (bukan bulan berjalan) -> boleh dikunci
    const [currentBulan, setCurrentBulan] = useState('');
    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            if (today) setCurrentBulan(today.slice(0, 7));
        };
        init();
    }, [getTzDate]);
    const isPastMonth = !!bulan && !!currentBulan && bulan < currentBulan;

    const callLockApi = async (action: 'lock' | 'unlock') => {
        return fetch(`/api/wali-kelas/absensi-akumulasi/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kelas: selectedKelas, bulan }),
        });
    };

    const handleLock = async () => {
        if (!selectedKelas || !bulan) return;
        setLocking(true);
        try {
            const res = await callLockApi('lock');
            const result = await res.json();
            if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal mengunci rekap');
            await loadData();
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Gagal mengunci rekap');
        } finally {
            setLocking(false);
        }
    };

    const handleUnlock = async () => {
        if (!selectedKelas || !bulan) return;
        setLocking(true);
        try {
            const res = await callLockApi('unlock');
            const result = await res.json();
            if (!res.ok || !result.ok) throw new Error(result.error || 'Gagal membuka kunci rekap');
            await loadData();
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Gagal membuka kunci rekap');
        } finally {
            setLocking(false);
        }
    };

    const handleTodayToggle = (active: boolean) => {
        setShowToday(active);
        if (active) {
            setPeriodeType('harian');
            const todayStr = getTzDate();
            setTanggal(todayStr);
        } else {
            setPeriodeType('bulanan');
        }
    };

    const formatTanggal = (dateStr: string): string => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const sortedSiswa = useMemo(() => {
        if (!data?.siswa) return [];
        let list = [...data.siswa].sort((a, b) => {
            const statusA = a.daily?.[tanggal] || 'H';
            const statusB = b.daily?.[tanggal] || 'H';
            const isNotHadirA = ['I', 'S', 'A'].includes(statusA);
            const isNotHadirB = ['I', 'S', 'A'].includes(statusB);
            if (isNotHadirA && !isNotHadirB) return -1;
            if (!isNotHadirA && isNotHadirB) return 1;
            return a.nama.localeCompare(b.nama);
        });
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s => (s.nama || '').toLowerCase().includes(q) || (s.nisn || '').toLowerCase().includes(q));
        }
        return list;
    }, [data, tanggal, searchQuery]);

    const filteredMonthlySiswa = useMemo(() => {
        if (!data?.siswa) return [];
        if (!searchQuery.trim()) return data.siswa;
        const q = searchQuery.toLowerCase();
        return data.siswa.filter(s => (s.nama || '').toLowerCase().includes(q) || (s.nisn || '').toLowerCase().includes(q));
    }, [data?.siswa, searchQuery]);

    const hadirCount = data?.siswa.filter(s => s.daily?.[tanggal] === 'H').length || 0;

    return (
        <div className="wka-wrap">
            {/* Toolbar */}
            <FilterToolbar actionsInline>
                <FilterToggle
                    label="Periode"
                    text="Hari Ini"
                    checked={showToday}
                    onChange={handleTodayToggle}
                />
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
                {periodeType === 'harian' ? (
                    <FilterField label="Tanggal" bare disabled={showToday}>
                        <DatePicker
                            value={tanggal}
                            min={ta.range?.start}
                            max={ta.range?.end}
                            onChange={setTanggal}
                            disabled={showToday}
                        />
                    </FilterField>
                ) : (
                    <FilterSelect
                        label="Bulan"
                        icon="calendar-event"
                        value={String(selectedMonth)}
                        onChange={v => setSelectedMonth(parseInt(v))}
                        options={MONTH_NAMES.map((b, i) => ({ value: String(i + 1), label: b }))}
                    />
                )}
                <FilterSelect
                    label="Kelas"
                    icon="door-open"
                    value={selectedKelas}
                    onChange={setSelectedKelas}
                    options={kelasList.map(k => ({ value: k, label: k }))}
                />
                <FilterSearch
                    label="Pencarian"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari siswa atau NISN..."
                />
                <FilterActions>
                    <Button
                        variant="outline"
                        icon="export"
                        onClick={() => setShowExportModal(true)}
                        className="ftb-btn-icon-mobile"
                    >
                        Export
                    </Button>
                </FilterActions>
            </FilterToolbar>

            {/* Content */}
            <div className="wka-content">
                {loading ? (
                    <div className="wka-loading">
                        <Spinner variant="buble" size={32} />
                    </div>
                ) : loadError ? (
                    <div style={{ padding: '36px 16px', textAlign: 'center', background: 'var(--n-card)', border: '1px solid var(--n-border)', borderRadius: 14 }}>
                        <i className="bi bi-exclamation-triangle" style={{ fontSize: '2.2rem', color: '#e11d48', display: 'inline-block', marginBottom: 8 }} />
                        <h4 style={{ margin: '8px 0 6px', fontWeight: 700, fontSize: '1rem', color: 'var(--n-text)' }}>Gagal Memuat Data Absensi</h4>
                        <p style={{ color: 'var(--n-muted)', fontSize: '0.82rem', marginBottom: 16 }}>{loadError}</p>
                        <Button variant="secondary" size="sm" onClick={() => loadData()}>
                            <i className="bi bi-arrow-clockwise" /> Coba Lagi
                        </Button>
                    </div>
                ) : (
                    <>
                        {periodeType === 'harian' ? (
                            <div className="wka-daily">
                                {/* Daily View - Mobile Card List */}
                                <div className="wka-daily-list">
                                    {sortedSiswa.map((siswa, idx) => {
                                        const rawStatus = siswa.daily?.[tanggal];
                                        const statusHari = (rawStatus && rawStatus !== 'L') ? rawStatus : 'H';
                                        const ktDetail = siswa.ktDetail?.[tanggal];
                                        const hasDetail = (statusHari === 'I' || statusHari === 'S' || statusHari === 'A') && ktDetail;

                                        const statusMap: Record<string, { label: string; badge: string; icon: string; color: string }> = {
                                            'H': { label: 'Hadir', badge: 'badge-hadir', icon: 'check-circle', color: 'blue' },
                                            'I': { label: 'Izin', badge: 'badge-izin', icon: 'envelope', color: 'green' },
                                            'S': { label: 'Sakit', badge: 'badge-sakit', icon: 'thermometer-half', color: 'amber' },
                                            'A': { label: 'Alpha', badge: 'badge-alpha', icon: 'exclamation-triangle', color: 'red' },
                                        };
                                        const status = statusMap[statusHari] || statusMap['H'];

                                        return (
                                            <div key={siswa.nisn} className={`wka-item wka-item-${status.color}`}>
                                                <div className="wka-item-left">
                                                    <span className="wka-item-num">{idx + 1}</span>
                                                    <div className="wka-item-avatar">
                                                        {siswa.nama.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <div className="wka-item-info">
                                                        <span className="wka-item-name">{siswa.nama}</span>
                                                        <span className="wka-item-nisn">{siswa.nisn}</span>
                                                    </div>
                                                </div>
                                                <div className="wka-item-right">
                                                    {hasDetail && (
                                                        <button className="wka-item-info-btn" onClick={() => setDetailModal({
                                                            nisn: siswa.nisn,
                                                            nama: siswa.nama,
                                                            details: [{
                                                                jenis: ktDetail.jenis,
                                                                keterangan: ktDetail.keterangan,
                                                                tgl_mulai: ktDetail.tgl_mulai,
                                                                tgl_selesai: ktDetail.tgl_selesai
                                                            }]
                                                        })}>
                                                            <i className="bi bi-info-circle" />
                                                        </button>
                                                    )}
                                                    <span className={`wka-item-badge ${status.badge}`}>
                                                        <i className={`bi bi-${status.icon}`} />
                                                        {status.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="wka-monthly-wrap">
                                {/* Monthly View - Table (Desktop) */}
                                <div className="wka-monthly-desktop">
                                    <div className="wka-monthly-header">
                                        <span className="wka-monthly-title">
                                            Bulan: {bulan ? new Date(parseInt(bulan.split('-')[0]), parseInt(bulan.split('-')[1]) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '-'}
                                        </span>
                                        <div className="wka-lock-area">
                                            {data?.locked ? (
                                                <>
                                                    <span className="wka-lock-badge">
                                                        <i className="bi bi-lock-fill" />
                                                        Dikunci {data.locked_by_nama ? `oleh ${data.locked_by_nama}` : ''}
                                                    </span>
                                                    <button className="wka-lock-btn wka-lock-btn-open" disabled={locking} onClick={handleUnlock}>
                                                        {locking ? <span className="wka-lock-spin" /> : <i className="bi bi-unlock-fill" />}
                                                        Buka Kunci
                                                    </button>
                                                </>
                                            ) : isPastMonth ? (
                                                <button className="wka-lock-btn" disabled={locking} onClick={handleLock}>
                                                    {locking ? <span className="wka-lock-spin" /> : <i className="bi bi-lock-fill" />}
                                                    Kunci Rekap Bulan Ini
                                                </button>
                                            ) : (
                                                <span className="wka-lock-hint">
                                                    <i className="bi bi-info-circle" />
                                                    Bulan berjalan belum bisa dikunci
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="wka-monthly-table-wrap">
                                        <table className="wka-table">
                                            <thead>
                                                <tr>
                                                    <th rowSpan={2} style={{ width: 30, padding: '4px' }}>No</th>
                                                    <th rowSpan={2} style={{ minWidth: 150, maxWidth: 200, textAlign: 'left', whiteSpace: 'normal', wordWrap: 'break-word' }}>Siswa</th>
                                                    <th colSpan={bulan ? new Date(parseInt(bulan.split('-')[0]), parseInt(bulan.split('-')[1]), 0).getDate() : 31} style={{ textAlign: 'center', padding: '4px' }}>Tanggal</th>
                                                    <th colSpan={4} style={{ textAlign: 'center', padding: '4px' }}>Total</th>
                                                </tr>
                                                <tr>
                                                    {Array.from({ length: bulan ? new Date(parseInt(bulan.split('-')[0]), parseInt(bulan.split('-')[1]), 0).getDate() : 31 }, (_, i) => i + 1).map(d => (
                                                        <th key={d} style={{ width: 24, textAlign: 'center', padding: '4px 2px', fontSize: '0.7rem' }}>{d}</th>
                                                    ))}
                                                    <th style={{ width: 28, textAlign: 'center', color: '#2563eb', padding: '4px 2px', fontSize: '0.7rem' }}>H</th>
                                                    <th style={{ width: 28, textAlign: 'center', color: '#10b981', padding: '4px 2px', fontSize: '0.7rem' }}>I</th>
                                                    <th style={{ width: 28, textAlign: 'center', color: '#d97706', padding: '4px 2px', fontSize: '0.7rem' }}>S</th>
                                                    <th style={{ width: 28, textAlign: 'center', color: '#ef4444', padding: '4px 2px', fontSize: '0.7rem' }}>A</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredMonthlySiswa.map((siswa, idx) => (
                                                    <tr key={siswa.nisn}>
                                                        <td style={{ textAlign: 'center', padding: '4px' }}>{idx + 1}</td>
                                                        <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', minWidth: 150, maxWidth: 200 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <span style={{ fontWeight: 700, lineHeight: 1.2, fontSize: '0.8rem' }}>{siswa.nama}</span>
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--n-muted)' }}>{siswa.nisn}</span>
                                                            </div>
                                                        </td>
                                                        {Array.from({ length: bulan ? new Date(parseInt(bulan.split('-')[0]), parseInt(bulan.split('-')[1]), 0).getDate() : 31 }, (_, i) => i + 1).map(d => {
                                                            const dateStr = `${bulan}-${String(d).padStart(2, '0')}`;
                                                            const rawStatus = siswa.daily?.[dateStr] || '';
                                                            const normStatus = rawStatus.trim().toUpperCase();
                                                            let cellClass = '';
                                                            let text = rawStatus || '';
                                                            
                                                            if (normStatus === 'H' || normStatus.startsWith('HADIR')) { cellClass = 'wka-cell-hadir'; text = 'H'; }
                                                            else if (normStatus === 'I' || normStatus.startsWith('IZIN')) { cellClass = 'wka-cell-izin'; text = 'I'; }
                                                            else if (normStatus === 'S' || normStatus.startsWith('SAKIT')) { cellClass = 'wka-cell-sakit'; text = 'S'; }
                                                            else if (normStatus === 'A' || normStatus.startsWith('ALPHA')) { cellClass = 'wka-cell-alpha'; text = 'A'; }
                                                            else if (normStatus === 'L' || normStatus === 'W' || normStatus.startsWith('LIBUR') || normStatus.startsWith('WEEKEND')) { cellClass = 'wka-cell-libur'; text = '-'; }
                                                            
                                                            return (
                                                                <td key={d} className={cellClass} style={{ textAlign: 'center', padding: '4px 2px', fontSize: '0.75rem', fontWeight: normStatus && !['L','W'].includes(normStatus) ? 'bold' : 'normal' }}>
                                                                    {text}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2563eb', padding: '4px 2px', fontSize: '0.75rem' }}>{siswa.hadir}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#10b981', padding: '4px 2px', fontSize: '0.75rem' }}>{siswa.izin}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#d97706', padding: '4px 2px', fontSize: '0.75rem' }}>{siswa.sakit}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ef4444', padding: '4px 2px', fontSize: '0.75rem' }}>{siswa.alpha}</td>
                                                    </tr>
                                                ))}
                                                {filteredMonthlySiswa.length === 0 && (
                                                    <tr>
                                                        <td colSpan={(bulan ? new Date(parseInt(bulan.split('-')[0]), parseInt(bulan.split('-')[1]), 0).getDate() : 31) + 7} style={{ textAlign: 'center', padding: '20px' }}>
                                                            Tidak ada data siswa
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                {/* Monthly View - Cards (Mobile) */}
                                <div className="wka-monthly-mobile">
                                    <div className="wka-monthly-header wka-monthly-header-mobile">
                                        <span className="wka-monthly-title">
                                            Bulan: {bulan ? new Date(parseInt(bulan.split('-')[0]), parseInt(bulan.split('-')[1]) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '-'}
                                        </span>
                                        <div className="wka-lock-area">
                                            {data?.locked ? (
                                                <>
                                                    <span className="wka-lock-badge">
                                                        <i className="bi bi-lock-fill" />
                                                        Dikunci {data.locked_by_nama ? `oleh ${data.locked_by_nama}` : ''}
                                                    </span>
                                                    <button className="wka-lock-btn wka-lock-btn-open" disabled={locking} onClick={handleUnlock}>
                                                        {locking ? <span className="wka-lock-spin" /> : <i className="bi bi-unlock-fill" />}
                                                        Buka Kunci
                                                    </button>
                                                </>
                                            ) : isPastMonth ? (
                                                <button className="wka-lock-btn" disabled={locking} onClick={handleLock}>
                                                    {locking ? <span className="wka-lock-spin" /> : <i className="bi bi-lock-fill" />}
                                                    Kunci Rekap Bulan Ini
                                                </button>
                                            ) : (
                                                <span className="wka-lock-hint">
                                                    <i className="bi bi-info-circle" />
                                                    Bulan berjalan belum bisa dikunci
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="wka-monthly-mobile-list">
                                        {sortedSiswa.map((siswa, idx) => {
                                            const hasDetail = !!siswa.ktDetail && Object.keys(siswa.ktDetail).length > 0;
                                            const firstDetail = hasDetail ? Object.values(siswa.ktDetail || {})[0] as { jenis: string; keterangan: string; tgl_mulai: string; tgl_selesai: string } : null;

                                            return (
                                                <div key={siswa.nisn} className="wka-mc">
                                                    <div className="wka-mc-header">
                                                        <div className="wka-mc-info">
                                                            <span className="wka-mc-name">{siswa.nama}</span>
                                                            <span className="wka-mc-nisn">{siswa.nisn}</span>
                                                        </div>
                                                        {hasDetail && (
                                                            <button className="wka-mc-info-btn" onClick={() => setDetailModal({
                                                                nisn: siswa.nisn,
                                                                nama: siswa.nama,
                                                                details: Object.values(siswa.ktDetail || {}) as { jenis: string; keterangan: string; tgl_mulai: string; tgl_selesai: string }[]
                                                            })}>
                                                                <i className="bi bi-info-circle" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Stats Row */}
                                                    <div className="wka-mc-stats">
                                                        <div className="wka-mc-stat"><span className="wka-mc-stat-lbl" style={{ color: '#059669', background: '#d1fae5' }}>H</span><span className="wka-mc-stat-val">{siswa.hadir}</span></div>
                                                        <div className="wka-mc-stat"><span className="wka-mc-stat-lbl" style={{ color: '#059669', background: '#d1fae5' }}>I</span><span className="wka-mc-stat-val">{siswa.izin}</span></div>
                                                        <div className="wka-mc-stat"><span className="wka-mc-stat-lbl" style={{ color: '#d97706', background: '#fef3c7' }}>S</span><span className="wka-mc-stat-val">{siswa.sakit}</span></div>
                                                        <div className="wka-mc-stat"><span className="wka-mc-stat-lbl" style={{ color: '#dc2626', background: '#fee2e2' }}>A</span><span className="wka-mc-stat-val">{siswa.alpha}</span></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {data?.siswa.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--n-muted)' }}>
                                                Tidak ada data siswa
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <ExportModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    userRole={isAdmin ? 'ADMIN' : 'WALI'}
                    nip={nip}
                    isAdmin={isAdmin}
                    initialKelas={selectedKelas}
                    initialTahunAjaran={ta.selected}
                    lockMode={!isAdmin}
                    simpleMode={true}
                />
            )}

            {/* Detail Modal */}
            {detailModal && (
                <Modal size="lg" onClose={() => setDetailModal(null)} labelledBy="wka-detail-title">
                    <ModalHeader id="wka-detail-title" icon="person-exclamation" title="Detail Ketidakhadiran" onClose={() => setDetailModal(null)} />
                    <ModalBody>
                        <ModalDetailGrid>
                            <ModalDetailField label="Nama">{detailModal.nama}</ModalDetailField>
                            <ModalDetailField label="NISN">{detailModal.nisn}</ModalDetailField>
                        </ModalDetailGrid>
                        <div className="wka-detail-list">
                            {detailModal.details.map((detail, idx) => (
                                <div key={idx} className="wka-detail-card">
                                    <ModalDetailGrid>
                                        <ModalDetailField label="Jenis"><span className={`wka-badge wka-badge-${detail.jenis.toLowerCase()}`}>{detail.jenis}</span></ModalDetailField>
                                        <ModalDetailField label="Periode">{new Date(detail.tgl_mulai).toLocaleDateString('id-ID')} - {new Date(detail.tgl_selesai).toLocaleDateString('id-ID')}</ModalDetailField>
                                        <ModalDetailField label="Keterangan" full>{detail.keterangan || '-'}</ModalDetailField>
                                    </ModalDetailGrid>
                                </div>
                            ))}
                        </div>
                    </ModalBody>
                    <ModalViewFooter onClose={() => setDetailModal(null)} />
                </Modal>
            )}

            <style jsx>{`
                .wka-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                /* Content */
                .wka-content {
                    flex: 1;
                }

                /* Loading */
                .wka-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    padding: 60px 20px;
                    color: var(--n-muted);
                }
                .wka-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }

                /* Daily View */
                .wka-daily {
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                }

                /* List */
                .wka-daily-list {
                    display: flex;
                    flex-direction: column;
                }
                .wka-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid var(--n-border);
                    transition: all 0.2s;
                    min-height: 72px;
                }
                .wka-item:last-child { border-bottom: none; }
                .wka-item-left {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    flex: 1;
                    min-width: 0;
                }
                .wka-item-num {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    background: var(--n-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--n-muted);
                    flex-shrink: 0;
                }
                .wka-item-avatar {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #3083FF, #3b82f6);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    flex-shrink: 0;
                }
                .wka-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    flex: 1;
                    min-width: 0;
                }
                .wka-item-name {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-text);
                    line-height: 1.2;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .wka-item-nisn {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    line-height: 1.2;
                }
                .wka-item-right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-shrink: 0;
                }
                .wka-item-info-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--n-muted);
                    touch-action: manipulation;
                    transition: all 0.2s;
                }
                .wka-item-info-btn:hover {
                    background: var(--n-soft);
                    border-color: #cbd5e1;
                }
                .wka-item-badge {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 8px 14px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    white-space: nowrap;
                }
                .badge-hadir { background: rgba(59, 130, 246, 0.12); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); }
                .badge-izin { background: #10b981; color: white; }
                .badge-sakit { background: #d97706; color: white; }
                .badge-alpha { background: #ef4444; color: white; }

                .wka-item-blue { background: rgba(59, 130, 246, 0.04); }
                .wka-item-green { background: rgba(16, 185, 129, 0.04); }
                .wka-item-amber { background: rgba(245, 158, 11, 0.04); }
                .wka-item-red { background: rgba(239, 68, 68, 0.04); }
                .wka-item-rose { background: rgba(244, 63, 94, 0.04); }
                .wka-item-gray { background: var(--n-soft); border-left: 4px solid #cbd5e1; }
                .wka-item-gray .wka-item-num, .wka-item-gray .wka-item-avatar { background: var(--n-card); color: var(--n-muted); border: 1px solid var(--n-border); }

                .wka-monthly-mobile-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 16px;
                }
                .wka-mc {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-left: 4px solid #3b82f6;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .wka-mc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                }
                .wka-mc-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                }
                .wka-mc-name {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-text);
                    line-height: 1.3;
                    letter-spacing: -0.01em;
                }
                .wka-mc-nisn {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-weight: 500;
                    letter-spacing: 0.01em;
                }
                .wka-mc-info-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid var(--n-border);
                    background: var(--n-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #3b82f6;
                    flex-shrink: 0;
                    transition: all 0.2s;
                }
                .wka-mc-info-btn:active {
                    background: #e2e8f0;
                }
                .wka-mc-stats {
                    display: flex;
                    justify-content: space-around;
                    padding-top: 12px;
                    border-top: 1px dashed #e2e8f0;
                }
                .wka-mc-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                }
                .wka-mc-stat-lbl {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 4px 12px;
                    border-radius: 12px;
                    letter-spacing: 0.02em;
                }
                .wka-mc-stat-val {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--n-text);
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                /* Desktop - Monthly */
                .wka-monthly-wrap {
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .wka-monthly-mobile {
                    display: flex;
                    flex-direction: column;
                }
                .wka-monthly-desktop {
                    display: none;
                }
                .wka-monthly-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 10px;
                    padding: 16px;
                    background: var(--n-soft);
                    border-bottom: 1px solid var(--n-border);
                }
                .wka-monthly-header-mobile {
                    border-radius: 16px 16px 0 0;
                }
                .wka-monthly-title {
                    font-size: 1.05rem;
                    font-weight: 800;
                    color: var(--n-text);
                }
                .wka-lock-area {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .wka-lock-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    background: rgba(100, 116, 139, 0.12);
                    color: #475569;
                    font-size: 0.75rem;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .wka-lock-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border-radius: 10px;
                    border: none;
                    background: #3083FF;
                    color: white;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .wka-lock-btn:hover:not(:disabled) {
                    background: #002a80;
                }
                .wka-lock-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .wka-lock-btn-open {
                    background: var(--n-card);
                    color: #475569;
                    border: 1px solid var(--n-border);
                }
                .wka-lock-btn-open:hover:not(:disabled) {
                    background: var(--n-soft);
                }
                .wka-lock-hint {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    white-space: nowrap;
                }
                .wka-lock-spin {
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(255,255,255,0.4);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                .wka-lock-btn-open .wka-lock-spin {
                    border: 2px solid rgba(71,85,105,0.3);
                    border-top-color: #475569;
                }
                .wka-table-responsive {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .wka-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                }
                .wka-table th, .wka-table td {
                    border: 1px solid var(--n-border);
                    padding: 6px 4px;
                    white-space: nowrap;
                    vertical-align: middle;
                }
                .wka-table th {
                    background: var(--n-soft);
                    font-weight: 700;
                    color: var(--n-muted);
                }
                .wka-table tbody tr:hover {
                    background: var(--n-soft);
                }

                .wka-detail-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
                .wka-detail-card { padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                .wka-badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 800;
                    width: fit-content;
                }
                .wka-badge-izin { background: #d1fae5; color: #059669; }
                .wka-badge-sakit { background: #fef3c7; color: #d97706; }
                .wka-badge-alpha { background: #fee2e2; color: #dc2626; }

                /* Responsive Design */
                /* Mobile First - Small phones (< 375px) */
                @media (max-width: 374px) {
                    .wka-wrap {
                        gap: 12px;
                    }
                    .wka-item {
                        padding: 14px;
                        min-height: 68px;
                    }
                    .wka-item-left {
                        gap: 12px;
                    }
                    .wka-item-avatar {
                        width: 38px;
                        height: 38px;
                        font-size: 0.8rem;
                    }
                    .wka-item-name {
                        font-size: 0.9rem;
                    }
                    .wka-item-nisn {
                        font-size: 0.7rem;
                    }
                    .wka-item-info-btn {
                        width: 30px;
                        height: 30px;
                    }
                    .wka-item-badge {
                        padding: 6px 10px;
                        font-size: 0.7rem;
                    }
                }

                /* Mobile - Standard phones (375px - 639px) */
                @media (min-width: 375px) and (max-width: 639px) {
                    .wka-wrap {
                        gap: 14px;
                    }
                    .wka-item {
                        padding: 16px;
                    }
                }

                /* Tablet - Large tablets (768px - 1023px) */
                @media (min-width: 768px) and (max-width: 1023px) {
                    .wka-item {
                        padding: 18px 20px;
                    }
                }

                /* Desktop - Small desktop (1024px+) */
                @media (min-width: 1024px) {
                    .wka-monthly-mobile {
                        display: none;
                    }
                    .wka-monthly-desktop {
                        display: flex;
                        flex-direction: column;
                    }
                    .wka-wrap {
                        width: 100%;
                    }
                    .wka-item {
                        padding: 20px 24px;
                    }
                    .wka-item-name {
                        font-size: 1rem;
                    }
                    .wka-item-nisn {
                        font-size: 0.8rem;
                    }
                }

                /* Dark Mode */
                :global(.dark) .wka-daily {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wka-item {
                    border-bottom-color: rgba(26, 115, 232, 0.2) !important;
                }
                :global(.dark) .wka-item-name { color: #ffffff !important; }
                :global(.dark) .wka-item-num { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .wka-item-avatar { background: linear-gradient(135deg, #1d6bf3, #3083FF) !important; }
                :global(.dark) .wka-item-blue { background: rgba(59, 130, 246, 0.12) !important; }
                :global(.dark) .wka-item-green { background: rgba(16, 185, 129, 0.12) !important; }
                :global(.dark) .wka-item-amber { background: rgba(245, 158, 11, 0.12) !important; }
                :global(.dark) .wka-item-red { background: rgba(239, 68, 68, 0.12) !important; }
                :global(.dark) .badge-hadir { background: rgba(59, 130, 246, 0.2) !important; color: #60a5fa !important; border-color: rgba(96, 165, 250, 0.4) !important; }
                :global(.dark) .badge-izin { background: #10b981 !important; color: #ffffff !important; }
                :global(.dark) .badge-sakit { background: #d97706 !important; color: #ffffff !important; }
                :global(.dark) .badge-alpha { background: #ef4444 !important; color: #ffffff !important; }
                :global(.dark) .wka-monthly-wrap {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wka-monthly-header {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .wka-lock-badge { background: rgba(148, 163, 184, 0.15) !important; color: #cbd5e1 !important; }
                :global(.dark) .wka-lock-btn-open { background: #000000 !important; color: #60a5fa !important; border: 1.5px solid rgba(26, 115, 232, 0.75) !important; }
                :global(.dark) .wka-monthly-title { color: #ffffff !important; }
                :global(.dark) .wka-table th, :global(.dark) .wka-table td { border-color: rgba(26, 115, 232, 0.2) !important; }
                :global(.dark) .wka-table th {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
                    color: #94a3b8 !important;
                    border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .wka-table tbody tr:hover td:not(.wka-cell-sakit):not(.wka-cell-izin):not(.wka-cell-alpha):not([style*="background"]) { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .wka-table td { color: #ffffff !important; }
                :global(.dark) .wka-detail-card { background: rgba(26, 115, 232, 0.1) !important; border-color: rgba(26, 115, 232, 0.3) !important; }

                /* Status cells protection from hover override */
                .wka-cell-sakit,
                .wka-table tbody tr:hover td.wka-cell-sakit,
                :global(.dark) .wka-table tbody tr:hover td.wka-cell-sakit,
                :global(.dark) td.wka-cell-sakit {
                    background-color: #f59e0b !important;
                    color: #ffffff !important;
                }

                .wka-cell-izin,
                .wka-table tbody tr:hover td.wka-cell-izin,
                :global(.dark) .wka-table tbody tr:hover td.wka-cell-izin,
                :global(.dark) td.wka-cell-izin {
                    background-color: #10b981 !important;
                    color: #ffffff !important;
                }

                .wka-cell-alpha,
                .wka-table tbody tr:hover td.wka-cell-alpha,
                :global(.dark) .wka-table tbody tr:hover td.wka-cell-alpha,
                :global(.dark) td.wka-cell-alpha {
                    background-color: #ef4444 !important;
                    color: #ffffff !important;
                }

                .wka-cell-hadir,
                .wka-table tbody tr:hover td.wka-cell-hadir {
                    color: #2563eb !important;
                }
                :global(.dark) .wka-cell-hadir,
                :global(.dark) .wka-table tbody tr:hover td.wka-cell-hadir,
                :global(.dark) td.wka-cell-hadir {
                    color: #60a5fa !important;
                }

                .wka-cell-libur,
                .wka-table tbody tr:hover td.wka-cell-libur,
                :global(.dark) .wka-table tbody tr:hover td.wka-cell-libur,
                :global(.dark) td.wka-cell-libur {
                    background-color: rgba(0, 0, 0, 0.05) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .wka-cell-libur,
                :global(.dark) .wka-table tbody tr:hover td.wka-cell-libur {
                    background-color: rgba(255, 255, 255, 0.05) !important;
                }
            `}</style>
        </div>
    );
}
