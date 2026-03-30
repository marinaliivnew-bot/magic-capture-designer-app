import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProject, updateProject, parseRoomsFromText } from "@/lib/api";
import { saveRooms, getRooms, uploadPlanFile } from "@/lib/rooms";
import RoomCard, { type RoomData } from "@/components/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Plus, Upload, X, FileText, Image as ImageIcon, ArrowLeft, Sparkles } from "lucide-react";

function makeRoom(): RoomData {
  return {
    id: crypto.randomUUID(),
    name: "",
    room_type: "other",
    dimensions_text: "",
  };
}

const EditProject = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState("");
  const [existingPlanUrl, setExistingPlanUrl] = useState("");
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [fillingRooms, setFillingRooms] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [project, projectRooms] = await Promise.all([
          getProject(projectId),
          getRooms(projectId),
        ]);

        const constraints = (project.constraints as Record<string, string>) || {};
        setForm({
          name: project.name || "",
          raw_input: project.raw_input || "",
          budget: constraints.budget || "",
          timeline: constraints.timeline || "",
          taboos: constraints.taboos || "",
          must_haves: constraints.must_haves || "",
          nice_to_haves: constraints.nice_to_haves || "",
          rooms_description: project.rooms_description || "",
        });

        if (project.plan_url) {
          setExistingPlanUrl(project.plan_url);
          setPlanPreview(project.plan_url);
        }

        if (projectRooms && projectRooms.length > 0) {
          setRooms(
            projectRooms.map((r: any) => ({
              id: r.id,
              name: r.name,
              room_type: r.room_type,
              dimensions_text: r.dimensions_text || "",
            }))
          );
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

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRoomChange = (id: string, field: keyof RoomData, value: any) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const addRoom = () => setRooms((prev) => [...prev, makeRoom()]);
  const deleteRoom = (id: string) => setRooms((prev) => prev.filter((r) => r.id !== id));

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
    setExistingPlanUrl("");
    if (file.type.startsWith("image/")) {
      setPlanPreview(URL.createObjectURL(file));
    } else {
      setPlanPreview("");
    }
  };

  const removePlan = () => {
    setPlanFile(null);
    setPlanPreview("");
    setExistingPlanUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!projectId) return;
    if (!form.name.trim()) {
      toast.error("Введите название проекта");
      return;
    }

    setSaving(true);
    try {
      let planUrl: string | null = existingPlanUrl || null;

      if (planFile) {
        planUrl = await uploadPlanFile(planFile, projectId, 0);
      }

      await updateProject(projectId, {
        name: form.name,
        raw_input: form.raw_input || null,
        rooms_description: form.rooms_description || null,
        plan_url: planUrl,
        constraints: {
          budget: form.budget,
          timeline: form.timeline,
          taboos: form.taboos,
          must_haves: form.must_haves,
          nice_to_haves: form.nice_to_haves,
        },
      });

      const roomsToSave = rooms
        .filter((r) => r.name.trim())
        .map((room, i) => ({
          name: room.name,
          room_type: room.room_type,
          dimensions_text: room.dimensions_text || undefined,
          sort_order: i,
        }));
      await saveRooms(projectId, roomsToSave);

      toast.success("Проект обновлён");
      navigate(`/project/${projectId}/brief`);
    } catch (e) {
      toast.error("Ошибка сохранения");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const hasPlan = !!planFile || !!existingPlanUrl;
  const isPdf = planFile?.type === "application/pdf" || existingPlanUrl?.endsWith(".pdf");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/project/${projectId}/brief`)}
            className="text-muted-foreground hover:text-foreground transition-colors duration-350"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <span className="font-display text-xl flex-1">Редактирование проекта</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
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

          {/* Plan upload */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">А. План помещения / чертёж</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Загрузите или замените чертёж.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={handlePlanSelect}
            />
            {hasPlan ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
                {planPreview && !isPdf ? (
                  <img src={planPreview} alt="План" className="h-20 w-20 rounded object-cover" />
                ) : isPdf ? (
                  <FileText className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm text-foreground">
                  {planFile?.name || "Загруженный план"}
                </span>
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

          {/* Rooms */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">Б. Список помещений</Label>
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
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={fillingRooms || !form.rooms_description?.trim()}
              onClick={async () => {
                if (!form.rooms_description?.trim()) return;
                setFillingRooms(true);
                try {
                  const parsed = await parseRoomsFromText(form.rooms_description);
                  if (parsed.length === 0) {
                    toast.info("Не удалось распознать помещения — проверьте текст");
                    return;
                  }
                  const newRooms = parsed.map((r) => ({
                    id: crypto.randomUUID(),
                    name: r.name,
                    room_type: r.room_type,
                    dimensions_text: r.dimensions_text,
                  }));
                  setRooms(newRooms);
                  toast.success(`Добавлено помещений: ${newRooms.length}`);
                } catch (e: any) {
                  toast.error(e.message || "Ошибка распознавания");
                } finally {
                  setFillingRooms(false);
                }
              }}
            >
              {fillingRooms ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {fillingRooms ? "Распознаю…" : "Заполнить из текста"}
            </Button>
          </div>

          {/* Text description */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">В. Описание текстом</Label>
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
              placeholder={`Вставьте сюда любые данные о клиенте и проекте в любом формате:\n• переписку из мессенджера (WhatsApp, Telegram)\n• свои заметки после встречи\n• транскрипт голосового сообщения\n• пожелания клиента\n\nПример: "Клиент хочет светлую спальню, не любит серый. Есть кот. Бюджет около 300 тыс."`}
              className="min-h-[120px]"
              value={form.raw_input}
              onChange={(e) => set("raw_input", e.target.value)}
            />
          </div>

          {/* Constraints */}
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

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base" size="lg">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Сохранить изменения
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditProject;
