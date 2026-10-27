'use client'

import { Fragment, useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import { Spinner } from '@/components/ui/Spinner'
import DatePicker from '@/components/ui/DatePicker'
import { getActiveSettings } from '@/lib/settings-client'
import { useTahunAjaranFilter } from '@/hooks/use-tahun-ajaran-filter'
import { useFileViewer } from '@/components/useFileViewer'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { Button } from '@/components/ui/Button'
import DetailHeader from '@/components/ui/DetailHeader'
import { FilterToolbar, FilterSelect, FilterSearch } from '@/components/ui/FilterToolbar'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import Tab, { TabItem } from '@/components/ui/Tab'
import { MobileFab } from '@/components/mobile'
import { DesktopFab } from '@/components/ui/DesktopFab'
import SiswaEkskulView from './components/SiswaEkskulView'
import TambahPesertaModal from './components/TambahPesertaModal'
import './ekstrakurikuler.css'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EkskulOption { id: string; nama_ekskul: string; tahun_ajaran?: string; semester?: number }
interface Peserta { id: string; siswa_id: string; nama_siswa: string; aktif: boolean }
interface Pertemuan { id: string; ekskul_id: string; tanggal: string; pertemuan_ke?: number; materi?: string; catatan?: string; nama_guru?: string; dokumentasi?: string[]; status_pelatih?: string; ekskul_absensi?: { id: string; status: string }[] }
type Status = 'H' | 'S' | 'I' | 'A'
interface AbsRow { siswa_id: string; status: Status; catatan?: string; auto?: boolean; jenis?: string }
interface LaporanSubmission { id: string; bulan: number; tahun: number; status: string; total_pertemuan: number; catatan_reviewer?: string; submitted_at: string; ekskul?: { nama_ekskul: string } }

const STATUS_LABEL: Record<Status, string> = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' }
const STATUS_COLOR: Record<Status, string> = { H: '#3b82f6', S: '#f59e0b', I: '#06b6d4', A: '#ef4444' }
const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function fmtTanggal(t: string) {
    try { return new Date(t + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return t }
}

export default function EkskulPembinaView(props: { user: any }) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_ekstrakurikuler" />
            <EkskulPembinaViewContent {...props} />
        </>
    );
}

function EkskulPembinaViewContent({ user }: { user: any }) {
    const { openFile, viewer } = useFileViewer()
    const roles: string[] = (user?.roles || []).map((r: string) => String(r).toUpperCase())
    // Izin sebenarnya datang dari server (GET /ekskul/izin-saya). Tebakan dari
    // role hanya dipakai sampai respons tiba, supaya tampilan tidak berkedip.
    const [izin, setIzin] = useState(() => ({
        kelolaSemua: roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || roles.includes('WKM_KESISWAAN'),
        kelolaPeserta: roles.includes('ADMIN'),
    }))
    useEffect(() => {
        let batal = false
        fetch('/api/ekskul/izin-saya')
            .then(r => r.json())
            .then(j => { if (!batal && j?.ok && j.data) setIzin({ kelolaSemua: !!j.data.kelolaSemua, kelolaPeserta: !!j.data.kelolaPeserta }) })
            .catch(() => {})
        return () => { batal = true }
    }, [])
    const canManageAll = izin.kelolaSemua
    const isSiswa = roles.includes('SISWA')
    const namaGuru = user?.nama_lengkap || user?.nama || user?.username || ''

    const taFilter = useTahunAjaranFilter()
    const ta = taFilter.selected
    const [sem, setSem] = useState(1)
    const [semuaEkskul, setSemuaEkskul] = useState<EkskulOption[]>([])
    const [myEkskul, setMyEkskul] = useState<EkskulOption[]>([])
    const [selectedEkskul, setSelectedEkskul] = useState<string>('')
    const [loadingEkskul, setLoadingEkskul] = useState(true)
    const canEditPertemuan = true

    const [activeTab, setActiveTab] = useState<'pertemuan' | 'laporan' | 'approval'>('pertemuan')
    const [searchQuery, setSearchQuery] = useState('')
    const [pesertaSearch, setPesertaSearch] = useState('')

    useEffect(() => { setSearchQuery('') }, [activeTab])

    // Pertemuan State
    const [peserta, setPeserta] = useState<Peserta[]>([])
    const [pertemuanList, setPertemuanList] = useState<Pertemuan[]>([])
    const [loadingPanel, setLoadingPanel] = useState(false)

    // Absensi Modal State
    const [selectedPertemuan, setSelectedPertemuan] = useState<Pertemuan | null>(null)
    const [absensi, setAbsensi] = useState<Record<string, AbsRow>>({})
    const [showAbsensiModal, setShowAbsensiModal] = useState(false)
    const [showPesertaModal, setShowPesertaModal] = useState(false)
    const [showTambahPeserta, setShowTambahPeserta] = useState(false)
    const [saving, setSaving] = useState(false)

    // Laporan State
    const [laporanList, setLaporanList] = useState<LaporanSubmission[]>([])
    const [loadingLaporan, setLoadingLaporan] = useState(false)
    const [isApproving, setIsApproving] = useState(false)

    // Approval Detail
    const [selectedLaporanForDetail, setSelectedLaporanForDetail] = useState<LaporanSubmission | null>(null)
    const [showLaporanDetailModal, setShowLaporanDetailModal] = useState(false)
    const [detailPertemuan, setDetailPertemuan] = useState<any[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [printingPdfId, setPrintingPdfId] = useState<string | null>(null)

    // Form Pertemuan State
    const [editingPertemuanId, setEditingPertemuanId] = useState<string | null>(null)
    const [showMeetingForm, setShowMeetingForm] = useState(false)
    const [mfTanggal, setMfTanggal] = useState('')
    const [mfMateri, setMfMateri] = useState('')
    const [mfStatusPelatih, setMfStatusPelatih] = useState('Internal')
    const [mfFotos, setMfFotos] = useState<File[]>([])
    const [existingFotos, setExistingFotos] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const active = await getActiveSettings()
                setSem(parseInt(active?.semester ?? '1', 10) || 1)
            } catch (e) { console.error(e) }
        })()
    }, [])

    const loadEkskul = useCallback(async (year: string, semester: number) => {
        if (!year) return
        setLoadingEkskul(true)
        try {
            const [myRes, allRes] = await Promise.all([
                fetch(`/api/ekskul/pembina?nip=${encodeURIComponent(user?.nip || '')}&tahun_ajaran=${encodeURIComponent(year)}&semester=${semester}`),
                fetch(`/api/ekskul?aktif=true&tahun_ajaran=${encodeURIComponent(year)}&semester=${semester}`)
            ])
            const myJson = await myRes.json()
            const allJson = await allRes.json()

            setMyEkskul(myJson.ok ? (myJson.data || []).map((p: any) => ({ id: p.ekskul_id, nama_ekskul: p.nama_ekskul })) : [])
            setSemuaEkskul(allJson.ok ? (allJson.data || []) : [])
        } catch (e) { console.error(e) }
        finally { setLoadingEkskul(false) }
    }, [user?.nip])

    useEffect(() => { if (ta) loadEkskul(ta, sem) }, [ta, sem, loadEkskul])

    useEffect(() => {
        const source = canManageAll ? semuaEkskul : myEkskul
        if (source.length > 0) {
            if (!selectedEkskul || !source.some(e => e.id === selectedEkskul)) {
                setSelectedEkskul(source[0].id)
            }
        } else {
            setSelectedEkskul('')
        }
    }, [canManageAll, semuaEkskul, myEkskul, ta, sem])

    const isPembinaOfSelected = myEkskul.some(e => e.id === selectedEkskul)
    /** Menambah & mengeluarkan peserta: pembina ekskul ini, atau pengelola peserta (Hak Akses Fitur). */
    const bolehAturPeserta = isPembinaOfSelected || izin.kelolaPeserta
    const namaEkskulTerpilih = (canManageAll ? semuaEkskul : myEkskul).find(e => e.id === selectedEkskul)?.nama_ekskul

    const loadPertemuan = useCallback(async (ekskulId: string) => {
        if (!ekskulId) return
        setLoadingPanel(true)
        try {
            const [pesertaRes, pertemuanRes] = await Promise.all([
                fetch(`/api/ekskul/siswa?ekskul_id=${ekskulId}&tahun_ajaran=${encodeURIComponent(ta)}&semester=${sem}`),
                fetch(`/api/ekskul/pertemuan?ekskul_id=${ekskulId}&tahun_ajaran=${encodeURIComponent(ta)}&semester=${sem}${!canManageAll ? '&nip=' + encodeURIComponent(user?.nip || '') : ''}`),
            ])
            const pesertaJson = await pesertaRes.json()
            const pertemuanJson = await pertemuanRes.json()
            setPeserta(pesertaJson.ok ? (pesertaJson.data || []).filter((p: Peserta) => p.aktif) : [])
            setPertemuanList(pertemuanJson.ok ? (pertemuanJson.data || []) : [])
        } catch (e) { console.error(e) }
        finally { setLoadingPanel(false) }
    }, [ta, sem, canManageAll, user?.nip])

    const loadLaporan = useCallback(async (ekskulId: string, isApproval: boolean = false) => {
        if (!isApproval && !ekskulId) return
        setLoadingLaporan(true)
        try {
            const url = isApproval ? `/api/ekskul/submission` : `/api/ekskul/submission?ekskul_id=${ekskulId}${!canManageAll ? '&nip=' + encodeURIComponent(user?.nip || '') : ''}`
            const res = await fetch(url)
            const json = await res.json()
            if (json.ok) setLaporanList(json.data)
        } catch(e) { console.error(e) }
        finally { setLoadingLaporan(false) }
    }, [canManageAll, user?.nip])

    useEffect(() => {
        if (activeTab === 'approval') {
            loadLaporan('', true)
        } else if (selectedEkskul && ta) {
            if (activeTab === 'pertemuan') loadPertemuan(selectedEkskul)
            else if (activeTab === 'laporan') loadLaporan(selectedEkskul, false)
        }
    }, [selectedEkskul, ta, sem, activeTab, loadPertemuan, loadLaporan])

    // --- Absensi Actions ---
    const openAbsensi = async (p: Pertemuan) => {
        setSelectedPertemuan(p)
        setShowAbsensiModal(true)
        try {
            const res = await fetch(`/api/ekskul/absensi?pertemuan_id=${p.id}`)
            const json = await res.json()
            const map: Record<string, AbsRow> = {}
            if (json.ok) (json.data || []).forEach((r: any) => {
                map[r.siswa_id] = { siswa_id: r.siswa_id, status: r.status, catatan: r.catatan, auto: r.auto, jenis: r.jenis }
            })
            setAbsensi(map)
        } catch (e) { console.error(e) }
    }

    const setStatus = (siswa_id: string, status: Status) => {
        setAbsensi(prev => ({ ...prev, [siswa_id]: { ...(prev[siswa_id] || { siswa_id }), siswa_id, status, auto: false } }))
    }
    const markAll = (status: Status) => {
        setAbsensi(prev => {
            const next = { ...prev }
            peserta.forEach(ps => { next[ps.siswa_id] = { ...(next[ps.siswa_id] || { siswa_id: ps.siswa_id }), siswa_id: ps.siswa_id, status, auto: false } })
            return next
        })
    }

    const saveAbsensi = async () => {
        if (!selectedPertemuan) return
        setSaving(true)
        try {
            const payload = { pertemuan_id: selectedPertemuan.id, absensi: peserta.map(ps => absensi[ps.siswa_id] || { siswa_id: ps.siswa_id, status: 'H' }) }
            const res = await fetch('/api/ekskul/absensi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const json = await res.json()
            if (json.ok) Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Absensi berhasil disimpan.', timer: 1600, showConfirmButton: false })
            else Swal.fire('Gagal', json.error || 'Gagal menyimpan', 'error')
        } catch (e: any) { Swal.fire('Error', e.message, 'error') }
        finally { setSaving(false) }
    }

    // --- Pertemuan Actions ---
    const openMeetingForm = () => {
        setEditingPertemuanId(null)
        setMfTanggal(new Date().toISOString().slice(0, 10))
        setMfMateri('')
        setMfStatusPelatih('Internal')
        setMfFotos([])
        setExistingFotos([])
        setShowMeetingForm(true)
    }
    const editMeeting = (p: Pertemuan) => {
        setEditingPertemuanId(p.id)
        setMfTanggal(p.tanggal)
        setMfMateri(p.materi || '')
        setMfStatusPelatih(p.status_pelatih || 'Internal')
        setMfFotos([])
        setExistingFotos(p.dokumentasi || [])
        setShowMeetingForm(true)
    }
    const saveMeeting = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!mfTanggal) { Swal.fire('Peringatan', 'Tanggal wajib diisi', 'warning'); return }
        setUploading(true)
        try {
            let uploadedUrls: string[] = [...existingFotos]
            if (mfFotos.length > 0) {
                for (const file of mfFotos) {
                    const fd = new FormData()
                    fd.append('file', file)
                    const resUpload = await fetch('/api/upload', { method: 'POST', body: fd })
                    const jsonUpload = await resUpload.json()
                    const fileUrl = jsonUpload.publicUrl || jsonUpload.url || jsonUpload.file_url || jsonUpload.data?.url
                    if (jsonUpload.ok && fileUrl) {
                        uploadedUrls.push(fileUrl)
                    } else throw new Error(jsonUpload.error || 'Gagal mengunggah foto ' + file.name)
                }
            }

            const payload: any = {
                ekskul_id: selectedEkskul,
                tanggal: mfTanggal,
                materi: mfMateri,
                status_pelatih: mfStatusPelatih,
                dokumentasi: uploadedUrls.length > 0 ? uploadedUrls : null,
                tahun_ajaran: ta,
                semester: sem,
                nama_guru: namaGuru,
            }
            if (editingPertemuanId) {
                payload.id = editingPertemuanId
            }

            const res = await fetch('/api/ekskul/pertemuan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (json.ok) {
                setShowMeetingForm(false)
                setEditingPertemuanId(null)
                await loadPertemuan(selectedEkskul)
            } else Swal.fire('Gagal', json.error || 'Gagal menyimpan pertemuan', 'error')
        } catch (e: any) { Swal.fire('Error', e.message, 'error') }
        finally { setUploading(false) }
    }
    const deleteMeeting = async (p: Pertemuan) => {
        const c = await Swal.fire({ title: 'Hapus Pertemuan?', html: `Hapus pertemuan <strong>${fmtTanggal(p.tanggal)}</strong>?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus' })
        if (!c.isConfirmed) return
        const res = await fetch(`/api/ekskul/pertemuan?id=${p.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.ok) {
            loadPertemuan(selectedEkskul)
        } else Swal.fire('Gagal', json.error || 'Gagal menghapus', 'error')
    }

    const removePeserta = async (pesertaId: string, nama: string) => {
        const c = await Swal.fire({ title: 'Hapus Peserta?', html: `Keluarkan <b>${nama}</b> dari ekstrakurikuler ini?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Keluarkan' })
        if (!c.isConfirmed) return;

        try {
            const res = await fetch(`/api/ekskul/siswa?id=${pesertaId}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.ok) {
                Swal.fire('Berhasil', 'Peserta berhasil dikeluarkan.', 'success')
                loadPertemuan(selectedEkskul)
            } else {
                Swal.fire('Gagal', json.error || 'Gagal menghapus peserta', 'error')
            }
        } catch (e: any) {
            Swal.fire('Gagal', e.message, 'error')
        }
    }

    // --- Laporan Actions ---
    const handleAjukanLaporan = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Ajukan Laporan Bulanan',
            html: `
                <div style="text-align:left; margin-top:10px;">
                    <label style="font-weight:600; font-size:14px; margin-bottom:5px; display:block; color:var(--n-text)">Bulan Laporan</label>
                    <select id="swal-bulan" class="swal2-select" style="display:block; width:100%; margin:0 0 15px 0;">
                        ${BULAN_NAMES.map((b, i) => `<option value="${i + 1}" ${i + 1 === new Date().getMonth() + 1 ? 'selected' : ''}>${b}</option>`).join('')}
                    </select>
                    <label style="font-weight:600; font-size:14px; margin-bottom:5px; display:block; color:var(--n-text)">Tahun</label>
                    <input id="swal-tahun" class="swal2-input" type="number" value="${new Date().getFullYear()}" style="margin:0; width:100%; box-sizing:border-box;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Ajukan',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                return {
                    bulan: (document.getElementById('swal-bulan') as HTMLSelectElement).value,
                    tahun: (document.getElementById('swal-tahun') as HTMLInputElement).value
                }
            }
        });

        if (formValues) {
            try {
                Swal.showLoading()
                const res = await fetch('/api/ekskul/submission', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ekskul_id: selectedEkskul,
                        nip: user?.nip,
                        nama_guru: user?.nama_lengkap || user?.nama,
                        bulan: formValues.bulan,
                        tahun: formValues.tahun
                    })
                });
                const json = await res.json();
                if (json.ok) {
                    Swal.fire('Berhasil', 'Laporan berhasil diajukan untuk disetujui WKM Kesiswaan.', 'success');
                    loadLaporan(selectedEkskul);
                } else {
                    Swal.fire('Gagal', json.error || 'Gagal mengajukan laporan.', 'error');
                }
            } catch (err: any) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    }

    const handleDeleteLaporan = async (id: string) => {
        const c = await Swal.fire({ title: 'Batal Ajukan?', text: 'Apakah Anda yakin ingin membatalkan pengajuan laporan ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' })
        if (!c.isConfirmed) return
        try {
            const res = await fetch(`/api/ekskul/submission?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) {
                Swal.fire('Berhasil', 'Pengajuan laporan dibatalkan.', 'success');
                loadLaporan(selectedEkskul);
            } else {
                Swal.fire('Gagal', json.error || 'Gagal membatalkan laporan.', 'error');
            }
        } catch (err: any) {
            Swal.fire('Error', err.message, 'error')
        }
    }

    const handleCetakPdf = async (laporan: LaporanSubmission) => {
        setPrintingPdfId(laporan.id);
        try {
            const res = await fetch('/api/ekskul/submission/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: laporan.id })
            });
            if (res.headers.get('content-type')?.includes('application/pdf')) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal membuat PDF');
                window.open(data.file_url, '_blank');
            }
        } catch (e: any) {
            Swal.fire('Error', e.message || 'Gagal membuat PDF', 'error');
        } finally {
            setPrintingPdfId(null);
        }
    };

    const openDetailLaporanModal = async (laporan: LaporanSubmission) => {
        setSelectedLaporanForDetail(laporan)
        setShowLaporanDetailModal(true)
        setLoadingDetail(true)
        try {
            const res = await fetch(`/api/ekskul/pertemuan?submission_id=${laporan.id}`)
            const json = await res.json()
            setDetailPertemuan(json.ok ? (json.data || []) : [])
        } catch (e) { console.error(e); setDetailPertemuan([]) }
        finally { setLoadingDetail(false) }
    }

    const handleApproveLaporan = async (laporan: LaporanSubmission) => {
        const c = await Swal.fire({ title: 'Setujui Laporan?', text: `Setujui laporan bulan ${BULAN_NAMES[laporan.bulan - 1]} ${laporan.tahun}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Setujui' })
        if (!c.isConfirmed) return
        try {
            setIsApproving(true)
            const res = await fetch('/api/ekskul/approval', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve', id: laporan.id })
            })
            const json = await res.json()
            if (json.ok) { Swal.fire('Berhasil', 'Laporan disetujui.', 'success'); loadLaporan(selectedEkskul) }
            else Swal.fire('Gagal', json.error || 'Gagal menyetujui', 'error')
        } catch (e: any) { Swal.fire('Error', e.message, 'error') }
        finally { setIsApproving(false) }
    }

    const handleRejectLaporan = async (laporan: LaporanSubmission) => {
        const { value: catatan } = await Swal.fire({
            title: 'Kembalikan Laporan',
            input: 'textarea',
            inputLabel: 'Catatan Revisi',
            inputPlaceholder: 'Tuliskan alasan pengembalian/revisi...',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Kembalikan',
            inputValidator: (value) => { if (!value) return 'Catatan revisi wajib diisi!' }
        });

        if (catatan) {
            try {
                setIsApproving(true)
                const res = await fetch('/api/ekskul/approval', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'revisi', id: laporan.id, catatan_reviewer: catatan })
                })
                const json = await res.json()
                if (json.ok) { Swal.fire('Berhasil', 'Laporan dikembalikan untuk direvisi.', 'success'); loadLaporan(selectedEkskul) }
                else Swal.fire('Gagal', json.error || 'Gagal', 'error')
            } catch (e: any) { Swal.fire('Error', e.message, 'error') }
            finally { setIsApproving(false) }
        }
    }

    const summary = useMemo(() => {
        const s = { H: 0, S: 0, I: 0, A: 0 }
        peserta.forEach(ps => { const st = absensi[ps.siswa_id]?.status || 'H'; s[st as Status]++ })
        return s
    }, [absensi, peserta])

    const filteredPertemuanList = useMemo(() => {
        if (!searchQuery.trim()) return pertemuanList
        const q = searchQuery.toLowerCase().trim()
        return pertemuanList.filter(p => {
            const tgl = fmtTanggal(p.tanggal).toLowerCase()
            const materi = (p.materi || '').toLowerCase()
            const pelatih = (p.status_pelatih || '').toLowerCase()
            const guru = (p.nama_guru || '').toLowerCase()
            return tgl.includes(q) || materi.includes(q) || pelatih.includes(q) || guru.includes(q)
        })
    }, [pertemuanList, searchQuery])

    const filteredLaporanList = useMemo(() => {
        if (!searchQuery.trim()) return laporanList
        const q = searchQuery.toLowerCase().trim()
        return laporanList.filter(l => {
            const bulanStr = (BULAN_NAMES[l.bulan - 1] || '').toLowerCase()
            const tahunStr = String(l.tahun)
            const statusStr = (l.status || '').toLowerCase()
            const catatanStr = (l.catatan_reviewer || '').toLowerCase()
            const tglAjuan = new Date(l.submitted_at).toLocaleDateString('id-ID').toLowerCase()
            return bulanStr.includes(q) || tahunStr.includes(q) || statusStr.includes(q) || catatanStr.includes(q) || tglAjuan.includes(q)
        })
    }, [laporanList, searchQuery])

    const filteredApprovalList = useMemo(() => {
        if (!searchQuery.trim()) return laporanList
        const q = searchQuery.toLowerCase().trim()
        return laporanList.filter(l => {
            const ekskulNama = (l.ekskul?.nama_ekskul || '').toLowerCase()
            const bulanStr = (BULAN_NAMES[l.bulan - 1] || '').toLowerCase()
            const tahunStr = String(l.tahun)
            const statusStr = (l.status || '').toLowerCase()
            const catatanStr = (l.catatan_reviewer || '').toLowerCase()
            const tglSubmit = new Date(l.submitted_at).toLocaleDateString('id-ID').toLowerCase()
            return ekskulNama.includes(q) || bulanStr.includes(q) || tahunStr.includes(q) || statusStr.includes(q) || catatanStr.includes(q) || tglSubmit.includes(q)
        })
    }, [laporanList, searchQuery])

    const filteredPeserta = useMemo(() => {
        if (!pesertaSearch.trim()) return peserta
        const q = pesertaSearch.toLowerCase().trim()
        return peserta.filter(p => p.nama_siswa.toLowerCase().includes(q))
    }, [peserta, pesertaSearch])

    if (isSiswa && !canManageAll && !roles.includes('PEMBINA_EKSKUL')) {
        return <SiswaEkskulView user={user} />
    }

    return (
        <div className="ekp-scope" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '2rem' }}>
            {/* Standard PageBanner */}


            {/* Standard Tab */}
            <Tab
                variant="slider"
                tabs={[
                    { key: 'pertemuan', label: 'Pertemuan', icon: 'bi-calendar-event' },
                    { key: 'laporan', label: 'Laporan', icon: 'bi-file-earmark-check' },
                    ...(canManageAll ? [{ key: 'approval' as const, label: 'Approval', icon: 'bi-check2-square' }] : []),
                ]}
                activeTab={activeTab}
                onChange={(key) => setActiveTab(key as 'pertemuan' | 'laporan' | 'approval')}
                ariaLabel="Navigasi Ekstrakurikuler"
            />

            {/* Standard FilterToolbar */}
            <FilterToolbar style={{ marginBottom: '16px' }}>
                <FilterSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari..."
                />
                {taFilter.years.length > 0 && (
                    <FilterSelect
                        label="Tahun Ajaran"
                        value={taFilter.selected}
                        onChange={taFilter.setSelected}
                        options={taFilter.years.map(y => ({ value: y, label: `TA ${y}` }))}
                    />
                )}
                <FilterSelect
                    label="Semester"
                    value={String(sem)}
                    onChange={val => setSem(parseInt(val))}
                    options={[
                        { value: '1', label: 'Ganjil' },
                        { value: '2', label: 'Genap' },
                    ]}
                />
                {activeTab !== 'approval' && (canManageAll || myEkskul.length > 0) && (
                    <FilterSelect
                        label="Ekstrakurikuler"
                        value={selectedEkskul}
                        onChange={setSelectedEkskul}
                        options={(canManageAll ? semuaEkskul : myEkskul).map(e => ({
                            value: e.id,
                            label: e.nama_ekskul,
                        }))}
                    />
                )}
            </FilterToolbar>

            {activeTab !== 'approval' && !selectedEkskul ? (
                <div className="ps-card" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', color: 'var(--n-muted)', marginBottom: '16px' }}><i className="bi bi-folder-x" /></div>
                    <h3 style={{ color: 'var(--n-text)', marginBottom: '8px' }}>Tidak Ada Akses Ekstrakurikuler</h3>
                    <p style={{ color: 'var(--n-muted)', fontSize: '0.9rem' }}>{canManageAll ? 'Belum ada ekskul aktif pada periode ini.' : 'Anda belum terdaftar sebagai pembina ekstrakurikuler pada periode ini.'}</p>
                </div>
            ) : (
                <>
                    {activeTab === 'pertemuan' && (
                        <div className="ps-card">
                            <div className="ekp-table-toolbar">
                                <button
                                    type="button"
                                    onClick={() => setShowPesertaModal(true)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        color: 'var(--n-text)',
                                        fontWeight: 700,
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    <i className="bi bi-people" style={{ color: 'var(--n-primary)', fontSize: '1.15rem' }} />
                                    <span>{peserta.length} Peserta</span>
                                </button>
                            </div>
                            {loadingPanel ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}><Spinner size={24} /></div>
                            ) : (
                                <div className="ps-table-container">
                                    <table className="ps-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '180px' }}>Tanggal</th>
                                                <th>Materi / Kegiatan</th>
                                                <th style={{ width: '100px', textAlign: 'center' }}>Pelatih</th>
                                                <th style={{ width: '160px', textAlign: 'center' }}>Absensi</th>
                                                <th style={{ width: '100px', textAlign: 'center' }}>Dokumentasi</th>
                                                <th style={{ width: '160px', textAlign: 'center' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPertemuanList.length === 0 ? (
                                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>{pertemuanList.length === 0 ? 'Belum ada riwayat pertemuan.' : 'Tidak ditemukan pertemuan yang sesuai pencarian.'}</td></tr>
                                            ) : filteredPertemuanList.map(p => (
                                                <tr key={p.id}>
                                                    <td data-label="Tanggal">{fmtTanggal(p.tanggal)}</td>
                                                    <td data-label="Materi / Kegiatan">{p.materi || '-'}</td>
                                                    <td data-label="Pelatih" style={{ textAlign: 'center' }}>
                                                        <span className="ps-badge" style={{ backgroundColor: p.status_pelatih === 'Eksternal' ? '#8b5cf6' : '#3b82f6', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                            {p.status_pelatih || 'Internal'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Absensi" style={{ textAlign: 'center' }}>
                                                        {p.ekskul_absensi && p.ekskul_absensi.length > 0 ? (
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                <span style={{ backgroundColor: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                    {p.ekskul_absensi.filter(a => a.status === 'H').length} Hadir
                                                                </span>
                                                                <span style={{ backgroundColor: p.ekskul_absensi.filter(a => a.status !== 'H').length > 0 ? '#ef4444' : '#64748b', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                    {p.ekskul_absensi.filter(a => a.status !== 'H').length} Tidak Hadir
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--n-muted)', fontSize: '0.8rem' }}>Belum Diabsen</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Dokumentasi" style={{ textAlign: 'center' }}>
                                                        {p.dokumentasi && p.dokumentasi.length > 0 ? (
                                                            <button className="ps-btn ps-btn-sm" onClick={() => openFile(p.dokumentasi![0], 'Dokumentasi')} style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--n-bg-hover)' }}>
                                                                {p.dokumentasi.length} Foto
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                                                        <ActionGroup align="center">
                                                            <ActionButton action="view" size="sm" onClick={() => openAbsensi(p)} label="Detail Pertemuan & Absensi" tooltipPos="left" />
                                                            {canEditPertemuan && (
                                                                <>
                                                                    <ActionButton action="edit" size="sm" onClick={() => editMeeting(p)} label="Edit Pertemuan" tooltipPos="left" />
                                                                    <ActionButton action="delete" size="sm" onClick={() => deleteMeeting(p)} label="Hapus" tooltipPos="left" />
                                                                </>
                                                            )}
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'laporan' && (
                        <div className="ps-card">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                                {isPembinaOfSelected && (
                                    <Button variant="primary" leftIcon={<i className="bi bi-send" />} onClick={handleAjukanLaporan}>
                                        Ajukan Laporan
                                    </Button>
                                )}
                            </div>
                            {loadingLaporan ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}><Spinner size={24} /></div>
                            ) : (
                                <div className="ps-table-container">
                                    <table className="ps-table">
                                        <thead>
                                            <tr>
                                                <th>Periode Laporan</th>
                                                <th>Total Pertemuan</th>
                                                <th>Status</th>
                                                <th>Tanggal Ajuan</th>
                                                <th>Catatan Reviewer</th>
                                                <th style={{ width: '160px', textAlign: 'center' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLaporanList.length === 0 ? (
                                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>{laporanList.length === 0 ? 'Belum ada laporan diajukan.' : 'Tidak ditemukan laporan yang sesuai pencarian.'}</td></tr>
                                            ) : filteredLaporanList.map(l => (
                                                <tr key={l.id}>
                                                    <td data-label="Periode Laporan" style={{ fontWeight: 600 }}>{BULAN_NAMES[l.bulan - 1]} {l.tahun}</td>
                                                    <td data-label="Total Pertemuan">{l.total_pertemuan} kali</td>
                                                    <td data-label="Status">
                                                        <span className="ps-badge" style={{ backgroundColor: l.status === 'Disahkan' ? '#10b981' : l.status === 'Revisi' ? '#ef4444' : '#f59e0b', color: 'white' }}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td data-label="Tanggal Ajuan">{new Date(l.submitted_at).toLocaleDateString('id-ID')}</td>
                                                    <td data-label="Catatan Reviewer">{l.catatan_reviewer || '-'}</td>
                                                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                                                        <ActionGroup align="center">
                                                            <ActionButton action="view" size="sm" onClick={() => openDetailLaporanModal(l)} label="Detail Pertemuan" tooltipPos="left" />
                                                            {isPembinaOfSelected && l.status !== 'Disahkan' && (
                                                                <ActionButton action="delete" size="sm" onClick={() => handleDeleteLaporan(l.id)} label="Batal" tooltipPos="left" />
                                                            )}
                                                            <ActionButton action="print" size="sm" onClick={() => handleCetakPdf(l)} disabled={printingPdfId === l.id} label="PDF" tooltipPos="left" />
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Konten Approval Laporan */}
                    {activeTab === 'approval' && canManageAll && (
                        <div className="ps-card">
                            {loadingLaporan ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}><Spinner size={24} /></div>
                            ) : (
                                <div className="ps-table-container">
                                    <table className="ps-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '120px' }}>Periode</th>
                                                <th>Ekstrakurikuler</th>
                                                <th>Total Pertemuan</th>
                                                <th>Status</th>
                                                <th>Tanggal Submit</th>
                                                <th>Catatan Reviewer</th>
                                                <th style={{ width: '160px', textAlign: 'center' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredApprovalList.length === 0 ? (
                                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--n-muted)' }}>{laporanList.length === 0 ? 'Belum ada laporan bulanan.' : 'Tidak ditemukan laporan yang sesuai pencarian.'}</td></tr>
                                            ) : filteredApprovalList.map(l => (
                                                <tr key={l.id}>
                                                    <td data-label="Periode" style={{ fontWeight: 600 }}>{BULAN_NAMES[l.bulan - 1]} {l.tahun}</td>
                                                    <td data-label="Ekstrakurikuler">{l.ekskul?.nama_ekskul || '-'}</td>
                                                    <td data-label="Total Pertemuan">{l.total_pertemuan} Pertemuan</td>
                                                    <td data-label="Status">
                                                        <span className="ps-badge" style={{ backgroundColor: l.status === 'Disahkan' ? '#10b981' : l.status === 'Revisi' ? '#ef4444' : '#f59e0b', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td data-label="Tanggal Submit">{new Date(l.submitted_at).toLocaleDateString('id-ID')}</td>
                                                    <td data-label="Catatan Revisi">{l.catatan_reviewer || '-'}</td>
                                                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                                                        <ActionGroup align="center">
                                                            <ActionButton action="view" size="sm" onClick={() => openDetailLaporanModal(l)} label="Detail Pertemuan" tooltipPos="left" />
                                                            {l.status === 'Menunggu' && (
                                                                <>
                                                                    <ActionButton action="approve" size="sm" onClick={() => handleApproveLaporan(l)} label="Setujui" tooltipPos="left" />
                                                                    <ActionButton action="reject" size="sm" onClick={() => handleRejectLaporan(l)} label="Revisi" tooltipPos="left" />
                                                                </>
                                                            )}
                                                            <ActionButton action="print" size="sm" onClick={() => handleCetakPdf(l)} disabled={printingPdfId === l.id} label="PDF" tooltipPos="left" />
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Modal Detail Pertemuan & Absensi */}
            {showAbsensiModal && selectedPertemuan && (
                <Modal onClose={() => setShowAbsensiModal(false)} size="lg">
                    <ModalHeader
                        title="Detail Pertemuan & Absensi"
                        subtitle={fmtTanggal(selectedPertemuan.tanggal)}
                        icon="info-circle"
                        onClose={() => setShowAbsensiModal(false)}
                    />
                    <ModalBody>
                        {/* Informasi Pertemuan Card */}
                        <div style={{ background: 'var(--n-bg-subtle)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--n-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tanggal Pertemuan</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)', marginTop: '2px' }}>
                                        {fmtTanggal(selectedPertemuan.tanggal)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Pelatih</div>
                                    <div style={{ marginTop: '2px' }}>
                                        <span className="ps-badge" style={{ backgroundColor: selectedPertemuan.status_pelatih === 'Eksternal' ? '#8b5cf6' : '#3b82f6', color: 'white', fontWeight: 700 }}>
                                            {selectedPertemuan.status_pelatih || 'Internal'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginBottom: selectedPertemuan.dokumentasi && selectedPertemuan.dokumentasi.length > 0 ? '12px' : '0' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Materi / Kegiatan</div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--n-text)', marginTop: '4px', whiteSpace: 'pre-line' }}>
                                    {selectedPertemuan.materi || <span style={{ color: 'var(--n-muted)', fontStyle: 'italic' }}>Tidak ada materi dicatat.</span>}
                                </div>
                            </div>
                            {selectedPertemuan.dokumentasi && selectedPertemuan.dokumentasi.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Dokumentasi Foto ({selectedPertemuan.dokumentasi.length})</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {selectedPertemuan.dokumentasi.map((url, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => openFile(url, `Dokumentasi Foto ${idx + 1}`)}
                                                title="Klik untuk memperbesar foto"
                                                style={{ border: '1px solid var(--n-border)', borderRadius: '8px', padding: 0, overflow: 'hidden', background: 'none', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                                                onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'}
                                                onMouseLeave={e => e.currentTarget.style.transform='scale(1.0)'}
                                            >
                                                <img src={url} alt={`Dokumentasi ${idx + 1}`} style={{ width: '64px', height: '64px', objectFit: 'cover' }} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rekap Absensi Siswa */}
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--n-text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="bi bi-person-check" style={{ color: 'var(--n-primary)', fontSize: '1.1rem' }} /> Rekap & Presensi Siswa
                        </div>

                        <div className="abs-summary-bar">
                            <div className="abs-summary-pills">
                                {(['H', 'S', 'I', 'A'] as Status[]).map(s => (
                                    <span key={s} className={`abs-pill abs-pill--${s}`}>
                                        <span>{STATUS_LABEL[s]}:</span>
                                        <strong>{summary[s]}</strong>
                                    </span>
                                ))}
                            </div>
                            {canEditPertemuan && (
                                <Button variant="outline" size="sm" leftIcon={<i className="bi bi-check2-all" />} onClick={() => markAll('H')}>
                                    Semua Hadir
                                </Button>
                            )}
                        </div>

                        <div style={{ maxHeight: '45vh', overflowY: 'auto', paddingRight: '4px' }}>
                            {peserta.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n-muted)' }}>Belum ada peserta di ekstrakurikuler ini.</div>
                            ) : peserta.map((ps, i) => {
                                const entry = absensi[ps.siswa_id]
                                const cur = entry?.status || 'H'
                                return (
                                    <div key={ps.siswa_id} className="abs-student-row">
                                        <div className="abs-student-info">
                                            <span className="abs-student-num">{i + 1}</span>
                                            <div>
                                                <div className="abs-student-name">{ps.nama_siswa}</div>
                                                {entry?.auto && (
                                                    <div className="abs-auto-tag" style={{ color: STATUS_COLOR[cur as Status] }}>
                                                        <i className="bi bi-link-45deg" /> Otomatis dari {entry.jenis || 'ketidakhadiran'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            {canEditPertemuan ? (
                                                <div className="abs-segmented-control">
                                                    {(['H', 'S', 'I', 'A'] as Status[]).map(s => {
                                                        const isActive = cur === s;
                                                        return (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                onClick={() => setStatus(ps.siswa_id, s)}
                                                                title={STATUS_LABEL[s]}
                                                                className={`abs-seg-btn ${isActive ? 'abs-seg-btn--active' : ''}`}
                                                                style={isActive ? { backgroundColor: STATUS_COLOR[s] } : {}}
                                                            >
                                                                {s}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <span className={`abs-pill abs-pill--${cur}`}>
                                                    {STATUS_LABEL[cur as Status]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => setShowAbsensiModal(false)}>
                            {canEditPertemuan ? 'Batal' : 'Tutup'}
                        </Button>
                        {canEditPertemuan && (
                            <Button variant="primary" onClick={saveAbsensi} isLoading={saving} leftIcon={<i className="bi bi-save" />}>
                                Simpan Absensi
                            </Button>
                        )}
                    </ModalFooter>
                </Modal>
            )}

            {/* Modal Daftar Peserta */}
            {showPesertaModal && (
                <Modal onClose={() => setShowPesertaModal(false)} size="md">
                    <ModalHeader
                        title="Daftar Peserta Ekstrakurikuler"
                        subtitle={`Total: ${peserta.length} siswa aktif`}
                        icon="people"
                        onClose={() => setShowPesertaModal(false)}
                    />
                    <ModalBody>
                        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <FilterSearch
                                    value={pesertaSearch}
                                    onChange={setPesertaSearch}
                                    placeholder="Cari nama peserta..."
                                />
                            </div>
                            {bolehAturPeserta && (
                                <Button variant="primary" icon="add" onClick={() => { setShowPesertaModal(false); setShowTambahPeserta(true) }}>
                                    Tambah
                                </Button>
                            )}
                        </div>
                        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                            {filteredPeserta.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n-muted)' }}>
                                    {peserta.length === 0 ? 'Belum ada peserta di ekstrakurikuler ini.' : 'Tidak ditemukan peserta yang sesuai pencarian.'}
                                </div>
                            ) : filteredPeserta.map((ps, i) => (
                                <div key={ps.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid var(--n-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='var(--n-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--n-muted)', width: '20px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                        <div style={{ fontWeight: 600, color: 'var(--n-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>{ps.nama_siswa}</div>
                                    </div>
                                    {bolehAturPeserta && (
                                        <ActionButton action="delete" size="sm" onClick={() => removePeserta(ps.id, ps.nama_siswa)} tooltip="Keluarkan Peserta" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </ModalBody>
                </Modal>
            )}

            {/* Modal Tambah Peserta (pembina ekskul ini / pengelola peserta) */}
            {bolehAturPeserta && selectedEkskul && (
                <TambahPesertaModal
                    open={showTambahPeserta}
                    onClose={() => { setShowTambahPeserta(false); setShowPesertaModal(true) }}
                    onSaved={() => loadPertemuan(selectedEkskul)}
                    ekskulId={selectedEkskul}
                    namaEkskul={namaEkskulTerpilih}
                    tahunAjaran={ta}
                    semester={sem}
                />
            )}

            {/* Modal Tambah / Edit Pertemuan */}
            {showMeetingForm && (
                <Modal onClose={() => setShowMeetingForm(false)} size="md">
                    <ModalHeader
                        title={editingPertemuanId ? "Edit Pertemuan" : "Pertemuan Baru"}
                        subtitle={editingPertemuanId ? "Ubah detail tanggal, materi, dan foto dokumentasi" : "Catat materi dan upload dokumentasi foto kegiatan"}
                        icon={editingPertemuanId ? "pencil-square" : "calendar-plus"}
                        onClose={() => setShowMeetingForm(false)}
                    />
                    <form onSubmit={saveMeeting}>
                        <ModalBody>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--n-text)' }}>Tanggal *</label>
                                <DatePicker value={mfTanggal} onChange={setMfTanggal} required />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--n-text)' }}>Status Pelatih</label>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input type="radio" name="status_pelatih" value="Internal" checked={mfStatusPelatih === 'Internal'} onChange={() => setMfStatusPelatih('Internal')} style={{ accentColor: 'var(--n-primary)' }} />
                                        Internal
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input type="radio" name="status_pelatih" value="Eksternal" checked={mfStatusPelatih === 'Eksternal'} onChange={() => setMfStatusPelatih('Eksternal')} style={{ accentColor: 'var(--n-primary)' }} />
                                        Eksternal
                                    </label>
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--n-text)' }}>Materi / Kegiatan</label>
                                <textarea value={mfMateri} onChange={e => setMfMateri(e.target.value)} rows={3} placeholder="Materi kegiatan..." className="ps-input" style={{ width: '100%', resize: 'vertical' }} />
                            </div>
                            {existingFotos.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--n-text)' }}>Foto Saat Ini</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {existingFotos.map((url, idx) => (
                                            <div key={idx} style={{ position: 'relative' }}>
                                                <img src={url} alt={`Existing ${idx}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--n-border)' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => setExistingFotos(existingFotos.filter((_, i) => i !== idx))}
                                                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Hapus foto ini"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--n-text)' }}>
                                    {existingFotos.length > 0 ? "Tambah Foto Baru (Opsional)" : "Dokumentasi Foto (Maks 3)"}
                                </label>
                                <input type="file" multiple accept="image/*" onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length + existingFotos.length > 3) {
                                        Swal.fire('Peringatan', `Maksimal 3 foto total. Saat ini sudah ada ${existingFotos.length} foto.`, 'warning');
                                        e.target.value = '';
                                        setMfFotos(files.slice(0, 3 - existingFotos.length));
                                    } else setMfFotos(files);
                                }} className="ps-input" style={{ width: '100%' }} />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="cancel" type="button" onClick={() => setShowMeetingForm(false)}>Batal</Button>
                            <Button variant="primary" type="submit" isLoading={uploading}>{editingPertemuanId ? 'Simpan Perubahan' : 'Simpan'}</Button>
                        </ModalFooter>
                    </form>
                </Modal>
            )}

            {/* Modal Detail Pertemuan Laporan */}
            {showLaporanDetailModal && selectedLaporanForDetail && (
                <Modal onClose={() => setShowLaporanDetailModal(false)} size="xl">
                    <ModalHeader
                        title={`Detail Laporan — ${BULAN_NAMES[selectedLaporanForDetail.bulan - 1]} ${selectedLaporanForDetail.tahun}`}
                        subtitle={selectedLaporanForDetail.ekskul?.nama_ekskul ? `${selectedLaporanForDetail.ekskul.nama_ekskul} • Total ${selectedLaporanForDetail.total_pertemuan} Pertemuan` : `Total ${selectedLaporanForDetail.total_pertemuan} Pertemuan`}
                        icon="journal-text"
                        onClose={() => setShowLaporanDetailModal(false)}
                    />
                    <ModalBody>
                        {loadingDetail ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}><Spinner size={24} /></div>
                        ) : detailPertemuan.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n-muted)' }}>Tidak ada pertemuan tertaut pada laporan ini.</div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', background: 'var(--n-bg-subtle)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                                    <span style={{ color: '#3b82f6' }}>
                                        <i className="bi bi-person-badge" style={{ marginRight: '4px' }} /> Internal: {detailPertemuan.filter(p => (p.status_pelatih || 'Internal') === 'Internal').length} pertemuan
                                    </span>
                                    <span style={{ color: '#8b5cf6' }}>
                                        <i className="bi bi-person-badge" style={{ marginRight: '4px' }} /> Eksternal: {detailPertemuan.filter(p => p.status_pelatih === 'Eksternal').length} pertemuan
                                    </span>
                                </div>
                                <div className="ps-table-container" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                                    <table className="ps-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '180px' }}>Tanggal</th>
                                                <th>Materi / Kegiatan</th>
                                                <th style={{ width: '100px', textAlign: 'center' }}>Pelatih</th>
                                                <th style={{ width: '160px', textAlign: 'center' }}>Absensi</th>
                                                <th style={{ width: '100px', textAlign: 'center' }}>Dokumentasi</th>
                                                <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailPertemuan.map(p => (
                                                <tr key={p.id}>
                                                    <td data-label="Tanggal">{fmtTanggal(p.tanggal)}</td>
                                                    <td data-label="Materi / Kegiatan">{p.materi || '-'}</td>
                                                    <td data-label="Pelatih" style={{ textAlign: 'center' }}>
                                                        <span className="ps-badge" style={{ backgroundColor: p.status_pelatih === 'Eksternal' ? '#8b5cf6' : '#3b82f6', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                            {p.status_pelatih || 'Internal'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Absensi" style={{ textAlign: 'center' }}>
                                                        {p.ekskul_absensi && p.ekskul_absensi.length > 0 ? (
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                <span style={{ backgroundColor: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                    {p.ekskul_absensi.filter((a: any) => a.status === 'H').length} Hadir
                                                                </span>
                                                                <span style={{ backgroundColor: p.ekskul_absensi.filter((a: any) => a.status !== 'H').length > 0 ? '#ef4444' : '#64748b', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                    {p.ekskul_absensi.filter((a: any) => a.status !== 'H').length} Tidak Hadir
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--n-muted)', fontSize: '0.8rem' }}>Belum Diabsen</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Dokumentasi" style={{ textAlign: 'center' }}>
                                                        {p.dokumentasi && p.dokumentasi.length > 0 ? (
                                                            <button className="ps-btn ps-btn-sm" onClick={() => openFile(p.dokumentasi![0], 'Dokumentasi')} style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--n-bg-hover)' }}>
                                                                {p.dokumentasi.length} Foto
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                                                        <ActionGroup align="center">
                                                            <ActionButton action="view" size="sm" onClick={() => openAbsensi(p)} label="Detail Absensi" tooltipPos="left" />
                                                        </ActionGroup>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="cancel" type="button" onClick={() => setShowLaporanDetailModal(false)}>
                            Tutup
                        </Button>
                    </ModalFooter>
                </Modal>
            )}

            {activeTab === 'pertemuan' && canEditPertemuan && selectedEkskul && (
                <>
                    <DesktopFab label="Tambah Pertemuan" icon="plus-lg" onClick={openMeetingForm} />
                    <MobileFab label="Tambah Pertemuan" icon="plus-lg" onClick={openMeetingForm} />
                </>
            )}

            {viewer}
        </div>
    )
}
