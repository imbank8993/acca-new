'use client';

import React from 'react';
import { FIELD_GROUPS, getFieldDef } from '../../field-registry';
import { FieldType } from '../../types';

interface PaletteItemProps {
  type: FieldType;
  onAddField: (type: FieldType) => void;
}

function PaletteItem({ type, onAddField }: PaletteItemProps) {
  const def = getFieldDef(type);

  return (
    <div
      onClick={() => onAddField(type)}
      style={{
        borderRadius: '4px',
        height: '40px',
        padding: '0 12px',
        borderWidth: '1px',
        borderStyle: 'solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s',
        boxSizing: 'border-box',
      }}
      className="group border-slate-300 dark:border-blue-600/70 bg-white dark:bg-black hover:border-[#3083FF] dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/40 hover:shadow-2xs active:scale-[0.97]"
      title={`Klik untuk menambahkan ${def.label}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'colors 0.2s',
          }}
          className="bg-slate-100 dark:bg-black dark:border dark:border-blue-600/70 text-[#3083FF] dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/80 group-hover:text-[#3083FF] dark:group-hover:text-blue-300"
        >
          <i className={`bi ${def.icon}`} style={{ fontSize: '13px' }} />
        </div>
        <span 
          style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            lineHeight: '1.3'
          }} 
          className="text-slate-700 dark:text-slate-200 group-hover:text-[#3083FF] dark:group-hover:text-blue-400 truncate"
        >
          {def.label}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddField(type);
        }}
        style={{
          borderRadius: '4px',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="opacity-0 group-hover:opacity-100 text-[#3083FF] dark:text-blue-400 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition-all"
        title="Tambah ke kanvas"
      >
        <i className="bi bi-plus-lg text-xs" />
      </button>
    </div>
  );
}

export function FieldPalette({ onAddField }: { onAddField: (type: FieldType) => void }) {
  return (
    // sm:h-full — kolomnya ikut setinggi kanvas supaya kartu sticky di dalamnya
    // punya jarak tempuh. Di bawah 640px palette dirender di bottom sheet, jadi
    // aturan tinggi/sticky sengaja dibatasi ke breakpoint desktop saja.
    <div className="w-full lg:w-[260px] shrink-0 sm:h-full">
      <div
        style={{
          borderRadius: '6px',
          borderWidth: '1.5px',
          borderStyle: 'solid',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
        className="bg-white dark:bg-black border-slate-300 dark:border-blue-600/80 sm:sticky sm:top-4 sm:flex sm:flex-col sm:max-h-[calc(100dvh-110px)]"
      >
        {/* Header Biru-Magenta Eksak */}
        <div
          style={{
            background: 'var(--banner-bg, var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%)))',
            padding: '16px 18px',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-grid-3x3-gap text-white/90" style={{ fontSize: '14px' }} />
            Komponen Form
          </h3>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', margin: '3px 0 0 0', fontWeight: 500 }}>
            Klik untuk menambahkan ke kanvas
          </p>
        </div>

        {/* Groups dengan Hirarki Visual yang Presisi & Seimbang */}
        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="overflow-y-auto sm:flex-1 sm:min-h-0">
          {FIELD_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Level 1 Group Divider */}
              <div className="border-slate-200 dark:border-slate-700/60" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingBottom: '4px', borderBottomWidth: '1px', borderBottomStyle: 'dashed' }}>
                <div className="bg-[#3083FF] dark:bg-blue-500" style={{ width: '6px', height: '6px', borderRadius: '50%' }} />
                <span className="text-[#3083FF] dark:text-blue-400" style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {group.label}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:flex lg:flex-col lg:gap-1.5">
                {group.types.map((type) => (
                  <PaletteItem key={type} type={type} onAddField={onAddField} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
