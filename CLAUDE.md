# Mishma'at (משמעת) - Soldier Management System

## Overview
Mobile-first soldier management app for IDF platoon commanders (3 users).
Built with Next.js 16 + Supabase + Tailwind CSS v4. RTL Hebrew interface with dark/light military theme.

**Deployed at:** https://mishma-at.vercel.app
**GitHub:** https://github.com/Orr45/mishma-at

---

## Tech Stack
- **Framework:** Next.js 16.1.6 (App Router)
- **React:** 19.2.3
- **Database/Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Supabase Client:** @supabase/ssr v0.8.0, @supabase/supabase-js v2.95.3
- **Styling:** Tailwind CSS v4 (custom dark/light theme, RTL)
- **Animations:** Framer Motion v12.34.0
- **Icons:** Lucide React v0.564.0
- **Validation:** Zod v4.3.6
- **AI:** OpenAI (GPT-4o-mini) for in-app chat assistant
- **Language:** TypeScript 5

---

## Project Structure

```
mishma-at/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (force-dynamic, RTL, fonts, PWA, SW)
│   │   ├── globals.css             # Tailwind + custom theme variables (dark/light)
│   │   ├── login/page.tsx          # Login page (email/password auth)
│   │   ├── s/[id]/page.tsx         # Soldier portal (public, no auth)
│   │   ├── auth/callback/route.ts  # Supabase OAuth callback
│   │   ├── api/
│   │   │   └── chat/route.ts       # AI chat API (OpenAI GPT)
│   │   └── (app)/                  # Authenticated route group
│   │       ├── layout.tsx          # App layout with Navbar + ChatBot
│   │       ├── page.tsx            # Dashboard (soldiers, news, WhatsApp, quick notes)
│   │       ├── events/page.tsx     # Events management (active/ended, commander reply)
│   │       ├── checklists/page.tsx # Attendance checklists
│   │       └── tracking/page.tsx   # Mission tracking lists
│   ├── components/
│   │   ├── Navbar.tsx              # Top bar + bottom tabs + side menu + theme toggle + badges
│   │   ├── ChatBot.tsx             # Floating AI chat assistant
│   │   └── AddSoldierModal.tsx     # Add soldier modal form
│   ├── lib/
│   │   ├── supabase-client.ts      # Browser Supabase client
│   │   ├── supabase-server.ts      # Server-side Supabase client
│   │   ├── supabase-middleware.ts   # Middleware auth logic
│   │   └── validations.ts          # Zod schemas
│   ├── middleware.ts               # Next.js middleware entry
│   └── types/
│       └── database.ts             # TypeScript interfaces (Profile, Soldier, AppEvent, Checklist, News)
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker (network-first, offline fallback)
│   ├── offline.html                # Offline fallback page (Hebrew)
│   ├── icon-192.png                # PWA icon 192x192
│   └── icon-512.png                # PWA icon 512x512
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  # Tables, enums, RLS, triggers
│       ├── 002_fix_trigger.sql     # Fix profile trigger
│       ├── 003_soldier_portal.sql  # Source column, anonymous access
│       ├── 004_fix_delete_policies.sql # Fix delete RLS policies
│       ├── 005_news.sql            # News table
│       └── 006_commander_note.sql  # Commander note on events
├── next.config.ts                  # CSP headers (Supabase + OpenAI)
├── package.json
└── .env.local                      # Supabase URL + anon key + OPENAI_API_KEY
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
| `events` | Soldier events - soldier_id, creator_id (nullable), description, category, title, source, commander_note, ended_at |
| `checklists` | Attendance checklists - title, platoon_id, created_by |
| `checklist_completions` | Checklist completion records - checklist_id, soldier_id |
| `news` | Platoon news/announcements - title, content, created_by, platoon_id |

### Important Notes
- **RLS is DISABLED** on all tables for simplicity (3 trusted commanders)
- `events.creator_id` is nullable (NULL for soldier-created events)
- `events.source` distinguishes commander vs soldier created events
- `events.commander_note` allows commanders to reply to soldier requests
- Auto-create profile trigger on `auth.users` INSERT
- Realtime enabled on: soldiers, events, checklist_completions, news

---

## Features

### 1. Dashboard (`/`)
- Soldier count (base/home) with status toggle switches
- "Move all to base/home" buttons
- WhatsApp report generator
- **Quick notes** - inline note editing on soldier cards (yellow highlight)
- **News system** - create/edit/delete news announcements (CRUD)
- Search & filter soldiers by name and status

### 2. Events (`/events`)
- Create events for soldiers (title, description, category)
- Active vs ended sections with expandable cards
- Mark events as ended / delete events
- **Commander reply** - reply to soldier requests with notes
- Commander note displayed on both active and ended events
- "בקשת חייל" orange tag for soldier-submitted events
- WhatsApp share button per event
- **Notification badge** - red badge on events tab showing count of pending soldier requests

### 3. Attendance (`/checklists`)
- Create daily checklists
- Toggle soldier attendance
- Real-time completion tracking

### 4. Tracking (`/tracking`)
- Create mission tracking lists
- Check/uncheck soldier completion
- Delete tracking lists

### 5. Soldier Portal (`/s/[id]`)
- **Public page** - no auth required
- Soldier sees their info, events, and news
- **Edit personal info** - name, role, weapon serial, civilian job, notes
- Can submit event requests (source='soldier')
- Sees commander replies on their events
- Real-time updates via Supabase channel

### 6. AI Chat Assistant (floating)
- Floating bot icon (bottom-left) on all authenticated pages
- Powered by OpenAI GPT-4o-mini
- **Accesses all app data** - soldiers, events, checklists, news
- Answers in Hebrew about platoon status, soldier info, event summaries
- Conversation history maintained per session (not persisted to DB)

### 7. Dark/Light Mode
- Toggle button (Sun/Moon) in top navbar
- CSS variables switch via `data-theme` attribute on `<html>`
- Preference saved to localStorage

### 8. PWA & Offline
- Service worker with network-first caching
- Offline fallback page in Hebrew
- "Add to Home Screen" support with custom icons
- Manifest with standalone display mode

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

Must be set in both `.env.local` (local dev) and Vercel Environment Variables (production).
`OPENAI_API_KEY` is server-side only (no `NEXT_PUBLIC_` prefix).

---

## Key Config Decisions

### Force Dynamic Rendering
`export const dynamic = 'force-dynamic'` in root `layout.tsx` prevents static prerendering errors.

### CSP Headers
`next.config.ts` includes Content-Security-Policy allowing `unsafe-eval` (framer-motion), Supabase connections, and OpenAI API.

### Middleware
- Auth check on all routes except `/login`, `/auth`, `/s/`
- Env var guards (graceful fallback if Supabase vars missing)

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

-- Commander note column (006_commander_note.sql)
ALTER TABLE events ADD COLUMN IF NOT EXISTS commander_note TEXT;

-- News table (005_news.sql)
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  platoon_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_news_platoon ON news(platoon_id);
CREATE INDEX idx_news_created_at ON news(created_at DESC);
ALTER TABLE news DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE news;
```

---

## Deployment

- **Platform:** Vercel
- **Git:** GitHub (Orr45/mishma-at)
- **Auth Callback URL:** `https://mishma-at.vercel.app/auth/callback` (must be in Supabase Auth redirect URLs)
- **Build:** `next build` (all pages force-dynamic, no static generation)
