'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import ModalPortal from '@/components/ui/ModalPortal';
import { Spinner } from '@/components/ui/Spinner';
import { GraduationCap, X, AlertTriangle, FolderX, BookOpen } from 'lucide-react';

interface NilaiItem {
    id: string;
    nip: string;
    kelas: string;
    mapel: string;
    semester: number;
    tahun_ajaran: string;
    nisn: string;
    jenis: string;
    materi_tp: string;
    tagihan: string;
    nilai: number | null;
    catatan: string | null;
    updated_at: string;
    nama_guru: string;
    topik?: string | null;
}

interface GroupedData {
    siswa: { nisn: string; nama_lengkap: string; foto_profil: string | null } | null;
    kelas: any[];
    grouped: Record<string, Record<string, NilaiItem[]>>;
    all: NilaiItem[];
}

interface HistoriNilaiModalProps {
    nisn: string;
    namaSiswa: string;
    onClose: () => void;
}

export default function HistoriNilaiModal({ nisn, namaSiswa, onClose }: HistoriNilaiModalProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<GroupedData | null>(null);
    
    // Filters logic
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('2');
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [availableSemester] = useState<string[]>(['1', '2']);

    const fetchNilai = useCallback(async () => {
        if (!nisn) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/nilai/siswa?nisn=${encodeURIComponent(nisn)}`);
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Gagal memuat data nilai');

            setData(json.data);
            if (json.data?.grouped) {
                const tahunList = Object.keys(json.data.grouped).sort((a, b) => b.localeCompare(a));
                setAvailableTahunAjaran(tahunList);
                if (tahunList.length > 0) setSelectedTahunAjaran(tahunList[0]);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [nisn]);

    useEffect(() => {
        fetchNilai();
    }, [fetchNilai]);

    const currentItems = useMemo(() => {
        if (!data?.grouped || !selectedTahunAjaran || !selectedSemester) {
            return data?.all || [];
        }
        return data.grouped[selectedTahunAjaran]?.[selectedSemester] || [];
    }, [data, selectedTahunAjaran, selectedSemester]);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        currentItems.forEach(item => {
            const key = item.mapel;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [currentItems]);

    const mapelList = useMemo(() => Object.keys(groupedByMapel).sort(), [groupedByMapel]);

    // Helpers
    const getNilaiBadge = (nilai: number | null) => {
        if (nilai === null) return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500', label: '-' };
        if (nilai >= 90) return { bg: 'bg-emerald-500', text: 'text-white', label: String(nilai) };
        if (nilai >= 80) return { bg: 'bg-teal-500', text: 'text-white', label: String(nilai) };
        if (nilai >= 70) return { bg: 'bg-amber-500', text: 'text-white', label: String(nilai) };
        if (nilai >= 60) return { bg: 'bg-orange-500', text: 'text-white', label: String(nilai) };
        return { bg: 'bg-rose-500', text: 'text-white', label: String(nilai) };
    };

    return (
        <ModalPortal isOpen={!!nisn} onClose={onClose}>
            <div className="hnm__wrapper" onClick={onClose}>
                <div className="hnm__content" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="hnm__header">
                        <div className="hnm__headerLeft">
                            <div className="hnm__titleIcon"><GraduationCap size={20} /></div>
                            <div>
                                <h3 className="hnm__title">Rekap Nilai Lengkap</h3>
                                <p className="hnm__subtitle">{namaSiswa} — NISN {nisn}</p>
                            </div>
                        </div>
                        <button className="hnm__closeBtn" onClick={onClose}><X size={18} /></button>
                    </div>

                    {/* Filters Bar */}
                    <div className="hnm__filters">
                        <select 
                            value={selectedTahunAjaran} 
                            onChange={(e) => setSelectedTahunAjaran(e.target.value)}
                            className="hnm__select"
                        >
                            {availableTahunAjaran.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                            {availableTahunAjaran.length === 0 && <option value="">Tahun Ajaran...</option>}
                        </select>
                        <select 
                            value={selectedSemester} 
                            onChange={(e) => setSelectedSemester(e.target.value)}
                            className="hnm__select"
                        >
                            <option value="1">Semester Ganjil (1)</option>
                            <option value="2">Semester Genap (2)</option>
                        </select>
                    </div>

                    <div className="hnm__body">
                        {loading ? (
                            <div className="hnm__status">
                                <Spinner variant="buble" size={28} />
                                <span>Memuat data nilai...</span>
                            </div>
                        ) : error ? (
                            <div className="hnm__status hnm__error">
                                <AlertTriangle size={24} />
                                <span>{error}</span>
                                <button onClick={fetchNilai} className="hnm__retryBtn">Coba Lagi</button>
                            </div>
                        ) : mapelList.length === 0 ? (
                            <div className="hnm__status hnm__empty">
                                <FolderX size={28} />
                                <span>Tidak ada data nilai untuk periode ini.</span>
                            </div>
                        ) : (
                            <div className="hnm__mapelList">
                                {mapelList.map(mapel => (
                                    <div key={mapel} className="hnm__mapelGroups">
                                        <div className="hnm__mapelTitle">
                                            <BookOpen size={16} />
                                            {mapel}
                                        </div>
                                        <div className="hnm__nilaiGrid">
                                            {groupedByMapel[mapel].map(item => {
                                                const badge = getNilaiBadge(item.nilai);
                                                return (
                                                    <div key={item.id} className="hnm__nilaiItem">
                                                        <div className="hnm__nilaiInfo">
                                                            <div className="hnm__nilaiTag">
                                                                <span className="hnm__tagType">{item.jenis}</span>
                                                                <span className="hnm__tagLabel">{item.tagihan || item.materi_tp}</span>
                                                            </div>
                                                            <div className="hnm__nilaiSubTitle">{item.topik || '-'}</div>
                                                            <div className="hnm__nilaiGuru">Oleh: {item.nama_guru}</div>
                                                        </div>
                                                        <div className={`hnm__nilaiBadge ${badge.bg} ${badge.text}`}>
                                                            {badge.label}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .hnm__wrapper { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px; animation: fadeIn 0.15s ease-out; pointer-events: none; }
                .hnm__content { pointer-events: auto; background: var(--n-card); width: 100%; max-width: 800px; max-height: 90vh; border-radius: 28px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.2); animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
                
                .hnm__header { padding: 20px 24px; border-bottom: 1px solid var(--n-border); display: flex; align-items: center; justify-content: space-between; background: var(--n-card); }
                .hnm__headerLeft { display: flex; align-items: center; gap: 14px; }
                .hnm__titleIcon { width: 44px; height: 44px; border-radius: 12px; background: #3083FF; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
                .hnm__title { font-size: 1.15rem; font-weight: 850; color: var(--n-text); margin: 0; line-height: 1.2; }
                .hnm__subtitle { font-size: 0.8rem; color: var(--n-muted); margin: 2px 0 0; font-weight: 500; }
                .hnm__closeBtn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--n-soft); color: var(--n-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .hnm__closeBtn:hover { background: #fee2e2; color: #ef4444; }

                .hnm__filters { padding: 12px 24px; background: var(--n-soft); border-bottom: 1px solid var(--n-border); display: flex; gap: 12px; }
                .hnm__select { padding: 8px 12px; border-radius: 10px; border: 1.5px solid var(--n-border); background: var(--n-card); font-size: 0.8rem; font-weight: 600; color: var(--n-muted); cursor: pointer; outline: none; transition: border-color 0.2s; }
                .hnm__select:focus { border-color: #3083FF; }

                .hnm__body { padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; background: #fcfdfe; }
                .hnm__status { padding: 60px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; color: var(--n-muted); }
                .hnm__spinner { width: 40px; height: 40px; border: 3.5px solid #f1f5f9; border-top-color: #3083FF; border-radius: 50%; animation: spin 0.8s linear infinite; }
                .hnm__error i { font-size: 2.5rem; color: #ef4444; }
                .hnm__retryBtn { padding: 8px 20px; border-radius: 10px; background: #3083FF; color: white; border: none; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
                .hnm__empty i { font-size: 2.5rem; color: #cbd5e1; }

                .hnm__mapelList { display: flex; flex-direction: column; gap: 24px; }
                .hnm__mapelGroups { display: flex; flex-direction: column; gap: 12px; }
                .hnm__mapelTitle { font-size: 0.95rem; font-weight: 850; color: var(--n-text); display: flex; align-items: center; gap: 10px; padding: 4px 0; border-bottom: 2px solid var(--n-border); }
                .hnm__mapelTitle i { color: #3083FF; }

                .hnm__nilaiGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
                .hnm__nilaiItem { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--n-card); border: 1.5px solid var(--n-border); border-radius: 16px; transition: transform 0.2s, border-color 0.2s; }
                .hnm__nilaiItem:hover { border-color: #cbd5e1; transform: translateX(4px); }
                .hnm__nilaiInfo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
                .hnm__nilaiTag { display: flex; align-items: center; gap: 6px; }
                .hnm__tagType { font-size: 0.65rem; font-weight: 850; padding: 2px 8px; border-radius: 100px; background: #e0e7ff; color: #002a7a; text-transform: uppercase; }
                .hnm__tagLabel { font-size: 0.75rem; font-weight: 700; color: var(--n-muted); }
                .hnm__nilaiSubTitle { font-size: 0.85rem; font-weight: 700; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .hnm__nilaiGuru { font-size: 0.68rem; color: var(--n-muted); font-weight: 500; }
                .hnm__nilaiBadge { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; font-weight: 900; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes spin { to { transform: rotate(360deg); } }

                :global(.dark) .hnm__content {
                    background: #0b1329 !important;
                    background-image: linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(11, 19, 41, 0.4) 30%, #0b1329 100%) !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }
                :global(.dark) .hnm__header {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .hnm__titleIcon {
                    background: #1a73e8 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.5) !important;
                }
                :global(.dark) .hnm__title {
                    background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                    background-clip: text !important;
                    color: transparent !important;
                }
                :global(.dark) .hnm__subtitle { color: #94a3b8 !important; }
                :global(.dark) .hnm__closeBtn {
                    background: rgba(255, 255, 255, 0.06) !important;
                    color: #94a3b8 !important;
                }
                :global(.dark) .hnm__closeBtn:hover {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #f87171 !important;
                }
                :global(.dark) .hnm__filters {
                    background: #0b1329 !important;
                    border-bottom: 1px solid rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .hnm__select {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    color: #f1f5f9 !important;
                }
                :global(.dark) .hnm__select:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 10px rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .hnm__select option {
                    background: #0b1329 !important;
                    color: #f1f5f9 !important;
                }
                :global(.dark) .hnm__body { background: #0b1329 !important; }
                :global(.dark) .hnm__mapelTitle {
                    color: #f1f5f9 !important;
                    border-bottom-color: rgba(26, 115, 232, 0.25) !important;
                }
                :global(.dark) .hnm__mapelTitle i { color: #38bdf8 !important; }
                :global(.dark) .hnm__nilaiItem {
                    background: #0b1329 !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                }
                :global(.dark) .hnm__nilaiItem:hover {
                    border-color: rgba(59, 130, 246, 0.6) !important;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
                }
                :global(.dark) .hnm__tagType {
                    background: rgba(26, 115, 232, 0.2) !important;
                    color: #38bdf8 !important;
                }
                :global(.dark) .hnm__tagLabel { color: #94a3b8 !important; }
                :global(.dark) .hnm__nilaiSubTitle { color: #f1f5f9 !important; }
                :global(.dark) .hnm__nilaiGuru { color: #64748b !important; }
            `}</style>
        </ModalPortal>
    );
}
