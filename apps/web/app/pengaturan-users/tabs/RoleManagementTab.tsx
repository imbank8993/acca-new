import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { PageLoader } from '@/components/ui/Spinner'
import { formatRoleDisplay } from '@/lib/auth'
import Swal from 'sweetalert2'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { FilterToolbar, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { MENU_GROUPS, type MenuGroupDef } from '@/lib/sidebar-menu'
import {
  detectRoleUsage,
  SYSTEM_ROLE_TEMPLATES,
  formatActionLabel,
  type RoleUsageAnalysis,
  type ActionLevel
} from '@/lib/role-intelligence'

interface Role {
  id: number
  name: string
  description: string | null
  created_at?: string
}

interface User {
  id: number
  nama: string
  username: string
  nip?: string
  roles?: string[]
  role?: string
}

export default function RoleManagementTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [rolePagesMap, setRolePagesMap] = useState<Record<string, string[]>>({})
  const [menuGroups, setMenuGroups] = useState<MenuGroupDef[]>([])
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

  // User role modal
  const [showUserRoleModal, setShowUserRoleModal] = useState(false)
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null)

  // Detail Scope & Function modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<Role | null>(null)
  const [detailSearch, setDetailSearch] = useState('')
  const [detailCategory, setDetailCategory] = useState('ALL')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  // Modal blur
  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showRoleModal || showUserRoleModal || showDetailModal) return registerModal()
  }, [showRoleModal, showUserRoleModal, showDetailModal, registerModal])

  // Filters
  const [searchUser, setSearchUser] = useState('')
  const [searchRole, setSearchRole] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchRoles()
    fetchUsers()
    fetchRolePages()
    fetchMenuLayout()
  }, [])

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/admin/roles')
      const data = await res.json()
      if (data.ok) setRoles(data.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.ok) setUsers(data.data || [])
    } catch (e) { console.error(e) }
  }

  const fetchRolePages = async () => {
    try {
      const res = await fetch('/api/admin/role-pages')
      const data = await res.json()
      if (data.ok && data.map) setRolePagesMap(data.map)
    } catch (e) { console.error(e) }
  }

  const fetchMenuLayout = async () => {
    try {
      const res = await fetch('/api/menu-layout')
      const data = await res.json()
      if (data?.ok && Array.isArray(data.layout) && data.layout.length > 0) {
        setMenuGroups(data.layout)
      } else {
        setMenuGroups(MENU_GROUPS)
      }
      if (data?.ok && data.labels && typeof data.labels === 'object') {
        setCustomLabels(data.labels)
      }
    } catch (e) {
      setMenuGroups(MENU_GROUPS)
    }
  }

  // Filter users
  const filteredUsers = useMemo(() => {
    let result = users
    if (roleFilter) {
      result = result.filter(u => (u.roles || []).includes(roleFilter))
    }
    if (searchUser) {
      const q = searchUser.toLowerCase()
      result = result.filter(u =>
        u.nama?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.nip?.toLowerCase().includes(q)
      )
    }
    return result
  }, [users, roleFilter, searchUser])

  // Role actions
  const openAddRoleModal = () => {
    setEditingRole(null)
    setFormData({ name: '', description: '' })
    setShowRoleModal(true)
  }

  const openEditRoleModal = (role: Role) => {
    setEditingRole(role)
    setFormData({ name: role.name, description: role.description || '' })
    setShowRoleModal(true)
  }

  const openDetailModal = (role: Role) => {
    setSelectedRoleForDetail(role)
    setDetailSearch('')
    setDetailCategory('ALL')
    setCollapsedGroups({})
    setShowDetailModal(true)
  }

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      Swal.fire('Error', 'Nama role tidak boleh kosong', 'error')
      return
    }

    const namaBaru = formData.name.trim().toUpperCase().replace(/\s+/g, '_')

    /**
     * Mengganti NAMA role menyentuh lebih dari satu baris.
     *
     * Server memperbarui `public_users.role` setiap pemegangnya, `role_pages`,
     * `role_group_flat`, dan `role_capabilities` dalam satu transaksi — kalau tidak,
     * pemegangnya akan kehilangan seluruh pemetaan halaman dan memegang role yang
     * tidak ada lagi di daftar. Perilakunya sudah benar, tapi dampaknya tidak
     * terlihat dari layar ini, jadi jumlah akun yang ikut berubah disebutkan lebih
     * dulu.
     */
    if (editingRole && editingRole.name.toUpperCase() !== namaBaru) {
      const jumlahPemegang = getUsersWithRole(editingRole.name).length
      const { isConfirmed } = await Swal.fire({
        title: 'Ganti nama role?',
        html: `<p style="text-align:left">Role <b>${editingRole.name}</b> akan diganti menjadi <b>${namaBaru}</b>.</p>`
          + `<p style="text-align:left;margin-top:8px">${jumlahPemegang > 0
              ? `<b>${jumlahPemegang} akun</b> yang memegangnya ikut diperbarui, beserta pemetaan halaman dan hak akses role ini.`
              : 'Tidak ada akun yang memegang role ini; hanya pemetaan halaman dan hak aksesnya yang dipindahkan.'}</p>`
          + `<p style="text-align:left;margin-top:8px;font-size:0.85em;color:#64748b">Nama role ini juga bisa disebut di Hak Akses Fitur; periksa kembali setelahnya.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, ganti nama',
        cancelButtonText: 'Batal',
        width: 560,
      })
      if (!isConfirmed) return
    }

    const url = editingRole ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles'
    const method = editingRole ? 'PUT' : 'POST'

    setSaving(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: namaBaru,
          description: formData.description.trim() || null
        })
      })
      const data = await res.json()

      if (res.ok && data.ok) {
        Swal.fire('Berhasil', editingRole ? 'Role diupdate!' : 'Role ditambahkan!', 'success')
        setShowRoleModal(false)
        fetchRoles()
        fetchRolePages()
      } else {
        Swal.fire('Error', data.message || 'Gagal menyimpan role', 'error')
      }
    } catch (e) {
      Swal.fire('Error', 'Terjadi kesalahan', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (role.name.toUpperCase() === 'ADMIN') {
      Swal.fire('Error', 'Role ADMIN tidak bisa dihapus', 'error')
      return
    }

    const { isConfirmed } = await Swal.fire({
      title: 'Hapus Role?',
      text: `Yakin hapus role "${role.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    })
    if (!isConfirmed) return

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.ok) {
        Swal.fire('Berhasil', 'Role dihapus!', 'success')
        fetchRoles()
        fetchRolePages()
      } else {
        Swal.fire('Error', data.message || 'Gagal hapus role', 'error')
      }
    } catch (e) {
      Swal.fire('Error', 'Terjadi kesalahan', 'error')
    }
  }

  // User role actions
  const openUserRoleModal = (role: Role) => {
    setSelectedRoleForUsers(role)
    setSearchUser('')
    setRoleFilter('')
    setShowUserRoleModal(true)
  }

  const getUsersWithRole = (roleName: string) => {
    const roleUpper = roleName.toUpperCase()
    return users.filter(u => (u.roles || []).some(r => r.toUpperCase() === roleUpper))
  }

  const getUsersWithoutRole = (roleName: string) => {
    const roleUpper = roleName.toUpperCase()
    return users.filter(u => !(u.roles || []).some(r => r.toUpperCase() === roleUpper))
  }

  const toggleUserRole = async (user: User, roleName: string, hasRole: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleName, action: hasRole ? 'remove' : 'add' })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        fetchUsers()
      } else {
        Swal.fire('Error', data.message || 'Gagal update role', 'error')
      }
    } catch (e) {
      Swal.fire('Error', 'Terjadi kesalahan', 'error')
    }
  }

  // Live Auto-Detection for the Form Modal
  const liveFormAnalysis = useMemo<RoleUsageAnalysis>(() => {
    if (!formData.name.trim()) {
      return detectRoleUsage('', [], menuGroups, customLabels)
    }
    const roleKey = formData.name.trim().toUpperCase().replace(/\s+/g, '_')
    const activePages = rolePagesMap[roleKey] || []
    return detectRoleUsage(roleKey, activePages, menuGroups, customLabels)
  }, [formData.name, rolePagesMap, menuGroups, customLabels])

  // Analysis for Selected Detail Role
  const detailRoleAnalysis = useMemo<RoleUsageAnalysis | null>(() => {
    if (!selectedRoleForDetail) return null
    const roleKey = selectedRoleForDetail.name.toUpperCase()
    const activePages = rolePagesMap[roleKey] || []
    return detectRoleUsage(roleKey, activePages, menuGroups, customLabels)
  }, [selectedRoleForDetail, rolePagesMap, menuGroups, customLabels])

  // Filtered groups in Detail Modal
  const filteredDetailGroups = useMemo(() => {
    if (!detailRoleAnalysis) return []
    let groups = detailRoleAnalysis.groups

    if (detailCategory !== 'ALL') {
      groups = groups.filter(g => g.key === detailCategory)
    }

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase()
      groups = groups
        .map(g => ({
          ...g,
          pages: g.pages.filter(
            p =>
              p.title.toLowerCase().includes(q) ||
              p.pageId.toLowerCase().includes(q) ||
              p.functionDescription.toLowerCase().includes(q) ||
              p.actionLabel.toLowerCase().includes(q)
          )
        }))
        .filter(g => g.pages.length > 0)
    }

    return groups
  }, [detailRoleAnalysis, detailCategory, detailSearch])

  const totalFilteredPagesCount = useMemo(() => {
    return filteredDetailGroups.reduce((acc, g) => acc + g.pages.length, 0)
  }, [filteredDetailGroups])

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  const toggleAllGroupsCollapse = (collapse: boolean) => {
    if (!detailRoleAnalysis) return
    const newState: Record<string, boolean> = {}
    detailRoleAnalysis.groups.forEach(g => {
      newState[g.key] = collapse
    })
    setCollapsedGroups(newState)
  }

  const applyTemplate = (template: typeof SYSTEM_ROLE_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.desc
    })
  }

  const getActionBadgeClass = (action: ActionLevel) => {
    switch (action) {
      case 'manage':
        return 'dr__actBadge dr__actBadge--manage'
      case 'edit':
        return 'dr__actBadge dr__actBadge--edit'
      case 'view':
        return 'dr__actBadge dr__actBadge--view'
      default:
        return 'dr__actBadge'
    }
  }

  if (loading) return <PageLoader minHeight="300px" variant="trace" />

  return (
    <div className="dr">
      {/* Toolbar */}
      <FilterToolbar>
        <FilterSearch
          value={searchRole}
          onChange={setSearchRole}
          placeholder="Cari role..."
        />
        <FilterActions>
          <Button variant="primary" icon="add" onClick={openAddRoleModal}>
            Tambah Role
          </Button>
        </FilterActions>
      </FilterToolbar>

      {/* Role Table / Cards */}
      {!isMobile ? (
        <div className="dr__tableWrapper">
          <table className="dr__table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Deskripsi</th>
                <th>Cakupan Halaman & Fungsi</th>
                <th>Jumlah User</th>
                <th className="dr__thActions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {roles
                .filter(r => r.name.toLowerCase().includes(searchRole.toLowerCase()))
                .map(role => {
                  const usage = detectRoleUsage(
                    role.name,
                    rolePagesMap[role.name.toUpperCase()] || [],
                    menuGroups,
                    customLabels
                  )
                  return (
                    <tr key={role.id}>
                      <td>
                        <div className="dr__roleCell">
                          <div className="dr__roleIcon"><i className="bi bi-shield-check"></i></div>
                          <div className="dr__roleInfo">
                            <span className="dr__roleName">{formatRoleDisplay(role.name)}</span>
                            <span className="dr__roleId">{role.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="dr__tdDesc">{role.description || '-'}</td>
                      <td className="dr__tdScope">
                        <button
                          type="button"
                          className={`dr__scopePill ${usage.isSuperAdmin ? 'dr__scopePill--admin' : ''}`}
                          onClick={() => openDetailModal(role)}
                          title="Klik untuk melihat rincian halaman & fungsi role ini"
                        >
                          <i className={`bi ${usage.isSuperAdmin ? 'bi-shield-fill-check' : 'bi-diagram-3'}`}></i>
                          <span className="dr__scopeCount">
                            {usage.isSuperAdmin ? 'Semua Halaman (Full)' : `${usage.totalDetectedPages} Halaman`}
                          </span>
                          {!usage.isSuperAdmin && usage.primaryCategorySummary && (
                            <span className="dr__scopeCategory">{usage.primaryCategorySummary}</span>
                          )}
                        </button>
                      </td>
                      <td className="dr__tdCenter">
                        <span className="dr__userCount">{getUsersWithRole(role.name).length}</span>
                      </td>
                      <td className="dr__tdActions">
                        <ActionGroup>
                          <button
                            className="dr__btn dr__btn--sm dr__btn--info"
                            onClick={() => openDetailModal(role)}
                            title="Lihat Detail Halaman & Fungsi"
                          >
                            <i className="bi bi-info-circle"></i>
                          </button>
                          <button
                            className="dr__btn dr__btn--sm dr__btn--outline"
                            onClick={() => openUserRoleModal(role)}
                            title="Atur User"
                          >
                            <i className="bi bi-person-check"></i>
                          </button>
                          <ActionButton
                            action="edit"
                            onClick={() => openEditRoleModal(role)}
                          />
                          {role.name.toUpperCase() !== 'ADMIN' && (
                            <ActionButton
                              action="delete"
                              onClick={() => handleDeleteRole(role)}
                            />
                          )}
                        </ActionGroup>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dr__cardGrid">
          {roles
            .filter(r => r.name.toLowerCase().includes(searchRole.toLowerCase()))
            .map(role => {
              const usage = detectRoleUsage(
                role.name,
                rolePagesMap[role.name.toUpperCase()] || [],
                menuGroups,
                customLabels
              )
              return (
                <div className="dr__card" key={role.id}>
                  <div className="dr__cardTop">
                    <div className="dr__roleIcon"><i className="bi bi-shield-check"></i></div>
                    <div className="dr__roleInfo">
                      <span className="dr__roleName">{formatRoleDisplay(role.name)}</span>
                      <span className="dr__roleId">{role.name}</span>
                    </div>
                  </div>
                  <div className="dr__cardDesc">{role.description || '-'}</div>

                  {/* Scope pill on mobile */}
                  <div className="dr__cardScopeWrap">
                    <button
                      type="button"
                      className={`dr__scopePill dr__scopePill--full ${usage.isSuperAdmin ? 'dr__scopePill--admin' : ''}`}
                      onClick={() => openDetailModal(role)}
                    >
                      <i className={`bi ${usage.isSuperAdmin ? 'bi-shield-fill-check' : 'bi-diagram-3'}`}></i>
                      <span className="dr__scopeCount">
                        {usage.isSuperAdmin ? 'Semua Halaman (Full Superuser)' : `${usage.totalDetectedPages} Halaman Terhubung`}
                      </span>
                      <i className="bi bi-chevron-right" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}></i>
                    </button>
                  </div>

                  <div className="dr__cardFooter">
                    <div className="dr__userCountWrap">
                      <i className="bi bi-people-fill"></i>
                      <span>{getUsersWithRole(role.name).length} Users</span>
                    </div>
                    <ActionGroup>
                      <button
                        className="dr__btn dr__btn--sm dr__btn--info"
                        onClick={() => openDetailModal(role)}
                        title="Lihat Detail Halaman & Fungsi"
                      >
                        <i className="bi bi-info-circle"></i>
                      </button>
                      <button
                        className="dr__btn dr__btn--sm dr__btn--outline"
                        onClick={() => openUserRoleModal(role)}
                        title="Atur User"
                      >
                        <i className="bi bi-person-check"></i>
                      </button>
                      <ActionButton
                        action="edit"
                        onClick={() => openEditRoleModal(role)}
                      />
                      {role.name.toUpperCase() !== 'ADMIN' && (
                        <ActionButton
                          action="delete"
                          onClick={() => handleDeleteRole(role)}
                        />
                      )}
                    </ActionGroup>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Role Form Modal (Tambah / Edit Role) with Live Intelligence */}
      {showRoleModal && (
        <Modal size="lg" variant={editingRole ? "edit" : "add"} onClose={() => setShowRoleModal(false)} labelledBy="modal-role-title">
          <ModalHeader
            id="modal-role-title"
            title={editingRole ? `Edit Role: ${formatRoleDisplay(formData.name || 'Role')}` : 'Tambah Role Baru'}
            icon={editingRole ? "pencil-square" : "shield-check"}
            onClose={() => setShowRoleModal(false)}
          />
          <ModalBody>
            <div className="dr__modalGrid">
              <div className="dr__formSection">
                <div className="dr__formGroup">
                  <label>Nama Role <span className="dr__req">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: GURU, OP_IZIN, BK, KAMAD"
                    autoFocus
                  />
                </div>

                {!editingRole && !formData.name && (
                  <div className="dr__templatesSection">
                    <span className="dr__templateTitle"><i className="bi bi-lightning-charge-fill"></i> Template Cepat Role Sistem:</span>
                    <div className="dr__templateChips">
                      {SYSTEM_ROLE_TEMPLATES.slice(0, 10).map(t => (
                        <button
                          key={t.name}
                          type="button"
                          className="dr__templateChip"
                          onClick={() => applyTemplate(t)}
                          title={t.desc}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="dr__formGroup" style={{ marginTop: '12px' }}>
                  <label>Deskripsi Role (Opsional)</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Deskripsi tugas atau peruntukan role"
                  />
                </div>
              </div>

              {/* Live Intelligence Panel */}
              <div className="dr__intelPanel">
                <div className="dr__intelHeader">
                  <div className="dr__intelHeaderIcon"><i className="bi bi-cpu-fill"></i></div>
                  <div className="dr__intelHeaderInfo">
                    <h4>Deteksi Cerdas Penggunaan Halaman & Fungsi</h4>
                    <p>Sistem mendeteksi modul yang terhubung berdasarkan nama role.</p>
                  </div>
                </div>

                {formData.name.trim() ? (
                  <div className="dr__intelBody">
                    {/* Summary Header */}
                    <div className="dr__intelStats">
                      <div className="dr__intelStatItem">
                        <span className="dr__intelStatLabel">Total Halaman Terdeteksi</span>
                        <span className="dr__intelStatVal dr__intelStatVal--primary">
                          {liveFormAnalysis.isSuperAdmin ? 'Semua Halaman (Superuser)' : `${liveFormAnalysis.totalDetectedPages} Modul`}
                        </span>
                      </div>
                      <div className="dr__intelStatItem">
                        <span className="dr__intelStatLabel">Wewenang Tertinggi</span>
                        <span className={`dr__intelStatVal ${liveFormAnalysis.highestActionLevel === 'manage' ? 'dr__intelStatVal--manage' : ''}`}>
                          {formatActionLabel(liveFormAnalysis.highestActionLevel)}
                        </span>
                      </div>
                    </div>

                    {/* Detected Pages List */}
                    {liveFormAnalysis.groups.length > 0 ? (
                      <div className="dr__intelGroupsList">
                        {liveFormAnalysis.groups.map(group => (
                          <div key={group.key} className="dr__intelGroup">
                            <div className="dr__intelGroupTitle">
                              <i className={`fa-solid ${group.icon}`}></i>
                              <span>{group.label}</span>
                              <span className="dr__intelGroupBadge">{group.pages.length} Halaman</span>
                            </div>
                            <div className="dr__intelPagesGrid">
                              {group.pages.map(page => (
                                <div key={page.pageId} className="dr__intelPageCard">
                                  <div className="dr__intelPageTop">
                                    <span className="dr__intelPageName">{page.title}</span>
                                    <span className={getActionBadgeClass(page.actionLevel)}>{page.actionLabel}</span>
                                  </div>
                                  <p className="dr__intelPageDesc">{page.functionDescription}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="dr__intelEmpty">
                        <i className="bi bi-info-circle"></i>
                        <span>Role kustom baru: Tidak ada modul bawaan yang otomatis terkunci. Anda dapat leluasa mengatur akses menu di tab <b>&quot;Akses per Role&quot;</b> setelah role ini dibuat.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="dr__intelEmpty">
                    <i className="bi bi-cursor-text"></i>
                    <span>Ketik nama role atau klik salah satu template cepat di atas untuk melihat simulasi deteksi halaman dan fungsi secara otomatis.</span>
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="cancel" onClick={() => setShowRoleModal(false)}>Batal</Button>
            <Button variant="primary" onClick={handleSaveRole} isLoading={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Role'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Detail Scope & Functions Modal - Clean Dropdown Filter Layout */}
      {showDetailModal && selectedRoleForDetail && detailRoleAnalysis && (
        <Modal size="lg" onClose={() => setShowDetailModal(false)} labelledBy="modal-detail-scope-title">
          <ModalHeader
            id="modal-detail-scope-title"
            title={`Cakupan Halaman & Fungsi: ${formatRoleDisplay(selectedRoleForDetail.name)}`}
            icon="diagram-3"
            onClose={() => setShowDetailModal(false)}
          />
          <ModalBody>
            <div className="dr__detailModalContent">
              {/* Role Hero Card */}
              <div className="dr__detailHero">
                <div className="dr__heroLeft">
                  <div className="dr__heroIcon">
                    <i className="bi bi-shield-check"></i>
                  </div>
                  <div className="dr__heroTitleInfo">
                    <div className="dr__heroNameRow">
                      <h3 className="dr__heroRoleName">{formatRoleDisplay(selectedRoleForDetail.name)}</h3>
                      <span className="dr__heroRoleId">{selectedRoleForDetail.name}</span>
                    </div>
                    <p className="dr__heroRoleDesc">
                      {selectedRoleForDetail.description || 'Role fungsional dalam sistem ACCA.'}
                    </p>
                  </div>
                </div>

                <div className="dr__heroStats">
                  <div className="dr__statCard">
                    <div className="dr__statCardIcon"><i className="bi bi-layers-fill"></i></div>
                    <div className="dr__statCardData">
                      <span className="dr__statCardVal">
                        {detailRoleAnalysis.isSuperAdmin ? 'Semua' : detailRoleAnalysis.totalDetectedPages}
                      </span>
                      <span className="dr__statCardLbl">Halaman Terhubung</span>
                    </div>
                  </div>
                  <div className="dr__statCard">
                    <div className="dr__statCardIcon dr__statCardIcon--users"><i className="bi bi-people-fill"></i></div>
                    <div className="dr__statCardData">
                      <span className="dr__statCardVal">{getUsersWithRole(selectedRoleForDetail.name).length}</span>
                      <span className="dr__statCardLbl">User Aktif</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special Note if any */}
              {detailRoleAnalysis.specialNotes && detailRoleAnalysis.specialNotes.length > 0 && (
                <div className="dr__detailNotice">
                  <i className="bi bi-info-circle-fill"></i>
                  <span>{detailRoleAnalysis.specialNotes[0]}</span>
                </div>
              )}

              {/* Elegant Filter & Search Toolbar (No ugly horizontal tab scrolling) */}
              <div className="dr__detailControlBar">
                {/* Category Dropdown Filter */}
                <div className="dr__detailCategorySelectWrap">
                  <i className="bi bi-funnel dr__detailSelectIcon"></i>
                  <select
                    className="dr__detailSelect"
                    value={detailCategory}
                    onChange={(e) => setDetailCategory(e.target.value)}
                  >
                    <option value="ALL">
                      Semua Kategori ({detailRoleAnalysis.totalDetectedPages} Modul)
                    </option>
                    {detailRoleAnalysis.groups.map(group => (
                      <option key={group.key} value={group.key}>
                        {group.label} ({group.pages.length} Halaman)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Box */}
                <div className="dr__detailSearchBox">
                  <i className="bi bi-search"></i>
                  <input
                    type="text"
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Cari modul atau fungsi..."
                  />
                  {detailSearch && (
                    <button
                      type="button"
                      className="dr__detailSearchClear"
                      onClick={() => setDetailSearch('')}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>

                {/* Collapse / Expand Toggle Buttons */}
                <div className="dr__detailCollapseControls">
                  <button
                    type="button"
                    className="dr__btnMiniToggle"
                    onClick={() => toggleAllGroupsCollapse(false)}
                    title="Buka semua grup modul"
                  >
                    <i className="bi bi-arrows-expand"></i> Buka Semua
                  </button>
                  <button
                    type="button"
                    className="dr__btnMiniToggle"
                    onClick={() => toggleAllGroupsCollapse(true)}
                    title="Tutup semua grup modul"
                  >
                    <i className="bi bi-arrows-collapse"></i> Tutup Semua
                  </button>
                </div>
              </div>

              {/* Groups & Pages Accordion */}
              <div className="dr__detailScrollArea">
                {filteredDetailGroups.length > 0 ? (
                  <div className="dr__detailGroupsContainer">
                    {filteredDetailGroups.map(group => {
                      const isCollapsed = Boolean(collapsedGroups[group.key])
                      return (
                        <div key={group.key} className={`dr__groupAccordion ${isCollapsed ? 'is-collapsed' : ''}`}>
                          <div
                            className="dr__groupHeaderBtn"
                            onClick={() => toggleGroupCollapse(group.key)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="dr__groupHeaderTitle">
                              <div className="dr__groupHeaderIcon">
                                <i className={`fa-solid ${group.icon}`}></i>
                              </div>
                              <span className="dr__groupHeaderLabel">{group.label}</span>
                              <span className="dr__groupPageBadge">{group.pages.length} Halaman</span>
                            </div>
                            <div className="dr__groupHeaderChevron">
                              <i className={`bi ${isCollapsed ? 'bi-chevron-down' : 'bi-chevron-up'}`}></i>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="dr__groupPagesList">
                              {group.pages.map(page => (
                                <div key={page.pageId} className="dr__pageItemCard">
                                  <div className="dr__pageItemMain">
                                    <div className="dr__pageItemHeader">
                                      <div className="dr__pageItemTitleWrap">
                                        <span className="dr__pageItemTitle">{page.title}</span>
                                        <span className="dr__pageItemIdCode">{page.pageId}</span>
                                      </div>
                                      <div className="dr__pageItemBadges">
                                        {page.isMenuAssigned && (
                                          <span className="dr__menuTag" title="Halaman ini aktif di menu sidebar pengguna">
                                            <i className="bi bi-check2"></i> Menu Aktif
                                          </span>
                                        )}
                                        <span className={getActionBadgeClass(page.actionLevel)}>
                                          {page.actionLabel}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="dr__pageItemDescBox">
                                      <p className="dr__pageItemDesc">{page.functionDescription}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="dr__intelEmpty">
                    <i className="bi bi-search"></i>
                    <span>
                      {detailSearch
                        ? `Tidak ditemukan halaman yang cocok dengan pencarian "${detailSearch}".`
                        : 'Role ini belum memiliki pemetaan halaman aktif.'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="dr__detailFooterWrap">
              <Link
                href="/pengaturan-users?tab=role_pages"
                className="dr__footerActionLink"
              >
                <i className="bi bi-sliders"></i>
                <span>Atur Menu di &apos;Akses per Role&apos;</span>
              </Link>
              <Button variant="primary" onClick={() => setShowDetailModal(false)}>
                Tutup
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* User Role Modal */}
      {showUserRoleModal && selectedRoleForUsers && (
        <Modal size="lg" onClose={() => setShowUserRoleModal(false)} labelledBy="modal-user-role-title">
          <ModalHeader
            id="modal-user-role-title"
            title={`User dengan role "${formatRoleDisplay(selectedRoleForUsers.name)}"`}
            icon="person-check-fill"
            onClose={() => setShowUserRoleModal(false)}
          />
          <ModalBody>
            {/* Filters */}
            <div className="dr__filters">
              <div className="dr__searchBox">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  placeholder="Cari user..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
              <select
                className="dr__select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">Semua Role</option>
                {roles.map(r => (
                  <option key={r.id} value={r.name}>{formatRoleDisplay(r.name)}</option>
                ))}
              </select>
            </div>

            {/* Users with role */}
            <div className="dr__userSection">
              <div className="dr__userSectionTitle">
                <i className="bi bi-check-circle-fill"></i> Memiliki Role ({getUsersWithRole(selectedRoleForUsers.name).length})
              </div>
              <div className="dr__userList">
                {getUsersWithRole(selectedRoleForUsers.name)
                  .filter(u => {
                    if (searchUser) {
                      const q = searchUser.toLowerCase()
                      return u.nama?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
                    }
                    return true
                  })
                  .filter(u => !roleFilter || (u.roles || []).includes(roleFilter))
                  .map(user => (
                    <div key={user.id} className="dr__userItem dr__userItem--has">
                      <div className="dr__userAvatar"><i className="bi bi-person-fill"></i></div>
                      <div className="dr__userInfo">
                        <span className="dr__userName">{user.nama}</span>
                        <span className="dr__userMeta">@{user.username}</span>
                      </div>
                      <button
                        className="dr__btn dr__btn--xs dr__btn--danger"
                        onClick={() => toggleUserRole(user, selectedRoleForUsers.name, true)}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ))}
                {getUsersWithRole(selectedRoleForUsers.name).filter(u => {
                  if (searchUser) {
                    const q = searchUser.toLowerCase()
                    return u.nama?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
                  }
                  return true
                }).filter(u => !roleFilter || (u.roles || []).includes(roleFilter)).length === 0 && (
                  <div className="dr__userEmpty">Tidak ada user</div>
                )}
              </div>
            </div>

            {/* Users without role */}
            <div className="dr__userSection" style={{ marginTop: '14px' }}>
              <div className="dr__userSectionTitle">
                <i className="bi bi-plus-circle"></i> Tambahkan User ({getUsersWithoutRole(selectedRoleForUsers.name).length})
              </div>
              <div className="dr__userList">
                {getUsersWithoutRole(selectedRoleForUsers.name)
                  .filter(u => {
                    if (searchUser) {
                      const q = searchUser.toLowerCase()
                      return u.nama?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
                    }
                    return true
                  })
                  .filter(u => !roleFilter || (u.roles || []).includes(roleFilter))
                  .map(user => (
                    <div key={user.id} className="dr__userItem dr__userItem--add">
                      <div className="dr__userAvatar"><i className="bi bi-person"></i></div>
                      <div className="dr__userInfo">
                        <span className="dr__userName">{user.nama}</span>
                        <span className="dr__userMeta">@{user.username}</span>
                      </div>
                      <button
                        className="dr__btn dr__btn--xs dr__btn--primary"
                        onClick={() => toggleUserRole(user, selectedRoleForUsers.name, false)}
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>
                  ))}
                {getUsersWithoutRole(selectedRoleForUsers.name).filter(u => {
                  if (searchUser) {
                    const q = searchUser.toLowerCase()
                    return u.nama?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
                  }
                  return true
                }).filter(u => !roleFilter || (u.roles || []).includes(roleFilter)).length === 0 && (
                  <div className="dr__userEmpty">Tidak ada user yang dapat ditambahkan</div>
                )}
              </div>
            </div>
          </ModalBody>
        </Modal>
      )}

      <style>{`
        /* =========================================================
           BASE & COMPONENT STYLES
           ========================================================= */
        .dr { padding: 0; display: flex; flex-direction: column; gap: 16px; font-family: inherit; }
        .dr__loading { display: flex; align-items: center; justify-content: center; padding: 60px; color: var(--n-muted, #64748b); }
        
        .dr__toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 14px 18px; background: var(--n-card, #ffffff); border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 16px; flex-wrap: wrap;
        }
        
        .dr__btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 9px 16px; border-radius: 10px; border: none; font-size: 0.85rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .dr__btn--primary {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%); color: #ffffff;
          box-shadow: 0 4px 14px rgba(29, 107, 243, 0.25);
        }
        .dr__btn--primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(29, 107, 243, 0.35); }
        .dr__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .dr__btn--ghost { background: var(--n-soft, #f8fafc); color: var(--n-muted, #64748b); border: 1px solid var(--n-border, #e2e8f0); }
        .dr__btn--ghost:hover { background: var(--n-card, #ffffff); color: var(--n-text, #0f172a); }
        .dr__btn--outline {
          background: var(--n-card, #ffffff); border: 1.5px solid var(--n-border, #e2e8f0);
          color: var(--n-muted, #64748b); width: 34px; height: 34px; border-radius: 9px;
        }
        .dr__btn--outline:hover { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
        .dr__btn--info {
          background: rgba(2, 132, 199, 0.08); border: 1.5px solid rgba(2, 132, 199, 0.25);
          color: #0284c7; width: 34px; height: 34px; border-radius: 9px;
        }
        .dr__btn--info:hover { background: #0284c7; color: #ffffff; border-color: #0284c7; }
        .dr__btn--sm { padding: 6px 10px; font-size: 0.8rem; }
        .dr__btn--xs { padding: 4px 8px; font-size: 0.72rem; border-radius: 6px; }
        .dr__btn--danger { background: rgba(239, 68, 68, 0.08); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); }
        .dr__btn--danger:hover { background: #dc2626; color: #ffffff; }

        /* Table styles */
        .dr__tableWrapper {
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
        }
        .dr__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          text-align: left;
        }
        .dr__table th {
          padding: 14px 18px;
          background: var(--n-soft, #f8fafc);
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--n-muted, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1.5px solid var(--n-border, #e2e8f0);
        }
        .dr__table td {
          padding: 14px 18px;
          border-bottom: 1px solid var(--n-border, #e2e8f0);
          vertical-align: middle;
          color: var(--n-text, #0f172a);
        }
        .dr__table tr:last-child td { border-bottom: none; }
        .dr__table tbody tr:hover td { background: var(--n-soft, #f8fafc); }

        .dr__roleCell { display: flex; align-items: center; gap: 12px; }
        .dr__roleIcon {
          width: 40px; height: 40px; border-radius: 12px;
          background: rgba(29, 107, 243, 0.09); color: #1d6bf3;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.15rem; flex-shrink: 0;
        }
        .dr__roleInfo { display: flex; flex-direction: column; gap: 2px; }
        .dr__roleName { font-weight: 700; font-size: 0.92rem; color: var(--n-text, #0f172a); }
        .dr__roleId {
          font-size: 0.72rem; font-weight: 600; color: var(--n-muted, #64748b);
          font-family: monospace; letter-spacing: 0.03em;
        }
        .dr__tdDesc { color: var(--n-muted, #64748b); font-size: 0.85rem; max-width: 240px; }
        .dr__tdScope { vertical-align: middle; }
        .dr__tdCenter { text-align: center; }
        .dr__tdActions { text-align: right; }
        .dr__thActions { text-align: right !important; }
        
        .dr__userCount {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px 12px; border-radius: 20px;
          background: rgba(29, 107, 243, 0.09); color: #1d6bf3;
          font-weight: 800; font-size: 0.8rem;
        }

        /* Scope Pill Badges */
        .dr__scopePill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px; border-radius: 10px;
          background: rgba(29, 107, 243, 0.07);
          border: 1px solid rgba(29, 107, 243, 0.22);
          color: #1d6bf3; cursor: pointer; transition: all 0.2s ease;
          text-align: left; font-size: 0.8rem; font-weight: 700;
        }
        .dr__scopePill:hover {
          background: rgba(29, 107, 243, 0.14); border-color: #3b82f6; transform: translateY(-1px);
        }
        .dr__scopePill--admin {
          background: rgba(16, 185, 129, 0.09);
          border-color: rgba(16, 185, 129, 0.25); color: #059669;
        }
        .dr__scopePill--admin:hover {
          background: rgba(16, 185, 129, 0.16); border-color: #10b981;
        }
        .dr__scopePill--full { width: 100%; justify-content: flex-start; padding: 9px 12px; }
        .dr__scopeCount { font-weight: 800; white-space: nowrap; }
        .dr__scopeCategory {
          font-size: 0.72rem; font-weight: 600; color: var(--n-muted, #64748b);
          border-left: 1px solid rgba(148, 163, 184, 0.4); padding-left: 8px;
          max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* Action Level Badges */
        .dr__actBadge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 9px; border-radius: 6px; font-size: 0.72rem;
          font-weight: 800; letter-spacing: 0.02em; white-space: nowrap;
        }
        .dr__actBadge--manage {
          background: rgba(220, 38, 38, 0.09); color: #dc2626;
          border: 1px solid rgba(220, 38, 38, 0.22);
        }
        .dr__actBadge--edit {
          background: rgba(29, 107, 243, 0.09); color: #1d6bf3;
          border: 1px solid rgba(29, 107, 243, 0.22);
        }
        .dr__actBadge--view {
          background: rgba(100, 116, 139, 0.09); color: #475569;
          border: 1px solid rgba(100, 116, 139, 0.22);
        }

        /* Mobile Card Grid */
        .dr__cardGrid { display: flex; flex-direction: column; gap: 12px; }
        .dr__card {
          background: var(--n-card, #ffffff); border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
        }
        .dr__cardTop { display: flex; align-items: center; gap: 12px; }
        .dr__cardDesc { font-size: 0.85rem; color: var(--n-muted, #64748b); }
        .dr__cardScopeWrap { margin-top: -2px; }
        .dr__cardFooter {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding-top: 10px; border-top: 1px solid var(--n-border, #e2e8f0);
        }
        .dr__userCountWrap { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 700; color: #1d6bf3; }

        /* Form Modal & Live Intelligence Grid */
        .dr__modalGrid { display: flex; flex-direction: column; gap: 18px; }
        .dr__formGroup { display: flex; flex-direction: column; gap: 6px; }
        .dr__formGroup label { font-size: 0.8rem; font-weight: 700; color: var(--n-muted, #64748b); text-transform: uppercase; letter-spacing: 0.04em; }
        .dr__req { color: #ef4444; margin-left: 2px; }
        .dr__formGroup input {
          padding: 11px 14px; border: 1.5px solid var(--n-border, #e2e8f0);
          border-radius: 10px; font-size: 0.9rem; outline: none;
          transition: border-color 0.2s; color: var(--n-text, #0f172a);
          background: var(--n-soft, #f8fafc);
        }
        .dr__formGroup input:focus { border-color: #3b82f6; background: var(--n-card, #ffffff); }
        
        .dr__templatesSection { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
        .dr__templateTitle { font-size: 0.75rem; font-weight: 700; color: #d97706; display: flex; align-items: center; gap: 5px; }
        .dr__templateChips { display: flex; flex-wrap: wrap; gap: 6px; }
        .dr__templateChip {
          padding: 4px 9px; border-radius: 6px; background: rgba(217, 119, 6, 0.08);
          border: 1px solid rgba(217, 119, 6, 0.22); color: #b45309;
          font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease;
        }
        .dr__templateChip:hover { background: #d97706; color: #ffffff; border-color: #d97706; }

        /* Intelligence Live Panel in Form */
        .dr__intelPanel {
          border: 1.5px solid rgba(29, 107, 243, 0.2);
          border-radius: 14px; background: rgba(29, 107, 243, 0.02);
          padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;
        }
        .dr__intelHeader { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px dashed var(--n-border, #e2e8f0); }
        .dr__intelHeaderIcon {
          width: 32px; height: 32px; border-radius: 8px; background: rgba(29, 107, 243, 0.12);
          color: #1d6bf3; display: flex; align-items: center; justify-content: center;
          font-size: 1.05rem; flex-shrink: 0;
        }
        .dr__intelHeaderInfo h4 { margin: 0; font-size: 0.86rem; font-weight: 800; color: var(--n-text, #0f172a); }
        .dr__intelHeaderInfo p { margin: 2px 0 0; font-size: 0.75rem; color: var(--n-muted, #64748b); }
        
        .dr__intelStats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .dr__intelStatItem {
          background: var(--n-card, #ffffff); border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 10px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px;
        }
        .dr__intelStatLabel { font-size: 0.68rem; font-weight: 700; color: var(--n-muted, #64748b); text-transform: uppercase; }
        .dr__intelStatVal { font-size: 0.85rem; font-weight: 800; color: var(--n-text, #0f172a); }
        .dr__intelStatVal--primary { color: #1d6bf3; }
        .dr__intelStatVal--manage { color: #dc2626; }

        .dr__intelGroupsList { display: flex; flex-direction: column; gap: 10px; max-height: 240px; overflow-y: auto; padding-right: 4px; }
        .dr__intelGroup { background: var(--n-card, #ffffff); border: 1px solid var(--n-border, #e2e8f0); border-radius: 10px; overflow: hidden; }
        .dr__intelGroupTitle {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          background: var(--n-soft, #f8fafc); font-size: 0.78rem; font-weight: 700;
          color: var(--n-text, #0f172a); border-bottom: 1px solid var(--n-border, #e2e8f0);
        }
        .dr__intelGroupTitle i { color: #1d6bf3; font-size: 0.75rem; }
        .dr__intelGroupBadge {
          margin-left: auto; font-size: 0.68rem; padding: 2px 6px;
          background: rgba(0,0,0,0.05); border-radius: 4px; color: var(--n-muted, #64748b);
        }
        .dr__intelPagesGrid { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .dr__intelPageCard {
          padding: 8px 10px; background: var(--n-soft, #f8fafc); border-radius: 8px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .dr__intelPageTop { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .dr__intelPageName { font-size: 0.82rem; font-weight: 700; color: var(--n-text, #0f172a); }
        .dr__intelPageDesc { margin: 0; font-size: 0.74rem; color: var(--n-muted, #64748b); line-height: 1.35; }
        .dr__intelEmpty {
          display: flex; align-items: center; gap: 10px; padding: 12px 14px;
          background: var(--n-soft, #f8fafc); border-radius: 10px;
          color: var(--n-muted, #64748b); font-size: 0.8rem; line-height: 1.4;
        }
        .dr__intelEmpty i { font-size: 1.1rem; color: #3b82f6; flex-shrink: 0; }

        /* =========================================================
           POLISHED DETAIL MODAL (FILTER DROPDOWN LAYOUT)
           ========================================================= */
        .dr__detailModalContent { display: flex; flex-direction: column; gap: 14px; }
        
        /* Hero Banner */
        .dr__detailHero {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 16px 20px; background: #f8fafc;
          border: 1.5px solid #e2e8f0; border-radius: 16px; flex-wrap: wrap;
        }
        .dr__heroLeft { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 220px; }
        .dr__heroIcon {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, rgba(29, 107, 243, 0.15) 0%, rgba(29, 107, 243, 0.05) 100%);
          color: #1d6bf3; border: 1.5px solid rgba(29, 107, 243, 0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; flex-shrink: 0;
        }
        .dr__heroTitleInfo { display: flex; flex-direction: column; gap: 3px; }
        .dr__heroNameRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .dr__heroRoleName { margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; }
        .dr__heroRoleId {
          font-size: 0.72rem; font-weight: 700; color: #475569;
          font-family: monospace; background: #e2e8f0;
          padding: 2px 8px; border-radius: 6px;
        }
        .dr__heroRoleDesc { margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.35; }
        
        .dr__heroStats { display: flex; gap: 10px; }
        .dr__statCard {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; background: #ffffff;
          border: 1.5px solid #e2e8f0; border-radius: 12px; min-width: 130px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }
        .dr__statCardIcon {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(29, 107, 243, 0.1); color: #1d6bf3;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem; flex-shrink: 0;
        }
        .dr__statCardIcon--users { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .dr__statCardData { display: flex; flex-direction: column; }
        .dr__statCardVal { font-size: 1.1rem; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .dr__statCardLbl { font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px; }

        /* Notice Banner */
        .dr__detailNotice {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 10px;
          font-size: 0.82rem; color: #1e40af; line-height: 1.4;
        }

        /* Elegant Control Bar (Category Dropdown + Search + Collapse controls) */
        .dr__detailControlBar {
          display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
        }
        
        /* Category Select Dropdown */
        .dr__detailCategorySelectWrap {
          position: relative; display: flex; align-items: center;
          min-width: 210px; flex: 1; max-width: 280px;
        }
        .dr__detailSelectIcon {
          position: absolute; left: 12px; color: #64748b; font-size: 0.95rem; pointer-events: none;
        }
        .dr__detailSelect {
          width: 100%; height: 38px; padding: 0 12px 0 34px; box-sizing: border-box;
          background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px;
          font-size: 0.82rem; font-weight: 700; color: #0f172a; outline: none;
          cursor: pointer; transition: all 0.2s ease;
        }
        .dr__detailSelect:focus { border-color: #3b82f6; background: #ffffff; }

        .dr__detailSearchBox {
          flex: 2; min-width: 180px; display: flex; align-items: center; gap: 8px;
          height: 38px; padding: 0 12px; background: #f8fafc;
          border: 1.5px solid #cbd5e1; border-radius: 10px;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .dr__detailSearchBox:focus-within { border-color: #3b82f6; background: #ffffff; }
        .dr__detailSearchBox i { color: #94a3b8; font-size: 0.85rem; }
        .dr__detailSearchBox input {
          flex: 1; border: none !important; background: transparent !important;
          font-size: 0.82rem; outline: none !important; color: #0f172a; min-width: 0;
        }
        .dr__detailSearchClear {
          background: none; border: none; color: #94a3b8; cursor: pointer;
          padding: 0; display: flex; align-items: center; font-size: 0.95rem;
        }
        .dr__detailSearchClear:hover { color: #dc2626; }

        .dr__detailCollapseControls { display: flex; gap: 6px; flex-shrink: 0; }
        .dr__btnMiniToggle {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1;
          background: #f8fafc; color: #475569; font-size: 0.74rem; font-weight: 700;
          cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
        }
        .dr__btnMiniToggle:hover { background: #e2e8f0; color: #0f172a; border-color: #94a3b8; }

        /* Scroll Area for Groups & Pages */
        .dr__detailScrollArea {
          max-height: 440px; overflow-y: auto; padding-right: 4px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .dr__detailGroupsContainer { display: flex; flex-direction: column; gap: 10px; }

        /* Group Accordion Card */
        .dr__groupAccordion {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .dr__groupAccordion:hover { border-color: #cbd5e1; }
        
        .dr__groupHeaderBtn {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 16px; background: #f8fafc;
          cursor: pointer; user-select: none; transition: background 0.15s ease;
          border-bottom: 1.5px solid #e2e8f0;
        }
        .dr__groupAccordion.is-collapsed .dr__groupHeaderBtn { border-bottom: none; }
        .dr__groupHeaderBtn:hover { background: #f1f5f9; }
        
        .dr__groupHeaderTitle { display: flex; align-items: center; gap: 10px; }
        .dr__groupHeaderIcon {
          width: 28px; height: 28px; border-radius: 7px;
          background: rgba(29, 107, 243, 0.1); color: #1d6bf3;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.82rem; flex-shrink: 0;
        }
        .dr__groupHeaderLabel { font-size: 0.86rem; font-weight: 800; color: #0f172a; }
        .dr__groupPageBadge {
          font-size: 0.7rem; font-weight: 700; color: #64748b;
          background: #e2e8f0; padding: 2px 8px; border-radius: 6px;
        }
        .dr__groupHeaderChevron { color: #64748b; font-size: 0.85rem; }

        /* Page Items in Group */
        .dr__groupPagesList { display: flex; flex-direction: column; background: #ffffff; }
        
        .dr__pageItemCard {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s ease;
        }
        .dr__pageItemCard:last-child { border-bottom: none; }
        .dr__pageItemCard:hover { background: #f8fafc; }

        .dr__pageItemMain { display: flex; flex-direction: column; gap: 6px; }
        .dr__pageItemHeader {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
        }
        .dr__pageItemTitleWrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .dr__pageItemTitle { font-size: 0.88rem; font-weight: 800; color: #0f172a; }
        .dr__pageItemIdCode {
          font-size: 0.7rem; font-family: monospace; font-weight: 600;
          color: #64748b; background: #f1f5f9;
          padding: 1px 6px; border-radius: 4px;
        }
        
        .dr__pageItemBadges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .dr__menuTag {
          font-size: 0.68rem; font-weight: 700; color: #059669;
          background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 3px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 3px;
        }

        .dr__pageItemDescBox {
          background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px;
          padding: 7px 10px; margin-top: 2px;
        }
        .dr__pageItemDesc {
          margin: 0; font-size: 0.79rem; color: #475569; line-height: 1.45;
        }

        /* Detail Modal Footer */
        .dr__detailFooterWrap {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; gap: 12px; flex-wrap: wrap;
        }
        .dr__footerActionLink {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 9px;
          background: #f8fafc; border: 1.5px solid #cbd5e1;
          color: #1e40af; font-size: 0.82rem; font-weight: 700;
          text-decoration: none; transition: all 0.2s ease;
        }
        .dr__footerActionLink:hover {
          background: #eff6ff; border-color: #3b82f6; color: #1d6bf3;
        }

        /* =========================================================
           DARK MODE STANDARD (PITCH BLACK & ELECTRIC BLUE)
           ========================================================= */
         :global(.dark) .dr__toolbar,
        :global(.dark) .dr__tableWrapper,
        :global(.dark) .dr__card {
          background: #0b1329 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
        }

        :global(.dark) .dr__table th {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.18), rgba(0, 40, 122, 0.3)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.45) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .dr__table td {
          background: #0b1329 !important;
          border-bottom: 1px solid rgba(26, 115, 232, 0.2) !important;
          color: #cbd5e1 !important;
        }
        :global(.dark) .dr__table tbody tr:hover td {
          background: rgba(26, 115, 232, 0.08) !important;
        }

        :global(.dark) .dr__formGroup input,
        :global(.dark) .dr__searchBox,
        :global(.dark) .dr__select {
          background: #0b1329 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 12px !important;
          color: #e2e8f0 !important;
        }

        /* Detail Modal Dark Mode */
        :global(.dark) .dr__detailHero {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.12) 0%, rgba(11, 19, 41, 0.9) 100%) !important;
          border: 1.8px solid rgba(26, 115, 232, 0.6) !important;
        }
        :global(.dark) .dr__heroIcon {
          background: rgba(26, 115, 232, 0.2) !important;
          border-color: rgba(59, 130, 246, 0.5) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .dr__heroRoleName,
        :global(.dark) .dr__statCardVal,
        :global(.dark) .dr__groupHeaderLabel,
        :global(.dark) .dr__pageItemTitle,
        :global(.dark) .dr__roleName {
          color: #f1f5f9 !important;
        }
        :global(.dark) .dr__heroRoleId {
          background: rgba(26, 115, 232, 0.25) !important;
          color: #93c5fd !important;
        }
        :global(.dark) .dr__heroRoleDesc,
        :global(.dark) .dr__tdDesc,
        :global(.dark) .dr__roleId {
          color: #94a3b8 !important;
        }
        
        :global(.dark) .dr__statCard {
          background: #0b1329 !important;
          border: 1px solid rgba(37, 99, 235, 0.4) !important;
        }
        :global(.dark) .dr__statCardLbl {
          color: #94a3b8 !important;
        }

        :global(.dark) .dr__detailNotice {
          background: rgba(26, 115, 232, 0.15) !important;
          border-color: rgba(26, 115, 232, 0.45) !important;
          color: #93c5fd !important;
        }

        :global(.dark) .dr__detailCategorySelectWrap .dr__detailSelect,
        :global(.dark) .dr__detailSearchBox {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.5) !important;
          color: #f1f5f9 !important;
        }
        :global(.dark) .dr__detailSearchBox input {
          color: #f1f5f9 !important;
        }
        :global(.dark) .dr__detailSelectIcon {
          color: #60a5fa !important;
        }
        :global(.dark) .dr__btnMiniToggle {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #93c5fd !important;
        }
        :global(.dark) .dr__btnMiniToggle:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__groupAccordion {
          background: #0b1329 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.45) !important;
        }
        :global(.dark) .dr__groupHeaderBtn {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.16) 0%, rgba(0, 30, 90, 0.25) 100%) !important;
          border-bottom-color: rgba(26, 115, 232, 0.35) !important;
        }
        :global(.dark) .dr__groupHeaderBtn:hover {
          background: rgba(26, 115, 232, 0.25) !important;
        }
        :global(.dark) .dr__groupHeaderIcon {
          background: rgba(26, 115, 232, 0.25) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .dr__groupPageBadge {
          background: rgba(26, 115, 232, 0.25) !important;
          color: #93c5fd !important;
        }
        :global(.dark) .dr__groupHeaderChevron {
          color: #93c5fd !important;
        }

        :global(.dark) .dr__groupPagesList {
          background: #0b1329 !important;
        }
        :global(.dark) .dr__pageItemCard {
          border-bottom-color: rgba(26, 115, 232, 0.18) !important;
        }
        :global(.dark) .dr__pageItemCard:hover {
          background: rgba(26, 115, 232, 0.08) !important;
        }
        :global(.dark) .dr__pageItemIdCode {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #93c5fd !important;
        }
        :global(.dark) .dr__pageItemDescBox {
          background: rgba(26, 115, 232, 0.06) !important;
          border-color: rgba(26, 115, 232, 0.2) !important;
        }
        :global(.dark) .dr__pageItemDesc {
          color: #cbd5e1 !important;
        }

        :global(.dark) .dr__footerActionLink {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.5) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .dr__footerActionLink:hover {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__intelPanel {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.5) !important;
        }
        :global(.dark) .dr__intelStatItem,
        :global(.dark) .dr__intelGroup,
        :global(.dark) .dr__intelPageCard,
        :global(.dark) .dr__intelEmpty {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.35) !important;
        }
        :global(.dark) .dr__intelGroupTitle {
          background: rgba(26, 115, 232, 0.15) !important;
          border-bottom-color: rgba(26, 115, 232, 0.35) !important;
          color: #f1f5f9 !important;
        }
        :global(.dark) .dr__intelPageName { color: #f1f5f9 !important; }
        :global(.dark) .dr__intelPageDesc { color: #94a3b8 !important; }
        :global(.dark) .dr__intelHeaderInfo h4 { color: #f1f5f9 !important; }

        :global(.dark) .dr__scopePill {
          background: rgba(26, 115, 232, 0.15) !important;
          border-color: rgba(59, 130, 246, 0.5) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .dr__scopePill:hover {
          background: rgba(26, 115, 232, 0.3) !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__btn--outline {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .dr__btn--info {
          background: rgba(2, 132, 199, 0.18) !important;
          border-color: rgba(2, 132, 199, 0.4) !important;
          color: #38bdf8 !important;
        }
        :global(.dark) .dr__btn--info:hover {
          background: #0284c7 !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__userItem {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
        }
        :global(.dark) .dr__userItem--has .dr__userAvatar {
          background: rgba(34, 211, 238, 0.18) !important;
          color: #22d3ee !important;
          border: 1px solid rgba(34, 211, 238, 0.4) !important;
        }
        :global(.dark) .dr__userItem--add .dr__userAvatar {
          background: rgba(26, 115, 232, 0.2) !important;
          color: #60a5fa !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .dr__toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
          .dr__toolbar .dr__btn { width: 100%; justify-content: center; }
          .dr__detailHero { flex-direction: column; align-items: flex-start; gap: 12px; }
          .dr__heroStats { width: 100%; justify-content: space-between; }
          .dr__statCard { flex: 1; min-width: 0; }
          .dr__detailControlBar { flex-direction: column; align-items: stretch; }
          .dr__detailCategorySelectWrap { max-width: 100%; width: 100%; }
          .dr__detailCollapseControls { justify-content: flex-end; }
          .dr__pageItemHeader { flex-direction: column; align-items: flex-start; gap: 6px; }
          .dr__detailFooterWrap { flex-direction: column; align-items: stretch; }
          .dr__detailFooterWrap .dr__footerActionLink { justify-content: center; width: 100%; }
        }
      `}</style>
    </div>
  )
}
