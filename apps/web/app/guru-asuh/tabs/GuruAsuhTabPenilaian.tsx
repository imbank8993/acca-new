'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import { DetailHeader, DetailHeaderSelect } from '@/components/ui/DetailHeader';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { ActionButton } from '@/components/ui/ActionButtons';
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar';
import { getProxiedImageUrl } from '@/lib/image-utils';

interface SiswaAsuh {
    nisn: string;
    nama: string;
    kelas: string;
    tahun_ajaran: string;
    foto_profil?: string | null;
}

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

export default function GuruAsuhTabPenilaian({ user }: { user?: any }) {
    const nip = user?.nip || user?.username || '';
    const ta = useTahunAjaranFilter();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        has_asuhan: boolean;
        guru_info: any;
        siswa_list: SiswaAsuh[];
        today: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedNisn, setSelectedNisn] = useState<string>('');
    const [selectedSiswa, setSelectedSiswa] = useState<SiswaAsuh | null>(null);
    const [nilaiData, setNilaiData] = useState<GroupedData | null>(null);
    const [nilaiLoading, setNilaiLoading] = useState(false);
    const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [availableTahunAjaran, setAvailableTahunAjaran] = useState<string[]>([]);
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(async () => {
        if (!nip) { setLoading(false); setError('NIP guru tidak ditemukan.'); return; }
        try {
            const params = new URLSearchParams({ nip });
            if (ta.selected && ta.selected !== 'Semua') {
                params.set('tahun_ajaran', ta.selected);
            }
            const res = await fetch(`/api/ketidakhadiran/log/guru-asuh?${params.toString()}`);
            if (!res.ok) throw new Error('Gagal memuat data');
            const result = await res.json();
            setData(result);
            setError(null);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    }, [nip, ta.selected]);

    useEffect(() => { loadData(); }, [loadData]);

    const fetchNilai = useCallback(async (nisn: string) => {
        setNilaiLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('nisn', nisn);
            // Jangan filter oleh guruNip - guru asuh harus lihat semua nilai untuk siswa nya
            const res = await fetch(`/api/nilai/siswa?${params.toString()}`);
            const json = await res.json();
            if (json.ok && json.data) {
                setNilaiData(json.data);
                if (json.data?.grouped) {
                    const tahunList = Object.keys(json.data.grouped).sort((a: string, b: string) => b.localeCompare(a));
                    setAvailableTahunAjaran(tahunList);
                    if (tahunList.length > 0) {
                        const defaultTa = (ta.selected && tahunList.includes(ta.selected)) ? ta.selected : tahunList[0];
                        setSelectedTahunAjaran(defaultTa);
                        // Set semester based on available data
                        const semesters = Object.keys(json.data.grouped[defaultTa] || {}).sort();
                        setAvailableSemesters(semesters);
                        if (semesters.length > 0) setSelectedSemester(semesters[0]);
                    }
                }
            } else {
                console.log('[DEBUG] fetchNilai response:', json);
            }
        } catch (e) { console.error(e); }
        finally { setNilaiLoading(false); }
    }, [ta.selected]);

    const allYearOptions: string[] = useMemo(() => {
        const set = new Set<string>();
        (ta.years || []).filter(y => y !== 'Semua').forEach(y => set.add(y));
        ((data as any)?.available_tahun_ajaran || []).filter(Boolean).forEach((y: string) => set.add(y));
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [ta.years, data]);

    const handleSelectSiswa = (s: any) => {
        const nisn = s.nisn || s.nisn_siswa || '';
        const nama = s.nama || s.nama_siswa || '';
        setSelectedNisn(nisn);
        setSelectedSiswa({
            nisn,
            nama,
            kelas: s.kelas || '',
            tahun_ajaran: s.tahun_ajaran || '',
            foto_profil: s.foto_profil || null,
        });
        setView('detail');
        fetchNilai(nisn);
    };

    const handleBack = () => {
        setView('list');
        setSelectedNisn('');
        setSelectedSiswa(null);
        setNilaiData(null);
        setSearchQuery('');
        setAvailableSemesters([]);
    };

    const filteredStudents = useMemo(() => {
        if (!data?.siswa_list) return [];
        if (!searchQuery) return data.siswa_list;
        const q = searchQuery.toLowerCase();
        return data.siswa_list.filter(s => {
            const nisn = (s.nisn || (s as any).nisn_siswa || '').toLowerCase();
            const nama = (s.nama || (s as any).nama_siswa || '').toLowerCase();
            const kelas = (s.kelas || '').toLowerCase();
            return nisn.includes(q) || nama.includes(q) || kelas.includes(q);
        });
    }, [data?.siswa_list, searchQuery]);

    const currentItems = useMemo(() => {
        if (!nilaiData?.grouped || !selectedTahunAjaran || !selectedSemester) return nilaiData?.all || [];
        return nilaiData.grouped[selectedTahunAjaran]?.[selectedSemester] || [];
    }, [nilaiData, selectedTahunAjaran, selectedSemester]);

    const groupedByMapel = useMemo(() => {
        const grouped: Record<string, NilaiItem[]> = {};
        currentItems.forEach(item => {
            const key = item.mapel || 'Lainnya';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [currentItems]);

    const formatDate = (dateStr: string): string => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getNilaiBadge = (nilai: number | null) => {
        if (nilai === null) return { cls: 'badge-none', label: '-' };
        if (nilai >= 90) return { cls: 'badge-blue', label: String(nilai) };
        if (nilai >= 80) return { cls: 'badge-blue-soft', label: String(nilai) };
        if (nilai >= 70) return { cls: 'badge-amber', label: String(nilai) };
        if (nilai >= 60) return { cls: 'badge-orange', label: String(nilai) };
        return { cls: 'badge-rose', label: String(nilai) };
    };

    const getJenisBadge = (jenis: string) => {
        const map: Record<string, string> = {
            'PAS': 'jbadge-blue',
            'UH': 'jbadge-blue',
            'TUGAS': 'jbadge-emerald',
            'KUIS': 'jbadge-amber',
            'SUM': 'jbadge-rose',
        };
        return map[jenis] || 'jbadge-slate';
    };

    const getJenisLabel = (jenis: string, tagihan?: string, materiTp?: string): string => {
        if (tagihan) {
            const m = tagihan.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (m) return `${m[1].toUpperCase()} ${m[2]}`;
        }
        if (materiTp) {
            const m = materiTp.match(/^(TUGAS|KUIS)[_\s]*(\d+)/i);
            if (m) return `${m[1].toUpperCase()} ${m[2]}`;
        }
        return jenis;
    };

    const getTopikDisplay = (item: NilaiItem): string => {
        const base = item.materi_tp || item.tagihan || '-';
        if (item.topik && item.topik !== '-' && item.topik.trim() !== '') {
            return `${base}: ${item.topik}`;
        }
        return base;
    };

    const parseSumInfo = (item: NilaiItem) => {
        const full = getTopikDisplay(item);
        const sumMatch = full.match(/^(SUM\s*\d+)(?:\s*[:\-]\s*(.*))?$/i);
        if (sumMatch) {
            return { sumGroup: sumMatch[1].toUpperCase(), actualTopic: (sumMatch[2] || '').trim() || '-', isSumType: true };
        }
        if (item.jenis === 'PAS' || full.toUpperCase().startsWith('PAS')) {
            return { sumGroup: 'PAS', actualTopic: '-', isSumType: true };
        }
        return { sumGroup: '-', actualTopic: full, isSumType: false };
    };

    const buildTableRows = (items: NilaiItem[]) => {
        const withInfo = items.map(i => ({ ...i, info: parseSumInfo(i) }));

        withInfo.sort((a, b) => {
            if (a.info.sumGroup !== b.info.sumGroup) {
                if (a.info.sumGroup === '-') return 1;
                if (b.info.sumGroup === '-') return -1;
                if (a.info.sumGroup === 'PAS' && b.info.sumGroup.startsWith('SUM')) return 1;
                if (a.info.sumGroup.startsWith('SUM') && b.info.sumGroup === 'PAS') return -1;
                return a.info.sumGroup.localeCompare(b.info.sumGroup);
            }
            const pri = (j: string) => j === 'SUM' || j === 'PAS' ? 0 : j === 'KUIS' ? 10 : j === 'TUGAS' ? 20 : j === 'UH' ? 100 : 50;
            const diff = pri(a.jenis) - pri(b.jenis);
            if (diff !== 0) return diff;
            return getJenisLabel(a.jenis, a.tagihan, a.materi_tp).localeCompare(getJenisLabel(b.jenis, b.tagihan, b.materi_tp), undefined, { numeric: true });
        });

        const rows: any[] = [];
        let i = 0;
        while (i < withInfo.length) {
            const currentSum = withInfo[i].info.sumGroup;
            if (currentSum !== '-') {
                let j = i;
                while (j < withInfo.length && withInfo[j].info.sumGroup === currentSum) j++;
                const count = j - i;
                const groupItems = withInfo.slice(i, j);
                let groupTopic = '-';
                const sumRow = groupItems.find(r => r.jenis === 'SUM' && r.info.actualTopic !== '-');
                if (sumRow) groupTopic = sumRow.info.actualTopic;
                else { const f = groupItems.find(r => r.info.actualTopic !== '-'); if (f) groupTopic = f.info.actualTopic; }
                for (let k = i; k < j; k++) rows.push({ ...withInfo[k], rowSpan: k === i ? count : 0, groupTopic });
                i = j;
            } else {
                rows.push({ ...withInfo[i], rowSpan: 1 });
                i++;
            }
        }
        return rows;
    };

    if (loading) return <PageLoader minHeight="300px" />;

    if (error) return (
        <div className="gan-loading">
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '2rem', color: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{error}</span>
        </div>
    );


    if (view === 'detail') {
        const studentPhoto = selectedSiswa?.foto_profil || nilaiData?.siswa?.foto_profil;
        return (
            <div className="gan-detail">
                <DetailHeader
                    onBack={handleBack}
                    backLabel="Kembali ke Daftar Siswa"
                    name={selectedSiswa?.nama || (selectedSiswa as any)?.nama_siswa || '...'}
                    meta={`NISN: ${selectedNisn} - ${selectedSiswa?.kelas || ''}`}
                    avatarSrc={studentPhoto ? getProxiedImageUrl(studentPhoto) : undefined}
                >
                    <DetailHeaderSelect
                        icon="mortarboard"
                        value={selectedTahunAjaran}
                        onChange={e => {
                            setSelectedTahunAjaran(e.target.value);
                            const semesters = Object.keys(nilaiData?.grouped?.[e.target.value] || {}).sort();
                            setAvailableSemesters(semesters);
                            if (semesters.length > 0) setSelectedSemester(semesters[0]);
                        }}
                    >
                        {availableTahunAjaran.map(t => <option key={t} value={t}>{t}</option>)}
                    </DetailHeaderSelect>
                    <DetailHeaderSelect
                        icon="clock-history"
                        value={selectedSemester}
                        onChange={e => setSelectedSemester(e.target.value)}
                    >
                        {availableSemesters.map(s => {
                            const semVal = String(s);
                            const label = semVal === '1' ? 'Ganjil' : 'Genap';
                            return <option key={s} value={semVal}>{label}</option>;
                        })}
                    </DetailHeaderSelect>
                </DetailHeader>

                {nilaiLoading ? (
                    <PageLoader minHeight="240px" />
                ) : (
                    <div className="nilai-content">
                        {Object.keys(groupedByMapel).length === 0 ? (
                            <div className="empty-state">
                                <i className="bi bi-clipboard-check" />
                                <p>Belum ada data nilai pada periode ini</p>
                            </div>
                        ) : (
                            Object.entries(groupedByMapel).map(([mapelName, items]) => {
                                const validItems = items.filter(i => i.nilai !== null);
                                const avg = validItems.length > 0 ? validItems.reduce((sum, i) => sum + (i.nilai || 0), 0) / validItems.length : 0;
                                const tableRows = buildTableRows(items);
                                return (
                                    <div key={mapelName} className="mapel-section">
                                        <div className="mapel-header">
                                            <i className="bi bi-book" />
                                            <span className="mapel-name">{mapelName}</span>
                                            <span className={`avg-badge avg-badge--${avg >= 90 ? 'blue' : avg >= 80 ? 'blue-soft' : avg >= 70 ? 'amber' : avg >= 60 ? 'orange' : 'rose'}`}>{avg.toFixed(1)}</span>
                                        </div>
                                        <div className="nilai-table-wrap">
                                            <table className="nilai-table">
                                                <thead>
                                                    <tr>
                                                        <th className="th-sumatif">Sumatif</th>
                                                        <th>Jenis</th>
                                                        <th>Topik</th>
                                                        <th className="th-right">Nilai</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableRows.map((item, idx) => {
                                                        const nilaiBadge = getNilaiBadge(item.nilai);
                                                        const jenisCls = getJenisBadge(item.jenis);
                                                        return (
                                                            <tr key={item.id || idx}>
                                                                {item.rowSpan > 0 && (
                                                                    <td className="td-sumatif" rowSpan={item.rowSpan}>
                                                                        <div className="sumatif-group">
                                                                            <span className="sumatif-name">
                                                                                {item.info.sumGroup === '-' ? '-' : item.info.sumGroup}
                                                                            </span>
                                                                            {item.info.sumGroup !== '-' && item.info.sumGroup !== 'PAS' && item.groupTopic !== '-' && (
                                                                                <span className="sumatif-topic">{item.groupTopic}</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className="td-jenis">
                                                                    {item.info.sumGroup !== 'PAS' ? (
                                                                        <span className={`jenis-badge ${jenisCls}`}>
                                                                            {getJenisLabel(item.jenis, item.tagihan, item.materi_tp)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="td-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="td-topik">
                                                                    {item.info.sumGroup !== 'PAS' ? item.info.actualTopic : '-'}
                                                                </td>
                                                                <td className="td-right">
                                                                    <span className={`nilai-badge ${nilaiBadge.cls}`}>{nilaiBadge.label}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                <style jsx>{`
                    .gan-detail { display: flex; flex-direction: column; gap: 20px; padding-bottom: 2rem; }
                    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; text-align: center; color: var(--n-muted); }
                    .empty-state i { font-size: 3rem; }
                    .nilai-content { display: flex; flex-direction: column; gap: 20px; }
                    .mapel-section { background: var(--n-card); border-radius: 16px; overflow: hidden; border: 1px solid var(--n-border); }
                    .mapel-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; background: var(--n-soft); border-bottom: 1px solid var(--n-border); }
                    .mapel-header i { color: #3083FF; }
                    .mapel-name { flex: 1; font-size: 0.95rem; font-weight: 800; color: var(--n-text); }
                    /* avg-badge colors */
                    .avg-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 800; }
                    .avg-badge--blue { background: #dbeafe; color: #1e40af; }
                    .avg-badge--blue-soft { background: #e0f2fe; color: #1d4ed8; }
                    .avg-badge--amber { background: #fef3c7; color: #92400e; }
                    .avg-badge--orange { background: #ffedd5; color: #9a3412; }
                    .avg-badge--rose { background: #ffe4e6; color: #9f1239; }
                    /* Table */
                    .nilai-table-wrap { overflow-x: auto; }
                    .nilai-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                    .nilai-table thead tr { background: var(--n-soft); }
                    .nilai-table th { padding: 10px 14px; text-align: left; font-weight: 700; color: var(--n-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--n-border); white-space: nowrap; }
                    .th-sumatif { width: 140px; }
                    .th-right { text-align: right; }
                    .nilai-table tbody tr { border-bottom: 1px solid var(--n-border); transition: background 0.15s; }
                    .nilai-table tbody tr:hover { background: #fafbff; }
                    /* Hover dark mode: #fafbff bikin baris jadi putih & teks putih hilang.
                       Harus didefinisikan di blok ini karena style block tampilan daftar
                       tidak ikut ter-mount saat tampilan detail dirender. */
                    :global(.dark) .nilai-table tbody tr:hover,
                    :global(.dark) .nilai-table tbody tr:hover td { background: rgba(26, 115, 232, 0.12) !important; }
                    :global(.dark) .nilai-table tbody tr:hover .td-sumatif { background: rgba(26, 115, 232, 0.2) !important; }
                    .nilai-table td { padding: 10px 14px; color: var(--n-text); vertical-align: middle; }
                    /* SUMATIF column */
                    .td-sumatif { background: var(--n-soft); border-right: 1px solid #e2e8f0; vertical-align: middle; }
                    .sumatif-group { display: flex; flex-direction: column; gap: 2px; }
                    .sumatif-name { font-weight: 800; color: var(--n-text); font-size: 0.85rem; }
                    .sumatif-topic { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; line-height: 1.3; }
                    /* JENIS column */
                    .td-jenis { }
                    .jenis-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; }
                    .jbadge-blue { background: #eff6ff; color: #1d4ed8; }
                    .jbadge-blue { background: #dbeafe; color: #1d4ed8; }
                    .jbadge-emerald { background: #d1fae5; color: #065f46; }
                    .jbadge-amber { background: #fef3c7; color: #92400e; }
                    .jbadge-rose { background: #ffe4e6; color: #9f1239; }
                    .jbadge-slate { background: var(--n-soft); color: var(--n-muted); }
                    /* TOPIK column */
                    .td-topik { color: var(--n-muted); }
                    .td-muted { color: var(--n-muted); }
                    /* NILAI column */
                    .td-right { text-align: right; }
                    .nilai-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 800; min-width: 48px; text-align: center; }
                    .badge-blue { background: #1d4ed8; color: white; }
                    .badge-blue-soft { background: #3b82f6; color: white; }
                    .badge-amber { background: #f59e0b; color: white; }
                    .badge-orange { background: #f97316; color: white; }
                    .badge-rose { background: #f43f5e; color: white; }
                    .badge-none { background: var(--n-soft); color: var(--n-muted); }
                `}</style>
            </div>
        );
    }

    const toolbarNode = (
        <FilterToolbar actionsInline>
            {allYearOptions.length > 0 && (
                <FilterSelect
                    label="Tahun Ajaran"
                    icon="mortarboard"
                    value={ta.selected || 'Semua'}
                    onChange={ta.setSelected}
                    title="Tahun Ajaran"
                    options={[
                        { value: 'Semua', label: 'Semua TA' },
                        ...allYearOptions.map(y => ({ value: y, label: `TA ${y}` }))
                    ]}
                />
            )}
            <FilterSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari nama / NISN..."
            />
        </FilterToolbar>
    );

    if (!data?.has_asuhan) {
        return (
            <div className="gan__wrap">
                {toolbarNode}
                <div className="gan__empty">
                    <div className="gan__empty-icon"><i className="bi bi-person-hearts" /></div>
                    <h3>Anda belum mengklaim anak asuh untuk tahun ajaran ini</h3>
                    <p>Pilih tahun ajaran lain di atas atau buka tab "Klaim Anak Asuh" untuk mengklaim siswa yang akan menjadi anak asuh Anda.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="gan__wrap">
            {toolbarNode}

            {filteredStudents.length === 0 ? (
                <div className="gan__empty">
                    <div className="gan__empty-icon"><i className="bi bi-people" /></div>
                    <h3>Tidak ada siswa yang cocok</h3>
                    <p>Coba gunakan kata kunci pencarian yang lain.</p>
                </div>
            ) : (
                <div className="gan__siswaList">
                    {filteredStudents.map((siswa, idx) => {
                        const sName = siswa.nama || (siswa as any).nama_siswa || '-';
                        const sNisn = siswa.nisn || (siswa as any).nisn_siswa || '';
                        return (
                            <div
                                key={`siswa-${idx}`}
                                className="gan__siswaCard"
                                onClick={() => handleSelectSiswa(siswa)}
                            >
                                <div className="gan__siswaAvatar">
                                    {siswa.foto_profil && (
                                        <img
                                            src={getProxiedImageUrl(siswa.foto_profil)}
                                            alt={sName}
                                            className="gan__avatarImg"
                                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                    )}
                                    <span>{(sName.charAt(0) || '?').toUpperCase()}</span>
                                </div>
                                <div className="gan__siswaInfo">
                                    <div className="gan__siswaNama">{sName}</div>
                                    <div className="gan__siswaMeta">
                                        <span className="gan__kelasChip">{siswa.kelas}</span>
                                        <span className="gan__nisnChip">NISN: {sNisn}</span>
                                    </div>
                                </div>
                                <div className="gan__siswaFooter">
                                    <div className="gan__siswaActions">
                                        <ActionButton
                                            action="view"
                                            label="Lihat Nilai"
                                            iconOnly={false}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectSiswa(siswa);
                                            }}
                                            title="Lihat Detail Nilai Siswa"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .gan-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 24px; color: var(--n-muted); }

                .gan__wrap { display: flex; flex-direction: column; gap: 16px; animation: ganFadeIn 0.4s ease-out; }
                @keyframes ganFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .gan__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 20px; }
                .gan__empty-icon { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--n-primary); margin-bottom: 14px; }
                .gan__empty h3 { font-size: 1.05rem; font-weight: 800; color: var(--n-ink); margin: 0 0 6px; }
                .gan__empty p { font-size: 0.85rem; color: var(--n-muted); max-width: 380px; line-height: 1.5; margin: 0; }

                .gan__siswaList { display: flex; flex-direction: column; gap: 10px; }
                .gan__siswaCard { display: grid; grid-template-columns: 44px 1fr auto; gap: 12px 18px; align-items: center; padding: 12px 18px; border-radius: 16px; border: 1px solid var(--n-border); background: var(--n-card); cursor: pointer; transition: all 0.2s; position: relative; }
                .gan__siswaCard:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); transform: translateY(-1px); border-color: #3083FF; }
                .gan__siswaAvatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: white; background: linear-gradient(135deg, #3083FF, #3b82f6); flex-shrink: 0; position: relative; overflow: hidden; }
                .gan__avatarImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
                .gan__siswaInfo { display: flex; flex-direction: column; gap: 4px; }
                .gan__siswaNama { font-size: 0.95rem; font-weight: 800; color: var(--n-ink); line-height: 1.2; }
                .gan__siswaMeta { display: flex; align-items: center; gap: 7px; }
                .gan__kelasChip { font-size: 0.72rem; font-weight: 700; background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 50px; }
                .gan__nisnChip { font-size: 0.72rem; color: var(--n-muted); font-weight: 500; }
                .gan__siswaFooter { display: contents; }
                .gan__siswaActions { display: flex; align-items: center; justify-content: flex-end; }

                :global(.dark) .gan__empty { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; border-radius: 20px !important; }
                :global(.dark) .gan__empty-icon { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .gan__empty h3 { color: #ffffff !important; }
                :global(.dark) .gan__siswaCard { background: #0b1329 !important; border: 1px solid rgba(37, 99, 235, 0.35) !important; border-radius: 16px !important; }
                :global(.dark) .gan__siswaCard:hover { background: rgba(26, 115, 232, 0.12) !important; }
                :global(.dark) .gan__siswaNama { color: #ffffff !important; }
                :global(.dark) .gan__kelasChip { background: rgba(59,130,246,0.15) !important; color: #60a5fa !important; }

                @media (max-width: 640px) {
                    .gan__siswaCard { grid-template-columns: 36px 1fr; grid-template-rows: auto auto; gap: 6px 12px; padding: 12px 14px; }
                    .gan__siswaFooter { display: flex; grid-column: 2; justify-content: flex-start; align-items: center; gap: 8px; margin-top: 2px; }
                    .gan__siswaNama { font-weight: 600; font-size: 0.9rem; }
                }
            `}</style>
        </div>
    );
}