'use client';
import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import Swal from 'sweetalert2';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import Button from '@/components/ui/Button';

const swalSuccess = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'success', confirmButtonText: 'OK',
    confirmButtonColor: '#3083FF', customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-primary' }
});

const swalError = (title: string, text?: string) => Swal.fire({
    title, text, icon: 'error', confirmButtonText: 'OK',
    confirmButtonColor: '#dc2626', customClass: { popup: 'swal-premium', confirmButton: 'swal-btn-danger' }
});

interface ProfilSekolah {
    id?: string;
    npsn: string;
    nsm: string;
    nds: string;
    nama: string;
    jenjang: string;
    jenis: string;
    status: string;
    alamat: string;
    desa_kelurahan: string;
    kecamatan: string;
    kabupaten_kota: string;
    provinsi: string;
    kode_pos: string;
    telepon: string;
    fax: string;
    email: string;
    website: string;
    kepala_sekolah_nama: string;
    kepala_sekolah_nip: string;
    kepala_sekolah_nuptk: string;
    bagian_default: string;
    kode_bagian_default: string;
    logo_url: string;
    logo_kecil_url: string;
    background_surat_url: string;
    header_surat_text: string;
    footer_surat_text: string;
    format_nomor_surat: string;
}

const JENJANG_OPTIONS = ['SD', 'SMP', 'SMA', 'SMK', 'MI', 'MTs', 'MA', 'MAK'];
const JENIS_OPTIONS = ['NEGERI', 'SWASTA'];

export default function ProfilSekolahTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profil, setProfil] = useState<Partial<ProfilSekolah>>({});
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await fetch('/api/profil-sekolah');
            const json = await res.json();
            if (json.ok && json.data) {
                setProfil(json.data);
                setLogoPreview(json.data.logo_url || null);
                setImageError(false);
            }
        } catch (e) {
            console.error('Load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof ProfilSekolah, value: string) => {
        setProfil(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            swalError('Validasi', 'File harus berupa gambar');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            swalError('Validasi', 'Ukuran file maksimal 2MB');
            return;
        }

        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'profil_sekolah');

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const uploadResult = await res.json();

            if (!uploadResult.ok) {
                throw new Error(uploadResult.error || 'Gagal mengunggah logo');
            }

            // Update profil state with new logo URL
            setProfil(prev => ({ ...prev, logo_url: uploadResult.publicUrl }));
            setLogoPreview(uploadResult.publicUrl);
            setImageError(false);

            // Langsung simpan URL logo ke database agar tidak hilang bila
            // pengguna lupa menekan "Simpan Profil" (API mendukung partial update).
            if (profil.id) {
                const saved = await persistLogoUrl(uploadResult.publicUrl);
                if (saved) {
                    await swalSuccess('Berhasil', 'Logo sekolah berhasil diunggah dan tersimpan.');
                } else {
                    await swalError('Perhatian', 'Logo terunggah tetapi gagal tersimpan otomatis. Klik "Simpan Perubahan Profil" untuk menyimpannya.');
                }
            } else {
                await swalSuccess('Berhasil', 'Logo sekolah berhasil diunggah. Jangan lupa klik "Simpan Profil" di bawah!');
            }

        } catch (err: any) {
            swalError('Gagal Upload', err.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    // Simpan hanya logo_url (partial update). Return true bila sukses.
    const persistLogoUrl = async (logoUrl: string | null): Promise<boolean> => {
        try {
            const res = await fetch('/api/profil-sekolah', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: profil.id, logo_url: logoUrl || '' })
            });
            const json = await res.json();
            return !!json.ok;
        } catch {
            return false;
        }
    };

    const handleRemoveLogo = async () => {
        setProfil(prev => ({ ...prev, logo_url: undefined }));
        setLogoPreview(null);
        setImageError(false);
        if (profil.id) {
            await persistLogoUrl(null);
        }
    };

    const handleSave = async () => {
        if (!profil.nama) {
            swalError('Validasi', 'Nama sekolah wajib diisi');
            return;
        }
        setSaving(true);
        try {
            const method = profil.id ? 'PUT' : 'POST';
            const res = await fetch('/api/profil-sekolah', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profil)
            });
            const json = await res.json();
            if (json.ok) {
                setProfil(prev => ({ ...prev, id: json.data.id }));
                await swalSuccess('Berhasil', 'Profil sekolah berhasil disimpan');
            } else {
                throw new Error(json.error);
            }
        } catch (e: any) {
            swalError('Gagal', e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageLoader minHeight="300px" dotsOnly size={18} />;
    }

    return (
        <div className="ps-container">
            <div className="ps-grid">
                
                {/* LEFT SIDEBAR - Logo & Stats */}
                <div className="ps-sidebar">
                    <div className="ps-logo-card">
                        <h3 className="ps-section-title">Logo Sekolah</h3>
                        <p className="ps-section-desc">Identitas visual utama instansi</p>
                        
                        <div className="ps-logo-wrapper">
                            <div className="ps-logo-inner">
                                {logoPreview && !imageError ? (
                                    <img
                                        src={logoPreview}
                                        alt="Logo Sekolah"
                                        className="ps-logo-img"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="ps-logo-placeholder">
                                        <i className="bi bi-image"></i>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="ps-logo-actions">
                            <label htmlFor="logo-upload" className={`ps-logo-btn-upload ${uploadingLogo ? 'disabled' : ''}`}>
                                <i className={`bi ${uploadingLogo ? 'bi-hourglass-split animate-spin' : 'bi-cloud-upload'}`}></i>
                                {uploadingLogo ? null : 'Unggah Logo'}
                            </label>
                            <input
                                type="file"
                                id="logo-upload"
                                accept="image/png,image/jpeg,image/svg+xml"
                                onChange={handleLogoUpload}
                                disabled={uploadingLogo}
                                style={{ display: 'none' }}
                            />

                            {logoPreview && (
                                <ActionButton action="delete" onClick={handleRemoveLogo} title="Hapus Logo" />
                            )}
                        </div>
                        <p className="ps-hint-text">Format PNG/JPG/SVG max 2MB</p>
                    </div>
                </div>

                {/* RIGHT SIDE - Main Forms */}
                <div className="ps-main">
                    <div className="ps-form-card">
                        <div className="ps-form-header">
                            <i className="bi bi-building"></i>
                            <h4>Informasi Institusi</h4>
                        </div>
                        
                        <div className="ps-form-grid">
                            <div className="ps-col-full">
                                <label className="ps-label">Nama Sekolah *</label>
                                <input type="text" className="ps-input" value={profil.nama || ''} onChange={e => handleChange('nama', e.target.value)} placeholder="Masukkan Nama Sekolah Lengkap" />
                            </div>
                            
                            <div>
                                <label className="ps-label">NPSN</label>
                                <input type="text" className="ps-input" value={profil.npsn || ''} onChange={e => handleChange('npsn', e.target.value)} placeholder="Nomor Pokok Sekolah Nasional" />
                            </div>
                            <div>
                                <label className="ps-label">NSM <span className="ps-optional">(Opsional)</span></label>
                                <input type="text" className="ps-input" value={profil.nsm || ''} onChange={e => handleChange('nsm', e.target.value)} placeholder="Nomor Statistik Madrasah" />
                            </div>
                            
                            <div>
                                <label className="ps-label">Jenjang</label>
                                <select className="ps-input" value={profil.jenjang || ''} onChange={e => handleChange('jenjang', e.target.value)}>
                                    <option value="">-- Pilih Jenjang --</option>
                                    {JENJANG_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="ps-label">Jenis</label>
                                <select className="ps-input" value={profil.jenis || ''} onChange={e => handleChange('jenis', e.target.value)}>
                                    <option value="">-- Pilih Jenis --</option>
                                    {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>

                            <div className="ps-col-full">
                                <label className="ps-label">Alamat Lengkap</label>
                                <textarea className="ps-input ps-textarea" value={profil.alamat || ''} onChange={e => handleChange('alamat', e.target.value)} placeholder="Jalan, Blok, Nomor Rumah..." rows={2} />
                            </div>

                            <div>
                                <label className="ps-label">Kecamatan</label>
                                <input type="text" className="ps-input" value={profil.kecamatan || ''} onChange={e => handleChange('kecamatan', e.target.value)} />
                            </div>
                            <div>
                                <label className="ps-label">Kabupaten/Kota</label>
                                <input type="text" className="ps-input" value={profil.kabupaten_kota || ''} onChange={e => handleChange('kabupaten_kota', e.target.value)} />
                            </div>
                            <div>
                                <label className="ps-label">Provinsi</label>
                                <input type="text" className="ps-input" value={profil.provinsi || ''} onChange={e => handleChange('provinsi', e.target.value)} />
                            </div>
                            <div>
                                <label className="ps-label">Kode Pos</label>
                                <input type="text" className="ps-input" value={profil.kode_pos || ''} onChange={e => handleChange('kode_pos', e.target.value)} />
                            </div>
                        </div>

                        <div className="ps-divider"></div>

                        <div className="ps-form-header">
                            <i className="bi bi-telephone"></i>
                            <h4>Kontak & Status</h4>
                        </div>

                        <div className="ps-form-grid">
                            <div>
                                <label className="ps-label">Telepon / WhatsApp</label>
                                <input type="text" className="ps-input" value={profil.telepon || ''} onChange={e => handleChange('telepon', e.target.value)} placeholder="+62..." />
                            </div>
                            <div>
                                <label className="ps-label">Email</label>
                                <input type="email" className="ps-input" value={profil.email || ''} onChange={e => handleChange('email', e.target.value)} placeholder="sekolah@email.com" />
                            </div>
                            <div>
                                <label className="ps-label">Website</label>
                                <input type="url" className="ps-input" value={profil.website || ''} onChange={e => handleChange('website', e.target.value)} placeholder="https://..." />
                            </div>
                            <div>
                                <label className="ps-label">Status</label>
                                <select className="ps-input" value={profil.status || ''} onChange={e => handleChange('status', e.target.value)}>
                                    <option value="Aktif">🟢 Aktif</option>
                                    <option value="Non Aktif">🔴 Non Aktif</option>
                                </select>
                            </div>
                        </div>

                        <div className="ps-divider"></div>

                        <div className="ps-form-header">
                            <i className="bi bi-person-badge"></i>
                            <h4>Struktural Pimpinan</h4>
                        </div>

                        <div className="ps-form-grid">
                            <div className="ps-col-full">
                                <label className="ps-label">Nama Kepala Sekolah</label>
                                <input type="text" className="ps-input" value={profil.kepala_sekolah_nama || ''} onChange={e => handleChange('kepala_sekolah_nama', e.target.value)} placeholder="Lengkap beserta gelar..." />
                            </div>
                            <div>
                                <label className="ps-label">NIP</label>
                                <input type="text" className="ps-input" value={profil.kepala_sekolah_nip || ''} onChange={e => handleChange('kepala_sekolah_nip', e.target.value)} placeholder="18 Digit NIP" />
                            </div>
                            <div>
                                <label className="ps-label">NUPTK</label>
                                <input type="text" className="ps-input" value={profil.kepala_sekolah_nuptk || ''} onChange={e => handleChange('kepala_sekolah_nuptk', e.target.value)} placeholder="16 Digit NUPTK" />
                            </div>
                        </div>
                    </div>

                    <div className="ps-action-bar">
                        <Button
                            variant="primary"
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            isLoading={saving}
                            leftIcon={<i className="bi bi-check-lg" />}
                        >
                            Simpan Perubahan Profil
                        </Button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .ps-container {
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .ps-grid {
                    display: grid;
                    grid-template-columns: 240px 1fr;
                    gap: 12px;
                    align-items: flex-start;
                }

                /* SIDEBAR / LOGO CARD */
                .ps-sidebar {
                    position: sticky;
                    top: 20px;
                }
                .ps-logo-card {
                    background: var(--n-card);
                    border-radius: 12px;
                    border: 1px solid var(--n-border, #e2e8f0);
                    padding: 16px 14px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.03);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .ps-section-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--n-ink, #1e293b);
                }
                .ps-section-desc {
                    font-size: 0.72rem;
                    color: var(--n-muted);
                    margin: 2px 0 12px;
                }

                .ps-logo-wrapper {
                    width: 120px;
                    height: 120px;
                    padding: 6px;
                    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                    border-radius: 16px;
                    margin-bottom: 12px;
                }
                .ps-logo-inner {
                    width: 100%;
                    height: 100%;
                    background: var(--n-card);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid white;
                }
                .ps-logo-img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 8px;
                }
                .ps-logo-placeholder {
                    color: #cbd5e1;
                    font-size: 2.2rem;
                }

                .ps-logo-actions {
                    display: flex;
                    gap: 6px;
                    width: 100%;
                    justify-content: center;
                }
                .ps-logo-btn-upload {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 0 12px;
                    height: 34px;
                    background: var(--n-primary, #3083FF);
                    color: white;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0, 56, 168, 0.15);
                }
                .ps-logo-btn-upload:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 56, 168, 0.25);
                    filter: brightness(1.1);
                }
                .ps-logo-btn-delete {
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #fef2f2;
                    color: #ef4444;
                    border: 1.5px solid #fee2e2;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                }
                .ps-logo-btn-delete:hover {
                    background: #ef4444;
                    color: white;
                    border-color: #ef4444;
                }
                .ps-hint-text {
                    font-size: 0.68rem;
                    color: var(--n-muted);
                    margin: 8px 0 0;
                    line-height: 1.3;
                }

                /* MAIN FORMS */
                .ps-form-card {
                    background: var(--n-card);
                    border-radius: 12px;
                    border: 1px solid var(--n-border, #e2e8f0);
                    padding: 16px 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.03);
                }
                .ps-form-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .ps-form-header i {
                    font-size: 0.95rem;
                    color: var(--n-primary, #3083FF);
                    background: rgba(0, 56, 168, 0.08);
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ps-form-header h4 {
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--n-ink, #1e293b);
                }

                .ps-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px 12px;
                }
                .ps-col-full {
                    grid-column: 1 / -1;
                }
                
                .ps-label {
                    display: block;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--n-muted);
                    margin-bottom: 3px;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .ps-optional {
                    color: var(--n-muted);
                    text-transform: none;
                    font-weight: 400;
                }
                .ps-input {
                    width: 100%;
                    padding: 5px 10px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border);
                    background: var(--n-soft);
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--n-text);
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .ps-input:focus {
                    outline: none;
                    border-color: var(--n-primary, #3083FF);
                    background: var(--n-card);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.08);
                }
                .ps-input::placeholder { color: var(--n-muted); font-weight: 400; }
                textarea.ps-input { resize: vertical; min-height: 54px; height: auto; font-family: inherit; line-height: 1.4; padding: 6px 10px; }
                
                .ps-divider {
                    height: 1px;
                    background: linear-gradient(to right, var(--n-border), transparent);
                    margin: 14px 0;
                }

                .ps-action-bar {
                    margin-top: 14px;
                    display: flex;
                    justify-content: flex-end;
                }
                .ps-btn-submit {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 20px;
                    height: 36px;
                    background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(194, 24, 91, 0.2);
                    transition: all 0.2s ease;
                }
                .ps-btn-submit:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(194, 24, 91, 0.3);
                    filter: brightness(1.05);
                }
                .ps-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

                /* ANIMATION HELPERS */
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* RESPONSIVE */
                @media (max-width: 992px) {
                    .ps-grid { grid-template-columns: 1fr; }
                    .ps-sidebar { position: static; }
                    .ps-logo-card { flex-direction: row; text-align: left; padding: 20px; gap: 20px; }
                    .ps-logo-wrapper { margin-bottom: 0; flex-shrink: 0; width: 120px; height: 120px; }
                    .ps-logo-actions { justify-content: flex-start; }
                }
                @media (max-width: 640px) {
                    .ps-logo-card { flex-direction: column; text-align: center; }
                    .ps-logo-actions { justify-content: center; }
                    .ps-form-grid { grid-template-columns: 1fr; }
                    .ps-form-card { padding: 20px; }
                    .ps-btn-submit { width: 100%; justify-content: center; }
                }

                /* DARK MODE SUPPORT */
                :global(.dark) .ps-logo-card,
                :global(.dark) .ps-form-card {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .ps-section-title,
                :global(.dark) .ps-form-header h4 {
                    color: #ffffff !important;
                }
                :global(.dark) .ps-logo-inner {
                    background: #000000 !important;
                    border-color: rgba(26, 115, 232, 0.6) !important;
                }
                :global(.dark) .ps-logo-wrapper {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.2) 0%, #000000 100%) !important;
                }
                :global(.dark) .ps-logo-btn-delete {
                    background: rgba(239, 68, 68, 0.15) !important;
                    border-color: rgba(239, 68, 68, 0.4) !important;
                }
                :global(.dark) .ps-form-header i {
                    background: rgba(26, 115, 232, 0.15) !important;
                    color: #60a5fa !important;
                }
                :global(.dark) .ps-input {
                    height: 40px !important;
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) select.ps-input {
                    background-color: #000000 !important;
                    background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 12px center !important;
                    background-size: 16px 16px !important;
                    padding-right: 36px !important;
                    -webkit-appearance: none !important;
                    appearance: none !important;
                }
                :global(.dark) textarea.ps-input {
                    height: auto !important;
                }
                :global(.dark) .ps-input:focus {
                    background: #000000 !important;
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.4) !important;
                }
                :global(.dark) .ps-divider {
                    background: linear-gradient(to right, rgba(26, 115, 232, 0.5), transparent) !important;
                }
                :global(.dark) .ps-label { color: #94a3b8 !important; }
                :global(.dark) .ps-btn-submit {
                    height: 40px !important;
                    padding: 0 24px !important;
                    background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
                    color: #ffffff !important;
                    border: 1px solid rgba(59, 130, 246, 0.6) !important;
                    border-radius: 12px !important;
                    box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .ps-btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
                    box-shadow: 0 6px 20px rgba(26, 115, 232, 0.65) !important;
                    transform: translateY(-1px) !important;
                }


            `}</style>
        </div>
    );
}