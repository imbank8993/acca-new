'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import useCatatanKalender from '../hooks/use-catatan-kalender';
import type { KalenderAgenda } from '../types';
import KalenderCell from './KalenderCell';

export interface KalenderBulananProps {
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

const DAY_HEADERS = [
  { full: 'Senin', short: 'Sen' },
  { full: 'Selasa', short: 'Sel' },
  { full: 'Rabu', short: 'Rab' },
  { full: 'Kamis', short: 'Kam' },
  { full: 'Jumat', short: 'Jum' },
  { full: 'Sabtu', short: 'Sab' },
  { full: 'Minggu', short: 'Min' },
];

export function KalenderBulanan({
  onAgendaClick,
  onCreateAgenda,
}: KalenderBulananProps) {
  const {
    agendas = [],
    loading,
    error,
    currentMonth,
    goNextMonth,
    goPrevMonth,
    goToday,
    refreshKalender,
  } = useCatatanKalender();

  // Parse currentMonth (format: YYYY-MM)
  const { year, monthIndex } = useMemo(() => {
    if (!currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
      const now = new Date();
      return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    const [y, m] = currentMonth.split('-').map(Number);
    return { year: y, monthIndex: m - 1 };
  }, [currentMonth]);

  const monthTitle = `${NAMA_BULAN[monthIndex] || ''} ${year}`;

  // Index agendas by date (YYYY-MM-DD) for fast O(1) lookup
  const agendasByDate = useMemo(() => {
    const map = new Map<string, KalenderAgenda[]>();
    if (!Array.isArray(agendas)) return map;

    for (const item of agendas) {
      if (!item.tanggal_agenda) continue;
      const key = item.tanggal_agenda.split('T')[0];
      const existing = map.get(key);
      if (existing) {
        existing.push(item);
      } else {
        map.set(key, [item]);
      }
    }

    // Sort agendas on each day chronologically by waktu_agenda
    map.forEach((list) => {
      list.sort((a, b) => {
        if (a.waktu_agenda && b.waktu_agenda) {
          return a.waktu_agenda.localeCompare(b.waktu_agenda);
        }
        if (a.waktu_agenda) return -1;
        if (b.waktu_agenda) return 1;
        return a.id - b.id;
      });
    });

    return map;
  }, [agendas]);

  // Calendar dates calculation:
  // IMPORTANT: Monday = first day of week. Use (date.getDay() + 6) % 7
  const { cells } = useMemo(() => {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0=Senin ... 6=Minggu
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // Ensure 5 or 6 rows (35 or 42 cells)
    const totalDays = startDayOfWeek + daysInMonth;
    const totalCells = Math.max(35, Math.ceil(totalDays / 7) * 7);

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    const cellList = [];

    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(year, monthIndex, 1 - startDayOfWeek + i);
      const cellY = cellDate.getFullYear();
      const cellM = cellDate.getMonth();
      const cellD = cellDate.getDate();

      const isCurrentMonth = cellY === year && cellM === monthIndex;
      const isToday = cellY === todayY && cellM === todayM && cellD === todayD;
      const dateStr = `${cellY}-${String(cellM + 1).padStart(2, '0')}-${String(cellD).padStart(2, '0')}`;

      cellList.push({
        date: cellDate,
        dateStr,
        isCurrentMonth,
        isToday,
      });
    }

    return { cells: cellList };
  }, [year, monthIndex]);

  return (
    <div className="catatan-kalender">
      {/* Calendar Header */}
      <div className="catatan-kalender__header">
        <div className="flex items-center gap-3">
          <h2 className="catatan-kalender__title">{monthTitle}</h2>
          {loading && (
            <span className="flex items-center text-xs text-[var(--catatan-text-secondary)] gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[var(--catatan-accent)] inline-block" />
              Memuat data...
            </span>
          )}
        </div>

        <div className="catatan-kalender__nav">
          <button
            type="button"
            className="catatan-kalender__nav-btn"
            onClick={goToday}
            title="Kembali ke bulan ini"
          >
            Bulan ini
          </button>
          <button
            type="button"
            className="catatan-kalender__nav-btn"
            onClick={goPrevMonth}
            aria-label="Bulan sebelumnya"
            title="Bulan sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="catatan-kalender__nav-btn"
            onClick={goNextMonth}
            aria-label="Bulan berikutnya"
            title="Bulan berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Error notification if fetch failed */}
      {error && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refreshKalender()}
            className="flex items-center gap-1 font-semibold underline hover:opacity-80"
          >
            <RefreshCw size={12} />
            Coba lagi
          </button>
        </div>
      )}

      {/* 7-Column Grid */}
      <div
        className={`catatan-kalender__grid transition-opacity duration-200 ${
          loading && agendas.length === 0 ? 'opacity-60' : 'opacity-100'
        }`}
      >
        {/* Day Name Headers (Monday to Sunday) */}
        {DAY_HEADERS.map((day) => (
          <div key={day.full} className="catatan-kalender__day-header">
            <span className="hidden sm:inline">{day.full}</span>
            <span className="sm:hidden">{day.short}</span>
          </div>
        ))}

        {/* 5-6 Rows of Calendar Cells */}
        {cells.map((cell) => (
          <KalenderCell
            key={cell.dateStr}
            date={cell.date}
            isCurrentMonth={cell.isCurrentMonth}
            isToday={cell.isToday}
            agendas={agendasByDate.get(cell.dateStr) || []}
            onAgendaClick={onAgendaClick}
            onCreateAgenda={onCreateAgenda}
          />
        ))}
      </div>
    </div>
  );
}

export default KalenderBulanan;
