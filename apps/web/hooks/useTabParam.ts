'use client';

import { useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * Tab state synced to the URL query param `?tab=`.
 *
 * Source of truth is the URL, so the active tab:
 *  - survives a page refresh (the URL persists),
 *  - stays in sync with Next.js router navigations
 *
 * Drop-in replacement for `useState`/`useStickyState` for tab state:
 *   const [activeTab, setActiveTab] = useTabParam<TabType>('default', ['a','b','c']);
 *
 * @param defaultValue  tab used when the URL has no (valid) `tab` param
 * @param validValues   optional allow-list; a `tab` param outside it is ignored
 * @param key           query-param name (default `tab`)
 */
export function useTabParam<T extends string>(
    defaultValue: T,
    validValues?: readonly T[],
    key: string = 'tab'
): [T, (value: T) => void] {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const param = searchParams ? (searchParams.get(key) as T | null) : null;
    
    // Validasi parameter URL terhadap allow-list (BUG-06)
    const activeTab: T = (param && (!validValues || validValues.includes(param)))
        ? param
        : defaultValue;

    const setTab = useCallback((next: T) => {
        if (searchParams && pathname) {
            const current = new URLSearchParams(Array.from(searchParams.entries()));
            current.set(key, next);
            const search = current.toString();
            const query = search ? `?${search}` : '';
            const newUrl = `${pathname}${query}`;

            // Update browser URL immediately
            if (typeof window !== 'undefined' && window.history) {
                window.history.replaceState(null, '', newUrl);
            }

            try {
                router.replace(newUrl, { scroll: false });
            } catch (err) {
                // Ignore network fetch errors during dev server reloads
            }
        }
    }, [key, pathname, router, searchParams]);


    return [activeTab, setTab];
}
