'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Catatan, CatatanStatus } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseCatatanDetailReturn {
  catatan: Catatan | null;
  setCatatan: React.Dispatch<React.SetStateAction<Catatan | null>>;
  loading: boolean;
  saving: boolean;
  saveStatus: SaveStatus;
  conflictData: Catatan | null;
  hasUnsavedChanges: boolean;
  error: string | null;
  fetchCatatan: (id: number | string) => Promise<Catatan | null>;
  clearConflict: () => void;
  updateField: <K extends keyof Catatan>(field: K, value: Catatan[K]) => void;
  changeStatus: (status: CatatanStatus) => Promise<boolean>;
  restoreFromTrash: () => Promise<boolean>;
  permanentDelete: () => Promise<boolean>;
  retrySave: () => Promise<boolean>;
  saveNow: () => Promise<boolean>;
}

export function useCatatanDetail(
  initialIdOrCatatan?: number | string | Catatan | null
): UseCatatanDetailReturn {
  const [catatan, setCatatan] = useState<Catatan | null>(() => {
    if (initialIdOrCatatan && typeof initialIdOrCatatan === 'object') {
      return initialIdOrCatatan;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [conflictData, setConflictData] = useState<Catatan | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // References to keep callbacks stable and avoid stale closures
  const catatanRef = useRef<Catatan | null>(catatan);
  catatanRef.current = catatan;

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetSavedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef<boolean>(false);

  /**
   * Fetch single note from /api/catatan-saya/:id
   */
  const fetchCatatan = useCallback(async (id: number | string): Promise<Catatan | null> => {
    setLoading(true);
    setError(null);
    setConflictData(null);
    setHasUnsavedChanges(false);
    setSaveStatus('idle');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    try {
      const res = await fetch(`/api/catatan-saya/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Gagal memuat catatan (HTTP ${res.status})`);
      }

      const json = await res.json();
      const loaded: Catatan = json.data || json;

      setCatatan(loaded);
      catatanRef.current = loaded;
      return loaded;
    } catch (err: any) {
      console.error('Error fetching catatan detail:', err);
      setError(err.message || 'Gagal memuat catatan.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear conflict data (e.g., after user confirms override or discards)
   */
  const clearConflict = useCallback(() => {
    setConflictData(null);
  }, []);

  /**
   * Internal function to perform the actual PUT request
   */
  const executeSave = useCallback(async (noteToSave: Catatan): Promise<boolean> => {
    if (!noteToSave || !noteToSave.id) return false;
    if (isSavingRef.current) return false;

    isSavingRef.current = true;
    setSaveStatus('saving');
    setError(null);

    try {
      const payload = {
        jenis: noteToSave.jenis,
        judul: noteToSave.judul,
        isi: noteToSave.isi,
        label: noteToSave.label,
        warna: noteToSave.warna,
        tanggal_agenda: noteToSave.tanggal_agenda,
        waktu_agenda: noteToSave.waktu_agenda,
        tempat_agenda: noteToSave.tempat_agenda,
        status: noteToSave.status,
        version: noteToSave.version, // for optimistic locking
      };

      const res = await fetch(`/api/catatan-saya/${noteToSave.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Handle 409 Conflict: another tab or session updated the record
      if (res.status === 409) {
        const conflictJson = await res.json().catch(() => ({}));
        const serverVersionData =
          conflictJson.serverData ||
          conflictJson.data?.current ||
          conflictJson.data ||
          conflictJson.serverCatatan ||
          null;

        setConflictData(serverVersionData);
        setSaveStatus('error');
        setError('Konflik versi: Catatan telah diubah di sesi lain. Harap tinjau versi server.');
        setHasUnsavedChanges(true);
        return false;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Gagal menyimpan (HTTP ${res.status})`);
      }

      const json = await res.json();
      const updatedNote: Catatan = json.data || json;

      // Update version and updated_at from server response
      setCatatan((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          version: updatedNote.version ?? (prev.version + 1),
          updated_at: updatedNote.updated_at ?? new Date().toISOString(),
        };
      });

      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setConflictData(null);

      // Reset 'saved' badge back to 'idle' after 3 seconds
      if (resetSavedStatusTimerRef.current) {
        clearTimeout(resetSavedStatusTimerRef.current);
      }
      resetSavedStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);

      return true;
    } catch (err: any) {
      console.error('Error saving catatan:', err);
      setSaveStatus('error');
      setError(err.message || 'Gagal menyimpan catatan.');
      setHasUnsavedChanges(true);
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  /**
   * Trigger immediate manual save (e.g. before closing or on Ctrl+S)
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!catatanRef.current) return false;
    return executeSave(catatanRef.current);
  }, [executeSave]);

  /**
   * Retry save after previous failure
   */
  const retrySave = useCallback(async (): Promise<boolean> => {
    return saveNow();
  }, [saveNow]);

  /**
   * Update a field in local state and trigger debounced auto-save (1500ms)
   */
  const updateField = useCallback(
    <K extends keyof Catatan>(field: K, value: Catatan[K]) => {
      setCatatan((prev) => {
        if (!prev) return null;
        const updated = { ...prev, [field]: value };
        catatanRef.current = updated;
        return updated;
      });

      setHasUnsavedChanges(true);
      setSaveStatus('idle');
      setError(null);

      // Cancel previous debounce timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Schedule auto-save after 1500ms
      autoSaveTimerRef.current = setTimeout(() => {
        if (catatanRef.current) {
          executeSave(catatanRef.current);
        }
      }, 1500);
    },
    [executeSave]
  );

  /**
   * Change status (active, pinned, archived, trashed)
   * Calls PUT /api/catatan-saya/:id/status
   */
  const changeStatus = useCallback(
    async (newStatus: CatatanStatus): Promise<boolean> => {
      const active = catatanRef.current;
      if (!active || !active.id) return false;

      try {
        const res = await fetch(`/api/catatan-saya/${active.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || errJson.message || 'Gagal mengubah status catatan');
        }

        const json = await res.json();
        const updated = json.data || json;

        setCatatan((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: newStatus,
            version: updated.version ?? prev.version,
            updated_at: updated.updated_at ?? new Date().toISOString(),
            trashed_at: newStatus === 'trashed' ? new Date().toISOString() : prev.trashed_at,
          };
        });

        return true;
      } catch (err: any) {
        console.error('Error changing status:', err);
        setError(err.message || 'Gagal mengubah status catatan');
        return false;
      }
    },
    []
  );

  /**
   * Restore note from trash
   * Calls PUT /api/catatan-saya/:id/restore
   */
  const restoreFromTrash = useCallback(async (): Promise<boolean> => {
    const active = catatanRef.current;
    if (!active || !active.id) return false;

    try {
      const res = await fetch(`/api/catatan-saya/${active.id}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Gagal memulihkan catatan');
      }

      const json = await res.json();
      const updated = json.data || json;

      setCatatan((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'active',
          trashed_at: null,
          version: updated.version ?? prev.version,
          updated_at: updated.updated_at ?? new Date().toISOString(),
        };
      });

      return true;
    } catch (err: any) {
      console.error('Error restoring note:', err);
      setError(err.message || 'Gagal memulihkan catatan');
      return false;
    }
  }, []);

  /**
   * Permanently delete note
   * Calls DELETE /api/catatan-saya/:id
   */
  const permanentDelete = useCallback(async (): Promise<boolean> => {
    const active = catatanRef.current;
    if (!active || !active.id) return false;

    try {
      const res = await fetch(`/api/catatan-saya/${active.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Gagal menghapus catatan secara permanen');
      }

      setCatatan(null);
      setHasUnsavedChanges(false);
      setSaveStatus('idle');
      return true;
    } catch (err: any) {
      console.error('Error deleting note permanently:', err);
      setError(err.message || 'Gagal menghapus catatan');
      return false;
    }
  }, []);

  // Initialize if an ID was passed initially
  useEffect(() => {
    if (initialIdOrCatatan) {
      if (typeof initialIdOrCatatan === 'number' || typeof initialIdOrCatatan === 'string') {
        fetchCatatan(initialIdOrCatatan);
      }
    }
  }, [fetchCatatan, initialIdOrCatatan]);

  // Warn user before leaving page if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (resetSavedStatusTimerRef.current) {
        clearTimeout(resetSavedStatusTimerRef.current);
      }
    };
  }, []);

  return {
    catatan,
    setCatatan,
    loading,
    saving: saveStatus === 'saving',
    saveStatus,
    conflictData,
    hasUnsavedChanges,
    error,
    fetchCatatan,
    clearConflict,
    updateField,
    changeStatus,
    restoreFromTrash,
    permanentDelete,
    retrySave,
    saveNow,
  };
}
