'use client';

import React, { useState, useEffect } from 'react';
import { createBanding } from '../lib/bandingApi';
import Swal from 'sweetalert2';
import { formatDateId } from '@/lib/date-utils';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineSelect } from '@/components/ui/InlineSelect';

interface KoreksiItem {
    id: string;
    field: string;
    nilaiLama: any;
    nilaiBaru: any;
}

interface AjukanBandingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    journal: {
        id: number;
        nip: string;
        nama_guru: string;
        tanggal: string;
        hari: string;
        jam_ke: string;
        kelas: string;
        mata_pelajaran: string;
        materi?: string;
        refleksi?: string;
        guru_pengganti?: string;
        kategori_kehadiran?: string;
        durasi_terlambat?: string | number;
        keterangan_terlambat?: string;
        status_pengganti?: string;
        guru_piket?: string;
        keterangan_tambahan?: string;
    } | null;
}

const KOREKSI_FIELDS = [
    { value: 'kelas', label: 'Kelas' },
    { value: 'mata_pelajaran', label: 'Mata Pelajaran' },
    { value: 'jam_ke', label: 'Jam Ke' },
    { value: 'materi', label: 'Materi' },
    { value: 'refleksi', label: 'Refleksi' },
    { value: 'guru_pengganti', label: 'Guru Pengganti' },
    { value: 'kategori_kehadiran', label: 'Status Kehadiran' },
    { value: 'durasi_terlambat', label: 'Durasi Terlambat (Menit)' },
    { value: 'status_pengganti', label: 'Status Pengganti' },
    { value: 'guru_piket', label: 'Guru Piket' },
    { value: 'keterangan_tambahan', label: 'Ket. Tambahan' },
];

function getFieldLabel(field: string) {
    return KOREKSI_FIELDS.find(f => f.value === field)?.label || field;
}

function getFieldDisplayValue(field: string, value: any) {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
}

function formatJamSelection(hours: number[]): string {
    if (hours.length === 0) return '';
    const sorted = Array.from(new Set(hours)).sort((a, b) => a - b);
    const groups: number[][] = [];
    let current: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
            current.push(sorted[i]);
        } else {
            groups.push(current);
            current = [sorted[i]];
        }
    }
    groups.push(current);
    return groups.map(g => g.length > 1 ? `${g[0]}-${g[g.length - 1]}` : `${g[0]}`).join(',');
}

function parseJamSelection(val: string): number[] {
    if (!val) return [];
    const parts = String(val).split(/[,;]/);
    const res: number[] = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [s, e] = trimmed.split('-').map(x => parseInt(x.trim(), 10));
            if (!isNaN(s) && !isNaN(e) && s <= e) {
                for (let i = s; i <= e; i++) res.push(i);
            }
        } else {
            const n = parseInt(trimmed, 10);
            if (!isNaN(n)) res.push(n);
        }
    }
    return Array.from(new Set(res)).sort((a, b) => a - b);
}

export default function AjukanBandingModal({ isOpen, onClose, onSuccess, journal }: AjukanBandingModalProps) {
    const [alasan, setAlasan] = useState('');
    const [koreksiList, setKoreksiList] = useState<KoreksiItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Dropdown options (fetched from DB)
    const [kelasOpts, setKelasOpts] = useState<{ value: string; label: string }[]>([]);
    const [mapelOpts, setMapelOpts] = useState<{ value: string; label: string }[]>([]);
    const [guruOpts, setGuruOpts] = useState<{ value: string; label: string }[]>([]);
    const [kategoriOpts, setKategoriOpts] = useState<{ value: string; label: string }[]>([
        { value: 'Sesuai', label: 'Sesuai' },
        { value: 'Terlambat', label: 'Terlambat' },
        { value: 'Tukaran', label: 'Tukaran' },
        { value: 'Diganti', label: 'Diganti' },
        { value: 'Tidak Hadir', label: 'Tidak Hadir' },
        { value: 'Kosong', label: 'Kosong' },
    ]);
    const [statusPenggantiOpts, setStatusPenggantiOpts] = useState<{ value: string; label: string }[]>([
        { value: 'Sesuai', label: 'Sesuai' },
        { value: 'Terlambat', label: 'Terlambat' },
        { value: 'Tukaran', label: 'Tukaran' },
        { value: 'Diganti', label: 'Diganti' },
        { value: 'Tidak Hadir', label: 'Tidak Hadir' },
    ]);
    const [waktuOpts, setWaktuOpts] = useState<{ value: string; label: string }[]>([]);
    const [loadingOpts, setLoadingOpts] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setAlasan('');
            setKoreksiList([]);
            setSubmitting(false);
            setSuccessMsg('');
            setErrorMsg('');
        }
    }, [isOpen]);

    // Fetch dropdown options when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setLoadingOpts(true);

        Promise.all([
            fetch('/api/master/kelas?limit=500').then(r => r.json()).catch(() => ({})),
            fetch('/api/master/mapel?limit=500').then(r => r.json()).catch(() => ({})),
            fetch('/api/master/waktu?limit=10000').then(r => r.json()).catch(() => ({})),
            fetch('/api/master/guru?limit=500').then(r => r.json()).catch(() => ({})),
            fetch('/api/master/dropdown').then(r => r.json()).catch(() => ({})),
        ]).then(([kelasJson, mapelJson, waktuJson, guruJson, dropdownJson]) => {
            if (kelasJson?.ok && Array.isArray(kelasJson.data)) {
                const unique = Array.from(new Map(kelasJson.data.map((k: any) => [k.nama, k.nama])).values());
                setKelasOpts(unique.map((v: any) => ({ value: String(v), label: String(v) })));
            }
            if (mapelJson?.ok && Array.isArray(mapelJson.data)) {
                const unique = Array.from(new Map(mapelJson.data.map((m: any) => [m.nama, m.nama])).values());
                setMapelOpts(unique.map((v: any) => ({ value: String(v), label: String(v) })));
            }
            if (guruJson?.ok && Array.isArray(guruJson.data)) {
                const list = guruJson.data.map((g: any) => g.nama_lengkap || g.nama).filter(Boolean);
                const unique = Array.from(new Set(list));
                setGuruOpts(unique.map((name: any) => ({ value: String(name), label: String(name) })));
            }
            if (waktuJson?.ok && Array.isArray(waktuJson.data)) {
                const opts = waktuJson.data.map((w: any) => ({
                    value: String(w.jam_ke || w.id),
                    label: `Jam Ke-${w.jam_ke}${w.waktu_mulai ? ' (' + w.waktu_mulai + (w.waktu_selesai ? ' - ' + w.waktu_selesai : '') + ')' : ''}`
                })).filter((w: any) => w.value);
                const unique = Array.from(new Map(opts.map((o: any) => [o.value, o])).values());
                setWaktuOpts(unique as any);
            }

            if (dropdownJson?.data) {
                const dd = dropdownJson.data;
                if (Array.isArray(dd.kategori_kehadiran) && dd.kategori_kehadiran.length > 0) {
                    setKategoriOpts(dd.kategori_kehadiran);
                }
                if (Array.isArray(dd.statusPengganti) && dd.statusPengganti.length > 0) {
                    setStatusPenggantiOpts(dd.statusPengganti);
                }
            }
        }).finally(() => setLoadingOpts(false));
    }, [isOpen]);

    if (!isOpen || !journal) return null;

    const addKoreksi = (field: string) => {
        if (koreksiList.some(k => k.field === field)) return;
        const nilaiLama = (journal as any)[field] ?? '';
        setKoreksiList(prev => [...prev, {
            id: `${field}-${Date.now()}`,
            field,
            nilaiLama,
            nilaiBaru: '',
        }]);
    };

    const removeKoreksi = (id: string) => {
        setKoreksiList(prev => prev.filter(k => k.id !== id));
    };

    const updateNilaiBaru = (id: string, nilaiBaru: any) => {
        setKoreksiList(prev => prev.map(k => k.id === id ? { ...k, nilaiBaru } : k));
    };

    const toggleJamItem = (itemId: string, currentVal: string, hourNum: number) => {
        const currentHours = parseJamSelection(currentVal);
        let nextHours: number[];
        if (currentHours.includes(hourNum)) {
            nextHours = currentHours.filter(h => h !== hourNum);
        } else {
            nextHours = [...currentHours, hourNum];
        }
        updateNilaiBaru(itemId, formatJamSelection(nextHours));
    };

    const handleSubmit = async () => {
        if (!alasan.trim()) {
            Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Alasan wajib diisi!', showConfirmButton: false, timer: 3000 });
            return;
        }
        if (koreksiList.length === 0) {
            Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'Tambahkan minimal satu koreksi.', showConfirmButton: false, timer: 3000 });
            return;
        }

        if (koreksiList.some(k => !String(k.nilaiBaru).trim())) {
            Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Isi semua kolom Nilai Baru!', showConfirmButton: false, timer: 3000 });
            return;
        }

        const confirm = await Swal.fire({
            toast: true,
            position: 'top',
            icon: 'question',
            title: 'Kirim Banding?',
            text: 'Pastikan data koreksi sudah benar sebelum dikirim.',
            showCancelButton: true,
            confirmButtonText: 'Ya, Kirim',
            cancelButtonText: 'Batal',
            reverseButtons: true,
        });
        if (!confirm.isConfirmed) return;

        setSubmitting(true);
        setErrorMsg('');
        try {
            const koreksi = koreksiList.map(k => ({
                field: k.field,
                nilai_lama: k.nilaiLama,
                nilai_baru: k.nilaiBaru,
            }));
            await createBanding({
                jurnalId: journal.id,
                alasan: alasan.trim(),
                koreksi,
            });
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: 'Banding berhasil dikirim!',
                showConfirmButton: false,
                timer: 2000,
            });
            setSuccessMsg('Banding berhasil dikirim!');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1800);
        } catch (err: any) {
            setErrorMsg(err.message || 'Gagal mengirim banding.');
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal mengirim banding.' });
        } finally {
            setSubmitting(false);
        }
    };

    const availFields = KOREKSI_FIELDS.filter(f => !koreksiList.some(k => k.field === f.value));

    // Preset options for Jam Ke dropdown
    const jamPresets = [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
        '1-2', '3-4', '5-6', '7-8', '9-10', '11-12',
        '1-3', '4-6', '7-9', '10-12',
    ];

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            variant="default"
            title="Ajukan Banding"
            subtitle={`Jurnal — ${journal.hari ? journal.hari + ', ' : ''}${formatDateId(journal.tanggal)} · Jam ke-${journal.jam_ke} · ${journal.kelas}`}
            icon="exclamation-triangle"
        >
            <ModalBody className="abm__body">
                {/* Info Jurnal */}
                <div className="abm__jurnalInfo">
                    <div className="abm__infoRow"><span>Guru</span><strong>{journal.nama_guru}</strong></div>
                    <div className="abm__infoRow"><span>Kelas</span><strong>{journal.kelas}</strong></div>
                    <div className="abm__infoRow"><span>Mapel</span><strong>{journal.mata_pelajaran}</strong></div>
                </div>

                {/* Inline feedback messages */}
                {successMsg && (
                    <div className="abm__msg abm__msgSuccess">
                        <i className="bi bi-check-circle-fill" /> {successMsg}
                    </div>
                )}
                {errorMsg && (
                    <div className="abm__msg abm__msgError">
                        <i className="bi bi-exclamation-circle-fill" /> {errorMsg}
                    </div>
                )}

                {/* Alasan */}
                <div className="abm__field">
                    <label className="abm__label">Alasan Banding <span className="abm__required">*</span></label>
                    <textarea
                        className="abm__textarea"
                        placeholder="Jelaskan mengapa Anda mengajukan banding..."
                        value={alasan}
                        onChange={e => { setAlasan(e.target.value); setErrorMsg(''); }}
                        rows={3}
                    />
                </div>

                {/* Daftar koreksi */}
                <div className="abm__koreksiSection">
                    <div className="abm__koreksiHeader">
                        <label className="abm__label">Daftar Koreksi <span className="abm__required">*</span></label>
                        <span className="abm__badge">{koreksiList.length} item</span>
                    </div>

                    {/* Add field dropdown */}
                    {availFields.length > 0 && (
                        <div className="abm__addRow">
                            <InlineSelect
                                value=""
                                onChange={(val) => { if (val) addKoreksi(val); }}
                                minWidth="100%"
                                height="38px"
                                title="Tambah field yang dikoreksi"
                            >
                                <option value="">+ Tambah field yang dikoreksi...</option>
                                {availFields.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </InlineSelect>
                        </div>
                    )}

                    {/* Koreksi items */}
                    {koreksiList.map(item => {
                        const parsedHours = item.field === 'jam_ke' ? parseJamSelection(item.nilaiBaru) : [];

                        return (
                            <div key={item.id} className="abm__koreksiItem">
                                <div className="abm__koreksiTitle">
                                    <span className="abm__fieldName">{getFieldLabel(item.field)}</span>
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        icon="delete"
                                        onClick={() => removeKoreksi(item.id)}
                                        title="Hapus koreksi ini"
                                        className="!w-7 !h-7 !p-0 !min-h-0 flex items-center justify-center !rounded-lg"
                                    />
                                </div>
                                <div className="abm__koreksiRow">
                                    <div className="abm__koreksiCol">
                                        <label className="abm__koreksiLabel">Nilai Lama</label>
                                        <div className="abm__koreksiValue">{getFieldDisplayValue(item.field, item.nilaiLama)}</div>
                                    </div>
                                    <div className="abm__koreksiArrow"><i className="bi bi-arrow-right" /></div>
                                    <div className="abm__koreksiCol">
                                        <label className="abm__koreksiLabel">Nilai Baru <span className="abm__required">*</span></label>

                                        {item.field === 'kategori_kehadiran' ? (
                                            <InlineSelect
                                                value={item.nilaiBaru || ''}
                                                onChange={val => updateNilaiBaru(item.id, val)}
                                                disabled={loadingOpts}
                                                minWidth="100%"
                                                height="38px"
                                                title="Pilih status kehadiran"
                                            >
                                                <option value="">Pilih status...</option>
                                                {kategoriOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </InlineSelect>
                                        ) : item.field === 'status_pengganti' ? (
                                            <InlineSelect
                                                value={item.nilaiBaru || ''}
                                                onChange={val => updateNilaiBaru(item.id, val)}
                                                disabled={loadingOpts}
                                                minWidth="100%"
                                                height="38px"
                                                title="Pilih status pengganti"
                                            >
                                                <option value="">Pilih status pengganti...</option>
                                                {statusPenggantiOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </InlineSelect>
                                        ) : item.field === 'kelas' ? (
                                            <InlineSelect
                                                value={item.nilaiBaru || ''}
                                                onChange={val => updateNilaiBaru(item.id, val)}
                                                disabled={loadingOpts}
                                                minWidth="100%"
                                                height="38px"
                                                title="Pilih kelas"
                                            >
                                                <option value="">Pilih kelas...</option>
                                                {kelasOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </InlineSelect>
                                        ) : item.field === 'mata_pelajaran' ? (
                                            <InlineSelect
                                                value={item.nilaiBaru || ''}
                                                onChange={val => updateNilaiBaru(item.id, val)}
                                                disabled={loadingOpts}
                                                minWidth="100%"
                                                height="38px"
                                                title="Pilih mata pelajaran"
                                            >
                                                <option value="">Pilih mapel...</option>
                                                {mapelOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </InlineSelect>
                                        ) : (item.field === 'guru_pengganti' || item.field === 'guru_piket') ? (
                                            guruOpts.length > 0 ? (
                                                <InlineSelect
                                                    value={item.nilaiBaru || ''}
                                                    onChange={val => updateNilaiBaru(item.id, val)}
                                                    disabled={loadingOpts}
                                                    minWidth="100%"
                                                    height="38px"
                                                    title={`Pilih ${getFieldLabel(item.field)}`}
                                                >
                                                    <option value="">-- Pilih Guru --</option>
                                                    {guruOpts.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                                </InlineSelect>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="abm__input"
                                                    value={item.nilaiBaru || ''}
                                                    onChange={e => updateNilaiBaru(item.id, e.target.value)}
                                                    placeholder="Nama Guru..."
                                                />
                                            )
                                        ) : item.field === 'jam_ke' ? (
                                            <div className="flex flex-col gap-2">
                                                <InlineSelect
                                                    value={item.nilaiBaru || ''}
                                                    onChange={val => updateNilaiBaru(item.id, val)}
                                                    disabled={loadingOpts}
                                                    minWidth="100%"
                                                    height="38px"
                                                    title="Pilih jam ke"
                                                >
                                                    <option value="">-- Pilih Jam Ke --</option>
                                                    {/* Jika nilai saat ini belum ada di presets, tampilkan sebagai terpilih */}
                                                    {item.nilaiBaru && !jamPresets.includes(item.nilaiBaru) && (
                                                        <option value={item.nilaiBaru}>
                                                            Jam Ke-{item.nilaiBaru} (Terpilih)
                                                        </option>
                                                    )}
                                                    <optgroup label="Satu Jam">
                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                                            <option key={h} value={String(h)}>Jam Ke-{h}</option>
                                                        ))}
                                                    </optgroup>
                                                    <optgroup label="Blok 2 Jam">
                                                        {['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'].map(r => (
                                                            <option key={r} value={r}>Jam Ke-{r}</option>
                                                        ))}
                                                    </optgroup>
                                                    <optgroup label="Blok 3 Jam">
                                                        {['1-3', '4-6', '7-9', '10-12'].map(r => (
                                                            <option key={r} value={r}>Jam Ke-{r}</option>
                                                        ))}
                                                    </optgroup>
                                                </InlineSelect>

                                                {/* Quick Chips untuk Jam 1 - 12 */}
                                                <div>
                                                    <div className="text-[10px] text-[var(--n-muted)] font-medium mb-1 flex items-center justify-between">
                                                        <span>Pilih cepat / rangkai jam:</span>
                                                        {item.nilaiBaru && (
                                                            <span className="text-[var(--n-primary)] font-bold">Jam: {item.nilaiBaru}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => {
                                                            const isSelected = parsedHours.includes(h);
                                                            return (
                                                                <Button
                                                                    key={h}
                                                                    type="button"
                                                                    variant={isSelected ? 'primary' : 'outline'}
                                                                    size="sm"
                                                                    onClick={() => toggleJamItem(item.id, item.nilaiBaru, h)}
                                                                    className={`!w-7 !h-7 !p-0 !min-h-0 !text-xs font-bold !rounded-lg flex items-center justify-center ${
                                                                        isSelected
                                                                            ? '!bg-[var(--n-primary)] !text-white !border-[var(--n-primary)] shadow-sm'
                                                                            : '!bg-[var(--n-card)] !text-[var(--n-ink)] !border-[var(--n-border)] hover:!bg-[var(--n-soft)]'
                                                                    }`}
                                                                    title={`Jam Ke-${h}`}
                                                                >
                                                                    {h}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : item.field === 'durasi_terlambat' ? (
                                            <input
                                                type="number"
                                                min="0"
                                                className="abm__input"
                                                value={item.nilaiBaru || ''}
                                                onChange={e => updateNilaiBaru(item.id, e.target.value)}
                                                placeholder="Menit keterlambatan (mis. 15)..."
                                            />
                                        ) : (
                                            <textarea
                                                className="abm__textarea abm__textareaSm"
                                                value={item.nilaiBaru || ''}
                                                onChange={e => updateNilaiBaru(item.id, e.target.value)}
                                                rows={2}
                                                placeholder={`Ketik ${getFieldLabel(item.field)} baru...`}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {koreksiList.length === 0 && (
                        <div className="abm__emptyKoreksi">Pilih field di atas untuk menambahkan koreksi.</div>
                    )}
                </div>
            </ModalBody>

            <ModalFooter align="between">
                <Button variant="cancel" onClick={onClose} disabled={submitting}>
                    Batal
                </Button>
                <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
                    <i className="bi bi-send mr-1.5" />
                    Kirim Banding
                </Button>
            </ModalFooter>

            <style jsx>{`
                :global(.abm__body) {
                    padding: 14px 18px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 14px !important;
                    overflow-y: auto !important;
                    max-height: calc(85vh - 120px);
                    scrollbar-width: thin;
                }

                .abm__jurnalInfo {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    padding: 10px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .abm__infoRow {
                    display: flex;
                    gap: 8px;
                    font-size: 0.8rem;
                }
                .abm__infoRow span {
                    color: var(--n-muted);
                    min-width: 70px;
                }
                .abm__infoRow strong {
                    color: var(--n-ink);
                }

                .abm__field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .abm__label {
                    font-size: 0.75rem;
                    font-weight: 650;
                    color: var(--n-muted);
                }
                .abm__required {
                    color: #ef4444;
                }

                .abm__textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border-radius: 10px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-ink);
                    font-size: 0.82rem;
                    font-family: inherit;
                    resize: vertical;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .abm__textarea:focus {
                    outline: none;
                    border-color: var(--n-primary);
                    box-shadow: var(--n-ring);
                }
                .abm__textareaSm {
                    resize: none;
                }

                .abm__koreksiSection {
                    background: var(--n-soft);
                    border: 1px solid var(--n-border);
                    border-radius: 12px;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .abm__koreksiHeader {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .abm__badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    background: var(--n-primary);
                    color: white;
                    border-radius: 20px;
                }

                .abm__addRow {
                    width: 100%;
                }

                .abm__koreksiItem {
                    background: var(--n-card);
                    border: 1px solid var(--n-border);
                    border-radius: 10px;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .abm__koreksiTitle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .abm__fieldName {
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: var(--n-primary);
                }
                .abm__removeBtn {
                    width: 26px;
                    height: 26px;
                    border-radius: 6px;
                    border: 1px solid #fee2e2;
                    background: none;
                    color: #ef4444;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .abm__removeBtn:hover {
                    background: #fee2e2;
                }

                .abm__koreksiRow {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                }
                .abm__koreksiCol {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .abm__koreksiLabel {
                    font-size: 0.68rem;
                    font-weight: 600;
                    color: var(--n-muted);
                }
                .abm__koreksiValue {
                    padding: 6px 10px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-soft);
                    color: var(--n-muted);
                    font-size: 0.78rem;
                    min-height: 38px;
                    display: flex;
                    align-items: center;
                    word-break: break-word;
                    font-style: italic;
                    box-sizing: border-box;
                }
                .abm__koreksiArrow {
                    color: var(--n-muted);
                    padding-top: 24px;
                    font-size: 0.9rem;
                    flex-shrink: 0;
                }

                .abm__input {
                    width: 100%;
                    height: 38px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-card);
                    color: var(--n-ink);
                    font-size: 0.8rem;
                    outline: none;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .abm__input:focus {
                    border-color: var(--n-primary);
                    box-shadow: var(--n-ring);
                }

                .abm__emptyKoreksi {
                    text-align: center;
                    padding: 16px;
                    color: var(--n-muted);
                    font-size: 0.8rem;
                    font-style: italic;
                }

                @media (max-width: 520px) {
                    .abm__koreksiRow {
                        flex-direction: column;
                    }
                    .abm__koreksiArrow {
                        transform: rotate(90deg);
                        padding: 0;
                        align-self: center;
                    }
                }

                .abm__msg {
                    padding: 10px 14px;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .abm__msgSuccess {
                    background: rgba(34, 197, 94, 0.15);
                    color: #16a34a;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                }
                .abm__msgError {
                    background: rgba(239, 68, 68, 0.12);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }
                :global(.dark) .abm__msgSuccess {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                }
                :global(.dark) .abm__msgError {
                    background: rgba(239, 68, 68, 0.15);
                    color: #f87171;
                }
            `}</style>
        </Modal>
    );
}
