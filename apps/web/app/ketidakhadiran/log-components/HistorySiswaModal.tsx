'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import DetailHeader from '@/components/ui/DetailHeader';
import { FilterToolbar, FilterInput, FilterSelect } from '@/components/ui/FilterToolbar';
import { formatJpDurasi } from '@/lib/ketidakhadiran-jp';
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter';
import { Spinner } from '@/components/ui/Spinner';
import './history-siswa-modal.css';

interface HistorySiswaModalProps {
    nisn: string;
    onClose: () => void;
}

interface HistoryItem {
    id: string;
    jenis: string;
    tgl_mulai: string;
    tgl_selesai: string;
    keterangan?: string | null;
    status?: string | null;
    display_durasi: string;
    waktu_mulai_real?: string | null;
    waktu_selesai_real?: string | null;
    is_kontinu?: boolean | null;
    created_at: string;
}

interface HistoryData {
    siswa: { nisn: string; nama: string; kelas: string };
    stat: {
        total_izin_hari_kalender: number;
        total_sakit_hari_kalender: number;
        total_izin_jp: number;
        total_sakit_jp: number;
    };
    riwayat: HistoryItem[];
}

function renderJpWithDays(jp: number) {
    const value = Number.isFinite(Number(jp)) ? Number(jp) : 0;
    const label = `${value.toLocaleString('id-ID', { maximumFractionDigits: 2 })} JP`;
    const display = formatJpDurasi(value);
    return value >= 24 ? `${label} (${display})` : label;
}

export default function HistorySiswaModal({ nisn, onClose }: HistorySiswaModalProps) {
    const ta = useTahunAjaranFilter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<HistoryData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [jenis, setJenis] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        setJenis('');
        setSearch('');
    }, [nisn]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        setData(null);
        (async () => {
            try {
                const params = new URLSearchParams();
                if (ta.selected && ta.selected !== 'Semua') params.set('tahun_ajaran', ta.selected);
                const res = await fetch(`/api/ketidakhadiran/log/siswa/${encodeURIComponent(nisn)}?${params}`, {
                    cache: 'no-store', signal: controller.signal,
                });
                const result = await res.json();
                if (!res.ok || !(result.ok || result.success)) throw new Error(result.error || 'Gagal memuat riwayat');
                if (!controller.signal.aborted) setData(result.data || result);
            } catch (err) {
                if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Gagal memuat riwayat');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [nisn, ta.selected]);

    const filteredHistory = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('id');
        return (data?.riwayat || []).filter(item => {
            if (jenis && item.jenis?.toUpperCase() !== jenis) return false;
            if (!query) return true;
            return [item.keterangan, item.status, item.jenis, item.display_durasi,
                item.tgl_mulai, item.tgl_selesai, formatPeriode(item.tgl_mulai, item.tgl_selesai)]
                .filter(Boolean).join(' ').toLocaleLowerCase('id').includes(query);
        });
    }, [data, jenis, search]);

    return (
        <Modal size="lg" className="hsm-modal" onClose={onClose} labelledBy="history-siswa-title">
            <ModalHeader id="history-siswa-title" icon="clock-history" title="Riwayat Ketidakhadiran" onClose={onClose} />
            <ModalBody className="hsm__body">
                {data?.siswa && (
                    <DetailHeader name={data.siswa.nama} meta={`NISN ${data.siswa.nisn || nisn} · Kelas ${data.siswa.kelas || '-'}`} />
                )}
                <FilterToolbar className="hsm__filters" alwaysExpanded>
                    <FilterInput label="Pencarian" icon="search" value={search} onChange={setSearch}
                        placeholder="Cari keterangan, status, atau tanggal..." clearable width={190} grow={2} className="hsm__search" />
                    {ta.years.length > 0 && (
                        <FilterSelect label="Tahun ajaran" icon="mortarboard" value={ta.selected} onChange={ta.setSelected}
                            options={[{ value: 'Semua', label: 'Semua riwayat' }, ...ta.years.map(y => ({ value: y, label: y }))]} width={150} />
                    )}
                    <FilterSelect label="Jenis" icon="funnel" value={jenis} onChange={setJenis} width={110}
                        options={[{ value: '', label: 'Semua' }, { value: 'SAKIT', label: 'Sakit' }, { value: 'IZIN', label: 'Izin' }]} />
                </FilterToolbar>

                {loading ? (
                    <div className="hsm__message" role="status"><Spinner variant="buble" size={24} /><span>Memuat riwayat...</span></div>
                ) : error ? (
                    <div className="hsm__message hsm__error" role="alert">{error}</div>
                ) : (
                    <>
                        <div className="hsm__stats" aria-label="Ringkasan tahun ajaran terpilih">
                            <div className="hsm__statCard hsm__statIzin">
                                <span className="hsm__statLbl">Total Izin</span>
                                <strong className="hsm__statNum">{data?.stat?.total_izin_hari_kalender || 0} hari</strong>
                                <span className="hsm__statJp">{renderJpWithDays(data?.stat?.total_izin_jp || 0)}</span>
                            </div>
                            <div className="hsm__statCard hsm__statSakit">
                                <span className="hsm__statLbl">Total Sakit</span>
                                <strong className="hsm__statNum">{data?.stat?.total_sakit_hari_kalender || 0} hari</strong>
                                <span className="hsm__statJp">{renderJpWithDays(data?.stat?.total_sakit_jp || 0)}</span>
                            </div>
                        </div>
                        <p className="hsm__resultCount">Menampilkan {filteredHistory.length} dari {data?.riwayat?.length || 0} riwayat</p>
                        <ul className="hsm__timeline" aria-label="Riwayat ketidakhadiran siswa">
                            {filteredHistory.map(item => (
                                <li key={item.id} className="hsm__item">
                                    <div className="hsm__itemHeader">
                                        <span className={`hsm__badge hsm__badge-${item.jenis?.toLowerCase()}`}>{item.jenis}</span>
                                        <span className="hsm__itemDate">{formatPeriode(item.tgl_mulai, item.tgl_selesai)}</span>
                                        <span className="hsm__itemDur">{item.display_durasi}</span>
                                    </div>
                                    <p className="hsm__itemDesc">{item.keterangan || 'Tanpa keterangan'}</p>
                                    {item.waktu_mulai_real && item.waktu_selesai_real && (
                                        <p className="hsm__itemTime"><i className="bi bi-clock" aria-hidden="true" /> {item.waktu_mulai_real.slice(0, 5)} {item.is_kontinu ? '→' : '—'} {item.waktu_selesai_real.slice(0, 5)}</p>
                                    )}
                                    <div className="hsm__itemFooter">
                                        {item.status && <span className={`hsm__status hsm__status-${item.status.toLowerCase()}`}>{item.status}</span>}
                                        <span className="hsm__createdAt">Dicatat: {formatFullDate(item.created_at)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {filteredHistory.length === 0 && (
                            <div className="hsm__message">{jenis || search.trim() ? 'Tidak ada riwayat yang cocok dengan filter.' : 'Belum ada riwayat ketidakhadiran.'}</div>
                        )}
                    </>
                )}
            </ModalBody>
            <ModalFooter><Button type="button" variant="cancel" onClick={onClose}>Tutup</Button></ModalFooter>
        </Modal>
    );
}

function formatPeriode(tglMulai: string, tglSelesai: string): string {
    if (!tglMulai) return '—';
    const fmt = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
        timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
    });
    if (!tglSelesai || tglMulai.slice(0, 10) === tglSelesai.slice(0, 10)) return fmt(tglMulai);
    return `${fmt(tglMulai)} — ${fmt(tglSelesai)}`;
}

function formatFullDate(dateStr: string): string {
    if (!dateStr) return '—';
    if (dateStr.includes('T')) return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return new Date(`${dateStr.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
        timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
    });
}
