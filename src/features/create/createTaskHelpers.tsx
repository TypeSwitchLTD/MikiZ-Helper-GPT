/** JSX helpers for create-task panels */

export function compactSectionTitle(title: string, helper?: string) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-xs font-black text-slate-600">{title}</span>
      {helper ? <span className="text-[11px] font-bold text-slate-400">{helper}</span> : null}
    </div>
  );
}
