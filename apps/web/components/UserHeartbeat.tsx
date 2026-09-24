'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-client';

export default function UserHeartbeat() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        let isMounted = true;
        const sendHeartbeat = async () => {
            if (!isMounted) return;
            try {
                // Check if user is authenticated before sending heartbeat
                const user = await getCurrentUser();
                if (!user) return;

                const searchStr = searchParams.toString();
                const location = searchStr ? `${pathname}?${searchStr}` : pathname;
                
                // Use fetch with keepalive and proper error handling
                const response = await fetch('/api/user/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location }),
                    keepalive: true // Better for heartbeats
                });

                if (!response.ok) {
                    // Log but don't crash
                    console.warn(`Heartbeat status: ${response.status}`);
                }
            } catch (err: any) {
                // Check if it's a fetch error we can ignore
                if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                    // Likely server restarting or network hiccup, log silently
                    console.debug('Heartbeat network error (retrying later)');
                } else {
                    console.error('Heartbeat failed', err);
                }
            }
        };

        // Send immediately when page/tab changes so Monitoring's access time is accurate
        sendHeartbeat();

        // Then keep alive every 30 seconds
        const interval = setInterval(sendHeartbeat, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [pathname, searchParams]);

    return null; // Invisible component
}
