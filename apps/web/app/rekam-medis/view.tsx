'use client';
import { escapeHtml } from '@/lib/print/print-utils';
const safeText = (value: unknown) => escapeHtml(String(value ?? ''));

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import '@/app/ketidakhadiran/ketidakhadiran.css';
import { useTimezone } from '@/hooks/use-timezone';
import { getCurrentUser } from '@/lib/auth-client';
import { renderKopHTML, KOP_CSS } from '@/lib/lckh/print-shared';
import Tab from '@/components/ui/Tab';
import { Button } from '@/components/ui/Button';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import InputMedisTab, { StudentSearchResult, MultiSelectCheckboxDropdown } from './tabs/InputMedisTab';
import DaftarMedisTab, { RekamMedisRow } from './tabs/DaftarMedisTab';
import CetakMedisTab, { PrintStudentItem } from './tabs/CetakMedisTab';
import KonfigurasiMedisTab, { TindakLanjutMappingItem } from './tabs/KonfigurasiMedisTab';

const DEFAULT_TINDAK_LANJUT_MAPPING: TindakLanjutMappingItem[] = [
    { name: 'Kembali ke Kelas', status: 'NONE' },
    { name: 'Istirahat di UKS', status: 'Ringan' },
    { name: 'Dijemput Orang Tua / Pulang', status: 'Sedang' },
    { name: 'Rujuk ke Klinik / RS', status: 'Sedang' },
    { name: 'Kontrol Ulang', status: 'Kontrol' }
];

export default function RekamMedisView() {
    const { getCurrentDate, formatDate: tzFormatDate } = useTimezone();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Tab state: 'INPUT' vs 'LIST' vs 'CETAK' vs 'KONFIGURASI'
    const [activeTab, setActiveTab] = useState<'INPUT' | 'LIST' | 'CETAK' | 'KONFIGURASI'>('INPUT');

    // ── CETAK TAB STATE ──
    const [printSiswaQuery, setPrintSiswaQuery] = useState('');
    const [printFilterKelas, setPrintFilterKelas] = useState('');
    const [printFilterGuruAsuh, setPrintFilterGuruAsuh] = useState('');
    const [rawPrintRecords, setRawPrintRecords] = useState<RekamMedisRow[]>([]);
    const [printLoadingList, setPrintLoadingList] = useState(false);
    const [printingNisn, setPrintingNisn] = useState<string | null>(null);
    const [printProfilSekolah, setPrintProfilSekolah] = useState<any>(null);

    // Default Presets for Tata Laksana
    const DEFAULT_PRESET_TATA_LAKSANA = ['ANAMNESIS', 'PEMERIKSAAN FISIS', 'PEMERIKSAAN PENUNJANG', 'DIAGNOSIS'];

    // Dynamic Presets States strictly from DB
    const [presetPenyakit, setPresetPenyakit] = useState<string[]>([]);
    const [presetAlergi, setPresetAlergi] = useState<string[]>([]);
    const [presetKeluhan, setPresetKeluhan] = useState<string[]>([]);
    const [presetTataLaksana, setPresetTataLaksana] = useState<string[]>(DEFAULT_PRESET_TATA_LAKSANA);
    const [presetTindakan, setPresetTindakan] = useState<string[]>([]);
    const [presetTindakLanjut, setPresetTindakLanjut] = useState<string[]>([]);
    const [tindakLanjutMapping, setTindakLanjutMapping] = useState<TindakLanjutMappingItem[]>(DEFAULT_TINDAK_LANJUT_MAPPING);

    // Konfigurasi Tab Add Item Inputs
    const [newPenyakitInput, setNewPenyakitInput] = useState('');
    const [newAlergiInput, setNewAlergiInput] = useState('');
    const [newKeluhanInput, setNewKeluhanInput] = useState('');
    const [newTataLaksanaInput, setNewTataLaksanaInput] = useState('');
    const [newTindakanInput, setNewTindakanInput] = useState('');
    const [newTindakLanjutInput, setNewTindakLanjutInput] = useState('');
    const [newTindakLanjutStatus, setNewTindakLanjutStatus] = useState<'Ringan' | 'Sedang' | 'Berat' | 'Kontrol' | 'NONE'>('Ringan');

    // User auth info
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [petugasNama, setPetugasNama] = useState('Petugas UKS');
    const [petugasNip, setPetugasNip] = useState<string | null>(null);

    // List & Filter States
    const [rows, setRows] = useState<RekamMedisRow[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterKelas, setFilterKelas] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPetugas, setFilterPetugas] = useState('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [selectedRowDetail, setSelectedRowDetail] = useState<RekamMedisRow | null>(null);

    // List Pagination States
    const [listPage, setListPage] = useState(1);
    const [listLimit, setListLimit] = useState(10);

    // Delete Modal States
    const [deletingRow, setDeletingRow] = useState<RekamMedisRow | null>(null);
    const [isDeletingRecord, setIsDeletingRecord] = useState(false);

    // Edit Modal States & Handlers
    const [selectedRowEdit, setSelectedRowEdit] = useState<RekamMedisRow | null>(null);
    const [editRiwayatPenyakitText, setEditRiwayatPenyakitText] = useState('');
    const [editRiwayatAlergiText, setEditRiwayatAlergiText] = useState('');
    const [editKeluhanText, setEditKeluhanText] = useState('');
    const [editTataLaksanaText, setEditTataLaksanaText] = useState('');
    const [editTindakanText, setEditTindakanText] = useState('');
    const [editTindakLanjutText, setEditTindakLanjutText] = useState('');
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);

    // Student Search & Form States
    const [studentQuery, setStudentQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
    const [studentHistory, setStudentHistory] = useState<RekamMedisRow[]>([]);
    const [loadingStudentHistory, setLoadingStudentHistory] = useState(false);

    // Form inputs: Waktu & No RM
    const [noRekamMedis, setNoRekamMedis] = useState('');
    const [tanggal, setTanggal] = useState(getCurrentDate());
    const [waktu, setWaktu] = useState(new Date().toTimeString().slice(0, 5));

    // Form inputs: 5 Target Fields
    const [riwayatPenyakitText, setRiwayatPenyakitText] = useState('');
    const [riwayatAlergiText, setRiwayatAlergiText] = useState('');
    const [keluhanText, setKeluhanText] = useState('');
    const [tataLaksanaText, setTataLaksanaText] = useState('');
    const [tindakanText, setTindakanText] = useState('');
    const [tindakLanjutText, setTindakLanjutText] = useState('Kembali ke Kelas');

    // Form Sync & Duration States
    const [autoSyncKetidakhadiran, setAutoSyncKetidakhadiran] = useState(true);
    const [tglSelesaiSakit, setTglSelesaiSakit] = useState(getCurrentDate());
    const [waktuSelesaiUks, setWaktuSelesaiUks] = useState('');
    const medicalRequest = useRef<{ fingerprint: string; key: string } | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Textarea Auto-Expand Refs
    const riwayatPenyakitRef = useRef<HTMLTextAreaElement | null>(null);
    const riwayatAlergiRef = useRef<HTMLTextAreaElement | null>(null);
    const keluhanRef = useRef<HTMLTextAreaElement | null>(null);
    const tataLaksanaRef = useRef<HTMLTextAreaElement | null>(null);
    const tindakanRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        initAuthAndClasses();
        loadRekamMedisList();
        loadPresetsFromStorageOrApi();
        loadPrintProfilSekolah();
    }, []);

    const ensureArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {}
            }
            return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [];
    };

    const calculateTotalDays = (startDateStr: string, endDateStr: string) => {
        if (!startDateStr || !endDateStr) return 1;
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 1;
    };

    const setDaysDuration = (numDays: number, baseDateStr?: string, targetSetter?: (d: string) => void) => {
        const baseStr = baseDateStr || tanggal;
        const setter = targetSetter || setTglSelesaiSakit;
        if (!baseStr) return;
        const base = new Date(baseStr);
        if (isNaN(base.getTime())) return;
        base.setDate(base.getDate() + (numDays - 1));
        const year = base.getFullYear();
        const month = String(base.getMonth() + 1).padStart(2, '0');
        const day = String(base.getDate()).padStart(2, '0');
        setter(`${year}-${month}-${day}`);
    };

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

    const loadPresetsFromStorageOrApi = async () => {
        try {
            const cached = localStorage.getItem('acca_rm_presets');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed.penyakit)) setPresetPenyakit(parsed.penyakit);
                if (Array.isArray(parsed.alergi)) setPresetAlergi(parsed.alergi);
                if (Array.isArray(parsed.keluhan)) setPresetKeluhan(parsed.keluhan);
                if (Array.isArray(parsed.tataLaksana)) setPresetTataLaksana(parsed.tataLaksana);
                if (Array.isArray(parsed.tindakan)) setPresetTindakan(parsed.tindakan);
                if (Array.isArray(parsed.tindakLanjut)) setPresetTindakLanjut(parsed.tindakLanjut);
                if (Array.isArray(parsed.tindakLanjutMapping)) setTindakLanjutMapping(parsed.tindakLanjutMapping);
            }
        } catch (e) {
            console.error('Preset cache read error:', e);
        }

        try {
            const res = await fetch('/api/ketidakhadiran/rekam-medis-siswa?action=get_presets');
            const json = await res.json();
            if (json.ok && json.data) {
                const d = json.data;
                setPresetPenyakit(Array.isArray(d.penyakit) ? d.penyakit : []);
                setPresetAlergi(Array.isArray(d.alergi) ? d.alergi : []);
                setPresetKeluhan(Array.isArray(d.keluhan) ? d.keluhan : []);
                setPresetTataLaksana(Array.isArray(d.tataLaksana) ? d.tataLaksana : DEFAULT_PRESET_TATA_LAKSANA);
                setPresetTindakan(Array.isArray(d.tindakan) ? d.tindakan : []);
                
                if (Array.isArray(d.tindakLanjut)) setPresetTindakLanjut(d.tindakLanjut);
                if (Array.isArray(d.tindakLanjutMapping)) {
                    setTindakLanjutMapping(d.tindakLanjutMapping);
                } else if (Array.isArray(d.tindakLanjut)) {
                    const built = d.tindakLanjut.map((name: string) => {
                        const existing = DEFAULT_TINDAK_LANJUT_MAPPING.find(m => m.name.toLowerCase() === name.toLowerCase());
                        return existing || { name, status: 'Ringan' as const };
                    });
                    setTindakLanjutMapping(built);
                }

                localStorage.setItem('acca_rm_presets', JSON.stringify(d));
            }
        } catch (e) {
            console.error('Fetch presets error:', e);
        }
    };

    const savePresetsToStorageAndApi = async (updatedPresets: {
        penyakit: string[];
        alergi: string[];
        keluhan: string[];
        tataLaksana?: string[];
        tindakan: string[];
        tindakLanjut: string[];
        tindakLanjutMapping: TindakLanjutMappingItem[];
    }) => {
        const fullPresets = {
            tataLaksana: presetTataLaksana,
            ...updatedPresets
        };
        try {
            localStorage.setItem('acca_rm_presets', JSON.stringify(fullPresets));
            const response = await fetch('/api/ketidakhadiran/rekam-medis-siswa?action=save_presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presets: fullPresets })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || 'Preset gagal disimpan');
        } catch (e) {
            console.error('Save presets error:', e);
            Swal.fire({ icon: 'error', title: 'Preset belum tersimpan di server', text: e instanceof Error ? e.message : 'Coba kembali' });
        }
    };

    const initAuthAndClasses = async () => {
        try {
            const uData = await getCurrentUser();
            if (uData) {
                setCurrentUser(uData);
                setPetugasNama(uData.nama || uData.username || 'Petugas UKS');
                setPetugasNip(uData.nip || null);
            }

            const cRes = await fetch('/api/master/kelas');
            const cJson = await cRes.json();
            const cData = cJson.ok ? cJson.data : (Array.isArray(cJson) ? cJson : []);
            if (Array.isArray(cData)) {
                setAvailableClasses(cData.map((c: any) => c.nama).filter(Boolean).sort());
            }
        } catch (e) {
            console.error('Init error:', e);
        }
    };

    const loadPrintProfilSekolah = async () => {
        try {
            const res = await fetch('/api/profil-sekolah');
            const json = await res.json();
            if (json.ok && json.data) {
                setPrintProfilSekolah(json.data);
            }
        } catch (e) {
            console.error('Fetch profil sekolah error:', e);
        }
    };

    const loadPrintStudentList = async () => {
        setPrintLoadingList(true);
        try {
            const res = await fetch('/api/ketidakhadiran/rekam-medis-siswa?limit=2000');
            const json = await res.json();
            if (json.ok && json.data) {
                setRawPrintRecords(json.data as RekamMedisRow[]);
            }
        } catch (e) {
            console.error('Load print student list error:', e);
        } finally {
            setPrintLoadingList(false);
        }
    };

    const formatTanggalIndo = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        } catch { return dateStr; }
    };

    const formatHariIndo = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
            return days[d.getDay()];
        } catch { return '-'; }
    };

    const formatTanggalLahirIndo = (dateStr: string | null) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
        } catch { return dateStr; }
    };

    const triggerPrintPDF = (student: PrintStudentItem, records: RekamMedisRow[]) => {
        try {
            const ps = printProfilSekolah || {};
            const genderLabel = (g: string) => {
                const u = String(g || '').toUpperCase();
                if (u.startsWith('L') || u === 'LAKI') return 'Laki-Laki';
                if (u.startsWith('P') || u === 'PEREMPUAN') return 'Perempuan';
                return g || '-';
            };
            const kopHtml = renderKopHTML(ps);

            const recordsHtml = records.map((r) => {
                const noRM = r.no_rekam_medis || '-';
                const hari = formatHariIndo(r.tanggal);
                const tgl = formatTanggalIndo(r.tanggal);
                const waktuLabel = r.waktu ? `Pukul ${r.waktu.replace(':', '.')}` : '-';
                const riwayatPenyakit = ensureArray(r.riwayat_penyakit).join(', ') || '-';
                const riwayatAlergi = ensureArray(r.riwayat_alergi_obat).join(', ') || '-';
                const tindakanArr = ensureArray(r.tindakan);
                const tindakanHtml = tindakanArr.length > 0
                    ? tindakanArr.map(t => `<div>${safeText(t)}</div>`).join('')
                    : '-';

                return `
                <table class="rm-table" style="margin-bottom:20px;">
                    <tr>
                        <td class="rm-label" style="width:170px;background:#eaf1fb;"><b>No. Rekam Medis</b></td>
                        <td class="rm-value" style="background:#eaf1fb;">${safeText(noRM)}</td>
                    </tr>
                    <tr>
                        <td class="rm-label"><b>Hari/ tanggal</b></td>
                        <td class="rm-value">${safeText(hari)} / ${safeText(tgl)}</td>
                    </tr>
                    <tr>
                        <td class="rm-label"><b>Waktu</b></td>
                        <td class="rm-value">${safeText(waktuLabel)}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding:0;border:1px solid #333;">
                            <table style="width:100%;border-collapse:collapse;">
                                <tr>
                                    <td style="width:50%;vertical-align:top;padding:6px 10px;border:none;">
                                        <b>Riwayat Penyakit</b><br/>${safeText(riwayatPenyakit)}
                                    </td>
                                    <td style="width:50%;vertical-align:top;border:none;border-left:1px solid #333;padding:6px 10px;">
                                        <b>Riwayat Alergi Obat</b><br/>${safeText(riwayatAlergi === 'Tidak Ada Alergi Obat' ? '-' : riwayatAlergi)}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td class="rm-label"><b>Keluhan</b></td>
                        <td class="rm-value">${safeText(r.keluhan || '-')}</td>
                    </tr>
                    <tr>
                        <td colspan="2" class="rm-value" style="text-align:center;">${safeText(r.tata_laksana || '')}</td>
                    </tr>
                    <tr>
                        <td class="rm-label"><b>Tindakan</b></td>
                        <td class="rm-value">${tindakanHtml}</td>
                    </tr>
                    <tr>
                        <td class="rm-label"><b>Tindak lanjut</b></td>
                        <td class="rm-value">${safeText(r.tindak_lanjut || '-')}</td>
                    </tr>
                    <tr>
                        <td class="rm-label"><b>Petugas</b></td>
                        <td class="rm-value">${safeText(r.petugas_nama || '-')}${r.petugas_nip ? ` (NIP. ${safeText(r.petugas_nip)})` : ''}</td>
                    </tr>
                </table>`;
            }).join('');

            const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Rekam Medis Rawat Jalan - ${safeText(student.nama_siswa)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 12px; color: #000; background: #fff; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 20mm; }
        ${KOP_CSS}
        .judul { text-align: center; font-size: 14px; font-weight: bold; text-decoration: underline; margin-bottom: 24px; letter-spacing: 0.05em; }
        .section-title { font-size: 13px; font-weight: bold; margin-bottom: 10px; }
        .biodata-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .biodata-table td { padding: 3px 4px; vertical-align: top; font-size: 12px; }
        .biodata-table .bio-label { width: 130px; }
        .biodata-table .bio-colon { width: 12px; }
        .rm-table { width: 100%; border-collapse: collapse; font-size: 12px; page-break-inside: avoid; break-inside: avoid; }
        .rm-table td { border: 1px solid #333; padding: 6px 10px; vertical-align: top; }
        .rm-label { width: 170px; background: #fff; font-weight: bold; }
        .rm-value { background: #fff; }
        @page { size: A4; margin: 15mm 20mm; }
        @media print {
            html, body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: 100%; padding: 0; min-height: 0; }
        }
    </style>
</head>
<body>
<div class="page">
    ${kopHtml}
    <div class="judul">REKAM MEDIS RAWAT JALAN</div>
    <div class="section-title">A.&nbsp;&nbsp;Biodata Diri</div>
    <table class="biodata-table">
        <tr><td class="bio-label">Nama</td><td class="bio-colon">:</td><td>${safeText(student.nama_siswa)}</td></tr>
        <tr><td class="bio-label">Tempat lahir</td><td class="bio-colon">:</td><td>${safeText(student.tempat_lahir && student.tempat_lahir !== '-' ? student.tempat_lahir : '')}</td></tr>
        <tr><td class="bio-label">Tanggal lahir</td><td class="bio-colon">:</td><td>${safeText(formatTanggalLahirIndo(student.tanggal_lahir))}</td></tr>
        <tr><td class="bio-label">Jenis kelamin</td><td class="bio-colon">:</td><td>${safeText(genderLabel(student.gender))}</td></tr>
        <tr><td class="bio-label">Alamat</td><td class="bio-colon">:</td><td>${safeText(student.alamat && student.alamat !== '-' ? student.alamat : '')}</td></tr>
        <tr><td class="bio-label">No. Telepon</td><td class="bio-colon">:</td><td></td></tr>
        <tr><td class="bio-label">Guru asuh</td><td class="bio-colon">:</td><td>${safeText(student.guru_asuh && student.guru_asuh !== '-' ? student.guru_asuh : '')}</td></tr>
    </table>
    <div class="section-title" style="margin-bottom:14px;">B.&nbsp;&nbsp;Riwayat Rekam Medis</div>
    ${recordsHtml}
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

            const printWindow = window.open('', '_blank', 'width=900,height=700');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                iframe.src = blobUrl;
                document.body.appendChild(iframe);
                iframe.onload = () => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                        URL.revokeObjectURL(blobUrl);
                    }, 60000);
                };
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Cetak', text: e.message, confirmButtonColor: '#dc2626' });
        }
    };

    const handleDirectPrintStudent = async (student: PrintStudentItem) => {
        setPrintingNisn(student.nisn);
        try {
            const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?nisn=${encodeURIComponent(student.nisn)}&limit=1000`);
            const json = await res.json();
            if (json.ok && json.data && json.data.length > 0) {
                const sorted = [...(json.data as RekamMedisRow[])].sort((a, b) => {
                    const dA = `${a.tanggal}_${a.waktu || ''}`;
                    const dB = `${b.tanggal}_${b.waktu || ''}`;
                    return dA.localeCompare(dB);
                });
                triggerPrintPDF(student, sorted);
            } else {
                Swal.fire({ icon: 'info', title: 'Tidak Ada Data', text: 'Siswa ini tidak memiliki riwayat rekam medis.', confirmButtonColor: '#3083FF' });
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Memuat Data', text: e.message, confirmButtonColor: '#dc2626' });
        } finally {
            setPrintingNisn(null);
        }
    };

    const loadRekamMedisList = async () => {
        setLoadingList(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);
            if (filterKelas) params.append('kelas', filterKelas);
            params.append('limit', '10000');

            const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?${params.toString()}`);
            const json = await res.json();
            if (json.ok && json.data) {
                setRows(json.data);
            } else {
                setRows([]);
            }
        } catch (e) {
            console.error('Fetch rekam medis list error:', e);
            setRows([]);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        const trimmed = studentQuery.trim();
        if (!trimmed || (selectedStudent && studentQuery.includes(selectedStudent.nisn))) {
            if (!trimmed) {
                setSearchResults([]);
                setShowStudentDropdown(false);
            }
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingStudent(true);
            try {
                const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?action=search_siswa&q=${encodeURIComponent(trimmed)}`);
                const json = await res.json();
                if (json.ok && json.data) {
                    setSearchResults(json.data);
                    setShowStudentDropdown(true);
                }
            } catch (e) {
                console.error('Search student error:', e);
            } finally {
                setIsSearchingStudent(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [studentQuery, selectedStudent]);

    const handleSelectStudent = async (student: StudentSearchResult) => {
        setSelectedStudent(student);
        setStudentQuery(`${student.nama_siswa} (${student.nisn})`);
        setShowStudentDropdown(false);
        setRiwayatPenyakitText('');
        setRiwayatAlergiText('');

        setLoadingStudentHistory(true);
        try {
            const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?nisn=${student.nisn}&limit=5`);
            const json = await res.json();
            if (json.ok && json.data && json.data.length > 0) {
                setStudentHistory(json.data);
                const latest = json.data[0];
                if (latest.riwayat_penyakit) {
                    const pText = Array.isArray(latest.riwayat_penyakit) ? latest.riwayat_penyakit.join(', ') : String(latest.riwayat_penyakit);
                    if (pText && pText !== '-') setRiwayatPenyakitText(pText);
                }
                if (latest.riwayat_alergi_obat) {
                    const aText = Array.isArray(latest.riwayat_alergi_obat) ? latest.riwayat_alergi_obat.join(', ') : String(latest.riwayat_alergi_obat);
                    if (aText && aText !== '-') setRiwayatAlergiText(aText);
                }
            } else {
                setStudentHistory([]);
                setRiwayatPenyakitText('');
                setRiwayatAlergiText('');
            }
        } catch (e) {
            setStudentHistory([]);
            setRiwayatPenyakitText('');
            setRiwayatAlergiText('');
        } finally {
            setLoadingStudentHistory(false);
        }
    };

    const currentMappedStatus = useMemo(() => {
        const text = tindakLanjutText.toLowerCase();
        const found = tindakLanjutMapping.find(m => m.name.toLowerCase() === text);
        if (found) return found.status;

        if (text.includes('kembali ke kelas')) return 'NONE';
        if (text.includes('istirahat di uks')) return 'Ringan';
        if (text.includes('dijemput') || text.includes('pulang')) return 'Sedang';
        if (text.includes('rujuk') || text.includes('rs') || text.includes('klinik')) return 'Sedang';
        if (text.includes('kontrol')) return 'Kontrol';
        return 'Ringan';
    }, [tindakLanjutText, tindakLanjutMapping]);

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStudent) {
            Swal.fire({ icon: 'warning', title: 'Data Siswa Belum Dipilih', text: 'Cari dan pilih siswa dari Master Siswa terlebih dahulu.', confirmButtonColor: '#3083FF' });
            return;
        }

        if (!keluhanText.trim()) {
            Swal.fire({ icon: 'warning', title: 'Keluhan Wajib Diisi', text: 'Tuliskan keluhan atau gejala yang dirasakan siswa.', confirmButtonColor: '#3083FF' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
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
                no_rekam_medis: noRekamMedis || undefined,
                petugas_nama: petugasNama,
                petugas_nip: petugasNip,
                auto_sync: currentMappedStatus !== 'NONE' && autoSyncKetidakhadiran,
                tgl_selesai: tglSelesaiSakit || tanggal,
                waktu_selesai: waktuSelesaiUks || undefined,
                mappedStatus: currentMappedStatus
            };

            const fingerprint = JSON.stringify(payload);
            if (!medicalRequest.current || medicalRequest.current.fingerprint !== fingerprint) medicalRequest.current = { fingerprint, key: crypto.randomUUID() };
            const res = await fetch('/api/ketidakhadiran/rekam-medis-siswa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, idempotencyKey: medicalRequest.current.key })
            });

            const json = await res.json();
            if (json.ok) {
                let syncMsg = '';
                if (json.syncResult && json.syncResult.ok) {
                    syncMsg = `<br/><small style="color:#059669;font-weight:700;"><i className="bi bi-check-circle"></i> Disinkronkan ke Absensi Sakit (${json.syncResult.mappedStatus})</small>`;
                }

                await Swal.fire({
                    icon: 'success',
                    title: 'Rekam Medis Tersimpan!',
                    html: `<b>No. RM:</b> ${safeText(json.data.no_rekam_medis)}<br/><b>Siswa:</b> ${safeText(json.data.nama_siswa)}${syncMsg}`,
                    confirmButtonColor: '#3083FF'
                });

                resetForm();
                loadRekamMedisList();
                setActiveTab('LIST');
            } else {
                throw new Error(json.error || 'Gagal menyimpan data');
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message, confirmButtonColor: '#dc2626' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleManualSync = async (row: RekamMedisRow) => {
        setSyncingId(row.id);
        try {
            const mappedStatus = tindakLanjutMapping.find(m => m.name.toLowerCase() === row.tindak_lanjut?.toLowerCase())?.status;
            const res = await fetch('/api/ketidakhadiran/rekam-medis-siswa?action=sync_ketidakhadiran', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, mappedStatus })
            });

            const json = await res.json();
            if (json.result?.skipped) {
                Swal.fire({ icon: 'info', title: 'Tidak Di-sinkron', text: json.result.reason, confirmButtonColor: '#3083FF' });
                loadRekamMedisList();
            } else if (json.ok && json.result && json.result.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil Disinkronkan!',
                    html: `Data rekam medis <b>${safeText(row.no_rekam_medis)}</b> tersambung ke Absensi Sakit (<b>${json.result.mappedStatus}</b>).`,
                    timer: 2000,
                    showConfirmButton: false
                });
                loadRekamMedisList();
            } else if (json.result && json.result.skipped) {
                Swal.fire({ icon: 'info', title: 'Tidak Di-sinkron', text: json.result.reason, confirmButtonColor: '#3083FF' });
            } else {
                throw new Error(json.error || json.result?.error || 'Sinkronisasi gagal');
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Sinkron', text: e.message, confirmButtonColor: '#dc2626' });
        } finally {
            setSyncingId(null);
        }
    };

    const resetForm = () => {
        medicalRequest.current = null;
        setSelectedStudent(null);
        setStudentQuery('');
        setNoRekamMedis('');
        setRiwayatPenyakitText('');
        setRiwayatAlergiText('');
        setKeluhanText('');
        setTataLaksanaText('');
        setTindakanText('');
        setTindakLanjutText('Kembali ke Kelas');
        setStudentHistory([]);
        setAutoSyncKetidakhadiran(true);
        setTglSelesaiSakit(getCurrentDate());
        setWaktuSelesaiUks('');
    };

    const handleDeleteRecord = (row: RekamMedisRow) => {
        setDeletingRow(row);
    };

    const confirmDeleteRecord = async () => {
        if (!deletingRow) return;
        setIsDeletingRecord(true);
        try {
            const res = await fetch(`/api/ketidakhadiran/rekam-medis-siswa?id=${deletingRow.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                setRows(prev => prev.filter(r => r.id !== deletingRow.id));
                if (selectedRowDetail?.id === deletingRow.id) setSelectedRowDetail(null);
                setDeletingRow(null);
                Swal.fire({
                    icon: 'success',
                    title: 'Terhapus',
                    text: json.message || 'Rekam medis berhasil dihapus.',
                    timer: 1500,
                    showConfirmButton: false,
                });
            } else {
                throw new Error(json.error);
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: e.message, confirmButtonColor: '#dc2626' });
        } finally {
            setIsDeletingRecord(false);
        }
    };

    const handleOpenEditModal = (row: RekamMedisRow) => {
        setSelectedRowEdit(row);
        setEditRiwayatPenyakitText(Array.isArray(row.riwayat_penyakit) ? row.riwayat_penyakit.join(', ') : (row.riwayat_penyakit || ''));
        setEditRiwayatAlergiText(Array.isArray(row.riwayat_alergi_obat) ? row.riwayat_alergi_obat.join(', ') : (row.riwayat_alergi_obat || ''));
        setEditKeluhanText(row.keluhan || '');
        setEditTataLaksanaText(row.tata_laksana || '');
        setEditTindakanText(Array.isArray(row.tindakan) ? row.tindakan.join(', ') : (row.tindakan || ''));
        setEditTindakLanjutText(row.tindak_lanjut || 'Kembali ke Kelas');
    };

    const handleSaveEditRecord = async () => {
        if (!selectedRowEdit) return;
        setIsUpdatingRecord(true);
        try {
            const res = await fetch('/api/ketidakhadiran/rekam-medis-siswa', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedRowEdit.id,
                    riwayat_penyakit: editRiwayatPenyakitText.split(',').map(s => s.trim()).filter(Boolean),
                    riwayat_alergi_obat: editRiwayatAlergiText.split(',').map(s => s.trim()).filter(Boolean),
                    keluhan: editKeluhanText,
                    tata_laksana: editTataLaksanaText,
                    tindakan: editTindakanText.split(',').map(s => s.trim()).filter(Boolean),
                    tindak_lanjut: editTindakLanjutText
                })
            });
            const json = await res.json();
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil Diperbarui', text: 'Data rekam medis & absensi berhasil diperbarui.', timer: 1500, showConfirmButton: false });
                setSelectedRowEdit(null);
                loadRekamMedisList();
            } else {
                throw new Error(json.error);
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
        } finally {
            setIsUpdatingRecord(false);
        }
    };

    // Preset CRUD Handlers
    const handleAddPreset = (
        category: 'penyakit' | 'alergi' | 'keluhan' | 'tataLaksana' | 'tindakan' | 'tindakLanjut',
        val: string,
        setVal: (s: string) => void,
        statusMapping?: 'Ringan' | 'Sedang' | 'Berat' | 'Kontrol' | 'NONE'
    ) => {
        const trimmed = val.trim();
        if (!trimmed) return;

        let updated = {
            penyakit: presetPenyakit,
            alergi: presetAlergi,
            keluhan: presetKeluhan,
            tataLaksana: presetTataLaksana,
            tindakan: presetTindakan,
            tindakLanjut: presetTindakLanjut,
            tindakLanjutMapping
        };

        if (category === 'penyakit') {
            if (!presetPenyakit.includes(trimmed)) {
                const list = [...presetPenyakit, trimmed];
                setPresetPenyakit(list);
                updated.penyakit = list;
            }
        } else if (category === 'alergi') {
            if (!presetAlergi.includes(trimmed)) {
                const list = [...presetAlergi, trimmed];
                setPresetAlergi(list);
                updated.alergi = list;
            }
        } else if (category === 'keluhan') {
            if (!presetKeluhan.includes(trimmed)) {
                const list = [...presetKeluhan, trimmed];
                setPresetKeluhan(list);
                updated.keluhan = list;
            }
        } else if (category === 'tataLaksana') {
            if (!presetTataLaksana.includes(trimmed)) {
                const list = [...presetTataLaksana, trimmed];
                setPresetTataLaksana(list);
                updated.tataLaksana = list;
            }
        } else if (category === 'tindakan') {
            if (!presetTindakan.includes(trimmed)) {
                const list = [...presetTindakan, trimmed];
                setPresetTindakan(list);
                updated.tindakan = list;
            }
        } else if (category === 'tindakLanjut') {
            if (!presetTindakLanjut.includes(trimmed)) {
                const list = [...presetTindakLanjut, trimmed];
                setPresetTindakLanjut(list);
                updated.tindakLanjut = list;

                const newMapping: TindakLanjutMappingItem[] = [
                    ...tindakLanjutMapping.filter(m => m.name !== trimmed),
                    { name: trimmed, status: statusMapping || 'Ringan' }
                ];
                setTindakLanjutMapping(newMapping);
                updated.tindakLanjutMapping = newMapping;
            }
        }

        savePresetsToStorageAndApi(updated);
        setVal('');
    };

    const handleEditPreset = (
        category: 'penyakit' | 'alergi' | 'keluhan' | 'tataLaksana' | 'tindakan' | 'tindakLanjut',
        oldItem: string
    ) => {
        if (category === 'tindakLanjut') {
            const currentMap = tindakLanjutMapping.find(m => m.name === oldItem);
            const currentStatus = currentMap?.status || 'Ringan';

            Swal.fire({
                title: 'Edit Tindak Lanjut & Pemetaan Status',
                html: `
                    <div style="text-align:left;display:flex;flex-direction:column;gap:12px;">
                        <div>
                            <label style="font-weight:700;font-size:0.85rem;">Nama Tindak Lanjut:</label>
                            <input id="swal-tl-name" class="swal2-input" value="${safeText(oldItem)}" style="margin:6px 0 0;width:100%;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-weight:700;font-size:0.85rem;">Pemetaan Status Sakit (Absensi):</label>
                            <select id="swal-tl-status" class="swal2-select" style="margin:6px 0 0;width:100%;box-sizing:border-box;">
                                <option value="NONE" ${currentStatus === 'NONE' ? 'selected' : ''}>Tanpa Absensi (Kembali ke Kelas)</option>
                                <option value="Ringan" ${currentStatus === 'Ringan' ? 'selected' : ''}>Sakit Ringan (Dirawat di UKS)</option>
                                <option value="Sedang" ${currentStatus === 'Sedang' ? 'selected' : ''}>Sakit Sedang (Dipulangkan / Rujuk RS)</option>
                                <option value="Berat" ${currentStatus === 'Berat' ? 'selected' : ''}>Sakit Berat (Opname RS)</option>
                                <option value="Kontrol" ${currentStatus === 'Kontrol' ? 'selected' : ''}>Sakit Kontrol (Kontrol Ulang)</option>
                            </select>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Simpan Perubahan',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#3083FF',
                preConfirm: () => {
                    const name = (document.getElementById('swal-tl-name') as HTMLInputElement)?.value?.trim();
                    const status = (document.getElementById('swal-tl-status') as HTMLSelectElement)?.value as any;
                    if (!name) {
                        Swal.showValidationMessage('Nama tidak boleh kosong!');
                        return false;
                    }
                    return { name, status };
                }
            }).then((res) => {
                if (res.isConfirmed && res.value) {
                    const { name: newItem, status: newStatus } = res.value;
                    const list = presetTindakLanjut.map(i => i === oldItem ? newItem : i);
                    const newMapping = tindakLanjutMapping.map(m => m.name === oldItem ? { name: newItem, status: newStatus } : m);

                    setPresetTindakLanjut(list);
                    setTindakLanjutMapping(newMapping);

                    savePresetsToStorageAndApi({
                        penyakit: presetPenyakit,
                        alergi: presetAlergi,
                        keluhan: presetKeluhan,
                        tataLaksana: presetTataLaksana,
                        tindakan: presetTindakan,
                        tindakLanjut: list,
                        tindakLanjutMapping: newMapping
                    });
                    Swal.fire({ icon: 'success', title: 'Data Diperbarui', timer: 1200, showConfirmButton: false });
                }
            });
            return;
        }

        Swal.fire({
            title: 'Edit Data',
            input: 'text',
            inputValue: oldItem,
            inputPlaceholder: 'Tuliskan teks baru...',
            showCancelButton: true,
            confirmButtonText: 'Simpan Perubahan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#3083FF',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Teks tidak boleh kosong!';
                }
            }
        }).then((res) => {
            if (res.isConfirmed && res.value) {
                const newItem = res.value.trim();
                let updated = { penyakit: presetPenyakit, alergi: presetAlergi, keluhan: presetKeluhan, tataLaksana: presetTataLaksana, tindakan: presetTindakan, tindakLanjut: presetTindakLanjut, tindakLanjutMapping };

                if (category === 'penyakit') {
                    const list = presetPenyakit.map(i => i === oldItem ? newItem : i);
                    setPresetPenyakit(list);
                    updated.penyakit = list;
                } else if (category === 'alergi') {
                    const list = presetAlergi.map(i => i === oldItem ? newItem : i);
                    setPresetAlergi(list);
                    updated.alergi = list;
                } else if (category === 'keluhan') {
                    const list = presetKeluhan.map(i => i === oldItem ? newItem : i);
                    setPresetKeluhan(list);
                    updated.keluhan = list;
                } else if (category === 'tataLaksana') {
                    const list = presetTataLaksana.map(i => i === oldItem ? newItem : i);
                    setPresetTataLaksana(list);
                    updated.tataLaksana = list;
                } else if (category === 'tindakan') {
                    const list = presetTindakan.map(i => i === oldItem ? newItem : i);
                    setPresetTindakan(list);
                    updated.tindakan = list;
                }

                savePresetsToStorageAndApi(updated);
                Swal.fire({ icon: 'success', title: 'Preset Diperbarui', timer: 1200, showConfirmButton: false });
            }
        });
    };

    const handleDeletePreset = (
        category: 'penyakit' | 'alergi' | 'keluhan' | 'tataLaksana' | 'tindakan' | 'tindakLanjut',
        item: string
    ) => {
        let updated = { penyakit: presetPenyakit, alergi: presetAlergi, keluhan: presetKeluhan, tataLaksana: presetTataLaksana, tindakan: presetTindakan, tindakLanjut: presetTindakLanjut, tindakLanjutMapping };

        if (category === 'penyakit') {
            const list = presetPenyakit.filter(i => i !== item);
            setPresetPenyakit(list);
            updated.penyakit = list;
        } else if (category === 'alergi') {
            const list = presetAlergi.filter(i => i !== item);
            setPresetAlergi(list);
            updated.alergi = list;
        } else if (category === 'keluhan') {
            const list = presetKeluhan.filter(i => i !== item);
            setPresetKeluhan(list);
            updated.keluhan = list;
        } else if (category === 'tataLaksana') {
            const list = presetTataLaksana.filter(i => i !== item);
            setPresetTataLaksana(list);
            updated.tataLaksana = list;
        } else if (category === 'tindakan') {
            const list = presetTindakan.filter(i => i !== item);
            setPresetTindakan(list);
            updated.tindakan = list;
        } else if (category === 'tindakLanjut') {
            const list = presetTindakLanjut.filter(i => i !== item);
            const mapping = tindakLanjutMapping.filter(m => m.name !== item);
            setPresetTindakLanjut(list);
            setTindakLanjutMapping(mapping);
            updated.tindakLanjut = list;
            updated.tindakLanjutMapping = mapping;
        }

        savePresetsToStorageAndApi(updated);
    };

    const availablePetugas = useMemo(() => {
        return Array.from(new Set(rows.map(r => r.petugas_nama).filter(Boolean))).sort();
    }, [rows]);

    const availableStatuses = useMemo(() => {
        return Array.from(new Set(rows.map(r => r.synced_status || r.tindak_lanjut).filter(Boolean))).sort();
    }, [rows]);

    const availablePrintGuruAsuh = useMemo(() => {
        if (!rawPrintRecords || rawPrintRecords.length === 0) return [];
        return Array.from(new Set(rawPrintRecords.map(r => r.guru_asuh).filter(g => g && g !== '-'))).sort();
    }, [rawPrintRecords]);

    const filteredPrintStudentList = useMemo(() => {
        if (!rawPrintRecords || rawPrintRecords.length === 0) return [];

        const q = printSiswaQuery.toLowerCase().trim();
        const map = new Map<string, PrintStudentItem>();

        rawPrintRecords.forEach(r => {
            if (printFilterKelas && r.kelas !== printFilterKelas) {
                return;
            }
            if (printFilterGuruAsuh && r.guru_asuh !== printFilterGuruAsuh) {
                return;
            }
            if (q && !(
                r.nama_siswa?.toLowerCase().includes(q) ||
                r.nisn?.toLowerCase().includes(q) ||
                r.kelas?.toLowerCase().includes(q)
            )) {
                return;
            }

            const key = r.nisn || r.nama_siswa;
            if (!map.has(key)) {
                map.set(key, {
                    nisn: r.nisn,
                    nama_siswa: r.nama_siswa,
                    kelas: r.kelas,
                    guru_asuh: r.guru_asuh,
                    gender: r.gender,
                    tempat_lahir: r.tempat_lahir,
                    tanggal_lahir: r.tanggal_lahir,
                    alamat: r.alamat,
                    count: 1
                });
            } else {
                map.get(key)!.count++;
            }
        });

        return Array.from(map.values()).sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));
    }, [rawPrintRecords, printSiswaQuery, printFilterKelas, printFilterGuruAsuh]);

    useEffect(() => {
        if (activeTab === 'CETAK' && rawPrintRecords.length === 0) {
            loadPrintStudentList();
        }
    }, [activeTab]);

    useEffect(() => {
        setListPage(1);
    }, [searchQuery, filterKelas, filterStatus, filterPetugas]);

    const filteredRows = useMemo(() => {
        const list = rows.filter(r => {
            const q = searchQuery.toLowerCase();
            const matchQ = !q || (
                r.nama_siswa?.toLowerCase().includes(q) ||
                r.nisn?.toLowerCase().includes(q) ||
                r.no_rekam_medis?.toLowerCase().includes(q) ||
                r.keluhan?.toLowerCase().includes(q)
            );
            const matchKelas = !filterKelas || r.kelas === filterKelas;
            const matchStatus = !filterStatus || (r.synced_status === filterStatus || r.tindak_lanjut === filterStatus);
            const matchPetugas = !filterPetugas || r.petugas_nama === filterPetugas;
            return matchQ && matchKelas && matchStatus && matchPetugas;
        });

        const maxDateMap = new Map<string, number>();
        list.forEach(r => {
            const key = r.nisn || r.nama_siswa || '';
            const t = new Date(r.created_at || r.tanggal).getTime();
            if (!maxDateMap.has(key) || t > maxDateMap.get(key)!) {
                maxDateMap.set(key, t);
            }
        });

        return list.sort((a, b) => {
            const keyA = a.nisn || a.nama_siswa || '';
            const keyB = b.nisn || b.nama_siswa || '';
            if (keyA !== keyB) {
                return (maxDateMap.get(keyB) || 0) - (maxDateMap.get(keyA) || 0);
            }
            return new Date(b.created_at || b.tanggal).getTime() - new Date(a.created_at || a.tanggal).getTime();
        });
    }, [rows, searchQuery, filterKelas, filterStatus, filterPetugas]);

    const totalItems = filteredRows.length;
    const totalPages = Math.ceil(totalItems / listLimit) || 1;

    const displayRows = useMemo(() => {
        const start = (listPage - 1) * listLimit;
        return filteredRows.slice(start, start + listLimit);
    }, [filteredRows, listPage, listLimit]);

    const studentSpanInfo = useMemo(() => {
        const spanInfo: { showStudentCell: boolean; rowSpan: number; studentIndex: number }[] = [];
        let i = 0;
        let sIdx = 0;
        while (i < displayRows.length) {
            const currentKey = displayRows[i].nisn || displayRows[i].nama_siswa;
            let count = 1;
            while (i + count < displayRows.length && (displayRows[i + count].nisn || displayRows[i + count].nama_siswa) === currentKey) {
                count++;
            }
            spanInfo.push({ showStudentCell: true, rowSpan: count, studentIndex: sIdx });
            for (let j = 1; j < count; j++) {
                spanInfo.push({ showStudentCell: false, rowSpan: 0, studentIndex: sIdx });
            }
            i += count;
            sIdx++;
        }
        return spanInfo;
    }, [displayRows]);

    const studentGroups = useMemo(() => {
        const groups: { nisn: string; nama_siswa: string; kelas: string; guru_asuh: string; records: RekamMedisRow[] }[] = [];
        displayRows.forEach(r => {
            const key = r.nisn || r.nama_siswa || '';
            let group = groups.find(g => g.nisn === key);
            if (!group) {
                group = {
                    nisn: key,
                    nama_siswa: r.nama_siswa,
                    kelas: r.kelas,
                    guru_asuh: r.guru_asuh,
                    records: []
                };
                groups.push(group);
            }
            group.records.push(r);
        });
        return groups;
    }, [displayRows]);

    return (
        <div className="kh-wrap">
            <div className="kh-container">
                {/* ── VIEW SWITCHER / TABS (4 TABS: INPUT, DAFTAR, CETAK, KONFIGURASI) ── */}
                <Tab<'INPUT' | 'LIST' | 'CETAK' | 'KONFIGURASI'>
                    tabs={[
                        { key: 'INPUT', label: 'Input Rekam Medis', shortLabel: 'Input', icon: 'bi-plus-circle-fill' },
                        { key: 'LIST', label: `Daftar Rekam Medis (${rows.length})`, shortLabel: `Daftar (${rows.length})`, icon: 'bi-journal-medical' },
                        { key: 'CETAK', label: 'Cetak Rekam Medis', shortLabel: 'Cetak', icon: 'bi-printer-fill' },
                        { key: 'KONFIGURASI', label: 'Konfigurasi', icon: 'bi-gear-fill' },
                    ]}
                    activeTab={activeTab}
                    onChange={(key) => {
                        setActiveTab(key);
                        if (key === 'LIST') loadRekamMedisList();
                        if (key === 'CETAK' && rawPrintRecords.length === 0) loadPrintStudentList();
                    }}
                    ariaLabel="Navigasi Rekam Medis UKS"
                    className="mb-4"
                    variant="slider"
                />

                {/* ── FILTER TOOLBAR (ONLY FOR LIST TAB) ── */}
                {activeTab === 'LIST' && (
                    <FilterToolbar className="mb-4">
                        <FilterSearch
                            label="Pencarian Data"
                            placeholder="Cari nama, NISN, No. RM, keluhan..."
                            value={searchQuery}
                            onChange={setSearchQuery}
                            grow={2}
                        />
                        <FilterSelect
                            label="Kelas"
                            icon="door-open"
                            value={filterKelas}
                            onChange={setFilterKelas}
                            options={[
                                { value: '', label: 'Semua Kelas' },
                                ...availableClasses.map(c => ({ value: c, label: `Kelas ${c}` }))
                            ]}
                        />
                        <FilterSelect
                            label="Status Sakit"
                            icon="activity"
                            value={filterStatus}
                            onChange={setFilterStatus}
                            options={[
                                { value: '', label: 'Semua Status' },
                                ...availableStatuses.map(s => ({ value: s, label: s }))
                            ]}
                        />
                        <FilterSelect
                            label="Petugas OP UKS"
                            icon="person-badge"
                            value={filterPetugas}
                            onChange={setFilterPetugas}
                            options={[
                                { value: '', label: 'Semua Petugas' },
                                ...availablePetugas.map(p => ({ value: p, label: p }))
                            ]}
                        />
                    </FilterToolbar>
                )}

                {/* ── TAB 1: FORM INPUT REKAM MEDIS ── */}
                {activeTab === 'INPUT' && (
                    <InputMedisTab
                        presetPenyakit={presetPenyakit}
                        presetAlergi={presetAlergi}
                        presetKeluhan={presetKeluhan}
                        presetTataLaksana={presetTataLaksana}
                        presetTindakan={presetTindakan}
                        presetTindakLanjut={presetTindakLanjut}
                        tindakLanjutMapping={tindakLanjutMapping}
                        petugasNama={petugasNama}
                        petugasNip={petugasNip}
                        onSuccessSubmit={() => {
                            loadRekamMedisList();
                            setActiveTab('LIST');
                        }}
                    />
                )}

                {/* ── TAB 2: DAFTAR REKAM MEDIS ── */}
                {activeTab === 'LIST' && (
                    <DaftarMedisTab
                        loadingList={loadingList}
                        filteredRows={filteredRows}
                        displayRows={displayRows}
                        studentSpanInfo={studentSpanInfo}
                        studentGroups={studentGroups}
                        syncingId={syncingId}
                        page={listPage}
                        limit={listLimit}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        onPageChange={setListPage}
                        onLimitChange={setListLimit}
                        handleOpenEditModal={handleOpenEditModal}
                        setSelectedRowDetail={setSelectedRowDetail}
                        handleDeleteRecord={handleDeleteRecord}
                        handleManualSync={handleManualSync}
                        tzFormatDate={tzFormatDate}
                    />
                )}

                {/* ── TAB 3: CETAK REKAM MEDIS ── */}
                {activeTab === 'CETAK' && (
                    <CetakMedisTab
                        printSiswaQuery={printSiswaQuery}
                        setPrintSiswaQuery={setPrintSiswaQuery}
                        printFilterKelas={printFilterKelas}
                        setPrintFilterKelas={setPrintFilterKelas}
                        printFilterGuruAsuh={printFilterGuruAsuh}
                        setPrintFilterGuruAsuh={setPrintFilterGuruAsuh}
                        availableClasses={availableClasses}
                        availablePrintGuruAsuh={availablePrintGuruAsuh}
                        printLoadingList={printLoadingList}
                        filteredPrintStudentList={filteredPrintStudentList}
                        printingNisn={printingNisn}
                        handleDirectPrintStudent={handleDirectPrintStudent}
                    />
                )}

                {/* ── TAB 4: KONFIGURASI PRESET ── */}
                {activeTab === 'KONFIGURASI' && (
                    <KonfigurasiMedisTab
                        presetPenyakit={presetPenyakit}
                        presetAlergi={presetAlergi}
                        presetKeluhan={presetKeluhan}
                        presetTataLaksana={presetTataLaksana}
                        presetTindakan={presetTindakan}
                        presetTindakLanjut={presetTindakLanjut}
                        tindakLanjutMapping={tindakLanjutMapping}
                        newPenyakitInput={newPenyakitInput}
                        setNewPenyakitInput={setNewPenyakitInput}
                        newAlergiInput={newAlergiInput}
                        setNewAlergiInput={setNewAlergiInput}
                        newKeluhanInput={newKeluhanInput}
                        setNewKeluhanInput={setNewKeluhanInput}
                        newTataLaksanaInput={newTataLaksanaInput}
                        setNewTataLaksanaInput={setNewTataLaksanaInput}
                        newTindakanInput={newTindakanInput}
                        setNewTindakanInput={setNewTindakanInput}
                        newTindakLanjutInput={newTindakLanjutInput}
                        setNewTindakLanjutInput={setNewTindakLanjutInput}
                        newTindakLanjutStatus={newTindakLanjutStatus}
                        setNewTindakLanjutStatus={setNewTindakLanjutStatus}
                        handleAddPreset={handleAddPreset}
                        handleEditPreset={handleEditPreset}
                        handleDeletePreset={handleDeletePreset}
                    />
                )}

                {/* ── DETAIL MODAL ── */}
                {selectedRowDetail && (
                    <Modal size="lg" onClose={() => setSelectedRowDetail(null)}>
                        <ModalHeader
                            title="Detail Lembar Rekam Medis Siswa"
                            subtitle={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--kh-text-primary)' }}>
                                        {selectedRowDetail.nama_siswa} ({selectedRowDetail.nisn})
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--kh-accent)', fontWeight: 700 }}>
                                        {selectedRowDetail.no_rekam_medis}
                                    </div>
                                </div>
                            }
                            icon="journal-medical"
                            onClose={() => setSelectedRowDetail(null)}
                        />
                        <ModalBody>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="rm-card-box" style={{ padding: '12px 16px', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', borderBottom: (selectedRowDetail.tempat_lahir || selectedRowDetail.alamat) ? '1px solid rgba(26, 115, 232, 0.4)' : 'none', paddingBottom: (selectedRowDetail.tempat_lahir || selectedRowDetail.alamat) ? '10px' : '0', marginBottom: (selectedRowDetail.tempat_lahir || selectedRowDetail.alamat) ? '10px' : '0' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--kh-text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            {selectedRowDetail.nama_siswa}
                                            <span className="surat-badge" style={{ background: 'rgba(0,56,168,0.1)', color: 'var(--kh-accent)', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px' }}>
                                                Kelas {selectedRowDetail.kelas || '-'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--kh-text-secondary)', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            <span>NISN: <code style={{ fontWeight: 700, color: 'var(--kh-accent)' }}>{selectedRowDetail.nisn}</code></span>
                                            {selectedRowDetail.guru_asuh && <span>Guru Asuh: <b>{selectedRowDetail.guru_asuh}</b></span>}
                                            <span>Gender: <b>{(selectedRowDetail.gender === 'L' || String(selectedRowDetail.gender).toUpperCase().startsWith('L')) ? 'Laki-laki' : (selectedRowDetail.gender === 'P' || String(selectedRowDetail.gender).toUpperCase().startsWith('P')) ? 'Perempuan' : (selectedRowDetail.gender || '-')}</b></span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, color: 'var(--kh-accent)', fontSize: '0.92rem' }}>{selectedRowDetail.no_rekam_medis}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-secondary)', marginTop: '1px' }}>
                                            <i className="bi bi-calendar3"></i> {tzFormatDate(selectedRowDetail.tanggal)} ({selectedRowDetail.waktu?.slice(0,5)} WITA)
                                        </div>
                                    </div>
                                </div>

                                {(selectedRowDetail.tempat_lahir || selectedRowDetail.alamat) && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
                                        {selectedRowDetail.tempat_lahir && (
                                            <div style={{ background: 'var(--n-card)', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)' }}>
                                                <span style={{ color: 'var(--kh-text-secondary)', fontWeight: 700, fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', marginBottom: '1px' }}>
                                                    <i className="bi bi-calendar-event" style={{ color: '#059669', marginRight: '4px' }}></i> Tempat, Tgl Lahir
                                                </span>
                                                <span style={{ fontWeight: 600, color: 'var(--kh-text-primary)' }}>
                                                    {selectedRowDetail.tempat_lahir}{selectedRowDetail.tanggal_lahir ? `, ${tzFormatDate(selectedRowDetail.tanggal_lahir)}` : ''}
                                                </span>
                                            </div>
                                        )}
                                        {selectedRowDetail.alamat && (
                                            <div style={{ background: 'var(--n-card)', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid rgba(26, 115, 232, 0.75)', gridColumn: selectedRowDetail.tempat_lahir ? 'span 1' : 'span 2' }}>
                                                <span style={{ color: 'var(--kh-text-secondary)', fontWeight: 700, fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', marginBottom: '1px' }}>
                                                    <i className="bi bi-geo-alt-fill" style={{ color: '#dc2626', marginRight: '4px' }}></i> Alamat Siswa
                                                </span>
                                                <span style={{ fontWeight: 600, color: 'var(--kh-text-primary)' }}>
                                                    {selectedRowDetail.alamat}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                <div className="rm-card-box" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="bi bi-activity"></i> Riwayat Penyakit
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-primary)', fontWeight: 600, minHeight: '28px', maxHeight: '75px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {ensureArray(selectedRowDetail.riwayat_penyakit).length > 0 ? ensureArray(selectedRowDetail.riwayat_penyakit).join(', ') : '-'}
                                    </div>
                                </div>

                                <div className="rm-card-box" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="bi bi-exclamation-triangle-fill"></i> Riwayat Alergi Obat
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-primary)', fontWeight: 600, minHeight: '28px', maxHeight: '75px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {ensureArray(selectedRowDetail.riwayat_alergi_obat).length > 0 ? ensureArray(selectedRowDetail.riwayat_alergi_obat).join(', ') : 'Tidak Ada Alergi Obat'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                <div className="rm-card-box" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="bi bi-chat-square-text-fill"></i> Keluhan Siswa
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-primary)', fontWeight: 600, minHeight: '28px', maxHeight: '75px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {selectedRowDetail.keluhan || '-'}
                                    </div>
                                </div>

                                <div className="rm-card-box" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="bi bi-capsule"></i> Tata Laksana / Pengobatan
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-primary)', fontWeight: 600, minHeight: '28px', maxHeight: '75px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {selectedRowDetail.tata_laksana || '-'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                <div className="rm-card-box" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="bi bi-bandaid-fill"></i> Tindakan Medis
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-primary)', fontWeight: 600, minHeight: '28px', maxHeight: '75px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {selectedRowDetail.tindakan && selectedRowDetail.tindakan.length > 0 ? selectedRowDetail.tindakan.join(', ') : '-'}
                                    </div>
                                </div>

                                <div className="rm-card-box" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="bi bi-arrow-right-circle-fill"></i> Tindak Lanjut Pasca Penanganan
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kh-text-primary)', fontWeight: 700, minHeight: '28px', maxHeight: '75px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {selectedRowDetail.tindak_lanjut || '-'}
                                    </div>
                                </div>
                            </div>
                            </div>
                        </ModalBody>
                        <ModalFooter align="between">
                            <div style={{ fontSize: '0.78rem', color: 'var(--kh-text-secondary)' }}>
                                <i className="bi bi-person-badge-fill" style={{ color: 'var(--kh-accent)', marginRight: '4px' }}></i>
                                Petugas : <b style={{ color: 'var(--kh-text-primary)' }}>{selectedRowDetail.petugas_nama || 'Admin UKS'}</b>
                            </div>
                            <Button variant="cancel" onClick={() => setSelectedRowDetail(null)}>
                                Tutup
                            </Button>
                        </ModalFooter>
                    </Modal>
                )}

                {/* ── EDIT MODAL ── */}
                {selectedRowEdit && (
                    <Modal size="lg" onClose={() => setSelectedRowEdit(null)}>
                        <ModalHeader
                            title="Edit Lembar Rekam Medis"
                            subtitle={`${selectedRowEdit.nama_siswa} (${selectedRowEdit.nisn}) - ${selectedRowEdit.no_rekam_medis}`}
                            icon="pencil-square"
                            onClose={() => setSelectedRowEdit(null)}
                        />
                        <ModalBody>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                                <div className="rm-card-box" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0 }}>
                                            <i className="bi bi-activity"></i> Riwayat Penyakit
                                        </label>
                                        <MultiSelectCheckboxDropdown
                                            title="Pilih"
                                            options={presetPenyakit}
                                            currentText={editRiwayatPenyakitText}
                                            onTextChange={setEditRiwayatPenyakitText}
                                        />
                                    </div>
                                    <textarea
                                        className="kh-pill-input"
                                        rows={2}
                                        value={editRiwayatPenyakitText}
                                        onChange={e => setEditRiwayatPenyakitText(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>

                                <div className="rm-card-box" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0 }}>
                                            <i className="bi bi-exclamation-triangle-fill"></i> Riwayat Alergi Obat
                                        </label>
                                        <MultiSelectCheckboxDropdown
                                            title="Pilih"
                                            options={presetAlergi}
                                            currentText={editRiwayatAlergiText}
                                            onTextChange={setEditRiwayatAlergiText}
                                        />
                                    </div>
                                    <textarea
                                        className="kh-pill-input"
                                        rows={2}
                                        value={editRiwayatAlergiText}
                                        onChange={e => setEditRiwayatAlergiText(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                                <div className="rm-card-box" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0 }}>
                                            <i className="bi bi-chat-square-text-fill"></i> Keluhan Siswa
                                        </label>
                                        <MultiSelectCheckboxDropdown
                                            title="Pilih"
                                            options={presetKeluhan}
                                            currentText={editKeluhanText}
                                            onTextChange={setEditKeluhanText}
                                        />
                                    </div>
                                    <textarea
                                        className="kh-pill-input"
                                        rows={2}
                                        value={editKeluhanText}
                                        onChange={e => setEditKeluhanText(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>

                                <div className="rm-card-box" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0 }}>
                                            <i className="bi bi-capsule"></i> Tata Laksana
                                        </label>
                                        <MultiSelectCheckboxDropdown
                                            title="Pilih"
                                            options={presetTataLaksana}
                                            currentText={editTataLaksanaText}
                                            onTextChange={setEditTataLaksanaText}
                                        />
                                    </div>
                                    <textarea
                                        className="kh-pill-input"
                                        rows={2}
                                        value={editTataLaksanaText}
                                        onChange={e => setEditTataLaksanaText(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                                <div className="rm-card-box" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0 }}>
                                            <i className="bi bi-bandaid-fill"></i> Tindakan Medis
                                        </label>
                                        <MultiSelectCheckboxDropdown
                                            title="Pilih"
                                            options={presetTindakan}
                                            currentText={editTindakanText}
                                            onTextChange={setEditTindakanText}
                                        />
                                    </div>
                                    <textarea
                                        className="kh-pill-input"
                                        rows={2}
                                        value={editTindakanText}
                                        onChange={e => setEditTindakanText(e.target.value)}
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>

                                <div className="rm-card-box" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--kh-accent)', margin: 0 }}>
                                            <i className="bi bi-arrow-right-circle-fill"></i> Tindak Lanjut
                                        </label>
                                        <MultiSelectCheckboxDropdown
                                            title="Pilih"
                                            options={presetTindakLanjut}
                                            currentText={editTindakLanjutText}
                                            onTextChange={setEditTindakLanjutText}
                                            singleSelect={true}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        className="kh-pill-input"
                                        value={editTindakLanjutText}
                                        onChange={e => setEditTindakLanjutText(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                            </div>
                        </ModalBody>
                        <ModalFooter align="between">
                            <Button variant="cancel" onClick={() => setSelectedRowEdit(null)}>
                                Batal
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSaveEditRecord}
                                isLoading={isUpdatingRecord}
                                leftIcon={<i className="bi bi-save-fill" />}
                            >
                                Simpan Perubahan
                            </Button>
                        </ModalFooter>
                    </Modal>
                )}

                {/* ── DELETE MODAL ── */}
                {deletingRow && (
                    <Modal size="sm" onClose={() => setDeletingRow(null)}>
                        <ModalHeader
                            title="Konfirmasi Hapus Data"
                            icon="exclamation-triangle"
                            onClose={() => setDeletingRow(null)}
                        />
                        <ModalBody>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--kh-text-primary)' }}>
                                Apakah Anda yakin ingin menghapus data rekam medis <b>{deletingRow.no_rekam_medis}</b> untuk siswa <b>{deletingRow.nama_siswa}</b>?
                            </p>
                            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--kh-text-secondary)' }}>
                                Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </ModalBody>
                        <ModalFooter align="between">
                            <Button variant="cancel" onClick={() => setDeletingRow(null)}>
                                Batal
                            </Button>
                            <Button
                                variant="danger"
                                onClick={confirmDeleteRecord}
                                isLoading={isDeletingRecord}
                                leftIcon={<i className="bi bi-trash-fill" />}
                            >
                                Ya, Hapus Data
                            </Button>
                        </ModalFooter>
                    </Modal>
                )}
            </div>
        </div>
    );
}
