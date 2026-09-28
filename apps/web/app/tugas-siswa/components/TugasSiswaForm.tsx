'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import SearchableSelect from '@/components/ui/SearchableSelect';
import InlineSelect from '@/components/ui/InlineSelect';
import DatePicker from '@/components/ui/DatePicker';
import { ensureAbsoluteUrl } from '@/lib/url';
import { useTimezone } from '@/hooks/use-timezone';
import { getAcademicYearFromDate, getSemesterFromDate } from '@/lib/date-utils';
import { useFileViewer } from '@/components/useFileViewer';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface MasterData {
    guru: { guru_id: string; nama_lengkap: string; nip?: string }[];
    mapel: { id: number; kode: string; nama: string }[];
    kelas: { id: number; nama: string; tingkat: number }[];
}

interface TugasSiswa {
    id?: number;
    guru_id?: string | null;
    nama_guru?: string;
    mapel_id?: number | null;
    nama_mapel?: string;
    kelas?: string;
    kelas_list?: string | string[] | null;
    target_siswa?: any;
    judul_tugas?: string;
    deskripsi?: string | null;
    tanggal_mulai?: string;
    tanggal_selesai?: string | null;
    is_range?: boolean;
    file_url?: string | null;
    file_name?: string | null;
    jenis?: 'tugas' | 'pengingat';
    ruangan?: string | null;
    durasi?: string | null;
    sifat_ujian?: string | null;
}

interface TugasSiswaFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    masterData: MasterData;
    editData?: TugasSiswa | null;
    userKelas?: string[];               // all unique kelas names across all years (for display badge)
    userKelasAll?: { kelas: string; tahun_ajaran: string }[];  // full enrollment list with year
    userNisn?: string;                  // siswa's NISN — used to look up year-specific enrollment
    userRole: string;
    isSiswa: boolean;
    isGuru: boolean;
    userGuruId?: string;
    userGuruNama?: string;
}

export default function TugasSiswaForm({
    isOpen,
    onClose,
    onSubmit,
    masterData,
    editData,
    userKelas,
    userKelasAll,
    userNisn,
    userRole,
    isSiswa,
    isGuru,
    userGuruId,
    userGuruNama
}: TugasSiswaFormProps) {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Viewer file in-app (sama seperti halaman Informasi).
    const { openFile, viewer } = useFileViewer();

    // Timezone
    const { getCurrentDate: getTzDate } = useTimezone();

    const [formData, setFormData] = useState({
        guru_id: '',
        nama_guru: '',
        mapel_id: '',
        nama_mapel: '',
        kelas_list: [] as string[],
        judul_tugas: '',
        deskripsi: '',
        tanggal_mulai: '', // Will be set by useEffect
        tanggal_selesai: '',
        is_range: false,
        file_url: '',
        file_name: '',
        jenis: 'tugas' as 'tugas' | 'pengingat',
        ruangan: '',
        durasi: '',
        sifat_ujian: '',
        target_siswa: null as Record<string, string[]> | null // mapping of kelas to selected NISNs, null if all students
    });

    const [kelasData, setKelasData] = useState<any[]>([]);
    // Kelas for the siswa (filtered by academic year of tanggal_mulai)
    const [siswaKelasForYear, setSiswaKelasForYear] = useState<string[]>([]);
    const [isKelasDropdownOpen, setIsKelasDropdownOpen] = useState(false);
    const [expandedKelas, setExpandedKelas] = useState<string | null>(null);
    const [tempKelasDataMap, setTempKelasDataMap] = useState<Record<string, any>>({});

    // Reset form when modal opens/closes or editData changes
    useEffect(() => {
        if (isOpen) {
            // Initialize date from timezone
            const initDate = async () => {
                const today = await getTzDate();
                if (today) {
                    setFormData(prev => ({ ...prev, tanggal_mulai: today }));
                }
            };
            initDate();

            if (editData) {
                // Parse kelas_list from editData - could be JSON array or comma-separated string
                let kelasArr: string[] = [];
                if (editData.kelas_list) {
                    if (typeof editData.kelas_list === 'string') {
                        try { kelasArr = JSON.parse(editData.kelas_list); } catch { kelasArr = []; }
                    } else if (Array.isArray(editData.kelas_list)) {
                        kelasArr = editData.kelas_list;
                    }
                }
                if (kelasArr.length === 0 && editData.kelas) {
                    kelasArr = editData.kelas.split(',').map((k: string) => k.trim()).filter(Boolean);
                }
                setFormData({
                    guru_id: editData.guru_id || '',
                    nama_guru: editData.nama_guru || '',
                    mapel_id: editData.mapel_id?.toString() || '',
                    nama_mapel: editData.nama_mapel || '',
                    kelas_list: kelasArr,
                    judul_tugas: editData.judul_tugas || '',
                    deskripsi: editData.deskripsi || '',
                    tanggal_mulai: editData.tanggal_mulai || new Date().toISOString().split('T')[0],
                    tanggal_selesai: editData.tanggal_selesai || '',
                    is_range: editData.is_range || false,
                    file_url: editData.file_url || '',
                    file_name: editData.file_name || '',
                    jenis: editData.jenis || 'tugas',
                    ruangan: editData.ruangan || '',
                    durasi: editData.durasi || '',
                    sifat_ujian: editData.sifat_ujian || '',
                    target_siswa: editData.target_siswa || null
                });
            } else {
                // Pre-fill for guru: auto-select their own guru data
                const defaultGuruId = isGuru ? (userGuruId || '') : '';
                const defaultGuruNama = isGuru ? (userGuruNama || '') : '';
                // For siswa: kelas_list starts empty; fetchKelasInfo will auto-set it
                // once tanggal_mulai is known, filtered by the correct academic year.
                setFormData({
                    guru_id: defaultGuruId,
                    nama_guru: defaultGuruNama,
                    mapel_id: '',
                    nama_mapel: '',
                    kelas_list: [],
                    judul_tugas: '',
                    deskripsi: '',
                    tanggal_mulai: new Date().toISOString().split('T')[0],
                    tanggal_selesai: '',
                    is_range: false,
                    file_url: '',
                    file_name: '',
                    jenis: 'tugas',
                    ruangan: '',
                    durasi: '',
                    sifat_ujian: '',
                    target_siswa: null
                });
            }
        }
    }, [isOpen, editData, isGuru, isSiswa, userGuruId, userGuruNama]);

    // Debug logging
    useEffect(() => {
        console.log('[Form] masterData received:', JSON.stringify(masterData, null, 2));
        console.log('[Form] guruOptions would be:', guruOptions);
    }, [masterData]);

    // Fetch classes and students based on tahun ajaran derived from tanggal_mulai
    useEffect(() => {
        const fetchKelasInfo = async () => {
            if (!formData.tanggal_mulai) return;
            const ta = getAcademicYearFromDate(formData.tanggal_mulai);
            try {
                const res = await fetch(`/api/tugas-siswa/master?tahunAjaran=${encodeURIComponent(ta)}`);
                const json = await res.json();
                if (json.ok && json.data?.kelas) {
                    setKelasData(json.data.kelas);
                    const map: Record<string, any> = {};
                    json.data.kelas.forEach((k: any) => { map[k.nama] = k; });
                    setTempKelasDataMap(map);
                }

                // For siswa: filter their kelas enrollment to match the year(s) the API used.
                // The API resolves the actual active years from master_tahun_ajaran, which may
                // differ from the locally-computed `ta`. We use the yearsUsed returned by the
                // API (or fall back to [ta]) to filter userKelasAll.
                if (isSiswa && userKelasAll && userKelasAll.length > 0) {
                    // API returns the resolved years in json.data.yearsUsed (if provided),
                    // otherwise fall back to [ta]
                    const yearsUsed: string[] = json.data?.yearsUsed ?? [ta];
                    const kelasForYear = userKelasAll
                        .filter(e => yearsUsed.includes(e.tahun_ajaran))
                        .map(e => e.kelas);
                    const unique = [...new Set(kelasForYear)] as string[];
                    setSiswaKelasForYear(unique);

                    // Auto-set kelas_list for siswa:
                    // 1. If kelas_list is empty (new form just opened), populate with current year's kelas.
                    // 2. If kelas_list has stale kelas from another year, reset to current year's kelas.
                    setFormData(prev => {
                        const isEmpty = prev.kelas_list.length === 0;
                        const hasStaleKelas = prev.kelas_list.some(k => !unique.includes(k));
                        if (isEmpty || hasStaleKelas) {
                            return { ...prev, kelas_list: unique };
                        }
                        return prev;
                    });
                }
            } catch (err) {
                console.error('Failed to fetch kelas info:', err);
            }
        };
        fetchKelasInfo();
    }, [formData.tanggal_mulai, isSiswa, userKelasAll]);

    const guruOptions = masterData.guru?.length > 0
        ? masterData.guru.map(g => ({
            value: String(g.guru_id || g.nip || ''),
            label: g.nama_lengkap,
            subLabel: String(g.guru_id || g.nip || '')
        }))
        : [];

    const mapelOptions = masterData.mapel?.length > 0
        ? masterData.mapel.map(m => ({
            value: m.id.toString(),
            label: m.nama,
            subLabel: m.kode
        }))
        : [];

    // For siswa: prefer kelas filtered by the current academic year (from tanggal_mulai).
    // Falls back to full userKelas list if siswaKelasForYear not yet computed.
    const effectiveSiswaKelas = (isSiswa && siswaKelasForYear.length > 0)
        ? siswaKelasForYear
        : (userKelas || []);

    const kelasOptions = (isSiswa && effectiveSiswaKelas.length > 0)
        ? effectiveSiswaKelas.map(k => ({ value: String(k), label: String(k) }))
        : (masterData.kelas?.length > 0
            ? masterData.kelas.map(k => ({ value: String(k.nama || k.id), label: String(k.nama || k.id) }))
            : []);

    // Toggle a single kelas in kelas_list
    const toggleKelas = (kelasValue: string) => {
        setFormData(prev => {
            const current = prev.kelas_list;
            if (current.includes(kelasValue)) {
                return { ...prev, kelas_list: current.filter(k => k !== kelasValue) };
            } else {
                return { ...prev, kelas_list: [...current, kelasValue] };
            }
        });
    };

    const handleGuruChange = (val: string | number | (string | number)[]) => {
        const guruId = String(val);
        const selectedGuru = masterData.guru?.find(g => (g.guru_id || g.nip) === guruId);
        setFormData(prev => ({
            ...prev,
            guru_id: guruId,
            nama_guru: selectedGuru?.nama_lengkap || ''
        }));
    };

    const handleMapelChange = (val: string | number | (string | number)[]) => {
        const mapelId = String(val);
        const selectedMapel = masterData.mapel?.find(m => m.id.toString() === mapelId);
        setFormData(prev => ({
            ...prev,
            mapel_id: mapelId,
            nama_mapel: selectedMapel?.nama || ''
        }));
    };

    const handleKelasChange = (val: string | number | (string | number)[]) => {
        setFormData(prev => ({ ...prev, kelas: String(val) }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);

            const res = await fetch('/api/tugas-siswa/upload', {
                method: 'POST',
                body: uploadFormData
            });

            const result = await res.json();
            if (result.ok) {
                setFormData(prev => ({
                    ...prev,
                    file_url: result.publicUrl,
                    file_name: result.fileName
                }));
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: 'File berhasil diupload',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                Swal.fire('Gagal', result.error || 'Gagal upload file', 'error');
            }
        } catch (err) {
            console.error('Upload error:', err);
            Swal.fire('Gagal', 'Gagal upload file', 'error');
        } finally {
            setUploading(false);
        }
    };

    const removeFile = () => {
        setFormData(prev => ({ ...prev, file_url: '', file_name: '' }));
    };

    const handleSubmit = async () => {
        const missingFields: string[] = [];
        if (!formData.nama_guru) missingFields.push('Guru');
        if (!formData.nama_mapel) missingFields.push('Mata Pelajaran');
        if (!formData.kelas_list || formData.kelas_list.length === 0) missingFields.push('Kelas (pilih minimal 1 kelas)');
        if (!formData.judul_tugas || !formData.judul_tugas.trim()) missingFields.push('Judul Tugas');
        if (!formData.tanggal_mulai) missingFields.push('Tanggal');

        if (missingFields.length > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Field Wajib Belum Diisi',
                html: `Mohon lengkapi field berikut:<br/><br/><strong style="color: #ef4444; font-size: 0.95rem;">${missingFields.join(', ')}</strong>`,
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (formData.is_range && !formData.tanggal_selesai) {
            Swal.fire({
                icon: 'warning',
                title: 'Tanggal Selesai Belum Diisi',
                text: 'Tanggal selesai harus diisi untuk rentang tanggal',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        setLoading(true);
        try {
            // Tahun ajaran & semester diturunkan dari tanggal tugas (batas Juli),
            // bukan dipatok satu tahun — kalau dipatok, tugas tahun baru ikut
            // terbaca sebagai tugas tahun lama saat difilter.
            await onSubmit({
                ...formData,
                tahun_ajaran: getAcademicYearFromDate(formData.tanggal_mulai),
                semester: getSemesterFromDate(formData.tanggal_mulai)
            });
            onClose();
        } catch (err: any) {
            Swal.fire('Gagal', err.message || 'Gagal menyimpan tugas', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const modalTitle = editData
        ? `Edit ${editData.jenis === 'pengingat' ? 'Pengingat' : 'Tugas'}`
        : formData.jenis === 'pengingat'
            ? 'Tambah Pengingat Baru'
            : 'Tambah Tugas Baru';

    const modalIcon = formData.jenis === 'pengingat' ? 'bell-fill' : 'clipboard-plus';

    return (
        <>
        <Modal onClose={onClose} size="lg" variant={editData ? 'edit' : 'add'}>
            <ModalHeader
                title={modalTitle}
                icon={modalIcon}
                onClose={onClose}
            />
            <ModalBody className="tcf__body">
                    {/* Jenis Select — InlineSelect shared component */}
                    <div className="tcf__field tcf__field--jenis">
                        <label className="tcf__label">
                            Tipe <span className="tcf__required">*</span>
                        </label>
                        <InlineSelect
                            options={[
                                { value: 'tugas', label: 'Input Tugas' },
                                { value: 'pengingat', label: 'Input Pengingat' }
                            ]}
                            value={formData.jenis}
                            onChange={(val) => {
                                const jenisVal = val as 'tugas' | 'pengingat';
                                setFormData(prev => ({
                                    ...prev,
                                    jenis: jenisVal,
                                    ...(jenisVal === 'tugas' ? { ruangan: '', durasi: '', sifat_ujian: '' } : {})
                                }));
                            }}
                            minWidth="100%"
                            height="38px"
                        />
                    </div>

                    <div className="tcf__row">
                        {/* Guru */}
                        <div className="tcf__field">
                            <label className="tcf__label">
                                Guru <span className="tcf__required">*</span>
                            </label>
                            <SearchableSelect
                                options={guruOptions}
                                value={formData.guru_id}
                                onChange={handleGuruChange}
                                placeholder={guruOptions.length === 0 ? "Tidak ada data guru" : "Pilih Guru..."}
                                disabled={isGuru || guruOptions.length === 0}
                            />
                            {guruOptions.length === 0 && (
                                <span className="tcf__hint">Data guru belum tersedia</span>
                            )}
                        </div>

                        {/* Mapel */}
                        <div className="tcf__field">
                            <label className="tcf__label">
                                Mata Pelajaran <span className="tcf__required">*</span>
                            </label>
                            <SearchableSelect
                                options={mapelOptions}
                                value={formData.mapel_id}
                                onChange={handleMapelChange}
                                placeholder={mapelOptions.length === 0 ? "Tidak ada data mapel" : "Pilih Mapel..."}
                                disabled={mapelOptions.length === 0}
                            />
                            {mapelOptions.length === 0 && (
                                <span className="tcf__hint">Data mapel belum tersedia</span>
                            )}
                        </div>
                    </div>

                    {/* Multi-Kelas Selector — SearchableSelect shared component */}
                    <div className="tcf__field">
                        <label className="tcf__label">
                            Kelas <span className="tcf__required">*</span>
                            <span className="tcf__multiHint"> (pilih satu atau lebih)</span>
                        </label>
                        <SearchableSelect
                            options={kelasOptions}
                            value={formData.kelas_list}
                            onChange={(vals) => {
                                const selectedList = Array.isArray(vals) ? vals.map(String) : [String(vals)];
                                setFormData(prev => ({ ...prev, kelas_list: selectedList }));
                            }}
                            placeholder={kelasOptions.length === 0 ? "Tidak ada data kelas" : "Pilih Kelas..."}
                            disabled={kelasOptions.length === 0}
                            multiple={true}
                            itemLabel="kelas"
                        />
                        {formData.kelas_list.length > 0 && (
                            <div className="tcf__kelasSelectedSummary" style={{ marginTop: '8px' }}>
                                <i className="bi bi-check-circle"></i>
                                <span>{formData.kelas_list.length} kelas dipilih: <strong>{formData.kelas_list.join(', ')}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* Judul */}
                    <div className="tcf__field">
                        <label className="tcf__label">
                            {formData.jenis === 'pengingat' ? 'Judul Pengingat' : 'Judul Tugas'} <span className="tcf__required">*</span>
                        </label>
                        <input
                            type="text"
                            className="tcf__input"
                            value={formData.judul_tugas}
                            onChange={(e) => setFormData(prev => ({ ...prev, judul_tugas: e.target.value }))}
                            placeholder={formData.jenis === 'pengingat' ? 'Contoh: UTS Matematika Kelas X IPA 1' : 'Masukkan judul tugas...'}
                        />
                    </div>

                    {/* Deskripsi */}
                    <div className="tcf__field">
                        <label className="tcf__label">Deskripsi</label>
                        <textarea
                            className="tcf__textarea"
                            value={formData.deskripsi}
                            onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
                            placeholder={formData.jenis === 'pengingat' ? 'Catatan tambahan (opsional)...' : 'Masukkan deskripsi tugas (opsional)...'}
                            rows={3}
                        />
                    </div>

                    {/* Tanggal Section */}
                    <div className="tcf__field">
                        <label className="tcf__label">
                            Tanggal <span className="tcf__required">*</span>
                        </label>
                        <DatePicker
                            className="tcf__input"
                            value={formData.tanggal_mulai}
                            valueEnd={formData.tanggal_selesai}
                            isRange={true}
                            placeholder="Pilih tanggal / rentang tanggal"
                            onChangeRange={(start, end) => {
                                setFormData(prev => ({
                                    ...prev,
                                    tanggal_mulai: start,
                                    tanggal_selesai: end,
                                    is_range: !!(start && end && start !== end)
                                }));
                            }}
                            onChange={(start) => {
                                setFormData(prev => ({
                                    ...prev,
                                    tanggal_mulai: start,
                                    tanggal_selesai: start,
                                    is_range: false
                                }));
                            }}
                        />
                    </div>

                    {/* Lampiran */}
                    <div className="tcf__field">
                        <label className="tcf__label">Lampiran</label>
                        {formData.file_url ? (
                            <div className="tcf__filePreview">
                                <div className="tcf__fileInfo">
                                    <i className="bi bi-file-earmark"></i>
                                    <span>{formData.file_name}</span>
                                </div>
                                <div className="tcf__fileActions">
                                    <button
                                        type="button"
                                        onClick={() => openFile(ensureAbsoluteUrl(formData.file_url), formData.file_name)}
                                        className="tcf__fileBtn tcf__fileBtnView"
                                        title="Lihat File"
                                    >
                                        <i className="bi bi-eye"></i>
                                    </button>
                                    <ActionButton action="delete" onClick={removeFile} />
                                </div>
                            </div>
                        ) : (
                            <label className="tcf__uploadZone">
                                <input
                                    type="file"
                                    className="tcf__fileInput"
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.rar"
                                    disabled={uploading}
                                />
                                <div className="tcf__uploadContent">
                                    {uploading ? (
                                        <>
                                            <i className="bi bi-arrow-repeat tcf__spin"></i>
                                            <span>Mengupload...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-cloud-arrow-up"></i>
                                            <span>Klik untuk upload file</span>
                                            <span className="tcf__uploadHint">PDF, DOC, JPG, PNG, ZIP (Max 10MB)</span>
                                        </>
                                    )}
                                </div>
                            </label>
                        )}
                    </div>

                    {/* Pengingat-specific fields */}
                    {formData.jenis === 'pengingat' && (
                        <div className="tcf__pengingatSection">
                            <div className="tcf__pengingatHeader">
                                <i className="bi bi-info-circle-fill"></i>
                                <span>Field khusus pengingat ujian</span>
                            </div>
                            <div className="tcf__row">
                                <div className="tcf__field">
                                    <label className="tcf__label">Ruangan</label>
                                    <input
                                        type="text"
                                        className="tcf__input"
                                        value={formData.ruangan}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ruangan: e.target.value }))}
                                        placeholder="Contoh: R301, Lab Komputer"
                                    />
                                </div>
                                <div className="tcf__field">
                                    <label className="tcf__label">Durasi</label>
                                    <input
                                        type="text"
                                        className="tcf__input"
                                        value={formData.durasi}
                                        onChange={(e) => setFormData(prev => ({ ...prev, durasi: e.target.value }))}
                                        placeholder="Contoh: 90 menit, 2 jam"
                                    />
                                </div>
                            </div>
                            <div className="tcf__field">
                                <label className="tcf__label">Sifat Ujian</label>
                                <div className="tcf__sifatUjianGrid">
                                    {['Ulangan Harian', 'UTS', 'UAS', 'Susulan', 'Lainnya'].map(s => (
                                        <label key={s} className={`tcf__sifatItem ${formData.sifat_ujian === s ? 'checked' : ''}`}>
                                            <input
                                                type="radio"
                                                name="sifat_ujian"
                                                checked={formData.sifat_ujian === s}
                                                onChange={() => setFormData(prev => ({ ...prev, sifat_ujian: s }))}
                                                className="tcf__kelasCheckbox"
                                            />
                                            <span className="tcf__kelasCheckmark">
                                                <i className="bi bi-check-lg"></i>
                                            </span>
                                            <span className="tcf__kelasLabel">{s}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="cancel" onClick={onClose} leftIcon={<i className="bi bi-x-lg" />}>
                        Batal
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleSubmit}
                        isLoading={loading}
                        leftIcon={<i className="bi bi-check-lg" />}
                    >
                        {editData
                            ? 'Simpan Perubahan'
                            : formData.jenis === 'pengingat'
                                ? 'Simpan Pengingat'
                                : 'Simpan'}
                    </Button>
                </ModalFooter>
            </Modal>

            <style jsx>{`
                .tcf__overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: auto;
                }

                .tcf__modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 95%;
                    max-width: 680px;
                    max-height: 95vh;
                    background: var(--n-card);
                    border-radius: 20px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    isolation: isolate;
                }

                .tcf__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, var(--n-primary) 0%, var(--n-primary-dark) 100%);
                    color: white;
                    flex-shrink: 0;
                }

                .tcf__title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .tcf__title i {
                    font-size: 1.1rem;
                }

                .tcf__close {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s ease;
                }

                .tcf__close:hover {
                    background: rgba(255,255,255,0.3);
                }

                .tcf__body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    position: relative;
                    z-index: 1;
                }

                .tcf__row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                }

                @media (max-width: 600px) {
                    .tcf__row {
                        grid-template-columns: 1fr;
                    }
                }

                .tcf__field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .tcf__label {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--n-ink);
                }

                .tcf__required {
                    color: #dc2626;
                }

                .tcf__hint {
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    font-style: italic;
                }

                .tcf__multiHint {
                    font-weight: 400;
                    color: var(--n-muted);
                    font-size: 0.72rem;
                }

                .tcf__kelasDropdownContainer {
                    position: relative;
                }
                .tcf__kelasDropdownBtn {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: white;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.85rem;
                }
                .tcf__kelasDropdownMenu {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 4px;
                    background: white;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    z-index: 10;
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 8px;
                }
                .tcf__kelasDropdownGrid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                @media (max-width: 600px) {
                    .tcf__kelasDropdownGrid {
                        grid-template-columns: 1fr;
                    }
                }
                .tcf__kelasDropdownItemContainer {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--n-border);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .tcf__kelasDropdownItem {
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    background: #f9f9f9;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .tcf__kelasDropdownItem:hover {
                    background: #f0f0f0;
                }
                .tcf__kelasDropdownItem.checked {
                    background: rgba(0,63,136,0.08);
                }
                .tcf__kelasCheckboxLabel {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    cursor: pointer;
                }
                .tcf__kelasCheckbox {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                .tcf__kelasInfo {
                    display: flex;
                    flex-direction: column;
                }
                .tcf__kelasLabel {
                    font-weight: 600;
                    font-size: 0.78rem;
                }
                .tcf__kelasStudentCount {
                    font-size: 0.7rem;
                    color: var(--n-muted);
                }

                .tcf__kelasSelectedSummary {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    background: rgba(16, 185, 129, 0.08);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    border-radius: 8px;
                    font-size: 0.75rem;
                    color: #059669;
                }

                .tcf__kelasSelectedSummary i {
                    font-size: 0.9rem;
                }

                .tcf__kelasSelectedSummary strong {
                    color: #059669;
                }

                /* Dark mode multi-kelas */
                :global(.dark) .tcf__kelasItem {
                    background: rgba(30,41,59,0.7);
                    border-color: rgba(255,255,255,0.1);
                }

                :global(.dark) .tcf__kelasItem:hover {
                    border-color: #60a5fa;
                    background: rgba(79,142,247,0.06);
                }

                :global(.dark) .tcf__kelasItem.checked {
                    background: rgba(79,142,247,0.12);
                    border-color: #60a5fa;
                }

                :global(.dark) .tcf__kelasCheckmark {
                    border-color: rgba(255,255,255,0.2);
                }

                :global(.dark) .tcf__kelasItem.checked .tcf__kelasCheckmark {
                    background: #60a5fa;
                    border-color: #60a5fa;
                }

                :global(.dark) .tcf__kelasLabel {
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__kelasItem.checked .tcf__kelasLabel {
                    color: #60a5fa;
                }

                :global(.dark) .tcf__kelasSelectedSummary {
                    background: rgba(52,211,153,0.1);
                    border-color: rgba(52,211,153,0.25);
                    color: #34d399;
                }

                :global(.dark) .tcf__kelasSelectedSummary strong {
                    color: #34d399;
                }

                /* Dropdown pilih kelas — latarnya dulu putih polos, jadi kontainer
                   ini tetap terang di dark mode. */
                :global(.dark) .tcf__kelasDropdownBtn {
                    background: rgba(30,41,59,0.9);
                    border-color: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__kelasDropdownMenu {
                    background: #1a2235;
                    border-color: rgba(255,255,255,0.1);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.45);
                }

                :global(.dark) .tcf__kelasDropdownItemContainer {
                    border-color: rgba(255,255,255,0.1);
                }

                :global(.dark) .tcf__kelasDropdownItem {
                    background: rgba(255,255,255,0.04);
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__kelasDropdownItem:hover {
                    background: rgba(255,255,255,0.08);
                }

                :global(.dark) .tcf__kelasDropdownItem.checked {
                    background: rgba(79,142,247,0.16);
                }

                .tcf__input {
                    padding: 8px 12px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.82rem;
                    background: rgba(255,255,255,0.9);
                    color: var(--n-ink);
                    transition: all 0.2s ease;
                }

                .tcf__input:focus {
                    outline: none;
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0,63,136,0.1);
                }

                .tcf__textarea {
                    padding: 8px 12px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    font-size: 0.82rem;
                    background: rgba(255,255,255,0.9);
                    color: var(--n-ink);
                    resize: vertical;
                    min-height: 64px;
                    font-family: inherit;
                }

                .tcf__textarea:focus {
                    outline: none;
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0,63,136,0.1);
                }

                .tcf__dateSection {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .tcf__dateToggle {
                    display: flex;
                    gap: 8px;
                }

                .tcf__toggleBtn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border: 2px solid var(--n-border);
                    border-radius: 10px;
                    background: var(--n-card);
                    color: var(--n-muted);
                    font-size: 0.78rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tcf__toggleBtn:hover {
                    border-color: var(--n-primary);
                    color: var(--n-primary);
                }

                .tcf__toggleBtn.active {
                    background: rgba(0,63,136,0.08);
                    border-color: var(--n-primary);
                    color: var(--n-primary);
                }

                .tcf__dateInputs {
                    display: flex;
                    gap: 10px;
                }

                .tcf__dateInputGroup {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }

                .tcf__dateLabel {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    font-weight: 500;
                }

                .tcf__dateSummary {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    font-size: 0.75rem;
                    color: #3083FF;
                }

                .tcf__uploadZone {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                    border: 2px dashed var(--n-border);
                    border-radius: 10px;
                    background: rgba(0,63,136,0.03);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tcf__uploadZone:hover {
                    border-color: var(--n-primary);
                    background: rgba(0,63,136,0.06);
                }

                .tcf__fileInput {
                    display: none;
                }

                .tcf__uploadContent {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    text-align: center;
                }

                .tcf__uploadContent i {
                    font-size: 1.6rem;
                    color: var(--n-primary);
                }

                .tcf__uploadContent span {
                    font-size: 0.8rem;
                    color: var(--n-ink);
                    font-weight: 500;
                }

                .tcf__uploadHint {
                    font-size: 0.72rem !important;
                    color: var(--n-muted) !important;
                    font-weight: 400 !important;
                }

                .tcf__spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .tcf__filePreview {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    background: rgba(59, 130, 246, 0.08);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 10px;
                }

                .tcf__fileInfo {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--n-primary);
                }

                .tcf__fileInfo span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .tcf__fileActions {
                    display: flex;
                    gap: 4px;
                    flex-shrink: 0;
                }

                .tcf__fileBtn {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                }

                .tcf__fileBtnView {
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--n-primary);
                }

                .tcf__fileBtnView:hover {
                    background: rgba(59, 130, 246, 0.2);
                }

                .tcf__fileBtnRemove {
                    background: rgba(239, 68, 68, 0.1);
                    color: #dc2626;
                }

                .tcf__fileBtnRemove:hover {
                    background: rgba(239, 68, 68, 0.2);
                }

                .tcf__footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 20px;
                    background: linear-gradient(180deg, rgba(0,63,136,0.03) 0%, rgba(0,63,136,0.06) 100%);
                    border-top: 1px solid var(--n-border);
                    flex-shrink: 0;
                }

                .tcf__btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tcf__btnCancel {
                    background: rgba(100, 116, 139, 0.1);
                    color: var(--n-muted);
                }

                .tcf__btnCancel:hover {
                    background: rgba(100, 116, 139, 0.2);
                }

                .tcf__btnSubmit {
                    background: var(--n-primary);
                    color: white;
                }

                .tcf__btnSubmit:hover:not(:disabled) {
                    background: var(--n-primary-dark);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,63,136,0.3);
                }

                .tcf__btnSubmit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @media (max-width: 480px) {
                    .tcf__modal {
                        width: 98%;
                        max-height: 95vh;
                        border-radius: 16px;
                    }

                    .tcf__header {
                        padding: 14px 16px;
                    }

                    .tcf__body {
                        padding: 14px;
                        gap: 12px;
                    }

                    .tcf__footer {
                        padding: 14px;
                    }

                    .tcf__dateInputs {
                        flex-direction: column;
                    }
                }

                .tcf__field--jenis {
                    margin-top: -4px;
                }

                .tcf__jenisDropdown {
                    position: relative;
                }

                .tcf__jenisDropdownBtn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 14px;
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    background: rgba(255,255,255,0.9);
                    color: var(--n-ink);
                    font-size: 0.82rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                }

                .tcf__jenisDropdownBtn:hover {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 3px rgba(0,63,136,0.08);
                }

                .tcf__jenisDropdownBtn i:first-child {
                    color: var(--n-primary);
                    font-size: 1rem;
                }

                .tcf__chevron {
                    margin-left: auto;
                    font-size: 0.75rem;
                    color: var(--n-muted);
                    transition: transform 0.2s ease;
                }

                .tcf__jenisSelect {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: pointer;
                    z-index: 2;
                }

                .tcf__pengingatSection {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 14px;
                    background: rgba(251,191,36,0.05);
                    border: 1px solid rgba(251,191,36,0.2);
                    border-radius: 12px;
                }

                .tcf__pengingatHeader {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: #d97706;
                }

                .tcf__pengingatHeader i {
                    font-size: 1rem;
                }

                .tcf__sifatUjianGrid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .tcf__sifatItem {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 6px 12px;
                    border: 2px solid var(--n-border);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 0.78rem;
                    font-weight: 500;
                    background: rgba(255,255,255,0.8);
                    user-select: none;
                }

                .tcf__sifatItem:hover {
                    border-color: var(--n-primary);
                    background: rgba(0,63,136,0.04);
                }

                .tcf__sifatItem.checked {
                    background: rgba(251,191,36,0.1);
                    border-color: #d97706;
                    color: #d97706;
                }

                .tcf__sifatItem .tcf__kelasCheckbox {
                    display: none;
                }

                .tcf__sifatItem .tcf__kelasCheckmark {
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--n-border);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.65rem;
                    color: transparent;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }

                .tcf__sifatItem.checked .tcf__kelasCheckmark {
                    background: #d97706;
                    border-color: #d97706;
                    color: white;
                }

                .tcf__sifatItem .tcf__kelasLabel {
                    color: var(--n-ink);
                }

                .tcf__sifatItem.checked .tcf__kelasLabel {
                    color: #d97706;
                    font-weight: 600;
                }

                .tcf__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, var(--n-primary) 0%, var(--n-primary-dark) 100%);
                    color: white;
                    flex-shrink: 0;
                    transition: background 0.3s ease;
                }

                .tcf__header[data-jenis="pengingat"] {
                    background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
                }

                :global(.dark) .tcf__modal {
                    background: #1a2235;
                }

                :global(.dark) .tcf__body {
                    background: #1a2235;
                }

                :global(.dark) .tcf__input,
                :global(.dark) .tcf__textarea {
                    background: rgba(30,41,59,0.9);
                    border-color: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__input:focus,
                :global(.dark) .tcf__textarea:focus {
                    border-color: var(--n-primary);
                    box-shadow: 0 0 0 4px rgba(79,142,247,0.15);
                }

                :global(.dark) .tcf__label {
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__toggleBtn {
                    background: rgba(30,41,59,0.9);
                    border-color: rgba(255,255,255,0.1);
                    color: var(--n-muted);
                }

                :global(.dark) .tcf__toggleBtn.active {
                    background: rgba(79,142,247,0.12);
                    border-color: var(--n-primary);
                    color: #60a5fa;
                }

                :global(.dark) .tcf__uploadZone {
                    background: rgba(30,41,59,0.5);
                    border-color: rgba(255,255,255,0.1);
                }

                :global(.dark) .tcf__uploadContent i {
                    color: #60a5fa;
                }

                :global(.dark) .tcf__uploadContent span {
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__footer {
                    background: linear-gradient(180deg, rgba(79,142,247,0.06) 0%, rgba(79,142,247,0.1) 100%);
                    border-top-color: rgba(255,255,255,0.08);
                }

                :global(.dark) .tcf__btnCancel {
                    background: rgba(100,116,139,0.15);
                    color: var(--n-muted);
                }

                :global(.dark) .tcf__btnCancel:hover {
                    background: rgba(100,116,139,0.25);
                }

                :global(.dark) .tcf__filePreview {
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.25);
                }

                :global(.dark) .tcf__fileInfo {
                    color: #60a5fa;
                }

                :global(.dark) .tcf__dateSummary {
                    background: rgba(167, 139, 250, 0.15);
                    border-color: rgba(167, 139, 250, 0.25);
                    color: #60a5fa;
                }

                :global(.dark) .tcf__jenisDropdownBtn {
                    background: rgba(30,41,59,0.9);
                    border-color: rgba(255,255,255,0.1);
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__jenisDropdownBtn:hover {
                    border-color: #60a5fa;
                    box-shadow: 0 0 0 3px rgba(79,142,247,0.1);
                }

                :global(.dark) .tcf__jenisDropdownBtn i:first-child {
                    color: #60a5fa;
                }

                :global(.dark) .tcf__chevron {
                    color: var(--n-muted);
                }

                :global(.dark) .tcf__pengingatSection {
                    background: rgba(251,191,36,0.05);
                    border-color: rgba(251,191,36,0.2);
                }

                :global(.dark) .tcf__pengingatHeader {
                    color: #fbbf24;
                }

                :global(.dark) .tcf__sifatItem {
                    background: rgba(30,41,59,0.7);
                    border-color: rgba(255,255,255,0.1);
                }

                :global(.dark) .tcf__sifatItem:hover {
                    border-color: #60a5fa;
                    background: rgba(79,142,247,0.06);
                }

                :global(.dark) .tcf__sifatItem.checked {
                    background: rgba(251,191,36,0.12);
                    border-color: #fbbf24;
                    color: #fbbf24;
                }

                :global(.dark) .tcf__sifatItem.checked .tcf__kelasCheckmark {
                    background: #fbbf24;
                    border-color: #fbbf24;
                }

                :global(.dark) .tcf__sifatItem .tcf__kelasLabel {
                    color: #e2e8f0;
                }

                :global(.dark) .tcf__sifatItem.checked .tcf__kelasLabel {
                    color: #fbbf24;
                }

                :global(.dark) .tcf__header[data-jenis="pengingat"] {
                    background: linear-gradient(135deg, #78350f 0%, #b45309 100%);
                }

                :global(.dark) .tcf__modal {
                    background: #1a2235;
                }

                .tcf__kelasStudentsList {
                    padding: 12px;
                    background: rgba(0,0,0,0.02);
                    border-bottom-left-radius: 10px;
                    border-bottom-right-radius: 10px;
                }

                :global(.dark) .tcf__kelasStudentsList {
                    background: rgba(0,0,0,0.2);
                }

                .tcf__studentCheckboxes {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding-left: 4px;
                    padding-top: 4px;
                }

                .tcf__studentCheckboxLabel {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    user-select: none;
                }

                /* -- Dark Mode -- */
                :global(.dark) .tcf__modal { background: var(--n-card) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 20px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important; }
                :global(.dark) .tcf__header { background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important; border-bottom: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .tcf__title { color: #ffffff !important; }
                :global(.dark) .tcf__close { color: #94a3b8 !important; }
                :global(.dark) .tcf__close:hover { background: rgba(26, 115, 232, 0.15) !important; color: #ffffff !important; }
                :global(.dark) .tcf__body { background: var(--n-card) !important; }
                :global(.dark) .tcf__footer { background: var(--n-card) !important; border-top: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .tcf__label, :global(.dark) .tcf__dateLabel, :global(.dark) .tcf__hint, :global(.dark) .tcf__multiHint, :global(.dark) .tcf__uploadHint, :global(.dark) .tcf__kelasInfo { color: #94a3b8 !important; }
                :global(.dark) .tcf__input, :global(.dark) .tcf__textarea, :global(.dark) .tcf__jenisSelect, :global(.dark) .ss__trigger { background: var(--n-surface-2, #162a4d) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #ffffff !important; color-scheme: dark; }
                :global(.dark) .dpk-root.tcf__input, :global(.dark) .tcf__dateSection, :global(.dark) .tcf__dateToggle, :global(.dark) .tcf__jenisDropdown, :global(.dark) .tcf__kelasDropdownContainer { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
                :global(.dark) .tcf__input:focus, :global(.dark) .tcf__textarea:focus, :global(.dark) .tcf__jenisSelect:focus, :global(.dark) .ss__trigger:focus { border-color: #60a5fa !important; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2) !important; }
                :global(.dark) .tcf__input::placeholder, :global(.dark) .tcf__textarea::placeholder { color: #64748b !important; }
                :global(.dark) .tcf__jenisDropdownBtn, :global(.dark) .tcf__kelasDropdownBtn, :global(.dark) .tcf__toggleBtn { background: var(--n-surface-2, #162a4d) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #ffffff !important; }
                :global(.dark) .tcf__toggleBtn.active { background: rgba(26, 115, 232, 0.25) !important; border-color: #3b82f6 !important; color: #60a5fa !important; }
                :global(.dark) .tcf__kelasDropdownMenu { background: var(--n-card) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 16px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important; }
                :global(.dark) .tcf__kelasDropdownItem, :global(.dark) .tcf__kelasItem, :global(.dark) .tcf__sifatItem { color: #ffffff !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .tcf__kelasDropdownItem:hover, :global(.dark) .tcf__kelasItem:hover, :global(.dark) .tcf__sifatItem:hover { background: rgba(26, 115, 232, 0.08) !important; }
                :global(.dark) .tcf__kelasLabel, :global(.dark) .tcf__kelasCheckboxLabel, :global(.dark) .tcf__studentCheckboxLabel { color: #ffffff !important; }
                :global(.dark) .tcf__kelasStudentCount, :global(.dark) .tcf__kelasSelectedSummary, :global(.dark) .tcf__dateSummary { background: rgba(96, 165, 250, 0.15) !important; color: #60a5fa !important; }
                :global(.dark) .tcf__chevron { color: #60a5fa !important; }
                :global(.dark) .tcf__required { color: #f87171 !important; }
                :global(.dark) .tcf__uploadZone { background: var(--n-card) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; }
                :global(.dark) .tcf__uploadZone:hover { background: rgba(96, 165, 250, 0.15) !important; border-color: #60a5fa !important; }
                :global(.dark) .tcf__uploadContent i { color: #60a5fa !important; }
                :global(.dark) .tcf__filePreview, :global(.dark) .tcf__fileInfo { background: var(--n-card) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; color: #ffffff !important; }
                :global(.dark) .tcf__fileBtnView { color: #60a5fa !important; }
                :global(.dark) .tcf__fileBtnRemove { color: #f87171 !important; }
                :global(.dark) .tcf__pengingatSection { background: var(--n-card) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; border-radius: 12px !important; }
                :global(.dark) .tcf__pengingatHeader { color: #ffffff !important; }
                :global(.dark) .tcf__btnCancel { background: var(--n-card) !important; border: 1px solid rgba(26, 115, 232, 0.35) !important; color: #94a3b8 !important; }
                :global(.dark) .tcf__btnCancel:hover { background: rgba(26, 115, 232, 0.12) !important; color: #ffffff !important; }
            `}</style>

            {viewer}
        </>
    );
}