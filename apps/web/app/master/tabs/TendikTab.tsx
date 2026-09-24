'use client'

import PegawaiTab from './PegawaiTab'

/** Tab Master Data > Tendik (pegawai non guru). Isinya sama persis dengan tab Guru. */
export default function TendikTab({ user }: { user?: any }) {
  return <PegawaiTab user={user} jenis="TENDIK" />
}
