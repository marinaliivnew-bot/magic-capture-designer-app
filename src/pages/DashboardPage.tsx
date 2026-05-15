import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProjects, getBrief, getDesignerProfile, getApprovalStatus, deleteProject, pinProject,
  type DesignerProfile, type AgreedElement, type StyleConflict, type ApprovalStatus,
} from "@/lib/api";
import { getSessionId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle2, MessageCircle, ArrowRight, User, ChevronDown, ChevronUp,
  Lock, Star, Trash2, Share2, LayoutGrid, List, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

const VISUAL_SLIDER_LABELS: Record<string, [string, string]> = {
  temperature: ["Холодно", "Тепло"],
  strictness: ["Строго", "Свободно"],
  texture: ["Просто", "Фактурно"],
  color: ["Монохром", "Цветно"],
  style: ["Классика", "Авангард"],
};

type ViewMode = "list" | "gallery";
type FilterStatus = "all" | "draft" | "locked" | "approved";

interface ProjectRecord {
  id: string;
  name: string;
  room_type: string | null;
  created_at: string;
  completeness_score: number;
  agreed_elements: AgreedElement[];
  open_conflicts: StyleConflict[];
  agreed_summary: string | null;
  has_board: boolean;
  approval_status: ApprovalStatus;
  pinned: boolean;
}

const StatusBadge = ({ status }: { status: ApprovalStatus }) => {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.08em] text-emerald-700 border border-emerald-300 bg-emerald-50 px-2 py-0.5">
      <CheckCircle2 className="h-3 w-3" />Утверждено
    </span>
  );
  if (status === "locked") return (
    <span className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.08em] text-amber-700 border border-amber-300 bg-amber-50 px-2 py-0.5">
      <Lock className="h-3 w-3" />Зафиксирован
    </span>
  );
  return null;
};

const CompletenessBar = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="flex-1 h-[2px] bg-[#EDE8E2]">
      <div
        className={cn("h-full transition-all", value <= 40 ? "bg-[hsl(var(--color-critical))]" : "bg-primary")}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="font-body text-[11px] text-[#8A8278] flex-shrink-0">{value}%</span>
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DesignerProfile | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterRoomType, setFilterRoomType] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shareToastId, setShareToastId] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [rawProjects, designerProfile] = await Promise.all([
        getProjects(),
        getDesignerProfile(getSessionId()),
      ]);
      setProfile(designerProfile);

      if (!rawProjects || rawProjects.length === 0) { setProjects([]); return; }

      const enriched = await Promise.all(
        rawProjects.map(async (p: any) => {
          try {
            const brief = await getBrief(p.id);
            const agreed = (brief as any)?.agreed_style_result;
            const agreedElements: AgreedElement[] = agreed?.agreed_elements || [];
            const openConflicts = (agreed?.conflicts || []).filter((c: StyleConflict) => !c.resolution);
            return {
              id: p.id,
              name: p.name,
              room_type: p.room_type || null,
              created_at: p.created_at,
              completeness_score: (brief as any)?.completeness_score || 0,
              agreed_elements: agreedElements,
              open_conflicts: openConflicts,
              agreed_summary: agreed?.summary || null,
              has_board: false,
              approval_status: getApprovalStatus(p),
              pinned: Boolean((p.constraints as any)?.pinned),
            };
          } catch {
            return {
              id: p.id,
              name: p.name,
              room_type: p.room_type || null,
              created_at: p.created_at,
              completeness_score: 0,
              agreed_elements: [],
              open_conflicts: [],
              agreed_summary: null,
              has_board: false,
              approval_status: 'draft' as ApprovalStatus,
              pinned: Boolean((p.constraints as any)?.pinned),
            };
          }
        })
      );

      setProjects(enriched);
      if (enriched.length > 0 && (enriched[0].agreed_elements.length > 0 || enriched[0].open_conflicts.length > 0)) {
        setExpandedProjects(new Set([enriched[0].id]));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const roomTypes = useMemo(() => {
    const types = [...new Set(projects.map(p => p.room_type).filter(Boolean) as string[])];
    return types.sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (filterStatus !== "all") result = result.filter(p => p.approval_status === filterStatus);
    if (filterRoomType !== "all") result = result.filter(p => p.room_type === filterRoomType);
    // pinned first
    result.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return result;
  }, [projects, filterStatus, filterRoomType]);

  const toggleExpand = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handlePin = async (e: React.MouseEvent, project: ProjectRecord) => {
    e.stopPropagation();
    const newPinned = !project.pinned;
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, pinned: newPinned } : p));
    try { await pinProject(project.id, newPinned); } catch {
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, pinned: project.pinned } : p));
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) { setDeleteConfirmId(id); return; }
    setDeleteConfirmId(null);
    setProjects(prev => prev.filter(p => p.id !== id));
    try { await deleteProject(id); } catch {
      await loadAll();
    }
  };

  const handleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/project/${id}/public`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToastId(id);
      setTimeout(() => setShareToastId(null), 2000);
    });
  };

  const hasProfile = Boolean(profile && (profile.designer_name || profile.style_description?.trim()));
  const sliderEntries = Object.entries(VISUAL_SLIDER_LABELS).filter(
    ([key]) => (profile?.ergonomics_rules as any)?.[key] !== undefined
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6 sm:px-12 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl text-foreground hover:text-primary transition-colors duration-350">
            Brief → Concept
          </a>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Главная</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>Мои стандарты</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 sm:px-12 py-12 space-y-16">

        {/* Designer Card */}
        <section>
          <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-8">Профиль дизайнера</p>
          {hasProfile ? (
            <div className="border border-[#D0C8C0] bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] divide-y lg:divide-y-0 lg:divide-x divide-[#D0C8C0]">
                <div className="p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-[#EDE8E2] flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-[#8A8278]" />
                    </div>
                    <div>
                      <h2 className="font-display text-[26px] text-[#1A1A1A] leading-tight">
                        {profile?.designer_name || "Дизайнер"}
                      </h2>
                      {profile?.style_description && (
                        <p className="font-body text-[14px] text-[#5A5248] mt-1 leading-relaxed max-w-[480px]">
                          {profile.style_description.slice(0, 220)}{profile.style_description.length > 220 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {(profile?.hard_constraints as any)?.taboos && (
                    <div className="mt-4 pt-4 border-t border-[#EDE8E2]">
                      <p className="font-body text-[11px] uppercase tracking-[0.1em] text-[#8A8278] mb-2">Личные табу</p>
                      <p className="font-body text-[13px] text-[#5A5248] leading-relaxed">{(profile?.hard_constraints as any).taboos}</p>
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <p className="font-body text-[11px] uppercase tracking-[0.1em] text-[#8A8278] mb-5">Визуальный язык</p>
                  <div className="space-y-4">
                    {sliderEntries.map(([key, [left, right]]) => {
                      const val = (profile?.ergonomics_rules as any)?.[key] ?? 5;
                      const pct = ((val - 1) / 9) * 100;
                      return (
                        <div key={key}>
                          <div className="flex justify-between font-body text-[11px] text-[#8A8278] mb-1">
                            <span>{left}</span><span>{right}</span>
                          </div>
                          <div className="h-[3px] bg-[#EDE8E2] rounded-full relative">
                            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm"
                              style={{ left: `calc(${pct}% - 6px)` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => navigate("/profile")}
                    className="mt-8 font-body text-[12px] uppercase tracking-[0.1em] text-primary hover:text-foreground transition-colors duration-350">
                    Редактировать профиль →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-[#D0C8C0] bg-white p-10 text-center">
              <p className="font-body text-[15px] text-[#5A5248] mb-4">Профиль не заполнен — AI-генерация работает без ваших стандартов</p>
              <Button variant="outline" onClick={() => navigate("/profile")}>Заполнить профиль</Button>
            </div>
          )}
        </section>

        {/* Project Gallery */}
        <section>
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mr-auto">
              История проектов
              {filteredProjects.length !== projects.length && (
                <span className="ml-2 text-[#8A8278]">({filteredProjects.length} из {projects.length})</span>
              )}
            </p>
            {/* View toggle */}
            <div className="flex border border-[#D0C8C0]">
              <button
                onClick={() => setViewMode("list")}
                className={cn("px-3 py-2 transition-colors", viewMode === "list" ? "bg-primary text-white" : "text-[#8A8278] hover:text-primary")}
                title="Список"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("gallery")}
                className={cn("px-3 py-2 border-l border-[#D0C8C0] transition-colors", viewMode === "gallery" ? "bg-primary text-white" : "text-[#8A8278] hover:text-primary")}
                title="Галерея"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={() => navigate("/new")}>+ Загрузить исходники</Button>
          </div>

          {/* Filter bar */}
          {projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-[#FAFAF8] border border-[#EDE8E2]">
              <Filter className="h-3.5 w-3.5 text-[#8A8278] flex-shrink-0" />
              <div className="flex flex-wrap gap-2">
                {(["all", "draft", "locked", "approved"] as FilterStatus[]).map(s => (
                  <button key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn(
                      "font-body text-[11px] uppercase tracking-[0.08em] px-3 py-1 border transition-colors",
                      filterStatus === s
                        ? "bg-primary text-white border-primary"
                        : "text-[#5A5248] border-[#D0C8C0] hover:border-primary hover:text-primary"
                    )}>
                    {s === "all" ? "Все" : s === "draft" ? "Черновик" : s === "locked" ? "Зафиксирован" : "Утверждён"}
                  </button>
                ))}
              </div>
              {roomTypes.length > 0 && (
                <select
                  value={filterRoomType}
                  onChange={e => setFilterRoomType(e.target.value)}
                  className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] border border-[#D0C8C0] px-3 py-1 bg-white hover:border-primary outline-none cursor-pointer"
                >
                  <option value="all">Все типы</option>
                  {roomTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              )}
              {(filterStatus !== "all" || filterRoomType !== "all") && (
                <button
                  onClick={() => { setFilterStatus("all"); setFilterRoomType("all"); }}
                  className="font-body text-[11px] text-[#8A8278] hover:text-primary transition-colors underline"
                >
                  Сбросить
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {projects.length === 0 ? (
            <div className="border border-dashed border-[#D0C8C0] bg-white p-12 text-center">
              <p className="font-body text-[15px] text-[#5A5248] mb-4">Проектов пока нет</p>
              <Button onClick={() => navigate("/new")}>Создать первый проект</Button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="border border-dashed border-[#D0C8C0] bg-white p-12 text-center">
              <p className="font-body text-[15px] text-[#5A5248]">Нет проектов, соответствующих фильтрам</p>
            </div>
          ) : viewMode === "gallery" ? (
            /* ── Gallery grid ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map(project => (
                <div
                  key={project.id}
                  className="group border border-[#D0C8C0] bg-white hover:border-primary transition-colors duration-200 flex flex-col"
                >
                  {/* Card top area */}
                  <div
                    className="p-6 flex-1 cursor-pointer"
                    onClick={() => navigate(`/project/${project.id}/edit`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-display text-[20px] text-[#1A1A1A] leading-tight line-clamp-2">
                        {project.name}
                      </h3>
                      <button
                        onClick={e => handlePin(e, project)}
                        className="flex-shrink-0 mt-0.5"
                        title={project.pinned ? "Открепить" : "Закрепить"}
                      >
                        <Star className={cn("h-4 w-4 transition-colors", project.pinned ? "fill-primary text-primary" : "text-[#C8C0B8] hover:text-primary")} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.room_type && (
                        <span className="font-body text-[11px] uppercase tracking-[0.08em] text-[#8A8278] border border-[#D0C8C0] px-2 py-0.5">
                          {project.room_type}
                        </span>
                      )}
                      <StatusBadge status={project.approval_status} />
                    </div>

                    <CompletenessBar value={project.completeness_score} className="mb-3" />

                    <p className="font-body text-[12px] text-[#8A8278]">
                      {new Date(project.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>

                  {/* Card footer actions */}
                  <div className="border-t border-[#EDE8E2] px-6 py-3 flex items-center justify-between">
                    <div className="flex gap-3">
                      <button onClick={() => navigate(`/project/${project.id}/brief`)}
                        className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] hover:text-primary transition-colors">
                        Бриф
                      </button>
                      <button onClick={() => navigate(`/project/${project.id}/board`)}
                        className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] hover:text-primary transition-colors">
                        Борд
                      </button>
                      <button onClick={() => navigate(`/project/${project.id}/export`)}
                        className="font-body text-[11px] uppercase tracking-[0.08em] text-primary transition-colors font-medium">
                        PDF →
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Share */}
                      <button onClick={e => handleShare(e, project.id)} title="Скопировать ссылку" className="relative">
                        <Share2 className="h-3.5 w-3.5 text-[#8A8278] hover:text-primary transition-colors" />
                        {shareToastId === project.id && (
                          <span className="absolute -top-7 right-0 whitespace-nowrap bg-foreground text-white font-body text-[10px] px-2 py-1 pointer-events-none">
                            Скопировано!
                          </span>
                        )}
                      </button>
                      {/* Delete */}
                      {deleteConfirmId === project.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={e => handleDelete(e, project.id)}
                            className="font-body text-[10px] uppercase tracking-[0.08em] text-red-600 hover:text-red-800 transition-colors">
                            Удалить
                          </button>
                          <span className="text-[#C8C0B8]">/</span>
                          <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="font-body text-[10px] uppercase tracking-[0.08em] text-[#8A8278] hover:text-foreground transition-colors">
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => handleDelete(e, project.id)} title="Удалить проект">
                          <Trash2 className="h-3.5 w-3.5 text-[#C8C0B8] hover:text-red-500 transition-colors" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── List view ── */
            <div className="space-y-4">
              {filteredProjects.map(project => {
                const isExpanded = expandedProjects.has(project.id);
                const hasAgreedData = project.agreed_elements.length > 0 || project.open_conflicts.length > 0;

                return (
                  <div key={project.id} className="border border-[#D0C8C0] bg-white">
                    {/* Header */}
                    <div
                      className="p-6 flex items-center gap-4 cursor-pointer hover:bg-[#FAFAF8] transition-colors duration-200"
                      onClick={() => toggleExpand(project.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          {/* Pin star */}
                          <button onClick={e => handlePin(e, project)} title={project.pinned ? "Открепить" : "Закрепить"}>
                            <Star className={cn("h-4 w-4 transition-colors", project.pinned ? "fill-primary text-primary" : "text-[#C8C0B8] hover:text-primary")} />
                          </button>
                          <h3 className="font-display text-[20px] text-[#1A1A1A]">{project.name}</h3>
                          {project.room_type && (
                            <span className="font-body text-[11px] uppercase tracking-[0.08em] text-[#8A8278] border border-[#D0C8C0] px-2 py-0.5">
                              {project.room_type}
                            </span>
                          )}
                          {hasAgreedData && (
                            <span className="font-body text-[11px] uppercase tracking-[0.08em] text-primary border border-primary/30 bg-primary/5 px-2 py-0.5">
                              Согласование начато
                            </span>
                          )}
                          <StatusBadge status={project.approval_status} />
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-body text-[12px] text-[#8A8278]">
                            {new Date(project.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          <CompletenessBar value={project.completeness_score} className="w-32" />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); navigate(`/project/${project.id}/brief`); }}
                          className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] hover:text-primary transition-colors hidden sm:block">
                          Бриф
                        </button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/project/${project.id}/board`); }}
                          className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] hover:text-primary transition-colors hidden sm:block">
                          Борд
                        </button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/project/${project.id}/export`); }}
                          className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] hover:text-primary transition-colors hidden sm:block">
                          PDF
                        </button>
                        {/* Share */}
                        <div className="relative hidden sm:block">
                          <button onClick={e => handleShare(e, project.id)} title="Скопировать ссылку">
                            <Share2 className="h-4 w-4 text-[#8A8278] hover:text-primary transition-colors" />
                          </button>
                          {shareToastId === project.id && (
                            <span className="absolute -top-8 right-0 whitespace-nowrap bg-foreground text-white font-body text-[10px] px-2 py-1 pointer-events-none z-10">
                              Скопировано!
                            </span>
                          )}
                        </div>
                        {/* Delete */}
                        {deleteConfirmId === project.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={e => handleDelete(e, project.id)}
                              className="font-body text-[10px] uppercase tracking-[0.08em] text-red-600 hover:text-red-800">
                              Удалить
                            </button>
                            <span className="text-[#C8C0B8]">/</span>
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="font-body text-[10px] uppercase tracking-[0.08em] text-[#8A8278] hover:text-foreground">
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button onClick={e => handleDelete(e, project.id)} title="Удалить проект">
                            <Trash2 className="h-4 w-4 text-[#C8C0B8] hover:text-red-500 transition-colors" />
                          </button>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-[#8A8278]" /> : <ChevronDown className="h-4 w-4 text-[#8A8278]" />}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <>
                        {hasAgreedData ? (
                          <div className="border-t border-[#EDE8E2] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EDE8E2]">
                            <div className="p-6">
                              <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <p className="font-body text-[12px] uppercase tracking-[0.1em] text-emerald-700">
                                  Согласовано ({project.agreed_elements.length})
                                </p>
                              </div>
                              {project.agreed_elements.length === 0 ? (
                                <p className="font-body text-[13px] text-[#8A8278] italic">Нет согласованных элементов</p>
                              ) : (
                                <ul className="space-y-3">
                                  {project.agreed_elements.slice(0, 6).map((el, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                                      <div>
                                        <p className="font-body text-[13px] text-[#2D2D2D] font-medium">{el.element}</p>
                                        {el.designer_note && <p className="font-body text-[12px] text-[#8A8278] mt-0.5">{el.designer_note}</p>}
                                      </div>
                                    </li>
                                  ))}
                                  {project.agreed_elements.length > 6 && (
                                    <p className="font-body text-[12px] text-[#8A8278]">+ ещё {project.agreed_elements.length - 6}</p>
                                  )}
                                </ul>
                              )}
                            </div>
                            <div className="p-6">
                              <div className="flex items-center gap-2 mb-4">
                                <MessageCircle className="h-4 w-4 text-amber-600" />
                                <p className="font-body text-[12px] uppercase tracking-[0.1em] text-amber-700">
                                  На обсуждение ({project.open_conflicts.length})
                                </p>
                              </div>
                              {project.open_conflicts.length === 0 ? (
                                <p className="font-body text-[13px] text-emerald-700 font-medium">Все противоречия разрешены</p>
                              ) : (
                                <ul className="space-y-3">
                                  {project.open_conflicts.slice(0, 6).map((c, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <div className={cn("w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0", c.severity === "hard" ? "bg-red-500" : "bg-amber-400")} />
                                      <div>
                                        <p className="font-body text-[13px] text-[#2D2D2D] font-medium">{c.element}</p>
                                        {c.client_want && <p className="font-body text-[12px] text-[#8A8278] mt-0.5">Клиент: {c.client_want}</p>}
                                        {c.alternatives && c.alternatives.length > 0 && (
                                          <p className="font-body text-[11px] text-primary mt-0.5">→ {c.alternatives[0]}</p>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                  {project.open_conflicts.length > 6 && (
                                    <p className="font-body text-[12px] text-[#8A8278]">+ ещё {project.open_conflicts.length - 6}</p>
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="border-t border-[#EDE8E2] p-6 bg-[#FAFAF8]">
                            <p className="font-body text-[13px] text-[#8A8278] mb-4">
                              Согласование ещё не начато. Пройдите этапы брифа и синхронизации стиля.
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {[
                                { label: "Открыть бриф", path: "brief" },
                                { label: "Вкус клиента", path: "client-taste" },
                                { label: "Согласовать стиль", path: "agreed-style" },
                              ].map(({ label, path }) => (
                                <button key={path}
                                  onClick={() => navigate(`/project/${project.id}/${path}`)}
                                  className="font-body text-[12px] uppercase tracking-[0.08em] text-primary hover:text-foreground flex items-center gap-1 transition-colors">
                                  {label} <ArrowRight className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Footer */}
                        <div className="border-t border-[#EDE8E2] px-6 py-3 bg-[#FAFAF8] flex flex-wrap gap-4">
                          {[
                            { label: "Исходники", path: "edit" },
                            { label: "Бриф", path: "brief" },
                            { label: "Вопросы", path: "questions" },
                            { label: "Согласование", path: "agreed-style" },
                            { label: "Борд", path: "board" },
                          ].map(({ label, path }) => (
                            <button key={path}
                              onClick={() => navigate(`/project/${project.id}/${path}`)}
                              className="font-body text-[11px] uppercase tracking-[0.08em] text-[#5A5248] hover:text-primary transition-colors">
                              {label}
                            </button>
                          ))}
                          <button
                            onClick={() => navigate(`/project/${project.id}/export`)}
                            className="font-body text-[11px] uppercase tracking-[0.08em] text-primary hover:text-foreground transition-colors font-medium">
                            Экспорт PDF →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
