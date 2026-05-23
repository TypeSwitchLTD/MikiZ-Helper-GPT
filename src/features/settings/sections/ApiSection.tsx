import { SectionCard } from '../../../components/layout/SectionCard';
import type { SettingsFormState, UpdateFieldFn, LeadTableSettingsRow } from '../settingsFormTypes';

interface ApiSectionProps {
  form: SettingsFormState;
  updateField: UpdateFieldFn;
  leadTableSettings: LeadTableSettingsRow[];
  updateLeadTableSetting: (index: number, patch: Partial<LeadTableSettingsRow>) => void;
  leadTableSettingsStatus: string;
  apiTestStatus: string;
  onTestMorningApi: () => void;
  onTestTableStatsApi: () => void;
}

export function ApiSection({
  form,
  updateField,
  leadTableSettings,
  updateLeadTableSetting,
  leadTableSettingsStatus,
  apiTestStatus,
  onTestMorningApi,
  onTestTableStatsApi,
}: ApiSectionProps) {
  return (
    <SectionCard
      title="API / Cloud / Tokens"
      description="כל החיבורים החיצוניים: Cloudflare, Android, Supabase ו-ElevenLabs. הגדרות נשמרות דרך Cloud Sync."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="field-card lg:col-span-2">
          <span>Cloudflare Publish endpoint</span>
          <input className="ltr text-left" value={form.morningAndroidPublishEndpoint} onChange={(e) => updateField('morningAndroidPublishEndpoint', e.target.value)} placeholder="https://mikiz-helper-gpt-pages.pages.dev/api/morning-briefing" />
        </label>
        <label className="field-card lg:col-span-2">
          <span>Token לפרסום / Android</span>
          <input className="ltr text-left" type="password" value={form.morningAndroidPublishToken} onChange={(e) => updateField('morningAndroidPublishToken', e.target.value)} placeholder="אותו MORNING_BRIEFING_TOKEN מ-Cloudflare" />
        </label>
        <label className="field-card lg:col-span-2">
          <span>URL לצלצול MP3</span>
          <input className="ltr text-left" value={form.morningRingtoneUrl} onChange={(e) => updateField('morningRingtoneUrl', e.target.value)} placeholder="https://.../wake-up.mp3" />
        </label>
        <label className="field-card lg:col-span-2">
          <span>ElevenLabs Proxy URL</span>
          <input className="ltr text-left" value={form.elevenLabsProxyUrl} onChange={(e) => updateField('elevenLabsProxyUrl', e.target.value)} placeholder="ריק = Cloudflare Proxy אוטומטי" />
        </label>
        <label className="field-card lg:col-span-2">
          <span>ElevenLabs API Key</span>
          <input className="ltr text-left" type="password" value={form.elevenLabsApiKey} onChange={(e) => updateField('elevenLabsApiKey', e.target.value)} placeholder="sk_..." />
          <small className="text-xs font-bold text-slate-500">Voice ID נמצא גם בלשונית בוקר וקול.</small>
        </label>
        <label className="field-card lg:col-span-2">
          <span>Instantly.AI API Key</span>
          <input className="ltr text-left" type="password" value={form.instantlyApiKey} onChange={(e) => updateField('instantlyApiKey', e.target.value)} placeholder="מפתח Instantly.AI — נמצא ב-Settings > API" />
        </label>
        <label className="field-card lg:col-span-2">
          <span>Meta / Facebook App ID</span>
          <input className="ltr text-left" value={form.metaAppId} onChange={(e) => updateField('metaAppId', e.target.value)} placeholder="App ID מ-developers.facebook.com" />
          <small className="text-xs font-bold text-slate-500">נדרש לחיבור Instagram Business דרך Facebook Login. App Secret שמור ב-Cloudflare env.</small>
        </label>

        <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">Supabase Table Stats</p>
              <p className="mt-1 text-xs font-bold text-slate-500">שמות הטבלאות. ניתוח נתונים מוצג במסך לידים וסושיאל.</p>
            </div>
            <button type="button" className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white" onClick={onTestTableStatsApi}>בדוק table-stats</button>
          </div>
          <div className="mt-3 grid gap-3">
            {leadTableSettings.map((row, index) => (
              <div key={row.id} className="grid gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 lg:grid-cols-[160px_minmax(0,1fr)_180px]">
                <div>
                  <p className="text-xs font-black text-slate-500">{row.project}</p>
                  <p className="text-sm font-black text-slate-950">{row.label}</p>
                </div>
                <label className="field-card bg-white">
                  <span>שם טבלה</span>
                  <input className="ltr text-left" value={row.table} onChange={(e) => updateLeadTableSetting(index, { table: e.target.value.trim() })} placeholder="table_name" />
                </label>
                <label className="field-card bg-white">
                  <span>עמודת תאריך</span>
                  <input className="ltr text-left" value={row.dateColumn} onChange={(e) => updateLeadTableSetting(index, { dateColumn: e.target.value.trim() || 'created_at' })} placeholder="created_at" />
                </label>
              </div>
            ))}
          </div>
          {leadTableSettingsStatus ? <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100">{leadTableSettingsStatus}</p> : null}
        </div>

        <div className="rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-100 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-sky-950">בדיקת חיבור Cloudflare</p>
              <p className="mt-1 text-xs font-bold text-sky-700">not_found = החיבור תקין, עוד לא פורסם נאום.</p>
            </div>
            <button type="button" className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-black text-white" onClick={onTestMorningApi}>בדוק חיבור</button>
          </div>
          {apiTestStatus ? <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-black text-sky-900 ring-1 ring-sky-100">{apiTestStatus}</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}
