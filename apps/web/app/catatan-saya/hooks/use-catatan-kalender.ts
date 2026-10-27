'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { KalenderAgenda } from '../types';

export interface UseCatatanKalenderReturn {
  agendas: KalenderAgenda[];
  loading: boolean;
  error: string | null;
  currentMonth: string; // Format: YYYY-MM
  setMonth: (month: string) => void;
  goNextMonth: () => void;
  goPrevMonth: () => void;
  goToday: () => void;
  refreshKalender: () => Promise<void>;
}

/**
 * Helper to get current month formatted as YYYY-MM
 */
function getTodayMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Validates and normalizes YYYY-MM format
 */
function isValidMonthFormat(monthStr: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr);
}

export function useCatatanKalender(initialMonth?: string): UseCatatanKalenderReturn {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    if (initialMonth && isValidMonthFormat(initialMonth)) {
      return initialMonth;
    }
    return getTodayMonth();
  });

  const [agendas, setAgendas] = useState<KalenderAgenda[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMonthRef = useRef<string>(currentMonth);
  currentMonthRef.current = currentMonth;

  /**
   * Fetch calendar agenda notes for given month from /api/catatan-saya/kalender?bulan=YYYY-MM
   */
  const fetchKalender = useCallback(async (monthStr: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/catatan-saya/kalender?bulan=${encodeURIComponent(monthStr)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Gagal memuat kalender (HTTP ${res.status})`);
      }

      const json = await res.json();

      let agendaList: KalenderAgenda[] = [];
      if (Array.isArray(json.data)) {
        agendaList = json.data;
      } else if (Array.isArray(json)) {
        agendaList = json;
      } else if (json.data && Array.isArray(json.data.records)) {
        agendaList = json.data.records;
      }

      setAgendas(agendaList);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('Error fetching catatan kalender:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat agenda kalender.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Set month explicitly (expected format: YYYY-MM)
   */
  const setMonth = useCallback((newMonth: string) => {
    if (!isValidMonthFormat(newMonth)) {
      console.warn(`useCatatanKalender: Invalid month format "${newMonth}". Expected YYYY-MM.`);
      return;
    }
    setCurrentMonth(newMonth);
  }, []);

  /**
   * Navigate to next month
   */
  const goNextMonth = useCallback(() => {
    const [y, m] = currentMonthRef.current.split('-').map(Number);
    // In JavaScript Date constructor: month index is 0-based.
    // Setting month to `m` (which is current month number 1-12) will advance to next month.
    const nextDate = new Date(y, m, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    setMonth(`${nextYear}-${nextMonth}`);
  }, [setMonth]);

  /**
   * Navigate to previous month
   */
  const goPrevMonth = useCallback(() => {
    const [y, m] = currentMonthRef.current.split('-').map(Number);
    // Setting month to `m - 2` goes back one month
    const prevDate = new Date(y, m - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    setMonth(`${prevYear}-${prevMonth}`);
  }, [setMonth]);

  /**
   * Jump back to current month (today)
   */
  const goToday = useCallback(() => {
    setMonth(getTodayMonth());
  }, [setMonth]);

  /**
   * Refresh current month's calendar data
   */
  const refreshKalender = useCallback(async () => {
    await fetchKalender(currentMonthRef.current);
  }, [fetchKalender]);

  // Fetch data whenever currentMonth changes
  useEffect(() => {
    fetchKalender(currentMonth);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [currentMonth, fetchKalender]);

  return {
    agendas,
    loading,
    error,
    currentMonth,
    setMonth,
    goNextMonth,
    goPrevMonth,
    goToday,
    refreshKalender,
  };
}

export default useCatatanKalender;
