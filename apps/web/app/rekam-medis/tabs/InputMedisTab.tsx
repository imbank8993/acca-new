'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import DatePicker from '@/components/ui/DatePicker';
import { useTimezone } from '@/hooks/use-timezone';
import Spinner from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { TindakLanjutMappingItem } from './KonfigurasiMedisTab';

export interface StudentSearchResult {
    nisn: string;
    nama_siswa: string;
    kelas: string;
    guru_asuh: string;
    gender: string;
    tempat_lahir: string;
    tanggal_lahir: string | null;
    alamat: string;
}

interface RekamMedisRow {
    id: string;
    no_rekam_medis: string;
    nisn: string;
    nama_siswa: string;
    kelas: string;
    guru_asuh: string;
    gender: string;
    tempat_lahir: string;
    tanggal_lahir: string | null;
    alamat: string;
    tanggal: string;
    waktu: string;
    riwayat_penyakit: string[];
    riwayat_alergi_obat: string[];
    keluhan: string;
    tata_laksana: string;
    tindakan: string[];
    tindak_lanjut: string;
    petugas_nama: string;
    petugas_nip: string | null;
    created_at: string;
    is_synced?: boolean;
    synced_status?: string | null;
}

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MultiSelectCheckboxDropdownProps {
    title: string;
    options: string[];
    currentText: string;
    onTextChange: (newText: string) => void;
    accentColor?: string;
    singleSelect?: boolean;
}

export function MultiSelectCheckboxDropdown({
    title,
    options,
    currentText,
    onTextChange,
    accentColor = 'var(--kh-accent)',
    singleSelect = false
}: MultiSelectCheckboxDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isSelected = (item: string) => {
        if (!currentText.trim()) return false;
        if (singleSelect) {
            return currentText.trim().toLowerCase() === item.trim().toLowerCase();
        }
        return currentText.toLowerCase().includes(item.toLowerCase());
    };

    const countSelected = options.filter(isSelected).length;

    const handleToggle = (item: string) => {
        if (singleSelect) {
            onTextChange(item);
            setIsOpen(false);
            return;
        }

        const trimmed = currentText.trim();
        if (isSelected(item)) {
            const regex = new RegExp(`(^|,\\s*)${escapeRegExp(item)}(,\\s*|$)`, 'gi');
            let updated = trimmed.replace(regex, (match, p1, p2) => {
                if (p1 && p2 && p1.includes(',') && p2.includes(',')) return ', ';
                return '';
            }).trim();

            updated = updated.replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
            onTextChange(updated);
        } else {
            if (!trimmed || trimmed === 'Tidak Ada Riwayat Penyakit' || trimmed === 'Tidak Ada Alergi Obat') {
                onTextChange(item);
            } else {
                onTextChange(`${trimmed}, ${item}`);
            }
        }
    };

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(filterQuery.toLowerCase())
    );

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                className="kh-pill-select"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer',
                    background: isOpen ? 'var(--kh-glow)' : 'var(--n-card)',
                    border: isOpen ? `1px solid ${accentColor}` : '1px solid var(--kh-tb-border)',
                    borderRadius: '20px', height: '36px'
                }}
            >
                <i className={singleSelect ? "bi bi-record-circle-fill" : "bi bi-ui-checks"} style={{ color: accentColor }}></i>
                <span>{title}</span>
                <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '0.75rem', marginLeft: '2px' }}></i>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                    width: '300px', maxHeight: '340px', background: 'var(--n-card)',
                    border: '1px solid var(--kh-tb-border)', borderRadius: '14px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.18)', zIndex: 999,
                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--kh-tb-border)', background: 'var(--kh-tb-stripe)' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                className="kh-pill-input"
                                placeholder="Cari data..."
                                value={filterQuery}
                                onChange={e => setFilterQuery(e.target.value)}
                                style={{ fontSize: '0.8rem', padding: '4px 10px 4px 28px', height: '32px' }}
                            />
                            <i className="bi bi-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--kh-text-muted)' }}></i>
                        </div>
                    </div>

                    <div style={{ padding: '6px', overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '14px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--kh-text-muted)' }}>
                                Opsi tidak ditemukan
                            </div>
                        ) : (
                            filteredOptions.map(opt => {
                                const checked = isSelected(opt);
                                return (
                                    <div
                                        key={opt}
                                        onClick={(e) => { e.stopPropagation(); handleToggle(opt); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '0.82rem', color: 'var(--kh-text-primary)',
                                            background: checked ? 'var(--kh-glow)' : 'transparent',
                                            userSelect: 'none', transition: 'background 0.15s',
                                            marginBottom: '2px'
                                        }}
                                        className="kh-dropdown-item"
                                    >
                                        <input
                                            type={singleSelect ? "radio" : "checkbox"}
                                            checked={checked}
                                            readOnly
                                            style={{ width: '16px', height: '16px', accentColor: accentColor, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: checked ? 700 : 400, flex: 1 }}>{opt}</span>
                                        {checked && <i className="bi bi-check-lg" style={{ color: accentColor, fontWeight: 'bold' }}></i>}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div style={{
                        padding: '8px 12px', borderTop: '1px solid var(--kh-tb-border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.75rem', background: 'var(--kh-tb-stripe)'
                    }}>
                        <span style={{ color: 'var(--kh-text-secondary)' }}>
                            {singleSelect ? (
                                <span>Status: <b style={{ color: accentColor }}>{countSelected > 0 ? '1 Terpilih' : 'Belum Dipilih'}</b></span>
                            ) : (
                                <span>Centang: <b style={{ color: accentColor }}>{countSelected}</b> / {options.length}</span>
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="btn-kh-navy"
                            style={{ minHeight: '28px', padding: '2px 12px', fontSize: '0.75rem', width: 'auto' }}
                        >
                            Selesai
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface InputMedisTabProps {
    presetPenyakit: string[];
    presetAlergi: string[];
    presetKeluhan: string[];
    presetTataLaksana: string[];
    presetTindakan: string[];
    presetTindakLanjut: string[];
    tindakLanjutMapping: TindakLanjutMappingItem[];
    petugasNama: string;
    petugasNip: string | null;
    onSuccessSubmit: () => void;
}

export default function InputMedisTab({
    presetPenyakit,
    presetAlergi,
    presetKeluhan,
    presetTataLaksana,
    presetTindakan,
    presetTindakLanjut,
    tindakLanjutMapping,
    petugasNama,
    petugasNip,
    onSuccessSubmit
}: InputMedisTabProps) {
    const { getCurrentDate, formatDate: tzFormatDate } = useTimezone();

    const [studentQuery, setStudentQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
    const [studentHistory, setStudentHistory] = useState<RekamMedisRow[]>([]);
    const [loadingStudentHistory, setLoadingStudentHistory] = useState(false);

    const [noRekamMedis, setNoRekamMedis] = useState('');
    const [tanggal, setTanggal] = useState(getCurrentDate());
    const [waktu, setWaktu] = useState(new Date().toTimeString().slice(0, 5));

    const [riwayatPenyakitText, setRiwayatPenyakitText] = useState('');
    const [riwayatAlergiText, setRiwayatAlergiText] = useState('');
    const [keluhanText, setKeluhanText] = useState('');
    const [tataLaksanaText, setTataLaksanaText] = useState('');
    const [tindakanText, setTindakanText] = useState('');
    const [tindakLanjutText, setTindakLanjutText] = useState('Kembali ke Kelas');

    const [autoSyncKetidakhadiran, setAutoSyncKetidakhadiran] = useState(true);
    const [tglSelesaiSakit, setTglSelesaiSakit] = useState(getCurrentDate());
    const [waktuSelesaiUks, setWaktuSelesaiUks] = useState('12:00');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);
    const riwayatPenyakitRef = useRef<HTMLTextAreaElement | null>(null);
    const riwayatAlergiRef = useRef<HTMLTextAreaElement | null>(null);
    const keluhanRef = useRef<HTMLTextAreaElement | null>(null);
    const tataLaksanaRef = useRef<HTMLTextAreaElement | null>(null);
    const tindakanRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, 58)}px`;
    };

    useEffect(() => {
        [riwayatPenyakitRef, riwayatAlergiRef, keluhanRef, tataLaksanaRef, tindakanRef].forEach(ref => {
            adjustTextareaHeight(ref.current);
        });
    }, [riwayatPenyakitText, riwayatAlergiText, keluhanText, tataLaksanaText, tindakanText]);

    useEffect(() => {
        setTglSelesaiSakit(tanggal);
    }, [tanggal]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowStudentDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Student search debounced effect
    useEffect(() => {
        const trimmed = studentQuery.trim();
        if (!trimmed || (selectedStudent && `${selectedStudent.nama_siswa} (${selectedStudent.nisn})` === studentQuery)) {
            setSearchResults([]);
            setShowStudentDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingStudent(true);
            try {
                const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?action=search_siswa&q=${encodeURIComponent(trimmed)}`);
                const json = await res.json();
                if (json.ok && Array.isArray(json.data)) {
                    setSearchResults(json.data);
                    setShowStudentDropdown(true);
                }
            } catch (e) {
                console.error('Search student error:', e);
            } finally {
                setIsSearchingStudent(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [studentQuery, selectedStudent]);

    const loadStudentHistory = async (student: StudentSearchResult) => {
        setLoadingStudentHistory(true);
        setRiwayatPenyakitText('');
        setRiwayatAlergiText('');
        try {
            const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?nisn=${student.nisn}&limit=5`);
            const json = await res.json();
            if (json.ok && Array.isArray(json.data)) {
                setStudentHistory(json.data);
                if (json.data.length > 0) {
                    const latest = json.data[0];
                    if (Array.isArray(latest.riwayat_penyakit) && latest.riwayat_penyakit.length > 0) {
                        setRiwayatPenyakitText(latest.riwayat_penyakit.join(', '));
                    }
                    if (Array.isArray(latest.riwayat_alergi_obat) && latest.riwayat_alergi_obat.length > 0) {
                        setRiwayatAlergiText(latest.riwayat_alergi_obat.join(', '));
                    }
                }
            }
        } catch (e) {
            console.error('Load student history error:', e);
        } finally {
            setLoadingStudentHistory(false);
        }
    };

    const generateNoRM = (student: StudentSearchResult) => {
        const nisnPart = student.nisn || '0000';
        const rnd = Math.floor(1000 + Math.random() * 9000);
        setNoRekamMedis(`RM-${nisnPart}-${rnd}`);
    };

    const handleSelectStudent = (student: StudentSearchResult) => {
        setSelectedStudent(student);
        setStudentQuery(`${student.nama_siswa} (${student.nisn})`);
        setShowStudentDropdown(false);
        generateNoRM(student);
        loadStudentHistory(student);
    };

    const resetForm = () => {
        setSelectedStudent(null);
        setStudentQuery('');
        setSearchResults([]);
        setStudentHistory([]);
        setNoRekamMedis('');
        setTanggal(getCurrentDate());
        setWaktu(new Date().toTimeString().slice(0, 5));
        setRiwayatPenyakitText('');
        setRiwayatAlergiText('');
        setKeluhanText('');
        setTataLaksanaText('');
        setTindakanText('');
        setTindakLanjutText('Kembali ke Kelas');
        setTglSelesaiSakit(getCurrentDate());
        setWaktuSelesaiUks('12:00');
    };

    const currentMappedStatus = useMemo(() => {
        if (!tindakLanjutText) return 'Ringan';
        const found = tindakLanjutMapping.find(m => m.name.toLowerCase() === tindakLanjutText.trim().toLowerCase());
        return found ? found.status : 'Ringan';
    }, [tindakLanjutText, tindakLanjutMapping]);

    const calculateTotalDays = (startDateStr: string, endDateStr: string) => {
        if (!startDateStr || !endDateStr) return 1;
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 1;
    };

    const setDaysDuration = (numDays: number) => {
        if (!tanggal) return;
        const base = new Date(tanggal);
        if (isNaN(base.getTime())) return;
        base.setDate(base.getDate() + (numDays - 1));
        const year = base.getFullYear();
        const month = String(base.getMonth() + 1).padStart(2, '0');
        const day = String(base.getDate()).padStart(2, '0');
        setTglSelesaiSakit(`${year}-${month}-${day}`);
    };

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) {
            Swal.fire({ icon: 'warning', title: 'Pilih Siswa', text: 'Silakan cari dan pilih siswa terlebih dahulu.' });
            return;
        }
        if (!keluhanText.trim()) {
            Swal.fire({ icon: 'warning', title: 'Keluhan Wajib Diisi', text: 'Silakan ketik atau pilih keluhan sakit siswa.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                no_rekam_medis: noRekamMedis || `RM-${selectedStudent.nisn}-${Math.floor(1000 + Math.random() * 9000)}`,
                nisn: selectedStudent.nisn,
                nama_siswa: selectedStudent.nama_siswa,
                kelas: selectedStudent.kelas,
                guru_asuh: selectedStudent.guru_asuh,
                gender: selectedStudent.gender,
                tempat_lahir: selectedStudent.tempat_lahir,
                tanggal_lahir: selectedStudent.tanggal_lahir,
                alamat: selectedStudent.alamat,
                tanggal,
                waktu,
                riwayat_penyakit: riwayatPenyakitText.split(',').map(s => s.trim()).filter(Boolean),
                riwayat_alergi_obat: riwayatAlergiText.split(',').map(s => s.trim()).filter(Boolean),
                keluhan: keluhanText,
                tata_laksana: tataLaksanaText,
                tindakan: tindakanText.split(',').map(s => s.trim()).filter(Boolean),
                tindak_lanjut: tindakLanjutText,
                petugas_nama: petugasNama,
                petugas_nip: petugasNip,
                auto_sync_ketidakhadiran: autoSyncKetidakhadiran && currentMappedStatus !== 'NONE',
                mapped_status: currentMappedStatus,
                tgl_selesai_sakit: tglSelesaiSakit,
                waktu_selesai_uks: waktuSelesaiUks
            };

            const res = await fetch('/api/ketidakhadiran/rekam-medis-siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil Disimpan',
                    text: currentMappedStatus !== 'NONE' && autoSyncKetidakhadiran
                        ? `Rekam medis berhasil disimpan dan otomatis disinkronkan ke modul Ketidakhadiran (Sakit ${currentMappedStatus}).`
                        : 'Rekam medis berhasil disimpan.',
                    timer: 2000,
                    showConfirmButton: false
                });
                resetForm();
                onSuccessSubmit();
            } else {
                throw new Error(json.error || 'Gagal menyimpan rekam medis');
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Simpan', text: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="kh-filter-card animate-fade-in" style={{ padding: '24px' }}>
            <form onSubmit={handleSubmitForm}>
                {/* SECTION: CARI SISWA */}
                <div style={{ marginBottom: '20px' }}>
                    <label className="kh-filter-label" style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--kh-text-primary)' }}>
                        <i className="bi bi-person-bounding-box" style={{ color: 'var(--kh-accent)', marginRight: '6px' }}></i>
                        Pilih Siswa <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div ref={searchRef} style={{ position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                className="kh-pill-input"
                                placeholder="Cari berdasarkan Nama Siswa, NISN, atau Nama Kelas (misal: XI A, Khair, 0092)..."
                                value={studentQuery}
                                onChange={e => {
                                    const val = e.target.value;
                                    setStudentQuery(val);
                                    if (selectedStudent && val !== `${selectedStudent.nama_siswa} (${selectedStudent.nisn})`) {
                                        setSelectedStudent(null);
                                    }
                                }}
                                onFocus={() => { if (searchResults.length > 0) setShowStudentDropdown(true); }}
                                style={{ paddingLeft: '38px' }}
                            />
                            <i className="bi bi-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--kh-text-muted)' }}></i>
                            {isSearchingStudent && (
                                <div style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: 'var(--n-card, #ffffff)',
                                    border: '1.5px solid var(--kh-accent)', borderRadius: '20px',
                                    padding: '3px 10px', boxShadow: '0 2px 8px rgba(0, 56, 168, 0.15)',
                                    pointerEvents: 'none', zIndex: 10
                                }}>
                                    <Spinner variant="trace" size={24} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--kh-accent)', letterSpacing: '0.02em' }}>
                                        Mencari siswa...
                                    </span>
                                </div>
                            )}
                        </div>

                        {showStudentDropdown && searchResults.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: 'var(--n-card, #fff)', border: '1px solid var(--kh-tb-border)',
                                borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                zIndex: 99, maxHeight: '280px', overflowY: 'auto', marginTop: '4px'
                            }}>
                                {searchResults.map(s => (
                                    <div
                                        key={s.nisn}
                                        onClick={() => handleSelectStudent(s)}
                                        style={{
                                            padding: '12px 16px', borderBottom: '1px solid var(--kh-tb-border)',
                                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                        className="kh-dropdown-item"
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--kh-text-primary)' }}>{s.nama_siswa}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--kh-text-secondary)' }}>
                                                NISN: <code>{s.nisn}</code> | Kelas Reguler: <b>{s.kelas}</b> | Guru Asuh: <b>{s.guru_asuh}</b>
                                            </div>
                                        </div>
                                        <span className="surat-badge" style={{
                                            background: (s.gender === 'L' || String(s.gender).toUpperCase().startsWith('L')) ? 'rgba(0,56,168,0.1)' : 'rgba(220,38,38,0.1)',
                                            color: (s.gender === 'L' || String(s.gender).toUpperCase().startsWith('L')) ? 'var(--kh-accent)' : '#dc2626'
                                        }}>
                                            {(s.gender === 'L' || String(s.gender).toUpperCase().startsWith('L')) ? 'Laki-laki' : (s.gender === 'P' || String(s.gender).toUpperCase().startsWith('P')) ? 'Perempuan' : (s.gender || '-')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* STUDENT PROFILE CARD */}
                {selectedStudent && (
                    <div style={{
                        background: 'var(--n-card)',
                        border: '1px solid var(--kh-tb-border)',
                        borderRadius: '16px',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
                        marginBottom: '24px',
                        overflow: 'hidden'
                    }}>
                        <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--kh-accent) 0%, #2563eb 50%, #3b82f6 100%)' }}></div>
                        <div style={{ padding: '18px 22px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px', borderBottom: '1px solid var(--kh-tb-border)', paddingBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '14px',
                                        background: 'linear-gradient(135deg, var(--kh-accent) 0%, #2563eb 100%)',
                                        color: '#ffffff', fontWeight: 800, fontSize: '1.25rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(0, 56, 168, 0.2)', flexShrink: 0
                                    }}>
                                        {(selectedStudent.nama_siswa || 'S').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--kh-text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            {selectedStudent.nama_siswa}
                                            <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px' }}>
                                                Kelas {selectedStudent.kelas || '-'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--kh-text-secondary)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            <span>NISN: <code style={{ fontWeight: 700, color: 'var(--kh-accent)' }}>{selectedStudent.nisn}</code></span>
                                            {selectedStudent.guru_asuh && selectedStudent.guru_asuh !== '-' && (
                                                <span>Guru Asuh: <b>{selectedStudent.guru_asuh}</b></span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    variant="reset"
                                    size="sm"
                                    onClick={resetForm}
                                    leftIcon={<i className="bi bi-arrow-counterclockwise" />}
                                >
                                    Ganti Siswa
                                </Button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.83rem', color: 'var(--kh-text-primary)' }}>
                                <div style={{ background: 'var(--kh-tb-stripe)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--kh-tb-border)' }}>
                                    <div style={{ color: 'var(--kh-text-secondary)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                                        <i className="bi bi-gender-ambiguous" style={{ marginRight: '4px', color: 'var(--kh-accent)' }}></i> Jenis Kelamin
                                    </div>
                                    <div style={{ fontWeight: 700 }}>
                                        {(selectedStudent.gender === 'L' || String(selectedStudent.gender).toUpperCase().startsWith('L')) ? 'Laki-laki' : (selectedStudent.gender === 'P' || String(selectedStudent.gender).toUpperCase().startsWith('P')) ? 'Perempuan' : (selectedStudent.gender || '-')}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--kh-tb-stripe)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--kh-tb-border)' }}>
                                    <div style={{ color: 'var(--kh-text-secondary)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                                        <i className="bi bi-calendar-event" style={{ marginRight: '4px', color: '#059669' }}></i> Tempat, Tgl Lahir
                                    </div>
                                    <div style={{ fontWeight: 700 }}>
                                        {selectedStudent.tempat_lahir && selectedStudent.tempat_lahir !== '-' ? selectedStudent.tempat_lahir : ''}
                                        {selectedStudent.tanggal_lahir ? (selectedStudent.tempat_lahir && selectedStudent.tempat_lahir !== '-' ? `, ${tzFormatDate(selectedStudent.tanggal_lahir)}` : tzFormatDate(selectedStudent.tanggal_lahir)) : (!selectedStudent.tempat_lahir || selectedStudent.tempat_lahir === '-' ? '-' : '')}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--kh-tb-stripe)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--kh-tb-border)', gridColumn: 'span 2' }}>
                                    <div style={{ color: 'var(--kh-text-secondary)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                                        <i className="bi bi-geo-alt-fill" style={{ marginRight: '4px', color: '#dc2626' }}></i> Alamat Siswa
                                    </div>
                                    <div style={{ fontWeight: 600 }}>
                                        {selectedStudent.alamat && selectedStudent.alamat !== '-' ? selectedStudent.alamat : '-'}
                                    </div>
                                </div>
                            </div>

                            {studentHistory.length > 0 && (
                                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--kh-tb-border)' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--kh-accent)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                        <i className="bi bi-clock-history" style={{ fontSize: '0.95rem' }}></i> Riwayat Kunjungan UKS Sebelumnya
                                        <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.72rem', padding: '2px 8px' }}>
                                            {studentHistory.length} Catatan
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                                        {studentHistory.map(h => (
                                            <div key={h.id} style={{
                                                background: 'var(--kh-tb-stripe)', border: '1px solid var(--kh-tb-border)',
                                                borderRadius: '12px', padding: '10px 14px', fontSize: '0.78rem', minWidth: '220px', flexShrink: 0
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 800, color: 'var(--kh-accent)', fontSize: '0.78rem' }}>{h.no_rekam_medis}</span>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--kh-text-secondary)' }}><i className="bi bi-clock"></i> {h.waktu?.slice(0,5)}</span>
                                                </div>
                                                <div style={{ fontSize: '0.73rem', color: 'var(--kh-text-secondary)', marginBottom: '4px' }}>
                                                    <i className="bi bi-calendar3"></i> {tzFormatDate(h.tanggal)}
                                                </div>
                                                {h.keluhan && (
                                                    <div style={{ fontWeight: 600, color: 'var(--kh-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                        <i className="bi bi-activity" style={{ color: '#dc2626', marginRight: '4px' }}></i> {h.keluhan}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SECTION: WAKTU & NO REKAM MEDIS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    {selectedStudent && (
                        <div>
                            <label className="kh-filter-label">No. Rekam Medis</label>
                            <input
                                type="text"
                                className="kh-pill-input"
                                value={noRekamMedis}
                                readOnly
                                disabled
                                tabIndex={-1}
                                style={{
                                    background: 'var(--kh-tb-stripe, rgba(0,0,0,0.03))',
                                    cursor: 'not-allowed',
                                    opacity: 0.9,
                                    fontWeight: 700,
                                    color: 'var(--kh-accent)'
                                }}
                            />
                        </div>
                    )}
                    <div>
                        <label className="kh-filter-label">Hari/Tanggal</label>
                        <DatePicker
                            value={tanggal}
                            onChange={setTanggal}
                            style={{ height: '42px', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div>
                        <label className="kh-filter-label">Waktu</label>
                        <input
                            type="time"
                            className="kh-pill-input"
                            value={waktu}
                            onChange={e => setWaktu(e.target.value)}
                        />
                    </div>
                </div>

                {/* FIELDS 1 & 2: RIWAYAT PENYAKIT & ALERGI OBAT */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div className="rm-card-box">
                        <div className="rm-card-box-head">
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-activity"></i> Riwayat Penyakit
                            </label>
                            <MultiSelectCheckboxDropdown
                                title="Pilih"
                                options={presetPenyakit}
                                currentText={riwayatPenyakitText}
                                onTextChange={setRiwayatPenyakitText}
                                accentColor="var(--kh-accent)"
                            />
                        </div>
                        <textarea
                            ref={riwayatPenyakitRef}
                            className="kh-pill-input"
                            rows={2}
                            placeholder="Ketik deskripsi riwayat penyakit (atau pilih dari dropdown)..."
                            value={riwayatPenyakitText}
                            onChange={e => setRiwayatPenyakitText(e.target.value)}
                            onInput={e => adjustTextareaHeight(e.currentTarget)}
                            style={{ width: '100%', resize: 'none', overflow: 'hidden' }}
                        ></textarea>
                    </div>

                    <div className="rm-card-box">
                        <div className="rm-card-box-head">
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-exclamation-triangle-fill"></i> Riwayat Alergi Obat
                            </label>
                            <MultiSelectCheckboxDropdown
                                title="Pilih"
                                options={presetAlergi}
                                currentText={riwayatAlergiText}
                                onTextChange={setRiwayatAlergiText}
                                accentColor="var(--kh-accent)"
                            />
                        </div>
                        <textarea
                            ref={riwayatAlergiRef}
                            className="kh-pill-input"
                            rows={2}
                            placeholder="Ketik deskripsi alergi obat (atau pilih dari dropdown)..."
                            value={riwayatAlergiText}
                            onChange={e => setRiwayatAlergiText(e.target.value)}
                            onInput={e => adjustTextareaHeight(e.currentTarget)}
                            style={{ width: '100%', resize: 'none', overflow: 'hidden' }}
                        ></textarea>
                    </div>
                </div>

                {/* FIELD 3: KELUHAN & TATA LAKSANA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div className="rm-card-box">
                        <div className="rm-card-box-head">
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-chat-square-text-fill"></i> Keluhan <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <MultiSelectCheckboxDropdown
                                title="Pilih"
                                options={presetKeluhan}
                                currentText={keluhanText}
                                onTextChange={setKeluhanText}
                                accentColor="var(--kh-accent)"
                            />
                        </div>
                        <textarea
                            ref={keluhanRef}
                            className="kh-pill-input"
                            rows={2}
                            placeholder="Ketik rincian keluhan / gejala sakit siswa..."
                            value={keluhanText}
                            onChange={e => setKeluhanText(e.target.value)}
                            onInput={e => adjustTextareaHeight(e.currentTarget)}
                            style={{ width: '100%', resize: 'none', overflow: 'hidden' }}
                        ></textarea>
                    </div>

                    <div className="rm-card-box">
                        <div className="rm-card-box-head">
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-capsule"></i> Tata Laksana
                            </label>
                            <MultiSelectCheckboxDropdown
                                title="Pilih"
                                options={presetTataLaksana}
                                currentText={tataLaksanaText}
                                onTextChange={setTataLaksanaText}
                                accentColor="var(--kh-accent)"
                            />
                        </div>
                        <textarea
                            ref={tataLaksanaRef}
                            className="kh-pill-input"
                            rows={2}
                            placeholder="Ketik tata laksana / dosis obat / anjuran pengobatan..."
                            value={tataLaksanaText}
                            onChange={e => setTataLaksanaText(e.target.value)}
                            onInput={e => adjustTextareaHeight(e.currentTarget)}
                            style={{ width: '100%', resize: 'none', overflow: 'hidden' }}
                        ></textarea>
                    </div>
                </div>

                {/* FIELDS 4 & 5: TINDAKAN MEDIS & TINDAK LANJUT */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="rm-card-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-bandaid-fill"></i> Tindakan Medis
                            </label>
                            <MultiSelectCheckboxDropdown
                                title="Pilih"
                                options={presetTindakan}
                                currentText={tindakanText}
                                onTextChange={setTindakanText}
                                accentColor="var(--kh-accent)"
                            />
                        </div>
                        <textarea
                            ref={tindakanRef}
                            className="kh-pill-input"
                            rows={2}
                            placeholder="Ketik tindakan medis yang diberikan (atau pilih dari dropdown)..."
                            value={tindakanText}
                            onChange={e => setTindakanText(e.target.value)}
                            onInput={e => adjustTextareaHeight(e.currentTarget)}
                            style={{ width: '100%', resize: 'none', overflow: 'hidden' }}
                        ></textarea>
                    </div>

                    <div className="rm-card-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-arrow-right-circle-fill"></i> Tindak Lanjut
                            </label>
                            <MultiSelectCheckboxDropdown
                                title="Pilih"
                                options={presetTindakLanjut}
                                currentText={tindakLanjutText}
                                onTextChange={setTindakLanjutText}
                                accentColor="var(--kh-accent)"
                                singleSelect={true}
                            />
                        </div>

                        <input
                            type="text"
                            className="kh-pill-input"
                            placeholder="Ketik deskripsi tindak lanjut (atau pilih dari dropdown)..."
                            value={tindakLanjutText}
                            onChange={e => setTindakLanjutText(e.target.value)}
                            style={{ width: '100%', marginBottom: '14px' }}
                        />

                        <div style={{
                            background: currentMappedStatus === 'NONE' ? 'var(--n-card)' : 'rgba(5, 150, 105, 0.05)',
                            border: currentMappedStatus === 'NONE' ? '1.8px solid rgba(26, 115, 232, 0.75)' : '1.8px solid rgba(5, 150, 105, 0.5)',
                            borderRadius: '12px', padding: '12px 16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className={`bi bi-${currentMappedStatus === 'NONE' ? 'dash-circle' : 'cloud-check-fill'}`} style={{ color: currentMappedStatus === 'NONE' ? 'var(--kh-text-muted)' : '#059669', fontSize: '1.1rem' }}></i>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: currentMappedStatus === 'NONE' ? 'var(--kh-text-secondary)' : '#059669' }}>
                                            Sinkronisasi ke Modul Ketidakhadiran Siswa (Sakit)
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--kh-text-secondary)' }}>
                                            {currentMappedStatus === 'NONE' ? (
                                                <span>Siswa kembali belajar di kelas (TIDAK dicatat sebagai absensi sakit).</span>
                                            ) : (
                                                <span>Otomatis membuat/memperbarui data absensi <b>Sakit {currentMappedStatus}</b>.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {currentMappedStatus !== 'NONE' && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#059669' }}>
                                        <input
                                            type="checkbox"
                                            checked={autoSyncKetidakhadiran}
                                            onChange={e => setAutoSyncKetidakhadiran(e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                                        />
                                        Otomatis Sinkronkan
                                    </label>
                                )}
                            </div>

                            {currentMappedStatus !== 'NONE' && autoSyncKetidakhadiran && (
                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(5, 150, 105, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <label className="kh-filter-label" style={{ fontSize: '0.78rem', margin: 0, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <i className="bi bi-calendar-range-fill"></i> Estimasi Durasi & Tanggal Selesai Sakit / Rujuk
                                        </label>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--kh-text-secondary)', marginRight: '2px' }}>Pilih Durasi:</span>
                                            <button
                                                type="button"
                                                onClick={() => setDaysDuration(1)}
                                                style={{ background: tglSelesaiSakit === tanggal ? '#059669' : 'rgba(5, 150, 105, 0.1)', color: tglSelesaiSakit === tanggal ? '#fff' : '#059669', border: '1px solid #059669', cursor: 'pointer', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}
                                            >
                                                1 Hari (Hari Ini)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDaysDuration(2)}
                                                style={{ background: calculateTotalDays(tanggal, tglSelesaiSakit) === 2 ? '#059669' : 'rgba(5, 150, 105, 0.1)', color: calculateTotalDays(tanggal, tglSelesaiSakit) === 2 ? '#fff' : '#059669', border: '1px solid #059669', cursor: 'pointer', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}
                                            >
                                                2 Hari
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDaysDuration(3)}
                                                style={{ background: calculateTotalDays(tanggal, tglSelesaiSakit) === 3 ? '#059669' : 'rgba(5, 150, 105, 0.1)', color: calculateTotalDays(tanggal, tglSelesaiSakit) === 3 ? '#fff' : '#059669', border: '1px solid #059669', cursor: 'pointer', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}
                                            >
                                                3 Hari
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label className="kh-filter-label" style={{ fontSize: '0.72rem', margin: 0 }}>Sampai Tanggal (Selesai):</label>
                                            <DatePicker
                                                value={tglSelesaiSakit}
                                                onChange={setTglSelesaiSakit}
                                                style={{ height: '36px', width: '100%' }}
                                            />
                                        </div>
                                        {tindakLanjutText.toLowerCase().includes('istirahat di uks') && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label className="kh-filter-label" style={{ fontSize: '0.72rem', margin: 0 }}>Jam Selesai Istirahat UKS:</label>
                                                <input
                                                    type="time"
                                                    className="kh-pill-input"
                                                    value={waktuSelesaiUks}
                                                    onChange={e => setWaktuSelesaiUks(e.target.value)}
                                                    style={{ height: '36px', width: '100%', margin: 0, fontSize: '0.8rem' }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.25)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <i className="bi bi-info-circle-fill" style={{ fontSize: '0.85rem' }}></i>
                                        <span>
                                            Sinkronkan Absensi SAKIT: <b>{tzFormatDate(tanggal)}</b> s/d <b>{tzFormatDate(tglSelesaiSakit)}</b> (Total <b>{calculateTotalDays(tanggal, tglSelesaiSakit)} Hari</b>).
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FOOTER BAR */}
                <div className="rm-form-footer">
                    <div className="rm-form-footer-petugas">
                        <div style={{ fontSize: '0.85rem', color: 'var(--kh-text-primary)' }}>
                            <span style={{ color: 'var(--kh-text-secondary)' }}>Petugas :</span> <b style={{ color: 'var(--kh-accent)' }}>{petugasNama}</b>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--kh-text-secondary)' }}>
                            NIP : <b>{petugasNip || '-'}</b>
                        </div>
                    </div>

                    <div className="rm-form-footer-actions">
                        <Button
                            type="button"
                            variant="reset"
                            size="lg"
                            onClick={resetForm}
                            disabled={isSubmitting}
                            leftIcon={<i className="bi bi-arrow-counterclockwise" />}
                        >
                            Reset Form
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            isLoading={isSubmitting}
                            leftIcon={<i className="bi bi-check-lg" />}
                        >
                            Simpan
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
