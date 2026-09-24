'use client';

/**
 * Modal — satu kerangka dialog yang dipakai bersama semua halaman.
 *
 * Yang diseragamkan HANYA kerangkanya: overlay, panel, header, dan footer.
 * Isi body tetap milik masing-masing halaman karena formulirnya memang beda.
 *
 * Gaya-nya ada di `components/modal.css` (file CSS biasa, bukan <style jsx>,
 * supaya tetap berlaku saat dipakai sebagai subkomponen) — alasan yang sama
 * dengan FilterToolbar. Justru keterbatasan styled-jsx itulah yang dulu memaksa
 * tiap tab menyalin sendiri CSS `.sk__modal*`, sampai muncul 7 varian header
 * dan 9 varian footer yang saling berbeda.
 *
 * Contoh:
 *   <Modal size="md" onClose={close} labelledBy="judul-mapel">
 *     <ModalHeader id="judul-mapel" variant="edit" title="Edit Mata Pelajaran" onClose={close} />
 *     <form onSubmit={submit}>
 *       <ModalBody>…field…</ModalBody>
 *       <ModalFooter>
 *         <Button variant="cancel" onClick={close}>Batal</Button>
 *         <Button variant="primary" type="submit" isLoading={saving}>Simpan</Button>
 *       </ModalFooter>
 *     </form>
 *   </Modal>
 */

import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import './modal.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalVariant = 'default' | 'add' | 'edit' | 'delete';

/* ---------------------------------- Shell ---------------------------------- */

export function Modal({
    open = true,
    children,
    onClose,
    size = 'md',
    variant = 'default',
    title,
    subtitle,
    icon,
    labelledBy,
    className = '',
    closeOnOverlayClick = true,
}: {
    open?: boolean;
    children: ReactNode;
    onClose: () => void;
    size?: ModalSize;
    /**
     * Menentukan warna garis tepi panel (dan ikon judul di dalamnya).
     * Ditaruh di sini, bukan di ModalHeader, karena garisnya mengelilingi
     * seluruh panel — bukan hanya headernya.
     */
    variant?: ModalVariant;
    title?: ReactNode;
    subtitle?: ReactNode;
    /** Nama ikon Bootstrap tanpa awalan (mis. "pencil-square"), atau elemen ikon siap pakai. */
    icon?: string | ReactNode;
    /** id elemen judul (dipakai ModalHeader) untuk aria-labelledby */
    labelledBy?: string;
    className?: string;
    closeOnOverlayClick?: boolean;
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Escape untuk menutup + kunci scroll body selama modal terbuka.
    useEffect(() => {
        if (!open || !mounted) return;
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, mounted, onClose]);

    if (!open || !mounted) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="mdl-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            // mousedown, bukan click: menyeret teks dari dalam panel lalu melepas
            // di luar tidak boleh ikut menutup modal.
            onMouseDown={e => { if (closeOnOverlayClick && e.target === e.currentTarget) onClose(); }}
        >
            <div className={`mdl-panel mdl-panel--${size} mdl-panel--${variant} ${className}`.trim()}>
                {title && <ModalHeader title={title} subtitle={subtitle} icon={icon} onClose={onClose} id={labelledBy} />}
                {children}
            </div>
        </div>,
        document.body
    );
}

/* --------------------------------- Header ---------------------------------- */

export function ModalHeader({
    title,
    subtitle,
    icon,
    onClose,
    id,
    variant,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    /** Nama ikon Bootstrap tanpa prefix (mis. "pencil-square"), atau elemen ikon siap pakai. */
    icon?: string | ReactNode;
    onClose?: () => void;
    id?: string;
    variant?: ModalVariant;
}) {
    return (
        // Tanpa subjudul, blok teksnya hanya satu baris — rata atas membuatnya
        // tampak melayang di atas kotak ikon, jadi dipusatkan vertikal.
        <div className={`mdl-head ${subtitle ? '' : 'mdl-head--solo'}`.trim()}>
            {icon && (
                <span className="mdl-head__icon" aria-hidden="true">
                    {/* String = nama ikon Bootstrap; selain itu dirender apa
                        adanya. Dulu prop ini hanya string dan selalu ditempel ke
                        `bi bi-...`, jadi pemanggil yang mengirim elemen (mis.
                        ikon lucide di FilterToolbar) menghasilkan kelas
                        "bi bi-[object Object]" — kotak ikonnya tampil kosong. */}
                    {typeof icon === 'string' ? <i className={`bi bi-${icon}`} /> : icon}
                </span>
            )}
            <div className="mdl-head__text">
                {/* Judul dibungkus span tersendiri: di dark mode teksnya memakai
                    gradien ber-`background-clip: text` seperti .pb-title pada
                    PageBanner, dan `-webkit-text-fill-color` diwariskan ke anak —
                    jadi gradiennya harus berhenti di teks saja. */}
                <h2 className="mdl-head__title" id={id}>
                    <span className="mdl-head__titleText">{title}</span>
                </h2>
                {subtitle && <div className="mdl-head__sub">{subtitle}</div>}
            </div>
            {onClose && (
                <button type="button" className="mdl-head__x" onClick={onClose} aria-label="Tutup">
                    <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

/* ---------------------------------- Body ----------------------------------- */

export function ModalBody({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
    return <div className={`mdl-body ${className}`.trim()} style={style}>{children}</div>;
}

/* --------------------------------- Footer ---------------------------------- */

/**
 * Tombol di dalamnya sebaiknya memakai `components/ui/Button` (variant
 * `cancel` untuk Batal, `primary`/`danger` untuk aksi) supaya seragam.
 * Urutannya Batal dulu lalu aksi; di layar sempit footer otomatis menumpuk
 * dengan tombol aksi di atas.
 */
export function ModalFooter({
    children,
    align = 'end',
    className = '',
}: {
    children: ReactNode;
    /** 'end' (default) atau 'between' bila ada aksi sekunder di kiri. */
    align?: 'end' | 'between';
    className?: string;
}) {
    return <div className={`mdl-foot mdl-foot--${align} ${className}`.trim()}>{children}</div>;
}

/* ------------------------------ View footer --------------------------------
 * Footer khusus modal view/detail: tombol Hapus (opsional) rata kiri, Tutup +
 * Edit Data (opsional) rata kanan — persis pola yang sebelumnya disalin
 * manual di GuruTab & SiswaTab. Sediakan `onEdit` supaya user bisa langsung
 * lompat ke mode edit dari modal detail, tanpa tutup lalu cari tombol edit
 * di tabel lagi. */

export function ModalViewFooter({
    onClose,
    onEdit,
    onDelete,
    extraActions,
    showClose = false,
    closeLabel = 'Tutup',
    editLabel = 'Edit Data',
    deleteLabel = 'Hapus',
    isDeleting = false,
}: {
    onClose?: () => void;
    /** Bila diisi, tombol "Edit Data" tampil dan memanggil ini (biasanya: tutup modal lalu buka mode edit). */
    onEdit?: () => void;
    /** Bila diisi, tombol "Hapus" tampil di kiri footer. */
    onDelete?: () => void;
    /** Tombol tambahan di sisi kanan, sebelum "Edit Data" (mis. "Pindah ke Tendik"). */
    extraActions?: React.ReactNode;
    showClose?: boolean;
    closeLabel?: string;
    editLabel?: string;
    deleteLabel?: string;
    isDeleting?: boolean;
}) {
    return (
        <ModalFooter align="between" className="mdl-viewFoot">
            {onDelete ? (
                <Button
                    type="button"
                    variant="danger"
                    onClick={onDelete}
                    isLoading={isDeleting}
                    icon="delete"
                >
                    {deleteLabel}
                </Button>
            ) : <div />}
            <div className="mdl-viewFoot__right">
                {showClose && onClose && (
                    <Button
                        type="button"
                        variant="cancel"
                        onClick={onClose}
                        icon="cancel"
                    >
                        {closeLabel}
                    </Button>
                )}
                {extraActions}
                {onEdit && (
                    <Button
                        type="button"
                        variant="edit"
                        onClick={onEdit}
                        icon="edit"
                    >
                        {editLabel}
                    </Button>
                )}
            </div>
        </ModalFooter>
    );
}

/* ------------------------------ Detail (view+edit) --------------------------
 * Building block untuk modal detail yang bisa langsung berubah jadi form edit
 * di tempat — tanpa tutup modal ini lalu buka modal edit terpisah. Body-nya
 * tetap dikomposisi manual per halaman (field yang boleh diedit beda-beda per
 * kasus); yang diseragamkan hanya kerangka "satu field, dua wajah" dan footer
 * yang tahu mode aktif.
 *
 * Contoh:
 *   const [mode, setMode] = useState<'view' | 'edit'>('view');
 *   <Modal onClose={close}>
 *     <ModalHeader title={data.judul} onClose={close} />
 *     <ModalBody>
 *       <ModalDetailGrid>
 *         <ModalDetailField label="Judul" icon="card-text" full mode={mode}
 *           editor={<input value={judul} onChange={e => setJudul(e.target.value)} />}>
 *           {data.judul}
 *         </ModalDetailField>
 *       </ModalDetailGrid>
 *     </ModalBody>
 *     <ModalDetailFooter mode={mode} onClose={close}
 *       onEdit={() => setMode('edit')} onCancelEdit={() => setMode('view')}
 *       onSave={save} isSaving={saving} />
 *   </Modal>
 */

/**
 * Kolom isian bertumpuk (label di atas, kontrol, lalu keterangan) untuk modal
 * FORMULIR — beda peran dari <ModalDetailField> yang melayani modal detail
 * dua wajah (view/edit) dalam kisi dua kolom.
 *
 * Kontrol di dalamnya tidak perlu diberi kelas: aturan `.mdl-field__control`
 * di modal.css menata input/select/textarea/file apa adanya, dan angkanya
 * dibaca dari token yang sama dengan mode edit modal detail
 * (--mdl-fs-control / --mdl-h-control), jadi tinggi dan ukuran font kedua
 * jenis modal tidak bisa menyimpang diam-diam.
 */
export function ModalField({
    label,
    hint,
    required = false,
    children,
}: {
    label: ReactNode;
    /** Keterangan kecil di bawah kontrol, mis. "Maksimal 20 MB per file". */
    hint?: ReactNode;
    /** Menambahkan penanda wajib pada label (visual saja). */
    required?: boolean;
    children: ReactNode;
}) {
    // <div>, bukan <label> pembungkus: satu field bisa memuat lebih dari satu
    // kontrol (mis. select folder + input "folder baru" yang muncul setelahnya),
    // dan <label> hanya bisa terikat ke satu kontrol — pembungkus seperti itu
    // diam-diam mengikat teksnya ke kontrol pertama saja.
    return (
        <div className="mdl-field">
            <span className="mdl-field__label">
                {label}
                {required && <span className="mdl-field__req" aria-hidden="true"> *</span>}
            </span>
            <span className="mdl-field__control">{children}</span>
            {hint && <small className="mdl-field__hint">{hint}</small>}
        </div>
    );
}

/**
 * Kotak unggah berkas untuk <ModalField>.
 *
 * Menggantikan `<input type="file">` telanjang, yang selain tampil beda di tiap
 * browser juga cuma bisa diklik dan tidak pernah menunjukkan apa yang sudah
 * dipilih selain "3 files". Di sini barisnya setinggi kontrol modal lain
 * (--mdl-h-control), menerima jatuhan berkas, dan tiap berkas terpilih muncul
 * sebagai chip yang bisa dibuang satu-satu — sebelumnya salah pilih berarti
 * harus mengulang seluruh pilihan.
 *
 * Komponennya sengaja tidak memvalidasi apa pun: ukuran/jenis berkas adalah
 * urusan pemanggil, yang sudah punya aturannya sendiri.
 */
export function ModalFileInput({
    files,
    onPick,
    accept,
    multiple = false,
    placeholder = 'Pilih berkas atau jatuhkan di sini',
    disabled = false,
}: {
    files: File[];
    /** Menerima berkas hasil pilih ATAU jatuhan; pemanggil yang memvalidasi. */
    onPick: (files: File[]) => void;
    accept?: string;
    multiple?: boolean;
    placeholder?: string;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const open = () => {
        if (!disabled) inputRef.current?.click();
    };

    const removeAt = (idx: number) => {
        onPick(files.filter((_, i) => i !== idx));
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    };

    return (
        <div className="mdl-file">
            <div
                className={`mdl-file__row ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`.trim()}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={open}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                }}
                onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                    e.preventDefault();
                    setDragging(false);
                    if (disabled) return;
                    const dropped = Array.from(e.dataTransfer.files || []);
                    if (dropped.length) onPick(multiple ? [...files, ...dropped] : dropped.slice(0, 1));
                }}
            >
                <span className="mdl-file__icon" aria-hidden="true">
                    <i className="bi bi-cloud-arrow-up-fill" />
                </span>
                <span className="mdl-file__text">
                    {files.length === 0
                        ? placeholder
                        : files.length === 1
                            ? files[0].name
                            : `${files.length} berkas dipilih`}
                </span>
                <span className="mdl-file__btn">Telusuri</span>
            </div>

            {/* `required` sengaja TIDAK dipasang: input ini disembunyikan, dan
                Chrome menolak submit dengan "not focusable" saat kontrol wajib
                tidak terlihat. Pemanggil yang menjaga syaratnya. */}
            <input
                ref={inputRef}
                type="file"
                className="mdl-file__native"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                onChange={e => {
                    const picked = Array.from(e.target.files || []);
                    if (picked.length) onPick(multiple ? [...files, ...picked] : picked);
                    // Direset supaya memilih berkas yang SAMA dua kali berturut-turut
                    // tetap memicu onChange.
                    e.target.value = '';
                }}
            />

            {files.length > 0 && (
                <ul className="mdl-file__list">
                    {files.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="mdl-file__chip">
                            <i className="bi bi-file-earmark mdl-file__chipIcon" aria-hidden="true" />
                            <span className="mdl-file__chipName" title={f.name}>{f.name}</span>
                            <span className="mdl-file__chipSize">{formatSize(f.size)}</span>
                            <button
                                type="button"
                                className="mdl-file__chipX"
                                onClick={() => removeAt(i)}
                                aria-label={`Buang ${f.name}`}
                                disabled={disabled}
                            >
                                <i className="bi bi-x-lg" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function ModalDetailGrid({ children }: { children: ReactNode }) {
    return <div className="mdl-detail__grid">{children}</div>;
}

export function ModalDetailField({
    icon,
    label,
    full = false,
    mode = 'view',
    editor,
    children,
}: {
    /** Nama ikon bootstrap tanpa prefix, mis. "person-badge-fill". */
    icon?: string;
    label: string;
    /** Melebar penuh 2 kolom ModalDetailGrid. */
    full?: boolean;
    /** 'view' menampilkan `children` apa adanya; 'edit' menampilkan `editor` (jika diisi). */
    mode?: 'view' | 'edit';
    /** Isian mode edit (input/select/textarea/dll). Kosongkan bila field ini read-only. */
    editor?: ReactNode;
    children?: ReactNode;
}) {
    const showEditor = mode === 'edit' && editor;
    return (
        <div className={`mdl-detail__item ${full ? 'mdl-detail__item--full' : ''} ${icon ? 'mdl-detail__item--has-icon' : ''}`.trim()}>
            <div className="mdl-detail__content">
                <div className="mdl-detail__label">
                    {icon && (
                        <span className="mdl-detail__label-icon" aria-hidden="true">
                            <i className={`bi bi-${icon}`} />
                        </span>
                    )}
                    <span>{label}</span>
                </div>
                {showEditor ? (
                    <div className="mdl-detail__editor">{editor}</div>
                ) : (
                    <div className="mdl-detail__value">{children}</div>
                )}
            </div>
        </div>
    );
}

export function ModalDetailFooter({
    mode,
    onClose,
    onEdit,
    onCancelEdit,
    onSave,
    isSaving = false,
    onDelete,
    isDeleting = false,
    closeLabel = 'Tutup',
    editLabel = 'Edit Data',
    cancelLabel = 'Batal',
    saveLabel = 'Simpan Perubahan',
    deleteLabel = 'Hapus',
}: {
    /** Mode aktif modal saat ini — menentukan tombol apa yang tampil. */
    mode: 'view' | 'edit';
    onClose: () => void;
    /** Mode 'view': tampilkan tombol "Edit Data" bila diisi. */
    onEdit?: () => void;
    /** Mode 'edit': tombol "Batal" — biasanya kembalikan mode ke 'view'. */
    onCancelEdit?: () => void;
    /** Mode 'edit': tombol "Simpan Perubahan". */
    onSave?: () => void;
    isSaving?: boolean;
    /** Bila diisi, tombol "Hapus" tampil di kiri footer (mode manapun). */
    onDelete?: () => void;
    isDeleting?: boolean;
    closeLabel?: string;
    editLabel?: string;
    cancelLabel?: string;
    saveLabel?: string;
    deleteLabel?: string;
}) {
    if (mode === 'edit') {
        return (
            <ModalFooter align="between">
                {onDelete ? (
                    <Button type="button" variant="danger" onClick={onDelete} isLoading={isDeleting} leftIcon={<i className="bi bi-trash" />}>
                        {deleteLabel}
                    </Button>
                ) : <div />}
                <div className="mdl-viewFoot__right">
                    <Button type="button" variant="cancel" onClick={onCancelEdit} disabled={isSaving} leftIcon={<i className="bi bi-x-lg" />}>
                        {cancelLabel}
                    </Button>
                    <Button type="button" variant="primary" onClick={onSave} isLoading={isSaving} leftIcon={<i className="bi bi-check-lg" />}>
                        {saveLabel}
                    </Button>
                </div>
            </ModalFooter>
        );
    }
    return (
        <ModalViewFooter
            onClose={onClose}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={isDeleting}
            closeLabel={closeLabel}
            editLabel={editLabel}
            deleteLabel={deleteLabel}
        />
    );
}

export default Modal;
