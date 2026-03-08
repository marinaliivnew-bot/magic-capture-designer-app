import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getIssues, getQuestions, updateQuestion, getProject, getBrief, analyzeBrief } from "@/lib/api";
import { PRIORITY_CONFIG, BRIEF_SECTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle, HelpCircle, ArrowRight, Sparkles, RotateCcw } from "lucide-react";

const QuestionsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [p, iss, qs] = await Promise.all([
          getProject(projectId),
          getIssues(projectId),
          getQuestions(projectId),
        ]);
        setProject(p);
        setIssues(iss || []);
        setQuestions(qs || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleToggleAsked = async (q: any) => {
    try {
      await updateQuestion(q.id, { asked: !q.asked });
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id ? { ...item, asked: !item.asked } : item
        )
      );
    } catch (e) {
      toast.error("Ошибка обновления");
    }
  };

  const handleAnswerChange = async (q: any, answer: string) => {
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === q.id ? { ...item, answer } : item
      )
    );
  };

  const handleSaveAnswer = async (q: any) => {
    try {
      await updateQuestion(q.id, { answer: q.answer });
      toast.success("Ответ сохранён");
    } catch (e) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleReanalyze = async () => {
    if (!projectId) return;
    setReanalyzing(true);
    try {
      const brief = await getBrief(projectId);
      const briefText = BRIEF_SECTIONS.map(
        ({ key }) => `### ${key}\n${(brief as any)?.[key] || "(пусто)"}`
      ).join("\n\n");
      const context = project
        ? `Тип: ${project.room_type || "?"}, Размеры: ${project.dimensions_text || "?"}`
        : "";
      await analyzeBrief(projectId, briefText, context);
      const [iss, qs] = await Promise.all([getIssues(projectId), getQuestions(projectId)]);
      setIssues(iss || []);
      setQuestions(qs || []);
      toast.success("Анализ обновлён");
    } catch (e: any) {
      toast.error(e.message || "Ошибка AI-анализа");
    } finally {
      setReanalyzing(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variantMap: Record<string, "critical" | "important" | "optional"> = {
      critical: "critical",
      important: "important",
      optional: "optional",
    };
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
    return (
      <Badge variant={variantMap[priority] || "optional"}>
        {config?.label || priority}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-content px-12 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/project/${projectId}/brief`)}
            className="text-muted-foreground hover:text-foreground transition-colors duration-350"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <span className="font-display text-xl flex-1">Вопросы и противоречия</span>
          <span className="caption-style">{project?.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-content px-12 py-16">
        {/* Contradictions */}
        {issues.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-8 flex items-center gap-3 text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.5} />
              Противоречия
            </h2>
            <div className="divide-y divide-border">
              {issues.filter(i => i.type === 'contradiction').map((issue) => (
                <div key={issue.id} className="py-6 border-l-[3px] border-l-[hsl(var(--color-critical))] pl-6">
                  <h3 className="text-[hsl(var(--color-critical))]">{issue.title}</h3>
                  {issue.evidence && (
                    <p className="mt-2 caption-style italic">
                      «{issue.evidence}»
                    </p>
                  )}
                  {issue.impact && (
                    <p className="mt-2 text-[15px] text-foreground font-light">{issue.impact}</p>
                  )}
                  {issue.suggestion && (
                    <p className="mt-2 text-[15px] text-primary font-light">
                      {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Questions */}
        <section className="mb-16">
          <h2 className="mb-8 flex items-center gap-3 text-foreground">
            <HelpCircle className="h-5 w-5 text-primary" strokeWidth={1.5} />
            Уточняющие вопросы
          </h2>
          {questions.length === 0 && !reanalyzing ? (
            <div className="py-16 text-center">
              <p className="font-display text-xl italic text-muted-foreground">
                Вопросы появятся после AI-анализа брифа
              </p>
              <Button
                variant="ghost"
                className="mt-6"
                onClick={handleReanalyze}
                disabled={reanalyzing}
              >
                Запустить AI-анализ
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {questions.map((q) => (
                <div key={q.id} className="py-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={q.asked}
                      onCheckedChange={() => handleToggleAsked(q)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        {getPriorityBadge(q.priority)}
                        <span className="text-[15px] font-light text-foreground">
                          {q.text}
                        </span>
                      </div>
                      {q.unlocks && (
                        <p className="caption-style">
                          Разблокирует: {q.unlocks}
                        </p>
                      )}
                      {q.asked && (
                        <Input
                          placeholder="Ответ клиента…"
                          value={q.answer || ""}
                          onChange={(e) => handleAnswerChange(q, e.target.value)}
                          onBlur={() => handleSaveAnswer(q)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="border-t border-border pt-8 flex flex-col gap-4 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/brief`)}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Бриф
          </Button>
          <Button
            variant="outline"
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="flex-1"
          >
            {reanalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {reanalyzing ? "Анализирую…" : "Пере-анализ"}
          </Button>
          <Button
            onClick={() => navigate(`/project/${projectId}/board`)}
            className="flex-1"
          >
            Концепт-борд
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionsPage;
