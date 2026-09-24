'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { can as canWith, type CapabilityKey } from '@/lib/capabilities';

/**
 * Hook kapabilitas untuk komponen klien.
 *
 *   const { can, siap } = useCapabilities();
 *   {can('klinik.approve_slot') && <TombolApproval />}
 *
 * `siap` = false selama kapabilitas masih diambil. Selama itu `can()` menjawab
 * false, jadi tombol muncul SETELAH izinnya pasti — bukan berkedip muncul lalu
 * hilang (atau lebih buruk: tampil ke orang yang tidak berhak).
 *
 * Ini hanya lapisan tampilan. Gerbang sebenarnya ada di server (`requireCap`).
 */
export function useCapabilities() {
    const [caps, setCaps] = useState<string[] | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let batal = false;
        (async () => {
            try {
                const res = await authFetch('/api/me/capabilities');
                const json = await res.json();
                if (batal) return;
                if (json?.ok) {
                    setCaps(Array.isArray(json.caps) ? json.caps : []);
                    setIsAdmin(!!json.isAdmin);
                } else {
                    // Jangan diam-diam: gagal di sini tampak seperti "user tidak
                    // punya izin apa pun" — tab dan tombol hilang tanpa jejak.
                    console.error('[useCapabilities] gagal memuat kapabilitas:', res.status, json);
                    setCaps([]);
                }
            } catch (e) {
                console.error('[useCapabilities] gagal memuat kapabilitas:', e);
                if (!batal) setCaps([]);
            }
        })();
        return () => { batal = true; };
    }, []);

    return {
        siap: caps !== null,
        caps: caps ?? [],
        isAdmin,
        can: (key: CapabilityKey) => canWith({ caps: caps ?? [], isAdmin }, key),
    };
}
