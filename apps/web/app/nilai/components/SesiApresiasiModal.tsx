'use client';

import { useMemo, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Siswa } from '@/lib/types';
import notif from '@/lib/notifications';
import { RotateCcw, Play, Check } from 'lucide-react';
import './sesi-apresiasi.css';

/**
 * Sesi kuis rebutan (Nilai Apresiasi).
 *
 * Guru menekan sendiri nama pemenang di layarnya — tidak ada perangkat siswa dan
 * tidak ada realtime. Seluruh sesi hidup sebagai state lokal di komponen ini;
 * baru saat "Selesai & Simpan" datanya dikirim dalam satu POST. Kalau modal
 * ditutup di tengah jalan, tidak ada apa pun yang tertulis ke database.
 */

export interface SesiApresiasiPayload {
    judul: string;
    topik: string;
    poin_per_soal: number;
    poin: { nisn: string; jumlah_menang: number; total_poin: number }[];
}

/** Satu kemenangan yang tercatat; urutannya dipakai tombol Batal. */
type Kemenangan = { nisn: string };

export default function SesiApresiasiModal({
    open,
    onClose,
    siswa,
    kelas,
    mapel,
    onSimpan,
}: {
    open: boolean;
    onClose: () => void;
    siswa: Siswa[];
    kelas: string;
    mapel: string;
    onSimpan: (payload: SesiApresiasiPayload) => Promise<boolean>;
}) {
    const [tahap, setTahap] = useState<'form' | 'sesi'>('form');
    const [judul, setJudul] = useState('');
    const [topik, setTopik] = useState('');
    const [poinPerSoal, setPoinPerSoal] = useState('1');
    const [riwayat, setRiwayat] = useState<Kemenangan[]>([]);
    const [saving, setSaving] = useState(false);

    const poinValue = (() => {
        const n = parseFloat(poinPerSoal);
        return isNaN(n) || n <= 0 ? 1 : n;
    })();

    // Jumlah kemenangan per siswa diturunkan dari riwayat, bukan disimpan
    // terpisah — dengan begitu tombol Batal cukup memotong satu entri terakhir
    // dan angkanya otomatis ikut turun, tanpa ada dua sumber kebenaran.
    const menangByNisn = useMemo(() => {
        const map = new Map<string, number>();
        riwayat.forEach(r => map.set(r.nisn, (map.get(r.nisn) || 0) + 1));
        return map;
    }, [riwayat]);

    const namaByNisn = useMemo(
        () => new Map(siswa.map(s => [s.nisn, s.nama_siswa])),
        [siswa]
    );

    const pemenang = useMemo(
        () =>
            Array.from(menangByNisn.entries())
                .map(([nisn, jumlah]) => ({ nisn, jumlah, nama: namaByNisn.get(nisn) || nisn }))
                .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama)),
        [menangByNisn, namaByNisn]
    );

    const reset = () => {
        setTahap('form');
        setJudul('');
        setTopik('');
        setPoinPerSoal('1');
        setRiwayat([]);
    };

    const handleClose = () => {
        if (saving) return;
        // Sesi yang sudah punya pemenang tapi belum disimpan akan hilang total —
        // guru harus sadar sebelum kehilangan hasil satu jam pelajaran.
        if (tahap === 'sesi' && riwayat.length > 0) {
            if (!window.confirm(`Sesi ini punya ${riwayat.length} jawaban benar yang belum disimpan. Tutup dan buang hasilnya?`)) {
                return;
            }
        }
        reset();
        onClose();
    };

    const handleMulai = () => {
        if (!judul.trim()) {
            notif.error('Judul sesi wajib diisi');
            return;
        }
        if (siswa.length === 0) {
            notif.error('Tidak ada siswa di kelas ini');
            return;
        }
        setTahap('sesi');
    };

    const handleSimpan = async () => {
        if (riwayat.length === 0) {
            notif.error('Belum ada jawaban benar yang tercatat');
            return;
        }
        setSaving(true);
        try {
            const ok = await onSimpan({
                judul: judul.trim(),
                topik: topik.trim(),
                poin_per_soal: poinValue,
                poin: Array.from(menangByNisn.entries()).map(([nisn, jumlah]) => ({
                    nisn,
                    jumlah_menang: jumlah,
                    total_poin: Number((jumlah * poinValue).toFixed(2)),
                })),
            });
            if (ok) {
                reset();
                onClose();
            }
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <Modal open={open} onClose={handleClose} size="lg" variant="add">
            <ModalHeader
                title={tahap === 'form' ? 'Sesi Nilai Apresiasi' : judul || 'Sesi Berjalan'}
                subtitle={`${kelas} · ${mapel}`}
                icon="lightning-charge-fill"
                onClose={handleClose}
            />
            <ModalBody>
                <div className="apr-root">
                    {tahap === 'form' ? (
                        <div className="apr-form">
                            <div className="apr-field">
                                <label className="apr-label" htmlFor="apr-judul">Judul Sesi</label>
                                <input
                                    id="apr-judul"
                                    type="text"
                                    value={judul}
                                    onChange={e => setJudul(e.target.value)}
                                    placeholder="Contoh: Rebutan Bab 2"
                                />
                            </div>
                            <div className="apr-field">
                                <label className="apr-label" htmlFor="apr-topik">Keterangan / Topik</label>
                                <textarea
                                    id="apr-topik"
                                    value={topik}
                                    onChange={e => setTopik(e.target.value)}
                                    placeholder="Materi yang diujikan, opsional"
                                />
                            </div>
                            <div className="apr-form-row">
                                <div className="apr-field">
                                    <label className="apr-label" htmlFor="apr-poin">Poin per Jawaban Benar</label>
                                    <input
                                        id="apr-poin"
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={poinPerSoal}
                                        onChange={e => setPoinPerSoal(e.target.value)}
                                    />
                                </div>
                            </div>
                            <p className="apr-hint">
                                Saat sesi berjalan, tekan nama siswa yang menjawab benar paling cepat.
                                Poin ini berdiri sendiri dan tidak otomatis masuk ke nilai apa pun.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="apr-board-head">
                                <div className="apr-board-title">
                                    <span className="apr-board-judul">{judul}</span>
                                    {topik && <span className="apr-board-topik">{topik}</span>}
                                </div>
                                <div className="apr-counter">
                                    <span className="apr-counter-num">{riwayat.length}</span>
                                    <span className="apr-counter-label">Jawaban Benar</span>
                                    <button
                                        type="button"
                                        className="apr-undo"
                                        disabled={riwayat.length === 0}
                                        onClick={() => setRiwayat(prev => prev.slice(0, -1))}
                                        title="Batalkan pencatatan terakhir"
                                    >
                                        <RotateCcw size={14} />
                                        Batal
                                    </button>
                                </div>
                            </div>

                            <p className="apr-hint">
                                Tekan nama siswa yang menjawab benar. Setiap tekan = +{poinValue} poin.
                            </p>

                            {siswa.length === 0 ? (
                                <div className="apr-empty">Tidak ada siswa di kelas ini.</div>
                            ) : (
                                <div className="apr-grid">
                                    {siswa.map(s => {
                                        const menang = menangByNisn.get(s.nisn) || 0;
                                        return (
                                            <button
                                                type="button"
                                                key={s.nisn}
                                                className={`apr-siswa ${menang > 0 ? 'is-menang' : ''}`}
                                                onClick={() => setRiwayat(prev => [...prev, { nisn: s.nisn }])}
                                                title={`${s.nama_siswa} — ${menang} jawaban benar`}
                                            >
                                                <span className="apr-siswa-nama">{s.nama_siswa}</span>
                                                {menang > 0 && (
                                                    <span className="apr-poin">
                                                        {Number((menang * poinValue).toFixed(2))}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {pemenang.length > 0 && (
                                <div className="apr-summary">
                                    {pemenang.map(p => (
                                        <span key={p.nisn} className="apr-summary-chip">
                                            {p.nama}
                                            <strong>+{Number((p.jumlah * poinValue).toFixed(2))}</strong>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                {tahap === 'form' ? (
                    <>
                        <Button variant="secondary" onClick={handleClose}>Batal</Button>
                        <Button variant="primary" onClick={handleMulai} leftIcon={<Play size={15} />}>
                            Mulai Sesi
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="secondary" onClick={handleClose} disabled={saving}>Tutup</Button>
                        <Button
                            variant="primary"
                            onClick={handleSimpan}
                            disabled={saving || riwayat.length === 0}
                            leftIcon={<Check size={16} />}
                        >
                            {saving ? 'Menyimpan…' : 'Selesai & Simpan'}
                        </Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}
