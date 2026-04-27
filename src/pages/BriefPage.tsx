import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Download, FileText, Image as ImageIcon, Loader2, Palette, Save, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeBrief, getBoardBlocks, getBrief, getIssues, getProject, getQuestions, upsertBrief } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BRIEF_SECTIONS, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import ProjectHeader from "@/components/ProjectHeader";
import RefUploadCard from "@/components/RefUploadCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress, getProgressTextColor } from "@/components/ui/progress";
import { toast } from "sonner";
import { buildStructuredUserRefs, buildTasteSummaryFromRefs, normalizeUserRefs, type UserRef } from "@/lib/user-refs";

type BriefFields = Record<string, string>;

const BRIEF_GROUPS = [
  {
    key: "lifestyle",
    title: "Клиент и образ жизни",
    description: "Собираем функциональные сценарии, состав семьи и то, как пространство должно работать каждый день.",
    fields: ["users_of_space", "scenarios", "zones", "storage"],
  },
  {
    key: "taste",
    title: "Вкус и референсы",
    description: "Фиксируем, что клиент любит, чего избегает и какие визуальные сигналы уже принёс в проект.",
    fields: ["style_likes", "style_dislikes"],
  },
  {
    key: "constraints",
    title: "Ограничения и критерии",
    description: "Оставляем только реальные рамки, ограничения и критерии, по которым потом будет понятно, что решение сработало.",
    fields: ["constraints_practical", "success_criteria"],
  },
] as const;

const BRIEF_BY_KEY = Object.fromEntries(BRIEF_SECTIONS.map((section) => [section.key, section]));

const BriefPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [brief, setBrief] = useState<BriefFields>({});
  const [userRefs, setUserRefs] = useState<UserRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [savingRefs, setSavingRefs] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const [projectData, briefData, roomData] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getRooms(projectId),
        ]);

        setProject(projectData);
        setRooms(roomData || []);

        const fields: BriefFields = {};
        BRIEF_SECTIONS.forEach(({ key }) => {
          fields[key] = (briefData as any)?.[key] || "";
        });
        const refs = normalizeUserRefs((briefData as any)?.user_refs, "project");
        const refSummary = buildTasteSummaryFromRefs(refs);
        if (!fields.style_likes?.trim() && refSummary.likesText) fields.style_likes = refSummary.likesText;
        if (!fields.style_dislikes?.trim() && refSummary.dislikesText) fields.style_dislikes = refSummary.dislikesText;
        setBrief(fields);
        setUserRefs(refs);
      } catch (error) {
        toast.error("Ошибка загрузки проекта");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId]);

  const completeness = (() => {
    const filled = BRIEF_SECTIONS.filter(({ key }) => brief[key]?.trim().length > 0).length;
    return Math.round((filled / BRIEF_SECTIONS.length) * 100);
  })();

  const saveRefs = useCallback(async (nextRefs: UserRef[]) => {
    if (!projectId) return;

    setSavingRefs(true);
    try {
      const structured = buildStructuredUserRefs(nextRefs);
      await upsertBrief(projectId, {
        user_refs: nextRefs,
        user_refs_structured: structured,
      });
    } catch (error) {
      toast.error("Не удалось сохранить референсы");
      console.error(error);
    } finally {
      setSavingRefs(false);
    }
  }, [projectId]);

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
    } catch (error) {
      console.error("Autosave error:", error);
    } finally {
      setSavingField(null);
    }
  }, [brief, completeness, projectId]);

  const handleSave = async () => {
    if (!projectId) return;

    setSaving(true);
    try {
      await upsertBrief(projectId, {
        ...brief,
        completeness_score: completeness,
      });
      toast.success("Бриф сохранён");
    } catch (error) {
      toast.error("Ошибка сохранения");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!projectId) return;

    try {
      const [issues, questions, blocks] = await Promise.all([
        getIssues(projectId),
        getQuestions(projectId),
        getBoardBlocks(projectId),
      ]);
      const briefData = {} as any;
      BRIEF_SECTIONS.forEach(({ key }) => {
        briefData[key] = brief[key] || "";
      });
      const ok = generateFullPDF(
        {
          project,
          brief: briefData,
          rooms,
          issues: issues || [],
          questions: questions || [],
          blocks: blocks || [],
        },
        { variant: "brief" },
      );
      if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
    } catch (error) {
      toast.error("Ошибка экспорта");
      console.error(error);
    }
  };

  const runAnalysis = async () => {
    if (!projectId) return;

    await handleSave();
    setAnalyzing(true);
    try {
      const briefText = BRIEF_SECTIONS.map(({ key, label }) => `### ${label}\n${brief[key] || "(пусто)"}`).join("\n\n");
      const roomsContext = rooms.length > 0
        ? rooms
            .map((room: any) => {
              const typeLabel = ROOM_TYPES.find((type) => type.value === room.room_type)?.label || room.room_type;
              let line = `- ${room.name} (${typeLabel})`;
              if (room.dimensions_text) line += `, размеры: ${room.dimensions_text}`;
              return line;
            })
            .join("\n")
        : "Не указаны";
      const planNote = project?.plan_url ? `\nК проекту прикреплён план: ${project.plan_url}` : "";
      const descriptionNote = project?.rooms_description ? `\nОписание помещений текстом: ${project.rooms_description}` : "";
      const rawNote = project?.raw_input ? `\nСырые заметки: ${project.raw_input}` : "\nСырые заметки: нет";
      const context = `Помещения:\n${roomsContext}${descriptionNote}${planNote}${rawNote}`;

      await analyzeBrief(projectId, briefText, context);
      toast.success("Анализ завершён");
      navigate(`/project/${projectId}/client-taste`);
    } catch (error: any) {
      toast.error(error.message || "Ошибка AI-анализа");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const roomCount = rooms.filter((room) => room.name?.trim()).length;
  const hasPlan = !!project?.plan_url;
  const hasRawNotes = !!project?.raw_input?.trim();
  const hasRefs = userRefs.length > 0;
  const styleFieldsFilled = !!brief.style_likes?.trim() || !!brief.style_dislikes?.trim();
  const tasteFromRefs = buildTasteSummaryFromRefs(userRefs);

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
        currentStep="brief"
        title={project?.name || "Бриф"}
      >
        <button
          onClick={() => navigate(`/project/${projectId}/edit`)}
          className="text-muted-foreground transition-colors duration-350 hover:text-foreground"
          title="Редактировать проект"
        >
          <Settings className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <Button onClick={handleExportPDF} variant="outline" size="sm" title="Экспорт брифа без концепт-борда">
          <Download className="mr-2 h-4 w-4" />
          Бриф PDF
        </Button>
      </ProjectHeader>

      <div className="mx-auto max-w-content px-12 py-16">
        <div className="mb-12 grid gap-4 md:grid-cols-4">
          <div className="border border-border bg-card p-4">
            <span className="label-style text-muted-foreground">План</span>
            <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
              {hasPlan ? <FileText className="h-4 w-4" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              {hasPlan ? "Загружен" : "Нет плана"}
            </div>
          </div>
          <div className="border border-border bg-card p-4">
            <span className="label-style text-muted-foreground">Помещения</span>
            <p className="mt-3 text-sm text-foreground">{roomCount > 0 ? `${roomCount} шт.` : "Не заполнены"}</p>
          </div>
          <div className="border border-border bg-card p-4">
            <span className="label-style text-muted-foreground">Заметки</span>
            <p className="mt-3 text-sm text-foreground">{hasRawNotes ? "Есть исходные заметки" : "Нет заметок"}</p>
          </div>
          <div className="border border-border bg-card p-4">
            <span className="label-style text-muted-foreground">Референсы</span>
            <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
              {hasRefs ? <ImageIcon className="h-4 w-4" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              {hasRefs ? `${userRefs.length} шт.` : "Не добавлены"}
            </div>
          </div>
        </div>

        <div className="mb-16">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-style text-muted-foreground">Заполненность brief-слоя</span>
            <span className={cn("label-style", getProgressTextColor(completeness))}>{completeness}%</span>
          </div>
          <Progress value={completeness} />
        </div>

        <div className="space-y-14">
          {BRIEF_GROUPS.map((group) => (
            <section key={group.key} className="border-t border-border pt-8">
              <div className="mb-8 max-w-3xl">
                <h2 className="label-style text-foreground">{group.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
              </div>

              <div className="space-y-8">
                {group.fields.map((fieldKey) => {
                  const section = BRIEF_BY_KEY[fieldKey];
                  if (!section) return null;

                  return (
                    <div key={fieldKey}>
                      <div className="mb-1 flex items-center gap-3">
                        <label className="label-style text-foreground">{section.label}</label>
                        {savingField === fieldKey && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                          </span>
                        )}
                        {savedField === fieldKey && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                            <Check className="h-3 w-3" />
                            Сохранено
                          </span>
                        )}
                      </div>
                      <p className="caption-style mb-4">{section.description}</p>
                      <Textarea
                        placeholder={`${section.label.toLowerCase()}...`}
                        value={brief[fieldKey] || ""}
                        onChange={(event) => setBrief((prev) => ({ ...prev, [fieldKey]: event.target.value }))}
                        onBlur={() => handleFieldBlur(fieldKey)}
                        className="min-h-[88px]"
                      />
                    </div>
                  );
                })}

                {group.key === "taste" && (
                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="label-style text-foreground">Референсы клиента</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Здесь собираем визуальные сигналы клиента. Карточный style narrowing остаётся отдельным шагом для уточнения вкуса.
                        </p>
                      </div>
                      <Button variant={styleFieldsFilled ? "outline" : "default"} onClick={() => navigate(`/project/${projectId}/style`)}>
                        <Palette className="mr-2 h-4 w-4" />
                        Пройти Style Narrowing
                      </Button>
                    </div>

                    {hasRefs && (tasteFromRefs.likesText || tasteFromRefs.dislikesText || tasteFromRefs.tagsText) && (
                      <div className="mb-4 rounded border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        <p className="mb-1 label-style text-foreground">Сводка из аннотаций</p>
                        {tasteFromRefs.tagsText && <p className="mt-1">Теги: {tasteFromRefs.tagsText}</p>}
                        {tasteFromRefs.likesText && <p className="mt-1 whitespace-pre-line">Нравится:<br />{tasteFromRefs.likesText}</p>}
                        {tasteFromRefs.dislikesText && <p className="mt-1 whitespace-pre-line">Не брать:<br />{tasteFromRefs.dislikesText}</p>}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      <RefUploadCard
                        refs={userRefs}
                        step="all"
                        maxRefs={12}
                        onAdd={(ref) => {
                          const nextRefs = [...userRefs, { ...ref, step: "brief" }];
                          setUserRefs(nextRefs);
                          void saveRefs(nextRefs);
                        }}
                        onRemove={(index) => {
                          const nextRefs = userRefs.filter((_, idx) => idx !== index);
                          setUserRefs(nextRefs);
                          void saveRefs(nextRefs);
                        }}
                        onUpdate={(index, nextRef) => {
                          const nextRefs = userRefs.map((ref, idx) => (idx === index ? nextRef : ref));
                          setUserRefs(nextRefs);
                          void saveRefs(nextRefs);
                        }}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {hasRefs ? `Референсов: ${userRefs.length}` : "Пока без референсов"}
                      </p>
                      {savingRefs && (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Сохраняю
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <div className="mb-6">
            <h3 className="label-style text-foreground">Следующий шаг</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              После анализа система извлечёт вкус клиента, выделит противоречия с вашими стандартами и подготовит уточняющие вопросы.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Сохранить
            </Button>
            <Button variant="outline" disabled={analyzing || saving} onClick={runAnalysis} className="flex-1">
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {analyzing ? "Анализирую..." : "Перейти к вопросам"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BriefPage;
