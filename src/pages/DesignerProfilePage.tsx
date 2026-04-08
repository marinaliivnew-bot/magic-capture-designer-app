import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft, Plus, X, Ruler, Palette, Ban } from "lucide-react";
import { getDesignerProfile, upsertDesignerProfile, type DesignerProfile } from "@/lib/api";

const CONSTRAINTS = [
  { key: "no_gloss", label: "Не использую глянцевые поверхности" },
  { key: "no_black", label: "Не использую черный цвет" },
  { key: "no_mdf", label: "Не использую МДФ/ДСП" },
  { key: "min_passage_70", label: "Минимум 70 см проход" },
  { key: "pet_friendly", label: "Pet-friendly материалы" },
  { key: "child_safe", label: "Безопасно для детей" },
];

const ERGONOMICS = [
  { key: "kitchen_counter_90", label: "Кухня: столешница 90 см" },
  { key: "bedside_10_15", label: "Тумбочка 10-15 см от кровати" },
  { key: "sofa_depth_80", label: "Глубина дивана мин. 80 см" },
  { key: "wardrobe_60", label: "Шкаф глубиной 60 см" },
  { key: "door_90", label: "Ширина прохода мин. 90 см" },
];

const getSessionId = () => {
  let id = localStorage.getItem("designer_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("designer_session_id", id);
  }
  return id;
};

const DesignerProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionId] = useState(getSessionId());

  const [profile, setProfile] = useState<DesignerProfile>({
    session_id: sessionId,
    style_description: "",
    style_refs: [],
    hard_constraints: {},
    ergonomics_rules: {},
    custom_ergonomics_text: "",
  });

  const [newRef, setNewRef] = useState("");

  useEffect(() => {
    loadProfile();
  }, [sessionId]);

  const loadProfile = async () => {
    try {
      const data = await getDesignerProfile(sessionId);
      if (data) setProfile(data);
    } catch (e) {
      console.error("Error loading profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertDesignerProfile(profile);
      toast.success("Профиль сохранен");
    } catch (e) {
      toast.error("Ошибка сохранения");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleConstraint = (key: string) => {
    setProfile((prev) => ({
      ...prev,
      hard_constraints: { ...prev.hard_constraints, [key]: !prev.hard_constraints[key] },
    }));
  };

  const toggleErgonomics = (key: string) => {
    setProfile((prev) => ({
      ...prev,
      ergonomics_rules: { ...prev.ergonomics_rules, [key]: !prev.ergonomics_rules[key] },
    }));
  };

  const addRef = () => {
    if (!newRef.trim()) return;
    setProfile((prev) => ({ ...prev, style_refs: [...prev.style_refs, newRef.trim()] }));
    setNewRef("");
  };

  const removeRef = (idx: number) => {
    setProfile((prev) => ({ ...prev, style_refs: prev.style_refs.filter((_, i) => i !== idx) }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display">Мои стандарты</h1>
            <p className="text-sm text-muted-foreground">Настройте один раз — применяется ко всем проектам</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Style */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <Label className="text-lg font-semibold">Мой стиль</Label>
            </div>
            <Textarea
              placeholder="Опишите ваш подход: теплые интерьеры, минимализм..."
              value={profile.style_description}
              onChange={(e) => setProfile((p) => ({ ...p, style_description: e.target.value }))}
              className="min-h-[100px]"
            />
          </section>

          {/* References */}
          <section className="space-y-3">
            <Label className="text-lg font-semibold">Ссылки на референсы</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://pinterest.com/..."
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRef()}
              />
              <Button type="button" variant="outline" onClick={addRef}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.style_refs.map((ref, i) => (
                <div key={i} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm">
                  <a href={ref} target="_blank" rel="noreferrer" className="truncate max-w-[200px]">
                    {ref}
                  </a>
                  <button onClick={() => removeRef(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Constraints */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              <Label className="text-lg font-semibold">Жесткие ограничения</Label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONSTRAINTS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={!!profile.hard_constraints[c.key]}
                    onChange={() => toggleConstraint(c.key)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Ergonomics */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-primary" />
              <Label className="text-lg font-semibold">Эргономические стандарты</Label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ERGONOMICS.map((e) => (
                <label key={e.key} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={!!profile.ergonomics_rules[e.key]}
                    onChange={() => toggleErgonomics(e.key)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{e.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Custom text */}
          <section className="space-y-3">
            <Label className="text-lg font-semibold">Дополнительные стандарты (текст/PDF)</Label>
            <Textarea
              placeholder="Вставьте текст из PDF или опишите свои правила..."
              value={profile.custom_ergonomics_text || ""}
              onChange={(e) => setProfile((p) => ({ ...p, custom_ergonomics_text: e.target.value }))}
              className="min-h-[150px]"
            />
          </section>

          {/* Save */}
          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Сохранение..." : "Сохранить профиль"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignerProfilePage;
