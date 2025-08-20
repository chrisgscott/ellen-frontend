# Ellen — Architecture Overview (current main)

This document captures the current architecture present in the main branch, including the Next.js dashboard, Supabase backend, Frill SSO, and auxiliary integrations.

## 1) System Context (Current)
```mermaid
flowchart TB
  subgraph User[User Browser]
    U[ELLEN Dashboard UI]
  end

  subgraph Next[Next app - ellen-dashboard]
    L[App Routes & UI]
    API1[/API /api/frill/sso-token/]
    API2[/API /api/news/submit-link/]
  end

  subgraph Supabase[Supabase - Auth, Postgres, Storage]
    AUTH[(Auth)]
    DB[(Postgres)]
  end

  subgraph Frill[Frill Cloud]
    FW[Frill Widget]
  end

  subgraph n8n[n8n Automation]
    W[(Webhook Endpoint)]
  end

  U -->|HTTPS| L
  L -->|Client embed| FW
  L -->|Fetch SSO token| API1
  API1 --> AUTH
  API1 --> DB
  API1 -->|Signs JWT with FRILL_SSO_SECRET| API1
  API1 -->|JSON token| L
  L -->|Frill container with ssoToken| FW

  L -->|Submit URL| API2
  API2 --> AUTH
  API2 -->|Forward url and userId| W

  L ---|Supabase client SSR/CSR| AUTH
```

Key pieces in repo:
- `ellen-dashboard/` — Next.js app (app router) with global providers and API routes.
- `ellen-dashboard/components/providers/frill-widget.tsx` — loads Frill widget and injects SSO token.
- `ellen-dashboard/app/api/frill/sso-token/route.ts` — generates HS256 SSO JWT with `{ email, id, name }`.
- `ellen-dashboard/app/api/news/submit-link/route.ts` — forwards submitted links to n8n webhook.
- `supabase/migrations/` — database migrations (e.g., profiles, messages metadata, etc.).

Environment:
- `NEXT_PUBLIC_FRILL_KEY` — Frill widget key (client).
- `FRILL_SSO_SECRET` — Frill SSO secret (server only).
- `N8N_NEWS_WEBHOOK_URL` — n8n webhook for news links.

## 2) Frill SSO Flow (Detailed)
```mermaid
sequenceDiagram
  participant User
  participant UI as Next.js (Client)
  participant API as /api/frill/sso-token
  participant SB as Supabase (Auth/DB)
  participant Frill as Frill Widget

  User->>UI: Load app / click Announcements
  UI->>API: GET sso-token
  API->>SB: getUser() + profiles lookup
  API-->>UI: { token: JWT(email,id,name) }
  UI->>Frill: Frill('container', { key, ssoToken })
  Frill-->>User: Authenticated widget (no login prompt)
```

## 3) News Submission Flow
```mermaid
sequenceDiagram
  participant User
  participant UI as Next.js (Client)
  participant API as /api/news/submit-link
  participant SB as Supabase (Auth)
  participant N8N as n8n Webhook

  User->>UI: Paste URL and submit
  UI->>API: POST { url }
  API->>SB: Validate session
  API->>N8N: Forward { url, userId }
  API-->>UI: { ok, status, message }
  UI-->>User: Toast feedback
```

## 4) Repo structure in play
- Dashboard UI and APIs: `ellen-dashboard/`
- Data & migrations: `supabase/`
- Exported DB data & scripts: `db_export/`, `*.py` (knowledge graph/ingestion tooling)
- V2 (planned, Azure-native): `ellen_v2/` with `infra/` (Bicep), `services/` (e.g., crew-orchestrator, ingestion-service), `apps/frontend/` (future client). This directory represents the target platform but is not the current prod stack.

## 5) Notes
- Authentication: Supabase session used both client- and server-side (SSR-friendly). No '@supabase/auth-helpers-nextjs'.
- Frill: SSO JWT includes `email`, `id`, `name` and is short-lived; token never exposed in env.
- Announcements: Thin sidebar button `#ellen-announcements-button` opens Frill; notification dot managed via widget/custom logic.
- News ingestion: n8n endpoint is external; API passes along the authenticated user context.
