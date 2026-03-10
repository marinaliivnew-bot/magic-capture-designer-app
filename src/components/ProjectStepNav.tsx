import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "edit", label: "Ввод", path: (id: string) => `/project/${id}/edit` },
  { key: "style", label: "Стиль", path: (id: string) => `/project/${id}/style` },
  { key: "brief", label: "Бриф", path: (id: string) => `/project/${id}/brief` },
  { key: "questions", label: "Вопросы", path: (id: string) => `/project/${id}/questions` },
  { key: "board", label: "Борд", path: (id: string) => `/project/${id}/board` },
  { key: "export", label: "Экспорт", path: (id: string) => `/project/${id}/export` },
];

interface ProjectStepNavProps {
  projectId: string;
  currentStep: string;
}

const ProjectStepNav = ({ projectId, currentStep }: ProjectStepNavProps) => {
  const navigate = useNavigate();
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <nav className="flex items-center gap-1 text-[11px] font-body font-medium uppercase tracking-[0.1em]">
      {STEPS.map((step, i) => {
        const isCurrent = step.key === currentStep;
        const isPast = i < currentIndex;
        const isFuture = i > currentIndex;

        return (
          <span key={step.key} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground mx-0.5">→</span>}
            <button
              onClick={() => isPast ? navigate(step.path(projectId)) : undefined}
              disabled={isFuture}
              className={cn(
                "transition-colors duration-350",
                isCurrent && "text-primary font-medium",
                isPast && "text-muted-foreground hover:text-foreground cursor-pointer",
                isFuture && "text-muted-foreground/40 cursor-default"
              )}
            >
              {step.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
};

export default ProjectStepNav;
