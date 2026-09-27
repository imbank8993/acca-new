'use client'

import { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import Select, { type StylesConfig, type SingleValue, type MultiValue } from 'react-select'
import { MENU_GROUPS, PAGE_LABELS, type MenuGroupDef } from '@/lib/sidebar-menu'
import { formatRoleDisplay } from '@/lib/auth'
import { canAccessPage } from '@/lib/page-requirements'
import { FilterToolbar, FilterActions } from '@/components/ui/FilterToolbar'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { Spinner } from '@/components/ui/Spinner'
import type { ThemeMode } from '@/lib/theme-roles'

const ADMIN_ROLES = new Set(['ADMIN', 'ADMINISTRATOR'])
const PRIMARY_ROLES = ['ADMIN', 'GURU', 'SISWA', 'WALI', 'ORANG_TUA', 'KAMAD', 'WALI_KELAS']

// Serialize the editable state (pages + flat groups) into a stable string so we
// can detect unsaved changes regardless of Set iteration order.
const snapshot = (pages: Set<string>, flat: Set<string>) =>
  JSON.stringify({ p: [...pages].sort(), f: [...flat].sort() })

interface UserItem {
  id?: number
  roles?: string[]
  role?: string
}

interface RoleSelectOption {
  value: string
  label: string
  count?: number
  mode?: ThemeMode
}

export default function RolePageAccessTab() {
  const [roles, setRoles] = useState<string[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [pageIds, setPageIds] = useState<Set<string>>(new Set())
  const [flatGroups, setFlatGroups] = useState<Set<string>>(new Set())
  const [initial, setInitial] = useState<string>('') // serialized snapshot to detect changes
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Role Theme Mode Map (Role -> 'ALL' | 'LIGHT' | 'DARK')
  const [roleThemeMap, setRoleThemeMap] = useState<Record<string, ThemeMode>>({})
  const [initialRoleThemeMap, setInitialRoleThemeMap] = useState<Record<string, ThemeMode>>({})

  // Bulk theme modal states
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTargetMode, setBulkTargetMode] = useState<ThemeMode>('ALL')
  const [bulkSelectedRoles, setBulkSelectedRoles] = useState<string[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)

  const { registerModal } = useModalBlur()

  useEffect(() => {
    if (showBulkModal) return registerModal()
  }, [showBulkModal, registerModal])

  // Shared menu structure + label overrides from "Susun Menu" (keeps both tabs in sync).
  const [groups, setGroups] = useState<MenuGroupDef[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/roles')
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          const names: string[] = (d.data || []).map((r: { name?: string }) => r.name || '').filter(Boolean)
          setRoles(names)
          if (!selectedRole && names.length) setSelectedRole(names.includes('GURU') ? 'GURU' : names[0])
        }
      })
      .catch(() => {})

    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { if (d.ok) setUsers(d.data || []) })
      .catch(() => {})

    fetch('/api/menu-layout')
      .then(r => r.json())
      .then(d => {
        if (d?.ok && Array.isArray(d.layout)) setGroups(d.layout.length ? d.layout : MENU_GROUPS)
        if (d?.ok && d.labels && typeof d.labels === 'object') setLabels(d.labels)
      })
      .catch(() => {})

    // Fetch theme preferences for each role
    fetch('/api/admin/role-theme')
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d.themeMap) {
          const map: Record<string, ThemeMode> = d.themeMap
          setRoleThemeMap(map)
          setInitialRoleThemeMap(map)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Pemuatan akses role GAGAL — penyimpanan harus ditahan.
   *
   * Dulu kegagalan diperlakukan sebagai "role ini tidak punya halaman": `pageIds`
   * disetel ke himpunan KOSONG. Layar lalu menampilkan semua kotak tidak
   * tercentang, tampak seperti keadaan yang sah, dan `save()` mengirim
   * `pageIds: []` apa adanya — mencabut SELURUH menu role itu dalam satu klik.
   * Untuk role seperti TAMU (31 halaman) atau GURU, satu gangguan jaringan sesaat
   * cukup untuk menghapus seluruh pemetaannya.
   *
   * Bahaya yang sama sudah disadari dan dicegah di MenuLayoutTab; di sini belum.
   */
  const [gagalMuatAkses, setGagalMuatAkses] = useState(false)

  useEffect(() => {
    if (!selectedRole) return
    setLoading(true)
    setGagalMuatAkses(false)
    fetch(`/api/admin/role-pages?role=${encodeURIComponent(selectedRole)}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.ok) throw new Error(d?.error || 'Gagal memuat akses halaman role')
        const p = new Set<string>(d.pageIds || []), f = new Set<string>(d.flatGroups || [])
        setPageIds(p)
        setFlatGroups(f)
        setInitial(snapshot(p, f))
      })
      .catch(() => { setGagalMuatAkses(true) })
      .finally(() => setLoading(false))
  }, [selectedRole])

  // Effective display name = custom override (Susun Menu) || built-in default || id.
  const effectiveLabel = (id: string) => labels[id] ?? PAGE_LABELS[id] ?? id

  const userCountByRole = useMemo(() => {
    const map: Record<string, number> = {}
    users.forEach(u => (u.roles || []).forEach((r: string) => { map[r] = (map[r] || 0) + 1 }))
    return map
  }, [users])

  const isThemeDirty = useMemo(() => {
    if (!selectedRole) return false
    const roleUpper = selectedRole.toUpperCase()
    if (ADMIN_ROLES.has(roleUpper)) return false
    const currentMode = roleThemeMap[roleUpper] || 'LIGHT'
    const initialMode = initialRoleThemeMap[roleUpper] || 'LIGHT'
    return currentMode !== initialMode
  }, [selectedRole, roleThemeMap, initialRoleThemeMap])

  const dirty = useMemo(
    () => snapshot(pageIds, flatGroups) !== initial || isThemeDirty,
    [pageIds, flatGroups, initial, isThemeDirty]
  )

  // A page can be granted in the menu (role_pages) yet the role has NO functional
  // access inside it (PAGE_ROLE_REQUIREMENTS.allowedRoles). ADMIN always bypasses.
  const roleLacksAccess = (pageId: string) =>
    !!selectedRole && !ADMIN_ROLES.has(selectedRole.toUpperCase()) && !canAccessPage([selectedRole], pageId)

  // Count of currently-granted pages where the role lacks in-page access.
  const warnCount = useMemo(
    () => [...pageIds].filter(p => !ADMIN_ROLES.has(selectedRole.toUpperCase()) && !canAccessPage([selectedRole], p)).length,
    [pageIds, selectedRole]
  )

  const togglePage = (id: string) => {
    setPageIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleGroup = (groupPages: string[], allOn: boolean) => {
    setPageIds(prev => {
      const next = new Set(prev)
      groupPages.forEach(p => { if (allOn) next.delete(p); else next.add(p) })
      return next
    })
  }

  const toggleFlat = (groupKey: string) => {
    setFlatGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey)
      return next
    })
  }

  // Set mode for active single role
  const setModeForRole = (role: string, mode: ThemeMode) => {
    const roleUpper = role.toUpperCase()
    if (ADMIN_ROLES.has(roleUpper)) return
    setRoleThemeMap(prev => ({
      ...prev,
      [roleUpper]: mode
    }))
  }

  const save = async () => {
    if (!selectedRole) return
    if (gagalMuatAkses) {
      Swal.fire(
        'Tidak bisa menyimpan',
        'Akses halaman role ini gagal dimuat, jadi yang tampil di layar belum tentu sama dengan yang tersimpan. Muat ulang halaman lebih dulu — menyimpan sekarang berisiko menghapus akses yang sudah ada.',
        'warning',
      )
      return
    }
    setSaving(true)
    try {
      const rolePagesPromise = fetch('/api/admin/role-pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole, pageIds: [...pageIds], flatGroups: [...flatGroups] }),
      })

      let themePromise: Promise<{ ok: boolean; error?: string }> = Promise.resolve({ ok: true })
      if (isThemeDirty) {
        themePromise = fetch('/api/admin/role-theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeMap: roleThemeMap }),
        }).then(r => r.json())
      }

      const [resPages, resTheme] = await Promise.all([
        rolePagesPromise.then(r => r.json()),
        themePromise
      ])

      if (!resPages.ok) throw new Error(resPages.error || 'Gagal menyimpan akses halaman')
      if (!resTheme.ok) throw new Error(resTheme.error || 'Gagal menyimpan preferensi tema role')

      setInitial(snapshot(pageIds, flatGroups))
      setInitialRoleThemeMap({ ...roleThemeMap })
      Swal.fire(
        'Berhasil',
        `Akses halaman & preferensi tema untuk role ${formatRoleDisplay(selectedRole)} disimpan. Berlaku setelah user login berikutnya.`,
        'success'
      )
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Gagal menyimpan data'
      Swal.fire('Error', errMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle Bulk Theme Mode Application
  const handleApplyBulkTheme = async () => {
    if (bulkSelectedRoles.length === 0) {
      Swal.fire('Peringatan', 'Silakan pilih minimal satu role untuk menerapkan mode.', 'warning')
      return
    }

    setBulkSaving(true)
    try {
      const res = await fetch('/api/admin/role-theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: bulkSelectedRoles, mode: bulkTargetMode }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error || 'Gagal menerapkan mode tema massal')

      const updatedMap: Record<string, ThemeMode> = d.themeMap || {}
      setRoleThemeMap(updatedMap)
      setInitialRoleThemeMap(updatedMap)
      setShowBulkModal(false)
      setBulkSelectedRoles([])

      const modeTitle = bulkTargetMode === 'ALL' ? 'Semua Mode (Bebas)' : bulkTargetMode === 'DARK' ? 'Hanya Mode Gelap' : 'Hanya Mode Terang'
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Diterapkan!',
        text: `Mode "${modeTitle}" berhasil diterapkan ke ${bulkSelectedRoles.length} role.`,
        timer: 2500,
        showConfirmButton: false
      })
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Gagal menerapkan preferensi tema'
      Swal.fire('Error', errMsg, 'error')
    } finally {
      setBulkSaving(false)
    }
  }

  const totalSelected = pageIds.size
  const totalPages = groups.reduce((count, group) => count + group.pages.length, 0)

  // Options for single searchable role selector dropdown
  const roleSelectOptions: RoleSelectOption[] = useMemo(() => {
    return roles.map(r => {
      const rUpper = r.toUpperCase()
      const count = userCountByRole[r] || 0
      const mode = ADMIN_ROLES.has(rUpper) ? 'ALL' : (roleThemeMap[rUpper] || 'LIGHT')
      return {
        value: r,
        label: `${formatRoleDisplay(r)} (${count} user)`,
        count,
        mode
      }
    })
  }, [roles, userCountByRole, roleThemeMap])

  // Options for bulk multi-select (excluding Admin)
  const nonAdminRoleOptions: RoleSelectOption[] = useMemo(() => {
    return roles
      .filter(r => !ADMIN_ROLES.has(r.toUpperCase()))
      .map(r => ({
        value: r,
        label: `${formatRoleDisplay(r)} (${userCountByRole[r] || 0} user)`
      }))
  }, [roles, userCountByRole])

  // Current active role theme mode
  const currentRoleUpper = selectedRole.toUpperCase()
  const currentRoleIsAdmin = ADMIN_ROLES.has(currentRoleUpper)
  const currentRoleMode: ThemeMode = currentRoleIsAdmin ? 'ALL' : (roleThemeMap[currentRoleUpper] || 'LIGHT')

  // react-select custom styling
  const customSelectStyles: StylesConfig<RoleSelectOption, boolean> = {
    control: (base, state) => ({
      ...base,
      minHeight: '40px',
      borderRadius: '10px',
      borderColor: state.isFocused ? '#2563eb' : 'var(--n-border, #cbd5e1)',
      backgroundColor: 'var(--n-card, #ffffff)',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
      '&:hover': {
        borderColor: '#2563eb'
      },
      fontSize: '0.85rem',
      fontWeight: '600'
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '0.82rem',
      fontWeight: '600',
      backgroundColor: state.isSelected
        ? '#2563eb'
        : state.isFocused
        ? 'rgba(37, 99, 235, 0.1)'
        : 'transparent',
      color: state.isSelected ? '#ffffff' : 'var(--n-ink, #0f172a)',
      cursor: 'pointer'
    }),
    singleValue: base => ({
      ...base,
      color: 'var(--n-ink, #0f172a)',
      fontWeight: '600'
    }),
    menu: base => ({
      ...base,
      borderRadius: '10px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      backgroundColor: 'var(--n-card, #ffffff)',
      border: '1px solid var(--n-border, #e2e8f0)',
      zIndex: 9999
    })
  }

  return (
    <div className="rpa">
      <div className="rpa__intro">
        <h2>Akses Halaman per Role</h2>
        <p>Pilih halaman yang muncul di menu untuk setiap role. Pengaturan menu ini terpisah dari hak akses ke isi halaman.</p>
      </div>

      <div className="rpa__headerBar">
        <div className="rpa__headerLeft">
          <div className="rpa__dropdownArea">
            <label className="rpa__fieldLabel">
              Role yang diatur
            </label>
            <div className="rpa__selectBox">
              <Select<RoleSelectOption, false>
                value={roleSelectOptions.find(o => o.value === selectedRole) || null}
                onChange={(opt: SingleValue<RoleSelectOption>) => opt && setSelectedRole(opt.value)}
                options={roleSelectOptions}
                placeholder="Cari role..."
                isSearchable
                styles={customSelectStyles}
                classNamePrefix="rpa-select"
                formatOptionLabel={(option: RoleSelectOption) => (
                  <div className="rpa__optionRow">
                    <span className="rpa__optionName">{formatRoleDisplay(option.value)}</span>
                    <div className="rpa__optionMeta">
                      <span className="rpa__optionCount">{option.count || 0} user</span>
                      <span className={`rpa__optionMode ${(option.mode || 'light').toLowerCase()}`}>
                        {option.mode === 'ALL' ? '🌗 Semua' : option.mode === 'DARK' ? '🌙 Dark' : '☀️ Light'}
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>

          <div className="rpa__quickPills">
            {PRIMARY_ROLES.some(pr => roles.includes(pr)) && (
              <span className="rpa__quickTitle">Pilih cepat</span>
            )}
            {PRIMARY_ROLES.filter(pr => roles.includes(pr)).map(pr => (
              <button
                key={pr}
                type="button"
                className={`rpa__quickPill ${selectedRole === pr ? 'active' : ''}`}
                onClick={() => setSelectedRole(pr)}
                aria-pressed={selectedRole === pr}
              >
                {formatRoleDisplay(pr)}
                <span className="rpa__quickCount">{userCountByRole[pr] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rpa__headerRight">
          <button
            type="button"
            className="rpa__bulkActionBtn"
            onClick={() => setShowBulkModal(true)}
            title="Terapkan pengaturan tema ke beberapa role sekaligus"
          >
            <i className="bi bi-sliders2"></i>
            <span>Atur Tema Massal</span>
          </button>
        </div>
      </div>

      {/* Tanpa pemberitahuan ini, daftar yang gagal dimuat tampak seperti role
          tanpa akses — dan itulah yang memancing admin menekan Simpan. */}
      {gagalMuatAkses && !loading && (
        <div
          className="rpa__loadError"
          style={{
            display: 'flex', gap: '0.5rem', alignItems: 'center',
            padding: '0.75rem 1rem', marginBottom: '0.75rem', borderRadius: 8,
            border: '1px solid var(--n-warning, #f59e0b)', fontSize: '0.875rem',
          }}
        >
          <i className="bi bi-exclamation-triangle-fill" style={{ color: 'var(--n-warning, #f59e0b)' }}></i>
          <span>
            Akses halaman untuk role ini gagal dimuat, jadi daftar di bawah belum mencerminkan
            data tersimpan. Penyimpanan dinonaktifkan — muat ulang halaman untuk mencoba lagi.
          </span>
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <FilterToolbar>
        <div className="rpa__toolbarInfo">
          <span className="rpa__count">
            <b>{formatRoleDisplay(selectedRole)}</b> • {totalSelected} dari {totalPages} halaman menu dipilih
          </span>
          {warnCount > 0 && (
            <span
              className="rpa__warn"
              title="Halaman ini muncul di menu, tetapi role tidak terdaftar di akses fungsional halaman (PAGE_ROLE_REQUIREMENTS) — isinya bisa kosong/terbatas."
            >
              <i className="bi bi-exclamation-triangle-fill"></i> {warnCount} halaman tanpa akses fungsional
            </span>
          )}
        </div>
        <FilterActions>
          <Button
            variant="primary"
            icon="save"
            onClick={save}
            disabled={!dirty || saving || !selectedRole || gagalMuatAkses}
            isLoading={saving}
          >
            Simpan Perubahan
          </Button>
        </FilterActions>
      </FilterToolbar>

      {/* ── ACTIVE ROLE THEME SETTING CARD (3 SEGMENTED CHOICES) ── */}
      {selectedRole && (
        <section className="rpa__section">
          <div className="rpa__sectionIntro">
            <h3>Preferensi Tema</h3>
            <p>Atur mode terang atau gelap yang dapat digunakan oleh pengguna dengan role ini.</p>
          </div>
          <div className="rpa__themeCard">
            <div className="rpa__themeCardLeft">
              <div className={`rpa__themeIcon ${currentRoleMode.toLowerCase()}`}>
                <i className={currentRoleMode === 'ALL' ? 'bi bi-circle-half' : currentRoleMode === 'DARK' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill'}></i>
              </div>
              <div className="rpa__themeInfo">
                <div className="rpa__themeTitle">
                  Mode Tampilan <b>{formatRoleDisplay(selectedRole)}</b>
                </div>
              </div>
            </div>

            <div className="rpa__themeCardRight">
              {currentRoleIsAdmin ? (
                <span className="rpa__themeBadge locked">
                  <i className="bi bi-shield-check"></i> Admin Selalu Semua Mode
                </span>
              ) : (
                <div className="rpa__segmentedGroup" role="group" aria-label="Pilihan mode tema">
                  <button
                    type="button"
                    className={`rpa__segBtn ${currentRoleMode === 'ALL' ? 'active all' : ''}`}
                    onClick={() => setModeForRole(selectedRole, 'ALL')}
                  >
                    <i className="bi bi-circle-half"></i>
                    <span>Semua Mode</span>
                  </button>
                  <button
                    type="button"
                    className={`rpa__segBtn ${currentRoleMode === 'LIGHT' ? 'active light' : ''}`}
                    onClick={() => setModeForRole(selectedRole, 'LIGHT')}
                  >
                    <i className="bi bi-sun-fill"></i>
                    <span>Mode Light</span>
                  </button>
                  <button
                    type="button"
                    className={`rpa__segBtn ${currentRoleMode === 'DARK' ? 'active dark' : ''}`}
                    onClick={() => setModeForRole(selectedRole, 'DARK')}
                  >
                    <i className="bi bi-moon-stars-fill"></i>
                    <span>Mode Dark</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── GROUPED PAGE CHECKLIST ── */}
      {loading ? (
        <div className="rpa__loading">
          <Spinner variant="trace" />
        </div>
      ) : (
        <section className="rpa__section">
          <div className="rpa__sectionIntro">
            <h3>Halaman di Menu</h3>
            <p>
              Centang halaman agar muncul di menu role. “Pilih semua” mengubah akses menu satu grup;
              “Tampilan grup/rata” hanya mengatur susunannya.
            </p>
          </div>
          <div className="rpa__groups">
            {groups.map(group => {
              const allOn = group.pages.length > 0 && group.pages.every(p => pageIds.has(p))
              const someOn = group.pages.some(p => pageIds.has(p))
              const isFlat = flatGroups.has(group.key)
              const selectedInGroup = group.pages.filter(page => pageIds.has(page)).length
              return (
                <div key={group.key} className="rpa__group">
                  <div className="rpa__groupHead">
                    <span className="rpa__groupTitle">
                      <i className={`fa-solid ${group.icon}`}></i> {group.label}
                      <span className="rpa__groupCount">{selectedInGroup}/{group.pages.length} dipilih</span>
                    </span>
                    <div className="rpa__groupBtns">
                      <button
                        type="button"
                        className={`rpa__flatToggle ${isFlat ? 'flat' : ''}`}
                        onClick={() => toggleFlat(group.key)}
                        title={isFlat
                          ? 'Halaman grup ini tampil rata (tanpa header grup) di sidebar role ini'
                          : 'Halaman grup ini tampil berkelompok di bawah header grup'}
                        aria-pressed={isFlat}
                      >
                        <i className={`bi ${isFlat ? 'bi-list' : 'bi-collection'}`}></i>
                        {isFlat ? 'Tampilan rata' : 'Tampilan grup'}
                      </button>
                      <button
                        type="button"
                        className={`rpa__groupToggle ${someOn ? 'on' : ''}`}
                        onClick={() => toggleGroup(group.pages, allOn)}
                      >
                        {allOn ? 'Hapus pilihan' : 'Pilih semua'}
                      </button>
                    </div>
                  </div>
                  <div className="rpa__pages">
                    {group.pages.map(p => {
                      const lacks = roleLacksAccess(p)
                      return (
                        <label
                          key={p}
                          className={`rpa__page ${pageIds.has(p) ? 'selected' : ''} ${lacks ? 'warn' : ''}`}
                          title={`ID halaman: ${p}`}
                        >
                          <input type="checkbox" checked={pageIds.has(p)} onChange={() => togglePage(p)} />
                          <span className="rpa__pageLabel">{effectiveLabel(p)}</span>
                          {lacks && (
                            <i
                              className="bi bi-exclamation-triangle-fill rpa__pageWarn"
                              title={`Role ${formatRoleDisplay(selectedRole)} tidak terdaftar di akses fungsional halaman ini. Menu akan muncul tapi isinya bisa kosong/terbatas.`}
                            ></i>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── MODAL ATUR MODE MASSAL (BULK THEME ASSIGNMENT) ── */}
      {showBulkModal && (
        <Modal size="lg" onClose={() => setShowBulkModal(false)} labelledBy="bulk-theme-modal-title">
          <ModalHeader
            id="bulk-theme-modal-title"
            variant="default"
            title="Pengaturan Massal Mode Tampilan"
            onClose={() => setShowBulkModal(false)}
          />
          <ModalBody>
            <div className="rpa__bulkBody">
              {/* 1. Target Mode Selection Cards */}
              <div className="rpa__bulkSection">
                <label className="rpa__bulkSectionTitle">
                  <span className="step-num">1</span> Pilih Mode:
                </label>
                <div className="rpa__modeCards">
                  <div
                    className={`rpa__modeCard ${bulkTargetMode === 'ALL' ? 'selected' : ''}`}
                    onClick={() => setBulkTargetMode('ALL')}
                  >
                    <div className="rpa__modeCardIcon all">
                      <i className="bi bi-circle-half"></i>
                    </div>
                    <div className="rpa__modeCardContent">
                      <div className="rpa__modeCardName">Semua Mode</div>
                    </div>
                    <div className="rpa__modeCardRadio">
                      <input type="radio" name="bulkMode" checked={bulkTargetMode === 'ALL'} readOnly />
                    </div>
                  </div>

                  <div
                    className={`rpa__modeCard ${bulkTargetMode === 'LIGHT' ? 'selected' : ''}`}
                    onClick={() => setBulkTargetMode('LIGHT')}
                  >
                    <div className="rpa__modeCardIcon light">
                      <i className="bi bi-sun-fill"></i>
                    </div>
                    <div className="rpa__modeCardContent">
                      <div className="rpa__modeCardName">Mode Light</div>
                    </div>
                    <div className="rpa__modeCardRadio">
                      <input type="radio" name="bulkMode" checked={bulkTargetMode === 'LIGHT'} readOnly />
                    </div>
                  </div>

                  <div
                    className={`rpa__modeCard ${bulkTargetMode === 'DARK' ? 'selected' : ''}`}
                    onClick={() => setBulkTargetMode('DARK')}
                  >
                    <div className="rpa__modeCardIcon dark">
                      <i className="bi bi-moon-stars-fill"></i>
                    </div>
                    <div className="rpa__modeCardContent">
                      <div className="rpa__modeCardName">Mode Dark</div>
                    </div>
                    <div className="rpa__modeCardRadio">
                      <input type="radio" name="bulkMode" checked={bulkTargetMode === 'DARK'} readOnly />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Target Roles Multi-Select Dropdown */}
              <div className="rpa__bulkSection">
                <div className="rpa__bulkSectionHead">
                  <label className="rpa__bulkSectionTitle">
                    <span className="step-num">2</span> Pilih Role Target:
                  </label>
                  <div className="rpa__bulkShortcuts">
                    <button
                      type="button"
                      className="rpa__shortcutBtn"
                      onClick={() => setBulkSelectedRoles(nonAdminRoleOptions.map(o => o.value))}
                    >
                      Semua Non-Admin
                    </button>
                    <button
                      type="button"
                      className="rpa__shortcutBtn"
                      onClick={() => setBulkSelectedRoles(nonAdminRoleOptions.filter(o => ['GURU', 'WALI_KELAS', 'GURU_ASUH', 'WKM_AKADEMIK', 'WKM_KESISWAAN', 'WKM_KEASRAMAAN', 'KAMAD'].includes(o.value.toUpperCase())).map(o => o.value))}
                    >
                      Pendidik & Staff
                    </button>
                    <button
                      type="button"
                      className="rpa__shortcutBtn"
                      onClick={() => setBulkSelectedRoles(nonAdminRoleOptions.filter(o => ['SISWA', 'ORANG_TUA', 'WALI', 'PENGURUS_KELAS'].includes(o.value.toUpperCase())).map(o => o.value))}
                    >
                      Siswa & Wali
                    </button>
                    <button
                      type="button"
                      className="rpa__shortcutBtn reset"
                      onClick={() => setBulkSelectedRoles([])}
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <Select<RoleSelectOption, true>
                  isMulti
                  value={nonAdminRoleOptions.filter(o => bulkSelectedRoles.includes(o.value))}
                  onChange={(selected: MultiValue<RoleSelectOption>) => {
                    setBulkSelectedRoles((selected || []).map(s => s.value))
                  }}
                  options={nonAdminRoleOptions}
                  placeholder="Ketik atau pilih role..."
                  closeMenuOnSelect={false}
                  styles={customSelectStyles}
                  className="rpa__bulkSelect"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="cancel" onClick={() => setShowBulkModal(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              icon="check-circle-fill"
              onClick={handleApplyBulkTheme}
              disabled={bulkSelectedRoles.length === 0 || bulkSaving}
              isLoading={bulkSaving}
            >
              Terapkan ke {bulkSelectedRoles.length} Role
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <style jsx>{`
        .rpa { display: flex; flex-direction: column; gap: 14px; }

        .rpa__intro,
        .rpa__sectionIntro {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .rpa__intro h2,
        .rpa__sectionIntro h3 {
          margin: 0;
          color: var(--n-ink, #0f172a);
          font-size: 1rem;
          font-weight: 750;
        }
        .rpa__intro p,
        .rpa__sectionIntro p {
          margin: 0;
          color: var(--n-muted, #64748b);
          font-size: 0.82rem;
          line-height: 1.5;
        }
        .rpa__section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rpa__headerBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: var(--n-card, #ffffff);
          border: 1.5px solid var(--n-border, #e2e8f0);
          border-radius: 14px;
          padding: 10px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          flex-wrap: wrap;
        }

        .rpa__headerLeft {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
          flex-wrap: wrap;
        }

        .rpa__dropdownArea {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 280px;
          flex: 1;
          max-width: 400px;
        }

        .rpa__fieldLabel {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .rpa__fieldLabel i { color: #2563eb; }

        .rpa__selectBox {
          flex: 1;
          min-width: 0;
        }

        .rpa__optionRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
        }

        .rpa__optionName {
          font-weight: 700;
          font-size: 0.82rem;
        }

        .rpa__optionMeta {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .rpa__optionCount {
          font-size: 0.72rem;
          background: rgba(0,0,0,0.08);
          padding: 1px 6px;
          border-radius: 4px;
        }

        .rpa__optionMode {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .rpa__optionMode.all { background: #dbeafe; color: #1d4ed8; }
        .rpa__optionMode.light { background: #fef3c7; color: #b45309; }
        .rpa__optionMode.dark { background: #e2e8f0; color: #334155; }

        .rpa__quickPills {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .rpa__quickTitle {
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          margin-right: 2px;
        }

        .rpa__quickPill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1.2px solid var(--n-border, #cbd5e1);
          background: var(--n-card, #ffffff);
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--n-muted, #475569);
          cursor: pointer;
          transition: all 0.15s;
        }
        .rpa__quickPill:hover {
          border-color: #2563eb;
          color: #2563eb;
          transform: translateY(-1px);
        }
        .rpa__quickPill.active {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 3px 10px rgba(0, 56, 168, 0.25);
        }

        .rpa__quickCount {
          font-size: 0.68rem;
          background: rgba(0, 0, 0, 0.08);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .rpa__quickPill.active .rpa__quickCount {
          background: rgba(255, 255, 255, 0.25);
        }

        .rpa__headerRight {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rpa__bulkActionBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
          color: #ffffff;
          border: none;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
        }
        .rpa__bulkActionBtn:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
        }

        /* ── TOOLBAR AREA ── */
        .rpa__toolbarInfo {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .rpa__count { font-size: 0.85rem; color: var(--n-muted, #64748b); }
        .rpa__count b { color: var(--n-primary, #2563eb); }
        .rpa__warn {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 700;
          color: #b45309; background: #fef3c7; border: 1px solid #fcd34d;
          padding: 4px 10px; border-radius: 999px; cursor: help;
        }

        /* ── ACTIVE ROLE THEME CARD (SEGMENTED 3-CHOICE) ── */
        .rpa__themeCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: var(--n-card, #ffffff);
          border: 1.5px solid var(--n-border, #e2e8f0);
          border-radius: 14px;
          padding: 10px 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          flex-wrap: wrap;
        }
        .rpa__themeCardLeft {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .rpa__themeIcon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          flex-shrink: 0;
        }
        .rpa__themeIcon.all { background: #eff6ff; color: #2563eb; border: 1.5px solid #bfdbfe; }
        .rpa__themeIcon.light { background: #fefce8; color: #d97706; border: 1.5px solid #fde68a; }
        .rpa__themeIcon.dark { background: #0f172a; color: #93c5fd; border: 1.5px solid #334155; }

        .rpa__themeInfo {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rpa__themeTitle {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
        }

        .rpa__themeCardRight {
          flex-shrink: 0;
        }
        .rpa__themeBadge.locked {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        /* Segmented Buttons */
        .rpa__segmentedGroup {
          display: inline-flex;
          background: var(--n-soft, #f1f5f9);
          padding: 4px;
          border-radius: 12px;
          gap: 4px;
          border: 1px solid var(--n-border, #cbd5e1);
        }
        .rpa__segBtn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          border: none;
          background: transparent;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          cursor: pointer;
          transition: all 0.15s;
        }
        .rpa__segBtn:hover:not(.active) {
          color: var(--n-ink, #0f172a);
          background: rgba(0, 0, 0, 0.04);
        }
        .rpa__segBtn.active.all {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
        }
        .rpa__segBtn.active.light {
          background: #d97706;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(217, 119, 6, 0.3);
        }
        .rpa__segBtn.active.dark {
          background: #1e293b;
          color: #93c5fd;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
        }

        /* ── PAGE GROUPS ── */
        .rpa__loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          min-height: 240px;
          width: 100%;
        }
        .rpa__groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
        .rpa__group { background: var(--n-card, #ffffff); border: 1px solid var(--n-border, #e2e8f0); border-radius: 14px; overflow: hidden; }
        .rpa__groupHead {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; flex-wrap: wrap;
          padding: 12px 14px; border-bottom: 1px solid var(--n-border, #e2e8f0); background: var(--n-soft, #f8fafc);
        }
        .rpa__groupTitle { font-size: 0.85rem; font-weight: 700; color: var(--n-ink, #0f172a); display: flex; align-items: center; gap: 8px; min-width: 0; }
        .rpa__groupTitle i { color: #2563eb; font-size: 0.8rem; flex-shrink: 0; }
        .rpa__groupCount {
          flex-shrink: 0;
          padding: 2px 7px;
          border-radius: 999px;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #e2e8f0);
          color: var(--n-muted, #64748b);
          font-size: 0.68rem;
          font-weight: 700;
        }
        .rpa__groupBtns { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
        .rpa__groupToggle {
          font-size: 0.7rem; font-weight: 700; border: 1px solid var(--n-border, #cbd5e1); background: var(--n-card, #ffffff);
          color: var(--n-muted, #64748b); padding: 4px 10px; border-radius: 8px; cursor: pointer;
        }
        .rpa__groupToggle:hover { border-color: #2563eb; color: #2563eb; }
        .rpa__groupToggle.on { color: #2563eb; }
        .rpa__flatToggle {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 0.7rem; font-weight: 700; border: 1px solid var(--n-border, #cbd5e1); background: var(--n-card, #ffffff);
          color: var(--n-muted, #64748b); padding: 4px 9px; border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .rpa__flatToggle:hover { border-color: #2563eb; color: #2563eb; }
        .rpa__flatToggle.flat { background: #2563eb; color: #fff; border-color: transparent; }
        .rpa__pages { display: flex; flex-direction: column; gap: 2px; padding: 8px; }
        .rpa__page {
          display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px;
          cursor: pointer; transition: all 0.12s; border: 1.5px solid transparent;
        }
        .rpa__page:hover { background: var(--n-soft, #f1f5f9); }
        .rpa__page.selected { background: rgba(0,56,168,0.06); }
        .rpa__page.warn.selected { background: rgba(217,119,6,0.10); }
        .rpa__page input { width: 16px; height: 16px; accent-color: #2563eb; flex-shrink: 0; }
        .rpa__pageLabel { flex: 1; font-size: 0.82rem; font-weight: 600; color: var(--n-ink, #0f172a); }
        .rpa__pageWarn { color: #d97706; font-size: 0.8rem; flex-shrink: 0; cursor: help; }
        .rpa__pageId { font-size: 0.66rem; color: var(--n-muted, #64748b); font-family: monospace; }

        /* ── BULK MODAL STYLING ── */
        .rpa__bulkBody {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 6px 0;
        }
        .rpa__bulkSection {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rpa__bulkSectionHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .rpa__bulkSectionTitle {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rpa__bulkSectionTitle .step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #2563eb;
          color: white;
          font-size: 0.75rem;
          font-weight: 800;
        }

        .rpa__bulkShortcuts {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .rpa__shortcutBtn {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          background: var(--n-soft, #f1f5f9);
          border: 1px solid var(--n-border, #cbd5e1);
          color: var(--n-muted, #475569);
          cursor: pointer;
          transition: all 0.15s;
        }
        .rpa__shortcutBtn:hover {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .rpa__shortcutBtn.reset:hover {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        .rpa__modeCards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        .rpa__modeCard {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 2px solid var(--n-border, #e2e8f0);
          background: var(--n-card, #ffffff);
          cursor: pointer;
          transition: all 0.18s;
        }
        .rpa__modeCard:hover {
          border-color: #93c5fd;
          transform: translateY(-1px);
        }
        .rpa__modeCard.selected {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.05);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }

        .rpa__modeCardIcon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.05rem;
          flex-shrink: 0;
        }
        .rpa__modeCardIcon.all { background: #dbeafe; color: #1d4ed8; }
        .rpa__modeCardIcon.light { background: #fefce8; color: #b45309; }
        .rpa__modeCardIcon.dark { background: #1e293b; color: #93c5fd; }

        .rpa__modeCardContent {
          flex: 1;
          min-width: 0;
        }
        .rpa__modeCardName {
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
        }
        .rpa__modeCardRadio input {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
        }

        /* ── DARK MODE STANDARD ── */
        :global(.dark) .rpa__headerBar,
        :global(.dark) .rpa__themeCard,
        :global(.dark) .rpa__group {
          background: #0b1329 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 14px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
        }
        :global(.dark) .rpa__fieldLabel,
        :global(.dark) .rpa__intro h2,
        :global(.dark) .rpa__sectionIntro h3,
        :global(.dark) .rpa__themeTitle,
        :global(.dark) .rpa__groupTitle,
        :global(.dark) .rpa__pageLabel,
        :global(.dark) .rpa__bulkSectionTitle,
        :global(.dark) .rpa__modeCardName {
          color: #e2e8f0 !important;
        }

        :global(.dark) .rpa__quickPill {
          background: #0b1329 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
          color: #60a5fa !important;
        }
        :global(.dark) .rpa__quickPill.active {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          border-color: #3b82f6 !important;
        }

        :global(.dark) .rpa__segmentedGroup {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .rpa__segBtn {
          color: #94a3b8 !important;
        }

        :global(.dark) .rpa__groupHead {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .rpa__page:hover { background: rgba(26, 115, 232, 0.1) !important; }
        :global(.dark) .rpa__page.selected { background: rgba(26, 115, 232, 0.2) !important; }

        :global(.dark) .rpa__modeCard {
          background: #0b0f19 !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
        }
        :global(.dark) .rpa__modeCard.selected {
          border-color: #3b82f6 !important;
          background: rgba(37, 99, 235, 0.15) !important;
        }
        :global(.dark) .rpa__shortcutBtn {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .rpa__themeBadge.locked {
          background: rgba(16, 185, 129, 0.15) !important;
          color: #34d399 !important;
          border-color: rgba(16, 185, 129, 0.4) !important;
        }

        /* ── MOBILE RESPONSIVE OPTIMIZATIONS ── */
        @media (max-width: 768px) {
          .rpa {
            gap: 10px;
          }

          /* Header Bar Mobile */
          .rpa__headerBar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 12px;
          }

          .rpa__headerLeft {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            width: 100%;
          }

          .rpa__dropdownArea {
            min-width: 0;
            max-width: none;
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }

          .rpa__fieldLabel {
            font-size: 0.8rem;
          }

          .rpa__selectBox {
            width: 100%;
          }

          /* Horizontal scrollable pills on mobile (no more stacking) */
          .rpa__quickPills {
            width: 100%;
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 6px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            gap: 6px;
          }
          .rpa__quickPills::-webkit-scrollbar {
            display: none;
          }

          .rpa__quickPill {
            flex-shrink: 0;
            white-space: nowrap;
            padding: 5px 10px;
            font-size: 0.76rem;
          }

          .rpa__headerRight {
            width: 100%;
          }

          .rpa__bulkActionBtn {
            width: 100%;
            justify-content: center;
            padding: 10px 16px;
            font-size: 0.84rem;
          }

          /* Active Theme Card Mobile */
          .rpa__themeCard {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 12px;
          }

          .rpa__themeCardLeft {
            width: 100%;
            align-items: center;
            gap: 10px;
          }

          .rpa__themeIcon {
            width: 32px;
            height: 32px;
            font-size: 1.05rem;
          }

          .rpa__themeTitle {
            font-size: 0.85rem;
          }

          .rpa__themeCardRight {
            width: 100%;
          }

          .rpa__segmentedGroup {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            padding: 3px;
            gap: 3px;
          }

          .rpa__segBtn {
            width: 100%;
            justify-content: center;
            padding: 8px 4px;
            font-size: 0.74rem;
            gap: 4px;
            white-space: nowrap;
          }

          .rpa__themeBadge.locked {
            width: 100%;
            justify-content: center;
            font-size: 0.78rem;
          }

          /* Page Groups Mobile */
          .rpa__groups {
            grid-template-columns: 1fr;
          }

          .rpa__groupHead {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .rpa__groupBtns {
            width: 100%;
            flex-wrap: wrap;
          }

          .rpa__flatToggle,
          .rpa__groupToggle {
            flex: 1;
            justify-content: center;
            min-height: 34px;
          }

          /* Bulk Modal Mobile */
          .rpa__modeCards {
            grid-template-columns: 1fr;
          }

          .rpa__bulkSectionHead {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .rpa__bulkShortcuts {
            width: 100%;
            gap: 4px;
          }

          .rpa__shortcutBtn {
            flex: 1 1 calc(50% - 4px);
            text-align: center;
            padding: 6px 4px;
          }
        }

        @media (max-width: 420px) {
          .rpa__segBtn {
            font-size: 0.68rem;
            padding: 6px 2px;
            gap: 3px;
          }
          .rpa__segBtn i {
            font-size: 0.72rem;
          }
        }
      `}</style>
    </div>
  )
}
