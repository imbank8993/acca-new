'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FormField, FieldType } from '../../types';
import { CanvasField } from './CanvasField';

/** Selaras dengan STRUCTURAL_TYPES di CanvasField — elemen ini tidak ikut dinomori */
const UNNUMBERED_TYPES: FieldType[] = ['heading', 'paragraph', 'divider', 'page_break'];

/**
 * Nomor urut pertanyaan per posisi field. Elemen struktur dilewati supaya
 * penomoran mengikuti apa yang dilihat responden, bukan indeks array.
 */
function buildOrderMap(fields: FormField[]): (number | null)[] {
  let n = 0;
  return fields.map((f) => (UNNUMBERED_TYPES.includes(f.type) ? null : ++n));
}

interface FormCanvasProps {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  draggingType: FieldType | null;
  onAddClick?: () => void;
}

export function FormCanvas({
  fields,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  draggingType,
  onAddClick,
}: FormCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-droppable-area',
  });

  const orderMap = React.useMemo(() => buildOrderMap(fields), [fields]);

  return (
    <div ref={setNodeRef} className="flex-1 min-w-0">
      {fields.length === 0 ? (
        // Empty state with clean padding & 4px thin rounded corners
        <div
          style={{ borderRadius: '6px' }}
          className={`
            min-h-[480px] border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all p-12
            ${isOver || draggingType
              ? 'border-[#3083FF] dark:border-blue-400 bg-blue-50/60 dark:bg-blue-900/30 scale-[1.002] shadow-xs'
              : 'border-slate-200 dark:border-blue-600/80 bg-white dark:bg-black hover:border-slate-300 dark:hover:border-blue-400'
            }
          `}
        >
          <div 
            style={{ borderRadius: '6px' }}
            className={`w-14 h-14 flex items-center justify-center transition-colors ${
              isOver || draggingType ? 'bg-[#3083FF] dark:bg-blue-600 text-white' : 'bg-blue-50 dark:bg-black dark:border dark:border-blue-600/80 text-[#3083FF] dark:text-blue-400'
            }`}
          >
            <i className={`bi ${isOver ? 'bi-box-arrow-in-down' : 'bi-plus-square'} text-2xl`} />
          </div>
          <div className="text-center max-w-sm">
            <p className={`text-base font-bold ${isOver ? 'text-[#3083FF] dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {isOver ? 'Lepaskan Komponen di Sini' : 'Kanvas Masih Kosong'}
            </p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {isOver
                ? 'Komponen baru akan langsung ditambahkan ke kanvas'
                : 'Tekan tombol + di bawah atau pilih komponen dari panel kiri.'
              }
            </p>
          </div>
          {/* Mobile: Add button in empty state */}
          {onAddClick && (
            <button
              type="button"
              onClick={onAddClick}
              className="mobile-add-btn-empty"
              style={{
                marginTop: '8px',
                borderRadius: '8px',
                height: '42px',
                padding: '0 24px',
                background: 'var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)))',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0, 56, 168, 0.25)',
              }}
            >
              <i className="bi bi-plus-lg" style={{ fontSize: '14px' }} />
              <span>Tambah Komponen</span>
            </button>
          )}
        </div>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div
            style={{ boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)', borderRadius: '6px' }}
            className={`
              canvas-shell min-h-[480px] transition-all border-2 shadow-xs
              ${isOver || draggingType
                ? 'border-[#3083FF]/60 dark:border-blue-400/60 bg-blue-50/50 dark:bg-blue-900/20 border-dashed ring-2 ring-[#3083FF]/10 dark:ring-blue-400/10'
                : 'border-slate-200/80 dark:border-blue-600/80 bg-slate-50/80 dark:bg-black'
              }
            `}
          >
            <div className="flex flex-wrap gap-5">
              {fields.map((field, index) => (
                <CanvasField
                  key={field.id}
                  field={field}
                  isSelected={selectedId === field.id}
                  isFirst={index === 0}
                  isLast={index === fields.length - 1}
                  order={orderMap[index]}
                  onSelect={() => onSelect(field.id)}
                  onDelete={() => onDelete(field.id)}
                  onDuplicate={() => onDuplicate(field.id)}
                  onMoveUp={() => onMoveUp(index)}
                  onMoveDown={() => onMoveDown(index)}
                />
              ))}

              {(isOver || draggingType) && (
                <div 
                  style={{ borderRadius: '4px' }}
                  className="w-full h-14 border-2 border-dashed border-[#3083FF]/60 dark:border-blue-400/60 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#3083FF] dark:text-blue-400 text-xs font-semibold"
                >
                  <i className="bi bi-plus-circle-fill mr-2 text-sm" /> Tambahkan komponen di sini
                </div>
              )}

              {/* Mobile: Inline Add Button below last field */}
              {onAddClick && fields.length > 0 && (
                <button
                  type="button"
                  onClick={onAddClick}
                  className="mobile-add-btn-full w-full bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-[#3083FF] dark:text-blue-400"
                  style={{
                    borderRadius: '8px',
                    height: '48px',
                    borderWidth: '2px',
                    borderStyle: 'dashed',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  <i className="bi bi-plus-circle" style={{ fontSize: '16px' }} />
                  <span>Tambah Komponen</span>
                </button>
              )}
            </div>
          </div>
        </SortableContext>
      )}
      <style jsx>{`
        /* Padding kanvas ditulis di sini, bukan lewat utility Tailwind: globals.css
           punya reset '* { padding: 0 }' tanpa @layer yang selalu mengalahkan
           @layer utilities, sehingga p-[16px]/sm:p-[32px] tidak pernah berlaku. */
        .canvas-shell { padding: 14px; }
        @media (min-width: 640px) {
          .canvas-shell { padding: 28px; }
        }

        .mobile-add-btn-empty { display: none; }
        .mobile-add-btn-full { display: none; }
        @media (max-width: 639px) {
          .mobile-add-btn-empty { display: inline-flex !important; }
          .mobile-add-btn-full { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
