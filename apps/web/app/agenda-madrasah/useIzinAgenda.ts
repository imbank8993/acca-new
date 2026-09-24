'use client';

import { useEffect, useState } from 'react';

/**
 * Hak kelola Agenda Madrasah dan Data Libur, dievaluasi server.
 *
 * ADMIN melekat di kode; selebihnya (OP_AGENDA untuk agenda, OP_JURNAL untuk libur)
 * dapat ditambah/diatur admin lewat Pengaturan Users → Hak Akses Fitur.
 */
export function useIzinAgenda() {
    const [bolehKelola, setBolehKelola] = useState(false);
    const [canManageLibur, setCanManageLibur] = useState(false);
    const [memuat, setMemuat] = useState(true);

    useEffect(() => {
        let batal = false;
        (async () => {
            try {
                const res = await fetch('/api/agenda-madrasah/izin-saya');
                const json = await res.json();
                if (!batal && json?.success) {
                    setBolehKelola(!!json.data?.bolehKelola);
                    setCanManageLibur(!!json.data?.bolehKelolaLibur);
                }
            } catch (e) {
                console.warn('[AGENDA] Gagal memuat hak akses:', e);
            } finally {
                if (!batal) setMemuat(false);
            }
        })();
        return () => { batal = true; };
    }, []);

    return { 
        bolehKelola, 
        canManageAgenda: bolehKelola, 
        canManageLibur, 
        memuat 
    };
}
