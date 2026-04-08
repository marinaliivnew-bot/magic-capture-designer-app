import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, parseRoomsFromText } from "@/lib/api";
import { saveRooms, uploadPlanFile } from "@/lib/rooms";
import RoomCard, { type RoomData } from "@/components/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Upload, X, FileText, Image as ImageIcon, ChevronDown, Scan } from "lucide-react";

const DRAFT_KEY = "draft_project";

function makeRoom(): RoomData {
  return {
    id: crypto.randomUUID(),
    name: "",
    room_type: "other",
    dimensions_text: "",
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const RAW_INPUT_PLACEHOLDER = `Вставьте сюда любые данные о клиенте и проекте в любом формате:
• переписку из мессенджера (WhatsApp, Telegram)
• свои заметки после встречи
• транскрипт голосового сообщения (текст)
• пожелания клиента, записанные своими словами
• ссылки на референсы (Pinterest, Houzz и др.)

Пример: "Клиент хочет светлую спальню, не любит серый. Есть кот.
Бюджет около 300 тыс. Любит скандинавский стиль, видела у подруги."`;

const NewProject = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const draft = loadDraft();

  const [form, setForm] = useState({
    name: draft?.name || "",
    raw_input: draft?.raw_input || "",
    budget: draft?.budget || "",
    timeline: draft?.timeline || "",
    taboos: draft?.taboos || "",
    must_haves: draft?.must_haves || "",
    nice_to_haves: draft?.nice_to_haves || "",
    rooms_description: draft?.rooms_description || "",
  });

  // Floor plan AI analysis
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState("");
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [planAnalysis, setPlanAnalysis] = useState<{
    detected_dimensions: string;
    detected_zones: string;
    notes: string;
  } | null>(draft?.planAnalysis || null);

  // Rooms
  const [rooms, setRooms] = useState<RoomData[]>(draft?.rooms || []);
  const [fillingRooms, setFillingRooms] = useState(false);

  // Autosave to localStorage with debounce
  const saveDraft = useCallback((formData: typeof form, roomsData: RoomData[], analysis: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...formData,
        rooms: roomsData,
        planAnalysis: analysis,
      }));
    }, 1000);
  }, []);

  useEffect(() => {
    saveDraft(form, rooms, planAnalysis);
  }, [form, rooms, planAnalysis, saveDraft]);

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
    setPlanAnalysis(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAnalyzePlan = async () => {
    if (!planFile) return;
    
    // Only image files can be analyzed via vision
    if (!planFile.type.startsWith("image/")) {
      toast.info("AI-распознавание поддерживает только изображения (JPG, PNG). Для PDF загрузите скриншот.");
      return;
    }

    setAnalyzingPlan(true);
    try {
      // Convert to base64
      const buffer = await planFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: planFile.type,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Ошибка: ${resp.status}`);
      }

      const result = await resp.json();
      setPlanAnalysis(result);
      toast.success("Чертёж распознан");
    } catch (e: any) {
      toast.error(e.message || "Ошибка распознавания");
      console.error(e);
    } finally {
      setAnalyzingPlan(false);
    }
  };

  const handleApplyPlanData = () => {
    if (!planAnalysis) return;
    setForm(prev => ({
      ...prev,
      rooms_description: prev.rooms_description
        ? `${prev.rooms_description}\n${planAnalysis.detected_zones}`
        : planAnalysis.detected_zones,
      raw_input: prev.raw_input
        ? `${prev.raw_input}\nИз чертежа: ${planAnalysis.detected_dimensions}. ${planAnalysis.notes}`
        : `Из чертежа: ${planAnalysis.detected_dimensions}. ${planAnalysis.notes}`,
    }));
    toast.success("Данные из чертежа подставлены в форму");
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

      // Clear draft on success
      localStorage.removeItem(DRAFT_KEY);

      toast.success("Проект создан!");
      navigate(`/project/${project.id}/style`);
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
              <Label className="text-base font-semibold">А. Чертёж или план помещения (необязательно)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Загрузите план от застройщика или свой эскиз. AI извлечёт размеры и зоны автоматически.
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
              <>
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

                {/* Analyze button */}
                {!planAnalysis && planFile.type.startsWith("image/") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAnalyzePlan}
                    disabled={analyzingPlan}
                  >
                    {analyzingPlan ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Scan className="mr-2 h-4 w-4" />
                    )}
                    {analyzingPlan ? "Распознаю чертёж…" : "Распознать чертёж через AI"}
                  </Button>
                )}

                {/* Analysis result */}
                {planAnalysis && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                      Распознано из чертежа
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-border p-3 text-sm">
                      {planAnalysis.detected_dimensions && (
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wide">Габариты:</span>
                          <p className="text-foreground">{planAnalysis.detected_dimensions}</p>
                        </div>
                      )}
                      {planAnalysis.detected_zones && (
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wide">Зоны:</span>
                          <p className="text-foreground">{planAnalysis.detected_zones}</p>
                        </div>
                      )}
                      {planAnalysis.notes && (
                        <div>
                          <span className="text-muted-foreground text-xs uppercase tracking-wide">Примечания:</span>
                          <p className="text-foreground">{planAnalysis.notes}</p>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyPlanData}
                        className="w-full mt-2"
                      >
                        Подставить в форму
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
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
              {fillingRooms ? "Распознаю…" : "Заполнить габариты из текста"}
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
              placeholder={RAW_INPUT_PLACEHOLDER}
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
