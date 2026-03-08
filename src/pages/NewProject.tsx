import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/api";
import { saveRooms, uploadPlanFile } from "@/lib/rooms";
import RoomCard, { type RoomData } from "@/components/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Upload, X, FileText, Image as ImageIcon } from "lucide-react";

function makeRoom(): RoomData {
  return {
    id: crypto.randomUUID(),
    name: "",
    room_type: "other",
    dimensions_text: "",
  };
}

const NewProject = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    raw_input: "",
    budget: "",
    timeline: "",
    taboos: "",
    must_haves: "",
    nice_to_haves: "",
    rooms_description: "",
  });

  // Вариант А — файл плана
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState("");

  // Вариант Б — ручные комнаты
  const [rooms, setRooms] = useState<RoomData[]>([]);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRoomChange = (id: string, field: keyof RoomData, value: any) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const addRoom = () => setRooms((prev) => [...prev, makeRoom()]);

  const deleteRoom = (id: string) =>
    setRooms((prev) => prev.filter((r) => r.id !== id));

  const handlePlanSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Поддерживаются только JPG, PNG и PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 10 МБ)");
      return;
    }
    setPlanFile(file);
    if (file.type.startsWith("image/")) {
      setPlanPreview(URL.createObjectURL(file));
    } else {
      setPlanPreview("");
    }
  };

  const removePlan = () => {
    setPlanFile(null);
    setPlanPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const hasRooms = rooms.some((r) => r.name.trim());
  const hasDescription = form.rooms_description.trim().length > 0;
  const hasPlan = !!planFile;
  const hasSomething = hasRooms || hasDescription || hasPlan;

  const handleGenerate = async () => {
    if (!form.name.trim()) {
      toast.error("Введите название проекта");
      return;
    }
    if (!hasSomething) {
      toast.error("Заполните хотя бы одну секцию: загрузите план, добавьте помещения или опишите текстом");
      return;
    }
    if (rooms.length > 0 && rooms.some((r) => !r.name.trim())) {
      toast.error("Укажите название для каждого добавленного помещения");
      return;
    }

    setLoading(true);
    try {
      // Upload plan file first to get URL
      let planUrl: string | undefined;
      if (planFile) {
        planUrl = await uploadPlanFile(planFile, "temp", 0);
      }

      const project = await createProject({
        name: form.name,
        raw_input: form.raw_input || undefined,
        rooms_description: form.rooms_description || undefined,
        plan_url: planUrl,
        constraints: {
          budget: form.budget,
          timeline: form.timeline,
          taboos: form.taboos,
          must_haves: form.must_haves,
          nice_to_haves: form.nice_to_haves,
        },
      });

      // Re-upload with correct project id path
      if (planFile) {
        planUrl = await uploadPlanFile(planFile, project.id, 0);
        // Update project with correct URL
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("projects").update({ plan_url: planUrl }).eq("id", project.id);
      }

      // Save rooms if any
      if (rooms.filter((r) => r.name.trim()).length > 0) {
        const roomsToSave = rooms
          .filter((r) => r.name.trim())
          .map((room, i) => ({
            name: room.name,
            room_type: room.room_type,
            dimensions_text: room.dimensions_text || undefined,
            sort_order: i,
          }));
        await saveRooms(project.id, roomsToSave);
      }

      toast.success("Проект создан!");
      navigate(`/project/${project.id}/brief`);
    } catch (e) {
      toast.error("Ошибка при создании проекта");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isPdf = planFile?.type === "application/pdf";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-display text-foreground mb-2">
            Новый проект
          </h1>
          <p className="text-muted-foreground">
            Заполните то, что есть — план, список комнат или описание текстом
          </p>
        </div>

        <div className="space-y-6">
          {/* Project name */}
          <div className="space-y-2">
            <Label htmlFor="name">Название проекта *</Label>
            <Input
              id="name"
              placeholder="Квартира Ивановых, ул. Ленина 10"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* === SECTION A: Plan upload === */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">А. План помещения / чертёж</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Есть готовый чертёж от застройщика или архитектора? Загрузите его.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={handlePlanSelect}
            />
            {planFile ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
                {planPreview ? (
                  <img src={planPreview} alt="План" className="h-20 w-20 rounded object-cover" />
                ) : isPdf ? (
                  <FileText className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm text-foreground">{planFile.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={removePlan}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Загрузить план (JPG, PNG, PDF)
              </Button>
            )}
          </div>

          {/* === SECTION B: Manual rooms === */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">Б. Список помещений</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Знаете размеры? Добавьте помещения вручную.
              </p>
            </div>
            {rooms.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                index={i}
                canDelete={true}
                onChange={handleRoomChange}
                onDelete={deleteRoom}
              />
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={addRoom}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить помещение
            </Button>
          </div>

          {/* === SECTION C: Text description === */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">В. Описание текстом</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Нет ни плана, ни точных размеров — опишите словами, AI разберётся.
              </p>
            </div>
            <Textarea
              placeholder="Баня 10×6, внутри парилка, душевая, комната отдыха и тамбур…"
              className="min-h-[100px]"
              value={form.rooms_description}
              onChange={(e) => set("rooms_description", e.target.value)}
            />
          </div>

          {/* Raw input */}
          <div className="space-y-2">
            <Label htmlFor="raw">Заметки / переписка / транскрипт</Label>
            <Textarea
              id="raw"
              placeholder="Вставьте сюда переписку с клиентом, голосовые заметки, пожелания…"
              className="min-h-[120px]"
              value={form.raw_input}
              onChange={(e) => set("raw_input", e.target.value)}
            />
          </div>

          {/* Constraints grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Бюджет</Label>
              <Input id="budget" placeholder="до 500 000 руб" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeline">Сроки</Label>
              <Input id="timeline" placeholder="3 месяца" value={form.timeline} onChange={(e) => set("timeline", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taboos">Табу по стилю / цвету</Label>
            <Input id="taboos" placeholder="Без розового, без лофта" value={form.taboos} onChange={(e) => set("taboos", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="must">Must-have</Label>
              <Input id="must" placeholder="Остров на кухне, ТВ-зона" value={form.must_haves} onChange={(e) => set("must_haves", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nice">Nice-to-have</Label>
              <Input id="nice" placeholder="Барная стойка, подсветка" value={form.nice_to_haves} onChange={(e) => set("nice_to_haves", e.target.value)} />
            </div>
          </div>

          {/* Validation hint */}
          {!hasSomething && (
            <p className="text-sm text-muted-foreground text-center">
              Заполните хотя бы одну из секций А, Б или В
            </p>
          )}

          {/* Generate button */}
          <Button onClick={handleGenerate} disabled={loading} className="w-full h-12 text-base" size="lg">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Сгенерировать бриф
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewProject;
