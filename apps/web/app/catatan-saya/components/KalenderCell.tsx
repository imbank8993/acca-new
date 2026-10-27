'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { KalenderAgenda } from '../types';
import { X, Plus, Clock } from 'lucide-react';

export interface KalenderCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  agendas: KalenderAgenda[];
  onAgendaClick: (id: number) => void;
  onCreateAgenda: (date: string) => void; // YYYY-MM-DD
}

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Format local Date object to YYYY-MM-DD string safely without UTC offset shift
 */
function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function KalenderCell({
  date,
  isCurrentMonth,
  isToday,
  agendas = [],
  onAgendaClick,
  onCreateAgenda,
}: KalenderCellProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const dateStr = formatDateToYYYYMMDD(date);
  const hasAgendas = agendas.length > 0;
  const isMultipleAgendas = agendas.length > 1;

  // Day of week: 0=Senin ... 6=Minggu
  const dayOfWeek = (date.getDay() + 6) % 7;
  const isRightEdge = dayOfWeek >= 4; // Jumat, Sabtu, Minggu -> align right edge

  // Close popup when clicking outside or pressing Escape
  useEffect(() => {
    if (!showPopup) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        cellRef.current &&
        !cellRef.current.contains(e.target as Node)
      ) {
        setShowPopup(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPopup(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPopup]);

  // Adjust popup vertical position to avoid bottom viewport overflow
  useEffect(() => {
    if (showPopup && cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280 && rect.top > 280) {
        setOpenAbove(true);
      } else {
        setOpenAbove(false);
      }
    }
  }, [showPopup]);

  // Handle cell click
  const handleCellClick = useCallback(
    (e: React.MouseEvent) => {
      // If clicked inside popup, stop
      if (popupRef.current && popupRef.current.contains(e.target as Node)) {
        return;
      }

      if (!hasAgendas) {
        onCreateAgenda(dateStr);
      } else {
        setShowPopup((prev) => !prev);
      }
    },
    [hasAgendas, onCreateAgenda, dateStr]
  );

  // Handle keyboard interaction on cell
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!hasAgendas) {
          onCreateAgenda(dateStr);
        } else {
          setShowPopup((prev) => !prev);
        }
      }
    },
    [hasAgendas, onCreateAgenda, dateStr]
  );

  // Handle click on first agenda title pill
  const handleAgendaPillClick = useCallback(
    (e: React.MouseEvent, agendaId: number) => {
      e.stopPropagation();
      if (isMultipleAgendas) {
        setShowPopup(true);
      } else {
        onAgendaClick(agendaId);
      }
    },
    [isMultipleAgendas, onAgendaClick]
  );

  // Handle "+N lainnya" badge click
  const handleMoreBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPopup(true);
  }, []);

  // Popup formatted date header (e.g. "27 Oktober 2026")
  const formattedPopupDate = `${date.getDate()} ${NAMA_BULAN[date.getMonth()]} ${date.getFullYear()}`;

  // Build cell class list matching styles in catatan-saya.css
  const cellClasses = [
    'catatan-kalender__cell',
    isToday ? 'catatan-kalender__cell--today' : '',
    !isCurrentMonth ? 'catatan-kalender__cell--other-month' : '',
    hasAgendas ? 'catatan-kalender__cell--has-agenda' : '',
    'catatan-kalender__cell--clickable',
  ]
    .filter(Boolean)
    .join(' ');

  const firstAgenda = agendas[0];

  return (
    <div
      ref={cellRef}
      className={cellClasses}
      onClick={handleCellClick}
      onKeyDown={handleCellKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${formattedPopupDate}${hasAgendas ? `, ${agendas.length} agenda` : ', kosong'}`}
    >
      {/* Date header row with date number & colored dot indicators */}
      <div className="flex items-center justify-between w-full">
        <span className="catatan-kalender__date-number">{date.getDate()}</span>

        {hasAgendas && (
          <div
            className="flex items-center gap-1"
            title={`${agendas.length} agenda`}
          >
            {agendas.slice(0, Math.min(3, agendas.length)).map((ag) => (
              <span key={ag.id} className="catatan-kalender__agenda-dot" />
            ))}
          </div>
        )}
      </div>

      {/* Agenda content in cell */}
      {hasAgendas && (
        <div className="flex flex-col gap-1 w-full flex-1 overflow-hidden mt-1">
          {/* First agenda title (truncated) */}
          <div
            className="catatan-kalender__agenda-title cursor-pointer"
            title={`${firstAgenda.waktu_agenda ? firstAgenda.waktu_agenda.slice(0, 5) + ' - ' : ''}${firstAgenda.judul || 'Tanpa judul'}`}
            onClick={(e) => handleAgendaPillClick(e, firstAgenda.id)}
          >
            {firstAgenda.waktu_agenda ? `${firstAgenda.waktu_agenda.slice(0, 5)} ` : ''}
            {firstAgenda.judul || 'Tanpa judul'}
          </div>

          {/* If exactly 2 agendas: show second agenda title */}
          {agendas.length === 2 && (
            <div
              className="catatan-kalender__agenda-title cursor-pointer"
              title={`${agendas[1].waktu_agenda ? agendas[1].waktu_agenda.slice(0, 5) + ' - ' : ''}${agendas[1].judul || 'Tanpa judul'}`}
              onClick={(e) => handleAgendaPillClick(e, agendas[1].id)}
            >
              {agendas[1].waktu_agenda ? `${agendas[1].waktu_agenda.slice(0, 5)} ` : ''}
              {agendas[1].judul || 'Tanpa judul'}
            </div>
          )}

          {/* If more than 2 agendas: show "+N lainnya" badge */}
          {agendas.length > 2 && (
            <span
              className="catatan-kalender__agenda-count cursor-pointer"
              onClick={handleMoreBadgeClick}
              title="Lihat semua agenda"
            >
              +{agendas.length - 1} lainnya
            </span>
          )}
        </div>
      )}

      {/* Popup / Popover on cell click */}
      {showPopup && hasAgendas && (
        <div
          ref={popupRef}
          className="catatan-kalender__popup"
          style={{
            [openAbove ? 'bottom' : 'top']: 'calc(100% + 6px)',
            [isRightEdge ? 'right' : 'left']: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popup Header */}
          <div className="catatan-kalender__popup-header">
            <h4 className="catatan-kalender__popup-title">
              {formattedPopupDate} ({agendas.length})
            </h4>
            <button
              type="button"
              className="catatan-kalender__popup-close"
              onClick={() => setShowPopup(false)}
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
          </div>

          {/* Popup Body: list of all agendas */}
          <div className="catatan-kalender__popup-body">
            {agendas.map((agenda) => (
              <div
                key={agenda.id}
                className="catatan-kalender__popup-item"
                onClick={() => {
                  setShowPopup(false);
                  onAgendaClick(agenda.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowPopup(false);
                    onAgendaClick(agenda.id);
                  }
                }}
              >
                <span className="font-semibold truncate flex-1 text-left">
                  {agenda.judul || 'Tanpa judul'}
                </span>
                {agenda.waktu_agenda && (
                  <span className="flex items-center gap-1 text-xs opacity-75 shrink-0 ml-2">
                    <Clock size={11} />
                    {agenda.waktu_agenda.slice(0, 5)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Popup Footer: Action to add agenda on this date */}
          <div className="pt-2 border-t border-[var(--catatan-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--catatan-text-secondary)]">
              {agendas.length} agenda
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--catatan-accent)] hover:underline cursor-pointer"
              onClick={() => {
                setShowPopup(false);
                onCreateAgenda(dateStr);
              }}
            >
              <Plus size={13} />
              Tambah Agenda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KalenderCell;
