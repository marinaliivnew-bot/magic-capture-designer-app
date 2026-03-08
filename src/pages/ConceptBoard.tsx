import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBoardBlocks, getProject, getBrief, updateBoardBlock, updateBoardImage, generateBoard } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BOARD_BLOCK_TYPES, BRIEF_SECTIONS, ROOM_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  FileDown,
  ImageIcon,
  Pencil,
  ExternalLink,
  Sparkles,
} from "lucide-react";

const ConceptBoard = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [p, b] = await Promise.all([
        getProject(projectId),
        getBoardBlocks(projectId),
      ]);
      setProject(p);
      setBlocks(b || []);
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
      const [brief, rooms] = await Promise.all([
        getBrief(projectId),
        getRooms(projectId),
      ]);

      const briefText = brief
        ? BRIEF_SECTIONS.map(
            ({ key, label }) => `### ${label}\n${(brief as any)[key] || "(пусто)"}`
          ).join("\n\n")
        : "(бриф не заполнен)";

      const roomsContext = rooms && rooms.length > 0
        ? rooms.map((r: any) => {
            const typeLabel = ROOM_TYPES.find(t => t.value === r.room_type)?.label || r.room_type;
            let line = `- ${r.name} (${typeLabel})`;
            if (r.dimensions_text) line += `, размеры: ${r.dimensions_text}`;
            return line;
          }).join("\n")
        : "Не указаны";

      const planNote = project?.plan_url ? `\nПлан помещения: ${project.plan_url}` : "";
      const descNote = project?.rooms_description ? `\nОписание: ${project.rooms_description}` : "";
      const context = `Помещения:\n${roomsContext}${descNote}${planNote}\nЗаметки: ${project?.raw_input || "нет"}`;

      await generateBoard(projectId, briefText, context);
      
      // Reload blocks
      const freshBlocks = await getBoardBlocks(projectId);
      setBlocks(freshBlocks || []);
      toast.success("Концепт-борд сгенерирован!");
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
      toast.success("Подпись сохранена");
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/project/${projectId}/brief`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display text-foreground">
              Концепт-борд
            </h1>
            <p className="text-sm text-muted-foreground">{project?.name}</p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Генерирую…" : blocks.length > 0 ? "Перегенерировать" : "Сгенерировать"}
          </Button>
        </div>

        {blocks.length === 0 && !generating ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-display text-xl text-foreground">
              Борд пока пуст
            </h3>
            <p className="mt-2 text-muted-foreground">
              Нажмите «Сгенерировать», чтобы AI создал концепт-борд на основе брифа.
            </p>
            <Button onClick={handleGenerate} className="mt-4" disabled={generating}>
              <Sparkles className="mr-2 h-4 w-4" />
              Сгенерировать борд
            </Button>
          </div>
        ) : generating ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">
              AI генерирует концепт-борд…
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {blocks.map((block) => (
              <BoardBlock
                key={block.id}
                block={block}
                getBlockLabel={getBlockLabel}
                editingCaption={editingCaption}
                setEditingCaption={setEditingCaption}
                editingImageUrl={editingImageUrl}
                setEditingImageUrl={setEditingImageUrl}
                onSaveCaption={handleSaveCaption}
                onReplaceImage={handleReplaceImage}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

function BoardBlock({
  block,
  getBlockLabel,
  editingCaption,
  setEditingCaption,
  editingImageUrl,
  setEditingImageUrl,
  onSaveCaption,
  onReplaceImage,
}: {
  block: any;
  getBlockLabel: (type: string) => string;
  editingCaption: string | null;
  setEditingCaption: (id: string | null) => void;
  editingImageUrl: string | null;
  setEditingImageUrl: (id: string | null) => void;
  onSaveCaption: (blockId: string, caption: string) => void;
  onReplaceImage: (imageId: string, url: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 font-display text-lg text-foreground">
        {getBlockLabel(block.block_type)}
      </h3>

      {/* Images */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.board_images?.map((img: any) => (
          <div key={img.id} className="group relative">
            {img.url ? (
              <img
                src={img.url}
                alt={block.caption || ""}
                className="h-48 w-full rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-lg bg-muted">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}

            {/* Note (search query) */}
            {img.note && (
              <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-medium text-background">
                {img.note}
              </span>
            )}

            {/* Replace controls */}
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7"
                onClick={() =>
                  setEditingImageUrl(
                    editingImageUrl === img.id ? null : img.id
                  )
                }
              >
                <Pencil className="h-3 w-3" />
              </Button>
              {img.source_url && (
                <a href={img.source_url} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="secondary" className="h-7 w-7">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>

            {editingImageUrl === img.id && (
              <div className="mt-2">
                <Input
                  placeholder="Вставьте URL изображения"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onReplaceImage(img.id, (e.target as HTMLInputElement).value);
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
          className="text-sm"
          onBlur={(e) => onSaveCaption(block.id, e.target.value)}
          autoFocus
        />
      ) : (
        <p
          className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setEditingCaption(block.id)}
        >
          {block.caption || "Нажмите, чтобы добавить подпись..."}
        </p>
      )}
    </div>
  );
}

export default ConceptBoard;
