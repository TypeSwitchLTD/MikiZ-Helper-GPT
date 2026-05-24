import type { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200 sm:rounded-3xl sm:p-5 sm:shadow-soft">
      <div className="mb-2 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 sm:text-xl sm:font-bold">{title}</h2>
          {description ? <p className="mt-1 hidden text-sm text-slate-500 sm:block">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
