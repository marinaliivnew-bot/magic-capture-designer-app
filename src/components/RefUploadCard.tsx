import { useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import RefUploadModal from "./RefUploadModal";

export interface UserRef {
  url: string;
  type: "file" | "link";
  step: string;
}

interface RefUploadCardProps {
  refs: UserRef[];
  step: string;
  maxRefs: number;
  onAdd: (ref: { url: string; type: "file" | "link" }) => void;
  onRemove: (index: number) => void;
}

const RefUploadCard = ({ refs, step, maxRefs, onAdd, onRemove }: RefUploadCardProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const stepRefs = refs.filter((r) => r.step === step);
  const canAdd = stepRefs.length < maxRefs;

  return (
    <>
      {/* Show uploaded refs as cards */}
      {stepRefs.map((ref, idx) => (
        <div
          key={ref.url}
          className="group relative flex flex-col overflow-hidden border border-primary"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
            <img
              src={ref.url}
              alt="Мой референс"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(refs.indexOf(ref))}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-foreground/70 text-background hover:bg-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="px-3 py-3 text-left">
            <p className="label-style text-foreground">Мой референс</p>
          </div>
        </div>
      ))}

      {/* Upload trigger card */}
      {canAdd && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            "group relative flex flex-col overflow-hidden border border-dashed border-border",
            "hover:border-primary/50 transition-all duration-350 focus:outline-none"
          )}
        >
          <div className="relative aspect-[4/3] w-full flex flex-col items-center justify-center gap-3 bg-background">
            <Upload className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-center">
              <p className="label-style text-foreground">Свой референс</p>
              <p className="mt-1 text-[11px] text-muted-foreground">JPG, PNG, ссылка</p>
            </div>
          </div>
          <div className="px-3 py-3" />
        </button>
      )}

      <RefUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUploaded={(ref) => onAdd({ ...ref })}
      />
    </>
  );
};

export default RefUploadCard;
