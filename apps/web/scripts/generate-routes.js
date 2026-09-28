const fs = require('fs');
const path = require('path');

const routes = [
  // OPERASIONAL & UTAMA
  { path: 'absensi', importPath: '@/app/absensi/view' },
  { path: 'ketidakhadiran', importPath: '@/app/ketidakhadiran/view' },
  { path: 'rekam-medis', importPath: '@/app/rekam-medis/view' },
  { path: 'jurnal', importPath: '@/app/jurnal/view' },
  { path: 'jurnal-banding', importPath: '@/app/jurnal/banding/view' },
  { path: 'piket', importPath: '@/app/piket/view' },
  { path: 'informasi', importPath: '@/app/informasi/view' },
  { path: 'informasi/kelola', importPath: '@/app/informasi/kelola/view' },
  { path: 'tugas-tambahan', importPath: '@/app/tugas-tambahan/view' },
  { path: 'guru-asuh', importPath: '@/app/guru-asuh/view' },
  { path: 'wali-kelas', importPath: '@/app/wali-kelas/view' },
  { path: 'ekstrakurikuler', importPath: '@/app/ekstrakurikuler/view' },
  { path: 'prestasi', importPath: '@/app/prestasi/view' },
  { path: 'kokurikuler', importPath: '@/app/kokurikuler/view' },

  // KONFIGURASI & PENGATURAN
  { path: 'master', importPath: '@/app/master/view' },
  { path: 'form', importPath: '@/app/form/view' },
  { path: 'form/builder', importPath: '@/app/form/builder/view' },
  { path: 'form/responses', importPath: '@/app/form/responses/view' },
  { path: 'pengaturan-umum', importPath: '@/app/pengaturan-umum/view' },
  { path: 'pengaturan-data', importPath: '@/app/pengaturan-data/view' },
  { path: 'pengaturan-tugas', importPath: '@/app/pengaturan-tugas/view' },
  { path: 'pengaturan-users', importPath: '@/app/pengaturan-users/view' },

  // PROFILE & KHUSUS
  { path: 'profile', importPath: '@/app/profile/view', passRefresh: true },
  { path: 'lckh', importPath: '@/app/lckh/view' },
  { path: 'lckh-approval', importPath: '@/app/lckh-approval/view' },
  { path: 'pembayaran', importPath: '@/app/pembayaran/view' },
  { path: 'nilai', importPath: '@/app/nilai/view' },
  { path: 'izin-guru', importPath: '@/app/izin-guru/view' },
  { path: 'surat', importPath: '@/app/surat/view' },
  {
    path: 'surat-daftar',
    customTemplate: `'use client'

import { redirect } from 'next/navigation'

export default function Page() {
    redirect('/surat?tab=daftar')
}
`
  },
  { path: 'sanggar-kurikulum', importPath: '@/app/sanggar-kurikulum/view' },

  // REKAP & MONITORING
  { path: 'monitoring', importPath: '@/app/monitoring/view' },
  { path: 'kinerja-guru', importPath: '@/app/kinerja-guru/view' },
  { path: 'agenda-madrasah', importPath: '@/app/agenda-madrasah/view' },
  { path: 'tampilan-agenda', importPath: '@/app/tampilan-agenda/page' },
  { path: 'dokumen', importPath: '@/app/dokumen/view' },
  { path: 'e-supervisi', importPath: '@/app/e-supervisi/view' },
  { path: 'observasi-kelas', importPath: '@/app/observasi-kelas/view' },
  { path: 'bimbingan-konseling', importPath: '@/app/bimbingan-konseling/view' },

  // SISWA & KEUANGAN & PTSP
  { path: 'um-kelulusan', importPath: '@/app/um-kelulusan/view' },
  { path: 'tugas-siswa', importPath: '@/app/tugas-siswa/view' },
  { path: 'nilai-siswa', importPath: '@/app/nilai-siswa/view' },
  { path: 'catatan-keuangan', importPath: '@/app/catatan-keuangan/view' },
  { path: 'layanan-ptsp', importPath: '@/app/layanan-ptsp/view' },
  { path: 'klinik', importPath: '@/app/klinik/view' },
  { path: 'bank-data', importPath: '@/app/bank-data/view' },
  { path: 'keuangan', importPath: '@/app/keuangan/view' },

  // JADWAL (Custom template)
  {
    path: 'jadwal',
    customTemplate: `'use client'

import { useDashboardUser } from '@/components/UserContext'
import JadwalPage from '@/app/jadwal/view'
import OrangTuaWrapper from '@/app/jadwal/OrangTuaWrapper'

export default function Page() {
    const { user } = useDashboardUser()
    if (!user) return null
    return user.roles?.includes('ORANG_TUA') ? <OrangTuaWrapper user={user} /> : <JadwalPage user={user} />
}
`
  },

];

const targetBaseDir = path.join(__dirname, '..', 'app', '(dashboard)');

let count = 0;
for (const r of routes) {
  const folderPath = path.join(targetBaseDir, ...r.path.split('/'));
  fs.mkdirSync(folderPath, { recursive: true });

  const pageFilePath = path.join(folderPath, 'page.tsx');

  let code = '';
  if (r.customTemplate) {
    code = r.customTemplate;
  } else if (r.passRefresh) {
    code = `'use client'

import { useDashboardUser } from '@/components/UserContext'
import ViewComponent from '${r.importPath}'

export default function Page() {
    const { user, refreshUser } = useDashboardUser()
    if (!user) return null
    return <ViewComponent user={user} onRefreshUser={refreshUser} />
}
`;
  } else {
    code = `'use client'

import { useDashboardUser } from '@/components/UserContext'
import ViewComponent from '${r.importPath}'

export default function Page() {
    const { user } = useDashboardUser()
    if (!user) return null
    return <ViewComponent user={user} />
}
`;
  }

  fs.writeFileSync(pageFilePath, code, 'utf-8');
  console.log(`[CREATED] ${pageFilePath}`);
  count++;
}

console.log(`\nSuccessfully created ${count} route page.tsx files.`);
