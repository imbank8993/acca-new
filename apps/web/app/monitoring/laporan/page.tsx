import { Metadata } from 'next';
import MonitoringLaporanClient from './client';

export const metadata: Metadata = {
    title: 'Monitoring Laporan Kegiatan - ACCA',
    description: 'Portal Publik Monitoring & Verifikasi Laporan Guru Asuh, Klinik Pembelajaran, dan Ekstrakurikuler untuk Komite dan Pengawasan Madrasah.',
};

export default function MonitoringLaporanPage() {
    return <MonitoringLaporanClient />;
}
