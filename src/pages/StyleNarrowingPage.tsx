import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, upsertBrief, getBrief } from "@/lib/api";
import {
  STYLE_CARDS,
  COLOR_CARDS,
  MATERIAL_CARDS,
  DISLIKE_CARDS,
  type StyleCardDef,
} from "@/lib/style-cards";
import StyleCard from "@/components/StyleCard";
import RefUploadCard, { type UserRef } from "@/components/RefUploadCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

type ImageCache = Record<string, { url: string; attribution: string }>;

const STEPS = [
  { key: "styles", title: "Стиль", subtitle: "Выберите 1–3 стиля, которые вам ближе", cards: STYLE_CARDS, min: 1, max: 3, allowRefs: true },
  { key: "colors", title: "Цвет", subtitle: "Выберите 1 цветовую палитру", cards: COLOR_CARDS, min: 1, max: 1, allowRefs: true },
  { key: "materials", title: "Материалы", subtitle: "Выберите все подходящие материалы", cards: MATERIAL_CARDS, min: 1, max: 6, allowRefs: true },
  { key: "dislikes", title: "Антипатии", subtitle: "Что точно «не ваше»? (можно пропустить)", cards: DISLIKE_CARDS, min: 0, max: 10, allowRefs: false },
] as const;

const MAX_REFS_PER_STEP = 3;

const StyleNarrowingPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({
    styles: [],
    colors: [],
    materials: [],
    dislikes: [],
  });
  const [userRefs, setUserRefs] = useState<UserRef[]>([]);
  const [images, setImages] = useState<ImageCache>({});
  const [loadingImages, setLoadingImages] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const allCards: StyleCardDef[] = [
      ...STYLE_CARDS,
      ...COLOR_CARDS,
      ...MATERIAL_CARDS,
    ];
    const queries: Record<string, string> = {};
    allCards.forEach((c) => {
      queries[c.key] = c.query;
    });

    const fetchImages = async () => {
      try {
        const unsplashKey = import.meta.env.VITE_UNSPLASH_KEY;
        if (!unsplashKey) {
          throw new Error("Unsplash key is not configured");
        }

        const entries = Object.entries(queries);

        const results = await Promise.all(
          entries.map(async ([key, query]) => {
            try {
              const resp = await fetch(
                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
                  query
                )}&per_page=1`,
                {
                  headers: {
                    Authorization: `Client-ID ${unsplashKey}`,
                  },
                }
              );

              if (!resp.ok) {
                throw new Error("Failed to fetch from Unsplash");
              }

              const data = await resp.json();
              const photo = data.results?.[0];
              if (!photo) return [key, null] as const;

              const url =
                photo.urls?.regular ||
                photo.urls?.small ||
                photo.urls?.thumb ||
                "";

              if (!url) return [key, null] as const;

              return [
                key,
                {
                  url,
                  attribution: `${photo.user?.name || "Unsplash"} / Unsplash`,
                },
              ] as const;
            } catch (e) {
              console.error(`Error fetching Unsplash image for ${key}:`, e);
              return [key, null] as const;
            }
          })
        );

        const imageMap: ImageCache = {};
        for (const [key, value] of results) {
          if (value) {
            imageMap[key] = value;
          }
        }

        setImages(imageMap);
      } catch (e) {
        console.error("Error fetching style images:", e);
        toast.error("Не удалось загрузить изображения");
      } finally {
        setLoadingImages(false);
      }
    };
    fetchImages();
  }, []);

  const currentStep = STEPS[step];

  const toggleSelection = useCallback(
    (key: string) => {
      const stepKey = currentStep.key;
      setSelections((prev) => {
        const current = prev[stepKey] || [];
        if (current.includes(key)) {
          return { ...prev, [stepKey]: current.filter((k) => k !== key) };
        }
        if (current.length >= currentStep.max) {
          if (currentStep.max === 1) {
            return { ...prev, [stepKey]: [key] };
          }
          return prev;
        }
        return { ...prev, [stepKey]: [...current, key] };
      });
    },
    [currentStep]
  );

  const handleAddRef = useCallback(
    (ref: { url: string; type: "file" | "link" }) => {
      setUserRefs((prev) => [...prev, { ...ref, step: currentStep.key }]);
    },
    [currentStep.key]
  );

  const handleRemoveRef = useCallback((index: number) => {
    setUserRefs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const stepRefCount = userRefs.filter((r) => r.step === currentStep.key).length;
  const hasRefOrSelection =
    (selections[currentStep.key]?.length || 0) + stepRefCount >= currentStep.min;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const getLabel = (key: string): string => {
    const allCards = [...STYLE_CARDS, ...COLOR_CARDS, ...MATERIAL_CARDS, ...DISLIKE_CARDS];
    return allCards.find((c) => c.key === key)?.label || key;
  };

  const handleFinish = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      // Read existing brief to append, not overwrite
      const existingBrief = await getBrief(projectId);

      const likes: string[] = [];
      if (selections.styles.length)
        likes.push(`Стили: ${selections.styles.map(getLabel).join(", ")}`);
      if (selections.colors.length)
        likes.push(`Цвет: ${selections.colors.map(getLabel).join(", ")}`);
      if (selections.materials.length)
        likes.push(`Материалы: ${selections.materials.map(getLabel).join(", ")}`);

      const newLikes = likes.join("\n");
      const dislikes = selections.dislikes.length
        ? selections.dislikes.map(getLabel).join(", ")
        : "";

      // Append to existing values — prepend Style Narrowing result
      const existingLikes = (existingBrief as any)?.style_likes || "";
      const existingDislikes = (existingBrief as any)?.style_dislikes || "";

      // Remove old Style Narrowing data if re-running
      const cleanLikes = existingLikes
        .split("\n")
        .filter((line: string) => !line.startsWith("Стили:") && !line.startsWith("Цвет:") && !line.startsWith("Материалы:"))
        .join("\n")
        .trim();

      const mergedLikes = cleanLikes
        ? `${newLikes}\n${cleanLikes}`
        : newLikes;
      const mergedDislikes = existingDislikes
        ? `${dislikes}\n${existingDislikes}`
        : dislikes;

      // Save style_narrowing_result as structured JSON
      const styleNarrowingResult = {
        styles: selections.styles.map(k => ({ key: k, label: getLabel(k) })),
        colors: selections.colors.map(k => ({ key: k, label: getLabel(k) })),
        materials: selections.materials.map(k => ({ key: k, label: getLabel(k) })),
        dislikes: selections.dislikes.map(k => ({ key: k, label: getLabel(k) })),
      };

      const refsPayload = userRefs.map((r) => ({
        url: r.url,
        type: r.type,
        step: r.step,
      }));

      await upsertBrief(projectId, {
        style_likes: mergedLikes,
        style_dislikes: mergedDislikes,
        style_narrowing_result: styleNarrowingResult,
        user_refs: refsPayload,
      });

      toast.success("Стилевые предпочтения сохранены");
      navigate(`/project/${projectId}/brief`);
    } catch (e) {
      toast.error("Ошибка сохранения");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate(`/project/${projectId}/brief`);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-content px-12 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="font-display text-lg text-foreground hover:text-primary transition-colors duration-350 shrink-0"
            >
              Brief → Concept
            </a>
            <span className="text-muted-foreground text-[11px]">|</span>
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors duration-350"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                onClick={() => navigate(`/project/${projectId}/brief`)}
                className="text-muted-foreground hover:text-foreground transition-colors duration-350"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
              </button>
            )}
            <span className="font-display text-xl flex-1">{currentStep.title}</span>
            <Button variant="ghost" onClick={handleSkip}>
              Пропустить
            </Button>
          </div>
          {projectId && (
            <nav className="flex items-center gap-1 text-[11px] font-body font-medium uppercase tracking-[0.1em]">
              <span className="text-muted-foreground">Ввод → </span>
              <span className="text-primary">Стиль</span>
              <span className="text-muted-foreground"> → Бриф → Вопросы → Борд → Экспорт</span>
            </nav>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-content px-12 py-16">
        <p className="caption-style mb-8">{currentStep.subtitle}</p>

        <div className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-style text-muted-foreground">Шаг {step + 1} из {STEPS.length}</span>
            <span className="label-style text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {loadingImages ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-3 caption-style">Загружаю изображения…</span>
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

            {/* Upload ref cards — only on steps with allowRefs */}
            {currentStep.allowRefs && (
              <RefUploadCard
                refs={userRefs}
                step={currentStep.key}
                maxRefs={MAX_REFS_PER_STEP}
                onAdd={handleAddRef}
                onRemove={handleRemoveRef}
              />
            )}
          </div>
        )}

        <div className="mt-16 border-t border-border pt-8 flex gap-4">
          {step > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!hasRefOrSelection && currentStep.min > 0}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : step === STEPS.length - 1 ? (
              "Готово → к брифу"
            ) : (
              <>
                Далее
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StyleNarrowingPage;
