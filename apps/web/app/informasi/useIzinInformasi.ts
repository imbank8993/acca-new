'use client';

import { useEffect, useState } from 'react';

export interface IzinKategori {
    akademik: boolean;
    kesiswaan: boolean;
    keasramaan: boolean;
    umum: boolean;
    pengumuman: boolean;
}

export interface IzinInformasiData {
    bolehKelola: boolean;
    bolehPengumuman: boolean;
    divisi: string[];
    kategori: IzinKategori;
}

const DEFAULT_IZIN: IzinInformasiData = {
    bolehKelola: false,
    bolehPengumuman: false,
    divisi: [],
    kategori: {
        akademik: false,
        kesiswaan: false,
        keasramaan: false,
        umum: false,
        pengumuman: false,
    },
};

/**
 * Hak kelola modul Informasi dan Pengumuman, dievaluasi server.
 */
export function useIzinInformasi() {
    const [izin, setIzin] = useState<IzinInformasiData>(DEFAULT_IZIN);
    const [memuat, setMemuat] = useState(true);

    useEffect(() => {
        let batal = false;
        (async () => {
            try {
                const res = await fetch('/api/informasi-akademik/izin-saya');
                const json = await res.json();
                if (!batal && json?.ok && json.data) {
                    setIzin({
                        bolehKelola: !!json.data.bolehKelola,
                        bolehPengumuman: !!json.data.bolehPengumuman,
                        divisi: Array.isArray(json.data.divisi) ? json.data.divisi : [],
                        kategori: json.data.kategori || DEFAULT_IZIN.kategori,
                    });
                }
            } catch (e) {
                console.warn('[INFORMASI] Gagal memuat hak akses:', e);
            } finally {
                if (!batal) setMemuat(false);
            }
        })();
        return () => { batal = true; };
    }, []);

    return {
        bolehKelola: izin.bolehKelola,
        bolehPengumuman: izin.bolehPengumuman,
        divisi: izin.divisi,
        kategori: izin.kategori,
        memuat,
    };
}

