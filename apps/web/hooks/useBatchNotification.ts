'use client';

import Swal from 'sweetalert2';
import { useCallback, useRef } from 'react';

/**
 * Hook untuk mengkelola notifikasi batch - menggabungkan multiple actions
 * menjadi satu notifikasi summary
 */
export function useBatchNotification() {
    const batchRef = useRef<{
        items: Array<{ type: 'success' | 'error' | 'warning'; message: string }>;
        timer: NodeJS.Timeout | null;
        flushPromise: Promise<void> | null;
        resolveFlush: (() => void) | null;
    }>({
        items: [],
        timer: null,
        flushPromise: null,
        resolveFlush: null,
    });

    const flush = useCallback(async () => {
        const current = batchRef.current;
        if (current.items.length === 0) return;

        const items = [...current.items];
        current.items = [];

        // Build summary message
        const successCount = items.filter(i => i.type === 'success').length;
        const errorCount = items.filter(i => i.type === 'error').length;
        const warningCount = items.filter(i => i.type === 'warning').length;

        let title = '';
        let icon: 'success' | 'error' | 'warning' = 'success';

        if (successCount > 0 && errorCount === 0) {
            title = successCount === 1 ? 'Berhasil' : `${successCount} item berhasil`;
        } else if (errorCount > 0 && successCount === 0) {
            title = errorCount === 1 ? 'Gagal' : `${errorCount} item gagal`;
            icon = errorCount === 1 ? 'error' : 'warning';
        } else {
            title = `${successCount} berhasil, ${errorCount} gagal`;
            icon = 'warning';
        }

        // Show summary if more than 1 action
        if (items.length > 1) {
            await Swal.fire({
                icon,
                title,
                showConfirmButton: true,
                confirmButtonText: 'OK',
                timer: items.length > 5 ? 5000 : 3000,
            });
        } else {
            // Single action - show as normal
            await Swal.fire({
                icon,
                title,
                timer: 2000,
                showConfirmButton: false,
            });
        }
    }, []);

    const addNotification = useCallback((type: 'success' | 'error' | 'warning', message: string, delayMs: number = 800) => {
        const current = batchRef.current;

        // Add to batch
        current.items.push({ type, message });

        // Clear existing timer
        if (current.timer) {
            clearTimeout(current.timer);
        }

        // Set new flush timer
        current.timer = setTimeout(() => {
            flush();
        }, delayMs);
    }, [flush]);

    const addSuccess = useCallback((message: string, delayMs?: number) => {
        addNotification('success', message, delayMs);
    }, [addNotification]);

    const addError = useCallback((message: string, delayMs?: number) => {
        addNotification('error', message, delayMs);
    }, [addNotification]);

    const addWarning = useCallback((message: string, delayMs?: number) => {
        addNotification('warning', message, delayMs);
    }, [addNotification]);

    const forceFlush = useCallback(async () => {
        if (batchRef.current.timer) {
            clearTimeout(batchRef.current.timer);
            batchRef.current.timer = null;
        }
        await flush();
    }, [flush]);

    return {
        addSuccess,
        addError,
        addWarning,
        forceFlush,
    };
}
