import { MENU_GROUPS, PAGE_LABELS, type MenuGroupDef } from './sidebar-menu'
import { getRequirement } from './page-requirements'

export type ActionLevel = 'view' | 'edit' | 'manage' | 'none'

export interface PageUsageDetail {
  pageId: string
  title: string
  groupKey: string
  groupLabel: string
  groupIcon: string
  actionLevel: ActionLevel
  actionLabel: string
  functionDescription: string
  isMenuAssigned: boolean
  isFunctional: boolean
}

export interface RoleUsageGroup {
  key: string
  label: string
  icon: string
  pages: PageUsageDetail[]
}

export interface RoleUsageAnalysis {
  roleName: string
  totalDetectedPages: number
  assignedMenuPagesCount: number
  groups: RoleUsageGroup[]
  primaryCategorySummary: string
  highestActionLevel: ActionLevel
  isSuperAdmin: boolean
  isKnownRole: boolean
  specialNotes?: string[]
}

/**
 * Knowledge Base: Spesifikasi detail fungsi per role pada setiap halaman.
 * Jika role tidak secara eksplisit tercatat di sini, sistem menggunakan fallback cerdas dari PAGE_ROLE_REQUIREMENTS.
 */
const ROLE_FUNCTION_DESCRIPTIONS: Record<string, Record<string, { action?: ActionLevel; desc: string }>> = {
  ADMIN: {
    '*': { action: 'manage', desc: 'Hak akses penuh (Superuser): Kelola seluruh data, konfigurasi modul, approval, import/export, dan audit log.' }
  },
  ADMINISTRATOR: {
    '*': { action: 'manage', desc: 'Hak akses penuh (Superuser): Kelola seluruh data, konfigurasi modul, approval, import/export, dan audit log.' }
  },
  GURU: {
    'dashboard': { action: 'view', desc: 'Melihat ringkasan jadwal mengajar, pengumuman, dan statistik aktivitas harian.' },
    'informasi': { action: 'view', desc: 'Melihat rilis berita, agenda madrasah, dan informasi internal.' },
    'pengumuman': { action: 'view', desc: 'Membaca pengumuman resmi dan lampiran surat edaran.' },
    'jurnal': { action: 'edit', desc: 'Mengisi materi pembelajaran, tujuan pembelajaran, dan presensi siswa per jam tatap muka.' },
    'jurnal-banding': { action: 'edit', desc: 'Mengajukan banding revisi presensi/jurnal yang terkunci.' },
    'absensi': { action: 'edit', desc: 'Input kehadiran siswa (Hadir/Sakit/Izin/Alpa) saat sesi pembelajaran.' },
    'nilai': { action: 'edit', desc: 'Input & rekap nilai tugas, formatif, sumatif, PTS, dan PAS sesuai mapel yang diampu.' },
    'piket': { action: 'view', desc: 'Melihat jadwal piket & mengisi laporan rekap ketertiban/kejadian harian piket.' },
    'jadwal': { action: 'view', desc: 'Melihat jadwal PBM mingguan & plotting ruangan kelas.' },
    'agenda-madrasah': { action: 'view', desc: 'Melihat kalender akademik madrasah dan agenda kegiatan bersama.' },
    'izin-guru': { action: 'edit', desc: 'Mengajukan surat permohonan izin cuti / dinas luar / ketidakhadiran kerja.' },
    'lckh': { action: 'edit', desc: 'Pengisian Laporan Capaian Kinerja Harian (LCKH) dan cetak lampiran kegiatan.' },
    'sanggar-kurikulum': { action: 'view', desc: 'Melihat & berpartisipasi dalam agenda sanggar pengembangan kurikulum.' },
    'ketidakhadiran': { action: 'edit', desc: 'Melihat dan mengajukan surat ketidakhadiran siswa di jam mengajar.' },
    'rekam-medis': { action: 'view', desc: 'Melihat catatan kesehatan siswa jika memerlukan penanganan khusus saat PBM.' },
    'guru-asuh': { action: 'view', desc: 'Melihat dan menginput laporan pembinaan asrama siswa asuh.' },
    'klinik': { action: 'edit', desc: 'Membuka slot bimbingan materi klinik dan input laporan perkembangan siswa.' },
    'dokumen': { action: 'edit', desc: 'Pusat Dokumen: Mengunggah berkas akademis/sekolah, penyimpanan dokumen pribadi, serta kelola dokumen per kelas.' },
    'permintaan-surat': { action: 'view', desc: 'Mengajukan permohonan surat tugas / surat pengantar kedinasan.' },
  },
  WALI_KELAS: {
    'wali-kelas': { action: 'manage', desc: 'Dashboard wali kelas: Rekapitulasi perkembangan kelas binaan, catatan khusus, dan data siswa.' },
    'absensi': { action: 'view', desc: 'Monitoring rekap absensi harian dan bulanan seluruh siswa di kelas binaan.' },
    'nilai': { action: 'view', desc: 'Memantau keterisian dan distribusi nilai rapor seluruh mapel di kelas binaan.' },
    'ketidakhadiran': { action: 'view', desc: 'Memeriksa surat izin, dispensasi, dan rekap ketidakhadiran siswa perwalian.' },
    'rekam-medis': { action: 'view', desc: 'Memantau riwayat sakit dan catatan penanganan medis UKS siswa kelas binaan.' },
    'permintaan-surat': { action: 'view', desc: 'Membantu verifikasi permohonan surat keterangan aktif siswa perwalian.' },
    'dokumen': { action: 'view', desc: 'Memantau kelengkapan unggahan dokumen berkas siswa kelasnya di Pusat Dokumen.' },
    'dashboard': { action: 'view', desc: 'Melihat ringkasan perkembangan kelas binaan dan pengumuman madrasah.' },
  },
  SISWA: {
    'dashboard': { action: 'view', desc: 'Portal siswa: Ringkasan jadwal belajar harian, agenda kelas, dan pengumuman.' },
    'nilai-siswa': { action: 'view', desc: 'Melihat transkrip capaian nilai tugas, asesmen, dan rapor pribadi.' },
    'tugas-siswa': { action: 'view', desc: 'Menerima penugasan dari guru, mengunggah tugas jawaban, dan melihat feedback.' },
    'kokurikuler': { action: 'view', desc: 'Melihat capaian projek P5 / Kokurikuler dan dimensi profil pelajar.' },
    'ekstrakurikuler': { action: 'edit', desc: 'Pendaftaran kegiatan ekstrakurikuler dan memantau agenda latihan.' },
    'ketidakhadiran': { action: 'edit', desc: 'Pengajuan izin/sakit, cetak surat ACCA, dan melihat statistik kehadiran diri sendiri.' },
    'permintaan-surat': { action: 'view', desc: 'Mengajukan permohonan surat keterangan aktif madrasah / rekomendasi.' },
    'dokumen': { action: 'edit', desc: 'Mengunggah kelengkapan berkas biodata, KK, dokumen pendaftaran, dan penyimpanan dokumen pribadi.' },
    'cbt-app': { action: 'view', desc: 'Akses langsung ke ruang ujian online Computer Based Test (CBT).' },
  },
  KAMAD: {
    'e-supervisi': { action: 'edit', desc: 'Melakukan supervisi akademik, observasi kelas, dan evaluasi hasil kinerja PBM guru.' },
    'lckh-approval': { action: 'manage', desc: 'Verifikasi & menyetujui (approval) laporan capaian kinerja harian guru/pegawai.' },
    'monitoring': { action: 'view', desc: 'Memantau metrik keterisian jurnal, kehadiran guru/siswa, dan rekapitulasi madrasah.' },
    'rekap-jurnal': { action: 'view', desc: 'Memantau rekap progres mengajar seluruh guru madrasah.' },
    'kinerja-guru': { action: 'view', desc: 'Melihat evaluasi komprehensif performa dan kedisiplinan guru.' },
  },
  SUPERVISOR: {
    'e-supervisi': { action: 'edit', desc: 'Melakukan penilaian observasi pembelajaran guru di kelas sesuai instrumen supervisi.' },
    'observasi-kelas': { action: 'edit', desc: 'Mencatat temuan observasi dan memberikan feedback penguatan PBM.' },
  },
  PENGAWAS_MADRASAH: {
    'e-supervisi': { action: 'edit', desc: 'Supervisi manajerial & akademik madrasah serta rekap penilaian standar pendidik.' },
  },
  WKM_AKADEMIK: {
    'lckh-approval': { action: 'manage', desc: 'Review dan verifikasi laporan LCKH guru rumpun akademik/kurikulum.' },
    'agenda-madrasah': { action: 'manage', desc: 'Mengatur jadwal kalender akademik dan agenda kegiatan pembelajaran madrasah.' },
    'sanggar-kurikulum': { action: 'manage', desc: 'Mengelola materi kurikulum, silabus gabungan, dan agenda sanggar mapel.' },
    'master': { action: 'view', desc: 'Memantau master struktur kurikulum, alokasi kelas, dan mata pelajaran.' },
  },
  WKM_KESISWAAN: {
    'ketidakhadiran': { action: 'manage', desc: 'Monitoring rekap kedisiplinan, izin dispensasi lomba/kegiatan, dan absensi massal.' },
    'prestasi': { action: 'manage', desc: 'Validasi capaian prestasi kejuaraan siswa dan sertifikat penghargaan lomba.' },
    'ekstrakurikuler': { action: 'manage', desc: 'Mengelola plotting pembina ekskul, jadwal kegiatan, dan evaluasi capaian ekskul.' },
    'bimbingan-konseling': { action: 'view', desc: 'Koordinasi penanganan kedisiplinan dan program pembinaan karakter siswa.' },
    'lckh-approval': { action: 'manage', desc: 'Approval laporan LCKH pembina kesiswaan dan staf terkait.' },
  },
  WKM_KEASRAMAAN: {
    'guru-asuh': { action: 'manage', desc: 'Monitoring pelaksanaan program guru asuh, mentoring santri, dan laporan asrama.' },
    'rekam-medis': { action: 'view', desc: 'Memantau kondisi kesehatan santri/siswa asrama.' },
  },
  WKM_HUMAS: {
    'pengumuman': { action: 'manage', desc: 'Publikasi siaran pers, pengumuman madrasah, dan informasi ke publik.' },
    'layanan-ptsp': { action: 'view', desc: 'Memantau arus permohonan layanan publik dan kepuasan masyarakat.' },
  },
  BK: {
    'bimbingan-konseling': { action: 'manage', desc: 'Pencatatan sesi konseling, penanganan kasus siswa, bimbingan karir, & home visit.' },
    'ketidakhadiran': { action: 'view', desc: 'Memantau siswa dengan ketidakhadiran tinggi untuk tindak lanjut pembinaan BK.' },
    'rekam-medis': { action: 'view', desc: 'Melihat riwayat kesehatan yang berpengaruh pada kondisi psikologis/kehadiran siswa.' },
  },
  BENDAHARA: {
    'pembayaran': { action: 'manage', desc: 'Pengelolaan pencairan honorarium guru asuh, transport kegiatan, & bukti bayar.' },
    'keuangan': { action: 'manage', desc: 'Pencatatan kas masuk/keluar, pos anggaran madrasah, dan laporan keuangan komite.' },
    'catatan-keuangan': { action: 'manage', desc: 'Buku kas pembantu, rekapitulasi mutasi, dan export laporan keuangan.' },
  },
  BENDAHARA_KOMITE: {
    'pembayaran': { action: 'manage', desc: 'Verifikasi dan realisasi pencairan dana honorarium kegiatan & guru asuh.' },
    'keuangan': { action: 'manage', desc: 'Pengelolaan pos dana komite madrasah dan rekapitulasi realisasi anggaran.' },
  },
  PEMBINA_EKSKUL: {
    'ekstrakurikuler': { action: 'edit', desc: 'Mengelola daftar anggota ekskul, input presensi latihan, dan penilaian ekskul.' },
  },
  OP_IZIN: {
    'ketidakhadiran': { action: 'edit', desc: 'Operator Izin: Input permohonan izin/sakit siswa, upload surat dokter, & kirim notifikasi WA.' },
    'surat': { action: 'edit', desc: 'Generate otomatis surat izin / dispensasi resmi madrasah.' },
  },
  OP_ABSENSI: {
    'absensi': { action: 'manage', desc: 'Operator Absensi: Verifikasi kelengkapan presensi harian dan rekap kehadiran madrasah.' },
    'ketidakhadiran': { action: 'edit', desc: 'Sinkronisasi data ketidakhadiran siswa ke jurnal dan rekap harian.' },
  },
  OP_UKS: {
    'rekam-medis': { action: 'manage', desc: 'Operator UKS: Pencatatan rekam medis pemeriksaan kesehatan, diagnosa, & obat UKS.' },
    'ketidakhadiran': { action: 'edit', desc: 'Verifikasi surat istirahat medis siswa di ruang UKS.' },
  },
  OP_JURNAL: {
    'jurnal': { action: 'manage', desc: 'Operator Jurnal: Monitoring keterisian jurnal seluruh guru dan verifikasi entri PBM.' },
    'jurnal-banding': { action: 'manage', desc: 'Verifikasi awal pengajuan banding jurnal yang diajukan oleh guru.' },
    'agenda-madrasah': { action: 'edit', desc: 'Membantu input agenda kalender madrasah.' },
  },
  OP_AGENDA: {
    'agenda-madrasah': { action: 'manage', desc: 'Operator Agenda: Input, edit, dan publikasi kalender agenda kegiatan madrasah.' },
  },
  OP_LAYANAN: {
    'layanan-ptsp': { action: 'manage', desc: 'Operator PTSP: Pengelolaan antrean layanan terpadu dan verifikasi berkas permohonan.' },
    'permintaan-surat': { action: 'manage', desc: 'Memproses permohonan surat siswa/guru dan mencetak surat dinas resmi.' },
  },
  OP_PENGUMUMAN: {
    'pengumuman': { action: 'manage', desc: 'Operator Pengumuman: Mengunggah informasi berita madrasah, lampiran surat, & banner.' },
  },
  OP_FORM: {
    'form': { action: 'manage', desc: 'Operator Formulir: Membuat form dinamis baru (Form Builder), kelola respon & export data.' },
  },
  OP_LOMBA: {
    'prestasi': { action: 'manage', desc: 'Operator Prestasi: Input pendaftaran kontingen lomba & pencatatan hasil juara madrasah.' },
  },
  OP_KELAS: {
    'pengaturan-data': { action: 'view', desc: 'Membantu sinkronisasi plotting siswa ke rombel kelas.' },
  },
  PENGURUS_KELAS: {
    'jurnal': { action: 'edit', desc: 'Presensi Kelas: Membantu mencatat keterisian jam mengajar dan guru hadir di kelas.' },
    'tugas-siswa': { action: 'view', desc: 'Membantu koordinasi pengumpulan tugas teman sekelas.' },
  },
  WALI: {
    'dashboard': { action: 'view', desc: 'Portal Wali Santri: Memantau perkembangan akademik & pengumuman madrasah.' },
    'absensi': { action: 'view', desc: 'Memantau kehadiran dan ketidakhadiran putra/putri.' },
    'nilai': { action: 'view', desc: 'Memantau capaian nilai belajar siswa.' },
  }
}

/**
 * Format label hak akses yang mudah dipahami
 */
export function formatActionLabel(action: ActionLevel): string {
  switch (action) {
    case 'manage':
      return '⚡ Kelola Penuh / Approval'
    case 'edit':
      return '✏️ Input & Edit'
    case 'view':
      return '👁️ Lihat & Monitor'
    default:
      return 'Akses Terbatas'
  }
}

/**
 * Deteksi cerdas penggunaan halaman dan detail fungsi untuk role tertentu.
 * Menggunakan struktur menu dinamis (menuGroups & customLabels) agar 100% selaras dengan "Susun Menu".
 *
 * @param roleName Nama role (misal: "GURU", "OP_IZIN", "BK", dsb.)
 * @param activeRolePages Daftar page_id yang aktif di tabel role_pages (opsional)
 * @param menuGroups Susunan grup menu aktif (dari /api/menu-layout)
 * @param customLabels Label kustom halaman (dari /api/menu-layout)
 */
export function detectRoleUsage(
  roleName: string,
  activeRolePages: string[] = [],
  menuGroups?: MenuGroupDef[],
  customLabels?: Record<string, string>
): RoleUsageAnalysis {
  const normRole = (roleName || '').trim().toUpperCase().replace(/\s+/g, '_')
  const isSuperAdmin = normRole === 'ADMIN' || normRole === 'ADMINISTRATOR'
  const activeMenuSet = new Set(activeRolePages.map(p => p.toLowerCase()))

  // Gunakan susunan grup dinamis dari "Susun Menu", fallback ke MENU_GROUPS bawaan
  const effectiveGroups = (menuGroups && menuGroups.length > 0) ? menuGroups : MENU_GROUPS

  const customRoleDesc = ROLE_FUNCTION_DESCRIPTIONS[normRole]
  const isKnownRole = !!customRoleDesc || isSuperAdmin

  const detectedPagesMap = new Map<string, PageUsageDetail>()

  // 1. Scan semua effectiveGroups dan halamannya
  effectiveGroups.forEach(group => {
    group.pages.forEach(pageId => {
      const pageTitle = (customLabels && customLabels[pageId]) || PAGE_LABELS[pageId] || pageId
      let isFunctional = false
      let actionLevel: ActionLevel = 'none'
      let functionDescription = ''

      // Cek apakah ada di knowledge base spesifik
      if (isSuperAdmin) {
        isFunctional = true
        actionLevel = 'manage'
        functionDescription = 'Superuser: Akses penuh mengelola data, konfigurasi, export, dan approval pada halaman ini.'
      } else if (customRoleDesc && customRoleDesc[pageId]) {
        isFunctional = true
        actionLevel = customRoleDesc[pageId].action || 'view'
        functionDescription = customRoleDesc[pageId].desc
      } else {
        // Cek fallback di PAGE_ROLE_REQUIREMENTS
        // getRequirement menormalkan sendiri ejaan `-`/`_`/`:`/`.`, jadi tidak
        // perlu lagi menebak varian satu per satu di sini.
        const req = getRequirement(pageId)
        if (req) {
          const allowed = req.allowedRoles.map(r => r.toUpperCase())
          if (allowed.includes(normRole)) {
            isFunctional = true
            const roleAct = req.roleActions?.[normRole] || req.defaultAction || 'view'
            actionLevel = (roleAct as ActionLevel) || 'view'
            functionDescription = req.description
              ? `Memiliki hak akses ${formatActionLabel(actionLevel)} pada modul ${req.description}.`
              : `Memiliki hak akses fungsional pada halaman ${pageTitle}.`
          }
        }
      }

      // Cek apakah halaman ini aktif di menu sidebar database (role_pages)
      const isMenuAssigned = activeMenuSet.has(pageId.toLowerCase())

      // Jika role adalah kustom dan nama halamannya cocok sebagian dengan nama role
      if (!isFunctional && !isKnownRole && normRole.length > 2) {
        const keywords = normRole.split('_').filter(k => k.length > 2 && !['OP', 'WKM', 'TIM', 'STAFF'].includes(k))
        const matchesKeyword = keywords.some(k => pageId.toUpperCase().includes(k) || pageTitle.toUpperCase().includes(k))
        if (matchesKeyword) {
          isFunctional = true
          actionLevel = 'edit'
          functionDescription = `Terdeteksi relevan dengan kata kunci role "${normRole}". Memungkinkan akses operasional pada halaman ${pageTitle}.`
        }
      }

      // Jika halaman terhubung (baik fungsional atau ada di menu)
      if (isFunctional || isMenuAssigned) {
        detectedPagesMap.set(pageId, {
          pageId,
          title: pageTitle,
          groupKey: group.key,
          groupLabel: group.label,
          groupIcon: group.icon,
          actionLevel: actionLevel === 'none' && isMenuAssigned ? 'view' : actionLevel,
          actionLabel: formatActionLabel(actionLevel === 'none' && isMenuAssigned ? 'view' : actionLevel),
          functionDescription: functionDescription || `Akses menu sidebar aktif untuk halaman ${pageTitle}.`,
          isMenuAssigned,
          isFunctional,
        })
      }
    })
  })

  // Kelompokkan hasil per kategori menu yang sudah disusun
  const groupsResult: RoleUsageGroup[] = []
  effectiveGroups.forEach(groupDef => {
    const pagesInGroup = groupDef.pages
      .map(pId => detectedPagesMap.get(pId))
      .filter((p): p is PageUsageDetail => Boolean(p))

    if (pagesInGroup.length > 0) {
      groupsResult.push({
        key: groupDef.key,
        label: groupDef.label,
        icon: groupDef.icon,
        pages: pagesInGroup
      })
    }
  })

  // Tentukan level aksi tertinggi
  let highestActionLevel: ActionLevel = 'none'
  detectedPagesMap.forEach(p => {
    if (p.actionLevel === 'manage') highestActionLevel = 'manage'
    else if (p.actionLevel === 'edit' && highestActionLevel !== 'manage') highestActionLevel = 'edit'
    else if (p.actionLevel === 'view' && highestActionLevel === 'none') highestActionLevel = 'view'
  })

  // Buat ringkasan kategori utama
  const categoryNames = groupsResult.map(g => g.label)
  let primaryCategorySummary = 'Umum'
  if (isSuperAdmin) {
    primaryCategorySummary = 'Seluruh Modul Sistem (Full Access)'
  } else if (categoryNames.length > 0) {
    primaryCategorySummary = categoryNames.slice(0, 3).join(', ') + (categoryNames.length > 3 ? ` (+${categoryNames.length - 3} lainnya)` : '')
  }

  const specialNotes: string[] = []
  if (isSuperAdmin) {
    specialNotes.push('Role ADMIN/ADMINISTRATOR memiliki kekebalan hak akses dan dapat membuka seluruh halaman tanpa batasan role_pages.')
  } else if (!isKnownRole && detectedPagesMap.size === 0) {
    specialNotes.push('Role kustom baru: Belum ada modul bawaan yang terhubung secara otomatis. Anda dapat mengatur akses menu di tab "Akses per Role".')
  }

  return {
    roleName: normRole,
    totalDetectedPages: detectedPagesMap.size,
    assignedMenuPagesCount: Array.from(detectedPagesMap.values()).filter(p => p.isMenuAssigned).length,
    groups: groupsResult,
    primaryCategorySummary,
    highestActionLevel,
    isSuperAdmin,
    isKnownRole,
    specialNotes: specialNotes.length > 0 ? specialNotes : undefined,
  }
}

/**
 * Daftar template role bawaan sistem untuk saran cepat (Autocomplete/Templates)
 */
export const SYSTEM_ROLE_TEMPLATES = [
  { name: 'GURU', label: 'Guru Mata Pelajaran', desc: 'Mengisi jurnal PBM, absensi siswa, nilai, piket, LCKH, izin, dan klinik.' },
  { name: 'WALI_KELAS', label: 'Wali Kelas', desc: 'Monitoring rekap absensi, nilai rapor, surat ketidakhadiran, & catatan kelas binaan.' },
  { name: 'SISWA', label: 'Siswa / Santri', desc: 'Portal nilai, presensi mandiri, tugas siswa, pendaftaran ekskul, izin ACCA, & CBT.' },
  { name: 'KAMAD', label: 'Kepala Madrasah', desc: 'Supervisi akademik e-supervisi, approval LCKH, & monitoring capaian madrasah.' },
  { name: 'BK', label: 'Bimbingan Konseling', desc: 'Pencatatan konseling siswa, penanganan kasus, monitoring absensi, & home visit.' },
  { name: 'WKM_AKADEMIK', label: 'WKM Akademik / Kurikulum', desc: 'Approval LCKH akademik, klinik pembelajaran, agenda madrasah, & sanggar.' },
  { name: 'WKM_KESISWAAN', label: 'WKM Kesiswaan', desc: 'Monitoring ketidakhadiran, approval ekskul, validasi prestasi lomba, & LCKH.' },
  { name: 'WKM_KEASRAMAAN', label: 'WKM Keasramaan', desc: 'Monitoring program guru asuh, pembinaan santri malam, & kesehatan asrama.' },
  { name: 'BENDAHARA_KOMITE', label: 'Bendahara Komite / Kasir', desc: 'Pengelolaan pencairan honorarium guru asuh, pembukuan komite, & catatan kas.' },
  { name: 'PEMBINA_EKSKUL', label: 'Pembina Ekstrakurikuler', desc: 'Mengelola presensi kehadiran ekskul & input nilai capaian ekstrakurikuler.' },
  { name: 'OP_IZIN', label: 'Operator Izin / Surat', desc: 'Entri izin/sakit siswa, upload bukti dokter, kirim notifikasi WA, & surat dispensasi.' },
  { name: 'OP_UKS', label: 'Operator UKS / Medis', desc: 'Pencatatan rekam medis pemeriksaan, diagnosa obat, & surat istirahat UKS.' },
  { name: 'OP_JURNAL', label: 'Operator Jurnal PBM', desc: 'Monitoring keterisian jurnal guru, verifikasi banding jurnal, & rekapitulasi.' },
  { name: 'OP_LAYANAN', label: 'Operator PTSP & Layanan', desc: 'Pengelolaan permohonan surat siswa/guru dan pelayanan satu pintu madrasah.' },
  { name: 'OP_PENGUMUMAN', label: 'Operator Informasi & Rilis', desc: 'Publikasi pengumuman penting, edaran madrasah, & banner informasi.' },
  { name: 'OP_FORM', label: 'Operator Formulir Dinamis', desc: 'Form builder, konfigurasi kuesioner dinamis, & ekspor hasil respon.' },
  { name: 'OP_LOMBA', label: 'Operator Prestasi & Lomba', desc: 'Pendaftaran kontingen lomba siswa dan inventarisasi sertifikat juara.' },
  { name: 'SUPERVISOR', label: 'Supervisor Akademik', desc: 'Melakukan observasi pembelajaran PBM di kelas dan penilaian instrumen.' },
]
