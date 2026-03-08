import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, deleteProject } from "@/lib/api";
import { ROOM_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FolderOpen } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить проект «${name}»? Все данные будут стёрты.`)) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Проект удалён");
    } catch (e) {
      toast.error("Ошибка удаления");
    }
  };

  const getRoomLabel = (type: string) =>
    ROOM_TYPES.find((r) => r.value === type)?.label || type;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-display text-foreground mb-2">
            Brief → Concept
          </h1>
          <p className="text-muted-foreground">
            Превращайте хаотичные заметки в структурированные брифы
          </p>
        </div>

        {/* New project button */}
        <Button
          onClick={() => navigate("/new")}
          className="mb-8 w-full h-12 text-base"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Новый проект
        </Button>

        {/* Projects list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl text-foreground">
              Нет проектов
            </h3>
            <p className="mt-2 text-muted-foreground">
              Создайте первый проект, чтобы начать
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card)] cursor-pointer"
                onClick={() => navigate(`/project/${p.id}/brief`)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {p.room_type && <span>{getRoomLabel(p.room_type)}</span>}
                    {p.dimensions_text && (
                      <>
                        <span>·</span>
                        <span>{p.dimensions_text}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(p.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id, p.name);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
