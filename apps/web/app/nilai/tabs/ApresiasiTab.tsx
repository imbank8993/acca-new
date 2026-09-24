'use client';

import { useMemo } from 'react';
import { Siswa } from '@/lib/types';
import { MobileList, MobileListItem } from '@/components/mobile';
import { getProxiedImageUrl } from '@/lib/image-utils';
import Swal from 'sweetalert2';
import { Trash2, Lightbulb } from 'lucide-react';

/**
 * Tab Nilai Apresiasi — tabel poin kuis rebutan.
 *
 * Sengaja memakai kelas `nl__` yang sama dengan tab nilai lain supaya
 * layoutnya identik; yang berbeda hanya isinya. Angkanya READ-ONLY di sini:
 * poin lahir dari sesi live, bukan diketik per sel seperti tagihan biasa.
 *
 * Sel kosong berarti siswa tidak pernah menang di sesi itu — BUKAN nilai nol.
 * Karena itu kolom Total menjumlah poin, tidak pernah merata-ratakan.
 */

export interface ApresiasiSesi {
    id: string;
    judul: string;
    topik: string | null;
    poin_per_soal: number;
    tanggal: string | null;
}

export interface ApresiasiPoin {
    sesi_id: string;
    nisn: string;
    jumlah_menang: number;
    total_poin: number;
}

export default function ApresiasiTab({
    siswa,
    sesi,
    poin,
    searchTerm,
    canDelete,
    onHapusSesi,
}: {
    siswa: Siswa[];
    sesi: ApresiasiSesi[];
    poin: ApresiasiPoin[];
    searchTerm: string;
    canDelete: boolean;
    onHapusSesi: (sesi: ApresiasiSesi) => void;
}) {
    // Map `sesi_id||nisn` -> total poin, supaya render tabel tidak melakukan
    // pencarian linier di array poin untuk tiap sel.
    const poinMap = useMemo(() => {
        const map = new Map<string, number>();
        poin.forEach(p => map.set(`${p.sesi_id}||${p.nisn}`, Number(p.total_poin) || 0));
        return map;
    }, [poin]);

    const totalByNisn = useMemo(() => {
        const map = new Map<string, number>();
        poin.forEach(p => map.set(p.nisn, (map.get(p.nisn) || 0) + (Number(p.total_poin) || 0)));
        return map;
    }, [poin]);

    const filtered = useMemo(() => {
        if (!searchTerm) return siswa;
        const q = searchTerm.toLowerCase();
        return siswa.filter(s =>
            (s.nama_siswa || '').toLowerCase().includes(q) || (s.nisn || '').includes(q)
        );
    }, [siswa, searchTerm]);

    const fmt = (n: number) => Number(n.toFixed(2));

    const escapeHtml = (str: string) =>
        String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));

    /**
     * Rincian per sesi untuk satu siswa. Di mobile tabelnya tidak muat, jadi
     * baris daftar hanya menampilkan total; ketukan membuka rinciannya.
     */
    const showRincian = (s: Siswa) => {
        const nama = s.nama_siswa || (s as any).nama || s.nisn;
        const baris = sesi
            .map(ss => ({ judul: ss.judul, val: poinMap.get(`${ss.id}||${s.nisn}`) || 0 }))
            .filter(b => b.val > 0);

        Swal.fire({
            title: nama,
            html: baris.length === 0
                ? '<p style="margin:0;font-size:0.9rem">Belum pernah menang di sesi mana pun.</p>'
                : `<div style="text-align:left;font-size:0.9rem">${baris
                    .map(b => `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0"><span>${escapeHtml(b.judul)}</span><strong>+${fmt(b.val)}</strong></div>`)
                    .join('')}<hr style="margin:8px 0"/><div style="display:flex;justify-content:space-between;gap:12px"><span><strong>Total</strong></span><strong>+${fmt(totalByNisn.get(s.nisn) || 0)}</strong></div></div>`,
            confirmButtonText: 'Tutup',
        });
    };

    if (sesi.length === 0) {
        return (
            <div className="nl__tableWrap">
                <div className="nl__tableEmpty" style={{ padding: '48px 24px', textAlign: 'center' }}>
                    Belum ada sesi apresiasi untuk kelas &amp; mapel ini.
                    <br />
                    Tekan <strong>Mulai Sesi</strong> untuk mencatat kuis rebutan.
                </div>
            </div>
        );
    }

    return (
        <>
            {/* ── Mobile ── */}
            <div className="nl__mobileCards">
                {filtered.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">Tidak ada data siswa</div>
                ) : (
                    <MobileList label="Poin apresiasi siswa">
                        {filtered.map(s => {
                            const total = totalByNisn.get(s.nisn) || 0;
                            return (
                                <MobileListItem
                                    key={s.nisn}
                                    title={s.nama_siswa || (s as any).nama || ''}
                                    subtitle={s.nisn}
                                    avatarSrc={getProxiedImageUrl((s as any).foto_profil)}
                                    icon="person-fill"
                                    seed={s.nisn}
                                    badge={<span className="nl__listRapor">{total > 0 ? `+${fmt(total)}` : '—'}</span>}
                                    onClick={() => showRincian(s)}
                                />
                            );
                        })}
                    </MobileList>
                )}
            </div>

            {/* ── Desktop ── */}
            <div className="nl__tableWrap">
                <table
                    className="nl__table"
                    style={{ '--nl-score-cols': sesi.length + 1 } as React.CSSProperties}
                >
                    <thead>
                        <tr>
                            <th className="w-12 text-center">NO</th>
                            <th className="w-24 text-center">NISN</th>
                            <th className="text-left pl-5">NAMA SISWA</th>
                            {sesi.map(s => (
                                <th key={s.id} className="nl__colScore align-bottom">
                                    <div className="nl__thLabel">
                                        <span>{s.judul}</span>
                                    </div>
                                    {s.topik && (
                                        <div className="nl__thTopik" title={s.topik}>{s.topik}</div>
                                    )}
                                    {canDelete && (
                                        <div className="nl__thActions">
                                            <button
                                                className="nl__deleteBtn"
                                                title="Hapus sesi"
                                                onClick={() => onHapusSesi(s)}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </th>
                            ))}
                            <th className="nl__colScore nl__colRapor">Total Poin</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr>
                                <td className="nl__tableEmpty" colSpan={4 + sesi.length}>
                                    {searchTerm ? `Tidak ada siswa yang cocok dengan "${searchTerm}"` : 'Tidak ada data siswa'}
                                </td>
                            </tr>
                        )}
                        {filtered.map((s, idx) => {
                            const total = totalByNisn.get(s.nisn) || 0;
                            return (
                                <tr key={s.nisn}>
                                    <td className="text-center nl__index" data-label="No">{idx + 1}</td>
                                    <td className="text-center" data-label="NISN"><span className="nl__idBadge">{s.nisn}</span></td>
                                    <td className="nl__studentName" data-label="Nama Siswa">{s.nama_siswa || (s as any).nama}</td>
                                    {sesi.map(ss => {
                                        const val = poinMap.get(`${ss.id}||${s.nisn}`);
                                        return (
                                            <td key={ss.id} className="nl__colScore text-center">
                                                {val ? (
                                                    <span className="nl__scoreBadge">+{fmt(val)}</span>
                                                ) : (
                                                    <span className="nl__tableEmpty">&mdash;</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="nl__colScore nl__colRapor text-center">
                                        <span className="nl__scoreFinal">{total > 0 ? `+${fmt(total)}` : '-'}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="nl__rekapInfo">
                <div className="flex items-center gap-3">
                    <Lightbulb size={16} />
                    <div>
                        <span className="font-bold">Nilai Apresiasi:</span>{' '}
                        <span>
                            poin kuis rebutan (cepat tepat). Berdiri sendiri dan tidak otomatis
                            masuk ke NA maupun rapor — silakan pakai sebagai pertimbangan saat
                            mengolah nilai. Sel kosong berarti belum pernah menang, bukan nilai nol.
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}
