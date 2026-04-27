import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, parseRoomsFromText, upsertBrief } from "@/lib/api";
import { saveRooms, uploadPlanFile } from "@/lib/rooms";
import RoomCard, { type RoomData } from "@/components/RoomCard";
import RefUploadCard from "@/components/RefUploadCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildStructuredUserRefs, normalizeUserRefs, type UserRef } from "@/lib/user-refs";
import { toast } from "sonner";
import { ChevronDown, FileText, FolderOpen, Image as ImageIcon, Loader2, Plus, Scan, Sparkles, Upload, X } from "lucide-react";

const DRAFT_KEY = "draft_project";

type PlanAnalysis = {
  detected_dimensions: string;
  detected_zones: string;
  notes: string;
};

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

function buildPlanText(analysis: PlanAnalysis) {
  return [analysis.detected_zones, analysis.detected_dimensions, analysis.notes]
    .filter((value) => value && value.trim())
    .join("\n");
}

function mapParsedRooms(parsed: Array<{ name: string; room_type: string; dimensions_text: string }>) {
  return parsed.map((room) => ({
    id: crypto.randomUUID(),
    name: room.name,
    room_type: room.room_type,
    dimensions_text: room.dimensions_text,
  }));
}

function extractPdfTextFromBuffer(buffer: ArrayBuffer) {
  const uint8 = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(uint8);
  const textChunks: string[] = [];

  const tjRegex = /\(([^)]{1,500})\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(raw)) !== null) {
    const chunk = match[1]
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .trim();
    if (chunk.length > 2) textChunks.push(chunk);
  }

  const tjArrayRegex = /\[([^\]]{1,1000})\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(raw)) !== null) {
    const inner = match[1];
    const strRegex = /\(([^)]{1,200})\)/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = strRegex.exec(inner)) !== null) {
      const chunk = strMatch[1].trim();
      if (chunk.length > 2) textChunks.push(chunk);
    }
  }

  return textChunks.join(" ").replace(/\s+/g, " ").trim();
}

function summarizeParsedRooms(parsed: Array<{ name: string; room_type: string; dimensions_text: string }>) {
  return parsed
    .map((room) => {
      if (room.dimensions_text?.trim()) {
        return `${room.name} - ${room.dimensions_text}`;
      }
      return room.name;
    })
    .join("\n");
}

const RAW_INPUT_PLACEHOLDER = `Вставьте сюда любые данные о клиенте и проекте в любом формате:
• переписку из мессенджера (WhatsApp, Telegram)
• свои заметки после встречи
• транскрипт голосового сообщения
• пожелания клиента своими словами
• комментарии застройщика или подрядчика`;

const NewProject = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const draft = loadDraft();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: draft?.name || "",
    raw_input: draft?.raw_input || "",
    rooms_description: draft?.rooms_description || "",
  });
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState("");
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [planAnalysis, setPlanAnalysis] = useState<PlanAnalysis | null>(draft?.planAnalysis || null);
  const [rooms, setRooms] = useState<RoomData[]>(draft?.rooms || []);
  const [userRefs, setUserRefs] = useState<UserRef[]>(normalizeUserRefs(draft?.userRefs, "project"));
  const [fillingRooms, setFillingRooms] = useState(false);

  const saveDraft = useCallback((formData: typeof form, roomsData: RoomData[], analysis: PlanAnalysis | null, refs: UserRef[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          ...formData,
          rooms: roomsData,
          planAnalysis: analysis,
          userRefs: refs,
        }),
      );
    }, 1000);
  }, []);

  useEffect(() => {
    saveDraft(form, rooms, planAnalysis, userRefs);
  }, [form, rooms, planAnalysis, userRefs, saveDraft]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRoomChange = (id: string, field: keyof RoomData, value: string) => {
    setRooms((prev) => prev.map((room) => (room.id === id ? { ...room, [field]: value } : room)));
  };

  const addRoom = () => setRooms((prev) => [...prev, makeRoom()]);
  const deleteRoom = (id: string) => setRooms((prev) => prev.filter((room) => room.id !== id));

  const handlePlanSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
    setPlanAnalysis(null);

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

    setAnalyzingPlan(true);
    try {
      if (planFile.type === "application/pdf") {
        const pdfBuffer = await planFile.arrayBuffer();
        const extractedText = extractPdfTextFromBuffer(pdfBuffer);

        if (extractedText.length < 20) {
          toast.info("В этом PDF не удалось найти текстовый слой. Для сканированного PDF лучше загрузить скриншот плана в JPG или PNG.");
          return;
        }

        const parsedRooms = await parseRoomsFromText(extractedText);
        const dimensionsMatch = extractedText.match(/\b\d+([.,]\d+)?\s?[xх×]\s?\d+([.,]\d+)?\b/g);

        setPlanAnalysis({
          detected_dimensions: dimensionsMatch?.slice(0, 5).join(", ") || "",
          detected_zones: parsedRooms.length > 0 ? summarizeParsedRooms(parsedRooms) : extractedText.slice(0, 500),
          notes: "Данные извлечены из текстового слоя PDF. Если план был сканирован как изображение, точность может быть ниже.",
        });
        toast.success("Данные из PDF извлечены");
        return;
      }

      const buffer = await planFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      const base64 = btoa(binary);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: planFile.type,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || `Ошибка: ${response.status}`);
      }

      const result = await response.json();
      setPlanAnalysis(result);
      toast.success("План распознан");
    } catch (error: any) {
      toast.error(error.message || "Ошибка распознавания");
      console.error(error);
    } finally {
      setAnalyzingPlan(false);
    }
  };

  const handleApplyPlanData = () => {
    if (!planAnalysis) return;
    const planText = buildPlanText(planAnalysis);
    setForm((prev) => ({
      ...prev,
      rooms_description: prev.rooms_description ? `${prev.rooms_description}\n${planText}` : planText,
      raw_input: prev.raw_input ? `${prev.raw_input}\nИз плана:\n${planText}` : `Из плана:\n${planText}`,
    }));
    toast.success("Данные из плана добавлены в форму");
  };

  const handleFillRoomsFromPlan = async () => {
    if (!planAnalysis) return;
    const planText = buildPlanText(planAnalysis);
    if (!planText.trim()) {
      toast.info("В распознанном плане пока нет данных для заполнения помещений");
      return;
    }

    setFillingRooms(true);
    try {
      const parsed = await parseRoomsFromText(planText);
      if (parsed.length === 0) {
        toast.info("Не удалось извлечь помещения и размеры из плана");
        return;
      }
      const nextRooms = mapParsedRooms(parsed);
      setRooms(nextRooms);
      toast.success(`Из плана добавлено помещений: ${nextRooms.length}`);
    } catch (error: any) {
      toast.error(error.message || "Ошибка разбора помещений из плана");
    } finally {
      setFillingRooms(false);
    }
  };

  const handleFillRoomsFromDescription = async () => {
    if (!form.rooms_description.trim()) return;

    setFillingRooms(true);
    try {
      const parsed = await parseRoomsFromText(form.rooms_description);
      if (parsed.length === 0) {
        toast.info("Не удалось распознать помещения, проверьте описание");
        return;
      }
      const nextRooms = mapParsedRooms(parsed);
      setRooms(nextRooms);
      toast.success(`Добавлено помещений: ${nextRooms.length}`);
    } catch (error: any) {
      toast.error(error.message || "Ошибка распознавания");
    } finally {
      setFillingRooms(false);
    }
  };

  const handleGenerate = async () => {
    const hasRooms = rooms.some((room) => room.name.trim());
    const hasDescription = form.rooms_description.trim().length > 0;
    const hasPlan = !!planFile;
    const hasSomething = hasRooms || hasDescription || hasPlan;

    if (!form.name.trim()) {
      toast.error("Введите название проекта");
      return;
    }
    if (!hasSomething) {
      toast.error("Заполните хотя бы одну из секций: загрузите план, добавьте помещения или опишите проект текстом");
      return;
    }
    if (rooms.length > 0 && rooms.some((room) => !room.name.trim())) {
      toast.error("Укажите название для каждого добавленного помещения");
      return;
    }

    setLoading(true);
    try {
      let planUrl: string | undefined;
      if (planFile) {
        planUrl = await uploadPlanFile(planFile, "temp", 0);
      }

      const project = await createProject({
        name: form.name,
        raw_input: form.raw_input || undefined,
        rooms_description: form.rooms_description || undefined,
        plan_url: planUrl,
      });

      if (planFile) {
        planUrl = await uploadPlanFile(planFile, project.id, 0);
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("projects").update({ plan_url: planUrl }).eq("id", project.id);
      }

      if (rooms.filter((room) => room.name.trim()).length > 0) {
        const roomsToSave = rooms
          .filter((room) => room.name.trim())
          .map((room, index) => ({
            name: room.name,
            room_type: room.room_type,
            dimensions_text: room.dimensions_text || undefined,
            sort_order: index,
          }));
        await saveRooms(project.id, roomsToSave);
      }

      if (userRefs.length > 0) {
        await upsertBrief(project.id, {
          user_refs: userRefs,
          user_refs_structured: buildStructuredUserRefs(userRefs),
        });
      }

      localStorage.removeItem(DRAFT_KEY);
      toast.success("Проект создан");
      navigate(`/project/${project.id}/brief`);
    } catch (error) {
      toast.error("Ошибка при создании проекта");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isPdf = planFile?.type === "application/pdf";
  const hasRooms = rooms.some((room) => room.name.trim());
  const hasDescription = form.rooms_description.trim().length > 0;
  const hasPlan = !!planFile;
  const hasSomething = hasRooms || hasDescription || hasPlan;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-display text-foreground sm:text-4xl">Новый проект</h1>
          <p className="text-muted-foreground">Соберите всё, что уже есть от клиента или застройщика: план, помещения, материалы и заметки.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Название проекта *</Label>
            <Input id="name" placeholder="Квартира Ивановых, ул. Ленина 10" value={form.name} onChange={(event) => set("name", event.target.value)} />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <Label className="text-base font-semibold">А. Чертеж или план помещения (необязательно)</Label>
              <p className="mt-1 text-xs text-muted-foreground">Загрузите план от застройщика или свой эскиз. После распознавания можно перенести помещения и габариты прямо в проект.</p>
            </div>

            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handlePlanSelect} />

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

                {!planAnalysis && planFile.type.startsWith("image/") && (
                  <Button type="button" variant="outline" className="w-full" onClick={handleAnalyzePlan} disabled={analyzingPlan}>
                    {analyzingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scan className="mr-2 h-4 w-4" />}
                    {analyzingPlan ? "Распознаю план..." : "Распознать план через AI"}
                  </Button>
                )}

                {!planAnalysis && planFile.type === "application/pdf" && (
                  <Button type="button" variant="outline" className="w-full" onClick={handleAnalyzePlan} disabled={analyzingPlan}>
                    {analyzingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scan className="mr-2 h-4 w-4" />}
                    {analyzingPlan ? "Извлекаю данные из PDF..." : "Извлечь помещения и габариты из PDF"}
                  </Button>
                )}

                {planAnalysis && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
                      Распознано из плана
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-border p-3 text-sm">
                      {planAnalysis.detected_dimensions && (
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Габариты:</span>
                          <p className="text-foreground">{planAnalysis.detected_dimensions}</p>
                        </div>
                      )}
                      {planAnalysis.detected_zones && (
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Помещения:</span>
                          <p className="text-foreground">{planAnalysis.detected_zones}</p>
                        </div>
                      )}
                      {planAnalysis.notes && (
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Примечания:</span>
                          <p className="text-foreground">{planAnalysis.notes}</p>
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleApplyPlanData}>
                          Подставить в форму
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleFillRoomsFromPlan} disabled={fillingRooms}>
                          {fillingRooms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Заполнить помещения из плана
                        </Button>
                      </div>
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

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <Label className="text-base font-semibold">Б. Список помещений</Label>
              <p className="mt-1 text-xs text-muted-foreground">Можно добавить вручную, заполнить из текста или перенести из распознанного чертежа.</p>
            </div>

            {rooms.map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} canDelete onChange={handleRoomChange} onDelete={deleteRoom} />
            ))}

            <Button type="button" variant="outline" className="w-full" onClick={addRoom}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить помещение
            </Button>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" disabled={fillingRooms || !planAnalysis} onClick={handleFillRoomsFromPlan}>
                {fillingRooms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {fillingRooms ? "Распознаю..." : "Заполнить помещения из чертежа"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" disabled={fillingRooms || !form.rooms_description.trim()} onClick={handleFillRoomsFromDescription}>
                {fillingRooms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {fillingRooms ? "Распознаю..." : "Заполнить габариты из текста"}
              </Button>
            </div>

            {!planAnalysis && (
              <p className="text-xs text-muted-foreground">Чтобы перенести помещения из чертежа, сначала загрузите план и запустите его распознавание.</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <Label className="text-base font-semibold">В. Описание текстом</Label>
              <p className="mt-1 text-xs text-muted-foreground">Нет ни плана, ни точных размеров — опишите словами, AI разберется.</p>
            </div>
            <Textarea
              placeholder="Баня 10x6, внутри парилка, душевая, комната отдыха и тамбур..."
              className="min-h-[100px]"
              value={form.rooms_description}
              onChange={(event) => set("rooms_description", event.target.value)}
            />
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <FolderOpen className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <Label className="text-base font-semibold">Г. Материалы от заказчика</Label>
                <p className="mt-1 text-sm text-muted-foreground">Это ключевая секция для структурирования хаоса: сюда складываем референсы, файлы, переписку, голосовые расшифровки и любые сырые пожелания клиента.</p>
              </div>
            </div>

            <div>
              <Label className="mb-3 block text-sm font-medium text-foreground">Референсы клиента</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <RefUploadCard
                  refs={userRefs}
                  step="project"
                  maxRefs={6}
                  onAdd={(ref) => setUserRefs((prev) => [...prev, { ...ref, step: "project" }])}
                  onRemove={(index) => setUserRefs((prev) => prev.filter((_, idx) => idx !== index))}
                  onUpdate={(index, nextRef) => setUserRefs((prev) => prev.map((ref, idx) => (idx === index ? nextRef : ref)))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="raw" className="text-sm font-medium text-foreground">Заметки / переписка / транскрипт</Label>
              <Textarea id="raw" placeholder={RAW_INPUT_PLACEHOLDER} className="min-h-[180px]" value={form.raw_input} onChange={(event) => set("raw_input", event.target.value)} />
            </div>
          </div>

          {!hasSomething && <p className="text-center text-sm text-muted-foreground">Заполните хотя бы одну из секций А, Б или В</p>}

          <Button onClick={handleGenerate} disabled={loading} className="h-12 w-full text-base" size="lg">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Сгенерировать бриф
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewProject;
