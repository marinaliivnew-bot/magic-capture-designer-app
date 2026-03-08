import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBrief, getProject, upsertBrief, analyzeBrief } from "@/lib/api";
import { BRIEF_SECTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Search, LayoutGrid, Save, Loader2, Sparkles } from "lucide-react";

const BriefPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [p, b] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
        ]);
        setProject(p);
        if (b) {
          const fields: Record<string, string> = {};
          BRIEF_SECTIONS.forEach(({ key }) => {
            fields[key] = (b as any)[key] || "";
          });
          setBrief(fields);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display text-foreground">
              {project?.name || "Бриф"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Редактируйте секции брифа
            </p>
          </div>
        </div>

        {/* Completeness */}
        <div className="mb-8 rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Заполненность брифа</span>
            <span className="font-semibold text-primary">{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-2" />
        </div>

        {/* Brief sections */}
        <div className="space-y-6">
          {BRIEF_SECTIONS.map(({ key, label, description }) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                {label}
              </label>
              <p className="text-xs text-muted-foreground">{description}</p>
              <Textarea
                placeholder={`Заполните: ${label.toLowerCase()}...`}
                value={brief[key] || ""}
                onChange={(e) =>
                  setBrief((prev) => ({ ...prev, [key]: e.target.value }))
                }
                className="min-h-[80px]"
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить бриф
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              handleSave();
              navigate(`/project/${projectId}/questions`);
            }}
            className="flex-1"
          >
            <Search className="mr-2 h-4 w-4" />
            Найти пробелы и вопросы
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              handleSave();
              navigate(`/project/${projectId}/board`);
            }}
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
