'use client'

/**
 * REGISTRY KOMPONEN HALAMAN
 * Dipakai oleh app/(dashboard)/[...pageId]/page.tsx untuk merender halaman
 * berdasarkan segmen URL (mis. /pengaturan-users → 'pengaturan-users').
 *
 * Untuk menambah halaman baru:
 * 1. Tambahkan lazy import di bawah (arahkan ke file view/komponen halaman)
 * 2. Tambahkan key baru di PAGE_COMPONENTS (key = id halaman di kolom pages Supabase)
 */

import React, { Suspense, lazy } from 'react'
import type { User } from '@/lib/types'
import DynamicPageRenderer from '@/components/DynamicPageRenderer'
import { PageLoader } from '@/components/ui/Spinner'
import DashboardContent from '@/app/(dashboard)/dashboard/DashboardContent'

// Lazy-loaded page components — hanya dimuat saat diakses
const AbsensiPage = lazy(() => import('@/app/absensi/view'))
const KetidakhadiranPage = lazy(() => import('@/app/ketidakhadiran/view'))
const RekamMedisPage = lazy(() => import('@/app/rekam-medis/view'))
const JurnalPage = lazy(() => import('@/app/jurnal/view'))
const JurnalInputPage = lazy(() => import('@/app/jurnal/input/view'))
const MasterDataPage = lazy(() => import('@/app/master/view'))
const DataSettingsPage = lazy(() => import('@/app/pengaturan-data/view'))
const TaskSettingsPage = lazy(() => import('@/app/pengaturan-tugas/view'))
const UserSettingsPage = lazy(() => import('@/app/pengaturan-users/view'))
const NilaiPage = lazy(() => import('@/app/nilai/view'))
const TugasTambahanPage = lazy(() => import('@/app/tugas-tambahan/view'))
const LckhPage = lazy(() => import('@/app/lckh/view'))
const LckhApprovalPage = lazy(() => import('@/app/lckh-approval/view'))
const PembayaranPage = lazy(() => import('@/app/pembayaran/view'))
const IzinGuruPage = lazy(() => import('@/app/izin-guru/view'))
const SuratPage = lazy(() => import('@/app/surat/view'))
const DaftarSuratPage = lazy(() => import('@/app/surat/daftar/view'))
const ProfilePage = lazy(() => import('@/app/profile/view'))
const PiketPage = lazy(() => import('@/app/piket/view'))
const JadwalPage = lazy(() => import('@/app/jadwal/view'))
const OrangTuaWrapper = lazy(() => import('@/app/jadwal/OrangTuaWrapper'))
const InformasiAkademikPage = lazy(() => import('@/app/informasi/view'))
const InformasiKelolaPage = lazy(() => import('@/app/informasi/kelola/view'))
const RekapJurnalPage = lazy(() => import('@/app/rekap-jurnal/view'))
const MonitoringPage = lazy(() => import('@/app/monitoring/view'))
const KinerjaGuruPage = lazy(() => import('@/app/kinerja-guru/view'))
const AgendaAkademikPage = lazy(() => import('@/app/agenda-madrasah/view'))
const TampilanAgendaPage = lazy(() => import('@/app/tampilan-agenda/page'))
const PusatDokumenPage = lazy(() => import('@/app/dokumen/view'))
const UMKelulusanPage = lazy(() => import('@/app/um-kelulusan/view'))
const CatatanKeuanganPage = lazy(() => import('@/app/catatan-keuangan/view'))
const BandingPage = lazy(() => import('@/app/jurnal/banding/view'))
const LayananPTSPPage = lazy(() => import('@/app/layanan-ptsp/view'))
const TugasSiswaPage = lazy(() => import('@/app/tugas-siswa/view'))
const NilaiSiswaPage = lazy(() => import('@/app/nilai-siswa/view'))
const KlinikPage = lazy(() => import('@/app/klinik/view'))
const BankDataPage = lazy(() => import('@/app/bank-data/view'))
const KeuanganPage = lazy(() => import('@/app/keuangan/view'))
const GuruAsuhPage = lazy(() => import('@/app/guru-asuh/view'))
const WaliKelasPage = lazy(() => import('@/app/wali-kelas/view'))
const EkskulPembinaPage = lazy(() => import('@/app/ekstrakurikuler/view'))
const PengaturanUmumPage = lazy(() => import('@/app/pengaturan-umum/view'))
const ESupervisiPage = lazy(() => import('@/app/e-supervisi/view'))
const KokurikulerPage = lazy(() => import('@/app/kokurikuler/view'))
const PrestasiPage = lazy(() => import('@/app/prestasi/view'))
const ObservasiKelasPage = lazy(() => import('@/app/observasi-kelas/view'))
const BimbinganKonselingPage = lazy(() => import('@/app/bimbingan-konseling/view'))
const SanggarKurikulumPage = lazy(() => import('@/app/sanggar-kurikulum/view'))
const FormDashboardPage = lazy(() => import('@/app/form/view'))
const FormBuilderPage = lazy(() => import('@/app/form/builder/view'))
const FormResponsesPage = lazy(() => import('@/app/form/responses/view'))
const AuditLogPage = lazy(() => import('@/app/audit-log/view'))

/**
 * Halaman utilitas yang boleh diakses walau tidak ada di pagesArray user.
 *
 * `rekam-medis` DIKELUARKAN dari daftar ini: isinya rekam medis siswa, dan
 * "boleh diakses siapa saja yang login" bukan sifat yang pantas untuk data
 * kesehatan. Gerbangnya kini ada di app/(dashboard)/rekam-medis/page.tsx
 * (route khususnya sendiri) dan di API NestJS.
 */
export const SPECIAL_PAGES = [
    'jurnal-banding', 'surat', 'surat-daftar',
    'profile', 'ProfileSaya', 'dashboard', 'jadwal', 'pengumuman',
    'sanggar-kurikulum', 'form/builder', 'form/responses', 'informasi/kelola',
    'audit-log',
]

export const PAGE_COMPONENTS: Record<string, (user: User, onRefreshUser: () => Promise<void>, targetTab?: string) => React.ReactNode> = {
    'dashboard': (user) => <DashboardContent user={user} />,
    'jadwal': (user) => user.roles?.includes('ORANG_TUA') ? <OrangTuaWrapper user={user} /> : <JadwalPage user={user} />,
    'pengumuman': (user) => <InformasiKelolaPage user={user} />,

    // OPERASIONAL
    'absensi': (user) => <AbsensiPage />,
    'ketidakhadiran': (user) => <KetidakhadiranPage />,
    'rekam-medis': (user) => <RekamMedisPage />,
    'jurnal': (user) => <JurnalPage user={user} />,
    'jurnal-banding': (user) => <BandingPage user={user} />,
    'piket': (user) => <PiketPage user={user} />,
    'informasi': (user) => <InformasiAkademikPage user={user} />,
    'informasi/kelola': (user) => <InformasiKelolaPage user={user} />,
    'tugas-tambahan': (user) => <TugasTambahanPage />,
    'guru-asuh': (user) => <GuruAsuhPage user={user} />,
    'wali-kelas': (user) => <WaliKelasPage user={user} />,
    'ekstrakurikuler': (user) => <EkskulPembinaPage user={user} />,
    'prestasi': (user) => <PrestasiPage user={user} />,

    'kokurikuler': (user) => <KokurikulerPage user={user} />,

    // KONFIGURASI & PENGATURAN
    'master': (user) => <MasterDataPage user={user} />,
    'form': () => <FormDashboardPage />,
    'form/builder': () => <FormBuilderPage />,
    'form/responses': () => <FormResponsesPage />,
    'Formulir Dinamis': () => <FormDashboardPage />,
    'pengaturan-umum': (user) => <PengaturanUmumPage user={user} />,
    'pengaturan-data': (user) => <DataSettingsPage user={user} />,
    'pengaturan-tugas': (user) => <TaskSettingsPage user={user} />,
    'pengaturan-users': (user) => <UserSettingsPage user={user} />,
    'audit-log': (user) => <AuditLogPage user={user} />,
    'profile': (user, onRefreshUser) => <ProfilePage user={user} onRefreshUser={onRefreshUser} />,
    'ProfileSaya': (user, onRefreshUser) => <ProfilePage user={user} onRefreshUser={onRefreshUser} />,

    // MODUL KHUSUS
    'lckh': (user) => <LckhPage />,
    'lckh-approval': (user) => <LckhApprovalPage />,
    'pembayaran': (user) => <PembayaranPage />,
    'nilai': (user) => <NilaiPage />,
    'izin-guru': (user) => <IzinGuruPage />,
    'surat': (user) => <SuratPage />,
    'surat-daftar': (user) => <DaftarSuratPage />,
    'sanggar-kurikulum': (user) => <SanggarKurikulumPage user={user} />,

    // ALIASES (BACKWARD COMPATIBILITY)
    'IzinGuru': (user) => <IzinGuruPage />,
    'Izin Guru': (user) => <IzinGuruPage />,
    'Dashboard': (user) => <DashboardContent user={user} />,
    'Absensi': (user) => <AbsensiPage />,
    'Ketidakhadiran': (user) => <KetidakhadiranPage />,
    'RekamMedis': (user) => <RekamMedisPage />,
    'Rekam Medis Siswa': (user) => <RekamMedisPage />,
    'Piket': (user) => <PiketPage user={user} />,
    'JurnalGuru': (user) => <JurnalPage user={user} />,
    'TugasTambahan': (user) => <TugasTambahanPage />,
    'Master Data': (user) => <MasterDataPage user={user} />,
    'Pengaturan Data': (user) => <DataSettingsPage user={user} />,
    'Pengaturan Tugas': (user) => <TaskSettingsPage user={user} />,
    'LCKH': (user) => <LckhPage />,
    'LCKHApproval': (user) => <LckhApprovalPage />,
    'Nilai': (user) => <NilaiPage />,
    'GuruAsuh': (user) => <GuruAsuhPage user={user} />,
    'WaliKelas': (user) => <WaliKelasPage user={user} />,

    // REKAP DATA
    'RekapJurnal': () => <RekapJurnalPage />,

    // MONITORING
    'monitoring': () => <MonitoringPage />,
    'kinerja-guru': () => <KinerjaGuruPage />,
    'agenda-madrasah': (user) => <AgendaAkademikPage user={user} />,
    'tampilan-agenda': () => <TampilanAgendaPage />,
    'personal-documents': (user) => <PusatDokumenPage user={user} />,
    'unggah-dokumen': (user) => <PusatDokumenPage user={user} />,
    'dokumen': (user) => <PusatDokumenPage user={user} />,
    'e-supervisi': (user) => <ESupervisiPage user={user} />,
    'observasi-kelas': () => <ObservasiKelasPage />,
    'bimbingan-konseling': (user) => <BimbinganKonselingPage user={user} />,

    // UM & KELULUSAN
    'um-kelulusan': (user) => <UMKelulusanPage />,

    // TUGAS SISWA
    'tugas-siswa': (user) => <TugasSiswaPage user={user as any} />,

    // SURVEY QUIPPER

    // NILAI SISWA
    'nilai-siswa': (user) => <NilaiSiswaPage />,

    // KEUANGAN
    'catatan-keuangan': (user) => <CatatanKeuanganPage />,

    // LAYANAN PTSP
    'layanan-ptsp': (user) => <LayananPTSPPage />,

    // KLINIK PEMBELAJARAN
    'klinik': () => <KlinikPage />,
    'Klinik': () => <KlinikPage />,

    // BANK DATA — ekspor data lintas modul
    'bank-data': () => <BankDataPage />,

    // KEUANGAN MODUL BARU
    'keuangan': (user) => <KeuanganPage user={user} />,
    'Keuangan': (user) => <KeuanganPage user={user} />,

}

export function renderPageContent(page: string, user: User) {
    const staticPage = PAGE_COMPONENTS[page]
    if (staticPage) {
        return (
            <Suspense fallback={
                <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
                    <PageLoader minHeight="auto" />
                </div>
            }>
                {staticPage(user, async () => {
                    window.dispatchEvent(new Event('refresh-user'))
                })}
            </Suspense>
        )
    }

    // Halaman yang tidak terdaftar statis → coba dynamic loading (halaman dari DB)
    return (
        <DynamicPageRenderer pageId={page} user={user} onRefreshUser={async () => {
            window.dispatchEvent(new Event('refresh-user'))
        }} />
    )
}
