'use client'

import { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import { MENU_GROUPS, PAGE_LABELS, type MenuGroupDef } from '@/lib/sidebar-menu'
import { PageLoader } from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

const ICON_OPTIONS = [
  // General, Navigation & External
  'fa-house', 'fa-compass', 'fa-globe', 'fa-link', 'fa-arrow-up-right-from-square', 'fa-ellipsis',

  // Education & Academic (Class, School, Graduation)
  'fa-graduation-cap', 'fa-school', 'fa-landmark', 'fa-chalkboard', 'fa-chalkboard-user', 
  'fa-book', 'fa-book-open', 'fa-scroll', 'fa-award',

  // People & User Management (Guru, Siswa, Piket)
  'fa-users', 'fa-user-graduate', 'fa-user-tie', 'fa-user-gear', 'fa-user-shield', 
  'fa-user-check', 'fa-user-slash', 'fa-id-card',

  // Forms, Tasks & Documents
  'fa-folder', 'fa-folder-open', 'fa-file-lines', 'fa-file-pen', 'fa-file-signature', 'fa-file-pdf', 'fa-file-invoice',
  'fa-clipboard-list', 'fa-clipboard-user', 'fa-list-check', 'fa-pen-clip', 'fa-stamp',

  // Communication & Notifications
  'fa-envelope', 'fa-comments', 'fa-bullhorn', 'fa-bell',

  // Devices & Monitoring (Komputer, TV)
  'fa-computer', 'fa-desktop', 'fa-laptop', 'fa-tv', 'fa-eye',

  // Performance & Stats (Monitoring, Kinerja)
  'fa-gauge-high', 'fa-chart-line', 'fa-chart-column', 'fa-chart-pie', 'fa-chart-simple', 'fa-ranking-star',

  // Tools, Security & Settings
  'fa-gear', 'fa-wrench', 'fa-screwdriver-wrench', 'fa-sliders', 'fa-key', 'fa-lock', 'fa-shield',

  // System, Utilities & Structure
  'fa-database', 'fa-cloud', 'fa-print', 'fa-clock', 'fa-sitemap', 'fa-layer-group',

  // Health, Finance & Polls
  'fa-heart-pulse', 'fa-hospital', 'fa-wallet', 'fa-money-bill', 'fa-scale-balanced', 'fa-square-poll-vertical',

  // Misc & Action
  'fa-star', 'fa-heart', 'fa-flag', 'fa-image', 'fa-video', 'fa-circle-info', 'fa-circle-question',
  'fa-rocket', 'fa-bolt', 'fa-cube'
]

type DragInfo = { fromGroup: number; pageId: string } | null

export default function MenuLayoutTab() {
  const [groups, setGroups] = useState<MenuGroupDef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [initial, setInitial] = useState('')
  const [drag, setDrag] = useState<DragInfo>(null)
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/menu-layout')
      .then(r => r.json())
      .then(d => {
        if (!d?.ok || !Array.isArray(d.layout)) throw new Error(d?.error || 'Gagal memuat susunan menu')
        // Layout kosong = belum pernah disusun → mulai dari template bawaan.
        // Kalau request GAGAL kita TIDAK memakai template, supaya susunan yang
        // sah di DB tidak tertimpa saat admin menekan Simpan.
        const layout: MenuGroupDef[] = d.layout.length ? d.layout : MENU_GROUPS
        const lbls: Record<string, string> = (d.labels && typeof d.labels === 'object') ? d.labels : {}
        setGroups(layout)
        setLabels(lbls)
        setInitial(JSON.stringify({ groups: layout, labels: lbls }))
        setLoadError(null)
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Gagal memuat susunan menu'))
      .finally(() => setLoading(false))
  }, [])

  const dirty = useMemo(() => JSON.stringify({ groups, labels }) !== initial, [groups, labels, initial])

  // Effective display name = custom override || built-in default || id.
  const effectiveLabel = (id: string) => labels[id] ?? PAGE_LABELS[id] ?? id
  const renameLabel = (id: string, val: string) => {
    const def = PAGE_LABELS[id] ?? id
    setLabels(prev => {
      const next = { ...prev }
      if (!val.trim() || val.trim() === def) delete next[id] // back to default → no override
      else next[id] = val
      return next
    })
  }

  const assignedIds = useMemo(() => {
    const s = new Set<string>()
    groups.forEach(g => g.pages.forEach(p => s.add(p)))
    return s
  }, [groups])

  const unassigned = useMemo(
    () => Object.keys(PAGE_LABELS).filter(id => !assignedIds.has(id)),
    [assignedIds]
  )

  // ── Group ops ──
  const addGroup = () => {
    setGroups(prev => [...prev, {
      key: `grup-${Date.now()}`,
      label: 'Grup Baru',
      icon: 'fa-folder',
      pages: [],
    }])
  }
  const updateGroup = (idx: number, patch: Partial<MenuGroupDef>) => {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, ...patch } : g))
  }
  const deleteGroup = (idx: number) => {
    setGroups(prev => prev.filter((_, i) => i !== idx))
  }
  const moveGroup = (idx: number, dir: -1 | 1) => {
    setGroups(prev => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }
  // ── Page ops ──
  const movePage = (groupIdx: number, pageIdx: number, dir: -1 | 1) => {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g
      const pages = [...g.pages]
      const j = pageIdx + dir
      if (j < 0 || j >= pages.length) return g
      ;[pages[pageIdx], pages[j]] = [pages[j], pages[pageIdx]]
      return { ...g, pages }
    }))
  }
  const removePage = (groupIdx: number, pageId: string) => {
    setGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, pages: g.pages.filter(p => p !== pageId) } : g))
  }
  const dropOnGroup = (targetIdx: number) => {
    if (!drag) return
    const { fromGroup, pageId } = drag
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, pages: [...g.pages] }))
      if (fromGroup >= 0) next[fromGroup].pages = next[fromGroup].pages.filter(p => p !== pageId)
      if (!next[targetIdx].pages.includes(pageId)) next[targetIdx].pages.push(pageId)
      return next
    })
    setDrag(null)
  }
  const dropOnPool = () => {
    if (!drag) return
    const { fromGroup, pageId } = drag
    if (fromGroup < 0) { setDrag(null); return }
    setGroups(prev => prev.map((g, i) => i === fromGroup ? { ...g, pages: g.pages.filter(p => p !== pageId) } : g))
    setDrag(null)
  }

  // ── Persist ──
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/menu-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: groups, labels }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.message || d.error || 'Gagal menyimpan')
      setInitial(JSON.stringify({ groups, labels }))
      Swal.fire('Berhasil', 'Susunan menu disimpan. Pengguna akan melihatnya saat membuka aplikasi berikutnya.', 'success')
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Gagal menyimpan'
      Swal.fire('Error', errMsg, 'error')
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <PageLoader minHeight="300px" variant="trace" />

  // Jangan render editor saat gagal memuat: menyimpan dari state kosong akan
  // menghapus susunan menu yang tersimpan di DB.
  if (loadError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--n-muted)' }}>
        <i className="bi bi-exclamation-triangle" style={{ fontSize: 28, display: 'block', marginBottom: 10 }}></i>
        <div>{loadError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 14, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid var(--n-border)', background: 'var(--n-surface)', color: 'var(--n-text)',
          }}
        >
          <i className="bi bi-arrow-clockwise"></i> Muat Ulang
        </button>
      </div>
    )
  }

  return (
    <div className="ml">

      <div className="ml__toolbar">
        <Button variant="outline" icon="add" onClick={addGroup}>
          Buat Grup
        </Button>
        <div className="ml__spacer" />
        <Button variant="primary" icon="save" onClick={save} disabled={!dirty || saving} isLoading={saving}>
          Simpan
        </Button>
      </div>

      <div className="ml__groups">
        {groups.map((g, gi) => (
          <div
            key={g.key}
            className="ml__group"
            onDragOver={e => e.preventDefault()}
            onDrop={() => dropOnGroup(gi)}
          >
            <div className="ml__groupHead">
              <button className="ml__iconBtn" onClick={() => setIconPickerFor(iconPickerFor === g.key ? null : g.key)} title="Ganti ikon">
                <i className={`fa-solid ${g.icon}`}></i>
              </button>
              <input
                className="ml__nameInput"
                value={g.label}
                onChange={e => updateGroup(gi, { label: e.target.value })}
              />
              <div className="ml__groupActions">
                <button onClick={() => moveGroup(gi, -1)} disabled={gi === 0} title="Naik"><i className="bi bi-chevron-up"></i></button>
                <button onClick={() => moveGroup(gi, 1)} disabled={gi === groups.length - 1} title="Turun"><i className="bi bi-chevron-down"></i></button>
                <button className="ml__del" onClick={() => deleteGroup(gi)} title="Hapus grup"><i className="bi bi-trash"></i></button>
              </div>
            </div>

            {iconPickerFor === g.key && (
              <div className="ml__iconGrid">
                {ICON_OPTIONS.map(ic => (
                  <button key={ic} className={`ml__iconOpt ${g.icon === ic ? 'on' : ''}`}
                    onClick={() => { updateGroup(gi, { icon: ic }); setIconPickerFor(null) }}>
                    <i className={`fa-solid ${ic}`}></i>
                  </button>
                ))}
              </div>
            )}

            <div className="ml__pages">
              {g.pages.length === 0 && <div className="ml__emptyDrop">Seret halaman ke sini</div>}
              {g.pages.map((p, pi) => (
                <div key={p} className="ml__page">
                  <span
                    className="ml__grip"
                    draggable
                    onDragStart={() => setDrag({ fromGroup: gi, pageId: p })}
                    onDragEnd={() => setDrag(null)}
                    title="Seret untuk pindah grup"
                  >
                    <i className="bi bi-grip-vertical"></i>
                  </span>
                  <input
                    className="ml__pageInput"
                    value={effectiveLabel(p)}
                    onChange={e => renameLabel(p, e.target.value)}
                    title={`ID: ${p} — klik untuk ubah nama`}
                  />
                  <span className="ml__pageId">{p}</span>
                  <div className="ml__pageActions">
                    <button onClick={() => movePage(gi, pi, -1)} disabled={pi === 0}><i className="bi bi-chevron-up"></i></button>
                    <button onClick={() => movePage(gi, pi, 1)} disabled={pi === g.pages.length - 1}><i className="bi bi-chevron-down"></i></button>
                    <button className="ml__del" onClick={() => removePage(gi, p)} title="Keluarkan ke pool"><i className="bi bi-x-lg"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned pool */}
      <div className="ml__pool" onDragOver={e => e.preventDefault()} onDrop={dropOnPool}>
        <div className="ml__poolHead">
          <i className="bi bi-inbox"></i> Halaman belum dikelompokkan
          <span className="ml__poolCount">{unassigned.length}</span>
        </div>
        <div className="ml__poolPages">
          {unassigned.length === 0 ? (
            <span className="ml__poolEmpty">Semua halaman sudah ditempatkan.</span>
          ) : unassigned.map(p => (
            <div
              key={p}
              className="ml__chip"
              draggable
              onDragStart={() => setDrag({ fromGroup: -1, pageId: p })}
              onDragEnd={() => setDrag(null)}
              title={p}
            >
              <i className="bi bi-grip-vertical ml__grip"></i>
              {PAGE_LABELS[p] || p}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ml { display: flex; flex-direction: column; gap: 14px; }
        .ml__loading { padding: 40px; text-align: center; color: var(--n-muted); }
        .ml__intro {
          display: flex; align-items: flex-start; gap: 10px;
          background: var(--n-soft, #eff6ff); border: 1px solid var(--n-border);
          border-radius: 12px; padding: 12px 14px; font-size: 0.85rem; color: var(--n-muted);
        }
        .ml__intro i { color: var(--n-primary); margin-top: 2px; }
        .ml__intro b { color: var(--n-ink); font-weight: 700; }
        .ml__toolbar { display: flex; align-items: center; gap: 8px; }
        .ml__spacer { flex: 1; }
        .ml__btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
          border-radius: 10px; border: 1.5px solid var(--n-border); background: var(--n-card);
          font-size: 0.8rem; font-weight: 700; color: var(--n-muted); cursor: pointer; transition: all 0.15s;
        }
        .ml__btn:hover { border-color: var(--n-primary); color: var(--n-primary); }
        .ml__btn--primary { background: var(--n-primary); color: #fff; border-color: transparent; }
        .ml__btn--primary:hover { filter: brightness(1.08); color: #fff; }
        .ml__btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ml__groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
        .ml__group { background: var(--n-card); border: 1px solid var(--n-border); border-radius: 14px; overflow: hidden; }
        .ml__groupHead { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--n-border); background: var(--n-soft, #f8fafc); }
        .ml__iconBtn { width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-primary); cursor: pointer; }
        .ml__nameInput { flex: 1; min-width: 0; border: 1px solid transparent; background: transparent; font-size: 0.88rem; font-weight: 700; color: var(--n-ink); padding: 4px 6px; border-radius: 6px; }
        .ml__nameInput:focus { outline: none; border-color: var(--n-primary); background: var(--n-card); }
        .ml__groupActions { display: flex; gap: 2px; }
        .ml__groupActions button { width: 24px; height: 24px; border: none; background: transparent; color: var(--n-muted); cursor: pointer; border-radius: 6px; font-size: 0.72rem; }
        .ml__groupActions button:hover:not(:disabled) { background: var(--n-soft); color: var(--n-primary); }
        .ml__groupActions button:disabled { opacity: 0.3; cursor: not-allowed; }
        .ml__del:hover { color: #ef4444 !important; }
        .ml__iconGrid { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--n-border); }
        .ml__iconOpt { width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--n-border); background: var(--n-card); color: var(--n-muted); cursor: pointer; }
        .ml__iconOpt.on, .ml__iconOpt:hover { border-color: var(--n-primary); color: var(--n-primary); }
        .ml__pages { display: flex; flex-direction: column; gap: 2px; padding: 8px; min-height: 40px; }
        .ml__emptyDrop { font-size: 0.75rem; color: var(--n-muted); text-align: center; padding: 14px; border: 1.5px dashed var(--n-border); border-radius: 10px; }
        .ml__page { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 9px; background: var(--n-soft, #f8fafc); border: 1.5px solid var(--n-border); }
        .ml__grip { color: var(--n-muted); opacity: 0.5; cursor: grab; display: flex; align-items: center; flex-shrink: 0; }
        .ml__grip:active { cursor: grabbing; }
        .ml__pageInput { flex: 1; min-width: 0; border: 1px solid transparent; background: transparent; font-size: 0.8rem; font-weight: 600; color: var(--n-ink); padding: 4px 6px; border-radius: 6px; font-family: inherit; }
        .ml__pageInput:hover { border-color: var(--n-border); }
        .ml__pageInput:focus { outline: none; border-color: var(--n-primary); background: var(--n-card); }
        .ml__pageLabel { flex: 1; font-size: 0.8rem; font-weight: 600; color: var(--n-ink); }
        .ml__pageId { font-size: 0.62rem; color: var(--n-muted); font-family: monospace; }
        .ml__pageActions { display: flex; gap: 1px; }
        .ml__pageActions button { width: 22px; height: 22px; border: none; background: transparent; color: var(--n-muted); cursor: pointer; border-radius: 5px; font-size: 0.68rem; }
        .ml__pageActions button:hover:not(:disabled) { background: var(--n-card); color: var(--n-primary); }
        .ml__pageActions button:disabled { opacity: 0.3; cursor: not-allowed; }
        .ml__pool { background: var(--n-card); border: 1.5px dashed var(--n-border); border-radius: 14px; padding: 12px 14px; }
        .ml__poolHead { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: var(--n-muted); margin-bottom: 10px; }
        .ml__poolHead i { color: var(--n-primary); }
        .ml__poolCount { background: var(--n-soft); padding: 1px 8px; border-radius: 999px; font-size: 0.7rem; }
        .ml__poolPages { display: flex; flex-wrap: wrap; gap: 6px; }
        .ml__poolEmpty { font-size: 0.8rem; color: var(--n-muted); }
        .ml__chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: var(--n-soft, #f1f5f9); border: 1.5px solid var(--n-border); font-size: 0.78rem; font-weight: 600; color: var(--n-ink); cursor: grab; }
        .ml__chip:active { cursor: grabbing; }
        :global(.dark) .ml__intro { background: rgba(79,142,247,0.08); }
        :global(.dark) .ml__groupHead { background: rgba(255,255,255,0.02); }

        /* ===== DARK MODE STANDARD ===== */
        :global(.dark) .ml__group,
        :global(.dark) .ml__pool {
          background: #000000 !important;
          border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
          border-radius: 14px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
        }
        :global(.dark) .ml__groupHead {
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.15), rgba(0, 40, 122, 0.25)) !important;
          border-bottom: 1.5px solid rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .ml__nameInput,
        :global(.dark) .ml__pageInput,
        :global(.dark) .ml__pageLabel,
        :global(.dark) .ml__chip {
          color: #e2e8f0 !important;
        }
        :global(.dark) .ml__page,
        :global(.dark) .ml__chip {
          background: #000000 !important;
          border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
        }
        :global(.dark) .ml__btn--primary {
          background: linear-gradient(135deg, #1d6bf3 0%, #3083ff 100%) !important;
          color: #ffffff !important;
          border: 1px solid rgba(59, 130, 246, 0.6) !important;
        }
        /* ===== END DARK MODE STANDARD ===== */
      `}</style>
    </div>
  )
}

