'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/hooks/use-timezone';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { Modal, ModalHeader, ModalBody, ModalViewFooter } from '@/components/ui/Modal';
import type { CatatanSiswa } from '@/lib/types';
import { FilterToolbar, FilterSelect, FilterInput, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import ReportPdfButton from '../components/ReportPdfButton';
import { loadCatatanReport } from '@/lib/wali-kelas-report-data';
import { Spinner } from '@/components/ui/Spinner';
import { isUserAdmin } from '@/lib/auth-client';

interface WaliKelasTabProps { user?: any; }

async function authFetch(url: string) {
    return fetch(url);
}

export default function WaliKelasTabCatatan({ user }: WaliKelasTabProps) {
    const nip = user?.nip || user?.username || '';
    const isAdmin = isUserAdmin(user);

    const [kelasList, setKelasList] = useState<string[]>([]);
    const [selectedKelas, setSelectedKelas] = useState<string>('');
    const [bulan, setBulan] = useState<string>(''); // YYYY-MM
    const [jenisFilter, setJenisFilter] = useState<'ALL' | 'POSITIF' | 'NEGATIF'>('ALL');
    const [items, setItems] = useState<CatatanSiswa[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CatatanSiswa | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { registerModal } = useModalBlur();
    useEffect(() => {
        if (selectedItem) return registerModal();
    }, [selectedItem, registerModal]);

    const ta = useTahunAjaranFilter();
    const { getCurrentDate: getTzDate } = useTimezone();

    useEffect(() => {
        const init = async () => {
            const today = await getTzDate();
            if (today) setBulan(today.slice(0, 7));
        };
        init();
    }, [getTzDate]);

    useEffect(() => {
        const firstYear = Number.parseInt(ta.selected.split('/')[0], 10);
        const month = Number.parseInt(bulan.slice(5, 7), 10);
        if (!Number.isFinite(firstYear) || !month) return;
        const adjusted = `${month >= 7 ? firstYear : firstYear + 1}-${String(month).padStart(2, '0')}`;
        if (adjusted !== bulan) setBulan(adjusted);
    }, [ta.selected, bulan]);

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
                const unique = Array.from(new Set(result.kelas_list)) as string[];
                setKelasList(unique);
                if (unique.length > 0) {
                    if (!selectedKelas || !unique.includes(selectedKelas)) {
                        setSelectedKelas(unique[0]);
                    }
                } else {
                    setSelectedKelas('');
                }
            } else {
                setKelasList([]);
                setSelectedKelas('');
            }
        } catch (err) { console.error(err); }
    }, [nip, isAdmin, ta.selected, selectedKelas]);

    useEffect(() => { loadKelasList(); }, [loadKelasList]);

    const loadItems = useCallback(async () => {
        if (!selectedKelas || !bulan) return;
        setLoading(true);
        try {
            const [year, month] = bulan.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const tanggal_from = `${bulan}-01`;
            const tanggal_to = `${bulan}-${String(lastDay).padStart(2, '0')}`;

            const params = new URLSearchParams();
            params.append('kelas', selectedKelas);
            params.append('tanggal_from', tanggal_from);
            params.append('tanggal_to', tanggal_to);
            if (jenisFilter !== 'ALL') params.append('jenis', jenisFilter);

            const res = await authFetch(`/api/catatan-siswa?${params.toString()}`);
            const json = await res.json();
            if (json.ok) setItems(json.data || []);
            else setItems([]);
        } catch (err) {
            console.error(err);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [selectedKelas, bulan, jenisFilter, ta.selected]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const formatDate = (d: string) => {
        if (!d) return '-';
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };

    const statusLabel = (s: string) => {
        if (s === 'SELESAI') return { label: 'Selesai', cls: 'wktc-status--selesai' };
        if (s === 'DITINDAKLANJUTI') return { label: 'Ditindaklanjuti', cls: 'wktc-status--proses' };
        return { label: 'Baru', cls: 'wktc-status--baru' };
    };

    return (
        <div className="wktc-wrap">
            <FilterToolbar actionsInline>
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
                    label="Kelas"
                    icon="door-open"
                    value={selectedKelas}
                    onChange={setSelectedKelas}
                    disabled={kelasList.length === 0}
                    options={kelasList.length === 0
                        ? [{ value: '', label: 'Tidak ada kelas' }]
                        : kelasList.map(k => ({ value: k, label: k }))}
                />
                <FilterInput
                    label="Bulan"
                    icon="calendar-event"
                    type="month"
                    value={bulan}
                    onChange={setBulan}
                    min={ta.range?.start.slice(0, 7)}
                    max={ta.range?.end.slice(0, 7)}
                />
                <FilterSelect
                    label="Jenis"
                    icon="funnel"
                    value={jenisFilter}
                    onChange={v => setJenisFilter(v as any)}
                    options={[
                        { value: 'ALL', label: 'Semua' },
                        { value: 'POSITIF', label: 'Positif' },
                        { value: 'NEGATIF', label: 'Negatif' },
                    ]}
                />
                <FilterSearch
                    label="Pencarian"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari siswa, mapel, catatan..."
                />
                <FilterActions>
                    <ReportPdfButton disabled={loading || !selectedKelas || !ta.selected || !bulan}
                        filename={`Laporan_Catatan_Pembelajaran_${selectedKelas}_${bulan}`}
                        contextKey={JSON.stringify([selectedKelas, ta.selected, bulan, jenisFilter, searchQuery])}
                        load={signal => loadCatatanReport({ kelas: selectedKelas, tahun: ta.selected, bulan, jenis: jenisFilter, query: searchQuery, wali: user?.nama }, signal)} />
                </FilterActions>
            </FilterToolbar>

            <div className="wktc-list">
                {(() => {
                    const filteredItems = items.filter(it => {
                        if (!searchQuery.trim()) return true;
                        const q = searchQuery.toLowerCase();
                        return (it.nama_snapshot || '').toLowerCase().includes(q) ||
                               (it.mapel || '').toLowerCase().includes(q) ||
                               (it.nama_guru || '').toLowerCase().includes(q) ||
                               (it.catatan || '').toLowerCase().includes(q);
                    });
                    return loading ? (
                        <div className="wktc-state"><Spinner variant="buble" size={28} /></div>
                    ) : filteredItems.length === 0 ? (
                        <div className="wktc-state">
                            <i className="bi bi-journal-text" style={{ fontSize: '2rem', opacity: 0.4 }}></i>
                            <p>Belum ada catatan pembelajaran untuk periode ini.</p>
                        </div>
                    ) : (
                        filteredItems.map(it => {
                            const st = statusLabel(it.status);
                            return (
                                <div
                                    key={it.id}
                                    className={`wktc-card wktc-card--${it.jenis.toLowerCase()}`}
                                    onClick={() => setSelectedItem(it)}
                                >
                                    <div className="wktc-card-top">
                                        <span className="wktc-badge">
                                            <i className={`bi ${it.jenis === 'POSITIF' ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill'}`}></i>
                                            {it.jenis === 'POSITIF' ? 'Positif' : 'Negatif'}
                                        </span>
                                        <span className={`wktc-status ${st.cls}`}>{st.label}</span>
                                    </div>
                                    <div className="wktc-card-siswa">{it.nama_snapshot}</div>
                                    <p className="wktc-card-text">{it.catatan}</p>
                                    <div className="wktc-card-meta">
                                        <span><i className="bi bi-calendar3"></i> {formatDate(it.tanggal)}</span>
                                        {it.mapel && <span><i className="bi bi-book"></i> {it.mapel}</span>}
                                        <span><i className="bi bi-person"></i> {it.nama_guru}</span>
                                    </div>
                                </div>
                            );
                        })
                    );
                })()}
            </div>

            {selectedItem && (
                <Modal size="lg" onClose={() => setSelectedItem(null)} labelledBy="wktc-detail-title">
                        <ModalHeader id="wktc-detail-title" icon="journal-text" title={selectedItem.nama_snapshot} subtitle={`${formatDate(selectedItem.tanggal)}${selectedItem.mapel ? ` • ${selectedItem.mapel}` : ''}`} onClose={() => setSelectedItem(null)} />
                        <ModalBody>
                            <span className={`wktc-badge wktc-badge--lg wktc-badge--${selectedItem.jenis.toLowerCase()}`}>
                                <i className={`bi ${selectedItem.jenis === 'POSITIF' ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill'}`}></i>
                                {selectedItem.jenis === 'POSITIF' ? 'Catatan Positif' : 'Catatan Negatif'}
                            </span>
                            <p className="wktc-modal-text">{selectedItem.catatan}</p>
                            <div className="wktc-modal-info">
                                <span>Dicatat oleh <strong>{selectedItem.nama_guru}</strong></span>
                            </div>

                            {selectedItem.catatan_siswa_tindak_lanjut && selectedItem.catatan_siswa_tindak_lanjut.length > 0 && (
                                <div className="wktc-tindaklanjut">
                                    <h4>Riwayat Tindak Lanjut BK</h4>
                                    {selectedItem.catatan_siswa_tindak_lanjut
                                        .slice()
                                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                        .map(tl => (
                                            <div key={tl.id} className="wktc-tl-item">
                                                <div className="wktc-tl-top">
                                                    <strong>{tl.nama}</strong>
                                                    <span className={`wktc-status ${statusLabel(tl.status_baru).cls}`}>{statusLabel(tl.status_baru).label}</span>
                                                </div>
                                                <p>{tl.catatan}</p>
                                                <span className="wktc-tl-time">{new Date(tl.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </ModalBody>
                        <ModalViewFooter onClose={() => setSelectedItem(null)} />
                </Modal>
            )}

            <style jsx>{`
                .wktc-wrap { display: flex; flex-direction: column; gap: 16px; }

                /* Toolbar filter: lihat components/FilterToolbar.tsx (.ftb-*) */

                .wktc-list { display: flex; flex-direction: column; gap: 10px; }

                .wktc-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 40px 0;
                    color: var(--n-muted);
                    font-size: 13px;
                }
                .wktc-spinner {
                    width: 28px; height: 28px; border-radius: 50%;
                    border: 3px solid var(--n-border); border-top-color: var(--n-primary);
                    animation: wktcSpin 0.8s linear infinite;
                }
                @keyframes wktcSpin { to { transform: rotate(360deg); } }

                .wktc-card {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-left: 4px solid var(--n-border);
                    border-radius: 12px;
                    padding: 14px 16px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .wktc-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
                .wktc-card--positif { border-left-color: #22c55e; }
                .wktc-card--negatif { border-left-color: #ef4444; }

                .wktc-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }

                .wktc-badge {
                    display: inline-flex; align-items: center; gap: 5px;
                    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
                }
                .wktc-card--positif .wktc-badge { color: #16a34a; }
                .wktc-card--negatif .wktc-badge { color: #dc2626; }

                .wktc-badge--lg { font-size: 13px; padding: 6px 12px; border-radius: 99px; }
                .wktc-badge--positif { background: rgba(34,197,94,0.1); color: #16a34a; }
                .wktc-badge--negatif { background: rgba(239,68,68,0.1); color: #dc2626; }

                .wktc-status {
                    font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 99px;
                }
                .wktc-status--baru { background: var(--n-soft); color: var(--n-muted); }
                .wktc-status--proses { background: #fef3c7; color: #b45309; }
                .wktc-status--selesai { background: #dcfce7; color: #16a34a; }

                .wktc-card-siswa { font-weight: 700; font-size: 14px; color: var(--n-text); margin-bottom: 4px; }
                .wktc-card-text {
                    font-size: 13px; color: var(--n-text); margin: 0 0 8px;
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
                }
                .wktc-card-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--n-muted); }
                .wktc-card-meta span { display: inline-flex; align-items: center; gap: 4px; }

                .wktc-modal-text { font-size: 13.5px; line-height: 1.6; color: var(--n-text); margin: 12px 0; white-space: pre-wrap; }
                .wktc-modal-info { font-size: 12px; color: var(--n-muted); margin-bottom: 16px; }

                .wktc-tindaklanjut { border-top: 1px solid var(--n-border); padding-top: 14px; }
                .wktc-tindaklanjut h4 { font-size: 12px; font-weight: 700; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 10px; }
                .wktc-tl-item { background: var(--n-soft); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
                .wktc-tl-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 12.5px; }
                .wktc-tl-item p { margin: 0 0 4px; font-size: 12.5px; color: var(--n-text); }
                .wktc-tl-time { font-size: 10.5px; color: var(--n-muted); }

                /* Dark Mode */
                :global(.dark) .wktc-card {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                }
                :global(.dark) .wktc-card-siswa { color: #ffffff !important; }
                :global(.dark) .wktc-card-text { color: #cbd5e1 !important; }
                :global(.dark) .wktc-modal-text { color: #ffffff !important; }
                :global(.dark) .wktc-tl-item { background: rgba(26, 115, 232, 0.1) !important; border: 1px solid rgba(26, 115, 232, 0.25) !important; }
                :global(.dark) .wktc-tl-item p { color: #ffffff !important; }
            `}</style>
        </div>
    );
}
