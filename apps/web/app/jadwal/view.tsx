'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTimezone } from '@/hooks/use-timezone'
import { useTabParam } from '@/hooks/useTabParam'
import type { User } from '@/lib/types'
import MaintenanceBanner from '@/components/MaintenanceBanner'

import { Tab } from '@/components/ui/Tab'
import JadwalLengkapModal from './components/JadwalLengkapModal'
import TukarJadwalModal from './components/TukarJadwalModal'
import JadwalPbmTab from './tabs/JadwalPbmTab'
import JadwalPiketTab from './tabs/JadwalPiketTab'
import GeneratePbmTab from './tabs/GeneratePbmTab'
import GeneratePiketTab from './tabs/GeneratePiketTab'
import TukarJadwalTab from './tabs/TukarJadwalTab'
import JadwalSiswaTab from './tabs/JadwalSiswaTab'
import { CalendarCheck, ArrowLeftRight } from 'lucide-react'
import { DesktopFab } from '@/components/ui/DesktopFab'
import './jadwal.css'

type JadwalTab = 'mengajar' | 'piket' | 'generate_pbm' | 'generate_piket' | 'tukar'
const JADWAL_TABS = ['mengajar', 'piket', 'generate_pbm', 'generate_piket', 'tukar'] as const

const WEEK = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

const jamNum = (v: unknown) => parseInt(String(v ?? ''), 10) || 0
const hariIdx = (h: unknown) => {
  const i = WEEK.indexOf(String(h ?? ''))
  return i === -1 ? WEEK.length : i
}

/** Urutkan sekali di sini supaya tab-tab tampilan tidak perlu menyortir ulang. */
const urutkanPekan = (rows: any[]) =>
  [...rows].sort((a, b) => hariIdx(a.hari) - hariIdx(b.hari) || jamNum(a.jam_ke) - jamNum(b.jam_ke))

interface HasilMuat { kunci: string; rows: any[] }
const KOSONG: HasilMuat = { kunci: '', rows: [] }
const TIDAK_ADA: any[] = []

async function ambilData(url: string, konteks: string): Promise<any[]> {
  try {
    const res = await fetch(url)
    const json = await res.json()
    return json?.ok && Array.isArray(json.data) ? json.data : []
  } catch (e) {
    console.error(`[JADWAL] Gagal memuat ${konteks}:`, e)
    return []
  }
}

export default function JadwalPage({ user }: { user: User }) {
  const [showFull, setShowFull] = useState(false)
  const [fullType, setFullType] = useState<'mengajar' | 'piket'>('mengajar')
  const [showTukarModal, setShowTukarModal] = useState(false)

  // Hasil pemuatan disimpan bersama `kunci` permintaannya. Dengan begitu status
  // "sedang memuat" cukup diturunkan dari perbandingan kunci — tidak perlu flag
  // loading terpisah yang harus di-set ulang di awal tiap effect.
  const [hasilJadwal, setHasilJadwal] = useState<HasilMuat>(KOSONG)
  const [hasilPiket, setHasilPiket] = useState<HasilMuat>(KOSONG)
  const [liburHariIni, setLiburHariIni] = useState<any[]>([])
  const [siswaKelas, setSiswaKelas] = useState<{ selesai: boolean; nilai: string }>(
    { selesai: false, nilai: '' }
  )
  const [tukarBadge, setTukarBadge] = useState(0)
  const [activeSiswaTab, setActiveSiswaTab] = useState<'mengajar' | 'piket'>('mengajar')
  /** Dinaikkan untuk memaksa badge tukar dimuat ulang. */
  const [tukarNonce, setTukarNonce] = useState(0)
  const [jadwalNonce, setJadwalNonce] = useState(0)
  useEffect(() => {
    const reload = () => setJadwalNonce(n => n + 1)
    window.addEventListener('acca:jadwal-updated', reload)
    return () => window.removeEventListener('acca:jadwal-updated', reload)
  }, [])

  const [activeJadwalTab, setActiveJadwalTab] = useTabParam<JadwalTab>('mengajar', JADWAL_TABS)

  // `timezone` baru terisi setelah fetch pengaturan situs selesai; menghitung
  // "hari ini" sebelum itu memakai zona default dan hasilnya tidak pernah
  // diperbaiki, jadi semua pemuatan menunggu `tzLoading` selesai.
  const { getCurrentDate, getDayName, loading: tzLoading } = useTimezone()

  const roles = (user?.roles?.length ? user.roles : String(user?.role || '').split(/[,|]/))
    .map(r => String(r).trim().toUpperCase())
    .filter(Boolean)
  const isSiswa = roles.includes('SISWA')

  // Hak kelola jadwal ditentukan server (role ADMIN, atau role/pengguna yang
  // ditunjuk admin di Pengaturan Users → Hak Akses Fitur), bukan ditebak dari
  // daftar role di sini — supaya tab yang tampil selalu sama dengan yang
  // diizinkan guard backend.
  const [bolehGenerate, setBolehGenerate] = useState(false)

  useEffect(() => {
    if (isSiswa) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/jadwal/izin-saya')
        const json = await res.json()
        if (!cancelled && json?.ok) setBolehGenerate(!!json.data?.bolehGenerate)
      } catch (e) {
        console.warn('[JADWAL] Gagal memuat hak akses:', e)
      }
    })()
    return () => { cancelled = true }
  }, [isSiswa])

  const hariIni = tzLoading ? '' : getDayName()
  const tanggalHariIni = tzLoading ? '' : getCurrentDate()

  // Tab yang benar-benar boleh dibuka user ini.
  const kunciTab = bolehGenerate ? JADWAL_TABS.join() : 'mengajar,piket,tukar'
  const tabTersedia = useMemo(
    () => kunciTab.split(',') as JadwalTab[],
    [kunciTab]
  )
  // Melindungi dari ?tab=generate_pbm yang diketik langsung di URL.
  const tabAktif: JadwalTab = tabTersedia.includes(activeJadwalTab) ? activeJadwalTab : 'mengajar'

  // ── Event dari BottomNav / Action Sheet ────────────────────────────────────
  useEffect(() => {
    const bukaJadwalLengkap = (e: any) => {
      setFullType(e?.detail === 'piket' ? 'piket' : 'mengajar')
      setShowFull(true)
    }
    const bukaTukar = () => setShowTukarModal(true)
    window.addEventListener('acca:open-jadwal-lengkap' as any, bukaJadwalLengkap)
    window.addEventListener('acca:open-tukar-modal' as any, bukaTukar)
    return () => {
      window.removeEventListener('acca:open-jadwal-lengkap' as any, bukaJadwalLengkap)
      window.removeEventListener('acca:open-tukar-modal' as any, bukaTukar)
    }
  }, [])

  useEffect(() => {
    const pindahTab = (e: any) => {
      if (tabTersedia.includes(e.detail)) setActiveJadwalTab(e.detail)
    }
    window.addEventListener('acca:switch-page-tab' as any, pindahTab)
    return () => window.removeEventListener('acca:switch-page-tab' as any, pindahTab)
  }, [setActiveJadwalTab, tabTersedia])

  // Tab & tombol aksi di header/BottomNav — hanya untuk guru; siswa memakai
  // pemilih tab-nya sendiri di dalam <JadwalSiswaTab>.
  useEffect(() => {
    if (isSiswa) return

    const label: Record<JadwalTab, { label: string; icon: string }> = {
      mengajar: { label: 'Jadwal PBM', icon: 'calendar-check' },
      piket: { label: 'Jadwal Piket', icon: 'calendar-check' },
      generate_pbm: { label: 'Generate PBM', icon: 'file-spreadsheet' },
      generate_piket: { label: 'Generate Piket', icon: 'file-spreadsheet' },
      tukar: { label: 'Tukar Jadwal', icon: 'arrow-left-right' },
    }
    window.dispatchEvent(new CustomEvent('acca:page-tabs', {
      detail: tabTersedia.map(id => ({ id, ...label[id], active: tabAktif === id, isCustom: true }))
    }))

    const aksi =
      tabAktif === 'mengajar' ? { label: 'Semua', icon: 'file-spreadsheet', eventName: 'acca:open-jadwal-lengkap', detail: 'mengajar' } :
      tabAktif === 'piket' ? { label: 'Semua', icon: 'file-spreadsheet', eventName: 'acca:open-jadwal-lengkap', detail: 'piket' } :
      tabAktif === 'tukar' ? { label: 'Ajukan', icon: 'send', eventName: 'acca:open-tukar-modal' } :
      null
    window.dispatchEvent(new CustomEvent('acca:set-page-action', { detail: aksi }))

    return () => {
      window.dispatchEvent(new CustomEvent('acca:page-tabs', { detail: [] }))
      window.dispatchEvent(new CustomEvent('acca:set-page-action', { detail: null }))
    }
  }, [tabAktif, isSiswa, tabTersedia])

  // ── Libur hari ini ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tanggalHariIni) return
    let cancelled = false
    ;(async () => {
      const data = await ambilData(
        `/api/settings/libur?tahun=${tanggalHariIni.slice(0, 4)}`, 'data libur'
      )
      if (cancelled) return
      setLiburHariIni(data.filter((l: any) => String(l.tanggal || '').slice(0, 10) === tanggalHariIni))
    })()
    return () => { cancelled = true }
  }, [tanggalHariIni])

  // ── Kelas siswa (SISWA / orang tua) ────────────────────────────────────────
  const nisnSiswa = isSiswa ? (user?.nip || user?.username || '') : ''

  useEffect(() => {
    if (!nisnSiswa || !tanggalHariIni) return
    let cancelled = false
    ;(async () => {
      // Tahun ajaran aktif bisa 2 baris (Ganjil & Genap) sekaligus.
      const tahunAjaran = await ambilData('/api/admin/tahun-ajaran', 'tahun ajaran')
      let targetYears = [...new Set(
        tahunAjaran.filter((t: any) => t.is_active).map((t: any) => t.tahun_ajaran)
      )] as string[]

      // Di masa transisi tahun ajaran, siswa punya enrollment di tahun LAMA dan
      // BARU sekaligus. Pakai tahun ajaran BERJALAN saja agar kelas lama tidak
      // ikut muncul; kelas peminatan tahun berjalan tetap ikut.
      if (targetYears.length > 1) {
        const [cy, cm] = tanggalHariIni.split('-').map(Number)
        const tahunBerjalan = cm >= 7 ? `${cy}/${cy + 1}` : `${cy - 1}/${cy}`
        targetYears = targetYears.includes(tahunBerjalan)
          ? [tahunBerjalan]
          : [[...targetYears].sort((a, b) => b.localeCompare(a))[0]]
      }

      const cariKelas = async (nisn: string) => {
        const data = await ambilData(
          `/api/settings/siswa-kelas?q=${encodeURIComponent(nisn)}`, 'kelas siswa'
        )
        return data.filter((d: any) => {
          const dNisn = String(d.nisn || '').trim()
          const cocok =
            dNisn === nisn ||
            dNisn === nisn.padStart(10, '0') ||
            dNisn.replace(/^0+/, '') === nisn.replace(/^0+/, '')
          return cocok && (targetYears.length === 0 || targetYears.includes(d.tahun_ajaran))
        })
      }

      let data = await cariKelas(nisnSiswa)
      if (data.length === 0 && /^\d+$/.test(nisnSiswa) && nisnSiswa.length < 10) {
        data = await cariKelas(nisnSiswa.padStart(10, '0'))
      }

      const classes = [...new Set(data.map((d: any) => d.kelas).filter(Boolean))] as string[]
      // Ditandai selesai walau tidak ketemu, supaya tampilan berhenti memuat
      // dan menampilkan "tidak ada jadwal" alih-alih spinner terus-menerus.
      if (!cancelled) setSiswaKelas({ selesai: true, nilai: classes.join(',') })
    })()
    return () => { cancelled = true }
  }, [nisnSiswa, tanggalHariIni])

  // ── Jadwal PBM & Piket sepekan ─────────────────────────────────────────────
  // Satu permintaan per jenis, tanpa parameter `hari`: pengelompokan per hari
  // dan penyaringan "hari ini" dilakukan di sini. Sebelumnya tiap hari diambil
  // dalam permintaan terpisah (7 permintaan × 2 daftar × 2 jenis = 16 request
  // tiap kali halaman dibuka) padahal jawabannya identik.
  const idPemilik = isSiswa ? siswaKelas.nilai : (user?.nip || '')
  const pemilik = `${isSiswa ? 'kelas' : 'nip'}=${encodeURIComponent(idPemilik)}`
  const pemilikPiket = `${isSiswa ? 'kelas' : 'guru'}=${encodeURIComponent(idPemilik)}`

  const siapDimuat = !tzLoading && !!idPemilik
  const kunciJadwal = siapDimuat ? `${pemilik}@${tanggalHariIni}@${jadwalNonce}` : ''
  const kunciPiket = siapDimuat ? `${pemilikPiket}@${tanggalHariIni}` : ''

  // Tidak ada yang bisa dimuat (guru tanpa NIP, atau kelas siswa tidak
  // ditemukan) — berhenti memuat, tampilkan keadaan kosong.
  const takAdaSumber = !tzLoading && !idPemilik && (isSiswa ? siswaKelas.selesai : true)

  useEffect(() => {
    if (!kunciJadwal) return
    let cancelled = false
    ;(async () => {
      const data = await ambilData(
        `/api/jadwal?${pemilik}&valid_date=${tanggalHariIni}`, 'jadwal PBM'
      )
      if (!cancelled) setHasilJadwal({ kunci: kunciJadwal, rows: urutkanPekan(data) })
    })()
    return () => { cancelled = true }
  }, [kunciJadwal, pemilik, tanggalHariIni])

  useEffect(() => {
    if (!kunciPiket) return
    let cancelled = false
    ;(async () => {
      const data = await ambilData(
        `/api/settings/jadwal-piket?${pemilikPiket}&as_of=${tanggalHariIni}`, 'jadwal piket'
      )
      if (!cancelled) setHasilPiket({ kunci: kunciPiket, rows: urutkanPekan(data) })
    })()
    return () => { cancelled = true }
  }, [kunciPiket, pemilikPiket, tanggalHariIni])

  // Data dianggap "sedang dimuat" selama hasil yang tersimpan belum berasal
  // dari permintaan yang sedang berlaku.
  const jadwalSiap = takAdaSumber || (!!kunciJadwal && hasilJadwal.kunci === kunciJadwal)
  const piketSiap = takAdaSumber || (!!kunciPiket && hasilPiket.kunci === kunciPiket)
  const jadwalPekan = jadwalSiap && kunciJadwal ? hasilJadwal.rows : TIDAK_ADA
  const piketPekan = piketSiap && kunciPiket ? hasilPiket.rows : TIDAK_ADA

  const jadwalHariIni = useMemo(
    () => jadwalPekan.filter(j => j.hari === hariIni), [jadwalPekan, hariIni]
  )
  const piketHariIni = useMemo(
    () => piketPekan.filter(j => j.hari === hariIni), [piketPekan, hariIni]
  )

  // ── Subtitle "Berlaku mulai …" di header ───────────────────────────────────
  useEffect(() => {
    const sumber = [...jadwalPekan, ...piketPekan].find(j => j?.berlaku_mulai)?.berlaku_mulai
    const tampil = sumber && !['tukar', 'generate_pbm', 'generate_piket'].includes(tabAktif)
      ? `Berlaku mulai ${new Date(sumber + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : null
    window.dispatchEvent(new CustomEvent('acca:set-page-subtitle', { detail: tampil }))
    return () => {
      window.dispatchEvent(new CustomEvent('acca:set-page-subtitle', { detail: null }))
    }
  }, [jadwalPekan, piketPekan, tabAktif])

  // ── Badge jumlah pengajuan tukar yang menunggu tindakan ────────────────────
  const perluBadge = !isSiswa && !!user?.nip
  const muatUlangBadge = useCallback(() => setTukarNonce(n => n + 1), [])

  useEffect(() => {
    if (!perluBadge) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tukar-jadwal')
        const json = await res.json()
        if (cancelled || !json?.ok) return
        setTukarBadge((json.data.masuk?.length || 0) + (json.data.perluWkm?.length || 0))
      } catch (e) {
        console.warn('[JADWAL] Gagal memuat ringkasan tukar jadwal:', e)
      }
    })()
    return () => { cancelled = true }
  }, [perluBadge, tukarNonce])

  const isToday = useCallback((hari: string) => hari === hariIni, [hariIni])

  // Urutan tampilan pekan: mulai besok, mengelilingi pekan, berakhir di hari ini.
  const getWeekOrder = useCallback(() => {
    const todayIdx = WEEK.indexOf(hariIni)
    if (todayIdx === -1) return WEEK
    return [...WEEK.slice(todayIdx + 1), ...WEEK.slice(0, todayIdx + 1)]
  }, [hariIni])

  return (
    <div className="db">
      <JadwalLengkapModal open={showFull} onClose={() => setShowFull(false)} type={fullType} />

      <TukarJadwalModal
        open={showTukarModal}
        onClose={() => setShowTukarModal(false)}
        nip={user.nip}
        onSubmitted={() => {
          setActiveJadwalTab('tukar')
          muatUlangBadge()
          // Beri tahu tab Tukar bila ia sudah terpasang — pindah tab saja tidak
          // memuat ulang daftarnya kalau tab itu sedang aktif.
          window.dispatchEvent(new CustomEvent('acca:tukar-jadwal-updated'))
        }}
      />

      {!isSiswa && (
        <Tab
          tabs={[
            { key: 'mengajar' as const, label: 'Jadwal PBM', shortLabel: 'PBM', icon: 'calendar-check-fill' },
            { key: 'piket' as const, label: 'Jadwal Piket', shortLabel: 'Piket', icon: 'calendar-check-fill' },
            { key: 'generate_pbm' as const, label: 'Generate PBM', shortLabel: 'Gen PBM', icon: 'file-earmark-spreadsheet' },
            { key: 'generate_piket' as const, label: 'Generate Piket', shortLabel: 'Gen Piket', icon: 'shield-check' },
            { key: 'tukar' as const, label: 'Tukar Jadwal', shortLabel: 'Tukar', icon: 'arrow-left-right', hint: tukarBadge > 0 ? `${tukarBadge} menunggu` : undefined },
          ].filter(t => tabTersedia.includes(t.key))}
          activeTab={tabAktif}
          onChange={setActiveJadwalTab}
          ariaLabel="Tab Jadwal Guru"
          variant="slider"
        />
      )}

      {!isSiswa && tabAktif === 'mengajar' && (
        <JadwalPbmTab
          jadwalHariIni={jadwalHariIni}
          jadwalMingguIni={jadwalPekan}
          liburHariIni={liburHariIni}
          loadingJadwal={!jadwalSiap}
          getWeekOrder={getWeekOrder}
          isToday={isToday}
        />
      )}

      {!isSiswa && tabAktif === 'piket' && (
        <JadwalPiketTab
          jadwalPiketHariIni={piketHariIni}
          jadwalPiketMingguIni={piketPekan}
          liburHariIni={liburHariIni}
          loadingPiket={!piketSiap}
          getWeekOrder={getWeekOrder}
          isToday={isToday}
        />
      )}

      {!isSiswa && tabAktif === 'tukar' && (
        <TukarJadwalTab onChanged={muatUlangBadge} />
      )}

      {bolehGenerate && tabAktif === 'generate_pbm' && <GeneratePbmTab user={user} bolehKelola={bolehGenerate} />}
      {bolehGenerate && tabAktif === 'generate_piket' && <GeneratePiketTab bolehKelola={bolehGenerate} />}

      {isSiswa && (
        <JadwalSiswaTab
          activeSiswaTab={activeSiswaTab}
          setActiveSiswaTab={setActiveSiswaTab}
          jadwalHariIni={jadwalHariIni}
          jadwalMingguIni={jadwalPekan}
          siswaPiketHariIni={piketHariIni}
          siswaPiketMingguIni={piketPekan}
          liburHariIni={liburHariIni}
          loadingJadwal={!jadwalSiap}
          loadingSiswaPiket={!piketSiap}
          getWeekOrder={getWeekOrder}
          isToday={isToday}
        />
      )}

      <MaintenanceBanner pageKey="maintenance_jadwal" />

      {/* Desktop FAB — gaya & animasinya dari <DesktopFab> bersama */}
      {!isSiswa && tabAktif === 'mengajar' && (
        <DesktopFab
          label="Jadwal PBM Lengkap"
          mobileLabel="Semua"
          icon={<CalendarCheck size={20} />}
          mobileIcon="calendar-check"
          onClick={() => { setFullType('mengajar'); setShowFull(true) }}
        />
      )}
      {!isSiswa && tabAktif === 'piket' && (
        <DesktopFab
          label="Jadwal Piket Lengkap"
          mobileLabel="Semua"
          icon={<CalendarCheck size={20} />}
          mobileIcon="calendar-check"
          onClick={() => { setFullType('piket'); setShowFull(true) }}
        />
      )}
      {!isSiswa && tabAktif === 'tukar' && (
        <DesktopFab
          label="Ajukan Tukaran"
          mobileLabel="Ajukan"
          icon={<ArrowLeftRight size={20} />}
          mobileIcon="arrow-left-right"
          onClick={() => setShowTukarModal(true)}
        />
      )}
    </div>
  )
}
