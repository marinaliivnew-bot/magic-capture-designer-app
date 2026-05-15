import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicProject } from "@/lib/api";
import { Loader2, Copy, CheckCircle2, Lock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type ApprovalStatus = "draft" | "locked" | "approved";

interface PublicProject {
  id: string;
  name: string;
  room_type: string | null;
  created_at: string;
  constraints: any;
}

interface Brief {
  users_of_space?: string;
  scenarios?: string;
  style_likes?: string;
  style_dislikes?: string;
  success_criteria?: string;
  budget?: string;
  timeline?: string;
}

interface BoardImage {
  url: string;
  note: string;
  attribution: string;
}

interface BoardBlock {
  block_type: string;
  caption: string;
  color_chips: Array<{ hex: string; name: string; role: string; ral?: string }>;
  sort_order: number;
  board_images: BoardImage[];
}

const BLOCK_LABELS: Record<string, string> = {
  atmosphere: "Визуальная атмосфера",
  palette: "Палитра RAL / NCS",
  materials: "Карта материалов",
  furniture: "Мебель и эргономика",
  lighting: "Освещение",
};

const getApprovalStatus = (constraints: any): ApprovalStatus => {
  const s = constraints?.approval_status;
  if (s === "locked" || s === "approved") return s;
  return "draft";
};

const StatusChip = ({ status }: { status: ApprovalStatus }) => {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.1em] text-emerald-700 border border-emerald-300 bg-emerald-50 px-3 py-1">
      <CheckCircle2 className="h-3.5 w-3.5" />Утверждённая версия
    </span>
  );
  if (status === "locked") return (
    <span className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.1em] text-amber-700 border border-amber-300 bg-amber-50 px-3 py-1">
      <Lock className="h-3.5 w-3.5" />Зафиксирован для договора
    </span>
  );
  return (
    <span className="font-body text-[11px] uppercase tracking-[0.1em] text-[#8A8278] border border-[#D0C8C0] px-3 py-1">
      Draft — на согласовании
    </span>
  );
};

const PublicProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<PublicProject | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [blocks, setBlocks] = useState<BoardBlock[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    getPublicProject(projectId)
      .then(data => {
        setProject(data.project);
        setBrief(data.brief);
        setBlocks(data.blocks || []);
      })
      .catch(e => setError(e.message || "Проект не найден"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6">
        <p className="font-display text-[24px] text-[#1A1A1A]">Проект не найден</p>
        <p className="font-body text-[15px] text-[#8A8278]">{error || "Возможно, ссылка устарела или недействительна."}</p>
        <a href="/" className="font-body text-[13px] uppercase tracking-[0.1em] text-primary hover:text-foreground transition-colors">
          Перейти на главную →
        </a>
      </div>
    );
  }

  const status = getApprovalStatus(project.constraints);
  const atmosphereBlock = blocks.find(b => b.block_type === "atmosphere");
  const paletteBlock = blocks.find(b => b.block_type === "palette");
  const atmosphereImages = (atmosphereBlock?.board_images || []).filter(img => img.url);

  const briefFields: Array<{ label: string; value: string | undefined }> = [
    { label: "Пользователи", value: brief?.users_of_space },
    { label: "Сценарии использования", value: brief?.scenarios },
    { label: "Нравится", value: brief?.style_likes },
    { label: "Не нравится / Табу", value: brief?.style_dislikes },
    { label: "Критерии успеха", value: brief?.success_criteria },
    { label: "Бюджет", value: brief?.budget },
    { label: "Сроки", value: brief?.timeline },
  ].filter(f => f.value?.trim());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6 sm:px-12 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl text-foreground hover:text-primary transition-colors duration-350">
            Brief → Concept
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-[0.1em] border border-[#D0C8C0] px-4 py-2 hover:border-primary hover:text-primary transition-colors"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Скопировано" : "Скопировать ссылку"}
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 font-body text-[12px] uppercase tracking-[0.1em] bg-primary text-white px-4 py-2 hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Создать проект
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 sm:px-12 py-12 space-y-16">

        {/* Hero */}
        <section>
          <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-6">
            Концепт-документ
          </p>
          <div className="flex flex-wrap items-start gap-4 mb-6">
            <h1 className="font-display text-[36px] sm:text-[48px] text-[#1A1A1A] leading-tight flex-1">
              {project.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={status} />
            {project.room_type && (
              <span className="font-body text-[11px] uppercase tracking-[0.08em] text-[#8A8278] border border-[#D0C8C0] px-3 py-1">
                {project.room_type}
              </span>
            )}
            <span className="font-body text-[12px] text-[#8A8278]">
              {new Date(project.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </section>

        {/* Atmosphere images */}
        {atmosphereImages.length > 0 && (
          <section>
            <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-6">
              Визуальная атмосфера
            </p>
            {atmosphereBlock?.caption && (
              <p className="font-body text-[16px] text-[#5A5248] leading-[1.6] mb-6 max-w-2xl">
                {atmosphereBlock.caption}
              </p>
            )}
            <div className={cn(
              "grid gap-4",
              atmosphereImages.length === 1 ? "grid-cols-1" :
              atmosphereImages.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              {atmosphereImages.slice(0, 3).map((img, i) => (
                <div key={i} className="relative overflow-hidden bg-[#EDE8E2]">
                  <img
                    src={img.url}
                    alt={img.note || "Атмосфера"}
                    className="w-full h-64 object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {img.note && (
                    <div className="p-4 bg-white border-t border-[#EDE8E2]">
                      <p className="font-body text-[13px] text-[#5A5248] leading-relaxed">{img.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Colour palette */}
        {paletteBlock && paletteBlock.color_chips?.length > 0 && (
          <section>
            <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-6">
              Палитра стандартов RAL / NCS
            </p>
            {paletteBlock.caption && (
              <p className="font-body text-[15px] text-[#5A5248] leading-relaxed mb-6 max-w-2xl">
                {paletteBlock.caption}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {paletteBlock.color_chips.map((chip, i) => (
                <div key={i} className="flex items-center gap-3 border border-[#D0C8C0] bg-white p-3 min-w-[160px]">
                  <div
                    className="w-10 h-10 flex-shrink-0 border border-[#D0C8C0]"
                    style={{ backgroundColor: chip.hex }}
                  />
                  <div>
                    <p className="font-body text-[13px] text-[#1A1A1A] font-medium">{chip.name}</p>
                    <p className="font-body text-[11px] text-[#8A8278]">{chip.role}</p>
                    {chip.ral && <p className="font-body text-[10px] text-[#8A8278]">{chip.ral}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other blocks */}
        {blocks
          .filter(b => b.block_type !== "atmosphere" && b.block_type !== "palette")
          .map((block, i) => {
            const blockImages = block.board_images?.filter(img => img.url) || [];
            return (
              <section key={i}>
                <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-6">
                  {BLOCK_LABELS[block.block_type] || block.block_type}
                </p>
                {block.caption && (
                  <p className="font-body text-[15px] text-[#5A5248] leading-relaxed mb-6 max-w-2xl">
                    {block.caption}
                  </p>
                )}
                {blockImages.length > 0 && (
                  <div className={cn(
                    "grid gap-4",
                    blockImages.length === 1 ? "grid-cols-1 max-w-lg" :
                    blockImages.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {blockImages.slice(0, 3).map((img, j) => (
                      <div key={j} className="bg-[#EDE8E2]">
                        <img
                          src={img.url}
                          alt={img.note || block.block_type}
                          className="w-full h-52 object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        {img.note && (
                          <div className="p-4 bg-white border-t border-[#EDE8E2]">
                            <p className="font-body text-[13px] text-[#5A5248] leading-relaxed">{img.note}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {/* Brief summary */}
        {briefFields.length > 0 && (
          <section>
            <div className="border border-[#D0C8C0]">
              <div className="border-b border-[#D0C8C0] px-8 py-6">
                <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary">
                  Параметры проекта
                </p>
              </div>
              <div className="divide-y divide-[#EDE8E2]">
                {briefFields.map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-1 sm:grid-cols-[220px_1fr] px-8 py-5 gap-2">
                    <p className="font-body text-[12px] uppercase tracking-[0.1em] text-[#8A8278]">{label}</p>
                    <p className="font-body text-[14px] text-[#2D2D2D] leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer CTA */}
        <section className="border-t border-[#D0C8C0] pt-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="font-body text-[13px] text-[#8A8278]">Создано в Magic Capture</p>
              <p className="font-body text-[12px] text-[#8A8278]">
                Инструмент для дизайнеров интерьера: бриф → концепт → PDF за минуты
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 font-body text-[12px] uppercase tracking-[0.1em] border border-[#D0C8C0] px-5 py-2.5 hover:border-primary hover:text-primary transition-colors"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Скопировано" : "Скопировать ссылку"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PublicProjectPage;
