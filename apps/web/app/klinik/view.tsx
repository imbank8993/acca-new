'use client';

import { useStickyState } from '@/hooks/useStickyState';
import { useTabParam } from '@/hooks/useTabParam';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Tab, { TabItem } from '@/components/ui/Tab';
import { FilterToolbar, FilterSelect, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar';
import { Button } from '@/components/ui/Button';
import { DesktopFab } from '@/components/ui/DesktopFab';
import { MobileFab } from '@/components/mobile';
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import HtmlPreviewModal from '@/components/ui/HtmlPreviewModal';

import { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { useCapabilities } from '@/hooks/use-capabilities';
import Swal from 'sweetalert2';
import { useModalBlur } from '@/components/ModalBlurProvider';
import { useFileViewer } from '@/components/useFileViewer';

import CreateSlotModal, { CalonAnggota } from './components/CreateSlotModal';
import AdminSesiModal, { AdminSesiForm, KelasOpsi } from './components/AdminSesiModal';
import AbsensiModal from './components/AbsensiModal';
import ReportModal from './components/ReportModal';
import ViewReportModal from './components/ViewReportModal';
import ParticipantsModal from './components/ParticipantsModal';
import './klinik.css';

interface KlinikPeserta {
  id: string;
  siswa_id: number;
  nama_siswa: string;
  kelas: string | null;
  status: string;
  /** H/S/I/A; null = belum diabsen (berbeda dari 'A'). */
  kehadiran?: string | null;
  kehadiran_at?: string | null;
  kehadiran_sumber?: 'MANDIRI' | 'GURU' | null;
}

/**
 * Parse JSON dari Response dengan aman. Jika server mengembalikan bukan-JSON
 * (mis. halaman error HTML 500), fungsi ini mengembalikan objek `{ ok: false }`
 * dengan pesan yang bisa dibaca manusia, bukan melempar SyntaxError teknis.
 */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `Server error (${res.status})` };
  }
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface KlinikSlot {
  id: string;
  guru_id: number;
  nama_guru: string;
  mapel: string;
  topik: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  max_siswa: number;
  status: 'pending_guru' | 'pending' | 'open' | 'full' | 'finished' | 'paid' | 'cancelled';
  catatan_penolakan?: string | null;
  initiator_type?: 'GURU' | 'SISWA' | 'ADMIN';
  initiator_siswa_id?: number;
  initiator_nama?: string | null;
  initiator_kelas?: string | null;
  klinik_peserta?: KlinikPeserta[];
  klinik_laporan?: any;
  guru?: { nip: string; nama: string };
  target_kelas?: string[] | null;
}

function getLaporan(slot: KlinikSlot): any {
  return Array.isArray(slot.klinik_laporan) ? slot.klinik_laporan[0] : slot.klinik_laporan;
}

/** Peserta minimal supaya sesi klinik sah dilaksanakan — sinkron dgn PESERTA_MINIMAL di API. */
const PESERTA_MINIMAL = 2;

/**
 * Pengajuan yang belum diputuskan final. Pengajuan kelompok siswa singgah dulu
 * di 'pending_guru' (menunggu kesediaan guru pengampu yang ditunjuk) sebelum
 * naik ke 'pending' (meja pemegang izin approve_slot). Sesi yang dibuka guru
 * lahir langsung di 'pending'. Sinkron dgn STATUS_PENGAJUAN di API.
 */
const STATUS_PENGAJUAN = ['pending', 'pending_guru'];

/** Status mentah dari DB tidak layak tampil apa adanya ("pending_guru"). */
const LABEL_STATUS: Record<string, string> = {
  pending_guru: 'Menunggu Guru',
  pending: 'Menunggu Admin',
  open: 'Dibuka',
  full: 'Penuh',
  finished: 'Selesai',
  paid: 'Lunas',
  cancelled: 'Batal',
};

const labelStatus = (status: string) => LABEL_STATUS[status] || status;

const pengajuanDitolak = (slot: KlinikSlot) =>
  slot.status === 'cancelled' && Boolean(slot.catatan_penolakan?.trim());

/** Kode kehadiran → label manusiawi. Sinkron dgn KEHADIRAN_VALID di API. */
const LABEL_KEHADIRAN: Record<string, string> = {
  H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa',
};

/** Status sesi yang sudah berjalan — sinkron dgn STATUS_BERJALAN di API. */
const STATUS_BERJALAN = ['open', 'full'];

/** Tingkat kelas reguler ("XII A" → "XII"), sepadan dgn tingkatKelas() di API. */
function tingkatKelas(kelas: string | null | undefined): string | null {
  const m = (kelas || '').match(/^(XII|XI|X)\s+[A-Z]$/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Jendela absensi mandiri — WAJIB sama dengan ABSENSI_TOLERANSI_* di
 * app/api/klinik/route.ts. Kalau kedua sisi berbeda, tombol "Saya Hadir" akan
 * tampil pada saat server justru menolaknya (atau sebaliknya, hilang padahal
 * masih boleh).
 */
const ABSENSI_TOLERANSI_AWAL_MENIT = 15;
const ABSENSI_TOLERANSI_AKHIR_MENIT = 60;

/**
 * Waktu dinding madrasah sebagai "YYYY-MM-DDTHH:mm".
 *
 * `skewMs` adalah selisih antara jam server (dikirim GET /api/klinik) dan jam
 * perangkat saat data dimuat. Dengan menambahkannya, perangkat yang jamnya
 * meleset — atau sengaja digeser agar tombol absen muncul — tetap melihat
 * keputusan yang sama dengan server.
 */
function waktuDindingSekarang(skewMs: number): string {
  const d = new Date(Date.now() + skewMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Memformat string jam agar selalu berbentuk "HH:mm".
 * Menangani format murni ("HH:mm", "HH:mm:ss") maupun ISO DateTime ("1970-01-01THH:mm:ss.000Z")
 * yang dihasilkan serialisasi tipe TIME PostgreSQL.
 */
export function formatJam(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim();
  if (s.includes('T')) {
    const parts = s.split('T');
    return (parts[1] || '').slice(0, 5);
  }
  return s.slice(0, 5);
}

/** Jendela absensi sebuah sesi sebagai waktu dinding, sepadan dgn jendelaAbsensi() di API. */
function jendelaAbsensi(slot: KlinikSlot): { mulai: string; selesai: string } {
  const geser = (jam: string, menit: number) => {
    const tgl = (slot.tanggal || '').includes('T') ? slot.tanggal.split('T')[0] : (slot.tanggal || '').slice(0, 10);
    const jm = formatJam(jam);
    if (!tgl || !jm) return '';
    const dasar = new Date(`${tgl}T${jm}:00Z`);
    if (Number.isNaN(dasar.getTime())) return '';
    return new Date(dasar.getTime() + menit * 60_000).toISOString().slice(0, 16);
  };
  return {
    mulai: geser(slot.jam_mulai, -ABSENSI_TOLERANSI_AWAL_MENIT),
    selesai: geser(slot.jam_selesai, ABSENSI_TOLERANSI_AKHIR_MENIT),
  };
}

/**
 * Parse string tanggal "YYYY-MM-DD" menjadi Date pada tengah hari lokal
 * agar terhindar dari pergeseran hari akibat UTC midnight di timezone tertentu.
 */
function parseTanggalTampil(tanggal?: string | null): Date {
  if (!tanggal) return new Date();
  return new Date(tanggal.includes('T') ? tanggal : `${tanggal}T12:00:00`);
}

/** Sesi yang jam selesainya sudah lewat (menurut jam perangkat pengguna). */
function sesiSudahLewat(slot: KlinikSlot): boolean {
  if (!slot.tanggal) return false;
  const tgl = slot.tanggal.includes('T') ? slot.tanggal.split('T')[0] : slot.tanggal.slice(0, 10);
  const jam = formatJam(slot.jam_selesai) || '23:59';
  const selesai = new Date(`${tgl}T${jam}:00`);
  return !Number.isNaN(selesai.getTime()) && selesai.getTime() < Date.now();
}

/**
 * Status kecukupan peserta sebuah sesi yang sudah disetujui. Selama sesi belum
 * lewat, kekurangan peserta hanya peringatan — siswa masih bisa mendaftar. Begitu
 * jadwalnya terlewat tanpa mencapai PESERTA_MINIMAL, klinik dianggap batal dan
 * guru tidak boleh mengajukan laporan (server menolaknya juga di update_report).
 */
function cekPeserta(slot: KlinikSlot): { kurang: number; batal: boolean } {
  if (slot.status !== 'open' && slot.status !== 'full') return { kurang: 0, batal: false };
  const kurang = Math.max(0, PESERTA_MINIMAL - (slot.klinik_peserta?.length || 0));
  return { kurang, batal: kurang > 0 && sesiSudahLewat(slot) };
}

/**
 * Judul salah satu dari dua bagian di tab Approval.
 *
 * Tab itu memuat dua antrean yang sama sekali berbeda — pengajuan SESI dan
 * pengesahan LAPORAN — tapi sebelumnya hanya bagian laporan yang berjudul,
 * sehingga daftar sesi (berikut empty state-nya) menggantung tanpa keterangan
 * apa pun dan seolah menjadi bagian dari blok laporan di bawahnya.
 *
 * Di lingkup modul, bukan di dalam KlinikPage: komponen yang didefinisikan
 * ulang tiap render akan berganti identitas dan DOM-nya ikut di-remount.
 */
function SeksiApproval({ ikon, judul, deskripsi, jumlah, nada }: {
  ikon: string;
  judul: string;
  deskripsi: string;
  jumlah: number;
  nada: 'sesi' | 'laporan';
}) {
  return (
    <div className={`apr-seksi apr-seksi--${nada}`}>
      <span className="apr-seksi__ikon" aria-hidden="true">
        <i className={`bi ${ikon}`} />
      </span>
      <div className="apr-seksi__teks">
        <h3>{judul}</h3>
        <p>{deskripsi}</p>
      </div>
      <span
        className={`apr-seksi__hitung ${jumlah > 0 ? 'ada' : ''}`}
        title={`${jumlah} menunggu tindakan`}
      >
        {jumlah}
      </span>
    </div>
  );
}

function KlinikPage({ user: initialUser }: { user?: any } = {}) {
  const { openFile, viewer } = useFileViewer();
  // Izin per-fungsi. Selama masih dimuat, `can()` menjawab false — tombol yang
  // butuh izin baru muncul setelah izinnya pasti, bukan berkedip lebih dulu.
  const { can, isAdmin } = useCapabilities();
  const [user, setUser] = useState<any>(initialUser || null);
  const [slots, setSlots] = useState<KlinikSlot[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);
  const [guruMapelList, setGuruMapelList] = useState<{ nip: string; nama_guru: string; nama_mapel: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Guard untuk mencegah klik ganda / race condition pada aksi
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialUser) setUser(initialUser);
  }, [initialUser]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterMapel, setFilterMapel] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useTabParam<'available' | 'my_sessions' | 'kelompok' | 'approval' | 'kelola' | 'rekap'>('available', [
    'available', 'my_sessions', 'kelompok', 'approval', 'kelola', 'rekap'
  ]);

  // Selisih jam server (zona madrasah) vs jam perangkat, dipakai jendela absensi.
  const [skewMs, setSkewMs] = useState(0);
  const [tick, setTick] = useState(0);
  // Menit berjalan: tanpa ini tombol "Saya Hadir" baru muncul setelah refresh.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const sekarang = useMemo(() => waktuDindingSekarang(skewMs), [skewMs, tick]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAbsensiModal, setShowAbsensiModal] = useState<KlinikSlot | null>(null);
  const [savingAbsensi, setSavingAbsensi] = useState(false);
  const [absenLoadingId, setAbsenLoadingId] = useState<string | null>(null);
  const [editSlotId, setEditSlotId] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<KlinikSlot | null>(null);
  const [deletingSlot, setDeletingSlot] = useState(false);
  const [showReportModal, setShowReportModal] = useState<KlinikSlot | null>(null);
  const [showViewReportModal, setShowViewReportModal] = useState<KlinikSlot | null>(null);
  const [showParticipantsModal, setShowParticipantsModal] = useState<KlinikSlot | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // ── Sesi bentukan admin ──────────────────────────────────────────────────
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEditSlotId, setAdminEditSlotId] = useState<string | null>(null);
  const [savingAdminSesi, setSavingAdminSesi] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminSesiForm>({
    mapel: '', guru_nip: '', topik: '', tanggal: '', jam_mulai: '', jam_selesai: '', max_siswa: 5,
  });
  const [adminPeserta, setAdminPeserta] = useState<CalonAnggota[]>([]);
  const [kelasList, setKelasList] = useState<KelasOpsi[]>([]);
  const [kelasDipilih, setKelasDipilih] = useState<string[]>([]);
  const [kandidatList, setKandidatList] = useState<CalonAnggota[]>([]);
  const [kandidatQuery, setKandidatQuery] = useState('');
  const [kandidatLoading, setKandidatLoading] = useState(false);
  const [kandidatTotal, setKandidatTotal] = useState({ total: 0, terpotong: false });

  // Rekap bulanan kolektif (tab Laporan)
  const [rekapBulan, setRekapBulan] = useState(new Date().getMonth() + 1);
  const [rekapTahun, setRekapTahun] = useState(new Date().getFullYear());
  const [rekapSemua, setRekapSemua] = useState(false);
  const [rekapLoading, setRekapLoading] = useState<'preview' | 'pdf' | null>(null);
  const [loadingPreviewSlotId, setLoadingPreviewSlotId] = useState<string | null>(null);
  const [printingPdfSlotId, setPrintingPdfSlotId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [reportForm, setReportForm] = useState({
    materi: '',
    fotos: [] as string[],
  });
  const [laporanNote, setLaporanNote] = useState<Record<string, string>>({});

  // Modal blur integration
  const { openModal, closeModal } = useModalBlur();
  useEffect(() => {
    const isOpen = showCreateModal || showAdminModal || showAbsensiModal || showReportModal || previewHtml || showParticipantsModal || showViewReportModal || !!slotToDelete;
    if (isOpen) {
      openModal();
    } else {
      closeModal();
    }
    return () => closeModal();
  }, [showCreateModal, showAdminModal, showAbsensiModal, showReportModal, previewHtml, showParticipantsModal, showViewReportModal, slotToDelete, openModal, closeModal]);

  const openParticipants = (id: string) => {
    setShowParticipantsModal(slots.find((s) => s.id === id) || null);
  };

  const openReportModal = (slot: KlinikSlot) => {
    const laporan = getLaporan(slot);
    setReportForm({
      materi: laporan?.materi_disampaikan || '',
      fotos: laporan?.foto_bukti || [],
    });
    setShowReportModal(slot);
  };

  // Form states
  const [form, setForm] = useState({
    mapel: '',
    topik: '',
    tanggal: '',
    jam_mulai: '',
    jam_selesai: '',
    max_siswa: 5,
    guru_nip: '',
    target_kelas: [] as string[],
  });

  /** Buka modal slot baru dengan form kosong — dipakai FAB guru & tombol siswa. */
  const openCreateSlot = () => {
    setEditSlotId(null);
    setForm({ mapel: '', topik: '', tanggal: '', jam_mulai: '', jam_selesai: '', max_siswa: 5, guru_nip: '', target_kelas: [] });
    setShowCreateModal(true);
  };

  // Pemilihan anggota kelompok (siswa)
  const [temanList, setTemanList] = useState<CalonAnggota[]>([]);
  const [temanQuery, setTemanQuery] = useState('');
  const [temanTingkat, setTemanTingkat] = useState<string | null>(null);
  const [temanTotal, setTemanTotal] = useState<{ total: number; terpotong: boolean }>({ total: 0, terpotong: false });
  const [temanLoading, setTemanLoading] = useState(false);
  const [anggota, setAnggota] = useState<CalonAnggota[]>([]);
  const [anggotaExpanded, setAnggotaExpanded] = useState(false);

  useEffect(() => {
    fetchUserAndSlots();
    fetchOptions();
  }, []);

  async function fetchOptions() {
    try {
      const res = await fetch('/api/klinik?action=options');
      const json = await safeJson(res);
      if (json.ok) {
        setMapelList(json.data.mapel || []);
        setGuruMapelList(json.data.guru_mapel || []);
      }
    } catch (err) {
      console.error('Gagal mengambil opsi klinik:', err);
    }
  }

  async function fetchUserAndSlots(silent = false) {
    if (!silent) setLoading(true);
    try {
      let activeUser = user || initialUser;
      if (!activeUser) {
        const meRes = await fetch('/api/auth/me');
        const meJson = await safeJson(meRes);
        // /api/auth/me mengembalikan { ok, user }, bukan { ok, data }.
        if (meJson.ok && meJson.user) {
          activeUser = meJson.user;
          setUser(activeUser);
        }
      } else if (!user && initialUser) {
        setUser(initialUser);
      }

      if (activeUser) {
        // Cakupan sesi yang boleh dilihat sekarang diputuskan server dari
        // identitas terverifikasi, bukan dari parameter role kiriman browser.
        const res = await fetch('/api/klinik');
        const json = await safeJson(res);
        if (json.ok) {
          setSlots(json.data);
          // Jam server dipakai sebagai acuan jendela absensi; yang disimpan
          // selisihnya, supaya waktunya tetap berjalan tanpa polling.
          if (json.now) {
            const serverMs = new Date(json.now).getTime();
            if (!Number.isNaN(serverMs)) setSkewMs(serverMs - Date.now());
          }
        }
      }
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const openEditModal = (slot: KlinikSlot) => {
    setEditSlotId(slot.id);
    setForm({
      mapel: slot.mapel,
      topik: slot.topik,
      tanggal: slot.tanggal ? (slot.tanggal.includes('T') ? slot.tanggal.split('T')[0] : slot.tanggal.slice(0, 10)) : '',
      jam_mulai: formatJam(slot.jam_mulai),
      jam_selesai: formatJam(slot.jam_selesai),
      max_siswa: slot.max_siswa,
      guru_nip: slot.guru?.nip || '',
      target_kelas: slot.target_kelas || [],
    });
    // Pengajuan kelompok: seluruh peserta adalah anggota yang ditunjuk pengaju
    // (pengaju sendiri tidak bisa dikeluarkan, jadi disaring).
    // Sesi guru: yang boleh disunting di sini HANYA peserta yang ditugaskan —
    // siswa yang mendaftar sendiri dikelola lewat modal Peserta, dan server pun
    // sengaja tidak menyentuh baris 'registered' saat menyinkronkan.
    const pengajuan = slot.initiator_type === 'SISWA';
    setAnggota(
      (slot.klinik_peserta || [])
        .filter((p) => (pengajuan ? p.siswa_id !== slot.initiator_siswa_id : p.status === 'ditugaskan'))
        .map((p) => ({ siswa_id: p.siswa_id, nisn: '', nama: p.nama_siswa, kelas: p.kelas || '' }))
    );
    setAnggotaExpanded(false);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setEditSlotId(null);
    setForm({ mapel: '', topik: '', tanggal: '', jam_mulai: '', jam_selesai: '', max_siswa: 5, guru_nip: '', target_kelas: [] });
    setAnggota([]);
    setAnggotaExpanded(false);
    setTemanQuery('');
    setTemanList([]);
    setTemanTotal({ total: 0, terpotong: false });
  };

  async function confirmDeleteSlot() {
    if (!slotToDelete) return;
    setDeletingSlot(true);
    try {
      const res = await fetch('/api/klinik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_slot', slot_id: slotToDelete.id }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Terhapus', 'Sesi klinik berhasil dihapus.', 'success');
        setSlotToDelete(null);
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal menghapus sesi', 'error');
      }
    } catch (err: any) {
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setDeletingSlot(false);
    }
  }

  // IDENTITAS (siapa dia) — menentukan BENTUK tampilan, bukan izin.
  const roles = Array.isArray(user?.roles) ? user.roles.map((r: string) => r.toUpperCase()) : (user?.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
  const isGuru = roles.includes('GURU');
  const isSiswa = roles.includes('SISWA');
  const isPengajuanSiswa = isSiswa && !isGuru;

  // IZIN (boleh apa) — dari penunjukan petugas di tab Pengaturan, bukan dari
  // nama role. Dulu satu `isAdmin` (ADMIN/OP_KLINIK/WKM_AKADEMIK) mengendalikan
  // semuanya sekaligus, sehingga tidak mungkin memberi seseorang approval saja
  // tanpa sekalian memberi kuasa membentuk sesi dan mencetak rekap.
  const bisaKelolaSesi = can('klinik.kelola_sesi');
  const bisaApproveSesi = can('klinik.approve_slot');
  const bisaApproveLaporan = can('klinik.approve_laporan');
  const bisaRekap = can('klinik.rekap');

  const isSameId = (a: any, b: any) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

  const bisaLihatLaporan = (slot: KlinikSlot) =>
    bisaRekap || isSameId(slot.guru_id, user?.id) || (slot.klinik_peserta || []).some((p) => isSameId(p.siswa_id, user?.id));

  /** Baris peserta milik pengguna yang sedang login pada sebuah sesi. */
  const pesertaSaya = (slot: KlinikSlot) =>
    (slot.klinik_peserta || []).find((p) => isSameId(p.siswa_id, user?.id));

  /** Guru pengampu sesi ini atau pengelola klinik — berhak mengisi absensi. */
  const bisaKelolaAbsensi = (slot: KlinikSlot) =>
    bisaKelolaSesi || (isGuru && isSameId(slot.guru_id, user?.id));

  /**
   * Jendela absensi sesi ini sedang terbuka? Keputusan finalnya tetap di server;
   * ini hanya menentukan apakah tombolnya pantas ditampilkan.
   */
  const absensiTerbuka = (slot: KlinikSlot) => {
    if (!STATUS_BERJALAN.includes(slot.status)) return false;
    const { mulai, selesai } = jendelaAbsensi(slot);
    return !!mulai && !!selesai && sekarang >= mulai && sekarang <= selesai;
  };

  // Tiap tab menempel pada izinnya sendiri: pemeriksa laporan tidak otomatis
  // ikut mendapat tab Kelola Sesi, dan sebaliknya.
  const tabDiizinkan = [
    'available',
    ...(isGuru ? ['my_sessions'] : []),
    ...(isSiswa && !isGuru ? ['kelompok'] : []),
    ...(bisaApproveSesi || bisaApproveLaporan ? ['approval'] : []),
    ...(bisaKelolaSesi ? ['kelola'] : []),
    ...(bisaRekap ? ['rekap'] : []),
  ];

  const tabAktif = tabDiizinkan.includes(activeTab) ? activeTab : 'available';
  useEffect(() => {
    if (user && activeTab !== tabAktif) setActiveTab(tabAktif as typeof activeTab);
  }, [user, activeTab, tabAktif, setActiveTab]);

  useEffect(() => {
    if (!showCreateModal) return;

    // Siswa selalu melihat daftar teman seangkatannya. Pembentuk sesi harus
    // menyebut tingkat atau kata kunci lebih dulu: tanpa penyaring apa pun,
    // server terpaksa memindai seluruh tabel enrolment (lihat getKandidatSiswa).
    const targetKelas = (form.target_kelas || []).join(',');
    const kueri = temanQuery.trim();
    if (!isPengajuanSiswa && !targetKelas && !kueri) {
      setTemanList([]);
      setTemanTotal({ total: 0, terpotong: false });
      setTemanLoading(false);
      return;
    }

    const controller = new AbortController();
    setTemanLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/klinik?action=teman&q=${encodeURIComponent(kueri)}&target_kelas=${encodeURIComponent(targetKelas)}`,
          { signal: controller.signal }
        );
        const json = await safeJson(res);
        if (controller.signal.aborted) return;
        if (json?.ok) {
          setTemanList(json.data || []);
          setTemanTingkat(json.tingkat || null);
          setTemanTotal({ total: json.total || 0, terpotong: !!json.terpotong });
        } else {
          // Daftar yang basi lebih menyesatkan daripada daftar kosong.
          setTemanList([]);
          setTemanTotal({ total: 0, terpotong: false });
          console.warn('Gagal mengambil daftar siswa:', json?.error || res.status);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          console.warn('Gagal mengambil daftar siswa:', err?.message || err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setTemanLoading(false);
        }
      }
    }, kueri ? 350 : 0);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [showCreateModal, isPengajuanSiswa, temanQuery, form.target_kelas]);

  /** Guru pengampu yang ditawarkan untuk sebuah mapel (jatuh ke semua guru bila kosong). */
  const guruUntukMapel = (mapel: string) => {
    if (!mapel) return [];
    const cocok = guruMapelList.filter((g) => g.nama_mapel === mapel);
    const sumber = cocok.length > 0 ? cocok : guruMapelList;
    const unik = new Map<string, { nip: string; nama_guru: string }>();
    for (const g of sumber) {
      if (g.nip && !unik.has(g.nip)) unik.set(g.nip, { nip: g.nip, nama_guru: g.nama_guru });
    }
    return [...unik.values()].sort((a, b) => (a.nama_guru || '').localeCompare(b.nama_guru || ''));
  };

  const guruOptions = useMemo(() => guruUntukMapel(form.mapel), [form.mapel, guruMapelList]); // eslint-disable-line react-hooks/exhaustive-deps
  const guruOptionsAdmin = useMemo(() => guruUntukMapel(adminForm.mapel), [adminForm.mapel, guruMapelList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Daftar kelas dimuat sekali saat modal admin pertama kali dibuka.
  useEffect(() => {
    if (!showAdminModal || kelasList.length > 0) return;
    (async () => {
      try {
        const res = await fetch('/api/klinik?action=kelas');
        const json = await safeJson(res);
        if (json.ok) setKelasList(json.data || []);
      } catch (err) {
        console.error('Gagal mengambil daftar kelas:', err);
      }
    })();
  }, [showAdminModal, kelasList.length]);

  // Kandidat peserta mengikuti kelas terpilih + kata kunci.
  useEffect(() => {
    if (!showAdminModal) return;
    if (kelasDipilih.length === 0 && !kandidatQuery.trim()) {
      setKandidatList([]);
      setKandidatTotal({ total: 0, terpotong: false });
      return;
    }
    const controller = new AbortController();
    setKandidatLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ action: 'kandidat' });
        if (kelasDipilih.length > 0) params.set('kelas', kelasDipilih.join(','));
        if (kandidatQuery.trim()) params.set('q', kandidatQuery.trim());
        const res = await fetch(`/api/klinik?${params.toString()}`, { signal: controller.signal });
        const json = await safeJson(res);
        if (controller.signal.aborted) return;
        if (json.ok) {
          setKandidatList(json.data || []);
          setKandidatTotal({ total: json.total || 0, terpotong: !!json.terpotong });
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Gagal mengambil kandidat peserta:', err);
        }
      } finally {
        if (!controller.signal.aborted) setKandidatLoading(false);
      }
    }, kandidatQuery ? 350 : 0);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [showAdminModal, kelasDipilih, kandidatQuery]);

  const toggleAnggota = (t: CalonAnggota) => {
    const sudahAda = anggota.some((a) => a.siswa_id === t.siswa_id);
    if (sudahAda) {
      setAnggota((prev) => prev.filter((a) => a.siswa_id !== t.siswa_id));
      return;
    }
    // Pemeriksaan kuota sengaja di luar updater: fungsi updater harus murni,
    // dan React boleh menjalankannya lebih dari sekali (StrictMode) — dialognya
    // akan muncul dobel kalau dipanggil dari dalam sana.
    if (!isPengajuanSiswa && anggota.length >= form.max_siswa) {
      Swal.fire(
        'Kuota Terlampaui',
        `Peserta terpilih tidak boleh melebihi Kuota Siswa (${form.max_siswa}). Naikkan kuota atau hapus peserta yang sudah dipilih.`,
        'warning'
      );
      return;
    }
    setAnggota((prev) => [...prev, t]);
  };

  /**
   * Target Kelas membatasi siapa yang boleh ikut sesi, jadi peserta terpilih di
   * luar tingkat yang baru ikut dicabut. Tanpa ini chip-nya tetap terpasang,
   * ikut terkirim saat simpan, lalu ditolak server sebagai peserta di luar
   * target — atau, sebelum validasi itu ada, diam-diam masuk ke sesi.
   */
  const toggleTingkat = (tingkat: string) => {
    const target = form.target_kelas.includes(tingkat)
      ? form.target_kelas.filter((tk) => tk !== tingkat)
      : [...form.target_kelas, tingkat];
    setForm({ ...form, target_kelas: target });

    if (target.length === 0) return;
    const dicabut = anggota.filter((a) => !target.includes(tingkatKelas(a.kelas) || ''));
    if (dicabut.length === 0) return;

    setAnggota((prev) => prev.filter((a) => target.includes(tingkatKelas(a.kelas) || '')));
    Swal.fire(
      'Peserta Disesuaikan',
      `${dicabut.length} peserta di luar kelas ${target.join(', ')} dikeluarkan dari pilihan: `
        + dicabut.map((a) => a.nama).join(', '),
      'info'
    );
  };

  /** Buka modal pembentukan sesi oleh admin dengan form kosong. */
  const openAdminSesi = () => {
    setAdminEditSlotId(null);
    setAdminForm({ mapel: '', guru_nip: '', topik: '', tanggal: '', jam_mulai: '', jam_selesai: '', max_siswa: 5 });
    setAdminPeserta([]);
    setKelasDipilih([]);
    setKandidatQuery('');
    setShowAdminModal(true);
  };

  const openEditAdminSesi = (slot: KlinikSlot) => {
    setAdminEditSlotId(slot.id);
    setAdminForm({
      mapel: slot.mapel,
      guru_nip: slot.guru?.nip || '',
      topik: slot.topik,
      tanggal: slot.tanggal ? (slot.tanggal.includes('T') ? slot.tanggal.split('T')[0] : slot.tanggal.slice(0, 10)) : '',
      jam_mulai: formatJam(slot.jam_mulai),
      jam_selesai: formatJam(slot.jam_selesai),
      max_siswa: slot.max_siswa,
    });
    const pesertaAwal = (slot.klinik_peserta || []).map((p) => ({
      siswa_id: p.siswa_id, nisn: '', nama: p.nama_siswa, kelas: p.kelas || '',
    }));
    setAdminPeserta(pesertaAwal);
    // Kelas peserta ikut dipilih supaya daftarnya langsung tampil saat disunting.
    setKelasDipilih([...new Set(pesertaAwal.map((p) => p.kelas).filter(Boolean))]);
    setKandidatQuery('');
    setShowAdminModal(true);
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminEditSlotId(null);
    setAdminPeserta([]);
    setKelasDipilih([]);
    setKandidatQuery('');
    setKandidatList([]);
  };

  async function handleSubmitAdminSesi() {
    const { mapel, guru_nip, topik, tanggal, jam_mulai, jam_selesai } = adminForm;
    if (!mapel || !guru_nip || !topik.trim() || !tanggal || !jam_mulai || !jam_selesai) {
      Swal.fire('Data Belum Lengkap', 'Mapel, guru pengampu, topik, tanggal, dan jam wajib diisi', 'warning');
      return;
    }
    if (jam_selesai <= jam_mulai) {
      Swal.fire('Jam Tidak Valid', 'Jam selesai harus setelah jam mulai', 'warning');
      return;
    }
    if (adminPeserta.length < PESERTA_MINIMAL) {
      Swal.fire('Peserta Kurang', `Pilih minimal ${PESERTA_MINIMAL} siswa sebagai peserta sesi`, 'warning');
      return;
    }

    setSavingAdminSesi(true);
    try {
      const anggota = adminPeserta.map((p) => p.siswa_id);
      const body = adminEditSlotId
        ? { action: 'update_slot', slot_id: adminEditSlotId, payload: { ...adminForm, anggota } }
        : { action: 'create_slot_admin', ...adminForm, anggota };

      const res = await fetch('/api/klinik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire(
          'Berhasil',
          adminEditSlotId
            ? 'Sesi klinik berhasil diperbarui'
            : `Sesi klinik dibuat dengan ${anggota.length} peserta. Guru pengampu dan peserta sudah dikabari.`,
          'success'
        );
        closeAdminModal();
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal menyimpan sesi', 'error');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSavingAdminSesi(false);
    }
  }

  /** Siswa menyatakan kehadirannya sendiri. Jendela waktunya diputuskan server. */
  async function handleAbsenMandiri(slotId: string) {
    setAbsenLoadingId(slotId);
    try {
      const res = await fetch('/api/klinik', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'absen_mandiri', slot_id: slotId }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Kehadiran Tercatat', 'Terima kasih, kehadiran Anda sudah dicatat.', 'success');
        fetchUserAndSlots();
      } else {
        Swal.fire('Belum Bisa Absen', json.error || 'Gagal mencatat kehadiran', 'warning');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Gagal mencatat kehadiran', 'error');
    } finally {
      setAbsenLoadingId(null);
    }
  }

  async function handleSimpanAbsensi(entries: { siswa_id: number; kehadiran: string | null }[]) {
    if (!showAbsensiModal) return;
    setSavingAbsensi(true);
    try {
      const res = await fetch('/api/klinik', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'absen_guru', slot_id: showAbsensiModal.id, entries }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', 'Absensi telah disimpan', 'success');
        setShowAbsensiModal(null);
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal menyimpan absensi', 'error');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Gagal menyimpan absensi', 'error');
    } finally {
      setSavingAbsensi(false);
    }
  }

  async function handleCreateSlot() {
    if (!user) return;
    if (!form.mapel || !form.topik.trim() || !form.tanggal || !form.jam_mulai || !form.jam_selesai) {
      Swal.fire('Data Belum Lengkap', 'Mapel, topik, tanggal, dan jam wajib diisi', 'warning');
      return;
    }
    if (form.jam_selesai <= form.jam_mulai) {
      Swal.fire('Jam Tidak Valid', 'Jam selesai harus setelah jam mulai', 'warning');
      return;
    }
    if (!isPengajuanSiswa && form.max_siswa < 2) {
      Swal.fire('Kuota Tidak Valid', 'Kuota peserta klinik minimal harus 2 siswa', 'warning');
      return;
    }
    if (!isPengajuanSiswa && anggota.length > form.max_siswa) {
      Swal.fire(
        'Kuota Terlampaui',
        `Jumlah peserta terpilih (${anggota.length}) melebihi kuota siswa (${form.max_siswa}). Hapus sebagian peserta atau naikkan kuota.`,
        'warning'
      );
      return;
    }
    if (isPengajuanSiswa && !form.guru_nip) {
      Swal.fire('Data Belum Lengkap', 'Pilih guru pengampu terlebih dahulu', 'warning');
      return;
    }
    if (isPengajuanSiswa && anggota.length < 1) {
      Swal.fire('Anggota Kelompok Kosong', 'Pilih minimal 1 teman untuk klinik kelompok', 'warning');
      return;
    }
    // Tanpa penjaga ini, klik ganda pada koneksi lambat mengirim dua POST
    // create_slot dan melahirkan dua sesi kembar.
    if (savingSlot) return;
    setSavingSlot(true);
    try {
      const anggotaIds = anggota.map((a) => a.siswa_id);
      const payloadData = editSlotId
        ? { action: 'update_slot', slot_id: editSlotId, payload: { ...form, anggota: anggotaIds } }
        : { action: 'create_slot', guru_id: user.id, nama_guru: user.nama, ...form, anggota: anggotaIds };

      const res = await fetch('/api/klinik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadData),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire(
          'Berhasil',
          editSlotId
            ? 'Jadwal berhasil diperbarui'
            : isSiswa && !isGuru
            ? 'Pengajuan klinik kelompok telah dikirim ke Admin'
            : 'Jadwal klinik telah diajukan ke Admin',
          'success'
        );
        closeCreateModal();
        if (!editSlotId) {
          setActiveTab(isSiswa && !isGuru ? 'kelompok' : 'my_sessions');
        }
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal menyimpan jadwal klinik', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleJoinRequest(slotId: string) {
    if (actionLoadingId) return;
    const confirm = await Swal.fire({
      title: 'Gabung Pengajuan Klinik?',
      text: 'Anda akan bergabung ke pengajuan klinik kelompok ini.',
      icon: 'question',
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;
    setActionLoadingId(`join_${slotId}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_request', slot_id: slotId }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', 'Anda telah bergabung ke pengajuan ini', 'success');
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal bergabung', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleApproveLaporan(laporanId: string, laporanAction: 'approve' | 'revisi') {
    if (actionLoadingId) return;
    if (laporanAction === 'revisi' && !laporanNote[laporanId]?.trim()) {
      Swal.fire('Catatan Wajib', 'Isi alasan pengembalian laporan terlebih dahulu', 'warning');
      return;
    }
    const confirm = await Swal.fire({
      title: laporanAction === 'approve' ? 'Setujui Laporan?' : 'Kembalikan Laporan?',
      icon: laporanAction === 'approve' ? 'question' : 'warning',
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;
    setActionLoadingId(`laporan_${laporanId}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_laporan', id: laporanId, laporanAction, catatan: laporanNote[laporanId] || '' }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', laporanAction === 'approve' ? 'Laporan telah disetujui' : 'Laporan telah dikembalikan', 'success');
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal memproses laporan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRegister(slotId: string) {
    if (!user || actionLoadingId) return;
    const confirm = await Swal.fire({
      title: 'Konfirmasi Pendaftaran',
      text: 'Apakah Anda yakin ingin mendaftar di klinik ini?',
      icon: 'question',
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;

    setActionLoadingId(`register_${slotId}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', slot_id: slotId }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', 'Anda telah terdaftar di klinik ini', 'success');
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mendaftar', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  /**
   * Gerbang pertama pengajuan kelompok siswa: guru pengampu yang ditunjuk
   * menyatakan bersedia (pengajuan naik ke reviewer) atau menolak (pengajuan
   * batal). Penolakan wajib beralasan supaya siswa tahu duduk perkaranya.
   */
  async function handleApproveGuru(id: string, guruAction: 'terima' | 'tolak') {
    if (actionLoadingId) return;
    let catatan = '';
    if (guruAction === 'tolak') {
      const input = await Swal.fire({
        title: 'Tidak Bersedia Mengampu?',
        input: 'textarea',
        inputLabel: 'Alasan (akan dibaca siswa pengaju)',
        inputPlaceholder: 'Mis. bentrok dengan jadwal mengajar...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Kirim Penolakan',
        cancelButtonText: 'Batal',
        inputValidator: (v) => (!v?.trim() ? 'Alasan wajib diisi' : undefined),
      });
      if (!input.isConfirmed) return;
      catatan = input.value || '';
    } else {
      const confirm = await Swal.fire({
        title: 'Bersedia Mengampu Klinik Ini?',
        text: 'Pengajuan akan diteruskan ke Admin untuk persetujuan akhir.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Bersedia',
        cancelButtonText: 'Batal',
      });
      if (!confirm.isConfirmed) return;
    }

    setActionLoadingId(`guru_${id}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_guru', id, guruAction, catatan }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire(
          'Berhasil',
          guruAction === 'terima'
            ? 'Kesediaan Anda tercatat. Pengajuan diteruskan ke Admin.'
            : 'Pengajuan telah ditolak dan siswa pengaju sudah dikabari.',
          'success'
        );
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal memproses pengajuan', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal memproses pengajuan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleApprove(id: string, status: 'open' | 'cancelled') {
    if (actionLoadingId) return;
    if (status === 'open') {
      // Hanya pengajuan kelompok siswa yang wajib sudah punya peserta. Sesi guru
      // memang disetujui dalam keadaan kosong lalu diisi lewat pendaftaran —
      // lihat catatan di approve_slot pada app/api/klinik/route.ts.
      const slot = slots.find((s) => s.id === id);
      if (slot?.initiator_type === 'SISWA' && (slot.klinik_peserta?.length || 0) < PESERTA_MINIMAL) {
        Swal.fire('Tidak Dapat Disetujui', `Pengajuan kelompok minimal harus memiliki ${PESERTA_MINIMAL} peserta untuk dapat disetujui.`, 'warning');
        return;
      }
    }

    // Penolakan wajib beralasan — slot yang dibatalkan langsung hilang dari tab
    // yang bisa dilihat pengaju, jadi catatan ini satu-satunya penjelasan yang
    // sampai ke guru/siswa lewat notifikasi.
    let catatan = '';
    if (status === 'cancelled') {
      const input = await Swal.fire({
        title: 'Tolak Pengajuan Klinik?',
        input: 'textarea',
        inputLabel: 'Alasan penolakan',
        inputPlaceholder: 'Mis. bentrok dengan agenda madrasah...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Tolak Pengajuan',
        cancelButtonText: 'Batal',
        inputValidator: (v) => (!v?.trim() ? 'Alasan wajib diisi' : undefined),
      });
      if (!input.isConfirmed) return;
      catatan = input.value || '';
    }

    setActionLoadingId(`approve_${id}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_slot', id, status, catatan }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', `Slot klinik telah ${status === 'open' ? 'disetujui' : 'dibatalkan'}`, 'success');
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal mengupdate status', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mengupdate status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancel(slotId: string, siswaId: number, name: string) {
    if (actionLoadingId) return;
    setActionLoadingId(`cancel_${slotId}_${siswaId}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_registration',
          slot_id: slotId,
          siswa_id: siswaId,
        }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', 'Pendaftaran telah dibatalkan', 'success');
        setShowParticipantsModal(null);
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal', json.error || 'Gagal memproses pembatalan', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal memproses pembatalan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'klinik-dokumentasi');
    formData.append('customName', `klinik_${showReportModal?.id}_${Date.now()}`);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await safeJson(res);
      if (json.ok && json.publicUrl) {
        setReportForm((prev) => ({
          ...prev,
          fotos: [...prev.fotos, json.publicUrl],
        }));
        Swal.fire('Berhasil', 'Foto berhasil diunggah', 'success');
      } else {
        Swal.fire('Gagal', json.error || 'Gagal mengunggah ke server', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal mengunggah foto', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveReport() {
    if (!showReportModal || actionLoadingId) return;
    if (!reportForm.materi) return Swal.fire('Error', 'Materi harus diisi', 'error');

    setActionLoadingId(`report_${showReportModal.id}`);
    try {
      const res = await fetch('/api/klinik', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_report',
          slot_id: showReportModal.id,
          guru_id: user?.id,
          materi: reportForm.materi,
          fotos: reportForm.fotos,
          finalized: true,
        }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        Swal.fire('Berhasil', 'Dokumentasi telah diajukan', 'success');
        setShowReportModal(null);
        setReportForm({ materi: '', fotos: [] });
        fetchUserAndSlots();
      } else {
        Swal.fire('Gagal Mengajukan', json.error || 'Terjadi kesalahan sistem', 'error');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Gagal mengajukan laporan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  const handlePreviewLaporan = async (slotId: string) => {
    setLoadingPreviewSlotId(slotId);
    try {
      const res = await fetch('/api/klinik/laporan/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      const data = await safeJson(res);
      if (res.ok && data.ok) {
        setPreviewHtml(data.html);
      } else {
        throw new Error(data.error || 'Gagal memuat pratinjau');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setLoadingPreviewSlotId(null);
    }
  };

  const handleRekap = async (mode: 'preview' | 'pdf') => {
    setRekapLoading(mode);
    try {
      const body = JSON.stringify({ bulan: rekapBulan, tahun: rekapTahun, hanyaDisetujui: !rekapSemua });
      const res = await fetch(`/api/klinik/laporan/rekap/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (mode === 'pdf') {
        if (res.headers.get('content-type')?.includes('application/pdf')) {
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
          return;
        }
        const data = await safeJson(res);
        throw new Error(data.error || 'Gagal membuat PDF rekap');
      }

      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal memuat pratinjau');
      if (data.jumlahSesi === 0) {
        Swal.fire('Tidak Ada Data', `Belum ada sesi klinik ${rekapSemua ? 'berlaporan' : 'yang disahkan'} pada periode ini.`, 'info');
        return;
      }
      setPreviewHtml(data.html);
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setRekapLoading(null);
    }
  };

  const handleCetakPdf = async (slotId: string) => {
    setPrintingPdfSlotId(slotId);
    try {
      const res = await fetch('/api/klinik/laporan/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      if (res.headers.get('content-type')?.includes('application/pdf')) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      } else {
        const data = await safeJson(res);
        throw new Error(data.error || 'Gagal membuat PDF');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setPrintingPdfSlotId(null);
    }
  };

  // Filter slots for rendering
  const displayedSlots = useMemo(() => {
    return slots.filter((s) => {
      if (tabAktif === 'available') {
        if (s.status !== 'open' && s.status !== 'full') return false;
      } else if (tabAktif === 'my_sessions') {
        if (!isSameId(s.guru_id, user?.id)) return false;
        if (s.status === 'cancelled') return false;
      } else if (tabAktif === 'kelompok') {
        if (!(s.initiator_type === 'SISWA' && STATUS_PENGAJUAN.includes(s.status))) return false;
      } else if (tabAktif === 'approval') {
        if (s.status !== 'pending' && !pengajuanDitolak(s)) return false;
      }
      // Tab 'kelola' sengaja tanpa saringan status: di situlah pengelola melihat
      // seluruh sesi, termasuk yang sudah selesai maupun dibatalkan.

      if (filterMapel && s.mapel !== filterMapel) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const m = (s.mapel || '').toLowerCase();
        const t = (s.topik || '').toLowerCase();
        const g = (s.nama_guru || '').toLowerCase();
        if (!m.includes(q) && !t.includes(q) && !g.includes(q)) return false;
      }

      return true;
    });
  }, [slots, tabAktif, user?.id, filterMapel, search]);

  /**
   * Aksi siswa pada sebuah sesi yang sedang berjalan: mendaftar bila belum
   * terdaftar, atau menyatakan kehadiran bila jendela absensinya terbuka.
   * Ditulis sebagai fungsi biasa (bukan komponen) supaya tidak di-remount tiap
   * render induknya — tombolnya menyimpan state isLoading.
   */
  const aksiSiswa = (slot: KlinikSlot) => {
    if (!isSiswa || !STATUS_BERJALAN.includes(slot.status)) return null;

    const saya = pesertaSaya(slot);
    if (!saya) {
      // Sesi bentukan admin yang kuotanya pas hanya lahir 'full', jadi tombol
      // Daftar tidak akan muncul di sana — memang tertutup untuk umum.
      return slot.status === 'open' ? (
        <Button size="sm" variant="primary" onClick={() => handleRegister(slot.id)}>
          Daftar
        </Button>
      ) : (
        <span className="act-note">Kuota Penuh</span>
      );
    }

    if (saya.kehadiran) {
      return (
        <span className={`act-note ${saya.kehadiran === 'H' ? 'act-note--ok' : ''}`}>
          <i className={`bi ${saya.kehadiran === 'H' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`} />{' '}
          {LABEL_KEHADIRAN[saya.kehadiran] || saya.kehadiran}
        </span>
      );
    }

    if (absensiTerbuka(slot)) {
      return (
        <Button
          size="sm"
          variant="primary"
          isLoading={absenLoadingId === slot.id}
          onClick={() => handleAbsenMandiri(slot.id)}
          leftIcon={<i className="bi bi-hand-index-thumb-fill" />}
        >
          Saya Hadir
        </Button>
      );
    }

    const { mulai, selesai } = jendelaAbsensi(slot);
    if (!mulai || !selesai) return null;
    return (
      <span className="act-note" title={`Absensi hanya dibuka pada rentang jam ini`}>
        <i className="bi bi-clock" /> Absensi {mulai.slice(11)}–{selesai.slice(11)}
      </span>
    );
  };

  /**
   * Di tab Approval, daftar sesi yang kosong ditampilkan sebagai kartu ringkas
   * seukuran blok laporan di bawahnya — bukan tabel kosong setinggi layar.
   * Tab lain tetap memakai tabel/kartu seperti biasa.
   */
  const sesiKosongDiApproval = tabAktif === 'approval' && displayedSlots.length === 0;
  const jumlahMenungguSesiApproval = displayedSlots.filter((slot) => slot.status === 'pending').length;

  const tabs: TabItem<'available' | 'my_sessions' | 'kelompok' | 'approval' | 'kelola' | 'rekap'>[] = [
    { key: 'available', label: 'Klinik Tersedia', icon: 'bi-grid-fill' },
    ...(isGuru ? [{ key: 'my_sessions' as const, label: 'Sesi Saya', icon: 'bi-person-video3' }] : []),
    ...(isSiswa && !isGuru ? [{ key: 'kelompok' as const, label: 'Ajukan Kelompok', icon: 'bi-people-fill' }] : []),
    ...(bisaApproveSesi || bisaApproveLaporan ? [{ key: 'approval' as const, label: 'Approval', icon: 'bi-shield-check' }] : []),
    ...(bisaKelolaSesi ? [{ key: 'kelola' as const, label: 'Kelola Sesi', icon: 'bi-calendar2-week' }] : []),
    ...(bisaRekap ? [{ key: 'rekap' as const, label: 'Laporan', icon: 'bi-file-earmark-arrow-down' }] : []),
  ];

  /**
   * Tombol aksi utama, ditentukan tab aktif:
   *   kelola              → membentuk sesi atas nama guru lain (modal admin)
   *   available/my_sessions → membuka jadwal sendiri (guru) atau mengajukan
   *                           klinik kelompok (siswa)
   *   approval/rekap      → tidak ada
   * Tab 'kelompok' sudah punya tombolnya sendiri di banner halaman.
   */
  const fab = (() => {
    if (tabAktif === 'kelola' && bisaKelolaSesi) {
      return { label: 'Buat Sesi Klinik', mobileLabel: 'Buat Sesi', onClick: openAdminSesi };
    }
    if (tabAktif === 'available' || tabAktif === 'my_sessions') {
      if (isGuru) return { label: 'Buka Jadwal Klinik', mobileLabel: 'Buka Jadwal', onClick: openCreateSlot };
      if (isPengajuanSiswa) return { label: 'Ajukan Klinik Kelompok', mobileLabel: 'Ajukan Klinik', onClick: openCreateSlot };
    }
    return null;
  })();

  return (
    <div className="klinik-container">
      {previewHtml && (
        <HtmlPreviewModal
          html={previewHtml}
          title="Pratinjau Laporan Klinik Pembelajaran"
          onClose={() => setPreviewHtml(null)}
        />
      )}

      {/* Aksi utama: FAB melayang di desktop, tombol tengah bottom nav di mobile.
          Isinya ditentukan TAB yang sedang dibuka, bukan role — user yang
          sekaligus guru DAN admin kalau tidak akan selalu terkunci ke modal
          admin dan kehilangan jalur membuka jadwalnya sendiri sebagai guru.
          Tab Approval/Laporan sengaja tanpa FAB: di sana tidak ada
          sesi yang dibuat. */}
      {fab && <DesktopFab label={fab.label} icon="plus-lg" mobileLabel={fab.mobileLabel} onClick={fab.onClick} />}
      {fab && <MobileFab label={fab.mobileLabel} icon="plus-lg" onClick={fab.onClick} />}

      {/* ── Tabs Navigation ──────────────────────────────────────────── */}
      {(isGuru || isSiswa || isAdmin || bisaKelolaSesi || bisaApproveSesi || bisaApproveLaporan || bisaRekap) && (
        <Tab
          tabs={tabs}
          activeTab={tabAktif}
          onChange={(key) => {
            setActiveTab(key as any);
            fetchUserAndSlots(true);
          }}
          ariaLabel="Navigasi Klinik Pembelajaran"
          variant="slider"
        />
      )}

      {/* ── Filter Toolbar (untuk slot listing) ────────────────────────── */}
      {tabAktif !== 'rekap' && (
        <FilterToolbar>
          <FilterSearch
            placeholder="Cari mata pelajaran / topik / nama guru..."
            value={search}
            onChange={setSearch}
            grow={2}
          />
          {isSiswa && !isGuru && tabAktif === 'kelompok' && (
            <FilterActions>
              <Button variant="primary" icon="add" onClick={openCreateSlot}>
                Ajukan Klinik Kelompok
              </Button>
            </FilterActions>
          )}
          <FilterSelect
            label="Mata Pelajaran"
            icon="journal-bookmark"
            value={filterMapel}
            onChange={setFilterMapel}
            options={[
              { value: '', label: 'Semua Mapel' },
              ...mapelList.map((m) => ({ value: m.nama, label: m.nama })),
            ]}
          />
          <FilterActions>
            <Button
              variant="outline"
              size="sm"
              icon="arrow-clockwise"
              onClick={() => fetchUserAndSlots()}
              disabled={loading}
              title="Perbarui data"
            >
              Segarkan
            </Button>
          </FilterActions>
        </FilterToolbar>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="klinik-content">
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner variant="buble" label="Memuat jadwal klinik pembelajaran..." />
          </div>
        ) : tabAktif === 'rekap' ? (
          /* Rekap bulanan kolektif */
          <div className="rekap-card">
            <div className="rekap-head">
              <span className="rekap-head__icon">
                <i className="bi bi-file-earmark-text-fill" />
              </span>
              <div>
                <h3>Rekap Bulanan Klinik Pembelajaran</h3>
                <p>
                  Dokumen kolektif seluruh guru yang melaksanakan sesi klinik pada bulan terpilih, lengkap dengan KOP madrasah dan kolom tanda tangan Kepala Madrasah.
                </p>
              </div>
            </div>

            <div style={{ padding: '18px 24px' }}>
              <FilterToolbar>
                <FilterSelect
                  label="Bulan"
                  icon="calendar-month"
                  value={rekapBulan.toString()}
                  onChange={(v) => setRekapBulan(Number(v))}
                  options={NAMA_BULAN.map((b, i) => ({ value: (i + 1).toString(), label: b }))}
                />
                <FilterSelect
                  label="Tahun"
                  icon="calendar3"
                  value={rekapTahun.toString()}
                  onChange={(v) => setRekapTahun(Number(v))}
                  options={Array.from({ length: 5 }, (_, i) => {
                    const yr = (new Date().getFullYear() - 3 + i).toString();
                    return { value: yr, label: yr };
                  })}
                />
                <FilterSelect
                  label="Cakupan Data"
                  icon="check2-circle"
                  value={rekapSemua ? 'semua' : 'sah'}
                  onChange={(v) => setRekapSemua(v === 'semua')}
                  options={[
                    { value: 'sah', label: 'Hanya Laporan Disahkan' },
                    { value: 'semua', label: 'Semua Laporan Diajukan' },
                  ]}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginLeft: 'auto' }}>
                  <Button
                    variant="outline"
                    onClick={() => handleRekap('preview')}
                    isLoading={rekapLoading === 'preview'}
                    disabled={rekapLoading !== null}
                    leftIcon={<i className="bi bi-eye" />}
                  >
                    Pratinjau
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleRekap('pdf')}
                    isLoading={rekapLoading === 'pdf'}
                    disabled={rekapLoading !== null}
                    leftIcon={<i className="bi bi-printer-fill" />}
                  >
                    Cetak PDF
                  </Button>
                </div>
              </FilterToolbar>
            </div>
          </div>
        ) : (
          <>
            {tabAktif === 'approval' && (
              <SeksiApproval
                nada="sesi"
                ikon="bi-shield-check"
                judul="Pengajuan Sesi"
                deskripsi="Jadwal menunggu persetujuan dan pengajuan yang ditolak"
                jumlah={jumlahMenungguSesiApproval}
              />
            )}

            {sesiKosongDiApproval ? (
              /* Sejajar dengan blok laporan di bawahnya. Tabel setinggi layar
                 dengan enam header kolom yang tidak berisi apa-apa membuat dua
                 antrean yang setara terlihat berbeda bobotnya. */
              <div className="laporan-approval-empty">
                Tidak ada pengajuan sesi yang menunggu persetujuan.
              </div>
            ) : (
            <>
            {/* TABLE VIEW (DESKTOP) */}
            <div className="klinik-table-container">
              <table className="klinik-table">
                <thead>
                  <tr>
                    <th>Mata Pelajaran / Guru</th>
                    <th>Topik Pembelajaran</th>
                    <th>Waktu &amp; Tanggal</th>
                    <th>Kuota</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSlots.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <i className="bi bi-folder2-open" />
                          <p>Belum ada data klinik yang sesuai</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedSlots.map((slot) => {
                      const isRejected = pengajuanDitolak(slot);
                      const isCreator = isSameId(slot.guru_id, user?.id) || (slot.initiator_type === 'SISWA' && isSameId(slot.initiator_siswa_id, user?.id));
                      const sesiAdmin = slot.initiator_type === 'ADMIN';
                      // Sesi bentukan admin lahir langsung 'open'; kalau syarat editnya
                      // tetap "masih pengajuan", sesi itu tak akan pernah bisa disunting.
                      const canEdit = !isRejected && ((STATUS_PENGAJUAN.includes(slot.status) && (bisaKelolaSesi || isCreator))
                        || (bisaKelolaSesi && STATUS_BERJALAN.includes(slot.status)));
                      const canDelete = !isRejected && (bisaKelolaSesi || (STATUS_PENGAJUAN.includes(slot.status) && isCreator));
                      const canAbsensi = bisaKelolaAbsensi(slot) && STATUS_BERJALAN.includes(slot.status);
                      const canViewLaporan = bisaLihatLaporan(slot);
                      const perluRevisi = getLaporan(slot)?.status === 'Revisi';
                      const { kurang, batal } = cekPeserta(slot);

                      return (
                        <Fragment key={slot.id}>
                          <tr>
                            <td>
                              <div className="table-col-guru flex items-center gap-3">
                                <div className="guru-avatar">
                                  {slot.nama_guru?.charAt(0) || 'G'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="m-0 text-sm font-semibold text-[var(--n-ink)] truncate">{slot.mapel}</p>
                                  <p className="m-0 text-xs text-[var(--n-muted)] mt-1 truncate max-w-[200px]" title={slot.nama_guru}>{slot.nama_guru}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <p className="table-col-topik m-0 text-sm" title={slot.topik}>{slot.topik}</p>
                              {slot.initiator_type === 'SISWA' && (
                                <div className="pengaju-tag">
                                  <i className="bi bi-person-badge-fill" />
                                  Diajukan siswa: <strong>{slot.initiator_nama || 'Tidak diketahui'}</strong>
                                  {slot.initiator_kelas ? ` (${slot.initiator_kelas})` : ''}
                                </div>
                              )}
                              {sesiAdmin && (
                                <div className="pengaju-tag">
                                  <i className="bi bi-building-fill-check" />
                                  Dibentuk madrasah · peserta ditunjuk
                                </div>
                              )}
                              {slot.target_kelas && slot.target_kelas.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-[0.65rem] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                                    Khusus Kelas: {slot.target_kelas.join(', ')}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="table-col-waktu">
                                <span className="date">
                                  {parseTanggalTampil(slot.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="time">
                                  {formatJam(slot.jam_mulai)} – {formatJam(slot.jam_selesai)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div
                                className={`table-col-kuota cursor-pointer ${(slot.klinik_peserta?.length || 0) >= slot.max_siswa ? 'kuota-full' : ''}`}
                                onClick={() => openParticipants(slot.id)}
                                title="Lihat Daftar Peserta"
                              >
                                <span className="kuota-text">
                                  <i className="bi bi-people-fill mr-1" />
                                  {slot.klinik_peserta?.length || 0}/{slot.max_siswa}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="status-stack">
                                <span className={`status-pill ${isRejected ? 'rejected' : slot.status}`}>
                                  {isRejected ? 'Ditolak' : labelStatus(slot.status)}
                                </span>
                                {getLaporan(slot)?.status && (
                                  <span className={`laporan-badge ${getLaporan(slot).status.toLowerCase()}`}>
                                    {getLaporan(slot).status}
                                  </span>
                                )}
                                {batal ? (
                                  <span className="status-pill batal" title={`Peserta tidak mencapai ${PESERTA_MINIMAL} siswa sampai jadwal terlewat`}>
                                    Batal · peserta kurang
                                  </span>
                                ) : kurang > 0 ? (
                                  <span className="status-pill kurang" title={`Minimal ${PESERTA_MINIMAL} siswa agar klinik dapat dilaksanakan`}>
                                    Butuh {kurang} siswa lagi
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="text-right">
                              <ActionGroup>
                                {!isRejected && getLaporan(slot) && canViewLaporan && (
                                  <>
                                    <ActionButton
                                      action="view"
                                      title="Lihat Detail Laporan"
                                      onClick={() => setShowViewReportModal(slot)}
                                    />
                                    <ActionButton
                                      action="print"
                                      title="Cetak Laporan PDF"
                                      onClick={() => handleCetakPdf(slot.id)}
                                    />
                                  </>
                                )}

                                {/* Gerbang pertama: guru pengampu yang ditunjuk siswa
                                    menyatakan kesediaannya sebelum reviewer menilai. */}
                                {isGuru && slot.status === 'pending_guru' && isSameId(slot.guru_id, user?.id) && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn-icon-soft"
                                      data-tooltip="Bersedia Mengampu"
                                      aria-label="Bersedia Mengampu"
                                      onClick={() => handleApproveGuru(slot.id, 'terima')}
                                    >
                                      <i className="bi bi-check-lg" style={{ color: '#0284c7' }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon-soft"
                                      data-tooltip="Tidak Bersedia"
                                      aria-label="Tidak Bersedia"
                                      onClick={() => handleApproveGuru(slot.id, 'tolak')}
                                    >
                                      <i className="bi bi-x-lg" style={{ color: '#ef4444' }} />
                                    </button>
                                  </>
                                )}

                                {isGuru && tabAktif === 'my_sessions' && isSameId(user?.id, slot.guru_id) && (slot.status === 'open' || slot.status === 'full') && (
                                  kurang > 0 ? (
                                    <span className={`act-note ${batal ? 'act-note--batal' : ''}`}>
                                      {batal ? 'Klinik batal · laporan ditutup' : `Butuh ${kurang} siswa lagi`}
                                    </span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => openReportModal(slot)}
                                      leftIcon={<i className="bi bi-journal-plus" />}
                                    >
                                      {perluRevisi ? 'Perbaiki' : 'Isi Laporan'}
                                    </Button>
                                  )
                                )}

                                {canAbsensi && (
                                  <button
                                    type="button"
                                    className="btn-icon-soft"
                                    data-tooltip="Isi Absensi"
                                    aria-label="Isi Absensi"
                                    onClick={() => setShowAbsensiModal(slot)}
                                  >
                                    <i className="bi bi-clipboard-check" style={{ color: '#0284c7' }} />
                                  </button>
                                )}

                                {aksiSiswa(slot)}

                                {isSiswa && tabAktif === 'kelompok' && STATUS_PENGAJUAN.includes(slot.status) && (
                                  (slot.klinik_peserta?.length || 0) >= slot.max_siswa ? (
                                    <span className="act-note">Kuota Penuh</span>
                                  ) : slot.klinik_peserta?.some((p) => isSameId(p.siswa_id, user?.id)) ? (
                                    <span className="act-note act-note--ok">
                                      <i className="bi bi-check-circle-fill" /> Sudah Gabung
                                    </span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => handleJoinRequest(slot.id)}
                                    >
                                      Gabung
                                    </Button>
                                  )
                                )}

                                {bisaApproveSesi && tabAktif === 'approval' && slot.status === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn-icon-soft"
                                      data-tooltip="Setujui"
                                      aria-label="Setujui"
                                      onClick={() => handleApprove(slot.id, 'open')}
                                    >
                                      <i className="bi bi-check-lg" style={{ color: '#0284c7' }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon-soft"
                                      data-tooltip="Tolak"
                                      aria-label="Tolak"
                                      onClick={() => handleApprove(slot.id, 'cancelled')}
                                    >
                                      <i className="bi bi-x-lg" style={{ color: '#ef4444' }} />
                                    </button>
                                  </>
                                )}

                                {canEdit && (
                                  <ActionButton
                                    action="edit"
                                    title="Edit Jadwal"
                                    onClick={() =>
                                      sesiAdmin && bisaKelolaSesi ? openEditAdminSesi(slot) : openEditModal(slot)
                                    }
                                  />
                                )}

                                {canDelete && (
                                  <ActionButton
                                    action="delete"
                                    title="Hapus Jadwal"
                                    onClick={() => setSlotToDelete(slot)}
                                  />
                                )}
                                {isRejected && (
                                  <span className="act-note act-note--batal" title={slot.catatan_penolakan || undefined}>
                                    Ditolak
                                  </span>
                                )}
                              </ActionGroup>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* GRID VIEW (MOBILE) */}
            <div className="klinik-grid">
              {displayedSlots.length === 0 ? (
                <div className="empty-state">
                  <i className="bi bi-folder2-open" />
                  <p>Belum ada data klinik yang sesuai</p>
                </div>
              ) : (
                displayedSlots.map((slot) => {
                  const isRejected = pengajuanDitolak(slot);
                  const isCreator = isSameId(slot.guru_id, user?.id) || (slot.initiator_type === 'SISWA' && isSameId(slot.initiator_siswa_id, user?.id));
                  const sesiAdmin = slot.initiator_type === 'ADMIN';
                  const canEdit = !isRejected && ((STATUS_PENGAJUAN.includes(slot.status) && (bisaKelolaSesi || isCreator))
                    || (bisaKelolaSesi && STATUS_BERJALAN.includes(slot.status)));
                  const canDelete = !isRejected && (bisaKelolaSesi || (STATUS_PENGAJUAN.includes(slot.status) && isCreator));
                  const canAbsensi = bisaKelolaAbsensi(slot) && STATUS_BERJALAN.includes(slot.status);
                  const canViewLaporan = bisaLihatLaporan(slot);
                  const perluRevisi = getLaporan(slot)?.status === 'Revisi';
                  const { kurang, batal } = cekPeserta(slot);

                  return (
                    <div key={slot.id} className="slot-card">
                      <div className="slot-header">
                        <div className="guru-avatar">{slot.nama_guru?.charAt(0) || 'G'}</div>
                        <div className="slot-meta">
                          <h4>{slot.mapel}</h4>
                          <h3>{slot.nama_guru}</h3>
                        </div>
                        <div className="status-stack" style={{ alignItems: 'flex-end' }}>
                          <span className={`status-tag ${isRejected ? 'rejected' : slot.status}`}>
                            {isRejected ? 'Ditolak' : labelStatus(slot.status)}
                          </span>
                          {getLaporan(slot)?.status && (
                            <span className={`laporan-badge ${getLaporan(slot).status.toLowerCase()}`}>
                              {getLaporan(slot).status}
                            </span>
                          )}
                          {batal ? (
                            <span className="status-tag batal">Batal · peserta kurang</span>
                          ) : kurang > 0 ? (
                            <span className="status-tag kurang">Butuh {kurang} siswa lagi</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="slot-body">
                        <div className="topic-box">
                          <span>Topik Pembahasan</span>
                          <p>{slot.topik}</p>
                          {slot.initiator_type === 'SISWA' && (
                            <div className="pengaju-tag">
                              <i className="bi bi-person-badge-fill" />
                              Diajukan siswa: <strong>{slot.initiator_nama || 'Tidak diketahui'}</strong>
                              {slot.initiator_kelas ? ` (${slot.initiator_kelas})` : ''}
                            </div>
                          )}
                          {sesiAdmin && (
                            <div className="pengaju-tag">
                              <i className="bi bi-building-fill-check" />
                              Dibentuk madrasah · peserta ditunjuk
                            </div>
                          )}
                          {slot.target_kelas && slot.target_kelas.length > 0 && (
                            <div className="mt-2">
                              <span className="text-[0.65rem] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded uppercase tracking-wider">
                                Khusus Kelas: {slot.target_kelas.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="slot-info-row">
                          <div className="info-chip">
                            <i className="bi bi-calendar-check" />
                            {parseTanggalTampil(slot.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                          <div className="info-chip">
                            <i className="bi bi-clock" />
                            {formatJam(slot.jam_mulai)} - {formatJam(slot.jam_selesai)}
                          </div>
                        </div>
                      </div>

                      <div className="slot-footer">
                        <div
                          className={`quota-badge cursor-pointer hover:bg-[var(--n-soft)] transition-colors ${
                            slot.klinik_peserta && slot.klinik_peserta.length >= slot.max_siswa ? 'full' : ''
                          }`}
                          onClick={() => openParticipants(slot.id)}
                          title="Lihat Peserta"
                        >
                          <i className="bi bi-people-fill" />
                          {slot.klinik_peserta?.length || 0} / {slot.max_siswa}
                        </div>

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => (sesiAdmin && bisaKelolaSesi ? openEditAdminSesi(slot) : openEditModal(slot))}
                              leftIcon={<i className="bi bi-pencil" />}
                            >
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="danger" onClick={() => setSlotToDelete(slot)} leftIcon={<i className="bi bi-trash" />}>
                              Hapus
                            </Button>
                          )}
                          {canAbsensi && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAbsensiModal(slot)}
                              leftIcon={<i className="bi bi-clipboard-check" />}
                            >
                              Absensi
                            </Button>
                          )}
                          {aksiSiswa(slot)}
                          {isSiswa && tabAktif === 'kelompok' && STATUS_PENGAJUAN.includes(slot.status) && (
                            (slot.klinik_peserta?.length || 0) >= slot.max_siswa ? (
                              <span className="act-note">Kuota Penuh</span>
                            ) : slot.klinik_peserta?.some((p) => isSameId(p.siswa_id, user?.id)) ? (
                              <span className="act-note act-note--ok">
                                <i className="bi bi-check-circle-fill" /> Sudah Gabung
                              </span>
                            ) : (
                              <Button size="sm" variant="primary" onClick={() => handleJoinRequest(slot.id)}>
                                Gabung
                              </Button>
                            )
                          )}
                          {bisaApproveSesi && tabAktif === 'approval' && slot.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="primary" onClick={() => handleApprove(slot.id, 'open')} leftIcon={<i className="bi bi-check-lg" />}>
                                Setujui
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleApprove(slot.id, 'cancelled')} leftIcon={<i className="bi bi-x-lg" />}>
                                Tolak
                              </Button>
                            </div>
                          )}
                          {isGuru && slot.status === 'pending_guru' && isSameId(slot.guru_id, user?.id) && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="primary" onClick={() => handleApproveGuru(slot.id, 'terima')} leftIcon={<i className="bi bi-check-lg" />}>
                                Bersedia
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleApproveGuru(slot.id, 'tolak')} leftIcon={<i className="bi bi-x-lg" />}>
                                Tidak Bersedia
                              </Button>
                            </div>
                          )}
                          {isGuru && tabAktif === 'my_sessions' && isSameId(user?.id, slot.guru_id) && (slot.status === 'open' || slot.status === 'full') && (
                            kurang > 0 ? (
                              <span className={`act-note ${batal ? 'act-note--batal' : ''}`}>
                                {batal ? 'Klinik batal · laporan ditutup' : `Butuh ${kurang} siswa lagi`}
                              </span>
                            ) : (
                              <Button size="sm" variant="primary" onClick={() => openReportModal(slot)} leftIcon={<i className="bi bi-journal-plus" />}>
                                {perluRevisi ? 'Perbaiki Laporan' : 'Buat Laporan'}
                              </Button>
                            )
                          )}
                          {isGuru && tabAktif === 'my_sessions' && slot.status === 'finished' && canViewLaporan && (
                            <Button size="sm" variant="outline" onClick={() => setShowViewReportModal(slot)} leftIcon={<i className="bi bi-journal-text" />}>
                              Laporan
                            </Button>
                          )}
                          {isRejected && (
                            <span className="act-note act-note--batal" title={slot.catatan_penolakan || undefined}>
                              Ditolak
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </>
            )}

            {/* Admin Approval of Reports */}
            {bisaApproveLaporan && tabAktif === 'approval' && (() => {
              const laporanSlots = slots.filter((s) => {
                const l = getLaporan(s);
                return l && ['Submitted', 'Approved', 'Revisi', 'Rejected'].includes(l.status);
              });

              const sortedSlots = [...laporanSlots].sort((a, b) => {
                const statusA = getLaporan(a)?.status;
                const statusB = getLaporan(b)?.status;
                const getWeight = (status: string) => {
                  if (status === 'Submitted') return 1;
                  if (status === 'Approved') return 2;
                  if (status === 'Revisi' || status === 'Rejected') return 3;
                  return 4;
                };
                return getWeight(statusA) - getWeight(statusB);
              });

              const menungguPengesahan = sortedSlots.filter(
                (s) => getLaporan(s)?.status === 'Submitted'
              ).length;

              return (
                <div className="laporan-approval-section">
                  <hr className="apr-pisah" />
                  <SeksiApproval
                    nada="laporan"
                    ikon="bi-journal-check"
                    judul="Laporan Pembelajaran"
                    deskripsi="Dokumentasi menunggu pengesahan"
                    jumlah={menungguPengesahan}
                  />
                  {sortedSlots.length === 0 ? (
                    <div className="laporan-approval-empty">Tidak ada laporan yang menunggu approval.</div>
                  ) : (
                    <div className="laporan-approval-list">
                      {sortedSlots.map((slot) => {
                        const laporan = getLaporan(slot);
                        return (
                          <div key={slot.id} className="laporan-approval-card">
                            <div className="laporan-approval-head">
                              <div>
                                <strong>{slot.mapel}</strong> &bull; {slot.nama_guru}
                                <div className="laporan-approval-sub">
                                  {slot.topik} —{' '}
                                  {parseTanggalTampil(slot.tanggal).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })}
                                </div>
                                {laporan.status === 'Approved' && (
                                  <span className="inline-block mt-2 px-2 py-1 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 text-[10px] font-bold rounded uppercase tracking-wider border border-sky-200 dark:border-sky-500/30">
                                    Disetujui
                                  </span>
                                )}
                                {(laporan.status === 'Revisi' || laporan.status === 'Rejected') && (
                                  <span className="inline-block mt-2 px-2 py-1 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] font-bold rounded uppercase tracking-wider border border-red-200 dark:border-red-500/30">
                                    Dikembalikan
                                  </span>
                                )}
                                {laporan.status === 'Submitted' && (
                                  <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded uppercase tracking-wider border border-yellow-200 dark:border-yellow-500/30">
                                    Menunggu Persetujuan
                                  </span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowViewReportModal(slot)}
                                leftIcon={<i className="bi bi-eye" />}
                              >
                                Lihat Detail
                              </Button>
                            </div>

                            {laporan.status === 'Submitted' && (
                              <>
                                <textarea
                                  className="laporan-approval-note"
                                  placeholder="Catatan (wajib diisi kalau dikembalikan)..."
                                  value={laporanNote[laporan.id] || ''}
                                  onChange={(e) => setLaporanNote((prev) => ({ ...prev, [laporan.id]: e.target.value }))}
                                />
                                <div className="laporan-approval-actions">
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleApproveLaporan(laporan.id, 'revisi')}
                                    leftIcon={<i className="bi bi-arrow-return-left" />}
                                  >
                                    Kembalikan
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleApproveLaporan(laporan.id, 'approve')}
                                    leftIcon={<i className="bi bi-check2" />}
                                  >
                                    Setujui
                                  </Button>
                                </div>
                              </>
                            )}

                            {(laporan.status === 'Revisi' || laporan.status === 'Rejected') && laporan.catatan_reviewer && (
                              <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm border border-red-100 dark:border-red-900/40">
                                <strong className="text-red-700 dark:text-red-400 text-xs uppercase tracking-wider block mb-1">
                                  Catatan Pengembalian:
                                </strong>
                                <span className="text-red-800 dark:text-red-300">{laporan.catatan_reviewer}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <CreateSlotModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        editSlotId={editSlotId}
        isPengajuanSiswa={isPengajuanSiswa}
        form={form}
        setForm={setForm}
        mapelList={mapelList}
        guruOptions={guruOptions}
        onSubmit={handleCreateSlot}
        submitting={savingSlot}
        anggota={anggota}
        toggleAnggota={toggleAnggota}
        toggleTingkat={toggleTingkat}
        anggotaExpanded={anggotaExpanded}
        setAnggotaExpanded={setAnggotaExpanded}
        temanTingkat={temanTingkat}
        temanQuery={temanQuery}
        setTemanQuery={setTemanQuery}
        temanLoading={temanLoading}
        temanList={temanList}
        temanTotal={temanTotal}
      />

      <AdminSesiModal
        isOpen={showAdminModal}
        onClose={closeAdminModal}
        editSlotId={adminEditSlotId}
        form={adminForm}
        setForm={setAdminForm}
        mapelList={mapelList}
        guruOptions={guruOptionsAdmin}
        kelasList={kelasList}
        kelasDipilih={kelasDipilih}
        setKelasDipilih={setKelasDipilih}
        kandidatList={kandidatList}
        kandidatLoading={kandidatLoading}
        kandidatTotal={kandidatTotal}
        kandidatQuery={kandidatQuery}
        setKandidatQuery={setKandidatQuery}
        peserta={adminPeserta}
        setPeserta={setAdminPeserta}
        onSubmit={handleSubmitAdminSesi}
        submitting={savingAdminSesi}
      />

      <AbsensiModal
        isOpen={!!showAbsensiModal}
        onClose={() => setShowAbsensiModal(null)}
        slot={showAbsensiModal}
        onSubmit={handleSimpanAbsensi}
        saving={savingAbsensi}
      />

      <ReportModal
        isOpen={!!showReportModal}
        onClose={() => {
          setShowReportModal(null);
          setReportForm({ materi: '', fotos: [] });
        }}
        slot={showReportModal}
        reportForm={reportForm}
        setReportForm={setReportForm}
        fileRef={fileRef}
        uploading={uploading}
        handleFileUpload={handleFileUpload}
        onSubmit={handleSaveReport}
      />

      <ViewReportModal
        isOpen={!!showViewReportModal}
        onClose={() => setShowViewReportModal(null)}
        slot={showViewReportModal}
        openFile={openFile}
        onPrintPreview={handlePreviewLaporan}
        loadingPreviewSlotId={loadingPreviewSlotId}
      />

      <ParticipantsModal
        isOpen={!!showParticipantsModal}
        onClose={() => setShowParticipantsModal(null)}
        slot={showParticipantsModal}
        user={user}
        isGuru={isGuru}
        isAdmin={bisaKelolaSesi}
        isSiswa={isSiswa}
        onCancelParticipant={handleCancel}
      />

      {/* ── Delete Slot Confirmation Modal (Modal.tsx) ────────────────── */}
      {slotToDelete && (
        <Modal
          open={!!slotToDelete}
          size="sm"
          variant="delete"
          icon="trash3"
          title="Hapus Jadwal Klinik?"
          onClose={() => !deletingSlot && setSlotToDelete(null)}
        >
          <ModalBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div><strong>Mata Pelajaran:</strong> {slotToDelete.mapel}</div>
              <div><strong>Guru Pengampu:</strong> {slotToDelete.nama_guru}</div>
              <div><strong>Topik:</strong> {slotToDelete.topik}</div>
              <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '6px' }}>
                PERINGATAN: Sesi ini dan seluruh pesertanya akan dihapus permanen. Lanjutkan?
              </div>
            </div>
          </ModalBody>
          <ModalFooter align="end">
            <Button
              type="button"
              variant="cancel"
              onClick={() => setSlotToDelete(null)}
              disabled={deletingSlot}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDeleteSlot}
              isLoading={deletingSlot}
              leftIcon={<i className="bi bi-trash3-fill" />}
            >
              Ya, Hapus
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {viewer}
    </div>
  );
}

// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedKlinikPage(props: any) {
  return (
    <>
      <MaintenanceBanner pageKey="maintenance_klinik" />
      <KlinikPage {...props} />
    </>
  );
}
