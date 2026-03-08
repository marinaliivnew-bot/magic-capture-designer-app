import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, upsertBrief } from "@/lib/api";
import {
  STYLE_CARDS,
  COLOR_CARDS,
  MATERIAL_CARDS,
  DISLIKE_CARDS,
  type StyleCardDef,
} from "@/lib/style-cards";
import StyleCard from "@/components/StyleCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, SkipForward } from "lucide-react";

type ImageCache = Record<string, { url: string; attribution: string }>;

const STEPS = [
  { key: "styles", title: "Стиль", subtitle: "Выберите 1–2 стиля, которые вам ближе", cards: STYLE_CARDS, min: 1, max: 2 },
  { key: "colors", title: "Цвет", subtitle: "Выберите 1 цветовую палитру", cards: COLOR_CARDS, min: 1, max: 1 },
  { key: "materials", title: "Материалы", subtitle: "Выберите все подходящие материалы", cards: MATERIAL_CARDS, min: 1, max: 6 },
  { key: "dislikes", title: "Антипатии", subtitle: "Что точно «не ваше»? (можно пропустить)", cards: DISLIKE_CARDS, min: 0, max: 10 },
] as const;

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
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-style-images`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ queries }),
          }
        );
        if (!resp.ok) throw new Error("Failed to fetch images");
        const data = await resp.json();
        setImages(data.images || {});
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

  const canProceed =
    (selections[currentStep.key]?.length || 0) >= currentStep.min;

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
    const allCards = [...STYLE_CARDS, ...COLOR_CARDS, ...MATERIAL_CARDS];
    return allCards.find((c) => c.key === key)?.label || key;
  };

  const handleFinish = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const likes: string[] = [];
      if (selections.styles.length)
        likes.push(`Стили: ${selections.styles.map(getLabel).join(", ")}`);
      if (selections.colors.length)
        likes.push(`Цвет: ${selections.colors.map(getLabel).join(", ")}`);
      if (selections.materials.length)
        likes.push(`Материалы: ${selections.materials.map(getLabel).join(", ")}`);

      const dislikes = selections.dislikes.length
        ? selections.dislikes.map(getLabel).join(", ")
        : "";

      await upsertBrief(projectId, {
        style_likes: likes.join("\n"),
        style_dislikes: dislikes,
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
        <div className="mx-auto max-w-content px-12 py-4 flex items-center gap-4">
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
      </header>

      <div className="mx-auto max-w-content px-12 py-16">
        {/* Subtitle */}
        <p className="caption-style mb-8">{currentStep.subtitle}</p>

        {/* Progress */}
        <div className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-style text-muted-foreground">Шаг {step + 1} из {STEPS.length}</span>
            <span className="label-style text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Cards grid */}
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
                imageUrl={images[card.key]?.url || ""}
                attribution={images[card.key]?.attribution || ""}
                selected={(selections[currentStep.key] || []).includes(card.key)}
                onClick={() => toggleSelection(card.key)}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-16 border-t border-border pt-8 flex gap-4">
          {step > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed && currentStep.min > 0}
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
