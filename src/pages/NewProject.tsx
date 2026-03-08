import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/api";
import { ROOM_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const NewProject = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    room_type: "",
    dimensions_text: "",
    raw_input: "",
    budget: "",
    timeline: "",
    taboos: "",
    must_haves: "",
    nice_to_haves: "",
  });

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleGenerate = async () => {
    if (!form.name.trim()) {
      toast.error("Введите название проекта");
      return;
    }
    setLoading(true);
    try {
      const project = await createProject({
        name: form.name,
        room_type: form.room_type || undefined,
        dimensions_text: form.dimensions_text || undefined,
        raw_input: form.raw_input || undefined,
        constraints: {
          budget: form.budget,
          timeline: form.timeline,
          taboos: form.taboos,
          must_haves: form.must_haves,
          nice_to_haves: form.nice_to_haves,
        },
      });
      toast.success("Проект создан!");
      navigate(`/project/${project.id}/brief`);
    } catch (e) {
      toast.error("Ошибка при создании проекта");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-display text-foreground mb-2">
            Новый проект
          </h1>
          <p className="text-muted-foreground">
            Заполните данные о помещении и вставьте заметки
          </p>
        </div>

        <div className="space-y-6">
          {/* Project name */}
          <div className="space-y-2">
            <Label htmlFor="name">Название проекта *</Label>
            <Input
              id="name"
              placeholder="Кухня-гостиная Ивановых"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* Room type */}
          <div className="space-y-2">
            <Label>Тип помещения</Label>
            <Select value={form.room_type} onValueChange={(v) => set("room_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <Label htmlFor="dims">Габариты</Label>
            <Input
              id="dims"
              placeholder="4.2x3.1, высота 2.7"
              value={form.dimensions_text}
              onChange={(e) => set("dimensions_text", e.target.value)}
            />
          </div>

          {/* Raw input */}
          <div className="space-y-2">
            <Label htmlFor="raw">Заметки / переписка / транскрипт</Label>
            <Textarea
              id="raw"
              placeholder="Вставьте сюда переписку с клиентом, голосовые заметки, пожелания…"
              className="min-h-[160px]"
              value={form.raw_input}
              onChange={(e) => set("raw_input", e.target.value)}
            />
          </div>

          {/* Constraints grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Бюджет</Label>
              <Input
                id="budget"
                placeholder="до 500 000 руб"
                value={form.budget}
                onChange={(e) => set("budget", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeline">Сроки</Label>
              <Input
                id="timeline"
                placeholder="3 месяца"
                value={form.timeline}
                onChange={(e) => set("timeline", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taboos">Табу по стилю / цвету</Label>
            <Input
              id="taboos"
              placeholder="Без розового, без лофта"
              value={form.taboos}
              onChange={(e) => set("taboos", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="must">Must-have</Label>
              <Input
                id="must"
                placeholder="Остров на кухне, ТВ-зона"
                value={form.must_haves}
                onChange={(e) => set("must_haves", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nice">Nice-to-have</Label>
              <Input
                id="nice"
                placeholder="Барная стойка, подсветка"
                value={form.nice_to_haves}
                onChange={(e) => set("nice_to_haves", e.target.value)}
              />
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-12 text-base"
            size="lg"
          >
            {loading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-5 w-5" />
            )}
            Сгенерировать бриф
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewProject;
