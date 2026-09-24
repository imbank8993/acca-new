'use client'

import { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import { PageLoader } from '@/components/ui/Spinner'

interface Mapel {
  id: string
  kode: string
  nama: string
  kelompok: string
}

interface Kelas {
  id: string
  nama: string
  program: string
}

interface Guru {
  nip: string
  nama_lengkap: string
}

interface Mapping {
  mapel_kode: string
  guru_nip: string
  mapel_nama?: string
  guru_nama?: string
  id?: string
}

interface ScheduleRelation {
  mapel: string
  nip: string
}

export default function MapelKelasTab({ user }: { user?: any }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [masterMapel, setMasterMapel] = useState<Mapel[]>([])
  const [masterKelas, setMasterKelas] = useState<Kelas[]>([])
  const [masterGuru, setMasterGuru] = useState<Guru[]>([])
  const [tahunAjaranList, setTahunAjaranList] = useState<string[]>([])

  const [selectedKelas, setSelectedKelas] = useState('')
  const [tahunAjaran, setTahunAjaran] = useState('')

  const [mappings, setMappings] = useState<Mapping[]>([])
  const [apiError, setApiError] = useState<string | null>(null)

  const [scheduleRelations, setScheduleRelations] = useState<ScheduleRelation[]>([])
  const [isPulling, setIsPulling] = useState(false)

  const [newMapelKode, setNewMapelKode] = useState('')
  const [newGuruNIP, setNewGuruNIP] = useState('')

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (selectedKelas && tahunAjaran) {
      fetchCurrentMapping()
    }
  }, [selectedKelas, tahunAjaran])

  const init = async () => {
    setLoading(true)
    try {
      const { getAllAcademicYears, getActiveSettings } = await import('@/lib/settings-client')
      const [years, active] = await Promise.all([getAllAcademicYears(), getActiveSettings()])
      setTahunAjaranList(years)
      if (active) setTahunAjaran(active.tahun_ajaran)
      else if (years.length > 0) setTahunAjaran(years[0])

      const [resMapel, resKelas, resGuru] = await Promise.all([
        fetch('/api/master/mapel?limit=1000'),
        fetch('/api/master/kelas?limit=100'),
        fetch('/api/master/guru?limit=1000')
      ])
      const [jsonMapel, jsonKelas, jsonGuru] = await Promise.all([resMapel.json(), resKelas.json(), resGuru.json()])

      if (jsonMapel.ok) setMasterMapel(jsonMapel.data)
      if (jsonKelas.ok) {
        setMasterKelas(jsonKelas.data)
        if (jsonKelas.data.length > 0) setSelectedKelas(jsonKelas.data[0].nama)
      }
      if (jsonGuru.ok) setMasterGuru(jsonGuru.data)

      const [resJadwal, resGM] = await Promise.all([
          fetch('/api/jadwal?aktif=true'),
          fetch(`/api/settings/guru-mapel?tahun_ajaran=${encodeURIComponent(tahunAjaran)}&limit=1000`)
      ])
      const [jsonJadwal, jsonGM] = await Promise.all([resJadwal.json(), resGM.json()])

      const relations: ScheduleRelation[] = []
      const seen = new Set()

      if (jsonJadwal.ok) {
          (jsonJadwal.data || []).forEach((j: any) => {
              const key = `${j.mata_pelajaran}|${j.nip}`
              if (!seen.has(key)) {
                  seen.add(key)
                  relations.push({ mapel: j.mata_pelajaran, nip: j.nip })
              }
          })
      }

      if (jsonGM.ok) {
          (jsonGM.data || []).forEach((row: any) => {
              const key = `${row.nama_mapel}|${row.nip}`
              if (!seen.has(key)) {
                  seen.add(key)
                  relations.push({ mapel: row.nama_mapel, nip: row.nip })
              }
          })
      }
      setScheduleRelations(relations)
    } catch (err) {
      console.error('Init error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentMapping = async () => {
    if (!selectedKelas || !tahunAjaran) return
    try {
      const res = await fetch(`/api/master/mapel-kelas?kelas=${encodeURIComponent(selectedKelas)}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`)
      const json = await res.json()
      if (json.ok) {
        const loaded = json.data.map((m: any) => ({
          mapel_kode: m.mapel_kode,
          guru_nip: m.guru_nip,
          mapel_nama: m.master_mapel?.nama,
          guru_nama: m.master_guru?.nama_lengkap
        }))
        setMappings(loaded)
        setApiError(null)
      } else {
        setApiError(json.error)
      }
    } catch (err: any) {
      setApiError(err.message)
    }
  }

  const addMapping = () => {
    if (!newMapelKode || !newGuruNIP) {
        Swal.fire('Info', 'Pilih Mapel dan Guru terlebih dahulu', 'info')
        return
    }

    const isDuplicate = mappings.some(m => m.mapel_kode === newMapelKode && m.guru_nip === newGuruNIP)
    if (isDuplicate) {
        Swal.fire('Warning', 'Kombinasi Mapel dan Guru ini sudah ada di list', 'warning')
        return
    }

    const mapel = masterMapel.find(m => m.kode === newMapelKode)
    const guru = masterGuru.find(g => g.nip === newGuruNIP)

    const newEntry: Mapping = {
        mapel_kode: newMapelKode,
        guru_nip: newGuruNIP,
        mapel_nama: mapel?.nama,
        guru_nama: guru?.nama_lengkap,
        id: Math.random().toString(36).substr(2, 9)
    }

    setMappings([...mappings, newEntry])
    setNewGuruNIP('')
  }

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  const pullFromSchedule = async () => {
    if (!selectedKelas) return
    setIsPulling(true)
    try {
        const res = await fetch(`/api/jadwal?kelas=${encodeURIComponent(selectedKelas)}&aktif=true`)
        const json = await res.json()
        if (!json.ok) throw new Error(json.error)

        const jadwalRows = json.data || []
        const newMappings: Mapping[] = [...mappings]

        jadwalRows.forEach((j: any) => {
            const matchingMapel = masterMapel.find(m =>
                m.nama.toLowerCase() === j.mata_pelajaran.toLowerCase() ||
                j.mata_pelajaran.toLowerCase().includes(m.nama.toLowerCase()) ||
                m.nama.toLowerCase().includes(j.mata_pelajaran.toLowerCase())
            )

            if (matchingMapel) {
                const alreadyExists = newMappings.some(m => m.mapel_kode === matchingMapel.kode && m.guru_nip === j.nip)
                if (!alreadyExists) {
                    newMappings.push({
                        mapel_kode: matchingMapel.kode,
                        guru_nip: j.nip,
                        mapel_nama: matchingMapel.nama,
                        guru_nama: j.nama_guru,
                        id: Math.random().toString(36).substr(2, 9)
                    })
                }
            }
        })

        setMappings(newMappings)
        if (jadwalRows.length > 0) {
            Swal.fire({
                icon: 'success',
                title: 'Jadwal Ditarik',
                text: `Berhasil menarik ${jadwalRows.length} entri dari jadwal kelas ${selectedKelas}`,
                timer: 1500,
                showConfirmButton: false
            })
        } else {
            Swal.fire('Info', 'Tidak ada jadwal aktif untuk kelas ini', 'info')
        }
    } catch (err: any) {
        Swal.fire('Error', err.message, 'error')
    } finally {
        setIsPulling(false)
    }
  }

  const pullFromGuruMapel = async () => {
    setIsPulling(true)
    try {
        const params = new URLSearchParams({
            tahun_ajaran: tahunAjaran,
            limit: '1000'
        })
        const res = await fetch(`/api/settings/guru-mapel?${params}`)
        const json = await res.json()
        if (!json.ok) throw new Error(json.error)

        const gmRows = json.data || []
        const newMappings: Mapping[] = [...mappings]

        gmRows.forEach((row: any) => {
             const matchingMapel = masterMapel.find(m =>
                m.kode === row.kode_mapel ||
                m.nama.toLowerCase() === row.nama_mapel.toLowerCase()
             )

             if (matchingMapel) {
                const alreadyExists = newMappings.some(m => m.mapel_kode === matchingMapel.kode && m.guru_nip === row.nip)
                if (!alreadyExists) {
                    newMappings.push({
                        mapel_kode: matchingMapel.kode,
                        guru_nip: row.nip,
                        mapel_nama: matchingMapel.nama,
                        guru_nama: row.nama_guru,
                        id: Math.random().toString(36).substr(2, 9)
                    })
                }
             }
        })

        setMappings(newMappings)
        Swal.fire({
            icon: 'success',
            title: 'Data Ditarik',
            text: `Berhasil menarik data pengampu dari Guru Mapel`,
            timer: 1500,
            showConfirmButton: false
        })
    } catch (err: any) {
        Swal.fire('Error', err.message, 'error')
    } finally {
        setIsPulling(false)
    }
  }

  const handleSave = async () => {
    if (!selectedKelas || !tahunAjaran) {
      Swal.fire('Error', 'Pilih Kelas dan Tahun Ajaran', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/master/mapel-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas: selectedKelas,
          tahun_ajaran: tahunAjaran,
          mappings: mappings.map(m => ({
            mapel_kode: m.mapel_kode,
            guru_nip: m.guru_nip
          }))
        })
      })
      const json = await res.json()
      if (json.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Pemetaan mapel kelas diperbarui',
          timer: 1500,
          showConfirmButton: false
        })
      } else {
        throw new Error(json.error)
      }
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader label="Memuat data master…" minHeight="300px" />

  return (
    <div className="mk" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)', padding: '24px', borderRadius: '16px' }}>
      <div className="mk-toolbar" style={{ background: 'white', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
         <div className="mk-filters" style={{ display: 'flex', gap: '16px' }}>
           <div className="mk-select-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--n-muted)', textTransform: 'uppercase' }}>Pilih Kelas</label>
              <select value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '600' }}>
                {masterKelas.map(k => (
                  <option key={k.id} value={k.nama}>{k.nama}</option>
                ))}
              </select>
           </div>
           <div className="mk-select-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--n-muted)', textTransform: 'uppercase' }}>Tahun Ajaran</label>
              <select value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '600' }}>
                {tahunAjaranList.map(ta => (
                  <option key={ta} value={ta}>{ta}</option>
                ))}
              </select>
           </div>
         </div>
         <div className="mk-actions">
           <button className="mk-save-btn" onClick={handleSave} disabled={saving} style={{ height: '44px', padding: '0 20px', background: '#3083FF', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
              {saving ? <i className="bi bi-arrow-repeat spin"></i> : <i className="bi bi-cloud-check"></i>}
              <span>{saving ? 'Simpan...' : 'Simpan Pemetaan'}</span>
           </button>
         </div>
      </div>

      <div className="mk-mapping-area" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          <div className="mk-add-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--n-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="bi bi-plus-circle-fill" style={{ color: '#3083FF' }}></i> Tambah Mapping
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="mk-pull-btn" onClick={pullFromSchedule} disabled={isPulling} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,56,168,0.2)', background: 'rgba(0,56,168,0.06)', color: '#3083FF', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>
                        {isPulling ? <i className="bi bi-arrow-repeat spin"></i> : <i className="bi bi-calendar3"></i>}
                        <span>Jadwal</span>
                    </button>
                    <button className="mk-pull-btn alt" onClick={pullFromGuruMapel} disabled={isPulling} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.06)', color: '#166534', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>
                        {isPulling ? <i className="bi bi-arrow-repeat spin"></i> : <i className="bi bi-person-badge"></i>}
                        <span>Guru Mapel</span>
                    </button>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--n-muted)', marginBottom: '16px' }}>Pilih mata pelajaran dan guru pengampunya untuk diplotkan ke kelas ini.</p>

              <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--n-muted)', marginBottom: '6px' }}>Mata Pelajaran</label>
                  <select value={newMapelKode} onChange={e => setNewMapelKode(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <option value="">-- Pilih Mapel --</option>
                      {masterMapel.map(m => (
                          <option key={m.id} value={m.kode}>{m.kode} - {m.nama}</option>
                      ))}
                  </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--n-muted)', marginBottom: '6px' }}>
                    Guru Pengampu {newMapelKode && <span style={{ color: '#3083FF', fontSize: '0.7rem' }}>(Difilter)</span>}
                  </label>
                  <select value={newGuruNIP} onChange={e => setNewGuruNIP(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <option value="">-- Pilih Guru --</option>
                      {(newMapelKode ? (
                          masterGuru.filter(g => {
                              const selectedMapel = masterMapel.find(m => m.kode === newMapelKode)
                              if (!selectedMapel) return true
                              return scheduleRelations.some(rel =>
                                  rel.nip === g.nip &&
                                  (rel.mapel.toLowerCase().includes(selectedMapel.nama.toLowerCase()) ||
                                   selectedMapel.nama.toLowerCase().includes(rel.mapel.toLowerCase()))
                              )
                          })
                      ) : masterGuru).map(g => (
                          <option key={g.nip} value={g.nip}>{g.nama_lengkap}</option>
                      ))}
                  </select>
              </div>

              <button onClick={addMapping} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#3083FF', color: 'white', borderRadius: '10px', border: 'none', fontWeight: '700', cursor: 'pointer', marginTop: '8px' }}>
                  <i className="bi bi-plus-lg"></i> Tambahkan ke List
              </button>
          </div>

          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #3083FF, #1565c0)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700' }}>Daftar Mata Pelajaran Plotting</span>
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{mappings.length} Mapel</span>
              </div>

              {mappings.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--n-muted)' }}>
                      <i className="bi bi-clipboard2-x" style={{ fontSize: '3rem', marginBottom: '16px' }}></i>
                      <p style={{ fontSize: '0.9rem', textAlign: 'center', margin: 0 }}>Belum ada mata pelajaran yang diplotkan untuk kelas ini.</p>
                  </div>
              ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: '800', color: 'var(--n-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>Mata Pelajaran</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: '800', color: 'var(--n-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>Guru Pengampu</th>
                                <th style={{ width: '60px', padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: '800', color: 'var(--n-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {mappings.map((m, idx) => (
                                <tr key={m.id || idx}>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--n-text)', marginBottom: '2px' }}>{m.mapel_nama}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)', fontFamily: 'monospace' }}>{m.mapel_kode}</div>
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--n-text)', marginBottom: '2px' }}>{m.guru_nama || 'Self-Entry / Umum'}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--n-muted)', fontFamily: 'monospace' }}>{m.guru_nip || '-'}</div>
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <button onClick={() => removeMapping(idx)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              )}
          </div>
      </div>

    </div>
  )
}