'use client';

/**
 * DetailHeader — header baris tampilan detail (tombol kembali + avatar inisial +
 * nama/meta + slot aksi/filter di kanan), dipakai halaman yang drill-down dari
 * daftar ke detail satu item (mis. Guru Asuh > Penilaian > detail siswa).
 *
 * Diekstrak dari pola yang sebelumnya ditulis manual di GuruAsuhTabPenilaian.tsx
 * (class `.detail-header` dkk). Gaya ada di `components/detail-header.css` (file
 * CSS biasa, bukan `<style jsx>`) supaya tetap konsisten dipakai lintas halaman —
 * pola yang sama dengan Modal dan Tab.
 *
 * Contoh:
 *   <DetailHeader onBack={handleBack} name={siswa.nama} meta={`NISN: ${siswa.nisn} - ${siswa.kelas}`}>
 *     <DetailHeaderSelect icon="mortarboard" value={ta} onChange={e => setTa(e.target.value)}>
 *       {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
 *     </DetailHeaderSelect>
 *   </DetailHeader>
 */

import { ReactNode, SelectHTMLAttributes } from 'react';
import { ArrowLeft } from 'lucide-react';
import LucideIcon from './LucideIcon';
import './detail-header.css';

interface DetailHeaderProps {
    onBack?: () => void;
    backLabel?: string;
    name: string;
    meta?: string;
    /** true (default) = tampilkan lingkaran inisial nama di kiri, warna gradient brand */
    avatar?: boolean;
    /** slot aksi/filter di kanan, mis. dropdown tahun ajaran & semester */
    children?: ReactNode;
    className?: string;
}

export function DetailHeader({ onBack, backLabel = 'Kembali', name, meta, avatar = true, children, className = '' }: DetailHeaderProps) {
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

    return (
        <div className={`dh-header ${className}`.trim()}>
            {onBack && (
                <button type="button" className="dh-backBtn" onClick={onBack} title={backLabel} aria-label={backLabel}>
                    <ArrowLeft size={18} />
                </button>
            )}

            {avatar && <div className="dh-avatar" aria-hidden="true">{initial}</div>}

            <div className="dh-info">
                <h2 className="dh-name">{name || '...'}</h2>
                {meta && <span className="dh-meta">{meta}</span>}
            </div>

            {children && <div className="dh-actions">{children}</div>}
        </div>
    );
}

interface DetailHeaderSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    /** nama ikon Lucide / legacy format */
    icon?: string;
}

/** Dropdown bergaya pill dengan ikon, dipakai di dalam slot `children` DetailHeader. */
export function DetailHeaderSelect({ icon, className = '', children, ...selectProps }: DetailHeaderSelectProps) {
    return (
        <div className={`dh-selectGroup ${className}`.trim()}>
            {icon && <LucideIcon name={icon} size={15} />}
            <select className="dh-select" {...selectProps}>
                {children}
            </select>
        </div>
    );
}

export default DetailHeader;
