import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, deleteProject } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-content px-12 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl text-foreground hover:text-primary transition-colors duration-350">Brief → Concept</a>
          <nav className="label-style text-muted-foreground">
            Интерьерный бриф
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-content px-12 py-16">
        <div className="mb-16 text-center">
          <h1 className="text-foreground mb-4">
            Brief → Concept
          </h1>
          <p className="text-muted-foreground font-light">
            Превращайте хаотичные заметки в структурированные брифы
          </p>
        </div>

        <Button
          onClick={() => navigate("/new")}
          className="mb-16 w-full"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Новый проект
        </Button>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-xl italic text-muted-foreground">
              Пока нет проектов
            </p>
            <Button variant="ghost" className="mt-6" onClick={() => navigate("/new")}>
              Создать первый
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-6 py-6 cursor-pointer transition-colors duration-350 hover:text-primary"
                onClick={() => navigate(`/project/${p.id}/brief`)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-foreground group-hover:text-primary transition-colors duration-350">
                    {p.name}
                  </h3>
                  <p className="caption-style mt-1">
                    {new Date(p.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-350 text-destructive border-destructive"
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
