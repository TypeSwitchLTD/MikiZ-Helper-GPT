import { useRef, useState } from 'react';
import { SectionCard } from '../../../components/layout/SectionCard';
import type { SettingsFormState, UpdateFieldFn, AppSettings } from '../settingsFormTypes';
import { useDragSort } from '../../../hooks/useDragSort';
import type { MorningPreviewProps } from '../SettingsTab';

interface MorningSectionItem {
  id: string;
  label: string;
  field: keyof SettingsFormState;
}

interface MorningSectionProps {
  form: SettingsFormState;
  updateField: UpdateFieldFn;
  orderedMorningSections: MorningSectionItem[];
  moveMorningSection: (id: string, direction: -1 | 1) => void;
  voiceTestStatus: string;
  onTestElevenLabs: () => void;
  settings: AppSettings;
  morningPreview?: MorningPreviewProps;
}

export function MorningSection({
  form,
  updateField,
  orderedMorningSections,
  voiceTestStatus,
  onTestElevenLabs,
  morningPreview,
}: MorningSectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editText, setEditText] = useState('');

  const reorderSection = (from: number, to: number) => {
    const order = [...form.morningSectionOrder];
    const [removed] = order.splice(from, 1);
    order.splice(to, 0, removed);
    updateField('morningSectionOrder', order);
  };

  const { dragIdx, dragOverIdx, startTouch, endTouch, startDrag, overDrag, leaveDrag, dropDrag, endDrag } =
    useDragSort(containerRef, reorderSection);

  const handlePreviewToggle = () => {
    if (previewOpen) {
      setPreviewOpen(false);
    } else {
      setEditText(morningPreview?.text ?? '');
      setPreviewOpen(true);
    }
  };

  return (
    <SectionCard
      title="בוקר, קול והקראה"
      description="נאום, סדר הופעה, קול, מהירות, ElevenLabs וצלצול בוקר — הכל במקום אחד."
    >
      {/* ── Preview panel ───────────────────────────── */}
      {morningPreview && (
        <div className="mb-4 rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-sky-900">תצוגה מקדימה של הנאום</p>
              <p className="text-xs font-bold text-sky-600">ניתן לערוך ולהקריא ישירות מכאן</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-2xl bg-sky-100 px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-200"
                onClick={handlePreviewToggle}
              >
                {previewOpen ? 'סגור' : 'פתח נאום'}
              </button>
              {previewOpen && (
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-xs font-black text-white transition ${morningPreview.isGeneratingVoice || morningPreview.isSpeaking || morningPreview.isMorningLoading ? 'bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  onClick={() => {
                    if (morningPreview.isSpeaking || morningPreview.isGeneratingVoice) {
                      morningPreview.stop();
                    } else {
                      void morningPreview.playText(editText || morningPreview.text);
                    }
                  }}
                >
                  {morningPreview.isGeneratingVoice || morningPreview.isMorningLoading ? 'מכין...' : morningPreview.isSpeaking ? '■ עצור' : '▶ הקרא'}
                </button>
              )}
            </div>
          </div>
          {previewOpen && (
            <textarea
              className="mt-3 w-full resize-y rounded-2xl border border-sky-200 bg-white p-3 text-sm font-bold leading-7 text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              rows={12}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              dir="rtl"
            />
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h3 className="text-lg font-black text-slate-950">סדר נאום הבוקר</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">גרור לשינוי סדר. checkbox מסיר סעיף מהנאום.</p>
          <div className="mt-3 grid gap-2" ref={containerRef}>
            {orderedMorningSections.map((section, index) => (
              <div
                key={section.id}
                data-drag-idx={index}
                draggable
                onDragStart={() => startDrag(index)}
                onDragOver={(e) => overDrag(e, index)}
                onDragLeave={leaveDrag}
                onDrop={() => dropDrag(index)}
                onDragEnd={endDrag}
                onTouchStart={() => startTouch(index)}
                onTouchEnd={endTouch}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl bg-white p-2 ring-1 transition cursor-grab active:cursor-grabbing select-none ${dragOverIdx === index && dragIdx !== index ? 'ring-sky-400 bg-sky-50' : 'ring-slate-200'} ${dragIdx === index ? 'opacity-50' : ''}`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">{index + 1}</span>
                <label className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <input
                    type="checkbox"
                    checked={Boolean(form[section.field])}
                    onChange={(e) => updateField(section.field, e.target.checked)}
                  />
                  {section.label}
                </label>
                <span className="select-none text-slate-300 text-lg px-1">⠿</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <label className="field-card">
            <span>כינוי בוקר</span>
            <input value={form.morningNickname} onChange={(e) => updateField('morningNickname', e.target.value)} placeholder="מיקי / אחי / אלוף" />
          </label>
          <label className="field-card">
            <span>משפט חיזוק</span>
            <input value={form.morningMotivationLine} onChange={(e) => updateField('morningMotivationLine', e.target.value)} />
          </label>
          <label className="field-card">
            <span>תרגיל בוקר</span>
            <input value={form.morningExerciseLine} onChange={(e) => updateField('morningExerciseLine', e.target.value)} />
          </label>
          <label className="field-card">
            <span>משפט סיום</span>
            <input value={form.morningClosingLine} onChange={(e) => updateField('morningClosingLine', e.target.value)} />
          </label>
          <div className="field-card">
            <span>סגנון נאום</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {([['calm', 'רגוע'], ['push', 'דוחף'], ['funny', 'מצחיק'], ['business', 'עסקי'], ['big_brother', 'אח גדול']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 ${form.morningStyle === value ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200'}`}
                  onClick={() => updateField('morningStyle', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100 lg:grid-cols-2">
        <div className="field-card lg:col-span-2">
          <span>מנוע קול</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`rounded-2xl px-3 py-2 text-sm font-black ring-1 ${form.voiceEngine === 'browser' ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200'}`} onClick={() => updateField('voiceEngine', 'browser')}>דפדפן</button>
            <button type="button" className={`rounded-2xl px-3 py-2 text-sm font-black ring-1 ${form.voiceEngine === 'elevenlabs' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-emerald-800 ring-emerald-100'}`} onClick={() => updateField('voiceEngine', 'elevenlabs')}>ElevenLabs</button>
          </div>
        </div>
        <div className="field-card lg:col-span-2">
          <span>קול המספר / המספרת</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`rounded-2xl px-3 py-2 text-sm font-black ring-1 ${form.voiceNarratorGender === 'female' ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200'}`} onClick={() => updateField('voiceNarratorGender', 'female')}>קול אישה</button>
            <button type="button" className={`rounded-2xl px-3 py-2 text-sm font-black ring-1 ${form.voiceNarratorGender === 'male' ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200'}`} onClick={() => updateField('voiceNarratorGender', 'male')}>קול גבר</button>
          </div>
          <small className="text-xs font-bold text-slate-500">משנה רק מקריאה/מקריא, לא את המגדר שלך.</small>
        </div>
        <label className="field-card lg:col-span-2">
          <span>מהירות הקראה: {form.speechRate.toFixed(2)}x</span>
          <input type="range" min="0.65" max="2.00" step="0.05" value={form.speechRate} onChange={(e) => updateField('speechRate', Number(e.target.value))} />
          <small className="text-xs font-bold text-slate-400">0.65 — איטי · 1.00 — רגיל · 2.00 — מהיר מאוד</small>
        </label>
        <label className="field-card">
          <span>Voice ID</span>
          <input className="ltr text-left" value={form.elevenLabsVoiceId} onChange={(e) => updateField('elevenLabsVoiceId', e.target.value)} />
        </label>
        <div className="rounded-3xl bg-white p-4 ring-1 ring-emerald-100 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black text-emerald-950">בדיקת ElevenLabs</p>
            <button type="button" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white" onClick={onTestElevenLabs}>בדוק קול</button>
          </div>
          {voiceTestStatus ? <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900 ring-1 ring-emerald-100">{voiceTestStatus}</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}
