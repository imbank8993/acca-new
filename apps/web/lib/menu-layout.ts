import { prisma } from './prisma'
import { PAGE_LABELS, type MenuGroupDef } from './sidebar-menu'

export interface MenuLayoutData {
  groups: MenuGroupDef[]
  labels: Record<string, string>
}

const TTL_MS = 30_000
let _cache: { at: number; data: MenuLayoutData } | null = null
export function invalidateMenuLayoutCache() { _cache = null }

function sanitizeGroups(raw: any): MenuGroupDef[] | null {
  if (!Array.isArray(raw)) return null
  const groups: MenuGroupDef[] = []
  raw.forEach((g: any, i: number) => {
    if (!g || !Array.isArray(g.pages)) return
    groups.push({
      key: String(g.key || `grup-${i}`),
      label: String(g.label || 'Grup'),
      icon: String(g.icon || 'fa-folder'),
      pages: g.pages.map((p: any) => String(p)).filter((p: string) => Boolean(p) && PAGE_LABELS[p] !== undefined),
    })
  })
  return groups
}

function sanitizeLabels(raw: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && v.trim()) out[String(k)] = v.trim().slice(0, 80)
    }
  }
  return out
}

export async function getMenuLayout(): Promise<MenuLayoutData> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.data

  const data = await prisma.menu_layout.findUnique({
    where: { id: 1 },
    select: { layout: true }
  })

  const stored: any = data?.layout
  let groupsRaw: any = null
  let labelsRaw: any = null
  if (Array.isArray(stored)) {
    groupsRaw = stored
  } else if (stored && typeof stored === 'object') {
    groupsRaw = stored.groups
    labelsRaw = stored.labels
  }

  const result: MenuLayoutData = {
    groups: sanitizeGroups(groupsRaw) || [],
    labels: sanitizeLabels(labelsRaw),
  }
  _cache = { at: Date.now(), data: result }
  return result
}

export async function setMenuLayout(groups: MenuGroupDef[], labels: Record<string, string> = {}): Promise<void> {
  const cleanGroups = sanitizeGroups(groups)
  if (!cleanGroups) throw new Error('Format layout tidak valid')
  const cleanLabels = sanitizeLabels(labels)

  await prisma.menu_layout.upsert({
    where: { id: 1 },
    create: { id: 1, layout: { groups: cleanGroups, labels: cleanLabels } as any, updated_at: new Date() },
    update: { layout: { groups: cleanGroups, labels: cleanLabels } as any, updated_at: new Date() }
  })

  invalidateMenuLayoutCache()
}
