'use client';

import Swal from 'sweetalert2';

// --- Notification Queue Manager ---
// Batches multiple rapid notifications into one summary

interface QueueItem {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
}

class NotificationManager {
    private queue: QueueItem[] = [];
    private timer: NodeJS.Timeout | null = null;
    private readonly FLUSH_DELAY_MS = 600;

    private flush() {
        if (this.queue.length === 0) return;
        const items = [...this.queue];
        this.queue = [];

        const successCount = items.filter(i => i.type === 'success').length;
        const errorCount = items.filter(i => i.type === 'error').length;
        const warningCount = items.filter(i => i.type === 'warning').length;

        // Responsive: use customClass for mobile-friendly sizing
        const responsiveOptions = {
            heightAuto: false,
            backdrop: true,
            allowEnterKey: true,
            showCloseButton: false,
            confirmButtonColor: '#2563eb',
        };

        if (items.length === 1) {
            const item = items[0];
            Swal.fire({
                ...responsiveOptions,
                icon: item.type,
                title: item.message,
                timer: item.type === 'error' ? 3000 : 2000,
                showConfirmButton: item.type === 'error',
                confirmButtonText: 'OK',
            });
        } else {
            const icon: 'success' | 'warning' | 'error' | 'info' =
                errorCount > 0 && successCount === 0 ? 'error'
                : successCount > 0 && errorCount === 0 ? 'success'
                : 'warning';

            const parts: string[] = [];
            if (successCount > 0) parts.push(`${successCount} berhasil`);
            if (errorCount > 0) parts.push(`${errorCount} gagal`);
            if (warningCount > 0 && successCount === 0 && errorCount === 0) parts.push(`${warningCount} perlu perhatian`);

            Swal.fire({
                ...responsiveOptions,
                icon,
                title: parts.join(', '),
                text: `Total ${items.length} aksi telah diproses.`,
                timer: items.length > 5 ? 4000 : 2500,
                showConfirmButton: items.length > 3,
                confirmButtonText: 'OK',
            });
        }
    }

    private scheduleFlush() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), this.FLUSH_DELAY_MS);
    }

    notify(type: QueueItem['type'], message: string) {
        this.queue.push({ type, message });
        this.scheduleFlush();
    }

    success(message: string) { this.notify('success', message); }
    error(message: string) { this.notify('error', message); }
    warning(message: string) { this.notify('warning', message); }
    info(message: string) { this.notify('info', message); }

    /** Force show pending notifications immediately */
    async flushNow() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        await this.flush();
    }
}

// Singleton instance
const notif = new NotificationManager();

export default notif;

// Export type for convenience
export type { QueueItem };