'use client';

import { useMemo, useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/ui/DatePicker';
import { InlineSelect } from '@/components/ui/InlineSelect';
import type { CalonAnggota, RuanganOpsi } from './CreateSlotModal';
import { formatLabelRuangan } from './CreateSlotModal';

export interface KelasOpsi {
  kelas: string;
  tingkat: string | null;
  jumlah: number;
}

export interface AdminSesiForm {
  mapel: string;
  guru_nip: string;
  topik: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  max_siswa: number;
  ruangan?: string;
}

interface AdminSesiModalProps {
  isOpen: boolean;
  onClose: () => void;
  editSlotId: string | null;
  form: AdminSesiForm;
  setForm: React.Dispatch<React.SetStateAction<AdminSesiForm>>;
  mapelList: { id: string; nama: string }[];
  guruOptions: { nip: string; nama_guru: string }[];
  ruanganList?: RuanganOpsi[];
  kelasList: KelasOpsi[];
  kelasDipilih: string[];
  setKelasDipilih: React.Dispatch<React.SetStateAction<string[]>>;
  kandidatList: CalonAnggota[];
  kandidatLoading: boolean;
  kandidatTotal: { total: number; terpotong: boolean };
  kandidatQuery: string;
  setKandidatQuery: (q: string) => void;
  peserta: CalonAnggota[];
  setPeserta: React.Dispatch<React.SetStateAction<CalonAnggota[]>>;
  onSubmit: () => void;
  submitting?: boolean;
}

export default function AdminSesiModal({
  isOpen,
  onClose,
  editSlotId,
  form,
  setForm,
  mapelList,
  guruOptions,
  ruanganList = [],
  kelasList,
  kelasDipilih,
  setKelasDipilih,
  kandidatList,
  kandidatLoading,
  kandidatTotal,
  kandidatQuery,
  setKandidatQuery,
  peserta,
  setPeserta,
  onSubmit,
  submitting = false,
}: AdminSesiModalProps) {
  const [jumlahAcak, setJumlahAcak] = useState(5);

  useEffect(() => {
    if (isOpen) {
      setJumlahAcak(5);
    }
  }, [isOpen]);

  const terpilih = useMemo(
    () => new Set(peserta.map((p) => p.siswa_id)),
    [peserta]
  );

  const getKeteranganWaktu = (jamStr: string) => {
    if (!jamStr || !jamStr.includes(':')) return null;
    const h = parseInt(jamStr.split(':')[0], 10);
    if (isNaN(h)) return null;
    if (h < 12) return { text: 'Pagi', icon: '☀️', canShiftToNight: true };
    if (h < 15) return { text: 'Siang', icon: '☀️', canShiftToNight: false };
    if (h < 18) return { text: 'Sore', icon: '🌤️', canShiftToNight: false };
    return { text: 'Malam', icon: '🌙', canShiftToNight: false };
  };

  const shiftToNight = (field: 'jam_mulai' | 'jam_selesai') => {
    const val = form[field];
    if (!val || !val.includes(':')) return;
    const [h, m] = val.split(':');
    const numH = parseInt(h, 10);
    if (numH < 12) {
      const newH = String(numH + 12).padStart(2, '0');
      setForm((prev: any) => ({ ...prev, [field]: `${newH}:${m}` }));
    }
  };

  /** Kandidat dikelompokkan per kelas supaya mudah dipindai & dipilih borongan. */
  const perKelas = useMemo(() => {
    const peta = new Map<string, CalonAnggota[]>();
    for (const k of kandidatList) {
      if (!peta.has(k.kelas)) peta.set(k.kelas, []);
      peta.get(k.kelas)!.push(k);
    }
    return [...peta.entries()];
  }, [kandidatList]);

  const mapelOptions = useMemo(
    () => [
      { value: '', label: '-- Pilih Mata Pelajaran --' },
      ...mapelList.map((m) => ({ value: m.nama, label: m.nama })),
    ],
    [mapelList]
  );

  const guruSelectOptions = useMemo(
    () => [
      { value: '', label: form.mapel ? '-- Pilih Guru --' : 'Pilih mata pelajaran dulu' },
      ...guruOptions.map((g) => ({ value: g.nip, label: g.nama_guru })),
    ],
    [form.mapel, guruOptions]
  );

  const ruanganOptions = useMemo(() => {
    const list = [{ value: '', label: '-- Pilih Ruangan --' }];
    if (form.ruangan && !ruanganList.some((r) => r.nama === form.ruangan)) {
      list.push({ value: form.ruangan, label: form.ruangan });
    }
    for (const r of ruanganList) {
      list.push({ value: r.nama, label: formatLabelRuangan(r) });
    }
    return list;
  }, [form.ruangan, ruanganList]);

  const toggleKelas = (kelas: string) =>
    setKelasDipilih((prev) =>
      prev.includes(kelas) ? prev.filter((k) => k !== kelas) : [...prev, kelas]
    );

  const toggleSiswa = (s: CalonAnggota) =>
    setPeserta((prev) =>
      prev.some((p) => p.siswa_id === s.siswa_id)
        ? prev.filter((p) => p.siswa_id !== s.siswa_id)
        : [...prev, s]
    );

  /** Tambahkan seluruh siswa satu kelas, atau cabut semuanya bila sudah masuk. */
  const toggleSeluruhKelas = (daftar: CalonAnggota[]) => {
    const semuaMasuk = daftar.every((s) => terpilih.has(s.siswa_id));
    setPeserta((prev) => {
      const ids = new Set(daftar.map((s) => s.siswa_id));
      if (semuaMasuk) return prev.filter((p) => !ids.has(p.siswa_id));
      const sudah = new Set(prev.map((p) => p.siswa_id));
      return [...prev, ...daftar.filter((s) => !sudah.has(s.siswa_id))];
    });
  };

  /**
   * Ambil N siswa acak dari kandidat yang sedang tampil. Sengaja MENGGANTI
   * daftar terpilih, bukan menambah: gunanya untuk mengocok ulang sampai
   * komposisinya dirasa pas — hasilnya masih bisa disunting manual sesudahnya.
   */
  const acakPeserta = () => {
    const kolam = [...kandidatList];
    for (let i = kolam.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kolam[i], kolam[j]] = [kolam[j], kolam[i]];
    }
    setPeserta(kolam.slice(0, Math.max(1, jumlahAcak)));
  };

  const ringkasanTerpilih = useMemo(() => {
    const peta = new Map<string, number>();
    for (const p of peserta) peta.set(p.kelas, (peta.get(p.kelas) || 0) + 1);
    return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [peserta]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      variant={editSlotId ? 'edit' : 'add'}
      icon={editSlotId ? 'pencil' : 'calendar-plus'}
      title={editSlotId ? 'Ubah Sesi Klinik' : 'Buat Sesi Klinik'}
      subtitle="Tentukan guru pengampu dan peserta sesi secara langsung"
    >
      <ModalBody>
        <div className="modal-split-grid">
          {/* ── Kolom kiri: jadwal & pengampu ───────────────────────────── */}
          <div className="modal-col">
            <section className="form-section">
              <h3 className="form-section__title">
                <i className="bi bi-journal-bookmark-fill" /> Materi &amp; Pengampu
              </h3>

              <div className="form-group">
                <label>Mata Pelajaran</label>
                <InlineSelect
                  minWidth="100%"
                  height="42px"
                  value={form.mapel}
                  onChange={(val) => setForm({ ...form, mapel: val, guru_nip: '' })}
                  options={mapelOptions}
                />
              </div>

              <div className="form-group">
                <label>Guru Pengampu</label>
                <InlineSelect
                  minWidth="100%"
                  height="42px"
                  value={form.guru_nip}
                  onChange={(val) => setForm({ ...form, guru_nip: val })}
                  disabled={!form.mapel}
                  options={guruSelectOptions}
                />
                {form.mapel && guruOptions.length === 0 && (
                  <p className="form-hint form-hint--warn">
                    Belum ada data guru pengampu untuk mapel ini.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Topik / Materi</label>
                <textarea
                  placeholder="Apa yang akan dibahas?"
                  rows={3}
                  value={form.topik}
                  onChange={(e) => setForm({ ...form, topik: e.target.value })}
                />
              </div>
            </section>

            <section className="form-section">
              <h3 className="form-section__title">
                <i className="bi bi-clock-fill" /> Waktu &amp; Tempat Pelaksanaan
              </h3>
              <div className="form-row">
                <div className="form-group span-2">
                  <label>Tanggal</label>
                  <DatePicker
                    placement="top"
                    value={form.tanggal}
                    onChange={(v) => setForm({ ...form, tanggal: v })}
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Jam Mulai</label>
                    {form.jam_mulai && (() => {
                      const ket = getKeteranganWaktu(form.jam_mulai);
                      if (!ket) return null;
                      return (
                        <span style={{ fontSize: '0.72rem', color: ket.canShiftToNight ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                          {ket.icon} {ket.text} ({form.jam_mulai})
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    type="time"
                    value={form.jam_mulai}
                    onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })}
                  />
                  {form.jam_mulai && (() => {
                    const h = parseInt(form.jam_mulai.split(':')[0], 10);
                    if (h < 12) {
                      const targetH = String(h + 12).padStart(2, '0');
                      const m = form.jam_mulai.split(':')[1] || '00';
                      return (
                        <button
                          type="button"
                          onClick={() => shiftToNight('jam_mulai')}
                          style={{
                            marginTop: 4,
                            fontSize: '0.72rem',
                            color: '#2563eb',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: 500,
                          }}
                        >
                          🌙 Maksudnya malam ({targetH}:{m})? Klik di sini
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Jam Selesai</label>
                    {form.jam_selesai && (() => {
                      const ket = getKeteranganWaktu(form.jam_selesai);
                      if (!ket) return null;
                      return (
                        <span style={{ fontSize: '0.72rem', color: ket.canShiftToNight ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                          {ket.icon} {ket.text} ({form.jam_selesai})
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    type="time"
                    value={form.jam_selesai}
                    onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })}
                  />
                  {form.jam_selesai && (() => {
                    const h = parseInt(form.jam_selesai.split(':')[0], 10);
                    if (h < 12) {
                      const targetH = String(h + 12).padStart(2, '0');
                      const m = form.jam_selesai.split(':')[1] || '00';
                      return (
                        <button
                          type="button"
                          onClick={() => shiftToNight('jam_selesai')}
                          style={{
                            marginTop: 4,
                            fontSize: '0.72rem',
                            color: '#2563eb',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: 500,
                          }}
                        >
                          🌙 Maksudnya malam ({targetH}:{m})? Klik di sini
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div style={{ gridColumn: '1 / -1', marginTop: -4 }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    💡 Tips: Gunakan format 24 jam (misal <strong>20:00</strong> untuk jam 8 malam), atau pilih <strong>PM</strong> jika di HP Anda muncul opsi AM/PM.
                  </p>
                </div>
                <div className="form-group span-2">
                  <label>Ruangan</label>
                  <InlineSelect
                    minWidth="100%"
                    height="42px"
                    value={form.ruangan || ''}
                    onChange={(val) => setForm({ ...form, ruangan: val })}
                    options={ruanganOptions}
                  />
                  {ruanganList.length === 0 && (
                    <p className="form-hint form-hint--warn">
                      Belum ada daftar ruangan aktif di Master Data &rarr; Ruangan.
                    </p>
                  )}
                </div>
                <div className="form-group span-2">
                  <label>Kuota Peserta</label>
                  <input
                    type="number"
                    min={Math.max(2, peserta.length)}
                    value={form.max_siswa || ''}
                    onChange={(e) =>
                      setForm({ ...form, max_siswa: (e.target.value === '' ? 0 : parseInt(e.target.value, 10)) || 0 })
                    }
                    onBlur={() => {
                      const min = Math.max(2, peserta.length);
                      if (!form.max_siswa || form.max_siswa < min) {
                        setForm({ ...form, max_siswa: min });
                      }
                    }}
                  />
                  <p className="form-hint">
                    Kuota sama dengan jumlah peserta &rarr; sesi tertutup. Kuota lebih
                    besar &rarr; siswa lain masih bisa mendaftar sendiri.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* ── Kolom kanan: pemilih peserta ─────────────────────────────── */}
          <div className="modal-col modal-col--side">
            <section className="form-section">
              <h3 className="form-section__title">
                <i className="bi bi-people-fill" /> Peserta
                <span className="form-section__count">{peserta.length} siswa</span>
              </h3>

              <div className="form-group">
                <p className="form-hint">
                  Pilih satu atau beberapa kelas, lalu centang siswanya. Boleh
                  digabung lintas kelas maupun lintas tingkat.
                </p>

                <div className="kas-kelas-picker">
                  {kelasList.length === 0 ? (
                    <span className="kas-kelas-kosong">Memuat daftar kelas...</span>
                  ) : (
                    kelasList.map((k) => (
                      <button
                        type="button"
                        key={k.kelas}
                        className={`kas-kelas-chip ${kelasDipilih.includes(k.kelas) ? 'selected' : ''}`}
                        onClick={() => toggleKelas(k.kelas)}
                      >
                        {k.kelas}
                        <span className="kas-kelas-chip__n">{k.jumlah}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="teman-search">
                  <i className="bi bi-search" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa..."
                    value={kandidatQuery}
                    onChange={(e) => setKandidatQuery(e.target.value)}
                  />
                  {kandidatQuery && (
                    <button
                      type="button"
                      className="teman-search__clear"
                      onClick={() => setKandidatQuery('')}
                      title="Bersihkan"
                    >
                      <i className="bi bi-x" />
                    </button>
                  )}
                </div>

                <div className="kas-alat">
                  <div className="kas-alat__acak">
                    <input
                      type="number"
                      min={1}
                      value={jumlahAcak}
                      onChange={(e) => setJumlahAcak(Math.max(1, parseInt(e.target.value) || 1))}
                      aria-label="Jumlah siswa acak"
                    />
                    <button
                      type="button"
                      onClick={acakPeserta}
                      disabled={kandidatList.length === 0}
                      title="Ganti daftar peserta dengan siswa acak dari kandidat yang tampil"
                    >
                      <i className="bi bi-shuffle" /> Acak
                    </button>
                  </div>
                  <button
                    type="button"
                    className="kas-alat__kosong"
                    onClick={() => setPeserta([])}
                    disabled={peserta.length === 0}
                  >
                    Kosongkan
                  </button>
                </div>

                <div className="teman-list kas-list">
                  {kandidatLoading ? (
                    <p className="teman-empty">Memuat daftar siswa...</p>
                  ) : perKelas.length === 0 ? (
                    <p className="teman-empty">
                      {kelasDipilih.length === 0 && !kandidatQuery
                        ? 'Pilih kelas di atas, atau ketik nama siswa untuk mencari'
                        : 'Tidak ada siswa yang cocok'}
                    </p>
                  ) : (
                    perKelas.map(([kelas, daftar]) => {
                      const semuaMasuk = daftar.every((s) => terpilih.has(s.siswa_id));
                      return (
                        <div key={kelas} className="kas-grup">
                          <div className="kas-grup__head">
                            <span>{kelas} · {daftar.length} siswa</span>
                            <button type="button" onClick={() => toggleSeluruhKelas(daftar)}>
                              {semuaMasuk ? 'Batalkan semua' : 'Pilih semua'}
                            </button>
                          </div>
                          {daftar.map((s) => {
                            const dipilih = terpilih.has(s.siswa_id);
                            return (
                              <button
                                type="button"
                                key={s.siswa_id}
                                className={`teman-item ${dipilih ? 'selected' : ''}`}
                                onClick={() => toggleSiswa(s)}
                              >
                                <span className="teman-avatar">{s.nama?.charAt(0)}</span>
                                <span className="teman-meta">
                                  <span className="teman-nama">{s.nama}</span>
                                  <span className="teman-kelas">{s.kelas}</span>
                                </span>
                                <i className={`bi ${dipilih ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                              </button>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>

                {kandidatTotal.terpotong && (
                  <p className="form-hint">
                    Menampilkan {kandidatList.length} dari {kandidatTotal.total} siswa —
                    persempit dengan filter kelas atau kotak pencarian.
                  </p>
                )}

                {ringkasanTerpilih.length > 0 && (
                  <div className="anggota-terpilih">
                    <span className="anggota-terpilih__label">
                      Terpilih ({peserta.length})
                    </span>
                    <div className="anggota-chips">
                      {ringkasanTerpilih.map(([kelas, n]) => (
                        <span key={kelas} className="anggota-chip">
                          {kelas}: {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </ModalBody>

      <ModalFooter align="end">
        <Button variant="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          isLoading={submitting}
          icon={editSlotId ? 'save' : undefined}
          leftIcon={!editSlotId ? <i className="bi bi-calendar-check" /> : undefined}
        >
          {editSlotId ? 'Simpan Perubahan' : 'Buat Sesi'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
