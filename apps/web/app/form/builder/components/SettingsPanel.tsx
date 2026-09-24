'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FormField, FieldOption, FieldCondition, ConditionOperator } from '../../types';
import { getFieldDef } from '../../field-registry';
import Swal from 'sweetalert2';

interface SettingsPanelProps {
  field: FormField | null;
  allFields: FormField[];
  onUpdate: (updated: FormField) => void;
  onClose: () => void;
}

function OptionEditor({
  options,
  onChange,
  enableScoring,
}: {
  options: FieldOption[];
  onChange: (opts: FieldOption[]) => void;
  enableScoring?: boolean;
}) {
  const addOption = () => {
    const idx = options.length + 1;
    onChange([...options, { label: `Pilihan ${idx}`, value: `option_${idx}` }]);
  };

  const removeOption = (i: number) => {
    onChange(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, patch: Partial<FieldOption>) => {
    const updated = options.map((o, idx) =>
      idx === i ? { 
        ...o, 
        ...patch, 
        value: patch.label !== undefined ? patch.label.toLowerCase().replace(/\s+/g, '_') : o.value 
      } : o
    );
    onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        {options.map((opt, i) => (
          <div 
            key={i} 
            className="sp-card"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '8px 12px', 
              borderRadius: '4px' 
            }}
          >
            <span className="sp-hint" style={{ fontSize: '12px', fontWeight: 700, width: '20px', textAlign: 'center', flexShrink: 0 }}>
              {i + 1}.
            </span>
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOption(i, { label: e.target.value })}
              className="sp-input"
              style={{
                flex: 1,
                padding: '0 14px',
                height: '38px',
                fontSize: '12px',
                borderRadius: '4px',
                fontWeight: 500,
                outline: 'none',
              }}
              placeholder={`Opsi ${i + 1}...`}
            />
            {enableScoring && (
              <input
                type="number"
                value={opt.score ?? ''}
                onChange={(e) => updateOption(i, { score: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="sp-input"
                style={{
                  width: '70px',
                  padding: '0 8px',
                  height: '38px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  outline: 'none',
                }}
                placeholder="Skor"
                title="Skor (Bobot Nilai)"
              />
            )}
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={options.length <= 1}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: options.length <= 1 ? 'not-allowed' : 'pointer',
                opacity: options.length <= 1 ? 0.3 : 1,
                flexShrink: 0,
              }}
              title="Hapus opsi"
            >
              <i className="bi bi-trash text-xs" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={addOption}
          className="sp-btn-sub"
          style={{
            flex: 1,
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          <i className="bi bi-plus-circle-fill text-sm" /> Tambah Pilihan Jawaban
        </button>

        {options.length > 2 && (
          <button
            type="button"
            onClick={() => {
              Swal.fire({
                title: 'Hapus Semua Opsi?',
                text: 'Yakin ingin menghapus seluruh daftar opsi ini? Opsi akan dikembalikan ke setelan awal.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#94a3b8',
                confirmButtonText: 'Ya, Hapus Semua',
                cancelButtonText: 'Batal'
              }).then((result) => {
                if (result.isConfirmed) {
                  onChange([{ label: 'Pilihan 1', value: 'pilihan_1' }]);
                }
              });
            }}
            className="sp-btn-danger-sub"
            style={{
              height: '38px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <i className="bi bi-trash-fill text-sm" /> Hapus Semua
          </button>
        )}
      </div>
    </div>
  );
}

/** Header Seksi Modal dengan Garis Pemisah Putus-Putus Eksplisit */
function SectionDivider({ title, icon }: { title: string; icon?: string }) {
  return (
    <div 
      className="sp-divider border-t-2 border-dashed border-slate-200 dark:border-blue-500/35"
      style={{ 
        paddingTop: '16px', 
        marginTop: '20px', 
      }}
    >
      <h4 
        className="text-[#3083FF] dark:text-blue-400"
        style={{ 
          fontSize: '11px', 
          fontWeight: 800, 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em', 
          marginBottom: '14px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}
      >
        {icon && <i className={`bi ${icon}`} style={{ fontSize: '13px' }} />}
        <span>{title}</span>
      </h4>
    </div>
  );
}

/** Input Row untuk Modal dengan Spacing & Padding Eksplisit */
function InputRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label className="sp-label text-slate-700 dark:text-slate-200" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && <p className="sp-hint text-slate-400 dark:text-slate-400" style={{ fontSize: '11px', marginTop: '5px', lineHeight: '1.4' }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0 16px',
  height: '40px',
  fontSize: '12px',
  borderRadius: '4px',
  fontWeight: 500,
  outline: 'none',
  boxSizing: 'border-box',
};

export function SettingsPanel({ field, allFields, onUpdate, onClose }: SettingsPanelProps) {
  const [local, setLocal] = useState<FormField | null>(null);
  const [mounted, setMounted] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [importingSource, setImportingSource] = useState(false);
  const [selectedSource, setSelectedSource] = useState('guru');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocal(field ? { ...field } : null);
  }, [field]);

  if (!field || !local || !mounted) return null;

  const def = getFieldDef(field.type);
  const set = (partial: Partial<FormField>) => {
    setLocal((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'form_ratings');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.ok && (data.publicUrl || data.url)) {
        set({ photoUrl: data.publicUrl || data.url });
        Swal.fire({
          title: 'Berhasil Upload',
          text: 'Foto subjek berhasil diunggah ke server penyimpanan aktif.',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
        });
      } else {
        Swal.fire('Gagal Upload', data.error || 'Gagal mengunggah gambar', 'error');
      }
    } catch (err: any) {
      console.error('Photo upload error:', err);
      Swal.fire('Error', 'Terjadi kesalahan jaringan saat mengunggah foto', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleImportOptions = async () => {
    setImportingSource(true);
    try {
      const res = await fetch(`/api/forms/dynamic-options?source=${selectedSource}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        set({ options: data.options, optionSource: 'manual' });
        Swal.fire({
          title: 'Impor Berhasil',
          text: `Berhasil menarik ${data.options.length} pilihan dari database.`,
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
        });
      } else {
        Swal.fire('Gagal Impor', data.error || 'Gagal memuat opsi dari database', 'error');
      }
    } catch (err) {
      Swal.fire('Gagal Impor', 'Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setImportingSource(false);
    }
  };

  const handleSave = () => {
    if (local) onUpdate(local);
    onClose();
  };

  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type);
  const availableTargetFields = allFields.filter(
    (f) => f.id !== field.id && !['heading', 'paragraph', 'divider'].includes(f.type)
  );

  // Field lain yang punya opsi — kandidat sumber "opsi yang sudah dipilih"
  const optionSourceFields = allFields.filter(
    (f) => f.id !== field.id && ['select', 'radio', 'checkbox'].includes(f.type) && (f.options?.length || 0) > 0
  );

  const toggleExcludeSource = (sourceId: string, checked: boolean) => {
    const current = local.excludeChosenFrom || [];
    const updated = checked ? [...current, sourceId] : current.filter((id) => id !== sourceId);
    set({ excludeChosenFrom: updated.length > 0 ? updated : undefined });
  };

  // ── Conditional Logic Helpers ──
  const addCondition = () => {
    if (availableTargetFields.length === 0) return;
    const firstTarget = availableTargetFields[0];
    const newCond: FieldCondition = {
      targetFieldId: firstTarget.id,
      operator: 'equals',
      value: firstTarget.options?.[0]?.value || '',
    };
    set({ conditions: [...(local.conditions || []), newCond] });
  };

  const removeCondition = (idx: number) => {
    const updated = (local.conditions || []).filter((_, i) => i !== idx);
    set({ conditions: updated.length > 0 ? updated : undefined });
  };

  const updateCondition = (idx: number, patch: Partial<FieldCondition>) => {
    const updated = (local.conditions || []).map((c, i) => (i === idx ? { ...c, ...patch } : c));
    set({ conditions: updated });
  };

  // Render via React Portal langsung ke document.body agar menutupi Sidebar & Header secara utuh
  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
      }}
    >
      <div 
        className="sp-modal"
        style={{
          width: '100%',
          maxWidth: '780px',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '88vh',
          margin: 'auto',
        }}
      >
        {/* Header Modal (Eksak Gradasi Biru-Magenta) */}
        <div 
          style={{ 
            background: 'var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)))',
            padding: '18px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                width: '34px', 
                height: '34px', 
                borderRadius: '6px', 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                border: '1px solid rgba(255,255,255,0.3)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0 
              }}
            >
              <i className={`bi ${def.icon}`} style={{ fontSize: '16px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Pengaturan Komponen: {def.label}
              </h3>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', margin: '2px 0 0 0' }}>
                Atur label, opsi jawaban, validasi, dan logika bercabang.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: '16px',
            }}
            title="Tutup Modal"
          >
            <i className="bi bi-x-lg" style={{ fontSize: '13px' }} />
          </button>
        </div>

        {/* Body Modal (PADDING 28px KIRI & KANAN EKSPLISIT -> BEBAS OVERFLOW) */}
        <div 
          className="sp-modal-body"
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '24px 32px', 
            boxSizing: 'border-box' 
          }}
        >
          {/* ── SEKSI 1: UMUM ── */}
          <SectionDivider title="Pengaturan Umum" icon="bi-gear-fill" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <InputRow label="Label Field (Judul Pertanyaan)">
                <input
                  type="text"
                  value={local.label}
                  onChange={(e) => set({ label: e.target.value })}
                  style={inputStyle}
                  placeholder="Contoh: Nama Lengkap Responden"
                />
              </InputRow>
            </div>

            {local.type === 'heading' && (
              <InputRow label="Ukuran Judul">
                <select
                  value={local.headingLevel || 'h2'}
                  onChange={(e) => set({ headingLevel: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="h1">Judul Utama (H1 - Besar)</option>
                  <option value="h2">Subjudul (H2 - Sedang)</option>
                  <option value="h3">Bagian Kecil (H3 - Kecil)</option>
                </select>
              </InputRow>
            )}

            {local.type === 'paragraph' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <InputRow label="Teks Penjelasan / Instruksi">
                  <textarea
                    value={local.content || ''}
                    onChange={(e) => set({ content: e.target.value })}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 500,
                      outline: 'none',
                      boxSizing: 'border-box',
                      lineHeight: '1.5',
                    }}
                    placeholder="Tuliskan petunjuk atau penjelasan rinci untuk pengguna..."
                  />
                </InputRow>
              </div>
            )}

            {!['heading', 'paragraph', 'divider'].includes(local.type) && (
              <div style={{ gridColumn: '1 / -1' }}>
                <InputRow label="Teks Bantuan (Hint)">
                  <input
                    type="text"
                    value={local.description || ''}
                    onChange={(e) => set({ description: e.target.value })}
                    style={inputStyle}
                    placeholder="Petunjuk di bawah kolom..."
                  />
                </InputRow>
              </div>
            )}

            {['text', 'textarea', 'number', 'email', 'phone', 'url'].includes(local.type) && (
              <div style={{ gridColumn: '1 / -1' }}>
                <InputRow label="Placeholder Kolom">
                  <input
                    type="text"
                    value={local.placeholder || ''}
                    onChange={(e) => set({ placeholder: e.target.value })}
                    style={inputStyle}
                    placeholder="Teks contoh saat kolom belum diisi..."
                  />
                </InputRow>
              </div>
            )}
          </div>

          {/* ── SEKSI 2: TATA LETAK ── */}
          <SectionDivider title="Tata Letak & Tampilan" icon="bi-layout-split" />

          <InputRow label="Lebar Tampilan Kolom pada Form">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', paddingTop: '4px' }}>
              {([['full', '1 Kolom'], ['half', '2 Kolom'], ['third', '3 Kolom']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set({ width: val })}
                  className={local.width === val ? 'sp-layout-btn-active' : 'sp-layout-btn'}
                  style={{
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: local.width === val ? 700 : 500,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {val === 'full' && (
                    <div style={{ width: '20px', height: '12px', backgroundColor: local.width === val ? '#3083FF' : '#94a3b8', borderRadius: '2px' }} />
                  )}
                  {val === 'half' && (
                    <div style={{ display: 'flex', gap: '2px', width: '20px', height: '12px' }}>
                      <div style={{ flex: 1, backgroundColor: local.width === val ? '#3083FF' : '#94a3b8', borderRadius: '2px' }} />
                      <div style={{ flex: 1, backgroundColor: local.width === val ? '#3083FF' : '#94a3b8', borderRadius: '2px' }} />
                    </div>
                  )}
                  {val === 'third' && (
                    <div style={{ display: 'flex', gap: '2px', width: '20px', height: '12px' }}>
                      <div style={{ flex: 1, backgroundColor: local.width === val ? '#3083FF' : '#94a3b8', borderRadius: '2px' }} />
                      <div style={{ flex: 1, backgroundColor: local.width === val ? '#3083FF' : '#94a3b8', borderRadius: '2px' }} />
                      <div style={{ flex: 1, backgroundColor: local.width === val ? '#3083FF' : '#94a3b8', borderRadius: '2px' }} />
                    </div>
                  )}
                  {lbl}
                </button>
              ))}
            </div>
          </InputRow>

          {/* ── SEKSI 3: VALIDASI & SYARAT ── */}
          {!['heading', 'paragraph', 'divider'].includes(local.type) && (
            <>
              <SectionDivider title="Aturan Validasi & Syarat Pengisian" icon="bi-shield-check" />

              <div 
                className="sp-card"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '14px 18px', 
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <p className="sp-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>
                    Wajib Diisi oleh Responden
                  </p>
                  <p className="sp-hint" style={{ fontSize: '11px', margin: '2px 0 0 0' }}>
                    Responden tidak bisa mengirim form jika field ini tidak diisi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => set({ required: !local.required })}
                  style={{
                    position: 'relative',
                    width: '40px',
                    height: '22px',
                    borderRadius: '999px',
                    backgroundColor: local.required ? '#3083FF' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: local.required ? '20px' : '2px',
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>

              {/* TOGGLE SKORING (KUIS) */}
              {['select', 'radio', 'checkbox'].includes(local.type) && (
                <>
                  <div 
                    className="sp-card-active"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '14px 18px', 
                      borderRadius: '4px',
                      marginBottom: '16px'
                    }}
                  >
                    <div>
                      <p className="sp-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>
                        Aktifkan Mode Skoring (Kuis)
                      </p>
                      <p className="sp-hint" style={{ fontSize: '11px', margin: '2px 0 0 0' }}>
                        Beri nilai/bobot pada setiap opsi jawaban untuk dikalkulasi otomatis.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set({ enableScoring: !local.enableScoring, scoreCategory: !local.enableScoring ? 'Skor Utama' : undefined })}
                      style={{
                        position: 'relative',
                        width: '40px',
                        height: '22px',
                        borderRadius: '999px',
                        backgroundColor: local.enableScoring ? '#3083FF' : '#cbd5e1',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: local.enableScoring ? '20px' : '2px',
                          width: '18px',
                          height: '18px',
                          backgroundColor: '#ffffff',
                          borderRadius: '50%',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      />
                    </button>
                  </div>

                  {local.enableScoring && (
                    <div style={{ marginBottom: '16px' }}>
                      <InputRow label="Kategori Skor (Opsional)" hint="Misal: 'Skor Utama' atau 'Skor Tie Breaker'. Biarkan kosong untuk total biasa.">
                        <input
                          type="text"
                          value={local.scoreCategory || ''}
                          onChange={(e) => set({ scoreCategory: e.target.value })}
                          style={inputStyle}
                          placeholder="Kategori Skor..."
                        />
                      </InputRow>
                    </div>
                  )}
                </>
              )}

              {['text', 'textarea'].includes(local.type) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <InputRow label="Min Karakter">
                    <input
                      type="number"
                      min={0}
                      value={local.minLength ?? ''}
                      onChange={(e) => set({ minLength: e.target.value ? Number(e.target.value) : undefined })}
                      style={inputStyle}
                      placeholder="Contoh: 3"
                    />
                  </InputRow>
                  <InputRow label="Maks Karakter">
                    <input
                      type="number"
                      min={0}
                      value={local.maxLength ?? ''}
                      onChange={(e) => set({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
                      style={inputStyle}
                      placeholder="Contoh: 255"
                    />
                  </InputRow>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <InputRow label="Regex Pattern Format (Opsional)" hint="Misal: ^[0-9]{18}$ untuk format 18 digit NIP">
                      <input
                        type="text"
                        value={local.pattern || ''}
                        onChange={(e) => set({ pattern: e.target.value })}
                        style={inputStyle}
                        placeholder="Format regex..."
                      />
                    </InputRow>
                  </div>
                  {local.pattern && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <InputRow label="Pesan Eror Jika Format Tidak Sesuai">
                        <input
                          type="text"
                          value={local.patternMessage || ''}
                          onChange={(e) => set({ patternMessage: e.target.value })}
                          style={inputStyle}
                          placeholder="Contoh: Format NIP harus 18 digit angka"
                        />
                      </InputRow>
                    </div>
                  )}
                </div>
              )}

              {local.type === 'number' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <InputRow label="Nilai Minimal">
                    <input
                      type="number"
                      value={local.min ?? ''}
                      onChange={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })}
                      style={inputStyle}
                    />
                  </InputRow>
                  <InputRow label="Nilai Maksimal">
                    <input
                      type="number"
                      value={local.max ?? ''}
                      onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })}
                      style={inputStyle}
                    />
                  </InputRow>
                </div>
              )}

              {local.type === 'slider' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  <InputRow label="Batas Minimal">
                    <input
                      type="number"
                      value={local.min ?? 1}
                      onChange={(e) => set({ min: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </InputRow>
                  <InputRow label="Batas Maksimal">
                    <input
                      type="number"
                      value={local.max ?? 10}
                      onChange={(e) => set({ max: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </InputRow>
                  <InputRow label="Kelipatan Step">
                    <input
                      type="number"
                      value={local.step ?? 1}
                      onChange={(e) => set({ step: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </InputRow>
                </div>
              )}

              {local.type === 'rating' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <InputRow label="Jumlah Maksimal Bintang">
                    <select
                      value={local.maxRating ?? 5}
                      onChange={(e) => set({ maxRating: Number(e.target.value) })}
                      style={inputStyle}
                    >
                      <option value={3}>3 Bintang</option>
                      <option value={5}>5 Bintang</option>
                      <option value={10}>10 Bintang</option>
                    </select>
                  </InputRow>

                  <InputRow label="Foto Subjek Rating (Unggah File / Tempel URL)" hint="Unggah foto dari komputer Anda atau masukkan link URL (misal foto guru, pegawai, atau produk)">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            height: '38px',
                            padding: '0 16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '4px',
                            cursor: uploadingPhoto ? 'wait' : 'pointer',
                            opacity: uploadingPhoto ? 0.7 : 1,
                          }}
                          className="sp-btn-sub hover:bg-blue-100 transition-colors shadow-xs"
                        >
                          {uploadingPhoto ? (
                            <>
                              <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-400 border-t-[#3083FF] rounded-full" />
                              <span>Mengunggah Ke Penyimpanan...</span>
                            </>
                          ) : (
                            <>
                              <i className="bi bi-cloud-arrow-up-fill text-sm" />
                              <span>Unggah Foto dari Perangkat</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploadingPhoto}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>

                      <input
                        type="url"
                        value={local.photoUrl || ''}
                        onChange={(e) => set({ photoUrl: e.target.value })}
                        style={inputStyle}
                        placeholder="Atau tempel link URL foto: https://contoh.com/foto.jpg"
                      />
                    </div>
                  </InputRow>

                  {local.photoUrl && (
                    <div className="sp-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        <img
                          src={local.photoUrl}
                          alt="Preview Subjek"
                          style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #94a3b8', flexShrink: 0 }}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <span className="sp-label" style={{ fontSize: '12px', fontWeight: 800, display: 'block' }}>Foto Subjek Terpasang</span>
                          <span className="sp-hint" style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{local.photoUrl}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => set({ photoUrl: '' })}
                        className="sp-btn-danger-sub hover:bg-rose-200 transition-colors"
                        style={{
                          height: '32px',
                          padding: '0 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          marginLeft: '12px',
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              )}

              {local.type === 'page_break' && (
                <InputRow label="Judul Bagian / Langkah Baru" hint="Judul bagian ini akan ditampilkan pada Indikator Stepper Bar di bagian atas formulir">
                  <input
                    type="text"
                    value={local.pageTitle || local.label || ''}
                    onChange={(e) => set({ pageTitle: e.target.value, label: e.target.value })}
                    style={inputStyle}
                    placeholder="Contoh: Bagian 2 - Evaluasi Pembelajaran"
                  />
                </InputRow>
              )}


            </>
          )}

          {/* ── SEKSI 4: PILIHAN JAWABAN ── */}
          {hasOptions && (
            <>
              <SectionDivider title="Daftar Pilihan Jawaban" icon="bi-list-check" />

              <InputRow label="Impor Data Cepat dari Database ACCA (Opsional)" hint="Tarik data nama dari sistem untuk diisi ke opsi pilihan di bawah secara otomatis.">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="guru">Daftar Nama Guru (Master Guru)</option>
                    <option value="students">Daftar Nama Siswa (Master Siswa)</option>
                    <option value="kelas">Daftar Kelas / Rombel (Master Kelas)</option>
                    <option value="mapel">Daftar Mata Pelajaran (Master Mapel)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleImportOptions}
                    disabled={importingSource}
                    className="sp-btn-sub hover:bg-blue-100 transition-colors"
                    style={{
                      padding: '0 16px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: importingSource ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: importingSource ? 0.7 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {importingSource ? (
                      <><div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-[#3083FF] rounded-full" /> Menarik...</>
                    ) : (
                      <><i className="bi bi-cloud-download text-sm" /> Tarik Data</>
                    )}
                  </button>
                </div>
              </InputRow>

              <OptionEditor options={local.options || []} onChange={(opts) => set({ options: opts })} enableScoring={local.enableScoring} />

              {optionSourceFields.length > 0 && (
                <div className="sp-card" style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '4px' }}>
                  <p className="sp-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="bi bi-slash-circle text-blue-600 dark:text-blue-400" />
                    Sembunyikan Opsi yang Sudah Dipilih Di:
                  </p>
                  <p className="sp-hint" style={{ fontSize: '11px', margin: '4px 0 10px', lineHeight: '1.4' }}>
                    Centang field lain agar opsi yang sudah dipakai di sana tidak muncul lagi di field ini.
                    Berguna untuk Pilihan 1 &amp; Pilihan 2 yang tidak boleh sama. Biarkan kosong agar semua opsi selalu tampil.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {optionSourceFields.map((f) => {
                      const checked = (local.excludeChosenFrom || []).includes(f.id);
                      return (
                        <label
                          key={f.id}
                          className={checked ? "sp-card-active" : "sp-card"}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleExcludeSource(f.id, e.target.checked)}
                            style={{ width: '15px', height: '15px', accentColor: '#3083FF', cursor: 'pointer' }}
                          />
                          <span className="sp-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                            {f.label} <span className="sp-hint" style={{ fontWeight: 500 }}>({f.type})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── SEKSI 5: PERTANYAAN BERCABANG ── */}
          <SectionDivider title="Pertanyaan Bercabang (Logika Kondisional)" icon="bi-diagram-3" />

          {availableTargetFields.length === 0 ? (
            <div className="sp-card" style={{ padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
              <i className="bi bi-diagram-2 text-slate-400 dark:text-slate-500" style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }} />
              <p className="sp-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>Belum Ada Field Lain di Kanvas</p>
              <p className="sp-hint" style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.4' }}>
                Tambahkan field lain terlebih dahulu di kanvas untuk membuat pertanyaan bercabang.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="sp-label" style={{ fontSize: '12px', fontWeight: 700 }}>Tampilkan field ini jika memenuhi syarat:</span>
                <button
                  type="button"
                  onClick={addCondition}
                  className="sp-btn-sub"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '36px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <i className="bi bi-plus-lg text-xs" /> Tambah Aturan Syarat
                </button>
              </div>

              {(local.conditions || []).length > 1 && (
                <div className="sp-card" style={{ padding: '12px 14px', borderRadius: '4px' }}>
                  <label className="sp-hint" style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                    Gabungan Antar Syarat:
                  </label>
                  <select
                    value={local.conditionLogic || 'and'}
                    onChange={(e) => set({ conditionLogic: e.target.value as 'and' | 'or' })}
                    style={inputStyle}
                  >
                    <option value="and">DAN — semua syarat harus terpenuhi</option>
                    <option value="or">ATAU — cukup salah satu syarat terpenuhi</option>
                  </select>
                  <p className="sp-hint" style={{ fontSize: '11px', marginTop: '6px', lineHeight: '1.4' }}>
                    Pakai <b>ATAU</b> misalnya untuk soal jurusan yang harus muncul bila jurusan itu dipilih
                    di Pilihan 1 <i>atau</i> di Pilihan 2.
                  </p>
                </div>
              )}

              {(!local.conditions || local.conditions.length === 0) ? (
                <div className="sp-card" style={{ padding: '14px', borderRadius: '4px', textAlign: 'center' }}>
                  <p className="sp-hint" style={{ fontSize: '12px', margin: 0 }}>
                    Belum ada syarat. Field ini akan selalu tampil pada formulir.
                  </p>
                </div>
              ) : (
                (local.conditions || []).map((cond, idx) => {
                  const targetField = allFields.find((f) => f.id === cond.targetFieldId);
                  const targetOptions = targetField?.options;

                  return (
                    <div 
                      key={idx} 
                      className="sp-card"
                      style={{ borderRadius: '4px', overflow: 'hidden' }}
                    >
                      <div 
                        className="sp-card-head"
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '10px 16px', 
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#3083FF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="bi bi-diagram-3-fill text-xs" />
                          Syarat Aturan #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCondition(idx)}
                          style={{
                            padding: '4px 10px',
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Hapus Syarat Ini"
                        >
                          <i className="bi bi-trash text-xs" />
                          <span>Hapus</span>
                        </button>
                      </div>

                      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                            1. Target Field Pemicu:
                          </label>
                          <select
                            value={cond.targetFieldId}
                            onChange={(e) => updateCondition(idx, { targetFieldId: e.target.value })}
                            style={inputStyle}
                          >
                            {availableTargetFields.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label} ({f.type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                            2. Kondisi Logika:
                          </label>
                          <select
                            value={cond.operator}
                            onChange={(e) => updateCondition(idx, { operator: e.target.value as ConditionOperator })}
                            style={inputStyle}
                          >
                            <option value="equals">Sama dengan ( = )</option>
                            <option value="not_equals">Tidak sama dengan ( ≠ )</option>
                            <option value="contains">Mengandung kata</option>
                            <option value="is_not_empty">Terisi (Tidak kosong)</option>
                            <option value="is_empty">Kosong</option>
                          </select>
                        </div>

                        {!['is_not_empty', 'is_empty'].includes(cond.operator) && (
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                              3. Nilai Kunci Jawaban:
                            </label>
                            {targetOptions && targetOptions.length > 0 ? (
                              <select
                                value={cond.value || ''}
                                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                style={inputStyle}
                              >
                                {targetOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label} ({opt.value})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={cond.value || ''}
                                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                style={inputStyle}
                                placeholder="Ketik nilai acuan..."
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div 
          className="sp-modal-footer"
          style={{ 
            padding: '16px 28px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            gap: '12px', 
            flexShrink: 0 
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="sp-btn-cancel"
            style={{
              padding: '0 24px',
              height: '40px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '0 28px',
              height: '40px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ffffff',
              background: 'var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)))',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-check2 text-base" /> Simpan Pengaturan
          </button>
        </div>

        <style jsx global>{`
          .sp-modal {
            background-color: #ffffff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
          .dark .sp-modal {
            background-color: #000000 !important;
            border: 1px solid rgba(37, 99, 235, 0.4) !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8) !important;
          }

          .sp-modal-body {
            background-color: #ffffff;
            color: #0f172a;
          }
          .dark .sp-modal-body {
            background-color: #000000 !important;
            color: #f8fafc !important;
          }

          .sp-modal-footer {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
          }
          .dark .sp-modal-footer {
            background-color: #000000 !important;
            border-top: 1px solid rgba(59, 130, 246, 0.35) !important;
          }

          .sp-btn-cancel {
            background-color: #ffffff;
            color: #334155;
            border: 1px solid #cbd5e1;
          }
          .dark .sp-btn-cancel {
            background-color: #000000 !important;
            color: #f8fafc !important;
            border: 1px solid rgba(59, 130, 246, 0.4) !important;
          }
          .dark .sp-btn-cancel:hover {
            background-color: #111827 !important;
            border-color: #3b82f6 !important;
          }

          .sp-input,
          .sp-modal-body input:not([type="checkbox"]):not([type="radio"]),
          .sp-modal-body select,
          .sp-modal-body textarea {
            background-color: #ffffff;
            color: #0f172a;
            border: 1px solid #cbd5e1;
          }
          .dark .sp-input,
          .dark .sp-modal-body input:not([type="checkbox"]):not([type="radio"]),
          .dark .sp-modal-body select,
          .dark .sp-modal-body textarea {
            background-color: #000000 !important;
            color: #f8fafc !important;
            border: 1px solid rgba(59, 130, 246, 0.4) !important;
          }
          .dark .sp-input::placeholder,
          .dark .sp-modal-body input::placeholder,
          .dark .sp-modal-body textarea::placeholder {
            color: #64748b !important;
          }

          .sp-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .dark .sp-card {
            background-color: #000000 !important;
            color: #f8fafc !important;
            border: 1px solid rgba(59, 130, 246, 0.35) !important;
          }

          .sp-card-active {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
          }
          .dark .sp-card-active {
            background-color: #000000 !important;
            color: #60a5fa !important;
            border: 1px solid rgba(37, 99, 235, 0.4) !important;
          }

          .sp-card-head {
            background-color: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }
          .dark .sp-card-head {
            background-color: #000000 !important;
            border-bottom: 1px solid rgba(59, 130, 246, 0.35) !important;
          }

          .sp-btn-sub {
            background-color: #eff6ff;
            color: #3083FF;
            border: 1px solid #bfdbfe;
          }
          .dark .sp-btn-sub {
            background-color: #000000 !important;
            color: #60a5fa !important;
            border: 1px solid rgba(59, 130, 246, 0.5) !important;
          }
          .dark .sp-btn-sub:hover {
            background-color: #090d16 !important;
            border-color: #3b82f6 !important;
          }

          .sp-btn-danger-sub {
            background-color: #fef2f2;
            color: #ef4444;
            border: 1px dashed #ef4444;
          }
          .dark .sp-btn-danger-sub {
            background-color: #000000 !important;
            color: #f87171 !important;
            border: 1px dashed rgba(239, 68, 68, 0.5) !important;
          }
          .dark .sp-btn-danger-sub:hover {
            background-color: #1c0a0e !important;
            border-color: #ef4444 !important;
          }

          .dark .sp-divider {
            border-top-color: rgba(59, 130, 246, 0.35) !important;
          }
          .dark .sp-divider h4 {
            color: #60a5fa !important;
          }

          .dark .sp-label {
            color: #f8fafc !important;
          }

          .dark .sp-hint {
            color: #94a3b8 !important;
          }

          .sp-layout-btn {
            background-color: #ffffff;
            color: #475569;
            border: 1px solid #cbd5e1;
          }
          .dark .sp-layout-btn {
            background-color: #000000 !important;
            color: #cbd5e1 !important;
            border: 1px solid rgba(59, 130, 246, 0.4) !important;
          }

          .sp-layout-btn-active {
            background-color: #eff6ff;
            color: #3083FF;
            border: 2px solid #3083FF;
          }
          .dark .sp-layout-btn-active {
            background-color: #000000 !important;
            color: #60a5fa !important;
            border: 2px solid #2563eb !important;
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
}
