# Mishma'at (משמעת) - Soldier Management System

## Overview
Mobile-first soldier management app for IDF platoon commanders (3 users).
Built with Next.js 16 + Supabase + Tailwind CSS v4. RTL Hebrew interface with dark military theme.

**Deployed at:** https://mishma-at.vercel.app
**GitHub:** https://github.com/Orr45/mishma-at

---

## Tech Stack
- **Framework:** Next.js 16.1.6 (App Router)
- **React:** 19.2.3
- **Database/Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Supabase Client:** @supabase/ssr v0.8.0, @supabase/supabase-js v2.95.3
- **Styling:** Tailwind CSS v4 (custom dark theme, RTL)
- **Animations:** Framer Motion v12.34.0
- **Icons:** Lucide React v0.564.0
- **Validation:** Zod v4.3.6
- **Language:** TypeScript 5

---

## Project Structure

```
mishma-at/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (force-dynamic, RTL, fonts)
│   │   ├── globals.css             # Tailwind + custom theme variables
│   │   ├── login/page.tsx          # Login page (email/password auth)
│   │   ├── s/[id]/page.tsx         # Soldier portal (public, no auth)
│   │   ├── auth/callback/route.ts  # Supabase OAuth callback
│   │   └── (app)/                  # Authenticated route group
│   │       ├── layout.tsx          # App layout with Navbar
│   │       ├── page.tsx            # Dashboard (WhatsApp report, move all)
│   │       ├── soldiers/
│   │       │   ├── page.tsx        # Soldiers list
│   │       │   └── [id]/page.tsx   # Soldier detail + events timeline
│   │       ├── events/page.tsx     # Events management (active/ended)
│   │       ├── checklists/page.tsx # Attendance checklists
│   │       └── tracking/page.tsx   # Mission tracking lists
│   ├── components/
│   │   ├── Navbar.tsx              # Bottom navigation (4 tabs)
│   │   └── AddSoldierModal.tsx     # Add soldier modal form
│   ├── lib/
│   │   ├── supabase-client.ts      # Browser Supabase client
│   │   ├── supabase-server.ts      # Server-side Supabase client
│   │   ├── supabase-middleware.ts   # Middleware auth logic
│   │   └── validations.ts          # Zod schemas
│   ├── middleware.ts               # Next.js middleware entry
│   └── types/
│       └── database.ts             # TypeScript interfaces
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  # Tables, enums, RLS, triggers
│       ├── 002_fix_trigger.sql     # Fix profile trigger
│       ├── 003_soldier_portal.sql  # Source column, anonymous access
│       └── 004_fix_delete_policies.sql # Fix delete RLS policies
├── next.config.ts                  # CSP headers config
├── package.json
└── .env.local                      # Supabase URL + anon key
```

---

## Database Schema

### Enums
- `user_role`: PC (מ"פ), SGT (סמל), SL (מ"כ)
- `soldier_status`: Base, Home
- `event_category`: HR/Logistics (שלישות), Medical (רפואה), Leaves (יציאות), Personal (אישי)

### Tables
| Table | Description |
|-------|-------------|
| `profiles` | Extends auth.users - id, email, full_name, role, platoon_id |
| `soldiers` | Soldier records - full_name, role_in_unit, weapon_serial, civilian_job, status, notes, platoon_id |
| `events` | Soldier events - soldier_id, creator_id (nullable), description, category, title, source ('commander'/'soldier'), ended_at |
| `checklists` | Attendance checklists - title, platoon_id, created_by |
| `checklist_completions` | Checklist completion records - checklist_id, soldier_id |

### Important Notes
- **RLS is DISABLED** on all tables (soldiers, events, checklists, checklist_completions, profiles) for simplicity since only 3 trusted commanders use the app
- `events.creator_id` is nullable (NULL for soldier-created events)
- `events.source` distinguishes commander vs soldier created events
- Auto-create profile trigger on `auth.users` INSERT
- Realtime enabled on: soldiers, events, checklist_completions

---

## Features

### 1. Dashboard (`/`)
- Soldier count (base/home)
- "Move all to base/home" buttons
- WhatsApp report generator (copies formatted Hebrew report)

### 2. Soldiers (`/soldiers`, `/soldiers/[id]`)
- List with status badges, search
- Add/edit/delete soldiers
- Soldier detail with events timeline
- "Copy link" button → generates `/s/[id]` portal link

### 3. Events (`/events`)
- Create events for soldiers (title, description, category)
- Active vs ended sections
- Mark events as ended (sets `ended_at`)
- Delete events
- "בקשת חייל" orange tag for soldier-submitted events

### 4. Attendance (`/checklists`)
- Create daily checklists
- Toggle soldier attendance
- Real-time completion tracking

### 5. Tracking (`/tracking`)
- Create mission tracking lists
- Check/uncheck soldier completion
- Delete tracking lists (deletes completions first)

### 6. Soldier Portal (`/s/[id]`)
- **Public page** - no auth required
- Soldier sees their own info and events
- Can submit event requests (source='soldier', creator_id=NULL)
- Real-time updates via Supabase channel

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Must be set in both `.env.local` (local dev) and Vercel Environment Variables (production).

---

## Key Config Decisions

### Force Dynamic Rendering
`export const dynamic = 'force-dynamic'` in root `layout.tsx` prevents static prerendering errors (Supabase env vars not available at build time).

### CSP Headers
`next.config.ts` includes Content-Security-Policy allowing `unsafe-eval` (required by framer-motion) and Supabase connections.

### Middleware
- Auth check on all routes except `/login`, `/auth`, `/s/`
- Env var guards (graceful fallback if Supabase vars missing)
- Try-catch wrapper for resilience

### RTL Layout
Root layout has `dir="rtl"` and `lang="he"` on the HTML element.

---

## SQL Migrations Run Manually

The following SQL was run directly in Supabase SQL Editor (in addition to migration files):

```sql
-- Add title and ended_at columns to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Add source column
ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'commander' CHECK (source IN ('commander', 'soldier'));

-- Make creator_id nullable
ALTER TABLE events ALTER COLUMN creator_id DROP NOT NULL;

-- Disable RLS on all tables
ALTER TABLE soldiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions DISABLE ROW LEVEL SECURITY;
```

---

## Deployment

- **Platform:** Vercel
- **Git:** GitHub (Orr45/mishma-at)
- **Auth Callback URL:** `https://mishma-at.vercel.app/auth/callback` (must be in Supabase Auth redirect URLs)
- **Build:** `next build` (all pages force-dynamic, no static generation)
