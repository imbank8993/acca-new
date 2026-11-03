'use client';

import { useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalField } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineSelect } from '@/components/ui/InlineSelect';
import { authFetch } from '@/lib/auth-fetch';
import { BULAN } from './parts';

export default function PrintPaymentModal({ initialMonth, initialYear, onClose, onReady }: {
    initialMonth: number;
    initialYear: number;
    onClose: () => void;
    onReady: (url: string) => void;
}) {
    const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [month, setMonth] = useState(initialMonth || Number(now.slice(5, 7)));
    const [year, setYear] = useState(initialYear || Number(now.slice(0, 4)));
    const [category, setCategory] = useState('ALL');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const print = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const qs = new URLSearchParams({ month: String(month), year: String(year), category });
            const res = await authFetch('/api/payments/report?' + qs);
            if (!res.ok) {
                const r = await res.json();
                throw new Error(r.error || r.message || 'Gagal membuat rekapan.');
            }
            const url = URL.createObjectURL(await res.blob());
            onReady(url);
            onClose();
        } catch (e: any) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <Modal
            title="Cetak Rekapan Pembayaran"
            subtitle="Ampra bulanan dan lampiran bukti transfer dalam satu PDF A4."
            icon="printer"
            labelledBy="payment-print-title"
            onClose={() => { if (!busy) onClose(); }}
            closeOnOverlayClick={false}
        >
            <ModalBody>
                {error && <div className="pay-alert pay-alert--error" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}
                <div className="pay-form-row">
                    <ModalField label="Bulan kegiatan">
                        <InlineSelect title="Bulan rekapan" value={String(month)} onChange={v => setMonth(Number(v))} disabled={busy} options={BULAN.map((label, i) => ({ value: String(i + 1), label }))} />
                    </ModalField>
                    <ModalField label="Tahun">
                        <input type="number" min={2000} max={2200} value={year} disabled={busy} onChange={e => setYear(Number(e.target.value))} />
                    </ModalField>
                </div>
                <ModalField label="Kategori">
                    <InlineSelect
                        title="Kategori rekapan"
                        value={category}
                        onChange={setCategory}
                        disabled={busy}
                        options={[
                            { value: 'ALL', label: 'Semua Pembayaran Rutin' },
                            { value: 'GURU_ASUH', label: 'Guru Asuh' },
                            { value: 'KLINIK', label: 'Klinik Pembelajaran' },
                            { value: 'EKSKUL', label: 'Ekstrakurikuler' },
                        ]}
                    />
                </ModalField>
                <ul className="pay-notes">
                    <li>Periode mengikuti bulan kegiatan/laporan, sesuai tab Rekapan. Tanggal transfer tercantum pada rincian.</li>
                    <li>Bukti transfer yang tersedia disertakan sebagai lampiran; satu bukti untuk beberapa kegiatan dicetak sekali.</li>
                    <li>Pengajuan Komite memiliki pencatatan tersendiri dan tidak termasuk di rekapan ini.</li>
                </ul>
            </ModalBody>
            <ModalFooter>
                <Button variant="cancel" disabled={busy} onClick={onClose}>Tutup</Button>
                <Button variant="primary" icon="print" isLoading={busy} onClick={() => void print()}>Buat PDF A4</Button>
            </ModalFooter>
        </Modal>
    );
}
