'use client';

import { notulensiStatus } from '@acca/shared/notulensi-status.cjs';

import React, { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineSelect } from '@/components/ui/InlineSelect';
import DatePicker from '@/components/ui/DatePicker';
import { swalWarning } from '@/lib/swal-premium';

export interface PoinHasilRapat {
    id: string;
    teks: string;
    status: 'Belum' | 'Proses' | 'Selesai';
    pic?: string;
    tenggat?: string;
    keterangan?: string;
}

export interface NotulensiItem {
    id?: string;
    agenda: string;
    tanggal: string;
    waktu_mulai?: string;
    waktu_selesai?: string;
    lokasi?: string;
    pimpinan_rapat?: string;
    notulis?: string;
    peserta?: string;
    poin_poin: PoinHasilRapat[];
    status: 'Belum' | 'Proses' | 'Selesai';
    catatan?: string;
    agenda_id?: string | null;
}

interface NotulensiModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: NotulensiItem) => Promise<void>;
    initialData?: NotulensiItem | null;
    saving?: boolean;
}

const EMPTY_FORM: NotulensiItem = {
    agenda: '',
    tanggal: new Date().toISOString().slice(0, 10),
    waktu_mulai: '',
    waktu_selesai: '',
    lokasi: '',
    pimpinan_rapat: '',
    notulis: '',
    peserta: '',
    poin_poin: [],
    status: 'Belum',
    catatan: '',
};

const STATUS_POIN_OPTIONS = [
    { value: 'Belum', label: 'Belum' },
    { value: 'Proses', label: 'Proses' },
    { value: 'Selesai', label: 'Selesai' },
];

export default function NotulensiModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    saving = false,
}: NotulensiModalProps) {
    const [form, setForm] = useState<NotulensiItem>({ ...EMPTY_FORM });

    useEffect(() => {
        if (initialData) {
            setForm({
                ...initialData,
                poin_poin: Array.isArray(initialData.poin_poin) ? [...initialData.poin_poin] : [],
            });
        } else {
            setForm({
                ...EMPTY_FORM,
                tanggal: new Date().toISOString().slice(0, 10),
                poin_poin: [
                    { id: `p-1-${Date.now()}`, teks: '', status: 'Belum', pic: '', tenggat: '' },
                ],
            });
        }
    }, [initialData, isOpen]);

    const handleAddPoin = () => {
        setForm(prev => ({
            ...prev,
            poin_poin: [
                ...prev.poin_poin,
                { id: `p-${prev.poin_poin.length + 1}-${Date.now().toString(36)}`, teks: '', status: 'Belum', pic: '', tenggat: '' },
            ],
        }));
    };

    const handleRemovePoin = (index: number) => {
        setForm(prev => ({
            ...prev,
            poin_poin: prev.poin_poin.filter((_, i) => i !== index),
        }));
    };

    const handleUpdatePoin = (index: number, field: keyof PoinHasilRapat, value: any) => {
        setForm(prev => {
            const nextPoin = [...prev.poin_poin];
            nextPoin[index] = { ...nextPoin[index], [field]: value };
            return { ...prev, poin_poin: nextPoin };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.agenda || !form.agenda.trim()) {
            return swalWarning('Perhatian', 'Agenda / Judul Rapat wajib diisi');
        }
        if (!form.tanggal) {
            return swalWarning('Perhatian', 'Tanggal rapat wajib diisi');
        }

        // Filter poin yang memiliki isi
        const validPoin = form.poin_poin.filter(p => p.teks && p.teks.trim().length > 0);

        const finalStatus = notulensiStatus(validPoin);

        await onSave({
            ...form,
            agenda: form.agenda.trim(),
            poin_poin: validPoin,
            status: finalStatus,
        });
    };

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            variant={form.id ? 'edit' : 'add'}
            title={form.id ? 'Edit Notulensi Rapat' : 'Buat Notulensi Rapat Baru'}
            icon={form.id ? 'pencil-square' : 'journal-text'}
        >
            <form onSubmit={handleSubmit}>
                <ModalBody>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* ── INFO UTAMA RAPAT ── */}
                        <div className="nr-form-group">
                            <label className="nr-form-label">
                                Agenda / Judul Rapat <span className="req">*</span>
                            </label>
                            <input
                                type="text"
                                className="nr-form-input"
                                placeholder="Contoh: Rapat Pleno Evaluasi KBM Semester Ganjil"
                                value={form.agenda}
                                onChange={e => setForm({ ...form, agenda: e.target.value })}
                                required
                            />
                        </div>

                        {/* Baris Tanggal & Waktu */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Tanggal Rapat <span className="req">*</span>
                                </label>
                                <DatePicker
                                    value={form.tanggal}
                                    onChange={val => setForm({ ...form, tanggal: val })}
                                    style={{ height: '38px' }}
                                />
                            </div>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Waktu Mulai
                                </label>
                                <input
                                    type="time"
                                    className="nr-form-input"
                                    value={form.waktu_mulai || ''}
                                    onChange={e => setForm({ ...form, waktu_mulai: e.target.value })}
                                    style={{ height: '38px' }}
                                />
                            </div>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Waktu Selesai
                                </label>
                                <input
                                    type="time"
                                    className="nr-form-input"
                                    value={form.waktu_selesai || ''}
                                    onChange={e => setForm({ ...form, waktu_selesai: e.target.value })}
                                    style={{ height: '38px' }}
                                />
                            </div>
                        </div>

                        {/* Baris Lokasi, Pimpinan, Notulis */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Lokasi / Tempat
                                </label>
                                <input
                                    type="text"
                                    className="nr-form-input"
                                    placeholder="Ruang Guru / Lab / Aula"
                                    value={form.lokasi || ''}
                                    onChange={e => setForm({ ...form, lokasi: e.target.value })}
                                />
                            </div>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Pimpinan Rapat
                                </label>
                                <input
                                    type="text"
                                    className="nr-form-input"
                                    placeholder="Nama Pimpinan Rapat"
                                    value={form.pimpinan_rapat || ''}
                                    onChange={e => setForm({ ...form, pimpinan_rapat: e.target.value })}
                                />
                            </div>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Notulis
                                </label>
                                <input
                                    type="text"
                                    className="nr-form-input"
                                    placeholder="Nama Pencatat Notulen"
                                    value={form.notulis || ''}
                                    onChange={e => setForm({ ...form, notulis: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Peserta rapat */}
                        <div>
                            <div className="nr-form-group">
                                <label className="nr-form-label">
                                    Peserta Rapat
                                </label>
                                <input
                                    type="text"
                                    className="nr-form-input"
                                    placeholder="Seluruh Dewan Guru & Staf (35 orang)"
                                    value={form.peserta || ''}
                                    onChange={e => setForm({ ...form, peserta: e.target.value })}
                                />
                            </div>

                        </div>

                        {/* ── EDITOR POIN-POIN HASIL RAPAT ── */}
                        <div style={{ borderTop: '1px solid var(--n-border, #e2e8f0)', paddingTop: '14px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--n-ink, #0f172a)' }}>
                                        Poin-Poin Hasil Rapat &amp; Tindak Lanjut
                                    </span>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--n-muted, #64748b)' }}>
                                        Catat setiap keputusan rapat dan tentukan status tindak lanjutnya (Belum, Proses, Selesai).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddPoin}
                                    className="nr-add-poin-btn"
                                >
                                    <i className="bi bi-plus-circle" /> Tambah
                                </button>
                            </div>

                            <div className="nr-poin-editor">
                                {form.poin_poin.length === 0 ? (
                                    <div className="nr-poin-empty">
                                        Belum ada poin hasil rapat. Klik <strong>Tambah</strong> di atas untuk menambahkan.
                                    </div>
                                ) : (
                                    form.poin_poin.map((p, idx) => (
                                        <div key={p.id} className="nr-poin-input-row">
                                            <div className="nr-poin-row-top">
                                                <span className="nr-poin-row-badge">
                                                    <span className="nr-poin-badge-num">
                                                        {idx + 1}
                                                    </span>
                                                    Poin Hasil Rapat #{idx + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePoin(idx)}
                                                    title="Hapus poin ini"
                                                    className="nr-poin-delete-btn"
                                                >
                                                    <i className="bi bi-trash3" /> Hapus
                                                </button>
                                            </div>

                                            <div className="nr-poin-row-fields">
                                                <textarea
                                                    rows={2}
                                                    className="nr-form-textarea"
                                                    placeholder="Uraian keputusan / poin pembahasan rapat..."
                                                    value={p.teks}
                                                    onChange={e => handleUpdatePoin(idx, 'teks', e.target.value)}
                                                    required
                                                />
                                                <div>
                                                    <label className="nr-form-label" style={{ fontSize: '0.74rem', marginBottom: '4px' }}>
                                                        Status Tindak Lanjut
                                                    </label>
                                                    <InlineSelect
                                                        value={p.status}
                                                        onChange={val => handleUpdatePoin(idx, 'status', val as any)}
                                                        options={STATUS_POIN_OPTIONS}
                                                        minWidth="100%"
                                                        height="36px"
                                                    />
                                                </div>
                                            </div>

                                            <div className="nr-poin-row-subfields">
                                                <input
                                                    type="text"
                                                    className="nr-form-input"
                                                    placeholder="PIC / Penanggung Jawab (opsional)"
                                                    value={p.pic || ''}
                                                    onChange={e => handleUpdatePoin(idx, 'pic', e.target.value)}
                                                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                                />
                                                <input
                                                    type="date"
                                                    className="nr-form-input"
                                                    placeholder="Tenggat Waktu / Deadline"
                                                    value={p.tenggat || ''}
                                                    onChange={e => handleUpdatePoin(idx, 'tenggat', e.target.value)}
                                                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Batal
                    </Button>
                    <Button type="submit" variant="primary" isLoading={saving} leftIcon={<i className="bi bi-check-lg" />}>
                        Simpan Notulensi
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
