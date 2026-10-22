'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import DatePicker from '@/components/ui/DatePicker'
import { createPortal } from 'react-dom'
import type { User } from '@/lib/types'
import Swal from 'sweetalert2'
import { swalSuccess, swalError, swalWarning, swalConfirm } from '@/lib/swal-premium';
import { getProxiedImageUrl } from '@/lib/image-utils'
import Cropper from 'react-easy-crop'
import getCroppedImg, { convertFileToWebp } from '@/lib/cropImage'
import { useModalBlur } from '@/components/ModalBlurProvider'
import Select from 'react-select'
import { getActiveAcademicYear, getActiveSettings } from '@/lib/settings-client'
import { clearUserCache } from '@/lib/auth-client'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import Tab, { type TabItem } from '@/components/ui/Tab'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuruData {
    id?: number
    nip: string
    nama_lengkap: string
    tempat_lahir?: string
    tanggal_lahir?: string
    golongan?: string
    pangkat?: string
    tmt_tugas?: string
    riwayat_pendidikan?: any[]
    alamat?: string
    email?: string
    no_hp?: string
    aktif?: boolean
}

interface SiswaData {
    nisn: string
    nama_lengkap: string
    gender?: string
    tempat_lahir?: string
    tanggal_lahir?: string
    nomor_hp?: string
    nama_ayah?: string
    nama_ibu?: string
    nomor_hp_ayah?: string
    nomor_hp_ibu?: string
    alamat?: string
    asal_sekolah?: string
    email?: string
}

interface Rekening {
    slot: 1 | 2
    nama_bank: string
    nomor: string
    atas_nama: string
    aktif: boolean
}


// ─── Constants ────────────────────────────────────────────────────────────────

const INDONESIAN_BANKS = [
    'Bank Rakyat Indonesia (BRI)', 'Bank Negara Indonesia (BNI)', 'Bank Tabungan Negara (BTN)',
    'Bank Mandiri', 'Bank Central Asia (BCA)', 'Bank CIMB Niaga', 'Bank Permata', 'Bank Sinarmas',
    'Bank Muamalat Indonesia', 'Bank BTPN', 'Bank Jago', 'Bank Nobu', 'Bank Mega',
    'Bank BCA Syariah', 'Bank BRI Syariah (BRIS)', 'Bank BNI Syariah',
    'Bank DKI Jakarta', 'Bank Jawa Barat (BJB)', 'Bank Jawa Tengah (BJTM)', 'Bank Jawa Timur (Jatim)',
    'PT Bank Aceh', 'PT Bank Papua', 'Bank Nagari (Sumatera Barat)', 'BPD DIY', 'Bank Banten',
    'Bank Bengkulu', 'Bank Jambi', 'Bank Lampung', 'Bank Riau Kepulau', 'Bank Kalteng',
    'Bank Kalselteng', 'Bank Sulbar', 'Bank Sultra', 'Bank Sulut', 'Bank NTB', 'Bank NTT',
    'Bank Maluku', 'Bank Malut', 'Bank Kaltara', 'Bank Gorontalo',
    'Bank Oke Indonesia', 'Bank QNB Indonesia', 'Bank Woori Saudara', 'Bank Maybank Indonesia',
    'Bank Danamon Indonesia', 'Bank Pan Indonesia', 'Bank OCBC NISP', 'Bank ICBC Indonesia',
    'JPMorgan Chase Bank Indonesia', 'Deutsche Bank Indonesia', 'Citibank Indonesia',
    'Standard Chartered Bank Indonesia', 'Bank HSBC Indonesia', 'Bank BJB Syariah', 'Bank Aladin',
]

const GOLONGAN_OPTIONS = [
    '', 'I/a', 'I/b', 'I/c', 'I/d', 'II/a', 'II/b', 'II/c', 'II/d',
    'III/a', 'III/b', 'III/c', 'III/d', 'IV/a', 'IV/b', 'IV/c', 'IV/d', 'IV/e',
]

const PANGKAT_OPTIONS = [
    '', 'Juru Muda', 'Juru Muda Tingkat I', 'Juru', 'Juru Tingkat I',
    'Pengatur Muda', 'Pengatur Muda Tingkat I', 'Pengatur', 'Pengatur Tingkat I',
    'Penata Muda', 'Penata Muda Tingkat I', 'Penata', 'Penata Tingkat I',
    'Pembina', 'Pembina Tingkat I', 'Pembina Utama Muda', 'Pembina Utama Madya', 'Pembina Utama',
]

const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3']


// ─── Main Component ───────────────────────────────────────────────────────────

interface ProfilePageProps {
    user: User
    onRefreshUser: () => Promise<void>
}

export default function ProfilePage({ user, onRefreshUser }: ProfilePageProps) {
    // Students keep their Biodata tab while loading or when the master link needs repair.
    const isGuru = user?.roles?.some((r: string) => r.toUpperCase() === 'GURU') ?? false
    const isSiswa = user?.roles?.some((r: string) => r.toUpperCase() === 'SISWA') ?? false
    const [activeTab, setActiveTab] = useState<string>('akun')
    const [loading, setLoading] = useState(false)

    // Account form
    const [formData, setFormData] = useState({
        username: user.username || '',
        email: user.email || '',
        photoUrl: user.photoUrl || '',
        newPassword: '',
        confirmPassword: '',
        currentPassword: '',
    })
    const [uploading, setUploading] = useState(false)
    const [showCamera, setShowCamera] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [showNewPwd, setShowNewPwd] = useState(false)
    const [showConfirmPwd, setShowConfirmPwd] = useState(false)
    const [showCurrentPwd, setShowCurrentPwd] = useState(false)
    const [showPwdGen, setShowPwdGen] = useState(false)
    const [pwdError, setPwdError] = useState('')

    // Guru data
    const [guruData, setGuruData] = useState<GuruData | null>(null)
    const [guruForm, setGuruForm] = useState({
        tempat_lahir: '', tanggal_lahir: '', golongan: '', pangkat: '',
        tmt_tugas: '', riwayat_pendidikan: [] as { level: string; detail: string }[],
        alamat: '', no_hp: '',
    })
    const [savingGuru, setSavingGuru] = useState(false)

    // Siswa data
    const [siswaData, setSiswaData] = useState<SiswaData | null>(null)
    const [siswaStatus, setSiswaStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
    const [siswaError, setSiswaError] = useState('')
    const profileRequest = useRef(0)
    const [siswaForm, setSiswaForm] = useState({
        gender: '', tempat_lahir: '', tanggal_lahir: '', nomor_hp: '', nomor_hp_ayah: '', nomor_hp_ibu: '',
        alamat: '', asal_sekolah: ''
    })
    const [savingSiswa, setSavingSiswa] = useState(false)

    // Tabs configuration for universal Tab component
    const tabs = useMemo<TabItem<string>[]>(() => {
        const list: TabItem<string>[] = [
            {
                key: 'akun',
                label: 'Akun & Keamanan',
                icon: 'person-gear',
            },
        ]
        if (guruData || siswaData || isSiswa) {
            list.push({
                key: 'data-diri',
                label: isSiswa || siswaData ? 'Biodata Siswa' : 'Data Kepegawaian',
                icon: 'person-vcard',
            })
        }
        return list
    }, [guruData, siswaData, isSiswa])

    // Formatted role information: primary roles and remaining others
    const { primaryRoles, remainingRolesCount, remainingRolesTooltip } = useMemo(() => {
        const rawRoles = (user?.roles || []).map((r: string) => r.replace(/_/g, ' '))
        const mainRoles: string[] = []
        const otherRoles: string[] = []

        rawRoles.forEach((role: string) => {
            const upper = role.toUpperCase()
            if (upper === 'GURU' || upper === 'ADMIN') {
                mainRoles.push(role)
            } else {
                otherRoles.push(role)
            }
        })

        if (mainRoles.length === 0 && rawRoles.length > 0) {
            mainRoles.push(...rawRoles.slice(0, 2))
            otherRoles.push(...rawRoles.slice(2))
        }

        if (mainRoles.length === 0) {
            mainRoles.push(isGuru ? 'Guru' : isSiswa ? 'Siswa' : 'Pengguna')
        }

        return {
            primaryRoles: mainRoles,
            remainingRolesCount: otherRoles.length,
            remainingRolesTooltip: otherRoles.join(', ')
        }
    }, [user?.roles, isGuru, isSiswa])

    // Rekening (stored in master_guru columns)
    const [rekeningList, setRekeningList] = useState<Rekening[]>([])
    const [showRekModal, setShowRekModal] = useState(false)
    const [editingRek, setEditingRek] = useState<Rekening | null>(null)
    const [rekForm, setRekForm] = useState({ nama_bank: '', atas_nama: '', nomor: '' })
    const [savingRek, setSavingRek] = useState(false)

    // Ekskul states moved to SiswaEkskulView

    const { openModal, closeModal } = useModalBlur()

    // Consolidate all modal blur effects into one
    useEffect(() => {
        const isCameraOpen = (showCamera || !!imageToCrop) && isGuru
        if (isCameraOpen || showRekModal) {
            openModal()
        } else {
            closeModal()
        }
        return () => closeModal()
    }, [showCamera, imageToCrop, isGuru, showRekModal])

    useEffect(() => {
        const controller = new AbortController()
        const version = ++profileRequest.current
        setGuruData(null)
        setSiswaData(null)
        setRekeningList([])
        if (!isSiswa) void fetchGuruData(controller.signal, version)
        void fetchSiswaData(controller.signal, version)
        return () => { controller.abort(); profileRequest.current++ }
    }, [user.id, user.nip, user.username, isSiswa])



    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            username: user.username || '',
            email: user.email || '',
            photoUrl: user.photoUrl || ''
        }))
    }, [user])

    // ─── Guru Data Fetch ──────────────────────────────────────────────────────

    const fetchGuruData = async (signal?: AbortSignal, version = profileRequest.current) => {
        setLoading(true)
        try {
            const res = await fetch('/api/profile-guru', { signal })
            const json = await res.json()
            if (signal?.aborted || version !== profileRequest.current) return
            if (json.ok && json.data) {
                const g = json.data as GuruData
                setGuruData(g)
                setRekeningList(json.rekening || [])
                setGuruForm({
                    tempat_lahir: g.tempat_lahir || '',
                    tanggal_lahir: g.tanggal_lahir ? String(g.tanggal_lahir).split('T')[0] : '',
                    golongan: g.golongan || '',
                    pangkat: g.pangkat || '',
                    tmt_tugas: g.tmt_tugas ? String(g.tmt_tugas).split('T')[0] : '',
                    riwayat_pendidikan: g.riwayat_pendidikan || [],
                    alamat: g.alamat || '',
                    no_hp: g.no_hp || '',
                })
            }
        } catch (e) { if (!signal?.aborted) console.error(e) }
        finally { if (!signal?.aborted && version === profileRequest.current) setLoading(false) }
    }

    const handleSaveGuru = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingGuru(true)
        try {
            const res = await fetch('/api/profile-guru', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(guruForm),
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data diri berhasil diperbarui.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#3083FF' })
                fetchGuruData()
            } else {
                swalError('Gagal', json.error || 'Terjadi kesalahan')
            }
        } catch (e: any) { swalError('Error', e.message) }
        finally { setSavingGuru(false) }
    }

    const fetchSiswaData = async (signal?: AbortSignal, version = profileRequest.current) => {
        setLoading(true)
        setSiswaStatus('loading')
        setSiswaError('')
        try {
            const res = await fetch('/api/profile-siswa', { signal })
            const json = await res.json()
            if (signal?.aborted || version !== profileRequest.current) return
            if (!res.ok || !json.ok) throw new Error(json.error || json.message || 'Biodata siswa belum dapat dimuat.')
            if (json.data) {
                const s = json.data as SiswaData
                setSiswaData(s)
                setSiswaStatus('ready')
                setSiswaForm({
                    gender: s.gender || '',
                    tempat_lahir: s.tempat_lahir || '',
                    tanggal_lahir: s.tanggal_lahir ? String(s.tanggal_lahir).split('T')[0] : '',
                    nomor_hp: s.nomor_hp || '',
                    nomor_hp_ayah: s.nomor_hp_ayah || '',
                    nomor_hp_ibu: s.nomor_hp_ibu || '',
                    alamat: s.alamat || '',
                    asal_sekolah: s.asal_sekolah || '',
                })
            } else { setSiswaData(null); setSiswaStatus('missing') }
        } catch (e) {
            if (signal?.aborted || version !== profileRequest.current) return
            setSiswaData(null)
            setSiswaStatus('error')
            setSiswaError(e instanceof Error ? e.message : 'Biodata siswa belum dapat dimuat.')
        }
        finally { if (!signal?.aborted && version === profileRequest.current) setLoading(false) }
    }

    const handleSaveSiswa = async (e: React.FormEvent) => {
        e.preventDefault()
        if (siswaForm.nomor_hp && siswaForm.nomor_hp.trim()) {
            const cleanHp = siswaForm.nomor_hp.trim()
            if (!/^[0-9+\-\s]{8,25}$/.test(cleanHp)) {
                swalError('Format Tidak Valid', 'Nomor HP siswa harus berupa nomor yang valid (8-25 digit/karakter angka).')
                return
            }
        }
        setSavingSiswa(true)
        try {
            const res = await fetch('/api/profile-siswa', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(siswaForm),
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data diri berhasil diperbarui.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#10b981' })
                fetchSiswaData()
            } else {
                swalError('Gagal', json.error || 'Terjadi kesalahan')
            }
        } catch (e: any) { swalError('Error', e.message) }
        finally { setSavingSiswa(false) }
    }

    const handleAddRiwayat = () => {
        setGuruForm(p => ({ ...p, riwayat_pendidikan: [...p.riwayat_pendidikan, { level: '', detail: '' }] }))
    }
    const handleRemoveRiwayat = (i: number) => {
        setGuruForm(p => ({ ...p, riwayat_pendidikan: p.riwayat_pendidikan.filter((_, idx) => idx !== i) }))
    }
    const handleRiwayatChange = (i: number, field: 'level' | 'detail', val: string) => {
        setGuruForm(p => ({
            ...p,
            riwayat_pendidikan: p.riwayat_pendidikan.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
        }))
    }

    // ─── Rekening ─────────────────────────────────────────────────────────────

    const openRekModal = (rek?: Rekening) => {
        setEditingRek(rek || null)
        setRekForm({
            nama_bank: rek?.nama_bank || '',
            atas_nama: rek?.atas_nama || '',
            nomor: rek?.nomor || '',
        })
        setShowRekModal(true)
    }

    const handleSaveRek = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!rekForm.nama_bank || !rekForm.nomor || !rekForm.atas_nama) {
            swalWarning('Peringatan', 'Nama Bank, Nomor Rekening, dan Atas Nama wajib diisi.')
            return
        }
        setSavingRek(true)
        try {
            const slot = editingRek?.slot || 1
            // Build the update payload for master_guru columns
            const payload: Record<string, any> = {
                [`rekening_${slot}_nama_bank`]: rekForm.nama_bank,
                [`rekening_${slot}_nomor`]: rekForm.nomor,
                [`rekening_${slot}_atas_nama`]: rekForm.atas_nama,
                [`rekening_${slot}_aktif`]: true,
            }

            const res = await fetch('/api/profile-guru', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Rekening berhasil disimpan.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#3083FF' })
                setShowRekModal(false)
                fetchGuruData()
            } else {
                swalError('Gagal', json.error)
            }
        } catch (e: any) { swalError('Error', e.message) }
        finally { setSavingRek(false) }
    }

    const handleDeleteRek = async (rek: Rekening) => {
        const c = await swalConfirm({
            title: 'Hapus Rekening?', text: `Hapus rekening ${rek.nama_bank} - ${rek.nomor}?`,
            icon: 'warning', confirmText: 'Ya, Hapus', cancelText: 'Batal',
        })
        if (!c.isConfirmed) return
        try {
            const payload: Record<string, any> = {
                [`rekening_${rek.slot}_nama_bank`]: '',
                [`rekening_${rek.slot}_nomor`]: '',
                [`rekening_${rek.slot}_atas_nama`]: '',
                [`rekening_${rek.slot}_aktif`]: false,
            }
            const res = await fetch('/api/profile-guru', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Rekening berhasil dihapus.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#10b981' })
                fetchGuruData()
            } else { swalError('Gagal', json.error) }
        } catch (e: any) { swalError('Error', e.message) }
    }

    const handleSwapRek = async () => {
        const r1 = rekeningList.find(r => r.slot === 1)
        const r2 = rekeningList.find(r => r.slot === 2)
        if (!r1 || !r2) return
        setSavingRek(true)
        try {
            const res = await fetch('/api/profile-guru', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rekening_1_nama_bank: r2.nama_bank, rekening_1_nomor: r2.nomor, rekening_1_atas_nama: r2.atas_nama, rekening_1_aktif: true,
                    rekening_2_nama_bank: r1.nama_bank, rekening_2_nomor: r1.nomor, rekening_2_atas_nama: r1.atas_nama, rekening_2_aktif: true,
                }),
            })
            const json = await res.json()
            if (json.ok) {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Rekening utama berhasil ditukar.', timer: 2000, showConfirmButton: false, confirmButtonColor: '#3083FF' })
                fetchGuruData()
            } else { swalError('Gagal', json.error) }
        } catch (e: any) { swalError('Error', e.message) }
        finally { setSavingRek(false) }
    }

    // Siswa Ekskul logic moved to EkskulPembina module

    // ─── Account form handlers ─────────────────────────────────────────────────

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            swalError('Error', 'File yang dipilih harus berupa gambar.');
            e.target.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            swalError('Error', 'Ukuran foto maksimal adalah 10 MB.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader()
        reader.addEventListener('load', () => setImageToCrop(reader.result as string))
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const uploadFile = async (file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            swalError('Error', 'Ukuran foto maksimal adalah 10 MB.');
            return;
        }
        setUploading(true)
        try {
            // Konversi gambar ke WebP agar ukuran kecil & kualitas tetap bagus
            let fileToUpload = file
            if (file.type.startsWith('image/') && !file.type.includes('webp')) {
                fileToUpload = await convertFileToWebp(file, 800, 0.85).catch(() => file)
            }
            const fd = new FormData()
            fd.append('file', fileToUpload); fd.append('folder', 'profil_users')
            if (formData.photoUrl) fd.append('old_file', formData.photoUrl)
            const res = await fetch('/api/upload', { method: 'POST', body: fd })
            const data = await res.json()
            if (data.ok) {
                // Simpan URL asli apa adanya dari server
                setFormData(prev => ({ ...prev, photoUrl: data.publicUrl }))
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Foto berhasil diunggah', timer: 1500, showConfirmButton: false })
            } else { throw new Error(data.error || 'Gagal upload') }
        } catch (error: any) { swalError('Error', error.message) }
        finally { setUploading(false) }
    }

    const startCamera = async () => {
        setShowCamera(true)
        try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); if (videoRef.current) videoRef.current.srcObject = stream }
        catch (err) { swalError('Error', 'Gagal mengakses kamera'); setShowCamera(false) }
    }

    const stopCamera = () => {
        if (videoRef.current?.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()) }
        setShowCamera(false)
    }

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current
            canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const reader = new FileReader()
                    reader.addEventListener('load', () => { setImageToCrop(reader.result as string); stopCamera() })
                    reader.readAsDataURL(blob)
                }
            }, 'image/webp', 0.9)
        }
    }

    const onCropComplete = useCallback((_: any, pixels: any) => setCroppedAreaPixels(pixels), [])

    const handleCropDone = async () => {
        if (!imageToCrop || !croppedAreaPixels) return
        setUploading(true)
        try {
            const blob = await getCroppedImg(
                imageToCrop,
                croppedAreaPixels,
                0,
                { horizontal: false, vertical: false },
                'image/webp',
                0.85,
                800
            )
            if (!blob) throw new Error('Gagal memproses gambar')
            const isWebp = blob.type === 'image/webp'
            const ext = isWebp ? 'webp' : 'jpg'
            const file = new File([blob], `avatar_${Date.now()}.${ext}`, { type: blob.type || 'image/webp' })
            await uploadFile(file)
            setImageToCrop(null)
        } catch (error: any) { swalError('Error', error.message) }
        finally { setUploading(false) }
    }

    const handleRemovePhoto = async () => {
        const confirm = await swalConfirm({ title: 'Hapus Foto?', text: 'Foto profil Anda akan dikembalikan ke default.', icon: 'warning', confirmText: 'Ya, Hapus', cancelText: 'Batal' })
        if (!confirm.isConfirmed) return
        setLoading(true)
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: formData.username, photoUrl: null, removeOldFileUrl: formData.photoUrl })
            })
            const data = await res.json()
            if (data.ok) { setFormData(prev => ({ ...prev, photoUrl: '' })); swalSuccess('Terhapus', 'Foto profil telah dihapus.'); clearUserCache(); await onRefreshUser() }
            else { throw new Error(data.error) }
        } catch (error: any) { swalError('Error', error.message) }
        finally { setLoading(false) }
    }

    const handleSubmitAccount = async (e: React.FormEvent) => {
        e.preventDefault()
        setPwdError('')
        if (formData.newPassword) {
            if (formData.newPassword.length < 6) { swalError('Error', 'Password baru minimal 6 karakter'); return }
            if (formData.newPassword !== formData.confirmPassword) { swalError('Error', 'Konfirmasi password tidak cocok'); return }
            if (!formData.currentPassword) { setPwdError('Password saat ini wajib diisi. Gunakan password sementara dari admin jika akun baru direset.'); return }
            if (formData.newPassword === formData.currentPassword) { setPwdError('Password baru harus berbeda dari password saat ini'); return }
        }
        setLoading(true)
        try {
            const changingPassword = !!formData.newPassword
            const res = await fetch(changingPassword ? '/api/auth/update-password' : '/api/user/profile', {
                method: changingPassword ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changingPassword ? { password: formData.newPassword, oldPassword: formData.currentPassword } : { username: formData.username, email: formData.email, photoUrl: formData.photoUrl || null })
            })
            const data = await res.json()
            if (res.ok && data.ok) {
                if (formData.newPassword) {
                    setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '', currentPassword: '' }))
                    clearUserCache()
                    try { await Swal.fire({ icon: 'success', title: 'Password Berhasil Diganti', text: 'Silakan login kembali menggunakan password baru.', timer: 2000, showConfirmButton: false }) }
                    finally { window.location.href = '/login' }
                } else {
                    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Profil diperbarui', timer: 2000, showConfirmButton: false, confirmButtonColor: '#3083FF' })
                    setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '', currentPassword: '' }))
                    clearUserCache(); await onRefreshUser()
                }
            } else {
                if (data.error?.includes('Password saat ini') || data.error?.includes('wajib')) {
                    setPwdError(data.error)
                } else {
                    swalError('Gagal', data.error || 'Terjadi kesalahan')
                }
            }
        } catch (error) { swalError('Error', 'Gagal menghubungi server') }
        finally { setLoading(false) }
    }

    const getPasswordStrength = (pwd: string) => {
        if (!pwd) return { score: 0, label: '', color: 'transparent' }
        let score = 0
        if (pwd.length >= 6) score++; if (pwd.length >= 10) score++; if (/[A-Z]/.test(pwd)) score++
        if (/[0-9]/.test(pwd)) score++; if (/[^A-Za-z0-9]/.test(pwd)) score++
        if (score <= 2) return { score, label: 'Lemah', color: '#ef4444' }
        if (score <= 4) return { score, label: 'Sedang', color: '#f59e0b' }
        return { score, label: 'Kuat', color: '#10b981' }
    }
    const strength = getPasswordStrength(formData.newPassword)

    const generatePassword = () => {
        const sets = [
            'abcdefghjkmnpqrstuvwxyz', 'ABCDEFGHJKMNPQRSTUVWXYZ', '0123456789', '!@#$%^&*'
        ]
        const all = sets.join('')
        let pwd = ''
        for (let i = 0; i < 14; i++) {
            const s = i < 1 ? sets[0] : i < 2 ? sets[1] : i < 3 ? sets[2] : sets[3]
            pwd += s[Math.floor(Math.random() * s.length)]
        }
        for (let i = pwd.length; i < 16; i++) pwd += all[Math.floor(Math.random() * all.length)]
        const arr = pwd.split('')
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr.join('')
    }

    const handleGenPwd = () => {
        const g = generatePassword()
        setFormData(prev => ({ ...prev, newPassword: g, confirmPassword: g }))
        setPwdError('')
    }

    const copyPwd = (pwd: string) => {
        navigator.clipboard.writeText(pwd)
        setCopiedPwd(pwd)
        setTimeout(() => setCopiedPwd(''), 2000)
    }
    const [copiedPwd, setCopiedPwd] = useState('')

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="profile-container">
            {/* Crop Overlay - rendered via portal to escape filter:blur stacking context */}
            {imageToCrop && typeof document !== 'undefined' && createPortal(
                <div className="crop-overlay">
                    <div className="crop-container">
                        <div className="crop-header">
                            <h3>Sesuaikan Foto</h3>
                            <button onClick={() => setImageToCrop(null)} className="btn-close-crop"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="crop-area">
                            <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1}
                                onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
                        </div>
                        <div className="crop-footer">
                            <div className="zoom-slider">
                                <i className="bi bi-zoom-out"></i>
                                <input type="range" value={zoom} min={1} max={3} step={0.1}
                                    onChange={e => setZoom(Number(e.target.value))} className="zoom-range" />
                                <i className="bi bi-zoom-in"></i>
                            </div>
                            <div className="crop-actions">
                                <button className="btn-cancel" onClick={() => setImageToCrop(null)}>Batal</button>
                                <button className="btn-done" onClick={handleCropDone}><i className="bi bi-check-lg mr-2"></i> Terapkan</button>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Universal Tabs Navigation (Tanpa Banner) */}
            <div className="profile-tabs-wrapper">
                <Tab
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Navigasi Profil"
                    variant="slider"
                />
            </div>

            {/* Standalone Card for Tab Contents */}
            <div className="profile-card premium-glass-card">

                {/* ── Tab: Akun & Keamanan ── */}
                {activeTab === 'akun' && (
                    <form onSubmit={handleSubmitAccount} noValidate={!!formData.newPassword} className="profile-tab-content">

                        {/* Simple & Clean Identity Strip */}
                        <div className="ps-identity-bar">
                            <div className="pib-avatar-ring">
                                <div className="pib-avatar">
                                    {uploading ? (
                                        <div className="pib-avatar-loading"><Spinner size={16} color="var(--n-primary)" /></div>
                                    ) : formData.photoUrl ? (
                                        <img src={getProxiedImageUrl(formData.photoUrl)} alt="Avatar" />
                                    ) : (
                                        <i className="bi bi-person-fill"></i>
                                    )}
                                </div>
                            </div>
                            <div className="pib-info">
                                <div className="pib-name-row">
                                    <h2 className="pib-name">{user.nama || user.username || 'Pengguna'}</h2>
                                </div>
                                <div className="pib-meta">
                                    <span className="pib-meta-item">
                                        NIP: <strong>{user.nip || '-'}</strong>
                                    </span>
                                </div>
                                <div className="pib-roles-row">
                                    {primaryRoles.map((role, idx) => (
                                        <span key={idx} className="pib-badge role">{role}</span>
                                    ))}
                                    {remainingRolesCount > 0 && (
                                        <span className="pib-badge more" title={remainingRolesTooltip}>
                                            +{remainingRolesCount} lainnya
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Layout Grid */}
                        <div className="ps-glass-grid">
                            
                            {/* Left Column: Profile & Credentials */}
                            <div className="ps-glass-section">
                                <div className="ps-section-head">
                                    <div className="ps-section-icon creds">
                                        <i className="bi bi-person-vcard-fill"></i>
                                    </div>
                                    <div className="ps-section-info">
                                        <h3>Kredensial Profil</h3>
                                    </div>
                                </div>
                                
                                <div className="ps-section-body">
                                    <div className="ps-field-group">
                                        <label><i className="bi bi-at"></i> Username</label>
                                        <div className="ps-input-wrapper">
                                            <input 
                                                type="text" 
                                                className="ps-glass-input"
                                                value={formData.username}
                                                onChange={e => setFormData({ ...formData, username: e.target.value })} 
                                                placeholder="Username Anda"
                                                required 
                                            />
                                            <div className="ps-input-glow"></div>
                                        </div>
                                        <p className="ps-field-helpText">Username digunakan untuk masuk ke dashboard.</p>
                                    </div>

                                        <div className="ps-field-group">
                                            <label><i className="bi bi-envelope"></i> Email</label>
                                            <div className="ps-input-wrapper">
                                                <input 
                                                    type="email" 
                                                    className="ps-glass-input"
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                                    placeholder="contoh@email.com"
                                                />
                                                <div className="ps-input-glow"></div>
                                            </div>
                                            <p className="ps-field-helpText">Email untuk keamanan dan pemulihan password.</p>
                                        </div>

                                    <div className="ps-field-group">
                                        <label><i className="bi bi-image"></i> Foto Profil</label>
                                        <div className="ps-avatar-editor">
                                            <div className="ps-editor-preview">
                                                {formData.photoUrl ? (
                                                    <img src={formData.photoUrl} alt="Preview" />
                                                ) : (
                                                    <i className="bi bi-person-fill"></i>
                                                )}
                                                {uploading && <div className="ps-editor-loading"><Spinner size={18} color="#ffffff" /></div>}
                                            </div>
                                            <div className="ps-editor-controls">
                                                <label className="ps-btn-glass upload">
                                                    <i className="bi bi-folder-plus"></i> Galeri
                                                    <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
                                                </label>
                                                <button type="button" className="ps-btn-glass camera" onClick={startCamera}>
                                                    <i className="bi bi-camera-fill"></i> Kamera
                                                </button>
                                                {formData.photoUrl && (
                                                    <ActionButton action="delete" onClick={handleRemovePhoto} />
                                                )}
                                            </div>
                                        </div>
                                        <p className="ps-field-helpText">Maksimal 10 MB. Foto otomatis dikonversi ke WebP untuk ukuran ringan dan kualitas tinggi.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Security & Password */}
                            <div className="ps-glass-section security">
                                <div className="ps-section-head">
                                    <div className="ps-section-icon safety">
                                        <i className="bi bi-shield-shaded"></i>
                                    </div>
                                    <div className="ps-section-info">
                                        <h3>Keamanan Akun</h3>
                                    </div>
                                    <div className="ps-security-badge-soft">Safe</div>
                                </div>

                                <div className="ps-section-body">
                                    {formData.newPassword && (
                                        <div className="ps-field-group animate-slideDown">
                                            <label className="required-label">Password Saat Ini</label>
                                            <div className="ps-input-wrapper">
                                                <input 
                                                    type={showCurrentPwd ? "text" : "password"} 
                                                    className="ps-glass-input highlight"
                                                    placeholder="Konfirmasi password lama"
                                                    value={formData.currentPassword || ''}
                                                    onChange={e => { setFormData({ ...formData, currentPassword: e.target.value }); setPwdError('') }} 
                                                />
                                                <button type="button" className="ps-eye-btn" onClick={() => setShowCurrentPwd(!showCurrentPwd)}>
                                                    <i className={`bi ${showCurrentPwd ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                                                </button>
                                            </div>
                                            {pwdError && <div className="ps-error-msg"><i className="bi bi-exclamation-triangle-fill"></i> {pwdError}</div>}
                                        </div>
                                    )}

                                    <div className="ps-field-group">
                                        <label>Password Baru</label>
                                        <div className="ps-input-wrapper">
                                            <input 
                                                type={showNewPwd ? "text" : "password"} 
                                                className="ps-glass-input"
                                                placeholder="Kosongi jika tidak diubah"
                                                value={formData.newPassword}
                                                onChange={e => { setFormData({ ...formData, newPassword: e.target.value }); setPwdError('') }} 
                                            />
                                            <button type="button" className="ps-eye-btn" onClick={() => setShowNewPwd(!showNewPwd)}>
                                                <i className={`bi ${showNewPwd ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                                            </button>
                                        </div>
                                        {formData.newPassword && (
                                            <div className="ps-strength-box">
                                                <div className="ps-strength-meter">
                                                    <div className="ps-strength-bg">
                                                        <div className="ps-strength-fill" style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}></div>
                                                    </div>
                                                    <span className="ps-strength-label" style={{ color: strength.color }}>Level: {strength.label}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="ps-field-group">
                                        <label>Ulangi Password Baru</label>
                                        <div className="ps-input-wrapper">
                                            <input 
                                                type={showConfirmPwd ? "text" : "password"} 
                                                className="ps-glass-input"
                                                placeholder="Konfirmasi ulang"
                                                value={formData.confirmPassword}
                                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} 
                                            />
                                            <button type="button" className="ps-eye-btn" onClick={() => setShowConfirmPwd(!showConfirmPwd)}>
                                                <i className={`bi ${showConfirmPwd ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                                            </button>
                                        </div>
                                        {formData.newPassword && formData.confirmPassword && (
                                            <div className={`ps-match-status ${formData.newPassword === formData.confirmPassword ? 'match' : 'mismatch'}`}>
                                                <i className={`bi ${formData.newPassword === formData.confirmPassword ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                                                {formData.newPassword === formData.confirmPassword ? 'Password Cocok' : 'Password Belum Sama'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Magic Generator */}
                                    <div className="ps-generator-wrapper">
                                        <button type="button" className={`ps-gen-toggler ${showPwdGen ? 'active' : ''}`} onClick={() => setShowPwdGen(!showPwdGen)}>
                                            <i className="bi bi-stars"></i>
                                            <span>{showPwdGen ? 'Tutup Generator' : 'Butuh Password Kuat?'}</span>
                                            <i className={`bi ${showPwdGen ? 'bi-chevron-up' : 'bi-chevron-down'} ml-auto`}></i>
                                        </button>
                                        
                                        {showPwdGen && (
                                            <div className="ps-gen-glass-panel animate-slideUp">
                                                <p className="ps-gen-desc">Hasilkan kombinasi 16 karakter acak yang super aman.</p>
                                                <div className="ps-gen-row">
                                                    <div className="ps-gen-display">{formData.newPassword || '••••••••••••••••'}</div>
                                                    <button type="button" className="ps-gen-refresh" onClick={handleGenPwd} title="Hasilkan Acak"><i className="bi bi-arrow-clockwise"></i></button>
                                                    <button type="button" className="ps-gen-copy" onClick={() => copyPwd(formData.newPassword)} disabled={!formData.newPassword}>
                                                        <i className={`bi ${copiedPwd === formData.newPassword ? 'bi-check2' : 'bi-copy'}`}></i>
                                                        {copiedPwd === formData.newPassword ? 'Siap!' : 'Salin'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="ps-glass-footer">
                            {formData.newPassword && <p className="ps-field-helpText">Yang disimpan saat ini hanya password. Simpan perubahan data profil secara terpisah.</p>}
                            <button type="submit" className="ps-btn-submit-premium" disabled={loading || uploading}>
                                {loading ? (
                                    <span className="ps-loading-dots"><span></span><span></span><span></span></span>
                                ) : (
                                    <><i className="bi bi-cloud-arrow-up-fill"></i> {formData.newPassword ? 'Ganti Password' : 'Simpan Perubahan'}</>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* ── Tab: Data Diri (GURU) ── */}
                {activeTab === 'data-diri' && guruData && (
                    <form onSubmit={handleSaveGuru} className="profile-tab-content">
                        {loading ? (
                            <div className="tab-loading"><Spinner size={34} /></div>
                        ) : (
                            <>
                                {/* Premium Info Grid */}
                                <div className="ps-glass-grid no-gap-top">
                                    <div className="ps-glass-section full-width">
                                        <div className="ps-section-head">
                                            <div className="ps-section-icon info"><i className="bi bi-person-lines-fill"></i></div>
                                            <div className="ps-section-info"><h3>Informasi Kepegawaian</h3></div>
                                        </div>
                                        <div className="ps-section-body">
                                            <div className="ps-kepegawaian-summary">
                                                <div className="ps-ks-item">
                                                    <span className="ps-ks-label">Nama Lengkap</span>
                                                    <span className="ps-ks-val">{guruData?.nama_lengkap || '-'}</span>
                                                </div>
                                                <div className="ps-ks-divider" />
                                                <div className="ps-ks-item">
                                                    <span className="ps-ks-label">NIP</span>
                                                    <span className="ps-ks-val font-mono">{guruData?.nip || '-'}</span>
                                                </div>
                                                <div className="ps-ks-divider" />
                                                <div className="ps-ks-item">
                                                    <span className="ps-ks-label">Pangkat / Golongan</span>
                                                    <span className="ps-ks-val">{[guruData?.pangkat, guruData?.golongan].filter(Boolean).join(' / ') || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ps-glass-section">
                                        <div className="ps-section-head">
                                            <div className="ps-section-icon person"><i className="bi bi-person-circle"></i></div>
                                            <div className="ps-section-info"><h3>Data Pribadi</h3></div>
                                        </div>
                                        <div className="ps-section-body">
                                            <div className="ps-form-columns">
                                                <div className="ps-field-group">
                                                    <label>Tempat Lahir</label>
                                                    <input type="text" className="ps-glass-input" value={guruForm.tempat_lahir} onChange={e => setGuruForm(p => ({ ...p, tempat_lahir: e.target.value }))} placeholder="Contoh: Jakarta" />
                                                </div>
                                                <div className="ps-field-group">
                                                    <label>Tanggal Lahir</label>
                                                    <DatePicker className="ps-glass-input" value={guruForm.tanggal_lahir} onChange={v => setGuruForm(p => ({ ...p, tanggal_lahir: v }))} />
                                                </div>
                                                <div className="ps-field-group full">
                                                    <label>Alamat</label>
                                                    <input type="text" className="ps-glass-input" value={guruForm.alamat} onChange={e => setGuruForm(p => ({ ...p, alamat: e.target.value }))} placeholder="Alamat lengkap saat ini" />
                                                </div>
                                                <div className="ps-field-group">
                                                    <label>No. HP</label>
                                                    <input type="tel" className="ps-glass-input" value={guruForm.no_hp} onChange={e => setGuruForm(p => ({ ...p, no_hp: e.target.value }))} placeholder="08xxxxxxxxxx" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ps-glass-section">
                                        <div className="ps-section-head">
                                            <div className="ps-section-icon brief"><i className="bi bi-briefcase-fill"></i></div>
                                            <div className="ps-section-info"><h3>Kepegawaian</h3></div>
                                        </div>
                                        <div className="ps-section-body">
                                            <div className="ps-form-columns">
                                                <div className="ps-field-group">
                                                    <label>Golongan</label>
                                                    <select className="ps-glass-input select" value={guruForm.golongan} onChange={e => setGuruForm(p => ({ ...p, golongan: e.target.value }))}>
                                                        <option value="">Pilih Golongan</option>
                                                        {GOLONGAN_OPTIONS.filter(o => o).map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                                <div className="ps-field-group">
                                                    <label>Pangkat</label>
                                                    <select className="ps-glass-input select" value={guruForm.pangkat} onChange={e => setGuruForm(p => ({ ...p, pangkat: e.target.value }))}>
                                                        <option value="">Pilih Pangkat</option>
                                                        {PANGKAT_OPTIONS.filter(o => o).map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div className="ps-field-group full">
                                                    <label>TMT Tugas</label>
                                                    <DatePicker className="ps-glass-input" value={guruForm.tmt_tugas} onChange={v => setGuruForm(p => ({ ...p, tmt_tugas: v }))} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Data Rekening — Table Layout */}
                                    {/* Data Rekening — Table Layout (Desktop) & Cards (Mobile) */}
                                    <div className="ps-glass-section full-width">
                                        <div className="ps-section-head">
                                            <div className="ps-section-icon bank"><i className="bi bi-bank2"></i></div>
                                            <div className="ps-section-info"><h3>Rekening Bank</h3></div>
                                            <button type="button" className="ps-rek-add-row-btn" onClick={() => openRekModal()}>
                                                <i className="bi bi-plus"></i> Tambah Rekening
                                            </button>
                                        </div>

                                        {/* Desktop Table View */}
                                        <div className="ps-rek-table-wrap ps-rek-desktop-table">
                                            <table className="ps-rek-table">
                                                <thead>
                                                    <tr>
                                                        <th>Bank</th>
                                                        <th>Nomor Rekening</th>
                                                        <th>Atas Nama</th>
                                                        <th style={{ width: '90px' }}>Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rekeningList.length === 0 ? (
                                                        <tr className="ps-rek-empty-row">
                                                            <td colSpan={4}>Belum ada data rekening.</td>
                                                        </tr>
                                                    ) : (
                                                        rekeningList.map(rek => (
                                                            <tr key={rek.slot}>
                                                                <td>
                                                                    <span className="rek-bank-name">
                                                                        {rek.nama_bank}
                                                                        {rek.slot === 1 && <span className="rek-bank-badge">Utama</span>}
                                                                    </span>
                                                                </td>
                                                                <td><span className="rek-no">{rek.nomor}</span></td>
                                                                <td><span className="rek-an">{rek.atas_nama}</span></td>
                                                                <td>
                                                                    <div className="rek-actions-cell">
                                                                        <ActionButton action="edit" onClick={() => openRekModal(rek)} />
                                                                        <ActionButton action="delete" onClick={() => handleDeleteRek(rek)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Cards View */}
                                        <div className="ps-rek-mobile-cards">
                                            {rekeningList.length === 0 ? (
                                                <div className="ps-rek-empty-mobile">Belum ada data rekening.</div>
                                            ) : (
                                                rekeningList.map(rek => (
                                                    <div key={rek.slot} className="ps-rek-card">
                                                        <div className="ps-rek-card-head">
                                                            <span className="rek-bank-name">
                                                                {rek.nama_bank}
                                                                {rek.slot === 1 && <span className="rek-bank-badge">Utama</span>}
                                                            </span>
                                                            <div className="rek-actions-cell">
                                                                <ActionButton action="edit" onClick={() => openRekModal(rek)} />
                                                                <ActionButton action="delete" onClick={() => handleDeleteRek(rek)} />
                                                            </div>
                                                        </div>
                                                        <div className="ps-rek-card-body">
                                                            <div className="ps-rek-field">
                                                                <span className="ps-id-label">Nomor Rekening</span>
                                                                <span className="rek-no">{rek.nomor}</span>
                                                            </div>
                                                            <div className="ps-rek-field">
                                                                <span className="ps-id-label">Atas Nama</span>
                                                                <span className="rek-an">{rek.atas_nama}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="ps-glass-section full-width">
                                        <div className="ps-section-head">
                                            <div className="ps-section-icon edu"><i className="bi bi-mortarboard-fill"></i></div>
                                            <div className="ps-section-info"><h3>Riwayat Pendidikan</h3></div>
                                            <button type="button" className="ps-rek-add-row-btn" onClick={handleAddRiwayat}>
                                                <i className="bi bi-plus"></i> Tambah
                                            </button>
                                        </div>
                                        <div className="ps-section-body">
                                            {guruForm.riwayat_pendidikan.length === 0 ? (
                                                <div className="ps-edu-empty">Belum ada data pendidikan.</div>
                                            ) : (
                                                <div className="ps-edu-list">
                                                    {guruForm.riwayat_pendidikan.map((r, i) => (
                                                        <div key={i} className="ps-edu-item">
                                                            <div className="ps-edu-item-top">
                                                                <select className="ps-edu-select" value={r.level} onChange={e => handleRiwayatChange(i, 'level', e.target.value)}>
                                                                    <option value="">Pilih Tingkat</option>
                                                                    {PENDIDIKAN_OPTIONS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
                                                                </select>
                                                                <div className="ps-edu-actions">
                                                                    <ActionButton action="edit" onClick={() => document.getElementById(`edu-input-${i}`)?.focus()} />
                                                                    <ActionButton action="delete" onClick={() => handleRemoveRiwayat(i)} />
                                                                </div>
                                                            </div>
                                                            <input 
                                                                id={`edu-input-${i}`}
                                                                type="text" 
                                                                className="ps-edu-input" 
                                                                value={r.detail} 
                                                                onChange={e => handleRiwayatChange(i, 'detail', e.target.value)} 
                                                                placeholder="Nama sekolah / universitas" 
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="ps-glass-footer">
                                    <button type="submit" className="ps-btn-submit-premium" disabled={savingGuru}>
                                        {savingGuru ? (
                                            <span className="ps-loading-dots"><span></span><span></span><span></span></span>
                                        ) : (
                                            <><i className="bi bi-floppy2-fill"></i> Simpan Perubahan</>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                )}

                {/* ── Tab: Data Diri (SISWA) ── */}
                {activeTab === 'data-diri' && isSiswa && !siswaData && (
                    <div className="profile-tab-content" role={siswaStatus === 'error' ? 'alert' : 'status'}>
                        {siswaStatus === 'loading' ? <Spinner label="Memuat biodata siswa..." /> : (
                            <div className="ps-glass-section">
                                <h3>{siswaStatus === 'error' ? 'Biodata belum dapat dimuat' : 'Biodata siswa belum tertaut'}</h3>
                                <p>{siswaStatus === 'error' ? siswaError : 'NISN pada akun Anda belum cocok dengan data master siswa. Hubungi operator untuk memeriksa tautan akun dan NISN. Data Anda tidak dihapus.'}</p>
                                <button type="button" className="ps-btn-primary" onClick={() => void fetchSiswaData()}>Coba lagi</button>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'data-diri' && siswaData && (
                    <form onSubmit={handleSaveSiswa} className="profile-tab-content">
                        {loading ? (
                            <div className="ps-loading-state"><Spinner size={34} /></div>
                        ) : (
                            <>
                                <div className="ps-glass-section">
                                    <div className="ps-section-head">
                                        <div className="ps-section-icon creds" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                                            <i className="bi bi-person-vcard"></i>
                                        </div>
                                        <div className="ps-section-info">
                                            <h3>Data Siswa</h3>
                                        </div>
                                    </div>
                                    <div className="ps-section-body">
                                        <div className="ps-form-columns">
                                            <div className="ps-field-group">
                                                <label>NISN</label>
                                                <input type="text" className="ps-glass-input" value={siswaData?.nisn || ''} disabled style={{ background: 'rgba(0,0,0,0.02)', cursor: 'not-allowed', opacity: 0.7 }} />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>Nama Lengkap</label>
                                                <input type="text" className="ps-glass-input" value={siswaData?.nama_lengkap || ''} disabled style={{ background: 'rgba(0,0,0,0.02)', cursor: 'not-allowed', opacity: 0.7 }} />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>Jenis Kelamin</label>
                                                <select className="ps-glass-input" value={siswaForm.gender} onChange={e => setSiswaForm(p => ({ ...p, gender: e.target.value }))}>
                                                    <option value="">Pilih</option>
                                                    <option value="L">Laki-Laki</option>
                                                    <option value="P">Perempuan</option>
                                                </select>
                                            </div>
                                            <div className="ps-field-group">
                                                <label>No. HP Siswa</label>
                                                <input
                                                    type="tel"
                                                    className="ps-glass-input"
                                                    value={siswaForm.nomor_hp}
                                                    onChange={e => setSiswaForm(p => ({ ...p, nomor_hp: e.target.value }))}
                                                    placeholder="08xxxxxxxxxx"
                                                />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>Tempat Lahir</label>
                                                <input type="text" className="ps-glass-input" value={siswaForm.tempat_lahir} onChange={e => setSiswaForm(p => ({ ...p, tempat_lahir: e.target.value }))} placeholder="Kota/Kabupaten Lahir" />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>Tanggal Lahir</label>
                                                <DatePicker className="ps-glass-input" value={siswaForm.tanggal_lahir} onChange={v => setSiswaForm(p => ({ ...p, tanggal_lahir: v }))} />
                                            </div>

                                        </div>
                                    </div>
                                </div>

                                <div className="ps-glass-section">
                                    <div className="ps-section-head">
                                        <div className="ps-section-icon creds" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                            <i className="bi bi-people-fill"></i>
                                        </div>
                                        <div className="ps-section-info">
                                            <h3>Data Orang Tua & Alamat</h3>
                                        </div>
                                    </div>
                                    <div className="ps-section-body">
                                        <div className="ps-form-columns">
                                            <div className="ps-field-group">
                                                <label>Nama Ayah</label>
                                                <input type="text" className="ps-glass-input" value={siswaData?.nama_ayah || ''} disabled style={{ background: 'rgba(0,0,0,0.02)', cursor: 'not-allowed', opacity: 0.7 }} />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>No. HP Ayah</label>
                                                <input type="text" className="ps-glass-input" value={siswaForm.nomor_hp_ayah} onChange={e => setSiswaForm(p => ({ ...p, nomor_hp_ayah: e.target.value }))} placeholder="08xxx" />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>Nama Ibu</label>
                                                <input type="text" className="ps-glass-input" value={siswaData?.nama_ibu || ''} disabled style={{ background: 'rgba(0,0,0,0.02)', cursor: 'not-allowed', opacity: 0.7 }} />
                                            </div>
                                            <div className="ps-field-group">
                                                <label>No. HP Ibu</label>
                                                <input type="text" className="ps-glass-input" value={siswaForm.nomor_hp_ibu} onChange={e => setSiswaForm(p => ({ ...p, nomor_hp_ibu: e.target.value }))} placeholder="08xxx" />
                                            </div>
                                        </div>
                                        <div className="ps-field-group">
                                            <label>Asal Sekolah</label>
                                            <input type="text" className="ps-glass-input" value={siswaForm.asal_sekolah} onChange={e => setSiswaForm(p => ({ ...p, asal_sekolah: e.target.value }))} placeholder="SMP/MTs Asal" />
                                        </div>
                                        <div className="ps-field-group">
                                            <label>Alamat Lengkap</label>
                                            <textarea className="ps-glass-input" value={siswaForm.alamat} onChange={e => setSiswaForm(p => ({ ...p, alamat: e.target.value }))} rows={3} placeholder="Jalan, RT/RW, Desa/Kelurahan..."></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="ps-glass-footer">
                                    <button type="submit" className="ps-btn-submit-premium" disabled={savingSiswa}>
                                        {savingSiswa ? (
                                            <span className="ps-loading-dots"><span></span><span></span><span></span></span>
                                        ) : (
                                            <><i className="bi bi-floppy2-fill"></i> Simpan Perubahan</>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                )}

            </div>

            {/* ── Camera Modal - rendered via portal to escape filter:blur stacking context ── */}
            {showCamera && typeof document !== 'undefined' && createPortal(
                <div className="camera-modal">
                    <div className="camera-content">
                        <video ref={videoRef} autoPlay playsInline className="camera-video"></video>
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                        <div className="camera-controls">
                            <button type="button" className="cam-btn take" onClick={capturePhoto}><i className="bi bi-camera-fill"></i></button>
                            <button type="button" className="cam-btn close" onClick={stopCamera}><i className="bi bi-x-lg"></i></button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ── Rekening Modal - rendered via portal to escape filter:blur stacking context ── */}
            {showRekModal && typeof document !== 'undefined' && createPortal(
                <div className="ps-modal-overlay" onClick={e => e.target === e.currentTarget && setShowRekModal(false)}>
                    <div className="ps-modal animate-slideUp">
                        <div className="ps-modal-header">
                            <h3><i className="bi bi-bank2"></i> {editingRek ? 'Edit' : 'Tambah'} Rekening</h3>
                            <button className="ps-modal-close" onClick={() => setShowRekModal(false)}><i className="bi bi-x"></i></button>
                        </div>
                        <form onSubmit={handleSaveRek} className="ps-modal-body">
                            <div className="ps-field-group">
                                <label className="required-label">Nama Bank</label>
                                <select className="ps-glass-input" value={rekForm.nama_bank} onChange={e => setRekForm(p => ({ ...p, nama_bank: e.target.value }))} required>
                                    <option value="">Pilih Bank</option>
                                    {INDONESIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div className="ps-field-group">
                                <label className="required-label">Nomor Rekening</label>
                                <input type="text" className="ps-glass-input" value={rekForm.nomor} onChange={e => setRekForm(p => ({ ...p, nomor: e.target.value }))} placeholder="Masukkan nomor rekening" required />
                            </div>
                            <div className="ps-field-group">
                                <label className="required-label">Atas Nama</label>
                                <input type="text" className="ps-glass-input" value={rekForm.atas_nama} onChange={e => setRekForm(p => ({ ...p, atas_nama: e.target.value }))} placeholder="Nama pemilik rekening" required />
                            </div>
                            <div className="ps-modal-actions">
                                <button type="button" className="ps-btn-cancel" onClick={() => setShowRekModal(false)}>Batal</button>
                                <button type="submit" className="ps-btn-submit-premium" disabled={savingRek}>
                                    {savingRek ? <span className="ps-spinner-white"></span> : <><i className="bi bi-check2-circle"></i> Simpan</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}



            <style jsx>{`
    /* PROFIL SAYA - Modern Minimalist Design */
    .profile-container, .profile-container *, .profile-container *::before, .profile-container *::after { box-sizing: border-box; }
    .profile-container {
        padding: 4px 0 32px;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        min-height: 80vh;
    }

    .profile-tabs-wrapper {
        width: 100%;
        display: flex;
        justify-content: flex-start;
    }

    .premium-glass-card {
        background: var(--n-card);
        width: 100%;
        max-width: 1100px;
        border-radius: 16px;
        border: 1px solid var(--n-border);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
        overflow: hidden;
        animation: psFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes psFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* ════════════════════════════════
       SIMPLE & CLEAN IDENTITY BAR
    ════════════════════════════════ */
    .ps-identity-bar {
        background: var(--n-bg);
        border: 1px solid var(--n-border);
        border-radius: 12px;
        padding: 12px 18px;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 14px;
        transition: all 0.2s ease;
    }
    .pib-avatar-ring {
        width: 58px;
        height: 58px;
        border-radius: 14px;
        border: 1.5px solid var(--n-border);
        background: var(--n-card);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        position: relative;
    }
    .pib-avatar {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        color: var(--n-muted);
    }
    .pib-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .pib-avatar-loading {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .pib-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        flex: 1;
        justify-content: center;
    }
    .pib-name-row {
        display: flex;
        align-items: center;
    }
    .pib-name {
        margin: 0;
        font-size: 1.08rem;
        font-weight: 700;
        color: var(--n-ink);
        letter-spacing: -0.01em;
        line-height: 1.25;
    }
    .pib-meta {
        display: flex;
        align-items: center;
        font-size: 0.78rem;
        color: var(--n-muted);
        line-height: 1.3;
    }
    .pib-meta-item strong {
        color: var(--n-ink);
        font-weight: 600;
        margin-left: 2px;
    }
    .pib-roles-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 2px;
    }
    .pib-badge {
        padding: 2.5px 8px;
        border-radius: 6px;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        line-height: 1.3;
        display: inline-flex;
        align-items: center;
    }
    .pib-badge.role {
        background: rgba(48, 131, 255, 0.08);
        color: var(--n-primary, #3083FF);
        border: 1px solid rgba(48, 131, 255, 0.2);
    }
    .pib-badge.more {
        background: var(--n-border);
        color: var(--n-muted);
        cursor: help;
    }
    .pib-meta-item {
        display: inline-flex;
        align-items: center;
    }
    .pib-meta-item strong {
        color: var(--n-ink);
        font-weight: 600;
        margin-left: 3px;
    }
    .pib-sep {
        color: var(--n-border);
        font-size: 0.7rem;
    }
    .nav-tab.active { color: var(--n-primary); border-bottom-color: var(--n-primary); font-weight: 700; }
    .nav-badge { background: var(--n-primary); color: white; font-size: 0.6rem; font-weight: 800; padding: 2px 6px; border-radius: 20px; line-height: 1.4; }

    /* Tab Content */
    .profile-tab-content { padding: 24px 36px; display: flex; flex-direction: column; gap: 18px; background: var(--n-card); }
    .ps-glass-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .ps-glass-section { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .ps-glass-section.full-width { grid-column: 1 / -1; }
    .ps-section-head { display: flex; align-items: center; gap: 11px; padding-bottom: 13px; border-bottom: 1px solid var(--n-border); }
    .ps-section-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; background: #eff6ff; color: #1a73e8; border: 1px solid #dbeafe; }
    .ps-section-icon.creds, .ps-section-icon.safety, .ps-section-icon.info, .ps-section-icon.person, .ps-section-icon.brief, .ps-section-icon.bank, .ps-section-icon.edu { background: #eff6ff; color: #1a73e8; border-color: #dbeafe; }
    .ps-field-group label i { color: #1a73e8; }
    .ps-section-info { flex: 1; }
    .ps-section-info h3 { margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--n-ink); }
    .ps-section-info p { margin: 2px 0 0; font-size: 0.7rem; color: var(--n-muted); font-weight: 400; }
    .ps-security-badge-soft { padding: 2px 8px; background: rgba(34, 197, 94, 0.08); color: #22c55e; border-radius: 6px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
    .ps-section-body { display: flex; flex-direction: column; gap: 12px; }
    .ps-form-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ps-field-group { display: flex; flex-direction: column; gap: 4px; }
    .ps-field-group.full { grid-column: 1 / -1; }
    .ps-field-group label { font-size: 0.65rem; font-weight: 700; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 4px; }
    .required-label::after { content: '*'; color: #ef4444; margin-left: 2px; }
    .ps-field-helpText { font-size: 0.65rem; color: var(--n-muted); margin: 0; opacity: 0.7; }

    /* Input */
    .ps-input-wrapper { position: relative; }
    .ps-glass-input { width: 100%; max-width: 100%; padding: 9px 13px; border: 1.5px solid var(--n-border); border-radius: 9px; font-size: 0.83rem; font-weight: 500; color: var(--n-ink); background: var(--n-card); outline: none; transition: border-color 0.2s, box-shadow 0.2s; line-height: 1.4; box-sizing: border-box; }
    .ps-glass-input:focus { border-color: var(--n-primary); background: var(--n-card); box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.06); }
    .ps-glass-input.highlight { border-color: #f59e0b; background: #fffbeb; }
    .ps-eye-btn { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--n-muted); cursor: pointer; padding: 5px; font-size: 0.95rem; transition: color 0.2s; }
    .ps-eye-btn:hover { color: var(--n-primary); }
    .ps-error-msg { color: #ef4444; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; gap: 4px; }

    /* Avatar Editor */
    .ps-avatar-editor { display: flex; align-items: center; gap: 11px; }
    .ps-editor-preview { width: 48px; height: 48px; border-radius: 12px; background: var(--n-bg); border: 1.5px solid var(--n-border); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: var(--n-muted); flex-shrink: 0; }
    .ps-editor-preview img { width: 100%; height: 100%; object-fit: cover; }
    .ps-editor-loading { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
    .ps-editor-controls { display: flex; gap: 5px; flex-wrap: wrap; }
    .ps-btn-glass { padding: 6px 12px; border-radius: 9px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; border: 1px solid; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    .ps-btn-glass.upload { background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); color: #0284c7; border-color: #7dd3fc; }
    .ps-btn-glass.upload:hover { background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%); color: #0369a1; border-color: #38bdf8; transform: translateY(-1px); }
    .ps-btn-glass.camera { background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%); color: #1d4ed8; border-color: #60a5fa; }
    .ps-btn-glass.camera:hover { background: linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%); color: #1e40af; border-color: #3b82f6; transform: translateY(-1px); }
    .ps-btn-glass.delete { background: #fef2f2; color: #ef4444; border-color: #fecaca; padding: 5px 8px; }

    /* Strength Meter */
    .ps-strength-box { margin-top: 3px; }
    .ps-strength-meter { display: flex; flex-direction: column; gap: 2px; }
    .ps-strength-bg { height: 3px; background: var(--n-border); border-radius: 2px; overflow: hidden; }
    .ps-strength-fill { height: 100%; transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 2px; }
    .ps-strength-label { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    .ps-match-status { display: flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 700; margin-top: 3px; animation: fadeIn 0.2s; }
    .ps-match-status.match { color: #10b981; }
    .ps-match-status.mismatch { color: #ef4444; }

    /* Password Generator */
    .ps-generator-wrapper { margin-top: 7px; }
    .ps-gen-toggler { width: 100%; padding: 8px 12px; background: var(--n-bg); border: 1px dashed var(--n-border); border-radius: 8px; display: flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 700; color: var(--n-primary); cursor: pointer; transition: all 0.2s; }
    .ps-gen-toggler:hover, .ps-gen-toggler.active { background: rgba(0, 56, 168, 0.04); border-color: var(--n-primary); border-style: solid; }
    .ps-gen-glass-panel { background: var(--n-bg); border: 1px solid var(--n-border); border-radius: 9px; padding: 11px; margin-top: 7px; }
    .ps-gen-desc { margin: 0 0 7px; font-size: 0.68rem; color: var(--n-muted); }
    .ps-gen-row { display: flex; gap: 5px; align-items: center; }
    .ps-gen-display { flex: 1; padding: 7px 9px; background: var(--n-card); border: 1px solid var(--n-border); border-radius: 7px; font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: var(--n-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 34px; display: flex; align-items: center; }
    .ps-gen-refresh { width: 32px; height: 32px; border-radius: 7px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
    .ps-gen-refresh:hover { background: var(--n-bg); color: var(--n-primary); }
    .ps-gen-copy { padding: 0 10px; height: 32px; border-radius: 7px; border: none; background: var(--n-primary); color: white; font-size: 0.68rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; flex-shrink: 0; transition: all 0.2s; }
    .ps-gen-copy:hover:not(:disabled) { background: #2563eb; background: color-mix(in srgb, var(--n-primary) 85%, #000); color: #fff; }

    /* Kepegawaian Summary Strip */
    .ps-kepegawaian-summary {
        background: var(--n-bg);
        border: 1px solid var(--n-border);
        border-radius: 12px;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        width: 100%;
        box-sizing: border-box;
    }
    .ps-ks-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }
    .ps-ks-divider {
        width: 1px;
        height: 28px;
        background: var(--n-border);
        flex-shrink: 0;
    }
    .ps-ks-label {
        font-size: 0.65rem;
        font-weight: 700;
        color: var(--n-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .ps-ks-val {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--n-ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* ════════════════════════════════
       BANK / REKENING — Table Layout & Mobile Cards
    ════════════════════════════════ */
    .ps-rek-table-wrap { overflow-x: auto; }
    .ps-rek-table { width: 100%; border-collapse: collapse; }
    .ps-rek-table th {
        padding: 9px 14px; text-align: left;
        font-size: 0.62rem; font-weight: 800; color: var(--n-muted);
        text-transform: uppercase; letter-spacing: 0.05em;
        border-bottom: 2px solid var(--n-border);
        white-space: nowrap;
    }
    .ps-rek-table td {
        padding: 11px 14px;
        border-bottom: 1px solid var(--n-border);
        font-size: 0.83rem; vertical-align: middle; color: var(--n-ink);
    }
    .ps-rek-table tbody tr:hover td { background: var(--n-bg); }
    .ps-rek-table tbody tr:last-child td { border-bottom: none; }
    .rek-bank-name { font-size: 0.83rem; font-weight: 700; color: var(--n-primary); }
    .rek-bank-badge { display: inline-block; padding: 1px 7px; background: var(--n-primary); color: white; border-radius: 5px; font-size: 0.58rem; font-weight: 800; margin-left: 6px; vertical-align: middle; }
    .rek-no { font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; font-weight: 800; color: var(--n-ink); letter-spacing: 0.5px; }
    .rek-an { font-size: 0.83rem; font-weight: 600; color: var(--n-ink); }
    .rek-actions-cell { display: flex; gap: 5px; align-items: center; }
    .rek-btn { width: 28px; height: 28px; border-radius: 7px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.75rem; transition: all 0.2s; }
    .rek-btn.edit { background: #eff6ff; color: #3b82f6; }
    .rek-btn.edit:hover { background: #3b82f6; color: white; }
    .rek-btn.delete { background: #fef2f2; color: #ef4444; }
    .rek-btn.delete:hover { background: #ef4444; color: white; }
    .ps-rek-empty-row td { text-align: center; padding: 28px; color: var(--n-muted); font-size: 0.8rem; font-style: italic; }
    .ps-rek-add-row-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; background: #eff6ff; color: var(--n-primary); border: 1.5px dashed rgba(0, 56, 168, 0.25); border-radius: 9px; font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .ps-rek-add-row-btn:hover { background: var(--n-primary); color: white; border-color: var(--n-primary); border-style: solid; }

    /* Mobile Cards View for Rekening */
    .ps-rek-mobile-cards { display: none; }
    .ps-rek-card { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
    .ps-rek-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; }
    .ps-rek-card-body { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px dashed var(--n-border); }
    .ps-rek-field { display: flex; flex-direction: column; gap: 2px; }
    .ps-rek-empty-mobile { text-align: center; padding: 16px; color: var(--n-muted); font-size: 0.8rem; font-style: italic; }

    /* Education List */
    .ps-edu-list { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .ps-edu-item { display: flex; flex-direction: column; gap: 8px; background: var(--n-card); padding: 12px 14px; border-radius: 12px; border: 1px solid var(--n-border); width: 100%; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
    .ps-edu-item-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; }
    .ps-edu-select { flex: 1; height: 38px; padding: 0 10px; border: 1.5px solid var(--n-border); border-radius: 9px; background: var(--n-card); font-weight: 600; font-size: 0.82rem; outline: none; color: var(--n-ink); transition: border-color 0.2s, box-shadow 0.2s; }
    .ps-edu-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .ps-edu-input { width: 100%; height: 38px; padding: 0 12px; border: 1.5px solid var(--n-border); border-radius: 9px; background: var(--n-card); font-weight: 500; font-size: 0.82rem; outline: none; color: var(--n-ink); transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
    .ps-edu-select:focus, .ps-edu-input:focus { border-color: var(--n-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .ps-edu-remove { width: 32px; height: 32px; border-radius: 8px; background: #fef2f2; color: #ef4444; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .ps-edu-remove:hover { background: #ef4444; color: white; }
    .ps-btn-add-edu { padding: 5px 10px; background: #eff6ff; color: var(--n-primary); border: none; border-radius: 7px; font-weight: 700; font-size: 0.72rem; cursor: pointer; margin-left: auto; transition: all 0.2s; }
    .ps-btn-add-edu:hover { background: var(--n-primary); color: white; }

    /* Footer Actions */
    .ps-glass-footer { padding: 20px 0 0; border-top: 1px solid var(--n-border); display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
    .ps-footer-note { display: flex; align-items: center; gap: 8px; color: #0369a1; font-size: 0.72rem; font-weight: 600; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 8px 14px; border-radius: 9px; border: 1px solid #bae6fd; max-width: max-content; white-space: nowrap; line-height: 1.2; }
    .ps-footer-note span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ps-footer-note i { font-size: 0.9rem; color: #0284c7; flex-shrink: 0; }
    .ps-btn-submit-premium { padding: 10px 24px; background: var(--n-primary); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
    .ps-btn-submit-premium:hover:not(:disabled) { background: #2563eb; background: color-mix(in srgb, var(--n-primary) 85%, #000); color: #fff; transform: translateY(-1px); }
    .ps-btn-submit-premium:focus-visible:not(:disabled) { outline: 2px solid var(--n-primary); outline-offset: 3px; }
    .ps-btn-submit-premium:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* Ekskul Tab */
    .ps-tab-content { padding: 24px 36px; display: flex; flex-direction: column; gap: 16px; }
    .ps-tab-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .ps-tab-header-left { display: flex; align-items: center; gap: 12px; }
    .ps-tab-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; flex-shrink: 0; }
    .ps-tab-title { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--n-ink); }
    .ps-tab-desc { margin: 2px 0 0; color: var(--n-muted); font-size: 0.75rem; }
    .ps-btn-primary { padding: 8px 14px; background: var(--n-primary); color: white; border: none; border-radius: 9px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s; white-space: nowrap; }
    .ps-btn-primary:hover:not(:disabled) { background: #2563eb; background: color-mix(in srgb, var(--n-primary) 85%, #000); color: #fff; transform: translateY(-1px); }
    .ps-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .ps-aa-stats { display: flex; gap: 9px; margin-bottom: 12px; }
    .ps-aa-stat { background: var(--n-bg); border: 1px solid var(--n-border); border-radius: 10px; padding: 10px 16px; text-align: center; flex: 1; min-width: 68px; }
    .ps-aa-stat-aktif { background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2); }
    .ps-aa-stat-num { font-size: 1.4rem; font-weight: 900; color: var(--n-ink); line-height: 1; }
    .ps-aa-stat-aktif .ps-aa-stat-num { color: #3083FF; }
    .ps-aa-stat-lbl { font-size: 0.6rem; font-weight: 800; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
    .ps-aa-filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .ps-filter-select { padding: 8px 12px; border: 1.5px solid var(--n-border); border-radius: 8px; font-size: 0.8rem; font-weight: 600; background: var(--n-bg); outline: none; color: var(--n-ink); cursor: pointer; transition: border-color 0.2s; min-width: 140px; }
    .ps-filter-select:focus { border-color: var(--n-primary); }
    .ps-filter-select:disabled { opacity: 0.4; cursor: not-allowed; }
    .ps-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 150px; gap: 9px; color: var(--n-muted); font-size: 0.8rem; }
    .ps-empty-state { text-align: center; padding: 40px 24px; }
    .ps-empty-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin: 0 auto 12px; }
    .ps-empty-state h3 { margin: 0 0 4px; font-size: 0.88rem; font-weight: 700; color: var(--n-ink); }
    .ps-empty-state p { margin: 0 0 14px; font-size: 0.78rem; color: var(--n-muted); }

    /* Table */
    .ps-aa-table-wrap { overflow-x: auto; }
    .ps-aa-table { width: 100%; border-collapse: collapse; }
    .ps-aa-table th { padding: 9px 13px; text-align: left; font-size: 0.62rem; font-weight: 800; color: var(--n-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid var(--n-border); white-space: nowrap; }
    .ps-aa-table td { padding: 10px 13px; border-bottom: 1px solid var(--n-border); font-size: 0.83rem; vertical-align: middle; color: var(--n-ink); }
    .ps-aa-table tbody tr:hover td { background: var(--n-bg); }
    .ps-aa-td-num { color: var(--n-muted); font-weight: 700; font-size: 0.72rem; width: 36px; }
    .ps-aa-td-nisn { color: var(--n-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; }
    .ps-aa-student-cell { display: flex; align-items: center; gap: 8px; }
    .ps-aa-avatar-sm { width: 26px; height: 26px; border-radius: 7px; background: var(--n-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.7rem; flex-shrink: 0; }
    .ps-aa-student-name { font-weight: 600; color: var(--n-ink); }
    .ps-aa-kelas-badge { background: rgba(59, 130, 246, 0.08); color: #00287a; padding: 2px 6px; border-radius: 5px; font-size: 0.68rem; font-weight: 700; white-space: nowrap; }
    .ps-aa-btn-delete { width: 26px; height: 26px; border: none; background: #fef2f2; color: #ef4444; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 0.72rem; }
    .ps-aa-btn-delete:hover { background: #ef4444; color: white; }
    .ps-aa-cards-wrap { display: none; flex-direction: column; gap: 8px; }
    .ps-aa-card { background: var(--n-bg); border: 1px solid var(--n-border); border-radius: 10px; padding: 12px; display: flex; align-items: center; gap: 8px; transition: border-color 0.2s; }
    .ps-aa-card:hover { border-color: var(--n-primary); }
    .ps-aa-avatar { width: 34px; height: 34px; border-radius: 8px; background: var(--n-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.78rem; flex-shrink: 0; }
    .ps-aa-card-info { flex: 1; min-width: 0; }
    .ps-aa-name { font-weight: 700; color: var(--n-ink); font-size: 0.83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ps-aa-meta { display: flex; gap: 4px; align-items: center; margin-top: 2px; flex-wrap: wrap; }
    .ps-aa-kelas { background: rgba(59, 130, 246, 0.08); color: #00287a; padding: 1px 5px; border-radius: 4px; font-size: 0.62rem; font-weight: 700; }
    .ps-aa-nisn { color: var(--n-muted); font-size: 0.65rem; }
    .ps-aa-delete-btn { width: 26px; height: 26px; border: none; background: transparent; color: var(--n-muted); border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
    .ps-aa-delete-btn:hover { background: #fef2f2; color: #ef4444; }

    /* Modals */
    .gap__toast { position: fixed; top: 80px; right: 24px; z-index: 1000; padding: 10px 16px; border-radius: 9px; font-weight: 700; font-size: 0.78rem; display: flex; align-items: center; gap: 6px; animation: psSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: var(--n-shadow); }
    .gap__toast--success { background: #10b981; color: white; }
    .gap__toast--error { background: #ef4444; color: white; }
    @keyframes psSlideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .ps-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(3px); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; pointer-events: auto; }
    .ps-modal { background: var(--n-card); border-radius: 14px; width: 100%; max-width: 440px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2); overflow: hidden; animation: psModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes psModalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .ps-modal-header { padding: 15px 20px; background: var(--n-primary); color: white; display: flex; justify-content: space-between; align-items: center; }
    .ps-modal-header h3 { margin: 0; font-size: 0.85rem; font-weight: 800; display: flex; align-items: center; gap: 6px; }
    .ps-modal-close { background: rgba(255,255,255,0.15); border: none; color: white; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
    .ps-modal-close:hover { background: rgba(255,255,255,0.25); }
    .ps-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 13px; }
    .ps-modal-actions { display: flex; gap: 8px; margin-top: 3px; }
    .ps-btn-cancel { flex: 1; padding: 9px; background: var(--n-bg); color: var(--n-muted); border: 1px solid var(--n-border); border-radius: 9px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    
    /* Camera */
    .camera-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 2000; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .camera-content { position: relative; width: 90%; max-width: 520px; border-radius: 16px; overflow: hidden; background: #000; pointer-events: all; }
    .camera-video { width: 100%; display: block; border-radius: 16px; }
    .camera-controls { display: flex; justify-content: center; gap: 20px; padding: 14px; position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); pointer-events: all; }
    .cam-btn.take { background: white; color: var(--n-text); }
    .cam-btn.take:hover { transform: scale(1.1); }
    .cam-btn.close { background: #ef4444; color: white; }

    /* Crop */
    .crop-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; pointer-events: none; }
    .crop-container { background: var(--n-card); border-radius: 14px; width: 100%; max-width: 440px; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,0.4); animation: psModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; pointer-events: all; }
    .crop-header { padding: 13px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--n-border); }
    .crop-header h3 { margin: 0; font-size: 0.85rem; color: var(--n-ink); font-weight: 700; }
    .btn-close-crop { background: none; border: none; font-size: 0.95rem; cursor: pointer; color: var(--n-muted); }
    .btn-close-crop:hover { color: var(--n-ink); }
    .crop-area { position: relative; height: 280px; background: #000; }
    .crop-footer { padding: 14px; background: var(--n-bg); }
    .zoom-slider { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; color: var(--n-muted); font-size: 0.78rem; }
    .zoom-range { flex: 1; cursor: pointer; height: 4px; appearance: none; background: var(--n-border); border-radius: 2px; accent-color: var(--n-primary); }
    .crop-actions { display: flex; gap: 8px; }
    .crop-actions button { flex: 1; padding: 8px; border-radius: 8px; font-weight: 700; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-cancel { background: var(--n-bg); color: var(--n-muted); border: 1px solid var(--n-border) !important; }
    .btn-cancel:hover { background: var(--n-border); color: var(--n-ink); }
    .btn-done { background: var(--n-primary); color: white; }
    .btn-done:hover { background: var(--n-primary-light); transform: translateY(-1px); }

    /* Animations */
    .ps-spinner-white { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    .ps-loading-dots { display: inline-flex; gap: 2px; }
    .ps-loading-dots span { width: 3px; height: 3px; background: white; border-radius: 50%; animation: dotBounce 1.4s infinite; }
    .ps-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .ps-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dotBounce { 0%, 80%, 100% { opacity: 0.25; transform: scale(1); } 40% { opacity: 1; transform: scale(1.3); } }
    .animate-slideDown { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* Dark Mode - Pitch Black Theme with Blue Borders */
    :global(.dark) .premium-glass-card { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important; }
    :global(.dark) .profile-top-banner {
        background: #000000 !important;
        border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(26, 115, 232, 0.2) !important;
    }
    :global(.dark) .banner-avatar-ring {
        border-color: rgba(26, 115, 232, 0.6);
        background: rgba(26, 115, 232, 0.1);
        box-shadow: 0 0 12px rgba(26, 115, 232, 0.25);
    }
    :global(.dark) .banner-avatar { color: rgba(255, 255, 255, 0.6); }
    :global(.dark) .banner-name {
        background: linear-gradient(90deg, #1d6bf3 0%, #3b82f6 30%, #60a5fa 70%, #93c5fd 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        display: inline-block !important;
    }
    :global(.dark) .banner-tag {
        background: rgba(15, 23, 42, 0.8);
        border-color: rgba(26, 115, 232, 0.4);
        color: #93c5fd;
    }
    :global(.dark) .banner-tag:hover {
        background: rgba(26, 115, 232, 0.25);
        border-color: #3b82f6;
        color: #ffffff;
    }
    :global(.dark) .banner-tag--divisi {
        background: rgba(26, 115, 232, 0.2) !important;
        border-color: rgba(59, 130, 246, 0.6) !important;
        color: #60a5fa !important;
    }
    :global(.dark) .action-dot { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }
    :global(.dark) .action-dot:hover { background: var(--n-primary); color: white; }
    :global(.dark) .profile-nav-tabs { background: #000000 !important; border-color: rgba(26, 115, 232, 0.5) !important; }
    :global(.dark) .nav-tab { color: var(--n-muted); }
    :global(.dark) .nav-tab:hover { color: #f1f5f9; }
    :global(.dark) .nav-tab.active { color: #60a5fa; }

    :global(.dark) .profile-tab-content { background: #000000 !important; }
    :global(.dark) .ps-glass-section { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
    :global(.dark) .ps-glass-input { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #f8fafc !important; }
    :global(.dark) .ps-glass-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.25) !important; }
    :global(.dark) .ps-glass-input.highlight { background: rgba(245,158,11,0.08) !important; border-color: rgba(245,158,11,0.5) !important; }
    :global(.dark) .ps-section-head { border-color: rgba(26, 115, 232, 0.35) !important; }
    :global(.dark) .ps-section-icon { background: rgba(26, 115, 232, 0.15) !important; color: #60a5fa !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
    :global(.dark) .ps-field-group label i { color: #60a5fa !important; }
    :global(.dark) .ps-section-info h3 { color: #f1f5f9; }
    :global(.dark) .ps-section-info p { color: var(--n-muted); }
    :global(.dark) .ps-id-card { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; border-left: 4px solid #3b82f6 !important; }
    :global(.dark) .ps-id-value { color: #f1f5f9; }
    :global(.dark) .ps-rek-table th { border-color: rgba(26, 115, 232, 0.35) !important; color: var(--n-muted); }
    :global(.dark) .ps-rek-table td { border-color: rgba(26, 115, 232, 0.25) !important; color: #f1f5f9; }
    :global(.dark) .ps-rek-add-row-btn {
        background: #000000 !important;
        color: #60a5fa !important;
        border: 1.5px dashed rgba(26, 115, 232, 0.75) !important;
    }
    :global(.dark) .ps-rek-add-row-btn:hover {
        background: rgba(26, 115, 232, 0.18) !important;
        color: #ffffff !important;
        border-color: #60a5fa !important;
        border-style: solid !important;
    }
    :global(.dark) .ps-aa-stat { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.5) !important; }
    :global(.dark) .ps-aa-stat-num { color: #f1f5f9; }
    :global(.dark) .ps-aa-stat-aktif .ps-aa-stat-num { color: #d8b4fe; }
    :global(.dark) .ps-filter-select { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #f8fafc !important; }
    :global(.dark) .ps-filter-select:focus { border-color: #3b82f6 !important; }
    :global(.dark) .ps-tab-title { color: #f1f5f9; }
    :global(.dark) .ps-tab-desc { color: var(--n-muted); }
    :global(.dark) .ps-empty-state h3 { color: var(--n-muted); }
    :global(.dark) .ps-aa-table th { border-color: rgba(26, 115, 232, 0.35) !important; color: var(--n-muted); }
    :global(.dark) .ps-aa-table td { border-color: rgba(26, 115, 232, 0.25) !important; color: #f1f5f9; }
    :global(.dark) .ps-aa-table tbody tr:hover td { background: #111111 !important; }
    :global(.dark) .ps-aa-student-name { color: #f1f5f9; }
    :global(.dark) .ps-aa-td-nisn { color: var(--n-muted); }
    :global(.dark) .ps-aa-card { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
    :global(.dark) .ps-aa-card:hover { border-color: #3b82f6 !important; }
    :global(.dark) .ps-aa-name { color: #f1f5f9; }
    :global(.dark) .ps-aa-nisn { color: var(--n-muted); }
    :global(.dark) .ps-glass-footer { border-color: rgba(26, 115, 232, 0.35) !important; }
    :global(.dark) .ps-footer-note { background: rgba(26, 115, 232, 0.08) !important; border: 1px solid rgba(26, 115, 232, 0.4) !important; color: #7dd3fc !important; }
    :global(.dark) .ps-footer-note i { color: #38bdf8 !important; }
    :global(.dark) .ps-modal { background: #000000 !important; border: 1.8px solid rgba(26, 115, 232, 0.75) !important; }
    :global(.dark) .crop-footer { background: #000000 !important; }
    :global(.dark) .crop-header { border-color: rgba(26, 115, 232, 0.35) !important; }
    :global(.dark) .btn-cancel { background: #111111 !important; border: 1.5px solid rgba(26, 115, 232, 0.5) !important; color: var(--n-muted); }
    :global(.dark) .btn-cancel:hover { background: #222222 !important; color: #f1f5f9; }
    :global(.dark) .ps-editor-preview { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.5) !important; color: var(--n-muted); }
    :global(.dark) .ps-rek-card { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
    :global(.dark) .ps-rek-card-body { border-top-color: rgba(26, 115, 232, 0.25) !important; }
    :global(.dark) .ps-edu-item { background: #000000 !important; border: 1px solid rgba(37, 99, 235, 0.4) !important; }
    :global(.dark) .ps-btn-glass.upload {
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.22) 0%, rgba(3, 105, 161, 0.35) 100%) !important;
        color: #38bdf8 !important;
        border: 1.5px solid rgba(56, 189, 248, 0.6) !important;
    }
    :global(.dark) .ps-btn-glass.upload:hover {
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.38) 0%, rgba(3, 105, 161, 0.5) 100%) !important;
        color: #7dd3fc !important;
        border-color: #38bdf8 !important;
        transform: translateY(-1px);
    }
    :global(.dark) .ps-btn-glass.camera {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.22) 0%, rgba(29, 78, 216, 0.35) 100%) !important;
        color: #60a5fa !important;
        border: 1.5px solid rgba(96, 165, 250, 0.6) !important;
    }
    :global(.dark) .ps-btn-glass.camera:hover {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.38) 0%, rgba(29, 78, 216, 0.5) 100%) !important;
        color: #93c5fd !important;
        border-color: #60a5fa !important;
        transform: translateY(-1px);
    }
    :global(.dark) .ps-ekskul-select > div { background: #000000 !important; }
    :global(.dark) .ps-edu-select, :global(.dark) .ps-edu-input { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #f8fafc !important; }
    :global(.dark) .ps-edu-remove { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.2); }
    :global(.dark) .ps-edu-remove:hover { background: #ef4444; color: white; }
    :global(.dark) .ps-eye-btn { color: var(--n-muted); }
    :global(.dark) .ps-gen-toggler { background: rgba(26, 115, 232, 0.05); border: 1.5px solid rgba(26, 115, 232, 0.4); color: #60a5fa; }
    :global(.dark) .ps-gen-toggler.active { background: rgba(26, 115, 232, 0.12); border-color: #3b82f6; }
    :global(.dark) .ps-gen-glass-panel { background: rgba(26, 115, 232, 0.05); border: 1px solid rgba(37, 99, 235, 0.4); }
    :global(.dark) .ps-gen-desc { color: #60a5fa; }
    :global(.dark) .ps-gen-display { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.6) !important; color: #60a5fa !important; }
    :global(.dark) .ps-gen-refresh { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.5) !important; color: var(--n-muted); }
    :global(.dark) .ps-gen-refresh:hover { background: #111111 !important; color: #60a5fa; }
    :global(.dark) .ps-modal-overlay { background: rgba(0,0,0,0.85); }
    :global(.dark) .camera-modal { background: rgba(0,0,0,0.88); }
    :global(.dark) .crop-overlay { background: rgba(0,0,0,0.90); }
    :global(.dark) .ps-identity-bar { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.4) !important; }
    :global(.dark) .pib-avatar-ring { background: #000000 !important; border-color: rgba(26, 115, 232, 0.5) !important; }
    :global(.dark) .pib-name { color: #f1f5f9 !important; }
    :global(.dark) .pib-badge.more { background: rgba(255, 255, 255, 0.1) !important; color: #94a3b8 !important; }
    :global(.dark) .pib-sep { color: rgba(255, 255, 255, 0.2) !important; }
    :global(.dark) .ps-kepegawaian-summary { background: #000000 !important; border: 1.5px solid rgba(26, 115, 232, 0.4) !important; }
    :global(.dark) .ps-ks-divider { background: rgba(26, 115, 232, 0.25) !important; }
    :global(.dark) .ps-ks-val { color: #f1f5f9 !important; }

    /* Responsive */
    @media (max-width: 900px) {
        .ps-glass-grid, .ps-form-columns, .ps-identity-grid { display: flex !important; flex-direction: column !important; gap: 14px !important; width: 100% !important; min-width: 0 !important; }
        .ps-glass-footer { flex-direction: column; }
        .ps-footer-note { max-width: 100%; }
        .ps-btn-submit-premium { width: 100%; justify-content: center; }
        .profile-tab-content, .ps-tab-content { padding: 18px 16px; }
        .ps-aa-filters { flex-direction: column; }
        .ps-filter-select, .ps-aa-filters .ps-filter-select { width: 100%; min-width: unset; }
        .ps-aa-stats { flex-direction: row; }
        .ps-tab-header { flex-direction: column; align-items: flex-start; }
        .ps-tab-header .ps-btn-primary { width: 100%; justify-content: center; }
        .ps-aa-table-wrap { display: none; }
        .ps-aa-cards-wrap { display: flex; }
    }
    @media (max-width: 640px) {
        .profile-container { padding: 0 0 24px; overflow-x: hidden; width: 100%; max-width: 100%; }
        .premium-glass-card {
            border-radius: 14px;
            width: 100%;
            max-width: 100%;
        }
        .ps-identity-bar {
            padding: 10px 12px;
            gap: 10px;
        }
        .ps-kepegawaian-summary {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 12px 14px;
        }
        .ps-ks-divider {
            width: 100%;
            height: 1px;
        }
        .ps-ks-item {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
        }
        .ps-ks-val {
            text-align: right;
            font-size: 0.88rem;
        }
        .pib-avatar-group {
            gap: 12px;
            width: 100%;
        }
        .pib-avatar-ring {
            width: 52px;
            height: 52px;
            border-radius: 14px;
        }
        .pib-name {
            font-size: 1.05rem;
        }
        .pib-meta {
            gap: 8px;
            font-size: 0.72rem;
        }
        .profile-tab-content, .ps-tab-content {
            padding: 14px 10px;
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
        }
        .ps-glass-section {
            padding: 14px 12px;
            border-radius: 12px;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }
        .ps-glass-grid, .ps-identity-grid, .ps-form-columns {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
        }
        .ps-field-group { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
        .ps-glass-input { width: 100% !important; max-width: 100% !important; font-size: 0.8rem; padding: 8px 10px; box-sizing: border-box !important; }
        .ps-id-card { width: 100% !important; max-width: 100% !important; padding: 10px 12px; box-sizing: border-box !important; }
        .ps-id-value { font-size: 0.8rem; word-break: break-word; overflow-wrap: anywhere; }
        .ps-rek-desktop-table { display: none !important; }
        .ps-rek-mobile-cards { display: flex !important; flex-direction: column !important; gap: 12px !important; width: 100% !important; }
        .ps-rek-card { background: var(--n-card) !important; border: 1px solid var(--n-border) !important; border-radius: 12px !important; padding: 14px !important; }
        .ps-edu-item { display: flex !important; flex-direction: column !important; gap: 8px !important; padding: 12px !important; width: 100% !important; box-sizing: border-box !important; }
        .ps-edu-item-top { display: flex !important; align-items: center !important; justify-content: space-between !important; width: 100% !important; gap: 8px !important; }
        .ps-edu-select { flex: 1 !important; width: 100% !important; height: 38px !important; }
        .ps-edu-input { width: 100% !important; height: 38px !important; }
        .gaf__actions { flex-direction: column; }
        .gaf__btnCancel, .gaf__btnSave { width: 100%; justify-content: center; }
        .ps-modal-actions { flex-direction: column; }
        .ps-btn-cancel { width: 100%; justify-content: center; }
    }
`}</style>
        </div>
    )
}

// ─── React-Select Styles ─────────────────────────────────────────────────────

const selectStylesReact = {
    control: (base: any) => ({ ...base, borderRadius: '9px', border: '1.5px solid var(--n-border)', boxShadow: 'none', '&:hover': { borderColor: 'var(--n-primary)' }, '&:focus': { borderColor: 'var(--n-primary)', boxShadow: '0 0 0 3px rgba(0,56,168,0.1)' }, padding: '2px 4px', fontSize: '0.83rem', fontWeight: 600, backgroundColor: 'var(--n-bg)', color: 'var(--n-ink)', minHeight: '40px' }),
    placeholder: (base: any) => ({ ...base, color: 'var(--n-muted)' }),
    singleValue: (base: any) => ({ ...base, color: 'var(--n-ink)', fontWeight: 600 }),
    input: (base: any) => ({ ...base, color: 'var(--n-ink)' }),
    option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected ? 'var(--n-primary)' : state.isFocused ? 'var(--n-bg)' : 'transparent',
        color: state.isSelected ? 'white' : 'var(--n-ink)',
        fontSize: '0.83rem',
        fontWeight: state.isSelected ? 700 : 500,
        cursor: 'pointer',
        padding: '9px 12px',
        borderBottom: '1px solid var(--n-border)',
        '&:last-child': { borderBottom: 'none' }
    }),
    menu: (base: any) => ({ ...base, zIndex: 9999, backgroundColor: 'var(--n-card)', border: '1px solid var(--n-border)', borderRadius: '9px', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', marginTop: '6px', maxHeight: '320px', overflowY: 'auto' }),
    menuList: (base: any) => ({ ...base, maxHeight: '320px', padding: '6px' }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    noOptionsMessage: (base: any) => ({ ...base, color: 'var(--n-muted)', fontSize: '0.8rem' }),
    dropdownIndicator: (base: any) => ({ ...base, color: 'var(--n-muted)', '&:hover': { color: 'var(--n-primary)' } }),
    indicatorSeparator: (base: any) => ({ ...base, backgroundColor: 'var(--n-border)' }),
}
