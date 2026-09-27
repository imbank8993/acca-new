'use client'

import { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import Select, { type StylesConfig, type SingleValue, type MultiValue } from 'react-select'
import { MENU_GROUPS, PAGE_LABELS, type MenuGroupDef } from '@/lib/sidebar-menu'
import { formatRoleDisplay } from '@/lib/auth'
import { canAccessPage } from '@/lib/page-requirements'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useModalBlur } from '@/components/ModalBlurProvider'
import { Spinner } from '@/components/ui/Spinner'
import type { ThemeMode } from '@/lib/theme-roles'

const ADMIN_ROLES = new Set(['ADMIN', 'ADMINISTRATOR'])

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
  const [pageSearch, setPageSearch] = useState('')

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

  const roleLacksAccess = (pageId: string) =>
    !!selectedRole && !ADMIN_ROLES.has(selectedRole.toUpperCase()) && !canAccessPage([selectedRole], pageId)

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
        'Akses halaman role ini gagal dimuat. Muat ulang halaman lebih dulu.',
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
      Swal.fire({
        icon: 'success',
        title: 'Tersimpan',
        text: `Akses halaman & tema role ${formatRoleDisplay(selectedRole)} berhasil disimpan.`,
        timer: 2000,
        showConfirmButton: false
      })
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
      Swal.fire('Peringatan', 'Pilih minimal satu role.', 'warning')
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

      const modeTitle = bulkTargetMode === 'ALL' ? 'Semua Mode' : bulkTargetMode === 'DARK' ? 'Mode Dark' : 'Mode Light'
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Mode "${modeTitle}" diterapkan ke ${bulkSelectedRoles.length} role.`,
        timer: 2000,
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

  // Filter groups by pageSearch
  const filteredGroups = useMemo(() => {
    if (!pageSearch.trim()) return groups
    const q = pageSearch.toLowerCase().trim()
    return groups
      .map(g => {
        const groupMatches = g.label.toLowerCase().includes(q)
        const matchedPages = g.pages.filter(p => {
          const l = effectiveLabel(p).toLowerCase()
          return l.includes(q) || p.toLowerCase().includes(q)
        })
        if (!groupMatches && matchedPages.length === 0) return null
        return {
          ...g,
          pages: matchedPages.length > 0 ? matchedPages : g.pages
        }
      })
      .filter(Boolean) as MenuGroupDef[]
  }, [groups, pageSearch, labels])

  // react-select custom styling
  const customSelectStyles: StylesConfig<RoleSelectOption, boolean> = {
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      height: '38px',
      borderRadius: '8px',
      borderColor: state.isFocused ? '#3083FF' : 'var(--n-border, #cbd5e1)',
      backgroundColor: 'var(--n-card, #ffffff)',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(48, 131, 255, 0.15)' : 'none',
      '&:hover': {
        borderColor: '#3083FF'
      },
      fontSize: '0.84rem',
      fontWeight: '600'
    }),
    valueContainer: base => ({
      ...base,
      height: '38px',
      padding: '0 10px'
    }),
    indicatorsContainer: base => ({
      ...base,
      height: '38px'
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '0.82rem',
      fontWeight: '600',
      backgroundColor: state.isSelected
        ? '#3083FF'
        : state.isFocused
        ? 'rgba(48, 131, 255, 0.1)'
        : 'transparent',
      color: state.isSelected ? '#ffffff' : 'var(--n-ink, #0f172a)',
      cursor: 'pointer'
    }),
    singleValue: base => ({
      ...base,
      color: 'var(--n-ink, #0f172a)',
      fontWeight: '700'
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
      {/* ── 1. UNIFIED STUDIO CONTROL BAR ── */}
      <div className="rpa__studioBar">
        {/* Role Selector & Quick Chips */}
        <div className="rpa__roleArea">
          <div className="rpa__selectBox">
            <Select<RoleSelectOption, false>
              value={roleSelectOptions.find(o => o.value === selectedRole) || null}
              onChange={(opt: SingleValue<RoleSelectOption>) => opt && setSelectedRole(opt.value)}
              options={roleSelectOptions}
              placeholder="Pilih role..."
              isSearchable
              styles={customSelectStyles}
              classNamePrefix="rpa-select"
              formatOptionLabel={(option: RoleSelectOption) => (
                <div className="rpa__optionRow">
                  <span className="rpa__optionName">{formatRoleDisplay(option.value)}</span>
                  <div className="rpa__optionMeta">
                    <span className="rpa__optionCount">{option.count || 0} user</span>
                    <span className={`rpa__optionMode ${(option.mode || 'light').toLowerCase()}`}>
                      {option.mode === 'ALL' ? '🌗' : option.mode === 'DARK' ? '🌙' : '☀️'}
                    </span>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        {/* Theme Segmented Control & Actions */}
        <div className="rpa__rightControl">
          {/* Theme Mode Segmented Pill */}
          {selectedRole && (
            <div className="rpa__themeWrap">
              {currentRoleIsAdmin ? (
                <span className="rpa__adminThemeBadge" title="Admin dapat menggunakan semua mode">
                  <i className="bi bi-shield-check"></i> Mode Bebas
                </span>
              ) : (
                <div className="rpa__segGroup" role="group" aria-label="Mode Tema">
                  <button
                    type="button"
                    className={`rpa__segBtn ${currentRoleMode === 'ALL' ? 'active all' : ''}`}
                    onClick={() => setModeForRole(selectedRole, 'ALL')}
                    title="User bebas memilih tema terang / gelap"
                  >
                    <i className="bi bi-circle-half"></i>
                    <span>Semua</span>
                  </button>
                  <button
                    type="button"
                    className={`rpa__segBtn ${currentRoleMode === 'LIGHT' ? 'active light' : ''}`}
                    onClick={() => setModeForRole(selectedRole, 'LIGHT')}
                    title="Kunci ke Mode Terang"
                  >
                    <i className="bi bi-sun-fill"></i>
                    <span>Terang</span>
                  </button>
                  <button
                    type="button"
                    className={`rpa__segBtn ${currentRoleMode === 'DARK' ? 'active dark' : ''}`}
                    onClick={() => setModeForRole(selectedRole, 'DARK')}
                    title="Kunci ke Mode Gelap"
                  >
                    <i className="bi bi-moon-stars-fill"></i>
                    <span>Gelap</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                className="rpa__bulkIconBtn"
                onClick={() => setShowBulkModal(true)}
                title="Atur tema massal untuk banyak role"
              >
                <i className="bi bi-sliders"></i>
              </button>
            </div>
          )}

          {/* Save Action */}
          <div className="rpa__saveWrap">
            <Button
              variant="primary"
              icon="save"
              onClick={save}
              disabled={!dirty || saving || !selectedRole || gagalMuatAkses}
              isLoading={saving}
            >
              Simpan
            </Button>
            {dirty && <span className="rpa__dirtyPulse" title="Ada perubahan belum tersimpan"></span>}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {gagalMuatAkses && !loading && (
        <div className="rpa__errorAlert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>Akses halaman role ini gagal dimuat. Penyimpanan dinonaktifkan untuk mencegah terhapusnya menu tersimpan. Muat ulang halaman untuk mencoba lagi.</span>
        </div>
      )}

      {/* ── 2. SUB-BAR: SEARCH & STATS ── */}
      <div className="rpa__subBar">
        <div className="rpa__searchBox">
          <i className="bi bi-search rpa__searchIcon"></i>
          <input
            type="text"
            className="rpa__searchInput"
            placeholder="Cari nama halaman..."
            value={pageSearch}
            onChange={e => setPageSearch(e.target.value)}
          />
          {pageSearch && (
            <button
              type="button"
              className="rpa__searchClear"
              onClick={() => setPageSearch('')}
              title="Bersihkan pencarian"
            >
              <i className="bi bi-x-circle-fill"></i>
            </button>
          )}
        </div>

        <div className="rpa__statsArea">
          <span className="rpa__statBadge">
            <i className="bi bi-check2-square"></i>
            <span><b>{totalSelected}</b> / {totalPages} halaman aktif</span>
          </span>

          {warnCount > 0 && (
            <span
              className="rpa__warnBadge"
              title="Halaman muncul di menu tapi role belum memiliki hak akses fungsional di halaman terkait."
            >
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{warnCount} terbatas</span>
            </span>
          )}
        </div>
      </div>

      {/* ── 3. GROUPED PAGE CHECKLIST ── */}
      {loading ? (
        <div className="rpa__loading">
          <Spinner variant="trace" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rpa__emptySearch">
          <i className="bi bi-search"></i>
          <span>Tidak ada halaman yang cocok dengan &quot;{pageSearch}&quot;</span>
        </div>
      ) : (
        <div className="rpa__groups">
          {filteredGroups.map(group => {
            const allOn = group.pages.length > 0 && group.pages.every(p => pageIds.has(p))
            const someOn = group.pages.some(p => pageIds.has(p))
            const isFlat = flatGroups.has(group.key)
            const selectedInGroup = group.pages.filter(page => pageIds.has(page)).length

            return (
              <div key={group.key} className="rpa__groupCard">
                {/* Header Grup */}
                <div className="rpa__groupHeader">
                  <div className="rpa__groupTitleWrap">
                    <span className="rpa__groupTitle">
                      <i className={`fa-solid ${group.icon} rpa__groupIcon`}></i>
                      <span>{group.label}</span>
                    </span>
                    <span className={`rpa__groupBadge ${selectedInGroup > 0 ? 'hasSelected' : ''}`}>
                      {selectedInGroup}/{group.pages.length}
                    </span>
                  </div>

                  <div className="rpa__groupActions">
                    {/* Toggle Tampilan Flat / Grup */}
                    <button
                      type="button"
                      className={`rpa__actionBtn ${isFlat ? 'isFlat' : ''}`}
                      onClick={() => toggleFlat(group.key)}
                      title={isFlat ? 'Halaman grup ini tampil rata di sidebar' : 'Halaman grup ini tampil berkelompok di sidebar'}
                    >
                      <i className={`bi ${isFlat ? 'bi-list' : 'bi-folder2'}`}></i>
                      <span>{isFlat ? 'Rata' : 'Grup'}</span>
                    </button>

                    {/* Toggle Pilih Semua */}
                    <button
                      type="button"
                      className={`rpa__actionBtn ${allOn ? 'allOn' : someOn ? 'someOn' : ''}`}
                      onClick={() => toggleGroup(group.pages, allOn)}
                      title={allOn ? 'Hapus semua pilihan di grup ini' : 'Pilih semua halaman di grup ini'}
                    >
                      <i className={`bi ${allOn ? 'bi-dash-square' : 'bi-check-square'}`}></i>
                      <span>{allOn ? 'Batal' : 'Semua'}</span>
                    </button>
                  </div>
                </div>

                {/* Grid Halaman Tile */}
                <div className="rpa__pagesGrid">
                  {group.pages.map(p => {
                    const isSelected = pageIds.has(p)
                    const lacks = roleLacksAccess(p)

                    return (
                      <label
                        key={p}
                        className={`rpa__tile ${isSelected ? 'isSelected' : ''} ${lacks ? 'isWarn' : ''}`}
                        title={lacks ? `ID: ${p} (Role belum memiliki hak fungsional pada halaman ini)` : `ID: ${p}`}
                      >
                        <input
                          type="checkbox"
                          className="rpa__hiddenCheck"
                          checked={isSelected}
                          onChange={() => togglePage(p)}
                        />
                        <span className={`rpa__checkMark ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <i className="bi bi-check-lg"></i>}
                        </span>

                        <span className="rpa__tileLabel">{effectiveLabel(p)}</span>

                        {lacks && (
                          <i
                            className="bi bi-exclamation-circle-fill rpa__tileWarn"
                            title="Halaman muncul di menu, tapi izin akses fungsional role ini belum diatur."
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
      )}

      {/* ── 4. MODAL ATUR TEMA MASSAL ── */}
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
              <div className="rpa__bulkSection">
                <label className="rpa__bulkSectionTitle">
                  <span className="step-num">1</span> Pilih Mode Tampilan:
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
                      <div className="rpa__modeCardName">Mode Terang</div>
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
                      <div className="rpa__modeCardName">Mode Gelap</div>
                    </div>
                    <div className="rpa__modeCardRadio">
                      <input type="radio" name="bulkMode" checked={bulkTargetMode === 'DARK'} readOnly />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rpa__bulkSection">
                <div className="rpa__bulkSectionHead">
                  <label className="rpa__bulkSectionTitle">
                    <span className="step-num">2</span> Terapkan ke Role:
                  </label>
                  <div className="rpa__bulkShortcuts">
                    <button
                      type="button"
                      className="rpa__shortcutBtn"
                      onClick={() => setBulkSelectedRoles(nonAdminRoleOptions.map(o => o.value))}
                    >
                      Pilih Semua ({nonAdminRoleOptions.length})
                    </button>
                    <button
                      type="button"
                      className="rpa__shortcutBtn reset"
                      onClick={() => setBulkSelectedRoles([])}
                    >
                      Reset
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

      {/* ── CSS STYLING (OPTION 1 — UNIFIED STUDIO) ── */}
      <style jsx>{`
        .rpa {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── 1. UNIFIED STUDIO BAR ── */
        .rpa__studioBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #cbd5e1);
          border-radius: 12px;
          padding: 8px 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          flex-wrap: wrap;
        }

        .rpa__roleArea {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rpa__selectBox {
          width: 260px;
          min-width: 220px;
          flex-shrink: 0;
        }

        .rpa__optionRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 8px;
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
          font-size: 0.70rem;
          background: rgba(0, 0, 0, 0.08);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .rpa__optionMode {
          font-size: 0.72rem;
        }

        .rpa__rightControl {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .rpa__themeWrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .rpa__adminThemeBadge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #059669;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 4px 10px;
          border-radius: 8px;
        }

        .rpa__segGroup {
          display: inline-flex;
          align-items: center;
          background: var(--n-soft, #f1f5f9);
          border: 1px solid var(--n-border, #cbd5e1);
          border-radius: 8px;
          padding: 2px;
          gap: 2px;
        }

        .rpa__segBtn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--n-muted, #64748b);
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .rpa__segBtn:hover:not(.active) {
          color: var(--n-ink, #0f172a);
          background: rgba(0, 0, 0, 0.04);
        }
        .rpa__segBtn.active.all {
          background: #3083FF;
          color: #ffffff;
          box-shadow: 0 1px 4px rgba(48, 131, 255, 0.25);
        }
        .rpa__segBtn.active.light {
          background: #d97706;
          color: #ffffff;
          box-shadow: 0 1px 4px rgba(217, 119, 6, 0.25);
        }
        .rpa__segBtn.active.dark {
          background: #1e293b;
          color: #93c5fd;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
        }

        .rpa__bulkIconBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--n-border, #cbd5e1);
          background: var(--n-card, #ffffff);
          color: var(--n-muted, #64748b);
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.15s ease;
        }
        .rpa__bulkIconBtn:hover {
          color: #3083FF;
          border-color: #3083FF;
          background: rgba(48, 131, 255, 0.06);
        }

        .rpa__saveWrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .rpa__dirtyPulse {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 0 2px #ffffff;
          animation: pulse 1.8s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }

        .rpa__errorAlert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--n-warning, #f59e0b);
          background: #fffbeb;
          color: #b45309;
          font-size: 0.8rem;
          font-weight: 600;
        }

        /* ── 2. SUB-BAR: SEARCH & STATS ── */
        .rpa__subBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .rpa__searchBox {
          position: relative;
          display: flex;
          align-items: center;
          width: 280px;
        }

        .rpa__searchIcon {
          position: absolute;
          left: 10px;
          color: var(--n-muted, #94a3b8);
          font-size: 0.8rem;
          pointer-events: none;
        }

        .rpa__searchInput {
          width: 100%;
          height: 34px;
          padding: 0 28px 0 32px;
          border-radius: 8px;
          border: 1px solid var(--n-border, #cbd5e1);
          background: var(--n-card, #ffffff);
          color: var(--n-ink, #0f172a);
          font-size: 0.82rem;
          font-weight: 500;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .rpa__searchInput:focus {
          border-color: #3083FF;
          box-shadow: 0 0 0 2px rgba(48, 131, 255, 0.15);
        }

        .rpa__searchClear {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          color: var(--n-muted, #94a3b8);
          cursor: pointer;
          padding: 0;
          font-size: 0.85rem;
          line-height: 1;
        }
        .rpa__searchClear:hover {
          color: #ef4444;
        }

        .rpa__statsArea {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rpa__statBadge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: var(--n-muted, #64748b);
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #cbd5e1);
          padding: 4px 10px;
          border-radius: 8px;
        }
        .rpa__statBadge b {
          color: #3083FF;
        }

        .rpa__warnBadge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #b45309;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          padding: 4px 9px;
          border-radius: 8px;
        }

        /* ── 3. GROUPED PAGE CHECKLIST ── */
        .rpa__loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          min-height: 200px;
          width: 100%;
        }

        .rpa__emptySearch {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 8px;
          color: var(--n-muted, #64748b);
          font-size: 0.85rem;
          background: var(--n-card, #ffffff);
          border: 1px dashed var(--n-border, #cbd5e1);
          border-radius: 12px;
        }
        .rpa__emptySearch i {
          font-size: 1.5rem;
          opacity: 0.5;
        }

        .rpa__groups {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 12px;
        }

        .rpa__groupCard {
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #cbd5e1);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .rpa__groupCard:hover {
          border-color: #93c5fd;
        }

        .rpa__groupHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--n-soft, #f8fafc);
          border-bottom: 1px solid var(--n-border, #e2e8f0);
          gap: 8px;
        }

        .rpa__groupTitleWrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }

        .rpa__groupTitle {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rpa__groupIcon {
          color: #3083FF;
          font-size: 0.80rem;
          flex-shrink: 0;
        }

        .rpa__groupBadge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 6px;
          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, #cbd5e1);
          color: var(--n-muted, #64748b);
          flex-shrink: 0;
        }
        .rpa__groupBadge.hasSelected {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .rpa__groupActions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .rpa__actionBtn {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 3px 7px;
          border-radius: 6px;
          border: 1px solid var(--n-border, #cbd5e1);
          background: var(--n-card, #ffffff);
          color: var(--n-muted, #64748b);
          font-size: 0.68rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .rpa__actionBtn:hover {
          color: #3083FF;
          border-color: #3083FF;
        }
        .rpa__actionBtn.isFlat {
          background: #3083FF;
          color: #ffffff;
          border-color: #3083FF;
        }
        .rpa__actionBtn.allOn {
          color: #ef4444;
          border-color: #fca5a5;
          background: #fef2f2;
        }
        .rpa__actionBtn.someOn {
          color: #3083FF;
        }

        /* Pages Grid */
        .rpa__pagesGrid {
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .rpa__tile {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid transparent;
          background: transparent;
          transition: all 0.12s ease;
          user-select: none;
        }
        .rpa__tile:hover {
          background: var(--n-soft, #f1f5f9);
        }
        .rpa__tile.isSelected {
          background: rgba(48, 131, 255, 0.08);
          border-color: rgba(48, 131, 255, 0.3);
        }
        .rpa__tile.isWarn.isSelected {
          background: rgba(217, 119, 6, 0.10);
          border-color: rgba(217, 119, 6, 0.35);
        }

        .rpa__hiddenCheck {
          display: none;
        }

        .rpa__checkMark {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          border: 1.5px solid var(--n-border, #94a3b8);
          background: var(--n-card, #ffffff);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .rpa__checkMark.checked {
          background: #3083FF;
          border-color: #3083FF;
          color: #ffffff;
          font-size: 0.75rem;
        }

        .rpa__tileLabel {
          flex: 1;
          font-size: 0.80rem;
          font-weight: 600;
          color: var(--n-ink, #0f172a);
          line-height: 1.3;
        }
        .rpa__tile.isSelected .rpa__tileLabel {
          color: var(--n-primary, #1d4ed8);
          font-weight: 700;
        }

        .rpa__tileWarn {
          color: #d97706;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        /* ── 4. BULK MODAL ── */
        .rpa__bulkBody {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 4px 0;
        }
        .rpa__bulkSection {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rpa__bulkSectionHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .rpa__bulkSectionTitle {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .rpa__bulkSectionTitle .step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3083FF;
          color: white;
          font-size: 0.70rem;
          font-weight: 800;
        }

        .rpa__bulkShortcuts {
          display: flex;
          gap: 6px;
        }
        .rpa__shortcutBtn {
          font-size: 0.70rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          background: var(--n-soft, #f1f5f9);
          border: 1px solid var(--n-border, #cbd5e1);
          color: var(--n-muted, #475569);
          cursor: pointer;
        }
        .rpa__shortcutBtn:hover {
          background: #3083FF;
          color: white;
          border-color: #3083FF;
        }
        .rpa__shortcutBtn.reset:hover {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        .rpa__modeCards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .rpa__modeCard {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1.5px solid var(--n-border, #e2e8f0);
          background: var(--n-card, #ffffff);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .rpa__modeCard:hover {
          border-color: #93c5fd;
        }
        .rpa__modeCard.selected {
          border-color: #3083FF;
          background: rgba(48, 131, 255, 0.05);
        }
        .rpa__modeCardIcon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .rpa__modeCardIcon.all { background: #dbeafe; color: #1d4ed8; }
        .rpa__modeCardIcon.light { background: #fefce8; color: #b45309; }
        .rpa__modeCardIcon.dark { background: #1e293b; color: #93c5fd; }
        .rpa__modeCardName {
          font-size: 0.80rem;
          font-weight: 700;
          color: var(--n-ink, #0f172a);
          flex: 1;
        }
        .rpa__modeCardRadio input {
          width: 14px;
          height: 14px;
          accent-color: #3083FF;
        }

        /* ── DARK MODE ── */
        :global(.dark) .rpa__studioBar,
        :global(.dark) .rpa__groupCard,
        :global(.dark) .rpa__statBadge,
        :global(.dark) .rpa__searchInput {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
          color: #e2e8f0 !important;
        }

        :global(.dark) .rpa__groupHeader {
          background: rgba(15, 23, 42, 0.6) !important;
          border-bottom-color: rgba(26, 115, 232, 0.3) !important;
        }

        :global(.dark) .rpa__groupTitle {
          color: #f8fafc !important;
        }

        :global(.dark) .rpa__groupBadge {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
          color: #94a3b8 !important;
        }
        :global(.dark) .rpa__groupBadge.hasSelected {
          background: rgba(48, 131, 255, 0.2) !important;
          color: #60a5fa !important;
        }

        :global(.dark) .rpa__actionBtn {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.3) !important;
          color: #94a3b8 !important;
        }

        :global(.dark) .rpa__tile:hover {
          background: rgba(26, 115, 232, 0.1) !important;
        }
        :global(.dark) .rpa__tile.isSelected {
          background: rgba(48, 131, 255, 0.16) !important;
          border-color: rgba(48, 131, 255, 0.4) !important;
        }
        :global(.dark) .rpa__tileLabel {
          color: #cbd5e1 !important;
        }
        :global(.dark) .rpa__tile.isSelected .rpa__tileLabel {
          color: #60a5fa !important;
        }
        :global(.dark) .rpa__checkMark {
          background: #0f172a !important;
          border-color: #64748b !important;
        }
        :global(.dark) .rpa__checkMark.checked {
          background: #3083FF !important;
          border-color: #3083FF !important;
        }

        :global(.dark) .rpa__segGroup {
          background: #0f172a !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .rpa__bulkIconBtn {
          background: #0b1329 !important;
          border-color: rgba(26, 115, 232, 0.4) !important;
        }

        /* ── RESPONSIVE MOBILE ── */
        @media (max-width: 768px) {
          .rpa__studioBar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .rpa__roleArea {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
          }
          .rpa__selectBox {
            width: 100%;
          }
          .rpa__rightControl {
            width: 100%;
            justify-content: space-between;
          }
          .rpa__themeWrap {
            flex: 1;
          }
          .rpa__subBar {
            flex-direction: column;
            align-items: stretch;
          }
          .rpa__searchBox {
            width: 100%;
          }
          .rpa__statsArea {
            justify-content: space-between;
          }
          .rpa__groups {
            grid-template-columns: 1fr;
          }
          .rpa__modeCards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
