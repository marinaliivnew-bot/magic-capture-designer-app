import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getIssues, getQuestions, updateQuestion, getProject, getBrief, analyzeBrief, getBoardBlocks, upsertBrief } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { PRIORITY_CONFIG, BRIEF_SECTIONS, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import ProjectHeader from "@/components/ProjectHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, AlertTriangle, HelpCircle, ArrowRight, ArrowLeft, Sparkles, RotateCcw, Download, Check } from "lucide-react";

const QuestionsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [applyingAnswers, setApplyingAnswers] = useState(false);
  const [answersApplied, setAnswersApplied] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);
  const [savedAnswer, setSavedAnswer] = useState<string | null>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [p, b, iss, qs, rms, bb] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getIssues(projectId),
          getQuestions(projectId),
          getRooms(projectId),
          getBoardBlocks(projectId),
        ]);
        setProject(p);
        setBrief(b);
        setIssues(iss || []);
        setQuestions(qs || []);
        setRooms(rms || []);
        setBlocks(bb || []);
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
    // Reset applied status when new answers are entered
    setAnswersApplied(false);
  };

  const handleSaveAnswer = async (q: any) => {
    setSavingAnswer(q.id);
    try {
      await updateQuestion(q.id, { answer: q.answer });
      setSavedAnswer(q.id);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSavedAnswer(null), 2000);
    } catch (e) {
      toast.error("Ошибка сохранения");
    } finally {
      setSavingAnswer(null);
    }
  };

  const handleApplyAnswers = async () => {
    if (!projectId || !brief) return;
    const answered = questions.filter(q => q.answer?.trim());
    if (answered.length === 0) {
      toast.info("Нет ответов для применения");
      return;
    }

    setApplyingAnswers(true);
    try {
      const currentBrief: Record<string, string> = {};
      BRIEF_SECTIONS.forEach(({ key }) => {
        currentBrief[key] = (brief as any)?.[key] || "";
      });

      const answeredQuestions = answered.map(q => ({
        question_text: q.text,
        answer: q.answer,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-answers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ currentBrief, answeredQuestions }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Ошибка: ${resp.status}`);
      }

      const updatedFields = await resp.json();

      // Save updated brief to DB
      await upsertBrief(projectId, updatedFields);

      // Update local state
      setBrief((prev: any) => ({ ...prev, ...updatedFields }));
      setAnswersApplied(true);
      toast.success("Бриф обновлён на основе ответов клиента");
    } catch (e: any) {
      toast.error(e.message || "Ошибка применения ответов");
      console.error(e);
    } finally {
      setApplyingAnswers(false);
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

  const handleExportPDF = () => {
    const ok = generateFullPDF({ project, brief, rooms, issues, questions, blocks }, { variant: "brief" });
    if (!ok) {
      toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
    }
  };

  const hasAnsweredQuestions = questions.some(q => q.answer?.trim());

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
      <ProjectHeader
        projectId={projectId!}
        currentStep="questions"
        title="Вопросы и противоречия"
        projectName={project?.name}
      >
        <Button onClick={handleExportPDF} variant="outline" size="sm" title="Экспорт брифа и вопросов без концепт-борда">
          <Download className="mr-2 h-4 w-4" />
          ↓ Бриф PDF
        </Button>
      </ProjectHeader>

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
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Ответ клиента…"
                            value={q.answer || ""}
                            onChange={(e) => handleAnswerChange(q, e.target.value)}
                            onBlur={() => handleSaveAnswer(q)}
                            className="flex-1"
                          />
                          {savingAnswer === q.id && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                          {savedAnswer === q.id && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Apply answers button */}
        {hasAnsweredQuestions && (
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={handleApplyAnswers}
              disabled={applyingAnswers || answersApplied}
              className="w-full"
            >
              {applyingAnswers ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : answersApplied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {applyingAnswers ? "Обновляю бриф…" : answersApplied ? "Применено ✓" : "Применить ответы к брифу"}
            </Button>
          </div>
        )}

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
