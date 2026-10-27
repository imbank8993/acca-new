'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-client';
import { isLogoutInProgress } from '@/lib/single-logout-client';

export default function UserHeartbeat() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const location = useRef('');
    const notify = useRef<(() => void) | null>(null);
    const search = searchParams.toString();
    location.current = search ? `${pathname}?${search}` : pathname;

    useEffect(() => {
        const tabId = crypto.randomUUID();
        let sequence = 0;
        let active = true;
        let authenticated = false;
        let checking = false;
        const payload = (online: boolean) => JSON.stringify({ tabId, sequence: ++sequence, online, location: location.current });
        const leave = () => {
            active = false;
            if (!authenticated) return;
            const body = payload(false);
            const queued = navigator.sendBeacon?.('/api/user/heartbeat', new Blob([body], { type: 'application/json' }));
            if (!queued) void fetch('/api/user/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
        };
        const beat = async () => {
            if (!active || checking || isLogoutInProgress()) return;
            checking = true;
            try {
                const user = await getCurrentUser();
                if (!active || isLogoutInProgress()) return;
                if (!user) { leave(); return; }
                authenticated = true;
                await fetch('/api/user/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload(true), cache: 'no-store', signal: AbortSignal.timeout(10000) });
            } catch { /* A lost connection expires on the server without extending presence. */ }
            finally { checking = false; }
        };
        const resume = () => { active = true; void beat(); };
        const visible = () => { if (document.visibilityState === 'visible') resume(); };
        const storage = (event: StorageEvent) => { if (event.key === 'acca_logout_at' && event.newValue) leave(); };
        notify.current = () => { void beat(); };
        void beat();
        const timer = setInterval(() => { void beat(); }, 15000);
        window.addEventListener('pagehide', leave);
        window.addEventListener('pageshow', resume);
        window.addEventListener('online', resume);
        window.addEventListener('offline', leave);
        window.addEventListener('acca:logout-start', leave);
        window.addEventListener('storage', storage);
        document.addEventListener('visibilitychange', visible);
        return () => {
            leave(); notify.current = null; clearInterval(timer);
            window.removeEventListener('pagehide', leave);
            window.removeEventListener('pageshow', resume);
            window.removeEventListener('online', resume);
            window.removeEventListener('offline', leave);
            window.removeEventListener('acca:logout-start', leave);
            window.removeEventListener('storage', storage);
            document.removeEventListener('visibilitychange', visible);
        };
    }, []);

    useEffect(() => { notify.current?.(); }, [pathname, search]);
    return null;
}
