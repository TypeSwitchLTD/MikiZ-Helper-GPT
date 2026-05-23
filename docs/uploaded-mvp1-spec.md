# Mission Control — MVP 1 Product + Architecture Spec for Codex

מסמך זה מיועד להעברה ישירה ל־Codex / Claude / מפתח. הוא מגדיר את פרופיל המפתח, עקרונות המוצר, גבולות MVP 1, ארכיטקטורה, מודל נתונים, מסכים, workflows, גיבוי, בדיקות ו־Definition of Done.

---

## 0. Executive Summary

אנחנו בונים כלי עבודה אישי בשם **Mission Control**.

זה לא SaaS, לא Jira, לא Notion, לא Monday, ולא מערכת enterprise. זה כלי מקומי, מהיר, יציב וברור, שנועד לשמש יזם אחד במשך יום עבודה אמיתי עם עומס משימות, ADHD, לידים, פיתוח מוצר, שיווק, תפעול, כספים ופולואפים.

ה־MVP הראשון ירוץ **מקומית על המחשב**, ייפתח בכרום במסך שני, וישמור מידע ב־**IndexedDB** עם גיבוי אוטומטי וידני. Supabase יישאר לשלב מאוחר יותר, אבל ה־data model ייבנה בצורה שתאפשר מעבר/סנכרון בעתיד.

---

## 1. Developer Operating Skill / Profile

### 1.1 Role

You are a product-minded senior full-stack developer and lightweight systems architect.

You are not here to build a generic task manager. You are building a daily operating cockpit for one entrepreneur.

Your priorities are:

1. Preserve the user’s workflow.
2. Prevent lost tasks.
3. Keep the UI clean, RTL, Hebrew-first, desktop-first.
4. Avoid over-engineering.
5. Build a stable local-first MVP.
6. Make future Supabase integration possible without implementing it now.

### 1.2 Product mindset

Before implementing anything, ask:

- Does this reduce cognitive load?
- Does this prevent losing work?
- Does this help the user know what to do now?
- Does this make end-of-day reporting easier?
- Is this simpler than the alternative?

Do not add abstractions, auth, roles, permissions, SaaS-like account management, complex dashboards, or external integrations in MVP 1 unless explicitly requested.

### 1.3 Technical mindset

Use boring, maintainable tools.

Recommended stack:

- React
- TypeScript
- Vite
- Dexie.js for IndexedDB
- Tailwind CSS or simple CSS modules
- Local JSON backup/export/import
- Private GitHub repo

Avoid:

- Backend in MVP 1 unless unavoidable
- Supabase in MVP 1 except placeholders/interfaces
- Storing secrets in client code
- Relying on localStorage for core data
- Using array indexes as IDs
- Large UI frameworks unless needed
- Complex recurring-rule engines in MVP 1

### 1.4 Coding rules

- All code identifiers must be in English.
- UI labels should be Hebrew/RTL.
- Use stable IDs for every task and subtask.
- Treat data preservation as a first-class requirement.
- Every mutation should create or update a log event.
- Every meaningful mutation should trigger local save.
- Use derived task status from subtasks, not duplicated status where avoidable.
- Separate data layer, domain logic, and UI components.

### 1.5 Communication style

When working with the user:

- Do not ask repeated questions.
- Ask only questions that block implementation.
- Prefer making practical product decisions and explaining them.
- Keep scope tight.
- Surface risks clearly, especially around browser file backups and client-side PIN security.

---

## 2. Business / Product Context

The user manages multiple projects:

### TimerAligner
Main active product. Smart aligner case with timer. Supports 10/30 minute timers, beep/vibration/both, USB-C charging. Related work includes website, doctors page, B2B pricing, Apollo lead research, production with Jack, packaging, QA, logistics.

### AlignersWorld
Shopify store for clear aligner accessories and TimerAligner sales. Related work includes checkout links, product variants, images, pricing tiers, payment providers, store QA.

### TypeSwitch
Less active but important. Patent/design/development follow-ups involving Yaakov, designer/developer, Svetlana, payments and technical materials.

### Other domains
Personal, Finance, Operations, Marketing, Sales, Shopify, Apollo, Website QA, Social Content, Production.

---

## 3. MVP 1 Product Goals

MVP 1 succeeds if after one week:

- The user opens the system every morning and actually uses it.
- In-progress tasks do not disappear.
- Interrupted tasks are easy to capture.
- Quick wins are easy to find when focus is low.
- End-of-day report is easy to generate/copy/save.
- Backlog prevents losing future tasks.
- Recurring tasks are visible and trackable.
- The system feels lighter than Notion/Jira/Monday.
- The user has less panic and less cognitive overload.

---

## 4. MVP 1 Scope

### Included

1. Local desktop web app.
2. Hebrew RTL UI.
3. Tabs:
   - Today
   - In Progress
   - Quick Wins
   - Backlog
   - Weekly / Recurring
   - Report
   - Settings
4. Task and subtask CRUD.
5. Mandatory subtasks.
6. Start/done state at subtask level.
7. Derived task progress.
8. Move to Tomorrow.
9. Change Date.
10. Cancel.
11. Backlog tab and Backlog preview inside Today.
12. Quick add task/interruption flow.
13. Recurring checkbox when creating tasks.
14. Recurring popover with five frequency options.
15. Daily report generation, edit, copy and save.
16. IndexedDB persistence.
17. Auto-save after changes.
18. Periodic snapshots every 30 minutes while app is open.
19. Best-effort save when tab is hidden/closed.
20. Manual “save before closing” action.
21. Export/Import JSON backup.
22. Optional automatic file backup where Chrome permissions allow it.
23. Settings for workday, rest windows, location, projects/domains, PIN, backup, recurring presets.

### Excluded from MVP 1

1. Supabase live integration.
2. Real authentication.
3. Multi-user accounts.
4. Permissions/roles.
5. Mobile-first UX.
6. Push notifications.
7. Advanced analytics.
8. Calendar view.
9. CSV import.
10. External APIs for weather, sunset or Shabbat times.
11. Shopify/Apollo/GitHub automation.

---

## 5. Architecture Decision

### 5.1 Runtime

Run locally on the user’s computer.

Development/run mode:

```bash
npm install
npm run dev
```

Open in Chrome on a second screen.

MVP 1 does not need GitHub Pages. The code should live in a private GitHub repository for version control.

### 5.2 Storage

Primary storage:

- IndexedDB using Dexie.js.

Why:

- It is local.
- It supports structured data.
- It is better than localStorage for tasks, logs, reports and history.
- It allows future migration/sync to Supabase.

Important clarification:

IndexedDB is local storage on the user’s machine, but it is browser-profile storage, not a normal visible file. Therefore we also implement backup/export.

### 5.3 Backup strategy

MVP 1 uses layered backup:

1. Live data: IndexedDB.
2. Internal snapshots: stored in IndexedDB every 30 minutes while app is open.
3. Manual Export JSON.
4. Manual Import JSON.
5. Optional automatic write to a user-selected backup file using Chrome File System Access API.

Browser limitation:

- Closing laptop/computer is not guaranteed to allow asynchronous save.
- beforeunload/visibilitychange should be best-effort only.
- Therefore provide a manual button: “שמירה לפני סגירה”.

Important product decision:

Closing the computer is not “end of day”. The user may just be going to a cafe or taking a break. Therefore:

- “שמירה לפני סגירה” only saves/snapshots/backups.
- “Generate Daily Report” is separate.
- “End of Day” behavior is not tied to computer shutdown.

### 5.4 Future Supabase

Supabase is deferred to MVP 3.

MVP 1 should include only:

- Disabled Settings placeholder.
- Data model interfaces that do not block Supabase later.
- No Supabase keys.
- No client-side secrets.

Future plan:

- Read-only pull from existing lead tables.
- Internal lead status stored separately.
- Optional Supabase RLS or backend/edge function later.

---

## 6. Repository Structure

Recommended structure:

```text
mission-control/
  docs/
    product-spec.md
    data-model.md
    implementation-plan.md
  src/
    app/
      App.tsx
      routes.tsx
      AppShell.tsx
    db/
      db.ts
      schema.ts
      seed.ts
      backup.ts
    domain/
      tasks/
        taskTypes.ts
        taskSelectors.ts
        taskMutations.ts
        taskProgress.ts
      reports/
        reportTypes.ts
        reportGenerator.ts
      recurring/
        recurringTypes.ts
        recurringEngine.ts
      settings/
        settingsTypes.ts
        defaultSettings.ts
      logs/
        logTypes.ts
        logService.ts
    features/
      today/
      in-progress/
      quick-wins/
      backlog/
      recurring/
      reports/
      settings/
      task-editor/
    components/
      ui/
      layout/
      task/
    utils/
      dates.ts
      ids.ts
      hebrewLabels.ts
      storageGuards.ts
  public/
  package.json
  vite.config.ts
  tsconfig.json
```

---

## 7. Data Model

Use English field names. UI labels are Hebrew.

### 7.1 Task

```ts
export type TaskBucket = 'today' | 'backlog' | 'weekly' | 'recurring';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskEffort = 'quick' | 'medium' | 'deep';

export type BacklogGroup =
  | 'tomorrow'
  | 'this_week'
  | 'waiting'
  | 'later';

export type TaskStatusDerived =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'moved';

export interface Task {
  id: string;
  title: string;
  projectId: string;
  domainId: string;
  bucket: TaskBucket;
  date: string | null; // YYYY-MM-DD, null for unscheduled backlog
  originalDate: string | null;
  scheduledTimeLabel?: string; // e.g. "עכשיו", "היום", "ראשון 13:30"
  estimatedDurationMinutes?: number | null;
  durationLabel?: string;
  priority: TaskPriority;
  effort: TaskEffort;
  isQuickWin: boolean;
  isRecurring: boolean;
  recurrenceDefinitionId?: string | null;
  backlogGroup?: BacklogGroup | null;
  tags: string[];
  whyNow?: string;
  notes?: string;
  statusOverride?: 'cancelled' | 'moved' | null;
  movedCount: number;
  movedToDate?: string | null;
  source: 'manual' | 'recurring' | 'imported' | 'interruption' | 'seed';
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
}
```

### 7.2 Subtask

```ts
export type SubtaskStatus = 'not_started' | 'started' | 'done' | 'cancelled';

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  domainId?: string | null;
  estimatedDurationMinutes?: number | null;
  durationLabel?: string;
  toolsNeeded?: string;
  notes?: string;
  status: SubtaskStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

### 7.3 Derived task status

Do not store duplicated task progress unless necessary. Compute from subtasks.

Rules:

```ts
function getTaskProgress(task: Task, subtasks: Subtask[]): {
  status: TaskStatusDerived;
  percent: number;
  startedCount: number;
  doneCount: number;
  totalCount: number;
} {
  if (task.statusOverride === 'cancelled') return ...;
  if (task.statusOverride === 'moved') return ...;

  const active = subtasks.filter(s => s.status !== 'cancelled');
  const started = active.filter(s => s.status === 'started' || s.status === 'done');
  const done = active.filter(s => s.status === 'done');

  if (active.length === 0) return not_started 0%;
  if (done.length === active.length) return done 100%;
  if (started.length > 0) return in_progress;
  return not_started;
}
```

### 7.4 RecurringTaskDefinition

```ts
export type RecurrenceFrequency =
  | 'every_day'
  | 'three_times_per_week'
  | 'once_per_week'
  | 'once_every_two_weeks'
  | 'once_per_month';

export interface RecurringTaskDefinition {
  id: string;
  sourceTaskId?: string | null;
  title: string;
  projectId: string;
  domainId: string;
  frequency: RecurrenceFrequency;
  preferredTimingNote?: string; // one free text box
  defaultScheduledTimeLabel?: string;
  defaultSubtasks: Array<{
    title: string;
    domainId?: string | null;
    estimatedDurationMinutes?: number | null;
    toolsNeeded?: string;
    notes?: string;
    sortOrder: number;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastGeneratedAt?: string | null;
}
```

MVP 1 behavior:

- Creating a recurring task stores a definition.
- Weekly/Recurring tab shows definitions.
- Due recurring tasks appear as suggestions.
- User can click Add to Today.
- Settings may include `autoAddRecurringToToday`, default false.

### 7.5 DailyReport

```ts
export interface DailyReport {
  id: string;
  date: string;
  locationLabel?: string | null;
  timezone?: string | null;
  generatedAt: string;
  editedAt?: string | null;
  markdownContent: string;
  editedMarkdownContent?: string | null;
  payload: DailyReportPayload;
  createdAt: string;
  updatedAt: string;
}
```

Payload should include all structured report sections so future weekly/monthly analytics can be generated without parsing Markdown.

### 7.6 LogEvent

```ts
export type LogEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_cancelled'
  | 'subtask_started'
  | 'subtask_completed'
  | 'subtask_cancelled'
  | 'report_generated'
  | 'backup_created'
  | 'settings_updated'
  | 'recurring_created'
  | 'recurring_added_to_today'
  | 'snapshot_created'
  | 'note_added';

export interface LogEvent {
  id: string;
  timestamp: string;
  type: LogEventType;
  entityType: 'task' | 'subtask' | 'report' | 'settings' | 'backup' | 'recurring' | 'system';
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}
```

### 7.7 Settings

```ts
export interface AppSettings {
  id: 'default';
  pinEnabled: boolean;
  pinHash?: string | null;

  workday: {
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    primaryRestWindow: RestWindow;
    secondaryRestWindow?: RestWindow | null;
  };

  location: {
    label?: string;
    city?: string;
    country?: string;
    timezone?: string;
    latitude?: number | null;
    longitude?: number | null;
  };

  scheduling: {
    warnOnRestWindowConflict: boolean;
    autoAddRecurringToToday: boolean;
  };

  backup: {
    autoBackupEnabled: boolean;
    backupIntervalMinutes: number; // default 30
    lastBackupAt?: string | null;
    lastSnapshotAt?: string | null;
    fileBackupEnabled: boolean;
  };

  projects: Project[];
  domains: Domain[];

  createdAt: string;
  updatedAt: string;
}

export interface RestWindow {
  enabled: boolean;
  label: string;
  startTime: string;
  endTime: string;
}
```

---

## 8. IndexedDB / Dexie Schema

Recommended Dexie tables:

```ts
this.version(1).stores({
  tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, createdAt, updatedAt',
  subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
  recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
  reports: 'id, date, generatedAt, createdAt, updatedAt',
  logs: 'id, timestamp, type, entityType, entityId',
  settings: 'id',
  snapshots: 'id, createdAt, reason'
});
```

Snapshot object:

```ts
export interface BackupSnapshot {
  id: string;
  createdAt: string;
  reason: 'interval' | 'manual' | 'before_close' | 'report' | 'import' | 'visibility_hidden';
  appVersion: string;
  data: {
    tasks: Task[];
    subtasks: Subtask[];
    recurringDefinitions: RecurringTaskDefinition[];
    reports: DailyReport[];
    logs: LogEvent[];
    settings: AppSettings;
  };
}
```

Keep the latest N snapshots in IndexedDB to avoid uncontrolled growth. Suggested N for MVP 1: 50.

---

## 9. UI / UX Requirements

### 9.1 Overall UI

- Hebrew-first.
- `dir="rtl"` on app root.
- Desktop-first, optimized for 1440px+ width.
- Responsive enough not to break on mobile, but mobile is not primary.
- Clean cards, not dense enterprise UI.
- Visual progress bars.
- Sticky top summary area if practical.
- Avoid hidden destructive actions.

### 9.2 Header

Show:

- App title: TimerAligner / Mission Control or Mission Control.
- Current date.
- Location label if set.
- Workday range.
- Rest window warning if current time is inside rest window.
- Backup status indicator.
- Quick action: Add Task.
- Quick action: Save Before Closing.

### 9.3 Summary cards

Cards should show:

- Total today tasks.
- Started.
- Done.
- Open subtasks.
- Overall progress.
- In Progress count.
- Backlog preview count if space allows.

### 9.4 Tabs

Tabs:

1. Today
2. In Progress
3. Quick Wins
4. Backlog
5. Weekly / Recurring
6. Report
7. Settings

Keep tab labels short.

---

## 10. Tab Specs

### 10.1 Today

Purpose:

Show what to work on today and what is currently active.

Sections:

1. Current / Now
2. Today Open
3. Done Today
4. Backlog Preview

Task card should show:

- time label
- title
- project/domain tag
- duration
- why now
- progress percent
- progress bar
- subtasks table/list
- actions

Subtask row should show:

- Start checkbox
- Done checkbox
- title
- domain
- duration
- tools
- notes

Actions:

- Add task
- Add interruption
- Move to Tomorrow
- Change Date
- Cancel

Scheduling warning:

If task time overlaps rest window, show warning badge.

### 10.2 In Progress

Purpose:

Show anything started but not completed, regardless of date.

Filter:

- Has at least one started/done subtask.
- Not all active subtasks done.
- Not cancelled.

Show:

- original date
- current date / scheduled date
- moved count
- unfinished subtasks
- last updated

Actions:

- Move to Tomorrow
- Change Date
- Cancel

### 10.3 Quick Wins

Purpose:

Low-focus mode.

Filter:

- `isQuickWin === true` OR estimated duration <= 10 minutes.
- Not done.
- Not cancelled.

Show short cards.

Optional MVP 1 button:

- “בחר לי 3 קלילות” can be deferred unless easy.

### 10.4 Backlog

Purpose:

Do not lose tasks that are not for now.

Groups:

1. מחר — tomorrow
2. השבוע — this_week
3. ממתין — waiting
4. בהמשך — later

Each task can be promoted to Today or Change Date.

Backlog preview in Today should show only high-relevance items:

- tomorrow
- waiting
- recently added interruptions

### 10.5 Weekly / Recurring

Purpose:

Manage recurring and weekly tasks without a complex calendar.

Show:

- active recurring definitions
- due today suggestions
- missed recurring items
- Add to Today button

Creation flow:

When user creates a task and checks Recurring:

Popover opens with:

- One text box: “הערת חזרתיות / ימים ושעה מועדפים”
- Five frequency options:
  - כל יום
  - 3 פעמים בשבוע
  - פעם בשבוע
  - פעם בשבועיים
  - פעם בחודש

Store as recurring definition.

Default recurring presets:

- Website QA — 3 times/week, morning.
- Finance Weekly — once/week, Sunday afternoon.
- TypeSwitch Follow-up — 2 times/week. Since MVP has only five frequency options, store as custom note under once/week or add a preset-specific suggested schedule without general custom engine.
- Social Daily — every day.

Important: Do not build a full RRULE engine in MVP 1.

### 10.6 Report

Purpose:

Generate a daily report for the system/future ChatGPT use.

Features:

- Generate report.
- Edit report text.
- Save report.
- Copy report.
- View previous reports.

Report must include all tasks including recurring tasks.

Default Markdown structure:

```md
# Daily Mission Control Report — YYYY-MM-DD

## Context
- Location: ...
- Workday: ...
- Rest windows: ...

## Completed
- Task title — project/domain — progress — recurring? yes/no
  - Done subtasks: ...

## In Progress
- Task title — original date — moved count — unfinished subtasks

## Not Started
- ...

## Moved / Rescheduled
- Task title — from date -> to date — moved count

## Cancelled
- ...

## Backlog
### Tomorrow
- ...
### This Week
- ...
### Waiting
- ...
### Later
- ...

## Recurring
- Due today: ...
- Completed recurring: ...
- Missed recurring: ...

## Notes
- ...

## Tomorrow Priorities
- ...

## Raw Metrics
- totalTasks: ...
- completedTasks: ...
- startedTasks: ...
- quickWinsCompleted: ...
- recurringCompleted: ...
- recurringMissed: ...
```

### 10.7 Settings

Settings sections:

1. PIN lock
2. Workday
3. Rest windows
4. Location
5. Projects
6. Domains
7. Recurring presets
8. Backup
9. Supabase placeholder
10. Data tools

#### Workday settings

Fields:

- start time
- end time
- primary rest window, required
- secondary rest window, optional

#### Rest windows

Primary rest window is always present.
Secondary rest window is enabled only if user fills it.

Behavior:

- Warn when scheduling a task inside rest window.
- Do not block unless a future strict mode is added.

#### Location settings

Fields:

- manual location label
- city
- country
- timezone
- latitude optional
- longitude optional

Future use:

- weather
- sunset
- Shabbat entry times

MVP 1 only stores the values.

#### Backup settings

Fields:

- Auto backup enabled
- Interval minutes, default 30
- Export backup button
- Import backup button
- Select backup file, if File System Access API is available
- Last backup time
- Last snapshot time

#### Data tools

- Clear demo data only after confirmation.
- Export all data.
- Import all data.
- Show app version.

---

## 11. Main User Flows

### 11.1 Morning open

1. User opens app locally.
2. App loads IndexedDB.
3. App checks settings.
4. App displays Today.
5. App shows In Progress from previous days.
6. App shows recurring due suggestions.
7. App shows backup status.

### 11.2 Add task

1. User clicks Add Task.
2. Form opens.
3. User enters title.
4. User chooses bucket: Today or Backlog.
5. If Backlog, choose group.
6. User selects project/domain.
7. User enters subtasks.
8. If no subtasks, system creates one subtask with the task title.
9. User optionally marks Quick Win.
10. User optionally checks Recurring.
11. If Recurring checked, popover opens.
12. Save creates task and logs event.

### 11.3 Add interruption

1. User clicks Add Interruption.
2. Form opens with source = interruption.
3. User chooses Today or Backlog.
4. System tags it as `interruption`.
5. Task appears in selected location.

### 11.4 Start subtask

1. User checks Start.
2. Subtask status becomes started.
3. startedAt is set if empty.
4. Task appears in In Progress.
5. Log event is created.
6. Save is triggered.

### 11.5 Complete subtask

1. User checks Done.
2. If Start was not checked, system implicitly marks started.
3. completedAt is set.
4. Task progress recalculates.
5. If all active subtasks done, task is done.
6. Save and log.

### 11.6 Move to Tomorrow

1. User clicks Move to Tomorrow.
2. Task date changes to tomorrow.
3. originalDate remains unchanged.
4. movedCount increments.
5. movedToDate is set.
6. Task remains traceable in report.
7. Log event created.

### 11.7 Change Date

1. User clicks Change Date.
2. Date picker opens.
3. User chooses target date.
4. originalDate remains unchanged.
5. movedCount increments if date changes.
6. Log event created.

### 11.8 Cancel

1. User clicks Cancel.
2. Confirmation required.
3. Task statusOverride becomes cancelled.
4. cancelledAt set.
5. Task included in report under Cancelled.
6. Do not delete.

### 11.9 Save before closing

1. User clicks “שמירה לפני סגירה”.
2. App saves current IndexedDB state.
3. App creates snapshot with reason `before_close`.
4. If file backup configured, tries writing backup file.
5. Shows result:
   - saved locally
   - snapshot created
   - file backup written / not available

This is not end-of-day.

### 11.10 Generate report

1. User opens Report.
2. Clicks Generate.
3. App builds structured payload.
4. App generates Markdown from payload.
5. User may edit text.
6. User saves/copies.
7. Report stored in IndexedDB.
8. Log event created.

---

## 12. Backup Details

### 12.1 Auto-save

Every mutation should call a central persistence function.

Examples:

- task created
- task edited
- subtask started
- subtask done
- task moved
- report generated
- settings updated

### 12.2 Snapshot interval

Every 30 minutes while app is open:

- Create snapshot in IndexedDB.
- If file backup configured and allowed, write backup.
- Keep only latest 50 snapshots.

### 12.3 Browser lifecycle events

Use:

- visibilitychange
- pagehide
- beforeunload

But treat them as best effort. Do not depend on them for correctness.

### 12.4 File System Access API

If supported:

- User selects backup file once.
- Store file handle if possible.
- On backup, write JSON.
- If permission denied/lost, show warning and fall back to manual export.

### 12.5 Import validation

Before importing JSON:

- Validate shape.
- Validate version.
- Validate IDs.
- Show summary.
- Require confirmation.
- Create pre-import snapshot.
- Then import.

---

## 13. Seed Data

Use seed data inspired by the prototype but do not hardcode it permanently into app logic.

Seed examples:

- Apollo mapping
- Apollo people search
- Apollo country comparison
- Direct checkout link update
- Jack follow-up
- Instagram following
- Website fixes
- Evening story planning
- Finance weekly
- Shopify quantity tiers
- Payment providers
- TypeSwitch patent follow-up
- Mission Control backend/Supabase future task

Seed data should live in `src/db/seed.ts` and be optional.

---

## 14. Labels / Hebrew UI Mapping

Use English statuses internally and Hebrew labels in UI.

Examples:

```ts
export const statusLabels = {
  not_started: 'פתוח',
  in_progress: 'התחיל',
  done: 'בוצע',
  cancelled: 'בוטל',
  moved: 'הועבר'
};
```

Frequency labels:

```ts
export const recurrenceLabels = {
  every_day: 'כל יום',
  three_times_per_week: '3 פעמים בשבוע',
  once_per_week: 'פעם בשבוע',
  once_every_two_weeks: 'פעם בשבועיים',
  once_per_month: 'פעם בחודש'
};
```

Backlog labels:

```ts
export const backlogLabels = {
  tomorrow: 'מחר',
  this_week: 'השבוע',
  waiting: 'ממתין',
  later: 'בהמשך'
};
```

---

## 15. Testing / QA Checklist

### Persistence

- Refresh page after checking subtask start/done; state remains.
- Close/reopen tab; state remains.
- Export backup, clear data, import backup; state restored.

### IDs

- Add task before existing tasks; old subtask states remain correct.
- Delete/cancel task; other tasks do not lose state.
- Reorder tasks if implemented; state remains correct.

### In Progress

- Start a subtask today, do not complete it.
- Change app date/mock date to tomorrow or create tomorrow session.
- Task still appears in In Progress.

### Move / Change Date

- Move task to tomorrow.
- originalDate preserved.
- movedCount increments.
- Report shows moved task.

### Recurring

- Create recurring task.
- Definition appears in Weekly/Recurring.
- Add to Today creates a task instance.
- Report includes recurring tasks.

### Report

- Report includes completed, in progress, not started, moved, cancelled, backlog, recurring.
- Edited report saves.
- Copy works.

### Settings

- Workday updates persist.
- Rest window warning appears for conflicting schedule.
- Location fields persist.
- Backup settings persist.

### RTL

- Tables/cards align correctly RTL.
- English terms/URLs remain readable.
- Mobile width does not completely break layout.

---

## 16. Definition of Done for MVP 1

MVP 1 is done when:

1. The app runs locally in Chrome.
2. Data persists through refresh and browser close/reopen.
3. Tasks/subtasks can be created, edited, started and completed.
4. Every task has at least one subtask.
5. Task progress is derived from subtasks.
6. In Progress persists across days.
7. Quick Wins tab works.
8. Backlog tab and Today preview work.
9. Weekly/Recurring tab supports definitions and Add to Today.
10. Report can generate/copy/save daily report with all tasks including recurring.
11. Settings includes workday, two rest windows, location, projects/domains, backup, PIN placeholder.
12. Auto-save and snapshots work.
13. Export/import JSON works.
14. No Supabase secrets exist in code.
15. No localStorage is used for core data.
16. No array indexes are used as persistent IDs.
17. Basic smoke tests/manual QA pass.

---

## 17. Implementation Phases for Codex

### Phase 0 — Project setup

- Create Vite React TypeScript project.
- Add Dexie.
- Add routing/tabs.
- Add RTL CSS baseline.
- Add seed data.

Deliverable: app shell with tabs and seed data loaded from static mock.

### Phase 1 — Data layer

- Dexie schema.
- Types.
- ID generator.
- Settings defaults.
- Seed import into IndexedDB.
- Basic CRUD services.

Deliverable: data persists locally.

### Phase 2 — Task UI

- Task card.
- Subtask table/list.
- Start/done actions.
- Progress calculation.
- Today tab.

Deliverable: user can work through daily tasks.

### Phase 3 — Core tabs

- In Progress.
- Quick Wins.
- Backlog.
- Weekly/Recurring.

Deliverable: workflow tabs match MVP.

### Phase 4 — Task actions

- Add Task.
- Add Interruption.
- Move to Tomorrow.
- Change Date.
- Cancel.
- Mandatory subtask fallback.

Deliverable: tasks can change lifecycle safely.

### Phase 5 — Report

- Report generator.
- Structured payload.
- Editable Markdown.
- Save/copy.
- Previous reports list.

Deliverable: end-of-day reporting works.

### Phase 6 — Settings

- Workday.
- Rest windows.
- Location.
- Projects/domains.
- Backup.
- PIN convenience lock.
- Supabase placeholder disabled.

Deliverable: app is configurable.

### Phase 7 — Backup

- Auto-save centralization.
- Periodic snapshots.
- Export JSON.
- Import JSON.
- Optional File System Access API backup.
- Save before closing.

Deliverable: data safety baseline.

### Phase 8 — QA / polish

- RTL polish.
- Empty states.
- Error handling.
- Smoke tests.
- Manual QA checklist.

Deliverable: MVP ready for one-week real use.

---

## 18. Future MVPs

### MVP 2

- Better recurring engine.
- Auto-add recurring tasks according to settings.
- Weekly summary.
- Stalled task detection.
- Search.
- Tags UI.
- CSV export.

### MVP 3

- Supabase Updates tab.
- Read-only lead pulls.
- Internal lead review status.
- Viewed/started/handled.
- Follow-up date.
- No writes to source website tables initially.

### MVP 4

- Analytics.
- Daily/weekly/monthly trends.
- Money/sales focus view.
- Weather/sunset/Shabbat time integrations.
- Notifications.
- Possible backend/Supabase sync.

---

## 19. Non-Negotiables

- Do not build a heavy SaaS.
- Do not suggest replacing this with Notion/Jira/Monday.
- Do not ignore RTL.
- Do not put secrets in client code.
- Do not use localStorage for core task data.
- Do not use array indexes as persistent IDs.
- Do not let started tasks disappear.
- Do not delete tasks silently.
- Do not treat computer shutdown as end-of-day.
- Do not implement Supabase in MVP 1 unless explicitly approved.

---

## 20. First Codex Prompt

Paste this into Codex as the first instruction:

```text
You are a product-minded senior full-stack developer building a local-first personal Mission Control dashboard for an entrepreneur. Read this entire spec before writing code. Do not build a SaaS, do not add multi-user auth, do not integrate Supabase in MVP 1, and do not over-engineer.

Build MVP 1 as a local React + TypeScript + Vite app with Hebrew RTL UI, Dexie/IndexedDB persistence, auto-save, JSON export/import backup, tabs for Today, In Progress, Quick Wins, Backlog, Weekly/Recurring, Report, and Settings.

The core workflow is task -> subtasks. Every task must have at least one subtask. Subtasks have Start and Done states. Task progress/status is derived from subtasks. In-progress tasks must never disappear between days. Backlog is both a full tab and a preview inside Today. Reports must include all tasks including recurring tasks.

Implement incrementally according to the phases in this spec. Start with project setup, Dexie schema, seed data, and the app shell. Preserve data safety above UI polish. Use stable IDs, not array indexes.
```

