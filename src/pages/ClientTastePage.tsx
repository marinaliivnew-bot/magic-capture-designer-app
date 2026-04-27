import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeClientTaste, getBrief, type ClientTasteResult } from "@/lib/api";
import ProjectHeader from "@/components/ProjectHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STRENGTH_LABEL: Record<string, string> = {
  strong: "Сильный",
  moderate: "Умеренный",
  weak: "Слабый",
};

const STRENGTH_COLOR: Record<string, string> = {
  strong: "text-foreground",
  moderate: "text-muted-foreground",
  weak: "text-muted-foreground/60",
};

const SOURCE_LABEL: Record<string, string> = {
  refs: "Из референсов",
  brief: "Из брифа",
  both: "Бриф + референсы",
};

const ClientTastePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ClientTasteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const brief = await getBrief(projectId);
        const saved = (brief as any)?.client_taste_result;
        if (saved && saved.summary) {
          setResult(saved as ClientTasteResult);
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
      const data = await analyzeClientTaste(projectId);
      setResult(data);
      toast.success("Анализ вкуса клиента завершён");
    } catch (error: any) {
      toast.error(error.message || "Ошибка анализа");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
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
      <ProjectHeader projectId={projectId!} currentStep="client-taste" title="Вкус клиента" />

      <div className="mx-auto max-w-content px-12 py-16">
        <div className="mb-12 max-w-2xl">
          <h1 className="heading-style text-foreground">Интерпретация вкуса клиента</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            AI анализирует референсы и бриф, чтобы извлечь реальные предпочтения клиента —
            не то, что он говорит, а то, что на самом деле ищет.
          </p>
        </div>

        {!result && !analyzing && (
          <div className="border border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="mb-6 text-sm text-muted-foreground">
              Запустите анализ, чтобы получить профиль вкуса клиента
            </p>
            <Button onClick={runAnalysis}>
              <Sparkles className="mr-2 h-4 w-4" />
              Проанализировать вкус клиента
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="flex items-center gap-3 border border-border p-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Анализирую референсы и бриф...
          </div>
        )}

        {result && (
          <div className="space-y-10">
            <section className="border-t border-border pt-8">
              <div className="mb-6">
                <h2 className="label-style text-foreground">Резюме</h2>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-foreground whitespace-pre-line">
                {result.summary}
              </p>
            </section>

            {result.dominant_signals.length > 0 && (
              <section className="border-t border-border pt-8">
                <div className="mb-6">
                  <h2 className="label-style text-foreground">Доминирующие сигналы</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Повторяющиеся темы, которые клиент транслирует через разные источники
                  </p>
                </div>
                <div className="space-y-3">
                  {result.dominant_signals.map((item, index) => (
                    <div key={index} className="flex items-start gap-4 border border-border p-4">
                      <div className="flex-1">
                        <p className={cn("text-sm", STRENGTH_COLOR[item.strength])}>
                          {item.signal}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {STRENGTH_LABEL[item.strength] ?? item.strength} · {SOURCE_LABEL[item.source] ?? item.source}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.rejected_elements.length > 0 && (
              <section className="border-t border-border pt-8">
                <div className="mb-6">
                  <h2 className="label-style text-foreground">Что клиент отвергает</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Явные и неявные отказы — то, чего нет ни в одном референсе
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.rejected_elements.map((item, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {result.contradictions.length > 0 && (
              <section className="border-t border-border pt-8">
                <div className="mb-6">
                  <h2 className="label-style text-foreground">Внутренние противоречия</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Конфликты в запросе клиента, которые нужно разрешить до концепции
                  </p>
                </div>
                <div className="space-y-4">
                  {result.contradictions.map((item, index) => (
                    <div key={index} className="border border-border bg-card p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        <p className="text-sm text-foreground">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="border border-border px-2 py-1">{item.element_a}</span>
                        <span>vs</span>
                        <span className="border border-border px-2 py-1">{item.element_b}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="border-t border-border pt-8">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={runAnalysis}
                  disabled={analyzing}
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", analyzing && "animate-spin")} />
                  Перезапустить анализ
                </Button>
                <Button onClick={() => navigate(`/project/${projectId}/questions`)}>
                  Перейти к вопросам
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientTastePage;
