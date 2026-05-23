const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
});

const cleanEnv = (env, name) => {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

const requireConfig = (env) => {
  const supabaseUrl = cleanEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = cleanEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const token = cleanEnv(env, 'MORNING_BRIEFING_TOKEN');
  const workspaceId = cleanEnv(env, 'MISSION_CONTROL_WORKSPACE_ID') || 'miki';
  if (!supabaseUrl || !serviceKey || !token) {
    return { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MORNING_BRIEFING_TOKEN' };
  }
  return { ok: true, supabaseUrl, serviceKey, token, workspaceId };
};

const verifyToken = (expected, received) => Boolean(received && expected && received === expected);

const supabaseHeaders = (serviceKey, prefer = 'return=minimal,resolution=merge-duplicates') => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: prefer,
});

const isoOrNull = (value) => {
  if (!value) return null;
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : null;
};

const dateTimeOrNull = (value) => value ? String(value) : null;
const arr = (value) => Array.isArray(value) ? value : [];

async function restFetch(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Supabase request failed: ${response.status}`);
  }
  return body;
}

async function upsertRows(config, table, rows, conflict = 'id') {
  if (!rows.length) return 0;
  await restFetch(config, `${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: supabaseHeaders(config.serviceKey),
    body: JSON.stringify(rows),
  });
  return rows.length;
}

function mapTask(task, workspaceId) {
  return {
    id: task.id,
    workspace_id: workspaceId,
    title: task.title || '',
    project_id: task.projectId || null,
    domain_id: task.domainId || null,
    bucket: task.bucket || null,
    task_date: isoOrNull(task.date),
    original_date: isoOrNull(task.originalDate),
    scheduled_time_label: task.scheduledTimeLabel || null,
    estimated_duration_minutes: task.estimatedDurationMinutes ?? null,
    duration_label: task.durationLabel || null,
    priority: task.priority || null,
    effort: task.effort || null,
    is_quick_win: Boolean(task.isQuickWin),
    is_recurring: Boolean(task.isRecurring),
    recurrence_definition_id: task.recurrenceDefinitionId || null,
    backlog_group: task.backlogGroup || null,
    tags: arr(task.tags),
    why_now: task.whyNow || null,
    notes: task.notes || null,
    status_override: task.statusOverride || null,
    moved_count: Number(task.movedCount || 0),
    moved_to_date: isoOrNull(task.movedToDate),
    focus_order: task.focusOrder ?? null,
    focus_updated_at: dateTimeOrNull(task.focusUpdatedAt),
    source: task.source || null,
    completed_at: dateTimeOrNull(task.completedAt),
    cancelled_at: dateTimeOrNull(task.cancelledAt),
    raw: task,
    created_at: task.createdAt || new Date().toISOString(),
    updated_at: task.updatedAt || new Date().toISOString(),
  };
}

function mapSubtask(subtask, workspaceId) {
  return {
    id: subtask.id,
    workspace_id: workspaceId,
    task_id: subtask.taskId,
    title: subtask.title || '',
    domain_id: subtask.domainId || null,
    estimated_duration_minutes: subtask.estimatedDurationMinutes ?? null,
    duration_label: subtask.durationLabel || null,
    tools_needed: subtask.toolsNeeded || null,
    notes: subtask.notes || null,
    status: subtask.status || 'not_started',
    sort_order: Number(subtask.sortOrder || 0),
    started_at: dateTimeOrNull(subtask.startedAt),
    completed_at: dateTimeOrNull(subtask.completedAt),
    cancelled_at: dateTimeOrNull(subtask.cancelledAt),
    raw: subtask,
    created_at: subtask.createdAt || new Date().toISOString(),
    updated_at: subtask.updatedAt || new Date().toISOString(),
  };
}

function mapReminder(reminder, workspaceId) {
  return {
    id: reminder.id,
    workspace_id: workspaceId,
    task_id: reminder.taskId || null,
    subtask_id: reminder.subtaskId || null,
    title: reminder.title || '',
    note: reminder.note || null,
    remind_at: reminder.remindAt || new Date().toISOString(),
    status: reminder.status || 'pending',
    raw: reminder,
    created_at: reminder.createdAt || new Date().toISOString(),
    updated_at: reminder.updatedAt || new Date().toISOString(),
  };
}

function mapDailyPlan(plan, workspaceId) {
  return {
    id: plan.id,
    workspace_id: workspaceId,
    plan_date: isoOrNull(plan.date) || new Date().toISOString().slice(0, 10),
    focus_note: plan.focusNote || null,
    planned_task_ids: arr(plan.plannedTaskIds),
    blocks: arr(plan.blocks),
    raw: plan,
    created_at: plan.createdAt || new Date().toISOString(),
    updated_at: plan.updatedAt || new Date().toISOString(),
  };
}

function mapSimpleRaw(item, workspaceId) {
  return {
    id: item.id,
    workspace_id: workspaceId,
    raw: item,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  };
}

function mapRecurringDefinition(item, workspaceId) {
  return {
    ...mapSimpleRaw(item, workspaceId),
    is_active: item.isActive ?? true,
    frequency: item.frequency || null,
    project_id: item.projectId || null,
    domain_id: item.domainId || null,
  };
}

function mapDailyReport(item, workspaceId) {
  return {
    ...mapSimpleRaw(item, workspaceId),
    report_date: isoOrNull(item.date),
    generated_at: dateTimeOrNull(item.generatedAt),
  };
}

function mapLog(log, workspaceId) {
  return {
    id: log.id,
    workspace_id: workspaceId,
    event_timestamp: log.timestamp || new Date().toISOString(),
    type: log.type || 'note_added',
    entity_type: log.entityType || null,
    entity_id: log.entityId || null,
    message: log.message || null,
    metadata: log.metadata || {},
    raw: log,
    created_at: log.timestamp || new Date().toISOString(),
  };
}

async function getRawRows(config, table, order = 'updated_at.desc') {
  const rows = await restFetch(config, `${table}?workspace_id=eq.${encodeURIComponent(config.workspaceId)}&select=raw&order=${order}`, {
    headers: supabaseHeaders(config.serviceKey),
  });
  return arr(rows).map((row) => row.raw).filter(Boolean);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const config = requireConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!verifyToken(config.token, token)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const [tasks, subtasks, dailyPlans, recurringDefinitions, reports, logs, reminders, settingsRows] = await Promise.all([
      getRawRows(config, 'tasks'),
      getRawRows(config, 'subtasks', 'sort_order.asc'),
      getRawRows(config, 'daily_plans'),
      getRawRows(config, 'recurring_definitions'),
      getRawRows(config, 'daily_reports'),
      getRawRows(config, 'daily_logs', 'event_timestamp.desc'),
      getRawRows(config, 'reminders', 'remind_at.asc'),
      restFetch(config, `app_settings?workspace_id=eq.${encodeURIComponent(config.workspaceId)}&id=eq.default&select=settings&limit=1`, { headers: supabaseHeaders(config.serviceKey) }),
    ]);

    const settings = arr(settingsRows)[0]?.settings || null;
    const payload = {
      schemaVersion: '0.6.0',
      exportedAt: new Date().toISOString(),
      appVersion: '0.6.0-cloud-sync-foundation',
      tasks,
      subtasks,
      dailyPlans,
      recurringDefinitions,
      reports,
      logs,
      reminders,
      settings,
    };

    return json({
      ok: true,
      hasData: tasks.length > 0 || subtasks.length > 0 || reminders.length > 0 || Boolean(settings),
      payload,
      counts: { tasks: tasks.length, subtasks: subtasks.length, reminders: reminders.length, logs: logs.length },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Cloud sync read failed' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const config = requireConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);
  const auth = request.headers.get('authorization') || '';
  const headerToken = auth.replace(/^Bearer\s+/i, '');
  const body = await request.json().catch(() => ({}));
  const token = body?.token || headerToken;
  if (!verifyToken(config.token, token)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const payload = body?.payload || body;
  if (!payload || typeof payload !== 'object') return json({ ok: false, error: 'Missing sync payload' }, 400);

  try {
    const counts = {};
    counts.tasks = await upsertRows(config, 'tasks', arr(payload.tasks).map((item) => mapTask(item, config.workspaceId)));
    counts.subtasks = await upsertRows(config, 'subtasks', arr(payload.subtasks).map((item) => mapSubtask(item, config.workspaceId)));
    counts.reminders = await upsertRows(config, 'reminders', arr(payload.reminders).map((item) => mapReminder(item, config.workspaceId)));
    counts.dailyPlans = await upsertRows(config, 'daily_plans', arr(payload.dailyPlans).map((item) => mapDailyPlan(item, config.workspaceId)));
    counts.recurringDefinitions = await upsertRows(config, 'recurring_definitions', arr(payload.recurringDefinitions).map((item) => mapRecurringDefinition(item, config.workspaceId)));
    counts.reports = await upsertRows(config, 'daily_reports', arr(payload.reports).map((item) => mapDailyReport(item, config.workspaceId)));
    counts.logs = await upsertRows(config, 'daily_logs', arr(payload.logs).slice(0, 250).map((item) => mapLog(item, config.workspaceId)));

    if (payload.settings) {
      await restFetch(config, 'app_settings?on_conflict=id', {
        method: 'POST',
        headers: supabaseHeaders(config.serviceKey),
        body: JSON.stringify([{ id: 'default', workspace_id: config.workspaceId, settings: payload.settings, updated_at: new Date().toISOString() }]),
      });
      counts.settings = 1;
    } else {
      counts.settings = 0;
    }

    await restFetch(config, 'sync_events', {
      method: 'POST',
      headers: supabaseHeaders(config.serviceKey),
      body: JSON.stringify([{ workspace_id: config.workspaceId, event_type: 'sync_push', source: 'mission-control', app_version: payload.appVersion || '0.6.0', counts, message: 'Mission Control cloud sync push' }]),
    });

    return json({ ok: true, message: 'Cloud sync complete', counts, syncedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Cloud sync write failed' }, 500);
  }
}
