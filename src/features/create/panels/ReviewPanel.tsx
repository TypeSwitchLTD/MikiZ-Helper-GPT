import { useState } from 'react';
import type { AppSettings } from '../../../domain/settings/settingsTypes';
import type { Task } from '../../../domain/tasks/taskTypes';
import type { ParsedReviewRow, TaskDraftState } from '../createTaskTypes';
import {
  backlogOptions,
  bucketOptions,
  effortOptions,
  getChoiceClass,
  getDomainOptionClass,
  getProjectOptionClass,
  normalizeComparableText,
  priorityOptions,
} from '../createTaskUtils';
import { compactSectionTitle } from '../createTaskHelpers';

interface ReviewPanelProps {
  reviewRows: ParsedReviewRow[];
  taskDraft: TaskDraftState;
  activeProjects: NonNullable<AppSettings['projects']>;
  activeDomains: NonNullable<AppSettings['domains']>;
  tagOptions: string[];
  scheduleRowId: string | null;
  isSaving: boolean;
  getParentMatches: (row: ParsedReviewRow) => Task[];
  getProjectName: (row: ParsedReviewRow) => string;
  getDomainName: (row: ParsedReviewRow) => string;
  onUpdateRow: (rowId: string, patch: Partial<ParsedReviewRow>) => void;
  onToggleTag: (rowId: string, tag: string) => void;
  onSetScheduleRowId: (id: string | null) => void;
  onSaveAll: () => void;
  onBackToManual: () => void;
}

export function ReviewPanel({
  reviewRows,
  taskDraft,
  activeProjects,
  activeDomains,
  tagOptions,
  scheduleRowId,
  isSaving,
  getParentMatches,
  getProjectName,
  getDomainName,
  onUpdateRow,
  onToggleTag,
  onSetScheduleRowId,
  onSaveAll,
  onBackToManual,
}: ReviewPanelProps) {
  /** Which rows have their details section expanded */
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const toggleDetails = (id: string) =>
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const sharedParent =
    reviewRows.length > 0 &&
    reviewRows.every(
      (row) =>
        row.targetMode === 'new_task' &&
        normalizeComparableText(row.targetTitle) === normalizeComparableText(reviewRows[0]?.targetTitle ?? ''),
    );

  return (
    <section className="space-y-4">
      {/* ── Panel header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            {reviewRows.length === 1 ? 'זוהה פריט אחד' : `זוהו ${reviewRows.length} פריטים`} — תבדוק לפני שמירה
          </h3>
          <p className="mt-0.5 text-xs font-bold text-slate-400">
            לכל פריט: האם זו משימה חדשה, או תת־משימה של קיימת?
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-200"
          onClick={onBackToManual}
        >
          עריכה ידנית
        </button>
      </div>

      {/* ── Shared parent banner ────────────────────────────────────── */}
      {sharedParent ? (
        <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 ring-1 ring-indigo-100">
          <span className="text-sm">🗂</span>
          <p className="text-sm font-bold text-indigo-900">
            משימת־על משותפת: <span className="font-black">{reviewRows[0]?.targetTitle}</span>
          </p>
        </div>
      ) : null}

      {/* ── Rows ──────────────────────────────────────────────────── */}
      <div className="grid gap-3">
        {reviewRows.map((row, index) => {
          const matches = getParentMatches(row);
          const rowBucket = row.bucket ?? taskDraft.bucket;
          const rowBacklogGroup = row.backlogGroup ?? taskDraft.backlogGroup;
          const rowPriority = row.priority ?? taskDraft.priority;
          const rowEffort = row.effort ?? taskDraft.effort;
          const rowTags = row.tags ?? [];
          const detailsOpen = expandedDetails.has(row.id);
          const scheduleOpen = scheduleRowId === row.id;

          return (
            <div
              key={row.id}
              className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm"
            >
              {/* ── Row top bar ─────────────────────────────────── */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                {/* Number */}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-slate-950 text-[11px] font-black text-white">
                  {index + 1}
                </span>

                {/* Confidence */}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    row.confidence === 'auto'
                      ? 'bg-emerald-50 text-emerald-700'
                      : row.confidence === 'manual'
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {row.confidence === 'auto' ? 'אוטו' : row.confidence === 'manual' ? 'ידני' : 'חדש'}
                </span>

                {/* Project/domain */}
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-400">
                  {getProjectName(row)} / {getDomainName(row)}
                </span>

                {/* Date chip — click to open schedule */}
                <button
                  type="button"
                  onClick={() => onSetScheduleRowId(scheduleOpen ? null : row.id)}
                  className={`shrink-0 rounded-xl px-2 py-1 text-[10px] font-black transition ${
                    scheduleOpen
                      ? 'bg-sky-500 text-white'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                  }`}
                >
                  📅 {row.label || row.date}
                </button>
              </div>

              <div className="px-3 py-3 space-y-3">
                {/* ── Detected text ──────────────────────────────── */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1">מה זוהה</label>
                  <textarea
                    rows={1}
                    className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-sky-400 transition min-h-[38px]"
                    value={row.text}
                    onChange={(e) => onUpdateRow(row.id, { text: e.target.value, confidence: 'manual' })}
                  />
                </div>

                {/* ── Inline schedule ─────────────────────────────── */}
                {scheduleOpen ? (
                  <div className="grid gap-2 rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100 sm:grid-cols-3">
                    <label className="field-compact">
                      <span>תאריך ביצוע</span>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => onUpdateRow(row.id, { date: e.target.value, confidence: 'manual' })}
                      />
                    </label>
                    <label className="field-compact">
                      <span>תווית / שעה</span>
                      <input
                        value={row.label}
                        onChange={(e) => onUpdateRow(row.id, { label: e.target.value, confidence: 'manual' })}
                        placeholder="היום / מחר / 13:30"
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button type="button"
                        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-100 hover:bg-sky-50"
                        onClick={() => onUpdateRow(row.id, { label: 'תזכורת', confidence: 'manual' })}>
                        תזכורת
                      </button>
                      <button type="button"
                        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                        onClick={() => onSetScheduleRowId(null)}>
                        סגור
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* ── Assignment mode ─────────────────────────────── */}
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100 space-y-2.5">
                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                        row.targetMode === 'new_task'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50'
                      }`}
                      onClick={() =>
                        onUpdateRow(row.id, {
                          targetMode: 'new_task',
                          targetTaskId: null,
                          targetTitle: row.targetTitle || row.text,
                          confidence: 'manual',
                        })
                      }
                    >
                      ✦ משימה חדשה
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                        row.targetMode === 'existing_task'
                          ? 'bg-violet-500 text-white shadow-sm'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-violet-50'
                      }`}
                      onClick={() => {
                        if (row.targetMode !== 'existing_task') {
                          onUpdateRow(row.id, { targetMode: 'existing_task', confidence: 'manual' });
                        }
                      }}
                    >
                      שייך לקיימת
                    </button>
                  </div>

                  {/* New task: editable parent title */}
                  {row.targetMode === 'new_task' ? (
                    <label className="field-compact">
                      <span>שם משימת־על</span>
                      <input
                        value={row.targetTitle}
                        onChange={(e) => onUpdateRow(row.id, { targetTitle: e.target.value, confidence: 'manual' })}
                        placeholder="שם משימת־על"
                      />
                    </label>
                  ) : null}

                  {/* Existing task selected */}
                  {row.targetMode === 'existing_task' && row.targetTitle ? (
                    <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 ring-1 ring-violet-100">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                      <span className="min-w-0 flex-1 truncate text-xs font-black text-violet-900">{row.targetTitle}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                        onClick={() => onUpdateRow(row.id, { targetMode: 'new_task', targetTaskId: null, confidence: 'manual' })}
                      >
                        שנה
                      </button>
                    </div>
                  ) : null}

                  {/* Search + matches (shown when in existing_task mode or when search has text) */}
                  {(row.targetMode === 'existing_task' || row.search) ? (
                    <div>
                      <input
                        className="w-full rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-violet-400 transition"
                        value={row.search}
                        onChange={(e) => onUpdateRow(row.id, { search: e.target.value })}
                        placeholder="חפש משימה קיימת — 1–2 מילים"
                      />
                      {matches.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {matches.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black ring-1 transition ${
                                row.targetTaskId === task.id
                                  ? 'bg-violet-500 text-white ring-violet-500'
                                  : 'bg-white text-violet-800 ring-violet-100 hover:bg-violet-50'
                              }`}
                              onClick={() =>
                                onUpdateRow(row.id, {
                                  targetMode: 'existing_task',
                                  targetTaskId: task.id,
                                  targetTitle: task.title,
                                  confidence: 'manual',
                                })
                              }
                            >
                              {task.title}
                            </button>
                          ))}
                        </div>
                      ) : row.search.trim() ? (
                        <p className="mt-2 text-[11px] font-bold text-slate-400">לא נמצאו תוצאות לחיפוש הזה.</p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Quick-tag fallback when no matches in new_task mode */}
                  {row.targetMode === 'new_task' && !row.search && rowTags.length === 0 ? (
                    <div>
                      <p className="mb-1.5 text-[10px] font-black text-slate-400">חפש משימה קיימת</p>
                      <input
                        className="w-full rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-sky-400 transition"
                        value={row.search}
                        onChange={(e) => onUpdateRow(row.id, { search: e.target.value })}
                        placeholder="חפש 1–2 מילים לבדוק כפילויות"
                      />
                    </div>
                  ) : null}
                </div>

                {/* ── Details toggle ──────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => toggleDetails(row.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100 transition"
                >
                  <span>⚙ עדיפות / מאמץ / פרויקט / תגיות</span>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={detailsOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                  </svg>
                </button>

                {/* ── Expanded details ────────────────────────────── */}
                {detailsOpen ? (
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100 space-y-3">
                    {/* Bucket + priority + effort */}
                    <div>
                      {compactSectionTitle('מיקום / עדיפות / מאמץ')}
                      <div className="flex flex-wrap gap-1.5">
                        {bucketOptions.map((opt) => (
                          <button key={opt.value} type="button"
                            className={getChoiceClass(rowBucket === opt.value, opt.className)}
                            onClick={() => onUpdateRow(row.id, { bucket: opt.value, backlogGroup: opt.value === 'backlog' ? rowBacklogGroup : null, confidence: 'manual' })}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {priorityOptions.map((opt) => (
                          <button key={opt.value} type="button"
                            className={getChoiceClass(rowPriority === opt.value, opt.className)}
                            onClick={() => onUpdateRow(row.id, { priority: opt.value, confidence: 'manual' })}>
                            {opt.label}
                          </button>
                        ))}
                        {effortOptions.map((opt) => (
                          <button key={opt.value} type="button"
                            className={getChoiceClass(rowEffort === opt.value, opt.className)}
                            onClick={() => onUpdateRow(row.id, { effort: opt.value, confidence: 'manual' })}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {rowBucket === 'backlog' ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {backlogOptions.map((opt) => (
                            <button key={opt.value} type="button"
                              className={getChoiceClass(rowBacklogGroup === opt.value, opt.className)}
                              onClick={() => onUpdateRow(row.id, { backlogGroup: opt.value, confidence: 'manual' })}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* Project / domain */}
                    {row.targetMode === 'new_task' ? (
                      <div>
                        {compactSectionTitle('פרויקט / תחום')}
                        <div className="flex flex-wrap gap-1.5">
                          {activeProjects.slice(0, 8).map((project, pi) => (
                            <button key={project.id} type="button"
                              className={getChoiceClass((row.projectId ?? taskDraft.projectId) === project.id, getProjectOptionClass(pi))}
                              onClick={() => onUpdateRow(row.id, { projectId: project.id, confidence: 'manual' })}>
                              {project.name}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {activeDomains.slice(0, 10).map((domain, di) => (
                            <button key={domain.id} type="button"
                              className={getChoiceClass((row.domainId ?? taskDraft.domainId) === domain.id, getDomainOptionClass(di))}
                              onClick={() => onUpdateRow(row.id, { domainId: domain.id, confidence: 'manual' })}>
                              {domain.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Tags */}
                    <div>
                      {compactSectionTitle('תגיות')}
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Set([...rowTags, ...tagOptions])].slice(0, 14).map((tag, ti) => (
                          <button key={tag} type="button"
                            className={getChoiceClass(rowTags.includes(tag), getDomainOptionClass(ti))}
                            onClick={() => onToggleTag(row.id, tag)}>
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom save button (for long lists) ────────────────────── */}
      {reviewRows.length > 2 ? (
        <button
          type="button"
          className="w-full rounded-2xl bg-slate-950 py-3.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-40"
          onClick={onSaveAll}
          disabled={isSaving}
        >
          {isSaving ? 'שומר...' : `✓ שמור ${reviewRows.length} פריטים`}
        </button>
      ) : null}
    </section>
  );
}
