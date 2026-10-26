'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Pagination from '@/components/ui/Pagination';
import JournalModal from './components/JournalModal';
import JurnalDetailModal from './components/JurnalDetailModal';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { hasPermission } from '@/lib/permissions-client';
import JurnalHeader from './components/JurnalHeader';
import DatePicker from '@/components/ui/DatePicker';
import FilterToolbar, { FilterSearch, FilterSelect, FilterInput, FilterField, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import JurnalTable from './components/JurnalTable';
import JurnalCards from './components/JurnalCards';
import { useJurnal } from './hooks/useJurnal';
import ExportModal from './components/ExportModal';
import { Journal } from './types';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Tab from '@/components/ui/Tab';
import { useTabParam } from '@/hooks/useTabParam';
import BandingPage from './banding/view';
import GenerateJurnalTab from './components/GenerateJurnalTab';
import JurnalInputPage from './input/view';
import RekapJurnalTab from './components/RekapJurnalTab';
import KehadiranGuruTab from './components/KehadiranGuruTab';
import { checkFeatureAccess, parseKonfigurasiAksesClient } from '@/lib/feature-access-client';
import './jurnal.css';

const customSelectStyles = {
    control: (base: any, state: any) => ({
        ...base,
        borderRadius: '16px',
        border: state.isFocused ? '1.5px solid var(--n-primary)' : '1px solid var(--n-border)',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
        '&:hover': {
            borderColor: 'var(--n-primary-light)',
        },
        padding: '0 4px',
        fontSize: '0.88rem',
        fontWeight: '520',
        backgroundColor: 'var(--n-card)',
        color: 'var(--n-ink)',
        minHeight: '42px',
        // Dark mode fixes
        '&:active': {
            borderColor: 'var(--n-primary)',
        },
    }),
    valueContainer: (base: any) => ({
        ...base,
        border: 'none !important',
        boxShadow: 'none !important',
        outline: 'none !important',
        padding: '0 6px',
    }),
    placeholder: (base: any) => ({
        ...base,
        color: 'var(--n-muted)',
        border: 'none !important',
        boxShadow: 'none !important',
        outline: 'none !important',
        paddingLeft: '2px',
        marginLeft: 0,
        marginRight: 0,
    }),
    singleValue: (base: any) => ({
        ...base,
        color: 'var(--n-ink)',
        border: 'none !important',
        boxShadow: 'none !important',
        outline: 'none !important',
        paddingLeft: '2px',
        marginLeft: 0,
        marginRight: 0,
    }),
    input: (base: any) => ({
        ...base,
        color: 'transparent !important',
        caretColor: 'transparent !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        background: 'transparent !important',
        margin: 0,
        padding: 0,
        opacity: 0,
        width: 0,
        minWidth: 0,
        '& input': {
            color: 'transparent !important',
            caretColor: 'transparent !important',
            border: 'none !important',
            outline: 'none !important',
            boxShadow: 'none !important',
            background: 'transparent !important',
            opacity: 0,
            width: 0,
        }
    }),
    indicatorSeparator: (base: any) => ({
        ...base,
        backgroundColor: 'var(--n-line)',
        margin: '8px 0',
    }),
    option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected
            ? 'var(--n-primary)'
            : state.isFocused
                ? 'var(--n-soft)'
                : 'var(--n-card)',
        color: state.isSelected ? 'white' : 'var(--n-ink)',
        fontSize: '0.88rem',
        fontWeight: state.isSelected ? '600' : '500',
        cursor: 'pointer',
        // Dark mode option fixes
        '&:active': {
            backgroundColor: 'var(--n-primary)',
        },
    }),
    menu: (base: any) => ({
        ...base,
        zIndex: 9999,
        backgroundColor: 'var(--n-card)',
        border: '1px solid var(--n-border)',
        boxShadow: 'var(--n-shadow)',
        borderRadius: '16px',
        marginTop: '6px',
        overflow: 'hidden'
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    // Dark mode overrides
    clearIndicator: (base: any) => ({
        ...base,
        color: 'var(--n-muted)',
        '&:hover': {
            color: 'var(--n-ink)',
        },
    }),
    dropdownIndicator: (base: any) => ({
        ...base,
        color: 'var(--n-muted)',
        padding: '4px',
        '&:hover': {
            color: 'var(--n-ink)',
        },
    }),
    multiValue: (base: any) => ({
        ...base,
        backgroundColor: 'var(--n-soft)',
        borderRadius: '8px',
    }),
    multiValueLabel: (base: any) => ({
        ...base,
        color: 'var(--n-ink)',
        fontSize: '0.82rem',
        padding: '2px 4px',
    }),
    multiValueRemove: (base: any) => ({
        ...base,
        color: 'var(--n-muted)',
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'var(--n-primary)',
            color: 'white',
        },
    }),
};

function JurnalContent({ user }: { user?: any }) {
    const {
        journals, loading, error,
        selectedTeacher, setSelectedTeacher,
        selectedSubject, setSelectedSubject,
        selectedClass, setSelectedClass,
        selectedCategory, setSelectedCategory,
        selectedDate, setSelectedDate,
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        itemsPerPage, setItemsPerPage,
        finalDisplayData, filteredJournals,
        canDo, isAdmin, isGuru, isSiswa, isWali, isPrivileged, isOPJurnal,
        fetchJournals, handleDelete,
        checkNameMatch, isJournalRelated, displayGroups,
        masterDataState, setMasterDataState,
        minDate, maxDate,
        tahunAjaranFilter
    } = useJurnal(user);

    const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [editJournal, setEditJournal] = useState<Journal | null>(null);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showActionMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionMenu]);

    const { openModal, closeModal } = useModalBlur();

    useEffect(() => {
        if (showDetailModal || showEditModal || showAddModal || showExportModal) {
            openModal();
        } else {
            closeModal();
        }
    }, [showDetailModal, showEditModal, showAddModal, showExportModal]);

    const [guruOptions, setGuruOptions] = useState<any[]>([]);
    const [mapelOptions, setMapelOptions] = useState<any[]>([]);
    const [kelasOptions, setKelasOptions] = useState<any[]>([]);
    const [allWaktu, setAllWaktu] = useState<any[]>([]);

    useEffect(() => {
        const loadFilterOptions = async () => {
            try {
                /**
                 * Daftar pegawai tidak diminta untuk akun siswa: `/api/master/guru`
                 * menolaknya (MasterController.list — daftar orang tidak dibuka
                 * untuk role siswa/orang tua), dan filter "nama guru" memang bukan
                 * bagian dari tampilan siswa. Tanpa penjagaan ini permintaannya
                 * tetap berangkat lalu gagal diam-diam sebagai dropdown kosong.
                 */
                const guruFetch: Promise<Response | null> = isSiswa
                    ? Promise.resolve(null)
                    : fetch('/api/master/guru');

                const [guruRes, mapelRes, kelasRes, waktuRes, jadwalRes, dropRes] = await Promise.all([
                    guruFetch,
                    fetch('/api/master/mapel?limit=1000'),
                    fetch('/api/master/kelas?limit=1000'),
                    fetch('/api/master/waktu?limit=1000'),
                    fetch('/api/settings/jadwal-guru?limit=5000'),
                    fetch('/api/master/dropdown?limit=1000')
                ]);
                const [guruData, mapelData, kelasData, waktuData, jadwalData, dropData] = await Promise.all([
                    guruRes ? guruRes.json() : Promise.resolve({ ok: false, data: [] }),
                    mapelRes.json(), kelasRes.json(), waktuRes.json(), jadwalRes.json(), dropRes.json()
                ]);

                if (guruData.ok) setGuruOptions(guruData.data.map((g: any) => ({ value: g.nama_lengkap, label: g.nama_lengkap, nip: g.nip })));
                if (mapelData.ok) setMapelOptions(mapelData.data.map((m: any) => ({ value: m.nama, label: m.nama })));
                if (isSiswa && (user?.nip || user?.username)) {
                    try {
                        const nisn = user.nip || user.username;
                        const skRes = await fetch(`/api/siswa/${encodeURIComponent(nisn)}/kelas`);
                        const skJson = await skRes.json();
                        if (skJson.ok && Array.isArray(skJson.data) && skJson.data.length > 0) {
                            const studentClasses = [...new Set([
                                ...(user.kelas ? [user.kelas] : []),
                                ...skJson.data.map((r: any) => r.kelas).filter(Boolean)
                            ])] as string[];
                            setKelasOptions(studentClasses.map((k: string) => ({ value: k, label: k })));
                        } else if (user.kelas) {
                            setKelasOptions([{ value: user.kelas, label: user.kelas }]);
                        } else if (kelasData.ok) {
                            setKelasOptions(kelasData.data.map((k: any) => ({ value: k.nama, label: k.nama })));
                        }
                    } catch {
                        if (user.kelas) setKelasOptions([{ value: user.kelas, label: user.kelas }]);
                        else if (kelasData.ok) setKelasOptions(kelasData.data.map((k: any) => ({ value: k.nama, label: k.nama })));
                    }
                } else {
                    if (kelasData.ok) setKelasOptions(kelasData.data.map((k: any) => ({ value: k.nama, label: k.nama })));
                }
                if (waktuData.ok) setAllWaktu(waktuData.data);

                const dropdownData = dropData?.ok && Array.isArray(dropData.data) ? dropData.data : [];
                if (dropdownData) {
                    const extractOptions = (key: string) =>
                        Array.from(new Set(dropdownData.map((d: any) => d[key]).filter(Boolean)))
                            .map((v: any) => ({ value: v, label: v }));

                    const statusOpts = extractOptions('status_ketidakhadiran');
                    const katOpts = extractOptions('kategori_kehadiran');

                    setMasterDataState({
                        guru: guruData.ok ? guruData.data : [],
                        mapel: mapelData.ok ? mapelData.data : [],
                        kelas: kelasData.ok ? kelasData.data : [],
                        waktu: waktuData.ok ? waktuData.data : [],
                        jadwal: jadwalData.ok ? jadwalData.data : [],
                        dropdown: {
                            // `terlambat` dihapus: kolom `keterangan_terlambat`
                            // sudah tidak ada di tabel master_dropdown, jadi
                            // hasilnya selalu kosong. Lihat MasterService.getDropdowns().
                            statusPengganti: statusOpts.length > 0 ? statusOpts : [
                                { value: 'Hadir Penuh', label: 'Hadir Penuh' },
                                { value: 'Hanya Tugas', label: 'Hanya Tugas' },
                                { value: 'Zoom/Online', label: 'Zoom/Online' },
                                { value: 'Terlambat', label: 'Terlambat' }
                            ],
                            jenisKetidakhadiran: extractOptions('jenis_ketidakhadiran'),
                            kategoriKehadiran: katOpts
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to load filters', err);
            }
        };
        loadFilterOptions();
    }, [setMasterDataState, isSiswa]);

    const getCategoryClass = (kategori: string) => {
        switch (kategori) {
            case 'Sesuai': return 'sk__status isOn';
            case 'Terlambat': return 'sk__status isWarning';
            case 'Diganti': return 'sk__status isInfo';
            default: return 'sk__status isOff';
        }
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const paginatedData = finalDisplayData.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="jt">
            <JurnalHeader
                isAdminModeUser={isPrivileged}
            />

            <div className="jt__mainToolbar">
                    <FilterToolbar actionsInline={true}>
                        {/* Baris 1: Pencarian, Tanggal & Tombol Aksi */}
                        <FilterSearch
                            label="Pencarian"
                            placeholder="Cari guru, mapel, materi, dll..."
                            value={searchTerm}
                            onChange={setSearchTerm}
                            grow={3}
                        />

                        <FilterField label="Tanggal" icon="calendar-event" grow={1} width={160} bare>
                            <DatePicker
                                value={selectedDate || ''}
                                onChange={(val) => setSelectedDate(val || null)}
                                min={minDate}
                                max={maxDate}
                            />
                        </FilterField>

                        <FilterActions>
                            {/* Menu titik 3 — HANYA tampil di mobile */}
                            <div className="sk__menuWrap" ref={actionMenuRef}>
                                <button
                                    type="button"
                                    className={`sk__btnActionMenu ftb-btn--iconOnlyMobile ${showActionMenu ? 'isOpen' : ''}`}
                                    onClick={() => setShowActionMenu(v => !v)}
                                    title="Menu Aksi"
                                    aria-label="Menu Aksi"
                                    aria-haspopup="menu"
                                    aria-expanded={showActionMenu}
                                    style={{ position: 'relative', width: '42px', height: '42px', borderRadius: '50%', padding: 0 }}
                                >
                                    <i className="bi bi-three-dots" />
                                    <span className="ftb-btn-label">Aksi</span>
                                </button>

                                {showActionMenu && (
                                    <div className="sk__menu" role="menu">
                                        {(canDo('export') || isWali) && (
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className="sk__menuItem"
                                                onClick={() => {
                                                    setShowActionMenu(false);
                                                    setShowExportModal(true);
                                                }}
                                            >
                                                <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#3b82f6' }} /></span>
                                                <span className="sk__menuLabel">Export PDF</span>
                                            </button>
                                        )}

                                        {canDo('create') && (
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className="sk__menuItem"
                                                onClick={() => {
                                                    setShowActionMenu(false);
                                                    setShowAddModal(true);
                                                }}
                                            >
                                                <span className="sk__menuIcon"><i className="bi bi-plus-lg" style={{ color: '#3083FF' }} /></span>
                                                <span className="sk__menuLabel">Tambah</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(canDo('export') || isWali) && (
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={() => setShowExportModal(true)}
                                    icon="pdf"
                                    className="sk__btnDesktopOnly"
                                    title="Export Jurnal PDF A4"
                                >
                                    Export PDF
                                </Button>
                            )}
                            {canDo('create') && (
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={() => setShowAddModal(true)}
                                    icon="add"
                                    className="sk__btnDesktopOnly"
                                >
                                    Tambah
                                </Button>
                            )}
                        </FilterActions>

                        {/* Line break agar dropdown filter turun rapi ke baris kedua dalam SATU wadah FilterToolbar yang sama */}
                        {!isSiswa && <div style={{ flexBasis: '100%', width: '100%', height: 0, margin: 0 }} />}

                        {/* Baris 2: Filter Dropdown (Tahun Ajaran, Guru, Mapel, Kelas, Kategori) */}
                        {!isSiswa && (
                            <>
                                {tahunAjaranFilter.years.length > 0 && (
                                    <FilterSelect
                                        label="Tahun Ajaran"
                                        icon="mortarboard"
                                        value={tahunAjaranFilter.selected}
                                        onChange={tahunAjaranFilter.setSelected}
                                        options={[
                                            { value: '', label: 'Semua TA' },
                                            ...tahunAjaranFilter.years.map(y => ({ value: y, label: `TA ${y}` }))
                                        ]}
                                        grow={1}
                                        width={130}
                                    />
                                )}

                                <FilterSelect
                                    label="Guru"
                                    icon="person-badge"
                                    value={selectedTeacher || ''}
                                    onChange={(val) => setSelectedTeacher(val || null)}
                                    options={[
                                        { value: '', label: 'Pilih Guru' },
                                        ...guruOptions.map((g: any) => ({ 
                                            value: g.value || g.nama_lengkap || g.label, 
                                            label: g.label || g.nama_lengkap || g.value 
                                        }))
                                    ]}
                                    grow={1}
                                    width={150}
                                />

                                <FilterSelect
                                    label="Mata Pelajaran"
                                    icon="book"
                                    value={selectedSubject || ''}
                                    onChange={(val) => setSelectedSubject(val || null)}
                                    options={[
                                        { value: '', label: 'Pilih Mapel' },
                                        ...mapelOptions.map((m: any) => ({ 
                                            value: m.value || m.nama || m.label, 
                                            label: m.label || m.nama || m.value 
                                        }))
                                    ]}
                                    grow={1}
                                    width={140}
                                />

                                <FilterSelect
                                    label="Kelas"
                                    icon="easel"
                                    value={selectedClass || ''}
                                    onChange={(val) => setSelectedClass(val || null)}
                                    options={[
                                        { value: '', label: 'Pilih Kelas' },
                                        ...kelasOptions.map((k: any) => ({ 
                                            value: k.value || k.nama || k.label, 
                                            label: k.label || k.nama || k.value 
                                        }))
                                    ]}
                                    grow={1}
                                    width={120}
                                />

                                <FilterSelect
                                    label="Kategori"
                                    icon="tag"
                                    value={selectedCategory || ''}
                                    onChange={(val) => setSelectedCategory(val || null)}
                                    options={[
                                        { value: '', label: 'Kategori' },
                                        ...(masterDataState?.dropdown?.kategoriKehadiran || []).map((c: any) => ({ 
                                            value: c.value || c.label, 
                                            label: c.label || c.value 
                                        }))
                                    ]}
                                    grow={1}
                                    width={130}
                                />
                            </>
                        )}
                    </FilterToolbar>
                </div>

                <>
                    <JurnalTable
                        loading={loading}
                        error={error}
                        paginatedData={paginatedData}
                        allWaktu={allWaktu}
                        user={user}
                        canDo={canDo}
                        isAdmin={isAdmin}
                        isOPJurnal={isOPJurnal}
                        setSelectedJournal={setSelectedJournal}
                        setShowDetailModal={setShowDetailModal}
                        setEditJournal={(j) => { setEditJournal(j); setShowEditModal(true); }}
                        setShowEditModal={setShowEditModal}
                        handleDelete={handleDelete}
                        getCategoryClass={getCategoryClass}
                    />

                    <JurnalCards
                        loading={loading}
                        paginatedData={paginatedData}
                        allWaktu={allWaktu}
                        user={user}
                        canDo={canDo}
                        isAdmin={isAdmin}
                        isOPJurnal={isOPJurnal}
                        setSelectedJournal={setSelectedJournal}
                        setShowDetailModal={setShowDetailModal}
                        setEditJournal={(j) => { setEditJournal(j); setShowEditModal(true); }}
                        setShowEditModal={setShowEditModal}
                        handleDelete={handleDelete}
                        getCategoryClass={getCategoryClass}
                    />

                    {finalDisplayData.length > 0 && (
                        <Pagination itemLabel="jurnal"
                            currentPage={currentPage}
                            totalPages={Math.ceil(finalDisplayData.length / itemsPerPage)}
                            limit={itemsPerPage}
                            totalItems={finalDisplayData.length}
                            onPageChange={(page) => setCurrentPage(page)}
                            onLimitChange={(limit) => {
                                setItemsPerPage(limit);
                                setCurrentPage(1);
                            }}
                        />
                    )}
                </>

            <JurnalDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                journal={selectedJournal}
                user={user}
                onBandingSuccess={fetchJournals}
            />

            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                user={user}
                canDo={canDo}
                isWali={isWali}
                journals={filteredJournals}
                allJournals={journals}
                selectedTeacher={selectedTeacher}
                selectedSubject={selectedSubject}
                selectedClass={selectedClass}
                searchTerm={searchTerm}
                isJournalRelated={isJournalRelated}
                checkNameMatch={checkNameMatch}
                displayGroups={displayGroups}
                allWaktu={allWaktu}
                masterData={masterDataState}
                selectedTahunAjaran={tahunAjaranFilter.selected}
                allKelas={kelasOptions.map(k => k.value)}
            />

            {(() => {
                const canUpdateAny = canDo('update_any');
                const isOwner = editJournal?.nip === user?.nip || editJournal?.nama_guru === user?.nama;
                const hasSub = editJournal?.guru_pengganti && editJournal?.guru_pengganti !== '-' && editJournal?.guru_pengganti.trim() !== '';
                const isSub = hasSub && editJournal?.guru_pengganti === user?.nama;
                const canEditLimited = canDo('edit_materi_refleksi') && (isSub || (!hasSub && isOwner));
                const isEditAllowed = canUpdateAny || canEditLimited;
                const isAddAllowed = canDo('create');

                const isModalAllowed = showEditModal ? isEditAllowed : (showAddModal ? isAddAllowed : false);

                if (!(showAddModal || showEditModal) || !isModalAllowed) {
                    return null;
                }

                if (!masterDataState) {
                    if (typeof document === 'undefined') return null;
                    return createPortal(
                        <div className="modal-portal-backdrop">
                            <div className="modal-portal-loading">
                                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="font-medium modal-portal-loading-text">Menyiapkan data form...</span>
                            </div>
                        </div>,
                        document.body
                    );
                }

                return (
                    <JournalModal
                        key={showEditModal ? `edit-${editJournal?.id}` : 'add'}
                        isOpen={showAddModal || showEditModal}
                        onClose={() => { setShowAddModal(false); setShowEditModal(false); setEditJournal(null); }}
                        mode={showEditModal ? 'edit' : 'add'}
                        initialData={showEditModal ? editJournal : null}
                        user={user}
                        masterData={masterDataState}
                        onSuccess={fetchJournals}
                        minDate={minDate}
                        maxDate={maxDate}
                        limited={!canUpdateAny}
                    />
                );
            })()}
        </div>
    );
}

export default function JurnalPage({ user }: { user?: any }) {
    const permissions = user?.permissions || [];
    const roles = (user?.roles || []).map((r: string) => String(r).toUpperCase());
    const role = String(user?.role || '').toUpperCase();
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || role === 'ADMIN' || role === 'ADMINISTRATOR';
    const isGuru = roles.includes('GURU') || role === 'GURU';
    const isOPJurnal = roles.includes('OP_JURNAL') || role === 'OP_JURNAL';
    const isSiswa = roles.includes('SISWA') || role === 'SISWA' || roles.includes('PENGURUS_KELAS') || role === 'PENGURUS_KELAS' || roles.includes('PENGURUS KELAS');
    const canViewDaftarJurnal = isAdmin || isGuru || isSiswa;
    const canViewRekap = !isSiswa;
    const attendanceRoles: string[] = Array.isArray(user?.roles) ? roles : role.split(/[,|]/).map(r => r.trim()).filter(Boolean);
    const canViewKehadiran = !attendanceRoles.includes('SISWA') && attendanceRoles.some(r => !['ORANG_TUA', 'ORANGTUA', 'TAMU'].includes(r));

    const [inputConfig, setInputConfig] = useState<any>(null);
    const [reviewConfig, setReviewConfig] = useState<any>(null);
    const [generateConfig, setGenerateConfig] = useState<any>(null);

    useEffect(() => {
        let active = true;
        Promise.all([
            fetch('/api/site-settings?key=jurnal_input_access_config').then(r => r.json()).catch(() => null),
            fetch('/api/site-settings?key=jurnal_review_banding_access_config').then(r => r.json()).catch(() => null),
            fetch('/api/site-settings?key=jurnal_generate_access_config').then(r => r.json()).catch(() => null),
        ]).then(([resInput, resReview, resGenerate]) => {
            if (!active) return;
            if (resInput?.ok && resInput.data?.value) {
                setInputConfig(parseKonfigurasiAksesClient(resInput.data.value));
            }
            if (resReview?.ok && resReview.data?.value) {
                setReviewConfig(parseKonfigurasiAksesClient(resReview.data.value));
            }
            if (resGenerate?.ok && resGenerate.data?.value) {
                setGenerateConfig(parseKonfigurasiAksesClient(resGenerate.data.value));
            }
        });
        return () => { active = false; };
    }, []);

    const canInput = useMemo(() => {
        return checkFeatureAccess(user, inputConfig, ['PENGURUS_KELAS']);
    }, [user, inputConfig]);

    const canReview = useMemo(() => {
        return checkFeatureAccess(user, reviewConfig, ['OP_JURNAL']);
    }, [user, reviewConfig]);

    const canGenerate = useMemo(() => {
        return checkFeatureAccess(user, generateConfig, ['OP_JURNAL']);
    }, [user, generateConfig]);

    const [bandingPending, setBandingPending] = useState(0);

    const availableTabs = useMemo(() => {
        const list: { key: 'jurnal' | 'input' | 'rekap' | 'kehadiran_guru' | 'banding_saya' | 'review_banding' | 'generate'; label: string; icon: string }[] = [];
        if (canViewDaftarJurnal) {
            list.push({ key: 'jurnal', label: 'Daftar Jurnal', icon: 'journal-text' });
        }
        if (canInput) {
            list.push({ key: 'input', label: 'Input Jurnal', icon: 'pencil-square' });
        }
        if (canViewRekap) {
            list.push({ key: 'rekap', label: 'Rekap Jurnal', icon: 'bar-chart' });
        }
        if (canViewKehadiran) {
            list.push({ key: 'kehadiran_guru', label: 'Kehadiran Guru', icon: 'person-check' });
        }
        if (isGuru) {
            list.push({ key: 'banding_saya', label: 'Banding Saya', icon: 'person-badge' });
        }
        if (canReview) {
            list.push({
                key: 'review_banding',
                label: bandingPending > 0 ? `Review Banding (${bandingPending})` : 'Review Banding',
                icon: 'shield-check'
            });
        }
        if (canGenerate) {
            list.push({ key: 'generate', label: 'Generate', icon: 'magic' });
        }
        return list;
    }, [canViewDaftarJurnal, canInput, canViewRekap, canViewKehadiran, isGuru, canReview, canGenerate, bandingPending]);

    const allowedTabKeys = useMemo(() => availableTabs.map(t => t.key), [availableTabs]);

    const [activeTab, setActiveTab] = useTabParam<
        'jurnal' | 'input' | 'rekap' | 'kehadiran_guru' | 'banding_saya' | 'review_banding' | 'generate'
    >('jurnal', ['jurnal', 'input', 'rekap', 'kehadiran_guru', 'banding_saya', 'review_banding', 'generate'] as const);

    // Fallback if activeTab is not permitted for the user's role
    useEffect(() => {
        if (!allowedTabKeys.includes(activeTab)) {
            setActiveTab(allowedTabKeys[0] || 'jurnal');
        }
    }, [activeTab, allowedTabKeys, setActiveTab]);

    useEffect(() => {
        if (!canReview) return;
        let dibatalkan = false;
        (async () => {
            try {
                const res = await fetch('/api/sidebar-badges', { cache: 'no-store' });
                if (!res.ok) return;
                const json = await res.json();
                if (!dibatalkan && json.ok) setBandingPending(json.detail?.['jurnal-banding'] || 0);
            } catch {}
        })();
        return () => { dibatalkan = true; };
    }, [activeTab, canReview]);

    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (allowedTabKeys.includes(e.detail)) {
                setActiveTab(e.detail);
            } else if ((e.detail === 'input_jurnal' || e.detail === 'jurnal-input' || e.detail === 'input-jurnal') && allowedTabKeys.includes('input')) {
                setActiveTab('input');
            } else if ((e.detail === 'rekap' || e.detail === 'rekap-jurnal' || e.detail === 'rekap_jurnal') && allowedTabKeys.includes('rekap')) {
                setActiveTab('rekap');
            } else if (e.detail === 'jurnal-banding') {
                if (allowedTabKeys.includes('banding_saya')) {
                    setActiveTab('banding_saya');
                } else if (allowedTabKeys.includes('review_banding')) {
                    setActiveTab('review_banding');
                }
            }
        };
        window.addEventListener('acca:switch-page-tab' as any, handleSwitchTab);
        return () => {
            window.removeEventListener('acca:switch-page-tab' as any, handleSwitchTab);
        };
    }, [setActiveTab, allowedTabKeys]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const t = params.get('tab');
            if ((t === 'rekap-jurnal' || t === 'rekap_jurnal') && allowedTabKeys.includes('rekap')) {
                setActiveTab('rekap');
            }
        }
    }, [setActiveTab, allowedTabKeys]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('acca:page-tabs', {
            detail: availableTabs.map(t => ({
                id: t.key,
                label: t.label,
                icon: t.icon,
                active: activeTab === t.key,
                isCustom: true
            }))
        }));
        return () => {
            window.dispatchEvent(new CustomEvent('acca:page-tabs', { detail: [] }));
        };
    }, [activeTab, availableTabs]);

    if (availableTabs.length === 0) {
        return (
            <div className="jurnal-page-wrapper">
                <div className="p-12 text-center text-slate-500 font-medium">
                    Anda tidak memiliki hak akses ke modul jurnal pembelajaran.
                </div>
                <MaintenanceBanner pageKey="maintenance_jurnal" />
            </div>
        );
    }

    return (
        <div className="jurnal-page-wrapper">
            <Tab
                tabs={availableTabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                ariaLabel="Tab Halaman Jurnal"
                variant="slider"
            />

            <div style={{ marginTop: '12px' }}>
                {activeTab === 'jurnal' && canViewDaftarJurnal && (
                    <Suspense fallback={<div className="p-12 text-center jp-loading-text">Memuat jurnal pembelajaran...</div>}>
                        <JurnalContent user={user} />
                    </Suspense>
                )}
                {activeTab === 'input' && canInput && (
                    <Suspense fallback={<div className="p-12 text-center jp-loading-text">Memuat form input...</div>}>
                        <JurnalInputPage />
                    </Suspense>
                )}
                {activeTab === 'rekap' && canViewRekap && (
                    <Suspense fallback={<div className="p-12 text-center jp-loading-text">Memuat rekapitulasi jurnal...</div>}>
                        <RekapJurnalTab user={user} />
                    </Suspense>
                )}
                {activeTab === 'kehadiran_guru' && canViewKehadiran && <KehadiranGuruTab />}
                {activeTab === 'banding_saya' && isGuru && (
                    <BandingPage user={user} activeTabProp="saya" hideHeaderTab={true} />
                )}
                {activeTab === 'review_banding' && canReview && (
                    <BandingPage user={user} activeTabProp="review" hideHeaderTab={true} />
                )}
                {activeTab === 'generate' && canGenerate && (
                    <GenerateJurnalTab user={user} />
                )}
            </div>

            <MaintenanceBanner pageKey="maintenance_jurnal" />
        </div>
    );
}
