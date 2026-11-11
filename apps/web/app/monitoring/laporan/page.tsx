import { Metadata } from 'next';
import MonitoringLaporanClient from './client';

export const metadata: Metadata = {
    title: 'Monitoring Laporan Kegiatan - ACCA',
    description: 'Portal publik monitoring laporan Guru Asuh, Klinik Pembelajaran, Ekstrakurikuler, dan ringkasan Pengajuan Komite.',
};

export default function MonitoringLaporanPage() {
    return <MonitoringLaporanClient />;
}
