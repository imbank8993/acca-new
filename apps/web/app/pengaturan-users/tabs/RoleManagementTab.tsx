'use client'

import { useState, useEffect, useMemo } from 'react'
import { PageLoader } from '@/components/ui/Spinner'
import { formatRoleDisplay } from '@/lib/auth'
import Swal from 'sweetalert2'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { FilterToolbar, FilterSearch, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { ActionButton, ActionGroup } from '@/components/ui/ActionButtons'
import { SYSTEM_ROLE_TEMPLATES } from '@/lib/role-intelligence'

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

const getInitials = (name?: string) => {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function RoleManagementTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Search in role list
  const [searchRole, setSearchRole] = useState('')

  // Add / Edit Role Modal
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

  // User Role Modal
  const [showUserRoleModal, setShowUserRoleModal] = useState(false)
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null)
  const [userModalTab, setUserModalTab] = useState<'assigned' | 'unassigned'>('assigned')
  const [searchUser, setSearchUser] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // Modal blur
  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showRoleModal || showUserRoleModal) return registerModal()
  }, [showRoleModal, showUserRoleModal, registerModal])

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

  // User role helpers
  const getUsersWithRole = (roleName: string) => {
    const roleUpper = roleName.toUpperCase()
    return users.filter(u =>
      (u.roles || []).some(r => r.toUpperCase() === roleUpper) ||
      (u.role && u.role.toUpperCase() === roleUpper)
    )
  }

  const getUsersWithoutRole = (roleName: string) => {
    const roleUpper = roleName.toUpperCase()
    return users.filter(u =>
      !(u.roles || []).some(r => r.toUpperCase() === roleUpper) &&
      (!u.role || u.role.toUpperCase() !== roleUpper)
    )
  }

  const openUserRoleModal = (role: Role) => {
    setSelectedRoleForUsers(role)
    setUserModalTab('assigned')
    setSearchUser('')
    setRoleFilter('')
    setShowUserRoleModal(true)
  }

  // Filtered users for User Modal
  const allAssignedUsers = useMemo(() => {
    if (!selectedRoleForUsers) return []
    return getUsersWithRole(selectedRoleForUsers.name)
  }, [users, selectedRoleForUsers])

  const allUnassignedUsers = useMemo(() => {
    if (!selectedRoleForUsers) return []
    return getUsersWithoutRole(selectedRoleForUsers.name)
  }, [users, selectedRoleForUsers])

  const displayedUsers = useMemo(() => {
    const baseList = userModalTab === 'assigned' ? allAssignedUsers : allUnassignedUsers
    return baseList.filter(u => {
      if (roleFilter) {
        const hasOtherRole = (u.roles || []).some(r => r.toUpperCase() === roleFilter.toUpperCase())
        if (!hasOtherRole) return false
      }
      if (searchUser.trim()) {
        const q = searchUser.trim().toLowerCase()
        const matchName = u.nama?.toLowerCase().includes(q)
        const matchUser = u.username?.toLowerCase().includes(q)
        const matchNip = u.nip?.toLowerCase().includes(q)
        return matchName || matchUser || matchNip
      }
      return true
    })
  }, [userModalTab, allAssignedUsers, allUnassignedUsers, roleFilter, searchUser])

  const toggleUserRole = async (user: User, roleName: string, hasRole: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleName, action: hasRole ? 'remove' : 'add' })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        await fetchUsers()
      } else {
        Swal.fire('Error', data.message || 'Gagal update role', 'error')
      }
    } catch (e) {
      Swal.fire('Error', 'Terjadi kesalahan', 'error')
    }
  }

  const handleRemoveUserRole = async (user: User, roleName: string) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Cabut Role?',
      html: `Cabut role <b>${formatRoleDisplay(roleName)}</b> dari user <b>${user.nama}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Cabut',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444'
    })
    if (!isConfirmed) return
    await toggleUserRole(user, roleName, true)
  }

  // Role CRUD actions
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

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      Swal.fire('Error', 'Nama role tidak boleh kosong', 'error')
      return
    }

    const namaBaru = formData.name.trim().toUpperCase().replace(/\s+/g, '_')

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
      confirmButtonColor: '#ef4444'
    })
    if (!isConfirmed) return

    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.ok) {
        Swal.fire('Berhasil', 'Role dihapus!', 'success')
        fetchRoles()
      } else {
        Swal.fire('Error', data.message || 'Gagal hapus role', 'error')
      }
    } catch (e) {
      Swal.fire('Error', 'Terjadi kesalahan', 'error')
    }
  }

  const applyTemplate = (template: typeof SYSTEM_ROLE_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.desc
    })
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
                <th className="dr__thCenter">Jumlah User</th>
                <th className="dr__thActions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {roles
                .filter(r => r.name.toLowerCase().includes(searchRole.toLowerCase()))
                .map(role => {
                  const userCount = getUsersWithRole(role.name).length
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
                      <td className="dr__tdCenter">
                        <button
                          type="button"
                          className="dr__userCountBtn"
                          onClick={() => openUserRoleModal(role)}
                          title="Klik untuk melihat dan mengatur user role ini"
                        >
                          <i className="bi bi-people-fill"></i>
                          <span>{userCount} User</span>
                        </button>
                      </td>
                      <td className="dr__tdActions">
                        <ActionGroup>
                          <button
                            className="dr__btn dr__btn--sm dr__btn--user"
                            onClick={() => openUserRoleModal(role)}
                            title="Atur User"
                          >
                            <i className="bi bi-person-gear"></i>
                            <span>Atur User</span>
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
              const userCount = getUsersWithRole(role.name).length
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

                  <div className="dr__cardFooter">
                    <button
                      type="button"
                      className="dr__userCountWrap"
                      onClick={() => openUserRoleModal(role)}
                      title="Atur User"
                    >
                      <i className="bi bi-people-fill"></i>
                      <span>{userCount} Users</span>
                    </button>
                    <ActionGroup>
                      <button
                        className="dr__btn dr__btn--sm dr__btn--outline"
                        onClick={() => openUserRoleModal(role)}
                        title="Atur User"
                      >
                        <i className="bi bi-person-gear"></i>
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

      {/* Role Form Modal (Tambah / Edit Role) */}
      {showRoleModal && (
        <Modal size="md" variant={editingRole ? "edit" : "add"} onClose={() => setShowRoleModal(false)} labelledBy="modal-role-title">
          <ModalHeader
            id="modal-role-title"
            title={editingRole ? `Edit Role: ${formatRoleDisplay(formData.name || 'Role')}` : 'Tambah Role Baru'}
            icon={editingRole ? "pencil-square" : "shield-check"}
            onClose={() => setShowRoleModal(false)}
          />
          <ModalBody>
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
                  <span className="dr__templateTitle"><i className="bi bi-lightning-charge-fill"></i> Template Cepat:</span>
                  <div className="dr__templateChips">
                    {SYSTEM_ROLE_TEMPLATES.slice(0, 10).map(t => (
                      <button
                        key={t.name}
                        type="button"
                        className="dr__templateChip"
                        onClick={() => applyTemplate(t)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="dr__formGroup" style={{ marginTop: '14px' }}>
                <label>Deskripsi Role (Opsional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi tugas atau peruntukan role"
                />
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

      {/* Revamped User Role Modal */}
      {showUserRoleModal && selectedRoleForUsers && (
        <Modal size="lg" onClose={() => setShowUserRoleModal(false)} labelledBy="modal-user-role-title">
          <ModalHeader
            id="modal-user-role-title"
            title={`User dengan Role "${formatRoleDisplay(selectedRoleForUsers.name)}"`}
            icon="people-fill"
            onClose={() => setShowUserRoleModal(false)}
          />
          <ModalBody>
            <div className="dr__userModalBody">
              {/* Segmented Subtabs */}
              <div className="dr__modalTabs">
                <button
                  type="button"
                  className={`dr__modalTabBtn ${userModalTab === 'assigned' ? 'active' : ''}`}
                  onClick={() => setUserModalTab('assigned')}
                >
                  <i className="bi bi-person-check-fill"></i>
                  <span>Memiliki Role</span>
                  <span className="dr__modalTabCount">{allAssignedUsers.length}</span>
                </button>
                <button
                  type="button"
                  className={`dr__modalTabBtn ${userModalTab === 'unassigned' ? 'active' : ''}`}
                  onClick={() => setUserModalTab('unassigned')}
                >
                  <i className="bi bi-person-plus-fill"></i>
                  <span>Tambahkan User</span>
                  <span className="dr__modalTabCount">{allUnassignedUsers.length}</span>
                </button>
              </div>

              {/* Filters Toolbar */}
              <div className="dr__modalFilterBar">
                <div className="dr__modalSearch">
                  <i className="bi bi-search dr__searchIcon"></i>
                  <input
                    type="text"
                    placeholder="Cari nama, username, atau NIP..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                  />
                  {searchUser && (
                    <button
                      type="button"
                      className="dr__modalSearchClear"
                      onClick={() => setSearchUser('')}
                      title="Hapus pencarian"
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  )}
                </div>
                <div className="dr__modalSelectWrap">
                  <select
                    className="dr__modalSelect"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">Semua Role Lain</option>
                    {roles
                      .filter(r => r.name.toUpperCase() !== selectedRoleForUsers.name.toUpperCase())
                      .map(r => (
                        <option key={r.id} value={r.name}>{formatRoleDisplay(r.name)}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* User Cards List */}
              <div className="dr__userList">
                {displayedUsers.length > 0 ? (
                  displayedUsers.map(user => {
                    const otherRoles = (user.roles || []).filter(
                      r => r.toUpperCase() !== selectedRoleForUsers.name.toUpperCase()
                    )
                    return (
                      <div key={user.id} className="dr__userCard">
                        <div className="dr__userAvatar">
                          {getInitials(user.nama)}
                        </div>
                        <div className="dr__userMain">
                          <div className="dr__userTopRow">
                            <span className="dr__userName">{user.nama}</span>
                            {user.nip && (
                              <span className="dr__userNip">NIP: {user.nip}</span>
                            )}
                          </div>
                          <div className="dr__userBottomRow">
                            <span className="dr__userHandle">@{user.username}</span>
                            {otherRoles.length > 0 && (
                              <div className="dr__userRolesWrap">
                                {otherRoles.slice(0, 3).map(r => (
                                  <span key={r} className="dr__userRoleBadge">
                                    {formatRoleDisplay(r)}
                                  </span>
                                ))}
                                {otherRoles.length > 3 && (
                                  <span className="dr__userRoleBadge dr__userRoleBadge--more">
                                    +{otherRoles.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="dr__userActions">
                          {userModalTab === 'assigned' ? (
                            <button
                              type="button"
                              className="dr__btnRemoveRole"
                              onClick={() => handleRemoveUserRole(user, selectedRoleForUsers.name)}
                              title="Cabut role dari user ini"
                            >
                              <i className="bi bi-person-dash"></i>
                              <span>Cabut</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dr__btnAddRole"
                              onClick={() => toggleUserRole(user, selectedRoleForUsers.name, false)}
                              title="Tambahkan role ke user ini"
                            >
                              <i className="bi bi-person-plus"></i>
                              <span>Tambahkan</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="dr__userEmptyState">
                    <i className="bi bi-person-slash dr__emptyIcon"></i>
                    <div className="dr__emptyTitle">
                      {searchUser
                        ? 'Tidak ada user yang cocok'
                        : userModalTab === 'assigned'
                        ? 'Belum ada user pada role ini'
                        : 'Semua user sudah memiliki role ini'}
                    </div>
                    <p className="dr__emptyDesc">
                      {searchUser
                        ? `Tidak ditemukan akun dengan kata kunci "${searchUser}"`
                        : userModalTab === 'assigned'
                        ? 'Gunakan tab "Tambahkan User" untuk menugaskan akun ke role ini.'
                        : 'Seluruh akun yang tersedia sudah terdaftar pada role ini.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="dr__modalFooterContent">
              <span className="dr__modalFooterMeta">
                Total <strong>{allAssignedUsers.length} user</strong> memiliki role {formatRoleDisplay(selectedRoleForUsers.name)}
              </span>
              <Button variant="secondary" onClick={() => setShowUserRoleModal(false)}>
                Tutup
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      <style jsx>{`
        /* =========================================================
           BASE & COMPONENT STYLES
           ========================================================= */
        .dr {
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          font-family: inherit;
        }

        /* ── TABLE ── */
        .dr__tableWrapper {
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .dr__table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .dr__table th {
          background: var(--n-soft, #f8fafc);
          padding: 12px 16px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid var(--n-border, #e2e8f0);
        }

        .dr__table td {
          padding: 12px 16px;
          font-size: 0.88rem;
          border-bottom: 1px solid var(--n-border, #e2e8f0);
          vertical-align: middle;
        }

        .dr__table tbody tr:last-child td {
          border-bottom: none;
        }

        .dr__table tbody tr:hover td {
          background: rgba(48, 131, 255, 0.02);
        }

        .dr__thCenter, .dr__tdCenter {
          text-align: center;
        }

        .dr__thActions, .dr__tdActions {
          text-align: right;
          width: 220px;
        }

        /* ── ROLE CELL ── */
        .dr__roleCell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dr__roleIcon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(48, 131, 255, 0.1);
          color: #3083FF;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          flex-shrink: 0;
        }

        .dr__roleInfo {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dr__roleName {
          font-weight: 700;
          font-size: 0.92rem;
          color: var(--n-ink, #0f172a);
        }

        .dr__roleId {
          font-family: ui-monospace, monospace;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          background: var(--n-soft, #f1f5f9);
          padding: 1px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .dr__tdDesc {
          color: var(--n-muted, #64748b);
          font-size: 0.85rem;
          max-width: 320px;
          line-height: 1.4;
        }

        /* ── USER COUNT BUTTON ── */
        .dr__userCountBtn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 700;
          background: rgba(48, 131, 255, 0.08);
          color: #2563eb;
          border: 1px solid rgba(48, 131, 255, 0.2);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__userCountBtn:hover {
          background: #3083FF;
          color: #ffffff;
          border-color: #3083FF;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(48, 131, 255, 0.3);
        }

        /* ── ACTION BUTTONS ── */
        .dr__btn--user {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 700;
          background: var(--n-soft, #f8fafc);
          border: 1px solid var(--n-border, #cbd5e1);
          color: var(--n-ink, #334155);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__btn--user:hover {
          border-color: #3083FF;
          color: #3083FF;
          background: rgba(48, 131, 255, 0.06);
        }

        .dr__btn--outline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          background: transparent;
          border: 1px solid var(--n-border, #cbd5e1);
          color: var(--n-ink, #334155);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__btn--outline:hover {
          border-color: #3083FF;
          color: #3083FF;
          background: rgba(48, 131, 255, 0.06);
        }

        /* ── MOBILE CARDS ── */
        .dr__cardGrid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dr__card {
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #e2e8f0);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .dr__cardTop {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dr__cardDesc {
          font-size: 0.84rem;
          color: var(--n-muted, #64748b);
          line-height: 1.35;
        }

        .dr__cardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--n-border, #e2e8f0);
        }

        .dr__userCountWrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          font-size: 0.82rem;
          font-weight: 700;
          color: #2563eb;
          cursor: pointer;
          padding: 0;
        }

        /* ── FORM MODAL ── */
        .dr__formSection {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dr__formGroup {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dr__formGroup label {
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
        }

        .dr__req {
          color: #ef4444;
        }

        .dr__formGroup input {
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--n-border, #cbd5e1);
          font-size: 0.88rem;
          color: var(--n-ink, #0f172a);
          background: var(--n-card, #ffffff);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .dr__formGroup input:focus {
          border-color: #3083FF;
          box-shadow: 0 0 0 3px rgba(48, 131, 255, 0.15);
        }

        .dr__templatesSection {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: var(--n-soft, #f8fafc);
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px dashed var(--n-border, #cbd5e1);
        }

        .dr__templateTitle {
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dr__templateTitle i {
          color: #f59e0b;
        }

        .dr__templateChips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .dr__templateChip {
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #cbd5e1);
          color: var(--n-ink, #334155);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__templateChip:hover {
          border-color: #3083FF;
          color: #3083FF;
          background: rgba(48, 131, 255, 0.05);
        }

        /* ── REVAMPED USER ROLE MODAL ── */
        .dr__userModalBody {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Segmented Subtabs */
        .dr__modalTabs {
          display: flex;
          gap: 6px;
          padding: 4px;
          background: var(--n-soft, #f1f5f9);
          border-radius: 10px;
        }

        .dr__modalTabBtn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 7px;
          border: none;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__modalTabBtn.active {
          background: var(--n-card, #ffffff);
          color: #2563eb;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        }

        .dr__modalTabCount {
          font-size: 0.72rem;
          padding: 1px 7px;
          border-radius: 12px;
          font-weight: 800;
          background: rgba(0, 0, 0, 0.06);
          color: inherit;
        }

        .dr__modalTabBtn.active .dr__modalTabCount {
          background: rgba(37, 99, 235, 0.12);
          color: #2563eb;
        }

        /* Modal Filter Bar */
        .dr__modalFilterBar {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .dr__modalSearch {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .dr__searchIcon {
          position: absolute;
          left: 12px;
          color: #94a3b8;
          font-size: 0.85rem;
          pointer-events: none;
        }

        .dr__modalSearch input {
          width: 100%;
          height: 38px;
          padding: 0 34px 0 34px;
          border-radius: 8px;
          border: 1px solid var(--n-border, #cbd5e1);
          font-size: 0.84rem;
          background: var(--n-card, #ffffff);
          color: var(--n-ink, #0f172a);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .dr__modalSearch input:focus {
          border-color: #3083FF;
          box-shadow: 0 0 0 3px rgba(48, 131, 255, 0.12);
        }

        .dr__modalSearchClear {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.78rem;
          cursor: pointer;
          padding: 2px 4px;
        }

        .dr__modalSearchClear:hover {
          color: #ef4444;
        }

        .dr__modalSelectWrap {
          width: 180px;
          flex-shrink: 0;
        }

        .dr__modalSelect {
          width: 100%;
          height: 38px;
          border-radius: 8px;
          border: 1px solid var(--n-border, #cbd5e1);
          padding: 0 10px;
          font-size: 0.84rem;
          font-weight: 600;
          background: var(--n-card, #ffffff);
          color: var(--n-ink, #0f172a);
          outline: none;
          cursor: pointer;
        }

        .dr__modalSelect:focus {
          border-color: #3083FF;
        }

        /* User List */
        .dr__userList {
          max-height: 380px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }

        .dr__userList::-webkit-scrollbar {
          width: 6px;
        }

        .dr__userList::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }

        /* User Card Item */
        .dr__userCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #e2e8f0);
          transition: all 0.15s ease;
        }

        .dr__userCard:hover {
          border-color: rgba(48, 131, 255, 0.35);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }

        .dr__userAvatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%);
          color: #2563eb;
          font-weight: 800;
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(37, 99, 235, 0.15);
        }

        .dr__userMain {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dr__userTopRow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .dr__userName {
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--n-ink, #0f172a);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dr__userNip {
          font-size: 0.72rem;
          color: var(--n-muted, #64748b);
          font-family: ui-monospace, monospace;
          background: var(--n-soft, #f8fafc);
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid var(--n-border, #e2e8f0);
        }

        .dr__userBottomRow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .dr__userHandle {
          font-size: 0.78rem;
          font-weight: 600;
          color: #3b82f6;
        }

        .dr__userRolesWrap {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dr__userRoleBadge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--n-soft, #f1f5f9);
          color: var(--n-muted, #64748b);
          border: 1px solid var(--n-border, #e2e8f0);
        }

        .dr__userRoleBadge--more {
          background: rgba(0, 0, 0, 0.04);
        }

        /* Action Buttons in User Card */
        .dr__userActions {
          flex-shrink: 0;
        }

        .dr__btnRemoveRole {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #fee2e2;
          background: #fef2f2;
          color: #dc2626;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__btnRemoveRole:hover {
          background: #dc2626;
          color: #ffffff;
          border-color: #dc2626;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);
        }

        .dr__btnAddRole {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(37, 99, 235, 0.2);
          background: #eff6ff;
          color: #2563eb;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dr__btnAddRole:hover {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
        }

        /* Empty State */
        .dr__userEmptyState {
          padding: 40px 20px;
          text-align: center;
          color: var(--n-muted, #64748b);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .dr__emptyIcon {
          font-size: 2.2rem;
          color: #cbd5e1;
          margin-bottom: 8px;
        }

        .dr__emptyTitle {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--n-ink, #0f172a);
        }

        .dr__emptyDesc {
          font-size: 0.82rem;
          margin-top: 4px;
          max-width: 340px;
          line-height: 1.4;
        }

        /* Modal Footer */
        .dr__modalFooterContent {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .dr__modalFooterMeta {
          font-size: 0.82rem;
          color: var(--n-muted, #64748b);
        }

        .dr__modalFooterMeta strong {
          color: var(--n-ink, #0f172a);
        }

        /* ── DARK MODE ── */
        :global(.dark) .dr__tableWrapper,
        :global(.dark) .dr__card,
        :global(.dark) .dr__userCard {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
        }

        :global(.dark) .dr__table th {
          background: rgba(15, 23, 42, 0.6) !important;
          border-color: rgba(26, 115, 232, 0.25) !important;
          color: #94a3b8 !important;
        }

        :global(.dark) .dr__table td {
          border-color: rgba(26, 115, 232, 0.2) !important;
          color: #e2e8f0 !important;
        }

        :global(.dark) .dr__roleName,
        :global(.dark) .dr__userName {
          color: #f8fafc !important;
        }

        :global(.dark) .dr__roleId,
        :global(.dark) .dr__userNip,
        :global(.dark) .dr__userRoleBadge {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
          color: #94a3b8 !important;
        }

        :global(.dark) .dr__userCountBtn {
          background: rgba(37, 99, 235, 0.15) !important;
          border-color: rgba(37, 99, 235, 0.4) !important;
          color: #93c5fd !important;
        }

        :global(.dark) .dr__userCountBtn:hover {
          background: #3083FF !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__btn--user,
        :global(.dark) .dr__btn--outline {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #93c5fd !important;
        }

        :global(.dark) .dr__modalTabs {
          background: #0f172a !important;
        }

        :global(.dark) .dr__modalTabBtn.active {
          background: #1e293b !important;
          color: #60a5fa !important;
        }

        :global(.dark) .dr__modalSearch input,
        :global(.dark) .dr__modalSelect,
        :global(.dark) .dr__formGroup input {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #e2e8f0 !important;
        }

        :global(.dark) .dr__userAvatar {
          background: rgba(37, 99, 235, 0.2) !important;
          color: #93c5fd !important;
          border-color: rgba(37, 99, 235, 0.4) !important;
        }

        :global(.dark) .dr__btnRemoveRole {
          background: rgba(220, 38, 38, 0.15) !important;
          border-color: rgba(220, 38, 38, 0.3) !important;
          color: #f87171 !important;
        }

        :global(.dark) .dr__btnRemoveRole:hover {
          background: #dc2626 !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__btnAddRole {
          background: rgba(37, 99, 235, 0.15) !important;
          border-color: rgba(37, 99, 235, 0.3) !important;
          color: #93c5fd !important;
        }

        :global(.dark) .dr__btnAddRole:hover {
          background: #2563eb !important;
          color: #ffffff !important;
        }

        :global(.dark) .dr__templatesSection {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
        }

        :global(.dark) .dr__templateChip {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #93c5fd !important;
        }

        :global(.dark) .dr__modalFooterMeta strong {
          color: #f8fafc !important;
        }

        /* ── RESPONSIVE MOBILE ── */
        @media (max-width: 768px) {
          .dr__modalTabs {
            flex-direction: row;
          }
          .dr__modalTabBtn {
            font-size: 0.78rem;
            padding: 7px 10px;
          }
          .dr__modalFilterBar {
            flex-direction: column;
            align-items: stretch;
          }
          .dr__modalSelectWrap {
            width: 100%;
          }
          .dr__modalFooterContent {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
            text-align: center;
          }
          .dr__modalFooterContent :global(button) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
