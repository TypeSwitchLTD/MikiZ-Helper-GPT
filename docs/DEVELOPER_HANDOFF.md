# Mission Control — Developer Handoff

> **Current version:** 0.7.5  
> **Prepared:** 2026-05-24  
> **For:** Incoming developer taking over from AI-assisted development phase

---

## Table of Contents

1. [What This Product Is](#1-what-this-product-is)
2. [Full Stack Architecture](#2-full-stack-architecture)
3. [Project Structure](#3-project-structure)
4. [Data Flow & Sync Model](#4-data-flow--sync-model)
5. [Auth System](#5-auth-system)
6. [What Was Built (History)](#6-what-was-built-history)
7. [What Was Fixed in This Session](#7-what-was-fixed-in-this-session)
8. [Known Issues & Open Bugs](#8-known-issues--open-bugs)
9. [What Remains To Build](#9-what-remains-to-build)
10. [Environment Setup](#10-environment-setup)
11. [Critical Rules — Read Before Touching Anything](#11-critical-rules--read-before-touching-anything)
12. [Deployment](#12-deployment)

---

## 1. What This Product Is

**Mission Control** is a personal productivity PWA built exclusively for one user (Miki, Tel Aviv). It is not a SaaS product — it's a personal command center with:

- Daily task management with buckets: `today`, `backlog`, `weekly`, `recurring`
- Morning briefing narration (Hebrew, Claude AI + ElevenLabs TTS)
- Habit tracking with streaks
- Reminders with push notifications
- Social media preview (Instagram/LinkedIn placeholders)
- Workout tracking placeholder
- Daily report generation + import (JSON handoff from day to day)
- Cloud sync across devices via Supabase (through a Cloudflare Worker)

**Language:** Hebrew UI, English code and comments.  
**Users:** Single user, multiple devices (desktop, phone, incognito).

---

## 2. Full Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 18 + TypeScript + Vite + Tailwind CSS               │
│  PWA (Vite PWA plugin — service worker for offline)        │
│                                                             │
│  Local storage: Dexie.js (IndexedDB wrapper)               │
│  DB name: mission-control-local  (version 6)               │
│                                                             │
│  Hosted: Cloudflare Pages                                   │
│  Repo: TypeSwitchLTD/MikiZ-Helper-GPT (main branch)        │
│                                                             │
│  IMPORTANT: dist/ IS committed to git.                     │
│  Cloudflare serves static files directly from the repo —   │
│  there is NO build step configured on the Cloudflare side. │
│  Always run npm run build && git push.                      │
└─────────────────────────────────────────────────────────────┘
             │
             │ fetch /api/sync-state
             │ fetch /api/morning-briefing
             ▼
┌─────────────────────────────────────────────────────────────┐
│               BACKEND — Cloudflare Pages Functions          │
│  /functions/api/                                            │
│  ├── sync-state.js       ← cloud sync push / pull          │
│  ├── morning-briefing.js ← generate + publish briefing     │
│  ├── tts.js              ← ElevenLabs TTS proxy            │
│  ├── instantly-stats.js  ← Instantly.ai lead stats         │
│  ├── meta-proxy.js       ← Facebook/Instagram proxy        │
│  └── table-stats.js      ← Supabase table stats            │
└─────────────────────────────────────────────────────────────┘
             │
             │ Supabase REST API (PostgREST)
             ▼
┌─────────────────────────────────────────────────────────────┐
│               DATABASE — Supabase (PostgreSQL)              │
│                                                             │
│  Tables (via cloud sync):                                   │
│  tasks, subtasks, daily_plans, recurring_definitions,      │
│  daily_reports, daily_logs, reminders, app_settings,       │
│  sync_events                                                │
│                                                             │
│  All rows have: id, workspace_id, raw (full JSON blob),    │
│  created_at, updated_at                                     │
│  workspace_id is always 'miki' (single-tenant)             │
└─────────────────────────────────────────────────────────────┘
```

### Key Environment Variables (Cloudflare Pages dashboard)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `MORNING_BRIEFING_TOKEN` | Bearer token for all API endpoints |
| `MISSION_CONTROL_WORKSPACE_ID` | `miki` (default if not set) |
| `ANTHROPIC_API_KEY` | Claude API for morning briefing generation |
| `ELEVENLABS_API_KEY` | TTS fallback on server side |
| `PUBLIC_APP_URL` | The app's public URL |

---

## 3. Project Structure

```
src/
├── app/
│   ├── AppShell.tsx          ← Root layout, auth gate, all modals
│   ├── App.tsx               ← Entry point wrapping AppShell
│   ├── useMissionControlData.ts  ← THE master data hook (read this first)
│   ├── ErrorBoundary.tsx
│   └── routes.tsx            ← Tab definitions
│
├── db/
│   ├── db.ts                 ← Dexie DB class, all mutations, importDailyStatePayload
│   ├── schema.ts             ← DB name, version, BackupSnapshot type
│   ├── localData.ts          ← Re-exports from db.ts
│   └── seed.ts               ← Default seed data for new installs
│
├── domain/
│   ├── cloud/cloudSync.ts    ← push/pull functions, CloudSyncPayload type
│   ├── tasks/
│   │   ├── taskTypes.ts      ← Task, Subtask interfaces
│   │   ├── taskMutations.ts  ← All write operations for tasks
│   │   ├── taskSelectors.ts  ← getTodayTasks, getQuickWinTasks, etc.
│   │   └── taskProgress.ts   ← Derives status from task + subtasks
│   ├── settings/
│   │   ├── settingsTypes.ts  ← AppSettings interface (large — read carefully)
│   │   ├── defaultSettings.ts
│   │   └── settingsService.ts
│   ├── reminders/            ← Reminder types + mutations
│   ├── habits/               ← Habit types + mutations
│   ├── recurring/            ← Recurring task schedule logic
│   ├── morning/              ← Morning briefing generation
│   └── cloud/                ← Cloudflare Worker client
│
├── features/
│   ├── tasks/TasksHubTab.tsx ← Main task view (today + buckets)
│   ├── today/TodayTab.tsx
│   ├── settings/SettingsTab.tsx
│   ├── reminders/
│   ├── morning/
│   ├── habits/ (inside personal/)
│   ├── auth/useBiometricAuth.ts ← WebAuthn / Passkeys
│   └── ...
│
└── utils/
    ├── dates.ts     ← getTodayISO(), nowISO(), formatHebrewDate()
    ├── ids.ts       ← createId(prefix)
    └── strings.ts
```

---

## 4. Data Flow & Sync Model

### The Master Hook

`useMissionControlData.ts` is the single entry point for all data. It returns all collections + derived computed values + all mutation functions. There is no Redux, no Zustand — just this one hook used in `AppShell`.

### Startup Sequence

```
1. initializeLocalDatabase()
   └── seedDatabaseIfNeeded() → puts seed data if tasks table is empty

2. rolloverStaleTodayTasks()
   └── moves tasks where bucket='today' AND date < today AND not completed/cancelled
       → updates their date to today, increments movedCount
   └── Uses sessionStorage key mc-rollover:<date> — runs once per day per tab

3. getAllLocalData() → loads everything from IndexedDB

4. Check URL for ?token= (bootstrap new device)
   └── If found: save token → pull from cloud → importDailyStatePayload → rollover
   └── Remove token from URL (security)

5. Auto-sync: if cloud token exists
   └── Check localStorage mc-last-cloud-pull timestamp
   └── If > 3 minutes ago: pull from cloud → smart merge → rollover → reload
   └── Update timestamp

6. setData(localData) → triggers React re-render

7. On visibility change (tab focus): pull from cloud, throttled 3 minutes
```

### Smart Merge (importDailyStatePayload)

The merge logic protects local state from being overwritten by stale cloud data:

```
For each task in cloud payload:
  1. If task doesn't exist locally → add it (new task)
  2. If local is cancelled AND cloud is not → SKIP (cancelled can't be resurrected)
  3. If local is completed AND cloud is not → SKIP (completed can't be un-done)
  4. If cloudTask.updatedAt > local.updatedAt → update (cloud is newer)
  5. Otherwise → keep local (same or older timestamp)
```

**Important:** The merge does NOT delete. Local-only tasks (e.g. created after last push) are always preserved.

### Push

Every mutation calls `reloadDataAndPushCloud()` which pushes the full local state to Supabase via the Worker. Push is fire-and-forget (no retry, no queue). If offline, data only lives in IndexedDB until next push.

---

## 5. Auth System

### How It Works

- PIN is a 6-digit code. Stored as SHA-256 hash in `settings.pinHash`.
- Settings are synced to cloud — so PIN hash is available on all devices after first pull.
- Biometric (WebAuthn Passkey) is stored as `settings.passkeyCredentialId`.
- On app load: wait for `isLoading = false`, then evaluate `settings.pinEnabled`.
- If PIN enabled and no valid `sessionStorage["mission-control-auth-ok"]` → show PIN screen.
- Lockout: 5 failed attempts → 15-minute lock, stored in `localStorage["mission-control-auth-lockout"]`.

### The Auth Bypass Bug (Fixed in 0.7.5)

Previously: auth was evaluated on first render when `data.settings = null`. Since `null?.pinEnabled = undefined` and `!undefined = true`, auth was immediately granted on every new device/incognito. **Fixed** by adding `data.isLoading` guard.

### Getting PIN to a New Device

When a user opens the app on a new device **without** the `?token=` param, they get:
1. Default settings (`pinEnabled: false`)
2. No cloud token
3. No data sync

**The correct way to bootstrap a new device:**
```
https://your-app.pages.dev/?token=YOUR_MORNING_BRIEFING_TOKEN
```
This triggers the bootstrap flow that pulls cloud settings (including pinHash), then requires PIN.

---

## 6. What Was Built (History)

### v0.7.5 (current)
- PIN lockout (5 attempts → 15 min) with shake animation
- WebAuthn Passkey biometric auth
- Auth bypass fix (new devices now require PIN)
- Smart merge: cancelled/completed tasks can't be resurrected by cloud
- Cloud sync: pull on every app open (3-min throttle via localStorage)
- Task rollover after every cloud pull + after manual JSON import
- `getTodayTasks` uses `<= todayISO` (was `=== todayISO`, so yesterday's tasks were invisible)
- `dist/` committed to git for Cloudflare static serving

### v0.7.4
- Personal tab with habits + streaks
- Morning briefing editable textarea before playback
- Clear-all tasks button
- Import daily report (JSON)
- Workday settings

### v0.7.3
- Settings rebuilt: Projects, Domains, Workday, Auth, API sections
- Cloud sync foundation (push + pull via Supabase/Cloudflare Worker)
- Morning briefing with ElevenLabs TTS

### Earlier versions
- Task creation wizard (multi-panel)
- Backlog, Quick Wins, In-Progress, Weekly views
- Recurring task definitions
- Reminder system with push notifications + sound
- Focus timer

---

## 7. What Was Fixed in This Session

All in `v0.7.5`:

| File | What Changed |
|---|---|
| `src/app/AppShell.tsx` | Auth effect now waits for `data.isLoading === false` before evaluating `pinEnabled`. Prevents auth bypass on new devices where initial settings is `null`. |
| `src/db/db.ts` | Merge rule in `importDailyStatePayload`: locally cancelled or completed tasks are now protected and cannot be overridden by cloud data. Changed `>=` to `>` in timestamp comparison. |
| `src/app/useMissionControlData.ts` | Replaced once-per-session pull (`sessionStorage SESSION_KEY`) with 3-minute throttled pull using `localStorage`. Added `rolloverStaleTodayTasks()` call after both bootstrap pull and auto-pull. |
| `src/domain/tasks/taskSelectors.ts` | `getTodayTasks` filter changed from `date === todayISO` to `date <= todayISO` — so tasks from yesterday that weren't completed still show today. |

---

## 8. Known Issues & Open Bugs

### 🔴 Critical

**1. No delete sync**  
When a task is deleted (not cancelled, but removed from IndexedDB), that deletion never propagates to cloud. The next pull will re-add the task from Supabase. Result: deleted tasks come back.  
**Workaround in place:** Cancel instead of delete. Cancelled tasks are protected from resurrection.  
**Real fix needed:** Add a `deletedAt` tombstone field to Task, and process deletions in `importDailyStatePayload`.

**2. Push failure is silent**  
If the cloud push fails (network error, token expired), data is only local. No retry, no queue, no user notification. The `cloudSyncStatus` string shows the error briefly but nothing persistent.  
**Fix needed:** Offline queue with retry logic.

**3. Cloud token not in the URL by default**  
Users need to manually navigate to `?token=...` to bootstrap any new device. If they just go to the bare URL they get empty default data. There's no onboarding flow to guide them.

### 🟡 Medium

**4. `schema.ts` has wrong APP_VERSION**  
`src/db/schema.ts` still says `APP_VERSION = '0.7.4'` but the app is `0.7.5`. Update it.

**5. Subtask merge is naive**  
In `importDailyStatePayload`, subtasks use raw `bulkPut` (no smart merge). If a subtask was completed locally and the cloud has it as `not_started`, the cloud version wins and the completion is lost.  
**Fix:** Apply the same merge logic used for tasks.

**6. Rollover runs before initial cloud pull on first startup**  
In the startup sequence, rollover runs first, then cloud pull imports tasks. If the cloud has stale tasks, rollover won't run a second time (sessionStorage key already set). The manual-import and auto-pull paths do run rollover after import, but the edge case remains if the user's sessionStorage was already set before a cloud import that day.

**7. Visibility change handler re-pulls even if PIN screen is showing**  
When the app is locked (PIN screen) and the user switches tabs and back, it pulls cloud data into the locked state. Not harmful, just wasteful.

**8. `movedCount` is not capped**  
Tasks that roll over every day accumulate `movedCount` forever. There's no UI for this count. Should either show it as a visual signal ("this task has been ignored 5 days") or reset it.

### 🟢 Minor / Cosmetic

**9. `dist/` in git is messy**  
The built JS bundle is committed to the repo (`dist/assets/index-HASH.js`). Every build creates a new hash file without deleting the old one, growing the repo. Should periodically clean old dist hashes.

**10. No test coverage**  
Zero automated tests. All testing is manual. The domain logic (`taskProgress.ts`, `taskSelectors.ts`, `recurringSchedule.ts`) is pure and should be easy to unit test.

**11. `AppShell.tsx` is 1500+ lines**  
The main component handles auth, all modals, all event handlers, the command center, the morning briefing flow. It needs to be split into sub-components.

---

## 9. What Remains To Build

### High Priority

**A. Real delete sync (tombstones)**
```typescript
// Add to Task type:
deletedAt?: string | null;

// In importDailyStatePayload:
// Process tombstones → mark local tasks as deleted
// In taskSelectors: filter out deletedAt tasks from all views
```

**B. Offline push queue**
When push fails, store pending mutations in IndexedDB and retry on next online event. Simple write-ahead log approach.

**C. New device onboarding**  
When user opens the app without a token, show a "Connect to your data" screen with a QR code or token input field instead of the default seed data.

### Medium Priority

**D. Smart subtask merge**  
Apply the same `cancelled/completed wins` logic to subtasks in `importDailyStatePayload`.

**E. Recurring task auto-add**  
`settings.scheduling.autoAddRecurringToToday` exists but isn't fully wired. Recurring definitions should auto-generate today-tasks based on their frequency at startup.

**F. Weekly view improvements**  
The weekly overview tab is partially built — it shows tasks but doesn't have day-by-day planning. The `DailyPlan` + `DailyPlanBlock` types are defined and stored but the planning UI is minimal.

**G. Reports tab**  
`DailyReport` type exists and is stored. A proper report view (completed tasks, time spent, trends) is not built.

### Low Priority / Nice to Have

**H. Split AppShell.tsx** into `AuthGate`, `AppLayout`, `ModalManager`

**I. Unit tests** for `taskProgress.ts`, `taskSelectors.ts`, `importDailyStatePayload` merge logic

**J. Supabase RLS policies** — currently using service role key (bypasses all RLS). Should set up proper policies.

**K. Push notification permission flow** — notifications work if permission was granted, but there's no UI prompt to request permission on first run.

**L. Social / Workout tabs** are placeholders. InstantlyCard and MetaConnectCard show stats but there's no real social publishing workflow.

---

## 10. Environment Setup

```bash
# Clone
git clone https://github.com/TypeSwitchLTD/MikiZ-Helper-GPT
cd MikiZ-Helper-GPT

# Install
npm install

# Dev server (port 3000)
npm run dev
# The ElevenLabs proxy is configured in vite.config.ts

# Build
npm run build
# Output goes to dist/ — this MUST be committed (see Deployment)

# TypeCheck only
npm run typecheck
```

No `.env` file needed for frontend dev. The Cloudflare environment variables are only needed for the Worker functions.

### First-time local setup

1. Open `http://localhost:3000`
2. App seeds itself with demo tasks
3. Settings tab → Auth section to set PIN
4. Settings tab → Morning / Android section to configure cloud token

---

## 11. Critical Rules — Read Before Touching Anything

### ☠️ NEVER run this command:
```javascript
indexedDB.deleteDatabase('mission-control-local')
```
This wipes **all user data including API tokens**. There is no recovery. If you need to reset, use the "Clear all tasks" button in Settings, which only wipes tasks/subtasks and preserves settings.

### ⚠️ Always build before pushing:
```bash
npm run build && git add -A && git commit -m "..." && git push origin main
```
Cloudflare reads `dist/` directly from git. If you push without building, the live app stays on the old version.

### ⚠️ Do not change the DB name:
`DATABASE_NAME = 'mission-control-local'` in `schema.ts`. Changing this abandons all existing user data in the old database.

### ⚠️ DB version increments are irreversible:
When adding new Dexie version with `.version(N)`, it cannot be rolled back in production. Always add an `.upgrade()` handler that is safe to run on existing data.

### ⚠️ The cloud token is sensitive:
`settings.morningBriefing.androidPublishToken` is the single key that protects the entire cloud sync endpoint. It is stored in plaintext in Supabase and in the app's IndexedDB. Do not log it, do not expose it in URLs persistently (the `?token=` bootstrap flow removes it from the URL after saving).

### ✅ Safe ways to debug:
- DevTools → Application → IndexedDB → `mission-control-local` → browse tables
- DevTools → Application → Storage → Clear site data (to force fresh load with new service worker)
- `localStorage.removeItem('mc-last-cloud-pull')` to force an immediate cloud re-pull

---

## 12. Deployment

The deployment pipeline is entirely manual:

1. Make changes in `src/`
2. `npm run build` (TypeScript check + Vite build → `dist/`)
3. `git add -A && git commit -m "description" && git push origin main`
4. Cloudflare Pages detects the push and serves `dist/index.html` directly
5. No CI/CD, no build step on Cloudflare side

### Why dist/ is in git

Cloudflare Pages was configured to serve static files from the repository rather than running a build. This was done because:
- Cloudflare's build environment had version conflicts
- Simpler deployment model — what you commit is what runs
- Downside: binary JS artifacts in git history

**To switch to proper Cloudflare build:**
1. Cloudflare Dashboard → Pages project → Settings → Builds & deployments
2. Set Build command: `npm run build`
3. Set Build output directory: `dist`
4. Add `.gitignore` entry for `dist/`
5. Never commit `dist/` again

### Cloudflare Pages Functions

`/functions/api/` are automatically deployed by Cloudflare as Edge Functions. They run on Cloudflare's network. Environment variables are set in the Cloudflare dashboard (not in code).

---

## Appendix: Key Type Definitions

### Task (simplified)
```typescript
interface Task {
  id: string;              // 'task-<nanoid>'
  title: string;
  bucket: 'today' | 'backlog' | 'weekly' | 'recurring';
  date: string | null;     // ISO date '2026-05-24'
  statusOverride?: 'cancelled' | 'moved' | null;
  completedAt?: string | null;  // ISO datetime
  updatedAt: string;       // ISO datetime — used for merge conflict resolution
  movedCount: number;      // times this task was rolled forward
  source: 'manual' | 'recurring' | 'imported' | 'seed';
  // ... priority, effort, tags, projectId, domainId, etc.
}
```

### AppSettings (key fields)
```typescript
interface AppSettings {
  id: 'default';           // always 'default' — singleton row
  pinEnabled: boolean;
  pinHash?: string | null; // SHA-256 of 'mission-control-pin:<6-digit-PIN>'
  passkeyCredentialId?: string | null;  // WebAuthn credential ID
  morningBriefing: {
    androidPublishToken?: string;  // THE cloud sync token
    androidPublishEndpoint?: string;  // Cloudflare Worker URL
  };
  projects: Project[];     // user-defined projects
  domains: Domain[];       // user-defined domains
}
```

### Cloud sync token flow
```
User sets token in Settings UI
  → saved to AppSettings.morningBriefing.androidPublishToken
  → pushed to Supabase via sync-state Worker
  → available on pull to any device bootstrapped with the same token
```

---

*Document generated from codebase state at commit `063d1d1` (2026-05-24)*
