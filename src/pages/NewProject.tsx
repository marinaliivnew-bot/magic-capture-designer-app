import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/api";
import { saveRooms, uploadPlanFile } from "@/lib/rooms";
import RoomCard, { type RoomData } from "@/components/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus } from "lucide-react";

function makeRoom(): RoomData {
  return {
    id: crypto.randomUUID(),
    name: "",
    room_type: "other",
    dimensions_text: "",
    plan_file: null,
    plan_url: "",
    plan_preview: "",
  };
}

const NewProject = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    raw_input: "",
    budget: "",
    timeline: "",
    taboos: "",
    must_haves: "",
    nice_to_haves: "",
  });
  const [rooms, setRooms] = useState<RoomData[]>([makeRoom()]);

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

  const handleGenerate = async () => {
    if (!form.name.trim()) {
      toast.error("Введите название проекта");
      return;
    }
    if (rooms.some((r) => !r.name.trim())) {
      toast.error("Укажите название для каждого помещения");
      return;
    }

    setLoading(true);
    try {
      // Create project
      const project = await createProject({
        name: form.name,
        raw_input: form.raw_input || undefined,
        constraints: {
          budget: form.budget,
          timeline: form.timeline,
          taboos: form.taboos,
          must_haves: form.must_haves,
          nice_to_haves: form.nice_to_haves,
        },
      });

      // Upload plan files and save rooms
      const roomsToSave = await Promise.all(
        rooms.map(async (room, i) => {
          let planUrl = room.plan_url;
          if (room.plan_file) {
            planUrl = await uploadPlanFile(room.plan_file, project.id, i);
          }
          return {
            name: room.name,
            room_type: room.room_type,
            dimensions_text: room.dimensions_text || undefined,
            plan_url: planUrl || undefined,
            sort_order: i,
          };
        })
      );
      await saveRooms(project.id, roomsToSave);

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
            Заполните данные о помещениях и вставьте заметки
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

          {/* Rooms */}
          <div className="space-y-3">
            <Label>Помещения *</Label>
            {rooms.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                index={i}
                canDelete={rooms.length > 1}
                onChange={handleRoomChange}
                onDelete={deleteRoom}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addRoom}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить помещение
            </Button>
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
