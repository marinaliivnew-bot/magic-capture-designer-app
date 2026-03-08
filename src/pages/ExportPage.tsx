import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, getBrief, getIssues, getQuestions, getBoardBlocks } from "@/lib/api";
import { BRIEF_SECTIONS, BOARD_BLOCK_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Download } from "lucide-react";

const ExportPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [p, b, iss, qs, bb] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getIssues(projectId),
          getQuestions(projectId),
          getBoardBlocks(projectId),
        ]);
        setProject(p);
        setBrief(b);
        setIssues(iss || []);
        setQuestions(qs || []);
        setBlocks(bb || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleExportPDF = () => {
    // In MVP, we use browser print as a simple PDF export
    toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
    setTimeout(() => window.print(), 300);
  };

  const getBlockLabel = (type: string) =>
    BOARD_BLOCK_TYPES.find((b) => b.type === type)?.label || type;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Navigation (hidden in print) */}
        <div className="mb-6 flex items-center gap-3 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/project/${projectId}/board`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display text-foreground">
              Экспорт PDF
            </h1>
          </div>
          <Button onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Скачать PDF
          </Button>
        </div>

        {/* Printable content */}
        <div className="space-y-8 print:space-y-6">
          {/* Title page */}
          <div className="rounded-lg border border-border bg-card p-8 text-center print:border-none print:p-0">
            <h1 className="text-3xl font-display text-foreground">
              {project?.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {project?.room_type && `Тип: ${project.room_type}`}
              {project?.room_type && project?.dimensions_text && " · "}
              {project?.dimensions_text && `Габариты: ${project.dimensions_text}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date().toLocaleDateString("ru-RU")}
            </p>
          </div>

          {/* Brief */}
          <div>
            <h2 className="mb-4 text-xl font-display text-foreground">Бриф</h2>
            <div className="space-y-4">
              {BRIEF_SECTIONS.map(({ key, label }) => (
                <div key={key} className="rounded-lg border border-border bg-card p-4 print:border-none print:p-2">
                  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {brief?.[key] || "не указано"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Contradictions */}
          {issues.filter((i) => i.type === "contradiction").length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-display text-foreground">
                Противоречия
              </h2>
              <div className="space-y-3">
                {issues
                  .filter((i) => i.type === "contradiction")
                  .map((issue) => (
                    <div key={issue.id} className="rounded-lg border border-border bg-card p-4 print:border-none print:p-2">
                      <h3 className="font-semibold text-foreground text-sm">
                        {issue.title}
                      </h3>
                      {issue.evidence && (
                        <p className="text-sm text-muted-foreground italic">
                          «{issue.evidence}»
                        </p>
                      )}
                      {issue.suggestion && (
                        <p className="text-sm text-primary">{issue.suggestion}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Questions */}
          {questions.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-display text-foreground">
                Вопросы
              </h2>
              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q.id} className="rounded-lg border border-border bg-card p-3 print:border-none print:p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        [{q.priority}]
                      </span>
                      <span className="text-sm text-foreground">{q.text}</span>
                    </div>
                    {q.answer && (
                      <p className="mt-1 text-sm text-primary">
                        Ответ: {q.answer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concept board */}
          {blocks.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-display text-foreground">
                Концепт-борд
              </h2>
              <div className="space-y-4">
                {blocks.map((block) => (
                  <div key={block.id} className="rounded-lg border border-border bg-card p-4 print:border-none print:p-2">
                    <h3 className="font-semibold text-foreground text-sm">
                      {getBlockLabel(block.block_type)}
                    </h3>
                    {block.caption && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {block.caption}
                      </p>
                    )}
                    {block.board_images?.map((img: any) => (
                      <div key={img.id} className="mt-2">
                        {img.url && (
                          <a
                            href={img.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary underline break-all"
                          >
                            {img.url}
                          </a>
                        )}
                        {img.attribution && (
                          <p className="text-xs text-muted-foreground">
                            {img.attribution}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground italic print:mt-8">
            Draft concept, requires designer review
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
