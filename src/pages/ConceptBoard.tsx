import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBoardBlocks, getProject, getBrief, getIssues, getQuestions, updateBoardBlock, updateBoardImage, generateBoard } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BOARD_BLOCK_TYPES, BRIEF_SECTIONS, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import { getBlockRationale, getClientReferenceAnalysis, getReferenceCoverage, getStyleConsistency } from "@/lib/concept-rationale";
import ProjectHeader from "@/components/ProjectHeader";
import ColorChip from "@/components/ColorChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  FileDown,
  ImageIcon,
  Pencil,
  ExternalLink,
  Sparkles,
  ArrowLeft,
  Download,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

type ImageLoadStatus = "loading" | "ok" | "failed" | "missing";

const IMAGE_STATUS_LABELS: Record<ImageLoadStatus, string> = {
  loading: "загрузка",
  ok: "ok",
  failed: "ошибка",
  missing: "нет URL",
};

const REQUIRED_IMAGE_BLOCKS = new Set(["atmosphere", "materials", "furniture", "lighting"]);

const IMAGE_SOURCE_LABELS: Record<string, string> = {
  client_reference: "клиентский",
  designer_reference: "дизайнерский",
  master_reference: "мастер",
  generated_reference: "generated",
  stock_reference: "stock",
  unsplash_auto: "Unsplash auto",
  user_upload: "ручной",
};

function validateImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return Promise.reject(new Error("URL изображения пустой"));

  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Изображение не загрузилось за 8 секунд"));
    }, 8000);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Изображение недоступно по указанному URL"));
    };
    image.src = trimmed;
  });
}

const ConceptBoard = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [imageStatuses, setImageStatuses] = useState<Record<string, ImageLoadStatus>>({});

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [p, b, bb, rms, iss, qs] = await Promise.all([
        getProject(projectId),
        getBrief(projectId),
        getBoardBlocks(projectId),
        getRooms(projectId),
        getIssues(projectId),
        getQuestions(projectId),
      ]);
      setProject(p);
      setBrief(b);
      setBlocks(bb || []);
      setRooms(rms || []);
      setIssues(iss || []);
      setQuestions(qs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    setImageStatuses((prev) => {
      const next: Record<string, ImageLoadStatus> = {};
      blocks.forEach((block) => {
        (block.board_images || []).forEach((img: any) => {
          next[img.id] = prev[img.id] || (img.url ? "loading" : "missing");
        });
      });
      return next;
    });
  }, [blocks]);

  const getBlockLabel = (type: string) =>
    BOARD_BLOCK_TYPES.find((b) => b.type === type)?.label || type;

  const clientReferenceAnalysis = getClientReferenceAnalysis(brief);
  const referenceCoverage = getReferenceCoverage(brief, blocks);
  const styleConsistency = getStyleConsistency(brief, blocks);
  const styleConflictsByBlock = new Map(
    styleConsistency.conflicts.map((conflict) => [conflict.blockType, conflict])
  );

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const [freshBrief, freshRooms, freshQuestions] = await Promise.all([
        getBrief(projectId),
        getRooms(projectId),
        getQuestions(projectId),
      ]);

      const briefText = freshBrief
        ? BRIEF_SECTIONS.map(
            ({ key, label }) => `### ${label}\n${(freshBrief as any)[key] || "(пусто)"}`
          ).join("\n\n")
        : "(бриф не заполнен)";

      // Rooms context
      const roomsContext = freshRooms && freshRooms.length > 0
        ? freshRooms.map((r: any) => {
            const typeLabel = ROOM_TYPES.find(t => t.value === r.room_type)?.label || r.room_type;
            let line = `- ${r.name} (${typeLabel})`;
            if (r.dimensions_text) line += `, размеры: ${r.dimensions_text}`;
            return line;
          }).join("\n")
        : "Не указаны";

      const planNote = project?.plan_url ? `\nПлан помещения: ${project.plan_url}` : "";
      const descNote = project?.rooms_description ? `\nОписание: ${project.rooms_description}` : "";
      
      const usersInfo = (freshBrief as any)?.users_of_space ? `\nСостав семьи и пользователи: ${(freshBrief as any).users_of_space}` : "";
      const scenariosInfo = (freshBrief as any)?.scenarios ? `\nСценарии: ${(freshBrief as any).scenarios}` : "";
      const styleLikes = (freshBrief as any)?.style_likes ? `\nСтилевые предпочтения: ${(freshBrief as any).style_likes}` : "";
      const styleDislikes = (freshBrief as any)?.style_dislikes ? `\nАнтипатии: ${(freshBrief as any).style_dislikes}` : "";
      const constraintsPractical = (freshBrief as any)?.constraints_practical ? `\nОграничения: ${(freshBrief as any).constraints_practical}` : "";

      // Answered questions
      const answeredQs = (freshQuestions || []).filter((q: any) => q.answer?.trim());
      const answeredBlock = answeredQs.length > 0
        ? `\n\nОТВЕТЫ КЛИЕНТА НА УТОЧНЯЮЩИЕ ВОПРОСЫ:\n${answeredQs.map((q: any) => `- Вопрос: ${q.text}\n  Ответ: ${q.answer}`).join("\n")}`
        : "";

      // Style narrowing result
      const styleNarrowingResult = (freshBrief as any)?.style_narrowing_result;
      const styleNarrowingBlock = styleNarrowingResult
        ? `\n\nРЕЗУЛЬТАТЫ STYLE NARROWING:\n${JSON.stringify(styleNarrowingResult)}`
        : "";

      const context = `РАЗМЕРЫ ПОМЕЩЕНИЙ:\n${roomsContext}${descNote}${planNote}${usersInfo}${scenariosInfo}${styleLikes}${styleDislikes}${constraintsPractical}${answeredBlock}${styleNarrowingBlock}\n\nЗаметки: ${project?.raw_input || "нет"}`;

      await generateBoard(projectId, briefText, context);
      
      const freshBlocks = await getBoardBlocks(projectId);
      setBlocks(freshBlocks || []);
      toast.success("Концепт-борд сгенерирован");
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации борда");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCaption = async (blockId: string, caption: string) => {
    try {
      const currentBlock = blocks.find((block) => block.id === blockId);
      await updateBoardBlock(blockId, {
        caption,
        caption_source: "manual",
        original_ai_caption: currentBlock?.original_ai_caption || currentBlock?.caption || null,
      });
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                caption,
                caption_source: "manual",
                original_ai_caption: b.original_ai_caption || b.caption || null,
              }
            : b
        )
      );
      setEditingCaption(null);
      toast.success("Сохранено");
    } catch {
      toast.error("Ошибка сохранения");
    }
  };

  const handleReplaceImage = async (imageId: string, url: string) => {
    const nextUrl = url.trim();
    setImageStatuses((prev) => ({ ...prev, [imageId]: nextUrl ? "loading" : "missing" }));
    try {
      await validateImageUrl(nextUrl);
      await updateBoardImage(imageId, { url: nextUrl, source_type: "user_upload" });
      setBlocks((prev) =>
        prev.map((b) => ({
          ...b,
          board_images: b.board_images?.map((img: any) =>
            img.id === imageId ? { ...img, url: nextUrl, source_type: "user_upload" } : img
          ),
        }))
      );
      setImageStatuses((prev) => ({ ...prev, [imageId]: "ok" }));
      setEditingImageUrl(null);
      toast.success("Изображение обновлено");
    } catch (e: any) {
      setImageStatuses((prev) => ({ ...prev, [imageId]: nextUrl ? "failed" : "missing" }));
      toast.error(e?.message || "Изображение недоступно, URL не сохранен");
    }
  };

  const handleExportPDF = () => {
    const brokenRequiredImages = blocks.flatMap((block) => {
      if (!REQUIRED_IMAGE_BLOCKS.has(block.block_type)) return [];
      return (block.board_images || []).filter((img: any) => {
        const status = imageStatuses[img.id] || (img.url ? "loading" : "missing");
        return status === "failed" || status === "missing";
      });
    });
    if (brokenRequiredImages.length > 0) {
      toast.error("PDF не экспортирован: в обязательных блоках есть отсутствующие или недоступные изображения");
      return;
    }

    const ok = generateFullPDF({ project, brief, rooms, issues, questions, blocks }, { variant: "working" });
    if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
  };

  const handleSetMasterReference = async (imageId: string) => {
    try {
      const previousMasters = blocks.flatMap((block) =>
        (block.board_images || []).filter((img: any) => img.source_type === "master_reference")
      );
      await Promise.all([
        ...previousMasters
          .filter((img: any) => img.id !== imageId)
          .map((img: any) => updateBoardImage(img.id, { source_type: "client_reference" })),
        updateBoardImage(imageId, { source_type: "master_reference" }),
      ]);
      setBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          board_images: block.board_images?.map((img: any) => ({
            ...img,
            source_type:
              img.id === imageId
                ? "master_reference"
                : img.source_type === "master_reference"
                  ? "client_reference"
                  : img.source_type,
          })),
        }))
      );
      toast.success("Мастер-референс зафиксирован");
    } catch {
      toast.error("Ошибка сохранения мастер-референса");
    }
  };

  const handleUpdateImageSource = async (imageId: string, sourceType: string) => {
    try {
      await updateBoardImage(imageId, { source_type: sourceType });
      setBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          board_images: block.board_images?.map((img: any) =>
            img.id === imageId ? { ...img, source_type: sourceType } : img
          ),
        }))
      );
      toast.success("Источник изображения обновлен");
    } catch {
      toast.error("Ошибка сохранения источника");
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
      <ProjectHeader
        projectId={projectId!}
        currentStep="board"
        title="Концепт-борд"
        projectName={project?.name}
      >
        <Button onClick={handleExportPDF} variant="outline" size="sm" title="Рабочий отчет: бриф + вопросы + концепт-борд">
          <Download className="mr-2 h-4 w-4" />
          ↓ Рабочий отчет PDF
        </Button>
      </ProjectHeader>

      <div className="mx-auto max-w-content px-12 py-16">
        {/* Generate button */}
        <div className="mb-16 flex justify-end">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Генерирую…" : blocks.length > 0 ? "Перегенерировать" : "Сгенерировать"}
          </Button>
        </div>

        {blocks.length === 0 && !generating ? (
          <div className="py-24 text-center">
            <p className="font-display text-2xl italic text-muted-foreground">
              Борд пока пуст
            </p>
            <Button variant="ghost" className="mt-6" onClick={handleGenerate}>
              Сгенерировать борд
            </Button>
          </div>
        ) : generating ? (
          <div className="py-24 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-6 caption-style">AI генерирует концепт-борд…</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <section id="style-formula" className="scroll-mt-24 pb-12">
              <div className="border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="label-style text-foreground">Стилевая формула проекта</p>
                    <p className="mt-2 max-w-3xl text-[14px] font-light text-muted-foreground">
                      {styleConsistency.formula.phrase}
                    </p>
                  </div>
                  {styleConsistency.master ? (
                    <span className="inline-flex items-center gap-2 text-[12px] font-medium text-primary">
                      <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
                      Мастер: {getBlockLabel(styleConsistency.master.blockType)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[12px] font-medium text-amber-700">
                      <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                      Мастер-референс не выбран
                    </span>
                  )}
                </div>
                {styleConsistency.formula.terms.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {styleConsistency.formula.terms.slice(0, 10).map((term) => (
                      <span key={term} className="border border-border px-2 py-1 text-[12px] text-muted-foreground">
                        {term}
                      </span>
                    ))}
                  </div>
                )}
                {styleConsistency.conflicts.length > 0 && (
                  <div className="mt-4 space-y-2 border-l-2 border-amber-500 pl-4">
                    {styleConsistency.conflicts.map((conflict) => (
                      <p key={`${conflict.blockType}-${conflict.reason}`} className="text-[13px] font-light text-amber-700">
                        {getBlockLabel(conflict.blockType)}: {conflict.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {clientReferenceAnalysis.length > 0 && (
              <section id="reference-match-matrix" className="scroll-mt-24 pb-12">
                <h3 className="mb-6 text-foreground">Разбор клиентских референсов</h3>
                <div className="mb-6 border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[14px] font-medium text-foreground">Матрица соответствия</p>
                    <span className="text-[12px] text-muted-foreground">
                      Учтено {referenceCoverage.usedCount} из {referenceCoverage.signalCount} сигналов
                    </span>
                  </div>
                  <div className="mt-4 divide-y divide-border">
                    {referenceCoverage.rows.map((row) => (
                      <div key={row.id} className="grid gap-4 py-4 text-[13px] sm:grid-cols-4">
                        <div>
                          <p className="font-medium text-foreground">{row.label}</p>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-primary underline-offset-4 hover:underline"
                          >
                            источник
                          </a>
                        </div>
                        <p className="font-light text-muted-foreground">
                          <span className="font-medium text-foreground">Признаки:</span>{" "}
                          {row.extractedSignals.join(", ") || "не извлечены"}
                        </p>
                        <p className="font-light text-muted-foreground">
                          <span className="font-medium text-foreground">Использовано:</span>{" "}
                          {row.usedInConcept.join("; ") || "не найдено в борде"}
                        </p>
                        <p className="font-light text-muted-foreground">
                          <span className="font-medium text-foreground">Исключено / уточнить:</span>{" "}
                          {[...row.excluded.map((item) => `не берем: ${item}`), ...row.needsClarification.map((item) => `уточнить: ${item}`)].join("; ") || "нет"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4">
                  {clientReferenceAnalysis.map((ref) => (
                    <div key={ref.id} className="border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[14px] font-medium text-foreground">{ref.label}</span>
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-primary underline-offset-4 hover:underline"
                        >
                          Открыть источник
                        </a>
                      </div>
                      <div className="mt-3 grid gap-2 text-[13px] font-light text-muted-foreground sm:grid-cols-3">
                        <p><span className="font-medium text-foreground">Берем:</span> {ref.take || "не зафиксировано"}</p>
                        <p><span className="font-medium text-foreground">Не берем:</span> {ref.reject || "не зафиксировано"}</p>
                        <p><span className="font-medium text-foreground">Уточнить:</span> {ref.clarify || "не требуется"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {blocks.map((block) => (
              <div key={block.id} id={`block-${block.block_type}`} className="scroll-mt-24 py-12">
                <h3 className="mb-6 text-foreground">
                  {getBlockLabel(block.block_type)}
                </h3>
                {styleConflictsByBlock.has(block.block_type) && (
                  <div className="mb-6 flex gap-3 border border-amber-500/40 bg-amber-50 p-3 text-[13px] text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <p>{styleConflictsByBlock.get(block.block_type)?.reason}</p>
                  </div>
                )}
                {getBlockRationale(block, brief).length > 0 && (
                  <div className="mb-6 border-l-2 border-primary/40 pl-4">
                    <p className="label-style text-foreground">Почему это здесь</p>
                    <ul className="mt-2 space-y-1 text-[13px] font-light text-muted-foreground">
                      {getBlockRationale(block, brief).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    {block.caption_source === "manual" && (
                      <p className="mt-2 text-[12px] font-medium text-primary">Ручная правка дизайнера</p>
                    )}
                  </div>
                )}

                {/* Palette block: color chips grid */}
                {block.block_type === "palette" && Array.isArray(block.color_chips) && block.color_chips.length > 0 ? (
                  <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
                ) : block.block_type === "palette" ? (
                  <p className="mb-6 text-sm text-muted-foreground italic">
                    Цветовые чипы появятся после генерации борда
                  </p>
                ) : (
                  /* Other blocks: photo grid */
                  <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {block.board_images?.map((img: any) => {
                      const status = imageStatuses[img.id] || (img.url ? "loading" : "missing");
                      const statusClass =
                        status === "ok"
                          ? "bg-emerald-600 text-white"
                          : status === "loading"
                            ? "bg-card/90 text-foreground"
                            : "bg-destructive text-destructive-foreground";

                      return (
                      <div key={img.id} className="group relative">
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
                          {img.url ? (
                            <img
                              src={img.url}
                              alt={block.caption || ""}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onLoad={() => setImageStatuses((prev) => ({ ...prev, [img.id]: "ok" }))}
                              onError={() => setImageStatuses((prev) => ({ ...prev, [img.id]: "failed" }))}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                              <ImageIcon className="h-8 w-8" strokeWidth={1} />
                              <span className="text-[11px] uppercase tracking-widest">нет изображения</span>
                            </div>
                          )}
                        </div>

                        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass}`}>
                          {status === "loading" && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />}
                          {IMAGE_STATUS_LABELS[status]}
                        </span>

                        <span className="absolute right-2 bottom-2 max-w-[55%] truncate bg-card/90 px-2 py-0.5 text-[10px] font-medium text-foreground">
                          {IMAGE_SOURCE_LABELS[img.source_type] || img.source_type || "источник не указан"}
                        </span>

                        {img.note && (
                          <span className="absolute bottom-2 left-2 max-w-[40%] truncate bg-foreground/70 px-2 py-0.5 text-[10px] font-medium text-background">
                            {img.note}
                          </span>
                        )}

                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-350 group-hover:opacity-100">
                          <button
                            className="flex h-7 w-7 items-center justify-center bg-card/90 border border-border text-foreground hover:text-primary transition-colors"
                            onClick={() =>
                              setEditingImageUrl(editingImageUrl === img.id ? null : img.id)
                            }
                          >
                            <Pencil className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                          <button
                            className="flex h-7 w-7 items-center justify-center bg-card/90 border border-border text-foreground hover:text-primary transition-colors"
                            onClick={() => handleSetMasterReference(img.id)}
                            title="Сделать мастер-референсом"
                          >
                            <CheckCircle className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                          {img.source_url && (
                            <a href={img.source_url} target="_blank" rel="noopener noreferrer">
                              <span className="flex h-7 w-7 items-center justify-center bg-card/90 border border-border text-foreground hover:text-primary transition-colors">
                                <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                              </span>
                            </a>
                          )}
                        </div>

                        {editingImageUrl === img.id && (
                          <div className="mt-2 space-y-2">
                            <Input
                              placeholder="URL изображения"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleReplaceImage(img.id, (e.target as HTMLInputElement).value);
                                }
                              }}
                            />
                            <select
                              value={img.source_type || "designer_reference"}
                              onChange={(e) => handleUpdateImageSource(img.id, e.target.value)}
                              className="h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground"
                            >
                              <option value="client_reference">Клиентский референс</option>
                              <option value="designer_reference">Референс дизайнера</option>
                              <option value="user_upload">Ручная загрузка</option>
                              <option value="generated_reference">Сгенерированный визуал</option>
                              <option value="stock_reference">Стоковый референс</option>
                              <option value="unsplash_auto">Unsplash auto</option>
                            </select>
                          </div>
                        )}

                        {img.source_type === "master_reference" && (
                          <span className="absolute left-2 top-8 bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            мастер
                          </span>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Caption */}
                {editingCaption === block.id ? (
                  <Textarea
                    defaultValue={block.caption || ""}
                    onBlur={(e) => handleSaveCaption(block.id, e.target.value)}
                    autoFocus
                  />
                ) : (
                  <p
                    className="cursor-pointer text-[15px] font-light text-muted-foreground hover:text-foreground transition-colors duration-350"
                    onClick={() => setEditingCaption(block.id)}
                  >
                    {block.caption || "Нажмите, чтобы добавить описание..."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-16 border-t border-border pt-8 flex flex-col gap-4 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/questions`)}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Вопросы
          </Button>
          <Button
            onClick={() => navigate(`/project/${projectId}/export`)}
            className="flex-1"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Подготовить приложение к договору
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConceptBoard;
