'use client';

import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/ui/DatePicker';

export interface CalonAnggota {
  siswa_id: number;
  nisn: string;
  nama: string;
  kelas: string;
}

const MAX_CHIP_TAMPIL = 2;

interface CreateSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  editSlotId: string | null;
  isPengajuanSiswa: boolean;
  form: {
    mapel: string;
    topik: string;
    tanggal: string;
    jam_mulai: string;
    jam_selesai: string;
    max_siswa: number;
    guru_nip: string;
    target_kelas: string[];
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  mapelList: { id: string; nama: string }[];
  guruOptions: { nip: string; nama_guru: string }[];
  onSubmit: () => void;
  submitting?: boolean;
  // Siswa props
  anggota?: CalonAnggota[];
  toggleAnggota?: (t: CalonAnggota) => void;
  /** Toggle Target Kelas; ikut mencabut peserta di luar tingkat yang baru. */
  toggleTingkat?: (tingkat: string) => void;
  anggotaExpanded?: boolean;
  setAnggotaExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
  temanTingkat?: string | null;
  temanQuery?: string;
  setTemanQuery?: (q: string) => void;
  temanLoading?: boolean;
  temanList?: CalonAnggota[];
  temanTotal?: { total: number; terpotong: boolean };
}

export default function CreateSlotModal({
  isOpen,
  onClose,
  editSlotId,
  isPengajuanSiswa,
  form,
  setForm,
  mapelList,
  guruOptions,
  onSubmit,
  submitting = false,
  anggota = [],
  toggleAnggota = () => {},
  toggleTingkat = () => {},
  anggotaExpanded = false,
  setAnggotaExpanded = () => {},
  temanTingkat,
  temanQuery = '',
  setTemanQuery = () => {},
  temanLoading = false,
  temanList = [],
  temanTotal = { total: 0, terpotong: false },
}: CreateSlotModalProps) {
  const modalTitle = editSlotId
    ? 'Ubah Jadwal Klinik'
    : isPengajuanSiswa
    ? 'Ajukan Klinik Kelompok'
    : 'Ajukan Jadwal Klinik';

  const modalSubtitle = isPengajuanSiswa
    ? 'Pilih guru pengampu dan teman sekelompok Anda'
    : 'Buka slot klinik untuk diikuti siswa';

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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      variant={editSlotId ? 'edit' : 'add'}
      icon={isPengajuanSiswa ? 'people' : 'calendar-plus'}
      title={modalTitle}
      subtitle={modalSubtitle}
    >
      <ModalBody>
        <div className="modal-split-grid">
          {/* Kolom Kiri: Form Materi & Waktu */}
          <div className="modal-col">
            <section className="form-section">
              <h3 className="form-section__title">
                <i className="bi bi-journal-bookmark-fill" /> Materi
              </h3>
              <div className="form-group">
                <label>Mata Pelajaran</label>
                <select
                  className="jp__input w-full"
                  value={form.mapel}
                  onChange={(e) =>
                    setForm({ ...form, mapel: e.target.value, guru_nip: '' })
                  }
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.nama}>
                      {m.nama}
                    </option>
                  ))}
                </select>
              </div>

              {isPengajuanSiswa && (
                <div className="form-group">
                  <label>Guru Pengampu</label>
                  <select
                    className="jp__input w-full"
                    value={form.guru_nip}
                    onChange={(e) =>
                      setForm({ ...form, guru_nip: e.target.value })
                    }
                    disabled={!form.mapel}
                  >
                    <option value="">
                      {form.mapel
                        ? '-- Pilih Guru --'
                        : 'Pilih mata pelajaran dulu'}
                    </option>
                    {guruOptions.map((g) => (
                      <option key={g.nip} value={g.nip}>
                        {g.nama_guru}
                      </option>
                    ))}
                  </select>
                  {form.mapel && guruOptions.length === 0 && (
                    <p className="form-hint form-hint--warn">
                      Belum ada data guru pengampu untuk mapel ini. Hubungi admin.
                    </p>
                  )}
                </div>
              )}

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
                <i className="bi bi-clock-fill" /> Waktu Pelaksanaan
              </h3>
              <div className="form-row">
                <div className={`form-group ${isPengajuanSiswa ? 'span-2' : ''}`}>
                  <label>Tanggal</label>
                  <DatePicker
                    placement="top"
                    value={form.tanggal}
                    onChange={(v) => setForm({ ...form, tanggal: v })}
                  />
                </div>
                {!isPengajuanSiswa && (
                  <div className="form-group">
                    <label>Kuota Siswa</label>
                    <input
                      type="number"
                      min={2}
                      value={form.max_siswa || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          max_siswa: (e.target.value === '' ? 0 : parseInt(e.target.value, 10)) || 0,
                        })
                      }
                      onBlur={() => {
                        if (!form.max_siswa || form.max_siswa < 2) {
                          setForm({ ...form, max_siswa: 2 });
                        }
                      }}
                    />
                  </div>
                )}
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
                    onChange={(e) =>
                      setForm({ ...form, jam_mulai: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, jam_selesai: e.target.value })
                    }
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
              </div>
            </section>
          </div>

          {/* Kolom Kanan: Target Kelas & Peserta Siswa */}
          <div className="modal-col modal-col--side">
            {!isPengajuanSiswa && (
              <section className="form-section">
                <h3 className="form-section__title">
                  <i className="bi bi-mortarboard-fill" /> Target Kelas
                </h3>
                <div className="form-group">
                  <p className="form-hint">
                    Opsional — kosongkan bila terbuka untuk semua tingkat.
                  </p>
                  <div className="tingkat-picker">
                    {['X', 'XI', 'XII'].map((k) => {
                      const isChecked = form.target_kelas.includes(k);
                      return (
                        <button
                          type="button"
                          key={k}
                          className={`tingkat-chip ${
                            isChecked ? 'selected' : ''
                          }`}
                          aria-pressed={isChecked}
                          onClick={() => toggleTingkat?.(k)}
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            <section className="form-section">
              <h3 className="form-section__title">
                <i className="bi bi-people-fill" />{' '}
                {isPengajuanSiswa ? 'Anggota Kelompok' : 'Pilih Peserta Siswa'}
                {isPengajuanSiswa ? (
                  <span className="form-section__count">
                    {anggota.length + 1} peserta
                  </span>
                ) : (
                  <span
                    className={`form-section__count ${
                      anggota.length > form.max_siswa
                        ? 'form-section__count--warn'
                        : ''
                    }`}
                  >
                    {anggota.length} / {form.max_siswa} terpilih
                  </span>
                )}
              </h3>

              <div className="form-group">
                <p className="form-hint">
                  {isPengajuanSiswa
                    ? `Anda otomatis menjadi peserta. Pilih minimal 1 teman${
                        temanTingkat
                          ? ` dari angkatan kelas ${temanTingkat}`
                          : ' seangkatan'
                      } (boleh beda kelas).`
                    : 'Opsional — Daftarkan siswa secara langsung ke sesi klinik ini.'}
                </p>

                <div className="teman-search">
                  <i className="bi bi-search" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa atau kelas..."
                    value={temanQuery}
                    onChange={(e) => setTemanQuery(e.target.value)}
                  />
                  {temanQuery && (
                    <button
                      type="button"
                      className="teman-search__clear"
                      onClick={() => setTemanQuery('')}
                      title="Bersihkan"
                    >
                      <i className="bi bi-x" />
                    </button>
                  )}
                </div>

                <div className="teman-list">
                  {temanLoading ? (
                    <p className="teman-empty">Memuat daftar siswa...</p>
                  ) : temanList.length === 0 ? (
                    <p className="teman-empty">
                      {temanQuery
                        ? 'Siswa tidak ditemukan'
                        : isPengajuanSiswa
                        ? 'Kelas reguler Anda belum terdata — hubungi wali kelas'
                        : 'Pilih Target Kelas di atas, atau ketik nama siswa untuk mencari'}
                    </p>
                  ) : (
                    temanList.map((t) => {
                      const dipilih = anggota.some(
                        (a) => a.siswa_id === t.siswa_id
                      );
                      return (
                        <button
                          type="button"
                          key={t.siswa_id}
                          className={`teman-item ${dipilih ? 'selected' : ''}`}
                          onClick={() => toggleAnggota(t)}
                        >
                          <span className="teman-avatar">
                            {t.nama?.charAt(0)}
                          </span>
                          <span className="teman-meta">
                            <span className="teman-nama">{t.nama}</span>
                            <span className="teman-kelas">{t.kelas}</span>
                          </span>
                          <i
                            className={`bi ${
                              dipilih ? 'bi-check-circle-fill' : 'bi-circle'
                            }`}
                          />
                        </button>
                      );
                    })
                  )}
                </div>

                {temanTotal.terpotong && !temanQuery && (
                  <p className="form-hint">
                    Menampilkan {temanList.length} dari {temanTotal.total} siswa — gunakan kotak pencarian untuk menemukan siswa.
                  </p>
                )}

                {anggota.length > 0 && (
                  <div className="anggota-terpilih">
                    <span className="anggota-terpilih__label">Terpilih</span>
                    <div className="anggota-chips">
                      {(anggotaExpanded
                        ? anggota
                        : anggota.slice(0, MAX_CHIP_TAMPIL)
                      ).map((a) => (
                        <span key={a.siswa_id} className="anggota-chip">
                          {a.nama}
                          <button
                            type="button"
                            onClick={() => toggleAnggota(a)}
                            title="Hapus dari daftar"
                          >
                            <i className="bi bi-x" />
                          </button>
                        </span>
                      ))}
                      {anggota.length > MAX_CHIP_TAMPIL && (
                        <button
                          type="button"
                          className="anggota-chip anggota-chip--more"
                          onClick={() => setAnggotaExpanded((v) => !v)}
                        >
                          {anggotaExpanded
                            ? 'Ringkas'
                            : `+${anggota.length - MAX_CHIP_TAMPIL} lainnya`}
                          <i
                            className={`bi ${
                              anggotaExpanded
                                ? 'bi-chevron-up'
                                : 'bi-chevron-down'
                            }`}
                          />
                        </button>
                      )}
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
          leftIcon={
            !editSlotId ? <i className="bi bi-send-fill" /> : undefined
          }
        >
          {editSlotId ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
