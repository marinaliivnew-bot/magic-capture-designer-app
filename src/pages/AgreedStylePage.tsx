import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrief, resolveStyle, upsertBrief, type AgreedStyleResult, type StyleConflict } from "@/lib/api";
import ProjectHeader from "@/components/ProjectHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const LAYER_LABEL: Record<string, string> = {
  client: "Запрос клиента",
  designer: "Стандарт дизайнера",
  both: "Совпадение",
};

const LAYER_COLOR: Record<string, string> = {
  client: "text-muted-foreground",
  designer: "text-foreground",
  both: "text-primary",
};

const AgreedStylePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AgreedStyleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedConflict, setExpandedConflict] = useState<number | null>(null);
  const [conflictNotes, setConflictNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const brief = await getBrief(projectId);
        const saved = (brief as any)?.agreed_style_result;
        if (saved?.summary) {
          setResult(saved as AgreedStyleResult);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const runAnalysis = async () => {
    if (!projectId) return;
    setAnalyzing(true);
    try {
      const data = await resolveStyle(projectId);
      setResult(data);
      setConflictNotes({});
      toast.success("Согласование завершено");
    } catch (error: any) {
      toast.error(error.message || "Ошибка анализа");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const resolveConflict = async (index: number, resolution: "accepted" | "overridden") => {
    if (!result || !projectId) return;
    const next: AgreedStyleResult = {
      ...result,
      conflicts: result.conflicts.map((c, i) =>
        i === index
          ? { ...c, resolution, resolution_note: conflictNotes[index] || "" }
          : c,
      ),
    };
    setResult(next);
    setSaving(true);
    try {
      await upsertBrief(projectId, { agreed_style_result: next });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const unresolvedCount = result?.conflicts.filter((c) => !c.resolution).length ?? 0;
  const allResolved = result !== null && unresolvedCount === 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader projectId={projectId!} currentStep="agreed-style" title="Согласование стиля" />

      <div className="mx-auto max-w-content px-12 py-16">
        <div className="mb-12 max-w-2xl">
          <h1 className="heading-style text-foreground">Стиль дизайнера × Вкус клиента</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            AI сравнивает вкусовой профиль клиента со стандартами дизайнера.
            Согласованные элементы войдут в концепцию. Конфликты нужно явно разрешить.
          </p>
        </div>

        {!result && !analyzing && (
          <div className="border border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="mb-2 text-sm text-muted-foreground">
              Запустите согласование, чтобы увидеть где стиль дизайнера и вкус клиента совпадают,
              а где конфликтуют.
            </p>
            <p className="mb-6 text-xs text-muted-foreground">
              Требуется заполненный профиль дизайнера и проведённый анализ вкуса клиента.
            </p>
            <Button onClick={runAnalysis}>
              <Sparkles className="mr-2 h-4 w-4" />
              Запустить согласование
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="flex items-center gap-3 border border-border p-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Сравниваю вкус клиента со стандартами дизайнера...
          </div>
        )}

        {result && (
          <div className="space-y-12">
            {/* Summary */}
            <section className="border-t border-border pt-8">
              <p className="max-w-2xl text-sm leading-relaxed text-foreground">{result.summary}</p>
              {result.conflicts.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border",
                    allResolved
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                  )}>
                    {allResolved ? (
                      <><Check className="h-3.5 w-3.5" />Все конфликты разрешены</>
                    ) : (
                      <><AlertTriangle className="h-3.5 w-3.5" />{unresolvedCount} конфликт{unresolvedCount === 1 ? "" : unresolvedCount < 5 ? "а" : "ов"} требует решения</>
                    )}
                  </span>
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              )}
            </section>

            {/* Agreed elements */}
            {result.agreed_elements.length > 0 && (
              <section className="border-t border-border pt-8">
                <div className="mb-6">
                  <h2 className="label-style text-foreground">Согласовано</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Эти элементы войдут в концепцию без вопросов
                  </p>
                </div>
                <div className="space-y-3">
                  {result.agreed_elements.map((item, index) => (
                    <div key={index} className="flex items-start gap-4 border border-border p-4">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{item.element}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{item.client_signal}</span>
                          <span className={cn("font-medium", LAYER_COLOR[item.layer])}>
                            {LAYER_LABEL[item.layer] ?? item.layer}
                          </span>
                        </div>
                        {item.designer_note && (
                          <p className="mt-1 text-[11px] text-muted-foreground">{item.designer_note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Conflicts */}
            {result.conflicts.length > 0 && (
              <section className="border-t border-border pt-8">
                <div className="mb-6">
                  <h2 className="label-style text-foreground">Конфликты</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Каждый конфликт нужно явно разрешить — принять альтернативу или переопределить стандарт
                  </p>
                </div>
                <div className="space-y-4">
                  {result.conflicts.map((conflict, index) => (
                    <ConflictCard
                      key={index}
                      conflict={conflict}
                      index={index}
                      expanded={expandedConflict === index}
                      note={conflictNotes[index] || ""}
                      onToggle={() => setExpandedConflict(expandedConflict === index ? null : index)}
                      onNoteChange={(note) => setConflictNotes((prev) => ({ ...prev, [index]: note }))}
                      onResolve={(resolution) => resolveConflict(index, resolution)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Gaps */}
            {result.gaps.length > 0 && (
              <section className="border-t border-border pt-8">
                <div className="mb-4">
                  <h2 className="label-style text-foreground">Нет данных</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Параметры без сигналов — стоит уточнить на этапе вопросов
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.gaps.map((gap, index) => (
                    <span key={index} className="border border-border px-3 py-1.5 text-xs text-muted-foreground">
                      {gap}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Footer */}
            <div className="border-t border-border pt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" onClick={runAnalysis} disabled={analyzing}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", analyzing && "animate-spin")} />
                  Пересогласовать
                </Button>
                <Button
                  onClick={() => navigate(`/project/${projectId}/board`)}
                  disabled={!allResolved && result.conflicts.length > 0}
                  title={!allResolved ? "Сначала разрешите все конфликты" : undefined}
                >
                  Перейти к концепт-борду
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              {!allResolved && result.conflicts.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Разрешите {unresolvedCount} конфликт{unresolvedCount === 1 ? "" : unresolvedCount < 5 ? "а" : "ов"}, чтобы перейти к концепту
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ConflictCardProps {
  conflict: StyleConflict;
  index: number;
  expanded: boolean;
  note: string;
  onToggle: () => void;
  onNoteChange: (note: string) => void;
  onResolve: (resolution: "accepted" | "overridden") => void;
}

const ConflictCard = ({ conflict, index, expanded, note, onToggle, onNoteChange, onResolve }: ConflictCardProps) => {
  const isResolved = !!conflict.resolution;
  const isHard = conflict.severity === "hard";

  return (
    <div className={cn(
      "border",
      isResolved ? "border-border bg-muted/30" : isHard ? "border-border" : "border-border",
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-4 p-4 text-left"
      >
        <div className="mt-0.5 shrink-0">
          {isResolved ? (
            <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className={cn("h-4 w-4", isHard ? "text-foreground" : "text-muted-foreground")} strokeWidth={1.5} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <p className={cn("text-sm", isResolved && "text-muted-foreground")}>{conflict.element}</p>
            <span className={cn(
              "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border",
              isHard ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground",
            )}>
              {isHard ? "Жёсткое" : "Мягкое"}
            </span>
            {isResolved && (
              <span className="text-[10px] uppercase tracking-wider text-primary">
                {conflict.resolution === "accepted" ? "Принята альтернатива" : "Стандарт переопределён"}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{conflict.standard_violated}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Хочет клиент</p>
              <p className="text-sm text-foreground">{conflict.client_want}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Нарушает стандарт</p>
              <p className="text-sm text-foreground">{conflict.standard_violated}</p>
            </div>
          </div>

          {conflict.alternatives.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Альтернативы</p>
              <div className="space-y-1.5">
                {conflict.alternatives.map((alt, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 shrink-0 text-[10px]">{i + 1}.</span>
                    <span>{alt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Заметка к решению (необязательно)
            </p>
            <Textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Почему принято именно это решение..."
              className="min-h-[64px] text-sm"
            />
          </div>

          {!isResolved ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                onClick={() => onResolve("accepted")}
                className="flex-1"
              >
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                Принять альтернативу
              </Button>
              {!isHard && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResolve("overridden")}
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-3.5 w-3.5" />
                  Переопределить стандарт
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Решение принято
              <button
                type="button"
                className="ml-auto underline hover:text-foreground"
                onClick={() => onResolve(conflict.resolution === "accepted" ? "accepted" : "overridden")}
              >
                Изменить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgreedStylePage;
