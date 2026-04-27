import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Palette } from "lucide-react";
import { getBrief, getProject, upsertBrief } from "@/lib/api";
import {
  COLOR_CARDS,
  DISLIKE_CARDS,
  MATERIAL_CARDS,
  STYLE_CARDS,
  type StyleCardDef,
} from "@/lib/style-cards";
import StyleCard from "@/components/StyleCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type ImageCache = Record<string, { url: string; attribution: string }>;

type NarrowingResult = {
  styles: Array<{ key: string; label: string }>;
  colors: Array<{ key: string; label: string }>;
  materials: Array<{ key: string; label: string }>;
  dislikes: Array<{ key: string; label: string }>;
};

const STEPS = [
  {
    key: "styles",
    title: "Стиль",
    subtitle: "Выберите 1-3 стилевых направления, которые ближе всего к ожиданиям клиента.",
    cards: STYLE_CARDS,
    min: 1,
    max: 3,
  },
  {
    key: "colors",
    title: "Цвет",
    subtitle: "Выберите одну основную цветовую палитру.",
    cards: COLOR_CARDS,
    min: 1,
    max: 1,
  },
  {
    key: "materials",
    title: "Материалы",
    subtitle: "Отметьте материалы, которые считываются как уместные для клиента.",
    cards: MATERIAL_CARDS,
    min: 1,
    max: 6,
  },
  {
    key: "dislikes",
    title: "Что не подходит",
    subtitle: "Отметьте то, что точно не совпадает с ожиданиями клиента.",
    cards: DISLIKE_CARDS,
    min: 0,
    max: 10,
  },
] as const;

const StyleNarrowingPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [briefLikes, setBriefLikes] = useState("");
  const [briefDislikes, setBriefDislikes] = useState("");
  const [selections, setSelections] = useState<Record<string, string[]>>({
    styles: [],
    colors: [],
    materials: [],
    dislikes: [],
  });
  const [images, setImages] = useState<ImageCache>({});
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadingBrief, setLoadingBrief] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const [project, brief] = await Promise.all([getProject(projectId), getBrief(projectId)]);
        setProjectName(project?.name || "");
        setBriefLikes((brief as any)?.style_likes || "");
        setBriefDislikes((brief as any)?.style_dislikes || "");

        const narrowing = (brief as any)?.style_narrowing_result as NarrowingResult | null;
        if (narrowing) {
          setSelections({
            styles: Array.isArray(narrowing.styles) ? narrowing.styles.map((item) => item.key) : [],
            colors: Array.isArray(narrowing.colors) ? narrowing.colors.map((item) => item.key) : [],
            materials: Array.isArray(narrowing.materials) ? narrowing.materials.map((item) => item.key) : [],
            dislikes: Array.isArray(narrowing.dislikes) ? narrowing.dislikes.map((item) => item.key) : [],
          });
        }
      } catch (error) {
        toast.error("Ошибка загрузки данных брифа");
        console.error(error);
      } finally {
        setLoadingBrief(false);
      }
    };

    load();
  }, [projectId]);

  useEffect(() => {
    const allCards: StyleCardDef[] = [...STYLE_CARDS, ...COLOR_CARDS, ...MATERIAL_CARDS];
    const queries: Record<string, string> = {};
    allCards.forEach((card) => {
      queries[card.key] = card.query;
    });

    const fetchImages = async () => {
      try {
        const unsplashKey = import.meta.env.VITE_UNSPLASH_KEY;
        if (!unsplashKey) {
          throw new Error("Unsplash key is not configured");
        }

        const results = await Promise.all(
          Object.entries(queries).map(async ([key, query]) => {
            try {
              const response = await fetch(
                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`,
                {
                  headers: {
                    Authorization: `Client-ID ${unsplashKey}`,
                  },
                },
              );

              if (!response.ok) {
                throw new Error("Failed to fetch from Unsplash");
              }

              const data = await response.json();
              const items = data.results || [];
              const photo = items.length > 0 ? items[Math.floor(Math.random() * Math.min(items.length, 10))] : null;
              if (!photo) return [key, null] as const;

              const url = photo.urls?.regular || photo.urls?.small || photo.urls?.thumb || "";
              if (!url) return [key, null] as const;

              return [
                key,
                {
                  url,
                  attribution: `${photo.user?.name || "Unsplash"} / Unsplash`,
                },
              ] as const;
            } catch (error) {
              console.error(`Error fetching Unsplash image for ${key}:`, error);
              return [key, null] as const;
            }
          }),
        );

        const imageMap: ImageCache = {};
        for (const [key, value] of results) {
          if (value) imageMap[key] = value;
        }
        setImages(imageMap);
      } catch (error) {
        console.error("Error fetching style images:", error);
        toast.error("Не удалось загрузить изображения");
      } finally {
        setLoadingImages(false);
      }
    };

    fetchImages();
  }, []);

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const selectedCount = selections[currentStep.key]?.length || 0;
  const canContinue = selectedCount >= currentStep.min;

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (briefLikes.trim()) parts.push(`Из brief: ${briefLikes}`);
    if (briefDislikes.trim()) parts.push(`Из ограничений вкуса: ${briefDislikes}`);
    return parts.join("\n\n");
  }, [briefDislikes, briefLikes]);

  const toggleSelection = (key: string) => {
    const stepKey = currentStep.key;
    setSelections((prev) => {
      const current = prev[stepKey] || [];
      if (current.includes(key)) {
        return { ...prev, [stepKey]: current.filter((item) => item !== key) };
      }
      if (current.length >= currentStep.max) {
        if (currentStep.max === 1) {
          return { ...prev, [stepKey]: [key] };
        }
        return prev;
      }
      return { ...prev, [stepKey]: [...current, key] };
    });
  };

  const getLabel = (key: string) => {
    const allCards = [...STYLE_CARDS, ...COLOR_CARDS, ...MATERIAL_CARDS, ...DISLIKE_CARDS];
    return allCards.find((card) => card.key === key)?.label || key;
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    if (!projectId) return;

    setSaving(true);
    try {
      const existingBrief = await getBrief(projectId);
      const likes: string[] = [];

      if (selections.styles.length) likes.push(`Стили: ${selections.styles.map(getLabel).join(", ")}`);
      if (selections.colors.length) likes.push(`Цвет: ${selections.colors.map(getLabel).join(", ")}`);
      if (selections.materials.length) likes.push(`Материалы: ${selections.materials.map(getLabel).join(", ")}`);

      const newLikes = likes.join("\n");
      const dislikes = selections.dislikes.length ? selections.dislikes.map(getLabel).join(", ") : "";

      const existingLikes = (existingBrief as any)?.style_likes || "";
      const existingDislikes = (existingBrief as any)?.style_dislikes || "";

      const cleanLikes = existingLikes
        .split("\n")
        .filter((line: string) => !line.startsWith("Стили:") && !line.startsWith("Цвет:") && !line.startsWith("Материалы:"))
        .join("\n")
        .trim();

      const mergedLikes = cleanLikes ? `${newLikes}\n${cleanLikes}` : newLikes;
      const mergedDislikes = existingDislikes ? `${dislikes}\n${existingDislikes}`.trim() : dislikes;

      const styleNarrowingResult = {
        styles: selections.styles.map((key) => ({ key, label: getLabel(key) })),
        colors: selections.colors.map((key) => ({ key, label: getLabel(key) })),
        materials: selections.materials.map((key) => ({ key, label: getLabel(key) })),
        dislikes: selections.dislikes.map((key) => ({ key, label: getLabel(key) })),
      };

      await upsertBrief(projectId, {
        style_likes: mergedLikes,
        style_dislikes: mergedDislikes,
        style_narrowing_result: styleNarrowingResult,
      });

      toast.success("Уточнение вкуса сохранено");
      navigate(`/project/${projectId}/brief`);
    } catch (error) {
      toast.error("Ошибка сохранения");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
      return;
    }
    navigate(`/project/${projectId}/brief`);
  };

  if (loadingBrief) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-12 py-4">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="text-muted-foreground transition-colors duration-350 hover:text-foreground">
              <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <span className="flex-1 font-display text-xl">{currentStep.title}</span>
            <Button variant="ghost" onClick={() => navigate(`/project/${projectId}/brief`)}>
              Вернуться к brief
            </Button>
          </div>
          <nav className="flex items-center gap-1 text-[11px] font-body font-medium uppercase tracking-[0.1em]">
            <span className="text-muted-foreground">Ввод → Brief → </span>
            <span className="text-primary">Стиль</span>
            <span className="text-muted-foreground"> → Вопросы → Борд → Экспорт</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-content px-12 py-16">
        <div className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <aside className="space-y-4 border border-border bg-card p-5">
            <div>
              <span className="label-style text-muted-foreground">Проект</span>
              <p className="mt-2 text-sm text-foreground">{projectName || "Без названия"}</p>
            </div>
            <div>
              <span className="label-style text-muted-foreground">Что делает этот шаг</span>
              <p className="mt-2 text-sm text-muted-foreground">
                Здесь мы не загружаем новые референсы, а уточняем уже собранный вкус клиента через карточный выбор.
              </p>
            </div>
            <div>
              <span className="label-style text-muted-foreground">Опора из brief</span>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {summaryText || "Сначала заполните brief-поля про вкус клиента, затем уточните выбор здесь."}
              </p>
            </div>
          </aside>

          <section>
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <span className="label-style text-muted-foreground">Шаг {step + 1} из {STEPS.length}</span>
                <span className="label-style text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="mb-8">
              <div className="mb-2 flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <h1 className="font-display text-2xl text-foreground">{currentStep.title}</h1>
              </div>
              <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
            </div>

            {loadingImages ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">Загружаю изображения...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {currentStep.cards.map((card) => (
                  <StyleCard
                    key={card.key}
                    label={card.label}
                    description={"description" in card ? (card as any).description : undefined}
                    imageUrl={images[card.key]?.url || ""}
                    attribution={images[card.key]?.attribution || ""}
                    selected={(selections[currentStep.key] || []).includes(card.key)}
                    onClick={() => toggleSelection(card.key)}
                  />
                ))}
              </div>
            )}

            <div className="mt-12 border-t border-border pt-8">
              <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Выбрано: {selectedCount}</span>
                <span>
                  {currentStep.min > 0 ? `Минимум ${currentStep.min}` : "Можно пропустить"}
                  {currentStep.max ? `, максимум ${currentStep.max}` : ""}
                </span>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад
                </Button>
                <Button onClick={handleNext} disabled={!canContinue || saving} className="flex-1">
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : step === STEPS.length - 1 ? (
                    "Сохранить и вернуться в brief"
                  ) : (
                    <>
                      Далее
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StyleNarrowingPage;
