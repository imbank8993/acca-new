'use client';

import { useState, useEffect } from 'react';

export function useStickyState<T>(defaultValue: T, key: string): [T, (value: T | ((val: T) => T)) => void] {
    const [value, setValue] = useState<T>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stickyValue = window.sessionStorage.getItem(key);
                return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }
        return defaultValue;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                // Ignore storage errors
            }
        }
    }, [key, value]);

    return [value, setValue];
}
