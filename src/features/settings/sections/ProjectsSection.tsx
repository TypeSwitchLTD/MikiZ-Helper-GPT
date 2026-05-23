import { SectionCard } from '../../../components/layout/SectionCard';

interface ProjectsSectionProps {
  projectsText: string;
  onProjectsChange: (text: string) => void;
  domainsText: string;
  onDomainsChange: (text: string) => void;
}

export function ProjectsSection({ projectsText, onProjectsChange, domainsText, onDomainsChange }: ProjectsSectionProps) {
  return (
    <SectionCard title="פרויקטים ודומיינים" description="פורמט לכל שורה: id|name|active. עדיף לא לשנות id אחרי שנוצרו משימות.">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="field-card">
          <span>פרויקטים</span>
          <textarea rows={8} className="ltr text-left" value={projectsText} onChange={(e) => onProjectsChange(e.target.value)} />
        </label>
        <label className="field-card">
          <span>דומיינים</span>
          <textarea rows={8} className="ltr text-left" value={domainsText} onChange={(e) => onDomainsChange(e.target.value)} />
        </label>
      </div>
    </SectionCard>
  );
}
