import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBoardBlocks, getProject, getBrief, getIssues, getQuestions, updateBoardBlock, updateBoardImage, generateBoard } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BOARD_BLOCK_TYPES, BRIEF_SECTIONS, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import ProjectHeader from "@/components/ProjectHeader";
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
} from "lucide-react";

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

  const getBlockLabel = (type: string) =>
    BOARD_BLOCK_TYPES.find((b) => b.type === type)?.label || type;

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const [freshBrief, freshRooms] = await Promise.all([
        getBrief(projectId),
        getRooms(projectId),
      ]);

      const briefText = freshBrief
        ? BRIEF_SECTIONS.map(
            ({ key, label }) => `### ${label}\n${(freshBrief as any)[key] || "(пусто)"}`
          ).join("\n\n")
        : "(бриф не заполнен)";

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
      
      const context = `Помещения проекта:\n${roomsContext}${descNote}${planNote}${usersInfo}${scenariosInfo}${styleLikes}${styleDislikes}${constraintsPractical}\nЗаметки: ${project?.raw_input || "нет"}`;

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
      await updateBoardBlock(blockId, { caption });
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, caption } : b))
      );
      setEditingCaption(null);
      toast.success("Сохранено");
    } catch {
      toast.error("Ошибка сохранения");
    }
  };

  const handleReplaceImage = async (imageId: string, url: string) => {
    try {
      await updateBoardImage(imageId, { url, source_type: "user_upload" });
      setBlocks((prev) =>
        prev.map((b) => ({
          ...b,
          board_images: b.board_images?.map((img: any) =>
            img.id === imageId ? { ...img, url, source_type: "user_upload" } : img
          ),
        }))
      );
      setEditingImageUrl(null);
      toast.success("Изображение обновлено");
    } catch {
      toast.error("Ошибка обновления");
    }
  };

  const handleExportPDF = () => {
    const ok = generateFullPDF({ project, brief, rooms, issues, questions, blocks });
    if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
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
        <Button onClick={handleExportPDF} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          PDF
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
            {blocks.map((block) => (
              <div key={block.id} className="py-12">
                <h3 className="mb-6 text-foreground">
                  {getBlockLabel(block.block_type)}
                </h3>

                {/* Images */}
                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {block.board_images?.map((img: any) => (
                    <div key={img.id} className="group relative">
                      {img.url ? (
                        <img
                          src={img.url}
                          alt={block.caption || ""}
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-border">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" strokeWidth={1} />
                        </div>
                      )}

                      {img.note && (
                        <span className="absolute bottom-2 left-2 max-w-[80%] truncate bg-foreground/70 px-2 py-0.5 text-[10px] font-medium text-background">
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
                        {img.source_url && (
                          <a href={img.source_url} target="_blank" rel="noopener noreferrer">
                            <span className="flex h-7 w-7 items-center justify-center bg-card/90 border border-border text-foreground hover:text-primary transition-colors">
                              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                            </span>
                          </a>
                        )}
                      </div>

                      {editingImageUrl === img.id && (
                        <div className="mt-2">
                          <Input
                            placeholder="URL изображения"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleReplaceImage(img.id, (e.target as HTMLInputElement).value);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

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
            Экспорт PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConceptBoard;
