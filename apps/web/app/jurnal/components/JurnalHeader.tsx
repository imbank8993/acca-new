'use client';

import React from 'react';

interface JurnalHeaderProps {
    adminMode?: boolean;
    setAdminMode?: (v: boolean) => void;
    isAdminModeUser?: boolean;
    bandingPending?: number;
    onBandingClick?: () => void;
}

export default function JurnalHeader({ adminMode, setAdminMode, isAdminModeUser, bandingPending, onBandingClick }: JurnalHeaderProps) {
    const title = adminMode ? 'Panel Admin Jurnal' : 'Jurnal Pembelajaran';
    const description = adminMode
        ? 'Pengaturan generate otomatis, generate manual, import & hapus massal'
        : 'Daftar kegiatan belajar mengajar harian';

    return null;
}
