'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FieldType } from '../../types';
import { getFieldDef } from '../../field-registry';

/**
 * Tingkat 1 — elemen struktur. Tidak menampung jawaban, jadi tidak dapat nomor
 * urut dan tidak dibungkus kartu: dirender sebagai pita pemisah supaya daftar
 * field yang panjang punya ritme dan bagian-bagiannya terbaca.
 */
const STRUCTURAL_TYPES: FieldType[] = ['heading', 'paragraph', 'divider', 'page_break'];

interface CanvasFieldProps {
  field: FormField;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** Nomor urut pertanyaan; null untuk elemen struktur */
  order: number | null;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case 'heading':
      // Garis bawah tipis membuat judul terbaca sebagai awal bagian baru,
      // bukan sekadar field yang kebetulan hurufnya besar.
      return (
        <div className="border-slate-200 dark:border-slate-700" style={{ padding: '6px 2px 8px', borderBottomWidth: '1px', borderBottomStyle: 'solid' }}>
          {field.headingLevel === 'h1' && <h1 className="text-slate-900 dark:text-slate-100" style={{ fontSize: '20px', fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{field.label}</h1>}
          {field.headingLevel === 'h3' && <h3 className="text-slate-800 dark:text-slate-200" style={{ fontSize: '14px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{field.label}</h3>}
          {(!field.headingLevel || field.headingLevel === 'h2') && <h2 className="text-slate-800 dark:text-slate-200" style={{ fontSize: '16px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{field.label}</h2>}
        </div>
      );

    case 'paragraph':
      return (
        <div style={{ padding: '4px 0' }}>
          <p 
            className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-black border-slate-200 dark:border-blue-500/40"
            style={{ 
              fontSize: '13px', 
              lineHeight: 1.6, 
              padding: '14px 18px', 
              borderWidth: '1px',
              borderStyle: 'solid', 
              borderRadius: '4px',
              fontStyle: 'italic',
              margin: 0
            }}
          >
            {field.content || field.description || 'Teks penjelasan instruksi...'}
          </p>
        </div>
      );

    case 'divider':
      return (
        <div style={{ padding: '8px 0' }}>
          <div style={{ borderTop: '2px dashed #cbd5e1', margin: '6px 0' }} />
        </div>
      );

    case 'page_break':
      return (
        <div style={{ padding: '10px 0' }}>
          <div 
            style={{ 
              borderRadius: '6px', 
              padding: '14px 18px', 
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
              border: '2px dashed #60a5fa', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ borderRadius: '50%', width: '32px', height: '32px', backgroundColor: '#3083FF', color: '#ffffff' }} className="flex items-center justify-center font-bold text-sm">
                <i className="bi bi-signpost-split text-sm" />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>PEMISAH HALAMAN (PAGE BREAK)</span>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', margin: 0 }}>{field.pageTitle || field.label || 'Bagian Baru'}</h4>
              </div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>
              Langkah Selanjutnya →
            </span>
          </div>
        </div>
      );

    case 'textarea':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div 
            className="text-slate-500 dark:text-slate-300 border-slate-300 dark:border-blue-500/40 bg-white dark:bg-black"
            style={{ 
              borderRadius: '4px', 
              minHeight: '90px', 
              padding: '12px 16px', 
              fontSize: '13px', 
              borderWidth: '1px',
              borderStyle: 'solid', 
              lineHeight: 1.5,
              fontWeight: 500,
              boxSizing: 'border-box'
            }}
          >
            {field.placeholder || 'Masukkan penjelasan lengkap...'}
          </div>
        </div>
      );

    case 'select':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div 
            className="text-slate-500 dark:text-slate-300 border-slate-300 dark:border-blue-500/40 bg-white dark:bg-black"
            style={{ 
              borderRadius: '4px', 
              height: '42px', 
              padding: '0 16px', 
              fontSize: '13px', 
              borderWidth: '1px',
              borderStyle: 'solid', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 500,
              boxSizing: 'border-box'
            }}
          >
            <span>Pilih {field.label}...</span>
            <i className="bi bi-chevron-down text-xs text-slate-400" />
          </div>
        </div>
      );

    case 'radio':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px', paddingLeft: '4px' }}>
            {(field.options || []).slice(0, 3).map((opt) => (
              <div key={opt.value} className="text-slate-700 dark:text-slate-300" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <div className="border-slate-300 dark:border-slate-600" style={{ width: '16px', height: '16px', borderRadius: '50%', borderWidth: '2px', borderStyle: 'solid', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{opt.label}</span>
              </div>
            ))}
            {(field.options?.length ?? 0) > 3 && (
              <div style={{ fontSize: '11px', color: '#94a3b8', paddingLeft: '26px', fontWeight: 600 }}>
                +{(field.options?.length ?? 0) - 3} pilihan lainnya
              </div>
            )}
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px', paddingLeft: '4px' }}>
            {(field.options || []).slice(0, 3).map((opt) => (
              <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '3px', border: '2px solid #cbd5e1', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{opt.label}</span>
              </div>
            ))}
            {(field.options?.length ?? 0) > 3 && (
              <div style={{ fontSize: '11px', color: '#94a3b8', paddingLeft: '26px', fontWeight: 600 }}>
                +{(field.options?.length ?? 0) - 3} opsi lainnya
              </div>
            )}
          </div>
        </div>
      );

    case 'rating':
      const stars = Array.from({ length: field.maxRating || 5 });
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#fbbf24', fontSize: '20px', padding: '6px 2px', flexWrap: 'wrap' }}>
            {stars.map((_, i) => (
              <i key={i} className="bi bi-star-fill opacity-40 hover:opacity-100 transition-opacity cursor-pointer" />
            ))}
          </div>
        </div>
      );

    case 'slider':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 2px' }}>
            <input
              type="range"
              disabled
              min={Number(field.min ?? 1)}
              max={Number(field.max ?? 10)}
              step={Number(field.step ?? 1)}
              className="w-full accent-[#3083FF] cursor-not-allowed"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
              <span>Min: {field.min ?? 1}</span>
              <span>Maks: {field.max ?? 10}</span>
            </div>
          </div>
        </div>
      );

    case 'file':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div 
            style={{ 
              borderRadius: '4px', 
              border: '2px dashed #cbd5e1', 
              backgroundColor: '#f8fafc', 
              padding: '20px', 
              textAlign: 'center' 
            }}
          >
            <i className="bi bi-cloud-upload text-slate-400 text-2xl block mb-1.5" />
            <p style={{ fontSize: '13px', color: '#475569', fontWeight: 600, margin: 0 }}>
              {field.accept || 'Semua format dokumen'} · Maks {field.maxSize || 5}MB
            </p>
          </div>
        </div>
      );

    default:
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {field.description && (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px 0', paddingLeft: '2px', fontWeight: 500 }}>
              {field.description}
            </p>
          )}
          <div 
            className="text-slate-500 dark:text-slate-300 border-slate-300 dark:border-blue-600/80 bg-white dark:bg-black"
            style={{ 
              borderRadius: '4px', 
              height: '42px', 
              padding: '0 16px', 
              fontSize: '13px', 
              borderWidth: '1px',
              borderStyle: 'solid', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 500,
              boxSizing: 'border-box'
            }}
          >
            <span>{field.placeholder || 'Input ' + field.label.toLowerCase() + '...'}</span>
            {field.type === 'date' && <i className="bi bi-calendar3 text-xs text-slate-400" />}
            {field.type === 'time' && <i className="bi bi-clock text-xs text-slate-400" />}
            {field.type === 'datetime' && <i className="bi bi-calendar-event text-xs text-slate-400" />}
            {field.type === 'url' && <i className="bi bi-link-45deg text-xs text-slate-400" />}
          </div>
        </div>
      );
  }
}

/** Tombol ikon tersier — seragam untuk semua kontrol kartu */
function ToolButton({
  icon,
  title,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        borderRadius: '4px',
        height: '26px',
        width: '26px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        border: 'none',
        fontSize: '12px',
        color: danger ? '#e11d48' : '#64748b',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.25 : 1,
      }}
      className={disabled ? '' : danger ? 'hover:bg-rose-50' : 'hover:bg-slate-100 hover:text-slate-900'}
    >
      <i className={`bi ${icon}`} />
    </button>
  );
}

export function CanvasField({
  field,
  isSelected,
  isFirst,
  isLast,
  order,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: CanvasFieldProps) {
  const def = getFieldDef(field.type);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, data: { source: 'canvas' } });

  const isStructural = STRUCTURAL_TYPES.includes(field.type);

  // Elemen struktur selalu selebar kanvas — fungsinya memisahkan bagian,
  // jadi tidak masuk akal disandingkan setengah/sepertiga baris.
  const widthClass = isStructural
    ? 'canvas-field-full'
    : field.width === 'half' ? 'canvas-field-half'
    : field.width === 'third' ? 'canvas-field-third'
    : 'canvas-field-full';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const hasConditions = (field.conditions?.length ?? 0) > 0;

  // Tingkat 3 — kontrol. Tersembunyi sampai kartu di-hover atau terpilih supaya
  // kanvas dengan puluhan field tidak didominasi tombol. Di layar sentuh (<640px)
  // tidak ada hover, jadi di sana kontrol tetap tampil.
  const toolsClass = `flex items-center transition-opacity duration-150 ${
    isSelected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
  }`;

  const tools = (
    <div
      className={`${toolsClass} bg-white dark:bg-black border-slate-200 dark:border-blue-600/80 shadow-sm`}
      style={{
        position: 'absolute',
        top: isStructural ? '4px' : '12px',
        right: '10px',
        zIndex: 5,
        gap: '2px',
        padding: '2px',
        borderRadius: '6px',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <ToolButton icon="bi-arrow-up" title="Geser ke atas" onClick={onMoveUp} disabled={isFirst} />
      <ToolButton icon="bi-arrow-down" title="Geser ke bawah" onClick={onMoveDown} disabled={isLast} />
      <span style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />
      <ToolButton icon="bi-copy" title="Duplikat komponen" onClick={onDuplicate} />
      <ToolButton icon="bi-trash" title="Hapus komponen" onClick={onDelete} danger />
    </div>
  );

  /** Pegangan seret — satu-satunya sisa kontrol yang menempel di badan kartu */
  const grip = (
    <button
      type="button"
      {...listeners}
      {...attributes}
      title="Seret untuk memindahkan posisi"
      onClick={(e) => e.stopPropagation()}
      style={{
        borderRadius: '4px',
        width: '22px',
        height: '22px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        backgroundColor: 'transparent',
        color: '#cbd5e1',
        cursor: 'grab',
        touchAction: 'none',
      }}
      className="hover:text-[#3083FF] hover:bg-blue-50"
    >
      <i className="bi bi-grip-vertical text-sm" />
    </button>
  );

  // ── Tingkat 1: elemen struktur sebagai pita, bukan kartu ──
  if (isStructural) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative pb-2 min-w-0 ${widthClass}`}
        onClick={onSelect}
      >
        <div
          style={{
            borderRadius: '6px',
            border: isSelected ? '1px solid #3083FF' : '1px solid transparent',
            backgroundColor: isSelected ? 'rgba(0, 56, 168, 0.04)' : 'transparent',
            transition: 'all 0.2s',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            // padding sengaja TIDAK di sini: diatur .cf-band agar bisa responsif.
            // Style inline mengalahkan stylesheet, jadi menaruhnya di sini akan
            // mematikan aturan itu beserta media query-nya.
          }}
          className="cf-band hover:bg-slate-100/70"
        >
          <div style={{ flexShrink: 0, paddingTop: '6px' }}>{grip}</div>
          <div style={{ flex: 1, minWidth: 0 }} className="cf-reserve">
            <FieldPreview field={field} />
          </div>
        </div>
        {tools}
        <style jsx>{`
          /* Padding ditulis di sini, bukan lewat utility Tailwind: globals.css punya
             reset '* { padding: 0 }' tanpa @layer, yang selalu mengalahkan utility
             Tailwind (@layer utilities) sehingga p-[...] tidak pernah berlaku. */
          .cf-band { padding: 8px 12px 8px 6px; }
          .cf-reserve { padding-right: 0; }
          @media (min-width: 640px) {
            .cf-band { padding: 10px 14px 10px 8px; }
            .cf-reserve { padding-right: 128px; }
          }

          .canvas-field-half { width: calc(50% - 10px); flex: 0 0 calc(50% - 10px); }
          .canvas-field-third { width: calc(33.333% - 13.33px); flex: 0 0 calc(33.333% - 13.33px); }
          .canvas-field-full { width: 100%; flex: 0 0 100%; }

          @media (max-width: 639px) {
            .canvas-field-half, .canvas-field-third, .canvas-field-full {
              width: 100% !important;
              flex: 0 0 100% !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative pb-2 min-w-0 ${widthClass}`}
      onClick={onSelect}
    >
      <div
        style={{
          borderRadius: '6px',
          // Aksen kiri & cincin seleksi lewat box-shadow, bukan lebar border:
          // menebalkan border saat terpilih menggeser layout kartu 1–3px.
          borderWidth: '1.5px',
          borderStyle: 'solid',
          boxShadow: isSelected
            ? 'inset 3px 0 0 0 #3083FF, 0 4px 16px rgba(0, 56, 168, 0.14)'
            : '0 1px 2px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
        className={`cf-card hover:shadow-md bg-white dark:bg-black ${
          isSelected 
            ? 'border-[#3083FF] dark:border-blue-500' 
            : 'border-slate-200 dark:border-blue-600/80 hover:border-slate-300 dark:hover:border-blue-400'
        }`}
      >
        <div className="cf-row" style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Gutter: nomor urut + pegangan seret */}
          <div style={{ width: '24px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span
              className={isSelected ? 'bg-[#3083FF] text-white' : 'bg-blue-50 dark:bg-black dark:border dark:border-blue-600/80 text-[#3083FF] dark:text-blue-400'}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                fontSize: '11px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              {order}
            </span>
            {grip}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tingkat 2 — label pertanyaan sebagai konten utama kartu. Ruang untuk
                kontrol hover dipesan lewat spacer mengambang, bukan padding-right:
                padding menyempitkan SEMUA baris, sehingga soal panjang membuang
                ruang kanan sepanjang paragrafnya. */}
            <div
              style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.45, wordBreak: 'break-word', marginBottom: '10px' }}
              className="break-words text-slate-900 dark:text-slate-100"
            >
              <span className="cf-tools-space" aria-hidden="true" />
              {field.label}
              {field.required && <span className="text-rose-500 dark:text-rose-400" style={{ marginLeft: '4px', fontWeight: 800 }}>*</span>}
            </div>

            <FieldPreview field={field} />

            {/* Tingkat 3 — meta tersier: tipe field & penanda logika bercabang */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                <i className={`bi ${def.icon} text-[11px]`} />
                {def.label}
              </span>
              {hasConditions && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                  <i className="bi bi-diagram-3-fill text-[11px]" />
                  Bercabang
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {tools}
      <style jsx>{`
        /* Padding ditulis di sini, bukan lewat utility Tailwind: globals.css punya
           reset '* { padding: 0 }' tanpa @layer, yang selalu mengalahkan utility
           Tailwind (@layer utilities) sehingga p-[...] tidak pernah berlaku. */
        .cf-card { padding: 16px; }
        .cf-row { gap: 10px; }
        /* Spacer mengambang setinggi tombol kontrol saja: baris label yang
           bertabrakan dengan tombol menghindar, baris berikutnya memakai
           lebar penuh kartu. */
        .cf-tools-space { display: none; }
        @media (min-width: 640px) {
          .cf-card { padding: 20px 24px; }
          .cf-row { gap: 14px; }
          .cf-tools-space {
            display: block;
            float: right;
            width: 128px;
            height: 26px;
          }
        }

        .canvas-field-half { width: calc(50% - 10px); flex: 0 0 calc(50% - 10px); }
        .canvas-field-third { width: calc(33.333% - 13.33px); flex: 0 0 calc(33.333% - 13.33px); }
        .canvas-field-full { width: 100%; flex: 0 0 100%; }

        .canvas-field-third .cf-card {
          padding: 14px 14px !important;
        }
        .canvas-field-third .cf-row {
          gap: 8px !important;
        }
        .canvas-field-third .cf-tools-space {
          display: none !important;
        }

        .canvas-field-half .cf-card {
          padding: 16px 18px !important;
        }
        .canvas-field-half .cf-tools-space {
          width: 70px !important;
        }

        @media (max-width: 639px) {
          .canvas-field-half, .canvas-field-third, .canvas-field-full {
            width: 100% !important;
            flex: 0 0 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
