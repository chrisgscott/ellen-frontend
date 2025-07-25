# Ellen Dashboard - Developer Onboarding Guide

Welcome to the Ellen Dashboard project! This document provides everything you need to understand the project architecture, key features, and development workflow.

## 🎯 Project Overview

**Ellen** is an AI-powered critical materials analyst dashboard built for strategic materials intelligence and analysis. The system provides comprehensive data on 80+ critical materials, AI-powered chat functionality, and real-time market insights.

**Live URL:** https://meetellen.co  
**Tech Stack:** Next.js 15, Supabase, OpenAI, Tailwind CSS, shadcn/ui  
**Database:** PostgreSQL (Supabase)  
**Authentication:** Magic Link (passwordless)  
**Deployment:** Render  

---

## 🏗️ Architecture Overview

### Frontend Structure
```
app/
├── (app)/                    # Basic app routes (auth handling)
├── (perplexity-layout)/      # Main application with sidebar
│   ├── home/                 # Dashboard, chat, research
│   ├── admin/                # Admin interface
│   └── account/              # User settings
├── api/                      # API routes
└── auth/                     # Authentication flows
```

### Key Components
- **ThinSidebar**: Main navigation (home, research, news, spaces)
- **Chat System**: Real-time AI conversations with Ellen
- **Materials Database**: 80+ critical materials with detailed analysis
- **Magic Link Auth**: Passwordless authentication flow

---

## 🗄️ Database Schema

### Core Tables
- **`materials`** (80 records): Complete materials database with risk scores, summaries, supply chain data
- **`materials_lists`**: Custom material groupings (global + user-specific)
- **`materials_list_items`**: Many-to-many relationship for list membership
- **`profiles`**: User profiles with role-based access
- **`chat_sessions`**: AI conversation sessions
- **`chat_messages`**: Individual messages in conversations
- **`opportunities`**: Investment/business opportunities
- **`litore_holdings`**: Portfolio data

### Key Data Points
- **Materials**: 63 with full data, 17 with insufficient data (show "Information Coming Soon")
- **Risk Scores**: 1-5 scale for supply, ownership, processing, etc.
- **Content Fields**: summary, industries, supply, ownership, processing, substitutes, recycling

---

## 🔐 Authentication System

**Current Implementation: Magic Link (Passwordless)**

### Flow
1. User enters email at `/auth/login`
2. Receives magic link email
3. Clicks link → lands at root with tokens in URL hash
4. Root page processes tokens → redirects to `/home`

### Key Files
- `app/(app)/page.tsx`: Handles magic link token processing
- `app/auth/login/page.tsx`: Magic link request form
- `app/auth/confirm/route.ts`: Handles invite confirmations
- `lib/supabase/middleware.ts`: Route protection
- `lib/supabase/client.ts`: Client configuration with proper cookie domains

### Recent Changes
- Simplified from complex password setup to magic link only
- Fixed production cookie domain issues (`.meetellen.co`)
- Eliminated redirect loops and UI flicker

---

## 🤖 AI Chat System

### Ellen AI Features
- **Real-time streaming responses**
- **Tool integration**: Portfolio analysis, opportunities, geopolitical risks
- **Materials detection**: Automatically finds related materials in responses
- **Session management**: Persistent chat history
- **Context awareness**: Understands materials domain

### Key Components
- `app/api/chat/route.ts`: Main chat API with OpenAI integration
- `app/(perplexity-layout)/home/chat/`: Chat interface
- `components/chat-message.tsx`: Message display with streaming
- **Tools**: `get_portfolio_summary`, `get_high_impact_opportunities`, `monitor_geopolitical_risks`

### Technical Details
- **OpenAI Structured Outputs**: Ensures reliable JSON responses
- **Streaming**: Real-time token display with cursor indicator
- **Materials Extraction**: Automatic detection and related materials carousel
- **Deduplication**: Prevents duplicate sessions/messages

---

## 📊 Materials System

### Material Detail Pages
**Route**: `/home/research/[material]`

### Features
- **Comprehensive Analysis**: Risk scores, supply chain, applications
- **Insufficient Data Handling**: Clean "Information Coming Soon" message for 17 materials without summaries
- **Ask Ellen Integration**: AI assistance button on every material page
- **Table of Contents**: Smooth scrolling navigation sidebar

### Key Implementation
```typescript
// Insufficient data check
const hasInsufficientData = !materialData.summary || materialData.summary.trim() === '';

if (hasInsufficientData) {
  return <InformationComingSoonMessage />;
}
```

### Affected Materials (No Summary)
Aluminum Oxide Fused Crude, Aluminum-Lithium Alloy, Beryl Ore, Beryllium Copper Master Alloy, Boron, Cadmium, Cadmium Zinc Telluride, Carbon Fibers, Energetic Materials, Ferrochromium, Ferromanganese, Lead, Mercury, Molybdenum, Rubber (natural), Selenium, Strontium

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm/yarn
- Supabase account
- OpenAI API key

### Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tiepvxhcjnwlgtcerjkw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Production
NEXT_PUBLIC_SITE_URL=https://meetellen.co
```

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Access at http://localhost:3000
```

### Key Scripts
- `npm run dev`: Development server with Turbopack
- `npm run build`: Production build
- `npm run lint`: ESLint checking

---

## 🎨 UI/UX System

### Design System
- **Framework**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Typography**: Outfit font family
- **Theme**: Custom Ellen branding

### Key UI Components
- **ThinSidebar**: Main navigation with authentication state
- **MagicLinkForm**: Passwordless login interface
- **ChatMessage**: Streaming message display
- **MaterialCard**: Material information display
- **InsufficientDataMessage**: Clean handling of incomplete data

### Recent UI Improvements
- **Consistent Icons**: Sidebar icons match home page cards (FlaskConical, Newspaper, Folders)
- **Page Titles**: Unified "Ellen | AI Critical Materials Analyst" branding
- **Insufficient Data UX**: Professional "Information Coming Soon" with mailto link to Chris

---

## 🔧 API Routes

### Core APIs
- **`/api/chat`**: AI chat with Ellen (streaming, tools, materials detection)
- **`/api/materials`**: Materials CRUD operations
- **`/api/materials/search`**: Material search functionality
- **`/api/opportunities`**: Investment opportunities data
- **`/api/sessions`**: Chat session management

### Authentication APIs
- **`/auth/confirm`**: Handle email confirmations and invites
- **`/auth/sign-out`**: Logout with proper redirects

---

## 📝 Project Log System

**File**: `project_log.md`

### Purpose
- **Single source of truth** for project decisions and changes
- **Context preservation** across development sessions
- **Onboarding resource** for new developers

### Format
```markdown
[YYYY-MM-DD HH:MM] — [Short description of change/decision]

## Snapshot (as of date)
- Current state summary
- Key accomplishments
- Open issues
```

### Recent Key Entries
- **2025-07-25**: Authentication system completed with magic link flow
- **2025-07-17**: Chat system streaming fixes and UI improvements
- **2025-07-16**: Ellen tool integration (opportunities, risks, portfolio)
- **2025-07-14**: Session deduplication and distributed locking

---

## 🚀 Deployment

### Current Setup
- **Platform**: Render
- **Domain**: meetellen.co
- **Auto-deploy**: Connected to GitHub main branch
- **Environment**: Production variables configured

### Deployment Process
1. Push to `main` branch
2. Render automatically builds and deploys
3. Database migrations run automatically
4. Environment variables injected

---

## 🔍 Key Features Deep Dive

### 1. Magic Link Authentication
**Why**: Eliminates password complexity, improves security, better UX
**Implementation**: Supabase Auth with custom flows
**Challenge Solved**: Production cookie domain issues, redirect loops

### 2. AI Chat with Tools
**Capabilities**: 
- Real-time streaming responses
- Portfolio analysis via `get_portfolio_summary`
- Opportunity detection via `get_high_impact_opportunities`
- Risk monitoring via `monitor_geopolitical_risks`

### 3. Materials Intelligence
**Data**: 80+ materials with comprehensive analysis
**Features**: Risk scoring, supply chain analysis, substitutes, recycling
**UX**: Clean handling of incomplete data with actionable feedback

### 4. Insufficient Data Handling
**Problem**: 17 materials had no summary data
**Solution**: Show clean "Information Coming Soon" message with mailto link
**Implementation**: Early return pattern, no nested conditionals

---

## 🐛 Common Issues & Solutions

### Authentication Issues
- **Cookie Domain**: Ensure client.ts uses correct production domain
- **Redirect Loops**: Check middleware route protection logic
- **Magic Link Testing**: Use same browser session, not separate incognito windows

### Chat System Issues
- **Streaming**: Verify OpenAI API key and structured outputs
- **Materials Detection**: Check materials table search functionality
- **Session Persistence**: Ensure proper session ID handling

### Database Issues
- **RLS Policies**: Use service role key for admin operations
- **Foreign Keys**: Verify relationship syntax in queries
- **Migrations**: Run via Supabase dashboard or CLI

---

## 📚 Key Files to Understand

### Authentication
- `lib/supabase/middleware.ts`: Route protection
- `app/(app)/page.tsx`: Magic link token processing
- `components/magic-link-form.tsx`: Login interface

### Chat System
- `app/api/chat/route.ts`: Main AI chat API
- `app/(perplexity-layout)/home/chat/page.tsx`: Chat interface
- `components/chat-message.tsx`: Message display

### Materials System
- `app/(perplexity-layout)/home/research/[material]/page.tsx`: Material details
- `lib/materials.ts`: Materials utilities
- `components/related-materials-card.tsx`: Material cards

### UI Components
- `components/thin-sidebar.tsx`: Main navigation
- `components/ui/`: shadcn/ui component library
- `app/globals.css`: Global styles and Tailwind config

---

## 🎯 Current State & Next Steps

### ✅ Recently Completed
- **Authentication**: Magic link flow working perfectly
- **UI Consistency**: Sidebar icons match home page cards
- **Data Handling**: Clean insufficient data messaging
- **Branding**: Consistent page titles across app

### 🔄 Ongoing Priorities
- **Performance**: Optimize material loading and search
- **Features**: Expand Ellen's tool capabilities
- **Data**: Complete material summaries for remaining 17 materials
- **Analytics**: Add user behavior tracking

### 🚧 Technical Debt
- **Route Organization**: Consider consolidating (app) and (perplexity-layout)
- **Component Cleanup**: Remove unused components from route reorganization
- **Error Handling**: Improve error boundaries and user feedback

---

## 📞 Getting Help

### Key Contacts
- **Chris Scott**: cscott@tier-tech.com (Project Lead)
- **Repository**: https://github.com/chrisgscott/ellen-frontend
- **Production**: https://meetellen.co

### Resources
- **Project Log**: `project_log.md` (comprehensive change history)
- **Supabase Dashboard**: Database management and logs
- **OpenAI API**: Chat functionality and usage monitoring

### Debugging Tips
1. **Check project_log.md** for recent changes and context
2. **Use browser dev tools** for authentication flow debugging
3. **Monitor Supabase logs** for database issues
4. **Check Render deployment logs** for production issues

---

## 🎉 Welcome to the Team!

This project represents months of iterative development with a focus on:
- **Clean, maintainable code**
- **Excellent user experience**
- **Comprehensive documentation**
- **Robust authentication and data handling**

The project log (`project_log.md`) is your best friend for understanding the evolution of decisions and implementations. Don't hesitate to reach out with questions!

**Happy coding!** 🚀
