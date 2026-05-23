import type { DuplicateCandidate } from '../createTaskTypes';

interface DuplicateWarningProps {
  candidate: DuplicateCandidate;
  isSaving: boolean;
  onMerge: () => void;
  onForceCreate: () => void;
  onCancel: () => void;
}

export function DuplicateWarning({ candidate, isSaving, onMerge, onForceCreate, onCancel }: DuplicateWarningProps) {
  return (
    <section className="rounded-3xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
      <p className="font-black text-amber-950">מצאתי משימה קיימת דומה</p>
      <p className="mt-1 text-amber-900">
        {candidate.reason === 'exact' ? 'הכותרת זהה בדיוק:' : 'הכותרת דומה מאוד:'}{' '}
        <span className="font-black">{candidate.task.title}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white"
          onClick={onMerge}
          disabled={isSaving}
        >
          מזג כתתי־משימות
        </button>
        <button
          type="button"
          className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-800 ring-1 ring-amber-200"
          onClick={onForceCreate}
          disabled={isSaving}
        >
          צור בכל זאת משימה חדשה
        </button>
        <button
          type="button"
          className="rounded-2xl bg-amber-100 px-4 py-2 text-xs font-black text-amber-900"
          onClick={onCancel}
        >
          בטל החלטה
        </button>
      </div>
    </section>
  );
}
