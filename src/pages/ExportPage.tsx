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
    toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
    setTimeout(() => window.print(), 300);
  };

  const getBlockLabel = (type: string) =>
    BOARD_BLOCK_TYPES.find((b) => b.type === type)?.label || type;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation (hidden in print) */}
      <header className="border-b border-border bg-background print:hidden">
        <div className="mx-auto max-w-content px-12 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/project/${projectId}/board`)}
            className="text-muted-foreground hover:text-foreground transition-colors duration-350"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <span className="font-display text-xl flex-1">Экспорт</span>
          <Button onClick={handleExportPDF} size="sm">
            <Download className="mr-2 h-4 w-4" />
            Скачать PDF
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-content px-12 py-16">
        {/* Title */}
        <div className="mb-16 text-center print:mb-8">
          <h1 className="text-foreground">{project?.name}</h1>
          <p className="mt-4 caption-style">
            {new Date().toLocaleDateString("ru-RU")}
          </p>
        </div>

        {/* Brief */}
        <section className="mb-16">
          <h2 className="mb-8 text-foreground">Бриф</h2>
          <div className="divide-y divide-border">
            {BRIEF_SECTIONS.map(({ key, label }) => (
              <div key={key} className="py-6 print:py-3">
                <span className="label-style text-foreground">{label}</span>
                <p className="mt-2 text-[15px] font-light text-muted-foreground">
                  {brief?.[key] || "не указано"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contradictions */}
        {issues.filter((i) => i.type === "contradiction").length > 0 && (
          <section className="mb-16">
            <h2 className="mb-8 text-foreground">Противоречия</h2>
            <div className="divide-y divide-border">
              {issues
                .filter((i) => i.type === "contradiction")
                .map((issue) => (
                  <div key={issue.id} className="py-6 print:py-3">
                    <h3 className="text-foreground">{issue.title}</h3>
                    {issue.evidence && (
                      <p className="mt-1 caption-style italic">«{issue.evidence}»</p>
                    )}
                    {issue.suggestion && (
                      <p className="mt-2 text-[15px] text-primary font-light">{issue.suggestion}</p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Questions */}
        {questions.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-8 text-foreground">Вопросы</h2>
            <div className="divide-y divide-border">
              {questions.map((q) => (
                <div key={q.id} className="py-4 print:py-2">
                  <div className="flex items-center gap-3">
                    <span className="label-style text-muted-foreground">[{q.priority}]</span>
                    <span className="text-[15px] font-light text-foreground">{q.text}</span>
                  </div>
                  {q.answer && (
                    <p className="mt-1 text-[15px] text-primary font-light">
                      Ответ: {q.answer}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Concept board */}
        {blocks.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-8 text-foreground">Концепт-борд</h2>
            <div className="divide-y divide-border">
              {blocks.map((block) => (
                <div key={block.id} className="py-6 print:py-3">
                  <h3 className="text-foreground">{getBlockLabel(block.block_type)}</h3>
                  {block.caption && (
                    <p className="mt-2 text-[15px] font-light text-muted-foreground">{block.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="text-center caption-style italic print:mt-8">
          Draft concept, requires designer review
        </p>
      </div>
    </div>
  );
};

export default ExportPage;
