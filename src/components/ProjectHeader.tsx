import { useNavigate } from "react-router-dom";
import ProjectStepNav from "./ProjectStepNav";

interface ProjectHeaderProps {
  projectId: string;
  currentStep: string;
  title: string;
  projectName?: string;
  children?: React.ReactNode;
}

const ProjectHeader = ({ projectId, currentStep, title, projectName, children }: ProjectHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-background print:hidden">
      <div className="mx-auto max-w-content px-12 py-4 flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="font-display text-lg text-foreground hover:text-primary transition-colors duration-350 shrink-0"
          >
            Brief → Concept
          </button>
          <span className="text-muted-foreground text-[11px]">|</span>
          <span className="font-display text-xl flex-1 truncate">{title}</span>
          {children}
          {projectName && (
            <span className="caption-style hidden sm:block">{projectName}</span>
          )}
        </div>
        <ProjectStepNav projectId={projectId} currentStep={currentStep} />
      </div>
    </header>
  );
};

export default ProjectHeader;
