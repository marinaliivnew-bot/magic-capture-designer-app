import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { getBrief, getProject, upsertBrief, analyzeBrief, getBoardBlocks, getIssues, getQuestions } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BRIEF_SECTIONS, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import ProjectHeader from "@/components/ProjectHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress, getProgressTextColor } from "@/components/ui/progress";
import { toast } from "sonner";
import { Search, LayoutGrid, Save, Loader2, Sparkles, Settings, Palette, Download, Check } from "lucide-react";

const STYLE_NARROWING_PREFIX = "【Из Style Narrowing】";

const BriefPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [brief, setBrief] = useState<Record<string, string>>({});
  const [userRefs, setUserRefs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [p, b, r] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getRooms(projectId),
        ]);
        setProject(p);
        setRooms(r || []);
        if (b) {
          const fields: Record<string, string> = {};
          BRIEF_SECTIONS.forEach(({ key }) => {
            fields[key] = (b as any)[key] || "";
          });
          setBrief(fields);
          setUserRefs(Array.isArray((b as any).user_refs) ? (b as any).user_refs : []);
        }
      } catch (e) {
        toast.error("Ошибка загрузки проекта");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const completeness = (() => {
    const filled = BRIEF_SECTIONS.filter(
      ({ key }) => brief[key]?.trim().length > 0
    ).length;
    return Math.round((filled / BRIEF_SECTIONS.length) * 100);
  })();

  const handleFieldBlur = useCallback(async (key: string) => {
    if (!projectId) return;
    setSavingField(key);
    try {
      await upsertBrief(projectId, {
        [key]: brief[key] || "",
        completeness_score: completeness,
      });
      setSavedField(key);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSavedField(null), 2000);
    } catch (e) {
      console.error("Autosave error:", e);
    } finally {
      setSavingField(null);
    }
  }, [projectId, brief, completeness]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await upsertBrief(projectId, {
        ...brief,
        completeness_score: completeness,
      });
      toast.success("Бриф сохранён");
    } catch (e) {
      toast.error("Ошибка сохранения");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!projectId) return;
    try {
      const [iss, qs, bb] = await Promise.all([
        getIssues(projectId),
        getQuestions(projectId),
        getBoardBlocks(projectId),
      ]);
      const briefData = {} as any;
      BRIEF_SECTIONS.forEach(({ key }) => {
        briefData[key] = brief[key] || "";
      });
      const ok = generateFullPDF({
        project,
        brief: briefData,
        rooms,
        issues: iss || [],
        questions: qs || [],
        blocks: bb || [],
      }, { variant: "brief" });
      if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
    } catch (e) {
      toast.error("Ошибка экспорта");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasStyleNarrowing = (value: string) => value.includes("Стили:") || value.includes("Цвет:") || value.includes("Материалы:");

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader
        projectId={projectId!}
        currentStep="brief"
        title={project?.name || "Бриф"}
      >
        <button
          onClick={() => navigate(`/project/${projectId}/edit`)}
          className="text-muted-foreground hover:text-foreground transition-colors duration-350"
          title="Редактировать проект"
        >
          <Settings className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <Button onClick={handleExportPDF} variant="outline" size="sm" title="Экспорт брифа и вопросов без концепт-борда">
          <Download className="mr-2 h-4 w-4" />
          ↓ Бриф PDF
        </Button>
      </ProjectHeader>

      <div className="mx-auto max-w-content px-12 py-16">
        {/* Completeness */}
        <div className="mb-16">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-style text-muted-foreground">Заполненность</span>
            <span className={cn("label-style", getProgressTextColor(completeness))}>{completeness}%</span>
          </div>
          <Progress value={completeness} />
        </div>

        {/* Brief sections */}
        <div className="divide-y divide-border">
          {BRIEF_SECTIONS.map(({ key, label, description }) => (
            <div key={key} className="py-8">
              <div className="flex items-center gap-3 mb-1">
                <label className="label-style text-foreground block">
                  {label}
                </label>
                {(key === "style_likes" || key === "style_dislikes") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/project/${projectId}/style`)}
                    className="text-[10px] px-2 py-1 h-auto"
                  >
                    <Palette className="mr-1 h-3 w-3" />
                    Пройти Style Narrowing
                  </Button>
                )}
                {/* Save indicator */}
                {savingField === key && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </span>
                )}
                {savedField === key && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                    <Check className="h-3 w-3" /> Сохранено
                  </span>
                )}
              </div>
              {/* Style Narrowing tag */}
              {key === "style_likes" && hasStyleNarrowing(brief[key] || "") && (
                <span className="inline-block mb-2 px-2 py-0.5 text-[10px] border border-primary/30 text-primary rounded">
                  Из Style Narrowing
                </span>
              )}
              <p className="caption-style mb-4">{description}</p>
              <Textarea
                placeholder={`${label.toLowerCase()}...`}
                value={brief[key] || ""}
                onChange={(e) =>
                  setBrief((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onBlur={() => handleFieldBlur(key)}
                className="min-h-[80px]"
              />
            </div>
          ))}
        </div>

        {/* User refs preview */}
        {userRefs.length > 0 && (
          <div className="mt-16">
            <span className="label-style text-muted-foreground block mb-4">Загруженные референсы</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {userRefs.map((ref: any, idx: number) => (
                <div key={ref.url || idx} className="group relative overflow-hidden border border-border">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    <img
                      src={ref.url}
                      alt={`Референс ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {ref.step && (
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-muted-foreground capitalize">{ref.step}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-16 border-t border-border pt-8 flex flex-col gap-4 sm:flex-row">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить
          </Button>
          <Button
            variant="outline"
            disabled={analyzing || saving}
            onClick={async () => {
              if (!projectId) return;
              await handleSave();
              setAnalyzing(true);
              try {
                const briefText = BRIEF_SECTIONS.map(
                  ({ key, label }) => `### ${label}\n${brief[key] || "(пусто)"}`
                ).join("\n\n");
                const roomsContext = rooms.length > 0
                  ? rooms.map((r: any) => {
                      const typeLabel = ROOM_TYPES.find(t => t.value === r.room_type)?.label || r.room_type;
                      let line = `- ${r.name} (${typeLabel})`;
                      if (r.dimensions_text) line += `, размеры: ${r.dimensions_text}`;
                      return line;
                    }).join("\n")
                  : "Не указаны";
                const planNote = project?.plan_url ? `\nК проекту прикреплён план: ${project.plan_url}` : "";
                const descNote = project?.rooms_description ? `\nОписание помещений текстом: ${project.rooms_description}` : "";
                const context = `Помещения:\n${roomsContext}${descNote}${planNote}\nЗаметки: ${project?.raw_input || "нет"}`;
                await analyzeBrief(projectId, briefText, context);
                toast.success("Анализ завершён");
                navigate(`/project/${projectId}/questions`);
              } catch (e: any) {
                toast.error(e.message || "Ошибка AI-анализа");
                console.error(e);
              } finally {
                setAnalyzing(false);
              }
            }}
            className="flex-1"
          >
            {analyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {analyzing ? "Анализирую…" : "AI-анализ"}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/board`)}
            className="flex-1"
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Концепт-борд
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BriefPage;
