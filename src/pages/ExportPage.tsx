import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, getBrief, getIssues, getQuestions, getBoardBlocks } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BRIEF_SECTIONS, BOARD_BLOCK_TYPES, PRIORITY_CONFIG, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import ProjectHeader from "@/components/ProjectHeader";
import ColorChip from "@/components/ColorChip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download, CheckCircle, ArrowLeft } from "lucide-react";

const ExportPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<"draft" | "approved">("draft");

  useEffect(() => {
    if (!projectId) return;
    const saved = localStorage.getItem(`project_${projectId}_approval`);
    if (saved === "approved") setApprovalStatus("approved");

    const load = async () => {
      try {
        const [p, b, iss, qs, bb, rms] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getIssues(projectId),
          getQuestions(projectId),
          getBoardBlocks(projectId),
          getRooms(projectId),
        ]);
        setProject(p);
        setBrief(b);
        setIssues(iss || []);
        setQuestions(qs || []);
        setBlocks(bb || []);
        setRooms(rms || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const toggleApproval = () => {
    const next = approvalStatus === "draft" ? "approved" : "draft";
    setApprovalStatus(next);
    localStorage.setItem(`project_${projectId}_approval`, next);
    toast.success(next === "approved" ? "Концепт утверждён" : "Статус утверждения снят");
  };

  const handleExportPDF = () => {
    const ok = generateFullPDF(
      { project, brief, rooms, issues, questions, blocks },
      { variant: "full", approvalStatus }
    );
    if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
  };

  const getBlockLabel = (type: string) =>
    BOARD_BLOCK_TYPES.find((b) => b.type === type)?.label || type;

  const constraints = (project?.constraints as Record<string, string>) || {};

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const mainBriefSections = BRIEF_SECTIONS.filter((s) => s.key !== "success_criteria");

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader
        projectId={projectId!}
        currentStep="export"
        title="Экспорт"
        projectName={project?.name}
      >
        <div className="flex items-center gap-3">
          <Badge
            variant={approvalStatus === "approved" ? "default" : "outline"}
            className="text-[11px]"
          >
            {approvalStatus === "approved" ? "Утверждено" : "Черновик"}
          </Badge>
          <Button onClick={toggleApproval} variant="outline" size="sm">
            <CheckCircle className="mr-2 h-4 w-4" />
            {approvalStatus === "approved" ? "Снять утверждение" : "Утвердить концепт"}
          </Button>
          <Button onClick={handleExportPDF} size="sm">
            <Download className="mr-2 h-4 w-4" />
            ↓ Скачать PDF
          </Button>
        </div>
      </ProjectHeader>

      <div className="mx-auto max-w-content px-12 py-16 space-y-16">
        {/* Заголовок */}
        <div className="text-center">
          <h1 className="text-foreground">{project?.name}</h1>
          <p className="mt-4 caption-style">{new Date().toLocaleDateString("ru-RU")}</p>
        </div>

        {/* Критерии успеха — выносим наверх */}
        {brief?.success_criteria && (
          <section>
            <h2 className="mb-6 text-foreground">Критерии успеха</h2>
            <p className="text-[15px] font-light text-muted-foreground">{brief.success_criteria}</p>
          </section>
        )}

        {/* Данные проекта: бюджет / сроки / табу */}
        {(constraints.budget || constraints.timeline || constraints.taboos || constraints.must_haves) && (
          <section>
            <h2 className="mb-6 text-foreground">Данные проекта</h2>
            <div className="divide-y divide-border">
              {constraints.budget && (
                <div className="py-4">
                  <span className="label-style text-foreground">Бюджет и ограничения</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{constraints.budget}</p>
                </div>
              )}
              {constraints.timeline && (
                <div className="py-4">
                  <span className="label-style text-foreground">Сроки</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{constraints.timeline}</p>
                </div>
              )}
              {constraints.taboos && (
                <div className="py-4">
                  <span className="label-style text-foreground">Табу</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{constraints.taboos}</p>
                </div>
              )}
              {constraints.must_haves && (
                <div className="py-4">
                  <span className="label-style text-foreground">Must-have</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{constraints.must_haves}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Помещения с размерами */}
        {rooms.length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Помещения</h2>
            <div className="divide-y divide-border">
              {rooms.map((r: any) => {
                const typeLabel = ROOM_TYPES.find((t) => t.value === r.room_type)?.label || r.room_type;
                return (
                  <div key={r.id} className="py-3 flex items-baseline justify-between gap-4">
                    <span className="text-[15px] font-light">
                      {r.name}{" "}
                      <span className="text-muted-foreground">({typeLabel})</span>
                    </span>
                    {r.dimensions_text && (
                      <span className="label-style text-muted-foreground whitespace-nowrap">
                        {r.dimensions_text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Бриф */}
        <section>
          <h2 className="mb-6 text-foreground">Бриф</h2>
          <div className="divide-y divide-border">
            {mainBriefSections.map(({ key, label }) => (
              <div key={key} className="py-6">
                <span className="label-style text-foreground">{label}</span>
                <p className="mt-2 text-[15px] font-light text-muted-foreground">
                  {brief?.[key] || "не указано"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Противоречия */}
        {issues.filter((i) => i.type === "contradiction").length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Противоречия</h2>
            <div className="divide-y divide-border">
              {issues
                .filter((i) => i.type === "contradiction")
                .map((issue) => (
                  <div key={issue.id} className="py-6">
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

        {/* Вопросы */}
        {questions.length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Уточняющие вопросы</h2>
            <div className="divide-y divide-border">
              {questions.map((q) => (
                <div key={q.id} className="py-4">
                  <div className="flex items-center gap-3">
                    <span className="label-style text-muted-foreground">
                      [{PRIORITY_CONFIG[q.priority as keyof typeof PRIORITY_CONFIG]?.label || q.priority}]
                    </span>
                    <span className="text-[15px] font-light text-foreground">{q.text}</span>
                  </div>
                  {q.answer && (
                    <p className="mt-1 text-[15px] text-primary font-light">Ответ: {q.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Концепт-борд */}
        {blocks.length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Концепт-борд</h2>
            <div className="divide-y divide-border">
              {blocks.map((block) => (
                <div key={block.id} className="py-10">
                  <h3 className="mb-4 text-foreground">{getBlockLabel(block.block_type)}</h3>
                  {block.caption && (
                    <p className="mb-6 text-[15px] font-light text-muted-foreground">{block.caption}</p>
                  )}

                  {/* Палитра: цветовые чипы */}
                  {block.block_type === "palette" &&
                    Array.isArray(block.color_chips) &&
                    block.color_chips.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                        {block.color_chips.map((chip: any, i: number) => (
                          <ColorChip
                            key={i}
                            hex={chip.hex}
                            name={chip.name}
                            role={chip.role}
                            ral={chip.ral}
                          />
                        ))}
                      </div>
                    )}

                  {/* Освещение: зоны */}
                  {block.block_type === "lighting" &&
                    Array.isArray(block.lighting_zones) &&
                    block.lighting_zones.length > 0 && (
                      <div className="mb-6 divide-y divide-border">
                        {block.lighting_zones.map((zone: any, i: number) => (
                          <div key={i} className="flex flex-wrap gap-4 py-3 text-[13px]">
                            <span className="font-medium">{zone.zone}</span>
                            <span className="text-muted-foreground">{zone.scenario}</span>
                            <span className="text-muted-foreground">{zone.type}</span>
                            <span className="font-mono text-muted-foreground">{zone.kelvin}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Изображения для остальных блоков */}
                  {block.block_type !== "palette" &&
                    block.board_images?.filter((img: any) => img.url).length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-3">
                        {block.board_images
                          .filter((img: any) => img.url)
                          .map((img: any) => (
                            <div key={img.id}>
                              <img
                                src={img.url}
                                alt={img.note || ""}
                                className="aspect-[4/3] w-full object-cover"
                                loading="lazy"
                              />
                              {img.note && (
                                <p className="mt-1 text-[12px] text-muted-foreground">{img.note}</p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Блок согласования */}
        <section className="border-t border-border pt-12">
          <h2 className="mb-8 text-foreground">Согласование</h2>
          <div className="grid grid-cols-2 gap-16">
            <div>
              <p className="label-style text-muted-foreground mb-12">Дизайнер</p>
              <div className="border-b border-foreground/30 mb-2" />
              <p className="caption-style text-muted-foreground">Подпись / дата</p>
            </div>
            <div>
              <p className="label-style text-muted-foreground mb-12">Клиент</p>
              <div className="border-b border-foreground/30 mb-2" />
              <p className="caption-style text-muted-foreground">Подпись / дата</p>
            </div>
          </div>
        </section>

        {/* Футер со статусом */}
        <p className="text-center caption-style italic">
          {approvalStatus === "approved"
            ? `Утверждённая версия · Приложение к договору · ${new Date().toLocaleDateString("ru-RU")}`
            : `Draft concept, requires designer review · ${new Date().toLocaleDateString("ru-RU")}`}
        </p>

        {/* Навигация */}
        <div className="border-t border-border pt-8">
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/board`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Концепт-борд
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
