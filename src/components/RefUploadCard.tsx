import { useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTagsInput, parseTagsInput, type UserRef } from "@/lib/user-refs";
import RefUploadModal from "./RefUploadModal";

interface RefUploadCardProps {
  refs: UserRef[];
  step: string;
  maxRefs: number;
  onAdd: (ref: { url: string; type: "file" | "link" }) => void;
  onRemove: (index: number) => void;
  onUpdate?: (index: number, nextRef: UserRef) => void;
  showAnnotations?: boolean;
}

const RefUploadCard = ({
  refs,
  step,
  maxRefs,
  onAdd,
  onRemove,
  onUpdate,
  showAnnotations = true,
}: RefUploadCardProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const stepRefs = step === "all" ? refs : refs.filter((ref) => ref.step === step);
  const canAdd = stepRefs.length < maxRefs;

  return (
    <>
      {stepRefs.map((ref, stepIndex) => {
        const globalIndex = refs.indexOf(ref);
        const hasAnnotation = !!(ref.likes?.trim() || ref.dislikes?.trim() || ref.tags?.length);

        return (
          <div key={ref.url} className="group relative flex flex-col overflow-hidden border border-primary">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
              <img src={ref.url} alt={`Референс ${stepIndex + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(globalIndex)}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-foreground/70 text-background transition-colors hover:bg-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              {showAnnotations && (
                <div className={cn(
                  "absolute bottom-2 left-2 h-2 w-2 rounded-full",
                  hasAnnotation ? "bg-primary" : "bg-muted-foreground/50",
                )} title={hasAnnotation ? "Аннотация заполнена" : "Аннотация не заполнена"} />
              )}
            </div>

            <div className="space-y-3 px-3 py-3 text-left">
              <p className="label-style text-foreground">Референс {stepIndex + 1}</p>

              {showAnnotations && onUpdate && (
                <>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Что именно нравится</p>
                    <Textarea
                      value={ref.likes || ""}
                      onChange={(event) => onUpdate(globalIndex, { ...ref, likes: event.target.value })}
                      className="min-h-[84px]"
                      placeholder="Например: мягкий свет, цельный объём кухни, спокойная палитра"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Что не брать</p>
                    <Textarea
                      value={ref.dislikes || ""}
                      onChange={(event) => onUpdate(globalIndex, { ...ref, dislikes: event.target.value })}
                      className="min-h-[72px]"
                      placeholder="Например: глянец, холодный серый, слишком много декора"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Теги</p>
                    <Input
                      value={formatTagsInput(ref.tags)}
                      onChange={(event) => onUpdate(globalIndex, { ...ref, tags: parseTagsInput(event.target.value) })}
                      placeholder="дерево, теплый свет, арки"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {canAdd && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            "group relative flex flex-col overflow-hidden border border-dashed border-border",
            "transition-all duration-350 hover:border-primary/50 focus:outline-none",
          )}
        >
          <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-background">
            <Upload className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-center">
              <p className="label-style text-foreground">Добавить референс</p>
              <p className="mt-1 text-[11px] text-muted-foreground">JPG, PNG, ссылка</p>
            </div>
          </div>
          <div className="px-3 py-3" />
        </button>
      )}

      <RefUploadModal open={modalOpen} onClose={() => setModalOpen(false)} onUploaded={(ref) => onAdd({ ...ref })} />
    </>
  );
};

export default RefUploadCard;
