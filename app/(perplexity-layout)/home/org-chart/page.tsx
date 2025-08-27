import { createClient } from '@/lib/supabase/server'
import OrgChartClient from './OrgChartClient'
import OrgTree from './OrgTree'

export const dynamic = 'force-dynamic'

type Role = { id: string; key: string; title: string; short_title?: string | null; content_md?: string | null }
type Edge = { source_id: string; target_id: string }

type TreeNode = {
  id: string
  key: string
  title: string
  short_title?: string | null
  children: TreeNode[]
}

export default async function OrgChartPage() {
  const supabase = await createClient()

  // 1) Find CEO
  const { data: ceo, error: ceoErr } = await supabase
    .from('org_roles')
    .select('id,key,title')
    .eq('key', 'CEO')
    .single()

  if (ceoErr || !ceo) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Org Chart</h1>
        <p className="text-sm text-muted-foreground mt-2">Failed to load CEO role.</p>
      </div>
    )
  }

  // 2) Load ALL reports_to edges, ALL dotted_to edges, and ALL roles (for sheet rendering)
  const [
    { data: allEdges, error: edgesErr },
    { data: dottedEdges, error: dottedErr },
    { data: allRoles, error: rolesErr },
  ] = await Promise.all([
    supabase
      .from('org_edges')
      .select('source_id,target_id')
      .eq('edge_type', 'reports_to'),
    supabase
      .from('org_edges')
      .select('source_id,target_id')
      .eq('edge_type', 'dotted_to'),
    supabase
      .from('org_roles')
      .select('id,key,title,short_title,content_md')
  ])

  if (edgesErr || dottedErr || rolesErr) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Org Chart</h1>
        <p className="text-sm text-muted-foreground mt-2">Failed to load org data.</p>
      </div>
    )
  }

  const rolesById = new Map<string, Role>()
  for (const r of (allRoles as Role[] | null) ?? []) rolesById.set(r.id, r)

  const childrenByParent = new Map<string, string[]>()
  for (const e of (allEdges as Edge[] | null) ?? []) {
    const arr = childrenByParent.get(e.target_id) ?? []
    arr.push(e.source_id)
    childrenByParent.set(e.target_id, arr)
  }

  // Build dotted_to map keyed by SOURCE ROLE KEY -> array of TARGET ROLE KEYS (serializable)
  const roleIdToKey = new Map<string, string>()
  for (const r of (allRoles as Role[] | null) ?? []) roleIdToKey.set(r.id, r.key)
  const roleTitlesByKey: Record<string, string> = {}
  for (const r of (allRoles as Role[] | null) ?? []) roleTitlesByKey[r.key] = r.title
  const dottedTargetsByKey: Record<string, string[]> = {}
  for (const e of (dottedEdges as Edge[] | null) ?? []) {
    const sKey = roleIdToKey.get(e.source_id)
    const tKey = roleIdToKey.get(e.target_id)
    if (!sKey || !tKey) continue
    dottedTargetsByKey[sKey] = [...(dottedTargetsByKey[sKey] ?? []), tKey]
  }

  // Build reporting maps for dynamic rendering in the details sheet
  // reportsToByKey: role key -> manager key (or undefined)
  // directReportsByKey: role key -> array of direct report keys
  const reportsToByKey: Record<string, string | undefined> = {}
  const directReportsByKey: Record<string, string[]> = {}
  for (const e of (allEdges as Edge[] | null) ?? []) {
    const childKey = roleIdToKey.get(e.source_id)
    const managerKey = roleIdToKey.get(e.target_id)
    if (!childKey || !managerKey) continue
    reportsToByKey[childKey] = managerKey
    directReportsByKey[managerKey] = [...(directReportsByKey[managerKey] ?? []), childKey]
  }

  const buildTree = (id: string): TreeNode | null => {
    const r = rolesById.get(id)
    if (!r) return null
    const kids = (childrenByParent.get(id) ?? [])
      .map((cid) => buildTree(cid))
      .filter(Boolean) as TreeNode[]
    // Sort children by title for stable layout
    kids.sort((a, b) => a.title.localeCompare(b.title))
    return { id: r.id, key: r.key, title: r.title, short_title: r.short_title ?? undefined, children: kids }
  }

  const root = buildTree(ceo.id)
  const roles: Role[] = (allRoles as Role[] | null) ?? []

  return (
    <div className="min-h-[100dvh] w-full flex flex-col">
      <div className="px-6 pt-6 pb-2 border-b">
        <h1 className="text-2xl font-semibold">Org Chart</h1>
        <p className="text-sm text-muted-foreground">Hierarchical view of the organization (click any node to view details)</p>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {root ? (
          <OrgTree root={root} orientation="horizontal" dottedTargets={dottedTargetsByKey} roleTitles={roleTitlesByKey} />
        ) : (
          <p className="text-sm text-muted-foreground">CEO node not found.</p>
        )}
      </div>
      {/* Slide-in sheet provider (no grid) */}
      <OrgChartClient
        roles={roles}
        showGrid={false}
        reportsTo={reportsToByKey}
        directReports={directReportsByKey}
        roleTitles={roleTitlesByKey}
      />
    </div>
  )
}

//
