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
      toast.success("Анализ обновлён!");
    } catch (e: any) {
      toast.error(e.message || "Ошибка AI-анализа");
    } finally {
      setReanalyzing(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
    if (!config) return <Badge variant="secondary">{priority}</Badge>;
    
    const colorMap = {
      destructive: "bg-destructive text-destructive-foreground",
      warning: "bg-warning text-warning-foreground",
      info: "bg-info text-info-foreground",
    };
    
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[config.color]}`}>
        {config.label}
      </span>
    );
  };

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
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}/brief`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display text-foreground">
              Вопросы и противоречия
            </h1>
            <p className="text-sm text-muted-foreground">{project?.name}</p>
          </div>
        </div>

        {/* Contradictions */}
        {issues.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-display text-foreground">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Противоречия
            </h2>
            <div className="space-y-4">
              {issues.filter(i => i.type === 'contradiction').map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-warning/30 bg-warning/5 p-4"
                >
                  <h3 className="font-semibold text-foreground">{issue.title}</h3>
                  {issue.evidence && (
                    <p className="mt-1 text-sm text-muted-foreground italic">
                      «{issue.evidence}»
                    </p>
                  )}
                  {issue.impact && (
                    <p className="mt-2 text-sm text-foreground">{issue.impact}</p>
                  )}
                  {issue.suggestion && (
                    <p className="mt-2 text-sm text-primary font-medium">
                      💡 {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-display text-foreground">
            <HelpCircle className="h-5 w-5 text-info" />
            Уточняющие вопросы
          </h2>
          {questions.length === 0 && !reanalyzing ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                Вопросы появятся после AI-анализа брифа.
              </p>
              <Button
                className="mt-4"
                onClick={handleReanalyze}
                disabled={reanalyzing}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Запустить AI-анализ
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={q.asked}
                      onCheckedChange={() => handleToggleAsked(q)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getPriorityBadge(q.priority)}
                        <span className="text-sm font-medium text-foreground">
                          {q.text}
                        </span>
                      </div>
                      {q.unlocks && (
                        <p className="text-xs text-muted-foreground">
                          Разблокирует: {q.unlocks}
                        </p>
                      )}
                      {q.asked && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ответ клиента…"
                            value={q.answer || ""}
                            onChange={(e) => handleAnswerChange(q, e.target.value)}
                            onBlur={() => handleSaveAnswer(q)}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/brief`)}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к брифу
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
