'use client';

import React, { useState, useCallback, Suspense } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { FormField, FormSchema, FieldType, FieldCondition } from '../types';
import { getFieldDef } from '../field-registry';
import { Button } from '@/components/ui/Button';
import { FieldPalette } from './components/FieldPalette';
import { FormCanvas } from './components/FormCanvas';
import { SettingsPanel } from './components/SettingsPanel';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Check if a field should be visible based on conditional logic */
function checkFieldVisibility(field: FormField, formData: Record<string, any>): boolean {
  if (!field.conditions || field.conditions.length === 0) return true;

  const evaluate = (cond: FieldCondition) => {
    const val = formData[cond.targetFieldId];

    switch (cond.operator) {
      case 'equals':
        if (Array.isArray(val)) return val.includes(cond.value);
        return String(val ?? '') === String(cond.value ?? '');
      case 'not_equals':
        if (Array.isArray(val)) return !val.includes(cond.value);
        return String(val ?? '') !== String(cond.value ?? '');
      case 'contains':
        return String(val ?? '').toLowerCase().includes(String(cond.value ?? '').toLowerCase());
      case 'is_not_empty':
        if (Array.isArray(val)) return val.length > 0;
        return val !== undefined && val !== null && String(val).trim() !== '';
      case 'is_empty':
        if (Array.isArray(val)) return val.length === 0;
        return val === undefined || val === null || String(val).trim() === '';
      default:
        return true;
    }
  };

  const isSatisfied = field.conditionLogic === 'or'
    ? field.conditions.some(evaluate)
    : field.conditions.every(evaluate);

  return field.conditionAction === 'hide' ? !isSatisfied : isSatisfied;
}

/** Opsi yang tampil setelah membuang pilihan yang sudah dipakai di field lain */
function resolveVisibleOptions(field: FormField, formData: Record<string, any>) {
  const options = field.options || [];
  const sources = field.excludeChosenFrom || [];
  if (options.length === 0 || sources.length === 0) return options;

  const taken = new Set(
    sources.flatMap((sourceId) => {
      const raw = formData[sourceId];
      if (raw === undefined || raw === null || raw === '') return [];
      return (Array.isArray(raw) ? raw : [raw]).map((v) => String(v));
    })
  );
  if (taken.size === 0) return options;

  return options.filter((opt) => !taken.has(String(opt.value)));
}

import { useDashboardUser } from '@/components/UserContext';

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useDashboardUser();
  const canManage = user?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'OP_FORM'].includes(r.toUpperCase())) || false;
  const formId = searchParams.get('id');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(!!formId);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // Preview form state
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  // ── Load existing form ──
  React.useEffect(() => {
    if (!formId) return;
    fetch(`/api/forms/${formId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.form && !canManage && data.form.created_by !== user?.id) {
            Swal.fire('Ditolak', 'Anda tidak memiliki akses ke formulir ini.', 'error');
            router.push('/form');
            return;
        }
        setTitle(data.form.title ?? '');
        setIsPublic(Boolean(data.form.is_public));
        const schema: FormSchema = data.form.schema ?? { display: 'form', fields: [] };
        setDescription(schema.description ?? '');
        setFields(schema.fields ?? []);
      })
      .catch(() => {
        Swal.fire('Error', 'Form tidak ditemukan', 'error');
        router.push('/form');
      })
      .finally(() => setLoading(false));
  }, [formId]);

  // ── Add field (Click-to-Add or Drag-Drop) ──
  const handleAddField = useCallback((type: FieldType, afterId?: string) => {
    const def = getFieldDef(type);
    const newField: FormField = { ...def.defaultField, id: uid() };

    setFields((prev) => {
      if (!afterId) return [...prev, newField];
      const idx = prev.findIndex((f) => f.id === afterId);
      if (idx === -1) return [...prev, newField];
      const next = [...prev];
      next.splice(idx + 1, 0, newField);
      return next;
    });
  }, []);

  // ── Delete field ──
  const handleDelete = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  // ── Duplicate field ──
  const handleDuplicate = useCallback((id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const copy: FormField = { ...prev[idx], id: uid(), label: prev[idx].label + ' (Salinan)' };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  // ── Move field up ──
  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setFields((prev) => arrayMove(prev, index, index - 1));
  }, []);

  // ── Move field down ──
  const handleMoveDown = useCallback((index: number) => {
    setFields((prev) => {
      if (index >= prev.length - 1) return prev;
      return arrayMove(prev, index, index + 1);
    });
  }, []);

  // ── Update field from SettingsPanel ──
  const handleUpdateField = useCallback((updated: FormField) => {
    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }, []);

  // ── Drag & Drop (Canvas Reorder Only) ──

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over) return;

      const activeData = active.data.current;
      const overId = over.id as string;

      if (activeData?.source === 'canvas') {
        const oldIndex = fields.findIndex((f) => f.id === active.id);
        let newIndex = fields.findIndex((f) => f.id === overId);
        if (overId === 'canvas-droppable-area') {
          newIndex = fields.length - 1;
        }
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          setFields((prev) => arrayMove(prev, oldIndex, newIndex));
        }
      }
    },
    [fields]
  );

  const selectedField = fields.find((f) => f.id === selectedId) ?? null;

  // ── Save form ──
  const handleSave = async () => {
    if (!title.trim()) {
      Swal.fire('Peringatan', 'Judul form harus diisi', 'warning');
      return;
    }
    if (fields.length === 0) {
      Swal.fire('Peringatan', 'Tambahkan minimal satu komponen ke dalam form', 'warning');
      return;
    }

    setSaving(true);
    const schema: FormSchema = { display: 'form', description, fields };

    try {
      const url = formId ? `/api/forms/${formId}` : '/api/forms';
      const method = formId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, is_public: isPublic, schema }),
      });

      if (res.ok) {
        await Swal.fire({
          title: 'Berhasil!',
          text: 'Form berhasil disimpan',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
        router.push('/form');
      } else {
        const data = await res.json();
        Swal.fire('Gagal', data.error || 'Terjadi kesalahan saat menyimpan', 'error');
      }
    } catch {
      Swal.fire('Gagal', 'Terjadi kesalahan server', 'error');
    } finally {
      setSaving(false);
    }
  };



  // ── Preview Pane ──
  const PreviewPane = () => (
    <div className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-blue-600/80 py-12 px-4 sm:px-6 shadow-inner overflow-y-auto flex flex-col items-center justify-start" style={{ borderRadius: '6px', maxHeight: 'calc(100vh - 200px)', marginTop: '14px' }}>
      <div className="max-w-3xl mx-auto w-full" style={{ marginTop: '16px' }}>
        <div
            style={{
                borderRadius: '8px',
                padding: '32px 36px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                marginBottom: '16px',
            }}
            className="form-header-card relative overflow-hidden text-center"
        >
            <div className="relative z-10 flex flex-col items-center text-center">
                <h2 className="form-header-title" style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px 0' }}>
                    {title || 'Judul Form'}
                </h2>
                {description ? (
                    <p 
                        style={{ 
                            fontSize: '13px', 
                            marginTop: '6px',
                            fontWeight: 500,
                            lineHeight: '1.5',
                        }} 
                        className="form-header-desc max-w-xl text-center"
                    >
                        {description}
                    </p>
                ) : (
                    <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} className="form-header-desc">
                        <i className="bi bi-shield-check"></i>
                        Formulir resmi dikelola oleh ACCA App
                    </p>
                )}
            </div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        </div>

        <div 
            className="bg-white dark:bg-black border-slate-300 dark:border-blue-600/80"
            style={{ 
                borderRadius: '8px', 
                padding: '32px 36px', 
                borderWidth: '1.8px',
                borderStyle: 'solid',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)' 
            }}
        >
            {fields.length === 0 ? (
                <div className="text-slate-400 text-center py-16">
                    <i className="bi bi-inbox text-4xl block mb-2 opacity-50" />
                    <p className="text-xs">Belum ada komponen</p>
                </div>
            ) : (
                <div className="flex flex-wrap gap-6">
                    {fields.map((field) => {
                        const visible = checkFieldVisibility(field, previewData);
                        if (!visible) return null;

                        return (
                            <PreviewField
                                key={field.id}
                                field={field}
                                options={resolveVisibleOptions(field, previewData)}
                                value={previewData[field.id]}
                                onChange={(val) => setPreviewData((prev) => ({ ...prev, [field.id]: val }))}
                            />
                        );
                    })}
                </div>
            )}
            
            {fields.length > 0 && (
                <div className="border-slate-200 dark:border-slate-700 flex justify-end items-center" style={{ marginTop: '36px', paddingTop: '24px', borderTopWidth: '1px', borderTopStyle: 'dashed' }}>
                    <button
                        type="button"
                        onClick={() => Swal.fire('Preview Mode', 'Ini adalah simulasi pengisian form publik.', 'info')}
                        style={{
                            borderRadius: '4px',
                            height: '42px',
                            padding: '0 32px',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#ffffff',
                            backgroundColor: '#3083FF',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                        className="inline-flex items-center gap-2 hover:bg-[#002b80] transition-colors shadow-md"
                    >
                        <i className="bi bi-send-fill text-xs" />
                        <span>Simulasi Kirim</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full">
        <div className="form-page-header">
          <div className="flex items-center gap-3">
            <Link
              href="/form"
              style={{ borderRadius: '4px' }}
              className="w-8 h-8 bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors flex-shrink-0"
              title="Kembali ke Daftar Form"
            >
              <i className="bi bi-arrow-left text-base" />
            </Link>
            <div className="form-page-header-text">
              <h1>Form Builder</h1>
              <p>Rancang form dinamis dengan komponen drag & drop, validasi, dan pertanyaan bercabang.</p>
            </div>
          </div>
        </div>
        <div className="w-full">
          <div 
            style={{ borderRadius: '6px', padding: '48px 24px', borderWidth: '1.5px', borderStyle: 'solid' }} 
            className="text-center bg-white dark:bg-black border-slate-300 dark:border-blue-600/80 flex flex-col items-center justify-center min-h-[220px]"
          >
            <Spinner variant="buble" size={44} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5">
      {/* ── Banner Header ── */}
      <div style={{ padding: '0 4px', display: 'flex', alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => router.push('/form')} leftIcon={<i className="bi bi-arrow-left" />} title="Kembali ke Daftar Form" style={{ borderRadius: '12px' }}>
              Kembali
          </Button>
      </div>

      <div className="w-full space-y-3.5">
        {/* ══ DESKTOP Top Bar Card ══ */}
        <div className="desktop-only-flex bg-white dark:bg-black border border-slate-300 dark:border-blue-600/80 shadow-sm" style={{ borderRadius: '6px', padding: '18px 22px', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <label className="text-[#3083FF] dark:text-blue-400" style={{ display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                JUDUL FORM
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white dark:bg-black border-slate-300 dark:border-blue-600/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                style={{
                  borderRadius: '4px',
                  height: '42px',
                  padding: '0 16px',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  fontWeight: 700,
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                placeholder="Contoh: Formulir Pendaftaran Ekskul 2026"
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>

              {/* Field count badge */}
              <div className="bg-blue-50 dark:bg-black border-blue-200 dark:border-blue-600/80" style={{ borderRadius: '4px', height: '42px', padding: '0 16px', borderStyle: 'solid', borderWidth: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-layout-text-window text-[#3083FF] dark:text-blue-400" style={{ fontSize: '13px' }} />
                <span className="text-[#3083FF] dark:text-blue-400" style={{ fontSize: '12px', fontWeight: 800 }}>{fields.length} komponen</span>
              </div>

              <Button
                variant={previewMode ? "secondary" : "outline"}
                leftIcon={<i className={`bi ${previewMode ? 'bi-pencil' : 'bi-eye'}`} />}
                onClick={() => { setPreviewMode(!previewMode); setSelectedId(null); }}
              >
                {previewMode ? 'Edit' : 'Preview'}
              </Button>

              <Button
                variant="primary"
                icon="save"
                isLoading={saving}
                onClick={handleSave}
              >
                Simpan
              </Button>
            </div>
          </div>

          {/* Baris Ke-2: Deskripsi Form (Petunjuk Pengisian Publik) */}
          <div className="border-slate-200 dark:border-blue-500/50" style={{ paddingTop: '10px', borderTopWidth: '1px', borderTopStyle: 'dashed' }}>
            <label className="text-[#3083FF] dark:text-blue-400" style={{ display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              DESKRIPSI FORM (PETUNJUK PENGISIAN UNTUK RESPONDEN)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-50 dark:bg-black border-slate-300 dark:border-blue-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
              style={{
                borderRadius: '4px',
                height: '40px',
                padding: '0 16px',
                borderWidth: '1px',
                borderStyle: 'dashed',
                fontWeight: 500,
                fontSize: '12px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
              placeholder="Contoh: Mohon isi formulir ini dengan teliti dan jujur sesuai instruksi..."
            />
          </div>
        </div>

        {/* ══ MOBILE Top Bar Card ══ */}
        <div className="mobile-only-block bg-white dark:bg-black border-slate-200 dark:border-blue-600/80 shadow-sm" style={{ borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Row 1: Judul */}
            <div>
              <label className="text-[#3083FF] dark:text-blue-400" style={{ display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
                JUDUL FORM
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white dark:bg-black border-slate-300 dark:border-blue-600/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                style={{
                  borderRadius: '6px',
                  height: '42px',
                  padding: '0 14px',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  fontWeight: 700,
                  fontSize: '13px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                placeholder="Judul formulir..."
              />
            </div>

            {/* Row 2: Deskripsi */}
            <div>
              <label className="text-[#3083FF] dark:text-blue-400" style={{ display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
                DESKRIPSI
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-50 dark:bg-black border-slate-300 dark:border-blue-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
                style={{
                  borderRadius: '6px',
                  height: '40px',
                  padding: '0 14px',
                  borderWidth: '1px',
                  borderStyle: 'dashed',
                  fontWeight: 500,
                  fontSize: '12px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                placeholder="Petunjuk pengisian untuk responden..."
              />
            </div>

            {/* Row 3: 3-Column Action Buttons */}
            <div className="border-slate-100 dark:border-blue-500/30" style={{ paddingTop: '10px', borderTopWidth: '1px', borderTopStyle: 'solid', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {/* Komponen count */}
              <div className="bg-blue-50 dark:bg-black border-blue-200 dark:border-blue-500/40" style={{ 
                borderRadius: '6px', height: '40px', borderStyle: 'solid', borderWidth: '1px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' 
              }}>
                <i className="bi bi-layout-text-window text-[#3083FF] dark:text-blue-400" style={{ fontSize: '12px' }} />
                <span className="text-[#3083FF] dark:text-blue-400" style={{ fontSize: '11px', fontWeight: 800 }}>{fields.length}</span>
              </div>

              {/* Preview / Edit toggle */}
              <Button
                variant={previewMode ? "secondary" : "outline"}
                size="sm"
                leftIcon={<i className={`bi ${previewMode ? 'bi-pencil' : 'bi-eye'}`} />}
                onClick={() => { setPreviewMode(!previewMode); setSelectedId(null); }}
              >
                {previewMode ? 'Edit' : 'Preview'}
              </Button>

              {/* Simpan */}
              <Button
                variant="primary"
                size="sm"
                icon="save"
                isLoading={saving}
                onClick={handleSave}
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>

        {/* ── Main Builder Area ── */}
        {previewMode ? (
          <PreviewPane />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="flex desktop-flex-row gap-3.5 items-start w-full" style={{ marginTop: '14px' }}>
              {/* Left: Palette — always visible on desktop, toggle on mobile.
                  self-stretch penting: baris ini pakai items-start, jadi tanpa itu tinggi
                  kolom palette = tinggi kartunya sendiri dan `position: sticky` di dalamnya
                  tidak punya ruang gerak sama sekali (ikut hilang saat kanvas di-scroll). */}
              <div className="desktop-only-block self-stretch">
                <FieldPalette onAddField={(type) => handleAddField(type)} />
              </div>

              {/* Mobile Palette Overlay */}
              {showMobilePalette && (
                <div className="mobile-only-overlay fixed inset-0 z-[9999]" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(2px)' }}>
                  <div
                    className="mobile-palette-sheet"
                    style={{
                      position: 'fixed',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      maxHeight: '75vh',
                      backgroundColor: '#ffffff',
                      borderRadius: '16px 16px 0 0',
                      boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      animation: 'slideUpSheet 0.3s ease-out',
                    }}
                  >
                    {/* Sheet Handle + Header */}
                    <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
                      <div className="bg-slate-300 dark:bg-slate-600" style={{ width: '36px', height: '4px', borderRadius: '9999px', margin: '0 auto 12px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="bi bi-grid-3x3-gap text-[#3083FF] dark:text-blue-400" style={{ fontSize: '15px' }} />
                          <span className="text-slate-900 dark:text-slate-100" style={{ fontSize: '13px', fontWeight: 800 }}>Tambah Komponen</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMobilePalette(false)}
                          className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '16px',
                          }}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    </div>
                    {/* Palette Content */}
                    <div style={{ overflowY: 'auto', flex: 1, padding: '0 12px 16px' }}>
                      <FieldPalette onAddField={(type) => { handleAddField(type); setShowMobilePalette(false); }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Center: Canvas */}
              <FormCanvas
                fields={fields}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                draggingType={null}
                onAddClick={() => setShowMobilePalette(true)}
              />

              {/* Right: Settings Panel */}
              {selectedField && (
                <SettingsPanel
                  field={selectedField}
                  allFields={fields}
                  onUpdate={handleUpdateField}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>


          </DndContext>
        )}
      </div>

      {/* Styling Eksak Banner Halaman Informasi */}
      <style jsx>{`
        .form-page-header {
          position: relative;
          background: var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)));
          border-radius: 16px;
          padding: 22px 32px;
          color: white;
          margin: 0;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        @media (max-width: 639px) {
          .form-page-header {
            padding: 16px 20px;
            border-radius: 12px;
          }
        }
        .form-page-header-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-page-header-text h1 {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: white;
        }
        @media (max-width: 639px) {
          .form-page-header-text h1 {
            font-size: 1.05rem;
          }
        }
        .form-page-header-text p {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          line-height: 1.4;
        }
        @keyframes slideUpSheet {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .desktop-only-flex { display: flex; }
        .desktop-only-block { display: block; }
        .mobile-only-block { display: none; }
        .mobile-only-overlay { display: none; }
        .desktop-flex-row { flex-direction: row; }

        @media (max-width: 639px) {
          .desktop-only-flex { display: none !important; }
          .desktop-only-block { display: none !important; }
          .mobile-only-block { display: block !important; }
          .mobile-only-overlay { display: block !important; }
          .desktop-flex-row { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}

/** Single field renderer for Preview Mode */
function PreviewField({
    field,
    options,
    value,
    onChange,
}: {
    field: FormField;
    /** Opsi setelah disaring excludeChosenFrom; default ke field.options */
    options?: FormField['options'];
    value: any;
    onChange: (val: any) => void;
}) {
    const fieldOptions = options ?? field.options ?? [];
    const widthClass = 
        field.width === 'half' ? 'w-full sm:w-[calc(50%-12px)]' :
        field.width === 'third' ? 'w-full sm:w-[calc(33.333%-16px)]' :
        'w-full';

    if (field.type === 'heading') {
        return (
            <div className="w-full pt-4">
                {field.headingLevel === 'h1' && <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{field.label}</h1>}
                {field.headingLevel === 'h3' && <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 leading-snug">{field.label}</h3>}
                {(!field.headingLevel || field.headingLevel === 'h2') && <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-snug">{field.label}</h2>}
            </div>
        );
    }

    if (field.type === 'paragraph') {
        return (
            <div className="w-full">
                {field.label && <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">{field.label}</p>}
                <p style={{ borderRadius: '4px' }} className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-black p-4 border border-slate-200/80 dark:border-blue-500/40">
                    {field.content || field.description}
                </p>
            </div>
        );
    }

    if (field.type === 'divider') {
        return (
            <div className="w-full pt-4 pb-1">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{field.label}</h3>
                <div className="mt-2.5 border-b border-slate-200 dark:border-blue-500/30" />
            </div>
        );
    }

    // Input Base dengan Padding yang Sangat Lega (px-4 / 16px, height 42px) & Border Presisi
    const inputBase = "w-full px-4 border border-slate-300 dark:border-blue-500/40 focus:ring-2 focus:ring-[#3083FF]/20 dark:focus:ring-blue-400/20 focus:border-[#3083FF] dark:focus:border-blue-400 outline-none transition-all text-slate-800 dark:text-slate-100 text-xs sm:text-sm leading-relaxed bg-white dark:bg-black placeholder-slate-400 dark:placeholder-slate-500";

    return (
        <div className={widthClass}>
            {/* Label dengan Jarak mb-1.5 & Indent 2px */}
            <label className="text-slate-800 dark:text-slate-200" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '4px', paddingLeft: '2px', lineHeight: 1.3 }}>
                {field.label}
                {field.required && <span className="text-rose-600 dark:text-rose-400" style={{ marginLeft: '4px', fontWeight: 800 }}>*</span>}
            </label>
            {field.description && <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: '12px', marginBottom: '8px', paddingLeft: '2px', fontWeight: 500, lineHeight: 1.4 }}>{field.description}</p>}

            {field.type === 'textarea' && (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows || 4}
                    style={{
                        borderRadius: '4px',
                        minHeight: '100px',
                        padding: '12px 16px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                        lineHeight: 1.6,
                    }}
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#3083FF]/20 dark:focus:ring-blue-400/20 focus:border-[#3083FF] dark:focus:border-blue-400 transition-all placeholder-slate-400 dark:placeholder-slate-500"
                />
            )}

            {field.type === 'select' && (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        borderRadius: '4px',
                        height: '42px',
                        padding: '0 16px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#3083FF]/20 dark:focus:ring-blue-400/20 focus:border-[#3083FF] dark:focus:border-blue-400 transition-all"
                >
                    <option value="">-- Pilih {field.label} --</option>
                    {fieldOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            )}

            {field.type === 'radio' && (
                <div className="space-y-3 pt-1 pl-0.5">
                    {fieldOptions.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="radio"
                                name={field.id}
                                value={opt.value}
                                checked={value === opt.value}
                                onChange={(e) => onChange(e.target.value)}
                                className="w-4 h-4 text-[#3083FF] dark:text-blue-500 accent-[#3083FF] dark:accent-blue-500"
                            />
                            <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 leading-relaxed font-medium">{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}

            {field.type === 'checkbox' && (
                <div className="space-y-3 pt-1 pl-0.5">
                    {fieldOptions.map((opt) => {
                        const checked = Array.isArray(value) && value.includes(opt.value);
                        return (
                            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                        const current = Array.isArray(value) ? value : [];
                                        if (e.target.checked) onChange([...current, opt.value]);
                                        else onChange(current.filter((v) => v !== opt.value));
                                    }}
                                    className="w-4 h-4 text-[#3083FF] dark:text-blue-500 rounded accent-[#3083FF] dark:accent-blue-500"
                                />
                                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 leading-relaxed font-medium">{opt.label}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            {field.type === 'rating' && (
                <div className="flex items-center gap-3.5 py-1 pl-0.5">
                    {field.photoUrl && (
                        <img
                            src={field.photoUrl}
                            alt={field.label}
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #cbd5e1',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                                flexShrink: 0,
                            }}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    )}
                    <div className="flex items-center gap-2 text-2xl text-amber-400">
                        {Array.from({ length: field.maxRating || 5 }).map((_, i) => {
                            const val = i + 1;
                            const isFilled = (value || 0) >= val;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onChange(val)}
                                    className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                                >
                                    <i className={`bi ${isFilled ? 'bi-star-fill text-amber-400' : 'bi-star text-slate-300 dark:text-slate-600'}`} />
                                </button>
                            );
                        })}
                        {value && <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2">({value} / {field.maxRating || 5})</span>}
                    </div>
                </div>
            )}

            {field.type === 'slider' && (
                <div className="space-y-2 py-1 pl-0.5">
                    <input
                        type="range"
                        min={Number(field.min ?? 1)}
                        max={Number(field.max ?? 10)}
                        step={Number(field.step ?? 1)}
                        value={value ?? field.min ?? 1}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="w-full accent-[#3083FF] cursor-pointer"
                    />
                    <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>Min: {field.min ?? 1}</span>
                        <span className="text-[#3083FF] dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded">Nilai: {value ?? field.min ?? 1}</span>
                        <span>Maks: {field.max ?? 10}</span>
                    </div>
                </div>
            )}

            {field.type === 'file' && (
                <div>
                    <input
                        type="file"
                        accept={field.accept}
                        multiple={field.multiple}
                        onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                                onChange(Array.from(files).map(f => f.name));
                            }
                        }}
                        style={{
                            borderRadius: '4px',
                            height: '42px',
                            padding: '8px 20px',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            fontSize: '13px',
                            fontWeight: 500,
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                        className="bg-white dark:bg-black border-slate-300 dark:border-blue-500/40 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#3083FF]/20 dark:focus:ring-blue-400/20 focus:border-[#3083FF] dark:focus:border-blue-400 transition-all file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-black file:text-[#3083FF] dark:file:text-blue-400 hover:file:bg-blue-100"
                    />
                    <p className="text-slate-400 dark:text-slate-500" style={{ fontSize: '11px', marginTop: '6px', paddingLeft: '2px' }}>Maksimum {field.maxSize || 5} MB</p>
                </div>
            )}

            {['text', 'number', 'email', 'phone', 'url', 'date', 'time', 'datetime'].includes(field.type) && (
                <input
                    type={
                        field.type === 'phone' ? 'tel' :
                        field.type === 'datetime' ? 'datetime-local' :
                        field.type
                    }
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    min={field.min as any}
                    max={field.max as any}
                    style={{
                        borderRadius: '4px',
                        height: '42px',
                        padding: '0 16px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                    className="bg-white dark:bg-black border-slate-300 dark:border-blue-500/40 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#3083FF]/20 dark:focus:ring-blue-400/20 focus:border-[#3083FF] dark:focus:border-blue-400 transition-all placeholder-slate-400 dark:placeholder-slate-500"
                />
            )}
        </div>
    );
}

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner variant="buble" size={44} />
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
