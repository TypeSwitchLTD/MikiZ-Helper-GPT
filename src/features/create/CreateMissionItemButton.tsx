import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { AddSubtaskInput, CreateTaskInput } from '../../domain/tasks/taskMutations';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';
import { getSubtasksForTask } from '../../domain/tasks/taskSelectors';
import type {
  CreatePanel,
  DuplicateCandidate,
  ParsedReviewRow,
  ScheduleDraftState,
  SpeechInputLanguage,
  TaskDraftState,
} from './createTaskTypes';
import {
  buildReviewRowsForSingleParent,
  createContinuationTaskDraft,
  createEmptyScheduleDraft,
  createEmptyTaskDraft,
  defaultTagOptions,
  findDuplicateCandidate,
  getAutoEffortFromText,
  getAutoPriorityFromText,
  getDateFromHebrewText,
  getOpenTasks,
  getSpeechRecognitionCtor,
  groupKeyForNewTask,
  inferProjectDomainFromText,
  mergeSpeechIntoDraft,
  normalizeComparableText,
  parseIntakeText,
  scoreTaskMatch,
  suggestTagsFromText,
  type SpeechRecognitionLike,
} from './createTaskUtils';
import { DuplicateWarning } from './panels/DuplicateWarning';
import { IntakePanel } from './panels/IntakePanel';
import { ReviewPanel } from './panels/ReviewPanel';
import { SchedulePanel } from './panels/SchedulePanel';
import { SubtasksPanel } from './panels/SubtasksPanel';
import { TaskFormPanel } from './panels/TaskFormPanel';

interface CreateMissionItemButtonProps {
  settings: AppSettings | null;
  todayISO: string;
  isSaving?: boolean;
  existingTasks: Task[];
  existingSubtasks: Subtask[];
  onCreateTask: (input: CreateTaskInput) => Promise<void> | void;
  onAddSubtaskToTask: (input: AddSubtaskInput) => Promise<void> | void;
  onOpenReminder?: () => void;
}

const INTAKE_HISTORY_KEY = 'mission-control-intake-history';
const INTAKE_HISTORY_TTL_MS = 60 * 60 * 1000;
const INTAKE_HISTORY_LIMIT = 20;

interface IntakeHistoryEntry {
  text: string;
  savedAt: number;
}

function readIntakeHistory(): IntakeHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INTAKE_HISTORY_KEY) || '[]') as IntakeHistoryEntry[];
    const cutoff = Date.now() - INTAKE_HISTORY_TTL_MS;
    return parsed
      .filter((entry) => entry.text?.trim() && entry.savedAt >= cutoff)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, INTAKE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeIntakeHistory(entries: IntakeHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INTAKE_HISTORY_KEY, JSON.stringify(entries.slice(0, INTAKE_HISTORY_LIMIT)));
}

function saveIntakeHistoryEntry(text: string): void {
  const clean = text.trim();
  if (!clean) return;
  const current = readIntakeHistory().filter((entry) => entry.text.trim() !== clean);
  writeIntakeHistory([{ text: clean, savedAt: Date.now() }, ...current]);
}

export function CreateMissionItemButton({
  settings,
  todayISO,
  isSaving = false,
  existingTasks,
  existingSubtasks,
  onCreateTask,
  onAddSubtaskToTask,
  onOpenReminder,
}: CreateMissionItemButtonProps) {
  // ─── UI state ───────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<CreatePanel>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [taskDraft, setTaskDraft] = useState<TaskDraftState>(() => createEmptyTaskDraft(settings, todayISO));
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftState>(() => createEmptyScheduleDraft(settings, todayISO));
  const [reviewRows, setReviewRows] = useState<ParsedReviewRow[]>([]);
  const [duplicateCandidate, setDuplicateCandidate] = useState<DuplicateCandidate | null>(null);
  const [scheduleRowId, setScheduleRowId] = useState<string | null>(null);
  const [scheduleSubtaskIndex, setScheduleSubtaskIndex] = useState<number | null>(null);
  const [intakeHistoryIndex, setIntakeHistoryIndex] = useState(-1);

  // ─── Speech state ────────────────────────────────────────────────────────────
  const [speechInputLanguage, setSpeechInputLanguage] = useState<SpeechInputLanguage>('he-IL');
  const [isSpeechInputActive, setIsSpeechInputActive] = useState(false);
  const [speechInputStatus, setSpeechInputStatus] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseTextRef = useRef('');
  const speechFinalTextRef = useRef('');

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const activeProjects = useMemo(() => settings?.projects.filter((p) => p.isActive) ?? [], [settings]);
  const activeDomains = useMemo(() => settings?.domains.filter((d) => d.isActive) ?? [], [settings]);
  const tagOptions = useMemo(() => {
    const dynamic = [
      ...(settings?.projects.map((p) => p.id) ?? []),
      ...(settings?.domains.map((d) => d.id) ?? []),
    ];
    return Array.from(new Set([...defaultTagOptions, ...dynamic, 'quick-win', 'interruption', 'leads', 'jack', 'instantly']));
  }, [settings]);
  const suggestedTags = useMemo(() => suggestTagsFromText(taskDraft, settings), [taskDraft, settings]);

  // ─── Panel open / close ──────────────────────────────────────────────────────
  const openPanel = (panel: CreatePanel) => {
    setActivePanel(panel);
    setIsOpen(false);
    setStatusMessage('');
    setErrorMessage('');
    setDuplicateCandidate(null);
    setIntakeHistoryIndex(-1);
  };

  const closePanel = () => {
    setActivePanel(null);
    setTaskDraft(createEmptyTaskDraft(settings, todayISO));
    setScheduleDraft(createEmptyScheduleDraft(settings, todayISO));
    setStatusMessage('');
    setErrorMessage('');
    setDuplicateCandidate(null);
    setReviewRows([]);
    setIntakeHistoryIndex(-1);
  };

  // ─── Task draft handlers ─────────────────────────────────────────────────────
  const updateTaskDraft = <K extends keyof TaskDraftState>(key: K, value: TaskDraftState[K]) => {
    setTaskDraft((current) => ({ ...current, [key]: value }));
    setErrorMessage('');
    setDuplicateCandidate(null);
  };

  const updateRawIntake = (value: string) => {
    updateTaskDraft('rawIntake', value);
    setIntakeHistoryIndex(-1);
  };

  const handleRawIntakeKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'ArrowUp') return;
    const history = readIntakeHistory();
    if (!history.length) return;
    event.preventDefault();
    const nextIndex = Math.min(intakeHistoryIndex + 1, history.length - 1);
    const entry = history[nextIndex];
    if (!entry) return;
    setIntakeHistoryIndex(nextIndex);
    setTaskDraft((current) => ({ ...current, rawIntake: entry.text }));
    setStatusMessage(`שחזרתי טיוטה מלפני עד שעה (${nextIndex + 1}/${history.length}).`);
    setErrorMessage('');
  };

  const addSubtaskRow = () => updateTaskDraft('subtasks', [...taskDraft.subtasks, '']);

  const updateSubtaskRow = (index: number, value: string) => {
    updateTaskDraft('subtasks', taskDraft.subtasks.map((s, i) => (i === index ? value : s)));
  };

  const removeSubtaskRow = (index: number) => {
    const next = taskDraft.subtasks.filter((_, i) => i !== index);
    updateTaskDraft('subtasks', next.length > 0 ? next : ['']);
  };

  const handleSubtaskKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) { void saveTask({ keepOpen: false }); return; }
    const next = [...taskDraft.subtasks];
    next.splice(index + 1, 0, '');
    updateTaskDraft('subtasks', next);
  };

  const toggleTag = (tag: string) => {
    updateTaskDraft('tags', taskDraft.tags.includes(tag) ? taskDraft.tags.filter((t) => t !== tag) : [...taskDraft.tags, tag]);
  };

  // ─── Schedule draft handlers ─────────────────────────────────────────────────
  const updateScheduleDraft = <K extends keyof ScheduleDraftState>(key: K, value: ScheduleDraftState[K]) => {
    setScheduleDraft((current) => ({ ...current, [key]: value }));
    setErrorMessage('');
  };

  // ─── Speech ──────────────────────────────────────────────────────────────────
  const stopSpeechInput = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeechInputActive(false);
    setSpeechInputStatus('ההכתבה נעצרה.');
  };

  const startSpeechInput = () => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setSpeechInputStatus('הדפדפן לא תומך בהכתבה ישירה. במובייל אפשר להשתמש במיקרופון של מקלדת Google.');
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new RecognitionCtor();
    recognition.lang = speechInputLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    speechBaseTextRef.current = taskDraft.rawIntake;
    speechFinalTextRef.current = '';

    recognition.onresult = (event) => {
      let finalUpdate = '';
      let interimUpdate = '';
      const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;

      for (let i = startIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? '';
        if (!transcript) continue;
        if (result.isFinal) {
          finalUpdate = `${finalUpdate} ${transcript}`.trim();
        } else {
          interimUpdate = transcript;
        }
      }

      if (finalUpdate) {
        speechFinalTextRef.current = mergeSpeechIntoDraft(speechFinalTextRef.current, finalUpdate);
      }

      const spokenText = `${speechFinalTextRef.current} ${interimUpdate}`.trim();
      const nextText = mergeSpeechIntoDraft(speechBaseTextRef.current, spokenText);
      setTaskDraft((cur) => ({ ...cur, rawIntake: nextText }));
      setSpeechInputStatus('מקשיב ומכניס טקסט לתיבה...');
    };
    recognition.onerror = (event) => {
      const err = event.error ? ` (${event.error})` : '';
      setSpeechInputStatus(`ההכתבה נעצרה או נכשלה${err}. אפשר לנסות שוב.`);
      setIsSpeechInputActive(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsSpeechInputActive(false);
      recognitionRef.current = null;
      setSpeechInputStatus('ההכתבה הסתיימה. אפשר לערוך ידנית או ללחוץ סדר לי למשימות.');
    };

    try {
      recognition.start();
      setIsSpeechInputActive(true);
      setSpeechInputStatus('מקשיב... אפשר להגיד: רד שורה, פסקה חדשה, סעיף חדש, נקודותיים, אחד.');
    } catch (error) {
      setSpeechInputStatus(error instanceof Error ? error.message : 'לא הצלחתי להתחיל הכתבה.');
      setIsSpeechInputActive(false);
      recognitionRef.current = null;
    }
  };

  const toggleSpeechInput = () => (isSpeechInputActive ? stopSpeechInput() : startSpeechInput());

  // ─── Review row context inference ────────────────────────────────────────────
  const inferReviewRowContext = (row: ParsedReviewRow): ParsedReviewRow => {
    const targetTask = row.targetTaskId ? existingTasks.find((t) => t.id === row.targetTaskId) : null;
    const contextText = `${row.text} ${row.targetTitle} ${taskDraft.rawIntake}`;
    const inferred = inferProjectDomainFromText(contextText, taskDraft.projectId, taskDraft.domainId, settings);
    const rowSchedule = getDateFromHebrewText(`${row.text} ${row.label}`, todayISO);

    if (targetTask) {
      return {
        ...row,
        targetMode: 'existing_task',
        targetTitle: targetTask.title,
        projectId: targetTask.projectId,
        domainId: targetTask.domainId,
        bucket: targetTask.bucket,
        backlogGroup: targetTask.backlogGroup ?? null,
        priority: targetTask.priority,
        effort: targetTask.effort,
        tags: Array.from(new Set([
          ...(targetTask.tags ?? []),
          ...suggestTagsFromText({ ...taskDraft, title: row.text, subtasks: [row.text] }, settings),
        ])),
      };
    }

    const fakeDraft: TaskDraftState = {
      ...taskDraft,
      title: row.targetTitle || row.text,
      projectId: inferred.projectId,
      domainId: inferred.domainId,
      bucket: row.bucket ?? rowSchedule.bucket,
      backlogGroup: row.backlogGroup ?? rowSchedule.backlogGroup ?? taskDraft.backlogGroup,
      priority: getAutoPriorityFromText(contextText, taskDraft.priority),
      effort: getAutoEffortFromText(contextText, taskDraft.effort),
      subtasks: [row.text],
    };

    return {
      ...row,
      projectId: fakeDraft.projectId,
      domainId: fakeDraft.domainId,
      bucket: fakeDraft.bucket,
      backlogGroup: fakeDraft.bucket === 'backlog' ? fakeDraft.backlogGroup : null,
      priority: fakeDraft.priority,
      effort: fakeDraft.effort,
      tags: Array.from(new Set([...(row.tags ?? []), ...suggestTagsFromText(fakeDraft, settings)])).slice(0, 8),
    };
  };

  // ─── Intake parsing ──────────────────────────────────────────────────────────
  const fillDraftFromIntake = () => {
    const text = taskDraft.rawIntake.trim();
    if (!text) { setErrorMessage('כתוב או הדבק טקסט חופשי לפני שמסדרים טיוטה.'); return; }

    saveIntakeHistoryEntry(text);
    setIntakeHistoryIndex(-1);
    const parsed = parseIntakeText(text, todayISO, existingTasks, existingSubtasks);
    const parsedSchedule = getDateFromHebrewText(text, todayISO);
    const baseRows =
      parsed.reviewRows && parsed.reviewRows.length > 0
        ? parsed.reviewRows
        : buildReviewRowsForSingleParent(
            parsed.title,
            parsed.subtasks.length > 0 ? parsed.subtasks : [parsed.title],
            parsed.date,
            parsed.label,
          );
    const nextRows = baseRows.map((row) => inferReviewRowContext(row));

    setReviewRows(nextRows);
    setTaskDraft((cur) => ({
      ...cur,
      title: parsed.title,
      date: parsed.date,
      scheduledTimeLabel: parsed.label,
      bucket: parsedSchedule.bucket,
      backlogGroup: parsedSchedule.backlogGroup ?? cur.backlogGroup,
      subtasks: parsed.subtasks.length > 0 ? parsed.subtasks : [parsed.title],
      notes: '',
    }));
    setStatusMessage('סידרתי טיוטה חדשה. תעבור על השיוך לפני שמירה כדי שלא נאבד או נערבב משימות.');
    setErrorMessage('');
  };

  // ─── Save task (single) ──────────────────────────────────────────────────────
  const buildTaskInput = (): CreateTaskInput | null => {
    const title = taskDraft.title.trim();
    if (!title) { setErrorMessage('חובה לתת שם למשימת־על.'); return null; }

    const subtasks = taskDraft.subtasks.map((s) => s.trim()).filter(Boolean);
    const date = taskDraft.bucket === 'today' ? taskDraft.date || todayISO : taskDraft.date || null;
    const duration = Number(taskDraft.estimatedDurationMinutes);
    const isQuickWin = taskDraft.effort === 'quick' || (Number.isFinite(duration) && duration <= 10);
    const tags = Array.from(new Set([
      ...taskDraft.tags,
      ...(isQuickWin ? ['quick-win'] : []),
      ...(taskDraft.source === 'interruption' ? ['interruption'] : []),
    ]));

    return {
      title,
      projectId: taskDraft.projectId,
      domainId: taskDraft.domainId,
      bucket: taskDraft.bucket,
      date,
      originalDate: date,
      scheduledTimeLabel: taskDraft.scheduledTimeLabel || (taskDraft.bucket === 'today' ? 'היום' : 'לא מתוזמן'),
      estimatedDurationMinutes: Number.isFinite(duration) && duration > 0 ? duration : null,
      durationLabel: Number.isFinite(duration) && duration > 0 ? `${duration} דק׳` : undefined,
      priority: taskDraft.priority,
      effort: taskDraft.effort,
      isQuickWin,
      isRecurring: false,
      recurrenceDefinitionId: null,
      backlogGroup: taskDraft.bucket === 'backlog' ? taskDraft.backlogGroup : null,
      tags,
      whyNow: taskDraft.whyNow.trim() || undefined,
      notes: taskDraft.notes.trim() || undefined,
      statusOverride: null,
      movedToDate: null,
      completedAt: null,
      cancelledAt: null,
      source: taskDraft.source,
      subtasks: (subtasks.length > 0 ? subtasks : [title]).map((s) => ({
        title: s,
        domainId: taskDraft.domainId,
        estimatedDurationMinutes: null,
      })),
    };
  };

  const finishAfterCreate = ({ keepOpen, message }: { keepOpen: boolean; message: string }) => {
    if (keepOpen) {
      setTaskDraft((cur) => createContinuationTaskDraft(cur));
      setStatusMessage(message);
      setErrorMessage('');
      setDuplicateCandidate(null);
      return;
    }
    setTaskDraft(createEmptyTaskDraft(settings, todayISO));
    setStatusMessage(message);
    setDuplicateCandidate(null);
    closePanel();
  };

  const saveTask = async ({ keepOpen, forceCreate = false }: { keepOpen: boolean; forceCreate?: boolean }) => {
    const input = buildTaskInput();
    if (!input) return;
    if (!forceCreate) {
      const duplicate = findDuplicateCandidate(input, existingTasks, existingSubtasks);
      if (duplicate) {
        setDuplicateCandidate({ ...duplicate, input, keepOpen });
        setErrorMessage('מצאתי משימה דומה שכבר פתוחה. תבחר אם למזג או ליצור חדשה.');
        return;
      }
    }
    await onCreateTask(input);
    finishAfterCreate({ keepOpen, message: keepOpen ? 'המשימה נוספה. הטופס נשאר פתוח.' : 'המשימה נוספה ונשמרה מקומית.' });
  };

  const mergeDuplicateIntoExistingTask = async () => {
    if (!duplicateCandidate) return;
    const target = duplicateCandidate.task;
    const existingTargetSubtasks = getSubtasksForTask(target.id, existingSubtasks);
    const existingTitles = new Set(existingTargetSubtasks.map((s) => normalizeComparableText(s.title)));
    const source = duplicateCandidate.input.subtasks.length > 0
      ? duplicateCandidate.input.subtasks
      : [{ title: duplicateCandidate.input.title }];
    const toAdd = source.filter((s) => !existingTitles.has(normalizeComparableText(s.title)));

    if (toAdd.length === 0) {
      setDuplicateCandidate(null);
      setErrorMessage('כל תתי־המשימות כבר קיימות במשימה הזאת.');
      return;
    }

    for (const subtask of toAdd) {
      await onAddSubtaskToTask({
        taskId: target.id,
        title: subtask.title,
        domainId: duplicateCandidate.input.domainId,
        estimatedDurationMinutes: subtask.estimatedDurationMinutes ?? null,
        notes: `נוסף מהכנסת משימה ידנית: ${duplicateCandidate.input.title}`,
      });
    }
    finishAfterCreate({
      keepOpen: duplicateCandidate.keepOpen,
      message: `מיזגתי ${toAdd.length} תתי־משימות לתוך המשימה הקיימת.`,
    });
  };

  // ─── Review row handlers ─────────────────────────────────────────────────────
  const updateReviewRow = (rowId: string, patch: Partial<ParsedReviewRow>) => {
    setReviewRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        if (patch.targetTaskId) return inferReviewRowContext({ ...next, targetMode: 'existing_task', confidence: 'manual' });
        if (patch.targetMode === 'new_task') return inferReviewRowContext({ ...next, targetTaskId: null, targetTitle: next.targetTitle || next.text, confidence: 'manual' });
        return next;
      }),
    );
    setErrorMessage('');
  };

  const toggleReviewTag = (rowId: string, tag: string) => {
    setReviewRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        const tags = row.tags ?? [];
        return { ...row, tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag], confidence: 'manual' };
      }),
    );
    setErrorMessage('');
  };

  const getParentMatchesForRow = (row: ParsedReviewRow): Task[] =>
    getOpenTasks(existingTasks, existingSubtasks)
      .map((task) => ({ task, score: scoreTaskMatch((row.search || row.text).trim(), task, existingSubtasks) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title))
      .slice(0, 5)
      .map((m) => m.task);

  // ─── Save review rows ────────────────────────────────────────────────────────
  const saveReviewRows = async ({ keepOpen }: { keepOpen: boolean }) => {
    const rowsToSave = reviewRows
      .map((row) => {
        const text = row.text.trim();
        const targetTitle = (row.targetTitle || row.text).trim();
        const safeMode = row.targetMode === 'existing_task' && !row.targetTaskId ? 'new_task' : row.targetMode;
        return { ...row, text, targetTitle, targetMode: safeMode, targetTaskId: safeMode === 'new_task' ? null : row.targetTaskId };
      })
      .filter((row) => row.text);

    if (rowsToSave.length === 0) { setErrorMessage('אין שורות לשמירה.'); return; }

    let createdCount = 0;
    let mergedCount = 0;

    for (const row of rowsToSave.filter((r) => r.targetMode === 'existing_task' && r.targetTaskId)) {
      if (!row.targetTaskId) continue;
      const existingTargetSubtasks = getSubtasksForTask(row.targetTaskId, existingSubtasks);
      const exists = existingTargetSubtasks.some((s) => normalizeComparableText(s.title) === normalizeComparableText(row.text));
      if (!exists) {
        await onAddSubtaskToTask({
          taskId: row.targetTaskId,
          title: row.text,
          domainId: row.domainId ?? existingTasks.find((t) => t.id === row.targetTaskId)?.domainId ?? taskDraft.domainId,
          notes: `נוסף מבדיקת טיוטה: ${taskDraft.rawIntake.trim().slice(0, 180)}`,
        });
        mergedCount += 1;
      }
    }

    const groupedNewRows = new Map<string, typeof rowsToSave>();
    rowsToSave.filter((r) => r.targetMode === 'new_task').forEach((row) => {
      const key = groupKeyForNewTask(row);
      groupedNewRows.set(key, [...(groupedNewRows.get(key) ?? []), row]);
    });

    for (const groupRows of groupedNewRows.values()) {
      const firstRow = groupRows[0];
      if (!firstRow) continue;
      const groupTitle = (firstRow.targetTitle || firstRow.text).replace(/^משימה חדשה:\s*/i, '').trim() || firstRow.text;
      const groupSchedule = getDateFromHebrewText(`${groupTitle} ${groupRows.map((r) => r.label).join(' ')}`, todayISO);
      const duration = Number(taskDraft.estimatedDurationMinutes);
      const subtasksForGroup = groupRows.map((r) => r.text).filter(Boolean);
      const bucket = firstRow.bucket ?? groupSchedule.bucket;
      const date = firstRow.date || groupSchedule.date;
      const effort = firstRow.effort ?? taskDraft.effort;
      const rowTags = groupRows.flatMap((r) => r.tags ?? []);
      const autoTags = suggestTagsFromText({
        ...taskDraft,
        title: groupTitle,
        projectId: firstRow.projectId ?? taskDraft.projectId,
        domainId: firstRow.domainId ?? taskDraft.domainId,
        bucket, effort, subtasks: subtasksForGroup,
      }, settings);

      const candidateInput: CreateTaskInput = {
        title: groupTitle,
        projectId: firstRow.projectId ?? taskDraft.projectId,
        domainId: firstRow.domainId ?? taskDraft.domainId,
        bucket, date, originalDate: date,
        scheduledTimeLabel: firstRow.label || groupSchedule.label,
        estimatedDurationMinutes: Number.isFinite(duration) && duration > 0 ? duration : null,
        durationLabel: Number.isFinite(duration) && duration > 0 ? `${duration} דק׳` : undefined,
        priority: firstRow.priority ?? taskDraft.priority,
        effort,
        isQuickWin: effort === 'quick' || (Number.isFinite(duration) && duration <= 10),
        isRecurring: false, recurrenceDefinitionId: null,
        backlogGroup: bucket === 'backlog' ? firstRow.backlogGroup ?? groupSchedule.backlogGroup ?? 'this_week' : null,
        tags: Array.from(new Set([...taskDraft.tags, ...rowTags, ...autoTags, ...(effort === 'quick' ? ['quick-win'] : [])])),
        whyNow: taskDraft.whyNow.trim() || undefined,
        notes: `נוצר מבדיקת טיוטה. מקור: ${taskDraft.rawIntake.trim()}`,
        statusOverride: null, movedToDate: null, completedAt: null, cancelledAt: null,
        source: taskDraft.source,
        subtasks: (subtasksForGroup.length > 0 ? subtasksForGroup : [groupTitle]).map((s) => ({
          title: s, domainId: firstRow.domainId ?? taskDraft.domainId, estimatedDurationMinutes: null,
        })),
      };

      const duplicate = findDuplicateCandidate(candidateInput, existingTasks, existingSubtasks);
      if (duplicate) {
        const existingTargetSubtasks = getSubtasksForTask(duplicate.task.id, existingSubtasks);
        const existingTitles = new Set(existingTargetSubtasks.map((s) => normalizeComparableText(s.title)));
        for (const subtask of candidateInput.subtasks.filter((s) => !existingTitles.has(normalizeComparableText(s.title)))) {
          await onAddSubtaskToTask({ taskId: duplicate.task.id, title: subtask.title, domainId: candidateInput.domainId, notes: `מוזג אוטומטית: ${candidateInput.title}` });
          mergedCount += 1;
        }
        continue;
      }

      await onCreateTask(candidateInput);
      createdCount += 1;
    }

    setReviewRows([]);
    setDuplicateCandidate(null);
    if (keepOpen) {
      setTaskDraft((cur) => createContinuationTaskDraft(cur));
      setStatusMessage(`שמרתי ${createdCount} משימות חדשות ומיזגתי ${mergedCount} תתי־משימות. אפשר להמשיך.`);
      setErrorMessage('');
      return;
    }
    setTaskDraft(createEmptyTaskDraft(settings, todayISO));
    setStatusMessage(`שמרתי ${createdCount} משימות חדשות ומיזגתי ${mergedCount} תתי־משימות.`);
    closePanel();
  };

  // ─── Save schedule ───────────────────────────────────────────────────────────
  const saveSchedule = async () => {
    const title = scheduleDraft.title.trim();
    if (!title) { setErrorMessage('חובה לתת כותרת ללו״ז.'); return; }
    const date = scheduleDraft.date || todayISO;
    await onCreateTask({
      title: `לו״ז: ${title}`,
      projectId: scheduleDraft.projectId,
      domainId: scheduleDraft.domainId,
      bucket: date === todayISO ? 'today' : 'backlog',
      date, originalDate: date,
      scheduledTimeLabel: `${date} ${scheduleDraft.startTime}–${scheduleDraft.endTime}`,
      estimatedDurationMinutes: null,
      durationLabel: `${scheduleDraft.startTime}–${scheduleDraft.endTime}`,
      priority: 'medium', effort: 'medium', isQuickWin: false, isRecurring: false, recurrenceDefinitionId: null,
      backlogGroup: date === todayISO ? null : 'this_week',
      tags: ['schedule'],
      whyNow: 'פריט לו״ז מקומי. חיבור Google Calendar יגיע בשלב מאוחר יותר.',
      notes: [scheduleDraft.location ? `מיקום: ${scheduleDraft.location}` : '', scheduleDraft.notes].filter(Boolean).join('\n') || undefined,
      statusOverride: null, movedToDate: null, completedAt: null, cancelledAt: null, source: 'manual',
      subtasks: [{ title: `להגיע / לבצע: ${title}`, domainId: scheduleDraft.domainId, estimatedDurationMinutes: null, toolsNeeded: scheduleDraft.location || undefined }],
    });
    setScheduleDraft(createEmptyScheduleDraft(settings, todayISO));
    setStatusMessage('פריט הלו״ז נוסף כמשימה מקומית.');
    closePanel();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const isReviewMode = reviewRows.length > 0;
  const primarySave = () =>
    isReviewMode ? void saveReviewRows({ keepOpen: false }) : void saveTask({ keepOpen: false });
  const secondarySave = () =>
    isReviewMode ? void saveReviewRows({ keepOpen: true }) : void saveTask({ keepOpen: true });

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-6 z-40">
        {isOpen ? (
          <div className="absolute bottom-[4.5rem] left-0 flex w-max flex-col gap-2 rounded-3xl bg-white/96 p-3 text-sm font-black shadow-2xl ring-1 ring-slate-200 backdrop-blur">
            <button type="button"
              className="rounded-2xl bg-sky-500 px-4 py-2.5 text-white hover:bg-sky-600 transition text-right"
              onClick={() => openPanel('task')}>
              ✦ הכנסת משימה
            </button>
            <button type="button"
              className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-white hover:bg-emerald-600 transition text-right"
              onClick={() => openPanel('schedule')}>
              תזמון / לו״ז
            </button>
            {onOpenReminder ? (
              <button type="button"
                className="rounded-2xl bg-amber-400 px-4 py-2.5 text-slate-900 hover:bg-amber-500 transition text-right font-black"
                onClick={() => { setIsOpen(false); onOpenReminder(); }}>
                תזכורת מהירה
              </button>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="grid h-15 w-15 h-[3.75rem] w-[3.75rem] place-items-center rounded-full bg-slate-950 text-white shadow-2xl ring-2 ring-white transition hover:scale-105 hover:bg-slate-800"
          onClick={() => setIsOpen((cur) => !cur)}
          aria-label="תפריט הוספה"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-7 w-7 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* ── Modal / Bottom-sheet ─────────────────────────────────────── */}
      {activePanel ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/40 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatusMessage('הטיוטה נשארה פתוחה. כדי לסגור לחץ X או ביטול.');
          }}
        >
          <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl ring-1 ring-slate-200 sm:mx-auto sm:max-w-3xl sm:rounded-[2rem]">

            {/* ── Sticky header ─────────────────────────────────────── */}
            <header className={`shrink-0 flex items-center justify-between gap-3 px-5 py-4 ${
              activePanel === 'task'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
            }`}>
              <div>
                <p className="text-[11px] font-black text-white/60 uppercase tracking-widest">
                  {isReviewMode ? `שלב 2 — review` : 'שלב 1 — הכנסה'}
                </p>
                <h2 className="text-xl font-black text-white leading-tight">
                  {activePanel === 'task'
                    ? (isReviewMode ? `${reviewRows.length} פריטים ממתינים לאישור` : 'משימה חדשה')
                    : 'הוספת לו״ז'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="grid h-9 w-9 place-items-center rounded-2xl bg-white/20 text-lg font-black text-white hover:bg-white/30 transition"
                aria-label="סגור"
              >
                ×
              </button>
            </header>

            {/* ── Scrollable content ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 sm:px-4 sm:py-5 sm:space-y-5">

              {/* ─── Task panel ─────────────────────────────────────── */}
              {activePanel === 'task' ? (
                <>
                  <IntakePanel
                    rawIntake={taskDraft.rawIntake}
                    onRawIntakeChange={updateRawIntake}
                    onRawIntakeKeyDown={handleRawIntakeKeyDown}
                    isSpeechInputActive={isSpeechInputActive}
                    speechInputStatus={speechInputStatus}
                    speechInputLanguage={speechInputLanguage}
                    onToggleSpeech={toggleSpeechInput}
                    onSpeechLanguageChange={setSpeechInputLanguage}
                    onFillFromIntake={fillDraftFromIntake}
                  />

                  {!isReviewMode ? (
                    <TaskFormPanel
                      taskDraft={taskDraft}
                      updateTaskDraft={updateTaskDraft}
                      activeProjects={activeProjects}
                      activeDomains={activeDomains}
                      tagOptions={tagOptions}
                      suggestedTags={suggestedTags}
                      onToggleTag={toggleTag}
                    />
                  ) : null}

                  {isReviewMode ? (
                    <ReviewPanel
                      reviewRows={reviewRows}
                      taskDraft={taskDraft}
                      activeProjects={activeProjects}
                      activeDomains={activeDomains}
                      tagOptions={tagOptions}
                      scheduleRowId={scheduleRowId}
                      isSaving={isSaving}
                      getParentMatches={getParentMatchesForRow}
                      getProjectName={(row) =>
                        activeProjects.find((p) => p.id === (row.projectId ?? taskDraft.projectId))?.name ??
                        row.projectId ?? taskDraft.projectId
                      }
                      getDomainName={(row) =>
                        activeDomains.find((d) => d.id === (row.domainId ?? taskDraft.domainId))?.name ??
                        row.domainId ?? taskDraft.domainId
                      }
                      onUpdateRow={updateReviewRow}
                      onToggleTag={toggleReviewTag}
                      onSetScheduleRowId={setScheduleRowId}
                      onSaveAll={() => void saveReviewRows({ keepOpen: false })}
                      onBackToManual={() => setReviewRows([])}
                    />
                  ) : null}

                  {!isReviewMode ? (
                    <SubtasksPanel
                      subtasks={taskDraft.subtasks}
                      date={taskDraft.date}
                      scheduledTimeLabel={taskDraft.scheduledTimeLabel}
                      scheduleSubtaskIndex={scheduleSubtaskIndex}
                      onAddRow={addSubtaskRow}
                      onUpdateRow={updateSubtaskRow}
                      onRemoveRow={removeSubtaskRow}
                      onKeyDown={handleSubtaskKeyDown}
                      onToggleSchedule={(i) => setScheduleSubtaskIndex((cur) => (cur === i ? null : i))}
                      onDateChange={(v) => updateTaskDraft('date', v)}
                      onTimeLabelChange={(v) => updateTaskDraft('scheduledTimeLabel', v)}
                      onSaveSchedule={() => {
                        setScheduleSubtaskIndex(null);
                        setStatusMessage('התזמון נשמר למשימה הזו.');
                      }}
                    />
                  ) : null}

                  {duplicateCandidate ? (
                    <DuplicateWarning
                      candidate={duplicateCandidate}
                      isSaving={isSaving}
                      onMerge={() => void mergeDuplicateIntoExistingTask()}
                      onForceCreate={() =>
                        void saveTask({ keepOpen: duplicateCandidate.keepOpen, forceCreate: true })
                      }
                      onCancel={() => setDuplicateCandidate(null)}
                    />
                  ) : null}

                  {/* Status / error inline */}
                  {(errorMessage || statusMessage) ? (
                    <div className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                      errorMessage
                        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                    }`}>
                      <span>{errorMessage ? '⚠' : '✓'}</span>
                      <span>{errorMessage || statusMessage}</span>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* ─── Schedule panel ──────────────────────────────────── */}
              {activePanel === 'schedule' ? (
                <SchedulePanel
                  scheduleDraft={scheduleDraft}
                  updateScheduleDraft={updateScheduleDraft}
                  activeProjects={activeProjects}
                  activeDomains={activeDomains}
                  errorMessage={errorMessage}
                  statusMessage={statusMessage}
                  isSaving={isSaving}
                  onSave={() => void saveSchedule()}
                  onCancel={closePanel}
                  onReset={() => setScheduleDraft(createEmptyScheduleDraft(settings, todayISO))}
                />
              ) : null}
            </div>

            {/* ── Sticky footer (task panel only) ───────────────────── */}
            {activePanel === 'task' ? (
              <footer
                className="shrink-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                {/* Left: cancel + reset */}
                <div className="flex items-center justify-between gap-2 sm:justify-start">
                  <button
                    type="button"
                    className="rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 transition"
                    onClick={closePanel}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition"
                    onClick={() => setTaskDraft(createEmptyTaskDraft(settings, todayISO))}
                    title="נקה טופס"
                  >
                    נקה
                  </button>
                </div>

                {/* Right: secondary + primary CTA */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <button
                    type="button"
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition disabled:opacity-40 sm:py-2.5"
                    onClick={secondarySave}
                    disabled={isSaving}
                  >
                    הוסף והמשך
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 sm:py-2.5"
                    onClick={primarySave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'שומר...' : isReviewMode ? `✓ שמור ${reviewRows.length}` : '✓ הוסף'}
                  </button>
                </div>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
