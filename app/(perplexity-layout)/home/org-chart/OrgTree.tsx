"use client"

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type TreeNode = {
  id: string
  key: string
  title: string
  short_title?: string | null
  children: TreeNode[]
}

function useSetRoleInUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (key?: string) => {
    const sp = new URLSearchParams(params.toString())
    if (key) sp.set('role', key)
    else sp.delete('role')
    router.replace(`${pathname}?${sp.toString()}`)
  }
}

type Orientation = 'vertical' | 'horizontal'

export default function OrgTree(
  { root, orientation = 'vertical', dottedTargets, roleTitles }: {
    root: TreeNode;
    orientation?: Orientation;
    dottedTargets?: Record<string, string[]>;
    roleTitles?: Record<string, string>;
  }
) {
  const setRoleInUrl = useSetRoleInUrl()
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [showDotted, setShowDotted] = useState<boolean>(true)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({})
  const [lines, setLines] = useState<Array<{ s: string; t: string; x1: number; y1: number; x2: number; y2: number }>>([])
  const [hoveredLine, setHoveredLine] = useState<{ s: string; t: string; x: number; y: number } | null>(null)
  const unitColors = useMemo(
    () => [
      'bg-sky-100',
      'bg-amber-100',
      'bg-emerald-100',
      'bg-rose-100',
      'bg-violet-100',
      'bg-lime-100',
      'bg-cyan-100',
      'bg-fuchsia-100',
    ],
    []
  )

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Default-collapse depths > 2 on initial render (pure collector + state setter)
  const collectDefaultCollapsed = useCallback((node: TreeNode, depth: number, acc: string[]) => {
    if (depth > 2 && node.children.length) acc.push(node.id)
    for (const c of node.children) collectDefaultCollapsed(c, depth + 1, acc)
  }, [])

  useEffect(() => {
    const ids: string[] = []
    collectDefaultCollapsed(root, 0, ids)
    setCollapsed(new Set(ids))
  }, [root, collectDefaultCollapsed])

  // Helpers for expand/collapse all
  const collectAllWithChildren = useCallback((node: TreeNode, acc: string[]) => {
    if (node.children.length > 0) acc.push(node.id)
    for (const c of node.children) collectAllWithChildren(c, acc)
  }, [])

  const collapseAll = useCallback(() => {
    const ids: string[] = []
    collectAllWithChildren(root, ids)
    setCollapsed(new Set(ids))
  }, [collectAllWithChildren, root])

  const expandAll = useCallback(() => {
    setCollapsed(new Set())
  }, [])

  // Recompute SVG connector geometry for dotted_to edges
  const recomputeLines = useCallback(() => {
    const c = containerRef.current
    if (!c || !dottedTargets) { setLines([]); return }
    const cRect = c.getBoundingClientRect()
    const next: Array<{ s: string; t: string; x1: number; y1: number; x2: number; y2: number }> = []
    for (const [s, targets] of Object.entries(dottedTargets)) {
      const sEl = nodeRefs.current[s]
      if (!sEl) continue
      const sr = sEl.getBoundingClientRect()
      for (const t of targets) {
        const tEl = nodeRefs.current[t]
        if (!tEl) continue
        const tr = tEl.getBoundingClientRect()
        const x1 = sr.right - cRect.left
        const y1 = sr.top + sr.height / 2 - cRect.top
        const x2 = tr.left - cRect.left
        const y2 = tr.top + tr.height / 2 - cRect.top
        next.push({ s, t, x1, y1, x2, y2 })
      }
    }
    setLines(next)
  }, [dottedTargets])

  useEffect(() => {
    // Wait one frame to ensure layout is stable before measuring
    const id = requestAnimationFrame(() => recomputeLines())
    return () => cancelAnimationFrame(id)
  }, [recomputeLines, root, collapsed])

  useEffect(() => {
    const onResize = () => recomputeLines()
    window.addEventListener('resize', onResize)
    const el = containerRef.current
    const onScroll = () => recomputeLines()
    el?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      el?.removeEventListener('scroll', onScroll)
    }
  }, [recomputeLines])

  const NodeBox: React.FC<{ n: TreeNode; depth: number; unitColor?: string }> = ({ n, depth, unitColor }) => {
    const hasChildren = n.children.length > 0
    const isCollapsed = collapsed.has(n.id)
    const dotted = dottedTargets?.[n.key] ?? []
    if (orientation === 'vertical') {
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            {hasChildren && (
              <button
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                className="h-5 w-5 rounded border text-xs leading-none flex items-center justify-center bg-muted hover:bg-accent relative z-30"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(n.id) }}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            )}
            <button
              ref={(el) => { nodeRefs.current[n.key] = el }}
              onMouseEnter={() => setHoveredKey(n.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => setRoleInUrl(n.key)}
              className={`group min-w-[220px] max-w-[280px] text-left rounded-md border ${unitColor ?? 'bg-card'} hover:bg-accent transition shadow-sm relative z-10`}
            >
              <div className="px-3 py-2 border-b">
                <div className="text-sm font-semibold leading-5">{n.title}</div>
                {n.short_title && (
                  <div className="text-xs text-muted-foreground">{n.short_title}</div>
                )}
              </div>
              {hasChildren && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground">{isCollapsed ? `${n.children.length} hidden` : `${n.children.length} reports`}</div>
              )}
              {/* Dotted-to badges */}
              {showDotted && dotted.length > 0 && (
                <div className="mt-1 mb-1 flex flex-wrap gap-1 justify-center">
                  {dotted.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 text-[10px] border border-dashed rounded text-muted-foreground">
                      Dotted to: {roleTitles?.[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </div>

          {hasChildren && !isCollapsed && (
            <>
              <div className="h-4 w-px bg-border my-1" />
              <div className="flex items-start justify-center gap-4">
                {n.children.map((c, i) => (
                  <div
                    key={c.id}
                    className={depth === 0 ? 'rounded-md border border-border/30 p-3 bg-muted/10' : ''}
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-4 w-px bg-border mb-1" />
                      <NodeBox n={c} depth={depth + 1} unitColor={depth === 0 ? unitColors[i % unitColors.length] : unitColor} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }
    // horizontal
    return (
      <div className="flex flex-row items-center">
        <div className="flex items-center gap-1">
          {hasChildren && (
            <button
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              className="h-5 w-5 rounded border text-xs leading-none flex items-center justify-center bg-muted hover:bg-accent relative z-30"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(n.id) }}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          )}
          <button
            ref={(el) => { nodeRefs.current[n.key] = el }}
            onMouseEnter={() => setHoveredKey(n.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => setRoleInUrl(n.key)}
            className={`group min-w-[220px] max-w-[280px] text-left rounded-md border ${unitColor ?? 'bg-card'} hover:bg-accent transition shadow-sm relative z-10`}
          >
            <div className="px-3 py-2 border-b">
              <div className="text-sm font-semibold leading-5">{n.title}</div>
              {n.short_title && (
                <div className="text-xs text-muted-foreground">{n.short_title}</div>
              )}
            </div>
            {hasChildren && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                {n.children.length} direct {n.children.length === 1 ? 'report' : 'reports'}
              </div>
            )}
          </button>
        </div>

        {dotted.length > 0 && (
          <div className="ml-3 mt-1 flex flex-wrap gap-1">
            {dotted.map((t) => (
              <span key={t} className="px-1.5 py-0.5 text-[10px] border border-dashed rounded text-muted-foreground">
                Dotted to: {roleTitles?.[t] ?? t}
              </span>
            ))}
          </div>
        )}

        {hasChildren && !isCollapsed && (
          <div className="flex flex-row items-start ml-4">
            {/* horizontal connector from parent to children column */}
            <div className="h-px w-6 bg-border mt-6 mr-4" />
            {/* children column with vertical rail */}
            <div className="flex flex-col items-start gap-4 border-l border-border pl-3">
              {n.children.map((c, i) => (
                <div key={c.id} className={depth === 0 ? 'rounded-md border border-border/30 p-3 bg-muted/10' : ''}>
                  <div className="flex flex-row items-center">
                    {/* stub from rail to child */}
                    <div className="h-px w-4 bg-border mr-3" />
                    <NodeBox n={c} depth={depth + 1} unitColor={depth === 0 ? unitColors[i % unitColors.length] : unitColor} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={(orientation === 'vertical' ? 'w-full flex flex-col items-center' : 'w-full flex flex-row items-start') + ' relative'}>
      {/* SVG overlay for dotted_to dashed connectors */}
      {showDotted && (
      <svg className="absolute inset-0 -z-10" width="100%" height="100%">
        {lines.map((ln, i) => {
          const isKeyFocus = hoveredKey ? (ln.s === hoveredKey || ln.t === hoveredKey) : false
          const isLineFocus = hoveredLine ? (hoveredLine.s === ln.s && hoveredLine.t === ln.t) : false
          const isFocus = isKeyFocus || isLineFocus
          const opacity = (hoveredKey || hoveredLine) ? (isFocus ? 1 : 0.15) : 0.35
          const stroke = isFocus ? '#0ea5e9' /* sky-500 */ : '#94a3b8' /* slate-400 */
          // Shorten interactive hit-area by delta from both ends so it doesn't overlap node/arrow
          const dx = ln.x2 - ln.x1
          const dy = ln.y2 - ln.y1
          const len = Math.hypot(dx, dy) || 1
          const nx = dx / len
          const ny = dy / len
          const delta = 24
          const hx1 = ln.x1 + nx * delta
          const hy1 = ln.y1 + ny * delta
          const hx2 = ln.x2 - nx * delta
          const hy2 = ln.y2 - ny * delta
          return (
            <g key={i}>
              {/* Invisible, wide hit-area line for easier hover */}
              <line
                x1={hx1}
                y1={hy1}
                x2={hx2}
                y2={hy2}
                stroke="transparent"
                strokeWidth={14}
                strokeLinecap="round"
                style={{ pointerEvents: 'stroke' }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  const x = rect ? e.clientX - rect.left : 0
                  const y = rect ? e.clientY - rect.top : 0
                  setHoveredLine({ s: ln.s, t: ln.t, x, y })
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  const x = rect ? e.clientX - rect.left : 0
                  const y = rect ? e.clientY - rect.top : 0
                  setHoveredLine({ s: ln.s, t: ln.t, x, y })
                }}
                onMouseLeave={() => setHoveredLine(null)}
              />
              {/* Visible dashed line */}
              <line
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke={stroke}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeLinecap="round"
                opacity={opacity}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          )
        })}
      </svg>
      )}
      {/* Floating controls */}
      <div className="fixed bottom-4 right-4 z-30 flex gap-2 items-center">
        <button
          className="px-3 py-1.5 rounded-md border bg-background hover:bg-accent text-sm shadow-sm"
          onClick={expandAll}
        >
          Expand All
        </button>
        <button
          className="px-3 py-1.5 rounded-md border bg-background hover:bg-accent text-sm shadow-sm"
          onClick={collapseAll}
        >
          Collapse All
        </button>
        <button
          className="px-3 py-1.5 rounded-md border bg-background hover:bg-accent text-sm shadow-sm"
          onClick={() => setShowDotted(v => !v)}
          aria-pressed={showDotted}
        >
          {showDotted ? 'Hide Dotted Connections' : 'Show Dotted Connections'}
        </button>
      </div>
      {/* Tooltip for dotted connector hover */}
      {showDotted && hoveredLine && (
        <div
          className="absolute z-20 px-2 py-1 text-xs rounded border bg-popover text-popover-foreground shadow-md"
          style={{ left: Math.max(8, hoveredLine.x + 12), top: Math.max(8, hoveredLine.y + 12) }}
        >
          {(roleTitles?.[hoveredLine.s] ?? hoveredLine.s) + ' \u2194 ' + (roleTitles?.[hoveredLine.t] ?? hoveredLine.t)}
        </div>
      )}
      <NodeBox n={root} depth={0} />
    </div>
  )
}
