'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { PageLoader } from '@/components/ui/Spinner';
import { FilterToolbar, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { getCurrentUser } from '@/lib/auth-client';

interface Mapel {
  id: string;
  kode: string;
  nama: string;
  kelompok: string;
}

interface Kelas {
  id: string;
  nama: string;
  program: string;
}

interface Guru {
  nip: string;
  nama_lengkap: string;
}

interface Mapping {
  mapel_kode: string;
  guru_nip: string;
  mapel_nama?: string;
  guru_nama?: string;
  id?: string;
}

interface ScheduleRelation {
  mapel: string;
  nip: string;
}

interface PlottingMapelTabProps {
  tahunAjaranList: string[];
  tahunAjaran: string;
  setTahunAjaran: (ta: string) => void;
}

export default function PlottingMapelTab({
  tahunAjaranList,
  tahunAjaran,
  setTahunAjaran,
}: PlottingMapelTabProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Master Data
  const [masterMapel, setMasterMapel] = useState<Mapel[]>([]);
  const [masterKelas, setMasterKelas] = useState<Kelas[]>([]);
  const [masterGuru, setMasterGuru] = useState<Guru[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');

  // Current Mappings
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mappingToDelete, setMappingToDelete] = useState<{
    index: number;
    data: Mapping;
  } | null>(null);

  // Schedule Data for UX
  const [scheduleRelations, setScheduleRelations] = useState<ScheduleRelation[]>([]);
  const [isPulling, setIsPulling] = useState(false);

  // Form New Mapping
  const [newMapelKode, setNewMapelKode] = useState('');
  const [newGuruNIP, setNewGuruNIP] = useState('');

  // Permission Check
  const permissions = user?.permissions || [];
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN') ||
    false;
  const userRoles = user?.roles || [];
  const { hasPermission } = require('@/lib/permissions-client');
  const canManage =
    isAdmin ||
    hasPermission(
      permissions,
      'pengaturan_data:mapel_kelas',
      'manage',
      isAdmin,
      userRoles
    ) ||
    hasPermission(
      permissions,
      'pengaturan_data.mapel_kelas',
      'manage',
      isAdmin,
      userRoles
    );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const userData = await getCurrentUser();
        if (userData) setUser(userData);

        const { getAllAcademicYears, getActiveSettings } = await import(
          '@/lib/settings-client'
        );
        const [years, active] = await Promise.all([
          getAllAcademicYears(),
          getActiveSettings(),
        ]);
        if (active) setTahunAjaran(active.tahun_ajaran);
        else if (years.length > 0) setTahunAjaran(years[0]);

        const [resMapel, resKelas, resGuru] = await Promise.all([
          fetch('/api/master/mapel?limit=1000'),
          fetch('/api/master/kelas?limit=100'),
          fetch('/api/master/guru?limit=1000'),
        ]);
        const [jsonMapel, jsonKelas, jsonGuru] = await Promise.all([
          resMapel.json(),
          resKelas.json(),
          resGuru.json(),
        ]);

        if (jsonMapel.ok) setMasterMapel(jsonMapel.data);
        if (jsonKelas.ok) {
          setMasterKelas(jsonKelas.data);
          if (jsonKelas.data.length > 0) setSelectedKelas(jsonKelas.data[0].nama);
        }
        if (jsonGuru.ok) setMasterGuru(jsonGuru.data);

        const [resJadwal, resGM] = await Promise.all([
          fetch('/api/jadwal?aktif=true'),
          fetch(
            `/api/settings/guru-mapel?tahun_ajaran=${encodeURIComponent(
              tahunAjaran
            )}&limit=1000`
          ),
        ]);
        const [jsonJadwal, jsonGM] = await Promise.all([
          resJadwal.json(),
          resGM.json(),
        ]);

        const relations: ScheduleRelation[] = [];
        const seen = new Set();

        if (jsonJadwal.ok) {
          (jsonJadwal.data || []).forEach((j: any) => {
            const key = `${j.mata_pelajaran}|${j.nip}`;
            if (!seen.has(key)) {
              seen.add(key);
              relations.push({ mapel: j.mata_pelajaran, nip: j.nip });
            }
          });
        }

        if (jsonGM.ok) {
          (jsonGM.data || []).forEach((row: any) => {
            const key = `${row.nama_mapel}|${row.nip}`;
            if (!seen.has(key)) {
              seen.add(key);
              relations.push({ mapel: row.nama_mapel, nip: row.nip });
            }
          });
        }
        setScheduleRelations(relations);
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedKelas && tahunAjaran) {
      fetchCurrentMapping();
    }
  }, [selectedKelas, tahunAjaran]);

  const fetchCurrentMapping = async () => {
    if (!selectedKelas || !tahunAjaran) return;
    try {
      const res = await fetch(
        `/api/master/mapel-kelas?kelas=${encodeURIComponent(
          selectedKelas
        )}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}`
      );
      const json = await res.json();
      if (json.ok) {
        const loaded = json.data.map((m: any) => ({
          mapel_kode: m.mapel_kode,
          guru_nip: m.guru_nip,
          mapel_nama: m.master_mapel?.nama,
          guru_nama: m.master_guru?.nama_lengkap,
        }));
        setMappings(loaded);
      }
    } catch (err: any) {
      console.error('Fetch mapping error:', err);
    }
  };

  const addMapping = () => {
    if (!newMapelKode || !newGuruNIP) {
      Swal.fire('Info', 'Pilih Mapel dan Guru terlebih dahulu', 'info');
      return;
    }

    const isDuplicate = mappings.some(
      (m) => m.mapel_kode === newMapelKode && m.guru_nip === newGuruNIP
    );
    if (isDuplicate) {
      Swal.fire(
        'Peringatan',
        'Kombinasi Mapel dan Guru ini sudah ada di list',
        'warning'
      );
      return;
    }

    const mapel = masterMapel.find((m) => m.kode === newMapelKode);
    const guru = masterGuru.find((g) => g.nip === newGuruNIP);

    const newEntry: Mapping = {
      mapel_kode: newMapelKode,
      guru_nip: newGuruNIP,
      mapel_nama: mapel?.nama,
      guru_nama: guru?.nama_lengkap,
      id: Math.random().toString(36).substr(2, 9),
    };

    setMappings([...mappings, newEntry]);
    setNewGuruNIP('');
  };

  const confirmRemoveMapping = () => {
    if (!mappingToDelete) return;
    setMappings(mappings.filter((_, i) => i !== mappingToDelete.index));
    setMappingToDelete(null);
  };

  const pullFromSchedule = async () => {
    if (!selectedKelas) return;
    setIsPulling(true);
    try {
      const res = await fetch(
        `/api/jadwal?kelas=${encodeURIComponent(selectedKelas)}&aktif=true`
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      const jadwalRows = json.data || [];
      const newMappings: Mapping[] = [...mappings];

      jadwalRows.forEach((j: any) => {
        const matchingMapel = masterMapel.find(
          (m) =>
            m.nama.toLowerCase() === j.mata_pelajaran.toLowerCase() ||
            j.mata_pelajaran.toLowerCase().includes(m.nama.toLowerCase()) ||
            m.nama.toLowerCase().includes(j.mata_pelajaran.toLowerCase())
        );

        if (matchingMapel) {
          const alreadyExists = newMappings.some(
            (m) =>
              m.mapel_kode === matchingMapel.kode && m.guru_nip === j.nip
          );
          if (!alreadyExists) {
            newMappings.push({
              mapel_kode: matchingMapel.kode,
              guru_nip: j.nip,
              mapel_nama: matchingMapel.nama,
              guru_nama: j.nama_guru,
              id: Math.random().toString(36).substr(2, 9),
            });
          }
        }
      });

      setMappings(newMappings);
      if (jadwalRows.length > 0) {
        Swal.fire({
          icon: 'success',
          title: 'Jadwal Ditarik',
          text: `Berhasil menarik ${jadwalRows.length} entri dari jadwal kelas ${selectedKelas}`,
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        Swal.fire('Info', 'Tidak ada jadwal aktif untuk kelas ini', 'info');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsPulling(false);
    }
  };

  const pullFromGuruMapel = async () => {
    setIsPulling(true);
    try {
      const params = new URLSearchParams({
        tahun_ajaran: tahunAjaran,
        limit: '1000',
      });
      const res = await fetch(`/api/settings/guru-mapel?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      const gmRows = json.data || [];
      const newMappings: Mapping[] = [...mappings];

      gmRows.forEach((row: any) => {
        const matchingMapel = masterMapel.find(
          (m) =>
            m.kode === row.kode_mapel ||
            m.nama.toLowerCase() === row.nama_mapel.toLowerCase()
        );

        if (matchingMapel) {
          const alreadyExists = newMappings.some(
            (m) =>
              m.mapel_kode === matchingMapel.kode && m.guru_nip === row.nip
          );
          if (!alreadyExists) {
            newMappings.push({
              mapel_kode: matchingMapel.kode,
              guru_nip: row.nip,
              mapel_nama: matchingMapel.nama,
              guru_nama: row.nama_guru,
              id: Math.random().toString(36).substr(2, 9),
            });
          }
        }
      });

      setMappings(newMappings);
      Swal.fire({
        icon: 'success',
        title: 'Data Ditarik',
        text: 'Berhasil menarik data pengampu dari Guru Mapel',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsPulling(false);
    }
  };

  const handleSave = async () => {
    if (!selectedKelas || !tahunAjaran) {
      Swal.fire('Error', 'Pilih Kelas dan Tahun Ajaran', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/master/mapel-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas: selectedKelas,
          tahun_ajaran: tahunAjaran,
          mappings: mappings.map((m) => ({
            mapel_kode: m.mapel_kode,
            guru_nip: m.guru_nip,
          })),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Pemetaan mapel kelas diperbarui',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      Swal.fire('Gagal', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Memuat data master…" minHeight="300px" />;

  return (
    <div className="mk-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Filter Toolbar ───────────────────────────────────────────── */}
      <FilterToolbar>
        <FilterSelect
          label="Pilih Kelas"
          icon="mortarboard"
          value={selectedKelas}
          onChange={setSelectedKelas}
          options={masterKelas.map((k) => ({ value: k.nama, label: k.nama }))}
        />
        <FilterSelect
          label="Tahun Ajaran"
          icon="calendar3"
          value={tahunAjaran}
          onChange={setTahunAjaran}
          options={tahunAjaranList.map((ta) => ({ value: ta, label: ta }))}
        />

        <FilterActions>
          {canManage && (
            <Button
              size="md"
              variant="primary"
              icon="save"
              onClick={handleSave}
              isLoading={saving}
            >
              Simpan Pemetaan
            </Button>
          )}
        </FilterActions>
      </FilterToolbar>

      {/* ── 2-Column Mapping Area ────────────────────────────────────── */}
      <div
        className="mk-mapping-area"
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '20px',
        }}
      >
        {/* Left Card: Add Mapping */}
        <div
          className="mk-add-card"
          style={{
            background: 'var(--n-card)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--n-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {canManage && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: 'var(--n-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <i
                  className="bi bi-plus-circle-fill"
                  style={{ color: 'var(--n-primary)' }}
                />{' '}
                Tambah Mapping
              </h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={pullFromSchedule}
                  isLoading={isPulling}
                  leftIcon={<i className="bi bi-calendar3" style={{ color: '#3b82f6' }} />}
                >
                  Jadwal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={pullFromGuruMapel}
                  isLoading={isPulling}
                  leftIcon={<i className="bi bi-person-badge" style={{ color: '#16a34a' }} />}
                >
                  Guru Mapel
                </Button>
              </div>
            </div>
          )}

          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--n-muted)',
              margin: 0,
            }}
          >
            Pilih mata pelajaran dan guru pengampunya untuk diplotkan ke kelas{' '}
            <strong>{selectedKelas}</strong>.
          </p>

          <div className="form-group">
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-muted)' }}>
              Mata Pelajaran
            </label>
            <select
              value={newMapelKode}
              onChange={(e) => setNewMapelKode(e.target.value)}
              disabled={!canManage}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1.5px solid var(--n-border)',
                background: 'var(--n-surface)',
                color: 'var(--n-ink)',
              }}
            >
              <option value="">-- Pilih Mapel --</option>
              {masterMapel.map((m) => (
                <option key={m.id} value={m.kode}>
                  {m.kode} - {m.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--n-muted)' }}>
              Guru Pengampu{' '}
              {newMapelKode && (
                <span style={{ color: 'var(--n-primary)', fontSize: '0.7rem' }}>
                  (Difilter)
                </span>
              )}
            </label>
            <select
              value={newGuruNIP}
              onChange={(e) => setNewGuruNIP(e.target.value)}
              disabled={!canManage}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1.5px solid var(--n-border)',
                background: 'var(--n-surface)',
                color: 'var(--n-ink)',
              }}
            >
              <option value="">-- Pilih Guru --</option>
              {(newMapelKode
                ? masterGuru.filter((g) => {
                    const selectedMapel = masterMapel.find(
                      (m) => m.kode === newMapelKode
                    );
                    if (!selectedMapel) return true;
                    return scheduleRelations.some(
                      (rel) =>
                        rel.nip === g.nip &&
                        (rel.mapel
                          .toLowerCase()
                          .includes(selectedMapel.nama.toLowerCase()) ||
                          selectedMapel.nama
                            .toLowerCase()
                            .includes(rel.mapel.toLowerCase()))
                    );
                  })
                : masterGuru
              ).map((g) => (
                <option key={g.nip} value={g.nip}>
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
          </div>

          {canManage && (
            <Button
              variant="primary"
              icon="add"
              onClick={addMapping}
              className="w-full justify-center mt-2"
            >
              Tambahkan ke List
            </Button>
          )}
        </div>

        {/* Right Table: Plotting Subject List */}
        <div
          style={{
            background: 'var(--n-card)',
            borderRadius: '16px',
            border: '1px solid var(--n-border)',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background:
                'var(--banner-bg, linear-gradient(135deg, var(--n-primary) 0%, #c2185b 100%))',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>
              Daftar Mata Pelajaran Plotting Kelas {selectedKelas}
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: '700',
              }}
            >
              {mappings.length} Mapel
            </span>
          </div>

          {mappings.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--n-muted)',
              }}
            >
              <i
                className="bi bi-clipboard2-x"
                style={{ fontSize: '3rem', marginBottom: '16px' }}
              />
              <p style={{ fontSize: '0.88rem', textAlign: 'center', margin: 0 }}>
                Belum ada mata pelajaran yang diplotkan untuk kelas ini.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: 'var(--n-muted)',
                        textTransform: 'uppercase',
                        background: 'var(--n-surface)',
                        borderBottom: '1px solid var(--n-border)',
                      }}
                    >
                      Mata Pelajaran
                    </th>
                    <th
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: 'var(--n-muted)',
                        textTransform: 'uppercase',
                        background: 'var(--n-surface)',
                        borderBottom: '1px solid var(--n-border)',
                      }}
                    >
                      Guru Pengampu
                    </th>
                    <th
                      style={{
                        width: '80px',
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: 'var(--n-muted)',
                        textTransform: 'uppercase',
                        background: 'var(--n-surface)',
                        borderBottom: '1px solid var(--n-border)',
                      }}
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, idx) => (
                    <tr key={m.id || idx}>
                      <td
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid var(--n-border)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: '600',
                            color: 'var(--n-ink)',
                            marginBottom: '2px',
                          }}
                        >
                          {m.mapel_nama}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--n-muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {m.mapel_kode}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid var(--n-border)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: '600',
                            color: 'var(--n-ink)',
                            marginBottom: '2px',
                          }}
                        >
                          {m.guru_nama || 'Self-Entry / Umum'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--n-muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {m.guru_nip || '-'}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid var(--n-border)',
                          textAlign: 'right',
                        }}
                      >
                        {canManage && (
                          <ActionGroup className="justify-end">
                            <ActionButton
                              action="delete"
                              title="Hapus Pemetaan"
                              onClick={() =>
                                setMappingToDelete({ index: idx, data: m })
                              }
                            />
                          </ActionGroup>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Konfirmasi Hapus Mapping (Modal.tsx) ─────────────────── */}
      {mappingToDelete && (
        <Modal
          open={!!mappingToDelete}
          onClose={() => setMappingToDelete(null)}
          size="sm"
          variant="delete"
          icon="trash3"
          title="Hapus Pemetaan Mapel?"
        >
          <ModalBody>
            <div style={{ fontSize: '0.85rem', color: 'var(--n-ink)' }}>
              Apakah Anda yakin ingin menghapus pemetaan{' '}
              <strong>{mappingToDelete.data.mapel_nama}</strong> (
              {mappingToDelete.data.guru_nama || 'Umum'}) dari kelas{' '}
              <strong>{selectedKelas}</strong>?
            </div>
          </ModalBody>
          <ModalFooter align="end">
            <Button
              variant="cancel"
              onClick={() => setMappingToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={confirmRemoveMapping}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              Ya, Hapus
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}