'use client'
import Pagination from '@/components/ui/Pagination';

import { useState, useEffect, useMemo, useRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import type { User } from '@/lib/types'
import { parseRoles } from '@/lib/auth'
import * as XLSX from 'xlsx-js-style'
import Swal from 'sweetalert2'
import { useModalBlur } from '@/components/ModalBlurProvider'
import UserModal from '../components/UserModal'
import { FilterToolbar, FilterSearch, FilterSelect, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { MobileList, MobileListItem, MobileFab } from '@/components/mobile'
import { MobileSheet, MobileKV } from '@/components/mobile/MobileSheet'
import { MobileAvatar } from '@/components/mobile/MobileList'
import { getProxiedImageUrl } from '@/lib/image-utils'

function getInitials(name?: string | null) {
    const str = String(name || '').trim()
    if (!str) return 'U'
    return str.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function getAvatarColor(name?: string | null) {
    const colors = [
        ['#dbeafe', '#1d4ed8'], ['#fce7f3', '#be185d'], ['#d1fae5', '#065f46'],
        ['#fef3c7', '#92400e'], ['#eff6ff', '#00287a'], ['#ffedd5', '#9a3412'],
        ['#cffafe', '#0e7490'], ['#eff6ff', '#1e40af'], ['#fee2e2', '#991b1b'],
        ['#ecfdf5', '#065f46']
    ]
    const str = String(name || 'User')
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
}

function getRoleBadgeColor(role: string) {
    const r = (role || '').toUpperCase()
    if (r === 'ADMIN') return { bg: '#eff6ff', fg: '#00287a', border: 'rgba(124,58,237,0.2)' }
    if (r === 'GURU') return { bg: '#dbeafe', fg: '#1d4ed8', border: 'rgba(29,78,216,0.2)' }
    if (r.includes('WALI')) return { bg: '#fef3c7', fg: '#92400e', border: 'rgba(146,64,14,0.2)' }
    if (r.includes('KAMAD')) return { bg: '#d1fae5', fg: '#065f46', border: 'rgba(6,95,70,0.2)' }
    return { bg: '#f1f5f9', fg: '#475569', border: 'rgba(71,85,105,0.2)' }
}

/**
 * Pesan galat dari server, apa pun bentuknya.
 *
 * Rute proxy meneruskan body NestJS apa adanya, dan NestJS menaruh penjelasannya
 * di `message` — `error` hanya berisi nama status ("Bad Request", "Forbidden").
 * Membaca `error` saja karena itu membuang justru bagian yang berguna: penolakan
 * seperti "Ini satu-satunya akun Admin yang aktif..." tampil sebagai
 * "Bad Request", dan admin tidak tahu apa yang salah.
 */
/**
 * Nilai dari berkas impor ikut ditampilkan di dialog `html`, jadi harus dilolosi
 * lebih dulu — isi sel spreadsheet adalah masukan yang tidak dipercaya.
 */
function escapeHtml(v: unknown): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function pesanGalat(
    d: { message?: string; error?: string } | null | undefined,
    bawaan = 'Terjadi kesalahan',
): string {
    return d?.message || d?.error || bawaan;
}

export default function UserDataTab({ user }: { user?: User }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toggling, setToggling] = useState<string | number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const [showResetSheet, setShowResetSheet] = useState(false)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mobile detail sheet + action menu
  const [sheetUser, setSheetUser] = useState<User | null>(null)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // Modal states
  const [deleteItemId, setDeleteItemId] = useState<string | number | null>(null)
  const [deleteItemData, setDeleteItemData] = useState<User | null>(null)
  const [resetItem, setResetItem] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  const { registerModal } = useModalBlur()

  // Click-outside handler for the three-dot action menu
  useEffect(() => {
    if (!showActionMenu) return
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showActionMenu])

  /**
   * ADMIN / ADMINISTRATOR, dicocokkan per ELEMEN daftar role.
   *
   * Sebelumnya cabang kedua memakai `user.role.toUpperCase().includes('ADMIN')` —
   * pencocokan SUBSTRING, sehingga role seperti `ADMINISTRASI` atau `OP_ADMIN`
   * melihat seluruh tombol lalu ditolak server saat mengkliknya. Cabang pertama
   * pun hanya mengenali `ADMIN`, tidak `ADMINISTRATOR`, padahal backend
   * menyetarakan keduanya.
   *
   * Server tetap yang menentukan (`assertCanManageUsers`); ini hanya menyamakan
   * tampilan dengan wewenang yang sebenarnya.
   */
  const isAdmin = useMemo(() => {
    if (!user) return false
    const daftar = Array.isArray(user.roles)
      ? user.roles.map((r: string) => String(r).trim().toUpperCase())
      : parseRoles(String(user.role || ''))
    return daftar.some((r: string) => r === 'ADMIN' || r === 'ADMINISTRATOR')
  }, [user])

  const canAdd = isAdmin;
  const canEdit = isAdmin;
  const canStatus = isAdmin;
  const canImport = isAdmin;
  const canExport = isAdmin;

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.ok) setUsers(data.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const availableRoles = useMemo(() => {
    const roles = new Set<string>()
    users.forEach(u => {
      const uRole = (u.role || 'GURU').toUpperCase()
      uRole.split(/[,|]/).forEach(r => {
        const trimmed = r.trim()
        if (trimmed) roles.add(trimmed)
      })
    })
    return Array.from(roles).sort()
  }, [users])

  const filteredUsers = useMemo(() => {
    let filtered = users
    if (filter === 'active') filtered = filtered.filter(u => u.aktif)
    else if (filter === 'inactive') filtered = filtered.filter(u => !u.aktif)
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => {
        const uRoles = (u.role || 'GURU').toUpperCase().split(/[,|]/).map(r => r.trim()).filter(Boolean)
        return uRoles.includes(roleFilter)
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        (u.nama && u.nama.toLowerCase().includes(q)) ||
        (u.nama_lengkap && u.nama_lengkap.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.nip && u.nip.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [users, filter, roleFilter, searchQuery])

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filter, roleFilter, searchQuery, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.aktif).length,
    inactive: users.filter(u => !u.aktif).length
  }), [users])

  const groupedUsers = useMemo(() => {
    const groups: Record<string, User[]> = {}
    filteredUsers.forEach(u => {
      const key = u.role || 'GURU'
      if (!groups[key]) groups[key] = []
      groups[key].push(u)
    })
    return groups
  }, [filteredUsers])

  const selectedCount = selectedIds.size
  const allDisplayedSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.id))

  const toggleSelect = (id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)))
    }
  }

  // Blur trigger for modals
  useEffect(() => {
    if (deleteItemId !== null || resetItem !== null || isAdding || editingUser !== null || sheetUser !== null) return registerModal()
  }, [deleteItemId, resetItem, isAdding, editingUser, sheetUser, registerModal])

  const handleAdd = () => { setIsAdding(true); setEditingUser(null) }
  const handleEdit = (u: User) => { setEditingUser(u); setIsAdding(false) }
  const handleCancel = () => { setEditingUser(null); setIsAdding(false) }

  const handleExport = async () => {
    const totalUsers = filteredUsers.length
    const hasActiveFilter = filter !== 'all' || roleFilter !== 'all' || searchQuery.trim() !== ''

    // If there are selected users, ask what to export
    if (selectedCount > 0) {
      const { value } = await Swal.fire({
        title: 'Pilih Data Export',
        text: `${selectedCount} user terpilih dari total ${totalUsers} user${hasActiveFilter ? ' (terfilter)' : ''}.`,
        icon: 'question',
        input: 'radio',
        inputOptions: {
          all: `${hasActiveFilter ? 'Semua Terfilter' : 'Semua User'} (${totalUsers})`,
          selected: `User Terpilih (${selectedCount})`,
        },
        inputValue: 'selected',
        showCancelButton: true,
        cancelButtonText: 'Batal',
        confirmButtonText: 'Export',
        confirmButtonColor: '#1d4ed8',
      }) as any

      if (!value) return

      if (value === 'all') {
        // fall through to export filtered below
      } else {
        // export selected only
        await doExport(users.filter(u => selectedIds.has(u.id)))
        return
      }
    }

    // Export filtered users
    await doExport(filteredUsers)
  }

  const doExport = async (rows: User[]) => {
    const sorted = [...rows].sort((a, b) => {
      const roleA = (a.role || 'GURU').toUpperCase()
      const roleB = (b.role || 'GURU').toUpperCase()
      if (roleA < roleB) return -1
      if (roleA > roleB) return 1
      return (a.nama || '').localeCompare(b.nama || '', 'id')
    })

    const allRows = sorted.map((u, i) => ({
      'No': i + 1,
      'Username': u.username,
      'NIP': u.nip || '-',
      'Nama': u.nama,
      'Divisi': u.divisi || '-',
      'Role': u.role || 'GURU',
      'Email': u.email || '-',
      'Status': u.aktif ? 'Aktif' : 'Nonaktif',
      // `auth_id` DIKELUARKAN dari ekspor. Ia pengenal internal yang menautkan ke
      // tabel kredensial `auth_users`, tidak ditampilkan di layar mana pun, dan
      // tidak ada gunanya bagi penerima berkas — sementara berkas ini beredar lewat
      // WhatsApp dan email.
    }))

    const ws = XLSX.utils.json_to_sheet(allRows)
    const keys = allRows.length > 0 ? Object.keys(allRows[0]) : []
    ws['!cols'] = keys.map((key) => {
      let maxLen = key.length
      allRows.forEach(row => {
        const val = String((row as any)[key] || '')
        if (val.length > maxLen) maxLen = val.length
      })
      return { wch: Math.min(maxLen + 4, 35) }
    })

    ws['!rows'] = [{ hpt: 32 }]
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:H1')
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[addr]) continue
        const isHeader = R === 0
        const style: any = {
          font: { name: 'Arial', sz: 10 },
          alignment: { vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } },
          },
        }
        if (isHeader) {
          style.font = { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }
          style.fill = { fgColor: { rgb: '1E3A8A' } }
          style.alignment = { horizontal: 'center', vertical: 'center' }
        } else {
          if (C === 0) style.alignment.horizontal = 'center'
        }
        ws[addr].s = style
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    const roleLabel = roleFilter !== 'all' ? `_${roleFilter}` : ''
    XLSX.writeFile(wb, `Data_Users${roleLabel}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
        const usersToImport = data.map(row => {
          const rawAktif = row['aktif'] ?? row['Aktif'] ?? row['status'] ?? row['Status'];
          let isAktif = true;
          if (rawAktif !== undefined && rawAktif !== null && String(rawAktif).trim() !== '') {
            const strAktif = String(rawAktif).trim().toUpperCase();
            if (['N', 'FALSE', 'TIDAK', '0', 'INACTIVE', 'NONAKTIF', 'NON AKTIF'].includes(strAktif)) {
              isAktif = false;
            } else {
              isAktif = ['Y', 'TRUE', 'YA', '1', 'ACTIVE', 'AKTIF'].includes(strAktif);
            }
          }
          const rawNip = String(row['nip'] || row['NIP'] || '').trim();
          const cleanNip = rawNip === '-' ? '' : rawNip;
          const rawDivisi = String(row['divisi'] || row['Divisi'] || '').trim();
          const cleanDivisi = rawDivisi === '-' ? '' : rawDivisi;
          const rawEmail = String(row['email'] || row['Email'] || '').trim();
          const cleanEmail = rawEmail === '-' ? '' : rawEmail;

          return {
            username: String(row['username'] || row['Username'] || '').trim(),
            nip: cleanNip,
            nama: String(row['nama'] || row['Nama'] || row['Nama Lengkap'] || '').trim(),
            divisi: cleanDivisi,
            email: cleanEmail,
            role: String(row['role'] || row['Role'] || 'GURU').trim(),
            aktif: isAktif,
            password: String(row['password'] || row['Password'] || '').trim(),
          }
        }).filter(u => u.username && u.nama)

        if (usersToImport.length === 0) {
          Swal.fire('Error', 'Tidak ada data valid', 'error')
          return
        }

        const res = await fetch('/api/admin/users/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: usersToImport })
        })
        const resData = await res.json()
        if (resData.ok) {
          // Baris yang DITOLAK harus disebut satu per satu, bukan hanya jumlahnya.
          // Penolakan paling sering terjadi karena role di berkas tidak ada di
          // tabel `roles` (mis. salah ketik "GURUU"), dan tanpa daftar ini
          // pengimpor tidak tahu baris mana yang harus dibetulkan.
          const ditolak: Array<{ username: string; error: string }> = resData.failedUsers || []
          if (ditolak.length > 0) {
            const baris = ditolak
              .slice(0, 15)
              .map(d => `<li><b>${escapeHtml(d.username)}</b> — ${escapeHtml(d.error)}</li>`)
              .join('')
            const sisa = ditolak.length > 15
              ? `<p style="margin-top:8px">…dan ${ditolak.length - 15} baris lain.</p>`
              : ''
            Swal.fire({
              icon: 'warning',
              title: 'Sebagian baris ditolak',
              html: `<p style="text-align:left">${escapeHtml(resData.message || '')}</p>`
                + `<ul style="text-align:left;margin:8px 0 0;padding-left:20px">${baris}</ul>${sisa}`
                + `<p style="text-align:left;margin-top:10px;font-size:0.85em;color:#64748b">`
                + `Role harus sudah terdaftar di tab <b>Daftar Role</b>. Betulkan berkasnya lalu impor ulang —`
                + ` baris yang berhasil tidak akan terduplikasi karena impor memakai username sebagai kunci.</p>`,
              width: 620,
            })
          } else {
            Swal.fire('Berhasil', resData.message, 'success')
          }
          fetchUsers()
        } else {
          Swal.fire('Gagal', pesanGalat(resData, 'Gagal mengimpor pengguna'), 'error')
        }
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error')
      } finally {
        setImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleResetPassword = (u: User) => {
    setResetItem(u)
    setShowResetSheet(true)
  }

  const confirmResetPassword = async () => {
    if (!resetItem) return
    setResetting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: resetItem.id })
      })
      const data = await res.json()
      setShowResetSheet(false)
      if (data.ok) {
        // Password sementara kini ACAK per akun, jadi nilainya harus dibaca dari
        // respons — bukan ditulis tetap di layar. Ini satu-satunya kesempatan
        // melihatnya: yang tersimpan di basis data hanyalah hash-nya.
        const pw = escapeHtml(data.password || '')
        Swal.fire({
          icon: 'success',
          title: 'Password direset',
          html: `<p style="text-align:left">Password sementara untuk <b>${escapeHtml(resetItem.username)}</b>:</p>`
            + `<p style="margin:10px 0"><code style="background:#f1f5f9;padding:8px 14px;border-radius:6px;font-size:1.15em;letter-spacing:0.5px">${pw}</code></p>`
            + `<p style="text-align:left;font-size:0.85em;color:#64748b">`
            + `Catat dan sampaikan sekarang — nilai ini tidak bisa dilihat lagi.`
            + `${data.harusGanti ? ' Pemiliknya akan diminta menggantinya saat login berikutnya.' : ''}</p>`,
          width: 520,
        })
        setResetItem(null)
      } else {
        setResetItem(null)
        Swal.fire('Gagal', pesanGalat(data), 'error')
      }
    } catch {
      setShowResetSheet(false)
      setResetItem(null)
      Swal.fire('Error', 'Koneksi gagal', 'error')
    } finally {
      setResetting(false)
    }
  }

  const handleToggleStatus = async (u: User) => {
    if (String(u.id) === String(user?.id)) {
      Swal.fire({
        icon: 'warning',
        title: 'Perhatian',
        text: 'Anda tidak dapat menonaktifkan akun sendiri.',
        timer: 2000,
        showConfirmButton: false,
      })
      return
    }

    const newStatus = !u.aktif
    
    // Optimistic UI update for both table and mobile sheet
    setUsers(prev => prev.map(item => item.id === u.id ? { ...item, aktif: newStatus } : item))
    setSheetUser(prev => prev && prev.id === u.id ? { ...prev, aktif: newStatus } : prev)
    setToggling(u.id)
    
    try {
      const res = await fetch(`/api/admin/users/${u.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: newStatus })
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({ type: 'success', text: `${u.nama_lengkap || u.nama} sekarang ${newStatus ? 'Aktif' : 'Nonaktif'}` })
      } else {
        // Revert on error
        setUsers(prev => prev.map(item => item.id === u.id ? { ...item, aktif: !newStatus } : item))
        setSheetUser(prev => prev && prev.id === u.id ? { ...prev, aktif: !newStatus } : prev)
        setMessage({ type: 'error', text: pesanGalat(data) })
      }
    } catch {
      // Revert on error
      setUsers(prev => prev.map(item => item.id === u.id ? { ...item, aktif: !newStatus } : item))
      setSheetUser(prev => prev && prev.id === u.id ? { ...prev, aktif: !newStatus } : prev)
      setMessage({ type: 'error', text: 'Koneksi gagal' })
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = (u: User) => {
    setDeleteItemId(u.id)
    setDeleteItemData(u)
    setShowDeleteSheet(true)
  }

  const confirmDelete = async () => {
    if (!deleteItemId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteItemId}`, { method: 'DELETE' })
      const data = await res.json()
      setShowDeleteSheet(false)
      setDeleteItemId(null)
      setDeleteItemData(null)
      if (data.ok) {
        Swal.fire({ icon: 'success', title: 'Terhapus!', text: data.message, timer: 1500, showConfirmButton: false })
        fetchUsers()
      } else {
        Swal.fire('Gagal', pesanGalat(data), 'error')
      }
    } catch {
      setShowDeleteSheet(false)
      setDeleteItemId(null)
      setDeleteItemData(null)
      Swal.fire('Error', 'Koneksi gagal', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="udt-root">
      {/* Stats */}
      <div className="udt-stats">
        <div className="udt-stat">
          <div className="udt-stat__icon udt-stat__icon--gray"><i className="bi bi-people-fill"></i></div>
          <div className="udt-stat__body">
            <div className="udt-stat__value">{stats.total}</div>
            <div className="udt-stat__label">Total User</div>
          </div>
        </div>
        <div className="udt-stat">
          <div className="udt-stat__icon udt-stat__icon--green"><i className="bi bi-check-circle-fill"></i></div>
          <div className="udt-stat__body">
            <div className="udt-stat__value">{stats.active}</div>
            <div className="udt-stat__label">Aktif</div>
          </div>
        </div>
        <div className="udt-stat">
          <div className="udt-stat__icon udt-stat__icon--red"><i className="bi bi-x-circle-fill"></i></div>
          <div className="udt-stat__body">
            <div className="udt-stat__value">{stats.inactive}</div>
            <div className="udt-stat__label">Nonaktif</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <FilterToolbar actionsInline>
        <FilterSelect
          label="Status"
          value={filter}
          onChange={val => setFilter(val as any)}
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </FilterSelect>
        <FilterSelect
          label="Role"
          value={roleFilter}
          onChange={val => setRoleFilter(val)}
        >
          <option value="all">Semua Role</option>
          {availableRoles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </FilterSelect>
        <FilterSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama, username, NIP..."
        />
        <FilterActions>
          {/* Mobile: three-dot menu for Export/Import */}
          {(canExport || canImport) && (
            <div className="sk__menuWrap" ref={actionMenuRef}>
              <button
                type="button"
                className={`sk__btnActionMenu ftb-btn--iconOnlyMobile ${showActionMenu ? 'isOpen' : ''}`}
                onClick={() => setShowActionMenu(v => !v)}
                title="Lainnya"
                aria-label="Lainnya"
                aria-haspopup="menu"
                aria-expanded={showActionMenu}
              >
                <i className="bi bi-three-dots" />
                <span className="ftb-btn-label">Aksi</span>
              </button>
              {showActionMenu && (
                <div className="sk__menu" role="menu">
                  {canExport && (
                    <button type="button" role="menuitem" className="sk__menuItem sk__menuItemMobileOnly" onClick={() => { setShowActionMenu(false); handleExport() }}>
                      <span className="sk__menuIcon"><i className="bi bi-download" style={{ color: '#10b981' }} /></span>
                      <span className="sk__menuLabel">Export Excel</span>
                    </button>
                  )}
                  {canImport && (
                    <button type="button" role="menuitem" className="sk__menuItem sk__menuItemMobileOnly" onClick={() => { setShowActionMenu(false); fileInputRef.current?.click() }}>
                      <span className="sk__menuIcon"><i className="bi bi-file-earmark-excel-fill" style={{ color: '#f97316' }} /></span>
                      <span className="sk__menuLabel">Import Excel</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Desktop: buttons as-is (hidden on mobile by CSS) */}
          {isAdmin && (
            <Button variant="primary" icon="add" onClick={handleAdd} className="sk__btnDesktopOnly">
              Tambah
            </Button>
          )}
          <Button variant="outline" icon="export" onClick={handleExport} disabled={!canExport} className="sk__btnDesktopOnly">
            Export
          </Button>
          <Button variant="outline" icon="import" onClick={() => fileInputRef.current?.click()} disabled={importing || !canImport} isLoading={importing} className="sk__btnDesktopOnly">
            {importing ? 'Memproses...' : 'Import'}
          </Button>
        </FilterActions>
      </FilterToolbar>
      {/* Di luar FilterActions: input tersembunyi tetap terhitung sebagai anak
          saat toolbar menentukan jumlah kolom tombol di mobile. */}
      <input type="file" ref={fileInputRef} hidden accept=".xlsx,.xls,.csv" onChange={handleFileChange} />

      {/* Toast */}
      {message && (
        <div className={`udt-toast ${message.type === 'success' ? 'udt-toast--success' : 'udt-toast--error'}`}>
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`}></i>
          {message.text}
        </div>
      )}

      {/* Content */}
      <div className="udt-content">
        {loading ? (
          <div className="udt-empty">
            <Spinner variant="trace" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="udt-empty">
            <div className="udt-empty__icon"><i className="bi bi-people"></i></div>
            <div className="udt-empty__title">Tidak ada data</div>
            <div className="udt-empty__sub">
              {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Belum ada user yang terdaftar.'}
            </div>
            {canAdd && !searchQuery && (
              <button className="udt-btn udt-btn--primary" onClick={handleAdd}>
                <i className="bi bi-plus-circle-fill"></i><span>Tambah User</span>
              </button>
            )}
          </div>
        ) : !isMobile ? (
          /* ===== TABLE VIEW (Desktop default) ===== */
          <div className="udt-table-card">
            <div className="udt-table-wrap">
              <table className="udt-table">
                <thead>
                  <tr>
                    <th className="udt-th--no">
                      <button
                        type="button"
                        className={`udt-no-box udt-no-box--all ${allDisplayedSelected ? 'is-checked' : ''}`}
                        onClick={toggleSelectAll}
                        title={allDisplayedSelected ? 'Batalkan pilih semua' : 'Pilih semua'}
                      >
                        <i className="bi bi-check-all"></i>
                        {allDisplayedSelected && (
                          <span className="udt-no-box__tick"><i className="bi bi-check"></i></span>
                        )}
                      </button>
                    </th>
                    <th>User</th>
                    <th>Username</th>
                    <th className="udt-th--role">Role</th>
                    <th>Status</th>
                    {canEdit && <th className="udt-th--actions">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u, idx) => {
                    const isSelf = String(u.id) === String(user?.id)
                    const [ab, af] = getAvatarColor(u.nama_lengkap || u.nama)
                    const roleColors = getRoleBadgeColor(u.role || 'GURU')
                    return (
                      <tr key={u.id} className={`${!u.aktif ? 'is-inactive' : ''}`}>
                        <td className="udt-td--no">
                          <button
                            type="button"
                            className={`udt-no-box ${selectedIds.has(u.id) ? 'is-checked' : ''}`}
                            onClick={() => toggleSelect(u.id)}
                            title={selectedIds.has(u.id) ? 'Batalkan pilih' : 'Pilih'}
                          >
                            {((page - 1) * pageSize) + idx + 1}
                            {selectedIds.has(u.id) && (
                              <span className="udt-no-box__tick"><i className="bi bi-check"></i></span>
                            )}
                          </button>
                        </td>
                        <td>
                          <div className="udt-user-cell">
                            <div className="udt-user-info">
                              <div className="udt-user-name">{u.nama_lengkap || u.nama}</div>
                              <div className="udt-user-meta">
                                {u.nip && <span className="udt-nip">NIP/NISN: {u.nip}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="udt-mono" style={{ fontSize: '0.85rem' }}>@{u.username}</span>
                        </td>
                        <td className="udt-td--role">
                          <div className="udt-role-badges">
                            {(u.role || 'GURU').split(/[,|]/).map(r => r.trim()).filter(Boolean).map(r => {
                              const rc = getRoleBadgeColor(r)
                              return (
                                <span key={r} className="udt-role-badge" style={{ background: rc.bg, color: rc.fg, borderColor: rc.border }}>
                                  <i className="bi bi-shield-fill"></i>{r}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td>
                          <label 
                            className={`udt-status-toggle ${toggling !== null && String(toggling) === String(u.id) || !isAdmin || isSelf ? 'is-disabled' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              if (isSelf) {
                                Swal.fire({
                                  icon: 'warning',
                                  title: 'Perhatian',
                                  text: 'Anda tidak dapat menonaktifkan akun sendiri.',
                                  timer: 2000,
                                  showConfirmButton: false,
                                });
                                return;
                              }
                              if (isAdmin && (toggling === null || String(toggling) !== String(u.id))) handleToggleStatus(u);
                            }}
                            title={isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : undefined}
                          >
                            <input
                              type="checkbox"
                              style={{ display: 'none' }}
                              checked={u.aktif}
                              readOnly
                              disabled={(toggling !== null && String(toggling) === String(u.id)) || !isAdmin || isSelf}
                            />
                            <div className="udt-status-toggle__switch"></div>
                            <span className="udt-status-toggle__label">
                              {toggling !== null && String(toggling) === String(u.id) ? '...' : (u.aktif ? 'Aktif' : 'Nonaktif')}
                            </span>
                          </label>
                        </td>
                        {isAdmin && (
                          <td className="udt-td--actions">
                            <ActionGroup>
                              <ActionButton
                                action="edit"
                                onClick={() => handleEdit(u)}
                              />
                              <button
                                className="udt-iconBtn udt-iconBtn--key"
                                onClick={() => handleResetPassword(u)}
                                title="Reset Password"
                                style={{
                                  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--n-border)',
                                  background: 'var(--n-surface)', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                }}
                              >
                                <i className="bi bi-key-fill"></i>
                              </button>
                              {!isSelf && (
                                <ActionButton
                                  action="delete"
                                  onClick={() => handleDelete(u)}
                                />
                              )}
                            </ActionGroup>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              limit={pageSize}
              totalItems={filteredUsers.length}
              onPageChange={setPage}
              onLimitChange={setPageSize}
              itemLabel="pengguna"
            />
          </div>
        ) : (
          /* ===== LIST VIEW (Mobile) ===== */
          <>
            <MobileList label="Daftar pengguna">
              {paginatedUsers.map(u => {
                const roleLabel = (u.role || 'GURU').split(/[,|]/).map(r => r.trim()).filter(Boolean).join(' · ')
                return (
                  <MobileListItem
                    key={u.id}
                    title={u.nama_lengkap || u.nama}
                    seed={u.username || u.nama}
                    avatarSrc={u.photoUrl ? getProxiedImageUrl(u.photoUrl) : undefined}
                    icon="person-fill"
                    subtitle={<>@{u.username}{u.nip ? ` · ${u.nip}` : ''} · {roleLabel}</>}
                    badge={!u.aktif ? <span className="mui-badge isDanger">Nonaktif</span> : undefined}
                    onClick={() => setSheetUser(u)}
                  />
                )
              })}
            </MobileList>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              limit={pageSize}
              totalItems={filteredUsers.length}
              onPageChange={setPage}
              onLimitChange={setPageSize}
              itemLabel="pengguna"
            />
          </>
        )}
      </div>

      {/* Result info */}
      {!loading && filteredUsers.length > 0 && (
        <div className="udt-result">
          <i className="bi bi-check-circle-fill"></i>
          Menampilkan <strong>{filteredUsers.length}</strong> dari <strong>{users.length}</strong> user
          {selectedCount > 0 && <span style={{ marginLeft: 8, color: '#1d4ed8', fontWeight: 600 }}>({selectedCount} dipilih)</span>}
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetSheet && resetItem && (
        <Modal size="sm" onClose={() => { setShowResetSheet(false); setResetItem(null); }} labelledBy="modal-reset-title">
          <ModalHeader
            id="modal-reset-title"
            title="Reset Password?"
            subtitle="Password akan direset ke default."
            icon="key-fill"
            onClose={() => { setShowResetSheet(false); setResetItem(null); }}
          />
          <ModalBody>
            <div className="udt-sheet__preview">
              <div className="udt-preview-avatar" style={{ background: getAvatarColor(resetItem.nama_lengkap || resetItem.nama)[0], color: getAvatarColor(resetItem.nama_lengkap || resetItem.nama)[1] }}>
                {getInitials(resetItem.nama_lengkap || resetItem.nama)}
              </div>
              <div className="udt-preview-info">
                <div className="udt-preview-name">{resetItem.nama_lengkap || resetItem.nama}</div>
                <div className="udt-preview-meta">
                  <span className="udt-preview-badge" style={getRoleBadgeColor(resetItem.role || 'GURU')}>@{resetItem.username}</span>
                  {resetItem.nip && <span>{resetItem.nip}</span>}
                </div>
              </div>
            </div>
            {/* Nilainya TIDAK bisa ditulis di sini: password sementara kini acak per
                akun dan baru diketahui setelah server membuatnya. Menyebut 'acca123'
                seperti sebelumnya berarti menjanjikan nilai yang tidak akan terjadi. */}
            <div className="udt-sheet__pwbox" style={{ marginTop: 12 }}>
              Password sementara yang acak akan dibuat dan ditampilkan setelah ini.
              Catat dan sampaikan kepada pemiliknya — nilainya tidak bisa dilihat lagi,
              dan ia akan diminta menggantinya saat login berikutnya.
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="cancel" onClick={() => { setShowResetSheet(false); setResetItem(null); }}>
              Batal
            </Button>
            <Button variant="primary" onClick={confirmResetPassword} isLoading={resetting}>
              Ya, Reset
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteSheet && deleteItemData && (
        <Modal size="sm" variant="delete" onClose={() => { setShowDeleteSheet(false); setDeleteItemId(null); setDeleteItemData(null); }} labelledBy="modal-del-user-title">
          <ModalHeader
            id="modal-del-user-title"
            title={deleteItemData.nama_lengkap || deleteItemData.nama}
            icon="trash3"
            onClose={() => { setShowDeleteSheet(false); setDeleteItemId(null); setDeleteItemData(null); }}
          />
          <ModalBody>
            <div style={{ padding: '4px 0', fontSize: '0.9rem', color: 'var(--n-text)', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus akun <strong>@{deleteItemData.username}</strong> ({deleteItemData.nama_lengkap || deleteItemData.nama})?
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--n-muted)' }}>
                Kredensial login, foto profil, dan seluruh akses terkait akun ini akan dihapus secara permanen.
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="cancel" onClick={() => { setShowDeleteSheet(false); setDeleteItemId(null); setDeleteItemData(null); }}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={deleting}>
              Ya, Hapus!
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Mobile Detail Sheet — opens when a MobileListItem is tapped */}
      {sheetUser && (() => {
        const isSelfSheet = String(sheetUser.id) === String(user?.id);
        return (
          <MobileSheet
            title={sheetUser.nama_lengkap || sheetUser.nama}
            subtitle={`@${sheetUser.username}`}
            leading={
              <MobileAvatar
                name={sheetUser.nama_lengkap || sheetUser.nama}
                seed={sheetUser.username || sheetUser.nama}
                src={sheetUser.photoUrl ? getProxiedImageUrl(sheetUser.photoUrl) : undefined}
              />
            }
            onClose={() => setSheetUser(null)}
            footer={isAdmin ? (
              <>
                <Button
                  variant="secondary"
                  leftIcon={<i className="bi bi-pencil-fill" />}
                  onClick={() => { const u = sheetUser; setSheetUser(null); handleEdit(u) }}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<i className="bi bi-key-fill" />}
                  onClick={() => { const u = sheetUser; setSheetUser(null); handleResetPassword(u); }}
                >
                  Reset
                </Button>
                {!isSelfSheet && (
                  <Button
                    variant="danger"
                    icon="delete"
                    onClick={() => { const u = sheetUser; setSheetUser(null); handleDelete(u); }}
                  >
                    Hapus
                  </Button>
                )}
              </>
            ) : undefined}
          >
            <MobileKV label="NIP/NISN" mono>{sheetUser.nip || '-'}</MobileKV>
            <MobileKV label="Role">
              {(sheetUser.role || 'GURU').split(/[,|]/).map(r => r.trim()).filter(Boolean).map(r => {
                const rc = getRoleBadgeColor(r)
                return (
                  <span key={r} className="udt-role-badge" style={{ background: rc.bg, color: rc.fg, borderColor: rc.border, marginRight: 4 }}>
                    <i className="bi bi-shield-fill"></i>{r}
                  </span>
                )
              })}
            </MobileKV>
            {sheetUser.divisi && <MobileKV label="Divisi">{sheetUser.divisi}</MobileKV>}
            {sheetUser.email && <MobileKV label="Email">{sheetUser.email}</MobileKV>}
            <MobileKV label="Status">
              <label
                className={`udt-status-toggle ${toggling !== null && String(toggling) === String(sheetUser.id) || !isAdmin || isSelfSheet ? 'is-disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (isSelfSheet) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'Perhatian',
                      text: 'Anda tidak dapat menonaktifkan akun sendiri.',
                      timer: 2000,
                      showConfirmButton: false,
                    });
                    return;
                  }
                  if (isAdmin && (toggling === null || String(toggling) !== String(sheetUser.id))) {
                    handleToggleStatus(sheetUser);
                  }
                }}
                title={isSelfSheet ? 'Tidak bisa menonaktifkan akun sendiri' : undefined}
              >
                <input
                  type="checkbox"
                  style={{ display: 'none' }}
                  checked={sheetUser.aktif}
                  readOnly
                  disabled={(toggling !== null && String(toggling) === String(sheetUser.id)) || !isAdmin || isSelfSheet}
                />
                <div className="udt-status-toggle__switch"></div>
                <span className="udt-status-toggle__label">
                  {toggling !== null && String(toggling) === String(sheetUser.id) ? '...' : (sheetUser.aktif ? 'Aktif' : 'Nonaktif')}
                </span>
              </label>
            </MobileKV>
          </MobileSheet>
        );
      })()}

      {/* Mobile FAB: Tambah User — registers as BottomNav center button */}
      {isAdmin && <MobileFab label="Tambah User" icon="plus-lg" onClick={handleAdd} />}

      <UserModal
        isOpen={isAdding || !!editingUser}
        onClose={handleCancel}
        onSave={async (modalData) => {
          setSaving(true)
          try {
            const url = isAdding ? '/api/admin/users' : `/api/admin/users/${editingUser?.id}`
            const res = await fetch(url, {
              method: isAdding ? 'POST' : 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(modalData)
            })
            const data = await res.json()
            if (data.ok) {
              Swal.fire('Berhasil', isAdding ? 'User baru ditambahkan!' : 'Data user diperbarui!', 'success')
              fetchUsers()
              handleCancel()
            } else {
              Swal.fire('Gagal', pesanGalat(data), 'error')
            }
          } catch {
            Swal.fire('Error', 'Terjadi kesalahan', 'error')
          } finally {
            setSaving(false)
          }
        }}
        editingUser={editingUser}
        // Daftar CADANGAN, dipakai hanya bila `/api/admin/roles` gagal dimuat.
        // Isinya dulu lima role yang ditulis tangan, dan salah satunya —
        // 'WALI KELAS' dengan SPASI — tidak ada di tabel `roles` (bentuknya
        // `WALI_KELAS`), sehingga akun yang dibuat dengan pilihan itu tidak cocok
        // dengan satu baris `role_pages` pun. Sekarang kosong: lebih baik modal
        // tidak menawarkan pilihan apa pun daripada menawarkan yang tidak sah.
        // Backend juga menolaknya sejak `create`/`update` memvalidasi role.
        availableRoles={[]}
        saving={saving}
      />

      <style jsx>{`
        /* ===== ROOT ===== */
        .udt-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 24px;
        }

        /* ===== TOOLBAR ACTIONS ===== */
        .udt-toolbar-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        /* ===== BUTTONS ===== */
        .udt-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
        }
        .udt-btn i { font-size: 0.95rem; }
        .udt-btn--primary {
          background: var(--n-card);
          color: var(--n-text);
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }
        .udt-btn--primary:hover {
          background: var(--n-soft);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        .udt-btn--export {
          background: var(--n-card);
          color: #10b981;
          border: 1px solid var(--n-border);
        }
        .udt-btn--export:hover {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
          transform: translateY(-1px);
        }
        .udt-btn--import {
          background: var(--n-card);
          color: #3b82f6;
          border: 1px solid var(--n-border);
        }
        .udt-btn--import:hover {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
          transform: translateY(-1px);
        }
        .udt-btn--blue {
          background: linear-gradient(135deg, #1e3a8a, #2563eb);
          color: white;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
        }
        .udt-btn--blue:hover:not(:disabled) {
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
          transform: translateY(-1px);
        }
        .udt-btn--danger {
          background: linear-gradient(135deg, #dc2626, #ef4444);
          color: white;
          box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);
        }
        .udt-btn--danger:hover:not(:disabled) {
          box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
          transform: translateY(-1px);
        }
        .udt-btn--ghost {
          background: var(--n-soft);
          color: var(--n-muted);
          border: 1.5px solid var(--n-border);
        }
        .udt-btn--ghost:hover {
          background: #e2e8f0;
          color: var(--n-text);
        }
        .udt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        /* ===== STATS ===== */
        .udt-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .udt-stat {
          background: var(--n-card);
          border: 1px solid var(--n-border);
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .udt-stat:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        .udt-stat__icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          flex-shrink: 0;
        }
        .udt-stat__icon--gray { background: #eff6ff; color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.2); }
        .udt-stat__icon--green { background: #e0f2fe; color: #0284c7; border: 1px solid rgba(2, 132, 199, 0.2); }
        .udt-stat__icon--red { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.2); }

        .udt-stat__value {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--n-text);
          line-height: 1.2;
        }
        .udt-stat__label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--n-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: 2px;
        }

        /* ===== TOOLBAR ===== */
        .udt-toolbar {
          background: var(--n-card);
          border: 1px solid var(--n-border);
          border-radius: 16px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .udt-toolbar__left, .udt-toolbar__right { display: flex; align-items: center; gap: 8px; }
        .udt-seg {
          display: flex;
          background: var(--n-soft);
          border: 1.5px solid var(--n-border);
          border-radius: 10px;
          padding: 3px;
          gap: 2px;
          flex-shrink: 0;
        }
        .udt-seg__btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--n-muted);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
        }
        .udt-seg__btn:hover:not(.is-active) {
          color: var(--n-text);
          background: rgba(255,255,255,0.6);
        }
        .udt-seg__btn.is-active {
          background: var(--n-card);
          color: var(--n-text);
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          border: 1px solid var(--n-border);
        }
        .udt-search {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
          max-width: 280px;
        }
        .udt-search__icon {
          position: absolute;
          left: 12px;
          color: var(--n-muted);
          pointer-events: none;
          font-size: 0.85rem;
        }
        .udt-search__input {
          width: 100%;
          padding: 9px 44px 9px 36px;
          border: 1.5px solid var(--n-border);
          border-radius: 10px;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: var(--n-soft);
          color: var(--n-text);
          box-sizing: border-box;
        }
        .udt-search__input:focus {
          border-color: #3b82f6;
          background: var(--n-card);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .udt-search__input::placeholder { color: var(--n-muted); }
        .udt-search__clear {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: var(--n-muted);
          cursor: pointer;
          padding: 2px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .udt-search__clear:hover { background: var(--n-soft); color: var(--n-muted); }
        .udt-role-filter {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0;
          background: var(--n-soft);
          border: 1.5px solid var(--n-border);
          border-radius: 10px;
          padding: 0 8px 0 10px;
          height: 38px;
          flex-shrink: 0;
        }
        .udt-role-filter__icon {
          color: var(--n-muted);
          font-size: 0.9rem;
          pointer-events: none;
          margin-right: 6px;
          flex-shrink: 0;
        }
        .udt-role-filter__select {
          background: transparent;
          border: none;
          outline: none;
          font-size: 0.85rem;
          color: var(--n-text);
          cursor: pointer;
          padding: 0;
          padding-right: 4px;
          font-weight: 500;
          min-width: 0;
          width: 100%;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .udt-role-filter__clear {
          background: none;
          border: none;
          color: var(--n-muted);
          cursor: pointer;
          padding: 2px 0 2px 4px;
          display: flex;
          align-items: center;
          font-size: 0.85rem;
          border-radius: 50%;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .udt-role-filter__clear:hover { color: var(--n-muted); }

        /* ===== VIEW TOGGLE ===== */
        .udt-view-toggle {
          display: flex;
          background: var(--n-soft);
          border: 1.5px solid var(--n-border);
          border-radius: 10px;
          padding: 3px;
          gap: 2px;
          flex-shrink: 0;
        }
        .udt-view-toggle__btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--n-muted);
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .udt-view-toggle__btn:hover:not(.is-active) {
          color: var(--n-text);
          background: rgba(255,255,255,0.6);
        }
        .udt-view-toggle__btn.is-active {
          background: var(--n-card);
          color: var(--n-text);
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          border: 1px solid var(--n-border);
        }

        /* ===== TABLE VIEW ===== */
        .udt-table-card {
          background: var(--n-card);
          border: 1px solid var(--n-border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .udt-table-wrap {
          overflow-x: auto;
        }
        .udt-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 700px;
        }
        .udt-table thead tr {
          background: var(--n-soft);
        }
        .udt-table th {
          text-align: left;
          padding: 12px 12px;
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--n-muted);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          border-bottom: 2px solid var(--n-border);
          white-space: nowrap;
        }
        .udt-th--no { width: 56px; text-align: center; }
        /* Role & Aksi menyusut ke lebar kontennya supaya ikon aksi tidak
           terpotong pada layar sempit (width:1% + nowrap = shrink-to-fit). */
        .udt-th--role { width: 1%; }
        /* Role gabungan koma dipecah per badge dan boleh turun baris —
           satu badge panjang tanpa wrap dulunya melebarkan kolom >350px. */
        .udt-role-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          max-width: 190px;
        }
        .udt-th--actions { text-align: right; width: 1%; }
        .udt-td--actions { white-space: nowrap; }
        .udt-table td {
          padding: 13px 12px;
          border-bottom: 1px solid var(--n-border);
          font-size: 0.88rem;
          color: var(--n-text);
          vertical-align: middle;
        }
        .udt-table tbody tr {
          transition: background 0.15s ease;
        }
        .udt-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.03);
        }
        .udt-table tbody tr:last-child td {
          border-bottom: none;
        }
        .udt-table tbody tr.is-inactive {
          opacity: 0.6;
        }
        .udt-td--no {
          text-align: center;
        }
        /* Kotak nomor merangkap checkbox: klik untuk memilih baris.
           Saat terpilih: kotak terisi + badge centang di sudut kanan atas. */
        .udt-no-box {
          position: relative;
          width: 34px;
          height: 34px;
          padding: 0;
          border-radius: 9px;
          border: 1.5px solid var(--n-border);
          background: var(--n-soft);
          color: var(--n-muted);
          font-weight: 800;
          font-size: 0.78rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .udt-no-box:hover {
          border-color: #3083FF;
          color: #3083FF;
          background: #eef2ff;
        }
        .udt-no-box.is-checked {
          background: #3083FF;
          border-color: #3083FF;
          color: #fff;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
        }
        .udt-no-box__tick {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #16a34a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.62rem;
          line-height: 1;
          border: 2px solid var(--n-card);
        }
        .udt-no-box--all { font-size: 0.95rem; }
        .udt-user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .udt-user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.82rem;
          font-weight: 800;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        .udt-user-name {
          font-weight: 700;
          color: var(--n-text);
          font-size: 0.9rem;
          line-height: 1.3;
        }
        .udt-user-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .udt-mono {
          font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--n-muted);
          background: var(--n-soft);
          padding: 2px 8px;
          border-radius: 6px;
        }
        .udt-nip {
          font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--n-muted);
        }
        .udt-divisi {
          font-size: 0.82rem;
          color: var(--n-muted);
        }
        .udt-dash { color: #cbd5e1; }
        .udt-role-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 800;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .udt-role-badge i { font-size: 0.78rem; }
        
        /* ===== STATUS TOGGLE ===== */
        .udt-status-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .udt-status-toggle.is-disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .udt-status-toggle__switch {
          position: relative;
          width: 36px;
          height: 20px;
          background: #e11d48;
          border-radius: 20px;
          transition: 0.3s;
        }
        .udt-status-toggle input:checked + .udt-status-toggle__switch {
          background: #1d6bf3;
        }

        .udt-status-toggle__switch::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background: #fff;
          border-radius: 50%;
          transition: 0.3s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .udt-status-toggle input:checked + .udt-status-toggle__switch::after {
          transform: translateX(16px);
        }
        .udt-status-toggle__label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--n-text);
        }

        .udt-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .udt-status-badge i { font-size: 0.82rem; }
        .udt-status-badge.is-active { background: #ecfdf5; color: #166534; }
        .udt-status-badge.is-inactive { background: #fff1f2; color: #e11d48; }
        .udt-row-actions {
          display: flex;
          gap: 5px;
          justify-content: flex-end;
        }

        /* ===== TOAST ===== */
        .udt-toast {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          animation: slideDown 0.3s ease;
          border: 1px solid transparent;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .udt-toast--success {
          background: #ecfdf5;
          color: #166534;
          border-color: #bbf7d0;
        }
        .udt-toast--error {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }
        .udt-toast i { font-size: 1rem; }

        /* ===== CONTENT ===== */
        .udt-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ===== EMPTY ===== */
        .udt-empty {
          background: var(--n-card);
          border: 1px solid var(--n-border);
          border-radius: 20px;
          padding: 56px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .udt-empty__icon {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: var(--n-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          color: var(--n-muted);
          margin-bottom: 4px;
        }
        .udt-empty__title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--n-text);
        }
        .udt-empty__sub {
          font-size: 0.85rem;
          color: var(--n-muted);
          margin-bottom: 8px;
        }

        /* ===== GROUP ===== */
        .udt-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .udt-group__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 0 4px;
        }
        .udt-group__badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 99px;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .udt-group__badge i { font-size: 0.85rem; }
        .udt-group__count {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--n-muted);
          background: var(--n-soft);
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid var(--n-border);
        }

        /* ===== CARD GRID ===== */
        .udt-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 10px;
        }
        .udt-card {
          background: var(--n-card);
          border: 1px solid var(--n-border);
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
        }
        .udt-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 16px rgba(59,130,246,0.1);
          transform: translateY(-1px);
        }
        .udt-card--inactive {
          opacity: 0.65;
        }
        .udt-card--inactive:hover {
          opacity: 0.85;
        }
        .udt-card__top {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .udt-card__avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 800;
          flex-shrink: 0;
          letter-spacing: 0.02em;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .udt-card__info {
          flex: 1;
          min-width: 0;
        }
        .udt-card__name {
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--n-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .udt-card__meta {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        .udt-card__nip {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--n-muted);
          font-family: monospace;
          background: var(--n-soft);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .udt-card__sep { color: #cbd5e1; font-size: 0.7rem; }
        .udt-card__status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 99px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .udt-card__status i { font-size: 0.8rem; }
        .udt-card__status--on { background: #ecfdf5; color: #166534; }
        .udt-card__status--off { background: #fff1f2; color: #e11d48; }
        .udt-card__divisi {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          color: var(--n-muted);
          margin-bottom: 10px;
          padding: 4px 8px;
          background: var(--n-soft);
          border-radius: 6px;
          border: 1px solid var(--n-border);
        }
        .udt-card__divisi i { font-size: 0.8rem; color: var(--n-muted); }
        .udt-card__actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          border-top: 1px solid var(--n-border);
          padding-top: 10px;
          margin-top: 4px;
        }

        /* ===== ICON BUTTON ===== */
        .udt-iconBtn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1.5px solid var(--n-border);
          background: var(--n-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.78rem;
          transition: all 0.2s;
          color: var(--n-muted);
          flex-shrink: 0;
        }
        .udt-iconBtn--edit:hover { border-color: #3083FF; color: #3083FF; background: #eff6ff; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(124,58,237,0.15); }
        .udt-iconBtn--key:hover { border-color: #d97706; color: #d97706; background: #fffbeb; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(217,119,6,0.15); }
        .udt-iconBtn--on:hover { border-color: #16a34a; color: #16a34a; background: #ecfdf5; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(22,163,74,0.15); }
        .udt-iconBtn--off:hover { border-color: var(--n-muted); color: var(--n-muted); background: var(--n-soft); transform: translateY(-1px); }
        .udt-iconBtn--danger:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(220,38,38,0.15); }
        .udt-iconBtn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

        /* ===== SPINNER ===== */
        .udt-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .udt-spin { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .udt-spin--sm { width: 14px; height: 14px; border-width: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ===== RESULT INFO ===== */
        .udt-result {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: #10b981;
          font-weight: 600;
        }
        .udt-result i { font-size: 0.9rem; }
        .udt-result strong { color: var(--n-muted); }

        /* ===== SHEET ===== */
        .udt-sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.5);
          backdrop-filter: blur(4px);
          z-index: 99998;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .udt-sheet {
          background: var(--n-card);
          width: 100%;
          max-width: 480px;
          border-radius: 24px;
          padding: 24px;
          animation: scaleUp 0.2s ease-out;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .udt-sheet__handle {
          display: none;
        }
        .udt-sheet__header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }
        .udt-sheet__icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          flex-shrink: 0;
        }
        .udt-sheet__icon--blue { background: #eff6ff; color: #2563eb; }
        .udt-sheet__icon--danger { background: #fef2f2; color: #dc2626; }
        .udt-sheet__title { font-size: 1.05rem; font-weight: 800; color: var(--n-text); margin-bottom: 2px; }
        .udt-sheet__sub { font-size: 0.8rem; color: var(--n-muted); }
        .udt-sheet__body { margin-bottom: 20px; }
        .udt-sheet__preview {
          background: var(--n-soft);
          border: 1px solid var(--n-border);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .udt-preview-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 800;
          flex-shrink: 0;
        }
        .udt-preview-info { min-width: 0; }
        .udt-preview-name { font-size: 0.92rem; font-weight: 700; color: var(--n-text); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .udt-preview-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--n-muted); word-break: break-all; }
        .udt-preview-badge {
          display: inline-flex;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .udt-sheet__pwbox {
          background: rgba(59, 130, 246, 0.06);
          border: 1.5px solid rgba(59, 130, 246, 0.25);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.85rem;
          color: #1d4ed8;
          font-weight: 600;
        }
        .udt-sheet__pwbox code {
          background: var(--n-card);
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 800;
          margin-left: 4px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #1e3a8a;
          letter-spacing: 0.05em;
        }
        .udt-sheet__warn {
          color: #b91c1c;
          font-size: 0.85rem;
          line-height: 1.5;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 10px 14px;
          margin: 0;
        }
        .udt-sheet__foot {
          display: flex;
          gap: 10px;
          padding-top: 16px;
          border-top: 1px solid var(--n-border);
        }
        .udt-sheet__foot .udt-btn { flex: 1; }

        /* ===== MOBILE RESPONSIVE ===== */
        @media (max-width: 768px) {
          .udt-stats { grid-template-columns: 1fr 1fr; }
          .udt-stats .udt-stat:last-child { grid-column: span 2; }
          
          .udt-toolbar {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 12px;
            border-radius: 14px;
          }
          .udt-toolbar__left {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
            order: 2;
          }
          .udt-role-filter { width: 100%; }
          .udt-toolbar__right {
            display: contents;
          }
          .udt-search {
            order: 1;
            width: 100%;
            max-width: none;
          }
          .udt-toolbar-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
            order: 3;
            margin-top: 4px;
          }
          .udt-toolbar-actions .udt-btn {
            width: 100%;
            justify-content: center;
          }
          .udt-toolbar-actions .udt-btn--primary {
            grid-column: span 2;
          }

          .udt-seg { flex-wrap: wrap; }
          .udt-seg__btn { padding: 6px 10px; font-size: 0.78rem; }
          .udt-search { max-width: 100%; width: 100%; }
          .udt-card-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .udt-card { padding: 12px 10px; border-radius: 12px; }
          .udt-card__top { gap: 8px; }
          .udt-card__actions { gap: 4px; }
          .udt-iconBtn { width: 30px; height: 30px; border-radius: 8px; font-size: 0.75rem; }
          .udt-sheet-overlay { padding: 16px; align-items: center; }
          .udt-sheet { max-width: 100%; border-radius: 24px; padding: 20px; }
          .udt-sheet__foot { flex-direction: column-reverse; }
          .udt-sheet__foot .udt-btn { width: 100%; justify-content: center; }
        }
        @media (max-width: 480px) {
          .udt-root { gap: 12px; }
          .udt-stats { grid-template-columns: 1fr; }
          .udt-stats .udt-stat:last-child { grid-column: span 1; }
          .udt-card-grid { grid-template-columns: 1fr; }
          .udt-card { padding: 12px; }
          .udt-group__badge { font-size: 0.72rem; }
          .udt-empty { padding: 40px 16px; }
          .udt-header__actions .udt-btn { flex: 1 1 100%; }
        }

        /* ===== DARK MODE STANDARD ===== */
        :global(.dark) .udt-stat,
        :global(.dark) .udt-toolbar,
        :global(.dark) .udt-table-card,
        :global(.dark) .udt-card,
        :global(.dark) .udt-sheet,
        :global(.dark) .udt-empty {
          background: #0b1329 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
        }
        :global(.dark) .udt-stat__icon--gray {
          background: rgba(26, 115, 232, 0.18) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.45) !important;
        }
        :global(.dark) .udt-stat__icon--green {
          background: rgba(14, 165, 233, 0.18) !important;
          color: #38bdf8 !important;
          border: 1px solid rgba(56, 189, 248, 0.45) !important;
        }
        :global(.dark) .udt-stat__icon--red {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.35) !important;
        }
        :global(.dark) .udt-search,
        :global(.dark) .udt-role-filter {
          background: #0b1329 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 12px !important;
          color: #e2e8f0 !important;
        }
        :global(.dark) .udt-role-filter__icon {
          color: #60a5fa !important;
        }
        :global(.dark) .udt-search__input,
        :global(.dark) select.udt-role-filter__select,
        :global(.dark) .udt-role-filter__select {
          /* JANGAN pakai shorthand background di sini: shorthand mereset
             background-image, sehingga chevron di aturan bawah ikut hilang. */
          background-color: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: #e2e8f0 !important;
        }
        :global(.dark) select.udt-role-filter__select {
          height: 38px !important;
          background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjYgOSAxMiAxNSAxOCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==") !important;
          background-repeat: no-repeat !important;
          background-position: right 2px center !important;
          background-size: 14px 14px !important;
          padding-right: 20px !important;
          -webkit-appearance: none !important;
          appearance: none !important;
        }
        :global(.dark) .udt-role-badge,
        :global(.dark) .udt-group__badge {
          background: rgba(26, 115, 232, 0.18) !important;
          border: 1px solid rgba(59, 130, 246, 0.45) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .udt-status-toggle input:checked + .udt-status-toggle__switch {
          background: #1d6bf3 !important;
          box-shadow: 0 0 10px rgba(29, 107, 243, 0.5) !important;
        }
        :global(.dark) .udt-table thead tr,
        :global(.dark) .udt-table th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .udt-table td {
          background: #0b1329 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
          color: #cbd5e1 !important;
        }
        :global(.dark) .udt-table tbody tr:hover td {
          background: rgba(26, 115, 232, 0.08) !important;
        }
        :global(.dark) .udt-stat__value,
        :global(.dark) .udt-user-name,
        :global(.dark) .udt-card__name,
        :global(.dark) .udt-sheet__title,
        :global(.dark) .udt-preview-name,
        :global(.dark) .udt-empty__title {
          color: #e2e8f0 !important;
        }
        :global(.dark) .udt-btn--primary {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(59, 130, 246, 0.6) !important;
          box-shadow: 0 4px 16px rgba(26, 115, 232, 0.45) !important;
        }
        :global(.dark) .udt-status-badge.is-active,
        :global(.dark) .udt-card__status--on {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.5) !important;
        }
        :global(.dark) .udt-status-badge.is-inactive,
        :global(.dark) .udt-card__status--off {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
        }
        :global(.dark) .udt-iconBtn {
          background: #0b1329 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .udt-iconBtn:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
        }
        :global(.dark) .udt-iconBtn--danger {
          background: #0b1329 !important;
          border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
        }
        :global(.dark) .udt-iconBtn--danger:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          color: #ffffff !important;
        }
        :global(.dark) .udt-sheet__icon--danger {
          background: rgba(239, 68, 68, 0.18) !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
        }
        :global(.dark) .udt-sheet__icon--blue {
          background: rgba(26, 115, 232, 0.18) !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .udt-sheet__preview {
          background: #0b1329 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
        }
        :global(.dark) .udt-preview-avatar {
          background: rgba(26, 115, 232, 0.2) !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .udt-preview-name {
          color: #e2e8f0 !important;
        }
        :global(.dark) .udt-preview-meta {
          color: #94a3b8 !important;
        }
        :global(.dark) .udt-sheet__warn {
          background: rgba(239, 68, 68, 0.15) !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
        }
        :global(.dark) .udt-sheet__pwbox {
          background: rgba(59, 130, 246, 0.12) !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .udt-sheet__pwbox code {
          background: #0b1329 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
          color: #93c5fd !important;
        }
        :global(.dark) .udt-btn--ghost {
          background: #0b1329 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .udt-btn--ghost:hover {
          background: rgba(26, 115, 232, 0.15) !important;
          color: #ffffff !important;
        }
        :global(.dark) .udt-btn--danger {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(239, 68, 68, 0.6) !important;
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.45) !important;
        }
        :global(.dark) .udt-sheet__foot {
          background: #0b1329 !important;
          border-top-color: rgba(26, 115, 232, 0.4) !important;
        }
        /* ===== END DARK MODE STANDARD ===== */



      `}</style>
    </div>
  )
}
