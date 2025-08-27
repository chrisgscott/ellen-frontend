"use client"

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Role {
  id: string
  key: string
  title: string
  short_title?: string | null
  content_md?: string | null
}

export default function OrgChartClient({
  roles,
  showGrid = true,
  reportsTo,
  directReports,
  roleTitles,
}: {
  roles: Role[]
  showGrid?: boolean
  reportsTo: Record<string, string | undefined>
  directReports: Record<string, string[]>
  roleTitles: Record<string, string>
}) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const selKey = params.get('role')
  const [open, setOpen] = useState<boolean>(false)
  // Local state for roles to allow optimistic updates when saving edits
  const [rolesState, setRolesState] = useState<Role[]>(roles)
  useEffect(() => { setRolesState(roles) }, [roles])

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (!selKey) return null
    return rolesState.find(r => r.key === selKey) || null
  }, [selKey, rolesState])

  // Open the sheet when a role is selected via URL
  useEffect(() => {
    setOpen(!!selKey)
    // Initialize edit draft when opening on a selected role
    if (selKey) {
      const r = rolesState.find(x => x.key === selKey)
      setDraft(r?.content_md ?? '')
      setIsEditing(false)
      setError(null)
    }
  }, [selKey, rolesState])

  const setRoleInUrl = (key?: string) => {
    const sp = new URLSearchParams(params.toString())
    if (key) {
      sp.set('role', key)
    } else {
      sp.delete('role')
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const onSave = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/org-roles/update-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, content_md: draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save')
      const updated = json.role as Role
      // Optimistically update local roles state
      setRolesState(prev => prev.map(r => r.id === updated.id ? updated : r))
      setIsEditing(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  // Render a link-like control that navigates to ?role=<key>
  const renderRoleLink = (key: string) => (
    <button
      type="button"
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-accent/40 hover:bg-accent transition"
      onClick={(e) => { e.preventDefault(); setRoleInUrl(key) }}
    >
      {roleTitles[key] || key}
    </button>
  )

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {showGrid && (
        roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => (
              <Card
                key={r.id}
                className="cursor-pointer hover:shadow-md transition"
                onClick={() => setRoleInUrl(r.key)}
              >
                <CardHeader>
                  <CardTitle className="text-base leading-5">{r.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {r.short_title && (
                    <div className="text-xs text-muted-foreground">{r.short_title}</div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {r.content_md || 'No description available yet.'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      <Sheet open={open} onOpenChange={(v) => {
        setOpen(v)
        if (!v) setRoleInUrl(undefined)
      }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <div>
              {/* Accessible title for screen readers; visually hidden to avoid duplication */}
              <SheetHeader>
                <SheetTitle className="sr-only">{selected.title || selected.short_title || 'Role details'}</SheetTitle>
              </SheetHeader>
              {/* Header actions */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg md:text-xl font-semibold leading-6 mr-3">{selected.title}</div>
                {!isEditing ? (
                  <button
                    className="px-3 py-1.5 rounded border text-sm bg-background hover:bg-accent"
                    onClick={() => { setIsEditing(true); setDraft(selected.content_md ?? '') }}
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 rounded border text-sm bg-background hover:bg-accent disabled:opacity-50"
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 py-1.5 rounded border text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      onClick={onSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-2 text-sm text-red-600">{error}</div>
              )}

              {!isEditing ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {/* Dynamic reporting relationships from org_edges */}
                  {selected && (() => {
                    const mgrKey = reportsTo[selected.key]
                    const kids = directReports[selected.key] || []
                    const showMgr = !!mgrKey
                    const showKids = kids.length > 0
                    if (!showMgr && !showKids) return null
                    return (
                      <div className="not-prose mb-4 space-y-2 text-sm">
                        {showMgr && (
                          <div>
                            <span className="font-medium">Reports to: </span>
                            <span className="inline-flex flex-wrap gap-1 ml-1 align-middle">
                              {renderRoleLink(mgrKey as string)}
                            </span>
                          </div>
                        )}
                        {showKids && (
                          <div>
                            <span className="font-medium">Direct reports: </span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {kids.map((k) => (
                                <span key={k}>{renderRoleLink(k)}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {selected.content_md ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selected.content_md}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">No description available yet.</p>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    className="w-full min-h-[50vh] p-3 border rounded text-sm font-mono"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">Markdown supported. Use Save to persist.</div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
