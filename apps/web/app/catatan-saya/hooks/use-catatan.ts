'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Catatan, CatatanStatus, CatatanJenis } from '../types';

export interface CatatanFilters {
  status: CatatanStatus | 'all';
  jenis: CatatanJenis | 'all';
  label: string;
  search: string;
}

export interface CatatanPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UseCatatanOptions {
  initialStatus?: CatatanStatus | 'all';
  initialJenis?: CatatanJenis | 'all';
  initialLabel?: string;
  initialSearch?: string;
  initialPage?: number;
  limit?: number;
  autoFetch?: boolean;
}

export interface UseCatatanReturn {
  notes: Catatan[];
  loading: boolean;
  error: string | null;
  filters: CatatanFilters;
  pagination: CatatanPagination;
  setFilter: (
    keyOrFilters: keyof CatatanFilters | Partial<CatatanFilters>,
    value?: any
  ) => void;
  setSearch: (query: string) => void;
  fetchNotes: (pageOverride?: number, filtersOverride?: Partial<CatatanFilters>) => Promise<void>;
  nextPage: () => void;
  prevPage: () => void;
  setPage: (page: number) => void;
  refreshNotes: () => Promise<void>;
}

const DEFAULT_FILTERS: CatatanFilters = {
  status: 'all',
  jenis: 'all',
  label: '',
  search: '',
};

const DEFAULT_LIMIT = 12;

export function useCatatan(options: UseCatatanOptions = {}): UseCatatanReturn {
  const {
    initialStatus = 'all',
    initialJenis = 'all',
    initialLabel = '',
    initialSearch = '',
    initialPage = 1,
    limit = DEFAULT_LIMIT,
    autoFetch = true,
  } = options;

  const [notes, setNotes] = useState<Catatan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<CatatanFilters>({
    status: initialStatus,
    jenis: initialJenis,
    label: initialLabel,
    search: initialSearch,
  });

  const [pagination, setPagination] = useState<CatatanPagination>({
    page: initialPage,
    limit,
    total: 0,
    totalPages: 1,
  });

  // Track search debounce timer
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep references to current state for stable callbacks
  const filtersRef = useRef<CatatanFilters>(filters);
  filtersRef.current = filters;

  const paginationRef = useRef<CatatanPagination>(pagination);
  paginationRef.current = pagination;

  /**
   * Core fetch function to load notes from /api/catatan-saya
   */
  const fetchNotes = useCallback(
    async (pageOverride?: number, filtersOverride?: Partial<CatatanFilters>) => {
      // Cancel any ongoing fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const activePage = pageOverride ?? paginationRef.current.page;
      const activeFilters = {
        ...filtersRef.current,
        ...(filtersOverride || {}),
      };

      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();

        if (activeFilters.status && activeFilters.status !== 'all') {
          queryParams.set('status', activeFilters.status);
        }
        if (activeFilters.jenis && activeFilters.jenis !== 'all') {
          queryParams.set('jenis', activeFilters.jenis);
        }
        if (activeFilters.label && activeFilters.label.trim()) {
          queryParams.set('label', activeFilters.label.trim());
        }
        if (activeFilters.search && activeFilters.search.trim()) {
          queryParams.set('search', activeFilters.search.trim());
        }

        queryParams.set('page', String(activePage));
        queryParams.set('limit', String(paginationRef.current.limit));

        const res = await fetch(`/api/catatan-saya?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortControllerRef.current.signal,
          cache: 'no-store',
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || `Gagal memuat catatan (HTTP ${res.status})`);
        }

        const json = await res.json();

        // Handle variations of NestJS response: { success: true, data: { records, total, ... } }
        // or { data: [...] } or direct array
        let noteList: Catatan[] = [];
        let totalRecords = 0;
        let totalP = 1;

        if (json.data) {
          if (Array.isArray(json.data)) {
            noteList = json.data;
            totalRecords = json.meta?.total ?? json.total ?? json.data.length;
          } else if (typeof json.data === 'object') {
            noteList = json.data.records || json.data.items || json.data.notes || [];
            totalRecords = json.data.total ?? noteList.length;
            totalP = json.data.totalPages ?? Math.max(1, Math.ceil(totalRecords / paginationRef.current.limit));
          }
        } else if (Array.isArray(json.records)) {
          noteList = json.records;
          totalRecords = json.total ?? json.records.length;
          totalP = json.totalPages ?? Math.max(1, Math.ceil(totalRecords / paginationRef.current.limit));
        } else if (Array.isArray(json)) {
          noteList = json;
          totalRecords = json.length;
        }

        totalP = json.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / paginationRef.current.limit));

        setNotes(noteList);
        setPagination((prev) => ({
          ...prev,
          page: activePage,
          total: totalRecords,
          totalPages: totalP,
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Fetch was aborted due to new request, do not update state
          return;
        }
        console.error('Error fetching catatan:', err);
        setError(err.message || 'Terjadi kesalahan saat memuat catatan.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Set filter property or multiple filters at once.
   * Automatically resets page to 1.
   */
  const setFilter = useCallback(
    (
      keyOrFilters: keyof CatatanFilters | Partial<CatatanFilters>,
      value?: any
    ) => {
      setFilters((prev) => {
        let updated: CatatanFilters;
        if (typeof keyOrFilters === 'string') {
          updated = { ...prev, [keyOrFilters]: value };
        } else {
          updated = { ...prev, ...keyOrFilters };
        }

        filtersRef.current = updated;
        // Trigger fetch with new filters on page 1
        fetchNotes(1, updated);
        return updated;
      });
    },
    [fetchNotes]
  );

  /**
   * Debounced search handler (300ms delay)
   */
  const setSearch = useCallback(
    (query: string) => {
      setFilters((prev) => ({ ...prev, search: query }));

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      searchDebounceRef.current = setTimeout(() => {
        const nextFilters = { ...filtersRef.current, search: query };
        fetchNotes(1, nextFilters);
      }, 300);
    },
    [fetchNotes]
  );

  /**
   * Pagination controls
   */
  const setPage = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > paginationRef.current.totalPages) return;
      fetchNotes(newPage);
    },
    [fetchNotes]
  );

  const nextPage = useCallback(() => {
    const cur = paginationRef.current.page;
    const max = paginationRef.current.totalPages;
    if (cur < max) {
      setPage(cur + 1);
    }
  }, [setPage]);

  const prevPage = useCallback(() => {
    const cur = paginationRef.current.page;
    if (cur > 1) {
      setPage(cur - 1);
    }
  }, [setPage]);

  /**
   * Refresh notes keeping current filters and page
   */
  const refreshNotes = useCallback(async () => {
    await fetchNotes(paginationRef.current.page, filtersRef.current);
  }, [fetchNotes]);

  // Initial fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchNotes(initialPage, filtersRef.current);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoFetch, fetchNotes, initialPage]);

  return {
    notes,
    loading,
    error,
    filters,
    pagination,
    setFilter,
    setSearch,
    fetchNotes,
    nextPage,
    prevPage,
    setPage,
    refreshNotes,
  };
}
