'use client'
import { useTabParam } from '@/hooks/useTabParam';

import { useMemo, Suspense } from 'react'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import { Tab, type TabItem } from '@/components/ui/Tab'
import { PageLoader } from '@/components/ui/Spinner'
import SiswaTab from './tabs/SiswaTab'
import GuruTab from './tabs/GuruTab'
import TendikTab from './tabs/TendikTab'
import KelasTab from './tabs/KelasTab'
import RuanganTab from './tabs/RuanganTab'
import MapelTab from './tabs/MapelTab'
import WaktuTab from './tabs/WaktuTab'
import KodeGuruTab from './tabs/KodeGuruTab'
import TahunAjaranTab from './tabs/TahunAjaranTab'
import EkskulTab from './tabs/EkskulTab'
import { useMasterAccess, type MasterAccess, type MasterTab } from '@/lib/use-master-access'
import './master.css'

type TabType = 'tahun_ajaran' | 'siswa' | 'guru' | 'tendik' | 'kode_guru' | 'mapel' | 'kelas' | 'ruangan' | 'waktu' | 'ekskul'

// `hint` hanya tampil di sheet pemilih (mobile, >=4 tab). Isinya sengaja
// deskripsi tetap, bukan hitungan: hitungan butuh query tambahan yang
// dijalankan sebelum tabnya dibuka.
/**
 * Entity wewenang untuk tiap tab UI. Kuncinya harus cocok dengan `MASTER_TAB_ACCESS`
 * di backend, karena dari situlah `/master/my-access` menyusun jawabannya.
 *
 * Tab Guru dan Tendik menunjuk entity yang sama (`guru`): keduanya satu tabel,
 * dibedakan hanya oleh kolom `jenis_pegawai`.
 */
const TAB_ENTITY: Record<TabType, MasterTab> = {
  tahun_ajaran: 'tahun-ajaran',
  siswa: 'siswa',
  guru: 'guru',
  tendik: 'guru',
  kode_guru: 'kode-guru',
  mapel: 'mapel',
  kelas: 'kelas',
  ruangan: 'ruangan',
  waktu: 'waktu',
  ekskul: 'ekskul',
}

const tabs: TabItem<TabType>[] = [
  { key: 'tahun_ajaran', label: 'Tahun Ajaran', icon: 'calendar', hint: 'Tahun & semester aktif' },
  { key: 'siswa', label: 'Siswa', icon: 'users', hint: 'Data induk siswa' },
  { key: 'guru', label: 'Guru', icon: 'user-round-pen', hint: 'Data induk tenaga pendidik' },
  { key: 'tendik', label: 'Tendik', icon: 'briefcase-business', hint: 'Data induk pegawai non guru' },
  { key: 'kode_guru', label: 'Kode Guru', icon: 'user-cog', hint: 'Kode singkat untuk jadwal' },
  { key: 'mapel', label: 'Mapel', icon: 'book-open', hint: 'Mata pelajaran & kelompoknya' },
  { key: 'kelas', label: 'Kelas', icon: 'school', hint: 'Rombel, tingkat, dan ruang' },
  { key: 'ruangan', label: 'Ruangan', icon: 'door-open', hint: 'Daftar ruangan & lokasi' },
  { key: 'waktu', label: 'Waktu', icon: 'clock', hint: 'Jam pelajaran & bel' },
  { key: 'ekskul', label: 'Ekstrakurikuler', shortLabel: 'Ekskul', icon: 'volleyball', hint: 'Daftar ekskul & pembina' },
]

function TabContent({ user, akses }: { user?: any; akses: MasterAccess }) {
  /**
   * Hanya tab yang wewenangnya dipegang yang ditampilkan.
   *
   * Sebelumnya kesembilan tab selalu dirender dan gerbangnya hanya menyembunyikan
   * tombol, jadi pemegang satu tab tetap melihat delapan tab lain berisi data yang
   * tidak boleh ia kelola. Server tetap penentunya — ini menyelaraskan tampilan
   * dengan yang sudah ditegakkan di sana.
   */
  const tabTampil = useMemo(
    () => tabs.filter((t) => akses.boleh(TAB_ENTITY[t.key])),
    [akses],
  )
  const kunciTampil = useMemo(() => tabTampil.map((t) => t.key), [tabTampil])

  const [activeTab, setActiveTab] = useTabParam<TabType>(
    kunciTampil[0] ?? 'tahun_ajaran',
    kunciTampil.length > 0 ? kunciTampil : ['tahun_ajaran'],
  )

  return (
    <MaintenanceBanner pageKey="maintenance_master">
      <div className="md-page">
        {/* Header */}
        

        {/* Tabs — slider pill (4 tab terlihat di mobile, sisanya digeser).
            `syncSubtitle` sengaja tidak dipakai: tab bar sekarang ikut tampil
            di mobile, jadi label tab aktif sudah terbaca di layar dan tidak
            perlu digandakan ke subjudul header. */}
        <Tab
          tabs={tabTampil}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="Master Data Tabs"
          variant="slider"
        />

        <div className="md-content" role="tabpanel">
          {activeTab === 'siswa' && <SiswaTab user={user} />}
          {activeTab === 'guru' && <GuruTab user={user} />}
          {activeTab === 'tendik' && <TendikTab user={user} />}
          {activeTab === 'kode_guru' && <KodeGuruTab user={user} />}
          {activeTab === 'mapel' && <MapelTab user={user} />}
          {activeTab === 'kelas' && <KelasTab user={user} />}
          {activeTab === 'ruangan' && <RuanganTab user={user} />}
          {activeTab === 'waktu' && <WaktuTab user={user} />}
          {activeTab === 'tahun_ajaran' && <TahunAjaranTab user={user} />}
          {activeTab === 'ekskul' && <EkskulTab user={user} />}
        </div>
      </div>
    </MaintenanceBanner>
  )
}

/**
 * Gerbang halaman Master Data — SENGAJA di komponen ini, bukan di route.
 *
 * Halaman ini punya DUA jalur render: `app/(dashboard)/master/page.tsx` dan
 * registry SPA lama (`components/page-registry.tsx`, masih dipakai route
 * catch-all `[...pageId]`). Menaruh gerbang di salah satu route saja menyisakan
 * jalur lain terbuka, jadi pemeriksaannya diletakkan di sini supaya berlaku untuk
 * semuanya.
 *
 * Hanya role ADMIN yang melekat di kode; pengelola tiap tab ditunjuk lewat
 * Pengaturan Users → Hak Akses Fitur. Halaman terbuka bagi siapa pun yang
 * memegang minimal satu tab, dan tab yang tidak dipegang tidak ditampilkan.
 *
 * Penjaga ini bersifat tampilan; yang menentukan tetap server. Rangka halaman
 * memang tidak memuat data — semuanya diambil lewat API yang sudah bergerbang —
 * tapi membiarkannya terbuka tetap membocorkan struktur dan memberi kesan
 * halaman ini boleh dibuka.
 */
export default function MasterDataPage({ user }: { user?: any }) {
  const akses = useMasterAccess()

  if (akses.memuat) return <PageLoader variant="trace" size={56} />

  if (!akses.adaAkses) {
    return (
      <div className="md-page">
        <div
          role="alert"
          style={{
            margin: '2rem auto',
            maxWidth: 520,
            padding: '1.5rem',
            textAlign: 'center',
            border: '1px solid var(--n-border, #e5e7eb)',
            borderRadius: 12,
          }}
        >
          <i className="bi bi-shield-lock" style={{ fontSize: '2rem', color: 'var(--n-muted, #6b7280)' }} />
          <h2 style={{ margin: '0.75rem 0 0.5rem', fontSize: '1.1rem' }}>
            Halaman ini tidak dapat diakses
          </h2>
          <p style={{ margin: 0, color: 'var(--n-muted, #6b7280)', fontSize: '0.9rem' }}>
            Master Data hanya untuk Admin. Bila Anda memang perlu mengelola salah satu
            bagiannya, minta Admin menunjuk akun atau role Anda di{' '}
            <strong>Pengaturan Users → Hak Akses Fitur</strong> pada bagian
            <strong> Master Data</strong> yang sesuai.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<PageLoader variant="trace" size={56} />}>
      <TabContent user={user} akses={akses} />
    </Suspense>
  )
}

