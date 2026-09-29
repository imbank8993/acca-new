'use client';

import { useState, useEffect, useCallback } from 'react';
import Select, { components } from 'react-select';
import { getAllActiveAcademicYears } from '@/lib/settings-client';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const CheckboxOption = (props: any) => {
    return (
        <div>
            <components.Option {...props}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        checked={props.isSelected}
                        onChange={() => null}
                        style={{ marginRight: '10px', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label style={{ cursor: 'pointer', margin: 0, flex: 1 }}>{props.label}</label>
                </div>
            </components.Option>
        </div>
    );
};

interface GuruAsuhFormProps {
    user?: any;
    editData?: {
        id: number;
        nisn_siswa: string;
        nama_siswa: string;
        kelas: string;
        tahun_ajaran: string;
    } | null;
    onClose: () => void;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
    tahunAjaran: string;
}

interface StudentOption {
    value: string;
    label: string;
    nisn: string;
    nama: string;
    kelas: string;
}

export default function GuruAsuhForm({ user, editData, onClose, onSuccess, onError, tahunAjaran }: GuruAsuhFormProps) {
    const nip = user?.nip || '';
    const nama_guru = user?.nama_lengkap || user?.nama || '';

    // Modal state
    const [modalAaTahun, setModalAaTahun] = useState(tahunAjaran !== 'Semua' ? tahunAjaran : '');
    const [modalActiveYears, setModalActiveYears] = useState<{ tahun_ajaran: string; semester: string }[]>([]);
    const [modalSiswaKelasList, setModalSiswaKelasList] = useState<string[]>([]);
    const [modalAaFilterKelas, setModalAaFilterKelas] = useState('');

    const [selectedStudents, setSelectedStudents] = useState<readonly StudentOption[]>([]);
    const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load active academic years on mount
    useEffect(() => {
        const loadYears = async () => {
            try {
                let activeYears = await getAllActiveAcademicYears();
                // De-duplicate by tahun ajaran
                const seen = new Set<string>();
                activeYears = activeYears.filter(y => {
                    if (seen.has(y.tahun_ajaran)) return false;
                    seen.add(y.tahun_ajaran);
                    return true;
                });
                setModalActiveYears(activeYears);

                // Set default tahun ajaran
                if (!modalAaTahun && activeYears.length > 0) {
                    setModalAaTahun(activeYears[0].tahun_ajaran);
                }
            } catch (e) { console.error(e); }
        };
        loadYears();
    }, []);

    // Load siswa kelas list when tahun ajaran changes
    useEffect(() => {
        if (modalAaTahun) {
            const loadKelasList = async () => {
                try {
                    const res = await fetch(`/api/settings/siswa-kelas?tahun_ajaran=${modalAaTahun}&limit=10000`);
                    const data = await res.json();
                    if (data.ok && data.data) {
                        const kelasSet = new Set<string>();
                        data.data.forEach((s: any) => { if (s.kelas) kelasSet.add(s.kelas); });
                        setModalSiswaKelasList(Array.from(kelasSet).sort());
                    }
                } catch (e) { console.error(e); }
            };
            loadKelasList();
        }
    }, [modalAaTahun]);

    // Load students function
    const loadStudentOptions = useCallback(async (q: string, tahunAjaran?: string, kelasFilter?: string) => {
        const ta = tahunAjaran ?? modalAaTahun;
        const kf = kelasFilter ?? modalAaFilterKelas;
        if (!ta) return;
        setLoadingStudents(true);
        try {
            // Build URL with class filter if selected
            let url = `/api/settings/siswa-kelas?tahun_ajaran=${ta}&limit=5000`;
            if (kf) {
                url += `&kelas=${encodeURIComponent(kf)}`;
            }
            const skRes = await fetch(url);
            const skData = await skRes.json();
            const gaRes = await fetch(`/api/settings/guru-asuh?tahun_ajaran=${ta}&limit=5000`);
            const gaData = await gaRes.json();

            const claimedNisns = new Set<string>();
            const ownClaimedNisns = new Set<string>();
            const guruClaimMap = new Map<string, string>(); // nisn -> nama_guru

            if (gaData.ok && gaData.data) {
                for (const item of gaData.data) {
                    if (item.nip === nip) {
                        ownClaimedNisns.add(item.nisn_siswa);
                    } else {
                        claimedNisns.add(item.nisn_siswa);
                        guruClaimMap.set(item.nisn_siswa, item.nama_guru);
                    }
                }
            }

            if (skData.ok && skData.data) {
                const seen = new Map<string, any>();
                for (const s of skData.data) { if (!seen.has(s.nisn)) seen.set(s.nisn, s); }

                const options: StudentOption[] = [];
                seen.forEach(s => {
                    const isClaimedByOther = claimedNisns.has(s.nisn) && !ownClaimedNisns.has(s.nisn);
                    const isOwnClaim = ownClaimedNisns.has(s.nisn);
                    let label = `${s.nama_siswa} — ${s.kelas} (NISN: ${s.nisn})`;
                    if (isClaimedByOther) {
                        label += ` [Sudah diklaim: ${guruClaimMap.get(s.nisn)}]`;
                    } else if (isOwnClaim) {
                        label += ` [Sudah diklaim]`;
                    }
                    if (q && !label.toLowerCase().includes(q.toLowerCase())) return;
                    options.push({ value: s.nisn, label, nisn: s.nisn, nama: s.nama_siswa, kelas: s.kelas });
                });
                setStudentOptions(options);
            }
        } catch (err) { console.error(err); }
        finally { setLoadingStudents(false); }
    }, [modalAaTahun, modalAaFilterKelas, nip]);

    // Initial load
    useEffect(() => {
        if (modalAaTahun) {
            loadStudentOptions('', modalAaTahun, '');
        }
    }, [modalAaTahun, modalAaFilterKelas, loadStudentOptions]);

    const handleTahunChange = (val: string) => {
        setModalAaTahun(val);
        setModalAaFilterKelas('');
        if (val) {
            loadStudentOptions('', val, '');
            // Update kelas list
            fetch(`/api/settings/siswa-kelas?tahun_ajaran=${val}&limit=10000`)
                .then(r => r.json())
                .then(d => {
                    if (d.ok && d.data) {
                        const ks = new Set<string>();
                        d.data.forEach((s: any) => { if (s.kelas) ks.add(s.kelas); });
                        setModalSiswaKelasList(Array.from(ks).sort());
                    }
                });
        } else {
            setModalSiswaKelasList([]);
        }
    };

    const handleKelasFilterChange = (val: string) => {
        setModalAaFilterKelas(val);
        loadStudentOptions('', modalAaTahun, val);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!selectedStudents || selectedStudents.length === 0) && !editData) {
            onError('Pilih minimal satu siswa terlebih dahulu!');
            return;
        }
        if (!modalAaTahun) {
            onError('Pilih Tahun Ajaran terlebih dahulu.');
            return;
        }

        setSaving(true);
        try {
            if (editData) {
                const payload = {
                    nip,
                    nama_guru,
                    nisn_siswa: editData.nisn_siswa,
                    nama_siswa: editData.nama_siswa,
                    kelas: editData.kelas,
                    tahun_ajaran: modalAaTahun,
                    aktif: true,
                    id: editData.id
                };
                const res = await fetch('/api/settings/guru-asuh', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
            } else {
                for (const student of selectedStudents) {
                    const payload = {
                        nip,
                        nama_guru,
                        nisn_siswa: student.nisn,
                        nama_siswa: student.nama,
                        kelas: student.kelas,
                        tahun_ajaran: modalAaTahun,
                        aktif: true,
                    };
                    const res = await fetch('/api/settings/guru-asuh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || `Gagal menyimpan data ${student.nama}`);
                }
            }
            onSuccess('Berhasil disimpan');
            onClose();
        } catch (err: any) {
            onError(err.message || 'Terjadi kesalahan');
        } finally {
            setSaving(false);
        }
    };

    const selectStyles = {
        control: (base: any, state: any) => ({
            ...base,
            borderRadius: '14px',
            border: state.isFocused ? '1px solid var(--n-primary)' : '1px solid var(--n-border)',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
            '&:hover': { borderColor: 'var(--n-primary-light)' },
            padding: '2px 6px',
            fontSize: '0.88rem',
            fontWeight: '520',
            backgroundColor: 'var(--n-card)',
            color: 'var(--n-ink)',
            minHeight: '46px',
        }),
        placeholder: (base: any) => ({ ...base, color: 'var(--n-muted)' }),
        singleValue: (base: any) => ({ ...base, color: 'var(--n-ink)', fontWeight: '600' }),
        input: (base: any) => ({ ...base, color: 'var(--n-ink)' }),
        option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isSelected ? 'var(--n-primary)' : state.isFocused ? 'var(--n-soft)' : 'var(--n-card)',
            color: state.isSelected ? 'white' : 'var(--n-ink)',
            fontSize: '0.88rem',
            fontWeight: state.isSelected ? '600' : '500',
            cursor: 'pointer',
        }),
        menu: (base: any) => ({
            ...base, zIndex: 9999, backgroundColor: 'var(--n-card)',
            border: '1px solid var(--n-border)', borderRadius: '14px',
            boxShadow: 'var(--n-shadow)', marginTop: '6px', overflow: 'hidden',
        }),
        menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
        noOptionsMessage: (base: any) => ({ ...base, color: 'var(--n-muted)', fontSize: '0.85rem' }),
    };

    return (
        <Modal size="lg" variant={editData ? 'edit' : 'add'} onClose={onClose} labelledBy="guru-asuh-form-title">
            <ModalHeader
                id="guru-asuh-form-title"
                icon={editData ? 'pencil-square' : 'person-plus'}
                title={editData ? 'Edit Siswa Asuh' : 'Klaim Siswa Asuh'}
                onClose={onClose}
            />
            <form id="guru-asuh-form" className="gaf__form" onSubmit={handleSubmit}>
                <ModalBody>
                    <div className="gaf__infoBar">
                        <div className="gaf__infoItem">
                            <i className="bi bi-person-badge" />
                            <span><strong>{nama_guru}</strong></span>
                        </div>
                        {modalAaTahun && (
                            <div className="gaf__infoItem">
                                <i className="bi bi-calendar3" />
                                <span>TA {modalAaTahun}</span>
                            </div>
                        )}
                    </div>

                    {!editData && (
                        <>
                            <div className="gaf__filterRow">
                                {modalActiveYears.length > 1 && (
                                    <select className="gaf__kelasSelect" value={modalAaTahun} onChange={e => handleTahunChange(e.target.value)}>
                                        <option value="">Pilih Tahun Ajaran *</option>
                                        {modalActiveYears.map(y => (
                                            <option key={y.tahun_ajaran} value={y.tahun_ajaran}>TA {y.tahun_ajaran}</option>
                                        ))}
                                    </select>
                                )}
                                <select className="gaf__kelasSelect" value={modalAaFilterKelas} onChange={e => handleKelasFilterChange(e.target.value)} disabled={!modalAaTahun || modalSiswaKelasList.length === 0}>
                                    <option value="">{modalSiswaKelasList.length === 0 ? 'Pilih Kelas...' : 'Semua Kelas'}</option>
                                    {modalSiswaKelasList.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                            <div className="gaf__field">
                                <label className="gaf__label">Pilih Siswa *</label>
                                <Select options={studentOptions} value={selectedStudents}
                                    isMulti hideSelectedOptions={false} components={{ Option: CheckboxOption }} closeMenuOnSelect={false}
                                    onChange={opts => setSelectedStudents(opts as readonly StudentOption[])}
                                    onInputChange={val => { loadStudentOptions(val, modalAaTahun, modalAaFilterKelas); }}
                                    placeholder={loadingStudents ? '...' : (!modalAaTahun ? 'Pilih Tahun Ajaran dulu...' : 'Ketik nama atau NISN...')}
                                    isLoading={loadingStudents} isSearchable isClearable noOptionsMessage={() => 'Ketik untuk mencari...'}
                                    styles={selectStyles} menuPortalTarget={document.body} menuPosition="fixed" className="gaf__select" />
                            </div>
                        </>
                    )}
                    {editData && (
                        <div className="sk__grid2">
                            <div className="sk__field">
                                <label>Nama Siswa</label>
                                <div className="sk__readInput">{editData.nama_siswa}</div>
                            </div>
                            <div className="sk__field">
                                <label>Kelas</label>
                                <div className="sk__readInput">{editData.kelas}</div>
                            </div>
                            <div className="sk__field sk__fieldFull">
                                <label>NISN</label>
                                <div className="sk__readInput font-mono">{editData.nisn_siswa}</div>
                            </div>
                        </div>
                    )}
                </ModalBody>
            </form>
            <ModalFooter>
                <Button type="button" variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>Batal</Button>
                <Button type="submit" form="guru-asuh-form" variant="primary" isLoading={saving}
                    disabled={(!editData && selectedStudents.length === 0) || !modalAaTahun}
                    leftIcon={<i className={`bi ${editData ? 'bi-check2-all' : 'bi-check-circle-fill'}`} />}>
                    {editData ? 'Simpan' : 'Klaim Siswa'}
                </Button>
            </ModalFooter>
            <style jsx global>{`
                .gaf__form {
                    padding: 20px; display: flex; flex-direction: column; gap: 16px;
                }
                .gaf__infoBar {
                    display: flex; gap: 12px; padding: 10px 14px;
                    background: #fdf4ff; border: 1px solid rgba(96,165,250,0.2);
                    border-radius: 12px;
                }
                .gaf__infoItem {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 0.78rem; font-weight: 600; color: #00287a;
                }
                .gaf__infoItem i { font-size: 0.85rem; }
                .gaf__field { display: flex; flex-direction: column; gap: 6px; }
                .gaf__label { font-size: 0.8rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.03em; }
                .gaf__select { width: 100%; }
                .gaf__filterRow { display: flex; gap: 8px; }
                .gaf__kelasSelect {
                    flex: 1; padding: 9px 12px;
                    border-radius: 12px; border: 1px solid var(--n-border);
                    background: var(--n-surface); color: var(--n-ink);
                    font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none;
                    transition: border-color 0.15s;
                }
                .gaf__kelasSelect:focus { border-color: var(--n-primary); }
                .gaf__kelasSelect:disabled { opacity: 0.4; cursor: not-allowed; }
                .gaf__preview {
                    background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;
                    padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
                }
                .gaf__previewRow { display: flex; gap: 12px; align-items: center; }
                .gaf__previewLabel { font-size: 0.75rem; font-weight: 700; color: #15803d; width: 50px; }
                .gaf__previewValue { font-size: 0.82rem; font-weight: 600; color: #166534; }
                .gaf__actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; }
                .gaf__btnCancel {
                    padding: 10px 20px; border-radius: 12px; border: 1px solid var(--n-border);
                    background: transparent; color: var(--n-muted); font-size: 0.85rem; font-weight: 700;
                    cursor: pointer; transition: all 0.15s;
                }
                .gaf__btnCancel:hover { border-color: var(--n-primary); color: var(--n-primary); }
                .gaf__btnSave {
                    display: flex; align-items: center; gap: 7px;
                    padding: 10px 22px; border-radius: 12px; border: 1px solid #1a73e8;
                    background: linear-gradient(135deg, #3083FF, #3083FF);
                    color: white; font-size: 0.85rem; font-weight: 700;
                    cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(96,165,250,0.3);
                }
                .gaf__btnSave:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(96,165,250,0.4); }
                .gaf__btnSave:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .gaf__spinner {
                    width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
                    border-top-color: white; border-radius: 50%;
                    animation: gafSpin 0.6s linear infinite;
                }
                @keyframes gafSpin { to { transform: rotate(360deg); } }
                :global(.dark) .gaf__closeBtn { background: rgba(26, 115, 232, 0.15) !important; border-color: rgba(26, 115, 232, 0.4) !important; color: #60a5fa !important; }
                :global(.dark) .gaf__closeBtn:hover { background: rgba(26, 115, 232, 0.3) !important; color: #ffffff !important; }
                :global(.dark) .gaf__infoBar { background: rgba(26, 115, 232, 0.1) !important; border-color: rgba(26, 115, 232, 0.3) !important; }
                :global(.dark) .gaf__infoItem { color: #60a5fa !important; }
                :global(.dark) .gaf__btnSave { border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .gaf__preview { background: rgba(52,211,153,0.1) !important; border-color: rgba(52,211,153,0.3) !important; }
                :global(.dark) .gaf__previewLabel { color: #34d399 !important; }
                :global(.dark) .gaf__previewValue { color: #6ee7b7 !important; }
                :global(.dark) .gaf__kelasSelect {
                    background-color: #0b1329 !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2360a5fa' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 10px center !important;
                    padding-right: 28px !important;
                    border: 1px solid rgba(26, 115, 232, 0.35) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                }
                :global(.dark) .gaf__searchInput { background: #0b1329 !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #ffffff !important; }
                @media (max-width: 640px) {
                    .gaf__actions { flex-direction: column; }
                    .gaf__btnCancel, .gaf__btnSave { width: 100%; justify-content: center; }
                    .gaf__filterRow { flex-direction: column; }
                }
            `}</style>
        </Modal>
    );
}
