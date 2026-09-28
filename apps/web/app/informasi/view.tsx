'use client';
import { useTabParam } from '@/hooks/useTabParam';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import ShareInformasiModal, { type ShareTarget } from './components/ShareInformasiModal';
import type { User } from '@/lib/types';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Tab } from '@/components/ui/Tab';
import FilterToolbar, { FilterSearch } from '@/components/ui/FilterToolbar';
import { MobileFab } from '@/components/mobile';
import { DesktopFab } from '@/components/ui/DesktopFab';
import dynamic from 'next/dynamic';
import { Forward } from 'lucide-react';
import { useIzinInformasi } from './useIzinInformasi';
import './informasi.css';

// Dynamic import PDFViewer with SSR disabled to avoid DOMMatrix SSR error
const PDFViewer = dynamic(() => import('@/components/ui/PDFViewerWrapper'), { ssr: false });

interface Document {
    id: string;
    title: string;
    category: string;
    file_url: string;
    file_name: string;
    file_size: number;
    show_on_landing: boolean;
    sort_order: number;
    created_at: string;
}

const MAX_FILES_PER_FOLDER = 4;

function InformasiViewer({
    user,
    canManage,
    allowedDivisions = [],
    onKelola,
}: {
    user?: User;
    canManage?: boolean;
    allowedDivisions?: string[];
    onKelola?: () => void;
}) {
    const [list, setList] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [activeTab, setActiveTab] = useTabParam<string>('Akademik', ['Akademik', 'Kesiswaan', 'Keasramaan', 'Umum']);
    const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

    const canShareDivision = (divisionName?: string): boolean => {
        if (!divisionName) return false;
        const userRoles = (user?.roles || []).map(r => r.toUpperCase());
        const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR');
        if (isAdmin) return true;

        const divNormalized = divisionName.trim().toLowerCase();

        // 1. Cek wewenang divisi dari server (Hak Akses Fitur)
        if (Array.isArray(allowedDivisions) && allowedDivisions.length > 0) {
            if (allowedDivisions.some(d => d.trim().toLowerCase() === divNormalized)) {
                return true;
            }
        }

        // 2. Fallback peran WKM bawaan sistem
        if (userRoles.includes('WKM_AKADEMIK') && (divNormalized === 'akademik' || divNormalized === 'dokumen unggahan')) return true;
        if (userRoles.includes('WKM_KESISWAAN') && divNormalized === 'kesiswaan') return true;
        if (userRoles.includes('WKM_KEASRAMAAN') && divNormalized === 'keasramaan') return true;
        if (userRoles.includes('WKM_HUMAS') && divNormalized === 'umum') return true;

        return false;
    };

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const focusDiv = searchParams?.get('div') || '';
    const focusFolder = searchParams?.get('folder') || '';
    const focusDoc = searchParams?.get('doc') || '';
    const isFocusMode = Boolean(focusFolder || focusDoc);

    const exitFocus = () => {
        router.replace(pathname || '/informasi', { scroll: false });
    };

    useEffect(() => {
        fetchData();
    }, []);


    const getFileIconInfo = (fileName: string) => {
        const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
        switch (ext) {
            case 'pdf': return { icon: 'bi-file-earmark-pdf-fill', color: '#0284c7' };
            case 'doc':
            case 'docx': return { icon: 'bi-file-earmark-word-fill', color: '#2563eb' };
            case 'xls':
            case 'xlsx': return { icon: 'bi-file-earmark-excel-fill', color: '#10b981' };
            case 'ppt':
            case 'pptx': return { icon: 'bi-file-earmark-ppt-fill', color: '#f59e0b' };
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'webp':
            case 'svg': return { icon: 'bi-file-earmark-image-fill', color: '#06b6d4' };
            case 'zip':
            case 'rar':
            case '7z': return { icon: 'bi-file-earmark-zip-fill', color: '#3b82f6' };
            case 'mp4':
            case 'mov':
            case 'avi': return { icon: 'bi-file-earmark-play-fill', color: '#3b82f6' };
            case 'mp3':
            case 'wav': return { icon: 'bi-file-earmark-music-fill', color: '#ec4899' };
            default: return { icon: 'bi-file-earmark-text-fill', color: 'var(--n-primary)' };
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const roles = (user?.roles || []).map(r => r.toUpperCase());
            let roleParam = 'umum';
            if (roles.some(r => ['ADMIN', 'ADMINISTRATOR', 'WKM_AKADEMIK'].includes(r))) {
                roleParam = 'all';
            } else {
                const matched = [];
                if (roles.includes('GURU')) matched.push('guru');
                if (roles.includes('SISWA')) matched.push('siswa');
                if (matched.length > 0) roleParam = matched.join(',');
            }
            const res = await fetch(`/api/informasi-akademik?role=${roleParam}&t=${Date.now()}`);
            const json = await res.json();
            if (json.ok) {
                setList(json.data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getParseData = (doc: Document) => {
        const match = doc.category.match(/^\[([^\]]+)\]\s*(.+)$/);
        
        const roleNameMap: Record<string, string> = {
            'AKADEMIK': 'Akademik',
            'KESISWAAN': 'Kesiswaan',
            'KEASRAMAAN': 'Keasramaan',
            'HUMAS': 'Umum',
            'SARPRAS': 'Umum',
            'UMUM': 'Umum',
            'UNGGAHAN': 'Akademik'
        };

        if (match) {
            const rawDiv = match[1].trim().toUpperCase();
            const mappedDiv = roleNameMap[rawDiv] || match[1].trim();
            return { division: mappedDiv, folder: match[2].trim() };
        }
        const divisionMap: Record<string, string> = {
            'AKADEMIK': 'Akademik',
            'KESISWAAN': 'Kesiswaan',
            'KEASRAMAAN': 'Keasramaan',
            'HUMAS': 'Umum',
            'SARPRAS': 'Umum',
            'UMUM': 'Umum',
        };
        for (const [key, mapped] of Object.entries(divisionMap)) {
            if (doc.category.toUpperCase().startsWith(key + ' - ')) {
                 return { division: mapped, folder: doc.category.substring(key.length + 3) };
            }
        }
        return { division: 'Akademik', folder: doc.category };
    };

    const isPlaceholderDoc = (d: any) => d.file_url === '#' || !d.file_name || d.title === 'Folder placeholder';

    const processedDocs = list.map(d => ({
        ...d,
        parsed: getParseData(d)
    }));

    const filteredDocs = processedDocs.filter(d => {
        if (focusDoc) return d.id === focusDoc;

        if (focusFolder) {
            const folderMatch = d.parsed.folder === focusFolder;
            const divMatch = !focusDiv || d.parsed.division.toLowerCase() === focusDiv.toLowerCase();
            return folderMatch && divMatch;
        }

        const matchesTab = d.parsed.division.toLowerCase() === activeTab.toLowerCase();
        if (!matchesTab) return false;

        if (!searchQuery) return true;

        const q = searchQuery.toLowerCase();
        return d.title.toLowerCase().includes(q) ||
               d.parsed.folder.toLowerCase().includes(q);
    });

    const focusedDoc = useMemo(
        () => (focusDoc ? processedDocs.find(d => d.id === focusDoc) || null : null),
        [focusDoc, list]
    );
    const [autoOpenedId, setAutoOpenedId] = useState<string | null>(null);
    useEffect(() => {
        if (focusedDoc && autoOpenedId !== focusedDoc.id) {
            setAutoOpenedId(focusedDoc.id);
            setSelectedDoc(focusedDoc as Document);
        }
    }, [focusedDoc, autoOpenedId]);

    const groupedDocs = filteredDocs.reduce((acc: Record<string, Document[]>, doc: any) => {
        const folderKey = doc.parsed.folder;
        if (!acc[folderKey]) acc[folderKey] = [];
        acc[folderKey].push(doc);
        return acc;
    }, {});

    Object.keys(groupedDocs).forEach(cat => {
        groupedDocs[cat].sort((a, b) => a.title.localeCompare(b.title));
    });

    const sortedCategories = Object.keys(groupedDocs).sort((a, b) => {
        const aOrder = groupedDocs[a][0]?.sort_order ?? 999;
        const bOrder = groupedDocs[b][0]?.sort_order ?? 999;
        return aOrder - bOrder;
    });

    const toggleFolder = (cat: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    return (
        <>
            <div className="ia-page">
                {isFocusMode && (
                    <div className="ia-focusbar">
                        <span className="ia-focusbar__crumb">
                            <i className={`bi ${focusDoc ? 'bi-file-earmark-text' : 'bi-folder2-open'}`} />
                            {focusDiv && <span className="ia-focusbar__div">{focusDiv}</span>}
                            <strong>{focusDoc ? (focusedDoc?.title || 'Dokumen') : focusFolder}</strong>
                        </span>
                        <button className="ia-focusbar__exit" onClick={exitFocus}>
                            <i className="bi bi-grid" />
                            Lihat semua informasi
                        </button>
                    </div>
                )}

                {!isFocusMode && (
                <Tab
                    tabs={[
                        {
                            key: 'Akademik',
                            label: 'Akademik',
                            icon: 'book',
                        },
                        {
                            key: 'Kesiswaan',
                            label: 'Kesiswaan',
                            icon: 'people',
                        },
                        {
                            key: 'Keasramaan',
                            label: 'Keasramaan',
                            shortLabel: 'Asrama',
                            icon: 'building',
                        },
                        {
                            key: 'Umum',
                            label: 'Umum',
                            icon: 'info-circle',
                        },
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Tab Informasi & Layanan"
                    variant="slider"
                />
                )}

                {!isFocusMode && (
                <FilterToolbar>
                    <FilterSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Cari dokumen atau kategori..."
                        label="Pencarian"
                    />
                </FilterToolbar>
                )}

                {canManage && onKelola && !isFocusMode && (
                    <>
                        <DesktopFab label="Kelola Informasi" icon="gear-fill" onClick={onKelola} />
                        <MobileFab label="Kelola Informasi" icon="gear-fill" onClick={onKelola} />
                    </>
                )}

                <div className="ia-content">
                    {loading ? (
                        <div className="ia-loading">
                            <Spinner variant="buble" />
                        </div>
                    ) : sortedCategories.length === 0 ? (
                        <div className="ia-empty">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                            </svg>
                            {isFocusMode ? (
                                <>
                                    <h3>Tautan tidak tersedia</h3>
                                    <p>
                                        {focusDoc ? 'Dokumen' : 'Folder'} yang dibagikan tidak ditemukan, sudah dihapus,
                                        atau tidak terbuka untuk akun Anda.
                                    </p>
                                    <button className="ia-focusbar__exit" onClick={exitFocus} style={{ marginTop: 14 }}>
                                        <i className="bi bi-grid" />
                                        Lihat semua informasi
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h3>Belum ada data {activeTab}</h3>
                                    <p>{searchQuery ? `Tidak ada hasil untuk "${searchQuery}" di kategori ini.` : `Belum ada dokumen ${activeTab} yang diunggah.`}</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="ia-grid">
                            {sortedCategories.map((cat, idx) => {
                                const rawFiles = groupedDocs[cat] || [];
                                const files = rawFiles.filter((d: any) => !isPlaceholderDoc(d));
                                const isExpanded = isFocusMode || expandedFolders.has(cat);
                                const hasMore = !isFocusMode && files.length > MAX_FILES_PER_FOLDER;
                                const visibleFiles = isExpanded ? files : files.slice(0, MAX_FILES_PER_FOLDER);
                                const folderDiv = (rawFiles[0] as any)?.parsed?.division || activeTab;
                                const showFolderShare = canShareDivision(folderDiv);

                                return (
                                    <div key={cat} className="ia-folder-card" style={{ animationDelay: `${idx * 80}ms` }}>
                                        <div className="ia-folder-header">
                                            <div className="ia-folder-icon">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                                                </svg>
                                            </div>
                                            <h3 className="ia-folder-title">{cat}</h3>
                                            <span className="ia-folder-count">{files.length}</span>
                                            {showFolderShare && (
                                                <button
                                                    className="ia-share-btn"
                                                    title={`Bagikan folder "${cat}"`}
                                                    aria-label={`Bagikan folder ${cat}`}
                                                    onClick={() => setShareTarget({
                                                        scope: 'folder',
                                                        division: folderDiv,
                                                        folder: cat,
                                                        label: cat,
                                                    })}
                                                >
                                                    <Forward size={16} strokeWidth={1.75} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="ia-file-list">
                                            {files.length === 0 ? (
                                                <div style={{ padding: '14px 16px', color: 'var(--n-ink-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                    Folder ini belum berisi dokumen.
                                                </div>
                                            ) : visibleFiles.map((doc) => {
                                                const iconInfo = getFileIconInfo(doc.file_name);
                                                const fileDiv = (doc as any).parsed?.division || folderDiv;
                                                const showFileShare = canShareDivision(fileDiv);
                                                return (
                                                <div key={doc.id} className="ia-file-row">
                                                    <button
                                                        onClick={() => setSelectedDoc(doc)}
                                                        className="ia-file-item"
                                                        title={`Klik untuk melihat "${doc.title}"`}
                                                    >
                                                        <span className="ia-file-icon" style={{ color: iconInfo.color }}>
                                                            <i className={`bi ${iconInfo.icon}`} style={{ fontSize: '1.2rem' }}></i>
                                                        </span>
                                                        <div className="ia-file-info">
                                                            <span className="ia-file-title">{doc.title}</span>
                                                            <span className="ia-file-meta">
                                                                {new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                {doc.file_size && ` • ${formatFileSize(doc.file_size)}`}
                                                            </span>
                                                        </div>
                                                    </button>
                                                    {showFileShare && (
                                                        <button
                                                            className="ia-share-btn ia-share-btn--file"
                                                            title={`Bagikan "${doc.title}"`}
                                                            aria-label={`Bagikan ${doc.title}`}
                                                            onClick={() => setShareTarget({
                                                                scope: 'file',
                                                                division: fileDiv,
                                                                docId: doc.id,
                                                                label: doc.title,
                                                            })}
                                                        >
                                                            <Forward size={16} strokeWidth={1.75} />
                                                        </button>
                                                    )}
                                                </div>
                                                );
                                            })}

                                            {hasMore && (
                                                <button
                                                    className="ia-show-more"
                                                    onClick={() => toggleFolder(cat)}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        {isExpanded ? (
                                                            <polyline points="18 15 12 9 6 15" />
                                                        ) : (
                                                            <polyline points="6 9 12 15 18 9" />
                                                        )}
                                                    </svg>
                                                    {isExpanded
                                                        ? `Sembunyikan ${files.length - MAX_FILES_PER_FOLDER} file`
                                                        : `Lihat ${files.length - MAX_FILES_PER_FOLDER} file lainnya`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {selectedDoc && (
                <PDFViewer
                    url={selectedDoc.file_url}
                    title={selectedDoc.file_name || selectedDoc.title}
                    onClose={() => setSelectedDoc(null)}
                />
            )}

            {shareTarget && (
                <ShareInformasiModal
                    target={shareTarget}
                    canManage={canShareDivision(shareTarget.division || activeTab)}
                    onClose={() => setShareTarget(null)}
                />
            )}
        </>
    );
}

export default function InformasiPage({ user }: { user?: User }) {
    const router = useRouter();
    const { bolehKelola, bolehPengumuman, divisi } = useIzinInformasi();
    const userRoles = (user?.roles || []).map(r => r.toUpperCase());
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR');
    const WKM_ROLES = ['WKM_AKADEMIK', 'WKM_KESISWAAN', 'WKM_KEASRAMAAN', 'WKM_HUMAS'];
    const isWKM = userRoles.some(r => WKM_ROLES.includes(r));
    const isOpPengumuman = userRoles.includes('OP_PENGUMUMAN');
    const canManage = isAdmin || isWKM || isOpPengumuman || Boolean(bolehKelola || bolehPengumuman);

    return (
        <div className="inf-root">
            <InformasiViewer
                user={user}
                canManage={canManage}
                allowedDivisions={divisi}
                onKelola={() => router.push('/informasi/kelola')}
            />
            <MaintenanceBanner pageKey="maintenance_informasi_akademik" />
        </div>
    );
}
