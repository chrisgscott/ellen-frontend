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

export default function OrgChartClient({ roles, showGrid = true }: { roles: Role[]; showGrid?: boolean }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const selKey = params.get('role')
  const [open, setOpen] = useState<boolean>(false)

  const selected = useMemo(() => {
    if (!selKey) return null
    return roles.find(r => r.key === selKey) || null
  }, [selKey, roles])

  // Open the sheet when a role is selected via URL
  useEffect(() => {
    setOpen(!!selKey)
  }, [selKey])

  const setRoleInUrl = (key?: string) => {
    const sp = new URLSearchParams(params.toString())
    if (key) {
      sp.set('role', key)
    } else {
      sp.delete('role')
    }
    router.replace(`${pathname}?${sp.toString()}`)
  }

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
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {selected.content_md ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selected.content_md}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm text-muted-foreground">No description available yet.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
