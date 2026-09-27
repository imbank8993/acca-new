'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { Signature, Hourglass } from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';
import { useModalBlur } from '@/components/ModalBlurProvider';
import DatePicker from '@/components/ui/DatePicker';
import { useState, useEffect, useRef } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { getCurrentUser } from '@/lib/auth-client';
import DaftarSuratPage from '@/app/surat/daftar/view';
import Tab from '@/components/ui/Tab';
import InlineSelect from '@/components/ui/InlineSelect';

// ── Types ──────────────────────────────────────────────────────
interface KodeItem { kode: string; nama: string; }

interface SuratConfig {
    format_nomor_template: string | null;
    kode1_options: KodeItem[];
    kode2_options: KodeItem[];
    kode3_options: KodeItem[];
    template_a4_url: string | null;
    template_a4_nama: string | null;
    template_f4_url: string | null;
    template_f4_nama: string | null;
}

interface MetaState {
    nomor_surat: string; nomor_kode1: string; nomor_kode2: string; nomor_kode3: string;
    nomor_urut?: number;
    perkara: string; kepada: string;
    penandatangan_id: string; penandatangan_nama: string; penandatangan_jabatan: string; penandatangan_nip: string;
    tanggal_ttd: string; jenis_surat: string;
}

// ── PengaturanForm (module-level) ──────────────────────────────
function PengaturanForm({ config, onSave, onCancel }: {
    config: SuratConfig;
    onSave: (data: any) => void;
    onCancel: () => void;
}) {
    const parseJsonArray = (val: any): KodeItem[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
        return [];
    };
    const [formatNomor, setFormatNomor] = useState(config.format_nomor_template || '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}');
    const [kode1, setKode1] = useState<KodeItem[]>(parseJsonArray(config.kode1_options));
    const [kode2, setKode2] = useState<KodeItem[]>(parseJsonArray(config.kode2_options));
    const addKode = (list: KodeItem[], setter: Function) => setter([...list, { kode: '', nama: '' }]);
    const removeKode = (index: number, list: KodeItem[], setter: Function) => setter(list.filter((_: any, i: number) => i !== index));
    const updateKode = (index: number, field: 'kode' | 'nama', value: string, list: KodeItem[], setter: Function) =>
        setter(list.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    return (
        <form onSubmit={e => { e.preventDefault(); onSave({ format_nomor_template: formatNomor, kode1_options: kode1, kode2_options: kode2 }); }}>
            <ModalBody>
                <div className="srt-field-group">
                    <label className="srt-label">Format Nomor Surat</label>
                    <input className="srt-input" value={formatNomor} onChange={e => setFormatNomor(e.target.value)} placeholder="{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}" />
                    <small style={{ color: 'var(--n-muted)', fontSize: '0.7rem' }}>Available: {'{nomor}'}, {'{kode1}'}, {'{kode2}'}, {'{kode3}'}, {'{bulan_romawi}'}, {'{tahun}'}</small>
                </div>
                <div className="srt-field-group">
                    <label className="srt-label">Kode 1</label>
                    {kode1.map((item, i) => (
                        <div key={i} className="srt-kode-row">
                            <input className="srt-input" placeholder="Kode" value={item.kode} onChange={e => updateKode(i, 'kode', e.target.value, kode1, setKode1)} />
                            <input className="srt-input" placeholder="Nama" value={item.nama} onChange={e => updateKode(i, 'nama', e.target.value, kode1, setKode1)} />
                            <button type="button" onClick={() => removeKode(i, kode1, setKode1)} className="srt-btn srt-btn-icon srt-btn-danger"><i className="bi bi-x"></i></button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addKode(kode1, setKode1)} className="srt-btn srt-btn-secondary srt-btn-sm" style={{ marginTop: '4px' }}><i className="bi bi-plus"></i> Tambah Kode 1</button>
                </div>
                <div className="srt-field-group">
                    <label className="srt-label">Kode 2</label>
                    {kode2.map((item, i) => (
                        <div key={i} className="srt-kode-row">
                            <input className="srt-input" placeholder="Kode" value={item.kode} onChange={e => updateKode(i, 'kode', e.target.value, kode2, setKode2)} />
                            <input className="srt-input" placeholder="Nama" value={item.nama} onChange={e => updateKode(i, 'nama', e.target.value, kode2, setKode2)} />
                            <button type="button" onClick={() => removeKode(i, kode2, setKode2)} className="srt-btn srt-btn-icon srt-btn-danger"><i className="bi bi-x"></i></button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addKode(kode2, setKode2)} className="srt-btn srt-btn-secondary srt-btn-sm" style={{ marginTop: '4px' }}><i className="bi bi-plus"></i> Tambah Kode 2</button>
                </div>
            </ModalBody>
            <ModalFooter align="end">
                <Button variant="cancel" type="button" onClick={onCancel}>
                    Batal
                </Button>
                <Button variant="primary" icon="save" type="submit">
                    Simpan Pengaturan
                </Button>
            </ModalFooter>
        </form>
    );
}

// ── Sub-Components ──────────────────────────────────────────

const SignView = ({
    pdfFile, pdfDoc, numPages, currentPage, setCurrentPage,
    viewportDims, placement, setPlacement, processing, isSuccess,
    generatingNumber, meta, setMeta, suratConfig, guruList, jenisSuratOptions,
    handleFileChange, handleGenerateNomor, handleProcess, handleOverlayClick,
    canvasRef, containerRef, isAdmin, setActiveTab, setShowPengaturan, setShowTemplate,
    handleOpenPengaturan, handleOpenTemplate,
    guruSearch, setGuruSearch, guruSearchOpen, setGuruSearchOpen
}: any) => (
    <div className="sign-wrap animate-srt-fade-in">


        {/* Tombol navigasi DIPISAH dari banner: di dalam banner mereka ditimpa
            gaya kaca `.pb-header-actions button` di page-banner.css dan ikut
            memakan lebar judul. Di baris sendiri mereka kembali memakai gaya
            `.srt-btn` halaman ini.

            Barisnya ditaruh DI DALAM grid, bukan di atasnya, supaya lebarnya
            terkunci ke kolom kiri (370px) dan kanvas dokumen bisa naik sejajar
            dengannya — lihat aturan penempatan di surat.css.

            "Daftarkan" tidak ikut ke sini — ia aksi utama halaman, jadi
            dipindah ke <DesktopFab> di bawah. */}
        <div className="sign-main-grid">
            <div className="sign-panel-controls">

                <div className="control-section">
                    <label className="section-label"><i className="bi bi-file-earmark-pdf"></i> Dokumen Asli</label>
                    <div className={`file-uploader ${pdfFile ? 'has-file' : ''}`}>
                        <input type="file" accept=".pdf" onChange={handleFileChange} id="pdfInputSign" className="hidden-input" />
                        <label htmlFor="pdfInputSign" className="upload-label">
                            <i className={`bi ${pdfFile ? 'bi-check-circle-fill text-success' : 'bi-cloud-arrow-up'}`}></i>
                            <span>{pdfFile ? pdfFile.name : 'Pilih Dokumen PDF'}</span>
                        </label>
                    </div>
                </div>

                <div className="control-section numbering-module">
                    <label className="section-label"><i className="bi bi-hash"></i> Penomoran Resmi Sistem</label>
                    <div className="codes-grid">
                        <div>
                            <label className="tiny-lbl">Kode 1</label>
                            <InlineSelect
                                value={meta.nomor_kode1}
                                onChange={val => setMeta({ ...meta, nomor_kode1: val })}
                                minWidth="0"
                                style={{ width: '100%' }}
                                height="34px"
                                options={(suratConfig?.kode1_options || []).map((o: any) => ({
                                    value: o.kode,
                                    label: `${o.kode} - ${o.nama}`
                                }))}
                            />
                        </div>
                        <div>
                            <label className="tiny-lbl">Kode 2</label>
                            <InlineSelect
                                value={meta.nomor_kode2}
                                onChange={val => setMeta({ ...meta, nomor_kode2: val })}
                                minWidth="0"
                                style={{ width: '100%' }}
                                height="34px"
                                options={(suratConfig?.kode2_options || []).map((o: any) => ({
                                    value: o.kode,
                                    label: `${o.kode} - ${o.nama}`
                                }))}
                            />
                        </div>
                        {suratConfig?.kode3_options && suratConfig.kode3_options.length > 0 && (
                            <div>
                                <label className="tiny-lbl">Kode 3</label>
                                <InlineSelect
                                    value={meta.nomor_kode3}
                                    onChange={val => setMeta({ ...meta, nomor_kode3: val })}
                                    minWidth="0"
                                    style={{ width: '100%' }}
                                    height="34px"
                                    options={suratConfig.kode3_options.map((o: any) => ({
                                        value: o.kode,
                                        label: `${o.kode} - ${o.nama}`
                                    }))}
                                />
                            </div>
                        )}
                    </div>
                    <button type="button" onClick={handleGenerateNomor} disabled={generatingNumber} className="srt-btn srt-btn-primary gen-btn" style={{ width: '100%', marginTop: '10px' }}>
                        {generatingNumber ? '...' : <><i className="bi bi-arrow-repeat"></i> Generate Nomor Urut</>}
                    </button>
                </div>

                <div className="control-section">
                    <label className="section-label"><i className="bi bi-pencil-square"></i> Verifikasi Metadata</label>
                    <div className="form-grid">
                        <div className="srt-field highlight-field">
                            <label className="srt-label">Nomor Surat Definitif <span className="required">*</span></label>
                            <input className="srt-input" placeholder="Tulis manual atau klik Generate" value={meta.nomor_surat} onChange={e => setMeta({ ...meta, nomor_surat: e.target.value })} />
                        </div>
                        <div className="srt-field">
                            <label className="srt-label">Perihal <span className="required">*</span></label>
                            <textarea className="srt-textarea" rows={2} placeholder="Mengenai apa dokumen ini?" value={meta.perkara} onChange={e => setMeta({ ...meta, perkara: e.target.value })} />
                        </div>
                        <div className="srt-field">
                            <label className="srt-label">Penandatangan <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="srt-input"
                                    placeholder="Klik untuk memilih penandatangan..."
                                    readOnly
                                    style={{ cursor: 'pointer' }}
                                    value={guruList.find((g: any) => g.id === meta.penandatangan_id)?.label || ''}
                                    onClick={() => setGuruSearchOpen(true)}
                                    onFocus={() => setGuruSearchOpen(true)}
                                />
                                <input type="hidden" value={meta.penandatangan_id} />
                                {guruSearchOpen && (
                                    <div className="search-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--srt-surface, #fff)', border: '1px solid var(--n-border, #e2e8f0)', borderRadius: '0 0 8px 8px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '220px', overflowY: 'auto' }}>
                                        <input
                                            type="text"
                                            className="srt-input"
                                            placeholder="Cari nama atau NIP..."
                                            autoFocus
                                            value={guruSearch}
                                            onChange={e => setGuruSearch(e.target.value)}
                                            style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: '1px solid var(--n-border, #e2e8f0)' }}
                                        />
                                        {guruList.filter((g: any) => !guruSearch || g.label?.toLowerCase().includes(guruSearch.toLowerCase())).length === 0 ? (
                                            <div style={{ padding: '10px 14px', color: 'var(--n-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Tidak ditemukan</div>
                                        ) : (
                                            guruList.filter((g: any) => !guruSearch || g.label?.toLowerCase().includes(guruSearch.toLowerCase())).map((g: any) => (
                                                <div
                                                    key={g.id}
                                                    className="search-option"
                                                    style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.83rem', borderBottom: '1px solid var(--n-border, #f1f5f9)', background: meta.penandatangan_id === g.id ? 'var(--srt-surface-hover, #eff6ff)' : 'var(--srt-surface, #fff)' }}
                                                    onClick={() => {
                                                        setMeta((prev: any) => ({ ...prev, penandatangan_id: g.id, penandatangan_nama: g.nama || g.value, penandatangan_jabatan: g.jabatan || '', penandatangan_nip: g.nip || '' }));
                                                        setGuruSearchOpen(false);
                                                        setGuruSearch('');
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--srt-surface-hover, #f0f7ff)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = meta.penandatangan_id === g.id ? 'var(--srt-surface-hover, #eff6ff)' : 'var(--srt-surface, #fff)'}
                                                >
                                                    <div style={{ fontWeight: 600, color: 'var(--n-text)' }}>{g.label}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="srt-field">
                            <label className="srt-label">Jabatan</label>
                            <input className="srt-input" placeholder="Ketik manual (bisa override)" value={meta.penandatangan_jabatan} onChange={e => setMeta((prev: any) => ({ ...prev, penandatangan_jabatan: e.target.value }))} />
                        </div>
                        <div className="srt-field">
                            <label className="srt-label">Tanggal TTD <span style={{ color: '#ef4444' }}>*</span></label>
                            <DatePicker className="srt-input" value={meta.tanggal_ttd} onChange={v => setMeta((prev: any) => ({ ...prev, tanggal_ttd: v }))} />
                        </div>
                        <div className="srt-field">
                            <label className="srt-label">Jenis Surat</label>
                            <InlineSelect
                                value={meta.jenis_surat}
                                onChange={val => setMeta((prev: any) => ({ ...prev, jenis_surat: val }))}
                                minWidth="0"
                                style={{ width: '100%' }}
                                height="38px"
                                options={[
                                    { value: '', label: '— Pilih Jenis Surat —' },
                                    ...(jenisSuratOptions || []).map((j: any) => ({
                                        value: j.kode,
                                        label: j.nama
                                    }))
                                ]}
                            />
                        </div>
                    </div>
                </div>


            </div>

            <div className="sign-panel-viewer" ref={containerRef}>
                {numPages > 1 && (
                    <div className="viewer-toolbar">
                        <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p: number) => p - 1)} className="page-btn"><i className="bi bi-chevron-left"></i></button>
                        <span className="page-indicator">Hal <strong>{currentPage}</strong> / {numPages}</span>
                        <button disabled={currentPage >= numPages} onClick={() => setCurrentPage((p: number) => p + 1)} className="page-btn"><i className="bi bi-chevron-right"></i></button>
                    </div>
                )}
                <div className="pdf-canvas-scroller">
                    {!pdfFile ? (
                        <div className="empty-placeholder">
                            <div className="empty-icon"><i className="bi bi-file-earmark-text"></i></div>
                            <h3>Silakan Unggah PDF</h3>
                            <p>Untuk memulai penentuan posisi QR Code</p>
                        </div>
                    ) : (
                        <div className="pdf-relative-wrapper" style={{ width: viewportDims.width || 'auto', height: viewportDims.height || 'auto', minWidth: '100px', minHeight: '100px' }}>
                            <canvas ref={canvasRef} className="main-pdf-canvas" />
                            <div className="pdf-interactive-overlay" onClick={handleOverlayClick}>
                                {placement && (
                                    <div className="qr-placeholder-box" style={{ left: placement.x, top: placement.y, width: placement.w, height: placement.h }}>
                                        <img src={`/api/qrcode?data=ACCA_PREVIEW_FOR_POSITION`} alt="Preview QR" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', opacity: 0.9, pointerEvents: 'none' }} />
                                        <div className="box-label">Verifikasi Digital</div>
                                        <div className="box-hint"><i className="bi bi-arrows-move"></i> Tekan ⬆⬇⬅➡</div>
                                        <div className="box-remove" onClick={e => { e.stopPropagation(); setPlacement(null); }}><i className="bi bi-x-circle-fill"></i></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* AKSI UTAMA HALAMAN — <DesktopFab> sekaligus mendaftarkan aksinya ke
            tombol tengah BottomNav, jadi mobile ikut kebagian tanpa markup lain.

            Dirender hanya setelah dokumen diunggah DAN posisi QR ditentukan.
            <DesktopFab> tidak punya keadaan nonaktif, dan sebelum dua syarat itu
            terpenuhi aksinya memang belum ada artinya — dulu tombolnya cuma
            `disabled` di banner. Selama memproses tombolnya sengaja TETAP ada
            (bukan disembunyikan) supaya umpan baliknya terlihat; kliknya yang
            dijaga. */}
        {pdfFile && placement && (
            <DesktopFab
                label={(processing || isSuccess) ? 'Memproses...' : 'Daftarkan'}
                mobileLabel={(processing || isSuccess) ? 'Proses' : 'Daftarkan'}
                /* Ikon dikirim sebagai ELEMEN, bukan nama. <DesktopFab> merender
                   `icon` bertipe string sebagai glif Bootstrap Icons (`bi bi-…`),
                   dan Bootstrap tidak punya ikon tanda tangan — namanya akan
                   diam-diam jadi kotak kosong.

                   `mobileIcon` justru harus NAMA, karena tombol tengah BottomNav
                   merendernya lewat <LucideIcon>. Nama lucide diresolusi langsung
                   di sana (`signature` -> Signature), jadi tidak perlu entri baru
                   di ICON_MAP.

                   Wajib diisi eksplisit, jangan mengandalkan tebakan otomatis
                   <DesktopFab> dari `icon.type.name`: nama komponen bisa hilang
                   saat build produksi diperkecil. */
                icon={(processing || isSuccess) ? <Hourglass size={20} /> : <Signature size={20} />}
                mobileIcon={(processing || isSuccess) ? 'hourglass' : 'signature'}
                title="Daftarkan surat & bubuhkan QR verifikasi"
                onClick={() => { if (processing || isSuccess) return; handleProcess(); }}
            />
        )}
    </div>
);

const TemplateView = ({
    isAdmin, setActiveTab, templateA4Url, templateA4Nama, templateF4Url, templateF4Nama,
    uploadingA4, uploadingF4, handleUploadTemplate, HeaderButtons, InfoBox
}: any) => (
    <div className="surat-wrap animate-srt-fade-in">
        <HeaderButtons />

        <div className="surat-quick-grid">
            <button className="surat-quick-card surat-quick-card--primary" onClick={() => setActiveTab('sign')}>
                <div className="surat-quick-icon"><i className="bi bi-shield-check"></i></div>
                <div className="surat-quick-body">
                    <div className="surat-quick-title">Tanda Tangani Surat</div>
                    <div className="surat-quick-desc">Unggah PDF/Word, Generate Nomor, &amp; Pasang QR Verifikasi</div>
                </div>
                <i className="bi bi-arrow-right-circle-fill surat-quick-arrow"></i>
            </button>

            <div className="surat-quick-card surat-quick-card--template">
                <div className="surat-quick-icon"><i className="bi bi-file-earmark-word"></i></div>
                <div className="surat-quick-body">
                    <div className="surat-quick-title">Template Surat</div>
                    <div className="surat-quick-desc">Unduh template surat untuk diisi secara manual</div>
                </div>
                {isAdmin && (
                    <div className="surat-quick-admin-badge">
                        <label title="Upload Template">
                            <i className="bi bi-upload"></i>
                            <input type="file" accept=".doc,.docx,.pdf" style={{ display: 'none' }}
                                onChange={e => { const file = e.target.files?.[0]; if (file) { const nama = file.name.toLowerCase(); if (nama.includes('f4') || nama.includes('folio')) handleUploadTemplate('F4', file); else handleUploadTemplate('A4', file); e.target.value = ''; } }} />
                        </label>
                    </div>
                )}
            </div>

            <div className="surat-quick-download-list">
                {[
                    { label: 'Template A4', url: templateA4Url, nama: templateA4Nama, format: 'A4' as const, uploading: uploadingA4 },
                    { label: 'Template F4', url: templateF4Url, nama: templateF4Nama, format: 'F4' as const, uploading: uploadingF4 },
                ].map((t: any) => (
                    <div key={t.format} className={`surat-tmpl-item ${t.uploading ? 'is-uploading' : ''} ${t.url ? 'has-file' : ''}`}>
                        {t.url ? (
                            <>
                                <div className="surat-tmpl-info">
                                    <i className="bi bi-file-earmark-word" style={{ color: '#3083FF' }}></i>
                                    <div>
                                        <div className="surat-tmpl-name">{t.nama || `Template ${t.format}`}</div>
                                        <div className="surat-tmpl-format">{t.format}</div>
                                    </div>
                                </div>
                                <div className="surat-tmpl-actions">
                                    <a href={t.url} target="_blank" rel="noopener noreferrer" download className="srt-btn srt-btn-success srt-btn-sm"><i className="bi bi-download"></i></a>
                                    {isAdmin && (
                                        <label className="srt-btn srt-btn-secondary srt-btn-sm">
                                            <i className="bi bi-arrow-repeat"></i>
                                            <input type="file" accept=".doc,.docx,.pdf" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadTemplate(t.format, file); e.target.value = ''; }} />
                                        </label>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="surat-tmpl-info">
                                    <i className="bi bi-file-earmark-plus" style={{ color: '#cbd5e1' }}></i>
                                    <div>
                                        <div className="surat-tmpl-name">Template {t.format}</div>
                                        <div className="surat-tmpl-format">Belum ada</div>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <label className="srt-btn srt-btn-primary srt-btn-sm">
                                        <i className="bi bi-upload"></i>
                                        <input type="file" accept=".doc,.docx,.pdf" style={{ display: 'none' }} disabled={t.uploading}
                                            onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadTemplate(t.format, file); e.target.value = ''; }} />
                                    </label>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
        <InfoBox />
    </div>
);

/* Tombol navigasi dikeluarkan dari banner dengan alasan yang sama seperti di
   SignView di atas: di dalam banner keempatnya ditimpa `.pb-header-actions
   button` (page-banner.css) sehingga `.srt-btn-active` ikut rata — penanda tab
   mana yang sedang dibuka jadi hilang. Bannernya sendiri kini tinggal judul +
   deskripsi, jadi otomatis tidak dirender sama sekali. */
const DaftarView = ({ HeaderButtons }: any) => (
    <div className="surat-wrap animate-srt-fade-in">
        <HeaderButtons />
        <DaftarSuratPage hideHeader={true} />
    </div>
);

// ── Main Page ─────────────────────────────────────────────────
export default function SuratPage() {
    const router = useRouter();
    const { openModal, closeModal } = useModalBlur();
    const [activeTab, setActiveTab] = useTabParam<'sign' | 'daftar'>('sign', ['sign', 'daftar']);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showPengaturan, setShowPengaturan] = useState(false);
    const [showTemplate, setShowTemplate] = useState(false);

    const handleOpenPengaturan = () => {
        openModal();
        setShowPengaturan(true);
    };

    const handleClosePengaturan = () => {
        closeModal();
        setShowPengaturan(false);
    };

    const handleOpenTemplate = () => {
        openModal();
        setShowTemplate(true);
    };

    const handleCloseTemplate = () => {
        closeModal();
        setShowTemplate(false);
    };
    const [templateA4Url, setTemplateA4Url] = useState<string | null>(null);
    const [templateA4Nama, setTemplateA4Nama] = useState<string | null>(null);
    const [templateF4Url, setTemplateF4Url] = useState<string | null>(null);
    const [templateF4Nama, setTemplateF4Nama] = useState<string | null>(null);
    const [uploadingA4, setUploadingA4] = useState(false);
    const [uploadingF4, setUploadingF4] = useState(false);
    const [suratConfig, setSuratConfig] = useState<SuratConfig | null>(null);
    const [meta, setMeta] = useState<MetaState>({
        nomor_surat: '', nomor_kode1: 'A', nomor_kode2: '001', nomor_kode3: '',
        nomor_urut: undefined,
        perkara: '', kepada: '',
        penandatangan_id: '', penandatangan_nama: '', penandatangan_jabatan: '', penandatangan_nip: '',
        tanggal_ttd: '', jenis_surat: '',
    });
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewportDims, setViewportDims] = useState({ width: 0, height: 0 });
    const [pagePhysicalDims, setPagePhysicalDims] = useState({ width: 0, height: 0 }); // PDF page actual size in points
    const [renderScale, setRenderScale] = useState(1); // How much PDF was scaled to fit container
    const [placement, setPlacement] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [processing, setProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [generatingNumber, setGeneratingNumber] = useState(false);
    const [guruList, setGuruList] = useState<any[]>([]);
    const [guruSearch, setGuruSearch] = useState('');
    const [guruSearchOpen, setGuruSearchOpen] = useState(false);
    const [jenisSuratOptions, setJenisSuratOptions] = useState<any[]>([]);
    const [profilSekolah, setProfilSekolah] = useState<any>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Prefill tanggal_ttd with local today's date (YYYY-MM-DD)
        setMeta(prev => ({ ...prev, tanggal_ttd: new Date().toLocaleDateString('sv-SE') }));

        const init = async () => {
            const uData = await getCurrentUser();
            if (uData) {
                const roles = (uData?.roles || []).map((r: string) => r.toUpperCase().replace(/\s+/g, '_'));
                setIsAdmin(roles.some((r: string) => ['ADMIN', 'ADMINISTRATOR'].includes(r)) || !!(uData as any).isAdmin);
            }
            const configRes = await fetch('/api/config-surat').then(r => r.json().catch(() => ({ ok: false })));
            if (configRes.ok && configRes.data) {
                const d = configRes.data;
                setSuratConfig({
                    format_nomor_template: d.format_nomor_template || '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}',
                    kode1_options: parseJsonArray(d.kode1_options),
                    kode2_options: parseJsonArray(d.kode2_options),
                    kode3_options: parseJsonArray(d.kode3_options),
                    template_a4_url: d.template_a4_url || null,
                    template_a4_nama: d.template_a4_nama || null,
                    template_f4_url: d.template_f4_url || null,
                    template_f4_nama: d.template_f4_nama || null,
                });
                setMeta(prev => ({
                    ...prev,
                    nomor_kode1: parseJsonArray(d.kode1_options)[0]?.kode || 'A',
                    nomor_kode2: parseJsonArray(d.kode2_options)[0]?.kode || '001',
                    nomor_kode3: parseJsonArray(d.kode3_options)[0]?.kode || '',
                }));
            }
            // Ambil daftar penandatangan dari master_guru
            const guruRes = await fetch('/api/surat/guru?limit=500').then(r => r.json().catch(() => ({ ok: false })));
            if (guruRes.ok && guruRes.data) {
                setGuruList(guruRes.data.map((g: any) => ({
                    id: g.id,
                    value: g.nama_lengkap,
                    label: g.nama_lengkap,
                    nama: g.nama_lengkap,
                    nip: g.nip || '',
                    jabatan: g.jabatan || '',
                })));
            }
            // Ambil daftar jenis surat dari master_dropdown
            const jenisRes = await fetch('/api/dropdown/jenis-surat').then(r => r.json().catch(() => ({ ok: false })));
            if (jenisRes.ok && jenisRes.data && jenisRes.data.length > 0) {
                setJenisSuratOptions(jenisRes.data);
                setMeta((prev: any) => ({ ...prev, jenis_surat: jenisRes.data[0].kode || '' }));
            }
            // Ambil profil sekolah untuk tempat_ttd otomatis
            const profilRes = await fetch('/api/profil-sekolah').then(r => r.json().catch(() => ({ ok: false })));
            if (profilRes.ok && profilRes.data) {
                setProfilSekolah(profilRes.data);
            }
            // Ambil URL template tersimpan dari /api/surat/templates/urls
            const tmplRes = await fetch('/api/surat/templates/urls').then(r => r.json().catch(() => ({ ok: false })));
            if (tmplRes.ok && tmplRes.data) {
                const a4 = tmplRes.data['TEMPLATE_A4'];
                const f4 = tmplRes.data['TEMPLATE_F4'];
                if (a4?.template_html) {
                    setTemplateA4Url(a4.template_html);
                    setTemplateA4Nama(a4.nama_template || 'Template A4');
                }
                if (f4?.template_html) {
                    setTemplateF4Url(f4.template_html);
                    setTemplateF4Nama(f4.nama_template || 'Template F4');
                }
            }
            setLoading(false);
        };
        init();
    }, []);

    const parseJsonArray = (val: any): KodeItem[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
        return [];
    };

    const handleUploadTemplate = async (format: 'A4' | 'F4', file: File) => {
        if (!file) return;
        if (format === 'A4') setUploadingA4(true); else setUploadingF4(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'Template Surat');

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok || !uploadJson.ok || !uploadJson.publicUrl) {
                throw new Error(uploadJson.error || 'Upload gagal');
            }

            // Simpan referensi ke database template surat
            try {
                await fetch('/api/surat/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jenis_surat: `TEMPLATE_${format}`,
                        nama_template: file.name.replace(/\.[^.]+$/i, ''),
                        template_html: uploadJson.publicUrl,
                    }),
                });
            } catch (tmplErr) {
                console.warn('Gagal mencatat template ke surat_templates:', tmplErr);
            }

            if (format === 'A4') {
                setTemplateA4Url(uploadJson.publicUrl);
                setTemplateA4Nama(file.name);
            } else {
                setTemplateF4Url(uploadJson.publicUrl);
                setTemplateF4Nama(file.name);
            }
            Swal.fire({ icon: 'success', title: 'Tersimpan', text: `Template ${format} berhasil diupload`, confirmButtonColor: '#3083FF' });
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setUploadingA4(false);
            setUploadingF4(false);
        }
    };

    const handleSavePengaturan = async (data: any) => {
        try {
            const saveRes = await fetch('/api/config-surat', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ format_nomor_template: data.format_nomor_template, kode1_options: JSON.stringify(data.kode1_options || []), kode2_options: JSON.stringify(data.kode2_options || []) }),
            });
            const saveJson = await saveRes.json();
            if (!saveJson.ok) throw new Error(saveJson.error);

            // Perbarui state lokal secara reaktif seketika
            setSuratConfig(prev => ({
                format_nomor_template: data.format_nomor_template,
                kode1_options: data.kode1_options || [],
                kode2_options: data.kode2_options || [],
                kode3_options: prev?.kode3_options || [],
                template_a4_url: prev?.template_a4_url || null,
                template_a4_nama: prev?.template_a4_nama || null,
                template_f4_url: prev?.template_f4_url || null,
                template_f4_nama: prev?.template_f4_nama || null,
            }));
            if (data.kode1_options?.length > 0) {
                setMeta(prev => ({ ...prev, nomor_kode1: data.kode1_options[0].kode }));
            }
            if (data.kode2_options?.length > 0) {
                setMeta(prev => ({ ...prev, nomor_kode2: data.kode2_options[0].kode }));
            }

            handleClosePengaturan();
            Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Pengaturan surat berhasil disimpan', confirmButtonColor: '#3083FF' });
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error');
        }
    };

    const handleGenerateNomor = async () => {
        setGeneratingNumber(true);
        try {
            const tahun = new Date().getFullYear();
            const params = new URLSearchParams({ tahun: tahun.toString(), kode1: meta.nomor_kode1, kode2: meta.nomor_kode2, kode3: meta.nomor_kode3 });
            const res = await fetch(`/api/surat/generate-number?${params.toString()}`);
            const json = await res.json();
            if (json.ok && json.data) {
                setMeta(prev => ({ ...prev, nomor_surat: json.data.nomor_surat, nomor_urut: json.data.nomor_urut }));
                Swal.fire({ icon: 'success', title: 'Nomor Berhasil', text: json.data.nomor_surat, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
            } else throw new Error(json.error || 'Gagal Generate');
        } catch (e: any) { Swal.fire('Error', e.message, 'error'); }
        finally { setGeneratingNumber(false); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf') {
            e.target.value = '';
            return Swal.fire({
                icon: 'warning',
                title: 'Format Dokumen',
                html: `Dokumen yang akan ditandatangani secara digital harus dalam format <strong>PDF</strong> agar posisi QR verifikasi presisi.<br/><br/><small style="color:#64748b">Jika Anda menggunakan Microsoft Word (.docx), silakan simpan terlebih dahulu via <em>File &rarr; Save As &rarr; PDF</em> lalu unggah file PDF tersebut.</small>`,
                confirmButtonColor: '#3083FF',
                confirmButtonText: 'Mengerti'
            });
        }
        setPdfFile(file);
        setPlacement(null);
        await loadPdfDocument(file);
    };

    const loadPdfJsIfNeeded = (): Promise<void> => {
        if ((window as any).pdfjsLib) return Promise.resolve();
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.async = true;
            script.onload = () => {
                const lib = (window as any).pdfjsLib;
                if (lib) {
                    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
                resolve();
            };
            script.onerror = () => resolve();
            document.body.appendChild(script);
        });
    };

    const loadPdfDocument = async (file: File) => {
        await loadPdfJsIfNeeded();
        if (!(window as any).pdfjsLib) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'PDF Engine gagal dimuat. Silakan refresh halaman.' });
            return;
        }
        setProcessing(true);
        try {
            const reader = new FileReader();
            reader.onload = async function (ev) {
                try {
                    const arr = new Uint8Array(ev.target?.result as ArrayBuffer);
                    const pdf = await (window as any).pdfjsLib.getDocument({ data: arr }).promise;
                    setPdfDoc(pdf); 
                    setNumPages(pdf.numPages); 
                    setCurrentPage(1);
                } catch (e) {
                    console.error('[PDF] Load Error:', e);
                    Swal.fire('Error', 'Gagal memproses file PDF.', 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (e) { 
            console.error('[PDF] Reader Error:', e);
            Swal.fire('Error', 'Gagal membaca PDF.', 'error'); 
        } finally { 
            setProcessing(false); 
        }
    };

    const renderPage = async (pdf: any, pageNum: number) => {
        if (!pdf || !canvasRef.current || activeTab !== 'sign') return;
        try {
            const page = await pdf.getPage(pageNum);
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const targetWidth = containerRef.current?.clientWidth || 800;
            const originalViewport = page.getViewport({ scale: 1.0 });

            if (originalViewport.width === 0) return;

            const scale = (targetWidth - 40) / originalViewport.width;
            const viewport = page.getViewport({ scale: scale > 0 ? scale : 1.0 });

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            setViewportDims({ width: viewport.width, height: viewport.height });
            // Simpan dimensi asli PDF (dalam point) & scale factor
            setPagePhysicalDims({ width: originalViewport.width, height: originalViewport.height });
            setRenderScale(scale > 0 ? scale : 1.0);

            await page.render({ canvasContext: ctx, viewport }).promise;
            console.log(`[PDF] Page ${pageNum} rendered. Scale=${scale.toFixed(3)}`);
        } catch (e) {
            console.error('[PDF] Render Error:', e);
        }
    };

    useEffect(() => {
        if (pdfDoc && activeTab === 'sign') {
            const timer = setTimeout(() => renderPage(pdfDoc, currentPage), 100);
            return () => clearTimeout(timer);
        }
    }, [currentPage, pdfDoc, activeTab]);

    useEffect(() => {
        if (!guruSearchOpen) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Element;
            if (!target.closest('.srt-field')) setGuruSearchOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [guruSearchOpen]);

    // ─── Keyboard arrow controls for QR placement ───
    useEffect(() => {
        if (!placement) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const step = 5; // pixel per tekan
            const maxX = viewportDims.width - placement.w;
            const maxY = viewportDims.height - placement.h;
            let { x, y } = placement;
            switch (e.key) {
                case 'ArrowLeft':  e.preventDefault(); x = Math.max(0, x - step); break;
                case 'ArrowRight': e.preventDefault(); x = Math.min(maxX, x + step); break;
                case 'ArrowUp':    e.preventDefault(); y = Math.max(0, y - step); break;
                case 'ArrowDown':  e.preventDefault(); y = Math.min(maxY, y + step); break;
                default: return;
            }
            setPlacement(prev => prev ? { ...prev, x, y } : null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [placement, viewportDims]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!viewportDims.width || !canvasRef.current) return;
        // Measure from BOTH the overlay rect AND the actual canvas rect
        // so we can compare and see which one aligns with the user's visual click
        const overlayRect = e.currentTarget.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const size = Math.round(56.7 * (renderScale || 1.0));

        // Click relative to overlay (original approach)
        const ovX = e.clientX - overlayRect.left;
        const ovY = e.clientY - overlayRect.top;
        // Click relative to canvas
        const cvX = e.clientX - canvasRect.left;
        const cvY = e.clientY - canvasRect.top;

        // Place using canvas-relative coords (more accurate since canvas IS the PDF rendered)
        let x = cvX - size / 2;
        let y = cvY - size / 2;
        x = Math.max(0, Math.min(x, canvasRect.width - size));
        y = Math.max(0, Math.min(y, canvasRect.height - size));

        console.log(`[QR-DBG] canvasRect=(${canvasRect.left.toFixed(0)},${canvasRect.top.toFixed(0)}) ${canvasRect.width.toFixed(0)}x${canvasRect.height.toFixed(0)}`);
        console.log(`[QR-DBG] overlayRect=(${overlayRect.left.toFixed(0)},${overlayRect.top.toFixed(0)}) ${overlayRect.width.toFixed(0)}x${overlayRect.height.toFixed(0)}`);
        console.log(`[QR-DBG] clickRel=Ov(${ovX.toFixed(0)},${ovY.toFixed(0)}) Cv(${cvX.toFixed(0)},${cvY.toFixed(0)}) size=${size} placement=(${x},${y})`);
        console.log(`[QR-DBG] renderScale=${renderScale} vDims=${viewportDims.width}x${viewportDims.height} pPhys=${pagePhysicalDims.width}x${pagePhysicalDims.height}`);

        setPlacement({ x, y, w: size, h: size });
    };

    const handleProcess = async () => {
        if (processing || isSuccess) return;
        if (!pdfFile || !placement) return Swal.fire('Validasi', 'Pilih file & klik lokasi QR.', 'warning');
        if (!meta.penandatangan_id) return Swal.fire('Validasi', 'Pilih penandatangan.', 'warning');
        if (!meta.nomor_surat || !meta.perkara) return Swal.fire('Validasi', 'Isi minimal Nomor Surat dan Perihal.', 'warning');
        setProcessing(true);
        try {
            // CRITICAL: measure ACTUAL rendered canvas dimensions at submit time.
            // canvas.width is set in logical pixels, but CSS may scale it down
            // (e.g., container has padding or scrollbar). getBoundingClientRect()
            // gives the rendered px that matches what the user actually sees.
            const canvasEl = canvasRef.current;
            const actualW = canvasEl ? Math.round(canvasEl.getBoundingClientRect().width) : viewportDims.width;
            const actualH = canvasEl ? Math.round(canvasEl.getBoundingClientRect().height) : viewportDims.height;
            // pagePhysicalWidth/Height: actual rendered canvas px / renderScale = PDF pt
            // This is what the server uses as the scale denominator
            const physW = Math.round(actualW / (renderScale || 1));
            const physH = Math.round(actualH / (renderScale || 1));

            console.log(`[Sign] ACTUAL canvas=${actualW}x${actualH} physW=${physW}x${physH} renderScale=${renderScale} placement=(${placement.x},${placement.y}) ${placement.w}x${placement.h}`);

            const currentUser = await getCurrentUser();
            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('data', JSON.stringify({
                suratData: { nomor_surat: meta.nomor_surat, nomor_urut: meta.nomor_urut || parseInt(meta.nomor_surat.split('/')[0]) || 1, nomor_kode1: meta.nomor_kode1, nomor_kode2: meta.nomor_kode2, nomor_kode3: meta.nomor_kode3, perkara: meta.perkara, kepada: meta.kepada, pejabat_id: meta.penandatangan_id, pejabat_nama: meta.penandatangan_nama, pejabat_jabatan: meta.penandatangan_jabatan, pejabat_nip: meta.penandatangan_nip, tanggal_ttd: meta.tanggal_ttd, jenis_surat: meta.jenis_surat },
                userId: currentUser?.auth_id || currentUser?.id,
                placement: { x: placement.x, y: placement.y, width: placement.w, height: placement.h, pageNum: currentPage, pageWidth: actualW, pageHeight: actualH, pagePhysicalWidth: physW, pagePhysicalHeight: physH },
                baseUrl: window.location.origin,
            }));
            Swal.fire({
                title: 'Memproses...',
                html: `
                    <div class="srt-modern-loader-container">
                        <div class="srt-modern-spinner"></div>
                        <p class="srt-modern-loader-text">Menandatangani & Mengunggah dokumen...</p>
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: false,
                customClass: {
                    popup: 'srt-modern-loader-popup'
                }
            });
            const res = await fetch('/api/surat/sign-pdf', { method: 'POST', body: formData });
            const result = await res.json();
            Swal.close();
            if (!res.ok || !result.ok) throw new Error(result.error || 'Proses gagal');
            setIsSuccess(true);
            await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Dokumen berhasil ditandatangani.', confirmButtonColor: '#3083FF', confirmButtonText: 'Lihat Hasil' });
            setActiveTab('daftar');
        } catch (e: any) { Swal.fire('Gagal', e.message, 'error'); }
        finally { setProcessing(false); }
    };

    const HeaderButtons = () => (
        <div className="surat-header-actions">
            {isAdmin && (
                <button onClick={handleOpenPengaturan} className="srt-btn srt-btn-secondary">
                    <i className="bi bi-gear"></i> Pengaturan
                </button>
            )}
            <button onClick={handleOpenTemplate} className="srt-btn srt-btn-secondary">
                <i className="bi bi-file-earmark-word"></i> Template
            </button>
            <button onClick={() => setActiveTab('sign')} className={`srt-btn srt-btn-secondary ${activeTab === 'sign' ? 'srt-btn-active' : ''}`}>
                <i className="bi bi-shield-check"></i> Tanda Tangani
            </button>
            <button onClick={() => setActiveTab('daftar')} className={`srt-btn srt-btn-secondary ${activeTab === 'daftar' ? 'srt-btn-active' : ''}`}>
                <i className="bi bi-list-check"></i> Daftar Surat
            </button>
        </div>
    );

    const activeConfig: SuratConfig = suratConfig || {
        format_nomor_template: '{nomor}/{kode1}/{kode2}/{bulan_romawi}/{tahun}',
        kode1_options: [],
        kode2_options: [],
        kode3_options: [],
        template_a4_url: null,
        template_a4_nama: null,
        template_f4_url: null,
        template_f4_nama: null,
    };

    const PengaturanModal = () => {
        if (!showPengaturan) return null;
        return (
            <Modal
                open={showPengaturan}
                onClose={handleClosePengaturan}
                title="Pengaturan Surat"
                subtitle="Konfigurasi penomoran dan kode klasifikasi surat"
                icon="gear"
                size="lg"
                variant="edit"
            >
                <PengaturanForm config={activeConfig} onSave={(data) => { handleSavePengaturan(data); handleClosePengaturan(); }} onCancel={handleClosePengaturan} />
            </Modal>
        );
    };

    const TemplateModal = () => {
        if (!showTemplate) return null;
        return (
            <Modal
                open={showTemplate}
                onClose={handleCloseTemplate}
                title="Template Surat"
                subtitle="Unduh template surat untuk diisi secara manual"
                icon="file-earmark-word"
                size="md"
            >
                <ModalBody>
                    {[
                        { label: 'Template A4', url: templateA4Url, nama: templateA4Nama, format: 'A4' as const, uploading: uploadingA4 },
                        { label: 'Template F4', url: templateF4Url, nama: templateF4Nama, format: 'F4' as const, uploading: uploadingF4 },
                    ].map((t: any) => (
                        <div key={t.format} className="srt-template-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <i className={`bi ${t.url ? 'bi-file-earmark-word' : 'bi-file-earmark-plus'}`} style={{ fontSize: '1.5rem', color: t.url ? '#3b82f6' : '#94a3b8' }}></i>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--n-text)' }}>{t.nama || `Template ${t.format}`}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)' }}>{t.url ? t.format : 'Belum tersedia'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {t.url && (
                                    <a href={t.url} target="_blank" rel="noopener noreferrer" download className="srt-btn srt-btn-success srt-btn-sm"><i className="bi bi-download"></i> Download</a>
                                )}
                                {isAdmin && (
                                    <label className="srt-btn srt-btn-secondary srt-btn-sm" style={{ cursor: 'pointer' }}>
                                        <i className="bi bi-upload"></i> Upload
                                        <input type="file" accept=".doc,.docx,.pdf" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadTemplate(t.format, file); e.target.value = ''; }} />
                                    </label>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="srt-template-hint" style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(148,163,184,0.05)', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.15)', fontSize: '0.78rem', color: 'var(--n-muted)', lineHeight: 1.5 }}>
                        <i className="bi bi-info-circle-fill" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
                        Unduh template, isi menggunakan Microsoft Word, lalu upload kembali di halaman Tanda Tangani.
                    </div>
                </ModalBody>
                <ModalFooter align="end">
                    <Button variant="cancel" type="button" onClick={handleCloseTemplate}>
                        Tutup
                    </Button>
                </ModalFooter>
            </Modal>
        );
    };

    const InfoBox = () => (
        <div className="surat-info-box">
            <div className="surat-info-icon"><i className="bi bi-info-circle-fill"></i></div>
            <div className="surat-info-content">
                <h4>Alur Kerja Surat</h4>
                <ol>
                    <li>Unduh template surat (A4 atau F4) dan isi menggunakan Microsoft Word</li>
                    <li>Klik <strong>Tanda Tangani Surat</strong> untuk mengunggah file yang sudah diisi</li>
                    <li>Sistem akan otomatis generate nomor surat resmi dan QR verifikasi</li>
                    <li>Dokumen ditandatangani secara digital dan tercatat di database</li>
                </ol>
            </div>
        </div>
    );

    if (loading) {
        return <PageLoader label="Memuat…" />;
    }

    return (
        <>
            <MaintenanceBanner pageKey="maintenance_surat" />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <Tab
                    tabs={[
                        { key: 'sign', label: 'Tanda Tangani Surat', icon: 'shield-check' },
                        { key: 'daftar', label: 'Daftar Surat', icon: 'list-check' },
                    ]}
                    activeTab={activeTab}
                    onChange={(key) => setActiveTab(key as 'sign' | 'daftar')}
                    ariaLabel="Navigasi Halaman Surat"
                />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isAdmin && (
                        <button onClick={handleOpenPengaturan} className="srt-btn srt-btn-secondary">
                            <i className="bi bi-gear"></i> Pengaturan
                        </button>
                    )}
                    <button onClick={handleOpenTemplate} className="srt-btn srt-btn-secondary">
                        <i className="bi bi-file-earmark-word"></i> Template
                    </button>
                </div>
            </div>

            {activeTab === 'sign' && (
                <SignView
                    pdfFile={pdfFile} pdfDoc={pdfDoc} numPages={numPages}
                    currentPage={currentPage} setCurrentPage={setCurrentPage}
                    viewportDims={viewportDims} placement={placement} setPlacement={setPlacement}
                    processing={processing} isSuccess={isSuccess} generatingNumber={generatingNumber}
                    meta={meta} setMeta={setMeta} suratConfig={suratConfig} guruList={guruList}
                    jenisSuratOptions={jenisSuratOptions}
                    handleFileChange={handleFileChange} handleGenerateNomor={handleGenerateNomor}
                    handleProcess={handleProcess} handleOverlayClick={handleOverlayClick}
                    canvasRef={canvasRef} containerRef={containerRef} isAdmin={isAdmin}
                    setActiveTab={setActiveTab} setShowPengaturan={setShowPengaturan} setShowTemplate={setShowTemplate}
                    handleOpenPengaturan={handleOpenPengaturan} handleOpenTemplate={handleOpenTemplate}
                    guruSearch={guruSearch} setGuruSearch={setGuruSearch} guruSearchOpen={guruSearchOpen} setGuruSearchOpen={setGuruSearchOpen}
                />
            )}
            {activeTab === 'daftar' && (
                <div className="surat-wrap animate-srt-fade-in">
                    <DaftarSuratPage hideHeader={true} />
                </div>
            )}

            <PengaturanModal />
            <TemplateModal />
        </>
    );
}