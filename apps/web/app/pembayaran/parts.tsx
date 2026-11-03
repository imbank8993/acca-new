'use client';

/**
 * Potongan UI bersama halaman Pembayaran: kartu ringkasan, label status,
 * sel penerima, dan modal "Tandai Dibayar" yang dipakai tab Guru Asuh,
 * Klinik, dan Ekstrakurikuler.
 */

import { useState, type ReactNode } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { Modal, ModalBody, ModalFooter, ModalField, ModalFileInput } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { initials, tintOf } from '@/components/mobile';

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const fmtRupiah = (n: any) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
};

export const fmtTanggal = (value: any, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', opts);
};

/* --------------------------------- Ringkasan -------------------------------- */

export type StatTone = 'blue' | 'amber' | 'green' | 'violet';

export interface StatItem {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon: string;
    tone: StatTone;
    /** 0–100: bilah kemajuan tipis di dasar kartu. */
    progress?: number;
}

export function StatCards({ items }: { items: StatItem[] }) {
    return (
        <div className="pay-stats">
            {items.map(item => (
                <div key={item.label} className={`pay-stat pay-stat--${item.tone}`}>
                    <span className="pay-stat__icon" aria-hidden="true"><i className={`bi bi-${item.icon}`} /></span>
                    <div className="pay-stat__text">
                        <span className="pay-stat__label">{item.label}</span>
                        <span className="pay-stat__value">{item.value}</span>
                        {item.sub && <span className="pay-stat__sub">{item.sub}</span>}
                    </div>
                    {item.progress !== undefined && (
                        <span className="pay-stat__bar" aria-hidden="true">
                            <span style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ----------------------------------- Status --------------------------------- */

export type BadgeTone = 'paid' | 'unpaid' | 'partial' | 'void' | 'neutral';

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
    return <span className={`pay-badge pay-badge--${tone}`}><span className="pay-badge__dot" aria-hidden="true" />{children}</span>;
}

export function PayeeCell({ name, sub }: { name: string; sub?: ReactNode }) {
    return (
        <div className="pay-payee">
            <span className={`pay-payee__avatar mui-avatar--t${tintOf(name)}`} aria-hidden="true">{initials(name)}</span>
            <span className="pay-payee__text">
                <span className="pay-payee__name">{name}</span>
                {sub && <span className="pay-payee__sub">{sub}</span>}
            </span>
        </div>
    );
}

export function EmptyState({ icon = 'inbox', title, children }: { icon?: string; title: string; children?: ReactNode }) {
    return (
        <div className="pay-empty">
            <span className="pay-empty__icon" aria-hidden="true"><i className={`bi bi-${icon}`} /></span>
            <strong>{title}</strong>
            {children && <span>{children}</span>}
        </div>
    );
}

/* ------------------------------ Tandai Dibayar ------------------------------ */

export interface PayTarget {
    /** Judul baris ringkasan, mis. nama penerima. */
    recipient: string;
    /** Baris rincian di bawah nama, mis. "Oktober 2026 · 4 laporan". */
    detail: ReactNode;
    amount: number;
    /** Rincian perhitungan nominal (opsional), mis. "3 × Rp 50.000". */
    amountNote?: ReactNode;
    /** Simpan pembayaran. `note.url` sudah berisi tautan bukti bila ada. */
    submit: (note: { text: string; url: string }) => Promise<void>;
}

const MAX_PROOF_BYTES = 25 * 1024 * 1024;

export function MarkPaidModal({ target, onClose }: { target: PayTarget; onClose: () => void }) {
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const pick = (picked: File[]) => {
        const file = picked[picked.length - 1];
        if (file && file.size > MAX_PROOF_BYTES) {
            setError('Ukuran bukti maksimal 25 MB.');
            return;
        }
        setError('');
        setFiles(file ? [file] : []);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            let url = '';
            if (files[0]) {
                const body = new FormData();
                body.append('file', files[0]);
                body.append('folder', 'pembayaran');
                const res = await authFetch('/api/upload', { method: 'POST', body });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal mengunggah bukti pembayaran.');
                url = data.publicUrl || data.url || data.file_url || '';
            }
            await target.submit({ text: text.trim(), url });
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Gagal menyimpan pembayaran.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            size="md"
            variant="add"
            title="Tandai Sudah Dibayar"
            subtitle="Lampirkan bukti transfer agar tercetak di rekapan."
            icon="wallet2"
            labelledBy="pay-mark-title"
            onClose={() => { if (!busy) onClose(); }}
            closeOnOverlayClick={false}
        >
            <form onSubmit={save}>
                <ModalBody>
                    <div className="pay-summary">
                        <div className="pay-summary__who">
                            <span className="pay-summary__label">Penerima</span>
                            <strong>{target.recipient}</strong>
                            <span className="pay-summary__detail">{target.detail}</span>
                        </div>
                        <div className="pay-summary__amount">
                            <span className="pay-summary__label">Nominal</span>
                            <strong>{fmtRupiah(target.amount)}</strong>
                            {target.amountNote && <span className="pay-summary__detail">{target.amountNote}</span>}
                        </div>
                    </div>

                    {error && <div className="pay-alert pay-alert--error" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

                    <ModalField label="Bukti pembayaran" hint="Opsional · gambar atau PDF, maksimal 25 MB.">
                        <ModalFileInput files={files} onPick={pick} accept="image/*,.pdf" disabled={busy} placeholder="Pilih bukti transfer atau jatuhkan di sini" />
                    </ModalField>
                    <ModalField label="Catatan" hint="Opsional · mis. nomor referensi transfer.">
                        <textarea rows={3} maxLength={1000} value={text} disabled={busy} onChange={e => setText(e.target.value)} placeholder="Nomor bukti transfer, keterangan, dll." />
                    </ModalField>
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="cancel" disabled={busy} onClick={onClose}>Batal</Button>
                    <Button type="submit" variant="primary" isLoading={busy} leftIcon={<i className="bi bi-check2-circle" />}>Tandai Dibayar</Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
