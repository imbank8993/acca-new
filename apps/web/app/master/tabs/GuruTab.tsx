'use client'

import PegawaiTab from './PegawaiTab'

/** Tab Master Data > Guru. Seluruh isinya ada di PegawaiTab (dipakai bersama tab Tendik). */
export default function GuruTab({ user }: { user?: any }) {
  return <PegawaiTab user={user} jenis="GURU" />
}
