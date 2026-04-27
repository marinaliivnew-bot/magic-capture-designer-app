import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "edit", label: "Ввод", path: (id: string) => `/project/${id}/edit` },
  { key: "brief", label: "Бриф", path: (id: string) => `/project/${id}/brief` },
  { key: "style", label: "Стиль", path: (id: string) => `/project/${id}/style` },
  { key: "client-taste", label: "Вкус", path: (id: string) => `/project/${id}/client-taste` },
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
  const currentIndex = STEPS.findIndex((step) => step.key === currentStep);

  return (
    <nav className="flex items-center gap-1 text-[11px] font-body font-medium uppercase tracking-[0.1em]">
      {STEPS.map((step, index) => {
        const isCurrent = step.key === currentStep;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;

        return (
          <span key={step.key} className="flex items-center gap-1">
            {index > 0 && <span className="mx-0.5 text-muted-foreground">→</span>}
            <button
              onClick={() => (isPast ? navigate(step.path(projectId)) : undefined)}
              disabled={isFuture}
              className={cn(
                "transition-colors duration-350",
                isCurrent && "font-medium text-primary",
                isPast && "cursor-pointer text-muted-foreground hover:text-foreground",
                isFuture && "cursor-default text-muted-foreground/40",
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
